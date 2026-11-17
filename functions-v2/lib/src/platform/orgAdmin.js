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
exports.platformOrg = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const vinculo_1 = require("../shared/vinculo");
const iso = (v) => v && typeof v.toDate === 'function'
    ? v.toDate().toISOString()
    : typeof v === 'string' ? v : null;
async function contar(q) {
    try {
        return (await q.count().get()).data().count;
    }
    catch (_a) {
        return null;
    }
}
/** Atualiza todos os vínculos do órgão em lotes (limite de 500 por lote). */
// O membro não lê mais o órgão, então nome e motivo vão no próprio vínculo
// para a tela explicar o que houve.
async function marcarVinculos(db, orgId, suspensao) {
    const snap = await db.collection('userOrganizations').where('organization_id', '==', orgId).get();
    const apagar = firestore_1.FieldValue.delete();
    const campos = suspensao
        ? { org_suspended: true, org_suspended_nome: suspensao.nome, org_suspended_motivo: suspensao.motivo }
        : { org_suspended: apagar, org_suspended_nome: apagar, org_suspended_motivo: apagar };
    for (let i = 0; i < snap.docs.length; i += 450) {
        const lote = db.batch();
        snap.docs.slice(i, i + 450).forEach((d) => lote.update(d.ref, campos));
        await lote.commit();
    }
    return snap.size;
}
async function auditarNoOrgao(db, orgId, ator, action, details) {
    await db.collection('auditLogs').add({
        organization_id: orgId, user_id: ator.uid, user_name: ator.name, action, details,
        scope: 'platform_no_orgao', timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
}
exports.platformOrg = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    const ator = await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const p = request.data || {};
    const orgId = String(p.organizationId || '').trim();
    if (!orgId || orgId.includes('/'))
        throw new https_1.HttpsError('invalid-argument', 'Informe o órgão.');
    const orgRef = db.collection('organizations').doc(orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists)
        throw new https_1.HttpsError('not-found', 'Órgão não encontrado.');
    const org = orgSnap.data() || {};
    if (p.action === 'ficha') {
        const porOrg = (col) => db.collection(col).where('organization_id', '==', orgId);
        const [vinculos, processos, expedientes, parcerias, juris, pe, bases, atividade] = await Promise.all([
            porOrg('userOrganizations').get(),
            contar(porOrg('processes')),
            contar(porOrg('expedientes')),
            contar(porOrg('parcerias')),
            contar(porOrg('juris')),
            contar(porOrg('secProcessos')),
            contar(porOrg('panoramaBases')),
            porOrg('auditLogs').orderBy('timestamp', 'desc').limit(15).get().catch(() => null),
        ]);
        const membros = vinculos.docs.map((d) => {
            const m = d.data();
            return {
                uid: String(m.user_id || ''),
                nome: String(m.user_name || ''),
                email: String(m.user_email || ''),
                papel: String(m.role || 'member'),
                funcao: String(m.function || ''),
                ativo: m.active !== false,
                entrou_em: iso(m.joined_at),
                saiu_em: iso(m.left_at),
                atribuicoes: Object.values(m.permissions || {}).filter((v) => v === true).length,
            };
        }).sort((a, b) => Number(b.ativo) - Number(a.ativo) || (a.papel === 'creator' ? -1 : b.papel === 'creator' ? 1 : 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
        const sc = org.secretariaConfig || {};
        const susp = org.platform_suspension || {};
        return {
            id: orgId,
            nome: String(org.name || 'Sem nome'),
            descricao: String(org.description || ''),
            contato: org.contactInfo || {},
            criado_em: iso(org.created_at),
            criado_por: org.created_by ? String(org.created_by) : null,
            suspensao: (0, vinculo_1.orgSuspensa)(org)
                ? { motivo: String(susp.motivo || ''), em: iso(susp.em), por: String(susp.por_nome || '') }
                : null,
            processo_eletronico: { ligado: sc.enabled === true, suspenso: sc.suspensa_plataforma === true, motivo: String(sc.motivo_suspensao || '') },
            modulos: org.moduleConfig && typeof org.moduleConfig === 'object'
                ? Object.fromEntries(Object.entries(org.moduleConfig).map(([k, v]) => [k, (v === null || v === void 0 ? void 0 : v.enabled) === true]))
                : null,
            volumes: { processos, expedientes, parcerias, juris, processos_eletronicos: pe, bases_panorama: bases },
            membros,
            atividade: ((atividade === null || atividade === void 0 ? void 0 : atividade.docs) || []).map((d) => {
                const a = d.data();
                return { id: d.id, acao: String(a.action || ''), quem: String(a.user_name || ''), quando: iso(a.timestamp), plataforma: String(a.scope || '').startsWith('platform') };
            }),
        };
    }
    if (p.action === 'suspender') {
        const motivo = String(p.motivo || '').trim().slice(0, 300);
        if (motivo.length < 5)
            throw new https_1.HttpsError('invalid-argument', 'Explique o motivo da suspensão (ao menos 5 caracteres). Os membros verão esse texto.');
        if ((0, vinculo_1.orgSuspensa)(org))
            throw new https_1.HttpsError('failed-precondition', 'O órgão já está suspenso.');
        await orgRef.update({
            platform_suspension: { ativa: true, motivo, em: firestore_1.FieldValue.serverTimestamp(), por_uid: ator.uid, por_nome: ator.name },
        });
        const vinculos = await marcarVinculos(db, orgId, { nome: String(org.name || ''), motivo });
        await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_ORG_SUSPENDED', { organization_id: orgId, motivo, vinculos });
        await auditarNoOrgao(db, orgId, ator, 'ORG_SUSPENSO_PLATAFORMA', { motivo });
        return { success: true, vinculos };
    }
    if (p.action === 'reativar') {
        if (!(0, vinculo_1.orgSuspensa)(org))
            throw new https_1.HttpsError('failed-precondition', 'O órgão não está suspenso.');
        await orgRef.update({ platform_suspension: firestore_1.FieldValue.delete() });
        const vinculos = await marcarVinculos(db, orgId, null);
        await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_ORG_REACTIVATED', { organization_id: orgId, vinculos });
        await auditarNoOrgao(db, orgId, ator, 'ORG_REATIVADO_PLATAFORMA', {});
        return { success: true, vinculos };
    }
    if (p.action === 'trocarCriador') {
        const novo = String(p.novoCriadorUid || '').trim();
        if (!novo || novo.includes('/'))
            throw new https_1.HttpsError('invalid-argument', 'Escolha o novo criador.');
        const novoRef = db.collection('userOrganizations').doc(`${novo}_${orgId}`);
        const anteriores = await db.collection('userOrganizations')
            .where('organization_id', '==', orgId).where('role', '==', 'creator').get();
        const resultado = await db.runTransaction(async (t) => {
            var _a, _b, _c;
            const n = await t.get(novoRef);
            if (!n.exists || ((_a = n.data()) === null || _a === void 0 ? void 0 : _a.active) === false)
                throw new https_1.HttpsError('failed-precondition', 'O novo criador precisa ser membro ativo do órgão.');
            if (((_b = n.data()) === null || _b === void 0 ? void 0 : _b.role) === 'creator')
                throw new https_1.HttpsError('failed-precondition', 'Essa pessoa já é a criadora do órgão.');
            const rebaixados = [];
            for (const a of anteriores.docs) {
                if (a.id === novoRef.id)
                    continue;
                // Criador anterior ainda ativo continua no órgão como administrador.
                t.update(a.ref, { role: a.data().active === false ? 'member' : 'admin' });
                rebaixados.push(String(a.data().user_id || ''));
            }
            t.update(novoRef, { role: 'creator' });
            t.update(orgRef, { created_by: novo, creator_changed_at: firestore_1.FieldValue.serverTimestamp() });
            return { rebaixados, nome: String(((_c = n.data()) === null || _c === void 0 ? void 0 : _c.user_name) || '') };
        });
        await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_ORG_CREATOR_CHANGED', { organization_id: orgId, novo_criador: novo, anteriores: resultado.rebaixados });
        await auditarNoOrgao(db, orgId, ator, 'CRIADOR_TROCADO_PLATAFORMA', { novo_criador: novo, novo_nome: resultado.nome });
        return { success: true };
    }
    throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida.');
});
//# sourceMappingURL=orgAdmin.js.map