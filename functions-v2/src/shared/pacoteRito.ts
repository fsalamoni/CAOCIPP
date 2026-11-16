// ============================================================================
// Pacote de rito para levar a outro órgão: o rito inteiro (todas as regras das
// fases e ações), as unidades e os modelos de documento que ele usa, com o
// texto, e o tipo de processo que o usa. Nada do órgão de origem vai junto:
// sem ids de unidade, modelo ou órgão, sem quem criou, sem e-mail. Unidades e
// modelos viram referências locais ("u1", "m1"); páginas próprias vão pelo
// nome, para o outro órgão casar com as suas. Quem importa revisa tudo na
// tela do rito e o servidor confere de novo ao implantar (aplicarPropostaRito).
// Lógica pura, testada em test/pacoteRito.test.js.
// ============================================================================
import type { Rito } from './secretaria';

export const FORMATO_PACOTE = 'sigo-pacote';
export const VERSAO_PACOTE = 1;

export interface UnidadeOrigem { id: string; nome: string; sigla?: string; tipo?: string }
export interface ModeloOrigem { id: string; nome: string; tipo_documento?: string; descricao?: string; unidade_id?: string | null; formato?: string; conteudo?: unknown }
export interface TipoOrigem { nome: string; sigla?: string; descricao?: string; formulario?: unknown; sigilo_padrao?: string }

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : null);

/** Ids de páginas próprias citadas no rito e no formulário do tipo (para mandar o nome junto). */
export function paginasCitadas(rito: Rito, formulario?: unknown): string[] {
    const ids = new Set<string>();
    const deCampos = (cs: unknown) => (Array.isArray(cs) ? cs : []).forEach((c) => { const o = obj(c); if (o?.modulo === 'paginas' && typeof o.pagina === 'string') ids.add(o.pagina); });
    for (const f of rito.fases) {
        if (f.situacao_registro?.modulo === 'paginas' && f.situacao_registro.pagina) ids.add(f.situacao_registro.pagina);
        for (const r of f.acoes_regras || []) {
            if (r?.modulo === 'paginas' && r.pagina) ids.add(r.pagina);
            deCampos(r?.campos);
        }
    }
    deCampos(obj(formulario)?.campos);
    return [...ids];
}

/**
 * Monta o pacote. `rito` já saneado (sanitizeRito); `unidades` e `modelos`, os
 * do órgão (só entram os que o rito cita); `paginas`, id → nome das páginas
 * próprias do órgão. Modelo guardado como arquivo original não leva o texto
 * (vai o nome, e o outro órgão completa ou importa o arquivo à parte).
 */
export function pacoteDoRito(rito: Rito, ctx: {
    unidades: UnidadeOrigem[]; modelos: ModeloOrigem[]; tipo?: TipoOrigem | null; paginas?: Record<string, string>; agora?: string;
}) {
    const refUn = new Map<string, string>();
    const refMod = new Map<string, string>();
    const avisos: string[] = [];
    const un = (id?: string | null) => {
        if (!id) return null;
        if (!refUn.has(id) && ctx.unidades.some((u) => u.id === id)) refUn.set(id, `u${refUn.size + 1}`);
        return refUn.get(id) || null;
    };
    const mod = (id?: string) => {
        if (!id) return undefined;
        if (!refMod.has(id) && ctx.modelos.some((m) => m.id === id)) refMod.set(id, `m${refMod.size + 1}`);
        return refMod.get(id);
    };
    const comModelo = <T extends { modelo_id?: string }>(e: T): T => {
        if (!e?.modelo_id) return e;
        const { modelo_id, ...resto } = e;
        const r = mod(modelo_id);
        return (r ? { ...resto, modelo_id: r } : resto) as T;
    };
    const fases = rito.fases.map((f) => {
        const { unidade_id, modelos, ...resto } = f;
        const documentos = resto.documentos?.map(comModelo);
        const acoes_regras = resto.acoes_regras?.map((r) => (r?.documento ? { ...r, documento: comModelo(r.documento) } : r));
        // Modelo citado só como "modelo indicado" de documento exigido também entra nos modelos da fase.
        const indicados = [...(documentos || []), ...(acoes_regras || []).map((r) => r?.documento)].map((d) => d?.modelo_id).filter((x): x is string => !!x);
        const ms = [...new Set([...(modelos || []).map(mod).filter((x): x is string => !!x), ...indicados])];
        return {
            ...resto, unidade: un(unidade_id), modelos: ms,
            ...(documentos ? { documentos } : {}), ...(acoes_regras ? { acoes_regras } : {}),
        };
    });
    const unidades = [...refUn].map(([id, ref]) => {
        const u = ctx.unidades.find((x) => x.id === id)!;
        return { ref, nome: u.nome, ...(u.sigla ? { sigla: u.sigla } : {}), ...(u.tipo ? { tipo: u.tipo } : {}) };
    });
    const modelos = [...refMod].map(([id, ref]) => {
        const m = ctx.modelos.find((x) => x.id === id)!;
        const original = m.formato === 'original';
        if (original) avisos.push(`O modelo "${m.nome}" é um arquivo original (Word ou PDF): vai só o nome. Baixe o arquivo no órgão de origem e importe-o em Documentos.`);
        return {
            ref, nome: m.nome, ...(m.tipo_documento ? { tipo_documento: m.tipo_documento } : {}), ...(m.descricao ? { descricao: m.descricao } : {}),
            unidade: un(m.unidade_id), conteudo: original ? null : (m.conteudo ?? null),
        };
    });
    // Página própria vai como "p1" com o nome; o outro órgão casa pelo nome com as suas.
    const ids = paginasCitadas(rito, ctx.tipo?.formulario);
    const refPg = new Map(ids.map((id, i) => [id, `p${i + 1}`]));
    const paginas = ids.map((id) => ({ ref: refPg.get(id)!, nome: ctx.paginas?.[id] || '' }));
    const pg = <T>(o: T): T => {
        const x = obj(o);
        return (x?.modulo === 'paginas' && typeof x.pagina === 'string' ? { ...x, pagina: refPg.get(x.pagina) || '' } : o) as T;
    };
    const comPaginas = (cs: unknown) => (Array.isArray(cs) ? cs.map(pg) : cs);
    const fasesPg = fases.map((f) => ({
        ...f,
        ...(f.situacao_registro ? { situacao_registro: pg(f.situacao_registro) } : {}),
        ...(f.acoes_regras ? { acoes_regras: f.acoes_regras.map((r) => (r ? { ...pg(r), ...(r.campos ? { campos: comPaginas(r.campos) } : {}) } : r)) } : {}),
    }));
    const form = obj(ctx.tipo?.formulario);
    const tipo = ctx.tipo ? {
        nome: ctx.tipo.nome, ...(ctx.tipo.sigla ? { sigla: ctx.tipo.sigla } : {}), ...(ctx.tipo.descricao ? { descricao: ctx.tipo.descricao } : {}),
        ...(form ? { formulario: { ...form, ...(form.campos ? { campos: comPaginas(form.campos) } : {}) } } : {}), ...(ctx.tipo.sigilo_padrao === 'restrito' ? { sigilo_padrao: 'restrito' } : {}),
    } : null;
    return {
        formato: FORMATO_PACOTE, versao: VERSAO_PACOTE, conteudo: 'rito', gerado_em: ctx.agora || new Date().toISOString(),
        rito: { nome: rito.nome, descricao: rito.descricao || '', exigir_tipo: rito.exigir_tipo === true, fases: fasesPg },
        unidades, modelos, paginas, tipo, avisos,
    };
}
