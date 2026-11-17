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
exports.platformDiagnostico = void 0;
exports.agruparErros = agruparErros;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const rotinas_1 = require("../shared/rotinas");
const googleApi_1 = require("../shared/googleApi");
/** Agrupa entradas do Cloud Logging pelas funções do SIGO. Pura, exportada para teste. */
function agruparErros(entradas, funcoes) {
    var _a, _b, _c, _d, _e, _f, _g;
    const grupos = new Map();
    for (const e of entradas) {
        const servico = String(((_b = (_a = e === null || e === void 0 ? void 0 : e.resource) === null || _a === void 0 ? void 0 : _a.labels) === null || _b === void 0 ? void 0 : _b.service_name) || ((_d = (_c = e === null || e === void 0 ? void 0 : e.resource) === null || _c === void 0 ? void 0 : _c.labels) === null || _d === void 0 ? void 0 : _d.function_name) || '').toLowerCase();
        if (!funcoes.has(servico))
            continue;
        const msg = String(e.textPayload || ((_e = e.jsonPayload) === null || _e === void 0 ? void 0 : _e.message) || ((_g = (_f = e.protoPayload) === null || _f === void 0 ? void 0 : _f.status) === null || _g === void 0 ? void 0 : _g.message) || 'Erro sem mensagem').trim().slice(0, 300);
        const g = grupos.get(servico);
        if (!g)
            grupos.set(servico, { funcao: servico, quantidade: 1, ultima_em: e.timestamp, ultima_mensagem: msg });
        else {
            g.quantidade += 1;
            if (e.timestamp > g.ultima_em) {
                g.ultima_em = e.timestamp;
                g.ultima_mensagem = msg;
            }
        }
    }
    return [...grupos.values()].sort((a, b) => b.quantidade - a.quantidade || b.ultima_em.localeCompare(a.ultima_em));
}
async function lerErros() {
    if ((0, googleApi_1.noEmulador)() || !(0, googleApi_1.projeto)())
        return null;
    try {
        // Nomes dos serviços no Cloud Run = nome exportado em minúsculas.
        const funcoes = new Set(Object.keys(require('../index')).map((n) => n.toLowerCase()));
        const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const r = await (0, googleApi_1.googleApi)('https://logging.googleapis.com/v2/entries:list', { corpo: {
                resourceNames: [`projects/${(0, googleApi_1.projeto)()}`],
                filter: `severity>=ERROR AND timestamp>="${desde}" AND (resource.type="cloud_run_revision" OR resource.type="cloud_function")`,
                orderBy: 'timestamp desc',
                pageSize: 500,
            } });
        const grupos = agruparErros(r.entries || [], funcoes);
        return { grupos, total: grupos.reduce((s, g) => s + g.quantidade, 0), truncado: !!r.nextPageToken };
    }
    catch (e) {
        console.warn('platformDiagnostico: logging indisponível', e.message);
        return null;
    }
}
async function lerArquivos() {
    if ((0, googleApi_1.noEmulador)() || !(0, googleApi_1.projeto)())
        return null;
    try {
        const bucket = admin.storage().bucket().name;
        const fim = new Date();
        const ini = new Date(fim.getTime() - 2 * 24 * 3600 * 1000);
        const serie = async (metrica) => {
            const q = new URLSearchParams({
                filter: `metric.type="storage.googleapis.com/storage/${metrica}" AND resource.labels.bucket_name="${bucket}"`,
                'interval.startTime': ini.toISOString(),
                'interval.endTime': fim.toISOString(),
            });
            const r = await (0, googleApi_1.googleApi)(`https://monitoring.googleapis.com/v3/projects/${(0, googleApi_1.projeto)()}/timeSeries?${q}`);
            // Uma série por classe de armazenamento; o ponto mais novo vem primeiro.
            return (r.timeSeries || []).reduce((s, t) => { var _a, _b, _c, _d, _e, _f, _g, _h; return s + Number((_h = (_d = (_c = (_b = (_a = t.points) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.value) === null || _c === void 0 ? void 0 : _c.doubleValue) !== null && _d !== void 0 ? _d : (_g = (_f = (_e = t.points) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.value) === null || _g === void 0 ? void 0 : _g.int64Value) !== null && _h !== void 0 ? _h : 0); }, 0);
        };
        const [bytes, objetos] = await Promise.all([serie('total_bytes'), serie('object_count').catch(() => null)]);
        return { bytes, objetos, bucket };
    }
    catch (e) {
        console.warn('platformDiagnostico: monitoring indisponível', e.message);
        return null;
    }
}
exports.platformDiagnostico = (0, https_1.onCall)({ region: helpers_1.REGION, timeoutSeconds: 60 }, async (request) => {
    var _a;
    await (0, helpers_1.assertPlatformAdmin)(request);
    if ((((_a = request.data) === null || _a === void 0 ? void 0 : _a.action) || 'painel') !== 'painel')
        throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida.');
    const db = admin.firestore();
    const t0 = Date.now();
    let bancoOk = true;
    let bancoErro = '';
    try {
        await db.collection('platformConfig').doc('featureFlags').get();
    }
    catch (e) {
        bancoOk = false;
        bancoErro = e.message;
    }
    const bancoMs = Date.now() - t0;
    const [rotinasSnap, erros, arquivos, ultimaAtividade, atividade24h] = await Promise.all([
        db.collection('platformRoutines').get().catch(() => null),
        lerErros(),
        lerArquivos(),
        db.collection('auditLogs').orderBy('timestamp', 'desc').limit(1).get().then((s) => { var _a, _b, _c, _d, _e; return ((_e = (_d = (_c = (_b = (_a = s.docs[0]) === null || _a === void 0 ? void 0 : _a.data()) === null || _b === void 0 ? void 0 : _b.timestamp) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) === null || _e === void 0 ? void 0 : _e.toISOString()) || null; }).catch(() => null),
        db.collection('auditLogs').where('timestamp', '>=', firestore_1.Timestamp.fromMillis(Date.now() - 24 * 3600 * 1000)).count().get().then((s) => s.data().count).catch(() => null),
    ]);
    const docs = new Map(((rotinasSnap === null || rotinasSnap === void 0 ? void 0 : rotinasSnap.docs) || []).map((d) => [d.id, d.data()]));
    const rotinas = Object.entries(rotinas_1.ROTINAS).map(([chave, r]) => {
        const d = docs.get(chave);
        return Object.assign(Object.assign({ chave }, r), { situacao: (0, rotinas_1.situacaoRotina)(d, r.horas), ultima: (d === null || d === void 0 ? void 0 : d.ultima) || null, ultimo_erro: (d === null || d === void 0 ? void 0 : d.ultimo_erro) || null, historico: ((d === null || d === void 0 ? void 0 : d.historico) || []).slice(0, 10) });
    });
    return {
        geradoEm: new Date().toISOString(),
        servicos: {
            banco: { ok: bancoOk, ms: bancoMs, erro: bancoErro || null },
            email: !!process.env.EMAIL_API_KEY,
            faturamento: !!(process.env.BILLING_BQ_PROJECT && process.env.BILLING_BQ_DATASET && process.env.BILLING_BQ_TABLE),
        },
        atividade: { ultima: ultimaAtividade, ultimas24h: atividade24h },
        rotinas,
        erros,
        arquivos,
        revisao: process.env.K_REVISION || null,
    };
});
//# sourceMappingURL=diagnostico.js.map