"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.textoFolhas = exports.urlConferencia = exports.APP_URL = exports.ehLegado = exports.FONTES_ATUAIS = exports.caminhoPdf = void 0;
exports.lerConfigDocumento = lerConfigDocumento;
exports.conteudoDoDocumento = conteudoDoDocumento;
exports.paginasDeArquivo = paginasDeArquivo;
exports.folhaSimples = folhaSimples;
exports.pdfDoDocumento = pdfDoDocumento;
exports.pdfDeArquivo = pdfDeArquivo;
exports.versaoDeLeitura = versaoDeLeitura;
exports.novoCodigo = novoCodigo;
exports.normalizarCodigo = normalizarCodigo;
exports.registroVerificacao = registroVerificacao;
exports.garantirCodigo = garantirCodigo;
exports.anexarCarimbado = anexarCarimbado;
exports.folhasDoProcesso = folhasDoProcesso;
exports.pdfCarimbado = pdfCarimbado;
const admin = require("firebase-admin");
const crypto_1 = require("crypto");
// Bibliotecas pesadas carregadas só quando usadas (partida a frio das functions).
const pdfLib = () => require('pdf-lib');
const qrcode = () => require('qrcode');
const documento_1 = require("../shared/documento");
const secretaria_1 = require("../shared/secretaria");
const context_1 = require("./context");
const pdfDocumento_1 = require("./pdfDocumento");
const conversao_1 = require("./conversao");
const arquivos_1 = require("./arquivos");
const imagem_1 = require("./imagem");
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
/** Texto do editor de um documento ou versão (JSON no banco ou no Storage, mapa antigo, Delta do Quill). */
async function conteudoDoDocumento(d) {
    return (await (0, arquivos_1.lerConteudo)(d)) || (0, documento_1.deltaParaDoc)((d.delta || []));
}
const caminhoPdf = (storagePath) => `${storagePath}.pdf`;
exports.caminhoPdf = caminhoPdf;
/**
 * Documento gravado a partir de 16/11/2026 traz `fontes: 2`: PDF com as
 * fontes novas e conversão nova de Word/LibreOffice. Sem a marca, o PDF é
 * refeito como era (mesmas folhas já numeradas nos autos).
 */
exports.FONTES_ATUAIS = 2;
const ehLegado = (d) => d.fontes !== exports.FONTES_ATUAIS;
exports.ehLegado = ehLegado;
/** Folhas que um arquivo enviado ocupa nos autos. */
async function paginasDeArquivo(buf, mime, legado = false) {
    if (mime === 'application/pdf') {
        try {
            return (await pdfLib().PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount();
        }
        catch (_a) {
            return 1;
        }
    }
    if (mime === 'text/plain')
        return (await (0, pdfDocumento_1.renderizarDocumento)((0, pdfDocumento_1.textoParaDoc)(buf.toString('utf8')), {}, { semCabecalho: true, legado })).paginas;
    if ((0, conversao_1.conversivel)(mime, legado)) {
        try {
            return (await (0, pdfDocumento_1.renderizarDocumento)((await (0, conversao_1.officeParaDoc)(buf, mime, legado)), {}, { semCabecalho: true, legado })).paginas;
        }
        catch (_b) {
            return 1;
        }
    }
    return 1; // imagem numa folha; outros formatos, folha de referência
}
async function folhaSimples(titulo, linhas, imagem) {
    const pdf = await pdfLib().PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(pdfLib().StandardFonts.Helvetica);
    const bold = await pdf.embedFont(pdfLib().StandardFonts.HelveticaBold);
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
        page.drawText((0, pdfDocumento_1.winAnsi)(l).slice(0, 110), { x: 56, y, size: 9, font, color: pdfLib().rgb(0.3, 0.3, 0.3) });
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
        return (await (0, pdfDocumento_1.renderizarDocumento)(await conteudoDoDocumento(d), d.peticao ? {} : cfg, {
            assinaturas: d.assinaturas || [], sha256: d.sha256, semCabecalho: !!d.peticao, legado: (0, exports.ehLegado)(d),
        })).buffer;
    }
    // Versão de leitura feita no envio (imagem otimizada, PDF reorganizado, Word convertido).
    if (d.leitura_path) {
        try {
            return (await bucket.file(d.leitura_path).download())[0];
        }
        catch ( /* volta ao original abaixo */_b) { /* volta ao original abaixo */ }
    }
    try {
        return await pdfDeArquivo(await (0, arquivos_1.lerOriginal)(d), Object.assign(Object.assign({}, d), { legado: (0, exports.ehLegado)(d) }));
    }
    catch (_c) {
        return folhaSimples(String(d.titulo), ['Não foi possível incorporar este arquivo (corrompido ou protegido).', 'O original continua nos autos eletrônicos.', `SHA-256 ${d.sha256}`]);
    }
}
/** O arquivo enviado como páginas dos autos (sem carimbo). Lança se o arquivo não abrir. */
async function pdfDeArquivo(buf, d) {
    const legado = !!d.legado;
    const mime = String(d.mime);
    if (mime === 'application/pdf') {
        await pdfLib().PDFDocument.load(buf, { ignoreEncryption: true }); // valida
        return buf;
    }
    if (mime === 'image/png' || mime === 'image/jpeg')
        return folhaSimples(String(d.titulo), [], { buf, mime });
    if (mime === 'text/plain')
        return (await (0, pdfDocumento_1.renderizarDocumento)((0, pdfDocumento_1.textoParaDoc)(buf.toString('utf8')), {}, { semCabecalho: true, legado })).buffer;
    if ((0, conversao_1.conversivel)(mime, legado))
        return (await (0, pdfDocumento_1.renderizarDocumento)((await (0, conversao_1.officeParaDoc)(buf, mime, legado)), {}, { semCabecalho: true, legado })).buffer;
    return folhaSimples(String(d.titulo), [
        `Arquivo ${d.nome_arquivo} (${mime}), sem conversão para PDF nesta versão.`,
        'O original está nos autos eletrônicos e pode ser baixado no Processo Eletrônico.',
        `SHA-256 ${d.sha256}`,
    ]);
}
/**
 * Versão de leitura de um arquivo enviado: o que vai às folhas dos autos, à
 * tela e ao PDF do processo. O original fica intacto (é a prova, com o
 * SHA-256) e pode ser baixado a qualquer tempo.
 *   - Imagem: reduzida a até 300 dpi numa folha A4 e recomprimida sem perda
 *     perceptível (JPEG de alta qualidade ou PNG sem perda, o menor), já na
 *     orientação certa da câmera.
 *   - PDF: reorganizado sem perda (fluxos de objetos); só se ficar ao menos
 *     10% menor. PDF protegido por senha fica como veio.
 *   - Word, planilha e texto: a conversão para PDF, feita uma vez só.
 * Devolve null quando o original já serve como está.
 */
async function versaoDeLeitura(buf, d) {
    if (d.mime === 'image/png' || d.mime === 'image/jpeg') {
        const img = await (0, imagem_1.otimizarImagem)(buf, d.mime);
        return folhaSimples(d.titulo, [], img || { buf, mime: d.mime });
    }
    if (d.mime === 'application/pdf') {
        const pdf = await pdfLib().PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
        if (pdf.isEncrypted)
            return null;
        const novo = await pdf.save({ useObjectStreams: true });
        return novo.length <= buf.length * 0.9 ? novo : null;
    }
    return pdfDeArquivo(buf, d);
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
        src = await pdfLib().PDFDocument.load(origem, { ignoreEncryption: true });
    }
    catch (_a) {
        src = await pdfLib().PDFDocument.load(await folhaSimples(info.titulo, ['Arquivo não pôde ser lido.', `SHA-256 ${info.sha256 || ''}`]));
    }
    const font = await destino.embedFont(pdfLib().StandardFonts.Helvetica);
    const qr = info.codigo ? await destino.embedPng(await qrcode().toBuffer((0, exports.urlConferencia)(info.codigo), { margin: 0, width: 96, errorCorrectionLevel: 'M' })) : null;
    // `paginas`: só essas páginas do documento (índices a partir de 0), no PDF parcial por folhas.
    const indices = info.paginas ? src.getPageIndices().slice(info.paginas[0], info.paginas[1] + 1) : src.getPageIndices();
    const paginas = await destino.copyPages(src, indices);
    paginas.forEach((pg, n) => {
        const i = indices[n];
        destino.addPage(pg);
        const { width, height } = pg.getSize();
        const fls = !info.folha ? '' : info.mesmaFolha ? ` · fls. ${info.folha}${i ? ' (continuação)' : ''}` : ` · fls. ${info.folha + i}`;
        const topo = (0, pdfDocumento_1.winAnsi)(`Processo nº ${info.processo}${fls}`);
        pg.drawText(topo, { x: width - 20 - font.widthOfTextAtSize(topo, 8), y: height - 16, size: 8, font, color: pdfLib().rgb(0.25, 0.25, 0.4) });
        if (qr && info.codigo) {
            pg.drawImage(qr, { x: 14, y: height - 52, width: 34, height: 34 });
            pg.drawText((0, pdfDocumento_1.winAnsi)(`Conferência: ${info.codigo}`), { x: 52, y: height - 26, size: 6.5, font, color: pdfLib().rgb(0.25, 0.25, 0.4) });
            pg.drawText((0, pdfDocumento_1.winAnsi)(`${exports.APP_URL.replace(/^https?:\/\//, '')}/Conferir`), { x: 52, y: height - 35, size: 6, font, color: pdfLib().rgb(0.4, 0.4, 0.4) });
        }
        if (info.ordem) {
            const base = (0, pdfDocumento_1.winAnsi)(`Doc. nº ${info.ordem} · ${info.titulo.slice(0, 60)}${info.juntadoEm ? ` · juntado em ${(0, pdfDocumento_1.dataHora)(info.juntadoEm)}${info.juntadoPor ? ` por ${info.juntadoPor}` : ''}` : ''}${info.sha256 ? ` · SHA-256 ${info.sha256.slice(0, 16)}…` : ''}`);
            pg.drawText(base, { x: 20, y: 8, size: 6, font, color: pdfLib().rgb(0.4, 0.4, 0.4), maxWidth: width - 40 });
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
    const destino = await pdfLib().PDFDocument.create();
    const codigo = d.codigo_verificacao || await garantirCodigo(db, orgId, procId, numero, docId);
    await anexarCarimbado(destino, await pdfDoDocumento(d, cfg), {
        processo: numero, folha: typeof d.folha_inicial === 'number' ? d.folha_inicial : null, ordem: d.ordem,
        titulo: String(d.titulo), juntadoEm: d.juntado_em, juntadoPor: d.juntado_por_nome, sha256: d.sha256, codigo,
    });
    return Buffer.from(await destino.save());
}
//# sourceMappingURL=autos.js.map