// ============================================================================
// secretariaService — wrappers das Cloud Functions do Processo Eletrônico
// (antiga Secretaria Processual; nomes internos mantidos).
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

/** `selecao`: `{ modo: 'integral' | 'apenas' | 'exceto' | 'intervalo', eventos, folha_de, folha_a, capa, indice }`. */
export const secExportarPdf = (organizationId, processoId, selecao) =>
    call('secretariaExportarPdf', { organizationId, processoId, ...(selecao ? { selecao } : {}) }, { timeout: 180000 });

/** Impressão interna (uso da equipe, fora dos autos). `interno`: `{ registros: [seq], documentos: [id], versoes: [id] }`. */
export const secExportarInterno = (organizationId, processoId, interno) =>
    call('secretariaExportarPdf', { organizationId, processoId, interno }, { timeout: 180000 });

/** Portal das partes: sem organizationId; o servidor confere a habilitação. */
export const secPortal = (action, extra = {}) =>
    call('secretariaPortal', { action, ...extra }, { timeout: 120000 });

export const secPlataforma = (action, extra = {}) =>
    call('secretariaPlataforma', { action, ...extra });

/** Conferência pública de documento juntado (sem login), pelo código das folhas. */
export const secConferir = (codigo) => call('secretariaConferir', { codigo });

/** SHA-256 (hex) de um arquivo, calculado no navegador. */
export async function sha256Arquivo(file) {
    const h = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** base64 → URL de objeto (pré-visualização); revogue quando não precisar mais. */
export function base64ParaUrl(base64, mime = 'application/pdf') {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

/** Converte base64 em download no navegador. */
export function baixarBase64(base64, nome, mime = 'application/pdf') {
    const url = base64ParaUrl(base64, mime);
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
