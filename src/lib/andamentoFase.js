// Andamento automático da fase e situação do registro ligado (Consultas e
// Expedientes). Espelho de functions-v2/src/shared/situacaoRegistro.ts: o
// servidor é quem valida e aplica; aqui é só o que a tela mostra.

export const SITUACOES = ['Pendente', 'Em elaboração', 'Aguarda retorno de terceiros', 'Em revisão', 'Revisadas', 'Na pasta'];
/** [id, nome do módulo, como chamar um registro dele numa frase]. */
export const MODULOS_SITUACAO = [['consultas', 'Consultas', 'a consulta'], ['expedientes', 'Expedientes', 'o expediente']];
export const nomeDoRegistro = (modulo) => MODULOS_SITUACAO.find(([id]) => id === modulo)?.[2] || 'o registro';

/** O que a fase faz sozinha no andamento, em frases curtas (resumo do editor, prévia e tela do processo). */
export function resumoAndamento(f) {
    const s = f?.situacao_registro;
    return [
        f?.espera && !f.final ? 'é de espera: ao concluir, o processo volta para a fase de onde veio' : null,
        f?.avanco === 'auto' && !f.final ? (f.espera ? 'volta sozinha ao cumprir o que a fase exige' : 'segue sozinha ao cumprir o que a fase exige') : null,
        f?.ao_entrar?.arquivar ? 'arquiva o processo ao entrar' : null,
        f?.juntada_conjunta ? 'tem o botão Finalizar: escolher, ordenar, assinar e juntar os documentos de uma vez' : null,
        s?.modulo && s.ao_entrar ? `${nomeDoRegistro(s.modulo)} fica "${s.ao_entrar}" ao entrar` : null,
        s?.modulo && s.ao_assumir ? `${nomeDoRegistro(s.modulo)} fica "${s.ao_assumir}" quando alguém assume` : null,
    ].filter(Boolean);
}

/** Troca um pedaço da regra do registro ligado. Sem módulo, a regra sai da fase. */
export function comSituacao(f, parte) {
    const n = { ...(f?.situacao_registro || {}), ...parte };
    Object.keys(n).forEach((k) => !n[k] && delete n[k]);
    return n.modulo ? n : undefined;
}

/** Aviso de que a fase seguiu sozinha (resposta do servidor ao cumprir o último item obrigatório: ação ou documento). */
export const textoAvanco = (a) => `Fase concluída: o processo seguiu para ${a.fase}${a.unidade ? `, em ${a.unidade}` : ''}${a.arquivado ? ', e foi arquivado' : ''}.`;
