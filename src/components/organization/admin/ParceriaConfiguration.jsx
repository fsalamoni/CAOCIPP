import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { updateOrganization } from '@/services/functionsService';
import { toast } from 'sonner';
import { Plus, Trash2, RotateCcw, Send, Sparkles, Clock, FilePlus2, Tag } from 'lucide-react';

const DEFAULT_TIPOS = ['Convênio', 'Termo de Cooperação', 'Termo de Fomento'];
const DEFAULT_ADITIVO_TIPOS = [
    'Aditivo de Prazo',
    'Aditivo de Valor',
    'Aditivo de Alteração',
    'Aditivo de Reequilíbrio',
    'Aditivo de Execução',
];
const DEFAULT_VIGENCIA_OPTIONS = [
    '6 meses', '12 meses', '24 meses', '36 meses', '60 meses', 'Indeterminado',
];
const DEFAULT_THIRD_PARTIES = ['Parceiro', 'Convenente', 'Outro Órgão Público', 'Terceiro'];

/**
 * ParceriaConfiguration — Configuração completa do módulo de Parcerias por órgão.
 *
 * Persistência: organization.parceriaSettings + organization.thirdPartiesSettingsParcerias
 *   - tipos: lista de tipos de parceria (Convênio, Termo de Cooperação, etc.)
 *   - aditivoTipos: lista de tipos de aditivo (Prazo, Valor, Alteração, etc.)
 *   - vigenciaOptions: lista de vigências pré-definidas (12 meses, 24 meses, etc.)
 *   - categorias: tags opcionais para classificar parcerias
 *   - thirdPartyPhaseEnabled: liga/desliga a fase "Aguarda Terceiros" no Kanban
 *   - autoExtinguishOnEnd: indica se Parcerias devem ser extintas ao passar a data
 *     final (lógica de execução é feita por Cloud Function; aqui só persiste a preferência)
 *
 * A lista de terceiros fica em organization.thirdPartiesSettingsParcerias
 * (mesmo padrão dos painéis de Consultas/Expedientes, com permissões
 * separadas por painel).
 */
export default function ParceriaConfiguration({ organization }) {
    return (
        <div className="space-y-6">
            <TiposSection organization={organization} />
            <AditivoTiposSection organization={organization} />
            <VigenciaOptionsSection organization={organization} />
            <CategoriasSection organization={organization} />
            <ThirdPartiesSection organization={organization} />
            <PhasesToggleSection organization={organization} />
        </div>
    );
}

// ============================================================================
// Hook de save genérico (com debounce de 2s para evitar saves duplicados
// quando o admin toca várias vezes em "Salvar" — mesmo padrão de PR #28).
// ============================================================================
function useDebouncedSave(organization, field) {
    const savingRef = useRef(false);
    const save = async (value) => {
        savingRef.current = true;
        try {
            await updateOrganization({
                organizationId: organization.id,
                data: { [field]: value },
            });
        } catch (error) {
            toast.error('Erro ao salvar: ' + (error?.message || 'tente novamente'));
            throw error;
        } finally {
            setTimeout(() => { savingRef.current = false; }, 2000);
        }
    };
    return save;
}

// ============================================================================
// SEÇÃO 1: Tipos de Parceria
// ============================================================================
function TiposSection({ organization }) {
    const [tipos, setTipos] = useState([]);
    const [newTipo, setNewTipo] = useState('');
    const save = useDebouncedSave(organization, 'parceriaSettings');
    const loaded = useRef(false);

    useEffect(() => {
        if (loaded.current) return;
        setTipos(organization?.parceriaSettings?.tipos || DEFAULT_TIPOS);
        loaded.current = true;
    }, [organization]);

    const addTipo = async () => {
        const trimmed = newTipo.trim();
        if (!trimmed) return;
        if (tipos.includes(trimmed)) {
            toast.error('Este tipo já existe.');
            return;
        }
        const updated = [...tipos, trimmed];
        setTipos(updated);
        setNewTipo('');
        try {
            await save({ ...(organization?.parceriaSettings || {}), tipos: updated });
            toast.success('Tipo adicionado!');
        } catch { setTipos(tipos); }
    };

    const removeTipo = async (t) => {
        if (!window.confirm(`Remover "${t}" da lista de tipos?`)) return;
        const updated = tipos.filter((tt) => tt !== t);
        setTipos(updated);
        try {
            await save({ ...(organization?.parceriaSettings || {}), tipos: updated });
            toast.success('Tipo removido!');
        } catch { setTipos(tipos); }
    };

    const restore = async () => {
        if (!window.confirm('Restaurar lista padrão de Tipos de Parceria?')) return;
        setTipos(DEFAULT_TIPOS);
        try {
            await save({ ...(organization?.parceriaSettings || {}), tipos: DEFAULT_TIPOS });
            toast.success('Lista padrão restaurada!');
        } catch { /* já tratado */ }
    };

    return (
        <ConfigCard
            title="Tipos de Parceria"
            description="Opções que aparecem no campo 'Tipo de Parceria' ao criar ou editar uma Parceria."
            icon={Sparkles}
            onRestore={restore}
            restoreLabel="Restaurar padrão"
        >
            <ChipList items={tipos} onRemove={removeTipo} colorClass="bg-indigo-50 dark:bg-indigo-900/30" />
            <InlineAddInput
                value={newTipo}
                onChange={setNewTipo}
                onSubmit={addTipo}
                placeholder="Novo tipo de Parceria (ex.: Acordo de Cooperação)…"
            />
        </ConfigCard>
    );
}

// ============================================================================
// SEÇÃO 2: Tipos de Aditivo
// ============================================================================
function AditivoTiposSection({ organization }) {
    const [tipos, setTipos] = useState([]);
    const [newTipo, setNewTipo] = useState('');
    const save = useDebouncedSave(organization, 'parceriaSettings');
    const loaded = useRef(false);

    useEffect(() => {
        if (loaded.current) return;
        setTipos(organization?.parceriaSettings?.aditivoTipos || DEFAULT_ADITIVO_TIPOS);
        loaded.current = true;
    }, [organization]);

    const add = async () => {
        const trimmed = newTipo.trim();
        if (!trimmed) return;
        if (tipos.includes(trimmed)) {
            toast.error('Este tipo de aditivo já existe.');
            return;
        }
        const updated = [...tipos, trimmed];
        setTipos(updated);
        setNewTipo('');
        try {
            await save({ ...(organization?.parceriaSettings || {}), aditivoTipos: updated });
            toast.success('Tipo de aditivo adicionado!');
        } catch { setTipos(tipos); }
    };

    const remove = async (t) => {
        if (!window.confirm(`Remover "${t}" da lista de tipos de aditivo?`)) return;
        const updated = tipos.filter((tt) => tt !== t);
        setTipos(updated);
        try {
            await save({ ...(organization?.parceriaSettings || {}), aditivoTipos: updated });
            toast.success('Tipo de aditivo removido!');
        } catch { setTipos(tipos); }
    };

    const restore = async () => {
        if (!window.confirm('Restaurar lista padrão de Tipos de Aditivo?')) return;
        setTipos(DEFAULT_ADITIVO_TIPOS);
        try {
            await save({ ...(organization?.parceriaSettings || {}), aditivoTipos: DEFAULT_ADITIVO_TIPOS });
            toast.success('Lista padrão restaurada!');
        } catch { /* já tratado */ }
    };

    return (
        <ConfigCard
            title="Tipos de Aditivo"
            description="Opções que aparecem no campo 'Tipo' ao criar um aditivo (prazo, valor, alteração, etc.)."
            icon={FilePlus2}
            onRestore={restore}
            restoreLabel="Restaurar padrão"
        >
            <ChipList items={tipos} onRemove={remove} colorClass="bg-amber-50 dark:bg-amber-900/30" />
            <InlineAddInput
                value={newTipo}
                onChange={setNewTipo}
                onSubmit={add}
                placeholder="Novo tipo de aditivo (ex.: Aditivo de Reequilíbrio)…"
            />
        </ConfigCard>
    );
}

// ============================================================================
// SEÇÃO 3: Opções de Vigência
// ============================================================================
function VigenciaOptionsSection({ organization }) {
    const [options, setOptions] = useState([]);
    const [newOpt, setNewOpt] = useState('');
    const save = useDebouncedSave(organization, 'parceriaSettings');
    const loaded = useRef(false);

    useEffect(() => {
        if (loaded.current) return;
        setOptions(organization?.parceriaSettings?.vigenciaOptions || DEFAULT_VIGENCIA_OPTIONS);
        loaded.current = true;
    }, [organization]);

    const add = async () => {
        const trimmed = newOpt.trim();
        if (!trimmed) return;
        if (options.includes(trimmed)) {
            toast.error('Esta opção de vigência já existe.');
            return;
        }
        const updated = [...options, trimmed];
        setOptions(updated);
        setNewOpt('');
        try {
            await save({ ...(organization?.parceriaSettings || {}), vigenciaOptions: updated });
            toast.success('Opção de vigência adicionada!');
        } catch { setOptions(options); }
    };

    const remove = async (o) => {
        if (!window.confirm(`Remover "${o}" da lista de vigências?`)) return;
        const updated = options.filter((oo) => oo !== o);
        setOptions(updated);
        try {
            await save({ ...(organization?.parceriaSettings || {}), vigenciaOptions: updated });
            toast.success('Opção de vigência removida!');
        } catch { setOptions(options); }
    };

    const restore = async () => {
        if (!window.confirm('Restaurar opções padrão de Vigência?')) return;
        setOptions(DEFAULT_VIGENCIA_OPTIONS);
        try {
            await save({ ...(organization?.parceriaSettings || {}), vigenciaOptions: DEFAULT_VIGENCIA_OPTIONS });
            toast.success('Opções padrão restauradas!');
        } catch { /* já tratado */ }
    };

    return (
        <ConfigCard
            title="Vigência (opções pré-definidas)"
            description="Opções que aparecem no campo 'Vigência' ao criar ou editar uma Parceria. O usuário também pode digitar um valor livre."
            icon={Clock}
            onRestore={restore}
            restoreLabel="Restaurar padrão"
        >
            <ChipList items={options} onRemove={remove} colorClass="bg-emerald-50 dark:bg-emerald-900/30" />
            <InlineAddInput
                value={newOpt}
                onChange={setNewOpt}
                onSubmit={add}
                placeholder="Nova opção de vigência (ex.: 48 meses)…"
            />
        </ConfigCard>
    );
}

// ============================================================================
// SEÇÃO 4: Categorias (tags opcionais)
// ============================================================================
function CategoriasSection({ organization }) {
    const [cats, setCats] = useState([]);
    const [newCat, setNewCat] = useState('');
    const save = useDebouncedSave(organization, 'parceriaSettings');
    const loaded = useRef(false);

    useEffect(() => {
        if (loaded.current) return;
        setCats(organization?.parceriaSettings?.categorias || []);
        loaded.current = true;
    }, [organization]);

    const add = async () => {
        const trimmed = newCat.trim();
        if (!trimmed) return;
        if (cats.includes(trimmed)) {
            toast.error('Esta categoria já existe.');
            return;
        }
        const updated = [...cats, trimmed];
        setCats(updated);
        setNewCat('');
        try {
            await save({ ...(organization?.parceriaSettings || {}), categorias: updated });
            toast.success('Categoria adicionada!');
        } catch { setCats(cats); }
    };

    const remove = async (c) => {
        if (!window.confirm(`Remover a categoria "${c}"?`)) return;
        const updated = cats.filter((cc) => cc !== c);
        setCats(updated);
        try {
            await save({ ...(organization?.parceriaSettings || {}), categorias: updated });
            toast.success('Categoria removida!');
        } catch { setCats(cats); }
    };

    return (
        <ConfigCard
            title="Categorias (opcional)"
            description="Tags para classificar Parcerias (ex.: 'Saúde', 'Educação', 'Infraestrutura'). Diferente dos Tipos, que são formais. Pode ficar vazio."
            icon={Tag}
        >
            <ChipList items={cats} onRemove={remove} colorClass="bg-slate-100 dark:bg-slate-800" emptyMessage="Nenhuma categoria configurada. O campo 'Categoria' aparecerá vazio na criação." />
            <InlineAddInput
                value={newCat}
                onChange={setNewCat}
                onSubmit={add}
                placeholder="Nova categoria…"
            />
        </ConfigCard>
    );
}

// ============================================================================
// SEÇÃO 5: Lista de Terceiros (campo separado por painel)
// ============================================================================
function ThirdPartiesSection({ organization }) {
    const [thirdParties, setThirdParties] = useState([]);
    const [newThirdParty, setNewThirdParty] = useState('');
    const save = useDebouncedSave(organization, 'thirdPartiesSettingsParcerias');
    const loaded = useRef(false);

    useEffect(() => {
        if (loaded.current) return;
        setThirdParties(organization?.thirdPartiesSettingsParcerias || DEFAULT_THIRD_PARTIES);
        loaded.current = true;
    }, [organization]);

    const add = async () => {
        const trimmed = newThirdParty.trim();
        if (!trimmed) return;
        if (thirdParties.includes(trimmed)) {
            toast.error('Este terceiro já existe.');
            return;
        }
        const updated = [...thirdParties, trimmed];
        setThirdParties(updated);
        setNewThirdParty('');
        try {
            await save(updated);
            toast.success('Terceiro adicionado!');
        } catch { setThirdParties(thirdParties); }
    };

    const remove = async (name) => {
        if (!window.confirm(`Remover "${name}" da lista de terceiros?`)) return;
        const updated = thirdParties.filter((t) => t !== name);
        setThirdParties(updated);
        try {
            await save(updated);
            toast.success('Terceiro removido!');
        } catch { setThirdParties(thirdParties); }
    };

    return (
        <ConfigCard
            title="Lista de Terceiros"
            description="Opções que aparecem no campo 'Terceiro' ao mover uma Parceria para a fase 'Aguarda Terceiros' do Kanban. Lista independente das de Consultas e Expedientes."
            icon={Send}
        >
            <ChipList items={thirdParties} onRemove={remove} colorClass="bg-cyan-50 dark:bg-cyan-900/30" />
            <InlineAddInput
                value={newThirdParty}
                onChange={setNewThirdParty}
                onSubmit={add}
                placeholder="Novo terceiro…"
            />
        </ConfigCard>
    );
}

// ============================================================================
// SEÇÃO 6: Toggles de comportamento do módulo
// ============================================================================
function PhasesToggleSection({ organization }) {
    const [thirdPartyPhaseEnabled, setThirdPartyPhaseEnabled] = useState(true);
    const [autoExtinguishOnEnd, setAutoExtinguishOnEnd] = useState(false);
    const [savingFlag, setSavingFlag] = useState(null);
    const save = useDebouncedSave(organization, 'parceriaSettings');
    const loaded = useRef(false);

    useEffect(() => {
        if (loaded.current) return;
        const s = organization?.parceriaSettings || {};
        setThirdPartyPhaseEnabled(s.thirdPartyPhaseEnabled !== false);
        setAutoExtinguishOnEnd(s.autoExtinguishOnEnd === true);
        loaded.current = true;
    }, [organization]);

    const saveToggle = async (key, value) => {
        setSavingFlag(key);
        try {
            await save({ ...(organization?.parceriaSettings || {}), [key]: value });
            toast.success('Preferência salva!');
        } catch { /* já tratado */ }
        finally { setSavingFlag(null); }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Comportamento do módulo</CardTitle>
                <CardDescription>
                    Toggles que controlam o comportamento do módulo de Parcerias neste órgão.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="min-w-0">
                        <Label className="text-sm font-semibold">Fase "Aguarda Terceiros"</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Habilita/desabilita a coluna "Aguarda Terceiros" no Kanban deste órgão.
                            Quando desligada, parcerias vão direto de "Revisão" para "Parcerias" (formalização).
                            Mesmo padrão do painel de Consultas.
                        </p>
                    </div>
                    <Switch
                        checked={thirdPartyPhaseEnabled}
                        onCheckedChange={(v) => {
                            setThirdPartyPhaseEnabled(v);
                            saveToggle('thirdPartyPhaseEnabled', v);
                        }}
                        disabled={savingFlag === 'thirdPartyPhaseEnabled'}
                        aria-label="Habilitar fase Aguarda Terceiros"
                    />
                </div>

                <div className="flex items-start justify-between gap-4 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="min-w-0">
                        <Label className="text-sm font-semibold">Extinguir automaticamente ao fim da vigência</Label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Quando ligado, parcerias cuja data final já passou serão extintas automaticamente
                            por uma rotina diária. Útil para limpar parcerias vencidas sem ação manual.
                        </p>
                    </div>
                    <Switch
                        checked={autoExtinguishOnEnd}
                        onCheckedChange={(v) => {
                            setAutoExtinguishOnEnd(v);
                            saveToggle('autoExtinguishOnEnd', v);
                        }}
                        disabled={savingFlag === 'autoExtinguishOnEnd'}
                        aria-label="Extinguir Parcerias automaticamente ao fim da vigência"
                    />
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Componentes auxiliares de UI
// ============================================================================
function ConfigCard({ title, description, icon: Icon, onRestore, restoreLabel, children }) {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        {Icon && (
                            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                                <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <CardTitle className="text-base">{title}</CardTitle>
                            <CardDescription>{description}</CardDescription>
                        </div>
                    </div>
                    {onRestore && (
                        <Button variant="outline" size="sm" onClick={onRestore} className="shrink-0">
                            <RotateCcw className="w-4 h-4 mr-2" />
                            {restoreLabel || 'Restaurar padrão'}
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">{children}</CardContent>
        </Card>
    );
}

function ChipList({ items, onRemove, colorClass = 'bg-slate-100 dark:bg-slate-800', emptyMessage }) {
    if (!items || items.length === 0) {
        return emptyMessage ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 italic">{emptyMessage}</p>
        ) : null;
    }
    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item) => (
                <div key={item} className={`flex items-center gap-1 ${colorClass} px-3 py-1.5 rounded-full text-sm`}>
                    <span>{item}</span>
                    <button
                        onClick={() => onRemove(item)}
                        className="ml-1 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                        title={`Remover ${item}`}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            ))}
        </div>
    );
}

function InlineAddInput({ value, onChange, onSubmit, placeholder }) {
    return (
        <div className="flex gap-2">
            <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="max-w-md"
                onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
            />
            <Button onClick={onSubmit} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
        </div>
    );
}
