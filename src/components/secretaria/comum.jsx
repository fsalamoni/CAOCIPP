import React from 'react';
import { Label } from '@/components/ui/label';

export const STATUS_ROTULO = {
    em_tramitacao: 'Em tramitação',
    sobrestado: 'Sobrestado',
    arquivado: 'Arquivado',
};

export function NativeSelect({ label, value, onChange, options, id }) {
    const selId = id || `sel-${label}`;
    return (
        <div>
            <Label htmlFor={selId}>{label}</Label>
            <select
                id={selId}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900"
            >
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
        </div>
    );
}

export function dataHora(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
