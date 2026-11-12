/**
 * Eventos e autos do processo: o que é ato de usuário (gera termo de uma
 * folha) e o que é registro do sistema (sai reunido num extrato), e a seleção
 * de partes dos autos para o PDF. Lógica pura, sem Firebase.
 */

/** Registros de controle interno ou automáticos: não geram termo próprio. */
export const TIPOS_SISTEMA = ['atribuicao', 'acao_fase', 'orientacao_concluida', 'convite'];

export interface Evento {
    seq: number;
    tipo: string;
    dados?: Record<string, unknown>;
    folha?: number;
}

export interface PecaFolhas { folha_inicial?: number | null; folha_final?: number | null }

/**
 * usuario: ato do processo (termo com folha, salvo se juntou documento);
 * interno: ato que o rito manda deixar fora dos autos (`dados.interno`);
 * sistema: controle interno ou automático. Ação da fase marcada como
 * "certidão nos autos" no rito (`dados.nos_autos`) é ato de usuário.
 */
export function origemEvento(m: Evento): 'sistema' | 'usuario' | 'interno' {
    if (m.dados?.interno === true) return 'interno';
    if (m.tipo === 'acao_fase' && m.dados?.nos_autos === true) return 'usuario';
    return TIPOS_SISTEMA.includes(m.tipo) || m.dados?.automatico === true ? 'sistema' : 'usuario';
}

/** Movimentos que o portal nunca mostra às partes (além dos marcados `visivel_partes: false`). */
export const MOVIMENTOS_INTERNOS = ['atribuicao', 'pendencia', 'acao_fase', 'orientacao_concluida', 'guarda'];

/** A parte vê o evento? Registros internos e de controle, não; certidão de ação no rito, sim. */
export const visivelParaPartes = (m: Evento): boolean =>
    m.dados?.visivel_partes !== false && origemEvento(m) !== 'interno'
    // Pendência aberta à mão é assunto entre a equipe e o decisor, mesmo com termo nos autos.
    && (!MOVIMENTOS_INTERNOS.includes(m.tipo) || (m.tipo === 'acao_fase' && m.dados?.nos_autos === true));

/** Id do documento que o evento juntou aos autos (juntada, petição). */
export const documentoDoEvento = (m: Evento): string | null =>
    (typeof m.dados?.documento_id === 'string' && typeof m.dados?.ordem === 'number' ? m.dados.documento_id : null);

/** Ato de usuário sem documento: a página dele é o termo. */
export const geraTermo = (m: Evento): boolean => origemEvento(m) === 'usuario' && !documentoDoEvento(m);

const TITULOS: Record<string, string> = {
    autuacao: 'Termo de autuação',
    tramitacao: 'Termo de remessa',
    conclusao: 'Termo de conclusão',
    fase: 'Certidão de mudança de fase',
    situacao: 'Certidão de mudança de situação',
    pendencia: 'Certidão de pendência',
    pendencia_resolvida: 'Certidão de apreciação',
    prazo: 'Certidão de abertura de prazo',
    prazo_encerrado: 'Certidão de encerramento de prazo',
    habilitacao: 'Termo de habilitação',
    acesso_revogado: 'Certidão de revogação de acesso',
    dados: 'Certidão de alteração de dados',
    urgencia: 'Certidão de urgência',
    comunicacao: 'Certidão de comunicação',
    ciencia: 'Termo de ciência',
    ciencia_decurso: 'Certidão de ciência por decurso',
    comunicacao_sem_efeito: 'Certidão de comunicação sem efeito',
    juntada: 'Juntada de documento',
    peticao: 'Petição',
    atribuicao: 'Atribuição',
    acao_fase: 'Ação da fase',
    orientacao_concluida: 'Orientação concluída',
    convite: 'Convite',
    guarda: 'Documento guardado fora dos autos',
    exclusao: 'Termo de exclusão',
    restauracao: 'Termo de restauração',
};
export function tituloEvento(m: Evento): string {
    if (m.tipo === 'acao_fase' && m.dados?.nos_autos === true) return 'Certidão de cumprimento';
    const t = TITULOS[m.tipo] || 'Certidão';
    // Fora dos autos não há termo nem certidão: "Termo de remessa" vira "Remessa (registro interno)".
    if (m.dados?.interno !== true) return t;
    const ato = t.replace(/^(Certidão|Termo) de /, '');
    return `${ato.charAt(0).toUpperCase()}${ato.slice(1)} (registro interno)`;
}

/** Folhas que o evento ocupa nos autos: as do documento juntado ou a do termo. */
export function folhasDoEvento(m: Evento, docs: Map<string, PecaFolhas>): [number, number] | null {
    const id = documentoDoEvento(m);
    if (id) {
        const d = docs.get(id);
        const ini = d?.folha_inicial;
        return typeof ini === 'number' ? [ini, typeof d?.folha_final === 'number' ? d.folha_final : ini] : null;
    }
    return typeof m.folha === 'number' ? [m.folha, m.folha] : null;
}

/** O que a tela precisa saber de cada evento, além do movimento gravado. */
export function extrasDoEvento(m: Evento, docs: Map<string, PecaFolhas>) {
    return { origem: origemEvento(m), titulo: tituloEvento(m), folhas: folhasDoEvento(m, docs), documento_id: documentoDoEvento(m) };
}

/** Urgentes primeiro, mantendo a ordem que a lista já tinha. */
export function urgentesPrimeiro<T extends { urgente?: boolean }>(lista: T[]): T[] {
    return [...lista.filter((x) => x.urgente === true), ...lista.filter((x) => x.urgente !== true)];
}

export const MODOS_SELECAO = ['integral', 'exceto', 'apenas', 'intervalo'] as const;
export interface Selecao {
    modo: typeof MODOS_SELECAO[number];
    eventos: number[];
    folha_de?: number;
    folha_a?: number;
    capa: boolean;
    indice: boolean;
}

const MAX_EVENTOS = 5000;

export function sanitizeSelecao(raw: unknown): Selecao {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const modo = (MODOS_SELECAO as readonly string[]).includes(String(r.modo)) ? r.modo as Selecao['modo'] : 'integral';
    const eventos = Array.isArray(r.eventos)
        ? [...new Set(r.eventos.filter((n): n is number => Number.isInteger(n) && n > 0))].slice(0, MAX_EVENTOS) : [];
    const s: Selecao = { modo, eventos, capa: r.capa !== false, indice: r.indice !== false };
    if (modo === 'apenas' && !eventos.length) throw new Error('Marque ao menos um evento para gerar o PDF');
    if (modo === 'intervalo') {
        const de = Number(r.folha_de), a = Number(r.folha_a);
        if (!Number.isInteger(de) || !Number.isInteger(a) || de < 1 || a < de) throw new Error('Informe o intervalo de folhas: a primeira e a última');
        s.folha_de = de; s.folha_a = a;
    }
    return s;
}

/**
 * Eventos que entram no PDF. No intervalo de folhas, só os que têm folha
 * dentro dele; `recorte` devolve as folhas a manter de cada evento.
 */
export function selecionar(movs: Evento[], docs: Map<string, PecaFolhas>, s: Selecao): { incluidos: Set<number>; recorte: Map<number, [number, number]> } {
    const marcados = new Set(s.eventos);
    const incluidos = new Set<number>();
    const recorte = new Map<number, [number, number]>();
    for (const m of movs) {
        if (s.modo === 'integral' || (s.modo === 'exceto' && !marcados.has(m.seq)) || (s.modo === 'apenas' && marcados.has(m.seq))) incluidos.add(m.seq);
        if (s.modo !== 'intervalo') continue;
        const f = folhasDoEvento(m, docs);
        if (!f || f[1] < s.folha_de! || f[0] > s.folha_a!) continue;
        incluidos.add(m.seq);
        recorte.set(m.seq, [Math.max(f[0], s.folha_de!), Math.min(f[1], s.folha_a!)]);
    }
    return { incluidos, recorte };
}
