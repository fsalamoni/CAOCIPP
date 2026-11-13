/** Devolve a lista com o item de volta na posição em que estava, sem duplicar se ele já voltou. */
export function reinserir(lista, item, i) {
    const resto = lista.filter((x) => x.id !== item.id);
    const pos = Math.max(0, Math.min(i, resto.length));
    return [...resto.slice(0, pos), item, ...resto.slice(pos)];
}
