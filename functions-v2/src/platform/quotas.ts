import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';
import { QUOTA_DEFS, QUOTA_BY_KEY, QuotaDef, limparCacheCotas } from '../shared/cotas';

/**
 * Cotas da plataforma. O catálogo e a leitura ficam em shared/cotas.ts; cada
 * cota é conferida no servidor (campo `onde`). Cotas antigas que eram só
 * informativas (tamanho de página, retenção de auditoria, histórico embutido,
 * ouvintes por sessão) saíram do catálogo: nada as aplicava.
 */

interface Uso { maior: number; quem: string | null }
interface QuotasResponse {
    quotas: Record<string, number>;
    definitions: QuotaDef[];
    uso: Record<string, Uso | null>;
    updatedAt: string | null;
    updatedBy: string | null;
}

/** Uso atual de cada cota, para o painel mostrar quão perto do limite está. */
async function usoAtual(db: admin.firestore.Firestore): Promise<Record<string, Uso | null>> {
    const vinculos = await db.collection('userOrganizations').limit(20000).get();
    const membros = new Map<string, number>();
    const criados = new Map<string, { n: number; nome: string }>();
    vinculos.forEach((d) => {
        const v = d.data();
        if (v.active === false) return;
        const org = String(v.organization_id || '');
        membros.set(org, (membros.get(org) || 0) + 1);
        if (v.role === 'creator') {
            const uid = String(v.user_id || '');
            const atual = criados.get(uid) || { n: 0, nome: String(v.user_name || v.user_email || '') };
            criados.set(uid, { ...atual, n: atual.n + 1 });
        }
    });
    const topo = <T>(m: Map<string, T>, n: (x: T) => number) => [...m.entries()].sort((a, b) => n(b[1]) - n(a[1]))[0];
    const orgTopo = topo(membros, (x) => x);
    let orgNome: string | null = null;
    if (orgTopo) orgNome = String((await db.collection('organizations').doc(orgTopo[0]).get()).data()?.name || orgTopo[0]);
    const criadorTopo = topo(criados, (x) => x.n);
    return {
        max_members_per_org: orgTopo ? { maior: orgTopo[1], quem: orgNome } : { maior: 0, quem: null },
        max_orgs_per_user: criadorTopo ? { maior: criadorTopo[1].n, quem: criadorTopo[1].nome || null } : { maior: 0, quem: null },
        max_import_rows: null,
    };
}

/** getPlatformQuotas - cotas atuais (com padrão) e uso. Apenas super-admin. */
export const getPlatformQuotas = onCall<void>(
    { region: REGION, timeoutSeconds: 120 },
    async (request): Promise<QuotasResponse> => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();
        const [snap, uso] = await Promise.all([db.collection('platformConfig').doc('quotas').get(), usoAtual(db)]);
        const stored = (snap.exists && snap.data()?.values) || {};
        const quotas: Record<string, number> = {};
        QUOTA_DEFS.forEach((def) => {
            const v = stored[def.key];
            quotas[def.key] = typeof v === 'number' ? v : def.default;
        });
        const data = snap.data() || {};
        return {
            quotas,
            definitions: QUOTA_DEFS,
            uso,
            updatedAt: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : null,
            updatedBy: data.updated_by || null,
        };
    }
);

interface SetQuotaRequest { quotaKey: string; value: number }

/** setPlatformQuota - define UMA cota. Super-admin, auditado. */
export const setPlatformQuota = onCall<SetQuotaRequest>(
    { region: REGION },
    async (request) => {
        const actor = await assertPlatformAdmin(request);
        const { quotaKey, value } = request.data || ({} as SetQuotaRequest);
        const def = QUOTA_BY_KEY[quotaKey];
        if (!def) throw new HttpsError('invalid-argument', 'Cota desconhecida.');
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new HttpsError('invalid-argument', 'Valor inválido.');
        const intValue = Math.round(value);
        if (intValue < def.min || intValue > def.max) {
            throw new HttpsError('invalid-argument', `Valor deve estar entre ${def.min} e ${def.max}.`);
        }
        await admin.firestore().collection('platformConfig').doc('quotas').set({
            values: { [quotaKey]: intValue },
            updated_at: FieldValue.serverTimestamp(),
            updated_by: actor.name,
            updated_by_uid: actor.uid,
        }, { merge: true });
        limparCacheCotas();
        await writePlatformAudit(actor.uid, actor.name, 'SET_PLATFORM_QUOTA', { quotaKey, value: intValue });
        return { success: true, quotaKey, value: intValue };
    }
);
