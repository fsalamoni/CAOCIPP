/**
 * Calculates the number of business days (Monday to Friday) between two dates.
 * 
 * @param {Date|string} startDate 
 * @param {Date|string} endDate 
 * @returns {number}
 */
export function calculateBusinessDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

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
