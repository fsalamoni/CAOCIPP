import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { EntityTypeDef, FieldDef, validateRecordValues } from './schema';
import { evaluatePhaseTransition } from './transitions';
import { historyEntryId } from '../shared/history';

const REGION = 'southamerica-east1';

async function getMembership(db: FirebaseFirestore.Firestore, userId: string, organizationId: string) {
    const snap = await db.collection('userOrganizations').doc(`${userId}_${organizationId}`).get();
    if (!snap.exists) {
        throw new HttpsError('permission-denied', 'Você não é membro desta organização.');
    }
    return snap.data() || {};
}

async function getEntityType(db: FirebaseFirestore.Firestore, organizationId: string, entityTypeId: string): Promise<EntityTypeDef & { id: string }> {
    const snap = await db.collection('entityTypes').doc(entityTypeId).get();
    if (!snap.exists) throw new HttpsError('not-found', 'Tipo de registro não encontrado.');
    const data = snap.data() as any;
    if (data.organization_id !== organizationId) {
        throw new HttpsError('permission-denied', 'Tipo não pertence a esta organização.');
    }
    return { id: snap.id, ...data };
}

function initialPhase(def: EntityTypeDef): string {
    const init = (def.phases || []).find((p) => p.is_initial) || (def.phases || [])[0];
    return init?.key || '';
}

/** Conjunto de fases já alcançadas até `phaseKey` (por ordem). Usado para só
 *  exigir colunas obrigatórias das fases que o registro já atingiu. */
function phasesReachedUpTo(def: EntityTypeDef, phaseKey: string): Set<string> {
    const phases = (def.phases || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const cur = phases.find((p) => p.key === phaseKey);
    const curOrder = cur?.order ?? 0;
    return new Set(phases.filter((p) => (p.order ?? 0) <= curOrder).map((p) => p.key));
}

function nowParts() {
    const now = new Date();
    return {
        now,
        logDate: now.toISOString().split('T')[0],
        logTime: now.toTimeString().split(' ')[0],
        iso: now.toISOString(),
    };
}

async function writeHistory(ref: FirebaseFirestore.DocumentReference, entry: any) {
    try {
        await ref.collection('history').doc(historyEntryId(entry)).set({
            ...entry,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (err) {
        console.error('[customRecords history dual-write]', ref.id, err);
    }
}

// ---------------------------------------------------------------------------
// createRecord
// ---------------------------------------------------------------------------
interface CreateRecordRequest {
    organizationId: string;
    entityTypeId: string;
    values: Record<string, unknown>;
    phase?: string;
}

export const createRecord = onCall<CreateRecordRequest>(
    { region: REGION },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
        const userId = request.auth.uid;
        const { organizationId, entityTypeId, values, phase } = request.data || ({} as CreateRecordRequest);
        if (!organizationId || !entityTypeId) {
            throw new HttpsError('invalid-argument', 'organizationId e entityTypeId são obrigatórios.');
        }

        const db = admin.firestore();
        await getMembership(db, userId, organizationId);
        const def = await getEntityType(db, organizationId, entityTypeId);

        let targetPhase = initialPhase(def);
        if (phase && (def.phases || []).some((p) => p.key === phase)) {
            targetPhase = phase;
        }

        // Só exige colunas obrigatórias das fases já alcançadas (a fase inicial,
        // por padrão). Colunas de fases posteriores são cobradas ao avançar.
        const requiredPhases = phasesReachedUpTo(def, targetPhase);
        const { ok, errors, normalized } = validateRecordValues(def.fields as FieldDef[], values || {}, { requiredPhases });
        if (!ok) {
            throw new HttpsError('invalid-argument', Object.values(errors)[0] || 'Dados inválidos.', { errors });
        }

        const ref = db.collection('customRecords').doc();
        const { logDate, logTime, iso } = nowParts();
        const userName = request.auth.token.name || 'Usuário desconhecido';

        const entry = {
            date: logDate, time: logTime, user_id: userId, user_name: userName,
            action: `${def.label_singular} criado`, timestamp: iso,
        };

        const recordData: any = {
            id: ref.id,
            organization_id: organizationId,
            entity_type_id: entityTypeId,
            entity_key: def.key || null,
            values: normalized,
            phase: targetPhase,
            created_by: userId,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: userId,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            activity_log: [entry],
        };

        await ref.set(recordData);
        await writeHistory(ref, entry);

        // Contadores por tipo no doc do órgão (best-effort).
        try {
            await db.collection('organizations').doc(organizationId).update({
                [`stats.custom_records.${entityTypeId}`]: admin.firestore.FieldValue.increment(1),
            });
        } catch (e) {
            console.error('[customRecords stats inc]', e);
        }

        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: 'CREATE_RECORD',
            details: { entity_type_id: entityTypeId, record_id: ref.id },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, recordId: ref.id };
    }
);

// ---------------------------------------------------------------------------
// updateRecord
// ---------------------------------------------------------------------------
interface UpdateRecordRequest {
    organizationId: string;
    recordId: string;
    values?: Record<string, unknown>;
    phase?: string;
    comment?: string;
}

export const updateRecord = onCall<UpdateRecordRequest>(
    { region: REGION },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
        const userId = request.auth.uid;
        const { organizationId, recordId, values, phase, comment } = request.data || ({} as UpdateRecordRequest);
        if (!organizationId || !recordId) {
            throw new HttpsError('invalid-argument', 'organizationId e recordId são obrigatórios.');
        }

        const db = admin.firestore();
        const membership = await getMembership(db, userId, organizationId);
        const userRole = String(membership.role || 'member');

        const ref = db.collection('customRecords').doc(recordId);
        const snap = await ref.get();
        if (!snap.exists) throw new HttpsError('not-found', 'Registro não encontrado.');
        const current = snap.data() as any;
        if (current.organization_id !== organizationId) {
            throw new HttpsError('permission-denied', 'Registro não pertence a esta organização.');
        }

        const def = await getEntityType(db, organizationId, current.entity_type_id);

        const updates: any = {
            updated_by: userId,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };
        const logActions: string[] = [];

        // Merge de valores (validação parcial dos campos enviados).
        let mergedValues = { ...(current.values || {}) };
        if (values && typeof values === 'object') {
            const { ok, errors, normalized } = validateRecordValues(def.fields as FieldDef[], values, { partial: true });
            if (!ok) {
                throw new HttpsError('invalid-argument', Object.values(errors)[0] || 'Dados inválidos.', { errors });
            }
            mergedValues = { ...mergedValues, ...normalized };
            updates.values = mergedValues;
            logActions.push('Dados atualizados');
        }

        // Mudança de fase (avalia regras de transição com os valores resultantes).
        if (phase && phase !== current.phase) {
            const evalRes = evaluatePhaseTransition(
                def, current.phase || '', phase, mergedValues,
                { userId, userRole }
            );
            if (!evalRes.allowed) {
                throw new HttpsError('failed-precondition', evalRes.reason || 'Transição não permitida.');
            }
            if (evalRes.rule?.on_success?.require_comment && !String(comment || '').trim()) {
                throw new HttpsError('failed-precondition', 'Esta mudança exige um comentário.');
            }
            // Aplica set_fields automáticos da regra.
            if (evalRes.rule?.on_success?.set_fields?.length) {
                for (const sf of evalRes.rule.on_success.set_fields) {
                    const v = sf.value === 'now' ? new Date().toISOString().slice(0, 10) : sf.value;
                    mergedValues[sf.field] = v;
                }
                updates.values = mergedValues;
            }
            updates.phase = phase;
            const fromLabel = (def.phases || []).find((p) => p.key === current.phase)?.label || current.phase || '—';
            const toLabel = (def.phases || []).find((p) => p.key === phase)?.label || phase;
            logActions.push(`Fase: ${fromLabel} → ${toLabel}${comment ? ` (${comment})` : ''}`);
        }

        if (logActions.length === 0) {
            return { success: true, message: 'Nenhuma alteração.' };
        }

        const { logDate, logTime, iso } = nowParts();
        const userName = request.auth.token.name || 'Usuário desconhecido';
        const entry = {
            date: logDate, time: logTime, user_id: userId, user_name: userName,
            action: logActions.join(' · '), timestamp: iso,
        };
        updates.activity_log = admin.firestore.FieldValue.arrayUnion(entry);

        await ref.update(updates);
        await writeHistory(ref, entry);

        return { success: true };
    }
);

// ---------------------------------------------------------------------------
// importRecords — criação em lote a partir de planilha (já mapeada no cliente)
// ---------------------------------------------------------------------------
interface ImportRecordRow {
    values: Record<string, unknown>;
    phase?: string;
}
interface ImportRecordsRequest {
    organizationId: string;
    entityTypeId: string;
    rows: ImportRecordRow[];
}

const IMPORT_MAX_ROWS = 5000;
const IMPORT_BATCH_SIZE = 400;

export const importRecords = onCall<ImportRecordsRequest>(
    { region: REGION, timeoutSeconds: 540, memory: '512MiB' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
        const userId = request.auth.uid;
        const { organizationId, entityTypeId, rows } = request.data || ({} as ImportRecordsRequest);
        if (!organizationId || !entityTypeId) {
            throw new HttpsError('invalid-argument', 'organizationId e entityTypeId são obrigatórios.');
        }
        if (!Array.isArray(rows) || rows.length === 0) {
            throw new HttpsError('invalid-argument', 'Nenhuma linha para importar.');
        }
        if (rows.length > IMPORT_MAX_ROWS) {
            throw new HttpsError('invalid-argument', `Máximo de ${IMPORT_MAX_ROWS} linhas por importação.`);
        }

        const db = admin.firestore();
        await getMembership(db, userId, organizationId);
        const def = await getEntityType(db, organizationId, entityTypeId);

        const fallbackPhase = initialPhase(def);
        const phaseKeys = new Set((def.phases || []).map((p) => p.key));
        const userName = request.auth.token.name || 'Usuário desconhecido';
        const { logDate, logTime, iso } = nowParts();

        // Valida e normaliza cada linha antes de gravar.
        const valid: { values: Record<string, unknown>; phase: string }[] = [];
        const errorDetails: { row: number; error: string }[] = [];
        rows.forEach((row, i) => {
            const phase = row?.phase && phaseKeys.has(row.phase) ? row.phase : fallbackPhase;
            const requiredPhases = phasesReachedUpTo(def, phase);
            const { ok, errors, normalized } = validateRecordValues(def.fields as FieldDef[], (row?.values) || {}, { requiredPhases });
            if (!ok) {
                errorDetails.push({ row: i + 1, error: Object.values(errors)[0] || 'Dados inválidos.' });
                return;
            }
            valid.push({ values: normalized, phase });
        });

        if (valid.length === 0) {
            return { success: false, created: 0, failed: errorDetails.length, total: rows.length, errorDetails: errorDetails.slice(0, 20) };
        }

        // Grava em lotes (Firestore: máx. 500 operações por batch).
        let created = 0;
        for (let i = 0; i < valid.length; i += IMPORT_BATCH_SIZE) {
            const slice = valid.slice(i, i + IMPORT_BATCH_SIZE);
            const batch = db.batch();
            for (const item of slice) {
                const ref = db.collection('customRecords').doc();
                const entry = {
                    date: logDate, time: logTime, user_id: userId, user_name: userName,
                    action: `${def.label_singular} importado de planilha`, timestamp: iso,
                };
                batch.set(ref, {
                    id: ref.id,
                    organization_id: organizationId,
                    entity_type_id: entityTypeId,
                    entity_key: def.key || null,
                    values: item.values,
                    phase: item.phase,
                    created_by: userId,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_by: userId,
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    activity_log: [entry],
                    imported: true,
                });
            }
            await batch.commit();
            created += slice.length;
        }

        // Atualiza contador do tipo no doc do órgão (best-effort).
        try {
            await db.collection('organizations').doc(organizationId).update({
                [`stats.custom_records.${entityTypeId}`]: admin.firestore.FieldValue.increment(created),
            });
        } catch (e) {
            console.error('[importRecords stats inc]', e);
        }

        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: 'IMPORT_RECORDS',
            details: { entity_type_id: entityTypeId, created, failed: errorDetails.length, total: rows.length },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
            success: true,
            created,
            failed: errorDetails.length,
            total: rows.length,
            errorDetails: errorDetails.slice(0, 20),
        };
    }
);

// ---------------------------------------------------------------------------
// deleteRecord
// ---------------------------------------------------------------------------
interface DeleteRecordRequest {
    organizationId: string;
    recordId: string;
}

export const deleteRecord = onCall<DeleteRecordRequest>(
    { region: REGION },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
        const userId = request.auth.uid;
        const { organizationId, recordId } = request.data || ({} as DeleteRecordRequest);
        if (!organizationId || !recordId) {
            throw new HttpsError('invalid-argument', 'organizationId e recordId são obrigatórios.');
        }

        const db = admin.firestore();
        const membership = await getMembership(db, userId, organizationId);
        const role = String(membership.role || 'member');
        if (role !== 'creator' && role !== 'admin') {
            throw new HttpsError('permission-denied', 'Apenas Criador ou Administradores podem excluir registros.');
        }

        const ref = db.collection('customRecords').doc(recordId);
        const snap = await ref.get();
        if (!snap.exists) return { success: true, message: 'Registro já removido.' };
        const current = snap.data() as any;
        if (current.organization_id !== organizationId) {
            throw new HttpsError('permission-denied', 'Registro não pertence a esta organização.');
        }
        const entityTypeId = current.entity_type_id;

        await ref.delete();

        try {
            await db.collection('organizations').doc(organizationId).update({
                [`stats.custom_records.${entityTypeId}`]: admin.firestore.FieldValue.increment(-1),
            });
        } catch (e) {
            console.error('[customRecords stats dec]', e);
        }

        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: 'DELETE_RECORD',
            details: { entity_type_id: entityTypeId, record_id: recordId },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true };
    }
);
