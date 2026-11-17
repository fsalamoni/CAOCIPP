import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';
import { googleApi, projeto, noEmulador } from '../shared/googleApi';
import { comRegistro } from '../shared/rotinas';
import { sendEmail } from '../shared/email';

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
export const COTA_GRATIS = { leituras: 50000, escritas: 20000, exclusoes: 20000 };

const DIA = 86400;

export interface Dia { dia: string; leituras: number; escritas: number; exclusoes: number }

/** Junta as séries diárias do Monitoring por data (aaaa-mm-dd, em UTC). Pura, exportada para teste. */
export function somarPorDia(series: any[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const s of series || []) {
        for (const p of s.points || []) {
            const dia = String(p.interval?.endTime || p.interval?.startTime || '').slice(0, 10);
            if (!dia) continue;
            const v = Number(p.value?.int64Value ?? p.value?.doubleValue ?? 0);
            m.set(dia, (m.get(dia) || 0) + v);
        }
    }
    return m;
}

/** Quais limites o dia passou. Pura, exportada para teste. */
export function limitesPassados(d: Pick<Dia, 'leituras' | 'escritas'>, alerta: { leiturasDia?: number; escritasDia?: number }) {
    const fora: string[] = [];
    if (alerta.leiturasDia && d.leituras > alerta.leiturasDia) fora.push(`leituras: ${d.leituras} (limite ${alerta.leiturasDia})`);
    if (alerta.escritasDia && d.escritas > alerta.escritasDia) fora.push(`gravações: ${d.escritas} (limite ${alerta.escritasDia})`);
    return fora;
}

async function serieDiaria(metrica: string, filtroExtra: string, dias: number, groupBy?: string) {
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
    if (groupBy) q.append('aggregation.groupByFields', groupBy);
    const r = await googleApi(`https://monitoring.googleapis.com/v3/projects/${projeto()}/timeSeries?${q}`);
    return (r.timeSeries || []) as any[];
}

async function usoDoBanco(dias: number): Promise<Dia[] | null> {
    if (noEmulador() || !projeto()) return null;
    try {
        const filtro = ' AND resource.labels.database_id="(default)"';
        const [l, e, x] = await Promise.all([
            serieDiaria('firestore.googleapis.com/document/read_count', filtro, dias),
            serieDiaria('firestore.googleapis.com/document/write_count', filtro, dias),
            serieDiaria('firestore.googleapis.com/document/delete_count', filtro, dias),
        ].map((p) => p.then(somarPorDia)));
        const datas = [...new Set([...l.keys(), ...e.keys(), ...x.keys()])].sort();
        return datas.map((dia) => ({ dia, leituras: l.get(dia) || 0, escritas: e.get(dia) || 0, exclusoes: x.get(dia) || 0 }));
    } catch (err) {
        console.warn('platformUso: banco indisponível', (err as Error).message);
        return null;
    }
}

async function chamadasDasFuncoes(dias: number): Promise<{ dia: string; chamadas: number }[] | null> {
    if (noEmulador() || !projeto()) return null;
    try {
        const nossas = new Set(Object.keys(require('../index')).map((n) => n.toLowerCase()));
        const series = await serieDiaria('run.googleapis.com/request_count', ' AND resource.type="cloud_run_revision"', dias, 'resource.labels.service_name');
        const so = series.filter((s) => nossas.has(String(s.resource?.labels?.service_name || '').toLowerCase()));
        return [...somarPorDia(so).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([dia, chamadas]) => ({ dia, chamadas }));
    } catch (err) {
        console.warn('platformUso: funções indisponíveis', (err as Error).message);
        return null;
    }
}

async function usoPorOrgao(db: admin.firestore.Firestore) {
    const desde = Timestamp.fromMillis(Date.now() - 30 * DIA * 1000);
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

const lerAlerta = async (db: admin.firestore.Firestore) => (await db.collection('platformConfig').doc('custos').get()).data() || {};

interface Pedido { action?: string; leiturasDia?: number; escritasDia?: number; ativo?: boolean }

export const platformUso = onCall<Pedido>({ region: REGION, timeoutSeconds: 120 }, async (request) => {
    const ator = await assertPlatformAdmin(request);
    const db = admin.firestore();
    const p = request.data || {};
    if (p.action === 'salvarAlerta') {
        const num = (v: unknown, campo: string) => {
            if (v === undefined || v === null || v === '') return 0;
            const n = Math.round(Number(v));
            if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new HttpsError('invalid-argument', `${campo}: use um número entre 0 e 1 bilhão.`);
            return n;
        };
        const alerta = { ativo: p.ativo !== false, leiturasDia: num(p.leiturasDia, 'Leituras por dia'), escritasDia: num(p.escritasDia, 'Gravações por dia') };
        await db.collection('platformConfig').doc('custos').set({ alerta: { ...alerta, por: ator.name, em: FieldValue.serverTimestamp() } }, { merge: true });
        await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_USAGE_ALERT_SET', alerta);
        return { success: true };
    }
    if (p.action !== 'painel') throw new HttpsError('invalid-argument', 'Ação desconhecida.');
    const [banco, funcoes, orgaos, cfg] = await Promise.all([usoDoBanco(30), chamadasDasFuncoes(30), usoPorOrgao(db), lerAlerta(db)]);
    const iso = (v: any) => (v?.toDate ? v.toDate().toISOString() : null);
    return {
        geradoEm: new Date().toISOString(),
        cotaGratis: COTA_GRATIS,
        banco,
        funcoes,
        orgaos,
        alerta: cfg.alerta ? { ativo: cfg.alerta.ativo !== false, leiturasDia: cfg.alerta.leiturasDia || 0, escritasDia: cfg.alerta.escritasDia || 0, por: cfg.alerta.por || null, em: iso(cfg.alerta.em) } : null,
        ultimoAviso: cfg.ultimo_aviso ? { ...cfg.ultimo_aviso, em: iso(cfg.ultimo_aviso.em) } : null,
    };
});

/** Todo dia às 6h: o dia anterior passou de algum limite? Avisa os super-admins por e-mail. */
export const verificarUsoDiario = onSchedule(
    { schedule: 'every day 06:00', timeZone: 'America/Sao_Paulo', region: REGION },
    comRegistro('verificarUsoDiario', async () => {
        const db = admin.firestore();
        const cfg = await lerAlerta(db);
        const alerta = cfg.alerta;
        if (!alerta || alerta.ativo === false || (!alerta.leiturasDia && !alerta.escritasDia)) return;
        const dias = await usoDoBanco(3);
        if (!dias) throw new Error('Cloud Monitoring indisponível: uso do banco não lido.');
        const ontem = new Date(Date.now() - DIA * 1000).toISOString().slice(0, 10);
        const d = dias.find((x) => x.dia === ontem) || dias[dias.length - 1];
        if (!d) return;
        const fora = limitesPassados(d, alerta);
        if (!fora.length) return;
        const admins = await db.collection('platformAdmins').where('active', '==', true).get();
        const emails = admins.docs.map((a) => String(a.get('email') || '')).filter(Boolean);
        const html = `<p>O banco do SIGO passou do limite de uso em ${d.dia}:</p><ul>${fora.map((f) => `<li>${f}</li>`).join('')}</ul><p>Veja os detalhes em Administração da plataforma, Custos e uso. O banco é compartilhado com outros apps do mesmo projeto.</p>`;
        for (const to of emails) await sendEmail({ to, subject: 'SIGO: uso do banco acima do limite', html }).catch(() => false);
        await db.collection('platformConfig').doc('custos').set({ ultimo_aviso: { dia: d.dia, fora, em: FieldValue.serverTimestamp(), para: emails.length } }, { merge: true });
    })
);
