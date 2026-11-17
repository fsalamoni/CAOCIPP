// Cotas da plataforma (platformConfig/quotas), definidas pelo super-admin em
// "Cotas e limites". Desde 17/11/2026 todas as cotas do catálogo VALEM: cada
// uma é conferida no servidor, na Function indicada em `onde`.
import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

export interface QuotaDef {
    key: string;
    label: string;
    description: string;
    onde: string;
    unit: string;
    default: number;
    min: number;
    max: number;
}

export const QUOTA_DEFS: QuotaDef[] = [
    {
        key: 'max_orgs_per_user',
        label: 'Órgãos criados por pessoa',
        description: 'Quantos órgãos uma mesma pessoa pode criar (como criadora). Super-admin não tem limite.',
        onde: 'Criar órgão',
        unit: 'órgãos',
        default: 10,
        min: 1,
        max: 1000,
    },
    {
        key: 'max_members_per_org',
        label: 'Membros por órgão',
        description: 'Quantas pessoas ativas cabem em um órgão. Ao chegar no limite, o código de convite para de aceitar entradas.',
        onde: 'Entrar por convite',
        unit: 'membros',
        default: 500,
        min: 2,
        max: 20000,
    },
    {
        key: 'max_import_rows',
        label: 'Linhas por importação',
        description: 'Máximo de linhas em uma importação de planilha. Nunca passa do teto técnico de cada importação (5.000 nos registros personalizados; 20.000 no Panorama e na Jurimetria).',
        onde: 'Importar planilha (registros personalizados, Panorama, Jurimetria)',
        unit: 'linhas',
        default: 20000,
        min: 100,
        max: 20000,
    },
];

export const QUOTA_BY_KEY: Record<string, QuotaDef> = Object.fromEntries(QUOTA_DEFS.map((q) => [q.key, q]));

// ponytail: cache por instância de 60 s; uma cota alterada vale em até 1 minuto.
let cache: { em: number; valores: Record<string, unknown> } | null = null;

export function limparCacheCotas(): void { cache = null; }

/** Valor atual da cota (ou o padrão). */
export async function lerCota(key: string, db = admin.firestore()): Promise<number> {
    const def = QUOTA_BY_KEY[key];
    if (!def) throw new Error(`Cota desconhecida: ${key}`);
    if (!cache || Date.now() - cache.em > 60000) {
        const snap = await db.collection('platformConfig').doc('quotas').get();
        cache = { em: Date.now(), valores: (snap.data()?.values as Record<string, unknown>) || {} };
    }
    const v = cache.valores[key];
    return typeof v === 'number' && v >= def.min && v <= def.max ? v : def.default;
}

/** Recusa quando `atual + somar` passa da cota. */
export async function exigirDentroDaCota(key: string, atual: number, somar = 1, db = admin.firestore()): Promise<void> {
    const limite = await lerCota(key, db);
    if (atual + somar > limite) {
        const def = QUOTA_BY_KEY[key];
        throw new HttpsError('resource-exhausted', `Limite da plataforma atingido: ${def.label.toLowerCase()} (máximo ${limite.toLocaleString('pt-BR')} ${def.unit}). Fale com a administração do SIGO.`);
    }
}

/** Limite de linhas de uma importação: a cota, sem passar do teto técnico dela. */
export async function limiteImportacao(teto: number, db = admin.firestore()): Promise<number> {
    return Math.min(teto, await lerCota('max_import_rows', db));
}
