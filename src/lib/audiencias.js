/**
 * Espelho de functions-v2/src/shared/audiencias.ts para a tela: espécies,
 * modos, texto da audiência e a troca de {audiencia} no texto da comunicação.
 */
export const ESPECIES_AUDIENCIA = [
    ['audiencia', 'Audiência'], ['instrucao', 'Audiência de instrução'], ['conciliacao', 'Audiência de conciliação'], ['oitiva', 'Oitiva'],
    ['sessao', 'Sessão de julgamento'], ['reuniao', 'Reunião'], ['inspecao', 'Inspeção ou vistoria'],
];
/** Nome da espécie: a do sistema, ou o `nome` que a espécie da lista do órgão leva junto. */
export const nomeAudiencia = (id, nome) => nome || ESPECIES_AUDIENCIA.find(([k]) => k === id)?.[1] || 'Audiência';
/** Espécies para escolher: as do sistema, as da lista do órgão e a do rito ([id, nome, m]). */
export function audienciasParaEscolher(lista = [], atual = null) {
    const out = [...ESPECIES_AUDIENCIA, ...lista.map((o) => [o.id, o.nome, o.m === true])];
    if (atual?.especie?.startsWith('o_') && !out.some(([id]) => id === atual.especie)) out.push([atual.especie, atual.especie_nome || 'Espécie do órgão', atual.especie_m === true]);
    return out;
}
/** O que o rito grava da espécie: a do órgão leva o nome e o gênero. */
export function camposDaAudiencia(id, opcoes) {
    if (!id?.startsWith('o_')) return { especie: id };
    const o = opcoes.find(([x]) => x === id);
    return { especie: id, especie_nome: o?.[1] || '', ...(o?.[2] ? { especie_m: true } : {}) };
}
export const MODOS_AUDIENCIA = [['presencial', 'Presencial'], ['virtual', 'Por videoconferência'], ['hibrida', 'Híbrida (presencial e por videoconferência)']];
export const QUALIDADES = [['testemunha', 'testemunha'], ['perito', 'perito'], ['informante', 'informante'], ['assistente', 'assistente técnico'], ['interprete', 'intérprete'], ['outro', 'outro participante']];
export const MAX_PARTICIPANTES = 20;
export const MARCA_AUDIENCIA = '{audiencia}';

const br = (iso) => iso.split('-').reverse().join('/');
const qualidade = (q) => QUALIDADES.find(([k]) => k === q)?.[1] || q;

/** "20/11/2026, às 14:00, em Sala 3" (com link e participantes, se houver). Igual ao servidor. */
export function textoDaAudiencia(a, comParticipantes = true) {
    const onde = a.modo === 'virtual' ? `por videoconferência (${a.link})`
        : a.modo === 'hibrida' ? `em ${a.local} e por videoconferência (${a.link})` : `em ${a.local}`;
    const quem = comParticipantes && a.participantes?.length
        ? `. Participam, além das partes: ${a.participantes.map((p) => `${p.nome} (${qualidade(p.qualidade)})`).join('; ')}` : '';
    return `${br(a.data)}, às ${a.hora}, ${onde}${quem}`;
}

/** Audiências designadas de hoje em diante, da mais próxima. */
export const audienciasFuturas = (lista, hoje) => (lista || []).filter((a) => a.status !== 'cancelada' && !a.realizada_em && a.data >= hoje)
    .sort((a, b) => `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`));

/** Troca {audiencia} pela próxima audiência designada; sem audiência, o texto fica como está (o servidor recusa). */
export function comAudiencia(texto, lista, hoje) {
    const prox = audienciasFuturas(lista, hoje)[0];
    return prox && texto?.includes(MARCA_AUDIENCIA) ? texto.split(MARCA_AUDIENCIA).join(textoDaAudiencia(prox, false)) : texto;
}
