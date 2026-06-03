import * as crypto from 'crypto';

/**
 * Entrada de log de atividade (mesmo formato gravado no array activity_log).
 */
export interface ActivityLogEntry {
    date?: string;
    time?: string;
    user_id?: string;
    user_name?: string;
    action?: string;
    timestamp?: string;
    [key: string]: unknown;
}

/**
 * Gera um ID determinístico e estável para uma entrada de histórico, a partir
 * do CONTEÚDO da entrada (ignorando metadados de espelhamento como created_at).
 *
 * Objetivo: tornar a escrita dupla e o backfill IDEMPOTENTES. Uma mesma entrada
 * (mesmo conteúdo) sempre mapeia para o mesmo documento em
 * processes/{id}/history ou expedientes/{id}/history, então:
 *   - regravar a mesma entrada apenas sobrescreve o mesmo doc (sem duplicar);
 *   - o backfill pode rodar quantas vezes for preciso sem criar duplicatas;
 *   - mantém paridade 1:1 com o array activity_log (que já deduplica via
 *     arrayUnion entradas idênticas).
 */
export function historyEntryId(entry: ActivityLogEntry): string {
    const basis = JSON.stringify({
        date: entry.date ?? '',
        time: entry.time ?? '',
        user_id: entry.user_id ?? '',
        user_name: entry.user_name ?? '',
        action: entry.action ?? '',
        timestamp: entry.timestamp ?? '',
    });
    return crypto.createHash('sha1').update(basis).digest('hex');
}
