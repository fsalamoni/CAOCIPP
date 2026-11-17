import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';
import { orgSuspensa } from '../shared/vinculo';

/**
 * platformOrg — ficha e controles de um órgão pela administração da plataforma.
 *
 * Ações (todas só super-admin, todas auditadas no auditLogs com scope platform
 * e também no órgão):
 *  - ficha:        dados, situação, membros, volumes e atividade recente.
 *  - suspender:    bloqueia o acesso de todos ao órgão (motivo obrigatório).
 *                  Grava platform_suspension no órgão e org_suspended nos
 *                  vínculos; as regras e as Functions leem o vínculo. O
 *                  Processo Eletrônico também sai do ar, inclusive no Portal.
 *  - reativar:     desfaz a suspensão. Nenhum dado é apagado em nenhum caso.
 *  - trocarCriador: passa o papel de criador a um membro ativo; o criador
 *                  anterior, se ainda ativo, vira administrador.
 */

type Acao = 'ficha' | 'suspender' | 'reativar' | 'trocarCriador';
interface Pedido { action?: Acao; organizationId?: string; motivo?: string; novoCriadorUid?: string }

const iso = (v: unknown): string | null =>
    v && typeof (v as admin.firestore.Timestamp).toDate === 'function'
        ? (v as admin.firestore.Timestamp).toDate().toISOString()
        : typeof v === 'string' ? v : null;

async function contar(q: admin.firestore.Query): Promise<number | null> {
    try { return (await q.count().get()).data().count; } catch { return null; }
}

/** Atualiza todos os vínculos do órgão em lotes (limite de 500 por lote). */
// O membro não lê mais o órgão, então nome e motivo vão no próprio vínculo
// para a tela explicar o que houve.
async function marcarVinculos(db: admin.firestore.Firestore, orgId: string, suspensao: { nome: string; motivo: string } | null): Promise<number> {
    const snap = await db.collection('userOrganizations').where('organization_id', '==', orgId).get();
    const apagar = FieldValue.delete();
    const campos = suspensao
        ? { org_suspended: true, org_suspended_nome: suspensao.nome, org_suspended_motivo: suspensao.motivo }
        : { org_suspended: apagar, org_suspended_nome: apagar, org_suspended_motivo: apagar };
    for (let i = 0; i < snap.docs.length; i += 450) {
        const lote = db.batch();
        snap.docs.slice(i, i + 450).forEach((d) => lote.update(d.ref, campos));
        await lote.commit();
    }
    return snap.size;
}

async function auditarNoOrgao(db: admin.firestore.Firestore, orgId: string, ator: { uid: string; name: string }, action: string, details: Record<string, unknown>) {
    await db.collection('auditLogs').add({
        organization_id: orgId, user_id: ator.uid, user_name: ator.name, action, details,
        scope: 'platform', timestamp: FieldValue.serverTimestamp(),
    });
}

export const platformOrg = onCall<Pedido>({ region: REGION }, async (request) => {
    const ator = await assertPlatformAdmin(request);
    const db = admin.firestore();
    const p = request.data || {};
    const orgId = String(p.organizationId || '').trim();
    if (!orgId || orgId.includes('/')) throw new HttpsError('invalid-argument', 'Informe o órgão.');
    const orgRef = db.collection('organizations').doc(orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) throw new HttpsError('not-found', 'Órgão não encontrado.');
    const org = orgSnap.data() || {};

    if (p.action === 'ficha') {
        const porOrg = (col: string) => db.collection(col).where('organization_id', '==', orgId);
        const [vinculos, processos, expedientes, parcerias, juris, pe, bases, atividade] = await Promise.all([
            porOrg('userOrganizations').get(),
            contar(porOrg('processes')),
            contar(porOrg('expedientes')),
            contar(porOrg('parcerias')),
            contar(porOrg('juris')),
            contar(porOrg('secProcessos')),
            contar(porOrg('panoramaBases')),
            porOrg('auditLogs').orderBy('timestamp', 'desc').limit(15).get().catch(() => null),
        ]);
        const membros = vinculos.docs.map((d) => {
            const m = d.data();
            return {
                uid: String(m.user_id || ''),
                nome: String(m.user_name || ''),
                email: String(m.user_email || ''),
                papel: String(m.role || 'member'),
                funcao: String(m.function || ''),
                ativo: m.active !== false,
                entrou_em: iso(m.joined_at),
                saiu_em: iso(m.left_at),
                atribuicoes: Object.values(m.permissions || {}).filter((v) => v === true).length,
            };
        }).sort((a, b) => Number(b.ativo) - Number(a.ativo) || (a.papel === 'creator' ? -1 : b.papel === 'creator' ? 1 : 0) || a.nome.localeCompare(b.nome, 'pt-BR'));
        const sc = org.secretariaConfig || {};
        const susp = org.platform_suspension || {};
        return {
            id: orgId,
            nome: String(org.name || 'Sem nome'),
            descricao: String(org.description || ''),
            contato: org.contactInfo || {},
            criado_em: iso(org.created_at),
            criado_por: org.created_by ? String(org.created_by) : null,
            suspensao: orgSuspensa(org)
                ? { motivo: String(susp.motivo || ''), em: iso(susp.em), por: String(susp.por_nome || '') }
                : null,
            processo_eletronico: { ligado: sc.enabled === true, suspenso: sc.suspensa_plataforma === true, motivo: String(sc.motivo_suspensao || '') },
            modulos: org.moduleConfig && typeof org.moduleConfig === 'object'
                ? Object.fromEntries(Object.entries(org.moduleConfig).map(([k, v]) => [k, (v as { enabled?: boolean })?.enabled === true]))
                : null,
            volumes: { processos, expedientes, parcerias, juris, processos_eletronicos: pe, bases_panorama: bases },
            membros,
            atividade: (atividade?.docs || []).map((d) => {
                const a = d.data();
                return { id: d.id, acao: String(a.action || ''), quem: String(a.user_name || ''), quando: iso(a.timestamp), plataforma: a.scope === 'platform' };
            }),
        };
    }

    if (p.action === 'suspender') {
        const motivo = String(p.motivo || '').trim().slice(0, 300);
        if (motivo.length < 5) throw new HttpsError('invalid-argument', 'Explique o motivo da suspensão (ao menos 5 caracteres). Os membros verão esse texto.');
        if (orgSuspensa(org)) throw new HttpsError('failed-precondition', 'O órgão já está suspenso.');
        await orgRef.update({
            platform_suspension: { ativa: true, motivo, em: FieldValue.serverTimestamp(), por_uid: ator.uid, por_nome: ator.name },
        });
        const vinculos = await marcarVinculos(db, orgId, { nome: String(org.name || ''), motivo });
        await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_ORG_SUSPENDED', { organization_id: orgId, motivo, vinculos });
        await auditarNoOrgao(db, orgId, ator, 'ORG_SUSPENSO_PLATAFORMA', { motivo });
        return { success: true, vinculos };
    }

    if (p.action === 'reativar') {
        if (!orgSuspensa(org)) throw new HttpsError('failed-precondition', 'O órgão não está suspenso.');
        await orgRef.update({ platform_suspension: FieldValue.delete() });
        const vinculos = await marcarVinculos(db, orgId, null);
        await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_ORG_REACTIVATED', { organization_id: orgId, vinculos });
        await auditarNoOrgao(db, orgId, ator, 'ORG_REATIVADO_PLATAFORMA', {});
        return { success: true, vinculos };
    }

    if (p.action === 'trocarCriador') {
        const novo = String(p.novoCriadorUid || '').trim();
        if (!novo || novo.includes('/')) throw new HttpsError('invalid-argument', 'Escolha o novo criador.');
        const novoRef = db.collection('userOrganizations').doc(`${novo}_${orgId}`);
        const anteriores = await db.collection('userOrganizations')
            .where('organization_id', '==', orgId).where('role', '==', 'creator').get();
        const resultado = await db.runTransaction(async (t) => {
            const n = await t.get(novoRef);
            if (!n.exists || n.data()?.active === false) throw new HttpsError('failed-precondition', 'O novo criador precisa ser membro ativo do órgão.');
            if (n.data()?.role === 'creator') throw new HttpsError('failed-precondition', 'Essa pessoa já é a criadora do órgão.');
            const rebaixados: string[] = [];
            for (const a of anteriores.docs) {
                if (a.id === novoRef.id) continue;
                // Criador anterior ainda ativo continua no órgão como administrador.
                t.update(a.ref, { role: a.data().active === false ? 'member' : 'admin' });
                rebaixados.push(String(a.data().user_id || ''));
            }
            t.update(novoRef, { role: 'creator' });
            t.update(orgRef, { created_by: novo, creator_changed_at: FieldValue.serverTimestamp() });
            return { rebaixados, nome: String(n.data()?.user_name || '') };
        });
        await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_ORG_CREATOR_CHANGED', { organization_id: orgId, novo_criador: novo, anteriores: resultado.rebaixados });
        await auditarNoOrgao(db, orgId, ator, 'CRIADOR_TROCADO_PLATAFORMA', { novo_criador: novo, novo_nome: resultado.nome });
        return { success: true };
    }

    throw new HttpsError('invalid-argument', 'Ação desconhecida.');
});
