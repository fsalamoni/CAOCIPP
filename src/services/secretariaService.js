// ============================================================================
// secretariaService — wrappers das Cloud Functions da Secretaria Processual.
// Leitura e escrita passam pelas functions: as coleções sec* são fechadas ao
// cliente nas regras do Firestore.
// ============================================================================

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import { logger } from '@/utils/logger';

async function call(name, payload, options) {
    try {
        const fn = httpsCallable(functions, name, options);
        const result = await fn(payload);
        return result.data;
    } catch (error) {
        logger.error(`Error calling ${name}:`, error);
        throw error;
    }
}

export const secConfig = (organizationId, action, extra = {}) =>
    call('secretariaConfig', { organizationId, action, ...extra });

export const secProcesso = (organizationId, action, extra = {}) =>
    call('secretariaProcesso', { organizationId, action, ...extra });

export const secDocumento = (organizationId, processoId, action, extra = {}) =>
    call('secretariaDocumento', { organizationId, processoId, action, ...extra }, { timeout: 120000 });

export const secExportarPdf = (organizationId, processoId) =>
    call('secretariaExportarPdf', { organizationId, processoId }, { timeout: 180000 });

/** Converte base64 em download no navegador. */
export function baixarBase64(base64, nome, mime = 'application/pdf') {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Lê um File como base64 (sem o prefixo data:). */
export function arquivoParaBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
    });
}
