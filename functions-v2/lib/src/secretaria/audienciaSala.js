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
exports.ACOES_SALA = void 0;
exports.acaoSalaAudiencia = acaoSalaAudiencia;
exports.reabrirSala = reabrirSala;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const documento_1 = require("../shared/documento");
const audiencias_1 = require("../shared/audiencias");
const audienciaSala_1 = require("../shared/audienciaSala");
const config_1 = require("./config");
const context_1 = require("./context");
const exigencias_1 = require("../shared/exigencias");
exports.ACOES_SALA = ['salaAudiencia', 'salaAbrir', 'salaPresenca', 'salaRegistrar', 'salaRemover', 'salaEncerrar'];
const proximaDe = (lista) => { const x = (0, audiencias_1.audienciasFuturas)(lista, (0, secretaria_1.hojeBrasil)())[0]; return x ? `${x.data}T${x.hora}` : null; };
async function acaoSalaAudiencia(c, p) {
    const quem = { uid: c.ctx.uid, nome: c.userName };
    const hoje = (0, secretaria_1.hojeBrasil)();
    const audId = String(p.audiencia_id || '');
    if (p.action === 'salaAudiencia') {
        const { ref, data } = await (0, context_1.lerProcesso)(c, p.processo_id);
        const a = (data.audiencias || []).find((x) => x.id === audId && x.status === 'designada');
        if (!a)
            throw new https_1.HttpsError('not-found', 'Audiência não encontrada');
        const sala = (await ref.collection('salas').doc(a.id).get()).data();
        const posse = c.ctx.unidadeIds.includes(data.unidade_atual);
        const aberta = !!sala && !sala.encerrada_em;
        return {
            audiencia: Object.assign(Object.assign({}, a), { nome: (0, audiencias_1.nomeDaAudiencia)(a), texto: (0, audiencias_1.textoDaAudiencia)(a) }),
            processo: { id: ref.id, numero: data.numero || '', assunto: data.assunto || '' },
            convocados: (0, audienciaSala_1.convocadosDaAudiencia)(data.partes, data.nomes_polos, a),
            sala: sala || null,
            hoje,
            pode: {
                abrir: posse && !sala && a.data <= hoje,
                registrar: posse && aberta,
                encerrar: posse && (aberta || (!sala && a.data <= hoje)),
                remover: posse && aberta,
            },
        };
    }
    const r = await c.db.runTransaction(async (tx) => {
        const { ref, data } = await (0, context_1.lerProcesso)(c, p.processo_id, tx);
        (0, context_1.exigirPosse)(c, data);
        const lista = [...(data.audiencias || [])];
        const k = lista.findIndex((x) => x.id === audId && x.status === 'designada');
        if (k < 0)
            throw new https_1.HttpsError('not-found', 'Audiência não encontrada');
        const a = lista[k];
        const sref = ref.collection('salas').doc(a.id);
        const sala = (await tx.get(sref)).data();
        const convocados = (0, audienciaSala_1.convocadosDaAudiencia)(data.partes, data.nomes_polos, a);
        if (sala === null || sala === void 0 ? void 0 : sala.encerrada_em)
            throw new https_1.HttpsError('failed-precondition', 'A audiência já foi encerrada: o termo está com a unidade para a juntada');
        if (a.data > hoje)
            throw new https_1.HttpsError('failed-precondition', `A sala abre no dia da audiência (${a.data.split('-').reverse().join('/')})`);
        if (p.action === 'salaAbrir') {
            if (sala)
                throw new https_1.HttpsError('already-exists', 'A sala desta audiência já está aberta');
            const nova = { audiencia_id: a.id, aberta_em: new Date().toISOString(), aberta_por: quem, presencas: (0, audienciaSala_1.sanitizePresencas)({}, convocados), outros: [], ocorrencias: [] };
            tx.set(sref, nova);
            return { ok: true, auditoria: 'SECRETARIA_AUDIENCIA_ABERTA' };
        }
        if (p.action === 'salaEncerrar') {
            const realizada = p.realizada !== false;
            const motivo = (0, secretaria_1.texto)(p.motivo, 1000);
            if (realizada && !sala)
                throw new https_1.HttpsError('failed-precondition', 'Abra a sala antes: a audiência realizada tem presença e registros');
            if (!realizada && motivo.length < 5)
                throw new https_1.HttpsError('invalid-argument', 'Diga por que a audiência não se realizou (ao menos 5 letras)');
            const agora = new Date().toISOString();
            const base = sala || { audiencia_id: a.id, aberta_em: agora, aberta_por: quem, presencas: (0, audienciaSala_1.sanitizePresencas)({}, convocados), outros: [], ocorrencias: [] };
            const un = (await tx.get(c.db.collection(context_1.COL.unidades).doc(String(data.unidade_atual)))).data();
            const nome = (0, audiencias_1.nomeDaAudiencia)(a);
            const titulo = `Termo de ${nome.charAt(0).toLowerCase()}${nome.slice(1)}${realizada ? '' : ' não realizada'}`;
            const t = (0, audienciaSala_1.textoDoTermo)({
                numero: String(data.numero || ''), unidade: String((un === null || un === void 0 ? void 0 : un.nome) || ''), audiencia: a, condutor: base.aberta_por.nome, lavrou: quem.nome,
                convocados, sala: base, realizada, motivo, encerrada_em: agora,
            });
            let conteudo = null;
            try {
                conteudo = (0, documento_1.sanitizeDoc)((0, audienciaSala_1.documentoDoTermo)(titulo, t));
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            const hash = (0, secretaria_1.sha256)((0, secretaria_1.jsonCanonico)(conteudo));
            // Vai à unidade como minuta assinada por quem encerrou; a unidade junta aos autos (e o rito confere).
            const dref = ref.collection('documentos').doc();
            tx.set(dref, {
                titulo, tipo: 'Termo de audiência', status: 'minuta', unidade_origem: data.unidade_atual, autor_uid: quem.uid, autor_nome: quem.nome,
                criado_em: agora, origem: 'editor', conteudo_json: JSON.stringify(conteudo), sha256: hash, audiencia_id: a.id,
                assinaturas: [{ uid: quem.uid, nome: quem.nome, em: agora, sha256: hash, nivel: 'simples' }],
            });
            tx.set(sref, Object.assign(Object.assign(Object.assign(Object.assign({}, base), { encerrada_em: agora, realizada }), (realizada ? {} : { motivo })), { termo_documento_id: dref.id }));
            lista[k] = Object.assign(Object.assign({}, a), { realizada_em: agora, realizada });
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'audiencia_encerrada', `${nome} de ${(0, audiencias_1.textoDaAudiencia)(a, false)} ${realizada ? 'realizada' : `não realizada: ${motivo.replace(/[.\s]+$/, '')}`}. O termo foi para a juntada.`, Object.assign(Object.assign({}, (0, exigencias_1.marcasDoDestino)('informacao')), { audiencia_id: a.id, documento_id_minuta: dref.id }));
            tx.update(ref, Object.assign(Object.assign({}, mov), { audiencias: lista, proxima_audiencia: proximaDe(lista) }));
            return { ok: true, documento_id: dref.id, auditoria: realizada ? 'SECRETARIA_AUDIENCIA_ENCERRADA' : 'SECRETARIA_AUDIENCIA_NAO_REALIZADA' };
        }
        if (!sala)
            throw new https_1.HttpsError('failed-precondition', 'Abra a sala da audiência antes');
        if (p.action === 'salaPresenca') {
            let outros = sala.outros;
            try {
                if (p.outros !== undefined)
                    outros = (0, audienciaSala_1.sanitizeOutros)(p.outros);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            tx.update(sref, { presencas: (0, audienciaSala_1.sanitizePresencas)(p.presencas, convocados), outros });
            return { ok: true };
        }
        if (p.action === 'salaRegistrar') {
            if ((sala.ocorrencias || []).length >= audienciaSala_1.MAX_OCORRENCIAS)
                throw new https_1.HttpsError('failed-precondition', `A sala comporta até ${audienciaSala_1.MAX_OCORRENCIAS} registros`);
            const presentes = [...convocados.filter((x) => sala.presencas[x.chave]).map((x) => x.nome), ...(sala.outros || []).map((x) => x.nome)];
            let campos = null;
            try {
                campos = (0, audienciaSala_1.sanitizeOcorrencia)(p.ocorrencia, presentes);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            const oc = Object.assign(Object.assign({ id: c.db.collection('_').doc().id }, campos), { em: new Date().toISOString(), por: quem.nome });
            if (!audienciaSala_1.COM_QUEM.includes(oc.tipo))
                delete oc.quem;
            tx.update(sref, { ocorrencias: firestore_1.FieldValue.arrayUnion(oc) });
            return { ok: true, ocorrencia_id: oc.id };
        }
        if (p.action === 'salaRemover') {
            const oc = (sala.ocorrencias || []).find((x) => x.id === p.ocorrencia_id);
            if (!oc)
                throw new https_1.HttpsError('not-found', 'Registro não encontrado');
            tx.update(sref, { ocorrencias: sala.ocorrencias.filter((x) => x.id !== oc.id) });
            return { ok: true };
        }
        throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
    });
    const _a = r, { auditoria } = _a, resto = __rest(_a, ["auditoria"]);
    if (auditoria)
        await (0, config_1.auditar)(c.db, c.orgId, quem.uid, quem.nome, auditoria, { processo_id: p.processo_id, audiencia_id: audId });
    return resto;
}
/** Termo excluído pela unidade (minuta): a sala volta a ficar aberta, para corrigir e encerrar de novo. */
async function reabrirSala(db, procRef, audienciaId, documentoId) {
    await db.runTransaction(async (tx) => {
        var _a;
        const sref = procRef.collection('salas').doc(audienciaId);
        const [ps, ss] = await Promise.all([tx.get(procRef), tx.get(sref)]);
        const sala = ss.data();
        if (!sala || sala.termo_documento_id !== documentoId)
            return;
        const lista = (((_a = ps.data()) === null || _a === void 0 ? void 0 : _a.audiencias) || [])
            .map((x) => (x.id === audienciaId ? ((_a) => {
            var { realizada_em: _r, realizada: _x } = _a, resto = __rest(_a, ["realizada_em", "realizada"]);
            return resto;
        })(x) : x));
        tx.update(sref, { encerrada_em: firestore_1.FieldValue.delete(), realizada: firestore_1.FieldValue.delete(), motivo: firestore_1.FieldValue.delete(), termo_documento_id: firestore_1.FieldValue.delete() });
        tx.update(procRef, { audiencias: lista, proxima_audiencia: proximaDe(lista) });
    });
}
//# sourceMappingURL=audienciaSala.js.map