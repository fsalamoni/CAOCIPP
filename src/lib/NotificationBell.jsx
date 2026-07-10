// ============================================================================
// NotificationBell — sino de notificações (flag `notification_center_v2`).
// ----------------------------------------------------------------------------
// Com a flag DESLIGADA: comportamento idêntico ao anterior (lista simples das
// 5 notificações não lidas mais recentes, sem ação de clique). Com a flag
// LIGADA: agrupamento por tipo, "marcar todas como lidas", clique na
// notificação marca como lida e navega até o registro relacionado (quando
// aplicável), e uma preferência por usuário para desligar notificações de
// menção.
// ============================================================================

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { useNotifications, useUserPreferences } from '@/hooks/useFirestore';
import { markNotificationAsRead } from '@/services/firestoreService';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Bell, CheckCheck } from 'lucide-react';

const TYPE_LABELS = {
    mention: 'Menções',
};

function groupByType(notifications) {
    const groups = new Map();
    notifications.forEach((notif) => {
        const key = notif.type || 'other';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(notif);
    });
    return groups;
}

export default function NotificationBell({ className, variant = 'desktop' }) {
    const isV2 = useFlag(FEATURE_FLAGS.NOTIFICATION_CENTER_V2.key);
    const { notifications } = useNotifications();
    const { preferences, updatePreferences } = useUserPreferences();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);

    const notifyOnMention = preferences?.notificationPreferences?.mention !== false;

    const grouped = useMemo(() => groupByType(notifications), [notifications]);

    const markAllAsRead = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (notifications.length === 0) return;
        // Firestore permite no máximo 500 operações por batch — em partes de
        // 500 para não falhar quando alguém acumula mais não lidas que isso.
        const CHUNK_SIZE = 500;
        for (let i = 0; i < notifications.length; i += CHUNK_SIZE) {
            const chunk = notifications.slice(i, i + CHUNK_SIZE);
            const batch = writeBatch(db);
            chunk.forEach((n) => {
                batch.update(doc(db, 'notifications', n.id), { read: true, read_at: new Date() });
            });
            // eslint-disable-next-line no-await-in-loop
            await batch.commit();
        }
    };

    const handleClickNotification = async (notif) => {
        try {
            await markNotificationAsRead(notif.id);
        } catch { /* melhor esforço — navegação segue mesmo se falhar */ }
        setOpen(false);
        if (notif.organization_id && notif.entity_type && notif.entity_id) {
            const tab = notif.entity_type === 'process' ? 'processes' : 'expedientes';
            navigate(`${createPageUrl('Organization')}?id=${notif.organization_id}&tab=${tab}`);
        }
    };

    if (!isV2) {
        // Comportamento original (flag off): sem interação, só listagem.
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={`relative ${className || ''}`} aria-label={`Notificações${notifications.length > 0 ? ` (${notifications.length} não lida(s))` : ''}`}>
                        <Bell className="w-5 h-5" />
                        {notifications.length > 0 && (
                            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500">
                                {notifications.length}
                            </Badge>
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                    <div className="p-2 font-semibold">Notificações</div>
                    <DropdownMenuSeparator />
                    {notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma notificação</div>
                    ) : variant === 'mobile' ? (
                        notifications.slice(0, 5).map((notif) => (
                            <DropdownMenuItem key={notif.id} className="flex-col items-start p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                                <div className="font-medium text-sm text-slate-900 dark:text-white">{notif.title}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{notif.message}</div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 w-full text-right">
                                    {new Date(notif.created_at?.seconds * 1000).toLocaleString()}
                                </div>
                            </DropdownMenuItem>
                        ))
                    ) : (
                        notifications.slice(0, 5).map((notif) => (
                            <DropdownMenuItem key={notif.id} className="flex-col items-start p-3">
                                <div className="font-medium text-sm">{notif.title}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{notif.message}</div>
                            </DropdownMenuItem>
                        ))
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={`relative ${className || ''}`}>
                    <Bell className="w-5 h-5" />
                    {notifications.length > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500">
                            {notifications.length}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between p-2">
                    <span className="font-semibold">Notificações</span>
                    {notifications.length > 0 && (
                        <button
                            type="button"
                            onClick={markAllAsRead}
                            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Marcar todas como lidas
                        </button>
                    )}
                </div>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma notificação</div>
                ) : (
                    Array.from(grouped.entries()).map(([type, items]) => (
                        <div key={type}>
                            <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                {TYPE_LABELS[type] || 'Outras'}
                            </div>
                            {items.slice(0, 8).map((notif) => (
                                <DropdownMenuItem
                                    key={notif.id}
                                    className="flex-col items-start p-3 cursor-pointer"
                                    onSelect={(e) => { e.preventDefault(); handleClickNotification(notif); }}
                                >
                                    <div className="font-medium text-sm">{notif.title}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">{notif.message}</div>
                                    {notif.created_at?.seconds && (
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 w-full text-right">
                                            {new Date(notif.created_at.seconds * 1000).toLocaleString('pt-BR')}
                                        </div>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </div>
                    ))
                )}
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Notificar quando eu for mencionado</span>
                    <Switch
                        checked={notifyOnMention}
                        onCheckedChange={(checked) => updatePreferences({
                            notificationPreferences: { ...(preferences?.notificationPreferences || {}), mention: checked },
                        })}
                    />
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
