// Andamento automático da fase e situação do registro ligado (Consultas,
// Expedientes e páginas próprias). Espelho de
// functions-v2/src/shared/situacaoRegistro.ts: o servidor é quem valida e
// aplica; aqui é só o que a tela mostra.

export const SITUACOES = ['Pendente', 'Em elaboração', 'Aguarda retorno de terceiros', 'Em revisão', 'Revisadas', 'Na pasta'];
/** [id, nome do módulo, como chamar um registro dele numa frase]. As páginas próprias vêm do órgão (`paginas`). */
export const MODULOS_SITUACAO = [['consultas', 'Consultas', 'a consulta'], ['expedientes', 'Expedientes', 'o expediente']];

const paginaDe = (s, paginas) => (paginas || []).find((x) => x.id === s?.pagina);
/** Nome do módulo da regra, para avisos. `paginas`: [{ id, nome, plural, fases: [{ key, label }] }]. */
export const nomeDoModuloDaRegra = (s, paginas) => (s?.modulo === 'paginas'
    ? paginaDe(s, paginas)?.plural || 'Páginas próprias'
    : MODULOS_SITUACAO.find(([id]) => id === s?.modulo)?.[1] || s?.modulo || '');
/** Como chamar o registro conduzido numa frase. */
export const nomeDoRegistro = (s, paginas) => (s?.modulo === 'paginas'
    ? `o registro de ${paginaDe(s, paginas)?.nome || 'página própria'}`
    : MODULOS_SITUACAO.find(([id]) => id === s?.modulo)?.[2] || 'o registro');
/** Situações que o registro pode ter: as do quadro ou, em página própria, as fases dela. [valor, rótulo]. */
export const situacoesDaRegra = (s, paginas) => (s?.modulo === 'paginas'
    ? (paginaDe(s, paginas)?.fases || []).map((x) => [x.key, x.label])
    : SITUACOES.map((x) => [x, x]));
const rotuloDoAlvo = (s, alvo, paginas) => situacoesDaRegra(s, paginas).find(([k]) => k === alvo)?.[1] || alvo;

/** O que a fase faz sozinha no andamento, em frases curtas (resumo do editor, prévia e tela do processo). */
export function resumoAndamento(f, paginas) {
    const s = f?.situacao_registro;
    return [
        f?.espera && !f.final ? 'é de espera: ao concluir, o processo volta para a fase de onde veio' : null,
        f?.avanco === 'auto' && !f.final ? (f.espera ? 'volta sozinha ao cumprir o que a fase exige' : 'segue sozinha ao cumprir o que a fase exige') : null,
        f?.ao_entrar?.arquivar ? 'arquiva o processo ao entrar' : null,
        f?.juntada_conjunta ? 'tem o botão Finalizar: escolher, ordenar, assinar e juntar os documentos de uma vez' : null,
        s?.modulo && s.ao_entrar ? `${nomeDoRegistro(s, paginas)} fica "${rotuloDoAlvo(s, s.ao_entrar, paginas)}" ao entrar` : null,
        s?.modulo && s.ao_assumir ? `${nomeDoRegistro(s, paginas)} fica "${rotuloDoAlvo(s, s.ao_assumir, paginas)}" quando alguém assume` : null,
    ].filter(Boolean);
}

/** Troca um pedaço da regra do registro ligado. Sem módulo (ou página própria sem a página), a regra sai da fase. */
export function comSituacao(f, parte) {
    const n = { ...(f?.situacao_registro || {}), ...parte };
    if (n.modulo !== 'paginas') delete n.pagina;
    Object.keys(n).forEach((k) => !n[k] && delete n[k]);
    return n.modulo && (n.modulo !== 'paginas' || n.pagina) ? n : undefined;
}

/** Valor do seletor "A fase conduz": o módulo ou, em página própria, `paginas:<id>`. */
export const valorDaRegra = (s) => (s?.modulo === 'paginas' ? `paginas:${s.pagina || ''}` : s?.modulo || '');
/** Regra depois de trocar o que a fase conduz. Trocar de quadro (consulta ou expediente por página, ou de página) zera as situações. */
export function comRegistroConduzido(f, valor) {
    const [modulo, pagina] = valor.startsWith('paginas:') ? ['paginas', valor.slice(8)] : [valor, ''];
    const antes = f?.situacao_registro;
    const mesmoQuadro = modulo !== 'paginas' && antes?.modulo !== 'paginas';
    return comSituacao(f, { modulo, pagina, ...(mesmoQuadro ? {} : { ao_entrar: '', ao_assumir: '' }) });
}

/** Página ou fase que a regra cita e não existe mais. `paginas`: as páginas do órgão; `null` enquanto não se sabe. */
export function problemaDaPagina(s, paginas) {
    if (s?.modulo !== 'paginas' || !paginas) return null;
    const pg = paginaDe(s, paginas);
    if (!pg) return 'conduz o registro de uma página própria que não existe mais ou está desativada';
    const fora = [s.ao_entrar, s.ao_assumir].find((a) => a && !pg.fases.some((x) => x.key === a));
    return fora ? `manda o registro de ${pg.nome} para a fase "${fora}", que a página não tem mais` : null;
}

/** Aviso de que a fase seguiu sozinha (resposta do servidor ao cumprir o último item obrigatório: ação ou documento). */
export const textoAvanco = (a) => `Fase concluída: o processo seguiu para ${a.fase}${a.unidade ? `, em ${a.unidade}` : ''}${a.arquivado ? ', e foi arquivado' : ''}.`;
