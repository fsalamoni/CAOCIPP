import { CalendarioOrgao, Contagem, calcularVencimento, texto } from './secretaria';
import { acaoAtiva, respostasDaFase } from './exigencias';

/**
 * Sessões de julgamento de um colegiado: dados da sessão, pauta e
 * antecedência mínima. Regras puras, sem banco (a gravação está em
 * secretaria/sessoes.ts). A sessão é do órgão interno que decide em
 * colegiado; a pauta lista processos que têm o julgamento pendente na fase.
 */

export const MODOS_SESSAO = ['presencial', 'virtual', 'hibrida'] as const;
export type ModoSessao = typeof MODOS_SESSAO[number];
export const CARATER_SESSAO = ['ordinaria', 'extraordinaria'] as const;
export type CaraterSessao = typeof CARATER_SESSAO[number];
/** rascunho: só a secretaria vê; publicada: pauta pública; encerrada; cancelada. */
export type SituacaoSessao = 'rascunho' | 'publicada' | 'encerrada' | 'cancelada';
/** Como o item entrou: na pauta publicada, depois dela (extrapauta) ou em mesa (urgente, sem pauta). */
export const INCLUSOES = ['pauta', 'extrapauta', 'mesa'] as const;
export type Inclusao = typeof INCLUSOES[number];

export const MAX_PAUTA = 100;
export const MAX_ANTECEDENCIA = 60;

export interface DadosSessao {
    titulo: string;
    carater: CaraterSessao;
    modo: ModoSessao;
    data: string;
    hora: string;
    local: string;
    link: string;
    observacoes: string;
}

export interface ItemPauta {
    processo_id: string;
    numero: string;
    assunto: string;
    ordem: number;
    inclusao: Inclusao;
    motivo: string;
    /** pautado; retirado (com motivo). Julgado e adiado chegam com a sessão aberta. */
    situacao: 'pautado' | 'retirado';
    incluido_em: string;
}

/** Antecedência mínima entre publicar a pauta e a sessão, do colegiado. Sem regra, 0 (como hoje). */
export interface RegrasSessao { antecedencia: number; contagem: Contagem }

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function sanitizeRegrasSessao(raw: unknown): RegrasSessao {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const n = Math.round(Number(r.antecedencia));
    return { antecedencia: Number.isFinite(n) ? Math.max(0, Math.min(MAX_ANTECEDENCIA, n)) : 0, contagem: r.contagem === 'corridos' ? 'corridos' : 'uteis' };
}

/** Dados da sessão conferidos; lança com a explicação. */
export function sanitizeDadosSessao(raw: unknown): DadosSessao {
    const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const d: DadosSessao = {
        titulo: texto(s.titulo, 120),
        carater: s.carater === 'extraordinaria' ? 'extraordinaria' : 'ordinaria',
        modo: MODOS_SESSAO.includes(s.modo as ModoSessao) ? (s.modo as ModoSessao) : 'presencial',
        data: typeof s.data === 'string' && DATA.test(s.data) && !Number.isNaN(Date.parse(`${s.data}T00:00:00Z`)) ? s.data : '',
        hora: typeof s.hora === 'string' && HORA.test(s.hora) ? s.hora : '',
        local: texto(s.local, 200),
        link: texto(s.link, 500),
        observacoes: texto(s.observacoes, 2000),
    };
    if (!d.data) throw new Error('Informe a data da sessão');
    if (!d.hora) throw new Error('Informe a hora da sessão (HH:MM)');
    if (d.modo !== 'virtual' && !d.local) throw new Error('Informe o local da sessão');
    if (d.modo !== 'presencial' && !d.link) throw new Error('Informe o link ou a sala virtual da sessão');
    if (d.modo === 'virtual') d.local = '';
    if (d.modo === 'presencial') d.link = '';
    if (!d.titulo) d.titulo = `Sessão ${d.carater === 'ordinaria' ? 'ordinária' : 'extraordinária'} de ${br(d.data)}`;
    return d;
}

export const br = (d: string) => d.split('-').reverse().join('/');

/** Primeira data em que a sessão pode acontecer se a pauta sair em `hoje`. */
export function dataMinimaDaSessao(hoje: string, regras: RegrasSessao, cal?: CalendarioOrgao): string {
    return regras.antecedencia > 0 ? calcularVencimento(hoje, regras.antecedencia, regras.contagem, cal) : hoje;
}

/** Explica por que a pauta não pode sair agora para a sessão de `data` (ou '' se pode). */
export function problemaDaAntecedencia(hoje: string, data: string, regras: RegrasSessao, cal?: CalendarioOrgao): string {
    if (data < hoje) return 'A data da sessão já passou';
    const minima = dataMinimaDaSessao(hoje, regras, cal);
    if (data >= minima) return '';
    return `O colegiado pede ${regras.antecedencia} ${regras.contagem === 'uteis' ? 'dias úteis' : 'dias'} entre a publicação da pauta e a sessão: publicada hoje, a sessão pode ser a partir de ${br(minima)}. `
        + 'Mude a data ou inclua o processo como extrapauta ou em mesa, com o motivo.';
}

type ProcParaPauta = { fase_atual?: unknown; fases?: unknown; acoes_feitas?: unknown; acoes_respostas?: unknown; status?: unknown };

/**
 * Índice da ação de julgamento colegiado pendente na fase atual (-1 quando não
 * há): é o que torna o processo apto para a pauta.
 */
export function julgamentoPendente(proc: ProcParaPauta): number {
    if (proc.status !== 'em_tramitacao') return -1;
    const fase = ((proc.fases || []) as Array<{ id: string; acoes_regras?: Array<{ pede?: string } | null> }>).find((f) => f.id === proc.fase_atual);
    if (!fase) return -1;
    const feitas = ((proc.acoes_feitas || {}) as Record<string, number[]>)[String(proc.fase_atual)] || [];
    const resp = respostasDaFase(proc as never);
    return (fase.acoes_regras || []).findIndex((r, i) => r?.pede === 'julgamento' && !feitas.includes(i) && acaoAtiva(fase as never, i, resp));
}

/**
 * Leitura do julgador (decisão do Flavio, 15/11/2026): quem compõe o
 * colegiado lê os autos enquanto o processo está pautado numa sessão dele e,
 * julgado, enquanto o processo segue em unidade do colegiado (o acórdão é
 * feito ali). Saiu do colegiado, a leitura acaba.
 */
export function leituraDeJulgador(
    proc: { sessao?: { orgao_id?: unknown } | null; ultima_sessao?: { orgao_id?: unknown } | null; unidade_atual?: unknown; status?: unknown },
    compoe: string[], orgaoDaUnidade: (u: string) => unknown,
): boolean {
    if (!compoe.length || proc.status === 'excluido') return false;
    if (proc.sessao && compoe.includes(String(proc.sessao.orgao_id))) return true;
    const ult = proc.ultima_sessao ? String(proc.ultima_sessao.orgao_id) : '';
    return !!ult && proc.status === 'em_tramitacao' && compoe.includes(ult) && orgaoDaUnidade(String(proc.unidade_atual || '')) === ult;
}

/** Onde e como, no mesmo jeito das audiências: "em Sala 2", "por videoconferência (link)", "em Sala 2 e por videoconferência (link)". */
export function ondeSessao(s: Pick<DadosSessao, 'modo' | 'local' | 'link'>): string {
    if (s.modo === 'virtual') return `por videoconferência (${s.link})`;
    if (s.modo === 'hibrida') return `em ${s.local} e por videoconferência (${s.link})`;
    return `em ${s.local}`;
}

/** Texto da certidão de inclusão em pauta, nos autos e visto pelas partes. */
export function textoDaInclusao(s: DadosSessao, colegiado: string, item: Pick<ItemPauta, 'inclusao' | 'motivo'>): string {
    const como = item.inclusao === 'extrapauta' ? 'Incluído em extrapauta' : item.inclusao === 'mesa' ? 'Apresentado em mesa' : 'Incluído em pauta';
    const motivo = item.inclusao !== 'pauta' && item.motivo ? ` Motivo: ${item.motivo}.` : '';
    return `${como} para julgamento na ${s.titulo}${colegiado ? ` do ${colegiado}` : ''}, em ${br(s.data)}, às ${s.hora}, ${ondeSessao(s)}.${motivo}`;
}

/** Texto da certidão de retirada (ou de cancelamento da sessão). */
export function textoDaRetirada(s: DadosSessao, motivo: string, cancelada = false): string {
    return `${cancelada ? `A ${s.titulo}, de ${br(s.data)}, foi cancelada, e o processo saiu da pauta` : `Retirado da pauta da ${s.titulo}, de ${br(s.data)}`}. Motivo: ${motivo}.`;
}

/** Reordena a pauta com a lista de ids (os que faltam ficam no fim, na ordem atual). */
export function reordenar(pauta: ItemPauta[], ids: string[]): ItemPauta[] {
    const pos = (id: string) => { const i = ids.indexOf(id); return i < 0 ? ids.length : i; };
    return [...pauta].sort((a, b) => pos(a.processo_id) - pos(b.processo_id) || a.ordem - b.ordem).map((x, i) => ({ ...x, ordem: i + 1 }));
}
