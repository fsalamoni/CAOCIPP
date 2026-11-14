/**
 * Comunicação e resposta conduzidas pelo rito (processos com partes):
 *
 * - ação `pede: 'comunicacao'`: o rito diz a espécie, a quem (polos), o prazo e
 *   o texto. Cumpre-se expedindo, pela própria ação, a todas as partes que ela
 *   alcança na rodada da fase.
 * - ação `pede: 'resposta'`: espera a manifestação das partes comunicadas por
 *   uma ação anterior. Cumpre-se sozinha quando cada uma se manifestou no prazo
 *   ou o prazo dela decorreu sem manifestação; a resposta ("Apresentada",
 *   "Parcial", "Sem manifestação") vale nas condições e nos desvios do rito.
 *
 * Lógica pura; o servidor grava e registra. Ver docs/PROCESSO_ELETRONICO.md.
 */
import { especieValida } from './comunicacoes';
import type { Comunicacao } from './comunicacoes';
import { POLOS } from './camposProcesso';
import { MAX_PRAZO_DIAS, texto } from './secretaria';

export const RESPOSTAS = ['Apresentada', 'Parcial', 'Sem manifestação'] as const;
export type ValorResposta = typeof RESPOSTAS[number];
export const MAX_TEXTO_COMUNICACAO = 2000;

export interface ComunicacaoDaAcao {
    especie: string;
    /** Espécie da lista do órgão: o nome e o gênero ficam no rito. */
    especie_nome?: string;
    especie_m?: true;
    /** Polos alcançados. Ausente = todas as partes do processo. */
    polos?: string[];
    /** Prazo de resposta em dias, contado da ciência; 0 = sem prazo. */
    dias: number;
    contagem?: 'corridos';
    /** Texto proposto ao expedir (quem expede ajusta). */
    texto?: string;
}

export interface RespostaDaAcao {
    /** A ação de comunicação (anterior, na mesma fase) cuja resposta se espera. */
    de: number;
}

type ParteMin = { nome?: string; polo?: string; retirada?: unknown };
type RegraMin = { pede?: string; comunicacao?: ComunicacaoDaAcao; resposta?: RespostaDaAcao } | null | undefined;
type FaseMin = { id: string; acoes?: string[]; acoes_regras?: RegraMin[] };
export type ComunicacaoLigada = Comunicacao & { fase_id?: string; acao_idx?: number; rodada_fim?: boolean; respondida_em?: string; resposta_ordem?: number };

/** Valida o que o rito pede ao comunicar. Lança com mensagem. */
export function sanitizeComunicacaoDaAcao(raw: unknown, acao: string): ComunicacaoDaAcao {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const esp = especieValida(r.especie, r.especie_nome, r.especie_m, `A ação "${acao}" comunica as partes: escolha a espécie (intimação, notificação, citação...)`);
    const polos = [...new Set((Array.isArray(r.polos) ? r.polos : []).map(String))];
    if (polos.some((p) => !(POLOS as readonly string[]).includes(p))) throw new Error(`A ação "${acao}": polo desconhecido`);
    const dias = r.dias === undefined || r.dias === null || r.dias === '' ? 0 : Number(r.dias);
    if (!Number.isInteger(dias) || dias < 0 || dias > MAX_PRAZO_DIAS) throw new Error(`A ação "${acao}": o prazo de resposta vai de 0 (sem prazo) a ${MAX_PRAZO_DIAS} dias`);
    const txt = texto(r.texto, MAX_TEXTO_COMUNICACAO);
    return {
        ...esp, dias,
        ...(polos.length && polos.length < POLOS.length ? { polos } : {}),
        ...(dias && r.contagem === 'corridos' ? { contagem: 'corridos' as const } : {}),
        ...(txt ? { texto: txt } : {}),
    };
}

/** Valida a espera: aponta para uma comunicação anterior da fase que abre prazo. */
export function sanitizeRespostaDaAcao(raw: unknown, regras: RegraMin[], acoes: string[], i: number, mapa?: Map<number, number>): RespostaDaAcao {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const bruto = Number(r.de);
    const de = mapa ? mapa.get(bruto) : bruto;
    const alvo = de === undefined ? undefined : regras[de];
    if (de === undefined || !Number.isInteger(de) || de < 0 || de >= i || alvo?.pede !== 'comunicacao' || !alvo.comunicacao?.dias) {
        throw new Error(`A ação "${acoes[i]}" espera a resposta das partes: escolha uma ação anterior da fase que comunica com prazo de resposta`);
    }
    return { de };
}

/** Partes (índices) que a comunicação da ação alcança: as do polo pedido, sem as retiradas. */
export function alvosDaComunicacao(cfg: ComunicacaoDaAcao | undefined, partes: ParteMin[] | undefined): number[] {
    if (!cfg) return [];
    return (partes || []).map((p, i) => ({ p, i }))
        .filter(({ p }) => p && !p.retirada && (!cfg.polos || cfg.polos.includes(String(p.polo))))
        .map(({ i }) => i);
}

/** Comunicações expedidas pela ação na rodada atual da fase (sem as tornadas sem efeito). */
export function comunicacoesDaAcao(lista: ComunicacaoLigada[] | undefined, faseId: string, idx: number): ComunicacaoLigada[] {
    return (lista || []).filter((c) => c.fase_id === faseId && c.acao_idx === idx && c.rodada_fim !== true && c.status !== 'sem_efeito');
}

/** A ação de comunicação alcançou todas as partes que devia? (sem ninguém a comunicar, não se cumpre sozinha) */
export function comunicacaoCumprida(f: FaseMin, idx: number, partes: ParteMin[] | undefined, lista: ComunicacaoLigada[] | undefined): boolean {
    const alvos = alvosDaComunicacao(f.acoes_regras?.[idx]?.comunicacao, partes);
    const feitas = new Set(comunicacoesDaAcao(lista, f.id, idx).map((c) => c.parte_idx));
    return alvos.length > 0 && alvos.every((i) => feitas.has(i));
}

/** Prazo da resposta já decorreu? (vence no dia; decorre no seguinte) */
const decorreu = (c: ComunicacaoLigada, hoje: string) => !!c.vence_em && hoje > c.vence_em;

/**
 * Como está a espera: quem respondeu, quem deixou decorrer e quem ainda pode
 * responder. `valor` só existe quando ninguém mais pode responder.
 */
export function situacaoDaResposta(f: FaseMin, idx: number, lista: ComunicacaoLigada[] | undefined, hoje: string) {
    const de = f.acoes_regras?.[idx]?.resposta?.de;
    const coms = typeof de === 'number' ? comunicacoesDaAcao(lista, f.id, de) : [];
    const apresentadas = coms.filter((c) => !!c.respondida_em);
    const decursos = coms.filter((c) => !c.respondida_em && decorreu(c, hoje));
    const pendentes = coms.filter((c) => !c.respondida_em && !decorreu(c, hoje));
    const valor: ValorResposta | null = !coms.length || pendentes.length ? null
        : !decursos.length ? 'Apresentada' : !apresentadas.length ? 'Sem manifestação' : 'Parcial';
    return { comunicacoes: coms, apresentadas, decursos, pendentes, valor };
}

/**
 * Comunicações que a manifestação da parte `parteIdx` responde agora: as da
 * fase atual, ligadas a uma ação que alguém espera, ainda não respondidas e
 * com o prazo em curso (ou ainda por abrir). A que chega depois do prazo não
 * conta: a parte perdeu a oportunidade, e o decurso é certificado.
 */
export function respondidasPela(f: FaseMin | undefined, parteIdx: number, lista: ComunicacaoLigada[] | undefined, hoje: string): string[] {
    if (!f || parteIdx < 0) return [];
    const esperadas = new Set((f.acoes_regras || []).map((r) => (r?.pede === 'resposta' ? r.resposta?.de : undefined)).filter((x): x is number => typeof x === 'number'));
    return (lista || []).filter((c) => c.fase_id === f.id && typeof c.acao_idx === 'number' && esperadas.has(c.acao_idx) && c.rodada_fim !== true
        && c.status !== 'sem_efeito' && c.parte_idx === parteIdx && !c.respondida_em && !decorreu(c, hoje)).map((c) => c.id);
}

/**
 * Acerta as ações de comunicação e de resposta da fase atual com o que
 * aconteceu: comunicação que alcançou todos fica cumprida (e deixa de ficar
 * se uma foi tornada sem efeito); espera que ninguém mais pode responder fica
 * cumprida com a resposta. Devolve só o que mudou, ou null.
 */
export function sincronizarComunicacoes(
    proc: { fase_atual?: unknown; partes?: unknown; comunicacoes?: unknown; acoes_feitas?: unknown; acoes_respostas?: unknown },
    f: FaseMin | undefined, hoje: string,
): { acoes_feitas: Record<string, number[]>; acoes_respostas: Record<string, Record<string, string>>; notas: string[]; novas: number[] } | null {
    if (!f) return null;
    const regras = f.acoes_regras || [];
    if (!regras.some((r) => r?.pede === 'comunicacao' || r?.pede === 'resposta')) return null;
    const lista = (proc.comunicacoes || []) as ComunicacaoLigada[];
    const partes = (proc.partes || []) as ParteMin[];
    const todasFeitas = { ...((proc.acoes_feitas || {}) as Record<string, number[]>) };
    const todasResp = { ...((proc.acoes_respostas || {}) as Record<string, Record<string, string>>) };
    const feitas = new Set(todasFeitas[f.id] || []);
    const resp = { ...(todasResp[f.id] || {}) };
    const notas: string[] = [];
    const novas: number[] = [];
    let mudou = false;
    regras.forEach((r, i) => {
        const acao = f.acoes?.[i] || `ação ${i + 1}`;
        if (r?.pede === 'comunicacao') {
            const ok = comunicacaoCumprida(f, i, partes, lista);
            if (ok && !feitas.has(i)) { feitas.add(i); novas.push(i); mudou = true; notas.push(`Ação "${acao}" cumprida: a comunicação alcançou todas as partes previstas.`); }
            if (!ok && feitas.has(i)) { feitas.delete(i); mudou = true; notas.push(`Ação "${acao}" voltou a ficar por cumprir: falta comunicar parte prevista.`); }
        }
        if (r?.pede === 'resposta' && !feitas.has(i)) {
            const s = situacaoDaResposta(f, i, lista, hoje);
            if (s.valor) {
                feitas.add(i); resp[String(i)] = s.valor; mudou = true; novas.push(i);
                notas.push(`Ação "${acao}" cumprida pela regra do rito: ${s.valor.toLowerCase()}.`);
            }
        }
    });
    if (!mudou) return null;
    todasFeitas[f.id] = [...feitas].sort((a, b) => a - b);
    todasResp[f.id] = resp;
    return { acoes_feitas: todasFeitas, acoes_respostas: todasResp, notas, novas };
}

/**
 * Fase cujas comunicações o processo espera: a atual ou, durante a fase de
 * espera, a de origem (que é retomada como estava).
 */
export function faseQueEspera<F extends { id: string }>(proc: { fase_atual?: unknown; espera?: unknown; fases?: unknown }): F | undefined {
    const fases = (Array.isArray(proc.fases) ? proc.fases : []) as F[];
    const origem = (proc.espera as { fase?: unknown } | null | undefined)?.fase;
    return fases.find((f) => f.id === (typeof origem === 'string' && origem ? origem : proc.fase_atual));
}

/** Alguma ação de resposta da fase ainda espera parte comunicada? (marca o processo para a rotina diária) */
export function aguardaResposta(proc: { acoes_feitas?: unknown; comunicacoes?: unknown }, f: FaseMin | undefined): boolean {
    if (!f) return false;
    const feitas = new Set(((proc.acoes_feitas || {}) as Record<string, number[]>)[f.id] || []);
    const lista = (proc.comunicacoes || []) as ComunicacaoLigada[];
    return (f.acoes_regras || []).some((r, i) => r?.pede === 'resposta' && !feitas.has(i) && typeof r.resposta?.de === 'number'
        && comunicacoesDaAcao(lista, f.id, r.resposta.de).some((c) => !c.respondida_em));
}

/** Saída da fase: as comunicações dela deixam de contar para a próxima rodada. */
export function encerrarComunicacoesDaFase(lista: ComunicacaoLigada[] | undefined, faseId: string | null): ComunicacaoLigada[] | null {
    if (!faseId || !(lista || []).some((c) => c.fase_id === faseId && c.rodada_fim !== true)) return null;
    return (lista || []).map((c) => (c.fase_id === faseId && c.rodada_fim !== true ? { ...c, rodada_fim: true } : c));
}

/** Decursos a certificar: comunicações esperadas pela fase atual cujo prazo decorreu sem manifestação e ainda sem certidão. */
export function decursosACertificar(f: FaseMin | undefined, lista: ComunicacaoLigada[] | undefined, hoje: string): ComunicacaoLigada[] {
    if (!f) return [];
    const esperadas = new Set((f.acoes_regras || []).map((r) => (r?.pede === 'resposta' ? r.resposta?.de : undefined)).filter((x): x is number => typeof x === 'number'));
    return (lista || []).filter((c) => c.fase_id === f.id && typeof c.acao_idx === 'number' && esperadas.has(c.acao_idx) && c.rodada_fim !== true
        && c.status !== 'sem_efeito' && !c.respondida_em && decorreu(c, hoje) && !(c as { decurso_certificado?: unknown }).decurso_certificado);
}
