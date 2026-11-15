import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { hojeBrasil, texto } from '../shared/secretaria';
import { Orgao, composicaoEm } from '../shared/orgaos';
import { votacaoAberta } from '../shared/sessoes';
import {
    AssuntoReuniao, MAX_ASSUNTOS, MAX_ENCAMINHAMENTO, Placar, ResultadoAssunto, VOTOS, VotoReuniao,
    apurar, desempatar, placarDe, quorumMinimo, regrasReuniao, reordenarAssuntos, sanitizeAssunto, votavel,
} from '../shared/reunioes';
import { auditar } from './config';
import { Contexto, erroUsuario } from './context';
import { COL_SESSOES, Sessao, colegiado, gereSessoes, lerConfig, lerSessao, veSessoes } from './sessoes';

/**
 * Etapa S9: reunião deliberativa (secSessoes com `tipo: 'reuniao'`). A pauta
 * são `assuntos`; os votos ficam em secSessoes/{s}/deliberacoes/{assunto}:
 * nominal guarda o voto de cada um; secreta guarda só quem votou e a soma
 * (o vínculo entre a pessoa e o voto não é gravado); simbólica guarda o placar
 * que o presidente anuncia. Palavra, impedimento, quórum e desempate ficam no
 * assunto, dentro da sessão.
 */

export const ACOES_S9 = [
    'reuniaoAssunto', 'reuniaoTirar', 'reuniaoOrdenar', 'reuniaoPalavra', 'reuniaoImpedimento',
    'reuniaoAbrir', 'reuniaoVotar', 'reuniaoSimbolica', 'reuniaoApurar', 'reuniaoDesempate', 'reuniaoEncaminhar',
];
type Payload = Record<string, unknown>;
export interface Deliberacao extends Placar {
    aberta_em?: string;
    votos?: Record<string, { voto: VotoReuniao; nome: string; em: string; por?: string }>;
    votaram?: string[];
}

const MOTIVO_MIN = 5;
const vivo = (a: AssuntoReuniao) => a.situacao === 'pauta' || a.situacao === 'em_votacao' || a.situacao === 'empate';
/** Quem vota no dia (presidente e titulares), menos os impedidos no assunto. */
export const aptos = (o: Orgao, dia: string, a: Pick<AssuntoReuniao, 'impedidos'>) => composicaoEm(o.composicao, dia)
    .filter((m) => m.funcao !== 'suplente' && !(a.impedidos || []).some((i) => i.uid === m.uid)).map((m) => m.uid);

/** Placar do assunto: nominal pelos votos de quem ainda pode votar; secreta e simbólica pela soma. */
export function placarDoAssunto(a: AssuntoReuniao, d: Deliberacao | undefined, podem: string[]): Placar {
    if (a.votacao === 'nominal') return placarDe(Object.fromEntries(Object.entries(d?.votos || {}).filter(([u]) => podem.includes(u))));
    return { sim: d?.sim || 0, nao: d?.nao || 0, abstencao: d?.abstencao || 0 };
}

/** Grava o resultado no assunto: sem quórum, adia; empate, espera o presidente; senão, deliberado. */
export function comResultado(a: AssuntoReuniao, r: ResultadoAssunto, d?: Deliberacao): AssuntoReuniao {
    const nominais = a.votacao === 'nominal' ? Object.entries(d?.votos || {}).filter(([u]) => !(a.impedidos || []).some((i) => i.uid === u)).map(([, v]) => ({ nome: v.nome, voto: v.voto })) : undefined;
    const base = { ...a, resultado: r, com_a_palavra: null, falaram: falaramCom(a), ...(nominais ? { nominais } : {}) };
    if (r.sem_quorum) return { ...base, situacao: 'adiado', motivo: 'sem quórum para deliberar' };
    if (r.aprovado === null) return { ...base, situacao: 'empate' };
    return { ...base, situacao: 'deliberado' };
}

/** Quem falou, com quem está com a palavra ao fechar. */
const falaramCom = (a: AssuntoReuniao) => [...new Set([...(a.falaram || []), ...(a.com_a_palavra ? [a.com_a_palavra.nome] : [])])];

export async function acaoReuniao(c: Contexto, p: Payload): Promise<unknown> {
    const hoje = hojeBrasil();
    const quem = { uid: c.ctx.uid, nome: c.userName };
    let auditoria = null as [string, Record<string, unknown>] | null;
    const r = await c.db.runTransaction(async (tx) => {
        auditoria = null;
        const { orgaos } = await lerConfig(c, tx);
        const { ref, s } = await lerSessao(c, p.id, tx);
        if (s.tipo !== 'reuniao') throw new HttpsError('failed-precondition', 'Esta ação é das reuniões deliberativas');
        const o = colegiado(orgaos, s.orgao_id);
        const gere = gereSessoes(c, o.id);
        if (!veSessoes(c, o, hoje) || (s.situacao === 'rascunho' && !gere)) throw new HttpsError('not-found', 'Reunião não encontrada');
        const comp = composicaoEm(o.composicao, s.data);
        const preside = comp.some((m) => m.uid === quem.uid && m.funcao === 'presidente');
        const conduz = gere || preside;
        const sincrona = s.modo !== 'assincrona';
        const ativa = s.ativa && (s.situacao === 'rascunho' || s.situacao === 'publicada');
        const noDia = s.situacao === 'publicada' && s.ativa && sincrona && s.data <= hoje;
        const regras = regrasReuniao(o.pauta);
        const marcas = (s.presencas || {}) as Record<string, boolean>;
        const registrada = Object.keys(marcas).length > 0;
        const assuntos = [...((s.assuntos || []) as AssuntoReuniao[])].sort((a, b) => a.ordem - b.ordem);
        const k = assuntos.findIndex((a) => a.id === p.assunto_id);
        const a = k >= 0 ? assuntos[k] : undefined;
        const dref = a ? ref.collection('deliberacoes').doc(a.id) : null;
        // Todas as leituras antes das escritas.
        const d = dref && ['reuniaoImpedimento', 'reuniaoVotar', 'reuniaoApurar', 'reuniaoSimbolica'].includes(String(p.action)) ? (await tx.get(dref)).data() as Deliberacao | undefined : undefined;
        const de = p.action === 'reuniaoAssunto' && p.de && typeof p.de === 'object' ? p.de as { sessao_id?: unknown; assunto_id?: unknown } : null;
        const origem = de ? await lerSessao(c, de.sessao_id, tx) : null;
        const versao = { version: (s.version || 0) + 1, updated_at: FieldValue.serverTimestamp() };
        const gravar = (lista: AssuntoReuniao[]) => tx.update(ref, { assuntos: lista, ...versao });
        const exigirGere = () => { if (!gere) throw new HttpsError('permission-denied', 'Só a secretaria do colegiado cuida da pauta da reunião'); };
        const exigirAssunto = () => { if (!a) throw new HttpsError('not-found', 'Assunto não encontrado nesta reunião'); return a; };
        const motivo = texto(p.motivo, 500);

        if (p.action === 'reuniaoAssunto') {
            exigirGere();
            if (!ativa) throw new HttpsError('failed-precondition', 'A reunião já foi encerrada ou cancelada');
            const publicada = s.situacao === 'publicada';
            if (publicada && (sincrona ? s.data < hoje : votacaoAberta(s, hoje) || s.data <= hoje)) {
                throw new HttpsError('failed-precondition', sincrona ? 'A reunião já passou' : 'A votação virtual já abriu: a pauta não muda mais');
            }
            if (a) {
                // Edição: só antes da votação do assunto.
                if (a.situacao !== 'pauta') throw new HttpsError('failed-precondition', 'O assunto já foi votado ou saiu da pauta: não muda mais');
                let campos;
                try { campos = sanitizeAssunto(p.assunto, s.modo); } catch (e) { erroUsuario(e); }
                assuntos[k] = { ...a, ...campos! };
                gravar(assuntos);
                return { ok: true, assunto_id: a.id };
            }
            if (assuntos.filter(vivo).length >= MAX_ASSUNTOS) throw new HttpsError('failed-precondition', `A pauta comporta até ${MAX_ASSUNTOS} assuntos`);
            if (publicada && motivo.length < MOTIVO_MIN) throw new HttpsError('invalid-argument', `Diga o motivo da inclusão depois da convocação (ao menos ${MOTIVO_MIN} letras)`);
            let campos: ReturnType<typeof sanitizeAssunto>;
            let vem: AssuntoReuniao['vem_de'] = null;
            if (origem) {
                // Assunto adiado de outra reunião do mesmo colegiado: vem com o que já tinha.
                const ant = ((origem.s.assuntos || []) as AssuntoReuniao[]).find((x) => x.id === de!.assunto_id);
                if (origem.s.orgao_id !== o.id || origem.ref.id === ref.id || !ant || ant.situacao !== 'adiado' || ant.levado_para) throw new HttpsError('failed-precondition', 'Esse assunto não está pendente em outra reunião do colegiado');
                try { campos = sanitizeAssunto({ ...ant, ...(p.assunto as object || {}) }, s.modo); } catch (e) { erroUsuario(e); }
                vem = { sessao_id: origem.ref.id, titulo: origem.s.titulo };
                tx.update(origem.ref, { assuntos: (origem.s.assuntos as AssuntoReuniao[]).map((x) => (x.id === ant.id ? { ...x, levado_para: ref.id } : x)), version: (origem.s.version || 0) + 1 });
            } else {
                try { campos = sanitizeAssunto(p.assunto, s.modo); } catch (e) { erroUsuario(e); }
            }
            const novo: AssuntoReuniao = {
                id: c.db.collection(COL_SESSOES).doc().id, ordem: assuntos.length + 1, ...campos!,
                inclusao: publicada ? 'extrapauta' : 'pauta', motivo: publicada ? motivo : '', situacao: 'pauta', incluido_em: new Date().toISOString(),
                impedidos: [], inscritos: [], com_a_palavra: null, falaram: [], resultado: null, encaminhamento: '', vem_de: vem,
            };
            gravar([...assuntos, novo]);
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_ASSUNTO', { sessao_id: ref.id, assunto_id: novo.id, titulo: novo.titulo, extrapauta: publicada }];
            return { ok: true, assunto_id: novo.id };
        }

        if (p.action === 'reuniaoTirar') {
            exigirGere();
            const x = exigirAssunto();
            if (!ativa) throw new HttpsError('failed-precondition', 'A reunião já foi encerrada ou cancelada');
            if (s.situacao === 'rascunho') { gravar(reordenarAssuntos(assuntos.filter((y) => y.id !== x.id), [])); return { ok: true }; }
            if (!vivo(x)) throw new HttpsError('failed-precondition', 'O assunto já foi deliberado ou saiu da pauta');
            if (motivo.length < MOTIVO_MIN) throw new HttpsError('invalid-argument', `Diga o motivo (ao menos ${MOTIVO_MIN} letras)`);
            assuntos[k] = { ...x, situacao: p.adiar === true ? 'adiado' : 'retirado', motivo, com_a_palavra: null, falaram: falaramCom(x), inscritos: [] };
            tx.update(ref, { assuntos, ...(s.em_julgamento === x.id ? { em_julgamento: FieldValue.delete() } : {}), ...versao });
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_ASSUNTO_RETIRADO', { sessao_id: ref.id, assunto_id: x.id, adiado: p.adiar === true, motivo }];
            return { ok: true };
        }

        if (p.action === 'reuniaoOrdenar') {
            exigirGere();
            if (!ativa) throw new HttpsError('failed-precondition', 'A reunião já foi encerrada ou cancelada');
            gravar(reordenarAssuntos(assuntos, (Array.isArray(p.ordem) ? p.ordem : []).map(String)));
            return { ok: true };
        }

        if (p.action === 'reuniaoEncaminhar') {
            exigirGere();
            const x = exigirAssunto();
            if (s.situacao === 'cancelada' || s.situacao === 'rascunho') throw new HttpsError('failed-precondition', 'O encaminhamento se registra na reunião publicada');
            if ((s.ata as { assinaturas?: unknown[] } | undefined)?.assinaturas?.length) throw new HttpsError('failed-precondition', 'A ata já tem assinatura e não muda mais');
            assuntos[k] = { ...x, encaminhamento: String(p.texto ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_ENCAMINHAMENTO) };
            gravar(assuntos);
            return { ok: true };
        }

        // Daqui em diante, o assunto na reunião em andamento.
        const x = exigirAssunto();
        if (s.situacao !== 'publicada' || !s.ativa) throw new HttpsError('failed-precondition', 'A reunião não está em andamento');

        if (p.action === 'reuniaoPalavra') {
            if (!noDia) throw new HttpsError('failed-precondition', 'A palavra se pede no dia da reunião (na reunião virtual, cada um vota no seu tempo)');
            if (!vivo(x)) throw new HttpsError('failed-precondition', 'O assunto já foi deliberado');
            const acao = String(p.acao || '');
            const inscritos = [...(x.inscritos || [])];
            if (acao === 'pedir' || acao === 'desistir') {
                if (!comp.some((m) => m.uid === quem.uid)) throw new HttpsError('permission-denied', 'Pede a palavra quem compõe o colegiado');
                if (acao === 'pedir') {
                    if (inscritos.some((i) => i.uid === quem.uid) || x.com_a_palavra?.uid === quem.uid) throw new HttpsError('already-exists', 'Você já está inscrito para falar neste assunto');
                    inscritos.push({ uid: quem.uid, nome: quem.nome, em: new Date().toISOString() });
                }
                assuntos[k] = { ...x, inscritos: acao === 'pedir' ? inscritos : inscritos.filter((i) => i.uid !== quem.uid) };
                gravar(assuntos);
                return { ok: true };
            }
            if (!conduz) throw new HttpsError('permission-denied', 'Quem dá e encerra a palavra é o presidente (ou a secretaria)');
            if (acao === 'conceder') {
                const uid = String(p.uid || '');
                const m = comp.find((y) => y.uid === uid);
                const insc = inscritos.find((i) => i.uid === uid);
                if (!m && !insc) throw new HttpsError('invalid-argument', 'A palavra vai a quem compõe o colegiado');
                const nome = insc?.nome || String(p.nome || 'Membro').slice(0, 120);
                assuntos[k] = { ...x, falaram: falaramCom(x), com_a_palavra: { uid, nome, em: new Date().toISOString() }, inscritos: inscritos.filter((i) => i.uid !== uid) };
            } else if (acao === 'encerrar') {
                assuntos[k] = { ...x, falaram: falaramCom(x), com_a_palavra: null };
            } else throw new HttpsError('invalid-argument', 'Ação da palavra desconhecida');
            tx.update(ref, { assuntos, em_julgamento: x.id, ...versao });
            return { ok: true };
        }

        if (p.action === 'reuniaoImpedimento') {
            if (!comp.some((m) => m.uid === quem.uid && m.funcao !== 'suplente')) throw new HttpsError('permission-denied', 'Declara impedimento quem vota no colegiado');
            if (!votavel(x)) throw new HttpsError('failed-precondition', 'O assunto não está em votação nem na pauta');
            const impedido = p.impedido === true;
            const ja = (x.impedidos || []).some((i) => i.uid === quem.uid);
            if (impedido === ja) return { ok: true };
            if (impedido && x.votacao === 'secreta' && (d?.votaram || []).includes(quem.uid)) throw new HttpsError('failed-precondition', 'Você já votou em votação secreta: o voto não se separa de quem votou depois');
            assuntos[k] = { ...x, impedidos: impedido ? [...(x.impedidos || []), { uid: quem.uid, nome: quem.nome }] : x.impedidos.filter((i) => i.uid !== quem.uid) };
            gravar(assuntos);
            // Impedido, o voto nominal já dado sai.
            if (impedido && d?.votos?.[quem.uid] && dref) tx.update(dref, { [`votos.${quem.uid}`]: FieldValue.delete() });
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_IMPEDIMENTO', { sessao_id: ref.id, assunto_id: x.id, impedido }];
            return { ok: true };
        }

        if (p.action === 'reuniaoAbrir') {
            if (!conduz) throw new HttpsError('permission-denied', 'Abre a votação o presidente (ou a secretaria)');
            if (!noDia) throw new HttpsError('failed-precondition', 'A votação se abre no dia da reunião (na virtual, ela abre sozinha no primeiro dia)');
            if (x.votacao === 'sem_votacao' || x.situacao !== 'pauta') throw new HttpsError('failed-precondition', 'Este assunto não tem votação a abrir');
            const outro = assuntos.find((y) => y.situacao === 'em_votacao');
            if (outro) throw new HttpsError('failed-precondition', `Feche antes a votação de "${outro.titulo}"`);
            const podem = aptos(o, s.data, x);
            const min = quorumMinimo(podem.length, regras.quorum);
            if (regras.quorum !== 'livre') {
                if (!registrada) throw new HttpsError('failed-precondition', 'Registre a presença antes: o quórum se conta pelos presentes');
                const presentes = podem.filter((u) => marcas[u] === true).length;
                if (presentes < min) throw new HttpsError('failed-precondition', `Sem quórum: ${presentes} presentes aptos a votar de ${podem.length} (mínimo de ${min}). Adie o assunto ou aguarde.`);
            }
            assuntos[k] = { ...x, situacao: 'em_votacao' };
            tx.update(ref, { assuntos, em_julgamento: x.id, ...versao });
            tx.set(ref.collection('deliberacoes').doc(x.id), { aberta_em: new Date().toISOString(), votos: {}, votaram: [], sim: 0, nao: 0, abstencao: 0 });
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_VOTACAO_ABERTA', { sessao_id: ref.id, assunto_id: x.id }];
            return { ok: true };
        }

        if (p.action === 'reuniaoVotar') {
            const voto = VOTOS.includes(p.voto as VotoReuniao) ? p.voto as VotoReuniao : null;
            if (!voto) throw new HttpsError('invalid-argument', 'Vote a favor, contra ou abstenção');
            if (x.votacao === 'simbolica') throw new HttpsError('failed-precondition', 'Na votação simbólica, o presidente anuncia o resultado e a secretaria registra');
            if (x.votacao === 'sem_votacao') throw new HttpsError('failed-precondition', 'Este assunto não tem votação');
            const porOutro = typeof p.por_uid === 'string' && p.por_uid && p.por_uid !== quem.uid;
            if (porOutro && (!gere || x.votacao !== 'nominal' || !sincrona)) throw new HttpsError('permission-denied', 'A secretaria registra só o voto nominal dado de viva voz na reunião');
            const alvo = porOutro ? String(p.por_uid) : quem.uid;
            const membro = comp.find((m) => m.uid === alvo);
            if (!membro || membro.funcao === 'suplente') throw new HttpsError('permission-denied', 'Vota quem compõe o colegiado no dia (o suplente, só substituindo)');
            if ((x.impedidos || []).some((i) => i.uid === alvo)) throw new HttpsError('failed-precondition', 'Com impedimento declarado, não se vota o assunto');
            if (sincrona) {
                if (x.situacao !== 'em_votacao' || !noDia) throw new HttpsError('failed-precondition', 'A votação deste assunto não está aberta');
                if (registrada && marcas[alvo] !== true) throw new HttpsError('failed-precondition', 'Só vota quem está presente: a secretaria marca a presença');
            } else if (x.situacao !== 'pauta' || !votacaoAberta(s, hoje)) throw new HttpsError('failed-precondition', 'A votação virtual não está aberta');
            const nomeAlvo = porOutro ? texto(p.nome, 120) || 'Membro' : quem.nome;
            const dd = sincrona ? d : (d || { sim: 0, nao: 0, abstencao: 0, votos: {}, votaram: [] });
            if (!dd || !dref) throw new HttpsError('failed-precondition', 'A votação deste assunto não está aberta');
            if (x.votacao === 'secreta') {
                if ((dd.votaram || []).includes(alvo)) throw new HttpsError('already-exists', 'Você já votou: na votação secreta, o voto não muda');
                // Só a soma e a lista de quem votou: nada liga a pessoa ao voto.
                tx.set(dref, { votaram: FieldValue.arrayUnion(alvo), [voto]: FieldValue.increment(1) }, { merge: true });
                return { ok: true };
            }
            tx.set(dref, { votos: { [alvo]: { voto, nome: nomeAlvo, em: new Date().toISOString(), ...(porOutro ? { por: quem.nome } : {}) } } }, { merge: true });
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_VOTO', { sessao_id: ref.id, assunto_id: x.id, voto, de: nomeAlvo, ...(porOutro ? { registrado_por: quem.nome } : {}) }];
            return { ok: true };
        }

        if (p.action === 'reuniaoSimbolica' || p.action === 'reuniaoApurar') {
            if (!conduz) throw new HttpsError('permission-denied', 'Apura a votação o presidente (ou a secretaria)');
            if (x.votacao === 'sem_votacao') {
                if (x.situacao !== 'pauta') throw new HttpsError('failed-precondition', 'O assunto já foi tratado');
                assuntos[k] = { ...x, situacao: 'deliberado', com_a_palavra: null, falaram: falaramCom(x) };
                tx.update(ref, { assuntos, ...(s.em_julgamento === x.id ? { em_julgamento: FieldValue.delete() } : {}), ...versao });
                return { ok: true };
            }
            if (!sincrona) throw new HttpsError('failed-precondition', 'Na reunião virtual, o sistema apura no fim da votação');
            if (x.situacao !== 'em_votacao') throw new HttpsError('failed-precondition', 'A votação deste assunto não está aberta');
            const podem = aptos(o, s.data, x);
            let placar: Placar;
            if (p.action === 'reuniaoSimbolica') {
                if (x.votacao !== 'simbolica') throw new HttpsError('failed-precondition', 'O placar se registra à mão só na votação simbólica');
                const n = (v: unknown) => { const y = Math.round(Number(v)); return Number.isFinite(y) && y >= 0 ? y : -1; };
                placar = { sim: n(p.sim), nao: n(p.nao), abstencao: n(p.abstencao) };
                if (placar.sim < 0 || placar.nao < 0 || placar.abstencao < 0) throw new HttpsError('invalid-argument', 'Informe quantos votaram a favor, contra e se abstiveram');
                const teto = registrada ? podem.filter((u) => marcas[u] === true).length : podem.length;
                if (placar.sim + placar.nao + placar.abstencao > teto) throw new HttpsError('invalid-argument', `O placar passa de ${teto}, o número de ${registrada ? 'presentes aptos a votar' : 'membros aptos a votar'}`);
            } else {
                if (x.votacao === 'simbolica') throw new HttpsError('failed-precondition', 'Na votação simbólica, registre o placar anunciado');
                placar = placarDoAssunto(x, d, podem);
            }
            const res = apurar(placar, x.maioria, podem.length, regras);
            assuntos[k] = comResultado(x, res, d);
            tx.update(ref, { assuntos, ...(res.aprovado === null && !res.sem_quorum ? {} : s.em_julgamento === x.id ? { em_julgamento: FieldValue.delete() } : {}), ...versao });
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_APURADA', { sessao_id: ref.id, assunto_id: x.id, resultado: res.texto }];
            return { ok: true, resultado: res.texto };
        }

        if (p.action === 'reuniaoDesempate') {
            if (!preside) throw new HttpsError('permission-denied', 'O voto de qualidade é de quem preside o colegiado');
            if (x.situacao !== 'empate' || !x.resultado) throw new HttpsError('failed-precondition', 'O assunto não está empatado');
            const voto = p.voto === 'sim' ? 'sim' : p.voto === 'nao' ? 'nao' : null;
            if (!voto) throw new HttpsError('invalid-argument', 'Desempate a favor ou contra');
            assuntos[k] = { ...x, situacao: 'deliberado', resultado: desempatar(x.resultado, voto, quem.nome) };
            tx.update(ref, { assuntos, ...(s.em_julgamento === x.id ? { em_julgamento: FieldValue.delete() } : {}), ...versao });
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_DESEMPATE', { sessao_id: ref.id, assunto_id: x.id, voto }];
            return { ok: true };
        }
        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    });
    if (auditoria) await auditar(c.db, c.orgId, quem.uid, quem.nome, auditoria[0], auditoria[1]);
    return r;
}

/**
 * Ao encerrar a reunião: na virtual, apura cada assunto (o empate vai à próxima
 * reunião, para o voto de qualidade); na síncrona, o que não foi deliberado é
 * adiado. Quem estava com a palavra entra entre os que falaram.
 */
export async function fecharReuniao(db: admin.firestore.Firestore, ref: admin.firestore.DocumentReference, o: Orgao): Promise<void> {
    await db.runTransaction(async (tx) => {
        const s = (await tx.get(ref)).data() as Sessao;
        const assuntos = [...((s.assuntos || []) as AssuntoReuniao[])];
        const virtual = s.modo === 'assincrona';
        const ds = assuntos.length ? await tx.getAll(...assuntos.map((a) => ref.collection('deliberacoes').doc(a.id))) : [];
        const regras = regrasReuniao(o.pauta);
        const fechados = assuntos.map((a, i) => {
            if (!vivo(a)) return a;
            const fecha = { ...a, com_a_palavra: null, falaram: falaramCom(a), inscritos: [] };
            if (a.votacao === 'sem_votacao') return { ...fecha, situacao: (virtual ? 'deliberado' : 'adiado') as AssuntoReuniao['situacao'], motivo: virtual ? a.motivo : 'não tratado na reunião' };
            if (virtual && a.situacao === 'pauta') {
                const d = ds[i]?.data() as Deliberacao | undefined;
                const podem = aptos(o, s.data, a);
                const r = apurar(placarDoAssunto(a, d, podem), a.maioria, podem.length, regras);
                // Empate na virtual: vai à próxima reunião, onde o presidente desempata (Res. CNJ 591, art. 5º, § 8º, por analogia).
                if (r.aprovado === null && !r.sem_quorum) return { ...fecha, resultado: r, situacao: 'adiado' as const, motivo: 'empate na votação virtual, para o voto de qualidade na próxima reunião' };
                return comResultado(fecha, r, d);
            }
            return { ...fecha, situacao: 'adiado' as const, motivo: a.situacao === 'empate' ? 'empate sem o voto de qualidade' : 'não deliberado na reunião' };
        });
        tx.update(ref, { assuntos: fechados });
    });
}

/** Membros que ainda devem voto em assunto aberto da reunião virtual (para o lembrete do último dia). */
export async function devemVotoNaReuniao(ref: admin.firestore.DocumentReference, s: Sessao, o: Orgao): Promise<string[]> {
    const abertos = ((s.assuntos || []) as AssuntoReuniao[]).filter((a) => a.situacao === 'pauta' && (a.votacao === 'nominal' || a.votacao === 'secreta'));
    if (!abertos.length) return [];
    const ds = await ref.firestore.getAll(...abertos.map((a) => ref.collection('deliberacoes').doc(a.id)));
    const devem = new Set<string>();
    abertos.forEach((a, i) => {
        const d = ds[i].data() as Deliberacao | undefined;
        const ja = new Set([...Object.keys(d?.votos || {}), ...(d?.votaram || [])]);
        for (const u of aptos(o, s.data, a)) if (!ja.has(u)) devem.add(u);
    });
    return [...devem];
}

/** Quem votou em algum assunto (presença da reunião virtual, na ata). */
export async function votaramNaReuniao(ref: admin.firestore.DocumentReference, s: Sessao): Promise<string[]> {
    const as = (s.assuntos || []) as AssuntoReuniao[];
    if (!as.length) return [];
    const ds = await ref.firestore.getAll(...as.map((a) => ref.collection('deliberacoes').doc(a.id)));
    return [...new Set(ds.flatMap((d) => { const x = d.data() as Deliberacao | undefined; return [...Object.keys(x?.votos || {}), ...(x?.votaram || [])]; }))];
}

/**
 * Para a tela: cada assunto com o que a pessoa pode ver e fazer. Antes da
 * apuração, só quantos votaram (e o próprio voto); depois, o resultado e, na
 * nominal, os nomes. Na secreta, nunca o voto de ninguém.
 */
export async function assuntosParaTela(c: Contexto, ref: admin.firestore.DocumentReference, s: Sessao, o: Orgao, hoje: string) {
    const as = [...((s.assuntos || []) as AssuntoReuniao[])].sort((a, b) => a.ordem - b.ordem);
    const ds = as.length ? await c.db.getAll(...as.map((a) => ref.collection('deliberacoes').doc(a.id))) : [];
    const comp = composicaoEm(o.composicao, s.data);
    const eu = comp.find((m) => m.uid === c.ctx.uid);
    const votante = !!eu && eu.funcao !== 'suplente';
    const sincrona = s.modo !== 'assincrona';
    const noDia = s.situacao === 'publicada' && s.ativa && sincrona && s.data <= hoje;
    const marcas = (s.presencas || {}) as Record<string, boolean>;
    const registrada = Object.keys(marcas).length > 0;
    const aberta = s.situacao === 'publicada' && s.ativa && (sincrona ? noDia : votacaoAberta(s, hoje));
    return as.map((a, i) => {
        const d = ds[i]?.data() as Deliberacao | undefined;
        const podem = aptos(o, s.data, a);
        const votaram = a.votacao === 'secreta' ? (d?.votaram || []).filter((u) => podem.includes(u)).length : Object.keys(d?.votos || {}).filter((u) => podem.includes(u)).length;
        const impedido = (a.impedidos || []).some((x) => x.uid === c.ctx.uid);
        const emAberto = sincrona ? a.situacao === 'em_votacao' : a.situacao === 'pauta';
        const presente = !sincrona || !registrada || marcas[c.ctx.uid] === true;
        const meuVoto = a.votacao === 'nominal' ? d?.votos?.[c.ctx.uid]?.voto || null : null;
        const jaVotei = a.votacao === 'secreta' ? (d?.votaram || []).includes(c.ctx.uid) : !!meuVoto;
        return {
            id: a.id, ordem: a.ordem, titulo: a.titulo, descricao: a.descricao, proponente: a.proponente, votacao: a.votacao, maioria: a.maioria,
            inclusao: a.inclusao, motivo: a.motivo, situacao: a.situacao, encaminhamento: a.encaminhamento || '',
            vem_de: a.vem_de || null, levado: !!a.levado_para,
            impedidos: (a.impedidos || []).map((x) => x.nome), eu_impedido: impedido,
            inscritos: (a.inscritos || []).map((x) => ({ uid: x.uid, nome: x.nome, sou_eu: x.uid === c.ctx.uid })),
            com_a_palavra: a.com_a_palavra ? { nome: a.com_a_palavra.nome, em: a.com_a_palavra.em, sou_eu: a.com_a_palavra.uid === c.ctx.uid } : null,
            falaram: a.falaram || [],
            resultado: a.resultado || null,
            nominais: a.situacao === 'deliberado' || a.situacao === 'empate' ? a.nominais || [] : [],
            votaram, aptos: podem.length,
            meu_voto: meuVoto, ja_votei: jaVotei,
            votos_registrados: a.votacao === 'nominal' && a.situacao === 'em_votacao' && gereSessoes(c, o.id)
                ? Object.entries(d?.votos || {}).map(([uid, v]) => ({ uid, nome: v.nome, voto: v.voto })) : undefined,
            pode_votar: votante && aberta && emAberto && !impedido && presente && (a.votacao === 'nominal' || (a.votacao === 'secreta' && !jaVotei)),
            pode_impedir: votante && votavel(a) && s.situacao === 'publicada' && !(a.votacao === 'secreta' && jaVotei && !impedido),
            pode_pedir_palavra: !!eu && noDia && vivo(a),
        };
    });
}
