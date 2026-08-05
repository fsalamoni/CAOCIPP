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

// ============================================================================
// Parcerias (Convênio, Termo de Cooperação, Termo de Fomento)
//
// Status hierárquico (de "final" para "inicial"):
//   1. Extintos                  → extinguished === true
//   2. Parcerias                 → tem todos os campos de formalização
//   3. Aguarda Terceiros         → review_conclusion_date + third_party
//   4. Revisão                   → network_folder + observations
//   5. Em análise                → responsible_user_id + responsibility_date
//   6. Pendente                  → só os mínimos (pgea/assunto/objeto/partes)
//
// Segue a mesma filosofia do calculateStatus(process): quanto mais campos
// "avançados" estão preenchidos, mais à direita no fluxo a entidade está.
// Cálculo roda no servidor (defesa em profundidade); o frontend tem cópia
// idêntica apenas para exibição.
// ============================================================================

export const PARCERIA_FINAL_STATUSES = ['Parcerias', 'Extintos'] as const;
export const PARCERIA_VALID_STATUSES = [
    'Pendente',
    'Em análise',
    'Revisão',
    'Aguarda Terceiros',
    'Parcerias',
    'Extintos',
] as const;

export function calculateParceriaStatus(parceria: ProcessStatusInput): string {
    // 1. "Extintos" (slate desaturado): marcado explicitamente como extinto.
    if (parceria?.extinguished === true) return 'Extintos';

    // 2. "Parcerias" (emerald): tem todos os campos de formalização preenchidos.
    if (
        getSmartField(parceria, 'partnership_type') &&
        getSmartField(parceria, 'partnership_number') &&
        getSmartField(parceria, 'signature_date') &&
        getSmartField(parceria, 'end_date') &&
        getSmartField(parceria, 'renewal_notice_date')
    ) return 'Parcerias';

    // 3. "Aguarda Terceiros" (cyan): revisão concluída + terceiro escolhido.
    if (
        getSmartField(parceria, 'review_conclusion_date') &&
        getSmartField(parceria, 'third_party')
    ) return 'Aguarda Terceiros';

    // 4. "Revisão" (sky): local/pasta da rede + observações.
    if (
        getSmartField(parceria, 'network_folder') &&
        getSmartField(parceria, 'observations')
    ) return 'Revisão';

    // 5. "Em análise" (amber): assessor responsável + data de responsabilidade.
    if (
        getSmartField(parceria, 'responsible_user_id') &&
        getSmartField(parceria, 'responsibility_date')
    ) return 'Em análise';

    // 6. "Pendente" (slate): fallback.
    return getSmartField(parceria, 'status') || 'Pendente';
}

