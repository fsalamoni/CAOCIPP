// ============================================================================
// customEntities/schema — definição + validação (autoridade do servidor)
// ----------------------------------------------------------------------------
// Tipos de campo suportados (v1):
//   text, textarea, number, currency, date, boolean, select, multiselect,
//   user_ref (membro do órgão), city (lista RS), link.
// O cliente espelha estas regras para UX; o SERVIDOR é a fonte da verdade.
// ============================================================================

export type FieldType =
    | 'text'
    | 'textarea'
    | 'number'
    | 'currency'
    | 'date'
    | 'boolean'
    | 'select'
    | 'multiselect'
    | 'user_ref'
    | 'city'
    | 'link';

export const FIELD_TYPES: FieldType[] = [
    'text', 'textarea', 'number', 'currency', 'date', 'boolean',
    'select', 'multiselect', 'user_ref', 'city', 'link',
];

export interface FieldOption {
    value: string;
    label: string;
    color?: string;
}

export interface FieldValidation {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
}

export interface FieldDef {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    help?: string;
    options?: FieldOption[];
    default?: unknown;
    validation?: FieldValidation;
    table?: { show?: boolean; order?: number; width?: number };
    form?: { show?: boolean; section?: string; order?: number };
    // Fase (aba) à qual esta coluna pertence no formulário com abas-por-fase.
    phase?: string;
    // Quando true, esta coluna precisa estar preenchida para o registro SAIR da
    // sua fase (requisito implícito de avanço, avaliado no servidor).
    required_to_advance?: boolean;
}

export interface PhaseDef {
    key: string;
    label: string;
    description?: string;
    color?: string;
    order?: number;
    is_initial?: boolean;
    is_final?: boolean;
    wip_limit?: number;
}

// Regra de correspondência usada na importação de planilhas: associa uma coluna
// da plataforma (field_key) a uma coluna da planilha — por nome de cabeçalho
// ("name") ou pela letra da coluna ("letter": A, B, C...).
export interface ImportMapping {
    field_key: string;
    source: 'name' | 'letter';
    match: string;
}

// Tipo de processo: categorias que compartilham o MESMO trâmite (fases), mas
// se distinguem por cor/rótulo (ex.: "Consulta", "Representação"). Opcional.
export interface RecordTypeDef {
    key: string;
    label: string;
    color?: string;
}

export type RequirementType = 'field_required' | 'field_condition' | 'min_value' | 'approval';
export type ConditionOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'filled' | 'empty';

export interface Requirement {
    type: RequirementType;
    field?: string;
    operator?: ConditionOperator;
    value?: unknown;
    // approval
    mode?: 'roles' | 'users';
    roles?: string[];
    users?: string[];
    count?: number;
}

export interface TransitionRule {
    id?: string;
    from: string; // phaseKey ou '*'
    to: string;   // phaseKey
    requirements?: Requirement[];
    on_success?: {
        set_fields?: { field: string; value: unknown }[];
        require_comment?: boolean;
    };
}

export interface EntityTypeDef {
    id?: string;
    organization_id?: string;
    key?: string;
    label_singular: string;
    label_plural: string;
    icon?: string;
    color?: string;
    order?: number;
    enabled?: boolean;
    fields: FieldDef[];
    phases: PhaseDef[];
    transitions?: TransitionRule[];
    form_layout?: { sections?: { title: string; field_keys: string[] }[] };
    table_layout?: { columns?: { field_key: string; width?: number; order?: number }[]; default_sort?: { field_key: string; dir: 'asc' | 'desc' } };
    kpi_config?: { cards?: any[]; charts?: any[] };
    // Modo do formulário de criar/editar: 'tabs' (uma aba por fase), 'sections'
    // (seções por form_layout) ou 'single' (lista única). Quando ausente, o
    // cliente decide automaticamente (abas se houver colunas atribuídas a fases).
    form_mode?: 'tabs' | 'sections' | 'single';
    // Regras de importação de planilha salvas com o tipo (reutilizáveis).
    import_mappings?: ImportMapping[];
    // Tipos de processo (categorias coloridas) que seguem o mesmo trâmite.
    record_types?: RecordTypeDef[];
}

const SLUG_RE = /^[a-z][a-z0-9_]{0,39}$/;

function isPlainString(v: unknown): v is string {
    return typeof v === 'string';
}

function toNumberOrNull(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/**
 * Sanitiza/valida uma definição de tipo de entidade vinda do cliente.
 * Lança Error com mensagem amigável quando inválida.
 */
export function sanitizeEntityTypeDefinition(input: any): EntityTypeDef {
    if (!input || typeof input !== 'object') {
        throw new Error('Definição inválida.');
    }

    const label_singular = String(input.label_singular || '').trim();
    const label_plural = String(input.label_plural || '').trim();
    if (!label_singular || !label_plural) {
        throw new Error('Informe o nome no singular e no plural.');
    }

    const rawFields = Array.isArray(input.fields) ? input.fields : [];
    if (rawFields.length === 0) {
        throw new Error('Crie pelo menos um campo.');
    }

    const seenKeys = new Set<string>();
    const fields: FieldDef[] = rawFields.map((f: any, idx: number) => {
        const key = String(f?.key || '').trim();
        if (!SLUG_RE.test(key)) {
            throw new Error(`Chave de campo inválida: "${key}". Use apenas letras minúsculas, números e _ (começando por letra).`);
        }
        if (seenKeys.has(key)) {
            throw new Error(`Chave de campo duplicada: "${key}".`);
        }
        seenKeys.add(key);

        const type = String(f?.type || '') as FieldType;
        if (!FIELD_TYPES.includes(type)) {
            throw new Error(`Tipo de campo inválido: "${type}".`);
        }

        const label = String(f?.label || '').trim();
        if (!label) {
            throw new Error(`O campo "${key}" precisa de um rótulo.`);
        }

        let options: FieldOption[] | undefined;
        if (type === 'select' || type === 'multiselect') {
            const rawOpts = Array.isArray(f?.options) ? f.options : [];
            options = rawOpts
                .map((o: any) => ({
                    value: String(o?.value ?? o?.label ?? '').trim(),
                    label: String(o?.label ?? o?.value ?? '').trim(),
                    ...(o?.color ? { color: String(o.color) } : {}),
                }))
                .filter((o: FieldOption) => o.value !== '');
            if (!options || options.length === 0) {
                throw new Error(`O campo de lista "${label}" precisa de pelo menos uma opção.`);
            }
        }

        const validation: FieldValidation = {};
        if (f?.validation && typeof f.validation === 'object') {
            const v = f.validation;
            const min = toNumberOrNull(v.min); if (min !== null) validation.min = min;
            const max = toNumberOrNull(v.max); if (max !== null) validation.max = max;
            const minLength = toNumberOrNull(v.minLength); if (minLength !== null) validation.minLength = minLength;
            const maxLength = toNumberOrNull(v.maxLength); if (maxLength !== null) validation.maxLength = maxLength;
            if (isPlainString(v.pattern) && v.pattern) validation.pattern = v.pattern;
        }

        const out: FieldDef = {
            key,
            label,
            type,
            required: f?.required === true,
            ...(f?.help ? { help: String(f.help) } : {}),
            ...(options ? { options } : {}),
            ...(f?.default !== undefined ? { default: f.default } : {}),
            ...(Object.keys(validation).length ? { validation } : {}),
            table: {
                show: f?.table?.show !== false,
                order: toNumberOrNull(f?.table?.order) ?? idx,
                ...(toNumberOrNull(f?.table?.width) !== null ? { width: toNumberOrNull(f?.table?.width) as number } : {}),
            },
            form: {
                show: f?.form?.show !== false,
                ...(f?.form?.section ? { section: String(f.form.section) } : {}),
                order: toNumberOrNull(f?.form?.order) ?? idx,
            },
            // Atribuição de fase + requisito de avanço (validados após as fases).
            ...(f?.phase ? { phase: String(f.phase).trim() } : {}),
            ...(f?.required_to_advance === true ? { required_to_advance: true } : {}),
        };
        return out;
    });

    const rawPhases = Array.isArray(input.phases) ? input.phases : [];
    if (rawPhases.length === 0) {
        throw new Error('Crie pelo menos uma fase (coluna do painel).');
    }
    const seenPhase = new Set<string>();
    const phases: PhaseDef[] = rawPhases.map((p: any, idx: number) => {
        const key = String(p?.key || '').trim();
        if (!SLUG_RE.test(key)) {
            throw new Error(`Chave de fase inválida: "${key}".`);
        }
        if (seenPhase.has(key)) {
            throw new Error(`Chave de fase duplicada: "${key}".`);
        }
        seenPhase.add(key);
        const label = String(p?.label || '').trim();
        if (!label) {
            throw new Error(`A fase "${key}" precisa de um rótulo.`);
        }
        return {
            key,
            label,
            ...(p?.description ? { description: String(p.description).trim().slice(0, 2000) } : {}),
            ...(p?.color ? { color: String(p.color) } : {}),
            order: toNumberOrNull(p?.order) ?? idx,
            is_initial: p?.is_initial === true,
            is_final: p?.is_final === true,
            ...(toNumberOrNull(p?.wip_limit) !== null ? { wip_limit: toNumberOrNull(p?.wip_limit) as number } : {}),
        };
    });
    // Garante exatamente uma fase inicial (a primeira se nenhuma marcada).
    if (!phases.some((p) => p.is_initial)) {
        phases[0].is_initial = true;
    }

    const fieldKeySet = new Set(fields.map((f) => f.key));
    const phaseKeySet = new Set(phases.map((p) => p.key));

    // Limpa referências de fase inválidas nas colunas (fase pode ter sido
    // renomeada/removida). Mantém o vínculo apenas quando a fase existe.
    for (const f of fields) {
        if (f.phase && !phaseKeySet.has(f.phase)) {
            delete f.phase;
            if (f.required_to_advance) delete f.required_to_advance;
        }
    }

    const rawTransitions = Array.isArray(input.transitions) ? input.transitions : [];
    const transitions: TransitionRule[] = rawTransitions.map((t: any, idx: number) => {
        const from = String(t?.from || '*').trim() || '*';
        const to = String(t?.to || '').trim();
        if (!phaseKeySet.has(to)) {
            throw new Error(`Regra de transição inválida: fase de destino "${to}" não existe.`);
        }
        if (from !== '*' && !phaseKeySet.has(from)) {
            throw new Error(`Regra de transição inválida: fase de origem "${from}" não existe.`);
        }
        const reqs: Requirement[] = Array.isArray(t?.requirements) ? t.requirements.map((r: any) => {
            const type = String(r?.type || '') as RequirementType;
            if (!['field_required', 'field_condition', 'min_value', 'approval'].includes(type)) {
                throw new Error('Tipo de requisito inválido em uma regra de transição.');
            }
            if ((type === 'field_required' || type === 'field_condition' || type === 'min_value')) {
                const field = String(r?.field || '').trim();
                if (!fieldKeySet.has(field)) {
                    throw new Error(`Regra de transição referencia campo inexistente: "${field}".`);
                }
                const req: Requirement = { type, field };
                if (type === 'field_condition') {
                    req.operator = (String(r?.operator || 'eq') as ConditionOperator);
                    req.value = r?.value;
                }
                if (type === 'min_value') {
                    req.value = toNumberOrNull(r?.value) ?? 0;
                }
                return req;
            }
            // approval
            const mode = r?.mode === 'users' ? 'users' : 'roles';
            const req: Requirement = {
                type: 'approval',
                mode,
                count: toNumberOrNull(r?.count) ?? 1,
            };
            if (mode === 'users') {
                req.users = Array.isArray(r?.users) ? r.users.map((u: any) => String(u)).filter(Boolean) : [];
            } else {
                req.roles = Array.isArray(r?.roles) && r.roles.length
                    ? r.roles.map((u: any) => String(u)).filter(Boolean)
                    : ['creator', 'admin'];
            }
            return req;
        }) : [];

        return {
            id: String(t?.id || `t_${idx}`),
            from,
            to,
            ...(reqs.length ? { requirements: reqs } : {}),
            ...(t?.on_success ? { on_success: sanitizeOnSuccess(t.on_success, fieldKeySet) } : {}),
        };
    });

    const out: EntityTypeDef = {
        label_singular,
        label_plural,
        ...(input.key && SLUG_RE.test(String(input.key)) ? { key: String(input.key) } : {}),
        ...(input.icon ? { icon: String(input.icon) } : {}),
        ...(input.color ? { color: String(input.color) } : {}),
        ...(toNumberOrNull(input.order) !== null ? { order: toNumberOrNull(input.order) as number } : {}),
        enabled: input.enabled !== false,
        fields,
        phases,
        ...(transitions.length ? { transitions } : {}),
        ...(['tabs', 'sections', 'single'].includes(String(input.form_mode)) ? { form_mode: input.form_mode } : {}),
        ...(input.form_layout ? { form_layout: sanitizeFormLayout(input.form_layout, fieldKeySet) } : {}),
        ...(input.table_layout ? { table_layout: sanitizeTableLayout(input.table_layout, fieldKeySet) } : {}),
        ...(input.import_mappings ? { import_mappings: sanitizeImportMappings(input.import_mappings, fieldKeySet) } : {}),
        // Sempre presente (mesmo vazio) para permitir limpar a lista com merge.
        record_types: sanitizeRecordTypes(input.record_types),
        ...(input.kpi_config ? { kpi_config: sanitizeKpiConfig(input.kpi_config) } : {}),
    };
    return out;
}

function sanitizeRecordTypes(input: any): RecordTypeDef[] {
    const arr = Array.isArray(input) ? input : [];
    const seen = new Set<string>();
    const out: RecordTypeDef[] = [];
    arr.forEach((t: any, idx: number) => {
        const label = String(t?.label || '').trim();
        if (!label) return;
        let key = String(t?.key || '').trim();
        if (!SLUG_RE.test(key)) key = `t_${idx}`;
        if (seen.has(key)) key = `${key}_${idx}`;
        seen.add(key);
        out.push({
            key,
            label,
            ...(t?.color ? { color: String(t.color) } : {}),
        });
    });
    return out;
}

function sanitizeImportMappings(input: any, fieldKeySet: Set<string>): ImportMapping[] {
    const arr = Array.isArray(input) ? input : [];
    return arr
        .map((m: any): ImportMapping => ({
            field_key: String(m?.field_key || '').trim(),
            source: m?.source === 'letter' ? 'letter' : 'name',
            match: String(m?.match ?? '').trim(),
        }))
        .filter((m) => fieldKeySet.has(m.field_key) && m.match !== '');
}

function sanitizeOnSuccess(input: any, fieldKeySet: Set<string>): TransitionRule['on_success'] {
    const out: TransitionRule['on_success'] = {};
    if (Array.isArray(input?.set_fields)) {
        out.set_fields = input.set_fields
            .map((s: any) => ({ field: String(s?.field || '').trim(), value: s?.value }))
            .filter((s: any) => fieldKeySet.has(s.field));
    }
    if (input?.require_comment === true) out.require_comment = true;
    return out;
}

function sanitizeFormLayout(input: any, fieldKeySet: Set<string>) {
    const sections = Array.isArray(input?.sections) ? input.sections : [];
    return {
        sections: sections.map((s: any) => ({
            title: String(s?.title || '').trim(),
            field_keys: (Array.isArray(s?.field_keys) ? s.field_keys : [])
                .map((k: any) => String(k))
                .filter((k: string) => fieldKeySet.has(k)),
        })),
    };
}

function sanitizeTableLayout(input: any, fieldKeySet: Set<string>) {
    const columns = Array.isArray(input?.columns) ? input.columns : [];
    const out: any = {
        columns: columns
            .map((c: any, i: number) => ({
                field_key: String(c?.field_key || ''),
                order: toNumberOrNull(c?.order) ?? i,
                ...(toNumberOrNull(c?.width) !== null ? { width: toNumberOrNull(c?.width) } : {}),
            }))
            .filter((c: any) => fieldKeySet.has(c.field_key)),
    };
    if (input?.default_sort?.field_key && fieldKeySet.has(String(input.default_sort.field_key))) {
        out.default_sort = {
            field_key: String(input.default_sort.field_key),
            dir: input.default_sort.dir === 'asc' ? 'asc' : 'desc',
        };
    }
    return out;
}

function sanitizeKpiConfig(input: any) {
    return {
        cards: Array.isArray(input?.cards) ? input.cards.slice(0, 12) : [],
        charts: Array.isArray(input?.charts) ? input.charts.slice(0, 8) : [],
    };
}

function isEmptyValue(v: unknown): boolean {
    return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

/**
 * Valida e normaliza um conjunto de valores contra os campos definidos.
 * Retorna { ok, errors, normalized }.
 */
export function validateRecordValues(
    fields: FieldDef[],
    values: Record<string, unknown>,
    opts: { partial?: boolean; requiredPhases?: Set<string> | null } = {}
): { ok: boolean; errors: Record<string, string>; normalized: Record<string, unknown> } {
    const errors: Record<string, string> = {};
    const normalized: Record<string, unknown> = {};
    const input = values && typeof values === 'object' ? values : {};

    // Uma coluna atribuída a uma fase só é "obrigatória" quando essa fase já foi
    // alcançada. Sem restrição (requiredPhases ausente) ou coluna sem fase →
    // comportamento legado (obrigatoriedade global).
    const phaseRequired = (field: FieldDef) =>
        !opts.requiredPhases || !field.phase || opts.requiredPhases.has(field.phase);

    for (const field of fields) {
        const provided = Object.prototype.hasOwnProperty.call(input, field.key);
        if (opts.partial && !provided) continue;

        const raw = input[field.key];

        if (isEmptyValue(raw)) {
            if (field.required && !opts.partial && phaseRequired(field)) {
                errors[field.key] = `${field.label} é obrigatório.`;
            }
            normalized[field.key] = field.type === 'multiselect' ? [] : (field.type === 'boolean' ? false : null);
            continue;
        }

        switch (field.type) {
            case 'text':
            case 'textarea':
            case 'city':
            case 'user_ref':
            case 'link': {
                const s = String(raw);
                if (field.validation?.minLength && s.length < field.validation.minLength) {
                    errors[field.key] = `${field.label}: mínimo de ${field.validation.minLength} caracteres.`;
                }
                if (field.validation?.maxLength && s.length > field.validation.maxLength) {
                    errors[field.key] = `${field.label}: máximo de ${field.validation.maxLength} caracteres.`;
                }
                if (field.validation?.pattern) {
                    try {
                        if (!new RegExp(field.validation.pattern).test(s)) {
                            errors[field.key] = `${field.label}: formato inválido.`;
                        }
                    } catch { /* pattern inválido ignora */ }
                }
                if (field.type === 'link' && s && !/^(https?:\/\/|\/|\\\\|[a-zA-Z]:\\)/.test(s)) {
                    // aceita URLs http(s) ou caminhos de rede/arquivo; senão apenas guarda.
                }
                normalized[field.key] = s;
                break;
            }
            case 'number':
            case 'currency': {
                const n = Number(raw);
                if (!Number.isFinite(n)) {
                    errors[field.key] = `${field.label}: informe um número válido.`;
                    break;
                }
                if (field.validation?.min !== undefined && n < field.validation.min) {
                    errors[field.key] = `${field.label}: valor mínimo é ${field.validation.min}.`;
                }
                if (field.validation?.max !== undefined && n > field.validation.max) {
                    errors[field.key] = `${field.label}: valor máximo é ${field.validation.max}.`;
                }
                normalized[field.key] = n;
                break;
            }
            case 'date': {
                const s = String(raw);
                if (!/^\d{4}-\d{2}-\d{2}/.test(s)) {
                    errors[field.key] = `${field.label}: data inválida.`;
                }
                normalized[field.key] = s.slice(0, 10);
                break;
            }
            case 'boolean': {
                normalized[field.key] = raw === true || raw === 'true';
                break;
            }
            case 'select': {
                const allowed = new Set((field.options || []).map((o) => o.value));
                const s = String(raw);
                if (!allowed.has(s)) {
                    errors[field.key] = `${field.label}: opção inválida.`;
                }
                normalized[field.key] = s;
                break;
            }
            case 'multiselect': {
                const allowed = new Set((field.options || []).map((o) => o.value));
                const arr = Array.isArray(raw) ? raw.map((x) => String(x)) : [String(raw)];
                const invalid = arr.filter((x) => !allowed.has(x));
                if (invalid.length) {
                    errors[field.key] = `${field.label}: opção(ões) inválida(s).`;
                }
                normalized[field.key] = arr;
                break;
            }
            default:
                normalized[field.key] = raw;
        }
    }

    return { ok: Object.keys(errors).length === 0, errors, normalized };
}
