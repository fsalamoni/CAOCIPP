import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
    MAX_TEXTO_LONGO, MAX_UPLOAD_BYTES, Pendencia, Prazo, derivados, hojeBrasil, jsonCanonico, sha256, texto, verificarCadeia,
} from '../shared/secretaria';
import { COL, Contexto, REGION, exigirAuth, registrarMovimento } from './context';
import { caminhoArquivo } from './documentos';
import { caminhoPdf, conteudoDoDocumento, folhasDoProcesso, novoCodigo, paginasDeArquivo, pdfCarimbado, registroVerificacao, textoFolhas } from './autos';
import { renderizarDocumento, textoParaDoc } from './pdfDocumento';

/**
 * Portal das partes. A parte é um usuário autenticado (Google ou e-mail e
 * senha) que NUNCA vira membro do órgão: não ganha vínculo em
 * userOrganizations e só alcança os processos em que foi habilitada por
 * convite (processo.partes_uids). Tudo passa por aqui; nada de leitura direta.
 *
 * O que a parte vê: dados do processo, movimentos públicos (sem atribuições
 * internas e sem pendências abertas à mão) e documentos juntados marcados como
 * visíveis às partes. O que a parte faz: peticiona a qualquer tempo. A petição
 * é juntada na hora (protocolo eletrônico) e abre pendência para o decisor.
 */

const MOVIMENTOS_INTERNOS = ['atribuicao', 'pendencia'];
const TIPOS_PETICAO: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };

interface PortalRequest {
    action: 'aceitarConvite' | 'meusProcessos' | 'obter' | 'baixar' | 'pdf' | 'peticionar';
    convite?: string;
    processoId?: string;
    docId?: string;
    titulo?: string;
    texto?: string;
    nomeArquivo?: string;
    mime?: string;
    base64?: string;
}

/** Processo em que o usuário é parte habilitada, com o órgão ainda com a Secretaria ativa. */
async function lerComoParte(db: admin.firestore.Firestore, uid: string, id: unknown, tx?: admin.firestore.Transaction) {
    if (typeof id !== 'string' || !id) throw new HttpsError('invalid-argument', 'processoId é obrigatório');
    const ref = db.collection(COL.processos).doc(id);
    const snap = tx ? await tx.get(ref) : await ref.get();
    const data = snap.data();
    if (!data || !(data.partes_uids || []).includes(uid)) throw new HttpsError('not-found', 'Processo não encontrado');
    const org = (await db.collection('organizations').doc(data.organization_id).get()).data() || {};
    if (org.secretariaConfig?.enabled !== true || org.secretariaConfig?.suspensa_plataforma === true) {
        throw new HttpsError('failed-precondition', 'A Secretaria deste órgão está desativada');
    }
    return { ref, data, org };
}

function parteDoUsuario(proc: admin.firestore.DocumentData, uid: string) {
    return ((proc.partes || []) as Array<{ uid?: string; nome: string; polo: string }>).find((p) => p.uid === uid);
}

export const secretariaPortal = onCall<PortalRequest>({ region: REGION, memory: '512MiB' }, async (request) => {
    const auth = exigirAuth(request);
    const p = request.data || ({} as PortalRequest);
    const db = admin.firestore();
    const uid = auth.uid;
    const nomeConta = String(auth.token.name || auth.token.email || 'Parte');

    if (p.action === 'aceitarConvite') {
        const token = String(p.convite || '');
        if (token.length < 20) throw new HttpsError('invalid-argument', 'Convite inválido');
        const conviteRef = db.collection(COL.convites).doc(sha256(token));
        return db.runTransaction(async (tx) => {
            const cSnap = await tx.get(conviteRef);
            const conv = cSnap.data();
            if (!conv) throw new HttpsError('not-found', 'Convite inválido');
            if (conv.usado_por && conv.usado_por !== uid) throw new HttpsError('failed-precondition', 'Este convite já foi usado por outra conta');
            if (conv.revogado) throw new HttpsError('failed-precondition', 'Este convite foi revogado');
            if (!conv.usado_por && new Date(conv.expira_em) < new Date()) throw new HttpsError('deadline-exceeded', 'Convite vencido. Peça um novo à secretaria.');
            const ref = db.collection(COL.processos).doc(conv.processo_id);
            const proc = (await tx.get(ref)).data();
            if (!proc) throw new HttpsError('not-found', 'Processo não encontrado');
            if (conv.usado_por === uid) return { success: true, processoId: ref.id, organizationId: proc.organization_id };
            const partes = [...(proc.partes || [])];
            const parte = partes[conv.parte_idx];
            if (!parte || parte.nome !== conv.parte_nome) throw new HttpsError('failed-precondition', 'A parte do convite não existe mais no processo');
            if (parte.uid && parte.uid !== uid) throw new HttpsError('failed-precondition', 'Esta parte já está vinculada a outra conta');
            partes[conv.parte_idx] = { ...parte, uid, habilitada_em: new Date().toISOString(), conta: nomeConta };
            const c = contextoParte(db, proc, uid, `${parte.nome} (parte)`);
            const mov = registrarMovimento(tx, c, ref, proc, 'habilitacao',
                `${parte.nome} (${parte.polo}) passou a acompanhar o processo pelo portal das partes.`, { parte_idx: conv.parte_idx });
            tx.update(ref, { ...mov, partes, partes_uids: FieldValue.arrayUnion(uid) });
            tx.update(conviteRef, { usado_por: uid, usado_em: new Date().toISOString() });
            return { success: true, processoId: ref.id, organizationId: proc.organization_id };
        });
    }

    if (p.action === 'meusProcessos') {
        const snap = await db.collection(COL.processos).where('partes_uids', 'array-contains', uid).limit(200).get();
        const orgIds = [...new Set(snap.docs.map((d) => d.data().organization_id))];
        const orgs = orgIds.length ? await db.getAll(...orgIds.map((id) => db.collection('organizations').doc(id))) : [];
        const ativo = new Map(orgs.map((o) => [o.id, { on: o.data()?.secretariaConfig?.enabled === true, nome: o.data()?.name || '' }]));
        return {
            processos: snap.docs.filter((d) => ativo.get(d.data().organization_id)?.on).map((d) => {
                const x = d.data();
                return {
                    id: d.id, numero: x.numero, assunto: x.assunto, status: x.status, orgao: ativo.get(x.organization_id)?.nome,
                    fase_nome: (x.fases || []).find((f: { id: string }) => f.id === x.fase_atual)?.nome || x.fase_atual,
                    polo: parteDoUsuario(x, uid)?.polo, ultimo_movimento: x.ultimo_movimento || null,
                };
            }),
        };
    }

    if (p.action === 'obter') {
        const { ref, data, org } = await lerComoParte(db, uid, p.processoId);
        const [movs, docs] = await Promise.all([
            ref.collection('movimentos').orderBy('seq').get(),
            ref.collection('documentos').where('status', '==', 'juntado')
                .select('ordem', 'titulo', 'tipo', 'juntado_em', 'origem', 'sha256', 'visivel_partes', 'folha_inicial', 'folha_final').get(),
        ]);
        const todos = movs.docs.map((d) => d.data());
        return {
            orgao: org.name || '',
            processo: {
                id: ref.id, numero: data.numero, assunto: data.assunto, status: data.status, descricao: data.descricao,
                fase_nome: (data.fases || []).find((f: { id: string }) => f.id === data.fase_atual)?.nome || data.fase_atual,
                fase_atual: data.fase_atual,
                // Fluxo sem as orientações internas da equipe.
                fases: ((data.fases || []) as Array<Record<string, unknown>>).map(({ orientacao: _o, ...f }) => f),
                partes: (data.partes || []).map((x: { nome: string; polo: string }) => ({ nome: x.nome, polo: x.polo })),
                prazos: ((data.prazos || []) as Prazo[]).filter((x) => x.status === 'aberto')
                    .map((x) => ({ descricao: x.descricao, destinatario: x.destinatario || '', vence_em: x.vence_em })),
                minha_parte: parteDoUsuario(data, uid),
            },
            movimentos: todos.filter((m) => !MOVIMENTOS_INTERNOS.includes(m.tipo) && m.dados?.visivel_partes !== false)
                .map((m) => ({ seq: m.seq, tipo: m.tipo, descricao: m.descricao, em: m.em, autor_nome: m.autor_nome, hash: m.hash })),
            documentos: docs.docs.map((d) => ({ id: d.id, ...d.data() } as admin.firestore.DocumentData))
                .filter((d) => d.visivel_partes !== false)
                .sort((a, b) => a.ordem - b.ordem)
                .map((d) => ({ id: d.id, ordem: d.ordem, titulo: d.titulo, tipo: d.tipo, juntado_em: d.juntado_em, origem: d.origem, sha256: d.sha256, folha_inicial: d.folha_inicial || null, folha_final: d.folha_final || null })),
            cadeiaIntegra: verificarCadeia(todos as never) === null,
        };
    }

    if (p.action === 'baixar' || p.action === 'pdf') {
        const { ref, data: proc } = await lerComoParte(db, uid, p.processoId);
        const d = (await ref.collection('documentos').doc(String(p.docId || '_')).get()).data();
        if (!d || d.status !== 'juntado' || d.visivel_partes === false) throw new HttpsError('not-found', 'Documento não encontrado');
        if (p.action === 'pdf') return { base64: await pdfCarimbado(db, proc.organization_id, ref.id, String(proc.numero), String(p.docId), d), nome: `documento-${d.ordem}.pdf` };
        if (d.origem === 'editor') return { origem: 'editor', titulo: d.titulo, conteudo: conteudoDoDocumento(d) };
        const [buf] = await admin.storage().bucket().file(d.storage_path).download();
        return { origem: 'upload', titulo: d.titulo, mime: d.mime, nomeArquivo: d.nome_arquivo, base64: buf.toString('base64') };
    }

    if (p.action === 'peticionar') {
        const titulo = texto(p.titulo) || 'Petição';
        const corpo = texto(p.texto, MAX_TEXTO_LONGO * 10);
        const temArquivo = !!p.base64;
        if (!corpo && !temArquivo) throw new HttpsError('invalid-argument', 'Escreva a petição ou anexe um arquivo');
        let buf: Buffer | null = null;
        if (temArquivo) {
            if (!TIPOS_PETICAO[String(p.mime)]) throw new HttpsError('invalid-argument', 'Anexe PDF, Word (DOCX), PNG ou JPG');
            buf = Buffer.from(String(p.base64), 'base64');
            if (!buf.length || buf.length > MAX_UPLOAD_BYTES) throw new HttpsError('invalid-argument', 'Arquivo vazio ou acima de 5 MB');
        }
        // Confere acesso antes de gravar o arquivo.
        const { ref: procRef, data: procAntes } = await lerComoParte(db, uid, p.processoId);
        const docRef = procRef.collection('documentos').doc();
        let path: string | null = null;
        if (buf) {
            path = caminhoArquivo(procAntes.organization_id, procRef.id, docRef.id);
            await admin.storage().bucket().file(path).save(buf, { contentType: String(p.mime), resumable: false });
        }
        const agora = new Date().toISOString();
        // Petição escrita vira documento do editor, com PDF próprio (sem o
        // cabeçalho do órgão) assinado pela parte; anexo conta as próprias páginas.
        const conteudoDoc = !buf && corpo ? textoParaDoc(corpo) : null;
        const hashConteudo = buf ? sha256(buf) : sha256(jsonCanonico(conteudoDoc));
        const parteAntes = parteDoUsuario(procAntes, uid);
        let paginas = 1;
        let pdf: { path: string; sha256: string } | null = null;
        if (buf) paginas = await paginasDeArquivo(buf, String(p.mime));
        else if (conteudoDoc) {
            const rr = await renderizarDocumento(conteudoDoc, {}, { semCabecalho: true, sha256: hashConteudo, assinaturas: [{ nome: parteAntes?.nome || nomeConta, em: agora }] });
            paginas = rr.paginas;
            pdf = { path: caminhoPdf(caminhoArquivo(procAntes.organization_id, procRef.id, docRef.id)), sha256: sha256(rr.buffer) };
            await admin.storage().bucket().file(pdf.path).save(rr.buffer, { contentType: 'application/pdf', resumable: false });
        }
        const r = await db.runTransaction(async (tx) => {
            const { data: proc, org } = await lerComoParte(db, uid, p.processoId, tx);
            const parte = parteDoUsuario(proc, uid)!;
            const folha = (await folhasDoProcesso(tx, procRef, proc)) + 1;
            const ordem = (Number(proc.doc_seq) || 0) + 1;
            // Tempestividade: compara com prazos abertos para esta parte (ou sem destinatário).
            const hoje = hojeBrasil();
            const prazos = ((proc.prazos || []) as Prazo[]).filter((x) => x.status === 'aberto'
                && (!x.destinatario || String(x.destinatario).toLowerCase().includes(parte.nome.toLowerCase())));
            const tempest = prazos.map((x) => `prazo "${x.descricao}" vence em ${x.vence_em.split('-').reverse().join('/')}: ${hoje <= x.vence_em ? 'tempestiva' : 'intempestiva'}`).join('; ');
            const interrompe = org.secretariaConfig?.peticao_interrompe === true;
            const pend: Pendencia = {
                id: procRef.collection('_').doc().id, tipo: 'peticao', interrompe, status: 'aberta',
                descricao: `Apreciar petição nº ${ordem} de ${parte.nome} (${parte.polo}): ${titulo}${tempest ? `. ${tempest}` : ''}`,
                documento_id: docRef.id, aberta_em: agora, aberta_por: `${parte.nome} (parte)`,
            };
            const pendencias = [...((proc.pendencias || []) as Pendencia[]), pend];
            const c = contextoParte(db, proc, uid, `${parte.nome} (parte)`);
            const mov = registrarMovimento(tx, c, procRef, proc, 'peticao',
                `Petição protocolada por ${parte.nome} (${parte.polo}): ${titulo}. Juntada como documento nº ${ordem}, ${textoFolhas(folha, paginas)}.${tempest ? ` ${tempest[0].toUpperCase()}${tempest.slice(1)}.` : ''} Pendência aberta para o decisor${interrompe ? ', com interrupção da fase' : ''}.`,
                { documento_id: docRef.id, ordem, folha_inicial: folha, paginas });
            const codigo = novoCodigo();
            const dadosDoc = {
                titulo, tipo: 'Petição', origem: buf ? 'upload' : 'editor', peticao: true, status: 'juntado', ordem,
                ...(buf ? { mime: p.mime, nome_arquivo: texto(p.nomeArquivo) || titulo, tamanho: buf.length, storage_path: path } : { conteudo: conteudoDoc }),
                ...(pdf ? { pdf_path: pdf.path, pdf_sha256: pdf.sha256 } : {}),
                ...(buf && corpo ? { observacao: corpo } : {}),
                paginas, folha_inicial: folha, folha_final: folha + paginas - 1,
                sha256: hashConteudo, unidade_origem: 'parte', autor_uid: uid, autor_nome: parte.nome, criado_em: agora,
                juntado_em: agora, juntado_por: uid, juntado_por_nome: `${parte.nome} (parte)`, visivel_partes: true,
                assinaturas: [{ uid, nome: parte.nome, em: agora, sha256: hashConteudo, nivel: 'simples' }],
                codigo_verificacao: codigo,
            };
            tx.set(docRef, dadosDoc);
            tx.set(db.collection(COL.verificacao).doc(codigo),
                registroVerificacao(proc.organization_id, String(org.name || ''), procRef.id, proc, docRef.id, dadosDoc));
            tx.update(procRef, { ...mov, doc_seq: ordem, folhas_seq: folha + paginas - 1, pendencias, ...derivados(pendencias, (proc.prazos || []) as Prazo[]) });
            return { ordem, protocolo: `${proc.numero}-${ordem}`, em: agora };
        });
        return { success: true, ...r };
    }

    throw new HttpsError('invalid-argument', 'Ação desconhecida');
});

/** Contexto mínimo para registrar movimento em nome de uma parte. */
function contextoParte(db: admin.firestore.Firestore, proc: admin.firestore.DocumentData, uid: string, nome: string): Contexto {
    return { db, orgId: proc.organization_id, org: {}, ctx: { uid, isAdmin: false, unidadeIds: [] }, userName: nome, unidades: [] };
}
