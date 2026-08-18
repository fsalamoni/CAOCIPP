// ============================================================================
// checkPartnershipNoticeDeadlines — Cloud Function agendada
// ----------------------------------------------------------------------------
// Itens 7, 8, 9 do plano de Parcerias:
//
// 7. Aviso de RENOVAÇÃO: parcerias com prazo de vigência DETERMINADO +
//    renewal_notice_period/units configurados. Quando a data renewal_notice_date
//    é atingida, cria um aditivo automático em 'pendentes', com urgência ligada.
//
// 8. Aviso de REVISÃO: parcerias com prazo de vigência INDETERMINADO +
//    review_notice_period/units configurados. Quando a data review_notice_date
//    é atingida, cria um aditivo automático em 'pendentes', com urgência ligada.
//
// 9. As datas renewal_notice_date e review_notice_date são PREENCHIDAS
//    AUTOMATICAMENTE (no frontend + backend) conforme item 7/8.
//
// Schedule: 1x por dia, às 03:00 (horário de Brasília) — minimiza carga.
// Sem índice Firestore especial (apenas varredura simples em parcerias).
// ============================================================================
import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';

const UNIDADES = new Set(['dias', 'meses', 'anos']);

function fmtDate(dt: Date): string | null {
    if (Number.isNaN(dt.getTime())) return null;
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

/**
 * Soma uma duração a uma data (yyyy-MM-dd), devolvendo yyyy-MM-dd.
 * Espelha addDurationToDate em src/lib/dateUtils.js e
 * addDurationToDate em concludeAditivo.ts.
 */
function addDurationToDate(dateStr: string, valor: number, unidade: string): string | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateStr || '').trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    if (unidade === 'dias') {
        return fmtDate(new Date(y, mo, d + valor, 12, 0, 0));
    }
    if (unidade === 'meses' || unidade === 'anos') {
        const monthsToAdd = unidade === 'anos' ? valor * 12 : valor;
        const total = mo + monthsToAdd;
        const targetYear = y + Math.floor(total / 12);
        const targetMonth = ((total % 12) + 12) % 12;
        const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
        const day = Math.min(d, lastDay);
        return fmtDate(new Date(targetYear, targetMonth, day, 12, 0, 0));
    }
    return null;
}

/**
 * Verifica se a vigência é "Indeterminada".
 */
function isIndeterminate(validity: unknown): boolean {
    if (!validity) return false;
    const s = String(validity).toLowerCase().trim();
    return s.startsWith('indeterm');
}

/**
 * Cria um aditivo automático em "Pendente" para a Parceria, com urgência.
 * Retorna o ID do aditivo criado, ou null se falhar.
 */
async function createAutoAditivo(
    db: admin.firestore.Firestore,
    parceria: admin.firestore.DocumentSnapshot,
    reason: 'renewal_notice' | 'review_notice',
): Promise<string | null> {
    const data = parceria.data() || {};
    const parceriaId = parceria.id;
    const organizationId = data.organization_id;
    if (!organizationId) return null;

    // Re-validação: a Parceria pode ter mudado entre o query e a escrita.
    // Pula se: extinguida, com aditivo em andamento, ou status terminal.
    if (data.extinguished === true) return null;
    if (data.current_additive_id) return null;
    if (data.status === 'Extintos') return null;

    const aditivoNumber = (data.aditivo_count || 0) + 1;
    const aditivoRef = parceria.ref.collection('aditivos').doc();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nowIso = now.toISOString();

    // Label derivado da reason
    const label = reason === 'renewal_notice'
        ? 'Renovação Automática'
        : 'Revisão Automática';

    const aditivoData: Record<string, unknown> = {
        id: aditivoRef.id,
        parceria_id: parceriaId,
        organization_id: organizationId,
        aditivo_number: aditivoNumber,
        aditivo_type: label,
        aditivo_type_label: label,
        // Escopo: por padrão é prorrogação (o aditivo automático é SEMPRE
        // de prazo — pode ser modificado manualmente depois).
        is_prorrogacao: true,
        is_objeto: false,
        is_auto: true,
        auto_reason: reason,
        // Aditivo automático é criado com URGÊNCIA ligada.
        urgency_request: true,
        pgea: data.pgea || '',
        pgea_at_additive_creation: data.pgea || null,
        partnership_type_at_additive_creation: data.partnership_type || null,
        partnership_number_at_additive_creation: data.partnership_number || null,
        partnership_type: null,
        partnership_number: null,
        signature_date: null,
        validity_period: null,
        end_date: null,
        renewal_notice_date: null,
        subject: data.subject || '',
        object: data.object || '',
        parties: data.parties || '',
        responsible_user_id: null,
        responsible_user_name: null,
        responsibility_date: null,
        network_folder: '',
        observations: '',
        review_conclusion_date: null,
        third_party: null,
        status: 'Pendente',
        created_by: 'system:checkPartnershipNoticeDeadlines',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        activity_log: [{
            date: todayStr,
            time: now.toTimeString().split(' ')[0],
            user_id: 'system',
            user_name: 'Sistema (aviso automático)',
            action:
                `Aditivo #${aditivoNumber} criado automaticamente — `
                + (reason === 'renewal_notice'
                    ? 'aviso de renovação atingido'
                    : 'aviso de revisão atingido'),
            timestamp: nowIso,
            details: { aditivo_id: aditivoRef.id, reason },
        }],
    };

    // Transação: cria o aditivo e atualiza a Parceria (aditivo_count + current_additive_id).
    await db.runTransaction(async (t) => {
        const fresh = await t.get(parceria.ref);
        const fData = fresh.data() || {};
        if (fData.current_additive_id) {
            // Outra CF/instância criou no intervalo. Aborta silenciosamente.
            throw new Error('Aditivo já em andamento (race).');
        }
        t.set(aditivoRef, aditivoData);
        t.update(parceria.ref, {
            aditivo_count: (fData.aditivo_count || 0) + 1,
            current_additive_id: aditivoRef.id,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    return aditivoRef.id;
}

/**
 * Recalcula renewal_notice_date se o usuário mudou o período.
 * Chamado quando o admin atualiza renewal_notice_period/unit.
 */
export function computeRenewalNoticeDate(
    endDate: string | null | undefined,
    period: number | null | undefined,
    unit: string | null | undefined,
): string | null {
    if (!endDate || !period || !unit) return null;
    if (!UNIDADES.has(unit)) return null;
    if (Number(period) <= 0) return null;
    return addDurationToDate(endDate, Number(period), unit);
}

/**
 * Recalcula review_notice_date se o usuário mudou o período.
 * (Base: signature_date, ou demp se validity_starts_from === 'demp'.)
 */
export function computeReviewNoticeDate(
    signatureDate: string | null | undefined,
    demp: string | null | undefined,
    startsFrom: string | null | undefined,
    period: number | null | undefined,
    unit: string | null | undefined,
): string | null {
    if (!period || !unit) return null;
    if (!UNIDADES.has(unit)) return null;
    if (Number(period) <= 0) return null;
    const base = startsFrom === 'demp' ? demp : signatureDate;
    if (!base) return null;
    return addDurationToDate(base, Number(period), unit);
}

/**
 * Cloud Function agendada — 1x por dia às 03:00 horário de Brasília.
 *
 * Varre todas as Organizações, todas as Parcerias, e:
 *  - Se a Parceria tem renewal_notice_date <= hoje e aditivo_count==0 e
 *    status='Parcerias' e não-extinguida e renewal_notice_period > 0
 *    → cria aditivo automático (renewal_notice).
 *  - Se a Parceria tem review_notice_date <= hoje e aditivo_count==0 e
 *    status='Parcerias' e não-extinguida e review_notice_period > 0
 *    → cria aditivo automático (review_notice).
 */
export const checkPartnershipNoticeDeadlines = onSchedule(
    {
        schedule: '0 3 * * *',
        timeZone: 'America/Sao_Paulo',
        region: 'southamerica-east1',
    },
    async () => {
        const db = admin.firestore();
        const now = new Date();
        const today = fmtDate(now);
        if (!today) return;

        let totalChecked = 0;
        let renewalCreated = 0;
        let reviewCreated = 0;
        const errors: string[] = [];

        try {
            // Itera todas as Organizações (pode ser otimizado com collectionGroup
            // + índice no futuro). Hoje: <1k parcerias, aceitável.
            const orgsSnap = await db.collection('organizations').get();

            for (const orgDoc of orgsSnap.docs) {
                // Parcerias da org (status='Parcerias' OU com aviso atingido).
                // Como o campo renewal_notice_date e review_notice_date ficam na
                // Parceria, basta buscar todas as parcerias ativas da org.
                const parceriasSnap = await db.collection('parcerias')
                    .where('organization_id', '==', orgDoc.id)
                    .where('extinguished', '==', false)
                    .get();

                for (const parDoc of parceriasSnap.docs) {
                    totalChecked += 1;
                    const data = parDoc.data() || {};

                    // Pular: com aditivo em andamento, em extinção.
                    if (data.current_additive_id) continue;
                    if (data.status === 'Extintos') continue;

                    // === Aviso de Renovação (item 7) ===
                    if (data.renewal_notice_date
                        && String(data.renewal_notice_date).trim() <= today
                        && !isIndeterminate(data.validity_period)
                        && Number(data.renewal_notice_period) > 0) {
                        try {
                            const aditivoId = await createAutoAditivo(db, parDoc, 'renewal_notice');
                            if (aditivoId) renewalCreated += 1;
                        } catch (e: any) {
                            errors.push(`renewal_notice ${parDoc.id}: ${e?.message || e}`);
                        }
                        continue; // não processa o outro aviso no mesmo loop
                    }

                    // === Aviso de Revisão (item 8) ===
                    if (data.review_notice_date
                        && String(data.review_notice_date).trim() <= today
                        && isIndeterminate(data.validity_period)
                        && Number(data.review_notice_period) > 0) {
                        try {
                            const aditivoId = await createAutoAditivo(db, parDoc, 'review_notice');
                            if (aditivoId) reviewCreated += 1;
                        } catch (e: any) {
                            errors.push(`review_notice ${parDoc.id}: ${e?.message || e}`);
                        }
                    }
                }
            }

            logger.info(
                `[checkPartnershipNoticeDeadlines] checked=${totalChecked} renewal=${renewalCreated} review=${reviewCreated} errors=${errors.length}`,
            );
            if (errors.length > 0) {
                logger.warn(`[checkPartnershipNoticeDeadlines] errors: ${errors.slice(0, 10).join(' | ')}`);
            }
        } catch (e: any) {
            logger.error('[checkPartnershipNoticeDeadlines] fatal', e?.message || e);
        }
    },
);
