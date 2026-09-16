// ============================================================================
// jurimetriaService — wrappers das Cloud Functions do módulo de Jurimetria
// ----------------------------------------------------------------------------
// Todo o CRUD da base de júris passa por Cloud Functions: são elas que aplicam
// as listas oficiais do órgão, a checagem de duplicidade pelo número do
// processo e a permissão de exclusão. As regras do Firestore bloqueiam
// qualquer escrita direta do cliente em `juris/`.
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

/**
 * Cadastra um júri manualmente.
 * @param {string} organizationId
 * @param {object} data Campos fixos + `values` (colunas personalizadas).
 */
export const createJuri = (organizationId, data) =>
    call('createJuri', { organizationId, data });

/**
 * Atualiza um júri. Envie SOMENTE os campos alterados — o servidor mescla o
 * restante, de modo que uma edição parcial nunca zera campos não tocados.
 */
export const updateJuri = (organizationId, id, data) =>
    call('updateJuri', { organizationId, id, data });

/** Exclui um único júri. */
export const deleteJuri = (organizationId, id) =>
    call('deleteJuris', { organizationId, id });

/** Exclui vários júris de uma vez (máximo 500 por chamada). */
export const deleteJuris = (organizationId, ids) =>
    call('deleteJuris', { organizationId, ids }, { timeout: 300000 });

/**
 * Aplica a mesma alteração a vários júris: atribuir responsável, padronizar
 * comarca/matéria/espécie ou preencher uma coluna personalizada.
 */
export const bulkUpdateJuris = (organizationId, ids, data) =>
    call('bulkUpdateJuris', { organizationId, ids, data }, { timeout: 300000 });

/**
 * Analisa uma planilha SEM gravar nada e devolve o relatório de importação
 * (novos / sem mudança / conflitos / inválidos + correções aplicadas).
 */
export const previewJurisImport = ({ organizationId, fileData, fileName, policy }) =>
    call(
        'importJurisFromExcel',
        { organizationId, fileData, fileName, policy, mode: 'preview' },
        { timeout: 540000 }
    );

/** Aplica a importação previamente analisada. */
export const commitJurisImport = ({ organizationId, fileData, fileName, policy }) =>
    call(
        'importJurisFromExcel',
        { organizationId, fileData, fileName, policy, mode: 'commit' },
        { timeout: 540000 }
    );
