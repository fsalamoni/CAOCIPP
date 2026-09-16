// ============================================================================
// JURIMETRIA — regras compartilhadas do módulo (flag: jurimetria_enabled)
// ----------------------------------------------------------------------------
// Espelha `src/constants/jurimetria.js` no frontend. O SERVIDOR é a fonte da
// verdade: tudo que chega do cliente passa pelos sanitizadores daqui antes de
// ser gravado.
//
// Mantenha as chaves e os defaults em sincronia entre os dois arquivos.
// ============================================================================

// ----------------------------------------------------------------------------
// Listas oficiais (origem: planilha do CAOJúri — MP/RS)
// ----------------------------------------------------------------------------

export const JURIMETRIA_RESULTADOS: string[] = [
    'PROCEDÊNCIA',
    'PARCIAL PROCEDÊNCIA (QUALIFICADORA)',
    'PARCIAL PROCEDÊNCIA (OUTROS)',
    'PARCIAL PROCEDÊNCIA – MP',
    'IMPROCEDÊNCIA',
    'IMPROCEDÊNCIA-MP',
    'DESCLASSIFICAÇÃO',
    'DESCLASSIFICAÇÃO-MP',
    'DISSOLUÇÃO',
];

/**
 * Variações de grafia aceitas na importação. As chaves são comparadas já
 * normalizadas (sem acento, minúsculas, espaços colapsados).
 */
export const JURIMETRIA_RESULTADO_ALIASES: Record<string, string> = {
    'parcial procedencia': 'PARCIAL PROCEDÊNCIA (QUALIFICADORA)',
    'parcial (qualificadora)': 'PARCIAL PROCEDÊNCIA (QUALIFICADORA)',
    'parcial qualificadora': 'PARCIAL PROCEDÊNCIA (QUALIFICADORA)',
    'parcial (outros)': 'PARCIAL PROCEDÊNCIA (OUTROS)',
    'parcial outros': 'PARCIAL PROCEDÊNCIA (OUTROS)',
    'parcial-mp': 'PARCIAL PROCEDÊNCIA – MP',
    'parcial mp': 'PARCIAL PROCEDÊNCIA – MP',
    'parcial procedencia - mp': 'PARCIAL PROCEDÊNCIA – MP',
    'parcial procedencia mp': 'PARCIAL PROCEDÊNCIA – MP',
    'procedencia': 'PROCEDÊNCIA',
    'improcedencia': 'IMPROCEDÊNCIA',
    'improcedencia-mp': 'IMPROCEDÊNCIA-MP',
    'improcedencia mp': 'IMPROCEDÊNCIA-MP',
    'desclassificacao': 'DESCLASSIFICAÇÃO',
    'desclassificacao-mp': 'DESCLASSIFICAÇÃO-MP',
    'desclassificacao mp': 'DESCLASSIFICAÇÃO-MP',
    'dissolucao': 'DISSOLUÇÃO',
    'dissolvido': 'DISSOLUÇÃO',
    'dissolvida': 'DISSOLUÇÃO',
    'conselho dissolvido': 'DISSOLUÇÃO',
};

export interface JurimetriaTipo {
    sigla: string;
    descricao: string;
}

export const JURIMETRIA_TIPOS: JurimetriaTipo[] = [
    { sigla: 'CM', descricao: 'CONTRA MENOR' },
    { sigla: 'CP', descricao: 'CONTRA POLICIAIS' },
    { sigla: 'D', descricao: 'DOMÉSTICO (GERAL)' },
    { sigla: 'F', descricao: 'FEMINICÍDIO' },
    { sigla: 'FC', descricao: 'FATOS DO COTIDIANO' },
    { sigla: 'PP', descricao: 'PRATICADO POR POLICIAL' },
    { sigla: 'T', descricao: 'TRÁFICO' },
];

export const JURIMETRIA_PONTUACAO_PADRAO: Record<string, number> = {
    'PROCEDÊNCIA': 1.0,
    'PARCIAL PROCEDÊNCIA (QUALIFICADORA)': 0.75,
    'PARCIAL PROCEDÊNCIA (OUTROS)': 0.5,
    'PARCIAL PROCEDÊNCIA – MP': 1.0,
    'IMPROCEDÊNCIA': 0.0,
    'IMPROCEDÊNCIA-MP': 1.0,
    'DESCLASSIFICAÇÃO': 0.25,
    'DESCLASSIFICAÇÃO-MP': 1.0,
    'DISSOLUÇÃO': 0.0,
};

export const JURIMETRIA_DISSOLUCAO_RESULTADOS: string[] = ['DISSOLUÇÃO'];

/**
 * Comarcas do Rio Grande do Sul, no formato "Nome (código)". Usada como lista
 * oficial padrão quando o órgão não configurou a sua.
 */
export const JURIMETRIA_COMARCAS: string[] = [
    'Agudo (0154)', 'Alegrete (0002)', 'Alvorada (0003)', 'Antônio Prado (0079)',
    'Arroio do Meio (0080)', 'Arroio do Tigre (0143)', 'Arroio Grande (0081)',
    'Arvorezinha (0082)', 'Augusto Pestana (0149)', 'Bagé (0004)',
    'Barra do Ribeiro (0140)', 'Bento Gonçalves (0005)', 'Bom Jesus (0083)',
    'Butiá (0084)', 'Caçapava do Sul (0040)', 'Cacequi (0085)',
    'Cachoeira do Sul (0006)', 'Cachoeirinha (0086)', 'Camaquã (0007)',
    'Campina das Missões (0150)', 'Campo Bom (0087)', 'Campo Novo (0088)',
    'Candelária (0089)', 'Canela (0041)', 'Canguçu (0042)', 'Canoas (0008)',
    'Capão da Canoa (0141)', 'Carazinho (0009)', 'Carlos Barbosa (0144)',
    'Casca (0090)', 'Catuípe (0091)', 'Caxias do Sul (0010)', 'Cerro Largo (0043)',
    'Charqueadas (0156)', 'Constantina (0092)', 'Coronel Bicaco (0093)',
    'Crissiumal (0094)', 'Cruz Alta (0011)', 'Dois Irmãos (0145)',
    'Dom Pedrito (0012)', 'Eldorado do Sul (0165)', 'Encantado (0044)',
    'Encruzilhada do Sul (0045)', 'Erechim (0013)', 'Espumoso (0046)',
    'Estância Velha (0095)', 'Esteio (0014)', 'Estrela (0047)',
    'Farroupilha (0048)', 'Faxinal do Soturno (0096)', 'Feliz (0146)',
    'Flores da Cunha (0097)', 'Frederico Westphalen (0049)', 'Garibaldi (0051)',
    'Gaurama (0098)', 'General Câmara (0099)', 'Getúlio Vargas (0050)',
    'Giruá (0100)', 'Gramado (0101)', 'Gravataí (0015)', 'Guaíba (0052)',
    'Guaporé (0053)', 'Guarani das Missões (0102)', 'Herval (0103)',
    'Horizontina (0104)', 'Ibirubá (0105)', 'Igrejinha (0142)', 'Ijuí (0016)',
    'Iraí (0106)', 'Itaqui (0054)', 'Ivoti (0166)', 'Jaguarão (0055)',
    'Jaguari (0107)', 'Júlio de Castilhos (0056)', 'Lagoa Vermelha (0057)',
    'Lajeado (0017)', 'Lavras do Sul (0108)', 'Marau (0109)',
    'Marcelino Ramos (0110)', 'Montenegro (0018)', 'Mostardas (0111)',
    'Não-Me-Toque (0112)', 'Nonoai (0113)', 'Nova Petrópolis (0114)',
    'Nova Prata (0058)', 'Novo Hamburgo (0019)', 'Osório (0059)',
    'Palmares do Sul (0151)', 'Palmeira das Missões (0020)', 'Panambi (0060)',
    'Parobé (0157)', 'Passo Fundo (0021)', 'Pedro Osório (0115)',
    'Pelotas (0022)', 'Pinheiro Machado (0117)', 'Piratini (0118)',
    'Planalto (0116)', 'Portão (0155)', 'Porto Alegre (0001)',
    'Porto Xavier (0119)', 'Quaraí (0061)', 'Restinga Seca (0147)',
    'Rio Grande (0023)', 'Rio Pardo (0024)', 'Rodeio Bonito (0158)',
    'Ronda Alta (0148)', 'Rosário do Sul (0062)', 'Salto do Jacuí (0161)',
    'Sananduva (0120)', 'Santa Bárbara do Sul (0121)', 'Santa Cruz do Sul (0026)',
    'Santa Maria (0027)', 'Santa Rosa (0028)', 'Santa Vitória do Palmar (0063)',
    'Santana do Livramento (0025)', 'Santiago (0064)', 'Santo Ângelo (0029)',
    'Santo Antônio da Patrulha (0065)', 'Santo Antônio das Missões (0122)',
    'Santo Augusto (0123)', 'Santo Cristo (0124)', 'São Borja (0030)',
    'São Francisco de Assis (0125)', 'São Francisco de Paula (0066)',
    'São Gabriel (0031)', 'São Jerônimo (0032)', 'São José do Norte (0126)',
    'São José do Ouro (0127)', 'São Leopoldo (0033)', 'São Lourenço do Sul (0067)',
    'São Luiz Gonzaga (0034)', 'São Marcos (0128)', 'São Pedro do Sul (0129)',
    'São Sebastião do Caí (0068)', 'São Sepé (0130)', 'São Valentim (0152)',
    'São Vicente do Sul (0131)', 'Sapiranga (0132)', 'Sapucaia do Sul (0035)',
    'Sarandi (0069)', 'Seberi (0133)', 'Sobradinho (0134)', 'Soledade (0036)',
    'Tapejara (0135)', 'Tapera (0136)', 'Tapes (0137)', 'Taquara (0070)',
    'Taquari (0071)', 'Tenente Portela (0138)', 'Terra de Areia (0163)',
    'Teutônia (0159)', 'Torres (0072)', 'Tramandaí (0073)', 'Três Coroas (0164)',
    'Três de Maio (0074)', 'Três Passos (0075)', 'Tribunal de Justiça (0700)',
    'Triunfo (0139)', 'Tucunduva (0153)', 'Tupanciretã (0076)',
    'Turmas Recursais (0710)', 'Uruguaiana (0037)', 'Vacaria (0038)',
    'Venâncio Aires (0077)', 'Vera Cruz (0160)', 'Veranópolis (0078)',
    'Viamão (0039)',
];

// ----------------------------------------------------------------------------
// Campos
// ----------------------------------------------------------------------------

/** Campos fixos gravados na raiz do documento `juris/{id}`. */
export const JURIMETRIA_CORE_FIELD_KEYS = [
    'numero_processo',
    'data_juri',
    'comarca',
    'tipo',
    'resultado',
    'promotor',
    'horario',
    'vara',
    'observacoes',
] as const;

export type JurimetriaCoreFieldKey = (typeof JURIMETRIA_CORE_FIELD_KEYS)[number];

/** Campos obrigatórios que o admin nunca pode ocultar. */
export const JURIMETRIA_LOCKED_FIELD_KEYS: string[] = ['numero_processo', 'data_juri'];

export const JURIMETRIA_CUSTOM_FIELD_TYPES = new Set([
    'text', 'textarea', 'number', 'date', 'boolean', 'select',
]);

export interface JurimetriaCustomField {
    key: string;
    label: string;
    type: string;
    options: string[];
    required: boolean;
}

export interface JurimetriaSettings {
    comarcas: string[];
    tipos: JurimetriaTipo[];
    resultados: string[];
    pontuacao: Record<string, number>;
    dissolucaoResultados: string[];
    customFields: JurimetriaCustomField[];
    labelOverrides: Record<string, string>;
    hiddenFields: string[];
    importPolicy: 'preserve' | 'update';
    fuzzyThreshold: number;
    requireResponsible: boolean;
}

export const JURIMETRIA_DEFAULT_SETTINGS: JurimetriaSettings = {
    comarcas: JURIMETRIA_COMARCAS,
    tipos: JURIMETRIA_TIPOS,
    resultados: JURIMETRIA_RESULTADOS,
    pontuacao: JURIMETRIA_PONTUACAO_PADRAO,
    dissolucaoResultados: JURIMETRIA_DISSOLUCAO_RESULTADOS,
    customFields: [],
    labelOverrides: {},
    hiddenFields: [],
    importPolicy: 'preserve',
    fuzzyThreshold: 0.7,
    requireResponsible: false,
};

// ----------------------------------------------------------------------------
// Normalização de texto e correspondência aproximada
// ----------------------------------------------------------------------------

/** Minúsculas, sem acento, sem pontuação redundante, espaços colapsados. */
export function normalizeText(value: unknown): string {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Distância de Levenshtein entre duas strings já normalizadas. */
function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let prev = new Array<number>(b.length + 1);
    let curr = new Array<number>(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;

    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        const tmp = prev;
        prev = curr;
        curr = tmp;
    }
    return prev[b.length];
}

/** Similaridade 0..1 entre dois textos (1 = idênticos após normalização). */
export function similarity(a: string, b: string): number {
    const na = normalizeText(a);
    const nb = normalizeText(b);
    if (!na || !nb) return 0;
    if (na === nb) return 1;
    const maxLen = Math.max(na.length, nb.length);
    return 1 - levenshtein(na, nb) / maxLen;
}

export interface FuzzyResult {
    value: string;
    matched: boolean;
    score: number;
}

/**
 * Casa um texto livre contra uma lista canônica. A ordem de tentativa é:
 *   1. igualdade exata após normalização;
 *   2. o texto é prefixo do canônico (ex.: "Porto Alegre" → "Porto Alegre (0001)");
 *   3. similaridade de Levenshtein acima do limiar configurado pelo órgão.
 * Quando nada bate, devolve o texto original aparado (`matched: false`) — o
 * dado do usuário nunca é descartado por não estar na lista.
 */
export function fuzzyMatchFromList(
    raw: unknown,
    list: string[],
    threshold = 0.7
): FuzzyResult {
    const original = String(raw ?? '').trim();
    if (!original) return { value: '', matched: false, score: 0 };
    const norm = normalizeText(original);

    for (const item of list) {
        if (normalizeText(item) === norm) {
            return { value: item, matched: true, score: 1 };
        }
    }

    // Prefixo: cobre "Porto Alegre" vs "Porto Alegre (0001)".
    for (const item of list) {
        const ni = normalizeText(item);
        if (ni.startsWith(`${norm} (`) || ni === `${norm}`) {
            return { value: item, matched: true, score: 0.95 };
        }
    }

    let best: string | null = null;
    let bestScore = 0;
    for (const item of list) {
        // Compara também contra o nome sem o código entre parênteses.
        const semCodigo = item.replace(/\s*\([^)]*\)\s*$/, '');
        const score = Math.max(similarity(original, item), similarity(original, semCodigo));
        if (score > bestScore) {
            bestScore = score;
            best = item;
        }
    }

    if (best && bestScore >= threshold) {
        return { value: best, matched: true, score: bestScore };
    }
    return { value: original, matched: false, score: bestScore };
}

/**
 * Normaliza uma espécie de resultado: aceita a forma canônica, os apelidos
 * conhecidos e variações de grafia (via fuzzy).
 */
export function normalizeResultado(
    raw: unknown,
    resultados: string[],
    threshold = 0.7
): FuzzyResult {
    const original = String(raw ?? '').trim();
    if (!original) return { value: '', matched: false, score: 0 };

    const alias = JURIMETRIA_RESULTADO_ALIASES[normalizeText(original)];
    if (alias && resultados.includes(alias)) {
        return { value: alias, matched: true, score: 1 };
    }
    return fuzzyMatchFromList(original, resultados, threshold);
}

/**
 * Normaliza a matéria/tipo do júri. Aceita a sigla ("FC"), a descrição
 * ("FATOS DO COTIDIANO") ou o formato combinado ("FC - FATOS DO COTIDIANO").
 * O valor gravado é sempre a SIGLA.
 */
export function normalizeTipo(
    raw: unknown,
    tipos: JurimetriaTipo[],
    threshold = 0.7
): FuzzyResult {
    const original = String(raw ?? '').trim();
    if (!original) return { value: '', matched: false, score: 0 };
    const norm = normalizeText(original);

    for (const t of tipos) {
        if (normalizeText(t.sigla) === norm) return { value: t.sigla, matched: true, score: 1 };
    }
    for (const t of tipos) {
        if (normalizeText(t.descricao) === norm) return { value: t.sigla, matched: true, score: 1 };
    }
    // Formato combinado "SIGLA - DESCRIÇÃO" ou "SIGLA = DESCRIÇÃO".
    const parts = norm.split(/\s*[-=:]\s*/);
    if (parts.length > 1) {
        for (const t of tipos) {
            if (normalizeText(t.sigla) === parts[0]) return { value: t.sigla, matched: true, score: 0.95 };
        }
    }

    let best: JurimetriaTipo | null = null;
    let bestScore = 0;
    for (const t of tipos) {
        const score = similarity(original, t.descricao);
        if (score > bestScore) {
            bestScore = score;
            best = t;
        }
    }
    if (best && bestScore >= threshold) {
        return { value: best.sigla, matched: true, score: bestScore };
    }
    return { value: original, matched: false, score: bestScore };
}

// ----------------------------------------------------------------------------
// Datas e número de processo
// ----------------------------------------------------------------------------

/** Chave de deduplicação: só os dígitos do número do processo. */
export function normalizeProcessNumber(raw: unknown): string {
    return String(raw ?? '').replace(/\D+/g, '');
}

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

/**
 * Converte data em texto BR (dd/mm/aaaa, com `/`, `-` ou `.`), ISO
 * (aaaa-mm-dd) ou serial do Excel para `YYYY-MM-DD`. Devolve `null` quando a
 * data é inválida.
 */
export function parseJuriDate(raw: unknown): string | null {
    if (raw === null || raw === undefined || raw === '') return null;

    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        return toIsoDate(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
    }

    // Serial do Excel (dias desde 30/12/1899).
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        if (raw < 1 || raw > 80000) return null;
        const d = new Date(EXCEL_EPOCH_UTC + Math.round(raw) * 86400000);
        return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }

    const s = String(raw).trim();
    if (!s) return null;

    // Serial numérico vindo como texto.
    if (/^\d{5}$/.test(s)) return parseJuriDate(Number(s));

    // ISO: aaaa-mm-dd (aceita sufixo de hora).
    let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
    if (m) return toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));

    // BR: dd/mm/aaaa ou dd/mm/aa.
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s);
    if (m) {
        let year = Number(m[3]);
        if (year < 100) year += year <= 79 ? 2000 : 1900;
        return toIsoDate(year, Number(m[2]), Number(m[1]));
    }

    return null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (year < 1900 || year > 2200) return null;
    if (month < 1 || month > 12) return null;
    if (day < 1 || day > 31) return null;
    // Rejeita datas que "transbordam" (31/02, por exemplo).
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) return null;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Normaliza o horário para "HHhMM" quando reconhecível; senão devolve o texto. */
export function normalizeHorario(raw: unknown): string {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    const m = /^(\d{1,2})\s*[h:]\s*(\d{1,2})?/.exec(s);
    if (m) {
        const h = Number(m[1]);
        const min = m[2] === undefined ? 0 : Number(m[2]);
        if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
            return `${String(h).padStart(2, '0')}h${String(min).padStart(2, '0')}`;
        }
    }
    return s.slice(0, 40);
}

// ----------------------------------------------------------------------------
// Sanitização da configuração do órgão
// ----------------------------------------------------------------------------

function sanitizeStringList(input: unknown, max: number, fallback: string[]): string[] {
    const arr = Array.isArray(input) ? input : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of arr) {
        const s = String(item ?? '').trim().slice(0, 160);
        if (!s || seen.has(s)) continue;
        seen.add(s);
        out.push(s);
        if (out.length >= max) break;
    }
    return out.length > 0 ? out : fallback;
}

function sanitizeTipos(input: unknown): JurimetriaTipo[] {
    const arr = Array.isArray(input) ? input : [];
    const seen = new Set<string>();
    const out: JurimetriaTipo[] = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        const sigla = String((item as any).sigla ?? '').trim().slice(0, 10).toUpperCase();
        const descricao = String((item as any).descricao ?? '').trim().slice(0, 120);
        if (!sigla || seen.has(sigla)) continue;
        seen.add(sigla);
        out.push({ sigla, descricao: descricao || sigla });
        if (out.length >= 60) break;
    }
    return out.length > 0 ? out : JURIMETRIA_TIPOS;
}

/** Chave de campo personalizada: snake_case seguro, sem colidir com os fixos. */
export function sanitizeFieldKey(raw: unknown): string {
    const base = normalizeText(raw)
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
    if (!base) return '';
    if ((JURIMETRIA_CORE_FIELD_KEYS as readonly string[]).includes(base)) return `${base}_extra`;
    return base;
}

function sanitizeCustomFields(input: unknown): JurimetriaCustomField[] {
    const arr = Array.isArray(input) ? input : [];
    const seen = new Set<string>();
    const out: JurimetriaCustomField[] = [];
    for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        const key = sanitizeFieldKey((item as any).key || (item as any).label);
        if (!key || seen.has(key)) continue;
        const type = JURIMETRIA_CUSTOM_FIELD_TYPES.has((item as any).type)
            ? String((item as any).type)
            : 'text';
        const options = type === 'select'
            ? sanitizeStringList((item as any).options, 100, [])
            : [];
        seen.add(key);
        out.push({
            key,
            label: String((item as any).label ?? key).trim().slice(0, 80) || key,
            type,
            options,
            required: (item as any).required === true,
        });
        if (out.length >= 40) break;
    }
    return out;
}

function sanitizePontuacao(input: unknown, resultados: string[]): Record<string, number> {
    const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const especie of resultados) {
        const raw = Number(source[especie]);
        const fallback = JURIMETRIA_PONTUACAO_PADRAO[especie] ?? 0;
        out[especie] = Number.isFinite(raw)
            ? Math.min(1, Math.max(0, Math.round(raw * 100) / 100))
            : fallback;
    }
    return out;
}

/**
 * Sanitiza `organization.jurimetriaSettings` recebido do cliente. Sempre
 * devolve o objeto completo (com defaults onde o admin não configurou), de
 * modo que nenhuma chave desapareça de um salvamento para o outro.
 */
export function sanitizeJurimetriaSettings(input: unknown): JurimetriaSettings {
    const cfg = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

    const comarcas = sanitizeStringList(cfg.comarcas, 800, JURIMETRIA_COMARCAS);
    const tipos = sanitizeTipos(cfg.tipos);
    const resultados = sanitizeStringList(cfg.resultados, 60, JURIMETRIA_RESULTADOS);
    const customFields = sanitizeCustomFields(cfg.customFields);

    // Rótulos personalizados: só para chaves de campo conhecidas.
    const knownKeys = new Set<string>([
        ...(JURIMETRIA_CORE_FIELD_KEYS as readonly string[]),
        ...customFields.map((f) => f.key),
    ]);
    const labelOverrides: Record<string, string> = {};
    const rawLabels = (cfg.labelOverrides && typeof cfg.labelOverrides === 'object'
        ? cfg.labelOverrides
        : {}) as Record<string, unknown>;
    for (const key of Object.keys(rawLabels)) {
        if (!knownKeys.has(key)) continue;
        if (JURIMETRIA_LOCKED_FIELD_KEYS.includes(key)) continue;
        const label = String(rawLabels[key] ?? '').trim().slice(0, 80);
        if (label) labelOverrides[key] = label;
    }

    const hiddenFields = (Array.isArray(cfg.hiddenFields) ? cfg.hiddenFields : [])
        .map((k) => String(k ?? '').trim())
        .filter((k) => knownKeys.has(k) && !JURIMETRIA_LOCKED_FIELD_KEYS.includes(k))
        .slice(0, 40);

    const fuzzyRaw = Number(cfg.fuzzyThreshold);

    return {
        comarcas,
        tipos,
        resultados,
        pontuacao: sanitizePontuacao(cfg.pontuacao, resultados),
        dissolucaoResultados: sanitizeStringList(
            cfg.dissolucaoResultados,
            20,
            JURIMETRIA_DISSOLUCAO_RESULTADOS
        ).filter((r) => resultados.includes(r)),
        customFields,
        labelOverrides,
        hiddenFields,
        importPolicy: cfg.importPolicy === 'update' ? 'update' : 'preserve',
        fuzzyThreshold: Number.isFinite(fuzzyRaw)
            ? Math.min(1, Math.max(0.4, Math.round(fuzzyRaw * 100) / 100))
            : 0.7,
        requireResponsible: cfg.requireResponsible === true,
    };
}

/**
 * Configuração efetiva do módulo em um órgão, aplicando os defaults onde o
 * admin nunca mexeu. Usada por todas as Cloud Functions do módulo.
 */
export function resolveJurimetriaSettings(orgData: unknown): JurimetriaSettings {
    const cfg = (orgData as any)?.jurimetriaSettings;
    if (!cfg || typeof cfg !== 'object') return { ...JURIMETRIA_DEFAULT_SETTINGS };
    return sanitizeJurimetriaSettings(cfg);
}

// ----------------------------------------------------------------------------
// Sanitização dos valores de um júri
// ----------------------------------------------------------------------------

export interface SanitizedJuriValues {
    /** Campos fixos, prontos para a raiz do documento. */
    core: Record<string, string>;
    /** Campos personalizados, prontos para `values`. */
    values: Record<string, string | number | boolean | null>;
}

/**
 * Sanitiza e normaliza os campos de um júri vindos do cliente ou da planilha.
 * `strict = true` (formulário) aplica as listas oficiais com correspondência
 * exata; `strict = false` (importação) usa correspondência aproximada.
 */
export function sanitizeJuriInput(
    input: Record<string, unknown>,
    settings: JurimetriaSettings,
    opts: { fuzzy?: boolean } = {}
): SanitizedJuriValues {
    const fuzzy = opts.fuzzy === true;
    const threshold = settings.fuzzyThreshold;

    const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

    const comarcaRaw = input.comarca;
    const comarca = fuzzy
        ? fuzzyMatchFromList(comarcaRaw, settings.comarcas, threshold).value
        : text(comarcaRaw, 160);

    const tipoRaw = input.tipo;
    const tipo = fuzzy
        ? normalizeTipo(tipoRaw, settings.tipos, threshold).value
        : text(tipoRaw, 40);

    const resultadoRaw = input.resultado;
    const resultado = fuzzy
        ? normalizeResultado(resultadoRaw, settings.resultados, threshold).value
        : text(resultadoRaw, 80);

    const core: Record<string, string> = {
        numero_processo: text(input.numero_processo, 60),
        data_juri: parseJuriDate(input.data_juri) || '',
        comarca,
        tipo,
        resultado,
        promotor: text(input.promotor, 160),
        horario: normalizeHorario(input.horario),
        vara: text(input.vara, 160),
        observacoes: text(input.observacoes, 2000),
    };

    const rawValues = (input.values && typeof input.values === 'object'
        ? input.values
        : {}) as Record<string, unknown>;

    const values: Record<string, string | number | boolean | null> = {};
    for (const field of settings.customFields) {
        const raw = rawValues[field.key];
        if (raw === undefined || raw === null || raw === '') {
            values[field.key] = field.type === 'boolean' ? false : '';
            continue;
        }
        switch (field.type) {
            case 'number': {
                const n = Number(String(raw).replace(/\./g, '').replace(',', '.'));
                values[field.key] = Number.isFinite(n) ? n : null;
                break;
            }
            case 'boolean': {
                const s = normalizeText(raw);
                values[field.key] = raw === true || ['sim', 'true', '1', 'yes', 'x'].includes(s);
                break;
            }
            case 'date':
                values[field.key] = parseJuriDate(raw) || '';
                break;
            case 'select': {
                const match = fuzzy
                    ? fuzzyMatchFromList(raw, field.options, threshold).value
                    : String(raw).trim();
                values[field.key] = field.options.includes(match) ? match : (fuzzy ? match.slice(0, 160) : '');
                break;
            }
            case 'textarea':
                values[field.key] = text(raw, 2000);
                break;
            default:
                values[field.key] = text(raw, 300);
        }
    }

    return { core, values };
}

/** Campos comparados para decidir se um registro importado diverge do banco. */
export const JURI_COMPARABLE_FIELDS: string[] = [
    'data_juri', 'comarca', 'tipo', 'resultado', 'promotor', 'horario', 'vara', 'observacoes',
];
