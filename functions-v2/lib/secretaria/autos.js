"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textoFolhas = exports.urlConferencia = exports.APP_URL = exports.caminhoPdf = void 0;
exports.lerConfigDocumento = lerConfigDocumento;
exports.conteudoDoDocumento = conteudoDoDocumento;
exports.paginasDeArquivo = paginasDeArquivo;
exports.folhaSimples = folhaSimples;
exports.pdfDoDocumento = pdfDoDocumento;
exports.novoCodigo = novoCodigo;
exports.normalizarCodigo = normalizarCodigo;
exports.registroVerificacao = registroVerificacao;
exports.garantirCodigo = garantirCodigo;
exports.anexarCarimbado = anexarCarimbado;
exports.folhasDoProcesso = folhasDoProcesso;
exports.pdfCarimbado = pdfCarimbado;
const admin = require("firebase-admin");
const crypto_1 = require("crypto");
const QRCode = require("qrcode");
const pdf_lib_1 = require("pdf-lib");
const documento_1 = require("../shared/documento");
const secretaria_1 = require("../shared/secretaria");
const context_1 = require("./context");
const pdfDocumento_1 = require("./pdfDocumento");
const conversao_1 = require("./conversao");
/**
 * Peças dos autos em PDF: cada documento juntado vira páginas numeradas em
 * folhas (fls.) contínuas no processo, com carimbo de processo, folha,
 * número do documento e hash. Usado na juntada, no download e na exportação.
 */
/**
 * Papel timbrado de um documento: o da unidade que o redigiu, se ela tiver
 * timbrado próprio, ou o do órgão.
 */
async function lerConfigDocumento(db, orgId, unidadeId) {
    var _a;
    const [s, u] = await Promise.all([
        db.collection(context_1.COL.config).doc(orgId).get(),
        unidadeId ? db.collection(context_1.COL.unidadeConfig).doc(unidadeId).get() : Promise.resolve(null),
    ]);
    const un = u === null || u === void 0 ? void 0 : u.data();
    return (0, secretaria_1.documentoEfetivo)((((_a = s.data()) === null || _a === void 0 ? void 0 : _a.documento) || {}), (un === null || un === void 0 ? void 0 : un.organization_id) === orgId ? un : null);
}
function conteudoDoDocumento(d) {
    return d.conteudo ? d.conteudo : (0, documento_1.deltaParaDoc)((d.delta || []));
}
const caminhoPdf = (storagePath) => `${storagePath}.pdf`;
exports.caminhoPdf = caminhoPdf;
/** Folhas que um arquivo enviado ocupa nos autos. */
async function paginasDeArquivo(buf, mime) {
    if (mime === 'application/pdf') {
        try {
            return (await pdf_lib_1.PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount();
        }
        catch (_a) {
            return 1;
        }
    }
    if (mime === 'text/plain')
        return (await (0, pdfDocumento_1.renderizarDocumento)((0, pdfDocumento_1.textoParaDoc)(buf.toString('utf8')), {}, { semCabecalho: true })).paginas;
    if ((0, conversao_1.conversivel)(mime)) {
        try {
            return (await (0, pdfDocumento_1.renderizarDocumento)((await (0, conversao_1.officeParaDoc)(buf, mime)), {}, { semCabecalho: true })).paginas;
        }
        catch (_b) {
            return 1;
        }
    }
    return 1; // imagem numa folha; outros formatos, folha de referência
}
async function folhaSimples(titulo, linhas, imagem) {
    const pdf = await pdf_lib_1.PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const bold = await pdf.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
    if (imagem) {
        const img = imagem.mime === 'image/png' ? await pdf.embedPng(imagem.buf) : await pdf.embedJpg(imagem.buf);
        const esc = img.scaleToFit(595.28 - 112, 841.89 - 140);
        page.drawImage(img, { x: (595.28 - esc.width) / 2, y: 841.89 - 70 - esc.height, width: esc.width, height: esc.height });
        return pdf.save();
    }
    let y = 760;
    page.drawText((0, pdfDocumento_1.winAnsi)(titulo).slice(0, 90), { x: 56, y, size: 13, font: bold });
    for (const l of linhas) {
        y -= 18;
        page.drawText((0, pdfDocumento_1.winAnsi)(l).slice(0, 110), { x: 56, y, size: 9, font, color: (0, pdf_lib_1.rgb)(0.3, 0.3, 0.3) });
    }
    return pdf.save();
}
/**
 * PDF de um documento como entra nos autos (sem carimbo). Documento do
 * editor usa o PDF gerado na juntada; se faltar, gera de novo do conteúdo.
 */
async function pdfDoDocumento(d, cfg) {
    const bucket = admin.storage().bucket();
    if (d.origem === 'editor') {
        if (d.pdf_path) {
            try {
                return (await bucket.file(d.pdf_path).download())[0];
            }
            catch ( /* gera de novo abaixo */_a) { /* gera de novo abaixo */ }
        }
        return (await (0, pdfDocumento_1.renderizarDocumento)(conteudoDoDocumento(d), d.peticao ? {} : cfg, {
            assinaturas: d.assinaturas || [], sha256: d.sha256, semCabecalho: !!d.peticao,
        })).buffer;
    }
    try {
        const [buf] = await bucket.file(d.storage_path).download();
        if (d.mime === 'application/pdf') {
            await pdf_lib_1.PDFDocument.load(buf, { ignoreEncryption: true }); // valida
            return buf;
        }
        if (d.mime === 'image/png' || d.mime === 'image/jpeg')
            return folhaSimples(d.titulo, [], { buf, mime: d.mime });
        if (d.mime === 'text/plain')
            return (await (0, pdfDocumento_1.renderizarDocumento)((0, pdfDocumento_1.textoParaDoc)(buf.toString('utf8')), {}, { semCabecalho: true })).buffer;
        if ((0, conversao_1.conversivel)(d.mime))
            return (await (0, pdfDocumento_1.renderizarDocumento)((await (0, conversao_1.officeParaDoc)(buf, d.mime)), {}, { semCabecalho: true })).buffer;
    }
    catch (_b) {
        return folhaSimples(String(d.titulo), ['Não foi possível incorporar este arquivo (corrompido ou protegido).', 'O original continua nos autos eletrônicos.', `SHA-256 ${d.sha256}`]);
    }
    return folhaSimples(String(d.titulo), [
        `Arquivo ${d.nome_arquivo} (${d.mime}), sem conversão para PDF nesta versão.`,
        'O original está nos autos eletrônicos e pode ser baixado no Processo Eletrônico.',
        `SHA-256 ${d.sha256}`,
    ]);
}
// ---------------------------------------------------------------------------
// Código de verificação: cada documento juntado ganha um código aleatório
// (80 bits) impresso em todas as folhas, com QR para a página pública
// /Conferir, que mostra os dados da juntada, signatários e hashes.
// ---------------------------------------------------------------------------
exports.APP_URL = process.env.APP_URL || 'https://sigo-caocipp.web.app';
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function novoCodigo() {
    const b = (0, crypto_1.randomBytes)(10);
    let bits = 0, valor = 0, out = '';
    for (const byte of b) {
        valor = (valor << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += BASE32[(valor >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    return out.match(/.{4}/g).join('-');
}
/** Aceita minúsculas, espaços, sem hífen e O/I/L no lugar de 0/1. */
function normalizarCodigo(v) {
    const s = String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    return s.length === 16 && [...s].every((ch) => BASE32.includes(ch)) ? s.match(/.{4}/g).join('-') : '';
}
const urlConferencia = (codigo) => `${exports.APP_URL}/Conferir?c=${codigo}`;
exports.urlConferencia = urlConferencia;
/** O que a página pública mostra sobre um documento juntado. */
function registroVerificacao(orgId, orgao, procId, proc, docId, d) {
    var _a, _b, _c, _d;
    return {
        organization_id: orgId, orgao, processo_id: procId, numero: String(proc.numero), documento_id: docId,
        ordem: (_a = d.ordem) !== null && _a !== void 0 ? _a : null, titulo: String(d.titulo || ''), tipo: String(d.tipo || ''), origem: d.origem || null,
        nome_arquivo: d.nome_arquivo || null, juntado_em: d.juntado_em || null, juntado_por: d.juntado_por_nome || null,
        folha_inicial: (_b = d.folha_inicial) !== null && _b !== void 0 ? _b : null, folha_final: (_c = d.folha_final) !== null && _c !== void 0 ? _c : null, paginas: (_d = d.paginas) !== null && _d !== void 0 ? _d : null,
        assinaturas: (d.assinaturas || []).map((a) => ({ nome: a.nome, em: a.em, nivel: a.nivel || 'simples' })),
        sha256: d.sha256 || null, pdf_sha256: d.pdf_sha256 || null, peticao: d.peticao === true,
        criado_em: new Date().toISOString(),
    };
}
/** Código do documento juntado; cria (uma vez) para documentos juntados antes desta função. */
async function garantirCodigo(db, orgId, procId, numero, docId) {
    const procRef = db.collection(context_1.COL.processos).doc(procId);
    const ref = procRef.collection('documentos').doc(docId);
    return db.runTransaction(async (tx) => {
        var _a;
        const [s, p, o] = await Promise.all([tx.get(ref), tx.get(procRef), tx.get(db.collection('organizations').doc(orgId))]);
        const d = s.data();
        if (!d || d.status !== 'juntado')
            return null;
        if (d.codigo_verificacao)
            return String(d.codigo_verificacao);
        const codigo = novoCodigo();
        tx.set(db.collection(context_1.COL.verificacao).doc(codigo), registroVerificacao(orgId, String(((_a = o.data()) === null || _a === void 0 ? void 0 : _a.name) || ''), procId, p.data() || { numero }, docId, d));
        tx.update(ref, { codigo_verificacao: codigo });
        return codigo;
    });
}
/**
 * Carimba as páginas: no topo, processo e folha (e código de conferência com
 * QR); no rodapé, documento, juntada e hash. Devolve quantas páginas o
 * documento ocupou.
 */
async function anexarCarimbado(destino, origem, info) {
    let src;
    try {
        src = await pdf_lib_1.PDFDocument.load(origem, { ignoreEncryption: true });
    }
    catch (_a) {
        src = await pdf_lib_1.PDFDocument.load(await folhaSimples(info.titulo, ['Arquivo não pôde ser lido.', `SHA-256 ${info.sha256 || ''}`]));
    }
    const font = await destino.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const qr = info.codigo ? await destino.embedPng(await QRCode.toBuffer((0, exports.urlConferencia)(info.codigo), { margin: 0, width: 96, errorCorrectionLevel: 'M' })) : null;
    const paginas = await destino.copyPages(src, src.getPageIndices());
    paginas.forEach((pg, i) => {
        destino.addPage(pg);
        const { width, height } = pg.getSize();
        const topo = (0, pdfDocumento_1.winAnsi)(`Processo nº ${info.processo}${info.folha ? ` · fls. ${info.folha + i}` : ''}`);
        pg.drawText(topo, { x: width - 20 - font.widthOfTextAtSize(topo, 8), y: height - 16, size: 8, font, color: (0, pdf_lib_1.rgb)(0.25, 0.25, 0.4) });
        if (qr && info.codigo) {
            pg.drawImage(qr, { x: 14, y: height - 52, width: 34, height: 34 });
            pg.drawText((0, pdfDocumento_1.winAnsi)(`Conferência: ${info.codigo}`), { x: 52, y: height - 26, size: 6.5, font, color: (0, pdf_lib_1.rgb)(0.25, 0.25, 0.4) });
            pg.drawText((0, pdfDocumento_1.winAnsi)(`${exports.APP_URL.replace(/^https?:\/\//, '')}/Conferir`), { x: 52, y: height - 35, size: 6, font, color: (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4) });
        }
        if (info.ordem) {
            const base = (0, pdfDocumento_1.winAnsi)(`Doc. nº ${info.ordem} · ${info.titulo.slice(0, 60)}${info.juntadoEm ? ` · juntado em ${(0, pdfDocumento_1.dataHora)(info.juntadoEm)}${info.juntadoPor ? ` por ${info.juntadoPor}` : ''}` : ''}${info.sha256 ? ` · SHA-256 ${info.sha256.slice(0, 16)}…` : ''}`);
            pg.drawText(base, { x: 20, y: 8, size: 6, font, color: (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4), maxWidth: width - 40 });
        }
    });
    return paginas.length;
}
/**
 * Próxima folha livre do processo. Processo anterior às folhas: soma as
 * páginas dos documentos já juntados (1 quando não se sabe).
 */
async function folhasDoProcesso(tx, procRef, proc) {
    if (typeof proc.folhas_seq === 'number')
        return proc.folhas_seq;
    if (!Number(proc.doc_seq))
        return 0;
    const s = await tx.get(procRef.collection('documentos').where('status', '==', 'juntado'));
    return s.docs.reduce((acc, x) => acc + (Number(x.data().paginas) || 1), 0);
}
const textoFolhas = (ini, qtd) => (qtd > 1 ? `fls. ${ini} a ${ini + qtd - 1}` : `fl. ${ini}`);
exports.textoFolhas = textoFolhas;
/** Um documento juntado, carimbado, em PDF próprio (download avulso). */
async function pdfCarimbado(db, orgId, procId, numero, docId, d) {
    const cfg = await lerConfigDocumento(db, orgId, d.unidade_origem);
    const destino = await pdf_lib_1.PDFDocument.create();
    const codigo = d.codigo_verificacao || await garantirCodigo(db, orgId, procId, numero, docId);
    await anexarCarimbado(destino, await pdfDoDocumento(d, cfg), {
        processo: numero, folha: typeof d.folha_inicial === 'number' ? d.folha_inicial : null, ordem: d.ordem,
        titulo: String(d.titulo), juntadoEm: d.juntado_em, juntadoPor: d.juntado_por_nome, sha256: d.sha256, codigo,
    });
    return Buffer.from(await destino.save()).toString('base64');
}
//# sourceMappingURL=autos.js.map