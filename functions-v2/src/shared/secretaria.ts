import { createHash } from 'crypto';

// ============================================================================
// Processo Eletrônico (antiga Secretaria Processual; os nomes internos
// `secretaria*` e as coleções `sec*` foram mantidos) — regras puras (sem
// Firestore), testadas em functions-v2/test/secretaria.test.js.
//
// Vocabulário:
//   - unidade de lotação: secretaria (movimenta e cumpre), gabinete (decide),
//     assessoria (estuda e minuta) ou outra. Cada unidade tem lotações
//     (pessoa, atribuição e se é gestora da unidade).
//   - posse: o processo está SEMPRE com uma unidade (unidade_atual). Só quem
//     está lotado nela movimenta o processo.
//   - rito: sequência de fases, com versão. O processo guarda a versão do rito
//     com que foi autuado, então editar o rito não muda processos em curso.
//   - movimento: registro imutável do que aconteceu. Cada movimento leva o
//     hash SHA-256 do anterior; alterar um movimento antigo quebra a cadeia.
// ============================================================================

export type TipoUnidade = 'secretaria' | 'gabinete' | 'assessoria' | 'outra';
export const TIPOS_UNIDADE: TipoUnidade[] = ['secretaria', 'gabinete', 'assessoria', 'outra'];

/** Pessoa lotada numa unidade: atribuição livre e se gere a unidade. */
export interface Lotacao { uid: string; atribuicao: string; gestor: boolean }
export const MAX_LOTACOES = 200;
export type Sigilo = 'normal' | 'restrito';
export type StatusProcesso = 'em_tramitacao' | 'sobrestado' | 'arquivado';

export interface Fase {
    id: string;
    nome: string;
    prazo_dias?: number;
    /** Orientação para quem trabalha na fase. */
    orientacao?: string;
    /** Fases para onde o processo pode seguir. Ausente = a próxima da lista. */
    proximas?: string[];
    /** Fase terminal: o fluxo acaba nela, mesmo que não seja a última da lista. */
    final?: boolean;
    /** Unidade que cuida da fase (sugestão de tramitação ao entrar nela). */
    unidade_id?: string;
    /** Quem faz (cargo ou papel), ex.: "Analista", "Promotor". */
    agente?: string;
    /** O que fazer na fase, em itens. */
    acoes?: string[];
    /** Modelos de documento sugeridos na fase (ids de secModelos). */
    modelos?: string[];
    /** Condição de cada saída: { id da próxima fase: "se deferido" }. */
    condicoes?: Record<string, string>;
}
export interface Rito { nome: string; descricao: string; fases: Fase[] }

export interface ContextoUsuario {
    uid: string;
    /** Criador do órgão ou permissão configure_secretaria. */
    isAdmin: boolean;
    /** Unidades em que o usuário está lotado. */
    unidadeIds: string[];
}

export interface ProcessoAcesso {
    unidade_atual: string;
    unidades_historico?: string[];
    sigilo?: string;
}

export const MAX_TEXTO_CURTO = 200;
export const MAX_TEXTO_LONGO = 4000;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_FASES = 30;
export const MAX_ACOES = 20;
export const MAX_MODELOS_FASE = 10;

export const TIPOS_ARQUIVO_PERMITIDOS: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'text/plain': 'txt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/msword': 'doc',
    'application/vnd.oasis.opendocument.text': 'odt',
};

export function texto(v: unknown, max = MAX_TEXTO_CURTO): string {
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function slug(v: string): string {
    return v
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'fase';
}

/** Saneia um rito vindo do cliente. Lança Error com mensagem para o usuário. */
export function sanitizeRito(input: unknown): Rito {
    const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const nome = texto(src.nome);
    if (!nome) throw new Error('O rito precisa de um nome');
    const fasesIn = Array.isArray(src.fases) ? src.fases : [];
    if (fasesIn.length === 0) throw new Error('O rito precisa de ao menos uma fase');
    if (fasesIn.length > MAX_FASES) throw new Error(`O rito aceita no máximo ${MAX_FASES} fases`);
    const vistos = new Set<string>();
    // O id que o cliente mandou (referenciado em `proximas`) vira o id final.
    const ids = new Map<string, string>();
    const brutas = fasesIn.map((f, i) => {
        const fo = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
        const nomeFase = texto(fo.nome);
        if (!nomeFase) throw new Error(`A fase ${i + 1} está sem nome`);
        const original = texto(fo.id, 40);
        let id = slug(original || nomeFase);
        while (vistos.has(id)) id = `${id}_${i}`;
        vistos.add(id);
        if (original) ids.set(original, id);
        return { fo, id, nomeFase };
    });
    const fases: Fase[] = brutas.map(({ fo, id, nomeFase }) => {
        const prazo = Number(fo.prazo_dias);
        const orientacao = texto(fo.orientacao, MAX_TEXTO_LONGO);
        const final = fo.final === true;
        const proximas = !final && Array.isArray(fo.proximas)
            ? [...new Set(fo.proximas.map((x) => {
                const alvo = ids.get(String(x)) ?? (vistos.has(String(x)) ? String(x) : null);
                if (!alvo) throw new Error(`A fase "${nomeFase}" aponta para uma fase que não existe`);
                if (alvo === id) throw new Error(`A fase "${nomeFase}" não pode seguir para ela mesma`);
                return alvo;
            }))]
            : [];
        const unidade = texto(fo.unidade_id, 40);
        const agente = texto(fo.agente, 80);
        const acoes = (Array.isArray(fo.acoes) ? fo.acoes : []).map((a) => texto(a, 200)).filter(Boolean).slice(0, MAX_ACOES);
        const modelos = [...new Set((Array.isArray(fo.modelos) ? fo.modelos : []).map((m) => texto(m, 40)).filter(Boolean))].slice(0, MAX_MODELOS_FASE);
        // Condições só para saídas que existem (referência pelo id do cliente ou final).
        const condicoes: Record<string, string> = {};
        if (fo.condicoes && typeof fo.condicoes === 'object') {
            for (const [k, v] of Object.entries(fo.condicoes as Record<string, unknown>)) {
                const alvo = ids.get(k) ?? (vistos.has(k) ? k : null);
                const rot = texto(v, 80);
                if (alvo && rot && proximas.includes(alvo)) condicoes[alvo] = rot;
            }
        }
        return {
            id,
            nome: nomeFase,
            ...(Number.isInteger(prazo) && prazo > 0 && prazo <= 3650 ? { prazo_dias: prazo } : {}),
            ...(orientacao ? { orientacao } : {}),
            ...(proximas.length ? { proximas } : {}),
            ...(final ? { final: true } : {}),
            ...(unidade ? { unidade_id: unidade } : {}),
            ...(agente ? { agente } : {}),
            ...(acoes.length ? { acoes } : {}),
            ...(modelos.length ? { modelos } : {}),
            ...(Object.keys(condicoes).length ? { condicoes } : {}),
        };
    });
    return { nome, descricao: texto(src.descricao, MAX_TEXTO_LONGO), fases };
}

/**
 * Fases para onde o processo segue a partir da atual: as `proximas` da fase,
 * ou a seguinte da lista. Ir para outra fase é possível, mas fica registrado
 * como fora do fluxo e exige justificativa.
 */
export function fasesSeguintes(fases: Fase[], atualId: string): Fase[] {
    const i = fases.findIndex((f) => f.id === atualId);
    if (i < 0) return [];
    const atual = fases[i];
    if (atual.final) return [];
    if (atual.proximas?.length) return atual.proximas.map((id) => fases.find((f) => f.id === id)).filter((f): f is Fase => !!f);
    return i < fases.length - 1 ? [fases[i + 1]] : [];
}

/** Fase seguinte no fluxo (a primeira, se houver ramificação), ou null. */
export function proximaFase(rito: Rito, faseAtualId: string): Fase | null {
    return fasesSeguintes(rito.fases, faseAtualId)[0] || null;
}

/** Quem tem o processo consigo: lotados na unidade que detém a posse. */
export function podeAgir(proc: ProcessoAcesso, ctx: ContextoUsuario): boolean {
    return ctx.unidadeIds.includes(proc.unidade_atual);
}

/**
 * Quem pode ler os autos:
 *   - administrador da Secretaria do órgão: todos;
 *   - sigilo normal: qualquer usuário lotado em alguma unidade do órgão;
 *   - sigilo restrito: só unidades por onde o processo passou.
 */
export function podeVer(proc: ProcessoAcesso, ctx: ContextoUsuario): boolean {
    if (ctx.isAdmin) return true;
    if (podeAgir(proc, ctx)) return true;
    if (ctx.unidadeIds.length === 0) return false;
    if (proc.sigilo === 'restrito') {
        const hist = proc.unidades_historico || [];
        return ctx.unidadeIds.some((u) => hist.includes(u));
    }
    return true;
}

export function numeroProcesso(ano: number, seq: number): string {
    return `${String(seq).padStart(6, '0')}/${ano}`;
}

/** JSON com chaves ordenadas: o mesmo conteúdo sempre gera o mesmo texto. */
export function jsonCanonico(v: unknown): string {
    if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
    if (Array.isArray(v)) return `[${v.map(jsonCanonico).join(',')}]`;
    const obj = v as Record<string, unknown>;
    const chaves = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${jsonCanonico(obj[k])}`).join(',')}}`;
}

export function sha256(dado: string | Buffer): string {
    return createHash('sha256').update(dado).digest('hex');
}

export interface MovimentoBase {
    seq: number;
    tipo: string;
    descricao: string;
    autor_uid: string;
    autor_nome: string;
    unidade_id: string;
    em: string; // ISO 8601
    dados: Record<string, unknown>;
    hash_anterior: string;
}

export function hashMovimento(m: MovimentoBase): string {
    return sha256(jsonCanonico({
        seq: m.seq,
        tipo: m.tipo,
        descricao: m.descricao,
        autor_uid: m.autor_uid,
        autor_nome: m.autor_nome,
        unidade_id: m.unidade_id,
        em: m.em,
        dados: m.dados,
        hash_anterior: m.hash_anterior,
    }));
}

/** Confere a cadeia inteira. Retorna o seq do primeiro movimento quebrado, ou null. */
export function verificarCadeia(movs: Array<MovimentoBase & { hash: string }>): number | null {
    let anterior = '';
    const ordenados = [...movs].sort((a, b) => a.seq - b.seq);
    for (const m of ordenados) {
        if (m.hash_anterior !== anterior || hashMovimento(m) !== m.hash) return m.seq;
        anterior = m.hash;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Conteúdo redigido na plataforma: guardado como Delta do editor (lista de
// operações de texto com atributos). Aceitamos só texto e um conjunto fechado
// de formatos — nada de HTML, imagens embutidas ou links com script. Assim o
// conteúdo nunca é interpretado como HTML em lugar nenhum.
// ---------------------------------------------------------------------------

const ATRIBUTOS_PERMITIDOS: Record<string, (v: unknown) => boolean> = {
    bold: (v) => v === true,
    italic: (v) => v === true,
    underline: (v) => v === true,
    header: (v) => v === 1 || v === 2 || v === 3,
    list: (v) => v === 'ordered' || v === 'bullet',
    align: (v) => v === 'center' || v === 'right' || v === 'justify',
    blockquote: (v) => v === true,
    indent: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 8,
};

export interface DeltaOp { insert: string; attributes?: Record<string, unknown> }
export const MAX_DELTA_CHARS = 400_000;

export function sanitizeDelta(input: unknown): DeltaOp[] {
    const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const ops = Array.isArray(src.ops) ? src.ops : Array.isArray(input) ? (input as unknown[]) : [];
    const out: DeltaOp[] = [];
    let total = 0;
    for (const op of ops) {
        const o = (op && typeof op === 'object' ? op : {}) as Record<string, unknown>;
        if (typeof o.insert !== 'string') continue; // descarta embeds
        total += o.insert.length;
        if (total > MAX_DELTA_CHARS) throw new Error('Documento grande demais para o editor');
        const attrsIn = (o.attributes && typeof o.attributes === 'object' ? o.attributes : {}) as Record<string, unknown>;
        const attrs: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(attrsIn)) {
            if (ATRIBUTOS_PERMITIDOS[k]?.(v)) attrs[k] = v;
        }
        out.push(Object.keys(attrs).length ? { insert: o.insert, attributes: attrs } : { insert: o.insert });
    }
    return out;
}

/** Texto puro do Delta (para PDF e busca). */
export function deltaParaTexto(ops: DeltaOp[]): string {
    return ops.map((o) => o.insert).join('');
}

// ---------------------------------------------------------------------------
// Prazos. Regra do CPC (art. 224): exclui o dia do começo e inclui o do
// vencimento; se o vencimento cai em dia não útil, prorroga para o primeiro
// útil seguinte. Em dias úteis, só contam dias úteis.
// Além dos feriados nacionais, o órgão cadastra feriados locais (não úteis)
// e períodos de recesso, em que os prazos ficam suspensos (não contam nem em
// dias corridos, como no art. 220 do CPC).
// ---------------------------------------------------------------------------

export interface CalendarioOrgao {
    /** Datas AAAA-MM-DD com descrição. */
    feriados?: Array<{ data: string; descricao?: string }>;
    /** Períodos (inclusivos) em que os prazos ficam suspensos. */
    recessos?: Array<{ inicio: string; fim: string; descricao?: string }>;
    /** Recesso forense anual de 20/12 a 20/01. */
    recesso_forense?: boolean;
}
export const MAX_FERIADOS = 200;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (v: unknown): v is string => typeof v === 'string' && DATA_ISO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export function sanitizeCalendario(input: unknown): Required<CalendarioOrgao> {
    const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const feriados = (Array.isArray(o.feriados) ? o.feriados : [])
        .map((f) => (f && typeof f === 'object' ? f : {}) as Record<string, unknown>)
        .filter((f) => dataValida(f.data))
        .map((f) => ({ data: String(f.data), descricao: texto(f.descricao, 80) }));
    const unicos = [...new Map(feriados.map((f) => [f.data, f])).values()].sort((a, b) => a.data.localeCompare(b.data)).slice(0, MAX_FERIADOS);
    const recessos = (Array.isArray(o.recessos) ? o.recessos : [])
        .map((r) => (r && typeof r === 'object' ? r : {}) as Record<string, unknown>)
        .filter((r) => dataValida(r.inicio) && dataValida(r.fim) && String(r.inicio) <= String(r.fim))
        .filter((r) => (Date.parse(String(r.fim)) - Date.parse(String(r.inicio))) / 86400000 <= 120)
        .map((r) => ({ inicio: String(r.inicio), fim: String(r.fim), descricao: texto(r.descricao, 80) }))
        .slice(0, 50);
    return { feriados: unicos, recessos, recesso_forense: o.recesso_forense === true };
}

/** Dia em que os prazos ficam suspensos pelo recesso do órgão. */
export function emRecesso(d: Date, cal?: CalendarioOrgao): boolean {
    if (!cal) return false;
    const s = iso(d);
    const md = s.slice(5);
    if (cal.recesso_forense && (md >= '12-20' || md <= '01-20')) return true;
    return (cal.recessos || []).some((r) => s >= r.inicio && s <= r.fim);
}

export type Contagem = 'corridos' | 'uteis';
export const MAX_PRAZO_DIAS = 3650;
export const MAX_ITENS = 200;

function iso(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** Domingo de Páscoa (algoritmo de Meeus/Butcher), em UTC. */
export function pascoa(ano: number): Date {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    return new Date(Date.UTC(ano, Math.floor(n / 31) - 1, (n % 31) + 1));
}

const FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];

export function feriadosNacionais(ano: number): Set<string> {
    const p = pascoa(ano).getTime();
    // Carnaval (segunda e terça), Sexta-feira Santa, Corpus Christi.
    const moveis = [-48, -47, -2, 60].map((n) => iso(new Date(p + n * 86400000)));
    return new Set([...FIXOS.map((f) => `${ano}-${f}`), ...moveis]);
}

export function diaUtil(d: Date, cal?: CalendarioOrgao): boolean {
    const w = d.getUTCDay();
    if (w === 0 || w === 6) return false;
    const s = iso(d);
    if (feriadosNacionais(d.getUTCFullYear()).has(s)) return false;
    if (cal?.feriados?.some((f) => f.data === s)) return false;
    return !emRecesso(d, cal);
}

/** Data de vencimento (AAAA-MM-DD) de um prazo aberto em `inicio` (AAAA-MM-DD). */
export function calcularVencimento(inicio: string, dias: number, contagem: Contagem, cal?: CalendarioOrgao): string {
    const d = new Date(`${inicio}T00:00:00Z`);
    let restantes = dias;
    while (restantes > 0) {
        d.setUTCDate(d.getUTCDate() + 1);
        // Recesso suspende o prazo também em dias corridos.
        if (contagem === 'corridos' ? !emRecesso(d, cal) : diaUtil(d, cal)) restantes--;
    }
    while (!diaUtil(d, cal)) d.setUTCDate(d.getUTCDate() + 1);
    return iso(d);
}

/** AAAA-MM-DD somado de n dias corridos. */
export function somarDias(data: string, n: number): string {
    const d = new Date(`${data}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return iso(d);
}

/** Hoje no fuso de Brasília, AAAA-MM-DD. */
export function hojeBrasil(agora = new Date()): string {
    return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export interface Pendencia {
    id: string;
    tipo: 'peticao' | 'documento' | 'manual';
    descricao: string;
    interrompe: boolean;
    status: 'aberta' | 'resolvida';
    [k: string]: unknown;
}
export interface Prazo {
    id: string;
    descricao: string;
    vence_em: string;
    status: 'aberto' | 'cumprido' | 'cancelado';
    [k: string]: unknown;
}

/** Campos derivados gravados no processo, para listas e filtros. */
export function derivados(pendencias: Pendencia[], prazos: Prazo[]) {
    const abertas = pendencias.filter((p) => p.status === 'aberta');
    const vencimentos = prazos.filter((p) => p.status === 'aberto').map((p) => p.vence_em).sort();
    return {
        pendencias_abertas: abertas.length,
        fase_suspensa: abertas.some((p) => p.interrompe),
        proximo_vencimento: vencimentos[0] || null,
    };
}

export function tipoUnidade(v: unknown): TipoUnidade {
    return TIPOS_UNIDADE.includes(v as TipoUnidade) ? (v as TipoUnidade) : 'secretaria';
}

/** Lotações saneadas (sem repetição de pessoa). */
export function sanitizeLotacoes(input: unknown): Lotacao[] {
    const vistos = new Set<string>();
    const out: Lotacao[] = [];
    for (const l of Array.isArray(input) ? input : []) {
        const o = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
        const uid = texto(o.uid, 128);
        if (!uid || vistos.has(uid)) continue;
        vistos.add(uid);
        out.push({ uid, atribuicao: texto(o.atribuicao, 80), gestor: o.gestor === true });
        if (out.length >= MAX_LOTACOES) break;
    }
    return out;
}

/**
 * Lotações da unidade. Unidades criadas antes das lotações só têm
 * `membros_uids`: cada uid vira lotação sem atribuição e sem gestão.
 */
export function lotacoesDe(u: Record<string, unknown>): Lotacao[] {
    if (Array.isArray(u.lotacoes)) return sanitizeLotacoes(u.lotacoes);
    return sanitizeLotacoes((Array.isArray(u.membros_uids) ? u.membros_uids : []).map((uid) => ({ uid })));
}

/**
 * Papel timbrado efetivo de uma unidade: o próprio, se ela tiver, ou o do
 * órgão. Tipos de documento da unidade somam-se aos do órgão.
 */
export function documentoEfetivo<T extends object>(
    orgao: T,
    unidade?: { timbrado_proprio?: boolean; documento?: object | null; tipos_documento?: string[] } | null
): T & { tipos_documento: string[] } {
    const base = unidade?.timbrado_proprio && unidade.documento ? { ...orgao, ...unidade.documento } : { ...orgao };
    const doOrgao = (orgao as { tipos_documento?: string[] }).tipos_documento || [];
    const tipos = [...new Set([...doOrgao, ...(unidade?.tipos_documento || [])])];
    return { ...base, tipos_documento: tipos } as T & { tipos_documento: string[] };
}
