// ============================================================================
// customEntityForm — agrupamento de campos para o formulário de registro
// ----------------------------------------------------------------------------
// Decide como o modal de criar/editar deve ser montado:
//   - 'tabs'     : uma aba por fase; cada coluna aparece na aba da sua fase
//   - 'sections' : seções definidas em form_layout.sections (legado)
//   - 'single'   : lista única de campos (legado)
// A escolha respeita entityType.form_mode quando definido; senão é automática
// (abas quando há colunas atribuídas a fases).
// ============================================================================

import { validateFieldValue, isEmptyValue } from '@/lib/fieldTypes';

const byFormOrder = (a, b) => (a.form?.order ?? 0) - (b.form?.order ?? 0);

/** Campos visíveis no formulário, na ordem definida. */
export function visibleFormFields(entityType) {
    return (entityType?.fields || [])
        .filter((f) => f.form?.show !== false)
        .slice()
        .sort(byFormOrder);
}

/** Fases ordenadas. */
export function orderedPhases(entityType) {
    return (entityType?.phases || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** True quando ao menos uma coluna visível está atribuída a uma fase existente. */
export function hasPhaseAssignments(entityType) {
    const phaseKeys = new Set((entityType?.phases || []).map((p) => p.key));
    return (entityType?.fields || []).some((f) => f.phase && phaseKeys.has(f.phase));
}

/**
 * Monta os grupos do formulário.
 * @returns {{ mode, tabs, sections, fields }}
 */
export function resolveFormGroups(entityType) {
    const fields = visibleFormFields(entityType);
    const phases = orderedPhases(entityType);
    const phaseKeys = new Set(phases.map((p) => p.key));

    const explicit = entityType?.form_mode;
    const auto = hasPhaseAssignments(entityType) && phases.length > 0
        ? 'tabs'
        : (entityType?.form_layout?.sections?.length ? 'sections' : 'single');
    const mode = explicit && ['tabs', 'sections', 'single'].includes(explicit) ? explicit : auto;

    if (mode === 'tabs') {
        const byPhase = {};
        const unassigned = [];
        for (const f of fields) {
            if (f.phase && phaseKeys.has(f.phase)) {
                (byPhase[f.phase] = byPhase[f.phase] || []).push(f);
            } else {
                unassigned.push(f);
            }
        }
        const tabs = [];
        if (unassigned.length) {
            tabs.push({ key: '_geral', label: 'Geral', color: null, description: '', fields: unassigned });
        }
        for (const p of phases) {
            const pf = byPhase[p.key] || [];
            if (pf.length === 0 && explicit !== 'tabs') continue; // oculta fases vazias no modo automático
            tabs.push({
                key: p.key,
                label: p.label,
                color: p.color || null,
                description: p.description || '',
                fields: pf,
            });
        }
        return { mode: 'tabs', tabs, sections: [], fields };
    }

    if (mode === 'sections') {
        const fieldByKey = Object.fromEntries(fields.map((f) => [f.key, f]));
        const sections = (entityType?.form_layout?.sections || []).map((sec) => ({
            title: sec.title || '',
            fields: (sec.field_keys || []).map((k) => fieldByKey[k]).filter(Boolean),
        }));
        return { mode: 'sections', tabs: [], sections, fields };
    }

    return { mode: 'single', tabs: [], sections: [], fields };
}

/**
 * Fases já "alcançadas" para fins de obrigatoriedade no formulário.
 *   - criação (sem record): apenas a fase inicial.
 *   - edição: todas as fases com ordem <= a da fase atual do registro.
 * Retorna null quando não há fases (sem restrição → obrigatoriedade global).
 */
export function computeActivePhaseKeys(entityType, record) {
    const phases = orderedPhases(entityType);
    if (!phases.length) return null;
    if (!record) {
        const initial = phases.find((p) => p.is_initial) || phases[0];
        return new Set(initial ? [initial.key] : []);
    }
    const cur = phases.find((p) => p.key === record.phase) || phases[0];
    const curOrder = cur?.order ?? 0;
    return new Set(phases.filter((p) => (p.order ?? 0) <= curOrder).map((p) => p.key));
}

/**
 * Validação do formulário ciente de fases: só cobra colunas obrigatórias das
 * fases já alcançadas; colunas sem fase mantêm obrigatoriedade global. O tipo
 * é sempre validado quando há valor preenchido.
 */
export function validatePhaseAwareValues(entityType, values, record) {
    const fields = entityType?.fields || [];
    const active = computeActivePhaseKeys(entityType, record);
    const errors = {};
    for (const f of fields) {
        const v = values?.[f.key];
        if (isEmptyValue(v)) {
            const isActive = !active || !f.phase || active.has(f.phase);
            if (f.required && isActive) errors[f.key] = `${f.label} é obrigatório.`;
            continue;
        }
        const err = validateFieldValue({ ...f, required: false }, v);
        if (err) errors[f.key] = err;
    }
    return { ok: Object.keys(errors).length === 0, errors };
}
