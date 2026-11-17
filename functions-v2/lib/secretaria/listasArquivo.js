"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIMES_LISTAS = exports.MIME_JSON = exports.MIME_CSV = exports.MIME_XLS = exports.MIME_ODS = void 0;
exports.blocosDoDoc = blocosDoDoc;
exports.propostaDoArquivo = propostaDoArquivo;
const listasOrgao_1 = require("../shared/listasOrgao");
const conversao_1 = require("./conversao");
const conversaoComum_1 = require("./conversaoComum");
const importarModelo_1 = require("./importarModelo");
/**
 * Listas do órgão a partir de um arquivo: o servidor lê o conteúdo e devolve a
 * proposta (itens e a lista de cada um) para a tela mostrar e o admin aprovar.
 * Word, LibreOffice e planilhas passam pela mesma leitura (com as travas de
 * ZIP) da conversão de arquivos juntados; nada é gravado aqui.
 */
exports.MIME_ODS = 'application/vnd.oasis.opendocument.spreadsheet';
exports.MIME_XLS = 'application/vnd.ms-excel';
exports.MIME_CSV = 'text/csv';
exports.MIME_JSON = 'application/json';
exports.MIMES_LISTAS = ['text/plain', 'text/markdown', exports.MIME_CSV, exports.MIME_JSON, conversao_1.MIME_DOCX, conversao_1.MIME_DOC, conversao_1.MIME_ODT, conversao_1.MIME_XLSX, exports.MIME_XLS, exports.MIME_ODS, importarModelo_1.MIME_PDF];
/** Linhas e tabelas do documento do editor, na ordem (títulos marcados). */
function blocosDoDoc(doc) {
    const out = [];
    const texto = (n) => (n.type === 'text' ? String(n.text || '') : n.type === 'hardBreak' ? '\n' : (n.content || []).map(texto).join(n.type === 'tableCell' || n.type === 'tableHeader' ? ' ' : ''));
    const andar = (n) => {
        if (n.type === 'table') {
            out.push({ tabela: (n.content || []).map((r) => (r.content || []).map((c) => texto(c).replace(/\s+/g, ' ').trim())) });
            return;
        }
        if (n.type === 'paragraph' || n.type === 'heading') {
            for (const l of texto(n).split('\n'))
                out.push(Object.assign({ linha: l }, (n.type === 'heading' ? { titulo: true } : {})));
            return;
        }
        for (const c of n.content || [])
            andar(c);
    };
    andar(doc);
    return out;
}
/** Texto do arquivo em UTF-8 (ou Latin-1, de planilha antiga salva como texto). */
const textoDe = (buf) => {
    const t = buf.toString('utf8').replace(/^﻿/, '');
    return t.includes('�') ? buf.toString('latin1') : t;
};
async function propostaDoArquivo(buf, mime, nome = '') {
    let blocos;
    // Todo ZIP (docx, xlsx, ods, odt ou um disfarçado de .xls/.doc) passa antes pelas travas de tamanho descompactado.
    if (!mime.startsWith('text/') && mime !== exports.MIME_JSON && buf.subarray(0, 2).toString('latin1') === 'PK')
        await (0, conversaoComum_1.abrirZip)(buf);
    if (mime === importarModelo_1.MIME_PDF) {
        const t = await (0, importarModelo_1.textoDePdf)(buf);
        if (!t.trim())
            throw new Error('O PDF não tem texto selecionável (parece imagem digitalizada). Envie o Word, a planilha ou um arquivo de texto.');
        blocos = t.split('\n').map((linha) => ({ linha }));
    }
    else if (mime === exports.MIME_ODS || mime === exports.MIME_XLS) {
        blocos = blocosDoDoc((0, conversao_1.xlsxParaDoc)(buf));
    }
    else if ([conversao_1.MIME_DOCX, conversao_1.MIME_DOC, conversao_1.MIME_ODT, conversao_1.MIME_XLSX].includes(mime)) {
        const doc = await (0, conversao_1.officeParaDoc)(buf, mime);
        blocos = doc ? blocosDoDoc(doc) : [];
    }
    else {
        const t = textoDe(buf);
        const json = mime === exports.MIME_JSON || /\.json$/i.test(nome) || /^\s*[[{]/.test(t);
        if (json) {
            let v;
            try {
                v = JSON.parse(t);
            }
            catch (_a) {
                throw new Error('O arquivo JSON não pôde ser lido (confira vírgulas, aspas e chaves).');
            }
            blocos = (0, listasOrgao_1.blocosDoJson)(v);
        }
        else {
            const csv = mime === exports.MIME_CSV || /\.(csv|tsv)$/i.test(nome) ? (0, listasOrgao_1.tabelaDoCsv)(t) : null;
            blocos = csv ? [{ tabela: csv }] : t.split(/\r?\n/).map((l) => (Object.assign({ linha: l }, (/^\s*#/.test(l) ? { titulo: true } : {}))));
        }
    }
    const r = (0, listasOrgao_1.propostaDeBlocos)(blocos);
    if (!r.itens.length)
        r.avisos.unshift('Não achei itens no arquivo. Use um item por linha, com títulos como "Espécies de comunicação", "Espécies de audiência" e "Origens do processo", ou uma planilha com uma coluna para cada lista.');
    return r;
}
//# sourceMappingURL=listasArquivo.js.map