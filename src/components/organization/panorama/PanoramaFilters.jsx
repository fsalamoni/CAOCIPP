import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Filter, FilterX, ChevronDown, X, SlidersHorizontal, Info } from 'lucide-react';
import {
    PANORAMA_DEFAULT_ANALYSIS,
    PANORAMA_FAIXAS_PRESCRICAO,
    PANORAMA_TIPOS_AGRUPAVEIS,
    columnForRole,
    faixaPrescricaoMeta,
} from '@/constants/panorama';
import { formatMoeda } from '@/lib/panoramaEngine';

/** Estado inicial dos filtros. `campos` é montado a partir da base. */
export const EMPTY_PANORAMA_FILTERS = {
    busca: '',
    campos: {},
    dataDe: '',
    dataAte: '',
    valorMin: '',
    valorMax: '',
    prescricoes: [],
    regioes: [],
};

export function countActiveFilters(filters) {
    let count = 0;
    if (filters.busca) count += 1;
    if (filters.dataDe) count += 1;
    if (filters.dataAte) count += 1;
    if (String(filters.valorMin ?? '') !== '') count += 1;
    if (String(filters.valorMax ?? '') !== '') count += 1;
    count += (filters.prescricoes?.length || 0) > 0 ? 1 : 0;
    count += (filters.regioes?.length || 0) > 0 ? 1 : 0;
    for (const valores of Object.values(filters.campos || {})) {
        if (Array.isArray(valores) && valores.length > 0) count += 1;
    }
    return count;
}

/** Descrição textual dos filtros, impressa no cabeçalho dos documentos. */
export function describeFilters(filters, base) {
    const partes = [];
    if (filters.dataDe || filters.dataAte) {
        const de = filters.dataDe ? filters.dataDe.split('-').reverse().join('/') : 'início';
        const ate = filters.dataAte ? filters.dataAte.split('-').reverse().join('/') : 'hoje';
        partes.push(`período ${de} a ${ate}`);
    }
    for (const [key, valores] of Object.entries(filters.campos || {})) {
        if (!Array.isArray(valores) || valores.length === 0) continue;
        const label = (base?.columns || []).find((c) => c.key === key)?.label || key;
        partes.push(`${label}: ${valores.length <= 3 ? valores.join(', ') : `${valores.length} valores`}`);
    }
    if (filters.regioes?.length) partes.push(`região: ${filters.regioes.join(', ')}`);
    if (filters.prescricoes?.length) {
        partes.push(`prescrição: ${filters.prescricoes.map((p) => faixaPrescricaoMeta(p).label).join(', ')}`);
    }
    if (String(filters.valorMin ?? '') !== '') partes.push(`valor a partir de ${formatMoeda(filters.valorMin)}`);
    if (String(filters.valorMax ?? '') !== '') partes.push(`valor até ${formatMoeda(filters.valorMax)}`);
    if (filters.busca) partes.push(`busca "${filters.busca}"`);
    return partes.length ? `Filtros: ${partes.join('; ')}` : 'Sem filtros aplicados';
}

/** Descrição das opções de análise, para o cabeçalho dos documentos. */
export function describeAnalysis(analysis, base) {
    const opts = { ...PANORAMA_DEFAULT_ANALYSIS, ...(analysis || {}) };
    const partes = [];
    if (opts.excluirNeutros) {
        const neutros = base?.desfechos?.neutros || [];
        partes.push(`sem os desfechos que não são solução de mérito${neutros.length ? ` (${neutros.join(', ')})` : ''}`);
    } else {
        partes.push('todos os registros do recorte');
    }
    if (opts.excluirNaoInformados) partes.push('sem os grupos não informados');
    return `Critério: ${partes.join('; ')}`;
}

/** Seletor de múltipla escolha com busca interna. */
function MultiSelect({ label, options, selected, onChange, placeholder = 'Todos' }) {
    const [term, setTerm] = useState('');
    const filtered = useMemo(() => {
        const t = term.trim().toLowerCase();
        if (!t) return options;
        return options.filter((o) => String(o).toLowerCase().includes(t));
    }, [options, term]);

    const toggle = (value) => {
        const atual = new Set(selected || []);
        if (atual.has(value)) atual.delete(value); else atual.add(value);
        onChange([...atual]);
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-500 dark:text-slate-400">{label}</Label>
                {(selected?.length || 0) > 0 && (
                    <button
                        type="button"
                        onClick={() => onChange([])}
                        className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        limpar
                    </button>
                )}
            </div>
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-9 font-normal">
                        <span className="truncate text-sm">
                            {(selected?.length || 0) === 0
                                ? placeholder
                                : `${selected.length} selecionado(s)`}
                        </span>
                        <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(90vw,20rem)] p-2" align="start">
                    <Input
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        placeholder="Buscar..."
                        className="h-8 mb-2"
                    />
                    <ScrollArea className="h-56">
                        <div className="space-y-0.5 pr-2">
                            {filtered.length === 0 && (
                                <p className="text-xs text-slate-400 py-4 text-center">Nada encontrado.</p>
                            )}
                            {filtered.map((option) => (
                                <label
                                    key={option}
                                    className="flex items-start gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                    <Checkbox
                                        className="mt-0.5"
                                        checked={(selected || []).includes(option)}
                                        onCheckedChange={() => toggle(option)}
                                    />
                                    <span className="text-sm leading-tight break-words">{option}</span>
                                </label>
                            ))}
                        </div>
                    </ScrollArea>
                </PopoverContent>
            </Popover>
        </div>
    );
}

/**
 * Filtros do Panorama.
 *
 * Diferente da Jurimetria, os campos não são fixos: a barra é MONTADA a partir
 * das colunas que a base tem. Uma base de improbidade filtra por tipo de
 * improbidade; uma de consumidor, por fornecedor — sem nenhuma linha de código
 * específica para uma ou outra.
 *
 * As colunas de lista viram multisseleção com os valores que EXISTEM nos dados;
 * as de data viram período; a de valor vira faixa. Colunas de texto livre ficam
 * de fora: com centenas de valores distintos, a lista seria inútil — quem
 * procura nelas usa a busca.
 */
export default function PanoramaFilters({
    filters,
    onChange,
    base,
    registros = [],
    analysis,
    onAnalysisChange,
}) {
    const [open, setOpen] = useState(false);
    const [analysisOpen, setAnalysisOpen] = useState(false);

    const set = (patch) => onChange({ ...filters, ...patch });
    const setCampo = (key, valores) => set({ campos: { ...filters.campos, [key]: valores } });

    const active = countActiveFilters(filters);
    const opts = { ...PANORAMA_DEFAULT_ANALYSIS, ...(analysis || {}) };
    const setAnalysis = (patch) => onAnalysisChange?.({ ...opts, ...patch });
    const analysisChanged = Object.keys(PANORAMA_DEFAULT_ANALYSIS)
        .filter((k) => opts[k] !== PANORAMA_DEFAULT_ANALYSIS[k]).length;

    // Colunas que viram filtro de multisseleção, com os valores que aparecem
    // nos dados — e não os da configuração: o que interessa é o que existe.
    const camposFiltraveis = useMemo(() => {
        const cols = (base?.columns || [])
            .filter((c) => PANORAMA_TIPOS_AGRUPAVEIS.has(c.type) && c.type !== 'texto')
            .slice(0, 12);
        return cols.map((col) => {
            const valores = new Set();
            for (const r of registros) {
                const v = r.values?.[col.key];
                if (v === null || v === undefined || v === '') continue;
                valores.add(v === true ? 'Sim' : v === false ? 'Não' : String(v));
                if (valores.size > 400) break;
            }
            return {
                col,
                opcoes: [...valores].sort((a, b) => a.localeCompare(b, 'pt-BR')),
            };
        }).filter((c) => c.opcoes.length > 1);
    }, [base, registros]);

    const temData = Boolean(columnForRole(base, 'data_principal'));
    const temValor = Boolean(columnForRole(base, 'valor'));
    const temPrescricao = (base?.prescricao?.modo || 'desligado') !== 'desligado';
    const regioes = Object.keys(base?.regioes || {});

    return (
        <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    value={filters.busca}
                    onChange={(e) => set({ busca: e.target.value })}
                    placeholder="Buscar em qualquer coluna..."
                    className="pl-9"
                />
                {filters.busca && (
                    <button
                        type="button"
                        onClick={() => set({ busca: '' })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label="Limpar busca"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="flex gap-2">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="gap-2">
                            <Filter className="w-4 h-4" />
                            Filtros
                            {active > 0 && (
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[11px]">
                                    {active}
                                </Badge>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(92vw,26rem)] p-4 space-y-4 max-h-[80vh] overflow-y-auto" align="end">
                        {temData && (
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 dark:text-slate-400">De</Label>
                                    <Input
                                        type="date"
                                        value={filters.dataDe}
                                        onChange={(e) => set({ dataDe: e.target.value })}
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 dark:text-slate-400">Até</Label>
                                    <Input
                                        type="date"
                                        value={filters.dataAte}
                                        onChange={(e) => set({ dataAte: e.target.value })}
                                        className="h-9"
                                    />
                                </div>
                            </div>
                        )}

                        {camposFiltraveis.map(({ col, opcoes }) => (
                            <MultiSelect
                                key={col.key}
                                label={col.label}
                                options={opcoes}
                                selected={filters.campos?.[col.key] || []}
                                onChange={(valores) => setCampo(col.key, valores)}
                                placeholder={`Todos (${opcoes.length})`}
                            />
                        ))}

                        {regioes.length > 0 && (
                            <MultiSelect
                                label="Região"
                                options={[...regioes, 'Sem região definida']}
                                selected={filters.regioes || []}
                                onChange={(r) => set({ regioes: r })}
                                placeholder="Todas as regiões"
                            />
                        )}

                        {temPrescricao && (
                            <MultiSelect
                                label="Situação de prescrição"
                                options={PANORAMA_FAIXAS_PRESCRICAO.map((f) => f.label)}
                                selected={(filters.prescricoes || []).map((p) => faixaPrescricaoMeta(p).label)}
                                onChange={(labels) => set({
                                    prescricoes: PANORAMA_FAIXAS_PRESCRICAO
                                        .filter((f) => labels.includes(f.label))
                                        .map((f) => f.key),
                                })}
                                placeholder="Qualquer situação"
                            />
                        )}

                        {temValor && (
                            <div className="space-y-1.5">
                                <Label className="text-xs text-slate-500 dark:text-slate-400">
                                    Valor (R$)
                                </Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        type="number"
                                        min={0}
                                        value={filters.valorMin}
                                        onChange={(e) => set({ valorMin: e.target.value })}
                                        placeholder="mínimo"
                                        className="h-9"
                                    />
                                    <Input
                                        type="number"
                                        min={0}
                                        value={filters.valorMax}
                                        onChange={(e) => set({ valorMax: e.target.value })}
                                        placeholder="máximo"
                                        className="h-9"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-400">
                                    Filtrar por valor deixa de fora os registros sem valor informado.
                                </p>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onChange({ ...EMPTY_PANORAMA_FILTERS })}
                                disabled={active === 0}
                                className="gap-2"
                            >
                                <FilterX className="w-4 h-4" />
                                Limpar filtros
                            </Button>
                            <Button size="sm" onClick={() => setOpen(false)}>Aplicar</Button>
                        </div>
                    </PopoverContent>
                </Popover>

                {onAnalysisChange && (
                    <Popover open={analysisOpen} onOpenChange={setAnalysisOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="gap-2">
                                <SlidersHorizontal className="w-4 h-4" />
                                Análise
                                {analysisChanged > 0 && (
                                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[11px]">
                                        {analysisChanged}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[min(92vw,24rem)] p-4 space-y-4" align="end">
                            <div>
                                <p className="text-sm font-medium">Como contar o recorte</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    Diferente dos filtros, que dizem <em>o que entra</em>, estas opções
                                    dizem <em>como contar</em> o que entrou. Valem no Painel e nos
                                    Relatórios — nunca escondem registro da aba Dados.
                                </p>
                            </div>

                            <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium">Excluir desfechos sem mérito</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Tira dos cálculos os desfechos que o órgão marcou como não sendo
                                        solução de mérito — arquivamento por ilegitimidade, declínio de
                                        atribuição e semelhantes.
                                    </p>
                                </div>
                                <Switch
                                    checked={opts.excluirNeutros}
                                    onCheckedChange={(v) => setAnalysis({ excluirNeutros: v })}
                                />
                            </div>

                            <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium">Ignorar “(não informado)”</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Remove dos gráficos e tabelas os grupos formados por células vazias.
                                    </p>
                                </div>
                                <Switch
                                    checked={opts.excluirNaoInformados}
                                    onCheckedChange={(v) => setAnalysis({ excluirNaoInformados: v })}
                                />
                            </div>

                            {(base?.desfechos?.neutros || []).length === 0 && opts.excluirNeutros && (
                                <div className="flex gap-2 text-xs text-amber-600 dark:text-amber-400">
                                    <Info className="w-4 h-4 shrink-0" />
                                    <span>
                                        Nenhum desfecho está marcado como “sem mérito” na configuração
                                        desta base, então esta opção ainda não muda nada.
                                    </span>
                                </div>
                            )}

                            {analysisChanged > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => onAnalysisChange({ ...PANORAMA_DEFAULT_ANALYSIS })}
                                >
                                    Voltar ao padrão
                                </Button>
                            )}
                        </PopoverContent>
                    </Popover>
                )}
            </div>
        </div>
    );
}
