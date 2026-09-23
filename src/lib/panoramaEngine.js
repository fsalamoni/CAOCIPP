// ============================================================================
// panoramaEngine — cálculos do módulo Panorama
// ----------------------------------------------------------------------------
// Funções puras, sem React e sem Firebase: dados entram, números saem. É o que
// permite testar cada regra isoladamente e reusar o mesmo cálculo na tela, no
// relatório e no arquivo exportado.
//
// A diferença para o motor da Jurimetria: lá cada função sabia que `comarca`
// era uma comarca. Aqui nada sabe. Toda leitura de dado passa por `valorDe`,
// que recebe uma CHAVE DE COLUNA, e as funções de alto nível recebem a BASE
// para descobrir qual coluna faz qual papel. É o que torna o módulo coringa:
// o código não conhece o domínio de nenhum órgão.
// ============================================================================

import {
    PANORAMA_DEFAULT_ANALYSIS,
    PANORAMA_FAIXAS_PRESCRICAO,
    columnForRole,
    dimensoesDaBase,
    keyForRole,
    resolveBase,
} from '@/constants/panorama';

export const SEM_VALOR = '(não informado)';

const MESES = [
    'jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.',
    'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.',
];
const MESES_LONGOS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ----------------------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------------------

/** Texto normalizado: minúsculo, sem acento, espaços colapsados. */
export function normalizeText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/** Valor de uma coluna num registro. Tudo do Panorama vive em `values`. */
export function valorDe(registro, colKey) {
    if (!registro || !colKey) return null;
    const v = registro.values?.[colKey];
    return v === undefined ? null : v;
}

/** Valor da coluna que ocupa um papel, ou `null` se o papel não foi mapeado. */
export function valorDoPapel(registro, base, role) {
    const key = keyForRole(base, role);
    return key ? valorDe(registro, key) : null;
}

/** Texto de exibição de um valor, conforme o tipo da coluna. */
export function formatarValor(valor, tipo) {
    if (valor === null || valor === undefined || valor === '') return '';
    switch (tipo) {
        case 'data': return formatDateBR(valor);
        case 'moeda': return formatMoeda(valor);
        case 'numero': return formatNumber(valor);
        case 'booleano': return valor === true ? 'Sim' : valor === false ? 'Não' : '';
        default: return String(valor);
    }
}

export function formatNumber(value, decimals = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export function formatMoeda(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPercent(ratio, decimals = 1) {
    if (ratio === null || ratio === undefined || !Number.isFinite(Number(ratio))) return '—';
    return `${(Number(ratio) * 100).toFixed(decimals).replace('.', ',')}%`;
}

export function formatDateBR(iso) {
    const s = String(iso || '');
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || '');
}

/** Concordância de número em português, para o texto dos relatórios. */
export function plural(quantidade, singular, pluralForma) {
    return Number(quantidade) === 1 ? singular : pluralForma;
}

// ----------------------------------------------------------------------------
// Opções de análise
// ----------------------------------------------------------------------------

export function resolveAnalysis(analysis) {
    return { ...PANORAMA_DEFAULT_ANALYSIS, ...(analysis || {}) };
}

/**
 * Desfechos que o órgão marcou como NÃO sendo solução de mérito.
 *
 * É o análogo genérico da dissolução na Jurimetria: um arquivamento por
 * ilegitimidade conta no total de casos, mas não deve entrar no cálculo de
 * efetividade — senão o órgão que mais tria parece o menos eficaz.
 */
export function isNeutro(registro, base) {
    const valor = valorDoPapel(registro, base, 'desfecho');
    if (!valor) return false;
    return (base?.desfechos?.neutros || []).includes(String(valor));
}

/** Separa os registros entre os que contam para efetividade e os neutros. */
export function splitEfetivos(registros, base) {
    const efetivos = [];
    const neutros = [];
    for (const r of registros || []) {
        if (isNeutro(r, base)) neutros.push(r); else efetivos.push(r);
    }
    return { efetivos, neutros };
}

/** Aplica as opções de análise ao conjunto. */
export function aplicarAnalise(registros, base, analysis) {
    const opts = resolveAnalysis(analysis);
    if (!opts.excluirNeutros) return registros || [];
    return (registros || []).filter((r) => !isNeutro(r, base));
}

// ----------------------------------------------------------------------------
// Dimensões
// ----------------------------------------------------------------------------

/** Mês/ano do registro, pela data principal. */
export function mesDoRegistro(registro, base) {
    const data = String(valorDoPapel(registro, base, 'data_principal') || '');
    const m = /^(\d{4})-(\d{2})/.exec(data);
    return m ? { ano: Number(m[1]), mes: Number(m[2]) } : null;
}

/** Região a que a unidade do registro pertence. */
export function regiaoDoRegistro(registro, base) {
    const unidade = valorDoPapel(registro, base, 'unidade');
    if (!unidade) return SEM_VALOR;
    const alvo = normalizeText(unidade);
    for (const [regiao, membros] of Object.entries(base?.regioes || {})) {
        if (membros.some((m) => normalizeText(m) === alvo)) return regiao;
    }
    // Unidade que não está em nenhuma região configurada. Dizer isso é melhor
    // que somar ao "(não informado)": o dado existe, falta o agrupamento.
    return 'Sem região definida';
}

/**
 * Valor de uma dimensão num registro.
 *
 * `dimension` é ou a chave de uma coluna da base, ou uma das dimensões
 * derivadas (`__mes`, `__ano`, `__trimestre`, `__regiao`, `__prescricao`),
 * que só existem quando o papel correspondente foi mapeado.
 */
export function dimensionValue(registro, dimension, base) {
    switch (dimension) {
        case '__mes': {
            const m = mesDoRegistro(registro, base);
            return m ? `${MESES[m.mes - 1]}/${String(m.ano).slice(2)}` : SEM_VALOR;
        }
        case '__ano': {
            const m = mesDoRegistro(registro, base);
            return m ? String(m.ano) : SEM_VALOR;
        }
        case '__trimestre': {
            const m = mesDoRegistro(registro, base);
            return m ? `${Math.ceil(m.mes / 3)}º tri/${m.ano}` : SEM_VALOR;
        }
        case '__regiao': return regiaoDoRegistro(registro, base);
        case '__prescricao': {
            const p = prescricaoDoRegistro(registro, base);
            return faixaLabel(p.faixa);
        }
        default: {
            const col = (base?.columns || []).find((c) => c.key === dimension);
            const valor = valorDe(registro, dimension);
            if (valor === null || valor === undefined || valor === '') return SEM_VALOR;
            if (col?.type === 'booleano') return valor === true ? 'Sim' : 'Não';
            if (col?.type === 'data') return formatDateBR(valor);
            return String(valor);
        }
    }
}

function faixaLabel(key) {
    return PANORAMA_FAIXAS_PRESCRICAO.find((f) => f.key === key)?.label || key;
}

/** Chave ordenável de uma dimensão (datas ordenam cronologicamente). */
export function dimensionSortKey(registro, dimension, base) {
    if (dimension === '__mes' || dimension === '__ano' || dimension === '__trimestre') {
        const m = mesDoRegistro(registro, base);
        if (!m) return '';
        if (dimension === '__ano') return String(m.ano);
        if (dimension === '__trimestre') return `${m.ano}-${Math.ceil(m.mes / 3)}`;
        return `${m.ano}-${String(m.mes).padStart(2, '0')}`;
    }
    const col = (base?.columns || []).find((c) => c.key === dimension);
    if (col?.type === 'data') return String(valorDe(registro, dimension) || '');
    return null;
}

/** Rótulo de uma dimensão, para cabeçalhos e texto. */
export function dimensionLabel(dimension, base) {
    const derivadas = {
        __mes: 'Mês', __ano: 'Ano', __trimestre: 'Trimestre',
        __regiao: 'Região', __prescricao: 'Situação de prescrição',
    };
    if (derivadas[dimension]) return derivadas[dimension];
    return (base?.columns || []).find((c) => c.key === dimension)?.label || dimension;
}

// ----------------------------------------------------------------------------
// Prescrição
// ----------------------------------------------------------------------------

/** Dias entre duas datas ISO (b − a). */
function diasEntre(aIso, bIso) {
    const a = Date.parse(`${aIso}T00:00:00Z`);
    const b = Date.parse(`${bIso}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.round((b - a) / 86400000);
}

/** Soma anos a uma data ISO, preservando o dia quando possível. */
export function somarAnos(iso, anos) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return '';
    const ano = Number(m[1]) + Math.floor(anos);
    const mesesExtras = Math.round((anos - Math.floor(anos)) * 12);
    const d = new Date(Date.UTC(ano, Number(m[2]) - 1 + mesesExtras, Number(m[3])));
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

/** Data de hoje em ISO, no fuso local (é o dia civil que importa). */
export function hojeIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Situação de prescrição de um registro.
 *
 * Dois modos, porque as duas realidades existem no MP:
 *   'coluna' — a planilha já traz a data-limite calculada (é o caso quando o
 *              prazo depende de pena em concreto, que nenhuma regra genérica
 *              conseguiria deduzir);
 *   'prazo'  — a plataforma soma N anos a uma data, com prazo por assunto.
 *
 * Devolve sempre `faixa`, mesmo quando não há prazo — 'sem_prazo' é uma
 * informação útil (mostra quantos registros estão fora do controle), não um
 * caso de erro.
 */
export function prescricaoDoRegistro(registro, base, hoje = hojeIso()) {
    const cfg = base?.prescricao || {};
    const modo = cfg.modo || 'desligado';
    if (modo === 'desligado') return { faixa: 'sem_prazo', limite: '', dias: null };

    let limite = '';
    if (modo === 'coluna') {
        limite = String(valorDoPapel(registro, base, 'prazo') || '');
    } else {
        const dataBase = String(valorDoPapel(
            registro, base,
            cfg.contarDe === 'data_referencia' ? 'data_referencia' : 'data_principal'
        ) || '');
        if (dataBase) {
            const assunto = String(valorDoPapel(registro, base, 'assunto') || '');
            const anos = Number.isFinite(Number(cfg.anosPorAssunto?.[assunto]))
                ? Number(cfg.anosPorAssunto[assunto])
                : Number(cfg.anosPadrao) || 0;
            if (anos > 0) limite = somarAnos(dataBase, anos);
        }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(limite)) {
        return { faixa: 'sem_prazo', limite: '', dias: null };
    }

    const dias = diasEntre(hoje, limite);
    if (dias === null) return { faixa: 'sem_prazo', limite: '', dias: null };
    if (dias < 0) return { faixa: 'prescrito', limite, dias };

    // As faixas vêm da configuração, da mais urgente para a menos.
    const alertas = [...(cfg.alertas || [30, 90, 180, 365])].sort((a, b) => a - b);
    const nomes = ['critico', 'alerta', 'atencao'];
    for (let i = 0; i < alertas.length && i < nomes.length; i++) {
        if (dias <= alertas[i]) return { faixa: nomes[i], limite, dias };
    }
    return { faixa: 'confortavel', limite, dias };
}

// ----------------------------------------------------------------------------
// Filtros
// ----------------------------------------------------------------------------

/**
 * Aplica os filtros ao conjunto.
 *
 * `campos` é um mapa { chaveDaColuna: [valores] } — montado pela interface a
 * partir das colunas que a base tem, e não de uma lista fixa de campos.
 */
export function filtrarRegistros(registros, filtros = {}, base = {}) {
    const {
        busca = '',
        campos = {},
        dataDe = '',
        dataAte = '',
        valorMin = '',
        valorMax = '',
        prescricoes = [],
        regioes = [],
    } = filtros;

    const buscaNorm = normalizeText(busca);
    const dataKey = keyForRole(base, 'data_principal');
    const valorKey = keyForRole(base, 'valor');

    const conjuntos = Object.entries(campos)
        .filter(([, valores]) => Array.isArray(valores) && valores.length > 0)
        .map(([key, valores]) => [key, new Set(valores.map(String))]);
    const prescricaoSet = new Set(prescricoes);
    const regiaoSet = new Set(regioes);

    const min = String(valorMin) !== '' && Number.isFinite(Number(valorMin)) ? Number(valorMin) : null;
    const max = String(valorMax) !== '' && Number.isFinite(Number(valorMax)) ? Number(valorMax) : null;

    return (registros || []).filter((registro) => {
        for (const [key, set] of conjuntos) {
            const v = valorDe(registro, key);
            const texto = v === true ? 'Sim' : v === false ? 'Não' : String(v ?? '');
            if (!set.has(texto)) return false;
        }

        if (dataKey && (dataDe || dataAte)) {
            const data = String(valorDe(registro, dataKey) || '');
            if (dataDe && (!data || data < dataDe)) return false;
            if (dataAte && (!data || data > dataAte)) return false;
        }

        if (valorKey && (min !== null || max !== null)) {
            // Filtrar por valor exclui quem não tem valor: incluí-lo seria
            // afirmar algo sobre uma quantia que não se conhece.
            const n = numeroDe(registro, valorKey);
            if (n === null) return false;
            if (min !== null && n < min) return false;
            if (max !== null && n > max) return false;
        }

        if (prescricaoSet.size > 0
            && !prescricaoSet.has(prescricaoDoRegistro(registro, base).faixa)) return false;

        if (regiaoSet.size > 0 && !regiaoSet.has(regiaoDoRegistro(registro, base))) return false;

        if (buscaNorm) {
            const alvo = normalizeText(Object.values(registro.values || {}).join(' '));
            if (!alvo.includes(buscaNorm)) return false;
        }

        return true;
    });
}

// ----------------------------------------------------------------------------
// Estatísticas
// ----------------------------------------------------------------------------

/** Peso do desfecho de um registro (0 quando não configurado). */
export function pesoDoRegistro(registro, base) {
    const valor = valorDoPapel(registro, base, 'desfecho');
    if (!valor) return 0;
    const peso = Number(base?.desfechos?.pesos?.[String(valor)]);
    return Number.isFinite(peso) ? Math.min(1, Math.max(0, peso)) : 0;
}

/**
 * Número de uma coluna num registro, ou `null` quando não há número ali.
 *
 * `Number(null)` é 0 e `Number('')` também — e 0 é um número perfeitamente
 * finito. Sem esta checagem, todo registro SEM valor entraria nas contas
 * valendo R$ 0,00: a média despencaria, e um filtro "valor acima de zero"
 * devolveria justamente os que não têm valor nenhum.
 */
export function numeroDe(registro, colKey) {
    if (!colKey) return null;
    const bruto = valorDe(registro, colKey);
    if (bruto === null || bruto === undefined || bruto === '') return null;
    const n = Number(bruto);
    return Number.isFinite(n) ? n : null;
}

/** Valor monetário de um registro, ou `null`. */
export function valorMonetario(registro, base) {
    return numeroDe(registro, keyForRole(base, 'valor'));
}

/** Estatísticas agregadas de um conjunto de registros. */
export function statsOf(registros, base) {
    const lista = registros || [];
    const { efetivos, neutros } = splitEfetivos(lista, base);

    let pontos = 0;
    for (const r of efetivos) pontos += pesoDoRegistro(r, base);

    let valorTotal = 0;
    let comValor = 0;
    for (const r of lista) {
        const v = valorMonetario(r, base);
        if (v === null) continue;
        valorTotal += v;
        comValor += 1;
    }

    return {
        quantidade: lista.length,
        efetivos: efetivos.length,
        neutros: neutros.length,
        pontos,
        aproveitamento: efetivos.length ? pontos / efetivos.length : null,
        valorTotal,
        comValor,
        valorMedio: comValor ? valorTotal / comValor : null,
    };
}

export const EMPTY_STATS = {
    quantidade: 0, efetivos: 0, neutros: 0, pontos: 0, aproveitamento: null,
    valorTotal: 0, comValor: 0, valorMedio: null,
};

/** Soma duas estatísticas (usada nos subtotais da tabela dinâmica). */
export function addStats(a, b) {
    const efetivos = a.efetivos + b.efetivos;
    const pontos = a.pontos + b.pontos;
    const comValor = a.comValor + b.comValor;
    const valorTotal = a.valorTotal + b.valorTotal;
    return {
        quantidade: a.quantidade + b.quantidade,
        efetivos,
        neutros: a.neutros + b.neutros,
        pontos,
        aproveitamento: efetivos ? pontos / efetivos : null,
        valorTotal,
        comValor,
        valorMedio: comValor ? valorTotal / comValor : null,
    };
}

// ----------------------------------------------------------------------------
// Agregações de alto nível
// ----------------------------------------------------------------------------

/** Totais do recorte. */
export function computeTotais(registros, base, analysis) {
    const considerados = aplicarAnalise(registros, base, analysis);
    const stats = statsOf(considerados, base);
    const totalBruto = (registros || []).length;
    return {
        ...stats,
        totalBruto,
        pctEfetivos: stats.quantidade ? stats.efetivos / stats.quantidade : null,
        pctNeutros: stats.quantidade ? stats.neutros / stats.quantidade : null,
    };
}

/**
 * Distribuição por uma dimensão qualquer, ordenada por volume.
 *
 * É a função que substitui `computeRanking`, `computeEspecies` e
 * `computeMaterias` da Jurimetria de uma vez só: como nada aqui sabe o que a
 * dimensão significa, a mesma função serve para comarca, assunto, desfecho,
 * responsável ou qualquer coluna que o órgão tenha.
 */
export function computeDistribuicao(registros, dimension, base, analysis) {
    const opts = resolveAnalysis(analysis);
    const considerados = aplicarAnalise(registros, base, analysis);

    const grupos = new Map();
    for (const registro of considerados) {
        const chave = dimensionValue(registro, dimension, base);
        if (opts.excluirNaoInformados && chave === SEM_VALOR) continue;
        if (!grupos.has(chave)) {
            grupos.set(chave, {
                chave,
                registros: [],
                sortKey: dimensionSortKey(registro, dimension, base),
            });
        }
        grupos.get(chave).registros.push(registro);
    }

    const total = [...grupos.values()].reduce((acc, g) => acc + g.registros.length, 0);
    const cronologica = ['__mes', '__ano', '__trimestre'].includes(dimension)
        || (base?.columns || []).find((c) => c.key === dimension)?.type === 'data';

    const linhas = [...grupos.values()]
        .map((g) => {
            const stats = statsOf(g.registros, base);
            return {
                chave: g.chave,
                sortKey: g.sortKey,
                ...stats,
                percentual: total ? g.registros.length / total : null,
            };
        })
        .sort(cronologica
            ? (a, b) => String(a.sortKey || '').localeCompare(String(b.sortKey || ''))
            : (a, b) => (b.quantidade - a.quantidade)
                || String(a.chave).localeCompare(String(b.chave), 'pt-BR'));

    return { dimension, total, linhas };
}

/** Série temporal por mês, com os rótulos prontos para o gráfico. */
export function computeSerieMensal(registros, base, analysis) {
    const considerados = aplicarAnalise(registros, base, analysis);
    const meses = new Map();

    for (const registro of considerados) {
        const m = mesDoRegistro(registro, base);
        if (!m) continue;
        const chave = `${m.ano}-${String(m.mes).padStart(2, '0')}`;
        if (!meses.has(chave)) meses.set(chave, { ano: m.ano, mes: m.mes, registros: [] });
        meses.get(chave).registros.push(registro);
    }

    return [...meses.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([chave, g]) => ({
            chave,
            label: `${MESES[g.mes - 1]}/${String(g.ano).slice(2)}`,
            labelCompleto: `${MESES_LONGOS[g.mes - 1]} de ${g.ano}`,
            ...statsOf(g.registros, base),
        }));
}

/**
 * Panorama de prescrição: quantos registros em cada faixa de urgência, com a
 * lista dos mais urgentes.
 */
export function computePrescricao(registros, base, analysis, hoje = hojeIso()) {
    const considerados = aplicarAnalise(registros, base, analysis);
    const contagem = {};
    for (const f of PANORAMA_FAIXAS_PRESCRICAO) contagem[f.key] = 0;

    const comPrazo = [];
    const colId = columnForRole(base, 'identificador');

    for (const registro of considerados) {
        const p = prescricaoDoRegistro(registro, base, hoje);
        contagem[p.faixa] = (contagem[p.faixa] || 0) + 1;
        if (p.limite) {
            comPrazo.push({
                id: registro.id,
                identificador: colId ? String(valorDe(registro, colId.key) ?? '') : '',
                unidade: String(valorDoPapel(registro, base, 'unidade') ?? ''),
                responsavel: String(valorDoPapel(registro, base, 'responsavel') ?? ''),
                assunto: String(valorDoPapel(registro, base, 'assunto') ?? ''),
                limite: p.limite,
                dias: p.dias,
                faixa: p.faixa,
            });
        }
    }

    comPrazo.sort((a, b) => a.dias - b.dias);
    const total = considerados.length;
    // Denominador dos percentuais: só quem TEM prazo. Incluir os sem prazo
    // faria o índice de "confortável" subir por falta de dado, não por folga.
    const comPrazoTotal = total - (contagem.sem_prazo || 0);

    return {
        total,
        comPrazo: comPrazoTotal,
        semPrazo: contagem.sem_prazo || 0,
        contagem,
        pct: Object.fromEntries(
            Object.entries(contagem).map(([k, v]) => [k, comPrazoTotal ? v / comPrazoTotal : null])
        ),
        urgentes: comPrazo.slice(0, 200),
        prescritos: comPrazo.filter((r) => r.faixa === 'prescrito'),
    };
}

/**
 * Gargalos: onde os registros se acumulam numa situação.
 *
 * A leitura de gestão que o painel não dá sozinho — não é "quantos casos
 * existem", é "quantos estão parados na mesma etapa, e há quanto tempo".
 */
export function computeGargalos(registros, base, analysis, hoje = hojeIso()) {
    const considerados = aplicarAnalise(registros, base, analysis);
    const situacaoKey = keyForRole(base, 'situacao');
    const dataKey = keyForRole(base, 'data_principal');
    if (!situacaoKey) return { disponivel: false, linhas: [], total: 0 };

    const grupos = new Map();
    for (const registro of considerados) {
        const situacao = String(valorDe(registro, situacaoKey) ?? '') || SEM_VALOR;
        if (!grupos.has(situacao)) grupos.set(situacao, { situacao, registros: [], idades: [] });
        const g = grupos.get(situacao);
        g.registros.push(registro);

        if (dataKey) {
            const data = String(valorDe(registro, dataKey) || '');
            const dias = /^\d{4}-\d{2}-\d{2}$/.test(data) ? diasEntre(data, hoje) : null;
            if (dias !== null && dias >= 0) g.idades.push(dias);
        }
    }

    const total = considerados.length;
    const linhas = [...grupos.values()].map((g) => {
        const ordenadas = [...g.idades].sort((a, b) => a - b);
        const meio = Math.floor(ordenadas.length / 2);
        return {
            situacao: g.situacao,
            quantidade: g.registros.length,
            percentual: total ? g.registros.length / total : null,
            idadeMedia: ordenadas.length
                ? ordenadas.reduce((a, b) => a + b, 0) / ordenadas.length
                : null,
            idadeMediana: ordenadas.length
                ? (ordenadas.length % 2 ? ordenadas[meio] : (ordenadas[meio - 1] + ordenadas[meio]) / 2)
                : null,
            maisAntigo: ordenadas.length ? ordenadas[ordenadas.length - 1] : null,
            comIdade: ordenadas.length,
        };
    }).sort((a, b) => b.quantidade - a.quantidade);

    return { disponivel: true, total, linhas, temIdade: Boolean(dataKey) };
}

/**
 * Concentração: quanto do total está nas primeiras posições de uma dimensão.
 *
 * Responde à pergunta de alocação de força de trabalho — um estado em que três
 * comarcas respondem por 70% da demanda pede uma política diferente de um em
 * que ela está espalhada por trinta.
 */
export function computeConcentracao(registros, dimension, base, analysis) {
    const dist = computeDistribuicao(registros, dimension, base, analysis);
    const total = dist.total;
    if (!total || dist.linhas.length === 0) {
        return { total: 0, grupos: 0, top3: 0, pctTop3: null, pctTop10: null, leitura: '', linhas: [] };
    }

    const acumulado = (n) => dist.linhas.slice(0, n).reduce((acc, l) => acc + l.quantidade, 0);
    const top3 = acumulado(3);
    const top10 = acumulado(10);
    const pctTop3 = top3 / total;

    // Quantos grupos são precisos para chegar à metade do volume. É a medida
    // mais honesta de concentração: independe de quantos grupos existem.
    let soma = 0;
    let paraMetade = 0;
    for (const linha of dist.linhas) {
        soma += linha.quantidade;
        paraMetade += 1;
        if (soma >= total / 2) break;
    }

    const leitura = pctTop3 >= 0.7
        ? 'fortemente concentrada'
        : pctTop3 >= 0.4 ? 'moderadamente concentrada' : 'dispersa';

    return {
        total,
        grupos: dist.linhas.length,
        top3,
        pctTop3,
        pctTop10: top10 / total,
        paraMetade,
        leitura,
        linhas: dist.linhas,
    };
}

// ----------------------------------------------------------------------------
// Tabela dinâmica
// ----------------------------------------------------------------------------

const PATH_SEP = '\u0000';

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

    const ordenar = (node) => {
        node.children.sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR', { numeric: true }));
        node.children.forEach(ordenar);
    };
    ordenar(root);
    return root;
}

function collectLeaves(node, acc = []) {
    if (node.leaf && node.level >= 0) acc.push(node);
    node.children.forEach((c) => collectLeaves(c, acc));
    return acc;
}

function collectNodes(node, acc = []) {
    if (node.level >= 0) acc.push(node);
    node.children.forEach((c) => collectNodes(c, acc));
    return acc;
}

/**
 * Tabela dinâmica multi-nível.
 *
 * Cada registro é contabilizado UMA vez e propagado para todos os prefixos de
 * linha e coluna — assim os subtotais de todos os níveis saem sem varrer os
 * dados de novo, que é o que mantém o cálculo instantâneo até o teto de 20 mil
 * registros por base.
 */
export function buildPivot(registros, config, base, analysis) {
    const opts = resolveAnalysis(analysis);
    const {
        rowDims = [],
        colDims = [],
        values = ['quantidade'],
        showAs = 'valor',
        subtotais = 'auto',
    } = config || {};

    const considerados = aplicarAnalise(registros, base, analysis);

    const cells = new Map();
    const rowTotals = new Map();
    const colTotals = new Map();
    let grandTotal = { ...EMPTY_STATS };
    const rowPaths = new Set();
    const colPaths = new Set();

    const acumular = (mapa, chave, stats) => {
        mapa.set(chave, mapa.has(chave) ? addStats(mapa.get(chave), stats) : stats);
    };

    // Agrupa primeiro, para calcular as estatísticas uma vez por cruzamento.
    const buckets = new Map();
    for (const registro of considerados) {
        const rowPath = rowDims.map((d) => dimensionValue(registro, d, base));
        const colPath = colDims.map((d) => dimensionValue(registro, d, base));
        if (opts.excluirNaoInformados
            && [...rowPath, ...colPath].includes(SEM_VALOR)) continue;

        const chave = `${rowPath.join(PATH_SEP)}|${colPath.join(PATH_SEP)}`;
        if (!buckets.has(chave)) buckets.set(chave, { rowPath, colPath, registros: [] });
        buckets.get(chave).registros.push(registro);
    }

    for (const { rowPath, colPath, registros: lista } of buckets.values()) {
        const stats = statsOf(lista, base);
        rowPaths.add(rowPath.join(PATH_SEP));
        colPaths.add(colPath.join(PATH_SEP));

        // Propaga para todos os prefixos dos dois eixos.
        const rowPrefixos = rowPath.length
            ? rowPath.map((_, i) => rowPath.slice(0, i + 1).join(PATH_SEP))
            : [''];
        const colPrefixos = colPath.length
            ? colPath.map((_, i) => colPath.slice(0, i + 1).join(PATH_SEP))
            : [''];

        for (const rk of rowPrefixos) {
            acumular(rowTotals, rk, stats);
            for (const ck of colPrefixos) acumular(cells, `${rk}|${ck}`, stats);
        }
        for (const ck of colPrefixos) acumular(colTotals, ck, stats);
        grandTotal = addStats(grandTotal, stats);
    }

    const rowTree = buildAxisTree(
        [...rowPaths].filter(Boolean).map((p) => p.split(PATH_SEP)), rowDims.length
    );
    const colTree = buildAxisTree(
        [...colPaths].filter(Boolean).map((p) => p.split(PATH_SEP)), colDims.length
    );

    const colLeaves = colDims.length ? collectLeaves(colTree) : [{ key: '', label: '', path: [], level: 0 }];
    const rowNodes = rowDims.length ? collectNodes(rowTree) : [{ key: '', label: 'Total', path: [], level: 0, children: [] }];

    // Cabeçalhos de coluna, um nível por linha.
    const colHeaderRows = [];
    for (let level = 0; level < colDims.length; level++) {
        const nivel = collectNodes(colTree).filter((n) => n.level === level);
        colHeaderRows.push(nivel.map((n) => ({
            key: n.key,
            label: n.label,
            span: Math.max(1, collectLeaves(n).length || 1),
        })));
    }

    return {
        rowDims, colDims, values, showAs, subtotais,
        cells, rowTotals, colTotals, grandTotal,
        rowNodes, colLeaves, colHeaderRows,
    };
}

/** Valor formatado de uma célula da tabela dinâmica. */
export function formatPivotValue(stats, measure, showAs, divisor) {
    if (!stats) return '—';

    if (measure === 'aproveitamento') return formatPercent(stats.aproveitamento);
    if (measure === 'valor_medio') return formatMoeda(stats.valorMedio);

    const raw = measure === 'valor_total'
        ? stats.valorTotal
        : measure === 'pontos' ? stats.pontos : stats.quantidade;

    if (showAs === 'valor' || !divisor) {
        if (measure === 'valor_total') return formatMoeda(raw);
        return measure === 'pontos' ? formatNumber(raw, 2) : formatNumber(raw);
    }

    const base = measure === 'valor_total'
        ? divisor.valorTotal
        : measure === 'pontos' ? divisor.pontos : divisor.quantidade;

    if (!base) return '—';
    return formatPercent(raw / base);
}

export function measureLabel(measure) {
    switch (measure) {
        case 'aproveitamento': return 'Aprov.';
        case 'pontos': return 'Pontos';
        case 'valor_total': return 'Valor total';
        case 'valor_medio': return 'Valor médio';
        default: return 'Qtde';
    }
}

/** Faixas de aproveitamento, para a etiqueta colorida. */
export const PANORAMA_FAIXAS_APROVEITAMENTO = [
    { min: 0.8, label: 'Muito alto', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
    { min: 0.6, label: 'Alto', badge: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300' },
    { min: 0.4, label: 'Médio', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    { min: 0.2, label: 'Baixo', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
    { min: 0, label: 'Muito baixo', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
];

export function faixaAproveitamento(ratio) {
    if (ratio === null || ratio === undefined || !Number.isFinite(Number(ratio))) return null;
    return PANORAMA_FAIXAS_APROVEITAMENTO.find((f) => Number(ratio) >= f.min) || null;
}

/** Base resolvida — reexportado para quem só importa o motor. */
export { resolveBase, columnForRole, keyForRole };


// ----------------------------------------------------------------------------
// Relatório descritivo
// ----------------------------------------------------------------------------

/** Escapa o que quebraria uma célula de tabela markdown. */
function mdCell(value) {
    return String(value ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

/** Monta uma tabela markdown com alinhamento por coluna. */
export function mdTable(headers, rows, aligns = []) {
    if (!headers?.length) return [];
    const sep = headers.map((_, i) => {
        const a = aligns[i] || (i === 0 ? 'l' : 'r');
        if (a === 'r') return '---:';
        if (a === 'c') return ':---:';
        return '---';
    });
    const linhas = [
        `| ${headers.map(mdCell).join(' | ')} |`,
        `| ${sep.join(' | ')} |`,
    ];
    for (const row of rows) linhas.push(`| ${row.map(mdCell).join(' | ')} |`);
    return linhas;
}

/**
 * Cruzamento de duas dimensões quaisquer da base.
 *
 * É o que sustenta o estilo analítico: linhas e colunas já ordenadas por
 * volume (o que mais pesa vem primeiro), a matriz de contagens e os totais de
 * cada margem. Dimensões de data ordenam cronologicamente, não por volume.
 */
export function crossTab(registros, rowDim, colDim, base, analysis) {
    const opts = resolveAnalysis(analysis);
    const considerados = aplicarAnalise(registros, base, analysis);

    const matriz = new Map();
    const totaisLinha = new Map();
    const totaisColuna = new Map();
    // Chave de ordenação de cada rótulo. O rótulo de uma data é formatado para
    // leitura ("jan./25", "15/03/2024") e ordenar por ele daria ordem
    // alfabética — abril antes de janeiro. A chave cronológica vem do registro.
    const ordemLinha = new Map();
    const ordemColuna = new Map();
    let total = 0;

    for (const registro of considerados) {
        const linha = dimensionValue(registro, rowDim, base);
        const coluna = dimensionValue(registro, colDim, base);
        if (opts.excluirNaoInformados && (linha === SEM_VALOR || coluna === SEM_VALOR)) continue;

        const chave = `${linha}${PATH_SEP}${coluna}`;
        matriz.set(chave, (matriz.get(chave) || 0) + 1);
        totaisLinha.set(linha, (totaisLinha.get(linha) || 0) + 1);
        totaisColuna.set(coluna, (totaisColuna.get(coluna) || 0) + 1);
        if (!ordemLinha.has(linha)) ordemLinha.set(linha, dimensionSortKey(registro, rowDim, base));
        if (!ordemColuna.has(coluna)) ordemColuna.set(coluna, dimensionSortKey(registro, colDim, base));
        total += 1;
    }

    const cronologica = (dim) => ['__mes', '__ano', '__trimestre'].includes(dim)
        || (base?.columns || []).find((c) => c.key === dim)?.type === 'data';
    const porVolume = (a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0]), 'pt-BR');
    const ordenar = (mapa, dim, ordem) => {
        const entradas = [...mapa.entries()];
        if (cronologica(dim)) {
            return entradas
                .map(([k]) => k)
                .sort((a, b) => String(ordem.get(a) ?? a).localeCompare(String(ordem.get(b) ?? b), 'pt-BR'));
        }
        return entradas.sort(porVolume).map(([k]) => k);
    };

    return {
        rowDim,
        colDim,
        total,
        rows: ordenar(totaisLinha, rowDim, ordemLinha),
        cols: ordenar(totaisColuna, colDim, ordemColuna),
        rowTotals: totaisLinha,
        colTotals: totaisColuna,
        get: (linha, coluna) => matriz.get(`${linha}${PATH_SEP}${coluna}`) || 0,
    };
}

/**
 * Plural em português do rótulo de uma dimensão.
 *
 * As derivadas têm plural escrito — "mês" não pode virar "mêss". As demais vêm
 * de colunas nomeadas pelo próprio órgão, e aí valem as regras correntes:
 * ~ão→~ões, ~al→~ais, ~m→~ns, ~r/~z→~es, vogal→~s.
 */
const DIM_PLURAL_DERIVADO = {
    __mes: 'meses', __ano: 'anos', __trimestre: 'trimestres',
    __regiao: 'regiões', __prescricao: 'situações de prescrição',
};

/** Palavras que, presentes no rótulo, impedem a flexão do que vem depois. */
const DIM_CONECTIVOS = new Set([
    'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
    'por', 'para', 'com', 'a', 'o', 'e',
]);

/** Flexiona uma única palavra pelas regras correntes do português. */
function flexionar(palavra) {
    if (/ão$/.test(palavra)) return palavra.replace(/ão$/, 'ões');
    if (/[aeiou]l$/.test(palavra)) return palavra.replace(/l$/, 'is');
    if (/m$/.test(palavra)) return palavra.replace(/m$/, 'ns');
    if (/[rz]$/.test(palavra)) return `${palavra}es`;
    if (/s$/.test(palavra)) return palavra;
    if (/[^a-záéíóúâêôãõç]/.test(palavra)) return palavra;
    return `${palavra}s`;
}

export function dimensionLabelPlural(dimension, base) {
    if (DIM_PLURAL_DERIVADO[dimension]) return DIM_PLURAL_DERIVADO[dimension];
    const label = String(dimensionLabel(dimension, base)).toLowerCase();
    const partes = label.split(' ');

    // Rótulo com conectivo ("nº do processo", "data de autuação") tem o núcleo
    // na primeira palavra: flexionar a última produziria "nº do processos".
    // Nesses casos o rótulo fica como está, que lê melhor do que qualquer
    // palpite. Sem conectivo ("promotor natural"), substantivo e adjetivo
    // concordam, e os dois vão para o plural.
    if (partes.some((w) => DIM_CONECTIVOS.has(w))) return label;
    return partes.map(flexionar).join(' ');
}

/** Rótulo no singular, em caixa baixa, para uso dentro de frases. */
function dimSingular(dimension, base) {
    return String(dimensionLabel(dimension, base)).toLowerCase();
}

/** Nota de cabeçalho: diz de saída o que cada estilo entrega. */
const PANORAMA_ESTILO_NOTA = {
    formal: 'Redação formal e objetiva: texto corrido, em registro próprio para '
        + 'instrução de expediente, com tabelas apenas onde substituem o parágrafo.',
    executivo: 'Formato executivo: síntese numérica seguida das tabelas que a '
        + 'sustentam, por todos os ângulos disponíveis na base.',
    analitico: 'Formato analítico: cruzamento das dimensões entre si, com a leitura '
        + 'do que os cruzamentos revelam sobre concentração, dispersão e casos extremos.',
};

export const PANORAMA_ESTILOS_DESCRITIVO = [
    { value: 'formal', label: 'Formal', description: PANORAMA_ESTILO_NOTA.formal },
    { value: 'executivo', label: 'Executivo', description: PANORAMA_ESTILO_NOTA.executivo },
    { value: 'analitico', label: 'Analítico', description: PANORAMA_ESTILO_NOTA.analitico },
];

/** Uma linha de distribuição em frase: "Comarca X, com 12 registros (18,5%)". */
function frasearLinha(linha, total) {
    return `${linha.chave}, com ${formatNumber(linha.quantidade)} `
        + `${plural(linha.quantidade, 'registro', 'registros')}`
        + `${total > 0 ? ` (${formatPercent(linha.quantidade / total)})` : ''}`;
}

/** Enumera até n linhas de uma distribuição em português corrente. */
function enumerar(linhas, total, n = 3) {
    const usados = linhas.slice(0, n).map((l) => frasearLinha(l, total));
    if (usados.length === 0) return '';
    if (usados.length === 1) return usados[0];
    return `${usados.slice(0, -1).join('; ')}; e ${usados[usados.length - 1]}`;
}

/**
 * Relatório descritivo da base, em markdown.
 *
 * `config` aceita:
 *   estilo      'formal' | 'executivo' | 'analitico'
 *   dimensoes   chaves de dimensão a percorrer (padrão: todas as disponíveis)
 *   incluir     { totais, distribuicao, serie, prescricao, gargalos, concentracao, cruzamentos }
 *   titulo      título do documento
 *   limite      quantas linhas por tabela (padrão 15)
 */
export function buildDescritivo(registros, config, base, analysis) {
    const resolvida = resolveBase(base);
    const opts = resolveAnalysis(analysis);
    const estilo = ['formal', 'executivo', 'analitico'].includes(config?.estilo)
        ? config.estilo : 'formal';
    const limite = Number(config?.limite) > 0 ? Number(config.limite) : 15;
    const incluir = {
        totais: true, distribuicao: true, serie: true, prescricao: true,
        gargalos: true, concentracao: true, cruzamentos: true,
        ...(config?.incluir || {}),
    };

    const disponiveis = dimensoesDaBase(resolvida).map((d) => d.key);
    const dimensoes = (config?.dimensoes?.length
        ? config.dimensoes.filter((d) => disponiveis.includes(d))
        : disponiveis).slice(0, 12);

    const considerados = aplicarAnalise(registros, resolvida, analysis);
    const totais = computeTotais(registros, resolvida, analysis);
    const temDesfecho = Boolean(columnForRole(resolvida, 'desfecho'));
    const temValor = Boolean(columnForRole(resolvida, 'valor'));

    const L = [];
    let secao = 0;
    const h2 = (titulo) => { secao += 1; L.push('', `## ${secao}. ${titulo}`, ''); };
    const p = (texto) => { L.push(texto, ''); };

    // -- Cabeçalho -----------------------------------------------------------
    L.push(`# ${config?.titulo || `Panorama — ${resolvida.nome || 'base sem nome'}`}`);
    L.push('');
    L.push(`*Documento gerado em ${formatDateBR(hojeIso())}. ${PANORAMA_ESTILO_NOTA[estilo]}*`);
    if (resolvida.descricao) L.push('', `*${resolvida.descricao}*`);
    L.push('');
    if (opts.excluirNaoInformados || opts.excluirNeutros) {
        const notas = [];
        if (opts.excluirNaoInformados) notas.push('registros sem o dado da dimensão analisada ficam fora de cada recorte');
        if (opts.excluirNeutros && temDesfecho) notas.push('os desfechos marcados como sem mérito ficam fora do conjunto');
        if (notas.length) p(`*Critérios aplicados: ${notas.join('; ')}.*`);
    }

    if (considerados.length === 0) {
        p('Não há registros que atendam aos filtros aplicados. Não é possível '
            + 'produzir leitura a partir de conjunto vazio.');
        return L.join('\n');
    }

    // -- 1. Panorama geral ----------------------------------------------------
    if (incluir.totais) {
        h2('Panorama geral');
        const partes = [
            `O conjunto analisado reúne ${formatNumber(totais.quantidade)} `
            + `${plural(totais.quantidade, 'registro', 'registros')}`,
        ];
        if (temDesfecho && totais.neutros > 0) {
            partes.push(`dos quais ${formatNumber(totais.neutros)} `
                + `${plural(totais.neutros, 'corresponde', 'correspondem')} a desfecho sem mérito `
                + `e ${formatNumber(totais.efetivos)} `
                + `${plural(totais.efetivos, 'entra', 'entram')} no cálculo de efetividade`);
        }
        if (temDesfecho && totais.aproveitamento !== null) {
            partes.push(`o que resulta num aproveitamento de ${formatPercent(totais.aproveitamento)}`);
        }
        p(`${partes.join(', ')}.`);
        if (temValor && totais.comValor > 0) {
            p(`O valor acumulado dos ${formatNumber(totais.comValor)} `
                + `${plural(totais.comValor, 'registro', 'registros')} com valor informado é de `
                + `${formatMoeda(totais.valorTotal)}, com média de ${formatMoeda(totais.valorMedio)}.`);
        }

        if (estilo !== 'formal') {
            const linhas = [['Registros', formatNumber(totais.quantidade)]];
            if (temDesfecho) {
                linhas.push(['Contam para efetividade', formatNumber(totais.efetivos)]);
                linhas.push(['Sem mérito', formatNumber(totais.neutros)]);
                if (totais.aproveitamento !== null) {
                    linhas.push(['Aproveitamento', formatPercent(totais.aproveitamento)]);
                }
            }
            if (temValor && totais.comValor > 0) {
                linhas.push(['Registros com valor', formatNumber(totais.comValor)]);
                linhas.push(['Valor acumulado', formatMoeda(totais.valorTotal)]);
                if (totais.valorMedio !== null) linhas.push(['Valor médio', formatMoeda(totais.valorMedio)]);
            }
            L.push(...mdTable(['Indicador', 'Valor'], linhas), '');
        }
    }

    // -- 2. Distribuições -----------------------------------------------------
    if (incluir.distribuicao && dimensoes.length) {
        h2('Distribuição por dimensão');

        if (estilo === 'formal') {
            for (const dim of dimensoes) {
                const dist = computeDistribuicao(registros, dim, resolvida, analysis);
                if (!dist.linhas.length) continue;
                p(`Quanto a ${dimensionLabelPlural(dim, resolvida)}, o conjunto se reparte em `
                    + `${formatNumber(dist.linhas.length)} `
                    + `${plural(dist.linhas.length, 'valor distinto', 'valores distintos')}. `
                    + `Concentram o maior volume: ${enumerar(dist.linhas, dist.total, 3)}.`);
            }
        } else {
            for (const dim of dimensoes) {
                const dist = computeDistribuicao(registros, dim, resolvida, analysis);
                if (!dist.linhas.length) continue;
                L.push(`### ${dimensionLabel(dim, resolvida)}`, '');
                const headers = ['Valor', 'Registros', '%'];
                const aligns = ['l', 'r', 'r'];
                if (temDesfecho) { headers.push('Aproveitamento'); aligns.push('r'); }
                if (temValor) { headers.push('Valor total'); aligns.push('r'); }

                const rows = dist.linhas.slice(0, limite).map((linha) => {
                    const row = [
                        linha.chave,
                        formatNumber(linha.quantidade),
                        dist.total > 0 ? formatPercent(linha.quantidade / dist.total) : '—',
                    ];
                    if (temDesfecho) {
                        row.push(linha.aproveitamento === null ? '—' : formatPercent(linha.aproveitamento));
                    }
                    if (temValor) row.push(linha.comValor ? formatMoeda(linha.valorTotal) : '—');
                    return row;
                });

                if (dist.linhas.length > limite) {
                    const resto = dist.linhas.slice(limite);
                    const soma = resto.reduce((acc, l) => acc + l.quantidade, 0);
                    const row = [
                        `Demais ${formatNumber(resto.length)} ${plural(resto.length, 'valor', 'valores')}`,
                        formatNumber(soma),
                        dist.total > 0 ? formatPercent(soma / dist.total) : '—',
                    ];
                    if (temDesfecho) row.push('—');
                    if (temValor) row.push('—');
                    rows.push(row);
                }
                L.push(...mdTable(headers, rows, aligns), '');
            }
        }
    }

    // -- 3. Evolução no tempo -------------------------------------------------
    if (incluir.serie) {
        const serie = computeSerieMensal(registros, resolvida, analysis);
        if (serie.length >= 2) {
            h2('Evolução no tempo');
            const primeiro = serie[0];
            const ultimo = serie[serie.length - 1];
            const pico = serie.reduce((a, b) => (b.quantidade > a.quantidade ? b : a), serie[0]);
            const variacao = primeiro.quantidade > 0
                ? (ultimo.quantidade - primeiro.quantidade) / primeiro.quantidade : null;
            p(`A série cobre ${formatNumber(serie.length)} ${plural(serie.length, 'mês', 'meses')}, `
                + `de ${primeiro.labelCompleto} a ${ultimo.labelCompleto}. O mês de maior volume é `
                + `${pico.labelCompleto}, com ${formatNumber(pico.quantidade)} `
                + `${plural(pico.quantidade, 'registro', 'registros')}`
                + `${variacao === null ? '' : `. Entre o primeiro e o último mês da série a variação é de ${formatPercent(variacao)}`}.`);
            if (estilo !== 'formal') {
                const headers = ['Mês', 'Registros'];
                const rows = serie.map((s) => [s.label, formatNumber(s.quantidade)]);
                if (temDesfecho) {
                    headers.push('Aproveitamento');
                    serie.forEach((s, i) => {
                        rows[i].push(s.aproveitamento === null ? '—' : formatPercent(s.aproveitamento));
                    });
                }
                L.push(...mdTable(headers, rows), '');
            }
        }
    }

    // -- 4. Prescrição --------------------------------------------------------
    if (incluir.prescricao && (resolvida.prescricao?.modo || 'desligado') !== 'desligado') {
        const presc = computePrescricao(registros, resolvida, analysis);
        if (presc.comPrazo > 0) {
            h2('Situação de prescrição');
            const prescritos = presc.contagem.prescrito || 0;
            const criticos = presc.contagem.critico || 0;
            p(`De ${formatNumber(presc.total)} ${plural(presc.total, 'registro', 'registros')}, `
                + `${formatNumber(presc.comPrazo)} ${plural(presc.comPrazo, 'tem', 'têm')} prazo calculável `
                + `e ${formatNumber(presc.semPrazo)} ${plural(presc.semPrazo, 'não tem', 'não têm')}. `
                + `${formatNumber(prescritos)} ${plural(prescritos, 'já ultrapassou', 'já ultrapassaram')} o prazo `
                + `e ${formatNumber(criticos)} ${plural(criticos, 'está', 'estão')} em situação crítica — `
                + `${formatPercent((prescritos + criticos) / presc.comPrazo)} de tudo que tem prazo. `
                + `São estes os registros que demandam providência imediata.`);
            if (estilo !== 'formal') {
                L.push(...mdTable(
                    ['Situação', 'Registros', '% dos com prazo'],
                    PANORAMA_FAIXAS_PRESCRICAO
                        .filter((f) => (presc.contagem[f.key] || 0) > 0)
                        .map((f) => [
                            f.label,
                            formatNumber(presc.contagem[f.key] || 0),
                            f.key === 'sem_prazo' || presc.pct[f.key] === null
                                ? '—' : formatPercent(presc.pct[f.key]),
                        ])
                ), '');
            }
            if (estilo === 'analitico' && presc.urgentes.length) {
                L.push('### Registros mais próximos do prazo', '');
                L.push(...mdTable(
                    ['Identificador', 'Unidade', 'Assunto', 'Limite', 'Dias'],
                    presc.urgentes.slice(0, limite).map((u) => [
                        u.identificador || '—',
                        u.unidade || '—',
                        u.assunto || '—',
                        formatDateBR(u.limite),
                        formatNumber(u.dias),
                    ]),
                    ['l', 'l', 'l', 'c', 'r']
                ), '');
            }
        }
    }

    // -- 5. Gargalos ----------------------------------------------------------
    if (incluir.gargalos) {
        const gargalos = computeGargalos(registros, resolvida, analysis);
        if (gargalos.disponivel && gargalos.linhas.length) {
            h2('Gargalos e carga de trabalho');
            const top = gargalos.linhas.slice(0, 3)
                .map((g) => `${g.situacao} (${formatNumber(g.quantidade)} `
                    + `${plural(g.quantidade, 'registro', 'registros')}`
                    + `${g.idadeMedia === null ? '' : `, idade média de ${formatNumber(g.idadeMedia)} dias`})`)
                .join('; ');
            p(`Os pontos de maior acúmulo são: ${top}. `
                + `Volume alto combinado com idade média alta é o indicador mais direto de `
                + `necessidade de reforço de força de trabalho ou de atuação concentrada — `
                + `é onde uma força-tarefa tem o maior efeito por hora empregada.`);
            if (estilo !== 'formal') {
                const headers = ['Situação', 'Registros', '%'];
                const aligns = ['l', 'r', 'r'];
                if (gargalos.temIdade) {
                    headers.push('Idade média (dias)', 'Mediana', 'Mais antigo');
                    aligns.push('r', 'r', 'r');
                }
                L.push(...mdTable(headers, gargalos.linhas.slice(0, limite).map((g) => {
                    const row = [
                        g.situacao,
                        formatNumber(g.quantidade),
                        g.percentual === null ? '—' : formatPercent(g.percentual),
                    ];
                    if (gargalos.temIdade) {
                        row.push(
                            g.idadeMedia === null ? '—' : formatNumber(g.idadeMedia),
                            g.idadeMediana === null ? '—' : formatNumber(g.idadeMediana),
                            g.maisAntigo === null ? '—' : formatNumber(g.maisAntigo)
                        );
                    }
                    return row;
                }), aligns), '');
            }
        }
    }

    // -- 6. Concentração ------------------------------------------------------
    if (incluir.concentracao && estilo !== 'formal') {
        const alvos = dimensoes.filter((d) => !['__mes', '__ano', '__trimestre'].includes(d));
        const leituras = [];
        for (const dim of alvos.slice(0, 6)) {
            const conc = computeConcentracao(registros, dim, resolvida, analysis);
            if (!conc || conc.grupos < 2) continue;
            leituras.push({ dim, conc });
        }
        if (leituras.length) {
            h2('Concentração');
            p('Concentração alta significa que poucos pontos respondem por grande parte do '
                + 'volume — e que uma atuação dirigida a eles alcança a maior parte do problema. '
                + 'Concentração baixa pede resposta estrutural, não pontual.');
            for (const { dim, conc } of leituras) {
                p(`Em ${dimensionLabelPlural(dim, resolvida)}, a distribuição é **${conc.leitura}**: `
                    + `${formatNumber(conc.grupos)} `
                    + `${plural(conc.grupos, 'valor distinto', 'valores distintos')}, `
                    + `os 3 maiores respondem por ${formatPercent(conc.pctTop3)} do volume `
                    + `e bastam ${formatNumber(conc.paraMetade)} `
                    + `${plural(conc.paraMetade, 'valor', 'valores')} para alcançar metade dele.`);
            }
            L.push(...mdTable(
                ['Dimensão', 'Valores', 'Top 3', 'Top 10', 'Para metade', 'Leitura'],
                leituras.map(({ dim, conc }) => [
                    dimensionLabel(dim, resolvida),
                    formatNumber(conc.grupos),
                    formatPercent(conc.pctTop3),
                    formatPercent(conc.pctTop10),
                    formatNumber(conc.paraMetade),
                    conc.leitura,
                ]),
                ['l', 'r', 'r', 'r', 'r', 'l']
            ), '');
        }
    }

    // -- 7. Cruzamentos (exclusivo do analítico) ------------------------------
    if (incluir.cruzamentos && estilo === 'analitico' && dimensoes.length >= 2) {
        h2('Cruzamento entre dimensões');
        p('Cada tabela abaixo cruza duas dimensões da base. É onde aparece o que '
            + 'nenhuma leitura isolada mostra: se um problema é geral ou está preso a '
            + 'alguns pontos, e se um ponto concentra um tipo específico de caso.');

        const pares = [];
        for (let i = 0; i < dimensoes.length; i += 1) {
            for (let j = i + 1; j < dimensoes.length; j += 1) {
                pares.push([dimensoes[i], dimensoes[j]]);
            }
        }

        for (const [rowDim, colDim] of pares.slice(0, 18)) {
            const ct = crossTab(registros, rowDim, colDim, resolvida, analysis);
            if (!ct.rows.length || !ct.cols.length || ct.total === 0) continue;
            if (ct.rows.length === 1 && ct.cols.length === 1) continue;

            const cols = ct.cols.slice(0, 8);
            const outrasCols = ct.cols.length - cols.length;
            L.push(`### ${dimensionLabel(rowDim, resolvida)} × ${dimensionLabel(colDim, resolvida)}`, '');

            const headers = [dimensionLabel(rowDim, resolvida), ...cols];
            if (outrasCols > 0) headers.push(`Demais ${formatNumber(outrasCols)}`);
            headers.push('Total');

            const rows = ct.rows.slice(0, limite).map((linha) => {
                const celulas = cols.map((coluna) => formatNumber(ct.get(linha, coluna)));
                const totalLinha = ct.rowTotals.get(linha) || 0;
                if (outrasCols > 0) {
                    const contadas = cols.reduce((acc, coluna) => acc + ct.get(linha, coluna), 0);
                    celulas.push(formatNumber(totalLinha - contadas));
                }
                return [linha, ...celulas, formatNumber(totalLinha)];
            });
            L.push(...mdTable(headers, rows), '');

            // Leitura do cruzamento: onde está a maior célula e o que ela pesa.
            let maior = null;
            for (const linha of ct.rows) {
                for (const coluna of ct.cols) {
                    const v = ct.get(linha, coluna);
                    if (!maior || v > maior.v) maior = { linha, coluna, v };
                }
            }
            if (maior && maior.v > 0) {
                const totalDaLinha = ct.rowTotals.get(maior.linha) || 1;
                p(`O par mais frequente é ${dimSingular(rowDim, resolvida)} **${maior.linha}** `
                    + `com ${dimSingular(colDim, resolvida)} **${maior.coluna}**: `
                    + `${formatNumber(maior.v)} ${plural(maior.v, 'registro', 'registros')}, `
                    + `${formatPercent(maior.v / ct.total)} do cruzamento e `
                    + `${formatPercent(maior.v / totalDaLinha)} de tudo que ocorre em ${maior.linha}.`);
            }
        }
    }

    // -- Fecho ----------------------------------------------------------------
    if (estilo === 'analitico') {
        h2('Síntese');
        const sinteses = [];
        for (const dim of dimensoes.slice(0, 4)) {
            const conc = computeConcentracao(registros, dim, resolvida, analysis);
            if (!conc || conc.grupos < 2) continue;
            sinteses.push(`em ${dimensionLabelPlural(dim, resolvida)}, `
                + `${formatNumber(conc.paraMetade)} de ${formatNumber(conc.grupos)} `
                + `${plural(conc.grupos, 'valor concentra', 'valores concentram')} metade do volume`);
        }
        if (sinteses.length) {
            p(`O conjunto não se distribui de forma homogênea: ${sinteses.join('; ')}. `
                + `Onde a concentração é alta, a atuação dirigida a poucos pontos alcança grande `
                + `parte do problema; onde é baixa, a resposta precisa ser estrutural. `
                + `Esta é a leitura que orienta alocação de força de trabalho.`);
        }
        p('*As tabelas acima contêm o dado bruto de cada afirmação deste documento. '
            + 'Divergências entre o que se lê aqui e o que se sabe do campo geralmente '
            + 'apontam falha de preenchimento na origem, não erro de cálculo — e localizá-las '
            + 'é, por si, um resultado útil.*');
    }

    return L.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
