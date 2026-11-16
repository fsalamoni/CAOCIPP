/**
 * Disputa de preços como ação do rito (`pede: 'disputa'`), S11: o certame.
 * A unidade que tem o processo monta o aviso (objeto, itens, critério, prazo)
 * e o publica; fornecedores entram por convite (cotação privada) ou pelo link
 * do aviso (dispensa eletrônica, IN SEGES/ME 67/2021) e enviam a proposta.
 * Até a abertura, o conteúdo das propostas é sigiloso: o órgão sabe só quantas
 * chegaram. A sala de lances (S12) e o julgamento com o resultado (S13) estão
 * no fim deste arquivo.
 *
 * Lógica pura; o servidor grava. Ver docs/PROCESSO_ELETRONICO.md.
 */
import { CalendarioOrgao, diaUtil, texto } from './secretaria';
import { cpfCnpj } from './camposProcesso';

export const PERFIS_DISPUTA: Record<string, string> = { cotacao: 'Cotação privada', dispensa: 'Dispensa eletrônica' };
export type PerfilDisputa = 'cotacao' | 'dispensa';
export const CRITERIOS: Record<string, string> = { menor_preco: 'menor preço', maior_desconto: 'maior desconto' };
export const UNIDADES_DISPUTA: Record<string, string> = { item: 'por item', lote: 'por lote' };
export const PORTES: Record<string, string> = { me_epp: 'microempresa ou empresa de pequeno porte', demais: 'demais empresas ou pessoa física' };
/** Saídas da ação no rito (decidem o caminho, como os resultados do julgamento). */
export const RESULTADOS_DISPUTA = ['Homologada', 'Deserta', 'Fracassada'];
export const SITUACOES_CERTAME: Record<string, string> = {
    rascunho: 'Em montagem', publicado: 'Recebendo propostas', em_disputa: 'Em disputa', encerrado: 'Encerrado', cancelado: 'Cancelado',
};
export type SituacaoCertame = 'rascunho' | 'publicado' | 'em_disputa' | 'encerrado' | 'cancelado';

export const MAX_ITENS = 200;
export const MAX_CONVITES = 100;
export const MAX_FORNECEDORES = 500;
/** Dias úteis mínimos entre a publicação e a abertura: IN 67/2021, art. 6º, parágrafo único (dispensa); 1 na cotação privada. */
export const DIAS_UTEIS_MINIMOS: Record<PerfilDisputa, number> = { cotacao: 1, dispensa: 3 };
/** Duração dos lances, em horas: IN 67/2021, art. 11 (6 a 10 h na dispensa). */
export const HORAS_LANCES: Record<PerfilDisputa, [number, number]> = { cotacao: [1, 10], dispensa: [6, 10] };

export interface DisputaDaAcao { perfil: PerfilDisputa }
export interface ItemCertame {
    id: string; numero: number; descricao: string; unidade: string; quantidade: number;
    valor_estimado?: number; lote?: number; exclusivo_meepp?: true;
}
export interface DadosCertame {
    objeto: string; criterio: 'menor_preco' | 'maior_desconto'; unidade_disputa: 'item' | 'lote'; itens: ItemCertame[];
    intervalo: { tipo: 'valor' | 'percentual'; valor: number };
    orcamento_sigiloso: boolean;
    /** Abertura: fim das propostas e início dos lances (horário de Brasília). */
    abertura_data: string; abertura_hora: string;
    /** Cotação privada: só propostas fechadas, ou com lances depois. A dispensa sempre tem lances. */
    lances: boolean; horas_lances: number;
    condicoes: string; habilitacao: string;
}
export interface ConviteCertame { id: string; nome: string; email: string; hash: string; criado_em: string; aceito_em?: string; uid?: string; revogado?: true }
export interface Licitante { razao_social: string; documento: string; porte: 'me_epp' | 'demais'; email: string; representante: string }
export interface ItemProposta { item_id: string; valor: number; marca?: string; modelo?: string; descricao?: string }
export interface Proposta { licitante: Licitante; itens: ItemProposta[]; declaracoes: string[]; enviada_em: string; atualizada_em: string }

/** Declarações do fornecedor (IN 67/2021, art. 8º; IN 73/2022, art. 18, § 2º). As marcadas com `!` são obrigatórias. */
export const DECLARACOES: Array<[string, string, boolean]> = [
    ['conformidade', 'A proposta atende a todas as exigências do aviso e o preço inclui todos os custos da contratação.', true],
    ['habilitacao', 'Cumpro os requisitos de habilitação e respondo pela veracidade das informações e dos documentos.', true],
    ['impedimento', 'Não estou impedido de licitar ou contratar com a Administração.', true],
    ['trabalho_menor', 'Não emprego menor de 18 anos em trabalho noturno, perigoso ou insalubre, nem menor de 16, salvo aprendiz a partir de 14.', true],
    ['meepp', 'Sou microempresa ou empresa de pequeno porte e cumpro os requisitos da Lei Complementar 123/2006 para o tratamento diferenciado.', false],
];

export const num = (v: unknown): number => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);
/** Até 4 casas decimais (IN 73/2022 e manual do fornecedor). */
const casas4 = (n: number) => Math.round(n * 10000) / 10000;
const ehData = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));

export function sanitizeDisputaDaAcao(raw: unknown, acao: string): DisputaDaAcao {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const perfil = String(r.perfil || 'cotacao');
    if (!PERFIS_DISPUTA[perfil]) throw new Error(`A ação "${acao}" faz disputa de preços: tipo de disputa desconhecido`);
    return { perfil: perfil as PerfilDisputa };
}

/** Primeiro dia possível para a abertura: n dias úteis depois de `hoje` (AAAA-MM-DD). */
export function aberturaMinima(perfil: PerfilDisputa, hoje: string, cal?: CalendarioOrgao): string {
    const d = new Date(`${hoje}T00:00:00Z`);
    let n = DIAS_UTEIS_MINIMOS[perfil] ?? 1;
    while (n > 0) { d.setUTCDate(d.getUTCDate() + 1); if (diaUtil(d, cal)) n--; }
    // A contagem é de dias úteis inteiros; a abertura no dia seguinte ao último.
    d.setUTCDate(d.getUTCDate() + 1);
    while (!diaUtil(d, cal)) d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

/** Instante (ISO, UTC) da abertura, a partir da data e hora de Brasília (UTC-3, sem horário de verão). */
export const instanteDaAbertura = (d: Pick<DadosCertame, 'abertura_data' | 'abertura_hora'>): string =>
    new Date(`${d.abertura_data}T${d.abertura_hora}:00-03:00`).toISOString();

/** Confere o aviso como a unidade o monta. Lança com mensagem. Não confere prazo (só na publicação). */
export function sanitizeDadosCertame(raw: unknown, perfil: PerfilDisputa): DadosCertame {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const objeto = texto(r.objeto, 2000);
    const criterio = String(r.criterio || 'menor_preco');
    if (!CRITERIOS[criterio]) throw new Error('Critério de julgamento desconhecido');
    const unidade = String(r.unidade_disputa || 'item');
    if (!UNIDADES_DISPUTA[unidade]) throw new Error('Diga se a disputa é por item ou por lote');
    const brutos = Array.isArray(r.itens) ? r.itens : [];
    if (brutos.length > MAX_ITENS) throw new Error(`Até ${MAX_ITENS} itens por disputa`);
    const ids = new Set<string>();
    const itens = brutos.map((x, i) => {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        const n = i + 1;
        const descricao = texto(o.descricao, 500);
        if (descricao.length < 3) throw new Error(`Descreva o item ${n}`);
        const quantidade = casas4(num(o.quantidade));
        if (!(quantidade > 0) || quantidade > 1e9) throw new Error(`Informe a quantidade do item ${n}`);
        const est = o.valor_estimado === '' || o.valor_estimado == null ? NaN : num(o.valor_estimado);
        if (!Number.isNaN(est) && !(est > 0 && est < 1e12)) throw new Error(`Valor estimado do item ${n} inválido`);
        const lote = unidade === 'lote' ? Math.trunc(num(o.lote)) : NaN;
        if (unidade === 'lote' && !(lote >= 1 && lote <= 99)) throw new Error(`Diga em que lote está o item ${n} (1 a 99)`);
        let id = typeof o.id === 'string' && /^[a-z0-9]{1,12}$/.test(o.id) ? o.id : `i${n}`;
        while (ids.has(id)) id = `${id}x`;
        ids.add(id);
        return {
            id, numero: n, descricao, unidade: texto(o.unidade, 30) || 'unidade', quantidade,
            ...(Number.isNaN(est) ? {} : { valor_estimado: casas4(est) }),
            ...(unidade === 'lote' ? { lote } : {}),
            ...(o.exclusivo_meepp === true ? { exclusivo_meepp: true as const } : {}),
        };
    });
    const iv = (r.intervalo && typeof r.intervalo === 'object' ? r.intervalo : {}) as Record<string, unknown>;
    const ivTipo = iv.tipo === 'valor' ? 'valor' : 'percentual';
    const ivValor = iv.valor === '' || iv.valor == null ? 0 : casas4(num(iv.valor));
    if (!(ivValor >= 0) || (ivTipo === 'percentual' && ivValor > 50)) throw new Error('Intervalo mínimo entre lances inválido (percentual de 0 a 50)');
    const abertura_data = String(r.abertura_data || '');
    const abertura_hora = String(r.abertura_hora || '');
    if (abertura_data && !ehData(abertura_data)) throw new Error('Data da abertura inválida');
    if (abertura_hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(abertura_hora)) throw new Error('Hora da abertura inválida (hh:mm)');
    const lances = perfil === 'dispensa' ? true : r.lances === true;
    const [hMin, hMax] = HORAS_LANCES[perfil];
    const horas = r.horas_lances == null || r.horas_lances === '' ? hMin : Math.trunc(num(r.horas_lances));
    if (lances && !(horas >= hMin && horas <= hMax)) throw new Error(`Os lances duram de ${hMin} a ${hMax} horas${perfil === 'dispensa' ? ' na dispensa eletrônica (IN 67/2021, art. 11)' : ''}`);
    return {
        objeto, criterio: criterio as DadosCertame['criterio'], unidade_disputa: unidade as DadosCertame['unidade_disputa'], itens,
        intervalo: { tipo: ivTipo, valor: ivValor }, orcamento_sigiloso: r.orcamento_sigiloso === true,
        abertura_data, abertura_hora, lances, horas_lances: lances ? horas : 0,
        condicoes: texto(r.condicoes, 4000), habilitacao: texto(r.habilitacao, 4000),
    };
}

/** O que falta para publicar; lista vazia quando pode. `hoje` em AAAA-MM-DD. */
export function problemasParaPublicar(d: DadosCertame, perfil: PerfilDisputa, hoje: string, cal?: CalendarioOrgao): string[] {
    const out: string[] = [];
    if (d.objeto.length < 10) out.push('Descreva o objeto (ao menos 10 letras)');
    if (!d.itens.length) out.push('Inclua ao menos um item');
    if (!d.abertura_data || !d.abertura_hora) out.push('Informe a data e a hora da abertura');
    else {
        const min = aberturaMinima(perfil, hoje, cal);
        if (d.abertura_data < min) out.push(`A abertura precisa ser a partir de ${min.split('-').reverse().join('/')} (${DIAS_UTEIS_MINIMOS[perfil]} dia${DIAS_UTEIS_MINIMOS[perfil] > 1 ? 's' : ''} út${DIAS_UTEIS_MINIMOS[perfil] > 1 ? 'eis' : 'il'} depois da publicação${perfil === 'dispensa' ? ', IN 67/2021, art. 6º' : ''})`);
        else if (!diaUtil(new Date(`${d.abertura_data}T00:00:00Z`), cal)) out.push('A abertura precisa ser em dia útil');
        if (d.abertura_hora < '08:00' || d.abertura_hora > '18:00') out.push('A abertura precisa ser em horário comercial (8h às 18h)');
    }
    if (d.criterio === 'maior_desconto' && d.itens.some((i) => i.valor_estimado == null)) out.push('No maior desconto, informe o preço de referência de cada item (o desconto é sobre ele)');
    return out;
}

/** Lotes da disputa com os itens de cada um (por item: um "lote" por item). */
export function unidadesDeDisputa(d: Pick<DadosCertame, 'unidade_disputa' | 'itens'>): Array<{ chave: string; nome: string; itens: ItemCertame[] }> {
    if (d.unidade_disputa === 'item') return d.itens.map((i) => ({ chave: i.id, nome: `Item ${i.numero}`, itens: [i] }));
    const lotes = [...new Set(d.itens.map((i) => i.lote || 1))].sort((a, b) => a - b);
    return lotes.map((l) => ({ chave: `l${l}`, nome: `Lote ${l}`, itens: d.itens.filter((i) => (i.lote || 1) === l) }));
}

/** Valor estimado da disputa (soma de quantidade x valor dos itens que têm), ou null. */
export function valorEstimado(itens: ItemCertame[]): number | null {
    const com = itens.filter((i) => i.valor_estimado != null);
    return com.length ? casas4(com.reduce((s, i) => s + i.quantidade * (i.valor_estimado || 0), 0)) : null;
}

/** Confere o cadastro do fornecedor. Lança com mensagem. */
export function sanitizeLicitante(raw: unknown, email: string): Licitante {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const razao = texto(r.razao_social, 200);
    if (razao.length < 3) throw new Error('Informe o nome ou a razão social');
    const documento = cpfCnpj(String(r.documento || ''));
    if (!documento) throw new Error('CPF ou CNPJ inválido');
    const porte = r.porte === 'me_epp' ? 'me_epp' : 'demais';
    return { razao_social: razao, documento, porte, email: texto(email, 120), representante: texto(r.representante, 120) };
}

/**
 * Confere a proposta contra o aviso. Lança com mensagem. Por lote, cota todos
 * os itens do lote ou nenhum; item exclusivo só aceita ME/EPP. No maior
 * desconto, o valor é o percentual (0 a 100, exclusive).
 */
export function sanitizeProposta(raw: unknown, d: DadosCertame, licitante: Licitante): Pick<Proposta, 'itens' | 'declaracoes'> {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const brutos = Array.isArray(r.itens) ? r.itens : [];
    const porId = new Map(d.itens.map((i) => [i.id, i]));
    const vistos = new Set<string>();
    const itens: ItemProposta[] = [];
    for (const x of brutos) {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        const item = porId.get(String(o.item_id));
        if (!item || vistos.has(item.id)) continue;
        if (o.valor === '' || o.valor == null) continue;
        const valor = casas4(num(o.valor));
        if (d.criterio === 'maior_desconto' ? !(valor > 0 && valor < 100) : !(valor > 0 && valor < 1e12)) {
            throw new Error(`Item ${item.numero}: ${d.criterio === 'maior_desconto' ? 'informe o desconto em percentual (maior que 0 e menor que 100)' : 'informe o valor unitário'}`);
        }
        if (item.exclusivo_meepp && licitante.porte !== 'me_epp') throw new Error(`O item ${item.numero} é exclusivo para microempresa e empresa de pequeno porte`);
        vistos.add(item.id);
        itens.push({
            item_id: item.id, valor,
            ...(texto(o.marca, 120) ? { marca: texto(o.marca, 120) } : {}),
            ...(texto(o.modelo, 120) ? { modelo: texto(o.modelo, 120) } : {}),
            ...(texto(o.descricao, 1000) ? { descricao: texto(o.descricao, 1000) } : {}),
        });
    }
    if (!itens.length) throw new Error('Cote ao menos um item');
    if (d.unidade_disputa === 'lote') {
        for (const u of unidadesDeDisputa(d)) {
            const cotados = u.itens.filter((i) => vistos.has(i.id)).length;
            if (cotados && cotados < u.itens.length) throw new Error(`${u.nome}: cote todos os itens do lote ou nenhum`);
        }
    }
    const marcadas = new Set((Array.isArray(r.declaracoes) ? r.declaracoes : []).map(String));
    const faltam = DECLARACOES.filter(([id, , obrig]) => obrig && !marcadas.has(id));
    if (faltam.length) throw new Error('Marque as declarações obrigatórias');
    if (licitante.porte === 'me_epp' && !marcadas.has('meepp')) throw new Error('Quem se declara microempresa ou empresa de pequeno porte marca a declaração correspondente');
    const declaracoes = DECLARACOES.map(([id]) => id).filter((id) => marcadas.has(id) && (id !== 'meepp' || licitante.porte === 'me_epp'));
    return { itens, declaracoes };
}

/** Valor da proposta numa unidade de disputa (lote: soma de quantidade x unitário). Null se não cotou. */
export function valorNaUnidade(p: Pick<Proposta, 'itens'>, u: { itens: ItemCertame[] }, criterio: DadosCertame['criterio']): number | null {
    const vals = u.itens.map((i) => p.itens.find((x) => x.item_id === i.id));
    if (vals.some((v) => !v)) return null;
    if (criterio === 'maior_desconto') return casas4(vals.reduce((s, v) => s + v!.valor, 0) / vals.length);
    return casas4(u.itens.reduce((s, i, k) => s + i.quantidade * vals[k]!.valor, 0));
}

/** Alertas (não bloqueiam) da proposta: valor abaixo de 50% do estimado (indício de inexequibilidade). */
export function alertasDaProposta(p: Pick<Proposta, 'itens'>, d: DadosCertame): string[] {
    if (d.criterio !== 'menor_preco' || d.orcamento_sigiloso) return [];
    return p.itens.flatMap((x) => {
        const i = d.itens.find((y) => y.id === x.item_id);
        return i?.valor_estimado && x.valor < i.valor_estimado * 0.5 ? [`Item ${i.numero}: o valor está abaixo da metade do estimado`] : [];
    });
}

const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
export { moeda };
const brData = (s: string) => s.split('-').reverse().join('/');

/** Texto do aviso, para os autos e para os fornecedores. O valor estimado sai quando o orçamento não é sigiloso. */
export function textoDoAviso(perfil: PerfilDisputa, d: DadosCertame, numero: string, unidade: string): string {
    const linhas = [
        `${PERFIS_DISPUTA[perfil]} · Processo ${numero} · ${unidade}`,
        `Objeto: ${d.objeto}`,
        `Julgamento pelo ${CRITERIOS[d.criterio]}, ${UNIDADES_DISPUTA[d.unidade_disputa]}.`,
        `Propostas até ${brData(d.abertura_data)}, às ${d.abertura_hora} (horário de Brasília), pela plataforma.`
            + (d.lances ? ` Em seguida, lances por ${d.horas_lances} hora${d.horas_lances > 1 ? 's' : ''}${d.intervalo.valor ? `, com intervalo mínimo de ${d.intervalo.tipo === 'valor' ? moeda(d.intervalo.valor) : `${String(d.intervalo.valor).replace('.', ',')}%`} entre lances` : ''}.` : ' Sem fase de lances: vale a proposta.'),
        'Itens:',
        ...d.itens.map((i) => `${i.numero}. ${i.descricao} · ${String(i.quantidade).replace('.', ',')} ${i.unidade}${i.lote ? ` · lote ${i.lote}` : ''}${i.exclusivo_meepp ? ' · exclusivo ME/EPP' : ''}${!d.orcamento_sigiloso && i.valor_estimado != null ? ` · ${d.criterio === 'maior_desconto' ? 'preço de referência' : 'valor estimado unitário'} ${moeda(i.valor_estimado)}` : ''}`),
        ...(d.orcamento_sigiloso ? ['O orçamento estimado é sigiloso e será divulgado depois do julgamento.'] : []),
        ...(d.condicoes ? [`Condições da contratação: ${d.condicoes}`] : []),
        ...(d.habilitacao ? [`Habilitação: ${d.habilitacao}`] : []),
    ];
    return linhas.join('\n');
}

/** Código curto do aviso para o link público (sem letras que se confundem). */
export function codigoDoAviso(bytes: Uint8Array): string {
    const ALF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(bytes.slice(0, 8), (b) => ALF[b % ALF.length]).join('');
}

// ─── Sala de lances (S12) ─────────────────────────────────────────────────

/** O licitante desfaz o próprio último lance uma vez por item ou lote, em até 15 segundos (IN 73/2022, art. 21, § 3º). */
export const SEGUNDOS_PARA_DESFAZER = 15;
/** Intervalo mínimo entre dois lances do mesmo licitante, contra cliques repetidos. */
export const SEGUNDOS_ENTRE_LANCES = 3;

export interface Lance {
    id: string; seq: number; chave: string; uid: string;
    /** O que o licitante digita: unitário (item, menor preço), global (lote) ou percentual (desconto). */
    valor: number;
    /** O que classifica: no item por menor preço, quantidade x unitário; nos demais, o próprio valor. */
    total: number;
    em: string;
    excluido?: { por: 'licitante' | 'agente'; motivo?: string; em: string };
}
/** Posição de um licitante numa unidade de disputa: o último lance válido ou, sem lance, a proposta. */
export interface Posicao { uid: string; valor: number; total: number; em: string; seq: number }

type Sala = Pick<DadosCertame, 'lances' | 'horas_lances'> & { abertura_em?: string };

/** Fim da fase de lances (ISO), ou undefined sem lances. A dispensa não prorroga (IN 67/2021, art. 11). */
export const fimDosLances = (x: Sala): string | undefined =>
    (x.abertura_em && x.lances ? new Date(Date.parse(x.abertura_em) + x.horas_lances * 3600e3).toISOString() : undefined);

export type MomentoDisputa = 'propostas' | 'lances' | 'encerrada';
/** Em que ponto está a disputa publicada: recebendo propostas, em lances ou encerrada (sem lances, encerra na abertura). */
export function momentoDaDisputa(x: Sala, agora: string): MomentoDisputa {
    if (!x.abertura_em || agora < x.abertura_em) return 'propostas';
    const fim = fimDosLances(x);
    return fim && agora < fim ? 'lances' : 'encerrada';
}

type Criterio = Pick<DadosCertame, 'criterio' | 'unidade_disputa'>;
const unitario = (d: Criterio) => d.criterio === 'menor_preco' && d.unidade_disputa === 'item';
export const totalDoValor = (v: number, u: { itens: ItemCertame[] }, d: Criterio): number =>
    (unitario(d) ? casas4(v * u.itens[0].quantidade) : casas4(v));

/** O valor da proposta na unidade, no que o licitante digita no lance. Null se não cotou. */
export function valorDaProposta(p: Pick<Proposta, 'itens'>, u: { itens: ItemCertame[] }, d: Criterio): number | null {
    const t = valorNaUnidade(p, u, d.criterio);
    if (t == null) return null;
    return unitario(d) ? p.itens.find((x) => x.item_id === u.itens[0].id)!.valor : t;
}

export const valorTexto = (v: number, d: Pick<DadosCertame, 'criterio'>) => (d.criterio === 'maior_desconto' ? `${String(v).replace('.', ',')}%` : moeda(v));

/**
 * Confere o lance contra o último valor do próprio licitante (lance intermediário
 * vale: não precisa vencer o melhor). Devolve o problema, ou '' quando vale.
 * No desconto, o intervalo é em pontos percentuais.
 */
export function problemaDoLance(valor: number, atual: number, d: Pick<DadosCertame, 'criterio' | 'intervalo'>): string {
    const desc = d.criterio === 'maior_desconto';
    if (!Number.isFinite(valor) || valor <= 0 || valor >= 1e12) return 'Informe o valor do lance';
    if (desc && valor >= 100) return 'O desconto precisa ser menor que 100%';
    const iv = d.intervalo?.valor || 0;
    const passo = desc || d.intervalo?.tipo === 'valor' ? iv : casas4((atual * iv) / 100);
    if (desc ? !(valor > atual) : !(valor < atual)) return `O lance precisa ser ${desc ? 'maior' : 'menor'} que o seu último (${valorTexto(atual, d)})`;
    const limite = casas4(desc ? atual + passo : atual - passo);
    if (passo > 0 && (desc ? valor < limite : valor > limite)) {
        return `Respeite o intervalo mínimo entre lances: ${desc ? 'ao menos' : 'no máximo'} ${valorTexto(limite, d)}`;
    }
    return '';
}

/** Ordena as posições: menor total (ou maior desconto); empate, quem chegou antes ao valor (IN 67/2021, art. 12, § 1º). */
export function ordenarPosicoes(ps: Posicao[], d: Pick<DadosCertame, 'criterio'>): Posicao[] {
    const desc = d.criterio === 'maior_desconto';
    return [...ps].sort((a, b) => (desc ? b.total - a.total : a.total - b.total) || a.em.localeCompare(b.em) || a.seq - b.seq);
}

/** Posição de um licitante: o último lance não excluído, ou a proposta. Null se não cotou a unidade. */
export function posicaoDe(uid: string, p: Pick<Proposta, 'itens' | 'atualizada_em'>, u: { chave: string; itens: ItemCertame[] }, d: Criterio, lances: Lance[]): Posicao | null {
    const base = valorDaProposta(p, u, d);
    if (base == null) return null;
    const ult = lances.filter((l) => l.uid === uid && l.chave === u.chave && !l.excluido).sort((a, b) => a.seq - b.seq).at(-1);
    return ult ? { uid, valor: ult.valor, total: ult.total, em: ult.em, seq: ult.seq } : { uid, valor: base, total: totalDoValor(base, u, d), em: p.atualizada_em, seq: 0 };
}

// ─── Julgamento e resultado (S13) ─────────────────────────────────────────

/** Empate ficto: ME/EPP até 5% acima da melhor oferta (LC 123/2006, art. 44, § 2º), com 5 minutos para cobrir (art. 45, § 3º). */
export const MARGEM_EMPATE_FICTO = 0.05;
export const MINUTOS_DESEMPATE = 5;
/** Janela da intenção de recurso, em minutos: ao menos 10, logo depois de declarado o vencedor (Lei 14.133/2021, art. 165, § 1º, I). */
export const MINUTOS_INTENCAO: [number, number] = [10, 60];
/** Prazo para enviar proposta ajustada ou documentos de habilitação, em horas (IN SEGES 73/2022: ao menos 2 horas). */
export const HORAS_CONVOCACAO: [number, number] = [2, 72];
/** Razões e contrarrazões: 3 dias úteis cada (Lei 14.133/2021, art. 165, I e § 4º). */
export const DIAS_RECURSO = 3;
export const MAX_ARQUIVOS_CONVOCACAO = 10;

export type SituacaoJulgamento = 'desempate' | 'analise' | 'aceita' | 'habilitada' | 'fracassada' | 'deserta';
export const SITUACOES_JULGAMENTO: Record<SituacaoJulgamento, string> = {
    desempate: 'Em desempate (ME/EPP)', analise: 'Proposta em análise', aceita: 'Proposta aceita, habilitação em análise',
    habilitada: 'Vencedor habilitado', fracassada: 'Fracassado', deserta: 'Deserto',
};
export type EtapaJulgamento = 'julgamento' | 'recurso' | 'resultado' | 'encerrado';
export const ETAPAS_JULGAMENTO: Record<EtapaJulgamento, string> = {
    julgamento: 'Julgamento e habilitação', recurso: 'Prazo de recurso', resultado: 'Pronto para o resultado', encerrado: 'Encerrado',
};

export interface Classificado { uid: string; valor: number; total: number; porte: 'me_epp' | 'demais'; em: string; desempate?: true; negociado?: true }
export interface Recusa { uid: string; etapa: 'proposta' | 'habilitacao'; motivo: string; em: string; por: string }
export interface ArquivoConvocacao { id: string; nome: string; mime: string; bytes: number; em: string; path: string }
export interface UnidadeJulgamento {
    situacao: SituacaoJulgamento;
    /** Classificação vigente (depois do desempate e da negociação). */
    ordem: Classificado[];
    /** Quem está em análise agora (null no desempate e no fim). */
    vez: string | null;
    recusas: Recusa[];
    desempate?: { candidatos: string[]; feitos: string[]; atual?: { uid: string; ate: string; recusou?: true } };
    negociacao?: { uid: string; desde: string };
    convocacao?: { uid: string; o_que: 'proposta' | 'documentos'; ate: string; em: string; arquivos: ArquivoConvocacao[] };
    aceita?: { uid: string; total: number; em: string; por: string };
    habilitada?: { uid: string; total: number; em: string; por: string };
}

const melhor = (a: number, b: number, d: Pick<DadosCertame, 'criterio'>) => (d.criterio === 'maior_desconto' ? a > b : a < b);
export { melhor as ofertaMelhor };

/**
 * ME/EPP em empate ficto com a primeira colocada, na ordem de classificação.
 * Não há empate ficto se a primeira já é ME/EPP. No desconto, compara-se o
 * preço equivalente (100 menos o desconto).
 */
export function candidatosDoDesempate(ordem: Classificado[], d: Pick<DadosCertame, 'criterio'>): string[] {
    const [primeira, ...resto] = ordem;
    if (!primeira || primeira.porte === 'me_epp') return [];
    const preco = (c: Classificado) => (d.criterio === 'maior_desconto' ? 100 - c.total : c.total);
    const limite = preco(primeira) * (1 + MARGEM_EMPATE_FICTO);
    return resto.filter((c) => c.porte === 'me_epp' && preco(c) <= limite + 1e-9).map((c) => c.uid);
}

/** Abre o julgamento de uma unidade a partir das posições finais. */
export function abrirUnidade(ordem: Classificado[], d: Pick<DadosCertame, 'criterio'>): UnidadeJulgamento {
    if (!ordem.length) return { situacao: 'deserta', ordem, vez: null, recusas: [] };
    const candidatos = candidatosDoDesempate(ordem, d);
    return candidatos.length
        ? { situacao: 'desempate', ordem, vez: null, recusas: [], desempate: { candidatos, feitos: [] } }
        : { situacao: 'analise', ordem, vez: ordem[0].uid, recusas: [] };
}

/** Próximo a analisar: o melhor classificado ainda não recusado. */
export const proximaVez = (u: Pick<UnidadeJulgamento, 'ordem' | 'recusas'>): string | null =>
    u.ordem.find((c) => !u.recusas.some((r) => r.uid === c.uid))?.uid || null;

/** Próximo candidato do desempate ainda não chamado (ou null: o desempate acabou). */
export const proximoDoDesempate = (u: UnidadeJulgamento): string | null =>
    u.desempate?.candidatos.find((x) => !u.desempate!.feitos.includes(x)) || null;

/** Encerra o desempate sem oferta vencedora: vai à análise a primeira colocada. */
export function fimDoDesempate(u: UnidadeJulgamento): UnidadeJulgamento {
    const { desempate: _d, ...resto } = u;
    return { ...resto, situacao: 'analise', vez: proximaVez(u) };
}

/** Oferta da ME/EPP no desempate: precisa ser melhor que a primeira; se for, passa à frente e vai à análise. */
export function aplicarDesempate(u: UnidadeJulgamento, uid: string, valor: number, total: number, em: string, d: Pick<DadosCertame, 'criterio'>): UnidadeJulgamento | string {
    const primeira = u.ordem[0];
    if (!melhor(total, primeira.total, d)) return `A oferta precisa ser ${d.criterio === 'maior_desconto' ? 'maior' : 'menor'} que a da primeira colocada (${valorTexto(primeira.total, d)})`;
    const eu = u.ordem.find((c) => c.uid === uid)!;
    const ordem = [{ ...eu, valor, total, em, desempate: true as const }, ...u.ordem.filter((c) => c.uid !== uid)];
    const { desempate: _d, ...resto } = u;
    return { ...resto, ordem, situacao: 'analise', vez: uid };
}

/** Todas as unidades decididas: pode declarar o vencedor (ou concluir sem ele). */
export const julgamentoConcluido = (us: UnidadeJulgamento[]) => us.every((u) => ['habilitada', 'fracassada', 'deserta'].includes(u.situacao));

/** Resultado da disputa: homologada se há vencedor em ao menos uma unidade; deserta se ninguém propôs; fracassada nos demais casos. */
export function resultadoDaDisputa(us: UnidadeJulgamento[]): 'Homologada' | 'Deserta' | 'Fracassada' {
    if (us.some((u) => u.situacao === 'habilitada')) return 'Homologada';
    return us.every((u) => u.situacao === 'deserta') ? 'Deserta' : 'Fracassada';
}

/** Fim do dia útil (23:59 de Brasília) do vencimento de n dias úteis contados de `inicio` (AAAA-MM-DD). */
export function fimDoPrazoUtil(inicio: string, n: number, cal?: CalendarioOrgao): string {
    const d = new Date(`${inicio}T00:00:00Z`);
    let k = n;
    while (k > 0) { d.setUTCDate(d.getUTCDate() + 1); if (diaUtil(d, cal)) k--; }
    return new Date(`${d.toISOString().slice(0, 10)}T23:59:59-03:00`).toISOString();
}

export interface Intencao { uid: string; nome: string; motivo: string; em: string; razoes?: { texto: string; em: string } }
export interface Recurso {
    declarado_em: string; intencao_ate: string; razoes_ate: string; contrarrazoes_ate: string;
    intencoes: Intencao[]; contrarrazoes: Array<{ uid: string; nome: string; texto: string; em: string }>;
    decisao?: { provimento: 'nao' | 'sim' | 'parcial'; fundamentos: string; em: string; por: string };
}
export const PROVIMENTOS: Record<string, string> = { nao: 'Negado provimento', sim: 'Dado provimento', parcial: 'Dado provimento em parte' };

/** Em que ponto está o recurso: intenção, razões, contrarrazões, decisão, ou sem recurso (ninguém manifestou). */
export function momentoDoRecurso(r: Recurso, agora: string): 'intencao' | 'razoes' | 'contrarrazoes' | 'decisao' | 'sem_recurso' | 'decidido' {
    if (r.decisao) return 'decidido';
    if (agora <= r.intencao_ate) return 'intencao';
    if (!r.intencoes.length) return 'sem_recurso';
    if (agora <= r.razoes_ate) return 'razoes';
    // Ninguém arrazoou: o recurso não segue (decide-se já).
    if (!r.intencoes.some((i) => i.razoes)) return 'decisao';
    return agora <= r.contrarrazoes_ate ? 'contrarrazoes' : 'decisao';
}

/** Linha de cada unidade para a certidão e o resumo: vencedor e valor, ou o desfecho. */
export function linhaDaUnidade(nome: string, u: UnidadeJulgamento, quem: (uid: string) => string, d: Pick<DadosCertame, 'criterio'>): string {
    if (u.situacao === 'habilitada' && u.habilitada) return `${nome}: ${quem(u.habilitada.uid)}, ${valorTexto(u.habilitada.total, d)}`;
    return `${nome}: ${u.situacao === 'deserta' ? 'deserto (sem proposta)' : 'fracassado (nenhuma proposta aceita e habilitada)'}`;
}

/** Ata da disputa: o que aconteceu em cada unidade, o recurso e o resultado. Texto puro, nos autos. */
export function textoDaAta(x: Pick<DadosCertame, 'criterio' | 'objeto'> & { perfil: PerfilDisputa; processo_numero: string; abertura_em?: string },
    unidades: Array<{ nome: string; u: UnidadeJulgamento }>, quem: (uid: string) => string, recursos: Recurso[], resultado: string, lances: number): string {
    const br = (iso: string) => {
        const d = new Date(Date.parse(iso) - 3 * 3600e3).toISOString();
        return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}, ${d.slice(11, 16)}`;
    };
    const l: string[] = [`ATA DA ${PERFIS_DISPUTA[x.perfil].toUpperCase()}`, `Processo ${x.processo_numero}. Objeto: ${x.objeto}.`];
    if (x.abertura_em) l.push(`Abertura em ${br(x.abertura_em)} (horário de Brasília)${lances ? `, com ${lances} lance${lances === 1 ? '' : 's'}` : ', sem fase de lances'}.`);
    for (const { nome, u } of unidades) {
        l.push('', `${nome}`);
        if (!u.ordem.length) { l.push('Sem proposta: deserto.'); continue; }
        l.push(...u.ordem.map((c, k) => `${k + 1}º ${quem(c.uid)}${c.porte === 'me_epp' ? ' (ME/EPP)' : ''}: ${valorTexto(c.total, x)}${c.desempate ? ', oferta de desempate' : ''}${c.negociado ? ', após negociação' : ''}`));
        for (const r of u.recusas) l.push(`${r.etapa === 'proposta' ? 'Proposta recusada' : 'Inabilitado'}: ${quem(r.uid)}. Motivo: ${r.motivo}`);
        l.push(linhaDaUnidade('Desfecho', u, quem, x) + '.');
    }
    recursos.forEach((r, k) => {
        l.push('', recursos.length > 1 ? `Recurso (${k + 1}ª rodada)` : 'Recurso');
        if (!r.intencoes.length) { l.push(`Aberta a intenção de recurso até ${br(r.intencao_ate)}, ninguém manifestou.`); return; }
        for (const i of r.intencoes) l.push(`Intenção de ${i.nome}: ${i.motivo}${i.razoes ? ' (razões apresentadas)' : ' (sem razões no prazo)'}`);
        if (r.contrarrazoes.length) l.push(`Contrarrazões de ${r.contrarrazoes.map((c) => c.nome).join(', ')}.`);
        if (r.decisao) l.push(`Decisão: ${PROVIMENTOS[r.decisao.provimento]}. ${r.decisao.fundamentos}`);
    });
    l.push('', `Resultado: ${resultado}.`);
    return l.join('\n');
}
