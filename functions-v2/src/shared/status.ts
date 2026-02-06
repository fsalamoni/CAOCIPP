export function calculateStatus(process: any): string {
    if (process.archived_date) return "Na pasta";
    if (process.review_return_date) return "Para revisão"; // Logic form original: review_return means "returned for review/correction" -> "Para revisão"? Or "Para assinatura"? Original said: if (process.review_return_date) return "Para revisão";
    // Wait, original file said: if (process.review_return_date) return "Para revisão";
    // My previous note in ProcessStatusBadge said "'Para revisão' might act like 'Para assinatura'".
    // Let's stick strictly to the legacy code: "Para revisão".
    // But wait, look at ProcessStatusBadge lines again.
    // The legacy loop returned "Para revisão". 

    if (process.review_return_date) return "Para revisão";
    if (process.review_submission_date) return "Em revisão";
    if (process.analysis_start_date) return "Em elaboração";
    if (process.distribution_date) return "Pendente";

    // existing status or default
    return process.status || "Em triagem";
}
