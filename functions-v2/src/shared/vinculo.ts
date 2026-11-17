// Regras únicas sobre o vínculo da pessoa com o órgão e a suspensão do órgão
// pela administração da plataforma.
//
// Suspensão do órgão (platformOrg 'suspender'): grava `platform_suspension`
// no órgão e `org_suspended: true` em todos os vínculos dele. As regras do
// Firestore (isMemberOf) e as Functions leem só o vínculo, então a suspensão
// não custa leitura a mais. O Portal das partes lê o órgão e trata a
// suspensão como Processo Eletrônico suspenso.

/** O vínculo não autoriza nada: inexistente, removido ou de órgão suspenso. */
export function vinculoBloqueado(d: Record<string, unknown> | undefined | null): boolean {
    return !d || d.active === false || d.org_suspended === true;
}

/** Órgão suspenso pela plataforma (acesso inteiro). */
export function orgSuspensa(org: Record<string, any> | undefined | null): boolean {
    return org?.platform_suspension?.ativa === true;
}

/** Processo Eletrônico fora do ar por decisão da plataforma: módulo suspenso ou órgão suspenso. */
export function peSuspensoPlataforma(org: Record<string, any> | undefined | null): boolean {
    return org?.secretariaConfig?.suspensa_plataforma === true || orgSuspensa(org);
}
