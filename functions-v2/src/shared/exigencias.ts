// ============================================================================
// O que o rito diz sobre registro nos autos e documentos exigidos, por fase e
// por ação. Lógica pura, testada em test/exigencias.test.js; o cliente tem o
// espelho em src/lib/exigencias.js (só para a tela; quem decide é o servidor).
// Fundamento: docs/LOGICA_PROCESSUAL.md, seções 5 e 6.
// ============================================================================

// Sem importar ./secretaria (que importa este módulo): o mesmo corte de texto.
const MAX_TEXTO_CURTO = 200;
const texto = (v: unknown, max = MAX_TEXTO_CURTO) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Registro dos atos da fase nos autos:
 * - ausente: tudo nos autos (termo com folha), como sempre foi;
 * - 'remessas_fora': a entrada e a saída da fase vão aos autos, mas as
 *   remessas entre unidades durante a fase ficam só no registro interno;
 * - 'interno': entrar, trabalhar e sair da fase fica só no registro interno.
 */
export const REGISTROS = ['remessas_fora', 'interno'] as const;
export type Registro = typeof REGISTROS[number];

export const FORMAS = ['redigir', 'juntar', 'qualquer'] as const;
export type Forma = typeof FORMAS[number];

export interface Exigencia {
    descricao: string;
    forma: Forma;
    /** Tipo de documento esperado (ex.: "Despacho"); serve para reconhecer na juntada. */
    tipo?: string;
    /** Modelo indicado (id de secModelos). */
    modelo_id?: string;
}
export interface RegraAcao { autos?: true; documento?: Exigencia }

export const MAX_DOCUMENTOS_FASE = 5;

export interface FaseRegras {
    id: string;
    acoes?: string[];
    registro?: Registro;
    acoes_regras?: Array<RegraAcao | null>;
    documentos?: Exigencia[];
}

export function sanitizeExigencia(raw: unknown, descricaoPadrao = ''): Exigencia | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const descricao = texto(o.descricao, MAX_TEXTO_CURTO) || descricaoPadrao;
    if (!descricao) return null;
    const forma = FORMAS.includes(o.forma as Forma) ? (o.forma as Forma) : 'qualquer';
    const tipo = texto(o.tipo, 60);
    const modelo = texto(o.modelo_id, 40);
    return { descricao, forma, ...(tipo ? { tipo } : {}), ...(modelo ? { modelo_id: modelo } : {}) };
}

/** Saneia registro, regras das ações (alinhadas às ações) e documentos da fase. */
export function sanitizeRegras(fo: Record<string, unknown>, acoes: string[]) {
    const registro = REGISTROS.includes(fo.registro as Registro) ? (fo.registro as Registro) : undefined;
    const brutas = Array.isArray(fo.acoes_regras) ? fo.acoes_regras : [];
    const regras = acoes.map((a, i): RegraAcao | null => {
        const r = (brutas[i] && typeof brutas[i] === 'object' ? brutas[i] : {}) as Record<string, unknown>;
        const documento = sanitizeExigencia(r.documento, a);
        if (documento) documento.descricao = a;
        const regra: RegraAcao = { ...(r.autos === true ? { autos: true as const } : {}), ...(documento ? { documento } : {}) };
        return Object.keys(regra).length ? regra : null;
    });
    const documentos = (Array.isArray(fo.documentos) ? fo.documentos : [])
        .map((d) => sanitizeExigencia(d)).filter((d): d is Exigencia => !!d).slice(0, MAX_DOCUMENTOS_FASE);
    return {
        ...(registro ? { registro } : {}),
        ...(regras.some(Boolean) ? { acoes_regras: regras } : {}),
        ...(documentos.length ? { documentos } : {}),
    };
}

/** Exigências da fase com a chave que o processo grava: 'd0' (da fase), 'a2' (da ação 2). */
export function exigenciasDaFase(f: FaseRegras | undefined): Array<Exigencia & { chave: string; acao_idx?: number }> {
    if (!f) return [];
    return [
        ...(f.documentos || []).map((d, i) => ({ ...d, chave: `d${i}` })),
        ...(f.acoes_regras || []).flatMap((r, i) => (r?.documento && f.acoes?.[i] ? [{ ...r.documento, chave: `a${i}`, acao_idx: i }] : [])),
    ];
}

export type Cumpridas = Record<string, Record<string, { documento_id: string; ordem: number }>>;

export function pendentesDaFase(f: FaseRegras | undefined, cumpridas: Cumpridas | undefined) {
    const feitas = (f && cumpridas?.[f.id]) || {};
    return exigenciasDaFase(f).filter((e) => !feitas[e.chave]);
}

export interface DocJuntado { origem: string; tipo?: string; modelo_id?: string }

/** Redigir = produzido pelo órgão (editor ou modelo); juntar = arquivo recebido. */
export function atende(e: Exigencia, d: DocJuntado): boolean {
    const redigido = d.origem === 'editor' || !!d.modelo_id;
    if (e.forma === 'redigir' && !redigido) return false;
    if (e.forma === 'juntar' && redigido) return false;
    return true;
}

const igual = (a?: string, b?: string) => !!a && !!b && a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;

/**
 * Exigências pendentes que o documento cumpre. Com `escolhidas` (chaves que
 * quem junta marcou), valida cada uma; sem elas, reconhece pelo modelo usado
 * ou pelo tipo do documento. Lança Error com mensagem para o usuário.
 */
export function reconhecer(pendentes: Array<Exigencia & { chave: string }>, d: DocJuntado, escolhidas?: unknown): string[] {
    if (Array.isArray(escolhidas)) {
        const chaves = [...new Set(escolhidas.map(String))];
        for (const k of chaves) {
            const e = pendentes.find((x) => x.chave === k);
            if (!e) throw new Error('Uma das exigências marcadas não está pendente nesta fase');
            if (!atende(e, d)) throw new Error(`"${e.descricao}" pede documento ${e.forma === 'redigir' ? 'redigido pelo órgão' : 'recebido de fora (arquivo enviado)'}`);
        }
        return chaves;
    }
    return pendentes
        .filter((e) => atende(e, d) && ((e.modelo_id && e.modelo_id === d.modelo_id) || igual(e.tipo, d.tipo)))
        .map((e) => e.chave);
}

/**
 * O ato vai só para o registro interno? Mudança de fase: se a fase de onde
 * sai ou a para onde vai é interna. Remessa sem mudar de fase: se a fase atual
 * é interna ou deixa as remessas fora dos autos.
 */
export function movimentoInterno(fases: FaseRegras[], deId: string, paraId?: string | null): boolean {
    const reg = (id?: string | null) => fases.find((f) => f.id === id)?.registro;
    if (paraId && paraId !== deId) return reg(deId) === 'interno' || reg(paraId) === 'interno';
    return reg(deId) === 'interno' || reg(deId) === 'remessas_fora';
}
