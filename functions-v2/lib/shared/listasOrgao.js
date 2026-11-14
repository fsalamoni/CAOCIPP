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
exports.artigos = exports.ehDoOrgao = exports.MAX_NOME_ITEM = exports.MAX_ITENS_LISTA = exports.LISTAS = void 0;
exports.sanitizeLista = sanitizeLista;
exports.itemDoRegistro = itemDoRegistro;
exports.sanitizeListas = sanitizeListas;
exports.listasDe = listasDe;
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
//# sourceMappingURL=listasOrgao.js.map