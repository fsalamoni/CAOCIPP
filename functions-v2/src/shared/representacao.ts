// ============================================================================
// Quem representa a parte no processo: advogado, defensor público, procurador
// do ente público, representante legal, preposto. A qualidade e a inscrição
// (OAB, matrícula) ficam no representante e acompanham tudo o que ele assina
// no portal. Lógica pura, testada em test/representacao.test.js; espelho no
// cliente em src/lib/representacao.js.
// ============================================================================

export const QUALIDADES: ReadonlyArray<readonly [string, string, boolean]> = [
    // [id, nome, exige procuração ou ato de representação]
    ['advogado', 'Advogado(a)', true],
    ['defensor', 'Defensor(a) público(a)', false],
    ['procurador', 'Procurador(a) do ente público', false],
    ['legal', 'Representante legal', true],
    ['preposto', 'Preposto(a)', true],
    ['outro', 'Outro', false],
];
const ACHAR = (id: unknown) => QUALIDADES.find(([q]) => q === id);

export interface Representacao { qualidade?: string; inscricao?: string; poderes?: true }

const limpo = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/**
 * Qualidade, inscrição e a conferência dos poderes de um representante novo.
 * Advogado informa a inscrição na OAB; quem depende de procuração ou de ato
 * de representação só entra com os poderes conferidos. Lança Error.
 */
export function sanitizeRepresentacao(bruto: unknown): Representacao {
    const o = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
    const q = ACHAR(o.qualidade);
    if (!q) return {};
    const inscricao = limpo(o.inscricao, 40);
    if (q[0] === 'advogado' && !inscricao) throw new Error('Informe a inscrição do advogado na OAB');
    if (q[2] && o.poderes !== true) throw new Error('Confira a procuração ou o ato de representação antes de dar o acesso');
    return { qualidade: q[0], ...(inscricao ? { inscricao } : {}), ...(o.poderes === true ? { poderes: true as const } : {}) };
}

/** "advogado(a), OAB/RS 12.345" (vazio quando o representante não tem qualidade registrada). */
export function qualificacao(r: Representacao | null | undefined): string {
    const q = ACHAR(r?.qualidade);
    if (!q || q[0] === 'outro') return r?.inscricao || '';
    return `${q[1].toLowerCase()}${r?.inscricao ? `, ${r.inscricao}` : ''}`;
}

/** "Maria Souza (advogado(a), OAB/RS 12.345)" ou só o nome. */
export function nomeQualificado(r: { nome: string } & Representacao): string {
    const q = qualificacao(r);
    return q ? `${r.nome} (${q})` : r.nome;
}
