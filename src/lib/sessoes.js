// Sessões de julgamento dos colegiados: textos e regras de tela, no mesmo
// jeito de functions-v2/src/shared/sessoes.ts (o servidor confere tudo de novo).
import { composicaoEm } from './orgaos.js';

export const MODOS_SESSAO = [['presencial', 'Presencial'], ['virtual', 'Por videoconferência'], ['hibrida', 'Híbrida (presencial e por vídeo)']];
export const CARATER_SESSAO = [['ordinaria', 'Ordinária'], ['extraordinaria', 'Extraordinária']];
export const SITUACAO_SESSAO = { rascunho: 'Rascunho da pauta', publicada: 'Pauta publicada', encerrada: 'Encerrada', cancelada: 'Cancelada' };
export const INCLUSAO = { pauta: 'Pauta', extrapauta: 'Extrapauta', mesa: 'Em mesa' };

export const br = (d) => String(d || '').split('-').reverse().join('/');

/** "em Sala 2", "por videoconferência (link)", "em Sala 2 e por videoconferência (link)". */
export function ondeSessao(s) {
    if (s.modo === 'virtual') return `por videoconferência (${s.link})`;
    if (s.modo === 'hibrida') return `em ${s.local} e por videoconferência (${s.link})`;
    return `em ${s.local}`;
}

/** "15/12/2026, às 14:00, em Sala 2". */
export const quandoSessao = (s) => `${br(s.data)}, às ${s.hora}, ${ondeSessao(s)}`;

/** Regra de antecedência do colegiado, em uma frase (ou '' sem regra). */
export function textoAntecedencia(regras) {
    const n = Number(regras?.antecedencia) || 0;
    if (!n) return '';
    return `A pauta sai com ao menos ${n} ${regras.contagem === 'corridos' ? (n === 1 ? 'dia' : 'dias') : (n === 1 ? 'dia útil' : 'dias úteis')} de antecedência.`;
}

/** Problemas do formulário da sessão, na ordem em que a pessoa preenche (o servidor repete a conferência). */
export function problemasDaSessao(s, hoje) {
    const out = [];
    if (!s.data) out.push('Informe a data da sessão.');
    else if (s.data < hoje) out.push('A data da sessão já passou.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.hora || '')) out.push('Informe a hora da sessão.');
    if (s.modo !== 'virtual' && !String(s.local || '').trim()) out.push('Informe o local da sessão.');
    if (s.modo !== 'presencial' && !String(s.link || '').trim()) out.push('Informe o link ou a sala virtual.');
    return out;
}

/**
 * Quem vê a aba Sessões: o admin, quem administra um colegiado, quem está
 * lotado em unidade de colegiado e quem compõe um colegiado hoje.
 */
export function veSessoes(estado, hoje, orgaoId) {
    const colegiados = (estado?.orgaos || []).filter((o) => o.decisao === 'colegiada' && o.ativo !== false && (!orgaoId || o.id === orgaoId));
    if (!colegiados.length) return false;
    if (estado.isAdmin) return true;
    const ids = new Set(colegiados.map((o) => o.id));
    return colegiados.some((o) => (estado.adminOrgaos || []).includes(o.id) || composicaoEm(o.composicao || [], hoje).some((m) => m.uid === estado.uid))
        || (estado.unidades || []).some((u) => ids.has(u.orgao_id) && (estado.minhasUnidades || []).includes(u.id));
}

/** Agrupa a lista de sessões para a tela: minhas, próximas, rascunhos e passadas. */
export function agruparSessoes(sessoes, hoje) {
    const ativa = (s) => s.situacao !== 'cancelada' && s.situacao !== 'encerrada';
    return {
        minhas: sessoes.filter((s) => s.componho && s.situacao === 'publicada' && s.data >= hoje),
        proximas: sessoes.filter((s) => !s.componho && s.situacao === 'publicada' && s.data >= hoje),
        rascunhos: sessoes.filter((s) => s.situacao === 'rascunho'),
        passadas: sessoes.filter((s) => !ativa(s) || (s.situacao === 'publicada' && s.data < hoje)).reverse(),
    };
}

// ---- Votação na sessão (S4): espelho de functions-v2/src/shared/sessoes.ts ----

/** Como o vogal vota. */
export const MODOS_VOTO = {
    acompanha: 'Acompanho o relator',
    ressalva: 'Acompanho o relator, com ressalva',
    diverge: 'Divirjo do relator',
    impedido: 'Declaro-me impedido',
    suspeito: 'Declaro-me suspeito',
};

/** "Acompanha o relator", "Diverge: Improcedente", "Impedido". */
export function textoDoVoto(v) {
    if (!v?.modo) return '';
    if (v.modo === 'acompanha') return 'Acompanha o relator';
    if (v.modo === 'ressalva') return 'Acompanha, com ressalva';
    if (v.modo === 'diverge') return `Diverge: ${v.resultado}`;
    return v.modo === 'impedido' ? 'Impedido' : 'Suspeito';
}

/** Situação do julgamento na linha da pauta (resumo vindo de sessaoObter). */
export function situacaoDaVotacao(x) {
    const v = x?.votacao;
    if (!v) return '';
    if (v.proclamado) return `Proclamado: ${v.proclamado}`;
    if (v.aguarda_meu_voto) return 'Aguarda o seu voto';
    if (v.liberado) return `${v.votaram} de ${v.vogais} ${v.vogais === 1 ? 'vogal votou' : 'vogais votaram'}`;
    if (v.sou_relator) return 'Você relata: voto a liberar';
    return x.relator_nome ? 'Voto do relator a liberar' : '';
}
