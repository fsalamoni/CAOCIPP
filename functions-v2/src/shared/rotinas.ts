import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Rotinas agendadas do SIGO: catálogo e registro de cada execução em
 * `platformRoutines/{chave}` (só as Functions escrevem; o painel lê pela
 * Function de diagnóstico). Toda função `onSchedule` passa por `comRegistro`,
 * e um teste trava isso.
 */
export const ROTINAS: Record<string, { nome: string; agenda: string; horas: number }> = {
    sendDailyUrgentSummary: { nome: 'Resumo diário de urgentes por e-mail', agenda: 'Todo dia, 8h', horas: 24 },
    sendWeeklyOrgReport: { nome: 'Relatório semanal do órgão por e-mail', agenda: 'Toda segunda, 8h', horas: 24 * 7 },
    checkPartnershipNoticeDeadlines: { nome: 'Prazos de aviso das parcerias', agenda: 'Todo dia, 3h', horas: 24 },
    autoEscalateStalledUrgent: { nome: 'Escalonamento de urgentes parados', agenda: 'Todo dia, 7h', horas: 24 },
    secretariaAlertaPrazos: { nome: 'Processo Eletrônico: prazos, decursos e limpeza', agenda: 'Todo dia, 7h', horas: 24 },
    verificarUsoDiario: { nome: 'Alerta de uso do banco', agenda: 'Todo dia, 6h', horas: 24 },
};

const HISTORICO = 10;

async function gravar(chave: string, inicio: number, erro: unknown) {
    const ref = admin.firestore().collection('platformRoutines').doc(chave);
    const execucao = {
        em: new Date(inicio).toISOString(),
        duracao_ms: Date.now() - inicio,
        status: erro ? 'erro' : 'ok',
        ...(erro ? { erro: String((erro as Error)?.message || erro).slice(0, 300) } : {}),
    };
    await admin.firestore().runTransaction(async (t) => {
        const antes = ((await t.get(ref)).data()?.historico || []) as unknown[];
        t.set(ref, {
            ultima: execucao,
            historico: [execucao, ...antes].slice(0, HISTORICO),
            ...(erro ? { ultimo_erro: execucao } : { ultimo_ok: execucao }),
            atualizado_em: FieldValue.serverTimestamp(),
        }, { merge: true });
    });
}

/** Envolve o corpo de uma rotina agendada: grava início, duração e resultado. */
export function comRegistro<E>(chave: string, corpo: (evento: E) => Promise<unknown>) {
    return async (evento: E): Promise<void> => {
        const inicio = Date.now();
        try {
            await corpo(evento);
        } catch (e) {
            await gravar(chave, inicio, e || 'falha').catch(() => undefined);
            throw e;
        }
        await gravar(chave, inicio, null).catch((e) => console.warn('[rotinas] registro falhou', chave, e));
    };
}

/** Situação de uma rotina para o painel. Pura, exportada para teste. */
export function situacaoRotina(doc: { ultima?: { em: string; status: string } } | undefined, horas: number, agora = Date.now()) {
    if (!doc?.ultima) return 'sem_registro';
    if (doc.ultima.status === 'erro') return 'erro';
    return agora - Date.parse(doc.ultima.em) > horas * 2 * 3600 * 1000 ? 'atrasada' : 'ok';
}
