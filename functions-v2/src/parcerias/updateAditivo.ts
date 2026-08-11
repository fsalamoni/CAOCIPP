import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { calculateParceriaStatus } from '../shared/status';
import { historyEntryId } from '../shared/history';
import { formatPersonName } from '../shared/normalization';
import { validateAditivoPhaseTransition } from '../shared/validators';

interface UpdateAditivoRequest {
    parceriaId: string;
    aditivoId: string;
    organizationId: string;
    changes: Record<string, any>;
}

const PROTECTED_ADITIVO_FIELDS = new Set([
    'id',
    'parceria_id',
    'organization_id',
    'aditivo_number',
    'aditivo_type',
    'aditivo_type_label',
    'pgea_at_additive_creation',
    'partnership_type_at_additive_creation',
    'partnership_number_at_additive_creation',
    'created_at',
    'created_by',
    'activity_log',
    'anonymized',
    'anonymized_at',
    'anonymized_by',
]);

export const updateAditivo = onCall<UpdateAditivoRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const data = request.data || ({} as UpdateAditivoRequest);
        const { parceriaId, aditivoId, organizationId, changes } = data;

        if (!parceriaId || !aditivoId || !organizationId || !changes) {
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

        // 2. Read parceria pai (para checar organization_id)
        const parceriaRef = db.collection('parcerias').doc(parceriaId);
        const parceriaSnap = await parceriaRef.get();
        if (!parceriaSnap.exists) {
            throw new HttpsError('not-found', 'Parceria não encontrada');
        }
        const parceriaData = parceriaSnap.data() || {};
        if (parceriaData.organization_id !== organizationId) {
            throw new HttpsError('permission-denied', 'Parceria pertence a outra organização');
        }

        // 3. Ler o aditivo
        const aditivoRef = parceriaRef.collection('aditivos').doc(aditivoId);
        const aditivoSnap = await aditivoRef.get();
        if (!aditivoSnap.exists) {
            throw new HttpsError('not-found', 'Aditivo não encontrado');
        }
        const aditivoData = aditivoSnap.data() || {};

        // 4. Sanitize changes
        for (const field of PROTECTED_ADITIVO_FIELDS) {
            delete changes[field];
        }

        const todayStr = new Date().toISOString().split('T')[0];

        // (3.1) Data de distribuição ao (re)atribuir assessor — em qualquer fase.
        if (
            changes.responsible_user_id &&
            changes.responsible_user_id !== aditivoData.responsible_user_id &&
            !changes.distribution_date
        ) {
            changes.distribution_date = todayStr;
        }

        // Datas automáticas por fase-alvo — o aditivo segue as MESMAS fases da
        // Parceria (item 2), então reaproveita o mesmo mapa de automações.
        const autoDateByPhase: Record<string, string> = {
            'Em análise': 'distribution_date',
            'Em revisão': 'review_start_date',
            'Revisadas': 'reviewed_date',
            'Aguarda Terceiros': 'third_party_referral_date',
            'Parcerias': 'third_party_return_date',
            'Extintos': 'archived_date',
        };
        if (changes.status && autoDateByPhase[changes.status]) {
            const f = autoDateByPhase[changes.status];
            const already = changes[f] ?? aditivoData[f];
            if (!already) changes[f] = todayStr;
        }

        if (typeof changes.responsible_user_name === 'string') {
            changes.responsible_user_name = formatPersonName(changes.responsible_user_name);
        }

        changes.updated_at = admin.firestore.FieldValue.serverTimestamp();
        changes.updated_by = userId;

        // 5. Recalcular status
        const merged: Record<string, unknown> = { ...aditivoData, ...changes };
        const statusInChanges = changes.status;
        const currentStatus = aditivoData.status;
        let nextStatus: string | undefined;

        if (statusInChanges && statusInChanges !== currentStatus) {
            validateAditivoPhaseTransition(merged, statusInChanges);
            nextStatus = statusInChanges;
        } else {
            const computed = calculateParceriaStatus(merged);
            if (computed && computed !== currentStatus) {
                validateAditivoPhaseTransition(merged, computed);
                nextStatus = computed;
            }
        }
        if (nextStatus) {
            changes.status = nextStatus;
        }

        // 6. Activity log
        const now = new Date();
        const logDate = now.toISOString().split('T')[0];
        const logTime = now.toTimeString().split(' ')[0];
        const userName = request.auth.token.name || 'Usuário desconhecido';

        const fieldLabels: Record<string, string> = {
            partnership_type: 'Tipo de Parceria',
            partnership_number: 'Número da Parceria',
            signature_date: 'Data da Assinatura',
            validity_period: 'Vigência',
            end_date: 'Termo Final',
            renewal_notice_date: 'Data do Aviso de Renovação',
            subject: 'Assunto',
            object: 'Objeto',
            parties: 'Partes',
            responsible_user_id: 'Assessor Responsável',
            responsible_user_name: 'Nome do Responsável',
            responsibility_date: 'Data de Responsabilidade',
            network_folder: 'Pasta na Rede',
            observations: 'Observações',
            review_conclusion_date: 'Data de Conclusão da Revisão',
            third_party: 'Terceiro',
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
            actionDesc = 'Aditivo atualizado';
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

        await aditivoRef.update(changes);

        // (Item 2) Espelha a FASE do aditivo corrente na Parceria pai, para que
        // o Kanban (que lê os docs de parceria) mostre a parceria na fase em que
        // o aditivo está. Só espelha quando este é o aditivo corrente e o status
        // mudou. Best-effort — não deve falhar a atualização do aditivo.
        if (nextStatus && parceriaData.current_additive_id === aditivoId) {
            try {
                await parceriaRef.update({
                    status: nextStatus,
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_by: userId,
                });
            } catch (mirrorErr) {
                console.error('[aditivo→parceria status mirror]', parceriaId, mirrorErr);
            }
        }

        // Dual-write do histórico do aditivo.
        try {
            await aditivoRef.collection('history').doc(historyEntryId(logEntry)).set({
                ...logEntry,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        } catch (histErr) {
            console.error('[history dual-write] aditivo update', aditivoId, histErr);
        }

        // 7. Audit log
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: userName,
            action: 'UPDATE_ADITIVO',
            details: {
                parceria_id: parceriaId,
                aditivo_id: aditivoId,
                changes: Object.keys(changes),
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, status: nextStatus || currentStatus };
    }
);
