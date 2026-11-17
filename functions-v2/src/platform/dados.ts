import * as admin from 'firebase-admin';
import { Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';
import { googleApi, projeto, noEmulador, bancoApi } from '../shared/googleApi';

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
export const COLECOES_ORGAO = [
    'processes', 'expedientes', 'customRecords', 'entityTypes', 'parcerias', 'juris',
    'panoramaBases', 'panoramaRegistros', 'panoramaTemplates', 'userOrganizations',
    'secProcessos', 'secUnidades', 'secRitos', 'secTipos', 'secModelos', 'secUnidadeConfig', 'secConvitesEquipe',
    'auditLogs',
] as const;

/** Documentos de configuração com o id do órgão. */
const DOCS_ORGAO = ['organizations', 'secConfig'];

const RETENCOES = [7, 14, 30];
const TETO_BYTES = 6 * 1024 * 1024;

/** Converte valores do Firestore em JSON simples. Pura, exportada para teste. */
export function paraJson(v: unknown): unknown {
    if (v === null || v === undefined) return v ?? null;
    if (v instanceof Timestamp) return v.toDate().toISOString();
    if (v instanceof GeoPoint) return { lat: v.latitude, lng: v.longitude };
    if (v instanceof DocumentReference) return v.path;
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) return { base64: Buffer.from(v).toString('base64') };
    if (Array.isArray(v)) return v.map(paraJson);
    if (typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, paraJson(x)]));
    return v;
}

async function copias() {
    if (noEmulador() || !projeto()) return { disponivel: false as const };
    try {
        const [banco, agenda, lista] = await Promise.all([
            googleApi(bancoApi()),
            googleApi(`${bancoApi()}/backupSchedules`),
            googleApi(`https://firestore.googleapis.com/v1/projects/${projeto()}/locations/-/backups`).catch(() => ({ backups: [] })),
        ]);
        const agendas = (agenda.backupSchedules || []).map((s: any) => ({
            nome: s.name, diaria: !!s.dailyRecurrence, semanal: s.weeklyRecurrence?.day || null,
            retencaoDias: s.retention ? Math.round(parseInt(s.retention, 10) / 86400) : null, criada_em: s.createTime || null,
        }));
        const backups = (lista.backups || [])
            .filter((b: any) => String(b.database || '').endsWith('/databases/(default)'))
            .map((b: any) => ({ em: b.snapshotTime, expira: b.expireTime, estado: b.state, bytes: b.stats?.sizeBytes ? Number(b.stats.sizeBytes) : null }))
            .sort((a: any, b: any) => String(b.em).localeCompare(String(a.em)))
            .slice(0, 30);
        return {
            disponivel: true as const,
            local: banco.locationId || null,
            pitr: banco.pointInTimeRecoveryEnablement === 'POINT_IN_TIME_RECOVERY_ENABLED',
            protecao: banco.deleteProtectionState === 'DELETE_PROTECTION_ENABLED',
            agendas,
            backups,
        };
    } catch (e) {
        return { disponivel: false as const, erro: (e as Error).message.slice(0, 200) };
    }
}

const semPermissao = (e: unknown) => {
    const status = (e as { status?: number }).status;
    if (status === 403) throw new HttpsError('permission-denied', 'A conta de serviço das funções não tem permissão para isso. Faça pelo console, seguindo o passo a passo da tela.');
    throw new HttpsError('unavailable', `O Google Cloud recusou: ${(e as Error).message.slice(0, 200)}`);
};

async function exportarOrgao(db: admin.firestore.Firestore, orgId: string, colecao: string, cursor?: string) {
    if (colecao === '_docs') {
        const docs = await Promise.all(DOCS_ORGAO.map((c) => db.collection(c).doc(orgId).get()));
        return { itens: docs.filter((d) => d.exists).map((d) => ({ _colecao: d.ref.parent.id, _id: d.id, ...(paraJson(d.data()) as object) })), cursor: null };
    }
    if (!(COLECOES_ORGAO as readonly string[]).includes(colecao)) throw new HttpsError('invalid-argument', 'Coleção desconhecida.');
    let q = db.collection(colecao).where('organization_id', '==', orgId).orderBy('__name__').limit(200);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    const itens: unknown[] = [];
    let bytes = 0;
    let ultimo: string | null = null;
    for (const d of snap.docs) {
        const subs: Record<string, unknown[]> = {};
        for (const sub of await d.ref.listCollections()) {
            subs[sub.id] = (await sub.get()).docs.map((x) => ({ _id: x.id, ...(paraJson(x.data()) as object) }));
        }
        const item = { _id: d.id, ...(paraJson(d.data()) as object), ...(Object.keys(subs).length ? { _subcolecoes: subs } : {}) };
        bytes += JSON.stringify(item).length;
        itens.push(item);
        ultimo = d.id;
        // Resposta de função tem limite de tamanho: corta a página antes.
        if (bytes > TETO_BYTES) break;
    }
    const acabou = itens.length === snap.size && snap.size < 200;
    return { itens, cursor: acabou ? null : ultimo };
}

async function exportarPlataforma(db: admin.firestore.Firestore) {
    const [config, admins, rotinas] = await Promise.all([
        db.collection('platformConfig').get(),
        db.collection('platformAdmins').get(),
        db.collection('platformRoutines').get(),
    ]);
    const mapa = (s: admin.firestore.QuerySnapshot) => Object.fromEntries(s.docs.map((d) => [d.id, paraJson(d.data())]));
    const termos = await db.collection('platformConfig').doc('branding').collection('termosVersoes').get();
    return { platformConfig: mapa(config), termosVersoes: mapa(termos), platformAdmins: mapa(admins), platformRoutines: mapa(rotinas) };
}

interface Pedido { action?: string; retencaoDias?: number; organizationId?: string; colecao?: string; cursor?: string }

export const platformDados = onCall<Pedido>({ region: REGION, timeoutSeconds: 300, memory: '1GiB' }, async (request) => {
    const ator = await assertPlatformAdmin(request);
    const db = admin.firestore();
    const p = request.data || {};
    switch (p.action) {
        case 'copias':
            return { ...(await copias()), colecoesOrgao: ['_docs', ...COLECOES_ORGAO] };
        case 'ligarCopiaDiaria': {
            if (noEmulador()) throw new HttpsError('failed-precondition', 'Não disponível no ambiente de teste.');
            const dias = RETENCOES.includes(Number(p.retencaoDias)) ? Number(p.retencaoDias) : 14;
            const agenda = await googleApi(`${bancoApi()}/backupSchedules`).catch(semPermissao);
            if ((agenda.backupSchedules || []).some((s: any) => s.dailyRecurrence)) return { success: true, jaExistia: true };
            await googleApi(`${bancoApi()}/backupSchedules`, { corpo: { dailyRecurrence: {}, retention: `${dias * 86400}s` } }).catch(semPermissao);
            await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_BACKUP_SCHEDULED', { retencaoDias: dias });
            return { success: true };
        }
        case 'ligarProtecao':
            if (noEmulador()) throw new HttpsError('failed-precondition', 'Não disponível no ambiente de teste.');
            await googleApi(`${bancoApi()}?updateMask=deleteProtectionState`, { metodo: 'PATCH', corpo: { deleteProtectionState: 'DELETE_PROTECTION_ENABLED' } }).catch(semPermissao);
            await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_DELETE_PROTECTION_ON', {});
            return { success: true };
        case 'exportarOrgao': {
            const orgId = String(p.organizationId || '');
            if (!orgId || !(await db.collection('organizations').doc(orgId).get()).exists) throw new HttpsError('not-found', 'Órgão não encontrado.');
            const colecao = String(p.colecao || '');
            // Uma linha na auditoria por exportação (no início), não por página.
            if (colecao === '_docs') await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_ORG_EXPORTED', { organization_id: orgId });
            return exportarOrgao(db, orgId, colecao, p.cursor ? String(p.cursor) : undefined);
        }
        case 'exportarPlataforma': {
            const dados = await exportarPlataforma(db);
            await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_CONFIG_EXPORTED', {});
            return dados;
        }
        default:
            throw new HttpsError('invalid-argument', 'Ação desconhecida.');
    }
});
