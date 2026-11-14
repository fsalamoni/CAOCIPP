// ============================================================================
// O que a fase faz sozinha, além do prazo e do arquivamento: efeitos ao entrar
// (urgência, sigilo, responsável, pendência ao decisor), quem é avisado e o
// que acontece quando um prazo aberto por ela vence. Tudo opcional: ausente =
// como sempre foi. Lógica pura, testada em test/efeitosFase.test.js; o cliente
// tem o espelho em src/lib/efeitosFase.js (só para a tela; quem decide é o
// servidor).
// ============================================================================
import { MAX_ATRIBUICAO, mesmaAtribuicao } from './permissoesFase';

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** Quem a fase designa como responsável ao entrar: quem moveu o processo, quem gere a unidade ou quem tem certa atribuição na lotação. */
export const DESIGNA = ['autor', 'gestor', 'atribuicao'] as const;
export type Designa = typeof DESIGNA[number];
export const MAX_PENDENCIA_FASE = 300;

export interface AoEntrar {
    urgente?: true;
    /** Tira a urgência (ex.: a fase de arquivo provisório). Não vale na autuação. */
    sem_urgencia?: true;
    sem_responsavel?: true;
    arquivar?: true;
    /** O processo passa a ter este sigilo. */
    sigilo?: 'restrito' | 'normal';
    responsavel?: Designa;
    /** Com `responsavel: 'atribuicao'`: a atribuição da lotação (ex.: "Promotor"). */
    responsavel_atribuicao?: string;
    /** Abre uma pendência para quem decide, com este texto. */
    pendencia?: string;
    /** A pendência interrompe a fase até ser apreciada. */
    pendencia_interrompe?: true;
}

/** Efeitos ao entrar saneados. Lança Error com mensagem para o usuário quando duas escolhas se contradizem. */
export function sanitizeAoEntrar(raw: unknown, nomeFase: string): AoEntrar {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const out: AoEntrar = {};
    if (o.urgente === true) out.urgente = true;
    if (o.sem_urgencia === true) out.sem_urgencia = true;
    if (out.urgente && out.sem_urgencia) throw new Error(`A fase "${nomeFase}" marca e tira a urgência ao entrar: escolha uma das duas`);
    if (o.sem_responsavel === true) out.sem_responsavel = true;
    if (o.arquivar === true) out.arquivar = true;
    if (o.sigilo === 'restrito' || o.sigilo === 'normal') out.sigilo = o.sigilo;
    if (DESIGNA.includes(o.responsavel as Designa)) {
        if (out.sem_responsavel) throw new Error(`A fase "${nomeFase}" tira e designa o responsável ao entrar: escolha uma das duas`);
        out.responsavel = o.responsavel as Designa;
        if (out.responsavel === 'atribuicao') {
            const a = texto(o.responsavel_atribuicao, MAX_ATRIBUICAO);
            if (!a) throw new Error(`A fase "${nomeFase}" designa o responsável pela atribuição: informe a atribuição, como está na lotação (ex.: Promotor)`);
            out.responsavel_atribuicao = a;
        }
    }
    const pendencia = texto(o.pendencia, MAX_PENDENCIA_FASE);
    if (pendencia) {
        out.pendencia = pendencia;
        if (o.pendencia_interrompe === true) out.pendencia_interrompe = true;
    }
    // Processo arquivado não tem quem responda por ele nem o que apreciar.
    if (out.arquivar && (out.responsavel || out.pendencia)) {
        throw new Error(`A fase "${nomeFase}" arquiva o processo ao entrar: não cabe designar responsável nem abrir pendência nela`);
    }
    return out;
}

/** A quem a fase avisa quando o processo entra nela. */
export const AVISO_PARA = ['unidade', 'gestores', 'responsavel', 'ninguem'] as const;
export type AvisoPara = typeof AVISO_PARA[number];
export const MAX_MENSAGEM_AVISO = 300;
/**
 * Aviso da fase (sino e e-mail da equipe). `para` ausente = como sempre foi:
 * a unidade é avisada quando o processo chega por remessa. `mensagem`: texto
 * próprio que acompanha o aviso (só a equipe o lê).
 */
export interface AvisoFase { para?: AvisoPara; mensagem?: string }

export function sanitizeAviso(raw: unknown): AvisoFase | undefined {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const para = AVISO_PARA.includes(o.para as AvisoPara) ? (o.para as AvisoPara) : undefined;
    // Sem aviso, não há mensagem para levar.
    const mensagem = para === 'ninguem' ? '' : texto(o.mensagem, MAX_MENSAGEM_AVISO);
    const out: AvisoFase = { ...(para ? { para } : {}), ...(mensagem ? { mensagem } : {}) };
    return Object.keys(out).length ? out : undefined;
}

/** Antecedência do alerta diário de prazos quando a fase não diz outra. */
export const ALERTA_PADRAO = 2;
export const MAX_ALERTA_DIAS = 30;
/** O que acontece quando um prazo aberto pela fase vence sem ser cumprido. */
export interface PrazoVencido { urgente?: true; avisar_gestores?: true }

/**
 * Regras dos prazos que a fase abre (o dela e os das ações). Só ficam quando a
 * fase abre algum prazo. Antecedência: dias antes do vencimento em que o
 * alerta diário começa (0 = só no dia; ausente = 2).
 */
export function sanitizePrazosDaFase(fo: Record<string, unknown>, abrePrazo: boolean): { prazo_alerta_dias?: number; prazo_vencido?: PrazoVencido } {
    if (!abrePrazo) return {};
    const out: { prazo_alerta_dias?: number; prazo_vencido?: PrazoVencido } = {};
    const bruto = fo.prazo_alerta_dias;
    const n = Number(bruto);
    if (bruto !== undefined && bruto !== null && bruto !== '' && Number.isInteger(n) && n >= 0 && n <= MAX_ALERTA_DIAS && n !== ALERTA_PADRAO) out.prazo_alerta_dias = n;
    const v = (fo.prazo_vencido && typeof fo.prazo_vencido === 'object' ? fo.prazo_vencido : {}) as Record<string, unknown>;
    const vencido: PrazoVencido = { ...(v.urgente === true ? { urgente: true as const } : {}), ...(v.avisar_gestores === true ? { avisar_gestores: true as const } : {}) };
    if (Object.keys(vencido).length) out.prazo_vencido = vencido;
    return out;
}

export interface LotacaoLida { uid: string; atribuicao: string; gestor: boolean }

/**
 * Quem a fase designa ao entrar, entre os lotados na unidade que fica com o
 * processo. `uid` ausente: ninguém foi designado, e a nota diz por quê (vai ao
 * registro interno). Null: a fase não designa.
 */
export function responsavelPelaFase(ae: AoEntrar | undefined, lotacoes: LotacaoLida[], autorUid: string): { uid?: string; nota: string } | null {
    if (!ae?.responsavel) return null;
    if (ae.responsavel === 'autor') {
        return lotacoes.some((l) => l.uid === autorUid)
            ? { uid: autorUid, nota: '' }
            : { nota: 'A fase designa como responsável quem moveu o processo, mas essa pessoa não está lotada na unidade que ficou com ele: sem responsável designado.' };
    }
    const quem = ae.responsavel === 'gestor' ? 'quem gere a unidade' : `quem tem a atribuição "${ae.responsavel_atribuicao || ''}"`;
    const candidatos = lotacoes.filter((l) => (ae.responsavel === 'gestor' ? l.gestor : mesmaAtribuicao(l.atribuicao, ae.responsavel_atribuicao)));
    if (candidatos.length === 1) return { uid: candidatos[0].uid, nota: '' };
    return {
        nota: candidatos.length
            ? `A fase designa como responsável ${quem}, e há ${candidatos.length} pessoas assim na unidade: designe pela tela do processo.`
            : `A fase designa como responsável ${quem}, e não há ninguém assim na unidade: sem responsável designado.`,
    };
}

/** Uids avisados da entrada na fase. Sem responsável designado (ou unidade sem gestor), o aviso vai à unidade: não se perde. */
export function destinatariosDoAviso(para: AvisoPara, lotacoes: LotacaoLida[], responsavelUid: string | null | undefined): string[] {
    if (para === 'ninguem') return [];
    const gestores = lotacoes.filter((l) => l.gestor).map((l) => l.uid);
    if (para === 'gestores' && gestores.length) return gestores;
    if (para === 'responsavel' && responsavelUid && lotacoes.some((l) => l.uid === responsavelUid)) return [responsavelUid];
    return lotacoes.map((l) => l.uid);
}
