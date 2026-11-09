"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.campoConhecido = exports.MAX_MODELO_BYTES = exports.MIMES_ORIGINAL = exports.MIMES_MODELO = exports.MIME_PDF = void 0;
exports.normalizarCampos = normalizarCampos;
exports.linhasXml = linhasXml;
exports.preencherDocx = preencherDocx;
exports.textoDePdf = textoDePdf;
exports.textoParaRito = textoParaRito;
exports.interpretarModelo = interpretarModelo;
const mammoth = require("mammoth");
const JSZip = require("jszip");
const url_1 = require("url");
const documento_1 = require("../shared/documento");
const conversao_1 = require("./conversao");
const documentoConfig_1 = require("./documentoConfig");
/**
 * Importação de modelos de documento (sem IA, por leitura estruturada):
 * - Word (DOCX): corpo pelo mammoth (com imagens), cabeçalho e rodapé lidos do
 *   XML do pacote (texto e primeira imagem como brasão), fonte e tamanho padrão.
 * - PDF: texto por linha (pdfjs), com cabeçalho e rodapé tirados das faixas de
 *   cima e de baixo da primeira página. Imagens do PDF não são extraídas.
 * - HTML e TXT: corpo.
 * Campos como {{numero}}, «Número», <<data>> ou [NÚMERO DO PROCESSO] viram os
 * campos automáticos do editor quando o nome é conhecido.
 * O modelo também pode ficar no arquivo original (DOCX ou PDF); o DOCX sai
 * preenchido com os dados do processo por `preencherDocx`.
 */
exports.MIME_PDF = 'application/pdf';
exports.MIMES_MODELO = {
    [conversao_1.MIME_DOCX]: 'docx', [exports.MIME_PDF]: 'pdf', 'text/html': 'html', 'text/plain': 'txt',
};
exports.MIMES_ORIGINAL = [conversao_1.MIME_DOCX, exports.MIME_PDF];
exports.MAX_MODELO_BYTES = 5 * 1024 * 1024;
// ---------- campos ----------
const sem = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const APELIDOS = {};
for (const [chave, nomes] of Object.entries({
    numero: ['numero', 'n', 'no', 'num', 'numero_processo', 'numero_do_processo', 'processo', 'n_processo', 'n_do_processo', 'autos', 'numero_dos_autos'],
    assunto: ['assunto', 'objeto', 'assunto_do_processo'],
    tipo_processo: ['tipo', 'tipo_processo', 'tipo_de_processo', 'classe', 'classe_processual'],
    partes: ['partes', 'parte', 'interessado', 'interessados', 'requerente', 'requerentes', 'nome_da_parte'],
    unidade: ['unidade', 'setor', 'unidade_atual', 'secretaria', 'gabinete', 'lotacao'],
    fase: ['fase', 'fase_atual', 'etapa'],
    orgao: ['orgao', 'instituicao', 'nome_do_orgao', 'entidade'],
    usuario: ['usuario', 'seu_nome', 'nome_usuario', 'servidor', 'signatario', 'assinante', 'responsavel', 'nome_do_servidor'],
    data: ['data', 'data_atual', 'hoje', 'data_de_hoje'],
    data_extenso: ['data_extenso', 'data_por_extenso', 'data_extensa'],
}))
    for (const n of nomes)
        APELIDOS[n] = chave;
/** Chave do campo automático para um nome de campo do arquivo, ou null. */
const campoConhecido = (nome) => APELIDOS[sem(nome)] || null;
exports.campoConhecido = campoConhecido;
// {{x}} ${x} «x» <<x>> e [X] (este só com nome conhecido, para não pegar citações).
const RE_CAMPO = /\{\{\s*([^{}]{1,60}?)\s*\}\}|\$\{\s*([^{}]{1,60}?)\s*\}|«\s*([^«»]{1,60}?)\s*»|<<\s*([^<>]{1,60}?)\s*>>|\[\s*([^[\]]{1,60}?)\s*\]/g;
/** Troca as variantes de campo pelo formato {{chave}} do editor. */
function normalizarCampos(t, achados, desconhecidos) {
    return t.replace(RE_CAMPO, (m, a, b, c, d, e) => {
        var _a, _b, _c;
        const nome = (_c = (_b = (_a = a !== null && a !== void 0 ? a : b) !== null && _a !== void 0 ? _a : c) !== null && _b !== void 0 ? _b : d) !== null && _c !== void 0 ? _c : e;
        const chave = (0, exports.campoConhecido)(nome);
        if (chave) {
            achados.add(chave);
            return `{{${chave}}}`;
        }
        if (e !== undefined)
            return m; // [texto] qualquer fica como está
        const k = sem(nome);
        if (!k)
            return m;
        desconhecidos.add(nome.trim());
        return `{{${k}}}`;
    });
}
function camposNoDoc(doc, achados, desconhecidos) {
    const andar = (n) => (n.type === 'text' && typeof n.text === 'string'
        ? Object.assign(Object.assign({}, n), { text: normalizarCampos(n.text, achados, desconhecidos) }) : Array.isArray(n.content) ? Object.assign(Object.assign({}, n), { content: n.content.map(andar) }) : n);
    return andar(doc);
}
// ---------- DOCX ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const desXml = (s) => s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-f]+);/gi, (_m, n, d, h) => (n ? ENT[n] : String.fromCodePoint(d ? Number(d) : parseInt(h, 16))));
const escXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Linhas de texto dos parágrafos de um XML do Word (cabeçalho ou rodapé). */
function linhasXml(xml) {
    return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map((p) => desXml((p.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>|<w:tab\/>/g) || []).map((t) => (t === '<w:tab/>' ? ' ' : t.replace(/<[^>]+>/g, ''))).join('')).replace(/\s+/g, ' ').trim()).filter(Boolean);
}
const ehNumeroPagina = (l) => /^(p[aá]g(ina)?\.?\s*)?\d+(\s*(de|\/)\s*\d+)?$/i.test(l);
function relacoes(xml) {
    var _a, _b;
    const out = {};
    for (const m of (xml || '').matchAll(/<Relationship\b[^>]*>/g)) {
        const id = (_a = /Id="([^"]+)"/.exec(m[0])) === null || _a === void 0 ? void 0 : _a[1];
        const alvo = (_b = /Target="([^"]+)"/.exec(m[0])) === null || _b === void 0 ? void 0 : _b[1];
        if (id && alvo)
            out[id] = alvo;
    }
    return out;
}
const caminho = (base, alvo) => (alvo.startsWith('/') ? alvo.slice(1) : `${base}/${alvo}`).replace(/[^/]+\/\.\.\//g, '');
async function parteDocx(zip, docXml, rels, tipo) {
    var _a;
    const sect = ((_a = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g)) === null || _a === void 0 ? void 0 : _a.pop()) || '';
    const ref = new RegExp(`<w:${tipo}Reference[^>]*w:type="(default|first)"[^>]*r:id="([^"]+)"|<w:${tipo}Reference[^>]*r:id="([^"]+)"[^>]*w:type="(default|first)"`, 'g');
    const ids = [];
    for (const m of sect.matchAll(ref))
        ids.push({ tipo: m[1] || m[4], id: m[2] || m[3] });
    ids.sort((a, b) => (a.tipo === 'default' ? -1 : 1) - (b.tipo === 'default' ? -1 : 1));
    const nomes = ids.map((x) => rels[x.id]).filter(Boolean).map((t) => caminho('word', t));
    const arquivo = nomes.find((n) => zip.file(n)) || Object.keys(zip.files).find((n) => new RegExp(`^word/${tipo}\\d*\\.xml$`).test(n));
    if (!arquivo)
        return null;
    const xml = await zip.file(arquivo).async('string');
    return { arquivo, xml };
}
async function imagemDaParte(zip, arquivo, xml) {
    var _a, _b;
    const relsArq = arquivo.replace(/^word\/(.+)$/, 'word/_rels/$1.rels');
    const rels = relacoes(await ((_a = zip.file(relsArq)) === null || _a === void 0 ? void 0 : _a.async('string')));
    for (const m of xml.matchAll(/r:embed="([^"]+)"/g)) {
        const alvo = rels[m[1]];
        if (!alvo)
            continue;
        const nome = caminho('word', alvo);
        const ext = (_b = nome.split('.').pop()) === null || _b === void 0 ? void 0 : _b.toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : null;
        const f = zip.file(nome);
        if (!mime || !f)
            continue;
        const buf = await f.async('nodebuffer');
        if (buf.length <= documentoConfig_1.MAX_BRASAO)
            return `data:${mime};base64,${buf.toString('base64')}`;
    }
    return null;
}
async function timbradoDocx(buf, avisos) {
    var _a, _b, _c, _d, _e;
    const zip = await JSZip.loadAsync(buf);
    const docXml = await ((_a = zip.file('word/document.xml')) === null || _a === void 0 ? void 0 : _a.async('string'));
    if (!docXml)
        return null;
    const rels = relacoes(await ((_b = zip.file('word/_rels/document.xml.rels')) === null || _b === void 0 ? void 0 : _b.async('string')));
    const cab = await parteDocx(zip, docXml, rels, 'header');
    const rod = await parteDocx(zip, docXml, rels, 'footer');
    const linhas = cab ? linhasXml(cab.xml).filter((l) => !ehNumeroPagina(l)) : [];
    const brasao = cab ? await imagemDaParte(zip, cab.arquivo, cab.xml) : null;
    if (cab && !brasao && /r:embed=/.test(cab.xml))
        avisos.push('A imagem do cabeçalho não é PNG/JPG ou passa de 300 KB; envie o brasão à parte.');
    if (linhas.length > 4)
        avisos.push(`O cabeçalho tem ${linhas.length} linhas; ficaram as 4 primeiras.`);
    const rodape = rod ? linhasXml(rod.xml).filter((l) => !ehNumeroPagina(l)).join(' · ').slice(0, 200) : '';
    // Fonte e tamanho padrão do documento (docDefaults ou estilo Normal).
    const estilos = (await ((_c = zip.file('word/styles.xml')) === null || _c === void 0 ? void 0 : _c.async('string'))) || '';
    const fonte = ((_d = /<w:rFonts[^>]*w:ascii="([^"]+)"/.exec(estilos)) === null || _d === void 0 ? void 0 : _d[1]) || '';
    const sz = Number((_e = /<w:sz w:val="(\d+)"/.exec(estilos)) === null || _e === void 0 ? void 0 : _e[1]) / 2;
    const fonte_padrao = /courier|mono|consol/i.test(fonte) ? 'monospace' : /arial|helvetica|calibri|roboto|verdana|segoe|tahoma|aptos|open sans|liberation sans/i.test(fonte) ? 'sans-serif' : fonte ? 'serif' : undefined;
    if (!linhas.length && !brasao && !rodape)
        return fonte_padrao ? Object.assign({ cabecalho_linhas: [], brasao: null, rodape: '', fonte_padrao }, (sz >= 9 && sz <= 16 ? { tamanho_padrao: sz } : {})) : null;
    return Object.assign(Object.assign({ cabecalho_linhas: linhas.slice(0, 4), brasao, rodape }, (fonte_padrao ? { fonte_padrao } : {})), (sz >= 9 && sz <= 16 ? { tamanho_padrao: sz } : {}));
}
/**
 * DOCX com os campos preenchidos. Tolera o Word ter quebrado o campo em vários
 * trechos de formatação ({{ nu</w:t></w:r><w:r><w:t>mero }}): as marcações
 * entre as chaves somem e o valor fica com a formatação do primeiro trecho.
 */
async function preencherDocx(buf, valores) {
    const zip = await JSZip.loadAsync(buf);
    const tags = '(?:<[^>]+>)*';
    const re = new RegExp(`\\{${tags}\\{((?:<[^>]+>|[^<{}])*?)\\}${tags}\\}`
        + `|«((?:<[^>]+>|[^<«»])*?)»`
        + `|&lt;${tags}&lt;((?:<[^>]+>|[^<]){1,400}?)&gt;${tags}&gt;`
        + `|\\$${tags}\\{((?:<[^>]+>|[^<{}])*?)\\}`, 'g');
    for (const nome of Object.keys(zip.files).filter((n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n))) {
        const xml = await zip.file(nome).async('string');
        const novo = xml.replace(re, (m, a, b, c, d) => {
            var _a, _b, _c;
            const dentro = ((_c = (_b = (_a = a !== null && a !== void 0 ? a : b) !== null && _a !== void 0 ? _a : c) !== null && _b !== void 0 ? _b : d) !== null && _c !== void 0 ? _c : '');
            if (/<\/w:p>/.test(dentro))
                return m;
            const nomeCampo = desXml(dentro.replace(/<[^>]+>/g, ''));
            const chave = (0, exports.campoConhecido)(nomeCampo) || sem(nomeCampo);
            const v = valores[chave];
            return v === undefined || v === null ? m : escXml(String(v));
        });
        if (novo !== xml)
            zip.file(nome, novo);
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
async function linhasPdf(buf) {
    var _a;
    // pdfjs é ESM; o import dinâmico fica fora do alcance do tsc (CommonJS).
    const pdfjs = await new Function('m', 'return import(m)')((0, url_1.pathToFileURL)(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise;
    const paginas = [];
    let alturaPagina = 842;
    for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
        const pg = await doc.getPage(i);
        if (i === 1)
            alturaPagina = pg.getViewport({ scale: 1 }).height;
        const itens = (await pg.getTextContent()).items;
        const porY = new Map();
        for (const it of itens) {
            if (!it.str)
                continue;
            const y = Math.round(it.transform[5]);
            const chave = (_a = [...porY.keys()].find((k) => Math.abs(k - y) <= 2)) !== null && _a !== void 0 ? _a : y;
            porY.set(chave, [...(porY.get(chave) || []), { x: it.transform[4], s: it.str, h: it.height || Math.abs(it.transform[3]) }]);
        }
        paginas.push([...porY.entries()].sort((a, b) => b[0] - a[0]).map(([y, ps]) => {
            ps.sort((a, b) => a.x - b.x);
            return { y, x: ps[0].x, texto: ps.map((p) => p.s).join('').replace(/\s+/g, ' ').trim(), altura: Math.max(...ps.map((p) => p.h)) };
        }).filter((l) => l.texto));
    }
    await doc.destroy();
    return { paginas, alturaPagina };
}
async function interpretarPdf(buf, avisos) {
    const { paginas, alturaPagina } = await linhasPdf(buf);
    if (!paginas.some((p) => p.length))
        throw new Error('O PDF não tem texto selecionável (é imagem digitalizada); mantenha-o como arquivo original.');
    const topo = alturaPagina * 0.88;
    const base = alturaPagina * 0.08;
    // Cabeçalho e rodapé: faixas de cima e de baixo; com mais de uma página,
    // só o que se repete nelas (o primeiro texto do corpo não vira cabeçalho).
    const repetidas = (faixa) => {
        const conj = paginas.map((p) => new Set(p.filter(faixa).map((l) => l.texto)));
        return paginas[0].filter(faixa).map((l) => l.texto).filter((t) => conj.length < 2 || conj.slice(1).every((s) => s.has(t) || ehNumeroPagina(t)));
    };
    const cab = repetidas((l) => l.y >= topo).filter((t) => !ehNumeroPagina(t));
    const rod = repetidas((l) => l.y <= base).filter((t) => !ehNumeroPagina(t));
    const corpo = paginas.map((p) => p.filter((l) => !(l.y >= topo && cab.includes(l.texto)) && !(l.y <= base && (rod.includes(l.texto) || ehNumeroPagina(l.texto)))));
    // Parágrafos: linhas seguidas se juntam; espaço maior que o normal separa.
    const blocos = [];
    for (const linhas of corpo) {
        const passos = linhas.slice(1).map((l, i) => linhas[i].y - l.y).filter((d) => d > 0).sort((a, b) => a - b);
        const normal = passos[Math.floor(passos.length / 2)] || 14;
        let atual = [];
        const fechar = () => { if (atual.length)
            blocos.push({ type: 'paragraph', content: [{ type: 'text', text: atual.join(' ') }] }); atual = []; };
        linhas.forEach((l, i) => {
            if (i > 0 && linhas[i - 1].y - l.y > normal * 1.4)
                fechar();
            atual.push(l.texto);
            if (/[.:;!?]$/.test(l.texto) && l.texto.length < 60)
                fechar();
        });
        fechar();
    }
    avisos.push('PDF: o texto foi lido por linha; negrito, tabelas e imagens do PDF não vêm. Confira a formatação ou mantenha o PDF original.');
    const timbrado = cab.length || rod.length ? { cabecalho_linhas: cab.slice(0, 4), brasao: null, rodape: rod.join(' · ').slice(0, 200) } : null;
    return { doc: { type: 'doc', content: blocos.length ? blocos : [{ type: 'paragraph' }] }, timbrado };
}
/** Texto de um PDF, uma linha por linha visual e página separada por linha vazia. */
async function textoDePdf(buf) {
    const { paginas } = await linhasPdf(buf);
    return paginas.map((p) => p.map((l) => l.texto).join('\n')).join('\n\n');
}
/**
 * Texto e tabelas de um arquivo que descreve um rito (Word, PDF ou TXT), para
 * a leitura de fases no navegador (src/lib/propostaRito.js).
 */
async function textoParaRito(buf, mime) {
    if (mime === conversao_1.MIME_DOCX) {
        const [raw, html] = await Promise.all([mammoth.extractRawText({ buffer: buf }), mammoth.convertToHtml({ buffer: buf })]);
        const tabelas = (html.value.match(/<table[\s\S]*?<\/table>/g) || []).slice(0, 10).map((t) => (t.match(/<tr[\s\S]*?<\/tr>/g) || []).slice(0, 200).map((tr) => (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || []).slice(0, 20).map((c) => desXml(c.replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').trim())));
        return { texto: raw.value, tabelas };
    }
    if (mime === exports.MIME_PDF)
        return { texto: await textoDePdf(buf), tabelas: [] };
    return { texto: buf.toString('utf8'), tabelas: [] };
}
// ---------- entrada ----------
async function interpretarModelo(buf, mime) {
    const formato = exports.MIMES_MODELO[mime];
    if (!formato)
        throw new Error('Formato não aceito para modelo (use Word .docx, PDF, HTML ou TXT)');
    if (!buf.length)
        throw new Error('Arquivo vazio');
    if (buf.length > exports.MAX_MODELO_BYTES)
        throw new Error('Arquivo acima de 5 MB');
    const avisos = [];
    let doc;
    let timbrado = null;
    if (formato === 'docx') {
        const r = await mammoth.convertToHtml({ buffer: buf });
        doc = (0, conversao_1.htmlParaDoc)(r.value);
        try {
            timbrado = await timbradoDocx(buf, avisos);
        }
        catch (_a) {
            avisos.push('Não deu para ler o cabeçalho e o rodapé do Word.');
        }
        avisos.push('Word: alinhamentos, recuos e cores podem precisar de ajuste no editor.');
    }
    else if (formato === 'pdf') {
        ({ doc, timbrado } = await interpretarPdf(buf, avisos));
    }
    else if (formato === 'html') {
        doc = (0, conversao_1.htmlParaDoc)(buf.toString('utf8').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ''));
    }
    else {
        const paras = buf.toString('utf8').replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
        doc = { type: 'doc', content: paras.length ? paras.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })) : [{ type: 'paragraph' }] };
    }
    const achados = new Set();
    const desconhecidos = new Set();
    const conteudo = (0, documento_1.sanitizeDoc)(camposNoDoc(doc, achados, desconhecidos));
    if (timbrado) {
        const ach = new Set();
        timbrado.cabecalho_linhas = timbrado.cabecalho_linhas.map((l) => normalizarCampos(l, ach, new Set()));
    }
    if (desconhecidos.size)
        avisos.push(`Campos sem correspondência (ficam como texto para preencher à mão): ${[...desconhecidos].slice(0, 10).join(', ')}.`);
    return { conteudo, timbrado, campos: [...achados], desconhecidos: [...desconhecidos], avisos };
}
//# sourceMappingURL=importarModelo.js.map