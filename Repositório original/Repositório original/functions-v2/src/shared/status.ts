import { getSmartField } from './fields';

export interface ProcessStatusInput {
    [key: string]: any;
}

export function calculateStatus(process: ProcessStatusInput): string {
    // 1. "Na pasta" (Verde): Se o campo de Arquivamento estiver preenchido.
    if (getSmartField(process, 'archived_date')) return "Na pasta";

    // 2. "Em revisão" (Azul/Roxo): Se o campo Remessa p/ Revisão estiver preenchido.
    if (getSmartField(process, 'review_submission_date')) return "Em revisão";

    // 3. "Em elaboração" (Âmbar/Amarelo): Se o campo Início da Análise estiver preenchido.
    if (getSmartField(process, 'analysis_start_date')) return "Em elaboração";

    // 4. "Pendente" (Branco): Fallback final.
    return getSmartField(process, 'status') || "Pendente";
}
