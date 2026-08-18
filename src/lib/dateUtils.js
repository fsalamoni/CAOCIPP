/**
 * Safely parses a date string or object into a local Date object.
 * Handles YYYY-MM-DD and DD/MM/YYYY strings by splitting to avoid UTC shift.
 * Also supports Firestore Timestamps and Date objects.
 * 
 * @param {any} value 
 * @returns {Date}
 */
export function parseLocalDate(value) {
    if (!value) return new Date(NaN);
    if (value instanceof Date) return value;

    // Handle Firestore Timestamp
    if (typeof value === 'object' && value.seconds !== undefined) {
        return new Date(value.seconds * 1000);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();

        // Brazilian Format: DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
            const [d, m, y] = trimmed.split('/').map(Number);
            return new Date(y, m - 1, d);
        }

        // ISO Date Format: YYYY-MM-DD (Avoids UTC shift)
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const [y, m, d] = trimmed.split('-').map(Number);
            return new Date(y, m - 1, d);
        }

        const result = new Date(trimmed);
        if (!isNaN(result.getTime())) return result;
    }

    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date(NaN) : d;
}

/**
 * Calculates the number of business days (Monday to Friday) between two dates.
 * 
 * @param {Date|string} startDate 
 * @param {Date|string} endDate 
 * @returns {number}
 */
export function calculateBusinessDays(startDate, endDate) {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (start > end) return 0;

    let count = 0;
    let curDate = new Date(start);

    // Normalize to start of day for accurate comparison
    curDate.setHours(0, 0, 0, 0);
    const finalDate = new Date(end);
    finalDate.setHours(0, 0, 0, 0);

    while (curDate <= finalDate) {
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++;
        }
        curDate.setDate(curDate.getDate() + 1);
    }

    return count;
}

/**
 * Calculates the number of calendar days between two dates (inclusive of
 * both endpoints, matching calculateBusinessDays' counting convention —
 * the same day counts as 1).
 *
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {number}
 */
export function calculateCalendarDays(startDate, endDate) {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (start > end) return 0;

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

// ============================================================================
// Vigência / prazos (número + unidade) — formato unificado com o aditivo.
// ============================================================================

// Unidades aceitas para prazos de vigência/prorrogação.
export const VIGENCIA_UNITS = ['dias', 'meses', 'anos'];

function fmtISO(dt) {
    if (Number.isNaN(dt.getTime())) return null;
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

/**
 * Soma uma duração (valor + unidade) a uma data e devolve 'yyyy-MM-dd'.
 * Espelha functions-v2/src/parcerias/concludeAditivo.addDurationToDate:
 * para meses/anos faz "clamp" no último dia do mês-alvo (31/01 + 1 mês → 28/02).
 *
 * @param {string|Date} dateStr data base
 * @param {number} valor quantidade
 * @param {string} unidade 'dias' | 'meses' | 'anos'
 * @returns {string|null} data resultante em 'yyyy-MM-dd' ou null
 */
export function addDurationToDate(dateStr, valor, unidade) {
    const base = parseLocalDate(dateStr);
    if (isNaN(base.getTime())) return null;
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) return null;

    const y = base.getFullYear();
    const mo = base.getMonth();
    const d = base.getDate();

    if (unidade === 'dias') {
        return fmtISO(new Date(y, mo, d + n, 12, 0, 0));
    }
    if (unidade === 'meses' || unidade === 'anos') {
        const monthsToAdd = unidade === 'anos' ? n * 12 : n;
        const total = mo + monthsToAdd;
        const targetYear = y + Math.floor(total / 12);
        const targetMonth = ((total % 12) + 12) % 12;
        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        const day = Math.min(d, lastDay);
        return fmtISO(new Date(targetYear, targetMonth, day, 12, 0, 0));
    }
    return null;
}

/**
 * Verifica se a vigência é "Indeterminada" (sem prazo definido).
 * Considera 'Indeterminado', 'indeterminado', 'Indeterminada', etc.
 *
 * @param {string|number|object} validityText texto da vigência (ex.: '12 meses', 'Indeterminado')
 * @returns {boolean}
 */
export function isIndeterminateValidity(validityText) {
    if (validityText == null) return false;
    const s = String(validityText).toLowerCase().trim();
    return s.startsWith('indeterm');
}

/**
 * Calcula o Termo Final a partir dos campos de vigência.
 * Helper centralizado para Parceria (item 6 do plano): usado por
 * EditParceriaDialog, ParceriaKanbanTransitionDialog, e qualquer
 * outro lugar que precisar do cálculo.
 *
 * @param {object} opts
 * @param {string} opts.signatureDate 'yyyy-MM-dd' (assinatura)
 * @param {string} opts.demp 'yyyy-MM-dd' (publicação no DEMP)
 * @param {string} [opts.validityStartsFrom] 'signature_date' | 'demp' (default: signature_date)
 * @param {string} [opts.validityPeriod] texto da vigência (ex.: '12 meses', 'Indeterminado')
 * @param {number|string} [opts.validityValue] número (forma estruturada)
 * @param {string} [opts.validityUnit] unidade (dias|meses|anos)
 * @param {string} [opts.endDate] termo final atual (se já calculado manualmente)
 * @returns {string|null} data 'yyyy-MM-dd' ou null
 */
export function calculateEndDate({
    signatureDate,
    demp,
    validityStartsFrom = 'signature_date',
    validityPeriod,
    validityValue,
    validityUnit,
    endDate,
} = {}) {
    // Se a vigência é Indeterminada, termo final é sempre vazio.
    if (isIndeterminateValidity(validityPeriod)) {
        return null;
    }
    // Se já tem end_date manual, mantém.
    if (endDate) {
        return endDate;
    }
    // Calcula pela vigência estruturada (valor + unidade).
    if (validityValue && Number(validityValue) > 0) {
        const base = validityStartsFrom === 'demp' ? demp : signatureDate;
        if (base) {
            return addDurationToDate(base, Number(validityValue), validityUnit || 'meses');
        }
    }
    // Fallback: tenta interpretar texto de vigência (legado).
    const parsed = parseValidityPeriod(validityPeriod);
    if (parsed && signatureDate) {
        return addDurationToDate(signatureDate, parsed.value, parsed.unit);
    }
    return null;
}

/**
 * Calcula a "Data do Aviso de Renovação" (item 7 do plano).
 * Base: Termo Final (end_date) - X (período) unidades para trás.
 *
 * @param {string} endDate 'yyyy-MM-dd' (termo final)
 * @param {number} period quantidade de tempo antes do termo final
 * @param {string} unit 'dias' | 'meses' | 'anos'
 * @returns {string|null} data 'yyyy-MM-dd' ou null
 */
export function calculateRenewalNoticeDate(endDate, period, unit) {
    if (!endDate || !period || !unit) return null;
    const n = Number(period);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (!VIGENCIA_UNITS.includes(unit)) return null;
    return addDurationToDate(endDate, -n, unit);
}

/**
 * Calcula a "Data do Aviso de Revisão" (item 8 do plano).
 * Base: data da assinatura (ou DEMP, conforme validity_starts_from) + período.
 *
 * @param {string} signatureDate 'yyyy-MM-dd'
 * @param {string} demp 'yyyy-MM-dd'
 * @param {string} startsFrom 'signature_date' | 'demp' (default: signature_date)
 * @param {number} period quantidade de tempo
 * @param {string} unit 'dias' | 'meses' | 'anos'
 * @returns {string|null} data 'yyyy-MM-dd' ou null
 */
export function calculateReviewNoticeDate(signatureDate, demp, startsFrom, period, unit) {
    if (!period || !unit) return null;
    const n = Number(period);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (!VIGENCIA_UNITS.includes(unit)) return null;
    const base = startsFrom === 'demp' ? demp : signatureDate;
    if (!base) return null;
    return addDurationToDate(base, n, unit);
}

/**
 * Interpreta um texto de vigência ('12 meses', '2 anos', '90 dias', '12
 * meses; +6 meses (aditivo nº 1)') no par { value, unit }. Usa a PRIMEIRA
 * ocorrência número+unidade. Retorna null quando não há um par reconhecível
 * (ex.: 'Indeterminado'), para que o chamador preserve o valor legado.
 *
 * @param {string} text
 * @returns {{value:number, unit:string}|null}
 */
export function parseValidityPeriod(text) {
    const s = String(text ?? '').trim().toLowerCase();
    if (!s) return null;
    const m = /(\d+)\s*(dia|dias|m[eê]s|meses|ano|anos)/.exec(s);
    if (!m) return null;
    const value = Number(m[1]);
    if (!Number.isFinite(value) || value <= 0) return null;
    const raw = m[2];
    let unit = 'meses';
    if (raw.startsWith('dia')) unit = 'dias';
    else if (raw.startsWith('ano')) unit = 'anos';
    else unit = 'meses';
    return { value, unit };
}

/**
 * Compõe o texto de vigência a partir de valor + unidade ('12 meses').
 * Devolve '' quando o valor é inválido.
 */
export function formatValidityPeriod(value, unit) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '';
    const u = VIGENCIA_UNITS.includes(unit) ? unit : 'meses';
    return `${n} ${u}`;
}
