"use strict";
// Regras únicas sobre o vínculo da pessoa com o órgão e a suspensão do órgão
// pela administração da plataforma.
//
// Suspensão do órgão (platformOrg 'suspender'): grava `platform_suspension`
// no órgão e `org_suspended: true` em todos os vínculos dele. As regras do
// Firestore (isMemberOf) e as Functions leem só o vínculo, então a suspensão
// não custa leitura a mais. O Portal das partes lê o órgão e trata a
// suspensão como Processo Eletrônico suspenso.
Object.defineProperty(exports, "__esModule", { value: true });
exports.vinculoBloqueado = vinculoBloqueado;
exports.orgSuspensa = orgSuspensa;
exports.peSuspensoPlataforma = peSuspensoPlataforma;
/** O vínculo não autoriza nada: inexistente, removido ou de órgão suspenso. */
function vinculoBloqueado(d) {
    return !d || d.active === false || d.org_suspended === true;
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
//# sourceMappingURL=vinculo.js.map