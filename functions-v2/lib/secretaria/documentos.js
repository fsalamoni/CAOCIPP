"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaDocumento = void 0;
exports.caminhoArquivo = caminhoArquivo;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const documento_1 = require("../shared/documento");
const portalAvisos_1 = require("./portalAvisos");
const avisosEquipe_1 = require("./avisosEquipe");
const secretaria_2 = require("../shared/secretaria");
const context_1 = require("./context");
const autos_1 = require("./autos");
const pdfDocumento_1 = require("./pdfDocumento");
function caminhoArquivo(orgId, procId, docId) {
    return `secretaria/${orgId}/${procId}/${docId}`;
}
exports.secretariaDocumento = (0, https_1.onCall)({ region: context_1.REGION, memory: '512MiB' }, async (request) => {
    var _a;
    const auth = (0, context_1.exigirAuth)(request);
    const p = request.data || {};
    const c = await (0, context_1.carregarContexto)(auth, p.organizationId);
    const { ref: procRef, data: proc } = await (0, context_1.lerProcesso)(c, p.processoId);
    const docsCol = procRef.collection('documentos');
    const agoraIso = new Date().toISOString();
    const semPedidos = (lista, docId, uid) => (lista || []).filter((x) => !(x.docId === docId && (!uid || x.uid === uid)));
    const lerDoc = async (tx) => {
        if (!p.docId)
            throw new https_1.HttpsError('invalid-argument', 'docId é obrigatório');
        const r = docsCol.doc(p.docId);
        const s = tx ? await tx.get(r) : await r.get();
        if (!s.exists)
            throw new https_1.HttpsError('not-found', 'Documento não encontrado');
        return { ref: r, doc: s.data() };
    };
    const exigirMinutaDaMinhaUnidade = (doc) => {
        if (doc.status !== 'minuta')
            throw new https_1.HttpsError('failed-precondition', 'Documento já juntado aos autos não pode ser alterado');
        if (!c.ctx.unidadeIds.includes(doc.unidade_origem)) {
            throw new https_1.HttpsError('permission-denied', 'A minuta pertence a outra unidade');
        }
    };
    if (p.action === 'baixar') {
        const { doc } = await lerDoc();
        if (doc.status !== 'juntado' && !c.ctx.unidadeIds.includes(doc.unidade_origem)) {
            throw new https_1.HttpsError('not-found', 'Documento não encontrado');
        }
        if (doc.origem === 'editor')
            return { origem: 'editor', titulo: doc.titulo, tipo: doc.tipo, conteudo: (0, autos_1.conteudoDoDocumento)(doc) };
        const [buf] = await admin.storage().bucket().file(doc.storage_path).download();
        return { origem: 'upload', titulo: doc.titulo, mime: doc.mime, nomeArquivo: doc.nome_arquivo, base64: buf.toString('base64') };
    }
    // PDF do documento: juntado, como está nos autos (com folhas e carimbo);
    // minuta da minha unidade, como prévia com marca d'água.
    if (p.action === 'pdf') {
        const { doc } = await lerDoc();
        const nome = `${String(doc.titulo).replace(/[^\p{L}\p{N} _-]+/gu, '').slice(0, 60) || 'documento'}.pdf`;
        if (doc.status === 'juntado')
            return { base64: await (0, autos_1.pdfCarimbado)(c.db, c.orgId, procRef.id, String(proc.numero), p.docId, doc), nome };
        if (!c.ctx.unidadeIds.includes(doc.unidade_origem))
            throw new https_1.HttpsError('not-found', 'Documento não encontrado');
        if (doc.origem !== 'editor')
            throw new https_1.HttpsError('failed-precondition', 'Baixe o arquivo original da minuta');
        const r = await (0, pdfDocumento_1.renderizarDocumento)((0, autos_1.conteudoDoDocumento)(doc), await (0, autos_1.lerConfigDocumento)(c.db, c.orgId, doc.unidade_origem), {
            assinaturas: doc.assinaturas || [], sha256: doc.sha256, marcaDagua: 'MINUTA',
        });
        return { base64: r.buffer.toString('base64'), nome, paginas: r.paginas };
    }
    if (p.action === 'criarMinuta' || p.action === 'upload') {
        (0, context_1.exigirPosse)(c, proc);
        const titulo = (0, secretaria_1.texto)(p.titulo) || (p.action === 'upload' ? (0, secretaria_1.texto)(p.nomeArquivo) : '');
        if (!titulo)
            throw new https_1.HttpsError('invalid-argument', 'Informe o título do documento');
        const ref = docsCol.doc();
        const base = {
            titulo,
            tipo: (0, secretaria_1.texto)(p.tipo, 60) || 'Documento',
            status: 'minuta',
            unidade_origem: proc.unidade_atual,
            autor_uid: auth.uid,
            autor_nome: c.userName,
            criado_em: agoraIso,
            assinaturas: [],
        };
        if (p.action === 'criarMinuta') {
            let conteudo;
            try {
                conteudo = (0, documento_1.sanitizeDoc)(p.conteudo);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            await ref.set(Object.assign(Object.assign({}, base), { origem: 'editor', conteudo, sha256: (0, secretaria_1.sha256)((0, secretaria_1.jsonCanonico)(conteudo)) }));
            return { success: true, id: ref.id };
        }
        const mime = String(p.mime || '');
        if (!secretaria_1.TIPOS_ARQUIVO_PERMITIDOS[mime])
            throw new https_1.HttpsError('invalid-argument', 'Tipo de arquivo não aceito');
        const buf = Buffer.from(String(p.base64 || ''), 'base64');
        if (!buf.length)
            throw new https_1.HttpsError('invalid-argument', 'Arquivo vazio');
        if (buf.length > secretaria_1.MAX_UPLOAD_BYTES)
            throw new https_1.HttpsError('invalid-argument', 'Arquivo acima de 5 MB');
        const path = caminhoArquivo(c.orgId, procRef.id, ref.id);
        await admin.storage().bucket().file(path).save(buf, { contentType: mime, resumable: false });
        await ref.set(Object.assign(Object.assign({}, base), { origem: 'upload', mime, nome_arquivo: (0, secretaria_1.texto)(p.nomeArquivo) || titulo, tamanho: buf.length, sha256: (0, secretaria_1.sha256)(buf), storage_path: path, paginas: await (0, autos_1.paginasDeArquivo)(buf, mime) }));
        return { success: true, id: ref.id };
    }
    if (p.action === 'editarMinuta') {
        (0, context_1.exigirPosse)(c, proc);
        const { ref, doc } = await lerDoc();
        exigirMinutaDaMinhaUnidade(doc);
        if (doc.origem !== 'editor')
            throw new https_1.HttpsError('failed-precondition', 'Arquivo enviado não se edita; exclua a minuta e envie outro');
        if ((doc.assinaturas || []).length)
            throw new https_1.HttpsError('failed-precondition', 'Minuta já assinada não se edita');
        let conteudo;
        try {
            conteudo = (0, documento_1.sanitizeDoc)(p.conteudo);
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        await ref.update(Object.assign(Object.assign(Object.assign({ conteudo, sha256: (0, secretaria_1.sha256)((0, secretaria_1.jsonCanonico)(conteudo)), delta: firestore_1.FieldValue.delete() }, ((0, secretaria_1.texto)(p.titulo) ? { titulo: (0, secretaria_1.texto)(p.titulo) } : {})), ((0, secretaria_1.texto)(p.tipo, 60) ? { tipo: (0, secretaria_1.texto)(p.tipo, 60) } : {})), { editado_em: agoraIso }));
        return { success: true };
    }
    if (p.action === 'excluirMinuta') {
        const { ref, doc } = await lerDoc();
        exigirMinutaDaMinhaUnidade(doc);
        await ref.delete();
        if ((proc.assinaturas_pendentes || []).some((x) => x.docId === ref.id)) {
            await procRef.update({ assinaturas_pendentes: semPedidos(proc.assinaturas_pendentes, ref.id) });
        }
        const bucket = admin.storage().bucket();
        if (doc.storage_path)
            await bucket.file(doc.storage_path).delete({ ignoreNotFound: true });
        // PDF que uma juntada interrompida tenha deixado.
        await bucket.file((0, autos_1.caminhoPdf)(caminhoArquivo(c.orgId, procRef.id, p.docId))).delete({ ignoreNotFound: true });
        return { success: true };
    }
    const assinarMinuta = () => c.db.runTransaction(async (tx) => {
        const { ref, doc } = await lerDoc(tx);
        const atual = (await tx.get(procRef)).data() || {}; // leituras antes de qualquer escrita
        exigirMinutaDaMinhaUnidade(doc);
        const assinaturas = (doc.assinaturas || []);
        if (assinaturas.some((a) => a.uid === auth.uid))
            throw new https_1.HttpsError('already-exists', 'Você já assinou este documento');
        // Assinatura eletrônica simples (Lei 14.063/2020, art. 4º, I):
        // identifica o signatário pela conta autenticada e amarra ao
        // hash do conteúdo naquele instante.
        tx.update(ref, {
            assinaturas: [...assinaturas, {
                    uid: auth.uid, nome: c.userName, em: agoraIso, sha256: doc.sha256, nivel: 'simples',
                }],
        });
        // O pedido de assinatura feito a esta pessoa está atendido.
        if ((atual.assinaturas_pendentes || []).some((x) => x.docId === ref.id && x.uid === auth.uid)) {
            tx.update(procRef, { assinaturas_pendentes: semPedidos(atual.assinaturas_pendentes, ref.id, auth.uid) });
        }
    });
    if (p.action === 'assinar') {
        await assinarMinuta();
        return { success: true };
    }
    if (p.action === 'pedirAssinatura') {
        (0, context_1.exigirPosse)(c, proc);
        const { ref, doc } = await lerDoc();
        exigirMinutaDaMinhaUnidade(doc);
        const uid = String(p.uid || '');
        const unidade = c.unidades.find((u) => u.id === doc.unidade_origem);
        const lot = unidade ? (0, secretaria_2.lotacoesDe)(unidade).find((l) => l.uid === uid) : null;
        if (!lot)
            throw new https_1.HttpsError('invalid-argument', 'Escolha alguém lotado na unidade da minuta');
        if (uid === auth.uid)
            throw new https_1.HttpsError('invalid-argument', 'Você mesmo pode assinar');
        if ((doc.assinaturas || []).some((a) => a.uid === uid))
            throw new https_1.HttpsError('already-exists', 'Essa pessoa já assinou');
        const mem = (await c.db.collection('userOrganizations').doc(`${uid}_${c.orgId}`).get()).data();
        const nome = String((mem === null || mem === void 0 ? void 0 : mem.user_name) || (mem === null || mem === void 0 ? void 0 : mem.user_email) || 'Membro');
        const pedido = { uid, nome, por: c.userName, em: agoraIso };
        await ref.update({ assinaturas_pedidas: [...(doc.assinaturas_pedidas || []).filter((x) => x.uid !== uid), pedido] });
        await procRef.update({ assinaturas_pendentes: [...semPedidos(proc.assinaturas_pendentes, ref.id, uid), { docId: ref.id, uid, titulo: doc.titulo }] });
        void (0, avisosEquipe_1.avisarPedidoAssinatura)(c, uid, proc, procRef.id, String(doc.titulo));
        return { success: true };
    }
    if (p.action === 'juntar') {
        // "Assinar e juntar": a assinatura entra antes de renderizar o PDF.
        if (p.assinar)
            await assinarMinuta().catch((e) => { if ((e === null || e === void 0 ? void 0 : e.code) !== 'already-exists')
                throw e; });
        // Decisão por despacho: a juntada resolve a pendência indicada (só o gabinete).
        const pendenciaAlvo = p.resolve_pendencia_id
            ? (proc.pendencias || []).find((x) => x.id === p.resolve_pendencia_id && x.status === 'aberta') : null;
        if (p.resolve_pendencia_id && !pendenciaAlvo)
            throw new https_1.HttpsError('not-found', 'Pendência aberta não encontrada');
        if (pendenciaAlvo && ((_a = c.unidades.find((u) => u.id === proc.unidade_atual)) === null || _a === void 0 ? void 0 : _a.tipo) !== 'gabinete') {
            throw new https_1.HttpsError('permission-denied', 'Pendências são apreciadas pelo gabinete');
        }
        // Antes da transação: o PDF do documento (do editor) e quantas folhas
        // ele ocupa. A transação confere que nada mudou desde então.
        const { doc: antes } = await lerDoc();
        exigirMinutaDaMinhaUnidade(antes);
        (0, context_1.exigirPosse)(c, proc);
        const bucket = admin.storage().bucket();
        let paginas = Number(antes.paginas) || 0;
        let pdf = null;
        if (antes.origem === 'editor') {
            const r = await (0, pdfDocumento_1.renderizarDocumento)((0, autos_1.conteudoDoDocumento)(antes), await (0, autos_1.lerConfigDocumento)(c.db, c.orgId, antes.unidade_origem), {
                assinaturas: antes.assinaturas || [], sha256: antes.sha256,
            });
            paginas = r.paginas;
            pdf = { path: (0, autos_1.caminhoPdf)(caminhoArquivo(c.orgId, procRef.id, p.docId)), sha256: (0, secretaria_1.sha256)(r.buffer) };
            await bucket.file(pdf.path).save(r.buffer, { contentType: 'application/pdf', resumable: false });
        }
        else if (!paginas) {
            const [buf] = await bucket.file(antes.storage_path).download();
            paginas = await (0, autos_1.paginasDeArquivo)(buf, antes.mime);
        }
        const r = await c.db.runTransaction(async (tx) => {
            const { ref: pr, data: atual } = await (0, context_1.lerProcesso)(c, p.processoId, tx);
            (0, context_1.conferirVersao)(atual, p.version);
            (0, context_1.exigirPosse)(c, atual);
            if (atual.status === 'arquivado')
                throw new https_1.HttpsError('failed-precondition', 'Processo arquivado');
            const { ref, doc } = await lerDoc(tx);
            exigirMinutaDaMinhaUnidade(doc);
            if (doc.sha256 !== antes.sha256 || (doc.assinaturas || []).length !== (antes.assinaturas || []).length) {
                throw new https_1.HttpsError('aborted', 'O documento mudou durante a juntada. Tente de novo.');
            }
            const folha = (await (0, autos_1.folhasDoProcesso)(tx, pr, atual)) + 1;
            const ordem = (Number(atual.doc_seq) || 0) + 1;
            // Documento interno (ex.: informação da secretaria) pode ficar fora do portal das partes.
            const visivel = p.visivel_partes !== false;
            const assin = (doc.assinaturas || []).map((a) => a.nome).join(', ');
            // Opcional: a juntada já deixa o documento marcado para o
            // decisor apreciar (ex.: petição recebida por outro meio).
            const pend = (p.pendencia === 'sim' || p.pendencia === 'interrompe') ? [{
                    id: pr.collection('_').doc().id, tipo: 'documento', interrompe: p.pendencia === 'interrompe',
                    descricao: `Apreciar o documento nº ${ordem}: ${doc.titulo}`, documento_id: ref.id,
                    status: 'aberta', aberta_em: agoraIso, aberta_por: c.userName,
                }] : [];
            const resolvida = pendenciaAlvo ? (atual.pendencias || []).find((x) => x.id === pendenciaAlvo.id && x.status === 'aberta') : null;
            if (pendenciaAlvo && !resolvida)
                throw new https_1.HttpsError('aborted', 'A pendência já foi apreciada por outra pessoa');
            const mov = (0, context_1.registrarMovimento)(tx, c, pr, atual, 'juntada', `Juntado o documento nº ${ordem}: ${doc.titulo} (${doc.tipo}), ${(0, autos_1.textoFolhas)(folha, paginas)}.${assin ? ` Assinado por ${assin}.` : ''}${pend.length ? ` Pendência aberta para o decisor${pend[0].interrompe ? ', com interrupção da fase' : ''}.` : ''}${resolvida ? ` Decide a pendência: ${resolvida.descricao}.` : ''}`, Object.assign(Object.assign({ documento_id: ref.id, ordem, sha256: doc.sha256, visivel_partes: visivel, folha_inicial: folha, paginas }, (pdf ? { pdf_sha256: pdf.sha256 } : {})), (resolvida ? { pendencia_id: resolvida.id } : {})));
            const juntado = Object.assign({ status: 'juntado', ordem, visivel_partes: visivel, juntado_em: agoraIso, juntado_por: auth.uid, juntado_por_nome: c.userName, paginas, folha_inicial: folha, folha_final: folha + paginas - 1 }, (pdf ? { pdf_path: pdf.path, pdf_sha256: pdf.sha256 } : {}));
            const codigo = (0, autos_1.novoCodigo)();
            tx.set(c.db.collection(context_1.COL.verificacao).doc(codigo), (0, autos_1.registroVerificacao)(c.orgId, String(c.org.name || ''), pr.id, atual, ref.id, Object.assign(Object.assign({}, doc), juntado)));
            tx.update(ref, Object.assign(Object.assign({}, juntado), { codigo_verificacao: codigo }));
            const pendencias = [
                ...(atual.pendencias || []).map((x) => (resolvida && x.id === resolvida.id
                    ? Object.assign(Object.assign({}, x), { status: 'resolvida', resolvida_em: agoraIso, resolvida_por: c.userName, resolucao: `Decidida pelo documento nº ${ordem}: ${doc.titulo}` }) : x)),
                ...pend,
            ];
            const mexeuPendencias = pend.length > 0 || !!resolvida;
            tx.update(pr, Object.assign(Object.assign(Object.assign(Object.assign({}, mov), { doc_seq: ordem, folhas_seq: folha + paginas - 1 }), (mexeuPendencias ? Object.assign({ pendencias }, (0, secretaria_1.derivados)(pendencias, (atual.prazos || []))) : {})), ((atual.assinaturas_pendentes || []).some((x) => x.docId === ref.id) ? { assinaturas_pendentes: semPedidos(atual.assinaturas_pendentes, ref.id) } : {})));
            return { ordem, version: mov.version, folha_inicial: folha, paginas };
        });
        void (0, portalAvisos_1.avisarPartesDoMovimento)(c.db, procRef.id);
        if (p.pendencia === 'sim' || p.pendencia === 'interrompe')
            void (0, avisosEquipe_1.avisarPendencia)(c, proc, procRef.id, `Apreciar o documento nº ${r.ordem}: ${antes.titulo}`);
        return Object.assign({ success: true }, r);
    }
    throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
});
//# sourceMappingURL=documentos.js.map