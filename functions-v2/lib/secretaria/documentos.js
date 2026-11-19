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
exports.secretariaDocumento = exports.textoDescritivo = void 0;
exports.descritivos = descritivos;
exports.caminhoArquivo = caminhoArquivo;
const admin = require("firebase-admin");
const autos_1 = require("../shared/autos");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const documento_1 = require("../shared/documento");
const exigencias_1 = require("../shared/exigencias");
const processos_1 = require("./processos");
const portalAvisos_1 = require("./portalAvisos");
const sessoes_1 = require("./sessoes");
const avisosEquipe_1 = require("./avisosEquipe");
const prazosFase_1 = require("../shared/prazosFase");
const secretaria_2 = require("../shared/secretaria");
const context_1 = require("./context");
const autos_2 = require("./autos");
const arquivos_1 = require("./arquivos");
const pdfDocumento_1 = require("./pdfDocumento");
const paraEditor_1 = require("./paraEditor");
const docxExportar_1 = require("./docxExportar");
const audienciaSala_1 = require("./audienciaSala");
const MAX_DESCRICAO_DOC = 500;
/** Descrição e data do documento, conferidas (data futura ou inválida é recusada). Lança HttpsError. */
function descritivos(p, hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })) {
    const descricao = (0, secretaria_1.texto)(p.descricao, MAX_DESCRICAO_DOC);
    const data = typeof p.data_documento === 'string' ? p.data_documento.trim() : '';
    if (data) {
        const d = new Date(`${data}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== data)
            throw new https_1.HttpsError('invalid-argument', 'Data do documento inválida');
        if (data > hoje)
            throw new https_1.HttpsError('invalid-argument', 'A data do documento não pode ser futura');
    }
    return Object.assign(Object.assign({}, (descricao ? { descricao } : {})), (data ? { data_documento: data } : {}));
}
/** O que a juntada (ou a guarda) diz do documento, além do título: a data dele e do que se trata. */
const textoDescritivo = (doc) => `${typeof doc.data_documento === 'string' && doc.data_documento ? ` Documento datado de ${doc.data_documento.split('-').reverse().join('/')}.` : ''}`
    + `${typeof doc.descricao === 'string' && doc.descricao ? ` Do que se trata: ${doc.descricao.replace(/\.$/, '')}.` : ''}`;
exports.textoDescritivo = textoDescritivo;
function caminhoArquivo(orgId, procId, docId) {
    return `secretaria/${orgId}/${procId}/${docId}`;
}
exports.secretariaDocumento = (0, https_1.onCall)(
// Arquivos de até 50 MB: imagem recomprimida e PDF reorganizado pedem memória e tempo.
{ region: context_1.REGION, memory: '1GiB', timeoutSeconds: 300 }, (0, context_1.comSinal)(async (request) => {
    var _a;
    const auth = (0, context_1.exigirAuth)(request);
    const p = request.data || {};
    const c = await (0, context_1.carregarContexto)(auth, p.organizationId);
    // Julgador do colegiado (S3): só baixa ou vê o PDF de documento juntado, e cada leitura fica registrada.
    const leitura = (p.action === 'baixar' || p.action === 'pdf') && !p.versaoId;
    const { ref: procRef, data: proc, julgador } = await (0, context_1.lerProcesso)(c, p.processoId, undefined, { julgador: leitura });
    if (julgador) {
        const d = p.docId ? (await procRef.collection('documentos').doc(String(p.docId)).get()).data() : undefined;
        if (!d || d.status !== 'juntado')
            throw new https_1.HttpsError('not-found', 'Documento não encontrado');
        await (0, sessoes_1.registrarLeitura)(c, procRef, proc, `Leu o documento ${d.ordem ? `nº ${d.ordem}, ` : ''}${String(d.titulo || '')}`);
    }
    // Feriados locais e recesso, se o ato puder abrir prazo de ação.
    const calendario = ['juntar', 'guardar'].includes(String(p.action)) ? await (0, context_1.calendarioDasAcoes)(c.db, c.orgId, proc) : undefined;
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
        if (!(0, secretaria_1.minutaAcessivel)(doc, c.ctx.unidadeIds)) {
            throw new https_1.HttpsError('permission-denied', 'A minuta pertence a outra unidade');
        }
    };
    // Redação anterior: mesma regra de quem vê o documento.
    const lerVersao = async (ref) => {
        const s = await ref.collection('versoes').doc(String(p.versaoId)).get();
        if (!s.exists)
            throw new https_1.HttpsError('not-found', 'Versão não encontrada');
        return s.data();
    };
    const exigirLeitura = (doc) => {
        if (doc.status !== 'juntado' && doc.status !== 'controle' && !(0, secretaria_1.minutaAcessivel)(doc, c.ctx.unidadeIds)) {
            throw new https_1.HttpsError('not-found', 'Documento não encontrado');
        }
    };
    if (p.action === 'versoes') {
        const { ref, doc } = await lerDoc();
        exigirLeitura(doc);
        const s = await ref.collection('versoes').select('autor_nome', 'de', 'titulo', 'substituida_em', 'substituida_por', 'origem', 'nome_arquivo', 'mime', 'assinaturas').get();
        const versoes = s.docs.map((d) => (Object.assign({ id: d.id }, d.data())))
            .sort((a, b) => String(a.substituida_em).localeCompare(String(b.substituida_em)));
        return { versoes };
    }
    if (p.action === 'baixar') {
        const { ref, doc } = await lerDoc();
        exigirLeitura(doc);
        if (p.versaoId) {
            const v = await lerVersao(ref);
            if (v.origem === 'upload') {
                const arq = await (0, arquivos_1.entregar)(await (0, arquivos_1.lerOriginal)(v), String(v.nome_arquivo || v.titulo), String(v.mime), auth.uid);
                return Object.assign({ origem: 'upload', titulo: v.titulo, nomeArquivo: v.nome_arquivo }, arq);
            }
            return { origem: 'editor', titulo: v.titulo, tipo: v.tipo, conteudo: await (0, autos_2.conteudoDoDocumento)(v) };
        }
        if (doc.origem === 'editor')
            return { origem: 'editor', titulo: doc.titulo, tipo: doc.tipo, conteudo: await (0, autos_2.conteudoDoDocumento)(doc) };
        // O original, byte a byte como foi enviado (é a prova; o SHA-256 confere).
        const arq = await (0, arquivos_1.entregar)(await (0, arquivos_1.lerOriginal)(doc), String(doc.nome_arquivo || doc.titulo), String(doc.mime), auth.uid);
        return Object.assign({ origem: 'upload', titulo: doc.titulo, nomeArquivo: doc.nome_arquivo }, arq);
    }
    // PDF do documento: juntado, como está nos autos (com folhas e carimbo);
    // minuta da minha unidade, como prévia com marca d'água.
    if (p.action === 'pdf') {
        const { ref, doc } = await lerDoc();
        const nome = `${String(doc.titulo).replace(/[^\p{L}\p{N} _-]+/gu, '').slice(0, 60) || 'documento'}.pdf`;
        if (p.versaoId) {
            exigirLeitura(doc);
            const v = await lerVersao(ref);
            if (v.origem === 'upload')
                return (0, arquivos_1.entregar)(Buffer.from(await (0, autos_2.pdfDoDocumento)(v, {})), `versao-anterior-${nome}`, 'application/pdf', auth.uid);
            const r = await (0, pdfDocumento_1.renderizarDocumento)(await (0, autos_2.conteudoDoDocumento)(v), await (0, autos_2.lerConfigDocumento)(c.db, c.orgId, doc.unidade_origem), { assinaturas: [], sha256: v.sha256, marcaDagua: 'VERSÃO ANTERIOR' });
            return { base64: r.buffer.toString('base64'), nome: `versao-anterior-${nome}`, paginas: r.paginas };
        }
        if (doc.status === 'juntado')
            return (0, arquivos_1.entregar)(await (0, autos_2.pdfCarimbado)(c.db, c.orgId, procRef.id, String(proc.numero), p.docId, doc), nome, 'application/pdf', auth.uid);
        const controle = doc.status === 'controle';
        if (!controle && !(0, secretaria_1.minutaAcessivel)(doc, c.ctx.unidadeIds))
            throw new https_1.HttpsError('not-found', 'Documento não encontrado');
        if (doc.origem !== 'editor')
            throw new https_1.HttpsError('failed-precondition', controle ? 'Baixe o arquivo original do documento' : 'Baixe o arquivo original da minuta');
        const r = await (0, pdfDocumento_1.renderizarDocumento)(await (0, autos_2.conteudoDoDocumento)(doc), await (0, autos_2.lerConfigDocumento)(c.db, c.orgId, doc.unidade_origem), {
            assinaturas: doc.assinaturas || [], sha256: doc.sha256, marcaDagua: controle ? 'FORA DOS AUTOS' : 'MINUTA',
        });
        return { base64: r.buffer.toString('base64'), nome, paginas: r.paginas };
    }
    // Abrir no editor uma minuta enviada como arquivo (Word, LibreOffice, PDF, texto, planilha, imagem).
    // Nada muda aqui: só ao salvar a minuta passa a ser do editor, e o arquivo fica como versão anterior.
    if (p.action === 'paraEditor') {
        (0, context_1.exigirPosse)(c, proc);
        const { doc } = await lerDoc();
        exigirMinutaDaMinhaUnidade(doc);
        if (doc.origem === 'editor')
            return { titulo: doc.titulo, tipo: doc.tipo, conteudo: await (0, autos_2.conteudoDoDocumento)(doc), avisos: [] };
        try {
            const r = await (0, paraEditor_1.arquivoParaEditor)(await (0, arquivos_1.lerOriginal)(doc), String(doc.mime), String(doc.titulo));
            return Object.assign({ titulo: doc.titulo, tipo: doc.tipo, nomeArquivo: doc.nome_arquivo }, r);
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
    }
    // Trazer o texto de um arquivo do computador para dentro do editor (sem gravar nada no processo).
    if (p.action === 'converter') {
        (0, context_1.exigirPosse)(c, proc);
        const mime = String(p.mime || '');
        if (!secretaria_1.TIPOS_ARQUIVO_PERMITIDOS[mime])
            throw new https_1.HttpsError('invalid-argument', 'Tipo de arquivo não aceito');
        const buf = await (0, arquivos_1.lerArquivoEnviado)(p, auth.uid, mime);
        try {
            return await (0, paraEditor_1.arquivoParaEditor)(buf, mime, (0, secretaria_1.texto)(p.nomeArquivo) || 'Arquivo');
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
    }
    // O texto do editor em Word (.docx), para abrir no Word ou no LibreOffice.
    if (p.action === 'docx') {
        const { doc } = await lerDoc();
        exigirLeitura(doc);
        if (doc.origem !== 'editor')
            throw new https_1.HttpsError('failed-precondition', 'Baixe o arquivo original do documento');
        const conteudo = p.versaoId ? await (0, autos_2.conteudoDoDocumento)(await lerVersao(docsCol.doc(p.docId))) : await (0, autos_2.conteudoDoDocumento)(doc);
        const buf = await (0, docxExportar_1.docParaDocx)(conteudo, await (0, autos_2.lerConfigDocumento)(c.db, c.orgId, doc.unidade_origem), { titulo: String(doc.titulo || '') });
        const nome = `${String(doc.titulo).replace(/[^\p{L}\p{N} _-]+/gu, '').slice(0, 60) || 'documento'}.docx`;
        return (0, arquivos_1.entregar)(buf, nome, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', auth.uid);
    }
    if (p.action === 'criarMinuta' || p.action === 'upload') {
        (0, context_1.exigirPosse)(c, proc);
        const titulo = (0, secretaria_1.texto)(p.titulo) || (p.action === 'upload' ? (0, secretaria_1.texto)(p.nomeArquivo) : '');
        if (!titulo)
            throw new https_1.HttpsError('invalid-argument', 'Informe o título do documento');
        const ref = docsCol.doc();
        const base = Object.assign(Object.assign({ titulo, tipo: (0, secretaria_1.texto)(p.tipo, 60) || 'Documento', status: 'minuta', unidade_origem: proc.unidade_atual, autor_uid: auth.uid, autor_nome: c.userName, criado_em: agoraIso, assinaturas: [] }, ((0, secretaria_1.texto)(p.modelo_id, 40) ? { modelo_id: (0, secretaria_1.texto)(p.modelo_id, 40) } : {})), descritivos(p));
        if (p.action === 'criarMinuta') {
            let conteudo;
            try {
                conteudo = (0, documento_1.sanitizeDoc)(p.conteudo);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            const hash = (0, secretaria_1.sha256)((0, secretaria_1.jsonCanonico)(conteudo));
            const campos = (0, arquivos_1.semApagar)(await (0, arquivos_1.camposDoConteudo)(caminhoArquivo(c.orgId, procRef.id, ref.id), conteudo, hash));
            await ref.set(Object.assign(Object.assign(Object.assign(Object.assign({}, base), { origem: 'editor' }), campos), { sha256: hash }));
            return { success: true, id: ref.id };
        }
        const mime = String(p.mime || '');
        if (!secretaria_1.TIPOS_ARQUIVO_PERMITIDOS[mime])
            throw new https_1.HttpsError('invalid-argument', 'Tipo de arquivo não aceito');
        const buf = await (0, arquivos_1.lerArquivoEnviado)(p, auth.uid, mime);
        const path = caminhoArquivo(c.orgId, procRef.id, ref.id);
        const nomeArquivo = (0, secretaria_1.texto)(p.nomeArquivo) || titulo;
        const hash = (0, secretaria_1.sha256)(buf);
        const paginas = await (0, autos_2.paginasDeArquivo)(buf, mime);
        const bucket = admin.storage().bucket();
        const guardado = await (0, arquivos_1.gravarOriginal)(path, buf, mime);
        // Versão de leitura (folhas, tela, PDF do processo); se falhar, os autos usam o original.
        let leitura = null;
        try {
            const v = await (0, autos_2.versaoDeLeitura)(buf, { mime, titulo, nome_arquivo: nomeArquivo, sha256: hash });
            if (v) {
                await bucket.file(`${path}.leitura.pdf`).save(Buffer.from(v), { contentType: 'application/pdf', resumable: false });
                leitura = { leitura_path: `${path}.leitura.pdf`, leitura_tamanho: v.length };
            }
        }
        catch (e) {
            console.warn('[documentos] versão de leitura não gerada', e);
        }
        try {
            await ref.set(Object.assign(Object.assign(Object.assign(Object.assign({}, base), { origem: 'upload', mime, nome_arquivo: nomeArquivo, fontes: autos_2.FONTES_ATUAIS, tamanho: buf.length, sha256: hash, storage_path: path, paginas }), guardado), (leitura || {})));
        }
        catch (e) {
            // Sem o registro, o arquivo ficaria no armazenamento sem dono.
            await bucket.file(path).delete({ ignoreNotFound: true }).catch(() => undefined);
            if (leitura)
                await bucket.file(leitura.leitura_path).delete({ ignoreNotFound: true }).catch(() => undefined);
            throw e;
        }
        return { success: true, id: ref.id };
    }
    if (p.action === 'editarMinuta') {
        (0, context_1.exigirPosse)(c, proc);
        let conteudo;
        try {
            conteudo = (0, documento_1.sanitizeDoc)(p.conteudo);
        }
        catch (e) {
            (0, context_1.erroUsuario)(e);
        }
        const novoSha = (0, secretaria_1.sha256)((0, secretaria_1.jsonCanonico)(conteudo));
        // Texto grande vai ao Storage antes (num arquivo por versão, então a redação anterior não é sobrescrita).
        const campos = await (0, arquivos_1.camposDoConteudo)(caminhoArquivo(c.orgId, procRef.id, String(p.docId)), conteudo, novoSha);
        // Lido e gravado juntos: dois revisores ao mesmo tempo não perdem a redação anterior.
        const repedir = await c.db.runTransaction(async (tx) => {
            const { ref, doc } = await lerDoc(tx);
            const procAtual = (await tx.get(procRef)).data() || {}; // leituras antes de qualquer escrita
            exigirMinutaDaMinhaUnidade(doc);
            if (doc.origem !== 'editor' && doc.origem !== 'upload')
                throw new https_1.HttpsError('failed-precondition', 'Este documento não se edita');
            const assinaturas = (doc.assinaturas || []);
            if (assinaturas.length && !p.revisarAssinada) {
                throw new https_1.HttpsError('failed-precondition', 'Minuta já assinada: para revisar, confirme que as assinaturas saem e voltam a ser pedidas');
            }
            // Arquivo aberto no editor ou minuta assinada: a redação anterior fica sempre guardada
            // (o arquivo é o original enviado; a assinada é o texto que alguém assinou).
            const converte = doc.origem === 'upload';
            const anterior = converte || assinaturas.length ? versaoGuardada(doc) : (0, secretaria_1.versaoAnterior)(doc, auth.uid, novoSha);
            if (anterior) {
                tx.set(ref.collection('versoes').doc(), Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, anterior), (0, arquivos_1.copiaDoConteudo)(doc)), (converte ? camposDoArquivo(doc) : {})), (assinaturas.length ? { assinaturas } : {})), { substituida_em: agoraIso, substituida_por: c.userName }));
            }
            // Quem tinha assinado precisa ler e assinar de novo (menos quem está revisando, que assina quando quiser).
            const pedidos = assinaturas.filter((a) => a.uid !== auth.uid).map((a) => ({ uid: a.uid, nome: a.nome, por: c.userName, em: agoraIso }));
            const pedidosAntes = (doc.assinaturas_pedidas || []).filter((x) => !pedidos.some((y) => y.uid === x.uid));
            tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, campos), { sha256: novoSha, delta: firestore_1.FieldValue.delete() }), ((0, secretaria_1.texto)(p.titulo) ? { titulo: (0, secretaria_1.texto)(p.titulo) } : {})), ((0, secretaria_1.texto)(p.tipo, 60) ? { tipo: (0, secretaria_1.texto)(p.tipo, 60) } : {})), { editado_em: agoraIso, editado_por: auth.uid, editado_por_nome: c.userName }), (anterior ? { versoes_qtd: firestore_1.FieldValue.increment(1) } : {})), (converte ? Object.assign(Object.assign({ origem: 'editor', convertido_de: String(doc.nome_arquivo || '') }, Object.fromEntries(CAMPOS_ARQUIVO.map((k) => [k, firestore_1.FieldValue.delete()]))), { fontes: autos_2.FONTES_ATUAIS }) : {})), (assinaturas.length ? { assinaturas: [], assinaturas_pedidas: [...pedidosAntes, ...pedidos] } : {})));
            if (pedidos.length) {
                const outros = (procAtual.assinaturas_pendentes || []).filter((x) => !(x.docId === ref.id && pedidos.some((y) => y.uid === x.uid)));
                tx.update(procRef, { assinaturas_pendentes: [...outros, ...pedidos.map((x) => ({ docId: ref.id, uid: x.uid, titulo: (0, secretaria_1.texto)(p.titulo) || String(doc.titulo) }))] });
            }
            return { pedidos, titulo: (0, secretaria_1.texto)(p.titulo) || String(doc.titulo) };
        });
        for (const x of repedir.pedidos)
            void (0, avisosEquipe_1.avisarPedidoAssinatura)(c, x.uid, proc, procRef.id, repedir.titulo);
        return { success: true, assinaturasRetiradas: repedir.pedidos.length };
    }
    if (p.action === 'excluirMinuta') {
        const { ref, doc } = await lerDoc();
        exigirMinutaDaMinhaUnidade(doc);
        // Quem recebeu a minuta com o processo revisa e junta, mas não apaga o trabalho de outra unidade.
        if (!c.ctx.unidadeIds.includes(doc.unidade_origem))
            throw new https_1.HttpsError('permission-denied', 'Só a unidade que redigiu a minuta pode excluí-la');
        // Minuta que seguiu com o processo está sendo revista por quem o recebeu: não some no meio da revisão.
        if (Array.isArray(doc.unidades_acesso) && doc.unidades_acesso.length && !c.ctx.unidadeIds.includes(proc.unidade_atual)) {
            throw new https_1.HttpsError('failed-precondition', 'Esta minuta seguiu com o processo para outra unidade. Ela só pode ser excluída quando o processo voltar à sua unidade.');
        }
        await c.db.recursiveDelete(ref); // com as redações anteriores
        // Minuta do acórdão excluída pela unidade: volta ao redator, que corrige e envia de novo (S6).
        if (doc.acordao_sessao_id && ((_a = proc.acordao) === null || _a === void 0 ? void 0 : _a.documento_id) === ref.id) {
            const sem = { 'acordao.enviado_em': firestore_1.FieldValue.delete(), 'acordao.documento_id': firestore_1.FieldValue.delete() };
            await procRef.update(sem);
            await c.db.collection('secSessoes').doc(String(doc.acordao_sessao_id)).collection('votacoes').doc(procRef.id).update(sem).catch(() => undefined);
        }
        // Termo de audiência excluído: a sala volta a ficar aberta para corrigir e encerrar de novo (S10).
        if (doc.audiencia_id)
            await (0, audienciaSala_1.reabrirSala)(c.db, procRef, String(doc.audiencia_id), ref.id);
        if ((proc.assinaturas_pendentes || []).some((x) => x.docId === ref.id)) {
            await procRef.update({ assinaturas_pendentes: semPedidos(proc.assinaturas_pendentes, ref.id) });
        }
        const bucket = admin.storage().bucket();
        if (doc.storage_path)
            await bucket.file(doc.storage_path).delete({ ignoreNotFound: true });
        if (doc.leitura_path)
            await bucket.file(doc.leitura_path).delete({ ignoreNotFound: true });
        // PDF que uma juntada interrompida tenha deixado e os textos grandes (de todas as redações).
        await bucket.file((0, autos_2.caminhoPdf)(caminhoArquivo(c.orgId, procRef.id, p.docId))).delete({ ignoreNotFound: true });
        await bucket.deleteFiles({ prefix: `${caminhoArquivo(c.orgId, procRef.id, p.docId)}.conteudo.` }).catch(() => undefined);
        // Original de minuta que foi aberta no editor (guardado na versão anterior), com a versão de leitura.
        await bucket.deleteFiles({ prefix: caminhoArquivo(c.orgId, procRef.id, p.docId) }).catch(() => undefined);
        return { success: true };
    }
    // O documento como o rito o confere: tipo, modelo, assinaturas e as atribuições de quem assinou.
    const docJuntado = (doc) => {
        const uids = new Set((doc.assinaturas || []).map((a) => a.uid));
        const atribuicoes = c.unidades.flatMap((u) => (0, secretaria_2.lotacoesDe)(u)).filter((l) => uids.has(l.uid)).map((l) => l.atribuicao).filter((a) => !!a);
        return { origem: String(doc.origem || ''), tipo: doc.tipo, modelo_id: doc.modelo_id, assinaturas: uids.size, atribuicoes };
    };
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
        // Quem assina: alguém da unidade que tem o processo ou da que redigiu a minuta.
        const lot = c.unidades.filter((u) => u.id === doc.unidade_origem || u.id === proc.unidade_atual)
            .flatMap((u) => (0, secretaria_2.lotacoesDe)(u)).find((l) => l.uid === uid);
        if (!lot)
            throw new https_1.HttpsError('invalid-argument', 'Escolha alguém lotado na unidade da minuta ou na que tem o processo');
        if (uid === auth.uid)
            throw new https_1.HttpsError('invalid-argument', 'Você mesmo pode assinar');
        if ((doc.assinaturas || []).some((a) => a.uid === uid))
            throw new https_1.HttpsError('already-exists', 'Essa pessoa já assinou');
        const mem = (await c.db.collection('userOrganizations').doc(`${uid}_${c.orgId}`).get()).data();
        const nome = String((mem === null || mem === void 0 ? void 0 : mem.user_name) || (mem === null || mem === void 0 ? void 0 : mem.user_email) || 'Membro');
        const pedido = { uid, nome, por: c.userName, em: agoraIso };
        // Documento e processo mudam juntos, lidos de novo: dois pedidos ao mesmo tempo não se apagam.
        await c.db.runTransaction(async (tx) => {
            var _a;
            const [dSnap, pSnap] = await Promise.all([tx.get(ref), tx.get(procRef)]);
            const d = dSnap.data();
            if (!d || d.status !== 'minuta')
                throw new https_1.HttpsError('failed-precondition', 'O documento não é mais uma minuta');
            if ((d.assinaturas || []).some((a) => a.uid === uid))
                throw new https_1.HttpsError('already-exists', 'Essa pessoa já assinou');
            tx.update(ref, { assinaturas_pedidas: [...(d.assinaturas_pedidas || []).filter((x) => x.uid !== uid), pedido] });
            tx.update(procRef, { assinaturas_pendentes: [...semPedidos((_a = pSnap.data()) === null || _a === void 0 ? void 0 : _a.assinaturas_pendentes, ref.id, uid), { docId: ref.id, uid, titulo: d.titulo }] });
        });
        void (0, avisosEquipe_1.avisarPedidoAssinatura)(c, uid, proc, procRef.id, String(doc.titulo));
        return { success: true };
    }
    // Fase que segue sozinha: o documento que faltava também conclui a fase, como a última
    // ação obrigatória. Na juntada em conjunto, só o último pedido tenta (o exigido pode ter
    // sido um dos anteriores); `avancarSozinho` confere se nada obrigatório ficou em aberto.
    const podeSeguir = (fase, atual) => (fase === null || fase === void 0 ? void 0 : fase.avanco) === 'auto' && p.aguardar !== true && (0, exigencias_1.exigeAlgo)(fase, (0, exigencias_1.respostasDaFase)(atual));
    const comAvanco = async (r, tentar) => {
        const auto = tentar ? await (0, processos_1.avancarSozinho)(c, procRef.id) : null;
        return Object.assign(Object.assign({ success: true }, r), (auto ? { version: auto.version, avancou: auto.avancou } : {}));
    };
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
        if (pendenciaAlvo && !(0, secretaria_2.unidadeDecide)(c.unidades.find((u) => u.id === proc.unidade_atual))) {
            throw new https_1.HttpsError('permission-denied', 'Pendências são apreciadas pelo gabinete ou por outra unidade que decida');
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
            const r = await (0, pdfDocumento_1.renderizarDocumento)(await (0, autos_2.conteudoDoDocumento)(antes), await (0, autos_2.lerConfigDocumento)(c.db, c.orgId, antes.unidade_origem), {
                assinaturas: antes.assinaturas || [], sha256: antes.sha256,
            });
            paginas = r.paginas;
            pdf = { path: (0, autos_2.caminhoPdf)(caminhoArquivo(c.orgId, procRef.id, p.docId)), sha256: (0, secretaria_1.sha256)(r.buffer) };
            await bucket.file(pdf.path).save(r.buffer, { contentType: 'application/pdf', resumable: false });
        }
        else if (!paginas) {
            paginas = await (0, autos_2.paginasDeArquivo)(await (0, arquivos_1.lerOriginal)(antes), antes.mime, (0, autos_2.ehLegado)(antes));
        }
        const r = await c.db.runTransaction(async (tx) => {
            var _a, _b;
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
            const folha = (await (0, autos_2.folhasDoProcesso)(tx, pr, atual)) + 1;
            const ordem = (Number(atual.doc_seq) || 0) + 1;
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
            // Documento exigido pelo rito na fase (ou numa ação dela): a juntada o cumpre.
            const fase = (atual.fases || []).find((f) => f.id === atual.fase_atual);
            const pendentes = (0, exigencias_1.pendentesDaFase)(fase, atual.exigencias_cumpridas, (0, exigencias_1.respostasDaFase)(atual));
            let cumpre = [];
            try {
                cumpre = (0, exigencias_1.reconhecer)(pendentes, Object.assign(Object.assign({}, docJuntado(doc)), { origem: doc.origem }), p.atende);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            const cumpridas = pendentes.filter((e) => cumpre.includes(e.chave));
            // Documento interno (ex.: informação da secretaria) pode ficar fora do portal das partes;
            // o rito também pode pedir isso para o documento exigido (só esconde, nunca mostra).
            const visivel = p.visivel_partes !== false && !cumpridas.some((e) => e.partes === false);
            // Visível só a alguns polos (ex.: a proposta do acordo, que o ente lesado não vê).
            const soPolos = visivel ? (0, autos_1.polosEscolhidos)(p.visivel_polos, (atual.partes || []).filter((x) => !x.retirada).map((x) => String(x.polo || ''))) : null;
            const marcaPolos = soPolos ? { visivel_polos: soPolos } : {};
            const mov = (0, context_1.registrarMovimento)(tx, c, pr, atual, 'juntada', `Juntado o documento nº ${ordem}: ${doc.titulo} (${doc.tipo}), ${(0, autos_2.textoFolhas)(folha, paginas)}.${(0, exports.textoDescritivo)(doc)}${assin ? ` Assinado por ${assin}.` : ''}${pend.length ? ` Pendência aberta para o decisor${pend[0].interrompe ? ', com interrupção da fase' : ''}.` : ''}${resolvida ? ` Decide a pendência${resolvida.tipo === 'manual' ? '' : `: ${resolvida.descricao}`}.` : ''}`
                + `${cumpridas.length ? ` Cumpre o exigido pelo rito: ${cumpridas.map((e) => e.descricao).join('; ')}.` : ''}`, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ documento_id: ref.id, ordem, sha256: doc.sha256, visivel_partes: visivel }, marcaPolos), { folha_inicial: folha, paginas }), (pdf ? { pdf_sha256: pdf.sha256 } : {})), (resolvida ? { pendencia_id: resolvida.id } : {})), (cumpridas.length ? { exigencias: cumpridas.map((e) => e.chave) } : {})));
            const exig = fase ? (0, exigencias_1.camposDoCumprimento)(atual, fase.id, cumpridas, ref.id, ordem) : {};
            const juntado = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ status: 'juntado', ordem, visivel_partes: visivel }, marcaPolos), { juntado_em: agoraIso, juntado_por: auth.uid, juntado_por_nome: c.userName }), (antes.origem === 'editor' || !(0, autos_2.ehLegado)(antes) ? { fontes: autos_2.FONTES_ATUAIS } : {})), { paginas, folha_inicial: folha, folha_final: folha + paginas - 1 }), (pdf ? { pdf_path: pdf.path, pdf_sha256: pdf.sha256 } : {}));
            const codigo = (0, autos_2.novoCodigo)();
            tx.set(c.db.collection(context_1.COL.verificacao).doc(codigo), (0, autos_2.registroVerificacao)(c.orgId, String(c.org.name || ''), pr.id, atual, ref.id, Object.assign(Object.assign({}, doc), juntado)));
            tx.update(ref, Object.assign(Object.assign({}, juntado), { codigo_verificacao: codigo }));
            const pendencias = [
                ...(atual.pendencias || []).map((x) => (resolvida && x.id === resolvida.id
                    ? Object.assign(Object.assign({}, x), { status: 'resolvida', resolvida_em: agoraIso, resolvida_por: c.userName, resolucao: `Decidida pelo documento nº ${ordem}: ${doc.titulo}` }) : x)),
                ...pend,
            ];
            const mexeuPendencias = pend.length > 0 || !!resolvida;
            // Ação com prazo próprio cumprida pela juntada: o prazo dela se encerra (e o registro interno diz).
            const pzA = (0, prazosFase_1.camposDosPrazosDasAcoes)(atual, exig, fase, c.userName, mexeuPendencias ? pendencias : undefined, calendario);
            const mi = (0, context_1.registrarInternos)(tx, c, pr, Object.assign(Object.assign({}, atual), mov), pzA.notas);
            tx.update(pr, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, mov), mi), exig), { doc_seq: ordem, folhas_seq: folha + paginas - 1 }), (mexeuPendencias ? Object.assign({ pendencias }, (0, secretaria_1.derivados)(pendencias, (atual.prazos || []))) : {})), pzA.campos), ((atual.assinaturas_pendentes || []).some((x) => x.docId === ref.id) ? { assinaturas_pendentes: semPedidos(atual.assinaturas_pendentes, ref.id) } : {})), (doc.acordao_sessao_id && ((_a = atual.acordao) === null || _a === void 0 ? void 0 : _a.documento_id) === ref.id ? { 'acordao.pendente': false, 'acordao.juntado_em': agoraIso, 'acordao.ordem': ordem } : {})));
            return { ordem, version: (_b = mi.version) !== null && _b !== void 0 ? _b : mov.version, folha_inicial: folha, paginas, tentar: podeSeguir(fase, atual), internos: pzA.notas.length ? 1 : 0 };
        });
        void (0, portalAvisos_1.avisarPartesDoMovimento)(c.db, procRef.id, undefined, 1 + r.internos);
        if (p.pendencia === 'sim' || p.pendencia === 'interrompe')
            void (0, avisosEquipe_1.avisarPendencia)(c, proc, procRef.id, `Apreciar o documento nº ${r.ordem}: ${antes.titulo}`);
        const { tentar, internos: _i } = r, feito = __rest(r, ["tentar", "internos"]);
        return comAvanco(feito, tentar);
    }
    if (p.action === 'guardar') {
        // Documento de controle: fica no processo, fora dos autos e da impressão.
        const r = await c.db.runTransaction(async (tx) => {
            var _a;
            const { ref: pr, data: atual } = await (0, context_1.lerProcesso)(c, p.processoId, tx);
            (0, context_1.conferirVersao)(atual, p.version);
            (0, context_1.exigirPosse)(c, atual);
            if (atual.status === 'arquivado')
                throw new https_1.HttpsError('failed-precondition', 'Processo arquivado');
            const { ref, doc } = await lerDoc(tx);
            exigirMinutaDaMinhaUnidade(doc);
            const fase = (atual.fases || []).find((f) => f.id === atual.fase_atual);
            const pendentes = (0, exigencias_1.pendentesDaFase)(fase, atual.exigencias_cumpridas, (0, exigencias_1.respostasDaFase)(atual));
            let cumpre = [];
            try {
                cumpre = (0, exigencias_1.reconhecer)(pendentes, Object.assign(Object.assign({}, docJuntado(doc)), { controle: true }), p.atende);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            const cumpridas = pendentes.filter((e) => cumpre.includes(e.chave));
            // Só no sistema quando o rito pede (pela exigência cumprida ou pela fase); senão, evento no extrato.
            const destino = (0, exigencias_1.destinoDaGuarda)(fase, cumpridas);
            const assin = (doc.assinaturas || []).map((a) => a.nome).join(', ');
            const mov = (0, context_1.registrarMovimento)(tx, c, pr, atual, 'guarda', `Guardado no processo, fora dos autos, o documento "${doc.titulo}" (${doc.tipo}).${(0, exports.textoDescritivo)(doc)}${assin ? ` Assinado por ${assin}.` : ''}`
                + `${cumpridas.length ? ` Cumpre o exigido pelo rito: ${cumpridas.map((e) => e.descricao).join('; ')}.` : ''}`, Object.assign(Object.assign({ documento_id: ref.id, titulo: doc.titulo, sha256: doc.sha256, visivel_partes: false }, (0, exigencias_1.marcasDoDestino)(destino)), (cumpridas.length ? { exigencias: cumpridas.map((e) => e.chave) } : {})));
            const exig = fase ? (0, exigencias_1.camposDoCumprimento)(atual, fase.id, cumpridas, ref.id, null) : {};
            tx.update(ref, { status: 'controle', visivel_partes: false, guardado_em: agoraIso, guardado_por: auth.uid, guardado_por_nome: c.userName });
            const pzA = (0, prazosFase_1.camposDosPrazosDasAcoes)(atual, exig, fase, c.userName, undefined, calendario);
            const mi = (0, context_1.registrarInternos)(tx, c, pr, Object.assign(Object.assign({}, atual), mov), pzA.notas);
            tx.update(pr, Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, mov), mi), exig), pzA.campos), ((atual.assinaturas_pendentes || []).some((x) => x.docId === ref.id) ? { assinaturas_pendentes: semPedidos(atual.assinaturas_pendentes, ref.id) } : {})));
            return { version: (_a = mi.version) !== null && _a !== void 0 ? _a : mov.version, tentar: podeSeguir(fase, atual) };
        });
        const { tentar } = r, feito = __rest(r, ["tentar"]);
        return comAvanco(feito, tentar);
    }
    throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
}));
/** Campos do arquivo enviado: saem da minuta quando ela é aberta no editor e ficam na versão anterior. */
const CAMPOS_ARQUIVO = ['mime', 'nome_arquivo', 'tamanho', 'storage_path', 'paginas', 'compactado', 'tamanho_armazenado', 'leitura_path', 'leitura_tamanho', 'fontes', 'sha256'];
function camposDoArquivo(doc) {
    return Object.assign({ origem: 'upload' }, Object.fromEntries(CAMPOS_ARQUIVO.filter((k) => doc[k] !== undefined).map((k) => [k, doc[k]])));
}
/** Redação anterior guardada mesmo quando quem revisa é quem escreveu (arquivo aberto no editor, minuta assinada). */
function versaoGuardada(doc) {
    return {
        autor_uid: String(doc.editado_por || doc.autor_uid || ''), autor_nome: String(doc.editado_por_nome || doc.autor_nome || ''),
        de: String(doc.editado_em || doc.criado_em || ''), sha256: String(doc.sha256 || ''), titulo: String(doc.titulo || ''), tipo: String(doc.tipo || ''),
    };
}
//# sourceMappingURL=documentos.js.map