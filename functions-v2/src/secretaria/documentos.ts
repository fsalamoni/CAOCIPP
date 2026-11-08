import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
    MAX_UPLOAD_BYTES, Pendencia, Prazo, TIPOS_ARQUIVO_PERMITIDOS, derivados, jsonCanonico, sha256, texto,
} from '../shared/secretaria';
import { sanitizeDoc } from '../shared/documento';
import {
    REGION, carregarContexto, conferirVersao, erroUsuario, exigirAuth, exigirPosse, lerProcesso, registrarMovimento,
} from './context';
import {
    caminhoPdf, conteudoDoDocumento, folhasDoProcesso, lerConfigDocumento, paginasDeArquivo, pdfCarimbado, textoFolhas,
} from './autos';
import { renderizarDocumento } from './pdfDocumento';

/**
 * Documentos do processo. Todo documento nasce como MINUTA da unidade que tem
 * o processo (redigido no editor ou enviado por upload), pode ser assinado
 * pelos lotados nessa unidade e, ao ser JUNTADO, entra nos autos com número
 * de ordem e movimento encadeado. Documento juntado não se edita nem se apaga.
 *
 * Arquivos ficam no Cloud Storage em secretaria/{órgão}/{processo}/{doc}; o
 * navegador nunca acessa o bucket direto (storage.rules nega tudo): envio e
 * download passam por aqui, que confere a permissão.
 */

interface DocRequest {
    organizationId: string;
    processoId: string;
    action: 'criarMinuta' | 'editarMinuta' | 'upload' | 'assinar' | 'juntar' | 'excluirMinuta' | 'baixar' | 'pdf';
    docId?: string;
    version?: number;
    titulo?: string;
    tipo?: string;
    /** Documento do editor (JSON do ProseMirror). */
    conteudo?: unknown;
    nomeArquivo?: string;
    mime?: string;
    base64?: string;
    /** Juntada: 'nao' | 'sim' (abre pendência) | 'interrompe' (abre e suspende a fase). */
    pendencia?: string;
    /** Juntada: false deixa o documento fora do portal das partes. */
    visivel_partes?: boolean;
}

export function caminhoArquivo(orgId: string, procId: string, docId: string) {
    return `secretaria/${orgId}/${procId}/${docId}`;
}

export const secretariaDocumento = onCall<DocRequest>(
    { region: REGION, memory: '512MiB' },
    async (request) => {
        const auth = exigirAuth(request);
        const p = request.data || ({} as DocRequest);
        const c = await carregarContexto(auth, p.organizationId);
        const { ref: procRef, data: proc } = await lerProcesso(c, p.processoId);
        const docsCol = procRef.collection('documentos');
        const agoraIso = new Date().toISOString();

        const lerDoc = async (tx?: admin.firestore.Transaction) => {
            if (!p.docId) throw new HttpsError('invalid-argument', 'docId é obrigatório');
            const r = docsCol.doc(p.docId);
            const s = tx ? await tx.get(r) : await r.get();
            if (!s.exists) throw new HttpsError('not-found', 'Documento não encontrado');
            return { ref: r, doc: s.data() as admin.firestore.DocumentData };
        };
        const exigirMinutaDaMinhaUnidade = (doc: admin.firestore.DocumentData) => {
            if (doc.status !== 'minuta') throw new HttpsError('failed-precondition', 'Documento já juntado aos autos não pode ser alterado');
            if (!c.ctx.unidadeIds.includes(doc.unidade_origem)) {
                throw new HttpsError('permission-denied', 'A minuta pertence a outra unidade');
            }
        };

        if (p.action === 'baixar') {
            const { doc } = await lerDoc();
            if (doc.status !== 'juntado' && !c.ctx.unidadeIds.includes(doc.unidade_origem)) {
                throw new HttpsError('not-found', 'Documento não encontrado');
            }
            if (doc.origem === 'editor') return { origem: 'editor', titulo: doc.titulo, tipo: doc.tipo, conteudo: conteudoDoDocumento(doc) };
            const [buf] = await admin.storage().bucket().file(doc.storage_path).download();
            return { origem: 'upload', titulo: doc.titulo, mime: doc.mime, nomeArquivo: doc.nome_arquivo, base64: buf.toString('base64') };
        }

        // PDF do documento: juntado, como está nos autos (com folhas e carimbo);
        // minuta da minha unidade, como prévia com marca d'água.
        if (p.action === 'pdf') {
            const { doc } = await lerDoc();
            const nome = `${String(doc.titulo).replace(/[^\p{L}\p{N} _-]+/gu, '').slice(0, 60) || 'documento'}.pdf`;
            if (doc.status === 'juntado') return { base64: await pdfCarimbado(c.db, c.orgId, String(proc.numero), doc), nome };
            if (!c.ctx.unidadeIds.includes(doc.unidade_origem)) throw new HttpsError('not-found', 'Documento não encontrado');
            if (doc.origem !== 'editor') throw new HttpsError('failed-precondition', 'Baixe o arquivo original da minuta');
            const r = await renderizarDocumento(conteudoDoDocumento(doc), await lerConfigDocumento(c.db, c.orgId), {
                assinaturas: doc.assinaturas || [], sha256: doc.sha256, marcaDagua: 'MINUTA',
            });
            return { base64: r.buffer.toString('base64'), nome, paginas: r.paginas };
        }

        if (p.action === 'criarMinuta' || p.action === 'upload') {
            exigirPosse(c, proc);
            const titulo = texto(p.titulo) || (p.action === 'upload' ? texto(p.nomeArquivo) : '');
            if (!titulo) throw new HttpsError('invalid-argument', 'Informe o título do documento');
            const ref = docsCol.doc();
            const base = {
                titulo,
                tipo: texto(p.tipo, 60) || 'Documento',
                status: 'minuta',
                unidade_origem: proc.unidade_atual,
                autor_uid: auth.uid,
                autor_nome: c.userName,
                criado_em: agoraIso,
                assinaturas: [],
            };
            if (p.action === 'criarMinuta') {
                let conteudo;
                try { conteudo = sanitizeDoc(p.conteudo); } catch (e) { erroUsuario(e); }
                await ref.set({ ...base, origem: 'editor', conteudo, sha256: sha256(jsonCanonico(conteudo)) });
                return { success: true, id: ref.id };
            }
            const mime = String(p.mime || '');
            if (!TIPOS_ARQUIVO_PERMITIDOS[mime]) throw new HttpsError('invalid-argument', 'Tipo de arquivo não aceito');
            const buf = Buffer.from(String(p.base64 || ''), 'base64');
            if (!buf.length) throw new HttpsError('invalid-argument', 'Arquivo vazio');
            if (buf.length > MAX_UPLOAD_BYTES) throw new HttpsError('invalid-argument', 'Arquivo acima de 5 MB');
            const path = caminhoArquivo(c.orgId, procRef.id, ref.id);
            await admin.storage().bucket().file(path).save(buf, { contentType: mime, resumable: false });
            await ref.set({
                ...base, origem: 'upload', mime, nome_arquivo: texto(p.nomeArquivo) || titulo,
                tamanho: buf.length, sha256: sha256(buf), storage_path: path, paginas: await paginasDeArquivo(buf, mime),
            });
            return { success: true, id: ref.id };
        }

        if (p.action === 'editarMinuta') {
            exigirPosse(c, proc);
            const { ref, doc } = await lerDoc();
            exigirMinutaDaMinhaUnidade(doc);
            if (doc.origem !== 'editor') throw new HttpsError('failed-precondition', 'Arquivo enviado não se edita; exclua a minuta e envie outro');
            if ((doc.assinaturas || []).length) throw new HttpsError('failed-precondition', 'Minuta já assinada não se edita');
            let conteudo;
            try { conteudo = sanitizeDoc(p.conteudo); } catch (e) { erroUsuario(e); }
            await ref.update({
                conteudo, sha256: sha256(jsonCanonico(conteudo)), delta: FieldValue.delete(),
                ...(texto(p.titulo) ? { titulo: texto(p.titulo) } : {}),
                ...(texto(p.tipo, 60) ? { tipo: texto(p.tipo, 60) } : {}),
                editado_em: agoraIso,
            });
            return { success: true };
        }

        if (p.action === 'excluirMinuta') {
            const { ref, doc } = await lerDoc();
            exigirMinutaDaMinhaUnidade(doc);
            await ref.delete();
            const bucket = admin.storage().bucket();
            if (doc.storage_path) await bucket.file(doc.storage_path).delete({ ignoreNotFound: true });
            // PDF que uma juntada interrompida tenha deixado.
            await bucket.file(caminhoPdf(caminhoArquivo(c.orgId, procRef.id, p.docId!))).delete({ ignoreNotFound: true });
            return { success: true };
        }

        if (p.action === 'assinar') {
            await c.db.runTransaction(async (tx) => {
                const { ref, doc } = await lerDoc(tx);
                exigirMinutaDaMinhaUnidade(doc);
                const assinaturas = (doc.assinaturas || []) as Array<{ uid: string }>;
                if (assinaturas.some((a) => a.uid === auth.uid)) throw new HttpsError('already-exists', 'Você já assinou este documento');
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
            // Antes da transação: o PDF do documento (do editor) e quantas folhas
            // ele ocupa. A transação confere que nada mudou desde então.
            const { doc: antes } = await lerDoc();
            exigirMinutaDaMinhaUnidade(antes);
            exigirPosse(c, proc);
            const bucket = admin.storage().bucket();
            let paginas = Number(antes.paginas) || 0;
            let pdf: { path: string; sha256: string } | null = null;
            if (antes.origem === 'editor') {
                const r = await renderizarDocumento(conteudoDoDocumento(antes), await lerConfigDocumento(c.db, c.orgId), {
                    assinaturas: antes.assinaturas || [], sha256: antes.sha256,
                });
                paginas = r.paginas;
                pdf = { path: caminhoPdf(caminhoArquivo(c.orgId, procRef.id, p.docId!)), sha256: sha256(r.buffer) };
                await bucket.file(pdf.path).save(r.buffer, { contentType: 'application/pdf', resumable: false });
            } else if (!paginas) {
                const [buf] = await bucket.file(antes.storage_path).download();
                paginas = await paginasDeArquivo(buf, antes.mime);
            }
            const r = await c.db.runTransaction(async (tx) => {
                const { ref: pr, data: atual } = await lerProcesso(c, p.processoId, tx);
                conferirVersao(atual, p.version);
                exigirPosse(c, atual);
                if (atual.status === 'arquivado') throw new HttpsError('failed-precondition', 'Processo arquivado');
                const { ref, doc } = await lerDoc(tx);
                exigirMinutaDaMinhaUnidade(doc);
                if (doc.sha256 !== antes.sha256 || (doc.assinaturas || []).length !== (antes.assinaturas || []).length) {
                    throw new HttpsError('aborted', 'O documento mudou durante a juntada. Tente de novo.');
                }
                const folha = (await folhasDoProcesso(tx, pr, atual)) + 1;
                const ordem = (Number(atual.doc_seq) || 0) + 1;
                // Documento interno (ex.: informação da secretaria) pode ficar fora do portal das partes.
                const visivel = p.visivel_partes !== false;
                const assin = (doc.assinaturas || []).map((a: { nome: string }) => a.nome).join(', ');
                // Opcional: a juntada já deixa o documento marcado para o
                // decisor apreciar (ex.: petição recebida por outro meio).
                const pend = (p.pendencia === 'sim' || p.pendencia === 'interrompe') ? [{
                    id: pr.collection('_').doc().id, tipo: 'documento', interrompe: p.pendencia === 'interrompe',
                    descricao: `Apreciar o documento nº ${ordem}: ${doc.titulo}`, documento_id: ref.id,
                    status: 'aberta', aberta_em: agoraIso, aberta_por: c.userName,
                } as Pendencia] : [];
                const mov = registrarMovimento(tx, c, pr, atual, 'juntada',
                    `Juntado o documento nº ${ordem}: ${doc.titulo} (${doc.tipo}), ${textoFolhas(folha, paginas)}.${assin ? ` Assinado por ${assin}.` : ''}${pend.length ? ` Pendência aberta para o decisor${pend[0].interrompe ? ', com interrupção da fase' : ''}.` : ''}`,
                    { documento_id: ref.id, ordem, sha256: doc.sha256, visivel_partes: visivel, folha_inicial: folha, paginas, ...(pdf ? { pdf_sha256: pdf.sha256 } : {}) });
                tx.update(ref, {
                    status: 'juntado', ordem, visivel_partes: visivel, juntado_em: agoraIso, juntado_por: auth.uid, juntado_por_nome: c.userName,
                    paginas, folha_inicial: folha, folha_final: folha + paginas - 1,
                    ...(pdf ? { pdf_path: pdf.path, pdf_sha256: pdf.sha256 } : {}),
                });
                const pendencias = [...((atual.pendencias || []) as Pendencia[]), ...pend];
                tx.update(pr, {
                    ...mov, doc_seq: ordem, folhas_seq: folha + paginas - 1,
                    ...(pend.length ? { pendencias, ...derivados(pendencias, (atual.prazos || []) as Prazo[]) } : {}),
                });
                return { ordem, version: mov.version, folha_inicial: folha, paginas };
            });
            return { success: true, ...r };
        }

        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    }
);
