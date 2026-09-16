// ============================================================================
// jurimetriaFile — preparo do arquivo de importação no cliente
// ----------------------------------------------------------------------------
// Planilhas (.xlsx/.xls/.csv) e JSON seguem direto para a Cloud Function, que
// faz a leitura no servidor. Documentos do Word (.docx) são abertos aqui: um
// .docx é um ZIP e a tabela fica em `word/document.xml`, então extraímos as
// linhas no navegador (com a API DecompressionStream, nativa) e enviamos o
// resultado como JSON — reaproveitando o MESMO caminho de importação, sem
// precisar de nenhuma biblioteca adicional no servidor nem no cliente.
// ============================================================================

import { logger } from '@/utils/logger';

export const JURIMETRIA_ACCEPTED_EXTENSIONS = '.xlsx,.xls,.csv,.json,.docx';
export const JURIMETRIA_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Extensão em minúsculas, sem o ponto. */
export function fileExtension(file) {
    return String(file?.name || '').split('.').pop()?.toLowerCase() || '';
}

function arrayBufferToBase64(source) {
    const bytes = source instanceof Uint8Array ? source : new Uint8Array(source);
    // Converte em blocos: `String.fromCharCode(...bytes)` estoura a pilha em
    // arquivos grandes.
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

/** Lê o arquivo inteiro como base64 (formato aceito pela Cloud Function). */
export async function fileToBase64(file) {
    const buffer = await file.arrayBuffer();
    return arrayBufferToBase64(buffer);
}

/** Converte linhas já estruturadas em base64 de JSON. */
export function rowsToBase64Json(rows) {
    return arrayBufferToBase64(new TextEncoder().encode(JSON.stringify(rows)));
}

// ----------------------------------------------------------------------------
// Leitura de .docx
// ----------------------------------------------------------------------------

/** Indica se o navegador consegue abrir .docx (precisa de DecompressionStream). */
export function supportsDocx() {
    return typeof DecompressionStream === 'function';
}

/** Descompacta um fluxo deflate bruto usando a API nativa do navegador. */
async function inflateRaw(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Extrai um único arquivo de dentro de um ZIP, percorrendo o diretório central.
 * Implementação mínima e suficiente para .docx (métodos 0 = armazenado e
 * 8 = deflate, que são os únicos usados pelo Word).
 */
async function readZipEntry(buffer, entryName) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Localiza o "End of Central Directory" varrendo do fim para o começo.
    let eocd = -1;
    const minStart = Math.max(0, bytes.length - 66000);
    for (let i = bytes.length - 22; i >= minStart; i--) {
        if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Arquivo .docx inválido (índice do ZIP não encontrado).');

    const entryCount = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);

    for (let i = 0; i < entryCount; i++) {
        if (view.getUint32(offset, true) !== 0x02014b50) break;
        const method = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

        if (name === entryName) {
            // Cabeçalho local: os tamanhos de nome/extra podem diferir do central.
            const localNameLength = view.getUint16(localOffset + 26, true);
            const localExtraLength = view.getUint16(localOffset + 28, true);
            const dataStart = localOffset + 30 + localNameLength + localExtraLength;
            const data = bytes.subarray(dataStart, dataStart + compressedSize);
            return method === 0 ? data : inflateRaw(data);
        }

        offset += 46 + nameLength + extraLength + commentLength;
    }

    throw new Error(`Arquivo .docx sem "${entryName}".`);
}

/**
 * Ancestral mais próximo com a tag informada. Usado no lugar de `closest()`,
 * que interpretaria "w:tbl" como o seletor CSS `w` + pseudo-classe `:tbl` e
 * lançaria erro em documentos XML com prefixo de namespace.
 */
function nearestAncestor(el, tagName) {
    let node = el.parentNode;
    while (node && node.nodeType === 1) {
        if (node.tagName === tagName) return node;
        node = node.parentNode;
    }
    return null;
}

/** Texto de uma célula do Word: junta os trechos `<w:t>`, respeitando quebras. */
function cellText(cellEl) {
    const parts = [];
    for (const node of cellEl.getElementsByTagName('*')) {
        const tag = node.tagName.replace(/^.*:/, '');
        if (tag === 't') parts.push(node.textContent || '');
        else if (tag === 'br' || tag === 'cr') parts.push(' ');
        else if (tag === 'tab') parts.push(' ');
    }
    return parts.join('').replace(/\s+/g, ' ').trim();
}

/**
 * Lê as tabelas de um .docx e devolve as linhas como objetos, usando a
 * primeira linha de cada tabela como cabeçalho — o mesmo formato que a Cloud
 * Function espera receber em JSON.
 *
 * @param {File} file
 * @returns {Promise<Array<Record<string, string>>>}
 */
export async function docxTablesToRows(file) {
    if (!supportsDocx()) {
        throw new Error(
            'Este navegador não consegue abrir arquivos .docx. '
            + 'Use o Chrome ou o Edge, ou converta o documento para .xlsx antes de importar.'
        );
    }

    const buffer = await file.arrayBuffer();
    const xmlBytes = await readZipEntry(buffer, 'word/document.xml');
    const xml = new TextDecoder('utf-8').decode(xmlBytes);

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
        throw new Error('Não foi possível interpretar o conteúdo do documento .docx.');
    }

    const tables = [...doc.getElementsByTagName('w:tbl')];
    if (tables.length === 0) {
        throw new Error('O documento .docx não contém nenhuma tabela para importar.');
    }

    const allRows = [];

    for (const table of tables) {
        // Apenas as linhas DIRETAS desta tabela (ignora tabelas aninhadas).
        const rowEls = [...table.getElementsByTagName('w:tr')]
            .filter((tr) => nearestAncestor(tr, 'w:tbl') === table);

        const matrix = rowEls.map((tr) => [...tr.getElementsByTagName('w:tc')]
            .filter((tc) => nearestAncestor(tc, 'w:tr') === tr)
            .map(cellText));

        if (matrix.length < 2) continue; // só cabeçalho (ou vazia): nada a importar

        const headers = matrix[0].map((h, i) => h || `Coluna ${i + 1}`);
        for (const cells of matrix.slice(1)) {
            if (cells.every((c) => !c)) continue;
            const row = {};
            headers.forEach((header, i) => { row[header] = cells[i] ?? ''; });
            allRows.push(row);
        }
    }

    if (allRows.length === 0) {
        throw new Error('As tabelas do documento .docx não têm linhas de dados.');
    }

    logger.debug(`[jurimetria] .docx: ${allRows.length} linha(s) extraída(s) de ${tables.length} tabela(s).`);
    return allRows;
}

/**
 * Prepara qualquer arquivo aceito para envio à Cloud Function de importação.
 * @returns {Promise<{ fileData: string, fileName: string, rowsPreview: number|null }>}
 */
export async function prepareImportPayload(file) {
    if (!file) throw new Error('Selecione um arquivo.');
    if (file.size > JURIMETRIA_MAX_FILE_BYTES) {
        throw new Error('Arquivo muito grande. O limite é de 10 MB.');
    }

    const ext = fileExtension(file);
    if (!['xlsx', 'xls', 'csv', 'json', 'docx'].includes(ext)) {
        throw new Error('Formato não suportado. Use .xlsx, .xls, .csv, .json ou .docx.');
    }

    if (ext === 'docx') {
        const rows = await docxTablesToRows(file);
        return { fileData: rowsToBase64Json(rows), fileName: file.name, rowsPreview: rows.length };
    }

    return { fileData: await fileToBase64(file), fileName: file.name, rowsPreview: null };
}
