/**
 * Listas do órgão: espécies de comunicação, espécies de audiência e origens
 * do processo a mais, além das do sistema. O órgão cadastra uma vez e a
 * equipe escolhe nas telas. O registro (comunicação, audiência, origem, ação
 * do rito) guarda o id e o nome do item: tirar o item da lista não muda o que
 * já foi feito. O gênero do nome deixa o texto dos atos certo ("à intimação",
 * "ao edital"). Lógica pura, sem importar outros módulos (evita ciclo).
 */

export interface ItemLista { id: string; nome: string; /** Nome masculino ("o edital"). Ausente = feminino. */ m?: true }
export interface ListasOrgao { comunicacao?: ItemLista[]; audiencia?: ItemLista[]; origem?: ItemLista[] }
export const LISTAS = ['comunicacao', 'audiencia', 'origem'] as const;
export type NomeLista = typeof LISTAS[number];
export const MAX_ITENS_LISTA = 30;
export const MAX_NOME_ITEM = 40;

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Id de item do órgão: sempre com o prefixo "o_" (não colide com os do sistema). */
export const ehDoOrgao = (id: unknown): id is string => typeof id === 'string' && /^o_[a-z0-9_]{1,40}$/.test(id);
const idDe = (nome: string) => `o_${sem(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'item'}`;
const nomeLimpo = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, MAX_NOME_ITEM) : '');

/**
 * Lista saneada. `sistema`: nomes que o sistema já tem (não se repetem).
 * Item já gravado mantém o id (renomear não quebra o que o usa). Lança Error com mensagem.
 */
export function sanitizeLista(raw: unknown, sistema: string[], comGenero: boolean, rotulo: string): ItemLista[] {
    const lista = Array.isArray(raw) ? raw : [];
    if (lista.length > MAX_ITENS_LISTA) throw new Error(`${rotulo}: no máximo ${MAX_ITENS_LISTA} itens`);
    const ids = new Set<string>();
    const nomes = new Set(sistema.map(sem));
    const out: ItemLista[] = [];
    for (const x of lista) {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        const nome = nomeLimpo(o.nome);
        if (!nome) continue;
        if (nomes.has(sem(nome))) throw new Error(`${rotulo}: "${nome}" já existe`);
        nomes.add(sem(nome));
        let id = ehDoOrgao(o.id) ? o.id : idDe(nome);
        while (ids.has(id)) id = `${id.slice(0, 40)}x`;
        ids.add(id);
        out.push({ id, nome, ...(comGenero && o.m === true ? { m: true as const } : {}) });
    }
    return out;
}

/**
 * Item do órgão que vem junto de um registro (o rito ou a tela mandam o id e
 * o nome). null quando não é item do órgão; lança quando falta o nome.
 */
export function itemDoRegistro(id: unknown, nome: unknown, m: unknown, onde: string): ItemLista | null {
    if (!ehDoOrgao(id)) return null;
    const n = nomeLimpo(nome);
    if (!n) throw new Error(`${onde}: falta o nome do item da lista do órgão`);
    return { id, nome: n, ...(m === true ? { m: true as const } : {}) };
}

/** Artigos do nome: "a"/"o", "da"/"do", "à"/"ao". */
export const artigos = (m?: boolean) => (m ? { o: 'o', de: 'do', a: 'ao' } : { o: 'a', de: 'da', a: 'à' });

const ROTULO_LISTA: Record<NomeLista, string> = { comunicacao: 'Espécies de comunicação', audiencia: 'Espécies de audiência', origem: 'Origens do processo' };

/** As três listas saneadas; `sistema` traz os nomes que o sistema já tem em cada uma. Lança Error com mensagem. */
export function sanitizeListas(raw: unknown, sistema: Record<NomeLista, string[]>): ListasOrgao {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const out: ListasOrgao = {};
    for (const k of LISTAS) {
        const l = sanitizeLista(o[k], sistema[k], k !== 'origem', ROTULO_LISTA[k]);
        if (l.length) out[k] = l;
    }
    return out;
}

/** Listas gravadas, para devolver às telas (o que não for válido some). */
export function listasDe(raw: unknown, sistema: Record<NomeLista, string[]>): ListasOrgao {
    try { return sanitizeListas(raw, sistema); } catch { return {}; }
}
