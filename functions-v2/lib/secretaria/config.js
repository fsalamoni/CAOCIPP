"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaConfig = exports.TIPOS_DOCUMENTO_PADRAO = void 0;
exports.auditar = auditar;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const documento_1 = require("../shared/documento");
const MAX_MODELOS = 200;
const MAX_BRASAO = 300 * 1024;
exports.TIPOS_DOCUMENTO_PADRAO = [
    'Despacho', 'Decisão', 'Informação', 'Certidão', 'Ofício', 'Memorando', 'Parecer', 'Termo', 'Ata', 'Relatório', 'Notificação', 'Documento',
];
/** Cabeçalho, rodapé, fonte e tipos de documento do órgão (lista fechada). */
function sanitizeDocumentoConfig(v) {
    const o = (v && typeof v === 'object' ? v : {});
    const brasao = typeof o.brasao === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(o.brasao) ? o.brasao : null;
    if (brasao && brasao.length * 0.75 > MAX_BRASAO)
        throw new Error('O brasão passa de 300 KB; use uma imagem menor');
    const linhas = (Array.isArray(o.cabecalho_linhas) ? o.cabecalho_linhas : []).map((l) => (0, secretaria_1.texto)(l, 120)).filter(Boolean).slice(0, 4);
    const tipos = [...new Set((Array.isArray(o.tipos_documento) ? o.tipos_documento : []).map((t) => (0, secretaria_1.texto)(t, 60)).filter(Boolean))].slice(0, 60);
    const tamanho = Number(o.tamanho_padrao);
    return {
        cabecalho_linhas: linhas,
        brasao,
        rodape: (0, secretaria_1.texto)(o.rodape, 200),
        fonte_padrao: documento_1.FONTES[String(o.fonte_padrao)] ? String(o.fonte_padrao) : 'serif',
        tamanho_padrao: tamanho >= 9 && tamanho <= 16 ? tamanho : 12,
        tipos_documento: tipos.length ? tipos : exports.TIPOS_DOCUMENTO_PADRAO,
    };
}
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const auth = (0, context_1.exigirAuth)(request);
    const p = request.data || {};
    const c = await (0, context_1.carregarContexto)(auth, p.organizationId, { permitirInativa: true });
    const { db, orgId } = c;
    const enabled = ((_a = c.org.secretariaConfig) === null || _a === void 0 ? void 0 : _a.enabled) === true;
    const agora = firestore_1.FieldValue.serverTimestamp();
    if (p.action === 'estado') {
        if (!enabled && !c.ctx.isAdmin)
            return { enabled: false, isAdmin: false };
        const [ritosSnap, tiposSnap, cfgSnap, modelosSnap] = await Promise.all([
            db.collection(context_1.COL.ritos).where('organization_id', '==', orgId).get(),
            db.collection(context_1.COL.tipos).where('organization_id', '==', orgId).get(),
            db.collection(context_1.COL.config).doc(orgId).get(),
            db.collection(context_1.COL.modelos).where('organization_id', '==', orgId).select('nome', 'tipo_documento', 'descricao', 'ativo').get(),
        ]);
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
            peticao_interrompe: ((_b = c.org.secretariaConfig) === null || _b === void 0 ? void 0 : _b.peticao_interrompe) === true,
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
            tipos: tiposSnap.docs.map((d) => {
                const t = d.data();
                return {
                    id: d.id, nome: t.nome, sigla: t.sigla || '', descricao: t.descricao || '', rito_id: t.rito_id,
                    sigilo_padrao: t.sigilo_padrao || 'normal', unidade_inicial: t.unidade_inicial || null, ativo: t.ativo !== false,
                };
            }).sort((a, b) => a.nome.localeCompare(b.nome)),
            documento: sanitizeDocumentoConfig((_c = cfgSnap.data()) === null || _c === void 0 ? void 0 : _c.documento),
            modelos: modelosSnap.docs.map((d) => {
                const m = d.data();
                return { id: d.id, nome: m.nome, tipo_documento: m.tipo_documento || '', descricao: m.descricao || '', ativo: m.ativo !== false };
            }).sort((a, b) => a.nome.localeCompare(b.nome)),
            suspensa_plataforma: ((_d = c.org.secretariaConfig) === null || _d === void 0 ? void 0 : _d.suspensa_plataforma) === true,
            motivo_suspensao: ((_e = c.org.secretariaConfig) === null || _e === void 0 ? void 0 : _e.motivo_suspensao) || '',
            orgao: String(c.org.name || ''),
            membros,
        };
    }
    if (p.action === 'obterModelo') {
        if (!enabled)
            throw new https_1.HttpsError('failed-precondition', 'A Secretaria Processual não está ativa neste órgão');
        const m = (await db.collection(context_1.COL.modelos).doc(String(p.id || '_')).get()).data();
        if (!m || m.organization_id !== orgId)
            throw new https_1.HttpsError('not-found', 'Modelo não encontrado');
        return { id: p.id, nome: m.nome, tipo_documento: m.tipo_documento || '', descricao: m.descricao || '', conteudo: m.conteudo, ativo: m.ativo !== false };
    }
    (0, context_1.exigirAdmin)(c);
    if (p.action === 'salvarDocumentoConfig') {
        let documento;
        try {
            documento = sanitizeDocumentoConfig(p.documento);
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        await db.collection(context_1.COL.config).doc(orgId).set({ organization_id: orgId, documento, updated_at: agora, updated_by: auth.uid }, { merge: true });
        await auditar(db, orgId, auth.uid, c.userName, 'SECRETARIA_DOCUMENTO_CONFIG', { linhas: documento.cabecalho_linhas.length, brasao: !!documento.brasao });
        return { success: true };
    }
    if (p.action === 'salvarModelo') {
        const m = (p.modelo && typeof p.modelo === 'object' ? p.modelo : {});
        const nome = (0, secretaria_1.texto)(m.nome, 120);
        if (!nome)
            throw new https_1.HttpsError('invalid-argument', 'Dê um nome ao modelo');
        let conteudo;
        try {
            conteudo = (0, documento_1.sanitizeDoc)(m.conteudo);
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        const dados = {
            nome, tipo_documento: (0, secretaria_1.texto)(m.tipo_documento, 60), descricao: (0, secretaria_1.texto)(m.descricao, 500), conteudo,
            ativo: m.ativo !== false, updated_at: agora, updated_by: auth.uid,
        };
        const col = db.collection(context_1.COL.modelos);
        if (p.id) {
            const ref = col.doc(p.id);
            if (((_f = (await ref.get()).data()) === null || _f === void 0 ? void 0 : _f.organization_id) !== orgId)
                throw new https_1.HttpsError('not-found', 'Modelo não encontrado');
            await ref.update(dados);
        }
        else {
            if ((await col.where('organization_id', '==', orgId).count().get()).data().count >= MAX_MODELOS) {
                throw new https_1.HttpsError('resource-exhausted', 'Limite de modelos atingido');
            }
            p.id = (await col.add(Object.assign(Object.assign({}, dados), { organization_id: orgId, created_at: agora, created_by: auth.uid }))).id;
        }
        await auditar(db, orgId, auth.uid, c.userName, 'SECRETARIA_MODELO_SALVO', { modelo_id: p.id, nome });
        return { success: true, id: p.id };
    }
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
    if (p.action === 'salvarPreferencias') {
        const interrompe = p.peticao_interrompe === true;
        await db.collection('organizations').doc(orgId).update({
            'secretariaConfig.peticao_interrompe': interrompe,
            'secretariaConfig.updated_at': agora,
            'secretariaConfig.updated_by': auth.uid,
        });
        await auditar(db, orgId, auth.uid, c.userName, 'SECRETARIA_PREFERENCIAS', { peticao_interrompe: interrompe });
        return { success: true };
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
            if (!snap.exists || ((_g = snap.data()) === null || _g === void 0 ? void 0 : _g.organization_id) !== orgId)
                throw new https_1.HttpsError('not-found', 'Rito não encontrado');
            // Processos guardam a cópia das fases com que foram autuados; mudar
            // o rito só vale para os próximos.
            await ref.update(Object.assign(Object.assign({}, rito), { ativo: p.ativo !== false, versao: (Number((_h = snap.data()) === null || _h === void 0 ? void 0 : _h.versao) || 1) + 1, updated_at: agora, updated_by: auth.uid }));
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
    if (p.action === 'salvarTipo') {
        const t = (p.tipo && typeof p.tipo === 'object' ? p.tipo : {});
        const nome = (0, secretaria_1.texto)(t.nome);
        if (!nome)
            throw new https_1.HttpsError('invalid-argument', 'Dê um nome ao tipo de processo');
        const rito = (await db.collection(context_1.COL.ritos).doc(String(t.rito_id || '_')).get()).data();
        if (!rito || rito.organization_id !== orgId)
            throw new https_1.HttpsError('invalid-argument', 'Escolha o rito do tipo de processo');
        const unidadeInicial = String(t.unidade_inicial || '');
        if (unidadeInicial && !c.unidades.some((u) => u.id === unidadeInicial))
            throw new https_1.HttpsError('invalid-argument', 'Unidade inicial inválida');
        const dados = {
            nome, sigla: (0, secretaria_1.texto)(t.sigla, 12), descricao: (0, secretaria_1.texto)(t.descricao, secretaria_1.MAX_TEXTO_LONGO), rito_id: String(t.rito_id),
            sigilo_padrao: t.sigilo_padrao === 'restrito' ? 'restrito' : 'normal', unidade_inicial: unidadeInicial || null,
            ativo: t.ativo !== false, updated_at: agora, updated_by: auth.uid,
        };
        const col = db.collection(context_1.COL.tipos);
        if (p.id) {
            const ref = col.doc(p.id);
            if (((_j = (await ref.get()).data()) === null || _j === void 0 ? void 0 : _j.organization_id) !== orgId)
                throw new https_1.HttpsError('not-found', 'Tipo não encontrado');
            await ref.update(dados);
        }
        else {
            if ((await col.where('organization_id', '==', orgId).get()).size >= MAX_RITOS)
                throw new https_1.HttpsError('resource-exhausted', 'Limite de tipos atingido');
            p.id = (await col.add(Object.assign(Object.assign({}, dados), { organization_id: orgId, created_at: agora, created_by: auth.uid }))).id;
        }
        await auditar(db, orgId, auth.uid, c.userName, 'SECRETARIA_TIPO_SALVO', { tipo_id: p.id, nome });
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