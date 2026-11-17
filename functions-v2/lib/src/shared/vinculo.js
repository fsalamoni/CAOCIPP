"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLOQUEIOS = void 0;
exports.vinculoBloqueado = vinculoBloqueado;
exports.orgSuspensa = orgSuspensa;
exports.peSuspensoPlataforma = peSuspensoPlataforma;
exports.exigirContaLiberada = exigirContaLiberada;
const https_1 = require("firebase-functions/v2/https");
/** O vínculo não autoriza nada: inexistente, removido, órgão suspenso ou pessoa bloqueada. */
function vinculoBloqueado(d) {
    return !d || d.active === false || d.org_suspended === true || d.user_blocked === true;
}
/** Órgão suspenso pela plataforma (acesso inteiro). */
function orgSuspensa(org) {
    var _a;
    return ((_a = org === null || org === void 0 ? void 0 : org.platform_suspension) === null || _a === void 0 ? void 0 : _a.ativa) === true;
}
/** Processo Eletrônico fora do ar por decisão da plataforma: módulo suspenso ou órgão suspenso. */
function peSuspensoPlataforma(org) {
    var _a;
    return ((_a = org === null || org === void 0 ? void 0 : org.secretariaConfig) === null || _a === void 0 ? void 0 : _a.suspensa_plataforma) === true || orgSuspensa(org);
}
exports.BLOQUEIOS = 'platformBlocks';
/** Recusa quem a plataforma bloqueou (Portal, criar órgão, entrar por convite). */
async function exigirContaLiberada(db, uid) {
    var _a;
    const b = await db.collection(exports.BLOQUEIOS).doc(uid).get();
    if (b.exists && ((_a = b.data()) === null || _a === void 0 ? void 0 : _a.ativa) === true) {
        throw new https_1.HttpsError('permission-denied', 'Seu acesso ao SIGO foi bloqueado pela administração da plataforma.');
    }
}
//# sourceMappingURL=vinculo.js.map