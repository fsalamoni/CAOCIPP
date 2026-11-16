import { CalendarioOrgao, Contagem, calcularVencimento, somarDias, texto } from './secretaria';
import { acaoAtiva, respostasDaFase } from './exigencias';
import { composicaoEm } from './orgaos';
import type { MembroColegiado } from './orgaos';
import type { Voto } from './julgamento';

/**
 * Sessões de julgamento de um colegiado: dados da sessão, pauta e
 * antecedência mínima. Regras puras, sem banco (a gravação está em
 * secretaria/sessoes.ts). A sessão é do órgão interno que decide em
 * colegiado; a pauta lista processos que têm o julgamento pendente na fase.
 */

export const MODOS_SESSAO = ['presencial', 'virtual', 'hibrida', 'assincrona'] as const;
export type ModoSessao = typeof MODOS_SESSAO[number];
export const CARATER_SESSAO = ['ordinaria', 'extraordinaria'] as const;
export type CaraterSessao = typeof CARATER_SESSAO[number];
/** rascunho: só a secretaria vê; publicada: pauta pública; encerrada; cancelada. */
export type SituacaoSessao = 'rascunho' | 'publicada' | 'encerrada' | 'cancelada';
/** Como o item entrou: na pauta publicada, depois dela (extrapauta) ou em mesa (urgente, sem pauta). */
export const INCLUSOES = ['pauta', 'extrapauta', 'mesa'] as const;
export type Inclusao = typeof INCLUSOES[number];

export const MAX_PAUTA = 100;
export const MAX_ANTECEDENCIA = 60;

export interface DadosSessao {
    titulo: string;
    carater: CaraterSessao;
    modo: ModoSessao;
    data: string;
    hora: string;
    local: string;
    link: string;
    observacoes: string;
    /**
     * Sessão virtual assíncrona (S7): último dia da votação; `data` é o
     * primeiro e `hora`, a abertura. Vazio nos outros modos.
     */
    fim?: string;
}

export interface ItemPauta {
    processo_id: string;
    numero: string;
    assunto: string;
    ordem: number;
    inclusao: Inclusao;
    motivo: string;
    /**
     * pautado; retirado (com motivo); vista (julgamento suspenso por pedido de
     * vista); adiado (para a sessão seguinte); diligencia (convertido em
     * diligência); destacado (da sessão virtual para uma síncrona, S7).
     * Julgado se lê do processo.
     */
    situacao: 'pautado' | 'retirado' | 'vista' | 'adiado' | 'diligencia' | 'destacado';
    /** Pedido de vista: quem pediu e até quando. */
    vista?: { nomes: string[]; prazo: string; devolvida?: boolean };
    incluido_em: string;
    /** Relator designado pela secretaria entre quem vota no dia (S4). */
    relator_uid?: string;
    relator_nome?: string;
}

/**
 * Regras de pauta do colegiado. `antecedencia`: mínima entre publicar a pauta e
 * a sessão (sem regra, 0). `vista_dias`: prazo do pedido de vista, na mesma
 * contagem (sem regra, VISTA_PADRAO, como no CPC, art. 940). `acordao_dias`:
 * prazo do redator para o acórdão (sem regra, ACORDAO_PADRAO, como no CPC,
 * art. 944).
 */
export interface RegrasSessao {
    antecedencia: number; contagem: Contagem; vista_dias?: number; acordao_dias?: number;
    /** Reuniões (S9): quórum para deliberar (ausente = maioria) e empate (ausente = voto de qualidade do presidente). */
    quorum?: 'um_terco' | 'dois_tercos' | 'livre'; desempate?: 'rejeita';
}
export const VISTA_PADRAO = 10;
export const MAX_VISTA = 90;
export const ACORDAO_PADRAO = 30;
export const MAX_EMENTA = 5000;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function sanitizeRegrasSessao(raw: unknown): RegrasSessao {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const n = Math.round(Number(r.antecedencia));
    const v = Math.round(Number(r.vista_dias));
    const a = Math.round(Number(r.acordao_dias));
    return {
        antecedencia: Number.isFinite(n) ? Math.max(0, Math.min(MAX_ANTECEDENCIA, n)) : 0, contagem: r.contagem === 'corridos' ? 'corridos' : 'uteis',
        // Ausente = o padrão; só se guarda o que difere dele.
        ...(Number.isFinite(v) && v >= 1 && v <= MAX_VISTA && v !== VISTA_PADRAO ? { vista_dias: v } : {}),
        ...(Number.isFinite(a) && a >= 1 && a <= MAX_VISTA && a !== ACORDAO_PADRAO ? { acordao_dias: a } : {}),
        ...(['um_terco', 'dois_tercos', 'livre'].includes(r.quorum as string) ? { quorum: r.quorum as 'um_terco' | 'dois_tercos' | 'livre' } : {}),
        ...(r.desempate === 'rejeita' ? { desempate: 'rejeita' as const } : {}),
    };
}

/** Último dia para o redator entregar o acórdão (S6). */
export function prazoDoAcordao(hoje: string, regras: RegrasSessao, cal?: CalendarioOrgao): string {
    return calcularVencimento(hoje, regras.acordao_dias || ACORDAO_PADRAO, regras.contagem, cal);
}

/** Último dia para devolver a vista pedida em `hoje`. */
export function prazoDaVista(hoje: string, regras: RegrasSessao, cal?: CalendarioOrgao): string {
    return calcularVencimento(hoje, regras.vista_dias || VISTA_PADRAO, regras.contagem, cal);
}

/** Dados da sessão conferidos; lança com a explicação. */
export function sanitizeDadosSessao(raw: unknown): DadosSessao {
    const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const d: DadosSessao = {
        titulo: texto(s.titulo, 120),
        carater: s.carater === 'extraordinaria' ? 'extraordinaria' : 'ordinaria',
        modo: MODOS_SESSAO.includes(s.modo as ModoSessao) ? (s.modo as ModoSessao) : 'presencial',
        data: typeof s.data === 'string' && DATA.test(s.data) && !Number.isNaN(Date.parse(`${s.data}T00:00:00Z`)) ? s.data : '',
        hora: typeof s.hora === 'string' && HORA.test(s.hora) ? s.hora : '',
        local: texto(s.local, 200),
        link: texto(s.link, 500),
        observacoes: texto(s.observacoes, 2000),
    };
    if (!d.data) throw new Error('Informe a data da sessão');
    if (!d.hora) throw new Error('Informe a hora da sessão (HH:MM)');
    if (d.modo === 'assincrona') {
        // Sem local nem sala: o link é opcional (onde acompanhar, se houver).
        const fim = typeof s.fim === 'string' && DATA.test(s.fim) && !Number.isNaN(Date.parse(`${s.fim}T00:00:00Z`)) ? s.fim : '';
        if (!fim) throw new Error('Informe o último dia da votação virtual');
        if (fim < d.data) throw new Error('O último dia da votação não pode ser antes do primeiro');
        if (fim > somarDias(d.data, MAX_DIAS_VIRTUAL)) throw new Error(`A votação virtual dura no máximo ${MAX_DIAS_VIRTUAL} dias`);
        d.fim = fim;
        d.local = '';
    } else {
        if (d.modo !== 'virtual' && !d.local) throw new Error('Informe o local da sessão');
        if (d.modo !== 'presencial' && !d.link) throw new Error('Informe o link ou a sala virtual da sessão');
        if (d.modo === 'virtual') d.local = '';
        if (d.modo === 'presencial') d.link = '';
    }
    if (!d.titulo) d.titulo = `${s.tipo === 'reuniao' ? 'Reunião' : 'Sessão'} ${d.carater === 'ordinaria' ? 'ordinária' : 'extraordinária'} de ${br(d.data)}`;
    return d;
}

export const br = (d: string) => d.split('-').reverse().join('/');

/** Primeira data em que a sessão pode acontecer se a pauta sair em `hoje`. */
export function dataMinimaDaSessao(hoje: string, regras: RegrasSessao, cal?: CalendarioOrgao): string {
    return regras.antecedencia > 0 ? calcularVencimento(hoje, regras.antecedencia, regras.contagem, cal) : hoje;
}

/** Explica por que a pauta não pode sair agora para a sessão de `data` (ou '' se pode). */
export function problemaDaAntecedencia(hoje: string, data: string, regras: RegrasSessao, cal?: CalendarioOrgao): string {
    if (data < hoje) return 'A data da sessão já passou';
    const minima = dataMinimaDaSessao(hoje, regras, cal);
    if (data >= minima) return '';
    return `O colegiado pede ${regras.antecedencia} ${regras.contagem === 'uteis' ? 'dias úteis' : 'dias'} entre a publicação da pauta e a sessão: publicada hoje, a sessão pode ser a partir de ${br(minima)}. `
        + 'Mude a data ou inclua o processo como extrapauta ou em mesa, com o motivo.';
}

type ProcParaPauta = { fase_atual?: unknown; fases?: unknown; acoes_feitas?: unknown; acoes_respostas?: unknown; status?: unknown };

/**
 * Índice da ação de julgamento colegiado pendente na fase atual (-1 quando não
 * há): é o que torna o processo apto para a pauta.
 */
export function julgamentoPendente(proc: ProcParaPauta): number {
    if (proc.status !== 'em_tramitacao') return -1;
    const fase = ((proc.fases || []) as Array<{ id: string; acoes_regras?: Array<{ pede?: string } | null> }>).find((f) => f.id === proc.fase_atual);
    if (!fase) return -1;
    const feitas = ((proc.acoes_feitas || {}) as Record<string, number[]>)[String(proc.fase_atual)] || [];
    const resp = respostasDaFase(proc as never);
    return (fase.acoes_regras || []).findIndex((r, i) => r?.pede === 'julgamento' && !feitas.includes(i) && acaoAtiva(fase as never, i, resp));
}

/**
 * Leitura do julgador (decisão do Flavio, 15/11/2026): quem compõe o
 * colegiado lê os autos enquanto o processo está pautado numa sessão dele e,
 * julgado, enquanto o processo segue em unidade do colegiado (o acórdão é
 * feito ali). Saiu do colegiado, a leitura acaba.
 */
export function leituraDeJulgador(
    proc: { sessao?: { orgao_id?: unknown } | null; ultima_sessao?: { orgao_id?: unknown } | null; vista?: { orgao_id?: unknown } | null; acordao?: { juntado_em?: unknown } | null; unidade_atual?: unknown; status?: unknown },
    compoe: string[], orgaoDaUnidade: (u: string) => unknown,
): boolean {
    if (!compoe.length || proc.status === 'excluido') return false;
    if (proc.sessao && compoe.includes(String(proc.sessao.orgao_id))) return true;
    // Com vista (S5): o julgamento está suspenso, mas o colegiado segue lendo.
    if (proc.vista && proc.status === 'em_tramitacao' && compoe.includes(String(proc.vista.orgao_id))) return true;
    // Julgado, lê até o acórdão ser juntado aos autos (S6), enquanto segue no colegiado.
    const ult = proc.ultima_sessao && !proc.acordao?.juntado_em ? String(proc.ultima_sessao.orgao_id) : '';
    return !!ult && proc.status === 'em_tramitacao' && compoe.includes(ult) && orgaoDaUnidade(String(proc.unidade_atual || '')) === ult;
}

/** Onde e como, no mesmo jeito das audiências: "em Sala 2", "por videoconferência (link)", "em Sala 2 e por videoconferência (link)". */
export function ondeSessao(s: Pick<DadosSessao, 'modo' | 'local' | 'link'> & Partial<Pick<DadosSessao, 'data' | 'fim'>>): string {
    if (s.modo === 'assincrona') return `em sessão virtual, com votação de ${br(s.data || '')} a ${br(s.fim || '')}`;
    if (s.modo === 'virtual') return `por videoconferência (${s.link})`;
    if (s.modo === 'hibrida') return `em ${s.local} e por videoconferência (${s.link})`;
    return `em ${s.local}`;
}

/** Texto da certidão de inclusão em pauta, nos autos e visto pelas partes. */
export function textoDaInclusao(s: DadosSessao, colegiado: string, item: Pick<ItemPauta, 'inclusao' | 'motivo'>): string {
    const como = item.inclusao === 'extrapauta' ? 'Incluído em extrapauta' : item.inclusao === 'mesa' ? 'Apresentado em mesa' : 'Incluído em pauta';
    const motivo = item.inclusao !== 'pauta' && item.motivo ? ` Motivo: ${item.motivo}.` : '';
    const quando = s.modo === 'assincrona' ? ondeSessao(s) : `em ${br(s.data)}, às ${s.hora}, ${ondeSessao(s)}`;
    return `${como} para julgamento na ${s.titulo}${colegiado ? ` do ${colegiado}` : ''}, ${quando}.${motivo}`;
}

// ---- S7: sessão virtual assíncrona, destaque, sustentação oral e preferência ----

export const MAX_DIAS_VIRTUAL = 30;

/** Na sessão virtual, vota-se do primeiro ao último dia; nas outras, a qualquer tempo depois de liberado o voto (como antes). */
export function votacaoAberta(s: Pick<DadosSessao, 'modo' | 'data' | 'fim'>, hoje: string): boolean {
    return s.modo !== 'assincrona' || (s.data <= hoje && hoje <= String(s.fim || ''));
}

/** A votação virtual terminou (o resultado se apura no dia seguinte ao último). */
export const virtualEncerrou = (s: Pick<DadosSessao, 'modo' | 'fim'>, hoje: string) => s.modo === 'assincrona' && !!s.fim && s.fim < hoje;

/**
 * O que a parte (ou quem a representa) pede para a sessão: sustentação oral
 * (CPC, art. 937), preferência no julgamento (art. 936), destaque da sessão
 * virtual para uma síncrona (Res. CNJ 591/2024, art. 8º) e esclarecimento de
 * fato durante a votação virtual (art. 9º, § 6º).
 */
export const TIPOS_PEDIDO = ['sustentacao', 'preferencia', 'destaque', 'esclarecimento'] as const;
export type TipoPedido = typeof TIPOS_PEDIDO[number];
export const NOME_PEDIDO: Record<TipoPedido, string> = {
    sustentacao: 'Sustentação oral', preferencia: 'Preferência', destaque: 'Destaque', esclarecimento: 'Esclarecimento de fato',
};
export const MAX_PEDIDO = 4000;

export interface PedidoSessao {
    processo_id: string;
    tipo: TipoPedido;
    uid: string;
    parte: string;
    texto: string;
    link: string;
    em: string;
    /** pedido; deferido; indeferido (com motivo). Sustentação, preferência e esclarecimento valem enquanto não indeferidos. */
    situacao: 'pedido' | 'deferido' | 'indeferido';
    decidido_por?: string;
    decidido_em?: string;
    motivo?: string;
}

/**
 * Por que a parte não pode fazer este pedido agora ('' quando pode). Na
 * sessão virtual, sustentação gravada e destaque vão até 48 horas antes do
 * início (dois dias antes); o esclarecimento, durante a votação. Na síncrona,
 * sustentação e preferência até o dia da sessão (CPC, art. 937, § 2º).
 */
export function problemaDoPedido(s: Pick<DadosSessao, 'modo' | 'data' | 'fim'>, tipo: TipoPedido, hoje: string): string {
    const virtual = s.modo === 'assincrona';
    if (tipo === 'destaque' && !virtual) return 'O destaque é só da sessão virtual';
    if (tipo === 'esclarecimento') {
        if (!virtual) return 'Na sessão síncrona, o esclarecimento de fato se pede ao presidente, durante a sessão';
        return votacaoAberta(s, hoje) ? '' : `O esclarecimento se envia durante a votação, de ${br(s.data)} a ${br(String(s.fim))}`;
    }
    const limite = virtual && tipo !== 'preferencia' ? somarDias(s.data, -2) : s.data;
    return hoje > limite ? `O prazo para este pedido terminou em ${br(limite)}` : '';
}

/** Pedido conferido (lança com a explicação). */
export function sanitizePedido(raw: unknown, s: Pick<DadosSessao, 'modo'>): Pick<PedidoSessao, 'tipo' | 'texto' | 'link'> {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const tipo = String(r.tipo || '') as TipoPedido;
    if (!TIPOS_PEDIDO.includes(tipo)) throw new Error('Escolha o que pede');
    const txt = String(r.texto ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_PEDIDO);
    const link = texto(r.link, 500);
    if (link && !/^https:\/\/[^\s]+$/i.test(link)) throw new Error('O link precisa começar com https://');
    if ((tipo === 'destaque' || tipo === 'esclarecimento') && txt.length < 10) throw new Error(tipo === 'destaque' ? 'Diga por que o processo deve ir à sessão síncrona (ao menos 10 letras)' : 'Escreva o esclarecimento (ao menos 10 letras)');
    // Na sessão virtual, a sustentação é gravada: o link do áudio ou vídeo (o sistema não guarda arquivos grandes).
    if (tipo === 'sustentacao' && s.modo === 'assincrona' && !link) throw new Error('Na sessão virtual, a sustentação é gravada: informe o link do áudio ou do vídeo');
    return { tipo, texto: txt, link: tipo === 'sustentacao' ? link : '' };
}

/** Certidão do destaque: o processo sai da sessão virtual e o julgamento recomeça numa síncrona. */
export function textoDoDestaque(s: Pick<DadosSessao, 'titulo' | 'data'>, quem: string, incluido?: Pick<DadosSessao, 'titulo' | 'data'> | null): string {
    return `Destacado da ${s.titulo}, de ${br(s.data)}, por ${quem}, para julgamento em sessão síncrona; o julgamento recomeça. `
        + (incluido ? `Incluído na ${incluido.titulo}, de ${br(incluido.data)}.` : 'Será incluído na próxima sessão síncrona do colegiado.');
}

/** Texto da certidão de retirada (ou de cancelamento da sessão). */
export function textoDaRetirada(s: DadosSessao, motivo: string, cancelada = false): string {
    return `${cancelada ? `A ${s.titulo}, de ${br(s.data)}, foi cancelada, e o processo saiu da pauta` : `Retirado da pauta da ${s.titulo}, de ${br(s.data)}`}. Motivo: ${motivo}.`;
}

const lista = (nomes: string[]) => (nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0] || '');

/** Certidão do pedido de vista (S5). */
export function textoDaVista(s: Pick<DadosSessao, 'titulo' | 'data'>, nomes: string[], prazo: string): string {
    return `Pedido de vista por ${lista(nomes)} na ${s.titulo}, de ${br(s.data)}. Julgamento suspenso; os autos devem ser devolvidos até ${br(prazo)}.`;
}

/** Certidão da devolução da vista; `incluido`: a sessão em que o processo entrou, se já há. */
export function textoDaDevolucao(nomes: string[], incluido?: Pick<DadosSessao, 'titulo' | 'data'> | null): string {
    return `Devolvidos os autos do pedido de vista de ${lista(nomes)}. ${incluido ? `O julgamento continua na ${incluido.titulo}, de ${br(incluido.data)}.` : 'O julgamento continua na próxima sessão do colegiado.'}`;
}

/** Certidão do adiamento. */
export function textoDoAdiamento(s: Pick<DadosSessao, 'titulo' | 'data'>, motivo: string): string {
    return `Adiado o julgamento na ${s.titulo}, de ${br(s.data)}, para a sessão seguinte. Motivo: ${motivo}.`;
}

/** Certidão da conversão em diligência. */
export function textoDaDiligencia(s: Pick<DadosSessao, 'titulo' | 'data'>, oQue: string): string {
    return `O colegiado converteu o julgamento em diligência na ${s.titulo}, de ${br(s.data)}: ${oQue.replace(/[.\s]+$/, '')}.`;
}

/** Reordena a pauta com a lista de ids (os que faltam ficam no fim, na ordem atual). */
export function reordenar(pauta: ItemPauta[], ids: string[]): ItemPauta[] {
    const pos = (id: string) => { const i = ids.indexOf(id); return i < 0 ? ids.length : i; };
    return [...pauta].sort((a, b) => pos(a.processo_id) - pos(b.processo_id) || a.ordem - b.ordem).map((x, i) => ({ ...x, ordem: i + 1 }));
}

// ---- Votação na sessão (S4): relator, vogais, proclamação ----

/** Como o vogal vota: acompanha o relator (com ou sem ressalva), diverge, ou se declara impedido ou suspeito. */
export const MODOS_VOTO = ['acompanha', 'ressalva', 'diverge', 'impedido', 'suspeito'] as const;
export type ModoVoto = typeof MODOS_VOTO[number];
export const MAX_RELATORIO = 50000;
export const MAX_NOTA_VOTO = 4000;

/**
 * `fundamentos` (S6): voto divergente fundamentado ou declaração de voto na
 * ressalva, que vai ao acórdão. `divergiu_em`: quando o membro passou a
 * divergir para esse resultado (decide quem conduz, se o relator ficar vencido).
 */
export interface VotoDoMembro { nome: string; funcao: 'presidente' | 'membro'; modo: ModoVoto; resultado: string; nota: string; em: string; fundamentos?: string; divergiu_em?: string }
/** `condutor` e `redator` (S6): o voto que conduz o resultado e quem redige o acórdão. */
export interface Proclamacao {
    resultado: string; texto: string; data: string; em: string; por_nome: string; votos: Voto[];
    condutor?: { uid: string; nome: string; relator: boolean };
}
/** secSessoes/{sessao}/votacoes/{processo}: o voto do relator (sigiloso até liberar) e os votos dos pares. */
export interface Votacao {
    processo_id: string;
    relator_uid: string;
    relator_nome: string;
    relatorio: string;
    resultado: string;
    fundamentos: string;
    liberado_em: string | null;
    votos: Record<string, VotoDoMembro>;
    proclamado: Proclamacao | null;
    /** S6: redator designado, rascunho do acórdão e a minuta enviada à unidade. */
    acordao?: { redator_uid: string; redator_nome: string; prazo: string; ementa: string; texto: string; enviado_em?: string; documento_id?: string };
}
export interface Votante { uid: string; nome: string; funcao: 'presidente' | 'membro' }

/**
 * Quem vota no dia: o presidente e os titulares. O suplente fica de fora
 * (vota quando convocado no lugar de um titular, numa etapa seguinte).
 */
export function votantes(composicao: MembroColegiado[], dia: string, nome: (uid: string) => string): Votante[] {
    return composicaoEm(composicao, dia).filter((m) => m.funcao !== 'suplente')
        .map((m) => ({ uid: m.uid, nome: nome(m.uid) || `Membro ${m.uid.slice(0, 6)}`, funcao: m.funcao === 'presidente' ? 'presidente' as const : 'membro' as const }));
}

/** Confere o voto do vogal contra os resultados do rito e o voto do relator. Lança com mensagem. */
export function sanitizeVoto(raw: unknown, resultados: string[], doRelator: string): Pick<VotoDoMembro, 'modo' | 'resultado' | 'nota' | 'fundamentos'> {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const modo = String(r.modo || '') as ModoVoto;
    if (!MODOS_VOTO.includes(modo)) throw new Error('Escolha como vota');
    const nota = texto(r.nota, MAX_NOTA_VOTO);
    // Voto divergente fundamentado ou declaração de voto (S6): texto longo, que vai ao acórdão.
    const fundamentos = String(r.fundamentos ?? '').replace(/\r\n/g, '\n').slice(0, MAX_RELATORIO).trim();
    const comFund = fundamentos ? { fundamentos } : {};
    if (modo === 'impedido' || modo === 'suspeito') return { modo, resultado: '', nota };
    if (modo === 'diverge') {
        const resultado = texto(r.resultado, 80);
        if (!resultados.includes(resultado)) throw new Error('Na divergência, escolha o resultado do seu voto');
        if (resultado === doRelator) throw new Error(`O relator votou por ${doRelator}: para esse resultado, acompanhe o relator`);
        return { modo, resultado, nota, ...comFund };
    }
    if (modo === 'ressalva' && nota.length < 5) throw new Error('Escreva a ressalva (ao menos 5 letras)');
    return modo === 'ressalva' ? { modo, resultado: doRelator, nota, ...comFund } : { modo, resultado: doRelator, nota: '' };
}

// ---- S6: voto condutor, votos vencidos e acórdão ----

/**
 * Quem conduz o resultado: o relator, se venceu; senão, quem primeiro divergiu
 * para o resultado proclamado (CPC, art. 941, por analogia). Sem divergente
 * (resultado por regra de desempate), fica o relator.
 */
export function votoCondutor(v: Pick<Votacao, 'relator_uid' | 'relator_nome' | 'resultado' | 'votos'>, resultado: string): { uid: string; nome: string; relator: boolean } {
    if (v.resultado === resultado) return { uid: v.relator_uid, nome: v.relator_nome, relator: true };
    const primeiro = Object.entries(v.votos || {})
        .filter(([, x]) => x.modo === 'diverge' && x.resultado === resultado)
        .sort((a, b) => (a[1].divergiu_em || a[1].em).localeCompare(b[1].divergiu_em || b[1].em))[0];
    return primeiro ? { uid: primeiro[0], nome: primeiro[1].nome, relator: false } : { uid: v.relator_uid, nome: v.relator_nome, relator: true };
}

export interface TextoDeVoto { nome: string; resultado: string; texto: string }

/** Votos vencidos (com o do relator, se vencido) e declarações de voto, para o acórdão. */
export function votosDoAcordao(v: Pick<Votacao, 'relator_uid' | 'relator_nome' | 'resultado' | 'fundamentos' | 'votos'>, resultado: string, condutorUid: string) {
    const vencidos: TextoDeVoto[] = [];
    const declaracoes: TextoDeVoto[] = [];
    if (v.resultado && v.resultado !== resultado) vencidos.push({ nome: v.relator_nome, resultado: v.resultado, texto: v.fundamentos });
    for (const [uid, x] of Object.entries(v.votos || {})) {
        if (uid === condutorUid || !x.resultado) continue;
        const t = x.fundamentos || x.nota || '';
        if (x.resultado !== resultado) vencidos.push({ nome: x.nome, resultado: x.resultado, texto: t });
        else if (t && (x.modo === 'ressalva' || x.modo === 'diverge')) declaracoes.push({ nome: x.nome, resultado: x.resultado, texto: t });
    }
    return { vencidos, declaracoes };
}

/** Dispositivo sugerido ao redator. */
export function modeloDoAcordao(numero: string, colegiado: string, s: Pick<DadosSessao, 'titulo' | 'data'>, textoProclamado: string, condutor: { nome: string; relator: boolean }): string {
    return `Vistos, relatados e discutidos os autos do processo ${numero}, acordam os membros do ${colegiado}, na ${s.titulo}, de ${br(s.data)}, no seguinte resultado: ${textoProclamado.replace(/[.\s]+$/, '')}, nos termos do voto ${condutor.relator ? 'do relator' : `condutor de ${condutor.nome}`}.`;
}

type NoDoc = { type: string; attrs?: Record<string, unknown>; content?: NoDoc[]; text?: string; marks?: Array<{ type: string }> };
const titulo = (t: string, level = 2): NoDoc => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text: t }] });
const paragrafos = (t: string): NoDoc[] => t.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)
    .map((x) => ({ type: 'paragraph', attrs: { textAlign: 'justify' }, content: x.split('\n').flatMap((l, i): NoDoc[] => [...(i ? [{ type: 'hardBreak' }] : []), ...(l ? [{ type: 'text', text: l }] : [])]) }));

/**
 * O acórdão como documento do editor (vai à unidade como minuta assinada pelo
 * redator; a unidade junta aos autos): ementa, acórdão, relatório, voto
 * condutor, votos vencidos e declarações de voto (CPC, art. 941, § 3º).
 */
export function documentoDoAcordao(a: {
    numero: string; colegiado: string; sessao: string; ementa: string; texto: string; relatorio: string; relator: string;
    condutor: { nome: string; relator: boolean }; fundamentosCondutor: string; vencidos: TextoDeVoto[]; declaracoes: TextoDeVoto[];
}): NoDoc {
    const voto = (x: TextoDeVoto, rotulo: string) => [titulo(`${rotulo} de ${x.nome} (${x.resultado})`, 3), ...(x.texto ? paragrafos(x.texto) : [{ type: 'paragraph', content: [{ type: 'text', text: 'Sem declaração escrita.' }] }])];
    return {
        type: 'doc',
        content: [
            { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'ACÓRDÃO' }] },
            { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: `Processo ${a.numero} · ${a.colegiado} · ${a.sessao}` }] },
            titulo('Ementa'), ...paragrafos(a.ementa),
            titulo('Acórdão'), ...paragrafos(a.texto),
            titulo(`Relatório (${a.relator})`), ...paragrafos(a.relatorio || 'Sem relatório escrito.'),
            titulo(a.condutor.relator ? `Voto do relator (${a.condutor.nome})` : `Voto condutor (${a.condutor.nome})`), ...paragrafos(a.fundamentosCondutor || 'Sem fundamentos escritos.'),
            ...(a.vencidos.length ? [titulo('Votos vencidos'), ...a.vencidos.flatMap((x) => voto(x, 'Voto vencido'))] : []),
            ...(a.declaracoes.length ? [titulo('Declarações de voto'), ...a.declaracoes.flatMap((x) => voto(x, 'Declaração'))] : []),
        ],
    };
}

/**
 * Votos no formato do registro do julgamento (shared/julgamento.ts): o relator
 * primeiro, depois quem vota no dia; quem não votou fica ausente.
 */
export function votosDaSessao(v: Pick<Votacao, 'relator_uid' | 'relator_nome' | 'resultado' | 'votos'>, membros: Votante[]): Voto[] {
    const out: Voto[] = [{ nome: v.relator_nome, funcao: 'relator', voto: v.resultado }];
    for (const m of membros) {
        if (m.uid === v.relator_uid) continue;
        const x = v.votos[m.uid];
        out.push({ nome: x?.nome || m.nome, funcao: m.funcao, voto: !x ? 'ausente' : x.modo === 'impedido' || x.modo === 'suspeito' ? x.modo : x.resultado });
    }
    return out;
}

/** Placar dos votos já dados (sem quórum nem desempate): para acompanhar ao vivo. */
export function placarParcial(resultados: string[], votos: Voto[]): Array<[string, number]> {
    return resultados.map((o) => [o, votos.filter((v) => v.voto === o).length] as [string, number]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
}

// ---- S8: presença, ata da sessão e assinaturas ----

export const MAX_ATA = 50000;

/**
 * Quem esteve na sessão, para a ata. Na síncrona, a presença que a secretaria
 * marca (`registrada`); sem marcação, a composição do dia. Na virtual, quem votou.
 */
export interface PresencaDaAta { presidente: string; presentes: string[]; ausentes: string[]; registrada: boolean }

export interface ItemDaAta {
    numero: string; assunto: string; situacao: ItemPauta['situacao']; motivo: string; relator: string;
    vista?: ItemPauta['vista']; proclamado?: string; redator?: string; sustentacoes?: string[];
}

export interface AssinaturaAta { uid: string; nome: string; papel: 'presidente' | 'secretaria'; em: string; sha256: string }
/** secSessoes/{s}.ata: gerada ao encerrar, ajustável pela secretaria até a primeira assinatura. */
export interface AtaSessao { texto: string; gerada_em: string; sha256: string; assinaturas: AssinaturaAta[]; editada_por?: string }

export const PAPEIS_ATA = ['presidente', 'secretaria'] as const;
/** Assinada pelo presidente e pela secretaria. */
export const ataAssinada = (a?: Pick<AtaSessao, 'assinaturas'> | null) => !!a && PAPEIS_ATA.every((p) => (a.assinaturas || []).some((x) => x.papel === p));

const ponto = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

/** O que aconteceu com o processo na sessão, numa frase da ata. */
export function desfechoNaAta(x: ItemDaAta): string {
    const m = x.motivo ? `: ${x.motivo.replace(/[.\s]+$/, '')}` : '';
    if (x.situacao === 'retirado') return `Retirado de pauta${m}.`;
    if (x.situacao === 'adiado') return `Adiado${m}.`;
    if (x.situacao === 'diligencia') return `Convertido em diligência${m}.`;
    if (x.situacao === 'destacado') return `Destacado para julgamento em sessão síncrona${x.motivo ? ` (${x.motivo.replace(/[.\s]+$/, '')})` : ''}.`;
    if (x.situacao === 'vista') {
        const v = x.vista || { nomes: [], prazo: '' };
        return `Pedido de vista de ${lista(v.nomes)}${v.prazo ? `, com prazo até ${br(v.prazo)}` : ''}; julgamento suspenso${v.devolvida ? ' (vista já devolvida)' : ''}.`;
    }
    return x.proclamado ? `${ponto(x.proclamado)}${x.redator ? ` Redator do acórdão: ${x.redator}.` : ''}` : 'Não julgado nesta sessão.';
}

/** Texto da ata, gerado pelo sistema ao encerrar a sessão (CPC, art. 941, § 2º, e regimentos dos colegiados). */
export function textoDaAta(s: DadosSessao, colegiado: string, p: PresencaDaAta, itens: ItemDaAta[], encerradaEm: string): string {
    const car = s.carater === 'extraordinaria' ? 'extraordinária' : 'ordinária';
    const pres = p.presidente ? `, sob a presidência de ${p.presidente}` : '';
    const linhas = [`ATA DA ${s.titulo.toUpperCase()} DO ${colegiado.toUpperCase()}`];
    if (s.modo === 'assincrona') {
        linhas.push(`Sessão ${car} virtual do ${colegiado}, com votação de ${br(s.data)} a ${br(s.fim || s.data)}${pres}. ${p.presentes.length ? `Votaram ${lista(p.presentes)}.` : 'Nenhum membro votou pelo sistema.'}`);
    } else {
        const quem = p.registrada
            ? `${p.presentes.length ? `, presentes ${lista(p.presentes)}` : ''}${p.ausentes.length ? `; ${p.ausentes.length > 1 ? 'ausentes' : 'ausente'} ${lista(p.ausentes)}` : ''}`
            : `${p.presentes.length ? `, com a composição do dia: ${lista(p.presentes)}` : ''} (a presença não foi registrada no sistema)`;
        linhas.push(`Em ${br(s.data)}, às ${s.hora}, ${ondeSessao(s)}, reuniu-se o ${colegiado} em sessão ${car}${pres}${quem}.`);
    }
    linhas.push(itens.length ? 'Ordem do dia:' : 'Não houve processos na pauta.');
    itens.forEach((x, i) => {
        const relator = x.relator && !x.proclamado ? `, relator ${x.relator}` : '';
        const sust = x.sustentacoes?.length ? ` Sustentação oral por ${lista(x.sustentacoes)}.` : '';
        linhas.push(`${i + 1}. Processo ${x.numero}${x.assunto ? ` (${x.assunto})` : ''}${relator}.${sust} ${desfechoNaAta(x)}`);
    });
    linhas.push(`Encerrada a sessão em ${br(encerradaEm)}. Esta ata, lavrada pela secretaria do colegiado, vai assinada pelo presidente e pela secretaria.`);
    return linhas.join('\n\n');
}

// ---------------------------------------------------------------------------
// S15: relatório do colegiado (sessões, julgados, vistas e acórdãos no período).

export const MAX_DIAS_RELATORIO = 366;
export interface SessaoNoRelatorio { id: string; titulo: string; data: string; tipo: string; situacao: SituacaoSessao; pauta: ItemPauta[] }
export interface VotacaoNoRelatorio { sessao_id: string; processo_id: string; relator_nome: string; proclamado: Pick<Proclamacao, 'resultado' | 'data'> | null }
export interface AcordaoNoRelatorio { sessao_id: string; processo_id: string; prazo: string; pendente: boolean; juntado_em?: string | null; redator_nome: string }

const diasCorridos = (de: string, ate: string) => Math.round((Date.parse(`${ate.slice(0, 10)}T12:00:00Z`) - Date.parse(`${de.slice(0, 10)}T12:00:00Z`)) / 86400000);
const contar = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/**
 * Números do colegiado no período: sessões realizadas, canceladas e por
 * realizar; julgados por resultado e por relator; o que saiu da pauta sem
 * julgamento; vistas em aberto (atrasadas quando o prazo passou); e acórdãos
 * (tempo médio da proclamação à juntada, quantos no prazo, quantos pendentes).
 */
export function relatorioDoColegiado(sessoes: SessaoNoRelatorio[], votacoes: VotacaoNoRelatorio[], acordaos: AcordaoNoRelatorio[], hoje: string) {
    const porId = new Map(sessoes.map((s) => [s.id, s]));
    const validas = sessoes.filter((s) => s.situacao !== 'cancelada' && s.situacao !== 'rascunho');
    const itens = validas.flatMap((s) => (s.pauta || []).map((x) => ({ s, x })));
    const conta = (sit: ItemPauta['situacao']) => itens.filter(({ x }) => x.situacao === sit).length;
    const numero = (sid: string, pid: string) => porId.get(sid)?.pauta?.find((x) => x.processo_id === pid)?.numero || '';
    const julgados = votacoes.filter((v) => v.proclamado && validas.some((s) => s.id === v.sessao_id));
    const acordaoDe = new Map(acordaos.map((a) => [`${a.sessao_id}/${a.processo_id}`, a]));
    const linhas = julgados.map((v) => {
        const s = porId.get(v.sessao_id)!;
        const a = acordaoDe.get(`${v.sessao_id}/${v.processo_id}`);
        const juntado = a?.juntado_em ? a.juntado_em.slice(0, 10) : '';
        return {
            sessao: s.titulo, data: s.data, processo_id: v.processo_id, numero: numero(v.sessao_id, v.processo_id),
            relator: v.relator_nome || '', resultado: v.proclamado!.resultado, proclamado_em: v.proclamado!.data,
            redator: a?.redator_nome || '', prazo_acordao: a?.prazo || '', juntado_em: juntado,
            dias_ate_acordao: juntado ? Math.max(0, diasCorridos(v.proclamado!.data, juntado)) : null,
            acordao_pendente: !!a?.pendente,
        };
    }).sort((a, b) => a.data.localeCompare(b.data) || a.numero.localeCompare(b.numero));
    const comAcordao = linhas.filter((l) => l.dias_ate_acordao !== null);
    const pendentes = linhas.filter((l) => l.acordao_pendente)
        .map((l) => ({ numero: l.numero, processo_id: l.processo_id, redator: l.redator, prazo: l.prazo_acordao, atrasado: !!l.prazo_acordao && l.prazo_acordao < hoje }));
    const vistas = itens.filter(({ x }) => x.situacao === 'vista' && !x.vista?.devolvida)
        .map(({ s, x }) => ({ numero: x.numero, processo_id: x.processo_id, sessao: s.titulo, nomes: x.vista?.nomes || [], prazo: x.vista?.prazo || '', atrasada: !!x.vista?.prazo && x.vista.prazo < hoje }))
        .sort((a, b) => a.prazo.localeCompare(b.prazo));
    return {
        sessoes: {
            realizadas: sessoes.filter((s) => s.situacao === 'encerrada').length,
            canceladas: sessoes.filter((s) => s.situacao === 'cancelada').length,
            por_realizar: sessoes.filter((s) => s.situacao === 'publicada').length,
            reunioes: validas.filter((s) => s.tipo === 'reuniao').length,
        },
        julgados: { total: linhas.length, por_resultado: contar(linhas.map((l) => l.resultado)), por_relator: contar(linhas.map((l) => l.relator || 'Sem relator')) },
        pauta: { pautados: itens.length, retirados: conta('retirado'), adiados: conta('adiado'), diligencias: conta('diligencia'), destacados: conta('destacado'), vistas: conta('vista') },
        vistas: { abertas: vistas.length, atrasadas: vistas.filter((v) => v.atrasada).length, lista: vistas },
        acordaos: {
            juntados: comAcordao.length,
            media_dias: comAcordao.length ? Math.round((comAcordao.reduce((t, l) => t + l.dias_ate_acordao!, 0) / comAcordao.length) * 10) / 10 : null,
            no_prazo: comAcordao.filter((l) => !l.prazo_acordao || l.juntado_em <= l.prazo_acordao).length,
            pendentes: pendentes.length, atrasados: pendentes.filter((p) => p.atrasado).length, lista_pendentes: pendentes,
        },
        linhas,
    };
}
