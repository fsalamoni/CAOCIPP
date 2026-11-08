"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaDocumento = void 0;
exports.caminhoArquivo = caminhoArquivo;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const context_1 = require("./context");
function caminhoArquivo(orgId, procId, docId) {
    return `secretaria/${orgId}/${procId}/${docId}`;
}
exports.secretariaDocumento = (0, https_1.onCall)({ region: context_1.REGION, memory: '512MiB' }, async (request) => {
    const auth = (0, context_1.exigirAuth)(request);
    const p = request.data || {};
    const c = await (0, context_1.carregarContexto)(auth, p.organizationId);
    const { ref: procRef, data: proc } = await (0, context_1.lerProcesso)(c, p.processoId);
    const docsCol = procRef.collection('documentos');
    const agoraIso = new Date().toISOString();
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
            return { origem: 'editor', titulo: doc.titulo, delta: doc.delta || [] };
        const [buf] = await admin.storage().bucket().file(doc.storage_path).download();
        return { origem: 'upload', titulo: doc.titulo, mime: doc.mime, nomeArquivo: doc.nome_arquivo, base64: buf.toString('base64') };
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
            let delta;
            try {
                delta = (0, secretaria_1.sanitizeDelta)(p.delta);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            await ref.set(Object.assign(Object.assign({}, base), { origem: 'editor', delta, sha256: (0, secretaria_1.sha256)((0, secretaria_1.jsonCanonico)(delta)) }));
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
        await ref.set(Object.assign(Object.assign({}, base), { origem: 'upload', mime, nome_arquivo: (0, secretaria_1.texto)(p.nomeArquivo) || titulo, tamanho: buf.length, sha256: (0, secretaria_1.sha256)(buf), storage_path: path }));
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
        let delta;
        try {
            delta = (0, secretaria_1.sanitizeDelta)(p.delta);
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        await ref.update(Object.assign(Object.assign(Object.assign({ delta, sha256: (0, secretaria_1.sha256)((0, secretaria_1.jsonCanonico)(delta)) }, ((0, secretaria_1.texto)(p.titulo) ? { titulo: (0, secretaria_1.texto)(p.titulo) } : {})), ((0, secretaria_1.texto)(p.tipo, 60) ? { tipo: (0, secretaria_1.texto)(p.tipo, 60) } : {})), { editado_em: agoraIso }));
        return { success: true };
    }
    if (p.action === 'excluirMinuta') {
        const { ref, doc } = await lerDoc();
        exigirMinutaDaMinhaUnidade(doc);
        await ref.delete();
        if (doc.storage_path)
            await admin.storage().bucket().file(doc.storage_path).delete({ ignoreNotFound: true });
        return { success: true };
    }
    if (p.action === 'assinar') {
        await c.db.runTransaction(async (tx) => {
            const { ref, doc } = await lerDoc(tx);
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
        });
        return { success: true };
    }
    if (p.action === 'juntar') {
        const r = await c.db.runTransaction(async (tx) => {
            const { ref: pr, data: atual } = await (0, context_1.lerProcesso)(c, p.processoId, tx);
            (0, context_1.conferirVersao)(atual, p.version);
            (0, context_1.exigirPosse)(c, atual);
            if (atual.status === 'arquivado')
                throw new https_1.HttpsError('failed-precondition', 'Processo arquivado');
            const { ref, doc } = await lerDoc(tx);
            exigirMinutaDaMinhaUnidade(doc);
            const ordem = (Number(atual.doc_seq) || 0) + 1;
            const assin = (doc.assinaturas || []).map((a) => a.nome).join(', ');
            const mov = (0, context_1.registrarMovimento)(tx, c, pr, atual, 'juntada', `Juntado o documento nº ${ordem}: ${doc.titulo} (${doc.tipo}).${assin ? ` Assinado por ${assin}.` : ''}`, { documento_id: ref.id, ordem, sha256: doc.sha256 });
            tx.update(ref, { status: 'juntado', ordem, juntado_em: agoraIso, juntado_por: auth.uid, juntado_por_nome: c.userName });
            tx.update(pr, Object.assign(Object.assign({}, mov), { doc_seq: ordem }));
            return { ordem, version: mov.version };
        });
        return Object.assign({ success: true }, r);
    }
    throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
});
//# sourceMappingURL=documentos.js.map