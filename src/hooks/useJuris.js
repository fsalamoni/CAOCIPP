// ============================================================================
// useJuris — leitura em tempo real da base de júris de um órgão
// ----------------------------------------------------------------------------
// Mesmo padrão de useParcerias/useExpedientes: assinatura em tempo real com
// fallback automático quando o índice composto ainda não propagou, para que um
// júri recém-cadastrado apareça na hora.
// ============================================================================

import { useState, useEffect } from 'react';
import {
    collection, query, where, orderBy, limit, onSnapshot, doc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { logger } from '@/utils/logger';

/**
 * Júris de um órgão, em tempo real.
 * @param {string|null} organizationId Passe `null` para não assinar nada.
 * @param {object} [options] { limitTo?: number }
 */
export function useJuris(organizationId, options = {}) {
    const [juris, setJuris] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hasMore, setHasMore] = useState(false);

    const limitTo = (typeof options.limitTo === 'number' && options.limitTo > 0)
        ? options.limitTo
        : null;

    useEffect(() => {
        if (!organizationId) {
            setJuris([]);
            setHasMore(false);
            setIsLoading(false);
            return;
        }
        // Limpa os dados do órgão anterior antes de buscar os novos, para que a
        // tabela nunca exiba júris de um órgão em outro durante a troca.
        setJuris([]);
        setIsLoading(true);
        setError(null);

        const ref = collection(db, 'juris');

        const tryQuery = (withOrder, attempt = 0) => {
            const constraints = [where('organization_id', '==', organizationId)];
            if (withOrder) constraints.push(orderBy('updated_at', 'desc'));
            if (limitTo) constraints.push(limit(limitTo));
            const q = query(ref, ...constraints);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                // Query ordenada vazia + primeira tentativa: quase sempre é o
                // índice composto ainda não disponível. Refaz sem orderBy.
                if (withOrder && data.length === 0 && attempt === 0) {
                    unsubscribe();
                    tryQuery(false, 1);
                    return;
                }
                setJuris(data);
                setHasMore(limitTo ? snapshot.size >= limitTo : false);
                setIsLoading(false);
            }, (err) => {
                if (withOrder && attempt === 0 && err && /index/i.test(err.message || '')) {
                    logger.warn('[useJuris] índice composto ausente, usando fallback sem orderBy:', err.message);
                    tryQuery(false, 1);
                    return;
                }
                logger.error('Error listening to juris:', err);
                setError(err.message);
                setIsLoading(false);
            });

            return unsubscribe;
        };

        const unsubscribe = tryQuery(true);
        return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
    }, [organizationId, limitTo]);

    return { juris, isLoading, error, hasMore };
}

/**
 * Histórico (subcoleção `history`) de um único júri, em tempo real.
 * @param {string|null} juriId
 * @param {boolean} [enabled]
 */
export function useJuriHistory(juriId, enabled = true) {
    const [history, setHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!juriId || !enabled) {
            setHistory([]);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);

        const ref = collection(db, 'juris', juriId, 'history');
        const unsubscribe = onSnapshot(ref, (snapshot) => {
            const data = snapshot.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
            setHistory(data);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to juri history:', err);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [juriId, enabled]);

    return { history, isLoading };
}

/** Um único júri por id, em tempo real (usado pela ficha lateral). */
export function useJuri(juriId) {
    const [juri, setJuri] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!juriId) {
            setJuri(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        const unsubscribe = onSnapshot(doc(db, 'juris', juriId), (snapshot) => {
            setJuri(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to juri:', err);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [juriId]);

    return { juri, isLoading };
}
