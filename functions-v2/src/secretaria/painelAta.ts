import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { hojeBrasil, lotacoesDe, sha256, somarDias } from '../shared/secretaria';
import { Orgao, composicaoEm, orgaosDe } from '../shared/orgaos';
import {
    AtaSessao, ItemDaAta, MAX_ATA, PedidoSessao, PresencaDaAta, Votacao, ataAssinada, br, ondeSessao, textoDaAta,
} from '../shared/sessoes';
import { auditar } from './config';
import { COL, Contexto } from './context';
import { notificarPessoas } from './avisosEquipe';
import { COL_SESSOES, Sessao, colegiado, gereSessoes, lerConfig, lerSessao, veSessoes } from './sessoes';
import { resumoVotacao } from './votacao';
import { AssuntoReuniao, textoDaAtaReuniao } from '../shared/reunioes';
import { Deliberacao, aptos, devemVotoNaReuniao, votaramNaReuniao } from './reunioes';

/**
 * Etapa S8: presença, chamada do processo em julgamento, ata da sessão
 * (gerada ao encerrar, assinada pelo presidente e pela secretaria), o painel ao
 * vivo (secPaineis/{sessao}) e os avisos à composição (publicação,
 * cancelamento e lembretes da rotina diária).
 *
 * O painel é uma cópia do que todos os leitores podem ver (sem votos antes da
 * proclamação, sem assunto de processo restrito): as regras do Firestore deixam
 * ler quem está em `leitores`, e a tela recarrega quando `versao` muda.
 */

export const COL_PAINEIS = 'secPaineis';
export const ACOES_S8 = ['sessaoPresenca', 'sessaoChamar', 'sessaoAta', 'sessaoAtaAssinar'];
type Payload = Record<string, unknown>;

/** Nome de cada conta na entidade (userOrganizations). */
async function nomesPor(db: admin.firestore.Firestore, orgId: string, uids: string[]): Promise<Map<string, string>> {
    const lista = [...new Set(uids)].filter(Boolean);
    if (!lista.length) return new Map();
    const snaps = await db.getAll(...lista.map((u) => db.collection('userOrganizations').doc(`${u}_${orgId}`)));
    return new Map(snaps.map((s, i) => [lista[i], String(s.data()?.user_name || s.data()?.user_email || 'Membro')]));
}

async function orgaoDa(db: admin.firestore.Firestore, orgId: string, s: Sessao): Promise<Orgao | undefined> {
    const cfg = (await db.collection(COL.config).doc(orgId).get()).data();
    return orgaosDe(cfg?.orgaos).find((o) => o.id === s.orgao_id);
}

/** Quem vota no dia (presidente e titulares), como na votação. */
const votamNoDia = (o: Orgao, dia: string) => composicaoEm(o.composicao, dia).filter((m) => m.funcao !== 'suplente').map((m) => m.uid);

/** Assuntos da reunião no painel: quantos votaram, nunca o voto; o resultado depois da apuração. */
async function itensDaReuniao(sref: admin.firestore.DocumentReference, s: Sessao, o: Orgao) {
    const as = [...((s.assuntos || []) as AssuntoReuniao[])].sort((a, b) => a.ordem - b.ordem);
    const ds = as.length ? await sref.firestore.getAll(...as.map((a) => sref.collection('deliberacoes').doc(a.id))) : [];
    return as.map((a, i) => {
        const d = ds[i]?.data() as Deliberacao | undefined;
        const podem = aptos(o, s.data, a);
        const votaram = (a.votacao === 'secreta' ? d?.votaram || [] : Object.keys(d?.votos || {})).filter((u) => podem.includes(u)).length;
        return {
            id: a.id, ordem: a.ordem, titulo: a.titulo, votacao: a.votacao, maioria: a.maioria, situacao: a.situacao, motivo: a.motivo || '',
            votaram, aptos: podem.length, resultado: a.resultado?.texto || null, aprovado: a.resultado?.aprovado ?? null,
            com_a_palavra: a.com_a_palavra ? { nome: a.com_a_palavra.nome, em: a.com_a_palavra.em } : null,
            inscritos: (a.inscritos || []).map((x) => x.nome),
        };
    });
}

/**
 * Refaz o painel da sessão. `extra`: alguém que pode ver a sessão e não está
 * entre os leitores de base (admin, gestor fora do colegiado). Nunca lança:
 * painel desatualizado não desfaz o ato.
 */
export async function atualizarPainel(db: admin.firestore.Firestore, orgId: string, sessaoId: string, extra?: string): Promise<void> {
    try {
        const sref = db.collection(COL_SESSOES).doc(sessaoId);
        const pref = db.collection(COL_PAINEIS).doc(sessaoId);
        const [ss, ps] = await Promise.all([sref.get(), pref.get()]);
        const s = ss.data() as Sessao | undefined;
        if (!s || s.organization_id !== orgId) return;
        const o = await orgaoDa(db, orgId, s);
        if (!o) return;
        const pauta = [...(s.pauta || [])].sort((a, b) => a.ordem - b.ordem);
        const [vs, procs, unis] = await Promise.all([
            pauta.length ? db.getAll(...pauta.map((x) => sref.collection('votacoes').doc(x.processo_id))) : Promise.resolve([]),
            pauta.length ? db.getAll(...pauta.map((x) => db.collection(COL.processos).doc(x.processo_id))) : Promise.resolve([]),
            db.collection(COL.unidades).where('organization_id', '==', orgId).where('orgao_id', '==', o.id).get(),
        ]);
        const extras = [...new Set([...((ps.data()?.extras || []) as string[]), ...(extra ? [extra] : [])])];
        // Rascunho: só quem o abriu (a secretaria). Publicada: a composição, quem está lotado no colegiado e os extras.
        const base = s.situacao === 'rascunho' ? [] : [
            ...composicaoEm(o.composicao, s.data).map((m) => m.uid),
            ...unis.docs.filter((u) => !u.data().excluida).flatMap((u) => lotacoesDe(u.data()).map((l) => l.uid)),
        ];
        const quemVota = votamNoDia(o, s.data);
        const itens = s.tipo === 'reuniao' ? await itensDaReuniao(sref, s, o) : pauta.map((x, i) => {
            const v = vs[i]?.data() as Votacao | undefined;
            const d = procs[i]?.data();
            const julgado = !!d && d.ultima_sessao?.id === sessaoId && d.sessao?.id !== sessaoId;
            const r = resumoVotacao(v, '', x.situacao === 'pautado' ? quemVota : [], x.relator_uid || '');
            return {
                processo_id: x.processo_id, ordem: x.ordem, numero: x.numero, inclusao: x.inclusao,
                assunto: d?.sigilo === 'restrito' ? 'Processo sob sigilo' : x.assunto,
                situacao: julgado || (x.situacao === 'pautado' && v?.proclamado) ? 'julgado' : x.situacao,
                relator: x.relator_nome || '',
                // Só o resultado proclamado; o voto de cada um fica na tela de julgamento.
                resultado: v?.proclamado?.resultado || null,
                liberado: r.liberado, votaram: r.votaram, vogais: r.vogais,
            };
        });
        await pref.set({
            organization_id: orgId, orgao_id: o.id, colegiado: o.nome,
            leitores: [...new Set([...base, ...extras])].slice(0, 500), extras, tipo: s.tipo || 'julgamento',
            titulo: s.titulo, carater: s.carater, modo: s.modo, data: s.data, hora: s.hora, fim: s.fim || null, local: s.local || '', link: s.link || '',
            situacao: s.situacao, em_julgamento: s.em_julgamento || null, ata_assinada: ataAssinada(s.ata as AtaSessao | undefined),
            itens, versao: FieldValue.increment(1), atualizado_em: new Date().toISOString(),
        }, { merge: true });
    } catch (e) { console.error('painel não atualizado', sessaoId, e); }
}

/** Gera a ata com o que a sessão registrou (presença, pauta, votações, sustentações). */
export async function montarAta(db: admin.firestore.Firestore, orgId: string, sessaoId: string): Promise<AtaSessao> {
    const sref = db.collection(COL_SESSOES).doc(sessaoId);
    const s = (await sref.get()).data() as Sessao;
    const o = await orgaoDa(db, orgId, s);
    if (!o) throw new HttpsError('failed-precondition', 'O colegiado da sessão não existe mais');
    const pauta = [...(s.pauta || [])].sort((a, b) => a.ordem - b.ordem);
    const [vs, procs, peds] = await Promise.all([
        pauta.length ? db.getAll(...pauta.map((x) => sref.collection('votacoes').doc(x.processo_id))) : Promise.resolve([]),
        pauta.length ? db.getAll(...pauta.map((x) => db.collection(COL.processos).doc(x.processo_id))) : Promise.resolve([]),
        sref.collection('pedidos').get(),
    ]);
    const vots = vs.map((d) => d.data() as Votacao | undefined);
    const comp = composicaoEm(o.composicao, s.data);
    // Na virtual, participou quem votou (o relator, ao liberar o voto).
    const votaram = new Set(vots.flatMap((v) => (v ? [...(v.liberado_em ? [v.relator_uid] : []), ...Object.keys(v.votos || {})] : [])));
    if (s.tipo === 'reuniao') for (const u of await votaramNaReuniao(sref, s)) votaram.add(u);
    const nm = await nomesPor(db, orgId, [...comp.map((m) => m.uid), ...votaram]);
    const nome = (u: string) => nm.get(u) || 'Membro';
    const presid = comp.find((m) => m.funcao === 'presidente');
    const marcas = (s.presencas || {}) as Record<string, boolean>;
    const registrada = s.modo !== 'assincrona' && Object.keys(marcas).length > 0;
    const presidenteFaltou = !!presid && registrada && marcas[presid.uid] !== true;
    const outros = comp.filter((m) => m.uid !== presid?.uid);
    const presenca: PresencaDaAta = s.modo === 'assincrona'
        ? { presidente: presid ? nome(presid.uid) : '', presentes: [...votaram].map(nome), ausentes: [], registrada: true }
        : {
            presidente: presid && !presidenteFaltou ? nome(presid.uid) : '',
            presentes: (registrada ? outros.filter((m) => marcas[m.uid] === true) : outros).map((m) => nome(m.uid)),
            ausentes: registrada ? comp.filter((m) => marcas[m.uid] !== true).map((m) => nome(m.uid)) : [],
            registrada,
        };
    const pedidos = peds.docs.map((d) => d.data() as PedidoSessao);
    const itens: ItemDaAta[] = pauta.map((x, i) => {
        const v = vots[i];
        const restrito = procs[i]?.data()?.sigilo === 'restrito';
        return {
            numero: x.numero, assunto: restrito ? '' : x.assunto, situacao: x.situacao, motivo: x.motivo || '', relator: x.relator_nome || v?.relator_nome || '',
            vista: x.vista, proclamado: v?.proclamado?.texto || '', redator: v?.proclamado && v.acordao ? v.acordao.redator_nome : '',
            sustentacoes: [...new Set(pedidos.filter((p) => p.processo_id === x.processo_id && p.tipo === 'sustentacao' && p.situacao !== 'indeferido').map((p) => p.parte))],
        };
    });
    const dia = String(s.encerrada_em || new Date().toISOString()).slice(0, 10);
    const textoAta = (s.tipo === 'reuniao'
        ? textoDaAtaReuniao(s, o.nome, presenca, [...((s.assuntos || []) as AssuntoReuniao[])].sort((a, b) => a.ordem - b.ordem), dia)
        : textoDaAta(s, o.nome, presenca, itens, dia)).slice(0, MAX_ATA);
    return { texto: textoAta, gerada_em: new Date().toISOString(), sha256: sha256(textoAta), assinaturas: [] };
}

export async function acaoAta(c: Contexto, p: Payload): Promise<unknown> {
    const hoje = hojeBrasil();
    const quem = { uid: c.ctx.uid, nome: c.userName };
    const { orgaos } = await lerConfig(c);
    const { ref, s } = await lerSessao(c, p.id);
    const o = colegiado(orgaos, s.orgao_id);
    const gere = gereSessoes(c, o.id);
    if (!veSessoes(c, o, hoje) || (s.situacao === 'rascunho' && !gere)) throw new HttpsError('not-found', 'Sessão não encontrada');
    const comp = composicaoEm(o.composicao, s.data);
    const preside = comp.some((m) => m.uid === quem.uid && m.funcao === 'presidente');
    const noDia = s.situacao === 'publicada' && s.ativa && s.modo !== 'assincrona' && s.data <= hoje;

    if (p.action === 'sessaoPresenca') {
        if (!gere) throw new HttpsError('permission-denied', 'Quem registra a presença é a secretaria do colegiado');
        if (!noDia) throw new HttpsError('failed-precondition', s.modo === 'assincrona' ? 'Na sessão virtual, participa quem vota: não há presença a registrar' : 'A presença se registra no dia da sessão publicada, até o encerramento');
        const raw = (p.presencas && typeof p.presencas === 'object' ? p.presencas : {}) as Record<string, unknown>;
        const presencas: Record<string, boolean> = {};
        for (const m of comp) if (typeof raw[m.uid] === 'boolean') presencas[m.uid] = raw[m.uid] as boolean;
        await ref.update({ presencas, version: FieldValue.increment(1), updated_at: FieldValue.serverTimestamp() });
        return { ok: true, presentes: Object.values(presencas).filter(Boolean).length };
    }

    if (p.action === 'sessaoChamar') {
        if (!gere && !preside) throw new HttpsError('permission-denied', 'Chama o processo o presidente do colegiado (ou a secretaria)');
        if (!noDia) throw new HttpsError('failed-precondition', 'Chama-se o processo no dia da sessão publicada');
        const pid = typeof p.processo_id === 'string' ? p.processo_id : '';
        // Na reunião (S9), chama-se o assunto.
        if (s.tipo === 'reuniao') {
            if (pid && !((s.assuntos || []) as AssuntoReuniao[]).some((a) => a.id === pid && ['pauta', 'em_votacao', 'empate'].includes(a.situacao))) throw new HttpsError('failed-precondition', 'O assunto não está na pauta desta reunião');
        } else if (pid && !(s.pauta || []).some((x) => x.processo_id === pid && x.situacao === 'pautado')) throw new HttpsError('failed-precondition', 'O processo não está pautado nesta sessão');
        await ref.update({ em_julgamento: pid || FieldValue.delete(), version: FieldValue.increment(1), updated_at: FieldValue.serverTimestamp() });
        return { ok: true };
    }

    const ata = s.ata as AtaSessao | undefined;
    if (p.action === 'sessaoAta') {
        if (!gere) throw new HttpsError('permission-denied', 'Quem lavra a ata é a secretaria do colegiado');
        if (s.situacao !== 'encerrada') throw new HttpsError('failed-precondition', 'A ata se lavra depois de encerrada a sessão');
        if (ata?.assinaturas?.length) throw new HttpsError('failed-precondition', 'A ata já tem assinatura e não muda mais');
        let nova: AtaSessao;
        if (p.refazer === true || !ata) nova = await montarAta(c.db, c.orgId, ref.id);
        else {
            const t = String(p.texto ?? '').replace(/\r\n/g, '\n').slice(0, MAX_ATA);
            if (t.trim().length < 20) throw new HttpsError('invalid-argument', 'A ata ficou curta demais');
            nova = { ...ata, texto: t, sha256: sha256(t), editada_por: quem.nome };
        }
        await ref.update({ ata: nova, version: FieldValue.increment(1) });
        await auditar(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_ATA', { sessao_id: ref.id, refeita: p.refazer === true || !ata });
        return { ok: true };
    }

    if (p.action === 'sessaoAtaAssinar') {
        const papel = p.papel === 'presidente' ? 'presidente' : 'secretaria';
        if (papel === 'presidente' ? !preside : !gere) {
            throw new HttpsError('permission-denied', papel === 'presidente' ? 'Assina como presidente quem preside o colegiado no dia da sessão' : 'Assina como secretaria quem cuida das sessões do colegiado');
        }
        await c.db.runTransaction(async (tx) => {
            const atual = (await tx.get(ref)).data() as Sessao;
            const a = atual.ata as AtaSessao | undefined;
            if (!a) throw new HttpsError('failed-precondition', 'A ata ainda não foi lavrada');
            if (a.assinaturas.some((x) => x.papel === papel)) throw new HttpsError('already-exists', `A ata já tem a assinatura ${papel === 'presidente' ? 'do presidente' : 'da secretaria'}`);
            if (a.assinaturas.some((x) => x.uid === quem.uid)) throw new HttpsError('failed-precondition', 'Você já assinou esta ata: a outra assinatura é de outra pessoa');
            tx.update(ref, { 'ata.assinaturas': [...a.assinaturas, { uid: quem.uid, nome: quem.nome, papel, em: new Date().toISOString(), sha256: a.sha256 }], version: FieldValue.increment(1) });
        });
        await auditar(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_ATA_ASSINADA', { sessao_id: ref.id, papel });
        return { ok: true };
    }
    throw new HttpsError('invalid-argument', 'Ação desconhecida');
}

const esc = (t: string) => t.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const quando = (s: Sessao) => (s.modo === 'assincrona' ? `votação virtual de ${br(s.data)} a ${br(String(s.fim || s.data))}` : `${br(s.data)}, às ${s.hora}, ${ondeSessao(s)}`);

/** Avisa quem compõe o colegiado no dia da sessão (sino e e-mail, pela preferência de cada um). */
export async function avisarComposicao(db: admin.firestore.Firestore, orgId: string, sessaoId: string, s: Sessao, o: Orgao, oQue: 'publicada' | 'cancelada' | 'amanha' | 'abriu' | 'ultimo_dia', uids?: string[], autorUid?: string): Promise<void> {
    const reuniao = s.tipo === 'reuniao';
    const n = reuniao ? ((s.assuntos || []) as AssuntoReuniao[]).filter((a) => a.situacao !== 'retirado').length : (s.pauta || []).filter((x) => x.situacao === 'pautado').length;
    const proc = reuniao ? (n === 1 ? '1 assunto' : `${n} assuntos`) : n === 1 ? '1 processo' : `${n} processos`;
    const t = {
        publicada: reuniao
            ? [`Reunião convocada: ${s.titulo}`, `${o.nome}, ${quando(s)} · ${proc} na pauta. Abra a reunião para ler os assuntos.`]
            : [`Pauta publicada: ${s.titulo}`, `${o.nome}, ${quando(s)} · ${proc}. Os autos ficam abertos a quem compõe o colegiado enquanto pautados.`],
        cancelada: [`${reuniao ? 'Reunião cancelada' : 'Sessão cancelada'}: ${s.titulo}`, `${o.nome}, que seria em ${quando(s)}. Motivo: ${s.motivo_cancelamento || ''}`],
        amanha: [`${reuniao ? 'Reunião amanhã' : 'Sessão amanhã'}: ${s.titulo}`, `${o.nome}, ${quando(s)} · ${proc} na pauta.`],
        abriu: [`Votação virtual aberta: ${s.titulo}`, `${o.nome}, ${quando(s)} · ${proc} na pauta. Vote até ${br(String(s.fim || s.data))}.`],
        ultimo_dia: [`Último dia para votar: ${s.titulo}`, `${o.nome}: a votação virtual termina hoje e você ainda tem voto a dar. Quem não vota fica ausente.`],
    }[oQue];
    await notificarPessoas(db, orgId, uids || composicaoEm(o.composicao, s.data).map((m) => m.uid), {
        subtipo: 'sessao', procId: '', sessaoId, titulo: t[0], mensagem: t[1].slice(0, 300), html: `<p>${esc(t[1])}</p>`,
    }, autorUid);
}

/**
 * Rotina das 7h: lembra a composição da sessão de amanhã, da votação virtual
 * que abre hoje e, no último dia, quem ainda não votou. Uma vez por dia e sessão.
 */
export async function lembrarSessoes(db: admin.firestore.Firestore, hoje = hojeBrasil()): Promise<number> {
    const amanha = somarDias(hoje, 1);
    const [a, b, f] = await Promise.all([
        db.collection(COL_SESSOES).where('data', '==', amanha).limit(300).get(),
        db.collection(COL_SESSOES).where('data', '==', hoje).limit(300).get(),
        db.collection(COL_SESSOES).where('fim', '==', hoje).limit(300).get(),
    ]);
    const vistos = new Set<string>();
    let n = 0;
    for (const d of [...f.docs, ...b.docs, ...a.docs]) {
        if (vistos.has(d.id)) continue;
        vistos.add(d.id);
        const s = d.data() as Sessao;
        if (s.situacao !== 'publicada' || !s.ativa || s.lembrado_em === hoje) continue;
        const virtual = s.modo === 'assincrona';
        const oQue = virtual ? (s.fim === hoje ? 'ultimo_dia' : s.data === hoje ? 'abriu' : null) : s.data === amanha ? 'amanha' : null;
        if (!oQue) continue;
        try {
            const orgId = String(s.organization_id);
            const o = await orgaoDa(db, orgId, s);
            if (!o) continue;
            let uids: string[] | undefined;
            if (oQue === 'ultimo_dia' && s.tipo === 'reuniao') uids = await devemVotoNaReuniao(d.ref, s, o);
            else if (oQue === 'ultimo_dia') {
                // Só quem ainda deve voto em processo com o voto do relator liberado.
                const quemVota = votamNoDia(o, s.data);
                const pautados = (s.pauta || []).filter((x) => x.situacao === 'pautado');
                const vs = pautados.length ? await db.getAll(...pautados.map((x) => d.ref.collection('votacoes').doc(x.processo_id))) : [];
                const devem = new Set<string>();
                for (const v of vs.map((x) => x.data() as Votacao | undefined)) {
                    if (!v?.liberado_em || v.proclamado) continue;
                    for (const u of quemVota) if (u !== v.relator_uid && !v.votos?.[u]) devem.add(u);
                }
                uids = [...devem];
            }
            await d.ref.update({ lembrado_em: hoje });
            if (uids && !uids.length) continue;
            await avisarComposicao(db, orgId, d.id, s, o, oQue, uids);
            n++;
        } catch (e) { console.error('lembrete da sessão', d.id, e); }
    }
    return n;
}

/** Para a tela: a ata sem o que é interno (uid de quem assinou). */
export function ataParaTela(a: AtaSessao | undefined) {
    if (!a) return null;
    return {
        texto: a.texto, gerada_em: a.gerada_em, sha256: a.sha256, editada_por: a.editada_por || '', assinada: ataAssinada(a),
        assinaturas: (a.assinaturas || []).map((x) => ({ nome: x.nome, papel: x.papel, em: x.em })),
    };
}
