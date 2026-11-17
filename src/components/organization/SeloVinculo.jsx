import React from 'react';
import { Link2 } from 'lucide-react';
import { rotuloVinculo } from '@/lib/registrosPgea';
import { cn } from '@/lib/utils';

/**
 * Selo "Original" ou "Aditivo N" de Consultas e Expedientes. Não aparece em
 * registro sem aditivos. `contagem` acrescenta "· 2 aditivos" ao original.
 */
export default function SeloVinculo({ registro, contagem = false, className }) {
    const rotulo = rotuloVinculo(registro);
    if (!rotulo) return null;
    const aditivo = Boolean(registro.aditivo_de);
    const n = Number(registro.aditivos_count) || 0;
    const texto = !aditivo && contagem ? `${rotulo} · ${n} aditivo${n === 1 ? '' : 's'}` : rotulo;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none border',
                aditivo
                    ? 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900 dark:text-violet-100 dark:border-violet-700'
                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500',
                className
            )}
            title={aditivo ? `${rotulo}: tramitação própria, vinculada ao original` : `Original com ${n} aditivo${n === 1 ? '' : 's'}`}
        >
            <Link2 className="w-2.5 h-2.5" aria-hidden="true" />
            {texto}
        </span>
    );
}
