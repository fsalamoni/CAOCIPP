"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_DELTA_CHARS = exports.TIPOS_ARQUIVO_PERMITIDOS = exports.MAX_FASES = exports.MAX_UPLOAD_BYTES = exports.MAX_TEXTO_LONGO = exports.MAX_TEXTO_CURTO = void 0;
exports.texto = texto;
exports.slug = slug;
exports.sanitizeRito = sanitizeRito;
exports.proximaFase = proximaFase;
exports.podeAgir = podeAgir;
exports.podeVer = podeVer;
exports.numeroProcesso = numeroProcesso;
exports.jsonCanonico = jsonCanonico;
exports.sha256 = sha256;
exports.hashMovimento = hashMovimento;
exports.verificarCadeia = verificarCadeia;
exports.sanitizeDelta = sanitizeDelta;
exports.deltaParaTexto = deltaParaTexto;
const crypto_1 = require("crypto");
exports.MAX_TEXTO_CURTO = 200;
exports.MAX_TEXTO_LONGO = 4000;
exports.MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
exports.MAX_FASES = 30;
exports.TIPOS_ARQUIVO_PERMITIDOS = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'text/plain': 'txt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/msword': 'doc',
    'application/vnd.oasis.opendocument.text': 'odt',
};
function texto(v, max = exports.MAX_TEXTO_CURTO) {
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
function slug(v) {
    return v
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'fase';
}
/** Saneia um rito vindo do cliente. Lança Error com mensagem para o usuário. */
function sanitizeRito(input) {
    const src = (input && typeof input === 'object' ? input : {});
    const nome = texto(src.nome);
    if (!nome)
        throw new Error('O rito precisa de um nome');
    const fasesIn = Array.isArray(src.fases) ? src.fases : [];
    if (fasesIn.length === 0)
        throw new Error('O rito precisa de ao menos uma fase');
    if (fasesIn.length > exports.MAX_FASES)
        throw new Error(`O rito aceita no máximo ${exports.MAX_FASES} fases`);
    const vistos = new Set();
    const fases = fasesIn.map((f, i) => {
        const fo = (f && typeof f === 'object' ? f : {});
        const nomeFase = texto(fo.nome);
        if (!nomeFase)
            throw new Error(`A fase ${i + 1} está sem nome`);
        let id = texto(fo.id, 40) || slug(nomeFase);
        while (vistos.has(id))
            id = `${id}_${i}`;
        vistos.add(id);
        const prazo = Number(fo.prazo_dias);
        return Object.assign({ id, nome: nomeFase }, (Number.isInteger(prazo) && prazo > 0 && prazo <= 3650 ? { prazo_dias: prazo } : {}));
    });
    return { nome, descricao: texto(src.descricao, exports.MAX_TEXTO_LONGO), fases };
}
/** Fase seguinte no rito, ou null se a atual é a última (ou não existe). */
function proximaFase(rito, faseAtualId) {
    const i = rito.fases.findIndex((f) => f.id === faseAtualId);
    if (i < 0 || i >= rito.fases.length - 1)
        return null;
    return rito.fases[i + 1];
}
/** Quem tem o processo consigo: lotados na unidade que detém a posse. */
function podeAgir(proc, ctx) {
    return ctx.unidadeIds.includes(proc.unidade_atual);
}
/**
 * Quem pode ler os autos:
 *   - administrador da Secretaria do órgão: todos;
 *   - sigilo normal: qualquer usuário lotado em alguma unidade do órgão;
 *   - sigilo restrito: só unidades por onde o processo passou.
 */
function podeVer(proc, ctx) {
    if (ctx.isAdmin)
        return true;
    if (podeAgir(proc, ctx))
        return true;
    if (ctx.unidadeIds.length === 0)
        return false;
    if (proc.sigilo === 'restrito') {
        const hist = proc.unidades_historico || [];
        return ctx.unidadeIds.some((u) => hist.includes(u));
    }
    return true;
}
function numeroProcesso(ano, seq) {
    return `${String(seq).padStart(6, '0')}/${ano}`;
}
/** JSON com chaves ordenadas: o mesmo conteúdo sempre gera o mesmo texto. */
function jsonCanonico(v) {
    if (v === null || typeof v !== 'object')
        return JSON.stringify(v !== null && v !== void 0 ? v : null);
    if (Array.isArray(v))
        return `[${v.map(jsonCanonico).join(',')}]`;
    const obj = v;
    const chaves = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${jsonCanonico(obj[k])}`).join(',')}}`;
}
function sha256(dado) {
    return (0, crypto_1.createHash)('sha256').update(dado).digest('hex');
}
function hashMovimento(m) {
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
function verificarCadeia(movs) {
    let anterior = '';
    const ordenados = [...movs].sort((a, b) => a.seq - b.seq);
    for (const m of ordenados) {
        if (m.hash_anterior !== anterior || hashMovimento(m) !== m.hash)
            return m.seq;
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
const ATRIBUTOS_PERMITIDOS = {
    bold: (v) => v === true,
    italic: (v) => v === true,
    underline: (v) => v === true,
    header: (v) => v === 1 || v === 2 || v === 3,
    list: (v) => v === 'ordered' || v === 'bullet',
    align: (v) => v === 'center' || v === 'right' || v === 'justify',
    blockquote: (v) => v === true,
    indent: (v) => Number.isInteger(v) && v >= 1 && v <= 8,
};
exports.MAX_DELTA_CHARS = 400000;
function sanitizeDelta(input) {
    var _a;
    const src = input && typeof input === 'object' ? input : {};
    const ops = Array.isArray(src.ops) ? src.ops : Array.isArray(input) ? input : [];
    const out = [];
    let total = 0;
    for (const op of ops) {
        const o = (op && typeof op === 'object' ? op : {});
        if (typeof o.insert !== 'string')
            continue; // descarta embeds
        total += o.insert.length;
        if (total > exports.MAX_DELTA_CHARS)
            throw new Error('Documento grande demais para o editor');
        const attrsIn = (o.attributes && typeof o.attributes === 'object' ? o.attributes : {});
        const attrs = {};
        for (const [k, v] of Object.entries(attrsIn)) {
            if ((_a = ATRIBUTOS_PERMITIDOS[k]) === null || _a === void 0 ? void 0 : _a.call(ATRIBUTOS_PERMITIDOS, v))
                attrs[k] = v;
        }
        out.push(Object.keys(attrs).length ? { insert: o.insert, attributes: attrs } : { insert: o.insert });
    }
    return out;
}
/** Texto puro do Delta (para PDF e busca). */
function deltaParaTexto(ops) {
    return ops.map((o) => o.insert).join('');
}
//# sourceMappingURL=secretaria.js.map