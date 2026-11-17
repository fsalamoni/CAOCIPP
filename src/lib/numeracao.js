// ============================================================================
// Numeração única, lado da tela: rótulos das partes, prévia e o que impede de
// salvar. Quem decide é o servidor (functions-v2/src/shared/numeracao.ts);
// isto só monta a prévia. Testado em src/lib/numeracao.test.js.
// ============================================================================

export const PARTES_NUMERO = [
    ['seq', 'Número sequencial'],
    ['ano', 'Ano'],
    ['mes', 'Mês'],
    ['dia', 'Dia'],
    ['sigla_tipo', 'Sigla do tipo'],
    ['sigla_unidade', 'Sigla da unidade'],
    ['sigla_orgao', 'Sigla do órgão interno'],
    ['cod_tipo', 'Código do tipo'],
    ['cod_unidade', 'Código da unidade'],
    ['cod_orgao', 'Código do órgão interno'],
    ['texto', 'Texto fixo'],
];

/** Partes de código numérico e a seção de onde vem o código. */
export const COD_PARTES = { cod_tipo: 'tipo', cod_unidade: 'unidade', cod_orgao: 'orgao' };
export const MAX_COD_DIGITOS = 6;
const ehCod = (t) => t in COD_PARTES;

/** Código numérico gravado (inteiro de 0 a 999999), ou null. */
export function codigoDe(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : /^\d{1,6}$/.test(String(v).trim()) ? Number(String(v).trim()) : NaN;
    return Number.isInteger(n) && n >= 0 && n < 10 ** MAX_COD_DIGITOS ? n : null;
}

/** Códigos repetidos numa seção: Map código → nomes (só os que se repetem). */
export function codigosRepetidos(itens) {
    const por = new Map();
    for (const i of itens) {
        const c = codigoDe(i.codigo);
        if (c !== null) por.set(c, [...(por.get(c) || []), i.nome || '']);
    }
    return new Map([...por].filter(([, l]) => l.length > 1));
}

/** Nomes do que o número precisa e ainda não tem código (ou passa dos dígitos). Mesmo critério do servidor. */
export function codigosFaltando(n, ctx) {
    const out = [];
    for (const p of n?.partes || []) {
        if (!ehCod(p.t)) continue;
        const item = ctx[COD_PARTES[p.t]];
        const c = codigoDe(item?.codigo);
        if (c === null || String(c).length > (Number(p.digitos) || 1)) out.push(item?.nome || (p.t === 'cod_orgao' ? 'órgão interno' : p.t === 'cod_tipo' ? 'tipo' : 'unidade'));
    }
    return out;
}

/**
 * Dígitos que cada seção usa no número, somando a numeração do órgão e as
 * próprias dos tipos: { tipo: 3, unidade: 0, orgao: 3 } (0 = não usa).
 */
export function digitosCodigos(numeracoes) {
    const out = { tipo: 0, unidade: 0, orgao: 0 };
    for (const n of numeracoes) {
        for (const p of n?.partes || []) if (ehCod(p.t)) out[COD_PARTES[p.t]] = Math.max(out[COD_PARTES[p.t]], Number(p.digitos) || 1);
    }
    return out;
}
export const ESCOPOS = [['geral', 'No órgão todo'], ['tipo', 'Por tipo de processo'], ['unidade', 'Por unidade que autua'], ['orgao', 'Por órgão interno']];
export const REINICIOS = [['ano', 'Recomeça a cada ano'], ['mes', 'Recomeça a cada mês'], ['nunca', 'Nunca recomeça']];

export const NUMERACAO_PADRAO = {
    partes: [{ t: 'seq', escopo: 'geral', reinicia: 'ano', digitos: 6 }, { t: 'texto', v: '/' }, { t: 'ano', digitos: 4 }],
};

/** Parte nova, com valores de partida. */
export function novaParte(t) {
    if (t === 'seq') return { t, escopo: 'geral', reinicia: 'ano', digitos: 6 };
    if (t === 'ano') return { t, digitos: 4 };
    if (t === 'texto') return { t, v: '/' };
    if (ehCod(t)) return { t, digitos: 3 };
    return { t };
}

const TEXTO_OK = /^[A-Za-z0-9 ./\-_ºª°]{1,10}$/;
const MAIOR = { ano: 4, mes: 2, dia: 2, sigla_tipo: 12, sigla_unidade: 20, sigla_orgao: 20 };
const maiorTamanho = (partes) => partes.reduce((s, p) => s + (p.t === 'seq' ? Number(p.digitos) + 2 : p.t === 'texto' ? String(p.v || '').length : ehCod(p.t) ? Number(p.digitos) || 1 : MAIOR[p.t] || 0), 0);

/** O que impede de salvar (vazia = pode). Mesmas regras do servidor. */
export function problemasNumeracao(n) {
    const partes = n?.partes || [];
    const tem = (t) => partes.some((p) => p.t === t);
    const seqs = partes.filter((p) => p.t === 'seq');
    if (seqs.length !== 1) return ['A numeração precisa de exatamente um número sequencial'];
    const s = seqs[0];
    const out = [];
    if (partes.some((p) => p.t === 'texto' && !TEXTO_OK.test(p.v || ''))) out.push('Texto fixo: até 10 letras, números, espaço ou . / - _');
    if (s.reinicia !== 'nunca' && !tem('ano')) out.push('A contagem recomeça a cada ano: inclua o ano no número');
    if (s.reinicia === 'mes' && !tem('mes')) out.push('A contagem recomeça a cada mês: inclua o mês no número');
    if (s.escopo === 'tipo' && !tem('sigla_tipo') && !tem('cod_tipo')) out.push('A contagem é por tipo de processo: inclua a sigla ou o código do tipo');
    if (s.escopo === 'unidade' && !tem('sigla_unidade') && !tem('cod_unidade')) out.push('A contagem é por unidade: inclua a sigla ou o código da unidade');
    if (s.escopo === 'orgao' && !tem('sigla_orgao') && !tem('cod_orgao')) out.push('A contagem é por órgão interno: inclua a sigla ou o código do órgão');
    if (maiorTamanho(partes) > 60) out.push('O número pode passar de 60 caracteres: use menos texto fixo ou menos siglas');
    return out;
}

/** Sigla, ou as iniciais do nome quando não há sigla. */
export function siglaDe(x) {
    if (!x) return '';
    const s = String(x.sigla || '').trim();
    if (s) return s.toUpperCase();
    return String(x.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .split(/\s+/).filter((w) => w.length > 2).map((w) => w[0]).join('').toUpperCase().slice(0, 6);
}

/** Número montado, para a prévia. `ctx` = { hoje: 'AAAA-MM-DD', tipo, unidade, orgao }. */
export function formatarNumero(n, ctx, seq) {
    const [ano, mes, dia] = ctx.hoje.split('-');
    return (n?.partes || []).map((p) => {
        switch (p.t) {
            case 'seq': return String(seq).padStart(Number(p.digitos) || 1, '0');
            case 'ano': return Number(p.digitos) === 2 ? ano.slice(2) : ano;
            case 'mes': return mes;
            case 'dia': return dia;
            case 'texto': return p.v || '';
            case 'sigla_tipo': return siglaDe(ctx.tipo);
            case 'sigla_unidade': return siglaDe(ctx.unidade);
            case 'sigla_orgao': return siglaDe(ctx.orgao);
            case 'cod_tipo': case 'cod_unidade': case 'cod_orgao': {
                // Sem código cadastrado, a prévia mostra o lugar dele (a autuação é recusada).
                const c = codigoDe(ctx[COD_PARTES[p.t]]?.codigo);
                return c === null ? '?'.repeat(Number(p.digitos) || 1) : String(c).padStart(Number(p.digitos) || 1, '0');
            }
            default: return '';
        }
    }).join('').trim().slice(0, 60);
}

/** Frase da contagem, para quem lê a configuração. */
export function resumoContagem(n) {
    const s = (n?.partes || []).find((p) => p.t === 'seq');
    if (!s) return '';
    const e = ESCOPOS.find(([id]) => id === s.escopo)?.[1].toLowerCase();
    const r = REINICIOS.find(([id]) => id === s.reinicia)?.[1].toLowerCase();
    return `Contagem ${e}, ${r}.`;
}
