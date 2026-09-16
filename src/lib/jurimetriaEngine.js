// ============================================================================
// jurimetriaEngine — cálculos do módulo de Jurimetria
// ----------------------------------------------------------------------------
// Funções puras, sem dependência de React nem de Firestore: recebem a lista de
// júris já carregada e a configuração do órgão, e devolvem estruturas prontas
// para a interface. Isso mantém os relatórios testáveis e permite reusar o
// mesmo cálculo no painel, nos relatórios estáticos e nos dinâmicos.
//
// REGRA DE NEGÓCIO CENTRAL — dissoluções:
//   Um júri dissolvido é uma sessão desfeita sem julgamento. Ele conta no
//   TOTAL de júris do período, mas NÃO entra no cálculo de espécies, matérias
//   nem no aproveitamento. Os "efetivos" são os júris não dissolvidos.
// ============================================================================

import {
    JURIMETRIA_MESES,
    JURIMETRIA_APROVEITAMENTO_FAIXAS,
    getJuriFieldValue,
} from '@/constants/jurimetria';

const SEM_VALOR = '(não informado)';

// ----------------------------------------------------------------------------
// Utilidades básicas
// ----------------------------------------------------------------------------

/** Texto normalizado: minúsculo, sem acento, espaços colapsados. */
export function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/** Indica se o júri foi dissolvido, conforme a lista configurada pelo órgão. */
export function isDissolucao(juri, settings) {
    const lista = settings?.dissolucaoResultados || [];
    const resultado = normalizeText(juri?.resultado);
    if (!resultado) return false;
    return lista.some((r) => normalizeText(r) === resultado);
}

/** Separa a lista em efetivos (julgados) e dissolvidos. */
export function splitEfetivos(juris, settings) {
    const efetivos = [];
    const dissolvidos = [];
    for (const juri of juris || []) {
        if (isDissolucao(juri, settings)) dissolvidos.push(juri);
        else efetivos.push(juri);
    }
    return { efetivos, dissolvidos };
}

/** Peso configurado para uma espécie de resultado (0 quando desconhecida). */
export function pesoDoResultado(resultado, settings) {
    const tabela = settings?.pontuacao || {};
    if (Object.prototype.hasOwnProperty.call(tabela, resultado)) {
        const n = Number(tabela[resultado]);
        return Number.isFinite(n) ? n : 0;
    }
    // Tolera diferenças de grafia entre o dado gravado e a chave da tabela.
    const alvo = normalizeText(resultado);
    for (const [key, value] of Object.entries(tabela)) {
        if (normalizeText(key) === alvo) {
            const n = Number(value);
            return Number.isFinite(n) ? n : 0;
        }
    }
    return 0;
}

/**
 * Aproveitamento ponderado de um conjunto de júris: soma dos pesos dividida
 * pelo número de júris EFETIVOS. Devolve `null` quando não há efetivos — o
 * que é diferente de 0% e deve ser exibido como "—".
 * @returns {{ ratio: number|null, pontos: number, efetivos: number, dissolvidos: number }}
 */
export function calcAproveitamento(juris, settings) {
    const { efetivos, dissolvidos } = splitEfetivos(juris, settings);
    if (efetivos.length === 0) {
        return { ratio: null, pontos: 0, efetivos: 0, dissolvidos: dissolvidos.length };
    }
    let pontos = 0;
    for (const juri of efetivos) pontos += pesoDoResultado(juri.resultado, settings);
    return {
        ratio: pontos / efetivos.length,
        pontos,
        efetivos: efetivos.length,
        dissolvidos: dissolvidos.length,
    };
}

/** Faixa de cor correspondente a um aproveitamento (0..1). */
export function faixaAproveitamento(ratio) {
    if (ratio === null || ratio === undefined) return null;
    return JURIMETRIA_APROVEITAMENTO_FAIXAS.find((f) => ratio >= f.min)
        || JURIMETRIA_APROVEITAMENTO_FAIXAS[JURIMETRIA_APROVEITAMENTO_FAIXAS.length - 1];
}

/** Formata 0..1 como percentual brasileiro ("—" quando não aplicável). */
export function formatPercent(ratio, decimals = 1) {
    if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return '—';
    return `${(ratio * 100).toFixed(decimals).replace('.', ',')}%`;
}

/** Formata número com separador de milhar brasileiro. */
export function formatNumber(value, decimals = 0) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    return Number(value).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/**
 * Concordância de número: devolve o singular quando a quantidade é 1.
 * Usado no relatório descritivo, que é um documento formal.
 */
export function plural(quantidade, singular, pluralForma) {
    return Number(quantidade) === 1 ? singular : pluralForma;
}

/** Data ISO (YYYY-MM-DD) formatada como dd/mm/aaaa. */
export function formatDateBR(iso) {
    const s = String(iso || '');
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return s || '—';
    return `${m[3]}/${m[2]}/${m[1]}`;
}

// ----------------------------------------------------------------------------
// Dimensões (usadas por filtros, agrupamentos e pela tabela dinâmica)
// ----------------------------------------------------------------------------

/**
 * Valor de um júri numa dimensão de relatório. Sempre devolve string — os
 * vazios viram "(não informado)" para não sumirem dos agrupamentos.
 */
export function dimensionValue(juri, dimension, settings) {
    switch (dimension) {
        case 'comarca': return juri.comarca || SEM_VALOR;
        case 'promotor': return juri.promotor || SEM_VALOR;
        case 'tipo': return tipoLabel(juri.tipo, settings);
        case 'resultado': return juri.resultado || SEM_VALOR;
        case 'vara': return juri.vara || SEM_VALOR;
        case 'responsavel': return juri.responsible_user_name || SEM_VALOR;
        case 'mes': {
            const mes = mesDoJuri(juri);
            return mes ? `${JURIMETRIA_MESES[mes.mes - 1]}/${mes.ano}` : SEM_VALOR;
        }
        case 'ano': {
            const ano = String(juri.data_juri || '').slice(0, 4);
            return ano || SEM_VALOR;
        }
        default: {
            const value = getJuriFieldValue(juri, dimension);
            if (value === true) return 'Sim';
            if (value === false) return 'Não';
            return String(value ?? '') || SEM_VALOR;
        }
    }
}

/** Rótulo completo da matéria ("FC — FATOS DO COTIDIANO"). */
export function tipoLabel(sigla, settings) {
    if (!sigla) return SEM_VALOR;
    const tipo = (settings?.tipos || []).find(
        (t) => normalizeText(t.sigla) === normalizeText(sigla)
    );
    return tipo ? `${tipo.sigla} — ${tipo.descricao}` : String(sigla);
}

/** Mês/ano de um júri a partir da data ISO. */
export function mesDoJuri(juri) {
    const m = /^(\d{4})-(\d{2})/.exec(String(juri?.data_juri || ''));
    if (!m) return null;
    return { ano: Number(m[1]), mes: Number(m[2]) };
}

/** Chave ordenável de mês ("2026-08") — usada para ordenar a dimensão Mês. */
export function mesSortKey(juri) {
    return String(juri?.data_juri || '').slice(0, 7);
}

/** Faixa de horário do júri (manhã / tarde / noite). */
export function faixaHorario(juri) {
    const m = /^(\d{1,2})/.exec(String(juri?.horario || '').trim());
    if (!m) return SEM_VALOR;
    const hora = Number(m[1]);
    if (!Number.isFinite(hora) || hora > 23) return SEM_VALOR;
    if (hora < 12) return 'Manhã (00h–11h59)';
    if (hora < 18) return 'Tarde (12h–17h59)';
    return 'Noite (18h–23h59)';
}

// ----------------------------------------------------------------------------
// Filtros
// ----------------------------------------------------------------------------

/**
 * Aplica os filtros comuns a todas as visões do módulo.
 * @param {Array} juris
 * @param {object} filtros
 *   { busca, comarcas[], tipos[], resultados[], promotor, responsaveis[],
 *     dataDe, dataAte, somenteEfetivos }
 * @param {object} settings
 */
export function filtrarJuris(juris, filtros = {}, settings = {}) {
    const {
        busca = '',
        comarcas = [],
        tipos = [],
        resultados = [],
        promotor = '',
        responsaveis = [],
        dataDe = '',
        dataAte = '',
        somenteEfetivos = false,
    } = filtros;

    const buscaNorm = normalizeText(busca);
    const promotorNorm = normalizeText(promotor);
    const comarcaSet = new Set(comarcas);
    const tipoSet = new Set(tipos);
    const resultadoSet = new Set(resultados);
    const responsavelSet = new Set(responsaveis);

    return (juris || []).filter((juri) => {
        if (somenteEfetivos && isDissolucao(juri, settings)) return false;

        if (comarcaSet.size > 0 && !comarcaSet.has(juri.comarca || '')) return false;
        if (tipoSet.size > 0 && !tipoSet.has(juri.tipo || '')) return false;
        if (resultadoSet.size > 0 && !resultadoSet.has(juri.resultado || '')) return false;
        if (responsavelSet.size > 0 && !responsavelSet.has(juri.responsible_user_id || '')) return false;

        if (promotorNorm && !normalizeText(juri.promotor).includes(promotorNorm)) return false;

        const data = String(juri.data_juri || '');
        if (dataDe && (!data || data < dataDe)) return false;
        if (dataAte && (!data || data > dataAte)) return false;

        if (buscaNorm) {
            const alvo = normalizeText([
                juri.numero_processo, juri.comarca, juri.tipo, juri.resultado,
                juri.promotor, juri.vara, juri.observacoes, juri.responsible_user_name,
                ...Object.values(juri.values || {}),
            ].join(' '));
            if (!alvo.includes(buscaNorm)) return false;
        }

        return true;
    });
}

// ----------------------------------------------------------------------------
// Relatórios estáticos
// ----------------------------------------------------------------------------

/** Totais do período: total, dissolvidos, efetivos e seus percentuais. */
export function computeTotais(juris, settings) {
    const total = (juris || []).length;
    const { efetivos, dissolvidos } = splitEfetivos(juris, settings);
    const aproveitamento = calcAproveitamento(juris, settings);
    return {
        total,
        efetivos: efetivos.length,
        dissolvidos: dissolvidos.length,
        pctEfetivos: total ? efetivos.length / total : null,
        pctDissolvidos: total ? dissolvidos.length / total : null,
        aproveitamento: aproveitamento.ratio,
        pontos: aproveitamento.pontos,
    };
}

/**
 * Distribuição por espécie de resultado. Os dissolvidos são reportados à
 * parte (`dissolucoes`) e NÃO entram no denominador dos percentuais.
 */
export function computeEspecies(juris, settings) {
    const { efetivos, dissolvidos } = splitEfetivos(juris, settings);
    const total = efetivos.length;

    const counts = new Map();
    for (const especie of settings?.resultados || []) {
        if ((settings?.dissolucaoResultados || []).includes(especie)) continue;
        counts.set(especie, 0);
    }
    for (const juri of efetivos) {
        const especie = juri.resultado || SEM_VALOR;
        counts.set(especie, (counts.get(especie) || 0) + 1);
    }

    const linhas = [...counts.entries()]
        .map(([especie, quantidade]) => ({
            especie,
            quantidade,
            percentual: total ? quantidade / total : null,
            peso: pesoDoResultado(especie, settings),
        }))
        .sort((a, b) => b.quantidade - a.quantidade || a.especie.localeCompare(b.especie, 'pt-BR'));

    return {
        linhas,
        totalEfetivos: total,
        dissolucoes: dissolvidos.length,
        totalGeral: (juris || []).length,
    };
}

/** Distribuição por matéria/tipo de júri, com sub-contagem por espécie. */
export function computeMaterias(juris, settings) {
    const { efetivos } = splitEfetivos(juris, settings);
    const grupos = new Map();

    for (const juri of efetivos) {
        const chave = juri.tipo || SEM_VALOR;
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(juri);
    }

    const linhas = [...grupos.entries()].map(([sigla, itens]) => {
        const porEspecie = new Map();
        for (const juri of itens) {
            const especie = juri.resultado || SEM_VALOR;
            porEspecie.set(especie, (porEspecie.get(especie) || 0) + 1);
        }
        const { ratio } = calcAproveitamento(itens, settings);
        return {
            sigla,
            label: tipoLabel(sigla, settings),
            total: itens.length,
            percentual: efetivos.length ? itens.length / efetivos.length : null,
            aproveitamento: ratio,
            porEspecie: [...porEspecie.entries()]
                .map(([especie, quantidade]) => ({ especie, quantidade }))
                .sort((a, b) => b.quantidade - a.quantidade),
        };
    });

    linhas.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));
    return { linhas, totalEfetivos: efetivos.length };
}

/**
 * Ranking por uma dimensão (comarca, promotor, responsável…), com a
 * distribuição por espécie e o aproveitamento ponderado de cada grupo.
 * É a base tanto do "Ranking de Comarcas" quanto da "Atuação por Promotor".
 */
export function computeRanking(juris, dimension, settings) {
    const grupos = new Map();
    for (const juri of juris || []) {
        const chave = dimensionValue(juri, dimension, settings);
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(juri);
    }

    const especies = (settings?.resultados || []).filter(
        (r) => !(settings?.dissolucaoResultados || []).includes(r)
    );

    const linhas = [...grupos.entries()].map(([chave, itens]) => {
        const { efetivos, dissolvidos } = splitEfetivos(itens, settings);
        const { ratio, pontos } = calcAproveitamento(itens, settings);
        const porEspecie = {};
        for (const especie of especies) porEspecie[especie] = 0;
        for (const juri of efetivos) {
            const especie = juri.resultado || SEM_VALOR;
            porEspecie[especie] = (porEspecie[especie] || 0) + 1;
        }
        return {
            chave,
            total: itens.length,
            efetivos: efetivos.length,
            dissolucoes: dissolvidos.length,
            porEspecie,
            pontos,
            aproveitamento: ratio,
        };
    });

    linhas.sort((a, b) => b.total - a.total || String(a.chave).localeCompare(String(b.chave), 'pt-BR'));
    return { linhas, especies };
}

/** Série temporal por mês (ordenada cronologicamente). */
export function computeSerieMensal(juris, settings) {
    const grupos = new Map();
    for (const juri of juris || []) {
        const chave = mesSortKey(juri);
        if (!chave) continue;
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(juri);
    }

    return [...grupos.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([chave, itens]) => {
            const { efetivos, dissolvidos } = splitEfetivos(itens, settings);
            const { ratio } = calcAproveitamento(itens, settings);
            const [ano, mes] = chave.split('-');
            return {
                chave,
                label: `${JURIMETRIA_MESES[Number(mes) - 1]?.slice(0, 3) || mes}/${ano.slice(2)}`,
                labelCompleto: `${JURIMETRIA_MESES[Number(mes) - 1] || mes} de ${ano}`,
                total: itens.length,
                efetivos: efetivos.length,
                dissolucoes: dissolvidos.length,
                aproveitamento: ratio,
            };
        });
}

/** Distribuição por faixa de horário. */
export function computeHorarios(juris) {
    const grupos = new Map();
    for (const juri of juris || []) {
        const faixa = faixaHorario(juri);
        grupos.set(faixa, (grupos.get(faixa) || 0) + 1);
    }
    const total = (juris || []).length;
    const ordem = ['Manhã (00h–11h59)', 'Tarde (12h–17h59)', 'Noite (18h–23h59)', SEM_VALOR];
    return [...grupos.entries()]
        .map(([faixa, quantidade]) => ({
            faixa,
            quantidade,
            percentual: total ? quantidade / total : null,
        }))
        .sort((a, b) => ordem.indexOf(a.faixa) - ordem.indexOf(b.faixa));
}

// ----------------------------------------------------------------------------
// Tabela dinâmica (pivot multi-nível)
// ----------------------------------------------------------------------------

const PATH_SEP = ' ';

/** Agrega as estatísticas de um conjunto de júris numa célula da pivot. */
function statsOf(juris, settings) {
    const { efetivos, dissolvidos } = splitEfetivos(juris, settings);
    let pontos = 0;
    for (const juri of efetivos) pontos += pesoDoResultado(juri.resultado, settings);
    return {
        quantidade: juris.length,
        efetivos: efetivos.length,
        dissolucoes: dissolvidos.length,
        pontos,
        aproveitamento: efetivos.length ? pontos / efetivos.length : null,
    };
}

/** Soma duas estatísticas (usada nos subtotais). */
function addStats(a, b) {
    const quantidade = a.quantidade + b.quantidade;
    const efetivos = a.efetivos + b.efetivos;
    const pontos = a.pontos + b.pontos;
    return {
        quantidade,
        efetivos,
        dissolucoes: a.dissolucoes + b.dissolucoes,
        pontos,
        aproveitamento: efetivos ? pontos / efetivos : null,
    };
}

const EMPTY_STATS = {
    quantidade: 0, efetivos: 0, dissolucoes: 0, pontos: 0, aproveitamento: null,
};

/** Constrói a árvore hierárquica de um eixo a partir dos caminhos presentes. */
function buildAxisTree(paths, depth) {
    const root = { key: '__root__', label: '', level: -1, path: [], children: [], leaf: depth === 0 };
    if (depth === 0) return root;

    const index = new Map([['', root]]);
    for (const path of paths) {
        let parentKey = '';
        for (let level = 0; level < path.length; level++) {
            const key = path.slice(0, level + 1).join(PATH_SEP);
            if (!index.has(key)) {
                const node = {
                    key,
                    label: path[level],
                    level,
                    path: path.slice(0, level + 1),
                    children: [],
                    leaf: level === depth - 1,
                };
                index.get(parentKey).children.push(node);
                index.set(key, node);
            }
            parentKey = key;
        }
    }

    const sortRecursive = (node) => {
        node.children.sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR', { numeric: true }));
        node.children.forEach(sortRecursive);
    };
    sortRecursive(root);
    return root;
}

/** Percorre a árvore devolvendo apenas as folhas, na ordem de exibição. */
function collectLeaves(node, acc = []) {
    if (node.children.length === 0) {
        if (node.level >= 0) acc.push(node);
        return acc;
    }
    node.children.forEach((child) => collectLeaves(child, acc));
    return acc;
}

/** Percorre a árvore devolvendo todos os nós (pré-ordem), sem a raiz. */
function collectNodes(node, acc = []) {
    node.children.forEach((child) => {
        acc.push(child);
        collectNodes(child, acc);
    });
    return acc;
}

/**
 * Monta uma tabela dinâmica multi-nível.
 *
 * @param {Array} juris Lista já filtrada.
 * @param {object} config
 *   { rowDims: string[], colDims: string[], values: string[],
 *     showAs: 'valor'|'linha'|'coluna'|'total', subtotais: 'auto'|'linha'|'coluna'|'nenhum' }
 * @param {object} settings Configuração do órgão.
 * @returns {{
 *   rowNodes: Array, colLeaves: Array, colHeaderRows: Array,
 *   cells: Map, rowTotals: Map, colTotals: Map, grandTotal: object,
 *   values: string[], showAs: string, subtotais: string
 * }}
 */
export function buildPivot(juris, config, settings) {
    const rowDims = (config?.rowDims || []).filter(Boolean).slice(0, 3);
    const colDims = (config?.colDims || []).filter(Boolean).slice(0, 3);
    const values = (config?.values || ['quantidade']).filter(Boolean).slice(0, 2);
    const showAs = config?.showAs || 'valor';
    const subtotais = config?.subtotais || 'auto';

    // 1. Agrupa os júris por (caminho de linha, caminho de coluna).
    const buckets = new Map();
    const rowPaths = new Set();
    const colPaths = new Set();

    for (const juri of juris || []) {
        const rowPath = rowDims.map((d) => dimensionValue(juri, d, settings));
        const colPath = colDims.map((d) => dimensionValue(juri, d, settings));
        const rowKey = rowPath.join(PATH_SEP);
        const colKey = colPath.join(PATH_SEP);
        if (rowDims.length) rowPaths.add(rowPath);
        if (colDims.length) colPaths.add(colPath);

        const cellKey = `${rowKey}|${colKey}`;
        if (!buckets.has(cellKey)) buckets.set(cellKey, []);
        buckets.get(cellKey).push(juri);
    }

    // 2. Árvores de linhas e colunas.
    const rowTree = buildAxisTree([...rowPaths], rowDims.length);
    const colTree = buildAxisTree([...colPaths], colDims.length);
    const colLeaves = colDims.length ? collectLeaves(colTree) : [{
        key: '', label: 'Total', level: 0, path: [], children: [], leaf: true,
    }];
    const rowNodes = rowDims.length ? collectNodes(rowTree) : [{
        key: '', label: 'Total', level: 0, path: [], children: [], leaf: true,
    }];

    // 3. Células, subtotais e totais.
    // Cada grupo de júris é contabilizado UMA vez e propagado para todos os
    // seus prefixos (ancestrais) de linha e de coluna. Assim os subtotais dos
    // níveis intermediários saem de graça, sem varrer os dados por nó — o que
    // deixaria o pivô quadrático no número de grupos.
    const cells = new Map();
    const rowTotals = new Map();
    const colTotals = new Map();
    let grandTotal = { ...EMPTY_STATS };

    /** Prefixos de um caminho, do mais curto ('' = total) ao próprio caminho. */
    const prefixesOf = (key) => {
        const out = [''];
        if (!key) return out;
        const parts = key.split(PATH_SEP);
        for (let i = 1; i <= parts.length; i++) out.push(parts.slice(0, i).join(PATH_SEP));
        return out;
    };

    const accumulate = (map, key, stats) => {
        map.set(key, addStats(map.get(key) || EMPTY_STATS, stats));
    };

    for (const [cellKey, items] of buckets.entries()) {
        const sep = cellKey.indexOf('|');
        const stats = statsOf(items, settings);
        const rowPrefixes = prefixesOf(cellKey.slice(0, sep));
        const colPrefixes = prefixesOf(cellKey.slice(sep + 1));

        for (const rowKey of rowPrefixes) {
            accumulate(rowTotals, rowKey, stats);
            for (const colKey of colPrefixes) {
                accumulate(cells, `${rowKey}|${colKey}`, stats);
            }
        }
        for (const colKey of colPrefixes) accumulate(colTotals, colKey, stats);
        grandTotal = addStats(grandTotal, stats);
    }

    // Garante uma célula (zerada) para toda combinação exibida, para que a
    // tabela não fique com buracos quando um cruzamento não tem nenhum júri.
    for (const rowNode of rowNodes) {
        if (!rowTotals.has(rowNode.key)) rowTotals.set(rowNode.key, { ...EMPTY_STATS });
        for (const colLeaf of colLeaves) {
            const key = `${rowNode.key}|${colLeaf.key}`;
            if (!cells.has(key)) cells.set(key, { ...EMPTY_STATS });
        }
    }
    for (const colLeaf of colLeaves) {
        if (!colTotals.has(colLeaf.key)) colTotals.set(colLeaf.key, { ...EMPTY_STATS });
    }

    // 4. Cabeçalho de colunas em múltiplas linhas (com colspan).
    const colHeaderRows = [];
    if (colDims.length) {
        for (let level = 0; level < colDims.length; level++) {
            const cellsRow = [];
            const nodesAtLevel = collectNodes(colTree).filter((n) => n.level === level);
            for (const node of nodesAtLevel) {
                const span = node.leaf ? 1 : collectLeaves(node).length;
                cellsRow.push({ key: node.key, label: node.label, span, level });
            }
            colHeaderRows.push(cellsRow);
        }
    }

    return {
        rowDims,
        colDims,
        rowNodes,
        colLeaves,
        colHeaderRows,
        cells,
        rowTotals,
        colTotals,
        grandTotal,
        values,
        showAs,
        subtotais,
    };
}

/**
 * Formata uma medida de uma célula conforme o modo "Mostrar como".
 * @param {object} stats Estatísticas da célula.
 * @param {string} measure 'quantidade' | 'aproveitamento' | 'pontos' | 'dissolucoes'
 * @param {string} showAs 'valor' | 'linha' | 'coluna' | 'total'
 * @param {object} divisor Estatísticas do denominador (linha, coluna ou total).
 */
export function formatPivotValue(stats, measure, showAs, divisor) {
    if (!stats) return '—';

    // Aproveitamento já é uma razão: "% de" não se aplica, mostra sempre o valor.
    if (measure === 'aproveitamento') return formatPercent(stats.aproveitamento);

    const raw = measure === 'pontos'
        ? stats.pontos
        : measure === 'dissolucoes'
            ? stats.dissolucoes
            : stats.quantidade;

    if (showAs === 'valor' || !divisor) {
        return measure === 'pontos' ? formatNumber(raw, 2) : formatNumber(raw);
    }

    const base = measure === 'pontos'
        ? divisor.pontos
        : measure === 'dissolucoes'
            ? divisor.dissolucoes
            : divisor.quantidade;

    if (!base) return '—';
    return formatPercent(raw / base);
}

/** Rótulo curto de uma medida (para cabeçalhos). */
export function measureLabel(measure) {
    switch (measure) {
        case 'aproveitamento': return 'Aprov.';
        case 'pontos': return 'Pontos';
        case 'dissolucoes': return 'Diss.';
        default: return 'Qtde';
    }
}

// ----------------------------------------------------------------------------
// Relatório descritivo
// ----------------------------------------------------------------------------

/**
 * Gera o relatório descritivo em texto estruturado (Markdown).
 *
 * @param {Array} juris Lista já filtrada.
 * @param {object} config
 *   { agrupador: string, secoes: string[], estilo: 'formal'|'executivo'|'analitico',
 *     titulo?: string, periodo?: {de, ate} }
 * @param {object} settings
 * @returns {string} Markdown pronto para exibir, copiar ou exportar.
 */
export function buildDescritivo(juris, config, settings) {
    const {
        agrupador = 'comarca',
        secoes = ['quantitativo', 'especies', 'materias', 'aproveitamento'],
        estilo = 'formal',
        titulo = 'Relatório descritivo de jurimetria',
        periodo = {},
    } = config || {};

    const ativo = new Set(secoes);
    const topN = estilo === 'executivo' ? 5 : estilo === 'analitico' ? 100 : 15;
    const linhas = [];

    linhas.push(`# ${titulo}`);
    linhas.push('');
    const periodoTexto = periodo.de || periodo.ate
        ? `Período: ${periodo.de ? formatDateBR(periodo.de) : 'início da base'} a ${periodo.ate ? formatDateBR(periodo.ate) : 'hoje'}.`
        : 'Período: base completa.';
    linhas.push(`${periodoTexto} Documento gerado em ${new Date().toLocaleString('pt-BR')}.`);
    linhas.push('');

    const totais = computeTotais(juris, settings);

    if (ativo.has('quantitativo')) {
        linhas.push('## Quantitativo geral');
        linhas.push('');
        linhas.push(
            `${plural(totais.total, 'Foi considerado', 'Foram considerados')} `
            + `${formatNumber(totais.total)} ${plural(totais.total, 'júri', 'júris')} no período, `
            + `${plural(totais.total, 'o qual foi', 'dos quais')} ${formatNumber(totais.efetivos)} `
            + `${plural(totais.efetivos, 'foi efetivamente julgado', 'foram efetivamente julgados')} `
            + `(${formatPercent(totais.pctEfetivos)}) e ${formatNumber(totais.dissolvidos)} `
            + `${plural(totais.dissolvidos, 'teve', 'tiveram')} o conselho dissolvido `
            + `(${formatPercent(totais.pctDissolvidos)}).`
        );
        if (estilo !== 'executivo') {
            linhas.push('');
            linhas.push(
                'As dissoluções não integram o cálculo das espécies de resultado, das matérias '
                + 'nem do aproveitamento, por não corresponderem a julgamento de mérito.'
            );
        }
        linhas.push('');
    }

    // Agrupamento principal escolhido pelo usuário.
    const ranking = computeRanking(juris, agrupador, settings);
    if (ranking.linhas.length > 0) {
        const dimLabel = {
            comarca: 'comarca', promotor: 'promotor(a)', tipo: 'matéria',
            resultado: 'espécie de resultado', mes: 'mês', ano: 'ano',
            vara: 'vara', responsavel: 'responsável',
        }[agrupador] || agrupador;

        linhas.push(`## Distribuição por ${dimLabel}`);
        linhas.push('');
        for (const linha of ranking.linhas.slice(0, topN)) {
            const pct = totais.total ? formatPercent(linha.total / totais.total) : '—';
            linhas.push(
                `- **${linha.chave}**: ${formatNumber(linha.total)} ${plural(linha.total, 'júri', 'júris')} (${pct}), `
                + `${formatNumber(linha.efetivos)} ${plural(linha.efetivos, 'efetivo', 'efetivos')}, `
                + `aproveitamento de ${formatPercent(linha.aproveitamento)}.`
            );
        }
        if (ranking.linhas.length > topN) {
            const resto = ranking.linhas.slice(topN);
            const somaResto = resto.reduce((acc, l) => acc + l.total, 0);
            linhas.push(
                `- **Demais (${resto.length})**: ${formatNumber(somaResto)} ${plural(somaResto, 'júri', 'júris')}.`
            );
        }
        linhas.push('');
    }

    if (ativo.has('meses')) {
        const serie = computeSerieMensal(juris, settings);
        if (serie.length > 0) {
            linhas.push('## Júris por mês');
            linhas.push('');
            for (const mes of serie) {
                linhas.push(
                    `- **${mes.labelCompleto}**: ${formatNumber(mes.total)} ${plural(mes.total, 'júri', 'júris')} `
                    + `(${formatNumber(mes.efetivos)} ${plural(mes.efetivos, 'efetivo', 'efetivos')}, `
                    + `${formatNumber(mes.dissolucoes)} ${plural(mes.dissolucoes, 'dissolvido', 'dissolvidos')}), `
                    + `aproveitamento de ${formatPercent(mes.aproveitamento)}.`
                );
            }
            linhas.push('');
        }
    }

    if (ativo.has('especies')) {
        const especies = computeEspecies(juris, settings);
        linhas.push('## Espécies de resultado');
        linhas.push('');
        linhas.push(
            `Base de cálculo: ${formatNumber(especies.totalEfetivos)} `
            + `${plural(especies.totalEfetivos, 'júri efetivo', 'júris efetivos')}.`
        );
        linhas.push('');
        for (const linha of especies.linhas.filter((l) => l.quantidade > 0).slice(0, topN)) {
            linhas.push(
                `- **${linha.especie}**: ${formatNumber(linha.quantidade)} (${formatPercent(linha.percentual)})`
                + (estilo === 'analitico' ? ` — peso ${linha.peso}` : '')
            );
        }
        linhas.push('');
    }

    if (ativo.has('materias')) {
        const materias = computeMaterias(juris, settings);
        if (materias.linhas.length > 0) {
            linhas.push('## Matérias / Tipos de júri');
            linhas.push('');
            for (const linha of materias.linhas.slice(0, topN)) {
                linhas.push(
                    `- **${linha.label}**: ${formatNumber(linha.total)} ${plural(linha.total, 'júri', 'júris')} `
                    + `(${formatPercent(linha.percentual)}), aproveitamento de ${formatPercent(linha.aproveitamento)}.`
                );
                if (estilo === 'analitico') {
                    for (const especie of linha.porEspecie) {
                        linhas.push(`  - ${especie.especie}: ${formatNumber(especie.quantidade)}`);
                    }
                }
            }
            linhas.push('');
        }
    }

    if (ativo.has('promotores')) {
        const promotores = computeRanking(juris, 'promotor', settings);
        if (promotores.linhas.length > 0) {
            linhas.push('## Promotores(as) relacionados');
            linhas.push('');
            for (const linha of promotores.linhas.slice(0, topN)) {
                linhas.push(
                    `- **${linha.chave}**: ${formatNumber(linha.total)} ${plural(linha.total, 'júri', 'júris')}, `
                    + `aproveitamento de ${formatPercent(linha.aproveitamento)}.`
                );
            }
            if (promotores.linhas.length > topN) {
                linhas.push(`- **Demais (${promotores.linhas.length - topN})** não detalhados.`);
            }
            linhas.push('');
        }
    }

    if (ativo.has('aproveitamento')) {
        linhas.push('## Aproveitamento ponderado');
        linhas.push('');
        linhas.push(
            `O aproveitamento geral do período é de **${formatPercent(totais.aproveitamento)}**, `
            + `correspondente a ${formatNumber(totais.pontos, 2)} pontos distribuídos entre `
            + `${formatNumber(totais.efetivos)} ${plural(totais.efetivos, 'júri efetivo', 'júris efetivos')}.`
        );
        if (estilo === 'analitico') {
            linhas.push('');
            linhas.push('Pesos vigentes por espécie:');
            linhas.push('');
            for (const [especie, peso] of Object.entries(settings?.pontuacao || {})) {
                linhas.push(`- ${especie}: ${peso}`);
            }
        }
        linhas.push('');
    }

    if (ativo.has('horarios')) {
        const horarios = computeHorarios(juris);
        if (horarios.length > 0) {
            linhas.push('## Faixas de horário');
            linhas.push('');
            for (const faixa of horarios) {
                linhas.push(
                    `- **${faixa.faixa}**: ${formatNumber(faixa.quantidade)} `
                    + `${plural(faixa.quantidade, 'júri', 'júris')} (${formatPercent(faixa.percentual)}).`
                );
            }
            linhas.push('');
        }
    }

    if (ativo.has('dissolucoes')) {
        const { dissolvidos } = splitEfetivos(juris, settings);
        linhas.push('## Dissoluções');
        linhas.push('');
        if (dissolvidos.length === 0) {
            linhas.push('Não houve dissolução de conselho no período analisado.');
        } else {
            linhas.push(
                `${plural(dissolvidos.length, 'Houve', 'Houve')} ${formatNumber(dissolvidos.length)} `
                + `${plural(dissolvidos.length, 'dissolução', 'dissoluções')} no período, `
                + `${plural(dissolvidos.length, 'não computada', 'não computadas')} nas demais seções.`
            );
            linhas.push('');
            for (const juri of dissolvidos.slice(0, estilo === 'executivo' ? 5 : 50)) {
                const motivo = juri.observacoes ? ` — ${juri.observacoes}` : '';
                linhas.push(
                    `- ${juri.numero_processo || 'sem número'} — ${formatDateBR(juri.data_juri)} `
                    + `— ${juri.comarca || SEM_VALOR}${motivo}`
                );
            }
        }
        linhas.push('');
    }

    return linhas.join('\n');
}
