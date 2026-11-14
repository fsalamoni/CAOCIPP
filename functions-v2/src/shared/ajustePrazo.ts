/**
 * Prorrogação e devolução de prazo. Lógica pura.
 *
 * - Prorrogar: o prazo ainda corre; soma dias ao vencimento.
 * - Devolver (restituir): o prazo já venceu; corre de novo, a contar de hoje.
 *
 * O prazo guarda a história em `ajustes`. Se é o prazo de resposta de uma
 * comunicação, a comunicação acompanha o novo vencimento; na devolução, o
 * decurso já certificado deixa de valer e a espera do rito reabre.
 */
import { CalendarioOrgao, Contagem, MAX_PRAZO_DIAS, Prazo, calcularVencimento } from './secretaria';
import type { ComunicacaoLigada } from './comunicacaoRito';

export const MAX_AJUSTES = 10;
export type TipoAjuste = 'prorrogacao' | 'devolucao';
export interface AjustePrazo { tipo: TipoAjuste; dias: number; de: string; para: string; motivo: string; em: string; por: string }

const br = (d: string) => d.split('-').reverse().join('/');

/** Novo estado do prazo e o texto da certidão. Lança com mensagem. */
export function ajustarPrazo(
    prazo: Prazo, tipo: TipoAjuste, diasBruto: unknown, motivo: string, hoje: string, cal: CalendarioOrgao | undefined, quem: { em: string; por: string },
): { prazo: Prazo; texto: string } {
    const dias = Number(diasBruto);
    if (!Number.isInteger(dias) || dias < 1 || dias > MAX_PRAZO_DIAS) throw new Error('Informe os dias');
    if (!motivo) throw new Error('Diga o motivo');
    if (prazo.status !== 'aberto') throw new Error('Só prazo aberto pode ser prorrogado ou devolvido');
    const ajustes = (Array.isArray(prazo.ajustes) ? prazo.ajustes : []) as AjustePrazo[];
    if (ajustes.length >= MAX_AJUSTES) throw new Error(`Este prazo já teve ${MAX_AJUSTES} ajustes. Abra um prazo novo.`);
    const vencido = hoje > prazo.vence_em;
    if (tipo === 'prorrogacao' && vencido) throw new Error('O prazo já venceu: use a devolução');
    if (tipo === 'devolucao' && !vencido) throw new Error('O prazo ainda corre: use a prorrogação');
    const contagem: Contagem = prazo.contagem === 'corridos' ? 'corridos' : 'uteis';
    const para = calcularVencimento(tipo === 'prorrogacao' ? prazo.vence_em : hoje, dias, contagem, cal);
    const de = prazo.vence_em;
    const unidade = `${dias} dia${dias === 1 ? '' : 's'} ${contagem === 'uteis' ? (dias === 1 ? 'útil' : 'úteis') : (dias === 1 ? 'corrido' : 'corridos')}`;
    const quemPrazo = `${prazo.descricao}${prazo.destinatario ? ` (${prazo.destinatario})` : ''}`;
    const texto = tipo === 'prorrogacao'
        ? `Prazo prorrogado por ${unidade}: ${quemPrazo}. Vencia em ${br(de)}; passa a vencer em ${br(para)}. Motivo: ${motivo}`
        : `Prazo devolvido: ${quemPrazo}, vencido em ${br(de)}. Corre de novo por ${unidade}, a contar de hoje, e vence em ${br(para)}. Motivo: ${motivo}`;
    return { prazo: { ...prazo, vence_em: para, ajustes: [...ajustes, { tipo, dias, de, para, motivo, ...quem }] }, texto };
}

type FaseMin = { id: string; acoes_regras?: Array<{ pede?: string; resposta?: { de?: number } } | null | undefined> };

/**
 * A comunicação cujo prazo mudou acompanha o novo vencimento. Na devolução,
 * se a resposta ainda não veio, o decurso deixa de valer e, sendo da fase que
 * espera, a ação de resposta que o rito já dera por cumprida volta a esperar.
 */
export function ajustarComunicacao(
    proc: { comunicacoes?: unknown; acoes_feitas?: unknown; acoes_respostas?: unknown }, prazoId: string, venceEm: string, tipo: TipoAjuste, fase: FaseMin | undefined,
): { comunicacoes: ComunicacaoLigada[]; acoes_feitas?: Record<string, number[]>; acoes_respostas?: Record<string, Record<string, string>>; reabertas: number[] } | null {
    const lista = (proc.comunicacoes || []) as ComunicacaoLigada[];
    const alvo = lista.find((c) => c.prazo_id === prazoId);
    if (!alvo) return null;
    const devolve = tipo === 'devolucao' && !alvo.respondida_em;
    const comunicacoes = lista.map((c) => {
        if (c !== alvo) return c;
        const { decurso_certificado: _d, ...resto } = c as ComunicacaoLigada & { decurso_certificado?: unknown };
        return { ...(devolve ? resto : c), vence_em: venceEm };
    });
    if (!devolve || !fase || alvo.fase_id !== fase.id || alvo.rodada_fim === true || typeof alvo.acao_idx !== 'number') return { comunicacoes, reabertas: [] };
    const todasFeitas = (proc.acoes_feitas || {}) as Record<string, number[]>;
    const feitas = todasFeitas[fase.id] || [];
    const reabertas = (fase.acoes_regras || []).map((r, i) => (r?.pede === 'resposta' && r.resposta?.de === alvo.acao_idx && feitas.includes(i) ? i : -1)).filter((i) => i >= 0);
    if (!reabertas.length) return { comunicacoes, reabertas };
    const todasResp = (proc.acoes_respostas || {}) as Record<string, Record<string, string>>;
    const resp = { ...(todasResp[fase.id] || {}) };
    for (const i of reabertas) delete resp[String(i)];
    return {
        comunicacoes, reabertas,
        acoes_feitas: { ...todasFeitas, [fase.id]: feitas.filter((i) => !reabertas.includes(i)) },
        acoes_respostas: { ...todasResp, [fase.id]: resp },
    };
}
