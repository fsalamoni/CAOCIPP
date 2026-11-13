"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaConfig = exports.TIPOS_DOCUMENTO_PADRAO = void 0;
exports.auditar = auditar;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const documento_1 = require("../shared/documento");
const camposProcesso_1 = require("../shared/camposProcesso");
const numeracao_1 = require("../shared/numeracao");
const context_1 = require("./context");
const comunicacoes_1 = require("../shared/comunicacoes");
const orgaos_1 = require("../shared/orgaos");
const orgaos_2 = require("./orgaos");
const documentoConfig_1 = require("./documentoConfig");
const importarModelo_1 = require("./importarModelo");
const conversao_1 = require("./conversao");
const modulos_1 = require("../shared/modulos");
const unidades_1 = require("./unidades");
const migrarRito_1 = require("./migrarRito");
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
// O documento do Firestore tem teto de 1 MB; modelo com imagens maiores fica no original.
const MAX_MODELO_JSON = 900000;
const caminhoModelo = (orgId, id) => `secretaria/${orgId}/modelos/${id}`;
const MAX_UNIDADES_PROPOSTA = 30;
const MAX_MODELOS_PROPOSTA = 60;
/** Tira do rito referências a unidades e modelos que não são do órgão. */
function filtrarRefsRito(rito, unidades, modelos) {
    return Object.assign(Object.assign({}, rito), { fases: rito.fases.map((f) => {
            const { unidade_id, modelos: ms } = f, resto = __rest(f, ["unidade_id", "modelos"]);
            const validos = (ms || []).filter((m) => modelos.has(m));
            // Documento exigido com modelo de fora do órgão: fica a exigência, sem o modelo.
            const limpa = (e) => {
                if (!e.modelo_id || modelos.has(e.modelo_id))
                    return e;
                const { modelo_id: _fora } = e, sem = __rest(e, ["modelo_id"]);
                return sem;
            };
            if (resto.documentos)
                resto.documentos = resto.documentos.map(limpa);
            if (resto.acoes_regras)
                resto.acoes_regras = resto.acoes_regras.map((r) => ((r === null || r === void 0 ? void 0 : r.documento) ? Object.assign(Object.assign({}, r), { documento: limpa(r.documento) }) : r));
            return Object.assign(Object.assign(Object.assign({}, resto), (unidade_id && unidades.has(unidade_id) ? { unidade_id } : {})), (validos.length ? { modelos: validos } : {}));
        }) });
}
/** Esqueleto de modelo criado pela implantação de um rito, para completar no editor. */
function esqueletoModelo(nome) {
    const p = (t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
    return {
        type: 'doc',
        content: [
            { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [{ type: 'text', text: nome.toUpperCase() }] },
            p('Processo nº {{numero}} · {{assunto}}'),
            p('Interessados: {{partes}}'),
            p('[Texto do documento]'),
            p('{{unidade}}, {{data_extenso}}.'),
            p('{{usuario}}'),
        ],
    };
}
/** Arquivo enviado pelo navegador (base64), conferido em tipo e tamanho. */
function arquivoRecebido(v, tipos) {
    const a = (v && typeof v === 'object' ? v : {});
    const mime = String(a.mime || '');
    if (!tipos.includes(mime))
        throw new https_1.HttpsError('invalid-argument', 'Formato de arquivo não aceito');
    const buf = Buffer.from(String(a.base64 || ''), 'base64');
    if (!buf.length)
        throw new https_1.HttpsError('invalid-argument', 'Arquivo vazio');
    if (buf.length > importarModelo_1.MAX_MODELO_BYTES)
        throw new https_1.HttpsError('invalid-argument', 'Arquivo acima de 5 MB');
    return { buf, mime, nome: (0, secretaria_1.texto)(a.nome, 160) || 'modelo' };
}
const MAX_RITOS = 50;
const MAX_TIPOS = 100;
/** Ritos, tipos e modelos excluídos (suave) não contam no limite nem aparecem nas listas. */
const naoExcluidos = (snap) => snap.docs.filter((d) => d.data().excluido !== true);
const quando = (v) => (v && typeof v.toDate === 'function'
    ? v.toDate().toISOString() : typeof v === 'string' ? v : null);
/** Versões guardadas por rito ou modelo (as mais antigas saem). */
const MAX_VERSOES = 20;
/**
 * Guarda a versão atual de um rito ou modelo em `versoes/{n}` antes de
 * sobrescrever, para o admin poder voltar atrás. Só os campos editáveis.
 */
async function guardarVersao(ref, atual, campos) {
    const n = Number(atual.versao) || 1;
    const dados = { versao: n, salvo_em: atual.updated_at || atual.created_at || null, salvo_por: atual.updated_by || atual.created_by || null };
    for (const k of campos)
        if (atual[k] !== undefined)
            dados[k] = atual[k];
    await ref.collection('versoes').doc(String(n).padStart(6, '0')).set(dados);
    const antigas = await ref.collection('versoes').orderBy('versao', 'desc').offset(MAX_VERSOES).get();
    if (!antigas.empty) {
        const b = ref.firestore.batch();
        antigas.docs.forEach((d) => b.delete(d.ref));
        await b.commit();
    }
}
const CAMPOS_RITO = ['nome', 'descricao', 'fases', 'exigir_tipo'];
/** Tipo de processo: o que o editor do tipo grava (a versão é aberta no editor, não restaurada direto). */
const CAMPOS_TIPO = ['nome', 'sigla', 'descricao', 'rito_id', 'formulario', 'numeracao', 'pode_nascer_de', 'sigilo_padrao', 'urgente', 'unidade_inicial', 'orgao_id'];
const CAMPOS_MODELO = ['nome', 'tipo_documento', 'descricao', 'conteudo'];
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
/** Módulos de onde o tipo (campos) ou o rito (ações) puxam registros. */
const modulosDoForm = (f) => new Set(((f === null || f === void 0 ? void 0 : f.campos) || []).filter((x) => x.tipo === 'registro' && x.modulo).map((x) => String(x.modulo)));
const modulosDoRito = (r) => new Set((Array.isArray(r === null || r === void 0 ? void 0 : r.fases) ? r.fases : [])
    .flatMap((f) => (f.acoes_regras || []).flatMap((x) => ((x === null || x === void 0 ? void 0 : x.pede) === 'registro' && x.modulo ? [String(x.modulo)] : (x === null || x === void 0 ? void 0 : x.pede) === 'formulario' ? [...modulosDoForm(x)] : []))));
/** De onde o tipo pode nascer ("Criar processo eletrônico" no outro módulo ou "Novo processo derivado"). */
const nascerDe = (v) => [...new Set(Array.isArray(v) ? v.filter(modulos_1.ehModuloOrigem) : [])];
/** Módulos que o tipo usa: os dos campos e os de onde pode nascer. */
const modulosDoTipo = (t) => new Set([...modulosDoForm(t === null || t === void 0 ? void 0 : t.formulario), ...nascerDe(t === null || t === void 0 ? void 0 : t.pode_nascer_de).filter((m) => m !== 'pe')]);
/** Módulo novo no tipo ou no rito precisa da integração ligada (o que já estava gravado segue valendo). */
async function exigirIntegracoes(c, usados, antes) {
    const novos = [...usados].filter((m) => !antes.has(m));
    if (!novos.length)
        return;
    const ligadas = (0, modulos_1.integracoesDe)(c.org, await (0, modulos_1.lerFlags)(c.db));
    const off = novos.filter((m) => !ligadas[m]);
    if (off.length) {
        throw new https_1.HttpsError('failed-precondition', `Ligue a integração com ${off.map((m) => modulos_1.ROTULO_MODULO[m] || m).join(' e ')} em "Integrações com outros módulos" antes de usar registros dele`);
    }
}
exports.secretariaConfig = (0, https_1.onCall)({ region: context_1.REGION }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
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
            db.collection(context_1.COL.modelos).where('organization_id', '==', orgId).select('nome', 'tipo_documento', 'descricao', 'ativo', 'unidade_id', 'orgao_id', 'formato', 'arquivo_nome', 'excluido', 'excluido_em', 'excluido_por').get(),
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
                // Sem nome cadastrado, o e-mail só serve de nome para quem já pode vê-lo.
                nome: String(m.user_name || (veEmail && m.user_email) || 'Membro'),
                email: veEmail ? String(m.user_email || '') : '',
                funcao: String(m.function || ''),
            };
        });
        // Lixeira: quem excluiu, inclusive quem já saiu do órgão (só admin e gestão recebem itens).
        const nomes = new Map(memSnap.docs.map((d) => {
            const m = d.data();
            return [String(m.user_id || d.id.split('_')[0]), String(m.user_name || (veEmail && m.user_email) || '')];
        }));
        const lixo = (colecao, d) => ({
            colecao, id: d.id, nome: d.data().nome, em: quando(d.data().excluido_em), por: nomes.get(String(d.data().excluido_por || '')) || '',
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
            // Integrações: o que o admin ligou e quais módulos o órgão tem ativos.
            integracoes: (0, modulos_1.integracoesGravadas)(c.org),
            modulos_ativos: (0, modulos_1.modulosAtivos)(c.org, await (0, modulos_1.lerFlags)(db)),
            isAdmin: c.ctx.isAdmin,
            uid: c.ctx.uid,
            minhasUnidades: minhas,
            gestorDe: c.gestorDe,
            // Órgãos internos, na ordem do organograma (vazio = entidade singular).
            orgaos: (0, orgaos_1.emArvore)((0, orgaos_1.orgaosDe)((_d = cfgSnap.data()) === null || _d === void 0 ? void 0 : _d.orgaos)),
            // Unidade excluída só empresta o nome ao que já está nos autos.
            unidades_excluidas: c.unidades.filter((u) => u.excluida).map((u) => ({ id: u.id, nome: u.nome, sigla: u.sigla || '' })),
            unidades: c.unidades.filter((u) => !u.excluida).map((u) => {
                const gere = c.ctx.isAdmin || c.gestorDe.includes(u.id);
                const lotacoes = (0, secretaria_1.lotacoesDe)(u);
                return Object.assign(Object.assign({ id: u.id, nome: u.nome, sigla: u.sigla || '', tipo: u.tipo || 'secretaria', descricao: u.descricao || '', orgao_id: u.orgao_id || null, competencias: (0, orgaos_1.sanitizeCompetencias)(u.competencias), ativa: u.ativa !== false, membros_uids: lotacoes.map((l) => l.uid), lotacoes }, (gere ? { pedidos: Array.isArray(u.pedidos) ? u.pedidos : [] } : {})), { pedi_lotacao: Array.isArray(u.pedidos) && u.pedidos.some((x) => x.uid === auth.uid), criada_por_mim: u.created_by === auth.uid });
            }).sort((a, b) => String(a.nome).localeCompare(String(b.nome))),
            convitesEquipe: convites,
            ritos: ritosSnap.docs.filter((d) => d.data().excluido !== true).map((d) => {
                const r = d.data();
                return { id: d.id, nome: r.nome, descricao: r.descricao, fases: r.fases, versao: r.versao, ativo: r.ativo !== false, exigir_tipo: r.exigir_tipo === true };
            }),
            tipos: naoExcluidos(tiposSnap).map((d) => {
                const t = d.data();
                return {
                    id: d.id, nome: t.nome, sigla: t.sigla || '', descricao: t.descricao || '', rito_id: t.rito_id,
                    sigilo_padrao: t.sigilo_padrao || 'normal', urgente: t.urgente === true, unidade_inicial: t.unidade_inicial || null, ativo: t.ativo !== false,
                    orgao_id: t.orgao_id || null, formulario: (0, camposProcesso_1.formularioDe)(t), numeracao: (0, numeracao_1.numeracaoTipoDe)(t.numeracao), pode_nascer_de: nascerDe(t.pode_nascer_de),
                    versao: Number(t.versao) || 1,
                };
            }).sort((a, b) => a.nome.localeCompare(b.nome)),
            // Processos já autuados com um tipo excluído seguem com o formulário dele (Editar dados, filtro da lista).
            tipos_excluidos: tiposSnap.docs.filter((d) => d.data().excluido === true)
                .map((d) => ({ id: d.id, nome: d.data().nome, formulario: (0, camposProcesso_1.formularioDe)(d.data()) })),
            documento,
            documentoUnidades,
            calendario: (0, secretaria_1.sanitizeCalendario)((_e = cfgSnap.data()) === null || _e === void 0 ? void 0 : _e.calendario),
            numeracao: (0, numeracao_1.numeracaoDe)((_f = cfgSnap.data()) === null || _f === void 0 ? void 0 : _f.numeracao),
            alerta_prazos: ((_g = cfgSnap.data()) === null || _g === void 0 ? void 0 : _g.alerta_prazos) === true,
            ciencia_dias: (0, comunicacoes_1.cienciaDias)((_h = cfgSnap.data()) === null || _h === void 0 ? void 0 : _h.ciencia_dias),
            textos_comunicacao: (0, comunicacoes_1.textosProntosDe)((_j = cfgSnap.data()) === null || _j === void 0 ? void 0 : _j.textos_comunicacao),
            modelos: naoExcluidos(modelosSnap).map((d) => {
                const m = d.data();
                return {
                    id: d.id, nome: m.nome, tipo_documento: m.tipo_documento || '', descricao: m.descricao || '', ativo: m.ativo !== false,
                    unidade_id: m.unidade_id || null, orgao_id: m.orgao_id || null, formato: m.formato || 'editor', arquivo_nome: m.arquivo_nome || '',
                };
            }).sort((a, b) => a.nome.localeCompare(b.nome)),
            // Lixeira: o admin restaura ritos, tipos e modelos; a gestão, os modelos da sua unidade.
            excluidos: [
                ...(c.ctx.isAdmin ? ritosSnap.docs.filter((d) => d.data().excluido === true).map((d) => lixo('rito', d)) : []),
                ...(c.ctx.isAdmin ? tiposSnap.docs.filter((d) => d.data().excluido === true).map((d) => (Object.assign(Object.assign({}, lixo('tipo', d)), { rito_id: d.data().rito_id || null }))) : []),
                ...modelosSnap.docs.filter((d) => d.data().excluido === true && (c.ctx.isAdmin || (d.data().unidade_id && c.gestorDe.includes(d.data().unidade_id))))
                    .map((d) => (Object.assign(Object.assign({}, lixo('modelo', d)), { unidade_id: d.data().unidade_id || null, orgao_id: d.data().orgao_id || null }))),
            ].sort((a, b) => String(b.em || '').localeCompare(String(a.em || ''))),
            suspensa_plataforma: ((_k = c.org.secretariaConfig) === null || _k === void 0 ? void 0 : _k.suspensa_plataforma) === true,
            motivo_suspensao: ((_l = c.org.secretariaConfig) === null || _l === void 0 ? void 0 : _l.motivo_suspensao) || '',
            orgao: String(c.org.name || ''),
            membros,
        };
    }
    if (p.action === 'historico') {
        // Lido pelo servidor: quem configura (configure_secretaria) não lê auditLogs direto, e
        // o `in` por ação traz as 300 mais recentes, não as primeiras em ordem alfabética.
        (0, context_1.exigirAdmin)(c);
        const lotes = (0, secretaria_1.acoesHistorico)(p.assunto);
        const assunto = typeof p.assunto === 'string' && Object.values(secretaria_1.HISTORICO_CONFIG).includes(p.assunto) ? p.assunto : null;
        const snaps = await Promise.all(lotes.map((l) => db.collection('auditLogs')
            .where('organization_id', '==', orgId).where('action', 'in', l).orderBy('timestamp', 'desc').limit(300).get()));
        const itens = snaps.flatMap((s) => s.docs).map((d) => {
            const e = d.data();
            const details = (e.details && typeof e.details === 'object' ? e.details : {});
            return { id: d.id, action: String(e.action), assunto: (0, secretaria_1.assuntoHistorico)(String(e.action), details), user_name: String(e.user_name || ''), details, em: quando(e.timestamp) };
        }).filter((e) => !assunto || e.assunto === assunto)
            .sort((a, b) => String(b.em || '').localeCompare(String(a.em || ''))).slice(0, 300);
        return { itens };
    }
    if (p.action === 'obterModelo') {
        exigirAtivo();
        const m = (await db.collection(context_1.COL.modelos).doc(String(p.id || '_')).get()).data();
        if (!m || m.organization_id !== orgId)
            throw new https_1.HttpsError('not-found', 'Modelo não encontrado');
        return {
            id: p.id, nome: m.nome, tipo_documento: m.tipo_documento || '', descricao: m.descricao || '', conteudo: m.conteudo,
            ativo: m.ativo !== false, unidade_id: m.unidade_id || null, orgao_id: m.orgao_id || null, formato: m.formato || 'editor', arquivo_nome: m.arquivo_nome || '',
        };
    }
    if (p.action === 'baixarModelo') {
        exigirAtivo();
        const m = (await db.collection(context_1.COL.modelos).doc(String(p.id || '_')).get()).data();
        if (!m || m.organization_id !== orgId || !m.storage_path)
            throw new https_1.HttpsError('not-found', 'Modelo sem arquivo original');
        let [buf] = await admin.storage().bucket().file(m.storage_path).download();
        const valores = p.valores && typeof p.valores === 'object' ? p.valores : null;
        if (valores && m.arquivo_mime === conversao_1.MIME_DOCX) {
            const limpos = {};
            // Fixos, campos do tipo e informações das ações; a chave vai até 60 como o nome no Word.
            for (const [k, v] of Object.entries(valores).slice(0, 200))
                if (/^[a-z0-9_]{1,60}$/.test(k))
                    limpos[k] = (0, secretaria_1.texto)(v, 2000);
            buf = await (0, importarModelo_1.preencherDocx)(buf, limpos);
        }
        return { base64: buf.toString('base64'), mime: m.arquivo_mime, nome: m.arquivo_nome || 'modelo' };
    }
    if (p.action === 'pedirLotacao') {
        exigirAtivo();
        return (0, unidades_1.pedirLotacao)(c, p, auth.uid, String(auth.token.email || ''));
    }
    // Gestão de unidade: admin do órgão ou gestor da unidade.
    if (p.action === 'salvarUnidade')
        return (0, unidades_1.salvarUnidade)(c, p, auth.uid, audit);
    if (p.action === 'excluirUnidade')
        return (0, unidades_1.excluirUnidade)(c, p, auth.uid, audit);
    // Levar processos em andamento para a versão atual do rito (só o admin; o próprio migrarRito confere).
    if (p.action === 'migrarRito') {
        exigirAtivo();
        return (0, migrarRito_1.migrarRito)(c, p, audit);
    }
    if (p.action === 'salvarOrgao')
        return (0, orgaos_2.salvarOrgao)(c, p, auth.uid, audit);
    if (p.action === 'removerOrgao')
        return (0, orgaos_2.removerOrgao)(c, p, auth.uid, audit);
    if (p.action === 'criarEstrutura')
        return (0, orgaos_2.criarEstrutura)(c, p, auth.uid, audit);
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
    if (p.action === 'importarModelo') {
        // Só interpreta e devolve a proposta; nada é gravado até salvarModelo.
        const unidadeId = p.unidade_id ? String(p.unidade_id) : null;
        if (unidadeId)
            (0, context_1.exigirGestor)(c, unidadeId);
        else
            (0, context_1.exigirAdmin)(c);
        const a = arquivoRecebido(p.arquivo, ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf', 'text/html', 'text/plain']);
        try {
            return Object.assign(Object.assign({}, (await (0, importarModelo_1.interpretarModelo)(a.buf, a.mime))), { nome: a.nome.replace(/\.[a-z0-9]{2,5}$/i, ''), original_possivel: importarModelo_1.MIMES_ORIGINAL.includes(a.mime) });
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : '';
            throw new https_1.HttpsError('invalid-argument', msg && msg.length < 300 ? msg : 'Não foi possível ler o arquivo');
        }
    }
    if (p.action === 'salvarModelo') {
        const m = (p.modelo && typeof p.modelo === 'object' ? p.modelo : {});
        const col = db.collection(context_1.COL.modelos);
        const atual = p.id ? (await col.doc(p.id).get()).data() : null;
        if (p.id && ((atual === null || atual === void 0 ? void 0 : atual.organization_id) !== orgId || (atual === null || atual === void 0 ? void 0 : atual.excluido) === true))
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
        // Modelo da entidade pode ser só de um órgão interno (vale para as unidades dele).
        const orgaoModelo = unidadeId ? '' : String(m.orgao_id || '');
        if (orgaoModelo && !(await (0, orgaos_2.lerOrgaos)(db, orgId)).some((o) => o.id === orgaoModelo))
            throw new https_1.HttpsError('invalid-argument', 'Órgão do modelo inválido');
        // Formato: 'editor' (conteúdo do editor) ou 'original' (arquivo DOCX/PDF guardado).
        const formato = (p.id ? atual === null || atual === void 0 ? void 0 : atual.formato : m.formato) === 'original' ? 'original' : 'editor';
        const arquivo = formato === 'original' && (m.arquivo || !p.id) ? arquivoRecebido(m.arquivo, importarModelo_1.MIMES_ORIGINAL) : null;
        let conteudo = null;
        if (formato === 'editor') {
            try {
                conteudo = (0, documento_1.sanitizeDoc)(m.conteudo);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            if (JSON.stringify(conteudo).length > MAX_MODELO_JSON) {
                throw new https_1.HttpsError('invalid-argument', 'Modelo grande demais (imagens pesadas); reduza as imagens ou guarde o arquivo original');
            }
        }
        const dados = Object.assign(Object.assign({ nome, tipo_documento: (0, secretaria_1.texto)(m.tipo_documento, 60), descricao: (0, secretaria_1.texto)(m.descricao, 500), conteudo, unidade_id: unidadeId }, ('orgao_id' in m || unidadeId ? { orgao_id: orgaoModelo || null } : {})), { ativo: m.ativo !== false, updated_at: agora, updated_by: auth.uid });
        const ref = p.id ? col.doc(p.id) : col.doc();
        if (!p.id && naoExcluidos(await col.where('organization_id', '==', orgId).select('excluido').get()).length >= MAX_MODELOS) {
            throw new https_1.HttpsError('resource-exhausted', 'Limite de modelos atingido');
        }
        if (arquivo) {
            const path = caminhoModelo(orgId, ref.id);
            await admin.storage().bucket().file(path).save(arquivo.buf, { contentType: arquivo.mime, resumable: false });
            Object.assign(dados, { storage_path: path, arquivo_nome: arquivo.nome, arquivo_mime: arquivo.mime, tamanho: arquivo.buf.length });
        }
        if (p.id) {
            // Versão anterior fica guardada (só modelos do editor têm conteúdo a versionar).
            if (formato === 'editor' && atual)
                await guardarVersao(ref, atual, CAMPOS_MODELO);
            await ref.update(Object.assign(Object.assign({}, dados), { versao: (Number(atual === null || atual === void 0 ? void 0 : atual.versao) || 1) + 1 }));
        }
        else
            await ref.set(Object.assign(Object.assign({}, dados), { versao: 1, formato, organization_id: orgId, created_at: agora, created_by: auth.uid }));
        p.id = ref.id;
        await audit('SECRETARIA_MODELO_SALVO', { modelo_id: p.id, nome, unidade_id: unidadeId, formato });
        return { success: true, id: p.id };
    }
    // Exclusão suave de modelo: some das listas e das indicações novas. Documentos
    // já redigidos a partir dele não mudam; restaurar o traz de volta, inativo.
    if (p.action === 'excluirModelo' || (p.action === 'restaurar' && p.colecao === 'modelo')) {
        const ref = db.collection(context_1.COL.modelos).doc(String(p.id || '_'));
        const atual = (await ref.get()).data();
        const excluir = p.action === 'excluirModelo';
        if (!atual || atual.organization_id !== orgId || (atual.excluido === true) !== !excluir)
            throw new https_1.HttpsError('not-found', 'Modelo não encontrado');
        if (atual.unidade_id && c.unidades.some((u) => u.id === atual.unidade_id && !u.excluida))
            (0, context_1.exigirGestor)(c, String(atual.unidade_id));
        else
            (0, context_1.exigirAdmin)(c);
        if (!excluir && naoExcluidos(await db.collection(context_1.COL.modelos).where('organization_id', '==', orgId).select('excluido').get()).length >= MAX_MODELOS) {
            throw new https_1.HttpsError('resource-exhausted', 'Limite de modelos atingido');
        }
        await ref.update(excluir
            ? { excluido: true, ativo: false, excluido_em: agora, excluido_por: auth.uid, updated_at: agora, updated_by: auth.uid }
            : { excluido: false, ativo: false, excluido_em: firestore_1.FieldValue.delete(), excluido_por: firestore_1.FieldValue.delete(), updated_at: agora, updated_by: auth.uid });
        await audit(excluir ? 'SECRETARIA_MODELO_EXCLUIDO' : 'SECRETARIA_MODELO_RESTAURADO', { modelo_id: ref.id, nome: atual.nome, unidade_id: atual.unidade_id || null });
        return { success: true };
    }
    // Versões anteriores de um rito (admin), de um modelo do editor (gestão) ou de um tipo (admin).
    if (p.action === 'versoes' || p.action === 'restaurarVersao') {
        const col = p.colecao === 'rito' ? context_1.COL.ritos : p.colecao === 'modelo' ? context_1.COL.modelos : p.colecao === 'tipo' ? context_1.COL.tipos : null;
        if (!col)
            throw new https_1.HttpsError('invalid-argument', 'Coleção inválida');
        // Tipo: a versão abre no editor e passa pelas validações de salvarTipo ao salvar.
        if (col === context_1.COL.tipos && p.action === 'restaurarVersao')
            throw new https_1.HttpsError('invalid-argument', 'Abra a versão do tipo no editor e salve');
        const ref = db.collection(col).doc(String(p.id || '_'));
        const atual = (await ref.get()).data();
        if (!atual || atual.organization_id !== orgId || atual.excluido === true)
            throw new https_1.HttpsError('not-found', 'Não encontrado');
        if (col === context_1.COL.ritos || !atual.unidade_id)
            (0, context_1.exigirAdmin)(c);
        else
            (0, context_1.exigirGestor)(c, String(atual.unidade_id));
        if (p.action === 'versoes' && (col === context_1.COL.tipos || col === context_1.COL.ritos) && p.versao) {
            const v = (await ref.collection('versoes').doc(String(Number(p.versao) || 0).padStart(6, '0')).get()).data();
            if (!v)
                throw new https_1.HttpsError('not-found', 'Versão não encontrada');
            // Rito: só leitura, para a prévia e a comparação com a versão atual.
            if (col === context_1.COL.ritos) {
                return { versao: v.versao, rito: { nome: v.nome || '', descricao: v.descricao || '', fases: Array.isArray(v.fases) ? v.fases : [], exigir_tipo: v.exigir_tipo === true } };
            }
            // Completa com os padrões o que a versão não gravou (tipo antigo), para não herdar a versão atual.
            return {
                versao: v.versao,
                tipo: {
                    nome: v.nome || '', sigla: v.sigla || '', descricao: v.descricao || '', rito_id: v.rito_id || '', formulario: (0, camposProcesso_1.formularioDe)(v),
                    numeracao: (0, numeracao_1.numeracaoTipoDe)(v.numeracao), pode_nascer_de: nascerDe(v.pode_nascer_de), sigilo_padrao: v.sigilo_padrao === 'restrito' ? 'restrito' : 'normal',
                    urgente: v.urgente === true, unidade_inicial: v.unidade_inicial || null, orgao_id: v.orgao_id || null,
                },
            };
        }
        if (p.action === 'versoes') {
            const snap = await ref.collection('versoes').orderBy('versao', 'desc').limit(MAX_VERSOES).get();
            return {
                versao_atual: Number(atual.versao) || 1,
                versoes: snap.docs.map((d) => {
                    var _a;
                    const v = d.data();
                    const em = v.salvo_em && typeof v.salvo_em.toDate === 'function' ? v.salvo_em.toDate().toISOString() : (v.salvo_em || null);
                    return { versao: v.versao, em, por: v.salvo_por || null, nome: v.nome || '', fases: Array.isArray(v.fases) ? v.fases.length : undefined,
                        campos: Array.isArray((_a = v.formulario) === null || _a === void 0 ? void 0 : _a.campos) ? v.formulario.campos.length : undefined };
                }),
            };
        }
        const vSnap = await ref.collection('versoes').doc(String(Number(p.versao) || 0).padStart(6, '0')).get();
        const v = vSnap.data();
        if (!v)
            throw new https_1.HttpsError('not-found', 'Versão não encontrada');
        const campos = col === context_1.COL.ritos ? CAMPOS_RITO : CAMPOS_MODELO;
        await guardarVersao(ref, atual, campos);
        const volta = { versao: (Number(atual.versao) || 1) + 1, updated_at: agora, updated_by: auth.uid };
        for (const k of campos)
            if (v[k] !== undefined)
                volta[k] = v[k];
        // Versão de antes da opção: o rito volta sem exigir tipo.
        if (col === context_1.COL.ritos)
            volta.exigir_tipo = v.exigir_tipo === true;
        // Fase que corria em unidade já excluída volta correndo na unidade que estiver com o processo.
        if (col === context_1.COL.ritos && Array.isArray(volta.fases)) {
            const vivas = new Set(c.unidades.filter((u) => !u.excluida).map((u) => u.id));
            volta.fases = volta.fases.map((_a) => {
                var { unidade_id } = _a, f = __rest(_a, ["unidade_id"]);
                return (unidade_id && vivas.has(unidade_id) ? Object.assign(Object.assign({}, f), { unidade_id }) : f);
            });
        }
        await ref.update(volta);
        await audit('SECRETARIA_VERSAO_RESTAURADA', { colecao: p.colecao, id: ref.id, nome: v.nome || atual.nome, de_versao: v.versao, nova_versao: volta.versao });
        return { success: true, versao: volta.versao };
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
        const dias = (0, comunicacoes_1.cienciaDias)(p.ciencia_dias);
        await db.collection(context_1.COL.config).doc(orgId).set({ organization_id: orgId, ciencia_dias: dias, updated_at: agora, updated_by: auth.uid }, { merge: true });
        await audit('SECRETARIA_PREFERENCIAS', { peticao_interrompe: interrompe, ciencia_dias: dias });
        return { success: true };
    }
    if (p.action === 'salvarIntegracoes') {
        // Cada módulo do órgão pode entrar nos processos (campo e ação "registro"). Só o admin.
        (0, context_1.exigirAdmin)(c);
        const pedido = (p.integracoes && typeof p.integracoes === 'object' ? p.integracoes : {});
        const ativos = (0, modulos_1.modulosAtivos)(c.org, await (0, modulos_1.lerFlags)(db));
        // Módulo inativo agora não liga, mas guarda o que o admin tinha escolhido (volta a valer quando o módulo voltar).
        const gravadas = (0, modulos_1.integracoesGravadas)(c.org);
        const integracoes = Object.fromEntries(modulos_1.MODULOS.map((m) => [m, pedido[m] === true && (ativos[m] || gravadas[m])]));
        await db.collection('organizations').doc(orgId).update({
            'secretariaConfig.integracoes': integracoes, 'secretariaConfig.updated_at': agora, 'secretariaConfig.updated_by': auth.uid,
        });
        await audit('SECRETARIA_INTEGRACOES', integracoes);
        return { success: true, integracoes };
    }
    if (p.action === 'salvarNumeracao') {
        // Numeração do órgão: vale para quem autua sem tipo e para os tipos que não têm a sua.
        let numeracao;
        try {
            numeracao = (0, numeracao_1.sanitizeNumeracao)(p.numeracao);
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        await db.collection(context_1.COL.config).doc(orgId).set({ organization_id: orgId, numeracao, updated_at: agora, updated_by: auth.uid }, { merge: true });
        await audit('SECRETARIA_NUMERACAO', { partes: numeracao.partes.map((x) => x.t).join(',') });
        return { success: true };
    }
    if (p.action === 'salvarTextosComunicacao') {
        let textos;
        try {
            textos = (0, comunicacoes_1.sanitizeTextosProntos)(p.textos);
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        await db.collection(context_1.COL.config).doc(orgId).set({ organization_id: orgId, textos_comunicacao: textos, updated_at: agora, updated_by: auth.uid }, { merge: true });
        await audit('SECRETARIA_TEXTOS_COMUNICACAO', { textos: textos.length });
        return { success: true };
    }
    if (p.action === 'extrairTextoRito') {
        const a = arquivoRecebido(p.arquivo, [conversao_1.MIME_DOCX, 'application/pdf', 'text/plain', importarModelo_1.MIME_BIZAGI]);
        if (a.mime === importarModelo_1.MIME_BIZAGI && a.buf.subarray(0, 2).toString('latin1') !== 'PK') {
            throw new https_1.HttpsError('invalid-argument', 'O arquivo não é um pacote do Bizagi (.bpm). Exporte o diagrama em BPMN ou XPDL e envie esse arquivo.');
        }
        try {
            return await (0, importarModelo_1.textoParaRito)(a.buf, a.mime);
        }
        catch (e) {
            // Mensagens nossas (PDF digitalizado, pacote sem diagrama) vão para a tela; o resto fica genérico.
            const msg = e instanceof Error && /^(O PDF|O arquivo|Não achei|O pacote)/.test(e.message) ? e.message : 'Não foi possível ler o arquivo';
            console.warn('extrairTextoRito', a.mime, e instanceof Error ? e.message : e);
            throw new https_1.HttpsError('invalid-argument', msg);
        }
    }
    if (p.action === 'aplicarPropostaRito') {
        // Implanta de uma vez (lote atômico): unidades e modelos novos, o rito
        // com as fases ligadas a eles e, se pedido, o tipo de processo.
        const pr = (p.proposta && typeof p.proposta === 'object' ? p.proposta : {});
        const unidadesIn = (Array.isArray(pr.unidades) ? pr.unidades : []);
        const modelosIn = (Array.isArray(pr.modelos) ? pr.modelos : []);
        if (unidadesIn.length > MAX_UNIDADES_PROPOSTA)
            throw new https_1.HttpsError('invalid-argument', `No máximo ${MAX_UNIDADES_PROPOSTA} unidades novas por rito`);
        if (modelosIn.length > MAX_MODELOS_PROPOSTA)
            throw new https_1.HttpsError('invalid-argument', `No máximo ${MAX_MODELOS_PROPOSTA} modelos novos por rito`);
        // Com rito_id, a mesma tela edita um rito existente (nova versão); sem, cria.
        const editarId = typeof pr.rito_id === 'string' && pr.rito_id ? pr.rito_id : null;
        const [ritosSnap, modelosSnap, ritoAtualSnap] = await Promise.all([
            editarId ? null : db.collection(context_1.COL.ritos).where('organization_id', '==', orgId).select('excluido').get(),
            db.collection(context_1.COL.modelos).where('organization_id', '==', orgId).select('excluido').get(),
            editarId ? db.collection(context_1.COL.ritos).doc(editarId).get() : null,
        ]);
        const ritoAtual = ritoAtualSnap === null || ritoAtualSnap === void 0 ? void 0 : ritoAtualSnap.data();
        if (editarId && (!ritoAtual || ritoAtual.organization_id !== orgId || ritoAtual.excluido === true))
            throw new https_1.HttpsError('not-found', 'Rito não encontrado');
        if (ritosSnap && ritosSnap.docs.filter((d) => d.data().excluido !== true).length >= MAX_RITOS)
            throw new https_1.HttpsError('resource-exhausted', 'Limite de ritos atingido');
        if (naoExcluidos(modelosSnap).length + modelosIn.length > MAX_MODELOS)
            throw new https_1.HttpsError('resource-exhausted', 'Limite de modelos atingido');
        const refUn = new Map();
        const novasUnidades = unidadesIn.map((u) => {
            const nome = (0, secretaria_1.texto)(u.nome, 120);
            if (!nome)
                throw new https_1.HttpsError('invalid-argument', 'Unidade nova sem nome');
            const ref = db.collection(context_1.COL.unidades).doc();
            refUn.set(String(u.ref), ref.id);
            return { ref, nome, sigla: (0, secretaria_1.texto)(u.sigla, 12), tipo: (0, secretaria_1.tipoUnidade)(u.tipo) };
        });
        const unidadesValidas = new Set([...c.unidades.filter((u) => !u.excluida).map((u) => u.id), ...refUn.values()]);
        const unidadeDe = (r) => {
            const s = String(r || '');
            const id = refUn.get(s) || s;
            return unidadesValidas.has(id) ? id : null;
        };
        const refMod = new Map();
        const novosModelos = modelosIn.map((m) => {
            const nome = (0, secretaria_1.texto)(m.nome, 120);
            if (!nome)
                throw new https_1.HttpsError('invalid-argument', 'Modelo novo sem nome');
            const ref = db.collection(context_1.COL.modelos).doc();
            refMod.set(String(m.ref), ref.id);
            return { ref, nome, unidade_id: unidadeDe(m.unidade_ref), tipo_documento: (0, secretaria_1.texto)(m.tipo_documento, 60) };
        });
        const modelosValidos = new Set([...naoExcluidos(modelosSnap).map((d) => d.id), ...refMod.values()]);
        const ritoIn = (pr.rito && typeof pr.rito === 'object' ? pr.rito : {});
        const fasesIn = (Array.isArray(ritoIn.fases) ? ritoIn.fases : []);
        let rito;
        try {
            rito = (0, secretaria_1.sanitizeRito)(Object.assign(Object.assign({}, ritoIn), { fases: fasesIn.map((f) => {
                    var _a;
                    return (Object.assign(Object.assign({}, f), { unidade_id: unidadeDe((_a = f.unidade_ref) !== null && _a !== void 0 ? _a : f.unidade_id) || undefined, modelos: (Array.isArray(f.modelos_ref) ? f.modelos_ref : []).map((r) => refMod.get(String(r)) || String(r)) }));
                }) }));
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        rito = filtrarRefsRito(rito, unidadesValidas, modelosValidos);
        await exigirIntegracoes(c, modulosDoRito(rito), modulosDoRito(ritoAtual));
        const batch = db.batch();
        const origem = `Criada ao implantar o rito "${rito.nome}".`;
        for (const u of novasUnidades) {
            batch.set(u.ref, {
                organization_id: orgId, nome: u.nome, sigla: u.sigla, tipo: u.tipo, descricao: origem,
                lotacoes: [], membros_uids: [], pedidos: [], ativa: true, created_at: agora, created_by: auth.uid,
            });
        }
        for (const m of novosModelos) {
            batch.set(m.ref, {
                organization_id: orgId, nome: m.nome, tipo_documento: m.tipo_documento, descricao: `Modelo do rito "${rito.nome}". Complete o texto.`,
                conteudo: (0, documento_1.sanitizeDoc)(esqueletoModelo(m.nome)), unidade_id: m.unidade_id, formato: 'editor', ativo: true,
                created_at: agora, created_by: auth.uid, updated_at: agora, updated_by: auth.uid,
            });
        }
        const ritoRef = editarId ? db.collection(context_1.COL.ritos).doc(editarId) : db.collection(context_1.COL.ritos).doc();
        let versao = 1;
        if (editarId) {
            // Processos guardam a cópia das fases com que foram autuados; a versão anterior fica guardada.
            await guardarVersao(ritoRef, ritoAtual, CAMPOS_RITO);
            versao = (Number(ritoAtual.versao) || 1) + 1;
            batch.update(ritoRef, Object.assign(Object.assign({}, rito), { ativo: pr.ativo !== false, versao, updated_at: agora, updated_by: auth.uid }));
        }
        else {
            batch.set(ritoRef, Object.assign(Object.assign({}, rito), { organization_id: orgId, versao, ativo: true, created_at: agora, created_by: auth.uid, origem: 'importacao' }));
        }
        const tp = pr.tipo_processo && typeof pr.tipo_processo === 'object' ? pr.tipo_processo : null;
        let tipoId = null;
        if (tp && (0, secretaria_1.texto)(tp.nome)) {
            if (naoExcluidos(await db.collection(context_1.COL.tipos).where('organization_id', '==', orgId).select('excluido').get()).length >= MAX_TIPOS) {
                throw new https_1.HttpsError('resource-exhausted', 'Limite de tipos atingido. Implante sem criar o tipo, ou exclua um tipo antes.');
            }
            const ref = db.collection(context_1.COL.tipos).doc();
            tipoId = ref.id;
            batch.set(ref, {
                nome: (0, secretaria_1.texto)(tp.nome), sigla: (0, secretaria_1.texto)(tp.sigla, 12), descricao: (0, secretaria_1.texto)(tp.descricao, secretaria_1.MAX_TEXTO_LONGO), rito_id: ritoRef.id,
                sigilo_padrao: tp.sigilo_padrao === 'restrito' ? 'restrito' : 'normal', unidade_inicial: ((_m = rito.fases[0]) === null || _m === void 0 ? void 0 : _m.unidade_id) || null,
                ativo: true, organization_id: orgId, created_at: agora, created_by: auth.uid, updated_at: agora, updated_by: auth.uid,
            });
        }
        await batch.commit();
        await audit(editarId ? 'SECRETARIA_RITO_SALVO' : 'SECRETARIA_RITO_IMPLANTADO', {
            rito_id: ritoRef.id, nome: rito.nome, fases: rito.fases.length, unidades_novas: novasUnidades.length, modelos_novos: novosModelos.length, tipo_id: tipoId, versao,
        });
        return { success: true, rito_id: ritoRef.id, versao, tipo_id: tipoId, unidades: novasUnidades.map((u) => u.ref.id), modelos: novosModelos.map((m) => m.ref.id) };
    }
    if (p.action === 'salvarRito') {
        let rito;
        try {
            rito = (0, secretaria_1.sanitizeRito)(p.rito);
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        const modelosOrg = await db.collection(context_1.COL.modelos).where('organization_id', '==', orgId).select('excluido').get();
        rito = filtrarRefsRito(rito, new Set(c.unidades.filter((u) => !u.excluida).map((u) => u.id)), new Set(naoExcluidos(modelosOrg).map((d) => d.id)));
        const col = db.collection(context_1.COL.ritos);
        if (p.id) {
            const ref = col.doc(p.id);
            const snap = await ref.get();
            if (!snap.exists || ((_o = snap.data()) === null || _o === void 0 ? void 0 : _o.organization_id) !== orgId || ((_p = snap.data()) === null || _p === void 0 ? void 0 : _p.excluido) === true)
                throw new https_1.HttpsError('not-found', 'Rito não encontrado');
            await exigirIntegracoes(c, modulosDoRito(rito), modulosDoRito(snap.data()));
            // Processos guardam a cópia das fases com que foram autuados; mudar
            // o rito só vale para os próximos. A versão anterior fica guardada.
            await guardarVersao(ref, snap.data(), CAMPOS_RITO);
            await ref.update(Object.assign(Object.assign({}, rito), { ativo: p.ativo !== false, versao: (Number((_q = snap.data()) === null || _q === void 0 ? void 0 : _q.versao) || 1) + 1, updated_at: agora, updated_by: auth.uid }));
        }
        else {
            const qtd = (await col.where('organization_id', '==', orgId).select('excluido').get()).docs.filter((d) => d.data().excluido !== true).length;
            if (qtd >= MAX_RITOS)
                throw new https_1.HttpsError('resource-exhausted', 'Limite de ritos atingido');
            await exigirIntegracoes(c, modulosDoRito(rito), new Set());
            const ref = await col.add(Object.assign(Object.assign({}, rito), { organization_id: orgId, versao: 1, ativo: true, created_at: agora, created_by: auth.uid }));
            p.id = ref.id;
        }
        await audit('SECRETARIA_RITO_SALVO', { rito_id: p.id, nome: rito.nome });
        return { success: true, id: p.id };
    }
    if (p.action === 'excluirRito') {
        // Exclusão suave: o rito some das listas e não autua mais. Processos já
        // autuados seguem com a cópia das fases; o histórico fica guardado.
        const ref = db.collection(context_1.COL.ritos).doc(String(p.id || '_'));
        const atual = (await ref.get()).data();
        if (!atual || atual.organization_id !== orgId || atual.excluido === true)
            throw new https_1.HttpsError('not-found', 'Rito não encontrado');
        // Tipo excluído não prende o rito (os processos dele já têm a cópia das fases).
        const tipos = naoExcluidos(await db.collection(context_1.COL.tipos).where('organization_id', '==', orgId).where('rito_id', '==', ref.id).select('nome', 'excluido').get());
        if (tipos.length) {
            throw new https_1.HttpsError('failed-precondition', `O rito é usado por ${tipos.length === 1 ? 'um tipo de processo' : `${tipos.length} tipos de processo`} (${tipos.map((d) => d.data().nome).join(', ')}). Troque o rito desses tipos (inclusive os inativos) ou exclua-os antes.`);
        }
        await ref.update({ excluido: true, ativo: false, excluido_em: agora, excluido_por: auth.uid, updated_at: agora, updated_by: auth.uid });
        await audit('SECRETARIA_RITO_EXCLUIDO', { rito_id: ref.id, nome: atual.nome });
        return { success: true };
    }
    if (p.action === 'salvarTipo') {
        const t = (p.tipo && typeof p.tipo === 'object' ? p.tipo : {});
        const nome = (0, secretaria_1.texto)(t.nome);
        if (!nome)
            throw new https_1.HttpsError('invalid-argument', 'Dê um nome ao tipo de processo');
        const rito = (await db.collection(context_1.COL.ritos).doc(String(t.rito_id || '_')).get()).data();
        if (!rito || rito.organization_id !== orgId || rito.excluido === true)
            throw new https_1.HttpsError('invalid-argument', 'Escolha o rito do tipo de processo');
        const pedida = String(t.unidade_inicial || '');
        // Unidade excluída (tipo antigo ou versão restaurada) não volta: fica "a de quem autua", que é o que o editor mostra.
        const unidadeInicial = c.unidades.some((u) => u.id === pedida && u.excluida) ? '' : pedida;
        if (unidadeInicial && !c.unidades.some((u) => u.id === unidadeInicial))
            throw new https_1.HttpsError('invalid-argument', 'Unidade inicial inválida');
        // Tipo próprio de um órgão interno: só as unidades dele autuam.
        const orgaoId = String(t.orgao_id || '');
        if (orgaoId && !(await (0, orgaos_2.lerOrgaos)(db, orgId)).some((o) => o.id === orgaoId))
            throw new https_1.HttpsError('invalid-argument', 'Órgão do tipo de processo inválido');
        // Campos do "Novo processo" deste tipo: os padrões e os próprios do órgão.
        let formulario;
        let numeracao;
        try {
            formulario = (0, camposProcesso_1.sanitizeFormulario)(t.formulario);
            numeracao = (0, numeracao_1.sanitizeNumeracaoTipo)(t.numeracao);
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        // "Exigido para sair das fases": só fases do rito escolhido.
        const faseIds = new Set((rito.fases || []).map((f) => f.id));
        formulario.campos = formulario.campos.map((_a) => {
            var { exigir_em: ex } = _a, x = __rest(_a, ["exigir_em"]);
            const l = (ex || []).filter((f) => faseIds.has(f));
            // Todas as fases marcadas sumiram do rito: o campo ficaria sem exigência nenhuma sem ninguém ver.
            if ((ex === null || ex === void 0 ? void 0 : ex.length) && !l.length) {
                throw new https_1.HttpsError('invalid-argument', `"${x.rotulo}": as fases marcadas em "Exigir para sair das fases" não existem no rito deste tipo. Marque outras ou volte a torná-lo obrigatório.`);
            }
            return l.length ? Object.assign(Object.assign({}, x), { exigir_em: l }) : x;
        });
        const dados = Object.assign(Object.assign({ nome, sigla: (0, secretaria_1.texto)(t.sigla, 12), descricao: (0, secretaria_1.texto)(t.descricao, secretaria_1.MAX_TEXTO_LONGO), rito_id: String(t.rito_id), formulario, numeracao, pode_nascer_de: nascerDe(t.pode_nascer_de), sigilo_padrao: t.sigilo_padrao === 'restrito' ? 'restrito' : 'normal', urgente: t.urgente === true, unidade_inicial: unidadeInicial || null }, ('orgao_id' in t ? { orgao_id: orgaoId || null } : {})), { ativo: t.ativo !== false, updated_at: agora, updated_by: auth.uid });
        const col = db.collection(context_1.COL.tipos);
        if (p.id) {
            const ref = col.doc(p.id);
            const atual = (await ref.get()).data();
            if ((atual === null || atual === void 0 ? void 0 : atual.organization_id) !== orgId || (atual === null || atual === void 0 ? void 0 : atual.excluido) === true)
                throw new https_1.HttpsError('not-found', 'Tipo não encontrado');
            await exigirIntegracoes(c, modulosDoTipo(dados), modulosDoTipo(atual));
            await guardarVersao(ref, atual, CAMPOS_TIPO);
            await ref.update(Object.assign(Object.assign({}, dados), { versao: (Number(atual.versao) || 1) + 1 }));
        }
        else {
            if (naoExcluidos(await col.where('organization_id', '==', orgId).select('excluido').get()).length >= MAX_TIPOS)
                throw new https_1.HttpsError('resource-exhausted', 'Limite de tipos atingido');
            await exigirIntegracoes(c, modulosDoTipo(dados), new Set());
            p.id = (await col.add(Object.assign(Object.assign({}, dados), { versao: 1, organization_id: orgId, created_at: agora, created_by: auth.uid }))).id;
        }
        await audit('SECRETARIA_TIPO_SALVO', { tipo_id: p.id, nome, campos: formulario.campos.length });
        return { success: true, id: p.id };
    }
    if (p.action === 'excluirTipo') {
        // Exclusão suave: o tipo some das listas e não autua mais. Processos já
        // autuados com ele seguem iguais (guardam as fases e os campos).
        const ref = db.collection(context_1.COL.tipos).doc(String(p.id || '_'));
        const atual = (await ref.get()).data();
        if (!atual || atual.organization_id !== orgId || atual.excluido === true)
            throw new https_1.HttpsError('not-found', 'Tipo não encontrado');
        await ref.update({ excluido: true, ativo: false, excluido_em: agora, excluido_por: auth.uid, updated_at: agora, updated_by: auth.uid });
        await audit('SECRETARIA_TIPO_EXCLUIDO', { tipo_id: ref.id, nome: atual.nome });
        return { success: true };
    }
    if (p.action === 'restaurar') {
        // Volta inativo: o admin confere e reativa de propósito.
        const col = p.colecao === 'rito' ? context_1.COL.ritos : p.colecao === 'tipo' ? context_1.COL.tipos : null;
        if (!col)
            throw new https_1.HttpsError('invalid-argument', 'Coleção inválida');
        const ref = db.collection(col).doc(String(p.id || '_'));
        const atual = (await ref.get()).data();
        if (!atual || atual.organization_id !== orgId || atual.excluido !== true)
            throw new https_1.HttpsError('not-found', 'Não encontrado');
        if (naoExcluidos(await db.collection(col).where('organization_id', '==', orgId).select('excluido').get()).length >= (col === context_1.COL.ritos ? MAX_RITOS : MAX_TIPOS)) {
            throw new https_1.HttpsError('resource-exhausted', col === context_1.COL.ritos ? 'Limite de ritos atingido' : 'Limite de tipos atingido');
        }
        const volta = { excluido: false, ativo: false, excluido_em: firestore_1.FieldValue.delete(), excluido_por: firestore_1.FieldValue.delete(), updated_at: agora, updated_by: auth.uid };
        if (col === context_1.COL.tipos) {
            // Tipo cujo rito foi excluído volta com outro rito, escolhido por quem restaura.
            const ritoId = String(p.rito_id || atual.rito_id || '_');
            const rito = (await db.collection(context_1.COL.ritos).doc(ritoId).get()).data();
            if (!rito || rito.organization_id !== orgId || rito.excluido === true) {
                throw new https_1.HttpsError('failed-precondition', 'O rito deste tipo foi excluído. Escolha outro rito para restaurá-lo.');
            }
            volta.rito_id = ritoId;
        }
        await ref.update(volta);
        await audit(col === context_1.COL.ritos ? 'SECRETARIA_RITO_RESTAURADO' : 'SECRETARIA_TIPO_RESTAURADO', { id: ref.id, nome: atual.nome });
        return { success: true };
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