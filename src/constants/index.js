// Constants for application configuration
// Use these instead of magic numbers throughout the codebase

// ========== FILE UPLOAD LIMITS ==========
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_FILE_SIZE_MB = 10;
export const MAX_IMPORT_ROWS = 5000;

// ========== BATCH PROCESSING ==========
export const DEFAULT_BATCH_SIZE = 50;
export const MIN_BATCH_SIZE = 5;
export const MAX_BATCH_SIZE = 100;

// ========== DATE PROCESSING ==========
// Excel stores dates as number of days since 1900-01-01
// But there's a quirk: Excel thinks 1900 was a leap year (it wasn't)
// So we need to offset by 25569 days to convert to Unix epoch (1970-01-01)
export const EXCEL_EPOCH_OFFSET = 25569;
export const MS_PER_DAY = 86400 * 1000; // 24 hours * 60 min * 60 sec * 1000ms

// ========== QUERY LIMITS ==========
export const DEFAULT_QUERY_LIMIT = 150;
export const MAX_QUERY_LIMIT = 500;

// ========== PROCESS STATUS ==========
export const PROCESS_STATUSES = {
    PENDENTE: 'Pendente',
    EM_ELABORACAO: 'Em elaboração',
    EM_REVISAO: 'Em revisão',
    PARA_REVISAO: 'Para revisão',
    NA_PASTA: 'Na pasta'
};

// ========== USER ROLES ==========
export const USER_ROLES = {
    CREATOR: 'creator',
    ADMIN: 'admin',
    MEMBER: 'member'
};

// ========== USER FUNCTIONS ==========
export const USER_FUNCTIONS = {
    SECRETARIA: 'secretaria',
    ASSESSORIA: 'assessoria',
    DECISORIA: 'decisória',
    CRIADOR: 'Criador'
};

// ========== PAGINATION ==========
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ========== CACHE TIMES (in milliseconds) ==========
export const CACHE_5_MINUTES = 5 * 60 * 1000;
export const CACHE_15_MINUTES = 15 * 60 * 1000;
export const CACHE_1_HOUR = 60 * 60 * 1000;
export const CACHE_1_DAY = 24 * 60 * 60 * 1000;

// ========== RETRY CONFIG ==========
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1000; // 1 second base delay

// ========== VALIDATION ==========
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_STRING_LENGTH = 500;
export const MAX_TEXT_LENGTH = 5000;
export const INVITE_CODE_LENGTH = 8;

// ========== NOTIFICATION TYPES ==========
export const NOTIFICATION_TYPES = {
    PROCESS_ASSIGNED: 'process_assigned',
    URGENT_PROCESS: 'urgent_process',
    PROCESS_UPDATED: 'process_updated',
    MEMBER_ADDED: 'member_added',
    MEMBER_REMOVED: 'member_removed'
};

// ========== AUDIT LOG ACTIONS ==========
export const AUDIT_ACTIONS = {
    CREATE_ORGANIZATION: 'CREATE_ORGANIZATION',
    CREATE_PROCESS: 'CREATE_PROCESS',
    UPDATE_PROCESS: 'UPDATE_PROCESS',
    DELETE_PROCESS: 'DELETE_PROCESS',
    ADD_MEMBER: 'ADD_MEMBER',
    REMOVE_MEMBER: 'REMOVE_MEMBER',
    UPDATE_MEMBER: 'UPDATE_MEMBER',
    IMPORT_PROCESSES: 'IMPORT_PROCESSES'
};
