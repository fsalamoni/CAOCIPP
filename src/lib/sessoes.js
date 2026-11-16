// Sessões de julgamento dos colegiados: textos e regras de tela, no mesmo
// jeito de functions-v2/src/shared/sessoes.ts (o servidor confere tudo de novo).
import { composicaoEm } from './orgaos.js';

export const MODOS_SESSAO = [['presencial', 'Presencial'], ['virtual', 'Por videoconferência'], ['hibrida', 'Híbrida (presencial e por vídeo)'], ['assincrona', 'Virtual assíncrona (votação por período)']];
export const CARATER_SESSAO = [['ordinaria', 'Ordinária'], ['extraordinaria', 'Extraordinária']];
export const SITUACAO_SESSAO = { rascunho: 'Rascunho da pauta', publicada: 'Pauta publicada', encerrada: 'Encerrada', cancelada: 'Cancelada' };
export const INCLUSAO = { pauta: 'Pauta', extrapauta: 'Extrapauta', mesa: 'Em mesa' };

export const br = (d) => String(d || '').split('-').reverse().join('/');

/** "em Sala 2", "por videoconferência (link)", "em Sala 2 e por videoconferência (link)". */
export function ondeSessao(s) {
    if (s.modo === 'assincrona') return 'em sessão virtual';
    if (s.modo === 'virtual') return `por videoconferência (${s.link})`;
    if (s.modo === 'hibrida') return `em ${s.local} e por videoconferência (${s.link})`;
    return `em ${s.local}`;
}

/** "15/12/2026, às 14:00, em Sala 2" ou, na sessão virtual, "votação virtual de 07/12/2026 (09:00) a 14/12/2026". */
export const quandoSessao = (s) => (s.modo === 'assincrona'
    ? `votação virtual de ${br(s.data)} (a partir das ${s.hora}) a ${br(s.fim)}`
    : `${br(s.data)}, às ${s.hora}, ${ondeSessao(s)}`);

/** Último dia em que a sessão acontece (na virtual, o fim da votação). */
export const ultimoDia = (s) => s.fim || s.data;

const somarDias = (data, n) => {
    const d = new Date(`${data}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};

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
    if (s.modo === 'assincrona') {
        if (!s.fim) out.push('Informe o último dia da votação.');
        else if (s.data && s.fim < s.data) out.push('O último dia da votação não pode ser antes do primeiro.');
        else if (s.data && s.fim > somarDias(s.data, 30)) out.push('A votação virtual dura no máximo 30 dias.');
        return out;
    }
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
        minhas: sessoes.filter((s) => s.componho && s.situacao === 'publicada' && ultimoDia(s) >= hoje),
        proximas: sessoes.filter((s) => !s.componho && s.situacao === 'publicada' && ultimoDia(s) >= hoje),
        rascunhos: sessoes.filter((s) => s.situacao === 'rascunho'),
        passadas: sessoes.filter((s) => !ativa(s) || (s.situacao === 'publicada' && ultimoDia(s) < hoje)).reverse(),
    };
}

/**
 * S15: guia da secretaria para pôr o colegiado a funcionar, passo a passo,
 * conferido com o que já existe (composição, unidade e sessões do colegiado).
 */
export function passosDoColegiado(c, sessoes) {
    const doColegiado = sessoes.filter((s) => s.orgao_id === c.id && s.situacao !== 'cancelada');
    const julgamento = doColegiado.filter((s) => s.tipo !== 'reuniao');
    return [
        { id: 'composicao', feito: (c.membros || 0) > 0 && !!c.presidente, titulo: 'Composição com presidente e membros', ajuda: 'Na configuração do Processo Eletrônico, aba Estrutura, abra o colegiado e cadastre presidente, titulares e suplentes, com o período de cada um. Quem vota em cada sessão é quem compõe o colegiado no dia.' },
        { id: 'unidade', feito: (c.unidades || 0) > 0, titulo: 'Unidade do colegiado', ajuda: 'Em Unidades e equipes, cadastre ao menos uma unidade vinculada ao colegiado, de preferência a secretaria que expede. Só entram na pauta processos que estão numa unidade dele.' },
        { id: 'sessao', feito: doColegiado.length > 0, titulo: 'Primeira sessão marcada', ajuda: 'Use Marcar sessão: data, hora, modo (presencial, virtual, híbrida ou assíncrona) e caráter. A sessão nasce como rascunho de pauta.' },
        { id: 'pauta', feito: julgamento.some((s) => (s.itens || 0) > 0) || doColegiado.some((s) => s.tipo === 'reuniao' && (s.itens || 0) > 0), titulo: 'Processos na pauta', ajuda: 'Entram os processos com julgamento pendente na fase: o rito precisa da ação Julgar em colegiado (veja Modelos de rito com sessão, na biblioteca). Na reunião, a pauta é de assuntos.' },
        { id: 'publicada', feito: doColegiado.some((s) => s.situacao !== 'rascunho'), titulo: 'Pauta publicada', ajuda: 'Ao publicar, cada processo recebe a certidão de inclusão nos autos, as partes são avisadas e os membros veem a sessão em Minhas próximas sessões.' },
        { id: 'realizada', feito: doColegiado.some((s) => s.situacao === 'encerrada'), titulo: 'Sessão realizada e ata', ajuda: 'No dia, registre a presença, chame cada processo, colha os votos e proclame. Ao encerrar, o sistema gera a ata para o presidente e a secretaria assinarem.' },
    ];
}

/** S15: colunas dos julgados do relatório, para as exportações de tabela (CSV e Excel). */
export const COLUNAS_RELATORIO = [
    { label: 'Data da sessão', value: (l) => br(l.data) },
    { label: 'Sessão', key: 'sessao' },
    { label: 'Processo', key: 'numero' },
    { label: 'Relator', key: 'relator' },
    { label: 'Resultado', key: 'resultado' },
    { label: 'Redator do acórdão', key: 'redator' },
    { label: 'Prazo do acórdão', value: (l) => (l.prazo_acordao ? br(l.prazo_acordao) : '') },
    { label: 'Acórdão juntado em', value: (l) => (l.juntado_em ? br(l.juntado_em) : l.acordao_pendente ? 'pendente' : '') },
    { label: 'Dias até o acórdão', key: 'dias_ate_acordao' },
];

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
    if (x.situacao === 'vista') return x.vista?.devolvida ? 'Vista devolvida: o julgamento continua em outra sessão' : 'Julgamento suspenso pela vista';
    if (x.situacao && x.situacao !== 'pautado') return '';
    if (v.aguarda_meu_voto) return 'Aguarda o seu voto';
    if (v.liberado) return `${v.votaram} de ${v.vogais} ${v.vogais === 1 ? 'vogal votou' : 'vogais votaram'}`;
    if (v.sou_relator) return 'Você relata: voto a liberar';
    return x.relator_nome ? 'Voto do relator a liberar' : '';
}

// ---- Vista, adiamento e diligência (S5) ----

/** Selo do item que saiu do julgamento na sessão. */
export const SITUACAO_ITEM = { pautado: 'Pautado', retirado: 'Retirado', vista: 'Pedido de vista', adiado: 'Adiado', diligencia: 'Convertido em diligência', destacado: 'Destacado para sessão síncrona' };
export const ROTULO_MOTIVO = { pautado: 'Motivo da inclusão', retirado: 'Motivo da retirada', adiado: 'Motivo do adiamento', diligencia: 'Diligência determinada', destacado: 'Destaque' };

// ---- Sessão virtual, destaque, sustentação oral e preferência (S7) ----

export const NOME_PEDIDO = { sustentacao: 'Sustentação oral', preferencia: 'Preferência', destaque: 'Destaque', esclarecimento: 'Esclarecimento de fato' };
export const SITUACAO_PEDIDO = { pedido: 'Aguarda decisão', deferido: 'Deferido', indeferido: 'Indeferido' };

/** Selos da linha da pauta com os pedidos das partes (resumo vindo de sessaoObter). */
export function selosDosPedidos(p) {
    if (!p) return [];
    const out = [];
    if (p.sustentacao) out.push(p.sustentacao > 1 ? `${p.sustentacao} sustentações orais` : 'Sustentação oral');
    if (p.preferencia) out.push('Preferência');
    if (p.destaque) out.push('Destaque pedido');
    if (p.esclarecimento) out.push(p.esclarecimento > 1 ? `${p.esclarecimento} esclarecimentos` : 'Esclarecimento de fato');
    return out;
}

/**
 * Ordem de julgamento do CPC, art. 936: primeiro os processos com sustentação
 * oral, depois os com preferência, os que começaram em sessão anterior e os
 * demais, cada grupo na ordem atual. Devolve os ids, para `sessaoOrdenar`.
 */
export function ordemDoCPC(itens) {
    const grupo = (x) => {
        if (x.situacao !== 'pautado') return 4;
        if (x.pedidos?.sustentacao) return 0;
        if (x.pedidos?.preferencia) return 1;
        return x.continua ? 2 : 3;
    };
    return [...itens].sort((a, b) => grupo(a) - grupo(b) || a.ordem - b.ordem).map((x) => x.processo_id);
}

/** Lista de nomes em português: "Ana", "Ana e Bruno", "Ana, Bruno e Carla". */
export const juntarNomes = (nomes = []) => (nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0] || '');

/** "Vista: Ana e Bruno, até 25/11/2026." ou "Vista de Ana, devolvida." */
export function textoDaVistaNaPauta(v) {
    if (!v?.nomes?.length) return '';
    return v.devolvida ? `Vista de ${juntarNomes(v.nomes)}, devolvida.` : `Vista: ${juntarNomes(v.nomes)}, até ${br(v.prazo)}.`;
}

// ---- S8: agenda (.ics) e ata ----

export const PAPEL_ATA = { presidente: 'Presidente', secretaria: 'Secretaria' };

const icsTexto = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
// Brasília sem horário de verão (desde 2019): UTC-3.
const icsUtc = (data, hora) => new Date(`${data}T${hora || '00:00'}:00-03:00`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
// RFC 5545: linhas de até 75 octetos, continuadas com espaço.
const dobrar = (l) => (l.length <= 73 ? l : l.match(/.{1,73}/gu).join('\r\n '));

/**
 * Arquivo de agenda da sessão, para o calendário de quem participa (membros e
 * partes). Na virtual, o período inteiro da votação, como dia inteiro; nas
 * outras, a hora marcada, com duas horas de duração.
 */
export function icsDaSessao(s, { colegiado = '', url = '', agora = new Date() } = {}) {
    const virtual = s.modo === 'assincrona';
    const quando = virtual
        ? [`DTSTART;VALUE=DATE:${s.data.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${somarDias(s.fim || s.data, 1).replace(/-/g, '')}`]
        : [`DTSTART:${icsUtc(s.data, s.hora)}`, 'DURATION:PT2H'];
    const onde = virtual ? 'Sessão virtual' : s.modo === 'presencial' ? s.local : s.modo === 'virtual' ? s.link : `${s.local} e ${s.link}`;
    const desc = `${virtual ? `Votação virtual de ${br(s.data)} a ${br(s.fim)}` : `${br(s.data)}, às ${s.hora}, ${ondeSessao(s)}`}.${url ? ` Pauta e julgamento: ${url}` : ''}`;
    return [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SIGO//Sessoes de julgamento//PT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
        `UID:sessao-${s.id || s.data}@sigo`, `DTSTAMP:${agora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, ...quando,
        `SUMMARY:${icsTexto(`${s.titulo}${colegiado ? ` (${colegiado})` : ''}`)}`, `LOCATION:${icsTexto(onde)}`, `DESCRIPTION:${icsTexto(desc)}`,
        ...(url ? [`URL:${url}`] : []), 'END:VEVENT', 'END:VCALENDAR',
    ].map(dobrar).join('\r\n').concat('\r\n');
}
