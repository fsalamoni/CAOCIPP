// ============================================================================
// useCustomEntities — hooks de leitura em tempo real (entityTypes / customRecords)
// ============================================================================
import { useState, useEffect } from 'react';
import {
    collection, query, where, orderBy, limit, onSnapshot, doc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { logger } from '@/utils/logger';

/**
 * Tipos de entidade (páginas personalizadas) de um órgão, em tempo real.
 */
export function useEntityTypes(organizationId) {
    const [entityTypes, setEntityTypes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!organizationId) {
            setEntityTypes([]);
            setIsLoading(false);
            return;
        }
        // Limpa os tipos de entidade do órgão anterior imediatamente: sem
        // isto, ao trocar de órgão, as abas/rótulos personalizados do órgão
        // anterior ficavam visíveis (na barra lateral e no seletor de abas)
        // até a nova consulta resolver.
        setEntityTypes([]);
        setIsLoading(true);
        setError(null);

        const ref = collection(db, 'entityTypes');
        const q = query(ref, where('organization_id', '==', organizationId));

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)
                    || String(a.label_plural || '').localeCompare(String(b.label_plural || '')));
            setEntityTypes(data);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to entityTypes:', err);
            setError(err.message);
            setIsLoading(false);
        });

        return () => unsub();
    }, [organizationId]);

    return { entityTypes, isLoading, error };
}

/**
 * Registros de um tipo de entidade, em tempo real.
 * @param {object} options - { limitTo?: number }
 */
export function useRecords(organizationId, entityTypeId, options = {}) {
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(false);

    const limitTo = (typeof options.limitTo === 'number' && options.limitTo > 0) ? options.limitTo : null;

    useEffect(() => {
        if (!organizationId || !entityTypeId) {
            setRecords([]);
            setIsLoading(false);
            return;
        }
        // Mesma razão de useEntityTypes: limpa os registros do órgão/tipo
        // anterior antes de buscar os novos.
        setRecords([]);
        setIsLoading(true);
        setError(null);

        const ref = collection(db, 'customRecords');
        const constraints = [
            where('organization_id', '==', organizationId),
            where('entity_type_id', '==', entityTypeId),
            orderBy('updated_at', 'desc'),
        ];
        if (limitTo) constraints.push(limit(limitTo));
        const q = query(ref, ...constraints);

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setRecords(data);
            setHasMore(limitTo ? snap.size >= limitTo : false);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to customRecords:', err);
            setError(err.message);
            setIsLoading(false);
        });

        return () => unsub();
    }, [organizationId, entityTypeId, limitTo]);

    return { records, isLoading, error, hasMore };
}

/**
 * Um único tipo de entidade por id, em tempo real.
 */
export function useEntityType(entityTypeId) {
    const [entityType, setEntityType] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!entityTypeId) {
            setEntityType(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const unsub = onSnapshot(doc(db, 'entityTypes', entityTypeId), (snap) => {
            setEntityType(snap.exists() ? { id: snap.id, ...snap.data() } : null);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to entityType:', err);
            setIsLoading(false);
        });
        return () => unsub();
    }, [entityTypeId]);

    return { entityType, isLoading };
}
