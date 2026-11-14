// Situação do registro ligado ao processo (Consultas, Expedientes e páginas
// próprias), conduzida pelo rito: a fase diz em que coluna do quadro o
// registro fica quando o processo entra nela ou quando alguém o assume.
//
// Em Consultas e Expedientes a situação é derivada das datas preenchidas
// (`calculateStatus`). Mudar a situação é preencher a data da fase de destino
// e, na volta, apagar as datas das fases seguintes: a mesma regra do quadro
// (`handleDialogConfirm` e `rollbackByStatus` em KanbanBoard.jsx).
//
// Numa página própria a situação é a fase do registro (`phase`), e a mudança
// passa pelas regras de transição do tipo (`evaluatePhaseTransition`), como no
// quadro da página (`updateRecord`).
import { evaluatePhaseTransition, TransitionContext } from '../customEntities/transitions';
import type { EntityTypeDef } from '../customEntities/schema';
import { FIELD_ALIASES, getSmartField } from './fields';

export const SITUACOES = ['Pendente', 'Em elaboração', 'Aguarda retorno de terceiros', 'Em revisão', 'Revisadas', 'Na pasta'] as const;
export type Situacao = typeof SITUACOES[number];
export const MODULOS_SITUACAO = ['consultas', 'expedientes', 'paginas'] as const;
export type ModuloSituacao = typeof MODULOS_SITUACAO[number];

/**
 * O que a fase faz com o registro ligado: ao entrar nela e quando alguém assume
 * o processo nela. Em Consultas e Expedientes o alvo é uma das `SITUACOES`. Em
 * `paginas`, `pagina` é o id do tipo e o alvo é a chave de uma fase dele.
 */
export interface SituacaoRegistro { modulo: ModuloSituacao; pagina?: string; ao_entrar?: string; ao_assumir?: string }

const ID_PAGINA = /^[A-Za-z0-9_-]{1,128}$/;
const CHAVE_FASE = /^[a-z][a-z0-9_]{0,39}$/; // mesma regra das fases do tipo (SLUG_RE em customEntities/schema.ts)

export function sanitizeSituacaoRegistro(raw: unknown): SituacaoRegistro | null {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const modulo = MODULOS_SITUACAO.find((m) => m === r.modulo);
    if (!modulo) return null;
    const pagina = modulo === 'paginas' && typeof r.pagina === 'string' && ID_PAGINA.test(r.pagina) ? r.pagina : '';
    if (modulo === 'paginas' && !pagina) return null;
    const de = (v: unknown): string | undefined => (modulo === 'paginas'
        ? (typeof v === 'string' && CHAVE_FASE.test(v) ? v : undefined)
        : SITUACOES.find((s) => s === v));
    const entrar = de(r.ao_entrar);
    const assumir = de(r.ao_assumir);
    if (!entrar && !assumir) return null;
    return { modulo, ...(pagina ? { pagina } : {}), ...(entrar ? { ao_entrar: entrar } : {}), ...(assumir ? { ao_assumir: assumir } : {}) };
}

/** Chave do registro conduzido: uma por módulo e, nas páginas próprias, uma por página. */
export const chaveDoRegistro = (s: { modulo: string; pagina?: string }): string => (s.modulo === 'paginas' ? `paginas:${s.pagina || ''}` : s.modulo);

/** Fases de páginas próprias que o rito cita e o tipo não tem (ou a página não existe). `tipos`: id -> tipo da página. */
export function fasesDePaginaInvalidas(
    fases: Array<{ nome?: string; situacao_registro?: SituacaoRegistro }>, tipos: Record<string, { phases?: Array<{ key?: string }> } | null | undefined>,
): string[] {
    const erros: string[] = [];
    for (const f of fases) {
        const s = f.situacao_registro;
        if (s?.modulo !== 'paginas') continue;
        const tipo = tipos[String(s.pagina)];
        if (!tipo) { erros.push(`A fase "${f.nome || ''}" conduz o registro de uma página própria que não existe mais.`); continue; }
        const chaves = new Set((tipo.phases || []).map((p) => p.key));
        for (const alvo of [s.ao_entrar, s.ao_assumir]) {
            if (alvo && !chaves.has(alvo)) erros.push(`A fase "${f.nome || ''}" manda o registro da página para a fase "${alvo}", que a página não tem.`);
        }
    }
    return erros;
}

/**
 * Página própria: o que gravar no registro para ele ir à fase `alvo`, pelas
 * regras de transição do tipo, com quem pratica o ato no processo. `motivo`: a
 * regra do tipo não deixa (campo faltando, aprovação de outra pessoa). `null`:
 * já está na fase.
 */
export function mudancasDaPagina(
    tipo: EntityTypeDef, doc: Record<string, unknown>, alvo: string, quem: TransitionContext, hoje: string,
): { campos: Record<string, unknown>; de: string; para: string } | { motivo: string; para: string } | null {
    const atual = String(doc.phase || '');
    if (atual === alvo) return null;
    const rotulo = (k: string) => (tipo.phases || []).find((p) => p.key === k)?.label || k || 'sem fase';
    const valores = { ...((doc.values && typeof doc.values === 'object' ? doc.values : {}) as Record<string, unknown>) };
    const r = evaluatePhaseTransition(tipo, atual, alvo, valores, quem);
    if (!r.allowed) return { motivo: r.reason || 'A regra da página não permite a mudança.', para: rotulo(alvo) };
    const fixos = r.rule?.on_success?.set_fields || [];
    for (const sf of fixos) valores[sf.field] = sf.value === 'now' ? hoje : sf.value;
    return { campos: { phase: alvo, ...(fixos.length ? { values: valores } : {}) }, de: rotulo(atual), para: rotulo(alvo) };
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
    doc: Record<string, unknown>, alvoPedido: string, hoje: string, quem?: { uid: string; nome: string } | null,
): Record<string, unknown> | null {
    const alvo = SITUACOES.find((s) => s === alvoPedido);
    if (!alvo) return null;
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
