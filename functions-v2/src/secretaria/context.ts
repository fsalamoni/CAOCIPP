import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import {
    ContextoUsuario,
    MovimentoBase,
    hashMovimento,
    podeAgir,
    podeVer,
} from '../shared/secretaria';

export const REGION = 'southamerica-east1';

export const COL = {
    processos: 'secProcessos',
    unidades: 'secUnidades',
    ritos: 'secRitos',
    contadores: 'secContadores',
    convites: 'secConvites',
    tipos: 'secTipos',
} as const;

export interface Contexto {
    db: admin.firestore.Firestore;
    orgId: string;
    org: admin.firestore.DocumentData;
    ctx: ContextoUsuario;
    userName: string;
    unidades: Array<{ id: string } & admin.firestore.DocumentData>;
}

export function exigirAuth(request: { auth?: { uid: string; token: Record<string, unknown> } }) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'É preciso estar autenticado');
    return request.auth;
}

/**
 * Carrega quem é o usuário dentro da Secretaria do órgão. Exige vínculo com o
 * órgão e, salvo `permitirInativa`, a Secretaria ligada pelo admin do órgão.
 */
export async function carregarContexto(
    auth: { uid: string; token: Record<string, unknown> },
    orgId: unknown,
    opts: { permitirInativa?: boolean } = {}
): Promise<Contexto> {
    if (typeof orgId !== 'string' || !orgId) {
        throw new HttpsError('invalid-argument', 'organizationId é obrigatório');
    }
    const db = admin.firestore();
    const [memSnap, orgSnap, unSnap] = await Promise.all([
        db.collection('userOrganizations').doc(`${auth.uid}_${orgId}`).get(),
        db.collection('organizations').doc(orgId).get(),
        // ponytail: lê todas as unidades do órgão e filtra em memória (dezenas,
        // não milhares); trocar por um índice de lotação se passar de centenas.
        db.collection(COL.unidades).where('organization_id', '==', orgId).get(),
    ]);
    if (!memSnap.exists || !orgSnap.exists) {
        throw new HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    const mem = memSnap.data() || {};
    const org = orgSnap.data() || {};
    const isAdmin = mem.role === 'creator' || mem.permissions?.configure_secretaria === true;
    if (!opts.permitirInativa && org.secretariaConfig?.enabled !== true) {
        throw new HttpsError('failed-precondition', 'A Secretaria Processual não está ativa neste órgão');
    }
    const unidades = unSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string } & admin.firestore.DocumentData));
    const unidadeIds = unidades
        .filter((u) => u.ativa !== false && Array.isArray(u.membros_uids) && u.membros_uids.includes(auth.uid))
        .map((u) => u.id);
    return {
        db,
        orgId,
        org,
        ctx: { uid: auth.uid, isAdmin, unidadeIds },
        userName: String(auth.token.name || mem.user_name || mem.user_email || 'Usuário'),
        unidades,
    };
}

export function exigirAdmin(c: Contexto) {
    if (!c.ctx.isAdmin) {
        throw new HttpsError('permission-denied', 'É preciso a permissão "Configurar Secretaria Processual"');
    }
}

/** Lê o processo garantindo que é do órgão (sem vazar existência de outro). */
export async function lerProcesso(
    c: Contexto,
    id: unknown,
    tx?: admin.firestore.Transaction
) {
    if (typeof id !== 'string' || !id) throw new HttpsError('invalid-argument', 'processoId é obrigatório');
    const ref = c.db.collection(COL.processos).doc(id);
    const snap = tx ? await tx.get(ref) : await ref.get();
    const data = snap.data();
    if (!snap.exists || !data || data.organization_id !== c.orgId || !podeVer(data as never, c.ctx)) {
        throw new HttpsError('not-found', 'Processo não encontrado');
    }
    return { ref, data };
}

export function exigirPosse(c: Contexto, proc: admin.firestore.DocumentData) {
    if (!podeAgir(proc as never, c.ctx)) {
        throw new HttpsError('permission-denied', 'O processo não está com uma unidade em que você esteja lotado');
    }
}

export function conferirVersao(proc: admin.firestore.DocumentData, esperada: unknown) {
    if (typeof esperada === 'number' && esperada !== proc.version) {
        throw new HttpsError('aborted', 'O processo foi movimentado por outra pessoa. Recarregue e tente de novo.');
    }
}

/**
 * Grava um movimento encadeado. Deve rodar DENTRO da transação que leu o
 * processo; devolve os campos a gravar no processo junto.
 */
export function registrarMovimento(
    tx: admin.firestore.Transaction,
    c: Contexto,
    procRef: admin.firestore.DocumentReference,
    proc: admin.firestore.DocumentData,
    tipo: string,
    descricao: string,
    dados: Record<string, unknown> = {}
): Record<string, unknown> {
    const seq = (Number(proc.mov_seq) || 0) + 1;
    const base: MovimentoBase = {
        seq,
        tipo,
        descricao,
        autor_uid: c.ctx.uid,
        autor_nome: c.userName,
        unidade_id: String(proc.unidade_atual || ''),
        em: new Date().toISOString(),
        dados,
        hash_anterior: String(proc.ultimo_hash || ''),
    };
    const hash = hashMovimento(base);
    tx.set(procRef.collection('movimentos').doc(String(seq).padStart(6, '0')), { ...base, hash });
    return {
        mov_seq: seq,
        ultimo_hash: hash,
        version: (Number(proc.version) || 0) + 1,
        updated_at: FieldValue.serverTimestamp(),
        ultimo_movimento: { tipo, descricao, em: base.em },
    };
}

export function nomeUnidade(c: Contexto, id: string): string {
    const u = c.unidades.find((x) => x.id === id);
    return u ? String(u.nome) : id;
}

export function erroUsuario(e: unknown): never {
    if (e instanceof HttpsError) throw e;
    throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'Dados inválidos');
}
