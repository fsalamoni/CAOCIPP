import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import {
    ContextoUsuario,
    MovimentoBase,
    ehParte,
    hashMovimento,
    lotacoesDe,
    podeAgir,
    podeVer,
} from '../shared/secretaria';
import { geraTermo, visivelParaPartes } from '../shared/autos';
import { orgaosAdministrados, orgaosDe } from '../shared/orgaos';

export const REGION = 'southamerica-east1';

export const COL = {
    processos: 'secProcessos',
    unidades: 'secUnidades',
    ritos: 'secRitos',
    contadores: 'secContadores',
    convites: 'secConvites',
    tipos: 'secTipos',
    config: 'secConfig',
    verificacao: 'secVerificacao',
    modelos: 'secModelos',
    unidadeConfig: 'secUnidadeConfig',
    convitesEquipe: 'secConvitesEquipe',
    /** Contadores de uso das chamadas públicas, por hora (apagáveis por TTL em `expira_em`). */
    limites: 'secLimites',
} as const;

export interface Contexto {
    db: admin.firestore.Firestore;
    orgId: string;
    org: admin.firestore.DocumentData;
    ctx: ContextoUsuario;
    /** Papel no órgão (creator, admin, member): as páginas próprias usam nas regras de aprovação. */
    papel?: string;
    userName: string;
    unidades: Array<{ id: string } & admin.firestore.DocumentData>;
    /**
     * Unidades que o usuário configura: ativas em que é gestor e, como admin
     * delegado, todas (inclusive inativas) dos órgãos internos que administra.
     */
    gestorDe: string[];
    /** Órgãos internos que o usuário administra por delegação (com os subordinados). */
    adminOrgaos?: string[];
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
    const [memSnap, orgSnap, unSnap, cfgSnap] = await Promise.all([
        db.collection('userOrganizations').doc(`${auth.uid}_${orgId}`).get(),
        db.collection('organizations').doc(orgId).get(),
        // ponytail: lê todas as unidades do órgão e filtra em memória (dezenas,
        // não milhares); trocar por um índice de lotação se passar de centenas.
        db.collection(COL.unidades).where('organization_id', '==', orgId).get(),
        db.collection(COL.config).doc(orgId).get(),
    ]);
    if (!memSnap.exists || !orgSnap.exists || memSnap.data()?.active === false) {
        throw new HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    const mem = memSnap.data() || {};
    const org = orgSnap.data() || {};
    const isAdmin = mem.role === 'creator' || mem.permissions?.configure_secretaria === true;
    if (!opts.permitirInativa && org.secretariaConfig?.enabled !== true) {
        throw new HttpsError('failed-precondition', 'O Processo Eletrônico não está ativo neste órgão');
    }
    if (!opts.permitirInativa && org.secretariaConfig?.suspensa_plataforma === true) {
        throw new HttpsError('failed-precondition', 'O Processo Eletrônico deste órgão está suspenso pela administração da plataforma');
    }
    const unidades = unSnap.docs.map((d) => ({ id: d.id, ...d.data() } as { id: string } & admin.firestore.DocumentData));
    const ativas = unidades.filter((u) => u.ativa !== false);
    const unidadeIds = ativas.filter((u) => lotacoesDe(u).some((l) => l.uid === auth.uid)).map((u) => u.id);
    const adminOrgaos = orgaosAdministrados(orgaosDe(cfgSnap.data()?.orgaos), auth.uid);
    const gestorDe = unidades.filter((u) => !u.excluida && (
        (u.ativa !== false && lotacoesDe(u).some((l) => l.uid === auth.uid && l.gestor)) || (!!u.orgao_id && adminOrgaos.includes(String(u.orgao_id)))
    )).map((u) => u.id);
    return {
        db,
        orgId,
        org,
        ctx: { uid: auth.uid, isAdmin, unidadeIds },
        papel: String(mem.role || 'member'),
        userName: String(auth.token.name || mem.user_name || mem.user_email || 'Usuário'),
        unidades,
        gestorDe,
        adminOrgaos,
    };
}

/** Admin da entidade ou admin delegado do órgão interno `orgaoId`. */
export function administraOrgao(c: Contexto, orgaoId: unknown): boolean {
    return c.ctx.isAdmin || (!!orgaoId && (c.adminOrgaos || []).includes(String(orgaoId)));
}

/** Admin da entidade, ou admin delegado quando há órgão interno (vazio = só a entidade). */
export function exigirAdminDoOrgao(c: Contexto, orgaoId: unknown) {
    if (!administraOrgao(c, orgaoId)) {
        throw new HttpsError('permission-denied', orgaoId
            ? 'Só o admin da entidade ou quem administra este órgão interno pode fazer isso'
            : 'É preciso a permissão "Configurar Processo Eletrônico"');
    }
}

export function exigirAdmin(c: Contexto) {
    if (!c.ctx.isAdmin) {
        throw new HttpsError('permission-denied', 'É preciso a permissão "Configurar Processo Eletrônico"');
    }
}

/** Admin do órgão ou gestor da unidade. */
export function exigirGestor(c: Contexto, unidadeId: unknown) {
    const u = c.unidades.find((x) => x.id === unidadeId && !x.excluida);
    if (!u) throw new HttpsError('not-found', 'Unidade não encontrada');
    if (!c.ctx.isAdmin && !c.gestorDe.includes(u.id)) {
        throw new HttpsError('permission-denied', 'Só a gestão da unidade ou o admin do órgão podem fazer isso');
    }
    return u;
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
    // Membro que é parte neste processo: aqui ele não é o órgão; só pelo portal.
    if (data && data.organization_id === c.orgId && ehParte(data as never, c.ctx.uid)) {
        throw new HttpsError('failed-precondition', 'Você é parte neste processo. Acompanhe-o pelo Portal das partes.');
    }
    // Excluído só reaparece pela lista de excluídos do admin (restaurar).
    if (!snap.exists || !data || data.organization_id !== c.orgId || data.status === 'excluido' || !podeVer(data as never, c.ctx)) {
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
    // Ato de usuário sem documento ocupa uma folha dos autos (o termo). Processo
    // antigo, com documentos e sem contagem de folhas, fica sem folha no termo.
    const semContagem = typeof proc.folhas_seq !== 'number' && Number(proc.doc_seq) > 0;
    const folha = geraTermo(base) && !semContagem ? (Number(proc.folhas_seq) || 0) + 1 : null;
    tx.set(procRef.collection('movimentos').doc(String(seq).padStart(6, '0')), { ...base, hash, ...(folha ? { folha } : {}) });
    return {
        ...(folha ? { folhas_seq: folha } : {}),
        mov_seq: seq,
        ultimo_hash: hash,
        version: (Number(proc.version) || 0) + 1,
        updated_at: FieldValue.serverTimestamp(),
        // Ato "sem evento" (oculto) não vira último andamento de ninguém.
        ...(dados.oculto === true ? {} : {
            // `publico` deixa o portal saber se pode usar este movimento quando falta o último público.
            ultimo_movimento: { tipo, descricao, em: base.em, publico: visivelParaPartes(base) },
            // O que o portal mostra às partes como último andamento: nunca um ato interno.
            ...(visivelParaPartes(base) ? { ultimo_movimento_publico: { tipo, descricao, em: base.em } } : {}),
        }),
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
