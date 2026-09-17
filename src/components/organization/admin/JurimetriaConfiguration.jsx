import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Save, Loader2, Plus, Trash2, RotateCcw, Scale, ListChecks, Columns3,
    Percent, Upload, Info, AlertTriangle, Pencil, GripVertical, Palette, Clock,
    CalendarOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { updateOrganization } from '@/services/functionsService';
import {
    resolveJurimetriaSettings,
    JURIMETRIA_DEFAULT_SETTINGS,
    JURIMETRIA_PONTUACAO_PADRAO,
    JURIMETRIA_COMARCAS,
    JURIMETRIA_TIPOS,
    JURIMETRIA_RESULTADOS,
    JURIMETRIA_CORE_FIELDS,
    JURIMETRIA_LOCKED_FIELD_KEYS,
    JURIMETRIA_CUSTOM_FIELD_TYPES,
    JURIMETRIA_IMPORT_POLICIES,
    JURIMETRIA_RESULTADO_CORES_PADRAO,
    JURIMETRIA_EXPEDIENTE_PADRAO,
    normalizeHexColor,
    corDoResultado,
} from '@/constants/jurimetria';
import ResultadoBadge from '../jurimetria/ResultadoBadge';
import { formatDateBR, feriadosNacionais } from '@/lib/jurimetriaEngine';

/** Dias da semana, na ordem em que aparecem na configuração de expediente. */
const DIAS_DA_SEMANA = [[0, 'Domingo'], [1, 'Segunda'], [2, 'Terça'], [3, 'Quarta'], [4, 'Quinta'], [5, 'Sexta'], [6, 'Sábado']];

/** Chave estável a partir de um rótulo (espelha `sanitizeFieldKey` do servidor). */
function slugKey(label) {
    const base = String(label || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
    if (!base) return '';
    return JURIMETRIA_CORE_FIELDS.some((f) => f.key === base) ? `${base}_extra` : base;
}

/** Editor genérico de lista de textos (comarcas, espécies). */
function StringListEditor({ label, description, items, onChange, placeholder, defaultItems }) {
    const [novo, setNovo] = useState('');
    const [busca, setBusca] = useState('');

    const filtrados = useMemo(() => {
        const t = busca.trim().toLowerCase();
        if (!t) return items;
        return items.filter((i) => i.toLowerCase().includes(t));
    }, [items, busca]);

    const add = () => {
        const value = novo.trim();
        if (!value) return;
        if (items.some((i) => i.toLowerCase() === value.toLowerCase())) {
            toast.error('Esse item já está na lista.');
            return;
        }
        onChange([...items, value]);
        setNovo('');
    };

    return (
        <div className="space-y-3">
            <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
            </div>

            <div className="flex gap-2">
                <Input
                    value={novo}
                    onChange={(e) => setNovo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                    placeholder={placeholder}
                    className="h-9"
                />
                <Button type="button" onClick={add} size="sm" variant="outline" className="gap-1.5 shrink-0">
                    <Plus className="w-4 h-4" />
                    Adicionar
                </Button>
            </div>

            {items.length > 12 && (
                <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Filtrar a lista..."
                    className="h-8 text-sm"
                />
            )}

            <ScrollArea className="h-56 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="p-2 space-y-1">
                    {filtrados.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-8">Nenhum item.</p>
                    )}
                    {filtrados.map((item) => (
                        <div
                            key={item}
                            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 group"
                        >
                            <span className="text-sm truncate">{item}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-rose-600"
                                onClick={() => onChange(items.filter((i) => i !== item))}
                                title="Remover"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">{items.length} item(ns)</p>
                {defaultItems && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs h-7"
                        onClick={() => onChange([...defaultItems])}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restaurar lista padrão
                    </Button>
                )}
            </div>
        </div>
    );
}

/**
 * Configuração do módulo de Jurimetria no Painel Administrativo do órgão.
 *
 * Tudo aqui é por órgão e não afeta nenhum outro: listas oficiais, pesos do
 * aproveitamento, colunas próprias da base de júris e política de importação.
 * As alterações valem imediatamente para os relatórios — nenhum dado já
 * gravado é apagado ao mudar uma lista.
 */
export default function JurimetriaConfiguration({ organization }) {
    const remote = useMemo(() => resolveJurimetriaSettings(organization), [organization]);

    const [draft, setDraft] = useState(remote);
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);

    // Diálogo de coluna personalizada
    const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
    const [fieldDraft, setFieldDraft] = useState(null);
    const [fieldOptionInput, setFieldOptionInput] = useState('');
    const [novoFeriado, setNovoFeriado] = useState('');

    // Não sobrescreve o rascunho enquanto uma gravação está em curso (o
    // onSnapshot do órgão pode chegar com o valor antigo e desfazer a edição).
    useEffect(() => {
        if (savingRef.current) return;
        setDraft(remote);
    }, [remote]);

    const set = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

    const dirty = useMemo(
        () => JSON.stringify(draft) !== JSON.stringify(remote),
        [draft, remote]
    );

    const handleSave = async () => {
        savingRef.current = true;
        setSaving(true);
        try {
            await updateOrganization({
                organizationId: organization.id,
                data: { jurimetriaSettings: draft },
            });
            toast.success('Configuração da Jurimetria salva.');
        } catch (error) {
            logger.error('[jurimetria] erro ao salvar configuração:', error);
            toast.error(error?.message || 'Não foi possível salvar. Tente novamente.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    // ---- Cores das espécies -------------------------------------------------
    //
    // O campo de texto precisa aceitar o estado intermediário: digitando
    // "#93FFC4" caractere a caractere, todo valor até o sexto dígito é
    // inválido. O rascunho fica aqui; só a cor completa desce para a
    // configuração, e o campo volta ao valor gravado ao perder o foco.
    const [corDigitada, setCorDigitada] = useState({});

    const setCor = (especie, valor) => {
        const cor = normalizeHexColor(valor);
        if (!cor) return;
        set({ resultadoCores: { ...draft.resultadoCores, [especie]: cor } });
    };

    const digitarCor = (especie, texto) => {
        setCorDigitada((prev) => ({ ...prev, [especie]: texto }));
        const cor = normalizeHexColor(texto);
        if (cor) set({ resultadoCores: { ...draft.resultadoCores, [especie]: cor } });
    };

    const encerrarEdicaoDeCor = (especie) => {
        setCorDigitada((prev) => {
            const next = { ...prev };
            delete next[especie];
            return next;
        });
    };

    // ---- Expediente ---------------------------------------------------------
    const expediente = draft.expediente || JURIMETRIA_EXPEDIENTE_PADRAO;
    const setExpediente = (patch) => set({ expediente: { ...expediente, ...patch } });

    const toggleDiaExpediente = (dia, ativo) => {
        const atual = new Set(expediente.dias || []);
        if (ativo) atual.add(dia); else atual.delete(dia);
        setExpediente({ dias: [...atual].sort((a, b) => a - b) });
    };

    const addFeriado = () => {
        const data = novoFeriado.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            toast.error('Informe uma data válida.');
            return;
        }
        if ((expediente.feriados || []).includes(data)) {
            toast.error('Esta data já está na lista.');
            return;
        }
        setExpediente({ feriados: [...(expediente.feriados || []), data].sort() });
        setNovoFeriado('');
    };

    const removeFeriado = (data) => {
        setExpediente({ feriados: (expediente.feriados || []).filter((d) => d !== data) });
    };

    // Feriados nacionais do ano corrente e do seguinte: o admin precisa VER o
    // que já é calculado antes de sair digitando data por data.
    const feriadosCalculados = useMemo(() => {
        if (!expediente.feriadosNacionais) return [];
        const ano = new Date().getFullYear();
        return [...feriadosNacionais(ano), ...feriadosNacionais(ano + 1)];
    }, [expediente.feriadosNacionais]);

    // ---- Pontuação ----------------------------------------------------------
    const setPeso = (especie, value) => {
        const n = Number(value);
        set({
            pontuacao: {
                ...draft.pontuacao,
                [especie]: Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0,
            },
        });
    };

    const toggleDissolucao = (especie, checked) => {
        const atual = new Set(draft.dissolucaoResultados);
        if (checked) atual.add(especie);
        else atual.delete(especie);
        set({ dissolucaoResultados: [...atual] });
    };

    // ---- Espécies -----------------------------------------------------------
    const setResultados = (resultados) => {
        // Pesos e dissoluções acompanham a lista: espécies removidas saem da
        // tabela, espécies novas entram com o peso padrão (ou 0).
        const pontuacao = {};
        for (const especie of resultados) {
            pontuacao[especie] = draft.pontuacao[especie]
                ?? JURIMETRIA_PONTUACAO_PADRAO[especie]
                ?? 0;
        }
        set({
            resultados,
            pontuacao,
            dissolucaoResultados: draft.dissolucaoResultados.filter((r) => resultados.includes(r)),
        });
    };

    // ---- Matérias -----------------------------------------------------------
    const addTipo = (sigla, descricao) => {
        const s = String(sigla || '').trim().toUpperCase();
        if (!s) { toast.error('Informe a sigla da matéria.'); return; }
        if (draft.tipos.some((t) => t.sigla === s)) {
            toast.error('Já existe uma matéria com essa sigla.');
            return;
        }
        set({ tipos: [...draft.tipos, { sigla: s, descricao: String(descricao || '').trim() || s }] });
    };

    // ---- Campos fixos -------------------------------------------------------
    const toggleHidden = (key, visible) => {
        const hidden = new Set(draft.hiddenFields);
        if (visible) hidden.delete(key);
        else hidden.add(key);
        set({ hiddenFields: [...hidden] });
    };

    const setLabelOverride = (key, label) => {
        const overrides = { ...draft.labelOverrides };
        const trimmed = String(label || '').trim();
        const original = JURIMETRIA_CORE_FIELDS.find((f) => f.key === key)?.label;
        if (!trimmed || trimmed === original) delete overrides[key];
        else overrides[key] = trimmed;
        set({ labelOverrides: overrides });
    };

    // ---- Colunas personalizadas --------------------------------------------
    const openNewField = () => {
        setFieldDraft({ key: '', label: '', type: 'text', options: [], required: false, isNew: true });
        setFieldOptionInput('');
        setFieldDialogOpen(true);
    };

    const openEditField = (field) => {
        setFieldDraft({ ...field, options: [...(field.options || [])], isNew: false });
        setFieldOptionInput('');
        setFieldDialogOpen(true);
    };

    const saveField = () => {
        const label = String(fieldDraft.label || '').trim();
        if (!label) { toast.error('Dê um nome à coluna.'); return; }

        const key = fieldDraft.isNew ? slugKey(label) : fieldDraft.key;
        if (!key) { toast.error('O nome da coluna precisa ter letras ou números.'); return; }

        if (fieldDraft.isNew && draft.customFields.some((f) => f.key === key)) {
            toast.error('Já existe uma coluna com esse nome.');
            return;
        }
        if (fieldDraft.type === 'select' && fieldDraft.options.length === 0) {
            toast.error('Uma coluna de lista precisa de ao menos uma opção.');
            return;
        }

        const field = {
            key,
            label,
            type: fieldDraft.type,
            options: fieldDraft.type === 'select' ? fieldDraft.options : [],
            required: fieldDraft.required === true,
        };

        set({
            customFields: fieldDraft.isNew
                ? [...draft.customFields, field]
                : draft.customFields.map((f) => (f.key === key ? field : f)),
        });
        setFieldDialogOpen(false);
        setFieldDraft(null);
    };

    const removeField = (key) => {
        set({
            customFields: draft.customFields.filter((f) => f.key !== key),
            hiddenFields: draft.hiddenFields.filter((k) => k !== key),
            labelOverrides: Object.fromEntries(
                Object.entries(draft.labelOverrides).filter(([k]) => k !== key)
            ),
        });
    };

    const moveField = (index, delta) => {
        const next = [...draft.customFields];
        const target = index + delta;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        set({ customFields: next });
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Scale className="w-5 h-5 text-indigo-500" />
                        Jurimetria
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Listas oficiais, pesos do aproveitamento e colunas da base de júris deste órgão.
                        Nenhuma outra organização é afetada.
                    </p>
                </div>
                <Button onClick={handleSave} disabled={!dirty || saving} className="gap-2 shrink-0">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar configuração
                </Button>
            </div>

            {dirty && (
                <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                        Há alterações não salvas. Elas só passam a valer depois de clicar em
                        <strong> Salvar configuração</strong>.
                    </AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="pontuacao" className="space-y-4">
                <TabsList className="flex-wrap h-auto">
                    <TabsTrigger value="pontuacao" className="gap-2">
                        <Percent className="w-4 h-4" />
                        Pontuação
                    </TabsTrigger>
                    <TabsTrigger value="listas" className="gap-2">
                        <ListChecks className="w-4 h-4" />
                        Listas oficiais
                    </TabsTrigger>
                    <TabsTrigger value="cores" className="gap-2">
                        <Palette className="w-4 h-4" />
                        Cores
                    </TabsTrigger>
                    <TabsTrigger value="expediente" className="gap-2">
                        <Clock className="w-4 h-4" />
                        Expediente
                    </TabsTrigger>
                    <TabsTrigger value="colunas" className="gap-2">
                        <Columns3 className="w-4 h-4" />
                        Colunas
                    </TabsTrigger>
                    <TabsTrigger value="importacao" className="gap-2">
                        <Upload className="w-4 h-4" />
                        Importação
                    </TabsTrigger>
                </TabsList>

                {/* ---------------- Pontuação ---------------- */}
                <TabsContent value="pontuacao" className="space-y-4 mt-0">
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Tabela de pontuação do aproveitamento</CardTitle>
                            <CardDescription>
                                Cada espécie de resultado vale de 0 a 1. O aproveitamento de uma comarca, de um
                                promotor ou de qualquer recorte é a soma desses pesos dividida pelo número de
                                júris efetivos. Alterar um peso recalcula todos os relatórios na hora.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Espécie de resultado</TableHead>
                                        <TableHead className="w-64">Peso</TableHead>
                                        <TableHead className="w-40 text-center">Conta como dissolução</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {draft.resultados.map((especie) => {
                                        const isDissolucao = draft.dissolucaoResultados.includes(especie);
                                        const peso = draft.pontuacao[especie] ?? 0;
                                        return (
                                            <TableRow key={especie}>
                                                <TableCell className="text-sm">{especie}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Slider
                                                            value={[Math.round(peso * 100)]}
                                                            onValueChange={([v]) => setPeso(especie, v / 100)}
                                                            max={100}
                                                            step={5}
                                                            disabled={isDissolucao}
                                                            className="flex-1"
                                                        />
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={1}
                                                            step={0.05}
                                                            value={peso}
                                                            onChange={(e) => setPeso(especie, e.target.value)}
                                                            disabled={isDissolucao}
                                                            className="w-20 h-8 text-sm tabular-nums"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Switch
                                                        checked={isDissolucao}
                                                        onCheckedChange={(checked) => {
                                                            toggleDissolucao(especie, checked);
                                                            if (checked) setPeso(especie, 0);
                                                        }}
                                                        aria-label={`Tratar ${especie} como dissolução`}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            <Alert>
                                <Info className="w-4 h-4" />
                                <AlertDescription className="text-xs">
                                    Uma espécie marcada como <strong>dissolução</strong> representa a sessão desfeita sem
                                    julgamento: ela entra no total de júris do período, mas fica fora do cálculo de
                                    espécies, matérias e aproveitamento — e por isso tem peso fixo em zero.
                                </AlertDescription>
                            </Alert>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => set({
                                    pontuacao: { ...JURIMETRIA_PONTUACAO_PADRAO },
                                    dissolucaoResultados: [...JURIMETRIA_DEFAULT_SETTINGS.dissolucaoResultados],
                                })}
                            >
                                <RotateCcw className="w-4 h-4" />
                                Restaurar pesos padrão
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- Listas oficiais ---------------- */}
                <TabsContent value="listas" className="space-y-4 mt-0">
                    <Alert>
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription className="text-xs">
                            Remover um item da lista <strong>não apaga</strong> os júris já gravados com aquele valor —
                            eles continuam aparecendo nos relatórios. A lista serve para o cadastro, os filtros e a
                            correção automática na importação.
                        </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card className="border-slate-200 dark:border-slate-700">
                            <CardContent className="p-4">
                                <StringListEditor
                                    label="Comarcas"
                                    description="Lista usada no cadastro, nos filtros e na correção automática da importação."
                                    items={draft.comarcas}
                                    onChange={(comarcas) => set({ comarcas })}
                                    placeholder="Ex.: Porto Alegre (0001)"
                                    defaultItems={JURIMETRIA_COMARCAS}
                                />
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 dark:border-slate-700">
                            <CardContent className="p-4">
                                <StringListEditor
                                    label="Espécies de resultado"
                                    description="As espécies disponíveis no cadastro. Cada uma tem um peso na aba Pontuação."
                                    items={draft.resultados}
                                    onChange={setResultados}
                                    placeholder="Ex.: PROCEDÊNCIA"
                                    defaultItems={JURIMETRIA_RESULTADOS}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Matérias / Tipos de júri</CardTitle>
                            <CardDescription>
                                A sigla é o valor gravado no júri; a descrição aparece nos relatórios.
                                A importação reconhece a sigla, a descrição ou as duas juntas.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <TipoAdder onAdd={addTipo} />

                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                                {draft.tipos.length === 0 && (
                                    <p className="text-sm text-slate-400 text-center py-8">Nenhuma matéria cadastrada.</p>
                                )}
                                {draft.tipos.map((tipo, index) => (
                                    <div key={tipo.sigla} className="flex items-center gap-2 px-3 py-2 group">
                                        <Badge variant="outline" className="font-mono shrink-0 w-14 justify-center">
                                            {tipo.sigla}
                                        </Badge>
                                        <Input
                                            value={tipo.descricao}
                                            onChange={(e) => {
                                                const tipos = [...draft.tipos];
                                                tipos[index] = { ...tipo, descricao: e.target.value };
                                                set({ tipos });
                                            }}
                                            className="h-8 text-sm border-0 shadow-none focus-visible:ring-1 px-2"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 opacity-0 group-hover:opacity-100 text-rose-600 shrink-0"
                                            onClick={() => set({ tipos: draft.tipos.filter((t) => t.sigla !== tipo.sigla) })}
                                            title="Remover matéria"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-xs h-7"
                                onClick={() => set({ tipos: JURIMETRIA_TIPOS.map((t) => ({ ...t })) })}
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Restaurar matérias padrão
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- Cores das espécies ---------------- */}
                <TabsContent value="cores" className="space-y-4 mt-0">
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Cor de cada espécie de resultado</CardTitle>
                            <CardDescription>
                                Numa tabela de centenas de júris, a espécie é o que o olho procura primeiro —
                                a cor responde antes da leitura. Estas cores valem na tabela de júris, na ficha
                                do processo, nos relatórios e nos gráficos deste órgão. O texto e a borda da
                                etiqueta são calculados a partir da cor escolhida, então qualquer cor continua
                                legível, inclusive no tema escuro.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Espécie de resultado</TableHead>
                                        <TableHead className="w-48">Cor</TableHead>
                                        <TableHead className="w-64">Como fica</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {draft.resultados.map((especie) => {
                                        const cor = corDoResultado(especie, draft);
                                        const padrao = JURIMETRIA_RESULTADO_CORES_PADRAO[especie];
                                        return (
                                            <TableRow key={especie}>
                                                <TableCell className="text-sm">{especie}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="color"
                                                            value={cor}
                                                            onChange={(e) => setCor(especie, e.target.value)}
                                                            className="w-10 h-8 rounded border border-slate-200 dark:border-slate-700 bg-transparent cursor-pointer p-0.5"
                                                            aria-label={`Cor de ${especie}`}
                                                        />
                                                        <Input
                                                            value={corDigitada[especie] ?? cor}
                                                            onChange={(e) => digitarCor(especie, e.target.value)}
                                                            onBlur={() => encerrarEdicaoDeCor(especie)}
                                                            className="w-28 h-8 text-xs font-mono uppercase"
                                                            maxLength={7}
                                                            spellCheck={false}
                                                        />
                                                        {padrao && cor.toLowerCase() !== padrao.toLowerCase() && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-slate-400"
                                                                title="Voltar à cor padrão desta espécie"
                                                                onClick={() => setCor(especie, padrao)}
                                                            >
                                                                <RotateCcw className="w-3.5 h-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <ResultadoBadge resultado={especie} settings={draft} />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            <Alert>
                                <Info className="w-4 h-4" />
                                <AlertDescription className="text-xs">
                                    Cores claras funcionam melhor: a etiqueta precisa se destacar sem transformar a
                                    tabela num mosaico. A <strong>dissolução</strong> vem em cinza de propósito — ela
                                    não é desfecho de mérito e não deve disputar atenção com as demais espécies.
                                </AlertDescription>
                            </Alert>

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => set({ resultadoCores: { ...JURIMETRIA_RESULTADO_CORES_PADRAO } })}
                            >
                                <RotateCcw className="w-4 h-4" />
                                Restaurar cores padrão
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- Expediente ---------------- */}
                <TabsContent value="expediente" className="space-y-4 mt-0">
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Janela de expediente</CardTitle>
                            <CardDescription>
                                Define o que conta como sessão dentro do expediente, sessão que o extrapolou e
                                sessão iniciada antes da abertura. É o que alimenta o relatório de expediente —
                                informação de gestão (escala, sobreaviso, carga do plenário), não de mérito.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
                                <div className="space-y-1.5">
                                    <Label htmlFor="exp-inicio">Início do expediente</Label>
                                    <Input
                                        id="exp-inicio"
                                        type="time"
                                        value={expediente.inicio}
                                        onChange={(e) => setExpediente({ inicio: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="exp-fim">Fim do expediente</Label>
                                    <Input
                                        id="exp-fim"
                                        type="time"
                                        value={expediente.fim}
                                        onChange={(e) => setExpediente({ fim: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Dias com expediente</Label>
                                <div className="flex flex-wrap gap-2">
                                    {DIAS_DA_SEMANA.map(([dia, nome]) => {
                                        const ativo = (expediente.dias || []).includes(dia);
                                        return (
                                            <button
                                                key={dia}
                                                type="button"
                                                onClick={() => toggleDiaExpediente(dia, !ativo)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${ativo
                                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300'
                                                    : 'bg-white border-slate-200 text-slate-400 dark:bg-slate-900 dark:border-slate-700'}`}
                                                aria-pressed={ativo}
                                            >
                                                {nome}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Um júri realizado fora destes dias entra no relatório como
                                    <strong> dia sem expediente</strong>, qualquer que tenha sido o horário.
                                </p>
                            </div>

                            <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                        Considerar os feriados nacionais
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Inclui os fixos e também os móveis — Carnaval, Sexta-feira Santa e Corpus
                                        Christi —, que são justamente os que uma lista digitada à mão esquece.
                                    </p>
                                </div>
                                <Switch
                                    checked={expediente.feriadosNacionais !== false}
                                    onCheckedChange={(v) => setExpediente({ feriadosNacionais: v })}
                                    aria-label="Considerar feriados nacionais"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Datas sem expediente do órgão</Label>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Feriados municipais, pontos facultativos e recesso. Os nacionais já entram
                                    automaticamente acima.
                                </p>
                                <div className="flex gap-2 max-w-sm">
                                    <Input
                                        type="date"
                                        value={novoFeriado}
                                        onChange={(e) => setNovoFeriado(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); addFeriado(); }
                                        }}
                                    />
                                    <Button type="button" variant="outline" onClick={addFeriado} className="gap-1.5 shrink-0">
                                        <Plus className="w-4 h-4" />
                                        Acrescentar
                                    </Button>
                                </div>

                                {(expediente.feriados || []).length > 0 ? (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {expediente.feriados.map((data) => (
                                            <Badge key={data} variant="secondary" className="gap-1.5 pr-1">
                                                <CalendarOff className="w-3 h-3" />
                                                {formatDateBR(data)}
                                                <button
                                                    type="button"
                                                    onClick={() => removeFeriado(data)}
                                                    className="ml-0.5 rounded hover:bg-slate-300/60 dark:hover:bg-slate-600 p-0.5"
                                                    aria-label={`Remover ${formatDateBR(data)}`}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 pt-1">
                                        Nenhuma data específica deste órgão.
                                    </p>
                                )}
                            </div>

                            {feriadosCalculados.length > 0 && (
                                <details className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                    <summary className="text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                                        Feriados nacionais já considerados ({feriadosCalculados.length})
                                    </summary>
                                    <div className="flex flex-wrap gap-1.5 pt-3">
                                        {feriadosCalculados.map((data) => (
                                            <Badge key={data} variant="outline" className="text-[11px] font-normal">
                                                {formatDateBR(data)}
                                            </Badge>
                                        ))}
                                    </div>
                                </details>
                            )}

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => set({ expediente: { ...JURIMETRIA_EXPEDIENTE_PADRAO } })}
                            >
                                <RotateCcw className="w-4 h-4" />
                                Restaurar expediente padrão (12h–19h, seg. a sex.)
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- Colunas ---------------- */}
                <TabsContent value="colunas" className="space-y-4 mt-0">
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Campos nativos</CardTitle>
                            <CardDescription>
                                Renomeie o rótulo exibido ou oculte um campo que este órgão não usa.
                                Número do processo e data do júri são obrigatórios e não podem ser ocultados.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                                {JURIMETRIA_CORE_FIELDS.map((field) => {
                                    const locked = JURIMETRIA_LOCKED_FIELD_KEYS.includes(field.key);
                                    const visible = !draft.hiddenFields.includes(field.key);
                                    return (
                                        <div key={field.key} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                                            <div className="min-w-0 flex-1">
                                                <Input
                                                    value={draft.labelOverrides[field.key] ?? field.label}
                                                    onChange={(e) => setLabelOverride(field.key, e.target.value)}
                                                    disabled={locked}
                                                    className="h-8 text-sm border-0 shadow-none focus-visible:ring-1 px-2"
                                                />
                                                <p className="text-[11px] text-slate-400 px-2">
                                                    chave: <span className="font-mono">{field.key}</span>
                                                    {locked && ' — campo obrigatório'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                    {visible ? 'Visível' : 'Oculto'}
                                                </span>
                                                <Switch
                                                    checked={visible}
                                                    disabled={locked}
                                                    onCheckedChange={(checked) => toggleHidden(field.key, checked)}
                                                    aria-label={`Exibir ${field.label}`}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="min-w-0">
                                    <CardTitle className="text-base">Colunas do órgão</CardTitle>
                                    <CardDescription>
                                        Campos próprios deste órgão, além dos nativos. Aparecem no cadastro, na tabela,
                                        nas exportações e como dimensão nos relatórios dinâmicos — e a importação passa
                                        a reconhecer colunas da planilha com o mesmo nome.
                                    </CardDescription>
                                </div>
                                <Button type="button" size="sm" onClick={openNewField} className="gap-2 shrink-0">
                                    <Plus className="w-4 h-4" />
                                    Nova coluna
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {draft.customFields.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-8 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                                    Nenhuma coluna própria. A base usa apenas os campos nativos.
                                </p>
                            ) : (
                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
                                    {draft.customFields.map((field, index) => (
                                        <div key={field.key} className="flex items-center gap-3 px-3 py-2.5 group">
                                            <div className="flex flex-col shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => moveField(index, -1)}
                                                    disabled={index === 0}
                                                    className="text-slate-300 hover:text-slate-500 disabled:opacity-30 leading-none text-[10px]"
                                                    title="Mover para cima"
                                                >
                                                    ▲
                                                </button>
                                                <GripVertical className="w-3.5 h-3.5 text-slate-300" />
                                                <button
                                                    type="button"
                                                    onClick={() => moveField(index, 1)}
                                                    disabled={index === draft.customFields.length - 1}
                                                    className="text-slate-300 hover:text-slate-500 disabled:opacity-30 leading-none text-[10px]"
                                                    title="Mover para baixo"
                                                >
                                                    ▼
                                                </button>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">
                                                    {field.label}
                                                    {field.required && <span className="text-rose-500 ml-1">*</span>}
                                                </p>
                                                <p className="text-[11px] text-slate-400">
                                                    {JURIMETRIA_CUSTOM_FIELD_TYPES.find((t) => t.type === field.type)?.label || field.type}
                                                    {field.type === 'select' && field.options?.length > 0 && (
                                                        <> — {field.options.length} opção(ões)</>
                                                    )}
                                                    {' · '}
                                                    <span className="font-mono">{field.key}</span>
                                                </p>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => openEditField(field)}
                                                    title="Editar coluna"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 text-rose-600"
                                                    onClick={() => removeField(field.key)}
                                                    title="Remover coluna"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Alert className="mt-4">
                                <AlertTriangle className="w-4 h-4" />
                                <AlertDescription className="text-xs">
                                    Remover uma coluna a tira da interface, mas os valores já gravados continuam nos
                                    documentos — recriá-la com o mesmo nome traz os dados de volta.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------------- Importação ---------------- */}
                <TabsContent value="importacao" className="space-y-4 mt-0">
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Comportamento da importação</CardTitle>
                            <CardDescription>
                                Estas opções definem o padrão sugerido na aba Importação. Quem importa ainda pode
                                escolher outra política naquele momento, e sempre vê a prévia antes de confirmar.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-2">
                                <Label>Quando um processo já existir com dados diferentes</Label>
                                <Select
                                    value={draft.importPolicy}
                                    onValueChange={(importPolicy) => set({ importPolicy })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {JURIMETRIA_IMPORT_POLICIES.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {JURIMETRIA_IMPORT_POLICIES.find((p) => p.value === draft.importPolicy)?.description}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Rigor da correção automática</Label>
                                    <Badge variant="secondary" className="tabular-nums">
                                        {Math.round(draft.fuzzyThreshold * 100)}%
                                    </Badge>
                                </div>
                                <Slider
                                    value={[Math.round(draft.fuzzyThreshold * 100)]}
                                    onValueChange={([v]) => set({ fuzzyThreshold: v / 100 })}
                                    min={40}
                                    max={100}
                                    step={5}
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Grau de semelhança mínimo para a importação corrigir um valor para a lista oficial
                                    (ex.: “PORTO ALEGRE” → “Porto Alegre (0001)”). Mais alto significa mais rigor:
                                    menos correções automáticas e mais valores gravados como vieram na planilha.
                                    Em 100%, só a grafia exata é aceita.
                                </p>
                            </div>

                            <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium">Exigir responsável em cada júri</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Quando ligado, o cadastro e a edição manual passam a exigir um membro do órgão
                                        como responsável. Não afeta os júris já gravados nem a importação de planilhas.
                                    </p>
                                </div>
                                <Switch
                                    checked={draft.requireResponsible}
                                    onCheckedChange={(requireResponsible) => set({ requireResponsible })}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Diálogo de coluna personalizada */}
            <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{fieldDraft?.isNew ? 'Nova coluna' : 'Editar coluna'}</DialogTitle>
                        <DialogDescription>
                            A coluna passa a valer no cadastro, na tabela, nas exportações e nos relatórios dinâmicos.
                        </DialogDescription>
                    </DialogHeader>

                    {fieldDraft && (
                        <div className="space-y-4 py-2">
                            <div className="space-y-1.5">
                                <Label>Nome da coluna</Label>
                                <Input
                                    value={fieldDraft.label}
                                    onChange={(e) => setFieldDraft({ ...fieldDraft, label: e.target.value })}
                                    placeholder="Ex.: Número de réus"
                                    autoFocus
                                />
                                {fieldDraft.isNew && fieldDraft.label && (
                                    <p className="text-[11px] text-slate-400">
                                        chave gerada: <span className="font-mono">{slugKey(fieldDraft.label) || '—'}</span>
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label>Tipo</Label>
                                <Select
                                    value={fieldDraft.type}
                                    onValueChange={(type) => setFieldDraft({ ...fieldDraft, type })}
                                    disabled={!fieldDraft.isNew}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {JURIMETRIA_CUSTOM_FIELD_TYPES.map((t) => (
                                            <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {!fieldDraft.isNew && (
                                    <p className="text-[11px] text-slate-400">
                                        O tipo não muda depois de criado, para não invalidar os dados já gravados.
                                    </p>
                                )}
                            </div>

                            {fieldDraft.type === 'select' && (
                                <div className="space-y-2">
                                    <Label>Opções da lista</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={fieldOptionInput}
                                            onChange={(e) => setFieldOptionInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key !== 'Enter') return;
                                                e.preventDefault();
                                                const value = fieldOptionInput.trim();
                                                if (!value || fieldDraft.options.includes(value)) return;
                                                setFieldDraft({ ...fieldDraft, options: [...fieldDraft.options, value] });
                                                setFieldOptionInput('');
                                            }}
                                            placeholder="Digite e pressione Enter"
                                            className="h-9"
                                        />
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {fieldDraft.options.map((option) => (
                                            <Badge key={option} variant="secondary" className="gap-1 pr-1">
                                                {option}
                                                <button
                                                    type="button"
                                                    onClick={() => setFieldDraft({
                                                        ...fieldDraft,
                                                        options: fieldDraft.options.filter((o) => o !== option),
                                                    })}
                                                    className="ml-0.5 hover:text-rose-600"
                                                >
                                                    ×
                                                </button>
                                            </Badge>
                                        ))}
                                        {fieldDraft.options.length === 0 && (
                                            <p className="text-xs text-slate-400">Nenhuma opção ainda.</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                <div>
                                    <p className="text-sm font-medium">Preenchimento obrigatório</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Vale para o cadastro manual; a importação não é bloqueada.
                                    </p>
                                </div>
                                <Switch
                                    checked={fieldDraft.required === true}
                                    onCheckedChange={(required) => setFieldDraft({ ...fieldDraft, required })}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={saveField} className="gap-2">
                            <Save className="w-4 h-4" />
                            {fieldDraft?.isNew ? 'Criar coluna' : 'Salvar coluna'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** Formulário de duas entradas para acrescentar uma matéria. */
function TipoAdder({ onAdd }) {
    const [sigla, setSigla] = useState('');
    const [descricao, setDescricao] = useState('');

    const submit = () => {
        onAdd(sigla, descricao);
        setSigla('');
        setDescricao('');
    };

    return (
        <div className="flex flex-col sm:flex-row gap-2">
            <Input
                value={sigla}
                onChange={(e) => setSigla(e.target.value.toUpperCase())}
                placeholder="Sigla"
                maxLength={10}
                className="h-9 sm:w-28 font-mono"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            />
            <Input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição da matéria"
                className="h-9 flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            />
            <Button type="button" onClick={submit} size="sm" variant="outline" className="gap-1.5 shrink-0">
                <Plus className="w-4 h-4" />
                Adicionar
            </Button>
        </div>
    );
}
