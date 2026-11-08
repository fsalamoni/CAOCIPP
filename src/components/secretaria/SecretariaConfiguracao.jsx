import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { secConfig } from '@/services/secretariaService';
import { NativeSelect } from './comum';

// Configuração (admin do órgão): unidades com lotação e ritos com fases.
export default function SecretariaConfiguracao({ orgId, estado }) {
    const qc = useQueryClient();
    const [unidade, setUnidade] = useState(null);
    const [rito, setRito] = useState(null);
    const [salvando, setSalvando] = useState(false);

    const salvar = async (action, payload, fechar) => {
        setSalvando(true);
        try {
            await secConfig(orgId, action, payload);
            toast.success('Salvo');
            fechar(null);
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
        } catch (e) {
            toast.error(e?.message || 'Não foi possível salvar');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="grid lg:grid-cols-2 gap-5 pt-2">
            <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                    <div>
                        <CardTitle className="text-base">Unidades</CardTitle>
                        <CardDescription>Secretarias movimentam e cumprem; gabinetes decidem. Só quem está lotado na unidade que tem o processo pode movimentá-lo.</CardDescription>
                    </div>
                    <Button size="sm" className="gap-1 shrink-0" onClick={() => setUnidade({ nome: '', sigla: '', tipo: 'secretaria', membros_uids: [], ativa: true })}><Plus className="w-4 h-4" /> Nova</Button>
                </CardHeader>
                <CardContent className="space-y-2">
                    {estado.unidades.map((u) => (
                        <button key={u.id} onClick={() => setUnidade({ ...u })} className="w-full text-left p-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{u.nome}</span>
                                {u.sigla && <span className="text-xs text-slate-500">{u.sigla}</span>}
                                <Badge variant="outline">{u.tipo === 'gabinete' ? 'Gabinete' : 'Secretaria'}</Badge>
                                {!u.ativa && <Badge variant="secondary">Inativa</Badge>}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {u.membros_uids.length ? u.membros_uids.map((uid) => estado.membros.find((m) => m.uid === uid)?.nome || uid).join(', ') : 'Ninguém lotado'}
                            </p>
                        </button>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                    <div>
                        <CardTitle className="text-base">Ritos</CardTitle>
                        <CardDescription>Sequência de fases. Cada processo guarda as fases do rito com que foi autuado; editar o rito só vale para os próximos.</CardDescription>
                    </div>
                    <Button size="sm" className="gap-1 shrink-0" onClick={() => setRito({ nome: '', descricao: '', fases: [{ nome: '' }], ativo: true })}><Plus className="w-4 h-4" /> Novo</Button>
                </CardHeader>
                <CardContent className="space-y-2">
                    {estado.ritos.map((r) => (
                        <button key={r.id} onClick={() => setRito({ ...r, fases: r.fases.map((f) => ({ ...f })) })} className="w-full text-left p-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <div className="flex items-center gap-2"><span className="font-medium">{r.nome}</span><span className="text-xs text-slate-500">v{r.versao}</span>{!r.ativo && <Badge variant="secondary">Inativo</Badge>}</div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{r.fases.map((f) => f.nome).join(' → ')}</p>
                        </button>
                    ))}
                </CardContent>
            </Card>

            <Dialog open={!!unidade} onOpenChange={(o) => !o && setUnidade(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{unidade?.id ? 'Editar unidade' : 'Nova unidade'}</DialogTitle></DialogHeader>
                    {unidade && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2"><Label htmlFor="un-nome">Nome</Label><Input id="un-nome" value={unidade.nome} onChange={(e) => setUnidade({ ...unidade, nome: e.target.value })} /></div>
                                <div><Label htmlFor="un-sigla">Sigla</Label><Input id="un-sigla" value={unidade.sigla || ''} onChange={(e) => setUnidade({ ...unidade, sigla: e.target.value })} /></div>
                            </div>
                            <NativeSelect label="Tipo" value={unidade.tipo} onChange={(v) => setUnidade({ ...unidade, tipo: v })} options={[['secretaria', 'Secretaria (movimenta e cumpre)'], ['gabinete', 'Gabinete (decide)']]} />
                            <div>
                                <Label>Membros lotados</Label>
                                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto">
                                    {estado.membros.map((m) => {
                                        const marcado = unidade.membros_uids.includes(m.uid);
                                        return (
                                            <label key={m.uid} className="flex items-center gap-2 text-sm">
                                                <Checkbox checked={marcado} onCheckedChange={(c) => setUnidade({ ...unidade, membros_uids: c ? [...unidade.membros_uids, m.uid] : unidade.membros_uids.filter((x) => x !== m.uid) })} />
                                                {m.nome} {m.email && <span className="text-slate-500">· {m.email}</span>}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm"><Checkbox checked={unidade.ativa} onCheckedChange={(c) => setUnidade({ ...unidade, ativa: c === true })} /> Unidade ativa</label>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUnidade(null)}>Cancelar</Button>
                        <Button disabled={salvando || !unidade?.nome?.trim()} onClick={() => salvar('salvarUnidade', { id: unidade.id, unidade }, setUnidade)}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!rito} onOpenChange={(o) => !o && setRito(null)}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{rito?.id ? 'Editar rito' : 'Novo rito'}</DialogTitle></DialogHeader>
                    {rito && (
                        <div className="space-y-3">
                            <div><Label htmlFor="rito-nome">Nome</Label><Input id="rito-nome" value={rito.nome} onChange={(e) => setRito({ ...rito, nome: e.target.value })} /></div>
                            <div><Label htmlFor="rito-desc">Descrição</Label><Input id="rito-desc" value={rito.descricao || ''} onChange={(e) => setRito({ ...rito, descricao: e.target.value })} /></div>
                            <Label>Fases, na ordem</Label>
                            {rito.fases.map((f, i) => {
                                const mudar = (patch) => setRito({ ...rito, fases: rito.fases.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                                const mover = (d) => { const fs = [...rito.fases]; [fs[i], fs[i + d]] = [fs[i + d], fs[i]]; setRito({ ...rito, fases: fs }); };
                                return (
                                    <div key={i} className="flex gap-2 items-center">
                                        <span className="text-xs w-5 text-slate-500">{i + 1}</span>
                                        <Input value={f.nome} placeholder="Nome da fase" onChange={(e) => mudar({ nome: e.target.value })} />
                                        <Input className="w-28" type="number" min={1} placeholder="Prazo (dias)" value={f.prazo_dias || ''} onChange={(e) => mudar({ prazo_dias: Number(e.target.value) || undefined })} aria-label="Prazo em dias" />
                                        <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => mover(-1)} aria-label="Subir"><ArrowUp className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" disabled={i === rito.fases.length - 1} onClick={() => mover(1)} aria-label="Descer"><ArrowDown className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="icon" disabled={rito.fases.length === 1} onClick={() => setRito({ ...rito, fases: rito.fases.filter((_, j) => j !== i) })} aria-label="Remover fase"><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                );
                            })}
                            <Button variant="outline" size="sm" onClick={() => setRito({ ...rito, fases: [...rito.fases, { nome: '' }] })}>Adicionar fase</Button>
                            {rito.id && <label className="flex items-center gap-2 text-sm"><Checkbox checked={rito.ativo} onCheckedChange={(c) => setRito({ ...rito, ativo: c === true })} /> Disponível para novas autuações</label>}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRito(null)}>Cancelar</Button>
                        <Button disabled={salvando || !rito?.nome?.trim()} onClick={() => salvar('salvarRito', { id: rito.id, rito, ativo: rito.ativo }, setRito)}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
