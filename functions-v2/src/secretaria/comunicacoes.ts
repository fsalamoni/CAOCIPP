import * as admin from 'firebase-admin';
import { nomeDoPolo } from '../shared/camposProcesso';
import { HttpsError } from 'firebase-functions/v2/https';
import { CalendarioOrgao, MAX_TEXTO_LONGO, Pendencia, Prazo, derivados, hojeBrasil, sanitizeCalendario, texto, unidadeExpede } from '../shared/secretaria';
import {
    Comunicacao, ESPECIES, MAX_COMUNICACOES, PedidoComunicacao, aplicarCiencia, cienciaDias, derivadosComunicacoes, limiteCiencia, sanitizePedido, textoPrazo,
} from '../shared/comunicacoes';
import { COL, Contexto, erroUsuario, registrarInternos, registrarMovimento } from './context';
import { ComunicacaoLigada, aguardaResposta, alvosDaComunicacao, decursosACertificar, faseQueEspera, sincronizarComunicacoes } from '../shared/comunicacaoRito';
import type { Fase } from '../shared/secretaria';

/**
 * Comunicações processuais no Firestore: ficam em `processo.comunicacoes[]`,
 * cada ato vira um evento dos autos e o prazo de resposta só abre na ciência.
 */

// Data no fuso do Brasil (um instante ISO à noite cairia no dia seguinte em UTC).
const br = (iso: string) => (iso.length > 10 ? hojeBrasil(new Date(iso)) : iso).split('-').reverse().join('/');
/** O texto entra no meio da certidão: sem o ponto final dele, para não dobrar. */
const semPonto = (s: string) => s.replace(/[.\s]+$/, '');
type Parte = { nome: string; polo: string; uid?: string; retirada?: unknown;representantes?: Array<{ uid?: string }> };

export interface ConfigComunicacoes { calendario: CalendarioOrgao; dias: number }

/** Calendário do órgão (para o prazo) e dias até a ciência por decurso. */
export async function configComunicacoes(db: admin.firestore.Firestore, orgId: string): Promise<ConfigComunicacoes> {
    const d = (await db.collection(COL.config).doc(orgId).get()).data() || {};
    return { calendario: sanitizeCalendario(d.calendario), dias: cienciaDias(d.ciencia_dias) };
}

/**
 * Depois de mexer nas comunicações: acerta as ações de comunicação e de
 * resposta da fase que espera (ver shared/comunicacaoRito.ts) e registra, em
 * movimento interno, o que a regra fez. `proc`: o processo como vai ficar.
 * Devolve os campos a gravar, quantos movimentos internos entraram e as
 * ações que o rito deu por cumpridas.
 */
export function acertarAcoesDoRito(
    tx: admin.firestore.Transaction, c: Contexto, ref: admin.firestore.DocumentReference, proc: admin.firestore.DocumentData, extra: string[] = [],
): { campos: Record<string, unknown>; internos: number; cumpridas: boolean } {
    const fase = faseQueEspera<Fase>(proc);
    const s = sincronizarComunicacoes(proc, fase, hojeBrasil());
    const depois = s ? { ...proc, acoes_feitas: s.acoes_feitas, acoes_respostas: s.acoes_respostas } : proc;
    const espera = aguardaResposta(depois, fase);
    const notas = [...extra, ...(s?.notas || [])];
    const mi = registrarInternos(tx, c, ref, proc, notas);
    const campos = {
        ...mi,
        ...(s ? { acoes_feitas: s.acoes_feitas, acoes_respostas: s.acoes_respostas } : {}),
        ...((proc.aguarda_resposta === true) !== espera ? { aguarda_resposta: espera } : {}),
    };
    return { campos, internos: notas.length ? 1 : 0, cumpridas: !!s?.novas.length };
}

/** Campos do processo depois de mexer em comunicações e prazos. */
function gravar(lista: Comunicacao[], prazos: Prazo[], proc: admin.firestore.DocumentData) {
    return { comunicacoes: lista, ...derivadosComunicacoes(lista), prazos, ...derivados((proc.pendencias || []) as Pendencia[], prazos) };
}

/**
 * A secretaria expede uma comunicação a uma ou mais partes. Pela plataforma,
 * fica aguardando a ciência; por outro meio, a ciência já é registrada com a
 * data informada e o prazo abre na hora. Roda dentro da transação.
 */
export async function expedir(
    tx: admin.firestore.Transaction, c: Contexto, ref: admin.firestore.DocumentReference,
    data: admin.firestore.DocumentData, raw: unknown, cfg: ConfigComunicacoes, saida: { internos: number; cumpridas: boolean } = { internos: 0, cumpridas: false },
): Promise<Record<string, unknown>> {
    if (!unidadeExpede(c.unidades.find((u) => u.id === data.unidade_atual))) {
        throw new HttpsError('permission-denied', 'Esta unidade não expede comunicações às partes. Remeta o processo à secretaria (ou a outra unidade que expeça) para cumprir.');
    }
    const hoje = hojeBrasil();
    let ped!: PedidoComunicacao;
    try { ped = sanitizePedido(raw, hoje); } catch (e) { erroUsuario(e); }
    const partes = (data.partes || []) as Parte[];
    let lista = [...((data.comunicacoes || []) as Comunicacao[])];
    let prazos = [...((data.prazos || []) as Prazo[])];
    if (lista.length + ped.partes_idx.length > MAX_COMUNICACOES) throw new HttpsError('resource-exhausted', 'Limite de comunicações do processo');
    // Expedida pela ação do rito: só às partes que ela alcança, e fica ligada à ação (na rodada da fase).
    const bruto = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    let ligacao: { fase_id: string; acao_idx: number } | null = null;
    if (bruto.acao_idx !== undefined && bruto.acao_idx !== null) {
        const fase = ((data.fases || []) as Fase[]).find((f) => f.id === data.fase_atual);
        const i = Number(bruto.acao_idx);
        const regra = fase?.acoes_regras?.[i];
        if (!fase || regra?.pede !== 'comunicacao') throw new HttpsError('invalid-argument', 'Esta ação da fase não comunica as partes');
        const alvos = alvosDaComunicacao(regra.comunicacao, partes);
        const fora = ped.partes_idx.filter((x) => !alvos.includes(x));
        if (fora.length) throw new HttpsError('invalid-argument', `"${fase.acoes?.[i]}" comunica só ${alvos.map((x) => partes[x]?.nome).join(', ') || 'partes de outro polo'}`);
        ligacao = { fase_id: fase.id, acao_idx: i };
    }
    let docTitulo = '';
    if (ped.documento_id) {
        const d = (await tx.get(ref.collection('documentos').doc(ped.documento_id))).data();
        if (!d || d.status !== 'juntado' || d.visivel_partes === false) throw new HttpsError('invalid-argument', 'Escolha um documento juntado e visível às partes');
        docTitulo = `Doc. nº ${d.ordem}: ${d.titulo}`;
    }
    const agora = new Date().toISOString();
    const nomeEspecie = ESPECIES[ped.especie];
    let atual = data;
    let campos: Record<string, unknown> = {};
    for (const idx of ped.partes_idx) {
        const parte = partes[idx];
        if (!parte) throw new HttpsError('invalid-argument', 'Destinatário inválido');
        if (parte.retirada) throw new HttpsError('failed-precondition', `${parte.nome} foi retirada do processo`);
        const temConta = !!parte.uid || (parte.representantes || []).some((r) => r.uid);
        if (!ped.outro_meio && !temConta) {
            throw new HttpsError('failed-precondition', `${parte.nome} ainda não tem conta habilitada no portal. Convide a parte (ou um representante) ou registre a comunicação feita por outro meio.`);
        }
        let com: Comunicacao = {
            id: ref.collection('_').doc().id, especie: ped.especie, texto: ped.texto, parte_idx: idx, parte_nome: parte.nome,
            ...(ped.documento_id ? { documento_id: ped.documento_id, documento_titulo: docTitulo } : {}),
            dias: ped.dias, contagem: ped.contagem, expedida_em: agora, expedida_por: c.userName, unidade_id: String(data.unidade_atual),
            limite_ciencia: ped.outro_meio ? null : limiteCiencia(hoje, cfg.dias), status: 'aguardando',
            ...(ligacao || {}),
        };
        const prazoTxt = com.dias ? `Prazo de ${textoPrazo(com)}` : 'Sem prazo de resposta';
        let descricao: string;
        if (ped.outro_meio) {
            const r = aplicarCiencia(com, ped.ciencia_data, agora, c.userName, ped.outro_meio, ref.collection('_').doc().id, cfg.calendario);
            com = r.comunicacao;
            if (r.prazo) prazos = [...prazos, r.prazo];
            descricao = `${nomeEspecie} de ${parte.nome} (${nomeDoPolo(data.nomes_polos, parte.polo)}) realizada por ${ped.outro_meio}, com ciência em ${br(ped.ciencia_data)}: ${semPonto(ped.texto)}${docTitulo ? ` (${docTitulo})` : ''}. ${r.prazo ? `${prazoTxt}, vence em ${br(r.prazo.vence_em)}.` : `${prazoTxt}.`}`;
        } else {
            descricao = `${nomeEspecie} expedida a ${parte.nome} (${nomeDoPolo(data.nomes_polos, parte.polo)}) pela plataforma: ${semPonto(ped.texto)}${docTitulo ? ` (${docTitulo})` : ''}. ${com.dias ? `${prazoTxt}, a contar da ciência` : prazoTxt}.${com.limite_ciencia ? ` Sem ciência até ${br(com.limite_ciencia)}, ela se dá por decurso.` : ''}`;
        }
        lista = [...lista, com];
        const mov = registrarMovimento(tx, c, ref, atual, 'comunicacao', descricao.slice(0, MAX_TEXTO_LONGO), { comunicacao_id: com.id, especie: com.especie, parte_idx: idx });
        campos = { ...campos, ...mov };
        atual = { ...atual, ...mov };
    }
    const gravado = gravar(lista, prazos, data);
    const ac = acertarAcoesDoRito(tx, c, ref, { ...atual, ...gravado });
    saida.internos = ac.internos;
    saida.cumpridas = ac.cumpridas;
    tx.update(ref, { ...campos, ...gravado, ...ac.campos });
    return { ...campos, ...ac.campos };
}

/**
 * Ciência de uma comunicação: pela parte (`meio` "plataforma") ou por decurso.
 * Grava a certidão como evento e abre o prazo. Roda dentro da transação.
 */
export function registrarCiencia(
    tx: admin.firestore.Transaction, c: Contexto, ref: admin.firestore.DocumentReference,
    proc: admin.firestore.DocumentData, comId: string, meio: 'plataforma' | 'decurso', cfg: ConfigComunicacoes, rotulo: string,
): { proc: admin.firestore.DocumentData; comunicacao: Comunicacao } {
    const lista = (proc.comunicacoes || []) as Comunicacao[];
    const alvo = lista.find((x) => x.id === comId);
    if (!alvo) throw new HttpsError('not-found', 'Comunicação não encontrada');
    if (alvo.status !== 'aguardando') throw new HttpsError('failed-precondition', 'A ciência desta comunicação já foi registrada');
    const agora = new Date().toISOString();
    const r = aplicarCiencia(alvo, hojeBrasil(), agora, c.userName, meio, ref.collection('_').doc().id, cfg.calendario);
    const nova = lista.map((x) => (x.id === comId ? r.comunicacao : x));
    const prazos = r.prazo ? [...((proc.prazos || []) as Prazo[]), r.prazo] : ((proc.prazos || []) as Prazo[]);
    const esp = ESPECIES[alvo.especie].toLowerCase();
    const cabeca = meio === 'decurso'
        ? `Ciência por decurso: ${alvo.parte_nome} não acessou a ${esp} expedida em ${br(alvo.expedida_em)} até ${br(String(alvo.limite_ciencia))}.`
        : `${rotulo} deu ciência da ${esp} expedida em ${br(alvo.expedida_em)}.`;
    const mov = registrarMovimento(tx, c, ref, proc, meio === 'decurso' ? 'ciencia_decurso' : 'ciencia',
        `${cabeca}${r.prazo ? ` Prazo de ${textoPrazo(alvo)} aberto, vence em ${br(r.prazo.vence_em)}.` : ''}`,
        { comunicacao_id: comId, ...(r.prazo ? { prazo_id: r.prazo.id, vence_em: r.prazo.vence_em } : {}) });
    const campos = { ...mov, ...gravar(nova, prazos, proc) };
    tx.update(ref, campos);
    return { proc: { ...proc, ...campos }, comunicacao: r.comunicacao };
}

/** Antes da ciência, a secretaria pode tornar a comunicação sem efeito. */
export function tornarSemEfeito(
    tx: admin.firestore.Transaction, c: Contexto, ref: admin.firestore.DocumentReference,
    data: admin.firestore.DocumentData, comId: unknown, motivo: string,
): Record<string, unknown> {
    const lista = (data.comunicacoes || []) as Comunicacao[];
    const alvo = lista.find((x) => x.id === comId);
    if (!alvo) throw new HttpsError('not-found', 'Comunicação não encontrada');
    if (alvo.status !== 'aguardando') throw new HttpsError('failed-precondition', 'Só se torna sem efeito a comunicação que ainda aguarda ciência');
    if (!motivo) throw new HttpsError('invalid-argument', 'Informe o motivo');
    const nova = lista.map((x) => (x.id === alvo.id ? { ...x, status: 'sem_efeito' as const, sem_efeito_motivo: texto(motivo, 500), limite_ciencia: null } : x));
    const mov = registrarMovimento(tx, c, ref, data, 'comunicacao_sem_efeito',
        `${ESPECIES[alvo.especie]} a ${alvo.parte_nome}, expedida em ${br(alvo.expedida_em)}, tornada sem efeito. Motivo: ${motivo}`, { comunicacao_id: alvo.id });
    const ac = acertarAcoesDoRito(tx, c, ref, { ...data, ...mov, comunicacoes: nova });
    tx.update(ref, { ...mov, comunicacoes: nova, ...derivadosComunicacoes(nova), ...ac.campos });
    return { ...mov, ...ac.campos };
}

/**
 * Rotina diária, processo a processo: o prazo de resposta que o rito espera
 * decorreu sem manifestação. Certifica o decurso nos autos (ato público, a
 * parte é avisada) e acerta as ações do rito. Devolve se a fase, que segue
 * sozinha, pode ter ficado pronta para seguir.
 */
export async function certificarDecursos(db: admin.firestore.Firestore, ref: admin.firestore.DocumentReference, hoje: string): Promise<{ orgId: string; avancar: boolean; movimentos: number } | null> {
    return db.runTransaction(async (tx) => {
        const proc = (await tx.get(ref)).data();
        if (!proc || proc.status !== 'em_tramitacao') return null;
        const fase = faseQueEspera<Fase>(proc);
        const vencidas = decursosACertificar(fase, proc.comunicacoes, hoje);
        const c: Contexto = { db, orgId: String(proc.organization_id), org: {}, ctx: { uid: 'sistema', isAdmin: false, unidadeIds: [] }, userName: 'Sistema', unidades: [], gestorDe: [] };
        let atual = proc;
        let campos: Record<string, unknown> = {};
        for (const x of vencidas) {
            const esp = ESPECIES[x.especie].toLowerCase();
            const mov = registrarMovimento(tx, c, ref, atual, 'decurso_prazo',
                `Certifico que o prazo de ${textoPrazo(x)} de ${x.parte_nome} para responder à ${esp} expedida em ${br(x.expedida_em)}, encerrado em ${br(String(x.vence_em))}, decorreu sem manifestação.`,
                { comunicacao_id: x.id, parte_idx: x.parte_idx });
            campos = { ...campos, ...mov };
            atual = { ...atual, ...mov };
        }
        const ids = new Set(vencidas.map((x) => x.id));
        const nova = ((proc.comunicacoes || []) as ComunicacaoLigada[]).map((x) => (ids.has(x.id) ? { ...x, decurso_certificado: hoje } : x));
        const ac = acertarAcoesDoRito(tx, c, ref, { ...atual, comunicacoes: nova });
        if (!vencidas.length && !Object.keys(ac.campos).length) return null;
        tx.update(ref, { ...campos, ...(vencidas.length ? { comunicacoes: nova } : {}), ...ac.campos });
        return { orgId: c.orgId, avancar: ac.cumpridas && fase?.avanco === 'auto' && fase.id === proc.fase_atual, movimentos: vencidas.length + ac.internos };
    });
}

/** Rotina diária: comunicações sem ciência além do limite têm a ciência registrada por decurso. */
export async function cienciaPorDecurso(db: admin.firestore.Firestore): Promise<number> {
    const hoje = hojeBrasil();
    const snap = await db.collection(COL.processos).where('ciencia_limite', '<', hoje).limit(500).get();
    const cfgs = new Map<string, Promise<ConfigComunicacoes>>();
    let feitas = 0;
    for (const d of snap.docs) {
        const orgId = String(d.data().organization_id);
        if (!cfgs.has(orgId)) cfgs.set(orgId, configComunicacoes(db, orgId));
        const cfg = await cfgs.get(orgId)!;
        const c: Contexto = { db, orgId, org: {}, ctx: { uid: 'sistema', isAdmin: false, unidadeIds: [] }, userName: 'Sistema', unidades: [], gestorDe: [] };
        feitas += await db.runTransaction(async (tx) => {
            let proc = (await tx.get(d.ref)).data();
            if (!proc) return 0;
            const vencidas = ((proc.comunicacoes || []) as Comunicacao[]).filter((x) => x.status === 'aguardando' && x.limite_ciencia && x.limite_ciencia < hoje);
            for (const x of vencidas) proc = registrarCiencia(tx, c, d.ref, proc, x.id, 'decurso', cfg, '').proc;
            return vencidas.length;
        }).catch(() => 0);
    }
    return feitas;
}
