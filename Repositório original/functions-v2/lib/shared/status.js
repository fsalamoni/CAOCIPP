"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateStatus = calculateStatus;
const fields_1 = require("./fields");
function calculateStatus(process) {
    // 1. "Na pasta" (Verde): Se o campo de Arquivamento estiver preenchido.
    if ((0, fields_1.getSmartField)(process, 'archived_date'))
        return "Na pasta";
    // 2. "Em revisão" (Azul/Roxo): Se o campo Remessa p/ Revisão estiver preenchido.
    if ((0, fields_1.getSmartField)(process, 'review_submission_date'))
        return "Em revisão";
    // 3. "Em elaboração" (Âmbar/Amarelo): Se o campo Início da Análise estiver preenchido.
    if ((0, fields_1.getSmartField)(process, 'analysis_start_date'))
        return "Em elaboração";
    // 4. "Pendente" (Branco): Fallback final.
    return (0, fields_1.getSmartField)(process, 'status') || "Pendente";
}
//# sourceMappingURL=status.js.map