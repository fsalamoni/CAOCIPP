"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificarNumeroPgea = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const vinculo_1 = require("../shared/vinculo");
const registrosPgea_1 = require("../shared/registrosPgea");
/**
 * Confere se o nº do PGEA já existe no banco do órgão (Consultas ou
 * Expedientes, cada um no seu), arquivados inclusive. Devolve um resumo de
 * cada registro com o número: fase, responsável, original ou aditivo.
 */
exports.verificarNumeroPgea = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError('unauthenticated', 'Entre na sua conta.');
    const { organizationId, modulo, numero } = request.data || {};
    const cfg = (0, registrosPgea_1.moduloPgea)(modulo);
    const alvo = (0, registrosPgea_1.normalizarNumeroPgea)(numero);
    if (!organizationId || !cfg || !alvo || String(numero).length > 120) {
        throw new https_1.HttpsError('invalid-argument', 'Informe o número.');
    }
    const db = admin.firestore();
    const vinculo = await db.collection('userOrganizations').doc(`${request.auth.uid}_${organizationId}`).get();
    if (!vinculo.exists || (0, vinculo_1.vinculoBloqueado)(vinculo.data())) {
        throw new https_1.HttpsError('permission-denied', 'Você não faz parte deste órgão.');
    }
    // ponytail: lê o número de todos os registros do órgão (só os campos do
    // resumo) para achar o mesmo número escrito de outro jeito. Se um órgão
    // passar de dezenas de milhares, gravar o número normalizado e consultar por ele.
    const snap = await db.collection(cfg.colecao)
        .where('organization_id', '==', organizationId)
        .select(cfg.campoNumero, ...registrosPgea_1.CAMPOS_RESUMO)
        .get();
    const achados = snap.docs
        .filter((d) => (0, registrosPgea_1.normalizarNumeroPgea)(d.get(cfg.campoNumero)) === alvo)
        .map((d) => (0, registrosPgea_1.resumoRegistro)(d.id, d.data(), cfg.campoNumero));
    return { existe: achados.length > 0, registros: (0, registrosPgea_1.ordenarResumos)(achados).slice(0, 20), total: achados.length };
});
//# sourceMappingURL=verificarNumero.js.map