import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { updateOrganization } from '@/services/functionsService';
import { toast } from 'sonner';
import { Loader2, Save, Plus, Trash2, RotateCcw } from 'lucide-react';

const DEFAULT_SYSTEMS = ['SIM', 'SGP', 'SPU', 'E-mail'];
const DEFAULT_ORIGINS = ['SUBINST', 'SUBADM', 'Gabinete PGJ', 'SUBGES', 'Outros'];

export default function ExpedienteConfiguration({ organization }) {
    const [systems, setSystems] = useState([]);
    const [origins, setOrigins] = useState([]);
    const [newSystem, setNewSystem] = useState('');
    const [newOrigin, setNewOrigin] = useState('');
    const [loading, setLoading] = useState(false);

    const isSavingRef = useRef(false);

    useEffect(() => {
        if (isSavingRef.current) return;

        if (organization.expedienteSettings) {
            setSystems(organization.expedienteSettings.systems || DEFAULT_SYSTEMS);
            setOrigins(organization.expedienteSettings.origins || DEFAULT_ORIGINS);
        } else {
            setSystems(DEFAULT_SYSTEMS);
            setOrigins(DEFAULT_ORIGINS);
        }
    }, [organization]);

    const saveToFirestore = async (newSystems, newOrigins) => {
        isSavingRef.current = true;
        try {
            await updateOrganization({
                organizationId: organization.id,
                data: {
                    expedienteSettings: {
                        systems: newSystems,
                        origins: newOrigins
                    }
                }
            });
            toast.success('Configurações salvas com sucesso!');
        } catch (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setTimeout(() => { isSavingRef.current = false; }, 2000);
        }
    };

    const addSystem = async () => {
        const trimmed = newSystem.trim();
        if (!trimmed) return;
        if (systems.includes(trimmed)) {
            toast.error('Este sistema já existe');
            return;
        }
        const updated = [...systems, trimmed];
        setSystems(updated);
        setNewSystem('');
        await saveToFirestore(updated, origins);
    };

    const removeSystem = async (sys) => {
        if (!window.confirm(`Remover "${sys}" da lista de sistemas?`)) return;
        const updated = systems.filter(s => s !== sys);
        setSystems(updated);
        await saveToFirestore(updated, origins);
    };

    const addOrigin = async () => {
        const trimmed = newOrigin.trim();
        if (!trimmed) return;
        if (origins.includes(trimmed)) {
            toast.error('Esta origem já existe');
            return;
        }
        const updated = [...origins, trimmed];
        setOrigins(updated);
        setNewOrigin('');
        await saveToFirestore(systems, updated);
    };

    const removeOrigin = async (orig) => {
        if (!window.confirm(`Remover "${orig}" da lista de origens?`)) return;
        const updated = origins.filter(o => o !== orig);
        setOrigins(updated);
        await saveToFirestore(systems, updated);
    };

    const restoreDefaults = async () => {
        if (!window.confirm('Restaurar as listas padrão de Sistemas e Origens?')) return;
        setLoading(true);
        setSystems(DEFAULT_SYSTEMS);
        setOrigins(DEFAULT_ORIGINS);
        await saveToFirestore(DEFAULT_SYSTEMS, DEFAULT_ORIGINS);
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Expedientes Administrativos</CardTitle>
                            <CardDescription>
                                Configure as opções de "Sistema" e "Origem" disponíveis para os expedientes.
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={restoreDefaults} disabled={loading}>
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Restaurar Padrão
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Systems Section */}
                    <div className="space-y-4">
                        <Label className="text-base font-semibold">Sistemas</Label>
                        <p className="text-sm text-slate-500">
                            Opções que aparecem no campo "Sistema" ao criar ou editar um expediente.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {systems.map(sys => (
                                <div key={sys} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-sm">
                                    <span>{sys}</span>
                                    <button
                                        onClick={() => removeSystem(sys)}
                                        className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                                        title={`Remover ${sys}`}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={newSystem}
                                onChange={(e) => setNewSystem(e.target.value)}
                                placeholder="Novo sistema..."
                                className="max-w-xs"
                                onKeyDown={(e) => e.key === 'Enter' && addSystem()}
                            />
                            <Button onClick={addSystem} size="sm" variant="outline">
                                <Plus className="w-4 h-4 mr-1" /> Adicionar
                            </Button>
                        </div>
                    </div>

                    <hr className="border-slate-200 dark:border-slate-700" />

                    {/* Origins Section */}
                    <div className="space-y-4">
                        <Label className="text-base font-semibold">Origens</Label>
                        <p className="text-sm text-slate-500">
                            Opções que aparecem no campo "Origem" ao criar ou editar um expediente.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {origins.map(orig => (
                                <div key={orig} className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-sm">
                                    <span>{orig}</span>
                                    <button
                                        onClick={() => removeOrigin(orig)}
                                        className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                                        title={`Remover ${orig}`}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={newOrigin}
                                onChange={(e) => setNewOrigin(e.target.value)}
                                placeholder="Nova origem..."
                                className="max-w-xs"
                                onKeyDown={(e) => e.key === 'Enter' && addOrigin()}
                            />
                            <Button onClick={addOrigin} size="sm" variant="outline">
                                <Plus className="w-4 h-4 mr-1" /> Adicionar
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
