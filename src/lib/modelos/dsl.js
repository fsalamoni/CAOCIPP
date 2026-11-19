/**
 * Biblioteca de modelos de rito: processos completos, por área e porte, com
 * descrição explicativa e base normativa. Cada modelo é um rito pronto para a
 * tela "Novo rito" (o órgão revisa tudo antes de implantar) e, se o órgão
 * quiser, o tipo de processo com os polos já nomeados.
 *
 * Como se escreve um modelo (ver `montar`):
 * - fases citam outras fases e ações PELO NOME (`vai`, `saidas`, `padrao`,
 *   `se.acao`, `resposta.de`, `ou`); `montar` troca por ids e índices e
 *   reclama de nome que não existe;
 * - `unidade` é o NOME da unidade: a tela casa com as do órgão ou propõe criar;
 * - ações com os construtores de `A` (o que cada uma pede e registra).
 *
 * Meta do modelo: id, nome, area, porte, referencia (instituição ou lei em que o
 * modelo se inspira, curta, como "OAB", "CGU" ou "Lei 14.133"; a biblioteca
 * filtra por ela), descricao, quando, base e tipo { polos, nomes_polos }.
 *
 * Nada aqui é penal: os sancionadores são administrativos. Pesquisa e fontes:
 * docs/MODELOS_DE_RITO.md. Os modelos ficam em src/lib/modelos/<área>.js e se
 * juntam em src/lib/bibliotecaRitos.js.
 */

let seq = 0;
const novoId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;

export const AREAS = [
    ['geral', 'Administrativo geral'],
    ['correcional', 'Correcional e disciplinar'],
    ['etica', 'Ética e conselhos profissionais'],
    ['sancionador', 'Sancionador e fiscalização'],
    ['contratacoes', 'Contratações e contratos'],
    ['parcerias', 'Parcerias, convênios e cooperação'],
    ['atendimento', 'Atendimento, ouvidoria e transparência'],
    ['ministerio_publico', 'Ministério Público (não penal)'],
    ['gestao', 'Gestão interna e pessoas'],
    ['controle', 'Controle e contas'],
    ['advocacia_publica', 'Advocacia pública e consultoria'],
];
export const PORTES = [['curto', 'Curto'], ['medio', 'Médio'], ['longo', 'Longo']];
/**
 * Âmbito: de quem é a norma que o modelo segue. É a primeira pergunta de quem
 * procura um modelo ("serve para o meu órgão?"); a área diz o assunto. O âmbito
 * de cada modelo fica em AMBITO_DO_MODELO (src/lib/bibliotecaRitos.js).
 */
export const AMBITOS = [
    ['mprs', 'Ministério Público do RS', 'Normas próprias do MPRS (provimentos, ordens de serviço e resoluções), somadas às nacionais e estaduais.'],
    ['estadual_rs', 'Estado do Rio Grande do Sul', 'Leis, decretos e instruções do Estado do RS: valem para os órgãos e entidades estaduais.'],
    ['federal', 'União e órgãos federais', 'Leis, decretos e portarias que regem os órgãos e entidades federais.'],
    ['ministerio_publico', 'Ministério Público em geral', 'Resoluções do CNMP e leis nacionais: servem a qualquer Ministério Público.'],
    ['conselhos', 'Conselhos e entidades de classe', 'OAB, CAU e demais conselhos profissionais, com os seus códigos e regimentos.'],
    ['nacional', 'Qualquer órgão ou entidade', 'Leis nacionais ou rito genérico: serve a qualquer esfera, com os ajustes da norma local.'],
];
export const nomeAmbito = (id) => AMBITOS.find(([a]) => a === id)?.[1] || id;
export const nomeArea =(id) => AREAS.find(([a]) => a === id)?.[1] || id;
export const nomePorte = (id) => PORTES.find(([p]) => p === id)?.[1] || id;

/** Construtores de ação: `{ texto, regra }`. `extra` soma obrigatoria, quem, destino, partes, prazo_dias, se, ou, ajuda... */
const com = (texto, regra, extra = {}) => ({ texto, regra: Object.keys({ ...regra, ...extra }).length ? { ...regra, ...extra } : null });
export const A = {
    /** Só se marca como feita. */
    fazer: (texto, extra) => com(texto, {}, extra),
    /** Não se marca: orienta quem está na fase. */
    orientar: (texto, ajuda) => com(texto, { pede: 'orientacao', ...(ajuda ? { ajuda } : {}) }),
    escolha: (texto, opcoes, extra) => com(texto, { pede: 'lista', opcoes }, extra),
    simNao: (texto, extra) => com(texto, { pede: 'sim_nao' }, extra),
    data: (texto, extra) => com(texto, { pede: 'data' }, extra),
    numero: (texto, extra) => com(texto, { pede: 'numero' }, extra),
    texto: (texto, extra) => com(texto, { pede: 'texto' }, extra),
    textoLongo: (texto, extra) => com(texto, { pede: 'texto_longo' }, extra),
    /** Abrir um processo que nasce deste: `tipo` é o nome do tipo de processo sugerido (opcional). Cumpre-se sozinha quando o processo é aberto. */
    derivado: (texto, tipo, extra) => com(texto, { pede: 'derivado', ...(tipo ? { derivado: { tipo } } : {}) }, extra),
    /** Registrar o cronograma de obrigações: cada parcela vira um prazo do processo, com alerta, e a parte comprova pelo portal. */
    cronograma: (texto, extra) => com(texto, { pede: 'cronograma' }, extra),
    /** Esperar o cumprimento do cronograma: cumpre-se sozinha quando todas as obrigações estiverem cumpridas. */
    quitacao: (texto, extra) => com(texto, { pede: 'quitacao' }, extra),
    /** campos: [{ id, rotulo, tipo, obrigatorio, opcoes? }] */
    formulario: (texto, campos, extra) => com(texto, { pede: 'formulario', campos }, extra),
    /** Documento: tipo (ex.: "Despacho"), forma redigir | juntar | qualquer, nivel recomendado | opcional (ausente = obrigatório). */
    documento: (texto, tipo, { forma = 'qualquer', nivel, destino, ...extra } = {}) =>
        com(texto, { documento: { forma, ...(tipo ? { tipo } : {}), ...(nivel ? { nivel } : {}), ...(destino ? { destino } : {}) } }, extra),
    /** Comunicação às partes conduzida pelo rito: especie, polos ([] = todas), dias (0 = sem prazo), contagem, texto. */
    comunicar: (texto, { especie, polos, dias = 0, contagem, texto: t }, extra) =>
        com(texto, { pede: 'comunicacao', comunicacao: { especie, ...(polos?.length ? { polos } : {}), dias, ...(contagem ? { contagem } : {}), ...(t ? { texto: t } : {}) } }, extra),
    /** Espera a resposta da comunicação `de` (nome da ação, na mesma fase). */
    esperar: (texto, de, extra) => com(texto, { pede: 'resposta', resposta: { de } }, extra),
    audiencia: (texto, especie, extra) => com(texto, { pede: 'audiencia', audiencia: { especie } }, extra),
    /** Julgamento colegiado: resultados (as opções das saídas), e em `opts` quorum, desempate 'favoravel' e favoravel. */
    julgamento: (texto, resultados, opts = {}, extra) => com(texto, { pede: 'julgamento', julgamento: { resultados, ...opts } }, extra),
    /** Disputa de preços: perfil 'cotacao' ou 'dispensa'; as saídas são Homologada, Deserta e Fracassada. */
    disputa: (texto, perfil, extra) => com(texto, { pede: 'disputa', disputa: { perfil } }, extra),
};

/** Condição: a resposta da ação `acao` (nome) for uma destas. */
export const quando = (acao, ...valores) => ({ acao, valores });

/**
 * Monta o modelo: troca nomes de fases por ids e nomes de ações por índices.
 * Fase: { nome, unidade, prazo_dias, prazo_auto, prazo_contagem, orientacao, nome_publico, avanco, espera, final,
 *         ao_entrar, juntada_conjunta, elaboracao, acoes: [A.*], vai: [fase], saidas: { fase: quando(...) }, padrao: fase,
 *         condicoes: { fase: 'texto' } }
 */
export function montar(meta, fases) {
    const ids = new Map(fases.map((f) => [f.nome, novoId()]));
    const idDe = (n) => {
        if (!ids.has(n)) throw new Error(`Modelo "${meta.nome}": não há fase "${n}"`);
        return ids.get(n);
    };
    const saida = fases.map((f) => {
        const { vai, saidas, padrao, condicoes, acoes: lista = [], ...resto } = f;
        const nomes = lista.map((a) => a.texto);
        const idx = (n) => {
            if (typeof n === 'number') return n;
            const i = nomes.indexOf(n);
            if (i < 0) throw new Error(`Modelo "${meta.nome}", fase "${f.nome}": não há ação "${n}"`);
            return i;
        };
        const cond = (c) => ({ ...c, acao: idx(c.acao) });
        const regras = lista.map((a) => {
            if (!a.regra) return null;
            const r = { ...a.regra };
            if (r.se) r.se = cond(r.se);
            if (typeof r.ou === 'string') r.ou = idx(r.ou);
            if (r.resposta) r.resposta = { de: idx(r.resposta.de) };
            return r;
        });
        return {
            id: idDe(f.nome), ...resto,
            ...(nomes.length ? { acoes: nomes } : {}),
            ...(regras.some(Boolean) ? { acoes_regras: regras } : {}),
            ...(vai ? { proximas: vai.map(idDe) } : {}),
            ...(saidas ? { condicoes_regra: Object.fromEntries(Object.entries(saidas).map(([n, c]) => [idDe(n), cond(c)])) } : {}),
            ...(padrao ? { saida_padrao: idDe(padrao) } : {}),
            ...(condicoes ? { condicoes: Object.fromEntries(Object.entries(condicoes).map(([n, t]) => [idDe(n), t])) } : {}),
        };
    });
    return { ...meta, fases: saida };
}

