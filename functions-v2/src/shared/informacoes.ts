// ============================================================================
// Informações do andamento: os dados que as ações da fase pediram (texto,
// número, data, escolha) e que ficam nas informações do processo, para quem
// o rito disse. Derivadas dos movimentos (a fonte é a cadeia de eventos, não
// uma cópia no processo). Lógica pura, testada em test/exigencias.test.js.
// ============================================================================

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
    /** nos autos (certidão), evento do extrato ou só no sistema */
    destino: 'autos' | 'evento' | 'informacao';
    visivel_partes: boolean;
}

interface Mov { seq: number; tipo: string; autor_nome?: string; em?: string; dados?: Record<string, unknown> }

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
            destino: d.nos_autos === true ? 'autos' : d.fora_impressao === true ? 'informacao' : 'evento',
            visivel_partes: d.visivel_partes === true,
        };
        pilha.push(info);
        ordem.push(info);
    }
    return soPartes ? ordem.filter((i) => i.visivel_partes) : ordem;
}
