import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
    Pendencia, Prazo, TIPOS_ARQUIVO_PERMITIDOS, derivados, jsonCanonico, minutaAcessivel, sha256, texto, versaoAnterior,
} from '../shared/secretaria';
import { sanitizeDoc } from '../shared/documento';
import type { Fase } from '../shared/secretaria';
import { Cumpridas, camposDoCumprimento, destinoDaGuarda, exigeAlgo, marcasDoDestino, pendentesDaFase, reconhecer, respostasDaFase } from '../shared/exigencias';
import { avancarSozinho } from './processos';
import { avisarPartesDoMovimento } from './portalAvisos';
import { registrarLeitura } from './sessoes';
import { avisarPedidoAssinatura, avisarPendencia } from './avisosEquipe';
import { camposDosPrazosDasAcoes } from '../shared/prazosFase';
import { lotacoesDe, unidadeDecide } from '../shared/secretaria';
import {
    COL, REGION, calendarioDasAcoes, carregarContexto, conferirVersao, erroUsuario, exigirAuth, exigirPosse, lerProcesso, registrarInternos, registrarMovimento,
    comSinal,
} from './context';
import {
    caminhoPdf, conteudoDoDocumento, folhasDoProcesso, lerConfigDocumento, novoCodigo, paginasDeArquivo, pdfCarimbado,
    registroVerificacao, textoFolhas, versaoDeLeitura,
} from './autos';
import { camposDoConteudo, copiaDoConteudo, entregar, gravarOriginal, lerArquivoEnviado, lerOriginal, semApagar } from './arquivos';
import { renderizarDocumento } from './pdfDocumento';
import { reabrirSala } from './audienciaSala';

/**
 * Documentos do processo. Todo documento nasce como MINUTA da unidade que tem
 * o processo (redigido no editor ou enviado por upload), pode ser assinado
 * pelos lotados nessa unidade e, ao ser JUNTADO, entra nos autos com número
 * de ordem e movimento encadeado. Documento juntado não se edita nem se apaga.
 * Também pode ser GUARDADO fora dos autos (documento de controle, quando o
 * rito pede um documento que não vai à impressão): fica no processo, visível
 * à equipe, sem número de ordem nem folha, e também não se edita nem se apaga.
 *
 * Minuta que muda de mãos (ex.: a assessoria redige, o gabinete revisa) guarda
 * a redação anterior em documentos/{id}/versoes. As versões ficam com a equipe
 * (quem vê o documento), nunca com as partes, e continuam lá depois da juntada.
 *
 * Arquivos ficam no Cloud Storage em secretaria/{órgão}/{processo}/{doc}; o
 * navegador nunca acessa o bucket direto (storage.rules nega tudo): envio e
 * download passam por aqui, que confere a permissão.
 */

interface DocRequest {
    organizationId: string;
    processoId: string;
    action: 'criarMinuta' | 'editarMinuta' | 'upload' | 'assinar' | 'juntar' | 'guardar' | 'excluirMinuta' | 'baixar' | 'pdf' | 'pedirAssinatura' | 'versoes';
    /** juntar e guardar: há mais documentos a caminho (juntada em conjunto); a fase que segue sozinha espera o último. */
    aguardar?: boolean;
    docId?: string;
    /** baixar/pdf: uma redação anterior do documento (id em `versoes`). */
    versaoId?: string;
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
    /** upload: caminho do arquivo que o navegador pôs na área de espera do Storage (até 50 MB). */
    envio?: string;
    /** Juntada: 'nao' | 'sim' (abre pendência) | 'interrompe' (abre e suspende a fase). */
    pendencia?: string;
    /** Juntada: false deixa o documento fora do portal das partes. */
    visivel_partes?: boolean;
    /** Juntada: chaves das exigências do rito que o documento cumpre (sem isso, reconhece pelo modelo ou tipo). */
    atende?: string[];
    /** criarMinuta/upload: modelo de onde a minuta nasceu. */
    modelo_id?: string;
    /** criarMinuta/upload: do que se trata o documento (vai ao registro da juntada). */
    descricao?: string;
    /** criarMinuta/upload: data do próprio documento (assinatura ou emissão), AAAA-MM-DD, até hoje. */
    data_documento?: string;
}

const MAX_DESCRICAO_DOC = 500;

/** Descrição e data do documento, conferidas (data futura ou inválida é recusada). Lança HttpsError. */
export function descritivos(p: { descricao?: unknown; data_documento?: unknown }, hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })) {
    const descricao = texto(p.descricao, MAX_DESCRICAO_DOC);
    const data = typeof p.data_documento === 'string' ? p.data_documento.trim() : '';
    if (data) {
        const d = new Date(`${data}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== data) throw new HttpsError('invalid-argument', 'Data do documento inválida');
        if (data > hoje) throw new HttpsError('invalid-argument', 'A data do documento não pode ser futura');
    }
    return { ...(descricao ? { descricao } : {}), ...(data ? { data_documento: data } : {}) };
}

/** O que a juntada (ou a guarda) diz do documento, além do título: a data dele e do que se trata. */
export const textoDescritivo = (doc: { descricao?: unknown; data_documento?: unknown }) =>
    `${typeof doc.data_documento === 'string' && doc.data_documento ? ` Documento datado de ${doc.data_documento.split('-').reverse().join('/')}.` : ''}`
    + `${typeof doc.descricao === 'string' && doc.descricao ? ` Do que se trata: ${doc.descricao.replace(/\.$/, '')}.` : ''}`;

export function caminhoArquivo(orgId: string, procId: string, docId: string) {
    return `secretaria/${orgId}/${procId}/${docId}`;
}

export const secretariaDocumento = onCall<DocRequest>(
    // Arquivos de até 50 MB: imagem recomprimida e PDF reorganizado pedem memória e tempo.
    { region: REGION, memory: '1GiB', timeoutSeconds: 300 },
    comSinal(async (request) => {
        const auth = exigirAuth(request);
        const p = request.data || ({} as DocRequest);
        const c = await carregarContexto(auth, p.organizationId);
        // Julgador do colegiado (S3): só baixa ou vê o PDF de documento juntado, e cada leitura fica registrada.
        const leitura = (p.action === 'baixar' || p.action === 'pdf') && !p.versaoId;
        const { ref: procRef, data: proc, julgador } = await lerProcesso(c, p.processoId, undefined, { julgador: leitura });
        if (julgador) {
            const d = p.docId ? (await procRef.collection('documentos').doc(String(p.docId)).get()).data() : undefined;
            if (!d || d.status !== 'juntado') throw new HttpsError('not-found', 'Documento não encontrado');
            await registrarLeitura(c, procRef, proc, `Leu o documento ${d.ordem ? `nº ${d.ordem}, ` : ''}${String(d.titulo || '')}`);
        }
        // Feriados locais e recesso, se o ato puder abrir prazo de ação.
        const calendario = ['juntar', 'guardar'].includes(String(p.action)) ? await calendarioDasAcoes(c.db, c.orgId, proc) : undefined;
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

        // Redação anterior: mesma regra de quem vê o documento.
        const lerVersao = async (ref: admin.firestore.DocumentReference) => {
            const s = await ref.collection('versoes').doc(String(p.versaoId)).get();
            if (!s.exists) throw new HttpsError('not-found', 'Versão não encontrada');
            return s.data() as admin.firestore.DocumentData;
        };
        const exigirLeitura = (doc: admin.firestore.DocumentData) => {
            if (doc.status !== 'juntado' && doc.status !== 'controle' && !minutaAcessivel(doc, c.ctx.unidadeIds)) {
                throw new HttpsError('not-found', 'Documento não encontrado');
            }
        };

        if (p.action === 'versoes') {
            const { ref, doc } = await lerDoc();
            exigirLeitura(doc);
            const s = await ref.collection('versoes').select('autor_nome', 'de', 'titulo', 'substituida_em', 'substituida_por').get();
            const versoes = s.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string; substituida_em?: string }))
                .sort((a, b) => String(a.substituida_em).localeCompare(String(b.substituida_em)));
            return { versoes };
        }

        if (p.action === 'baixar') {
            const { ref, doc } = await lerDoc();
            exigirLeitura(doc);
            if (p.versaoId) {
                const v = await lerVersao(ref);
                return { origem: 'editor', titulo: v.titulo, tipo: v.tipo, conteudo: await conteudoDoDocumento(v) };
            }
            if (doc.origem === 'editor') return { origem: 'editor', titulo: doc.titulo, tipo: doc.tipo, conteudo: await conteudoDoDocumento(doc) };
            // O original, byte a byte como foi enviado (é a prova; o SHA-256 confere).
            const arq = await entregar(await lerOriginal(doc), String(doc.nome_arquivo || doc.titulo), String(doc.mime), auth.uid);
            return { origem: 'upload', titulo: doc.titulo, nomeArquivo: doc.nome_arquivo, ...arq };
        }

        // PDF do documento: juntado, como está nos autos (com folhas e carimbo);
        // minuta da minha unidade, como prévia com marca d'água.
        if (p.action === 'pdf') {
            const { ref, doc } = await lerDoc();
            const nome = `${String(doc.titulo).replace(/[^\p{L}\p{N} _-]+/gu, '').slice(0, 60) || 'documento'}.pdf`;
            if (p.versaoId) {
                exigirLeitura(doc);
                const v = await lerVersao(ref);
                const r = await renderizarDocumento(await conteudoDoDocumento(v), await lerConfigDocumento(c.db, c.orgId, doc.unidade_origem), { assinaturas: [], sha256: v.sha256, marcaDagua: 'VERSÃO ANTERIOR' });
                return { base64: r.buffer.toString('base64'), nome: `versao-anterior-${nome}`, paginas: r.paginas };
            }
            if (doc.status === 'juntado') return entregar(await pdfCarimbado(c.db, c.orgId, procRef.id, String(proc.numero), p.docId!, doc), nome, 'application/pdf', auth.uid);
            const controle = doc.status === 'controle';
            if (!controle && !minutaAcessivel(doc, c.ctx.unidadeIds)) throw new HttpsError('not-found', 'Documento não encontrado');
            if (doc.origem !== 'editor') throw new HttpsError('failed-precondition', controle ? 'Baixe o arquivo original do documento' : 'Baixe o arquivo original da minuta');
            const r = await renderizarDocumento(await conteudoDoDocumento(doc), await lerConfigDocumento(c.db, c.orgId, doc.unidade_origem), {
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
                // Detalhado ao entrar no processo: do que se trata e a data do próprio documento (assinatura ou emissão).
                ...descritivos(p),
            };
            if (p.action === 'criarMinuta') {
                let conteudo;
                try { conteudo = sanitizeDoc(p.conteudo); } catch (e) { erroUsuario(e); }
                const hash = sha256(jsonCanonico(conteudo));
                const campos = semApagar(await camposDoConteudo(caminhoArquivo(c.orgId, procRef.id, ref.id), conteudo!, hash));
                await ref.set({ ...base, origem: 'editor', ...campos, sha256: hash });
                return { success: true, id: ref.id };
            }
            const mime = String(p.mime || '');
            if (!TIPOS_ARQUIVO_PERMITIDOS[mime]) throw new HttpsError('invalid-argument', 'Tipo de arquivo não aceito');
            const buf = await lerArquivoEnviado(p, auth.uid, mime);
            const path = caminhoArquivo(c.orgId, procRef.id, ref.id);
            const nomeArquivo = texto(p.nomeArquivo) || titulo;
            const hash = sha256(buf);
            const paginas = await paginasDeArquivo(buf, mime);
            const bucket = admin.storage().bucket();
            const guardado = await gravarOriginal(path, buf, mime);
            // Versão de leitura (folhas, tela, PDF do processo); se falhar, os autos usam o original.
            let leitura: { leitura_path: string; leitura_tamanho: number } | null = null;
            try {
                const v = await versaoDeLeitura(buf, { mime, titulo, nome_arquivo: nomeArquivo, sha256: hash });
                if (v) {
                    await bucket.file(`${path}.leitura.pdf`).save(Buffer.from(v), { contentType: 'application/pdf', resumable: false });
                    leitura = { leitura_path: `${path}.leitura.pdf`, leitura_tamanho: v.length };
                }
            } catch (e) { console.warn('[documentos] versão de leitura não gerada', e); }
            try {
                await ref.set({
                    ...base, origem: 'upload', mime, nome_arquivo: nomeArquivo,
                    tamanho: buf.length, sha256: hash, storage_path: path, paginas, ...guardado, ...(leitura || {}),
                });
            } catch (e) {
                // Sem o registro, o arquivo ficaria no armazenamento sem dono.
                await bucket.file(path).delete({ ignoreNotFound: true }).catch(() => undefined);
                if (leitura) await bucket.file(leitura.leitura_path).delete({ ignoreNotFound: true }).catch(() => undefined);
                throw e;
            }
            return { success: true, id: ref.id };
        }

        if (p.action === 'editarMinuta') {
            exigirPosse(c, proc);
            let conteudo: unknown;
            try { conteudo = sanitizeDoc(p.conteudo); } catch (e) { erroUsuario(e); }
            const novoSha = sha256(jsonCanonico(conteudo));
            // Texto grande vai ao Storage antes (num arquivo por versão, então a redação anterior não é sobrescrita).
            const campos = await camposDoConteudo(caminhoArquivo(c.orgId, procRef.id, String(p.docId)), conteudo as never, novoSha);
            // Lido e gravado juntos: dois revisores ao mesmo tempo não perdem a redação anterior.
            await c.db.runTransaction(async (tx) => {
                const { ref, doc } = await lerDoc(tx);
                exigirMinutaDaMinhaUnidade(doc);
                if (doc.origem !== 'editor') throw new HttpsError('failed-precondition', 'Arquivo enviado não se edita; exclua a minuta e envie outro');
                if ((doc.assinaturas || []).length) throw new HttpsError('failed-precondition', 'Minuta já assinada não se edita');
                const anterior = versaoAnterior(doc, auth.uid, novoSha);
                if (anterior) {
                    tx.set(ref.collection('versoes').doc(), { ...anterior, ...copiaDoConteudo(doc), substituida_em: agoraIso, substituida_por: c.userName });
                }
                tx.update(ref, {
                    ...campos, sha256: novoSha, delta: FieldValue.delete(),
                    ...(texto(p.titulo) ? { titulo: texto(p.titulo) } : {}),
                    ...(texto(p.tipo, 60) ? { tipo: texto(p.tipo, 60) } : {}),
                    editado_em: agoraIso, editado_por: auth.uid, editado_por_nome: c.userName,
                    ...(anterior ? { versoes_qtd: FieldValue.increment(1) } : {}),
                });
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
            await c.db.recursiveDelete(ref); // com as redações anteriores
            // Minuta do acórdão excluída pela unidade: volta ao redator, que corrige e envia de novo (S6).
            if (doc.acordao_sessao_id && proc.acordao?.documento_id === ref.id) {
                const sem = { 'acordao.enviado_em': FieldValue.delete(), 'acordao.documento_id': FieldValue.delete() };
                await procRef.update(sem);
                await c.db.collection('secSessoes').doc(String(doc.acordao_sessao_id)).collection('votacoes').doc(procRef.id).update(sem).catch(() => undefined);
            }
            // Termo de audiência excluído: a sala volta a ficar aberta para corrigir e encerrar de novo (S10).
            if (doc.audiencia_id) await reabrirSala(c.db, procRef, String(doc.audiencia_id), ref.id);
            if (((proc.assinaturas_pendentes || []) as Pedido[]).some((x) => x.docId === ref.id)) {
                await procRef.update({ assinaturas_pendentes: semPedidos(proc.assinaturas_pendentes, ref.id) });
            }
            const bucket = admin.storage().bucket();
            if (doc.storage_path) await bucket.file(doc.storage_path).delete({ ignoreNotFound: true });
            if (doc.leitura_path) await bucket.file(doc.leitura_path).delete({ ignoreNotFound: true });
            // PDF que uma juntada interrompida tenha deixado e os textos grandes (de todas as redações).
            await bucket.file(caminhoPdf(caminhoArquivo(c.orgId, procRef.id, p.docId!))).delete({ ignoreNotFound: true });
            await bucket.deleteFiles({ prefix: `${caminhoArquivo(c.orgId, procRef.id, p.docId!)}.conteudo.` }).catch(() => undefined);
            return { success: true };
        }

        // O documento como o rito o confere: tipo, modelo, assinaturas e as atribuições de quem assinou.
        const docJuntado = (doc: admin.firestore.DocumentData) => {
            const uids = new Set(((doc.assinaturas || []) as Array<{ uid: string }>).map((a) => a.uid));
            const atribuicoes = c.unidades.flatMap((u) => lotacoesDe(u)).filter((l) => uids.has(l.uid)).map((l) => l.atribuicao).filter((a): a is string => !!a);
            return { origem: String(doc.origem || ''), tipo: doc.tipo, modelo_id: doc.modelo_id, assinaturas: uids.size, atribuicoes };
        };

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

        // Fase que segue sozinha: o documento que faltava também conclui a fase, como a última
        // ação obrigatória. Na juntada em conjunto, só o último pedido tenta (o exigido pode ter
        // sido um dos anteriores); `avancarSozinho` confere se nada obrigatório ficou em aberto.
        const podeSeguir = (fase: Fase | undefined, atual: admin.firestore.DocumentData) =>
            fase?.avanco === 'auto' && p.aguardar !== true && exigeAlgo(fase, respostasDaFase(atual));
        const comAvanco = async (r: Record<string, unknown>, tentar: boolean) => {
            const auto = tentar ? await avancarSozinho(c, procRef.id) : null;
            return { success: true, ...r, ...(auto ? { version: auto.version, avancou: auto.avancou } : {}) };
        };

        if (p.action === 'juntar') {
            // "Assinar e juntar": a assinatura entra antes de renderizar o PDF.
            if (p.assinar) await assinarMinuta().catch((e) => { if (e?.code !== 'already-exists') throw e; });
            // Decisão por despacho: a juntada resolve a pendência indicada (só o gabinete).
            const pendenciaAlvo = p.resolve_pendencia_id
                ? ((proc.pendencias || []) as Pendencia[]).find((x) => x.id === p.resolve_pendencia_id && x.status === 'aberta') : null;
            if (p.resolve_pendencia_id && !pendenciaAlvo) throw new HttpsError('not-found', 'Pendência aberta não encontrada');
            if (pendenciaAlvo && !unidadeDecide(c.unidades.find((u) => u.id === proc.unidade_atual))) {
                throw new HttpsError('permission-denied', 'Pendências são apreciadas pelo gabinete ou por outra unidade que decida');
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
                const r = await renderizarDocumento(await conteudoDoDocumento(antes), await lerConfigDocumento(c.db, c.orgId, antes.unidade_origem), {
                    assinaturas: antes.assinaturas || [], sha256: antes.sha256,
                });
                paginas = r.paginas;
                pdf = { path: caminhoPdf(caminhoArquivo(c.orgId, procRef.id, p.docId!)), sha256: sha256(r.buffer) };
                await bucket.file(pdf.path).save(r.buffer, { contentType: 'application/pdf', resumable: false });
            } else if (!paginas) {
                paginas = await paginasDeArquivo(await lerOriginal(antes), antes.mime);
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
                const pendentes = pendentesDaFase(fase, atual.exigencias_cumpridas as Cumpridas | undefined, respostasDaFase(atual));
                let cumpre: string[] = [];
                try { cumpre = reconhecer(pendentes, { ...docJuntado(doc), origem: doc.origem }, p.atende); } catch (e) { erroUsuario(e); }
                const cumpridas = pendentes.filter((e) => cumpre.includes(e.chave));
                // Documento interno (ex.: informação da secretaria) pode ficar fora do portal das partes;
                // o rito também pode pedir isso para o documento exigido (só esconde, nunca mostra).
                const visivel = p.visivel_partes !== false && !cumpridas.some((e) => e.partes === false);
                const mov = registrarMovimento(tx, c, pr, atual, 'juntada',
                    `Juntado o documento nº ${ordem}: ${doc.titulo} (${doc.tipo}), ${textoFolhas(folha, paginas)}.${textoDescritivo(doc)}${assin ? ` Assinado por ${assin}.` : ''}${pend.length ? ` Pendência aberta para o decisor${pend[0].interrompe ? ', com interrupção da fase' : ''}.` : ''}${resolvida ? ` Decide a pendência${resolvida.tipo === 'manual' ? '' : `: ${resolvida.descricao}`}.` : ''}`
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
                // Ação com prazo próprio cumprida pela juntada: o prazo dela se encerra (e o registro interno diz).
                const pzA = camposDosPrazosDasAcoes(atual, exig, fase, c.userName, mexeuPendencias ? pendencias : undefined, calendario);
                const mi = registrarInternos(tx, c, pr, { ...atual, ...mov }, pzA.notas);
                tx.update(pr, {
                    ...mov, ...mi, ...exig, doc_seq: ordem, folhas_seq: folha + paginas - 1,
                    ...(mexeuPendencias ? { pendencias, ...derivados(pendencias, (atual.prazos || []) as Prazo[]) } : {}),
                    ...pzA.campos,
                    ...(((atual.assinaturas_pendentes || []) as Pedido[]).some((x) => x.docId === ref.id) ? { assinaturas_pendentes: semPedidos(atual.assinaturas_pendentes, ref.id) } : {}),
                    // Acórdão da sessão (S6): juntado, a tarefa do redator se encerra e a leitura pelos julgadores acaba.
                    ...(doc.acordao_sessao_id && atual.acordao?.documento_id === ref.id ? { 'acordao.pendente': false, 'acordao.juntado_em': agoraIso, 'acordao.ordem': ordem } : {}),
                });
                return { ordem, version: mi.version ?? mov.version, folha_inicial: folha, paginas, tentar: podeSeguir(fase, atual), internos: pzA.notas.length ? 1 : 0 };
            });
            void avisarPartesDoMovimento(c.db, procRef.id, undefined, 1 + r.internos);
            if (p.pendencia === 'sim' || p.pendencia === 'interrompe') void avisarPendencia(c, proc, procRef.id, `Apreciar o documento nº ${r.ordem}: ${antes.titulo}`);
            const { tentar, internos: _i, ...feito } = r;
            return comAvanco(feito, tentar);
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
                const pendentes = pendentesDaFase(fase, atual.exigencias_cumpridas as Cumpridas | undefined, respostasDaFase(atual));
                let cumpre: string[] = [];
                try { cumpre = reconhecer(pendentes, { ...docJuntado(doc), controle: true }, p.atende); } catch (e) { erroUsuario(e); }
                const cumpridas = pendentes.filter((e) => cumpre.includes(e.chave));
                // Só no sistema quando o rito pede (pela exigência cumprida ou pela fase); senão, evento no extrato.
                const destino = destinoDaGuarda(fase, cumpridas);
                const assin = (doc.assinaturas || []).map((a: { nome: string }) => a.nome).join(', ');
                const mov = registrarMovimento(tx, c, pr, atual, 'guarda',
                    `Guardado no processo, fora dos autos, o documento "${doc.titulo}" (${doc.tipo}).${textoDescritivo(doc)}${assin ? ` Assinado por ${assin}.` : ''}`
                    + `${cumpridas.length ? ` Cumpre o exigido pelo rito: ${cumpridas.map((e) => e.descricao).join('; ')}.` : ''}`,
                    { documento_id: ref.id, titulo: doc.titulo, sha256: doc.sha256, visivel_partes: false, ...marcasDoDestino(destino),
                        ...(cumpridas.length ? { exigencias: cumpridas.map((e) => e.chave) } : {}) });
                const exig = fase ? camposDoCumprimento(atual, fase.id, cumpridas, ref.id, null) : {};
                tx.update(ref, { status: 'controle', visivel_partes: false, guardado_em: agoraIso, guardado_por: auth.uid, guardado_por_nome: c.userName });
                const pzA = camposDosPrazosDasAcoes(atual, exig, fase, c.userName, undefined, calendario);
                const mi = registrarInternos(tx, c, pr, { ...atual, ...mov }, pzA.notas);
                tx.update(pr, {
                    ...mov, ...mi, ...exig, ...pzA.campos,
                    ...(((atual.assinaturas_pendentes || []) as Pedido[]).some((x) => x.docId === ref.id) ? { assinaturas_pendentes: semPedidos(atual.assinaturas_pendentes, ref.id) } : {}),
                });
                return { version: mi.version ?? mov.version, tentar: podeSeguir(fase, atual) };
            });
            const { tentar, ...feito } = r;
            return comAvanco(feito, tentar);
        }

        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    })
);
