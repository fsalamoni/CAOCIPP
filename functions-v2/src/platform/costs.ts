import { onCall } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin } from './helpers';

/**
 * getCostReport - Relatório de custos da plataforma.
 *
 * Fonte de custo (decisão do projeto): Cloud Billing exportado para BigQuery.
 * Quando o export estiver configurado (variáveis de ambiente abaixo), esta
 * função consulta os custos reais por serviço. Enquanto não estiver
 * configurado, retorna status "not_configured" com instruções, sem quebrar.
 *
 * Variáveis de ambiente esperadas:
 *   BILLING_BQ_PROJECT  - projeto que contém o dataset de billing
 *   BILLING_BQ_DATASET  - dataset do export de billing
 *   BILLING_BQ_TABLE    - tabela (ex.: gcp_billing_export_v1_XXXXXX)
 *
 * A consulta BigQuery é carregada dinamicamente para não exigir a dependência
 * em ambientes onde o billing ainda não foi habilitado.
 */
export const getCostReport = onCall<{ days?: number }>(
    { region: REGION },
    async (request) => {
        await assertPlatformAdmin(request);

        const project = process.env.BILLING_BQ_PROJECT;
        const dataset = process.env.BILLING_BQ_DATASET;
        const table = process.env.BILLING_BQ_TABLE;
        const days = Math.min(Math.max(request.data?.days || 30, 1), 365);

        if (!project || !dataset || !table) {
            return {
                status: 'not_configured',
                message:
                    'O export de faturamento para o BigQuery ainda não foi configurado. ' +
                    'Configure o Cloud Billing export e defina BILLING_BQ_PROJECT, ' +
                    'BILLING_BQ_DATASET e BILLING_BQ_TABLE para ver os custos reais.',
                byService: [],
                totalCost: 0,
                currency: null,
                periodDays: days,
            };
        }

        try {
            // Import dinâmico: só carrega a lib quando o billing está configurado.
            const { BigQuery } = await import('@google-cloud/bigquery');
            const bq = new BigQuery({ projectId: project });

            const query = `
                SELECT
                    service.description AS service,
                    SUM(cost) AS cost,
                    ANY_VALUE(currency) AS currency
                FROM \`${project}.${dataset}.${table}\`
                WHERE _PARTITIONTIME >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
                   OR usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
                GROUP BY service
                ORDER BY cost DESC
            `;

            const [rows] = await bq.query({
                query,
                params: { days },
            });

            const byService = (rows as Array<Record<string, unknown>>).map((r) => ({
                service: String(r.service ?? 'Desconhecido'),
                cost: Number(r.cost ?? 0),
                currency: (r.currency as string) ?? 'BRL',
            }));
            const totalCost = byService.reduce((sum, s) => sum + s.cost, 0);

            return {
                status: 'ok',
                byService,
                totalCost,
                currency: byService[0]?.currency || 'BRL',
                periodDays: days,
            };
        } catch (error) {
            return {
                status: 'error',
                message:
                    'Não foi possível consultar os custos no BigQuery. Verifique as permissões e a configuração do export.',
                detail: (error as Error)?.message,
                byService: [],
                totalCost: 0,
                currency: null,
                periodDays: days,
            };
        }
    }
);
