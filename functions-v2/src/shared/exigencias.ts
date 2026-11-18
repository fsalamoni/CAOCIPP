// ============================================================================
// O que o rito diz sobre cada ato: onde fica registrado (autos, extrato do
// PDF ou só nas informações do processo), o que cada ação da fase pede (só
// confirmar, um dado ou um documento) e quem vê. Lógica pura, testada em
// test/exigencias.test.js; o cliente tem o espelho em src/lib/exigencias.js
// (só para a tela; quem decide é o servidor).
// Fundamento: docs/LOGICA_PROCESSUAL.md, seções 5 e 6.
// ============================================================================

import { MODULOS, Modulo } from './modulos';
import { CampoDef, paginaDe, sanitizeCampos } from './camposProcesso';
import { MAX_ATRIBUICAO, QUEM, Quem, mesmaAtribuicao, sanitizeQuem } from './permissoesFase';
import { ComunicacaoDaAcao, RESPOSTAS, RespostaDaAcao, sanitizeComunicacaoDaAcao, sanitizeRespostaDaAcao } from './comunicacaoRito';
import { AudienciaDaAcao, sanitizeAudienciaDaAcao } from './audiencias';
import { JulgamentoDaAcao, sanitizeJulgamentoDaAcao } from './julgamento';
import { DisputaDaAcao, RESULTADOS_DISPUTA, sanitizeDisputaDaAcao } from './certames';
import { ehDoOrgao } from './listasOrgao';
import { sanitizeDoProcesso } from './doProcesso';
import { AoRegistro, sanitizeAoRegistro } from './painelModulos';

export { QUEM, Quem };

// Sem importar ./secretaria (que importa este módulo): o mesmo corte de texto.
const MAX_TEXTO_CURTO = 200;
const texto = (v: unknown, max = MAX_TEXTO_CURTO) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Onde um ato fica registrado:
 * - 'autos': termo ou certidão com folha; sai na impressão dos autos;
 * - 'evento': registro interno, sem folha, listado no extrato ao fim do PDF;
 * - 'informacao': só no sistema (aba Eventos e informações do processo); não sai em impressão nenhuma;
 * - 'nenhum' (só ações e atos da fase, nunca documento): sem evento. Fica um
 *   registro oculto, para a cadeia de eventos e a auditoria; ninguém o vê por
 *   padrão, não conta como último andamento e as partes nunca o veem.
 */
export const DESTINOS = ['autos', 'evento', 'informacao'] as const;
export type Destino = typeof DESTINOS[number];
export const DESTINOS_ATO = [...DESTINOS, 'nenhum'] as const;
export type DestinoAto = typeof DESTINOS_ATO[number];
/**
 * Ação da fase aceita também 'consolidar': entra na certidão conjunta da fase
 * (ou do grupo de fases), emitida uma vez, com folha, quando o processo sai
 * do grupo, é arquivado ou alguém pede "Emitir certidão agora".
 */
export const DESTINOS_ACAO = [...DESTINOS_ATO, 'consolidar'] as const;
export type DestinoAcao = typeof DESTINOS_ACAO[number];
/** Valor desconhecido (cópia antiga do rito, dado mexido) vira o padrão. */
const lido = <T extends string>(v: unknown, lista: readonly T[], padrao: T): T => (lista.includes(v as T) ? (v as T) : padrao);
const destino = (v: unknown, padrao: Destino): Destino => lido(v, DESTINOS, padrao);
const ORDEM: Record<DestinoAto, number> = { autos: 2, evento: 1, informacao: 0, nenhum: -1 };
/** O mais reservado dos dois (ex.: sair de fase nos autos para fase só no sistema = só no sistema). */
export const maisReservado = <T extends DestinoAto>(a: T, b: T): T => (ORDEM[a] <= ORDEM[b] ? a : b);
/**
 * Destino da mudança entre duas fases. "Sem evento" numa só delas não apaga o
 * registro que a outra pede: vale a outra. Sem evento só quando as duas dizem.
 */
export const destinoTransicao = (a: DestinoAto, b: DestinoAto): DestinoAto =>
    (a === 'nenhum' ? b : b === 'nenhum' ? a : maisReservado(a, b));

/** Formato antigo do registro da fase (ainda lido em processos autuados antes). */
export const REGISTROS = ['remessas_fora', 'interno'] as const;
export type Registro = typeof REGISTROS[number];
/** Registro dos atos da fase: entrar e sair dela, e remessas entre unidades durante ela. Ausente = autos. */
export interface RegistroAtos {
    fase?: Exclude<DestinoAto, 'autos'>;
    remessas?: Exclude<DestinoAto, 'autos'>;
    /** Outros atos durante a fase (só o que difere do padrão de cada um). */
    outros?: Partial<Record<OutroAto, DestinoAto>>;
}

/**
 * Outros atos durante a fase cujo registro o rito escolhe. `prazo` vale para
 * abrir e encerrar; `pendencia`, para abrir e apreciar. O padrão é como era
 * antes: termo nos autos, e atribuição como registro de controle no extrato.
 * Ficam sempre nos autos: autuação, juntada, petição, comunicação e ciência,
 * situação (arquivar pode levar dispensa), exclusão e restauração.
 */
export const OUTROS_ATOS = ['prazo', 'pendencia', 'urgencia', 'dados', 'atribuicao'] as const;
export type OutroAto = typeof OUTROS_ATOS[number];
export const PADRAO_OUTRO: Record<OutroAto, DestinoAto> = { prazo: 'autos', pendencia: 'autos', urgencia: 'autos', dados: 'autos', atribuicao: 'evento' };
/** Atribuição é sempre registro de controle: não vira termo nos autos. */
const opcoesDoAto = (a: OutroAto): readonly DestinoAto[] => (a === 'atribuicao' ? ['evento', 'informacao', 'nenhum'] : DESTINOS_ATO);

export const FORMAS = ['redigir', 'juntar', 'qualquer'] as const;
export type Forma = typeof FORMAS[number];

export interface Exigencia {
    descricao: string;
    forma: Forma;
    /** Tipo de documento esperado (ex.: "Despacho"); serve para reconhecer na juntada. */
    tipo?: string;
    /** Modelo indicado (id de secModelos). */
    modelo_id?: string;
    /** Ausente = juntado aos autos. Senão, guardado no processo fora dos autos (documento de controle). */
    destino?: Exclude<Destino, 'autos'>;
    /** Ausente = obrigatório (a fase só segue com ele ou com dispensa). Recomendado avisa; opcional só lembra. */
    nivel?: NivelExigencia;
    /** false = o documento que cumpre fica fora do portal das partes. Só esconde: nunca mostra o que quem junta escondeu. */
    partes?: false;
    /** Quantas assinaturas o documento precisa ter para cumprir (1 a 5). Só para documento redigido ou de qualquer forma. */
    assinaturas?: number;
    /** Uma das assinaturas é de quem tem esta atribuição na lotação (ex.: Promotor). */
    assinatura_atribuicao?: string;
}

export const MAX_ASSINATURAS_EXIGIDAS = 5;

export const NIVEIS = ['recomendado', 'opcional'] as const;
export type NivelExigencia = typeof NIVEIS[number];

/** O que a ação pede a quem a cumpre. */
export const PEDIDOS = ['confirmar', 'texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao', 'registro', 'formulario', 'documento', 'orientacao', 'comunicacao', 'resposta', 'audiencia', 'julgamento', 'disputa'] as const;
export type Pedido = typeof PEDIDOS[number];
export const MAX_OPCOES_ACAO = 30;
/** Campos de uma ação que pede um formulário. */
export const MAX_CAMPOS_ACAO = 10;

/**
 * Condição pela resposta de uma ação de escolha (lista ou sim/não) da mesma
 * fase: vale quando a resposta registrada está entre `valores`. Usada na ação
 * (`RegraAcao.se`: só vale nesse caso) e na saída (`Fase.condicoes_regra`).
 * Com `campo`, a resposta é a de um campo de escolha (lista ou sim/não) do
 * formulário que a ação pede.
 *
 * A condição também pode ler (nov/2026): a resposta dada em outra fase
 * (`fase`), um dado do processo (`dado`) e mais de uma coisa ao mesmo tempo
 * (`e`: todas precisam valer). Sem esses campos, é a condição de sempre.
 */
export interface Condicao {
    /** Índice da ação que deu a resposta; -1 quando a condição lê um dado do processo. */
    acao: number;
    campo?: string;
    valores: string[];
    /** A resposta é a de uma ação de outra fase (o id dela), dada quando o processo passou por lá. */
    fase?: string;
    /** Em vez de resposta, um dado do processo: um de DADOS_CONDICAO ou 'campo:<id>' (campo de escolha do tipo de processo). */
    dado?: string;
    /** Com `dado` de valor livre: o nome do campo e o de cada valor, para as mensagens e a tela. */
    rotulo?: string;
    nomes?: string[];
    /** Outras condições que também precisam valer (todas). Não se aninham. */
    e?: Condicao[];
}
/** Condições a mais numa mesma regra (além da primeira). */
export const MAX_CONDICOES_E = 3;
/**
 * Dados do processo que uma condição lê, com os valores que cada um assume
 * (null: valor livre, vindo do cadastro do órgão). As origens são as de
 * `ORIGENS` (shared/secretaria.ts); o teste confere que as duas listas batem.
 */
export const DADOS_CONDICAO: Record<string, readonly string[] | null> = {
    urgente: ['sim', 'nao'],
    sigilo: ['normal', 'restrito'],
    partes: ['sim', 'nao'],
    origem: ['requerimento', 'representacao', 'oficio', 'de_oficio', 'outro_processo', 'outro'],
    tipo: null,
};
const ROTULO_DADO: Record<string, string> = { urgente: 'Urgente', sigilo: 'Sigilo', partes: 'Tem partes', origem: 'Origem', tipo: 'Tipo de processo' };
const ROTULO_VALOR: Record<string, string> = {
    '@preenchido': 'preenchido', '@vazio': 'vazio', sim: 'Sim', nao: 'Não', normal: 'Normal', restrito: 'Restrito', requerimento: 'Requerimento', representacao: 'Representação',
    oficio: 'Ofício', de_oficio: 'De ofício', outro_processo: 'Outro processo', outro: 'Outra',
};
/** A condição (uma parte dela) lê a rodada da própria fase? */
const condicaoLocal = (c: Condicao): boolean => c.fase === undefined && c.dado === undefined;
/**
 * Quem da equipe vê o dado da ação. Ausente = toda a equipe que vê o processo.
 * 'gestor': só quem gere a unidade onde foi registrado, quem o registrou e a
 * administração. Dado reservado nunca vai aos autos, ao portal nem a outro módulo.
 */
export const VE = ['gestor'] as const;
export type Ve = typeof VE[number];
/** O que pode ficar reservado: dado digitado (sem escolha que condiciona, sem registro de outro módulo). */
export const PEDIDOS_RESERVAVEIS: readonly Pedido[] = ['texto', 'texto_longo', 'numero', 'data', 'formulario'];
/** Respostas das ações de escolha na rodada da fase: { fase: { índice: 'opção' | 'sim' | 'nao' } }. */
export type Respostas = Record<string, Record<string, string>>;

export interface RegraAcao {
    /** Ausente = só confirmar (caixa de marcar). 'orientacao': não se marca, só orienta quem está na fase. */
    pede?: Exclude<Pedido, 'confirmar' | 'documento'>;
    /** Nome do dado pedido (ex.: "Número no SIM"). Ausente = o texto da ação. */
    rotulo?: string;
    ajuda?: string;
    opcoes?: string[];
    /** Pede 'registro': de qual módulo do órgão. */
    modulo?: Modulo;
    /** Módulo 'paginas': de qual página própria (id do tipo). */
    pagina?: string;
    /** Pede 'formulario': os campos (como os do tipo de processo; quem vê é a ação inteira). */
    campos?: CampoDef[];
    /** Onde fica o registro de cumprimento (ausente = evento). Para documento, vale `documento.destino`. */
    destino?: DestinoAcao;
    /** As partes veem a informação (e a certidão, se nos autos) no portal. */
    partes?: boolean;
    /** A fase só segue com ela cumprida (ou com dispensa motivada). Na ação com documento, vale `documento.nivel`. */
    obrigatoria?: true;
    /** Não impede a fase de seguir, mas quem a conclui é avisado de que ficou por fazer. */
    recomendada?: true;
    /** Só vale (aparece e é cobrada) quando a resposta de uma ação anterior for uma destas. */
    se?: Condicao;
    /** Alternativa a uma ação anterior da fase: cumprida uma do grupo, as outras deixam de ser cobradas. */
    ou?: number;
    /** Quem pode cumprir (ver shared/permissoesFase.ts). Ausente = quem tem o processo. */
    quem?: Quem;
    /** Com `quem: 'atribuicao'`: a atribuição da lotação de quem pode (ex.: "Promotor"). */
    atribuicao?: string;
    /** Quem da equipe vê o dado. Ausente = toda a equipe. */
    ve?: Ve;
    /** O dado entra na folha de dados do processo (a folha do evento 1, no PDF), seja qual for o destino. */
    folha_dados?: true;
    /** Prazo próprio da ação, em dias: abre quando ela passa a valer na fase e encerra quando é cumprida (ver shared/prazosFase.ts). */
    prazo_dias?: number;
    /** Contagem do prazo da ação. Ausente = dias úteis. */
    prazo_contagem?: 'corridos';
    /** Pede 'comunicacao': espécie, polos, prazo e texto (ver shared/comunicacaoRito.ts). */
    comunicacao?: ComunicacaoDaAcao;
    /** Pede 'resposta': a ação de comunicação cuja resposta se espera. */
    resposta?: RespostaDaAcao;
    /** Pede 'audiencia': a espécie (ver shared/audiencias.ts). A designação vai sempre aos autos, e as partes veem. */
    audiencia?: AudienciaDaAcao;
    /** Pede 'julgamento': resultados, quórum e desempate (ver shared/julgamento.ts). A certidão vai sempre aos autos, e as partes veem. */
    julgamento?: JulgamentoDaAcao;
    /** Pede 'disputa': o tipo de disputa de preços (ver shared/certames.ts). Cumpre-se com o resultado do certame, nos autos. */
    disputa?: DisputaDaAcao;
    /** "Vem do processo": id do campo do tipo de processo que, preenchido, cumpre a ação (ver shared/doProcesso.ts). */
    do_processo?: string;
    /** Na ação que pede um formulário: { id do campo da ação: id do campo do processo }. */
    do_processo_campos?: Record<string, string>;
    /** "Leva ao painel": o dado vai para um campo da consulta, expediente, parceria ou registro de página ligado (ver shared/painelModulos.ts). */
    ao_registro?: AoRegistro;
    /** Formato antigo: certidão nos autos. */
    autos?: true;
    documento?: Exigencia;
}

export const MAX_DOCUMENTOS_FASE = 5;

/** Certidão conjunta: fases com o mesmo `grupo` dividem uma só certidão. */
export interface CertidaoFase { grupo?: string; titulo?: string; incluir_mudancas?: true; /** Frase que abre a certidão (substitui a padrão). */ abertura?: string }

export interface FaseRegras {
    id: string;
    nome?: string;
    certidao?: CertidaoFase;
    acoes?: string[];
    registro?: Registro;
    registro_atos?: RegistroAtos;
    acoes_regras?: Array<RegraAcao | null>;
    documentos?: Exigencia[];
}

/** Onde fica o cumprimento da ação. */
export function destinoDaAcao(r: RegraAcao | null | undefined): DestinoAcao {
    if (r?.documento) return destino(r.documento.destino, 'autos');
    if (r?.destino) return lido(r.destino, DESTINOS_ACAO, 'evento');
    return r?.autos ? 'autos' : 'evento';
}
/** O que a ação pede. */
export const pedidoDaAcao = (r: RegraAcao | null | undefined): Pedido => (r?.documento ? 'documento' : r?.pede || 'confirmar');
/** As partes veem? Regra antiga com certidão nos autos: sim (era assim). */
/** As partes veem? Ação de só confirmar fora dos autos não tem o que mostrar (nem certidão, nem dado). */
export const partesVeem = (r: RegraAcao | null | undefined): boolean =>
    destinoDaAcao(r) !== 'nenhum'
    && (r?.partes === true || (r?.partes === undefined && r?.autos === true))
    // Certidão (própria ou conjunta) mostra até a confirmação simples.
    && (pedidoDaAcao(r) !== 'confirmar' || ['autos', 'consolidar'].includes(destinoDaAcao(r)));

/** Entrada/saída e remessas da fase: onde ficam (lê também o formato antigo). */
export function niveisDaFase(f: FaseRegras | undefined): { fase: DestinoAto; remessas: DestinoAto } {
    if (!f) return { fase: 'autos', remessas: 'autos' };
    if (f.registro_atos) return { fase: lido(f.registro_atos.fase, DESTINOS_ATO, 'autos'), remessas: lido(f.registro_atos.remessas, DESTINOS_ATO, 'autos') };
    if (f.registro === 'interno') return { fase: 'evento', remessas: 'evento' };
    if (f.registro === 'remessas_fora') return { fase: 'autos', remessas: 'evento' };
    return { fase: 'autos', remessas: 'autos' };
}

export function sanitizeExigencia(raw: unknown, descricaoPadrao = ''): Exigencia | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const descricao = texto(o.descricao, MAX_TEXTO_CURTO) || descricaoPadrao;
    if (!descricao) return null;
    const forma = FORMAS.includes(o.forma as Forma) ? (o.forma as Forma) : 'qualquer';
    const tipo = texto(o.tipo, 60);
    const modelo = texto(o.modelo_id, 40);
    const dest = destino(o.destino, 'autos');
    const nivel = NIVEIS.includes(o.nivel as NivelExigencia) ? (o.nivel as NivelExigencia) : null;
    // Assinatura vale para o que o órgão produz: documento recebido de fora não se assina aqui.
    const assina = forma !== 'juntar';
    const nAss = assina ? Math.min(MAX_ASSINATURAS_EXIGIDAS, Math.max(0, Math.trunc(Number(o.assinaturas) || 0))) : 0;
    const atrib = assina ? texto(o.assinatura_atribuicao, MAX_ATRIBUICAO) : '';
    return {
        descricao, forma, ...(tipo ? { tipo } : {}), ...(modelo ? { modelo_id: modelo } : {}), ...(dest !== 'autos' ? { destino: dest } : {}),
        ...(nivel ? { nivel } : {}),
        // Fora dos autos já não vai às partes.
        ...(o.partes === false && dest === 'autos' ? { partes: false as const } : {}),
        ...(nAss ? { assinaturas: nAss } : {}), ...(atrib ? { assinatura_atribuicao: atrib } : {}),
    };
}

function sanitizeRegra(raw: unknown, acao: string): RegraAcao | null {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const pedeBruto = PEDIDOS.includes(r.pede as Pedido) ? (r.pede as Pedido) : (r.documento ? 'documento' : 'confirmar');
    // Orientação a quem cumpre: vale para qualquer ação.
    const ajuda = texto(r.ajuda, 200);
    if (pedeBruto === 'documento') {
        const documento = sanitizeExigencia(r.documento || {}, acao);
        if (!documento) return null;
        documento.descricao = acao;
        return { documento, ...(ajuda ? { ajuda } : {}) };
    }
    const out: RegraAcao = {};
    if (ajuda) out.ajuda = ajuda;
    // Só orientação: não se marca, não gera registro, não é cobrada.
    if (pedeBruto === 'orientacao') return { ...out, pede: 'orientacao' };
    // Comunicar as partes: cumpre-se expedindo pela ação; o registro são as próprias comunicações (nos autos).
    if (pedeBruto === 'comunicacao') {
        Object.assign(out, sanitizeQuem(r.quem, r.atribuicao, `A ação "${acao}"`));
        return { ...out, pede: 'comunicacao', comunicacao: sanitizeComunicacaoDaAcao(r.comunicacao, acao), ...(r.obrigatoria === true ? { obrigatoria: true as const } : r.recomendada === true ? { recomendada: true as const } : {}) };
    }
    // Designar audiência: ato público, sempre nos autos e visto pelas partes.
    if (pedeBruto === 'audiencia') {
        Object.assign(out, sanitizeQuem(r.quem, r.atribuicao, `A ação "${acao}"`));
        return { ...out, pede: 'audiencia', audiencia: sanitizeAudienciaDaAcao(r.audiencia, acao), destino: 'autos', partes: true,
            ...(r.obrigatoria === true ? { obrigatoria: true as const } : r.recomendada === true ? { recomendada: true as const } : {}) };
    }
    // Disputa de preços: aviso, propostas e resultado são atos públicos, nos autos.
    if (pedeBruto === 'disputa') {
        Object.assign(out, sanitizeQuem(r.quem, r.atribuicao, `A ação "${acao}"`));
        return { ...out, pede: 'disputa', disputa: sanitizeDisputaDaAcao(r.disputa, acao), destino: 'autos', partes: true,
            ...(r.obrigatoria === true ? { obrigatoria: true as const } : r.recomendada === true ? { recomendada: true as const } : {}) };
    }
    // Julgamento colegiado: a certidão (resultado, placar, relator, vencidos, impedidos) é ato público, nos autos.
    if (pedeBruto === 'julgamento') {
        Object.assign(out, sanitizeQuem(r.quem, r.atribuicao, `A ação "${acao}"`));
        return { ...out, pede: 'julgamento', julgamento: sanitizeJulgamentoDaAcao(r.julgamento, acao), destino: 'autos', partes: true,
            ...(r.obrigatoria === true ? { obrigatoria: true as const } : r.recomendada === true ? { recomendada: true as const } : {}) };
    }
    // Esperar a resposta: a ação de que depende é validada com todas as regras da fase (sanitizeRegras).
    if (pedeBruto === 'resposta') {
        return { ...out, pede: 'resposta', resposta: { de: -1 }, ...(r.obrigatoria === true ? { obrigatoria: true as const } : r.recomendada === true ? { recomendada: true as const } : {}) };
    }
    if (pedeBruto !== 'confirmar') {
        out.pede = pedeBruto;
        const rotulo = texto(r.rotulo, 80);
        if (rotulo && rotulo !== acao) out.rotulo = rotulo;
        if (pedeBruto === 'lista') {
            const opcoes = [...new Set((Array.isArray(r.opcoes) ? r.opcoes : []).map((s) => texto(s, 80)).filter(Boolean))].slice(0, MAX_OPCOES_ACAO);
            if (opcoes.length < 2) throw new Error(`A ação "${acao}" pede uma escolha: informe ao menos duas opções`);
            out.opcoes = opcoes;
        }
        if (pedeBruto === 'registro') {
            if (!MODULOS.includes(r.modulo as Modulo)) throw new Error(`A ação "${acao}" pede um registro: escolha de que módulo`);
            out.modulo = r.modulo as Modulo;
            if (out.modulo === 'paginas') out.pagina = paginaDe(r.pagina, acao);
        }
        if (pedeBruto === 'formulario') {
            const lista = Array.isArray(r.campos) ? r.campos : [];
            if (lista.length > MAX_CAMPOS_ACAO) throw new Error(`A ação "${acao}" aceita até ${MAX_CAMPOS_ACAO} campos`);
            // Sem "exigir em" (o obrigatório vale ao cumprir a ação) e sem "partes veem" por campo:
            // quem decide o que as partes veem é a ação inteira.
            let campos: CampoDef[];
            try {
                campos = sanitizeCampos(lista.map((x) => (x && typeof x === 'object' ? { ...x, exigir_em: undefined, importar: undefined } : x)))
                    .map((c) => ({ ...c, visivel_partes: false }));
            } catch (e) { throw new Error(`Na ação "${acao}": ${(e as Error).message}`); }
            if (!campos.length) throw new Error(`A ação "${acao}" pede um formulário: crie ao menos um campo`);
            out.campos = campos;
        }
    }
    const dest = lido(r.destino, DESTINOS_ACAO, r.autos === true ? 'autos' : 'evento');
    if (dest !== 'evento') out.destino = dest;
    // Sem evento não aparece para ninguém: nem para as partes.
    const partes = dest !== 'nenhum' && (r.partes === true || (r.partes === undefined && r.autos === true));
    if (partes) out.partes = true;
    if (r.obrigatoria === true) out.obrigatoria = true;
    else if (r.recomendada === true) out.recomendada = true;
    Object.assign(out, sanitizeQuem(r.quem, r.atribuicao, `A ação "${acao}"`));
    // Folha de dados: só ação que pede um dado (a confirmação simples não tem o que mostrar).
    if (r.folha_dados === true && out.pede) out.folha_dados = true;
    if (VE.includes(r.ve as Ve)) {
        if (out.folha_dados) throw new Error(`A ação "${acao}": dado reservado a quem gere a unidade não entra na folha de dados, que toda a equipe lê`);
        if (!out.pede || !PEDIDOS_RESERVAVEIS.includes(out.pede)) {
            throw new Error(`A ação "${acao}": só texto, número, data ou formulário pode ficar reservado a quem gere a unidade`);
        }
        if (out.campos?.some((c) => c.tipo === 'registro')) {
            throw new Error(`A ação "${acao}": formulário com registro de outro módulo não pode ficar reservado`);
        }
        if (dest === 'autos' || dest === 'consolidar') {
            throw new Error(`A ação "${acao}" fica nos autos, que toda a equipe lê: escolha outro lugar para reservar o dado`);
        }
        delete out.partes;
        out.ve = r.ve as Ve;
    }
    // "Vem do processo": o campo do tipo que, preenchido, cumpre a ação sozinho (ver shared/doProcesso.ts).
    Object.assign(out, sanitizeDoProcesso(r, out));
    // "Leva ao painel": o dado também vai ao registro ligado de outro módulo (ver shared/painelModulos.ts).
    const ao = sanitizeAoRegistro(r.ao_registro, out);
    if (ao) out.ao_registro = ao;
    return Object.keys(out).length ? out : null;
}

/** Campos do formulário da ação que condicionam: os de escolha, e nunca os de ação com dado reservado. */
const camposDeEscolha = (r: RegraAcao | null | undefined): CampoDef[] =>
    (r?.pede === 'formulario' && !r.ve ? (r.campos || []).filter((c) => c.tipo === 'lista' || c.tipo === 'sim_nao') : []);

/**
 * Opções que a resposta da ação pode ter (só ações de escolha condicionam).
 * Com `campo`, as do campo de escolha do formulário que a ação pede.
 */
export function opcoesDaResposta(r: RegraAcao | null | undefined, campo?: string): string[] | null {
    if (!r || r.documento) return null;
    if (campo) {
        const c = camposDeEscolha(r).find((x) => x.id === campo);
        return !c ? null : c.tipo === 'lista' ? c.opcoes || [] : ['sim', 'nao'];
    }
    if (r.pede === 'lista') return r.opcoes || [];
    if (r.pede === 'sim_nao') return ['sim', 'nao'];
    if (r.pede === 'resposta') return [...RESPOSTAS];
    if (r.pede === 'julgamento') return [...(r.julgamento?.resultados || [])];
    if (r.pede === 'disputa') return [...RESULTADOS_DISPUTA];
    return null;
}

/** Valor gravado como chave da resposta: a opção escolhida, ou 'sim'/'nao'. */
export const chaveDaResposta = (v: unknown): string => (typeof v === 'boolean' ? (v ? 'sim' : 'nao') : String(v ?? ''));

/** Onde a resposta fica na rodada da fase: '2' (a ação 2) ou '2.sistema' (o campo "sistema" do formulário da ação 2). */
export const chaveDaCondicao = (c: { acao: number; campo?: string; fase?: string; dado?: string }): string =>
    (c.dado ? `@${c.dado}` : `${c.fase ? `${c.fase}/` : ''}${c.campo ? `${c.acao}.${c.campo}` : c.acao}`);

/** A chave da rodada é da ação `idx` (a própria resposta ou a de um campo dela)? */
export const respostaDaAcao = (chave: string, idx: number): boolean => chave === String(idx) || chave.startsWith(`${idx}.`);

/** A ação deixa resposta na rodada (é de escolha, ou pede formulário com campo de escolha)? */
export const respondeNaRodada = (r: RegraAcao | null | undefined): boolean => opcoesDaResposta(r) !== null || camposDeEscolha(r).length > 0;

/** O que a ação cumprida responde na rodada: { '2': 'SPU' } ou, no formulário, { '2.sistema': 'SPU' } por campo de escolha preenchido. */
export function respostasDaAcao(r: RegraAcao | null | undefined, idx: number, valor: unknown): Record<string, string> {
    if (opcoesDaResposta(r) !== null) return { [String(idx)]: chaveDaResposta(valor) };
    const dados = Array.isArray(valor) ? (valor as Array<{ id?: string; valor?: unknown }>) : [];
    const out: Record<string, string> = {};
    for (const c of camposDeEscolha(r)) {
        const v = dados.find((x) => x?.id === c.id)?.valor;
        if (v !== null && v !== undefined && v !== '') out[`${idx}.${c.id}`] = chaveDaResposta(v);
    }
    return out;
}

/**
 * Saneia a condição contra as regras já saneadas da fase. `mapa` traduz o índice
 * mandado pelo cliente para o índice gravado (linhas vazias saem); `antesDe`
 * limita a ações anteriores (ação condicional). Inválida: lança com mensagem.
 */
export function sanitizeCondicao(raw: unknown, regras: Array<RegraAcao | null>, acoes: string[], quem: string,
    mapa?: Map<number, number>, antesDe = Infinity, onde = antesDe === Infinity ? 'desta fase' : 'anterior'): Condicao | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const o = raw as Record<string, unknown>;
    const bruto = Number(o.acao);
    const acao = mapa ? mapa.get(bruto) : bruto;
    // A ação de que dependia saiu (linha vazia): a condição sai com ela.
    if (acao === undefined) return undefined;
    const campo = typeof o.campo === 'string' && o.campo ? o.campo.slice(0, 24) : undefined;
    const opcoes = Number.isInteger(acao) && acao >= 0 && acao < Math.min(acoes.length, antesDe) ? opcoesDaResposta(regras[acao], campo) : null;
    if (!opcoes) {
        throw new Error(campo
            ? `${quem} depende de um campo de escolha do formulário de uma ação ${onde} (sem dado reservado)`
            : `${quem} depende da resposta de uma ação de escolha ${onde}`);
    }
    const valores = [...new Set((Array.isArray(o.valores) ? o.valores : []).map((v) => texto(v, 80)))].filter((v) => opcoes.includes(v));
    if (!valores.length) throw new Error(`${quem}: escolha ao menos uma resposta de "${acoes[acao]}"`);
    return { acao, ...(campo ? { campo } : {}), valores };
}

/** Condição sobre um dado do processo (urgente, sigilo, partes, origem, tipo ou campo de escolha do tipo). */
function sanitizeDado(o: Record<string, unknown>, quem: string): Condicao {
    const dado = String(o.dado).slice(0, 48);
    const campo = dado.startsWith('campo:') ? dado.slice(6) : '';
    const opcoes = campo ? null : DADOS_CONDICAO[dado];
    if (campo ? !/^[\w-]{1,40}$/.test(campo) : opcoes === undefined) throw new Error(`${quem} depende de um dado do processo que não existe`);
    const brutos = (Array.isArray(o.valores) ? o.valores : []).map((v) => texto(v, 80));
    // Com valor livre (tipo, campo do tipo), o nome de cada valor acompanha o valor.
    const nomesBrutos = Array.isArray(o.nomes) ? o.nomes : [];
    // Origem: além das do sistema, as da lista do órgão (id "o_..."), com o nome.
    const aceita = (v: string) => !opcoes || opcoes.includes(v) || (dado === 'origem' && ehDoOrgao(v));
    const pares = brutos.map((v, i) => [v, texto(nomesBrutos[i], 80)] as const)
        .filter(([v], i) => v && brutos.indexOf(v) === i && aceita(v)).slice(0, MAX_OPCOES_ACAO);
    const rotulo = opcoes ? '' : texto(o.rotulo, 80);
    if (!pares.length) throw new Error(`${quem}: escolha ao menos um valor de "${rotulo || ROTULO_DADO[dado] || 'dado do processo'}"`);
    return {
        acao: -1, dado, valores: pares.map(([v]) => v),
        ...(rotulo ? { rotulo } : {}),
        ...((!opcoes || dado === 'origem') && pares.some(([v, n]) => n && n !== v && !(opcoes || []).includes(v)) ? { nomes: pares.map(([v, n]) => n || v) } : {}),
    };
}

/** O que a condição precisa saber de uma fase: as ações já saneadas e o mapa de índices do cliente. */
export interface FaseDaCondicao { id: string; nome: string; acoes: string[]; regras: Array<RegraAcao | null>; mapa?: Map<number, number> }

/** A condição bruta lê mais do que a rodada da própria fase (outra fase, dado do processo, várias ao mesmo tempo)? */
export function condicaoAmpla(raw: unknown): boolean {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return !!o.fase || !!o.dado || (Array.isArray(o.e) && o.e.length > 0);
}

/**
 * Saneia a condição que lê mais do que a rodada da própria fase. Cada parte (a
 * primeira e as de `e`) é: um dado do processo; a resposta de uma ação de
 * escolha de outra fase (`outras` resolve o id mandado pelo cliente); ou a de
 * uma ação da própria fase (`antesDe`, na ação condicional). A parte cuja ação
 * ou fase saiu do rito sai com ela. Inválida: lança com mensagem.
 */
export function sanitizeCondicaoAmpla(raw: unknown, propria: FaseDaCondicao, outras: (id: string) => FaseDaCondicao | undefined,
    quem: string, antesDe = Infinity): Condicao | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const o = raw as Record<string, unknown>;
    const parte = (p: unknown): Condicao | undefined => {
        if (!p || typeof p !== 'object') return undefined;
        const x = p as Record<string, unknown>;
        if (typeof x.dado === 'string' && x.dado) return sanitizeDado(x, quem);
        if (typeof x.fase === 'string' && x.fase) {
            const alvo = outras(x.fase);
            if (!alvo) return undefined;
            if (alvo.id !== propria.id) {
                const c = sanitizeCondicao(x, alvo.regras, alvo.acoes, quem, alvo.mapa, Infinity, `da fase "${alvo.nome}"`);
                return c ? { ...c, fase: alvo.id } : undefined;
            }
        }
        return sanitizeCondicao(x, propria.regras, propria.acoes, quem, propria.mapa, antesDe);
    };
    const vistas = new Set<string>();
    const partes = [o, ...(Array.isArray(o.e) ? o.e : [])].map(parte)
        .filter((c): c is Condicao => !!c && !vistas.has(chaveDaCondicao(c)) && !!vistas.add(chaveDaCondicao(c)))
        .slice(0, MAX_CONDICOES_E + 1);
    if (!partes.length) return undefined;
    return { ...partes[0], ...(partes.length > 1 ? { e: partes.slice(1) } : {}) };
}

/** Rótulo do dado que a condição lê: o da ação, o do campo do formulário ou o do dado do processo. Com `fases`, diz de que fase é a resposta. */
export function rotuloDaCondicao(f: FaseRegras | undefined, c: Condicao, fases?: FaseRegras[]): string {
    if (c.dado) return c.rotulo || ROTULO_DADO[c.dado] || 'o dado do processo';
    const dona = c.fase ? fases?.find((x) => x.id === c.fase) : f;
    const r = dona?.acoes_regras?.[c.acao];
    const campo = c.campo ? r?.campos?.find((x) => x.id === c.campo) : undefined;
    const nome = campo?.rotulo || r?.rotulo || dona?.acoes?.[c.acao] || 'a resposta';
    return c.fase ? `${nome} (fase ${dona?.nome || 'anterior'})` : nome;
}

/** Texto da condição para mensagens: "Decisão" for Deferido ou Parcial e "Urgente" for Sim. */
export function textoDaCondicao(f: FaseRegras | undefined, c: Condicao, fases?: FaseRegras[]): string {
    const uma = (x: Condicao): string => {
        const dona = x.fase ? fases?.find((y) => y.id === x.fase) : f;
        const r = x.dado ? undefined : dona?.acoes_regras?.[x.acao];
        const simNao = !x.dado && (x.campo ? r?.campos?.find((y) => y.id === x.campo)?.tipo : r?.pede) === 'sim_nao';
        const fixo = !!x.dado && !!DADOS_CONDICAO[x.dado];
        const rot = (v: string, i: number) => (simNao || fixo || v.startsWith('@') ? ROTULO_VALOR[v] || x.nomes?.[i] || v : x.nomes?.[i] || v);
        if (x.valores.every((v) => v === '@preenchido' || v === '@vazio')) return `"${rotuloDaCondicao(f, x, fases)}" estiver ${x.valores.map(rot).join(' ou ')}`;
        return `"${rotuloDaCondicao(f, x, fases)}" for ${x.valores.map(rot).join(' ou ')}`;
    };
    return [c, ...(c.e || [])].map(uma).join(' e ');
}

/**
 * "Alternativa a": aponta para uma ação anterior da fase que se marca (não
 * documento nem orientação). Inválida: lança com mensagem.
 */
function sanitizeOu(raw: unknown, regras: Array<RegraAcao | null>, acoes: string[], i: number, mapa?: Map<number, number>): number | undefined {
    if (raw === undefined || raw === null || raw === '') return undefined;
    const alvo = mapa ? mapa.get(Number(raw)) : Number(raw);
    if (alvo === undefined) return undefined; // a ação de que era alternativa saiu
    const marca = (r: RegraAcao | null) => !r?.documento && r?.pede !== 'orientacao';
    if (!Number.isInteger(alvo) || alvo < 0 || alvo >= i || !marca(regras[alvo]) || !marca(regras[i])) {
        throw new Error(`A ação "${acoes[i]}" só pode ser alternativa a uma ação anterior da fase que se marca (sem documento)`);
    }
    return alvo;
}

/** Ações do mesmo grupo de alternativas que `i` (inclui `i`). Sem alternativa, só ela. */
export function grupoDeAlternativas(f: FaseRegras | undefined, i: number): number[] {
    const regras = f?.acoes_regras || [];
    // O rito só aponta para trás: a subida termina.
    const raiz = (k: number): number => { const o = regras[k]?.ou; return typeof o === 'number' && o >= 0 && o < k ? raiz(o) : k; };
    const r = raiz(i);
    return (f?.acoes || []).map((_a, k) => k).filter((k) => raiz(k) === r);
}

/** Outra ação do grupo de alternativas já foi cumprida (e vale agora)? */
export function alternativaCumprida(f: FaseRegras | undefined, i: number, feitas: Set<number>, resp: Record<string, string> | undefined): boolean {
    return grupoDeAlternativas(f, i).some((k) => k !== i && feitas.has(k) && acaoAtiva(f, k, resp));
}

/**
 * A condição vale com as respostas da rodada? Sem condição, sempre. Com `f`,
 * a resposta só conta se a ação que a deu também vale (condições em cadeia:
 * desfeita a resposta de cima, a de baixo deixa de pesar).
 */
export function condicaoAtendida(c: Condicao | undefined, resp: Record<string, string> | undefined, f?: FaseRegras): boolean {
    if (!c) return true;
    const uma = (x: Condicao): boolean => {
        const k = chaveDaCondicao(x);
        if (!valorAtende(x, resp?.[k])) return false;
        // Na própria fase, a condição só aponta para ação anterior (o rito é validado assim): a recursão termina.
        // A resposta de outra fase e o dado do processo valem como estão.
        return !condicaoLocal(x) || !f || acaoAtiva(f, x.acao, resp);
    };
    return uma(c) && (c.e || []).every(uma);
}

/**
 * O valor lido atende a parte da condição? No campo do tipo de processo, além
 * dos valores, valem '@preenchido' (tem qualquer valor) e '@vazio' (não tem).
 */
export function valorAtende(x: Condicao, v: string | undefined): boolean {
    if (x.dado?.startsWith('campo:')) {
        if (x.valores.includes('@vazio') && v === undefined) return true;
        if (x.valores.includes('@preenchido') && v !== undefined) return true;
    }
    return v !== undefined && x.valores.includes(v);
}

/** A ação vale agora (sem condição, ou com a resposta que ela pede, de ação que também vale)? */
export function acaoAtiva(f: FaseRegras | undefined, i: number, resp: Record<string, string> | undefined): boolean {
    const se = f?.acoes_regras?.[i]?.se;
    if (!se) return true;
    return [se, ...(se.e || [])].every((x) => !condicaoLocal(x) || x.acao < i) && condicaoAtendida(se, resp, f);
}

type ProcDaCondicao = {
    acoes_respostas?: unknown; fase_atual?: unknown; urgente?: unknown; sigilo?: unknown; partes?: unknown; origem?: unknown; tipo_id?: unknown; campos?: unknown;
};

/**
 * Tudo o que uma condição do rito pode ler no processo, numa só tabela:
 * - as respostas da rodada da fase atual ('2', '2.sistema'), como sempre;
 * - as respostas dadas nas outras fases ('analise/2'), como ficaram quando o
 *   processo passou por lá (a rodada recomeça quando ele volta à fase);
 * - dados do processo ('@urgente', '@sigilo', '@partes', '@origem', '@tipo' e
 *   '@campo:<id>' para os campos do tipo de processo).
 * O que se grava em `acoes_respostas` não passa por aqui.
 */
export function respostasDaFase(proc: ProcDaCondicao): Record<string, string> {
    const todas = (proc.acoes_respostas || {}) as Respostas;
    const atual = String(proc.fase_atual);
    const out: Record<string, string> = {};
    for (const [fase, resp] of Object.entries(todas)) {
        if (fase !== atual) for (const [k, v] of Object.entries(resp || {})) out[`${fase}/${k}`] = v;
    }
    Object.assign(out, todas[atual] || {});
    out['@urgente'] = proc.urgente === true ? 'sim' : 'nao';
    out['@sigilo'] = proc.sigilo === 'restrito' ? 'restrito' : 'normal';
    out['@partes'] = (Array.isArray(proc.partes) ? proc.partes : []).some((p) => p && !(p as { retirada?: unknown }).retirada) ? 'sim' : 'nao';
    const origem = (proc.origem as { tipo?: unknown } | null | undefined)?.tipo;
    if (typeof origem === 'string' && origem) out['@origem'] = origem;
    if (typeof proc.tipo_id === 'string' && proc.tipo_id) out['@tipo'] = proc.tipo_id;
    for (const c of (Array.isArray(proc.campos) ? proc.campos : []) as Array<{ id?: unknown; valor?: unknown }>) {
        if (typeof c?.id === 'string' && c.id && c.valor !== null && c.valor !== undefined && c.valor !== '' && typeof c.valor !== 'object') {
            out[`@campo:${c.id}`] = chaveDaResposta(c.valor);
        } else if (typeof c?.id === 'string' && c.id && Array.isArray(c.valor) && c.valor.length) {
            // Múltipla escolha marcada: só conta como preenchida.
            out[`@campo:${c.id}`] = '@preenchido';
        }
    }
    return out;
}

/** Onde fica o ato durante a fase (valor estranho lê como o padrão). */
export function destinoDoAto(f: FaseRegras | undefined, ato: OutroAto): DestinoAto {
    return lido(f?.registro_atos?.outros?.[ato], opcoesDoAto(ato), PADRAO_OUTRO[ato]);
}

/** Marcas do movimento para o ato; no padrão, nenhuma (fica como sempre foi). */
export function marcasDoAto(f: FaseRegras | undefined, ato: OutroAto): Record<string, boolean> {
    const d = destinoDoAto(f, ato);
    return d === PADRAO_OUTRO[ato] ? {} : marcasDoDestino(d);
}

/** Marcas do ato pelo que o rito diz na fase em que o processo está. */
export const marcasNaFase = (proc: { fases?: unknown; fase_atual?: unknown }, ato: OutroAto): Record<string, boolean> =>
    marcasDoAto(((proc.fases || []) as FaseRegras[]).find((f) => f.id === proc.fase_atual), ato);

function sanitizeRegistroAtos(fo: Record<string, unknown>): RegistroAtos | undefined {
    const ra = (fo.registro_atos && typeof fo.registro_atos === 'object' ? fo.registro_atos : null) as Record<string, unknown> | null;
    const ob = (ra?.outros && typeof ra.outros === 'object' ? ra.outros : {}) as Record<string, unknown>;
    const outros: Partial<Record<OutroAto, DestinoAto>> = {};
    for (const a of OUTROS_ATOS) {
        const d = lido(ob[a], opcoesDoAto(a), PADRAO_OUTRO[a]);
        if (d !== PADRAO_OUTRO[a]) outros[a] = d;
    }
    const n = ra
        ? { fase: lido(ra.fase, DESTINOS_ATO, 'autos'), remessas: lido(ra.remessas, DESTINOS_ATO, 'autos') }
        : niveisDaFase({ id: '', registro: REGISTROS.includes(fo.registro as Registro) ? (fo.registro as Registro) : undefined });
    const out: RegistroAtos = {
        ...(n.fase !== 'autos' ? { fase: n.fase } : {}),
        ...(n.remessas !== 'autos' ? { remessas: n.remessas } : {}),
        ...(Object.keys(outros).length ? { outros } : {}),
    };
    return Object.keys(out).length ? out : undefined;
}

/** Saneia registro, regras das ações (alinhadas às ações) e documentos da fase. Lança Error com mensagem para o usuário. */
export function sanitizeRegras(fo: Record<string, unknown>, acoes: string[], mapa?: Map<number, number>) {
    const registroAtos = sanitizeRegistroAtos(fo);
    const brutas = Array.isArray(fo.acoes_regras) ? fo.acoes_regras : [];
    const regras = acoes.map((a, i) => sanitizeRegra(brutas[i], a));
    // "Só vale se": depende de uma ação de escolha anterior (nunca dela mesma nem de uma posterior).
    regras.forEach((r, i) => {
        const b = brutas[i] as Record<string, unknown> | undefined;
        // A que lê outra fase, dado do processo ou várias coisas fica para o fim do rito (sanitizeRito), com todas as fases prontas.
        const se = condicaoAmpla(b?.se) ? undefined : sanitizeCondicao(b?.se, regras, acoes, `A ação "${acoes[i]}"`, mapa, i);
        if (se) regras[i] = { ...(r || {}), se };
        const ou = sanitizeOu(b?.ou, regras, acoes, i, mapa);
        if (ou !== undefined) regras[i] = { ...(regras[i] || {}), ou };
        if (regras[i]?.pede === 'resposta') regras[i] = { ...regras[i], resposta: sanitizeRespostaDaAcao((b as Record<string, unknown> | undefined)?.resposta, regras, acoes, i, mapa) };
        // Prazo próprio: qualquer ação que se cumpre (a que é só orientação não tem o que cumprir).
        const prazo = Number(b?.prazo_dias);
        if (Number.isInteger(prazo) && prazo > 0 && prazo <= 3650 && !['orientacao', 'resposta'].includes(String(regras[i]?.pede))) {
            regras[i] = { ...(regras[i] || {}), prazo_dias: prazo, ...(b?.prazo_contagem === 'corridos' ? { prazo_contagem: 'corridos' as const } : {}) };
        }
    });
    const documentos = (Array.isArray(fo.documentos) ? fo.documentos : [])
        .map((d) => sanitizeExigencia(d)).filter((d): d is Exigencia => !!d).slice(0, MAX_DOCUMENTOS_FASE);
    return {
        ...(registroAtos ? { registro_atos: registroAtos } : {}),
        ...(regras.some(Boolean) ? { acoes_regras: regras } : {}),
        ...(documentos.length ? { documentos } : {}),
    };
}

/**
 * Onde fica o registro de um documento guardado fora dos autos. Cumprindo
 * exigência do rito, vale o que ela pede (só no sistema, se todas pedem). Sem
 * exigência, segue a fase: a que o rito deixa fora da impressão (só no
 * sistema ou sem evento) não põe a guarda no extrato impresso.
 */
export function destinoDaGuarda(f: FaseRegras | undefined, cumpridas: Exigencia[]): Destino {
    if (cumpridas.length) return cumpridas.every((e) => e.destino === 'informacao') ? 'informacao' : 'evento';
    return ['informacao', 'nenhum'].includes(niveisDaFase(f).fase) ? 'informacao' : 'evento';
}

/** Exigências de documento da fase com a chave que o processo grava: 'd0' (da fase), 'a2' (da ação 2). */
export function exigenciasDaFase(f: FaseRegras | undefined, resp?: Record<string, string>): Array<Exigencia & { chave: string; acao_idx?: number }> {
    if (!f) return [];
    return [
        ...(f.documentos || []).map((d, i) => ({ ...d, chave: `d${i}` })),
        // Ação condicional que não vale agora não exige o documento.
        ...(f.acoes_regras || []).flatMap((r, i) => (r?.documento && f.acoes?.[i] && acaoAtiva(f, i, resp) ? [{ ...r.documento, chave: `a${i}`, acao_idx: i }] : [])),
    ];
}

/**
 * A fase tem algum item obrigatório que vale agora (documento exigido ou ação
 * obrigatória)? Sem nenhum, ela não segue sozinha por juntada: não haveria o
 * que cumprir, e qualquer documento a encerraria.
 */
export const exigeAlgo = (f: FaseRegras | undefined, resp?: Record<string, string>): boolean =>
    exigenciasDaFase(f, resp).some((e) => !e.nivel)
    || (f?.acoes_regras || []).some((r, i) => r?.obrigatoria === true && !!f?.acoes?.[i] && acaoAtiva(f, i, resp));

export type Cumpridas = Record<string, Record<string, { documento_id: string; ordem?: number | null }>>;

/** Documentos exigidos ainda não cumpridos na fase. */
export function pendentesDaFase(f: FaseRegras | undefined, cumpridas: Cumpridas | undefined, resp?: Record<string, string>) {
    const feitas = (f && cumpridas?.[f.id]) || {};
    return exigenciasDaFase(f, resp).filter((e) => !feitas[e.chave]);
}

/** Documentos obrigatórios ainda não cumpridos: os recomendados e opcionais não impedem a fase de seguir. */
export const documentosQueFaltam = (f: FaseRegras | undefined, cumpridas: Cumpridas | undefined, resp?: Record<string, string>) =>
    pendentesDaFase(f, cumpridas, resp).filter((e) => !e.nivel);

/** Ações obrigatórias (sem documento) ainda não feitas na fase. */
export function acoesObrigatoriasPendentes(f: FaseRegras | undefined, feitas: number[] | undefined, resp?: Record<string, string>) {
    if (!f) return [];
    const ok = new Set(feitas || []);
    const cobrada = (i: number) => !!f.acoes_regras?.[i]?.obrigatoria && !f.acoes_regras[i]?.documento && !ok.has(i) && acaoAtiva(f, i, resp)
        && !alternativaCumprida(f, i, ok, resp);
    return (f.acoes || []).flatMap((_a, i) => {
        if (!cobrada(i)) return [];
        // Alternativas: o grupo aparece uma vez, como "A ou B" (só as que valem agora).
        const grupo = grupoDeAlternativas(f, i).filter((k) => acaoAtiva(f, k, resp));
        return grupo.find(cobrada) === i ? [{ descricao: grupo.map((k) => (f.acoes || [])[k]).join(' ou '), acao_idx: i }] : [];
    });
}

export interface DocJuntado {
    origem: string; tipo?: string; modelo_id?: string; peticao?: boolean; /** Guardado fora dos autos. */ controle?: boolean;
    /** Quantas assinaturas o documento tem e as atribuições de quem assinou (na lotação das unidades). */
    assinaturas?: number; atribuicoes?: string[];
}

/** O que falta de assinatura para o documento cumprir a exigência (null = nada). */
export function faltaAssinatura(e: Exigencia, d: DocJuntado): string | null {
    const n = e.assinaturas || 0;
    if (n && (d.assinaturas || 0) < n) return `"${e.descricao}" pede ${n === 1 ? 'o documento assinado' : `${n} assinaturas no documento`} antes de juntar`;
    if (e.assinatura_atribuicao && !(d.atribuicoes || []).some((a) => mesmaAtribuicao(a, e.assinatura_atribuicao))) {
        return `"${e.descricao}" pede a assinatura de quem tem a atribuição ${e.assinatura_atribuicao}`;
    }
    return null;
}

/** Redigir = produzido pelo órgão (editor ou modelo); juntar = recebido de fora (arquivo ou petição da parte). */
export function atende(e: Exigencia, d: DocJuntado): boolean {
    // Exigência para os autos só se cumpre com juntada; a de controle, só guardando fora dos autos.
    if (!!e.destino !== (d.controle === true)) return false;
    const redigido = !d.peticao && (d.origem === 'editor' || !!d.modelo_id);
    if (e.forma === 'redigir' && !redigido) return false;
    if (e.forma === 'juntar' && redigido) return false;
    return true;
}

const igual = (a?: string, b?: string) => !!a && !!b && a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;

/**
 * Exigências pendentes que o documento cumpre. Com `escolhidas` (chaves que
 * quem junta marcou), valida cada uma; sem elas, reconhece pelo modelo usado
 * ou pelo tipo do documento. Lança Error com mensagem para o usuário.
 */
export function reconhecer(pendentes: Array<Exigencia & { chave: string }>, d: DocJuntado, escolhidas?: unknown): string[] {
    if (Array.isArray(escolhidas)) {
        const chaves = [...new Set(escolhidas.map(String))];
        for (const k of chaves) {
            const e = pendentes.find((x) => x.chave === k);
            if (!e) throw new Error('Uma das exigências marcadas não está pendente nesta fase');
            if (!!e.destino !== (d.controle === true)) {
                throw new Error(e.destino ? `"${e.descricao}" pede documento guardado fora dos autos: use "Guardar fora dos autos"` : `"${e.descricao}" pede documento juntado aos autos`);
            }
            if (!atende(e, d)) throw new Error(`"${e.descricao}" pede documento ${e.forma === 'redigir' ? 'redigido pelo órgão' : 'recebido de fora (arquivo enviado)'}`);
            const falta = faltaAssinatura(e, d);
            if (falta) throw new Error(falta);
        }
        return chaves;
    }
    return pendentes
        .filter((e) => atende(e, d) && !faltaAssinatura(e, d) && ((e.modelo_id && e.modelo_id === d.modelo_id) || igual(e.tipo, d.tipo)))
        .map((e) => e.chave);
}

/**
 * Campos do processo a gravar quando a juntada (ou a guarda fora dos autos)
 * cumpre exigências da fase: `exigencias_cumpridas` e, para as de ação, a
 * ação marcada em `acoes_feitas`.
 */
export function camposDoCumprimento(
    proc: { exigencias_cumpridas?: unknown; acoes_feitas?: unknown },
    faseId: string, cumpridas: Array<{ chave: string; acao_idx?: number }>, documentoId: string, ordem: number | null,
): Record<string, unknown> {
    if (!cumpridas.length) return {};
    const todas = (proc.exigencias_cumpridas || {}) as Cumpridas;
    const out: Record<string, unknown> = {
        exigencias_cumpridas: { ...todas, [faseId]: { ...(todas[faseId] || {}), ...Object.fromEntries(cumpridas.map((e) => [e.chave, { documento_id: documentoId, ordem }])) } },
    };
    const acoes = cumpridas.filter((e) => typeof e.acao_idx === 'number').map((e) => e.acao_idx as number);
    if (acoes.length) {
        const feitasTodas = (proc.acoes_feitas || {}) as Record<string, number[]>;
        out.acoes_feitas = { ...feitasTodas, [faseId]: [...new Set([...(feitasTodas[faseId] || []), ...acoes])].sort((a, b) => a - b) };
    }
    return out;
}

/** Ao entrar numa fase (inclusive voltando a ela), o que ela exige recomeça: a rodada anterior fica nos movimentos. */
export function camposAoEntrarNaFase(proc: { exigencias_cumpridas?: unknown; acoes_feitas?: unknown; acoes_respostas?: unknown }, faseId: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const ex = (proc.exigencias_cumpridas || {}) as Record<string, unknown>;
    const ac = (proc.acoes_feitas || {}) as Record<string, unknown>;
    const rs = (proc.acoes_respostas || {}) as Record<string, unknown>;
    if (faseId in ex) { const { [faseId]: _x, ...resto } = ex; out.exigencias_cumpridas = resto; }
    if (faseId in ac) { const { [faseId]: _y, ...resto } = ac; out.acoes_feitas = resto; }
    if (faseId in rs) { const { [faseId]: _z, ...resto } = rs; out.acoes_respostas = resto; }
    // O que o sistema cumpriu pelo campo do processo e o que alguém desfez à mão valem só para a rodada.
    for (const k of ['acoes_auto', 'acoes_auto_off'] as const) {
        const m = ((proc as Record<string, unknown>)[k] || {}) as Record<string, unknown>;
        if (faseId in m) { const { [faseId]: _w, ...resto } = m; out[k] = resto; }
    }
    return out;
}

/**
 * Onde fica o ato de tramitação. Mudança de fase: o mais reservado entre a
 * fase de onde sai e a para onde vai. Remessa sem mudar de fase: o que a fase
 * atual diz das remessas.
 */
export function destinoDoMovimento(fases: FaseRegras[], deId: string, paraId?: string | null): DestinoAto {
    const de = niveisDaFase(fases.find((f) => f.id === deId));
    if (paraId && paraId !== deId) return destinoTransicao(de.fase, niveisDaFase(fases.find((f) => f.id === paraId)).fase);
    return de.remessas;
}

/** O ato vai só para o registro interno (fora dos autos)? */
export const movimentoInterno = (fases: FaseRegras[], deId: string, paraId?: string | null): boolean =>
    destinoDoMovimento(fases, deId, paraId) !== 'autos';

// ============================================================================
// Certidão conjunta. Os atos marcados 'consolidar' (e, se a fase pedir, as
// mudanças de fase dentro do grupo) ficam como registro oculto e entram como
// itens em `proc.consolidacao`; ao sair do grupo, arquivar ou "Emitir
// certidão agora", vira UMA certidão nos autos, com folha.
// ============================================================================

/**
 * A certidão ocupa uma folha: o texto inteiro tem de caber numa página do
 * termo (exportar.ts: A4, corpo 11pt, cerca de 29 linhas livres). 1800
 * caracteres dão uns 24 linhas, com folga para título longo e palavras largas.
 * Passou disso, a pendente é emitida e outra começa.
 */
export const MAX_TEXTO_CERTIDAO = 1800;
/** Item longo (dado de texto longo) entra resumido; a íntegra fica no registro do ato e nas informações. */
export const MAX_ITEM_CERTIDAO = 300;
export interface ItemCertidao { seq: number; fase_id: string; acao_idx?: number; texto: string; autor: string; em: string; partes: boolean }
export interface Consolidacao { grupo: string; itens: ItemCertidao[] }

/** Grupo da certidão da fase: o configurado, ou a própria fase. */
export const grupoDe = (f: FaseRegras | undefined): string => (f ? f.certidao?.grupo || f.id : '');

/** Título da certidão do grupo: o que a primeira fase do grupo deu, ou o nome das fases. */
export function tituloCertidao(fases: FaseRegras[], grupo: string): string {
    const membros = fases.filter((f) => grupoDe(f) === grupo);
    // Vale o título da fase raiz; o de outra fase do grupo só se a raiz não deu.
    const dado = membros.find((f) => f.id === grupo)?.certidao?.titulo || membros.find((f) => f.certidao?.titulo)?.certidao?.titulo;
    if (dado) return dado;
    const nomes = membros.map((f) => f.nome || f.id);
    return nomes.length > 1 ? `Certidão das fases ${nomes.join(', ')}` : `Certidão da fase ${nomes[0] || grupo}`;
}

/** Mudança de fase dentro do mesmo grupo vira item da certidão (em vez de termo próprio)? */
export const mudancaNaCertidao = (fases: FaseRegras[], deId: string, paraId: string): boolean => {
    const de = fases.find((f) => f.id === deId);
    const para = fases.find((f) => f.id === paraId);
    return !!de && !!para && grupoDe(de) === grupoDe(para) && (de.certidao?.incluir_mudancas === true || para.certidao?.incluir_mudancas === true);
};

/** Há certidão por emitir antes deste ato? `paraId` null = sai do fluxo (arquivar). */
export function deveEmitir(fases: FaseRegras[], c: Consolidacao | undefined | null, deId: string, paraId: string | null): boolean {
    if (!c?.itens?.length) return false;
    if (!paraId) return true;
    return grupoDe(fases.find((f) => f.id === paraId)) !== c.grupo || grupoDe(fases.find((f) => f.id === deId)) !== c.grupo;
}

const quando = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const ABERTURA_CERTIDAO = 'Certifico que foram cumpridos os seguintes atos:';
export const MAX_ABERTURA_CERTIDAO = 200;

/** Frase de abertura da certidão do grupo: a da fase raiz, a de outra fase do grupo, ou a padrão. */
export function aberturaCertidao(fases: FaseRegras[], grupo: string): string {
    const membros = fases.filter((f) => grupoDe(f) === grupo);
    return membros.find((f) => f.id === grupo)?.certidao?.abertura || membros.find((f) => f.certidao?.abertura)?.certidao?.abertura || ABERTURA_CERTIDAO;
}

/** Texto da certidão conjunta (o título vai no evento): um item por ato, com quem fez e quando. */
export function textoCertidao(itens: ItemCertidao[], abertura = ABERTURA_CERTIDAO): string {
    const linhas = itens.map((i, k) => `${k + 1}) ${i.texto}${i.autor ? ` (${i.autor}${i.em ? `, ${quando(i.em)}` : ''})` : ''}`);
    return `${abertura} ${linhas.join('; ')}.`;
}

export const textoDoItem = (t: string): string =>
    (t.length > MAX_ITEM_CERTIDAO ? `${t.slice(0, MAX_ITEM_CERTIDAO - 40).trimEnd()}… (íntegra no registro do ato)` : t);

/** O item ainda cabe na folha da certidão pendente? */
export const cabeNaCertidao = (itens: ItemCertidao[], item: ItemCertidao, abertura?: string): boolean =>
    textoCertidao([...itens, item], abertura).length <= MAX_TEXTO_CERTIDAO;

/** As partes veem a certidão só se puderem ver todos os itens. */
export const visivelCertidao = (itens: ItemCertidao[]): boolean => itens.length > 0 && itens.every((i) => i.partes);

/** Campos de `dados` do movimento para o destino: interno (sem folha), fora da impressão e oculto (sem evento). */
export function marcasDoDestino(d: DestinoAto): Record<string, boolean> {
    if (d === 'autos') return {};
    if (d === 'nenhum') return { interno: true, fora_impressao: true, oculto: true, visivel_partes: false };
    return d === 'informacao' ? { interno: true, fora_impressao: true } : { interno: true };
}
