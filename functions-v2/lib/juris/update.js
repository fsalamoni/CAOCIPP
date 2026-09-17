"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateJuri = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const history_1 = require("../shared/history");
const jurimetria_1 = require("../shared/jurimetria");
const FIELD_LABELS = {
    numero_processo: 'Número do processo',
    data_juri: 'Data do júri',
    realizacao: 'Realização',
    realizacao_justificativa: 'Justificativa',
    comarca: 'Comarca',
    tipo: 'Matéria / Tipo',
    resultado: 'Espécie de resultado',
    promotor: 'Promotor(a)',
    horario_inicio: 'Horário de início',
    horario: 'Horário de conclusão',
    vara: 'Vara / Órgão julgador',
    observacoes: 'Observações',
    responsible_user_id: 'Responsável',
    responsible_user_name: 'Nome do responsável',
};
exports.updateJuri = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    var _a, _b, _c;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { id, organizationId, data } = request.data || {};
    if (!id || !organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'id e organizationId são obrigatórios');
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
    const juriRef = db.collection('juris').doc(id);
    const juriSnap = await juriRef.get();
    if (!juriSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Júri não encontrado');
    }
    const juriData = juriSnap.data() || {};
    if (juriData.organization_id !== organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Este júri pertence a outra organização');
    }
    const orgSnap = await db.collection('organizations').doc(organizationId).get();
    const settings = (0, jurimetria_1.resolveJurimetriaSettings)(orgSnap.data());
    // Sanitiza o documento MESCLADO e depois mantém apenas as chaves que o
    // cliente realmente enviou — assim uma edição parcial nunca zera um
    // campo que não foi tocado.
    const incoming = (data && typeof data === 'object' ? data : {});
    const mergedInput = Object.assign(Object.assign(Object.assign({}, juriData), incoming), { values: Object.assign(Object.assign({}, (juriData.values || {})), (incoming.values || {})) });
    const { core, values } = (0, jurimetria_1.sanitizeJuriInput)(mergedInput, settings);
    const changes = {};
    const changedLabels = [];
    const userName = request.auth.token.name || 'Usuário desconhecido';
    // ------------------------------------------------------------------
    // Realização e data do júri
    // ------------------------------------------------------------------
    // Estes dois campos andam juntos (redesignar muda a data, cancelar a
    // apaga), então saem do laço genérico e passam por uma regra própria,
    // que também produz a entrada do histórico de datas.
    const tocouRealizacao = Object.prototype.hasOwnProperty.call(incoming, 'realizacao');
    const tocouData = Object.prototype.hasOwnProperty.call(incoming, 'data_juri');
    const tocouJustificativa = Object.prototype.hasOwnProperty.call(incoming, 'realizacao_justificativa');
    let historyEntry = null;
    let realizacaoLog = '';
    if (tocouRealizacao || tocouData || tocouJustificativa) {
        const transicao = (0, jurimetria_1.resolveRealizacaoChange)({
            currentRealizacao: juriData.realizacao,
            currentDate: juriData.data_juri,
            nextRealizacao: tocouRealizacao ? core.realizacao : juriData.realizacao,
            nextDate: tocouData ? core.data_juri : juriData.data_juri,
            justificativa: tocouJustificativa
                ? core.realizacao_justificativa
                : juriData.realizacao_justificativa,
            userId,
            userName,
        });
        if (transicao.error) {
            throw new https_1.HttpsError('invalid-argument', transicao.error);
        }
        if (transicao.realizacao !== (juriData.realizacao || 'realizado')) {
            changes.realizacao = transicao.realizacao;
            changedLabels.push(FIELD_LABELS.realizacao);
        }
        if (transicao.dataJuri !== (juriData.data_juri || '')) {
            changes.data_juri = transicao.dataJuri;
            changedLabels.push(FIELD_LABELS.data_juri);
        }
        if (transicao.justificativa !== (juriData.realizacao_justificativa || '')) {
            changes.realizacao_justificativa = transicao.justificativa;
            // Precisa entrar em changedLabels: sem isto, uma edição que
            // altera SÓ a justificativa cairia no retorno antecipado de
            // "nenhuma alteração" e o texto seria descartado em silêncio.
            changedLabels.push(FIELD_LABELS.realizacao_justificativa);
        }
        historyEntry = transicao.historyEntry;
        realizacaoLog = transicao.logAction;
    }
    // Demais campos fixos (a data e a realização já foram resolvidas acima).
    for (const key of jurimetria_1.JURIMETRIA_CORE_FIELD_KEYS) {
        if (key === 'data_juri' || key === 'realizacao' || key === 'realizacao_justificativa')
            continue;
        if (!Object.prototype.hasOwnProperty.call(incoming, key))
            continue;
        if (core[key] === juriData[key])
            continue;
        changes[key] = core[key];
        changedLabels.push(FIELD_LABELS[key] || key);
    }
    if (Object.prototype.hasOwnProperty.call(incoming, 'numero_processo')) {
        if (!core.numero_processo) {
            throw new https_1.HttpsError('invalid-argument', 'O número do processo é obrigatório');
        }
        const numeroNorm = (0, jurimetria_1.normalizeProcessNumber)(core.numero_processo);
        if (numeroNorm && numeroNorm !== juriData.numero_processo_norm) {
            const dupSnap = await db
                .collection('juris')
                .where('organization_id', '==', organizationId)
                .where('numero_processo_norm', '==', numeroNorm)
                .limit(2)
                .get();
            const conflict = dupSnap.docs.find((d) => d.id !== id);
            if (conflict) {
                throw new https_1.HttpsError('already-exists', `Já existe outro júri com o processo ${core.numero_processo} neste órgão.`);
            }
        }
        changes.numero_processo_norm = numeroNorm;
    }
    // Colunas personalizadas: grava o mapa inteiro já mesclado.
    if (Object.prototype.hasOwnProperty.call(incoming, 'values')) {
        const before = JSON.stringify(juriData.values || {});
        if (before !== JSON.stringify(values)) {
            changes.values = values;
            const touched = Object.keys(incoming.values || {});
            for (const key of touched) {
                const field = settings.customFields.find((f) => f.key === key);
                if (field)
                    changedLabels.push(field.label);
            }
        }
    }
    // Responsável (membro do órgão).
    if (Object.prototype.hasOwnProperty.call(incoming, 'responsible_user_id')) {
        const responsibleUserId = String((_a = incoming.responsible_user_id) !== null && _a !== void 0 ? _a : '').trim() || null;
        let responsibleUserName = String((_b = incoming.responsible_user_name) !== null && _b !== void 0 ? _b : '').trim().slice(0, 160) || null;
        if (responsibleUserId) {
            const respSnap = await db
                .collection('userOrganizations')
                .doc(`${responsibleUserId}_${organizationId}`)
                .get();
            if (!respSnap.exists) {
                throw new https_1.HttpsError('invalid-argument', 'O responsável indicado não é membro deste órgão');
            }
            if (!responsibleUserName) {
                responsibleUserName = String(((_c = respSnap.data()) === null || _c === void 0 ? void 0 : _c.user_name) || '') || null;
            }
        }
        else if (settings.requireResponsible) {
            throw new https_1.HttpsError('invalid-argument', 'Este órgão exige um responsável para cada júri');
        }
        if (responsibleUserId !== (juriData.responsible_user_id || null)) {
            changes.responsible_user_id = responsibleUserId;
            changes.responsible_user_name = responsibleUserName;
            changedLabels.push(FIELD_LABELS.responsible_user_id);
        }
    }
    if (changedLabels.length === 0) {
        return { success: true, message: 'Nenhuma alteração detectada' };
    }
    const now = new Date();
    const outrosCampos = [...new Set(changedLabels)].filter((label) => label !== FIELD_LABELS.realizacao && label !== FIELD_LABELS.data_juri);
    // Uma redesignação é um fato do processo, não "campos atualizados":
    // o registro precisa dizer o que aconteceu e por quê.
    const partes = [];
    if (realizacaoLog)
        partes.push(realizacaoLog);
    if (outrosCampos.length > 0)
        partes.push(`Campos atualizados: ${outrosCampos.join(', ')}`);
    const logEntry = {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        user_id: userId,
        user_name: userName,
        action: partes.length > 0
            ? partes.join(' · ')
            : `Campos atualizados: ${[...new Set(changedLabels)].join(', ')}`,
        timestamp: now.toISOString(),
    };
    changes.updated_at = admin.firestore.FieldValue.serverTimestamp();
    changes.updated_by = userId;
    changes.activity_log = admin.firestore.FieldValue.arrayUnion(logEntry);
    // Histórico de datas: a data anterior nunca se perde.
    if (historyEntry) {
        changes.date_history = admin.firestore.FieldValue.arrayUnion(historyEntry);
    }
    await juriRef.update(changes);
    try {
        await juriRef.collection('history').doc((0, history_1.historyEntryId)(logEntry)).set(Object.assign(Object.assign({}, logEntry), { created_at: admin.firestore.FieldValue.serverTimestamp() }));
    }
    catch (histErr) {
        console.error('[history dual-write] juri update', id, histErr);
    }
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: userName,
        action: 'UPDATE_JURI',
        details: { juri_id: id, changes: Object.keys(changes).filter((k) => k !== 'activity_log') },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
});
//# sourceMappingURL=update.js.map