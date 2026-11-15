/**
 * Sala da audiência (S10): no dia da audiência designada pelo rito, quem tem o
 * processo abre a sala, marca a presença dos convocados (partes, quem as
 * representa e os participantes da designação), registra o que acontece em
 * ordem (manifestações, depoimentos, acordo, deliberações) e encerra. O
 * encerramento monta o termo de audiência, que vai à unidade como minuta
 * assinada por quem conduziu; a unidade junta aos autos pelo caminho comum.
 *
 * Lógica pura; o servidor grava em `secProcessos/{id}/salas/{audienciaId}`.
 */
import { texto } from './secretaria';
import { nomeDoPolo } from './camposProcesso';
import { Audiencia, QUALIDADES, nomeDaAudiencia, textoDaAudiencia } from './audiencias';

export const TIPOS_OCORRENCIA: Record<string, string> = {
    manifestacao: 'Manifestação', depoimento: 'Depoimento', requerimento: 'Requerimento', proposta: 'Proposta de acordo',
    acordo: 'Acordo', sem_acordo: 'Sem acordo', deliberacao: 'Deliberação', documento: 'Documento apresentado',
    suspensao: 'Suspensão', retomada: 'Retomada', registro: 'Registro',
};
/** Tipos que dizem de quem é a fala. */
export const COM_QUEM = ['manifestacao', 'depoimento', 'requerimento', 'proposta'];
/** Tipos em que o texto é opcional (o tipo já diz o que houve). */
const TEXTO_OPCIONAL = ['sem_acordo', 'suspensao', 'retomada'];
export const MAX_OCORRENCIAS = 200;
export const MAX_TEXTO_OCORRENCIA = 20000;
export const MAX_OUTROS = 20;

export interface Convocado { chave: string; nome: string; qualidade: string; representa?: string }
export interface OutroPresente { nome: string; qualidade: string }
export interface Ocorrencia { id: string; tipo: string; texto: string; quem?: string; em: string; por: string }
export interface SalaAudiencia {
    audiencia_id: string; aberta_em: string; aberta_por: { uid: string; nome: string };
    presencas: Record<string, boolean>; outros: OutroPresente[]; ocorrencias: Ocorrencia[];
    encerrada_em?: string; realizada?: boolean; motivo?: string; termo_documento_id?: string;
}
interface ParteLike { nome: string; polo: string; retirada?: unknown; representantes?: { nome: string }[] }

/** Quem foi convocado: partes ativas, quem as representa e os participantes da designação. */
export function convocadosDaAudiencia(partes: ParteLike[] | undefined, nomesPolos: unknown, a: Pick<Audiencia, 'participantes'>): Convocado[] {
    const out: Convocado[] = [];
    (partes || []).forEach((x, i) => {
        if (x.retirada || !x.nome) return;
        const polo = nomeDoPolo(nomesPolos, x.polo);
        out.push({ chave: `p${i}`, nome: x.nome, qualidade: polo.charAt(0).toUpperCase() + polo.slice(1) });
        (x.representantes || []).forEach((r, j) => { if (r.nome) out.push({ chave: `p${i}r${j}`, nome: r.nome, qualidade: 'representante', representa: x.nome }); });
    });
    (a.participantes || []).forEach((x, k) => out.push({ chave: `x${k}`, nome: x.nome, qualidade: QUALIDADES[x.qualidade] || 'participante' }));
    return out;
}

/** Presença: só das chaves dos convocados. */
export function sanitizePresencas(raw: unknown, convocados: Convocado[]): Record<string, boolean> {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return Object.fromEntries(convocados.map((c) => [c.chave, r[c.chave] === true]));
}

/** Outros presentes que não foram convocados (membro do Ministério Público, defensor nomeado, intérprete). */
export function sanitizeOutros(raw: unknown): OutroPresente[] {
    const lista = Array.isArray(raw) ? raw : [];
    if (lista.length > MAX_OUTROS) throw new Error(`Até ${MAX_OUTROS} outros presentes`);
    return lista.map((x) => {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        return { nome: texto(o.nome, 120), qualidade: texto(o.qualidade, 60) };
    }).filter((x) => x.nome);
}

/** Confere a ocorrência. `presentes`: nomes de quem pode falar (presentes e quem conduz). Lança com mensagem. */
export function sanitizeOcorrencia(raw: unknown, presentes: string[]): Pick<Ocorrencia, 'tipo' | 'texto' | 'quem'> {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const tipo = String(r.tipo || 'registro');
    if (!TIPOS_OCORRENCIA[tipo]) throw new Error('Tipo de registro desconhecido');
    const t = String(r.texto ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAX_TEXTO_OCORRENCIA);
    if (!TEXTO_OPCIONAL.includes(tipo) && t.length < 3) throw new Error('Escreva o que houve (ao menos 3 letras)');
    if (!COM_QUEM.includes(tipo)) return { tipo, texto: t };
    const quem = texto(r.quem, 120);
    if (!quem) throw new Error(`Diga de quem é ${tipo === 'depoimento' ? 'o depoimento' : tipo === 'proposta' ? 'a proposta' : `a ${TIPOS_OCORRENCIA[tipo].toLowerCase()}`}`);
    if (!presentes.includes(quem)) throw new Error(`${quem} não está entre os presentes: marque a presença antes`);
    return { tipo, texto: t, quem };
}

/** Hora de Brasília (hh:mm) de um ISO. */
export const horaBrasil = (iso: string) => new Date(new Date(iso).getTime() - 108e5).toISOString().slice(11, 16);
const lista = (n: string[]) => (n.length > 1 ? `${n.slice(0, -1).join('; ')} e ${n[n.length - 1]}` : n[0] || '');
const comPonto = (t: string) => (/[.!?:]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
const rotuloConvocado = (c: Convocado) => `${c.nome} (${c.representa ? `representante de ${c.representa}` : c.qualidade})`;

/** Linha da ocorrência no termo. */
export function linhaDaOcorrencia(o: Pick<Ocorrencia, 'tipo' | 'texto' | 'quem' | 'em'>): string {
    const nome = TIPOS_OCORRENCIA[o.tipo] || 'Registro';
    if (o.tipo === 'suspensao' || o.tipo === 'retomada') return `${o.tipo === 'suspensao' ? 'Suspensa' : 'Retomada'} a audiência às ${horaBrasil(o.em)}${o.texto ? `: ${comPonto(o.texto)}` : '.'}`;
    if (o.tipo === 'sem_acordo') return `Não houve acordo${o.texto ? `: ${comPonto(o.texto)}` : '.'}`;
    const de = o.quem ? ` de ${o.quem}` : '';
    return `${nome}${de}: ${comPonto(o.texto)}`;
}

/** Texto do termo de audiência (parágrafos separados por linha em branco). */
export function textoDoTermo(d: {
    numero: string; unidade: string; audiencia: Audiencia; condutor: string; lavrou: string; convocados: Convocado[]; sala: Pick<SalaAudiencia, 'presencas' | 'outros' | 'ocorrencias' | 'aberta_em'>;
    realizada: boolean; motivo?: string; encerrada_em: string;
}): string {
    const eu = d.lavrou === d.condutor ? `Eu, ${d.condutor}, conduzi a audiência e lavrei este termo.` : `Eu, ${d.lavrou}, lavrei este termo.`;
    const nome = nomeDaAudiencia(d.audiencia);
    const quando = textoDaAudiencia(d.audiencia, false);
    const presentes = d.convocados.filter((c) => d.sala.presencas[c.chave]).map(rotuloConvocado);
    const ausentes = d.convocados.filter((c) => !d.sala.presencas[c.chave]).map(rotuloConvocado);
    const outros = (d.sala.outros || []).map((x) => `${x.nome}${x.qualidade ? ` (${x.qualidade})` : ''}`);
    const linhas = [`Processo ${d.numero} · ${d.unidade}`];
    if (d.realizada) linhas.push(`${nome} designada para ${quando}. Aberta às ${horaBrasil(d.sala.aberta_em)}, sob a condução de ${d.condutor}.`);
    else linhas.push(`${nome} designada para ${quando}. A audiência não se realizou${d.motivo ? `: ${comPonto(d.motivo)}` : '.'}`);
    linhas.push(`Presentes: ${presentes.length ? lista(presentes) : 'nenhum dos convocados'}.${ausentes.length ? ` Ausentes: ${lista(ausentes)}.` : ''}${outros.length ? ` Também presentes: ${lista(outros)}.` : ''}`);
    if (d.realizada) {
        const oc = d.sala.ocorrencias || [];
        if (oc.length) linhas.push(...oc.map((o, i) => `${i + 1}. ${linhaDaOcorrencia(o)}`));
        else linhas.push('Nada foi registrado durante a audiência.');
        linhas.push(`Nada mais havendo, encerrou-se a audiência às ${horaBrasil(d.encerrada_em)}. ${eu}`);
    } else {
        linhas.push(`Eu, ${d.lavrou}, lavrei este termo às ${horaBrasil(d.encerrada_em)}.`);
    }
    return linhas.join('\n\n');
}

type NoDoc = { type: string; attrs?: Record<string, unknown>; content?: NoDoc[]; text?: string };
/** O termo como documento do editor: título centralizado e os parágrafos. */
export function documentoDoTermo(titulo: string, textoTermo: string): NoDoc {
    const par = (x: string): NoDoc => ({ type: 'paragraph', attrs: { textAlign: 'justify' }, content: x.split('\n').flatMap((l, i): NoDoc[] => [...(i ? [{ type: 'hardBreak' }] : []), ...(l ? [{ type: 'text', text: l }] : [])]) });
    return {
        type: 'doc',
        content: [
            { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: titulo.toUpperCase() }] },
            ...textoTermo.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).map(par),
        ],
    };
}
