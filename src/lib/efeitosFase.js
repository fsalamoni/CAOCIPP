// O que a fase faz sozinha, além do prazo e do arquivamento: efeitos ao entrar,
// quem é avisado e as regras dos prazos que ela abre. Espelho de
// functions-v2/src/shared/efeitosFase.ts, só para a tela: quem decide é o
// servidor. Testado em efeitosFase.test.js.

export const ALERTA_PADRAO = 2;
export const MAX_ALERTA_DIAS = 30;
export const MAX_PENDENCIA_FASE = 300;
export const MAX_MENSAGEM_AVISO = 300;

/** Opções dos seletores do editor: [valor, rótulo]. */
export const SIGILO_FASE = [['', 'Não muda'], ['restrito', 'Passa a restrito'], ['normal', 'Volta ao normal']];
export const DESIGNA = [
    ['', 'Ninguém: fica como estiver'],
    ['autor', 'Quem moveu o processo para a fase'],
    ['gestor', 'Quem gere a unidade'],
    ['atribuicao', 'Quem tem certa atribuição na lotação'],
];
export const AVISO_PARA = [
    ['', 'Como sempre: a unidade, quando o processo chega por remessa'],
    ['unidade', 'Toda a unidade, sempre que o processo entra na fase'],
    ['gestores', 'Só quem gere a unidade'],
    ['responsavel', 'Só o responsável pelo processo'],
    ['ninguem', 'Ninguém'],
];

/** A fase abre algum prazo sozinha (o dela ou o de alguma ação)? Só então valem a antecedência do alerta e a regra do vencimento. */
export const abrePrazo = (f) => (!!f?.prazo_auto && f.prazo_dias > 0)
    || (f?.acoes_regras || []).some((r, i) => r?.prazo_dias > 0 && r.pede !== 'orientacao' && !!f.acoes?.[i]?.trim());

const limpo = (o) => {
    const n = { ...o };
    Object.keys(n).forEach((k) => (n[k] === undefined || n[k] === false || n[k] === '') && delete n[k]);
    return Object.keys(n).length ? n : undefined;
};

/**
 * `ao_entrar` com a mudança pedida. Escolhas que se excluem não ficam juntas:
 * marcar e tirar a urgência, tirar e designar o responsável; fase que arquiva
 * não designa nem abre pendência.
 */
export function comAoEntrar(f, patch) {
    const n = { ...(f?.ao_entrar || {}), ...patch };
    if (patch.urgente) delete n.sem_urgencia;
    if (patch.sem_urgencia) delete n.urgente;
    if (patch.sem_responsavel) { delete n.responsavel; delete n.responsavel_atribuicao; }
    if (patch.responsavel) delete n.sem_responsavel;
    if (n.responsavel !== 'atribuicao') delete n.responsavel_atribuicao;
    else if (n.responsavel_atribuicao === undefined) n.responsavel_atribuicao = '';
    if (!n.pendencia) delete n.pendencia_interrompe;
    if (n.arquivar) { delete n.responsavel; delete n.responsavel_atribuicao; delete n.pendencia; delete n.pendencia_interrompe; }
    // A atribuição em branco fica (o campo está aberto para digitar); o resto vazio sai.
    const { responsavel_atribuicao: atr, ...resto } = n;
    const out = limpo(resto);
    return n.responsavel === 'atribuicao' ? { ...(out || {}), responsavel_atribuicao: atr || '' } : out;
}

/** `aviso` com a mudança pedida (sem aviso, a mensagem sai). */
export function comAviso(f, patch) {
    const n = { ...(f?.aviso || {}), ...patch };
    if (n.para === 'ninguem') delete n.mensagem;
    return limpo(n);
}

/** `prazo_vencido` com a mudança pedida. */
export const comPrazoVencido = (f, patch) => limpo({ ...(f?.prazo_vencido || {}), ...patch });

const QUEM_DESIGNA = { autor: 'quem moveu o processo', gestor: 'quem gere a unidade' };

/** O que a fase faz ao entrar, em frases curtas (resumo do editor e prévia). Sem o arquivamento, que tem lugar próprio. */
export function efeitosAoEntrar(f) {
    const ae = f?.ao_entrar || {};
    return [
        ae.urgente && 'marca o processo como urgente',
        ae.sem_urgencia && 'tira a urgência',
        ae.sigilo === 'restrito' && 'torna o processo restrito',
        ae.sigilo === 'normal' && 'volta o sigilo ao normal',
        ae.sem_responsavel && 'tira o responsável designado',
        ae.responsavel && `designa como responsável ${QUEM_DESIGNA[ae.responsavel] || `quem tem a atribuição "${(ae.responsavel_atribuicao || '').trim() || '…'}"`}`,
        ae.pendencia?.trim() && `abre pendência para quem decide${ae.pendencia_interrompe ? ', que interrompe a fase até ser apreciada' : ''}`,
    ].filter(Boolean);
}

/** A quem a fase avisa, em uma frase; null quando é o de sempre e sem mensagem. */
export function textoDoAviso(f) {
    const a = f?.aviso;
    if (!a?.para && !a?.mensagem) return null;
    const quem = { unidade: 'avisa toda a unidade ao entrar', gestores: 'avisa quem gere a unidade ao entrar', responsavel: 'avisa o responsável ao entrar (sem responsável, a unidade)', ninguem: 'não avisa ninguém ao entrar' }[a.para]
        || 'avisa a unidade quando chega por remessa';
    return a.mensagem && a.para !== 'ninguem' ? `${quem}, com a mensagem "${a.mensagem}"` : quem;
}

/** Regras dos prazos que a fase abre: antecedência do alerta e o que acontece no vencimento. */
export function textosDosPrazos(f) {
    if (!abrePrazo(f)) return [];
    const n = f.prazo_alerta_dias;
    const v = f.prazo_vencido || {};
    return [
        Number.isInteger(n) && n !== ALERTA_PADRAO && (n === 0 ? 'alerta de prazo só no dia do vencimento' : `alerta de prazo ${n} dias antes do vencimento`),
        (v.urgente || v.avisar_gestores) && `prazo vencido: ${[v.urgente && 'o processo fica urgente', v.avisar_gestores && 'quem gere a unidade é avisado'].filter(Boolean).join(' e ')}`,
    ].filter(Boolean);
}

/** Prazo próprio da ação, em texto: "3 dias úteis". */
export const textoPrazoDaAcao = (r) => (r?.prazo_dias > 0 ? `${r.prazo_dias} ${r.prazo_dias === 1 ? 'dia' : 'dias'} ${r.prazo_contagem === 'corridos' ? (r.prazo_dias === 1 ? 'corrido' : 'corridos') : (r.prazo_dias === 1 ? 'útil' : 'úteis')}` : '');

/** O que o servidor recusaria ao salvar (para as pendências do editor). */
export function problemasDosEfeitos(f) {
    const ae = f?.ao_entrar || {};
    return [
        ae.urgente && ae.sem_urgencia && 'marca e tira a urgência ao entrar: escolha uma das duas',
        ae.sem_responsavel && ae.responsavel && 'tira e designa o responsável ao entrar: escolha uma das duas',
        ae.responsavel === 'atribuicao' && !(ae.responsavel_atribuicao || '').trim() && 'designa o responsável pela atribuição, mas não diz qual: informe a atribuição como está na lotação (ex.: Promotor)',
        ae.arquivar && (ae.responsavel || ae.pendencia) && 'arquiva o processo ao entrar: não cabe designar responsável nem abrir pendência nela',
    ].filter(Boolean);
}

/** Prazo aberto da ação `i` da fase, na rodada atual, se houver (para a tela do processo). */
export const prazoAbertoDaAcao = (prazos, faseId, i) =>
    (prazos || []).find((x) => x.status === 'aberto' && x.fase_id === faseId && x.acao_idx === i && x.rodada_fim !== true) || null;

/** Recado do prazo aberto da ação, para a tela do processo (só a equipe vê); undefined sem prazo. */
export const notaDoPrazo = (prazo, hoje) => (prazo?.vence_em
    ? `Prazo da ação: ${hoje && hoje > prazo.vence_em ? 'venceu' : 'vence'} em ${prazo.vence_em.split('-').reverse().join('/')}.`
    : undefined);
