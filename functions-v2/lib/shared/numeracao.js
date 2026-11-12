"use strict";
// ============================================================================
// Numeração única do processo, montada por partes que o admin escolhe:
// número sequencial (contado no órgão todo, por tipo, por unidade ou por
// órgão interno, e reiniciado por ano, por mês ou nunca), ano, mês, dia,
// texto fixo e siglas. O tipo de processo usa a do órgão, a sua própria ou
// fica sem número. Lógica pura, testada em test/numeracao.test.js; o cliente
// tem o espelho em src/lib/numeracao.js (só para a prévia).
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.numeroArquivo = exports.identificadorSemNumero = exports.maiorTamanho = exports.NUMERACAO_PADRAO = exports.MAX_NUMERO = exports.MAX_PARTES = exports.REINICIOS = exports.ESCOPOS = void 0;
exports.sanitizeNumeracao = sanitizeNumeracao;
exports.problemasNumeracao = problemasNumeracao;
exports.numeracaoDe = numeracaoDe;
exports.numeracaoTipoDe = numeracaoTipoDe;
exports.sanitizeNumeracaoTipo = sanitizeNumeracaoTipo;
exports.siglaDe = siglaDe;
exports.chaveContador = chaveContador;
exports.formatarNumero = formatarNumero;
exports.ESCOPOS = ['geral', 'tipo', 'unidade', 'orgao'];
exports.REINICIOS = ['ano', 'mes', 'nunca'];
exports.MAX_PARTES = 12;
exports.MAX_NUMERO = 60;
/** O formato de sempre: 000001/2026, contado no órgão todo e reiniciado a cada ano. */
exports.NUMERACAO_PADRAO = {
    partes: [{ t: 'seq', escopo: 'geral', reinicia: 'ano', digitos: 6 }, { t: 'texto', v: '/' }, { t: 'ano', digitos: 4 }],
};
const TEXTO_OK = /^[A-Za-z0-9 ./\-_ºª°]{1,10}$/;
/** Maior tamanho possível de cada parte (siglas: tipo até 12, unidade e órgão até 20). */
const MAIOR = { ano: 4, mes: 2, dia: 2, sigla_tipo: 12, sigla_unidade: 20, sigla_orgao: 20 };
const maiorTamanho = (n) => n.partes.reduce((s, p) => s + (p.t === 'seq' ? p.digitos + 2 : p.t === 'texto' ? p.v.length : MAIOR[p.t] || 0), 0);
exports.maiorTamanho = maiorTamanho;
/** Saneia a numeração vinda do cliente. Lança Error com mensagem para o usuário. */
function sanitizeNumeracao(input) {
    const src = (input && typeof input === 'object' ? input : {});
    const lista = Array.isArray(src.partes) ? src.partes : [];
    if (!lista.length)
        throw new Error('Monte a numeração com ao menos o número sequencial');
    if (lista.length > exports.MAX_PARTES)
        throw new Error(`A numeração aceita até ${exports.MAX_PARTES} partes`);
    const partes = lista.map((x) => {
        const o = (x && typeof x === 'object' ? x : {});
        switch (o.t) {
            case 'seq': {
                const digitos = Math.round(Number(o.digitos));
                return {
                    t: 'seq',
                    escopo: exports.ESCOPOS.includes(o.escopo) ? o.escopo : 'geral',
                    reinicia: exports.REINICIOS.includes(o.reinicia) ? o.reinicia : 'ano',
                    digitos: Number.isFinite(digitos) ? Math.min(10, Math.max(1, digitos)) : 6,
                };
            }
            case 'ano': return { t: 'ano', digitos: Number(o.digitos) === 2 ? 2 : 4 };
            case 'mes':
            case 'dia':
            case 'sigla_tipo':
            case 'sigla_unidade':
            case 'sigla_orgao':
                return { t: o.t };
            case 'texto': {
                const v = typeof o.v === 'string' ? o.v : '';
                if (!TEXTO_OK.test(v))
                    throw new Error('Texto fixo da numeração: até 10 letras, números, espaço ou . / - _');
                return { t: 'texto', v };
            }
            default: throw new Error('Parte da numeração desconhecida');
        }
    });
    const problemas = problemasNumeracao({ partes });
    if (problemas.length)
        throw new Error(problemas[0]);
    return { partes };
}
/**
 * O que deixaria números repetidos ou sem sentido. A contagem que reinicia
 * por ano precisa do ano no número; a contada por tipo, da sigla do tipo; e
 * assim por diante. Vazia = pode salvar.
 */
function problemasNumeracao(n) {
    const tem = (t) => n.partes.some((p) => p.t === t);
    const seqs = n.partes.filter((p) => p.t === 'seq');
    if (seqs.length !== 1)
        return ['A numeração precisa de exatamente um número sequencial'];
    const s = seqs[0];
    const out = [];
    if (s.reinicia !== 'nunca' && !tem('ano'))
        out.push('A contagem recomeça a cada ano: inclua o ano no número');
    if (s.reinicia === 'mes' && !tem('mes'))
        out.push('A contagem recomeça a cada mês: inclua o mês no número');
    if (s.escopo === 'tipo' && !tem('sigla_tipo'))
        out.push('A contagem é por tipo de processo: inclua a sigla do tipo');
    if (s.escopo === 'unidade' && !tem('sigla_unidade'))
        out.push('A contagem é por unidade: inclua a sigla da unidade');
    if (s.escopo === 'orgao' && !tem('sigla_orgao'))
        out.push('A contagem é por órgão interno: inclua a sigla do órgão');
    if ((0, exports.maiorTamanho)(n) > exports.MAX_NUMERO)
        out.push(`O número pode passar de ${exports.MAX_NUMERO} caracteres: use menos texto fixo ou menos siglas`);
    return out;
}
/** Numeração do órgão gravada, ou a de sempre. */
function numeracaoDe(v) {
    try {
        return v ? sanitizeNumeracao(v) : exports.NUMERACAO_PADRAO;
    }
    catch (_a) {
        return exports.NUMERACAO_PADRAO;
    }
}
/** Numeração gravada no tipo; tipos antigos usam a do órgão. */
function numeracaoTipoDe(v) {
    const o = (v && typeof v === 'object' ? v : {});
    if (o.modo === 'nenhuma')
        return { modo: 'nenhuma' };
    if (o.modo === 'propria') {
        try {
            return { modo: 'propria', partes: sanitizeNumeracao(o).partes };
        }
        catch (_a) {
            return { modo: 'orgao' };
        }
    }
    return { modo: 'orgao' };
}
/** Saneia a numeração do tipo. Lança Error com mensagem para o usuário. */
function sanitizeNumeracaoTipo(v) {
    const o = (v && typeof v === 'object' ? v : {});
    if (o.modo === 'nenhuma')
        return { modo: 'nenhuma' };
    if (o.modo === 'propria')
        return { modo: 'propria', partes: sanitizeNumeracao(o).partes };
    return { modo: 'orgao' };
}
/** Sigla, ou as iniciais do nome quando não há sigla. */
function siglaDe(x) {
    if (!x)
        return '';
    const s = String(x.sigla || '').trim();
    if (s)
        return s.toUpperCase();
    return String(x.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .split(/\s+/).filter((w) => w.length > 2).map((w) => w[0]).join('').toUpperCase().slice(0, 6);
}
/**
 * Documento do contador (secContadores). A contagem do órgão todo por ano
 * mantém a chave antiga ({org}_{ano}), então quem não mexe na numeração
 * continua de onde estava.
 */
function chaveContador(orgId, n, ctx) {
    const s = n.partes.find((p) => p.t === 'seq');
    const [ano, mes] = ctx.hoje.split('-');
    const periodo = s.reinicia === 'ano' ? ano : s.reinicia === 'mes' ? `${ano}-${mes}` : 'sempre';
    if (s.escopo === 'geral' && s.reinicia === 'ano')
        return `${orgId}_${ano}`;
    // Contagem por sigla: tipos (ou unidades, ou órgãos) com a mesma sigla
    // contam juntos, porque o número impresso é o mesmo.
    const porSigla = (x, vazio) => siglaDe(x).replace(/[^A-Z0-9]/g, '') || (x === null || x === void 0 ? void 0 : x.id) || vazio;
    const alvo = s.escopo === 'tipo' ? porSigla(ctx.tipo, 'sem-tipo')
        : s.escopo === 'unidade' ? porSigla(ctx.unidade, 'sem-unidade')
            : s.escopo === 'orgao' ? porSigla(ctx.orgao, 'sem-orgao') : 'geral';
    return `${orgId}_${s.escopo}_${alvo}_${periodo}`;
}
/** O número montado. */
function formatarNumero(n, ctx, seq) {
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
    }).join('').trim().slice(0, exports.MAX_NUMERO);
}
/** Processo sem número: um identificador que não se confunde com os números. */
const identificadorSemNumero = (id) => `SN-${id.slice(0, 8).toUpperCase()}`;
exports.identificadorSemNumero = identificadorSemNumero;
/** Número como parte de nome de arquivo. */
const numeroArquivo = (numero) => String(numero).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'processo';
exports.numeroArquivo = numeroArquivo;
//# sourceMappingURL=numeracao.js.map