import { createHash } from 'crypto';

// ============================================================================
// Secretaria Processual — regras puras (sem Firestore), testadas em
// functions-v2/test/secretaria.test.js.
//
// Vocabulário:
//   - unidade: secretaria (movimenta e cumpre) ou gabinete (decide). Cada
//     unidade tem membros lotados (uids).
//   - posse: o processo está SEMPRE com uma unidade (unidade_atual). Só quem
//     está lotado nela movimenta o processo.
//   - rito: sequência de fases, com versão. O processo guarda a versão do rito
//     com que foi autuado, então editar o rito não muda processos em curso.
//   - movimento: registro imutável do que aconteceu. Cada movimento leva o
//     hash SHA-256 do anterior; alterar um movimento antigo quebra a cadeia.
// ============================================================================

export type TipoUnidade = 'secretaria' | 'gabinete';
export type Sigilo = 'normal' | 'restrito';
export type StatusProcesso = 'em_tramitacao' | 'sobrestado' | 'arquivado';

export interface Fase { id: string; nome: string; prazo_dias?: number }
export interface Rito { nome: string; descricao: string; fases: Fase[] }

export interface ContextoUsuario {
    uid: string;
    /** Criador do órgão ou permissão configure_secretaria. */
    isAdmin: boolean;
    /** Unidades em que o usuário está lotado. */
    unidadeIds: string[];
}

export interface ProcessoAcesso {
    unidade_atual: string;
    unidades_historico?: string[];
    sigilo?: string;
}

export const MAX_TEXTO_CURTO = 200;
export const MAX_TEXTO_LONGO = 4000;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_FASES = 30;

export const TIPOS_ARQUIVO_PERMITIDOS: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'text/plain': 'txt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/msword': 'doc',
    'application/vnd.oasis.opendocument.text': 'odt',
};

export function texto(v: unknown, max = MAX_TEXTO_CURTO): string {
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function slug(v: string): string {
    return v
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'fase';
}

/** Saneia um rito vindo do cliente. Lança Error com mensagem para o usuário. */
export function sanitizeRito(input: unknown): Rito {
    const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const nome = texto(src.nome);
    if (!nome) throw new Error('O rito precisa de um nome');
    const fasesIn = Array.isArray(src.fases) ? src.fases : [];
    if (fasesIn.length === 0) throw new Error('O rito precisa de ao menos uma fase');
    if (fasesIn.length > MAX_FASES) throw new Error(`O rito aceita no máximo ${MAX_FASES} fases`);
    const vistos = new Set<string>();
    const fases: Fase[] = fasesIn.map((f, i) => {
        const fo = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
        const nomeFase = texto(fo.nome);
        if (!nomeFase) throw new Error(`A fase ${i + 1} está sem nome`);
        let id = texto(fo.id, 40) || slug(nomeFase);
        while (vistos.has(id)) id = `${id}_${i}`;
        vistos.add(id);
        const prazo = Number(fo.prazo_dias);
        return {
            id,
            nome: nomeFase,
            ...(Number.isInteger(prazo) && prazo > 0 && prazo <= 3650 ? { prazo_dias: prazo } : {}),
        };
    });
    return { nome, descricao: texto(src.descricao, MAX_TEXTO_LONGO), fases };
}

/** Fase seguinte no rito, ou null se a atual é a última (ou não existe). */
export function proximaFase(rito: Rito, faseAtualId: string): Fase | null {
    const i = rito.fases.findIndex((f) => f.id === faseAtualId);
    if (i < 0 || i >= rito.fases.length - 1) return null;
    return rito.fases[i + 1];
}

/** Quem tem o processo consigo: lotados na unidade que detém a posse. */
export function podeAgir(proc: ProcessoAcesso, ctx: ContextoUsuario): boolean {
    return ctx.unidadeIds.includes(proc.unidade_atual);
}

/**
 * Quem pode ler os autos:
 *   - administrador da Secretaria do órgão: todos;
 *   - sigilo normal: qualquer usuário lotado em alguma unidade do órgão;
 *   - sigilo restrito: só unidades por onde o processo passou.
 */
export function podeVer(proc: ProcessoAcesso, ctx: ContextoUsuario): boolean {
    if (ctx.isAdmin) return true;
    if (podeAgir(proc, ctx)) return true;
    if (ctx.unidadeIds.length === 0) return false;
    if (proc.sigilo === 'restrito') {
        const hist = proc.unidades_historico || [];
        return ctx.unidadeIds.some((u) => hist.includes(u));
    }
    return true;
}

export function numeroProcesso(ano: number, seq: number): string {
    return `${String(seq).padStart(6, '0')}/${ano}`;
}

/** JSON com chaves ordenadas: o mesmo conteúdo sempre gera o mesmo texto. */
export function jsonCanonico(v: unknown): string {
    if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
    if (Array.isArray(v)) return `[${v.map(jsonCanonico).join(',')}]`;
    const obj = v as Record<string, unknown>;
    const chaves = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${jsonCanonico(obj[k])}`).join(',')}}`;
}

export function sha256(dado: string | Buffer): string {
    return createHash('sha256').update(dado).digest('hex');
}

export interface MovimentoBase {
    seq: number;
    tipo: string;
    descricao: string;
    autor_uid: string;
    autor_nome: string;
    unidade_id: string;
    em: string; // ISO 8601
    dados: Record<string, unknown>;
    hash_anterior: string;
}

export function hashMovimento(m: MovimentoBase): string {
    return sha256(jsonCanonico({
        seq: m.seq,
        tipo: m.tipo,
        descricao: m.descricao,
        autor_uid: m.autor_uid,
        autor_nome: m.autor_nome,
        unidade_id: m.unidade_id,
        em: m.em,
        dados: m.dados,
        hash_anterior: m.hash_anterior,
    }));
}

/** Confere a cadeia inteira. Retorna o seq do primeiro movimento quebrado, ou null. */
export function verificarCadeia(movs: Array<MovimentoBase & { hash: string }>): number | null {
    let anterior = '';
    const ordenados = [...movs].sort((a, b) => a.seq - b.seq);
    for (const m of ordenados) {
        if (m.hash_anterior !== anterior || hashMovimento(m) !== m.hash) return m.seq;
        anterior = m.hash;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Conteúdo redigido na plataforma: guardado como Delta do editor (lista de
// operações de texto com atributos). Aceitamos só texto e um conjunto fechado
// de formatos — nada de HTML, imagens embutidas ou links com script. Assim o
// conteúdo nunca é interpretado como HTML em lugar nenhum.
// ---------------------------------------------------------------------------

const ATRIBUTOS_PERMITIDOS: Record<string, (v: unknown) => boolean> = {
    bold: (v) => v === true,
    italic: (v) => v === true,
    underline: (v) => v === true,
    header: (v) => v === 1 || v === 2 || v === 3,
    list: (v) => v === 'ordered' || v === 'bullet',
    align: (v) => v === 'center' || v === 'right' || v === 'justify',
    blockquote: (v) => v === true,
    indent: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 8,
};

export interface DeltaOp { insert: string; attributes?: Record<string, unknown> }
export const MAX_DELTA_CHARS = 400_000;

export function sanitizeDelta(input: unknown): DeltaOp[] {
    const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const ops = Array.isArray(src.ops) ? src.ops : Array.isArray(input) ? (input as unknown[]) : [];
    const out: DeltaOp[] = [];
    let total = 0;
    for (const op of ops) {
        const o = (op && typeof op === 'object' ? op : {}) as Record<string, unknown>;
        if (typeof o.insert !== 'string') continue; // descarta embeds
        total += o.insert.length;
        if (total > MAX_DELTA_CHARS) throw new Error('Documento grande demais para o editor');
        const attrsIn = (o.attributes && typeof o.attributes === 'object' ? o.attributes : {}) as Record<string, unknown>;
        const attrs: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(attrsIn)) {
            if (ATRIBUTOS_PERMITIDOS[k]?.(v)) attrs[k] = v;
        }
        out.push(Object.keys(attrs).length ? { insert: o.insert, attributes: attrs } : { insert: o.insert });
    }
    return out;
}

/** Texto puro do Delta (para PDF e busca). */
export function deltaParaTexto(ops: DeltaOp[]): string {
    return ops.map((o) => o.insert).join('');
}
