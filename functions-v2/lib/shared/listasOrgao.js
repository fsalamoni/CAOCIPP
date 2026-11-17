"use strict";
/**
 * Listas do órgão: espécies de comunicação, espécies de audiência e origens
 * do processo a mais, além das do sistema. O órgão cadastra uma vez e a
 * equipe escolhe nas telas. O registro (comunicação, audiência, origem, ação
 * do rito) guarda o id e o nome do item: tirar o item da lista não muda o que
 * já foi feito. O gênero do nome deixa o texto dos atos certo ("à intimação",
 * "ao edital"). Lógica pura, sem importar outros módulos (evita ciclo).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ITENS_PROPOSTA = exports.artigos = exports.ehDoOrgao = exports.MAX_NOME_ITEM = exports.MAX_ITENS_LISTA = exports.LISTAS = void 0;
exports.sanitizeLista = sanitizeLista;
exports.itemDoRegistro = itemDoRegistro;
exports.sanitizeListas = sanitizeListas;
exports.listasDe = listasDe;
exports.listaDoTitulo = listaDoTitulo;
exports.pareceMasculino = pareceMasculino;
exports.propostaDeBlocos = propostaDeBlocos;
exports.tabelaDoCsv = tabelaDoCsv;
exports.blocosDoJson = blocosDoJson;
exports.LISTAS = ['comunicacao', 'audiencia', 'origem'];
exports.MAX_ITENS_LISTA = 30;
exports.MAX_NOME_ITEM = 40;
const sem = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Id de item do órgão: sempre com o prefixo "o_" (não colide com os do sistema). */
const ehDoOrgao = (id) => typeof id === 'string' && /^o_[a-z0-9_]{1,40}$/.test(id);
exports.ehDoOrgao = ehDoOrgao;
const idDe = (nome) => `o_${sem(nome).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'item'}`;
const nomeLimpo = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, exports.MAX_NOME_ITEM) : '');
/**
 * Lista saneada. `sistema`: nomes que o sistema já tem (não se repetem).
 * Item já gravado mantém o id (renomear não quebra o que o usa). Lança Error com mensagem.
 */
function sanitizeLista(raw, sistema, comGenero, rotulo) {
    const lista = Array.isArray(raw) ? raw : [];
    if (lista.length > exports.MAX_ITENS_LISTA)
        throw new Error(`${rotulo}: no máximo ${exports.MAX_ITENS_LISTA} itens`);
    const ids = new Set();
    const nomes = new Set(sistema.map(sem));
    const out = [];
    for (const x of lista) {
        const o = (x && typeof x === 'object' ? x : {});
        const nome = nomeLimpo(o.nome);
        if (!nome)
            continue;
        if (nomes.has(sem(nome)))
            throw new Error(`${rotulo}: "${nome}" já existe`);
        nomes.add(sem(nome));
        let id = (0, exports.ehDoOrgao)(o.id) ? o.id : idDe(nome);
        while (ids.has(id))
            id = `${id.slice(0, 40)}x`;
        ids.add(id);
        out.push(Object.assign({ id, nome }, (comGenero && o.m === true ? { m: true } : {})));
    }
    return out;
}
/**
 * Item do órgão que vem junto de um registro (o rito ou a tela mandam o id e
 * o nome). null quando não é item do órgão; lança quando falta o nome.
 */
function itemDoRegistro(id, nome, m, onde) {
    if (!(0, exports.ehDoOrgao)(id))
        return null;
    const n = nomeLimpo(nome);
    if (!n)
        throw new Error(`${onde}: falta o nome do item da lista do órgão`);
    return Object.assign({ id, nome: n }, (m === true ? { m: true } : {}));
}
/** Artigos do nome: "a"/"o", "da"/"do", "à"/"ao". */
const artigos = (m) => (m ? { o: 'o', de: 'do', a: 'ao' } : { o: 'a', de: 'da', a: 'à' });
exports.artigos = artigos;
const ROTULO_LISTA = { comunicacao: 'Espécies de comunicação', audiencia: 'Espécies de audiência', origem: 'Origens do processo' };
/** As três listas saneadas; `sistema` traz os nomes que o sistema já tem em cada uma. Lança Error com mensagem. */
function sanitizeListas(raw, sistema) {
    const o = (raw && typeof raw === 'object' ? raw : {});
    const out = {};
    for (const k of exports.LISTAS) {
        const l = sanitizeLista(o[k], sistema[k], k !== 'origem', ROTULO_LISTA[k]);
        if (l.length)
            out[k] = l;
    }
    return out;
}
/** Listas gravadas, para devolver às telas (o que não for válido some). */
function listasDe(raw, sistema) {
    try {
        return sanitizeListas(raw, sistema);
    }
    catch (_a) {
        return {};
    }
}
/** Teto de itens lidos de um arquivo (as três listas, juntas, cabem 90). */
exports.MAX_ITENS_PROPOSTA = 300;
const palavras = (s) => sem(s).replace(/[^a-z0-9]+/g, ' ').trim();
const VAZIAS = /\b(especies?|tipos?|listas?|novas?|outras?|planilha|aba|tabela|de|da|das|do|dos|o|os|a|as|e|para|processos?|procedimentos?|orgao)\b/g;
/** A lista que um título ("Espécies de comunicação:", "Origens do processo", aba "Audiências") nomeia, ou null. */
function listaDoTitulo(s) {
    const r = palavras(String(s || '').replace(/^\s*(#+|\d+(\.\d+)*[.)–-]?|[ivx]+[.)–-])\s+/i, '')).replace(VAZIAS, ' ').replace(/\s+/g, ' ').trim();
    if (/^comunicac(ao|oes)$/.test(r))
        return 'comunicacao';
    if (/^audiencias?$/.test(r))
        return 'audiencia';
    if (/^orige(m|ns)$/.test(r))
        return 'origem';
    return null;
}
const MASC = /\((m|masc\.?|masculino|o)\)\s*$/i;
const FEM = /\((f|fem\.?|feminino|a)\)\s*$/i;
/** Gênero estimado pela primeira palavra ("Edital", "Ofício", "Mandado" → masculino). A tela deixa conferir. */
function pareceMasculino(nome) {
    const p = palavras(nome).split(' ')[0] || '';
    return /(o|l|r|e|u|x)$/.test(p) && !/(ao|gem|ade|ie|ice|ase|ese|ose|tude)$/.test(p);
}
/** Item limpo de uma linha ("- Edital (m)", "2) O edital", "• Ouvidoria"), ou null. */
function itemDaLinha(bruto, lista) {
    let t = String(bruto || '').replace(/\s+/g, ' ').trim()
        .replace(/^(\[[ xX]?\]|[-*•·▪◦–—>+]+)\s*/, '')
        .replace(/^(\(?\d{1,3}[.)–-]|\(?[a-z][.)])\s+/i, '')
        .replace(/[;,.]+$/, '').trim();
    let m;
    if (MASC.test(t)) {
        m = true;
        t = t.replace(MASC, '').trim();
    }
    else if (FEM.test(t)) {
        m = false;
        t = t.replace(FEM, '').trim();
    }
    const art = t.match(/^(o|a)\s+(?=\S{3})/i);
    if (art && m === undefined) {
        m = art[1].toLowerCase() === 'o';
        t = t.slice(art[0].length);
    }
    if (!t || t.length > exports.MAX_NOME_ITEM || !/[a-zà-ú]/i.test(t))
        return null;
    t = t[0].toUpperCase() + t.slice(1);
    const genero = lista !== 'origem';
    if (m === undefined && genero && pareceMasculino(t))
        return { lista, nome: t, m: true, m_suposto: true };
    return Object.assign({ lista, nome: t }, (m && genero ? { m: true } : {}));
}
const ehSim = (v) => /^(m|masc\.?|masculino|o|sim|s|x|true|1)$/i.test(v.trim());
/** Itens de uma tabela: colunas com o nome da lista, ou colunas "lista" e "nome", ou só a primeira coluna. */
function itensDaTabela(linhas, atual, add) {
    var _a, _b, _c, _d;
    const cab = (linhas[0] || []).map((c) => palavras(String(c !== null && c !== void 0 ? c : '')));
    const col = (re) => cab.findIndex((c) => re.test(c));
    const cLista = col(/^(lista|tipo|categoria|grupo|classe)$/);
    const cNome = col(/^(nome|item|itens|descricao|especie|valor|titulo)$/);
    const cGen = col(/^(genero|masculino|artigo|m)$/);
    const genero = (l, i) => {
        var _a;
        if (!i || cGen < 0 || i.lista === 'origem')
            return i;
        const v = String((_a = l[cGen]) !== null && _a !== void 0 ? _a : '');
        if (!v.trim())
            return i;
        const { lista, nome } = i;
        return ehSim(v) ? { lista, nome, m: true } : { lista, nome };
    };
    if (cLista >= 0 && cNome >= 0) {
        for (const l of linhas.slice(1)) {
            const rot = String((_a = l[cLista]) !== null && _a !== void 0 ? _a : '');
            add(genero(l, itemDaLinha(String((_b = l[cNome]) !== null && _b !== void 0 ? _b : ''), rot.trim() ? listaDoTitulo(rot) : atual)), String((_c = l[cNome]) !== null && _c !== void 0 ? _c : ''));
        }
        return;
    }
    const porColuna = cab.map((c) => listaDoTitulo(c));
    if (porColuna.some(Boolean)) {
        porColuna.forEach((lista, j) => {
            var _a, _b;
            if (!lista)
                return;
            for (const l of linhas.slice(1))
                add(genero(l, itemDaLinha(String((_a = l[j]) !== null && _a !== void 0 ? _a : ''), lista)), String((_b = l[j]) !== null && _b !== void 0 ? _b : ''));
        });
        return;
    }
    // Sem cabeçalho conhecido: a coluna "nome" ou a primeira com texto; "nome" no alto é só cabeçalho.
    for (const l of cNome >= 0 ? linhas.slice(1) : linhas) {
        const v = String((_d = (cNome >= 0 ? l[cNome] : l.find((x) => String(x !== null && x !== void 0 ? x : '').trim()))) !== null && _d !== void 0 ? _d : '');
        add(genero(l, itemDaLinha(v, atual)), v);
    }
}
/** Proposta de itens a partir das linhas e tabelas do arquivo, na ordem dele. */
function propostaDeBlocos(blocos) {
    const itens = [];
    const vistos = new Set();
    let longos = 0;
    let cheio = false;
    let atual = null;
    const add = (i, cru) => {
        if (!i) {
            if (String(cru || '').trim().length > exports.MAX_NOME_ITEM)
                longos++;
            return;
        }
        const k = `${i.lista}:${sem(i.nome)}`;
        if (vistos.has(k))
            return;
        if (itens.length >= exports.MAX_ITENS_PROPOSTA) {
            cheio = true;
            return;
        }
        vistos.add(k);
        itens.push(i);
    };
    for (const b of blocos) {
        if ('tabela' in b) {
            itensDaTabela(b.tabela, atual, add);
            continue;
        }
        const linha = String(b.linha || '').trim();
        if (!linha)
            continue;
        // "Comunicação: Edital; Convocação" = título e itens na mesma linha.
        const dp = linha.match(/^([^:]{2,60}):\s*(.*)$/);
        const inteiro = listaDoTitulo(linha); // "Planilha: Origens" (aba da planilha) é título inteiro
        const titulo = inteiro !== null && inteiro !== void 0 ? inteiro : (dp ? listaDoTitulo(dp[1]) : null);
        if (titulo) {
            atual = titulo;
            if (!inteiro && (dp === null || dp === void 0 ? void 0 : dp[2]))
                for (const x of dp[2].split(/[;,|]/))
                    add(itemDaLinha(x, atual), x);
            continue;
        }
        // Outro título ("Outros:", título do Word) fecha a seção: o que vem depois não se sabe de que lista é.
        if (b.titulo || (dp && !dp[2])) {
            atual = null;
            continue;
        }
        add(itemDaLinha(linha, atual), linha);
    }
    const avisos = [];
    if (cheio)
        avisos.push(`O arquivo tem mais itens do que cabem numa leitura; li os ${exports.MAX_ITENS_PROPOSTA} primeiros.`);
    if (longos)
        avisos.push(`${longos === 1 ? 'Uma linha ficou de fora' : `${longos} linhas ficaram de fora`} por passar de ${exports.MAX_NOME_ITEM} letras (parece texto corrido, não nome de item).`);
    if (itens.some((i) => !i.lista))
        avisos.push('Alguns itens não dizem de que lista são. Escolha a lista de cada um antes de inserir.');
    return { itens, avisos };
}
/** Texto de CSV ou TSV em tabela (aspas respeitadas); null se não parece tabela. */
function tabelaDoCsv(texto) {
    const primeira = texto.split(/\r?\n/).find((l) => l.trim()) || '';
    const [sep, vezes] = [';', '\t', ','].map((s) => [s, primeira.split(s).length - 1]).sort((a, b) => b[1] - a[1])[0];
    if (vezes < 1)
        return null;
    const linhas = [];
    let linha = [];
    let cel = '';
    let aspas = false;
    const fecha = () => { linha.push(cel.trim()); cel = ''; if (linha.some(Boolean))
        linhas.push(linha); linha = []; };
    for (let i = 0; i < texto.length && linhas.length <= 5000; i++) {
        const ch = texto[i];
        if (aspas) {
            if (ch === '"' && texto[i + 1] === '"') {
                cel += '"';
                i++;
            }
            else if (ch === '"')
                aspas = false;
            else
                cel += ch;
        }
        else if (ch === '"' && !cel.trim())
            aspas = true;
        else if (ch === sep) {
            linha.push(cel.trim());
            cel = '';
        }
        else if (ch === '\n')
            fecha();
        else if (ch !== '\r')
            cel += ch;
    }
    fecha();
    return linhas;
}
const NOME_CAMPO = ['nome', 'name', 'item', 'label', 'titulo', 'descricao', 'valor', 'value', 'especie'];
/** Blocos de um JSON: { "comunicacao": ["Edital"], "origem": [...] }, [{ "lista": "...", "nome": "..." }], ["..."] e aninhados. */
function blocosDoJson(v) {
    const out = [];
    const andar = (x, lista, nivel) => {
        var _a, _b, _c;
        if (nivel > 6 || out.length > exports.MAX_ITENS_PROPOSTA * 2)
            return;
        if (typeof x === 'string' || typeof x === 'number') {
            out.push({ tabela: [['lista', 'nome'], [lista, String(x)]] });
            return;
        }
        if (Array.isArray(x)) {
            for (const y of x.slice(0, exports.MAX_ITENS_PROPOSTA * 2))
                andar(y, lista, nivel + 1);
            return;
        }
        if (!x || typeof x !== 'object')
            return;
        const o = x;
        const k = Object.keys(o);
        const kNome = k.find((c) => NOME_CAMPO.includes(palavras(c)));
        if (kNome) {
            const kLista = k.find((c) => /^(lista|tipo|categoria|grupo)$/.test(palavras(c)));
            const kGen = k.find((c) => /^(m|masculino|genero|artigo)$/.test(palavras(c)));
            const g = kGen === undefined ? '' : o[kGen] === true ? 'sim' : o[kGen] === false ? 'nao' : String((_a = o[kGen]) !== null && _a !== void 0 ? _a : '');
            out.push({ tabela: [['lista', 'nome', 'genero'], [kLista ? String((_b = o[kLista]) !== null && _b !== void 0 ? _b : '') : lista, String((_c = o[kNome]) !== null && _c !== void 0 ? _c : ''), g]] });
            return;
        }
        for (const [c, y] of Object.entries(o))
            andar(y, listaDoTitulo(c) ? c : lista, nivel + 1);
    };
    andar(v, '', 0);
    return out;
}
//# sourceMappingURL=listasOrgao.js.map