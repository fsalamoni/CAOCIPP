import { texto } from './secretaria';
import type { DadosSessao, PresencaDaAta } from './sessoes';
import { br, ondeSessao } from './sessoes';

/**
 * Reunião deliberativa do colegiado (S9): uma sessão (`tipo: 'reuniao'`) cuja
 * pauta são assuntos, não processos. Cada assunto se vota de forma nominal,
 * simbólica ou secreta (ou é só apresentado, sem votação), com a maioria que
 * ele exige; o quórum e o desempate vêm das regras do colegiado. Regras puras,
 * sem banco (a gravação está em secretaria/reunioes.ts).
 */

export const TIPOS_VOTACAO = ['nominal', 'simbolica', 'secreta', 'sem_votacao'] as const;
export type TipoVotacao = typeof TIPOS_VOTACAO[number];
export const MAIORIAS = ['simples', 'absoluta', 'dois_tercos'] as const;
export type Maioria = typeof MAIORIAS[number];
export const QUORUNS = ['maioria', 'um_terco', 'dois_tercos', 'livre'] as const;
export type Quorum = typeof QUORUNS[number];
export const VOTOS = ['sim', 'nao', 'abstencao'] as const;
export type VotoReuniao = typeof VOTOS[number];

/** pauta; em_votacao (síncrona); empate (espera o voto de qualidade); deliberado; retirado; adiado. */
export type SituacaoAssunto = 'pauta' | 'em_votacao' | 'empate' | 'deliberado' | 'retirado' | 'adiado';
export interface Fala { uid: string; nome: string; em: string }
export interface Placar { sim: number; nao: number; abstencao: number }
export interface ResultadoAssunto extends Placar { aprovado: boolean | null; texto: string; sem_quorum?: boolean; desempate?: 'sim' | 'nao' }

export interface AssuntoReuniao {
    id: string; ordem: number; titulo: string; descricao: string; proponente: string;
    votacao: TipoVotacao; maioria: Maioria;
    inclusao: 'pauta' | 'extrapauta'; motivo: string; situacao: SituacaoAssunto; incluido_em: string;
    impedidos: Array<{ uid: string; nome: string }>;
    inscritos: Fala[]; com_a_palavra?: Fala | null; falaram: string[];
    resultado?: ResultadoAssunto | null; encaminhamento: string;
    /** Votos nominais, para a ata (nome e voto), gravados na apuração. */
    nominais?: Array<{ nome: string; voto: VotoReuniao }>;
    /** Assunto adiado de reunião anterior, trazido para esta. */
    vem_de?: { sessao_id: string; titulo: string } | null;
    /** Já levado para outra reunião (não aparece de novo entre os pendentes). */
    levado_para?: string;
}

/** Regras do colegiado para as reuniões (dentro de `Orgao.pauta`); ausente = maioria e voto de qualidade do presidente. */
export interface RegrasReuniao { quorum: Quorum; desempate: 'presidente' | 'rejeita' }
export function regrasReuniao(pauta: { quorum?: unknown; desempate?: unknown } | undefined): RegrasReuniao {
    return {
        quorum: QUORUNS.includes(pauta?.quorum as Quorum) ? (pauta!.quorum as Quorum) : 'maioria',
        desempate: pauta?.desempate === 'rejeita' ? 'rejeita' : 'presidente',
    };
}

export const MAX_ASSUNTOS = 60;
export const MAX_DESCRICAO = 5000;
export const MAX_ENCAMINHAMENTO = 5000;
export const NOME_VOTACAO: Record<TipoVotacao, string> = { nominal: 'Votação nominal', simbolica: 'Votação simbólica', secreta: 'Votação secreta', sem_votacao: 'Sem votação (informe)' };
export const NOME_MAIORIA: Record<Maioria, string> = { simples: 'maioria simples', absoluta: 'maioria absoluta', dois_tercos: 'dois terços' };

/** Campos do assunto que a secretaria escreve. Na reunião virtual, só voto pelo sistema (nominal ou secreto). */
export function sanitizeAssunto(raw: unknown, modo: DadosSessao['modo']): Pick<AssuntoReuniao, 'titulo' | 'descricao' | 'proponente' | 'votacao' | 'maioria'> {
    const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const titulo = texto(a.titulo, 200);
    if (titulo.length < 3) throw new Error('Dê um título ao assunto');
    const votacao = TIPOS_VOTACAO.includes(a.votacao as TipoVotacao) ? (a.votacao as TipoVotacao) : 'nominal';
    if (modo === 'assincrona' && votacao === 'simbolica') throw new Error('Na reunião virtual cada membro vota pelo sistema: escolha votação nominal ou secreta');
    return {
        titulo, descricao: texto(a.descricao, MAX_DESCRICAO), proponente: texto(a.proponente, 120), votacao,
        maioria: MAIORIAS.includes(a.maioria as Maioria) ? (a.maioria as Maioria) : 'simples',
    };
}

/** Mínimo de membros (presentes, ou que votaram) para deliberar. `n`: quem pode votar o assunto. */
export function quorumMinimo(n: number, q: Quorum): number {
    if (n <= 0) return 1;
    if (q === 'livre') return 1;
    if (q === 'um_terco') return Math.ceil(n / 3);
    if (q === 'dois_tercos') return Math.ceil((2 * n) / 3);
    return Math.floor(n / 2) + 1;
}

/** Votos a favor que a maioria exige (absoluta e dois terços contam sobre quem pode votar). */
export function votosNecessarios(m: Maioria, n: number): number {
    if (m === 'absoluta') return Math.floor(n / 2) + 1;
    if (m === 'dois_tercos') return Math.ceil((2 * n) / 3);
    return 0;
}

const qt = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
export function textoPlacar(p: Placar): string {
    const partes = [qt(p.sim, 'voto a favor', 'votos a favor'), qt(p.nao, 'contra', 'contra')];
    if (p.abstencao) partes.push(qt(p.abstencao, 'abstenção', 'abstenções'));
    return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/**
 * Resultado do assunto pelo placar. `n`: quem pode votar (composição que vota
 * no dia, menos os impedidos). Sem quórum, o assunto não se decide; empate na
 * maioria simples espera o voto de qualidade do presidente (ou rejeita, se o
 * colegiado não o prevê).
 */
export function apurar(p: Placar, maioria: Maioria, n: number, regras: RegrasReuniao): ResultadoAssunto {
    const total = p.sim + p.nao + p.abstencao;
    const min = quorumMinimo(n, regras.quorum);
    if (total < min) {
        return { ...p, aprovado: null, sem_quorum: true, texto: `Sem quórum para deliberar: ${qt(total, 'membro votou', 'membros votaram')} de ${n} (mínimo de ${min}).` };
    }
    const placar = textoPlacar(p);
    if (maioria === 'simples') {
        if (p.sim > 0 && p.nao === 0 && p.abstencao === 0) return { ...p, aprovado: true, texto: `Aprovado por unanimidade (${qt(p.sim, 'voto', 'votos')}).` };
        if (p.sim > p.nao) return { ...p, aprovado: true, texto: `Aprovado por maioria simples: ${placar}.` };
        if (p.sim < p.nao || p.sim === 0) return { ...p, aprovado: false, texto: `Rejeitado: ${placar}.` };
        if (regras.desempate === 'presidente') return { ...p, aprovado: null, texto: `Empate de ${p.sim} a ${p.nao}: cabe o voto de qualidade do presidente.` };
        return { ...p, aprovado: false, texto: `Rejeitado por empate (${p.sim} a ${p.nao}), sem voto de qualidade: fica como está.` };
    }
    const precisa = votosNecessarios(maioria, n);
    const minimo = `mínimo de ${precisa} de ${n}`;
    return p.sim >= precisa
        ? { ...p, aprovado: true, texto: `Aprovado por ${NOME_MAIORIA[maioria]} (${minimo}): ${placar}.` }
        : { ...p, aprovado: false, texto: `Rejeitado: não alcançou ${maioria === 'absoluta' ? 'a maioria absoluta' : 'os dois terços'} (${minimo}); ${placar}.` };
}

/** Empate desfeito pelo voto de qualidade do presidente. */
export function desempatar(r: ResultadoAssunto, voto: 'sim' | 'nao', presidente: string): ResultadoAssunto {
    return { ...r, aprovado: voto === 'sim', desempate: voto, texto: `Empate de ${r.sim} a ${r.nao}, desfeito pelo voto de qualidade de ${presidente}: ${voto === 'sim' ? 'aprovado' : 'rejeitado'}.` };
}

/** Placar dos votos nominais. */
export function placarDe(votos: Record<string, { voto: VotoReuniao }>): Placar {
    const vs = Object.values(votos || {});
    return { sim: vs.filter((v) => v.voto === 'sim').length, nao: vs.filter((v) => v.voto === 'nao').length, abstencao: vs.filter((v) => v.voto === 'abstencao').length };
}

/** Na reunião, é "o processo em julgamento": quem pode chamar e votar o assunto agora. */
export const votavel = (a: Pick<AssuntoReuniao, 'votacao' | 'situacao'>) => a.votacao !== 'sem_votacao' && (a.situacao === 'pauta' || a.situacao === 'em_votacao');

const lista = (nomes: string[]) => (nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0] || '');
const ponto = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
const semPonto = (t: string) => t.replace(/[.\s]+$/, '');

/** O que aconteceu com o assunto, para a ata. */
export function desfechoDoAssunto(a: AssuntoReuniao): string {
    const m = a.motivo ? `: ${semPonto(a.motivo)}` : '';
    if (a.situacao === 'retirado') return `Retirado de pauta${m}.`;
    if (a.situacao === 'adiado') return `Adiado${m}.`;
    if (a.situacao !== 'deliberado') return 'Não deliberado nesta reunião.';
    if (a.votacao === 'sem_votacao') return 'Assunto apresentado, sem votação.';
    const r = a.resultado;
    if (!r) return 'Não deliberado nesta reunião.';
    const grupos = a.votacao === 'nominal' ? ([['sim', 'a favor'], ['nao', 'contra'], ['abstencao', 'abstenção']] as const)
        .map(([v, rot]) => [rot, (a.nominais || []).filter((x) => x.voto === v).map((x) => x.nome)] as const)
        .filter(([, ns]) => ns.length).map(([rot, ns]) => `${rot}: ${lista(ns)}`) : [];
    const nominais = grupos.length ? ` Votaram ${grupos.join('; ')}.` : '';
    const forma = a.votacao === 'secreta' ? ' Votação secreta.' : a.votacao === 'simbolica' ? ' Votação simbólica.' : '';
    return `${ponto(r.texto)}${forma}${nominais}`;
}

/** Texto da ata da reunião, gerado ao encerrar (presença, cada assunto, falas, votos e encaminhamentos). */
export function textoDaAtaReuniao(s: DadosSessao, colegiado: string, p: PresencaDaAta, assuntos: AssuntoReuniao[], encerradaEm: string): string {
    const car = s.carater === 'extraordinaria' ? 'extraordinária' : 'ordinária';
    const pres = p.presidente ? `, sob a presidência de ${p.presidente}` : '';
    const linhas = [`ATA DA ${s.titulo.toUpperCase()} DO ${colegiado.toUpperCase()}`];
    if (s.modo === 'assincrona') {
        linhas.push(`Reunião ${car} virtual do ${colegiado}, com votação de ${br(s.data)} a ${br(s.fim || s.data)}${pres}. ${p.presentes.length ? `Votaram ${lista(p.presentes)}.` : 'Nenhum membro votou pelo sistema.'}`);
    } else {
        const quem = p.registrada
            ? `${p.presentes.length ? `, presentes ${lista(p.presentes)}` : ''}${p.ausentes.length ? `; ${p.ausentes.length > 1 ? 'ausentes' : 'ausente'} ${lista(p.ausentes)}` : ''}`
            : `${p.presentes.length ? `, com a composição do dia: ${lista(p.presentes)}` : ''} (a presença não foi registrada no sistema)`;
        linhas.push(`Em ${br(s.data)}, às ${s.hora}, ${ondeSessao(s)}, reuniu-se o ${colegiado} em reunião ${car}${pres}${quem}.`);
    }
    linhas.push(assuntos.length ? 'Pauta:' : 'Não houve assuntos na pauta.');
    assuntos.forEach((a, i) => {
        const partes = [`${i + 1}. ${semPonto(a.titulo)}${a.proponente ? ` (proposto por ${a.proponente})` : ''}.`];
        if (a.inclusao === 'extrapauta' && a.motivo && a.situacao !== 'retirado' && a.situacao !== 'adiado') partes.push(`Incluído depois da convocação: ${ponto(a.motivo)}`);
        if (a.vem_de) partes.push(`Vindo da ${a.vem_de.titulo}.`);
        if (a.falaram?.length) partes.push(`Fizeram uso da palavra ${lista(a.falaram)}.`);
        if (a.impedidos?.length) partes.push(`${a.impedidos.length > 1 ? 'Declararam' : 'Declarou'} impedimento ${lista(a.impedidos.map((x) => x.nome))}.`);
        partes.push(desfechoDoAssunto(a));
        if (a.encaminhamento) partes.push(`Encaminhamento: ${ponto(a.encaminhamento)}`);
        linhas.push(partes.join(' '));
    });
    linhas.push(`Encerrada a reunião em ${br(encerradaEm)}. Esta ata, lavrada pela secretaria do colegiado, vai assinada pelo presidente e pela secretaria.`);
    return linhas.join('\n\n');
}

/** Reordena os assuntos pela lista de ids (os que faltarem vão ao fim, na ordem atual). */
export function reordenarAssuntos(as: AssuntoReuniao[], ids: string[]): AssuntoReuniao[] {
    const atual = [...as].sort((a, b) => a.ordem - b.ordem);
    const pos = new Map(ids.map((id, i) => [id, i]));
    return [...atual].sort((a, b) => (pos.get(a.id) ?? 1e6 + a.ordem) - (pos.get(b.id) ?? 1e6 + b.ordem)).map((a, i) => ({ ...a, ordem: i + 1 }));
}
