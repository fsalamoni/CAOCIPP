// ============================================================================
// Painéis dos módulos (Consultas, Expedientes, Parcerias) vistos pelo rito.
//
// Cada painel tem colunas com dois nomes: o id (a situação gravada no
// registro, que o rito usa em `situacao_registro`) e o rótulo que a equipe vê
// no quadro ("Em elaboração" aparece como "Em Análise"). Cada coluna lista o
// que o quadro pede ao mover o cartão para ela (o diálogo do KanbanBoard e,
// em Parcerias, `PARCERIA_PHASE_REQUIREMENTS`) e diz o que o sistema já
// preenche sozinho.
//
// "Leva ao painel" (`RegraAcao.ao_registro`): o dado que a ação pede vai para
// um campo do registro ligado (consulta, expediente, parceria ou registro de
// página própria). Aqui ficam os campos que o rito pode preencher em cada
// módulo e as contas do que gravar. Lógica pura, testada em
// test/painelModulos.test.js. Espelho para a tela: src/lib/painelModulos.js.
// ============================================================================
import type { FieldDef } from '../customEntities/schema';
import { paraCampo } from './registroCriado';
import { validateRecordValues } from '../customEntities/schema';

export const MODULOS_PAINEL = ['consultas', 'expedientes', 'parcerias'] as const;
export type ModuloPainel = typeof MODULOS_PAINEL[number];
/** Módulos para onde a ação leva o dado: os painéis fixos e as páginas próprias. */
export const MODULOS_AO_REGISTRO = [...MODULOS_PAINEL, 'paginas'] as const;
export type ModuloAoRegistro = typeof MODULOS_AO_REGISTRO[number];

/** Tipo do dado que a ação registra (o `tipo` do dado em valorDaAcao). */
export type TipoDado = 'texto' | 'texto_longo' | 'numero' | 'data' | 'lista' | 'sim_nao';

export interface InfoColuna {
    /** Campo do registro. */
    campo: string;
    rotulo: string;
    /** Como o sistema preenche sozinho quando o rito põe o registro na coluna. Ausente: precisa vir de uma ação. */
    auto?: string;
    /** O quadro não deixa mover sem ela. */
    obrigatoria?: true;
}
export interface ColunaPainel { id: string; rotulo: string; infos: InfoColuna[] }

export interface CampoRegistro {
    campo: string;
    rotulo: string;
    /** Tipos de dado da ação que servem para o campo. */
    tipos: readonly TipoDado[];
    /** Data que põe o registro numa coluna (Consultas e Expedientes): só se grava com o registro já nela, para o rito não mudar a coluna por fora. */
    coluna?: string;
}

const TEXTO: readonly TipoDado[] = ['texto', 'lista'];
const LONGO: readonly TipoDado[] = ['texto', 'texto_longo', 'lista'];
const DATA: readonly TipoDado[] = ['data'];

/** Colunas de Consultas e Expedientes (as mesmas nos dois quadros). */
const COLUNAS_CONSULTA = (nome: string): ColunaPainel[] => [
    { id: 'Pendente', rotulo: 'Pendentes', infos: [] },
    { id: 'Em elaboração', rotulo: 'Em Análise', infos: [
        { campo: 'responsible_user_id', rotulo: 'Responsável', auto: 'quem assume o processo na fase (ou quem a fase designa)', obrigatoria: true },
        { campo: 'analysis_start_date', rotulo: 'Início da análise', auto: 'a data em que o registro entra na coluna' },
        { campo: 'distribution_date', rotulo: 'Distribuição', auto: 'a data em que o registro entra na coluna' },
    ] },
    { id: 'Aguarda retorno de terceiros', rotulo: 'Aguarda Terceiros', infos: [
        { campo: 'third_party_referral_date', rotulo: 'Data da remessa a terceiros', auto: 'a data em que o registro entra na coluna', obrigatoria: true },
        { campo: 'third_party_recipient', rotulo: 'Remetido a (terceiro)', obrigatoria: true },
    ] },
    { id: 'Em revisão', rotulo: 'Em Revisão', infos: [
        { campo: 'review_submission_date', rotulo: 'Remessa para revisão', auto: 'a data em que o registro entra na coluna' },
        { campo: 'network_folder', rotulo: 'Pasta na rede', obrigatoria: true },
        { campo: 'observations', rotulo: 'Observações' },
    ] },
    { id: 'Revisadas', rotulo: 'Revisadas', infos: [
        { campo: 'reviewed_date', rotulo: 'Data da revisão', auto: 'a data em que o registro entra na coluna', obrigatoria: true },
    ] },
    { id: 'Na pasta', rotulo: 'Arquivados', infos: [
        { campo: 'review_return_date', rotulo: `Devolução ${nome}`, auto: 'a data em que o registro entra na coluna, se ainda vazia', obrigatoria: true },
        { campo: 'archived_date', rotulo: 'Arquivamento', auto: 'a data em que o registro entra na coluna' },
    ] },
];

/** Campos comuns de Consultas e Expedientes que vêm de ações do rito. */
const CAMPOS_TRAMITE: CampoRegistro[] = [
    { campo: 'entry_date', rotulo: 'Entrada no órgão', tipos: DATA },
    { campo: 'urgency_request', rotulo: 'Urgência', tipos: ['sim_nao'] },
    { campo: 'observations', rotulo: 'Observações', tipos: LONGO },
    { campo: 'third_party_recipient', rotulo: 'Remetido a (terceiro)', tipos: TEXTO },
    { campo: 'third_party_referral_date', rotulo: 'Data da remessa a terceiros', tipos: DATA, coluna: 'Aguarda retorno de terceiros' },
    { campo: 'network_folder', rotulo: 'Pasta na rede', tipos: ['texto'] },
    { campo: 'reviewed_date', rotulo: 'Data da revisão', tipos: DATA, coluna: 'Revisadas' },
    { campo: 'review_return_date', rotulo: 'Data da devolução', tipos: DATA },
];

export interface Painel { nome: string; registro: string; colunas: ColunaPainel[]; campos: CampoRegistro[]; antes?: true }

export const PAINEIS: Record<ModuloPainel, Painel> = {
    consultas: {
        nome: 'Painel de Consultas', registro: 'a consulta', colunas: COLUNAS_CONSULTA('ao consulente'),
        campos: [
            { campo: 'process_number', rotulo: 'Nº da Consulta - PGEA', tipos: ['texto', 'numero'] },
            { campo: 'consultant', rotulo: 'Consulente (quem pediu)', tipos: TEXTO },
            { campo: 'location', rotulo: 'Local', tipos: TEXTO },
            { campo: 'matter_object', rotulo: 'Objeto ou assunto', tipos: LONGO },
            { campo: 'decision', rotulo: 'Decisão ou conclusão', tipos: LONGO },
            ...CAMPOS_TRAMITE,
        ],
    },
    expedientes: {
        nome: 'Painel de Expedientes', registro: 'o expediente', colunas: COLUNAS_CONSULTA('à origem'),
        campos: [
            { campo: 'expediente_number', rotulo: 'Nº do Expediente - PGEA', tipos: ['texto', 'numero'] },
            { campo: 'system', rotulo: 'Sistema', tipos: TEXTO },
            { campo: 'origin', rotulo: 'Origem', tipos: TEXTO },
            { campo: 'object', rotulo: 'Objeto', tipos: LONGO },
            ...CAMPOS_TRAMITE,
        ],
    },
    // Em Parcerias o quadro confere o que cada fase exige ao entrar: o dado precisa chegar antes.
    parcerias: {
        nome: 'Painel de Parcerias', registro: 'a parceria', antes: true,
        colunas: [
            { id: 'Pendente', rotulo: 'Pendentes', infos: [
                { campo: 'pgea', rotulo: 'PGEA', obrigatoria: true }, { campo: 'subject', rotulo: 'Assunto', obrigatoria: true }, { campo: 'parties', rotulo: 'Partes', obrigatoria: true },
            ] },
            { id: 'Em análise', rotulo: 'Em Análise', infos: [
                { campo: 'responsible_user_id', rotulo: 'Assessor responsável', auto: 'quem assume o processo na fase', obrigatoria: true },
                { campo: 'responsibility_date', rotulo: 'Data de responsabilidade', auto: 'a data em que a parceria entra na coluna', obrigatoria: true },
            ] },
            { id: 'Em revisão', rotulo: 'Em Revisão', infos: [
                { campo: 'review_start_date', rotulo: 'Início da revisão', auto: 'a data em que a parceria entra na coluna', obrigatoria: true },
                { campo: 'network_folder', rotulo: 'Pasta na rede', obrigatoria: true },
            ] },
            { id: 'Revisadas', rotulo: 'Revisadas', infos: [{ campo: 'reviewed_date', rotulo: 'Conclusão da revisão', auto: 'a data em que a parceria entra na coluna', obrigatoria: true }] },
            { id: 'Aguarda Terceiros', rotulo: 'Aguarda Terceiros', infos: [
                { campo: 'third_party_referral_date', rotulo: 'Data da remessa a terceiros', auto: 'a data em que a parceria entra na coluna', obrigatoria: true },
                { campo: 'third_party', rotulo: 'Remetido para', obrigatoria: true },
            ] },
            { id: 'Parcerias', rotulo: 'Parcerias', infos: [
                { campo: 'third_party_return_date', rotulo: 'Retorno de terceiros', obrigatoria: true },
                { campo: 'partnership_type', rotulo: 'Tipo de parceria', obrigatoria: true },
                { campo: 'signature_date', rotulo: 'Data da assinatura', obrigatoria: true },
                { campo: 'demp', rotulo: 'Publicação no DEMP', obrigatoria: true },
                { campo: 'validity_period', rotulo: 'Vigência', obrigatoria: true },
                { campo: 'object', rotulo: 'Objeto', obrigatoria: true },
                { campo: 'end_date', rotulo: 'Termo final', obrigatoria: true },
                { campo: 'renewal_notice_date', rotulo: 'Aviso de renovação', obrigatoria: true },
            ] },
        ],
        campos: [
            { campo: 'pgea', rotulo: 'PGEA', tipos: ['texto', 'numero'] },
            { campo: 'subject', rotulo: 'Assunto', tipos: LONGO },
            { campo: 'parties', rotulo: 'Partes', tipos: LONGO },
            { campo: 'object', rotulo: 'Objeto', tipos: LONGO },
            { campo: 'observations', rotulo: 'Observações', tipos: LONGO },
            { campo: 'network_folder', rotulo: 'Pasta na rede', tipos: ['texto'] },
            { campo: 'third_party', rotulo: 'Remetido para', tipos: TEXTO },
            { campo: 'third_party_referral_date', rotulo: 'Data da remessa a terceiros', tipos: DATA },
            { campo: 'third_party_return_date', rotulo: 'Retorno de terceiros', tipos: DATA },
            { campo: 'partnership_type', rotulo: 'Tipo de parceria', tipos: TEXTO },
            { campo: 'partnership_number', rotulo: 'Número da parceria', tipos: ['texto', 'numero'] },
            { campo: 'signature_date', rotulo: 'Data da assinatura', tipos: DATA },
            { campo: 'demp', rotulo: 'Publicação no DEMP', tipos: TEXTO },
            { campo: 'validity_period', rotulo: 'Vigência', tipos: TEXTO },
            { campo: 'end_date', rotulo: 'Termo final', tipos: DATA },
            { campo: 'renewal_notice_date', rotulo: 'Aviso de renovação', tipos: DATA },
        ],
    },
};

/** Rótulo da coluna como a equipe vê no quadro. */
export const rotuloDaColuna = (modulo: string, id: string): string =>
    (PAINEIS as Record<string, Painel>)[modulo]?.colunas.find((c) => c.id === id)?.rotulo || id;

// ---------------------------------------------------------------------------
// "Leva ao painel"
// ---------------------------------------------------------------------------

/** Para onde a ação leva o dado. Na ação de formulário, `campos`: { id do campo da ação: campo do registro }. */
export interface AoRegistro { modulo: ModuloAoRegistro; pagina?: string; campo?: string; campos?: Record<string, string> }

const CHAVE = /^[a-z][a-z0-9_]{0,39}$/;
const ID_PAGINA = /^[A-Za-z0-9_-]{1,128}$/;
/** O que a ação pede e que pode ir ao registro. */
const PEDIDOS_LEVAVEIS = ['texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao', 'formulario'];
const TIPOS_FORM = ['texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao'];

/**
 * Saneia "Leva ao painel". Só ação que pede dado (e não reservado); nas
 * consultas, expedientes e parcerias, só para os campos de `PAINEIS` e do
 * tipo que combina. Nas páginas, a chave do campo (o servidor confere a
 * página ao salvar o rito, `aoRegistroInvalido`).
 */
export function sanitizeAoRegistro(raw: unknown, regra: { pede?: string; ve?: string; campos?: Array<{ id: string; tipo: string }> }): AoRegistro | null {
    const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null) as Record<string, unknown> | null;
    if (!r || regra.ve || !regra.pede || !PEDIDOS_LEVAVEIS.includes(regra.pede)) return null;
    const modulo = MODULOS_AO_REGISTRO.find((m) => m === r.modulo);
    if (!modulo) return null;
    const pagina = modulo === 'paginas' && typeof r.pagina === 'string' && ID_PAGINA.test(r.pagina) ? r.pagina : '';
    if (modulo === 'paginas' && !pagina) return null;
    const serve = (campo: unknown, tipo: string): campo is string => {
        if (typeof campo !== 'string' || !CHAVE.test(campo)) return false;
        if (modulo === 'paginas') return true;
        const def = PAINEIS[modulo].campos.find((c) => c.campo === campo);
        return !!def && def.tipos.includes(tipo as TipoDado);
    };
    const base = { modulo, ...(pagina ? { pagina } : {}) };
    if (regra.pede === 'formulario') {
        const bruto = (r.campos && typeof r.campos === 'object' ? r.campos : {}) as Record<string, unknown>;
        const usados = new Set<string>();
        const campos: Record<string, string> = {};
        for (const c of regra.campos || []) {
            const alvo = bruto[c.id];
            if (!TIPOS_FORM.includes(c.tipo) || !serve(alvo, c.tipo) || usados.has(alvo)) continue;
            usados.add(alvo);
            campos[c.id] = alvo;
        }
        return Object.keys(campos).length ? { ...base, campos } : null;
    }
    return serve(r.campo, regra.pede) ? { ...base, campo: r.campo } : null;
}

/** Um valor que a ação leva: o campo do registro, o tipo do dado e o valor como a ação gravou. */
export interface ParLevado { campo: string; tipo: string; rotulo: string; valor: unknown }

/** Os pares a levar, a partir do dado da ação (`valor` do formulário: a lista de campos preenchidos). */
export function paresDaAcao(ao: AoRegistro, dado: { tipo: string; rotulo: string; valor: unknown }): ParLevado[] {
    if (ao.campos) {
        const lista = (Array.isArray(dado.valor) ? dado.valor : []) as Array<{ id: string; tipo: string; rotulo: string; valor: unknown }>;
        return lista.filter((c) => ao.campos![c.id]).map((c) => ({ campo: ao.campos![c.id], tipo: c.tipo, rotulo: c.rotulo, valor: c.valor }));
    }
    return ao.campo ? [{ campo: ao.campo, tipo: dado.tipo, rotulo: dado.rotulo, valor: dado.valor }] : [];
}

const vazio = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Situação de Consultas e Expedientes pelas datas (a mesma conta de `calculateStatus`). */
function colunaPelasDatas(doc: Record<string, unknown>): string {
    if (!vazio(doc.archived_date)) return 'Na pasta';
    if (!vazio(doc.reviewed_date)) return 'Revisadas';
    if (!vazio(doc.review_submission_date)) return 'Em revisão';
    if (!vazio(doc.third_party_referral_date)) return 'Aguarda retorno de terceiros';
    if (!vazio(doc.analysis_start_date)) return 'Em elaboração';
    return String(doc.status || 'Pendente');
}

/**
 * O que gravar numa consulta, expediente ou parceria. Texto é aparado e
 * limitado; data precisa ser AAAA-MM-DD; sim/não vira booleano. Data que
 * marca coluna só vale com o registro já nela. `fora`: o que não foi levado e por quê.
 */
export function camposParaModulo(modulo: ModuloPainel, doc: Record<string, unknown>, pares: ParLevado[]): { campos: Record<string, unknown>; levados: string[]; fora: string[] } {
    const campos: Record<string, unknown> = {};
    const levados: string[] = [];
    const fora: string[] = [];
    for (const p of pares) {
        const def = PAINEIS[modulo].campos.find((c) => c.campo === p.campo);
        if (!def || vazio(p.valor)) continue;
        let v: unknown = p.valor;
        if (def.tipos.includes('data') && def.tipos.length === 1) {
            if (typeof v !== 'string' || !DATA_ISO.test(v)) { fora.push(`${def.rotulo}: data inválida`); continue; }
            if (def.coluna && modulo !== 'parcerias' && colunaPelasDatas(doc) !== def.coluna) {
                fora.push(`${def.rotulo}: só se ajusta com ${PAINEIS[modulo].registro} em "${rotuloDaColuna(modulo, def.coluna)}" (a data mudaria a coluna por fora do rito)`);
                continue;
            }
        } else if (def.tipos.includes('sim_nao')) {
            v = v === true || v === 'sim';
        } else {
            v = String(v).trim().slice(0, def.tipos.includes('texto_longo') ? 5000 : 500);
            if (!v) continue;
        }
        campos[def.campo] = v;
        levados.push(`${def.rotulo}: ${v === true ? 'Sim' : v === false ? 'Não' : String(v)}`);
    }
    return { campos, levados, fora };
}

/**
 * O que gravar num registro de página própria: cada valor convertido para o
 * tipo do campo (`paraCampo`) e conferido pelas regras do campo. Campo de
 * pessoa da equipe não recebe valor do processo.
 */
export function camposParaPagina(fields: FieldDef[], doc: Record<string, unknown>, pares: ParLevado[]): { campos: Record<string, unknown>; levados: string[]; fora: string[] } {
    const valores: Record<string, unknown> = {};
    const levados: string[] = [];
    const fora: string[] = [];
    for (const p of pares) {
        const f = fields.find((x) => x.key === p.campo);
        if (!f) { fora.push(`${p.rotulo}: o campo não existe mais na página`); continue; }
        if (f.type === 'user_ref' || vazio(p.valor)) continue;
        const bruto = typeof p.valor === 'boolean' ? (p.valor ? 'sim' : 'nao') : p.valor;
        const v = paraCampo(f, bruto as never);
        const r = validateRecordValues([{ ...f, required: false }], { [f.key]: v });
        if (!r.ok) { fora.push(`${f.label}: ${Object.values(r.errors)[0]}`); continue; }
        valores[f.key] = r.normalized[f.key];
        levados.push(`${f.label}: ${Array.isArray(v) ? v.join(', ') : v === true ? 'Sim' : v === false ? 'Não' : String(v)}`);
    }
    const antes = (doc.values && typeof doc.values === 'object' ? doc.values : {}) as Record<string, unknown>;
    return { campos: levados.length ? { values: { ...antes, ...valores } } : {}, levados, fora };
}

/** Campos de página que as ações levam e a página não tem (ou é de pessoa). `tipos`: id -> tipo da página. */
export function aoRegistroInvalido(
    fases: Array<{ nome?: string; acoes?: string[]; acoes_regras?: Array<{ ao_registro?: AoRegistro } | null> }>,
    tipos: Record<string, { fields?: FieldDef[] } | null | undefined>,
): string[] {
    const erros: string[] = [];
    for (const f of fases) {
        (f.acoes_regras || []).forEach((r, i) => {
            const ao = r?.ao_registro;
            if (ao?.modulo !== 'paginas') return;
            const tipo = tipos[String(ao.pagina)];
            const acao = f.acoes?.[i] || `ação ${i + 1}`;
            if (!tipo) { erros.push(`A ação "${acao}" (fase ${f.nome || ''}) leva o dado a uma página própria que não existe mais.`); return; }
            for (const k of [ao.campo, ...Object.values(ao.campos || {})].filter(Boolean) as string[]) {
                const def = (tipo.fields || []).find((x) => x.key === k);
                if (!def) erros.push(`A ação "${acao}" (fase ${f.nome || ''}) leva o dado ao campo "${k}", que a página não tem.`);
                else if (def.type === 'user_ref') erros.push(`A ação "${acao}" (fase ${f.nome || ''}) leva o dado a "${def.label}", que é uma pessoa da equipe: escolha outro campo.`);
            }
        });
    }
    return erros;
}

// ---------------------------------------------------------------------------
// Consulta ou expediente criado na autuação
// ---------------------------------------------------------------------------

/** Campos da consulta e do expediente que o tipo de processo preenche na autuação, no formato de página (para reaproveitar `registroCriado`). */
export const CAMPOS_CRIACAO: Record<'consultas' | 'expedientes', FieldDef[]> = {
    consultas: [
        { key: 'process_number', label: 'Nº da Consulta - PGEA', type: 'text', required: true },
        { key: 'consultant', label: 'Consulente (quem pediu)', type: 'text', required: true },
        { key: 'location', label: 'Local', type: 'text' },
        { key: 'entry_date', label: 'Entrada no órgão', type: 'date' },
        { key: 'matter_object', label: 'Objeto ou assunto', type: 'textarea' },
        { key: 'urgency_request', label: 'Urgência', type: 'boolean' },
        { key: 'observations', label: 'Observações', type: 'textarea' },
    ],
    expedientes: [
        { key: 'expediente_number', label: 'Nº do Expediente - PGEA', type: 'text', required: true },
        { key: 'system', label: 'Sistema', type: 'text' },
        { key: 'origin', label: 'Origem', type: 'text' },
        { key: 'entry_date', label: 'Entrada no órgão', type: 'date' },
        { key: 'object', label: 'Objeto', type: 'textarea' },
        { key: 'urgency_request', label: 'Urgência', type: 'boolean' },
        { key: 'observations', label: 'Observações', type: 'textarea' },
    ],
};
export const NOME_CRIACAO: Record<'consultas' | 'expedientes', { singular: string; plural: string }> = {
    consultas: { singular: 'Consulta', plural: 'Consultas' },
    expedientes: { singular: 'Expediente', plural: 'Expedientes' },
};

/**
 * Documento novo de consulta ou expediente, no formato de createProcess e
 * createExpediente: Pendente, sem datas de tramitação. `valores` já
 * normalizados pelos campos de `CAMPOS_CRIACAO`.
 */
export function docDoModulo(modulo: 'consultas' | 'expedientes', valores: Record<string, unknown>): Record<string, unknown> {
    const s = (k: string) => (typeof valores[k] === 'string' ? String(valores[k]) : '');
    const tramite = {
        status: 'Pendente', urgency_request: valores.urgency_request === true, entry_date: s('entry_date') || null, observations: s('observations'),
        distribution_date: null, responsible_user_id: null, responsible_user_name: null, analysis_start_date: null,
        review_submission_date: null, reviewed_date: null, review_return_date: null, archived_date: null, network_folder: '',
    };
    return modulo === 'consultas'
        ? { process_number: s('process_number'), consultant: s('consultant'), location: s('location'), matter_object: s('matter_object'), matter_category: '', matter_subcategory: '', access_restriction: false, decision: '', ...tramite }
        : { expediente_number: s('expediente_number'), system: s('system'), origin: s('origin'), object: s('object'), ...tramite };
}

/** A consulta ou o expediente como "página" (campos e nome), para as contas de shared/registroCriado.ts. */
export const defDaCriacao = (m: 'consultas' | 'expedientes') => ({ label_singular: NOME_CRIACAO[m].singular, label_plural: NOME_CRIACAO[m].plural, enabled: true, fields: CAMPOS_CRIACAO[m], phases: [] });
