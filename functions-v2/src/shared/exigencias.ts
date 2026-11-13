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
}

export const NIVEIS = ['recomendado', 'opcional'] as const;
export type NivelExigencia = typeof NIVEIS[number];

/** O que a ação pede a quem a cumpre. */
export const PEDIDOS = ['confirmar', 'texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao', 'registro', 'formulario', 'documento'] as const;
export type Pedido = typeof PEDIDOS[number];
export const MAX_OPCOES_ACAO = 30;
/** Campos de uma ação que pede um formulário. */
export const MAX_CAMPOS_ACAO = 10;

/**
 * Condição pela resposta de uma ação de escolha (lista ou sim/não) da mesma
 * fase: vale quando a resposta registrada está entre `valores`. Usada na ação
 * (`RegraAcao.se`: só vale nesse caso) e na saída (`Fase.condicoes_regra`).
 */
export interface Condicao { acao: number; valores: string[] }
/** Quem pode cumprir a ação, além da administração: o responsável designado ou quem gere a unidade. */
export const QUEM = ['responsavel', 'gestor'] as const;
export type Quem = typeof QUEM[number];
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
    /** Ausente = só confirmar (caixa de marcar). */
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
    /** Quem pode cumprir. Ausente = quem tem o processo. */
    quem?: Quem;
    /** Quem da equipe vê o dado. Ausente = toda a equipe. */
    ve?: Ve;
    /** Formato antigo: certidão nos autos. */
    autos?: true;
    documento?: Exigencia;
}

export const MAX_DOCUMENTOS_FASE = 5;

/** Certidão conjunta: fases com o mesmo `grupo` dividem uma só certidão. */
export interface CertidaoFase { grupo?: string; titulo?: string; incluir_mudancas?: true }

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
    return {
        descricao, forma, ...(tipo ? { tipo } : {}), ...(modelo ? { modelo_id: modelo } : {}), ...(dest !== 'autos' ? { destino: dest } : {}),
        ...(nivel ? { nivel } : {}),
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
    if (QUEM.includes(r.quem as Quem)) out.quem = r.quem as Quem;
    if (VE.includes(r.ve as Ve)) {
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
    return Object.keys(out).length ? out : null;
}

/** Opções que a resposta da ação pode ter (só ações de escolha condicionam). */
export function opcoesDaResposta(r: RegraAcao | null | undefined): string[] | null {
    if (!r || r.documento) return null;
    if (r.pede === 'lista') return r.opcoes || [];
    if (r.pede === 'sim_nao') return ['sim', 'nao'];
    return null;
}

/** Valor gravado como chave da resposta: a opção escolhida, ou 'sim'/'nao'. */
export const chaveDaResposta = (v: unknown): string => (typeof v === 'boolean' ? (v ? 'sim' : 'nao') : String(v ?? ''));

/**
 * Saneia a condição contra as regras já saneadas da fase. `mapa` traduz o índice
 * mandado pelo cliente para o índice gravado (linhas vazias saem); `antesDe`
 * limita a ações anteriores (ação condicional). Inválida: lança com mensagem.
 */
export function sanitizeCondicao(raw: unknown, regras: Array<RegraAcao | null>, acoes: string[], quem: string,
    mapa?: Map<number, number>, antesDe = Infinity): Condicao | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const o = raw as Record<string, unknown>;
    const bruto = Number(o.acao);
    const acao = mapa ? mapa.get(bruto) : bruto;
    // A ação de que dependia saiu (linha vazia): a condição sai com ela.
    if (acao === undefined) return undefined;
    const opcoes = Number.isInteger(acao) && acao >= 0 && acao < Math.min(acoes.length, antesDe) ? opcoesDaResposta(regras[acao]) : null;
    if (!opcoes) throw new Error(`${quem} depende da resposta de uma ação de escolha ${antesDe === Infinity ? 'desta fase' : 'anterior'}`);
    const valores = [...new Set((Array.isArray(o.valores) ? o.valores : []).map((v) => texto(v, 80)))].filter((v) => opcoes.includes(v));
    if (!valores.length) throw new Error(`${quem}: escolha ao menos uma resposta de "${acoes[acao]}"`);
    return { acao, valores };
}

/**
 * A condição vale com as respostas da rodada? Sem condição, sempre. Com `f`,
 * a resposta só conta se a ação que a deu também vale (condições em cadeia:
 * desfeita a resposta de cima, a de baixo deixa de pesar).
 */
export function condicaoAtendida(c: Condicao | undefined, resp: Record<string, string> | undefined, f?: FaseRegras): boolean {
    if (!c) return true;
    if (resp?.[String(c.acao)] === undefined || !c.valores.includes(resp[String(c.acao)])) return false;
    // A condição só aponta para ação anterior (o rito é validado assim): a recursão termina.
    return !f || acaoAtiva(f, c.acao, resp);
}

/** A ação vale agora (sem condição, ou com a resposta que ela pede, de ação que também vale)? */
export function acaoAtiva(f: FaseRegras | undefined, i: number, resp: Record<string, string> | undefined): boolean {
    const se = f?.acoes_regras?.[i]?.se;
    if (!se) return true;
    return se.acao < i && condicaoAtendida(se, resp, f);
}

/** Respostas da rodada da fase atual. */
export const respostasDaFase = (proc: { acoes_respostas?: unknown; fase_atual?: unknown }): Record<string, string> | undefined =>
    ((proc.acoes_respostas || {}) as Respostas)[String(proc.fase_atual)];

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
        const se = sanitizeCondicao(b?.se, regras, acoes, `A ação "${acoes[i]}"`, mapa, i);
        if (se) regras[i] = { ...(r || {}), se };
    });
    const documentos = (Array.isArray(fo.documentos) ? fo.documentos : [])
        .map((d) => sanitizeExigencia(d)).filter((d): d is Exigencia => !!d).slice(0, MAX_DOCUMENTOS_FASE);
    return {
        ...(registroAtos ? { registro_atos: registroAtos } : {}),
        ...(regras.some(Boolean) ? { acoes_regras: regras } : {}),
        ...(documentos.length ? { documentos } : {}),
    };
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
    return (f.acoes || []).flatMap((a, i) => (f.acoes_regras?.[i]?.obrigatoria && !f.acoes_regras[i]?.documento && !ok.has(i) && acaoAtiva(f, i, resp)
        ? [{ descricao: a, acao_idx: i }] : []));
}

export interface DocJuntado { origem: string; tipo?: string; modelo_id?: string; peticao?: boolean; /** Guardado fora dos autos. */ controle?: boolean }

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
        }
        return chaves;
    }
    return pendentes
        .filter((e) => atende(e, d) && ((e.modelo_id && e.modelo_id === d.modelo_id) || igual(e.tipo, d.tipo)))
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

/** Texto da certidão conjunta (o título vai no evento): um item por ato, com quem fez e quando. */
export function textoCertidao(itens: ItemCertidao[]): string {
    const linhas = itens.map((i, k) => `${k + 1}) ${i.texto}${i.autor ? ` (${i.autor}${i.em ? `, ${quando(i.em)}` : ''})` : ''}`);
    return `Certifico que foram cumpridos os seguintes atos: ${linhas.join('; ')}.`;
}

export const textoDoItem = (t: string): string =>
    (t.length > MAX_ITEM_CERTIDAO ? `${t.slice(0, MAX_ITEM_CERTIDAO - 40).trimEnd()}… (íntegra no registro do ato)` : t);

/** O item ainda cabe na folha da certidão pendente? */
export const cabeNaCertidao = (itens: ItemCertidao[], item: ItemCertidao): boolean =>
    textoCertidao([...itens, item]).length <= MAX_TEXTO_CERTIDAO;

/** As partes veem a certidão só se puderem ver todos os itens. */
export const visivelCertidao = (itens: ItemCertidao[]): boolean => itens.length > 0 && itens.every((i) => i.partes);

/** Campos de `dados` do movimento para o destino: interno (sem folha), fora da impressão e oculto (sem evento). */
export function marcasDoDestino(d: DestinoAto): Record<string, boolean> {
    if (d === 'autos') return {};
    if (d === 'nenhum') return { interno: true, fora_impressao: true, oculto: true, visivel_partes: false };
    return d === 'informacao' ? { interno: true, fora_impressao: true } : { interno: true };
}
