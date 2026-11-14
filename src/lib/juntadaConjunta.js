// Juntada em conjunto (botão Finalizar da fase): quem tem o processo escolhe
// quais minutas entram nos autos, em que ordem, e o que fazer com as demais.
// Aqui só a montagem da lista; cada juntada é validada e gravada pelo servidor.

/** "Finalizar revisão", pelo nome da fase. */
export const rotuloFinalizar = (fase) => {
    const nome = String(fase?.nome || '').trim();
    return nome ? `Finalizar ${nome[0].toLowerCase()}${nome.slice(1)}` : 'Finalizar a fase';
};

/** Mantém a ordem e as escolhas já feitas, tira o que sumiu e põe as minutas novas no fim (já escolhidas). */
export function alinharItens(itens, minutas) {
    const ids = new Set(minutas.map((d) => d.id));
    const mantidos = (itens || []).filter((x) => ids.has(x.id));
    const vistos = new Set(mantidos.map((x) => x.id));
    return [...mantidos, ...minutas.filter((d) => !vistos.has(d.id)).map((d) => ({ id: d.id, incluir: true, assinar: true }))];
}

export function moverItem(itens, i, delta) {
    const j = i + delta;
    if (i < 0 || j < 0 || i >= itens.length || j >= itens.length) return itens;
    const n = [...itens];
    [n[i], n[j]] = [n[j], n[i]];
    return n;
}

/**
 * Passos, na ordem: junta os escolhidos (assinando os que a pessoa ainda não
 * assinou, se marcado) e, se pedido, guarda fora dos autos os que ficaram.
 */
export function planoDaJuntada(itens, minutas, uid, { guardarResto = false } = {}) {
    const porId = new Map(minutas.map((d) => [d.id, d]));
    const validos = (itens || []).filter((x) => porId.has(x.id));
    const assinei = (d) => (d.assinaturas || []).some((a) => a.uid === uid);
    return [
        ...validos.filter((x) => x.incluir).map((x) => ({ acao: 'juntar', docId: x.id, titulo: porId.get(x.id).titulo, assinar: !!x.assinar && !assinei(porId.get(x.id)) })),
        ...(guardarResto ? validos.filter((x) => !x.incluir).map((x) => ({ acao: 'guardar', docId: x.id, titulo: porId.get(x.id).titulo })) : []),
    ];
}
