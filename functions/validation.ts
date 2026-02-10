// Validation schemas for Deno Cloud Functions
// Import in your functions with: import { z } from 'npm:zod@3.24.2';

export interface ValidationRule {
    type: 'string' | 'boolean' | 'number';
    required: boolean;
    validate?: (val: any) => string | null;
}

export interface ValidationSchema {
    [key: string]: ValidationRule;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Process Data Schema for createProcess function
 */
export const CreateProcessSchema: ValidationSchema = {
    organization_id: {
        type: 'string',
        required: true,
        validate: (val) => {
            if (!val || typeof val !== 'string') return 'organization_id é obrigatório';
            if (val.length < 1) return 'organization_id inválido';
            return null;
        }
    },
    process_number: {
        type: 'string',
        required: true,
        validate: (val) => {
            if (!val || typeof val !== 'string') return 'Número do processo é obrigatório';
            if (val.length < 1 || val.length > 100) return 'Número do processo deve ter entre 1 e 100 caracteres';
            return null;
        }
    },
    consultant: {
        type: 'string',
        required: true,
        validate: (val) => {
            if (!val || typeof val !== 'string') return 'Consulente é obrigatório';
            if (val.length < 1 || val.length > 200) return 'Consulente deve ter entre 1 e 200 caracteres';
            return null;
        }
    },
    location: {
        type: 'string',
        required: true,
        validate: (val) => {
            if (!val || typeof val !== 'string') return 'Local é obrigatório';
            if (val.length < 1 || val.length > 200) return 'Local deve ter entre 1 e 200 caracteres';
            return null;
        }
    },
    entry_date: {
        type: 'string',
        required: true,
        validate: (val) => {
            if (!val || typeof val !== 'string') return 'Data de entrada é obrigatória';
            // Validate YYYY-MM-DD format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return 'Data deve estar no formato YYYY-MM-DD';
            const date = new Date(val);
            if (isNaN(date.getTime())) return 'Data inválida';
            return null;
        }
    },
    matter_object: {
        type: 'string',
        required: false,
        validate: (val) => {
            if (val && typeof val !== 'string') return 'Objeto da matéria deve ser texto';
            if (val && val.length > 3000) return 'Objeto da matéria muito longo';
            return null;
        }
    },
    urgency_request: {
        type: 'boolean',
        required: false,
        validate: (val) => {
            if (val !== undefined && typeof val !== 'boolean') return 'Urgência deve ser true/false';
            return null;
        }
    },
    responsible_user_id: {
        type: 'string',
        required: false,
        validate: (val) => {
            if (val && typeof val !== 'string') return 'ID do responsável deve ser texto';
            return null;
        }
    }
};

/**
 * Generic validator function
 * @param {any} data - Data to validate
 * @param {ValidationSchema} schema - Validation schema
 * @returns {ValidationResult}
 */
export function validateData(data: any, schema: ValidationSchema): ValidationResult {
    const errors: string[] = [];

    // Check required fields
    for (const [field, rules] of Object.entries(schema)) {
        if (rules.required && (data[field] === undefined || data[field] === null || data[field] === '')) {
            errors.push(`Campo obrigatório ausente: ${field}`);
            continue;
        }

        // Run custom validation if field is present
        if (data[field] !== undefined && data[field] !== null && rules.validate) {
            const error = rules.validate(data[field]);
            if (error) {
                errors.push(error);
            }
        }
    }

    // Check for unexpected fields (optional - helps catch typos)
    const allowedFields = Object.keys(schema);
    for (const field of Object.keys(data)) {
        if (!allowedFields.includes(field)) {
            console.warn(`Campo inesperado encontrado: ${field}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Organization creation schema
 */
export const CreateOrganizationSchema: ValidationSchema = {
    name: {
        type: 'string',
        required: true,
        validate: (val) => {
            if (!val || typeof val !== 'string') return 'Nome da organização é obrigatório';
            if (val.length < 1 || val.length > 200) return 'Nome deve ter entre 1 e 200 caracteres';
            return null;
        }
    },
    type: {
        type: 'string',
        required: false,
        validate: (val) => {
            if (val && typeof val !== 'string') return 'Tipo deve ser texto';
            const validTypes = ['empresa', 'equipe', 'projeto', 'outro'];
            if (val && !validTypes.includes(val.toLowerCase())) {
                return `Tipo inválido. Opções: ${validTypes.join(', ')}`;
            }
            return null;
        }
    }
};

/**
 * User profile update schema
 */
export const UpdateUserProfileSchema: ValidationSchema = {
    platform_name: {
        type: 'string',
        required: false,
        validate: (val) => {
            if (val && typeof val !== 'string') return 'Nome deve ser texto';
            if (val && (val.length < 1 || val.length > 100)) return 'Nome deve ter entre 1 e 100 caracteres';
            return null;
        }
    },
    function: {
        type: 'string',
        required: false,
        validate: (val) => {
            if (val && typeof val !== 'string') return 'Função deve ser texto';
            const validFunctions = ['secretaria', 'assessoria', 'decisória', 'criador'];
            if (val && !validFunctions.includes(val.toLowerCase())) {
                return `Função inválida. Opções: ${validFunctions.join(', ')}`;
            }
            return null;
        }
    },
    notification_email: {
        type: 'string',
        required: false,
        validate: (val) => {
            if (val && typeof val !== 'string') return 'Email deve ser texto';
            // Basic email validation
            if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                return 'Email inválido';
            }
            return null;
        }
    }
};

/**
 * Import file metadata schema
 */
export const ImportFileSchema: ValidationSchema = {
    file_url: {
        type: 'string',
        required: true,
        validate: (val) => {
            if (!val || typeof val !== 'string') return 'URL do arquivo é obrigatória';
            try {
                new URL(val);
                return null;
            } catch {
                return 'URL inválida';
            }
        }
    },
    organization_id: {
        type: 'string',
        required: true,
        validate: (val) => {
            if (!val || typeof val !== 'string') return 'organization_id é obrigatório';
            return null;
        }
    }
};

/**
 * Sanitize string input - remove dangerous characters
 */
export function sanitizeString(str: any): string | any {
    if (typeof str !== 'string') return str;

    // Remove null bytes
    let sanitized = str.replace(/\0/g, '');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Remove control characters except newline and tab
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value);
        } else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}
