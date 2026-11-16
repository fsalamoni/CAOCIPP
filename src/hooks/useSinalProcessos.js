import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '@/config/firebase';

// Espera para juntar vários atos seguidos numa só atualização.
const JUNTAR_MS = 1500;

/**
 * Atualização sozinha das telas do Processo Eletrônico. A cada ato que muda
 * processo do órgão, as Functions gravam `secSinais/{orgId}` (hora e id do
 * processo, sem conteúdo) depois de gravar o ato. Esta tela escuta esse
 * documento e, quando ele muda, relê as listas e, se for o processo aberto, os
 * autos dele. O que já foi relido depois de o sinal chegar (quem fez o ato
 * relê na hora) não é lido de novo. Com a aba em segundo plano, a releitura
 * espera a pessoa voltar.
 */
export function useSinalProcessos(orgId, ligado = true) {
    const qc = useQueryClient();
    useEffect(() => {
        if (!orgId || !ligado) return undefined;
        let primeiro = true;
        let timer = null;
        let esperando = false;
        // Chegada do primeiro sinal ainda não atendido.
        let desde = 0;
        const processos = new Set();
        const reler = () => {
            if (typeof document !== 'undefined' && document.hidden) { esperando = true; return; }
            esperando = false;
            const limite = desde;
            const antigo = (q) => (q.state.dataUpdatedAt || 0) < limite;
            qc.invalidateQueries({ queryKey: ['sec-processos', orgId], predicate: antigo });
            for (const id of processos) qc.invalidateQueries({ queryKey: ['sec-proc', orgId, id], predicate: antigo });
            processos.clear();
            desde = 0;
        };
        const aoVoltar = () => { if (esperando && !document.hidden) reler(); };
        document.addEventListener('visibilitychange', aoVoltar);
        const parar = onSnapshot(doc(db, 'secSinais', orgId), (s) => {
            // O primeiro retrato é o estado atual, não uma mudança.
            if (primeiro) { primeiro = false; return; }
            if (!desde) desde = Date.now();
            const id = s.get('processo_id');
            if (id) processos.add(String(id));
            clearTimeout(timer);
            timer = setTimeout(reler, JUNTAR_MS);
        }, () => { /* sem o sinal, a tela se atualiza como antes (a cada ato da própria pessoa) */ });
        return () => {
            parar();
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', aoVoltar);
        };
    }, [orgId, ligado, qc]);
}
