// ============================================================================
// secretariaService — wrappers das Cloud Functions do Processo Eletrônico
// (antiga Secretaria Processual; nomes internos mantidos).
// Leitura e escrita passam pelas functions: as coleções sec* são fechadas ao
// cliente nas regras do Firestore.
// ============================================================================

import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '@/config/firebase';
import { logger } from '@/utils/logger';
import { paraEnvio } from '@/lib/paraEnvio';

async function call(name, payload, options) {
    try {
        const fn = httpsCallable(functions, name, options);
        // Texto do editor (minutas, modelos, timbrado) chega com objetos sem protótipo.
        const result = await fn(paraEnvio(payload));
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
    a.rel = 'noopener';
    document.body.appendChild(a); // Firefox e alguns navegadores de celular só baixam com o link na página
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Baixa o arquivo que uma função devolveu: em base64 (até 15 MB) ou, se for
 * grande, por link temporário (`url`), que o próprio navegador baixa.
 */
export function baixarResposta(r, nome, mime) {
    const n = nome || r.nome || r.nomeArquivo || 'arquivo';
    if (r.url) {
        const a = document.createElement('a');
        a.href = r.url;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
    }
    baixarBase64(r.base64, n, mime || r.mime || 'application/pdf');
}

/** Tipos que o Processo Eletrônico aceita (o mesmo do servidor e do storage.rules). */
export const TIPOS_ENVIO = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    odt: 'application/vnd.oasis.opendocument.text',
};
export const MAX_ENVIO_MB = 50;

/** Tipo do arquivo; no celular o navegador às vezes não informa, e vale a extensão. */
export function mimeDoArquivo(file) {
    if (Object.values(TIPOS_ENVIO).includes(file.type)) return file.type;
    return TIPOS_ENVIO[String(file.name || '').split('.').pop().toLowerCase()] || file.type || '';
}

/**
 * Envia o arquivo direto ao Storage, na área de espera da própria conta
 * (até 50 MB, com progresso de 0 a 1), e devolve os campos que a função
 * espera no lugar do base64: `{ envio, mime, nomeArquivo }`. A função confere
 * o dono e o conteúdo, guarda o original intacto e apaga a cópia de espera.
 */
export async function prepararEnvio(file, { onProgresso, tipos } = {}) {
    const mime = mimeDoArquivo(file);
    const aceitos = tipos || Object.values(TIPOS_ENVIO);
    if (!aceitos.includes(mime)) throw new Error(`Tipo de arquivo não aceito: ${file.name}`);
    if (!file.size) throw new Error(`Arquivo vazio: ${file.name}`);
    if (file.size > MAX_ENVIO_MB * 1024 * 1024) throw new Error(`${file.name} passa de ${MAX_ENVIO_MB} MB`);
    // Tudo pela função (o mesmo caminho do resto da tela): o envio direto ao
    // Storage parava em 0% nas redes que barram aquele endereço.
    if (file.size <= PARTE_BYTES) return { base64: await arquivoParaBase64(file), mime, nomeArquivo: file.name };
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Entre de novo na sua conta para enviar arquivos');
    const id = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const envio = `secretaria-envios/${uid}/${id}`;
    for (let parte = 0; parte * PARTE_BYTES < file.size; parte++) {
        onProgresso?.(parte * PARTE_BYTES / file.size);
        await secPortal('enviarParte', { envio, parte, base64: await arquivoParaBase64(file.slice(parte * PARTE_BYTES, (parte + 1) * PARTE_BYTES)) });
    }
    return { envio, mime, nomeArquivo: file.name };
}
/** Igual a PARTE_BYTES do servidor (secretaria/arquivos.ts). */
const PARTE_BYTES = 4 * 1024 * 1024;

/** Lê um File como base64 (sem o prefixo data:). */
export function arquivoParaBase64(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] || '');
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
    });
}
