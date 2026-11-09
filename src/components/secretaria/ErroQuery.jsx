import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Erro de carregamento com saída: tentar de novo (e, se houver, voltar). */
export default function ErroQuery({ q, children }) {
    return (
        <div role="alert" className="py-8 space-y-3">
            <p className="text-red-700 dark:text-red-400">{q.error?.message || 'Não foi possível carregar.'}</p>
            <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1" disabled={q.isFetching} onClick={() => q.refetch()}>
                    <RefreshCw className={`w-4 h-4 ${q.isFetching ? 'animate-spin' : ''}`} aria-hidden /> Tentar de novo
                </Button>
                {children}
            </div>
        </div>
    );
}
