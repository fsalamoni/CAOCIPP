import { createHash } from 'crypto';
import { CertidaoFase, Condicao, Exigencia, RegraAcao, Registro, RegistroAtos, condicaoAtendida, respostasDaFase, sanitizeCondicao, sanitizeRegras } from './exigencias';
import { SituacaoRegistro, sanitizeSituacaoRegistro } from './situacaoRegistro';

// ============================================================================
// Processo Eletrônico (antiga Secretaria Processual; os nomes internos
// `secretaria*` e as coleções `sec*` foram mantidos) — regras puras (sem
// Firestore), testadas em functions-v2/test/secretaria.test.js.
//
// Vocabulário:
//   - unidade de lotação: secretaria (movimenta e cumpre), gabinete (decide),
//     assessoria (estuda e minuta) ou outra. Cada unidade tem lotações
//     (pessoa, atribuição e se é gestora da unidade).
//   - posse: o processo está SEMPRE com uma unidade (unidade_atual). Só quem
//     está lotado nela movimenta o processo.
//   - rito: sequência de fases, com versão. O processo guarda a versão do rito
//     com que foi autuado, então editar o rito não muda processos em curso.
//   - movimento: registro imutável do que aconteceu. Cada movimento leva o
//     hash SHA-256 do anterior; alterar um movimento antigo quebra a cadeia.
// ============================================================================

export type TipoUnidade = 'secretaria' | 'gabinete' | 'assessoria' | 'outra';
export const TIPOS_UNIDADE: TipoUnidade[] = ['secretaria', 'gabinete', 'assessoria', 'outra'];

/** Pessoa lotada numa unidade: atribuição livre e se gere a unidade. */
export interface Lotacao { uid: string; atribuicao: string; gestor: boolean }
export const MAX_LOTACOES = 200;
export type Sigilo = 'normal' | 'restrito';
export type StatusProcesso = 'em_tramitacao' | 'sobrestado' | 'arquivado';

export interface Fase {
    id: string;
    nome: string;
    prazo_dias?: number;
    /** Ao entrar na fase, abre sozinho um prazo de `prazo_dias`; ao sair (ou arquivar), ele se encerra. */
    prazo_auto?: boolean;
    /** Contagem do prazo automático. Ausente = dias úteis. */
    prazo_contagem?: 'corridos';
    /** Nome que as partes veem no portal. Ausente = o nome da fase. Os termos nos autos usam o nome oficial. */
    nome_publico?: string;
    /** O que acontece ao entrar na fase: marcar urgente, tirar o responsável designado e arquivar o processo. */
    ao_entrar?: { urgente?: true; sem_responsavel?: true; arquivar?: true };
    /** Cumprida a última ação obrigatória, a fase segue sozinha para a saída do rito (ver `saidaAutomatica`). */
    avanco?: 'auto';
    /** Situação do registro ligado (consulta ou expediente) ao entrar na fase e quando alguém assume o processo. */
    situacao_registro?: SituacaoRegistro;
    /** Orientação para quem trabalha na fase. */
    orientacao?: string;
    /** Fases para onde o processo pode seguir. Ausente = a próxima da lista. */
    proximas?: string[];
    /** Fase terminal: o fluxo acaba nela, mesmo que não seja a última da lista. */
    final?: boolean;
    /**
     * Fase de espera (ex.: diligência externa): o processo entra nela por uma saída escrita de outra fase,
     * aguarda e volta para a fase de onde veio, que é retomada como estava (ver `saidasDoProcesso`).
     */
    espera?: true;
    /** Unidade que cuida da fase (sugestão de tramitação ao entrar nela). */
    unidade_id?: string;
    /** Quem faz (cargo ou papel), ex.: "Analista", "Promotor". */
    agente?: string;
    /** O que fazer na fase, em itens. */
    acoes?: string[];
    /** Modelos de documento sugeridos na fase (ids de secModelos). */
    modelos?: string[];
    /** Condição de cada saída: { id da próxima fase: "se deferido" }. */
    condicoes?: Record<string, string>;
    /** Saída indicada pela resposta de uma ação de escolha da fase: { id da próxima fase: condição }. Seguir por outra pede motivo. */
    condicoes_regra?: Record<string, Condicao>;
    /** Formato antigo do registro da fase (processos autuados antes de nov/2026). */
    registro?: Registro;
    /** Onde ficam a entrada/saída da fase e as remessas durante ela (ver shared/exigencias.ts). Ausente = autos. */
    registro_atos?: RegistroAtos;
    /** Regras de cada ação, alinhadas a `acoes`: o que pede, onde fica, quem vê, se é obrigatória. */
    acoes_regras?: Array<RegraAcao | null>;
    /** Documentos exigidos para concluir a fase. */
    documentos?: Exigencia[];
    /** Certidão conjunta: grupo de fases que divide uma certidão, título e se as mudanças entre elas entram nela. */
    certidao?: CertidaoFase;
}
export interface Rito {
    nome: string; descricao: string; fases: Fase[];
    /** Só se autua por um tipo de processo (sempre gravado, para desligar apague a marca). */
    exigir_tipo?: boolean;
}

export interface ContextoUsuario {
    uid: string;
    /** Criador do órgão ou permissão configure_secretaria. */
    isAdmin: boolean;
    /** Unidades em que o usuário está lotado. */
    unidadeIds: string[];
}

export interface ProcessoAcesso {
    unidade_atual: string;
    unidades_historico?: string[];
    sigilo?: string;
    /** Contas habilitadas como parte ou representante de parte (portal). */
    partes_uids?: string[];
}

/**
 * Quem é parte (ou representante de parte) num processo só o alcança pelo
 * portal das partes, mesmo sendo membro, gestor ou admin do órgão: nesse
 * processo a pessoa não é o órgão. Vale para ler, agir e receber avisos.
 */
export function ehParte(proc: Pick<ProcessoAcesso, 'partes_uids'>, uid: string): boolean {
    return (proc.partes_uids || []).includes(uid);
}

/**
 * Minuta é trabalho interno: só a unidade que a redigiu a vê, e as unidades
 * para onde ela seguiu junto com o processo (`unidades_acesso`, gravado na
 * remessa). Juntado, o documento é dos autos e esta regra não se aplica.
 */
export function minutaAcessivel(doc: { unidade_origem?: unknown; unidades_acesso?: unknown }, unidadeIds: string[]): boolean {
    if (unidadeIds.includes(String(doc.unidade_origem))) return true;
    return Array.isArray(doc.unidades_acesso) && doc.unidades_acesso.some((u) => unidadeIds.includes(String(u)));
}

export const MAX_MINUTAS_REMESSA = 30;

export const MAX_TEXTO_CURTO = 200;
export const MAX_TEXTO_LONGO = 4000;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_FASES = 60;
export const MAX_ACOES = 20;
/** Campos de formulário somados em todas as ações do rito (o documento do rito tem limite de tamanho). */
export const MAX_CAMPOS_RITO = 200;
export const MAX_MODELOS_FASE = 10;

export const TIPOS_ARQUIVO_PERMITIDOS: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'text/plain': 'txt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/msword': 'doc',
    'application/vnd.oasis.opendocument.text': 'odt',
};

export function texto(v: unknown, max = MAX_TEXTO_CURTO): string {
    return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Origem do processo: como chegou ao órgão (Lei 9.784/1999, arts. 5º e 6º).
 * A referência (nº do ofício, processo de origem, meio de recebimento) é texto
 * livre e não vai ao portal das partes.
 */
export const ORIGENS = ['requerimento', 'representacao', 'oficio', 'de_oficio', 'outro_processo', 'outro'] as const;
export type TipoOrigem = typeof ORIGENS[number];
/** Registro de outro módulo ou outro processo ('pe') de onde o processo nasceu; o servidor relê. */
export interface RefOrigem { modulo: string; id: string; numero: string; titulo?: string; pagina?: string }
export interface Origem { tipo: TipoOrigem; descricao: string; ref?: RefOrigem }
const ROTULO_REF: Record<string, string> = { pe: 'Processo', consultas: 'Consulta', expedientes: 'Expediente', parcerias: 'Parceria', juri: 'Júri' };
export const ROTULO_ORIGEM: Record<TipoOrigem, string> = {
    requerimento: 'Requerimento do interessado',
    representacao: 'Representação ou denúncia',
    oficio: 'Ofício ou comunicação de outro órgão',
    de_oficio: 'De ofício (iniciativa do órgão)',
    outro_processo: 'Derivado de outro processo',
    outro: 'Outra',
};
export const textoOrigem = (o: Origem | null | undefined): string =>
    (o ? [ROTULO_ORIGEM[o.tipo] || ROTULO_ORIGEM.outro, [o.ref ? `${ROTULO_REF[o.ref.modulo] || 'Registro'} ${o.ref.numero}` : '', o.descricao].filter(Boolean).join('; ')].filter(Boolean).join(': ') : '');

/** Origem saneada, ou null quando nada foi informado. */
export function sanitizeOrigem(input: unknown): Origem | null {
    const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const descricao = texto(o.descricao, MAX_TEXTO_CURTO);
    const tipo = ORIGENS.includes(o.tipo as TipoOrigem) ? (o.tipo as TipoOrigem) : null;
    if (!tipo && !descricao) return null;
    return { tipo: tipo || 'outro', descricao };
}

export function slug(v: string): string {
    return v
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'fase';
}

/** Saneia um rito vindo do cliente. Lança Error com mensagem para o usuário. */
export function sanitizeRito(input: unknown): Rito {
    const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const nome = texto(src.nome);
    if (!nome) throw new Error('O rito precisa de um nome');
    const fasesIn = Array.isArray(src.fases) ? src.fases : [];
    if (fasesIn.length === 0) throw new Error('O rito precisa de ao menos uma fase');
    if (fasesIn.length > MAX_FASES) throw new Error(`O rito aceita no máximo ${MAX_FASES} fases`);
    const vistos = new Set<string>();
    // O id que o cliente mandou (referenciado em `proximas`) vira o id final.
    const ids = new Map<string, string>();
    const brutas = fasesIn.map((f, i) => {
        const fo = (f && typeof f === 'object' ? f : {}) as Record<string, unknown>;
        const nomeFase = texto(fo.nome);
        if (!nomeFase) throw new Error(`A fase ${i + 1} está sem nome`);
        const original = texto(fo.id, 40);
        let id = slug(original || nomeFase);
        while (vistos.has(id)) id = `${id}_${i}`;
        vistos.add(id);
        if (original) ids.set(original, id);
        // Fase de espera: nunca a primeira (o processo precisa ter de onde vir) nem a final.
        return { fo, id, nomeFase, espera: fo.espera === true && i > 0 && fo.final !== true };
    });
    const fases: Fase[] = brutas.map(({ fo, id, nomeFase, espera }, i) => {
        const prazo = Number(fo.prazo_dias);
        const prazoOk = Number.isInteger(prazo) && prazo > 0 && prazo <= 3650;
        const nomePublico = texto(fo.nome_publico, 80);
        const ae = (fo.ao_entrar && typeof fo.ao_entrar === 'object' ? fo.ao_entrar : {}) as Record<string, unknown>;
        const aoEntrar = {
            ...(ae.urgente === true ? { urgente: true as const } : {}), ...(ae.sem_responsavel === true ? { sem_responsavel: true as const } : {}),
            ...(ae.arquivar === true ? { arquivar: true as const } : {}),
        };
        const situacaoRegistro = sanitizeSituacaoRegistro(fo.situacao_registro);
        const orientacao = texto(fo.orientacao, MAX_TEXTO_LONGO);
        const final = fo.final === true;
        const proximas = !final && !espera && Array.isArray(fo.proximas)
            ? [...new Set(fo.proximas.map((x) => {
                const alvo = ids.get(String(x)) ?? (vistos.has(String(x)) ? String(x) : null);
                if (!alvo) throw new Error(`A fase "${nomeFase}" aponta para uma fase que não existe`);
                if (alvo === id) throw new Error(`A fase "${nomeFase}" não pode seguir para ela mesma`);
                return alvo;
            }))]
            : [];
        const unidade = texto(fo.unidade_id, 40);
        const agente = texto(fo.agente, 80);
        // Linhas vazias saem; as regras de cada ação acompanham a ação que ficou.
        const mantidas = (Array.isArray(fo.acoes) ? fo.acoes : []).map((a, i) => [texto(a, 200), i] as const).filter(([a]) => a).slice(0, MAX_ACOES);
        const acoes = mantidas.map(([a]) => a);
        const regrasBrutas = Array.isArray(fo.acoes_regras) ? fo.acoes_regras : [];
        const regrasAlinhadas = mantidas.map(([, i]) => regrasBrutas[i]);
        // Índice que o cliente mandou -> índice gravado (as condições apontam para ações).
        const mapa = new Map(mantidas.map(([, i], j) => [i, j]));
        const regras = sanitizeRegras({ ...fo, acoes_regras: regrasAlinhadas }, acoes, mapa);
        const modelos = [...new Set((Array.isArray(fo.modelos) ? fo.modelos : []).map((m) => texto(m, 40)).filter(Boolean))].slice(0, MAX_MODELOS_FASE);
        // Condições só para saídas que existem (referência pelo id do cliente ou final).
        const condicoes: Record<string, string> = {};
        if (fo.condicoes && typeof fo.condicoes === 'object') {
            for (const [k, v] of Object.entries(fo.condicoes as Record<string, unknown>)) {
                const alvo = ids.get(k) ?? (vistos.has(k) ? k : null);
                const rot = texto(v, 80);
                if (alvo && rot && proximas.includes(alvo)) condicoes[alvo] = rot;
            }
        }
        // Saída pela resposta: só para saídas que existem (as explícitas, ou a seguinte da lista quando não há).
        const condicoesRegra: Record<string, Condicao> = {};
        if (fo.condicoes_regra && typeof fo.condicoes_regra === 'object') {
            const saidas = final || espera ? [] : proximas.length ? proximas : brutas.slice(i + 1).filter((b) => !b.espera).slice(0, 1).map((b) => b.id);
            for (const [k, v] of Object.entries(fo.condicoes_regra as Record<string, unknown>)) {
                const alvo = ids.get(k) ?? (vistos.has(k) ? k : null);
                if (!alvo || !saidas.includes(alvo)) continue;
                const nomeAlvo = brutas.find((b) => b.id === alvo)?.nomeFase || alvo;
                const cond = sanitizeCondicao(v, regras.acoes_regras || [], acoes, `A saída de "${nomeFase}" para "${nomeAlvo}"`, mapa);
                if (cond) condicoesRegra[alvo] = cond;
            }
        }
        // Grupo da certidão: o id (do cliente ou final) de outra fase, ou a própria fase.
        const cf = (fo.certidao && typeof fo.certidao === 'object' ? fo.certidao : {}) as Record<string, unknown>;
        const grupoBruto = texto(cf.grupo, 40);
        const grupo = grupoBruto ? (ids.get(grupoBruto) ?? (vistos.has(grupoBruto) ? grupoBruto : '')) : '';
        const titulo = texto(cf.titulo, 120);
        const certidao: CertidaoFase = {
            ...(grupo && grupo !== id ? { grupo } : {}),
            ...(titulo ? { titulo } : {}),
            ...(cf.incluir_mudancas === true ? { incluir_mudancas: true } : {}),
        };
        return {
            id,
            nome: nomeFase,
            ...(Object.keys(certidao).length ? { certidao } : {}),
            ...(prazoOk ? { prazo_dias: prazo } : {}),
            ...(prazoOk && fo.prazo_auto === true ? { prazo_auto: true, ...(fo.prazo_contagem === 'corridos' ? { prazo_contagem: 'corridos' as const } : {}) } : {}),
            ...(nomePublico && nomePublico !== nomeFase ? { nome_publico: nomePublico } : {}),
            ...(Object.keys(aoEntrar).length ? { ao_entrar: aoEntrar } : {}),
            ...(fo.avanco === 'auto' && !final ? { avanco: 'auto' as const } : {}),
            ...(situacaoRegistro ? { situacao_registro: situacaoRegistro } : {}),
            ...(orientacao ? { orientacao } : {}),
            ...(proximas.length ? { proximas } : {}),
            ...(final ? { final: true } : {}),
            ...(espera ? { espera: true as const } : {}),
            ...(unidade ? { unidade_id: unidade } : {}),
            ...(agente ? { agente } : {}),
            ...(acoes.length ? { acoes } : {}),
            ...(modelos.length ? { modelos } : {}),
            ...(Object.keys(condicoes).length ? { condicoes } : {}),
            ...(Object.keys(condicoesRegra).length ? { condicoes_regra: condicoesRegra } : {}),
            ...regras,
        };
    });
    // Grupo apontando para fase que aponta para outra: todos ficam com a raiz (em ciclo, cada fase fica só).
    const raizes = new Map(fases.map((f) => {
        const vistas = new Set<string>([f.id]);
        let g = f.certidao?.grupo || f.id;
        while (!vistas.has(g)) { vistas.add(g); g = fases.find((x) => x.id === g)?.certidao?.grupo || g; }
        return [f.id, g] as const;
    }));
    for (const f of fases) {
        if (!f.certidao?.grupo) continue;
        const r = raizes.get(f.id)!;
        const { grupo: _g, ...resto } = f.certidao;
        f.certidao = r !== f.id ? { ...resto, grupo: r } : resto;
        if (!Object.keys(f.certidao).length) delete f.certidao;
    }
    const totalCampos = fases.reduce((s, f) => s + (f.acoes_regras || []).reduce((t, r) => t + (r?.campos?.length || 0), 0), 0);
    if (totalCampos > MAX_CAMPOS_RITO) throw new Error(`O rito aceita até ${MAX_CAMPOS_RITO} campos de formulário somando todas as ações (há ${totalCampos})`);
    return { nome, descricao: texto(src.descricao, MAX_TEXTO_LONGO), fases, exigir_tipo: src.exigir_tipo === true };
}

/** Fases que correm na unidade `de` passam a correr em `para` (null = na que estiver com o processo). */
export function trocarUnidadeDasFases<T extends { unidade_id?: string }>(fases: unknown, de: string, para: string | null): { fases: T[]; trocadas: number } {
    let trocadas = 0;
    const novas = ((Array.isArray(fases) ? fases : []) as T[]).map((f) => {
        if (f?.unidade_id !== de) return f;
        trocadas++;
        const { unidade_id: _u, ...resto } = f;
        return (para ? { ...resto, unidade_id: para } : resto) as T;
    });
    return { fases: novas, trocadas };
}

/**
 * Fases para onde o processo segue a partir da atual: as `proximas` da fase,
 * ou a seguinte da lista. Ir para outra fase é possível, mas fica registrado
 * como fora do fluxo e exige justificativa.
 */
export function fasesSeguintes(fases: Fase[], atualId: string): Fase[] {
    const i = fases.findIndex((f) => f.id === atualId);
    if (i < 0) return [];
    const atual = fases[i];
    // Fase de espera não tem saída no rito: a volta depende de onde o processo veio (`saidasDoProcesso`).
    if (atual.final || atual.espera) return [];
    if (atual.proximas?.length) return atual.proximas.map((id) => fases.find((f) => f.id === id)).filter((f): f is Fase => !!f);
    // Sem saída escrita, segue para a seguinte da lista; em fase de espera só se entra por saída escrita.
    const seguinte = fases.slice(i + 1).find((f) => !f.espera);
    return seguinte ? [seguinte] : [];
}

/** De onde o processo veio ao entrar numa fase de espera: para lá ele volta. */
export interface Espera { fase: string; unidade: string; responsavel_uid?: string | null; desde?: string }

/** Saídas previstas para o processo agora: as do rito ou, numa fase de espera, a fase de onde ele veio. */
export function saidasDoProcesso(proc: { fases?: unknown; fase_atual?: unknown; espera?: unknown }): Fase[] {
    const fases = (Array.isArray(proc.fases) ? proc.fases : []) as Fase[];
    const atual = fases.find((f) => f.id === proc.fase_atual);
    if (!atual?.espera) return fasesSeguintes(fases, String(proc.fase_atual));
    const origem = (proc.espera as Espera | null | undefined)?.fase;
    const volta = fases.find((f) => f.id === origem && !f.espera);
    return volta ? [volta] : [];
}

/**
 * Para onde a fase segue sozinha (`avanco: 'auto'`): a única saída do rito ou,
 * havendo várias, a única que a resposta registrada indica. Remete à unidade
 * da fase de destino quando ela é outra e está ativa. `null`: não segue (fica
 * o botão). Quem chama confere antes que nada obrigatório está em aberto.
 */
export function saidaAutomatica(
    proc: { fases?: unknown; fase_atual?: unknown; status?: unknown; fase_suspensa?: unknown; unidade_atual?: unknown; acoes_respostas?: unknown; espera?: unknown },
    unidadesAtivas: string[],
): { fase_id: string; unidade_destino?: string } | null {
    const fases = (Array.isArray(proc.fases) ? proc.fases : []) as Fase[];
    const atual = fases.find((f) => f.id === proc.fase_atual);
    if (!atual || atual.avanco !== 'auto' || proc.status !== 'em_tramitacao' || proc.fase_suspensa === true) return null;
    if (atual.espera) {
        // Fim da espera: volta para a fase de origem, na unidade em que o processo estava.
        const volta = saidasDoProcesso(proc)[0];
        const un = (proc.espera as Espera | null | undefined)?.unidade;
        if (!volta) return null;
        return { fase_id: volta.id, ...(un && un !== proc.unidade_atual && unidadesAtivas.includes(un) ? { unidade_destino: un } : {}) };
    }
    const resp = respostasDaFase(proc);
    const cabe = (f: Fase) => !atual.condicoes_regra?.[f.id] || condicaoAtendida(atual.condicoes_regra[f.id], resp, atual);
    // A saída para uma fase de espera é desvio eventual: não conta como caminho do rito.
    const seguintes = fasesSeguintes(fases, atual.id).filter((f) => !f.espera);
    const indicadas = seguintes.filter((f) => atual.condicoes_regra?.[f.id] && cabe(f));
    const alvo = seguintes.length === 1 ? (cabe(seguintes[0]) ? seguintes[0] : null) : indicadas.length === 1 ? indicadas[0] : null;
    if (!alvo) return null;
    const outra = alvo.unidade_id && alvo.unidade_id !== proc.unidade_atual && unidadesAtivas.includes(alvo.unidade_id);
    return { fase_id: alvo.id, ...(outra ? { unidade_destino: alvo.unidade_id } : {}) };
}

/** Fase seguinte no fluxo (a primeira, se houver ramificação), ou null. */
export function proximaFase(rito: Rito, faseAtualId: string): Fase | null {
    return fasesSeguintes(rito.fases, faseAtualId).find((f) => !f.espera) || null;
}

/** Quem tem o processo consigo: lotados na unidade que detém a posse. */
export function podeAgir(proc: ProcessoAcesso, ctx: ContextoUsuario): boolean {
    if (ehParte(proc, ctx.uid)) return false;
    return ctx.unidadeIds.includes(proc.unidade_atual);
}

/**
 * Quem pode ler os autos:
 *   - administrador da Secretaria do órgão: todos;
 *   - sigilo normal: qualquer usuário lotado em alguma unidade do órgão;
 *   - sigilo restrito: só unidades por onde o processo passou.
 */
export function podeVer(proc: ProcessoAcesso, ctx: ContextoUsuario): boolean {
    if (ehParte(proc, ctx.uid)) return false;
    if (ctx.isAdmin) return true;
    if (podeAgir(proc, ctx)) return true;
    if (ctx.unidadeIds.length === 0) return false;
    if (proc.sigilo === 'restrito') {
        const hist = proc.unidades_historico || [];
        return ctx.unidadeIds.some((u) => hist.includes(u));
    }
    return true;
}

export function numeroProcesso(ano: number, seq: number): string {
    return `${String(seq).padStart(6, '0')}/${ano}`;
}

/** JSON com chaves ordenadas: o mesmo conteúdo sempre gera o mesmo texto. */
export function jsonCanonico(v: unknown): string {
    if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
    if (Array.isArray(v)) return `[${v.map(jsonCanonico).join(',')}]`;
    const obj = v as Record<string, unknown>;
    const chaves = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
    return `{${chaves.map((k) => `${JSON.stringify(k)}:${jsonCanonico(obj[k])}`).join(',')}}`;
}

export function sha256(dado: string | Buffer): string {
    return createHash('sha256').update(dado).digest('hex');
}

export interface MovimentoBase {
    seq: number;
    tipo: string;
    descricao: string;
    autor_uid: string;
    autor_nome: string;
    unidade_id: string;
    em: string; // ISO 8601
    dados: Record<string, unknown>;
    hash_anterior: string;
}

export function hashMovimento(m: MovimentoBase): string {
    return sha256(jsonCanonico({
        seq: m.seq,
        tipo: m.tipo,
        descricao: m.descricao,
        autor_uid: m.autor_uid,
        autor_nome: m.autor_nome,
        unidade_id: m.unidade_id,
        em: m.em,
        dados: m.dados,
        hash_anterior: m.hash_anterior,
    }));
}

/** Confere a cadeia inteira. Retorna o seq do primeiro movimento quebrado, ou null. */
export function verificarCadeia(movs: Array<MovimentoBase & { hash: string }>): number | null {
    let anterior = '';
    const ordenados = [...movs].sort((a, b) => a.seq - b.seq);
    for (const m of ordenados) {
        if (m.hash_anterior !== anterior || hashMovimento(m) !== m.hash) return m.seq;
        anterior = m.hash;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Conteúdo redigido na plataforma: guardado como Delta do editor (lista de
// operações de texto com atributos). Aceitamos só texto e um conjunto fechado
// de formatos — nada de HTML, imagens embutidas ou links com script. Assim o
// conteúdo nunca é interpretado como HTML em lugar nenhum.
// ---------------------------------------------------------------------------

const ATRIBUTOS_PERMITIDOS: Record<string, (v: unknown) => boolean> = {
    bold: (v) => v === true,
    italic: (v) => v === true,
    underline: (v) => v === true,
    header: (v) => v === 1 || v === 2 || v === 3,
    list: (v) => v === 'ordered' || v === 'bullet',
    align: (v) => v === 'center' || v === 'right' || v === 'justify',
    blockquote: (v) => v === true,
    indent: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 8,
};

export interface DeltaOp { insert: string; attributes?: Record<string, unknown> }
export const MAX_DELTA_CHARS = 400_000;

export function sanitizeDelta(input: unknown): DeltaOp[] {
    const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
    const ops = Array.isArray(src.ops) ? src.ops : Array.isArray(input) ? (input as unknown[]) : [];
    const out: DeltaOp[] = [];
    let total = 0;
    for (const op of ops) {
        const o = (op && typeof op === 'object' ? op : {}) as Record<string, unknown>;
        if (typeof o.insert !== 'string') continue; // descarta embeds
        total += o.insert.length;
        if (total > MAX_DELTA_CHARS) throw new Error('Documento grande demais para o editor');
        const attrsIn = (o.attributes && typeof o.attributes === 'object' ? o.attributes : {}) as Record<string, unknown>;
        const attrs: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(attrsIn)) {
            if (ATRIBUTOS_PERMITIDOS[k]?.(v)) attrs[k] = v;
        }
        out.push(Object.keys(attrs).length ? { insert: o.insert, attributes: attrs } : { insert: o.insert });
    }
    return out;
}

/** Texto puro do Delta (para PDF e busca). */
export function deltaParaTexto(ops: DeltaOp[]): string {
    return ops.map((o) => o.insert).join('');
}

// ---------------------------------------------------------------------------
// Prazos. Regra do CPC (art. 224): exclui o dia do começo e inclui o do
// vencimento; se o vencimento cai em dia não útil, prorroga para o primeiro
// útil seguinte. Em dias úteis, só contam dias úteis.
// Além dos feriados nacionais, o órgão cadastra feriados locais (não úteis)
// e períodos de recesso, em que os prazos ficam suspensos (não contam nem em
// dias corridos, como no art. 220 do CPC).
// ---------------------------------------------------------------------------

export interface CalendarioOrgao {
    /** Datas AAAA-MM-DD com descrição. */
    feriados?: Array<{ data: string; descricao?: string }>;
    /** Períodos (inclusivos) em que os prazos ficam suspensos. */
    recessos?: Array<{ inicio: string; fim: string; descricao?: string }>;
    /** Recesso forense anual de 20/12 a 20/01. */
    recesso_forense?: boolean;
}
export const MAX_FERIADOS = 200;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (v: unknown): v is string => typeof v === 'string' && DATA_ISO.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export function sanitizeCalendario(input: unknown): Required<CalendarioOrgao> {
    const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const feriados = (Array.isArray(o.feriados) ? o.feriados : [])
        .map((f) => (f && typeof f === 'object' ? f : {}) as Record<string, unknown>)
        .filter((f) => dataValida(f.data))
        .map((f) => ({ data: String(f.data), descricao: texto(f.descricao, 80) }));
    const unicos = [...new Map(feriados.map((f) => [f.data, f])).values()].sort((a, b) => a.data.localeCompare(b.data)).slice(0, MAX_FERIADOS);
    const recessos = (Array.isArray(o.recessos) ? o.recessos : [])
        .map((r) => (r && typeof r === 'object' ? r : {}) as Record<string, unknown>)
        .filter((r) => dataValida(r.inicio) && dataValida(r.fim) && String(r.inicio) <= String(r.fim))
        .filter((r) => (Date.parse(String(r.fim)) - Date.parse(String(r.inicio))) / 86400000 <= 120)
        .map((r) => ({ inicio: String(r.inicio), fim: String(r.fim), descricao: texto(r.descricao, 80) }))
        .slice(0, 50);
    return { feriados: unicos, recessos, recesso_forense: o.recesso_forense === true };
}

/** Dia em que os prazos ficam suspensos pelo recesso do órgão. */
export function emRecesso(d: Date, cal?: CalendarioOrgao): boolean {
    if (!cal) return false;
    const s = iso(d);
    const md = s.slice(5);
    if (cal.recesso_forense && (md >= '12-20' || md <= '01-20')) return true;
    return (cal.recessos || []).some((r) => s >= r.inicio && s <= r.fim);
}

export type Contagem = 'corridos' | 'uteis';
export const MAX_PRAZO_DIAS = 3650;
export const MAX_ITENS = 200;

function iso(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** Domingo de Páscoa (algoritmo de Meeus/Butcher), em UTC. */
export function pascoa(ano: number): Date {
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    return new Date(Date.UTC(ano, Math.floor(n / 31) - 1, (n % 31) + 1));
}

const FIXOS = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'];

export function feriadosNacionais(ano: number): Set<string> {
    const p = pascoa(ano).getTime();
    // Carnaval (segunda e terça), Sexta-feira Santa, Corpus Christi.
    const moveis = [-48, -47, -2, 60].map((n) => iso(new Date(p + n * 86400000)));
    return new Set([...FIXOS.map((f) => `${ano}-${f}`), ...moveis]);
}

export function diaUtil(d: Date, cal?: CalendarioOrgao): boolean {
    const w = d.getUTCDay();
    if (w === 0 || w === 6) return false;
    const s = iso(d);
    if (feriadosNacionais(d.getUTCFullYear()).has(s)) return false;
    if (cal?.feriados?.some((f) => f.data === s)) return false;
    return !emRecesso(d, cal);
}

/** Data de vencimento (AAAA-MM-DD) de um prazo aberto em `inicio` (AAAA-MM-DD). */
export function calcularVencimento(inicio: string, dias: number, contagem: Contagem, cal?: CalendarioOrgao): string {
    const d = new Date(`${inicio}T00:00:00Z`);
    let restantes = dias;
    while (restantes > 0) {
        d.setUTCDate(d.getUTCDate() + 1);
        // Recesso suspende o prazo também em dias corridos.
        if (contagem === 'corridos' ? !emRecesso(d, cal) : diaUtil(d, cal)) restantes--;
    }
    while (!diaUtil(d, cal)) d.setUTCDate(d.getUTCDate() + 1);
    return iso(d);
}

/** AAAA-MM-DD somado de n dias corridos. */
export function somarDias(data: string, n: number): string {
    const d = new Date(`${data}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return iso(d);
}

/** Hoje no fuso de Brasília, AAAA-MM-DD. */
export function hojeBrasil(agora = new Date()): string {
    return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export interface Pendencia {
    id: string;
    tipo: 'peticao' | 'documento' | 'manual';
    descricao: string;
    interrompe: boolean;
    status: 'aberta' | 'resolvida';
    [k: string]: unknown;
}
export interface Prazo {
    id: string;
    descricao: string;
    vence_em: string;
    status: 'aberto' | 'cumprido' | 'cancelado';
    [k: string]: unknown;
}

/** Campos derivados gravados no processo, para listas e filtros. */
export function derivados(pendencias: Pendencia[], prazos: Prazo[]) {
    const abertas = pendencias.filter((p) => p.status === 'aberta');
    const vencimentos = prazos.filter((p) => p.status === 'aberto').map((p) => p.vence_em).sort();
    return {
        pendencias_abertas: abertas.length,
        fase_suspensa: abertas.some((p) => p.interrompe),
        proximo_vencimento: vencimentos[0] || null,
    };
}

export function tipoUnidade(v: unknown): TipoUnidade {
    return TIPOS_UNIDADE.includes(v as TipoUnidade) ? (v as TipoUnidade) : 'secretaria';
}

/** Lotações saneadas (sem repetição de pessoa). */
export function sanitizeLotacoes(input: unknown): Lotacao[] {
    const vistos = new Set<string>();
    const out: Lotacao[] = [];
    for (const l of Array.isArray(input) ? input : []) {
        const o = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>;
        const uid = texto(o.uid, 128);
        if (!uid || vistos.has(uid)) continue;
        vistos.add(uid);
        out.push({ uid, atribuicao: texto(o.atribuicao, 80), gestor: o.gestor === true });
        if (out.length >= MAX_LOTACOES) break;
    }
    return out;
}

/**
 * Lotações da unidade. Unidades criadas antes das lotações só têm
 * `membros_uids`: cada uid vira lotação sem atribuição e sem gestão.
 */
export function lotacoesDe(u: Record<string, unknown>): Lotacao[] {
    if (Array.isArray(u.lotacoes)) return sanitizeLotacoes(u.lotacoes);
    return sanitizeLotacoes((Array.isArray(u.membros_uids) ? u.membros_uids : []).map((uid) => ({ uid })));
}

/**
 * Papel timbrado efetivo de uma unidade: o próprio, se ela tiver, ou o do
 * órgão. Tipos de documento da unidade somam-se aos do órgão.
 */
export function documentoEfetivo<T extends object>(
    orgao: T,
    unidade?: { timbrado_proprio?: boolean; documento?: object | null; tipos_documento?: string[] } | null
): T & { tipos_documento: string[] } {
    const base = unidade?.timbrado_proprio && unidade.documento ? { ...orgao, ...unidade.documento } : { ...orgao };
    const doOrgao = (orgao as { tipos_documento?: string[] }).tipos_documento || [];
    const tipos = [...new Set([...doOrgao, ...(unidade?.tipos_documento || [])])];
    return { ...base, tipos_documento: tipos } as T & { tipos_documento: string[] };
}

/**
 * Exclusão de processo: some das listas e do portal, nada se apaga e o admin
 * restaura. O admin do órgão exclui qualquer um. Quem autuou exclui o próprio
 * enquanto ninguém mais agiu nele: ainda na sua unidade, sem parte habilitada
 * no portal e com todos os eventos praticados por ele.
 */
export function podeExcluirProcesso(
    proc: ProcessoAcesso & { autuado_por?: string; status?: string },
    movimentos: Array<{ autor_uid?: string }>,
    ctx: ContextoUsuario,
): boolean {
    if (proc.status === 'excluido' || ehParte(proc, ctx.uid)) return false;
    if (ctx.isAdmin) return true;
    return proc.autuado_por === ctx.uid && podeAgir(proc, ctx) && !(proc.partes_uids || []).length
        && movimentos.every((m) => m.autor_uid === ctx.uid);
}

/**
 * Equipe salva por quem partiu de uma versão antiga: aplica só o que essa
 * pessoa mudou (tirou, pôs ou alterou) sobre a equipe atual, sem desfazer quem
 * foi admitido ou alterado nesse meio-tempo.
 */
export function mesclarLotacoes<T extends { uid: string }>(atual: T[], base: T[], minha: T[]): T[] {
    const igual = (a: T | undefined, b: T | undefined) => jsonCanonico(a ?? null) === jsonCanonico(b ?? null);
    const naBase = new Map(base.map((l) => [l.uid, l]));
    const naMinha = new Set(minha.map((l) => l.uid));
    const removidos = new Set(base.filter((l) => !naMinha.has(l.uid)).map((l) => l.uid));
    const mudados = new Map(minha.filter((l) => !igual(l, naBase.get(l.uid))).map((l) => [l.uid, l]));
    const out = atual.filter((l) => !removidos.has(l.uid)).map((l) => mudados.get(l.uid) || l);
    for (const [uid, l] of mudados) if (!out.some((x) => x.uid === uid)) out.push(l);
    return out;
}

/**
 * Histórico da configuração do Processo Eletrônico: ação de auditoria -> assunto
 * (= aba da configuração; 'modulo' = ativar, preferências, integrações).
 * Eventos de processo (excluir, restaurar, PDF) ficam fora.
 */
export const HISTORICO_CONFIG: Record<string, string> = {
    SECRETARIA_ATIVADA: 'modulo', SECRETARIA_DESATIVADA: 'modulo', SECRETARIA_PREFERENCIAS: 'modulo', SECRETARIA_INTEGRACOES: 'modulo',
    SECRETARIA_SUSPENSA_PLATAFORMA: 'modulo', SECRETARIA_REATIVADA_PLATAFORMA: 'modulo',
    SECRETARIA_ORGAO_SALVO: 'estrutura', SECRETARIA_ORGAO_REMOVIDO: 'estrutura', SECRETARIA_ESTRUTURA_CRIADA: 'estrutura',
    SECRETARIA_UNIDADE_SALVA: 'unidades', SECRETARIA_UNIDADE_DOCUMENTO: 'unidades', SECRETARIA_UNIDADE_EXCLUIDA: 'unidades',
    SECRETARIA_EQUIPE_CONVITE: 'unidades', SECRETARIA_EQUIPE_CONVITE_REVOGADO: 'unidades', SECRETARIA_EQUIPE_CONVITE_ACEITO: 'unidades',
    SECRETARIA_LOTACAO_ADMITIDA: 'unidades', SECRETARIA_LOTACAO_RECUSADA: 'unidades',
    SECRETARIA_TIPO_SALVO: 'tipos', SECRETARIA_TIPO_EXCLUIDO: 'tipos', SECRETARIA_TIPO_RESTAURADO: 'tipos', SECRETARIA_NUMERACAO: 'tipos',
    SECRETARIA_RITO_SALVO: 'ritos', SECRETARIA_RITO_IMPLANTADO: 'ritos', SECRETARIA_RITO_EXCLUIDO: 'ritos', SECRETARIA_RITO_RESTAURADO: 'ritos', SECRETARIA_RITO_PROCESSOS_ATUALIZADOS: 'ritos',
    SECRETARIA_DOCUMENTO_CONFIG: 'documentos', SECRETARIA_MODELO_SALVO: 'documentos', SECRETARIA_MODELO_EXCLUIDO: 'documentos',
    SECRETARIA_MODELO_RESTAURADO: 'documentos', SECRETARIA_TEXTOS_COMUNICACAO: 'documentos',
    SECRETARIA_CALENDARIO: 'calendario',
    SECRETARIA_VERSAO_RESTAURADA: 'versao', // rito ou modelo, por details.colecao
};

export function assuntoHistorico(action: string, d: Record<string, unknown> = {}): string | null {
    const a = HISTORICO_CONFIG[action];
    return a === 'versao' ? (d.colecao === 'modelo' ? 'documentos' : 'ritos') : a || null;
}

/** Ações a ler, em lotes de até 30 (limite do `in`); assunto ausente ou desconhecido = todas. */
export function acoesHistorico(assunto?: unknown): string[][] {
    const valido = typeof assunto === 'string' && Object.values(HISTORICO_CONFIG).includes(assunto) && assunto !== 'versao';
    const todas = Object.keys(HISTORICO_CONFIG).filter((k) => !valido || HISTORICO_CONFIG[k] === assunto
        || (HISTORICO_CONFIG[k] === 'versao' && (assunto === 'ritos' || assunto === 'documentos')));
    const lotes: string[][] = [];
    for (let i = 0; i < todas.length; i += 30) lotes.push(todas.slice(i, i + 30));
    return lotes;
}
