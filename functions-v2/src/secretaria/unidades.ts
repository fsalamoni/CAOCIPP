import * as admin from 'firebase-admin';
import { createHash, randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { Lotacao, lotacoesDe, sanitizeLotacoes, texto, tipoUnidade } from '../shared/secretaria';
import { formatPersonName } from '../shared/normalization';
import { sendEmail } from '../shared/email';
import { COL, Contexto, erroUsuario, exigirAdmin, exigirGestor } from './context';
import { APP_URL } from './autos';
import { sanitizeDocumentoConfig } from './documentoConfig';

/**
 * Unidades de lotação do Processo Eletrônico: dados, equipe (lotações com
 * atribuição e gestão), convites, pedidos de lotação e papel timbrado/tipos
 * de documento próprios. O admin do órgão faz tudo; o gestor da unidade
 * cuida da equipe, do timbrado e dos modelos dela.
 */

const MAX_UNIDADES = 100;
const MAX_PEDIDOS = 50;
const CONVITE_DIAS = 7;
const escapar = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

type Payload = Record<string, unknown> & { id?: string; unidadeId?: string };

/** Confere que todas as pessoas são membros ativos do órgão. */
async function exigirMembros(c: Contexto, uids: string[]) {
    if (!uids.length) return;
    const snaps = await c.db.getAll(...uids.map((uid) => c.db.collection('userOrganizations').doc(`${uid}_${c.orgId}`)));
    const fora = snaps.filter((s) => !s.exists || s.data()?.active === false).length;
    if (fora) throw new HttpsError('invalid-argument', `${fora} pessoa(s) não são membros ativos do órgão`);
}

/** Campos a gravar quando as lotações mudam (membros_uids segue em sincronia). */
const camposLotacao = (lotacoes: Lotacao[]) => ({ lotacoes, membros_uids: lotacoes.map((l) => l.uid) });

export async function salvarUnidade(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    const u = (p.unidade && typeof p.unidade === 'object' ? p.unidade : {}) as Record<string, unknown>;
    const lotacoes = sanitizeLotacoes(u.lotacoes ?? (Array.isArray(u.membros_uids) ? u.membros_uids.map((x) => ({ uid: x })) : []));
    await exigirMembros(c, lotacoes.map((l) => l.uid));
    const agora = FieldValue.serverTimestamp();
    if (p.id) {
        const atual = exigirGestor(c, p.id);
        // O gestor (sem ser admin) cuida da equipe e da descrição; nome, tipo
        // e ativação são do admin do órgão.
        const dados: Record<string, unknown> = c.ctx.isAdmin
            ? { nome: texto(u.nome) || atual.nome, sigla: texto(u.sigla, 20), tipo: tipoUnidade(u.tipo), ativa: u.ativa !== false }
            : {};
        if (c.ctx.isAdmin && !texto(u.nome)) throw new HttpsError('invalid-argument', 'A unidade precisa de um nome');
        // Gestor não tira a própria gestão (evita unidade sem ninguém que a gerencie por engano).
        if (!c.ctx.isAdmin && !lotacoes.some((l) => l.uid === uid && l.gestor)) {
            throw new HttpsError('failed-precondition', 'Você não pode tirar a sua própria gestão da unidade; peça ao admin do órgão');
        }
        await c.db.collection(COL.unidades).doc(atual.id).update({
            ...dados, descricao: texto(u.descricao, 500), ...camposLotacao(lotacoes), updated_at: agora, updated_by: uid,
        });
        await auditar('SECRETARIA_UNIDADE_SALVA', { unidade_id: atual.id, nome: dados.nome || atual.nome, lotacoes: lotacoes.length });
        return { success: true, id: atual.id };
    }
    exigirAdmin(c);
    const nome = texto(u.nome);
    if (!nome) throw new HttpsError('invalid-argument', 'A unidade precisa de um nome');
    if (c.unidades.length >= MAX_UNIDADES) throw new HttpsError('resource-exhausted', 'Limite de unidades atingido');
    const ref = await c.db.collection(COL.unidades).add({
        organization_id: c.orgId, nome, sigla: texto(u.sigla, 20), tipo: tipoUnidade(u.tipo), descricao: texto(u.descricao, 500),
        ativa: u.ativa !== false, ...camposLotacao(lotacoes), pedidos: [], created_at: agora, created_by: uid,
    });
    await auditar('SECRETARIA_UNIDADE_SALVA', { unidade_id: ref.id, nome, lotacoes: lotacoes.length });
    return { success: true, id: ref.id };
}

export async function obterUnidadeDocumento(c: Contexto, p: Payload) {
    const u = exigirGestor(c, p.unidadeId);
    const d = (await c.db.collection(COL.unidadeConfig).doc(u.id).get()).data() || {};
    return {
        timbrado_proprio: d.timbrado_proprio === true,
        documento: d.documento ? sanitizeDocumentoConfig(d.documento, { semTiposPadrao: true }) : null,
        tipos_documento: Array.isArray(d.tipos_documento) ? d.tipos_documento : [],
    };
}

export async function salvarUnidadeDocumento(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    const u = exigirGestor(c, p.unidadeId);
    let documento = null;
    try {
        documento = p.documento ? sanitizeDocumentoConfig(p.documento, { semTiposPadrao: true }) : null;
    } catch (e) { erroUsuario(e); }
    const tipos = [...new Set((Array.isArray(p.tipos_documento) ? p.tipos_documento : []).map((t) => texto(t, 60)).filter(Boolean))].slice(0, 60);
    const proprio = p.timbrado_proprio === true && !!documento;
    await c.db.collection(COL.unidadeConfig).doc(u.id).set({
        organization_id: c.orgId, unidade_id: u.id, timbrado_proprio: proprio,
        documento: documento ? { ...documento, tipos_documento: [] } : null,
        tipos_documento: tipos, updated_at: FieldValue.serverTimestamp(), updated_by: uid,
    });
    await auditar('SECRETARIA_UNIDADE_DOCUMENTO', { unidade_id: u.id, timbrado_proprio: proprio, tipos: tipos.length });
    return { success: true };
}

export async function convidarEquipe(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    const u = exigirGestor(c, p.unidadeId);
    const email = texto(p.email, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Informe um e-mail válido');
    const token = randomBytes(24).toString('base64url');
    const hash = hashToken(token);
    const expira = new Date(Date.now() + CONVITE_DIAS * 86400000).toISOString();
    await c.db.collection(COL.convitesEquipe).doc(hash).set({
        organization_id: c.orgId, unidade_id: u.id, unidade_nome: u.nome, email,
        atribuicao: texto(p.atribuicao, 80), gestor: p.gestor === true,
        expira_em: expira, criado_por: uid, criado_por_nome: c.userName, criado_em: FieldValue.serverTimestamp(), usado_por: null, revogado: false,
    });
    const link = `${APP_URL}/ProcessoEletronico?equipe=${token}`;
    const orgao = String(c.org.name || '');
    const enviado = await sendEmail({
        to: email,
        subject: `Convite para a equipe de ${u.nome} (${orgao})`,
        html: `<p>Olá.</p><p>${escapar(c.userName)} convidou você para a unidade <b>${escapar(String(u.nome))}</b> do Processo Eletrônico de <b>${escapar(orgao)}</b>${p.atribuicao ? `, com a atribuição <b>${escapar(texto(p.atribuicao, 80))}</b>` : ''}.</p><p><a href="${link}">Aceitar o convite</a> (vale por ${CONVITE_DIAS} dias). Entre com a conta Google deste e-mail.</p><p>Se você não esperava este e-mail, ignore-o.</p>`,
    }).catch(() => false);
    await auditar('SECRETARIA_EQUIPE_CONVITE', { unidade_id: u.id, email });
    return { success: true, link, emailEnviado: enviado, expira_em: expira };
}

export async function revogarConviteEquipe(c: Contexto, p: Payload, auditar: Auditar) {
    const ref = c.db.collection(COL.convitesEquipe).doc(texto(p.id, 80) || '_');
    const d = (await ref.get()).data();
    if (!d || d.organization_id !== c.orgId) throw new HttpsError('not-found', 'Convite não encontrado');
    exigirGestor(c, d.unidade_id);
    await ref.update({ revogado: true });
    await auditar('SECRETARIA_EQUIPE_CONVITE_REVOGADO', { unidade_id: d.unidade_id, email: d.email });
    return { success: true };
}

/** Convites pendentes das unidades que a pessoa gere (todas, para o admin). */
export async function convitesPendentes(c: Contexto) {
    if (!c.ctx.isAdmin && !c.gestorDe.length) return [];
    const snap = await c.db.collection(COL.convitesEquipe).where('organization_id', '==', c.orgId).get();
    const agora = new Date().toISOString();
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
        .filter((d) => !d.usado_por && !d.revogado && String(d.expira_em) > agora)
        .filter((d) => c.ctx.isAdmin || c.gestorDe.includes(String(d.unidade_id)))
        .map((d) => ({ id: d.id, unidade_id: d.unidade_id, email: d.email, atribuicao: d.atribuicao || '', gestor: d.gestor === true, expira_em: d.expira_em }));
}

/** Membro do órgão pede para ser lotado numa unidade; a gestão admite ou recusa. */
export async function pedirLotacao(c: Contexto, p: Payload, uid: string, email: string) {
    const ref = c.db.collection(COL.unidades).doc(String(p.unidadeId || '_'));
    await c.db.runTransaction(async (tx) => {
        const u = (await tx.get(ref)).data();
        if (!u || u.organization_id !== c.orgId || u.ativa === false) throw new HttpsError('not-found', 'Unidade não encontrada');
        if (lotacoesDe(u).some((l) => l.uid === uid)) throw new HttpsError('already-exists', 'Você já está lotado nesta unidade');
        const pedidos = (Array.isArray(u.pedidos) ? u.pedidos : []).filter((x: { uid: string }) => x.uid !== uid);
        if (pedidos.length >= MAX_PEDIDOS) throw new HttpsError('resource-exhausted', 'A unidade tem pedidos demais em aberto');
        pedidos.push({ uid, nome: c.userName, email, mensagem: texto(p.mensagem, 300), em: new Date().toISOString() });
        tx.update(ref, { pedidos });
    });
    return { success: true };
}

export async function decidirPedido(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    const u0 = exigirGestor(c, p.unidadeId);
    const alvo = texto(p.uid, 128);
    const admitir = p.admitir === true;
    if (admitir) await exigirMembros(c, [alvo]);
    const ref = c.db.collection(COL.unidades).doc(u0.id);
    await c.db.runTransaction(async (tx) => {
        const u = (await tx.get(ref)).data() || {};
        const pedidos = (Array.isArray(u.pedidos) ? u.pedidos : []) as Array<{ uid: string }>;
        if (!pedidos.some((x) => x.uid === alvo)) throw new HttpsError('not-found', 'Pedido não encontrado');
        const lotacoes = lotacoesDe(u);
        if (admitir && !lotacoes.some((l) => l.uid === alvo)) {
            lotacoes.push({ uid: alvo, atribuicao: texto(p.atribuicao, 80), gestor: false });
        }
        tx.update(ref, { pedidos: pedidos.filter((x) => x.uid !== alvo), ...camposLotacao(lotacoes), updated_at: FieldValue.serverTimestamp(), updated_by: uid });
    });
    await auditar(admitir ? 'SECRETARIA_LOTACAO_ADMITIDA' : 'SECRETARIA_LOTACAO_RECUSADA', { unidade_id: u0.id, uid: alvo });
    return { success: true };
}

/** Prévia do convite (antes do aceite): órgão, unidade e validade. */
export async function verConviteEquipe(token: unknown) {
    const d = (await admin.firestore().collection(COL.convitesEquipe).doc(hashToken(String(token || ''))).get()).data();
    if (!d) throw new HttpsError('not-found', 'Convite não encontrado');
    const org = (await admin.firestore().collection('organizations').doc(d.organization_id).get()).data() || {};
    const valido = !d.usado_por && !d.revogado && String(d.expira_em) > new Date().toISOString();
    return {
        valido, orgao: String(org.name || ''), organizationId: d.organization_id, unidade: d.unidade_nome, email: d.email,
        atribuicao: d.atribuicao || '', convidado_por: d.criado_por_nome || '', expira_em: d.expira_em, usado: !!d.usado_por,
    };
}

/**
 * Aceite do convite de equipe: cria (ou reativa) o vínculo com o órgão e
 * lota a pessoa na unidade. Exige a conta do e-mail convidado.
 */
export async function aceitarConviteEquipe(auth: { uid: string; token: Record<string, unknown> }, token: unknown) {
    const db = admin.firestore();
    const ref = db.collection(COL.convitesEquipe).doc(hashToken(String(token || '')));
    const email = String(auth.token.email || '').toLowerCase();
    const nome = formatPersonName(String(auth.token.name || '')) || email;
    const r = await db.runTransaction(async (tx) => {
        const d = (await tx.get(ref)).data();
        if (!d) throw new HttpsError('not-found', 'Convite não encontrado');
        if (d.usado_por || d.revogado || String(d.expira_em) <= new Date().toISOString()) {
            throw new HttpsError('failed-precondition', 'Este convite já foi usado, foi revogado ou expirou. Peça um novo.');
        }
        if (!email || email !== d.email) {
            throw new HttpsError('permission-denied', `Este convite é para ${d.email}. Entre com a conta desse e-mail.`);
        }
        const orgId = d.organization_id as string;
        const unRef = db.collection(COL.unidades).doc(d.unidade_id);
        const memRef = db.collection('userOrganizations').doc(`${auth.uid}_${orgId}`);
        const [un, mem, perfil] = await Promise.all([tx.get(unRef), tx.get(memRef), tx.get(db.collection('users').doc(auth.uid))]);
        const u = un.data();
        if (!u || u.ativa === false) throw new HttpsError('failed-precondition', 'A unidade do convite não está mais ativa');
        const funcao = String(perfil.data()?.function || '').trim() || 'Membro';
        if (!mem.exists) {
            tx.set(memRef, {
                id: `${auth.uid}_${orgId}`, user_id: auth.uid, organization_id: orgId, user_email: email, user_name: nome,
                role: 'member', function: funcao, active: true, joined_at: FieldValue.serverTimestamp(), via: 'convite_equipe',
            });
            tx.update(db.collection('organizations').doc(orgId), { 'stats.members_count': FieldValue.increment(1) });
        } else if (mem.data()?.active === false) {
            tx.update(memRef, { active: true, role: 'member', joined_at: FieldValue.serverTimestamp(), left_at: FieldValue.delete() });
            tx.update(db.collection('organizations').doc(orgId), { 'stats.members_count': FieldValue.increment(1) });
        }
        const lotacoes = lotacoesDe(u).filter((l) => l.uid !== auth.uid);
        lotacoes.push({ uid: auth.uid, atribuicao: String(d.atribuicao || ''), gestor: d.gestor === true });
        const pedidos = (Array.isArray(u.pedidos) ? u.pedidos : []).filter((x: { uid: string }) => x.uid !== auth.uid);
        tx.update(unRef, { ...camposLotacao(lotacoes), pedidos });
        tx.update(ref, { usado_por: auth.uid, usado_em: FieldValue.serverTimestamp() });
        return { orgId, unidade: String(u.nome) };
    });
    await db.collection('auditLogs').add({
        organization_id: r.orgId, user_id: auth.uid, user_name: nome, action: 'SECRETARIA_EQUIPE_CONVITE_ACEITO',
        details: { unidade: r.unidade }, timestamp: FieldValue.serverTimestamp(),
    });
    return { success: true, organizationId: r.orgId, unidade: r.unidade };
}

export type Auditar = (action: string, details: Record<string, unknown>) => Promise<void>;
