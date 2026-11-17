// Aditivos de Consultas e Expedientes.
//
// Um aditivo é um registro novo na mesma coleção do original, com o mesmo nº
// do PGEA, os dados de identificação copiados e a tramitação em branco (entra
// em "Pendente"). O original não muda: só ganha uma entrada no histórico e os
// contadores `aditivos_seq` (numeração, nunca diminui) e `aditivos_count`
// (quantos existem). Cada um tem a sua linha do tempo; o vínculo é `aditivo_de`
// (id do original) e `aditivo_numero` (1, 2, ...). Aditivo de aditivo vira
// aditivo do original.
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { calculateStatus } from '../shared/status';
import { formatPersonName } from '../shared/normalization';
import { historyEntryId } from '../shared/history';
import { vinculoBloqueado } from '../shared/vinculo';
import { moduloPgea, ModuloPgea } from '../shared/registrosPgea';

/** Campos de identificação que o aditivo herda de quem o originou. */
export const CAMPOS_HERDADOS: Record<ModuloPgea, string[]> = {
    consultas: ['consultant', 'location', 'matter_category', 'matter_subcategory', 'matter_object', 'access_restriction'],
    expedientes: ['system', 'origin', 'object'],
};

/** Campos do vínculo que só o servidor grava. */
export const CAMPOS_VINCULO = ['aditivo_de', 'aditivo_numero', 'aditivo_motivo', 'aditivos_seq', 'aditivos_count'];

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function entradaLog(uid: string, nome: string, action: string) {
    const now = new Date();
    return {
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0],
        user_id: uid,
        user_name: nome,
        action,
        timestamp: now.toISOString(),
    };
}

async function espelharHistorico(ref: FirebaseFirestore.DocumentReference, e: ReturnType<typeof entradaLog>) {
    try {
        await ref.collection('history').doc(historyEntryId(e)).set({ ...e, created_at: FieldValue.serverTimestamp() });
    } catch (err) {
        console.error('[history dual-write] aditivo', ref.path, err);
    }
}

/** Monta o documento do aditivo a partir de quem o originou (sem efeito colateral). */
export function montarAditivo(modulo: ModuloPgea, origem: Record<string, any>, raiz: Record<string, any>, o: {
    id: string; orgId: string; numero: number; motivo: string; entrada: string; urgente: boolean;
    responsavelId: string | null; responsavelNome: string | null; uid: string; log: Record<string, any>;
}) {
    const cfg = moduloPgea(modulo)!;
    const herdados: Record<string, any> = {};
    for (const c of CAMPOS_HERDADOS[modulo]) herdados[c] = origem[c] ?? (c === 'access_restriction' ? false : '');
    const base = {
        id: o.id,
        organization_id: o.orgId,
        [cfg.campoNumero]: raiz[cfg.campoNumero],
        ...herdados,
        entry_date: o.entrada,
        urgency_request: o.urgente,
        responsible_user_id: o.responsavelId,
        responsible_user_name: o.responsavelNome ? formatPersonName(o.responsavelNome) : null,
        distribution_date: o.responsavelId ? o.entrada : null,
        analysis_start_date: null,
        third_party_referral_date: null,
        review_submission_date: null,
        reviewed_date: null,
        review_return_date: null,
        archived_date: null,
        network_folder: '',
        observations: '',
        aditivo_de: raiz.id,
        aditivo_numero: o.numero,
        aditivo_motivo: o.motivo,
        created_by: o.uid,
        activity_log: [o.log],
    };
    return { ...base, status: calculateStatus(base) };
}

interface Req {
    organizationId: string;
    modulo: string;
    origemId: string;
    motivo: string;
    entryDate?: string;
    urgencyRequest?: boolean;
    responsibleUserId?: string | null;
}

export const criarAditivo = onCall<Req>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
        const d = request.data || ({} as Req);
        const cfg = moduloPgea(d.modulo);
        const motivo = String(d.motivo || '').trim();
        const entrada = d.entryDate ? String(d.entryDate) : new Date().toISOString().split('T')[0];
        if (!d.organizationId || !cfg || !d.origemId || typeof d.origemId !== 'string') {
            throw new HttpsError('invalid-argument', 'Pedido incompleto.');
        }
        if (!motivo) throw new HttpsError('invalid-argument', 'Informe o motivo do aditivo.');
        if (motivo.length > 2000) throw new HttpsError('invalid-argument', 'O motivo passa de 2.000 caracteres.');
        if (!DATA.test(entrada)) throw new HttpsError('invalid-argument', 'Data de entrada inválida.');
        const modulo = d.modulo as ModuloPgea;
        const db = admin.firestore();
        const uid = request.auth.uid;
        const nomeUsuario = request.auth.token.name || 'Usuário desconhecido';

        const vinculo = await db.collection('userOrganizations').doc(`${uid}_${d.organizationId}`).get();
        if (!vinculo.exists || vinculoBloqueado(vinculo.data())) {
            throw new HttpsError('permission-denied', 'Você não faz parte deste órgão.');
        }
        // Responsável escolhido precisa ser membro ativo do órgão.
        let responsavelId: string | null = null;
        let responsavelNome: string | null = null;
        if (d.responsibleUserId) {
            const m = await db.collection('userOrganizations').doc(`${d.responsibleUserId}_${d.organizationId}`).get();
            if (!m.exists || vinculoBloqueado(m.data())) throw new HttpsError('invalid-argument', 'O responsável escolhido não está no órgão.');
            responsavelId = String(d.responsibleUserId);
            responsavelNome = String(m.get('user_name') || '');
        }

        const col = db.collection(cfg.colecao);
        const novoRef = col.doc();
        const res = await db.runTransaction(async (tx) => {
            const origemSnap = await tx.get(col.doc(d.origemId));
            if (!origemSnap.exists || origemSnap.get('organization_id') !== d.organizationId) {
                throw new HttpsError('not-found', `${cfg.nome === 'consulta' ? 'Consulta' : 'Expediente'} não encontrad${cfg.nome === 'consulta' ? 'a' : 'o'} neste órgão.`);
            }
            const origem = { id: origemSnap.id, ...origemSnap.data() } as Record<string, any>;
            let raiz = origem;
            let raizRef = origemSnap.ref;
            if (origem.aditivo_de) {
                const raizSnap = await tx.get(col.doc(String(origem.aditivo_de)));
                if (!raizSnap.exists || raizSnap.get('organization_id') !== d.organizationId) {
                    throw new HttpsError('failed-precondition', 'O original deste aditivo não existe mais.');
                }
                raiz = { id: raizSnap.id, ...raizSnap.data() };
                raizRef = raizSnap.ref;
            }
            const numero = (Number(raiz.aditivos_seq) || 0) + 1;
            const numeroPgea = String(raiz[cfg.campoNumero] || '');
            const logNovo = entradaLog(uid, nomeUsuario, `Aditivo nº ${numero} criado a partir d${cfg.nome === 'consulta' ? 'a consulta' : 'o expediente'} ${numeroPgea}. Motivo: ${motivo}`);
            const logRaiz = entradaLog(uid, nomeUsuario, `Aditivo nº ${numero} criado (tramitação própria, em Pendente)`);
            const doc = montarAditivo(modulo, origem, raiz, {
                id: novoRef.id, orgId: d.organizationId, numero, motivo, entrada, urgente: d.urgencyRequest === true,
                responsavelId, responsavelNome, uid, log: logNovo,
            });
            tx.set(novoRef, { ...doc, created_at: FieldValue.serverTimestamp(), updated_at: FieldValue.serverTimestamp() });
            // O original fica como está (fase, datas, updated_at): só o vínculo e o histórico.
            tx.update(raizRef, { aditivos_seq: numero, aditivos_count: FieldValue.increment(1), activity_log: FieldValue.arrayUnion(logRaiz) });
            return { numero, numeroPgea, raizRef, logNovo, logRaiz };
        });

        await espelharHistorico(novoRef, res.logNovo);
        await espelharHistorico(res.raizRef, res.logRaiz);
        const stats = modulo === 'consultas'
            ? { 'stats.processes_count': FieldValue.increment(1), 'stats.active_processes': FieldValue.increment(1) }
            : { 'stats.expedientes_count': FieldValue.increment(1), 'stats.active_expedientes': FieldValue.increment(1) };
        await db.collection('organizations').doc(d.organizationId).update(stats).catch((e) => console.error('[aditivo] stats', e));
        await db.collection('auditLogs').add({
            organization_id: d.organizationId,
            user_id: uid,
            user_name: request.auth.token.name || '',
            action: modulo === 'consultas' ? 'CREATE_PROCESS_ADITIVO' : 'CREATE_EXPEDIENTE_ADITIVO',
            details: { id: novoRef.id, aditivo_de: res.raizRef.id, aditivo_numero: res.numero, numero: res.numeroPgea },
            timestamp: FieldValue.serverTimestamp(),
        });
        return { success: true, id: novoRef.id, aditivo_numero: res.numero, aditivo_de: res.raizRef.id };
    }
);

/**
 * Antes de gravar uma edição: tira dos `changes` o que só o servidor grava e,
 * num aditivo, o nº do PGEA (ele acompanha o original).
 */
export function protegerVinculo(changes: Record<string, any>, atual: Record<string, any>, campoNumero: string) {
    for (const c of CAMPOS_VINCULO) delete changes[c];
    if (atual.aditivo_de) delete changes[campoNumero];
}

/** Original mudou de número: os aditivos passam a ter o mesmo, com entrada no histórico. */
export async function propagarNumero(colecao: string, orgId: string, raizId: string, campoNumero: string, novo: string, uid: string, nome: string) {
    const db = admin.firestore();
    const snap = await db.collection(colecao).where('organization_id', '==', orgId).where('aditivo_de', '==', raizId).get();
    if (snap.empty) return 0;
    const log = entradaLog(uid, nome, `Nº do PGEA atualizado para ${novo}, acompanhando o original`);
    const batch = db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { [campoNumero]: novo, activity_log: FieldValue.arrayUnion(log), updated_at: FieldValue.serverTimestamp() }));
    await batch.commit();
    await Promise.all(snap.docs.map((d) => espelharHistorico(d.ref, log)));
    return snap.size;
}

/**
 * Antes de excluir: original com aditivos não sai (os aditivos ficariam sem
 * original). Devolve o que fazer depois da exclusão de um aditivo.
 */
export async function conferirExclusao(colecao: string, orgId: string, id: string, dados: Record<string, any>) {
    const db = admin.firestore();
    if (!dados.aditivo_de) {
        const filhos = await db.collection(colecao).where('organization_id', '==', orgId).where('aditivo_de', '==', id).limit(1).get();
        if (!filhos.empty) {
            throw new HttpsError('failed-precondition', 'Este procedimento tem aditivos. Exclua os aditivos antes de excluir o original.');
        }
        return null;
    }
    return async (uid: string, nome: string) => {
        const raizRef = db.collection(colecao).doc(String(dados.aditivo_de));
        const log = entradaLog(uid, nome, `Aditivo nº ${dados.aditivo_numero} excluído`);
        try {
            await raizRef.update({ aditivos_count: FieldValue.increment(-1), activity_log: FieldValue.arrayUnion(log) });
            await espelharHistorico(raizRef, log);
        } catch (e) {
            console.error('[aditivo] exclusão: original não atualizado', raizRef.path, e);
        }
    };
}
