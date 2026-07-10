// ============================================================================
// stageTime — quanto tempo um processo/expediente está na etapa ATUAL
// (contado em dias úteis, a partir da data de entrada na etapa até hoje).
// Usado pelo indicador visual (flag `stage_time_indicator`) no Kanban e na
// tabela. Genérico o bastante para processos e expedientes: recebe a função
// de leitura de campo e de status derivado como parâmetros.
//
// A severidade (cor do selo) usa limiares fixos em dias úteis, independente
// do histórico do órgão: até 5 dias = ok (verde), até 10 dias = atenção
// (amarelo/mostarda), mais de 10 dias = risco (vermelho). A média histórica
// do órgão (computeStageAverages) continua disponível apenas como contexto
// informativo no tooltip do selo.
// ============================================================================

import { calculateBusinessDays, parseLocalDate } from '@/lib/dateUtils';
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

/**
 * Dias úteis desde que o registro entrou na etapa atual. Retorna null se a
 * etapa é terminal (Na pasta) ou se a data de entrada não está preenchida.
 */
export function getDaysInCurrentStage(record, status, getField) {
    const entryField = STAGE_ENTRY_FIELD[status];
    if (!entryField) return null;

    const rawDate = getField(record, entryField);
    if (!rawDate) return null;

    const entryDate = parseLocalDate(rawDate);
    if (!isValid(entryDate)) return null;

    return calculateBusinessDays(rawDate, new Date());
}

/**
 * Média histórica (dias úteis) de permanência em cada etapa, calculada a
 * partir de todos os registros que já passaram por ela (têm data de entrada
 * E de saída preenchidas) — não apenas os que estão nela agora.
 */
export function computeStageAverages(records, getField) {
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

            const days = calculateBusinessDays(entryRaw, exitRaw);
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

// Limiares fixos (dias úteis) para a severidade visual do selo.
export const STAGE_TIME_THRESHOLDS = { OK_MAX: 5, WARN_MAX: 10 };

/**
 * Classifica a severidade visual por limiares fixos em dias úteis:
 * 'ok' (até 5 dias úteis, verde), 'warn' (até 10 dias úteis,
 * amarelo/mostarda) ou 'risk' (mais de 10 dias úteis, vermelho).
 */
export function getStageTimeSeverity(daysInStage) {
    if (daysInStage == null) return null;
    if (daysInStage <= STAGE_TIME_THRESHOLDS.OK_MAX) return 'ok';
    if (daysInStage <= STAGE_TIME_THRESHOLDS.WARN_MAX) return 'warn';
    return 'risk';
}
