import { chaveCampo, novoCampo } from './camposProcesso.js';
import { seguintes } from './secretariaRito.js';
import { QUEM, rotuloQuem } from './permissoesFase.js';
import { textoPrazoDaAcao } from './efeitosFase.js';
import { RESPOSTAS, nomeEspecie, textoDosPolos } from './comunicacaoRito.js';
import { nomeAudiencia } from './audiencias.js';
// ============================================================================
// Espelho, para a tela, das regras do rito (functions-v2/src/shared/
// exigencias.ts): o que cada ação pede, onde cada ato fica registrado e que
// documentos a fase exige. Quem decide é o servidor; aqui é só para montar o
// editor, mostrar o que falta e pré-marcar o que um documento cumpre.
// Testado em exigencias.test.js.
// ============================================================================

export const FORMAS = [['qualquer', 'Redigir ou juntar'], ['redigir', 'Redigido no órgão'], ['juntar', 'Arquivo recebido']];

/**
 * Onde um ato fica: autos (impresso, com folha), evento (extrato impresso, sem
 * folha), só no sistema ou sem evento (registro oculto, só ações e fases).
 * Um só mapa de rótulos para o editor, a prévia e a tela do processo.
 */
export const DESTINO_INFO = {
    autos: { rotulo: 'Nos autos', curto: 'nos autos', frase: 'Gera certidão com folha própria. Sai na impressão dos autos e pode ser mostrada às partes.' },
    evento: { rotulo: 'Evento no extrato', curto: 'evento no extrato', frase: 'Fica na aba Eventos e no extrato ao fim do PDF, sem folha. As partes não veem o evento.' },
    informacao: { rotulo: 'Só no sistema', curto: 'só no sistema', frase: 'Fica só na aba Eventos e nas informações do processo, para controle. Não sai em impressão.' },
    nenhum: { rotulo: 'Sem evento', curto: 'sem evento', frase: 'Não aparece em lugar nenhum: fica só um registro oculto, para auditoria. O dado pedido, se houver, vai para as informações do processo, só para a equipe.' },
    consolidar: { rotulo: 'Na certidão conjunta', curto: 'na certidão conjunta', frase: 'Vira um item de uma só certidão da fase (ou do grupo de fases), com folha, emitida quando o processo sai do grupo, é arquivado ou alguém pede "Emitir certidão agora".' },
};
const DESTINOS_ATO = ['autos', 'evento', 'informacao', 'nenhum'];
const lido = (v, lista, padrao) => (lista.includes(v) ? v : padrao);
export const DESTINOS = DESTINOS_ATO.map((d) => [d, DESTINO_INFO[d].rotulo]);
export const DESTINOS_DOCUMENTO = [
    ['autos', 'Juntado aos autos: peça com folha, sai na impressão'],
    ['evento', 'Guardado fora dos autos, com evento no extrato impresso'],
    ['informacao', 'Guardado fora dos autos, só no sistema (não imprime)'],
];
export const DESTINOS_FASE = [
    ['autos', 'Nos autos (termo com folha)'],
    ['evento', 'Evento no extrato (sem folha)'],
    ['informacao', 'Só no sistema (não imprime)'],
    ['nenhum', 'Sem evento (registro oculto)'],
];
// Ação da fase aceita também a certidão conjunta; entrada, saída e remessas, não.
const DESTINOS_ACAO = [...DESTINOS_ATO, 'consolidar'];
export const ROTULO_DESTINO = Object.fromEntries(DESTINOS_ACAO.map((d) => [d, DESTINO_INFO[d].curto]));

/** Outros atos durante a fase: [chave, rótulo, padrão]. Iguais ao servidor (OUTROS_ATOS, PADRAO_OUTRO). */
export const OUTROS_ATOS = [
    ['prazo', 'Abrir e encerrar prazo', 'autos'],
    ['pendencia', 'Abrir e apreciar pendência', 'autos'],
    ['urgencia', 'Marcar ou retirar urgência', 'autos'],
    ['dados', 'Alterar os dados do processo', 'autos'],
    ['atribuicao', 'Atribuir a uma pessoa', 'evento'],
];
const padraoDoAto = (a) => OUTROS_ATOS.find((x) => x[0] === a)?.[2] || 'autos';
/** Atribuição é registro de controle: nunca termo nos autos. */
export const opcoesDoAto = (a) => (a === 'atribuicao' ? DESTINOS_FASE.filter(([d]) => d !== 'autos') : DESTINOS_FASE);
export const destinoDoAto = (f, a) => lido(f?.registro_atos?.outros?.[a], opcoesDoAto(a).map(([d]) => d), padraoDoAto(a));
/**
 * registro_atos da fase com outro mapa de outros atos. Parte dos níveis
 * efetivos (niveisDaFase), para não perder o formato antigo `registro`.
 */
export function registroComOutros(f, outros) {
    const n = niveisDaFase(f);
    const base = { ...(n.fase !== 'autos' ? { fase: n.fase } : {}), ...(n.remessas !== 'autos' ? { remessas: n.remessas } : {}) };
    return comOutros(Object.keys(base).length ? base : undefined, outros);
}

/** registro_atos com outro mapa de outros atos (guarda só o que difere do padrão). */
export function comOutros(ra, outros) {
    const { outros: _o, ...resto } = ra || {};
    const o = Object.fromEntries(Object.entries(outros || {}).filter(([a, d]) => d && d !== padraoDoAto(a)));
    const n = { ...resto, ...(Object.keys(o).length ? { outros: o } : {}) };
    return Object.keys(n).length ? n : undefined;
}

/** O que a ação pede a quem a cumpre. */
export const PEDIDOS = [
    ['confirmar', 'Só confirmar (caixa de marcar)'],
    ['texto', 'Um texto curto'],
    ['texto_longo', 'Um texto longo'],
    ['numero', 'Um número'],
    ['data', 'Uma data'],
    ['lista', 'Uma escolha numa lista'],
    ['sim_nao', 'Sim ou não'],
    ['registro', 'Um registro de outro módulo'],
    ['formulario', 'Um formulário (vários campos)'],
    ['documento', 'Um documento'],
    ['comunicacao', 'Comunicar as partes (intimação, citação…)'],
    ['resposta', 'Esperar a resposta das partes'],
    ['audiencia', 'Designar audiência ou sessão'],
    ['orientacao', 'Nada: só orienta (não se marca)'],
];
/** Ações que o rito conduz com as partes: cumprem-se pela comunicação expedida e pela manifestação (ou decurso). */
export const PEDIDOS_DAS_PARTES = ['comunicacao', 'resposta', 'audiencia'];
export const daPartes = (r) => PEDIDOS_DAS_PARTES.includes(r?.pede);
/** Campos de uma ação que pede um formulário (igual ao servidor). */
export const MAX_CAMPOS_ACAO = 10;
export const ROTULO_PEDIDO = Object.fromEntries(PEDIDOS);

/** Para a fase seguir: obrigatória (padrão), recomendada (avisa) ou opcional. Igual ao servidor (NIVEIS). */
export const NIVEIS = [
    ['', 'Obrigatória: sem ela, só com motivo de dispensa'],
    ['recomendado', 'Recomendada: avisa, mas não impede'],
    ['opcional', 'Opcional: só lembra'],
];
/** Nível da ação: documento guarda em `documento.nivel`; as demais, em obrigatoria/recomendada (ausente = opcional). */
export const nivelDaAcao = (r) => (r?.documento ? r.documento.nivel || '' : r?.obrigatoria ? '' : r?.recomendada ? 'recomendado' : 'opcional');
/** A regra com outro nível (o que não muda fica como estava). */
export function regraComNivel(r, nivel) {
    if (r?.documento) {
        const { nivel: _n, ...d } = r.documento;
        return { ...r, documento: { ...d, ...(nivel ? { nivel } : {}) } };
    }
    const { obrigatoria: _o, recomendada: _r, ...resto } = r || {};
    const n = { ...resto, ...(nivel === '' ? { obrigatoria: true } : nivel === 'recomendado' ? { recomendada: true } : {}) };
    return Object.keys(n).length ? n : null;
}

export const destinoDaAcao = (r) => (r?.documento
    ? lido(r.documento.destino, ['evento', 'informacao'], 'autos')
    : r?.destino ? lido(r.destino, DESTINOS_ACAO, 'evento') : (r?.autos ? 'autos' : 'evento'));
export const pedidoDaAcao = (r) => (r?.documento ? 'documento' : r?.pede || 'confirmar');
// Ação de só confirmar fora dos autos não tem o que mostrar às partes (nem certidão, nem dado). Sem evento: ninguém vê.
export const partesVeem = (r) => destinoDaAcao(r) !== 'nenhum'
    && (r?.partes === true || (r?.partes === undefined && r?.autos === true))
    && (pedidoDaAcao(r) !== 'confirmar' || ['autos', 'consolidar'].includes(destinoDaAcao(r)));
export const pedeDado = (r) => !['confirmar', 'documento', 'orientacao', ...PEDIDOS_DAS_PARTES].includes(pedidoDaAcao(r));
/** O dado da ação pode ir para a folha de dados do processo (evento 1 do PDF)? Reservado, nunca: a folha é de toda a equipe. */
export const podeIrParaFolha = (r) => pedeDado(r) && !r?.ve;
/** Ação que não se marca: só orienta quem está na fase. */
export const soOrienta = (r) => r?.pede === 'orientacao';

/**
 * Variáveis que os campos dos tipos e as informações das ações dão aos modelos:
 * [chave, rótulo, grupo], sem repetir e sem as chaves de `fora` (as fixas).
 */
export function variaveisDisponiveis(estado, fora = []) {
    const vistas = new Set(fora);
    const out = [];
    const add = (rot, grupo) => {
        const k = chaveCampo(rot);
        if (!k || k.length > 60 || vistas.has(k)) return;
        vistas.add(k);
        out.push([k, String(rot).trim(), grupo]);
    };
    for (const t of estado?.tipos || []) for (const c of t.formulario?.campos || []) add(c.rotulo, 'Campos dos tipos');
    for (const r of estado?.ritos || []) {
        for (const f of r.fases || []) (f.acoes || []).forEach((a, i) => { const rg = f.acoes_regras?.[i]; if (rg && pedeDado(rg)) add(rg.rotulo || a, 'Informações das ações'); });
    }
    return out;
}

/** Entrada/saída e remessas da fase: onde ficam (lê também o formato antigo `registro`). */
export function niveisDaFase(f) {
    if (!f) return { fase: 'autos', remessas: 'autos' };
    if (f.registro_atos) return { fase: lido(f.registro_atos.fase, DESTINOS_ATO, 'autos'), remessas: lido(f.registro_atos.remessas, DESTINOS_ATO, 'autos') };
    if (f.registro === 'interno') return { fase: 'evento', remessas: 'evento' };
    if (f.registro === 'remessas_fora') return { fase: 'autos', remessas: 'evento' };
    return { fase: 'autos', remessas: 'autos' };
}

const ORDEM = { autos: 2, evento: 1, informacao: 0, nenhum: -1 };
/** Mudança entre duas fases: o mais reservado; "sem evento" numa só delas não apaga o registro da outra. */
export const destinoTransicao = (a, b) => (a === 'nenhum' ? b : b === 'nenhum' ? a : ORDEM[a] <= ORDEM[b] ? a : b);

/**
 * Grupo da certidão conjunta: a fase raiz (a que não aponta para outra).
 * No editor a cadeia pode estar no meio (A → B → C); o servidor grava a raiz.
 */
export function grupoDe(fases, f) {
    const vistas = new Set();
    let g = f;
    while (g?.certidao?.grupo && !vistas.has(g.id)) {
        vistas.add(g.id);
        const prox = fases.find((x) => x.id === g.certidao.grupo);
        if (!prox) break;
        g = prox;
    }
    return g?.id || '';
}

/** Título da certidão do grupo (igual ao do servidor): o que uma fase deu ou o nome das fases. */
export function tituloCertidao(fases, grupo) {
    const membros = fases.filter((f) => grupoDe(fases, f) === grupo);
    const dado = membros.find((f) => f.id === grupo)?.certidao?.titulo || membros.find((f) => f.certidao?.titulo)?.certidao?.titulo;
    if (dado) return dado;
    const nomes = membros.map((f) => f.nome || f.id);
    return nomes.length > 1 ? `Certidão das fases ${nomes.join(', ')}` : `Certidão da fase ${nomes[0] || ''}`;
}

export const ABERTURA_CERTIDAO = 'Certifico que foram cumpridos os seguintes atos:';
export const MAX_ABERTURA_CERTIDAO = 200;

/** Frase que abre a certidão do grupo (igual ao do servidor): a da fase raiz, a de outra do grupo, ou a padrão. */
export function aberturaCertidao(fases, grupo) {
    const membros = fases.filter((f) => grupoDe(fases, f) === grupo);
    return membros.find((f) => f.id === grupo)?.certidao?.abertura || membros.find((f) => f.certidao?.abertura)?.certidao?.abertura || ABERTURA_CERTIDAO;
}

/** A mudança entre as duas fases entra na certidão conjunta (mesmo grupo e uma delas pede)? */
export const mudancaNaCertidao = (fases, de, para) => !!de && !!para && grupoDe(fases, de) === grupoDe(fases, para)
    && (de.certidao?.incluir_mudancas === true || para.certidao?.incluir_mudancas === true);

/** Onde fica a mudança de `de` para `para`, contando a certidão conjunta. */
export const destinoDaMudanca = (fases, de, para) => {
    const d = destinoTransicao(niveisDaFase(de).fase, niveisDaFase(para).fase);
    return d !== 'nenhum' && mudancaNaCertidao(fases, de, para) ? 'consolidar' : d;
};

/**
 * Tira a fase do grupo da certidão (ao excluí-la do rito): as fases que
 * apontavam para ela passam para o grupo dela ou, se era a raiz, para a
 * primeira delas, que herda o título.
 */
export function tirarDoGrupo(fases, id) {
    const saindo = fases.find((f) => f.id === id);
    const filhas = fases.filter((f) => f.id !== id && f.certidao?.grupo === id);
    if (!filhas.length) return fases;
    const acima = saindo?.certidao?.grupo;
    const raiz = filhas[0].id;
    return fases.map((f) => {
        if (f.id === id || f.certidao?.grupo !== id) return f;
        const { grupo: _g, ...resto } = f.certidao;
        const grupo = acima || (f.id === raiz ? undefined : raiz);
        const titulo = resto.titulo || (!acima && f.id === raiz ? saindo?.certidao?.titulo : undefined);
        const c = { ...resto, ...(grupo ? { grupo } : {}), ...(titulo ? { titulo } : {}) };
        return { ...f, certidao: Object.keys(c).length ? c : undefined };
    });
}

/** Fases para onde a fase segue: as saídas do rito ou, sem saídas, a próxima da lista. */
export function saidasDaFase(fases, f) {
    // Mesma conta do desenho do fluxo: a seguinte da lista pula a fase de espera, e a de espera volta para quem leva a ela.
    const i = fases.findIndex((x) => x.id === f?.id);
    if (i < 0) return [];
    return seguintes(fases, i).filter((id) => id !== f.id).map((id) => fases.find((x) => x.id === id)).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Condições pela resposta (iguais às do servidor, em shared/exigencias.ts):
// uma ação de escolha (lista ou sim/não) da fase decide se outra ação vale
// (`regra.se`) e por qual saída o processo segue (`fase.condicoes_regra`).
// ---------------------------------------------------------------------------

/** Quem pode cumprir a ação (além da administração): as opções e os textos estão em permissoesFase.js. */
export { QUEM };
/**
 * Quem da equipe vê o dado da ação (espelho de VE no servidor). Reservado: só
 * quem gere a unidade onde foi registrado, quem registrou e a administração.
 */
export const VE = [['', 'Toda a equipe do processo'], ['gestor', 'Só quem gere a unidade']];
/** O que pode ficar reservado: dado digitado, sem escolha que condiciona nem registro de outro módulo. */
export const PEDIDOS_RESERVAVEIS = ['texto', 'texto_longo', 'numero', 'data', 'formulario'];
/** O dado da ação pode ser reservado? (o servidor confere de novo) */
export const podeReservar = (r) => PEDIDOS_RESERVAVEIS.includes(pedidoDaAcao(r))
    && !['autos', 'consolidar'].includes(destinoDaAcao(r)) && !(r?.campos || []).some((c) => c.tipo === 'registro');

/** Respostas possíveis de uma ação de escolha ([valor, rótulo]); null se a ação não é de escolha. */
const SIM_NAO = [['sim', 'Sim'], ['nao', 'Não']];
const opcoesEmPares = (lista) => (lista || []).map((o) => String(o).trim()).filter(Boolean).map((o) => [o, o]);
/** Campos do formulário da ação que condicionam: os de escolha, e nunca os de ação com dado reservado (igual ao servidor). */
export const camposDeEscolha = (r) => (r?.pede === 'formulario' && !r.ve ? (r.campos || []).filter((c) => c.tipo === 'lista' || c.tipo === 'sim_nao') : []);

/** Opções da resposta da ação ou, com `campo`, do campo de escolha do formulário dela: [[valor, rótulo]] ou null. */
export function opcoesDaResposta(r, campo) {
    if (!r || r.documento) return null;
    if (campo) {
        const c = camposDeEscolha(r).find((x) => x.id === campo);
        return !c ? null : c.tipo === 'lista' ? opcoesEmPares(c.opcoes) : SIM_NAO;
    }
    if (r.pede === 'lista') return opcoesEmPares(r.opcoes);
    if (r.pede === 'sim_nao') return SIM_NAO;
    if (r.pede === 'resposta') return opcoesEmPares(RESPOSTAS);
    return null;
}

/**
 * Onde a condição lê a resposta: '2' (a ação 2 da fase), '2.sistema' (campo do
 * formulário dela), 'analise/2' (ação de outra fase) ou '@urgente' (dado do
 * processo). Igual ao servidor.
 */
export const chaveDaCondicao = (c) => (c.dado ? `@${c.dado}` : `${c.fase ? `${c.fase}/` : ''}${c.campo ? `${c.acao}.${c.campo}` : c.acao}`);

/** Condições a mais numa mesma regra, além da primeira (igual ao servidor). */
export const MAX_CONDICOES_E = 3;
/** Dados do processo que uma condição lê (espelho de DADOS_CONDICAO no servidor): [dado, rótulo, respostas ou null se o valor vem do cadastro]. */
export const DADOS_CONDICAO = [
    ['urgente', 'Urgente', SIM_NAO],
    ['sigilo', 'Sigilo', [['normal', 'Normal'], ['restrito', 'Restrito']]],
    ['partes', 'Tem partes', SIM_NAO],
    ['origem', 'Origem', [['requerimento', 'Requerimento'], ['representacao', 'Representação'], ['oficio', 'Ofício'], ['de_oficio', 'De ofício'], ['outro_processo', 'Outro processo'], ['outro', 'Outra']]],
    ['tipo', 'Tipo de processo', null],
];
/** A parte da condição lê a rodada da própria fase? */
const condicaoLocal = (c) => c.fase === undefined && c.dado === undefined;
/** As partes da condição: a primeira e as de "e também" (todas precisam valer). */
export const partesDaCondicao = (c) => {
    if (!c) return [];
    const { e, ...primeira } = c;
    return [primeira, ...(e || [])];
};
/** A condição feita das partes (sem partes, nenhuma). */
export const juntarPartes = (partes) => (partes.length ? { ...partes[0], ...(partes.length > 1 ? { e: partes.slice(1) } : {}) } : undefined);
/** Alguma parte da condição está sem resposta marcada? */
export const condicaoIncompleta = (c) => partesDaCondicao(c).some((x) => !x.valores?.length);
/** Campos de escolha (lista ou sim/não) dos formulários dos tipos de processo: um por id. */
const camposDosTipos = (tipos) => {
    const vistos = new Map();
    for (const t of tipos || []) {
        for (const c of t.formulario?.campos || []) {
            if (c.id && (c.tipo === 'lista' || c.tipo === 'sim_nao') && c.uso !== 'oculto' && !vistos.has(c.id)) vistos.set(c.id, c);
        }
    }
    return [...vistos.values()];
};

/** Ações de escolha da fase que podem condicionar (antes de `limite`): [índice, texto]. */
export const acoesDeEscolha = (f, limite = Infinity) => (f?.acoes || [])
    .map((a, i) => [i, a])
    .filter(([i, a]) => i < limite && a.trim() && opcoesDaResposta(f.acoes_regras?.[i]));

/**
 * Tudo o que pode condicionar na fase (antes de `limite`): as ações de escolha
 * e os campos de escolha dos formulários. [{ acao, campo?, rotulo }].
 */
export function fontesDeEscolha(f, limite = Infinity) {
    return (f?.acoes || []).flatMap((a, i) => {
        if (i >= limite || !a.trim()) return [];
        const r = f.acoes_regras?.[i];
        if (opcoesDaResposta(r)) return [{ acao: i, rotulo: `a resposta de "${a.trim()}"` }];
        return camposDeEscolha(r).filter((c) => c.id).map((c) => ({ acao: i, campo: c.id, rotulo: `"${c.rotulo || 'campo'}", de "${a.trim()}"` }));
    });
}

/**
 * Tudo de onde uma condição da fase pode ler: as respostas da própria fase, as
 * de outra fase do rito (`fases`) e os dados do processo (com `tipos`, os tipos
 * que usam o rito: "Tipo de processo" e os campos de escolha do formulário).
 * [{ acao, campo?, fase?, dado?, rotulo, grupo }], em que `grupo` é 'fase', 'outra' ou 'processo'.
 */
export function fontesDaCondicao(f, limite = Infinity, { fases = [], tipos = [] } = {}) {
    return [
        ...fontesDeEscolha(f, limite).map((s) => ({ ...s, grupo: 'fase' })),
        ...fases.filter((x) => x.id !== f?.id).flatMap((x) => fontesDeEscolha(x)
            .map((s) => ({ ...s, fase: x.id, rotulo: `${s.rotulo}, na fase "${(x.nome || '').trim() || 'sem nome'}"`, grupo: 'outra' }))),
        ...DADOS_CONDICAO.filter(([d]) => d !== 'tipo' || tipos.length > 1).map(([dado, rotulo]) => ({ acao: -1, dado, rotulo: `o dado do processo "${rotulo}"`, grupo: 'processo' })),
        ...camposDosTipos(tipos).map((c) => ({ acao: -1, dado: `campo:${c.id}`, rotulo: `o campo "${c.rotulo || 'campo'}" do processo`, nome: c.rotulo || 'campo', grupo: 'processo' })),
    ];
}

/** Respostas possíveis de uma parte da condição ([[valor, rótulo]]), ou null se o que ela lê não existe (mais). */
export function opcoesDaParte(f, c, { fases = [], tipos = [], origens = [] } = {}) {
    if (c.dado === 'origem') {
        // As do sistema, as da lista do órgão e as já escolhidas que saíram da lista (os processos guardam o nome).
        const base = [...DADOS_CONDICAO.find(([d]) => d === 'origem')[2], ...origens.map((o) => [o.id, o.nome])];
        const fora = c.valores.map((v, i) => [v, c.nomes?.[i] || v]).filter(([v]) => v.startsWith('o_') && !base.some(([b]) => b === v));
        return [...base, ...fora];
    }
    if (c.dado) {
        if (c.dado === 'tipo') return tipos.map((t) => [t.id, t.nome || 'tipo']);
        if (c.dado.startsWith('campo:')) {
            const campo = camposDosTipos(tipos).find((x) => x.id === c.dado.slice(6));
            return !campo ? null : campo.tipo === 'lista' ? opcoesEmPares(campo.opcoes) : SIM_NAO;
        }
        return DADOS_CONDICAO.find(([d]) => d === c.dado)?.[2] || null;
    }
    const dona = c.fase ? fases.find((x) => x.id === c.fase) : f;
    return dona && (dona.acoes?.[c.acao] || '').trim() ? opcoesDaResposta(dona.acoes_regras?.[c.acao], c.campo) : null;
}

/**
 * Parte nova da condição, a partir da fonte escolhida e das respostas marcadas.
 * No dado de valor livre (tipo, campo do tipo), o nome do campo e o de cada
 * valor vão junto, para as mensagens do processo.
 */
export function parteDaFonte(fonte, valores = [], opcoes = []) {
    // Origem da lista do órgão também leva o nome junto (ela pode sair da lista depois).
    const livre = fonte.dado === 'tipo' || fonte.dado?.startsWith('campo:') || (fonte.dado === 'origem' && valores.some((v) => v.startsWith('o_')));
    const nome = Object.fromEntries(opcoes);
    return {
        acao: fonte.acao, ...(fonte.campo ? { campo: fonte.campo } : {}), ...(fonte.fase ? { fase: fonte.fase } : {}), ...(fonte.dado ? { dado: fonte.dado } : {}),
        valores,
        ...(livre && fonte.nome && fonte.dado !== 'origem' ? { rotulo: fonte.nome } : {}),
        ...(livre && valores.length ? { nomes: valores.map((v) => nome[v] || v) } : {}),
    };
}

// Com `f`, a resposta da própria fase só conta se a ação que a deu também vale (condições em cadeia), como no servidor.
// A resposta de outra fase e o dado do processo valem como estão. Todas as partes precisam valer.
export const condicaoAtendida = (c, resp, f) => partesDaCondicao(c).every((x) => {
    const k = chaveDaCondicao(x);
    return resp?.[k] !== undefined && x.valores.includes(resp[k]) && (!condicaoLocal(x) || !f || acaoAtiva(f, x.acao, resp));
});

/**
 * Tudo o que uma condição do rito lê no processo, numa só tabela (igual a
 * respostasDaFase, no servidor): a rodada da fase atual ('2'), as respostas
 * das outras fases ('analise/2') e os dados do processo ('@urgente', '@tipo',
 * '@campo:<id>'). É o que se passa como `resp` às contas desta página.
 */
export function respostasDoProcesso(p) {
    const todas = p?.acoes_respostas || {};
    const atual = String(p?.fase_atual);
    const out = {};
    for (const [fase, resp] of Object.entries(todas)) {
        if (fase !== atual) for (const [k, v] of Object.entries(resp || {})) out[`${fase}/${k}`] = v;
    }
    Object.assign(out, todas[atual] || {});
    out['@urgente'] = p?.urgente === true ? 'sim' : 'nao';
    out['@sigilo'] = p?.sigilo === 'restrito' ? 'restrito' : 'normal';
    out['@partes'] = (Array.isArray(p?.partes) ? p.partes : []).some((x) => x && !x.retirada) ? 'sim' : 'nao';
    if (typeof p?.origem?.tipo === 'string' && p.origem.tipo) out['@origem'] = p.origem.tipo;
    if (typeof p?.tipo_id === 'string' && p.tipo_id) out['@tipo'] = p.tipo_id;
    for (const c of Array.isArray(p?.campos) ? p.campos : []) {
        if (typeof c?.id === 'string' && c.id && c.valor !== null && c.valor !== undefined && c.valor !== '' && typeof c.valor !== 'object') {
            out[`@campo:${c.id}`] = typeof c.valor === 'boolean' ? (c.valor ? 'sim' : 'nao') : String(c.valor);
        }
    }
    return out;
}

/** Ações do mesmo grupo de alternativas que `i` (inclui `i`). Igual ao servidor. */
export function grupoDeAlternativas(f, i) {
    const regras = f?.acoes_regras || [];
    const raiz = (k) => { const o = regras[k]?.ou; return Number.isInteger(o) && o >= 0 && o < k ? raiz(o) : k; };
    const r = raiz(i);
    return (f?.acoes || []).map((_a, k) => k).filter((k) => raiz(k) === r);
}
/** Outra ação do grupo de alternativas já foi cumprida (e vale agora)? */
export const alternativaCumprida = (f, i, feitas, resp) => grupoDeAlternativas(f, i).some((k) => k !== i && feitas.has(k) && acaoAtiva(f, k, resp));
/** Ações anteriores a que `i` pode ser alternativa: as que se marcam (sem documento, sem ser só orientação). [índice, texto]. */
export const podeTerAlternativa = (r) => !r?.documento && !soOrienta(r);
export const alternativasPossiveis = (f, i) => (f?.acoes || []).map((a, k) => [k, a])
    .filter(([k, a]) => k < i && a.trim() && podeTerAlternativa(f.acoes_regras?.[k]));
export const acaoAtiva = (f, i, resp) => {
    const se = f?.acoes_regras?.[i]?.se;
    return !se || (partesDaCondicao(se).every((x) => !condicaoLocal(x) || x.acao < i) && condicaoAtendida(se, resp, f));
};

/** Nome do que a parte da condição lê: a ação, o campo do formulário ou o dado do processo. Com `fases`, diz de que fase é a resposta. */
function rotuloDaParte(f, c, fases) {
    if (c.dado) return c.rotulo || DADOS_CONDICAO.find(([d]) => d === c.dado)?.[1] || 'o dado do processo';
    const dona = c.fase ? (fases || []).find((x) => x.id === c.fase) : f;
    const r = dona?.acoes_regras?.[c.acao];
    const campo = c.campo ? r?.campos?.find((x) => x.id === c.campo) : null;
    const nome = campo?.rotulo || r?.rotulo || dona?.acoes?.[c.acao] || (c.fase ? 'a resposta' : `ação ${c.acao + 1}`);
    return c.fase ? `${nome} (fase ${dona?.nome || 'anterior'})` : nome;
}

/** "Decisão" for Deferido ou Parcial e "Urgente" for Sim. `fases`: o rito, para a resposta de outra fase. */
export function textoCondicao(f, c, fases) {
    return partesDaCondicao(c).map((x) => {
        const nomes = Object.fromEntries(opcoesDaParte(f, x, { fases: fases || [] }) || []);
        return `"${rotuloDaParte(f, x, fases)}" for ${x.valores.map((v, i) => nomes[v] || x.nomes?.[i] || v).join(' ou ')}`;
    }).join(' e ');
}

function problemaDaParte(f, c, limite, ctx) {
    let ops;
    if (c.dado) {
        // Valor que vem do cadastro (tipo, campo do tipo): só dá para conferir com os tipos em mãos.
        if ((c.dado === 'tipo' || c.dado.startsWith('campo:')) && !ctx?.tipos) return null;
        ops = opcoesDaParte(f, c, ctx);
        if (!ops) return 'depende de um dado do processo que não existe mais';
    } else if (c.fase) {
        if (!ctx?.fases) return null;
        if (!ctx.fases.some((x) => x.id === c.fase)) return 'depende de uma fase que não existe mais';
        ops = opcoesDaParte(f, c, ctx);
        if (!ops) return c.campo ? 'depende de um campo que não existe mais ou não é de escolha' : 'depende de uma ação de outra fase que não é mais de escolha';
    } else {
        ops = c.acao < limite ? opcoesDaParte(f, c) : null;
        if (!ops) {
            if (c.campo) return 'depende de um campo que não existe mais ou não é de escolha';
            return limite === Infinity ? 'depende de uma ação que não é mais de escolha' : 'depende de uma ação que não vem antes dela ou não é de escolha';
        }
    }
    if (!c.valores.length) return null; // sem resposta marcada: quem chama avisa à parte
    return c.valores.some((v) => ops.some(([o]) => o === v)) ? null : 'nenhuma das respostas escolhidas existe mais';
}

/**
 * O que está errado na condição (para as pendências do editor), ou null.
 * `ctx`: { fases, tipos } do rito, para conferir o que ela lê fora da fase.
 */
export function problemaDaCondicao(f, c, limite = Infinity, ctx) {
    for (const x of partesDaCondicao(c)) {
        const p = problemaDaParte(f, x, limite, ctx);
        if (p) return p;
    }
    return null;
}

/**
 * As ações mudaram de lugar: `origem[j]` é o índice antigo da ação j (-1 se nova).
 * As condições acompanham a ação de que dependem; as que dependiam de ação removida saem.
 */
export function remapearCondicoes(f, origem, regras) {
    const novo = new Map(origem.map((o, j) => [o, j]).filter(([o]) => o >= 0));
    // Só a parte que lê a própria fase acompanha a ação; a que lê outra fase ou um dado do processo fica como está.
    const parte = (c) => (!condicaoLocal(c) ? c : novo.has(c.acao) ? { ...c, acao: novo.get(c.acao) } : null);
    const mapa = (c) => juntarPartes(partesDaCondicao(c).map(parte).filter(Boolean)) || null;
    const rs = regras.map((r, j) => {
        if (!r) return null;
        let n = r;
        if (n.se) {
            const se = mapa(n.se);
            if (se) n = { ...n, se };
            else { const { se: _s, ...resto } = n; n = resto; }
        }
        // "Alternativa a" acompanha a ação de que é alternativa; se ela saiu, a marca sai.
        if (Number.isInteger(n.ou)) {
            // Só vale apontando para trás: se a ordem inverteu, a marca sai.
            if (novo.has(n.ou) && novo.get(n.ou) < j) n = { ...n, ou: novo.get(n.ou) };
            else { const { ou: _o, ...resto } = n; n = resto; }
        }
        if (n.pede === 'resposta') n = { ...n, resposta: { de: novo.has(n.resposta?.de) && novo.get(n.resposta.de) < j ? novo.get(n.resposta.de) : -1 } };
        return Object.keys(n).length ? n : null;
    });
    const cr = Object.fromEntries(Object.entries(f.condicoes_regra || {}).map(([k, c]) => [k, mapa(c)]).filter(([, c]) => c));
    return { acoes_regras: rs.some(Boolean) ? rs : undefined, condicoes_regra: Object.keys(cr).length ? cr : undefined };
}

/**
 * As ações da fase `faseId` mudaram de lugar (`origem`, como em remapearCondicoes):
 * as condições das OUTRAS fases que leem as respostas dela acompanham. Devolve
 * as fases (as mesmas, se nada mudou).
 */
export function remapearDeOutraFase(fases, faseId, origem) {
    const novo = new Map(origem.map((o, j) => [o, j]).filter(([o]) => o >= 0));
    const parte = (c) => (c.fase !== faseId ? c : novo.has(c.acao) ? { ...c, acao: novo.get(c.acao) } : null);
    const mapa = (c) => juntarPartes(partesDaCondicao(c).map(parte).filter(Boolean));
    const le = (c) => partesDaCondicao(c).some((x) => x.fase === faseId);
    return fases.map((f) => {
        if (f.id === faseId) return f;
        const regras = f.acoes_regras || [];
        const saidas = Object.entries(f.condicoes_regra || {});
        if (!regras.some((r) => le(r?.se)) && !saidas.some(([, c]) => le(c))) return f;
        const rs = regras.map((r) => {
            if (!le(r?.se)) return r;
            const { se: _s, ...resto } = r;
            const se = mapa(r.se);
            const n = se ? { ...resto, se } : resto;
            return Object.keys(n).length ? n : null;
        });
        const cr = Object.fromEntries(saidas.map(([k, c]) => [k, le(c) ? mapa(c) : c]).filter(([, c]) => c));
        return { ...f, acoes_regras: rs.some(Boolean) ? rs : undefined, condicoes_regra: Object.keys(cr).length ? cr : undefined };
    });
}

/**
 * Saída "senão" da fase: a que o rito manda seguir quando nenhuma regra de
 * saída indica outra. Só vale com mais de um caminho, sem ser espera nem ter
 * regra própria (igual ao servidor). Devolve o id, ou ''.
 */
export function saidaPadrao(fases, f) {
    if (!f?.saida_padrao || f.condicoes_regra?.[f.saida_padrao]) return '';
    const caminhos = saidasDaFase(fases, f).filter((x) => !(x.espera && !x.final));
    return caminhos.length > 1 && caminhos.some((x) => x.id === f.saida_padrao) ? f.saida_padrao : '';
}

/**
 * Saídas da fase com a condição de cada uma e se a resposta registrada a indica.
 * `padrao`: é a saída "senão" e nenhuma regra indicou outra (o rito manda seguir por ela).
 */
export function saidasComCondicao(fases, f, resp) {
    const saidas = saidasDaFase(fases, f).map((x) => {
        const c = f.condicoes_regra?.[x.id];
        return { fase: x, condicao: c || null, indicada: !!c && condicaoAtendida(c, resp, f), contra: !!c && !condicaoAtendida(c, resp, f) };
    });
    const senao = saidas.some((s) => s.indicada) ? '' : saidaPadrao(fases, f);
    return saidas.map((s) => ({ ...s, padrao: s.fase.id === senao }));
}

/** Regra nova a partir de outra, trocando o que a ação pede (mantém destino, quem vê e obrigatoriedade). */
export function regraComPedido(r, pede, acao) {
    const nova = regraComPedidoSemNivel(r, pede, acao);
    // O nível (obrigatória, recomendada, opcional) acompanha a ação: no documento fica em documento.nivel, nas outras em obrigatoria/recomendada.
    // Nível nunca escolhido (ação sem marca, que lê como opcional) segue o padrão do pedido novo: documento obrigatório; o resto opcional.
    const escolhido = r?.documento || r?.obrigatoria || r?.recomendada;
    return escolhido && pede !== 'orientacao' ? regraComNivel(nova, nivelDaAcao(r)) : nova;
}

function regraComPedidoSemNivel(r, pede, acao) {
    const nova = regraComPedidoBase(r, pede, acao);
    // Só orientação: fica a condição, mais nada (não se marca, não se cobra, não tem alternativa).
    if (pede === 'orientacao') return { ...nova, ...(r?.se ? { se: r.se } : {}) };
    // A condição ("só vale se") e quem cumpre acompanham a ação (documento: quem cumpre é quem junta).
    const extra = { ...(r?.se ? { se: r.se } : {}), ...(r?.quem && !['documento', 'resposta'].includes(pede) ? { quem: r.quem, ...(r.quem === 'atribuicao' ? { atribuicao: r.atribuicao || '' } : {}) } : {}),
        ...(Number.isInteger(r?.ou) && pede !== 'documento' ? { ou: r.ou } : {}),
        // O prazo próprio acompanha a ação, seja o que for que ela peça.
        ...(r?.prazo_dias > 0 && !['orientacao', 'resposta'].includes(pede) ? { prazo_dias: r.prazo_dias, ...(r.prazo_contagem === 'corridos' ? { prazo_contagem: 'corridos' } : {}) } : {}),
        // A folha de dados segue enquanto a ação pedir um dado.
        ...(r?.folha_dados && !['confirmar', 'documento', ...PEDIDOS_DAS_PARTES].includes(pede) ? { folha_dados: true } : {}),
        // Dado reservado segue se o pedido novo ainda puder ser reservado.
        ...(r?.ve && PEDIDOS_RESERVAVEIS.includes(pede) ? { ve: r.ve } : {}) };
    return Object.keys(extra).length ? { ...(nova || {}), ...extra } : nova;
}

function regraComPedidoBase(r, pede, acao) {
    const dest = destinoDaAcao(r);
    // Documento novo vai aos autos, salvo se o criador já tinha escolhido outro destino para a ação.
    const escolhido = r?.documento?.destino || r?.destino;
    if (pede === 'documento') {
        return {
            documento: { descricao: acao, forma: r?.documento?.forma || 'qualquer', ...(['evento', 'informacao'].includes(escolhido) ? { destino: escolhido } : {}) },
            ...(r?.ajuda ? { ajuda: r.ajuda } : {}),
        };
    }
    if (pede === 'orientacao') return { pede, ...(r?.ajuda ? { ajuda: r.ajuda } : {}) };
    // Comunicar e esperar: o registro são as próprias comunicações e manifestações (nos autos), sem destino nem partes na regra.
    if (PEDIDOS_DAS_PARTES.includes(pede)) {
        return {
            pede,
            ...(pede === 'comunicacao' ? { comunicacao: r?.comunicacao || { especie: 'intimacao', dias: 0 } }
                : pede === 'resposta' ? { resposta: r?.resposta || { de: -1 } }
                    // A designação é ato público: sempre nos autos, e as partes veem.
                    : { audiencia: r?.audiencia || { especie: 'audiencia' }, destino: 'autos', partes: true }),
            ...(r?.obrigatoria ? { obrigatoria: true } : r?.recomendada ? { recomendada: true } : {}),
            ...(r?.ajuda ? { ajuda: r.ajuda } : {}),
        };
    }
    const base = {
        ...(pede !== 'confirmar' ? { pede } : {}),
        ...(r?.rotulo && pede !== 'confirmar' ? { rotulo: r.rotulo } : {}),
        ...(pede === 'lista' ? { opcoes: r?.opcoes || [] } : {}),
        ...(pede === 'registro' ? { modulo: r?.modulo || 'consultas' } : {}),
        ...(pede === 'formulario' ? { campos: r?.campos?.length ? r.campos : [novoCampo()] } : {}),
        ...(dest !== 'evento' ? { destino: dest } : {}),
        ...(partesVeem(r) ? { partes: true } : {}),
        ...(r?.obrigatoria ? { obrigatoria: true } : r?.recomendada ? { recomendada: true } : {}),
        ...(r?.ajuda ? { ajuda: r.ajuda } : {}),
    };
    return Object.keys(base).length ? base : null;
}

/** Frase do que a ação faz, para o editor e a prévia. */
export function resumoDaAcao(r) {
    const pede = pedidoDaAcao(r);
    if (pede === 'orientacao') return `só orientação, não se marca${r?.se ? '; condicional' : ''}`;
    const dest = destinoDaAcao(r);
    const sufixo = `${{ '': '; obrigatória', recomendado: '; recomendada', opcional: '' }[nivelDaAcao(r)]}${r?.se ? '; condicional' : ''}`;
    if (pede === 'comunicacao') {
        const c = r?.comunicacao || {};
        const prazo = c.dias > 0 ? `, prazo de resposta de ${textoPrazoDaAcao({ prazo_dias: c.dias, prazo_contagem: c.contagem })}` : ', sem prazo de resposta';
        return `comunica ${textoDosPolos(c)} (${nomeEspecie(c.especie).toLowerCase()}${prazo}); certidão nos autos${sufixo}${r?.quem ? `; ${rotuloQuem(r.quem, r.atribuicao)}` : ''}${r?.prazo_dias > 0 ? `; expedir em ${textoPrazoDaAcao(r)}` : ''}`;
    }
    if (pede === 'resposta') return `espera a resposta das partes ou o fim do prazo; cumpre-se sozinha${sufixo}`;
    if (pede === 'audiencia') {
        return `designa ${nomeAudiencia(r?.audiencia?.especie).toLowerCase()}; certidão nos autos; partes veem${sufixo}${r?.quem ? `; ${rotuloQuem(r.quem, r.atribuicao)}` : ''}${r?.prazo_dias > 0 ? `; designar em ${textoPrazoDaAcao(r)}` : ''}`;
    }
    if (pede === 'documento') {
        return dest === 'autos' ? 'documento juntado aos autos' : `documento guardado fora dos autos (${dest === 'evento' ? 'evento no extrato' : 'só no sistema'})`;
    }
    const oque = pede === 'confirmar' ? 'confirmação'
        : pede === 'formulario' ? `formulário de ${r?.campos?.length || 0} ${r?.campos?.length === 1 ? 'campo' : 'campos'}`
            : ROTULO_PEDIDO[pede].replace(/^Uma? /, '').toLowerCase();
    const onde = dest === 'autos' ? 'certidão nos autos' : ROTULO_DESTINO[dest];
    const nivel = { '': '; obrigatória', recomendado: '; recomendada', opcional: '' }[nivelDaAcao(r)];
    return `${oque}${r?.rotulo ? ` (${r.rotulo})` : ''}; ${onde}${partesVeem(r) ? '; partes veem' : ''}${r?.folha_dados ? '; na folha de dados' : ''}${nivel}${r?.se ? '; condicional' : ''}${Number.isInteger(r?.ou) ? '; alternativa a outra' : ''}${r?.quem ? `; ${rotuloQuem(r.quem, r.atribuicao)}` : ''}${r?.prazo_dias > 0 ? `; prazo próprio de ${textoPrazoDaAcao(r)}` : ''}`;
}

/** Exigências de documento da fase com a chave que o processo grava: 'd0' (da fase), 'a2' (da ação 2). */
export function exigenciasDaFase(f, resp) {
    if (!f) return [];
    return [
        ...(f.documentos || []).map((d, i) => ({ ...d, chave: `d${i}` })),
        // Ação condicional que não vale agora não exige o documento.
        ...(f.acoes_regras || []).flatMap((r, i) => (r?.documento && f.acoes?.[i] && acaoAtiva(f, i, resp) ? [{ ...r.documento, chave: `a${i}`, acao_idx: i }] : [])),
    ];
}

/** Cada exigência com o documento que a cumpriu (ou null). */
export function situacaoDaFase(f, cumpridas, resp) {
    const feitas = (f && cumpridas?.[f.id]) || {};
    return exigenciasDaFase(f, resp).map((e) => ({ ...e, cumprida: feitas[e.chave] || null }));
}

export const pendentesDaFase = (f, cumpridas, resp) => situacaoDaFase(f, cumpridas, resp).filter((e) => !e.cumprida);

/** Ações obrigatórias (sem documento) ainda não feitas (a condicional só quando vale). */
export function acoesObrigatoriasPendentes(f, feitas = [], resp) {
    if (!f) return [];
    const ok = new Set(feitas);
    const cobrada = (i) => !!f.acoes_regras?.[i]?.obrigatoria && !f.acoes_regras[i]?.documento && !ok.has(i) && acaoAtiva(f, i, resp)
        && !alternativaCumprida(f, i, ok, resp);
    return (f.acoes || []).flatMap((_a, i) => {
        if (!cobrada(i)) return [];
        // Alternativas: o grupo aparece uma vez, como "A ou B" (só as que valem agora).
        const grupo = grupoDeAlternativas(f, i).filter((k) => acaoAtiva(f, k, resp));
        return grupo.find(cobrada) === i ? [{ descricao: grupo.map((k) => (f.acoes || [])[k]).join(' ou '), acao_idx: i }] : [];
    });
}

/** Tudo o que falta para a fase seguir sem dispensa: documentos e ações obrigatórias (recomendados e opcionais não impedem). */
export const faltaNaFase = (f, cumpridas, feitas, resp) => [...pendentesDaFase(f, cumpridas, resp).filter((e) => !e.nivel), ...acoesObrigatoriasPendentes(f, feitas, resp)];

/** O que o rito recomenda na fase e ainda não foi feito: avisa quem conclui, sem impedir. */
export function recomendadosNaFase(f, cumpridas, feitas = [], resp) {
    if (!f) return [];
    const ok = new Set(feitas);
    return [
        ...pendentesDaFase(f, cumpridas, resp).filter((e) => e.nivel === 'recomendado'),
        ...(f.acoes || []).flatMap((a, i) => (f.acoes_regras?.[i]?.recomendada && !f.acoes_regras[i]?.documento && !ok.has(i) && acaoAtiva(f, i, resp)
            && !alternativaCumprida(f, i, ok, resp)
            ? [{ descricao: a, acao_idx: i }] : [])),
    ];
}

/** Redigir = produzido no órgão (editor ou modelo); juntar = recebido de fora (arquivo ou petição da parte). `d.controle`: guardado fora dos autos. */
export function atende(e, d) {
    if (!!e.destino !== (d.controle === true)) return false;
    const redigido = !d.peticao && (d.origem === 'editor' || !!d.modelo_id);
    if (e.forma === 'redigir') return redigido;
    if (e.forma === 'juntar') return !redigido;
    return true;
}

const igual = (a, b) => !!a && !!b && a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;

/**
 * O que o servidor reconheceria sozinho: mesmo modelo ou mesmo tipo, com as
 * assinaturas que a exigência pede. `d.n_assinaturas` conta a que entra ao juntar.
 * A atribuição de quem assina só o servidor confere (ele vê as lotações).
 */
export const sugeridas = (pendentes, d) => pendentes
    .filter((e) => atende(e, d) && (e.assinaturas || 0) <= (d.n_assinaturas ?? (d.assinaturas?.length || 0))
        && ((e.modelo_id && e.modelo_id === d.modelo_id) || igual(e.tipo, d.tipo)))
    .map((e) => e.chave);

export const MAX_ASSINATURAS_EXIGIDAS = 5;

/** O que a exigência pede do próprio documento, em uma linha (ou ''): assinaturas e portal. */
export function exigeDoDocumento(e) {
    const n = e?.assinaturas || 0;
    return [
        n ? (n === 1 ? 'assinado' : `${n} assinaturas`) : '',
        e?.assinatura_atribuicao ? `uma assinatura de ${e.assinatura_atribuicao}` : '',
        e?.partes === false ? 'fica fora do portal das partes' : '',
    ].filter(Boolean).join(' · ').replace(/^./, (c) => c.toUpperCase());
}

/**
 * Quando a lista de ações muda, cada regra acompanha o texto da sua ação:
 * apagar ou reordenar linhas não passa a regra para outra ação. Se só o texto
 * de uma linha mudou (mesma quantidade de linhas), a regra fica na posição.
 */
export function realinharRegras(antigas = [], regras = [], novas = []) {
    if (!regras.some(Boolean)) return undefined;
    const usadas = new Set();
    const out = novas.map((a, i) => {
        const t = a.trim();
        let j = t ? antigas.findIndex((x, k) => !usadas.has(k) && x.trim() === t) : -1;
        if (j < 0 && novas.length === antigas.length && !usadas.has(i)) j = i;
        if (j < 0) return null;
        usadas.add(j);
        return regras[j] || null;
    });
    return out.some(Boolean) ? out : undefined;
}
