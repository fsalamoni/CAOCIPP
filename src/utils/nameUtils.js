const LOWERCASE_PARTICLES = new Set([
    'de', 'da', 'do', 'das', 'dos',
    'e', 'em', 'na', 'no', 'nas', 'nos',
    'a', 'o', 'as', 'os', 'di', 'du', 'del', 'della', 'van', 'von'
]);

const capitalizeWord = (word) => {
    if (!word) return '';
    const lower = word.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const formatToken = (token, index) => {
    if (!token) return token;
    const lower = token.toLowerCase();
    if (index > 0 && LOWERCASE_PARTICLES.has(lower)) return lower;
    return token
        .split('-')
        .map((part, i) => {
            const partLower = part.toLowerCase();
            if (i > 0 && LOWERCASE_PARTICLES.has(partLower)) return partLower;
            return capitalizeWord(part);
        })
        .join('-');
};

export function formatPersonName(name) {
    if (typeof name !== 'string') return name || '';
    const trimmed = name.trim().replace(/\s+/g, ' ');
    if (!trimmed) return '';

    return trimmed
        .split(' ')
        .map((token, index) => formatToken(token, index))
        .join(' ');
}

