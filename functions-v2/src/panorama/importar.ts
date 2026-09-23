import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as XLSX from 'xlsx';
import {
    sanitizeBaseDef,
    analyzeColumn,
    inferColumnType,
    suggestRole,
    slugColumnKey,
    normalizeIdentifier,
    normalizeText,
    coerceValue,
    columnForRole,
    fuzzyMatchFromList,
    PanoramaBaseDef,
    PanoramaColumn,
    PanoramaRole,
} from '../shared/panorama';

/**
 * Importação de planilha no Panorama — é aqui que o módulo se torna "coringa".
 *
 * A Jurimetria sabia de antemão quais colunas procurar. Aqui a planilha é que
 * DEFINE as colunas: o preview lê o arquivo, mede cada coluna (tipo,
 * cardinalidade, vazios, amostra), propõe um papel para cada uma e devolve
 * tudo para o usuário confirmar. Só depois disso os dados entram.
 *
 * Duas etapas, sempre:
 *   1. `preview` — lê, mede, propõe e classifica. Nada é gravado.
 *   2. `commit`  — grava o que foi aprovado, com as colunas e papéis que o
 *                  usuário confirmou na etapa anterior.
 *
 * O commit aceita a definição de colunas vinda do cliente porque foi o usuário
 * quem a revisou na tela — mas ela passa por `sanitizeBaseDef` antes de
 * qualquer gravação, e os VALORES são sempre normalizados pelo tipo da coluna.
 */

const MAX_ROWS = 20000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SAMPLE_LIMIT = 40;
/** Linhas usadas para medir as colunas. Medir 20 mil para inferir tipo é
 *  desperdício: 2 mil já estabilizam a estatística. */
const AMOSTRA_INFERENCIA = 2000;

interface ImportRequest {
    organizationId: string;
    /** Base existente. Vazio no preview de uma base NOVA. */
    baseId?: string;
    fileData: string;
    fileName?: string;
    mode?: 'preview' | 'commit';
    /** No commit: as colunas e papéis confirmados pelo usuário. */
    columns?: unknown;
    /** No commit de uma base nova: o nome dela. */
    baseNome?: string;
    policy?: 'preserve' | 'update';
}

type RowStatus = 'novo' | 'sem_mudanca' | 'atualizacao' | 'conflito' | 'invalido';

interface ParsedRow {
    row: number;
    chave: string;
    values: Record<string, string | number | boolean | null>;
    status: RowStatus;
    error?: string;
    existingId?: string;
    diffs?: Array<{ key: string; field: string; current: string; incoming: string }>;
    fills?: Array<{ key: string; field: string; current: string; incoming: string }>;
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

/**
 * Lê o arquivo (planilha, CSV ou JSON) e devolve as linhas brutas.
 * O .docx não entra aqui: no Panorama a origem é sempre tabular.
 */
function parseFile(fileData: string, fileName: string): Array<Record<string, unknown>> {
    const base64 = String(fileData || '').replace(/^data:[^;]+;base64,/, '');
    if (!base64) throw new HttpsError('invalid-argument', 'Arquivo vazio');

    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_FILE_BYTES) {
        throw new HttpsError('invalid-argument', 'Arquivo maior que 10 MB');
    }

    let rows: Array<Record<string, unknown>> = [];
    if (/\.json$/i.test(fileName)) {
        try {
            const parsed = JSON.parse(buffer.toString('utf8'));
            rows = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            throw new HttpsError('invalid-argument', 'JSON inválido');
        }
    } else {
        try {
            rows = readWorkbookRows(buffer);
        } catch (err) {
            throw new HttpsError(
                'invalid-argument',
                `Não foi possível ler o arquivo: ${(err as Error).message}`
            );
        }
    }

    return rows.filter((r) => r && typeof r === 'object' && !isBlankRow(r));
}

export interface ColunaDetectada extends PanoramaColumn {
    /** Papel proposto pela plataforma (o usuário confirma ou troca). */
    papelSugerido: PanoramaRole | null;
    /** Por que a plataforma propôs aquele papel, em português. */
    motivoSugestao: string;
    confiancaSugestao: number;
}

/**
 * Mede cada coluna da planilha e propõe um esquema.
 *
 * Quando a base JÁ existe, as colunas conhecidas mantêm a chave, o rótulo e o
 * papel que o admin configurou — a planilha não reescreve a configuração do
 * órgão. Colunas novas entram como acréscimo, para que acrescentar uma coluna
 * na planilha de origem não quebre a base nem exija reconfigurar tudo.
 */
function detectarColunas(
    linhas: Array<Record<string, unknown>>,
    baseExistente: PanoramaBaseDef | null
): ColunaDetectada[] {
    const cabecalhos = [...new Set(linhas.flatMap((r) => Object.keys(r)))]
        .filter((h) => String(h || '').trim() !== '');
    const amostra = linhas.slice(0, AMOSTRA_INFERENCIA);

    // Casamento com as colunas já configuradas: primeiro pela origem gravada,
    // depois pelo rótulo normalizado. É o que permite reimportar a mesma
    // planilha depois de o admin ter renomeado uma coluna na plataforma.
    const porOrigem = new Map<string, PanoramaColumn>();
    const porRotulo = new Map<string, PanoramaColumn>();
    for (const col of baseExistente?.columns || []) {
        if (col.origem) porOrigem.set(normalizeText(col.origem), col);
        porRotulo.set(normalizeText(col.label), col);
    }

    const chaves = new Set<string>((baseExistente?.columns || []).map((c) => c.key));
    const out: ColunaDetectada[] = [];

    for (const cabecalho of cabecalhos) {
        const valores = amostra.map((l) => l[cabecalho]);
        const stats = analyzeColumn(valores);
        const tipoInferido = inferColumnType(stats);

        const conhecida = porOrigem.get(normalizeText(cabecalho))
            || porRotulo.get(normalizeText(cabecalho));
        const sugestao = suggestRole(cabecalho, tipoInferido, stats);

        if (conhecida) {
            out.push({
                ...conhecida,
                // Estatística é sempre a da planilha atual; configuração é sempre
                // a do órgão.
                cardinalidade: stats.distintos,
                amostra: stats.amostra,
                vazios: stats.vazios,
                lista: conhecida.type === 'lista'
                    ? [...new Set([...(conhecida.lista || []), ...stats.valores])].sort(
                        (a, b) => a.localeCompare(b, 'pt-BR')
                    )
                    : conhecida.lista,
                origem: cabecalho,
                papelSugerido: conhecida.role,
                motivoSugestao: 'coluna já configurada nesta base',
                confiancaSugestao: 1,
            });
            continue;
        }

        const key = slugColumnKey(cabecalho, chaves);
        chaves.add(key);
        out.push({
            key,
            label: String(cabecalho).trim().slice(0, 120),
            type: tipoInferido,
            role: sugestao?.role ?? null,
            lista: tipoInferido === 'lista' ? stats.valores : undefined,
            cardinalidade: stats.distintos,
            amostra: stats.amostra,
            vazios: stats.vazios,
            visivel: true,
            ordem: out.length,
            origem: cabecalho,
            papelSugerido: sugestao?.role ?? null,
            motivoSugestao: sugestao?.motivo || 'nenhum papel evidente — a coluna entra como informativa',
            confiancaSugestao: sugestao?.confianca ?? 0,
        });
    }

    // Papel único: se duas colunas foram propostas para o mesmo papel, só a de
    // maior confiança fica com ele. As demais entram sem papel, e o usuário
    // decide na tela.
    const ocupados = new Map<PanoramaRole, ColunaDetectada>();
    for (const col of out) {
        if (!col.role) continue;
        const atual = ocupados.get(col.role);
        if (!atual) { ocupados.set(col.role, col); continue; }
        const perdedora = col.confiancaSugestao > atual.confiancaSugestao ? atual : col;
        const vencedora = perdedora === atual ? col : atual;
        ocupados.set(col.role, vencedora);
        perdedora.role = null;
        perdedora.motivoSugestao = `"${vencedora.label}" ficou com este papel por ter correspondência mais forte`;
    }

    return out;
}

export const importPanorama = onCall<ImportRequest>(
    { region: 'southamerica-east1', memory: '1GiB', timeoutSeconds: 540 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
        }

        const payload = request.data || ({} as ImportRequest);
        const { organizationId, baseId, mode = 'preview' } = payload;
        if (!organizationId) throw new HttpsError('invalid-argument', 'organizationId é obrigatório');

        const db = admin.firestore();
        const userId = request.auth.uid;

        const membershipSnap = await db
            .collection('userOrganizations')
            .doc(`${userId}_${organizationId}`)
            .get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Você não é membro desta organização');
        }
        const membership = membershipSnap.data() || {};
        const permissions = (membership.permissions && typeof membership.permissions === 'object')
            ? membership.permissions as Record<string, unknown>
            : {};
        const podeConfigurar = membership.role === 'creator' || permissions.configure_panorama === true;
        const userName = request.auth.token.name || String(membership.user_name || 'Usuário desconhecido');

        // ---- Base existente (ou ausente, no caso de uma base nova) ---------
        let baseDef: PanoramaBaseDef | null = null;
        if (baseId) {
            const snap = await db.collection('panoramaBases').doc(baseId).get();
            if (!snap.exists) throw new HttpsError('not-found', 'Base não encontrada');
            const data = snap.data() || {};
            if (data.organization_id !== organizationId) {
                throw new HttpsError('not-found', 'Base não encontrada');
            }
            baseDef = sanitizeBaseDef(data);
        }

        const fileName = String(payload.fileName || '').slice(0, 200);
        const linhas = parseFile(payload.fileData, fileName);

        if (linhas.length === 0) {
            throw new HttpsError('invalid-argument', 'Arquivo vazio — nenhuma linha encontrada.');
        }
        if (linhas.length > MAX_ROWS) {
            throw new HttpsError(
                'invalid-argument',
                `Arquivo com ${linhas.length} linhas. O limite por importação é ${MAX_ROWS}. `
                + 'Divida a planilha em partes — cada parte importada acrescenta à mesma base.'
            );
        }

        // ---- Colunas -------------------------------------------------------
        // No preview, a plataforma DETECTA. No commit, vale o que o usuário
        // confirmou na tela (sanitizado), e a detecção serve só de fallback.
        const detectadas = detectarColunas(linhas, baseDef);
        const colunas: PanoramaColumn[] = mode === 'commit' && payload.columns
            ? sanitizeBaseDef({ nome: 'x', columns: payload.columns }).columns
            // No preview, a coluna efetiva é a detectada sem os campos de
            // sugestão, que existem só para a tela de mapeamento.
            : detectadas.map((d) => ({
                key: d.key, label: d.label, type: d.type, role: d.role,
                lista: d.lista, cardinalidade: d.cardinalidade, amostra: d.amostra,
                vazios: d.vazios, visivel: d.visivel, ordem: d.ordem, origem: d.origem,
            }));

        if (colunas.length === 0) {
            throw new HttpsError('invalid-argument', 'Nenhuma coluna reconhecida na planilha.');
        }

        const defEfetiva: PanoramaBaseDef = {
            ...(baseDef || sanitizeBaseDef({ nome: payload.baseNome || fileName || 'Nova base' })),
            columns: colunas,
        };
        const politica = payload.policy === 'update' || payload.policy === 'preserve'
            ? payload.policy
            : defEfetiva.importPolicy;

        const colId = columnForRole(defEfetiva, 'identificador');
        const colunasLista = colunas.filter((c) => c.type === 'lista' && (c.lista?.length || 0) > 0);

        // ---- Converte e normaliza cada linha -------------------------------
        const correcoes: Array<{ row: number; field: string; from: string; to: string }> = [];
        const parsed: ParsedRow[] = [];
        const chavesVistas = new Map<string, number>();

        linhas.forEach((linha, index) => {
            const values: Record<string, string | number | boolean | null> = {};
            for (const col of colunas) {
                const bruto = col.origem !== undefined ? linha[col.origem] : linha[col.label];
                let valor = coerceValue(bruto, col.type);

                // Correção automática contra a lista canônica da coluna: é o que
                // impede "PORTO ALEGRE", "Porto Alegre" e "P. Alegre" de virarem
                // três comarcas no relatório.
                if (col.type === 'lista' && typeof valor === 'string' && valor
                    && colunasLista.includes(col)) {
                    const match = fuzzyMatchFromList(valor, col.lista || [], defEfetiva.fuzzyThreshold);
                    if (match.corrected) {
                        if (correcoes.length < 200) {
                            correcoes.push({
                                row: index + 2, field: col.label,
                                from: match.original, to: match.value,
                            });
                        }
                        valor = match.value;
                    }
                }
                values[col.key] = valor;
            }

            const item: ParsedRow = {
                row: index + 2,
                chave: colId ? normalizeIdentifier(values[colId.key]) : '',
                values,
                status: 'novo',
            };

            if (colId && !item.chave) {
                item.status = 'invalido';
                item.error = `Sem "${colId.label}", que é o identificador desta base`;
            } else if (item.chave && chavesVistas.has(item.chave)) {
                item.status = 'invalido';
                item.error = `Identificador repetido na própria planilha (linha ${chavesVistas.get(item.chave)})`;
            } else if (Object.values(values).every((v) => v === null || v === '')) {
                item.status = 'invalido';
                item.error = 'Linha sem nenhum dado aproveitável';
            } else if (item.chave) {
                chavesVistas.set(item.chave, item.row);
            }

            parsed.push(item);
        });

        // ---- Confronta com o que já está no banco --------------------------
        if (baseId && colId) {
            const candidatos = parsed.filter((p) => p.status !== 'invalido' && p.chave);
            const existentes = new Map<string, { id: string; values: Record<string, unknown> }>();

            // `in` aceita no máximo 30 valores por consulta.
            for (let i = 0; i < candidatos.length; i += 30) {
                const chaves = candidatos.slice(i, i + 30).map((p) => p.chave);
                if (chaves.length === 0) continue;
                const snap = await db.collection('panoramaRegistros')
                    .where('organization_id', '==', organizationId)
                    .where('base_id', '==', baseId)
                    .where('chave_norm', 'in', chaves)
                    .get();
                snap.docs.forEach((d) => {
                    const data = d.data() || {};
                    existentes.set(String(data.chave_norm || ''), {
                        id: d.id,
                        values: (data.values || {}) as Record<string, unknown>,
                    });
                });
            }

            for (const item of candidatos) {
                const atual = existentes.get(item.chave);
                if (!atual) continue;

                // Duas situações muito diferentes se escondem em "já existe":
                //   fills → o campo está VAZIO no banco e a planilha traz valor.
                //           Ganho puro: aplica sob qualquer política.
                //   diffs → o campo TEM valor e a planilha traz outro.
                //           Divergência: quem decide é a política do órgão.
                const diffs: ParsedRow['diffs'] = [];
                const fills: ParsedRow['fills'] = [];
                for (const col of colunas) {
                    if (col.key === colId.key) continue;
                    const incoming = item.values[col.key];
                    // Célula vazia na planilha nunca apaga o que já está gravado.
                    if (incoming === null || incoming === '') continue;
                    const current = atual.values[col.key];
                    const currentStr = current === null || current === undefined ? '' : String(current);
                    const incomingStr = String(incoming);
                    if (!currentStr) {
                        fills.push({ key: col.key, field: col.label, current: '', incoming: incomingStr });
                    } else if (currentStr !== incomingStr) {
                        diffs.push({ key: col.key, field: col.label, current: currentStr, incoming: incomingStr });
                    }
                }

                item.existingId = atual.id;
                if (diffs.length > 0) {
                    item.status = 'conflito';
                    item.diffs = diffs.slice(0, 12);
                    if (fills.length > 0) item.fills = fills.slice(0, 12);
                } else if (fills.length > 0) {
                    item.status = 'atualizacao';
                    item.fills = fills.slice(0, 12);
                } else {
                    item.status = 'sem_mudanca';
                }
            }
        }

        const counts = {
            novo: parsed.filter((p) => p.status === 'novo').length,
            sem_mudanca: parsed.filter((p) => p.status === 'sem_mudanca').length,
            atualizacao: parsed.filter((p) => p.status === 'atualizacao').length,
            conflito: parsed.filter((p) => p.status === 'conflito').length,
            invalido: parsed.filter((p) => p.status === 'invalido').length,
        };

        const sampleOf = (status: RowStatus) => parsed
            .filter((p) => p.status === status)
            .slice(0, SAMPLE_LIMIT)
            .map((p) => ({
                row: p.row,
                chave: colId ? String(p.values[colId.key] ?? '') : '',
                resumo: colunas
                    .filter((c) => c.visivel && c.key !== colId?.key)
                    .slice(0, 4)
                    .map((c) => `${c.label}: ${p.values[c.key] ?? '—'}`)
                    .join(' · '),
                diffs: p.diffs || [],
                fills: p.fills || [],
                error: p.error || '',
            }));

        const report = {
            success: true,
            mode,
            fileName,
            baseId: baseId || '',
            total: linhas.length,
            policy: politica,
            counts,
            colunas: detectadas,
            samples: {
                novo: sampleOf('novo'),
                sem_mudanca: sampleOf('sem_mudanca'),
                atualizacao: sampleOf('atualizacao'),
                conflito: sampleOf('conflito'),
                invalido: sampleOf('invalido'),
            },
            corrections: correcoes.slice(0, 200),
            correctionsTotal: correcoes.length,
        };

        if (mode === 'preview') return report;

        // ---- Commit ---------------------------------------------------------
        if (!podeConfigurar && !baseId) {
            throw new HttpsError(
                'permission-denied',
                'É preciso a permissão "Configurar Panorama" para criar uma base'
            );
        }

        // Base nova: cria agora, com as colunas confirmadas na tela.
        let alvoBaseId = baseId || '';
        if (!alvoBaseId) {
            const novaDef = sanitizeBaseDef({
                nome: payload.baseNome || fileName.replace(/\.[^.]+$/, '') || 'Nova base',
                columns: colunas,
            });
            const doc = await db.collection('panoramaBases').add({
                organization_id: organizationId,
                ...novaDef,
                created_by: userId,
                created_by_name: userName,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_by: userId,
                updated_by_name: userName,
                activity_log: [{
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toTimeString().split(' ')[0],
                    user_id: userId,
                    user_name: userName,
                    action: `Base criada pela importação de ${fileName || 'uma planilha'}`,
                    timestamp: new Date().toISOString(),
                }],
            });
            alvoBaseId = doc.id;
        } else if (podeConfigurar) {
            // Base existente. Duas coisas precisam ser gravadas, não uma:
            //
            //   1. as colunas NOVAS que apareceram na planilha;
            //   2. o que o usuário AJUSTOU na tela de mapeamento para colunas
            //      que a base já conhecia.
            //
            // O item 2 era o que faltava: o ajuste valia para a conversão desta
            // importação e não era persistido, de modo que a base ficava com
            // valores convertidos segundo um tipo que a própria definição dela
            // contradizia. Colunas da base que não vieram nesta planilha são
            // preservadas como estavam — a planilha pode ser um recorte.
            const confirmadas = new Map(colunas.map((c) => [c.key, c]));
            const antigas = baseDef?.columns || [];
            const mescladas = antigas.map((c) => {
                const nova = confirmadas.get(c.key);
                if (!nova) return c;
                return {
                    ...c,
                    label: nova.label,
                    type: nova.type,
                    role: nova.role,
                    lista: nova.lista ?? c.lista,
                    cardinalidade: nova.cardinalidade ?? c.cardinalidade,
                    amostra: nova.amostra ?? c.amostra,
                    vazios: nova.vazios ?? c.vazios,
                    visivel: nova.visivel,
                    origem: nova.origem ?? c.origem,
                };
            });
            const conhecidas = new Set(antigas.map((c) => c.key));
            const novas = colunas.filter((c) => !conhecidas.has(c.key));
            const merged = sanitizeBaseDef({ ...baseDef, columns: [...mescladas, ...novas] });

            const mudou = JSON.stringify(merged.columns) !== JSON.stringify(antigas);
            if (mudou) {
                await db.collection('panoramaBases').doc(alvoBaseId).update({
                    columns: merged.columns,
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_by: userId,
                });
            }
        }

        const now = new Date();
        const logBase = {
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().split(' ')[0],
            user_id: userId,
            user_name: userName,
            timestamp: now.toISOString(),
        };

        const aCriar = parsed.filter((p) => p.status === 'novo');
        const aEnriquecer = parsed.filter((p) => p.status === 'atualizacao');
        const aSobrescrever = politica === 'update'
            ? parsed.filter((p) => p.status === 'conflito')
            : [];

        let criados = 0;
        let enriquecidos = 0;
        let atualizados = 0;

        // Criação
        for (let i = 0; i < aCriar.length; i += 200) {
            const chunk = aCriar.slice(i, i + 200);
            const batch = db.batch();
            for (const item of chunk) {
                batch.set(db.collection('panoramaRegistros').doc(), {
                    organization_id: organizationId,
                    base_id: alvoBaseId,
                    chave_norm: item.chave,
                    values: item.values,
                    source: 'import',
                    imported_from: fileName,
                    created_by: userId,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_by: userId,
                    activity_log: [{
                        ...logBase,
                        action: `Importado de ${fileName || 'planilha'}`,
                    }],
                });
                criados += 1;
            }
            await batch.commit();
        }

        // Enriquecimento e sobrescrita
        const aAtualizar = [...aEnriquecer, ...aSobrescrever];
        for (let i = 0; i < aAtualizar.length; i += 200) {
            const chunk = aAtualizar.slice(i, i + 200);
            const batch = db.batch();
            for (const item of chunk) {
                if (!item.existingId) continue;
                // Enriquecimento aplica só as lacunas; sobrescrita aplica tudo.
                const campos = item.status === 'atualizacao'
                    ? (item.fills || [])
                    : [...(item.diffs || []), ...(item.fills || [])];
                const patch: Record<string, unknown> = {};
                for (const c of campos) {
                    // Pela CHAVE, nunca pelo rótulo: dois rótulos iguais em
                    // colunas diferentes fariam o patch escrever no campo errado.
                    const col = colunas.find((x) => x.key === c.key);
                    if (col) patch[`values.${col.key}`] = item.values[col.key];
                }
                if (Object.keys(patch).length === 0) continue;

                const rotulos = campos.map((c) => c.field);
                batch.update(db.collection('panoramaRegistros').doc(item.existingId), {
                    ...patch,
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_by: userId,
                    activity_log: admin.firestore.FieldValue.arrayUnion({
                        ...logBase,
                        action: item.status === 'atualizacao'
                            ? `Complementado pela importação de ${fileName}: ${rotulos.join(', ')}`
                            : `Atualizado pela importação de ${fileName}: ${rotulos.join(', ')}`,
                    }),
                });
                if (item.status === 'atualizacao') enriquecidos += 1; else atualizados += 1;
            }
            await batch.commit();
        }

        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: userName,
            action: 'IMPORT_PANORAMA',
            details: {
                base_id: alvoBaseId,
                arquivo: fileName,
                criados,
                enriquecidos,
                atualizados,
                sem_mudanca: counts.sem_mudanca,
                invalidos: counts.invalido,
                politica,
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { ...report, baseId: alvoBaseId, criados, enriquecidos, atualizados };
    }
);
