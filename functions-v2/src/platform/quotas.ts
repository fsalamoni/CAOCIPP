import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';

const PLATFORM_CONFIG = 'platformConfig';
const QUOTAS_DOC = 'quotas';

/**
 * Catálogo de cotas configuráveis (Onda 3).
 *
 * IMPORTANTE (zero quebra): estes valores são apenas CONFIGURAÇÃO.
 * Nenhuma cota é imposta automaticamente neste momento — a aplicação continua
 * com o comportamento atual. Cada limite só passa a valer quando a
 * funcionalidade correspondente (já existente ou futura) decidir consultá-lo.
 * Assim, gravar cotas nunca pode quebrar nada que funciona hoje.
 *
 * `min`/`max` apenas validam a entrada do super-admin (evita valores absurdos).
 */
interface QuotaDef {
    key: string;
    label: string;
    description: string;
    unit: string;
    default: number;
    min: number;
    max: number;
}

const QUOTA_DEFS: QuotaDef[] = [
    {
        key: 'max_import_rows',
        label: 'Tamanho máximo de importação',
        description:
            'Quantidade máxima de linhas aceitas em uma única importação de planilha.',
        unit: 'linhas',
        default: 5000,
        min: 100,
        max: 200000,
    },
    {
        key: 'default_page_size',
        label: 'Tamanho padrão de página',
        description:
            'Quantidade de itens carregados por página nas listagens (quando a paginação no banco estiver ativa).',
        unit: 'itens',
        default: 50,
        min: 10,
        max: 500,
    },
    {
        key: 'audit_log_retention_days',
        label: 'Retenção de auditoria',
        description:
            'Por quantos dias os registros de auditoria globais devem ser mantidos (informativo; a limpeza só ocorre se/quando uma rotina de expurgo for ativada).',
        unit: 'dias',
        default: 365,
        min: 30,
        max: 3650,
    },
    {
        key: 'activity_log_max_entries',
        label: 'Máximo de entradas no histórico do documento',
        description:
            'Tamanho recomendado máximo do histórico (activity_log) embutido em cada documento antes de migrar para subcoleção.',
        unit: 'entradas',
        default: 200,
        min: 20,
        max: 2000,
    },
    {
        key: 'max_listeners_per_session',
        label: 'Máximo de ouvintes em tempo real por sessão',
        description:
            'Limite recomendado de listeners simultâneos do Firestore por sessão de usuário.',
        unit: 'ouvintes',
        default: 20,
        min: 3,
        max: 200,
    },
];

const QUOTA_BY_KEY: Record<string, QuotaDef> = QUOTA_DEFS.reduce(
    (acc, q) => {
        acc[q.key] = q;
        return acc;
    },
    {} as Record<string, QuotaDef>
);

interface QuotasResponse {
    quotas: Record<string, number>;
    definitions: QuotaDef[];
    updatedAt: string | null;
    updatedBy: string | null;
}

/**
 * getPlatformQuotas - Lê as cotas configuradas, mesclando com os padrões.
 * Apenas super-admin.
 */
export const getPlatformQuotas = onCall<void>(
    { region: REGION },
    async (request): Promise<QuotasResponse> => {
        await assertPlatformAdmin(request);
        const db = admin.firestore();
        const snap = await db.collection(PLATFORM_CONFIG).doc(QUOTAS_DOC).get();

        const stored = (snap.exists && snap.data()?.values) || {};
        // Mescla: padrão para qualquer cota ainda não definida.
        const quotas: Record<string, number> = {};
        QUOTA_DEFS.forEach((def) => {
            const v = stored[def.key];
            quotas[def.key] = typeof v === 'number' ? v : def.default;
        });

        const data = snap.data() || {};
        const updatedAt = data.updated_at?.toDate
            ? data.updated_at.toDate().toISOString()
            : null;

        return {
            quotas,
            definitions: QUOTA_DEFS,
            updatedAt,
            updatedBy: data.updated_by || null,
        };
    }
);

interface SetQuotaRequest {
    quotaKey: string;
    value: number;
}

/**
 * setPlatformQuota - Define UMA cota.
 * Escrita exclusiva de super-admin, com auditoria. Usa merge (aditivo).
 */
export const setPlatformQuota = onCall<SetQuotaRequest>(
    { region: REGION },
    async (request) => {
        const actor = await assertPlatformAdmin(request);
        const { quotaKey, value } = request.data || ({} as SetQuotaRequest);

        const def = QUOTA_BY_KEY[quotaKey];
        if (!def) {
            throw new HttpsError('invalid-argument', 'Cota desconhecida.');
        }
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            throw new HttpsError('invalid-argument', 'Valor inválido.');
        }
        const intValue = Math.round(value);
        if (intValue < def.min || intValue > def.max) {
            throw new HttpsError(
                'invalid-argument',
                `Valor deve estar entre ${def.min} e ${def.max}.`
            );
        }

        const db = admin.firestore();
        const ref = db.collection(PLATFORM_CONFIG).doc(QUOTAS_DOC);

        await ref.set(
            {
                values: { [quotaKey]: intValue },
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_by: actor.name,
                updated_by_uid: actor.uid,
            },
            { merge: true }
        );

        await writePlatformAudit(actor.uid, actor.name, 'SET_PLATFORM_QUOTA', {
            quotaKey,
            value: intValue,
        });

        return { success: true, quotaKey, value: intValue };
    }
);
