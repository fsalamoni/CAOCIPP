"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.historyEntryId = historyEntryId;
const crypto = require("crypto");
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
function historyEntryId(entry) {
    var _a, _b, _c, _d, _e, _f;
    const basis = JSON.stringify({
        date: (_a = entry.date) !== null && _a !== void 0 ? _a : '',
        time: (_b = entry.time) !== null && _b !== void 0 ? _b : '',
        user_id: (_c = entry.user_id) !== null && _c !== void 0 ? _c : '',
        user_name: (_d = entry.user_name) !== null && _d !== void 0 ? _d : '',
        action: (_e = entry.action) !== null && _e !== void 0 ? _e : '',
        timestamp: (_f = entry.timestamp) !== null && _f !== void 0 ? _f : '',
    });
    return crypto.createHash('sha1').update(basis).digest('hex');
}
//# sourceMappingURL=history.js.map