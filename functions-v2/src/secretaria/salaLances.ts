/**
 * Sala de lances da disputa de preços (S12). Abre na hora da abertura do
 * aviso e fecha sozinha no fim do prazo (`fimDosLances`); o relógio é só o do
 * servidor: o lance que chega depois do fim é recusado.
 *
 * O estado da sala mora em `secCertames/{id}/sala/estado` (a posição de cada
 * licitante em cada item ou lote, o contador de lances, os apelidos); cada
 * lance fica em `lances/{id}` e nunca se apaga (a exclusão só marca). Todo
 * lance passa por uma transação sobre o estado, então os lances de um certame
 * entram um de cada vez, com número de ordem.
 *   ponytail: uma transação por certame; partir por item se a disputa tiver muitos licitantes ao mesmo tempo.
 *
 * Fornecedor (secretariaPortal): disputaSala, disputaLance, disputaDesfazer, disputaMensagem.
 * Órgão (secretariaProcesso): certameSala, certameExcluirLance, certameMensagem.
 *
 * Durante os lances, ninguém vê quem deu cada lance: o licitante vê o melhor
 * valor e a própria posição; o órgão vê os licitantes por apelido
 * ("Licitante 2"). Os nomes aparecem na classificação, depois do fim.
 */
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { texto } from '../shared/secretaria';
import {
    Lance, Posicao, Proposta, SEGUNDOS_ENTRE_LANCES, num, SEGUNDOS_PARA_DESFAZER, fimDosLances, momentoDaDisputa, ordenarPosicoes, posicaoDe,
    problemaDoLance, totalDoValor, unidadesDeDisputa, valorTexto, AtoDaDisputa, podeNaDisputa, podeObservar,
} from '../shared/certames';
import { auditar } from './config';
import { Contexto, lerProcesso } from './context';
import type { Certame } from './certames';

/** Confere o papel na equipe (S14); sem equipe, vale ter o processo. */
export function exigirAto(x: Certame, uid: string, posse: boolean, ato: AtoDaDisputa) {
    if (podeNaDisputa(x.equipe, uid, posse, ato)) return;
    const eq = x.equipe;
    const de = ato === 'homologar' && eq?.autoridade ? `da autoridade superior (${eq.autoridade.nome})`
        : ato === 'conversar' && eq?.agente ? 'do agente de contratação e da equipe de apoio'
            : eq?.agente ? `do agente de contratação (${eq.agente.nome})` : '';
    throw new HttpsError('permission-denied', de ? `Este ato é ${de}` : 'O processo não está com uma unidade em que você esteja lotado');
}

type Payload = Record<string, unknown>;
type Db = admin.firestore.Firestore;
type Ref = admin.firestore.DocumentReference;
type Tx = admin.firestore.Transaction;

export interface EstadoSala {
    seq: number;
    /** Por unidade (chave), as posições em ordem de classificação. */
    posicoes: Record<string, Posicao[]>;
    /** Apelido de cada licitante: "Licitante n", pela ordem de envio da proposta. */
    apelidos: Record<string, number>;
    /** Último lance de cada licitante (para desfazer e para o intervalo entre lances). */
    ultimos: Record<string, { lance_id: string; chave: string; em: string }>;
    /** `${uid}:${chave}` de quem já desfez um lance naquela unidade. */
    desfeitos: string[];
    iniciado_em: string;
    encerramento_registrado?: true;
}
export interface Mensagem { de: 'agente' | 'licitante'; uid?: string; nome: string; texto: string; em: string; aviso?: true }

export const ACOES_SALA_ORGAO = ['certameSala', 'certameExcluirLance', 'certameMensagem'];
export const ACOES_SALA_FORNECEDOR = ['disputaSala', 'disputaLance', 'disputaDesfazer', 'disputaMensagem'];

const agora = () => new Date().toISOString();
const apelido = (e: EstadoSala, uid: string) => `Licitante ${e.apelidos[uid] || '?'}`;

/** Lê o estado da sala; se ainda não existe (primeiro acesso depois da abertura), monta das propostas. Só leituras: grava quem chamar. */
export async function lerEstado(db: Db, ref: Ref, x: Certame, tx: Tx): Promise<{ estado: EstadoSala; novo: boolean }> {
    const eref = ref.collection('sala').doc('estado');
    const snap = await tx.get(eref);
    if (snap.exists) return { estado: snap.data() as EstadoSala, novo: false };
    const ps = await tx.get(ref.collection('propostas'));
    const propostas = ps.docs.map((d) => ({ uid: d.id, p: d.data() as Proposta })).sort((a, b) => a.p.enviada_em.localeCompare(b.p.enviada_em));
    const posicoes: Record<string, Posicao[]> = {};
    for (const u of unidadesDeDisputa(x)) {
        posicoes[u.chave] = ordenarPosicoes(propostas.map(({ uid, p }) => posicaoDe(uid, p, u, x, [])).filter((v): v is Posicao => !!v), x);
    }
    return {
        estado: { seq: 0, posicoes, apelidos: Object.fromEntries(propostas.map(({ uid }, i) => [uid, i + 1])), ultimos: {}, desfeitos: [], iniciado_em: agora() },
        novo: true,
    };
}
const gravarEstado = (ref: Ref, tx: Tx, e: EstadoSala) => tx.set(ref.collection('sala').doc('estado'), e);

/** Recalcula a posição de um licitante numa unidade depois de uma exclusão (volta ao lance anterior ou à proposta). */
async function recalcular(ref: Ref, x: Certame, e: EstadoSala, uid: string, chave: string, tx: Tx, semId: string): Promise<void> {
    const u = unidadesDeDisputa(x).find((v) => v.chave === chave)!;
    const [pr, ls] = await Promise.all([
        tx.get(ref.collection('propostas').doc(uid)),
        tx.get(ref.collection('lances').where('uid', '==', uid).where('chave', '==', chave)),
    ]);
    const lances = ls.docs.map((d) => d.data() as Lance).filter((l) => l.id !== semId);
    const nova = posicaoDe(uid, pr.data() as Proposta, u, x, lances);
    e.posicoes[chave] = ordenarPosicoes([...(e.posicoes[chave] || []).filter((p) => p.uid !== uid), ...(nova ? [nova] : [])], x);
}

function exigirLances(x: Certame, quando = agora()) {
    if (x.situacao !== 'publicado' || !x.lances) throw new HttpsError('failed-precondition', 'Esta disputa não tem sala de lances');
    const m = momentoDaDisputa(x, quando);
    if (m === 'propostas') throw new HttpsError('failed-precondition', 'A sala de lances abre na hora da abertura');
    if (m === 'encerrada') throw new HttpsError('failed-precondition', 'A fase de lances terminou');
}

/** A conversa da sala segue aberta do início dos lances (ou da abertura, sem lances) até o resultado (S13). */
function exigirConversa(x: Certame, quando = agora()) {
    if (x.situacao !== 'publicado') throw new HttpsError('failed-precondition', x.situacao === 'encerrado' ? 'A disputa já tem resultado: a conversa está encerrada' : 'A disputa não está em curso');
    if (momentoDaDisputa(x, quando) === 'propostas') throw new HttpsError('failed-precondition', 'A conversa da disputa abre na hora da abertura');
}

const resumoUnidades =(x: Certame) => unidadesDeDisputa(x).map((u) => ({
    chave: u.chave, nome: u.nome, descricao: u.itens.map((i) => i.descricao).join('; ').slice(0, 300),
    quantidade: x.unidade_disputa === 'item' ? u.itens[0].quantidade : undefined, unidade: x.unidade_disputa === 'item' ? u.itens[0].unidade : undefined,
}));

// ─── Fornecedor ────────────────────────────────────────────────────────────

export async function acaoSalaFornecedor(db: Db, uid: string, p: Payload, lerCertame: (db: Db, id: unknown, tx?: Tx) => Promise<{ ref: Ref; x: Certame }>): Promise<unknown> {
    if (p.action === 'disputaSala') {
        return db.runTransaction(async (tx) => {
            const { ref, x } = await lerCertame(db, p.certame_id, tx);
            const quando = agora();
            // S14: na dispensa, quem não participa acompanha a sessão pública (sem lances próprios).
            const observador = !(x.fornecedores_uids || []).includes(uid);
            if (!podeObservar(x, uid, quando)) throw new HttpsError('permission-denied', 'Você não participa desta disputa');
            const momento = momentoDaDisputa(x, quando);
            if (!x.lances || momento === 'propostas' || x.situacao !== 'publicado') {
                return { momento, fim: fimDosLances(x) || null, agora: quando, unidades: [], meus: [], mensagens: [], observador };
            }
            const { estado: e, novo } = await lerEstado(db, ref, x, tx);
            // Sem orderBy: igualdade pura dispensa índice composto; ordena aqui.
            // ponytail: lê todos os lances e mensagens do licitante; paginar se passar de alguns milhares.
            const [lsMeus, msgA, msgM] = await Promise.all([
                tx.get(ref.collection('lances').where('uid', '==', uid)),
                tx.get(ref.collection('mensagens').where('de', '==', 'agente')),
                tx.get(ref.collection('mensagens').where('uid', '==', uid)),
            ]);
            const meus = { docs: lsMeus.docs.sort((a, b) => (b.data() as Lance).seq - (a.data() as Lance).seq).slice(0, 30) };
            if (novo) gravarEstado(ref, tx, e);
            const ult = e.ultimos[uid];
            const podeDesfazer = momento === 'lances' && ult && Date.parse(quando) - Date.parse(ult.em) <= SEGUNDOS_PARA_DESFAZER * 1000 && !e.desfeitos.includes(`${uid}:${ult.chave}`)
                && !(meus.docs.find((d) => d.id === ult.lance_id)?.data() as Lance | undefined)?.excluido;
            return {
                momento, fim: fimDosLances(x), agora: quando, apelido: observador ? null : apelido(e, uid), observador,
                unidades: resumoUnidades(x).map((u) => {
                    const ps = e.posicoes[u.chave] || [];
                    const k = ps.findIndex((v) => v.uid === uid);
                    return { ...u, melhor: ps[0] ? { valor: ps[0].valor, total: ps[0].total } : null, meu: k >= 0 ? { valor: ps[k].valor, total: ps[k].total } : null, posicao: k >= 0 ? k + 1 : null, participantes: ps.length };
                }),
                meus: meus.docs.map((d) => { const l = d.data() as Lance; return { id: l.id, chave: l.chave, valor: l.valor, total: l.total, em: l.em, excluido: l.excluido ? { por: l.excluido.por, motivo: l.excluido.motivo } : undefined }; }),
                pode_desfazer: podeDesfazer ? { lance_id: ult.lance_id, ate: new Date(Date.parse(ult.em) + SEGUNDOS_PARA_DESFAZER * 1000).toISOString() } : null,
                mensagens: [...msgA.docs, ...msgM.docs].map((d) => { const m = d.data() as Mensagem; return { id: d.id, de: m.de, nome: m.de === 'licitante' ? 'Você' : m.nome, texto: m.texto, em: m.em, aviso: m.aviso }; })
                    .sort((a, b) => a.em.localeCompare(b.em)).slice(-150),
            };
        });
    }

    if (p.action === 'disputaLance') {
        const envio = typeof p.envio === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(p.envio) ? p.envio : null;
        return db.runTransaction(async (tx) => {
            const { ref, x } = await lerCertame(db, p.certame_id, tx);
            const quando = agora();
            exigirLances(x, quando);
            const lid = envio ? `${uid}_${envio}` : ref.collection('lances').doc().id;
            const lref = ref.collection('lances').doc(lid);
            const ja = await tx.get(lref);
            const { estado: e } = await lerEstado(db, ref, x, tx);
            // Reenvio do mesmo lance (falha de rede): devolve o que já foi gravado.
            if (ja.exists) { const l = ja.data() as Lance; return { ok: true, repetido: true, lance: { id: l.id, valor: l.valor, total: l.total, em: l.em, seq: l.seq } }; }
            const chave = String(p.chave || '');
            const u = unidadesDeDisputa(x).find((v) => v.chave === chave);
            if (!u) throw new HttpsError('invalid-argument', 'Item ou lote inexistente');
            const ps = e.posicoes[chave] || [];
            const minha = ps.find((v) => v.uid === uid);
            if (!minha) throw new HttpsError('permission-denied', 'Só dá lance quem cotou este item ou lote na proposta');
            const ult = e.ultimos[uid];
            if (ult && Date.parse(quando) - Date.parse(ult.em) < SEGUNDOS_ENTRE_LANCES * 1000) throw new HttpsError('resource-exhausted', `Aguarde ${SEGUNDOS_ENTRE_LANCES} segundos entre um lance e outro`);
            const valor = Math.round(num(p.valor) * 10000) / 10000;
            const problema = problemaDoLance(valor, minha.valor, x);
            if (problema) throw new HttpsError('invalid-argument', problema);
            const seq = e.seq + 1;
            const lance: Lance = { id: lid, seq, chave, uid, valor, total: totalDoValor(valor, u, x), em: quando };
            tx.set(lref, lance);
            e.seq = seq;
            e.ultimos[uid] = { lance_id: lid, chave, em: quando };
            e.posicoes[chave] = ordenarPosicoes([...ps.filter((v) => v.uid !== uid), { uid, valor, total: lance.total, em: quando, seq }], x);
            gravarEstado(ref, tx, e);
            const posicao = e.posicoes[chave].findIndex((v) => v.uid === uid) + 1;
            return { ok: true, lance: { id: lid, valor, total: lance.total, em: quando, seq }, posicao };
        });
    }

    if (p.action === 'disputaDesfazer') {
        return db.runTransaction(async (tx) => {
            const { ref, x } = await lerCertame(db, p.certame_id, tx);
            const quando = agora();
            exigirLances(x, quando);
            const { estado: e } = await lerEstado(db, ref, x, tx);
            const ult = e.ultimos[uid];
            if (!ult || (p.lance_id && p.lance_id !== ult.lance_id)) throw new HttpsError('failed-precondition', 'Só se desfaz o último lance');
            if (Date.parse(quando) - Date.parse(ult.em) > SEGUNDOS_PARA_DESFAZER * 1000) throw new HttpsError('deadline-exceeded', `O lance só se desfaz em até ${SEGUNDOS_PARA_DESFAZER} segundos`);
            if (e.desfeitos.includes(`${uid}:${ult.chave}`)) throw new HttpsError('failed-precondition', 'Você já desfez um lance neste item ou lote');
            const lref = ref.collection('lances').doc(ult.lance_id);
            const l = (await tx.get(lref)).data() as Lance | undefined;
            if (!l || l.excluido) throw new HttpsError('failed-precondition', 'Este lance já foi excluído');
            await recalcular(ref, x, e, uid, ult.chave, tx, l.id);
            tx.update(lref, { excluido: { por: 'licitante', em: quando } });
            e.desfeitos = [...e.desfeitos, `${uid}:${ult.chave}`];
            gravarEstado(ref, tx, e);
            return { ok: true };
        });
    }

    if (p.action === 'disputaMensagem') {
        const t = texto(p.texto, 500);
        if (t.length < 2) throw new HttpsError('invalid-argument', 'Escreva a mensagem');
        return db.runTransaction(async (tx) => {
            const { ref, x } = await lerCertame(db, p.certame_id, tx);
            exigirConversa(x);
            if (!(x.fornecedores_uids || []).includes(uid)) throw new HttpsError('permission-denied', 'Você não participa desta disputa');
            const { estado: e, novo } = await lerEstado(db, ref, x, tx);
            if (novo) gravarEstado(ref, tx, e);
            const m: Mensagem = { de: 'licitante', uid, nome: apelido(e, uid), texto: t, em: agora() };
            tx.set(ref.collection('mensagens').doc(), m);
            return { ok: true };
        });
    }
    throw new HttpsError('invalid-argument', 'Ação desconhecida');
}

// ─── Órgão ─────────────────────────────────────────────────────────────────

export async function acaoSalaOrgao(c: Contexto, p: Payload, certameDoProcesso: (data: admin.firestore.DocumentData) => string | null): Promise<unknown> {
    const db = c.db;
    const col = db.collection('secCertames');
    if (p.action === 'certameSala') {
        const { data } = await lerProcesso(c, p.processo_id, undefined, { equipe: true });
        const id = certameDoProcesso(data);
        if (!id) throw new HttpsError('not-found', 'Disputa não encontrada');
        const posse = c.ctx.unidadeIds.includes(data.unidade_atual);
        return db.runTransaction(async (tx) => {
            const ref = col.doc(id);
            const x = (await tx.get(ref)).data() as Certame | undefined;
            if (!x || x.situacao !== 'publicado' || !x.lances) throw new HttpsError('failed-precondition', 'Esta disputa não tem sala de lances');
            const quando = agora();
            const momento = momentoDaDisputa(x, quando);
            if (momento === 'propostas') return { momento, fim: fimDosLances(x), agora: quando, unidades: [], lances: [], mensagens: [], pode: { gerir: false } };
            const { estado: e, novo } = await lerEstado(db, ref, x, tx);
            const [ls, ms] = await Promise.all([
                tx.get(ref.collection('lances').orderBy('seq', 'desc').limit(300)),
                tx.get(ref.collection('mensagens').orderBy('em', 'desc').limit(200)),
            ]);
            // Nomes, só depois do fim (antes, o órgão também vê por apelido).
            const nomes: Record<string, string> = {};
            if (momento === 'encerrada') {
                const ps = await tx.get(ref.collection('propostas'));
                for (const d of ps.docs) nomes[d.id] = (d.data() as Proposta).licitante.razao_social;
            }
            if (novo) gravarEstado(ref, tx, e);
            const quem = (uid: string) => nomes[uid] ? `${nomes[uid]} (${apelido(e, uid)})` : apelido(e, uid);
            return {
                momento, fim: fimDosLances(x), agora: quando, criterio: x.criterio, unidade_disputa: x.unidade_disputa,
                unidades: resumoUnidades(x).map((u) => ({ ...u, posicoes: (e.posicoes[u.chave] || []).map((v) => ({ quem: quem(v.uid), valor: v.valor, total: v.total, em: v.em, lance: v.seq > 0 })) })),
                lances: ls.docs.map((d) => { const l = d.data() as Lance; return { id: l.id, seq: l.seq, chave: l.chave, quem: quem(l.uid), valor: l.valor, total: l.total, em: l.em, excluido: l.excluido }; }),
                mensagens: ms.docs.map((d) => { const m = d.data() as Mensagem; return { id: d.id, de: m.de, nome: m.de === 'licitante' && m.uid ? quem(m.uid) : m.nome, texto: m.texto, em: m.em, aviso: m.aviso }; }).reverse(),
                total_lances: e.seq,
                pode: {
                    gerir: podeNaDisputa(x.equipe, c.ctx.uid, posse, 'conduzir') && momento === 'lances',
                    conversar: podeNaDisputa(x.equipe, c.ctx.uid, posse, 'conversar') && momento === 'lances',
                },
            };
        });
    }

    // Excluir lance e mensagem: quem tem o processo, durante os lances.
    const r = await db.runTransaction(async (tx) => {
        const { data } = await lerProcesso(c, p.processo_id, tx, { equipe: true });
        const id = certameDoProcesso(data);
        if (!id) throw new HttpsError('not-found', 'Disputa não encontrada');
        const ref = col.doc(id);
        const x = (await tx.get(ref)).data() as Certame;
        if (!x) throw new HttpsError('not-found', 'Disputa não encontrada');
        // S14: a conversa é do agente e da equipe de apoio; excluir lance, de quem conduz.
        exigirAto(x, c.ctx.uid, c.ctx.unidadeIds.includes(data.unidade_atual), p.action === 'certameMensagem' ? 'conversar' : 'conduzir');
        const quando = agora();
        if (p.action === 'certameMensagem') exigirConversa(x, quando); else exigirLances(x, quando);
        const { estado: e } = await lerEstado(db, ref, x, tx);
        if (p.action === 'certameMensagem') {
            const t = texto(p.texto, 1000);
            if (t.length < 2) throw new HttpsError('invalid-argument', 'Escreva a mensagem');
            tx.set(ref.collection('mensagens').doc(), { de: 'agente', nome: c.userName, texto: t, em: quando } as Mensagem);
            gravarEstado(ref, tx, e);
            return { ok: true };
        }
        if (p.action === 'certameExcluirLance') {
            const motivo = texto(p.motivo, 500);
            if (motivo.length < 5) throw new HttpsError('invalid-argument', 'Diga o motivo da exclusão (ao menos 5 letras)');
            if (typeof p.lance_id !== 'string' || !/^[A-Za-z0-9_-]{1,90}$/.test(p.lance_id)) throw new HttpsError('invalid-argument', 'Lance inválido');
            const lref = ref.collection('lances').doc(p.lance_id);
            const l = (await tx.get(lref)).data() as Lance | undefined;
            if (!l) throw new HttpsError('not-found', 'Lance não encontrado');
            if (l.excluido) throw new HttpsError('failed-precondition', 'Este lance já foi excluído');
            await recalcular(ref, x, e, l.uid, l.chave, tx, l.id);
            tx.update(lref, { excluido: { por: 'agente', motivo, em: quando } });
            const u = unidadesDeDisputa(x).find((v) => v.chave === l.chave);
            // Aviso automático a todos na sala (IN 73/2022, art. 21, § 4º).
            tx.set(ref.collection('mensagens').doc(), {
                de: 'agente', nome: c.userName, aviso: true, em: quando,
                texto: `Excluído o lance de ${valorTexto(l.valor, x)} de ${apelido(e, l.uid)} em ${u?.nome || l.chave}: ${motivo}`,
            } as Mensagem);
            gravarEstado(ref, tx, e);
            return { ok: true, auditoria: 'SECRETARIA_SESSAO_LANCE_EXCLUIDO' };
        }
        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    });
    const { auditoria, ...resto } = r as { auditoria?: string } & Record<string, unknown>;
    if (auditoria) await auditar(db, c.orgId, c.ctx.uid, c.userName, auditoria, { processo_id: p.processo_id });
    return resto;
}
