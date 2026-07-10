// ============================================================================
// stageTime — quanto tempo um processo/expediente está na etapa ATUAL
// (a partir da data de entrada na etapa até hoje, em dias úteis OU dias
// corridos — configurável por órgão). Usado pelo indicador visual (flag
// `stage_time_indicator`) no Kanban e na tabela. Genérico o bastante para
// processos e expedientes: recebe a função de leitura de campo e de status
// derivado como parâmetros.
//
// A severidade (cor do selo) usa limiares configuráveis por órgão
// (organization.stageTimeConfig, editável em Painel Administrativo →
// Indicador de Tempo): até okMaxDays = ok, até warnMaxDays = atenção, acima
// disso = risco. A média histórica do órgão (computeStageAverages) continua
// disponível apenas como contexto informativo no tooltip do selo.
// ============================================================================

import { calculateBusinessDays, calculateCalendarDays, parseLocalDate } from '@/lib/dateUtils';
import { isValid } from 'date-fns';

// Campo de data em que o registro ENTROU em cada etapa (pré-arquivamento).
export const STAGE_ENTRY_FIELD = {
    'Pendente': 'entry_date',
    'Em elaboração': 'distribution_date',
    'Em revisão': 'review_submission_date',
    'Revisadas': 'reviewed_date',
};

// Campo de data em que o registro SAIU de cada etapa (para a próxima).
export const STAGE_EXIT_FIELD = {
    'Pendente': 'distribution_date',
    'Em elaboração': 'review_submission_date',
    'Em revisão': 'reviewed_date',
    'Revisadas': 'archived_date',
};

// Paleta de cores permitidas para os selos ok/atenção/risco. Presets fixos
// (não cores livres) para garantir que as classes Tailwind existam no bundle
// e para manter o contraste correto em ambos os temas.
export const STAGE_TIME_COLOR_PRESETS = {
    emerald: {
        label: 'Verde',
        swatch: 'bg-emerald-500',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
    },
    lime: {
        label: 'Verde-limão',
        swatch: 'bg-lime-500',
        classes: 'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/40 dark:text-lime-400 dark:border-lime-900',
    },
    amber: {
        label: 'Âmbar / Mostarda',
        swatch: 'bg-amber-500',
        classes: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
    },
    orange: {
        label: 'Laranja',
        swatch: 'bg-orange-500',
        classes: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900',
    },
    rose: {
        label: 'Vermelho',
        swatch: 'bg-rose-500',
        classes: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900',
    },
    sky: {
        label: 'Azul',
        swatch: 'bg-sky-500',
        classes: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900',
    },
    violet: {
        label: 'Roxo',
        swatch: 'bg-violet-500',
        classes: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900',
    },
    fuchsia: {
        label: 'Rosa/Magenta',
        swatch: 'bg-fuchsia-500',
        classes: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-400 dark:border-fuchsia-900',
    },
    slate: {
        label: 'Cinza',
        swatch: 'bg-slate-500',
        classes: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600',
    },
};

export const STAGE_TIME_DAY_TYPES = [
    { value: 'business', label: 'Dias úteis' },
    { value: 'calendar', label: 'Dias corridos' },
];

// Configuração padrão (usada até o admin personalizar em Painel
// Administrativo → Indicador de Tempo, ou se o órgão nunca salvou nada).
export const DEFAULT_STAGE_TIME_CONFIG = {
    dayType: 'business',
    okMaxDays: 5,
    warnMaxDays: 10,
    colors: { ok: 'emerald', warn: 'amber', risk: 'rose' },
};

/**
 * Combina a configuração salva do órgão com os padrões, garantindo que
 * campos ausentes (órgão que nunca personalizou, ou personalizou antes de
 * um novo campo existir) sempre tenham um valor utilizável.
 */
export function resolveStageTimeConfig(stageTimeConfig) {
    return {
        dayType: stageTimeConfig?.dayType === 'calendar' ? 'calendar' : 'business',
        okMaxDays: Number.isFinite(stageTimeConfig?.okMaxDays) ? stageTimeConfig.okMaxDays : DEFAULT_STAGE_TIME_CONFIG.okMaxDays,
        warnMaxDays: Number.isFinite(stageTimeConfig?.warnMaxDays) ? stageTimeConfig.warnMaxDays : DEFAULT_STAGE_TIME_CONFIG.warnMaxDays,
        colors: {
            ok: stageTimeConfig?.colors?.ok || DEFAULT_STAGE_TIME_CONFIG.colors.ok,
            warn: stageTimeConfig?.colors?.warn || DEFAULT_STAGE_TIME_CONFIG.colors.warn,
            risk: stageTimeConfig?.colors?.risk || DEFAULT_STAGE_TIME_CONFIG.colors.risk,
        },
    };
}

/**
 * Dias (úteis ou corridos, conforme dayType) desde que o registro entrou na
 * etapa atual. Retorna null se a etapa é terminal (Na pasta) ou se a data de
 * entrada não está preenchida.
 */
export function getDaysInCurrentStage(record, status, getField, dayType = 'business') {
    const entryField = STAGE_ENTRY_FIELD[status];
    if (!entryField) return null;

    const rawDate = getField(record, entryField);
    if (!rawDate) return null;

    const entryDate = parseLocalDate(rawDate);
    if (!isValid(entryDate)) return null;

    return dayType === 'calendar'
        ? calculateCalendarDays(rawDate, new Date())
        : calculateBusinessDays(rawDate, new Date());
}

/**
 * Média histórica (dias úteis ou corridos, conforme dayType) de permanência
 * em cada etapa, calculada a partir de todos os registros que já passaram
 * por ela (têm data de entrada E de saída preenchidas) — não apenas os que
 * estão nela agora.
 */
export function computeStageAverages(records, getField, dayType = 'business') {
    const sums = {};
    const counts = {};

    Object.keys(STAGE_ENTRY_FIELD).forEach((stage) => {
        sums[stage] = 0;
        counts[stage] = 0;
    });

    records.forEach((record) => {
        Object.keys(STAGE_ENTRY_FIELD).forEach((stage) => {
            const entryRaw = getField(record, STAGE_ENTRY_FIELD[stage]);
            const exitRaw = getField(record, STAGE_EXIT_FIELD[stage]);
            if (!entryRaw || !exitRaw) return;

            const entryDate = parseLocalDate(entryRaw);
            const exitDate = parseLocalDate(exitRaw);
            if (!isValid(entryDate) || !isValid(exitDate)) return;

            const days = dayType === 'calendar'
                ? calculateCalendarDays(entryRaw, exitRaw)
                : calculateBusinessDays(entryRaw, exitRaw);
            if (days == null || days < 0) return;

            sums[stage] += days;
            counts[stage] += 1;
        });
    });

    const averages = {};
    Object.keys(STAGE_ENTRY_FIELD).forEach((stage) => {
        averages[stage] = counts[stage] > 0 ? sums[stage] / counts[stage] : null;
    });
    return averages;
}

/**
 * Classifica a severidade visual por limiares configuráveis (dias úteis ou
 * corridos, conforme config.dayType): 'ok' (até okMaxDays), 'warn' (até
 * warnMaxDays) ou 'risk' (acima de warnMaxDays).
 */
export function getStageTimeSeverity(daysInStage, stageTimeConfig = DEFAULT_STAGE_TIME_CONFIG) {
    if (daysInStage == null) return null;
    const config = resolveStageTimeConfig(stageTimeConfig);
    if (daysInStage <= config.okMaxDays) return 'ok';
    if (daysInStage <= config.warnMaxDays) return 'warn';
    return 'risk';
}
