import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { updateOrganization } from '@/services/functionsService';
import { toast } from 'sonner';
import { Plus, Trash2, RotateCcw, Send } from 'lucide-react';

const DEFAULT_TIPOS = ['Convênio', 'Termo de Cooperação', 'Termo de Fomento'];
const DEFAULT_THIRD_PARTIES = ['Parceiro', 'Convenente', 'Outro Órgão Público', 'Terceiro'];

/**
 * ParceriaConfiguration — Configuração do módulo de Parcerias por órgão.
 * - Tipos de Parceria (lista customizável).
 * - Lista de Terceiros (independente das outras listas do órgão).
 */
export default function ParceriaConfiguration({ organization }) {
    const [tipos, setTipos] = useState([]);
    const [newTipo, setNewTipo] = useState('');
    const [loading, setLoading] = useState(false);
    const tiposSavingRef = useRef(false);

    const [thirdParties, setThirdParties] = useState([]);
    const [newThirdParty, setNewThirdParty] = useState('');
    const thirdPartiesSavingRef = useRef(false);

    useEffect(() => {
        if (tiposSavingRef.current) return;
        setTipos(organization?.parceriaSettings?.tipos || DEFAULT_TIPOS);
    }, [organization]);

    useEffect(() => {
        if (thirdPartiesSavingRef.current) return;
        setThirdParties(organization?.thirdPartiesSettingsParcerias || DEFAULT_THIRD_PARTIES);
    }, [organization]);

    const saveTipos = async (newList) => {
        tiposSavingRef.current = true;
        try {
            await updateOrganization({
                organizationId: organization.id,
                data: { parceriaSettings: { tipos: newList } },
            });
            toast.success('Tipos de Parceria atualizados!');
        } catch (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setTimeout(() => { tiposSavingRef.current = false; }, 2000);
        }
    };

    const saveThirdParties = async (newList) => {
        thirdPartiesSavingRef.current = true;
        try {
            await updateOrganization({
                organizationId: organization.id,
                data: { thirdPartiesSettingsParcerias: newList },
            });
            toast.success('Lista de terceiros atualizada!');
        } catch (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setTimeout(() => { thirdPartiesSavingRef.current = false; }, 2000);
        }
    };

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
        await saveTipos(updated);
    };

    const removeTipo = async (t) => {
        if (!window.confirm(`Remover "${t}" da lista de tipos?`)) return;
        const updated = tipos.filter((tt) => tt !== t);
        setTipos(updated);
        await saveTipos(updated);
    };

    const addThirdParty = async () => {
        const trimmed = newThirdParty.trim();
        if (!trimmed) return;
        if (thirdParties.includes(trimmed)) {
            toast.error('Este terceiro já existe.');
            return;
        }
        const updated = [...thirdParties, trimmed];
        setThirdParties(updated);
        setNewThirdParty('');
        await saveThirdParties(updated);
    };

    const removeThirdParty = async (name) => {
        if (!window.confirm(`Remover "${name}" da lista de terceiros?`)) return;
        const updated = thirdParties.filter((t) => t !== name);
        setThirdParties(updated);
        await saveThirdParties(updated);
    };

    const restoreDefaults = async () => {
        if (!window.confirm('Restaurar listas padrão de Tipos de Parceria?')) return;
        setLoading(true);
        setTipos(DEFAULT_TIPOS);
        await saveTipos(DEFAULT_TIPOS);
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Parcerias</CardTitle>
                            <CardDescription>
                                Configure os tipos de Parceria aceitos pelo órgão (Convênio, Termo de
                                Cooperação, Termo de Fomento) e a lista de terceiros usados na fase
                                "Aguarda Terceiros" do Kanban.
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={restoreDefaults} disabled={loading}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Restaurar Padrão (Tipos)
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Tipos de Parceria */}
                    <div className="space-y-4">
                        <Label className="text-base font-semibold">Tipos de Parceria</Label>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Opções que aparecem no campo "Tipo de Parceria" ao criar ou editar uma
                            Parceria, e na fase de formalização ("Parcerias") do Kanban.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {tipos.map((t) => (
                                <div key={t} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-sm">
                                    <span>{t}</span>
                                    <button
                                        onClick={() => removeTipo(t)}
                                        className="ml-1 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                                        title={`Remover ${t}`}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={newTipo}
                                onChange={(e) => setNewTipo(e.target.value)}
                                placeholder="Novo tipo..."
                                className="max-w-xs"
                                onKeyDown={(e) => e.key === 'Enter' && addTipo()}
                            />
                            <Button onClick={addTipo} size="sm" variant="outline">
                                <Plus className="w-4 h-4 mr-1" /> Adicionar
                            </Button>
                        </div>
                    </div>

                    <hr className="border-slate-100 dark:border-slate-800" />

                    {/* Lista de Terceiros */}
                    <div className="space-y-4">
                        <Label className="text-base font-semibold">Lista de Terceiros</Label>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Opções que aparecem no campo "Terceiro" ao mover uma Parceria para a
                            fase "Aguarda Terceiros" do Kanban. Lista independente das de
                            Consultas e Expedientes.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {thirdParties.map((tp) => (
                                <div key={tp} className="flex items-center gap-1 bg-cyan-50 dark:bg-cyan-900/30 px-3 py-1.5 rounded-full text-sm">
                                    <Send className="w-3 h-3 text-cyan-600" />
                                    <span>{tp}</span>
                                    <button
                                        onClick={() => removeThirdParty(tp)}
                                        className="ml-1 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
                                        title={`Remover ${tp}`}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={newThirdParty}
                                onChange={(e) => setNewThirdParty(e.target.value)}
                                placeholder="Novo terceiro..."
                                className="max-w-xs"
                                onKeyDown={(e) => e.key === 'Enter' && addThirdParty()}
                            />
                            <Button onClick={addThirdParty} size="sm" variant="outline">
                                <Plus className="w-4 h-4 mr-1" /> Adicionar
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
