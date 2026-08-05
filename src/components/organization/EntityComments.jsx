// ============================================================================
// EntityComments — comentários internos com @menção (flag `process_comments`).
// ----------------------------------------------------------------------------
// Genérico para Consultas e Expedientes (props `entityType`/`entityId`).
// Menções são escolhidas explicitamente numa lista de membros do órgão (em
// vez de um parser de "@texto livre" dentro do textarea), o que evita
// ambiguidade de nomes e mantém a UX simples; o texto do comentário fica
// livre para qualquer conteúdo. Escrita sempre via Cloud Function `addComment`
// (nunca diretamente no Firestore) — ela valida associação ao órgão e decide
// quem de fato recebe notificação.
// ============================================================================

import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { addComment } from '@/services/functionsService';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AtSign, Check, Loader2, MessageSquare, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatPersonName } from '@/utils/nameUtils';

const ENTITY_COLLECTION = {
    process: 'processes',
    expediente: 'expedientes',
    parceria: 'parcerias',
};

function formatWhen(timestamp) {
    if (!timestamp?.seconds) return '';
    return new Date(timestamp.seconds * 1000).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

export default function EntityComments({ organizationId, entityType, entityId, members = [] }) {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [text, setText] = useState('');
    const [mentionedIds, setMentionedIds] = useState([]);
    const [mentionPopoverOpen, setMentionPopoverOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const collectionName = ENTITY_COLLECTION[entityType];
        if (!collectionName || !entityId) {
            setComments([]);
            setIsLoading(false);
            return undefined;
        }
        setIsLoading(true);
        // Ordena desc + limita e reverte no cliente: garante que, no caso raro de
        // um registro acumular centenas de comentários, mostramos os mais
        // RECENTES (não os mais antigos, que é o que um limit() em 'asc' traria).
        const q = query(collection(db, collectionName, entityId, 'comments'), orderBy('created_at', 'desc'), limit(300));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setComments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).reverse());
            setIsLoading(false);
        }, () => setIsLoading(false));
        return () => unsubscribe();
    }, [entityType, entityId]);

    const memberOptions = useMemo(
        () => members
            .filter((m) => m.user_id && m.user_id !== user?.uid)
            .map((m) => ({ value: m.user_id, label: formatPersonName(m.user_name || 'Membro') })),
        [members, user?.uid]
    );

    const toggleMention = (userId) => {
        setMentionedIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
    };

    const handleSubmit = async () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setSubmitting(true);
        try {
            await addComment({
                organizationId,
                entityType,
                entityId,
                text: trimmed,
                mentionedUserIds: mentionedIds,
            });
            setText('');
            setMentionedIds([]);
            toast.success('Comentário adicionado.');
        } catch (error) {
            toast.error('Erro ao adicionar comentário: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8 text-slate-400 dark:text-slate-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                ) : comments.length === 0 ? (
                    <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-400 flex flex-col items-center gap-2">
                        <MessageSquare className="w-6 h-6 opacity-30" />
                        Nenhum comentário ainda.
                    </div>
                ) : (
                    comments.map((c) => (
                        <div key={c.id} className="rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    {formatPersonName(c.author_name || 'Usuário')}
                                </span>
                                <span className="text-[11px] text-slate-400 dark:text-slate-400 shrink-0">{formatWhen(c.created_at)}</span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words">
                                {c.text}
                            </p>
                        </div>
                    ))
                )}
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                {mentionedIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {mentionedIds.map((id) => {
                            const opt = memberOptions.find((o) => o.value === id);
                            return (
                                <span key={id} className="inline-flex items-center gap-1 text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                    @{opt?.label || 'Membro'}
                                    <button type="button" onClick={() => toggleMention(id)}>
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            );
                        })}
                    </div>
                )}
                <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Escreva um comentário..."
                    rows={3}
                    className="resize-none"
                />
                <div className="flex items-center justify-between">
                    <Popover open={mentionPopoverOpen} onOpenChange={setMentionPopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={memberOptions.length === 0}>
                                <AtSign className="w-3.5 h-3.5" />
                                Mencionar
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Buscar colega..." />
                                <CommandList>
                                    <CommandEmpty>Ninguém encontrado.</CommandEmpty>
                                    <CommandGroup>
                                        {memberOptions.map((o) => (
                                            <CommandItem key={o.value} value={o.label} onSelect={() => toggleMention(o.value)}>
                                                <Check className={`mr-2 h-4 w-4 ${mentionedIds.includes(o.value) ? 'opacity-100' : 'opacity-0'}`} />
                                                {o.label}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    <Button type="button" size="sm" onClick={handleSubmit} disabled={submitting || !text.trim()} className="gap-1.5">
                        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageSquare className="w-3.5 h-3.5" />}
                        Comentar
                    </Button>
                </div>
            </div>
        </div>
    );
}
