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
    JURIMETRIA_REALIZACAO_PADRAO,
    JURIMETRIA_DEFAULT_ANALYSIS,
    JURIMETRIA_EXPEDIENTE_PADRAO,
    JURIMETRIA_FAIXAS_DURACAO,
    realizacaoMeta,
    expedienteMeta,
    resolveExpediente,
    getJuriFieldValue,
} from '@/constants/jurimetria';

export const SEM_VALOR = '(não informado)';

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

/**
 * Realização da sessão. Registros gravados antes do campo existir não têm o
 * dado: são lidos como "realizado", que era o comportamento anterior — nenhum
 * júri já cadastrado muda de significado ao entrar esta versão.
 */
export function getRealizacao(juri) {
    const valor = String(juri?.realizacao || '').trim();
    return valor || JURIMETRIA_REALIZACAO_PADRAO;
}

/** A sessão aconteceu? (redesignada e cancelada não aconteceram) */
export function isRealizado(juri) {
    return getRealizacao(juri) === JURIMETRIA_REALIZACAO_PADRAO;
}

/** Rótulo da realização, pronto para exibição. */
export function realizacaoLabel(juri) {
    return realizacaoMeta(getRealizacao(juri)).label;
}

/**
 * Normaliza as opções de análise, aplicando os defaults. Todas as funções de
 * agregação aceitam este objeto como último argumento.
 */
export function resolveAnalysis(analysis) {
    return { ...JURIMETRIA_DEFAULT_ANALYSIS, ...(analysis || {}) };
}

/**
 * Aplica as OPÇÕES DE ANÁLISE ao conjunto: por padrão mantém apenas as sessões
 * realizadas. Não confundir com `filtrarJuris`, que aplica os filtros do
 * usuário — este passo é sobre COMO contar, não sobre O QUE entra no recorte.
 */
export function aplicarAnalise(juris, analysis) {
    const opts = resolveAnalysis(analysis);
    if (!opts.somenteRealizados) return juris || [];
    return (juris || []).filter(isRealizado);
}

/** Separa o conjunto por realização (para os totais do painel). */
export function splitRealizacao(juris) {
    const realizados = [];
    const redesignados = [];
    const cancelados = [];
    for (const juri of juris || []) {
        const r = getRealizacao(juri);
        if (r === 'redesignado') redesignados.push(juri);
        else if (r === 'cancelado') cancelados.push(juri);
        else realizados.push(juri);
    }
    return { realizados, redesignados, cancelados };
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
        case 'realizacao': return realizacaoLabel(juri);
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
        case 'faixa_duracao': return faixaDuracao(juri);
        case 'expediente': return situacaoExpedienteLabel(juri, settings?.expediente);
        case 'faixa_horario': return faixaHorario(juri);
        case 'hora_inicio': {
            const minutos = minutosDoHorario(juri.horario_inicio);
            return minutos === null ? SEM_VALOR : `${String(Math.floor(minutos / 60)).padStart(2, '0')}h`;
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
    // O início é o que diz QUANDO a sessão aconteceu. Júri antigo só tem o
    // horário de conclusão gravado, e aí é ele que responde.
    const base = String(juri?.horario_inicio || juri?.horario || '').trim();
    const m = /^(\d{1,2})/.exec(base);
    if (!m) return SEM_VALOR;
    const hora = Number(m[1]);
    if (!Number.isFinite(hora) || hora > 23) return SEM_VALOR;
    if (hora < 12) return 'Manhã (00h–11h59)';
    if (hora < 18) return 'Tarde (12h–17h59)';
    return 'Noite (18h–23h59)';
}


// ----------------------------------------------------------------------------
// Duração da sessão e expediente
// ----------------------------------------------------------------------------
//
// O horário de conclusão sempre existiu na base (o campo `horario`); o de
// início é novo. Toda função aqui devolve `null` quando falta um dos dois —
// nunca zero —, porque "durou 0 minuto" e "não sabemos quanto durou" são
// coisas diferentes e só a primeira pode entrar numa média.

/** Minutos desde a meia-noite a partir de "14h30", "14:30" ou "14". */
export function minutosDoHorario(valor) {
    const texto = String(valor ?? '').trim();
    if (!texto) return null;
    const m = /^(\d{1,2})\s*(?:[h:]\s*(\d{1,2}))?/.exec(texto);
    if (!m) return null;
    const hora = Number(m[1]);
    const minuto = m[2] === undefined ? 0 : Number(m[2]);
    if (!Number.isInteger(hora) || hora < 0 || hora > 23) return null;
    if (!Number.isInteger(minuto) || minuto < 0 || minuto > 59) return null;
    return hora * 60 + minuto;
}

/** "14h30" a partir de minutos desde a meia-noite. */
export function horarioDeMinutos(minutos) {
    if (!Number.isFinite(minutos)) return '';
    const total = ((Math.round(minutos) % 1440) + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}h${String(total % 60).padStart(2, '0')}`;
}

/**
 * Duração da sessão em minutos, ou `null` se não dá para saber.
 *
 * Uma sessão que termina "de madrugada" (conclusão anterior ao início) é lida
 * como tendo virado o dia — acontece em júri longo, e tratar como negativa
 * envenenaria a média de todo o recorte.
 */
export function duracaoEmMinutos(juri) {
    const inicio = minutosDoHorario(juri?.horario_inicio);
    const fim = minutosDoHorario(juri?.horario);
    if (inicio === null || fim === null) return null;
    const bruta = fim - inicio;
    return bruta >= 0 ? bruta : bruta + 1440;
}

/** "5h20" / "45min" / "—" — para tabelas e texto corrido. */
export function formatDuracao(minutos) {
    if (!Number.isFinite(minutos)) return '—';
    const total = Math.max(0, Math.round(minutos));
    const horas = Math.floor(total / 60);
    const resto = total % 60;
    if (horas === 0) return `${resto}min`;
    if (resto === 0) return `${horas}h`;
    return `${horas}h${String(resto).padStart(2, '0')}`;
}

/** Faixa de duração ("De 2h a 4h"), usada como dimensão de análise. */
export function faixaDuracao(juri) {
    const minutos = duracaoEmMinutos(juri);
    if (minutos === null) return SEM_VALOR;
    const faixa = JURIMETRIA_FAIXAS_DURACAO.find((f) => minutos <= f.max);
    return faixa ? faixa.label : SEM_VALOR;
}

// ---- Feriados --------------------------------------------------------------

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher) no ano informado. */
export function domingoDePascoa(ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(ano, mes - 1, dia));
}

const FERIADOS_NACIONAIS_FIXOS = [
    '01-01', // Confraternização Universal
    '04-21', // Tiradentes
    '05-01', // Dia do Trabalho
    '09-07', // Independência
    '10-12', // Nossa Senhora Aparecida
    '11-02', // Finados
    '11-15', // Proclamação da República
    '11-20', // Consciência Negra
    '12-25', // Natal
];

const cacheFeriados = new Map();

/**
 * Feriados nacionais de um ano, em ISO — os fixos mais os móveis derivados da
 * Páscoa (Carnaval, Sexta-feira Santa, Corpus Christi), que são justamente os
 * que uma lista digitada à mão esquece.
 */
export function feriadosNacionais(ano) {
    if (cacheFeriados.has(ano)) return cacheFeriados.get(ano);
    const iso = (date) => date.toISOString().slice(0, 10);
    const pascoa = domingoDePascoa(ano);
    const deslocar = (dias) => {
        const d = new Date(pascoa.getTime());
        d.setUTCDate(d.getUTCDate() + dias);
        return iso(d);
    };
    const datas = new Set([
        ...FERIADOS_NACIONAIS_FIXOS.map((md) => `${ano}-${md}`),
        deslocar(-48), // segunda de carnaval
        deslocar(-47), // terça de carnaval
        deslocar(-2),  // sexta-feira santa
        deslocar(60),  // corpus christi
    ]);
    const lista = [...datas].sort();
    cacheFeriados.set(ano, lista);
    return lista;
}

/** O júri caiu em dia de expediente do órgão? */
export function ehDiaDeExpediente(dataIso, expediente) {
    const iso = String(dataIso || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const cfg = resolveExpediente(expediente);

    const [ano, mes, dia] = iso.split('-').map(Number);
    // UTC de propósito: a data do júri é um dia civil, não um instante — usar
    // o fuso local faria o mesmo júri cair em dias diferentes conforme a
    // máquina de quem abre a tela.
    const diaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
    if (!cfg.dias.includes(diaSemana)) return false;
    if (cfg.feriados.includes(iso)) return false;
    if (cfg.feriadosNacionais && feriadosNacionais(ano).includes(iso)) return false;
    return true;
}

/**
 * Situação da sessão em relação ao expediente:
 * `dentro` | `prolongou` | `antecipou` | `sem_expediente` | `sem_horario`.
 *
 * A ordem importa: um júri em feriado é "dia sem expediente" mesmo que tenha
 * começado às 14h, porque a informação de gestão ali é o dia, não a hora.
 */
export function situacaoExpediente(juri, expediente) {
    const cfg = resolveExpediente(expediente);
    const util = ehDiaDeExpediente(juri?.data_juri, cfg);
    if (util === false) return 'sem_expediente';

    const inicio = minutosDoHorario(juri?.horario_inicio);
    const fim = minutosDoHorario(juri?.horario);
    if (inicio === null && fim === null) return 'sem_horario';
    if (util === null) return 'sem_horario';

    const abertura = minutosDoHorario(cfg.inicio);
    const encerramento = minutosDoHorario(cfg.fim);
    const fimReal = fimAbsoluto(inicio, fim);

    if (inicio !== null && abertura !== null && inicio < abertura) return 'antecipou';
    if (fimReal !== null && encerramento !== null && fimReal > encerramento) return 'prolongou';
    if (inicio === null || fim === null) return 'sem_horario';
    return 'dentro';
}

/**
 * Horário de conclusão em minutos desde a meia-noite do dia do júri.
 *
 * Uma sessão que termina "de madrugada" tem conclusão ANTERIOR ao início no
 * relógio; sem esta correção, um júri das 14h à 1h da manhã seria lido como
 * tendo terminado às 1h — isto é, dentro do expediente e sem um minuto de
 * excesso, que é exatamente o contrário do que aconteceu.
 */
function fimAbsoluto(inicio, fim) {
    if (fim === null) return null;
    if (inicio === null) return fim;
    return fim >= inicio ? fim : fim + 1440;
}

/**
 * Minutos que a sessão avançou além do fim do expediente (0 quando não
 * avançou, `null` quando não dá para saber).
 *
 * Fica separado da CLASSIFICAÇÃO de propósito: um júri que começou antes da
 * abertura e terminou depois do encerramento é rotulado "antecipou" — só cabe
 * um rótulo —, mas o tempo que ele avançou noite adentro continua existindo e
 * precisa entrar na conta.
 */
export function minutosAlemDoExpediente(juri, expediente) {
    const cfg = resolveExpediente(expediente);
    if (ehDiaDeExpediente(juri?.data_juri, cfg) !== true) return null;
    const inicio = minutosDoHorario(juri?.horario_inicio);
    const fim = fimAbsoluto(inicio, minutosDoHorario(juri?.horario));
    const encerramento = minutosDoHorario(cfg.fim);
    if (fim === null || encerramento === null) return null;
    return Math.max(0, fim - encerramento);
}

/** Rótulo da situação de expediente, pronto para tabela e exportação. */
export function situacaoExpedienteLabel(juri, expediente) {
    return expedienteMeta(situacaoExpediente(juri, expediente)).label;
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
        realizacoes = [],
        promotor = '',
        responsaveis = [],
        dataDe = '',
        dataAte = '',
        somenteEfetivos = false,
        expedientes = [],
        duracaoMin = '',
        duracaoMax = '',
    } = filtros;

    const buscaNorm = normalizeText(busca);
    const promotorNorm = normalizeText(promotor);
    const comarcaSet = new Set(comarcas);
    const tipoSet = new Set(tipos);
    const resultadoSet = new Set(resultados);
    const realizacaoSet = new Set(realizacoes);
    const responsavelSet = new Set(responsaveis);
    const expedienteSet = new Set(expedientes);
    // Os limites de duração chegam em MINUTOS (o campo da interface é em horas).
    const minMinutos = Number.isFinite(Number(duracaoMin)) && String(duracaoMin) !== ''
        ? Number(duracaoMin) : null;
    const maxMinutos = Number.isFinite(Number(duracaoMax)) && String(duracaoMax) !== ''
        ? Number(duracaoMax) : null;

    return (juris || []).filter((juri) => {
        if (somenteEfetivos && isDissolucao(juri, settings)) return false;

        if (comarcaSet.size > 0 && !comarcaSet.has(juri.comarca || '')) return false;
        if (tipoSet.size > 0 && !tipoSet.has(juri.tipo || '')) return false;
        if (resultadoSet.size > 0 && !resultadoSet.has(juri.resultado || '')) return false;
        if (realizacaoSet.size > 0 && !realizacaoSet.has(getRealizacao(juri))) return false;
        if (responsavelSet.size > 0 && !responsavelSet.has(juri.responsible_user_id || '')) return false;
        if (expedienteSet.size > 0
            && !expedienteSet.has(situacaoExpediente(juri, settings?.expediente))) return false;

        if (minMinutos !== null || maxMinutos !== null) {
            const duracao = duracaoEmMinutos(juri);
            // Filtrar por duração exclui quem não tem duração aferida: incluí-lo
            // seria afirmar algo sobre um tempo que não se conhece.
            if (duracao === null) return false;
            if (minMinutos !== null && duracao < minMinutos) return false;
            if (maxMinutos !== null && duracao > maxMinutos) return false;
        }

        if (promotorNorm && !normalizeText(juri.promotor).includes(promotorNorm)) return false;

        const data = String(juri.data_juri || '');
        if (dataDe && (!data || data < dataDe)) return false;
        if (dataAte && (!data || data > dataAte)) return false;

        if (buscaNorm) {
            const alvo = normalizeText([
                juri.numero_processo, juri.comarca, juri.tipo, juri.resultado,
                juri.promotor, juri.vara, juri.observacoes, juri.responsible_user_name,
                juri.horario_inicio, juri.horario,
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

/**
 * Totais do período. Devolve DOIS planos de leitura:
 *   - o plano da SESSÃO (realizados / redesignados / cancelados), sempre sobre
 *     o recorte inteiro, para o painel mostrar o que aconteceu com as pautas;
 *   - o plano do RESULTADO (efetivos / dissolvidos / aproveitamento), sobre o
 *     conjunto que as opções de análise mandaram considerar.
 */
export function computeTotais(juris, settings, analysis) {
    const base = juris || [];
    const { realizados, redesignados, cancelados } = splitRealizacao(base);
    const considerados = aplicarAnalise(base, analysis);

    const total = considerados.length;
    const { efetivos, dissolvidos } = splitEfetivos(considerados, settings);
    const aproveitamento = calcAproveitamento(considerados, settings);

    return {
        // Plano do resultado (base das demais seções).
        total,
        efetivos: efetivos.length,
        dissolvidos: dissolvidos.length,
        pctEfetivos: total ? efetivos.length / total : null,
        pctDissolvidos: total ? dissolvidos.length / total : null,
        aproveitamento: aproveitamento.ratio,
        pontos: aproveitamento.pontos,
        // Plano da sessão (recorte inteiro, independente das opções).
        totalBruto: base.length,
        realizados: realizados.length,
        redesignados: redesignados.length,
        cancelados: cancelados.length,
        pctRealizados: base.length ? realizados.length / base.length : null,
        pctRedesignados: base.length ? redesignados.length / base.length : null,
        pctCancelados: base.length ? cancelados.length / base.length : null,
    };
}

/**
 * Distribuição por espécie de resultado. Os dissolvidos são reportados à
 * parte (`dissolucoes`) e NÃO entram no denominador dos percentuais.
 */
export function computeEspecies(juris, settings, analysis) {
    const considerados = aplicarAnalise(juris, analysis);
    const opts = resolveAnalysis(analysis);
    const { efetivos, dissolvidos } = splitEfetivos(considerados, settings);
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
        .filter(([especie]) => !(opts.excluirNaoInformados && especie === SEM_VALOR))
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
        totalGeral: considerados.length,
    };
}

/** Distribuição por matéria/tipo de júri, com sub-contagem por espécie. */
export function computeMaterias(juris, settings, analysis) {
    const opts = resolveAnalysis(analysis);
    const { efetivos } = splitEfetivos(aplicarAnalise(juris, analysis), settings);
    const grupos = new Map();

    for (const juri of efetivos) {
        const chave = juri.tipo || SEM_VALOR;
        if (opts.excluirNaoInformados && chave === SEM_VALOR) continue;
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
export function computeRanking(juris, dimension, settings, analysis) {
    const opts = resolveAnalysis(analysis);
    const grupos = new Map();
    for (const juri of aplicarAnalise(juris, analysis)) {
        const chave = dimensionValue(juri, dimension, settings);
        if (opts.excluirNaoInformados && chave === SEM_VALOR) continue;
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
export function computeSerieMensal(juris, settings, analysis) {
    const grupos = new Map();
    for (const juri of aplicarAnalise(juris, analysis)) {
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
export function computeHorarios(juris, analysis) {
    const opts = resolveAnalysis(analysis);
    const considerados = aplicarAnalise(juris, analysis);
    const grupos = new Map();
    for (const juri of considerados) {
        const faixa = faixaHorario(juri);
        if (opts.excluirNaoInformados && faixa === SEM_VALOR) continue;
        grupos.set(faixa, (grupos.get(faixa) || 0) + 1);
    }
    const total = considerados.length;
    const ordem = ['Manhã (00h–11h59)', 'Tarde (12h–17h59)', 'Noite (18h–23h59)', SEM_VALOR];
    return [...grupos.entries()]
        .map(([faixa, quantidade]) => ({
            faixa,
            quantidade,
            percentual: total ? quantidade / total : null,
        }))
        .sort((a, b) => ordem.indexOf(a.faixa) - ordem.indexOf(b.faixa));
}

/**
 * Panorama de duração das sessões, agrupado pela dimensão escolhida.
 *
 * A média só considera os júris com os dois horários preenchidos; os demais
 * aparecem como `semDuracao`, para que o leitor saiba sobre quantos júris a
 * média foi calculada — uma média de 3 sessões num recorte de 200 não é a
 * mesma informação que uma média de 190.
 *
 * @param {Array} juris Lista já filtrada.
 * @param {string} dimension Dimensão de agrupamento ('comarca', 'mes', 'ano'…).
 * @param {object} settings
 * @param {object} analysis Opções de análise (somente realizados etc.).
 */
export function computeDuracoes(juris, dimension, settings, analysis) {
    const opts = resolveAnalysis(analysis);
    const considerados = aplicarAnalise(juris, analysis);

    const grupos = new Map();
    let comDuracao = 0;
    let semDuracao = 0;
    let somaGeral = 0;
    const todasDuracoes = [];
    let maiorGeral = null;
    let menorGeral = null;

    let considerado = 0;
    for (const juri of considerados) {
        const chave = dimensionValue(juri, dimension, settings);
        if (opts.excluirNaoInformados && chave === SEM_VALOR) continue;
        // Conta DEPOIS do descarte: senão "aferida em 12 de 40" incluiria no 40
        // júris que a opção de análise acabou de tirar da conta.
        considerado += 1;

        if (!grupos.has(chave)) {
            grupos.set(chave, {
                chave, total: 0, comDuracao: 0, minutos: 0,
                duracoes: [], maior: null, menor: null,
                sortKey: dimension === 'mes' ? mesSortKey(juri) : null,
            });
        }
        const grupo = grupos.get(chave);
        grupo.total += 1;

        const minutos = duracaoEmMinutos(juri);
        if (minutos === null) {
            semDuracao += 1;
            continue;
        }

        comDuracao += 1;
        somaGeral += minutos;
        todasDuracoes.push(minutos);
        grupo.comDuracao += 1;
        grupo.minutos += minutos;
        grupo.duracoes.push(minutos);

        const registro = {
            minutos,
            id: juri.id,
            numero_processo: juri.numero_processo || '',
            data_juri: juri.data_juri || '',
            comarca: juri.comarca || '',
            promotor: juri.promotor || '',
            resultado: juri.resultado || '',
            horario_inicio: juri.horario_inicio || '',
            horario: juri.horario || '',
        };
        if (!grupo.maior || minutos > grupo.maior.minutos) grupo.maior = registro;
        if (!grupo.menor || minutos < grupo.menor.minutos) grupo.menor = registro;
        if (!maiorGeral || minutos > maiorGeral.minutos) maiorGeral = registro;
        if (!menorGeral || minutos < menorGeral.minutos) menorGeral = registro;
    }

    const linhas = [...grupos.values()]
        .map((g) => ({
            chave: g.chave,
            total: g.total,
            comDuracao: g.comDuracao,
            semDuracao: g.total - g.comDuracao,
            minutos: g.minutos,
            media: g.comDuracao ? g.minutos / g.comDuracao : null,
            mediana: mediana(g.duracoes),
            maior: g.maior,
            menor: g.menor,
            sortKey: g.sortKey,
        }))
        .sort(ordenarPorDimensao(dimension));

    return {
        dimension,
        linhas,
        total: considerado,
        comDuracao,
        semDuracao,
        minutos: somaGeral,
        media: comDuracao ? somaGeral / comDuracao : null,
        mediana: mediana(todasDuracoes),
        maior: maiorGeral,
        menor: menorGeral,
    };
}

/** Mediana de uma lista de números (`null` quando vazia). */
function mediana(valores) {
    if (!valores || valores.length === 0) return null;
    const ordenados = [...valores].sort((a, b) => a - b);
    const meio = Math.floor(ordenados.length / 2);
    return ordenados.length % 2
        ? ordenados[meio]
        : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

/**
 * Comparador das linhas de um agrupamento: mês e ano em ordem cronológica,
 * o resto por volume e depois por nome — ler um ranking em ordem alfabética
 * de comarca esconde exatamente o que o ranking existe para mostrar.
 */
function ordenarPorDimensao(dimension) {
    if (dimension === 'mes') {
        return (a, b) => String(a.sortKey || '').localeCompare(String(b.sortKey || ''));
    }
    if (dimension === 'ano') {
        return (a, b) => String(a.chave).localeCompare(String(b.chave));
    }
    return (a, b) => (b.total - a.total) || String(a.chave).localeCompare(String(b.chave), 'pt-BR');
}

/**
 * Panorama do expediente: quantas sessões couberam na janela de expediente do
 * órgão, quantas a extrapolaram, quantas começaram antes e quantas ocorreram
 * em dia sem expediente (fim de semana, feriado nacional ou data que o órgão
 * marcou como sem expediente).
 *
 * É informação de gestão — escala, sobreaviso, carga do plenário —, por isso
 * o recorte por dimensão acompanha o mesmo eixo dos demais relatórios.
 */
export function computeExpediente(juris, dimension, settings, analysis) {
    const opts = resolveAnalysis(analysis);
    const considerados = aplicarAnalise(juris, analysis);
    const expediente = resolveExpediente(settings?.expediente);

    const contagem = {
        dentro: 0, prolongou: 0, antecipou: 0, sem_expediente: 0, sem_horario: 0,
    };
    const grupos = new Map();
    // Quanto tempo, no total, as sessões avançaram além do fim do expediente.
    let minutosExcedentes = 0;
    let comExcedente = 0;
    let maiorExcedente = null;

    for (const juri of considerados) {
        const situacao = situacaoExpediente(juri, expediente);
        contagem[situacao] = (contagem[situacao] || 0) + 1;

        // O excesso é contado para QUALQUER sessão que passou do encerramento,
        // inclusive a que também começou cedo e por isso foi rotulada
        // "antecipou" — o rótulo é um só, o tempo excedido não deixa de existir.
        const excedente = minutosAlemDoExpediente(juri, expediente);
        if (excedente !== null && excedente > 0) {
            minutosExcedentes += excedente;
            comExcedente += 1;
            if (!maiorExcedente || excedente > maiorExcedente.minutos) {
                maiorExcedente = {
                    minutos: excedente,
                    id: juri.id,
                    numero_processo: juri.numero_processo || '',
                    data_juri: juri.data_juri || '',
                    comarca: juri.comarca || '',
                    horario: juri.horario || '',
                };
            }
        }

        if (!dimension) continue;
        const chave = dimensionValue(juri, dimension, settings);
        if (opts.excluirNaoInformados && chave === SEM_VALOR) continue;
        if (!grupos.has(chave)) {
            grupos.set(chave, {
                chave, total: 0, dentro: 0, prolongou: 0, antecipou: 0,
                sem_expediente: 0, sem_horario: 0,
                sortKey: dimension === 'mes' ? mesSortKey(juri) : null,
            });
        }
        const grupo = grupos.get(chave);
        grupo.total += 1;
        grupo[situacao] += 1;
    }

    const total = considerados.length;
    // Denominador dos percentuais: só as sessões classificáveis. Incluir as
    // "sem horário" faria o percentual de "dentro do expediente" cair quando o
    // problema é de preenchimento, não de pauta.
    const classificados = total - contagem.sem_horario;

    const linhas = [...grupos.values()]
        .map((g) => ({
            ...g,
            classificados: g.total - g.sem_horario,
            pctDentro: (g.total - g.sem_horario) ? g.dentro / (g.total - g.sem_horario) : null,
            pctProlongou: (g.total - g.sem_horario) ? g.prolongou / (g.total - g.sem_horario) : null,
        }))
        .sort(ordenarPorDimensao(dimension));

    return {
        dimension,
        expediente,
        total,
        classificados,
        ...contagem,
        pctDentro: classificados ? contagem.dentro / classificados : null,
        pctProlongou: classificados ? contagem.prolongou / classificados : null,
        pctAntecipou: classificados ? contagem.antecipou / classificados : null,
        pctSemExpediente: classificados ? contagem.sem_expediente / classificados : null,
        minutosExcedentes,
        comExcedente,
        mediaExcedente: comExcedente ? minutosExcedentes / comExcedente : null,
        maiorExcedente,
        linhas,
    };
}

// ----------------------------------------------------------------------------
// Tabela dinâmica (pivot multi-nível)
// ----------------------------------------------------------------------------

const PATH_SEP = '\u0000';

/** Agrega as estatísticas de um conjunto de júris numa célula da pivot. */
function statsOf(juris, settings) {
    const { efetivos, dissolvidos } = splitEfetivos(juris, settings);
    let pontos = 0;
    for (const juri of efetivos) pontos += pesoDoResultado(juri.resultado, settings);

    // Duração entra pela soma e pela contagem de quem TEM duração conhecida:
    // é o que permite somar subtotais sem revisitar os júris e sem deixar um
    // júri sem horário puxar a média para baixo.
    let minutos = 0;
    let comDuracao = 0;
    for (const juri of juris) {
        const d = duracaoEmMinutos(juri);
        if (d === null) continue;
        minutos += d;
        comDuracao += 1;
    }

    return {
        quantidade: juris.length,
        efetivos: efetivos.length,
        dissolucoes: dissolvidos.length,
        pontos,
        aproveitamento: efetivos.length ? pontos / efetivos.length : null,
        minutos,
        comDuracao,
        duracaoMedia: comDuracao ? minutos / comDuracao : null,
    };
}

/** Soma duas estatísticas (usada nos subtotais). */
function addStats(a, b) {
    const quantidade = a.quantidade + b.quantidade;
    const efetivos = a.efetivos + b.efetivos;
    const pontos = a.pontos + b.pontos;
    const minutos = a.minutos + b.minutos;
    const comDuracao = a.comDuracao + b.comDuracao;
    return {
        quantidade,
        efetivos,
        dissolucoes: a.dissolucoes + b.dissolucoes,
        pontos,
        aproveitamento: efetivos ? pontos / efetivos : null,
        minutos,
        comDuracao,
        duracaoMedia: comDuracao ? minutos / comDuracao : null,
    };
}

const EMPTY_STATS = {
    quantidade: 0, efetivos: 0, dissolucoes: 0, pontos: 0, aproveitamento: null,
    minutos: 0, comDuracao: 0, duracaoMedia: null,
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
export function buildPivot(juris, config, settings, analysis) {
    const opts = resolveAnalysis(analysis);
    const rowDims = (config?.rowDims || []).filter(Boolean).slice(0, 3);
    const colDims = (config?.colDims || []).filter(Boolean).slice(0, 3);
    const values = (config?.values || ['quantidade']).filter(Boolean).slice(0, 2);
    const showAs = config?.showAs || 'valor';
    const subtotais = config?.subtotais || 'auto';

    // 1. Agrupa os júris por (caminho de linha, caminho de coluna).
    const buckets = new Map();
    const rowPaths = new Set();
    const colPaths = new Set();

    for (const juri of aplicarAnalise(juris, analysis)) {
        const rowPath = rowDims.map((d) => dimensionValue(juri, d, settings));
        const colPath = colDims.map((d) => dimensionValue(juri, d, settings));
        // Com a opção ligada, um júri sem valor em QUALQUER dimensão do
        // cruzamento sai da tabela: mantê-lo criaria uma linha ou coluna
        // "(não informado)" exatamente onde ela foi dispensada.
        if (opts.excluirNaoInformados
            && [...rowPath, ...colPath].some((v) => v === SEM_VALOR)) continue;
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
    // Duração média também é uma razão (minutos por sessão), não um total —
    // somar percentuais dela numa linha não significaria nada.
    if (measure === 'duracao_media') return formatDuracao(stats.duracaoMedia);

    const raw = measure === 'duracao_total'
        ? stats.minutos
        : measure === 'pontos'
            ? stats.pontos
            : measure === 'dissolucoes'
                ? stats.dissolucoes
                : stats.quantidade;

    if (measure === 'duracao_total' && (showAs === 'valor' || !divisor)) {
        return formatDuracao(raw);
    }

    if (showAs === 'valor' || !divisor) {
        return measure === 'pontos' ? formatNumber(raw, 2) : formatNumber(raw);
    }

    const base = measure === 'duracao_total'
        ? divisor.minutos
        : measure === 'pontos'
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
        case 'duracao_media': return 'Duração média';
        case 'duracao_total': return 'Duração total';
        default: return 'Qtde';
    }
}

// ----------------------------------------------------------------------------
// Relatório descritivo
// ----------------------------------------------------------------------------
//
// Três estilos, três leitores diferentes — e é isso que os separa, não só o
// tamanho do texto:
//
//   formal     quem vai citar o relatório num expediente. Prosa em registro
//              formal, frases completas, nada de bullet solto; as tabelas
//              existem só onde substituem um parágrafo que ninguém leria.
//   executivo  quem tem trinta segundos. Abre com a síntese e, no lugar de
//              prosa, entrega TABELAS por todos os ângulos, partindo das
//              comarcas, que é a unidade de gestão do CAOJúri.
//   analitico  quem vai investigar. Cruza as dimensões entre si
//              (comarca x espécie, matéria x espécie, promotor x matéria...)
//              e comenta o que os cruzamentos mostram: concentração,
//              dispersão e os pontos fora da curva.

/** Escapa o pipe, único caractere que quebra uma célula de tabela Markdown. */
function mdCell(valor) {
    return String(valor ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}

/**
 * Tabela em Markdown. `aligns` aceita 'l' | 'r' | 'c' por coluna — números à
 * direita, texto à esquerda, para a tabela poder ser lida em diagonal.
 */
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
 * Cruzamento de duas dimensões: quantas sessões existem em cada par.
 *
 * É o que sustenta o estilo analítico. Devolve as linhas e colunas já
 * ordenadas por volume (o que interessa vem primeiro) e a matriz de contagens,
 * mais os totais de cada margem.
 */
export function crossTab(juris, rowDim, colDim, settings, analysis) {
    const opts = resolveAnalysis(analysis);
    const considerados = aplicarAnalise(juris, analysis);

    const matriz = new Map();
    const totaisLinha = new Map();
    const totaisColuna = new Map();
    let total = 0;

    for (const juri of considerados) {
        const linha = dimensionValue(juri, rowDim, settings);
        const coluna = dimensionValue(juri, colDim, settings);
        if (opts.excluirNaoInformados && (linha === SEM_VALOR || coluna === SEM_VALOR)) continue;

        const chave = `${linha}${PATH_SEP}${coluna}`;
        matriz.set(chave, (matriz.get(chave) || 0) + 1);
        totaisLinha.set(linha, (totaisLinha.get(linha) || 0) + 1);
        totaisColuna.set(coluna, (totaisColuna.get(coluna) || 0) + 1);
        total += 1;
    }

    const porVolume = (a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0]), 'pt-BR');
    const ordenarChaves = (mapa, dim) => {
        const entradas = [...mapa.entries()];
        if (dim === 'mes' || dim === 'ano') {
            return entradas.map(([k]) => k).sort((a, b) => String(a).localeCompare(String(b)));
        }
        return entradas.sort(porVolume).map(([k]) => k);
    };

    return {
        rowDim,
        colDim,
        total,
        rows: ordenarChaves(totaisLinha, rowDim),
        cols: ordenarChaves(totaisColuna, colDim),
        rowTotals: totaisLinha,
        colTotals: totaisColuna,
        get: (linha, coluna) => matriz.get(`${linha}${PATH_SEP}${coluna}`) || 0,
    };
}

/**
 * Rótulo de uma dimensão em português corrente, no singular e no plural.
 * O plural é escrito, não derivado: "mês" não vira "mêss" e "espécie de
 * resultado" pluraliza no primeiro termo, não no último.
 */
const DIM_LABELS = {
    comarca: ['comarca', 'comarcas'],
    promotor: ['promotor(a)', 'promotores(as)'],
    tipo: ['matéria', 'matérias'],
    resultado: ['espécie de resultado', 'espécies de resultado'],
    realizacao: ['realização', 'realizações'],
    mes: ['mês', 'meses'],
    ano: ['ano', 'anos'],
    vara: ['vara', 'varas'],
    responsavel: ['responsável', 'responsáveis'],
    expediente: ['situação de expediente', 'situações de expediente'],
    faixa_duracao: ['faixa de duração', 'faixas de duração'],
    faixa_horario: ['turno', 'turnos'],
    hora_inicio: ['hora de início', 'horas de início'],
};

function dimLabelOf(dimension) {
    return DIM_LABELS[dimension]?.[0] || dimension;
}

function dimLabelPlural(dimension) {
    return DIM_LABELS[dimension]?.[1] || `${dimension}s`;
}

/** Nome próprio de cada estilo, impresso no cabeçalho do documento. */
const ESTILO_NOTA = {
    formal: 'Redação formal e objetiva: texto corrido, em registro próprio para '
        + 'instrução de expediente, com tabelas apenas onde substituem o parágrafo.',
    executivo: 'Formato executivo: síntese numérica seguida das tabelas que dão base '
        + 'a ela, por todos os ângulos, partindo das comarcas.',
    analitico: 'Formato analítico: cruzamento das dimensões entre si, com a leitura '
        + 'do que os cruzamentos revelam sobre concentração, dispersão e casos extremos.',
};

/**
 * Monta a tabela de um cruzamento, com margem de totais, limitando linhas e
 * colunas ao que cabe numa página — o resto vira uma linha "demais".
 */
function tabelaCruzamento(cruz, { maxLinhas = 18, maxColunas = 8, rowLabel, colLabel }) {
    if (cruz.total === 0) return [];

    const colunas = cruz.cols.slice(0, maxColunas);
    const colunasRestantes = cruz.cols.slice(maxColunas);
    const headers = [rowLabel, ...colunas.map(abreviarRotulo), ...(colunasRestantes.length ? ['Outras'] : []), 'Total'];
    const aligns = headers.map((_, i) => (i === 0 ? 'l' : 'r'));

    const linhas = cruz.rows.slice(0, maxLinhas).map((linha) => {
        const celulas = colunas.map((coluna) => formatNumber(cruz.get(linha, coluna)));
        if (colunasRestantes.length) {
            const resto = colunasRestantes.reduce((acc, c) => acc + cruz.get(linha, c), 0);
            celulas.push(formatNumber(resto));
        }
        return [linha, ...celulas, formatNumber(cruz.rowTotals.get(linha) || 0)];
    });

    const sobra = cruz.rows.slice(maxLinhas);
    if (sobra.length > 0) {
        const celulas = colunas.map((coluna) => formatNumber(
            sobra.reduce((acc, l) => acc + cruz.get(l, coluna), 0)
        ));
        if (colunasRestantes.length) {
            celulas.push(formatNumber(sobra.reduce(
                (acc, l) => acc + colunasRestantes.reduce((a, c) => a + cruz.get(l, c), 0), 0
            )));
        }
        linhas.push([
            `Demais ${sobra.length} ${colLabel ? '' : ''}`.trim(),
            ...celulas,
            formatNumber(sobra.reduce((acc, l) => acc + (cruz.rowTotals.get(l) || 0), 0)),
        ]);
    }

    const rodape = colunas.map((coluna) => formatNumber(cruz.colTotals.get(coluna) || 0));
    if (colunasRestantes.length) {
        rodape.push(formatNumber(colunasRestantes.reduce((acc, c) => acc + (cruz.colTotals.get(c) || 0), 0)));
    }
    linhas.push(['**Total**', ...rodape, `**${formatNumber(cruz.total)}**`]);

    return mdTable(headers, linhas, aligns);
}

/** Encurta um rótulo longo de cabeçalho sem perder a identificação. */
function abreviarRotulo(valor) {
    const texto = String(valor ?? '');
    if (texto.length <= 18) return texto;
    // "PARCIAL PROCEDÊNCIA (QUALIFICADORA)" -> "PARCIAL PROC. (QUAL...)"
    return `${texto.slice(0, 16)}…`;
}

/**
 * Gera o relatório descritivo em texto estruturado (Markdown).
 *
 * @param {Array} juris Lista já filtrada.
 * @param {object} config
 *   { agrupador: string, secoes: string[], estilo: 'formal'|'executivo'|'analitico',
 *     titulo?: string, periodo?: {de, ate} }
 * @param {object} settings
 * @param {object} analysis Opções de análise.
 * @returns {string} Markdown pronto para exibir, copiar ou exportar.
 */
export function buildDescritivo(juris, config, settings, analysis) {
    const opts = resolveAnalysis(analysis);
    const {
        agrupador = 'comarca',
        secoes = ['quantitativo', 'especies', 'materias', 'aproveitamento'],
        estilo = 'formal',
        titulo = 'Relatório descritivo de jurimetria',
        periodo = {},
    } = config || {};

    const ativo = new Set(secoes);
    const topN = estilo === 'executivo' ? 8 : estilo === 'analitico' ? 100 : 15;
    const L = [];

    // ---- Cabeçalho comum ---------------------------------------------------
    L.push(`# ${titulo}`);
    L.push('');
    const periodoTexto = periodo.de || periodo.ate
        ? `Período: ${periodo.de ? formatDateBR(periodo.de) : 'início da base'} a ${periodo.ate ? formatDateBR(periodo.ate) : 'hoje'}.`
        : 'Período: base completa.';
    L.push(`${periodoTexto} Documento gerado em ${new Date().toLocaleString('pt-BR')}.`);
    L.push('');
    const notas = [opts.somenteRealizados
        ? 'consideradas apenas as sessões **realizadas** (redesignadas e canceladas ficam de fora)'
        : 'consideradas **todas** as sessões, inclusive redesignadas e canceladas'];
    if (opts.excluirNaoInformados) notas.push('grupos sem valor informado foram excluídos');
    L.push(`Critério de contagem: ${notas.join('; ')}.`);
    L.push('');
    L.push(`> ${ESTILO_NOTA[estilo] || ESTILO_NOTA.formal}`);
    L.push('');

    const totais = computeTotais(juris, settings, analysis);
    const especies = computeEspecies(juris, settings, analysis);
    const materias = computeMaterias(juris, settings, analysis);
    const ranking = computeRanking(juris, agrupador, settings, analysis);
    const comarcas = computeRanking(juris, 'comarca', settings, analysis);

    if (totais.total === 0) {
        L.push('Não há júris no recorte selecionado.');
        return L.join('\n');
    }

    // =======================================================================
    // ESTILO EXECUTIVO — síntese e tabelas, partindo das comarcas
    // =======================================================================
    if (estilo === 'executivo') {
        L.push('## Síntese');
        L.push('');
        L.push(...mdTable(
            ['Indicador', 'Valor'],
            [
                ['Júris no recorte', formatNumber(totais.total)],
                ['Julgados (efetivos)', `${formatNumber(totais.efetivos)} (${formatPercent(totais.pctEfetivos)})`],
                ['Conselhos dissolvidos', `${formatNumber(totais.dissolvidos)} (${formatPercent(totais.pctDissolvidos)})`],
                ['Aproveitamento ponderado', formatPercent(totais.aproveitamento)],
                ['Comarcas alcançadas', formatNumber(comarcas.linhas.length)],
                ['Matérias envolvidas', formatNumber(materias.linhas.length)],
            ],
            ['l', 'r']
        ));
        L.push('');

        if (totais.redesignados > 0 || totais.cancelados > 0) {
            L.push(...mdTable(
                ['Desfecho da sessão', 'Júris', '% do recorte'],
                [
                    ['Realizadas', formatNumber(totais.realizados), formatPercent(totais.pctRealizados)],
                    ['Redesignadas', formatNumber(totais.redesignados), formatPercent(totais.pctRedesignados)],
                    ['Canceladas', formatNumber(totais.cancelados), formatPercent(totais.pctCancelados)],
                ],
                ['l', 'r', 'r']
            ));
            L.push('');
        }

        // As comarcas são a unidade de gestão: tudo parte delas.
        L.push('## Comarcas');
        L.push('');
        L.push(`O recorte alcança ${formatNumber(comarcas.linhas.length)} `
            + `${plural(comarcas.linhas.length, 'comarca', 'comarcas')}.`);
        L.push('');
        L.push(...mdTable(
            ['Comarca', 'Júris', 'Efetivos', 'Dissoluções', 'Aproveitamento'],
            [
                ...comarcas.linhas.slice(0, 20).map((l) => [
                    l.chave, formatNumber(l.total), formatNumber(l.efetivos),
                    formatNumber(l.dissolucoes), formatPercent(l.aproveitamento),
                ]),
                ['**Total**', `**${formatNumber(totais.total)}**`, `**${formatNumber(totais.efetivos)}**`,
                    `**${formatNumber(totais.dissolvidos)}**`, `**${formatPercent(totais.aproveitamento)}**`],
            ],
            ['l', 'r', 'r', 'r', 'r']
        ));
        L.push('');

        const cruzamentosExec = [
            ['comarca', 'resultado', 'Comarca', 'Comarcas por espécie de resultado'],
            ['comarca', 'tipo', 'Comarca', 'Comarcas por matéria'],
            ['comarca', 'mes', 'Comarca', 'Comarcas por mês'],
        ];
        for (const [rowDim, colDim, rowLabel, cabecalho] of cruzamentosExec) {
            const cruz = crossTab(juris, rowDim, colDim, settings, analysis);
            if (cruz.total === 0 || cruz.cols.length < 2) continue;
            L.push(`### ${cabecalho}`);
            L.push('');
            L.push(...tabelaCruzamento(cruz, { rowLabel, maxLinhas: 15, maxColunas: 8 }));
            L.push('');
        }

        if (ativo.has('especies') && especies.linhas.length > 0) {
            L.push('## Espécies de resultado');
            L.push('');
            L.push(...mdTable(
                ['Espécie', 'Júris', '% dos efetivos', 'Peso'],
                especies.linhas.filter((l) => l.quantidade > 0).map((l) => [
                    l.especie, formatNumber(l.quantidade), formatPercent(l.percentual), String(l.peso),
                ]),
                ['l', 'r', 'r', 'r']
            ));
            L.push('');
        }

        if (ativo.has('materias') && materias.linhas.length > 0) {
            L.push('## Matérias');
            L.push('');
            L.push(...mdTable(
                ['Matéria', 'Júris', '% dos efetivos', 'Aproveitamento'],
                materias.linhas.map((l) => [
                    l.label, formatNumber(l.total), formatPercent(l.percentual),
                    formatPercent(l.aproveitamento),
                ]),
                ['l', 'r', 'r', 'r']
            ));
            L.push('');
        }

        if (ativo.has('promotores')) {
            const promotores = computeRanking(juris, 'promotor', settings, analysis);
            if (promotores.linhas.length > 0) {
                L.push('## Promotores(as)');
                L.push('');
                L.push(...mdTable(
                    ['Promotor(a)', 'Júris', 'Efetivos', 'Aproveitamento'],
                    promotores.linhas.slice(0, 20).map((l) => [
                        l.chave, formatNumber(l.total), formatNumber(l.efetivos),
                        formatPercent(l.aproveitamento),
                    ]),
                    ['l', 'r', 'r', 'r']
                ));
                L.push('');
            }
        }

        if (ativo.has('meses')) {
            const serie = computeSerieMensal(juris, settings, analysis);
            if (serie.length > 0) {
                L.push('## Evolução mensal');
                L.push('');
                L.push(...mdTable(
                    ['Mês', 'Júris', 'Efetivos', 'Dissoluções', 'Aproveitamento'],
                    serie.map((m) => [
                        m.labelCompleto, formatNumber(m.total), formatNumber(m.efetivos),
                        formatNumber(m.dissolucoes), formatPercent(m.aproveitamento),
                    ]),
                    ['l', 'r', 'r', 'r', 'r']
                ));
                L.push('');
            }
        }

        L.push(...secaoDuracao(juris, settings, analysis, ativo, estilo));
        L.push(...secaoExpediente(juris, settings, analysis, ativo, estilo));
        L.push(...secaoDissolucoes(juris, settings, analysis, ativo, estilo));
        return L.join('\n').replace(/\n{3,}/g, '\n\n');
    }

    // =======================================================================
    // ESTILO ANALÍTICO — cruzamentos e leitura do que eles mostram
    // =======================================================================
    if (estilo === 'analitico') {
        L.push('## 1. Quantitativo e composição');
        L.push('');
        L.push(
            `O recorte reúne ${formatNumber(totais.total)} ${plural(totais.total, 'júri', 'júris')}, `
            + `${plural(totais.efetivos, 'do qual', 'dos quais')} ${formatNumber(totais.efetivos)} `
            + `${plural(totais.efetivos, 'corresponde', 'correspondem')} a julgamento de mérito `
            + `(${formatPercent(totais.pctEfetivos)}) e ${formatNumber(totais.dissolvidos)} `
            + `${plural(totais.dissolvidos, 'terminou', 'terminaram')} em dissolução do conselho `
            + `(${formatPercent(totais.pctDissolvidos)}). O aproveitamento ponderado do conjunto é de `
            + `${formatPercent(totais.aproveitamento)}, correspondente a `
            + `${formatNumber(totais.pontos, 2)} pontos sobre os júris efetivos.`
        );
        L.push('');
        L.push(...analiseConcentracao(comarcas.linhas, 'comarca', totais.total));
        L.push('');

        L.push('## 2. Cruzamentos');
        L.push('');
        L.push('Cada tabela abaixo cruza duas dimensões do recorte. A leitura útil está '
            + 'menos no total de cada linha — que os relatórios estáticos já dão — e mais '
            + 'na distribuição dentro dela: duas comarcas com o mesmo volume podem ter '
            + 'composições de resultado inteiramente diferentes.');
        L.push('');

        const cruzamentos = [
            ['comarca', 'resultado', 'Comarca', '2.1. Comarca × espécie de resultado'],
            ['comarca', 'tipo', 'Comarca', '2.2. Comarca × matéria'],
            ['tipo', 'resultado', 'Matéria', '2.3. Matéria × espécie de resultado'],
            ['promotor', 'resultado', 'Promotor(a)', '2.4. Promotor(a) × espécie de resultado'],
            ['promotor', 'tipo', 'Promotor(a)', '2.5. Promotor(a) × matéria'],
            ['comarca', 'mes', 'Comarca', '2.6. Comarca × mês'],
            ['tipo', 'mes', 'Matéria', '2.7. Matéria × mês'],
            ['resultado', 'mes', 'Espécie', '2.8. Espécie de resultado × mês'],
            ['comarca', 'expediente', 'Comarca', '2.9. Comarca × situação de expediente'],
            ['comarca', 'faixa_duracao', 'Comarca', '2.10. Comarca × faixa de duração'],
        ];
        for (const [rowDim, colDim, rowLabel, cabecalho] of cruzamentos) {
            const cruz = crossTab(juris, rowDim, colDim, settings, analysis);
            if (cruz.total === 0 || cruz.cols.length < 2 || cruz.rows.length < 1) continue;
            L.push(`### ${cabecalho}`);
            L.push('');
            L.push(...tabelaCruzamento(cruz, { rowLabel, maxLinhas: 20, maxColunas: 9 }));
            L.push('');
            const leitura = lerCruzamento(cruz, rowDim, colDim);
            if (leitura) { L.push(leitura); L.push(''); }
        }

        // Cruzamento de três níveis: comarca > matéria > espécie.
        const triplo = cruzamentoTriplo(juris, settings, analysis, opts);
        if (triplo.length > 0) {
            L.push('### 2.11. Comarca × matéria × espécie de resultado');
            L.push('');
            L.push('Terceiro nível de detalhe: dentro de cada comarca, como cada matéria se '
                + 'distribui entre as espécies de resultado.');
            L.push('');
            L.push(...triplo);
            L.push('');
        }

        L.push('## 3. Espécies de resultado');
        L.push('');
        if (especies.linhas.length > 0) {
            L.push(`A base de cálculo das espécies são os ${formatNumber(especies.totalEfetivos)} `
                + `${plural(especies.totalEfetivos, 'júri efetivo', 'júris efetivos')}; as `
                + `${formatNumber(especies.dissolucoes)} ${plural(especies.dissolucoes, 'dissolução', 'dissoluções')} `
                + 'permanecem fora, por não corresponderem a julgamento de mérito.');
            L.push('');
            L.push(...mdTable(
                ['Espécie', 'Júris', '% dos efetivos', 'Peso', 'Pontos'],
                especies.linhas.filter((l) => l.quantidade > 0).map((l) => [
                    l.especie, formatNumber(l.quantidade), formatPercent(l.percentual),
                    String(l.peso), formatNumber(l.quantidade * l.peso, 2),
                ]),
                ['l', 'r', 'r', 'r', 'r']
            ));
            L.push('');
            const dominante = especies.linhas.filter((l) => l.quantidade > 0)[0];
            if (dominante) {
                L.push(`A espécie predominante é **${dominante.especie}**, com `
                    + `${formatNumber(dominante.quantidade)} ${plural(dominante.quantidade, 'ocorrência', 'ocorrências')} `
                    + `(${formatPercent(dominante.percentual)} dos efetivos).`);
                L.push('');
            }
        }

        L.push('## 4. Matérias');
        L.push('');
        if (materias.linhas.length > 0) {
            L.push(...mdTable(
                ['Matéria', 'Júris', '% dos efetivos', 'Aproveitamento', 'Composição'],
                materias.linhas.map((l) => [
                    l.label, formatNumber(l.total), formatPercent(l.percentual),
                    formatPercent(l.aproveitamento),
                    l.porEspecie.slice(0, 4).map((e) => `${abreviarRotulo(e.especie)}: ${e.quantidade}`).join('; '),
                ]),
                ['l', 'r', 'r', 'r', 'l']
            ));
            L.push('');
        }

        L.push(`## 5. Distribuição por ${dimLabelOf(agrupador)}`);
        L.push('');
        if (ranking.linhas.length > 0) {
            L.push(...mdTable(
                [dimLabelOf(agrupador), 'Júris', '% do total', 'Efetivos', 'Dissoluções', 'Aproveitamento'],
                ranking.linhas.slice(0, topN).map((l) => [
                    l.chave, formatNumber(l.total),
                    formatPercent(totais.total ? l.total / totais.total : null),
                    formatNumber(l.efetivos), formatNumber(l.dissolucoes),
                    formatPercent(l.aproveitamento),
                ]),
                ['l', 'r', 'r', 'r', 'r', 'r']
            ));
            L.push('');
            L.push(...analiseExtremos(ranking.linhas, agrupador));
            L.push('');
        }

        L.push(...secaoDuracao(juris, settings, analysis, ativo, estilo, '6. '));
        L.push(...secaoExpediente(juris, settings, analysis, ativo, estilo, '7. '));
        L.push(...secaoDissolucoes(juris, settings, analysis, ativo, estilo, '8. '));
        return L.join('\n').replace(/\n{3,}/g, '\n\n');
    }

    // =======================================================================
    // ESTILO FORMAL — prosa em registro de expediente
    // =======================================================================
    if (ativo.has('quantitativo')) {
        L.push('## Quantitativo geral');
        L.push('');
        L.push(
            `${plural(totais.total, 'Foi considerado', 'Foram considerados')} `
            + `${formatNumber(totais.total)} ${plural(totais.total, 'júri', 'júris')} no período, `
            + `${plural(totais.total, 'o qual foi', 'dos quais')} ${formatNumber(totais.efetivos)} `
            + `${plural(totais.efetivos, 'foi efetivamente julgado', 'foram efetivamente julgados')} `
            + `(${formatPercent(totais.pctEfetivos)}) e ${formatNumber(totais.dissolvidos)} `
            + `${plural(totais.dissolvidos, 'teve', 'tiveram')} o conselho dissolvido `
            + `(${formatPercent(totais.pctDissolvidos)}).`
        );
        L.push('');
        L.push(
            'Registre-se que as dissoluções não integram o cálculo das espécies de resultado, '
            + 'das matérias nem do aproveitamento, por não corresponderem a julgamento de mérito, '
            + 'permanecendo computadas apenas no total do período.'
        );
        L.push('');
        if (totais.redesignados > 0 || totais.cancelados > 0) {
            L.push(
                `No mesmo recorte, ${formatNumber(totais.redesignados)} `
                + `${plural(totais.redesignados, 'sessão foi redesignada', 'sessões foram redesignadas')} e `
                + `${formatNumber(totais.cancelados)} `
                + `${plural(totais.cancelados, 'foi cancelada', 'foram canceladas')}`
                + `${opts.somenteRealizados ? ', não integrando os números acima' : ''}.`
            );
            L.push('');
        }
    }

    if (ranking.linhas.length > 0) {
        L.push(`## Distribuição por ${dimLabelOf(agrupador)}`);
        L.push('');
        const primeira = ranking.linhas[0];
        L.push(
            `A maior concentração verifica-se em **${primeira.chave}**, com `
            + `${formatNumber(primeira.total)} ${plural(primeira.total, 'júri', 'júris')} `
            + `(${formatPercent(totais.total ? primeira.total / totais.total : null)} do total), `
            + `seguida pelas demais ${dimLabelOf(agrupador)}s conforme o quadro abaixo.`
        );
        L.push('');
        L.push(...mdTable(
            [dimLabelOf(agrupador), 'Júris', '% do total', 'Efetivos', 'Aproveitamento'],
            [
                ...ranking.linhas.slice(0, topN).map((l) => [
                    l.chave, formatNumber(l.total),
                    formatPercent(totais.total ? l.total / totais.total : null),
                    formatNumber(l.efetivos), formatPercent(l.aproveitamento),
                ]),
                ...(ranking.linhas.length > topN ? [[
                    `Demais (${ranking.linhas.length - topN})`,
                    formatNumber(ranking.linhas.slice(topN).reduce((a, l) => a + l.total, 0)),
                    '', '', '',
                ]] : []),
            ],
            ['l', 'r', 'r', 'r', 'r']
        ));
        L.push('');
    }

    if (ativo.has('meses')) {
        const serie = computeSerieMensal(juris, settings, analysis);
        if (serie.length > 0) {
            L.push('## Júris por mês');
            L.push('');
            const pico = [...serie].sort((a, b) => b.total - a.total)[0];
            L.push(
                `A distribuição ao longo do período compreende ${formatNumber(serie.length)} `
                + `${plural(serie.length, 'mês', 'meses')} com sessões, com maior volume em `
                + `**${pico.labelCompleto}** (${formatNumber(pico.total)} `
                + `${plural(pico.total, 'júri', 'júris')}).`
            );
            L.push('');
            L.push(...mdTable(
                ['Mês', 'Júris', 'Efetivos', 'Dissoluções', 'Aproveitamento'],
                serie.map((m) => [
                    m.labelCompleto, formatNumber(m.total), formatNumber(m.efetivos),
                    formatNumber(m.dissolucoes), formatPercent(m.aproveitamento),
                ]),
                ['l', 'r', 'r', 'r', 'r']
            ));
            L.push('');
        }
    }

    if (ativo.has('especies') && especies.linhas.length > 0) {
        L.push('## Espécies de resultado');
        L.push('');
        const comValor = especies.linhas.filter((l) => l.quantidade > 0);
        const dominante = comValor[0];
        L.push(
            `Sobre a base de ${formatNumber(especies.totalEfetivos)} `
            + `${plural(especies.totalEfetivos, 'júri efetivo', 'júris efetivos')}`
            + (dominante
                ? `, predomina a espécie **${dominante.especie}**, com ${formatNumber(dominante.quantidade)} `
                  + `${plural(dominante.quantidade, 'ocorrência', 'ocorrências')} `
                  + `(${formatPercent(dominante.percentual)}).`
                : '.')
        );
        L.push('');
        L.push(...mdTable(
            ['Espécie de resultado', 'Júris', '% dos efetivos'],
            comValor.map((l) => [l.especie, formatNumber(l.quantidade), formatPercent(l.percentual)]),
            ['l', 'r', 'r']
        ));
        L.push('');
    }

    if (ativo.has('materias') && materias.linhas.length > 0) {
        L.push('## Matérias / Tipos de júri');
        L.push('');
        L.push(
            `Os júris efetivos distribuem-se por ${formatNumber(materias.linhas.length)} `
            + `${plural(materias.linhas.length, 'matéria', 'matérias')}, na forma do quadro seguinte.`
        );
        L.push('');
        L.push(...mdTable(
            ['Matéria', 'Júris', '% dos efetivos', 'Aproveitamento'],
            materias.linhas.map((l) => [
                l.label, formatNumber(l.total), formatPercent(l.percentual),
                formatPercent(l.aproveitamento),
            ]),
            ['l', 'r', 'r', 'r']
        ));
        L.push('');
    }

    if (ativo.has('promotores')) {
        const promotores = computeRanking(juris, 'promotor', settings, analysis);
        if (promotores.linhas.length > 0) {
            L.push('## Promotores(as) relacionados');
            L.push('');
            L.push(
                `Atuaram no período ${formatNumber(promotores.linhas.length)} `
                + `${plural(promotores.linhas.length, 'promotor(a)', 'promotores(as)')}, `
                + 'com a seguinte distribuição de sessões.'
            );
            L.push('');
            L.push(...mdTable(
                ['Promotor(a)', 'Júris', 'Efetivos', 'Aproveitamento'],
                promotores.linhas.slice(0, topN).map((l) => [
                    l.chave, formatNumber(l.total), formatNumber(l.efetivos),
                    formatPercent(l.aproveitamento),
                ]),
                ['l', 'r', 'r', 'r']
            ));
            L.push('');
        }
    }

    if (ativo.has('aproveitamento')) {
        L.push('## Aproveitamento ponderado');
        L.push('');
        const faixa = faixaAproveitamento(totais.aproveitamento);
        L.push(
            `O aproveitamento do recorte é de ${formatPercent(totais.aproveitamento)}`
            + (faixa ? `, situando-se na faixa **${faixa.label}**` : '')
            + `, resultante de ${formatNumber(totais.pontos, 2)} pontos distribuídos entre `
            + `${formatNumber(totais.efetivos)} ${plural(totais.efetivos, 'júri efetivo', 'júris efetivos')}, `
            + 'segundo a tabela de pontuação vigente neste órgão.'
        );
        L.push('');
    }

    if (ativo.has('horarios')) {
        const horarios = computeHorarios(juris, analysis);
        if (horarios.length > 0) {
            L.push('## Faixas de horário');
            L.push('');
            L.push(...mdTable(
                ['Turno', 'Júris', '% do recorte'],
                horarios.map((f) => [f.faixa, formatNumber(f.quantidade), formatPercent(f.percentual)]),
                ['l', 'r', 'r']
            ));
            L.push('');
        }
    }

    L.push(...secaoDuracao(juris, settings, analysis, ativo, estilo));
    L.push(...secaoExpediente(juris, settings, analysis, ativo, estilo));
    L.push(...secaoDissolucoes(juris, settings, analysis, ativo, estilo));

    return L.join('\n').replace(/\n{3,}/g, '\n\n');
}

// ---- Seções compartilhadas pelos três estilos ------------------------------

function secaoDuracao(juris, settings, analysis, ativo, estilo, prefixo = '') {
    if (!ativo.has('duracao')) return [];
    const dados = computeDuracoes(juris, 'comarca', settings, analysis);
    if (dados.comDuracao === 0) return [];

    const L = [`## ${prefixo}Duração das sessões`, ''];
    if (estilo === 'formal') {
        L.push(
            `Aferida em ${formatNumber(dados.comDuracao)} de ${formatNumber(dados.total)} `
            + `${plural(dados.total, 'júri', 'júris')} — os demais não têm horário de início ou de `
            + `conclusão registrado —, a duração média das sessões é de **${formatDuracao(dados.media)}**, `
            + `com mediana de ${formatDuracao(dados.mediana)}. A sessão mais longa durou `
            + `${formatDuracao(dados.maior?.minutos)} (processo ${dados.maior?.numero_processo || 'sem número'}) `
            + `e a mais curta, ${formatDuracao(dados.menor?.minutos)}.`
        );
        L.push('');
        return L;
    }

    L.push(...mdTable(
        ['Indicador', 'Valor'],
        [
            ['Duração média', formatDuracao(dados.media)],
            ['Mediana', formatDuracao(dados.mediana)],
            ['Maior duração', `${formatDuracao(dados.maior?.minutos)} (${dados.maior?.numero_processo || '—'})`],
            ['Menor duração', `${formatDuracao(dados.menor?.minutos)} (${dados.menor?.numero_processo || '—'})`],
            ['Tempo total de sessão', formatDuracao(dados.minutos)],
            ['Júris com duração aferida', `${formatNumber(dados.comDuracao)} de ${formatNumber(dados.total)}`],
        ],
        ['l', 'r']
    ));
    L.push('');
    if (dados.linhas.length > 1) {
        L.push(...mdTable(
            ['Comarca', 'Júris', 'Aferidos', 'Média', 'Mediana', 'Maior', 'Menor'],
            dados.linhas.slice(0, estilo === 'analitico' ? 25 : 12).map((l) => [
                l.chave, formatNumber(l.total), formatNumber(l.comDuracao),
                formatDuracao(l.media), formatDuracao(l.mediana),
                formatDuracao(l.maior?.minutos), formatDuracao(l.menor?.minutos),
            ]),
            ['l', 'r', 'r', 'r', 'r', 'r', 'r']
        ));
        L.push('');
    }
    return L;
}

function secaoExpediente(juris, settings, analysis, ativo, estilo, prefixo = '') {
    if (!ativo.has('expediente')) return [];
    const dados = computeExpediente(juris, 'comarca', settings, analysis);
    if (dados.classificados === 0) return [];

    const janela = `${dados.expediente.inicio} às ${dados.expediente.fim}`;
    const L = [`## ${prefixo}Expediente`, ''];

    if (estilo === 'formal') {
        L.push(
            `Considerado o expediente das ${janela}, das ${formatNumber(dados.classificados)} `
            + `${plural(dados.classificados, 'sessão classificável', 'sessões classificáveis')}, `
            + `${formatNumber(dados.dentro)} (${formatPercent(dados.pctDentro)}) `
            + `${plural(dados.dentro, 'transcorreu', 'transcorreram')} integralmente dentro dele, `
            + `${formatNumber(dados.prolongou)} ${plural(dados.prolongou, 'ultrapassou', 'ultrapassaram')} `
            + `o horário de encerramento, ${formatNumber(dados.antecipou)} `
            + `${plural(dados.antecipou, 'iniciou', 'iniciaram')} antes da abertura e `
            + `${formatNumber(dados.sem_expediente)} `
            + `${plural(dados.sem_expediente, 'ocorreu', 'ocorreram')} em dia sem expediente.`
        );
        if (dados.minutosExcedentes > 0) {
            L.push('');
            L.push(
                `As sessões que ultrapassaram o encerramento somaram `
                + `${formatDuracao(dados.minutosExcedentes)} além do horário, com média de `
                + `${formatDuracao(dados.mediaExcedente)} por sessão.`
            );
        }
        L.push('');
        return L;
    }

    L.push(`Janela de expediente considerada: ${janela}.`);
    L.push('');
    L.push(...mdTable(
        ['Situação', 'Júris', '% das classificáveis'],
        [
            ['Dentro do expediente', formatNumber(dados.dentro), formatPercent(dados.pctDentro)],
            ['Prolongou após o expediente', formatNumber(dados.prolongou), formatPercent(dados.pctProlongou)],
            ['Iniciou antes do expediente', formatNumber(dados.antecipou), formatPercent(dados.pctAntecipou)],
            ['Dia sem expediente', formatNumber(dados.sem_expediente), formatPercent(dados.pctSemExpediente)],
            ['Horário não informado', formatNumber(dados.sem_horario), '—'],
        ],
        ['l', 'r', 'r']
    ));
    L.push('');
    if (dados.linhas.length > 1) {
        L.push(...mdTable(
            ['Comarca', 'Júris', 'Dentro', 'Prolongou', 'Antes', 'Sem expediente', '% dentro'],
            dados.linhas.slice(0, estilo === 'analitico' ? 25 : 12).map((l) => [
                l.chave, formatNumber(l.total), formatNumber(l.dentro), formatNumber(l.prolongou),
                formatNumber(l.antecipou), formatNumber(l.sem_expediente), formatPercent(l.pctDentro),
            ]),
            ['l', 'r', 'r', 'r', 'r', 'r', 'r']
        ));
        L.push('');
    }
    return L;
}

function secaoDissolucoes(juris, settings, analysis, ativo, estilo, prefixo = '') {
    if (!ativo.has('dissolucoes')) return [];
    const { dissolvidos } = splitEfetivos(aplicarAnalise(juris, analysis), settings);
    const L = [`## ${prefixo}Dissoluções`, ''];

    if (dissolvidos.length === 0) {
        L.push('Não houve dissolução de conselho no período analisado.');
        L.push('');
        return L;
    }

    L.push(
        `${plural(dissolvidos.length, 'Houve', 'Houve')} ${formatNumber(dissolvidos.length)} `
        + `${plural(dissolvidos.length, 'dissolução', 'dissoluções')} no período, `
        + `${plural(dissolvidos.length, 'não computada', 'não computadas')} nas demais seções.`
    );
    L.push('');
    const limite = estilo === 'executivo' ? 10 : estilo === 'analitico' ? 100 : 30;
    L.push(...mdTable(
        ['Processo', 'Data', 'Comarca', 'Observações'],
        dissolvidos.slice(0, limite).map((j) => [
            j.numero_processo || 'sem número', formatDateBR(j.data_juri),
            j.comarca || SEM_VALOR, j.observacoes || '',
        ]),
        ['l', 'l', 'l', 'l']
    ));
    if (dissolvidos.length > limite) {
        L.push('');
        L.push(`_Exibidas as ${limite} primeiras de ${formatNumber(dissolvidos.length)} dissoluções._`);
    }
    L.push('');
    return L;
}

// ---- Leitura analítica -----------------------------------------------------

/**
 * Quanto do total está concentrado nas primeiras posições. Um recorte em que
 * três comarcas respondem por 80% dos júris pede uma política diferente de um
 * em que o volume está espalhado por trinta.
 */
function analiseConcentracao(linhas, dimension, total) {
    if (!linhas || linhas.length === 0 || !total) return [];
    const topo = linhas.slice(0, 3);
    const somaTopo = topo.reduce((acc, l) => acc + l.total, 0);
    const pct = somaTopo / total;
    const leitura = pct >= 0.7
        ? 'trata-se de uma distribuição fortemente concentrada'
        : pct >= 0.4
            ? 'a distribuição é moderadamente concentrada'
            : 'a distribuição é dispersa';
    const cabeca = topo.length === 1
        ? `A primeira ${dimLabelOf(dimension)}`
        : `As ${topo.length === 2 ? 'duas' : 'três'} primeiras ${dimLabelPlural(dimension)}`;
    return [
        `${cabeca} (${topo.map((l) => l.chave).join(', ')}) `
        + `${plural(topo.length, 'responde', 'respondem')} por `
        + `${formatNumber(somaTopo)} ${plural(somaTopo, 'júri', 'júris')}, `
        + `${formatPercent(pct)} do total — ${leitura}, `
        + `com ${formatNumber(linhas.length)} ${plural(linhas.length, dimLabelOf(dimension), dimLabelPlural(dimension))} `
        + 'no recorte.',
    ];
}

/** Os extremos de aproveitamento, entre os grupos com volume suficiente. */
function analiseExtremos(linhas, dimension) {
    // Abaixo de 3 júris, o aproveitamento oscila demais para significar algo.
    const comVolume = linhas.filter((l) => l.efetivos >= 3 && l.aproveitamento !== null);
    if (comVolume.length < 2) return [];
    const ordenadas = [...comVolume].sort((a, b) => b.aproveitamento - a.aproveitamento);
    const melhor = ordenadas[0];
    const pior = ordenadas[ordenadas.length - 1];
    return [
        `Entre ${dimLabelPlural(dimension)} com ao menos três júris efetivos, o maior aproveitamento é o de `
        + `**${melhor.chave}** (${formatPercent(melhor.aproveitamento)} em `
        + `${formatNumber(melhor.efetivos)} ${plural(melhor.efetivos, 'júri', 'júris')}) e o menor, `
        + `o de **${pior.chave}** (${formatPercent(pior.aproveitamento)} em `
        + `${formatNumber(pior.efetivos)} ${plural(pior.efetivos, 'júri', 'júris')}).`,
    ];
}

/** Uma frase sobre o que o cruzamento mostra, quando há o que dizer. */
function lerCruzamento(cruz, rowDim, colDim) {
    if (cruz.rows.length === 0 || cruz.cols.length === 0) return '';
    const linhaTopo = cruz.rows[0];
    let melhorColuna = '';
    let melhorValor = -1;
    for (const coluna of cruz.cols) {
        const v = cruz.get(linhaTopo, coluna);
        if (v > melhorValor) { melhorValor = v; melhorColuna = coluna; }
    }
    if (melhorValor <= 0) return '';
    const totalLinha = cruz.rowTotals.get(linhaTopo) || 0;
    return `Em **${linhaTopo}**, ${dimLabelOf(rowDim)} de maior volume `
        + `(${formatNumber(totalLinha)} ${plural(totalLinha, 'júri', 'júris')}), `
        + `a ${dimLabelOf(colDim)} mais frequente é **${melhorColuna}**, com `
        + `${formatNumber(melhorValor)} ${plural(melhorValor, 'ocorrência', 'ocorrências')} `
        + `(${formatPercent(totalLinha ? melhorValor / totalLinha : null)} da linha).`;
}

/**
 * Comarca > matéria > espécie, em tabela achatada: uma linha por par
 * comarca/matéria, com a composição de espécies na última coluna.
 */
function cruzamentoTriplo(juris, settings, analysis, opts) {
    const considerados = aplicarAnalise(juris, analysis);
    const mapa = new Map();

    for (const juri of considerados) {
        const comarca = dimensionValue(juri, 'comarca', settings);
        const materia = dimensionValue(juri, 'tipo', settings);
        const especie = dimensionValue(juri, 'resultado', settings);
        if (opts.excluirNaoInformados
            && (comarca === SEM_VALOR || materia === SEM_VALOR || especie === SEM_VALOR)) continue;

        const chave = `${comarca}${PATH_SEP}${materia}`;
        if (!mapa.has(chave)) mapa.set(chave, { comarca, materia, total: 0, especies: new Map() });
        const grupo = mapa.get(chave);
        grupo.total += 1;
        grupo.especies.set(especie, (grupo.especies.get(especie) || 0) + 1);
    }

    if (mapa.size === 0) return [];

    const linhas = [...mapa.values()]
        .sort((a, b) => (b.total - a.total)
            || a.comarca.localeCompare(b.comarca, 'pt-BR')
            || a.materia.localeCompare(b.materia, 'pt-BR'))
        .slice(0, 40)
        .map((g) => [
            g.comarca,
            g.materia,
            formatNumber(g.total),
            [...g.especies.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([especie, qtd]) => `${abreviarRotulo(especie)}: ${qtd}`)
                .join('; '),
        ]);

    const tabela = mdTable(
        ['Comarca', 'Matéria', 'Júris', 'Espécies de resultado'],
        linhas,
        ['l', 'l', 'r', 'l']
    );
    if (mapa.size > 40) {
        tabela.push('');
        tabela.push(`_Exibidos os 40 pares de maior volume, de ${formatNumber(mapa.size)} combinações._`);
    }
    return tabela;
}
