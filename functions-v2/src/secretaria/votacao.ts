import * as admin from 'firebase-admin';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { hojeBrasil, jsonCanonico, sha256, texto } from '../shared/secretaria';
import { sanitizeDoc } from '../shared/documento';
import { composicaoEm } from '../shared/orgaos';
import { JulgamentoDaAcao, apurar, dadosDoJulgamento, textoDoJulgamento } from '../shared/julgamento';
import {
    ItemPauta, MAX_EMENTA, MAX_RELATORIO, NOME_PEDIDO, PedidoSessao, Proclamacao, Votacao, br, documentoDoAcordao, julgamentoPendente, modeloDoAcordao, placarParcial,
    prazoDaVista, prazoDoAcordao, sanitizeVoto, textoDaDevolucao, textoDaDiligencia, textoDaVista, textoDoAdiamento, textoDoDestaque, votacaoAberta, virtualEncerrou,
    votantes, votoCondutor, votosDaSessao, votosDoAcordao,
} from '../shared/sessoes';
import { auditar } from './config';
import { COL, Contexto, contextoDoSistema, erroUsuario, registrarMovimento } from './context';
import { COL_SESSOES, colegiado, gereSessoes, incluirNaSessao, lerConfig, lerSessao, proximaSessao, veSessoes } from './sessoes';
import { registrarJulgamentoDaSessao } from './processos';
import { avisarPartesDoMovimento } from './portalAvisos';
import { atualizarPainel, montarAta } from './painelAta';
import { fecharReuniao } from './reunioes';

/**
 * Votação na sessão de julgamento (etapa S4), em secSessoes/{sessao}/votacoes/{processo}.
 * A secretaria designa o relator entre quem vota no dia (presidente e
 * titulares). O relator escreve o relatório e o voto, que ficam só com ele até
 * liberar aos pares. Liberado, cada vogal acompanha (com ou sem ressalva),
 * diverge ou se declara impedido ou suspeito, e todos acompanham o placar. O
 * presidente (ou a secretaria, que conduz a sessão no sistema) proclama no dia
 * da sessão ou depois: o servidor apura com a regra do rito e o sistema
 * registra o julgamento na ação do rito, como a equipe faria; a fase segue
 * sozinha quando o rito manda.
 */

type Payload = Record<string, unknown>;
const ACOES_S5 = ['sessaoVista', 'sessaoDevolverVista', 'sessaoAdiar', 'sessaoDiligencia', 'sessaoDestacar'];
export const ACOES_VOTACAO = ['sessaoVotacao', 'sessaoRelator', 'sessaoRelatar', 'sessaoVotar', 'sessaoProclamar', 'sessaoRedator', 'sessaoAcordao', 'sessaoPedidoDecidir', 'sessaoEncerrar', ...ACOES_S5];
const MIN_TEXTO = 10;

const vazia = (pid: string): Votacao => ({
    processo_id: pid, relator_uid: '', relator_nome: '', relatorio: '', resultado: '', fundamentos: '', liberado_em: null, votos: {}, proclamado: null,
});

/** Nome de cada conta na entidade (userOrganizations). */
async function nomes(c: Contexto, uids: string[]): Promise<Map<string, string>> {
    if (!uids.length) return new Map();
    const snaps = await c.db.getAll(...uids.map((u) => c.db.collection('userOrganizations').doc(`${u}_${c.orgId}`)));
    return new Map(snaps.map((s, i) => [uids[i], String(s.data()?.user_name || '')]));
}

/** A ação de julgamento pendente na fase (índice e regra do rito); null quando não há mais. */
export function regraDoJulgamento(proc: admin.firestore.DocumentData): { idx: number; cfg: JulgamentoDaAcao } | null {
    const idx = julgamentoPendente(proc);
    if (idx < 0) return null;
    const fase = ((proc.fases || []) as Array<{ id: string; acoes_regras?: Array<{ julgamento?: JulgamentoDaAcao } | null> }>).find((f) => f.id === proc.fase_atual);
    const cfg = fase?.acoes_regras?.[idx]?.julgamento;
    return cfg ? { idx, cfg } : null;
}

/** Resumo da votação para a linha da pauta. */
export function resumoVotacao(v: Votacao | undefined, uid: string, quemVota: string[], relatorUid: string) {
    const liberado = !!v?.liberado_em;
    const votaram = liberado ? Object.keys(v!.votos || {}).filter((u) => quemVota.includes(u) && u !== v!.relator_uid).length : 0;
    const vogais = quemVota.filter((u) => u !== relatorUid).length;
    return {
        liberado, votaram, vogais, proclamado: v?.proclamado?.resultado || null,
        sou_relator: !!relatorUid && relatorUid === uid,
        aguarda_meu_voto: liberado && !v!.proclamado && quemVota.includes(uid) && uid !== relatorUid && !v!.votos?.[uid],
    };
}

export async function acaoVotacao(c: Contexto, p: Payload): Promise<unknown> {
    const hoje = hojeBrasil();
    const quem = { uid: c.ctx.uid, nome: c.userName };
    const { orgaos, calendario } = await lerConfig(c);
    const { ref: sref, s } = await lerSessao(c, p.id);
    const o = colegiado(orgaos, s.orgao_id);
    const gere = gereSessoes(c, o.id);
    if (!veSessoes(c, o, hoje) || (s.situacao === 'rascunho' && !gere)) throw new HttpsError('not-found', 'Sessão não encontrada');
    if (p.action === 'sessaoEncerrar') {
        const presidente = composicaoEm(o.composicao, s.data).some((m) => m.uid === quem.uid && m.funcao === 'presidente');
        if (!gere && !presidente) throw new HttpsError('permission-denied', 'Encerra a sessão o presidente do colegiado (ou a secretaria)');
        if (s.situacao !== 'publicada' || !s.ativa) throw new HttpsError('failed-precondition', 'Só a sessão publicada se encerra (esta já foi encerrada ou cancelada)');
        const virtual = s.modo === 'assincrona';
        if (virtual && !virtualEncerrou(s, hoje)) throw new HttpsError('failed-precondition', `A votação vai até ${br(String(s.fim))}: o resultado se apura no dia seguinte`);
        if (!virtual && s.data > hoje) throw new HttpsError('failed-precondition', `A sessão se encerra no dia dela (${br(s.data)}) ou depois`);
        // S8: na síncrona, o que não foi julgado segue para a sessão seguinte, por ato de quem encerra.
        const r = await encerrarSessao(c.db, c.orgId, sref.id, virtual ? undefined : c);
        await auditar(c.db, c.orgId, quem.uid, quem.nome, virtual ? 'SECRETARIA_SESSAO_VIRTUAL_ENCERRADA' : 'SECRETARIA_SESSAO_ENCERRADA', { sessao_id: sref.id, ...r });
        return { ok: true, ...r };
    }
    const pid = String(p.processo_id || '');
    const item = (s.pauta || []).find((x) => x.processo_id === pid);
    if (!item) throw new HttpsError('not-found', 'O processo não está nesta pauta');
    const uidsDia = composicaoEm(o.composicao, s.data).filter((m) => m.funcao !== 'suplente').map((m) => m.uid);
    const nm = await nomes(c, uidsDia);
    const membros = votantes(o.composicao, s.data, (u) => nm.get(u) || '');
    const eu = membros.find((m) => m.uid === quem.uid);
    const preside = eu?.funcao === 'presidente';
    const vref = sref.collection('votacoes').doc(pid);
    const pref = c.db.collection(COL.processos).doc(pid);
    const ativa = s.ativa && item.situacao === 'pautado';

    if (p.action === 'sessaoVotacao') {
        const [vs, ps, pds] = await Promise.all([vref.get(), pref.get(), sref.collection('pedidos').where('processo_id', '==', pid).get()]);
        const v = { ...vazia(pid), ...(vs.data() || {}) } as Votacao;
        const proc = ps.data();
        const regra = proc && proc.sessao?.id === sref.id ? regraDoJulgamento(proc) : null;
        const relatorUid = v.liberado_em ? v.relator_uid : item.relator_uid || '';
        const souRelator = !!relatorUid && relatorUid === quem.uid;
        const emJulgamento = ativa && !!v.liberado_em && !v.proclamado && !!regra && s.situacao === 'publicada';
        const aberta = votacaoAberta(s, hoje);
        // S7: o destaque de parte é decidido pelo relator (sem relator, pelo presidente ou pela secretaria).
        const decideDestaque = relatorUid ? souRelator : (preside || gere);
        const pedidos = pds.docs.map((d) => ({ id: d.id, ...(d.data() as PedidoSessao) }))
            .filter((x) => gere || (!!eu && (x.situacao !== 'indeferido' || x.tipo === 'destaque')))
            .sort((a, b) => a.em.localeCompare(b.em))
            .map((x) => ({
                id: x.id, tipo: x.tipo, nome_tipo: NOME_PEDIDO[x.tipo], parte: x.parte, texto: x.texto, link: x.link, em: x.em, situacao: x.situacao,
                motivo: x.motivo || '', decidido_por: x.decidido_por || '',
                pode_decidir: x.situacao === 'pedido' && ativa && !v.proclamado && (x.tipo === 'destaque' ? decideDestaque && s.situacao === 'publicada' : gere),
            }));
        // Com vista nesta sessão: o processo saiu da pauta até a devolução.
        const vista = proc?.vista?.sessao_id === sref.id ? proc.vista as { nomes: string[]; uids: string[]; desde: string; prazo: string } : null;
        const comVista = !!vista && (vista.uids || []).includes(quem.uid);
        const souRedator = !!v.proclamado && v.acordao?.redator_uid === quem.uid;
        // Liberado o voto, os pares e a secretaria acompanham; antes, só o relator vê o que escreve.
        const vePares = !!v.liberado_em && (!!eu || gere);
        const votos = vePares ? votosDaSessao(v, membros) : [];
        let previa: { texto?: string; erro?: string } | null = null;
        if (vePares && regra && !v.proclamado && (preside || gere)) {
            try { previa = { texto: textoDoJulgamento(regra.cfg, dadosDoJulgamento(regra.cfg, { data: hoje, votos }, hoje)) }; } catch (e) { previa = { erro: (e as Error).message }; }
        }
        return {
            hoje, data_sessao: s.data, situacao: s.situacao, gere, preside, sou_relator: souRelator, sou_membro: !!eu,
            modo: s.modo, fim: s.fim || null, votacao_aberta: aberta, virtual_encerrou: virtualEncerrou(s, hoje), pedidos,
            numero: item.numero, assunto: item.assunto,
            membros: membros.map((m) => ({ uid: m.uid, nome: m.nome, funcao: m.funcao })),
            relator: relatorUid ? { uid: relatorUid, nome: v.liberado_em ? v.relator_nome : item.relator_nome || nm.get(relatorUid) || '' } : null,
            resultados: regra?.cfg.resultados || [],
            pendente: !!regra,
            liberado_em: v.liberado_em,
            ...(souRelator || vePares ? { relatorio: v.relatorio, resultado: v.resultado, fundamentos: v.fundamentos } : {}),
            votos: vePares ? membros.filter((m) => m.uid !== v.relator_uid).map((m) => ({ ...(v.votos[m.uid] || {}), uid: m.uid, nome: m.nome, funcao: m.funcao })) : [],
            meu_voto: v.votos[quem.uid] || null,
            placar: vePares && regra ? placarParcial(regra.cfg.resultados, votos) : [],
            previa,
            proclamado: v.proclamado ? { resultado: v.proclamado.resultado, texto: v.proclamado.texto, em: v.proclamado.em, por_nome: v.proclamado.por_nome } : null,
            // Registrado na ação do rito: o processo saiu da pauta com esta sessão como a última.
            registrado: !!v.proclamado && !!proc && proc.ultima_sessao?.id === sref.id && proc.sessao?.id !== sref.id,
            situacao_item: item.situacao, motivo: item.motivo || '',
            vista: vista ? { nomes: vista.nomes || [], desde: vista.desde, prazo: vista.prazo, vencida: vista.prazo < hoje, minha: comVista } : item.vista ? { ...item.vista, encerrada: true } : null,
            vista_dias: o.pauta?.vista_dias || 10,
            // S6: voto condutor, redator e acórdão (para quem acompanha a votação; o texto em redação, só ao redator).
            acordao: v.proclamado && v.acordao && (vePares || souRedator) ? {
                condutor: v.proclamado.condutor || null, redator: { uid: v.acordao.redator_uid, nome: v.acordao.redator_nome }, prazo: v.acordao.prazo,
                enviado_em: v.acordao.enviado_em || null,
                juntado_em: proc?.acordao?.sessao_id === sref.id ? proc.acordao.juntado_em || null : null,
                ordem: proc?.acordao?.sessao_id === sref.id ? proc.acordao.ordem || null : null,
                ...(souRedator ? {
                    ementa: v.acordao.ementa || '', texto: v.acordao.texto || '',
                    modelo: modeloDoAcordao(item.numero, o.nome, s, v.proclamado.texto, v.proclamado.condutor || { nome: v.relator_nome, relator: true }),
                } : {}),
            } : null,
            pode: {
                designar: gere && ativa && !v.liberado_em,
                relatar: souRelator && ativa && !v.liberado_em && !!regra,
                votar: emJulgamento && aberta && !!eu && !souRelator,
                proclamar: emJulgamento && (preside || gere) && (s.modo === 'assincrona' ? virtualEncerrou(s, hoje) : s.data <= hoje),
                vista: emJulgamento && aberta && !!eu && !souRelator,
                // S7: qualquer membro destaca da sessão virtual até o fim da votação.
                destacar: s.modo === 'assincrona' && ativa && !v.proclamado && !!regra && s.situacao === 'publicada' && !!eu && !virtualEncerrou(s, hoje),
                juntar_vista: !!vista && !!eu && !souRelator && !comVista,
                devolver_vista: !!vista && (comVista || ((preside || gere) && vista.prazo < hoje)),
                adiar: (preside || gere) && ativa && !v.proclamado && !!regra && s.situacao === 'publicada',
                redigir: souRedator && !v.acordao?.enviado_em,
                redesignar: !!v.proclamado && !!v.acordao && !v.acordao.enviado_em && (preside || gere),
            },
        };
    }

    if (p.action === 'sessaoRelator') {
        if (!gere) throw new HttpsError('permission-denied', 'Quem designa o relator é a secretaria do colegiado');
        const uid = String(p.uid || '');
        const m = membros.find((x) => x.uid === uid);
        if (uid && !m) throw new HttpsError('invalid-argument', 'O relator precisa estar entre quem vota no dia da sessão (presidente ou titular)');
        await c.db.runTransaction(async (tx) => {
            const [{ ref, s: s2 }, vs] = await Promise.all([lerSessao(c, p.id, tx), tx.get(vref)]);
            if (vs.data()?.liberado_em) throw new HttpsError('failed-precondition', 'O relator já liberou o voto aos pares: a relatoria não muda mais nesta sessão');
            if (!s2.ativa) throw new HttpsError('failed-precondition', 'A sessão foi cancelada');
            const pauta = (s2.pauta || []).map((x) => (x.processo_id === pid && x.situacao === 'pautado' ? { ...x, relator_uid: uid, relator_nome: m?.nome || '' } : x));
            if (!pauta.some((x) => x.processo_id === pid && x.situacao === 'pautado')) throw new HttpsError('failed-precondition', 'O processo não está pautado');
            tx.update(ref, { pauta, version: (s2.version || 0) + 1 });
        });
        await auditar(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_RELATOR', { sessao_id: sref.id, processo_id: pid, numero: item.numero, relator: m?.nome || '' });
        return { ok: true };
    }

    if (p.action === 'sessaoRelatar') {
        if (!item.relator_uid || item.relator_uid !== quem.uid) throw new HttpsError('permission-denied', 'Só o relator designado escreve o relatório e o voto');
        const liberar = p.liberar === true;
        const relatorio = String(p.relatorio ?? '').replace(/\r\n/g, '\n').slice(0, MAX_RELATORIO);
        const fundamentos = String(p.fundamentos ?? '').replace(/\r\n/g, '\n').slice(0, MAX_RELATORIO);
        const resultado = texto(p.resultado, 80);
        await c.db.runTransaction(async (tx) => {
            const [vs, ps] = await Promise.all([tx.get(vref), tx.get(pref)]);
            const v = vs.data() as Votacao | undefined;
            if (v?.liberado_em) throw new HttpsError('failed-precondition', 'O voto já foi liberado aos pares e não muda mais');
            const proc = ps.data();
            const regra = proc && proc.sessao?.id === sref.id ? regraDoJulgamento(proc) : null;
            if (!ativa || !regra) throw new HttpsError('failed-precondition', 'O processo não está mais pautado para julgamento nesta sessão');
            if (resultado && !regra.cfg.resultados.includes(resultado)) throw new HttpsError('invalid-argument', 'Escolha um dos resultados que o rito prevê');
            if (liberar) {
                if (s.situacao !== 'publicada') throw new HttpsError('failed-precondition', 'Libere o voto depois que a pauta for publicada: antes disso os pares não veem a sessão');
                if (!resultado) throw new HttpsError('invalid-argument', 'Escolha o resultado do seu voto antes de liberar');
                if (relatorio.trim().length < MIN_TEXTO || fundamentos.trim().length < MIN_TEXTO) throw new HttpsError('invalid-argument', 'Escreva o relatório e os fundamentos do voto antes de liberar');
            }
            tx.set(vref, {
                ...vazia(pid), ...(v || {}), relator_uid: quem.uid, relator_nome: item.relator_nome || quem.nome, relatorio, resultado, fundamentos,
                atualizado_em: new Date().toISOString(), ...(liberar ? { liberado_em: new Date().toISOString() } : {}),
            });
        });
        if (liberar) await auditar(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_VOTO_LIBERADO', { sessao_id: sref.id, processo_id: pid, numero: item.numero });
        return { ok: true, liberado: liberar };
    }

    if (p.action === 'sessaoVotar') {
        if (!eu) throw new HttpsError('permission-denied', 'Vota quem compõe o colegiado no dia da sessão (presidente e titulares)');
        if (!votacaoAberta(s, hoje)) throw new HttpsError('failed-precondition', `Na sessão virtual, vota-se de ${br(s.data)} a ${br(String(s.fim))}`);
        let voto: ReturnType<typeof sanitizeVoto> | null = null;
        await c.db.runTransaction(async (tx) => {
            const [vs, ps] = await Promise.all([tx.get(vref), tx.get(pref)]);
            const v = vs.data() as Votacao | undefined;
            if (!v?.liberado_em) throw new HttpsError('failed-precondition', 'O relator ainda não liberou o voto');
            if (v.relator_uid === quem.uid) throw new HttpsError('failed-precondition', 'O voto do relator é o que ele liberou');
            if (v.proclamado) throw new HttpsError('failed-precondition', 'O resultado já foi proclamado');
            const proc = ps.data();
            const regra = proc && proc.sessao?.id === sref.id ? regraDoJulgamento(proc) : null;
            if (!ativa || s.situacao !== 'publicada' || !regra) throw new HttpsError('failed-precondition', 'O processo não está mais pautado para julgamento nesta sessão');
            try { voto = sanitizeVoto(p.voto, regra.cfg.resultados, v.resultado); } catch (e) { erroUsuario(e); }
            const agora = new Date().toISOString();
            // Quem diverge primeiro para o resultado que vence conduz o acórdão (S6): mudar o texto não muda a ordem.
            const antes = v.votos?.[quem.uid];
            const divergiu = voto!.modo === 'diverge' ? { divergiu_em: antes?.modo === 'diverge' && antes.resultado === voto!.resultado && antes.divergiu_em ? antes.divergiu_em : agora } : {};
            // O voto inteiro é trocado (sem sobrar fundamento de um voto anterior).
            tx.update(vref, new FieldPath('votos', quem.uid), { ...voto!, ...divergiu, nome: quem.nome, funcao: eu.funcao, em: agora });
        });
        await auditar(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_VOTO', { sessao_id: sref.id, processo_id: pid, numero: item.numero, modo: voto!.modo });
        return { ok: true };
    }

    if (p.action === 'sessaoProclamar') {
        if (!preside && !gere) throw new HttpsError('permission-denied', 'Proclama o resultado o presidente do colegiado (ou a secretaria, que conduz a sessão)');
        if (s.modo === 'assincrona' && !virtualEncerrou(s, hoje)) throw new HttpsError('failed-precondition', `A votação virtual vai até ${br(String(s.fim))}: o resultado se apura depois`);
        if (s.data > hoje) throw new HttpsError('failed-precondition', `O resultado se proclama na sessão, em ${s.data.split('-').reverse().join('/')}`);
        let proclamado: Proclamacao | null = null;
        await c.db.runTransaction(async (tx) => {
            const [vs, ps] = await Promise.all([tx.get(vref), tx.get(pref)]);
            const v = vs.data() as Votacao | undefined;
            if (!v?.liberado_em) throw new HttpsError('failed-precondition', 'O relator ainda não liberou o voto');
            if (v.proclamado) throw new HttpsError('failed-precondition', 'O resultado já foi proclamado');
            const proc = ps.data();
            const regra = proc && proc.sessao?.id === sref.id ? regraDoJulgamento(proc) : null;
            if (!ativa || s.situacao !== 'publicada' || !regra) throw new HttpsError('failed-precondition', 'O processo não está mais pautado para julgamento nesta sessão');
            // Quem não votou fica ausente; quórum, empate e desempate seguem a regra do rito (shared/julgamento).
            let dados: ReturnType<typeof dadosDoJulgamento> | null = null;
            try { dados = dadosDoJulgamento(regra.cfg, { data: hoje, votos: votosDaSessao(v, membros) }, hoje); } catch (e) { erroUsuario(e); }
            const resultado = apurar(regra.cfg, dados!.votos).resultado;
            // S6: o voto que conduz o resultado e, com ele, o redator do acórdão e o prazo.
            const condutor = votoCondutor(v, resultado);
            proclamado = {
                resultado, texto: textoDoJulgamento(regra.cfg, dados!),
                data: hoje, em: new Date().toISOString(), por_nome: quem.nome, votos: dados!.votos, condutor,
            };
            const prazo = prazoDoAcordao(hoje, o.pauta, calendario);
            tx.set(vref, { proclamado, acordao: { redator_uid: condutor.uid, redator_nome: condutor.nome, prazo, ementa: '', texto: '' } }, { merge: true });
            tx.update(pref, {
                'sessao.proclamado': proclamado,
                acordao: { sessao_id: sref.id, sessao: s.titulo, colegiado: o.nome, orgao_id: o.id, resultado, redator_uid: condutor.uid, redator_nome: condutor.nome, prazo, pendente: true },
            });
        });
        const p2 = proclamado as Proclamacao | null;
        await auditar(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_PROCLAMADO', { sessao_id: sref.id, processo_id: pid, numero: item.numero, resultado: p2!.resultado });
        // O registro na ação do rito: se não couber agora (o rito mudou, ação reservada), a equipe registra com os votos da sessão.
        const aviso = await registrarJulgamentoDaSessao(c.db, c.orgId, pid, quem.nome);
        return { ok: true, resultado: p2!.resultado, texto: p2!.texto, registrado: !aviso, aviso, redator: p2!.condutor?.nome || '' };
    }

    // ---- S6: redator e acórdão ----
    if (p.action === 'sessaoRedator') {
        if (!preside && !gere) throw new HttpsError('permission-denied', 'Quem designa outro redator é o presidente do colegiado (ou a secretaria)');
        const uid = String(p.uid || '');
        const m = membros.find((x) => x.uid === uid);
        if (!m) throw new HttpsError('invalid-argument', 'O redator precisa ter votado na sessão (presidente ou titular)');
        await c.db.runTransaction(async (tx) => {
            const [vs, ps] = await Promise.all([tx.get(vref), tx.get(pref)]);
            const v = vs.data() as Votacao | undefined;
            if (!v?.proclamado || !v.acordao) throw new HttpsError('failed-precondition', 'O redator se designa depois da proclamação');
            if (v.acordao.enviado_em) throw new HttpsError('failed-precondition', 'O acórdão já foi enviado à unidade');
            tx.update(vref, { 'acordao.redator_uid': uid, 'acordao.redator_nome': m.nome });
            if (ps.data()?.acordao?.sessao_id === sref.id) tx.update(pref, { 'acordao.redator_uid': uid, 'acordao.redator_nome': m.nome });
        });
        await auditar(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_REDATOR', { sessao_id: sref.id, processo_id: pid, numero: item.numero, redator: m.nome });
        return { ok: true };
    }

    if (p.action === 'sessaoAcordao') {
        const enviar = p.enviar === true;
        const ementa = String(p.ementa ?? '').replace(/\r\n/g, '\n').slice(0, MAX_EMENTA);
        const textoA = String(p.texto ?? '').replace(/\r\n/g, '\n').slice(0, MAX_RELATORIO);
        const r = await c.db.runTransaction(async (tx) => {
            const [vs, ps] = await Promise.all([tx.get(vref), tx.get(pref)]);
            const v = vs.data() as Votacao | undefined;
            const proc = ps.data();
            if (!v?.proclamado || !v.acordao) throw new HttpsError('failed-precondition', 'O acórdão se redige depois da proclamação');
            if (v.acordao.redator_uid !== quem.uid) throw new HttpsError('permission-denied', 'Só o redator designado escreve o acórdão');
            if (v.acordao.enviado_em) throw new HttpsError('failed-precondition', 'O acórdão já foi enviado à unidade e não muda mais aqui');
            if (!enviar) {
                tx.update(vref, { 'acordao.ementa': ementa, 'acordao.texto': textoA });
                return { enviado: false, documento_id: '' };
            }
            if (ementa.trim().length < MIN_TEXTO || textoA.trim().length < MIN_TEXTO) throw new HttpsError('invalid-argument', 'Escreva a ementa e o acórdão antes de enviar');
            if (!proc || proc.status === 'arquivado' || proc.status === 'excluido') throw new HttpsError('failed-precondition', 'O processo não está mais em tramitação');
            const cond = v.proclamado.condutor || votoCondutor(v, v.proclamado.resultado);
            const { vencidos, declaracoes } = votosDoAcordao(v, v.proclamado.resultado, cond.uid);
            const votoCond = cond.relator ? v.fundamentos : (v.votos[cond.uid]?.fundamentos || v.votos[cond.uid]?.nota || '');
            let conteudo: ReturnType<typeof sanitizeDoc> | null = null;
            try {
                conteudo = sanitizeDoc(documentoDoAcordao({
                    numero: String(proc.numero || ''), colegiado: o.nome, sessao: `${s.titulo}, de ${br(s.data)}`, ementa, texto: textoA,
                    relatorio: v.relatorio, relator: v.relator_nome, condutor: cond, fundamentosCondutor: votoCond, vencidos, declaracoes,
                }));
            } catch (e) { erroUsuario(e); }
            const hash = sha256(jsonCanonico(conteudo));
            const agora = new Date().toISOString();
            // Vai à unidade do processo como minuta assinada pelo redator; a unidade junta aos autos (e o rito confere).
            const dref = pref.collection('documentos').doc();
            tx.set(dref, {
                titulo: `Acórdão: ${s.titulo}`, tipo: 'Acórdão', status: 'minuta', unidade_origem: proc.unidade_atual, autor_uid: quem.uid, autor_nome: quem.nome,
                criado_em: agora, origem: 'editor', conteudo, sha256: hash, acordao_sessao_id: sref.id,
                assinaturas: [{ uid: quem.uid, nome: quem.nome, em: agora, sha256: hash, nivel: 'simples' }],
            });
            tx.update(vref, { 'acordao.ementa': ementa, 'acordao.texto': textoA, 'acordao.enviado_em': agora, 'acordao.documento_id': dref.id });
            if (proc.acordao?.sessao_id === sref.id) tx.update(pref, { 'acordao.enviado_em': agora, 'acordao.documento_id': dref.id });
            return { enviado: true, documento_id: dref.id };
        });
        if (r.enviado) await auditar(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_ACORDAO_ENVIADO', { sessao_id: sref.id, processo_id: pid, numero: item.numero, documento_id: r.documento_id });
        return { ok: true, ...r };
    }

    // ---- S7: pedidos das partes (sustentação, preferência, destaque, esclarecimento) ----
    if (p.action === 'sessaoPedidoDecidir') {
        const dref = sref.collection('pedidos').doc(String(p.pedido_id || '_'));
        const ped = (await dref.get()).data() as PedidoSessao | undefined;
        if (!ped || ped.processo_id !== pid) throw new HttpsError('not-found', 'Pedido não encontrado');
        if (ped.tipo === 'destaque' && p.deferir === true) return acaoVotacao(c, { ...p, action: 'sessaoDestacar' });
        const decide = ped.tipo === 'destaque' ? (item.relator_uid ? item.relator_uid === quem.uid : preside || gere) : gere;
        if (!decide) throw new HttpsError('permission-denied', ped.tipo === 'destaque' ? 'Decide o destaque o relator' : 'Quem confere os pedidos é a secretaria do colegiado');
        const motivo = texto(p.motivo, 1000);
        if (p.deferir !== true && motivo.length < 5) throw new HttpsError('invalid-argument', 'Diga o motivo do indeferimento (ao menos 5 letras)');
        await c.db.runTransaction(async (tx) => {
            const atual = (await tx.get(dref)).data() as PedidoSessao | undefined;
            if (atual?.situacao !== 'pedido') throw new HttpsError('failed-precondition', 'O pedido já foi decidido');
            tx.update(dref, { situacao: p.deferir === true ? 'deferido' : 'indeferido', motivo, decidido_por: quem.nome, decidido_em: new Date().toISOString() });
        });
        await auditar(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_PEDIDO_DECIDIDO', { sessao_id: sref.id, processo_id: pid, tipo: ped.tipo, deferido: p.deferir === true });
        return { ok: true };
    }

    // ---- S5: vista, adiamento e conversão em diligência (e o destaque da S7) ----
    if (!ACOES_S5.includes(String(p.action))) throw new HttpsError('invalid-argument', 'Ação desconhecida');
    const motivo = texto(p.motivo, 2000);
    const avisar: string[] = [];
    let auditoria = null as [string, Record<string, unknown>] | null;
    const resultado = await c.db.runTransaction(async (tx) => {
        avisar.length = 0;
        const [{ ref, s: s2 }, vs, ps] = await Promise.all([lerSessao(c, p.id, tx), tx.get(vref), tx.get(pref)]);
        const v = vs.data() as Votacao | undefined;
        const proc = ps.data();
        const it = (s2.pauta || []).find((x) => x.processo_id === pid);
        if (!proc || !it) throw new HttpsError('not-found', 'O processo não está nesta pauta');
        const regra = proc.sessao?.id === ref.id && it.situacao === 'pautado' && s2.ativa && s2.situacao === 'publicada' ? regraDoJulgamento(proc) : null;
        const marcarItem = (patch: Partial<ItemPauta>) => tx.update(ref, {
            pauta: (s2.pauta || []).map((x) => (x.processo_id === pid ? { ...x, ...patch } : x)), version: (s2.version || 0) + 1, updated_at: FieldValue.serverTimestamp(),
        });
        const relator = { relator_uid: it.relator_uid || '', relator_nome: it.relator_nome || '' };
        const emCurso = (manter: boolean) => ({ sessao_id: ref.id, manter_votos: manter, ...relator });
        /** Continua na próxima sessão do colegiado, se já houver uma marcada. */
        const continuar = async (proc2: admin.firestore.DocumentData, porque: string, destaque = false) => {
            // Destacado (S7), vai a uma sessão síncrona e recomeça: segue só o relator, com o voto em rascunho.
            const prox = await proximaSessao(tx, c, o.id, ref.id, s2.data, destaque);
            if (!prox) return { prox: null, inc: {} };
            const publicada = prox.s.situacao === 'publicada';
            const vv = destaque && v ? { ...v, votos: {}, liberado_em: null } : v;
            return { prox, inc: { publicada, fazer: (base: admin.firestore.DocumentData) => incluirNaSessao(tx, c, prox, o, pref, base, publicada ? 'extrapauta' : 'pauta', publicada ? porque : '', { de: ref.id, v: vv, ...relator }) } };
        };

        if (p.action === 'sessaoDestacar') {
            const pedidoId = typeof p.pedido_id === 'string' ? p.pedido_id : '';
            const dref = pedidoId ? ref.collection('pedidos').doc(pedidoId) : null;
            const ped = dref ? (await tx.get(dref)).data() as PedidoSessao | undefined : undefined;
            if (dref) {
                if (!ped || ped.processo_id !== pid || ped.tipo !== 'destaque') throw new HttpsError('not-found', 'Pedido não encontrado');
                if (ped.situacao !== 'pedido') throw new HttpsError('failed-precondition', 'O pedido já foi decidido');
                if (!(it.relator_uid ? it.relator_uid === quem.uid : preside || gere)) throw new HttpsError('permission-denied', 'Decide o destaque o relator');
            } else if (!eu) throw new HttpsError('permission-denied', 'Destaca quem vota no dia da sessão (presidente e titulares)');
            if (s2.modo !== 'assincrona') throw new HttpsError('failed-precondition', 'Só se destaca processo da sessão virtual');
            if (!regra) throw new HttpsError('failed-precondition', 'O processo não está mais pautado para julgamento nesta sessão');
            if (v?.proclamado) throw new HttpsError('failed-precondition', 'O resultado já foi proclamado');
            if (virtualEncerrou(s2, hoje)) throw new HttpsError('failed-precondition', 'A votação virtual já terminou');
            const { prox, inc } = await continuar(proc, `destaque da ${s2.titulo}`, true);
            const quemPediu = ped ? `pedido de ${ped.parte}, deferido por ${quem.nome}` : quem.nome;
            const mov = registrarMovimento(tx, c, pref, proc, 'destaque', textoDoDestaque(s2, quemPediu, prox?.s), { sessao_id: ref.id });
            const mais = 'fazer' in inc && inc.fazer ? inc.fazer({ ...proc, ...mov }) : {};
            tx.update(pref, { ...mov, sessao: FieldValue.delete(), julgamento_em_curso: { ...emCurso(true), so_relator: true }, ...mais });
            marcarItem({ situacao: 'destacado', motivo: ped ? `a pedido de ${ped.parte}: ${ped.texto}`.slice(0, 500) : `destacado por ${quem.nome}` });
            if (dref) tx.update(dref, { situacao: 'deferido', motivo: '', decidido_por: quem.nome, decidido_em: new Date().toISOString() });
            avisar.push(pid);
            auditoria = ['SECRETARIA_SESSAO_DESTAQUE', { sessao_id: ref.id, processo_id: pid, numero: it.numero, a_pedido: ped?.parte || null, continua_em: prox?.ref.id || null }];
            return { ok: true, continua_em: prox ? { id: prox.ref.id, titulo: prox.s.titulo, data: prox.s.data } : null };
        }

        if (p.action === 'sessaoVista') {
            if (!eu) throw new HttpsError('permission-denied', 'Pede vista quem vota no dia da sessão (presidente e titulares)');
            if (v?.relator_uid === quem.uid) throw new HttpsError('failed-precondition', 'O relator não pede vista do próprio voto');
            // Vista coletiva: outro membro se junta ao pedido, no mesmo prazo.
            if (it.situacao === 'vista' && proc.vista?.sessao_id === ref.id) {
                if ((proc.vista.uids || []).includes(quem.uid)) throw new HttpsError('already-exists', 'Você já pediu vista deste processo');
                const nomes = [...(proc.vista.nomes || []), quem.nome];
                tx.update(pref, { 'vista.uids': [...(proc.vista.uids || []), quem.uid], 'vista.nomes': nomes });
                marcarItem({ vista: { ...it.vista!, nomes } });
                auditoria = ['SECRETARIA_SESSAO_VISTA', { sessao_id: ref.id, processo_id: pid, numero: it.numero, coletiva: true }];
                return { ok: true, prazo: proc.vista.prazo };
            }
            if (!regra) throw new HttpsError('failed-precondition', 'O processo não está mais pautado para julgamento nesta sessão');
            if (!v?.liberado_em) throw new HttpsError('failed-precondition', 'Peça vista depois que o relator liberar o voto');
            if (!votacaoAberta(s2, hoje)) throw new HttpsError('failed-precondition', `Na sessão virtual, a vista se pede durante a votação, de ${br(s2.data)} a ${br(String(s2.fim))}`);
            if (v.proclamado) throw new HttpsError('failed-precondition', 'O resultado já foi proclamado');
            const prazo = prazoDaVista(hoje, o.pauta, calendario);
            const mov = registrarMovimento(tx, c, pref, proc, 'vista', textoDaVista(s2, [quem.nome], prazo), { sessao_id: ref.id });
            tx.update(pref, {
                ...mov, sessao: FieldValue.delete(), julgamento_em_curso: emCurso(true),
                vista: { sessao_id: ref.id, sessao: s2.titulo, orgao_id: o.id, colegiado: o.nome, uids: [quem.uid], nomes: [quem.nome], desde: hoje, prazo },
            });
            marcarItem({ situacao: 'vista', vista: { nomes: [quem.nome], prazo } });
            avisar.push(pid);
            auditoria = ['SECRETARIA_SESSAO_VISTA', { sessao_id: ref.id, processo_id: pid, numero: it.numero, prazo }];
            return { ok: true, prazo };
        }

        if (p.action === 'sessaoDevolverVista') {
            const vi = proc.vista as { sessao_id: string; uids: string[]; nomes: string[]; prazo: string } | undefined;
            if (!vi || vi.sessao_id !== ref.id) throw new HttpsError('failed-precondition', 'O processo não está com vista nesta sessão');
            const pediu = (vi.uids || []).includes(quem.uid);
            if (!pediu && !gere && !preside) throw new HttpsError('permission-denied', 'Devolve a vista quem a pediu');
            if (!pediu && vi.prazo >= hoje) throw new HttpsError('failed-precondition', `Antes do fim do prazo (${vi.prazo.split('-').reverse().join('/')}), só quem pediu vista devolve`);
            const { prox, inc } = await continuar(proc, 'retorno de vista');
            const mov = registrarMovimento(tx, c, pref, proc, 'vista_devolvida', textoDaDevolucao(vi.nomes || [], prox?.s), { sessao_id: ref.id });
            const mais = 'fazer' in inc && inc.fazer ? inc.fazer({ ...proc, ...mov }) : {};
            tx.update(pref, { ...mov, vista: FieldValue.delete(), ...mais });
            marcarItem({ vista: { ...(it.vista || { nomes: vi.nomes, prazo: vi.prazo }), devolvida: true } });
            avisar.push(pid);
            auditoria = ['SECRETARIA_SESSAO_VISTA_DEVOLVIDA', { sessao_id: ref.id, processo_id: pid, numero: it.numero, continua_em: prox?.ref.id || null }];
            return { ok: true, continua_em: prox ? { id: prox.ref.id, titulo: prox.s.titulo, data: prox.s.data } : null };
        }

        if (p.action === 'sessaoAdiar' || p.action === 'sessaoDiligencia') {
            if (!gere && !preside) throw new HttpsError('permission-denied', 'Adia ou converte em diligência o presidente do colegiado (ou a secretaria)');
            if (!regra) throw new HttpsError('failed-precondition', 'O processo não está mais pautado para julgamento nesta sessão');
            if (v?.proclamado) throw new HttpsError('failed-precondition', 'O resultado já foi proclamado');
            const adiar = p.action === 'sessaoAdiar';
            if (motivo.length < (adiar ? 5 : 10)) {
                throw new HttpsError('invalid-argument', adiar ? 'Diga o motivo do adiamento (ao menos 5 letras)' : 'Diga o que a diligência deve fazer (ao menos 10 letras)');
            }
            // Adiado, segue para a próxima sessão com os votos já dados; em diligência, volta à unidade e, depois, a uma nova pauta com o mesmo relator.
            const { prox, inc } = adiar ? await continuar(proc, `adiado da ${s2.titulo}`) : { prox: null, inc: {} };
            const mov = registrarMovimento(tx, c, pref, proc, adiar ? 'adiamento' : 'diligencia', adiar ? textoDoAdiamento(s2, motivo) : textoDaDiligencia(s2, motivo), { sessao_id: ref.id });
            const mais = 'fazer' in inc && inc.fazer ? inc.fazer({ ...proc, ...mov }) : {};
            tx.update(pref, {
                ...mov, sessao: FieldValue.delete(), julgamento_em_curso: emCurso(adiar),
                ...(adiar ? {} : { orientacao: { texto: `Diligência determinada pelo ${o.nome}: ${motivo}`, por: quem.nome, em: new Date().toISOString(), de: o.nome } }),
                ...mais,
            });
            marcarItem({ situacao: adiar ? 'adiado' : 'diligencia', motivo });
            avisar.push(pid);
            auditoria = [adiar ? 'SECRETARIA_SESSAO_ADIADO' : 'SECRETARIA_SESSAO_DILIGENCIA', { sessao_id: ref.id, processo_id: pid, numero: it.numero, motivo, continua_em: prox?.ref.id || null }];
            return { ok: true, continua_em: prox ? { id: prox.ref.id, titulo: prox.s.titulo, data: prox.s.data } : null };
        }

        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    });
    if (auditoria) await auditar(c.db, c.orgId, quem.uid, quem.nome, auditoria[0], auditoria[1]);
    // E-mail às partes depois da transação: falha de envio não desfaz o ato.
    await Promise.all(avisar.map((id) => avisarPartesDoMovimento(c.db, id, quem.uid).catch(() => undefined)));
    return resultado;
}

/**
 * Encerra a sessão publicada. Virtual (S7, sem `quem`): o sistema apura cada
 * processo como o presidente faria e, sem resultado (o relator não liberou o
 * voto, faltou quórum), adia com os votos já dados (Res. CNJ 591/2024, art. 5º,
 * §§ 7º e 8º). Síncrona (S8, com
 * `quem`, o presidente ou a secretaria): o que não foi julgado segue para a
 * sessão seguinte, com os votos já dados. Depois, a ata é lavrada e o painel,
 * atualizado.
 */
export async function encerrarSessao(db: admin.firestore.Firestore, orgId: string, sessaoId: string, quem?: Contexto): Promise<{ proclamados: number; adiados: number }> {
    const sis = quem ? null : await contextoDoSistema(db, orgId);
    if (!quem && !sis) return { proclamados: 0, adiados: 0 };
    const c: Contexto = quem || { ...sis!, userName: 'Sistema (fim da sessão virtual)' };
    const { ref, s } = await lerSessao(c, sessaoId);
    const virtual = s.modo === 'assincrona';
    if (s.situacao !== 'publicada' || !s.ativa || (virtual ? !virtualEncerrou(s, hojeBrasil()) : !quem)) return { proclamados: 0, adiados: 0 };
    let proclamados = 0;
    let adiados = 0;
    for (const it of (s.pauta || []).filter((x) => x.situacao === 'pautado')) {
        if ((await ref.collection('votacoes').doc(it.processo_id).get()).data()?.proclamado) continue;
        const base = { id: sessaoId, processo_id: it.processo_id };
        let porque = 'não foi julgado na sessão';
        if (virtual) {
            try {
                await acaoVotacao(c, { ...base, action: 'sessaoProclamar' });
                proclamados++;
                continue;
            } catch (e) { porque = `a votação virtual terminou sem resultado (${String((e as Error).message || '').replace(/[.\s]+$/, '')})`; }
        }
        // Se nem adiar cabe (o processo saiu do julgamento por outro caminho), fica como está.
        await acaoVotacao(c, { ...base, action: 'sessaoAdiar', motivo: porque }).then(() => { adiados++; }, () => undefined);
    }
    // Reunião (S9): apura a votação virtual ou adia o que não foi deliberado.
    if (s.tipo === 'reuniao') await fecharReuniao(db, ref, colegiado((await lerConfig(c)).orgaos, s.orgao_id));
    await ref.update({
        situacao: 'encerrada', encerrada_em: new Date().toISOString(), encerrada_por_nome: c.userName, encerra_em: FieldValue.delete(), em_julgamento: FieldValue.delete(),
        version: FieldValue.increment(1), updated_at: FieldValue.serverTimestamp(),
    });
    // A ata sai pronta para conferir e assinar (a secretaria ajusta antes da primeira assinatura).
    await montarAta(db, orgId, sessaoId).then((ata) => ref.update({ ata }), (e) => console.error('ata não lavrada', sessaoId, e));
    await atualizarPainel(db, orgId, sessaoId);
    return { proclamados, adiados };
}

/** Rotina diária: encerra as sessões virtuais cuja votação terminou ontem (ou antes). */
export async function encerrarSessoesVirtuais(db: admin.firestore.Firestore, hoje = hojeBrasil()): Promise<number> {
    const q = await db.collection(COL_SESSOES).where('encerra_em', '<', hoje).limit(200).get();
    let n = 0;
    for (const d of q.docs) {
        const s = d.data();
        if (s.situacao !== 'publicada' || !s.ativa) { await d.ref.update({ encerra_em: FieldValue.delete() }); continue; }
        await encerrarSessao(db, String(s.organization_id), d.id).then(() => { n++; }, (e) => console.error('encerrarSessao', d.id, e));
    }
    return n;
}
