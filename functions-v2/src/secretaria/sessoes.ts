import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { CalendarioOrgao, diaUtil, hojeBrasil, podeVer, sanitizeCalendario, texto, unidadeExpede } from '../shared/secretaria';
import { Orgao, composicaoEm, orgaosDe } from '../shared/orgaos';
import {
    DadosSessao, ItemPauta, MAX_PAUTA, SituacaoSessao, dataMinimaDaSessao, julgamentoPendente, problemaDaAntecedencia,
    AtaSessao, PedidoSessao, Votacao, reordenar, votacaoAberta, virtualEncerrou, sanitizeDadosSessao, textoDaInclusao, textoDaRetirada,
} from '../shared/sessoes';
import { auditar } from './config';
import { COL, Contexto, administraOrgao, erroUsuario, julgadorLe, lerProcesso, registrarMovimento } from './context';
import { avisarPartesDoMovimento } from './portalAvisos';
import { ACOES_VOTACAO, acaoVotacao, resumoVotacao } from './votacao';
import { ACOES_S8, COL_PAINEIS, acaoAta, ataParaTela, atualizarPainel, avisarComposicao } from './painelAta';
/**
 * Sessões de julgamento dos colegiados (secSessoes), pelas ações `sessao*` de
 * secretariaProcesso. A secretaria do colegiado monta a pauta em rascunho e a
 * publica; cada processo pautado ganha a certidão de inclusão nos autos (vista
 * e avisada às partes) e o campo `sessao`. Quem compõe o colegiado e quem está
 * lotado nele veem as sessões publicadas; o rascunho é só da secretaria.
 */

export const COL_SESSOES = 'secSessoes';
type Payload = Record<string, unknown>;
export type Sessao = DadosSessao & {
    organization_id: string; orgao_id: string; tipo: 'julgamento'; situacao: SituacaoSessao; ativa: boolean;
    pauta: ItemPauta[]; processos_ids: string[]; version: number; [k: string]: unknown;
};
const MOTIVO_MIN = 5;

/** Secretaria do colegiado: admin (ou admin delegado do órgão), gestor de unidade dele ou lotado em unidade dele que expede. */
export function gereSessoes(c: Contexto, orgaoId: string): boolean {
    if (administraOrgao(c, orgaoId)) return true;
    return c.unidades.some((u) => !u.excluida && u.ativa !== false && u.orgao_id === orgaoId
        && (c.gestorDe.includes(u.id) || (c.ctx.unidadeIds.includes(u.id) && unidadeExpede(u))));
}

/** Vê as sessões publicadas: a secretaria, quem está lotado no colegiado e quem o compõe hoje. */
export function veSessoes(c: Contexto, o: Orgao, hoje: string): boolean {
    return gereSessoes(c, o.id)
        || c.unidades.some((u) => u.orgao_id === o.id && c.ctx.unidadeIds.includes(u.id))
        || composicaoEm(o.composicao, hoje).some((m) => m.uid === c.ctx.uid);
}

export async function lerConfig(c: Contexto, tx?: admin.firestore.Transaction) {
    const ref = c.db.collection(COL.config).doc(c.orgId);
    const d = (tx ? await tx.get(ref) : await ref.get()).data();
    return { orgaos: orgaosDe(d?.orgaos).filter((o) => o.decisao === 'colegiada' && o.ativo), calendario: sanitizeCalendario(d?.calendario) as CalendarioOrgao };
}

export function colegiado(orgaos: Orgao[], id: unknown): Orgao {
    const o = orgaos.find((x) => x.id === id);
    if (!o) throw new HttpsError('not-found', 'Colegiado não encontrado (o órgão precisa decidir em colegiado e estar ativo)');
    return o;
}

export async function lerSessao(c: Contexto, id: unknown, tx?: admin.firestore.Transaction) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new HttpsError('invalid-argument', 'Sessão inválida');
    const ref = c.db.collection(COL_SESSOES).doc(id);
    const snap = tx ? await tx.get(ref) : await ref.get();
    const s = snap.data() as Sessao | undefined;
    if (!s || s.organization_id !== c.orgId) throw new HttpsError('not-found', 'Sessão não encontrada');
    return { ref, s };
}

const unidadesDo = (c: Contexto, orgaoId: string) => c.unidades.filter((u) => !u.excluida && u.orgao_id === orgaoId).map((u) => u.id);

/** Por que o processo não pode entrar (ou ficar) na pauta deste colegiado; '' quando pode. */
function inapto(c: Contexto, proc: admin.firestore.DocumentData, orgaoId: string): string {
    if (proc.status !== 'em_tramitacao') return 'não está em tramitação';
    if (!unidadesDo(c, orgaoId).includes(String(proc.unidade_atual))) return 'não está em unidade do colegiado';
    if (julgamentoPendente(proc) < 0) return 'não tem julgamento pendente na fase atual';
    return '';
}

const resumoSessao = (id: string, s: Sessao, orgao?: Orgao) => ({
    id, orgao_id: s.orgao_id, orgao_nome: orgao?.nome || '', titulo: s.titulo, carater: s.carater, modo: s.modo, data: s.data, hora: s.hora, fim: s.fim || null,
    local: s.local, link: s.link, situacao: s.situacao, itens: (s.pauta || []).filter((x) => x.situacao === 'pautado').length,
});

/** O que vai no processo pautado (lido pela capa, pela lista e pelo portal). */
const marcaNoProcesso = (id: string, s: DadosSessao, orgao: Orgao, item: ItemPauta) => ({
    id, titulo: s.titulo, data: s.data, hora: s.hora, modo: s.modo, local: s.local, link: s.link, ...(s.fim ? { fim: s.fim } : {}),
    orgao_id: orgao.id, colegiado: orgao.nome, inclusao: item.inclusao,
});

/**
 * Julgamento que continua de outra sessão (S5: vista, adiamento, diligência):
 * `proc.julgamento_em_curso` diz de qual sessão e se os votos seguem. Lido na
 * transação, antes de qualquer escrita.
 */
export async function lerContinuacao(tx: admin.firestore.Transaction, c: Contexto, pid: string, proc: admin.firestore.DocumentData) {
    const j = proc.julgamento_em_curso as { sessao_id?: string; manter_votos?: boolean; so_relator?: boolean; relator_uid?: string; relator_nome?: string } | undefined;
    if (!j?.sessao_id) return null;
    const lido = j.manter_votos ? (await tx.get(c.db.collection(COL_SESSOES).doc(j.sessao_id).collection('votacoes').doc(pid))).data() as Votacao | undefined : undefined;
    // Destacado da sessão virtual (S7): recomeça, com o voto do relator em rascunho e sem os votos dos pares.
    const v = lido && j.so_relator ? { ...lido, votos: {}, liberado_em: null } : lido;
    return { de: j.sessao_id, v, relator_uid: j.relator_uid || '', relator_nome: j.relator_nome || '' };
}

/** Próxima sessão ativa do colegiado depois de `depoisDe`, onde o julgamento continua. Lida na transação. */
export async function proximaSessao(tx: admin.firestore.Transaction, c: Contexto, orgaoId: string, excluir: string, depoisDe: string, sincrona = false) {
    const q = await tx.get(c.db.collection(COL_SESSOES).where('organization_id', '==', c.orgId).where('orgao_id', '==', orgaoId).where('ativa', '==', true));
    const hoje = hojeBrasil();
    return q.docs.map((d) => ({ ref: d.ref, s: d.data() as Sessao }))
        .filter((x) => x.ref.id !== excluir && (!sincrona || x.s.modo !== 'assincrona') && x.s.data > depoisDe && x.s.data >= hoje && (x.s.pauta || []).filter((i) => i.situacao === 'pautado').length < MAX_PAUTA)
        .sort((a, b) => `${a.s.data}T${a.s.hora}`.localeCompare(`${b.s.data}T${b.s.hora}`))[0] || null;
}

/**
 * Põe o processo na pauta (só escritas): o item, a votação que continua e,
 * com a pauta publicada, a certidão de inclusão. Devolve o que o processo
 * recebe (o chamador grava, junto com o que mais mudar nele).
 */
export function incluirNaSessao(
    tx: admin.firestore.Transaction, c: Contexto, alvo: { ref: admin.firestore.DocumentReference; s: Sessao }, o: Orgao,
    pref: admin.firestore.DocumentReference, proc: admin.firestore.DocumentData, inclusao: ItemPauta['inclusao'], motivo: string,
    cont: Awaited<ReturnType<typeof lerContinuacao>>,
): Record<string, unknown> {
    const { ref, s } = alvo;
    const pauta = (s.pauta || []).filter((x) => x.processo_id !== pref.id);
    const relator = cont?.v?.relator_uid ? { relator_uid: cont.v.relator_uid, relator_nome: cont.v.relator_nome } : cont?.relator_uid ? { relator_uid: cont.relator_uid, relator_nome: cont.relator_nome } : {};
    const item: ItemPauta = {
        processo_id: pref.id, numero: String(proc.numero || ''), assunto: String(proc.assunto || '').slice(0, 200),
        ordem: pauta.length + 1, inclusao, motivo, situacao: 'pautado', incluido_em: new Date().toISOString(), ...relator,
    };
    // Os votos já dados seguem (e podem mudar até a proclamação); o resultado de lá não.
    if (cont?.v) tx.set(ref.collection('votacoes').doc(pref.id), { ...cont.v, proclamado: null, continua_de: cont.de });
    tx.update(ref, { pauta: [...pauta, item], processos_ids: [...new Set([...(s.processos_ids || []), pref.id])], version: (s.version || 0) + 1, updated_at: FieldValue.serverTimestamp() });
    if (s.situacao !== 'publicada') return {};
    const mov = registrarMovimento(tx, c, pref, proc, 'pauta', textoDaInclusao(s, o.nome, item), { sessao_id: ref.id, inclusao });
    return { ...mov, sessao: marcaNoProcesso(ref.id, s, o, item), julgamento_em_curso: FieldValue.delete(), vista: FieldValue.delete() };
}

/** Leitura dos autos pelo julgador, pela pauta: registrada fora dos autos (secProcessos/{id}/leituras). */
export async function registrarLeitura(c: Contexto, ref: admin.firestore.DocumentReference, proc: admin.firestore.DocumentData, oQue: string) {
    const s = proc.sessao || proc.ultima_sessao || {};
    await ref.collection('leituras').add({
        uid: c.ctx.uid, nome: c.userName, em: new Date().toISOString(), o_que: oQue.slice(0, 200),
        sessao_id: s.id || null, sessao: s.titulo || '', colegiado: s.colegiado || '',
    });
}

export async function leiturasDoProcesso(ref: admin.firestore.DocumentReference) {
    const s = await ref.collection('leituras').orderBy('em', 'desc').limit(50).get();
    return s.docs.map((d) => { const x = d.data(); return { nome: x.nome, em: x.em, o_que: x.o_que, sessao: x.sessao, colegiado: x.colegiado }; });
}

export const COL_ANOTACOES = 'secAnotacoes';
export const MAX_ANOTACAO = 20000;

/**
 * Anotação privada de quem lê o processo (julgador, assessoria, secretaria):
 * uma por pessoa e processo, só ela lê e escreve, nunca vai aos autos. Sem
 * `texto`, devolve a atual; com texto vazio, apaga.
 */
export async function acaoAnotacao(c: Contexto, p: Payload) {
    const { ref: pref } = await lerProcesso(c, p.id, undefined, { julgador: true });
    const ref = c.db.collection(COL_ANOTACOES).doc(`${c.ctx.uid}_${pref.id}`);
    if (typeof p.texto !== 'string') {
        const d = (await ref.get()).data();
        return { texto: d?.texto || '', atualizada_em: d?.atualizada_em || null };
    }
    const texto = p.texto.replace(/\r\n/g, '\n').slice(0, MAX_ANOTACAO);
    if (!texto.trim()) { await ref.delete(); return { texto: '', atualizada_em: null }; }
    const atualizada_em = new Date().toISOString();
    await ref.set({ organization_id: c.orgId, uid: c.ctx.uid, processo_id: pref.id, texto, atualizada_em });
    return { texto, atualizada_em };
}

const SO_LEITURA = ['sessaoListar', 'sessaoObter', 'sessaoAptos', 'sessaoVotacao'];

export async function acaoSessao(c: Contexto, p: Payload): Promise<unknown> {
    const r = await acaoSessaoEm(c, p);
    // S8: cada mudança refaz o painel ao vivo, e quem está com a sessão aberta recarrega.
    if (!SO_LEITURA.includes(String(p.action))) {
        const ids = [p.action === 'sessaoSalvar' && !p.id ? (r as { id?: string })?.id : p.id, (r as { continua_em?: { id?: string } } | null)?.continua_em?.id];
        for (const id of new Set(ids)) if (typeof id === 'string' && id) await atualizarPainel(c.db, c.orgId, id);
    }
    return r;
}

async function acaoSessaoEm(c: Contexto, p: Payload): Promise<unknown> {
    // Relator, votos e proclamação (S4): secretaria/votacao.ts.
    if (ACOES_VOTACAO.includes(String(p.action))) return acaoVotacao(c, p);
    // Presença, chamada do processo e ata (S8): secretaria/painelAta.ts.
    if (ACOES_S8.includes(String(p.action))) return acaoAta(c, p);    const hoje = hojeBrasil();
    const quem = { uid: c.ctx.uid, nome: c.userName };

    if (p.action === 'sessaoListar') {
        const { orgaos } = await lerConfig(c);
        const vistos = orgaos.filter((o) => veSessoes(c, o, hoje));
        if (!vistos.length) return { colegiados: [], sessoes: [] };
        // ponytail: lê todas as sessões da entidade e filtra aqui; índice por órgão e data quando passarem de alguns milhares.
        const snap = await c.db.collection(COL_SESSOES).where('organization_id', '==', c.orgId).get();
        const porId = new Map(vistos.map((o) => [o.id, o]));
        const sessoes = snap.docs.map((d) => ({ id: d.id, s: d.data() as Sessao }))
            .filter(({ s }) => porId.has(s.orgao_id) && (s.situacao !== 'rascunho' || gereSessoes(c, s.orgao_id)))
            .map(({ id, s }) => ({
                ...resumoSessao(id, s, porId.get(s.orgao_id)),
                // Agenda pessoal: compõe o colegiado no dia da sessão.
                componho: composicaoEm(porId.get(s.orgao_id)!.composicao, s.data).some((m) => m.uid === c.ctx.uid),
            }))
            .sort((a, b) => `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`));
        // S6: acórdãos que esta pessoa redige, ainda não juntados.
        const acs = await c.db.collection(COL.processos).where('organization_id', '==', c.orgId).where('acordao.redator_uid', '==', c.ctx.uid).where('acordao.pendente', '==', true).limit(50).get();
        const acordaos = acs.docs.map((d) => {
            const x = d.data();
            return { processo_id: d.id, numero: x.numero, sessao_id: x.acordao.sessao_id, sessao: x.acordao.sessao, colegiado: x.acordao.colegiado, resultado: x.acordao.resultado, prazo: x.acordao.prazo, enviado: !!x.acordao.enviado_em };
        }).sort((a, b) => String(a.prazo).localeCompare(String(b.prazo)));
        return {
            hoje,
            colegiados: vistos.map((o) => ({ id: o.id, nome: o.nome, sigla: o.sigla, gere: gereSessoes(c, o.id), pauta: o.pauta })),
            sessoes,
            acordaos,
        };
    }

    if (p.action === 'sessaoObter') {
        const { orgaos, calendario } = await lerConfig(c);
        const { ref, s } = await lerSessao(c, p.id);
        const o = colegiado(orgaos, s.orgao_id);
        const gere = gereSessoes(c, o.id);
        if (!veSessoes(c, o, hoje) || (s.situacao === 'rascunho' && !gere)) throw new HttpsError('not-found', 'Sessão não encontrada');
        const pauta = [...(s.pauta || [])].sort((a, b) => a.ordem - b.ordem);
        const [snaps, notas, votacoes, pedSnap] = pauta.length ? await Promise.all([
            c.db.getAll(...pauta.map((x) => c.db.collection(COL.processos).doc(x.processo_id))),
            c.db.getAll(...pauta.map((x) => c.db.collection(COL_ANOTACOES).doc(`${c.ctx.uid}_${x.processo_id}`))),
            c.db.getAll(...pauta.map((x) => ref.collection('votacoes').doc(x.processo_id))),
            ref.collection('pedidos').get(),
        ]) : [[], [], [], null];
        // S7: pedidos das partes por processo (os indeferidos não contam).
        const pedidosDe = (pid: string) => {
            const ds = (pedSnap?.docs || []).map((d) => d.data() as PedidoSessao).filter((x) => x.processo_id === pid);
            const vale = (t: string) => ds.filter((x) => x.tipo === t && x.situacao !== 'indeferido').length;
            return { sustentacao: vale('sustentacao'), preferencia: vale('preferencia'), esclarecimento: vale('esclarecimento'), destaque: ds.filter((x) => x.tipo === 'destaque' && x.situacao === 'pedido').length, a_decidir: ds.filter((x) => x.situacao === 'pedido').length };
        };
        // Quem vota no dia da sessão: presidente e titulares.
        const quemVota = composicaoEm(o.composicao, s.data).filter((m) => m.funcao !== 'suplente').map((m) => m.uid);
        const itens = pauta.map((x, i) => {
            const d = snaps[i].data();
            // Pela lotação, ou como julgador do colegiado enquanto pautado (S3).
            const abre = !!d && d.status !== 'excluido' && (podeVer(d as never, c.ctx) || julgadorLe(c, d));
            // Sigilo restrito: quem não vê os autos não vê o assunto nem as partes.
            const aberto = !!d && (abre || d.sigilo !== 'restrito');
            const julgado = !!d && d.ultima_sessao?.id === ref.id && d.sessao?.id !== ref.id;
            return {
                ...x,
                assunto: aberto ? x.assunto : 'Processo sob sigilo',
                partes: aberto ? ((d!.partes || []) as Array<{ nome: string; polo: string; retirada?: unknown }>).filter((q) => !q.retirada).map((q) => ({ nome: q.nome, polo: q.polo })) : [],
                pode_abrir: abre,
                urgente: d?.urgente === true,
                julgado,
                minha_anotacao: notas[i].exists,
                // S6: o acórdão do julgamento desta sessão.
                acordao: julgado && d!.acordao?.sessao_id === ref.id
                    ? { redator_nome: d!.acordao.redator_nome || '', prazo: d!.acordao.prazo, enviado: !!d!.acordao.enviado_em, juntado: !!d!.acordao.juntado_em, sou_redator: d!.acordao.redator_uid === c.ctx.uid } : null,
                relator_nome: x.relator_nome || '',
                pedidos: pedidosDe(x.processo_id),
                // Julgamento iniciado em sessão anterior (CPC, art. 936, III).
                continua: !!votacoes[i].data()?.continua_de,
                votacao: resumoVotacao(votacoes[i].data() as Votacao | undefined, c.ctx.uid, x.situacao === 'pautado' ? quemVota : [], x.relator_uid || ''),
                // Só a secretaria precisa saber se o processo deixou de estar apto (para retirar).
                ...(gere && x.situacao === 'pautado' && !julgado ? { problema: d ? inapto(c, d, o.id) : 'o processo não existe mais' } : {}),
            };
        });
        // S8: quem pode ver a sessão lê o painel ao vivo (admin ou gestor fora do colegiado entra ao abrir).
        const painel = (await c.db.collection(COL_PAINEIS).doc(ref.id).get()).data();
        if (!painel || !((painel.leitores || []) as string[]).includes(c.ctx.uid)) await atualizarPainel(c.db, c.orgId, ref.id, c.ctx.uid);
        const comp = composicaoEm(o.composicao, s.data);
        const preside = comp.some((m) => m.uid === c.ctx.uid && m.funcao === 'presidente');
        const sincrona = s.modo !== 'assincrona';
        const noDia = s.situacao === 'publicada' && s.ativa && sincrona && s.data <= hoje;
        const ata = s.ata as AtaSessao | undefined;
        const assinou = (papel: string) => !!ata?.assinaturas?.some((x) => x.papel === papel);
        const jaAssinei = !!ata?.assinaturas?.some((x) => x.uid === c.ctx.uid);
        // Para a lista de presença: a composição do dia com os nomes (só a secretaria marca).
        const nmComp = gere && noDia && comp.length ? await c.db.getAll(...comp.map((m) => c.db.collection('userOrganizations').doc(`${m.uid}_${c.orgId}`))) : [];
        return {
            hoje,
            gere,
            colegiado: { id: o.id, nome: o.nome, pauta: o.pauta },
            data_minima: dataMinimaDaSessao(hoje, o.pauta, calendario),
            // Fim de semana, feriado nacional ou do órgão, ou recesso: a tela avisa (sessão extraordinária pode ser assim).
            dia_util: diaUtil(new Date(`${s.data}T00:00:00Z`), calendario),
            sessao: { ...resumoSessao(ref.id, s, o), observacoes: s.observacoes || '', version: s.version, publicada_em: s.publicada_em || null,
                publicada_por: s.publicada_por_nome || '', cancelada_em: s.cancelada_em || null, motivo_cancelamento: s.motivo_cancelamento || '',
                encerrada_em: s.encerrada_em || null, votacao_aberta: votacaoAberta(s, hoje), virtual_encerrou: virtualEncerrou(s, hoje),
                preside, em_julgamento: s.em_julgamento || null, encerrada_por: s.encerrada_por_nome || '' },
            pauta: itens,
            // S8: presença (marcada pela secretaria no dia da sessão síncrona) e ata.
            presenca: sincrona && (gere || s.presencas) ? {
                marcas: s.presencas || {},
                composicao: nmComp.length ? comp.map((m, i) => ({ uid: m.uid, funcao: m.funcao, nome: String(nmComp[i].data()?.user_name || nmComp[i].data()?.user_email || 'Membro') })) : [],
            } : null,
            ata: ataParaTela(ata),
            pode: {
                presenca: gere && noDia,
                chamar: (gere || preside) && noDia,
                encerrar: (gere || preside) && s.situacao === 'publicada' && s.ativa && (sincrona ? s.data <= hoje : virtualEncerrou(s, hoje)),
                ata_editar: gere && s.situacao === 'encerrada' && !ata?.assinaturas?.length,
                assinar_presidente: !!ata && preside && !assinou('presidente') && !jaAssinei,
                assinar_secretaria: !!ata && gere && !assinou('secretaria') && !jaAssinei,            },
        };
    }

    // Daqui em diante, só a secretaria do colegiado.
    const exigirGere = (orgaoId: string) => {
        if (!gereSessoes(c, orgaoId)) throw new HttpsError('permission-denied', 'Só a secretaria do colegiado (ou quem o administra) cuida das sessões');
    };
    const motivo = texto(p.motivo, 500);
    const exigirMotivo = (o: string) => { if (motivo.length < MOTIVO_MIN) throw new HttpsError('invalid-argument', `Diga o motivo ${o} (ao menos ${MOTIVO_MIN} letras)`); };

    if (p.action === 'sessaoAptos') {
        const { orgaos } = await lerConfig(c);
        const o = colegiado(orgaos, p.orgao_id);
        exigirGere(o.id);
        const unidades = unidadesDo(c, o.id).slice(0, 30);
        if (!unidades.length) return { processos: [] };
        const [procs, ativas] = await Promise.all([
            c.db.collection(COL.processos).where('organization_id', '==', c.orgId).where('unidade_atual', 'in', unidades).where('status', '==', 'em_tramitacao').get(),
            c.db.collection(COL_SESSOES).where('organization_id', '==', c.orgId).where('orgao_id', '==', o.id).where('ativa', '==', true).get(),
        ]);
        const emPauta = new Map<string, string>();
        for (const d of ativas.docs) for (const x of (d.data().pauta || []) as ItemPauta[]) if (x.situacao === 'pautado') emPauta.set(x.processo_id, d.data().titulo);
        const processos = procs.docs.filter((d) => podeVer(d.data() as never, c.ctx)).map((d) => {
            const x = d.data();
            const idx = julgamentoPendente(x);
            if (idx < 0) return null;
            const fase = (x.fases || []).find((f: { id: string }) => f.id === x.fase_atual);
            return {
                id: d.id, numero: x.numero, assunto: x.assunto, urgente: x.urgente === true, autuado_em: x.autuado_em || null,
                fase_nome: fase?.nome || '', acao: fase?.acoes?.[idx] || 'Julgamento', unidade_atual: x.unidade_atual,
                em_pauta: emPauta.get(d.id) || null,
                // S5: com vista, só entra em pauta depois da devolução ou do fim do prazo; julgamento que continua leva relator e votos.
                vista: x.vista ? { nomes: x.vista.nomes || [], prazo: x.vista.prazo, vencida: x.vista.prazo < hoje } : null,
                continua: x.julgamento_em_curso ? { relator_nome: x.julgamento_em_curso.relator_nome || '', manter_votos: x.julgamento_em_curso.manter_votos === true } : null,
            };
        }).filter(Boolean);
        return { processos };
    }

    if (p.action === 'sessaoSalvar') {
        const { orgaos } = await lerConfig(c);
        let dados: DadosSessao;
        try { dados = sanitizeDadosSessao(p.sessao); } catch (e) { erroUsuario(e); }
        if (!p.id) {
            const o = colegiado(orgaos, p.orgao_id);
            exigirGere(o.id);
            if (dados!.data < hoje) throw new HttpsError('invalid-argument', 'A data da sessão já passou');
            const ref = c.db.collection(COL_SESSOES).doc();
            await ref.set({
                organization_id: c.orgId, orgao_id: o.id, tipo: 'julgamento', ...dados!, ...(dados!.fim ? { encerra_em: dados!.fim } : {}), situacao: 'rascunho', ativa: true, pauta: [], processos_ids: [],
                criado_por: quem.uid, criado_por_nome: quem.nome, criado_em: new Date().toISOString(), version: 1, updated_at: FieldValue.serverTimestamp(),
            });
            await auditar(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_CRIADA', { sessao_id: ref.id, orgao_id: o.id, data: dados!.data });
            return { id: ref.id };
        }
        return c.db.runTransaction(async (tx) => {
            const { ref, s } = await lerSessao(c, p.id, tx);
            exigirGere(s.orgao_id);
            if (!s.ativa) throw new HttpsError('failed-precondition', 'Sessão cancelada não muda');
            if (s.situacao === 'publicada') {
                // Publicada, a pauta já foi às partes com data, hora e local: só as observações mudam aqui.
                const mudou = (['titulo', 'carater', 'modo', 'data', 'hora', 'local', 'link', 'fim'] as const).filter((k) => (dados![k] || '') !== (s[k] || ''));
                if (mudou.length) {
                    throw new HttpsError('failed-precondition', 'A pauta já foi publicada com estes dados. Para mudar a data, a hora ou o local, cancele a sessão (as partes são avisadas) e marque outra.');
                }
            } else if (dados!.data < hoje) throw new HttpsError('invalid-argument', 'A data da sessão já passou');
            // Sessão virtual (S7): `encerra_em` é o que a rotina diária procura para apurar no dia seguinte ao último.
            const fim = dados!.fim ? { fim: dados!.fim, encerra_em: dados!.fim } : { fim: FieldValue.delete(), encerra_em: FieldValue.delete() };
            tx.update(ref, { ...dados!, ...fim, version: (s.version || 0) + 1, updated_at: FieldValue.serverTimestamp() });
            return { id: ref.id };
        });
    }

    if (p.action === 'sessaoOrdenar') {
        return c.db.runTransaction(async (tx) => {
            const { ref, s } = await lerSessao(c, p.id, tx);
            exigirGere(s.orgao_id);
            if (!s.ativa) throw new HttpsError('failed-precondition', 'Sessão cancelada não muda');
            const ids = (Array.isArray(p.ordem) ? p.ordem : []).map(String);
            tx.update(ref, { pauta: reordenar(s.pauta || [], ids), version: (s.version || 0) + 1, updated_at: FieldValue.serverTimestamp() });
            return { ok: true };
        });
    }

    // Inclui, retira, publica e cancela: mexem nos autos dos processos pautados.
    const avisar: string[] = [];
    let auditoria = null as [string, Record<string, unknown>] | null;
    let avisoMembros = null as ['publicada' | 'cancelada', Sessao, Orgao] | null;
    const resultado = await c.db.runTransaction(async (tx) => {
        avisar.length = 0;
        avisoMembros = null;
        const { orgaos, calendario } = await lerConfig(c, tx);
        const { ref, s } = await lerSessao(c, p.id, tx);
        const o = colegiado(orgaos, s.orgao_id);
        exigirGere(o.id);
        if (!s.ativa) throw new HttpsError('failed-precondition', 'A sessão foi cancelada');
        const pauta = [...(s.pauta || [])];
        const versao = { version: (s.version || 0) + 1, updated_at: FieldValue.serverTimestamp() };

        if (p.action === 'sessaoIncluir') {
            if (pauta.filter((x) => x.situacao === 'pautado').length >= MAX_PAUTA) throw new HttpsError('failed-precondition', `A pauta comporta até ${MAX_PAUTA} processos`);
            const { ref: pref, data: proc } = await lerProcesso(c, p.processo_id, tx);
            const porque = inapto(c, proc, o.id);
            if (porque) throw new HttpsError('failed-precondition', `O processo ${proc.numero} ${porque}`);
            if (pauta.some((x) => x.processo_id === pref.id && x.situacao === 'pautado')) throw new HttpsError('already-exists', 'O processo já está nesta pauta');
            // Um processo, uma pauta ativa por vez.
            const outras = await tx.get(c.db.collection(COL_SESSOES).where('organization_id', '==', c.orgId).where('orgao_id', '==', o.id).where('ativa', '==', true));
            const outra = outras.docs.find((d) => d.id !== ref.id && ((d.data().pauta || []) as ItemPauta[]).some((x) => x.processo_id === pref.id && x.situacao === 'pautado'));
            if (outra || (proc.sessao && proc.sessao.id !== ref.id)) {
                throw new HttpsError('failed-precondition', `O processo ${proc.numero} já está na pauta da ${outra?.data().titulo || proc.sessao?.titulo}. Retire de lá antes.`);
            }
            // Com vista no prazo, o processo espera a devolução; vencido o prazo, a secretaria o requisita incluindo-o (CPC, art. 940, § 1º).
            const vista = proc.vista as { nomes?: string[]; prazo?: string } | undefined;
            if (vista?.prazo && vista.prazo >= hoje) {
                throw new HttpsError('failed-precondition', `O processo ${proc.numero} está com vista para ${(vista.nomes || []).join(', ')} até ${vista.prazo.split('-').reverse().join('/')}. Ele volta à pauta com a devolução, ou depois do prazo.`);
            }
            const publicada = s.situacao === 'publicada';
            const inclusao = publicada ? (p.inclusao === 'mesa' ? 'mesa' : 'extrapauta') : 'pauta';
            if (publicada) {
                exigirMotivo('da inclusão depois da publicação');
                if (s.data < hoje) throw new HttpsError('failed-precondition', 'A sessão já passou');
            }
            const cont = await lerContinuacao(tx, c, pref.id, proc);
            const patch = incluirNaSessao(tx, c, { ref, s: { ...s, pauta } }, o, pref, proc, inclusao, publicada ? motivo : '', cont);
            if (publicada) {
                tx.update(pref, patch);
                avisar.push(pref.id);
            }
            auditoria = ['SECRETARIA_SESSAO_PAUTA_INCLUIDA', { sessao_id: ref.id, processo_id: pref.id, numero: String(proc.numero || ''), inclusao }];
            return { ok: true };
        }

        if (p.action === 'sessaoTirar') {
            const pid = String(p.processo_id || '');
            const k = pauta.findIndex((x) => x.processo_id === pid && x.situacao === 'pautado');
            if (k < 0) throw new HttpsError('not-found', 'O processo não está nesta pauta');
            if (s.situacao === 'rascunho') {
                tx.update(ref, { pauta: reordenar(pauta.filter((_, i) => i !== k), []), ...versao });
                return { ok: true };
            }
            exigirMotivo('da retirada');
            const pref = c.db.collection(COL.processos).doc(pid);
            const proc = (await tx.get(pref)).data();
            if (proc && proc.sessao?.id === ref.id) {
                const mov = registrarMovimento(tx, c, pref, proc, 'pauta_retirada', textoDaRetirada(s, motivo), { sessao_id: ref.id });
                tx.update(pref, { ...mov, sessao: FieldValue.delete() });
                avisar.push(pid);
            }
            pauta[k] = { ...pauta[k], situacao: 'retirado', motivo };
            tx.update(ref, { pauta, ...versao });
            auditoria = ['SECRETARIA_SESSAO_PAUTA_RETIRADA', { sessao_id: ref.id, processo_id: pid, numero: pauta[k].numero, motivo }];
            return { ok: true };
        }

        if (p.action === 'sessaoPublicar') {
            if (s.situacao !== 'rascunho') throw new HttpsError('failed-precondition', 'A pauta já foi publicada');
            const itens = pauta.filter((x) => x.situacao === 'pautado');
            if (!itens.length) throw new HttpsError('failed-precondition', 'Inclua ao menos um processo na pauta antes de publicar');
            const problema = problemaDaAntecedencia(hoje, s.data, o.pauta, calendario);
            if (problema) throw new HttpsError('failed-precondition', problema);
            const refs = itens.map((x) => c.db.collection(COL.processos).doc(x.processo_id));
            const procs = await tx.getAll(...refs);
            procs.forEach((snap, i) => {
                const d = snap.data();
                const porque = !d || d.status === 'excluido' ? 'não existe mais' : inapto(c, d, o.id)
                    || (d.sessao && d.sessao.id !== ref.id ? `já está na pauta da ${d.sessao.titulo}` : '');
                if (porque) throw new HttpsError('failed-precondition', `O processo ${itens[i].numero} ${porque}. Tire da pauta antes de publicar.`);
            });
            procs.forEach((snap, i) => {
                const mov = registrarMovimento(tx, c, refs[i], snap.data()!, 'pauta', textoDaInclusao(s, o.nome, itens[i]), { sessao_id: ref.id, inclusao: 'pauta' });
                // O julgamento que vinha de outra sessão continua nesta (a votação foi trazida na inclusão).
                tx.update(refs[i], { ...mov, sessao: marcaNoProcesso(ref.id, s, o, itens[i]), julgamento_em_curso: FieldValue.delete(), vista: FieldValue.delete() });
                avisar.push(refs[i].id);
            });
            tx.update(ref, { situacao: 'publicada', publicada_em: new Date().toISOString(), publicada_por: quem.uid, publicada_por_nome: quem.nome, ...versao });
            auditoria = ['SECRETARIA_SESSAO_PUBLICADA', { sessao_id: ref.id, orgao_id: o.id, data: s.data, processos: itens.length }];
            avisoMembros = ['publicada', s, o];
            return { ok: true, processos: itens.length };
        }

        if (p.action === 'sessaoCancelar') {
            exigirMotivo('do cancelamento');
            if (s.situacao === 'publicada') {
                const itens = pauta.filter((x) => x.situacao === 'pautado');
                const refs = itens.map((x) => c.db.collection(COL.processos).doc(x.processo_id));
                const procs = refs.length ? await tx.getAll(...refs) : [];
                procs.forEach((snap, i) => {
                    const d = snap.data();
                    if (!d || d.sessao?.id !== ref.id) return;
                    const mov = registrarMovimento(tx, c, refs[i], d, 'pauta_retirada', textoDaRetirada(s, motivo, true), { sessao_id: ref.id, cancelada: true });
                    tx.update(refs[i], { ...mov, sessao: FieldValue.delete() });
                    avisar.push(refs[i].id);
                });
            }
            tx.update(ref, { situacao: 'cancelada', ativa: false, encerra_em: FieldValue.delete(), cancelada_em: new Date().toISOString(), cancelada_por_nome: quem.nome, motivo_cancelamento: motivo, ...versao });
            auditoria = ['SECRETARIA_SESSAO_CANCELADA', { sessao_id: ref.id, orgao_id: o.id, data: s.data, motivo }];
            // Rascunho cancelado: a composição nem sabia da sessão.
            if (s.situacao === 'publicada') avisoMembros = ['cancelada', { ...s, motivo_cancelamento: motivo }, o];
            return { ok: true };
        }

        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    });
    if (auditoria) await auditar(c.db, c.orgId, quem.uid, quem.nome, auditoria[0], auditoria[1]);
    // E-mail às partes depois da transação: falha de envio não desfaz o ato.
    await Promise.all(avisar.map((id) => avisarPartesDoMovimento(c.db, id, quem.uid).catch(() => undefined)));
    // S8: e a composição do colegiado, pelo sino e pelo e-mail.
    const am = avisoMembros as ['publicada' | 'cancelada', Sessao, Orgao] | null;
    if (am) await avisarComposicao(c.db, c.orgId, String(p.id), am[1], am[2], am[0], undefined, quem.uid);
    return resultado;
}
