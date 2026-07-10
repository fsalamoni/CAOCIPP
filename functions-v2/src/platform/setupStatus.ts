import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin } from './helpers';

/**
 * getSetupStatus - Checklist de configuração de infraestrutura que vive fora
 * do Firestore (variáveis de ambiente da Cloud Function, GitHub Actions
 * secrets, APIs do GCP) e por isso não aparece em nenhum outro painel.
 * Só leitura, sem custo relevante. Apenas super-admin.
 */
export const getSetupStatus = onCall<void>(
    { region: REGION },
    async (request) => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();

        const providerSnap = await db.collection('platformConfig').doc('emailProvider').get();
        const fromEmail = providerSnap.data()?.fromEmail || '';

        return {
            emailApiKeyConfigured: !!process.env.EMAIL_API_KEY,
            emailFromConfigured: !!fromEmail,
            platformAdminBootstrapConfigured: !!process.env.PLATFORM_ADMIN_EMAILS,
            billingExportConfigured: !!(
                process.env.BILLING_BQ_PROJECT &&
                process.env.BILLING_BQ_DATASET &&
                process.env.BILLING_BQ_TABLE
            ),
        };
    }
);
