// ============================================================================
// usePanorama — leitura em tempo real das bases e registros do Panorama
// ----------------------------------------------------------------------------
// Mesmo padrão dos demais módulos: assinatura em tempo real com ordenação no
// cliente, para que um índice ainda não propagado nunca esvazie a tela.
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { logger } from '@/utils/logger';
import { COLECAO_MODULO, registrosLigados } from '@/lib/panoramaModulos';

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

export function usePanoramaRegistros(organizationId, baseId, base = null) {
    const ligada = base?.vinculada === true;
    const ligados = useRegistrosLigados(organizationId, ligada ? base : null);
    const copiados = useRegistrosCopiados(organizationId, ligada ? null : baseId);
    const { registros, isLoading, error } = ligada ? ligados : copiados;
    return {
        registros,
        isLoading,
        error,
        pertoDoTeto: registros.length >= PANORAMA_TETO_REGISTROS * 0.8,
        acimaDoTeto: registros.length > PANORAMA_TETO_REGISTROS,
    };
}

/**
 * Base ligada às funcionalidades do órgão: não há cópia. Assina Consultas,
 * Expedientes e/ou Parcerias do órgão e monta as linhas na hora, então o
 * Panorama acompanha cada registro novo ou alterado.
 */
function useRegistrosLigados(organizationId, base) {
    const [docs, setDocs] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const modulos = (base?.fonte_modulos || []).filter((m) => COLECAO_MODULO[m]).join(',');

    useEffect(() => {
        if (!organizationId || !modulos) {
            setDocs({});
            setIsLoading(false);
            return undefined;
        }
        setDocs({});
        setIsLoading(true);
        setError(null);
        const lista = modulos.split(',');
        const prontos = new Set();
        const unsubs = lista.map((m) => onSnapshot(
            query(collection(db, COLECAO_MODULO[m]), where('organization_id', '==', organizationId)),
            (snapshot) => {
                setDocs((atual) => ({ ...atual, [m]: snapshot.docs.map((d) => ({ ...d.data(), id: d.id })) }));
                prontos.add(m);
                if (prontos.size === lista.length) setIsLoading(false);
            },
            (err) => {
                logger.error(`Error listening to ${m} for panorama:`, err);
                setError(err.message);
                setIsLoading(false);
            }
        ));
        return () => unsubs.forEach((u) => u());
    }, [organizationId, modulos]);

    // As colunas (tipos, papéis) podem mudar na configuração sem nova assinatura.
    const registros = useMemo(() => (base ? registrosLigados(base, docs) : []), [base, docs]);
    return { registros, isLoading, error };
}

function useRegistrosCopiados(organizationId, baseId) {
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

    return { registros, isLoading, error };
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
