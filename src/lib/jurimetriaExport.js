// ============================================================================
// jurimetriaExport — geração de documentos do módulo de Jurimetria
// ----------------------------------------------------------------------------
// Seis formatos, todos gerados no navegador e sem nenhuma dependência nova:
//   Excel (.xlsx) .. biblioteca `xlsx`, já usada na exportação de tabelas
//   PDF (.pdf) .... jsPDF + autotable, mesmo visual das demais exportações
//   Word (.doc) ... HTML com media type do Word (abre no Word/LibreOffice)
//   Markdown (.md) tabela em texto, para colar em documentos e wikis
//   CSV (.csv) .... separador ponto e vírgula (padrão do Excel em pt-BR)
//   JSON (.json) .. dados brutos, para backup e integração
//
// Toda saída de texto passa por `sanitizeCellValue`, que neutraliza a injeção
// de fórmulas em planilhas (mesma mitigação de `lib/tableExport.js`).
// ============================================================================

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND_NAVY = [51, 73, 92]; // #33495C — mesma cor das demais exportações

const FORMULA_INJECTION_PREFIX = /^[=+\-@\t\r]/;

function sanitizeCellValue(value) {
    if (typeof value !== 'string') return value;
    return FORMULA_INJECTION_PREFIX.test(value) ? `'${value}` : value;
}

/** Nome de arquivo seguro: sem acento, sem espaço, sem caractere especial. */
export function safeFilename(text) {
    return String(text || 'jurimetria')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9-_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'jurimetria';
}

/** Sufixo de data para o nome do arquivo (aaaa-mm-dd). */
export function dateSuffix() {
    return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Revoga no próximo tick: revogar de imediato cancela o download no Safari.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Converte a linha em texto plano, respeitando o extrator de cada coluna. */
function rowToCells(row, columns) {
    return columns.map((col) => {
        const raw = typeof col.value === 'function' ? col.value(row) : row?.[col.key];
        if (raw === null || raw === undefined) return '';
        if (raw === true) return 'Sim';
        if (raw === false) return 'Não';
        return raw;
    });
}

// ----------------------------------------------------------------------------
// Tabelas (lista de júris, rankings, relatórios estáticos)
// ----------------------------------------------------------------------------

/**
 * @typedef {{ label: string, key?: string, value?: (row:object)=>any }} ExportColumn
 */

/** Excel (.xlsx) — uma aba com os dados, larguras de coluna automáticas. */
export function exportTableToExcel({ rows, columns, filenameBase, sheetName = 'Júris' }) {
    const data = (rows || []).map((row) => {
        const cells = rowToCells(row, columns);
        const obj = {};
        columns.forEach((col, i) => {
            obj[col.label] = sanitizeCellValue(cells[i]);
        });
        return obj;
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    worksheet['!cols'] = columns.map((col) => ({
        wch: Math.min(
            60,
            Math.max(
                12,
                col.label.length + 2,
                ...(rows || []).slice(0, 200).map((row) => {
                    const cells = rowToCells(row, columns);
                    const idx = columns.indexOf(col);
                    return String(cells[idx] ?? '').length + 2;
                })
            )
        ),
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
    XLSX.writeFile(workbook, `${safeFilename(filenameBase)}.xlsx`);
}

/** Excel (.xlsx) com várias abas — usado no pacote completo de relatórios. */
export function exportSheetsToExcel({ sheets, filenameBase }) {
    const workbook = XLSX.utils.book_new();
    for (const sheet of sheets || []) {
        const data = (sheet.rows || []).map((row) => {
            const cells = rowToCells(row, sheet.columns);
            const obj = {};
            sheet.columns.forEach((col, i) => {
                obj[col.label] = sanitizeCellValue(cells[i]);
            });
            return obj;
        });
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, String(sheet.name || 'Dados').slice(0, 31));
    }
    XLSX.writeFile(workbook, `${safeFilename(filenameBase)}.xlsx`);
}

/** PDF (.pdf) — cabeçalho com título, subtítulo e data de geração. */
export function exportTableToPdf({ rows, columns, filenameBase, title, subtitle }) {
    const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });

    doc.setFontSize(14);
    doc.setTextColor(...BRAND_NAVY);
    doc.text(String(title || 'Jurimetria'), 14, 15);

    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    const linhaSub = [
        subtitle,
        `${(rows || []).length} registro(s)`,
        `Gerado em ${new Date().toLocaleString('pt-BR')}`,
    ].filter(Boolean).join(' — ');
    doc.text(linhaSub, 14, 21);

    autoTable(doc, {
        startY: 26,
        head: [columns.map((c) => c.label)],
        body: (rows || []).map((row) => rowToCells(row, columns).map((v) => (
            v === '' || v === null || v === undefined ? '-' : String(v)
        ))),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: BRAND_NAVY, textColor: 255 },
        alternateRowStyles: { fillColor: [247, 246, 243] },
        margin: { top: 26 },
    });

    doc.save(`${safeFilename(filenameBase)}.pdf`);
}

/**
 * Word (.doc) — documento HTML com o media type do Word. Abre no Microsoft
 * Word, no LibreOffice e no Google Docs, e mantém a tabela editável (o que um
 * PDF não permite). Evita trazer uma biblioteca de .docx só para isso.
 */
export function exportTableToDoc({ rows, columns, filenameBase, title, subtitle }) {
    const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('');
    const body = (rows || []).map((row) => {
        const cells = rowToCells(row, columns)
            .map((v) => `<td>${escapeHtml(v === '' || v === null || v === undefined ? '-' : v)}</td>`)
            .join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    const html = buildDocHtml({
        title,
        subtitle: [subtitle, `${(rows || []).length} registro(s)`].filter(Boolean).join(' — '),
        content: `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
    });

    triggerDownload(
        new Blob(['﻿', html], { type: 'application/msword' }),
        `${safeFilename(filenameBase)}.doc`
    );
}

/** Markdown (.md) — tabela em texto puro. */
export function exportTableToMarkdown({ rows, columns, filenameBase, title, subtitle }) {
    const markdown = buildTableMarkdown({ rows, columns, title, subtitle });
    triggerDownload(
        new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
        `${safeFilename(filenameBase)}.md`
    );
}

/** Monta (sem baixar) a tabela em Markdown — útil para pré-visualizar. */
export function buildTableMarkdown({ rows, columns, title, subtitle }) {
    const escapeCell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    const linhas = [];
    if (title) {
        linhas.push(`# ${title}`, '');
    }
    const sub = [subtitle, `${(rows || []).length} registro(s)`, `Gerado em ${new Date().toLocaleString('pt-BR')}`]
        .filter(Boolean).join(' — ');
    linhas.push(sub, '');
    linhas.push(`| ${columns.map((c) => escapeCell(c.label)).join(' | ')} |`);
    linhas.push(`| ${columns.map(() => '---').join(' | ')} |`);
    for (const row of rows || []) {
        linhas.push(`| ${rowToCells(row, columns).map(escapeCell).join(' | ')} |`);
    }
    return linhas.join('\n');
}

/** CSV (.csv) — separador `;`, com BOM para o Excel em português abrir certo. */
export function exportTableToCsv({ rows, columns, filenameBase }) {
    const escape = (v) => {
        const s = String(sanitizeCellValue(v ?? ''));
        return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = [columns.map((c) => escape(c.label)).join(';')];
    for (const row of rows || []) {
        linhas.push(rowToCells(row, columns).map(escape).join(';'));
    }
    triggerDownload(
        new Blob(['﻿', linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' }),
        `${safeFilename(filenameBase)}.csv`
    );
}

/** JSON (.json) — dados brutos, prontos para reimportação ou integração. */
export function exportToJson({ data, filenameBase }) {
    triggerDownload(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' }),
        `${safeFilename(filenameBase)}.json`
    );
}

// ----------------------------------------------------------------------------
// Texto corrido (relatório descritivo)
// ----------------------------------------------------------------------------

/** Markdown (.md) já pronto (vindo de `buildDescritivo`). */
export function exportMarkdown({ markdown, filenameBase }) {
    triggerDownload(
        new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
        `${safeFilename(filenameBase)}.md`
    );
}

/** Word (.doc) a partir de um texto em Markdown. */
export function exportMarkdownToDoc({ markdown, filenameBase, title }) {
    const html = buildDocHtml({
        title,
        subtitle: `Gerado em ${new Date().toLocaleString('pt-BR')}`,
        content: markdownToHtml(markdown),
    });
    triggerDownload(
        new Blob(['﻿', html], { type: 'application/msword' }),
        `${safeFilename(filenameBase)}.doc`
    );
}

/** PDF (.pdf) a partir de um texto em Markdown, com quebra de página. */
export function exportMarkdownToPdf({ markdown, filenameBase, title }) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const marginX = 16;
    const marginTop = 18;
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;
    let y = marginTop;

    doc.setFontSize(15);
    doc.setTextColor(...BRAND_NAVY);
    doc.text(String(title || 'Relatório de jurimetria'), marginX, y);
    y += 7;
    doc.setFontSize(9);
    doc.setTextColor(130, 130, 130);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, marginX, y);
    y += 8;

    const newPageIfNeeded = (needed) => {
        if (y + needed > pageHeight - 16) {
            doc.addPage();
            y = marginTop;
        }
    };

    for (const rawLine of String(markdown || '').split('\n')) {
        const line = rawLine.trimEnd();

        if (!line) { y += 3; continue; }

        if (line.startsWith('# ')) {
            newPageIfNeeded(12);
            doc.setFontSize(13);
            doc.setTextColor(...BRAND_NAVY);
            doc.text(line.slice(2), marginX, y);
            y += 8;
            continue;
        }
        if (line.startsWith('## ')) {
            newPageIfNeeded(11);
            doc.setFontSize(11);
            doc.setTextColor(...BRAND_NAVY);
            doc.text(line.slice(3), marginX, y);
            y += 7;
            continue;
        }

        const isBullet = /^\s*-\s+/.test(line);
        const indent = isBullet ? (line.match(/^\s*/)?.[0].length || 0) >= 2 ? 10 : 5 : 0;
        const text = line.replace(/^\s*-\s+/, isBullet ? '• ' : '').replace(/\*\*/g, '');

        doc.setFontSize(9.5);
        doc.setTextColor(40, 40, 40);
        const wrapped = doc.splitTextToSize(text, maxWidth - indent);
        for (const piece of wrapped) {
            newPageIfNeeded(6);
            doc.text(piece, marginX + indent, y);
            y += 5;
        }
    }

    doc.save(`${safeFilename(filenameBase)}.pdf`);
}

/** Texto puro (.txt) a partir do Markdown, sem a marcação. */
export function exportMarkdownToTxt({ markdown, filenameBase }) {
    const texto = String(markdown || '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/^\s*-\s+/gm, '• ');
    triggerDownload(
        new Blob([texto], { type: 'text/plain;charset=utf-8' }),
        `${safeFilename(filenameBase)}.txt`
    );
}

// ----------------------------------------------------------------------------
// Auxiliares de formatação
// ----------------------------------------------------------------------------

/** Documento HTML com estilo alinhado ao visual da plataforma. */
function buildDocHtml({ title, subtitle, content }) {
    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title || 'Jurimetria')}</title>
<style>
  @page { size: A4; margin: 2cm; }
  body { font-family: "Calibri", "Segoe UI", Arial, sans-serif; font-size: 11pt; color: #1f2937; }
  h1 { font-size: 16pt; color: #33495C; margin: 0 0 4pt; }
  h2 { font-size: 13pt; color: #33495C; margin: 16pt 0 6pt; }
  h3 { font-size: 11.5pt; color: #33495C; margin: 12pt 0 4pt; }
  p  { margin: 0 0 6pt; line-height: 1.45; }
  .subtitulo { color: #6b7280; font-size: 9pt; margin-bottom: 14pt; }
  table { border-collapse: collapse; width: 100%; font-size: 9pt; }
  th { background: #33495C; color: #fff; text-align: left; padding: 5pt 6pt; border: 0.5pt solid #33495C; }
  td { padding: 4pt 6pt; border: 0.5pt solid #d1d5db; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f6f3; }
  ul { margin: 0 0 8pt 16pt; padding: 0; }
  li { margin-bottom: 3pt; line-height: 1.4; }
</style>
</head>
<body>
<h1>${escapeHtml(title || 'Jurimetria')}</h1>
${subtitle ? `<p class="subtitulo">${escapeHtml(subtitle)}</p>` : ''}
${content}
</body>
</html>`;
}

/** Conversão mínima de Markdown para HTML (títulos, listas, negrito). */
function markdownToHtml(markdown) {
    const out = [];
    let inList = false;

    const closeList = () => {
        if (inList) {
            out.push('</ul>');
            inList = false;
        }
    };

    const inline = (text) => escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    for (const rawLine of String(markdown || '').split('\n')) {
        const line = rawLine.trimEnd();

        if (!line) { closeList(); continue; }

        if (line.startsWith('### ')) { closeList(); out.push(`<h3>${inline(line.slice(4))}</h3>`); continue; }
        if (line.startsWith('## ')) { closeList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); continue; }
        if (line.startsWith('# ')) { closeList(); out.push(`<h1>${inline(line.slice(2))}</h1>`); continue; }

        const bullet = /^(\s*)-\s+(.*)$/.exec(line);
        if (bullet) {
            if (!inList) { out.push('<ul>'); inList = true; }
            out.push(`<li>${inline(bullet[2])}</li>`);
            continue;
        }

        closeList();
        out.push(`<p>${inline(line)}</p>`);
    }
    closeList();
    return out.join('\n');
}
