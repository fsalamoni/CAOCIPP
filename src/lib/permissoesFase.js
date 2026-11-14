// Quem pode praticar cada ato, pelo rito: cumprir a ação, concluir a fase,
// dispensar o que ela exige, seguir por outro caminho e mudar a situação.
// Espelho de functions-v2/src/shared/permissoesFase.ts: aqui é só o que a tela
// mostra; quem decide é o servidor. A administração do Processo Eletrônico
// sempre pode.

const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** A mesma atribuição, sem contar acento, caixa e espaços a mais. */
/**
 * Papéis da unidade no processo: quem recebe a conclusão e aprecia pendências
 * (`decide`) e quem expede comunicação às partes (`expede`). O servidor manda
 * resolvido; sem o campo (tela de edição, dado antigo), vale o padrão do tipo.
 */
export const unidadeDecide = (u) => (typeof u?.decide === 'boolean' ? u.decide : u?.tipo === 'gabinete');
export const unidadeExpede = (u) => (typeof u?.expede === 'boolean' ? u.expede : (u?.tipo || 'secretaria') === 'secretaria');
/** O que vai ao servidor ao salvar a unidade (ele guarda só o que difere do padrão do tipo). */
export const papeisDaUnidade = (u) => ({ decide: unidadeDecide(u), expede: unidadeExpede(u) });

export const mesmaAtribuicao = (a, b) => { const x = sem(a); return !!x && x === sem(b); };

/** A pessoa atende à reserva? `a`: { isAdmin, gestor, responsavel, atribuicao } (ver atorNoProcesso). */
export function podeQuem(quem, atribuicao, a) {
    if (!quem || a?.isAdmin) return true;
    if (quem === 'responsavel') return !!a?.responsavel;
    if (quem === 'gestor') return !!a?.gestor;
    return mesmaAtribuicao(atribuicao, a?.atribuicao);
}
export const podeReserva = (r, a) => !r || !!a?.isAdmin || (r === 'gestor' && !!a?.gestor);

export const textoQuem = (quem, atribuicao) => (quem === 'responsavel' ? 'o responsável pelo processo' : quem === 'gestor' ? 'quem gere a unidade' : `quem tem a atribuição "${atribuicao || ''}"`);
export const textoReserva = (r) => (r === 'gestor' ? 'quem gere a unidade' : 'a administração do Processo Eletrônico');

/** Opções do editor: quem cumpre a ação ou conclui a fase. */
export const QUEM = [['', 'Quem tem o processo'], ['responsavel', 'Só o responsável designado'], ['gestor', 'Só quem gere a unidade'], ['atribuicao', 'Só quem tem certa atribuição']];
/** Opções do editor para um ato reservado; `livre`: o rótulo de quando ninguém é reservado. */
export const reservas = (livre) => [['', livre], ['gestor', 'Só quem gere a unidade'], ['admin', 'Só a administração do Processo Eletrônico']];
/** Selo curto da reserva ("só o responsável"). */
export const rotuloQuem = (quem, atribuicao) => (quem === 'responsavel' ? 'só o responsável' : `só ${textoQuem(quem, atribuicao)}`);

/** Quem a pessoa é, para o rito, na unidade que tem o processo. `estado`: o do Processo Eletrônico. */
export function atorNoProcesso(estado, p) {
    const un = (estado?.unidades || []).find((u) => u.id === p?.unidade_atual);
    return {
        isAdmin: !!estado?.isAdmin, gestor: (estado?.gestorDe || []).includes(p?.unidade_atual),
        responsavel: !!p?.responsavel_uid && p.responsavel_uid === estado?.uid,
        atribuicao: (un?.lotacoes || []).find((l) => l.uid === estado?.uid)?.atribuicao || '',
    };
}

/** Permissões da fase depois de trocar um pedaço; `undefined` quando nada fica reservado. */
export function comPermissao(pm, parte) {
    const n = { ...(pm || {}), ...parte };
    if (n.concluir !== 'atribuicao') delete n.concluir_atribuicao;
    // A atribuição vazia fica enquanto se digita: quem acusa a falta é a lista de pendências.
    Object.keys(n).forEach((k) => (n[k] === undefined || (n[k] === '' && k !== 'concluir_atribuicao')) && delete n[k]);
    return Object.keys(n).length ? n : undefined;
}

/** O que a fase reserva, em frases curtas (resumo do editor, prévia e tela do processo). */
export function resumoPermissoes(pm) {
    return [
        pm?.concluir ? `só ${textoQuem(pm.concluir, pm.concluir_atribuicao)} conclui a fase` : null,
        pm?.dispensar ? `só ${textoReserva(pm.dispensar)} dispensa o que ela exige` : null,
        pm?.desviar ? `só ${textoReserva(pm.desviar)} segue por caminho fora do previsto` : null,
        pm?.situacao ? `só ${textoReserva(pm.situacao)} arquiva, sobresta ou reativa o processo` : null,
    ].filter(Boolean);
}

/** Atribuições que existem nas lotações do órgão, sem repetir, em ordem alfabética (sugestões do editor). */
export function atribuicoesDoOrgao(unidades) {
    const vistas = new Map();
    (unidades || []).forEach((u) => (u.lotacoes || []).forEach((l) => {
        const a = String(l.atribuicao || '').trim();
        if (a && !vistas.has(sem(a))) vistas.set(sem(a), a);
    }));
    return [...vistas.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Alguém lotado na unidade tem a atribuição? `null` quando não dá para saber (unidade nova ou não informada). */
export function alguemTem(unidades, unidadeId, atribuicao) {
    const un = (unidades || []).find((u) => u.id === unidadeId);
    if (!un || !String(atribuicao || '').trim()) return null;
    return (un.lotacoes || []).some((l) => mesmaAtribuicao(atribuicao, l.atribuicao));
}
