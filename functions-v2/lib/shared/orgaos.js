"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_COMPETENCIAS = exports.MAX_NIVEIS = exports.MAX_ORGAOS = exports.NATUREZAS = void 0;
exports.sanitizeCompetencias = sanitizeCompetencias;
exports.sanitizeOrgao = sanitizeOrgao;
exports.orgaosDe = orgaosDe;
exports.niveis = niveis;
exports.validarEstrutura = validarEstrutura;
exports.emArvore = emArvore;
exports.nomeOrgao = nomeOrgao;
exports.sanitizeProposta = sanitizeProposta;
const secretaria_1 = require("./secretaria");
/**
 * Órgãos internos de uma entidade (ex.: Conselho, Presidência, Diretorias).
 * A entidade pode ser singular (lista vazia: as unidades ficam ligadas direto
 * a ela) ou composta por órgãos em árvore, cada um com unidades, competências,
 * titular e forma de decisão. Regras puras, sem banco.
 */
exports.NATUREZAS = ['deliberativo', 'direcao', 'executivo', 'consultivo', 'fiscal', 'julgador', 'apoio', 'outro'];
exports.MAX_ORGAOS = 60;
exports.MAX_NIVEIS = 6;
exports.MAX_COMPETENCIAS = 20;
const MAX_COMPETENCIA = 300;
/** Lista de competências ou atribuições: textos curtos, sem repetição. */
function sanitizeCompetencias(raw) {
    const lista = (Array.isArray(raw) ? raw : []).map((x) => (0, secretaria_1.texto)(x, MAX_COMPETENCIA)).filter(Boolean);
    return [...new Set(lista)].slice(0, exports.MAX_COMPETENCIAS);
}
const ID = /^[A-Za-z0-9_-]{1,40}$/;
function sanitizeOrgao(raw, id, ordem = 0) {
    const o = (raw && typeof raw === 'object' ? raw : {});
    const nome = (0, secretaria_1.texto)(o.nome, 120);
    if (!nome)
        throw new Error('O órgão precisa de um nome');
    if (!ID.test(id))
        throw new Error('Identificador de órgão inválido');
    return {
        id,
        nome,
        sigla: (0, secretaria_1.texto)(o.sigla, 20),
        natureza: exports.NATUREZAS.includes(o.natureza) ? o.natureza : 'outro',
        pai_id: typeof o.pai_id === 'string' && o.pai_id ? o.pai_id : null,
        decisao: o.decisao === 'colegiada' ? 'colegiada' : 'singular',
        titular_cargo: (0, secretaria_1.texto)(o.titular_cargo, 80),
        titular_uid: typeof o.titular_uid === 'string' && o.titular_uid ? o.titular_uid.slice(0, 128) : null,
        competencias: sanitizeCompetencias(o.competencias),
        descricao: (0, secretaria_1.texto)(o.descricao, 1000),
        ordem: Number.isFinite(Number(o.ordem)) ? Math.max(0, Math.min(999, Math.round(Number(o.ordem)))) : ordem,
        ativo: o.ativo !== false,
        criado_por: typeof o.criado_por === 'string' && o.criado_por ? o.criado_por.slice(0, 128) : null,
    };
}
/** Lê a lista gravada, tolerando lixo (nunca lança). */
function orgaosDe(raw) {
    const out = [];
    for (const [i, o] of (Array.isArray(raw) ? raw : []).entries()) {
        try {
            out.push(sanitizeOrgao(o, String((o === null || o === void 0 ? void 0 : o.id) || ''), i));
        }
        catch ( /* ignora item inválido */_a) { /* ignora item inválido */ }
    }
    return out;
}
/** Nível de cada órgão na árvore (1 = ligado à entidade); lança se houver ciclo ou pai inexistente. */
function niveis(orgaos) {
    const porId = new Map(orgaos.map((o) => [o.id, o]));
    if (porId.size !== orgaos.length)
        throw new Error('Há órgãos repetidos na estrutura');
    const out = new Map();
    for (const o of orgaos) {
        let n = 1;
        let atual = o;
        while (atual.pai_id) {
            const pai = porId.get(atual.pai_id);
            if (!pai)
                throw new Error(`O órgão superior de "${atual.nome}" não existe`);
            if (pai.id === o.id || ++n > orgaos.length)
                throw new Error(`"${o.nome}" não pode ficar abaixo de si mesmo`);
            atual = pai;
        }
        out.set(o.id, n);
    }
    return out;
}
/** Confere a estrutura inteira: limites, nomes únicos entre irmãos, árvore sem ciclo. */
function validarEstrutura(orgaos) {
    if (orgaos.length > exports.MAX_ORGAOS)
        throw new Error(`A estrutura comporta até ${exports.MAX_ORGAOS} órgãos internos`);
    const n = niveis(orgaos);
    for (const o of orgaos) {
        if ((n.get(o.id) || 1) > exports.MAX_NIVEIS)
            throw new Error(`A estrutura comporta até ${exports.MAX_NIVEIS} níveis; "${o.nome}" passou disso`);
    }
    const vistos = new Set();
    for (const o of orgaos) {
        const chave = `${o.pai_id || ''}|${o.nome.toLowerCase()}`;
        if (vistos.has(chave))
            throw new Error(`Já existe um órgão chamado "${o.nome}" nesse mesmo nível`);
        vistos.add(chave);
    }
    return orgaos;
}
/** Ordem de leitura do organograma: cada órgão seguido dos seus subordinados. */
function emArvore(orgaos) {
    const filhos = (pai) => orgaos.filter((o) => (o.pai_id || null) === pai)
        .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
    const out = [];
    const descer = (pai, nivel) => {
        for (const o of filhos(pai)) {
            if (out.some((x) => x.id === o.id))
                continue;
            out.push(Object.assign(Object.assign({}, o), { nivel }));
            descer(o.id, nivel + 1);
        }
    };
    descer(null, 1);
    return out;
}
/** Nome do órgão de uma unidade ('' quando ligada direto à entidade). */
function nomeOrgao(orgaos, orgaoId) {
    var _a;
    return ((_a = orgaos.find((o) => o.id === orgaoId)) === null || _a === void 0 ? void 0 : _a.nome) || '';
}
/**
 * Estrutura montada no assistente: órgãos com chave provisória (o superior é
 * apontado por chave) e as unidades a criar em cada um.
 */
function sanitizeProposta(raw) {
    const lista = Array.isArray(raw) ? raw : [];
    if (!lista.length)
        throw new Error('Inclua ao menos um órgão na estrutura');
    if (lista.length > exports.MAX_ORGAOS)
        throw new Error(`A estrutura comporta até ${exports.MAX_ORGAOS} órgãos internos`);
    const out = lista.map((x, i) => {
        const o = (x && typeof x === 'object' ? x : {});
        const chave = (0, secretaria_1.texto)(o.chave, 40) || `o${i}`;
        const unidades = (Array.isArray(o.unidades) ? o.unidades : []).slice(0, 8).map((u) => {
            const un = (u && typeof u === 'object' ? u : {});
            return { nome: (0, secretaria_1.texto)(un.nome, 120), sigla: (0, secretaria_1.texto)(un.sigla, 20), tipo: (0, secretaria_1.tipoUnidade)(un.tipo) };
        }).filter((u) => u.nome);
        return { chave, pai_chave: (0, secretaria_1.texto)(o.pai_chave, 40) || null, orgao: o, unidades };
    });
    if (new Set(out.map((o) => o.chave)).size !== out.length)
        throw new Error('Há órgãos repetidos na estrutura');
    return out;
}
//# sourceMappingURL=orgaos.js.map