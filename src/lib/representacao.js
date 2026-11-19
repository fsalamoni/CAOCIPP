// Quem representa a parte (espelho de functions-v2/src/shared/representacao.ts):
// qualidade, inscrição e se depende de procuração ou ato de representação.

export const QUALIDADES = [
    ['advogado', 'Advogado(a)', true],
    ['defensor', 'Defensor(a) público(a)', false],
    ['procurador', 'Procurador(a) do ente público', false],
    ['legal', 'Representante legal', true],
    ['preposto', 'Preposto(a)', true],
    ['outro', 'Outro', false],
];
const achar = (id) => QUALIDADES.find(([q]) => q === id);

/** A qualidade depende de procuração ou de ato de representação conferido? */
export const exigePoderes = (id) => !!achar(id)?.[2];

/** O que falta para convidar o representante (o servidor confere de novo). */
export function faltaNaRepresentacao(r) {
    if (!achar(r?.qualidade)) return '';
    if (r.qualidade === 'advogado' && !String(r.inscricao || '').trim()) return 'Informe a inscrição do advogado na OAB.';
    if (exigePoderes(r.qualidade) && r.poderes !== true) return 'Confira a procuração ou o ato de representação antes de dar o acesso.';
    return '';
}

/** "advogado(a), OAB/RS 12.345" (vazio quando não há qualidade registrada). */
export function qualificacao(r) {
    const q = achar(r?.qualidade);
    if (!q || q[0] === 'outro') return r?.inscricao || '';
    return `${q[1].toLowerCase()}${r?.inscricao ? `, ${r.inscricao}` : ''}`;
}
