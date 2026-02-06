// Utility for consistent logging across the application
// Prevents console output in production and provides structured logging

const isDevelopment = import.meta.env.DEV;

/**
 * Logger utility that only logs in development environment
 * In production, errors should be sent to monitoring service (e.g., Sentry, LogRocket)
 */
export const logger = {
    /**
     * Log error messages
     * @param {...any} args - Arguments to log
     */
    error: (...args) => {
        if (isDevelopment) {
            console.error('[ERROR]', ...args);
        }
        // TODO: Send to error monitoring service in production
        // Example: Sentry.captureException(args[0]);
    },

    /**
     * Log warning messages
     * @param {...any} args - Arguments to log
     */
    warn: (...args) => {
        if (isDevelopment) {
            console.warn('[WARN]', ...args);
        }
    },

    /**
     * Log info messages (development only)
     * @param {...any} args - Arguments to log
     */
    info: (...args) => {
        if (isDevelopment) {
            console.log('[INFO]', ...args);
        }
    },

    /**
     * Log debug messages (development only)
     * @param {...any} args - Arguments to log
     */
    debug: (...args) => {
        if (isDevelopment) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Log success messages (development only)
     * @param {...any} args - Arguments to log
     */
    success: (...args) => {
        if (isDevelopment) {
            console.log('[SUCCESS] ✓', ...args);
        }
    }
};

/**
 * Format error for user display
 * @param {Error | unknown} error - The error to format
 * @returns {string} User-friendly error message
 */
export function formatErrorMessage(error) {
    if (!error) return 'Erro desconhecido';

    // Network errors
    if (!navigator.onLine) {
        return 'Sem conexão com a internet. Verifique sua conexão e tente novamente.';
    }

    // HTTP errors
    if (error.status) {
        switch (error.status) {
            case 401:
                return 'Sessão expirada. Por favor, faça login novamente.';
            case 403:
                return 'Você não tem permissão para realizar esta ação.';
            case 404:
                return 'Recurso não encontrado.';
            case 413:
                return error.response?.data?.details || 'Arquivo muito grande.';
            case 422:
                return 'Dados inválidos. Verifique os campos e tente novamente.';
            case 429:
                return 'Muitas requisições. Aguarde um momento e tente novamente.';
            case 500:
            case 502:
            case 503:
                return 'Erro no servidor. Tente novamente em alguns instantes.';
            default:
                return error.response?.data?.error || error.message || 'Erro ao processar requisição.';
        }
    }

    // JavaScript errors
    if (error instanceof Error) {
        return error.message;
    }

    // Generic fallback
    return String(error);
}

/**
 * Categorize error for handling logic
 * @param {Error | unknown} error - The error to categorize
 * @returns {object} Error category and details
 */
export function categorizeError(error) {
    const category = {
        type: 'unknown',
        isNetwork: false,
        isAuth: false,
        isValidation: false,
        isServer: false,
        shouldRetry: false,
        shouldRedirect: false,
        redirectPath: null
    };

    if (!navigator.onLine) {
        category.type = 'network';
        category.isNetwork = true;
        category.shouldRetry = true;
        return category;
    }

    if (error.status) {
        switch (error.status) {
            case 401:
                category.type = 'authentication';
                category.isAuth = true;
                category.shouldRedirect = true;
                category.redirectPath = '/Landing';
                break;
            case 403:
                category.type = 'authorization';
                category.isAuth = true;
                break;
            case 400:
            case 422:
                category.type = 'validation';
                category.isValidation = true;
                break;
            case 429:
                category.type = 'rate_limit';
                category.shouldRetry = true;
                break;
            case 500:
            case 502:
            case 503:
                category.type = 'server';
                category.isServer = true;
                category.shouldRetry = true;
                break;
        }
    }

    return category;
}

export default logger;
