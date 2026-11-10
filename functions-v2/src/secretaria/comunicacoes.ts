import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { CalendarioOrgao, MAX_TEXTO_LONGO, Pendencia, Prazo, derivados, hojeBrasil, sanitizeCalendario, texto } from '../shared/secretaria';
import {
    Comunicacao, ESPECIES, MAX_COMUNICACOES, PedidoComunicacao, aplicarCiencia, cienciaDias, derivadosComunicacoes, limiteCiencia, sanitizePedido, textoPrazo,
} from '../shared/comunicacoes';
import { COL, Contexto, erroUsuario, registrarMovimento } from './context';

/**
 * Comunicações processuais no Firestore: ficam em `processo.comunicacoes[]`,
 * cada ato vira um evento dos autos e o prazo de resposta só abre na ciência.
 */

// Data no fuso do Brasil (um instante ISO à noite cairia no dia seguinte em UTC).
const br = (iso: string) => (iso.length > 10 ? hojeBrasil(new Date(iso)) : iso).split('-').reverse().join('/');
type Parte = { nome: string; polo: string; uid?: string; representantes?: Array<{ uid?: string }> };

export interface ConfigComunicacoes { calendario: CalendarioOrgao; dias: number }

/** Calendário do órgão (para o prazo) e dias até a ciência por decurso. */
export async function configComunicacoes(db: admin.firestore.Firestore, orgId: string): Promise<ConfigComunicacoes> {
    const d = (await db.collection(COL.config).doc(orgId).get()).data() || {};
    return { calendario: sanitizeCalendario(d.calendario), dias: cienciaDias(d.ciencia_dias) };
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
    data: admin.firestore.DocumentData, raw: unknown, cfg: ConfigComunicacoes,
): Promise<Record<string, unknown>> {
    if (c.unidades.find((u) => u.id === data.unidade_atual)?.tipo !== 'secretaria') {
        throw new HttpsError('permission-denied', 'Comunicações às partes são expedidas pela secretaria. Remeta o processo à secretaria para cumprir.');
    }
    const hoje = hojeBrasil();
    let ped!: PedidoComunicacao;
    try { ped = sanitizePedido(raw, hoje); } catch (e) { erroUsuario(e); }
    const partes = (data.partes || []) as Parte[];
    let lista = [...((data.comunicacoes || []) as Comunicacao[])];
    let prazos = [...((data.prazos || []) as Prazo[])];
    if (lista.length + ped.partes_idx.length > MAX_COMUNICACOES) throw new HttpsError('resource-exhausted', 'Limite de comunicações do processo');
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
        const temConta = !!parte.uid || (parte.representantes || []).some((r) => r.uid);
        if (!ped.outro_meio && !temConta) {
            throw new HttpsError('failed-precondition', `${parte.nome} ainda não tem conta habilitada no portal. Convide a parte (ou um representante) ou registre a comunicação feita por outro meio.`);
        }
        let com: Comunicacao = {
            id: ref.collection('_').doc().id, especie: ped.especie, texto: ped.texto, parte_idx: idx, parte_nome: parte.nome,
            ...(ped.documento_id ? { documento_id: ped.documento_id, documento_titulo: docTitulo } : {}),
            dias: ped.dias, contagem: ped.contagem, expedida_em: agora, expedida_por: c.userName, unidade_id: String(data.unidade_atual),
            limite_ciencia: ped.outro_meio ? null : limiteCiencia(hoje, cfg.dias), status: 'aguardando',
        };
        const prazoTxt = com.dias ? `Prazo de ${textoPrazo(com)}` : 'Sem prazo de resposta';
        let descricao: string;
        if (ped.outro_meio) {
            const r = aplicarCiencia(com, ped.ciencia_data, agora, c.userName, ped.outro_meio, ref.collection('_').doc().id, cfg.calendario);
            com = r.comunicacao;
            if (r.prazo) prazos = [...prazos, r.prazo];
            descricao = `${nomeEspecie} de ${parte.nome} (${parte.polo}) realizada por ${ped.outro_meio}, com ciência em ${br(ped.ciencia_data)}: ${ped.texto}${docTitulo ? ` (${docTitulo})` : ''}. ${r.prazo ? `${prazoTxt}, vence em ${br(r.prazo.vence_em)}.` : `${prazoTxt}.`}`;
        } else {
            descricao = `${nomeEspecie} expedida a ${parte.nome} (${parte.polo}) pela plataforma: ${ped.texto}${docTitulo ? ` (${docTitulo})` : ''}. ${com.dias ? `${prazoTxt}, a contar da ciência` : prazoTxt}.${com.limite_ciencia ? ` Sem ciência até ${br(com.limite_ciencia)}, ela se dá por decurso.` : ''}`;
        }
        lista = [...lista, com];
        const mov = registrarMovimento(tx, c, ref, atual, 'comunicacao', descricao.slice(0, MAX_TEXTO_LONGO), { comunicacao_id: com.id, especie: com.especie, parte_idx: idx });
        campos = { ...campos, ...mov };
        atual = { ...atual, ...mov };
    }
    tx.update(ref, { ...campos, ...gravar(lista, prazos, data) });
    return campos;
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
    tx.update(ref, { ...mov, comunicacoes: nova, ...derivadosComunicacoes(nova) });
    return mov;
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
