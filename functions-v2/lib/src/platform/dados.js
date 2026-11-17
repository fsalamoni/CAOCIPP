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
exports.platformDados = exports.COLECOES_ORGAO = void 0;
exports.paraJson = paraJson;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const googleApi_1 = require("../shared/googleApi");
/**
 * platformDados — cópias de segurança do banco e exportação de dados (só
 * super-admin). Nada aqui apaga ou sobrescreve dado:
 *
 *  - copias:             agenda de cópia, proteção contra exclusão, PITR e as
 *                        cópias existentes (API de administração do Firestore).
 *  - ligarCopiaDiaria:   cria a agenda diária (retenção 7, 14 ou 30 dias) se
 *                        ainda não houver. Sem permissão, a tela mostra o
 *                        passo a passo do console.
 *  - ligarProtecao:      liga a proteção contra exclusão do banco (sem custo).
 *  - exportarOrgao:      uma página de uma coleção do órgão, com as
 *                        subcoleções de cada documento (um nível). A tela
 *                        chama coleção por coleção e monta um arquivo .json.
 *  - exportarPlataforma: configuração da plataforma em um arquivo .json.
 *
 * Restaurar uma cópia cria um banco NOVO no console; não é feito por aqui.
 */
/** Coleções com `organization_id` exportadas por órgão (as transitórias, como presença, ficam de fora). */
exports.COLECOES_ORGAO = [
    'processes', 'expedientes', 'customRecords', 'entityTypes', 'parcerias', 'juris',
    'panoramaBases', 'panoramaRegistros', 'panoramaTemplates', 'userOrganizations',
    'secProcessos', 'secUnidades', 'secRitos', 'secTipos', 'secModelos', 'secUnidadeConfig', 'secConvitesEquipe',
    'auditLogs',
];
/** Documentos de configuração com o id do órgão. */
const DOCS_ORGAO = ['organizations', 'secConfig'];
const RETENCOES = [7, 14, 30];
const TETO_BYTES = 6 * 1024 * 1024;
/** Converte valores do Firestore em JSON simples. Pura, exportada para teste. */
function paraJson(v) {
    if (v === null || v === undefined)
        return v !== null && v !== void 0 ? v : null;
    if (v instanceof firestore_1.Timestamp)
        return v.toDate().toISOString();
    if (v instanceof firestore_1.GeoPoint)
        return { lat: v.latitude, lng: v.longitude };
    if (v instanceof firestore_1.DocumentReference)
        return v.path;
    if (Buffer.isBuffer(v) || v instanceof Uint8Array)
        return { base64: Buffer.from(v).toString('base64') };
    if (Array.isArray(v))
        return v.map(paraJson);
    if (typeof v === 'object')
        return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, paraJson(x)]));
    return v;
}
async function copias() {
    if ((0, googleApi_1.noEmulador)() || !(0, googleApi_1.projeto)())
        return { disponivel: false };
    try {
        const [banco, agenda, lista] = await Promise.all([
            (0, googleApi_1.googleApi)((0, googleApi_1.bancoApi)()),
            (0, googleApi_1.googleApi)(`${(0, googleApi_1.bancoApi)()}/backupSchedules`),
            (0, googleApi_1.googleApi)(`https://firestore.googleapis.com/v1/projects/${(0, googleApi_1.projeto)()}/locations/-/backups`).catch(() => ({ backups: [] })),
        ]);
        const agendas = (agenda.backupSchedules || []).map((s) => {
            var _a;
            return ({
                nome: s.name, diaria: !!s.dailyRecurrence, semanal: ((_a = s.weeklyRecurrence) === null || _a === void 0 ? void 0 : _a.day) || null,
                retencaoDias: s.retention ? Math.round(parseInt(s.retention, 10) / 86400) : null, criada_em: s.createTime || null,
            });
        });
        const backups = (lista.backups || [])
            .filter((b) => String(b.database || '').endsWith('/databases/(default)'))
            .map((b) => { var _a; return ({ em: b.snapshotTime, expira: b.expireTime, estado: b.state, bytes: ((_a = b.stats) === null || _a === void 0 ? void 0 : _a.sizeBytes) ? Number(b.stats.sizeBytes) : null }); })
            .sort((a, b) => String(b.em).localeCompare(String(a.em)))
            .slice(0, 30);
        return {
            disponivel: true,
            local: banco.locationId || null,
            pitr: banco.pointInTimeRecoveryEnablement === 'POINT_IN_TIME_RECOVERY_ENABLED',
            protecao: banco.deleteProtectionState === 'DELETE_PROTECTION_ENABLED',
            agendas,
            backups,
        };
    }
    catch (e) {
        return { disponivel: false, erro: e.message.slice(0, 200) };
    }
}
const semPermissao = (e) => {
    const status = e.status;
    if (status === 403)
        throw new https_1.HttpsError('permission-denied', 'A conta de serviço das funções não tem permissão para isso. Faça pelo console, seguindo o passo a passo da tela.');
    throw new https_1.HttpsError('unavailable', `O Google Cloud recusou: ${e.message.slice(0, 200)}`);
};
async function exportarOrgao(db, orgId, colecao, cursor) {
    if (colecao === '_docs') {
        const docs = await Promise.all(DOCS_ORGAO.map((c) => db.collection(c).doc(orgId).get()));
        return { itens: docs.filter((d) => d.exists).map((d) => (Object.assign({ _colecao: d.ref.parent.id, _id: d.id }, paraJson(d.data())))), cursor: null };
    }
    if (!exports.COLECOES_ORGAO.includes(colecao))
        throw new https_1.HttpsError('invalid-argument', 'Coleção desconhecida.');
    let q = db.collection(colecao).where('organization_id', '==', orgId).orderBy('__name__').limit(200);
    if (cursor)
        q = q.startAfter(cursor);
    const snap = await q.get();
    const itens = [];
    let bytes = 0;
    let ultimo = null;
    for (const d of snap.docs) {
        const subs = {};
        for (const sub of await d.ref.listCollections()) {
            subs[sub.id] = (await sub.get()).docs.map((x) => (Object.assign({ _id: x.id }, paraJson(x.data()))));
        }
        const item = Object.assign(Object.assign({ _id: d.id }, paraJson(d.data())), (Object.keys(subs).length ? { _subcolecoes: subs } : {}));
        bytes += JSON.stringify(item).length;
        itens.push(item);
        ultimo = d.id;
        // Resposta de função tem limite de tamanho: corta a página antes.
        if (bytes > TETO_BYTES)
            break;
    }
    const acabou = itens.length === snap.size && snap.size < 200;
    return { itens, cursor: acabou ? null : ultimo };
}
async function exportarPlataforma(db) {
    const [config, admins, rotinas] = await Promise.all([
        db.collection('platformConfig').get(),
        db.collection('platformAdmins').get(),
        db.collection('platformRoutines').get(),
    ]);
    const mapa = (s) => Object.fromEntries(s.docs.map((d) => [d.id, paraJson(d.data())]));
    const termos = await db.collection('platformConfig').doc('branding').collection('termosVersoes').get();
    return { platformConfig: mapa(config), termosVersoes: mapa(termos), platformAdmins: mapa(admins), platformRoutines: mapa(rotinas) };
}
exports.platformDados = (0, https_1.onCall)({ region: helpers_1.REGION, timeoutSeconds: 300, memory: '1GiB' }, async (request) => {
    const ator = await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const p = request.data || {};
    switch (p.action) {
        case 'copias':
            return Object.assign(Object.assign({}, (await copias())), { colecoesOrgao: ['_docs', ...exports.COLECOES_ORGAO] });
        case 'ligarCopiaDiaria': {
            if ((0, googleApi_1.noEmulador)())
                throw new https_1.HttpsError('failed-precondition', 'Não disponível no ambiente de teste.');
            const dias = RETENCOES.includes(Number(p.retencaoDias)) ? Number(p.retencaoDias) : 14;
            const agenda = await (0, googleApi_1.googleApi)(`${(0, googleApi_1.bancoApi)()}/backupSchedules`).catch(semPermissao);
            if ((agenda.backupSchedules || []).some((s) => s.dailyRecurrence))
                return { success: true, jaExistia: true };
            await (0, googleApi_1.googleApi)(`${(0, googleApi_1.bancoApi)()}/backupSchedules`, { corpo: { dailyRecurrence: {}, retention: `${dias * 86400}s` } }).catch(semPermissao);
            await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_BACKUP_SCHEDULED', { retencaoDias: dias });
            return { success: true };
        }
        case 'ligarProtecao':
            if ((0, googleApi_1.noEmulador)())
                throw new https_1.HttpsError('failed-precondition', 'Não disponível no ambiente de teste.');
            await (0, googleApi_1.googleApi)(`${(0, googleApi_1.bancoApi)()}?updateMask=deleteProtectionState`, { metodo: 'PATCH', corpo: { deleteProtectionState: 'DELETE_PROTECTION_ENABLED' } }).catch(semPermissao);
            await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_DELETE_PROTECTION_ON', {});
            return { success: true };
        case 'exportarOrgao': {
            const orgId = String(p.organizationId || '');
            if (!orgId || !(await db.collection('organizations').doc(orgId).get()).exists)
                throw new https_1.HttpsError('not-found', 'Órgão não encontrado.');
            const colecao = String(p.colecao || '');
            // Uma linha na auditoria por exportação (no início), não por página.
            if (colecao === '_docs')
                await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_ORG_EXPORTED', { organization_id: orgId });
            return exportarOrgao(db, orgId, colecao, p.cursor ? String(p.cursor) : undefined);
        }
        case 'exportarPlataforma': {
            const dados = await exportarPlataforma(db);
            await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_CONFIG_EXPORTED', {});
            return dados;
        }
        default:
            throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida.');
    }
});
//# sourceMappingURL=dados.js.map