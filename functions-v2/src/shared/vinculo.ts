// Regras únicas sobre o vínculo da pessoa com o órgão e os bloqueios feitos
// pela administração da plataforma.
//
// Suspensão do órgão (platformOrg 'suspender'): grava `platform_suspension`
// no órgão e `org_suspended: true` em todos os vínculos dele.
// Bloqueio de pessoa (platformUser 'bloquear'): grava `platformBlocks/{uid}`
// (só Functions escrevem) e `user_blocked: true` em todos os vínculos dela.
// As regras do Firestore (isMemberOf) e as Functions leem só o vínculo, então
// nenhum dos dois custa leitura a mais. O Portal das partes, a criação de órgão
// e a entrada por convite leem `platformBlocks/{uid}` (exigirContaLiberada).
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

/** O vínculo não autoriza nada: inexistente, removido, órgão suspenso ou pessoa bloqueada. */
export function vinculoBloqueado(d: Record<string, unknown> | undefined | null): boolean {
    return !d || d.active === false || d.org_suspended === true || d.user_blocked === true;
}

/** Órgão suspenso pela plataforma (acesso inteiro). */
export function orgSuspensa(org: Record<string, any> | undefined | null): boolean {
    return org?.platform_suspension?.ativa === true;
}

/** Processo Eletrônico fora do ar por decisão da plataforma: módulo suspenso ou órgão suspenso. */
export function peSuspensoPlataforma(org: Record<string, any> | undefined | null): boolean {
    return org?.secretariaConfig?.suspensa_plataforma === true || orgSuspensa(org);
}

export const BLOQUEIOS = 'platformBlocks';

/** Recusa quem a plataforma bloqueou (Portal, criar órgão, entrar por convite). */
export async function exigirContaLiberada(db: admin.firestore.Firestore, uid: string): Promise<void> {
    const b = await db.collection(BLOQUEIOS).doc(uid).get();
    if (b.exists && b.data()?.ativa === true) {
        throw new HttpsError('permission-denied', 'Seu acesso ao SIGO foi bloqueado pela administração da plataforma.');
    }
}
