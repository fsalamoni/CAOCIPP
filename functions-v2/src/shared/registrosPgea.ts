// Regras comuns de Consultas e Expedientes ligadas ao número do PGEA:
// conferência do número na criação e vínculo entre original e aditivos.
import { calculateStatus } from './status';

export const MODULOS_PGEA = {
    consultas: { colecao: 'processes', campoNumero: 'process_number', nome: 'consulta' },
    expedientes: { colecao: 'expedientes', campoNumero: 'expediente_number', nome: 'expediente' },
} as const;

export type ModuloPgea = keyof typeof MODULOS_PGEA;

export function moduloPgea(m: unknown) {
    return Object.prototype.hasOwnProperty.call(MODULOS_PGEA, String(m)) ? MODULOS_PGEA[m as ModuloPgea] : null;
}

/**
 * Forma de comparar números: só letras e dígitos, em maiúsculas, sem zeros à
 * esquerda. "00021.000.125/2024", "21.000.125/2024" e "000210001252024"
 * são o mesmo número.
 */
export function normalizarNumeroPgea(n: unknown): string {
    return String(n ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^0+/, '');
}

/** Campos lidos para resumir um registro (consulta com `.select`). */
export const CAMPOS_RESUMO = [
    'entry_date', 'status', 'archived_date', 'reviewed_date', 'review_submission_date',
    'third_party_referral_date', 'analysis_start_date', 'responsible_user_name',
    'aditivo_de', 'aditivo_numero', 'aditivos_count',
];

export interface ResumoRegistro {
    id: string;
    numero: string;
    fase: string;
    responsavel: string;
    arquivado: boolean;
    entrada: string | null;
    aditivo_de: string | null;
    aditivo_numero: number | null;
    aditivos: number;
}

export function resumoRegistro(id: string, d: Record<string, any>, campoNumero: string): ResumoRegistro {
    return {
        id,
        numero: String(d[campoNumero] ?? ''),
        fase: calculateStatus(d),
        responsavel: String(d.responsible_user_name || ''),
        arquivado: Boolean(d.archived_date),
        entrada: d.entry_date || null,
        aditivo_de: d.aditivo_de || null,
        aditivo_numero: typeof d.aditivo_numero === 'number' ? d.aditivo_numero : null,
        aditivos: Number(d.aditivos_count) || 0,
    };
}

/** Original primeiro, depois os aditivos em ordem; registros soltos por data de entrada. */
export function ordenarResumos(lista: ResumoRegistro[]): ResumoRegistro[] {
    const raiz = (r: ResumoRegistro) => r.aditivo_de || r.id;
    return [...lista].sort((a, b) =>
        raiz(a).localeCompare(raiz(b)) || (a.aditivo_numero || 0) - (b.aditivo_numero || 0)
        || String(a.entrada || '').localeCompare(String(b.entrada || '')));
}
