// ============================================================================
// usePanorama — leitura em tempo real das bases e registros do Panorama
// ----------------------------------------------------------------------------
// Mesmo padrão dos demais módulos: assinatura em tempo real com ordenação no
// cliente, para que um índice ainda não propagado nunca esvazie a tela.
// ============================================================================

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { logger } from '@/utils/logger';

/** Bases analíticas de um órgão, em tempo real. */
export function usePanoramaBases(organizationId) {
    const [bases, setBases] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!organizationId) {
            setBases([]);
            setIsLoading(false);
            return;
        }
        setBases([]);
        setIsLoading(true);
        setError(null);

        const q = query(
            collection(db, 'panoramaBases'),
            where('organization_id', '==', organizationId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
            setBases(data);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to panorama bases:', err);
            setError(err.message);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [organizationId]);

    return { bases, isLoading, error };
}

/**
 * Registros de UMA base, em tempo real.
 *
 * O módulo é desenhado para até ~20 mil registros por base: é o volume em que
 * o cálculo no navegador continua instantâneo e qualquer cruzamento sai sem
 * espera. `hasMore` avisa quando a base se aproxima do teto.
 */
export const PANORAMA_TETO_REGISTROS = 20000;

export function usePanoramaRegistros(organizationId, baseId) {
    const [registros, setRegistros] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!organizationId || !baseId) {
            setRegistros([]);
            setIsLoading(false);
            return;
        }
        // Limpa os dados da base anterior antes de buscar os novos: sem isto, a
        // tabela exibiria registros de uma base dentro de outra durante a troca.
        setRegistros([]);
        setIsLoading(true);
        setError(null);

        const q = query(
            collection(db, 'panoramaRegistros'),
            where('organization_id', '==', organizationId),
            where('base_id', '==', baseId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRegistros(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to panorama registros:', err);
            setError(err.message);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [organizationId, baseId]);

    return {
        registros,
        isLoading,
        error,
        pertoDoTeto: registros.length >= PANORAMA_TETO_REGISTROS * 0.8,
        acimaDoTeto: registros.length > PANORAMA_TETO_REGISTROS,
    };
}

/** Modelos de relatório do órgão, em tempo real. */
export function usePanoramaTemplates(organizationId, baseId) {
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!organizationId) {
            setTemplates([]);
            setIsLoading(false);
            return;
        }
        setTemplates([]);
        setIsLoading(true);

        const q = query(
            collection(db, 'panoramaTemplates'),
            where('organization_id', '==', organizationId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                // Filtra por base no cliente: a lista é curta e assim trocar de
                // base não exige uma nova assinatura.
                .filter((t) => !baseId || t.base_id === baseId)
                .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
            setTemplates(data);
            setIsLoading(false);
        }, (err) => {
            logger.error('Error listening to panorama templates:', err);
            setTemplates([]);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [organizationId, baseId]);

    return { templates, isLoading };
}
