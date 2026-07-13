import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { hasOrgPermission, MembershipLike, OrgPermissionKey } from '../shared/permissions';

interface UpdateOrganizationRequest {
    organizationId: string;
    data: {
        name?: string;
        description?: string;
        matterSettings?: {
            custom: boolean;
            categories: string[];
            subcategories: Record<string, string[]>;
        };
        summarySettings?: Record<string, any>;
        expedienteSettings?: {
            systems: string[];
            origins: string[];
        };
        // Lista de terceiros (fase "Aguarda retorno de terceiros" do Kanban),
        // independente por painel — mesma razão de matterSettings/expedienteSettings
        // serem campos separados: permissões delegadas diferentes por painel.
        thirdPartiesSettingsConsultas?: string[];
        thirdPartiesSettingsExpedientes?: string[];
        moduleConfig?: Record<string, { enabled: boolean; order?: number }>;
        // Configuração de métricas/painel por página (Informações Gerais).
        dashboardConfig?: { pages?: Record<string, { metrics?: any[] }> };
        // Metas de conclusão por assessor (flag `assessor_goals`).
        goalsConfig?: { enabled?: boolean; targetPercent?: number; withinDays?: number };
        // Escalonamento automático de urgentes parados (flag `auto_escalation`).
        escalationConfig?: { enabled?: boolean; maxDaysStalled?: number };
        // Relatórios agendados por e-mail (flag `scheduled_email_reports`).
        reportsConfig?: { dailySummaryEnabled?: boolean; weeklyReportEnabled?: boolean };
        // Política de retenção e anonimização (flag `data_retention_policy`).
        retentionConfig?: { enabled?: boolean; anonymizeAfterDays?: number };
        // Webhooks de integração externa (flag `outbound_webhooks`).
        webhookConfig?: { enabled?: boolean; url?: string; events?: string[] };
        // Indicador de tempo na etapa atual (flag `stage_time_indicator`):
        // limiares de dias e cores do selo, personalizáveis por órgão.
        stageTimeConfig?: {
            dayType?: string;
            okMaxDays?: number;
            warnMaxDays?: number;
            colors?: { ok?: string; warn?: string; risk?: string };
        };
    };
}

export const updateOrganization = onCall<UpdateOrganizationRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { organizationId, data } = request.data;
        const requesterId = request.auth.uid;
        const db = admin.firestore();

        // 1. Verify access.
        // O CRIADOR pode tudo. Membros podem alterar apenas os campos cujas
        // permissões especiais lhes foram delegadas (ver shared/permissions.ts).
        // Memberships are stored in 'userOrganizations' collection as {userId}_{orgId}
        const membershipRef = db.collection('userOrganizations').doc(`${requesterId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();

        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'User is not a member of this organization');
        }

        const membership = membershipSnap.data() as MembershipLike;
        const isCreator = membership?.role === 'creator';

        // 2. Validate Data
        if (!organizationId) {
            throw new HttpsError('invalid-argument', 'Organization ID is required');
        }

        // Mapa: campo de dados -> permissão necessária para alterá-lo.
        // `summarySettings` permanece exclusivo do criador (não é delegável).
        const FIELD_PERMISSION: Record<string, OrgPermissionKey | null> = {
            name: 'edit_details',
            description: 'edit_details',
            matterSettings: 'manage_matters',
            expedienteSettings: 'configure_expedientes',
            thirdPartiesSettingsConsultas: 'manage_matters',
            thirdPartiesSettingsExpedientes: 'configure_expedientes',
            moduleConfig: 'manage_modules',
            dashboardConfig: 'manage_metrics',
            summarySettings: null,
            goalsConfig: null,
            escalationConfig: null,
            reportsConfig: null,
            retentionConfig: null,
            webhookConfig: null,
            stageTimeConfig: null,
        };

        if (!isCreator) {
            for (const field of Object.keys(data || {})) {
                if (data[field as keyof typeof data] === undefined) continue;
                const required = FIELD_PERMISSION[field];
                if (!required || !hasOrgPermission(membership, required)) {
                    throw new HttpsError('permission-denied', 'You do not have permission to update these settings');
                }
            }
        }

        // 3. Update Organization
        // Only allow specific fields to be updated
        const updates: any = {};
        if (data.name !== undefined) updates.name = data.name;
        if (data.description !== undefined) updates.description = data.description;
        if (data.matterSettings !== undefined) updates.matterSettings = data.matterSettings;
        if (data.summarySettings !== undefined) updates.summarySettings = data.summarySettings;
        if (data.expedienteSettings !== undefined) updates.expedienteSettings = data.expedienteSettings;
        if (data.thirdPartiesSettingsConsultas !== undefined) updates.thirdPartiesSettingsConsultas = sanitizeThirdParties(data.thirdPartiesSettingsConsultas);
        if (data.thirdPartiesSettingsExpedientes !== undefined) updates.thirdPartiesSettingsExpedientes = sanitizeThirdParties(data.thirdPartiesSettingsExpedientes);
        if (data.moduleConfig !== undefined) updates.moduleConfig = sanitizeModuleConfig(data.moduleConfig);
        if (data.dashboardConfig !== undefined) updates.dashboardConfig = sanitizeDashboardConfig(data.dashboardConfig);
        if (data.goalsConfig !== undefined) updates.goalsConfig = sanitizeGoalsConfig(data.goalsConfig);
        if (data.escalationConfig !== undefined) updates.escalationConfig = sanitizeEscalationConfig(data.escalationConfig);
        if (data.reportsConfig !== undefined) updates.reportsConfig = sanitizeReportsConfig(data.reportsConfig);
        if (data.retentionConfig !== undefined) updates.retentionConfig = sanitizeRetentionConfig(data.retentionConfig);
        if (data.webhookConfig !== undefined) updates.webhookConfig = sanitizeWebhookConfig(data.webhookConfig);
        if (data.stageTimeConfig !== undefined) updates.stageTimeConfig = sanitizeStageTimeConfig(data.stageTimeConfig);

        updates.updated_at = admin.firestore.FieldValue.serverTimestamp();

        if (Object.keys(updates).length === 0) {
            return { success: true, message: 'No changes detected' };
        }

        await db.collection('organizations').doc(organizationId).update(updates);

        // 4. Audit Log
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: requesterId,
            user_name: request.auth.token.name || 'Unknown',
            action: 'UPDATE_ORGANIZATION',
            details: {
                fields_updated: Object.keys(updates).filter(k => k !== 'updated_at')
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, message: 'Organization updated successfully' };
    }
);

// Metas de conclusão por assessor (flag `assessor_goals`): percentual-alvo de
// processos concluídos/dentro-do-prazo em até N dias úteis.
function sanitizeGoalsConfig(
    input: { enabled?: boolean; targetPercent?: number; withinDays?: number }
): { enabled: boolean; targetPercent: number; withinDays: number } {
    const targetPercent = Number(input?.targetPercent);
    const withinDays = Number(input?.withinDays);
    return {
        enabled: input?.enabled === true,
        targetPercent: Number.isFinite(targetPercent) ? Math.min(100, Math.max(1, Math.round(targetPercent))) : 80,
        withinDays: Number.isFinite(withinDays) ? Math.min(365, Math.max(1, Math.round(withinDays))) : 10,
    };
}

// Escalonamento automático de urgentes parados (flag `auto_escalation`):
// limite de dias úteis sem movimentação de um urgente antes de notificar
// criador/admins delegados além do responsável.
function sanitizeEscalationConfig(
    input: { enabled?: boolean; maxDaysStalled?: number }
): { enabled: boolean; maxDaysStalled: number } {
    const maxDaysStalled = Number(input?.maxDaysStalled);
    return {
        enabled: input?.enabled === true,
        maxDaysStalled: Number.isFinite(maxDaysStalled) ? Math.min(365, Math.max(1, Math.round(maxDaysStalled))) : 5,
    };
}

// Relatórios agendados por e-mail (flag `scheduled_email_reports`): liga/desliga
// por órgão o resumo diário e/ou o relatório semanal (o envio de fato também
// depende do provedor de e-mail estar configurado na Administração da Plataforma).
function sanitizeReportsConfig(
    input: { dailySummaryEnabled?: boolean; weeklyReportEnabled?: boolean }
): { dailySummaryEnabled: boolean; weeklyReportEnabled: boolean } {
    return {
        dailySummaryEnabled: input?.dailySummaryEnabled === true,
        weeklyReportEnabled: input?.weeklyReportEnabled === true,
    };
}

// Política de retenção e anonimização (flag `data_retention_policy`, alto
// risco): apenas liga/desliga e define o prazo — a anonimização em si
// acontece via Cloud Functions dedicadas (preview/run), nunca aqui.
function sanitizeRetentionConfig(
    input: { enabled?: boolean; anonymizeAfterDays?: number }
): { enabled: boolean; anonymizeAfterDays: number } {
    const days = Number(input?.anonymizeAfterDays);
    return {
        enabled: input?.enabled === true,
        anonymizeAfterDays: Number.isFinite(days) ? Math.min(3650, Math.max(1, Math.round(days))) : 365,
    };
}

// Indicador de tempo na etapa atual (flag `stage_time_indicator`): tipo de
// contagem de dias, limiares e cor de cada faixa de severidade — cada órgão
// define do jeito que melhor entender. Cores restritas a um preset fixo
// (mesma lista de STAGE_TIME_COLOR_PRESETS no frontend) para garantir que as
// classes Tailwind existam no bundle.
const STAGE_TIME_VALID_COLORS = new Set([
    'emerald', 'lime', 'amber', 'orange', 'rose', 'sky', 'violet', 'fuchsia', 'slate',
]);

function sanitizeStageTimeConfig(
    input: { dayType?: string; okMaxDays?: number; warnMaxDays?: number; colors?: { ok?: string; warn?: string; risk?: string } }
): { dayType: 'business' | 'calendar'; okMaxDays: number; warnMaxDays: number; colors: { ok: string; warn: string; risk: string } } {
    const dayType = input?.dayType === 'calendar' ? 'calendar' : 'business';

    const okMaxDaysRaw = Number(input?.okMaxDays);
    const okMaxDays = Number.isFinite(okMaxDaysRaw) ? Math.min(365, Math.max(1, Math.round(okMaxDaysRaw))) : 5;

    const warnMaxDaysRaw = Number(input?.warnMaxDays);
    let warnMaxDays = Number.isFinite(warnMaxDaysRaw) ? Math.min(365, Math.max(1, Math.round(warnMaxDaysRaw))) : 10;
    if (warnMaxDays <= okMaxDays) warnMaxDays = okMaxDays + 1;

    const colorOf = (value: unknown, fallback: string): string =>
        typeof value === 'string' && STAGE_TIME_VALID_COLORS.has(value) ? value : fallback;

    return {
        dayType,
        okMaxDays,
        warnMaxDays,
        colors: {
            ok: colorOf(input?.colors?.ok, 'emerald'),
            warn: colorOf(input?.colors?.warn, 'amber'),
            risk: colorOf(input?.colors?.risk, 'rose'),
        },
    };
}

const WEBHOOK_VALID_EVENTS = new Set(['urgent_created', 'archived']);

// Webhooks de integração externa (flag `outbound_webhooks`).
function sanitizeWebhookConfig(
    input: { enabled?: boolean; url?: string; events?: string[] }
): { enabled: boolean; url: string; events: string[] } {
    const url = String(input?.url || '').trim().slice(0, 500);
    const validUrl = /^https:\/\/.+/.test(url) ? url : '';
    // Sem fallback para "todos" quando vazio: um array vazio é uma escolha
    // válida e explícita do admin (desmarcou todos os eventos), não deve ser
    // silenciosamente substituído.
    const events = (Array.isArray(input?.events) ? input.events : [])
        .filter((e) => WEBHOOK_VALID_EVENTS.has(e));
    return {
        enabled: input?.enabled === true && Boolean(validUrl),
        url: validUrl,
        events,
    };
}

// Lista de terceiros (fase "Aguarda retorno de terceiros" do Kanban): apenas
// strings não-vazias, aparadas, deduplicadas e limitadas em tamanho/contagem.
function sanitizeThirdParties(input: unknown): string[] {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of input) {
        const name = String(item ?? '').trim().slice(0, 200);
        if (!name || seen.has(name)) continue;
        seen.add(name);
        out.push(name);
        if (out.length >= 100) break;
    }
    return out;
}

// Aceita apenas módulos built-in conhecidos, com booleano enabled e order numérico.
function sanitizeModuleConfig(
    input: Record<string, { enabled: boolean; order?: number }>
): Record<string, { enabled: boolean; order?: number }> {
    const allowed = ['processes', 'expedientes', 'summary'];
    const out: Record<string, { enabled: boolean; order?: number }> = {};
    for (const key of allowed) {
        const entry = input?.[key];
        if (entry && typeof entry === 'object') {
            out[key] = {
                enabled: entry.enabled === true,
                ...(typeof entry.order === 'number' ? { order: entry.order } : {}),
            };
        }
    }
    return out;
}

// ============================================================================
// dashboardConfig — métricas por página exibidas em "Informações Gerais".
// Estrutura: { pages: { [pageKey]: { metrics: MetricDef[] } } }
// O servidor é a fonte da verdade: tudo é saneado e limitado.
// ============================================================================
const DASH_VALID_AGGS = new Set(['count', 'sum', 'avg', 'min', 'max', 'percent']);
const DASH_VALID_OPS = new Set(['eq', 'neq', 'in', 'nin', 'gt', 'gte', 'lt', 'lte', 'filled', 'empty', 'truthy', 'falsy', 'contains']);
const DASH_VALID_FORMATS = new Set(['auto', 'number', 'currency', 'percent']);
const DASH_NO_VALUE_OPS = new Set(['filled', 'empty', 'truthy', 'falsy']);

function dashStr(v: unknown, max: number): string {
    return String(v ?? '').slice(0, max);
}

function sanitizeDashFilter(input: any): any | null {
    if (!input || typeof input !== 'object') return null;
    const field = dashStr(input.field, 60).trim();
    const op = String(input.op || '');
    if (!field || !DASH_VALID_OPS.has(op)) return null;
    const out: any = { field, op };
    if (op === 'in' || op === 'nin') {
        const arr = Array.isArray(input.value) ? input.value : [input.value];
        out.value = arr.slice(0, 50).map((x: unknown) => dashStr(x, 120));
    } else if (!DASH_NO_VALUE_OPS.has(op)) {
        const v = input.value;
        if (typeof v === 'number' && Number.isFinite(v)) out.value = v;
        else if (typeof v === 'boolean') out.value = v;
        else out.value = dashStr(v, 200);
    }
    return out;
}

function sanitizeDashMetric(input: any): any | null {
    if (!input || typeof input !== 'object') return null;
    const agg = DASH_VALID_AGGS.has(input.agg) ? input.agg : 'count';
    let size = Number(input.size);
    if (!Number.isInteger(size) || size < 1 || size > 4) size = 1;
    const needsField = ['sum', 'avg', 'min', 'max'].includes(agg);
    const filters = (Array.isArray(input.filters) ? input.filters : [])
        .slice(0, 12)
        .map(sanitizeDashFilter)
        .filter((f: any) => f !== null);
    return {
        id: dashStr(input.id, 60) || `m_${Math.random().toString(36).slice(2)}`,
        label: dashStr(input.label, 80) || 'Métrica',
        agg,
        field: needsField && input.field ? dashStr(input.field, 60) : null,
        filters,
        format: DASH_VALID_FORMATS.has(input.format) ? input.format : 'auto',
        icon: dashStr(input.icon, 40) || 'Hash',
        color: dashStr(input.color, 40) || 'indigo',
        size,
    };
}

function sanitizeDashboardConfig(input: any): { pages: Record<string, { metrics: any[] }> } {
    const out: { pages: Record<string, { metrics: any[] }> } = { pages: {} };
    const pages = input?.pages;
    if (!pages || typeof pages !== 'object') return out;
    let pageCount = 0;
    for (const key of Object.keys(pages)) {
        if (pageCount >= 50) break;
        const val = pages[key];
        if (!val || typeof val !== 'object' || !Array.isArray(val.metrics)) continue;
        const pageKey = dashStr(key, 120);
        if (!pageKey) continue;
        const metrics = val.metrics
            .slice(0, 24)
            .map(sanitizeDashMetric)
            .filter((m: any) => m !== null);
        out.pages[pageKey] = { metrics };
        pageCount += 1;
    }
    return out;
}
