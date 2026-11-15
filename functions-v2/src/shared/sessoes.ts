import { CalendarioOrgao, Contagem, calcularVencimento, texto } from './secretaria';
import { acaoAtiva, respostasDaFase } from './exigencias';
import { composicaoEm } from './orgaos';
import type { MembroColegiado } from './orgaos';
import type { Voto } from './julgamento';

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
    /**
     * pautado; retirado (com motivo); vista (julgamento suspenso por pedido de
     * vista); adiado (para a sessão seguinte); diligencia (convertido em
     * diligência). Julgado se lê do processo.
     */
    situacao: 'pautado' | 'retirado' | 'vista' | 'adiado' | 'diligencia';
    /** Pedido de vista: quem pediu e até quando. */
    vista?: { nomes: string[]; prazo: string; devolvida?: boolean };
    incluido_em: string;
    /** Relator designado pela secretaria entre quem vota no dia (S4). */
    relator_uid?: string;
    relator_nome?: string;
}

/**
 * Regras de pauta do colegiado. `antecedencia`: mínima entre publicar a pauta e
 * a sessão (sem regra, 0). `vista_dias`: prazo do pedido de vista, na mesma
 * contagem (sem regra, VISTA_PADRAO, como no CPC, art. 940).
 */
export interface RegrasSessao { antecedencia: number; contagem: Contagem; vista_dias?: number }
export const VISTA_PADRAO = 10;
export const MAX_VISTA = 90;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function sanitizeRegrasSessao(raw: unknown): RegrasSessao {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const n = Math.round(Number(r.antecedencia));
    const v = Math.round(Number(r.vista_dias));
    return {
        antecedencia: Number.isFinite(n) ? Math.max(0, Math.min(MAX_ANTECEDENCIA, n)) : 0, contagem: r.contagem === 'corridos' ? 'corridos' : 'uteis',
        // Ausente = o padrão; só se guarda o que difere dele.
        ...(Number.isFinite(v) && v >= 1 && v <= MAX_VISTA && v !== VISTA_PADRAO ? { vista_dias: v } : {}),
    };
}

/** Último dia para devolver a vista pedida em `hoje`. */
export function prazoDaVista(hoje: string, regras: RegrasSessao, cal?: CalendarioOrgao): string {
    return calcularVencimento(hoje, regras.vista_dias || VISTA_PADRAO, regras.contagem, cal);
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
    proc: { sessao?: { orgao_id?: unknown } | null; ultima_sessao?: { orgao_id?: unknown } | null; vista?: { orgao_id?: unknown } | null; unidade_atual?: unknown; status?: unknown },
    compoe: string[], orgaoDaUnidade: (u: string) => unknown,
): boolean {
    if (!compoe.length || proc.status === 'excluido') return false;
    if (proc.sessao && compoe.includes(String(proc.sessao.orgao_id))) return true;
    // Com vista (S5): o julgamento está suspenso, mas o colegiado segue lendo.
    if (proc.vista && proc.status === 'em_tramitacao' && compoe.includes(String(proc.vista.orgao_id))) return true;
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

const lista = (nomes: string[]) => (nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0] || '');

/** Certidão do pedido de vista (S5). */
export function textoDaVista(s: Pick<DadosSessao, 'titulo' | 'data'>, nomes: string[], prazo: string): string {
    return `Pedido de vista por ${lista(nomes)} na ${s.titulo}, de ${br(s.data)}. Julgamento suspenso; os autos devem ser devolvidos até ${br(prazo)}.`;
}

/** Certidão da devolução da vista; `incluido`: a sessão em que o processo entrou, se já há. */
export function textoDaDevolucao(nomes: string[], incluido?: Pick<DadosSessao, 'titulo' | 'data'> | null): string {
    return `Devolvidos os autos do pedido de vista de ${lista(nomes)}. ${incluido ? `O julgamento continua na ${incluido.titulo}, de ${br(incluido.data)}.` : 'O julgamento continua na próxima sessão do colegiado.'}`;
}

/** Certidão do adiamento. */
export function textoDoAdiamento(s: Pick<DadosSessao, 'titulo' | 'data'>, motivo: string): string {
    return `Adiado o julgamento na ${s.titulo}, de ${br(s.data)}, para a sessão seguinte. Motivo: ${motivo}.`;
}

/** Certidão da conversão em diligência. */
export function textoDaDiligencia(s: Pick<DadosSessao, 'titulo' | 'data'>, oQue: string): string {
    return `O colegiado converteu o julgamento em diligência na ${s.titulo}, de ${br(s.data)}: ${oQue.replace(/[.\s]+$/, '')}.`;
}

/** Reordena a pauta com a lista de ids (os que faltam ficam no fim, na ordem atual). */
export function reordenar(pauta: ItemPauta[], ids: string[]): ItemPauta[] {
    const pos = (id: string) => { const i = ids.indexOf(id); return i < 0 ? ids.length : i; };
    return [...pauta].sort((a, b) => pos(a.processo_id) - pos(b.processo_id) || a.ordem - b.ordem).map((x, i) => ({ ...x, ordem: i + 1 }));
}

// ---- Votação na sessão (S4): relator, vogais, proclamação ----

/** Como o vogal vota: acompanha o relator (com ou sem ressalva), diverge, ou se declara impedido ou suspeito. */
export const MODOS_VOTO = ['acompanha', 'ressalva', 'diverge', 'impedido', 'suspeito'] as const;
export type ModoVoto = typeof MODOS_VOTO[number];
export const MAX_RELATORIO = 50000;
export const MAX_NOTA_VOTO = 4000;

export interface VotoDoMembro { nome: string; funcao: 'presidente' | 'membro'; modo: ModoVoto; resultado: string; nota: string; em: string }
export interface Proclamacao { resultado: string; texto: string; data: string; em: string; por_nome: string; votos: Voto[] }
/** secSessoes/{sessao}/votacoes/{processo}: o voto do relator (sigiloso até liberar) e os votos dos pares. */
export interface Votacao {
    processo_id: string;
    relator_uid: string;
    relator_nome: string;
    relatorio: string;
    resultado: string;
    fundamentos: string;
    liberado_em: string | null;
    votos: Record<string, VotoDoMembro>;
    proclamado: Proclamacao | null;
}
export interface Votante { uid: string; nome: string; funcao: 'presidente' | 'membro' }

/**
 * Quem vota no dia: o presidente e os titulares. O suplente fica de fora
 * (vota quando convocado no lugar de um titular, numa etapa seguinte).
 */
export function votantes(composicao: MembroColegiado[], dia: string, nome: (uid: string) => string): Votante[] {
    return composicaoEm(composicao, dia).filter((m) => m.funcao !== 'suplente')
        .map((m) => ({ uid: m.uid, nome: nome(m.uid) || `Membro ${m.uid.slice(0, 6)}`, funcao: m.funcao === 'presidente' ? 'presidente' as const : 'membro' as const }));
}

/** Confere o voto do vogal contra os resultados do rito e o voto do relator. Lança com mensagem. */
export function sanitizeVoto(raw: unknown, resultados: string[], doRelator: string): Pick<VotoDoMembro, 'modo' | 'resultado' | 'nota'> {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const modo = String(r.modo || '') as ModoVoto;
    if (!MODOS_VOTO.includes(modo)) throw new Error('Escolha como vota');
    const nota = texto(r.nota, MAX_NOTA_VOTO);
    if (modo === 'impedido' || modo === 'suspeito') return { modo, resultado: '', nota };
    if (modo === 'diverge') {
        const resultado = texto(r.resultado, 80);
        if (!resultados.includes(resultado)) throw new Error('Na divergência, escolha o resultado do seu voto');
        if (resultado === doRelator) throw new Error(`O relator votou por ${doRelator}: para esse resultado, acompanhe o relator`);
        return { modo, resultado, nota };
    }
    if (modo === 'ressalva' && nota.length < 5) throw new Error('Escreva a ressalva (ao menos 5 letras)');
    return { modo, resultado: doRelator, nota: modo === 'ressalva' ? nota : '' };
}

/**
 * Votos no formato do registro do julgamento (shared/julgamento.ts): o relator
 * primeiro, depois quem vota no dia; quem não votou fica ausente.
 */
export function votosDaSessao(v: Pick<Votacao, 'relator_uid' | 'relator_nome' | 'resultado' | 'votos'>, membros: Votante[]): Voto[] {
    const out: Voto[] = [{ nome: v.relator_nome, funcao: 'relator', voto: v.resultado }];
    for (const m of membros) {
        if (m.uid === v.relator_uid) continue;
        const x = v.votos[m.uid];
        out.push({ nome: x?.nome || m.nome, funcao: m.funcao, voto: !x ? 'ausente' : x.modo === 'impedido' || x.modo === 'suspeito' ? x.modo : x.resultado });
    }
    return out;
}

/** Placar dos votos já dados (sem quórum nem desempate): para acompanhar ao vivo. */
export function placarParcial(resultados: string[], votos: Voto[]): Array<[string, number]> {
    return resultados.map((o) => [o, votos.filter((v) => v.voto === o).length] as [string, number]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
}
