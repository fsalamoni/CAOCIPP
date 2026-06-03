// ============================================================================
// spreadsheet — leitura e mapeamento de planilhas no cliente (xlsx/csv)
// ----------------------------------------------------------------------------
// Usado pela importação de planilhas das páginas personalizadas:
//   1) Importar ESTRUTURA: lê os cabeçalhos e propõe colunas (campos) com tipo
//      inferido. O criador então atribui as fases por cima dessas colunas.
//   2) Importar DADOS: mapeia cada coluna da plataforma a uma coluna da
//      planilha — por NOME do cabeçalho ou pela LETRA da coluna (A, B, C...) —
//      e converte os valores para o tipo de cada campo.
// ============================================================================

import * as XLSX from 'xlsx';
import { emptyValueForType } from '@/lib/fieldTypes';

/** Converte um índice 0-based na letra da coluna (0 -> A, 26 -> AA). */
export function columnLetter(index) {
    let i = Number(index);
    let s = '';
    do {
        s = String.fromCharCode(65 + (i % 26)) + s;
        i = Math.floor(i / 26) - 1;
    } while (i >= 0);
    return s;
}

/** slug estável (espelha o usado no construtor). */
export function slugify(s) {
    return String(s || '')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^([0-9])/, 'f$1')
        .slice(0, 40) || 'coluna';
}

/** Normaliza um texto para comparação de nomes de cabeçalho. */
export function normalizeHeader(s) {
    return String(s ?? '')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim();
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Lê um arquivo de planilha e retorna a estrutura tabular.
 * @returns {Promise<{ sheetName, sheetNames, columns, rows }>} onde
 *   columns = [{ index, letter, name, key }]
 *   rows    = array de arrays alinhadas ao índice das colunas
 */
export async function parseSpreadsheetFile(file, opts = {}) {
    const buffer = await readFileAsArrayBuffer(file);
    const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetNames = wb.SheetNames || [];
    const sheetName = opts.sheetName && sheetNames.includes(opts.sheetName)
        ? opts.sheetName
        : sheetNames[0];
    if (!sheetName) throw new Error('A planilha não tem abas legíveis.');

    const ws = wb.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
    if (!matrix.length) throw new Error('A planilha está vazia.');

    // Primeira linha não vazia vira o cabeçalho.
    let headerRowIdx = matrix.findIndex((r) => Array.isArray(r) && r.some((c) => c !== null && c !== ''));
    if (headerRowIdx < 0) headerRowIdx = 0;
    const headerRow = matrix[headerRowIdx] || [];
    const width = matrix.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), headerRow.length);

    const seen = {};
    const columns = [];
    for (let i = 0; i < width; i += 1) {
        const rawName = headerRow[i];
        const name = (rawName === null || rawName === undefined || String(rawName).trim() === '')
            ? `Coluna ${columnLetter(i)}`
            : String(rawName).trim();
        let key = slugify(name);
        if (seen[key]) { seen[key] += 1; key = `${key}_${seen[key]}`; } else { seen[key] = 1; }
        columns.push({ index: i, letter: columnLetter(i), name, key });
    }

    const rows = [];
    for (let r = headerRowIdx + 1; r < matrix.length; r += 1) {
        const raw = matrix[r] || [];
        if (!raw.some((c) => c !== null && c !== '' && c !== undefined)) continue; // pula linhas vazias
        const aligned = [];
        for (let i = 0; i < width; i += 1) aligned[i] = raw[i] ?? null;
        rows.push(aligned);
    }

    return { sheetName, sheetNames, columns, rows };
}

// ---------------------------------------------------------------------------
// Inferência de tipo a partir de amostras
// ---------------------------------------------------------------------------
const BOOL_WORDS = new Set(['sim', 'nao', 'não', 'true', 'false', 'verdadeiro', 'falso', 'yes', 'no', 's', 'n']);

function looksLikeNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v);
    const s = String(v).trim().replace(/^r\$\s*/i, '').replace(/\./g, '').replace(',', '.');
    return s !== '' && Number.isFinite(Number(s));
}

/** Infere o melhor tipo de campo para uma amostra de valores de uma coluna. */
export function inferFieldType(samples) {
    const vals = (samples || []).filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    if (vals.length === 0) return 'text';

    if (vals.every((v) => v instanceof Date)) return 'date';
    if (vals.every((v) => BOOL_WORDS.has(normalizeHeader(v)))) return 'boolean';
    if (vals.every(looksLikeNumber)) {
        const hasCurrency = vals.some((v) => /r\$/i.test(String(v)) || /,\d{2}\b/.test(String(v)));
        return hasCurrency ? 'currency' : 'number';
    }

    // Poucas opções distintas e texto curto → lista (select).
    const distinct = new Set(vals.map((v) => normalizeHeader(v)));
    const avgLen = vals.reduce((s, v) => s + String(v).length, 0) / vals.length;
    if (distinct.size > 1 && distinct.size <= 12 && vals.length >= distinct.size * 2 && avgLen <= 30) {
        return 'select';
    }
    if (avgLen > 60) return 'textarea';
    return 'text';
}

/**
 * Propõe campos (colunas da plataforma) a partir das colunas da planilha.
 * Cada campo já vem com chave, rótulo, tipo inferido e opções (para listas).
 */
export function proposeFieldsFromColumns(columns, rows) {
    return columns.map((col) => {
        const samples = rows.slice(0, 60).map((r) => r[col.index]);
        const type = inferFieldType(samples);
        const field = {
            key: col.key,
            label: col.name,
            type,
            required: false,
            options: [],
            help: '',
            table: { show: true },
            form: { show: true },
            _sourceIndex: col.index, // usado só na UI de importação
        };
        if (type === 'select' || type === 'multiselect') {
            const seen = new Set();
            for (const s of samples) {
                const label = String(s ?? '').trim();
                if (!label) continue;
                const value = slugify(label);
                if (seen.has(value)) continue;
                seen.add(value);
                field.options.push({ value, label });
            }
        }
        return field;
    });
}

// ---------------------------------------------------------------------------
// Conversão de um valor da planilha para o tipo do campo
// ---------------------------------------------------------------------------
function pad2(n) { return String(n).padStart(2, '0'); }

/** Converte diversas representações de data em 'YYYY-MM-DD' (ou ''). */
export function parseDateCell(value) {
    if (value === null || value === undefined || value === '') return '';
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        try {
            const d = XLSX.SSF.parse_date_code(value);
            if (d && d.y) return `${d.y}-${pad2(d.m)}-${pad2(d.d)}`;
        } catch { /* ignora */ }
    }
    const s = String(value).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;
    m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/); // DD/MM/YYYY ou DD-MM-YYYY
    if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
    return '';
}

/** Converte texto/numero em número (aceita formato brasileiro 1.234,56). */
export function parseNumberCell(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    let s = String(value ?? '').trim().replace(/^r\$\s*/i, '').replace(/\s/g, '');
    if (s === '') return null;
    if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function matchOption(options, raw) {
    const norm = normalizeHeader(raw);
    const byValue = (options || []).find((o) => normalizeHeader(o.value) === norm);
    if (byValue) return byValue.value;
    const byLabel = (options || []).find((o) => normalizeHeader(o.label) === norm);
    return byLabel ? byLabel.value : '';
}

/** Converte um valor cru da planilha para o formato esperado pelo campo. */
export function coerceImportedValue(field, raw) {
    if (raw === null || raw === undefined || String(raw).trim() === '') {
        return emptyValueForType(field.type);
    }
    switch (field.type) {
        case 'number':
        case 'currency': {
            const n = parseNumberCell(raw);
            return n === null ? '' : n;
        }
        case 'date':
            return parseDateCell(raw);
        case 'boolean': {
            const n = normalizeHeader(raw);
            return ['sim', 's', 'true', 'verdadeiro', 'yes', 'y', '1'].includes(n);
        }
        case 'select':
            return matchOption(field.options, raw);
        case 'multiselect': {
            const parts = String(raw).split(/[;,/|]/).map((p) => p.trim()).filter(Boolean);
            return parts.map((p) => matchOption(field.options, p)).filter(Boolean);
        }
        default:
            return String(raw).trim();
    }
}

/**
 * Sugere automaticamente a coluna de origem para cada campo, casando o nome do
 * campo com o nome do cabeçalho da planilha. Retorna { fieldKey: columnIndex }.
 */
export function autoMatchColumns(fields, columns) {
    const byName = {};
    for (const col of columns) byName[normalizeHeader(col.name)] = col.index;
    const map = {};
    for (const f of fields) {
        const hit = byName[normalizeHeader(f.label)];
        if (hit !== undefined) map[f.key] = hit;
        else if (byName[normalizeHeader(f.key)] !== undefined) map[f.key] = byName[normalizeHeader(f.key)];
    }
    return map;
}
