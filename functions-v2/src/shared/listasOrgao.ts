/**
 * Listas do órgão: espécies de comunicação, espécies de audiência e origens
 * do processo a mais, além das do sistema. O órgão cadastra uma vez e a
 * equipe escolhe nas telas. O registro (comunicação, audiência, origem, ação
 * do rito) guarda o id e o nome do item: tirar o item da lista não muda o que
 * já foi feito. O gênero do nome deixa o texto dos atos certo ("à intimação",
 * "ao edital"). Lógica pura, sem importar outros módulos (evita ciclo).
 */

export interface ItemLista { id: string; nome: string; /** Nome masculino ("o edital"). Ausente = feminino. */ m?: true }
export interface ListasOrgao { comunicacao?: ItemLista[]; audiencia?: ItemLista[]; origem?: ItemLista[]; peticao?: ItemLista[] }
export const LISTAS = ['comunicacao', 'audiencia', 'origem', 'peticao'] as const;
/** Tipos de petição que o portal das partes sempre oferece ("Outro" fica por último, depois dos do órgão). */
export const TIPOS_PETICAO = ['Manifestação', 'Juntada de documento', 'Pedido de prazo', 'Pedido de urgência', 'Pedido de vista', 'Recurso', 'Outro'];
/** Os tipos de petição que a parte escolhe: os do sistema, os do órgão e "Outro" no fim. */
export function tiposDePeticao(listas: unknown): string[] {
    const l = (listas && typeof listas === 'object' ? (listas as ListasOrgao).peticao : null) || [];
    const doOrgao = (Array.isArray(l) ? l : []).map((x) => (typeof x?.nome === 'string' ? x.nome : '')).filter((n) => n && !TIPOS_PETICAO.includes(n));
    return [...TIPOS_PETICAO.slice(0, -1), ...doOrgao, 'Outro'];
}
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

const ROTULO_LISTA: Record<NomeLista, string> = { comunicacao: 'Espécies de comunicação', audiencia: 'Espécies de audiência', origem: 'Origens do processo', peticao: 'Tipos de petição' };

/** As listas saneadas; `sistema` traz os nomes que o sistema já tem em cada uma. Lança Error com mensagem. */
export function sanitizeListas(raw: unknown, sistema: Record<NomeLista, string[]>): ListasOrgao {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const out: ListasOrgao = {};
    for (const k of LISTAS) {
        const l = sanitizeLista(o[k], sistema[k] || [], k ==='comunicacao' || k === 'audiencia', ROTULO_LISTA[k]);
        if (l.length) out[k] = l;
    }
    return out;
}

/** Listas gravadas, para devolver às telas (o que não for válido some). */
export function listasDe(raw: unknown, sistema: Record<NomeLista, string[]>): ListasOrgao {
    try { return sanitizeListas(raw, sistema); } catch { return {}; }
}

// ---------- importação de arquivo ----------
// O servidor lê o arquivo (texto, CSV, JSON, Word, planilha, PDF) e entrega
// aqui linhas e tabelas na ordem do arquivo; daqui sai a proposta que a tela
// mostra para o admin conferir. Nada é gravado: quem grava é salvarListas.

/** Parte do arquivo: uma linha de texto (parágrafo, título, item) ou uma tabela (linhas × células). */
export type BlocoArquivo = { linha: string; titulo?: boolean } | { tabela: string[][] };
/** Item achado no arquivo. `lista` null: o arquivo não diz em qual lista ele entra (a tela pergunta). */
export interface ItemProposto { lista: NomeLista | null; nome: string; m?: true; m_suposto?: true }
export interface PropostaListas { itens: ItemProposto[]; avisos: string[] }
/** Teto de itens lidos de um arquivo (as três listas, juntas, cabem 90). */
export const MAX_ITENS_PROPOSTA = 300;

const palavras = (s: string) => sem(s).replace(/[^a-z0-9]+/g, ' ').trim();
const VAZIAS = /\b(especies?|tipos?|listas?|novas?|outras?|planilha|aba|tabela|de|da|das|do|dos|o|os|a|as|e|para|processos?|procedimentos?|orgao)\b/g;

/** A lista que um título ("Espécies de comunicação:", "Origens do processo", aba "Audiências") nomeia, ou null. */
export function listaDoTitulo(s: string): NomeLista | null {
    const r = palavras(String(s || '').replace(/^\s*(#+|\d+(\.\d+)*[.)–-]?|[ivx]+[.)–-])\s+/i, '')).replace(VAZIAS, ' ').replace(/\s+/g, ' ').trim();
    if (/^comunicac(ao|oes)$/.test(r)) return 'comunicacao';
    if (/^audiencias?$/.test(r)) return 'audiencia';
    if (/^orige(m|ns)$/.test(r)) return 'origem';
    if (/^(peticao|peticoes|peticionamento)$/.test(r)) return 'peticao';
    return null;
}

const MASC = /\((m|masc\.?|masculino|o)\)\s*$/i;
const FEM = /\((f|fem\.?|feminino|a)\)\s*$/i;

/** Gênero estimado pela primeira palavra ("Edital", "Ofício", "Mandado" → masculino). A tela deixa conferir. */
export function pareceMasculino(nome: string): boolean {
    const p = palavras(nome).split(' ')[0] || '';
    return /(o|l|r|e|u|x)$/.test(p) && !/(ao|gem|ade|ie|ice|ase|ese|ose|tude)$/.test(p);
}

/** Item limpo de uma linha ("- Edital (m)", "2) O edital", "• Ouvidoria"), ou null. */
function itemDaLinha(bruto: string, lista: NomeLista | null): ItemProposto | null {
    let t = String(bruto || '').replace(/\s+/g, ' ').trim()
        .replace(/^(\[[ xX]?\]|[-*•·▪◦–—>+]+)\s*/, '')
        .replace(/^(\(?\d{1,3}[.)–-]|\(?[a-z][.)])\s+/i, '')
        .replace(/[;,.]+$/, '').trim();
    let m: boolean | undefined;
    if (MASC.test(t)) { m = true; t = t.replace(MASC, '').trim(); } else if (FEM.test(t)) { m = false; t = t.replace(FEM, '').trim(); }
    const art = t.match(/^(o|a)\s+(?=\S{3})/i);
    if (art && m === undefined) { m = art[1].toLowerCase() === 'o'; t = t.slice(art[0].length); }
    if (!t || t.length > MAX_NOME_ITEM || !/[a-zà-ú]/i.test(t)) return null;
    t = t[0].toUpperCase() + t.slice(1);
    const genero = lista !== 'origem';
    if (m === undefined && genero && pareceMasculino(t)) return { lista, nome: t, m: true, m_suposto: true };
    return { lista, nome: t, ...(m && genero ? { m: true as const } : {}) };
}

const ehSim = (v: string) => /^(m|masc\.?|masculino|o|sim|s|x|true|1)$/i.test(v.trim());

/** Itens de uma tabela: colunas com o nome da lista, ou colunas "lista" e "nome", ou só a primeira coluna. */
function itensDaTabela(linhas: string[][], atual: NomeLista | null, add: (i: ItemProposto | null, cru: string) => void) {
    const cab = (linhas[0] || []).map((c) => palavras(String(c ?? '')));
    const col = (re: RegExp) => cab.findIndex((c) => re.test(c));
    const cLista = col(/^(lista|tipo|categoria|grupo|classe)$/);
    const cNome = col(/^(nome|item|itens|descricao|especie|valor|titulo)$/);
    const cGen = col(/^(genero|masculino|artigo|m)$/);
    const genero = (l: string[], i: ItemProposto | null): ItemProposto | null => {
        if (!i || cGen < 0 || i.lista === 'origem') return i;
        const v = String(l[cGen] ?? '');
        if (!v.trim()) return i;
        const { lista, nome } = i;
        return ehSim(v) ? { lista, nome, m: true } : { lista, nome };
    };
    if (cLista >= 0 && cNome >= 0) {
        for (const l of linhas.slice(1)) {
            const rot = String(l[cLista] ?? '');
            add(genero(l, itemDaLinha(String(l[cNome] ?? ''), rot.trim() ? listaDoTitulo(rot) : atual)), String(l[cNome] ?? ''));
        }
        return;
    }
    const porColuna = cab.map((c) => listaDoTitulo(c));
    if (porColuna.some(Boolean)) {
        porColuna.forEach((lista, j) => {
            if (!lista) return;
            for (const l of linhas.slice(1)) add(genero(l, itemDaLinha(String(l[j] ?? ''), lista)), String(l[j] ?? ''));
        });
        return;
    }
    // Sem cabeçalho conhecido: a coluna "nome" ou a primeira com texto; "nome" no alto é só cabeçalho.
    for (const l of cNome >= 0 ? linhas.slice(1) : linhas) {
        const v = String((cNome >= 0 ? l[cNome] : l.find((x) => String(x ?? '').trim())) ?? '');
        add(genero(l, itemDaLinha(v, atual)), v);
    }
}

/** Proposta de itens a partir das linhas e tabelas do arquivo, na ordem dele. */
export function propostaDeBlocos(blocos: BlocoArquivo[]): PropostaListas {
    const itens: ItemProposto[] = [];
    const vistos = new Set<string>();
    let longos = 0;
    let cheio = false;
    let atual: NomeLista | null = null;
    const add = (i: ItemProposto | null, cru: string) => {
        if (!i) { if (String(cru || '').trim().length > MAX_NOME_ITEM) longos++; return; }
        const k = `${i.lista}:${sem(i.nome)}`;
        if (vistos.has(k)) return;
        if (itens.length >= MAX_ITENS_PROPOSTA) { cheio = true; return; }
        vistos.add(k);
        itens.push(i);
    };
    for (const b of blocos) {
        if ('tabela' in b) { itensDaTabela(b.tabela, atual, add); continue; }
        const linha = String(b.linha || '').trim();
        if (!linha) continue;
        // "Comunicação: Edital; Convocação" = título e itens na mesma linha.
        const dp = linha.match(/^([^:]{2,60}):\s*(.*)$/);
        const inteiro = listaDoTitulo(linha); // "Planilha: Origens" (aba da planilha) é título inteiro
        const titulo = inteiro ?? (dp ? listaDoTitulo(dp[1]) : null);
        if (titulo) {
            atual = titulo;
            if (!inteiro && dp?.[2]) for (const x of dp[2].split(/[;,|]/)) add(itemDaLinha(x, atual), x);
            continue;
        }
        // Outro título ("Outros:", título do Word) fecha a seção: o que vem depois não se sabe de que lista é.
        if (b.titulo || (dp && !dp[2])) { atual = null; continue; }
        add(itemDaLinha(linha, atual), linha);
    }
    const avisos: string[] = [];
    if (cheio) avisos.push(`O arquivo tem mais itens do que cabem numa leitura; li os ${MAX_ITENS_PROPOSTA} primeiros.`);
    if (longos) avisos.push(`${longos === 1 ? 'Uma linha ficou de fora' : `${longos} linhas ficaram de fora`} por passar de ${MAX_NOME_ITEM} letras (parece texto corrido, não nome de item).`);
    if (itens.some((i) => !i.lista)) avisos.push('Alguns itens não dizem de que lista são. Escolha a lista de cada um antes de inserir.');
    return { itens, avisos };
}

/** Texto de CSV ou TSV em tabela (aspas respeitadas); null se não parece tabela. */
export function tabelaDoCsv(texto: string): string[][] | null {
    const primeira = texto.split(/\r?\n/).find((l) => l.trim()) || '';
    const [sep, vezes] = ([';', '\t', ','] as const).map((s) => [s, primeira.split(s).length - 1] as const).sort((a, b) => b[1] - a[1])[0];
    if (vezes < 1) return null;
    const linhas: string[][] = [];
    let linha: string[] = [];
    let cel = '';
    let aspas = false;
    const fecha = () => { linha.push(cel.trim()); cel = ''; if (linha.some(Boolean)) linhas.push(linha); linha = []; };
    for (let i = 0; i < texto.length && linhas.length <= 5000; i++) {
        const ch = texto[i];
        if (aspas) {
            if (ch === '"' && texto[i + 1] === '"') { cel += '"'; i++; } else if (ch === '"') aspas = false; else cel += ch;
        } else if (ch === '"' && !cel.trim()) aspas = true;
        else if (ch === sep) { linha.push(cel.trim()); cel = ''; } else if (ch === '\n') fecha();
        else if (ch !== '\r') cel += ch;
    }
    fecha();
    return linhas;
}

const NOME_CAMPO = ['nome', 'name', 'item', 'label', 'titulo', 'descricao', 'valor', 'value', 'especie'];

/** Blocos de um JSON: { "comunicacao": ["Edital"], "origem": [...] }, [{ "lista": "...", "nome": "..." }], ["..."] e aninhados. */
export function blocosDoJson(v: unknown): BlocoArquivo[] {
    const out: BlocoArquivo[] = [];
    const andar = (x: unknown, lista: string, nivel: number) => {
        if (nivel > 6 || out.length > MAX_ITENS_PROPOSTA * 2) return;
        if (typeof x === 'string' || typeof x === 'number') { out.push({ tabela: [['lista', 'nome'], [lista, String(x)]] }); return; }
        if (Array.isArray(x)) { for (const y of x.slice(0, MAX_ITENS_PROPOSTA * 2)) andar(y, lista, nivel + 1); return; }
        if (!x || typeof x !== 'object') return;
        const o = x as Record<string, unknown>;
        const k = Object.keys(o);
        const kNome = k.find((c) => NOME_CAMPO.includes(palavras(c)));
        if (kNome) {
            const kLista = k.find((c) => /^(lista|tipo|categoria|grupo)$/.test(palavras(c)));
            const kGen = k.find((c) => /^(m|masculino|genero|artigo)$/.test(palavras(c)));
            const g = kGen === undefined ? '' : o[kGen] === true ? 'sim' : o[kGen] === false ? 'nao' : String(o[kGen] ?? '');
            out.push({ tabela: [['lista', 'nome', 'genero'], [kLista ? String(o[kLista] ?? '') : lista, String(o[kNome] ?? ''), g]] });
            return;
        }
        for (const [c, y] of Object.entries(o)) andar(y, listaDoTitulo(c) ? c : lista, nivel + 1);
    };
    andar(v, '', 0);
    return out;
}
