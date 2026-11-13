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
/** Admins delegados por órgão interno. */
export const MAX_ADMINS_ORGAO = 10;
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
    /**
     * Admins delegados: configuram este órgão, os subordinados e as unidades
     * deles (dados, equipe, modelos). Ritos, tipos e integrações seguem com o
     * admin da entidade.
     */
    admins_uids: string[];
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
        admins_uids: [...new Set((Array.isArray(o.admins_uids) ? o.admins_uids : []).filter((x): x is string => typeof x === 'string' && !!x).map((x) => x.slice(0, 128)))].slice(0, MAX_ADMINS_ORGAO),
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

/**
 * Órgãos que `uid` administra por delegação: aqueles em que está em
 * `admins_uids` e todos os que ficam abaixo deles.
 */
export function orgaosAdministrados(orgaos: Orgao[], uid: string): string[] {
    const porId = new Map(orgaos.map((o) => [o.id, o]));
    return orgaos.filter((o) => {
        // O contador protege de ciclo em dado antigo (validarEstrutura já o recusa ao gravar).
        for (let a: Orgao | undefined = o, n = 0; a && n <= orgaos.length; a = a.pai_id ? porId.get(a.pai_id) : undefined, n++) {
            if (a.admins_uids.includes(uid)) return true;
        }
        return false;
    }).map((o) => o.id);
}

/**
 * Admin delegado (sem ser admin da entidade) salvando o órgão `novo`:
 * só mexe no que administra. No órgão que lhe foi delegado (a raiz), não
 * muda o superior nem os admins; abaixo dela, cria, move e indica admins
 * desde que tudo fique dentro do que administra. Lança com a explicação.
 */
export function conferirDelegado(atuais: Orgao[], uid: string, novo: Orgao): void {
    const meus = new Set(orgaosAdministrados(atuais, uid));
    const atual = atuais.find((o) => o.id === novo.id);
    if (atual && !meus.has(atual.id)) throw new Error('Você não administra este órgão interno');
    const raiz = !!atual && !(atual.pai_id && meus.has(atual.pai_id));
    if (raiz) {
        const mesmos = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
        if ((novo.pai_id || null) !== (atual!.pai_id || null)) throw new Error('Só o admin da entidade muda o órgão superior deste órgão');
        if (!mesmos(novo.admins_uids, atual!.admins_uids)) throw new Error('Só o admin da entidade muda quem administra este órgão');
        return;
    }
    if (!novo.pai_id || !meus.has(novo.pai_id)) throw new Error('Escolha como superior um órgão que você administra');
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
