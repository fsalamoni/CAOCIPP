// Central de segurança da plataforma: rótulos, ordem do checklist e texto da
// auditoria. A conta (pontuação, estado de cada item) vem do servidor
// (functions-v2/src/platform/security.ts); aqui é só apresentação.

export const ESTADOS = {
    risco: { rotulo: 'Risco', ordem: 0 },
    atencao: { rotulo: 'Atenção', ordem: 1 },
    desconhecido: { rotulo: 'Não verificado', ordem: 2 },
    ok: { rotulo: 'Em ordem', ordem: 3 },
};

/** Risco primeiro, depois atenção, não verificado e em ordem (estável). */
export const ordenarItens = (itens = []) =>
    itens.map((i, n) => [i, n])
        .sort(([a, na], [b, nb]) => (ESTADOS[a.estado]?.ordem ?? 9) - (ESTADOS[b.estado]?.ordem ?? 9) || na - nb)
        .map(([i]) => i);

/** Faixa da pontuação, para cor e frase. */
export function faixaPontuacao(p) {
    if (p >= 85) return { tom: 'ok', frase: 'Boa proteção. Confira os itens restantes quando puder.' };
    if (p >= 60) return { tom: 'atencao', frase: 'Há pontos importantes a resolver.' };
    return { tom: 'risco', frase: 'Proteção fraca. Resolva primeiro os itens em risco.' };
}

export const ACOES_AUDITORIA = {
    GRANT_PLATFORM_ADMIN: 'Concedeu acesso de super-admin',
    REVOKE_PLATFORM_ADMIN: 'Retirou acesso de super-admin',
    PLATFORM_USER_BLOCKED: 'Bloqueou pessoa no SIGO',
    PLATFORM_USER_UNBLOCKED: 'Desbloqueou pessoa',
    PLATFORM_ORG_SUSPENDED: 'Suspendeu órgão',
    ORG_SUSPENSO_PLATAFORMA: 'Suspendeu órgão',
    PLATFORM_ORG_REACTIVATED: 'Reativou órgão',
    ORG_REATIVADO_PLATAFORMA: 'Reativou órgão',
    PLATFORM_ORG_CREATOR_CHANGED: 'Trocou o criador do órgão',
    CRIADOR_TROCADO_PLATAFORMA: 'Trocou o criador do órgão',
    DELETE_ORGANIZATION: 'Excluiu órgão',
    SET_FEATURE_FLAG: 'Ligou ou desligou funcionalidade',
    SET_PLATFORM_QUOTA: 'Mudou cota',
    SET_EMAIL_PROVIDER_CONFIG: 'Mudou o remetente de e-mail',
    PLATFORM_BRANDING_UPDATED: 'Mudou a identidade visual',
    PLATFORM_TERMS_PUBLISHED: 'Publicou termos de uso',
    PLATFORM_NOTICE_PUBLISHED: 'Publicou aviso',
    PLATFORM_NOTICE_ENDED: 'Encerrou aviso',
    PLATFORM_MAINTENANCE_ON: 'Ligou o modo manutenção',
    PLATFORM_MAINTENANCE_OFF: 'Desligou o modo manutenção',
    PLATFORM_SECURITY_CONFIRMED: 'Confirmou item de segurança',
    RECALC_ORG_STATS: 'Recalculou contadores',
    BACKFILL_HISTORY: 'Migrou histórico',
};

/** Filtro de ação sem repetir rótulos (as variantes antigas e novas dão o mesmo texto). */
export const OPCOES_ACAO = Object.entries(ACOES_AUDITORIA)
    .filter(([, v], i, todas) => todas.findIndex(([, w]) => w === v) === i)
    .map(([valor, rotulo]) => ({ valor, rotulo }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));

export const rotuloAcao = (acao) => ACOES_AUDITORIA[acao] || acao || 'Ação';

const CAMPOS_RESUMO = ['target_email', 'organization_name', 'nome', 'flagKey', 'enabled', 'quotaKey', 'value', 'motivo', 'versao', 'titulo', 'item', 'confirmado'];

/** Detalhes da ação em uma linha legível (só campos conhecidos, sem ids longos). */
export function resumoDetalhes(det) {
    if (!det || typeof det !== 'object') return '';
    return CAMPOS_RESUMO
        .filter((k) => det[k] !== undefined && det[k] !== null && det[k] !== '')
        .map((k) => {
            const v = det[k] === true ? 'sim' : det[k] === false ? 'não' : String(det[k]);
            return `${k.replace(/_/g, ' ')}: ${v.length > 80 ? `${v.slice(0, 77)}...` : v}`;
        })
        .join(' · ');
}

/** Dias desde uma data ISO (null se não houver). */
export const diasDesde = (iso, agora = Date.now()) => (iso ? Math.floor((agora - Date.parse(iso)) / 86400000) : null);
