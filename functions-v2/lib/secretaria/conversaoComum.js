"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filho = void 0;
exports.xml = xml;
exports.filhos = filhos;
exports.ligado = ligado;
exports.novoOrcamento = novoOrcamento;
exports.agruparListas = agruparListas;
// Peças comuns dos conversores de Word e LibreOffice para o editor.
const xmldom = () => require('@xmldom/xmldom');
const sharp = (...a) => require('sharp')(...a);
const documento_1 = require("../shared/documento");
/** XML → documento (sem avisos no console por XML imperfeito). */
function xml(s) {
    const silencio = { warning: () => undefined, error: () => undefined, fatalError: (e) => { throw new Error(`XML inválido: ${String(e)}`); } };
    return new (xmldom().DOMParser)({ errorHandler: silencio }).parseFromString(s, 'text/xml');
}
/** Filhos-elemento (todos, ou só os de um nome). */
function filhos(el, nome) {
    const out = [];
    if (!el)
        return out;
    for (let i = 0; i < el.childNodes.length; i++) {
        const c = el.childNodes[i];
        if (c.nodeType === 1 && (!nome || c.tagName === nome))
            out.push(c);
    }
    return out;
}
const filho = (el, nome) => filhos(el, nome)[0] || null;
exports.filho = filho;
/** Liga/desliga do Word (<w:b/>, <w:b w:val="0"/>); undefined se o elemento não existe. */
function ligado(el) {
    if (!el)
        return undefined;
    const v = el.getAttribute('w:val');
    return v === null || v === '' || !['0', 'false', 'off', 'none'].includes(v);
}
/**
 * Imagens do arquivo como PNG/JPEG embutidos, dentro do limite do editor:
 * cada uma até 1,4 MB e todas juntas cabendo no documento (as primeiras com
 * mais qualidade; se o total apertar, as seguintes saem menores).
 */
function novoOrcamento() {
    const TOTAL = Math.floor(documento_1.MAX_DOC_BYTES * 0.7 * 0.75); // base64 cresce 4/3; sobra espaço para o texto
    const POR_IMAGEM = Math.min(documento_1.MAX_IMAGEM_BYTES * 0.93, 1.4 * 1024 * 1024);
    let usado = 0;
    const avisos = new Set();
    return {
        get avisos() { return [...avisos]; },
        async incluir(buf, nome) {
            if (/\.(emf|wmf|emz|wmz)$/i.test(nome)) {
                avisos.add('Desenhos em formato antigo do Office (EMF/WMF) não vieram; copie-os como imagem se precisar.');
                return null;
            }
            try {
                const meta = await sharp(buf, { failOn: 'none' }).metadata();
                const alfa = !!meta.hasAlpha;
                const restante = TOTAL - usado;
                if (restante < 30 * 1024) {
                    avisos.add('Algumas imagens não vieram: o documento chegou ao limite de imagens do editor.');
                    return null;
                }
                const limite = Math.min(POR_IMAGEM, restante);
                for (const [lado, q] of [[1600, 85], [1200, 75], [900, 65], [600, 55]]) {
                    const base = () => sharp(buf, { failOn: 'none' }).rotate().resize({ width: lado, height: lado, fit: 'inside', withoutEnlargement: true });
                    const png = alfa || meta.format === 'png' ? await base().png({ compressionLevel: 9, palette: false }).toBuffer() : null;
                    const jpg = alfa ? null : await base().flatten({ background: '#ffffff' }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
                    const melhor = [png && { b: png, m: 'png' }, jpg && { b: jpg, m: 'jpeg' }].filter(Boolean).sort((a, b) => a.b.length - b.b.length)[0];
                    if (melhor.b.length <= limite) {
                        usado += melhor.b.length;
                        const largura = (await sharp(melhor.b).metadata()).width || lado;
                        return { src: `data:image/${melhor.m};base64,${melhor.b.toString('base64')}`, largura };
                    }
                }
                avisos.add('Uma imagem muito grande não coube no editor.');
                return null;
            }
            catch (_a) {
                avisos.add('Alguma imagem do arquivo não pôde ser lida.');
                return null;
            }
        },
    };
}
/** Parágrafos numerados seguidos viram listas (aninhadas pelo nível). */
function agruparListas(itens) {
    const out = [];
    let i = 0;
    const construir = (nivel, chave) => {
        const primeiro = itens[i].lista;
        const lista = { type: primeiro.ordenada ? 'orderedList' : 'bulletList', content: [] };
        if (primeiro.ordenada && primeiro.inicio > 1)
            lista.attrs = { start: primeiro.inicio };
        while (i < itens.length && itens[i].lista && itens[i].lista.ilvl >= nivel) {
            const l = itens[i].lista;
            if (l.ilvl === nivel) {
                if (l.chave !== chave)
                    break;
                const no = itens[i].no.type === 'paragraph' ? itens[i].no : { type: 'paragraph', content: itens[i].no.content };
                lista.content.push({ type: 'listItem', content: [no] });
                i++;
            }
            else {
                const ultimo = lista.content[lista.content.length - 1] || (lista.content.push({ type: 'listItem', content: [{ type: 'paragraph' }] }), lista.content[0]);
                ultimo.content.push(construir(l.ilvl, l.chave));
            }
        }
        return lista;
    };
    while (i < itens.length) {
        const it = itens[i];
        if (!it.lista) {
            out.push(it.no);
            i++;
            continue;
        }
        out.push(construir(it.lista.ilvl, it.lista.chave));
    }
    return out;
}
//# sourceMappingURL=conversaoComum.js.map