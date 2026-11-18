// ============================================================================
// Cronograma de obrigações: parcelas e obrigações com vencimento (e valor, se
// houver), registradas de uma vez e acompanhadas uma a uma. Cada obrigação é
// um prazo do processo com `obrigacao: true`: entra no alerta de vencimento,
// aparece para as partes no portal (que respondem a ela com o comprovante) e
// se encerra como cumprida, no prazo ou fora dele, ou cancelada.
//
// No rito: a ação `pede: 'cronograma'` se cumpre registrando o cronograma, e a
// ação `pede: 'quitacao'` se cumpre sozinha quando todas as obrigações do
// processo estão cumpridas.
//
// Lógica pura, testada em test/cronograma.test.js. O cliente tem o espelho em
// src/lib/cronograma.js.
// ============================================================================

import { Prazo, texto } from './secretaria';

export const MAX_OBRIGACOES = 120;
export const MAX_VALOR = 1e12;

export interface ItemObrigacao { descricao: string; vence_em: string; valor?: number }

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (s: string) => DATA.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
const brData = (s: string) => s.split('-').reverse().join('/');
export const reais = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Confere as obrigações informadas (descrição, vencimento e valor opcional) e as devolve em ordem de vencimento. Lança Error. */
export function sanitizeObrigacoes(bruto: unknown): ItemObrigacao[] {
    const lista = Array.isArray(bruto) ? bruto : [];
    if (!lista.length) throw new Error('Informe ao menos uma obrigação no cronograma');
    if (lista.length > MAX_OBRIGACOES) throw new Error(`O cronograma aceita até ${MAX_OBRIGACOES} obrigações de cada vez`);
    const itens = lista.map((x, i) => {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        const descricao = texto(o.descricao, 200);
        const vence = String(o.vence_em || '');
        if (!descricao) throw new Error(`Descreva a obrigação ${i + 1}`);
        if (!dataValida(vence)) throw new Error(`Informe o vencimento de "${descricao}"`);
        const temValor = o.valor !== undefined && o.valor !== null && o.valor !== '';
        const valor = temValor ? Math.round(Number(o.valor) * 100) / 100 : 0;
        if (temValor && (!Number.isFinite(valor) || valor <= 0 || valor > MAX_VALOR)) throw new Error(`O valor de "${descricao}" é inválido`);
        return { descricao, vence_em: vence, ...(temValor ? { valor } : {}) };
    });
    // Ordenação estável: parcelas de mesmo dia ficam na ordem informada.
    return itens.map((x, i) => ({ x, i })).sort((a, b) => a.x.vence_em.localeCompare(b.x.vence_em) || a.i - b.i).map(({ x }) => x);
}

const soma = (l: Array<Record<string, unknown>>) => Math.round(l.reduce((s, x) => s + (typeof x.valor === 'number' ? x.valor : 0), 0) * 100) / 100;

/** "12 obrigações, de 10/12/2026 a 10/11/2027, no total de R$ 120.000,00". */
export function resumoDoCronograma(itens: ItemObrigacao[]): string {
    const total = soma(itens as unknown as Array<Record<string, unknown>>);
    const periodo = itens.length === 1 ? `com vencimento em ${brData(itens[0].vence_em)}` : `de ${brData(itens[0].vence_em)} a ${brData(itens[itens.length - 1].vence_em)}`;
    return `${plural(itens.length, 'obrigação', 'obrigações')}, ${periodo}${total ? `, no total de ${reais(total)}` : ''}`;
}

const dias = (de: string, ate: string) => Math.max(1, Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86400000));

/** As obrigações como prazos do processo (dias corridos, da data do registro ao vencimento). */
export function prazosDoCronograma(itens: ItemObrigacao[], o: { hoje: string; agora: string; quem: string; destinatario?: string; novoId: () => string; cronograma_de?: string }): Prazo[] {
    return itens.map((x) => ({
        id: o.novoId(), descricao: x.descricao, destinatario: o.destinatario || '', dias: dias(o.hoje, x.vence_em), contagem: 'corridos',
        inicio: o.hoje, vence_em: x.vence_em, status: 'aberto' as const, aberto_em: o.agora, aberto_por: o.quem, obrigacao: true,
        ...(x.valor ? { valor: x.valor } : {}),
        // De qual ação o cronograma nasceu ("fase:índice"), para desfazer. Não usa fase_id/acao_idx: a obrigação
        // sobrevive à saída da fase e ao cumprimento da ação, ao contrário do prazo próprio da ação.
        ...(o.cronograma_de ? { cronograma_de: o.cronograma_de } : {}),
    }));
}

export const ehObrigacao = (p: Prazo) => p.obrigacao === true;

/**
 * Os prazos que pedem atenção agora: todos os comuns e, do cronograma, as
 * obrigações vencidas ou que vencem em 30 dias (sem nenhuma, só a próxima).
 * Um cronograma de 60 parcelas não vira 60 itens na lista "para você".
 */
export function prazosEmFoco<T extends { vence_em: string; obrigacao?: unknown }>(prazos: T[], hoje: string): T[] {
    const limite = new Date(Date.parse(`${hoje}T12:00:00Z`) + 30 * 86400000).toISOString().slice(0, 10);
    const obrig = prazos.filter((x) => x.obrigacao === true).sort((a, b) => a.vence_em.localeCompare(b.vence_em));
    const perto = obrig.filter((x) => x.vence_em <= limite);
    return [...prazos.filter((x) => x.obrigacao !== true), ...(perto.length ? perto : obrig.slice(0, 1))];
}

/** Como anda o cronograma do processo: contagens, valores, próxima a vencer e atrasadas. */
export function situacaoDasObrigacoes(prazos: Prazo[] | undefined, hoje: string) {
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

/** Todas as obrigações cumpridas: há ao menos uma cumprida e nenhuma em aberto (as canceladas não contam). */
export const quitado = (prazos: Prazo[] | undefined): boolean => {
    const l = (prazos || []).filter(ehObrigacao);
    return l.some((x) => x.status === 'cumprido') && !l.some((x) => x.status === 'aberto');
};

/** "12 de 12 obrigações cumpridas (R$ 120.000,00)". */
export function textoDaQuitacao(prazos: Prazo[] | undefined, hoje: string): string {
    const s = situacaoDasObrigacoes(prazos, hoje);
    return `${s.cumpridas} de ${plural(s.total, 'obrigação cumprida', 'obrigações cumpridas')}${s.valor_cumprido ? ` (${reais(s.valor_cumprido)})` : ''}`;
}
