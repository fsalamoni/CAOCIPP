import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { updateOrganization } from '@/services/functionsService';
import { MATTER_CATEGORIES as DEFAULT_CATEGORIES, MATTER_SUBCATEGORIES as DEFAULT_SUBCATEGORIES } from '@/components/organization/MatterCategorySelect';
import { toast } from 'sonner';
import { Loader2, Save, Plus, Trash2, Edit2, RotateCcw } from 'lucide-react';

export default function MatterConfiguration({ organization }) {
    // Initialize state from organization settings or defaults
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState({});
    const [loading, setLoading] = useState(false);
    const [isCustom, setIsCustom] = useState(false);

    useEffect(() => {
        if (organization.matterSettings && organization.matterSettings.custom) {
            setCategories(organization.matterSettings.categories || []);
            setSubcategories(organization.matterSettings.subcategories || {});
            setIsCustom(true);
        } else {
            setCategories(DEFAULT_CATEGORIES);
            setSubcategories(DEFAULT_SUBCATEGORIES);
            setIsCustom(false);
        }
    }, [organization]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await updateOrganization({
                organizationId: organization.id,
                data: {
                    matterSettings: {
                        custom: true, // Always set custom true when saving from here
                        categories,
                        subcategories
                    }
                }
            });
            toast.success('Classificação de matérias atualizada!');
            setIsCustom(true);
        } catch (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRestoreDefaults = async () => {
        if (!window.confirm('Tem certeza? Isso reverterá todas as suas personalizações para o padrão do sistema.')) return;

        setLoading(true);
        try {
            await updateOrganization({
                organizationId: organization.id,
                data: {
                    matterSettings: {
                        custom: false,
                        categories: DEFAULT_CATEGORIES,
                        subcategories: DEFAULT_SUBCATEGORIES
                    }
                }
            });
            setCategories(DEFAULT_CATEGORIES);
            setSubcategories(DEFAULT_SUBCATEGORIES);
            setIsCustom(false);
            toast.success('Padrão restaurado com sucesso!');
        } catch (error) {
            toast.error('Erro ao restaurar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- CRUD Operations ---

    const addCategory = (name) => {
        if (!name.trim()) return;
        if (categories.includes(name)) {
            toast.error('Essa categoria já existe.');
            return;
        }
        setCategories([...categories, name]);
        setSubcategories({ ...subcategories, [name]: [] });
        toast.success(`Categoria "${name}" adicionada.`);
    };

    const removeCategory = (name) => {
        if (!window.confirm(`Excluir a categoria "${name}" e todas as suas subcategorias?`)) return;
        setCategories(categories.filter(c => c !== name));
        const newSubs = { ...subcategories };
        delete newSubs[name];
        setSubcategories(newSubs);
    };

    const renameCategory = (oldName, newName) => {
        if (!newName.trim() || oldName === newName) return;
        if (categories.includes(newName)) {
            toast.error('Já existe uma categoria com este nome.');
            return;
        }

        // Update list
        setCategories(categories.map(c => c === oldName ? newName : c));

        // Update subcategories map key
        const newSubs = { ...subcategories };
        newSubs[newName] = newSubs[oldName];
        delete newSubs[oldName];
        setSubcategories(newSubs);

        toast.success('Categoria renomeada.');
    };

    const addSubcategory = (categoryName, subName) => {
        if (!subName.trim()) return;
        const currentSubs = subcategories[categoryName] || [];
        if (currentSubs.includes(subName)) {
            toast.error('Essa subcategoria já existe.');
            return;
        }
        const newSubs = [...currentSubs, subName].sort();
        setSubcategories({ ...subcategories, [categoryName]: newSubs });
        toast.success(`Subcategoria "${subName}" adicionada.`);
    };

    const removeSubcategory = (categoryName, subName) => {
        if (!window.confirm(`Excluir subcategoria "${subName}"?`)) return;
        const currentSubs = subcategories[categoryName] || [];
        setSubcategories({
            ...subcategories,
            [categoryName]: currentSubs.filter(s => s !== subName)
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h3 className="text-lg font-medium">Configuração de Matérias</h3>
                        <p className="text-sm text-slate-500">
                            Defina as categorias e subcategorias disponíveis para classificação dos processos.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleRestoreDefaults} disabled={loading} size="sm" className="text-slate-600">
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Restaurar Padrão
                        </Button>
                        <Button onClick={handleSave} disabled={loading} size="sm" className="gap-2">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Alterações
                        </Button>
                    </div>
                </div>

                {/* Add Category Input */}
                <div className="flex gap-2 mb-6">
                    <AddItemInput
                        placeholder="Nova Categoria Geral..."
                        onAdd={(val) => addCategory(val)}
                        buttonText="Adicionar Categoria"
                    />
                </div>

                {/* Categories List */}
                <Accordion type="multiple" className="w-full space-y-2">
                    {categories.map((cat, index) => (
                        <AccordionItem key={cat} value={cat} className="border rounded-lg px-4 bg-slate-50 dark:bg-slate-800/50">
                            <div className="flex items-center justify-between py-2">
                                <AccordionTrigger className="hover:no-underline py-2 flex-1 font-semibold text-slate-700">
                                    {cat}
                                </AccordionTrigger>
                                <div className="flex items-center gap-2 ml-4">
                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                                        {(subcategories[cat] || []).length} específicas
                                    </span>
                                    <EditDialog
                                        title="Renomear Categoria"
                                        initialValue={cat}
                                        onSave={(val) => renameCategory(cat, val)}
                                    />
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeCategory(cat)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            <AccordionContent className="pt-2 pb-4">
                                <div className="pl-4 border-l-2 border-slate-200 ml-2 space-y-3">
                                    <div className="flex gap-2">
                                        <AddItemInput
                                            placeholder={`Nova matéria específica para ${cat}...`}
                                            onAdd={(val) => addSubcategory(cat, val)}
                                            buttonText="Adicionar"
                                            size="sm"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {(subcategories[cat] || []).map(sub => (
                                            <div key={sub} className="flex items-center justify-between p-2 bg-white rounded border border-slate-100 text-sm group">
                                                <span>{sub}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-red-500"
                                                    onClick={() => removeSubcategory(cat, sub)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        ))}
                                        {(subcategories[cat] || []).length === 0 && (
                                            <p className="text-xs text-slate-400 italic p-2">Nenhuma matéria específica cadastrada.</p>
                                        )}
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </div>
    );
}

// Optimized sub-components to prevent re-renders and clutter

function AddItemInput({ placeholder, onAdd, buttonText, size = 'default' }) {
    const [value, setValue] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onAdd(value);
        setValue('');
    };

    return (
        <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
            <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={placeholder}
                className={size === 'sm' ? 'h-8 text-sm' : ''}
            />
            <Button type="submit" variant="secondary" className={size === 'sm' ? 'h-8 px-3' : ''}>
                <Plus className="w-4 h-4 mr-1" />
                {buttonText}
            </Button>
        </form>
    );
}

function EditDialog({ title, initialValue, onSave }) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState(initialValue);

    const handleSave = (e) => {
        e.preventDefault();
        onSave(value);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-indigo-600" onClick={(e) => e.stopPropagation()}>
                    <Edit2 className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSave} className="space-y-4 mt-4">
                    <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button type="submit">Salvar</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
