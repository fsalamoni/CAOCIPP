// ============================================================================
// Informações do andamento: os dados que as ações da fase pediram (texto,
// número, data, escolha) e que ficam nas informações do processo, para quem
// o rito disse. Derivadas dos movimentos (a fonte é a cadeia de eventos, não
// uma cópia no processo). Lógica pura, testada em test/exigencias.test.js.
// ============================================================================

import type { Ref } from './modulos';

export interface InformacaoAndamento {
    fase_id: string;
    fase_nome: string;
    acao_idx: number;
    rotulo: string;
    tipo: string;
    valor: unknown;
    valor_texto: string;
    por: string;
    em: string;
    seq: number;
    /** nos autos (certidão), evento do extrato, só no sistema ou sem evento */
    destino: 'autos' | 'evento' | 'informacao' | 'nenhum' | 'consolidar';
    visivel_partes: boolean;
    /** Registro de outro módulo (ação que pede registro). */
    ref?: Ref;
    /** Registros escolhidos num formulário da ação. */
    refs?: Ref[];
    /** Dado reservado (só quem gere `ve_unidade`, quem registrou e a administração). */
    reservado?: 'gestor';
    ve_unidade?: string;
    autor_uid?: string;
    /** Reservado e quem lê não pode ver: sem valor. */
    oculta?: true;
}

interface Mov { seq: number; tipo: string; autor_nome?: string; autor_uid?: string; em?: string; dados?: Record<string, unknown> }

/** Quem lê pode ver o dado reservado do movimento? */
export function podeVerReservado(d: { reservado?: unknown; ve_unidade?: unknown } | undefined, autorUid: unknown,
    quem: { uid: string; isAdmin: boolean; gestorDe: string[] }): boolean {
    if (!d?.reservado) return true;
    return quem.isAdmin || (!!autorUid && autorUid === quem.uid) || quem.gestorDe.includes(String(d.ve_unidade || ''));
}

/** Tira o dado do que quem lê não pode ver (o movimento e a informação seguem, sem o valor). */
export function semReservado<T extends { dados?: Record<string, unknown>; autor_uid?: string }>(m: T, quem: Parameters<typeof podeVerReservado>[2]): T {
    if (!m.dados?.reservado || podeVerReservado(m.dados, m.autor_uid, quem)) return m;
    const { valor, valor_texto, ref, ...dados } = m.dados;
    void valor; void valor_texto; void ref;
    return { ...m, dados: { ...dados, oculta: true } };
}
export function informacaoVisivel(i: InformacaoAndamento, quem: Parameters<typeof podeVerReservado>[2]): InformacaoAndamento {
    if (!i.reservado || podeVerReservado(i, i.autor_uid, quem)) return i;
    const { ref, refs, ...resto } = i;
    void ref; void refs;
    return { ...resto, valor: null, valor_texto: '', oculta: true };
}

/**
 * Cada ação cumprida com um dado gera uma informação; desfazer a ação tira a
 * última informação dela. Voltar à fase e cumprir de novo acrescenta outra
 * (a anterior continua: é a história do processo).
 */
export function informacoesDoAndamento(movs: Mov[], fases: Array<{ id: string; nome: string }>, soPartes = false): InformacaoAndamento[] {
    const nomes = new Map(fases.map((f) => [f.id, f.nome]));
    const pilhas = new Map<string, InformacaoAndamento[]>();
    const ordem: InformacaoAndamento[] = [];
    for (const m of [...movs].sort((a, b) => a.seq - b.seq)) {
        if (m.tipo !== 'acao_fase' || !m.dados) continue;
        const d = m.dados;
        const chave = `${d.fase_id}:${d.acao_idx}`;
        const pilha = pilhas.get(chave) || [];
        pilhas.set(chave, pilha);
        if (d.feita === false) {
            const tirada = pilha.pop();
            if (tirada) ordem.splice(ordem.indexOf(tirada), 1);
            continue;
        }
        if (d.valor === undefined || typeof d.rotulo !== 'string') continue;
        const info: InformacaoAndamento = {
            fase_id: String(d.fase_id), fase_nome: nomes.get(String(d.fase_id)) || String(d.fase_id), acao_idx: Number(d.acao_idx),
            rotulo: d.rotulo, tipo: String(d.tipo_valor || 'texto'), valor: d.valor, valor_texto: String(d.valor_texto ?? d.valor),
            por: m.autor_nome || '', em: m.em || '', seq: m.seq,
            destino: ['autos', 'evento', 'informacao', 'nenhum', 'consolidar'].includes(String(d.destino))
                ? d.destino as InformacaoAndamento['destino']
                : d.nos_autos === true ? 'autos' : d.fora_impressao === true ? 'informacao' : 'evento',
            visivel_partes: d.visivel_partes === true,
            ...(d.ref && typeof d.ref === 'object' ? { ref: d.ref as Ref } : {}),
            ...(Array.isArray(d.valor) && d.valor.some((x) => x?.ref) ? { refs: d.valor.map((x) => x?.ref).filter(Boolean) as Ref[] } : {}),
            ...(d.reservado === 'gestor' ? { reservado: 'gestor' as const, ve_unidade: String(d.ve_unidade || ''), autor_uid: m.autor_uid || '' } : {}),
        };
        pilha.push(info);
        ordem.push(info);
    }
    return soPartes ? ordem.filter((i) => i.visivel_partes) : ordem;
}
