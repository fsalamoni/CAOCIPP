import React, { useState } from 'react';
import { toast } from 'sonner';
import {
    ArrowDown, ArrowUp, ChevronDown, ChevronUp, Copy, Download, FileSpreadsheet, GitBranch, LayoutTemplate, Loader2, Plus, Trash2, Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    modelosDeRito, novoIdFase, ritoDeMermaid, ritoDeTabela, ritoParaMermaid, ritoParaTabela,
} from '@/lib/secretariaRito';
import FluxoRito from './FluxoRito';
import { NativeSelect } from './comum';

// Editor de rito do admin do órgão: lista de fases à esquerda, diagrama ao
// vivo à direita (abaixo, no celular). Dá para começar de um modelo, importar
// de planilha (Excel, CSV, colar do Excel) ou de diagrama (Mermaid) e exportar.
// Nada é gravado até "Salvar"; o servidor revalida tudo.
export default function RitoEditor({ rito, onChange, onClose, onSalvar, salvando, unidades = [] }) {
    const [importar, setImportar] = useState(!rito?.id && rito?.fases?.length <= 1 && !rito?.fases?.[0]?.nome);
    const [abertas, setAbertas] = useState({}); // fase id -> orientação aberta
    if (!rito) return null;
    const fases = rito.fases;
    const setFases = (fs) => onChange({ ...rito, fases: fs });
    const mudar = (i, patch) => setFases(fases.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    const mover = (i, d) => { const fs = [...fases]; [fs[i], fs[i + d]] = [fs[i + d], fs[i]]; setFases(fs); };
    const remover = (i) => {
        const id = fases[i].id;
        setFases(fases.filter((_, j) => j !== i).map((f) => (f.proximas ? { ...f, proximas: f.proximas.filter((p) => p !== id) } : f)));
    };
    const substituir = (novas, origem, avisos = []) => {
        if (!novas.length) { toast.error(avisos[0] || 'Nenhuma fase encontrada'); return; }
        onChange({ ...rito, fases: novas, nome: rito.nome || (origem.nome ?? rito.nome), descricao: rito.descricao || origem.descricao || '' });
        setImportar(false);
        toast.success(`${novas.length} fases carregadas. Revise e salve.`);
        avisos.slice(0, 3).forEach((a) => toast.warning(a));
    };
    const semNome = fases.some((f) => !f.nome?.trim());

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-6xl w-[calc(100vw-1rem)] max-h-[94vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 grid-cols-1 [&>*]:min-w-0">
                <DialogHeader>
                    <DialogTitle>{rito.id ? 'Editar rito' : 'Novo rito'}</DialogTitle>
                    <DialogDescription>Fases do processo e para onde cada uma segue. Processos em andamento continuam com a versão com que foram autuados.</DialogDescription>
                </DialogHeader>

                <div className="grid sm:grid-cols-2 gap-3">
                    <div><Label htmlFor="rito-nome">Nome do rito</Label><Input id="rito-nome" value={rito.nome} onChange={(e) => onChange({ ...rito, nome: e.target.value })} placeholder="Ex.: Procedimento disciplinar" /></div>
                    <div><Label htmlFor="rito-desc">Descrição</Label><Input id="rito-desc" value={rito.descricao || ''} onChange={(e) => onChange({ ...rito, descricao: e.target.value })} placeholder="Opcional" /></div>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-700">
                    <button type="button" onClick={() => setImportar(!importar)} aria-expanded={importar} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
                        <span className="flex items-center gap-2"><Upload className="w-4 h-4" /> Começar de um modelo, planilha ou diagrama</span>
                        {importar ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {importar && <Importar fases={fases} nomeRito={rito.nome} onCarregar={substituir} />}
                </div>

                <div className="grid lg:grid-cols-5 gap-5 [&>*]:min-w-0">
                    <div className="lg:col-span-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>Fases, na ordem do fluxo principal</Label>
                            <span className="text-xs text-slate-600">{fases.length} fase{fases.length === 1 ? '' : 's'}</span>
                        </div>
                        {fases.map((f, i) => (
                            <FaseCard key={f.id} f={f} i={i} fases={fases} unidades={unidades} mudar={(patch) => mudar(i, patch)} mover={(d) => mover(i, d)} remover={() => remover(i)}
                                aberta={!!abertas[f.id]} alternar={() => setAbertas({ ...abertas, [f.id]: !abertas[f.id] })} />
                        ))}
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => setFases([...fases, { id: novoIdFase(), nome: '' }])}><Plus className="w-4 h-4" /> Adicionar fase</Button>
                    </div>
                    <div className="lg:col-span-2">
                        <div className="lg:sticky lg:top-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
                            <p className="text-sm font-medium mb-2 flex items-center gap-2"><GitBranch className="w-4 h-4" /> Prévia do fluxo</p>
                            {fases.some((f) => f.nome?.trim())
                                ? <FluxoRito fases={fases.filter((f) => f.nome?.trim())} />
                                : <p className="text-sm text-slate-600">Dê nome às fases para ver o diagrama.</p>}
                            <p className="text-xs text-slate-600 mt-2">Setas tracejadas são voltas no fluxo. Caixas arredondadas encerram o fluxo.</p>
                        </div>
                    </div>
                </div>

                {rito.id && (
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={rito.ativo} onCheckedChange={(c) => onChange({ ...rito, ativo: c === true })} /> Disponível para novas autuações</label>
                )}
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button disabled={salvando || !rito.nome?.trim() || semNome || !fases.length} onClick={onSalvar}>
                        {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar rito
                    </Button>
                </DialogFooter>
                {semNome && <p className="text-xs text-amber-700 dark:text-amber-300 text-right -mt-2">Toda fase precisa de nome.</p>}
            </DialogContent>
        </Dialog>
    );
}

function FaseCard({ f, i, fases, unidades, mudar, mover, remover, aberta, alternar }) {
    const modo = f.final ? 'fim' : f.proximas?.length ? 'escolher' : 'linear';
    const outras = fases.filter((x) => x.id !== f.id);
    const ultima = i === fases.length - 1;
    return (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-mono w-6 text-slate-600" aria-hidden>{i + 1}</span>
                <Input className="flex-1 min-w-[10rem]" value={f.nome} placeholder="Nome da fase" onChange={(e) => mudar({ nome: e.target.value })} aria-label={`Nome da fase ${i + 1}`} />
                <div className="flex items-center gap-1">
                    <Input className="w-20" type="number" min={1} max={3650} placeholder="Dias" value={f.prazo_dias || ''} onChange={(e) => mudar({ prazo_dias: Number(e.target.value) || undefined })} aria-label={`Prazo da fase ${i + 1}, em dias`} />
                    <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => mover(-1)} aria-label="Subir fase"><ArrowUp className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" disabled={ultima} onClick={() => mover(1)} aria-label="Descer fase"><ArrowDown className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" disabled={fases.length === 1} onClick={remover} aria-label="Remover fase"><Trash2 className="w-4 h-4" /></Button>
                </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 sm:pl-8">
                <NativeSelect id={`seg-${f.id}`} label="Depois desta fase" value={modo}
                    onChange={(v) => mudar(v === 'fim' ? { final: true, proximas: undefined } : v === 'linear' ? { final: undefined, proximas: undefined } : { final: undefined, proximas: outras[0] ? [outras[0].id] : [] })}
                    options={[
                        ['linear', ultima ? 'Fim do fluxo (última fase)' : `Segue para ${fases[i + 1]?.nome || 'a próxima'}`],
                        ['escolher', 'Escolher uma ou mais fases'],
                        ...(ultima ? [] : [['fim', 'Encerra o fluxo']]),
                    ]} />
                <button type="button" onClick={alternar} className="text-left text-sm text-indigo-700 dark:text-indigo-300 self-end py-2" aria-expanded={aberta}>
                    {aberta ? 'Ocultar detalhes' : (f.orientacao || f.unidade_id || f.agente || f.acoes?.length) ? 'Ver detalhes (unidade, quem faz, ações, orientação)' : 'Detalhes: unidade, quem faz, ações, orientação'}
                </button>
            </div>
            {modo === 'escolher' && (
                <fieldset className="sm:pl-8">
                    <legend className="text-xs text-slate-600 mb-1">Pode seguir para (a primeira marcada é a sugerida)</legend>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {outras.map((o) => {
                            const marcado = f.proximas?.includes(o.id);
                            return (
                                <div key={o.id} className="flex flex-wrap items-center gap-2">
                                    <label className="flex items-center gap-2 text-sm">
                                        <Checkbox checked={!!marcado} onCheckedChange={(c) => mudar({ proximas: c ? [...(f.proximas || []), o.id] : (f.proximas || []).filter((x) => x !== o.id) })} />
                                        {o.nome || `Fase ${fases.indexOf(o) + 1}`}
                                    </label>
                                    {marcado && (f.proximas?.length || 0) > 1 && (
                                        <Input className="h-7 w-44 text-xs" value={f.condicoes?.[o.id] || ''} placeholder="Condição (opcional)" aria-label={`Condição para seguir para ${o.nome}`}
                                            onChange={(e) => mudar({ condicoes: { ...(f.condicoes || {}), [o.id]: e.target.value } })} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {!f.proximas?.length && <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">Marque ao menos uma fase, ou escolha outra opção.</p>}
                </fieldset>
            )}
            {aberta && (
                <div className="sm:pl-8 space-y-2">
                    <div className="grid sm:grid-cols-2 gap-2">
                        <NativeSelect id={`un-${f.id}`} label="Unidade da fase" value={f.unidade_id || ''} onChange={(v) => mudar({ unidade_id: v || undefined })}
                            options={[['', 'Qualquer unidade'], ...unidades.filter((u) => u.ativa !== false).map((u) => [u.id, u.nome])]} />
                        <div>
                            <Label htmlFor={`ag-${f.id}`}>Quem faz</Label>
                            <Input id={`ag-${f.id}`} value={f.agente || ''} onChange={(e) => mudar({ agente: e.target.value })} placeholder="Cargo ou papel (opcional)" />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor={`ac-${f.id}`}>Ações (uma por linha)</Label>
                        <Textarea id={`ac-${f.id}`} rows={2} value={(f.acoes || []).join('\n')} onChange={(e) => mudar({ acoes: e.target.value.split('\n') })} placeholder="Aparecem como lista na tela do processo" />
                    </div>
                    <div>
                        <Label htmlFor={`ori-${f.id}`}>Orientação</Label>
                        <Textarea id={`ori-${f.id}`} rows={2} value={f.orientacao || ''} onChange={(e) => mudar({ orientacao: e.target.value })} placeholder="O que a equipe deve fazer nesta fase. Aparece na tela do processo." />
                    </div>
                </div>
            )}
        </div>
    );
}

async function lerPlanilha(file) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
}

async function baixarPlanilha(fases, nome) {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ritoParaTabela(fases));
    ws['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 32 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Rito');
    XLSX.writeFile(wb, `${(nome || 'rito').replace(/[^\w\- ]+/g, '').trim() || 'rito'}.xlsx`);
}

const EXEMPLO_MERMAID = `flowchart TD
  A[Protocolo] --> B[Análise - 10 dias]
  B --> C[Complementação] --> B
  B --> D[Decisão - 5 dias]
  D --> E[Arquivamento]`;

function Importar({ fases, nomeRito, onCarregar }) {
    const [colado, setColado] = useState('');
    const [diagrama, setDiagrama] = useState('');
    const [lendo, setLendo] = useState(false);
    const modelos = modelosDeRito();
    const temFases = fases.some((f) => f.nome?.trim());

    const arquivo = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setLendo(true);
        try {
            const r = ritoDeTabela(await lerPlanilha(file));
            onCarregar(r.fases, {}, r.avisos);
        } catch {
            toast.error('Não foi possível ler a planilha. Use .xlsx, .xls, .ods ou .csv.');
        } finally {
            setLendo(false);
        }
    };

    return (
        <Tabs defaultValue="modelo" className="px-3 pb-3">
            <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="modelo" className="gap-1"><LayoutTemplate className="w-4 h-4" /> Modelo pronto</TabsTrigger>
                <TabsTrigger value="planilha" className="gap-1"><FileSpreadsheet className="w-4 h-4" /> Planilha</TabsTrigger>
                <TabsTrigger value="diagrama" className="gap-1"><GitBranch className="w-4 h-4" /> Diagrama</TabsTrigger>
                {temFases && <TabsTrigger value="exportar" className="gap-1"><Download className="w-4 h-4" /> Exportar</TabsTrigger>}
            </TabsList>

            <TabsContent value="modelo" className="grid sm:grid-cols-2 gap-2">
                {modelos.map((m) => (
                    <button key={m.nome} type="button" onClick={() => onCarregar(m.fases, m)} className="text-left rounded-md border border-slate-200 dark:border-slate-700 p-3 hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                        <p className="font-medium text-sm">{m.nome}</p>
                        <p className="text-xs text-slate-600">{m.descricao}</p>
                        <p className="text-xs text-slate-600 mt-1">{m.fases.map((f) => f.nome).join(' · ')}</p>
                    </button>
                ))}
            </TabsContent>

            <TabsContent value="planilha" className="space-y-3 text-sm">
                <p className="text-slate-600 dark:text-slate-300">
                    Uma linha por fase, com as colunas <b>Fase</b>, <b>Prazo (dias)</b>, <b>Próximas fases</b> e <b>Orientação</b>.
                    Em "Próximas fases", cite o nome ou o número da linha das fases seguintes, separados por ponto e vírgula, ou escreva "Fim".
                    Deixe em branco para seguir a linha de baixo.
                </p>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-1" asChild>
                        <label className="cursor-pointer">{lendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar planilha
                            <input type="file" className="sr-only" accept=".xlsx,.xls,.ods,.csv" onChange={arquivo} />
                        </label>
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => baixarPlanilha(modelos[1].fases, 'modelo-de-rito')}><Download className="w-4 h-4" /> Baixar planilha de exemplo</Button>
                </div>
                <div>
                    <Label htmlFor="colar-planilha">Ou copie as células no Excel ou Google Planilhas e cole aqui</Label>
                    <Textarea id="colar-planilha" rows={4} value={colado} onChange={(e) => setColado(e.target.value)} placeholder={'Fase\tPrazo (dias)\tPróximas fases\nProtocolo\t1\nAnálise\t10\tDecisão; Complementação'} className="font-mono text-xs" />
                    <Button size="sm" className="mt-2" disabled={!colado.trim()} onClick={() => { const r = ritoDeTabela(colado.split('\n').map((l) => l.split('\t'))); onCarregar(r.fases, {}, r.avisos); }}>Usar estas linhas</Button>
                </div>
            </TabsContent>

            <TabsContent value="diagrama" className="space-y-2 text-sm">
                <p className="text-slate-600 dark:text-slate-300">
                    Cole um fluxograma em texto no formato Mermaid. É o formato do mermaid.live, do draw.io (Organizar &gt; Inserir &gt; Avançado &gt; Mermaid) e o que assistentes de IA produzem quando você pede "o fluxo deste procedimento em Mermaid".
                    Cada caixa vira uma fase e cada seta, um caminho. "Análise - 10 dias" já leva o prazo.
                </p>
                <Textarea aria-label="Diagrama em Mermaid" rows={7} value={diagrama} onChange={(e) => setDiagrama(e.target.value)} placeholder={EXEMPLO_MERMAID} className="font-mono text-xs" />
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={!diagrama.trim()} onClick={() => { const r = ritoDeMermaid(diagrama); onCarregar(r.fases, {}, r.avisos); }}>Usar este diagrama</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDiagrama(EXEMPLO_MERMAID)}>Ver exemplo</Button>
                </div>
            </TabsContent>

            {temFases && (
                <TabsContent value="exportar" className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => baixarPlanilha(fases, nomeRito)}><FileSpreadsheet className="w-4 h-4" /> Baixar como planilha</Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => navigator.clipboard?.writeText(ritoParaMermaid(fases)).then(() => toast.success('Diagrama copiado em Mermaid'))}><Copy className="w-4 h-4" /> Copiar como diagrama</Button>
                </TabsContent>
            )}
        </Tabs>
    );
}
