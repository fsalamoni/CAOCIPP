// ============================================================================
// useJurimetriaPrefs — preferências do módulo de Jurimetria, por órgão
// ----------------------------------------------------------------------------
// Guarda no navegador as escolhas de apresentação do usuário: critério de
// contagem do painel, tamanho de página das tabelas e, principalmente, o
// desenho dos relatórios dinâmicos (linhas, colunas, medida, seções do
// descritivo). Sem isso, cada visita recomeça do zero e o usuário precisa
// remontar o relatório que ele já tinha desenhado.
//
// São preferências de VISUALIZAÇÃO, não dados: ficam no localStorage, chaveadas
// por órgão, para que o recorte montado num órgão não vaze para outro. Nada
// aqui vai para o banco.
// ============================================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/utils/logger';

const PREFIX = 'caocipp_jurimetria';

function storageKey(scope, organizationId) {
    return `${PREFIX}_${scope}_${organizationId || 'sem-orgao'}`;
}

/**
 * Lê uma preferência gravada. Objetos são mesclados sobre o padrão, de modo
 * que uma versão futura da ferramenta possa acrescentar opções sem invalidar
 * o que o usuário já tinha salvo.
 */
export function readJurimetriaPref(scope, organizationId, fallback) {
    try {
        const raw = window.localStorage.getItem(storageKey(scope, organizationId));
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        if (parsed === null || parsed === undefined) return fallback;
        if (
            typeof parsed === 'object' && !Array.isArray(parsed)
            && typeof fallback === 'object' && fallback !== null && !Array.isArray(fallback)
        ) {
            return { ...fallback, ...parsed };
        }
        return parsed;
    } catch {
        // localStorage indisponível (modo privado) ou JSON corrompido: o
        // padrão sempre funciona.
        return fallback;
    }
}

/** Grava uma preferência. Falhar aqui nunca pode quebrar a tela. */
export function writeJurimetriaPref(scope, organizationId, value) {
    try {
        window.localStorage.setItem(storageKey(scope, organizationId), JSON.stringify(value));
    } catch (error) {
        logger.warn('[jurimetria] não foi possível gravar a preferência', scope, error);
    }
}

/** Apaga a preferência, fazendo a tela voltar ao padrão de fábrica. */
export function clearJurimetriaPref(scope, organizationId) {
    try {
        window.localStorage.removeItem(storageKey(scope, organizationId));
    } catch {
        /* nada a fazer */
    }
}

/**
 * Estado de componente que sobrevive ao refresh e à próxima visita.
 *
 * @param {string} scope Nome curto da preferência (ex.: 'analise', 'dinamicos').
 * @param {string|null} organizationId Órgão dono da preferência.
 * @param {any} fallback Valor padrão quando não há nada gravado.
 * @returns {[any, Function, Function]} `[valor, definir, restaurarPadrao]`
 */
export function useJurimetriaPref(scope, organizationId, fallback) {
    // O padrão costuma ser um objeto literal — sem a ref, ele mudaria de
    // identidade a cada render e o efeito abaixo recarregaria sem parar.
    const fallbackRef = useRef(fallback);
    const [value, setValue] = useState(
        () => readJurimetriaPref(scope, organizationId, fallbackRef.current)
    );
    const orgRef = useRef(organizationId);

    // Trocou de órgão: recarrega as preferências daquele órgão.
    useEffect(() => {
        if (orgRef.current === organizationId) return;
        orgRef.current = organizationId;
        setValue(readJurimetriaPref(scope, organizationId, fallbackRef.current));
    }, [scope, organizationId]);

    const update = useCallback((next) => {
        setValue((prev) => {
            const resolved = typeof next === 'function' ? next(prev) : next;
            writeJurimetriaPref(scope, orgRef.current, resolved);
            return resolved;
        });
    }, [scope]);

    const reset = useCallback(() => {
        clearJurimetriaPref(scope, orgRef.current);
        setValue(fallbackRef.current);
    }, [scope]);

    return [value, update, reset];
}
