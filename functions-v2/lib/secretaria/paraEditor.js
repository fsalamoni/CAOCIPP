"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arquivoParaEditor = arquivoParaEditor;
const documento_1 = require("../shared/documento");
const conversao_1 = require("./conversao");
const conversaoComum_1 = require("./conversaoComum");
const importarModelo_1 = require("./importarModelo");
const pdfDocumento_1 = require("./pdfDocumento");
/**
 * Qualquer arquivo aceito no processo → documento do editor, para revisar e
 * ajustar na própria plataforma. O arquivo original nunca muda: quem chama
 * guarda o original como versão anterior da minuta.
 *   - Word (.docx) e LibreOffice (.odt): com a formatação (fontes, recuos,
 *     espaçamentos, listas, tabelas, imagens).
 *   - Word antigo (.doc): o texto, parágrafo a parágrafo.
 *   - PDF com texto: o texto, parágrafo a parágrafo (PDF não guarda a estrutura).
 *   - Planilha (.xlsx): uma tabela por aba.
 *   - Texto (.txt): parágrafos.
 *   - Imagem (PNG, JPG): a imagem na folha, para escrever em volta.
 */
async function arquivoParaEditor(buf, mime, titulo) {
    if (mime === conversao_1.MIME_DOCX) {
        const r = await require('./docx').docxParaDoc(buf);
        return { conteudo: r.doc, avisos: r.avisos };
    }
    if (mime === conversao_1.MIME_ODT) {
        const r = await require('./odt').odtParaDoc(buf);
        return { conteudo: r.doc, avisos: r.avisos };
    }
    if (mime === conversao_1.MIME_DOC) {
        return { conteudo: await (0, conversao_1.docParaDoc)(buf), avisos: ['Word antigo (.doc): veio só o texto. Negrito, tabelas e imagens precisam ser refeitos no editor; para trazer a formatação, salve o arquivo como .docx no Word e envie de novo.'] };
    }
    if (mime === conversao_1.MIME_XLSX)
        return { conteudo: (0, conversao_1.xlsxParaDoc)(buf), avisos: [] };
    if (mime === 'text/plain')
        return { conteudo: (0, documento_1.sanitizeDoc)((0, pdfDocumento_1.textoParaDoc)(buf.toString('utf8'))), avisos: [] };
    if (mime === 'application/pdf') {
        const avisos = [];
        let r;
        try {
            r = await (0, importarModelo_1.interpretarPdf)(buf, avisos);
        }
        catch (e) {
            throw new Error(e instanceof Error && /imagem digitalizada/.test(e.message)
                ? 'Este PDF é imagem digitalizada (não tem texto para editar). Para revisar, peça o arquivo em Word ou LibreOffice, ou redija a minuta no editor.'
                : 'Não deu para ler o texto deste PDF (pode estar protegido por senha).');
        }
        return { conteudo: (0, documento_1.sanitizeDoc)(r.doc), avisos: ['PDF: veio o texto, parágrafo a parágrafo. Negrito, tabelas e imagens do PDF não vêm; confira e ajuste a formatação no editor.'] };
    }
    if (mime === 'image/png' || mime === 'image/jpeg') {
        const img = await (0, conversaoComum_1.novoOrcamento)().incluir(buf, titulo);
        if (!img)
            throw new Error('Imagem grande demais para o editor');
        return {
            conteudo: (0, documento_1.sanitizeDoc)({ type: 'doc', content: [{ type: 'image', attrs: { src: img.src, alt: titulo.slice(0, 300), width: Math.min(605, img.largura), align: 'center' } }, { type: 'paragraph' }] }),
            avisos: ['Imagem: o texto dentro dela não é editável; escreva antes ou depois dela.'],
        };
    }
    throw new Error('Este tipo de arquivo não abre no editor');
}
//# sourceMappingURL=paraEditor.js.map