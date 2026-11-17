"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bancoApi = exports.noEmulador = exports.projeto = void 0;
exports.googleApi = googleApi;
const admin = require("firebase-admin");
const app_1 = require("firebase-admin/app");
/** Projeto do Google Cloud em que as Functions rodam. */
const projeto = () => process.env.GCLOUD_PROJECT || admin.app().options.projectId || '';
exports.projeto = projeto;
/** No emulador não há APIs do Google Cloud de verdade. */
const noEmulador = () => process.env.FUNCTIONS_EMULATOR === 'true';
exports.noEmulador = noEmulador;
/** Banco do SIGO na API de administração do Firestore. */
const bancoApi = () => `https://firestore.googleapis.com/v1/projects/${(0, exports.projeto)()}/databases/(default)`;
exports.bancoApi = bancoApi;
/**
 * Chamada às APIs REST do Google Cloud com a conta de serviço das Functions.
 * Lança Error com o status e o começo da resposta quando não dá certo.
 */
async function googleApi(url, opcoes = {}) {
    const { access_token } = await (0, app_1.applicationDefault)().getAccessToken();
    const metodo = opcoes.metodo || (opcoes.corpo ? 'POST' : 'GET');
    const r = await fetch(url, Object.assign(Object.assign({ method: metodo, headers: { authorization: `Bearer ${access_token}`, 'content-type': 'application/json' } }, (opcoes.corpo ? { body: JSON.stringify(opcoes.corpo) } : {})), { signal: AbortSignal.timeout(10000) }));
    if (!r.ok) {
        const e = new Error(`${r.status} ${(await r.text()).slice(0, 300)}`);
        e.status = r.status;
        throw e;
    }
    return r.json();
}
//# sourceMappingURL=googleApi.js.map