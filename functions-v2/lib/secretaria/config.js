"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaConfig = void 0;
exports.auditar = auditar;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const context_1 = require("./context");
/**
 * Configuração da Secretaria Processual do órgão: ativação (pelo admin do
 * órgão), unidades com seus membros lotados, e ritos.
 */
const MAX_UNIDADES = 100;
const MAX_RITOS = 50;
const RITO_PADRAO = {
    nome: 'Rito comum',
    descricao: 'Rito inicial criado na ativação. Pode ser editado ou substituído.',
    fases: [
        { id: 'autuacao', nome: 'Autuação' },
        { id: 'instrucao', nome: 'Instrução' },
        { id: 'decisao', nome: 'Decisão' },
        { id: 'cumprimento', nome: 'Cumprimento' },
        { id: 'encerramento', nome: 'Encerramento' },
    ],
};
exports.secretariaConfig = (0, https_1.onCall)({ region: context_1.REGION }, async (request) => {
    var _a, _b, _c;
    const auth = (0, context_1.exigirAuth)(request);
    const p = request.data || {};
    const c = await (0, context_1.carregarContexto)(auth, p.organizationId, { permitirInativa: true });
    const { db, orgId } = c;
    const enabled = ((_a = c.org.secretariaConfig) === null || _a === void 0 ? void 0 : _a.enabled) === true;
    const agora = firestore_1.FieldValue.serverTimestamp();
    if (p.action === 'estado') {
        if (!enabled && !c.ctx.isAdmin)
            return { enabled: false, isAdmin: false };
        const ritosSnap = await db.collection(context_1.COL.ritos).where('organization_id', '==', orgId).get();
        let membros = [];
        // Todo usuário lotado precisa ver os nomes de colegas para atribuir
        // processos; e-mail só para quem administra.
        const memSnap = await db.collection('userOrganizations').where('organization_id', '==', orgId).get();
        membros = memSnap.docs.map((d) => {
            const m = d.data();
            return {
                uid: String(m.user_id || d.id.split('_')[0]),
                nome: String(m.user_name || m.user_email || 'Membro'),
                email: c.ctx.isAdmin ? String(m.user_email || '') : '',
            };
        });
        return {
            enabled,
            isAdmin: c.ctx.isAdmin,
            uid: c.ctx.uid,
            minhasUnidades: c.ctx.unidadeIds,
            unidades: c.unidades.map((u) => ({
                id: u.id, nome: u.nome, sigla: u.sigla, tipo: u.tipo,
                ativa: u.ativa !== false, membros_uids: u.membros_uids || [],
            })),
            ritos: ritosSnap.docs.map((d) => {
                const r = d.data();
                return { id: d.id, nome: r.nome, descricao: r.descricao, fases: r.fases, versao: r.versao, ativo: r.ativo !== false };
            }),
            membros,
        };
    }
    (0, context_1.exigirAdmin)(c);
    if (p.action === 'ativar') {
        const ligar = p.enabled === true;
        await db.collection('organizations').doc(orgId).update({
            'secretariaConfig.enabled': ligar,
            'secretariaConfig.updated_at': agora,
            'secretariaConfig.updated_by': auth.uid,
        });
        // Primeira ativação: deixa o órgão pronto para autuar, com uma
        // secretaria (o admin lotado nela) e um rito comum. Nada é criado se
        // já existir unidade ou rito.
        if (ligar && c.unidades.length === 0) {
            await db.collection(context_1.COL.unidades).add({
                organization_id: orgId, nome: 'Secretaria', sigla: 'SEC', tipo: 'secretaria',
                membros_uids: [auth.uid], ativa: true, created_at: agora, created_by: auth.uid,
            });
        }
        const temRito = !(await db.collection(context_1.COL.ritos).where('organization_id', '==', orgId).limit(1).get()).empty;
        if (ligar && !temRito) {
            await db.collection(context_1.COL.ritos).add(Object.assign(Object.assign({ organization_id: orgId }, RITO_PADRAO), { versao: 1, ativo: true, created_at: agora, created_by: auth.uid }));
        }
        await auditar(db, orgId, auth.uid, c.userName, ligar ? 'SECRETARIA_ATIVADA' : 'SECRETARIA_DESATIVADA', {});
        return { success: true, enabled: ligar };
    }
    if (p.action === 'salvarUnidade') {
        const u = p.unidade || {};
        const nome = (0, secretaria_1.texto)(u.nome);
        if (!nome)
            throw new https_1.HttpsError('invalid-argument', 'A unidade precisa de um nome');
        const tipo = u.tipo === 'gabinete' ? 'gabinete' : 'secretaria';
        const membrosIn = Array.isArray(u.membros_uids) ? u.membros_uids.filter((x) => typeof x === 'string') : [];
        const membros = [...new Set(membrosIn)].slice(0, 200);
        // Só membros do órgão podem ser lotados.
        if (membros.length) {
            const refs = membros.map((uid) => db.collection('userOrganizations').doc(`${uid}_${orgId}`));
            const snaps = await db.getAll(...refs);
            const fora = snaps.filter((s) => !s.exists).length;
            if (fora)
                throw new https_1.HttpsError('invalid-argument', `${fora} pessoa(s) não são membros do órgão`);
        }
        const dados = {
            nome, sigla: (0, secretaria_1.texto)(u.sigla, 20), tipo, membros_uids: membros, ativa: u.ativa !== false,
            updated_at: agora, updated_by: auth.uid,
        };
        if (p.id) {
            const atual = c.unidades.find((x) => x.id === p.id);
            if (!atual)
                throw new https_1.HttpsError('not-found', 'Unidade não encontrada');
            await db.collection(context_1.COL.unidades).doc(p.id).update(dados);
        }
        else {
            if (c.unidades.length >= MAX_UNIDADES)
                throw new https_1.HttpsError('resource-exhausted', 'Limite de unidades atingido');
            const ref = await db.collection(context_1.COL.unidades).add(Object.assign(Object.assign({}, dados), { organization_id: orgId, created_at: agora, created_by: auth.uid }));
            p.id = ref.id;
        }
        await auditar(db, orgId, auth.uid, c.userName, 'SECRETARIA_UNIDADE_SALVA', { unidade_id: p.id, nome, membros: membros.length });
        return { success: true, id: p.id };
    }
    if (p.action === 'salvarRito') {
        let rito;
        try {
            rito = (0, secretaria_1.sanitizeRito)(p.rito);
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        const col = db.collection(context_1.COL.ritos);
        if (p.id) {
            const ref = col.doc(p.id);
            const snap = await ref.get();
            if (!snap.exists || ((_b = snap.data()) === null || _b === void 0 ? void 0 : _b.organization_id) !== orgId)
                throw new https_1.HttpsError('not-found', 'Rito não encontrado');
            // Processos guardam a cópia das fases com que foram autuados; mudar
            // o rito só vale para os próximos.
            await ref.update(Object.assign(Object.assign({}, rito), { ativo: p.ativo !== false, versao: (Number((_c = snap.data()) === null || _c === void 0 ? void 0 : _c.versao) || 1) + 1, updated_at: agora, updated_by: auth.uid }));
        }
        else {
            const qtd = (await col.where('organization_id', '==', orgId).get()).size;
            if (qtd >= MAX_RITOS)
                throw new https_1.HttpsError('resource-exhausted', 'Limite de ritos atingido');
            const ref = await col.add(Object.assign(Object.assign({}, rito), { organization_id: orgId, versao: 1, ativo: true, created_at: agora, created_by: auth.uid }));
            p.id = ref.id;
        }
        await auditar(db, orgId, auth.uid, c.userName, 'SECRETARIA_RITO_SALVO', { rito_id: p.id, nome: rito.nome });
        return { success: true, id: p.id };
    }
    throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
});
async function auditar(db, orgId, uid, nome, action, details) {
    await db.collection('auditLogs').add({
        organization_id: orgId, user_id: uid, user_name: nome, action,
        details,
        timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
}
//# sourceMappingURL=config.js.map