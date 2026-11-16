/**
 * Julgamento da disputa de preços (S13): depois dos lances (ou da abertura,
 * sem lances), cada item ou lote passa por desempate de ME/EPP, análise da
 * proposta, negociação, convocação da proposta ajustada e dos documentos,
 * aceitação e habilitação (com recusa motivada e chamada do próximo). Com
 * tudo decidido, o órgão declara o vencedor e abre a intenção de recurso
 * (razões e contrarrazões em 3 dias úteis cada, decisão); por fim, registra o
 * resultado (homologada, deserta ou fracassada), a ata vai aos autos e a ação
 * do rito se cumpre sozinha, como o julgamento proclamado na sessão.
 *
 * O estado mora em `secCertames/{id}/sala/julgamento`. Cada ato do órgão
 * deixa aviso na conversa da sala (todos os licitantes leem) e os atos que
 * decidem (vencedor, recurso, resultado) entram nos autos. Antes de declarado
 * o vencedor, o licitante vê os outros por apelido.
 *
 * Órgão (secretariaProcesso): certameJulgamento (abre e lê), certameDesempate,
 *   certameNegociar, certameConvocar, certameArquivo, certameAceitar,
 *   certameRecusar, certameHabilitar, certameReabrir, certameDeclarar,
 *   certameDecidirRecurso, certameResultado.
 * Fornecedor (secretariaPortal): disputaJulgamento, disputaDesempate,
 *   disputaNegociar, disputaEnviarArquivo, disputaIntencao, disputaRazoes,
 *   disputaContrarrazoes.
 */
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import { CalendarioOrgao, MAX_UPLOAD_BYTES, hojeBrasil, sanitizeCalendario, texto } from '../shared/secretaria';
import {
    ETAPAS_JULGAMENTO, EtapaJulgamento, HORAS_CONVOCACAO, MAX_ARQUIVOS_CONVOCACAO, MINUTOS_DESEMPATE, MINUTOS_INTENCAO, PERFIS_DISPUTA, PROVIMENTOS,
    Posicao, Proposta, Recurso, SITUACOES_JULGAMENTO, UnidadeJulgamento, abrirUnidade, aplicarDesempate, fimDoDesempate, fimDoPrazoUtil,
    julgamentoConcluido, linhaDaUnidade, momentoDoRecurso, num, ofertaMelhor, ordenarPosicoes, posicaoDe, proximaVez, proximoDoDesempate,
    resultadoDaDisputa, textoDaAta, totalDoValor, unidadesDeDisputa, valorTexto, AtoDaDisputa, podeNaDisputa, podeObservar,
} from '../shared/certames';
import { auditar } from './config';
import { COL, Contexto, lerProcesso, registrarMovimento } from './context';
import { Mensagem, exigirAto, lerEstado } from './salaLances';
import { avisarPorEmail } from './certames';
import type { Certame, CertameNoProcesso } from './certames';
import { registrarResultadoDaDisputa } from './processos';

type Payload = Record<string, unknown>;
type Db = admin.firestore.Firestore;
type Ref = admin.firestore.DocumentReference;
type Tx = admin.firestore.Transaction;

export interface Julgamento {
    etapa: EtapaJulgamento;
    unidades: Record<string, UnidadeJulgamento>;
    /** Quem propôs: nome, documento, porte e apelido da sala (cópia da proposta na abertura do julgamento). */
    licitantes: Record<string, { nome: string; documento: string; porte: 'me_epp' | 'demais'; apelido: number }>;
    recurso?: Recurso;
    recursos_anteriores: Recurso[];
    lances: number;
    aberto_em: string;
    resultado?: string;
    ata?: string;
}

export const ACOES_JULGAMENTO_ORGAO = ['certameJulgamento', 'certameDesempate', 'certameNegociar', 'certameConvocar', 'certameArquivo', 'certameAceitar',
    'certameRecusar', 'certameHabilitar', 'certameReabrir', 'certameDeclarar', 'certameDecidirRecurso', 'certameResultado'];
export const ACOES_JULGAMENTO_FORNECEDOR = ['disputaJulgamento', 'disputaDesempate', 'disputaNegociar', 'disputaEnviarArquivo', 'disputaIntencao', 'disputaRazoes', 'disputaContrarrazoes'];

const TIPOS_ARQUIVO: Record<string, string> = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
const agora = () => new Date().toISOString();
const jref = (ref: Ref) => ref.collection('sala').doc('julgamento');
const quando = (iso: string) => {
    const d = new Date(Date.parse(iso) - 3 * 3600e3).toISOString();
    return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}, às ${d.slice(11, 16)}`;
};
const apelido = (j: Julgamento, uid: string) => `Licitante ${j.licitantes[uid]?.apelido || '?'}`;
const declarado = (j: Julgamento) => !!j.recurso || j.etapa === 'encerrado' || j.recursos_anteriores.length > 0;
const nomeComApelido = (j: Julgamento, uid: string) => `${j.licitantes[uid]?.nome || '?'} (${apelido(j, uid)})`;

function exigirJulgavel(x: Certame | undefined, quando0 = agora()) {
    if (!x || (x.situacao !== 'publicado' && x.situacao !== 'encerrado')) throw new HttpsError('failed-precondition', 'A disputa não está em curso');
    if (!x.abertura_em || x.abertura_em > quando0) throw new HttpsError('failed-precondition', 'O julgamento começa depois da abertura');
    const fim = x.lances ? Date.parse(x.abertura_em) + x.horas_lances * 3600e3 : 0;
    if (x.situacao === 'publicado' && fim && Date.parse(quando0) < fim) throw new HttpsError('failed-precondition', 'Os lances ainda estão em curso: o julgamento começa no fim');
}

/** Monta o julgamento das posições finais (sala de lances) ou das propostas (sem lances). Só leituras. */
async function montar(db: Db, ref: Ref, x: Certame, tx: Tx): Promise<Julgamento> {
    const ps = await tx.get(ref.collection('propostas'));
    const props = ps.docs.map((d) => ({ uid: d.id, p: d.data() as Proposta })).sort((a, b) => a.p.enviada_em.localeCompare(b.p.enviada_em));
    let posicoes: Record<string, Posicao[]>;
    let apelidos: Record<string, number>;
    let lances = 0;
    if (x.lances) {
        const { estado } = await lerEstado(db, ref, x, tx);
        ({ posicoes, apelidos } = estado);
        lances = estado.seq;
    } else {
        posicoes = Object.fromEntries(unidadesDeDisputa(x).map((u) => [u.chave,
            ordenarPosicoes(props.map(({ uid, p }) => posicaoDe(uid, p, u, x, [])).filter((v): v is Posicao => !!v), x)]));
        apelidos = Object.fromEntries(props.map(({ uid }, i) => [uid, i + 1]));
    }
    const licitantes = Object.fromEntries(props.map(({ uid, p }) => [uid, { nome: p.licitante.razao_social, documento: p.licitante.documento, porte: p.licitante.porte, apelido: apelidos[uid] || 0 }]));
    const unidades = Object.fromEntries(unidadesDeDisputa(x).map((u) => [u.chave,
        abrirUnidade((posicoes[u.chave] || []).map((v) => ({ uid: v.uid, valor: v.valor, total: v.total, em: v.em, porte: licitantes[v.uid]?.porte || 'demais' })), x)]));
    return { etapa: 'julgamento', unidades, licitantes, recursos_anteriores: [], lances, aberto_em: agora() };
}

/** Sem intenção de recurso no prazo, o julgamento segue ao resultado. Devolve se mudou. */
function atualizarEtapa(j: Julgamento, t: string): boolean {
    if (j.etapa === 'recurso' && j.recurso && momentoDoRecurso(j.recurso, t) === 'sem_recurso') { j.etapa = 'resultado'; return true; }
    return false;
}

function unidadeDe(j: Julgamento, x: Certame, chave: unknown) {
    const u0 = unidadesDeDisputa(x).find((v) => v.chave === chave);
    const u = u0 && j.unidades[u0.chave];
    if (!u0 || !u) throw new HttpsError('invalid-argument', 'Item ou lote inexistente');
    return { u0, u };
}

const semPath = (u: UnidadeJulgamento['convocacao']) => (u ? { ...u, arquivos: u.arquivos.map(({ path: _p, ...a }) => a) } : undefined);

// ─── Órgão ─────────────────────────────────────────────────────────────────

type Classificar = (c: Contexto, pref: Ref, id: string, x: Certame) => Promise<unknown>;

export async function acaoJulgamentoOrgao(c: Contexto, p: Payload, classificar: Classificar): Promise<unknown> {
    const db = c.db;
    const col = db.collection('secCertames');
    const idDe = (data: admin.firestore.DocumentData) => ((data.certame || data.ultimo_certame) as CertameNoProcesso | undefined)?.id || null;

    if (p.action === 'certameJulgamento' || p.action === 'certameArquivo') {
        const { ref: pref, data } = await lerProcesso(c, p.processo_id, undefined, { equipe: true });
        const id = idDe(data);
        if (!id) throw new HttpsError('not-found', 'Disputa não encontrada');
        const ref = col.doc(id);
        const x = (await ref.get()).data() as Certame | undefined;
        exigirJulgavel(x);
        if (p.action === 'certameArquivo') {
            const j = (await jref(ref).get()).data() as Julgamento | undefined;
            if (!j) throw new HttpsError('not-found', 'Arquivo não encontrado');
            const { u } = unidadeDe(j, x!, p.chave);
            const a = u.convocacao?.arquivos.find((v) => v.id === p.arquivo_id);
            if (!a) throw new HttpsError('not-found', 'Arquivo não encontrado');
            const [buf] = await admin.storage().bucket().file(a.path).download();
            return { base64: buf.toString('base64'), nome: a.nome, mime: a.mime };
        }
        // Primeiro acesso depois dos lances: o encerramento vai aos autos (como na classificação).
        if (x!.lances && x!.situacao === 'publicado' && !(await jref(ref).get()).exists) await classificar(c, pref, id, x!);
        const posse = c.ctx.unidadeIds.includes(data.unidade_atual);
        const pode = (ato: AtoDaDisputa) => podeNaDisputa(x!.equipe, c.ctx.uid, posse, ato);
        const atos = { conduzir: pode('conduzir'), conversar: pode('conversar'), homologar: pode('homologar') };
        return db.runTransaction(async (tx) => {
            const [js, ms] = await Promise.all([tx.get(jref(ref)), tx.get(ref.collection('mensagens').orderBy('em', 'desc').limit(200))]);
            let j = js.data() as Julgamento | undefined;
            const novo = !j;
            if (!j) j = await montar(db, ref, x!, tx);
            const t = agora();
            if ((atualizarEtapa(j, t) || novo) && (posse || atos.conduzir)) tx.set(jref(ref), j);
            return vistaOrgao(x!, j, ms.docs.map((d) => ({ id: d.id, ...(d.data() as Mensagem) })), atos, t);
        });
    }

    let email: { uids: string[]; assunto: string; corpo: string } | null = null;
    let fechar = false;
    let procId = '';
    const r = await db.runTransaction(async (tx) => {
        const { ref: pref, data } = await lerProcesso(c, p.processo_id, tx, { equipe: true });
        procId = pref.id;
        const atual = (data.certame || data.ultimo_certame) as CertameNoProcesso | undefined;
        if (!atual) throw new HttpsError('not-found', 'Disputa não encontrada');
        const ref = col.doc(atual.id);
        const [xs, js] = await Promise.all([tx.get(ref), tx.get(jref(ref))]);
        const x = xs.data() as Certame | undefined;
        const t = agora();
        exigirJulgavel(x, t);
        const j = js.data() as Julgamento | undefined;
        if (!j) throw new HttpsError('failed-precondition', 'Abra o julgamento antes');
        if (j.etapa === 'encerrado') throw new HttpsError('failed-precondition', 'A disputa já tem resultado');
        atualizarEtapa(j, t);
        // S14: o resultado e o recurso encaminhado são da autoridade superior; o resto, de quem conduz.
        const ato: AtoDaDisputa = p.action === 'certameResultado' || (p.action === 'certameDecidirRecurso' && !!j.recurso && momentoDoRecurso(j.recurso, t) === 'autoridade') ? 'homologar' : 'conduzir';
        exigirAto(x!, c.ctx.uid, c.ctx.unidadeIds.includes(data.unidade_atual), ato);
        const cal = sanitizeCalendario((await tx.get(db.collection(COL.config).doc(c.orgId))).data()?.calendario) as CalendarioOrgao;
        const avisos: string[] = [];
        let mov: { tipo: string; texto: string } | null = null;
        let extraProc: Record<string, unknown> = {};
        let auditoria = '';
        const todos = Object.keys(j.licitantes);
        const exigirJulgamento = () => { if (j.etapa !== 'julgamento') throw new HttpsError('failed-precondition', 'O vencedor já foi declarado: o julgamento só se refaz se o recurso for provido'); };

        if (['certameDesempate', 'certameNegociar', 'certameConvocar', 'certameAceitar', 'certameRecusar', 'certameHabilitar', 'certameReabrir'].includes(String(p.action))) {
            exigirJulgamento();
            const { u0, u } = unidadeDe(j, x!, p.chave);
            const nome = u0.nome;

            if (p.action === 'certameDesempate') {
                if (u.situacao !== 'desempate' || !u.desempate) throw new HttpsError('failed-precondition', 'Não há desempate pendente neste item ou lote');
                const at = u.desempate.atual;
                if (at && !at.recusou && t <= at.ate) throw new HttpsError('failed-precondition', `Aguarde: ${apelido(j, at.uid)} tem até ${quando(at.ate).split(', às ')[1]} para a oferta`);
                if (at && !u.desempate.feitos.includes(at.uid)) u.desempate.feitos.push(at.uid);
                const prox = proximoDoDesempate(u);
                if (prox) {
                    u.desempate.atual = { uid: prox, ate: new Date(Date.parse(t) + MINUTOS_DESEMPATE * 60e3).toISOString() };
                    avisos.push(`Empate ficto em ${nome}: ${apelido(j, prox)} (ME/EPP) pode, em até ${MINUTOS_DESEMPATE} minutos, oferecer ${x!.criterio === 'maior_desconto' ? 'desconto maior' : 'valor menor'} que ${valorTexto(u.ordem[0].total, x!)}, pela própria disputa.`);
                    email = { uids: [prox], assunto: `Desempate: ${x!.objeto.slice(0, 60)}`, corpo: `Você está em empate ficto (ME/EPP) em ${nome} da disputa do processo ${x!.processo_numero} e tem ${MINUTOS_DESEMPATE} minutos para cobrir a melhor oferta. Abra a disputa agora.` };
                } else {
                    j.unidades[u0.chave] = fimDoDesempate(u);
                    avisos.push(`Desempate encerrado em ${nome} sem oferta melhor: segue em análise a proposta de ${apelido(j, j.unidades[u0.chave].vez!)}.`);
                }
            }

            if (p.action === 'certameNegociar') {
                if (u.situacao !== 'analise' || !u.vez) throw new HttpsError('failed-precondition', 'Negocia-se com quem está em análise');
                const msg = texto(p.texto, 1000);
                if (msg.length < 5) throw new HttpsError('invalid-argument', 'Escreva a contraproposta (ao menos 5 letras)');
                u.negociacao = { uid: u.vez, desde: t };
                avisos.push(`Negociação em ${nome} com ${apelido(j, u.vez)}: ${msg}`);
                email = { uids: [u.vez], assunto: `Negociação: ${x!.objeto.slice(0, 60)}`, corpo: `O órgão abriu negociação em ${nome} da disputa do processo ${x!.processo_numero}: ${msg}` };
            }

            if (p.action === 'certameConvocar') {
                if (!['analise', 'aceita'].includes(u.situacao) || !u.vez) throw new HttpsError('failed-precondition', 'Convoca-se quem está em análise');
                const o_que = p.o_que === 'documentos' ? 'documentos' : 'proposta';
                const horas = Math.round(num(p.horas));
                if (!(horas >= HORAS_CONVOCACAO[0] && horas <= HORAS_CONVOCACAO[1])) throw new HttpsError('invalid-argument', `O prazo é de ${HORAS_CONVOCACAO[0]} a ${HORAS_CONVOCACAO[1]} horas`);
                const ate = new Date(Date.parse(t) + horas * 3600e3).toISOString();
                const antes = u.convocacao?.uid === u.vez ? u.convocacao.arquivos : [];
                u.convocacao = { uid: u.vez, o_que, ate, em: t, arquivos: antes };
                const oque = o_que === 'proposta' ? 'a proposta ajustada ao valor final' : 'os documentos de habilitação';
                avisos.push(`${apelido(j, u.vez)}: envie ${oque} de ${nome} até ${quando(ate)}, pela própria disputa.`);
                email = { uids: [u.vez], assunto: `Envie ${o_que === 'proposta' ? 'a proposta ajustada' : 'os documentos'}: ${x!.objeto.slice(0, 50)}`, corpo: `O órgão pede ${oque} de ${nome} da disputa do processo ${x!.processo_numero} até ${quando(ate)} (horário de Brasília).` };
            }

            if (p.action === 'certameAceitar') {
                if (u.situacao !== 'analise' || !u.vez) throw new HttpsError('failed-precondition', 'Não há proposta em análise neste item ou lote');
                const c0 = u.ordem.find((v) => v.uid === u.vez)!;
                u.situacao = 'aceita';
                u.aceita = { uid: u.vez, total: c0.total, em: t, por: c.userName };
                delete u.negociacao;
                avisos.push(`Aceita em ${nome} a proposta de ${apelido(j, u.vez)} (${valorTexto(c0.total, x!)}). Segue a análise da habilitação.`);
            }

            if (p.action === 'certameRecusar') {
                if (!['analise', 'aceita'].includes(u.situacao) || !u.vez) throw new HttpsError('failed-precondition', 'Não há proposta em análise neste item ou lote');
                const motivo = texto(p.motivo, 2000);
                if (motivo.length < 10) throw new HttpsError('invalid-argument', 'Diga o motivo (ao menos 10 letras): ele vai à conversa e à ata');
                const etapa = u.situacao === 'analise' ? 'proposta' : 'habilitacao';
                const saiu = u.vez;
                u.recusas.push({ uid: saiu, etapa, motivo, em: t, por: c.userName });
                delete u.aceita; delete u.negociacao; delete u.convocacao;
                // ponytail: não refaz o empate ficto para o novo primeiro; se a lei local pedir, chamar abrirUnidade de novo aqui.
                const prox = proximaVez(u);
                u.vez = prox;
                u.situacao = prox ? 'analise' : 'fracassada';
                avisos.push(`${etapa === 'proposta' ? 'Recusada a proposta' : 'Inabilitado'} em ${nome}: ${apelido(j, saiu)}. Motivo: ${motivo.replace(/[.\s]+$/, '')}. ${prox ? `Segue em análise a proposta de ${apelido(j, prox)}, próxima classificada.` : `${nome} fracassou: não há outra proposta.`}`);
                auditoria = 'SECRETARIA_SESSAO_PROPOSTA_RECUSADA';
            }

            if (p.action === 'certameHabilitar') {
                if (u.situacao !== 'aceita' || !u.aceita) throw new HttpsError('failed-precondition', 'Habilita-se depois de aceitar a proposta');
                u.situacao = 'habilitada';
                u.habilitada = { uid: u.aceita.uid, total: u.ordem.find((v) => v.uid === u.aceita!.uid)!.total, em: t, por: c.userName };
                u.vez = null;
                avisos.push(`Habilitado em ${nome}: ${apelido(j, u.habilitada.uid)}.`);
            }

            if (p.action === 'certameReabrir') {
                const motivo = texto(p.motivo, 2000);
                if (motivo.length < 10) throw new HttpsError('invalid-argument', 'Diga o motivo da reabertura (ao menos 10 letras)');
                const alvo = u.ordem.find((v) => v.uid === p.uid);
                if (!alvo) throw new HttpsError('invalid-argument', 'Licitante sem proposta neste item ou lote');
                u.recusas = u.recusas.filter((v) => v.uid !== alvo.uid);
                delete u.aceita; delete u.habilitada; delete u.negociacao; delete u.desempate;
                if (u.convocacao?.uid !== alvo.uid) delete u.convocacao;
                u.situacao = 'analise';
                u.vez = alvo.uid;
                avisos.push(`Reaberto o julgamento de ${nome}: volta à análise a proposta de ${apelido(j, alvo.uid)}. Motivo: ${motivo.replace(/[.\s]+$/, '')}.`);
                auditoria = 'SECRETARIA_SESSAO_JULGAMENTO_REABERTO';
            }
        }

        const us = unidadesDeDisputa(x!).map((u0) => ({ nome: u0.nome, u: j.unidades[u0.chave] }));
        const quem = (uid: string) => j.licitantes[uid]?.nome || apelido(j, uid);
        const linhas = () => us.map(({ nome, u }) => linhaDaUnidade(nome, u, quem, x!)).join('\n');

        if (p.action === 'certameDeclarar') {
            exigirJulgamento();
            if (!julgamentoConcluido(us.map((v) => v.u))) throw new HttpsError('failed-precondition', 'Decida antes todos os itens ou lotes (habilitado, fracassado ou deserto)');
            if (us.every((v) => v.u.situacao === 'deserta')) throw new HttpsError('failed-precondition', 'Ninguém propôs: registre o resultado (deserta) direto');
            const minutos = Math.round(num(p.minutos ?? MINUTOS_INTENCAO[0]));
            if (!(minutos >= MINUTOS_INTENCAO[0] && minutos <= MINUTOS_INTENCAO[1])) throw new HttpsError('invalid-argument', `A intenção de recurso fica aberta de ${MINUTOS_INTENCAO[0]} a ${MINUTOS_INTENCAO[1]} minutos`);
            if (j.recurso) j.recursos_anteriores.push(j.recurso);
            const razoes_ate = fimDoPrazoUtil(hojeBrasil(), 3, cal);
            j.recurso = {
                declarado_em: t, intencao_ate: new Date(Date.parse(t) + minutos * 60e3).toISOString(), razoes_ate,
                contrarrazoes_ate: fimDoPrazoUtil(hojeBrasil(new Date(razoes_ate)), 3, cal), intencoes: [], contrarrazoes: [],
            };
            j.etapa = 'recurso';
            const txt = `Declarado o resultado do julgamento da ${PERFIS_DISPUTA[x!.perfil].toLowerCase()}:\n${linhas()}\nAberta a intenção de recurso até ${quando(j.recurso.intencao_ate)}; quem manifestar tem até ${quando(razoes_ate)} para as razões, e os demais, até ${quando(j.recurso.contrarrazoes_ate)} para as contrarrazões.`;
            mov = { tipo: 'disputa_vencedor_declarado', texto: txt };
            avisos.push(txt);
            email = { uids: todos, assunto: `Vencedor declarado: ${x!.objeto.slice(0, 60)}`, corpo: `${txt}\nPara manifestar intenção de recurso, abra a disputa dentro do prazo.` };
            auditoria = 'SECRETARIA_SESSAO_VENCEDOR_DECLARADO';
        }

        if (p.action === 'certameDecidirRecurso') {
            const rr = j.recurso;
            const m = rr ? momentoDoRecurso(rr, t) : null;
            if (j.etapa !== 'recurso' || !rr || (m !== 'decisao' && m !== 'autoridade')) throw new HttpsError('failed-precondition', 'O recurso se decide depois do prazo das contrarrazões (ou das razões, se ninguém arrazoou)');
            const provimento = String(p.provimento);
            if (!PROVIMENTOS[provimento]) throw new HttpsError('invalid-argument', 'Escolha a decisão do recurso');
            const fundamentos = texto(p.fundamentos, 20000);
            if (fundamentos.length < 20) throw new HttpsError('invalid-argument', 'Fundamente a decisão (ao menos 20 letras)');
            const disputa = PERFIS_DISPUTA[x!.perfil].toLowerCase();
            const sup = x!.equipe?.autoridade;
            if (m === 'decisao' && provimento === 'nao' && sup) {
                // Lei 14.133/2021, art. 165, § 2º: sem reconsiderar, o agente encaminha à autoridade superior, que decide.
                rr.encaminhado = { fundamentos, em: t, por: c.userName };
                const txt = `Recurso na ${disputa}: ${c.userName} manteve a decisão e encaminhou o recurso à autoridade superior (${sup.nome}). ${fundamentos.replace(/[.\s]+$/, '')}.`;
                mov = { tipo: 'disputa_recurso_encaminhado', texto: txt };
                avisos.push(txt);
                email = { uids: todos, assunto: `Recurso encaminhado: ${x!.objeto.slice(0, 60)}`, corpo: txt };
                auditoria = 'SECRETARIA_SESSAO_RECURSO_ENCAMINHADO';
            } else {
                rr.decisao = { provimento: provimento as 'nao', fundamentos, em: t, por: c.userName };
                j.etapa = provimento === 'nao' ? 'resultado' : 'julgamento';
                const quemDecide = m === 'autoridade' ? ' (decisão da autoridade superior)' : sup ? ' (reconsideração)' : '';
                const txt = `Recurso na ${disputa}${quemDecide}: ${PROVIMENTOS[provimento]}. ${fundamentos.replace(/[.\s]+$/, '')}.${provimento === 'nao' ? '' : ' O julgamento se refaz no que o recurso alcançou e o vencedor é declarado de novo.'}`;
                mov = { tipo: 'disputa_recurso_decidido', texto: txt };
                avisos.push(txt);
                email = { uids: todos, assunto: `Recurso decidido: ${x!.objeto.slice(0, 60)}`, corpo: txt };
                auditoria = 'SECRETARIA_SESSAO_RECURSO_DECIDIDO';
            }
        }

        if (p.action === 'certameResultado') {
            const desertas = us.every((v) => v.u.situacao === 'deserta');
            if (!(j.etapa === 'resultado' || (j.etapa === 'julgamento' && desertas))) {
                throw new HttpsError('failed-precondition', j.etapa === 'recurso' ? 'Aguarde o fim do prazo de recurso (ou decida o recurso)' : 'Declare antes o vencedor (com a intenção de recurso)');
            }
            const resultado = resultadoDaDisputa(us.map((v) => v.u));
            const rodadas = [...j.recursos_anteriores, ...(j.recurso ? [j.recurso] : [])];
            const ata = textoDaAta(x!, us, quem, rodadas, resultado, j.lances);
            j.etapa = 'encerrado';
            j.resultado = resultado;
            j.ata = ata;
            const ato = resultado === 'Homologada' ? 'Adjudicado o objeto e homologada a disputa' : `Declarada ${resultado.toLowerCase()} a disputa`;
            mov = { tipo: 'disputa_resultado', texto: `${ato}.\n\n${ata}` };
            avisos.push(`${ato}. A ata está nos autos.`);
            const resumo = us.map(({ nome, u }) => linhaDaUnidade(nome, u, quem, x!)).join('; ');
            extraProc = { [data.certame ? 'certame' : 'ultimo_certame']: { ...atual, situacao: 'encerrado', resultado, resumo } };
            tx.update(ref, { situacao: 'encerrado', resultado, encerrado_em: t, version: (x!.version || 0) + 1 });
            email = { uids: todos, assunto: `Resultado: ${x!.objeto.slice(0, 60)}`, corpo: `${ato}.\n${resumo}` };
            auditoria = 'SECRETARIA_SESSAO_DISPUTA_RESULTADO';
            fechar = !!data.certame;
        }

        if (!avisos.length && !mov) throw new HttpsError('invalid-argument', 'Ação desconhecida');
        tx.set(jref(ref), j);
        for (const a of avisos) tx.set(ref.collection('mensagens').doc(), { de: 'agente', nome: c.userName, texto: a, em: t, aviso: true } as Mensagem);
        if (mov) {
            const m = registrarMovimento(tx, c, pref, data, mov.tipo, mov.texto, { certame_id: ref.id });
            tx.update(pref, { ...m, ...extraProc });
        }
        return { ok: true, etapa: j.etapa, resultado: j.resultado, auditoria, certame_id: ref.id };
    });
    const { auditoria, certame_id, ...resto } = r as { auditoria: string; certame_id: string } & Record<string, unknown>;
    if (auditoria) await auditar(db, c.orgId, c.ctx.uid, c.userName, auditoria, { processo_id: p.processo_id });
    const e = email as { uids: string[]; assunto: string; corpo: string } | null;
    if (e) void avisarPorEmail(db, certame_id, e.uids, e.assunto, e.corpo);
    // O resultado cumpre a ação do rito (certidão, saída da fase e avanço automático, como no julgamento da sessão).
    if (fechar) return { ...resto, aviso_acao: await registrarResultadoDaDisputa(db, c.orgId, procId, c.userName) };
    return resto;
}

function vistaOrgao(x: Certame, j: Julgamento, msgs: Array<Mensagem & { id: string }>, atos: Record<AtoDaDisputa, boolean>, t: string) {
    const nome = (uid: string | null | undefined) => (uid ? nomeComApelido(j, uid) : null);
    const us = unidadesDeDisputa(x).map((u0) => ({ u0, u: j.unidades[u0.chave] }));
    const momento = j.recurso ? momentoDoRecurso(j.recurso, t) : null;
    const aberto = j.etapa !== 'encerrado';
    const gerir = atos.conduzir && aberto;
    const homologa = atos.homologar && aberto;
    const desertas = us.every((v) => v.u.situacao === 'deserta');
    return {
        etapa: j.etapa, etapa_nome: ETAPAS_JULGAMENTO[j.etapa], criterio: x.criterio, perfil: x.perfil, lances: j.lances, agora: t, resultado: j.resultado || null, ata: j.ata || null,
        unidades: us.map(({ u0, u }) => ({
            chave: u0.chave, nome: u0.nome, situacao: u.situacao, situacao_nome: SITUACOES_JULGAMENTO[u.situacao], vez: u.vez, vez_nome: nome(u.vez),
            ordem: u.ordem.map((v) => ({ ...v, nome: j.licitantes[v.uid]?.nome || '?', apelido: apelido(j, v.uid), documento: j.licitantes[v.uid]?.documento || '', recusa: u.recusas.find((r) => r.uid === v.uid) || null })),
            desempate: u.desempate ? {
                atual: u.desempate.atual ? { ...u.desempate.atual, nome: nome(u.desempate.atual.uid), vencido: t > u.desempate.atual.ate } : null,
                proximo: nome(u.desempate.candidatos.find((v) => !u.desempate!.feitos.includes(v) && v !== u.desempate!.atual?.uid)),
                candidatos: u.desempate.candidatos.map((v) => nome(v)),
            } : null,
            negociacao: u.negociacao || null, convocacao: semPath(u.convocacao) || null, aceita: u.aceita || null, habilitada: u.habilitada || null, recusas: u.recusas,
        })),
        recurso: j.recurso ? { ...j.recurso, momento } : null,
        recursos_anteriores: j.recursos_anteriores,
        mensagens: msgs.map((m) => ({ id: m.id, de: m.de, nome: m.de === 'licitante' && m.uid ? nome(m.uid) : m.nome, texto: m.texto, em: m.em, aviso: m.aviso })).reverse(),
        pode: {
            gerir: gerir && j.etapa === 'julgamento',
            conversar: atos.conversar && aberto && x.situacao === 'publicado',
            declarar: gerir && j.etapa === 'julgamento' && julgamentoConcluido(us.map((v) => v.u)) && !desertas,
            decidir: j.etapa === 'recurso' && ((gerir && momento === 'decisao') || (homologa && momento === 'autoridade')),
            // Com autoridade superior, o "não" do agente encaminha o recurso em vez de decidi-lo.
            encaminha: gerir && j.etapa === 'recurso' && momento === 'decisao' && !!x.equipe?.autoridade,
            resultado: homologa && (j.etapa === 'resultado' || (j.etapa === 'julgamento' && desertas)),
        },
        equipe: x.equipe || null,
    };
}

// ─── Fornecedor ────────────────────────────────────────────────────────────

type LerCertame = (db: Db, id: unknown, tx?: Tx) => Promise<{ ref: Ref; x: Certame }>;

export async function acaoJulgamentoFornecedor(db: Db, uid: string, p: Payload, lerCertame: LerCertame): Promise<unknown> {
    if (p.action === 'disputaJulgamento') {
        const { ref, x } = await lerCertame(db, p.certame_id);
        const observador = !(x.fornecedores_uids || []).includes(uid);
        if (!podeObservar(x, uid, agora())) throw new HttpsError('permission-denied', 'Você não participa desta disputa');
        const [js, msgA, msgM] = await Promise.all([
            jref(ref).get(),
            ref.collection('mensagens').where('de', '==', 'agente').get(),
            ref.collection('mensagens').where('uid', '==', uid).get(),
        ]);
        const mensagens = [...msgA.docs, ...msgM.docs].map((d) => { const m = d.data() as Mensagem; return { id: d.id, de: m.de, nome: m.de === 'licitante' ? 'Você' : m.nome, texto: m.texto, em: m.em, aviso: m.aviso }; })
            .sort((a, b) => a.em.localeCompare(b.em)).slice(-150);
        const j = js.data() as Julgamento | undefined;
        const t = agora();
        if (!j) return { etapa: null, mensagens, agora: t, observador };
        atualizarEtapa(j, t);
        return { ...vistaFornecedor(x, j, uid, t, mensagens), observador, ...(observador ? { apelido: null } : {}) };
    }

    if (p.action === 'disputaEnviarArquivo') {
        const mime = String(p.mime || '');
        if (!TIPOS_ARQUIVO[mime]) throw new HttpsError('invalid-argument', 'Anexe PDF, Word (DOCX), PNG ou JPG');
        const buf = Buffer.from(String(p.base64 || ''), 'base64');
        if (!buf.length || buf.length > MAX_UPLOAD_BYTES) throw new HttpsError('invalid-argument', 'Arquivo vazio ou acima de 5 MB');
        const nomeArq = texto(p.nome, 120).replace(/[\\/]/g, '_') || `arquivo.${TIPOS_ARQUIVO[mime]}`;
        // Confere antes de gravar o arquivo; a transação confere de novo e, se falhar, o arquivo sai.
        const { ref, x } = await lerCertame(db, p.certame_id);
        const conferir = (j: Julgamento | undefined) => {
            const { u0, u } = unidadeDe(j || ({ unidades: {} } as Julgamento), x, p.chave);
            const cv = u.convocacao;
            if (!cv || cv.uid !== uid || j!.etapa !== 'julgamento' || !['analise', 'aceita'].includes(u.situacao)) throw new HttpsError('failed-precondition', 'Não há convocação sua para enviar arquivo neste item ou lote');
            if (agora() > cv.ate) throw new HttpsError('deadline-exceeded', 'O prazo da convocação terminou');
            if (cv.arquivos.length >= MAX_ARQUIVOS_CONVOCACAO) throw new HttpsError('resource-exhausted', `Até ${MAX_ARQUIVOS_CONVOCACAO} arquivos por convocação`);
            return { u0, u };
        };
        conferir((await jref(ref).get()).data() as Julgamento | undefined);
        const id = ref.collection('_').doc().id;
        const path = `secretaria/${x.organization_id}/certames/${ref.id}/${uid}/${id}`;
        const arquivo = admin.storage().bucket().file(path);
        await arquivo.save(buf, { contentType: mime, resumable: false });
        try {
            return await db.runTransaction(async (tx) => {
                const j = (await tx.get(jref(ref))).data() as Julgamento | undefined;
                const { u0, u } = conferir(j);
                const t = agora();
                u.convocacao!.arquivos.push({ id, nome: nomeArq, mime, bytes: buf.length, em: t, path });
                tx.set(jref(ref), j!);
                tx.set(ref.collection('mensagens').doc(), { de: 'agente', nome: 'Sistema', texto: `${apelido(j!, uid)} enviou ${nomeArq} em ${u0.nome}.`, em: t, aviso: true } as Mensagem);
                return { ok: true, arquivo: { id, nome: nomeArq, em: t } };
            });
        } catch (e) {
            await arquivo.delete({ ignoreNotFound: true }).catch(() => undefined);
            throw e;
        }
    }

    return db.runTransaction(async (tx) => {
        const { ref, x } = await lerCertame(db, p.certame_id, tx);
        const j = (await tx.get(jref(ref))).data() as Julgamento | undefined;
        const t = agora();
        if (!j || x.situacao !== 'publicado') throw new HttpsError('failed-precondition', 'A disputa não está em julgamento');
        if (!j.licitantes[uid]) throw new HttpsError('permission-denied', 'Só quem enviou proposta participa do julgamento');
        atualizarEtapa(j, t);
        const avisos: string[] = [];
        const eu = apelido(j, uid);

        if (p.action === 'disputaDesempate' || p.action === 'disputaNegociar') {
            if (j.etapa !== 'julgamento') throw new HttpsError('failed-precondition', 'O julgamento já terminou');
            const { u0, u } = unidadeDe(j, x, p.chave);
            if (p.action === 'disputaDesempate') {
                const at = u.desempate?.atual;
                if (u.situacao !== 'desempate' || !at || at.uid !== uid || at.recusou) throw new HttpsError('failed-precondition', 'Você não está convocado para o desempate neste item ou lote');
                if (t > at.ate) throw new HttpsError('deadline-exceeded', 'O prazo do desempate terminou');
                if (p.recusar === true) {
                    at.recusou = true;
                    avisos.push(`${eu} não cobriu a melhor oferta em ${u0.nome}.`);
                } else {
                    const valor = Math.round(num(p.valor) * 10000) / 10000;
                    if (!Number.isFinite(valor) || valor <= 0) throw new HttpsError('invalid-argument', 'Informe o valor da oferta');
                    const novo = aplicarDesempate(u, uid, valor, totalDoValor(valor, u0, x), t, x);
                    if (typeof novo === 'string') throw new HttpsError('invalid-argument', novo);
                    j.unidades[u0.chave] = novo;
                    avisos.push(`${eu} (ME/EPP) cobriu a melhor oferta em ${u0.nome}: ${valorTexto(novo.ordem[0].total, x)}. A proposta passa à análise.`);
                }
            } else {
                if (u.situacao !== 'analise' || u.negociacao?.uid !== uid) throw new HttpsError('failed-precondition', 'Não há negociação aberta com você neste item ou lote');
                const valor = Math.round(num(p.valor) * 10000) / 10000;
                const c0 = u.ordem.find((v) => v.uid === uid)!;
                const total = totalDoValor(valor, u0, x);
                if (!Number.isFinite(valor) || valor <= 0 || !ofertaMelhor(total, c0.total, x)) {
                    throw new HttpsError('invalid-argument', `A nova oferta precisa ser ${x.criterio === 'maior_desconto' ? 'maior' : 'menor'} que a sua atual (${valorTexto(c0.total, x)})`);
                }
                Object.assign(c0, { valor, total, em: t, negociado: true });
                avisos.push(`${eu} melhorou a oferta em ${u0.nome}: ${valorTexto(total, x)}.`);
            }
        }

        if (['disputaIntencao', 'disputaRazoes', 'disputaContrarrazoes'].includes(String(p.action))) {
            const rr = j.recurso;
            if (j.etapa !== 'recurso' || !rr) throw new HttpsError('failed-precondition', 'Não há prazo de recurso aberto');
            const m = momentoDoRecurso(rr, t);
            const nome = j.licitantes[uid].nome;
            const minha = rr.intencoes.find((i) => i.uid === uid);
            if (p.action === 'disputaIntencao') {
                if (m !== 'intencao') throw new HttpsError('deadline-exceeded', 'O prazo da intenção de recurso terminou');
                if (minha) throw new HttpsError('already-exists', 'Você já manifestou intenção de recorrer');
                const motivo = texto(p.motivo, 2000);
                if (motivo.length < 10) throw new HttpsError('invalid-argument', 'Diga, em síntese, contra o que recorre (ao menos 10 letras)');
                rr.intencoes.push({ uid, nome, motivo, em: t });
                avisos.push(`${nome} manifestou intenção de recorrer: ${motivo}`);
            } else {
                const corpo = texto(p.texto, 20000);
                if (corpo.length < 20) throw new HttpsError('invalid-argument', 'Escreva o texto (ao menos 20 letras)');
                if (p.action === 'disputaRazoes') {
                    if (!minha) throw new HttpsError('permission-denied', 'Só apresenta razões quem manifestou intenção de recorrer');
                    if (t > rr.razoes_ate || rr.decisao || rr.encaminhado) throw new HttpsError('deadline-exceeded', 'O prazo das razões terminou');
                    const nova = !minha.razoes;
                    minha.razoes = { texto: corpo, em: t };
                    if (nova) avisos.push(`${nome} apresentou as razões do recurso.`);
                } else {
                    if (!rr.intencoes.length || t <= rr.intencao_ate) throw new HttpsError('failed-precondition', 'As contrarrazões cabem depois de haver intenção de recurso');
                    if (t > rr.contrarrazoes_ate || rr.decisao || m === 'decisao' || m === 'autoridade') throw new HttpsError('deadline-exceeded', 'O prazo das contrarrazões terminou');
                    const k = rr.contrarrazoes.findIndex((v) => v.uid === uid);
                    if (k >= 0) rr.contrarrazoes[k] = { uid, nome, texto: corpo, em: t };
                    else { rr.contrarrazoes.push({ uid, nome, texto: corpo, em: t }); avisos.push(`${nome} apresentou contrarrazões.`); }
                }
            }
        }

        if (!['disputaDesempate', 'disputaNegociar', 'disputaIntencao', 'disputaRazoes', 'disputaContrarrazoes'].includes(String(p.action))) throw new HttpsError('invalid-argument', 'Ação desconhecida');
        tx.set(jref(ref), j);
        for (const a of avisos) tx.set(ref.collection('mensagens').doc(), { de: 'agente', nome: 'Sistema', texto: a, em: t, aviso: true } as Mensagem);
        return { ok: true };
    });
}

function vistaFornecedor(x: Certame, j: Julgamento, uid: string, t: string, mensagens: unknown[]) {
    const pub = declarado(j);
    const quem = (u: string | null | undefined) => (!u ? null : u === uid ? 'Você' : pub ? j.licitantes[u]?.nome || '?' : apelido(j, u));
    const rr = j.recurso;
    const momento = rr ? momentoDoRecurso(rr, t) : null;
    const eu = !!j.licitantes[uid];
    const minha = rr?.intencoes.find((i) => i.uid === uid);
    return {
        etapa: j.etapa, etapa_nome: ETAPAS_JULGAMENTO[j.etapa], criterio: x.criterio, agora: t, apelido: apelido(j, uid), resultado: j.resultado || null, ata: j.ata || null, mensagens,
        unidades: unidadesDeDisputa(x).map((u0) => {
            const u = j.unidades[u0.chave];
            const k = u.ordem.findIndex((v) => v.uid === uid);
            const at = u.desempate?.atual;
            const cv = u.convocacao?.uid === uid ? u.convocacao : null;
            return {
                chave: u0.chave, nome: u0.nome, situacao: u.situacao, situacao_nome: SITUACOES_JULGAMENTO[u.situacao],
                posicao: k >= 0 ? k + 1 : null, meu: k >= 0 ? { valor: u.ordem[k].valor, total: u.ordem[k].total } : null, melhor: u.ordem[0] ? { total: u.ordem[0].total } : null,
                vez: quem(u.vez), vez_sou_eu: u.vez === uid,
                recusa: u.recusas.find((r) => r.uid === uid) || null,
                desempate: at && at.uid === uid && !at.recusou && t <= at.ate ? { ate: at.ate, alvo: u.ordem[0].total } : null,
                negociacao: u.situacao === 'analise' && u.negociacao?.uid === uid,
                convocacao: cv ? { o_que: cv.o_que, ate: cv.ate, aberta: t <= cv.ate && j.etapa === 'julgamento', arquivos: cv.arquivos.map(({ path: _p, ...a }) => a) } : null,
                vencedor: pub && u.habilitada ? { quem: quem(u.habilitada.uid), total: u.habilitada.total } : null,
            };
        }),
        recurso: rr ? {
            momento, intencao_ate: rr.intencao_ate, razoes_ate: rr.razoes_ate, contrarrazoes_ate: rr.contrarrazoes_ate, decisao: rr.decisao ? { provimento: rr.decisao.provimento, fundamentos: rr.decisao.fundamentos, em: rr.decisao.em } : null,
            encaminhado: rr.encaminhado ? { fundamentos: rr.encaminhado.fundamentos, em: rr.encaminhado.em } : null,
            intencoes: rr.intencoes.map((i) => ({ nome: i.uid === uid ? 'Você' : i.nome, motivo: i.motivo, em: i.em, razoes: i.razoes || null })),
            contrarrazoes: rr.contrarrazoes.map((c) => ({ nome: c.uid === uid ? 'Você' : c.nome, texto: c.texto, em: c.em })),
            minha_intencao: !!minha,
        } : null,
        pode: {
            intencao: eu && momento === 'intencao' && !minha,
            razoes: !!minha && !!rr && t <= rr.razoes_ate && !rr.decisao,
            contrarrazoes: eu && !!rr && rr.intencoes.length > 0 && (momento === 'razoes' || momento === 'contrarrazoes'),
        },
    };
}
