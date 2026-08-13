import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { historyEntryId } from '../shared/history';

/**
 * concludeAditivo — Conclui um aditivo (procedimento paralelo de alteração) e
 * aplica suas mudanças à Parceria ORIGINAL.
 *
 * Modelo de negócio:
 *   - A Parceria é e sempre será a original. Um aditivo é um procedimento
 *     paralelo que, ao chegar na fase "Parcerias", é CONCLUÍDO.
 *   - Ao concluir, o aditivo recebe: nº do aditivo (já definido na criação),
 *     data de assinatura do aditivo e, conforme o caso, prazo de prorrogação
 *     e/ou objeto do aditivo. O aditivo NÃO tem "tipo de parceria" próprio.
 *   - As alterações são gravadas NO PRÓPRIO ADITIVO e também alimentam a
 *     ORIGINAL:
 *       * Prazo de prorrogação → amplia o termo final (end_date) e a vigência
 *         (validity_period) da original, registrando "em razão do aditivo nº X".
 *       * Objeto do aditivo → é somado ao objeto da original, registrando idem.
 *   - A original volta para "Parcerias" (ativa), com `current_additive_id`
 *     liberado para novos aditivos. NÃO altera tipo, número, partes, PGEA,
 *     assinatura/publicação/DEMP da original.
 */
interface ConcludeAditivoRequest {
    parceriaId: string;
    aditivoId: string;
    organizationId: string;
    aditivoSignatureDate: string;            // data de assinatura do aditivo (yyyy-MM-dd)
    prazoValor?: number | string;            // prazo de prorrogação (quantidade)
    prazoUnidade?: 'dias' | 'meses' | 'anos';
    objetoAditivo?: string;                  // objeto do aditivo (texto)
}

const UNIDADES = new Set(['dias', 'meses', 'anos']);

function fmtDate(dt: Date): string | null {
    if (Number.isNaN(dt.getTime())) return null;
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

/**
 * Soma uma duração a uma data 'yyyy-MM-dd', devolvendo 'yyyy-MM-dd'.
 * Para meses/anos, faz "clamp" no último dia do mês-alvo para evitar overflow
 * (ex.: 31/01 + 1 mês → 28/02, não 03/03; 29/02 + 1 ano → 28/02). Meio-dia
 * local evita off-by-one por fuso ao formatar de volta.
 */
function addDurationToDate(dateStr: string, valor: number, unidade: string): string | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || '').trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1; // 0-indexed
    const d = Number(m[3]);

    if (unidade === 'dias') {
        return fmtDate(new Date(y, mo, d + valor, 12, 0, 0));
    }
    if (unidade === 'meses' || unidade === 'anos') {
        const monthsToAdd = unidade === 'anos' ? valor * 12 : valor;
        const total = mo + monthsToAdd;
        const targetYear = y + Math.floor(total / 12);
        const targetMonth = ((total % 12) + 12) % 12;
        // Último dia do mês-alvo (dia 0 do mês seguinte).
        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        const day = Math.min(d, lastDay);
        return fmtDate(new Date(targetYear, targetMonth, day, 12, 0, 0));
    }
    return null;
}

export const concludeAditivo = onCall<ConcludeAditivoRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const data = request.data || ({} as ConcludeAditivoRequest);
        const { parceriaId, aditivoId, organizationId } = data;
        const aditivoSignatureDate = String(data.aditivoSignatureDate || '').trim();
        const objetoAditivo = String(data.objetoAditivo || '').trim();
        const prazoValorNum = Number(data.prazoValor);
        const prazoUnidade = String(data.prazoUnidade || '').trim();
        const hasPrazo = Number.isFinite(prazoValorNum) && prazoValorNum > 0 && UNIDADES.has(prazoUnidade);
        const hasObjeto = objetoAditivo.length > 0;

        if (!parceriaId || !aditivoId || !organizationId) {
            throw new HttpsError('invalid-argument', 'parceriaId, aditivoId e organizationId são obrigatórios');
        }
        if (!aditivoSignatureDate) {
            throw new HttpsError('invalid-argument', 'A data de assinatura do aditivo é obrigatória.');
        }
        if (!hasPrazo && !hasObjeto) {
            throw new HttpsError(
                'failed-precondition',
                'Informe ao menos um: prazo de prorrogação (quantidade + unidade) ou objeto do aditivo.'
            );
        }

        const db = admin.firestore();
        const userId = request.auth.uid;
        const userName = request.auth.token.name || 'Usuário desconhecido';

        // Verificação de membership.
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Você não é membro desta organização');
        }

        const parceriaRef = db.collection('parcerias').doc(parceriaId);
        const aditivoRef = parceriaRef.collection('aditivos').doc(aditivoId);

        const now = new Date();
        const logDate = now.toISOString().split('T')[0];
        const logTime = now.toTimeString().split(' ')[0];

        const result = await db.runTransaction(async (t) => {
            const parceriaSnap = await t.get(parceriaRef);
            if (!parceriaSnap.exists) {
                throw new HttpsError('not-found', 'Parceria não encontrada');
            }
            const parceria = parceriaSnap.data() || {};
            if (parceria.organization_id !== organizationId) {
                throw new HttpsError('permission-denied', 'Parceria pertence a outra organização');
            }

            const aditivoSnap = await t.get(aditivoRef);
            if (!aditivoSnap.exists) {
                throw new HttpsError('not-found', 'Aditivo não encontrado');
            }
            const aditivo = aditivoSnap.data() || {};
            if (aditivo.status === 'Concluído') {
                throw new HttpsError('failed-precondition', 'Este aditivo já está concluído.');
            }

            const aditivoNumber = Number(aditivo.aditivo_number) || 0;

            // --- Calcular alterações na ORIGINAL ---
            const parentUpdate: Record<string, unknown> = {
                status: 'Parcerias',
                current_additive_id: '',
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_by: userId,
            };

            let previousEndDate: string | null = null;
            let newEndDate: string | null = null;
            let newRenewalNoticeDate: string | null = null;

            if (hasPrazo) {
                previousEndDate = (parceria.end_date as string) || null;
                // A original formalizada tem end_date (exigido na fase Parcerias);
                // como fallback defensivo, ancora na data de assinatura do aditivo
                // para que o termo final SEMPRE seja atualizado quando há prazo.
                const base = previousEndDate || aditivoSignatureDate;
                const computed = addDurationToDate(base, prazoValorNum, prazoUnidade);
                if (computed) {
                    newEndDate = computed;
                    parentUpdate.end_date = computed;
                }
                // A data do aviso de renovação acompanha a extensão do termo,
                // para que os alertas de renovação reflitam o novo prazo.
                const prevRenewal = (parceria.renewal_notice_date as string) || null;
                if (prevRenewal) {
                    const r = addDurationToDate(prevRenewal, prazoValorNum, prazoUnidade);
                    if (r) {
                        newRenewalNoticeDate = r;
                        parentUpdate.renewal_notice_date = r;
                    }
                }
                // Vigência (texto): acrescenta a prorrogação e a razão.
                const prevValidity = String(parceria.validity_period || '').trim();
                const prazoTexto = `+${prazoValorNum} ${prazoUnidade} (aditivo nº ${aditivoNumber})`;
                parentUpdate.validity_period = prevValidity
                    ? `${prevValidity}; ${prazoTexto}`
                    : prazoTexto;
            }

            if (hasObjeto) {
                const prevObject = String(parceria.object || '').trim();
                const objetoTexto = `[Aditivo nº ${aditivoNumber}] ${objetoAditivo}`;
                parentUpdate.object = prevObject
                    ? `${prevObject}\n\n${objetoTexto}`
                    : objetoTexto;
            }

            // Registro estruturado da modificação (para auditoria/exibição).
            const modification = {
                aditivo_id: aditivoId,
                aditivo_number: aditivoNumber,
                aditivo_type: aditivo.aditivo_type || null,
                aditivo_type_label: aditivo.aditivo_type_label || null,
                aditivo_signature_date: aditivoSignatureDate,
                prazo_valor: hasPrazo ? prazoValorNum : null,
                prazo_unidade: hasPrazo ? prazoUnidade : null,
                previous_end_date: previousEndDate,
                new_end_date: newEndDate,
                new_renewal_notice_date: newRenewalNoticeDate,
                objeto_aditivo: hasObjeto ? objetoAditivo : null,
                applied_at: logDate,
                applied_by: userId,
            };
            parentUpdate.aditivo_modifications = admin.firestore.FieldValue.arrayUnion(modification);

            const parentLog = {
                date: logDate,
                time: logTime,
                user_id: userId,
                user_name: userName,
                action: `Aditivo nº ${aditivoNumber} concluído${hasPrazo ? ` — prazo +${prazoValorNum} ${prazoUnidade}` : ''}${hasObjeto ? ' — objeto alterado' : ''}`,
                timestamp: now.toISOString(),
            };
            parentUpdate.activity_log = admin.firestore.FieldValue.arrayUnion(parentLog);

            // --- Atualizar o ADITIVO (conclusão) ---
            const aditivoUpdate: Record<string, unknown> = {
                status: 'Concluído',
                aditivo_signature_date: aditivoSignatureDate,
                prazo_valor: hasPrazo ? prazoValorNum : null,
                prazo_unidade: hasPrazo ? prazoUnidade : null,
                objeto_aditivo: hasObjeto ? objetoAditivo : null,
                concluded_at: logDate,
                concluded_by: userId,
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_by: userId,
            };
            const aditivoLog = {
                date: logDate,
                time: logTime,
                user_id: userId,
                user_name: userName,
                action: `Aditivo nº ${aditivoNumber} concluído (assinado em ${aditivoSignatureDate})`,
                timestamp: now.toISOString(),
            };
            aditivoUpdate.activity_log = admin.firestore.FieldValue.arrayUnion(aditivoLog);

            t.update(parceriaRef, parentUpdate);
            t.update(aditivoRef, aditivoUpdate);

            return { aditivoNumber, newEndDate, parentLog, aditivoLog };
        });

        // Escritas independentes pós-transação em paralelo (menor latência).
        // O histórico é best-effort (não deve derrubar a operação já concluída).
        const historyWrites = Promise.all([
            parceriaRef.collection('history').doc(historyEntryId(result.parentLog)).set({
                ...result.parentLog,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            }),
            aditivoRef.collection('history').doc(historyEntryId(result.aditivoLog)).set({
                ...result.aditivoLog,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            }),
        ]).catch((histErr) => {
            console.error('[history dual-write] concludeAditivo', parceriaId, aditivoId, histErr);
        });

        const auditWrite = db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: userName,
            action: 'CONCLUDE_ADITIVO',
            details: {
                parceria_id: parceriaId,
                aditivo_id: aditivoId,
                aditivo_number: result.aditivoNumber,
                has_prazo: hasPrazo,
                has_objeto: hasObjeto,
                new_end_date: result.newEndDate,
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        await Promise.all([historyWrites, auditWrite]);

        return { success: true, status: 'Concluído', newEndDate: result.newEndDate };
    }
);
