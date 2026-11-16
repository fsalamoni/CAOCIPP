/**
 * Pacote para levar a outro órgão o que este órgão montou: um rito inteiro
 * (com as unidades, os modelos de documento e o tipo de processo que usa) ou
 * um modelo de documento. O rito sai pronto do servidor (`exportarRito`,
 * functions-v2/src/shared/pacoteRito.ts), sem nada que identifique o órgão de
 * origem. Aqui se lê o arquivo e se casa o pacote com o órgão que importa:
 * unidade e modelo de mesmo nome são os do órgão; o que falta vira novo para
 * criar. Tudo passa pela revisão na tela e pela conferência do servidor ao
 * implantar; os modelos da plataforma (biblioteca) não mudam com nada disso.
 */
import { sem } from './propostaRito.js';

export const FORMATO_PACOTE = 'sigo-pacote';
export const VERSAO_PACOTE = 1;
export const MAX_MB_PACOTE = 5;

const NAO_E = 'Este arquivo não é um pacote do SIGO. Use o arquivo .json baixado em "Exportar para outro órgão".';

/** Lê o texto do arquivo. Lança Error com mensagem para a pessoa. */
export function lerPacote(texto) {
    let p;
    try { p = JSON.parse(String(texto || '')); } catch { throw new Error(NAO_E); }
    if (!p || typeof p !== 'object' || p.formato !== FORMATO_PACOTE) throw new Error(NAO_E);
    if (!(Number(p.versao) >= 1)) throw new Error(NAO_E);
    if (Number(p.versao) > VERSAO_PACOTE) throw new Error('Este pacote foi feito por uma versão mais nova do SIGO. Atualize a página e tente de novo.');
    if (p.conteudo === 'rito') {
        if (!p.rito || !Array.isArray(p.rito.fases) || !p.rito.fases.length) throw new Error('O pacote não traz as fases do rito.');
        return p;
    }
    if (p.conteudo === 'documento') {
        if (!p.modelo || typeof p.modelo.nome !== 'string' || !p.modelo.conteudo) throw new Error('O pacote não traz o texto do modelo.');
        return p;
    }
    throw new Error(NAO_E);
}

const lista = (v) => (Array.isArray(v) ? v : []);
const txt = (v, max = 120) => String(v ?? '').trim().slice(0, max);

/**
 * Pacote de rito → proposta da tela do rito, já casada com o órgão.
 * `paginas`: páginas próprias do órgão ([{ id, nome }]).
 * Devolve { proposta, tipo } (tipo: o do pacote, para criar junto, ou null).
 */
export function propostaDePacote(pac, estado, paginas = []) {
    const avisos = [...lista(pac.avisos).map((a) => txt(a, 300)).filter(Boolean)];
    const unidades = [];
    const modelos = [];
    const existentes = lista(estado?.unidades).filter((u) => u.ativa !== false && !u.excluida);
    const mapaUn = new Map();
    for (const u of lista(pac.unidades)) {
        const n = sem(u.nome);
        const achou = n && existentes.find((x) => sem(x.nome) === n || (u.sigla && x.sigla && sem(x.sigla) === sem(u.sigla)));
        if (achou) { mapaUn.set(u.ref, achou.id); continue; }
        const ref = `+${unidades.length}`;
        unidades.push({ ref, nome: txt(u.nome) || 'Unidade', sigla: txt(u.sigla, 12), tipo: txt(u.tipo, 40) || 'outra' });
        mapaUn.set(u.ref, ref);
    }
    const unDe = (r) => (r ? mapaUn.get(r) || null : null);
    const mapaMod = new Map();
    const doOrgao = lista(estado?.modelos).filter((m) => !m.excluido);
    for (const m of lista(pac.modelos)) {
        const unidade_ref = unDe(m.unidade);
        const n = sem(m.nome);
        const achou = n && doOrgao.find((x) => sem(x.nome) === n && (!x.unidade_id || x.unidade_id === unidade_ref));
        if (achou) {
            mapaMod.set(m.ref, achou.id);
            avisos.push(`O órgão já tem o modelo "${achou.nome}": ele é usado no lugar do que veio no pacote.`);
            continue;
        }
        const ref = `+${modelos.length}`;
        modelos.push({
            ref, nome: txt(m.nome) || 'Modelo', unidade_ref, tipo_documento: txt(m.tipo_documento, 60),
            ...(m.descricao ? { descricao: txt(m.descricao, 500) } : {}), ...(m.conteudo ? { conteudo: m.conteudo } : {}),
        });
        mapaMod.set(m.ref, ref);
    }
    const modDe = (r) => (r ? mapaMod.get(r) : undefined);
    const comModelo = (e) => {
        if (!e?.modelo_id) return e;
        const { modelo_id, ...resto } = e;
        const id = modDe(modelo_id);
        return id ? { ...resto, modelo_id: id } : resto;
    };
    // Página própria: casa pelo nome com as do órgão.
    const mapaPg = new Map(lista(pac.paginas).map((p) => [p.ref, lista(paginas).find((x) => sem(x.nome) === sem(p.nome))?.id || '']));
    const nomePg = (r) => lista(pac.paginas).find((p) => p.ref === r)?.nome || 'página própria';
    const pgDe = (r) => mapaPg.get(r) || '';

    const fases = lista(pac.rito.fases).map((f0, i) => {
        const { unidade, modelos: ms, ...f } = f0;
        const rot = txt(f.nome) || `Fase ${i + 1}`;
        let situacao_registro = f.situacao_registro;
        if (situacao_registro?.modulo === 'paginas') {
            const id = pgDe(situacao_registro.pagina);
            if (id) situacao_registro = { ...situacao_registro, pagina: id };
            else {
                avisos.push(`${rot} conduzia o registro da página "${nomePg(situacao_registro.pagina)}", que este órgão não tem: a regra saiu. Refaça em "Andamento automático", se quiser.`);
                situacao_registro = undefined;
            }
        }
        const acoes_regras = f.acoes_regras && lista(f.acoes_regras).map((r, k) => {
            if (!r) return r;
            let out = r.documento ? { ...r, documento: comModelo(r.documento) } : r;
            const acao = txt(lista(f.acoes)[k]) || 'ação';
            if (out.modulo === 'paginas') {
                const id = pgDe(out.pagina);
                if (!id) avisos.push(`Em ${rot}, a ação "${acao}" pede um registro da página "${nomePg(out.pagina)}", que este órgão não tem: escolha a página na ação.`);
                out = { ...out, pagina: id };
            }
            if (out.campos) {
                out = {
                    ...out, campos: lista(out.campos).map((c) => {
                        if (c?.modulo !== 'paginas') return c;
                        const id = pgDe(c.pagina);
                        if (!id) avisos.push(`Em ${rot}, o campo "${txt(c.rotulo)}" da ação "${acao}" pede um registro da página "${nomePg(c.pagina)}", que este órgão não tem: escolha a página no campo.`);
                        return { ...c, pagina: id };
                    }),
                };
            }
            return out;
        });
        const sit = situacao_registro ? { situacao_registro } : {};
        const { situacao_registro: _s, ...semSit } = f;
        return {
            ...semSit, ...sit,
            unidade_ref: unDe(unidade),
            modelos_ref: [...new Set(lista(ms).map(modDe).filter(Boolean))],
            ...(f.documentos ? { documentos: lista(f.documentos).map(comModelo) } : {}),
            ...(acoes_regras ? { acoes_regras } : {}),
        };
    });

    let tipo = null;
    if (pac.tipo?.nome) {
        let formulario = pac.tipo.formulario;
        if (formulario?.campos) {
            // Campo de página que o órgão não tem sai do tipo (e o que dependia dele).
            const fora = new Set();
            const campos = lista(formulario.campos).flatMap((c) => {
                if (c?.modulo !== 'paginas') return [c];
                const id = pgDe(c.pagina);
                if (id) return [{ ...c, pagina: id }];
                fora.add(c.id);
                avisos.push(`O campo "${txt(c.rotulo)}" do tipo ${txt(pac.tipo.nome)} vinha da página "${nomePg(c.pagina)}", que este órgão não tem: saiu do tipo.`);
                return [];
            }).map((c) => {
                if (!fora.size) return c;
                const { importar, condicao, ...resto } = c;
                return { ...resto, ...(importar && !fora.has(importar.de) ? { importar } : {}), ...(condicao && !fora.has(condicao.campo_id) ? { condicao } : {}) };
            });
            formulario = { ...formulario, campos };
        }
        tipo = { nome: txt(pac.tipo.nome), sigla: txt(pac.tipo.sigla, 12), ...(formulario ? { formulario } : {}), ...(pac.tipo.descricao ? { descricao: txt(pac.tipo.descricao, 2000) } : {}) };
    }

    return {
        proposta: {
            nome: txt(pac.rito.nome) || 'Rito importado', descricao: txt(pac.rito.descricao, 2000), exigir_tipo: pac.rito.exigir_tipo === true,
            fases, unidades, modelos, avisos: [...new Set(avisos)],
        },
        tipo,
    };
}

/** Troca, nas fases, um modelo novo ("+N") por outro (inclusive no "modelo indicado" dos documentos exigidos). */
export function trocarModeloNasFases(fases, ref, id) {
    const doc = (e) => (e?.modelo_id === ref ? { ...e, modelo_id: id } : e);
    return fases.map((f) => ({
        ...f,
        modelos_ref: [...new Set((f.modelos_ref || []).map((x) => (x === ref ? id : x)).filter(Boolean))],
        ...(f.documentos ? { documentos: f.documentos.map(doc) } : {}),
        ...(f.acoes_regras ? { acoes_regras: f.acoes_regras.map((r) => (r?.documento ? { ...r, documento: doc(r.documento) } : r)) } : {}),
    }));
}

/** Modelo de documento (como vem de `obterModelo`) → pacote. Só o que serve ao outro órgão. */
export function pacoteDeDocumento(m, agora = new Date().toISOString()) {
    return {
        formato: FORMATO_PACOTE, versao: VERSAO_PACOTE, conteudo: 'documento', gerado_em: agora,
        modelo: { nome: m.nome, ...(m.tipo_documento ? { tipo_documento: m.tipo_documento } : {}), ...(m.descricao ? { descricao: m.descricao } : {}), conteudo: m.conteudo },
    };
}

/** Nome do arquivo, sem acento (o navegador troca nome acentuado por "download" em alguns casos). */
export const nomeArquivoPacote = (prefixo, nome) => `${prefixo}-${sem(nome).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'sem-nome'}.json`;

export function baixarPacote(pacote, arquivo) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(pacote, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = arquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
