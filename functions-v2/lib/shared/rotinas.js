"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROTINAS = void 0;
exports.comRegistro = comRegistro;
exports.situacaoRotina = situacaoRotina;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
/**
 * Rotinas agendadas do SIGO: catálogo e registro de cada execução em
 * `platformRoutines/{chave}` (só as Functions escrevem; o painel lê pela
 * Function de diagnóstico). Toda função `onSchedule` passa por `comRegistro`,
 * e um teste trava isso.
 */
exports.ROTINAS = {
    sendDailyUrgentSummary: { nome: 'Resumo diário de urgentes por e-mail', agenda: 'Todo dia, 8h', horas: 24 },
    sendWeeklyOrgReport: { nome: 'Relatório semanal do órgão por e-mail', agenda: 'Toda segunda, 8h', horas: 24 * 7 },
    checkPartnershipNoticeDeadlines: { nome: 'Prazos de aviso das parcerias', agenda: 'Todo dia, 3h', horas: 24 },
    autoEscalateStalledUrgent: { nome: 'Escalonamento de urgentes parados', agenda: 'Todo dia, 7h', horas: 24 },
    secretariaAlertaPrazos: { nome: 'Processo Eletrônico: prazos, decursos e limpeza', agenda: 'Todo dia, 7h', horas: 24 },
};
const HISTORICO = 10;
async function gravar(chave, inicio, erro) {
    const ref = admin.firestore().collection('platformRoutines').doc(chave);
    const execucao = Object.assign({ em: new Date(inicio).toISOString(), duracao_ms: Date.now() - inicio, status: erro ? 'erro' : 'ok' }, (erro ? { erro: String((erro === null || erro === void 0 ? void 0 : erro.message) || erro).slice(0, 300) } : {}));
    await admin.firestore().runTransaction(async (t) => {
        var _a;
        const antes = (((_a = (await t.get(ref)).data()) === null || _a === void 0 ? void 0 : _a.historico) || []);
        t.set(ref, Object.assign(Object.assign({ ultima: execucao, historico: [execucao, ...antes].slice(0, HISTORICO) }, (erro ? { ultimo_erro: execucao } : { ultimo_ok: execucao })), { atualizado_em: firestore_1.FieldValue.serverTimestamp() }), { merge: true });
    });
}
/** Envolve o corpo de uma rotina agendada: grava início, duração e resultado. */
function comRegistro(chave, corpo) {
    return async (evento) => {
        const inicio = Date.now();
        try {
            await corpo(evento);
        }
        catch (e) {
            await gravar(chave, inicio, e || 'falha').catch(() => undefined);
            throw e;
        }
        await gravar(chave, inicio, null).catch((e) => console.warn('[rotinas] registro falhou', chave, e));
    };
}
/** Situação de uma rotina para o painel. Pura, exportada para teste. */
function situacaoRotina(doc, horas, agora = Date.now()) {
    if (!(doc === null || doc === void 0 ? void 0 : doc.ultima))
        return 'sem_registro';
    if (doc.ultima.status === 'erro')
        return 'erro';
    return agora - Date.parse(doc.ultima.em) > horas * 2 * 3600 * 1000 ? 'atrasada' : 'ok';
}
//# sourceMappingURL=rotinas.js.map