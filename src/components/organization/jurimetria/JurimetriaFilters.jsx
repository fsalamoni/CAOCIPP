import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Filter, FilterX, ChevronDown, X, SlidersHorizontal, Info } from 'lucide-react';
import { tipoLabel, formatDuracao } from '@/lib/jurimetriaEngine';
import {
    JURIMETRIA_REALIZACOES, JURIMETRIA_DEFAULT_ANALYSIS,
    JURIMETRIA_EXPEDIENTE_SITUACOES, expedienteMeta,
} from '@/constants/jurimetria';

/** Estado inicial dos filtros — compartilhado por todas as abas da Jurimetria. */
export const EMPTY_JURIMETRIA_FILTERS = {
    busca: '',
    comarcas: [],
    tipos: [],
    // Realização vazia = todas. A tabela de Júris é a base de dados e mostra
    // tudo; quem restringe a ANÁLISE às sessões realizadas é a opção de
    // análise `somenteRealizados`, não este filtro.
    realizacoes: [],
    resultados: [],
    promotor: '',
    responsaveis: [],
    dataDe: '',
    dataAte: '',
    somenteEfetivos: false,
    // Situação de expediente (dentro / prolongou / antecipou / sem expediente).
    expedientes: [],
    // Duração da sessão, em MINUTOS. Vazio = sem limite.
    duracaoMin: '',
    duracaoMax: '',
};

/**
 * A duração é guardada em minutos (a unidade dos cálculos), mas ninguém pensa
 * a duração de um júri em minutos — o campo fala em horas e converte aqui.
 */
function horasDe(minutos) {
    if (minutos === '' || minutos === undefined || minutos === null) return '';
    const n = Number(minutos);
    if (!Number.isFinite(n)) return '';
    return String(Math.round((n / 60) * 100) / 100);
}

function minutosDe(horas) {
    const texto = String(horas ?? '').trim();
    if (!texto) return '';
    const n = Number(texto);
    if (!Number.isFinite(n) || n < 0) return '';
    return String(Math.round(n * 60));
}

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
    count += (filters.realizacoes?.length || 0) > 0 ? 1 : 0;
    count += (filters.responsaveis?.length || 0) > 0 ? 1 : 0;
    count += (filters.expedientes?.length || 0) > 0 ? 1 : 0;
    if (filters.duracaoMin !== '' && filters.duracaoMin !== undefined) count += 1;
    if (filters.duracaoMax !== '' && filters.duracaoMax !== undefined) count += 1;
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
    if (filters.realizacoes?.length) {
        const rotulos = filters.realizacoes.map(
            (v) => JURIMETRIA_REALIZACOES.find((r) => r.value === v)?.label || v
        );
        partes.push(`realização: ${rotulos.join(', ')}`);
    }
    if (filters.promotor) partes.push(`promotor contém "${filters.promotor}"`);
    if (filters.responsaveis?.length) partes.push(`${filters.responsaveis.length} responsável(is)`);
    if (filters.expedientes?.length) {
        const rotulos = filters.expedientes.map((v) => expedienteMeta(v).label);
        partes.push(`expediente: ${rotulos.join(', ')}`);
    }
    if (filters.duracaoMin !== '' && filters.duracaoMin !== undefined) {
        partes.push(`duração a partir de ${formatDuracao(Number(filters.duracaoMin))}`);
    }
    if (filters.duracaoMax !== '' && filters.duracaoMax !== undefined) {
        partes.push(`duração até ${formatDuracao(Number(filters.duracaoMax))}`);
    }
    if (filters.somenteEfetivos) partes.push('somente júris efetivos');
    if (filters.busca) partes.push(`busca "${filters.busca}"`);
    return partes.length ? `Filtros: ${partes.join('; ')}` : 'Sem filtros aplicados';
}

/**
 * Descrição textual das opções de análise. Vai no cabeçalho dos documentos
 * exportados: dois relatórios do mesmo período podem divergir legitimamente, e
 * o leitor precisa saber qual critério gerou cada um.
 */
export function describeAnalysis(analysis) {
    const opts = { ...JURIMETRIA_DEFAULT_ANALYSIS, ...(analysis || {}) };
    const partes = [
        opts.somenteRealizados
            ? 'apenas sessões realizadas'
            : 'todas as sessões (inclusive redesignadas e canceladas)',
    ];
    if (opts.excluirNaoInformados) partes.push('sem os grupos não informados');
    return `Critério: ${partes.join('; ')}`;
}

/**
 * Campo de duração em horas.
 *
 * O filtro é guardado em minutos, mas converter a cada tecla apagaria o que a
 * pessoa está digitando: em "2.5", o passo intermediário "2." não é número, e
 * o campo se esvaziaria no meio da digitação. O texto digitado vive aqui; o
 * valor em minutos só sobe quando o que está escrito é um número.
 */
function DuracaoInput({ minutos, onChange, placeholder, ...rest }) {
    const [texto, setTexto] = useState(() => horasDe(minutos));
    const [focado, setFocado] = useState(false);

    // Enquanto o campo não está em edição, ele segue o filtro (que pode ter
    // sido limpo pelo botão "Limpar filtros", por exemplo).
    useEffect(() => {
        if (!focado) setTexto(horasDe(minutos));
    }, [minutos, focado]);

    return (
        <Input
            type="number"
            min={0}
            step={0.5}
            value={texto}
            onFocus={() => setFocado(true)}
            onBlur={() => { setFocado(false); setTexto(horasDe(minutos)); }}
            onChange={(e) => {
                const valor = e.target.value;
                setTexto(valor);
                const convertido = minutosDe(valor);
                // Campo vazio limpa o filtro; texto incompleto ("2.") apenas
                // não altera nada até virar número.
                if (valor.trim() === '' || convertido !== '') onChange(convertido);
            }}
            placeholder={placeholder}
            className="h-9"
            {...rest}
        />
    );
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
    analysis,
    onAnalysisChange,
    className = '',
    compact = false,
}) {
    const [open, setOpen] = useState(false);
    const [analysisOpen, setAnalysisOpen] = useState(false);
    const active = countActiveFilters(filters);
    const opts = { ...JURIMETRIA_DEFAULT_ANALYSIS, ...(analysis || {}) };
    const setAnalysis = (patch) => onAnalysisChange?.({ ...opts, ...patch });
    // Quantas opções estão fora do padrão (para sinalizar no botão).
    const analysisChanged = Object.keys(JURIMETRIA_DEFAULT_ANALYSIS)
        .filter((k) => opts[k] !== JURIMETRIA_DEFAULT_ANALYSIS[k]).length;

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

    const realizacaoOptions = useMemo(
        () => JURIMETRIA_REALIZACOES.map((r) => ({ value: r.value, label: r.label })),
        []
    );

    const expedienteOptions = useMemo(
        () => JURIMETRIA_EXPEDIENTE_SITUACOES.map((e) => ({ value: e.value, label: e.label })),
        []
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

                        <MultiSelect
                            label="Realização da sessão"
                            options={realizacaoOptions}
                            selected={filters.realizacoes || []}
                            onChange={(realizacoes) => set({ realizacoes })}
                            placeholder="Todas as sessões"
                        />

                        <MultiSelect
                            label="Expediente"
                            options={expedienteOptions}
                            selected={filters.expedientes || []}
                            onChange={(expedientes) => set({ expedientes })}
                            placeholder="Qualquer situação"
                        />

                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500 dark:text-slate-400">
                                Duração da sessão (horas)
                            </Label>
                            <div className="grid grid-cols-2 gap-3">
                                <DuracaoInput
                                    minutos={filters.duracaoMin}
                                    onChange={(duracaoMin) => set({ duracaoMin })}
                                    placeholder="mínimo"
                                    aria-label="Duração mínima em horas"
                                />
                                <DuracaoInput
                                    minutos={filters.duracaoMax}
                                    onChange={(duracaoMax) => set({ duracaoMax })}
                                    placeholder="máximo"
                                    aria-label="Duração máxima em horas"
                                />
                            </div>
                            <p className="text-[11px] text-slate-400">
                                Filtrar por duração deixa de fora os júris sem horário de início ou de
                                conclusão — não há como afirmar nada sobre um tempo que não se conhece.
                            </p>
                        </div>

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

                {onAnalysisChange && (
                    <Popover open={analysisOpen} onOpenChange={setAnalysisOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 h-9">
                                <SlidersHorizontal className="w-4 h-4" />
                                <span className="hidden sm:inline">Análise</span>
                                {analysisChanged > 0 && (
                                    <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[11px]">
                                        {analysisChanged}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[min(92vw,24rem)] p-4 space-y-3" align="end">
                            <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                    Opções de análise
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Definem COMO os júris do recorte são contados no Painel, nos
                                    Relatórios e nos Relatórios dinâmicos. A aba Júris continua
                                    mostrando tudo o que está gravado.
                                </p>
                            </div>

                            <label className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 cursor-pointer">
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium">
                                        Somente sessões realizadas
                                    </span>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                                        Deixa de fora as redesignadas e as canceladas, que não
                                        produziram julgamento.
                                    </span>
                                </span>
                                <Switch
                                    checked={opts.somenteRealizados}
                                    onCheckedChange={(somenteRealizados) => setAnalysis({ somenteRealizados })}
                                />
                            </label>

                            <label className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 cursor-pointer">
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium">
                                        Ignorar “(não informado)”
                                    </span>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                                        Remove dos gráficos, rankings e cruzamentos os grupos sem
                                        valor preenchido.
                                    </span>
                                </span>
                                <Switch
                                    checked={opts.excluirNaoInformados}
                                    onCheckedChange={(excluirNaoInformados) => setAnalysis({ excluirNaoInformados })}
                                />
                            </label>

                            <p className="text-[11px] text-slate-400 flex items-start gap-1.5">
                                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                O critério escolhido aparece no cabeçalho de todo documento exportado.
                            </p>

                            {analysisChanged > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full h-8 text-xs gap-2"
                                    onClick={() => onAnalysisChange({ ...JURIMETRIA_DEFAULT_ANALYSIS })}
                                >
                                    <FilterX className="w-3.5 h-3.5" />
                                    Voltar ao padrão
                                </Button>
                            )}
                        </PopoverContent>
                    </Popover>
                )}

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
