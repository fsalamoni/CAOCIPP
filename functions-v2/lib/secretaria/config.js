"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaConfig = exports.TIPOS_DOCUMENTO_PADRAO = void 0;
exports.auditar = auditar;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const documento_1 = require("../shared/documento");
const context_1 = require("./context");
const documentoConfig_1 = require("./documentoConfig");
const unidades_1 = require("./unidades");
var documentoConfig_2 = require("./documentoConfig");
Object.defineProperty(exports, "TIPOS_DOCUMENTO_PADRAO", { enumerable: true, get: function () { return documentoConfig_2.TIPOS_DOCUMENTO_PADRAO; } });
/**
 * Configuração do Processo Eletrônico do órgão (function `secretariaConfig`,
 * nome mantido): ativação, unidades de lotação e equipes, ritos, tipos de
 * processo, papel timbrado, modelos e calendário. A tela fica no Painel
 * Administrativo do órgão; a gestão de cada unidade, também na própria
 * página do Processo Eletrônico.
 */
const MAX_MODELOS = 200;
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const auth = (0, context_1.exigirAuth)(request);
    const p = request.data || {};
    // Convite de equipe: quem aceita pode ainda não ser membro do órgão.
    if (p.action === 'verConviteEquipe')
        return (0, unidades_1.verConviteEquipe)(p.token);
    if (p.action === 'aceitarConviteEquipe')
        return (0, unidades_1.aceitarConviteEquipe)(auth, p.token);
    const c = await (0, context_1.carregarContexto)(auth, p.organizationId, { permitirInativa: true });
    const { db, orgId } = c;
    const enabled = ((_a = c.org.secretariaConfig) === null || _a === void 0 ? void 0 : _a.enabled) === true;
    const agora = firestore_1.FieldValue.serverTimestamp();
    const audit = (action, details) => auditar(db, orgId, auth.uid, c.userName, action, details);
    const exigirAtivo = () => {
        if (!enabled)
            throw new https_1.HttpsError('failed-precondition', 'O Processo Eletrônico não está ativo neste órgão');
    };
    if (p.action === 'estado') {
        if (!enabled && !c.ctx.isAdmin)
            return { enabled: false, isAdmin: false };
        const minhas = c.ctx.unidadeIds;
        const [ritosSnap, tiposSnap, cfgSnap, modelosSnap, memSnap, unCfgSnaps, convites] = await Promise.all([
            db.collection(context_1.COL.ritos).where('organization_id', '==', orgId).get(),
            db.collection(context_1.COL.tipos).where('organization_id', '==', orgId).get(),
            db.collection(context_1.COL.config).doc(orgId).get(),
            db.collection(context_1.COL.modelos).where('organization_id', '==', orgId).select('nome', 'tipo_documento', 'descricao', 'ativo', 'unidade_id', 'formato', 'arquivo_nome').get(),
            db.collection('userOrganizations').where('organization_id', '==', orgId).get(),
            minhas.length ? db.getAll(...minhas.map((id) => db.collection(context_1.COL.unidadeConfig).doc(id))) : Promise.resolve([]),
            (0, unidades_1.convitesPendentes)(c),
        ]);
        // Todo usuário lotado precisa ver os nomes de colegas para atribuir
        // processos; e-mail só para quem administra ou gere unidade.
        const veEmail = c.ctx.isAdmin || c.gestorDe.length > 0;
        const membros = memSnap.docs.filter((d) => d.data().active !== false).map((d) => {
            const m = d.data();
            return {
                uid: String(m.user_id || d.id.split('_')[0]),
                nome: String(m.user_name || m.user_email || 'Membro'),
                email: veEmail ? String(m.user_email || '') : '',
                funcao: String(m.function || ''),
            };
        });
        const documento = (0, documentoConfig_1.sanitizeDocumentoConfig)((_b = cfgSnap.data()) === null || _b === void 0 ? void 0 : _b.documento);
        // Timbrado e tipos efetivos das unidades em que a pessoa está lotada
        // (o editor e a redação usam o da unidade que tem o processo).
        const documentoUnidades = {};
        for (const s of unCfgSnaps)
            documentoUnidades[s.id] = (0, secretaria_1.documentoEfetivo)(documento, s.data());
        return {
            enabled,
            peticao_interrompe: ((_c = c.org.secretariaConfig) === null || _c === void 0 ? void 0 : _c.peticao_interrompe) === true,
            isAdmin: c.ctx.isAdmin,
            uid: c.ctx.uid,
            minhasUnidades: minhas,
            gestorDe: c.gestorDe,
            unidades: c.unidades.map((u) => {
                const gere = c.ctx.isAdmin || c.gestorDe.includes(u.id);
                const lotacoes = (0, secretaria_1.lotacoesDe)(u);
                return Object.assign(Object.assign({ id: u.id, nome: u.nome, sigla: u.sigla || '', tipo: u.tipo || 'secretaria', descricao: u.descricao || '', ativa: u.ativa !== false, membros_uids: lotacoes.map((l) => l.uid), lotacoes }, (gere ? { pedidos: Array.isArray(u.pedidos) ? u.pedidos : [] } : {})), { pedi_lotacao: Array.isArray(u.pedidos) && u.pedidos.some((x) => x.uid === auth.uid) });
            }).sort((a, b) => String(a.nome).localeCompare(String(b.nome))),
            convitesEquipe: convites,
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
            documento,
            documentoUnidades,
            calendario: (0, secretaria_1.sanitizeCalendario)((_d = cfgSnap.data()) === null || _d === void 0 ? void 0 : _d.calendario),
            alerta_prazos: ((_e = cfgSnap.data()) === null || _e === void 0 ? void 0 : _e.alerta_prazos) === true,
            modelos: modelosSnap.docs.map((d) => {
                const m = d.data();
                return {
                    id: d.id, nome: m.nome, tipo_documento: m.tipo_documento || '', descricao: m.descricao || '', ativo: m.ativo !== false,
                    unidade_id: m.unidade_id || null, formato: m.formato || 'editor', arquivo_nome: m.arquivo_nome || '',
                };
            }).sort((a, b) => a.nome.localeCompare(b.nome)),
            suspensa_plataforma: ((_f = c.org.secretariaConfig) === null || _f === void 0 ? void 0 : _f.suspensa_plataforma) === true,
            motivo_suspensao: ((_g = c.org.secretariaConfig) === null || _g === void 0 ? void 0 : _g.motivo_suspensao) || '',
            orgao: String(c.org.name || ''),
            membros,
        };
    }
    if (p.action === 'obterModelo') {
        exigirAtivo();
        const m = (await db.collection(context_1.COL.modelos).doc(String(p.id || '_')).get()).data();
        if (!m || m.organization_id !== orgId)
            throw new https_1.HttpsError('not-found', 'Modelo não encontrado');
        return {
            id: p.id, nome: m.nome, tipo_documento: m.tipo_documento || '', descricao: m.descricao || '', conteudo: m.conteudo,
            ativo: m.ativo !== false, unidade_id: m.unidade_id || null, formato: m.formato || 'editor', arquivo_nome: m.arquivo_nome || '',
        };
    }
    if (p.action === 'pedirLotacao') {
        exigirAtivo();
        return (0, unidades_1.pedirLotacao)(c, p, auth.uid, String(auth.token.email || ''));
    }
    // Gestão de unidade: admin do órgão ou gestor da unidade.
    if (p.action === 'salvarUnidade')
        return (0, unidades_1.salvarUnidade)(c, p, auth.uid, audit);
    if (p.action === 'obterUnidadeDocumento')
        return (0, unidades_1.obterUnidadeDocumento)(c, p);
    if (p.action === 'salvarUnidadeDocumento')
        return (0, unidades_1.salvarUnidadeDocumento)(c, p, auth.uid, audit);
    if (p.action === 'convidarEquipe') {
        exigirAtivo();
        return (0, unidades_1.convidarEquipe)(c, p, auth.uid, audit);
    }
    if (p.action === 'revogarConviteEquipe')
        return (0, unidades_1.revogarConviteEquipe)(c, p, audit);
    if (p.action === 'decidirPedido')
        return (0, unidades_1.decidirPedido)(c, p, auth.uid, audit);
    if (p.action === 'salvarModelo') {
        const m = (p.modelo && typeof p.modelo === 'object' ? p.modelo : {});
        const col = db.collection(context_1.COL.modelos);
        const atual = p.id ? (await col.doc(p.id).get()).data() : null;
        if (p.id && (atual === null || atual === void 0 ? void 0 : atual.organization_id) !== orgId)
            throw new https_1.HttpsError('not-found', 'Modelo não encontrado');
        // Modelo do órgão: admin. Modelo de unidade: gestão dela (antes e depois de mudar).
        const unidadeId = m.unidade_id ? String(m.unidade_id) : null;
        for (const u of new Set([unidadeId, atual ? (atual.unidade_id || null) : unidadeId])) {
            if (u)
                (0, context_1.exigirGestor)(c, u);
            else
                (0, context_1.exigirAdmin)(c);
        }
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
            nome, tipo_documento: (0, secretaria_1.texto)(m.tipo_documento, 60), descricao: (0, secretaria_1.texto)(m.descricao, 500), conteudo, unidade_id: unidadeId,
            ativo: m.ativo !== false, updated_at: agora, updated_by: auth.uid,
        };
        if (p.id) {
            await col.doc(p.id).update(dados);
        }
        else {
            if ((await col.where('organization_id', '==', orgId).count().get()).data().count >= MAX_MODELOS) {
                throw new https_1.HttpsError('resource-exhausted', 'Limite de modelos atingido');
            }
            p.id = (await col.add(Object.assign(Object.assign({}, dados), { formato: 'editor', organization_id: orgId, created_at: agora, created_by: auth.uid }))).id;
        }
        await audit('SECRETARIA_MODELO_SALVO', { modelo_id: p.id, nome, unidade_id: unidadeId });
        return { success: true, id: p.id };
    }
    (0, context_1.exigirAdmin)(c);
    if (p.action === 'salvarDocumentoConfig') {
        let documento;
        try {
            documento = (0, documentoConfig_1.sanitizeDocumentoConfig)(p.documento);
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        await db.collection(context_1.COL.config).doc(orgId).set({ organization_id: orgId, documento, updated_at: agora, updated_by: auth.uid }, { merge: true });
        await audit('SECRETARIA_DOCUMENTO_CONFIG', { linhas: documento.cabecalho_linhas.length, brasao: !!documento.brasao });
        return { success: true };
    }
    if (p.action === 'salvarCalendario') {
        const calendario = (0, secretaria_1.sanitizeCalendario)(p.calendario);
        const alerta = p.alerta_prazos === true;
        await db.collection(context_1.COL.config).doc(orgId).set({ organization_id: orgId, calendario, alerta_prazos: alerta, updated_at: agora, updated_by: auth.uid }, { merge: true });
        await audit('SECRETARIA_CALENDARIO', {
            feriados: calendario.feriados.length, recessos: calendario.recessos.length, recesso_forense: calendario.recesso_forense, alerta_prazos: alerta,
        });
        return { success: true, calendario };
    }
    if (p.action === 'ativar') {
        const ligar = p.enabled === true;
        await db.collection('organizations').doc(orgId).update({
            'secretariaConfig.enabled': ligar,
            'secretariaConfig.updated_at': agora,
            'secretariaConfig.updated_by': auth.uid,
        });
        // Primeira ativação: deixa o órgão pronto para autuar, com uma
        // secretaria (o admin lotado e gestor) e um rito comum. Nada é criado
        // se já existir unidade ou rito.
        if (ligar && c.unidades.length === 0) {
            await db.collection(context_1.COL.unidades).add({
                organization_id: orgId, nome: 'Secretaria', sigla: 'SEC', tipo: 'secretaria', descricao: '',
                lotacoes: [{ uid: auth.uid, atribuicao: 'Administração do Processo Eletrônico', gestor: true }],
                membros_uids: [auth.uid], pedidos: [], ativa: true, created_at: agora, created_by: auth.uid,
            });
        }
        const temRito = !(await db.collection(context_1.COL.ritos).where('organization_id', '==', orgId).limit(1).get()).empty;
        if (ligar && !temRito) {
            await db.collection(context_1.COL.ritos).add(Object.assign(Object.assign({ organization_id: orgId }, RITO_PADRAO), { versao: 1, ativo: true, created_at: agora, created_by: auth.uid }));
        }
        await audit(ligar ? 'SECRETARIA_ATIVADA' : 'SECRETARIA_DESATIVADA', {});
        return { success: true, enabled: ligar };
    }
    if (p.action === 'salvarPreferencias') {
        const interrompe = p.peticao_interrompe === true;
        await db.collection('organizations').doc(orgId).update({
            'secretariaConfig.peticao_interrompe': interrompe,
            'secretariaConfig.updated_at': agora,
            'secretariaConfig.updated_by': auth.uid,
        });
        await audit('SECRETARIA_PREFERENCIAS', { peticao_interrompe: interrompe });
        return { success: true };
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
            if (!snap.exists || ((_h = snap.data()) === null || _h === void 0 ? void 0 : _h.organization_id) !== orgId)
                throw new https_1.HttpsError('not-found', 'Rito não encontrado');
            // Processos guardam a cópia das fases com que foram autuados; mudar
            // o rito só vale para os próximos.
            await ref.update(Object.assign(Object.assign({}, rito), { ativo: p.ativo !== false, versao: (Number((_j = snap.data()) === null || _j === void 0 ? void 0 : _j.versao) || 1) + 1, updated_at: agora, updated_by: auth.uid }));
        }
        else {
            const qtd = (await col.where('organization_id', '==', orgId).get()).size;
            if (qtd >= MAX_RITOS)
                throw new https_1.HttpsError('resource-exhausted', 'Limite de ritos atingido');
            const ref = await col.add(Object.assign(Object.assign({}, rito), { organization_id: orgId, versao: 1, ativo: true, created_at: agora, created_by: auth.uid }));
            p.id = ref.id;
        }
        await audit('SECRETARIA_RITO_SALVO', { rito_id: p.id, nome: rito.nome });
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
            if (((_k = (await ref.get()).data()) === null || _k === void 0 ? void 0 : _k.organization_id) !== orgId)
                throw new https_1.HttpsError('not-found', 'Tipo não encontrado');
            await ref.update(dados);
        }
        else {
            if ((await col.where('organization_id', '==', orgId).get()).size >= MAX_RITOS)
                throw new https_1.HttpsError('resource-exhausted', 'Limite de tipos atingido');
            p.id = (await col.add(Object.assign(Object.assign({}, dados), { organization_id: orgId, created_at: agora, created_by: auth.uid }))).id;
        }
        await audit('SECRETARIA_TIPO_SALVO', { tipo_id: p.id, nome });
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