/**
 * Espelho de functions-v2/src/shared/comunicacaoRito.ts para a tela: a quem a
 * ação do rito comunica e como está a espera da resposta. Quem decide é o
 * servidor; aqui só se mostra.
 */
import { POLOS } from './camposProcesso.js';

export const RESPOSTAS = ['Apresentada', 'Parcial', 'Sem manifestação'];

/** Espécies de comunicação (igual ao servidor, shared/comunicacoes.ts). */
export const ESPECIES = [
    ['intimacao', 'Intimação', 'Chama a parte a fazer ou responder algo'],
    ['notificacao', 'Notificação', 'Dá conhecimento de um ato ou de uma data'],
    ['citacao', 'Citação', 'Chama a parte ao processo para se defender'],
    ['ciencia', 'Ciência', 'Só registra que a parte tomou conhecimento'],
    ['comunicacao', 'Comunicação', 'Outro aviso formal'],
];
/** Nome da espécie: a do sistema, ou o `nome` que a espécie da lista do órgão leva junto. */
export const nomeEspecie = (id, nome) => nome || ESPECIES.find((e) => e[0] === id)?.[1] || 'Comunicação';
/**
 * Espécies para escolher: as do sistema e as da lista do órgão ([id, nome, dica, m]).
 * `atual` ({ especie, especie_nome, especie_m }): a do rito ou da comunicação, que entra mesmo fora da lista.
 */
export function especiesParaEscolher(lista = [], atual = null) {
    const out = [...ESPECIES, ...lista.map((o) => [o.id, o.nome, 'Da lista do órgão', o.m === true])];
    if (atual?.especie?.startsWith('o_') && !out.some(([id]) => id === atual.especie)) out.push([atual.especie, atual.especie_nome || 'Espécie do órgão', 'Do rito', atual.especie_m === true]);
    return out;
}
/** Campos da espécie para mandar ao servidor: a do órgão leva o nome e o gênero. */
export function camposDaEspecie(id, opcoes) {
    if (!id?.startsWith('o_')) return { especie: id };
    const o = opcoes.find(([x]) => x === id);
    return { especie: id, especie_nome: o?.[1] || '', ...(o?.[3] ? { especie_m: true } : {}) };
}

/** Partes (índices) que a comunicação da ação alcança: as do polo pedido, sem as retiradas. */
export function alvosDaComunicacao(cfg, partes) {
    if (!cfg) return [];
    return (partes || []).map((p, i) => [p, i])
        .filter(([p]) => p && !p.retirada && (!cfg.polos || cfg.polos.includes(String(p.polo))))
        .map(([, i]) => i);
}

/** Comunicações expedidas pela ação na rodada atual da fase (sem as tornadas sem efeito). */
export const comunicacoesDaAcao = (lista, faseId, idx) => (lista || [])
    .filter((c) => c.fase_id === faseId && c.acao_idx === idx && c.rodada_fim !== true && c.status !== 'sem_efeito');

const decorreu = (c, hoje) => !!c.vence_em && hoje > c.vence_em;

/** Como está a espera: `valor` só existe quando ninguém mais pode responder. */
export function situacaoDaResposta(f, idx, lista, hoje) {
    const de = f?.acoes_regras?.[idx]?.resposta?.de;
    const coms = typeof de === 'number' ? comunicacoesDaAcao(lista, f.id, de) : [];
    const apresentadas = coms.filter((c) => !!c.respondida_em);
    const decursos = coms.filter((c) => !c.respondida_em && decorreu(c, hoje));
    const pendentes = coms.filter((c) => !c.respondida_em && !decorreu(c, hoje));
    const valor = !coms.length || pendentes.length ? null
        : !decursos.length ? 'Apresentada' : !apresentadas.length ? 'Sem manifestação' : 'Parcial';
    return { comunicacoes: coms, apresentadas, decursos, pendentes, valor };
}

/** Frase do que a ação comunica, para o editor e a prévia. */
export function textoDosPolos(cfg) {
    if (!cfg?.polos?.length) return 'todas as partes';
    const nomes = Object.fromEntries(POLOS);
    return cfg.polos.map((p) => (nomes[p] || p).toLowerCase()).join(' e ');
}
