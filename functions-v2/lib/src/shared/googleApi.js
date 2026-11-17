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
exports.bancoApi = exports.noEmulador = exports.projeto = void 0;
exports.googleApi = googleApi;
const admin = __importStar(require("firebase-admin"));
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