"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.historyEntryId = historyEntryId;
const crypto = __importStar(require("crypto"));
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