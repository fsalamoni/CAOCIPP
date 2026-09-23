// ============================================================================
// panoramaService — wrappers das Cloud Functions do módulo Panorama
// ----------------------------------------------------------------------------
// Todo o CRUD passa por Cloud Function: são elas que aplicam a definição da
// base (tipo de cada coluna, papéis, chave natural) e a permissão de
// configuração. As regras do Firestore bloqueiam qualquer escrita direta do
// cliente nas coleções do módulo.
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

// ---- Bases ----------------------------------------------------------------

/** Cria uma base vazia, para ser preenchida por importação ou cadastro. */
export const createPanoramaBase = ({ organizationId, def }) =>
    call('managePanoramaBase', { organizationId, action: 'create', def });

/** Salva a configuração da base (colunas, papéis, desfechos, regiões, prazos). */
export const updatePanoramaBase = ({ organizationId, id, def }) =>
    call('managePanoramaBase', { organizationId, action: 'update', id, def });

/**
 * Exclui a base E todos os seus registros.
 * `confirmName` precisa ser o nome exato da base — a mesma proteção que a
 * plataforma exige para excluir um órgão.
 */
export const deletePanoramaBase = ({ organizationId, id, confirmName }) =>
    call('managePanoramaBase', { organizationId, action: 'delete', id, confirmName },
        { timeout: 540000 });

// ---- Registros -------------------------------------------------------------

export const createPanoramaRegistro = ({ organizationId, baseId, values }) =>
    call('managePanoramaRegistro', { organizationId, baseId, action: 'create', values });

/** Envie SOMENTE os campos alterados — o servidor mescla o restante. */
export const updatePanoramaRegistro = ({ organizationId, baseId, id, values }) =>
    call('managePanoramaRegistro', { organizationId, baseId, action: 'update', id, values });

export const deletePanoramaRegistros = ({ organizationId, baseId, ids }) =>
    call('managePanoramaRegistro', { organizationId, baseId, action: 'delete', ids },
        { timeout: 300000 });

/** Aplica a mesma alteração a vários registros. */
export const bulkUpdatePanoramaRegistros = ({ organizationId, baseId, ids, values }) =>
    call('managePanoramaRegistro', { organizationId, baseId, action: 'bulkUpdate', ids, values },
        { timeout: 300000 });

// ---- Importação -------------------------------------------------------------

/**
 * Analisa a planilha SEM gravar nada.
 *
 * Devolve as colunas detectadas (tipo, cardinalidade, amostra, papel proposto e
 * o motivo da proposta) e a classificação de cada linha. `baseId` vazio
 * significa base nova.
 */
export const previewPanoramaImport = ({ organizationId, baseId, fileData, fileName, policy }) =>
    call('importPanorama',
        { organizationId, baseId, fileData, fileName, policy, mode: 'preview' },
        { timeout: 540000 });

/** Aplica a importação, com as colunas e papéis confirmados pelo usuário. */
export const commitPanoramaImport = ({
    organizationId, baseId, fileData, fileName, policy, columns, baseNome,
}) =>
    call('importPanorama',
        { organizationId, baseId, fileData, fileName, policy, columns, baseNome, mode: 'commit' },
        { timeout: 540000 });

// ---- Modelos de relatório ----------------------------------------------------

export const createPanoramaTemplate = ({ organizationId, baseId, nome, tipo, config }) =>
    call('managePanoramaTemplate', { organizationId, baseId, action: 'create', nome, tipo, config });

export const updatePanoramaTemplate = ({ organizationId, id, nome, tipo, config }) =>
    call('managePanoramaTemplate', { organizationId, action: 'update', id, nome, tipo, config });

export const deletePanoramaTemplate = ({ organizationId, id }) =>
    call('managePanoramaTemplate', { organizationId, action: 'delete', id });
