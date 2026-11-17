"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setPlatformQuota = exports.getPlatformQuotas = void 0;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const cotas_1 = require("../shared/cotas");
/** Uso atual de cada cota, para o painel mostrar quão perto do limite está. */
async function usoAtual(db) {
    var _a;
    const vinculos = await db.collection('userOrganizations').limit(20000).get();
    const membros = new Map();
    const criados = new Map();
    vinculos.forEach((d) => {
        const v = d.data();
        if (v.active === false)
            return;
        const org = String(v.organization_id || '');
        membros.set(org, (membros.get(org) || 0) + 1);
        if (v.role === 'creator') {
            const uid = String(v.user_id || '');
            const atual = criados.get(uid) || { n: 0, nome: String(v.user_name || v.user_email || '') };
            criados.set(uid, Object.assign(Object.assign({}, atual), { n: atual.n + 1 }));
        }
    });
    const topo = (m, n) => [...m.entries()].sort((a, b) => n(b[1]) - n(a[1]))[0];
    const orgTopo = topo(membros, (x) => x);
    let orgNome = null;
    if (orgTopo)
        orgNome = String(((_a = (await db.collection('organizations').doc(orgTopo[0]).get()).data()) === null || _a === void 0 ? void 0 : _a.name) || orgTopo[0]);
    const criadorTopo = topo(criados, (x) => x.n);
    return {
        max_members_per_org: orgTopo ? { maior: orgTopo[1], quem: orgNome } : { maior: 0, quem: null },
        max_orgs_per_user: criadorTopo ? { maior: criadorTopo[1].n, quem: criadorTopo[1].nome || null } : { maior: 0, quem: null },
        max_import_rows: null,
    };
}
/** getPlatformQuotas - cotas atuais (com padrão) e uso. Apenas super-admin. */
exports.getPlatformQuotas = (0, https_1.onCall)({ region: helpers_1.REGION, timeoutSeconds: 120 }, async (request) => {
    var _a, _b;
    await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const [snap, uso] = await Promise.all([db.collection('platformConfig').doc('quotas').get(), usoAtual(db)]);
    const stored = (snap.exists && ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.values)) || {};
    const quotas = {};
    cotas_1.QUOTA_DEFS.forEach((def) => {
        const v = stored[def.key];
        quotas[def.key] = typeof v === 'number' ? v : def.default;
    });
    const data = snap.data() || {};
    return {
        quotas,
        definitions: cotas_1.QUOTA_DEFS,
        uso,
        updatedAt: ((_b = data.updated_at) === null || _b === void 0 ? void 0 : _b.toDate) ? data.updated_at.toDate().toISOString() : null,
        updatedBy: data.updated_by || null,
    };
});
/** setPlatformQuota - define UMA cota. Super-admin, auditado. */
exports.setPlatformQuota = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    const actor = await (0, helpers_1.assertPlatformAdmin)(request);
    const { quotaKey, value } = request.data || {};
    const def = cotas_1.QUOTA_BY_KEY[quotaKey];
    if (!def)
        throw new https_1.HttpsError('invalid-argument', 'Cota desconhecida.');
    if (typeof value !== 'number' || !Number.isFinite(value))
        throw new https_1.HttpsError('invalid-argument', 'Valor inválido.');
    const intValue = Math.round(value);
    if (intValue < def.min || intValue > def.max) {
        throw new https_1.HttpsError('invalid-argument', `Valor deve estar entre ${def.min} e ${def.max}.`);
    }
    await admin.firestore().collection('platformConfig').doc('quotas').set({
        values: { [quotaKey]: intValue },
        updated_at: firestore_1.FieldValue.serverTimestamp(),
        updated_by: actor.name,
        updated_by_uid: actor.uid,
    }, { merge: true });
    (0, cotas_1.limparCacheCotas)();
    await (0, helpers_1.writePlatformAudit)(actor.uid, actor.name, 'SET_PLATFORM_QUOTA', { quotaKey, value: intValue });
    return { success: true, quotaKey, value: intValue };
});
//# sourceMappingURL=quotas.js.map