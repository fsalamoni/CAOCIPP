/**
 * Comunicações processuais (intimação, notificação, citação, ciência,
 * comunicação): a secretaria expede, o destinatário dá ciência (ou ela se dá
 * por decurso) e o prazo de resposta abre a partir da ciência. Lógica pura.
 */
import { CalendarioOrgao, Contagem, MAX_PRAZO_DIAS, Prazo, calcularVencimento, somarDias, texto } from './secretaria';

export const ESPECIES: Record<string, string> = {
    intimacao: 'Intimação',
    notificacao: 'Notificação',
    citacao: 'Citação',
    ciencia: 'Ciência',
    comunicacao: 'Comunicação',
};
/** Dias corridos, da expedição, até a ciência se dar por decurso. 0 desliga. */
export const CIENCIA_DIAS_PADRAO = 10;
export const MAX_CIENCIA_DIAS = 90;
export const MAX_COMUNICACOES = 200;

export interface Comunicacao {
    id: string;
    especie: string;
    texto: string;
    parte_idx: number;
    parte_nome: string;
    documento_id?: string;
    documento_titulo?: string;
    /** Prazo de resposta em dias; 0 = sem prazo. */
    dias: number;
    contagem: Contagem;
    expedida_em: string;
    expedida_por: string;
    unidade_id: string;
    /** AAAA-MM-DD: passado esse dia sem ciência, ela se dá por decurso. */
    limite_ciencia: string | null;
    status: 'aguardando' | 'ciente' | 'decurso' | 'sem_efeito';
    ciencia_em?: string;
    ciencia_por?: string;
    ciencia_meio?: string;
    prazo_id?: string;
    vence_em?: string;
    sem_efeito_motivo?: string;
}

export const cienciaDias = (v: unknown): number => {
    const n = Number(v);
    return v === undefined || v === null || !Number.isInteger(n) || n < 0 ? CIENCIA_DIAS_PADRAO : Math.min(n, MAX_CIENCIA_DIAS);
};

export interface PedidoComunicacao {
    especie: string;
    texto: string;
    partes_idx: number[];
    documento_id: string;
    dias: number;
    contagem: Contagem;
    /** Outro meio (e-mail, correio, pessoalmente): a ciência já aconteceu. */
    outro_meio: string;
    ciencia_data: string;
}

/** Valida o que a secretaria informou ao expedir. `hoje`: AAAA-MM-DD. */
export function sanitizePedido(raw: unknown, hoje: string): PedidoComunicacao {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const especie = String(r.especie || '');
    if (!ESPECIES[especie]) throw new Error('Escolha a espécie da comunicação');
    const txt = texto(r.texto, 4000);
    if (!txt) throw new Error('Escreva o que está sendo comunicado');
    const partes_idx = [...new Set((Array.isArray(r.partes_idx) ? r.partes_idx : []).filter((n): n is number => Number.isInteger(n) && n >= 0))];
    if (!partes_idx.length) throw new Error('Escolha ao menos um destinatário');
    // O prazo precisa ser dito: dias, ou "sem prazo" de forma explícita.
    const semPrazo = r.sem_prazo === true;
    const dias = semPrazo ? 0 : Number(r.dias);
    if (!semPrazo && (!Number.isInteger(dias) || dias < 1 || dias > MAX_PRAZO_DIAS)) throw new Error('Informe o prazo em dias ou marque que a comunicação não abre prazo');
    const outro_meio = r.meio === 'outro' ? texto(r.outro_meio, 120) : '';
    const ciencia_data = String(r.ciencia_data || '');
    if (r.meio === 'outro') {
        if (!outro_meio) throw new Error('Informe por qual meio a comunicação foi feita');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ciencia_data) || ciencia_data > hoje) throw new Error('Informe a data em que a parte tomou ciência (até hoje)');
    }
    return {
        especie, texto: txt, partes_idx, documento_id: typeof r.documento_id === 'string' ? r.documento_id : '',
        dias, contagem: r.contagem === 'corridos' ? 'corridos' : 'uteis', outro_meio, ciencia_data: outro_meio ? ciencia_data : '',
    };
}

export const textoPrazo = (c: Pick<Comunicacao, 'dias' | 'contagem'>) =>
    (c.dias ? `${c.dias} dia${c.dias > 1 ? 's' : ''} ${c.contagem === 'uteis' ? (c.dias > 1 ? 'úteis' : 'útil') : (c.dias > 1 ? 'corridos' : 'corrido')}` : '');

export const limiteCiencia = (hoje: string, dias: number): string | null => (dias > 0 ? somarDias(hoje, dias) : null);

/**
 * Registra a ciência: muda a comunicação e, havendo prazo, abre-o contando do
 * dia da ciência (o primeiro dia contado é o seguinte, CPC art. 224).
 */
export function aplicarCiencia(
    c: Comunicacao, dataCiencia: string, quando: string, por: string, meio: string, prazoId: string, cal?: CalendarioOrgao,
): { comunicacao: Comunicacao; prazo: Prazo | null } {
    if (c.status !== 'aguardando') throw new Error('Esta comunicação não está mais aguardando ciência');
    const prazo: Prazo | null = c.dias ? {
        id: prazoId, descricao: `Responder à ${ESPECIES[c.especie].toLowerCase()}`, destinatario: c.parte_nome, dias: c.dias, contagem: c.contagem,
        inicio: dataCiencia, vence_em: calcularVencimento(dataCiencia, c.dias, c.contagem, cal), status: 'aberto',
        aberto_em: quando, aberto_por: por, comunicacao_id: c.id,
    } : null;
    return {
        comunicacao: {
            ...c, status: meio === 'decurso' ? 'decurso' : 'ciente', ciencia_em: quando, ciencia_por: por, ciencia_meio: meio,
            ...(prazo ? { prazo_id: prazo.id, vence_em: prazo.vence_em } : {}),
        },
        prazo,
    };
}

/** Campos do processo que as listas e a rotina diária consultam. */
export function derivadosComunicacoes(lista: Comunicacao[]) {
    const aguardando = lista.filter((c) => c.status === 'aguardando');
    return {
        comunicacoes_aguardando: aguardando.length,
        ciencia_limite: aguardando.map((c) => c.limite_ciencia).filter((x): x is string => !!x).sort()[0] || null,
    };
}

/** A comunicação é dirigida a esta conta? (a parte ou um representante dela) */
export function destinatario(c: Comunicacao, partes: Array<{ uid?: string; representantes?: Array<{ uid?: string }> }>, uid: string): boolean {
    const p = partes[c.parte_idx];
    return !!p && (p.uid === uid || (p.representantes || []).some((r) => r.uid === uid));
}
