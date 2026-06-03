const LOWERCASE_PARTICLES = new Set([
    'de', 'da', 'do', 'das', 'dos',
    'e', 'em', 'na', 'no', 'nas', 'nos',
    'a', 'o', 'as', 'os', 'di', 'du', 'del', 'della', 'van', 'von'
]);

function capitalizeWord(word: string): string {
    if (!word) return '';
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatToken(token: string, index: number): string {
    const lower = token.toLowerCase();
    if (index > 0 && LOWERCASE_PARTICLES.has(lower)) return lower;

    return token
        .split('-')
        .map((part, partIndex) => {
            const partLower = part.toLowerCase();
            if (partIndex > 0 && LOWERCASE_PARTICLES.has(partLower)) return partLower;
            return capitalizeWord(part);
        })
        .join('-');
}

export function formatPersonName(value: unknown): string {
    if (value === null || value === undefined) return '';
    const trimmed = String(value).trim().replace(/\s+/g, ' ');
    if (!trimmed) return '';

    return trimmed
        .split(' ')
        .map((token, index) => formatToken(token, index))
        .join(' ');
}

