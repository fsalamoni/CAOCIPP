// ============================================================================
// Ordenação da coluna de ARQUIVADOS nos quadros (Consultas, Expedientes e
// Parcerias).
//
// Nas demais colunas, o padrão dos quadros põe os urgentes na frente — é o que
// faz sentido para trabalho em andamento. Num arquivado, não: ele não disputa
// mais atenção, e o que interessa é o que foi arquivado por último.
//
// A regra:
//   1. A urgência NUNCA pesa na ordem desta coluna. A marca continua gravada no
//      registro (é usada em métricas) — só deixa de furar a fila.
//   2. Se o usuário não personalizou a ordenação do quadro, a coluna vem por
//      data de arquivamento, do mais recente para o mais antigo.
//   3. Se personalizou, vale a ordem dele (menos a urgência), e a data de
//      arquivamento decrescente desempata.
//
// Os filtros do quadro continuam valendo: esta função só decide a ORDEM de
// quem já passou por eles.
// ============================================================================

export const ARCHIVED_DATE_KEY = 'archived_date';

/**
 * Desempate DENTRO do mesmo dia de arquivamento.
 *
 * `archived_date` guarda só o dia (AAAA-MM-DD): dois processos arquivados no
 * mesmo dia empatariam e ficariam em ordem arbitrária. O melhor indicador do
 * MOMENTO do arquivamento que o registro tem é `updated_at` — arquivar é, em
 * regra, a última gravação de um processo. Só atua entre arquivados do mesmo
 * dia; nunca passa na frente da data de arquivamento.
 *
 * A chave é sintética para não colidir com nenhuma opção de ordenação da tela.
 */
export const ARCHIVED_TIEBREAK_KEY = '__momento_arquivamento';

/** Milissegundos de um Timestamp do Firestore, Date ou texto ISO; senão null. */
export function momentoEmMs(valor) {
    if (valor === null || valor === undefined || valor === '') return null;
    if (typeof valor.toMillis === 'function') return valor.toMillis();
    if (typeof valor.seconds === 'number') return valor.seconds * 1000 + Math.floor((valor.nanoseconds || 0) / 1e6);
    if (valor instanceof Date) return Number.isFinite(valor.getTime()) ? valor.getTime() : null;
    const t = Date.parse(String(valor));
    return Number.isFinite(t) ? t : null;
}

/** Forma canônica de uma lista de regras, independente da ordem das propriedades. */
function assinatura(regras) {
    return (regras || []).map((r) => `${r?.key}:${r?.direction}`).join('|');
}

/**
 * Regras de ordenação da coluna de arquivados.
 *
 * @param {Array<{key:string,direction:'asc'|'desc'}>} userRules   Regras efetivas do quadro.
 * @param {Array<{key:string,direction:'asc'|'desc'}>} defaultRules Padrão do quadro.
 * @returns {Array<{key:string,direction:'asc'|'desc'}>}
 */
export function archivedSortRules(userRules, defaultRules) {
    const regras = Array.isArray(userRules) ? userRules : [];
    const porArquivamento = [
        { key: ARCHIVED_DATE_KEY, direction: 'desc' },
        { key: ARCHIVED_TIEBREAK_KEY, direction: 'desc' },
    ];

    const ehPadrao = assinatura(regras) === assinatura(defaultRules);
    // Tira a urgência e, por segurança, qualquer regra que já seja de
    // arquivamento (para não repeti-la no desempate).
    const proprias = regras.filter(
        (r) => r && r.key !== 'urgency_request'
            && r.key !== ARCHIVED_DATE_KEY && r.key !== ARCHIVED_TIEBREAK_KEY
    );

    if (ehPadrao || proprias.length === 0) return porArquivamento;
    return [...proprias, ...porArquivamento];
}
