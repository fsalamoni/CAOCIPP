import type { No } from '../shared/documento';
import { BlocoArquivo, PropostaListas, blocosDoJson, propostaDeBlocos, tabelaDoCsv } from '../shared/listasOrgao';
import { MIME_DOC, MIME_DOCX, MIME_ODT, MIME_XLSX, officeParaDoc, xlsxParaDoc } from './conversao';
import { abrirZip } from './conversaoComum';
import { MIME_PDF, textoDePdf } from './importarModelo';

/**
 * Listas do órgão a partir de um arquivo: o servidor lê o conteúdo e devolve a
 * proposta (itens e a lista de cada um) para a tela mostrar e o admin aprovar.
 * Word, LibreOffice e planilhas passam pela mesma leitura (com as travas de
 * ZIP) da conversão de arquivos juntados; nada é gravado aqui.
 */

export const MIME_ODS = 'application/vnd.oasis.opendocument.spreadsheet';
export const MIME_XLS = 'application/vnd.ms-excel';
export const MIME_CSV = 'text/csv';
export const MIME_JSON = 'application/json';
export const MIMES_LISTAS = ['text/plain', 'text/markdown', MIME_CSV, MIME_JSON, MIME_DOCX, MIME_DOC, MIME_ODT, MIME_XLSX, MIME_XLS, MIME_ODS, MIME_PDF];

/** Linhas e tabelas do documento do editor, na ordem (títulos marcados). */
export function blocosDoDoc(doc: No): BlocoArquivo[] {
    const out: BlocoArquivo[] = [];
    const texto = (n: No): string => (n.type === 'text' ? String(n.text || '') : n.type === 'hardBreak' ? '\n' : (n.content || []).map(texto).join(n.type === 'tableCell' || n.type === 'tableHeader' ? ' ' : ''));
    const andar = (n: No) => {
        if (n.type === 'table') {
            out.push({ tabela: (n.content || []).map((r) => (r.content || []).map((c) => texto(c).replace(/\s+/g, ' ').trim())) });
            return;
        }
        if (n.type === 'paragraph' || n.type === 'heading') {
            for (const l of texto(n).split('\n')) out.push({ linha: l, ...(n.type === 'heading' ? { titulo: true } : {}) });
            return;
        }
        for (const c of n.content || []) andar(c);
    };
    andar(doc);
    return out;
}

/** Texto do arquivo em UTF-8 (ou Latin-1, de planilha antiga salva como texto). */
const textoDe = (buf: Buffer) => {
    const t = buf.toString('utf8').replace(/^﻿/, '');
    return t.includes('�') ? buf.toString('latin1') : t;
};

export async function propostaDoArquivo(buf: Buffer, mime: string, nome = ''): Promise<PropostaListas> {
    let blocos: BlocoArquivo[];
    // Todo ZIP (docx, xlsx, ods, odt ou um disfarçado de .xls/.doc) passa antes pelas travas de tamanho descompactado.
    if (!mime.startsWith('text/') && mime !== MIME_JSON && buf.subarray(0, 2).toString('latin1') === 'PK') await abrirZip(buf);
    if (mime === MIME_PDF) {
        const t = await textoDePdf(buf);
        if (!t.trim()) throw new Error('O PDF não tem texto selecionável (parece imagem digitalizada). Envie o Word, a planilha ou um arquivo de texto.');
        blocos = t.split('\n').map((linha) => ({ linha }));
    } else if (mime === MIME_ODS || mime === MIME_XLS) {
        blocos = blocosDoDoc(xlsxParaDoc(buf));
    } else if ([MIME_DOCX, MIME_DOC, MIME_ODT, MIME_XLSX].includes(mime)) {
        const doc = await officeParaDoc(buf, mime);
        blocos = doc ? blocosDoDoc(doc) : [];
    } else {
        const t = textoDe(buf);
        const json = mime === MIME_JSON || /\.json$/i.test(nome) || /^\s*[[{]/.test(t);
        if (json) {
            let v: unknown;
            try { v = JSON.parse(t); } catch { throw new Error('O arquivo JSON não pôde ser lido (confira vírgulas, aspas e chaves).'); }
            blocos = blocosDoJson(v);
        } else {
            const csv = mime === MIME_CSV || /\.(csv|tsv)$/i.test(nome) ? tabelaDoCsv(t) : null;
            blocos = csv ? [{ tabela: csv }] : t.split(/\r?\n/).map((l) => ({ linha: l, ...(/^\s*#/.test(l) ? { titulo: true } : {}) }));
        }
    }
    const r = propostaDeBlocos(blocos);
    if (!r.itens.length) r.avisos.unshift('Não achei itens no arquivo. Use um item por linha, com títulos como "Espécies de comunicação", "Espécies de audiência" e "Origens do processo", ou uma planilha com uma coluna para cada lista.');
    return r;
}
