"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verificarUsoDiario = exports.platformUso = exports.COTA_GRATIS = void 0;
exports.somarPorDia = somarPorDia;
exports.limitesPassados = limitesPassados;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const helpers_1 = require("./helpers");
const googleApi_1 = require("../shared/googleApi");
const rotinas_1 = require("../shared/rotinas");
const email_1 = require("../shared/email");
/**
 * Uso e custos da plataforma (só super-admin).
 *
 *  - platformUso painel: operações do banco por dia (30 dias, Cloud
 *    Monitoring) contra a cota gratuita diária do Firestore, chamadas às
 *    funções do SIGO por dia, atividade de cada órgão em 30 dias e o alerta.
 *  - platformUso salvarAlerta: limites diários de leituras e gravações; a
 *    rotina `verificarUsoDiario` (6h) avisa por e-mail os super-admins quando
 *    o dia anterior passou de um deles.
 *
 * O banco é o (default) do projeto, compartilhado com outros apps: os números
 * do banco incluem o uso deles. O custo em reais vem do faturamento
 * (getCostReport), quando a exportação para o BigQuery estiver ligada.
 */
/** Cota gratuita diária do Firestore (por projeto, banco default). */
exports.COTA_GRATIS = { leituras: 50000, escritas: 20000, exclusoes: 20000 };
const DIA = 86400;
/** Junta as séries diárias do Monitoring por data (aaaa-mm-dd, em UTC). Pura, exportada para teste. */
function somarPorDia(series) {
    var _a, _b, _c, _d, _e, _f;
    const m = new Map();
    for (const s of series || []) {
        for (const p of s.points || []) {
            const dia = String(((_a = p.interval) === null || _a === void 0 ? void 0 : _a.endTime) || ((_b = p.interval) === null || _b === void 0 ? void 0 : _b.startTime) || '').slice(0, 10);
            if (!dia)
                continue;
            const v = Number((_f = (_d = (_c = p.value) === null || _c === void 0 ? void 0 : _c.int64Value) !== null && _d !== void 0 ? _d : (_e = p.value) === null || _e === void 0 ? void 0 : _e.doubleValue) !== null && _f !== void 0 ? _f : 0);
            m.set(dia, (m.get(dia) || 0) + v);
        }
    }
    return m;
}
/** Quais limites o dia passou. Pura, exportada para teste. */
function limitesPassados(d, alerta) {
    const fora = [];
    if (alerta.leiturasDia && d.leituras > alerta.leiturasDia)
        fora.push(`leituras: ${d.leituras} (limite ${alerta.leiturasDia})`);
    if (alerta.escritasDia && d.escritas > alerta.escritasDia)
        fora.push(`gravações: ${d.escritas} (limite ${alerta.escritasDia})`);
    return fora;
}
async function serieDiaria(metrica, filtroExtra, dias, groupBy) {
    const fim = new Date();
    const ini = new Date(fim.getTime() - dias * DIA * 1000);
    const q = new URLSearchParams({
        filter: `metric.type="${metrica}"${filtroExtra}`,
        'interval.startTime': ini.toISOString(),
        'interval.endTime': fim.toISOString(),
        'aggregation.alignmentPeriod': `${DIA}s`,
        'aggregation.perSeriesAligner': 'ALIGN_SUM',
        'aggregation.crossSeriesReducer': 'REDUCE_SUM',
    });
    if (groupBy)
        q.append('aggregation.groupByFields', groupBy);
    const r = await (0, googleApi_1.googleApi)(`https://monitoring.googleapis.com/v3/projects/${(0, googleApi_1.projeto)()}/timeSeries?${q}`);
    return (r.timeSeries || []);
}
async function usoDoBanco(dias) {
    if ((0, googleApi_1.noEmulador)() || !(0, googleApi_1.projeto)())
        return null;
    try {
        const filtro = ' AND resource.labels.database_id="(default)"';
        const [l, e, x] = await Promise.all([
            serieDiaria('firestore.googleapis.com/document/read_count', filtro, dias),
            serieDiaria('firestore.googleapis.com/document/write_count', filtro, dias),
            serieDiaria('firestore.googleapis.com/document/delete_count', filtro, dias),
        ].map((p) => p.then(somarPorDia)));
        const datas = [...new Set([...l.keys(), ...e.keys(), ...x.keys()])].sort();
        return datas.map((dia) => ({ dia, leituras: l.get(dia) || 0, escritas: e.get(dia) || 0, exclusoes: x.get(dia) || 0 }));
    }
    catch (err) {
        console.warn('platformUso: banco indisponível', err.message);
        return null;
    }
}
async function chamadasDasFuncoes(dias) {
    if ((0, googleApi_1.noEmulador)() || !(0, googleApi_1.projeto)())
        return null;
    try {
        const nossas = new Set(Object.keys(require('../index')).map((n) => n.toLowerCase()));
        const series = await serieDiaria('run.googleapis.com/request_count', ' AND resource.type="cloud_run_revision"', dias, 'resource.labels.service_name');
        const so = series.filter((s) => { var _a, _b; return nossas.has(String(((_b = (_a = s.resource) === null || _a === void 0 ? void 0 : _a.labels) === null || _b === void 0 ? void 0 : _b.service_name) || '').toLowerCase()); });
        return [...somarPorDia(so).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, chamadas]) => ({ dia, chamadas }));
    }
    catch (err) {
        console.warn('platformUso: funções indisponíveis', err.message);
        return null;
    }
}
async function usoPorOrgao(db) {
    const desde = firestore_1.Timestamp.fromMillis(Date.now() - 30 * DIA * 1000);
    const orgs = await db.collection('organizations').select('name', 'stats').limit(500).get();
    const linhas = await Promise.all(orgs.docs.map(async (o) => {
        const [acoes, membros] = await Promise.all([
            db.collection('auditLogs').where('organization_id', '==', o.id).where('timestamp', '>=', desde).count().get().then((s) => s.data().count).catch(() => null),
            db.collection('userOrganizations').where('organization_id', '==', o.id).count().get().then((s) => s.data().count).catch(() => null),
        ]);
        return { id: o.id, nome: String(o.get('name') || 'Sem nome'), acoes30d: acoes, membros };
    }));
    return linhas.sort((a, b) => (b.acoes30d || 0) - (a.acoes30d || 0));
}
const lerAlerta = async (db) => (await db.collection('platformConfig').doc('custos').get()).data() || {};
exports.platformUso = (0, https_1.onCall)({ region: helpers_1.REGION, timeoutSeconds: 120 }, async (request) => {
    const ator = await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const p = request.data || {};
    if (p.action === 'salvarAlerta') {
        const num = (v, campo) => {
            if (v === undefined || v === null || v === '')
                return 0;
            const n = Math.round(Number(v));
            if (!Number.isFinite(n) || n < 0 || n > 1e9)
                throw new https_1.HttpsError('invalid-argument', `${campo}: use um número entre 0 e 1 bilhão.`);
            return n;
        };
        const alerta = { ativo: p.ativo !== false, leiturasDia: num(p.leiturasDia, 'Leituras por dia'), escritasDia: num(p.escritasDia, 'Gravações por dia') };
        await db.collection('platformConfig').doc('custos').set({ alerta: Object.assign(Object.assign({}, alerta), { por: ator.name, em: firestore_1.FieldValue.serverTimestamp() }) }, { merge: true });
        await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_USAGE_ALERT_SET', alerta);
        return { success: true };
    }
    if (p.action !== 'painel')
        throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida.');
    const [banco, funcoes, orgaos, cfg] = await Promise.all([usoDoBanco(30), chamadasDasFuncoes(30), usoPorOrgao(db), lerAlerta(db)]);
    const iso = (v) => ((v === null || v === void 0 ? void 0 : v.toDate) ? v.toDate().toISOString() : null);
    return {
        geradoEm: new Date().toISOString(),
        cotaGratis: exports.COTA_GRATIS,
        banco,
        funcoes,
        orgaos,
        alerta: cfg.alerta ? { ativo: cfg.alerta.ativo !== false, leiturasDia: cfg.alerta.leiturasDia || 0, escritasDia: cfg.alerta.escritasDia || 0, por: cfg.alerta.por || null, em: iso(cfg.alerta.em) } : null,
        ultimoAviso: cfg.ultimo_aviso ? Object.assign(Object.assign({}, cfg.ultimo_aviso), { em: iso(cfg.ultimo_aviso.em) }) : null,
    };
});
/** Todo dia às 6h: o dia anterior passou de algum limite? Avisa os super-admins por e-mail. */
exports.verificarUsoDiario = (0, scheduler_1.onSchedule)({ schedule: 'every day 06:00', timeZone: 'America/Sao_Paulo', region: helpers_1.REGION }, (0, rotinas_1.comRegistro)('verificarUsoDiario', async () => {
    const db = admin.firestore();
    const cfg = await lerAlerta(db);
    const alerta = cfg.alerta;
    if (!alerta || alerta.ativo === false || (!alerta.leiturasDia && !alerta.escritasDia))
        return;
    const dias = await usoDoBanco(3);
    if (!dias)
        throw new Error('Cloud Monitoring indisponível: uso do banco não lido.');
    const ontem = new Date(Date.now() - DIA * 1000).toISOString().slice(0, 10);
    const d = dias.find((x) => x.dia === ontem) || dias[dias.length - 1];
    if (!d)
        return;
    const fora = limitesPassados(d, alerta);
    if (!fora.length)
        return;
    const admins = await db.collection('platformAdmins').where('active', '==', true).get();
    const emails = admins.docs.map((a) => String(a.get('email') || '')).filter(Boolean);
    const html = `<p>O banco do SIGO passou do limite de uso em ${d.dia}:</p><ul>${fora.map((f) => `<li>${f}</li>`).join('')}</ul><p>Veja os detalhes em Administração da plataforma, Custos e uso. O banco é compartilhado com outros apps do mesmo projeto.</p>`;
    for (const to of emails)
        await (0, email_1.sendEmail)({ to, subject: 'SIGO: uso do banco acima do limite', html }).catch(() => false);
    await db.collection('platformConfig').doc('custos').set({ ultimo_aviso: { dia: d.dia, fora, em: firestore_1.FieldValue.serverTimestamp(), para: emails.length } }, { merge: true });
}));
//# sourceMappingURL=uso.js.map