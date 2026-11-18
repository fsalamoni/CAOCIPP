/**
 * "Criar registro na autuação": o tipo de processo pode criar, ao autuar, um
 * registro numa página própria do órgão, com valores tirados do processo
 * (número, assunto, campos do formulário...) ou fixos. O registro fica ligado
 * ao processo (vínculos) e é o que o rito conduz quando a fase tem regra
 * para essa página. Página própria é interna: nada dela vai às partes.
 * Espelho das fontes e dos rótulos em src/lib/registroCriado.js.
 */
import type { CampoValor } from './camposProcesso';
import { ID_PAGINA } from './modulos';
import { phasesReachedUpTo, initialPhase, validateRecordValues } from '../customEntities/schema';
import type { FieldDef, PhaseDef } from '../customEntities/schema';

export const FONTES = ['numero', 'assunto', 'descricao', 'autuacao', 'unidade', 'tipo', 'partes', 'fixo'] as const;
export type Fonte = typeof FONTES[number] | `campo:${string}`;
export interface ValorDoRegistro { campo: string; de: Fonte; valor?: string }
export interface CriaRegistro { pagina: string; modulo?: ModuloCriacao; fase?: string; valores: ValorDoRegistro[] }
/** O que a autuação usa da página: os campos e as fases. */
export interface PaginaDef { label_singular?: unknown; enabled?: unknown; fields?: FieldDef[]; phases?: PhaseDef[] }

const MAX_VALORES = 40;
const CHAVE = /^[a-z][a-z0-9_]{0,39}$/;
const ID_CAMPO = /^campo:[a-z0-9_]{1,24}$/;

/** Módulos fixos onde a autuação também cria o registro (os campos estão em shared/painelModulos.ts, CAMPOS_CRIACAO). */
export const MODULOS_CRIACAO = ['consultas', 'expedientes'] as const;
export type ModuloCriacao = typeof MODULOS_CRIACAO[number];

/** Limpa o que veio da tela. Sem página nem módulo: null (o tipo não cria registro). */
export function sanitizeCriaRegistro(v: unknown): CriaRegistro | null {
    const o = (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
    const modulo = MODULOS_CRIACAO.find((m) => m === o.modulo);
    const pagina = modulo ? '' : typeof o.pagina === 'string' ? o.pagina.trim() : '';
    if (!modulo && !ID_PAGINA.test(pagina)) return null;
    const vistos = new Set<string>();
    const valores: ValorDoRegistro[] = [];
    for (const x of (Array.isArray(o.valores) ? o.valores : []).slice(0, MAX_VALORES)) {
        const campo = typeof x?.campo === 'string' ? x.campo : '';
        const de = typeof x?.de === 'string' ? x.de : '';
        if (!CHAVE.test(campo) || vistos.has(campo) || !((FONTES as readonly string[]).includes(de) || ID_CAMPO.test(de))) continue;
        vistos.add(campo);
        valores.push(de === 'fixo' ? { campo, de, valor: String(x.valor ?? '').slice(0, 500) } : { campo, de: de as Fonte });
    }
    if (modulo) return { pagina: '', modulo, valores };
    const fase = typeof o.fase === 'string' && CHAVE.test(o.fase) ? o.fase : '';
    return { pagina, ...(fase ? { fase } : {}), valores };
}

/** Fase em que o registro nasce: a escolhida (se ainda existe na página) ou a inicial. */
export const faseDoRegistro = (cfg: CriaRegistro, def: PaginaDef): string =>
    (cfg.fase && (def.phases || []).some((p) => p.key === cfg.fase) ? cfg.fase : initialPhase(def));

/** Conferência ao salvar o tipo: página, fase, campos e as fontes que o formulário tem. */
export function errosCriaRegistro(cfg: CriaRegistro, def: PaginaDef | null, form: { campos: Array<{ id: string }> }): string[] {
    if (!def) return ['A página própria escolhida em "Criar registro na autuação" não existe mais. Escolha outra ou desligue a opção.'];
    const nome = String(def.label_singular || 'Página');
    if (def.enabled === false) return [`A página ${nome} está desativada. Ative-a em Páginas personalizadas ou escolha outra.`];
    const campos = def.fields || [];
    const erros: string[] = [];
    if (cfg.fase && !(def.phases || []).some((p) => p.key === cfg.fase)) erros.push(`A fase escolhida para o registro não existe mais em ${nome}.`);
    const ids = new Set(form.campos.map((c) => `campo:${c.id}`));
    for (const v of cfg.valores) {
        const f = campos.find((x) => x.key === v.campo);
        if (!f) { erros.push(`Um campo escolhido não existe mais em ${nome}. Tire-o da lista.`); continue; }
        if (f.type === 'user_ref') erros.push(`"${f.label}" é uma pessoa da equipe e não recebe valor do processo. Tire-o da lista.`);
        else if (v.de.startsWith('campo:') && !ids.has(v.de)) erros.push(`"${f.label}": o campo do formulário escolhido não existe mais neste tipo.`);
        else if (v.de === 'fixo') {
            if (!String(v.valor ?? '').trim()) erros.push(`"${f.label}": informe o valor fixo.`);
            else {
                const r = validateRecordValues([f], { [f.key]: paraCampo(f, v.valor ?? '') });
                if (!r.ok) erros.push(Object.values(r.errors)[0]);
            }
        }
    }
    // O que a página exige já na fase em que o registro nasce precisa de uma fonte.
    const alcancadas = phasesReachedUpTo(def, faseDoRegistro(cfg, def));
    for (const f of campos) {
        if (f.required && (!f.phase || alcancadas.has(f.phase)) && !cfg.valores.some((v) => v.campo === f.key)) {
            erros.push(`"${f.label}" é obrigatório em ${nome}: diga de onde vem o valor.`);
        }
    }
    return erros;
}

type Bruto = string | number | boolean | string[] | null;

/** Converte o valor do processo para o tipo do campo da página (o que não casa fica como veio e a validação recusa). */
export function paraCampo(f: Pick<FieldDef, 'type' | 'options'>, b: Bruto | undefined): unknown {
    if (b === null || b === undefined || b === '' || (Array.isArray(b) && !b.length)) return null;
    const opcao = (s: string) => (f.options || []).find((o) => o.value === s || o.label.toLowerCase() === s.toLowerCase())?.value ?? s;
    const lista = Array.isArray(b) ? b.map(String) : String(b).split(',').map((s) => s.trim()).filter(Boolean);
    switch (f.type) {
        case 'number':
        case 'currency': return typeof b === 'number' ? b : Number(String(b).replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
        case 'date': {
            const s = String(b);
            const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
            return br ? `${br[3]}-${br[2]}-${br[1]}` : s;
        }
        case 'boolean': return b === true || /^(sim|true)$/i.test(String(b));
        case 'select': return opcao(Array.isArray(b) ? String(b[0]) : String(b));
        case 'multiselect': return lista.map(opcao);
        default: return Array.isArray(b) ? b.join(', ') : typeof b === 'boolean' ? (b ? 'Sim' : 'Não') : String(b);
    }
}

/** O processo recém-autuado, no que serve de fonte. */
export interface DadosDaAutuacao { numero: string; assunto: string; descricao: string; hoje: string; unidade: string; tipo: string; partes: string[]; campos: CampoValor[] }

/** Valores do registro novo, no formato da página (a validação da página vem depois). */
export function valoresDoRegistro(cfg: CriaRegistro, def: PaginaDef, d: DadosDaAutuacao): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const v of cfg.valores) {
        const f = (def.fields || []).find((x) => x.key === v.campo);
        if (!f || f.type === 'user_ref') continue;
        const campo = v.de.startsWith('campo:') ? d.campos.find((c) => `campo:${c.id}` === v.de) : undefined;
        const bruto: Bruto | undefined = v.de === 'numero' ? d.numero : v.de === 'assunto' ? d.assunto : v.de === 'descricao' ? d.descricao
            : v.de === 'autuacao' ? d.hoje : v.de === 'unidade' ? d.unidade : v.de === 'tipo' ? d.tipo : v.de === 'partes' ? d.partes
                : v.de === 'fixo' ? v.valor ?? '' : (campo?.valor as Bruto | undefined) ?? null;
        out[f.key] = paraCampo(f, bruto);
    }
    return out;
}
