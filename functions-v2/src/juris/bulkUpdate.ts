import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { historyEntryId } from '../shared/history';
import {
    resolveJurimetriaSettings,
    sanitizeJuriInput,
    JurimetriaSettings,
    JuriDateHistoryEntry,
} from '../shared/jurimetria';

interface BulkUpdateJurisRequest {
    organizationId: string;
    ids: string[];
    /**
     * Campos a aplicar em todos os selecionados. Aceita os campos fixos
     * (exceto `numero_processo`, que é a chave natural de cada registro),
     * `responsible_user_id`/`responsible_user_name` e `values.<coluna>`.
     */
    data: Record<string, unknown>;
}

const MAX_BULK_UPDATE = 500;
const BATCH_SIZE = 200;

/** Campos fixos que podem ser aplicados em massa. */
const BULK_ALLOWED_CORE = [
    'data_juri', 'comarca', 'tipo', 'resultado', 'promotor',
    'horario_inicio', 'horario', 'vara', 'observacoes',
];

const FIELD_LABELS: Record<string, string> = {
    data_juri: 'Data do júri',
    comarca: 'Comarca',
    tipo: 'Matéria / Tipo',
    resultado: 'Espécie de resultado',
    promotor: 'Promotor(a)',
    horario_inicio: 'Horário de início',
    horario: 'Horário de conclusão',
    vara: 'Vara / Órgão julgador',
    observacoes: 'Observações',
    responsible_user_id: 'Responsável',
};

/**
 * Aplica a MESMA alteração a vários júris de uma vez: atribuir um responsável
 * do órgão, padronizar a comarca/matéria/espécie de um conjunto de registros,
 * ou preencher uma coluna personalizada. Cada registro recebe sua própria
 * entrada de histórico.
 */
export const bulkUpdateJuris = onCall<BulkUpdateJurisRequest>(
    { region: 'southamerica-east1', timeoutSeconds: 300 },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const { organizationId, ids, data } = request.data || ({} as BulkUpdateJurisRequest);
        const targetIds = [...new Set(
            (Array.isArray(ids) ? ids : []).map((x) => String(x || '').trim()).filter(Boolean)
        )];

        if (!organizationId || targetIds.length === 0) {
            throw new HttpsError('invalid-argument', 'organizationId e ids são obrigatórios');
        }
        if (targetIds.length > MAX_BULK_UPDATE) {
            throw new HttpsError(
                'invalid-argument',
                `Selecione no máximo ${MAX_BULK_UPDATE} júris por vez (recebidos: ${targetIds.length}).`
            );
        }

        const incoming = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
        if (Object.keys(incoming).length === 0) {
            throw new HttpsError('invalid-argument', 'Informe ao menos um campo para atualizar');
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
        const settings: JurimetriaSettings = resolveJurimetriaSettings(orgSnap.data());

        // 1. Normaliza os valores UMA vez (valem para todos os selecionados).
        const { core, values } = sanitizeJuriInput(incoming, settings);

        const coreUpdates: Record<string, unknown> = {};
        const changedLabels: string[] = [];
        for (const key of BULK_ALLOWED_CORE) {
            if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue;
            if (key === 'data_juri' && !core.data_juri) {
                throw new HttpsError('invalid-argument', 'A data do júri informada é inválida');
            }
            coreUpdates[key] = core[key];
            changedLabels.push(FIELD_LABELS[key] || key);
        }

        // 2. Responsável: precisa ser membro do órgão (ou nulo, para desatribuir).
        let responsibleTouched = false;
        let responsibleUserId: string | null = null;
        let responsibleUserName: string | null = null;
        if (Object.prototype.hasOwnProperty.call(incoming, 'responsible_user_id')) {
            responsibleTouched = true;
            responsibleUserId = String(incoming.responsible_user_id ?? '').trim() || null;
            responsibleUserName = String(incoming.responsible_user_name ?? '').trim().slice(0, 160) || null;
            if (responsibleUserId) {
                const respSnap = await db
                    .collection('userOrganizations')
                    .doc(`${responsibleUserId}_${organizationId}`)
                    .get();
                if (!respSnap.exists) {
                    throw new HttpsError('invalid-argument', 'O responsável indicado não é membro deste órgão');
                }
                if (!responsibleUserName) {
                    responsibleUserName = String(respSnap.data()?.user_name || '') || null;
                }
            } else if (settings.requireResponsible) {
                throw new HttpsError('invalid-argument', 'Este órgão exige um responsável para cada júri');
            }
            changedLabels.push(FIELD_LABELS.responsible_user_id);
        }

        // 3. Colunas personalizadas: só as chaves realmente enviadas.
        const customUpdates: Record<string, unknown> = {};
        const rawValues = (incoming.values && typeof incoming.values === 'object'
            ? incoming.values
            : {}) as Record<string, unknown>;
        for (const key of Object.keys(rawValues)) {
            const field = settings.customFields.find((f) => f.key === key);
            if (!field) continue;
            customUpdates[key] = values[key];
            changedLabels.push(field.label);
        }

        if (changedLabels.length === 0) {
            throw new HttpsError('invalid-argument', 'Nenhum campo válido foi informado');
        }

        const now = new Date();
        const userName = request.auth.token.name || 'Usuário desconhecido';
        // Correção de data em massa continua sendo uma mudança de data: cada
        // júri afetado recebe sua própria entrada no histórico de datas, com a
        // justificativa informada (se houver).
        const bulkJustificativa = String(incoming.justificativa ?? '').trim().slice(0, 1000);
        const logEntry = {
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().split(' ')[0],
            user_id: userId,
            user_name: userName,
            action: `Atualização em massa — ${[...new Set(changedLabels)].join(', ')}`,
            timestamp: now.toISOString(),
        };

        let updated = 0;
        let skipped = 0;

        for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
            const chunk = targetIds.slice(i, i + BATCH_SIZE);
            const refs = chunk.map((juriId) => db.collection('juris').doc(juriId));
            const snaps = await db.getAll(...refs);

            const batch = db.batch();
            let batchCount = 0;

            snaps.forEach((snap) => {
                // IDOR: ignora silenciosamente o que não é deste órgão.
                if (!snap.exists || snap.data()?.organization_id !== organizationId) {
                    skipped += 1;
                    return;
                }
                const current = snap.data() || {};
                const update: Record<string, unknown> = { ...coreUpdates };

                if (responsibleTouched) {
                    update.responsible_user_id = responsibleUserId;
                    update.responsible_user_name = responsibleUserName;
                }
                if (Object.keys(customUpdates).length > 0) {
                    update.values = { ...(current.values || {}), ...customUpdates };
                }

                const novaData = coreUpdates.data_juri as string | undefined;
                if (novaData !== undefined && novaData !== (current.data_juri || '')) {
                    const dateEntry: JuriDateHistoryEntry = {
                        from: String(current.data_juri || ''),
                        to: novaData,
                        realizacao: String(current.realizacao || 'realizado') as JuriDateHistoryEntry['realizacao'],
                        justificativa: bulkJustificativa || 'Correção de data em massa',
                        user_id: userId,
                        user_name: userName,
                        changed_at: now.toISOString(),
                    };
                    update.date_history = admin.firestore.FieldValue.arrayUnion(dateEntry);
                }

                update.updated_at = admin.firestore.FieldValue.serverTimestamp();
                update.updated_by = userId;
                update.activity_log = admin.firestore.FieldValue.arrayUnion(logEntry);

                batch.update(snap.ref, update);
                batchCount += 1;
                updated += 1;
            });

            if (batchCount > 0) await batch.commit();

            // Espelho do histórico (best-effort, nunca falha a operação).
            try {
                const histBatch = db.batch();
                snaps.forEach((snap) => {
                    if (!snap.exists || snap.data()?.organization_id !== organizationId) return;
                    histBatch.set(
                        snap.ref.collection('history').doc(historyEntryId(logEntry)),
                        { ...logEntry, created_at: admin.firestore.FieldValue.serverTimestamp() }
                    );
                });
                await histBatch.commit();
            } catch (histErr) {
                console.error('[history dual-write] juris bulkUpdate', histErr);
            }
        }

        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: userName,
            action: 'BULK_UPDATE_JURI',
            details: { updated, skipped, fields: [...new Set(changedLabels)] },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, updated, skipped };
    }
);
