// ============================================================================
// tableExport — exportação de tabelas para Excel e PDF (flag `export_pdf_excel`).
// Genérico o bastante para ser usado pela tabela de Consultas e de
// Expedientes: recebe as linhas já filtradas/ordenadas e uma lista de
// colunas com um extrator de valor textual (não JSX).
// ============================================================================

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND_NAVY = [51, 73, 92]; // #33495C

function safeFilenamePart(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60);
}

/**
 * @param {object} opts
 * @param {Array<object>} opts.rows - Linhas de dados já filtradas/ordenadas.
 * @param {Array<{ label: string, value: (row: object) => any }>} opts.columns
 * @param {string} opts.filenameBase - Nome do arquivo, sem extensão.
 */
export function exportRowsToExcel({ rows, columns, filenameBase }) {
    const data = rows.map((row) => {
        const obj = {};
        columns.forEach((col) => {
            obj[col.label] = col.value(row) ?? '';
        });
        return obj;
    });
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
    XLSX.writeFile(workbook, `${safeFilenamePart(filenameBase)}.xlsx`);
}

/**
 * @param {object} opts
 * @param {Array<object>} opts.rows
 * @param {Array<{ label: string, value: (row: object) => any }>} opts.columns
 * @param {string} opts.filenameBase
 * @param {string} opts.title - Título exibido no topo do PDF.
 */
export function exportRowsToPdf({ rows, columns, filenameBase, title }) {
    const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });

    doc.setFontSize(14);
    doc.setTextColor(...BRAND_NAVY);
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} — ${rows.length} registro(s)`, 14, 21);

    autoTable(doc, {
        startY: 26,
        head: [columns.map((c) => c.label)],
        body: rows.map((row) => columns.map((c) => {
            const value = c.value(row);
            return value === null || value === undefined || value === '' ? '-' : String(value);
        })),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: BRAND_NAVY, textColor: 255 },
        alternateRowStyles: { fillColor: [247, 246, 243] },
        margin: { top: 26 },
    });

    doc.save(`${safeFilenamePart(filenameBase)}.pdf`);
}
