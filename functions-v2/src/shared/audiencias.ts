/**
 * Audiência como ação do rito (`pede: 'audiencia'`): a equipe designa data,
 * hora, modo, local ou link e quem participa além das partes (testemunha,
 * perito...). A designação é certidão nos autos, que as partes veem; a
 * comunicação às partes usa `{audiencia}` no texto para levar a data. A
 * realização e o resultado ficam com as ações seguintes do rito (escolha,
 * documento da ata).
 *
 * Lógica pura; o servidor grava. Ver docs/PROCESSO_ELETRONICO.md.
 */
import { texto } from './secretaria';

export const ESPECIES_AUDIENCIA: Record<string, string> = {
    audiencia: 'Audiência', instrucao: 'Audiência de instrução', conciliacao: 'Audiência de conciliação', oitiva: 'Oitiva',
    sessao: 'Sessão de julgamento', reuniao: 'Reunião', inspecao: 'Inspeção ou vistoria',
};
export const MODOS_AUDIENCIA: Record<string, string> = { presencial: 'presencial', virtual: 'por videoconferência', hibrida: 'híbrida (presencial e por videoconferência)' };
export const QUALIDADES: Record<string, string> = { testemunha: 'testemunha', perito: 'perito', informante: 'informante', assistente: 'assistente técnico', interprete: 'intérprete', outro: 'outro participante' };
export const MAX_PARTICIPANTES = 20;
/** Marca que a comunicação troca pela audiência designada. */
export const MARCA_AUDIENCIA = '{audiencia}';

export interface AudienciaDaAcao { especie: string }
export interface Participante { nome: string; qualidade: string }
export interface Audiencia {
    id: string; fase_id: string; acao_idx: number; especie: string;
    data: string; hora: string; modo: string; local?: string; link?: string; participantes?: Participante[];
    designada_em: string; designada_por: string; status: 'designada' | 'cancelada';
}
export type DadosAudiencia = Pick<Audiencia, 'data' | 'hora' | 'modo' | 'local' | 'link' | 'participantes'>;

/** Valida o que o rito diz da audiência. Lança com mensagem. */
export function sanitizeAudienciaDaAcao(raw: unknown, acao: string): AudienciaDaAcao {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const especie = String(r.especie || 'audiencia');
    if (!ESPECIES_AUDIENCIA[especie]) throw new Error(`A ação "${acao}" designa audiência: espécie desconhecida`);
    return { especie };
}

/** Confere o que a equipe informa ao designar. `hoje` em AAAA-MM-DD. Lança com mensagem. */
export function dadosDaAudiencia(bruto: unknown, hoje: string): DadosAudiencia {
    const r = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
    const data = String(r.data || '');
    const hora = String(r.hora || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`))) throw new Error('Informe a data da audiência');
    if (data < hoje) throw new Error('A audiência não pode ser designada para data passada');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new Error('Informe a hora da audiência (hh:mm)');
    const modo = String(r.modo || 'presencial');
    if (!MODOS_AUDIENCIA[modo]) throw new Error('Modo da audiência desconhecido');
    const local = texto(r.local, 200);
    const link = texto(r.link, 300);
    if (modo !== 'virtual' && !local) throw new Error('Informe o local da audiência');
    if (modo !== 'presencial' && !link) throw new Error('Informe o link ou a sala virtual da audiência');
    const brutos = Array.isArray(r.participantes) ? r.participantes : [];
    if (brutos.length > MAX_PARTICIPANTES) throw new Error(`Até ${MAX_PARTICIPANTES} participantes além das partes`);
    const participantes = brutos.map((x) => {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        const qualidade = String(o.qualidade || 'testemunha');
        if (!QUALIDADES[qualidade]) throw new Error('Qualidade do participante desconhecida');
        return { nome: texto(o.nome, 120), qualidade };
    }).filter((p) => p.nome);
    return { data, hora, modo, ...(modo !== 'virtual' ? { local } : {}), ...(modo !== 'presencial' ? { link } : {}), ...(participantes.length ? { participantes } : {}) };
}

const br = (iso: string) => iso.split('-').reverse().join('/');

/** "20/11/2026, às 14:00, presencial, em Sala 3" (com link e participantes, se houver). */
export function textoDaAudiencia(a: DadosAudiencia, comParticipantes = true): string {
    const onde = a.modo === 'virtual' ? `por videoconferência (${a.link})`
        : a.modo === 'hibrida' ? `em ${a.local} e por videoconferência (${a.link})` : `em ${a.local}`;
    const quem = comParticipantes && a.participantes?.length
        ? `. Participam, além das partes: ${a.participantes.map((p) => `${p.nome} (${QUALIDADES[p.qualidade]})`).join('; ')}` : '';
    return `${br(a.data)}, às ${a.hora}, ${onde}${quem}`;
}

/** Audiências designadas (não canceladas) de hoje em diante, da mais próxima à mais distante. */
export function audienciasFuturas(lista: Audiencia[] | undefined, hoje: string): Audiencia[] {
    return (lista || []).filter((a) => a.status === 'designada' && a.data >= hoje)
        .sort((a, b) => `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`));
}

/** Designa (feita) ou cancela (desfeita) a audiência da ação na lista do processo. */
export function aplicarAudiencia(lista: Audiencia[] | undefined, faseId: string, idx: number, nova: Audiencia | null): Audiencia[] {
    const atual = [...(lista || [])];
    if (nova) return [...atual, nova];
    const k = atual.map((a) => a.fase_id === faseId && a.acao_idx === idx && a.status === 'designada').lastIndexOf(true);
    if (k >= 0) atual[k] = { ...atual[k], status: 'cancelada' };
    return atual;
}
