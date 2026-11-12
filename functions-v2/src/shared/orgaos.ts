import { texto, tipoUnidade, TipoUnidade } from './secretaria';

/**
 * Órgãos internos de uma entidade (ex.: Conselho, Presidência, Diretorias).
 * A entidade pode ser singular (lista vazia: as unidades ficam ligadas direto
 * a ela) ou composta por órgãos em árvore, cada um com unidades, competências,
 * titular e forma de decisão. Regras puras, sem banco.
 */

export const NATUREZAS = ['deliberativo', 'direcao', 'executivo', 'consultivo', 'fiscal', 'julgador', 'apoio', 'outro'] as const;
export type Natureza = typeof NATUREZAS[number];

export const MAX_ORGAOS = 60;
export const MAX_NIVEIS = 6;
export const MAX_COMPETENCIAS = 20;
const MAX_COMPETENCIA = 300;

export interface Orgao {
    id: string;
    nome: string;
    sigla: string;
    natureza: Natureza;
    /** Órgão imediatamente superior; null = ligado direto à entidade. */
    pai_id: string | null;
    /** Quem decide: o titular sozinho ou o colegiado. */
    decisao: 'singular' | 'colegiada';
    titular_cargo: string;
    titular_uid: string | null;
    competencias: string[];
    descricao: string;
    ordem: number;
    ativo: boolean;
    /** Quem criou (o servidor grava; nunca vem do formulário). */
    criado_por?: string | null;
}

/** Lista de competências ou atribuições: textos curtos, sem repetição. */
export function sanitizeCompetencias(raw: unknown): string[] {
    const lista = (Array.isArray(raw) ? raw : []).map((x) => texto(x, MAX_COMPETENCIA)).filter(Boolean);
    return [...new Set(lista)].slice(0, MAX_COMPETENCIAS);
}

const ID = /^[A-Za-z0-9_-]{1,40}$/;

export function sanitizeOrgao(raw: unknown, id: string, ordem = 0): Orgao {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const nome = texto(o.nome, 120);
    if (!nome) throw new Error('O órgão precisa de um nome');
    if (!ID.test(id)) throw new Error('Identificador de órgão inválido');
    return {
        id,
        nome,
        sigla: texto(o.sigla, 20),
        natureza: NATUREZAS.includes(o.natureza as Natureza) ? (o.natureza as Natureza) : 'outro',
        pai_id: typeof o.pai_id === 'string' && o.pai_id ? o.pai_id : null,
        decisao: o.decisao === 'colegiada' ? 'colegiada' : 'singular',
        titular_cargo: texto(o.titular_cargo, 80),
        titular_uid: typeof o.titular_uid === 'string' && o.titular_uid ? o.titular_uid.slice(0, 128) : null,
        competencias: sanitizeCompetencias(o.competencias),
        descricao: texto(o.descricao, 1000),
        ordem: Number.isFinite(Number(o.ordem)) ? Math.max(0, Math.min(999, Math.round(Number(o.ordem)))) : ordem,
        ativo: o.ativo !== false,
        criado_por: typeof o.criado_por === 'string' && o.criado_por ? o.criado_por.slice(0, 128) : null,
    };
}

/** Lê a lista gravada, tolerando lixo (nunca lança). */
export function orgaosDe(raw: unknown): Orgao[] {
    const out: Orgao[] = [];
    for (const [i, o] of (Array.isArray(raw) ? raw : []).entries()) {
        try { out.push(sanitizeOrgao(o, String((o as { id?: unknown })?.id || ''), i)); } catch { /* ignora item inválido */ }
    }
    return out;
}

/** Nível de cada órgão na árvore (1 = ligado à entidade); lança se houver ciclo ou pai inexistente. */
export function niveis(orgaos: Orgao[]): Map<string, number> {
    const porId = new Map(orgaos.map((o) => [o.id, o]));
    if (porId.size !== orgaos.length) throw new Error('Há órgãos repetidos na estrutura');
    const out = new Map<string, number>();
    for (const o of orgaos) {
        let n = 1;
        let atual = o;
        while (atual.pai_id) {
            const pai = porId.get(atual.pai_id);
            if (!pai) throw new Error(`O órgão superior de "${atual.nome}" não existe`);
            if (pai.id === o.id || ++n > orgaos.length) throw new Error(`"${o.nome}" não pode ficar abaixo de si mesmo`);
            atual = pai;
        }
        out.set(o.id, n);
    }
    return out;
}

/** Confere a estrutura inteira: limites, nomes únicos entre irmãos, árvore sem ciclo. */
export function validarEstrutura(orgaos: Orgao[]): Orgao[] {
    if (orgaos.length > MAX_ORGAOS) throw new Error(`A estrutura comporta até ${MAX_ORGAOS} órgãos internos`);
    const n = niveis(orgaos);
    for (const o of orgaos) {
        if ((n.get(o.id) || 1) > MAX_NIVEIS) throw new Error(`A estrutura comporta até ${MAX_NIVEIS} níveis; "${o.nome}" passou disso`);
    }
    const vistos = new Set<string>();
    for (const o of orgaos) {
        const chave = `${o.pai_id || ''}|${o.nome.toLowerCase()}`;
        if (vistos.has(chave)) throw new Error(`Já existe um órgão chamado "${o.nome}" nesse mesmo nível`);
        vistos.add(chave);
    }
    return orgaos;
}

/** Ordem de leitura do organograma: cada órgão seguido dos seus subordinados. */
export function emArvore(orgaos: Orgao[]): Array<Orgao & { nivel: number }> {
    const filhos = (pai: string | null) => orgaos.filter((o) => (o.pai_id || null) === pai)
        .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
    const out: Array<Orgao & { nivel: number }> = [];
    const descer = (pai: string | null, nivel: number) => {
        for (const o of filhos(pai)) {
            if (out.some((x) => x.id === o.id)) continue;
            out.push({ ...o, nivel });
            descer(o.id, nivel + 1);
        }
    };
    descer(null, 1);
    return out;
}

/** Nome do órgão de uma unidade ('' quando ligada direto à entidade). */
export function nomeOrgao(orgaos: Orgao[], orgaoId: unknown): string {
    return orgaos.find((o) => o.id === orgaoId)?.nome || '';
}

export interface UnidadeProposta { nome: string; sigla: string; tipo: TipoUnidade }
export interface OrgaoProposto { chave: string; pai_chave: string | null; orgao: Record<string, unknown>; unidades: UnidadeProposta[] }

/**
 * Estrutura montada no assistente: órgãos com chave provisória (o superior é
 * apontado por chave) e as unidades a criar em cada um.
 */
export function sanitizeProposta(raw: unknown): OrgaoProposto[] {
    const lista = Array.isArray(raw) ? raw : [];
    if (!lista.length) throw new Error('Inclua ao menos um órgão na estrutura');
    if (lista.length > MAX_ORGAOS) throw new Error(`A estrutura comporta até ${MAX_ORGAOS} órgãos internos`);
    const out: OrgaoProposto[] = lista.map((x, i) => {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        const chave = texto(o.chave, 40) || `o${i}`;
        const unidades = (Array.isArray(o.unidades) ? o.unidades : []).slice(0, 8).map((u) => {
            const un = (u && typeof u === 'object' ? u : {}) as Record<string, unknown>;
            return { nome: texto(un.nome, 120), sigla: texto(un.sigla, 20), tipo: tipoUnidade(un.tipo) };
        }).filter((u) => u.nome);
        return { chave, pai_chave: texto(o.pai_chave, 40) || null, orgao: o, unidades };
    });
    if (new Set(out.map((o) => o.chave)).size !== out.length) throw new Error('Há órgãos repetidos na estrutura');
    return out;
}
