import React from 'react';
import { Siren } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

/** Selo de processo urgente: cor, ícone e texto (não depende só da cor). */
export function SeloUrgente({ motivo, className = '' }) {
    return (
        <Badge title={motivo ? `Urgente: ${motivo}` : undefined} className={`gap-1 bg-red-600 text-white hover:bg-red-600 dark:bg-red-700 ${className}`}>
            <Siren className="w-3 h-3" aria-hidden /> Urgente
        </Badge>
    );
}

export const STATUS_ROTULO = {
    em_tramitacao: 'Em tramitação',
    sobrestado: 'Sobrestado',
    arquivado: 'Arquivado',
};

/** Tipos de unidade de lotação: o que cada uma faz no processo. */
export const TIPOS_UNIDADE = {
    secretaria: { rotulo: 'Secretaria', descricao: 'Autua, movimenta, cumpre e junta' },
    gabinete: { rotulo: 'Gabinete', descricao: 'Recebe a conclusão, decide e aprecia pendências' },
    assessoria: { rotulo: 'Assessoria', descricao: 'Estuda, minuta e devolve' },
    outra: { rotulo: 'Outra unidade', descricao: 'Atua quando o processo está com ela' },
};
export const rotuloUnidade = (tipo) => TIPOS_UNIDADE[tipo]?.rotulo || 'Secretaria';

/** Papel timbrado e tipos de documento da unidade (ou os do órgão). */
export const documentoDaUnidade = (estado, unidadeId) => estado.documentoUnidades?.[unidadeId] || estado.documento || {};

/** Modelos que uma unidade pode usar: os do órgão e os dela. */
export const modelosDaUnidade = (estado, unidadeId) =>
    (estado.modelos || []).filter((m) => m.ativo && (!m.unidade_id || m.unidade_id === unidadeId));

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
