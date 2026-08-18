import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { calculateParceriaStatus } from '../shared/status';
import { historyEntryId } from '../shared/history';
import { formatPersonName } from '../shared/normalization';
import { fireOrgWebhook } from '../shared/webhooks';
import { validateParceriaPhaseTransition } from '../shared/validators';

interface UpdateParceriaRequest {
    id: string;
    organizationId: string;
    changes: Record<string, any>;
}

// Campos "congelados" quando a Parceria tem 1+ aditivos. Quem tenta mexer
// neles via updateParceria (em vez de updateAditivo) é bloqueado aqui.
// NOTA: pgea NÃO está na lista (item 2 do plano — PGEA continua editável
// mesmo com aditivos, pois é o identificador de auditoria e pode ser corrigido
// sem invalidar a substância do aditivo).
const FROZEN_WHEN_HAS_ADITIVO = new Set([
    'subject', 'object', 'parties',
    'partnership_type', 'partnership_number', 'categoria', 'signature_date',
    'validity_period', 'end_date', 'renewal_notice_date',
]);

export const updateParceria = onCall<UpdateParceriaRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const { id, organizationId, changes } = request.data || ({} as UpdateParceriaRequest);
        if (!id || !organizationId || !changes) {
            throw new HttpsError('invalid-argument', 'Campos obrigatórios faltando');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // 1. Verify membership
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Você não é membro desta organização');
        }

        // 2. Read existing
        const parceriaRef = db.collection('parcerias').doc(id);
        const parceriaSnap = await parceriaRef.get();
        if (!parceriaSnap.exists) {
            throw new HttpsError('not-found', 'Parceria não encontrada');
        }
        const parceriaData = parceriaSnap.data() || {};
        if (parceriaData.organization_id !== organizationId) {
            throw new HttpsError('permission-denied', 'Parceria pertence a outra organização');
        }

        // 3. Sanitize changes — bloquear campos reservados que só Cloud
        // Functions (específicas) podem mexer.
        delete changes.id;
        delete changes.organization_id;
        delete changes.created_at;
        delete changes.created_by;
        delete changes.activity_log;
        delete changes.aditivo_count;       // só addAditivo pode mexer
        delete changes.current_additive_id; // só addAditivo pode mexer
        delete changes.anonymized;          // só runAnonymization
        delete changes.anonymized_at;
        // Campos descontinuados (PR #70) — silenciosamente ignorados se vierem
        // de chamadas legadas. NÃO removemos os campos do Firestore (dados
        // legados permanecem consultáveis via aliases).
        delete changes.pgea_date;
        delete changes.access_restriction;
        delete changes.review_return_date;
        delete changes.anonymized_by;

        // Item 6: se a vigência é Indeterminada, end_date DEVE ser null.
        const mergedValidity = (typeof changes.validity_period === 'string'
            ? changes.validity_period
            : parceriaData.validity_period) || '';
        const isIndeterminate = typeof mergedValidity === 'string'
            && mergedValidity.toLowerCase().trim().startsWith('indeterm');
        if (isIndeterminate && 'end_date' in changes && changes.end_date) {
            throw new HttpsError(
                'failed-precondition',
                'Não é possível definir Termo Final com vigência Indeterminada.'
            );
        }

        // Se a Parceria tem aditivo, bloquear edição dos campos do original.
        if ((parceriaData.aditivo_count || 0) > 0) {
            for (const field of FROZEN_WHEN_HAS_ADITIVO) {
                if (field in changes) {
                    throw new HttpsError(
                        'failed-precondition',
                        `O campo "${field}" está congelado porque a Parceria possui ${parceriaData.aditivo_count} aditivo(s). Edite o aditivo corrente.`
                    );
                }
            }
        }

        // Sanitizar responsible_user_name (mesma razão de processos/expedientes).
        if (typeof changes.responsible_user_name === 'string') {
            changes.responsible_user_name = formatPersonName(changes.responsible_user_name);
        }

        const todayStr = new Date().toISOString().split('T')[0];

        // (3.1) Data de DISTRIBUIÇÃO é registrada automaticamente sempre que um
        // assessor é atribuído/alterado — em qualquer fase — a menos que já
        // venha explicitamente nos changes. NÃO define responsibility_date aqui:
        // "entrar em análise" é uma transição própria (que envia responsibility_date).
        if (
            changes.responsible_user_id &&
            changes.responsible_user_id !== parceriaData.responsible_user_id &&
            !changes.distribution_date
        ) {
            changes.distribution_date = todayStr;
        }

        // Datas automáticas por fase-alvo (espelha o fluxo do Kanban). Só são
        // injetadas quando a transição é explícita (changes.status) e o campo
        // ainda não existe, para não sobrescrever em re-salvamentos.
        const autoDateByPhase: Record<string, string> = {
            'Em análise': 'distribution_date',
            'Em revisão': 'review_start_date',
            'Revisadas': 'reviewed_date',
            'Aguarda Terceiros': 'third_party_referral_date',
            'Parcerias': 'third_party_return_date',
            'Extintos': 'archived_date',
        };
        const targetPhase = changes.status;
        if (targetPhase && autoDateByPhase[targetPhase]) {
            const field = autoDateByPhase[targetPhase];
            const already = changes[field] ?? parceriaData[field];
            if (!already) changes[field] = todayStr;
        }

        // Normalizar flags boolean/strings → boolean.
        if ('urgency_request' in changes) {
            const v = changes.urgency_request;
            if (v === true) changes.urgency_request = true;
            else if (v === false) changes.urgency_request = false;
            else if (typeof v === 'string') {
                const s = v.toLowerCase().trim();
                changes.urgency_request = (s === 'sim' || s === 'true' || s === '1' || s === 'yes');
            } else {
                delete changes.urgency_request;
            }
        }
        // access_restriction removido no PR #70 — silenciosamente ignorado se vier.
        if ('access_restriction' in changes) {
            delete changes.access_restriction;
        }

        changes.updated_at = admin.firestore.FieldValue.serverTimestamp();
        changes.updated_by = userId;

        // 4. Recalcular status
        const merged: Record<string, unknown> = { ...parceriaData, ...changes };
        const statusInChanges = changes.status;
        const currentStatus = parceriaData.status;

        let nextStatus: string | undefined;
        if (statusInChanges && statusInChanges !== currentStatus) {
            // Respeitar override manual — mas validar a transição.
            validateParceriaPhaseTransition(merged, statusInChanges);
            nextStatus = statusInChanges;
        } else {
            const computed = calculateParceriaStatus(merged);
            if (computed && computed !== currentStatus) {
                validateParceriaPhaseTransition(merged, computed);
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

        const fieldLabels: Record<string, string> = {
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
            distribution_date: 'Data de Distribuição',
            review_start_date: 'Data de Início da Revisão',
            network_folder: 'Pasta na Rede',
            observations: 'Observações',
            reviewed_date: 'Data de Conclusão da Revisão',
            review_conclusion_date: 'Data de Conclusão da Revisão',
            third_party_referral_date: 'Data da Remessa a Terceiros',
            third_party_return_date: 'Data de Retorno de Terceiros',
            third_party: 'Remetido para',
            publication_date: 'Publicação no DEMP',
            demp: 'Publicação no DEMP',
            archived_date: 'Data de Arquivamento',
            extinguished: 'Extinção',
            status: 'Status',
        };

        const changedFields = Object.keys(changes)
            .filter((k) => !['updated_at', 'updated_by'].includes(k))
            .map((k) => fieldLabels[k] || k);

        let actionDesc = '';
        if (changedFields.length === 1 && changes.status && changes.status !== currentStatus) {
            actionDesc = `Status alterado de "${currentStatus || 'Pendente'}" para "${changes.status}"`;
        } else if (changedFields.length > 0) {
            actionDesc = `Campos atualizados: ${changedFields.join(', ')}`;
        } else {
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
            await parceriaRef.collection('history').doc(historyEntryId(logEntry)).set({
                ...logEntry,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        } catch (histErr) {
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
            await fireOrgWebhook(organizationId, 'parceria_extinguished', {
                entity_type: 'parceria',
                entity_id: id,
                pgea: parceriaData.pgea,
            });
        }

        return { success: true, status: nextStatus || currentStatus };
    }
);
