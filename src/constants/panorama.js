// ============================================================================
// Panorama — catálogo de papéis, tipos e defaults do módulo
// ----------------------------------------------------------------------------
// Espelho de `functions-v2/src/shared/panorama.ts`. A inferência roda no
// servidor (é lá que a planilha é lida); aqui ficam os rótulos, as descrições
// e os helpers que a interface e o motor de cálculo usam.
//
// A ideia central do módulo: a Jurimetria pergunta "qual é a comarca?", e por
// isso só serve ao Júri. O Panorama pergunta "qual coluna faz o PAPEL de
// unidade territorial?" — e aí serve a improbidade, infância, consumidor,
// ambiental, a qualquer matéria, porque quem responde é o órgão.
// ============================================================================

/** Papéis semânticos. Nenhum é obrigatório; cada um destrava uma análise. */
export const PANORAMA_ROLES = [
    {
        key: 'identificador',
        label: 'Identificador do registro',
        exemplo: 'Número do processo, do IC, do procedimento, protocolo',
        destrava: 'Reimportar a mesma planilha deixa de duplicar registros.',
        consequenciaSemEle: 'Sem ele, cada importação acrescenta tudo de novo — a base dobra de tamanho a cada envio.',
        tipos: ['texto'],
        icone: 'Hash',
    },
    {
        key: 'data_principal',
        label: 'Data principal',
        exemplo: 'Data de instauração, de autuação, de distribuição',
        destrava: 'Evolução mensal e anual, filtros por período, gráfico de série temporal.',
        consequenciaSemEle: 'Sem ela, o módulo não consegue mostrar evolução no tempo.',
        tipos: ['data'],
        icone: 'Calendar',
    },
    {
        key: 'data_referencia',
        label: 'Data de referência (fato)',
        exemplo: 'Data do fato, da ocorrência, do evento que originou o caso',
        destrava: 'Contagem de prescrição quando o prazo corre do fato, não da instauração.',
        consequenciaSemEle: 'A prescrição passa a contar da data principal.',
        tipos: ['data'],
        icone: 'CalendarClock',
    },
    {
        key: 'unidade',
        label: 'Unidade territorial',
        exemplo: 'Comarca, município, promotoria, regional',
        destrava: 'Ranking territorial, agrupamento por região, mapa de concentração da demanda.',
        consequenciaSemEle: 'Sem ela, não há como saber onde a demanda se concentra.',
        tipos: ['texto', 'lista'],
        icone: 'MapPin',
    },
    {
        key: 'responsavel',
        label: 'Responsável / membro',
        exemplo: 'Promotor de justiça, membro designado, titular',
        destrava: 'Distribuição de carga por pessoa, identificação de sobrecarga.',
        consequenciaSemEle: 'Sem ele, não há leitura de distribuição de trabalho.',
        tipos: ['texto', 'lista'],
        icone: 'User',
    },
    {
        key: 'assunto',
        label: 'Assunto / matéria',
        exemplo: 'Tipo de improbidade, tema, classe, natureza do caso',
        destrava: 'Distribuição temática, o que mais gera atuação, cruzamento assunto × território.',
        consequenciaSemEle: 'Sem ele, não há leitura do que gera a demanda.',
        tipos: ['texto', 'lista'],
        icone: 'Tags',
    },
    {
        key: 'desfecho',
        label: 'Desfecho / resultado',
        exemplo: 'Ação ajuizada, arquivado, acordo, TAC, declinado',
        destrava: 'Espécies de resultado, aproveitamento ponderado, cores na tabela.',
        consequenciaSemEle: 'Sem ele, não há leitura de efetividade.',
        tipos: ['texto', 'lista'],
        icone: 'Gavel',
    },
    {
        key: 'situacao',
        label: 'Situação / fase',
        exemplo: 'Instaurado, em diligências, relatório final, encerrado',
        destrava: 'Funil de tramitação e identificação de gargalos: onde os casos param.',
        consequenciaSemEle: 'Sem ela, não há como ver onde a tramitação emperra.',
        tipos: ['texto', 'lista'],
        icone: 'GitBranch',
    },
    {
        key: 'valor',
        label: 'Valor monetário',
        exemplo: 'Valor do dano, do contrato, da multa, do prejuízo',
        destrava: 'Somatórios financeiros, valor médio, concentração de valor por território.',
        consequenciaSemEle: 'Sem ele, não há leitura financeira.',
        tipos: ['moeda', 'numero'],
        icone: 'Banknote',
    },
    {
        key: 'prazo',
        label: 'Data-limite / prescrição',
        exemplo: 'Data da prescrição já calculada na planilha',
        destrava: 'Alerta de prescrição e ordenação por urgência.',
        consequenciaSemEle: 'A prescrição pode ser calculada a partir de um prazo em anos, na configuração.',
        tipos: ['data'],
        icone: 'AlarmClock',
    },
];

export const PANORAMA_ROLE_KEYS = PANORAMA_ROLES.map((r) => r.key);

/** Metadados de um papel (nunca devolve `undefined`). */
export function roleMeta(key) {
    return PANORAMA_ROLES.find((r) => r.key === key) || null;
}

/** Tipos de coluna e como eles se comportam na interface. */
export const PANORAMA_COLUMN_TYPES = [
    { key: 'texto', label: 'Texto', descricao: 'Texto livre. Não serve para agrupar.' },
    { key: 'lista', label: 'Lista de valores', descricao: 'Poucos valores que se repetem. Serve para agrupar, filtrar e colorir.' },
    { key: 'numero', label: 'Número', descricao: 'Quantidade. Pode ser somada e ter média.' },
    { key: 'moeda', label: 'Valor monetário', descricao: 'Dinheiro. Somado e exibido em reais.' },
    { key: 'data', label: 'Data', descricao: 'Serve para série temporal, período e prescrição.' },
    { key: 'booleano', label: 'Sim / Não', descricao: 'Dois estados. Serve para agrupar e filtrar.' },
];

export const PANORAMA_COLUMN_TYPE_KEYS = PANORAMA_COLUMN_TYPES.map((t) => t.key);

export function columnTypeMeta(key) {
    return PANORAMA_COLUMN_TYPES.find((t) => t.key === key) || PANORAMA_COLUMN_TYPES[0];
}

/** Tipos que podem ser usados como dimensão de agrupamento. */
export const PANORAMA_TIPOS_AGRUPAVEIS = new Set(['lista', 'texto', 'booleano']);

/**
 * Teto de valores distintos para uma coluna de texto servir como dimensão.
 *
 * É o mesmo limite que a importação usa para decidir entre lista e texto livre
 * (`LISTA_MAX_DISTINTOS` em functions-v2/src/shared/panorama.ts). Acima dele,
 * agrupar produz praticamente uma linha por registro.
 */
export const PANORAMA_MAX_DISTINTOS_DIMENSAO = 300;

/** Cor neutra de uma etiqueta sem cor definida. */
export const PANORAMA_COR_NEUTRA = '#e2e8f0';

/**
 * Paleta sugerida para os desfechos de uma base nova.
 *
 * Verde para o que resolve, azul para o intermediário, vermelho para o que não
 * resolve, cinza para o que não é mérito — a mesma leitura da Jurimetria, mas
 * como SUGESTÃO: cada órgão decide o que cada desfecho significa para ele.
 */
export const PANORAMA_PALETA_DESFECHOS = [
    '#93ffc4', '#41bff1', '#a9dbf1', '#dff4fd',
    '#ffa3a3', '#ffdddd', '#f7c7ac', '#fae2d6', '#e2e8f0',
];

export const PANORAMA_PRESCRICAO_PADRAO = {
    modo: 'desligado',
    anosPadrao: 5,
    anosPorAssunto: {},
    contarDe: 'data_principal',
    alertas: [30, 90, 180, 365],
};

export const PANORAMA_PRESCRICAO_MODOS = [
    {
        key: 'desligado',
        label: 'Não acompanhar prescrição',
        descricao: 'O módulo não calcula nem alerta prazos.',
    },
    {
        key: 'coluna',
        label: 'Usar a data-limite da planilha',
        descricao: 'A própria planilha já traz a data da prescrição calculada. Mapeie essa coluna no papel "Data-limite / prescrição".',
    },
    {
        key: 'prazo',
        label: 'Calcular a partir de um prazo em anos',
        descricao: 'A plataforma soma o prazo à data escolhida. Permite um prazo padrão e prazos diferentes por assunto.',
    },
];

/** Faixas de urgência da prescrição, da mais grave para a menos. */
export const PANORAMA_FAIXAS_PRESCRICAO = [
    { key: 'prescrito', label: 'Prescrito', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300', chart: '#e11d48' },
    { key: 'critico', label: 'Crítico', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300', chart: '#f97316' },
    { key: 'alerta', label: 'Em alerta', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', chart: '#f59e0b' },
    { key: 'atencao', label: 'Atenção', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', chart: '#0ea5e9' },
    { key: 'confortavel', label: 'Confortável', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300', chart: '#10b981' },
    { key: 'sem_prazo', label: 'Sem prazo definido', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', chart: '#94a3b8' },
];

export function faixaPrescricaoMeta(key) {
    return PANORAMA_FAIXAS_PRESCRICAO.find((f) => f.key === key)
        || PANORAMA_FAIXAS_PRESCRICAO[PANORAMA_FAIXAS_PRESCRICAO.length - 1];
}

/** Políticas de conflito na importação. */
export const PANORAMA_IMPORT_POLICIES = [
    {
        value: 'preserve',
        label: 'Preservar o banco (recomendado)',
        description: 'Registros divergentes são listados como conflito e os dados já gravados permanecem intactos. Campos vazios no banco são completados com o que a planilha traz.',
    },
    {
        value: 'update',
        label: 'Atualizar com a planilha',
        description: 'Registros divergentes são sobrescritos pelos dados da planilha, com registro no histórico. Campos vazios também são completados.',
    },
];

export const PANORAMA_DEFAULT_BASE = {
    nome: '',
    descricao: '',
    columns: [],
    desfechos: { pesos: {}, neutros: [], cores: {} },
    regioes: {},
    prescricao: PANORAMA_PRESCRICAO_PADRAO,
    importPolicy: 'preserve',
    fuzzyThreshold: 0.7,
};

/**
 * Configuração efetiva de uma base, com os defaults onde ninguém mexeu.
 * Nunca devolve `undefined` em nenhum campo — o resto do módulo confia na forma.
 */
export function resolveBase(base) {
    if (!base || typeof base !== 'object') return { ...PANORAMA_DEFAULT_BASE, id: null };
    const desfechos = base.desfechos && typeof base.desfechos === 'object' ? base.desfechos : {};
    return {
        id: base.id || null,
        nome: String(base.nome || '').trim() || 'Base sem nome',
        descricao: String(base.descricao || ''),
        columns: Array.isArray(base.columns) ? base.columns : [],
        desfechos: {
            pesos: desfechos.pesos && typeof desfechos.pesos === 'object' ? desfechos.pesos : {},
            neutros: Array.isArray(desfechos.neutros) ? desfechos.neutros : [],
            cores: desfechos.cores && typeof desfechos.cores === 'object' ? desfechos.cores : {},
        },
        regioes: base.regioes && typeof base.regioes === 'object' ? base.regioes : {},
        prescricao: { ...PANORAMA_PRESCRICAO_PADRAO, ...(base.prescricao || {}) },
        importPolicy: base.importPolicy === 'update' ? 'update' : 'preserve',
        fuzzyThreshold: Number.isFinite(Number(base.fuzzyThreshold)) ? Number(base.fuzzyThreshold) : 0.7,
        created_by: base.created_by || '',
        created_by_name: base.created_by_name || '',
    };
}

/** Coluna que ocupa um papel, ou `null`. */
export function columnForRole(base, role) {
    return (base?.columns || []).find((c) => c.role === role) || null;
}

/** Chave da coluna que ocupa um papel, ou `''`. */
export function keyForRole(base, role) {
    return columnForRole(base, role)?.key || '';
}

/** Papéis efetivamente preenchidos nesta base. */
export function rolesPreenchidos(base) {
    return PANORAMA_ROLE_KEYS.filter((r) => Boolean(columnForRole(base, r)));
}

/** Colunas que podem ser usadas como dimensão de agrupamento. */
export function dimensoesDaBase(base) {
    const cols = (base?.columns || [])
        .filter((c) => PANORAMA_TIPOS_AGRUPAVEIS.has(c.type))
        // O identificador é único por definição: agrupar por ele produz uma
        // linha por registro, o que não é análise nenhuma — e envenenaria todo
        // cruzamento em que entrasse.
        .filter((c) => c.role !== 'identificador')
        // Texto com cardinalidade alta é texto livre (observações, resumo do
        // fato). A importação já o classificou assim; agrupar por ele daria o
        // mesmo resultado inútil. Coluna criada à mão, sem cardinalidade
        // conhecida, continua disponível.
        .filter((c) => !(c.type === 'texto'
            && Number.isFinite(Number(c.cardinalidade))
            && Number(c.cardinalidade) > PANORAMA_MAX_DISTINTOS_DIMENSAO))
        .map((c) => ({ key: c.key, label: c.label, role: c.role }));

    // Dimensões derivadas: existem quando o papel correspondente foi mapeado.
    const derivadas = [];
    if (columnForRole(base, 'data_principal')) {
        derivadas.push(
            { key: '__mes', label: 'Mês', derivada: true },
            { key: '__ano', label: 'Ano', derivada: true },
            { key: '__trimestre', label: 'Trimestre', derivada: true },
        );
    }
    if (Object.keys(base?.regioes || {}).length > 0 && columnForRole(base, 'unidade')) {
        derivadas.push({ key: '__regiao', label: 'Região', derivada: true });
    }
    if ((base?.prescricao?.modo || 'desligado') !== 'desligado') {
        derivadas.push({ key: '__prescricao', label: 'Situação de prescrição', derivada: true });
    }
    return [...cols, ...derivadas];
}

/** Medidas disponíveis, conforme os papéis que a base preencheu. */
export function medidasDaBase(base) {
    const medidas = [{ key: 'quantidade', label: 'Quantidade de registros' }];
    if (columnForRole(base, 'desfecho')) {
        medidas.push(
            { key: 'aproveitamento', label: 'Aproveitamento (%)' },
            { key: 'pontos', label: 'Soma de pontos' },
        );
    }
    if (columnForRole(base, 'valor')) {
        medidas.push(
            { key: 'valor_total', label: 'Valor total' },
            { key: 'valor_medio', label: 'Valor médio' },
        );
    }
    return medidas;
}

// ----------------------------------------------------------------------------
// Cores das etiquetas (mesma derivação de contraste da Jurimetria)
// ----------------------------------------------------------------------------

export function parseHexColor(value) {
    const raw = String(value || '').trim().replace(/^#/, '');
    const hex = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
    };
}

export function normalizeHexColor(value) {
    const rgb = parseHexColor(value);
    if (!rgb) return null;
    const hex = (n) => n.toString(16).padStart(2, '0');
    return `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`;
}

export function relativeLuminance(value) {
    const rgb = parseHexColor(value);
    if (!rgb) return 1;
    const canal = (n) => {
        const c = n / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * canal(rgb.r) + 0.7152 * canal(rgb.g) + 0.0722 * canal(rgb.b);
}

function mixHex(base, alvo, peso) {
    const a = parseHexColor(base);
    const b = parseHexColor(alvo);
    if (!a || !b) return base;
    const canal = (x, y) => Math.round(x + (y - x) * peso);
    const hex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `#${hex(canal(a.r, b.r))}${hex(canal(a.g, b.g))}${hex(canal(a.b, b.b))}`;
}

const TINTA_ESCURA = '#0f172a';
const TINTA_CLARA = '#ffffff';

/**
 * Cores de uma etiqueta nos dois temas, derivadas da cor escolhida.
 * O admin escolhe UMA cor; texto, borda e a variante escura saem por cálculo,
 * de modo que qualquer cor continue legível.
 */
export function badgeTheme(cor) {
    const base = normalizeHexColor(cor) || PANORAMA_COR_NEUTRA;
    const lum = relativeLuminance(base);
    return {
        base,
        bg: base,
        text: lum > 0.42 ? TINTA_ESCURA : TINTA_CLARA,
        border: mixHex(base, TINTA_ESCURA, 0.18),
        darkBg: mixHex(base, '#020617', 0.82),
        darkText: lum > 0.42 ? mixHex(base, TINTA_CLARA, 0.12) : mixHex(base, TINTA_CLARA, 0.45),
        darkBorder: mixHex(base, '#020617', 0.6),
    };
}

/** Cor configurada para um desfecho (com o neutro como rede de segurança). */
export function corDoDesfecho(valor, base) {
    if (!valor) return PANORAMA_COR_NEUTRA;
    return normalizeHexColor(base?.desfechos?.cores?.[valor]) || PANORAMA_COR_NEUTRA;
}

/**
 * Sugere uma paleta para os desfechos de uma base que ainda não tem cores.
 * O admin ajusta depois; o objetivo é que a primeira abertura já venha legível.
 */
export function sugerirCoresDesfecho(valores) {
    const out = {};
    (valores || []).forEach((valor, i) => {
        out[valor] = PANORAMA_PALETA_DESFECHOS[i % PANORAMA_PALETA_DESFECHOS.length];
    });
    return out;
}

/** Opções de análise — o mesmo conceito da Jurimetria. */
export const PANORAMA_DEFAULT_ANALYSIS = {
    excluirNaoInformados: false,
    excluirNeutros: false,
};
