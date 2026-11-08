"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaPlataforma = void 0;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const delete_1 = require("../organizations/delete");
const context_1 = require("./context");
const config_1 = require("./config");
exports.secretariaPlataforma = (0, https_1.onCall)({ region: context_1.REGION }, async (request) => {
    if (!(await (0, delete_1.isPlatformAdmin)(request)))
        throw new https_1.HttpsError('permission-denied', 'Apenas a administração da plataforma');
    const db = admin.firestore();
    const p = request.data || {};
    if (p.action === 'resumo') {
        const orgs = await db.collection('organizations').where('secretariaConfig.enabled', '==', true).limit(300).get();
        const linhas = await Promise.all(orgs.docs.map(async (o) => {
            var _a, _b, _c, _d;
            const base = db.collection(context_1.COL.processos).where('organization_id', '==', o.id);
            const [total, ativos, unidades] = await Promise.all([
                base.count().get(),
                base.where('status', '==', 'em_tramitacao').count().get(),
                db.collection(context_1.COL.unidades).where('organization_id', '==', o.id).count().get(),
            ]);
            const cfg = o.data().secretariaConfig || {};
            return {
                id: o.id,
                nome: String(o.data().name || o.id),
                processos: total.data().count,
                em_tramitacao: ativos.data().count,
                unidades: unidades.data().count,
                suspensa: cfg.suspensa_plataforma === true,
                motivo_suspensao: cfg.motivo_suspensao || '',
                ativada_em: ((_d = (_c = (_b = (_a = cfg.updated_at) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString) === null || _d === void 0 ? void 0 : _d.call(_c)) || null,
            };
        }));
        return { orgs: linhas.sort((a, b) => b.processos - a.processos) };
    }
    if (p.action === 'suspender') {
        const orgId = String(p.organizationId || '');
        const ref = db.collection('organizations').doc(orgId);
        if (!orgId || !(await ref.get()).exists)
            throw new https_1.HttpsError('not-found', 'Órgão não encontrado');
        const suspensa = p.suspensa === true;
        const motivo = (0, secretaria_1.texto)(p.motivo, 300);
        if (suspensa && !motivo)
            throw new https_1.HttpsError('invalid-argument', 'Informe o motivo da suspensão');
        await ref.update({
            'secretariaConfig.suspensa_plataforma': suspensa,
            'secretariaConfig.motivo_suspensao': suspensa ? motivo : firestore_1.FieldValue.delete(),
        });
        const auth = request.auth;
        await (0, config_1.auditar)(db, orgId, auth.uid, String(auth.token.name || auth.token.email || 'Plataforma'), suspensa ? 'SECRETARIA_SUSPENSA_PLATAFORMA' : 'SECRETARIA_REATIVADA_PLATAFORMA', { motivo });
        return { success: true, suspensa };
    }
    throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
});
//# sourceMappingURL=plataforma.js.map