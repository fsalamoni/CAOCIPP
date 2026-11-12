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
    ['texto', 'Texto fixo'],
];
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
    return { t };
}

const TEXTO_OK = /^[A-Za-z0-9 ./\-_ºª°]{1,10}$/;
const MAIOR = { ano: 4, mes: 2, dia: 2, sigla_tipo: 12, sigla_unidade: 20, sigla_orgao: 20 };
const maiorTamanho = (partes) => partes.reduce((s, p) => s + (p.t === 'seq' ? Number(p.digitos) + 2 : p.t === 'texto' ? String(p.v || '').length : MAIOR[p.t] || 0), 0);

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
    if (s.escopo === 'tipo' && !tem('sigla_tipo')) out.push('A contagem é por tipo de processo: inclua a sigla do tipo');
    if (s.escopo === 'unidade' && !tem('sigla_unidade')) out.push('A contagem é por unidade: inclua a sigla da unidade');
    if (s.escopo === 'orgao' && !tem('sigla_orgao')) out.push('A contagem é por órgão interno: inclua a sigla do órgão');
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
