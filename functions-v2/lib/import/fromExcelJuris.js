"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importJurisFromExcel = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const XLSX = require("xlsx");
const history_1 = require("../shared/history");
const jurimetria_1 = require("../shared/jurimetria");
const MAX_ROWS = 20000;
const SAMPLE_LIMIT = 300;
const LOOKUP_CHUNK = 30;
const WRITE_BATCH = 400;
// ----------------------------------------------------------------------------
// Mapeamento flexível de colunas
// ----------------------------------------------------------------------------
// Cada campo aceita várias grafias de cabeçalho. A comparação é feita sobre o
// cabeçalho normalizado (minúsculo, sem acento, espaços colapsados).
const COLUMN_SYNONYMS = {
    numero_processo: [
        'cnj', 'numero cnj', 'n cnj', 'no cnj', 'nº cnj', 'processo', 'numero do processo',
        'numero processo', 'n processo', 'no processo', 'nº processo', 'num processo',
        'numero', 'autos', 'numero dos autos', 'process_number', 'numero_processo',
    ],
    data_juri: [
        'data', 'data do juri', 'data do júri', 'data juri', 'data da sessao',
        'data da sessão', 'data sessao', 'dt', 'data_juri', 'date',
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
function mapColumns(headers, settings) {
    const map = {};
    const used = new Set();
    for (const header of headers) {
        const norm = (0, jurimetria_1.normalizeText)(header);
        if (IGNORED_HEADERS.has(norm))
            continue;
        let target = '';
        for (const [key, synonyms] of Object.entries(COLUMN_SYNONYMS)) {
            if (used.has(key))
                continue;
            if (synonyms.includes(norm) || (0, jurimetria_1.normalizeText)(key) === norm) {
                target = key;
                break;
            }
        }
        if (!target) {
            for (const field of settings.customFields) {
                if (used.has(field.key))
                    continue;
                if ((0, jurimetria_1.normalizeText)(field.label) === norm || (0, jurimetria_1.normalizeText)(field.key) === norm) {
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
function readWorkbookRows(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const all = [];
    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet)
            continue;
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        for (const row of rows)
            all.push(row);
    }
    return all;
}
function isBlankRow(row) {
    return Object.values(row).every((v) => String(v !== null && v !== void 0 ? v : '').trim() === '');
}
exports.importJurisFromExcel = (0, https_1.onCall)({
    region: 'southamerica-east1',
    memory: '1GiB',
    timeoutSeconds: 540,
}, async (request) => {
    var _a, _b, _c, _d, _e;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }
    const { organizationId, fileData, fileName, mode = 'preview', policy, } = request.data || {};
    if (!organizationId || !fileData) {
        throw new https_1.HttpsError('invalid-argument', 'organizationId e fileData são obrigatórios');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    const membershipSnap = await db
        .collection('userOrganizations')
        .doc(`${userId}_${organizationId}`)
        .get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    const orgSnap = await db.collection('organizations').doc(organizationId).get();
    if (!orgSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Organização não encontrada');
    }
    const settings = (0, jurimetria_1.resolveJurimetriaSettings)(orgSnap.data());
    const effectivePolicy = policy === 'update' || policy === 'preserve' ? policy : settings.importPolicy;
    // 1. Leitura do arquivo -----------------------------------------------
    const buffer = Buffer.from(fileData, 'base64');
    let rawRows = [];
    try {
        // JSON primeiro (é o formato que o cliente usa para enviar tabelas
        // já extraídas de documentos .docx).
        const parsed = JSON.parse(buffer.toString('utf-8'));
        rawRows = Array.isArray(parsed) ? parsed : [parsed];
    }
    catch (_f) {
        try {
            rawRows = readWorkbookRows(buffer);
        }
        catch (_g) {
            throw new https_1.HttpsError('invalid-argument', 'Não foi possível ler o arquivo. Use Excel (.xlsx, .xls), CSV ou JSON.');
        }
    }
    rawRows = rawRows.filter((r) => r && typeof r === 'object' && !isBlankRow(r));
    if (rawRows.length === 0) {
        return {
            success: true,
            mode,
            total: 0,
            counts: { novo: 0, sem_mudanca: 0, conflito: 0, invalido: 0 },
            message: 'Arquivo vazio — nenhum júri encontrado.',
            samples: { novo: [], sem_mudanca: [], conflito: [], invalido: [] },
            corrections: [],
            unmappedHeaders: [],
        };
    }
    if (rawRows.length > MAX_ROWS) {
        throw new https_1.HttpsError('invalid-argument', `Arquivo muito grande (${rawRows.length} linhas). Máximo: ${MAX_ROWS}.`);
    }
    // 2. Mapeamento de colunas --------------------------------------------
    const headers = [...new Set(rawRows.flatMap((r) => Object.keys(r)))];
    const columnMap = mapColumns(headers, settings);
    const unmappedHeaders = headers.filter((h) => !columnMap[h] && !IGNORED_HEADERS.has((0, jurimetria_1.normalizeText)(h)));
    if (!Object.values(columnMap).includes('numero_processo')) {
        throw new https_1.HttpsError('invalid-argument', 'Não foi encontrada uma coluna com o número do processo (CNJ). '
            + `Cabeçalhos lidos: ${headers.slice(0, 15).join(', ')}`);
    }
    // 3. Análise linha a linha --------------------------------------------
    const parsed = [];
    const corrections = [];
    const seenInFile = new Map();
    const threshold = settings.fuzzyThreshold;
    const noteCorrection = (rowNum, field, from, to) => {
        if (!from || from === to)
            return;
        if (corrections.length >= 500)
            return;
        corrections.push({ row: rowNum, field, from, to });
    };
    rawRows.forEach((raw, index) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const rowNum = index + 2; // linha 1 é o cabeçalho
        const pick = (key) => {
            for (const [header, target] of Object.entries(columnMap)) {
                if (target === key && raw[header] !== undefined)
                    return raw[header];
            }
            return '';
        };
        const numeroOriginal = String((_a = pick('numero_processo')) !== null && _a !== void 0 ? _a : '').trim();
        const numeroNorm = (0, jurimetria_1.normalizeProcessNumber)(numeroOriginal);
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
        const dataJuri = (0, jurimetria_1.parseJuriDate)(dataOriginal);
        if (!dataJuri) {
            parsed.push({
                row: rowNum, status: 'invalido', numero_processo: numeroOriginal,
                numero_processo_norm: numeroNorm, core: {}, values: {},
                error: String(dataOriginal !== null && dataOriginal !== void 0 ? dataOriginal : '').trim()
                    ? `Data inválida: "${String(dataOriginal).trim()}"`
                    : 'Data do júri vazia',
            });
            return;
        }
        const comarcaOriginal = String((_b = pick('comarca')) !== null && _b !== void 0 ? _b : '').trim();
        const comarcaMatch = (0, jurimetria_1.fuzzyMatchFromList)(comarcaOriginal, settings.comarcas, threshold);
        if (comarcaMatch.matched)
            noteCorrection(rowNum, 'Comarca', comarcaOriginal, comarcaMatch.value);
        const tipoOriginal = String((_c = pick('tipo')) !== null && _c !== void 0 ? _c : '').trim();
        const tipoMatch = (0, jurimetria_1.normalizeTipo)(tipoOriginal, settings.tipos, threshold);
        if (tipoMatch.matched)
            noteCorrection(rowNum, 'Matéria / Tipo', tipoOriginal, tipoMatch.value);
        const resultadoOriginal = String((_d = pick('resultado')) !== null && _d !== void 0 ? _d : '').trim();
        const resultadoMatch = (0, jurimetria_1.normalizeResultado)(resultadoOriginal, settings.resultados, threshold);
        if (resultadoMatch.matched)
            noteCorrection(rowNum, 'Espécie', resultadoOriginal, resultadoMatch.value);
        const core = {
            numero_processo: numeroOriginal.slice(0, 60),
            data_juri: dataJuri,
            comarca: comarcaMatch.value.slice(0, 160),
            tipo: tipoMatch.value.slice(0, 40),
            resultado: resultadoMatch.value.slice(0, 80),
            promotor: String((_e = pick('promotor')) !== null && _e !== void 0 ? _e : '').trim().slice(0, 160),
            horario: (0, jurimetria_1.normalizeHorario)(pick('horario')),
            vara: String((_f = pick('vara')) !== null && _f !== void 0 ? _f : '').trim().slice(0, 160),
            observacoes: String((_g = pick('observacoes')) !== null && _g !== void 0 ? _g : '').trim().slice(0, 2000),
        };
        // Colunas personalizadas do órgão presentes na planilha.
        const values = {};
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
                    const s = (0, jurimetria_1.normalizeText)(rawValue);
                    values[field.key] = rawValue === true || ['sim', 'true', '1', 'yes', 'x'].includes(s);
                    break;
                }
                case 'date':
                    values[field.key] = (0, jurimetria_1.parseJuriDate)(rawValue) || '';
                    break;
                case 'select': {
                    const m = (0, jurimetria_1.fuzzyMatchFromList)(rawValue, field.options, threshold);
                    if (m.matched)
                        noteCorrection(rowNum, field.label, String(rawValue).trim(), m.value);
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
    const existingByNorm = new Map();
    for (let i = 0; i < candidates.length; i += LOOKUP_CHUNK) {
        const chunk = candidates.slice(i, i + LOOKUP_CHUNK);
        const keys = [...new Set(chunk.map((c) => c.numero_processo_norm))];
        if (keys.length === 0)
            continue;
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
        if (!existing)
            continue;
        const diffs = [];
        for (const field of jurimetria_1.JURI_COMPARABLE_FIELDS) {
            const current = String((_a = existing.data[field]) !== null && _a !== void 0 ? _a : '').trim();
            const incoming = String((_b = item.core[field]) !== null && _b !== void 0 ? _b : '').trim();
            // Célula vazia na planilha não "apaga" o que já existe no banco.
            if (!incoming)
                continue;
            if (current !== incoming)
                diffs.push({ field, current, incoming });
        }
        for (const field of settings.customFields) {
            const current = String((_d = (_c = existing.data.values) === null || _c === void 0 ? void 0 : _c[field.key]) !== null && _d !== void 0 ? _d : '').trim();
            const incoming = String((_e = item.values[field.key]) !== null && _e !== void 0 ? _e : '').trim();
            if (!incoming)
                continue;
            if (current !== incoming)
                diffs.push({ field: field.key, current, incoming });
        }
        item.existingId = existing.id;
        item.status = diffs.length === 0 ? 'sem_mudanca' : 'conflito';
        if (diffs.length > 0)
            item.diffs = diffs.slice(0, 12);
    }
    const counts = {
        novo: parsed.filter((p) => p.status === 'novo').length,
        sem_mudanca: parsed.filter((p) => p.status === 'sem_mudanca').length,
        conflito: parsed.filter((p) => p.status === 'conflito').length,
        invalido: parsed.filter((p) => p.status === 'invalido').length,
    };
    const sampleOf = (status) => parsed
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
        diffs: p.diffs || [],
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
    const updateEntry = {
        date: logDate, time: logTime, user_id: userId, user_name: userName,
        action: `Júri atualizado pela importação de "${sourceLabel}"`, timestamp: now.toISOString(),
    };
    const toCreate = parsed.filter((p) => p.status === 'novo');
    const toUpdate = effectivePolicy === 'update'
        ? parsed.filter((p) => p.status === 'conflito')
        : [];
    let created = 0;
    let updated = 0;
    const historyTargets = [];
    let batch = db.batch();
    let opCount = 0;
    const flush = async () => {
        if (opCount === 0)
            return;
        await batch.commit();
        batch = db.batch();
        opCount = 0;
    };
    for (const item of toCreate) {
        const ref = db.collection('juris').doc();
        batch.set(ref, Object.assign(Object.assign({ id: ref.id, organization_id: organizationId }, item.core), { numero_processo_norm: item.numero_processo_norm, values: item.values, responsible_user_id: null, responsible_user_name: null, source: 'import', imported_from: sourceLabel, created_by: userId, created_at: admin.firestore.FieldValue.serverTimestamp(), updated_at: admin.firestore.FieldValue.serverTimestamp(), updated_by: userId, activity_log: [createEntry] }));
        historyTargets.push({ ref, entry: createEntry });
        created += 1;
        opCount += 1;
        if (opCount >= WRITE_BATCH)
            await flush();
    }
    for (const item of toUpdate) {
        if (!item.existingId)
            continue;
        const ref = db.collection('juris').doc(item.existingId);
        const update = {
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: userId,
            imported_from: sourceLabel,
            activity_log: admin.firestore.FieldValue.arrayUnion(updateEntry),
        };
        // Só sobrescreve os campos que vieram preenchidos na planilha.
        for (const diff of item.diffs || []) {
            if (jurimetria_1.JURI_COMPARABLE_FIELDS.includes(diff.field)) {
                update[diff.field] = item.core[diff.field];
            }
            else {
                update[`values.${diff.field}`] = item.values[diff.field];
            }
        }
        batch.update(ref, update);
        historyTargets.push({ ref, entry: updateEntry });
        updated += 1;
        opCount += 1;
        if (opCount >= WRITE_BATCH)
            await flush();
    }
    await flush();
    // Espelho do histórico (best-effort — nunca falha a importação).
    try {
        for (let i = 0; i < historyTargets.length; i += WRITE_BATCH) {
            const histBatch = db.batch();
            for (const target of historyTargets.slice(i, i + WRITE_BATCH)) {
                histBatch.set(target.ref.collection('history').doc((0, history_1.historyEntryId)(target.entry)), Object.assign(Object.assign({}, target.entry), { created_at: admin.firestore.FieldValue.serverTimestamp() }));
            }
            await histBatch.commit();
        }
    }
    catch (histErr) {
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
            unchanged: counts.sem_mudanca,
            conflicts: counts.conflito,
            invalid: counts.invalido,
            total: rawRows.length,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return Object.assign(Object.assign({}, report), { created, updated });
});
//# sourceMappingURL=fromExcelJuris.js.map