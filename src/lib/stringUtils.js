// String utilities
// ============================================================================

/**
 * Converte qualquer valor para string e depois para minúsculas. Esta função
 * existe para evitar crashes quando o Firestore (ou qualquer outra fonte)
 * retorna um valor que NÃO é uma string primitiva — por exemplo, um
 * Timestamp, um GeoPoint, um Map, ou um array. Nestes casos:
 *  - valor null/undefined → retorna ''
 *  - valor string → retorna valor.toLowerCase()
 *  - valor objeto/array/número → retorna String(valor).toLowerCase()
 *
 * Por que o fallback `(value || '').toLowerCase()` NÃO é suficiente:
 *  - `(obj || '')` retorna o objeto (porque é truthy), e `objeto.toLowerCase()`
 *    falha com "Cannot read properties of undefined (reading 'toLowerCase')"
 *    (o protótipo Object não tem toLowerCase, e o erro do V8 reporta
 *    'undefined' porque a propriedade não existe).
 *  - Esse bug afetava o KanbanBoard de Processos: quando o Firestore
 *    retornava `userMember.function` ou `m.function` como objeto (cenário
 *    que aconteceu em produção após alguma migração/import), o
 *    `(userMember?.function || '').toLowerCase()` quebrava a renderização
 *    inteira da aba "Painel de Consultas". O mesmo padrão se repetia em
 *    ExpedienteKanbanBoard e ParceriaKanbanBoard.
 *  - A correção `(value ?? '').toLowerCase()` TAMBÉM não é suficiente: `??`
 *    só trata null/undefined, não objeto.
 *
 * Solução: converter explicitamente com String() antes do toLowerCase.
 */
export function safeLower(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value.toLowerCase();
    try {
        return String(value).toLowerCase();
    } catch {
        return '';
    }
}
