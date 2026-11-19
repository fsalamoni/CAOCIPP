// Cronograma de obrigações (espelho de functions-v2/src/shared/cronograma.ts):
// parcelas e obrigações com vencimento e valor opcional, registradas de uma
// vez como prazos do processo (`obrigacao: true`). Aqui ficam o gerador de
// parcelas da tela, a conferência antes de enviar e o resumo do andamento.

export const MAX_OBRIGACOES = 120;

export const INTERVALOS = [
    ['mensal', 'Mensal', 1], ['bimestral', 'Bimestral', 2], ['trimestral', 'Trimestral', 3],
    ['semestral', 'Semestral', 6], ['anual', 'Anual', 12],
];

export const reais = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const brData = (s) => String(s || '').slice(0, 10).split('-').reverse().join('/');
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Soma `meses` a uma data, sem pular de mês: 31/01 + 1 mês = 28/02 (ou 29). */
export function somarMeses(iso, meses) {
    const [a, m, d] = iso.split('-').map(Number);
    const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
    const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
    alvo.setUTCDate(Math.min(d, ultimo));
    return alvo.toISOString().slice(0, 10);
}

/** "8,5" ou "1.234,56" vira número; vazio vira undefined. */
export function valorDe(txt) {
    const s = String(txt ?? '').trim();
    if (!s) return undefined;
    const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/**
 * Parcelas iguais: `quantidade` a partir de `primeira`, a cada `intervalo`.
 * Com `total`, o valor é dividido e a diferença de centavos vai na última.
 */
export function gerarParcelas({ descricao, quantidade, primeira, intervalo = 'mensal', valor, total }) {
    const n = Math.min(MAX_OBRIGACOES, Math.max(0, Math.floor(Number(quantidade) || 0)));
    if (!n || !DATA.test(primeira || '')) return [];
    const passo = INTERVALOS.find(([k]) => k === intervalo)?.[2] || 1;
    const nome = String(descricao || '').trim() || 'Parcela';
    const cada = total > 0 ? Math.floor((total * 100) / n) / 100 : valor;
    return Array.from({ length: n }, (_, i) => ({
        descricao: n === 1 ? nome : `${nome} ${i + 1} de ${n}`,
        vence_em: somarMeses(primeira, i * passo),
        ...(cada > 0 ? { valor: total > 0 && i === n - 1 ? Math.round((total - cada * (n - 1)) * 100) / 100 : cada } : {}),
    }));
}

/** O que impede o envio (o servidor confere de novo). */
export function problemasDoCronograma(itens) {
    if (!itens.length) return ['Inclua ao menos uma obrigação.'];
    if (itens.length > MAX_OBRIGACOES) return [`O cronograma aceita até ${MAX_OBRIGACOES} obrigações de cada vez.`];
    const out = [];
    itens.forEach((x, i) => {
        if (!String(x.descricao || '').trim()) out.push(`Descreva a obrigação ${i + 1}.`);
        else if (!DATA.test(x.vence_em || '')) out.push(`Informe o vencimento de "${x.descricao}".`);
        else if (x.valor !== undefined && !(x.valor > 0)) out.push(`O valor de "${x.descricao}" é inválido.`);
    });
    return out.slice(0, 3);
}

const soma = (l) => Math.round(l.reduce((s, x) => s + (typeof x.valor === 'number' ? x.valor : 0), 0) * 100) / 100;
export const totalDe = soma;
export const ehObrigacao = (p) => p?.obrigacao === true;

/** Como anda o cronograma do processo (igual ao servidor). */
export function situacaoDasObrigacoes(prazos, hoje) {
    const l = (prazos || []).filter(ehObrigacao);
    const abertas = l.filter((x) => x.status === 'aberto').sort((a, b) => a.vence_em.localeCompare(b.vence_em));
    const cumpridas = l.filter((x) => x.status === 'cumprido');
    return {
        total: l.filter((x) => x.status !== 'cancelado').length, cumpridas: cumpridas.length, abertas: abertas.length,
        atrasadas: abertas.filter((x) => x.vence_em < hoje).length, canceladas: l.filter((x) => x.status === 'cancelado').length,
        proxima: abertas[0] ? { descricao: abertas[0].descricao, vence_em: abertas[0].vence_em } : null,
        valor_total: soma(l.filter((x) => x.status !== 'cancelado')), valor_cumprido: soma(cumpridas),
    };
}

/** Frase curta do andamento: "3 de 12 cumpridas (R$ 30.000,00 de R$ 120.000,00); 1 atrasada; próxima em 10/03/2027". */
export function fraseDoCronograma(s) {
    if (!s?.total) return '';
    const valor = s.valor_total ? ` (${reais(s.valor_cumprido)} de ${reais(s.valor_total)})` : '';
    return `${s.cumpridas} de ${s.total} ${s.total === 1 ? 'obrigação cumprida' : 'obrigações cumpridas'}${valor}`
        + `${s.atrasadas ? `; ${s.atrasadas} ${s.atrasadas === 1 ? 'atrasada' : 'atrasadas'}` : ''}`
        + `${s.proxima ? `; próxima em ${brData(s.proxima.vence_em)}` : ''}`;
}
