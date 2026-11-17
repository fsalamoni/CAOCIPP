// Consultas e Expedientes: textos e endereços comuns ao nº do PGEA e aos aditivos.
// Espelha functions-v2/src/shared/registrosPgea.ts.

export const MODULOS_PGEA = {
    consultas: { colecao: 'processes', tab: 'processes', campoNumero: 'process_number', nome: 'consulta', Nome: 'Consulta', a: 'a', rotuloNumero: 'Nº da Consulta - PGEA' },
    expedientes: { colecao: 'expedientes', tab: 'expedientes', campoNumero: 'expediente_number', nome: 'expediente', Nome: 'Expediente', a: 'o', rotuloNumero: 'Nº do Expediente - PGEA' },
};

/** "Aditivo 2" para aditivo, "Original" para quem tem aditivos, null para registro sem vínculo. */
export function rotuloVinculo(reg) {
    if (!reg) return null;
    if (reg.aditivo_de) return `Aditivo ${reg.aditivo_numero || ''}`.trim();
    if ((Number(reg.aditivos_count ?? reg.aditivos) || 0) > 0) return 'Original';
    return null;
}

/** Id do original da família (o próprio, se for o original). */
export const raizDe = (reg) => reg?.aditivo_de || reg?.id;
