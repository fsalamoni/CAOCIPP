import { getSmartField } from './fields';

export interface ProcessStatusInput {
    [key: string]: any;
}

export function calculateStatus(process: ProcessStatusInput): string {
    // 1. "Na pasta" (Verde): Se o campo de Arquivamento estiver preenchido.
    if (getSmartField(process, 'archived_date')) return "Na pasta";

    // 2. "Revisadas" (Roxo): Se a Revisão concluída pelo responsável estiver preenchida.
    if (getSmartField(process, 'reviewed_date')) return "Revisadas";

    // 3. "Em revisão" (Azul): Se o campo Remessa p/ Revisão estiver preenchido.
    if (getSmartField(process, 'review_submission_date')) return "Em revisão";

    // 3.5. "Aguarda retorno de terceiros" (Ciano): fase OPCIONAL — se a Remessa
    // a Terceiros estiver preenchida mas ainda não houver Remessa p/ Revisão.
    // Pode nunca ocorrer (vai direto de "Em elaboração" p/ "Em revisão").
    if (getSmartField(process, 'third_party_referral_date')) return "Aguarda retorno de terceiros";

    // 4. "Em elaboração" (Âmbar/Amarelo): Se o campo Início da Análise estiver preenchido.
    if (getSmartField(process, 'analysis_start_date')) return "Em elaboração";

    // 5. "Pendente" (Branco): Fallback final.
    return getSmartField(process, 'status') || "Pendente";
}
