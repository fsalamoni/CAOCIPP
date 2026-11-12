// ============================================================================
// Numeração única do processo, montada por partes que o admin escolhe:
// número sequencial (contado no órgão todo, por tipo, por unidade ou por
// órgão interno, e reiniciado por ano, por mês ou nunca), ano, mês, dia,
// texto fixo e siglas. O tipo de processo usa a do órgão, a sua própria ou
// fica sem número. Lógica pura, testada em test/numeracao.test.js; o cliente
// tem o espelho em src/lib/numeracao.js (só para a prévia).
// ============================================================================

export const ESCOPOS = ['geral', 'tipo', 'unidade', 'orgao'] as const;
export const REINICIOS = ['ano', 'mes', 'nunca'] as const;
export type Escopo = typeof ESCOPOS[number];
export type Reinicio = typeof REINICIOS[number];

export type Parte =
    | { t: 'seq'; escopo: Escopo; reinicia: Reinicio; digitos: number }
    | { t: 'ano'; digitos: 2 | 4 }
    | { t: 'mes' }
    | { t: 'dia' }
    | { t: 'texto'; v: string }
    | { t: 'sigla_tipo' }
    | { t: 'sigla_unidade' }
    | { t: 'sigla_orgao' };

export interface Numeracao { partes: Parte[] }

/** Tipo de processo: a numeração do órgão, uma própria ou nenhuma. */
export interface NumeracaoTipo { modo: 'orgao' | 'propria' | 'nenhuma'; partes?: Parte[] }

export const MAX_PARTES = 12;
export const MAX_NUMERO = 60;

/** O formato de sempre: 000001/2026, contado no órgão todo e reiniciado a cada ano. */
export const NUMERACAO_PADRAO: Numeracao = {
    partes: [{ t: 'seq', escopo: 'geral', reinicia: 'ano', digitos: 6 }, { t: 'texto', v: '/' }, { t: 'ano', digitos: 4 }],
};

const TEXTO_OK = /^[A-Za-z0-9 ./\-_ºª°]{1,10}$/;
/** Maior tamanho possível de cada parte (siglas: tipo até 12, unidade e órgão até 20). */
const MAIOR: Record<string, number> = { ano: 4, mes: 2, dia: 2, sigla_tipo: 12, sigla_unidade: 20, sigla_orgao: 20 };
export const maiorTamanho = (n: Numeracao) => n.partes.reduce((s, p) => s + (p.t === 'seq' ? p.digitos + 2 : p.t === 'texto' ? p.v.length : MAIOR[p.t] || 0), 0);

/** Saneia a numeração vinda do cliente. Lança Error com mensagem para o usuário. */
export function sanitizeNumeracao(input: unknown): Numeracao {
    const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const lista = Array.isArray(src.partes) ? src.partes : [];
    if (!lista.length) throw new Error('Monte a numeração com ao menos o número sequencial');
    if (lista.length > MAX_PARTES) throw new Error(`A numeração aceita até ${MAX_PARTES} partes`);
    const partes: Parte[] = lista.map((x) => {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        switch (o.t) {
            case 'seq': {
                const digitos = Math.round(Number(o.digitos));
                return {
                    t: 'seq',
                    escopo: ESCOPOS.includes(o.escopo as Escopo) ? (o.escopo as Escopo) : 'geral',
                    reinicia: REINICIOS.includes(o.reinicia as Reinicio) ? (o.reinicia as Reinicio) : 'ano',
                    digitos: Number.isFinite(digitos) ? Math.min(10, Math.max(1, digitos)) : 6,
                };
            }
            case 'ano': return { t: 'ano', digitos: Number(o.digitos) === 2 ? 2 : 4 };
            case 'mes': case 'dia': case 'sigla_tipo': case 'sigla_unidade': case 'sigla_orgao':
                return { t: o.t } as Parte;
            case 'texto': {
                const v = typeof o.v === 'string' ? o.v : '';
                if (!TEXTO_OK.test(v)) throw new Error('Texto fixo da numeração: até 10 letras, números, espaço ou . / - _');
                return { t: 'texto', v };
            }
            default: throw new Error('Parte da numeração desconhecida');
        }
    });
    const problemas = problemasNumeracao({ partes });
    if (problemas.length) throw new Error(problemas[0]);
    return { partes };
}

/**
 * O que deixaria números repetidos ou sem sentido. A contagem que reinicia
 * por ano precisa do ano no número; a contada por tipo, da sigla do tipo; e
 * assim por diante. Vazia = pode salvar.
 */
export function problemasNumeracao(n: Numeracao): string[] {
    const tem = (t: Parte['t']) => n.partes.some((p) => p.t === t);
    const seqs = n.partes.filter((p) => p.t === 'seq') as Extract<Parte, { t: 'seq' }>[];
    if (seqs.length !== 1) return ['A numeração precisa de exatamente um número sequencial'];
    const s = seqs[0];
    const out: string[] = [];
    if (s.reinicia !== 'nunca' && !tem('ano')) out.push('A contagem recomeça a cada ano: inclua o ano no número');
    if (s.reinicia === 'mes' && !tem('mes')) out.push('A contagem recomeça a cada mês: inclua o mês no número');
    if (s.escopo === 'tipo' && !tem('sigla_tipo')) out.push('A contagem é por tipo de processo: inclua a sigla do tipo');
    if (s.escopo === 'unidade' && !tem('sigla_unidade')) out.push('A contagem é por unidade: inclua a sigla da unidade');
    if (s.escopo === 'orgao' && !tem('sigla_orgao')) out.push('A contagem é por órgão interno: inclua a sigla do órgão');
    if (maiorTamanho(n) > MAX_NUMERO) out.push(`O número pode passar de ${MAX_NUMERO} caracteres: use menos texto fixo ou menos siglas`);
    return out;
}

/** Numeração do órgão gravada, ou a de sempre. */
export function numeracaoDe(v: unknown): Numeracao {
    try { return v ? sanitizeNumeracao(v) : NUMERACAO_PADRAO; } catch { return NUMERACAO_PADRAO; }
}

/** Numeração gravada no tipo; tipos antigos usam a do órgão. */
export function numeracaoTipoDe(v: unknown): NumeracaoTipo {
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    if (o.modo === 'nenhuma') return { modo: 'nenhuma' };
    if (o.modo === 'propria') {
        try { return { modo: 'propria', partes: sanitizeNumeracao(o).partes }; } catch { return { modo: 'orgao' }; }
    }
    return { modo: 'orgao' };
}

/** Saneia a numeração do tipo. Lança Error com mensagem para o usuário. */
export function sanitizeNumeracaoTipo(v: unknown): NumeracaoTipo {
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    if (o.modo === 'nenhuma') return { modo: 'nenhuma' };
    if (o.modo === 'propria') return { modo: 'propria', partes: sanitizeNumeracao(o).partes };
    return { modo: 'orgao' };
}

interface Nomeado { id: string; sigla?: string; nome?: string }
export interface ContextoNumero {
    /** AAAA-MM-DD no fuso de Brasília. */
    hoje: string;
    tipo?: Nomeado | null;
    unidade: Nomeado;
    orgao?: Nomeado | null;
}

/** Sigla, ou as iniciais do nome quando não há sigla. */
export function siglaDe(x: Nomeado | null | undefined): string {
    if (!x) return '';
    const s = String(x.sigla || '').trim();
    if (s) return s.toUpperCase();
    return String(x.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .split(/\s+/).filter((w) => w.length > 2).map((w) => w[0]).join('').toUpperCase().slice(0, 6);
}

/**
 * Documento do contador (secContadores). A contagem do órgão todo por ano
 * mantém a chave antiga ({org}_{ano}), então quem não mexe na numeração
 * continua de onde estava.
 */
export function chaveContador(orgId: string, n: Numeracao, ctx: ContextoNumero): string {
    const s = n.partes.find((p) => p.t === 'seq') as Extract<Parte, { t: 'seq' }>;
    const [ano, mes] = ctx.hoje.split('-');
    const periodo = s.reinicia === 'ano' ? ano : s.reinicia === 'mes' ? `${ano}-${mes}` : 'sempre';
    if (s.escopo === 'geral' && s.reinicia === 'ano') return `${orgId}_${ano}`;
    // Contagem por sigla: tipos (ou unidades, ou órgãos) com a mesma sigla
    // contam juntos, porque o número impresso é o mesmo.
    const porSigla = (x: Nomeado | null | undefined, vazio: string) => siglaDe(x).replace(/[^A-Z0-9]/g, '') || x?.id || vazio;
    const alvo = s.escopo === 'tipo' ? porSigla(ctx.tipo, 'sem-tipo')
        : s.escopo === 'unidade' ? porSigla(ctx.unidade, 'sem-unidade')
            : s.escopo === 'orgao' ? porSigla(ctx.orgao, 'sem-orgao') : 'geral';
    return `${orgId}_${s.escopo}_${alvo}_${periodo}`;
}

/** O número montado. */
export function formatarNumero(n: Numeracao, ctx: ContextoNumero, seq: number): string {
    const [ano, mes, dia] = ctx.hoje.split('-');
    return n.partes.map((p) => {
        switch (p.t) {
            case 'seq': return String(seq).padStart(p.digitos, '0');
            case 'ano': return p.digitos === 2 ? ano.slice(2) : ano;
            case 'mes': return mes;
            case 'dia': return dia;
            case 'texto': return p.v;
            case 'sigla_tipo': return siglaDe(ctx.tipo);
            case 'sigla_unidade': return siglaDe(ctx.unidade);
            case 'sigla_orgao': return siglaDe(ctx.orgao);
            default: return '';
        }
    }).join('').trim().slice(0, MAX_NUMERO);
}

/** Processo sem número: um identificador que não se confunde com os números. */
export const identificadorSemNumero = (id: string) => `SN-${id.slice(0, 8).toUpperCase()}`;

/** Número como parte de nome de arquivo. */
export const numeroArquivo = (numero: unknown) => String(numero).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'processo';
