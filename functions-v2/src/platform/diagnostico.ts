import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin } from './helpers';
import { ROTINAS, situacaoRotina } from '../shared/rotinas';
import { googleApi, projeto, noEmulador } from '../shared/googleApi';

/**
 * platformDiagnostico — diagnóstico e saúde da plataforma (só super-admin,
 * só leitura). Substitui o antigo getSystemHealth, que adivinhava erros pelo
 * nome das ações da auditoria.
 *
 *  - rotinas agendadas: última execução, duração, falha e atraso
 *    (platformRoutines, gravado por comRegistro em cada onSchedule);
 *  - erros reais das Functions do SIGO nas últimas 24 h, lidos do Cloud
 *    Logging e agrupados por função (o projeto é compartilhado: só entram as
 *    funções exportadas por este código);
 *  - serviços: banco (com tempo de resposta), chave de e-mail, faturamento;
 *  - arquivos: espaço e quantidade no bucket (Cloud Monitoring; o bucket é
 *    do projeto, então inclui os outros apps);
 *  - revisão das Functions no ar.
 * Fontes externas que falham viram `null` ("não disponível"), sem derrubar o resto.
 */

export interface GrupoErro { funcao: string; quantidade: number; ultima_em: string; ultima_mensagem: string }

/** Agrupa entradas do Cloud Logging pelas funções do SIGO. Pura, exportada para teste. */
export function agruparErros(entradas: any[], funcoes: Set<string>): GrupoErro[] {
    const grupos = new Map<string, GrupoErro>();
    for (const e of entradas) {
        const servico = String(e?.resource?.labels?.service_name || e?.resource?.labels?.function_name || '').toLowerCase();
        if (!funcoes.has(servico)) continue;
        const msg = String(e.textPayload || e.jsonPayload?.message || e.protoPayload?.status?.message || 'Erro sem mensagem').trim().slice(0, 300);
        const g = grupos.get(servico);
        if (!g) grupos.set(servico, { funcao: servico, quantidade: 1, ultima_em: e.timestamp, ultima_mensagem: msg });
        else {
            g.quantidade += 1;
            if (e.timestamp > g.ultima_em) { g.ultima_em = e.timestamp; g.ultima_mensagem = msg; }
        }
    }
    return [...grupos.values()].sort((a, b) => b.quantidade - a.quantidade || b.ultima_em.localeCompare(a.ultima_em));
}

async function lerErros(): Promise<{ grupos: GrupoErro[]; total: number; truncado: boolean } | null> {
    if (noEmulador() || !projeto()) return null;
    try {
        // Nomes dos serviços no Cloud Run = nome exportado em minúsculas.
        const funcoes = new Set(Object.keys(require('../index')).map((n) => n.toLowerCase()));
        const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const r = await googleApi('https://logging.googleapis.com/v2/entries:list', { corpo: {
            resourceNames: [`projects/${projeto()}`],
            filter: `severity>=ERROR AND timestamp>="${desde}" AND (resource.type="cloud_run_revision" OR resource.type="cloud_function")`,
            orderBy: 'timestamp desc',
            pageSize: 500,
        } });
        const grupos = agruparErros(r.entries || [], funcoes);
        return { grupos, total: grupos.reduce((s, g) => s + g.quantidade, 0), truncado: !!r.nextPageToken };
    } catch (e) {
        console.warn('platformDiagnostico: logging indisponível', (e as Error).message);
        return null;
    }
}

async function lerArquivos(): Promise<{ bytes: number; objetos: number | null; bucket: string } | null> {
    if (noEmulador() || !projeto()) return null;
    try {
        const bucket = admin.storage().bucket().name;
        const fim = new Date();
        const ini = new Date(fim.getTime() - 2 * 24 * 3600 * 1000);
        const serie = async (metrica: string) => {
            const q = new URLSearchParams({
                filter: `metric.type="storage.googleapis.com/storage/${metrica}" AND resource.labels.bucket_name="${bucket}"`,
                'interval.startTime': ini.toISOString(),
                'interval.endTime': fim.toISOString(),
            });
            const r = await googleApi(`https://monitoring.googleapis.com/v3/projects/${projeto()}/timeSeries?${q}`);
            // Uma série por classe de armazenamento; o ponto mais novo vem primeiro.
            return (r.timeSeries || []).reduce((s: number, t: any) => s + Number(t.points?.[0]?.value?.doubleValue ?? t.points?.[0]?.value?.int64Value ?? 0), 0);
        };
        const [bytes, objetos] = await Promise.all([serie('total_bytes'), serie('object_count').catch(() => null)]);
        return { bytes, objetos, bucket };
    } catch (e) {
        console.warn('platformDiagnostico: monitoring indisponível', (e as Error).message);
        return null;
    }
}

export const platformDiagnostico = onCall<{ action?: string }>({ region: REGION, timeoutSeconds: 60 }, async (request) => {
    await assertPlatformAdmin(request);
    if ((request.data?.action || 'painel') !== 'painel') throw new HttpsError('invalid-argument', 'Ação desconhecida.');
    const db = admin.firestore();

    const t0 = Date.now();
    let bancoOk = true;
    let bancoErro = '';
    try { await db.collection('platformConfig').doc('featureFlags').get(); } catch (e) { bancoOk = false; bancoErro = (e as Error).message; }
    const bancoMs = Date.now() - t0;

    const [rotinasSnap, erros, arquivos, ultimaAtividade, atividade24h] = await Promise.all([
        db.collection('platformRoutines').get().catch(() => null),
        lerErros(),
        lerArquivos(),
        db.collection('auditLogs').orderBy('timestamp', 'desc').limit(1).get().then((s) => s.docs[0]?.data()?.timestamp?.toDate?.()?.toISOString() || null).catch(() => null),
        db.collection('auditLogs').where('timestamp', '>=', Timestamp.fromMillis(Date.now() - 24 * 3600 * 1000)).count().get().then((s) => s.data().count).catch(() => null),
    ]);

    const docs = new Map((rotinasSnap?.docs || []).map((d) => [d.id, d.data()]));
    const rotinas = Object.entries(ROTINAS).map(([chave, r]) => {
        const d: any = docs.get(chave);
        return {
            chave, ...r,
            situacao: situacaoRotina(d, r.horas),
            ultima: d?.ultima || null,
            ultimo_erro: d?.ultimo_erro || null,
            historico: (d?.historico || []).slice(0, 10),
        };
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
