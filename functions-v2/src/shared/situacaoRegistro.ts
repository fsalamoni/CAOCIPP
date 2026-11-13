// Situação do registro ligado ao processo (Consultas e Expedientes), conduzida
// pelo rito: a fase diz em que coluna do quadro o registro fica quando o
// processo entra nela ou quando alguém o assume.
//
// Nos dois módulos a situação é derivada das datas preenchidas
// (`calculateStatus`). Mudar a situação é preencher a data da fase de destino
// e, na volta, apagar as datas das fases seguintes: a mesma regra do quadro
// (`handleDialogConfirm` e `rollbackByStatus` em KanbanBoard.jsx).
import { FIELD_ALIASES, getSmartField } from './fields';

export const SITUACOES = ['Pendente', 'Em elaboração', 'Aguarda retorno de terceiros', 'Em revisão', 'Revisadas', 'Na pasta'] as const;
export type Situacao = typeof SITUACOES[number];
export const MODULOS_SITUACAO = ['consultas', 'expedientes'] as const;
export type ModuloSituacao = typeof MODULOS_SITUACAO[number];

/** O que a fase faz com o registro ligado: ao entrar nela e quando alguém assume o processo nela. */
export interface SituacaoRegistro { modulo: ModuloSituacao; ao_entrar?: Situacao; ao_assumir?: Situacao }

export function sanitizeSituacaoRegistro(raw: unknown): SituacaoRegistro | null {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const modulo = MODULOS_SITUACAO.find((m) => m === r.modulo);
    const de = (v: unknown) => SITUACOES.find((s) => s === v);
    const entrar = de(r.ao_entrar);
    const assumir = de(r.ao_assumir);
    if (!modulo || (!entrar && !assumir)) return null;
    return { modulo, ...(entrar ? { ao_entrar: entrar } : {}), ...(assumir ? { ao_assumir: assumir } : {}) };
}

/** Data que põe o registro em cada situação ("Pendente" é a falta de todas). */
const MARCADOR: Record<Situacao, string | null> = {
    'Pendente': null,
    'Em elaboração': 'analysis_start_date',
    'Aguarda retorno de terceiros': 'third_party_referral_date',
    'Em revisão': 'review_submission_date',
    'Revisadas': 'reviewed_date',
    'Na pasta': 'archived_date',
};

/** O que se apaga para o registro voltar a cada situação (datas das fases seguintes). */
const DEPOIS: Record<Situacao, string[]> = {
    'Pendente': ['analysis_start_date', 'third_party_referral_date', 'third_party_recipient', 'review_submission_date', 'reviewed_date', 'review_return_date', 'archived_date'],
    'Em elaboração': ['third_party_referral_date', 'third_party_recipient', 'review_submission_date', 'reviewed_date', 'review_return_date', 'archived_date'],
    'Aguarda retorno de terceiros': ['review_submission_date', 'reviewed_date', 'review_return_date', 'archived_date'],
    'Em revisão': ['reviewed_date', 'review_return_date', 'archived_date'],
    'Revisadas': ['review_return_date', 'archived_date'],
    'Na pasta': [],
};

const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const preenchido = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';

/** Chaves do documento que guardam o campo (registros importados usam nomes antigos). */
function chavesCom(doc: Record<string, unknown>, campo: string): string[] {
    const nomes = (FIELD_ALIASES[campo] || [campo]).map(normal);
    return Object.keys(doc).filter((k) => nomes.includes(normal(k)) && preenchido(doc[k]));
}

/**
 * Campos a gravar no registro para ele ficar na situação `alvo`. `quem`:
 * a pessoa que assumiu o processo, que vira a responsável ao entrar em
 * elaboração. Datas já preenchidas ficam como estão. `null`: nada muda.
 */
export function mudancasDaSituacao(
    doc: Record<string, unknown>, alvo: Situacao, hoje: string, quem?: { uid: string; nome: string } | null,
): Record<string, unknown> | null {
    const m: Record<string, unknown> = {};
    for (const campo of DEPOIS[alvo]) for (const k of chavesCom(doc, campo)) m[k] = null;
    const falta = (campo: string) => !getSmartField(doc, campo);
    const marcador = MARCADOR[alvo];
    if (marcador && falta(marcador)) m[marcador] = hoje;
    if (alvo === 'Em elaboração') {
        if (falta('distribution_date')) m.distribution_date = hoje;
        if (quem && doc.responsible_user_id !== quem.uid) {
            m.responsible_user_id = quem.uid;
            m.responsible_user_name = quem.nome;
        }
    }
    if (alvo === 'Na pasta' && falta('review_return_date')) m.review_return_date = hoje;
    if (doc.status !== alvo) m.status = alvo;
    return Object.keys(m).length ? m : null;
}

/**
 * O registro do módulo que o processo conduz: aquele de onde ele nasceu ou,
 * sem origem nesse módulo, o único registro dele ligado ao processo.
 */
export function registroDoProcesso(
    proc: { origem?: { ref?: { modulo?: string; id?: string } } | null; vinculos?: unknown }, modulo: string,
): { id: string } | { falta: 'nenhum' | 'varios' } {
    const o = proc.origem?.ref;
    if (o?.modulo === modulo && o.id) return { id: String(o.id) };
    const ids = [...new Set((Array.isArray(proc.vinculos) ? proc.vinculos : []).map(String)
        .filter((v) => v.startsWith(`${modulo}:`)).map((v) => v.slice(modulo.length + 1)))];
    return ids.length === 1 ? { id: ids[0] } : { falta: ids.length ? 'varios' : 'nenhum' };
}
