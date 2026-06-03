// ============================================================================
// customEntities/transitions — avaliação das regras de mudança de fase
// ----------------------------------------------------------------------------
// v1: aprovação SÍNCRONA. Quem move o registro precisa satisfazer o requisito
// de aprovação (estar na lista de pessoas ou ter o papel exigido). O fluxo
// assíncrono (pedido pendente + várias aprovações) entra em fase posterior.
// ============================================================================

import { EntityTypeDef, Requirement, TransitionRule } from './schema';

export interface TransitionContext {
    userId: string;
    userRole: string; // creator | admin | member
}

function isEmpty(v: unknown): boolean {
    return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

function compare(op: string, left: unknown, right: unknown): boolean {
    switch (op) {
        case 'filled': return !isEmpty(left);
        case 'empty': return isEmpty(left);
        case 'eq': return String(left) === String(right);
        case 'neq': return String(left) !== String(right);
        case 'gt': return Number(left) > Number(right);
        case 'gte': return Number(left) >= Number(right);
        case 'lt': return Number(left) < Number(right);
        case 'lte': return Number(left) <= Number(right);
        case 'contains':
            if (Array.isArray(left)) return left.map(String).includes(String(right));
            return String(left ?? '').toLowerCase().includes(String(right ?? '').toLowerCase());
        default: return false;
    }
}

function evalRequirement(
    req: Requirement,
    fieldLabels: Record<string, string>,
    values: Record<string, unknown>,
    ctx: TransitionContext
): { ok: boolean; reason?: string } {
    const labelOf = (k?: string) => (k ? (fieldLabels[k] || k) : '');
    switch (req.type) {
        case 'field_required':
            if (isEmpty(values[req.field as string])) {
                return { ok: false, reason: `Preencha "${labelOf(req.field)}" para avançar.` };
            }
            return { ok: true };
        case 'min_value': {
            const n = Number(values[req.field as string]);
            if (!Number.isFinite(n) || n < Number(req.value)) {
                return { ok: false, reason: `"${labelOf(req.field)}" deve ser pelo menos ${req.value}.` };
            }
            return { ok: true };
        }
        case 'field_condition': {
            const ok = compare(String(req.operator || 'eq'), values[req.field as string], req.value);
            if (!ok) {
                return { ok: false, reason: `Condição não atendida em "${labelOf(req.field)}".` };
            }
            return { ok: true };
        }
        case 'approval': {
            if (req.mode === 'users') {
                const users = req.users || [];
                if (users.includes(ctx.userId)) return { ok: true };
                return { ok: false, reason: 'Esta mudança exige aprovação de uma pessoa autorizada.' };
            }
            const roles = req.roles && req.roles.length ? req.roles : ['creator', 'admin'];
            if (roles.includes(ctx.userRole)) return { ok: true };
            return { ok: false, reason: `Esta mudança exige aprovação de: ${roles.join(', ')}.` };
        }
        default:
            return { ok: true };
    }
}

/**
 * Encontra a regra aplicável (from específico tem prioridade sobre '*').
 */
function findRule(transitions: TransitionRule[] | undefined, from: string, to: string): TransitionRule | null {
    if (!Array.isArray(transitions)) return null;
    const exact = transitions.find((t) => t.from === from && t.to === to);
    if (exact) return exact;
    const wild = transitions.find((t) => t.from === '*' && t.to === to);
    return wild || null;
}

/**
 * Avalia se a transição de `fromPhase` para `toPhase` é permitida.
 * Se não houver regra específica, a transição é PERMITIDA (modelo aberto por
 * padrão; o admin restringe criando regras).
 */
export function evaluatePhaseTransition(
    def: EntityTypeDef,
    fromPhase: string,
    toPhase: string,
    values: Record<string, unknown>,
    ctx: TransitionContext
): { allowed: boolean; reason?: string; rule?: TransitionRule } {
    if (fromPhase === toPhase) return { allowed: true };

    const toExists = (def.phases || []).some((p) => p.key === toPhase);
    if (!toExists) return { allowed: false, reason: 'Fase de destino inexistente.' };

    const rule = findRule(def.transitions, fromPhase, toPhase);
    if (!rule || !rule.requirements || rule.requirements.length === 0) {
        return { allowed: true, rule: rule || undefined };
    }

    const fieldLabels: Record<string, string> = {};
    for (const f of def.fields || []) fieldLabels[f.key] = f.label;

    for (const req of rule.requirements) {
        const res = evalRequirement(req, fieldLabels, values, ctx);
        if (!res.ok) return { allowed: false, reason: res.reason, rule };
    }
    return { allowed: true, rule };
}
