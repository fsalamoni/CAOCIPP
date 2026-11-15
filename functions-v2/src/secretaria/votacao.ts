import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { hojeBrasil, texto } from '../shared/secretaria';
import { composicaoEm } from '../shared/orgaos';
import { JulgamentoDaAcao, apurar, dadosDoJulgamento, textoDoJulgamento } from '../shared/julgamento';
import { MAX_RELATORIO, Proclamacao, Votacao, julgamentoPendente, placarParcial, sanitizeVoto, votantes, votosDaSessao } from '../shared/sessoes';
import { auditar } from './config';
import { COL, Contexto, erroUsuario } from './context';
import { colegiado, gereSessoes, lerConfig, lerSessao, veSessoes } from './sessoes';
import { registrarJulgamentoDaSessao } from './processos';

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
export const ACOES_VOTACAO = ['sessaoVotacao', 'sessaoRelator', 'sessaoRelatar', 'sessaoVotar', 'sessaoProclamar'];
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
    const { orgaos } = await lerConfig(c);
    const { ref: sref, s } = await lerSessao(c, p.id);
    const o = colegiado(orgaos, s.orgao_id);
    const gere = gereSessoes(c, o.id);
    if (!veSessoes(c, o, hoje) || (s.situacao === 'rascunho' && !gere)) throw new HttpsError('not-found', 'Sessão não encontrada');
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
        const [vs, ps] = await Promise.all([vref.get(), pref.get()]);
        const v = { ...vazia(pid), ...(vs.data() || {}) } as Votacao;
        const proc = ps.data();
        const regra = proc && proc.sessao?.id === sref.id ? regraDoJulgamento(proc) : null;
        const relatorUid = v.liberado_em ? v.relator_uid : item.relator_uid || '';
        const souRelator = !!relatorUid && relatorUid === quem.uid;
        // Liberado o voto, os pares e a secretaria acompanham; antes, só o relator vê o que escreve.
        const vePares = !!v.liberado_em && (!!eu || gere);
        const votos = vePares ? votosDaSessao(v, membros) : [];
        let previa: { texto?: string; erro?: string } | null = null;
        if (vePares && regra && !v.proclamado && (preside || gere)) {
            try { previa = { texto: textoDoJulgamento(regra.cfg, dadosDoJulgamento(regra.cfg, { data: hoje, votos }, hoje)) }; } catch (e) { previa = { erro: (e as Error).message }; }
        }
        return {
            hoje, data_sessao: s.data, situacao: s.situacao, gere, preside, sou_relator: souRelator, sou_membro: !!eu,
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
            pode: {
                designar: gere && ativa && !v.liberado_em,
                relatar: souRelator && ativa && !v.liberado_em && !!regra,
                votar: !!eu && !souRelator && ativa && !!v.liberado_em && !v.proclamado && !!regra && s.situacao === 'publicada',
                proclamar: (preside || gere) && ativa && !!v.liberado_em && !v.proclamado && !!regra && s.situacao === 'publicada' && s.data <= hoje,
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
            tx.set(vref, { votos: { [quem.uid]: { ...voto!, nome: quem.nome, funcao: eu.funcao, em: new Date().toISOString() } } }, { merge: true });
        });
        await auditar(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_VOTO', { sessao_id: sref.id, processo_id: pid, numero: item.numero, modo: voto!.modo });
        return { ok: true };
    }

    if (p.action === 'sessaoProclamar') {
        if (!preside && !gere) throw new HttpsError('permission-denied', 'Proclama o resultado o presidente do colegiado (ou a secretaria, que conduz a sessão)');
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
            proclamado = {
                resultado: apurar(regra.cfg, dados!.votos).resultado, texto: textoDoJulgamento(regra.cfg, dados!),
                data: hoje, em: new Date().toISOString(), por_nome: quem.nome, votos: dados!.votos,
            };
            tx.set(vref, { proclamado }, { merge: true });
            tx.update(pref, { 'sessao.proclamado': proclamado });
        });
        const p2 = proclamado as Proclamacao | null;
        await auditar(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_PROCLAMADO', { sessao_id: sref.id, processo_id: pid, numero: item.numero, resultado: p2!.resultado });
        // O registro na ação do rito: se não couber agora (o rito mudou, ação reservada), a equipe registra com os votos da sessão.
        const aviso = await registrarJulgamentoDaSessao(c.db, c.orgId, pid, quem.nome);
        return { ok: true, resultado: p2!.resultado, texto: p2!.texto, registrado: !aviso, aviso };
    }

    throw new HttpsError('invalid-argument', 'Ação desconhecida');
}
