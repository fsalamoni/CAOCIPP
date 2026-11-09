import React, { useState } from 'react';
import { CheckCircle2, Eye, FilePen, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { etapasAteOFim, seguintes } from '@/lib/secretariaRito';
import FluxoRito from './FluxoRito';
import { NativeSelect } from './comum';

/**
 * "Ver como a equipe" e "Ver como a parte": prévia, sem gravar nada, do que
 * cada um vê num processo de exemplo autuado com o rito escolhido. Mostra o
 * cartão "Nesta fase" e o botão principal da equipe, e o "em que ponto está"
 * da parte, fase a fase.
 */
export default function PreviaRito({ estado }) {
    const ritos = (estado.ritos || []).filter((r) => r.ativo);
    const [aberto, setAberto] = useState(false);
    const [ritoId, setRitoId] = useState('');
    const [faseId, setFaseId] = useState('');
    const rito = ritos.find((r) => r.id === ritoId) || ritos[0];
    const fases = rito?.fases || [];
    const i = Math.max(0, fases.findIndex((f) => f.id === faseId));
    const fase = fases[i];
    const nomeUnidade = (id) => estado.unidades.find((u) => u.id === id)?.nome || '';
    const nomeModelo = (id) => (estado.modelos || []).find((m) => m.id === id)?.nome || id;
    const prox = fase ? seguintes(fases, i).map((id) => fases.find((f) => f.id === id)).filter(Boolean) : [];
    let principal = null;
    if (fase) {
        if (prox.length === 0) principal = { rotulo: 'Fase final: arquivar', icone: CheckCircle2 };
        else if (prox.length === 1) {
            const outra = prox[0].unidade_id && prox[0].unidade_id !== fase.unidade_id;
            principal = outra ? { rotulo: `Concluir e enviar para ${nomeUnidade(prox[0].unidade_id)}`, icone: Send } : { rotulo: `Concluir e seguir para ${prox[0].nome}`, icone: CheckCircle2 };
        } else principal = { rotulo: 'Seguir para a próxima fase…', icone: CheckCircle2 };
    }
    const faltam = fase ? etapasAteOFim(fases, fase.id) : null;
    const tipo = (estado.tipos || []).find((t) => t.rito_id === rito?.id);

    return (
        <>
            <Button variant="outline" className="gap-2" disabled={!ritos.length} onClick={() => setAberto(true)} title={ritos.length ? undefined : 'Crie um rito ativo primeiro'}><Eye className="w-4 h-4" aria-hidden /> Ver como a equipe e a parte</Button>
            <Dialog open={aberto} onOpenChange={setAberto}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>Prévia de um processo de exemplo</DialogTitle>
                        <DialogDescription>Nada é gravado. Escolha o rito e a fase para ver o que a equipe e a parte veriam num processo autuado assim.</DialogDescription>
                    </DialogHeader>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <NativeSelect id="pv-rito" label="Rito" value={rito?.id || ''} onChange={(v) => { setRitoId(v); setFaseId(''); }} options={ritos.map((r) => [r.id, r.nome])} />
                        <NativeSelect id="pv-fase" label="Fase" value={fase?.id || ''} onChange={setFaseId} options={fases.map((f) => [f.id, f.nome])} />
                    </div>
                    {fase && (
                        <Tabs defaultValue="equipe">
                            <TabsList><TabsTrigger value="equipe">Como a equipe vê</TabsTrigger><TabsTrigger value="parte">Como a parte vê</TabsTrigger></TabsList>
                            <TabsContent value="equipe" className="space-y-3">
                                <h3 className="text-lg font-semibold"><span className="font-mono">000001/{new Date().getFullYear()}</span> · Processo de exemplo{tipo ? <span className="text-sm font-normal text-slate-600 dark:text-slate-400"> · {tipo.nome}</span> : ''}</h3>
                                <div className="rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 p-3 space-y-2">
                                    <p className="text-sm font-semibold">Nesta fase: {fase.nome}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-300">
                                        {fase.unidade_id ? `Corre em ${nomeUnidade(fase.unidade_id)}` : 'Corre na unidade que estiver com o processo'}{fase.agente ? ` · quem faz: ${fase.agente}` : ''}{fase.prazo_dias ? ` · prazo da fase: ${fase.prazo_dias} dias` : ''}
                                    </p>
                                    {fase.orientacao && <p className="text-sm text-slate-700 dark:text-slate-200">{fase.orientacao}</p>}
                                    {(fase.acoes || []).length > 0 && (
                                        <ul className="space-y-1">{fase.acoes.map((a, k) => <li key={k} className="flex items-center gap-2 text-sm"><Checkbox disabled aria-label={a} /> {a}</li>)}</ul>
                                    )}
                                    {(fase.modelos || []).length > 0 && (
                                        <div className="flex flex-wrap gap-2">{fase.modelos.map((m) => <Button key={m} size="sm" variant="outline" className="gap-1 pointer-events-none"><FilePen className="w-3.5 h-3.5" aria-hidden /> Redigir {nomeModelo(m)}</Button>)}</div>
                                    )}
                                    {principal && <Button className="gap-2 pointer-events-none" aria-disabled><principal.icone className="w-4 h-4" aria-hidden /> {principal.rotulo}</Button>}
                                    {prox.length > 1 && <p className="text-xs text-slate-600 dark:text-slate-300">Alternativas: {prox.map((f) => `${f.nome}${fase.condicoes?.[f.id] ? ` (${fase.condicoes[f.id]})` : ''}`).join(' · ')}</p>}
                                </div>
                                <FluxoRito fases={fases} atual={fase.id} />
                            </TabsContent>
                            <TabsContent value="parte" className="space-y-3">
                                <div className="rounded-lg border p-3 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm">000001/{new Date().getFullYear()}</span> <Badge>{fase.nome}</Badge> <Badge variant="secondary">Em tramitação</Badge></div>
                                    <p className="text-sm text-slate-700 dark:text-slate-200">Você fez o pedido (requerente) · em: {fase.nome}</p>
                                    <p className="text-sm font-medium">{faltam === 0 ? 'Esta é a última etapa.' : faltam != null ? `Faltam ${faltam} etapa${faltam > 1 ? 's' : ''} até o fim.` : 'Em andamento.'}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">A parte vê só os nomes das fases: não vê unidades, orientações internas, ações nem condições.</p>
                                </div>
                                <FluxoRito fases={fases.map((f) => ({ id: f.id, nome: f.nome, proximas: f.proximas, final: f.final }))} atual={fase.id} />
                            </TabsContent>
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
