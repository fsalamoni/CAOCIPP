import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { MAX_TEXTO_LONGO, sanitizeRito, texto } from '../shared/secretaria';
import { COL, REGION, carregarContexto, erroUsuario, exigirAdmin, exigirAuth } from './context';

/**
 * Configuração da Secretaria Processual do órgão: ativação (pelo admin do
 * órgão), unidades com seus membros lotados, e ritos.
 */

const MAX_UNIDADES = 100;
const MAX_RITOS = 50;

const RITO_PADRAO = {
    nome: 'Rito comum',
    descricao: 'Rito inicial criado na ativação. Pode ser editado ou substituído.',
    fases: [
        { id: 'autuacao', nome: 'Autuação' },
        { id: 'instrucao', nome: 'Instrução' },
        { id: 'decisao', nome: 'Decisão' },
        { id: 'cumprimento', nome: 'Cumprimento' },
        { id: 'encerramento', nome: 'Encerramento' },
    ],
};

interface ConfigRequest {
    organizationId: string;
    action: 'estado' | 'ativar' | 'salvarUnidade' | 'salvarRito' | 'salvarPreferencias' | 'salvarTipo';
    tipo?: unknown;
    peticao_interrompe?: boolean;
    enabled?: boolean;
    id?: string;
    unidade?: { nome?: string; sigla?: string; tipo?: string; membros_uids?: unknown; ativa?: boolean };
    rito?: unknown;
    ativo?: boolean;
}

export const secretariaConfig = onCall<ConfigRequest>({ region: REGION }, async (request) => {
    const auth = exigirAuth(request);
    const p = request.data || ({} as ConfigRequest);
    const c = await carregarContexto(auth, p.organizationId, { permitirInativa: true });
    const { db, orgId } = c;
    const enabled = c.org.secretariaConfig?.enabled === true;
    const agora = FieldValue.serverTimestamp();

    if (p.action === 'estado') {
        if (!enabled && !c.ctx.isAdmin) return { enabled: false, isAdmin: false };
        const [ritosSnap, tiposSnap] = await Promise.all([
            db.collection(COL.ritos).where('organization_id', '==', orgId).get(),
            db.collection(COL.tipos).where('organization_id', '==', orgId).get(),
        ]);
        let membros: Array<{ uid: string; nome: string; email: string }> = [];
        // Todo usuário lotado precisa ver os nomes de colegas para atribuir
        // processos; e-mail só para quem administra.
        const memSnap = await db.collection('userOrganizations').where('organization_id', '==', orgId).get();
        membros = memSnap.docs.map((d) => {
            const m = d.data();
            return {
                uid: String(m.user_id || d.id.split('_')[0]),
                nome: String(m.user_name || m.user_email || 'Membro'),
                email: c.ctx.isAdmin ? String(m.user_email || '') : '',
            };
        });
        return {
            enabled,
            peticao_interrompe: c.org.secretariaConfig?.peticao_interrompe === true,
            isAdmin: c.ctx.isAdmin,
            uid: c.ctx.uid,
            minhasUnidades: c.ctx.unidadeIds,
            unidades: c.unidades.map((u) => ({
                id: u.id, nome: u.nome, sigla: u.sigla, tipo: u.tipo,
                ativa: u.ativa !== false, membros_uids: u.membros_uids || [],
            })),
            ritos: ritosSnap.docs.map((d) => {
                const r = d.data();
                return { id: d.id, nome: r.nome, descricao: r.descricao, fases: r.fases, versao: r.versao, ativo: r.ativo !== false };
            }),
            tipos: tiposSnap.docs.map((d) => {
                const t = d.data();
                return {
                    id: d.id, nome: t.nome, sigla: t.sigla || '', descricao: t.descricao || '', rito_id: t.rito_id,
                    sigilo_padrao: t.sigilo_padrao || 'normal', unidade_inicial: t.unidade_inicial || null, ativo: t.ativo !== false,
                };
            }).sort((a, b) => a.nome.localeCompare(b.nome)),
            membros,
        };
    }

    exigirAdmin(c);

    if (p.action === 'ativar') {
        const ligar = p.enabled === true;
        await db.collection('organizations').doc(orgId).update({
            'secretariaConfig.enabled': ligar,
            'secretariaConfig.updated_at': agora,
            'secretariaConfig.updated_by': auth.uid,
        });
        // Primeira ativação: deixa o órgão pronto para autuar, com uma
        // secretaria (o admin lotado nela) e um rito comum. Nada é criado se
        // já existir unidade ou rito.
        if (ligar && c.unidades.length === 0) {
            await db.collection(COL.unidades).add({
                organization_id: orgId, nome: 'Secretaria', sigla: 'SEC', tipo: 'secretaria',
                membros_uids: [auth.uid], ativa: true, created_at: agora, created_by: auth.uid,
            });
        }
        const temRito = !(await db.collection(COL.ritos).where('organization_id', '==', orgId).limit(1).get()).empty;
        if (ligar && !temRito) {
            await db.collection(COL.ritos).add({
                organization_id: orgId, ...RITO_PADRAO, versao: 1, ativo: true, created_at: agora, created_by: auth.uid,
            });
        }
        await auditar(db, orgId, auth.uid, c.userName, ligar ? 'SECRETARIA_ATIVADA' : 'SECRETARIA_DESATIVADA', {});
        return { success: true, enabled: ligar };
    }

    if (p.action === 'salvarPreferencias') {
        const interrompe = p.peticao_interrompe === true;
        await db.collection('organizations').doc(orgId).update({
            'secretariaConfig.peticao_interrompe': interrompe,
            'secretariaConfig.updated_at': agora,
            'secretariaConfig.updated_by': auth.uid,
        });
        await auditar(db, orgId, auth.uid, c.userName, 'SECRETARIA_PREFERENCIAS', { peticao_interrompe: interrompe });
        return { success: true };
    }

    if (p.action === 'salvarUnidade') {
        const u = p.unidade || {};
        const nome = texto(u.nome);
        if (!nome) throw new HttpsError('invalid-argument', 'A unidade precisa de um nome');
        const tipo = u.tipo === 'gabinete' ? 'gabinete' : 'secretaria';
        const membrosIn = Array.isArray(u.membros_uids) ? u.membros_uids.filter((x): x is string => typeof x === 'string') : [];
        const membros = [...new Set(membrosIn)].slice(0, 200);
        // Só membros do órgão podem ser lotados.
        if (membros.length) {
            const refs = membros.map((uid) => db.collection('userOrganizations').doc(`${uid}_${orgId}`));
            const snaps = await db.getAll(...refs);
            const fora = snaps.filter((s) => !s.exists).length;
            if (fora) throw new HttpsError('invalid-argument', `${fora} pessoa(s) não são membros do órgão`);
        }
        const dados = {
            nome, sigla: texto(u.sigla, 20), tipo, membros_uids: membros, ativa: u.ativa !== false,
            updated_at: agora, updated_by: auth.uid,
        };
        if (p.id) {
            const atual = c.unidades.find((x) => x.id === p.id);
            if (!atual) throw new HttpsError('not-found', 'Unidade não encontrada');
            await db.collection(COL.unidades).doc(p.id).update(dados);
        } else {
            if (c.unidades.length >= MAX_UNIDADES) throw new HttpsError('resource-exhausted', 'Limite de unidades atingido');
            const ref = await db.collection(COL.unidades).add({ ...dados, organization_id: orgId, created_at: agora, created_by: auth.uid });
            p.id = ref.id;
        }
        await auditar(db, orgId, auth.uid, c.userName, 'SECRETARIA_UNIDADE_SALVA', { unidade_id: p.id, nome, membros: membros.length });
        return { success: true, id: p.id };
    }

    if (p.action === 'salvarRito') {
        let rito;
        try { rito = sanitizeRito(p.rito); } catch (e) { erroUsuario(e); }
        const col = db.collection(COL.ritos);
        if (p.id) {
            const ref = col.doc(p.id);
            const snap = await ref.get();
            if (!snap.exists || snap.data()?.organization_id !== orgId) throw new HttpsError('not-found', 'Rito não encontrado');
            // Processos guardam a cópia das fases com que foram autuados; mudar
            // o rito só vale para os próximos.
            await ref.update({ ...rito, ativo: p.ativo !== false, versao: (Number(snap.data()?.versao) || 1) + 1, updated_at: agora, updated_by: auth.uid });
        } else {
            const qtd = (await col.where('organization_id', '==', orgId).get()).size;
            if (qtd >= MAX_RITOS) throw new HttpsError('resource-exhausted', 'Limite de ritos atingido');
            const ref = await col.add({ ...rito, organization_id: orgId, versao: 1, ativo: true, created_at: agora, created_by: auth.uid });
            p.id = ref.id;
        }
        await auditar(db, orgId, auth.uid, c.userName, 'SECRETARIA_RITO_SALVO', { rito_id: p.id, nome: rito!.nome });
        return { success: true, id: p.id };
    }

    if (p.action === 'salvarTipo') {
        const t = (p.tipo && typeof p.tipo === 'object' ? p.tipo : {}) as Record<string, unknown>;
        const nome = texto(t.nome);
        if (!nome) throw new HttpsError('invalid-argument', 'Dê um nome ao tipo de processo');
        const rito = (await db.collection(COL.ritos).doc(String(t.rito_id || '_')).get()).data();
        if (!rito || rito.organization_id !== orgId) throw new HttpsError('invalid-argument', 'Escolha o rito do tipo de processo');
        const unidadeInicial = String(t.unidade_inicial || '');
        if (unidadeInicial && !c.unidades.some((u) => u.id === unidadeInicial)) throw new HttpsError('invalid-argument', 'Unidade inicial inválida');
        const dados = {
            nome, sigla: texto(t.sigla, 12), descricao: texto(t.descricao, MAX_TEXTO_LONGO), rito_id: String(t.rito_id),
            sigilo_padrao: t.sigilo_padrao === 'restrito' ? 'restrito' : 'normal', unidade_inicial: unidadeInicial || null,
            ativo: t.ativo !== false, updated_at: agora, updated_by: auth.uid,
        };
        const col = db.collection(COL.tipos);
        if (p.id) {
            const ref = col.doc(p.id);
            if ((await ref.get()).data()?.organization_id !== orgId) throw new HttpsError('not-found', 'Tipo não encontrado');
            await ref.update(dados);
        } else {
            if ((await col.where('organization_id', '==', orgId).get()).size >= MAX_RITOS) throw new HttpsError('resource-exhausted', 'Limite de tipos atingido');
            p.id = (await col.add({ ...dados, organization_id: orgId, created_at: agora, created_by: auth.uid })).id;
        }
        await auditar(db, orgId, auth.uid, c.userName, 'SECRETARIA_TIPO_SALVO', { tipo_id: p.id, nome });
        return { success: true, id: p.id };
    }

    throw new HttpsError('invalid-argument', 'Ação desconhecida');
});

export async function auditar(
    db: admin.firestore.Firestore, orgId: string, uid: string, nome: string,
    action: string, details: Record<string, unknown>
) {
    await db.collection('auditLogs').add({
        organization_id: orgId, user_id: uid, user_name: nome, action,
        details,
        timestamp: FieldValue.serverTimestamp(),
    });
}
