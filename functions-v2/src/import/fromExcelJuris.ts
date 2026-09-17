import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as XLSX from 'xlsx';
import { historyEntryId } from '../shared/history';
import {
    resolveJurimetriaSettings,
    JurimetriaSettings,
    normalizeText,
    normalizeProcessNumber,
    parseJuriDate,
    normalizeHorario,
    fuzzyMatchFromList,
    normalizeTipo,
    normalizeResultado,
    normalizeRealizacao,
    JURI_COMPARABLE_FIELDS,
} from '../shared/jurimetria';

interface ImportJurisRequest {
    organizationId: string;
    /** Conteúdo do arquivo em base64 (.xlsx, .xls, .csv ou JSON). */
    fileData: string;
    fileName?: string;
    /**
     * 'preview' apenas analisa e devolve o relatório (nada é gravado);
     * 'commit' grava os registros aprovados. O cliente chama nesta ordem.
     */
    mode?: 'preview' | 'commit';
    /**
     * Sobrepõe a política de conflito do órgão só para esta importação:
     * 'preserve' mantém o que está no banco; 'update' sobrescreve com a planilha.
     */
    policy?: 'preserve' | 'update';
}

type RowStatus = 'novo' | 'sem_mudanca' | 'atualizacao' | 'conflito' | 'invalido';

interface ParsedRow {
    row: number;
    status: RowStatus;
    numero_processo: string;
    numero_processo_norm: string;
    core: Record<string, string>;
    values: Record<string, unknown>;
    /** Id do documento existente (quando o processo já está no banco). */
    existingId?: string;
    /** Campos em que a planilha SOBRESCREVE um valor já preenchido. */
    diffs?: Array<{ field: string; current: string; incoming: string }>;
    /** Campos VAZIOS no banco que a planilha preenche (ganho puro). */
    fills?: Array<{ field: string; current: string; incoming: string }>;
    /** Data do júri gravada antes desta importação (para o histórico). */
    currentDate?: string;
    error?: string;
}

interface Correction {
    row: number;
    field: string;
    from: string;
    to: string;
}

/** Rótulos dos campos, para os registros de atividade ficarem legíveis. */
const FIELD_LABELS: Record<string, string> = {
    data_juri: 'Data do júri',
    realizacao: 'Realização',
    comarca: 'Comarca',
    tipo: 'Matéria / Tipo',
    resultado: 'Espécie de resultado',
    promotor: 'Promotor(a)',
    horario: 'Horário',
    vara: 'Vara / Órgão julgador',
    observacoes: 'Observações',
};

const MAX_ROWS = 20000;
const SAMPLE_LIMIT = 300;
const LOOKUP_CHUNK = 30;
const WRITE_BATCH = 400;

// ----------------------------------------------------------------------------
// Mapeamento flexível de colunas
// ----------------------------------------------------------------------------
// Cada campo aceita várias grafias de cabeçalho. A comparação é feita sobre o
// cabeçalho normalizado (minúsculo, sem acento, espaços colapsados).

const COLUMN_SYNONYMS: Record<string, string[]> = {
    numero_processo: [
        'cnj', 'numero cnj', 'n cnj', 'no cnj', 'nº cnj', 'processo', 'numero do processo',
        'numero processo', 'n processo', 'no processo', 'nº processo', 'num processo',
        'numero', 'autos', 'numero dos autos', 'process_number', 'numero_processo',
    ],
    data_juri: [
        'data', 'data do juri', 'data do júri', 'data juri', 'data da sessao',
        'data da sessão', 'data sessao', 'dt', 'data_juri', 'date',
    ],
    realizacao: [
        'realizacao', 'realização', 'situacao', 'situação', 'status',
        'situacao da sessao', 'situação da sessão', 'sessao', 'sessão',
        'realizado', 'status do juri', 'status do júri',
    ],
    comarca: ['comarca', 'comarca (codigo)', 'municipio', 'município', 'foro'],
    tipo: [
        'tipo', 'materia', 'matéria', 'tipo de juri', 'tipo de júri', 'tipo juri',
        'materia/tipo', 'materia tipo', 'sigla', 'classificacao', 'classificação',
    ],
    resultado: [
        'resultado', 'especie', 'espécie', 'especie de resultado',
        'espécie de resultado', 'decisao', 'decisão', 'resultado do juri',
        'resultado do júri', 'veredito',
    ],
    promotor: [
        'promotor', 'promotora', 'promotor(a)', 'promotor de justica',
        'promotor de justiça', 'promotoria', 'responsavel mp', 'membro',
    ],
    horario: ['horario', 'horário', 'hora', 'hr', 'horario da sessao', 'horário da sessão'],
    vara: [
        'vara', 'orgao', 'órgão', 'orgao julgador', 'órgão julgador', 'juizo',
        'juízo', 'vara criminal', 'unidade',
    ],
    observacoes: [
        'obs', 'obs.', 'observacao', 'observação', 'observacoes', 'observações',
        'anotacoes', 'anotações', 'comentario', 'comentário', 'notas',
    ],
};

/** Cabeçalhos que só podem ser índice/numeração e devem ser ignorados. */
const IGNORED_HEADERS = new Set(['', '#', 'n', 'no', 'nº', 'num', 'item', 'ordem', 'seq']);

/**
 * Monta o mapa {cabeçalho original -> chave interna} para uma planilha.
 * Colunas não reconhecidas ficam disponíveis para casar com as COLUNAS
 * PERSONALIZADAS do órgão (pelo rótulo ou pela chave).
 */
function mapColumns(
    headers: string[],
    settings: JurimetriaSettings
): Record<string, string> {
    const map: Record<string, string> = {};
    const used = new Set<string>();

    for (const header of headers) {
        const norm = normalizeText(header);
        if (IGNORED_HEADERS.has(norm)) continue;

        let target = '';
        for (const [key, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
            if (used.has(key)) continue;
            if (synonyms.includes(norm) || normalizeText(key) === norm) {
                target = key;
                break;
            }
        }

        if (!target) {
            for (const field of settings.customFields) {
                if (used.has(field.key)) continue;
                if (normalizeText(field.label) === norm || normalizeText(field.key) === norm) {
                    target = field.key;
                    break;
                }
            }
        }

        if (target) {
            map[header] = target;
            used.add(target);
        }
    }

    return map;
}

/** Extrai as linhas de todas as abas da planilha, com os cabeçalhos originais. */
function readWorkbookRows(buffer: Buffer): Array<Record<string, unknown>> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const all: Array<Record<string, unknown>> = [];
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        for (const row of rows) all.push(row);
    }
    return all;
}

function isBlankRow(row: Record<string, unknown>): boolean {
    return Object.values(row).every((v) => String(v ?? '').trim() === '');
}

export const importJurisFromExcel = onCall<ImportJurisRequest>(
    {
        region: 'southamerica-east1',
        memory: '1GiB',
        timeoutSeconds: 540,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
        }

        const {
            organizationId,
            fileData,
            fileName,
            mode = 'preview',
            policy,
        } = request.data || ({} as ImportJurisRequest);

        if (!organizationId || !fileData) {
            throw new HttpsError('invalid-argument', 'organizationId e fileData são obrigatórios');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        const membershipSnap = await db
            .collection('userOrganizations')
            .doc(`${userId}_${organizationId}`)
            .get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Você não é membro desta organização');
        }

        const orgSnap = await db.collection('organizations').doc(organizationId).get();
        if (!orgSnap.exists) {
            throw new HttpsError('not-found', 'Organização não encontrada');
        }
        const settings = resolveJurimetriaSettings(orgSnap.data());
        const effectivePolicy: 'preserve' | 'update' =
            policy === 'update' || policy === 'preserve' ? policy : settings.importPolicy;

        // 1. Leitura do arquivo -----------------------------------------------
        const buffer = Buffer.from(fileData, 'base64');
        let rawRows: Array<Record<string, unknown>> = [];
        try {
            // JSON primeiro (é o formato que o cliente usa para enviar tabelas
            // já extraídas de documentos .docx).
            const parsed = JSON.parse(buffer.toString('utf-8'));
            rawRows = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            try {
                rawRows = readWorkbookRows(buffer);
            } catch {
                throw new HttpsError(
                    'invalid-argument',
                    'Não foi possível ler o arquivo. Use Excel (.xlsx, .xls), CSV ou JSON.'
                );
            }
        }

        rawRows = rawRows.filter((r) => r && typeof r === 'object' && !isBlankRow(r));

        if (rawRows.length === 0) {
            return {
                success: true,
                mode,
                total: 0,
                counts: {
                    novo: 0, sem_mudanca: 0, atualizacao: 0, conflito: 0, invalido: 0,
                },
                message: 'Arquivo vazio — nenhum júri encontrado.',
                samples: {
                    novo: [], sem_mudanca: [], atualizacao: [], conflito: [], invalido: [],
                },
                corrections: [],
                unmappedHeaders: [],
            };
        }
        if (rawRows.length > MAX_ROWS) {
            throw new HttpsError(
                'invalid-argument',
                `Arquivo muito grande (${rawRows.length} linhas). Máximo: ${MAX_ROWS}.`
            );
        }

        // 2. Mapeamento de colunas --------------------------------------------
        const headers = [...new Set(rawRows.flatMap((r) => Object.keys(r)))];
        const columnMap = mapColumns(headers, settings);
        const unmappedHeaders = headers.filter(
            (h) => !columnMap[h] && !IGNORED_HEADERS.has(normalizeText(h))
        );

        if (!Object.values(columnMap).includes('numero_processo')) {
            throw new HttpsError(
                'invalid-argument',
                'Não foi encontrada uma coluna com o número do processo (CNJ). '
                + `Cabeçalhos lidos: ${headers.slice(0, 15).join(', ')}`
            );
        }

        // 3. Análise linha a linha --------------------------------------------
        const parsed: ParsedRow[] = [];
        const corrections: Correction[] = [];
        const seenInFile = new Map<string, number>();
        const threshold = settings.fuzzyThreshold;

        const noteCorrection = (rowNum: number, field: string, from: string, to: string) => {
            if (!from || from === to) return;
            if (corrections.length >= 500) return;
            corrections.push({ row: rowNum, field, from, to });
        };

        rawRows.forEach((raw, index) => {
            const rowNum = index + 2; // linha 1 é o cabeçalho
            const pick = (key: string): unknown => {
                for (const [header, target] of Object.entries(columnMap)) {
                    if (target === key && raw[header] !== undefined) return raw[header];
                }
                return '';
            };

            const numeroOriginal = String(pick('numero_processo') ?? '').trim();
            const numeroNorm = normalizeProcessNumber(numeroOriginal);

            if (!numeroOriginal) {
                parsed.push({
                    row: rowNum, status: 'invalido', numero_processo: '', numero_processo_norm: '',
                    core: {}, values: {}, error: 'Número do processo (CNJ) vazio',
                });
                return;
            }
            if (!numeroNorm) {
                parsed.push({
                    row: rowNum, status: 'invalido', numero_processo: numeroOriginal,
                    numero_processo_norm: '', core: {}, values: {},
                    error: 'Número do processo sem nenhum dígito',
                });
                return;
            }
            if (seenInFile.has(numeroNorm)) {
                parsed.push({
                    row: rowNum, status: 'invalido', numero_processo: numeroOriginal,
                    numero_processo_norm: numeroNorm, core: {}, values: {},
                    error: `Número repetido no próprio arquivo (já apareceu na linha ${seenInFile.get(numeroNorm)})`,
                });
                return;
            }
            seenInFile.set(numeroNorm, rowNum);

            const dataOriginal = pick('data_juri');
            const dataJuri = parseJuriDate(dataOriginal);
            // Um júri cancelado não tem data — exigi-la rejeitaria linhas
            // legítimas. Nos demais casos a data continua obrigatória.
            const realizacaoBruta = normalizeRealizacao(pick('realizacao'));
            if (!dataJuri && realizacaoBruta !== 'cancelado') {
                parsed.push({
                    row: rowNum, status: 'invalido', numero_processo: numeroOriginal,
                    numero_processo_norm: numeroNorm, core: {}, values: {},
                    error: String(dataOriginal ?? '').trim()
                        ? `Data inválida: "${String(dataOriginal).trim()}"`
                        : 'Data do júri vazia',
                });
                return;
            }

            // Realização: coluna opcional. Ausente ou irreconhecível vira
            // "realizado", que é o que a base sempre significou até aqui.
            const realizacaoOriginal = String(pick('realizacao') ?? '').trim();
            const realizacao = realizacaoBruta;
            if (realizacaoOriginal && normalizeText(realizacaoOriginal) !== realizacao) {
                noteCorrection(rowNum, 'Realização', realizacaoOriginal, realizacao);
            }

            const comarcaOriginal = String(pick('comarca') ?? '').trim();
            const comarcaMatch = fuzzyMatchFromList(comarcaOriginal, settings.comarcas, threshold);
            if (comarcaMatch.matched) noteCorrection(rowNum, 'Comarca', comarcaOriginal, comarcaMatch.value);

            const tipoOriginal = String(pick('tipo') ?? '').trim();
            const tipoMatch = normalizeTipo(tipoOriginal, settings.tipos, threshold);
            if (tipoMatch.matched) noteCorrection(rowNum, 'Matéria / Tipo', tipoOriginal, tipoMatch.value);

            const resultadoOriginal = String(pick('resultado') ?? '').trim();
            const resultadoMatch = normalizeResultado(resultadoOriginal, settings.resultados, threshold);
            if (resultadoMatch.matched) noteCorrection(rowNum, 'Espécie', resultadoOriginal, resultadoMatch.value);

            const core: Record<string, string> = {
                numero_processo: numeroOriginal.slice(0, 60),
                data_juri: dataJuri || '',
                realizacao,
                realizacao_justificativa: '',
                comarca: comarcaMatch.value.slice(0, 160),
                tipo: tipoMatch.value.slice(0, 40),
                resultado: resultadoMatch.value.slice(0, 80),
                promotor: String(pick('promotor') ?? '').trim().slice(0, 160),
                horario: normalizeHorario(pick('horario')),
                vara: String(pick('vara') ?? '').trim().slice(0, 160),
                observacoes: String(pick('observacoes') ?? '').trim().slice(0, 2000),
            };

            // Colunas personalizadas do órgão presentes na planilha.
            const values: Record<string, unknown> = {};
            for (const field of settings.customFields) {
                const rawValue = pick(field.key);
                if (rawValue === '' || rawValue === null || rawValue === undefined) {
                    values[field.key] = field.type === 'boolean' ? false : '';
                    continue;
                }
                switch (field.type) {
                    case 'number': {
                        const n = Number(String(rawValue).replace(/\./g, '').replace(',', '.'));
                        values[field.key] = Number.isFinite(n) ? n : null;
                        break;
                    }
                    case 'boolean': {
                        const s = normalizeText(rawValue);
                        values[field.key] = rawValue === true || ['sim', 'true', '1', 'yes', 'x'].includes(s);
                        break;
                    }
                    case 'date':
                        values[field.key] = parseJuriDate(rawValue) || '';
                        break;
                    case 'select': {
                        const m = fuzzyMatchFromList(rawValue, field.options, threshold);
                        if (m.matched) noteCorrection(rowNum, field.label, String(rawValue).trim(), m.value);
                        values[field.key] = m.value.slice(0, 160);
                        break;
                    }
                    default:
                        values[field.key] = String(rawValue).trim().slice(0, 2000);
                }
            }

            parsed.push({
                row: rowNum, status: 'novo', numero_processo: core.numero_processo,
                numero_processo_norm: numeroNorm, core, values,
            });
        });

        // 4. Confronto com o banco --------------------------------------------
        const candidates = parsed.filter((p) => p.status !== 'invalido');
        const existingByNorm = new Map<string, { id: string; data: Record<string, unknown> }>();

        for (let i = 0; i < candidates.length; i += LOOKUP_CHUNK) {
            const chunk = candidates.slice(i, i + LOOKUP_CHUNK);
            const keys = [...new Set(chunk.map((c) => c.numero_processo_norm))];
            if (keys.length === 0) continue;
            const snap = await db
                .collection('juris')
                .where('organization_id', '==', organizationId)
                .where('numero_processo_norm', 'in', keys)
                .get();
            snap.docs.forEach((d) => {
                const data = d.data() || {};
                existingByNorm.set(String(data.numero_processo_norm || ''), { id: d.id, data });
            });
        }

        for (const item of candidates) {
            const existing = existingByNorm.get(item.numero_processo_norm);
            if (!existing) continue;

            // Duas situações MUITO diferentes se escondem em "o processo já
            // existe", e tratá-las igual é o que fazia uma reimportação mais
            // completa parecer um monte de conflito:
            //
            //   fills → o campo está VAZIO no banco e a planilha traz valor.
            //           É ganho puro de informação: nada se perde ao aplicar.
            //   diffs → o campo TEM valor no banco e a planilha traz outro.
            //           Aí sim é divergência, e quem decide é a política do órgão.
            const diffs: Array<{ field: string; current: string; incoming: string }> = [];
            const fills: Array<{ field: string; current: string; incoming: string }> = [];

            const classify = (field: string, current: string, incoming: string) => {
                // Célula vazia na planilha nunca apaga o que já está gravado.
                if (!incoming) return;
                if (!current) fills.push({ field, current, incoming });
                else if (current !== incoming) diffs.push({ field, current, incoming });
            };

            for (const field of JURI_COMPARABLE_FIELDS) {
                // `realizacao` ausente no banco significa "realizado" (registros
                // anteriores ao campo). Comparar contra '' marcaria toda a base
                // antiga como preenchível, gerando ruído sem informação nova.
                const raw = existing.data[field];
                const current = field === 'realizacao'
                    ? String(raw ?? 'realizado').trim()
                    : String(raw ?? '').trim();
                classify(field, current, String(item.core[field] ?? '').trim());
            }
            for (const field of settings.customFields) {
                classify(
                    field.key,
                    String((existing.data.values as any)?.[field.key] ?? '').trim(),
                    String(item.values[field.key] ?? '').trim()
                );
            }

            item.existingId = existing.id;
            item.currentDate = String(existing.data.data_juri ?? '').trim();
            if (diffs.length > 0) {
                item.status = 'conflito';
                item.diffs = diffs.slice(0, 12);
                // Um conflito pode trazer lacunas junto; elas são aplicadas
                // quando a linha for gravada.
                if (fills.length > 0) item.fills = fills.slice(0, 12);
            } else if (fills.length > 0) {
                item.status = 'atualizacao';
                item.fills = fills.slice(0, 12);
            } else {
                item.status = 'sem_mudanca';
            }
        }

        const counts = {
            novo: parsed.filter((p) => p.status === 'novo').length,
            sem_mudanca: parsed.filter((p) => p.status === 'sem_mudanca').length,
            atualizacao: parsed.filter((p) => p.status === 'atualizacao').length,
            conflito: parsed.filter((p) => p.status === 'conflito').length,
            invalido: parsed.filter((p) => p.status === 'invalido').length,
        };

        const sampleOf = (status: RowStatus) =>
            parsed
                .filter((p) => p.status === status)
                .slice(0, SAMPLE_LIMIT)
                .map((p) => ({
                    row: p.row,
                    numero_processo: p.numero_processo,
                    data_juri: p.core.data_juri || '',
                    comarca: p.core.comarca || '',
                    tipo: p.core.tipo || '',
                    resultado: p.core.resultado || '',
                    promotor: p.core.promotor || '',
                    realizacao: p.core.realizacao || '',
                    diffs: p.diffs || [],
                    fills: p.fills || [],
                    error: p.error || '',
                }));

        const report = {
            success: true,
            mode,
            fileName: String(fileName || '').slice(0, 200),
            policy: effectivePolicy,
            total: rawRows.length,
            counts,
            samples: {
                novo: sampleOf('novo'),
                sem_mudanca: sampleOf('sem_mudanca'),
                atualizacao: sampleOf('atualizacao'),
                conflito: sampleOf('conflito'),
                invalido: sampleOf('invalido'),
            },
            corrections: corrections.slice(0, 200),
            correctionsTotal: corrections.length,
            unmappedHeaders: unmappedHeaders.slice(0, 30),
            mappedColumns: columnMap,
        };

        if (mode !== 'commit') {
            return report;
        }

        // 5. Gravação ----------------------------------------------------------
        const now = new Date();
        const logDate = now.toISOString().split('T')[0];
        const logTime = now.toTimeString().split(' ')[0];
        const userName = request.auth.token.name || 'Usuário desconhecido';
        const sourceLabel = String(fileName || 'planilha').slice(0, 200);

        const createEntry = {
            date: logDate, time: logTime, user_id: userId, user_name: userName,
            action: `Júri importado de "${sourceLabel}"`, timestamp: now.toISOString(),
        };
        const logEntryFor = (action: string) => ({
            date: logDate, time: logTime, user_id: userId, user_name: userName,
            action, timestamp: now.toISOString(),
        });

        const toCreate = parsed.filter((p) => p.status === 'novo');
        // Enriquecimento (preencher campos VAZIOS) é sempre aplicado: não
        // sobrescreve nada e a alternativa seria descartar informação que a
        // planilha tem e o banco não. Já SOBRESCREVER valor existente continua
        // dependendo da política do órgão.
        const toEnrich = parsed.filter((p) => p.status === 'atualizacao');
        const toOverwrite = effectivePolicy === 'update'
            ? parsed.filter((p) => p.status === 'conflito')
            : [];
        const toUpdate = [...toEnrich, ...toOverwrite];

        let created = 0;
        let updated = 0;
        let enriched = 0;
        const historyTargets: Array<{
            ref: FirebaseFirestore.DocumentReference;
            entry: ReturnType<typeof logEntryFor>;
        }> = [];

        let batch = db.batch();
        let opCount = 0;

        const flush = async () => {
            if (opCount === 0) return;
            await batch.commit();
            batch = db.batch();
            opCount = 0;
        };

        for (const item of toCreate) {
            const ref = db.collection('juris').doc();
            batch.set(ref, {
                id: ref.id,
                organization_id: organizationId,
                ...item.core,
                numero_processo_norm: item.numero_processo_norm,
                values: item.values,
                responsible_user_id: null,
                responsible_user_name: null,
                source: 'import',
                imported_from: sourceLabel,
                created_by: userId,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_by: userId,
                activity_log: [createEntry],
            });
            historyTargets.push({ ref, entry: createEntry });
            created += 1;
            opCount += 1;
            if (opCount >= WRITE_BATCH) await flush();
        }

        for (const item of toUpdate) {
            if (!item.existingId) continue;
            const ref = db.collection('juris').doc(item.existingId);

            // Um conflito aplicado também aproveita as lacunas da mesma linha.
            const aplicados = item.status === 'conflito'
                ? [...(item.diffs || []), ...(item.fills || [])]
                : (item.fills || []);
            if (aplicados.length === 0) continue;

            const rotulos = aplicados.map((d) => FIELD_LABELS[d.field] || d.field);
            const acao = item.status === 'atualizacao'
                ? `Dados complementados pela importação de "${sourceLabel}": ${rotulos.join(', ')}`
                : `Dados atualizados pela importação de "${sourceLabel}": ${rotulos.join(', ')}`;
            const entry = logEntryFor(acao);

            const update: Record<string, unknown> = {
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_by: userId,
                imported_from: sourceLabel,
                activity_log: admin.firestore.FieldValue.arrayUnion(entry),
            };

            for (const campo of aplicados) {
                if (JURI_COMPARABLE_FIELDS.includes(campo.field)) {
                    update[campo.field] = item.core[campo.field];
                } else {
                    update[`values.${campo.field}`] = item.values[campo.field];
                }
            }

            // Mudança de data pela importação também entra no histórico de
            // datas — a promessa é que nenhuma data se perca, venha ela do
            // formulário ou de uma planilha.
            const novaData = aplicados.find((d) => d.field === 'data_juri');
            if (novaData) {
                update.date_history = admin.firestore.FieldValue.arrayUnion({
                    from: item.currentDate || '',
                    to: item.core.data_juri || '',
                    realizacao: item.core.realizacao || 'realizado',
                    justificativa: `Importação de "${sourceLabel}"`,
                    changed_at: now.toISOString(),
                    user_id: userId,
                    user_name: userName,
                });
            }

            batch.update(ref, update);
            historyTargets.push({ ref, entry });
            updated += 1;
            if (item.status === 'atualizacao') enriched += 1;
            opCount += 1;
            if (opCount >= WRITE_BATCH) await flush();
        }

        await flush();

        // Espelho do histórico (best-effort — nunca falha a importação).
        try {
            for (let i = 0; i < historyTargets.length; i += WRITE_BATCH) {
                const histBatch = db.batch();
                for (const target of historyTargets.slice(i, i + WRITE_BATCH)) {
                    histBatch.set(
                        target.ref.collection('history').doc(historyEntryId(target.entry)),
                        { ...target.entry, created_at: admin.firestore.FieldValue.serverTimestamp() }
                    );
                }
                await histBatch.commit();
            }
        } catch (histErr) {
            console.error('[history dual-write] juris import', histErr);
        }

        if (created > 0) {
            await db.collection('organizations').doc(organizationId).update({
                'stats.juris_count': admin.firestore.FieldValue.increment(created),
            });
        }

        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: userName,
            action: 'IMPORT_JURIS',
            details: {
                file: sourceLabel,
                policy: effectivePolicy,
                created,
                updated,
                enriched,
                unchanged: counts.sem_mudanca,
                conflicts: counts.conflito,
                invalid: counts.invalido,
                total: rawRows.length,
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { ...report, created, updated, enriched };
    }
);
