// Sala da audiência (S10): espelho do que a tela precisa de functions-v2/src/shared/audienciaSala.ts.

export const TIPOS_OCORRENCIA = {
    manifestacao: 'Manifestação', depoimento: 'Depoimento', requerimento: 'Requerimento', proposta: 'Proposta de acordo',
    acordo: 'Acordo', sem_acordo: 'Sem acordo', deliberacao: 'Deliberação', documento: 'Documento apresentado',
    suspensao: 'Suspensão', retomada: 'Retomada', registro: 'Registro',
};
/** O que cada tipo registra, para a ajuda do formulário. */
export const AJUDA_OCORRENCIA = {
    manifestacao: 'o que a parte, quem a representa ou outro presente disse, em resumo ou por inteiro.',
    depoimento: 'o depoimento de testemunha, informante, perito ou parte: o que respondeu.',
    requerimento: 'o pedido feito em audiência, para quem conduz deliberar.',
    proposta: 'a proposta de acordo apresentada e por quem.',
    acordo: 'os termos do acordo a que as partes chegaram (obrigações, valores, prazos).',
    sem_acordo: 'as partes não chegaram a acordo (o texto é opcional).',
    deliberacao: 'o que quem conduz decidiu na hora (deferiu, indeferiu, determinou).',
    documento: 'documento apresentado em audiência: qual é e quem apresentou (junte o arquivo pela lista de documentos).',
    suspensao: 'a audiência parou (intervalo, falta de energia): fica a hora.',
    retomada: 'a audiência voltou: fica a hora.',
    registro: 'qualquer outro fato que deva constar do termo.',
};
export const COM_QUEM = ['manifestacao', 'depoimento', 'requerimento', 'proposta'];
export const TEXTO_OPCIONAL = ['sem_acordo', 'suspensao', 'retomada'];

/** Hora de Brasília (hh:mm) de um ISO. */
export const horaBrasil = (iso) => new Date(new Date(iso).getTime() - 108e5).toISOString().slice(11, 16);
const comPonto = (t) => (/[.!?:]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

/** Linha da ocorrência, como sai no termo. */
export function linhaDaOcorrencia(o) {
    const nome = TIPOS_OCORRENCIA[o.tipo] || 'Registro';
    if (o.tipo === 'suspensao' || o.tipo === 'retomada') return `${o.tipo === 'suspensao' ? 'Suspensa' : 'Retomada'} a audiência às ${horaBrasil(o.em)}${o.texto ? `: ${comPonto(o.texto)}` : '.'}`;
    if (o.tipo === 'sem_acordo') return `Não houve acordo${o.texto ? `: ${comPonto(o.texto)}` : '.'}`;
    return `${nome}${o.quem ? ` de ${o.quem}` : ''}: ${comPonto(o.texto)}`;
}

/** Audiências que já podem ir à sala: designadas, sem termo, de hoje ou de antes. */
export const audienciasParaSala = (lista, hoje) => (lista || []).filter((a) => a.status === 'designada' && !a.realizada_em && a.data <= hoje)
    .sort((a, b) => `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`));
