// Passos para a equipe conseguir trabalhar e a aba em que a configuração abre.

/** Os quatro passos, a partir do estado do órgão. */
export function passosConfiguracao(estado) {
    const unidades = (estado?.unidades || []).filter((u) => u.ativa !== false);
    return [
        { aba: 'unidades', feito: unidades.length > 0, titulo: 'Criar as unidades', dica: 'A Secretaria já vem criada; adicione o Gabinete e, se houver, a Assessoria.' },
        { aba: 'unidades', feito: unidades.some((u) => (u.membros_uids || []).length > 0), titulo: 'Montar a equipe de cada unidade', dica: 'Insira membros do órgão ou convide por e-mail. Sem lotação, ninguém vê processos.' },
        { aba: 'ritos', feito: (estado?.ritos || []).some((r) => r.ativo), titulo: 'Ter um rito ativo', dica: 'Parta de um modelo pronto ou importe de planilha, Word, PDF ou diagrama.' },
        { aba: 'tipos', feito: (estado?.tipos || []).some((t) => t.ativo), titulo: 'Criar o primeiro tipo de processo', dica: 'O tipo escolhe o rito, o sigilo e a unidade de entrada para quem autua.' },
    ];
}

export const ABAS_CONFIG = ['estrutura', 'unidades', 'tipos', 'ritos', 'documentos', 'calendario', 'integracoes', 'preferencias', 'lixeira', 'historico'];

/** `?aba=` válido vence; senão o primeiro passo pendente; tudo feito: Ritos. */
export function abaInicial(estado, pedida) {
    if (ABAS_CONFIG.includes(pedida)) return pedida;
    return passosConfiguracao(estado).find((p) => !p.feito)?.aba || 'ritos';
}
