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
exports.getCostReport = void 0;
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
/**
 * getCostReport - Relatório de custos da plataforma.
 *
 * Fonte de custo (decisão do projeto): Cloud Billing exportado para BigQuery.
 * Quando o export estiver configurado (variáveis de ambiente abaixo), esta
 * função consulta os custos reais por serviço. Enquanto não estiver
 * configurado, retorna status "not_configured" com instruções, sem quebrar.
 *
 * Variáveis de ambiente esperadas:
 *   BILLING_BQ_PROJECT  - projeto que contém o dataset de billing
 *   BILLING_BQ_DATASET  - dataset do export de billing
 *   BILLING_BQ_TABLE    - tabela (ex.: gcp_billing_export_v1_XXXXXX)
 *
 * A consulta BigQuery é carregada dinamicamente para não exigir a dependência
 * em ambientes onde o billing ainda não foi habilitado.
 */
exports.getCostReport = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    var _a, _b;
    await (0, helpers_1.assertPlatformAdmin)(request);
    const project = process.env.BILLING_BQ_PROJECT;
    const dataset = process.env.BILLING_BQ_DATASET;
    const table = process.env.BILLING_BQ_TABLE;
    const days = Math.min(Math.max(((_a = request.data) === null || _a === void 0 ? void 0 : _a.days) || 30, 1), 365);
    if (!project || !dataset || !table) {
        return {
            status: 'not_configured',
            message: 'O export de faturamento para o BigQuery ainda não foi configurado. ' +
                'Configure o Cloud Billing export e defina BILLING_BQ_PROJECT, ' +
                'BILLING_BQ_DATASET e BILLING_BQ_TABLE para ver os custos reais.',
            byService: [],
            totalCost: 0,
            currency: null,
            periodDays: days,
        };
    }
    try {
        // Import dinâmico: só carrega a lib quando o billing está configurado.
        const { BigQuery } = await Promise.resolve().then(() => __importStar(require('@google-cloud/bigquery')));
        const bq = new BigQuery({ projectId: project });
        const query = `
                SELECT
                    service.description AS service,
                    SUM(cost) AS cost,
                    ANY_VALUE(currency) AS currency
                FROM \`${project}.${dataset}.${table}\`
                WHERE _PARTITIONTIME >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
                   OR usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
                GROUP BY service
                ORDER BY cost DESC
            `;
        const [rows] = await bq.query({
            query,
            params: { days },
        });
        const byService = rows.map((r) => {
            var _a, _b, _c;
            return ({
                service: String((_a = r.service) !== null && _a !== void 0 ? _a : 'Desconhecido'),
                cost: Number((_b = r.cost) !== null && _b !== void 0 ? _b : 0),
                currency: (_c = r.currency) !== null && _c !== void 0 ? _c : 'BRL',
            });
        });
        const totalCost = byService.reduce((sum, s) => sum + s.cost, 0);
        return {
            status: 'ok',
            byService,
            totalCost,
            currency: ((_b = byService[0]) === null || _b === void 0 ? void 0 : _b.currency) || 'BRL',
            periodDays: days,
        };
    }
    catch (error) {
        return {
            status: 'error',
            message: 'Não foi possível consultar os custos no BigQuery. Verifique as permissões e a configuração do export.',
            detail: error === null || error === void 0 ? void 0 : error.message,
            byService: [],
            totalCost: 0,
            currency: null,
            periodDays: days,
        };
    }
});
//# sourceMappingURL=costs.js.map