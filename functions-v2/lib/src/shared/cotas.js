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
exports.QUOTA_BY_KEY = exports.QUOTA_DEFS = void 0;
exports.limparCacheCotas = limparCacheCotas;
exports.lerCota = lerCota;
exports.exigirDentroDaCota = exigirDentroDaCota;
exports.limiteImportacao = limiteImportacao;
// Cotas da plataforma (platformConfig/quotas), definidas pelo super-admin em
// "Cotas e limites". Desde 17/11/2026 todas as cotas do catálogo VALEM: cada
// uma é conferida no servidor, na Function indicada em `onde`.
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
exports.QUOTA_DEFS = [
    {
        key: 'max_orgs_per_user',
        label: 'Órgãos criados por pessoa',
        description: 'Quantos órgãos uma mesma pessoa pode criar (como criadora). Super-admin não tem limite.',
        onde: 'Criar órgão',
        unit: 'órgãos',
        default: 10,
        min: 1,
        max: 1000,
    },
    {
        key: 'max_members_per_org',
        label: 'Membros por órgão',
        description: 'Quantas pessoas ativas cabem em um órgão. Ao chegar no limite, o código de convite para de aceitar entradas.',
        onde: 'Entrar por convite',
        unit: 'membros',
        default: 500,
        min: 2,
        max: 20000,
    },
    {
        key: 'max_import_rows',
        label: 'Linhas por importação',
        description: 'Máximo de linhas em uma importação de planilha. Nunca passa do teto técnico de cada importação (5.000 nos registros personalizados; 20.000 no Panorama e na Jurimetria).',
        onde: 'Importar planilha (registros personalizados, Panorama, Jurimetria)',
        unit: 'linhas',
        default: 20000,
        min: 100,
        max: 20000,
    },
];
exports.QUOTA_BY_KEY = Object.fromEntries(exports.QUOTA_DEFS.map((q) => [q.key, q]));
// ponytail: cache por instância de 60 s; uma cota alterada vale em até 1 minuto.
let cache = null;
function limparCacheCotas() { cache = null; }
/** Valor atual da cota (ou o padrão). */
async function lerCota(key, db = admin.firestore()) {
    var _a;
    const def = exports.QUOTA_BY_KEY[key];
    if (!def)
        throw new Error(`Cota desconhecida: ${key}`);
    if (!cache || Date.now() - cache.em > 60000) {
        const snap = await db.collection('platformConfig').doc('quotas').get();
        cache = { em: Date.now(), valores: ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.values) || {} };
    }
    const v = cache.valores[key];
    return typeof v === 'number' && v >= def.min && v <= def.max ? v : def.default;
}
/** Recusa quando `atual + somar` passa da cota. */
async function exigirDentroDaCota(key, atual, somar = 1, db = admin.firestore()) {
    const limite = await lerCota(key, db);
    if (atual + somar > limite) {
        const def = exports.QUOTA_BY_KEY[key];
        throw new https_1.HttpsError('resource-exhausted', `Limite da plataforma atingido: ${def.label.toLowerCase()} (máximo ${limite.toLocaleString('pt-BR')} ${def.unit}). Fale com a administração do SIGO.`);
    }
}
/** Limite de linhas de uma importação: a cota, sem passar do teto técnico dela. */
async function limiteImportacao(teto, db = admin.firestore()) {
    return Math.min(teto, await lerCota('max_import_rows', db));
}
//# sourceMappingURL=cotas.js.map