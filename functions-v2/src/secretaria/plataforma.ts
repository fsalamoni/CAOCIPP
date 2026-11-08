import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { texto } from '../shared/secretaria';
import { isPlatformAdmin } from '../organizations/delete';
import { COL, REGION } from './context';
import { auditar } from './config';

/**
 * Visão da Secretaria Processual para a administração da plataforma: quais
 * órgãos usam o módulo, volume de processos e suspensão por órgão (bloqueia
 * as functions do módulo naquele órgão sem apagar nada). Ligar e desligar
 * continua com o admin do órgão.
 */

interface PlataformaRequest {
    action: 'resumo' | 'suspender';
    organizationId?: string;
    suspensa?: boolean;
    motivo?: string;
}

export const secretariaPlataforma = onCall<PlataformaRequest>({ region: REGION }, async (request) => {
    if (!(await isPlatformAdmin(request))) throw new HttpsError('permission-denied', 'Apenas a administração da plataforma');
    const db = admin.firestore();
    const p = request.data || ({} as PlataformaRequest);

    if (p.action === 'resumo') {
        const orgs = await db.collection('organizations').where('secretariaConfig.enabled', '==', true).limit(300).get();
        const linhas = await Promise.all(orgs.docs.map(async (o) => {
            const base = db.collection(COL.processos).where('organization_id', '==', o.id);
            const [total, ativos, unidades] = await Promise.all([
                base.count().get(),
                base.where('status', '==', 'em_tramitacao').count().get(),
                db.collection(COL.unidades).where('organization_id', '==', o.id).count().get(),
            ]);
            const cfg = o.data().secretariaConfig || {};
            return {
                id: o.id,
                nome: String(o.data().name || o.id),
                processos: total.data().count,
                em_tramitacao: ativos.data().count,
                unidades: unidades.data().count,
                suspensa: cfg.suspensa_plataforma === true,
                motivo_suspensao: cfg.motivo_suspensao || '',
                ativada_em: cfg.updated_at?.toDate?.()?.toISOString?.() || null,
            };
        }));
        return { orgs: linhas.sort((a, b) => b.processos - a.processos) };
    }

    if (p.action === 'suspender') {
        const orgId = String(p.organizationId || '');
        const ref = db.collection('organizations').doc(orgId);
        if (!orgId || !(await ref.get()).exists) throw new HttpsError('not-found', 'Órgão não encontrado');
        const suspensa = p.suspensa === true;
        const motivo = texto(p.motivo, 300);
        if (suspensa && !motivo) throw new HttpsError('invalid-argument', 'Informe o motivo da suspensão');
        await ref.update({
            'secretariaConfig.suspensa_plataforma': suspensa,
            'secretariaConfig.motivo_suspensao': suspensa ? motivo : FieldValue.delete(),
        });
        const auth = request.auth!;
        await auditar(db, orgId, auth.uid, String(auth.token.name || auth.token.email || 'Plataforma'),
            suspensa ? 'SECRETARIA_SUSPENSA_PLATAFORMA' : 'SECRETARIA_REATIVADA_PLATAFORMA', { motivo });
        return { success: true, suspensa };
    }

    throw new HttpsError('invalid-argument', 'Ação desconhecida');
});
