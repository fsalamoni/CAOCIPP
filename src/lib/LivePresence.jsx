// ============================================================================
// LivePresence — indicador de "quem está vendo este registro agora" (flag
// `live_presence`).
// ----------------------------------------------------------------------------
// Cada cliente grava (e renova a cada ~15s) um heartbeat próprio em
// `presence/{entityType}_{entityId}_{userId}` enquanto o componente estiver
// montado, e apaga ao desmontar. A lista de "presentes" é obtida por
// listener, filtrando client-side por heartbeats recentes (< 40s) — evita
// depender de uma Cloud Function/TTL para expirar presença de abas fechadas
// abruptamente (crash, perda de rede etc.).
// ============================================================================

import React, { useEffect, useState } from 'react';
import { doc, setDoc, deleteDoc, serverTimestamp, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { formatPersonName } from '@/utils/nameUtils';
import { Users } from 'lucide-react';

const HEARTBEAT_INTERVAL_MS = 15000;
const STALE_AFTER_MS = 40000;

export function useLivePresence({ organizationId, entityType, entityId, userName }) {
    const enabled = useFlag(FEATURE_FLAGS.LIVE_PRESENCE.key);
    const { user } = useAuth();
    const [viewers, setViewers] = useState([]);

    useEffect(() => {
        if (!enabled || !organizationId || !entityType || !entityId || !user?.uid) return undefined;

        const presenceId = `${entityType}_${entityId}_${user.uid}`;
        const presenceRef = doc(db, 'presence', presenceId);

        const beat = () => setDoc(presenceRef, {
            organization_id: organizationId,
            entity_type: entityType,
            entity_id: entityId,
            user_id: user.uid,
            user_name: formatPersonName(userName || user.displayName || 'Usuário'),
            updated_at: serverTimestamp(),
        }).catch(() => { /* melhor esforço — não deve travar a UI */ });

        beat();
        const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);

        return () => {
            clearInterval(interval);
            deleteDoc(presenceRef).catch(() => { /* melhor esforço */ });
        };
    }, [enabled, organizationId, entityType, entityId, user?.uid, userName]);

    useEffect(() => {
        if (!enabled || !organizationId || !entityType || !entityId) {
            setViewers([]);
            return undefined;
        }
        const q = query(
            collection(db, 'presence'),
            where('entity_type', '==', entityType),
            where('entity_id', '==', entityId)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const now = Date.now();
            const others = snapshot.docs
                .map((d) => d.data())
                .filter((v) => v.user_id !== user?.uid)
                .filter((v) => v.updated_at?.seconds && (now - v.updated_at.seconds * 1000) < STALE_AFTER_MS);
            setViewers(others);
        }, () => setViewers([]));
        return () => unsubscribe();
    }, [enabled, organizationId, entityType, entityId, user?.uid]);

    return { enabled, viewers };
}

export function LivePresenceIndicator({ organizationId, entityType, entityId, userName }) {
    const { enabled, viewers } = useLivePresence({ organizationId, entityType, entityId, userName });

    if (!enabled || viewers.length === 0) return null;

    return (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" title={viewers.map((v) => v.user_name).join(', ')}>
            <Users className="w-3.5 h-3.5" />
            <span>
                {viewers.length === 1
                    ? `${viewers[0].user_name} também está vendo`
                    : `${viewers.length} pessoas também estão vendo`}
            </span>
        </div>
    );
}
