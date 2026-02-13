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
