"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformUser = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const vinculo_1 = require("../shared/vinculo");
const iso = (v) => v && typeof v.toDate === 'function'
    ? v.toDate().toISOString()
    : typeof v === 'string' && v ? v : null;
/** Dados do Auth em lotes de 100 (limite do getUsers). */
async function contasDoAuth(uids) {
    const mapa = new Map();
    for (let i = 0; i < uids.length; i += 100) {
        const r = await admin.auth().getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
        r.users.forEach((u) => mapa.set(u.uid, u));
    }
    return mapa;
}
const provedor = (u) => ((u === null || u === void 0 ? void 0 : u.providerData) || []).map((p) => p.providerId === 'google.com' ? 'Google' : p.providerId === 'password' ? 'E-mail e senha' : p.providerId);
async function marcarVinculos(db, uid, motivo) {
    const snap = await db.collection('userOrganizations').where('user_id', '==', uid).get();
    const apagar = firestore_1.FieldValue.delete();
    const campos = motivo !== null ? { user_blocked: true, user_blocked_motivo: motivo } : { user_blocked: apagar, user_blocked_motivo: apagar };
    for (let i = 0; i < snap.docs.length; i += 450) {
        const lote = db.batch();
        snap.docs.slice(i, i + 450).forEach((d) => lote.update(d.ref, campos));
        await lote.commit();
    }
    return snap.size;
}
exports.platformUser = (0, https_1.onCall)({ region: helpers_1.REGION, timeoutSeconds: 120 }, async (request) => {
    var _a, _b, _c, _d;
    const ator = await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const p = request.data || {};
    if (p.action === 'listar') {
        const [vinculos, perfis, admins, bloqueios] = await Promise.all([
            db.collection('userOrganizations').limit(20000).get(),
            db.collection('users').orderBy('platform_name').limit(10000).get(),
            db.collection('platformAdmins').get(),
            db.collection(vinculo_1.BLOQUEIOS).where('ativa', '==', true).get(),
        ]);
        const pessoas = new Map();
        const pessoa = (uid) => {
            if (!pessoas.has(uid))
                pessoas.set(uid, { nome: '', email: '', orgs: new Set(), ativos: 0, papeis: new Set(), perfil: false });
            return pessoas.get(uid);
        };
        vinculos.forEach((d) => {
            const v = d.data();
            const uid = String(v.user_id || '');
            if (!uid)
                return;
            const x = pessoa(uid);
            x.nome = x.nome || String(v.user_name || '');
            x.email = x.email || String(v.user_email || '');
            x.orgs.add(String(v.organization_id || ''));
            if (v.active !== false) {
                x.ativos += 1;
                x.papeis.add(String(v.role || 'member'));
            }
        });
        perfis.forEach((d) => {
            const u = d.data();
            const x = pessoa(d.id);
            x.perfil = true;
            x.nome = String(u.full_name || u.platform_name || '') || x.nome;
            x.email = String(u.email || '') || x.email;
        });
        const adminsAtivos = new Set(admins.docs.filter((d) => d.data().active === true).map((d) => d.id));
        adminsAtivos.forEach((uid) => pessoa(uid));
        // Perfil de quem tem vínculo mas não tem platform_name (contas antigas):
        // nome e e-mail do perfil valem mais que a cópia no vínculo.
        const semPerfil = [...pessoas.entries()].filter(([, x]) => !x.perfil).map(([uid]) => uid);
        for (let i = 0; i < semPerfil.length; i += 300) {
            const docs = await db.getAll(...semPerfil.slice(i, i + 300).map((uid) => db.collection('users').doc(uid)));
            docs.filter((d) => d.exists).forEach((d) => {
                const u = d.data() || {};
                const x = pessoa(d.id);
                x.nome = String(u.full_name || u.platform_name || '') || x.nome;
                x.email = String(u.email || '') || x.email;
            });
        }
        const bloqueados = new Set(bloqueios.docs.map((d) => d.id));
        const auth = await contasDoAuth([...pessoas.keys()]);
        const lista = [...pessoas.entries()].map(([uid, x]) => {
            const a = auth.get(uid);
            return {
                uid,
                nome: x.nome || (a === null || a === void 0 ? void 0 : a.displayName) || '',
                email: x.email || (a === null || a === void 0 ? void 0 : a.email) || '',
                orgaos: x.ativos,
                papeis: [...x.papeis],
                super_admin: adminsAtivos.has(uid),
                bloqueado: bloqueados.has(uid),
                sem_conta: !a,
                ultimo_acesso: (a === null || a === void 0 ? void 0 : a.metadata.lastSignInTime) ? new Date(a.metadata.lastSignInTime).toISOString() : null,
                criado_em: (a === null || a === void 0 ? void 0 : a.metadata.creationTime) ? new Date(a.metadata.creationTime).toISOString() : null,
                provedores: provedor(a),
            };
        }).sort((a, b) => (b.ultimo_acesso || '').localeCompare(a.ultimo_acesso || ''));
        return { gerado_em: new Date().toISOString(), pessoas: lista };
    }
    const uid = String(p.uid || '').trim();
    if (!uid || uid.includes('/'))
        throw new https_1.HttpsError('invalid-argument', 'Informe a pessoa.');
    if (p.action === 'ficha') {
        const [perfil, vinculos, adm, bloqueio, atividade, contas] = await Promise.all([
            db.collection('users').doc(uid).get(),
            db.collection('userOrganizations').where('user_id', '==', uid).get(),
            db.collection('platformAdmins').doc(uid).get(),
            db.collection(vinculo_1.BLOQUEIOS).doc(uid).get(),
            db.collection('auditLogs').where('user_id', '==', uid).orderBy('timestamp', 'desc').limit(20).get().catch(() => null),
            contasDoAuth([uid]),
        ]);
        const a = contas.get(uid);
        if (!perfil.exists && vinculos.empty && !a)
            throw new https_1.HttpsError('not-found', 'Pessoa não encontrada.');
        const orgIds = [...new Set(vinculos.docs.map((d) => String(d.data().organization_id || '')).filter(Boolean))];
        const orgs = orgIds.length ? await db.getAll(...orgIds.map((id) => db.collection('organizations').doc(id))) : [];
        const nomeOrg = new Map(orgs.map((o) => { var _a; return [o.id, String(((_a = o.data()) === null || _a === void 0 ? void 0 : _a.name) || 'Órgão excluído')]; }));
        const u = perfil.data() || {};
        const b = bloqueio.data();
        return {
            uid,
            nome: String(u.full_name || u.platform_name || (a === null || a === void 0 ? void 0 : a.displayName) || ''),
            email: String(u.email || (a === null || a === void 0 ? void 0 : a.email) || ''),
            funcao: String(u.function && u.function !== 'member' ? u.function : ''),
            termos_aceitos_em: iso(u.termos_aceitos_em || u.terms_accepted_at),
            termos_versao: Number(u.termos_versao_aceita) || null,
            conta: a ? {
                provedores: provedor(a),
                email_confirmado: a.emailVerified,
                criada_em: a.metadata.creationTime ? new Date(a.metadata.creationTime).toISOString() : null,
                ultimo_acesso: a.metadata.lastSignInTime ? new Date(a.metadata.lastSignInTime).toISOString() : null,
                dois_fatores: (((_a = a.multiFactor) === null || _a === void 0 ? void 0 : _a.enrolledFactors) || []).length > 0,
            } : null,
            super_admin: adm.exists && ((_b = adm.data()) === null || _b === void 0 ? void 0 : _b.active) === true,
            bloqueio: (b === null || b === void 0 ? void 0 : b.ativa) === true ? { motivo: String(b.motivo || ''), em: iso(b.em), por: String(b.por_nome || '') } : null,
            vinculos: vinculos.docs.map((d) => {
                const v = d.data();
                return {
                    org_id: String(v.organization_id || ''),
                    org_nome: nomeOrg.get(String(v.organization_id || '')) || 'Órgão excluído',
                    papel: String(v.role || 'member'),
                    funcao: String(v.function || ''),
                    ativo: v.active !== false,
                    org_suspenso: v.org_suspended === true,
                    entrou_em: iso(v.joined_at),
                    saiu_em: iso(v.left_at),
                };
            }).sort((x, y) => Number(y.ativo) - Number(x.ativo) || x.org_nome.localeCompare(y.org_nome, 'pt-BR')),
            atividade: ((atividade === null || atividade === void 0 ? void 0 : atividade.docs) || []).map((d) => {
                const x = d.data();
                return { id: d.id, acao: String(x.action || ''), orgao: x.organization_id ? nomeOrg.get(String(x.organization_id)) || String(x.organization_id) : null, quando: iso(x.timestamp) };
            }),
        };
    }
    if (p.action === 'bloquear') {
        const motivo = String(p.motivo || '').trim().slice(0, 300);
        if (motivo.length < 5)
            throw new https_1.HttpsError('invalid-argument', 'Explique o motivo do bloqueio (ao menos 5 caracteres). A pessoa verá esse texto.');
        if (uid === ator.uid)
            throw new https_1.HttpsError('failed-precondition', 'Você não pode bloquear a si mesmo.');
        const adm = await db.collection('platformAdmins').doc(uid).get();
        if (adm.exists && ((_c = adm.data()) === null || _c === void 0 ? void 0 : _c.active) === true) {
            throw new https_1.HttpsError('failed-precondition', 'Esta pessoa administra a plataforma. Retire o acesso de super-admin antes de bloquear.');
        }
        await db.collection(vinculo_1.BLOQUEIOS).doc(uid).set({ ativa: true, motivo, em: firestore_1.FieldValue.serverTimestamp(), por_uid: ator.uid, por_nome: ator.name });
        const vinculos = await marcarVinculos(db, uid, motivo);
        await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_USER_BLOCKED', { uid, motivo, vinculos });
        return { success: true, vinculos };
    }
    if (p.action === 'desbloquear') {
        const ref = db.collection(vinculo_1.BLOQUEIOS).doc(uid);
        if (((_d = (await ref.get()).data()) === null || _d === void 0 ? void 0 : _d.ativa) !== true)
            throw new https_1.HttpsError('failed-precondition', 'Esta pessoa não está bloqueada.');
        await ref.set({ ativa: false, desbloqueado_em: firestore_1.FieldValue.serverTimestamp(), desbloqueado_por: ator.name }, { merge: true });
        const vinculos = await marcarVinculos(db, uid, null);
        await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_USER_UNBLOCKED', { uid, vinculos });
        return { success: true, vinculos };
    }
    throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida.');
});
//# sourceMappingURL=userAdmin.js.map