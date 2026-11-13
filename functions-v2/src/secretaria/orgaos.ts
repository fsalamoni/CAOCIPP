import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { Orgao, conferirDelegado, orgaosAdministrados, orgaosDe, sanitizeOrgao, sanitizeProposta, validarEstrutura } from '../shared/orgaos';
import { COL, Contexto, erroUsuario, exigirAdmin } from './context';

/**
 * Órgãos internos da entidade, guardados em `secConfig/{orgId}.orgaos` (uma
 * lista pequena, validada inteira a cada gravação). As unidades apontam para o
 * órgão por `orgao_id`; sem órgãos, a entidade é singular e nada muda.
 */

type Auditar = (action: string, details: Record<string, unknown>) => Promise<void>;
type Payload = Record<string, unknown> & { id?: string };
const MAX_UNIDADES = 100;
const novoId = () => `org_${randomBytes(6).toString('hex')}`;

export async function lerOrgaos(db: admin.firestore.Firestore, orgId: string, tx?: admin.firestore.Transaction): Promise<Orgao[]> {
    const ref = db.collection(COL.config).doc(orgId);
    return orgaosDe((tx ? await tx.get(ref) : await ref.get()).data()?.orgaos);
}

async function exigirMembro(c: Contexto, uid: string | null, papel = 'O titular') {
    if (!uid) return;
    const s = await c.db.collection('userOrganizations').doc(`${uid}_${c.orgId}`).get();
    if (!s.exists || s.data()?.active === false) throw new HttpsError('invalid-argument', `${papel} precisa ser membro ativo`);
}

/** Regrava a lista de órgãos dentro de uma transação, validando a estrutura inteira. */
async function mudar(c: Contexto, uid: string, fn: (atuais: Orgao[]) => Orgao[]): Promise<Orgao[]> {
    const ref = c.db.collection(COL.config).doc(c.orgId);
    return c.db.runTransaction(async (tx) => {
        let lista: Orgao[] = [];
        try { lista = validarEstrutura(fn(orgaosDe((await tx.get(ref)).data()?.orgaos))); } catch (e) { erroUsuario(e); }
        tx.set(ref, { organization_id: c.orgId, orgaos: lista, updated_at: FieldValue.serverTimestamp(), updated_by: uid }, { merge: true });
        return lista;
    });
}

/**
 * Cria ou edita um órgão interno. O admin da entidade mexe em tudo; o admin
 * delegado, só no que administra (conferirDelegado, dentro da transação).
 */
export async function salvarOrgao(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    if (!c.ctx.isAdmin && !(c.adminOrgaos || []).length) exigirAdmin(c);
    const id = p.id ? String(p.id) : novoId();
    let orgao: Orgao;
    try { orgao = sanitizeOrgao(p.orgao, id); } catch (e) { erroUsuario(e); }
    await exigirMembro(c, orgao!.titular_uid);
    for (const a of orgao!.admins_uids) await exigirMembro(c, a, 'Quem administra o órgão');
    await mudar(c, uid, (atuais) => {
        const i = atuais.findIndex((o) => o.id === id);
        if (p.id && i < 0) throw new HttpsError('not-found', 'Órgão não encontrado');
        if (!c.ctx.isAdmin) conferirDelegado(atuais, uid, orgao);
        if (i < 0) return [...atuais, { ...orgao, ordem: atuais.length, criado_por: uid }];
        return atuais.map((o) => (o.id === id ? { ...orgao, criado_por: o.criado_por || null } : o));
    });
    await auditar('SECRETARIA_ORGAO_SALVO', { orgao_id: id, nome: orgao!.nome, superior: orgao!.pai_id, admins: orgao!.admins_uids.length });
    return { success: true, id };
}

/**
 * Exclui o órgão interno. O que estava nele (unidades, órgãos subordinados,
 * tipos de processo e modelos) passa para `destino`: outro órgão ou, vazio,
 * direto na entidade. Nada se apaga e os processos seguem nas mesmas unidades.
 * O admin exclui qualquer órgão; quem o criou, só o vazio; o admin delegado,
 * os que ficam abaixo do órgão que lhe foi delegado, levando o conteúdo para
 * outro órgão que administra.
 */
export async function removerOrgao(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    const id = String(p.id || '');
    const destino = p.destino ? String(p.destino) : null;
    const unidades = c.unidades.filter((u) => u.orgao_id === id);
    let nome = '';
    let subordinados = 0;
    await mudar(c, uid, (atuais) => {
        const alvo = atuais.find((o) => o.id === id);
        if (!alvo) throw new HttpsError('not-found', 'Órgão não encontrado');
        const meus = c.ctx.isAdmin ? [] : orgaosAdministrados(atuais, uid);
        // Delegado: o órgão fica abaixo de um que ele administra, e o conteúdo vai para outro que administra.
        const delegado = !!alvo.pai_id && meus.includes(alvo.pai_id);
        if (delegado && !(destino && meus.includes(destino))) throw new HttpsError('invalid-argument', 'Escolha como destino um órgão que você administra');
        if (!c.ctx.isAdmin && !delegado && alvo.criado_por !== uid) throw new HttpsError('permission-denied', 'Só o admin do órgão ou quem criou este órgão interno pode excluí-lo');
        subordinados = atuais.filter((o) => o.pai_id === id).length;
        if ((unidades.length || subordinados) && !c.ctx.isAdmin && !delegado) {
            throw new HttpsError('permission-denied', 'Este órgão tem unidades ou órgãos subordinados. Só o admin do órgão pode excluí-lo, levando-os para outro lugar.');
        }
        if (destino && (destino === id || !atuais.some((o) => o.id === destino))) throw new HttpsError('invalid-argument', 'Escolha um destino válido');
        // Destino abaixo do próprio órgão criaria um ciclo na árvore.
        for (let o = atuais.find((x) => x.id === destino); o; o = atuais.find((x) => x.id === o!.pai_id)) {
            if (o.pai_id === id) throw new HttpsError('invalid-argument', 'O destino não pode ser um órgão subordinado a este');
        }
        nome = alvo.nome;
        return atuais.filter((o) => o.id !== id).map((o) => (o.pai_id === id ? { ...o, pai_id: destino } : o));
    });
    const [tipos, modelos] = await Promise.all([
        c.db.collection(COL.tipos).where('organization_id', '==', c.orgId).where('orgao_id', '==', id).get(),
        c.db.collection(COL.modelos).where('organization_id', '==', c.orgId).where('orgao_id', '==', id).get(),
    ]);
    const refs = [...unidades.map((u) => c.db.collection(COL.unidades).doc(u.id)), ...tipos.docs.map((d) => d.ref), ...modelos.docs.map((d) => d.ref)];
    for (let i = 0; i < refs.length; i += 400) {
        const lote = c.db.batch();
        refs.slice(i, i + 400).forEach((r) => lote.update(r, { orgao_id: destino }));
        await lote.commit();
    }
    await auditar('SECRETARIA_ORGAO_REMOVIDO', { orgao_id: id, nome, destino, unidades: unidades.length, subordinados, tipos: tipos.size, modelos: modelos.size });
    return { success: true, unidades: unidades.length, subordinados };
}

/** Assistente: cria de uma vez vários órgãos (somados aos que existem) e as unidades de cada um. */
export async function criarEstrutura(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    exigirAdmin(c);
    let proposta: ReturnType<typeof sanitizeProposta> = [];
    try { proposta = sanitizeProposta(p.orgaos); } catch (e) { erroUsuario(e); }
    const ids = new Map(proposta.map((o) => [o.chave, novoId()]));
    const totalUnidades = proposta.reduce((n, o) => n + o.unidades.length, 0);
    if (c.unidades.length + totalUnidades > MAX_UNIDADES) throw new HttpsError('resource-exhausted', 'Limite de unidades atingido');
    let criados: Orgao[] = [];
    await mudar(c, uid, (atuais) => {
        criados = proposta.map((o, i) => {
            // O superior pode ser outro órgão da proposta (pela chave) ou um já existente (pelo id).
            const pai = o.pai_chave ? ids.get(o.pai_chave) || (atuais.some((a) => a.id === o.pai_chave) ? o.pai_chave : null) : null;
            if (o.pai_chave && !pai) throw new Error(`O órgão superior de "${String(o.orgao.nome || '')}" não existe`);
            return { ...sanitizeOrgao({ ...o.orgao, titular_uid: null, pai_id: pai }, ids.get(o.chave)!), ordem: atuais.length + i, criado_por: uid };
        });
        return [...atuais, ...criados];
    });
    const agora = FieldValue.serverTimestamp();
    const lote = c.db.batch();
    for (const o of proposta) {
        for (const u of o.unidades) {
            lote.set(c.db.collection(COL.unidades).doc(), {
                organization_id: c.orgId, nome: u.nome, sigla: u.sigla, tipo: u.tipo, descricao: '', orgao_id: ids.get(o.chave), competencias: [],
                ativa: true, lotacoes: [], membros_uids: [], pedidos: [], created_at: agora, created_by: uid,
            });
        }
    }
    if (totalUnidades) await lote.commit();
    await auditar('SECRETARIA_ESTRUTURA_CRIADA', { orgaos: criados.map((o) => o.nome), unidades: totalUnidades });
    return { success: true, orgaos: criados.length, unidades: totalUnidades };
}
