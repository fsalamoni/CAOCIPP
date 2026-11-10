import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { Orgao, orgaosDe, sanitizeOrgao, sanitizeProposta, validarEstrutura } from '../shared/orgaos';
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

async function exigirMembro(c: Contexto, uid: string | null) {
    if (!uid) return;
    const s = await c.db.collection('userOrganizations').doc(`${uid}_${c.orgId}`).get();
    if (!s.exists || s.data()?.active === false) throw new HttpsError('invalid-argument', 'O titular precisa ser membro ativo');
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

export async function salvarOrgao(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    exigirAdmin(c);
    const id = p.id ? String(p.id) : novoId();
    let orgao: Orgao;
    try { orgao = sanitizeOrgao(p.orgao, id); } catch (e) { erroUsuario(e); }
    await exigirMembro(c, orgao!.titular_uid);
    await mudar(c, uid, (atuais) => {
        const i = atuais.findIndex((o) => o.id === id);
        if (p.id && i < 0) throw new HttpsError('not-found', 'Órgão não encontrado');
        if (i < 0) return [...atuais, { ...orgao, ordem: atuais.length }];
        return atuais.map((o) => (o.id === id ? orgao : o));
    });
    await auditar('SECRETARIA_ORGAO_SALVO', { orgao_id: id, nome: orgao!.nome, superior: orgao!.pai_id });
    return { success: true, id };
}

/** Só remove órgão vazio: sem subordinados e sem unidades (nada se perde). */
export async function removerOrgao(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    exigirAdmin(c);
    const id = String(p.id || '');
    const comUnidades = c.unidades.filter((u) => u.orgao_id === id).length;
    if (comUnidades) throw new HttpsError('failed-precondition', `Este órgão tem ${comUnidades} unidade(s). Mova-as para outro órgão antes de removê-lo, ou apenas desative-o.`);
    let nome = '';
    await mudar(c, uid, (atuais) => {
        const alvo = atuais.find((o) => o.id === id);
        if (!alvo) throw new HttpsError('not-found', 'Órgão não encontrado');
        if (atuais.some((o) => o.pai_id === id)) throw new HttpsError('failed-precondition', 'Este órgão tem órgãos subordinados. Mova-os ou remova-os antes.');
        nome = alvo.nome;
        return atuais.filter((o) => o.id !== id);
    });
    await auditar('SECRETARIA_ORGAO_REMOVIDO', { orgao_id: id, nome });
    return { success: true };
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
            return { ...sanitizeOrgao({ ...o.orgao, titular_uid: null, pai_id: pai }, ids.get(o.chave)!), ordem: atuais.length + i };
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
