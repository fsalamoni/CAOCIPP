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
import { montarPdfAutos } from './exportar';
import { avisarPartesDoMovimento } from './portalAvisos';

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

export const MOVIMENTOS_INTERNOS = ['atribuicao', 'pendencia'];
const TIPOS_PETICAO: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
/** Tipos de petição oferecidos no portal; o texto vai no título e no movimento. */
export const TIPOS_PETICAO_PORTAL = ['Manifestação', 'Juntada de documento', 'Pedido de prazo', 'Pedido de vista', 'Recurso', 'Outro'];
export const AVISOS_PARTE = ['tudo', 'prazos', 'nenhum'] as const;
export type AvisosParte = typeof AVISOS_PARTE[number];
/** Dados do portal por conta de parte: último acesso a cada processo e preferência de aviso. */
export const COL_ACESSOS = 'secPortalAcessos';

interface PortalRequest {
    action: 'aceitarConvite' | 'meusProcessos' | 'obter' | 'baixar' | 'pdf' | 'peticionar' | 'exportar' | 'certidao' | 'comprovante' | 'preferencias';
    convite?: string;
    processoId?: string;
    docId?: string;
    titulo?: string;
    texto?: string;
    tipo?: string;
    prazo_id?: string;
    nomeArquivo?: string;
    mime?: string;
    base64?: string;
    avisos?: string;
}

const brData = (iso: string) => iso.split('-').reverse().join('/');
const brDataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

/** Prazos abertos dirigidos a esta parte (ou sem destinatário). */
function prazosDaParte(proc: admin.firestore.DocumentData, parte: { nome: string } | undefined) {
    const nome = (parte?.nome || '').toLowerCase();
    return ((proc.prazos || []) as Prazo[]).filter((x) => x.status === 'aberto'
        && (!x.destinatario || String(x.destinatario).toLowerCase().includes(nome)));
}

/** Fases vistas pela parte: só o que não é interno da equipe. */
function fasesPublicas(proc: admin.firestore.DocumentData) {
    return ((proc.fases || []) as Array<Record<string, unknown>>).map(({ id, nome, prazo_dias, proximas, final }) => (
        { id, nome, ...(prazo_dias ? { prazo_dias } : {}), ...(proximas ? { proximas } : {}), ...(final ? { final } : {}) }));
}

/** Petições desta conta com a situação da apreciação. */
function peticoesDaParte(proc: admin.firestore.DocumentData, docs: admin.firestore.DocumentData[], uid: string) {
    const pend = (proc.pendencias || []) as Pendencia[];
    return docs.filter((d) => d.peticao && d.autor_uid === uid).map((d) => {
        const x = pend.find((q) => q.documento_id === d.id);
        return {
            id: d.id, ordem: d.ordem, titulo: d.titulo, em: d.juntado_em, tipo_peticao: d.peticao_tipo || null, protocolo: `${proc.numero}-${d.ordem}`,
            situacao: !x ? 'juntada' : x.status === 'aberta' ? 'aguardando' : 'apreciada',
            apreciada_em: x?.status === 'resolvida' ? (x.resolvida_em as string) || null : null,
            resolucao: x?.status === 'resolvida' ? (x.resolucao as string) || null : null,
        };
    });
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

    if (p.action === 'preferencias') {
        const avisos = AVISOS_PARTE.includes(p.avisos as AvisosParte) ? p.avisos : 'tudo';
        await db.collection(COL_ACESSOS).doc(uid).set({ avisos, email: auth.token.email || null, updated_at: new Date().toISOString() }, { merge: true });
        return { success: true, avisos };
    }

    if (p.action === 'meusProcessos') {
        const [snap, acessosSnap] = await Promise.all([
            db.collection(COL.processos).where('partes_uids', 'array-contains', uid).limit(200).get(),
            db.collection(COL_ACESSOS).doc(uid).get(),
        ]);
        const acessos = (acessosSnap.data()?.processos || {}) as Record<string, string>;
        const orgIds = [...new Set(snap.docs.map((d) => d.data().organization_id))];
        const orgs = orgIds.length ? await db.getAll(...orgIds.map((id) => db.collection('organizations').doc(id))) : [];
        const ativo = new Map(orgs.map((o) => [o.id, { on: o.data()?.secretariaConfig?.enabled === true, nome: o.data()?.name || '' }]));
        const visiveis = snap.docs.filter((d) => ativo.get(d.data().organization_id)?.on);
        const hoje = hojeBrasil();
        // "Para você": o que pede atenção da parte, em todos os processos.
        const paraVoce: Array<Record<string, unknown>> = [];
        const processos = visiveis.map((d) => {
            const x = d.data();
            const parte = parteDoUsuario(x, uid);
            const visto = acessos[d.id] || '';
            const novidades = x.ultimo_movimento?.em && x.ultimo_movimento.em > visto;
            for (const pr of prazosDaParte(x, parte)) {
                paraVoce.push({ tipo: 'prazo', processoId: d.id, numero: x.numero, assunto: x.assunto, descricao: pr.descricao, vence_em: pr.vence_em, vencido: pr.vence_em < hoje, prazo_id: pr.id });
            }
            for (const pe of ((x.pendencias || []) as Pendencia[]).filter((q) => q.tipo === 'peticao' && q.status === 'aberta' && String(q.aberta_por || '').startsWith(`${parte?.nome} (`))) {
                paraVoce.push({ tipo: 'peticao', processoId: d.id, numero: x.numero, assunto: x.assunto, descricao: pe.descricao, desde: pe.aberta_em });
            }
            if (novidades) paraVoce.push({ tipo: 'novidade', processoId: d.id, numero: x.numero, assunto: x.assunto, descricao: x.ultimo_movimento.descricao, em: x.ultimo_movimento.em });
            return {
                id: d.id, numero: x.numero, assunto: x.assunto, status: x.status, orgao: ativo.get(x.organization_id)?.nome,
                fase_nome: (x.fases || []).find((f: { id: string }) => f.id === x.fase_atual)?.nome || x.fase_atual,
                polo: parte?.polo, ultimo_movimento: x.ultimo_movimento || null, novidades: !!novidades, visto_em: visto || null,
            };
        });
        const ordem = { prazo: 0, peticao: 1, novidade: 2 } as Record<string, number>;
        paraVoce.sort((a, b) => (ordem[a.tipo as string] - ordem[b.tipo as string]) || String(a.vence_em || a.em || '').localeCompare(String(b.vence_em || b.em || '')));
        return { processos, para_voce: paraVoce, avisos: acessosSnap.data()?.avisos || 'tudo' };
    }

    if (p.action === 'obter') {
        const { ref, data, org } = await lerComoParte(db, uid, p.processoId);
        const [movs, docs] = await Promise.all([
            ref.collection('movimentos').orderBy('seq').get(),
            ref.collection('documentos').where('status', '==', 'juntado')
                .select('ordem', 'titulo', 'tipo', 'juntado_em', 'origem', 'sha256', 'visivel_partes', 'folha_inicial', 'folha_final', 'codigo_verificacao', 'peticao', 'peticao_tipo', 'autor_uid').get(),
        ]);
        const todos = movs.docs.map((d) => d.data());
        const parte = parteDoUsuario(data, uid);
        const acessoRef = db.collection(COL_ACESSOS).doc(uid);
        const vistoEm = ((await acessoRef.get()).data()?.processos || {})[ref.id] || null;
        // Marca o acesso para o "Para você" saber o que é novidade.
        await acessoRef.set({ processos: { [ref.id]: new Date().toISOString() }, email: auth.token.email || null }, { merge: true });
        const documentos = docs.docs.map((d) => ({ id: d.id, ...d.data() } as admin.firestore.DocumentData))
            .filter((d) => d.visivel_partes !== false)
            .sort((a, b) => a.ordem - b.ordem);
        return {
            orgao: org.name || '',
            processo: {
                id: ref.id, numero: data.numero, assunto: data.assunto, status: data.status, descricao: data.descricao,
                fase_nome: (data.fases || []).find((f: { id: string }) => f.id === data.fase_atual)?.nome || data.fase_atual,
                fase_atual: data.fase_atual,
                fases: fasesPublicas(data),
                partes: (data.partes || []).map((x: { nome: string; polo: string }) => ({ nome: x.nome, polo: x.polo })),
                prazos: ((data.prazos || []) as Prazo[]).filter((x) => x.status === 'aberto')
                    .map((x) => ({ id: x.id, descricao: x.descricao, destinatario: x.destinatario || '', vence_em: x.vence_em, meu: prazosDaParte(data, parte).some((q) => q.id === x.id) })),
                minha_parte: parte,
                autuado_em: data.autuado_em || null,
            },
            movimentos: todos.filter((m) => !MOVIMENTOS_INTERNOS.includes(m.tipo) && m.dados?.visivel_partes !== false)
                .map((m) => ({ seq: m.seq, tipo: m.tipo, descricao: m.descricao, em: m.em, autor_nome: m.autor_nome, hash: m.hash, novo: !!vistoEm && m.em > vistoEm })),
            documentos: documentos.map((d) => ({ id: d.id, ordem: d.ordem, titulo: d.titulo, tipo: d.tipo, juntado_em: d.juntado_em, origem: d.origem, sha256: d.sha256, folha_inicial: d.folha_inicial || null, folha_final: d.folha_final || null, codigo_verificacao: d.codigo_verificacao || null, novo: !!vistoEm && d.juntado_em > vistoEm })),
            minhas_peticoes: peticoesDaParte(data, documentos, uid),
            tipos_peticao: TIPOS_PETICAO_PORTAL,
            visto_em: vistoEm,
            cadeiaIntegra: verificarCadeia(todos as never) === null,
        };
    }

    if (p.action === 'exportar') {
        // Íntegra do que a parte pode ver: movimentos públicos e documentos visíveis.
        const { ref, data: proc, org } = await lerComoParte(db, uid, p.processoId);
        const [movs, docs] = await Promise.all([
            ref.collection('movimentos').orderBy('seq').get(),
            ref.collection('documentos').where('status', '==', 'juntado').get(),
        ]);
        const movimentos = movs.docs.map((d) => d.data()).filter((m) => !MOVIMENTOS_INTERNOS.includes(m.tipo) && m.dados?.visivel_partes !== false);
        const documentos = docs.docs.map((d) => ({ id: d.id, ...d.data() } as admin.firestore.DocumentData)).filter((d) => d.visivel_partes !== false).sort((a, b) => a.ordem - b.ordem);
        const bytes = await montarPdfAutos({
            db, orgId: proc.organization_id, orgNome: String(org.name || ''), ref, proc, movimentos, docs: documentos,
            geradoPor: `${parteDoUsuario(proc, uid)?.nome || nomeConta} (parte)`, nomeUnidade: () => '',
        });
        return { base64: Buffer.from(bytes).toString('base64'), nome: `processo-${String(proc.numero).replace('/', '-')}.pdf` };
    }

    if (p.action === 'certidao') {
        // Uma folha: situação atual e últimos movimentos públicos, com data e hora.
        const { ref, data: proc, org } = await lerComoParte(db, uid, p.processoId);
        const movs = (await ref.collection('movimentos').orderBy('seq', 'desc').limit(40).get()).docs.map((d) => d.data())
            .filter((m) => !MOVIMENTOS_INTERNOS.includes(m.tipo) && m.dados?.visivel_partes !== false).slice(0, 10);
        const fase = (proc.fases || []).find((f: { id: string }) => f.id === proc.fase_atual)?.nome || proc.fase_atual;
        const situacao = { em_tramitacao: 'Em tramitação', sobrestado: 'Sobrestado', arquivado: 'Arquivado' }[proc.status as string] || proc.status;
        const parte = parteDoUsuario(proc, uid);
        const linhas = [
            `CERTIDÃO DE ANDAMENTO`, '',
            `${org.name || ''}`,
            `Processo nº ${proc.numero}`, `Assunto: ${proc.assunto}`, '',
            `Situação: ${situacao}. Fase atual: ${fase}.`,
            `Autuado em ${proc.autuado_em ? brDataHora(proc.autuado_em) : '—'}.`,
            `Partes: ${((proc.partes || []) as Array<{ nome: string; polo: string }>).map((x) => `${x.nome} (${x.polo})`).join('; ')}.`, '',
            `Prazos em aberto: ${((proc.prazos || []) as Prazo[]).filter((x) => x.status === 'aberto').map((x) => `${x.descricao}, vence em ${brData(x.vence_em)}`).join('; ') || 'nenhum'}.`, '',
            'Últimos movimentos:',
            ...movs.map((m) => `${brDataHora(m.em)} — ${m.descricao}`), '',
            `Certidão emitida pelo portal das partes em ${brDataHora(new Date().toISOString())} a pedido de ${parte?.nome || nomeConta}.`,
            `Confira cada documento pelo código impresso nas folhas em ${process.env.APP_URL || 'https://sigo-caocipp.web.app'}/Conferir.`,
        ];
        const r = await renderizarDocumento(textoParaDoc(linhas.join('\n')), {}, { semCabecalho: true });
        return { base64: r.buffer.toString('base64'), nome: `certidao-${String(proc.numero).replace('/', '-')}.pdf` };
    }

    if (p.action === 'comprovante') {
        // Comprovante de protocolo de uma petição desta conta.
        const { ref, data: proc, org } = await lerComoParte(db, uid, p.processoId);
        const d = (await ref.collection('documentos').doc(String(p.docId || '_')).get()).data();
        if (!d || !d.peticao || d.autor_uid !== uid) throw new HttpsError('not-found', 'Petição não encontrada');
        const linhas = [
            'COMPROVANTE DE PROTOCOLO', '',
            `${org.name || ''}`,
            `Processo nº ${proc.numero} — ${proc.assunto}`, '',
            `Protocolo: ${proc.numero}-${d.ordem}`,
            `Petição: ${d.titulo}${d.peticao_tipo ? ` (${d.peticao_tipo})` : ''}`,
            `Protocolada em ${brDataHora(d.juntado_em)} por ${d.autor_nome}.`,
            `Juntada como documento nº ${d.ordem}, ${textoFolhas(Number(d.folha_inicial || 1), Number(d.paginas || 1))}.`,
            `SHA-256 do conteúdo: ${d.sha256}`,
            d.codigo_verificacao ? `Código de conferência: ${d.codigo_verificacao}` : '',
            '', `Emitido em ${brDataHora(new Date().toISOString())} pelo portal das partes.`,
        ];
        const r = await renderizarDocumento(textoParaDoc(linhas.join('\n')), {}, { semCabecalho: true });
        return { base64: r.buffer.toString('base64'), nome: `protocolo-${String(proc.numero).replace('/', '-')}-${d.ordem}.pdf` };
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
        const tipoPeticao = TIPOS_PETICAO_PORTAL.includes(String(p.tipo)) ? String(p.tipo) : '';
        const titulo = texto(p.titulo) || tipoPeticao || 'Petição';
        const prazoId = texto(p.prazo_id, 60);
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
            // Se a parte disse a qual prazo responde, a tempestividade é só desse.
            const prazos = prazosDaParte(proc, parte).filter((x) => !prazoId || x.id === prazoId);
            const tempest = prazos.map((x) => `prazo "${x.descricao}" vence em ${x.vence_em.split('-').reverse().join('/')}: ${hoje <= x.vence_em ? 'tempestiva' : 'intempestiva'}`).join('; ');
            const interrompe = org.secretariaConfig?.peticao_interrompe === true;
            const pend: Pendencia = {
                id: procRef.collection('_').doc().id, tipo: 'peticao', interrompe, status: 'aberta',
                descricao: `Apreciar petição nº ${ordem} de ${parte.nome} (${parte.polo})${tipoPeticao ? ` [${tipoPeticao}]` : ''}: ${titulo}${tempest ? `. ${tempest}` : ''}`,
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
                ...(tipoPeticao ? { peticao_tipo: tipoPeticao } : {}), ...(prazoId ? { prazo_id: prazoId } : {}),
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
            return { ordem, protocolo: `${proc.numero}-${ordem}`, em: agora, docId: docRef.id };
        });
        void avisarPartesDoMovimento(db, procRef.id, uid);
        return { success: true, ...r };
    }

    throw new HttpsError('invalid-argument', 'Ação desconhecida');
});

/** Contexto mínimo para registrar movimento em nome de uma parte. */
function contextoParte(db: admin.firestore.Firestore, proc: admin.firestore.DocumentData, uid: string, nome: string): Contexto {
    return { db, orgId: proc.organization_id, org: {}, ctx: { uid, isAdmin: false, unidadeIds: [] }, userName: nome, unidades: [], gestorDe: [] };
}
