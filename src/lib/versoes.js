// Diferença entre uma versão guardada e a atual (rito ou tipo), para o "Ver"
// das versões. Só leitura. "adicionadas" = estão na versão vista e não na
// atual; "removidas" = estão na atual e não na versão vista.
// Fase e campo casam pelo id; ação pelo texto (renomear = sai uma, entra outra).
// ponytail: ação casa pelo texto e regra.se.acao é índice; casar por id de ação se o editor passar a ter um.
import { PADROES } from './camposProcesso.js';

const vazio = (x) => x == null || x === '' || x === false || (Array.isArray(x) && !x.length) || (typeof x === 'object' && !Array.isArray(x) && !Object.keys(x).length);
// Ordem das chaves, ausente, '', false, [] e {} não contam como diferença (dados antigos x saneados).
const estavel = (v) => {
    if (Array.isArray(v)) return v.map((e) => { const s = estavel(e); return vazio(s) ? null : s; });
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, estavel(v[k])]).filter(([, x]) => !vazio(x)));
    return v;
};
export const igual = (a, b) => { const x = estavel(a); const y = estavel(b); return JSON.stringify(vazio(x) ? null : x) === JSON.stringify(vazio(y) ? null : y); };

/** Rótulos do que mudou; chave diferente fora da lista (e de `ignorar`) vira "outros ajustes". */
function mudancas(a, b, rotulos, ignorar = []) {
    const conhecidas = new Set([...rotulos.map(([k]) => k), ...ignorar]);
    const r = new Set(rotulos.filter(([k]) => !igual(a?.[k], b?.[k])).map(([, t]) => t));
    const chaves = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    if ([...chaves].some((k) => !conhecidas.has(k) && !igual(a?.[k], b?.[k]))) r.add('outros ajustes');
    return [...r];
}

function casar(versao, atual, chave) {
    const naAtual = new Map(atual.map((x) => [chave(x), x]));
    const naVersao = new Set(versao.map(chave));
    const pares = versao.filter((x) => naAtual.has(chave(x))).map((x) => [x, naAtual.get(chave(x))]);
    const comuns = new Set(pares.map(([x]) => chave(x)));
    return {
        adicionados: versao.filter((x) => !naAtual.has(chave(x))),
        removidos: atual.filter((x) => !naVersao.has(chave(x))),
        pares,
        ordemMudou: !igual(versao.map(chave).filter((k) => comuns.has(k)), atual.map(chave).filter((k) => comuns.has(k))),
    };
}

const FASE = [['nome', 'nome'], ['nome_publico', 'nome para as partes'], ['prazo_dias', 'prazo'], ['prazo_auto', 'prazo automático'], ['prazo_contagem', 'contagem do prazo'],
    ['unidade_id', 'unidade'], ['agente', 'quem faz'], ['orientacao', 'orientação'], ['proximas', 'próximas fases'], ['final', 'fase final'], ['condicoes', 'condições das saídas'],
    ['condicoes_regra', 'saída pela resposta'], ['modelos', 'modelos sugeridos'], ['documentos', 'documentos exigidos'], ['registro_atos', 'registro nos autos'],
    ['registro', 'registro nos autos'], ['certidao', 'certidão'], ['ao_entrar', 'ao entrar na fase']];
const REGRA = [['pede', 'o que pede'], ['rotulo', 'nome do dado'], ['ajuda', 'ajuda'], ['opcoes', 'opções'], ['modulo', 'módulo'], ['campos', 'campos do formulário'],
    ['destino', 'onde fica'], ['autos', 'onde fica'], ['documento', 'documento'], ['partes', 'quem vê'], ['obrigatoria', 'obrigatória'], ['recomendada', 'recomendada'],
    ['se', 'condição'], ['quem', 'quem pode cumprir']];
// Ação repetida na fase: a 2ª "Certificar" casa com a 2ª.
const acoesDe = (f) => {
    const n = {};
    return (f.acoes || []).map((a, i) => { const t = String(a).trim(); n[t] = (n[t] || 0) + 1; return { chave: `${t}#${n[t]}`, texto: t, regra: f.acoes_regras?.[i] ?? null }; });
};

export function diffRito(versao, atual) {
    const f = casar(versao?.fases || [], atual?.fases || [], (x) => x.id);
    const alteradas = f.pares.map(([v, a]) => {
        const c = casar(acoesDe(v), acoesDe(a), (x) => x.chave);
        const mudou = mudancas(v, a, FASE, ['id', 'acoes', 'acoes_regras']);
        if (c.ordemMudou) mudou.push('ordem das ações');
        return {
            id: v.id, nome: v.nome, nome_atual: a.nome, mudou,
            acoes: {
                adicionadas: c.adicionados.map((x) => x.texto), removidas: c.removidos.map((x) => x.texto),
                alteradas: c.pares.filter(([x, y]) => !igual(x.regra, y.regra)).map(([x, y]) => ({ texto: x.texto, mudou: mudancas(x.regra, y.regra, REGRA) })),
            },
        };
    }).filter((x) => x.mudou.length || x.acoes.adicionadas.length || x.acoes.removidas.length || x.acoes.alteradas.length);
    const rito = mudancas(versao, atual, [['nome', 'nome'], ['descricao', 'descrição'], ['exigir_tipo', 'autuar só por tipo']], ['fases', 'id', 'versao', 'ativo']);
    if (f.ordemMudou) rito.push('ordem das fases');
    const so = (x) => ({ id: x.id, nome: x.nome });
    const fases = { adicionadas: f.adicionados.map(so), removidas: f.removidos.map(so), alteradas };
    return { rito, fases, iguais: !rito.length && !fases.adicionadas.length && !fases.removidas.length && !alteradas.length };
}

const TIPO = [['nome', 'nome'], ['sigla', 'sigla'], ['descricao', 'descrição'], ['rito_id', 'rito'], ['numeracao', 'numeração'], ['pode_nascer_de', 'sugerir ao criar a partir de'],
    ['sigilo_padrao', 'sigilo padrão'], ['urgente', 'urgente'], ['unidade_inicial', 'unidade inicial'], ['orgao_id', 'órgão']];
const CAMPO = [['rotulo', 'nome'], ['tipo', 'tipo'], ['obrigatorio', 'obrigatório'], ['ajuda', 'ajuda'], ['opcoes', 'opções'], ['visivel_partes', 'mostrar às partes'],
    ['formato', 'formato'], ['secao', 'seção'], ['condicao', 'condição'], ['exigir_em', 'exigido nas fases'], ['modulo', 'módulo'], ['importar', 'dado importado']];

export function diffTipo(versao, atual) {
    const fv = versao?.formulario || {};
    const fa = atual?.formulario || {};
    const c = casar(fv.campos || [], fa.campos || [], (x) => x.id);
    const formulario = PADROES.filter((p) => !igual(fv[p.id], fa[p.id]) || !igual(fv.rotulos?.[p.id], fa.rotulos?.[p.id]) || !igual(fv.ajudas?.[p.id], fa.ajudas?.[p.id])).map((p) => p.rotulo);
    if (!igual(fv.polos, fa.polos)) formulario.push('polos das partes');
    if (c.ordemMudou) formulario.push('ordem dos campos');
    const conhecidas = new Set([...PADROES.map((p) => p.id), 'rotulos', 'ajudas', 'polos', 'campos']);
    if ([...new Set([...Object.keys(fv), ...Object.keys(fa)])].some((k) => !conhecidas.has(k) && !igual(fv[k], fa[k]))) formulario.push('outros ajustes do formulário');
    const so = (x) => ({ id: x.id, rotulo: x.rotulo });
    const campos = {
        adicionados: c.adicionados.map(so), removidos: c.removidos.map(so),
        alterados: c.pares.map(([v, a]) => ({ id: v.id, rotulo: v.rotulo, mudou: mudancas(v, a, CAMPO, ['id']) })).filter((x) => x.mudou.length),
    };
    const dados = mudancas(versao, atual, TIPO, ['formulario', 'id', 'ativo', 'versao']);
    return { dados, formulario, campos, iguais: !dados.length && !formulario.length && !campos.adicionados.length && !campos.removidos.length && !campos.alterados.length };
}
