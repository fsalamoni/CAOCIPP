import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Filter, FilterX, ChevronDown, X } from 'lucide-react';
import { tipoLabel } from '@/lib/jurimetriaEngine';

/** Estado inicial dos filtros — compartilhado por todas as abas da Jurimetria. */
export const EMPTY_JURIMETRIA_FILTERS = {
    busca: '',
    comarcas: [],
    tipos: [],
    resultados: [],
    promotor: '',
    responsaveis: [],
    dataDe: '',
    dataAte: '',
    somenteEfetivos: false,
};

/** Quantos filtros estão ativos (para o selo do botão). */
export function countActiveFilters(filters) {
    let count = 0;
    if (filters.busca) count += 1;
    if (filters.promotor) count += 1;
    if (filters.dataDe) count += 1;
    if (filters.dataAte) count += 1;
    if (filters.somenteEfetivos) count += 1;
    count += (filters.comarcas?.length || 0) > 0 ? 1 : 0;
    count += (filters.tipos?.length || 0) > 0 ? 1 : 0;
    count += (filters.resultados?.length || 0) > 0 ? 1 : 0;
    count += (filters.responsaveis?.length || 0) > 0 ? 1 : 0;
    return count;
}

/** Descrição textual dos filtros, impressa no cabeçalho dos documentos. */
export function describeFilters(filters, settings) {
    const partes = [];
    if (filters.dataDe || filters.dataAte) {
        const de = filters.dataDe ? filters.dataDe.split('-').reverse().join('/') : 'início';
        const ate = filters.dataAte ? filters.dataAte.split('-').reverse().join('/') : 'hoje';
        partes.push(`período ${de} a ${ate}`);
    }
    if (filters.comarcas?.length) partes.push(`${filters.comarcas.length} comarca(s)`);
    if (filters.tipos?.length) {
        partes.push(`matéria(s): ${filters.tipos.map((t) => tipoLabel(t, settings)).join(', ')}`);
    }
    if (filters.resultados?.length) partes.push(`espécie(s): ${filters.resultados.join(', ')}`);
    if (filters.promotor) partes.push(`promotor contém "${filters.promotor}"`);
    if (filters.responsaveis?.length) partes.push(`${filters.responsaveis.length} responsável(is)`);
    if (filters.somenteEfetivos) partes.push('somente júris efetivos');
    if (filters.busca) partes.push(`busca "${filters.busca}"`);
    return partes.length ? `Filtros: ${partes.join('; ')}` : 'Sem filtros aplicados';
}

/** Seletor de múltipla escolha com busca interna. */
function MultiSelect({ label, options, selected, onChange, placeholder = 'Todos' }) {
    const [term, setTerm] = useState('');

    const filtered = useMemo(() => {
        const t = term.trim().toLowerCase();
        if (!t) return options;
        return options.filter((o) => o.label.toLowerCase().includes(t));
    }, [options, term]);

    const toggle = (value) => {
        const set = new Set(selected);
        if (set.has(value)) set.delete(value);
        else set.add(value);
        onChange([...set]);
    };

    return (
        <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 dark:text-slate-400">{label}</Label>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal h-9">
                        <span className="truncate text-sm">
                            {selected.length === 0
                                ? placeholder
                                : selected.length === 1
                                    ? (options.find((o) => o.value === selected[0])?.label || selected[0])
                                    : `${selected.length} selecionados`}
                        </span>
                        <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <Input
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                            placeholder="Buscar..."
                            className="h-8 text-sm"
                        />
                    </div>
                    <ScrollArea className="h-56">
                        <div className="p-1">
                            {filtered.length === 0 && (
                                <p className="px-3 py-6 text-sm text-center text-slate-400">Nada encontrado.</p>
                            )}
                            {filtered.map((option) => (
                                <label
                                    key={option.value}
                                    className="flex items-start gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                    <Checkbox
                                        checked={selected.includes(option.value)}
                                        onCheckedChange={() => toggle(option.value)}
                                        className="mt-0.5"
                                    />
                                    <span className="text-sm leading-tight">{option.label}</span>
                                </label>
                            ))}
                        </div>
                    </ScrollArea>
                    {selected.length > 0 && (
                        <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-8 text-xs"
                                onClick={() => onChange([])}
                            >
                                <X className="w-3.5 h-3.5 mr-1" />
                                Limpar seleção
                            </Button>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    );
}

/**
 * Barra de filtros da Jurimetria. A busca rápida e o botão de filtros ficam
 * sempre visíveis; o restante abre num painel, para não ocupar a tela toda.
 */
export default function JurimetriaFilters({
    filters,
    onChange,
    settings,
    members = [],
    availableComarcas = [],
    availablePromotores = [],
    className = '',
    compact = false,
}) {
    const [open, setOpen] = useState(false);
    const active = countActiveFilters(filters);

    const set = (patch) => onChange({ ...filters, ...patch });

    // As listas de seleção mostram o que EXISTE na base do órgão (e não as 167
    // comarcas do estado inteiro), para o filtro ser realmente utilizável.
    const comarcaOptions = useMemo(
        () => availableComarcas.map((c) => ({ value: c, label: c })),
        [availableComarcas]
    );

    const tipoOptions = useMemo(
        () => (settings?.tipos || []).map((t) => ({ value: t.sigla, label: `${t.sigla} — ${t.descricao}` })),
        [settings]
    );

    const resultadoOptions = useMemo(
        () => (settings?.resultados || []).map((r) => ({ value: r, label: r })),
        [settings]
    );

    const responsavelOptions = useMemo(
        () => members
            .filter((m) => m.active !== false)
            .map((m) => ({ value: m.user_id, label: m.user_name || m.user_email || m.user_id })),
        [members]
    );

    return (
        <div className={`flex flex-col sm:flex-row gap-2 ${className}`}>
            <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    value={filters.busca}
                    onChange={(e) => set({ busca: e.target.value })}
                    placeholder="Buscar por processo, comarca, promotor, observação..."
                    className="pl-9 h-9"
                />
            </div>

            <div className="flex items-center gap-2">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2 h-9">
                            <Filter className="w-4 h-4" />
                            Filtros
                            {active > 0 && (
                                <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[11px]">
                                    {active}
                                </Badge>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(92vw,26rem)] p-4 space-y-4" align="end">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 dark:text-slate-400">Data do júri (de)</Label>
                                <Input
                                    type="date"
                                    value={filters.dataDe}
                                    onChange={(e) => set({ dataDe: e.target.value })}
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 dark:text-slate-400">Data do júri (até)</Label>
                                <Input
                                    type="date"
                                    value={filters.dataAte}
                                    onChange={(e) => set({ dataAte: e.target.value })}
                                    className="h-9"
                                />
                            </div>
                        </div>

                        <MultiSelect
                            label="Comarca"
                            options={comarcaOptions}
                            selected={filters.comarcas}
                            onChange={(comarcas) => set({ comarcas })}
                            placeholder="Todas as comarcas"
                        />

                        <MultiSelect
                            label="Matéria / Tipo de júri"
                            options={tipoOptions}
                            selected={filters.tipos}
                            onChange={(tipos) => set({ tipos })}
                            placeholder="Todas as matérias"
                        />

                        <MultiSelect
                            label="Espécie de resultado"
                            options={resultadoOptions}
                            selected={filters.resultados}
                            onChange={(resultados) => set({ resultados })}
                            placeholder="Todas as espécies"
                        />

                        {!compact && responsavelOptions.length > 0 && (
                            <MultiSelect
                                label="Responsável no órgão"
                                options={responsavelOptions}
                                selected={filters.responsaveis}
                                onChange={(responsaveis) => set({ responsaveis })}
                                placeholder="Todos os responsáveis"
                            />
                        )}

                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500 dark:text-slate-400">
                                Promotor(a) contém
                            </Label>
                            <Input
                                value={filters.promotor}
                                onChange={(e) => set({ promotor: e.target.value })}
                                placeholder={availablePromotores[0] ? `ex.: ${availablePromotores[0]}` : 'Parte do nome'}
                                className="h-9"
                                list="jurimetria-promotores"
                            />
                            <datalist id="jurimetria-promotores">
                                {availablePromotores.slice(0, 200).map((p) => <option key={p} value={p} />)}
                            </datalist>
                        </div>

                        <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Somente júris efetivos</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Exclui as sessões com conselho dissolvido, que não têm julgamento de mérito.
                                </p>
                            </div>
                            <Switch
                                checked={filters.somenteEfetivos}
                                onCheckedChange={(somenteEfetivos) => set({ somenteEfetivos })}
                            />
                        </div>

                        <div className="flex justify-between pt-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onChange({ ...EMPTY_JURIMETRIA_FILTERS })}
                                disabled={active === 0}
                                className="gap-2"
                            >
                                <FilterX className="w-4 h-4" />
                                Limpar tudo
                            </Button>
                            <Button size="sm" onClick={() => setOpen(false)}>Aplicar</Button>
                        </div>
                    </PopoverContent>
                </Popover>

                {active > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 gap-2 text-slate-500"
                        onClick={() => onChange({ ...EMPTY_JURIMETRIA_FILTERS })}
                    >
                        <FilterX className="w-4 h-4" />
                        <span className="hidden sm:inline">Limpar</span>
                    </Button>
                )}
            </div>
        </div>
    );
}
