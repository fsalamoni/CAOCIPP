import React, { useState } from 'react';
import { Siren, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

/** Origem do processo (espelho de ORIGENS em functions-v2/src/shared/secretaria.ts). */
export const ORIGENS = [
    ['requerimento', 'Requerimento do interessado'],
    ['representacao', 'Representação ou denúncia'],
    ['oficio', 'Ofício ou comunicação de outro órgão'],
    ['de_oficio', 'De ofício (iniciativa do órgão)'],
    ['outro_processo', 'Derivado de outro processo'],
    ['outro', 'Outra'],
];
export const rotuloOrigem = (tipo) => ORIGENS.find(([v]) => v === tipo)?.[1] || 'Outra';

/** Polos das partes, na ordem em que a capa os mostra. */
export const POLOS = { requerente: 'Requerente', requerido: 'Requerido', interessado: 'Interessado', terceiro: 'Terceiro' };

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

/** Modelos que uma unidade pode usar: os da entidade, os do órgão interno dela e os dela. */
export const modelosDaUnidade = (estado, unidadeId) => {
    const orgao = (estado.unidades || []).find((u) => u.id === unidadeId)?.orgao_id || null;
    return (estado.modelos || []).filter((m) => m.ativo && (m.unidade_id ? m.unidade_id === unidadeId : !m.orgao_id || m.orgao_id === orgao));
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

/** Lista de frases curtas (competências, atribuições): digita, Enter ou Adicionar; remove no X. */
export function ListaTextos({ id, rotulo, ajuda, itens = [], onChange, placeholder, max = 20 }) {
    const [novo, setNovo] = useState('');
    const incluir = () => {
        const t = novo.trim();
        if (t && !itens.includes(t) && itens.length < max) onChange([...itens, t]);
        setNovo('');
    };
    return (
        <div>
            <Label htmlFor={id}>{rotulo}</Label>
            {ajuda && <p className="text-xs text-slate-600 dark:text-slate-400">{ajuda}</p>}
            {itens.length > 0 && (
                <ul className="mt-1 space-y-1">
                    {itens.map((t) => (
                        <li key={t} className="flex items-start gap-2 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 text-sm">
                            <span className="flex-1">{t}</span>
                            <button type="button" aria-label={`Remover: ${t}`} className="text-slate-600 hover:text-red-700 dark:text-slate-300" onClick={() => onChange(itens.filter((x) => x !== t))}><X className="w-4 h-4" /></button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="mt-1 flex gap-2">
                <Input id={id} value={novo} maxLength={300} placeholder={placeholder} onChange={(e) => setNovo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); incluir(); } }} />
                <Button type="button" variant="outline" disabled={!novo.trim() || itens.length >= max} onClick={incluir}>Adicionar</Button>
            </div>
        </div>
    );
}
