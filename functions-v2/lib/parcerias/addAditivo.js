"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAditivo = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const history_1 = require("../shared/history");
const ADITIVO_TYPE_MAX = 100;
const LEGACY_TYPE_LABELS = {
    'renovacao_prorrogacao': 'Renovação/Prorrogação',
    'qualitativo': 'Qualitativo (Objeto)',
};
function sanitizeAditivoType(input) {
    const type = String(input !== null && input !== void 0 ? input : '').trim().slice(0, ADITIVO_TYPE_MAX);
    if (!type)
        return null;
    // Se for um dos legacy kebab-case, mantém o label tradicional.
    const label = LEGACY_TYPE_LABELS[type] || type;
    return { type, label };
}
exports.addAditivo = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const data = request.data || {};
    const { parceriaId, organizationId, aditivoType: rawAditivoType } = data;
    if (!parceriaId || !organizationId) {
        throw new https_1.HttpsError('invalid-argument', 'parceriaId e organizationId são obrigatórios');
    }
    const typeInfo = sanitizeAditivoType(rawAditivoType);
    if (!typeInfo) {
        throw new https_1.HttpsError('invalid-argument', 'aditivoType é obrigatório (até 100 caracteres)');
    }
    // Label customizado do frontend tem precedência sobre o derivado.
    const customLabel = String(data.aditivoTypeLabel || '').trim().slice(0, 100);
    const aditivoTypeLabel = customLabel || typeInfo.label;
    const db = admin.firestore();
    const userId = request.auth.uid;
    // 1. Verify membership
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    // 2. Read parent parceria
    const parceriaRef = db.collection('parcerias').doc(parceriaId);
    const parceriaSnap = await parceriaRef.get();
    if (!parceriaSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Parceria não encontrada');
    }
    const parceriaData = parceriaSnap.data() || {};
    if (parceriaData.organization_id !== organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Parceria pertence a outra organização');
    }
    // 3. Regra de negócio: só é possível incluir aditivo quando a Parceria
    // está em status "Parcerias" (formalizada, com vigência rolando).
    if (parceriaData.status !== 'Parcerias') {
        throw new https_1.HttpsError('failed-precondition', `Só é possível incluir aditivo quando a Parceria está na fase "Parcerias" (atual: "${parceriaData.status || 'Pendente'}").`);
    }
    // 4. Calcular número sequencial do aditivo.
    const aditivoNumber = (parceriaData.aditivo_count || 0) + 1;
    // 5. Criar o documento do aditivo
    const aditivoRef = parceriaRef.collection('aditivos').doc();
    const now = new Date();
    const logDate = now.toISOString().split('T')[0];
    const logTime = now.toTimeString().split(' ')[0];
    const userName = request.auth.token.name || 'Usuário desconhecido';
    const aditivoType = typeInfo.type;
    const aditivoTypeLabelFinal = aditivoTypeLabel;
    const aditivoData = {
        id: aditivoRef.id,
        parceria_id: parceriaId,
        organization_id: organizationId,
        aditivo_number: aditivoNumber,
        aditivo_type: aditivoType,
        aditivo_type_label: aditivoTypeLabelFinal,
        // Snapshot do original (somente leitura) — guardado para auditoria.
        pgea_at_additive_creation: parceriaData.pgea || null,
        partnership_type_at_additive_creation: parceriaData.partnership_type || null,
        partnership_number_at_additive_creation: parceriaData.partnership_number || null,
        // Campos próprios do aditivo (vazios para serem preenchidos no fluxo).
        partnership_type: null,
        partnership_number: null,
        signature_date: null,
        validity_period: null,
        end_date: null,
        renewal_notice_date: null,
        subject: data.subject || parceriaData.subject || '',
        object: data.object || parceriaData.object || '',
        parties: data.parties || parceriaData.parties || '',
        responsible_user_id: null,
        responsible_user_name: null,
        responsibility_date: null,
        network_folder: '',
        observations: '',
        review_conclusion_date: null,
        third_party: null,
        status: 'Pendente',
        created_by: userId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        activity_log: [{
                date: logDate,
                time: logTime,
                user_id: userId,
                user_name: userName,
                action: `Aditivo #${aditivoNumber} criado (${aditivoTypeLabelFinal})`,
                timestamp: now.toISOString(),
                details: { aditivo_id: aditivoRef.id, aditivo_type: aditivoType },
            }],
    };
    await aditivoRef.set(aditivoData);
    // Dual-write do log do aditivo na subcoleção history/ do aditivo.
    try {
        const aditivoLogEntry = {
            date: logDate,
            time: logTime,
            user_id: userId,
            user_name: userName,
            action: `Aditivo #${aditivoNumber} criado (${aditivoTypeLabelFinal})`,
            timestamp: now.toISOString(),
        };
        await aditivoRef
            .collection('history')
            .doc((0, history_1.historyEntryId)(aditivoLogEntry))
            .set(Object.assign(Object.assign({}, aditivoLogEntry), { created_at: admin.firestore.FieldValue.serverTimestamp() }));
    }
    catch (histErr) {
        console.error('[history dual-write] aditivo create', aditivoRef.id, histErr);
    }
    // 6. Atualizar Parceria pai: incrementa aditivo_count, define
    // current_additive_id, e MIGRA o status para "Pendente" (a Parceria
    // original "desce" para o início do fluxo; o aditivo é o que vai
    // prosseguir).
    const parentUpdate = {
        aditivo_count: admin.firestore.FieldValue.increment(1),
        current_additive_id: aditivoRef.id,
        status: 'Pendente',
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_by: userId,
        activity_log: admin.firestore.FieldValue.arrayUnion({
            date: logDate,
            time: logTime,
            user_id: userId,
            user_name: userName,
            action: `Aditivo #${aditivoNumber} incluído (${aditivoTypeLabelFinal})`,
            timestamp: now.toISOString(),
            details: { aditivo_id: aditivoRef.id, aditivo_type: aditivoType },
        }),
    };
    await parceriaRef.update(parentUpdate);
    // Dual-write do log do parent na subcoleção history/ da Parceria.
    try {
        const parentLogEntry = {
            date: logDate,
            time: logTime,
            user_id: userId,
            user_name: userName,
            action: `Aditivo #${aditivoNumber} incluído (${aditivoTypeLabelFinal})`,
            timestamp: now.toISOString(),
        };
        await parceriaRef
            .collection('history')
            .doc((0, history_1.historyEntryId)(parentLogEntry))
            .set(Object.assign(Object.assign({}, parentLogEntry), { created_at: admin.firestore.FieldValue.serverTimestamp() }));
    }
    catch (histErr) {
        console.error('[history dual-write] parceria addAditivo', parceriaId, histErr);
    }
    // 7. Audit log
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: userName,
        action: 'ADD_ADITIVO',
        details: {
            parceria_id: parceriaId,
            aditivo_id: aditivoRef.id,
            aditivo_number: aditivoNumber,
            aditivo_type: aditivoType,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, aditivoId: aditivoRef.id, aditivoNumber };
});
//# sourceMappingURL=addAditivo.js.map