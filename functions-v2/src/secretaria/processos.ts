import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
    CalendarioOrgao, Contagem, Fase, MAX_ITENS, sanitizeCalendario, MAX_PRAZO_DIAS, MAX_TEXTO_LONGO, Pendencia, Prazo, calcularVencimento, derivados,
    hojeBrasil, MAX_MINUTAS_REMESSA, minutaAcessivel, podeAgir, podeExcluirProcesso, podeVer, saidaAutomatica, saidasDoProcesso, Espera, Origem, RefOrigem, ehParte, sanitizeOrigem, sha256, texto, verificarCadeia,
} from '../shared/secretaria';
import { auditar } from './config';
import { extrasDoEvento, urgentesPrimeiro } from '../shared/autos';
import {
    Consolidacao, Cumpridas, ItemCertidao, MAX_ITEM_CERTIDAO, RegraAcao, cabeNaCertidao, textoDoItem, acoesObrigatoriasPendentes, camposAoEntrarNaFase, destinoDaAcao,
    destinoDoMovimento, deveEmitir, grupoDe, marcasDoDestino, marcasNaFase, mudancaNaCertidao, partesVeem, pedidoDaAcao, documentosQueFaltam, textoCertidao,
    tituloCertidao, visivelCertidao, acaoAtiva, condicaoAtendida, respondeNaRodada, respostaDaAcao, respostasDaAcao, respostasDaFase, rotuloDaCondicao, Condicao,
} from '../shared/exigencias';
import { sendEmail } from '../shared/email';
import {
    CampoExigido, CampoValor, Formulario, POLOS, ParteGravada, TipoCampo, camposExigidos, camposFaltando, dadoDoFormulario, formParaCorrecao, diferencasCampos, formularioDe, retificarPartes, validarCampos, validarPadrao, valorDe, valorTexto,
} from '../shared/camposProcesso';
import { chaveContador, formatarNumero, identificadorSemNumero, numeracaoDe, numeracaoTipoDe } from '../shared/numeracao';
import { informacaoVisivel, informacoesDoAndamento, semReservado } from '../shared/informacoes';
import { COLECAO, MODULOS, Modulo, ROTULO_MODULO, Ref, ehInterno, ehModuloOrigem, idEscolhido, integracoesDe, lerFlags, refDe, refsDoFormulario, refsFechadas, resolverRegistro, vinculosDe } from '../shared/modulos';
import { ModuloSituacao, mudancasDaSituacao, registroDoProcesso } from '../shared/situacaoRegistro';
import { historyEntryId } from '../shared/history';
import { formatPersonName } from '../shared/normalization';
import { fireOrgWebhook } from '../shared/webhooks';
import { avisarPartesDoMovimento } from './portalAvisos';
import { nomeOrgao } from '../shared/orgaos';
import { lerOrgaos } from './orgaos';
import { avisarPendencia, avisarUnidadeRecebeu } from './avisosEquipe';
import { configComunicacoes, expedir, tornarSemEfeito } from './comunicacoes';
import {
    COL, REGION, carregarContexto, conferirVersao, erroUsuario, exigirAdmin, exigirAuth, exigirPosse, lerProcesso,
    nomeUnidade, registrarMovimento,
} from './context';

/**
 * Processos da Secretaria: autuação, consulta, tramitação entre unidades,
 * atribuição a uma pessoa, avanço de fase e situação (sobrestar, arquivar,
 * reativar). Toda mudança grava um movimento encadeado por hash.
 */

interface ProcRequest {
    organizationId: string;
    action: 'listar' | 'obter' | 'autuar' | 'tramitar' | 'atribuir' | 'avancarFase' | 'alterarStatus'
        | 'abrirPendencia' | 'resolverPendencia' | 'abrirPrazo' | 'encerrarPrazo' | 'convidarParte' | 'revogarParte'
        | 'marcarAcao' | 'concluirOrientacao' | 'contadores' | 'alterarDados' | 'urgencia' | 'expedirComunicacao' | 'tornarSemEfeito'
        | 'excluir' | 'restaurar' | 'excluidos' | 'emitirCertidao' | 'vinculados' | 'indice';
    /** Comunicação a expedir (espécie, texto, destinatários, prazo, meio). */
    comunicacao?: unknown;
    comunicacao_id?: string;
    /** Urgência: na autuação (com `motivo_urgencia`) e na ação `urgencia` (com `motivo`). */
    urgente?: boolean;
    motivo_urgencia?: string;
    origem?: { tipo?: string; descricao?: string; ref?: { modulo?: unknown; id?: unknown } };
    /** vinculados: registro (de outro módulo ou 'pe') cujos processos se procuram. */
    modulo?: string;
    /** tramitar: minutas que seguem com o processo para a unidade de destino. */
    minutas?: string[];
    // listar paginado (sem `limite`, devolve até 1000 como antes)
    limite?: number;
    cursor?: number;
    // ações da fase (caixas de marcar) e orientação do gabinete ao devolver
    acao_idx?: number;
    feita?: boolean;
    /** marcarAcao: o dado que a ação pede (texto, número, data, escolha, sim ou não). */
    valor?: unknown;
    orientacao?: string;
    // portal das partes
    parte_idx?: number;
    email?: string;
    /** Convite a um representante novo da parte ({ nome, email? }). */
    representante?: unknown;
    /** Convite de novo ou revogação de um representante já listado. */
    representante_idx?: number;
    // pendências e prazos
    interrompe?: boolean;
    pendencia_id?: string;
    resolucao?: string;
    dias?: number;
    contagem?: string;
    destinatario?: string;
    prazo_id?: string;
    resultado?: string;
    id?: string;
    version?: number;
    escopo?: 'caixa' | 'todos';
    // autuar
    assunto?: string;
    descricao?: string;
    rito_id?: string;
    tipo_id?: string;
    unidade_id?: string;
    sigilo?: string;
    partes?: unknown;
    /** Valores dos campos próprios do tipo de processo: { id do campo: valor }. */
    campos?: unknown;
    // movimentações
    unidade_destino?: string;
    responsavel_uid?: string | null;
    fase_id?: string;
    status?: string;
    motivo?: string;
}

const CONVITE_DIAS = 7;
const MAX_LISTA = 5000;
const APP_URL = process.env.APP_URL || 'https://sigo-caocipp.web.app';
const escapar = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const MAX_PARTES = 50;
const MAX_REPRESENTANTES = 5;

/** Quantos números já usados a autuação pula antes de desistir. */
const MAX_PULOS = 200;

function sanitizePartes(input: unknown, polos: readonly string[] = POLOS) {
    const lista = Array.isArray(input) ? input.slice(0, MAX_PARTES) : [];
    const reserva = polos.includes('interessado') ? 'interessado' : polos[0];
    return lista
        .map((x) => {
            const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
            if (o.polo !== undefined && o.polo !== '' && !polos.includes(String(o.polo))) {
                throw new HttpsError('invalid-argument', `O polo "${String(o.polo).slice(0, 20)}" não é aceito neste tipo de processo`);
            }
            const polo = typeof o.polo === 'string' && polos.includes(o.polo) ? o.polo : reserva;
            return { nome: texto(o.nome), documento: texto(o.documento, 30), email: texto(o.email, 120), polo };
        })
        .filter((p) => p.nome);
}

/** O que o rito exige na fase atual e ainda falta: documentos, ações obrigatórias e campos a preencher. */
function exigenciasAbertas(proc: admin.firestore.DocumentData, form?: Formulario | null) {
    const fase = ((proc.fases || []) as Fase[]).find((f) => f.id === proc.fase_atual);
    const exigidos = ((proc.campos_exigidos || {}) as Record<string, CampoExigido[]>)[String(proc.fase_atual)];
    return [
        ...documentosQueFaltam(fase, proc.exigencias_cumpridas as Cumpridas | undefined, respostasDaFase(proc)),
        ...acoesObrigatoriasPendentes(fase, (proc.acoes_feitas || {})[String(proc.fase_atual)], respostasDaFase(proc)),
        ...camposFaltando(exigidos, proc.campos as CampoValor[] | undefined, form).map((x) => ({ descricao: `Preencher "${x.rotulo}"` })),
    ];
}

/**
 * Sair da fase com exigência em aberto: sem motivo, recusa; com motivo, a
 * dispensa fica no movimento (e nos autos). Devolve o que foi dispensado.
 */
/** Texto da condição para mensagens: "Decisão" for Deferido ou Parcial. */
function textoCondicao(f: Fase | undefined, c: Condicao): string {
    const r = f?.acoes_regras?.[c.acao];
    const simNao = (c.campo ? r?.campos?.find((x) => x.id === c.campo)?.tipo : r?.pede) === 'sim_nao';
    const rot = (v: string) => (simNao ? (v === 'sim' ? 'Sim' : 'Não') : v);
    return `"${rotuloDaCondicao(f, c)}" for ${c.valores.map(rot).join(' ou ')}`;
}

/**
 * O que o rito faz ao trocar de fase (ou na autuação, sem fase de origem):
 * encerra o prazo automático da fase que sai, abre o da fase que entra,
 * marca a urgência e tira o responsável designado. Vai no mesmo movimento da
 * mudança: `texto` completa a descrição (só o que as partes podem ler: a
 * urgência), `interno` vai num registro só da equipe logo depois (prazo
 * interno e responsável), `campos` vai para o processo.
 * `para` null: só encerra (arquivamento).
 */
export function efeitosDaMudanca(
    proc: admin.firestore.DocumentData, deId: string | null, para: Fase | null, calendario: CalendarioOrgao | undefined, quem: string,
): { texto: string; interno: string[]; campos: Record<string, unknown> } {
    const hoje = hojeBrasil();
    const agora = new Date().toISOString();
    const frases: string[] = [];
    const interno: string[] = [];
    const antes = (proc.prazos || []) as Prazo[];
    let prazos = antes;
    const daFase = antes.filter((x) => x.status === 'aberto' && x.fase_id && x.fase_id === deId);
    if (daFase.length) {
        prazos = prazos.map((x) => (daFase.includes(x) ? { ...x, status: 'cumprido' as const, encerrado_em: hoje, encerrado_por: quem } : x));
        daFase.forEach((x) => interno.push(`Prazo interno da fase encerrado ${hoje <= x.vence_em ? 'no prazo' : 'fora do prazo'}: ${x.descricao}.`));
    }
    const dias = Number(para?.prazo_dias);
    if (para?.prazo_auto && !para.ao_entrar?.arquivar && Number.isInteger(dias) && dias > 0 && dias <= MAX_PRAZO_DIAS && prazos.length < MAX_ITENS) {
        const contagem: Contagem = para.prazo_contagem === 'corridos' ? 'corridos' : 'uteis';
        const vence = calcularVencimento(hoje, dias, contagem, calendario);
        prazos = [...prazos, {
            id: randomBytes(10).toString('hex'), descricao: `Fase ${para.nome}`, fase_id: para.id, dias, contagem, inicio: hoje, vence_em: vence,
            status: 'aberto', aberto_em: agora, aberto_por: quem, automatico: true,
        }];
        interno.push(`Prazo interno da fase aberto: ${dias} dias ${contagem === 'uteis' ? 'úteis' : 'corridos'}, vence em ${vence.split('-').reverse().join('/')}.`);
    }
    const campos: Record<string, unknown> = prazos === antes ? {} : { prazos, ...derivados((proc.pendencias || []) as Pendencia[], prazos) };
    if (para?.ao_entrar?.urgente && proc.urgente !== true) {
        campos.urgente = true;
        campos.urgencia = { motivo: `Regra da fase ${para.nome}`, por: quem, em: agora };
        frases.push('Tramitação urgente pela regra da fase.');
    }
    if (para?.ao_entrar?.sem_responsavel && proc.responsavel_uid) {
        campos.responsavel_uid = null;
        interno.push('Responsável designado retirado pela regra da fase.');
    }
    return { texto: frases.length ? ` ${frases.join(' ')}` : '', interno, campos };
}

/** O que a fase fez sozinha e só interessa à equipe: registro interno, sem termo, fora do portal. */
function registrarInternos(tx: admin.firestore.Transaction, c: Awaited<ReturnType<typeof carregarContexto>>, ref: admin.firestore.DocumentReference, proc: admin.firestore.DocumentData, interno: string[]): Record<string, unknown> {
    if (!interno.length) return {};
    return registrarMovimento(tx, c, ref, proc, 'efeitos_fase', interno.join(' '), marcasDoDestino('informacao'));
}

const SEM_EFEITOS = { texto: '', interno: [] as string[], campos: {} as Record<string, unknown> };

type Ctx = Awaited<ReturnType<typeof carregarContexto>>;
/** Registro de outro módulo cuja situação o rito conduz, ou por que ele não pode ser conduzido. */
type RegistroLido = { ref: admin.firestore.DocumentReference; doc: admin.firestore.DocumentData; modulo: ModuloSituacao; numero: string } | { falta: string };
const SEM_REGISTROS = new Map<string, RegistroLido>();

/**
 * Lê, dentro da transação e antes de qualquer escrita, o registro ligado de
 * cada módulo que alguma fase do rito conduz (`situacao_registro`). Rito sem
 * essa regra não lê nada.
 */
async function lerRegistrosDoRito(tx: admin.firestore.Transaction, c: Ctx, proc: admin.firestore.DocumentData): Promise<Map<string, RegistroLido>> {
    const modulos = [...new Set(((proc.fases || []) as Fase[]).map((f) => f.situacao_registro?.modulo).filter((m): m is ModuloSituacao => !!m))];
    if (!modulos.length) return SEM_REGISTROS;
    const ligadas = integracoesDe(c.org, await lerFlags(c.db));
    const lidos = new Map<string, RegistroLido>();
    for (const m of modulos) {
        const nome = ROTULO_MODULO[m];
        const alvo = registroDoProcesso(proc, m);
        if (!ligadas[m]) lidos.set(m, { falta: `a integração com ${nome} está desligada` });
        else if ('falta' in alvo) lidos.set(m, { falta: alvo.falta === 'varios' ? `o processo tem mais de um registro de ${nome} ligado e não nasceu de nenhum deles` : `o processo não tem registro de ${nome} ligado` });
        else {
            const ref = c.db.collection(COLECAO[m]).doc(alvo.id);
            const d = (await tx.get(ref)).data();
            if (!d || d.organization_id !== c.orgId) lidos.set(m, { falta: `o registro de ${nome} ligado não existe mais` });
            else if (d.anonymized === true) lidos.set(m, { falta: `o registro de ${nome} ligado foi anonimizado` });
            else lidos.set(m, { ref, doc: d, modulo: m, numero: refDe(m, alvo.id, d).numero });
        }
    }
    return lidos;
}

type Arquivado = { modulo: ModuloSituacao; id: string; numero: string };

/**
 * Põe o registro ligado na situação que a fase pede (ao entrar nela ou quando
 * alguém assume o processo). Vai na mesma transação do ato: a fase do processo
 * e a coluna do registro nunca ficam diferentes. Devolve o que dizer à equipe
 * no registro interno e, se o registro foi arquivado, os dados para o webhook.
 */
function aplicarSituacao(
    tx: admin.firestore.Transaction, c: Ctx, registros: Map<string, RegistroLido>, fase: Fase | null | undefined, gatilho: 'ao_entrar' | 'ao_assumir',
    proc: admin.firestore.DocumentData, quem?: { uid: string; nome: string },
): { notas: string[]; arquivou: Arquivado | null } {
    const cfg = fase?.situacao_registro;
    const alvo = cfg?.[gatilho];
    if (!fase || !cfg || !alvo) return { notas: [], arquivou: null };
    const nome = ROTULO_MODULO[cfg.modulo];
    const r = registros.get(cfg.modulo);
    if (!r || 'falta' in r) return { notas: [`Situação em ${nome} não alterada: ${r ? r.falta : 'o registro ligado não foi lido'}.`], arquivou: null };
    const m = mudancasDaSituacao(r.doc, alvo, hojeBrasil(), quem);
    if (!m) return { notas: [], arquivou: null };
    const agora = new Date();
    const entrada = {
        date: agora.toISOString().split('T')[0], time: agora.toTimeString().split(' ')[0], user_id: c.ctx.uid, user_name: c.userName,
        action: `Situação "${alvo}" pelo processo eletrônico ${proc.numero} (fase ${fase.nome})`, timestamp: agora.toISOString(),
    };
    // `set` com `merge`: registros importados têm campos com ponto no nome, que `update` leria como caminho.
    tx.set(r.ref, { ...m, updated_at: FieldValue.serverTimestamp(), updated_by: c.ctx.uid, activity_log: FieldValue.arrayUnion(entrada) }, { merge: true });
    tx.set(r.ref.collection('history').doc(historyEntryId(entrada)), { ...entrada, created_at: FieldValue.serverTimestamp() });
    return {
        notas: [`${nome} ${r.numero}: situação "${alvo}" pela regra da fase.`],
        arquivou: m.archived_date ? { modulo: r.modulo, id: r.ref.id, numero: r.numero } : null,
    };
}

/**
 * Fase de espera: entrar nela guarda de onde o processo veio (fase, unidade e
 * responsável); sair dela apaga. A volta para a fase de origem é a retomada.
 */
function camposDaEspera(proc: admin.firestore.DocumentData, de: Fase | undefined, para: Fase): Record<string, unknown> {
    if (para.espera) {
        if (de?.espera) return {};
        const espera: Espera = { fase: String(proc.fase_atual), unidade: String(proc.unidade_atual), responsavel_uid: proc.responsavel_uid || null, desde: new Date().toISOString() };
        return { espera };
    }
    return de?.espera && proc.espera ? { espera: FieldValue.delete() } : {};
}
/** O processo está voltando da espera para a fase de onde veio? Ela é retomada como estava. */
const ehRetomada = (proc: admin.firestore.DocumentData, de: Fase | undefined, para: Fase | null | undefined): boolean =>
    !!para && de?.espera === true && (proc.espera as Espera | undefined)?.fase === para.id;
const marcaEspera = (retomada: boolean, para: Fase): string => (retomada ? ' (retomada depois da espera)' : para.espera ? ' (fase de espera)' : '');

/** Fase que arquiva ao entrar: o arquivamento é um ato próprio, logo depois da mudança de fase. */
function arquivarPelaFase(tx: admin.firestore.Transaction, c: Ctx, ref: admin.firestore.DocumentReference, proc: admin.firestore.DocumentData, fase: Fase): Record<string, unknown> {
    const mov = registrarMovimento(tx, c, ref, proc, 'situacao', `Arquivado pela regra da fase ${fase.nome}.`, { de: proc.status, para: 'arquivado', automatico: true });
    return { ...mov, status: 'arquivado' };
}

/**
 * Saída que o rito condiciona à resposta de uma ação: seguir por ela sem a
 * resposta que a indica pede motivo (fica no movimento como contra a condição).
 */
function foraDaCondicao(proc: admin.firestore.DocumentData, alvoId: string): string | null {
    const fase = ((proc.fases || []) as Fase[]).find((f) => f.id === proc.fase_atual);
    const cond = fase?.condicoes_regra?.[alvoId];
    if (!cond || condicaoAtendida(cond, respostasDaFase(proc), fase)) return null;
    return textoCondicao(fase, cond);
}

function dispensarExigencias(proc: admin.firestore.DocumentData, motivo: string, form?: Formulario | null): string[] {
    const abertas = exigenciasAbertas(proc, form).map((e) => e.descricao);
    if (abertas.length && !motivo) {
        throw new HttpsError('failed-precondition', `O rito exige nesta fase: ${abertas.join('; ')}. Cumpra o que falta ou informe o motivo da dispensa.`);
    }
    return abertas;
}
type Emissao = { mov: Record<string, unknown>; proc: admin.firestore.DocumentData };

/**
 * Certidão conjunta pendente vira UMA certidão nos autos, com folha, antes do
 * ato que a encerra (sair do grupo, arquivar, encher, "Emitir agora"). Sem
 * pendência (ou `cond` falso), não faz nada. `proc` já traz o movimento, para
 * encadear o ato seguinte na mesma transação.
 */
function emitirSe(cond: boolean, tx: admin.firestore.Transaction, c: Parameters<typeof registrarMovimento>[1],
    ref: admin.firestore.DocumentReference, data: admin.firestore.DocumentData): Emissao {
    const cons = data.consolidacao as Consolidacao | undefined;
    if (!cond || !cons?.itens?.length) return { mov: {}, proc: data };
    const titulo = tituloCertidao((data.fases || []) as Fase[], cons.grupo);
    const mov = registrarMovimento(tx, c, ref, data, 'certidao_fase', textoCertidao(cons.itens),
        { grupo: cons.grupo, itens: cons.itens.map((i) => i.seq), titulo, visivel_partes: visivelCertidao(cons.itens) });
    return { mov: { ...mov, consolidacao: FieldValue.delete() }, proc: { ...data, ...mov, consolidacao: null } };
}

/** A pendente é de outro grupo ou não comporta o item na sua folha: emite antes de juntar. */
const antesDeJuntar = (data: admin.firestore.DocumentData, grupo: string, item: ItemCertidao) => {
    const cons = data.consolidacao as Consolidacao | undefined;
    return !!cons?.itens?.length && (cons.grupo !== grupo || !cabeNaCertidao(cons.itens, item));
};

/** Itens da certidão do grupo depois do ato (a emissão, se houve, zerou a pendente). */
const itensDepois = (proc: admin.firestore.DocumentData, grupo: string, item: ItemCertidao): Consolidacao =>
    ({ grupo, itens: [...((proc.consolidacao as Consolidacao | null)?.itens || []), item] });

const textoDispensa = (d: string[]) => (d.length ? ` Dispensado o que o rito exigia na fase: ${d.join('; ')}.` : '');

/** Valor informado ao cumprir a ação, conferido contra o que o rito pede. Lança HttpsError. */
async function valorDaAcao(c: Awaited<ReturnType<typeof carregarContexto>>, regra: RegraAcao | null | undefined, acao: string, bruto: unknown) {
    const pede = pedidoDaAcao(regra);
    if (pede === 'confirmar' || pede === 'documento' || pede === 'orientacao') return null;
    const rotulo = regra?.rotulo || acao;
    if (pede === 'formulario') {
        // Vários campos, conferidos como os do tipo de processo (registros relidos no servidor).
        const form = { campos: regra?.campos || [] } as Formulario;
        let campos: CampoValor[] = [];
        try { campos = validarCampos(form, bruto, [], await refsDoFormulario(c.db, c.orgId, c.org, form, bruto)); } catch (e) { erroUsuario(e); }
        if (!campos.length) throw new HttpsError('invalid-argument', `Preencha "${rotulo}"`);
        return dadoDoFormulario(rotulo, campos);
    }
    if (pede === 'registro') {
        // Registro de outro módulo: o servidor lê e guarda só número e título; a parte vê só o número.
        const modulo = regra?.modulo as Modulo;
        const id = idEscolhido(bruto);
        if (!id) throw new HttpsError('invalid-argument', `Escolha "${rotulo}"`);
        if (!MODULOS.includes(modulo) || !integracoesDe(c.org, await lerFlags(c.db))[modulo]) {
            throw new HttpsError('failed-precondition', `A integração com ${ROTULO_MODULO[modulo] || 'esse módulo'} está desligada neste órgão`);
        }
        const ref = await resolverRegistro(c.db, c.orgId, modulo, id);
        if (!ref || (regra?.pagina && ref.pagina !== regra.pagina)) throw new HttpsError('invalid-argument', `"${rotulo}": registro não encontrado em ${ROTULO_MODULO[modulo]}`);
        // Página própria é interna: a informação nunca vai às partes.
        return { rotulo, tipo: 'registro' as TipoCampo, valor: ref.numero, valor_texto: ref.numero, ref, refs: [ref], restrito: ref.restrito === true || ehInterno(ref) };
    }
    const tipo = pede as TipoCampo;
    let valor: ReturnType<typeof valorDe> = null;
    try { valor = valorDe({ rotulo, tipo, opcoes: regra?.opcoes || [] }, bruto); } catch (e) { erroUsuario(e); }
    if (valor === null) throw new HttpsError('invalid-argument', tipo === 'sim_nao' ? `Responda sim ou não em "${rotulo}"` : `Informe "${rotulo}"`);
    return { rotulo, tipo, valor, valor_texto: valorTexto({ tipo, valor }), ref: undefined, refs: [] as Ref[], restrito: false };
}

/** Registro pedido por uma ação entra nos vínculos (desfazer não tira: segue citado no histórico). */
// ponytail: os 50 primeiros; paginar se um registro passar disso.
const MAX_VINCULADOS = 50;
const vinculoDaAcao = (dado: { refs: Array<{ modulo: string; id: string }> } | null) => {
    if (!dado?.refs.length) return {};
    const k = dado.refs.map((r) => `${r.modulo}:${r.id}`);
    return { vinculos: FieldValue.arrayUnion(...k), vinculos_acoes: FieldValue.arrayUnion(...k) };
};

/**
 * O registro ou processo de onde o processo nasce, relido no servidor: só
 * número e título (de outro processo, só o número, porque o assunto pode ser
 * sigiloso para quem vê o novo processo).
 */
async function refDaOrigem(c: Awaited<ReturnType<typeof carregarContexto>>, bruto: unknown): Promise<RefOrigem | null> {
    const r = (bruto && typeof bruto === 'object' ? bruto : {}) as { modulo?: unknown; id?: unknown };
    const id = idEscolhido(r.id);
    if (!id) return null;
    if (!ehModuloOrigem(r.modulo)) throw new HttpsError('invalid-argument', 'Origem inválida');
    if (r.modulo === 'pe') {
        const { data } = await lerProcesso(c, id);
        return { modulo: 'pe', id, numero: String(data.numero || '') };
    }
    const m = r.modulo as Modulo;
    if (!integracoesDe(c.org, await lerFlags(c.db))[m]) {
        throw new HttpsError('failed-precondition', `A integração com ${ROTULO_MODULO[m]} está desligada. Peça ao administrador para ligá-la em "Integrações com outros módulos".`);
    }
    const ref = await resolverRegistro(c.db, c.orgId, m, id);
    if (!ref) throw new HttpsError('not-found', `Registro de origem não encontrado em ${ROTULO_MODULO[m]}`);
    return { modulo: m, id, numero: ref.numero, ...(ref.titulo ? { titulo: ref.titulo } : {}), ...(ref.pagina ? { pagina: ref.pagina } : {}) };
}

function resumo(id: string, d: admin.firestore.DocumentData) {
    return {
        id,
        numero: d.numero,
        assunto: d.assunto,
        status: d.status,
        sigilo: d.sigilo,
        urgente: d.urgente === true,
        urgencia: d.urgente === true ? d.urgencia || null : null,
        fase_atual: d.fase_atual,
        fase_nome: (d.fases || []).find((f: Fase) => f.id === d.fase_atual)?.nome || d.fase_atual,
        unidade_atual: d.unidade_atual,
        responsavel_uid: d.responsavel_uid || null,
        rito_nome: d.rito_nome,
        tipo_id: d.tipo_id || null,
        tipo_nome: d.tipo_nome || null,
        ultimo_movimento: d.ultimo_movimento || null,
        version: d.version,
        pendencias_abertas: d.pendencias_abertas || 0,
        fase_suspensa: d.fase_suspensa === true,
        // Em fase de espera: a fase e a unidade para onde o processo volta.
        espera: d.espera ? { fase: String(d.espera.fase || ''), unidade: String(d.espera.unidade || ''), desde: String(d.espera.desde || '') } : null,
        proximo_vencimento: d.proximo_vencimento || null,
        // Calendário: até 5 prazos abertos (data e descrição curta), só em tramitação. Sem destinatário.
        prazos_abertos: d.status === 'em_tramitacao'
            ? ((d.prazos || []) as Prazo[]).filter((x) => x.status === 'aberto' && x.vence_em)
                .sort((a, b) => String(a.vence_em).localeCompare(String(b.vence_em))).slice(0, 5)
                .map((x) => ({ vence_em: x.vence_em, descricao: String(x.descricao || '').slice(0, 60) }))
            : [],
        comunicacoes_aguardando: d.comunicacoes_aguardando || 0,
        // Pesquisa e painéis.
        rito_id: d.rito_id || null,
        autuado_em: d.autuado_em || null,
        campos_resumo: ((d.campos || []) as CampoValor[]).map((x) => valorTexto(x)).join(' · ').slice(0, 500),
        partes_resumo: (d.partes || []).map((x: { nome?: string; documento?: string }) => [x.nome, x.documento].filter(Boolean).join(' ')).join(' · ').slice(0, 500),
        pendencia_desde: ((d.pendencias || []) as Pendencia[])
            .filter((x) => x.status === 'aberta').map((x) => String(x.aberta_em || '')).filter(Boolean).sort()[0] || null,
        // Fila de trabalho: quando chegou na unidade, pedidos de assinatura e orientação do gabinete.
        recebido_em: d.recebido_em || d.autuado_em || null,
        assinaturas_pendentes: d.assinaturas_pendentes || [],
        orientacao: d.orientacao || null,
    };
}

export const secretariaProcesso = onCall<ProcRequest>({ region: REGION }, async (request) => {
    const auth = exigirAuth(request);
    const p = request.data || ({} as ProcRequest);
    const c = await carregarContexto(auth, p.organizationId);
    const { db, orgId } = c;

    if (p.action === 'listar' && p.limite) {
        // Paginado pelo servidor: do mais recente para o mais antigo por
        // updated_at (índice organization_id + updated_at), filtrando a posse
        // e o sigilo em memória; `cursor` é o updated_at (ms) do último lido.
        const limite = Math.min(Math.max(Number(p.limite) || 50, 1), 200);
        let q = db.collection(COL.processos).where('organization_id', '==', orgId).orderBy('updated_at', 'desc');
        if (p.cursor) q = q.startAfter(Timestamp.fromMillis(Number(p.cursor)));
        const snap = await q.limit(limite).get();
        const processos = urgentesPrimeiro(snap.docs
            .filter((d) => d.data().status !== 'excluido' && podeVer(d.data() as never, c.ctx))
            .filter((d) => p.escopo !== 'caixa' || podeAgir(d.data() as never, c.ctx))
            .map((d) => resumo(d.id, d.data())));
        const ultimo = snap.docs[snap.docs.length - 1];
        return { processos, cursor: ultimo?.data().updated_at?.toMillis?.() || null, mais: snap.size === limite };
    }

    if (p.action === 'vinculados') {
        // Processos ligados a um registro de outro módulo (ou derivados de outro
        // processo, 'pe'): os que a pessoa pode ver, sem dizer que há outros.
        const modulo = String(p.modulo || '');
        const id = idEscolhido(p.id);
        if (!ehModuloOrigem(modulo) || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new HttpsError('invalid-argument', 'Registro inválido');
        const ligada = modulo === 'pe' || integracoesDe(c.org, await lerFlags(db))[modulo as Modulo];
        if (!ligada) return { ligada: false, pode_autuar: false, processos: [] };
        // O limite vale para o que a pessoa vê: lê em páginas e só diz "mais" se houver outro visível.
        const base = db.collection(COL.processos).where('organization_id', '==', orgId).where('vinculos', 'array-contains', `${modulo}:${id}`);
        const processos: Array<Record<string, unknown>> = [];
        let mais = false;
        let ultimo: admin.firestore.QueryDocumentSnapshot | undefined;
        // ponytail: até 4 páginas de 50 lidas; um registro com mais processos invisíveis que isso mostra só o que coube.
        for (let pag = 0; pag < 4 && !mais; pag++) {
            const snap = await (ultimo ? base.startAfter(ultimo) : base).limit(MAX_VINCULADOS).get();
            for (const d of snap.docs) {
                const x = d.data();
                if (x.status === 'excluido' || ehParte(x as never, auth.uid) || !podeVer(x as never, c.ctx)) continue;
                if (processos.length === MAX_VINCULADOS) { mais = true; break; }
                const r = resumo(d.id, x);
                processos.push({ id: r.id, numero: r.numero, assunto: r.assunto, fase_nome: r.fase_nome, status: r.status, sigilo: r.sigilo, origem: x.origem?.ref?.id === id });
            }
            if (snap.size < MAX_VINCULADOS) break;
            ultimo = snap.docs[snap.size - 1];
        }
        return { ligada: true, pode_autuar: c.ctx.unidadeIds.length > 0, processos, mais };
    }

    if (p.action === 'contadores') {
        // Carga por unidade (processos não arquivados) e totais, por contagem
        // no servidor: não traz documentos.
        const base = db.collection(COL.processos).where('organization_id', '==', orgId);
        const conta = async (q: admin.firestore.Query) => (await q.count().get()).data().count;
        const [total, arquivados, excluidos, porUnidade] = await Promise.all([
            conta(base),
            conta(base.where('status', '==', 'arquivado')),
            conta(base.where('status', '==', 'excluido')),
            Promise.all(c.unidades.map(async (u) => {
                const [t, a] = await Promise.all([conta(base.where('unidade_atual', '==', u.id)), conta(base.where('unidade_atual', '==', u.id).where('status', '==', 'arquivado'))]);
                return [u.id, t - a] as const;
            })),
        ]);
        return { total: total - excluidos, arquivados, ativos: total - arquivados - excluidos, por_unidade: Object.fromEntries(porUnidade) };
    }

    if (p.action === 'indice') {
        // Para as listas dos outros módulos e a busca (Ctrl+K): os processos que a
        // pessoa vê (número, assunto, partes) e, por módulo ligado, os ids dos
        // registros que têm processo. Mesma regra de 'vinculados': quem é parte
        // não vê pelo órgão; restrito só para quem pode.
        // ponytail: uma leitura por processo do órgão a cada 5 min por pessoa; se pesar,
        // trocar por array-contains-any sobre os ids da página da tabela.
        if (!c.ctx.isAdmin && !c.ctx.unidadeIds.length) return { processos: [], com: {}, truncado: false };
        const base = db.collection(COL.processos).where('organization_id', '==', orgId).orderBy('updated_at', 'desc')
            .select('numero', 'assunto', 'partes', 'status', 'sigilo', 'unidade_atual', 'unidades_historico', 'partes_uids', 'vinculos', 'updated_at');
        const docs: admin.firestore.QueryDocumentSnapshot[] = [];
        let q = base.limit(500);
        for (;;) {
            const snap = await q.get();
            docs.push(...snap.docs);
            if (snap.size < 500 || docs.length >= MAX_LISTA) break;
            q = base.startAfter(snap.docs[snap.size - 1]).limit(500);
        }
        const ligadas = integracoesDe(c.org, await lerFlags(db));
        const com: Record<string, string[]> = {};
        const processos: Array<{ id: string; numero: string; assunto: string; partes_resumo: string }> = [];
        for (const d of docs.slice(0, MAX_LISTA)) {
            const x = d.data();
            if (x.status === 'excluido' || ehParte(x as never, auth.uid) || !podeVer(x as never, c.ctx)) continue;
            const r = resumo(d.id, x);
            processos.push({ id: d.id, numero: r.numero, assunto: r.assunto, partes_resumo: r.partes_resumo });
            for (const v of (x.vinculos || []) as string[]) {
                const [m, id] = v.split(':');
                if (MODULOS.includes(m as Modulo) && ligadas[m as Modulo] && id) (com[m] ||= []).push(id);
            }
        }
        for (const m of Object.keys(com)) com[m] = [...new Set(com[m])];
        return { processos, com, truncado: docs.length >= MAX_LISTA };
    }

    if (p.action === 'listar') {
        // Lista inteira (Meu trabalho, Mesa, Painel). A caixa lê só as unidades
        // da pessoa; "todos" percorre o órgão em páginas de 500. O teto evita
        // resposta grande demais e é avisado em `truncado`.
        const docs: admin.firestore.QueryDocumentSnapshot[] = [];
        const base = db.collection(COL.processos).where('organization_id', '==', orgId);
        if (p.escopo === 'caixa') {
            for (let i = 0; i < c.ctx.unidadeIds.length; i += 30) {
                docs.push(...(await base.where('unidade_atual', 'in', c.ctx.unidadeIds.slice(i, i + 30)).limit(MAX_LISTA).get()).docs);
            }
        } else {
            let q = base.orderBy('updated_at', 'desc').limit(500);
            for (;;) {
                const snap = await q.get();
                docs.push(...snap.docs);
                if (snap.size < 500 || docs.length >= MAX_LISTA) break;
                q = base.orderBy('updated_at', 'desc').startAfter(snap.docs[snap.size - 1]).limit(500);
            }
        }
        const truncado = docs.length >= MAX_LISTA;
        const lista = docs.slice(0, MAX_LISTA)
            .filter((d) => d.data().status !== 'excluido' && podeVer(d.data() as never, c.ctx))
            .filter((d) => p.escopo !== 'caixa' || podeAgir(d.data() as never, c.ctx))
            .map((d) => ({ ...resumo(d.id, d.data()), _t: d.data().updated_at?.toMillis?.() || 0 }))
            .sort((a, b) => b._t - a._t)
            .map(({ _t, ...r }) => r);
        return { processos: urgentesPrimeiro(lista), truncado };
    }

    if (p.action === 'excluidos') {
        exigirAdmin(c);
        const snap = await db.collection(COL.processos).where('organization_id', '==', orgId).where('status', '==', 'excluido').limit(500).get();
        return {
            processos: snap.docs.map((d) => {
                const x = d.data();
                return {
                    id: d.id, numero: x.numero, assunto: x.assunto, tipo_nome: x.tipo_nome || null,
                    em: x.excluido?.em || null, por: x.excluido?.por_nome || '', motivo: x.excluido?.motivo || '',
                    unidade_anterior: x.excluido?.antes?.unidade_atual || null, status_anterior: x.excluido?.antes?.status || 'em_tramitacao',
                };
            }).sort((a, b) => String(b.em).localeCompare(String(a.em))),
        };
    }

    if (p.action === 'excluir' || p.action === 'restaurar') {
        const motivo = texto(p.motivo, 500);
        if (p.action === 'excluir' && motivo.length < 5) throw new HttpsError('invalid-argument', 'Diga o motivo da exclusão (ao menos 5 letras)');
        if (p.action === 'restaurar') exigirAdmin(c);
        const ref = db.collection(COL.processos).doc(String(p.id || '_'));
        const numero = await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.data();
            if (!data || data.organization_id !== orgId) throw new HttpsError('not-found', 'Processo não encontrado');
            if (p.action === 'excluir') {
                conferirVersao(data, p.version);
                const movs = (await tx.get(ref.collection('movimentos').select('autor_uid'))).docs.map((d) => d.data());
                if (!podeExcluirProcesso(data as never, movs, c.ctx)) {
                    throw new HttpsError('permission-denied', 'Só o admin do órgão exclui este processo. Quem autuou só exclui enquanto ninguém mais agiu nele.');
                }
                const mov = registrarMovimento(tx, c, ref, data, 'exclusao', `Processo excluído. Motivo: ${motivo}`, { motivo });
                // O que tira o processo das listas, do portal e das rotinas diárias; a restauração devolve.
                const antes = {
                    status: data.status, unidade_atual: data.unidade_atual, responsavel_uid: data.responsavel_uid || null,
                    partes_uids: data.partes_uids || [], ciencia_limite: data.ciencia_limite || null, proximo_vencimento: data.proximo_vencimento || null,
                };
                tx.update(ref, {
                    ...mov, status: 'excluido', unidade_atual: '', responsavel_uid: null, partes_uids: [], ciencia_limite: null, proximo_vencimento: null,
                    excluido: { em: new Date().toISOString(), por_uid: c.ctx.uid, por_nome: c.userName, motivo, antes },
                });
                return String(data.numero);
            }
            if (data.status !== 'excluido') throw new HttpsError('failed-precondition', 'O processo não está excluído');
            const antes = data.excluido?.antes || {};
            const destinoId = String(p.unidade_destino || antes.unidade_atual || '');
            const destino = c.unidades.find((u) => u.id === destinoId && u.ativa !== false);
            if (!destino) throw new HttpsError('invalid-argument', 'A unidade de antes não está mais ativa. Escolha para qual unidade o processo volta.');
            const mov = registrarMovimento(tx, c, ref, { ...data, unidade_atual: destino.id }, 'restauracao',
                `Processo restaurado na unidade ${destino.nome}.${motivo ? ` ${motivo}` : ''}`, { unidade: destino.id, ...(motivo ? { motivo } : {}) });
            tx.update(ref, {
                ...mov, status: antes.status || 'em_tramitacao', unidade_atual: destino.id, unidades_historico: FieldValue.arrayUnion(destino.id),
                responsavel_uid: destino.id === antes.unidade_atual ? antes.responsavel_uid || null : null,
                partes_uids: antes.partes_uids || [], ciencia_limite: antes.ciencia_limite || null, proximo_vencimento: antes.proximo_vencimento || null,
                excluido: FieldValue.delete(), recebido_em: new Date().toISOString(),
            });
            return String(data.numero);
        });
        await auditar(db, orgId, c.ctx.uid, c.userName, p.action === 'excluir' ? 'SECRETARIA_PROCESSO_EXCLUIDO' : 'SECRETARIA_PROCESSO_RESTAURADO', { processo_id: ref.id, numero, motivo });
        return { success: true };
    }

    if (p.action === 'obter') {
        const { ref, data } = await lerProcesso(c, p.id);
        const [movs, docs] = await Promise.all([
            ref.collection('movimentos').orderBy('seq').get(),
            // Sem o conteúdo (pode ter imagens): só o que a lista mostra.
            ref.collection('documentos').select(
                'titulo', 'tipo', 'origem', 'status', 'mime', 'nome_arquivo', 'tamanho', 'sha256', 'ordem', 'unidade_origem',
                'autor_nome', 'criado_em', 'juntado_em', 'assinaturas', 'peticao', 'visivel_partes', 'paginas', 'folha_inicial', 'folha_final', 'codigo_verificacao',
                'assinaturas_pedidas', 'peticao_tipo', 'modelo_id', 'unidades_acesso', 'guardado_em', 'guardado_por_nome', 'versoes_qtd',
            ).get(),
        ]);
        // Dado reservado a quem gere a unidade: sai o valor para quem não pode vê-lo.
        const quemLe = { uid: c.ctx.uid, isAdmin: c.ctx.isAdmin, gestorDe: c.gestorDe };
        const movsBrutos = movs.docs.map((d) => d.data());
        const movimentos = movsBrutos.map((m) => semReservado(m, quemLe));
        const posse = podeAgir(data as never, c.ctx);
        const documentos = docs.docs
            .map((d) => ({ id: d.id, ...d.data() } as admin.firestore.DocumentData))
            // Minuta só é vista pela unidade que a redigiu; juntado = autos; controle = guardado fora dos autos (toda a equipe).
            .filter((d) => d.status === 'juntado' || d.status === 'controle' || minutaAcessivel(d, c.ctx.unidadeIds))
            .map((d) => ({
                id: d.id, titulo: d.titulo, tipo: d.tipo, origem: d.origem, status: d.status,
                mime: d.mime || null, nome_arquivo: d.nome_arquivo || null, tamanho: d.tamanho || null,
                sha256: d.sha256, ordem: d.ordem || null, unidade_origem: d.unidade_origem,
                autor_nome: d.autor_nome, criado_em: d.criado_em, juntado_em: d.juntado_em || null,
                assinaturas: d.assinaturas || [], assinaturas_pedidas: d.assinaturas_pedidas || [],
                peticao: d.peticao === true, peticao_tipo: d.peticao_tipo || null, visivel_partes: d.visivel_partes !== false,
                paginas: d.paginas || null, folha_inicial: d.folha_inicial || null, folha_final: d.folha_final || null, codigo_verificacao: d.codigo_verificacao || null, modelo_id: d.modelo_id || null, unidades_acesso: d.unidades_acesso || [],
                guardado_em: d.guardado_em || null, guardado_por: d.guardado_por_nome || null, versoes: Number(d.versoes_qtd) || 0,
            }))
            .sort((a, b) => (a.ordem || 1e9) - (b.ordem || 1e9) || String(a.criado_em).localeCompare(String(b.criado_em)));
        // Registro que hoje está restrito, anonimizado ou sumiu: marcado na resposta (nada é gravado),
        // para a capa avisar e os modelos não puxarem dado dele.
        const informacoes = informacoesDoAndamento(movsBrutos as never, data.fases || []).map((i) => informacaoVisivel(i, quemLe));
        const camposLidos = (data.campos || []) as Array<{ ref?: Ref }>;
        const origemLida = data.origem?.ref ? data.origem : null;
        const fechadas = await refsFechadas(db, c.orgId, [origemLida?.ref, ...camposLidos.map((x) => x.ref), ...informacoes.flatMap((i) => [i.ref, ...(i.refs || [])])]);
        // Página própria é sempre fechada para as partes, mas a equipe a vê normalmente.
        const fechada = (r?: Ref | null) => !!r && !ehInterno(r) && fechadas.has(`${r.modulo}:${r.id}`);
        const marcar = <T extends Ref | undefined>(r: T): T => (r && fechada(r) ? { ...r, restrito: true } : r);
        return {
            processo: {
                ...resumo(ref.id, data),
                descricao: data.descricao,
                campos: camposLidos.map((x) => (fechada(x.ref) ? { ...x, ref: { ...x.ref, restrito: true } } : x)),
                partes: (data.partes || []).map(({ convite_hash, uid, representantes, ...x }: Record<string, unknown>) => ({
                    ...x, portal: uid ? 'ativo' : convite_hash ? 'convidado' : null,
                    representantes: ((representantes || []) as Array<Record<string, unknown>>).map(({ convite_hash: ch, uid: u, nome, email }) => ({
                        nome, email: email || null, portal: u ? 'ativo' : ch ? 'convidado' : null,
                    })),
                })),
                fases: data.fases || [],
                unidades_historico: data.unidades_historico || [],
                // A primeira unidade da lista é a que autuou (arrayUnion só acrescenta).
                unidade_autuacao: (data.unidades_historico || [])[0] || null,
                origem: origemLida && fechada(origemLida.ref) ? { ...origemLida, ref: { ...origemLida.ref, restrito: true } } : data.origem || null,
                autuado_em: data.autuado_em,
                autuado_por: data.autuado_por_nome,
                pendencias: data.pendencias || [],
                prazos: data.prazos || [],
                comunicacoes: data.comunicacoes || [],
                acoes_feitas: data.acoes_feitas || {},
                acoes_respostas: data.acoes_respostas || {},
                // Atos aguardando a certidão conjunta (para "Emitir certidão agora").
                consolidacao: data.consolidacao || null,
                exigencias_cumpridas: data.exigencias_cumpridas || {},
                // Em fase de espera: a fase e a unidade para onde o processo volta.
                espera: data.espera ? { fase: String(data.espera.fase || ''), unidade: String(data.espera.unidade || ''), desde: String(data.espera.desde || '') } : null,
                campos_exigidos: data.campos_exigidos || {},
            },
            hoje: hojeBrasil(),
            movimentos: movimentos.map((m) => ({ ...m, ...extrasDoEvento(m as never, new Map(documentos.map((d) => [d.id, d]))) })),
            documentos,
            informacoes: informacoes.map((i) => ([i.ref, ...(i.refs || [])].some(fechada)
                ? { ...i, restrito: true, ref: marcar(i.ref), ...(i.refs ? { refs: i.refs.map(marcar) } : {}) } : i)),
            cadeiaQuebradaEm: verificarCadeia(movsBrutos as never),
            posse,
            pode_excluir: podeExcluirProcesso(data as never, movimentos as never, c.ctx),
        };
    }

    if (p.action === 'autuar') {
        let unidadeId = String(p.unidade_id || '');
        // Unidade fixa pelo tipo: a sugerida, se quem autua está lotado nela; senão a escolhida (a de quem autua).
        if (p.tipo_id) {
            const t = (await db.collection(COL.tipos).doc(String(p.tipo_id)).get()).data();
            const sugerida = String(t?.unidade_inicial || '');
            if (t?.organization_id === orgId && formularioDe(t).unidade === 'oculto' && sugerida && c.ctx.unidadeIds.includes(sugerida)
                && c.unidades.some((u) => u.id === sugerida && u.ativa !== false)) unidadeId = sugerida;
        }
        const unidade = c.unidades.find((u) => u.id === unidadeId && u.ativa !== false);
        if (!unidade) throw new HttpsError('invalid-argument', 'Escolha a unidade que autua o processo');
        if (!c.ctx.unidadeIds.includes(unidadeId)) {
            throw new HttpsError('permission-denied', 'Você só autua processos em unidade onde está lotado');
        }
        // Tipo de processo: define o rito e o sigilo padrão.
        let tipo: admin.firestore.DocumentData | null = null;
        if (p.tipo_id) {
            tipo = (await db.collection(COL.tipos).doc(String(p.tipo_id)).get()).data() || null;
            if (!tipo || tipo.organization_id !== orgId || tipo.ativo === false || tipo.excluido === true) throw new HttpsError('invalid-argument', 'Escolha um tipo de processo ativo');
            if (tipo.orgao_id && tipo.orgao_id !== (unidade.orgao_id || null)) {
                const dono = nomeOrgao(await lerOrgaos(db, orgId), tipo.orgao_id);
                // Órgão removido deixa o tipo livre; órgão existente restringe.
                if (dono) throw new HttpsError('failed-precondition', `${tipo.nome} é um tipo de processo de ${dono}. Autue por uma unidade desse órgão.`);
            }
        }
        const ritoSnap = await db.collection(COL.ritos).doc(String(tipo?.rito_id || p.rito_id || '_')).get();
        const rito = ritoSnap.data();
        if (!ritoSnap.exists || !rito || rito.organization_id !== orgId || rito.ativo === false || rito.excluido === true) {
            throw new HttpsError('invalid-argument', tipo ? 'O rito deste tipo de processo está inativo. Ajuste o tipo na Configuração.' : 'Escolha um rito ativo');
        }
        if (!tipo && rito.exigir_tipo === true) throw new HttpsError('failed-precondition', `O rito "${rito.nome}" só é autuado por um tipo de processo. Escolha o tipo.`);
        // Formulário do tipo: o que se pede, o que é obrigatório, o que não se usa e os campos próprios.
        const form = formularioDe(tipo);
        // Sigilo e urgência fora do formulário valem o que o tipo define.
        const sigilo = (form.sigilo === 'oculto' ? tipo?.sigilo_padrao : p.sigilo || tipo?.sigilo_padrao) === 'restrito' ? 'restrito' : 'normal';
        const urgente = (form.urgencia !== 'oculto' && p.urgente === true) || tipo?.urgente === true;
        const motivoUrgencia = texto(p.motivo_urgencia, MAX_TEXTO_LONGO) || (tipo?.urgente === true ? `Tipo de processo urgente (${tipo.nome})` : '');
        if (urgente && !motivoUrgencia) throw new HttpsError('invalid-argument', 'Informe o motivo da urgência');
        const assuntoInformado = form.assunto === 'oculto' ? '' : texto(p.assunto);
        const descricao = form.descricao === 'oculto' ? '' : texto(p.descricao, MAX_TEXTO_LONGO);
        const partes = form.partes === 'oculto' ? [] : sanitizePartes(p.partes, form.polos);
        // Nascido de outro registro: a origem vale mesmo que o formulário não a peça.
        const refOrigem = await refDaOrigem(c, p.origem?.ref);
        const origemInformada = form.origem === 'oculto' ? null : sanitizeOrigem(p.origem);
        const origem: Origem | null = refOrigem
            ? { tipo: origemInformada?.tipo || (refOrigem.modulo === 'pe' ? 'outro_processo' : 'outro'), descricao: origemInformada?.descricao || '', ref: refOrigem }
            : origemInformada;
        let campos: CampoValor[] = [];
        try {
            validarPadrao(form, { assunto: assuntoInformado, descricao, partes, origem });
            campos = validarCampos(form, p.campos, [], await refsDoFormulario(db, orgId, c.org, form, p.campos));
        } catch (e) { erroUsuario(e); }
        // Sem assunto pedido, o processo se chama pelo tipo.
        const assunto = assuntoInformado || tipo?.nome || rito.nome;
        // Numeração: a do tipo, a do órgão ou nenhuma (identificador SN-...).
        const numTipo = numeracaoTipoDe(tipo?.numeracao);
        const numeracao = numTipo.modo === 'nenhuma' ? null
            : numTipo.modo === 'propria' ? { partes: numTipo.partes! }
                : numeracaoDe((await db.collection(COL.config).doc(orgId).get()).data()?.numeracao);
        const usaOrgao = numeracao?.partes.some((x) => x.t === 'sigla_orgao' || (x.t === 'seq' && x.escopo === 'orgao'));
        const orgao = usaOrgao && unidade.orgao_id ? (await lerOrgaos(db, orgId)).find((o) => o.id === unidade.orgao_id) || null : null;
        const ctxNumero = { hoje: hojeBrasil(), tipo: tipo ? { id: String(p.tipo_id), sigla: tipo.sigla, nome: tipo.nome } : null, unidade, orgao };
        const procRef = db.collection(COL.processos).doc();
        // Primeira fase com prazo automático: a contagem usa o calendário do órgão.
        const calendarioAutuacao = (rito.fases as Fase[])[0]?.prazo_auto
            ? sanitizeCalendario((await db.collection(COL.config).doc(orgId).get()).data()?.calendario) : undefined;
        const contadorRef = numeracao ? db.collection(COL.contadores).doc(chaveContador(orgId, numeracao, ctxNumero)) : null;
        const numero = await db.runTransaction(async (tx) => {
            let numero = identificadorSemNumero(procRef.id);
            if (numeracao && contadorRef) {
                const cont = await tx.get(contadorRef);
                let seq = (Number(cont.data()?.seq) || 0) + 1;
                // O número nunca se repete: se uma mudança de numeração fizer a
                // contagem cair num número já usado, pula para o próximo livre.
                // ponytail: até MAX_PULOS consultas; acima disso, pede ajuste da numeração.
                for (let i = 0; ; i++, seq++) {
                    numero = formatarNumero(numeracao, ctxNumero, seq);
                    const repetido = await tx.get(db.collection(COL.processos).where('organization_id', '==', orgId).where('numero', '==', numero).limit(1));
                    if (repetido.empty) break;
                    if (i >= MAX_PULOS) throw new HttpsError('failed-precondition', `Os números a partir de ${numero} já existem. Peça ao administrador para ajustar a numeração em Configuração, Tipos de processo.`);
                }
                tx.set(contadorRef, { organization_id: orgId, chave: contadorRef.id, seq, atualizado_em: new Date().toISOString() }, { merge: true });
            }
            const fases = rito.fases as Fase[];
            // Campos que o tipo exige para sair de cada fase (cópia: mudar o tipo depois não muda este processo).
            const exigidos = camposExigidos(form, fases.map((f) => f.id));
            const base = {
                organization_id: orgId,
                numero,
                ...(numeracao ? {} : { sem_numero: true }),
                assunto,
                descricao,
                partes,
                campos,
                ...(Object.keys(exigidos).length ? { campos_exigidos: exigidos } : {}),
                sigilo,
                ...(origem ? { origem } : {}),
                // Registros e processos ligados (origem e campos), para "Processos eletrônicos" no outro módulo.
                vinculos: vinculosDe(origem, campos),
                ...(urgente ? { urgente: true, urgencia: { motivo: motivoUrgencia, por: c.userName, em: new Date().toISOString() } } : {}),
                ...(tipo ? { tipo_id: String(p.tipo_id), tipo_nome: tipo.nome, tipo_versao: Number(tipo.versao) || 1 } : {}),
                status: 'em_tramitacao',
                rito_id: ritoSnap.id,
                rito_nome: rito.nome,
                rito_versao: rito.versao || 1,
                fases,
                fase_atual: fases[0].id,
                unidade_atual: unidadeId,
                unidades_historico: [unidadeId],
                responsavel_uid: null,
                autuado_por: auth.uid,
                autuado_por_nome: c.userName,
                autuado_em: new Date().toISOString(),
                created_at: FieldValue.serverTimestamp(),
                mov_seq: 0,
                doc_seq: 0,
                ultimo_hash: '',
                version: 0,
                pendencias: [],
                prazos: [],
                ...derivados([], []),
            };
            const ef = efeitosDaMudanca(base, null, fases[0], calendarioAutuacao, c.userName);
            const mov = registrarMovimento(tx, c, procRef, base, 'autuacao',
                `Processo${tipo ? ` (${tipo.nome})` : ''} autuado na unidade ${unidade.nome}, rito ${rito.nome} (versão ${base.rito_versao}), fase ${fases[0].nome}.${urgente ? ` Tramitação urgente: ${motivoUrgencia}` : ''}${ef.texto}`,
                { assunto, rito_id: ritoSnap.id, rito_versao: base.rito_versao, unidade: unidadeId, ...(urgente ? { urgente: true } : {}), ...(origem ? { origem } : {}),
                    ...(campos.length ? { campos: Object.fromEntries(campos.map((x) => [x.rotulo, valorTexto(x)])) } : {}) });
            const mi = registrarInternos(tx, c, procRef, { ...base, ...mov }, ef.interno);
            tx.set(procRef, { ...base, ...ef.campos, ...mov, ...mi });
            return numero;
        });
        return { success: true, id: procRef.id, numero };
    }

    return movimentar(c, p);
});

/**
 * Avanço automático da fase (`avanco: 'auto'`): cumprido o último item
 * obrigatório (ação marcada, documento juntado ou guardado), o processo segue
 * para a saída do rito, com a remessa à unidade
 * da fase de destino quando ela é outra. É o mesmo ato do botão "Concluir e
 * seguir", com as mesmas conferências; se ele não couber (algo em aberto, mais
 * de uma saída, o processo mudou), nada acontece e o botão continua na tela.
 */
export async function avancarSozinho(c: Ctx, id: string): Promise<Record<string, unknown> | null> {
    try {
        const d = (await c.db.collection(COL.processos).doc(id).get()).data();
        if (!d) return null;
        const tipo = d.campos_exigidos && d.tipo_id ? (await c.db.collection(COL.tipos).doc(String(d.tipo_id)).get()).data() : null;
        const form = tipo && tipo.organization_id === c.orgId ? formularioDe(tipo) : null;
        if (exigenciasAbertas(d, form).length) return null;
        const saida = saidaAutomatica(d, c.unidades.filter((u) => u.ativa !== false).map((u) => String(u.id)));
        if (!saida) return null;
        const r = await movimentar(c, {
            organizationId: c.orgId, id, version: d.version, fase_id: saida.fase_id,
            ...(saida.unidade_destino ? { action: 'tramitar', unidade_destino: saida.unidade_destino } : { action: 'avancarFase' }),
        } as ProcRequest, { automatico: true });
        const fase = ((d.fases || []) as Fase[]).find((f) => f.id === saida.fase_id);
        return { ...r, avancou: { fase: fase?.nome || '', unidade: saida.unidade_destino ? nomeUnidade(c, saida.unidade_destino) : '', arquivado: fase?.ao_entrar?.arquivar === true } };
    } catch (e) {
        console.warn('[secretaria] avanço automático não aplicado', id, (e as Error)?.message);
        return null;
    }
}

/**
 * Movimentação de um processo existente. `opcoes.automatico`: chamada do
 * próprio servidor (avanço automático da fase); nunca vem do cliente.
 */
async function movimentar(c: Ctx, p: ProcRequest, opcoes: { automatico?: boolean } = {}): Promise<Record<string, unknown>> {
    const { db, orgId } = c;
    const textoAuto = opcoes.automatico ? ' Avanço automático: o que a fase exigia foi cumprido.' : '';
    let tentarAuto = false;
    let registroArquivado: Arquivado | null = null;
    // ---- Movimentações sobre um processo existente --------------------------
    const motivo = texto(p.motivo, MAX_TEXTO_LONGO);
    // Feriados locais e recesso do órgão entram na contagem de prazos.
    const calendario: CalendarioOrgao | undefined = ['abrirPrazo', 'tramitar', 'avancarFase'].includes(String(p.action))
        ? sanitizeCalendario((await db.collection(COL.config).doc(orgId).get()).data()?.calendario)
        : undefined;
    const cfgCom = p.action === 'expedirComunicacao' ? await configComunicacoes(db, orgId) : null;
    let expedidas = 1;
    const convite = { token: '', email: '', parte: '', numero: '', representaQuem: '' };
    let recebeu: { unidadeId: string; proc: admin.firestore.DocumentData } | null = null;
    let pendenciaAberta: { proc: admin.firestore.DocumentData; descricao: string } | null = null;
    const resultado = await db.runTransaction(async (tx) => {
        const { ref, data } = await lerProcesso(c, p.id, tx);
        conferirVersao(data, p.version);
        exigirPosse(c, data);
        // Campos exigidos por fase: valem os que o tipo ainda pede (lido antes de qualquer escrita).
        const tipoAtual = data.campos_exigidos && data.tipo_id && ['tramitar', 'avancarFase', 'alterarStatus'].includes(String(p.action))
            ? (await tx.get(db.collection(COL.tipos).doc(String(data.tipo_id)))).data() : null;
        const formAtual = tipoAtual && tipoAtual.organization_id === orgId ? formularioDe(tipoAtual) : null;
        if (data.status === 'arquivado' && p.action !== 'alterarStatus') {
            throw new HttpsError('failed-precondition', 'Processo arquivado: reative-o antes de movimentar');
        }
        // Registro ligado (consulta, expediente) cuja situação o rito conduz: lido antes de qualquer escrita.
        const registros = ['tramitar', 'avancarFase', 'atribuir'].includes(String(p.action)) ? await lerRegistrosDoRito(tx, c, data) : SEM_REGISTROS;

        if (p.action === 'tramitar') {
            const destino = c.unidades.find((u) => u.id === p.unidade_destino && u.ativa !== false);
            if (!destino) throw new HttpsError('invalid-argument', 'Unidade de destino inválida');
            if (destino.id === data.unidade_atual) throw new HttpsError('invalid-argument', 'O processo já está nessa unidade');
            // Remessa a gabinete é conclusão: o processo vai para quem decide.
            const conclusao = destino.tipo === 'gabinete';
            // Opcional, num só ato: mudar a fase (quando a próxima corre em outra unidade)
            // e deixar uma orientação para a unidade que recebe (devolução do gabinete).
            const fases = (data.fases || []) as Fase[];
            const novaFase = p.fase_id ? fases.find((f) => f.id === p.fase_id) : null;
            if (p.fase_id && !novaFase) throw new HttpsError('invalid-argument', 'Fase inválida');
            if (novaFase && novaFase.id === data.fase_atual) throw new HttpsError('invalid-argument', 'O processo já está nessa fase');
            if (novaFase && data.fase_suspensa === true) throw new HttpsError('failed-precondition', 'A fase está interrompida por pendência aberta. O decisor precisa apreciá-la antes.');
            const foraDoFluxo = !!novaFase && !saidasDoProcesso(data).some((f) => f.id === novaFase.id);
            const faseSai = fases.find((f) => f.id === data.fase_atual);
            const retomada = ehRetomada(data, faseSai, novaFase);
            // De volta à unidade em que estava: quem respondia pelo processo volta a responder, se ainda estiver lotado nela.
            const esp = data.espera as Espera | undefined;
            const responsavelDeVolta = retomada && esp?.responsavel_uid && destino.id === esp.unidade && (destino.membros_uids || []).includes(esp.responsavel_uid) ? esp.responsavel_uid : null;
            if (foraDoFluxo && !motivo) throw new HttpsError('invalid-argument', `${novaFase!.nome} não é a próxima fase prevista no rito. Informe o motivo.`);
            const contraCondicao = novaFase && !foraDoFluxo ? foraDaCondicao(data, novaFase.id) : null;
            if (contraCondicao && !motivo) throw new HttpsError('invalid-argument', `O rito leva a ${novaFase!.nome} quando ${contraCondicao}. Informe o motivo para seguir por ela.`);
            const orientacao = texto(p.orientacao, MAX_TEXTO_LONGO);
            const faseDe = fases.find((f) => f.id === data.fase_atual)?.nome || data.fase_atual;
            // Remessa entre órgãos internos: o termo diz de qual órgão para qual.
            const orgaoDe = c.unidades.find((u) => u.id === data.unidade_atual)?.orgao_id || null;
            const orgaoPara = destino.orgao_id || null;
            const entreOrgaos = orgaoDe !== orgaoPara;
            const orgaos = entreOrgaos ? await lerOrgaos(db, orgId, tx) : [];
            const com = (nome: string, orgaoId: unknown) => (nomeOrgao(orgaos, orgaoId) ? `${nomeOrgao(orgaos, orgaoId)} › ${nome}` : nome);
            // Minutas que seguem com o processo (ex.: a da assessoria para o gabinete revisar e assinar).
            const idsMinutas = [...new Set((Array.isArray(p.minutas) ? p.minutas : []).map(String))].slice(0, MAX_MINUTAS_REMESSA);
            const minutas = await Promise.all(idsMinutas.map((id) => tx.get(ref.collection('documentos').doc(id))));
            for (const s of minutas) {
                const d = s.data();
                if (!d || d.status !== 'minuta' || !minutaAcessivel(d, [String(data.unidade_atual)])) {
                    throw new HttpsError('invalid-argument', 'Só seguem com o processo minutas que estão com a unidade que remete');
                }
            }
            // Ir para a espera não conclui a fase: o que falta nela fica para a volta, sem dispensa.
            const dispensadas = novaFase && !novaFase.espera ? dispensarExigencias(data, motivo, formAtual) : [];
            // O rito pode deixar a remessa fora dos autos (ex.: distribuição a assessoria).
            // Remessa entre órgãos muda quem é competente: sempre nos autos.
            const destinoMov = entreOrgaos || dispensadas.length ? 'autos' : destinoDoMovimento(fases, data.fase_atual, novaFase?.id);
            // Sair do grupo da certidão conjunta: a pendente é emitida antes da remessa.
            // A fase de destino pode arquivar ao entrar: a certidão pendente sai antes.
            const arquiva = novaFase?.ao_entrar?.arquivar === true;
            const em = emitirSe(!!novaFase && (arquiva || deveEmitir(fases, data.consolidacao, data.fase_atual, novaFase.id)), tx, c, ref, data);
            if (em.proc !== data) expedidas = 2;
            // A remessa já tira o responsável: os efeitos não repetem isso.
            const efFase = novaFase ? efeitosDaMudanca({ ...data, responsavel_uid: null }, String(data.fase_atual), novaFase, calendario, c.userName) : SEM_EFEITOS;
            const sit = aplicarSituacao(tx, c, registros, novaFase, responsavelDeVolta && novaFase?.situacao_registro?.ao_assumir ? 'ao_assumir' : 'ao_entrar', data);
            registroArquivado = sit.arquivou;
            const ef = { ...efFase, interno: [...efFase.interno, ...sit.notas] };
            const mov = registrarMovimento(tx, c, ref, em.proc, conclusao ? 'conclusao' : 'tramitacao',
                `${conclusao ? 'Conclusos a' : 'Remetido de ' + com(nomeUnidade(c, data.unidade_atual), orgaoDe) + ' para'} ${com(destino.nome, orgaoPara)}.`
                + `${novaFase ? ` Fase alterada de ${faseDe} para ${novaFase.nome}${marcaEspera(retomada, novaFase)}${foraDoFluxo ? ' (fora do fluxo do rito)' : contraCondicao ? ' (sem a resposta que o rito pede para esta saída)' : ''}.${ef.texto}` : ''}`
                + `${textoDispensa(dispensadas)}${motivo ? ` Motivo: ${motivo}` : ''}${orientacao ? ` Orientação: ${orientacao}` : ''}${textoAuto}`,
                { de: data.unidade_atual, para: destino.id, ...(opcoes.automatico ? { automatico: true } : {}), ...(entreOrgaos ? { orgao_de: orgaoDe, orgao_para: orgaoPara } : {}), ...(novaFase ? { fase_de: data.fase_atual, fase_para: novaFase.id, ...(retomada ? { retomada: true } : {}), ...(foraDoFluxo ? { fora_do_fluxo: true } : {}), ...(contraCondicao ? { fora_da_condicao: true } : {}) } : {}),
                    ...(dispensadas.length ? { dispensadas } : {}), ...marcasDoDestino(destinoMov), ...(idsMinutas.length ? { minutas: idsMinutas } : {}) });
            const mi = registrarInternos(tx, c, ref, { ...em.proc, ...mov }, ef.interno);
            if (ef.interno.length) expedidas += 1;
            const ma = arquiva ? arquivarPelaFase(tx, c, ref, { ...em.proc, ...mov, ...mi }, novaFase!) : {};
            if (arquiva) expedidas += 1;
            minutas.forEach((s) => tx.update(s.ref, { unidades_acesso: FieldValue.arrayUnion(destino.id) }));
            tx.update(ref, {
                ...em.mov,
                ...mov,
                ...mi,
                ...ma,
                unidade_atual: destino.id,
                unidades_historico: FieldValue.arrayUnion(destino.id),
                responsavel_uid: responsavelDeVolta,
                recebido_em: new Date().toISOString(),
                // Retomada: o que já foi cumprido na fase de origem continua valendo.
                ...(novaFase ? { fase_atual: novaFase.id, ...(retomada ? {} : camposAoEntrarNaFase(data, novaFase.id)), ...ef.campos, ...camposDaEspera(data, faseSai, novaFase) } : {}),
                orientacao: orientacao
                    ? { texto: orientacao, por: c.userName, em: new Date().toISOString(), de: nomeUnidade(c, data.unidade_atual) }
                    : FieldValue.delete(),
            });
            recebeu = { unidadeId: destino.id, proc: data };
            return mov;
        }

        if (p.action === 'alterarDados') {
            // Corrige a descrição e os campos próprios e, com motivo, retifica a
            // autuação (assunto, origem, sigilo e partes); o que mudou fica nos autos.
            const tipo = data.tipo_id ? (await tx.get(db.collection(COL.tipos).doc(String(data.tipo_id)))).data() : null;
            const antes = (data.campos || []) as CampoValor[];
            // Obrigatório criado depois da autuação não trava a correção de quem nunca o teve.
            const form = formParaCorrecao(formularioDe(tipo && tipo.organization_id === orgId ? tipo : null), antes, String(data.descricao || ''));
            const descricao = form.descricao === 'oculto' || !('descricao' in p) ? String(data.descricao || '') : texto(p.descricao, MAX_TEXTO_LONGO);
            // Cada dado da autuação só muda se vier no pedido (cliente antigo segue igual).
            const vem = (k: 'assunto' | 'origem' | 'sigilo' | 'partes') => k in p && form[k] !== 'oculto';
            const assuntoInformado = vem('assunto') ? texto(p.assunto) : '';
            const assunto = vem('assunto') ? assuntoInformado || String(data.tipo_nome || data.rito_nome || data.assunto) : String(data.assunto || '');
            const origemAntes = (data.origem || null) as Origem | null;
            let origem = origemAntes;
            if (vem('origem')) {
                const o = sanitizeOrigem(p.origem);
                // A ligação com o registro de origem nunca vem do cliente nem sai.
                origem = origemAntes?.ref ? { tipo: o?.tipo || origemAntes.tipo, descricao: o?.descricao || '', ref: origemAntes.ref } : o;
            }
            const sigilo = vem('sigilo') ? (p.sigilo === 'restrito' ? 'restrito' : 'normal') : data.sigilo;
            const partesAntes = (data.partes || []) as ParteGravada[];
            let ret = { partes: partesAntes, mudou: [] as string[], retiradas: [] as number[], renomeadas: [] as number[] };
            let campos: CampoValor[] = [];
            try {
                if (vem('partes')) ret = retificarPartes(partesAntes, p.partes, form.polos, MAX_PARTES, { em: new Date().toISOString(), por: c.userName });
                validarPadrao({ ...form, ...(vem('assunto') ? {} : { assunto: 'opcional' }), ...(vem('partes') ? {} : { partes: 'opcional' }), ...(vem('origem') ? {} : { origem: 'opcional' }) },
                    { assunto: assuntoInformado, descricao, partes: ret.partes.filter((x) => !x.retirada), origem });
                campos = 'campos' in p ? validarCampos(form, p.campos, antes, await refsDoFormulario(db, orgId, c.org, form, p.campos, antes)) : antes;
            } catch (e) { erroUsuario(e); }
            // Campo que o tipo deixou de ter continua no processo como foi gravado.
            const idsForm = new Set(form.campos.map((x) => x.id));
            if ('campos' in p) campos = [...campos, ...antes.filter((x) => !idsForm.has(x.id))];
            const retif: string[] = [];
            if (assunto !== String(data.assunto || '')) retif.push(`Assunto: "${data.assunto || ''}" → "${assunto}"`);
            if (sigilo !== data.sigilo) retif.push(`Sigilo: ${data.sigilo || 'normal'} → ${sigilo}`);
            if (JSON.stringify(origem ? { t: origem.tipo, d: origem.descricao } : null) !== JSON.stringify(origemAntes ? { t: origemAntes.tipo, d: origemAntes.descricao } : null)) retif.push('Origem alterada');
            retif.push(...ret.mudou);
            const mudou = diferencasCampos(antes, campos);
            if (descricao !== String(data.descricao || '')) mudou.unshift('Descrição alterada');
            if (!mudou.length && !retif.length) throw new HttpsError('invalid-argument', 'Nada foi alterado');
            const extra: Record<string, unknown> = {};
            if (retif.length) {
                if (motivo.replace(/[^\p{L}]/gu, '').length < 5) throw new HttpsError('invalid-argument', 'Informe o motivo da retificação (ao menos 5 letras)');
                // Parte que sai com comunicação aguardando ciência: a ciência por decurso correria contra quem saiu.
                const pendente = ((data.comunicacoes || []) as { parte_idx: number; status: string }[]).find((x) => x.status === 'aguardando' && ret.retiradas.includes(x.parte_idx));
                if (pendente) throw new HttpsError('failed-precondition', `${partesAntes[pendente.parte_idx]?.nome || 'A parte'} tem comunicação aguardando ciência. Torne sem efeito as comunicações pendentes antes de retirar a parte.`);
                const convites = db.collection(COL.convites);
                for (const i of ret.retiradas) {
                    // Quem sai perde o portal: convites revogados e contas desligadas, também dos representantes.
                    const { uid: _u, convite_hash: hash, ...resto } = ret.partes[i];
                    if (hash) tx.set(convites.doc(hash), { revogado: true }, { merge: true });
                    const reps = (resto.representantes || []).map(({ uid: _r, convite_hash: h, ...r }) => {
                        if (h) tx.set(convites.doc(h), { revogado: true }, { merge: true });
                        return r;
                    });
                    ret.partes[i] = { ...resto, ...(resto.representantes ? { representantes: reps } : {}) };
                }
                // Quem mudou de nome continua com o que é seu: convite pendente,
                // prazo aberto, comunicação aguardando ciência e petição em aberto
                // (o portal casa prazos e petições pelo nome).
                let prazos = (data.prazos || []) as Prazo[];
                let pendencias = (data.pendencias || []) as Pendencia[];
                let comunicacoes = (data.comunicacoes || []) as Array<{ parte_idx: number; status: string; parte_nome?: string }>;
                for (const i of ret.renomeadas) {
                    const x = ret.partes[i];
                    const velho = partesAntes[i].nome;
                    if (x.convite_hash) tx.set(convites.doc(x.convite_hash), { parte_nome: x.nome }, { merge: true });
                    for (const r of x.representantes || []) if (r.convite_hash) tx.set(convites.doc(r.convite_hash), { parte_nome: x.nome }, { merge: true });
                    prazos = prazos.map((q) => (q.status === 'aberto' && q.destinatario === velho ? { ...q, destinatario: x.nome } : q));
                    pendencias = pendencias.map((q) => (q.status === 'aberta' && String(q.aberta_por || '').startsWith(`${velho} (`) ? { ...q, aberta_por: `${x.nome}${String(q.aberta_por).slice(velho.length)}` } : q));
                    comunicacoes = comunicacoes.map((q) => (q.parte_idx === i && q.status === 'aguardando' ? { ...q, parte_nome: x.nome } : q));
                }
                if (ret.renomeadas.length) Object.assign(extra, { prazos, pendencias, comunicacoes });
                if (ret.retiradas.length) {
                    extra.partes_uids = [...new Set(ret.partes.filter((x) => !x.retirada).flatMap((x) => [x.uid, ...(x.representantes || []).map((r) => r.uid)]).filter((u): u is string => !!u))];
                }
                extra.partes = ret.partes;
                extra.assunto = assunto;
                extra.sigilo = sigilo;
                extra.origem = origem;
            }
            // Retificação mexe na identificação do processo: sempre nos autos, com o termo próprio.
            const mov = retif.length
                ? registrarMovimento(tx, c, ref, data, 'retificacao',
                    `Autuação retificada. Motivo: ${motivo}. ${[...retif, ...mudou].join('; ')}.`.slice(0, MAX_TEXTO_LONGO),
                    { motivo, campos: mudou.length, retificados: retif.length, visivel_partes: false })
                : registrarMovimento(tx, c, ref, data, 'dados',
                    `Dados do processo alterados. ${mudou.join('; ')}.${motivo ? ` Motivo: ${motivo}` : ''}`.slice(0, MAX_TEXTO_LONGO),
                    { campos: mudou.length, visivel_partes: false, ...marcasNaFase(data, 'dados') });
            tx.update(ref, { ...mov, descricao, campos, ...extra, vinculos: vinculosDe(origem, campos, data.vinculos_acoes || []) });
            return mov;
        }

        if (p.action === 'concluirOrientacao') {
            if (!data.orientacao) throw new HttpsError('failed-precondition', 'Não há orientação pendente');
            const mov = registrarMovimento(tx, c, ref, data, 'orientacao_concluida',
                `Orientação de ${data.orientacao.de || 'outra unidade'} concluída: ${data.orientacao.texto}${motivo ? ` ${motivo}` : ''}`);
            tx.update(ref, { ...mov, orientacao: FieldValue.delete() });
            return mov;
        }

        if (p.action === 'marcarAcao') {
            // Caixa de marcar das ações da fase: movimento interno leve, sem documento.
            const fase = ((data.fases || []) as Fase[]).find((f) => f.id === data.fase_atual);
            const idx = Number(p.acao_idx);
            const acao = fase?.acoes?.[idx];
            if (!fase || !acao) throw new HttpsError('invalid-argument', 'Ação da fase inválida');
            const regra = fase.acoes_regras?.[idx];
            if (regra?.pede === 'orientacao') throw new HttpsError('failed-precondition', `"${acao}" é só orientação: não se marca.`);
            // Fase que segue sozinha: cumprida uma ação obrigatória, o servidor confere, depois deste ato, se era a última.
            tentarAuto = fase.avanco === 'auto' && p.feita !== false && regra?.obrigatoria === true && !opcoes.automatico;
            const respostas = respostasDaFase(data);
            // Ação condicional: só vale com a resposta que o rito pede.
            if (p.feita !== false && !acaoAtiva(fase, idx, respostas)) {
                throw new HttpsError('failed-precondition', `"${acao}" só vale quando ${textoCondicao(fase, regra!.se!)}`);
            }
            // Quem pode cumprir: o rito pode reservar ao responsável designado ou a quem gere a unidade.
            if (regra?.quem && !c.ctx.isAdmin) {
                const pode = regra.quem === 'responsavel' ? data.responsavel_uid === c.ctx.uid : c.gestorDe.includes(String(data.unidade_atual));
                if (!pode) {
                    throw new HttpsError('permission-denied', regra.quem === 'responsavel'
                        ? `"${acao}" é do responsável pelo processo. Peça a atribuição ou a quem está designado.`
                        : `"${acao}" é de quem gere a unidade.`);
                }
            }
            // Ação que o rito liga a um documento se cumpre na juntada (ou guardando o documento), não aqui.
            if (regra?.documento) {
                throw new HttpsError('failed-precondition', regra.documento.destino
                    ? `"${acao}" se cumpre guardando o documento no processo. Redija ou envie o documento e use "Guardar fora dos autos".`
                    : `"${acao}" se cumpre com a juntada do documento. Redija ou envie o documento e junte-o aos autos.`);
            }
            const feita = p.feita !== false;
            const feitas: Record<string, number[]> = { ...(data.acoes_feitas || {}) };
            const lista = new Set<number>(feitas[fase.id] || []);
            // Duas pessoas marcando a mesma caixa: a segunda não gera movimento repetido.
            if (lista.has(idx) === feita) throw new HttpsError('aborted', feita ? 'Esta ação já estava feita' : 'Esta ação já estava desfeita');
            // O dado que a ação pede (texto, número, data, escolha), conferido como num campo do processo.
            const dado = feita ? await valorDaAcao(c, regra, acao, p.valor) : null;
            // Dado reservado: só quem gere a unidade (e quem registra, e a administração) o vê.
            // Fica fora da descrição do movimento, que vai às listas, ao extrato e aos autos.
            const reservado = !!dado && regra?.ve === 'gestor';
            // Registro de origem restrita: as partes nunca o veem.
            const vePartes = partesVeem(regra) && !dado?.restrito && !reservado;
            if (feita) lista.add(idx); else lista.delete(idx);
            feitas[fase.id] = [...lista].sort((a, b) => a - b);
            // Resposta de escolha guardada na rodada da fase: as ações e saídas condicionadas a leem.
            // No formulário, cada campo de escolha preenchido responde por si ('2.sistema').
            const respondeu = respondeNaRodada(regra);
            const todasRespostas = { ...(data.acoes_respostas || {}) } as Record<string, Record<string, string>>;
            if (respondeu) {
                const daFase = Object.fromEntries(Object.entries(todasRespostas[fase.id] || {}).filter(([k]) => !respostaDaAcao(k, idx)));
                if (feita && dado) Object.assign(daFase, respostasDaAcao(regra, idx, dado.valor));
                todasRespostas[fase.id] = daFase;
            }
            const comResposta = respondeu ? { acoes_respostas: todasRespostas } : {};
            // O rito diz onde fica: certidão nos autos (com folha), evento no extrato, só no sistema ou sem evento.
            const dest = destinoDaAcao(regra);
            const comDado = !dado ? '' : reservado ? ` ${dado.rotulo}: reservado a quem gere a unidade.` : ` ${dado.rotulo}: ${dado.valor_texto}.`;
            if (dest === 'consolidar') {
                // Certidão conjunta: o ato fica oculto e entra como item da certidão do grupo.
                const grupo = grupoDe(fase);
                const cons = data.consolidacao as Consolidacao | undefined;
                const pendente = cons?.grupo === grupo ? (cons.itens || []) : [];
                const k = pendente.map((i) => i.fase_id === fase.id && i.acao_idx === idx).lastIndexOf(true);
                if (!feita && k < 0) {
                    // Já saiu em certidão emitida: desfazer precisa constar dos autos.
                    const mov = registrarMovimento(tx, c, ref, data, 'acao_fase',
                        `Certifico que foi desfeita a providência "${acao}", da fase ${fase.nome}.`,
                        { fase_id: fase.id, acao_idx: idx, feita, destino: 'autos', nos_autos: true, visivel_partes: partesVeem(regra) });
                    tx.update(ref, { ...mov, acoes_feitas: feitas, ...comResposta });
                    return mov;
                }
                const item: ItemCertidao = {
                    seq: 0, fase_id: fase.id, acao_idx: idx,
                    texto: textoDoItem(`"${acao}", da fase ${fase.nome}.${comDado}`.replace(/\.$/, '')),
                    autor: c.userName, em: new Date().toISOString(), partes: vePartes,
                };
                const em = emitirSe(feita && antesDeJuntar(data, grupo, item), tx, c, ref, data);
                if (em.proc !== data) expedidas = 2;
                const mov = registrarMovimento(tx, c, ref, em.proc, 'acao_fase',
                    `${feita ? 'Feita' : 'Desfeita'} a ação "${acao}" da fase ${fase.nome}.${comDado} ${feita ? 'Entra na' : 'Sai da'} certidão conjunta, ainda não emitida.`,
                    {
                        fase_id: fase.id, acao_idx: idx, feita,
                        ...(dado ? { rotulo: dado.rotulo, tipo_valor: dado.tipo, valor: dado.valor, valor_texto: dado.valor_texto, ...(dado.ref ? { ref: dado.ref } : {}) } : {}),
                        ...(dado && regra?.folha_dados ? { folha_dados: true } : {}),
                        // O ato fica oculto; o dado segue a regra (as partes o veem nas informações, se ela disser).
                        destino: dest, consolidada: true, ...marcasDoDestino('nenhum'), visivel_partes: vePartes,
                    });
                const consolidacao = feita
                    ? itensDepois(em.proc, grupo, { ...item, seq: Number(mov.mov_seq) })
                    : { grupo, itens: pendente.filter((_, j) => j !== k) };
                tx.update(ref, { ...em.mov, ...mov, acoes_feitas: feitas, ...comResposta, consolidacao: consolidacao.itens.length ? consolidacao : FieldValue.delete(), ...vinculoDaAcao(dado) });
                return mov;
            }
            const mov = registrarMovimento(tx, c, ref, data, 'acao_fase',
                dest === 'autos'
                    ? `Certifico que ${feita ? 'foi cumprida' : 'foi desfeita'} a providência "${acao}", da fase ${fase.nome}.${comDado}`
                    : `${feita ? 'Feita' : 'Desfeita'} a ação "${acao}" da fase ${fase.nome}.${comDado}`,
                {
                    fase_id: fase.id, acao_idx: idx, feita,
                    ...(dado ? { rotulo: dado.rotulo, tipo_valor: dado.tipo, valor: dado.valor, valor_texto: dado.valor_texto, ...(dado.ref ? { ref: dado.ref } : {}) } : {}),
                    ...(reservado ? { reservado: 'gestor', ve_unidade: String(data.unidade_atual || '') } : {}),
                    // O rito manda o dado para a folha de dados do processo (evento 1 do PDF).
                    ...(dado && regra?.folha_dados && !reservado ? { folha_dados: true } : {}),
                    destino: dest,
                    ...(dest === 'autos' ? { nos_autos: true } : {}),
                    ...(dest === 'informacao' ? { fora_impressao: true } : {}),
                    visivel_partes: vePartes,
                    ...(dest === 'nenhum' ? marcasDoDestino('nenhum') : {}),
                });
            tx.update(ref, { ...mov, acoes_feitas: feitas, ...comResposta, ...vinculoDaAcao(dado) });
            return mov;
        }

        if (p.action === 'atribuir') {
            const alvo = p.responsavel_uid || null;
            const unidade = c.unidades.find((u) => u.id === data.unidade_atual);
            if (alvo && !(unidade?.membros_uids || []).includes(alvo)) {
                throw new HttpsError('invalid-argument', 'A pessoa precisa estar lotada na unidade que tem o processo');
            }
            const nomeAlvo = alvo ? (await tx.get(db.collection('userOrganizations').doc(`${alvo}_${orgId}`))).data()?.user_name || 'membro' : '';
            // A fase pode mudar a situação do registro ligado quando alguém assume (ex.: a consulta entra em elaboração).
            const faseAtual = ((data.fases || []) as Fase[]).find((f) => f.id === data.fase_atual);
            const sit = alvo ? aplicarSituacao(tx, c, registros, faseAtual, 'ao_assumir', data, { uid: String(alvo), nome: formatPersonName(String(nomeAlvo)) }) : { notas: [], arquivou: null };
            registroArquivado = sit.arquivou;
            const mov = registrarMovimento(tx, c, ref, data, 'atribuicao',
                alvo ? `Atribuído a ${nomeAlvo}.` : 'Atribuição removida.', { responsavel_uid: alvo, ...marcasNaFase(data, 'atribuicao') });
            const mi = registrarInternos(tx, c, ref, { ...data, ...mov }, sit.notas);
            tx.update(ref, { ...mov, ...mi, responsavel_uid: alvo });
            return { ...mov, ...mi };
        }

        if (p.action === 'avancarFase') {
            const fases = (data.fases || []) as Fase[];
            const alvo = p.fase_id
                ? fases.find((f) => f.id === p.fase_id)
                : saidasDoProcesso(data).find((f) => !f.espera) || null;
            if (!alvo) throw new HttpsError('invalid-argument', 'Não há fase seguinte; escolha uma fase do rito');
            if (alvo.id === data.fase_atual) throw new HttpsError('invalid-argument', 'O processo já está nessa fase');
            if (data.fase_suspensa === true) {
                throw new HttpsError('failed-precondition', 'A fase está interrompida por pendência aberta. O decisor precisa apreciá-la antes.');
            }
            // Sair do fluxo desenhado no rito é permitido, mas exige justificativa.
            const foraDoFluxo = !saidasDoProcesso(data).some((f) => f.id === alvo.id);
            const faseSai = fases.find((f) => f.id === data.fase_atual);
            const retomada = ehRetomada(data, faseSai, alvo);
            if (foraDoFluxo && !motivo) throw new HttpsError('invalid-argument', `${alvo.nome} não é a próxima fase prevista no rito. Informe o motivo.`);
            const contraCondicao = foraDoFluxo ? null : foraDaCondicao(data, alvo.id);
            if (contraCondicao && !motivo) throw new HttpsError('invalid-argument', `O rito leva a ${alvo.nome} quando ${contraCondicao}. Informe o motivo para seguir por ela.`);
            const de = fases.find((f) => f.id === data.fase_atual)?.nome || data.fase_atual;
            // Ir para a espera não conclui a fase: o que falta nela fica para a volta, sem dispensa.
            const dispensadas = alvo.espera ? [] : dispensarExigencias(data, motivo, formAtual);
            const destinoMov = dispensadas.length ? 'autos' : destinoDoMovimento(fases, data.fase_atual, alvo.id);
            // Certidão conjunta: sair do grupo emite a pendente; mudar dentro dele pode virar item dela
            // (nunca com dispensa, que vai aos autos, nem quando as duas fases pedem "sem evento").
            // Motivo longo não se resume numa certidão conjunta: a mudança tem termo próprio.
            const grupo = grupoDe(alvo);
            const descricao = `Fase alterada de ${de} para ${alvo.nome}${marcaEspera(retomada, alvo)}${foraDoFluxo ? ' (fora do fluxo do rito)' : contraCondicao ? ' (sem a resposta que o rito pede para esta saída)' : ''}.${textoDispensa(dispensadas)}${motivo ? ` ${motivo}` : ''}${textoAuto}`;
            // A fase de destino pode arquivar ao entrar: a certidão pendente sai antes e a mudança tem termo próprio.
            const arquiva = alvo.ao_entrar?.arquivar === true;
            const junta = !arquiva && !dispensadas.length && destinoMov !== 'nenhum' && descricao.length <= MAX_ITEM_CERTIDAO && mudancaNaCertidao(fases, data.fase_atual, alvo.id);
            const item: ItemCertidao = { seq: 0, fase_id: data.fase_atual, texto: descricao.replace(/\.$/, ''), autor: c.userName, em: new Date().toISOString(), partes: destinoMov === 'autos' };
            const em = emitirSe(arquiva || deveEmitir(fases, data.consolidacao, data.fase_atual, alvo.id) || (junta && antesDeJuntar(data, grupo, item)), tx, c, ref, data);
            if (em.proc !== data) expedidas = 2;
            // Retomada: quem respondia pelo processo continua, mesmo que a fase tire o responsável ao entrar.
            const alvoEf = retomada && alvo.ao_entrar?.sem_responsavel ? { ...alvo, ao_entrar: { ...alvo.ao_entrar, sem_responsavel: undefined } } : alvo;
            const efFase = efeitosDaMudanca(data, String(data.fase_atual), alvoEf, calendario, c.userName);
            const sit = aplicarSituacao(tx, c, registros, alvo, retomada && data.responsavel_uid && alvo.situacao_registro?.ao_assumir ? 'ao_assumir' : 'ao_entrar', data);
            registroArquivado = sit.arquivou;
            const ef = { ...efFase, interno: [...efFase.interno, ...sit.notas] };
            const mov = registrarMovimento(tx, c, ref, em.proc, 'fase', `${descricao}${junta ? ' Entra na certidão conjunta.' : ''}${ef.texto}`,
                { de: data.fase_atual, para: alvo.id, ...(opcoes.automatico ? { automatico: true } : {}), ...(retomada ? { retomada: true } : {}), ...(foraDoFluxo ? { fora_do_fluxo: true } : {}), ...(contraCondicao ? { fora_da_condicao: true } : {}), ...(dispensadas.length ? { dispensadas } : {}),
                    ...(junta ? { consolidada: true, ...marcasDoDestino('nenhum') } : marcasDoDestino(destinoMov)) });
            const consolidacao = junta
                ? { consolidacao: itensDepois(em.proc, grupo, { ...item, seq: Number(mov.mov_seq) }) }
                : {};
            const mi = registrarInternos(tx, c, ref, { ...em.proc, ...mov, ...consolidacao }, ef.interno);
            if (ef.interno.length) expedidas += 1;
            const ma = arquiva ? arquivarPelaFase(tx, c, ref, { ...em.proc, ...mov, ...mi }, alvo) : {};
            if (arquiva) expedidas += 1;
            tx.update(ref, { ...em.mov, ...mov, ...mi, ...ma, ...consolidacao, fase_atual: alvo.id, ...(retomada ? {} : camposAoEntrarNaFase(data, alvo.id)), ...ef.campos, ...camposDaEspera(data, faseSai, alvo) });
            return { ...mov, ...mi, ...ma };
        }

        if (p.action === 'urgencia') {
            const urgente = p.urgente === true;
            if (urgente === (data.urgente === true)) throw new HttpsError('invalid-argument', urgente ? 'O processo já está marcado como urgente' : 'O processo não está marcado como urgente');
            if (!motivo) throw new HttpsError('invalid-argument', 'Informe o motivo');
            const mov = registrarMovimento(tx, c, ref, data, 'urgencia',
                `${urgente ? 'Processo marcado como urgente' : 'Urgência retirada'}. Motivo: ${motivo}`, { urgente, ...marcasNaFase(data, 'urgencia') });
            tx.update(ref, { ...mov, urgente, urgencia: urgente ? { motivo, por: c.userName, em: new Date().toISOString() } : FieldValue.delete() });
            return mov;
        }

        // ---- Comunicações às partes (intimação, notificação...) ---------------
        if (p.action === 'expedirComunicacao') {
            if (data.status !== 'em_tramitacao') throw new HttpsError('failed-precondition', 'O processo não está em tramitação');
            const lista = (p.comunicacao as { partes_idx?: unknown[] } | undefined)?.partes_idx;
            expedidas = Array.isArray(lista) ? new Set(lista).size || 1 : 1;
            return expedir(tx, c, ref, data, p.comunicacao, cfgCom!);
        }
        if (p.action === 'tornarSemEfeito') return tornarSemEfeito(tx, c, ref, data, p.comunicacao_id, motivo);

        if (p.action === 'alterarStatus') {
            const status = String(p.status || '');
            if (!['em_tramitacao', 'sobrestado', 'arquivado'].includes(status)) {
                throw new HttpsError('invalid-argument', 'Situação inválida');
            }
            if (status === data.status) throw new HttpsError('invalid-argument', 'O processo já está nessa situação');
            if (!motivo) throw new HttpsError('invalid-argument', 'Informe o motivo');
            const rotulo = { em_tramitacao: 'Reativado', sobrestado: 'Sobrestado', arquivado: 'Arquivado' }[status];
            // Arquivar com documento exigido em aberto: o motivo vale como dispensa, e fica dito.
            const dispensadas = status === 'arquivado' ? exigenciasAbertas(data, formAtual).map((e) => e.descricao) : [];
            // Arquivar encerra a certidão conjunta pendente (sobrestar, não: o processo volta à mesma fase).
            const em = emitirSe(status === 'arquivado', tx, c, ref, data);
            if (em.proc !== data) expedidas = 2;
            const ef = status === 'arquivado' ? efeitosDaMudanca(data, String(data.fase_atual), null, undefined, c.userName) : SEM_EFEITOS;
            const mov = registrarMovimento(tx, c, ref, em.proc, 'situacao',
                `${rotulo}. Motivo: ${motivo}${dispensadas.length ? ` Exigências do rito não cumpridas: ${dispensadas.join('; ')}.` : ''}${ef.texto}`,
                { de: data.status, para: status, ...(dispensadas.length ? { dispensadas } : {}) });
            const mi = registrarInternos(tx, c, ref, { ...em.proc, ...mov }, ef.interno);
            if (ef.interno.length) expedidas += 1;
            tx.update(ref, { ...em.mov, ...mov, ...mi, status, ...ef.campos });
            return mov;
        }

        if (p.action === 'emitirCertidao') {
            // "Emitir certidão agora": a pendente vai aos autos sem esperar o fim do grupo.
            const em = emitirSe(true, tx, c, ref, data);
            if (em.proc === data) throw new HttpsError('failed-precondition', 'Não há atos aguardando a certidão conjunta');
            tx.update(ref, em.mov);
            return em.mov;
        }

        // ---- Pendências: o que o decisor precisa apreciar --------------------
        const pendencias = (data.pendencias || []) as Pendencia[];
        const prazos = (data.prazos || []) as Prazo[];
        const agora = new Date().toISOString();

        if (p.action === 'abrirPendencia') {
            const descricao = texto(p.descricao, MAX_TEXTO_LONGO);
            if (!descricao) throw new HttpsError('invalid-argument', 'Descreva o que precisa ser apreciado');
            if (pendencias.length >= MAX_ITENS) throw new HttpsError('resource-exhausted', 'Limite de pendências do processo');
            const nova: Pendencia = {
                id: ref.collection('_').doc().id, tipo: 'manual', descricao, interrompe: p.interrompe === true,
                status: 'aberta', aberta_em: agora, aberta_por: c.userName,
            };
            const lista = [...pendencias, nova];
            const mov = registrarMovimento(tx, c, ref, data, 'pendencia',
                `Pendência aberta para o decisor: ${descricao}${nova.interrompe ? ' (fase interrompida)' : ''}.`, { pendencia_id: nova.id, interrompe: nova.interrompe, ...marcasNaFase(data, 'pendencia') });
            tx.update(ref, { ...mov, pendencias: lista, ...derivados(lista, prazos) });
            pendenciaAberta = { proc: data, descricao };
            return mov;
        }

        if (p.action === 'resolverPendencia') {
            // Apreciar é ato de decisão: só o gabinete que tem o processo.
            if (c.unidades.find((u) => u.id === data.unidade_atual)?.tipo !== 'gabinete') {
                throw new HttpsError('permission-denied', 'Pendências são apreciadas pelo gabinete. Faça a conclusão do processo antes.');
            }
            const alvo = pendencias.find((x) => x.id === p.pendencia_id && x.status === 'aberta');
            if (!alvo) throw new HttpsError('not-found', 'Pendência aberta não encontrada');
            const resolucao = texto(p.resolucao, MAX_TEXTO_LONGO);
            if (!resolucao) throw new HttpsError('invalid-argument', 'Registre a decisão sobre a pendência');
            const lista = pendencias.map((x) => (x.id === alvo.id
                ? { ...x, status: 'resolvida' as const, resolvida_em: agora, resolvida_por: c.userName, resolucao }
                : x));
            const der = derivados(lista, prazos);
            const mov = registrarMovimento(tx, c, ref, data, 'pendencia_resolvida',
                `Pendência apreciada (${alvo.descricao}): ${resolucao}${alvo.interrompe && !der.fase_suspensa ? ' Fase retomada.' : ''}`,
                { pendencia_id: alvo.id, ...marcasNaFase(data, 'pendencia') });
            tx.update(ref, { ...mov, pendencias: lista, ...der });
            return mov;
        }

        // ---- Prazos -----------------------------------------------------------
        if (p.action === 'abrirPrazo') {
            const descricao = texto(p.descricao, MAX_TEXTO_LONGO);
            const dias = Number(p.dias);
            const contagem: Contagem = p.contagem === 'corridos' ? 'corridos' : 'uteis';
            if (!descricao) throw new HttpsError('invalid-argument', 'Descreva o prazo');
            if (!Number.isInteger(dias) || dias < 1 || dias > MAX_PRAZO_DIAS) throw new HttpsError('invalid-argument', 'Informe os dias do prazo');
            if (prazos.length >= MAX_ITENS) throw new HttpsError('resource-exhausted', 'Limite de prazos do processo');
            const inicio = hojeBrasil();
            const novo: Prazo = {
                id: ref.collection('_').doc().id, descricao, destinatario: texto(p.destinatario), dias, contagem,
                inicio, vence_em: calcularVencimento(inicio, dias, contagem, calendario), status: 'aberto',
                aberto_em: agora, aberto_por: c.userName,
            };
            const lista = [...prazos, novo];
            const mov = registrarMovimento(tx, c, ref, data, 'prazo',
                `Prazo de ${dias} dias ${contagem === 'uteis' ? 'úteis' : 'corridos'} aberto: ${descricao}${novo.destinatario ? ` (${novo.destinatario})` : ''}. Vence em ${novo.vence_em.split('-').reverse().join('/')}.`,
                { prazo_id: novo.id, vence_em: novo.vence_em, ...marcasNaFase(data, 'prazo') });
            tx.update(ref, { ...mov, prazos: lista, ...derivados(pendencias, lista) });
            return mov;
        }

        if (p.action === 'encerrarPrazo') {
            const alvo = prazos.find((x) => x.id === p.prazo_id && x.status === 'aberto');
            if (!alvo) throw new HttpsError('not-found', 'Prazo aberto não encontrado');
            const res = p.resultado === 'cancelado' ? 'cancelado' : 'cumprido';
            const hoje = hojeBrasil();
            const lista = prazos.map((x) => (x.id === alvo.id ? { ...x, status: res as Prazo['status'], encerrado_em: hoje, encerrado_por: c.userName } : x));
            const quando = res === 'cumprido' ? (hoje <= alvo.vence_em ? ' no prazo' : ' fora do prazo') : '';
            const mov = registrarMovimento(tx, c, ref, data, 'prazo_encerrado',
                `Prazo ${res}${quando}: ${alvo.descricao}.${motivo ? ` ${motivo}` : ''}`, { prazo_id: alvo.id, resultado: res, ...(alvo.automatico === true ? marcasDoDestino('informacao') : marcasNaFase(data, 'prazo')) });
            tx.update(ref, { ...mov, prazos: lista, ...derivados(pendencias, lista) });
            return mov;
        }

        if (p.action === 'convidarParte' || p.action === 'revogarParte') {
            const idx = Number(p.parte_idx);
            const partes = [...(data.partes || [])];
            const parte = partes[idx];
            if (!Number.isInteger(idx) || !parte) throw new HttpsError('invalid-argument', 'Parte inválida');
            if (parte.retirada) throw new HttpsError('failed-precondition', `${parte.nome} foi retirada do processo`);
            // Alvo: a própria parte, um representante já listado (representante_idx)
            // ou um representante novo ({ nome, email }). Cada um tem a própria conta.
            type Rep = { nome: string; email?: string; uid?: string; convite_hash?: string };
            const reps: Rep[] = [...((parte.representantes || []) as Rep[])];
            let ridx = p.representante_idx === undefined || p.representante_idx === null ? -1 : Number(p.representante_idx);
            const novoRep = p.action === 'convidarParte' && p.representante && typeof p.representante === 'object' ? p.representante as Record<string, unknown> : null;
            if (novoRep) {
                const nome = texto(novoRep.nome, 120);
                if (!nome) throw new HttpsError('invalid-argument', 'Informe o nome do representante');
                if (reps.length >= MAX_REPRESENTANTES) throw new HttpsError('invalid-argument', `Até ${MAX_REPRESENTANTES} representantes por parte`);
                const emailRep = texto(novoRep.email, 120);
                reps.push({ nome, ...(emailRep ? { email: emailRep } : {}) });
                ridx = reps.length - 1;
            }
            const alvo: Rep = ridx >= 0 ? reps[ridx] : parte;
            if (!alvo) throw new HttpsError('invalid-argument', 'Representante inválido');
            const rotulo = ridx >= 0 ? `${alvo.nome}, representante de ${parte.nome} (${parte.polo})` : `${parte.nome} (${parte.polo})`;
            const dadosMov = { parte_idx: idx, ...(ridx >= 0 ? { representante: alvo.nome } : {}) };
            // Convite anterior ainda não usado deixa de valer em qualquer dos dois casos.
            if (alvo.convite_hash) tx.set(db.collection(COL.convites).doc(alvo.convite_hash), { revogado: true }, { merge: true });
            if (p.action === 'revogarParte') {
                const antigo = alvo.uid;
                // A parte continua no processo; sem conta nem convite, não há o que revogar.
                if (ridx < 0 && !antigo && !alvo.convite_hash) throw new HttpsError('failed-precondition', `${parte.nome} não tem acesso nem convite pendente no portal`);
                if (ridx >= 0) {
                    reps.splice(ridx, 1);
                    partes[idx] = { ...parte, representantes: reps };
                } else {
                    const { uid: _u, convite_hash: _c, ...resto } = parte;
                    partes[idx] = resto;
                }
                const mov = registrarMovimento(tx, c, ref, data, 'acesso_revogado',
                    antigo || alvo.convite_hash ? `Acesso de ${rotulo} ao portal das partes revogado.` : `${rotulo} retirado do processo.`, dadosMov);
                tx.update(ref, { ...mov, partes, ...(antigo ? { partes_uids: FieldValue.arrayRemove(antigo) } : {}) });
                return mov;
            }
            if (alvo.uid) throw new HttpsError('failed-precondition', `${ridx >= 0 ? 'Este representante' : 'Esta parte'} já acompanha o processo. Revogue o acesso antes de convidar de novo.`);
            const email = texto(p.email, 120) || alvo.email || '';
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'E-mail inválido');
            convite.token = randomBytes(24).toString('base64url');
            convite.email = email;
            convite.parte = alvo.nome;
            convite.representaQuem = ridx >= 0 ? parte.nome : '';
            convite.numero = data.numero;
            const hash = sha256(convite.token);
            tx.set(db.collection(COL.convites).doc(hash), {
                organization_id: orgId, processo_id: ref.id, parte_idx: idx, parte_nome: parte.nome, email,
                representante_idx: ridx >= 0 ? ridx : null, representante_nome: ridx >= 0 ? alvo.nome : null,
                criado_por: c.ctx.uid, criado_em: new Date().toISOString(),
                expira_em: new Date(Date.now() + CONVITE_DIAS * 86400000).toISOString(), usado_por: null, revogado: false,
            });
            const atualizado = { ...alvo, convite_hash: hash, ...(email ? { email } : {}) };
            if (ridx >= 0) { reps[ridx] = atualizado; partes[idx] = { ...parte, representantes: reps }; } else partes[idx] = atualizado;
            const mov = registrarMovimento(tx, c, ref, data, 'convite',
                `${rotulo} convidado a acompanhar o processo pelo portal das partes${email ? ' (convite por e-mail)' : ''}.`, dadosMov);
            tx.update(ref, { ...mov, partes });
            return mov;
        }

        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    });
    // Partes habilitadas recebem e-mail dos movimentos públicos (fora da transação, sem travar o ato).
    void avisarPartesDoMovimento(db, String(p.id), undefined, expedidas);
    // Registro ligado arquivado pela regra da fase: mesmo webhook de quando se arquiva no quadro.
    const ra = registroArquivado as Arquivado | null;
    if (ra) {
        void fireOrgWebhook(orgId, 'archived', ra.modulo === 'consultas'
            ? { entity_type: 'process', entity_id: ra.id, process_number: ra.numero }
            : { entity_type: 'expediente', entity_id: ra.id, expediente_number: ra.numero }).catch(() => undefined);
    }
    const r = recebeu as { unidadeId: string; proc: admin.firestore.DocumentData } | null;
    if (r) void avisarUnidadeRecebeu(c, r.unidadeId, r.proc, String(p.id), motivo || texto(p.orientacao, MAX_TEXTO_LONGO));
    const pa = pendenciaAberta as { proc: admin.firestore.DocumentData; descricao: string } | null;
    if (pa) void avisarPendencia(c, pa.proc, String(p.id), pa.descricao);
    if (convite.token) {
        const link = `${APP_URL}/Portal?convite=${convite.token}`;
        const enviado = convite.email ? await sendEmail({
            to: convite.email,
            subject: `Convite para acompanhar o processo ${convite.numero}`,
            html: `<p>Olá, ${escapar(convite.parte)}.</p><p>Você foi habilitado a acompanhar o processo <b>${escapar(convite.numero)}</b>${convite.representaQuem ? ` como representante de <b>${escapar(convite.representaQuem)}</b>` : ''} e a peticionar nele pelo portal das partes.</p><p><a href="${link}">Aceitar o convite</a> (vale por ${CONVITE_DIAS} dias).</p><p>Entre com sua conta Google ou crie uma senha. Se você não esperava este e-mail, ignore-o.</p>`,
        }).catch(() => false) : false;
        return { success: true, version: resultado.version, link, emailEnviado: enviado };
    }
    if (tentarAuto) {
        const auto = await avancarSozinho(c, String(p.id));
        if (auto) return auto;
    }
    return { success: true, version: resultado.version };
}
