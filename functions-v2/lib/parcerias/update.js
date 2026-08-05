"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateParceria = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const status_1 = require("../shared/status");
const history_1 = require("../shared/history");
const normalization_1 = require("../shared/normalization");
const webhooks_1 = require("../shared/webhooks");
const validators_1 = require("../shared/validators");
// Campos "congelados" quando a Parceria tem 1+ aditivos. Quem tenta mexer
// neles via updateParceria (em vez de updateAditivo) é bloqueado aqui.
const FROZEN_WHEN_HAS_ADITIVO = new Set([
    'subject', 'object', 'parties',
    'pgea', 'pgea_date',
    'partnership_type', 'partnership_number', 'categoria', 'signature_date',
    'validity_period', 'end_date', 'renewal_notice_date',
]);
exports.updateParceria = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { id, organizationId, changes } = request.data || {};
    if (!id || !organizationId || !changes) {
        throw new https_1.HttpsError('invalid-argument', 'Campos obrigatórios faltando');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    // 1. Verify membership
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    // 2. Read existing
    const parceriaRef = db.collection('parcerias').doc(id);
    const parceriaSnap = await parceriaRef.get();
    if (!parceriaSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Parceria não encontrada');
    }
    const parceriaData = parceriaSnap.data() || {};
    if (parceriaData.organization_id !== organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Parceria pertence a outra organização');
    }
    // 3. Sanitize changes — bloquear campos reservados que só Cloud
    // Functions (específicas) podem mexer.
    delete changes.id;
    delete changes.organization_id;
    delete changes.created_at;
    delete changes.created_by;
    delete changes.activity_log;
    delete changes.aditivo_count; // só addAditivo pode mexer
    delete changes.current_additive_id; // só addAditivo pode mexer
    delete changes.anonymized; // só runAnonymization
    delete changes.anonymized_at;
    delete changes.anonymized_by;
    // Se a Parceria tem aditivo, bloquear edição dos campos do original.
    if ((parceriaData.aditivo_count || 0) > 0) {
        for (const field of FROZEN_WHEN_HAS_ADITIVO) {
            if (field in changes) {
                throw new https_1.HttpsError('failed-precondition', `O campo "${field}" está congelado porque a Parceria possui ${parceriaData.aditivo_count} aditivo(s). Edite o aditivo corrente.`);
            }
        }
    }
    // Sanitizar responsible_user_name (mesma razão de processos/expedientes).
    if (typeof changes.responsible_user_name === 'string') {
        changes.responsible_user_name = (0, normalization_1.formatPersonName)(changes.responsible_user_name);
    }
    // Auto-preencher responsabilidade_date quando o assessor é atribuído
    // (UX: o usuário marca o assessor e a data "vira" hoje).
    if (changes.responsible_user_id &&
        changes.responsible_user_id !== parceriaData.responsible_user_id &&
        !changes.responsibility_date) {
        const today = new Date().toISOString().split('T')[0];
        changes.responsibility_date = today;
    }
    // Normalizar flags boolean/strings → boolean.
    if ('urgency_request' in changes) {
        const v = changes.urgency_request;
        if (v === true)
            changes.urgency_request = true;
        else if (v === false)
            changes.urgency_request = false;
        else if (typeof v === 'string') {
            const s = v.toLowerCase().trim();
            changes.urgency_request = (s === 'sim' || s === 'true' || s === '1' || s === 'yes');
        }
        else {
            delete changes.urgency_request;
        }
    }
    if ('access_restriction' in changes) {
        const v = changes.access_restriction;
        if (v === true)
            changes.access_restriction = true;
        else if (v === false)
            changes.access_restriction = false;
        else if (typeof v === 'string') {
            const s = v.toLowerCase().trim();
            changes.access_restriction = (s === 'sim' || s === 'true' || s === '1' || s === 'yes');
        }
        else {
            delete changes.access_restriction;
        }
    }
    changes.updated_at = admin.firestore.FieldValue.serverTimestamp();
    changes.updated_by = userId;
    // 4. Recalcular status
    const merged = Object.assign(Object.assign({}, parceriaData), changes);
    const statusInChanges = changes.status;
    const currentStatus = parceriaData.status;
    let nextStatus;
    if (statusInChanges && statusInChanges !== currentStatus) {
        // Respeitar override manual — mas validar a transição.
        (0, validators_1.validateParceriaPhaseTransition)(merged, statusInChanges);
        nextStatus = statusInChanges;
    }
    else {
        const computed = (0, status_1.calculateParceriaStatus)(merged);
        if (computed && computed !== currentStatus) {
            (0, validators_1.validateParceriaPhaseTransition)(merged, computed);
            nextStatus = computed;
        }
    }
    if (nextStatus) {
        changes.status = nextStatus;
    }
    // 5. Activity log
    const now = new Date();
    const logDate = now.toISOString().split('T')[0];
    const logTime = now.toTimeString().split(' ')[0];
    const userName = request.auth.token.name || 'Usuário desconhecido';
    const fieldLabels = {
        pgea: 'PGEA',
        subject: 'Assunto',
        object: 'Objeto',
        parties: 'Partes',
        partnership_type: 'Tipo de Parceria',
        partnership_number: 'Número da Parceria',
        categoria: 'Categoria',
        signature_date: 'Data da Assinatura',
        validity_period: 'Vigência',
        end_date: 'Termo Final',
        renewal_notice_date: 'Data do Aviso de Renovação',
        responsible_user_id: 'Assessor Responsável',
        responsible_user_name: 'Nome do Responsável',
        responsibility_date: 'Data de Responsabilidade',
        network_folder: 'Pasta na Rede',
        observations: 'Observações',
        review_conclusion_date: 'Data de Conclusão da Revisão',
        third_party: 'Terceiro',
        extinguished: 'Extinção',
        status: 'Status',
    };
    const changedFields = Object.keys(changes)
        .filter((k) => !['updated_at', 'updated_by'].includes(k))
        .map((k) => fieldLabels[k] || k);
    let actionDesc = '';
    if (changedFields.length === 1 && changes.status && changes.status !== currentStatus) {
        actionDesc = `Status alterado de "${currentStatus || 'Pendente'}" para "${changes.status}"`;
    }
    else if (changedFields.length > 0) {
        actionDesc = `Campos atualizados: ${changedFields.join(', ')}`;
    }
    else {
        actionDesc = 'Parceria atualizada';
    }
    const logEntry = {
        date: logDate,
        time: logTime,
        user_id: userId,
        user_name: userName,
        action: actionDesc,
        timestamp: now.toISOString(),
    };
    changes.activity_log = admin.firestore.FieldValue.arrayUnion(logEntry);
    await parceriaRef.update(changes);
    // Fase 3 (escrita dupla, ADITIVA): espelha a entrada no histórico.
    try {
        await parceriaRef.collection('history').doc((0, history_1.historyEntryId)(logEntry)).set(Object.assign(Object.assign({}, logEntry), { created_at: admin.firestore.FieldValue.serverTimestamp() }));
    }
    catch (histErr) {
        console.error('[history dual-write] parceria update', id, histErr);
    }
    // 6. Audit log
    await db.collection('auditLogs').add({
        organization_id: organizationId,
        user_id: userId,
        user_name: userName,
        action: 'UPDATE_PARCERIA',
        details: { parceria_id: id, changes: Object.keys(changes) },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Webhook em extinção.
    if (changes.extinguished === true && !parceriaData.extinguished) {
        await (0, webhooks_1.fireOrgWebhook)(organizationId, 'parceria_extinguished', {
            entity_type: 'parceria',
            entity_id: id,
            pgea: parceriaData.pgea,
        });
    }
    return { success: true, status: nextStatus || currentStatus };
});
//# sourceMappingURL=update.js.map