"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateStatus = calculateStatus;
function calculateStatus(process) {
    if (process.archived_date)
        return "Na pasta";
    // Aligned with Deno version and recent refinements
    if (process.review_return_date)
        return "Para revisão";
    if (process.review_submission_date)
        return "Em revisão";
    if (process.analysis_start_date)
        return "Em elaboração";
    if (process.distribution_date)
        return "Pendente";
    // existing status or default
    return process.status || "Pendente";
}
//# sourceMappingURL=status.js.map