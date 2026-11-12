import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
    MAX_UPLOAD_BYTES, Pendencia, Prazo, TIPOS_ARQUIVO_PERMITIDOS, derivados, jsonCanonico, minutaAcessivel, sha256, texto,
} from '../shared/secretaria';
import { sanitizeDoc } from '../shared/documento';
import type { Fase } from '../shared/secretaria';
import { Cumpridas, Destino, camposDoCumprimento, marcasDoDestino, pendentesDaFase, reconhecer } from '../shared/exigencias';
import { avisarPartesDoMovimento } from './portalAvisos';
import { avisarPedidoAssinatura, avisarPendencia } from './avisosEquipe';
import { lotacoesDe } from '../shared/secretaria';
import {
    COL, REGION, carregarContexto, conferirVersao, erroUsuario, exigirAuth, exigirPosse, lerProcesso, registrarMovimento,
} from './context';
import {
    caminhoPdf, conteudoDoDocumento, folhasDoProcesso, lerConfigDocumento, novoCodigo, paginasDeArquivo, pdfCarimbado,
    registroVerificacao, textoFolhas,
} from './autos';
import { renderizarDocumento } from './pdfDocumento';

/**
 * Documentos do processo. Todo documento nasce como MINUTA da unidade que tem
 * o processo (redigido no editor ou enviado por upload), pode ser assinado
 * pelos lotados nessa unidade e, ao ser JUNTADO, entra nos autos com número
 * de ordem e movimento encadeado. Documento juntado não se edita nem se apaga.
 * Também pode ser GUARDADO fora dos autos (documento de controle, quando o
 * rito pede um documento que não vai à impressão): fica no processo, visível
 * à equipe, sem número de ordem nem folha, e também não se edita nem se apaga.
 *
 * Arquivos ficam no Cloud Storage em secretaria/{órgão}/{processo}/{doc}; o
 * navegador nunca acessa o bucket direto (storage.rules nega tudo): envio e
 * download passam por aqui, que confere a permissão.
 */

interface DocRequest {
    organizationId: string;
    processoId: string;
    action: 'criarMinuta' | 'editarMinuta' | 'upload' | 'assinar' | 'juntar' | 'guardar' | 'excluirMinuta' | 'baixar' | 'pdf' | 'pedirAssinatura';
    docId?: string;
    /** pedirAssinatura: quem deve assinar (lotado na unidade da minuta). */
    uid?: string;
    /** Juntada: assinar antes, no mesmo ato. */
    assinar?: boolean;
    /** Juntada pelo gabinete: o documento é a decisão desta pendência. */
    resolve_pendencia_id?: string;
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
    /** Juntada: chaves das exigências do rito que o documento cumpre (sem isso, reconhece pelo modelo ou tipo). */
    atende?: string[];
    /** criarMinuta/upload: modelo de onde a minuta nasceu. */
    modelo_id?: string;
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
        type Pedido = { docId: string; uid: string; titulo: string };
        const semPedidos = (lista: unknown, docId: string, uid?: string) =>
            ((lista || []) as Pedido[]).filter((x) => !(x.docId === docId && (!uid || x.uid === uid)));

        const lerDoc = async (tx?: admin.firestore.Transaction) => {
            if (!p.docId) throw new HttpsError('invalid-argument', 'docId é obrigatório');
            const r = docsCol.doc(p.docId);
            const s = tx ? await tx.get(r) : await r.get();
            if (!s.exists) throw new HttpsError('not-found', 'Documento não encontrado');
            return { ref: r, doc: s.data() as admin.firestore.DocumentData };
        };
        const exigirMinutaDaMinhaUnidade = (doc: admin.firestore.DocumentData) => {
            if (doc.status !== 'minuta') throw new HttpsError('failed-precondition', 'Documento já juntado aos autos não pode ser alterado');
            if (!minutaAcessivel(doc, c.ctx.unidadeIds)) {
                throw new HttpsError('permission-denied', 'A minuta pertence a outra unidade');
            }
        };

        if (p.action === 'baixar') {
            const { doc } = await lerDoc();
            if (doc.status !== 'juntado' && doc.status !== 'controle' && !minutaAcessivel(doc, c.ctx.unidadeIds)) {
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
            if (doc.status === 'juntado') return { base64: await pdfCarimbado(c.db, c.orgId, procRef.id, String(proc.numero), p.docId!, doc), nome };
            const controle = doc.status === 'controle';
            if (!controle && !minutaAcessivel(doc, c.ctx.unidadeIds)) throw new HttpsError('not-found', 'Documento não encontrado');
            if (doc.origem !== 'editor') throw new HttpsError('failed-precondition', controle ? 'Baixe o arquivo original do documento' : 'Baixe o arquivo original da minuta');
            const r = await renderizarDocumento(conteudoDoDocumento(doc), await lerConfigDocumento(c.db, c.orgId, doc.unidade_origem), {
                assinaturas: doc.assinaturas || [], sha256: doc.sha256, marcaDagua: controle ? 'FORA DOS AUTOS' : 'MINUTA',
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
                ...(texto(p.modelo_id, 40) ? { modelo_id: texto(p.modelo_id, 40) } : {}),
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
            const paginas = await paginasDeArquivo(buf, mime);
            const arquivo = admin.storage().bucket().file(path);
            await arquivo.save(buf, { contentType: mime, resumable: false });
            try {
                await ref.set({
                    ...base, origem: 'upload', mime, nome_arquivo: texto(p.nomeArquivo) || titulo,
                    tamanho: buf.length, sha256: sha256(buf), storage_path: path, paginas,
                });
            } catch (e) {
                // Sem o registro, o arquivo ficaria no armazenamento sem dono.
                await arquivo.delete({ ignoreNotFound: true }).catch(() => undefined);
                throw e;
            }
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
            // Quem recebeu a minuta com o processo revisa e junta, mas não apaga o trabalho de outra unidade.
            if (!c.ctx.unidadeIds.includes(doc.unidade_origem)) throw new HttpsError('permission-denied', 'Só a unidade que redigiu a minuta pode excluí-la');
            // Minuta que seguiu com o processo está sendo revista por quem o recebeu: não some no meio da revisão.
            if (Array.isArray(doc.unidades_acesso) && doc.unidades_acesso.length && !c.ctx.unidadeIds.includes(proc.unidade_atual)) {
                throw new HttpsError('failed-precondition', 'Esta minuta seguiu com o processo para outra unidade. Ela só pode ser excluída quando o processo voltar à sua unidade.');
            }
            await ref.delete();
            if (((proc.assinaturas_pendentes || []) as Pedido[]).some((x) => x.docId === ref.id)) {
                await procRef.update({ assinaturas_pendentes: semPedidos(proc.assinaturas_pendentes, ref.id) });
            }
            const bucket = admin.storage().bucket();
            if (doc.storage_path) await bucket.file(doc.storage_path).delete({ ignoreNotFound: true });
            // PDF que uma juntada interrompida tenha deixado.
            await bucket.file(caminhoPdf(caminhoArquivo(c.orgId, procRef.id, p.docId!))).delete({ ignoreNotFound: true });
            return { success: true };
        }

        const assinarMinuta = () => c.db.runTransaction(async (tx) => {
            const { ref, doc } = await lerDoc(tx);
            const atual = (await tx.get(procRef)).data() || {}; // leituras antes de qualquer escrita
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
            // O pedido de assinatura feito a esta pessoa está atendido.
            if (((atual.assinaturas_pendentes || []) as Pedido[]).some((x) => x.docId === ref.id && x.uid === auth.uid)) {
                tx.update(procRef, { assinaturas_pendentes: semPedidos(atual.assinaturas_pendentes, ref.id, auth.uid) });
            }
        });

        if (p.action === 'assinar') {
            await assinarMinuta();
            return { success: true };
        }

        if (p.action === 'pedirAssinatura') {
            exigirPosse(c, proc);
            const { ref, doc } = await lerDoc();
            exigirMinutaDaMinhaUnidade(doc);
            const uid = String(p.uid || '');
            // Quem assina: alguém da unidade que tem o processo ou da que redigiu a minuta.
            const lot = c.unidades.filter((u) => u.id === doc.unidade_origem || u.id === proc.unidade_atual)
                .flatMap((u) => lotacoesDe(u)).find((l) => l.uid === uid);
            if (!lot) throw new HttpsError('invalid-argument', 'Escolha alguém lotado na unidade da minuta ou na que tem o processo');
            if (uid === auth.uid) throw new HttpsError('invalid-argument', 'Você mesmo pode assinar');
            if (((doc.assinaturas || []) as Array<{ uid: string }>).some((a) => a.uid === uid)) throw new HttpsError('already-exists', 'Essa pessoa já assinou');
            const mem = (await c.db.collection('userOrganizations').doc(`${uid}_${c.orgId}`).get()).data();
            const nome = String(mem?.user_name || mem?.user_email || 'Membro');
            const pedido = { uid, nome, por: c.userName, em: agoraIso };
            // Documento e processo mudam juntos, lidos de novo: dois pedidos ao mesmo tempo não se apagam.
            await c.db.runTransaction(async (tx) => {
                const [dSnap, pSnap] = await Promise.all([tx.get(ref), tx.get(procRef)]);
                const d = dSnap.data();
                if (!d || d.status !== 'minuta') throw new HttpsError('failed-precondition', 'O documento não é mais uma minuta');
                if (((d.assinaturas || []) as Array<{ uid: string }>).some((a) => a.uid === uid)) throw new HttpsError('already-exists', 'Essa pessoa já assinou');
                tx.update(ref, { assinaturas_pedidas: [...((d.assinaturas_pedidas || []) as unknown[]).filter((x) => (x as { uid: string }).uid !== uid), pedido] });
                tx.update(procRef, { assinaturas_pendentes: [...semPedidos(pSnap.data()?.assinaturas_pendentes, ref.id, uid), { docId: ref.id, uid, titulo: d.titulo }] });
            });
            void avisarPedidoAssinatura(c, uid, proc, procRef.id, String(doc.titulo));
            return { success: true };
        }

        if (p.action === 'juntar') {
            // "Assinar e juntar": a assinatura entra antes de renderizar o PDF.
            if (p.assinar) await assinarMinuta().catch((e) => { if (e?.code !== 'already-exists') throw e; });
            // Decisão por despacho: a juntada resolve a pendência indicada (só o gabinete).
            const pendenciaAlvo = p.resolve_pendencia_id
                ? ((proc.pendencias || []) as Pendencia[]).find((x) => x.id === p.resolve_pendencia_id && x.status === 'aberta') : null;
            if (p.resolve_pendencia_id && !pendenciaAlvo) throw new HttpsError('not-found', 'Pendência aberta não encontrada');
            if (pendenciaAlvo && c.unidades.find((u) => u.id === proc.unidade_atual)?.tipo !== 'gabinete') {
                throw new HttpsError('permission-denied', 'Pendências são apreciadas pelo gabinete');
            }
            // Antes da transação: o PDF do documento (do editor) e quantas folhas
            // ele ocupa. A transação confere que nada mudou desde então.
            const { doc: antes } = await lerDoc();
            exigirMinutaDaMinhaUnidade(antes);
            exigirPosse(c, proc);
            const bucket = admin.storage().bucket();
            let paginas = Number(antes.paginas) || 0;
            let pdf: { path: string; sha256: string } | null = null;
            if (antes.origem === 'editor') {
                const r = await renderizarDocumento(conteudoDoDocumento(antes), await lerConfigDocumento(c.db, c.orgId, antes.unidade_origem), {
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
                const resolvida = pendenciaAlvo ? ((atual.pendencias || []) as Pendencia[]).find((x) => x.id === pendenciaAlvo.id && x.status === 'aberta') : null;
                if (pendenciaAlvo && !resolvida) throw new HttpsError('aborted', 'A pendência já foi apreciada por outra pessoa');
                // Documento exigido pelo rito na fase (ou numa ação dela): a juntada o cumpre.
                const fase = ((atual.fases || []) as Fase[]).find((f) => f.id === atual.fase_atual);
                const pendentes = pendentesDaFase(fase, atual.exigencias_cumpridas as Cumpridas | undefined);
                let cumpre: string[] = [];
                try { cumpre = reconhecer(pendentes, { origem: doc.origem, tipo: doc.tipo, modelo_id: doc.modelo_id }, p.atende); } catch (e) { erroUsuario(e); }
                const cumpridas = pendentes.filter((e) => cumpre.includes(e.chave));
                const mov = registrarMovimento(tx, c, pr, atual, 'juntada',
                    `Juntado o documento nº ${ordem}: ${doc.titulo} (${doc.tipo}), ${textoFolhas(folha, paginas)}.${assin ? ` Assinado por ${assin}.` : ''}${pend.length ? ` Pendência aberta para o decisor${pend[0].interrompe ? ', com interrupção da fase' : ''}.` : ''}${resolvida ? ` Decide a pendência: ${resolvida.descricao}.` : ''}`
                    + `${cumpridas.length ? ` Cumpre o exigido pelo rito: ${cumpridas.map((e) => e.descricao).join('; ')}.` : ''}`,
                    { documento_id: ref.id, ordem, sha256: doc.sha256, visivel_partes: visivel, folha_inicial: folha, paginas, ...(pdf ? { pdf_sha256: pdf.sha256 } : {}), ...(resolvida ? { pendencia_id: resolvida.id } : {}),
                        ...(cumpridas.length ? { exigencias: cumpridas.map((e) => e.chave) } : {}) });
                const exig = fase ? camposDoCumprimento(atual, fase.id, cumpridas, ref.id, ordem) : {};
                const juntado = {
                    status: 'juntado', ordem, visivel_partes: visivel, juntado_em: agoraIso, juntado_por: auth.uid, juntado_por_nome: c.userName,
                    paginas, folha_inicial: folha, folha_final: folha + paginas - 1,
                    ...(pdf ? { pdf_path: pdf.path, pdf_sha256: pdf.sha256 } : {}),
                };
                const codigo = novoCodigo();
                tx.set(c.db.collection(COL.verificacao).doc(codigo),
                    registroVerificacao(c.orgId, String(c.org.name || ''), pr.id, atual, ref.id, { ...doc, ...juntado }));
                tx.update(ref, { ...juntado, codigo_verificacao: codigo });
                const pendencias = [
                    ...((atual.pendencias || []) as Pendencia[]).map((x) => (resolvida && x.id === resolvida.id
                        ? { ...x, status: 'resolvida' as const, resolvida_em: agoraIso, resolvida_por: c.userName, resolucao: `Decidida pelo documento nº ${ordem}: ${doc.titulo}` }
                        : x)),
                    ...pend,
                ];
                const mexeuPendencias = pend.length > 0 || !!resolvida;
                tx.update(pr, {
                    ...mov, ...exig, doc_seq: ordem, folhas_seq: folha + paginas - 1,
                    ...(mexeuPendencias ? { pendencias, ...derivados(pendencias, (atual.prazos || []) as Prazo[]) } : {}),
                    ...(((atual.assinaturas_pendentes || []) as Pedido[]).some((x) => x.docId === ref.id) ? { assinaturas_pendentes: semPedidos(atual.assinaturas_pendentes, ref.id) } : {}),
                });
                return { ordem, version: mov.version, folha_inicial: folha, paginas };
            });
            void avisarPartesDoMovimento(c.db, procRef.id);
            if (p.pendencia === 'sim' || p.pendencia === 'interrompe') void avisarPendencia(c, proc, procRef.id, `Apreciar o documento nº ${r.ordem}: ${antes.titulo}`);
            return { success: true, ...r };
        }

        if (p.action === 'guardar') {
            // Documento de controle: fica no processo, fora dos autos e da impressão.
            const r = await c.db.runTransaction(async (tx) => {
                const { ref: pr, data: atual } = await lerProcesso(c, p.processoId, tx);
                conferirVersao(atual, p.version);
                exigirPosse(c, atual);
                if (atual.status === 'arquivado') throw new HttpsError('failed-precondition', 'Processo arquivado');
                const { ref, doc } = await lerDoc(tx);
                exigirMinutaDaMinhaUnidade(doc);
                const fase = ((atual.fases || []) as Fase[]).find((f) => f.id === atual.fase_atual);
                const pendentes = pendentesDaFase(fase, atual.exigencias_cumpridas as Cumpridas | undefined);
                let cumpre: string[] = [];
                try { cumpre = reconhecer(pendentes, { origem: doc.origem, tipo: doc.tipo, modelo_id: doc.modelo_id, controle: true }, p.atende); } catch (e) { erroUsuario(e); }
                const cumpridas = pendentes.filter((e) => cumpre.includes(e.chave));
                // Só no sistema quando tudo o que ele cumpre o rito quer só no sistema; senão, evento no extrato.
                const destino: Destino = cumpridas.length && cumpridas.every((e) => e.destino === 'informacao') ? 'informacao' : 'evento';
                const assin = (doc.assinaturas || []).map((a: { nome: string }) => a.nome).join(', ');
                const mov = registrarMovimento(tx, c, pr, atual, 'guarda',
                    `Guardado no processo, fora dos autos, o documento "${doc.titulo}" (${doc.tipo}).${assin ? ` Assinado por ${assin}.` : ''}`
                    + `${cumpridas.length ? ` Cumpre o exigido pelo rito: ${cumpridas.map((e) => e.descricao).join('; ')}.` : ''}`,
                    { documento_id: ref.id, titulo: doc.titulo, sha256: doc.sha256, visivel_partes: false, ...marcasDoDestino(destino),
                        ...(cumpridas.length ? { exigencias: cumpridas.map((e) => e.chave) } : {}) });
                const exig = fase ? camposDoCumprimento(atual, fase.id, cumpridas, ref.id, null) : {};
                tx.update(ref, { status: 'controle', visivel_partes: false, guardado_em: agoraIso, guardado_por: auth.uid, guardado_por_nome: c.userName });
                tx.update(pr, {
                    ...mov, ...exig,
                    ...(((atual.assinaturas_pendentes || []) as Pedido[]).some((x) => x.docId === ref.id) ? { assinaturas_pendentes: semPedidos(atual.assinaturas_pendentes, ref.id) } : {}),
                });
                return { version: mov.version };
            });
            return { success: true, ...r };
        }

        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    }
);
