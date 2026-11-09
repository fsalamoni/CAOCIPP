"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ITENS = exports.MAX_PRAZO_DIAS = exports.MAX_FERIADOS = exports.MAX_DELTA_CHARS = exports.TIPOS_ARQUIVO_PERMITIDOS = exports.MAX_FASES = exports.MAX_UPLOAD_BYTES = exports.MAX_TEXTO_LONGO = exports.MAX_TEXTO_CURTO = exports.MAX_LOTACOES = exports.TIPOS_UNIDADE = void 0;
exports.texto = texto;
exports.slug = slug;
exports.sanitizeRito = sanitizeRito;
exports.fasesSeguintes = fasesSeguintes;
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
exports.sanitizeCalendario = sanitizeCalendario;
exports.emRecesso = emRecesso;
exports.pascoa = pascoa;
exports.feriadosNacionais = feriadosNacionais;
exports.diaUtil = diaUtil;
exports.calcularVencimento = calcularVencimento;
exports.somarDias = somarDias;
exports.hojeBrasil = hojeBrasil;
exports.derivados = derivados;
exports.tipoUnidade = tipoUnidade;
exports.sanitizeLotacoes = sanitizeLotacoes;
exports.lotacoesDe = lotacoesDe;
exports.documentoEfetivo = documentoEfetivo;
const crypto_1 = require("crypto");
exports.TIPOS_UNIDADE = ['secretaria', 'gabinete', 'assessoria', 'outra'];
exports.MAX_LOTACOES = 200;
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
    // O id que o cliente mandou (referenciado em `proximas`) vira o id final.
    const ids = new Map();
    const brutas = fasesIn.map((f, i) => {
        const fo = (f && typeof f === 'object' ? f : {});
        const nomeFase = texto(fo.nome);
        if (!nomeFase)
            throw new Error(`A fase ${i + 1} está sem nome`);
        const original = texto(fo.id, 40);
        let id = slug(original || nomeFase);
        while (vistos.has(id))
            id = `${id}_${i}`;
        vistos.add(id);
        if (original)
            ids.set(original, id);
        return { fo, id, nomeFase };
    });
    const fases = brutas.map(({ fo, id, nomeFase }) => {
        const prazo = Number(fo.prazo_dias);
        const orientacao = texto(fo.orientacao, exports.MAX_TEXTO_LONGO);
        const final = fo.final === true;
        const proximas = !final && Array.isArray(fo.proximas)
            ? [...new Set(fo.proximas.map((x) => {
                    var _a;
                    const alvo = (_a = ids.get(String(x))) !== null && _a !== void 0 ? _a : (vistos.has(String(x)) ? String(x) : null);
                    if (!alvo)
                        throw new Error(`A fase "${nomeFase}" aponta para uma fase que não existe`);
                    if (alvo === id)
                        throw new Error(`A fase "${nomeFase}" não pode seguir para ela mesma`);
                    return alvo;
                }))]
            : [];
        return Object.assign(Object.assign(Object.assign(Object.assign({ id, nome: nomeFase }, (Number.isInteger(prazo) && prazo > 0 && prazo <= 3650 ? { prazo_dias: prazo } : {})), (orientacao ? { orientacao } : {})), (proximas.length ? { proximas } : {})), (final ? { final: true } : {}));
    });
    return { nome, descricao: texto(src.descricao, exports.MAX_TEXTO_LONGO), fases };
}
/**
 * Fases para onde o processo segue a partir da atual: as `proximas` da fase,
 * ou a seguinte da lista. Ir para outra fase é possível, mas fica registrado
 * como fora do fluxo e exige justificativa.
 */
function fasesSeguintes(fases, atualId) {
    var _a;
    const i = fases.findIndex((f) => f.id === atualId);
    if (i < 0)
        return [];
    const atual = fases[i];
    if (atual.final)
        return [];
    if ((_a = atual.proximas) === null || _a === void 0 ? void 0 : _a.length)
        return atual.proximas.map((id) => fases.find((f) => f.id === id)).filter((f) => !!f);
    return i < fases.length - 1 ? [fases[i + 1]] : [];
}
/** Fase seguinte no fluxo (a primeira, se houver ramificação), ou null. */
function proximaFase(rito, faseAtualId) {
    return fasesSeguintes(rito.fases, faseAtualId)[0] || null;
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
exports.MAX_FERIADOS = 200;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (v) => typeof v === 'string' && DATA_ISO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
function sanitizeCalendario(input) {
    const o = (input && typeof input === 'object' ? input : {});
    const feriados = (Array.isArray(o.feriados) ? o.feriados : [])
        .map((f) => (f && typeof f === 'object' ? f : {}))
        .filter((f) => dataValida(f.data))
        .map((f) => ({ data: String(f.data), descricao: texto(f.descricao, 80) }));
    const unicos = [...new Map(feriados.map((f) => [f.data, f])).values()].sort((a, b) => a.data.localeCompare(b.data)).slice(0, exports.MAX_FERIADOS);
    const recessos = (Array.isArray(o.recessos) ? o.recessos : [])
        .map((r) => (r && typeof r === 'object' ? r : {}))
        .filter((r) => dataValida(r.inicio) && dataValida(r.fim) && String(r.inicio) <= String(r.fim))
        .filter((r) => (Date.parse(String(r.fim)) - Date.parse(String(r.inicio))) / 86400000 <= 120)
        .map((r) => ({ inicio: String(r.inicio), fim: String(r.fim), descricao: texto(r.descricao, 80) }))
        .slice(0, 50);
    return { feriados: unicos, recessos, recesso_forense: o.recesso_forense === true };
}
/** Dia em que os prazos ficam suspensos pelo recesso do órgão. */
function emRecesso(d, cal) {
    if (!cal)
        return false;
    const s = iso(d);
    const md = s.slice(5);
    if (cal.recesso_forense && (md >= '12-20' || md <= '01-20'))
        return true;
    return (cal.recessos || []).some((r) => s >= r.inicio && s <= r.fim);
}
exports.MAX_PRAZO_DIAS = 3650;
exports.MAX_ITENS = 200;
function iso(d) {
    return d.toISOString().slice(0, 10);
}
/** Domingo de Páscoa (algoritmo de Meeus/Butcher), em UTC. */
function pascoa(ano) {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    return new Date(Date.UTC(ano, Math.floor(n / 31) - 1, (n % 31) + 1));
}
const FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];
function feriadosNacionais(ano) {
    const p = pascoa(ano).getTime();
    // Carnaval (segunda e terça), Sexta-feira Santa, Corpus Christi.
    const moveis = [-48, -47, -2, 60].map((n) => iso(new Date(p + n * 86400000)));
    return new Set([...FIXOS.map((f) => `${ano}-${f}`), ...moveis]);
}
function diaUtil(d, cal) {
    var _a;
    const w = d.getUTCDay();
    if (w === 0 || w === 6)
        return false;
    const s = iso(d);
    if (feriadosNacionais(d.getUTCFullYear()).has(s))
        return false;
    if ((_a = cal === null || cal === void 0 ? void 0 : cal.feriados) === null || _a === void 0 ? void 0 : _a.some((f) => f.data === s))
        return false;
    return !emRecesso(d, cal);
}
/** Data de vencimento (AAAA-MM-DD) de um prazo aberto em `inicio` (AAAA-MM-DD). */
function calcularVencimento(inicio, dias, contagem, cal) {
    const d = new Date(`${inicio}T00:00:00Z`);
    let restantes = dias;
    while (restantes > 0) {
        d.setUTCDate(d.getUTCDate() + 1);
        // Recesso suspende o prazo também em dias corridos.
        if (contagem === 'corridos' ? !emRecesso(d, cal) : diaUtil(d, cal))
            restantes--;
    }
    while (!diaUtil(d, cal))
        d.setUTCDate(d.getUTCDate() + 1);
    return iso(d);
}
/** AAAA-MM-DD somado de n dias corridos. */
function somarDias(data, n) {
    const d = new Date(`${data}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return iso(d);
}
/** Hoje no fuso de Brasília, AAAA-MM-DD. */
function hojeBrasil(agora = new Date()) {
    return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
/** Campos derivados gravados no processo, para listas e filtros. */
function derivados(pendencias, prazos) {
    const abertas = pendencias.filter((p) => p.status === 'aberta');
    const vencimentos = prazos.filter((p) => p.status === 'aberto').map((p) => p.vence_em).sort();
    return {
        pendencias_abertas: abertas.length,
        fase_suspensa: abertas.some((p) => p.interrompe),
        proximo_vencimento: vencimentos[0] || null,
    };
}
function tipoUnidade(v) {
    return exports.TIPOS_UNIDADE.includes(v) ? v : 'secretaria';
}
/** Lotações saneadas (sem repetição de pessoa). */
function sanitizeLotacoes(input) {
    const vistos = new Set();
    const out = [];
    for (const l of Array.isArray(input) ? input : []) {
        const o = (l && typeof l === 'object' ? l : {});
        const uid = texto(o.uid, 128);
        if (!uid || vistos.has(uid))
            continue;
        vistos.add(uid);
        out.push({ uid, atribuicao: texto(o.atribuicao, 80), gestor: o.gestor === true });
        if (out.length >= exports.MAX_LOTACOES)
            break;
    }
    return out;
}
/**
 * Lotações da unidade. Unidades criadas antes das lotações só têm
 * `membros_uids`: cada uid vira lotação sem atribuição e sem gestão.
 */
function lotacoesDe(u) {
    if (Array.isArray(u.lotacoes))
        return sanitizeLotacoes(u.lotacoes);
    return sanitizeLotacoes((Array.isArray(u.membros_uids) ? u.membros_uids : []).map((uid) => ({ uid })));
}
/**
 * Papel timbrado efetivo de uma unidade: o próprio, se ela tiver, ou o do
 * órgão. Tipos de documento da unidade somam-se aos do órgão.
 */
function documentoEfetivo(orgao, unidade) {
    const base = (unidade === null || unidade === void 0 ? void 0 : unidade.timbrado_proprio) && unidade.documento ? Object.assign(Object.assign({}, orgao), unidade.documento) : Object.assign({}, orgao);
    const doOrgao = orgao.tipos_documento || [];
    const tipos = [...new Set([...doOrgao, ...((unidade === null || unidade === void 0 ? void 0 : unidade.tipos_documento) || [])])];
    return Object.assign(Object.assign({}, base), { tipos_documento: tipos });
}
//# sourceMappingURL=secretaria.js.map