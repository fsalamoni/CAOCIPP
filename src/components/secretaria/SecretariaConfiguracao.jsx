import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { secConfig } from '@/services/secretariaService';
import { NativeSelect } from './comum';
import RitoEditor from './RitoEditor';
import FluxoRito from './FluxoRito';
import ConfiguracaoDocumentos from './ConfiguracaoDocumentos';

// Configuração (admin do órgão): tipos de processo, ritos (fluxos) e unidades
// com lotação. A ordem dos cartões segue o caminho natural de quem configura:
// o que se autua (tipo), como anda (rito) e quem trabalha (unidades).
export default function SecretariaConfiguracao({ orgId, estado }) {
    const qc = useQueryClient();
    const [unidade, setUnidade] = useState(null);
    const [rito, setRito] = useState(null);
    const [tipo, setTipo] = useState(null);
    const [salvando, setSalvando] = useState(false);
    const tipos = estado.tipos || [];
    const nomeRito = (id) => estado.ritos.find((r) => r.id === id)?.nome || 'Rito removido';

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

    const item = 'w-full text-left p-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400';

    return (
        <div className="grid lg:grid-cols-2 gap-5 pt-2">
            <Card>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                        <CardTitle className="text-base">Tipos de processo</CardTitle>
                        <CardDescription>O que se autua no órgão (ex.: Requerimento, Sindicância). Cada tipo já escolhe o rito, o sigilo e a unidade de entrada.</CardDescription>
                    </div>
                    <Button size="sm" className="gap-1 shrink-0" disabled={!estado.ritos.length}
                        onClick={() => setTipo({ nome: '', sigla: '', descricao: '', rito_id: estado.ritos.find((r) => r.ativo)?.id || '', sigilo_padrao: 'normal', unidade_inicial: '', ativo: true })}>
                        <Plus className="w-4 h-4" /> Novo
                    </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                    {tipos.length === 0 && <p className="text-sm text-slate-500">Sem tipos, quem autua escolhe o rito diretamente.</p>}
                    {tipos.map((t) => (
                        <button key={t.id} onClick={() => setTipo({ ...t, unidade_inicial: t.unidade_inicial || '' })} className={item}>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{t.nome}</span>
                                {t.sigla && <span className="text-xs text-slate-500">{t.sigla}</span>}
                                {t.sigilo_padrao === 'restrito' && <Badge variant="outline">Restrito</Badge>}
                                {!t.ativo && <Badge variant="secondary">Inativo</Badge>}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rito: {nomeRito(t.rito_id)}{t.descricao ? ` · ${t.descricao}` : ''}</p>
                        </button>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                        <CardTitle className="text-base">Ritos</CardTitle>
                        <CardDescription>O caminho do processo, fase a fase. Monte do zero, parta de um modelo ou importe de planilha ou diagrama.</CardDescription>
                    </div>
                    <Button size="sm" className="gap-1 shrink-0" onClick={() => setRito({ nome: '', descricao: '', fases: [{ id: `f${Date.now().toString(36)}`, nome: '' }], ativo: true })}><Plus className="w-4 h-4" /> Novo</Button>
                </CardHeader>
                <CardContent className="space-y-2">
                    {estado.ritos.map((r) => (
                        <button key={r.id} onClick={() => setRito({ ...r, fases: r.fases.map((f) => ({ ...f })) })} className={item}>
                            <div className="flex items-center gap-2"><span className="font-medium">{r.nome}</span><span className="text-xs text-slate-500">versão {r.versao}</span>{!r.ativo && <Badge variant="secondary">Inativo</Badge>}</div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{r.fases.length} fases: {r.fases.map((f) => f.nome).join(' → ')}</p>
                        </button>
                    ))}
                </CardContent>
            </Card>

            <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                    <div>
                        <CardTitle className="text-base">Unidades</CardTitle>
                        <CardDescription>Secretarias movimentam e cumprem; gabinetes decidem. Só quem está lotado na unidade que tem o processo pode movimentá-lo.</CardDescription>
                    </div>
                    <Button size="sm" className="gap-1 shrink-0" onClick={() => setUnidade({ nome: '', sigla: '', tipo: 'secretaria', membros_uids: [], ativa: true })}><Plus className="w-4 h-4" /> Nova</Button>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-2">
                    {estado.unidades.map((u) => (
                        <button key={u.id} onClick={() => setUnidade({ ...u })} className={item}>
                            <div className="flex flex-wrap items-center gap-2">
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

            <ConfiguracaoDocumentos orgId={orgId} estado={estado} />

            <Dialog open={!!unidade} onOpenChange={(o) => !o && setUnidade(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
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

            {rito && (
                <RitoEditor rito={rito} onChange={setRito} onClose={() => setRito(null)} salvando={salvando}
                    onSalvar={() => salvar('salvarRito', { id: rito.id, rito, ativo: rito.ativo }, setRito)} />
            )}

            <Dialog open={!!tipo} onOpenChange={(o) => !o && setTipo(null)}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>{tipo?.id ? 'Editar tipo de processo' : 'Novo tipo de processo'}</DialogTitle>
                        <DialogDescription>Ao autuar, quem escolhe este tipo já recebe o rito, o sigilo e a unidade abaixo.</DialogDescription>
                    </DialogHeader>
                    {tipo && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-2"><Label htmlFor="tp-nome">Nome</Label><Input id="tp-nome" value={tipo.nome} onChange={(e) => setTipo({ ...tipo, nome: e.target.value })} placeholder="Ex.: Requerimento administrativo" /></div>
                                <div><Label htmlFor="tp-sigla">Sigla</Label><Input id="tp-sigla" value={tipo.sigla} maxLength={12} onChange={(e) => setTipo({ ...tipo, sigla: e.target.value })} placeholder="REQ" /></div>
                            </div>
                            <div><Label htmlFor="tp-desc">Para que serve</Label><Input id="tp-desc" value={tipo.descricao} onChange={(e) => setTipo({ ...tipo, descricao: e.target.value })} placeholder="Opcional; aparece para quem autua" /></div>
                            <div className="grid sm:grid-cols-3 gap-3">
                                <NativeSelect id="tp-rito" label="Rito" value={tipo.rito_id} onChange={(v) => setTipo({ ...tipo, rito_id: v })}
                                    options={estado.ritos.map((r) => [r.id, `${r.nome}${r.ativo ? '' : ' (inativo)'}`])} />
                                <NativeSelect id="tp-sigilo" label="Sigilo padrão" value={tipo.sigilo_padrao} onChange={(v) => setTipo({ ...tipo, sigilo_padrao: v })}
                                    options={[['normal', 'Normal'], ['restrito', 'Restrito']]} />
                                <NativeSelect id="tp-unidade" label="Unidade sugerida para autuar" value={tipo.unidade_inicial} onChange={(v) => setTipo({ ...tipo, unidade_inicial: v })}
                                    options={[['', 'A de quem autua'], ...estado.unidades.filter((u) => u.ativa).map((u) => [u.id, u.nome])]} />
                            </div>
                            {estado.ritos.find((r) => r.id === tipo.rito_id) && (
                                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
                                    <p className="text-sm font-medium mb-2">Fluxo deste tipo</p>
                                    <FluxoRito fases={estado.ritos.find((r) => r.id === tipo.rito_id).fases} />
                                </div>
                            )}
                            {tipo.id && <label className="flex items-center gap-2 text-sm"><Checkbox checked={tipo.ativo} onCheckedChange={(c) => setTipo({ ...tipo, ativo: c === true })} /> Disponível para novas autuações</label>}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTipo(null)}>Cancelar</Button>
                        <Button disabled={salvando || !tipo?.nome?.trim() || !tipo?.rito_id} onClick={() => salvar('salvarTipo', { id: tipo.id, tipo }, setTipo)}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
