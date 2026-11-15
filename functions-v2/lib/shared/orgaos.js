"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vigente = exports.FUNCOES_COLEGIADO = exports.MAX_COMPOSICAO = exports.MAX_ADMINS_ORGAO = exports.MAX_COMPETENCIAS = exports.MAX_NIVEIS = exports.MAX_ORGAOS = exports.NATUREZAS = void 0;
exports.sanitizeCompetencias = sanitizeCompetencias;
exports.sanitizeComposicao = sanitizeComposicao;
exports.composicaoEm = composicaoEm;
exports.conferirComposicao = conferirComposicao;
exports.sanitizeOrgao = sanitizeOrgao;
exports.orgaosDe = orgaosDe;
exports.orgaosAdministrados = orgaosAdministrados;
exports.conferirDelegado = conferirDelegado;
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
/** Admins delegados por órgão interno. */
exports.MAX_ADMINS_ORGAO = 10;
const MAX_COMPETENCIA = 300;
/** Entradas da composição de um colegiado, contando os mandatos que já acabaram. */
exports.MAX_COMPOSICAO = 40;
exports.FUNCOES_COLEGIADO = ['presidente', 'vice', 'titular', 'suplente'];
/** Lista de competências ou atribuições: textos curtos, sem repetição. */
function sanitizeCompetencias(raw) {
    const lista = (Array.isArray(raw) ? raw : []).map((x) => (0, secretaria_1.texto)(x, MAX_COMPETENCIA)).filter(Boolean);
    return [...new Set(lista)].slice(0, exports.MAX_COMPETENCIAS);
}
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const data = (v) => (typeof v === 'string' && DATA.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : '');
/** Lista da composição com os tipos certos; entrada sem pessoa é descartada (nunca lança). */
function sanitizeComposicao(raw) {
    return (Array.isArray(raw) ? raw : []).map((x) => {
        const m = (x && typeof x === 'object' ? x : {});
        return {
            uid: typeof m.uid === 'string' ? m.uid.slice(0, 128) : '',
            funcao: exports.FUNCOES_COLEGIADO.includes(m.funcao) ? m.funcao : 'titular',
            inicio: data(m.inicio),
            fim: data(m.fim),
            representa: (0, secretaria_1.texto)(m.representa, 80),
        };
    }).filter((m) => m.uid).slice(0, exports.MAX_COMPOSICAO);
}
/** O mandato vale na data (AAAA-MM-DD)? */
const vigente = (m, dia) => (!m.inicio || m.inicio <= dia) && (!m.fim || m.fim >= dia);
exports.vigente = vigente;
/** Quem compõe o colegiado na data, do presidente aos suplentes. */
function composicaoEm(composicao, dia) {
    return composicao.filter((m) => (0, exports.vigente)(m, dia)).sort((a, b) => exports.FUNCOES_COLEGIADO.indexOf(a.funcao) - exports.FUNCOES_COLEGIADO.indexOf(b.funcao));
}
const cruzam = (a, b) => (!a.inicio || !b.fim || a.inicio <= b.fim) && (!b.inicio || !a.fim || b.inicio <= a.fim);
/**
 * Confere a composição ao gravar: fim depois do início, a mesma pessoa uma
 * vez só em cada período e um presidente e um vice por vez. Lança com a
 * explicação; `nome(uid)` dá o nome para a mensagem.
 */
function conferirComposicao(composicao, nome = (u) => u) {
    composicao.forEach((m, i) => {
        if (m.inicio && m.fim && m.fim < m.inicio)
            throw new Error(`O mandato de ${nome(m.uid)} termina antes de começar`);
        for (const o of composicao.slice(i + 1)) {
            if (!cruzam(m, o))
                continue;
            if (o.uid === m.uid)
                throw new Error(`${nome(m.uid)} aparece duas vezes no mesmo período. Encerre um mandato antes de começar o outro.`);
            if (o.funcao === m.funcao && (m.funcao === 'presidente' || m.funcao === 'vice')) {
                throw new Error(`Há dois ${m.funcao === 'presidente' ? 'presidentes' : 'vice-presidentes'} no mesmo período (${nome(m.uid)} e ${nome(o.uid)})`);
            }
        }
    });
    return composicao;
}
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
        admins_uids: [...new Set((Array.isArray(o.admins_uids) ? o.admins_uids : []).filter((x) => typeof x === 'string' && !!x).map((x) => x.slice(0, 128)))].slice(0, exports.MAX_ADMINS_ORGAO),
        competencias: sanitizeCompetencias(o.competencias),
        composicao: sanitizeComposicao(o.composicao),
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
/**
 * Órgãos que `uid` administra por delegação: aqueles em que está em
 * `admins_uids` e todos os que ficam abaixo deles.
 */
function orgaosAdministrados(orgaos, uid) {
    const porId = new Map(orgaos.map((o) => [o.id, o]));
    return orgaos.filter((o) => {
        // O contador protege de ciclo em dado antigo (validarEstrutura já o recusa ao gravar).
        for (let a = o, n = 0; a && n <= orgaos.length; a = a.pai_id ? porId.get(a.pai_id) : undefined, n++) {
            if (a.admins_uids.includes(uid))
                return true;
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
function conferirDelegado(atuais, uid, novo) {
    const meus = new Set(orgaosAdministrados(atuais, uid));
    const atual = atuais.find((o) => o.id === novo.id);
    if (atual && !meus.has(atual.id))
        throw new Error('Você não administra este órgão interno');
    const raiz = !!atual && !(atual.pai_id && meus.has(atual.pai_id));
    if (raiz) {
        const mesmos = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
        if ((novo.pai_id || null) !== (atual.pai_id || null))
            throw new Error('Só o admin da entidade muda o órgão superior deste órgão');
        if (!mesmos(novo.admins_uids, atual.admins_uids))
            throw new Error('Só o admin da entidade muda quem administra este órgão');
        return;
    }
    if (!novo.pai_id || !meus.has(novo.pai_id))
        throw new Error('Escolha como superior um órgão que você administra');
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