// Impressão interna: PDF de uso da equipe com o que fica fora dos autos
// (registros internos, minutas, documentos guardados e redações anteriores).
// Espelho de functions-v2/src/shared/autos.ts (registroInterno e
// documentoInterno): o servidor confere de novo o que cada pessoa pode ver.

/** O que pode ser marcado, a partir do que a tela do processo já recebeu. */
export function itensInternos(movimentos, documentos) {
    return {
        registros: (movimentos || []).filter((m) => m.origem !== 'usuario' && m.dados?.oculto !== true),
        documentos: (documentos || []).filter((d) => d.status === 'minuta' || d.status === 'controle'),
        // Peça dos autos já sai no PDF dos autos; aqui entram só as redações anteriores dela.
        soVersoes: (documentos || []).filter((d) => d.status === 'juntado' && d.versoes > 0),
    };
}

export const rotuloDocumentoInterno = (d) => (d.status === 'controle' ? 'Guardado fora dos autos' : d.status === 'juntado' ? `Doc. nº ${d.ordem} dos autos` : 'Minuta');

/** Pedido ao servidor: `{ registros: [seq], documentos: [id], versoes: [id] }`. */
export function selecaoInterna(marcados, itens) {
    const tem = (k) => marcados.has(k);
    return {
        registros: itens.registros.filter((m) => tem(`r:${m.seq}`)).map((m) => m.seq),
        documentos: itens.documentos.filter((d) => tem(`d:${d.id}`)).map((d) => d.id),
        versoes: [...itens.documentos, ...itens.soVersoes].filter((d) => d.versoes > 0 && tem(`v:${d.id}`)).map((d) => d.id),
    };
}

export const totalMarcado = (s) => s.registros.length + s.documentos.length + s.versoes.length;
