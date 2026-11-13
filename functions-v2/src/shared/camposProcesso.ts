// ============================================================================
// Formulário de autuação por tipo de processo: como o "Novo processo" mostra
// cada campo padrão (assunto, descrição, partes, origem, sigilo, urgência e
// unidade: uso, nome e orientação), que polos as partes podem ter, os campos
// próprios do órgão e a validação do que foi preenchido. Lógica pura, testada em
// test/camposProcesso.test.js. O cliente tem o espelho em
// src/lib/camposProcesso.js (só para a tela; quem decide é o servidor).
// ============================================================================

import { MODULOS, Modulo, ROTULO_MODULO, Ref, idEscolhido } from './modulos';

// Sem importar ./secretaria: o rito (./exigencias, que ./secretaria importa) usa os campos
// na ação que pede um formulário. O mesmo corte de texto de lá.
const MAX_TEXTO_CURTO = 200;
const MAX_TEXTO_LONGO = 4000;
const texto = (v: unknown, max = MAX_TEXTO_CURTO) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const TIPOS_CAMPO = ['texto', 'texto_longo', 'numero', 'data', 'lista', 'multipla', 'sim_nao', 'registro'] as const;
export type TipoCampo = typeof TIPOS_CAMPO[number];
/** Formato que valida e mostra o valor: os de texto curto e, para número, moeda. */
export const FORMATOS = ['email', 'telefone', 'cpf_cnpj', 'link', 'moeda'] as const;
export type Formato = typeof FORMATOS[number];
const FORMATO_DO_TIPO: Record<Formato, TipoCampo> = { email: 'texto', telefone: 'texto', cpf_cnpj: 'texto', link: 'texto', moeda: 'numero' };
const COM_OPCOES: TipoCampo[] = ['lista', 'multipla'];
/** Campos que podem decidir se outro aparece. */
const CONDICIONANTES: TipoCampo[] = ['lista', 'multipla', 'sim_nao'];
export const MAX_CAMPOS = 40;
export const MAX_OPCOES = 30;
const USOS = ['opcional', 'obrigatorio', 'oculto'] as const;
export type UsoCampo = typeof USOS[number];

export interface CampoDef {
    id: string;
    rotulo: string;
    tipo: TipoCampo;
    obrigatorio: boolean;
    ajuda: string;
    opcoes: string[];
    /** Aparece para as partes no portal. Por padrão, não. */
    visivel_partes: boolean;
    formato?: Formato;
    /** Título de seção mostrado antes do primeiro campo dela. */
    secao?: string;
    /** Só aparece (e só vale) quando um campo anterior tem este valor. */
    condicao?: Condicao;
    /** Fases do rito que só se deixam com o campo preenchido (na autuação, opcional). */
    exigir_em?: string[];
    /** Registro de outro módulo (tipo 'registro'): de qual. */
    modulo?: Modulo;
}
export interface Condicao { campo_id: string; valor: string | boolean }
/** Campos padrão do "Novo processo". Os de escolha (sigilo, urgência, unidade) só se mostram ou não. */
export const PADROES = ['assunto', 'descricao', 'partes', 'origem', 'sigilo', 'urgencia', 'unidade'] as const;
export type Padrao = typeof PADROES[number];
const DE_ESCOLHA: Padrao[] = ['sigilo', 'urgencia', 'unidade'];
export const ROTULO_PADRAO: Record<Padrao, string> = {
    assunto: 'Assunto', descricao: 'Descrição', partes: 'Partes e interessados', origem: 'Origem',
    sigilo: 'Sigilo', urgencia: 'Tramitação urgente', unidade: 'Unidade',
};
export const POLOS = ['requerente', 'requerido', 'interessado', 'terceiro'] as const;

export interface Formulario {
    assunto: UsoCampo;
    descricao: UsoCampo;
    partes: UsoCampo;
    origem: UsoCampo;
    /** oculto = vale o sigilo padrão do tipo. */
    sigilo: UsoCampo;
    /** oculto = urgente só se o tipo for urgente. */
    urgencia: UsoCampo;
    /** oculto = a unidade sugerida no tipo (ou a de quem autua), sem escolher. */
    unidade: UsoCampo;
    /** Nome e orientação próprios para os campos padrão (vazio = o de sempre). */
    rotulos: Partial<Record<Padrao, string>>;
    ajudas: Partial<Record<Padrao, string>>;
    /** Polos que as partes podem ter neste tipo. */
    polos: string[];
    campos: CampoDef[];
}
export type Valor = string | number | boolean | string[];
export interface CampoValor {
    id: string;
    rotulo: string;
    tipo: TipoCampo;
    valor: Valor;
    visivel_partes: boolean;
    formato?: Formato;
    /** Registro de outro módulo: `valor` é o número; aqui, de onde veio. */
    ref?: Ref;
}

const uso = (v: unknown, padrao: UsoCampo = 'opcional'): UsoCampo => (USOS.includes(v as UsoCampo) ? (v as UsoCampo) : padrao);
// Sigilo, urgência e unidade são escolhas: aparecem (opcional) ou não (oculto).
const usoDe = (k: Padrao, v: unknown): UsoCampo => {
    if (DE_ESCOLHA.includes(k)) return v === 'oculto' ? 'oculto' : 'opcional';
    return uso(v, k === 'assunto' ? 'obrigatorio' : 'opcional');
};
const textos = (v: unknown, max: number): Partial<Record<Padrao, string>> => {
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    return Object.fromEntries(PADROES.map((k) => [k, texto(o[k], max)]).filter(([, s]) => s));
};
const polosDe = (v: unknown): string[] => {
    const l = POLOS.filter((p) => Array.isArray(v) && v.includes(p));
    return l.length ? l : [...POLOS];
};
const padroesDe = (f: Record<string, unknown>) => ({
    assunto: usoDe('assunto', f.assunto), descricao: usoDe('descricao', f.descricao), partes: usoDe('partes', f.partes),
    origem: usoDe('origem', f.origem), sigilo: usoDe('sigilo', f.sigilo), urgencia: usoDe('urgencia', f.urgencia), unidade: usoDe('unidade', f.unidade),
    rotulos: textos(f.rotulos, 60), ajudas: textos(f.ajudas, 200), polos: polosDe(f.polos),
});

/** Nome do campo padrão neste formulário. */
export const rotuloDe = (form: Pick<Formulario, 'rotulos'>, k: Padrao) => form.rotulos?.[k] || ROTULO_PADRAO[k];
const igual = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;

/** Formulário gravado no tipo, com os padrões para o que faltar (tipos antigos não têm). */
export function formularioDe(tipo: { formulario?: unknown } | null | undefined): Formulario {
    const f = (tipo?.formulario && typeof tipo.formulario === 'object' ? tipo.formulario : {}) as Record<string, unknown>;
    return { ...padroesDe(f), campos: Array.isArray(f.campos) ? (f.campos as CampoDef[]) : [] };
}

/**
 * Saneia uma lista de campos (do tipo de processo ou da ação que pede um
 * formulário): nome, tipo, opções, módulo, formato, condição e nomes repetidos.
 * Lança Error com mensagem para o usuário. O teto de quantidade fica com quem chama.
 */
export function sanitizeCampos(lista: unknown[]): CampoDef[] {
    const ids = new Set<string>();
    const campos: CampoDef[] = lista.map((x, i) => {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        const rotulo = texto(o.rotulo, 80);
        if (!rotulo) throw new Error(`Dê um nome ao campo ${i + 1}`);
        const tipo = TIPOS_CAMPO.includes(o.tipo as TipoCampo) ? (o.tipo as TipoCampo) : 'texto';
        const opcoes = COM_OPCOES.includes(tipo)
            ? [...new Set((Array.isArray(o.opcoes) ? o.opcoes : []).map((s) => texto(s, 80)).filter(Boolean))].slice(0, MAX_OPCOES)
            : [];
        if (COM_OPCOES.includes(tipo) && opcoes.length < 2) throw new Error(`O campo "${rotulo}" é uma lista: informe ao menos duas opções`);
        const modulo = tipo === 'registro' && MODULOS.includes(o.modulo as Modulo) ? (o.modulo as Modulo) : undefined;
        if (tipo === 'registro' && !modulo) throw new Error(`Escolha de que módulo vem o registro de "${rotulo}"`);
        const formato = FORMATOS.includes(o.formato as Formato) && FORMATO_DO_TIPO[o.formato as Formato] === tipo ? (o.formato as Formato) : undefined;
        const secao = texto(o.secao, 60);
        const exigir = [...new Set((Array.isArray(o.exigir_em) ? o.exigir_em : []).map((s) => texto(s, 60)).filter(Boolean))].slice(0, 30);
        // O id identifica o campo nos processos já autuados: não muda quando o nome muda.
        let id = typeof o.id === 'string' && /^[a-z0-9_]{1,24}$/.test(o.id) ? o.id : '';
        if (!id || ids.has(id)) id = `c${Date.now().toString(36)}${i}`;
        ids.add(id);
        return {
            id, rotulo, tipo, obrigatorio: o.obrigatorio === true && !exigir.length, ajuda: texto(o.ajuda), opcoes, visivel_partes: o.visivel_partes === true,
            ...(formato ? { formato } : {}), ...(modulo ? { modulo } : {}), ...(secao ? { secao } : {}), ...(exigir.length ? { exigir_em: exigir } : {}),
            ...(o.condicao && typeof o.condicao === 'object' ? { condicao: o.condicao as Condicao } : {}),
        };
    });
    // Condição: aponta um campo de escolha que vem antes, e um valor que ele aceita.
    campos.forEach((c, i) => {
        if (!c.condicao) return;
        const alvo = campos.slice(0, i).find((d) => d.id === String(c.condicao!.campo_id));
        if (!alvo || !CONDICIONANTES.includes(alvo.tipo)) {
            throw new Error(`"${c.rotulo}" só pode depender de um campo de lista ou de sim ou não que venha antes dele`);
        }
        const v = c.condicao.valor;
        const valor = alvo.tipo === 'sim_nao' ? (v === true || v === 'sim' ? true : v === false || v === 'nao' ? false : null) : typeof v === 'string' && alvo.opcoes.includes(texto(v, 80)) ? texto(v, 80) : null;
        if (valor === null) throw new Error(`Escolha quando "${c.rotulo}" aparece: um valor de "${alvo.rotulo}"`);
        c.condicao = { campo_id: alvo.id, valor };
    });
    campos.forEach((c, i) => {
        if (campos.some((d, j) => j < i && igual(d.rotulo, c.rotulo))) throw new Error(`Há dois campos chamados "${c.rotulo}"`);
    });
    return campos;
}

/** Saneia o formulário vindo do cliente. Lança Error com mensagem para o usuário. */
export function sanitizeFormulario(input: unknown): Formulario {
    const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const lista = Array.isArray(src.campos) ? src.campos : [];
    if (lista.length > MAX_CAMPOS) throw new Error(`O tipo aceita até ${MAX_CAMPOS} campos próprios`);
    const campos = sanitizeCampos(lista);
    const padroes = padroesDe(src);
    const reservados = [...Object.values(padroes.rotulos) as string[], 'assunto', 'descrição', 'descricao', 'partes'];
    campos.forEach((c) => {
        if (reservados.some((r) => igual(r, c.rotulo))) throw new Error(`"${c.rotulo}" já é um campo padrão do processo`);
    });
    if (padroes.assunto === 'oculto' && padroes.descricao === 'oculto' && padroes.partes === 'oculto' && !campos.length) {
        throw new Error('O formulário ficaria sem nada para identificar o processo: use ao menos o assunto, a descrição, as partes ou um campo próprio');
    }
    return { ...padroes, campos };
}

const vazio = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);

const digitos = (s: string) => s.replace(/\D/g, '');
// Valor de cada caractere no cálculo: dígito vale o próprio número; letra (CNPJ alfanumérico) vale o código ASCII menos 48.
function dv(base: string, pesos: number[]): number {
    const r = pesos.reduce((t, p, i) => t + (base.charCodeAt(i) - 48) * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
}
/**
 * CPF (11 dígitos) ou CNPJ (14 posições; as 12 primeiras podem ter letras,
 * IN RFB 2.229/2024), com os dígitos verificadores. Devolve formatado ou null.
 */
export function cpfCnpj(s: string): string | null {
    const d = s.toUpperCase().replace(/[\s./-]/g, '');
    if (/^(.)\1+$/.test(d)) return null;
    if (/^\d{11}$/.test(d)) {
        const ok = dv(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[9]) && dv(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[10]);
        return ok ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : null;
    }
    if (/^[0-9A-Z]{12}\d{2}$/.test(d)) {
        const ok = dv(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12]) && dv(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13]);
        return ok ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : null;
    }
    return null;
}

/** Endereço da internet só http ou https; sem esquema, vale https (exemplo.org:8080 é porta, não esquema). */
export function linkValido(s: string): string | null {
    let u: URL | null = null;
    const comEsquema = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s);
    try { u = new URL(comEsquema ? s : `https://${s}`); } catch { u = null; }
    if (!u || !['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.') || u.href.length > 500) return null;
    return u.href;
}

/** Texto curto conforme o formato. Lança Error se não servir. */
function comFormato(rotulo: string, formato: Formato | undefined, s: string): string {
    if (formato === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 120) throw new Error(`"${rotulo}" precisa ser um e-mail válido`);
        return s.toLowerCase();
    }
    if (formato === 'telefone') {
        const n = digitos(s).length;
        if (!/^[\d\s()+.-]+$/.test(s) || s.length > 40 || n < 10 || n > 13) throw new Error(`"${rotulo}" precisa ser um telefone com DDD`);
        return s;
    }
    if (formato === 'cpf_cnpj') {
        const f = cpfCnpj(s);
        if (!f) throw new Error(`"${rotulo}" precisa ser um CPF ou CNPJ válido`);
        return f;
    }
    if (formato === 'link') {
        const href = linkValido(s);
        if (!href) throw new Error(`"${rotulo}" precisa ser um endereço da internet`);
        return href;
    }
    return s;
}

/** Um valor, já no formato de gravar; null se veio vazio. Lança Error se inválido. */
export function valorDe(c: Pick<CampoDef, 'rotulo' | 'tipo' | 'opcoes'> & { formato?: Formato }, v: unknown): Valor | null {
    if (vazio(v)) return null;
    if (c.tipo === 'multipla') {
        const l = [...new Set((Array.isArray(v) ? v : [v]).map((x) => String(x ?? '').trim()).filter(Boolean))];
        if (l.some((x) => !c.opcoes.includes(x))) throw new Error(`Escolha entre as opções de "${c.rotulo}"`);
        // Na ordem das opções, para mostrar e comparar sempre igual.
        return l.length ? c.opcoes.filter((x) => l.includes(x)) : null;
    }
    if (c.tipo === 'sim_nao') {
        if (v === true || v === 'sim') return true;
        if (v === false || v === 'nao') return false;
        throw new Error(`Responda sim ou não em "${c.rotulo}"`);
    }
    if (c.tipo === 'numero') {
        const s = typeof v === 'number' ? String(v) : String(v).trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
        const n = Number(s);
        if (!/^-?\d+(\.\d+)?$/.test(s) || !Number.isFinite(n)) throw new Error(`"${c.rotulo}" precisa ser um número`);
        const r = c.formato === 'moeda' ? Math.round(n * 100) / 100 : n;
        if (!Number.isFinite(r) || Math.abs(r) > 1e15) throw new Error(`"${c.rotulo}" está fora do limite`);
        return r;
    }
    const s = String(v).trim();
    if (c.tipo === 'data') {
        const d = new Date(`${s}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new Error(`"${c.rotulo}" precisa ser uma data válida`);
        return s;
    }
    if (c.tipo === 'lista') {
        if (!c.opcoes.includes(s)) throw new Error(`Escolha uma das opções de "${c.rotulo}"`);
        return s;
    }
    if (c.tipo === 'texto' && c.formato) return comFormato(c.rotulo, c.formato, s);
    return s.slice(0, c.tipo === 'texto_longo' ? MAX_TEXTO_LONGO : MAX_TEXTO_CURTO);
}

/** O valor atende a condição? (lista: igual; múltipla: entre os marcados; sim ou não: igual). */
export const atendeCondicao = (valor: Valor | null | undefined, cond: Condicao) =>
    Array.isArray(valor) ? valor.includes(String(cond.valor)) : valor === cond.valor;

/**
 * Confere o que foi preenchido contra o formulário do tipo e devolve os campos
 * a gravar no processo (cópia do nome e do tipo: mudar o tipo depois não
 * altera processos já autuados). Lança Error com mensagem para o usuário.
 */
/** O valor veio igual ao gravado, como a tela o mostra (espelho de valoresDe no cliente)? */
function igualAoGravado(a: CampoValor, bruto: unknown): boolean {
    if (a.tipo === 'registro') return !!a.ref && idEscolhido(bruto) === a.ref.id;
    if (Array.isArray(a.valor)) return Array.isArray(bruto) && bruto.length === a.valor.length && bruto.every((x, i) => x === (a.valor as string[])[i]);
    if (a.tipo === 'sim_nao') return bruto === a.valor || bruto === (a.valor ? 'sim' : 'nao');
    if (a.tipo === 'numero') return bruto === a.valor || String(bruto ?? '').trim() === String(a.valor).replace('.', ',');
    return typeof bruto === 'string' && bruto.trim() === String(a.valor);
}

/**
 * `antes` (ao corrigir os dados): valor que voltou igual ao gravado fica como
 * está, mesmo que o tipo tenha mudado depois (formato, opções, tipo do campo).
 * Assim um processo antigo não trava nem ganha diferença que ninguém fez.
 */
export function validarCampos(form: Formulario, valores: unknown, antes: CampoValor[] = [], refs: Map<string, Ref | null | 'desligada'> = new Map()): CampoValor[] {
    const v = (valores && typeof valores === 'object' ? valores : {}) as Record<string, unknown>;
    const out: CampoValor[] = [];
    const lidos = new Map<string, Valor>();
    const gravados = new Map(antes.map((a) => [a.id, a]));
    for (const c of form.campos) {
        // Campo que não aparece (a condição não se cumpre) não vale nem é exigido.
        if (c.condicao && !atendeCondicao(lidos.get(c.condicao.campo_id), c.condicao)) continue;
        const gravado = gravados.get(c.id);
        if (gravado && igualAoGravado(gravado, v[c.id])) {
            lidos.set(c.id, gravado.valor);
            out.push({ ...gravado, rotulo: c.rotulo, visivel_partes: c.visivel_partes && !gravado.ref?.restrito });
            continue;
        }
        if (c.tipo === 'registro') {
            // O servidor já leu o registro escolhido (refs); do cliente só vale o id.
            const id = idEscolhido(v[c.id]);
            if (!id) {
                if (c.obrigatorio && !c.exigir_em?.length) throw new Error(`Escolha "${c.rotulo}"`);
                continue;
            }
            const ref = refs.get(c.id);
            if (ref === 'desligada') throw new Error(`A integração com ${ROTULO_MODULO[c.modulo!]} está desligada neste órgão: "${c.rotulo}" não pode ser escolhido agora`);
            if (!ref || ref.id !== id || ref.modulo !== c.modulo) throw new Error(`"${c.rotulo}": registro não encontrado em ${ROTULO_MODULO[c.modulo!] || 'outro módulo'}`);
            lidos.set(c.id, ref.numero);
            out.push({ id: c.id, rotulo: c.rotulo, tipo: 'registro', valor: ref.numero, ref, visivel_partes: c.visivel_partes && !ref.restrito });
            continue;
        }
        const valor = valorDe(c, v[c.id]);
        if (valor === null) {
            if (c.obrigatorio && !c.exigir_em?.length) throw new Error(`Preencha "${c.rotulo}"`);
            continue;
        }
        lidos.set(c.id, valor);
        out.push({ id: c.id, rotulo: c.rotulo, tipo: c.tipo, valor, visivel_partes: c.visivel_partes, ...(c.formato ? { formato: c.formato } : {}) });
    }
    return out;
}

export interface CampoExigido { id: string; rotulo: string; condicao?: Condicao }
/** Na autuação: por fase do processo, os campos exigidos para sair dela. */
export function camposExigidos(form: Formulario, faseIds: string[]): Record<string, CampoExigido[]> {
    const out: Record<string, CampoExigido[]> = {};
    for (const c of form.campos) {
        for (const f of c.exigir_em || []) {
            if (faseIds.includes(f)) (out[f] ||= []).push({ id: c.id, rotulo: c.rotulo, ...(c.condicao ? { condicao: c.condicao } : {}) });
        }
    }
    return out;
}

/**
 * Campos exigidos na fase que o processo ainda não tem (os que não aparecem
 * pela condição não contam). Com `form` (o do tipo hoje), só conta o campo que
 * o tipo ainda pede, com o nome e a condição de agora: o que o tipo deixou de
 * ter não teria como ser preenchido.
 */
export function camposFaltando(exigidos: CampoExigido[] | undefined, campos: CampoValor[] | undefined, form?: Pick<Formulario, 'campos'> | null): CampoExigido[] {
    const tem = new Map((campos || []).map((c) => [c.id, c.valor]));
    const atuais = form ? new Map(form.campos.map((c) => [c.id, c])) : null;
    const out: CampoExigido[] = [];
    for (const e of exigidos || []) {
        const def = atuais ? atuais.get(e.id) : e;
        if (!def || tem.has(e.id)) continue;
        if (def.condicao && !atendeCondicao(tem.get(def.condicao.campo_id), def.condicao)) continue;
        out.push({ id: e.id, rotulo: def.rotulo, ...(def.condicao ? { condicao: def.condicao } : {}) });
    }
    return out;
}

/** Confere os campos padrão conforme o tipo. */
export function validarPadrao(form: Formulario, v: { assunto: string; descricao: string; partes: unknown[]; origem: unknown }): void {
    if (form.assunto === 'obrigatorio' && !v.assunto) throw new Error(`Preencha "${rotuloDe(form, 'assunto')}"`);
    if (form.descricao === 'obrigatorio' && !v.descricao) throw new Error(`Preencha "${rotuloDe(form, 'descricao')}"`);
    if (form.partes === 'obrigatorio' && !v.partes.length) throw new Error(`Informe ao menos um item em "${rotuloDe(form, 'partes')}"`);
    if (form.origem === 'obrigatorio' && !v.origem) throw new Error(`Informe "${rotuloDe(form, 'origem')}"`);
}

/** Valor como texto, para movimentos, busca e PDF. */
export function valorTexto(c: Pick<CampoValor, 'tipo' | 'valor'> & { formato?: Formato; ref?: Ref }): string {
    if (c.tipo === 'registro' && c.ref?.titulo) return `${c.valor} (${c.ref.titulo})`;
    if (Array.isArray(c.valor)) return c.valor.join(', ');
    if (c.tipo === 'sim_nao') return c.valor ? 'Sim' : 'Não';
    if (c.tipo === 'data') return String(c.valor).split('-').reverse().join('/');
    if (c.tipo === 'numero' && c.formato === 'moeda') {
        return `R$ ${Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (c.tipo === 'numero') return String(c.valor).replace('.', ',');
    return String(c.valor);
}

/**
 * O dado de uma ação que pede um formulário: os campos preenchidos (sem a
 * marca de partes, que é da ação), em texto "Campo: valor; ..." e os
 * registros escolhidos (restrito se algum for).
 */
export function dadoDoFormulario(rotulo: string, campos: CampoValor[]) {
    const refs = campos.map((c) => c.ref).filter((r): r is Ref => !!r);
    return {
        rotulo, tipo: 'formulario' as const,
        valor: campos.map(({ visivel_partes: _v, ...c }) => c),
        // Registro só pelo número (como a ação que pede um registro): o título pode não ser das partes.
        valor_texto: campos.map((c) => `${c.rotulo}: ${c.tipo === 'registro' ? c.valor : valorTexto(c)}`).join('; '),
        ref: undefined, refs, restrito: refs.some((r) => r.restrito === true),
    };
}

/**
 * Formulário para corrigir os dados de um processo já autuado: campo que o
 * processo nunca teve, mas que apareceria com os valores gravados, deixa de
 * ser obrigatório (o tipo ganhou o obrigatório depois); campo que só estava
 * oculto pela condição segue cobrado quando aparece; campo já gravado segue
 * obrigatório (não se apaga). A descrição que ficou obrigatória depois não
 * trava processo que nunca a teve.
 */
export function formParaCorrecao<T extends Pick<Formulario, 'campos'> & { descricao?: UsoCampo }>(form: T, antes: CampoValor[], descricaoAntes?: string): T {
    const tinha = new Set(antes.map((a) => a.id));
    const valores = new Map(antes.map((a) => [a.id, a.valor]));
    const aparecia = (c: CampoDef) => !c.condicao || atendeCondicao(valores.get(c.condicao.campo_id), c.condicao);
    return {
        ...form,
        ...(form.descricao === 'obrigatorio' && descricaoAntes !== undefined && !descricaoAntes.trim() ? { descricao: 'opcional' } : {}),
        campos: form.campos.map((c) => (c.obrigatorio && !tinha.has(c.id) && aparecia(c) ? { ...c, obrigatorio: false } : c)),
    };
}

/** O que mudou entre os campos gravados e os novos, em frases para o movimento. */
export function diferencasCampos(antes: CampoValor[], depois: CampoValor[]): string[] {
    const a = new Map(antes.map((c) => [c.id, c]));
    const d = new Map(depois.map((c) => [c.id, c]));
    const curto = (s: string) => (s.length > 80 ? `${s.slice(0, 79)}…` : s);
    // Registro: outro registro com o mesmo número e título também é mudança.
    const chave = (c: CampoValor) => `${valorTexto(c)}|${c.ref ? `${c.ref.modulo}:${c.ref.id}` : ''}`;
    const out: string[] = [];
    for (const c of depois) {
        const ant = a.get(c.id);
        if (!ant) out.push(`${c.rotulo}: "${curto(valorTexto(c))}"`);
        else if (chave(ant) !== chave(c) && valorTexto(ant) === valorTexto(c)) out.push(`${c.rotulo}: trocado por outro registro com o mesmo número ("${curto(valorTexto(c))}")`);
        else if (valorTexto(ant) !== valorTexto(c)) out.push(`${c.rotulo}: de "${curto(valorTexto(ant))}" para "${curto(valorTexto(c))}"`);
    }
    for (const c of antes) if (!d.has(c.id)) out.push(`${c.rotulo}: apagado (era "${curto(valorTexto(c))}")`);
    return out;
}
