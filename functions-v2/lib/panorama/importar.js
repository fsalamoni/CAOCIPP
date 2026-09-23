"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importPanorama = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const XLSX = require("xlsx");
const panorama_1 = require("../shared/panorama");
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
/**
 * Lê o arquivo (planilha, CSV ou JSON) e devolve as linhas brutas.
 * O .docx não entra aqui: no Panorama a origem é sempre tabular.
 */
function parseFile(fileData, fileName) {
    const base64 = String(fileData || '').replace(/^data:[^;]+;base64,/, '');
    if (!base64)
        throw new https_1.HttpsError('invalid-argument', 'Arquivo vazio');
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length > MAX_FILE_BYTES) {
        throw new https_1.HttpsError('invalid-argument', 'Arquivo maior que 10 MB');
    }
    let rows = [];
    if (/\.json$/i.test(fileName)) {
        try {
            const parsed = JSON.parse(buffer.toString('utf8'));
            rows = Array.isArray(parsed) ? parsed : [parsed];
        }
        catch (_a) {
            throw new https_1.HttpsError('invalid-argument', 'JSON inválido');
        }
    }
    else {
        try {
            rows = readWorkbookRows(buffer);
        }
        catch (err) {
            throw new https_1.HttpsError('invalid-argument', `Não foi possível ler o arquivo: ${err.message}`);
        }
    }
    return rows.filter((r) => r && typeof r === 'object' && !isBlankRow(r));
}
/**
 * Mede cada coluna da planilha e propõe um esquema.
 *
 * Quando a base JÁ existe, as colunas conhecidas mantêm a chave, o rótulo e o
 * papel que o admin configurou — a planilha não reescreve a configuração do
 * órgão. Colunas novas entram como acréscimo, para que acrescentar uma coluna
 * na planilha de origem não quebre a base nem exija reconfigurar tudo.
 */
function detectarColunas(linhas, baseExistente) {
    var _a, _b, _c;
    const cabecalhos = [...new Set(linhas.flatMap((r) => Object.keys(r)))]
        .filter((h) => String(h || '').trim() !== '');
    const amostra = linhas.slice(0, AMOSTRA_INFERENCIA);
    // Casamento com as colunas já configuradas: primeiro pela origem gravada,
    // depois pelo rótulo normalizado. É o que permite reimportar a mesma
    // planilha depois de o admin ter renomeado uma coluna na plataforma.
    const porOrigem = new Map();
    const porRotulo = new Map();
    for (const col of (baseExistente === null || baseExistente === void 0 ? void 0 : baseExistente.columns) || []) {
        if (col.origem)
            porOrigem.set((0, panorama_1.normalizeText)(col.origem), col);
        porRotulo.set((0, panorama_1.normalizeText)(col.label), col);
    }
    const chaves = new Set(((baseExistente === null || baseExistente === void 0 ? void 0 : baseExistente.columns) || []).map((c) => c.key));
    const out = [];
    for (const cabecalho of cabecalhos) {
        const valores = amostra.map((l) => l[cabecalho]);
        const stats = (0, panorama_1.analyzeColumn)(valores);
        const tipoInferido = (0, panorama_1.inferColumnType)(stats);
        const conhecida = porOrigem.get((0, panorama_1.normalizeText)(cabecalho))
            || porRotulo.get((0, panorama_1.normalizeText)(cabecalho));
        const sugestao = (0, panorama_1.suggestRole)(cabecalho, tipoInferido, stats);
        if (conhecida) {
            out.push(Object.assign(Object.assign({}, conhecida), { 
                // Estatística é sempre a da planilha atual; configuração é sempre
                // a do órgão.
                cardinalidade: stats.distintos, amostra: stats.amostra, vazios: stats.vazios, lista: conhecida.type === 'lista'
                    ? [...new Set([...(conhecida.lista || []), ...stats.valores])].sort((a, b) => a.localeCompare(b, 'pt-BR'))
                    : conhecida.lista, origem: cabecalho, papelSugerido: conhecida.role, motivoSugestao: 'coluna já configurada nesta base', confiancaSugestao: 1 }));
            continue;
        }
        const key = (0, panorama_1.slugColumnKey)(cabecalho, chaves);
        chaves.add(key);
        out.push({
            key,
            label: String(cabecalho).trim().slice(0, 120),
            type: tipoInferido,
            role: (_a = sugestao === null || sugestao === void 0 ? void 0 : sugestao.role) !== null && _a !== void 0 ? _a : null,
            lista: tipoInferido === 'lista' ? stats.valores : undefined,
            cardinalidade: stats.distintos,
            amostra: stats.amostra,
            vazios: stats.vazios,
            visivel: true,
            ordem: out.length,
            origem: cabecalho,
            papelSugerido: (_b = sugestao === null || sugestao === void 0 ? void 0 : sugestao.role) !== null && _b !== void 0 ? _b : null,
            motivoSugestao: (sugestao === null || sugestao === void 0 ? void 0 : sugestao.motivo) || 'nenhum papel evidente — a coluna entra como informativa',
            confiancaSugestao: (_c = sugestao === null || sugestao === void 0 ? void 0 : sugestao.confianca) !== null && _c !== void 0 ? _c : 0,
        });
    }
    // Papel único: se duas colunas foram propostas para o mesmo papel, só a de
    // maior confiança fica com ele. As demais entram sem papel, e o usuário
    // decide na tela.
    const ocupados = new Map();
    for (const col of out) {
        if (!col.role)
            continue;
        const atual = ocupados.get(col.role);
        if (!atual) {
            ocupados.set(col.role, col);
            continue;
        }
        const perdedora = col.confiancaSugestao > atual.confiancaSugestao ? atual : col;
        const vencedora = perdedora === atual ? col : atual;
        ocupados.set(col.role, vencedora);
        perdedora.role = null;
        perdedora.motivoSugestao = `"${vencedora.label}" ficou com este papel por ter correspondência mais forte`;
    }
    return out;
}
exports.importPanorama = (0, https_1.onCall)({ region: 'southamerica-east1', memory: '1GiB', timeoutSeconds: 540 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }
    const payload = request.data || {};
    const { organizationId, baseId, mode = 'preview' } = payload;
    if (!organizationId)
        throw new https_1.HttpsError('invalid-argument', 'organizationId é obrigatório');
    const db = admin.firestore();
    const userId = request.auth.uid;
    const membershipSnap = await db
        .collection('userOrganizations')
        .doc(`${userId}_${organizationId}`)
        .get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    const membership = membershipSnap.data() || {};
    const permissions = (membership.permissions && typeof membership.permissions === 'object')
        ? membership.permissions
        : {};
    const podeConfigurar = membership.role === 'creator' || permissions.configure_panorama === true;
    const userName = request.auth.token.name || String(membership.user_name || 'Usuário desconhecido');
    // ---- Base existente (ou ausente, no caso de uma base nova) ---------
    let baseDef = null;
    if (baseId) {
        const snap = await db.collection('panoramaBases').doc(baseId).get();
        if (!snap.exists)
            throw new https_1.HttpsError('not-found', 'Base não encontrada');
        const data = snap.data() || {};
        if (data.organization_id !== organizationId) {
            throw new https_1.HttpsError('not-found', 'Base não encontrada');
        }
        baseDef = (0, panorama_1.sanitizeBaseDef)(data);
    }
    const fileName = String(payload.fileName || '').slice(0, 200);
    const linhas = parseFile(payload.fileData, fileName);
    if (linhas.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'Arquivo vazio — nenhuma linha encontrada.');
    }
    if (linhas.length > MAX_ROWS) {
        throw new https_1.HttpsError('invalid-argument', `Arquivo com ${linhas.length} linhas. O limite por importação é ${MAX_ROWS}. `
            + 'Divida a planilha em partes — cada parte importada acrescenta à mesma base.');
    }
    // ---- Colunas -------------------------------------------------------
    // No preview, a plataforma DETECTA. No commit, vale o que o usuário
    // confirmou na tela (sanitizado), e a detecção serve só de fallback.
    const detectadas = detectarColunas(linhas, baseDef);
    const colunas = mode === 'commit' && payload.columns
        ? (0, panorama_1.sanitizeBaseDef)({ nome: 'x', columns: payload.columns }).columns
        // No preview, a coluna efetiva é a detectada sem os campos de
        // sugestão, que existem só para a tela de mapeamento.
        : detectadas.map((d) => ({
            key: d.key, label: d.label, type: d.type, role: d.role,
            lista: d.lista, cardinalidade: d.cardinalidade, amostra: d.amostra,
            vazios: d.vazios, visivel: d.visivel, ordem: d.ordem, origem: d.origem,
        }));
    if (colunas.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'Nenhuma coluna reconhecida na planilha.');
    }
    const defEfetiva = Object.assign(Object.assign({}, (baseDef || (0, panorama_1.sanitizeBaseDef)({ nome: payload.baseNome || fileName || 'Nova base' }))), { columns: colunas });
    const politica = payload.policy === 'update' || payload.policy === 'preserve'
        ? payload.policy
        : defEfetiva.importPolicy;
    const colId = (0, panorama_1.columnForRole)(defEfetiva, 'identificador');
    const colunasLista = colunas.filter((c) => { var _a; return c.type === 'lista' && (((_a = c.lista) === null || _a === void 0 ? void 0 : _a.length) || 0) > 0; });
    // ---- Converte e normaliza cada linha -------------------------------
    const correcoes = [];
    const parsed = [];
    const chavesVistas = new Map();
    linhas.forEach((linha, index) => {
        const values = {};
        for (const col of colunas) {
            const bruto = col.origem !== undefined ? linha[col.origem] : linha[col.label];
            let valor = (0, panorama_1.coerceValue)(bruto, col.type);
            // Correção automática contra a lista canônica da coluna: é o que
            // impede "PORTO ALEGRE", "Porto Alegre" e "P. Alegre" de virarem
            // três comarcas no relatório.
            if (col.type === 'lista' && typeof valor === 'string' && valor
                && colunasLista.includes(col)) {
                const match = (0, panorama_1.fuzzyMatchFromList)(valor, col.lista || [], defEfetiva.fuzzyThreshold);
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
        const item = {
            row: index + 2,
            chave: colId ? (0, panorama_1.normalizeIdentifier)(values[colId.key]) : '',
            values,
            status: 'novo',
        };
        if (colId && !item.chave) {
            item.status = 'invalido';
            item.error = `Sem "${colId.label}", que é o identificador desta base`;
        }
        else if (item.chave && chavesVistas.has(item.chave)) {
            item.status = 'invalido';
            item.error = `Identificador repetido na própria planilha (linha ${chavesVistas.get(item.chave)})`;
        }
        else if (Object.values(values).every((v) => v === null || v === '')) {
            item.status = 'invalido';
            item.error = 'Linha sem nenhum dado aproveitável';
        }
        else if (item.chave) {
            chavesVistas.set(item.chave, item.row);
        }
        parsed.push(item);
    });
    // ---- Confronta com o que já está no banco --------------------------
    if (baseId && colId) {
        const candidatos = parsed.filter((p) => p.status !== 'invalido' && p.chave);
        const existentes = new Map();
        // `in` aceita no máximo 30 valores por consulta.
        for (let i = 0; i < candidatos.length; i += 30) {
            const chaves = candidatos.slice(i, i + 30).map((p) => p.chave);
            if (chaves.length === 0)
                continue;
            const snap = await db.collection('panoramaRegistros')
                .where('organization_id', '==', organizationId)
                .where('base_id', '==', baseId)
                .where('chave_norm', 'in', chaves)
                .get();
            snap.docs.forEach((d) => {
                const data = d.data() || {};
                existentes.set(String(data.chave_norm || ''), {
                    id: d.id,
                    values: (data.values || {}),
                });
            });
        }
        for (const item of candidatos) {
            const atual = existentes.get(item.chave);
            if (!atual)
                continue;
            // Duas situações muito diferentes se escondem em "já existe":
            //   fills → o campo está VAZIO no banco e a planilha traz valor.
            //           Ganho puro: aplica sob qualquer política.
            //   diffs → o campo TEM valor e a planilha traz outro.
            //           Divergência: quem decide é a política do órgão.
            const diffs = [];
            const fills = [];
            for (const col of colunas) {
                if (col.key === colId.key)
                    continue;
                const incoming = item.values[col.key];
                // Célula vazia na planilha nunca apaga o que já está gravado.
                if (incoming === null || incoming === '')
                    continue;
                const current = atual.values[col.key];
                const currentStr = current === null || current === undefined ? '' : String(current);
                const incomingStr = String(incoming);
                if (!currentStr) {
                    fills.push({ key: col.key, field: col.label, current: '', incoming: incomingStr });
                }
                else if (currentStr !== incomingStr) {
                    diffs.push({ key: col.key, field: col.label, current: currentStr, incoming: incomingStr });
                }
            }
            item.existingId = atual.id;
            if (diffs.length > 0) {
                item.status = 'conflito';
                item.diffs = diffs.slice(0, 12);
                if (fills.length > 0)
                    item.fills = fills.slice(0, 12);
            }
            else if (fills.length > 0) {
                item.status = 'atualizacao';
                item.fills = fills.slice(0, 12);
            }
            else {
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
    const sampleOf = (status) => parsed
        .filter((p) => p.status === status)
        .slice(0, SAMPLE_LIMIT)
        .map((p) => {
        var _a;
        return ({
            row: p.row,
            chave: colId ? String((_a = p.values[colId.key]) !== null && _a !== void 0 ? _a : '') : '',
            resumo: colunas
                .filter((c) => c.visivel && c.key !== (colId === null || colId === void 0 ? void 0 : colId.key))
                .slice(0, 4)
                .map((c) => { var _a; return `${c.label}: ${(_a = p.values[c.key]) !== null && _a !== void 0 ? _a : '—'}`; })
                .join(' · '),
            diffs: p.diffs || [],
            fills: p.fills || [],
            error: p.error || '',
        });
    });
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
    if (mode === 'preview')
        return report;
    // ---- Commit ---------------------------------------------------------
    if (!podeConfigurar && !baseId) {
        throw new https_1.HttpsError('permission-denied', 'É preciso a permissão "Configurar Panorama" para criar uma base');
    }
    // Base nova: cria agora, com as colunas confirmadas na tela.
    let alvoBaseId = baseId || '';
    if (!alvoBaseId) {
        const novaDef = (0, panorama_1.sanitizeBaseDef)({
            nome: payload.baseNome || fileName.replace(/\.[^.]+$/, '') || 'Nova base',
            columns: colunas,
        });
        const doc = await db.collection('panoramaBases').add(Object.assign(Object.assign({ organization_id: organizationId }, novaDef), { created_by: userId, created_by_name: userName, created_at: admin.firestore.FieldValue.serverTimestamp(), updated_at: admin.firestore.FieldValue.serverTimestamp(), updated_by: userId, updated_by_name: userName, activity_log: [{
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toTimeString().split(' ')[0],
                    user_id: userId,
                    user_name: userName,
                    action: `Base criada pela importação de ${fileName || 'uma planilha'}`,
                    timestamp: new Date().toISOString(),
                }] }));
        alvoBaseId = doc.id;
    }
    else if (podeConfigurar) {
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
        const antigas = (baseDef === null || baseDef === void 0 ? void 0 : baseDef.columns) || [];
        const mescladas = antigas.map((c) => {
            var _a, _b, _c, _d, _e;
            const nova = confirmadas.get(c.key);
            if (!nova)
                return c;
            return Object.assign(Object.assign({}, c), { label: nova.label, type: nova.type, role: nova.role, lista: (_a = nova.lista) !== null && _a !== void 0 ? _a : c.lista, cardinalidade: (_b = nova.cardinalidade) !== null && _b !== void 0 ? _b : c.cardinalidade, amostra: (_c = nova.amostra) !== null && _c !== void 0 ? _c : c.amostra, vazios: (_d = nova.vazios) !== null && _d !== void 0 ? _d : c.vazios, visivel: nova.visivel, origem: (_e = nova.origem) !== null && _e !== void 0 ? _e : c.origem });
        });
        const conhecidas = new Set(antigas.map((c) => c.key));
        const novas = colunas.filter((c) => !conhecidas.has(c.key));
        const merged = (0, panorama_1.sanitizeBaseDef)(Object.assign(Object.assign({}, baseDef), { columns: [...mescladas, ...novas] }));
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
                activity_log: [Object.assign(Object.assign({}, logBase), { action: `Importado de ${fileName || 'planilha'}` })],
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
            if (!item.existingId)
                continue;
            // Enriquecimento aplica só as lacunas; sobrescrita aplica tudo.
            const campos = item.status === 'atualizacao'
                ? (item.fills || [])
                : [...(item.diffs || []), ...(item.fills || [])];
            const patch = {};
            for (const c of campos) {
                // Pela CHAVE, nunca pelo rótulo: dois rótulos iguais em
                // colunas diferentes fariam o patch escrever no campo errado.
                const col = colunas.find((x) => x.key === c.key);
                if (col)
                    patch[`values.${col.key}`] = item.values[col.key];
            }
            if (Object.keys(patch).length === 0)
                continue;
            const rotulos = campos.map((c) => c.field);
            batch.update(db.collection('panoramaRegistros').doc(item.existingId), Object.assign(Object.assign({}, patch), { updated_at: admin.firestore.FieldValue.serverTimestamp(), updated_by: userId, activity_log: admin.firestore.FieldValue.arrayUnion(Object.assign(Object.assign({}, logBase), { action: item.status === 'atualizacao'
                        ? `Complementado pela importação de ${fileName}: ${rotulos.join(', ')}`
                        : `Atualizado pela importação de ${fileName}: ${rotulos.join(', ')}` })) }));
            if (item.status === 'atualizacao')
                enriquecidos += 1;
            else
                atualizados += 1;
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
    return Object.assign(Object.assign({}, report), { baseId: alvoBaseId, criados, enriquecidos, atualizados });
});
//# sourceMappingURL=importar.js.map