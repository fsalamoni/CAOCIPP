// ============================================================================
// Quem pode praticar cada ato, pelo rito: cumprir uma ação, concluir a fase,
// dispensar o que ela exige, seguir por caminho fora do previsto e mudar a
// situação do processo. Ausente = como sempre foi: quem tem o processo (com
// motivo, quando o ato pede). A administração do Processo Eletrônico sempre
// pode. Lógica pura, testada em test/permissoesFase.test.js; o cliente tem o
// espelho em src/lib/permissoesFase.js (só para a tela; quem decide é o
// servidor).
// ============================================================================

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Quem pode, além da administração: o responsável designado, quem gere a unidade ou quem tem certa atribuição na lotação. */
export const QUEM = ['responsavel', 'gestor', 'atribuicao'] as const;
export type Quem = typeof QUEM[number];
/** Ato reservado a quem gere a unidade que tem o processo, ou só à administração. */
export const RESERVAS = ['gestor', 'admin'] as const;
export type Reserva = typeof RESERVAS[number];
export const MAX_ATRIBUICAO = 80;

export interface PermissoesFase {
    /** Quem conclui a fase (leva o processo a outra fase, salvo à de espera). Ausente = quem tem o processo. */
    concluir?: Quem;
    concluir_atribuicao?: string;
    /** Quem dispensa o que a fase exige e ficou em aberto. Ausente = quem conclui, com motivo. */
    dispensar?: Reserva;
    /** Quem segue por fase fora do fluxo ou por saída sem a resposta que o rito pede. Ausente = quem conclui, com motivo. */
    desviar?: Reserva;
    /** Quem arquiva, sobresta e reativa durante a fase. Ausente = quem tem o processo, com motivo. */
    situacao?: Reserva;
}

/** Quem pratica o ato, como o rito o enxerga na unidade que tem o processo. */
export interface Ator { isAdmin: boolean; gestor: boolean; responsavel: boolean; atribuicao: string }

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** A mesma atribuição, sem contar acento, caixa e espaços a mais ("Promotor de Justiça" = "promotor de justica"). */
export const mesmaAtribuicao = (a: unknown, b: unknown): boolean => {
    const x = sem(String(a ?? ''));
    return !!x && x === sem(String(b ?? ''));
};

/** Reserva saneada. Com 'atribuicao', o nome dela é obrigatório. Lança Error com mensagem para o usuário. */
export function sanitizeQuem(quem: unknown, atribuicao: unknown, onde: string): { quem?: Quem; atribuicao?: string } {
    if (!QUEM.includes(quem as Quem)) return {};
    if (quem !== 'atribuicao') return { quem: quem as Quem };
    const a = texto(atribuicao, MAX_ATRIBUICAO);
    if (!a) throw new Error(`${onde}: informe a atribuição de quem pode, como está na lotação (ex.: Promotor)`);
    return { quem: 'atribuicao', atribuicao: a };
}

/** Permissões da fase saneadas; `undefined` quando nada foi reservado. Lança Error com mensagem para o usuário. */
export function sanitizePermissoes(raw: unknown, nomeFase: string): PermissoesFase | undefined {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const c = sanitizeQuem(o.concluir, o.concluir_atribuicao, `Em "${nomeFase}", quem conclui a fase`);
    const reserva = (v: unknown) => (RESERVAS.includes(v as Reserva) ? (v as Reserva) : undefined);
    const out: PermissoesFase = {
        ...(c.quem ? { concluir: c.quem } : {}), ...(c.atribuicao ? { concluir_atribuicao: c.atribuicao } : {}),
        ...(reserva(o.dispensar) ? { dispensar: reserva(o.dispensar) } : {}),
        ...(reserva(o.desviar) ? { desviar: reserva(o.desviar) } : {}),
        ...(reserva(o.situacao) ? { situacao: reserva(o.situacao) } : {}),
    };
    return Object.keys(out).length ? out : undefined;
}

/** A pessoa atende à reserva? Sem reserva, sempre; a administração, sempre. */
export function podeQuem(quem: Quem | undefined, atribuicao: string | undefined, a: Ator): boolean {
    if (!quem || a.isAdmin) return true;
    if (quem === 'responsavel') return a.responsavel;
    if (quem === 'gestor') return a.gestor;
    return mesmaAtribuicao(atribuicao, a.atribuicao);
}

export const podeReserva = (r: Reserva | undefined, a: Ator): boolean => !r || a.isAdmin || (r === 'gestor' && a.gestor);

/** "só <quem>" para as mensagens. */
export const textoQuem = (quem: Quem, atribuicao?: string): string =>
    (quem === 'responsavel' ? 'o responsável pelo processo' : quem === 'gestor' ? 'quem gere a unidade' : `quem tem a atribuição "${atribuicao || ''}"`);
export const textoReserva = (r: Reserva): string => (r === 'gestor' ? 'quem gere a unidade' : 'a administração do Processo Eletrônico');
