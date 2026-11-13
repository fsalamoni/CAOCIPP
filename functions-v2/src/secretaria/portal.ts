import * as admin from 'firebase-admin';
import { numeroArquivo } from '../shared/numeracao';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
    Fase, MAX_TEXTO_LONGO, MAX_UPLOAD_BYTES, Pendencia, Prazo, derivados, hojeBrasil, jsonCanonico, sha256, texto, verificarCadeia,
} from '../shared/secretaria';
import { Cumpridas, camposDoCumprimento, pendentesDaFase, reconhecer, respostasDaFase } from '../shared/exigencias';
import { COL, Contexto, REGION, exigirAuth, registrarMovimento } from './context';
import { caminhoArquivo } from './documentos';
import { caminhoPdf, conteudoDoDocumento, folhasDoProcesso, novoCodigo, paginasDeArquivo, pdfCarimbado, registroVerificacao, textoFolhas } from './autos';
import { renderizarDocumento, textoParaDoc } from './pdfDocumento';
import { montarPdfAutos, selecaoOuErro } from './exportar';
import { extrasDoEvento, visivelParaPartes } from '../shared/autos';
import { avisarPartesDoMovimento } from './portalAvisos';
import { avisarPeticao } from './avisosEquipe';
import { Comunicacao, ESPECIES, destinatario, textoPrazo } from '../shared/comunicacoes';
import { configComunicacoes, registrarCiencia } from './comunicacoes';
import { situacaoDaParte } from '../shared/meusProcessos';
import { informacoesDoAndamento } from '../shared/informacoes';
import { Ref, refsFechadas } from '../shared/modulos';

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

export { MOVIMENTOS_INTERNOS } from '../shared/autos';
const TIPOS_PETICAO: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
/** Tipos de petição oferecidos no portal; o texto vai no título e no movimento. */
export const TIPOS_PETICAO_PORTAL = ['Manifestação', 'Juntada de documento', 'Pedido de prazo', 'Pedido de urgência', 'Pedido de vista', 'Recurso', 'Outro'];
export const AVISOS_PARTE = ['tudo', 'prazos', 'nenhum'] as const;
export type AvisosParte = typeof AVISOS_PARTE[number];
/** Dados do portal por conta de parte: último acesso a cada processo e preferência de aviso. */
export const COL_ACESSOS = 'secPortalAcessos';

interface PortalRequest {
    action: 'aceitarConvite' | 'meusProcessos' | 'obter' | 'baixar' | 'pdf' | 'peticionar' | 'exportar' | 'certidao' | 'comprovante' | 'preferencias' | 'comunicacoes' | 'darCiencia';
    comunicacaoId?: string;
    convite?: string;
    processoId?: string;
    selecao?: unknown;
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

/** Prazos abertos que as partes podem ver: o prazo automático da fase é da equipe, não delas. */
const prazosPublicos = (proc: admin.firestore.DocumentData) => ((proc.prazos || []) as Prazo[]).filter((x) => x.status === 'aberto' && x.automatico !== true);

/** Prazos abertos dirigidos a esta parte (ou sem destinatário). */
function prazosDaParte(proc: admin.firestore.DocumentData, parte: { nome: string } | undefined) {
    const nome = (parte?.nome || '').toLowerCase();
    return prazosPublicos(proc).filter((x) => !x.destinatario || String(x.destinatario).toLowerCase().includes(nome));
}

/**
 * Último andamento que a parte pode ver. Processo anterior ao campo
 * `ultimo_movimento_publico` usa o último movimento só se o tipo for público.
 */
function ultimoPublico(proc: admin.firestore.DocumentData): { tipo: string; descricao: string; em: string } | null {
    if (proc.ultimo_movimento_publico) return proc.ultimo_movimento_publico;
    const u = proc.ultimo_movimento;
    return u && u.publico !== false && visivelParaPartes({ seq: 0, tipo: String(u.tipo) }) ? { tipo: u.tipo, descricao: u.descricao, em: u.em } : null;
}

const orgaoAtivo = (o: admin.firestore.DocumentData | undefined) => o?.secretariaConfig?.enabled === true && o?.secretariaConfig?.suspensa_plataforma !== true;
/** Petições por conta e processo em 24 horas: freio contra abuso, longe do uso normal. */
const MAX_PETICOES_DIA = 20;

/** Comunicações dirigidas a esta conta (à parte dela), como o portal mostra. */
function comunicacoesDaConta(proc: admin.firestore.DocumentData, uid: string) {
    return ((proc.comunicacoes || []) as Comunicacao[]).filter((x) => x.status !== 'sem_efeito' && destinatario(x, proc.partes || [], uid)).map((x) => ({
        id: x.id, especie: x.especie, especie_nome: ESPECIES[x.especie] || 'Comunicação', texto: x.texto, parte_nome: x.parte_nome,
        documento_id: x.documento_id || null, documento_titulo: x.documento_titulo || null,
        prazo: textoPrazo(x), expedida_em: x.expedida_em, limite_ciencia: x.limite_ciencia, status: x.status,
        ciencia_em: x.ciencia_em || null, ciencia_meio: x.ciencia_meio || null, vence_em: x.vence_em || null,
    }));
}

/** Fases vistas pela parte: só o que não é interno da equipe. */
/** Nome da fase para as partes: o público, se o rito der um; senão o oficial. */
export function nomeParaPartes(proc: admin.firestore.DocumentData, faseId: unknown): string {
    const f = ((proc.fases || []) as Array<{ id: string; nome: string; nome_publico?: string }>).find((x) => x.id === faseId);
    return f?.nome_publico || f?.nome || String(faseId || '');
}

function fasesPublicas(proc: admin.firestore.DocumentData) {
    return ((proc.fases || []) as Array<Record<string, unknown>>).map(({ id, nome, nome_publico, prazo_dias, proximas, final }) => (
        { id, nome: nome_publico || nome, ...(prazo_dias ? { prazo_dias } : {}), ...(proximas ? { proximas } : {}), ...(final ? { final } : {}) }));
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

type ParteDoc = { uid?: string; nome: string; polo: string; representantes?: Array<{ uid?: string; nome: string }> };
/** Quem a conta é no processo: a própria parte ou representante dela. */
export interface Quem {
    nome: string; polo: string; como: 'parte' | 'representante';
    /** Nome do representante, quando é ele quem está logado. */
    representante?: string;
    /** Como assina e aparece nos autos. */
    assina: string;
    /** Com o polo, para descrições. */
    rotulo: string;
}
function parteDoUsuario(proc: admin.firestore.DocumentData, uid: string): Quem | undefined {
    const partes = (proc.partes || []) as ParteDoc[];
    const propria = partes.find((p) => p.uid === uid);
    if (propria) return { nome: propria.nome, polo: propria.polo, como: 'parte', assina: propria.nome, rotulo: `${propria.nome} (${propria.polo})` };
    for (const p of partes) {
        const r = (p.representantes || []).find((x) => x.uid === uid);
        if (r) return { nome: p.nome, polo: p.polo, como: 'representante', representante: r.nome, assina: `${r.nome}, representante de ${p.nome}`, rotulo: `${r.nome}, representante de ${p.nome} (${p.polo})` };
    }
    return undefined;
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
            const ridx = typeof conv.representante_idx === 'number' ? conv.representante_idx : -1;
            let rotulo = `${parte.nome} (${parte.polo})`;
            let assina = parte.nome;
            if (ridx >= 0) {
                // Convite a um representante: a conta fica no representante, não na parte.
                const reps = [...(parte.representantes || [])];
                const rep = reps[ridx];
                if (!rep || rep.nome !== conv.representante_nome) throw new HttpsError('failed-precondition', 'O representante do convite não consta mais no processo');
                if (rep.uid && rep.uid !== uid) throw new HttpsError('failed-precondition', 'Este representante já está vinculado a outra conta');
                reps[ridx] = { ...rep, uid, habilitada_em: new Date().toISOString(), conta: nomeConta };
                partes[conv.parte_idx] = { ...parte, representantes: reps };
                rotulo = `${rep.nome}, representante de ${parte.nome} (${parte.polo}),`;
                assina = `${rep.nome}, representante de ${parte.nome}`;
            } else {
                if (parte.uid && parte.uid !== uid) throw new HttpsError('failed-precondition', 'Esta parte já está vinculada a outra conta');
                partes[conv.parte_idx] = { ...parte, uid, habilitada_em: new Date().toISOString(), conta: nomeConta };
            }
            const c = contextoParte(db, proc, uid, `${assina} (parte)`);
            const mov = registrarMovimento(tx, c, ref, proc, 'habilitacao',
                `${rotulo} passou a acompanhar o processo pelo portal das partes.`, { parte_idx: conv.parte_idx, ...(ridx >= 0 ? { representante: conv.representante_nome } : {}) });
            tx.update(ref, { ...mov, partes, partes_uids: FieldValue.arrayUnion(uid) });
            tx.update(conviteRef, { usado_por: uid, usado_em: new Date().toISOString() });
            // Marca no perfil para o menu do SIGO oferecer "Processos em que sou parte" a quem também é membro de órgão.
            tx.set(db.collection('users').doc(uid), { portal_partes: true }, { merge: true });
            return { success: true, processoId: ref.id, organizationId: proc.organization_id };
        });
    }

    if (p.action === 'preferencias') {
        const avisos = AVISOS_PARTE.includes(p.avisos as AvisosParte) ? p.avisos : 'tudo';
        await db.collection(COL_ACESSOS).doc(uid).set({ avisos, email: auth.token.email || null, updated_at: new Date().toISOString() }, { merge: true });
        return { success: true, avisos };
    }

    if (p.action === 'comunicacoes') {
        // O que aguarda a ciência desta conta, em todos os processos (para o aviso ao entrar).
        const snap = await db.collection(COL.processos).where('partes_uids', 'array-contains', uid).limit(200).get();
        const com = snap.docs.filter((d) => (d.data().comunicacoes_aguardando || 0) > 0);
        const orgIds = [...new Set(com.map((d) => String(d.data().organization_id)))];
        const orgs = orgIds.length ? await db.getAll(...orgIds.map((id) => db.collection('organizations').doc(id))) : [];
        const nome = new Map(orgs.filter((o) => orgaoAtivo(o.data())).map((o) => [o.id, String(o.data()?.name || '')]));
        return {
            comunicacoes: com.filter((d) => nome.has(d.data().organization_id)).flatMap((d) => comunicacoesDaConta(d.data(), uid)
                .filter((x) => x.status === 'aguardando')
                .map((x) => ({ ...x, processoId: d.id, numero: d.data().numero, assunto: d.data().assunto, orgao: nome.get(d.data().organization_id), urgente: d.data().urgente === true })))
                .sort((a, b) => a.expedida_em.localeCompare(b.expedida_em)),
        };
    }

    if (p.action === 'darCiencia') {
        const antes = await lerComoParte(db, uid, p.processoId);
        const cfg = await configComunicacoes(db, antes.data.organization_id);
        const r = await db.runTransaction(async (tx) => {
            const { ref, data: proc } = await lerComoParte(db, uid, p.processoId, tx);
            const alvo = ((proc.comunicacoes || []) as Comunicacao[]).find((x) => x.id === p.comunicacaoId);
            // Só a parte destinatária (ou representante dela) dá ciência.
            if (!alvo || !destinatario(alvo, proc.partes || [], uid)) throw new HttpsError('not-found', 'Comunicação não encontrada');
            const parte = parteDoUsuario(proc, uid)!;
            return registrarCiencia(tx, contextoParte(db, proc, uid, `${parte.assina} (parte)`), ref, proc, alvo.id, 'plataforma', cfg, parte.rotulo).comunicacao;
        });
        return { success: true, ciencia_em: r.ciencia_em, vence_em: r.vence_em || null, prazo: textoPrazo(r) };
    }

    if (p.action === 'meusProcessos') {
        const [snap, acessosSnap] = await Promise.all([
            db.collection(COL.processos).where('partes_uids', 'array-contains', uid).limit(200).get(),
            db.collection(COL_ACESSOS).doc(uid).get(),
        ]);
        // Sem nenhum processo (acessos revogados), o menu "Meus Processos Eletrônicos" some.
        if (snap.empty) await db.collection('users').doc(uid).set({ portal_partes: false }, { merge: true }).catch(() => undefined);
        const acessos = (acessosSnap.data()?.processos || {}) as Record<string, string>;
        const orgIds = [...new Set(snap.docs.map((d) => d.data().organization_id))];
        const orgs = orgIds.length ? await db.getAll(...orgIds.map((id) => db.collection('organizations').doc(id))) : [];
        const ativo = new Map(orgs.map((o) => [o.id, { on: orgaoAtivo(o.data()), nome: o.data()?.name || '' }]));
        const visiveis = snap.docs.filter((d) => ativo.get(d.data().organization_id)?.on);
        const hoje = hojeBrasil();
        // "Para você": o que pede atenção da parte, em todos os processos.
        const paraVoce: Array<Record<string, unknown>> = [];
        const processos = visiveis.map((d) => {
            const x = d.data();
            const parte = parteDoUsuario(x, uid);
            const visto = acessos[d.id] || '';
            const ultimo = ultimoPublico(x);
            const novidades = !!ultimo && ultimo.em > visto;
            const meusPrazos = prazosDaParte(x, parte);
            const minhasPeticoes = ((x.pendencias || []) as Pendencia[]).filter((q) => q.tipo === 'peticao' && q.status === 'aberta' && String(q.aberta_por || '').startsWith(`${parte?.nome} (`));
            for (const pr of meusPrazos) {
                paraVoce.push({ tipo: 'prazo', processoId: d.id, numero: x.numero, assunto: x.assunto, descricao: pr.descricao, vence_em: pr.vence_em, vencido: pr.vence_em < hoje, prazo_id: pr.id });
            }
            const aguardando = comunicacoesDaConta(x, uid).filter((q) => q.status === 'aguardando');
            for (const co of aguardando) {
                paraVoce.push({ tipo: 'comunicacao', processoId: d.id, numero: x.numero, assunto: x.assunto, descricao: `${co.especie_nome}: ${co.texto}`.slice(0, 300), em: co.expedida_em, comunicacao_id: co.id, prazo: co.prazo, limite_ciencia: co.limite_ciencia });
            }
            for (const pe of minhasPeticoes) {
                paraVoce.push({ tipo: 'peticao', processoId: d.id, numero: x.numero, assunto: x.assunto, descricao: pe.descricao, desde: pe.aberta_em });
            }
            if (novidades) paraVoce.push({ tipo: 'novidade', processoId: d.id, numero: x.numero, assunto: x.assunto, descricao: ultimo!.descricao, em: ultimo!.em });
            return {
                id: d.id, numero: x.numero, assunto: x.assunto, status: x.status, urgente: x.urgente === true, orgao: ativo.get(x.organization_id)?.nome,
                fase_nome: nomeParaPartes(x, x.fase_atual),
                polo: parte?.polo, parte_nome: parte?.nome || null, como: parte?.como || 'parte', representante: parte?.representante || null,
                ultimo_movimento: ultimo, novidades, visto_em: visto || null, comunicacoes_aguardando: aguardando.length,
                // Planilha "Meus Processos Eletrônicos": o que fazer, prazos abertos e por abrir.
                tipo_nome: x.tipo_nome || null, autuado_em: x.autuado_em || null,
                prazos: meusPrazos.map((q) => ({ id: q.id, descricao: q.descricao, vence_em: q.vence_em })).sort((a, b) => a.vence_em.localeCompare(b.vence_em)),
                peticoes_aguardando: minhasPeticoes.length,
                ...situacaoDaParte({ status: x.status, prazos: meusPrazos.map((q) => ({ descricao: q.descricao, vence_em: q.vence_em })), aguardando, peticoes: minhasPeticoes.length }, hoje),
            };
        });
        const ordem = { comunicacao: -1, prazo: 0, peticao: 1, novidade: 2 } as Record<string, number>;
        paraVoce.sort((a, b) => (ordem[a.tipo as string] - ordem[b.tipo as string]) || String(a.vence_em || a.em || '').localeCompare(String(b.vence_em || b.em || '')));
        return { hoje, processos, para_voce: paraVoce, avisos: acessosSnap.data()?.avisos || 'tudo' };
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
        // Registro de outro módulo que hoje é restrito, anonimizado ou sumiu: as partes não veem mais.
        const camposPartes = ((data.campos || []) as Array<{ rotulo: string; tipo: string; valor: unknown; visivel_partes?: boolean; formato?: string; ref?: Ref }>)
            .filter((x) => x.visivel_partes === true);
        const infosPartes = informacoesDoAndamento(todos as never, data.fases || [], true);
        const fechadas = await refsFechadas(db, String(data.organization_id), [...camposPartes.map((x) => x.ref), ...infosPartes.map((i) => i.ref)]);
        const aberta = (r?: Ref) => !r || !fechadas.has(`${r.modulo}:${r.id}`);
        return {
            orgao: org.name || '',
            processo: {
                id: ref.id, numero: data.numero, assunto: data.assunto, status: data.status, descricao: data.descricao, urgente: data.urgente === true,
                // Só os campos que o órgão marcou para as partes verem.
                campos: camposPartes.filter((x) => aberta(x.ref)).map((x) => ({ rotulo: x.rotulo, tipo: x.tipo, valor: x.valor, ...(x.formato ? { formato: x.formato } : {}) })),
                fase_nome: nomeParaPartes(data, data.fase_atual),
                fase_atual: data.fase_atual,
                fases: fasesPublicas(data),
                partes: (data.partes || []).map((x: { nome: string; polo: string }) => ({ nome: x.nome, polo: x.polo })),
                prazos: prazosPublicos(data)
                    .map((x) => ({ id: x.id, descricao: x.descricao, destinatario: x.destinatario || '', vence_em: x.vence_em, meu: prazosDaParte(data, parte).some((q) => q.id === x.id) })),
                minha_parte: parte,
                comunicacoes: comunicacoesDaConta(data, uid),
                autuado_em: data.autuado_em || null,
                // Dados do andamento que o rito mandou mostrar às partes.
                informacoes: infosPartes.filter((i) => aberta(i.ref))
                    .map((i) => ({ fase_nome: i.fase_nome, rotulo: i.rotulo, valor_texto: i.valor_texto, em: i.em })),
            },
            movimentos: todos.filter((m) => visivelParaPartes(m as never))
                .map((m) => ({ seq: m.seq, tipo: m.tipo, descricao: m.descricao, em: m.em, autor_nome: m.autor_nome, hash: m.hash, novo: !!vistoEm && m.em > vistoEm, ...extrasDoEvento(m as never, new Map(documentos.map((d) => [d.id, d]))) })),
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
        const movimentos = movs.docs.map((d) => d.data()).filter((m) => visivelParaPartes(m as never));
        const documentos = docs.docs.map((d) => ({ id: d.id, ...d.data() } as admin.firestore.DocumentData)).filter((d) => d.visivel_partes !== false).sort((a, b) => a.ordem - b.ordem);
        const bytes = await montarPdfAutos({
            db, orgId: proc.organization_id, orgNome: String(org.name || ''), ref, proc, movimentos, docs: documentos,
            geradoPor: `${parteDoUsuario(proc, uid)?.assina || nomeConta} (parte)`, nomeUnidade: () => '', selecao: selecaoOuErro(p.selecao),
        });
        return { base64: Buffer.from(bytes).toString('base64'), nome: `processo-${numeroArquivo(proc.numero)}.pdf` };
    }

    if (p.action === 'certidao') {
        // Uma folha: situação atual e últimos movimentos públicos, com data e hora.
        const { ref, data: proc, org } = await lerComoParte(db, uid, p.processoId);
        const movs = (await ref.collection('movimentos').orderBy('seq', 'desc').limit(40).get()).docs.map((d) => d.data())
            .filter((m) => visivelParaPartes(m as never)).slice(0, 10);
        const fase = nomeParaPartes(proc, proc.fase_atual);
        const situacao = { em_tramitacao: 'Em tramitação', sobrestado: 'Sobrestado', arquivado: 'Arquivado' }[proc.status as string] || proc.status;
        const parte = parteDoUsuario(proc, uid);
        const linhas = [
            `CERTIDÃO DE ANDAMENTO`, '',
            `${org.name || ''}`,
            `Processo nº ${proc.numero}`, `Assunto: ${proc.assunto}`, '',
            `Situação: ${situacao}. Fase atual: ${fase}.`,
            `Autuado em ${proc.autuado_em ? brDataHora(proc.autuado_em) : '—'}.`,
            `Partes: ${((proc.partes || []) as Array<{ nome: string; polo: string }>).map((x) => `${x.nome} (${x.polo})`).join('; ')}.`, '',
            `Prazos em aberto: ${prazosPublicos(proc).map((x) => `${x.descricao}, vence em ${brData(x.vence_em)}`).join('; ') || 'nenhum'}.`, '',
            'Últimos movimentos:',
            ...movs.map((m) => `${brDataHora(m.em)} — ${m.descricao}`), '',
            `Certidão emitida pelo portal das partes em ${brDataHora(new Date().toISOString())} a pedido de ${parte?.assina || nomeConta}.`,
            `Confira cada documento pelo código impresso nas folhas em ${process.env.APP_URL || 'https://sigo-caocipp.web.app'}/Conferir.`,
        ];
        const r = await renderizarDocumento(textoParaDoc(linhas.join('\n')), {}, { semCabecalho: true });
        return { base64: r.buffer.toString('base64'), nome: `certidao-${numeroArquivo(proc.numero)}.pdf` };
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
        return { base64: r.buffer.toString('base64'), nome: `protocolo-${numeroArquivo(proc.numero)}-${d.ordem}.pdf` };
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
        const ontem = new Date(Date.now() - 86400000).toISOString();
        const minhas = await procRef.collection('documentos').where('autor_uid', '==', uid).select('criado_em', 'peticao').get();
        if (minhas.docs.filter((d) => d.data().peticao === true && String(d.data().criado_em) > ontem).length >= MAX_PETICOES_DIA) {
            throw new HttpsError('resource-exhausted', `São até ${MAX_PETICOES_DIA} petições por dia neste processo. Tente de novo amanhã ou procure a secretaria.`);
        }
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
            const rr = await renderizarDocumento(conteudoDoc, {}, { semCabecalho: true, sha256: hashConteudo, assinaturas: [{ nome: parteAntes?.assina || nomeConta, em: agora }] });
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
            const tempest = prazos.map((x, i) => `${i ? 'prazo' : 'Prazo'} "${x.descricao}" vence em ${x.vence_em.split('-').reverse().join('/')}: ${hoje <= x.vence_em ? 'tempestiva' : 'intempestiva'}`).join('; ');
            const interrompe = org.secretariaConfig?.peticao_interrompe === true;
            const pend: Pendencia = {
                id: procRef.collection('_').doc().id, tipo: 'peticao', interrompe, status: 'aberta',
                descricao: `Apreciar petição nº ${ordem} de ${parte.rotulo}${tipoPeticao && tipoPeticao !== titulo ? ` [${tipoPeticao}]` : ''}: ${titulo}${tempest ? `. ${tempest}` : ''}`,
                documento_id: docRef.id, aberta_em: agora, aberta_por: parte.como === 'representante' ? `${parte.nome} (parte, por ${parte.representante})` : `${parte.nome} (parte)`,
            };
            const pendencias = [...((proc.pendencias || []) as Pendencia[]), pend];
            const c = contextoParte(db, proc, uid, `${parte.assina} (parte)`);
            // Petição pode cumprir documento que o rito exige de fora (ex.: defesa prévia), pelo tipo.
            const fase = ((proc.fases || []) as Fase[]).find((f) => f.id === proc.fase_atual);
            const pendentes = pendentesDaFase(fase, proc.exigencias_cumpridas as Cumpridas | undefined, respostasDaFase(proc));
            const chaves = new Set([tipoPeticao, 'Petição'].filter(Boolean)
                .flatMap((tipo) => reconhecer(pendentes, { origem: buf ? 'upload' : 'editor', tipo, peticao: true })));
            const cumpridas = pendentes.filter((e) => chaves.has(e.chave));
            const mov = registrarMovimento(tx, c, procRef, proc, 'peticao',
                `Petição protocolada por ${parte.rotulo}: ${titulo}. Juntada como documento nº ${ordem}, ${textoFolhas(folha, paginas)}.${tempest ? ` ${tempest}.` : ''} Pendência aberta para o decisor${interrompe ? ', com interrupção da fase' : ''}.`
                + `${cumpridas.length ? ` Cumpre o exigido pelo rito: ${cumpridas.map((e) => e.descricao).join('; ')}.` : ''}`,
                { documento_id: docRef.id, ordem, folha_inicial: folha, paginas, ...(cumpridas.length ? { exigencias: cumpridas.map((e) => e.chave) } : {}) });
            const exig = fase ? camposDoCumprimento(proc, fase.id, cumpridas, docRef.id, ordem) : {};
            const codigo = novoCodigo();
            const dadosDoc = {
                titulo, tipo: 'Petição', origem: buf ? 'upload' : 'editor', peticao: true, status: 'juntado', ordem,
                ...(tipoPeticao ? { peticao_tipo: tipoPeticao } : {}), ...(prazoId ? { prazo_id: prazoId } : {}),
                ...(buf ? { mime: p.mime, nome_arquivo: texto(p.nomeArquivo) || titulo, tamanho: buf.length, storage_path: path } : { conteudo: conteudoDoc }),
                ...(pdf ? { pdf_path: pdf.path, pdf_sha256: pdf.sha256 } : {}),
                ...(buf && corpo ? { observacao: corpo } : {}),
                paginas, folha_inicial: folha, folha_final: folha + paginas - 1,
                sha256: hashConteudo, unidade_origem: 'parte', autor_uid: uid, autor_nome: parte.assina, criado_em: agora,
                juntado_em: agora, juntado_por: uid, juntado_por_nome: `${parte.assina} (parte)`, visivel_partes: true,
                assinaturas: [{ uid, nome: parte.assina, em: agora, sha256: hashConteudo, nivel: 'simples' }],
                codigo_verificacao: codigo,
            };
            tx.set(docRef, dadosDoc);
            tx.set(db.collection(COL.verificacao).doc(codigo),
                registroVerificacao(proc.organization_id, String(org.name || ''), procRef.id, proc, docRef.id, dadosDoc));
            tx.update(procRef, { ...mov, ...exig, doc_seq: ordem, folhas_seq: folha + paginas - 1, pendencias, ...derivados(pendencias, (proc.prazos || []) as Prazo[]) });
            return { ordem, protocolo: `${proc.numero}-${ordem}`, em: agora, docId: docRef.id };
        });
        void avisarPartesDoMovimento(db, procRef.id, uid);
        void avisarPeticao(db, procAntes, procRef.id, String(parteDoUsuario(procAntes, uid)?.assina || 'A parte'), titulo, tipoPeticao);
        return { success: true, ...r };
    }

    throw new HttpsError('invalid-argument', 'Ação desconhecida');
});

/** Contexto mínimo para registrar movimento em nome de uma parte. */
function contextoParte(db: admin.firestore.Firestore, proc: admin.firestore.DocumentData, uid: string, nome: string): Contexto {
    return { db, orgId: proc.organization_id, org: {}, ctx: { uid, isAdmin: false, unidadeIds: [] }, userName: nome, unidades: [], gestorDe: [] };
}
