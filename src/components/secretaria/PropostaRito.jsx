import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    AlertTriangle, ArrowDown, ArrowUp, Building2, CheckCircle2, ChevronDown, Copy, Download, FilePlus2, FileSpreadsheet, FileText, FileUp, GitBranch, LayoutTemplate, Loader2, Plus, Rocket, Save, Shapes, Trash2, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { arquivoParaBase64, secConfig } from '@/services/secretariaService';
import { deRito, montarPayload, propostaDeAbas, propostaDeConteudo, propostaDeDiagramas, propostaDeTexto, sem, tipoDocumentoDe, vincularProposta } from '@/lib/propostaRito';
import { modelosDeRito, novoIdFase, ritoParaMermaid, ritoParaTabela } from '@/lib/secretariaRito';
import FluxoRito from './FluxoRito';
import { AcoesDaFase, RegistroEDocumentos } from './RegrasDaFase';
import { TIPOS_UNIDADE, copiarTexto } from './comum';
import { BloqueioRito } from './Lixeira';

const MAX_MB = 5;
const MAX_FASES = 60; // igual ao servidor (MAX_FASES em functions-v2/src/shared/secretaria.ts)
const ACEITOS = '.xlsx,.xlsm,.xls,.csv,.ods,.docx,.pdf,.txt,.md,.bpm,.bpmn,.xpdl,.xml,.drawio,.mmd';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_BIZAGI = 'application/x-bizagi-bpm';
const campo = 'h-9 rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm';
// Rascunho por rito: o de um rito novo e o de cada rito em edição não se misturam.
const chaveRascunho = (orgId, id) => (id ? `rito-rascunho-${orgId}-${id}` : `rito-rascunho-${orgId}`);
const lerRascunho = (orgId, id) => { try { return JSON.parse(localStorage.getItem(chaveRascunho(orgId, id)) || 'null'); } catch { return null; } };
const apagarRascunho = (orgId, id) => { try { localStorage.removeItem(chaveRascunho(orgId, id)); } catch { /* ignora */ } };

export async function baixarPlanilha(fases, nome) {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ritoParaTabela(fases));
    ws['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 32 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Rito');
    XLSX.writeFile(wb, `${(nome || 'rito').replace(/[^\w\- ]+/g, '').trim() || 'rito'}.xlsx`);
}

/** Pendências que travam ou enfraquecem a implantação, com a fase para ir até ela. */
export function pendenciasDaProposta(p) {
    const out = [];
    const ids = new Set(p.fases.map((f) => f.id));
    if (!p.fases.length) out.push({ fase: null, grave: true, texto: 'O rito precisa de ao menos uma fase.' });
    if (p.fases.length > MAX_FASES) out.push({ fase: p.fases[MAX_FASES].id, grave: true, texto: `O rito tem ${p.fases.length} fases; o máximo é ${MAX_FASES}. Junte ou remova fases (os detalhes podem virar ações de uma fase).` });
    p.fases.forEach((f, i) => {
        const rot = f.nome.trim() || `Fase ${i + 1}`;
        if (!f.nome.trim()) out.push({ fase: f.id, grave: true, texto: `${rot} está sem nome.` });
        (f.acoes || []).forEach((a, k) => {
            const r = f.acoes_regras?.[k];
            if (a.trim() && r?.pede === 'lista' && (r.opcoes || []).filter((o) => o.trim()).length < 2) {
                out.push({ fase: f.id, grave: true, texto: `Em ${rot}, a ação "${a.trim()}" pede uma escolha: informe ao menos duas opções.` });
            }
        });
        if (!f.unidade_ref) out.push({ fase: f.id, texto: `${rot} não tem unidade: a fase vai correr na unidade que estiver com o processo.` });
        if (!f.final) {
            const saidas = (f.proximas || []).filter((id) => id !== f.id);
            if (i === p.fases.length - 1 && saidas.length === 0) out.push({ fase: f.id, texto: `${rot} é a última e não termina o processo: marque "O processo termina nesta fase" ou indique para onde segue.` });
            saidas.filter((id) => !ids.has(id)).forEach(() => out.push({ fase: f.id, grave: true, texto: `${rot} segue para uma fase que não existe mais.` }));
            if (saidas.length > 1) {
                const semCond = saidas.filter((id) => !(f.condicoes?.[id] || '').trim());
                if (semCond.length) out.push({ fase: f.id, texto: `${rot} tem ${saidas.length} saídas e ${semCond.length} sem condição: a equipe não saberá quando escolher cada uma.` });
            }
        }
    });
    return out;
}

/** Lê o arquivo e devolve a proposta (sem vínculo com o órgão). */
async function lerArquivo(file, orgId) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (['xlsx', 'xlsm', 'xls', 'csv', 'ods'].includes(ext)) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        // Todas as abas: as que detalham uma fase entram no lugar dela; as demais, em sequência.
        const abas = wb.SheetNames.map((nome) => ({ nome, linhas: XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: false, blankrows: false, defval: '' }) }));
        const r = propostaDeAbas(abas);
        return { ...r, origem: abas.length > 1 ? `planilha (${abas.length} abas)` : 'planilha' };
    }
    if (ext === 'docx' || ext === 'pdf' || ext === 'bpm') {
        const mime = ext === 'pdf' ? 'application/pdf' : ext === 'bpm' ? MIME_BIZAGI : MIME_DOCX;
        const r = await secConfig(orgId, 'extrairTextoRito', { arquivo: { base64: await arquivoParaBase64(file), mime, nome: file.name } });
        if (ext === 'bpm') return { ...propostaDeDiagramas(r.diagramas || []), origem: 'Bizagi' };
        // Tabelas do Word com coluna "Fase" valem mais que o texto corrido (todas, como abas).
        const tabelas = (r.tabelas || []).map((linhas, i) => ({ nome: `Tabela ${i + 1}`, linhas }));
        const p = tabelas.length ? propostaDeAbas(tabelas) : { fases: [] };
        if (p.fases.length > 1) return { ...p, origem: 'tabela do Word' };
        const t = propostaDeTexto(r.texto);
        if (!t.fases.length && ext === 'pdf') t.avisos = ['Li o PDF, mas não achei fases. Use títulos como "Fase 1 – Autuação" ou "1. Autuação" (um por fase), ou envie o diagrama (Bizagi, BPMN) ou uma planilha.'];
        return { ...t, origem: ext === 'pdf' ? 'texto do PDF' : 'texto do Word' };
    }
    return propostaDeConteudo(await file.text(), file.name);
}

/**
 * Tela única do rito, para criar e para editar. Criar: em branco, de um modelo
 * pronto ou lendo planilha, Word, PDF, BPMN, draw.io, Mermaid ou texto (o
 * sistema monta a proposta com unidades, ações, modelos e alternativas).
 * Editar: abre o rito gravado nesta mesma tela; salvar gera nova versão.
 * Implantar cria, de uma vez, as unidades e os modelos que faltam, o rito e,
 * se pedido, o tipo de processo. Monte com `key` por rito: o estado nasce das props.
 */
export default function PropostaRito({ aberto, orgId, estado, rito = null, copia = null, onFechar, onIr, onAbrirTipo, extra = null }) {
    const qc = useQueryClient();
    const editando = !!rito?.id;
    // Duplicar: nasce como rito novo, já com as fases do original (sem criar tipo junto).
    const [lendo, setLendo] = useState(false);
    const [colado, setColado] = useState('');
    const [p0] = useState(() => (editando ? deRito(rito) : copia ? deRito({ ...copia, id: undefined, nome: `${copia.nome} (cópia)` }) : null));
    const [p, setP] = useState(p0); // proposta vinculada
    const [inicial] = useState(() => (p0 ? JSON.stringify(p0) : null));
    const [tipo, setTipo] = useState({ criar: !editando && !copia, nome: '', sigla: '' });
    const [confirmar, setConfirmar] = useState(false);
    const [implantando, setImplantando] = useState(false);
    const [criado, setCriado] = useState(null); // resumo após implantar
    const [rascunho, setRascunho] = useState(() => lerRascunho(orgId, rito?.id));
    // Editando com rascunho guardado: a pessoa decide antes de o rascunho ser sobrescrito.
    const [decidirRascunho, setDecidirRascunho] = useState(() => !!p0 && !!rascunho?.p);

    // Rascunho da revisão fica no navegador: fechar ou cair não perde o trabalho.
    useEffect(() => {
        if (!p || criado) return;
        const igual = inicial && JSON.stringify(p) === inicial;
        if (decidirRascunho) {
            // Mexer no rito sem recuperar o rascunho antigo é recusar o rascunho.
            if (igual) return;
            setDecidirRascunho(false);
        }
        // A cópia intacta não apaga o rascunho de rito novo que já estava guardado.
        if (igual) { if (editando) apagarRascunho(orgId, rito?.id); return; }
        try { localStorage.setItem(chaveRascunho(orgId, rito?.id), JSON.stringify({ p, tipo, em: Date.now(), versao: rito?.versao })); } catch { /* sem espaço: segue sem rascunho */ }
    }, [p, tipo, orgId, rito, inicial, criado, decidirRascunho]);
    const descartarRascunho = () => { apagarRascunho(orgId, rito?.id); setRascunho(null); setDecidirRascunho(false); };
    // Recuperar o rascunho mantém a versão atual: salvar não pode voltar a versão.
    const continuarRascunho = () => { setP({ ...rascunho.p, ...(editando ? { id: rito.id, versao: rito.versao } : {}) }); setTipo(rascunho.tipo || { criar: !editando, nome: rascunho.p.nome, sigla: '' }); setConfirmar(false); setDecidirRascunho(false); };

    const fechar = () => { setP(null); setColado(''); setConfirmar(false); setCriado(null); onFechar(); };
    // Editando, "Substituir fases" reabre o início: troca só as fases, o rito segue o mesmo.
    const [trocar, setTrocar] = useState(false);
    const manter = () => ({ id: p.id, versao: p.versao, ativo: p.ativo, nome: p.nome, descricao: p.descricao });
    const comecar = (r, criarTipo = true) => {
        if (trocar) { setP({ ...deRito(r), ...manter() }); setTrocar(false); setConfirmar(false); return; }
        setP(deRito(r));
        setTipo({ criar: criarTipo, nome: r.nome || '', sigla: '' });
        setConfirmar(false);
    };
    const carregar = (r, nomePadrao) => {
        if (!r.fases.length) { toast.error(r.avisos?.[0] || 'Não achei fases'); return; }
        const v = vincularProposta(r, estado);
        if (trocar) { setP({ ...v, ...manter() }); setTrocar(false); setConfirmar(false); return; }
        const nome = r.nome || nomePadrao || 'Rito importado';
        setP({ ...v, nome, descricao: `Importado de ${r.origem || 'arquivo'}.` });
        setTipo({ criar: true, nome, sigla: '' });
        setConfirmar(false);
    };
    const escolher = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Arquivo acima de ${MAX_MB} MB`); return; }
        setLendo(true);
        try { carregar(await lerArquivo(file, orgId), file.name.replace(/\.[^.]+$/, '')); } catch (err) { toast.error(err?.message || 'Não foi possível ler o arquivo'); } finally { setLendo(false); }
    };
    const usarColado = async () => {
        setLendo(true);
        try { carregar(await propostaDeConteudo(colado)); } finally { setLendo(false); }
    };

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
            <DialogContent className="max-w-none w-screen h-[100dvh] sm:w-[96vw] sm:h-[94vh] sm:max-w-[1400px] p-0 gap-0 flex flex-col overflow-hidden sm:rounded-lg [&>button:last-child]:hidden">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
                    <GitBranch className="w-5 h-5 text-indigo-600" aria-hidden />
                    <DialogTitle className="text-base truncate">{editando ? `Editar rito: ${rito.nome}` : 'Novo rito'}</DialogTitle>
                    {editando && <Badge variant="outline" className="font-normal">versão {rito.versao}</Badge>}
                    <DialogDescription className="sr-only">{editando ? 'Ajuste as fases, as ações e o que cada uma registra; salvar gera nova versão' : 'Comece em branco, de um modelo ou de um arquivo, revise e implante o rito'}</DialogDescription>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={fechar} aria-label="Fechar"><X className="w-4 h-4" /></Button>
                </div>
                {criado ? (
                    <ResumoImplantacao r={criado} onIr={(aba) => { fechar(); onIr?.(aba); }} onFechar={fechar} />
                ) : !p || trocar ? (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                        <div className="max-w-3xl mx-auto space-y-6">
                            {trocar ? (
                                <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/40 p-3 text-sm">
                                    <span className="flex-1 min-w-[12rem]">As fases de <b>{p.nome}</b> serão trocadas pelas do modelo ou arquivo escolhido. O nome, a situação e as versões do rito continuam; nada é salvo até você confirmar.</span>
                                    <Button size="sm" variant="outline" onClick={() => setTrocar(false)}>Voltar sem trocar</Button>
                                </div>
                            ) : (
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    Comece em branco, de um modelo pronto ou de um arquivo que descreve o fluxo. Em todos os casos você revisa e ajusta
                                    tudo nesta mesma tela antes de implantar: fases, unidades, ações (e o que cada uma pede e registra), documentos,
                                    prazos e alternativas. Nada é criado até você confirmar.
                                </p>
                            )}
                            {!trocar && rascunho?.p && (
                                <div className="flex flex-wrap items-center gap-2 rounded-md border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 p-3 text-sm">
                                    <span className="flex-1 min-w-[12rem]">Há uma revisão não implantada: <b>{rascunho.p.nome}</b> ({rascunho.p.fases.length} fases), de {new Date(rascunho.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</span>
                                    <Button size="sm" onClick={continuarRascunho}>Continuar a revisão</Button>
                                    <Button size="sm" variant="ghost" onClick={descartarRascunho}>Descartar</Button>
                                </div>
                            )}
                            <section aria-labelledby="comecar-titulo" className="space-y-2">
                                <h3 id="comecar-titulo" className="text-sm font-semibold">Começar sem arquivo</h3>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    <button type="button" onClick={() => comecar({ nome: '', descricao: '', fases: [{ id: novoIdFase(), nome: '', proximas: [] }] })}
                                        className="text-left rounded-md border border-slate-200 dark:border-slate-700 p-3 hover:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                                        <p className="font-medium text-sm flex items-center gap-1.5"><FilePlus2 className="w-4 h-4 text-indigo-600" aria-hidden /> Em branco</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">Uma fase vazia para montar do zero.</p>
                                    </button>
                                    {modelosDeRito().map((m) => (
                                        <button key={m.nome} type="button" onClick={() => comecar(m)}
                                            className="text-left rounded-md border border-slate-200 dark:border-slate-700 p-3 hover:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                                            <p className="font-medium text-sm flex items-center gap-1.5"><LayoutTemplate className="w-4 h-4 text-indigo-600" aria-hidden /> {m.nome}</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{m.descricao}</p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{m.fases.map((f) => f.nome).join(' · ')}</p>
                                        </button>
                                    ))}
                                </div>
                            </section>
                            <h3 className="text-sm font-semibold">Ou a partir de um arquivo</h3>
                            <label className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-400 ${lendo ? 'opacity-60 pointer-events-none' : ''}`}>
                                {lendo ? <Loader2 className="w-7 h-7 animate-spin text-indigo-600" aria-hidden /> : <FileUp className="w-7 h-7 text-indigo-600" aria-hidden />}
                                <span className="font-medium">{lendo ? 'Lendo…' : 'Escolher arquivo'}</span>
                                <span className="text-xs text-slate-600">Planilha (Excel, CSV, todas as abas), Word, PDF, Bizagi (.bpm), BPMN, XPDL, draw.io, Mermaid ou texto · até {MAX_MB} MB</span>
                                <input type="file" accept={ACEITOS} className="sr-only" onChange={escolher} disabled={lendo} />
                            </label>
                            <div className="grid sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
                                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3"><b className="block mb-1">Planilha</b>Uma linha por fase ou por atividade. Colunas: Fase, Unidade, Responsável, Prazo, Ações, Documentos, Segue para, Condição, Orientação. Todas as abas são lidas: a aba com o nome de uma fase detalha essa fase.</div>
                                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3"><b className="block mb-1">Diagrama</b>Bizagi (.bpm, com todas as páginas), BPMN, XPDL, draw.io ou Mermaid. Raias viram unidades; losangos, alternativas; subprocessos se abrem em etapas.</div>
                                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3"><b className="block mb-1">Texto</b>Word, PDF ou TXT com "Fase 1 – Nome", "Unidade:", "Responsável:", "Prazo de N dias", itens e "Se…, segue para…".</div>
                            </div>
                            <div>
                                <Label htmlFor="rito-colado">Ou cole aqui (texto, linhas de planilha, Mermaid ou XML)</Label>
                                <Textarea id="rito-colado" rows={7} value={colado} onChange={(e) => setColado(e.target.value)} className="font-mono text-xs"
                                    placeholder={'Fase 1 – Autuação\nUnidade: Secretaria\nPrazo de 2 dias\n- Registrar o pedido\nFase 2 – Decisão\nUnidade: Gabinete\nSe deferido, segue para Cumprimento.\nSe indeferido, segue para Arquivamento.'} />
                                <Button size="sm" className="mt-2" disabled={!colado.trim() || lendo} onClick={usarColado}>Montar proposta</Button>
                            </div>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => baixarPlanilha(modelosDeRito()[1]?.fases || modelosDeRito()[0].fases, 'exemplo-de-rito')}>
                                <Download className="w-3.5 h-3.5" aria-hidden /> Baixar uma planilha de exemplo para preencher
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Revisao p={p} setP={setP} estado={estado} tipo={tipo} setTipo={setTipo} confirmar={confirmar} setConfirmar={setConfirmar}
                        implantando={implantando} editando={editando} deCopia={!!copia} extra={extra}
                        rascunho={decidirRascunho ? rascunho : null} onContinuarRascunho={continuarRascunho} onDescartarRascunho={descartarRascunho}
                        onVoltar={() => { setRascunho(lerRascunho(orgId)); setP(null); }}
                        onTrocarFases={() => setTrocar(true)}
                        onAbrirTipo={onAbrirTipo ? (id) => { fechar(); onAbrirTipo(id); } : null}
                        onExcluir={async () => {
                            try {
                                await secConfig(orgId, 'excluirRito', { id: rito.id });
                                toast.success('Rito excluído');
                                qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
                                apagarRascunho(orgId, rito.id);
                                fechar();
                            } catch (e) { toast.error(e?.message || 'Não foi possível excluir o rito'); }
                        }}
                        onImplantar={async () => {
                            setImplantando(true);
                            try {
                                const payload = montarPayload(p, tipo);
                                const r = await secConfig(orgId, 'aplicarPropostaRito', { proposta: payload });
                                qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
                                apagarRascunho(orgId, rito?.id);
                                setRascunho(null);
                                if (editando && !payload.unidades.length && !payload.modelos.length && !payload.tipo_processo) {
                                    toast.success(`Rito salvo (versão ${r.versao}). Processos em andamento seguem com a versão com que foram autuados.`);
                                    fechar();
                                    return;
                                }
                                toast.success(editando ? `Rito salvo (versão ${r.versao})` : 'Rito implantado');
                                setCriado({ nome: p.nome, fases: p.fases.length, unidades: payload.unidades.map((u) => u.nome), modelos: payload.modelos.map((m) => m.nome), tipo: payload.tipo_processo?.nome || null, editado: editando, ativo: p.ativo !== false, ...r });
                                setP(null);
                            } catch (e) { toast.error(e?.message || (editando ? 'Não foi possível salvar o rito' : 'Não foi possível implantar')); setConfirmar(false); } finally { setImplantando(false); }
                        }} />
                )}
            </DialogContent>
        </Dialog>
    );
}

/** Depois de implantar: o que foi criado e para onde ir em seguida. */
function ResumoImplantacao({ r, onIr, onFechar }) {
    const n = (k, s, pl) => `${k} ${k === 1 ? s : pl}`;
    return (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-2xl mx-auto space-y-5">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" aria-hidden />
                    <div>
                        <h3 className="text-lg font-semibold">Rito “{r.nome}” {r.editado ? `salvo (versão ${r.versao})` : 'implantado'}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{r.editado ? `Rito com ${n(r.fases, 'fase', 'fases')}` : `Foram criados: 1 rito com ${n(r.fases, 'fase', 'fases')}`}{r.unidades.length ? `, ${n(r.unidades.length, 'unidade', 'unidades')}` : ''}{r.modelos.length ? `, ${n(r.modelos.length, 'modelo', 'modelos')}` : ''}{r.tipo ? ', 1 tipo de processo' : ''}.</p>
                    </div>
                </div>
                <ul className="space-y-3 text-sm">
                    {r.unidades.length > 0 && (
                        <li className="rounded-md border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-2">
                            <Users className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden />
                            <span className="flex-1 min-w-[12rem]"><b>Unidades novas:</b> {r.unidades.join(', ')}. Elas ainda não têm ninguém lotado.</span>
                            <Button size="sm" variant="outline" onClick={() => onIr('unidades')}>Montar as equipes</Button>
                        </li>
                    )}
                    {r.modelos.length > 0 && (
                        <li className="rounded-md border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden />
                            <span className="flex-1 min-w-[12rem]"><b>Modelos novos:</b> {r.modelos.join(', ')}. Saíram com um texto-base; complete o conteúdo.</span>
                            <Button size="sm" variant="outline" onClick={() => onIr('documentos')}>Completar os modelos</Button>
                        </li>
                    )}
                    {r.tipo && (
                        <li className="rounded-md border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-2">
                            <Shapes className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden />
                            <span className="flex-1 min-w-[12rem]"><b>Tipo de processo:</b> {r.tipo}, já ativo e ligado a este rito.</span>
                            <Button size="sm" variant="outline" onClick={() => onIr('tipos')}>Ver os tipos</Button>
                        </li>
                    )}
                    <li className="rounded-md border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center gap-2">
                        <GitBranch className="w-4 h-4 text-indigo-600 shrink-0" aria-hidden />
                        <span className="flex-1 min-w-[12rem]">{r.ativo ? 'O rito está ativo. Use “Ver como a equipe e a parte” no topo para conferir cada fase.' : 'O rito está inativo: não aparece para novas autuações até ser marcado como disponível.'}</span>
                        {!r.editado && <Button size="sm" variant="outline" onClick={() => onIr('ritos')}>Abrir o rito</Button>}
                    </li>
                </ul>
                <Button onClick={onFechar}>Fechar</Button>
            </div>
        </div>
    );
}

function Revisao({
    p, setP, estado, tipo, setTipo, confirmar, setConfirmar, implantando, onVoltar, onImplantar,
    editando = false, deCopia = false, extra = null, rascunho = null, onContinuarRascunho, onDescartarRascunho, onExcluir, onTrocarFases, onAbrirTipo = null,
}) {
    const [excluir, setExcluir] = useState(false);
    const tiposDoRito = editando ? (estado.tipos || []).filter((t) => t.rito_id === p.id) : [];
    const existentes = estado.unidades.filter((u) => u.ativa !== false);
    const nomeUnidade = (ref) => existentes.find((u) => u.id === ref)?.nome || p.unidades.find((u) => u.ref === ref)?.nome || '';
    const nomeModelo = (ref) => (estado.modelos || []).find((m) => m.id === ref)?.nome || p.modelos.find((m) => m.ref === ref)?.nome || 'Modelo excluído (sai ao salvar)';
    const mudarFase = (id, d) => { setConfirmar(false); setP({ ...p, fases: p.fases.map((f) => (f.id === id ? { ...f, ...d } : f)) }); };
    const mover = (i, delta) => { const fs = [...p.fases]; const [x] = fs.splice(i, 1); fs.splice(i + delta, 0, x); setP({ ...p, fases: fs }); };
    const remover = (id) => setP({ ...p, fases: p.fases.filter((f) => f.id !== id).map((f) => ({ ...f, proximas: (f.proximas || []).filter((x) => x !== id) })) });
    // Unidade nova criada a partir de uma fase, já ligada a ela (um só setP).
    const novaUnidade = (faseId) => {
        const ref = `+${Date.now().toString(36)}`;
        setP({
            ...p, unidades: [...p.unidades, { ref, nome: 'Nova unidade', tipo: 'outra' }],
            fases: p.fases.map((f) => (f.id === faseId ? { ...f, unidade_ref: ref } : f)),
        });
    };
    const addModelo = (fase, nome) => {
        const n = sem(nome);
        if (!n) return;
        const exist = (estado.modelos || []).find((m) => sem(m.nome) === n && (!m.unidade_id || m.unidade_id === fase.unidade_ref));
        let ref = exist?.id || p.modelos.find((m) => sem(m.nome) === n && m.unidade_ref === fase.unidade_ref)?.ref;
        let modelos = p.modelos;
        if (!ref) { ref = `+${Date.now().toString(36)}`; modelos = [...modelos, { ref, nome: nome.trim(), unidade_ref: fase.unidade_ref || null, tipo_documento: tipoDocumentoDe(nome, estado) }]; }
        setP({ ...p, modelos, fases: p.fases.map((f) => (f.id === fase.id ? { ...f, modelos_ref: [...new Set([...(f.modelos_ref || []), ref])] } : f)) });
    };
    // Unidade ou modelo novo trocado por um existente: troca a referência em tudo.
    const trocarUnidade = (ref, id) => setP({
        ...p, unidades: p.unidades.filter((u) => u.ref !== ref),
        fases: p.fases.map((f) => (f.unidade_ref === ref ? { ...f, unidade_ref: id } : f)),
        modelos: p.modelos.map((m) => (m.unidade_ref === ref ? { ...m, unidade_ref: id } : m)),
    });
    const trocarModelo = (ref, id) => setP({
        ...p, modelos: p.modelos.filter((m) => m.ref !== ref),
        fases: p.fases.map((f) => ({ ...f, modelos_ref: [...new Set((f.modelos_ref || []).map((x) => (x === ref ? id : x)).filter(Boolean))] })),
    });
    const usadosUn = useMemo(() => new Set([...p.fases.map((f) => f.unidade_ref), ...p.modelos.map((m) => m.unidade_ref)].filter(Boolean)), [p]);
    const usadosMod = useMemo(() => new Set(p.fases.flatMap((f) => f.modelos_ref || [])), [p]);
    const unNovas = p.unidades.filter((u) => usadosUn.has(u.ref));
    const modNovos = p.modelos.filter((m) => usadosMod.has(m.ref));
    const pendencias = useMemo(() => pendenciasDaProposta(p), [p]);
    const semNome = pendencias.some((x) => x.grave);
    // Fases recolhidas por padrão quando são muitas: a lista cabe na tela e o fluxo guia a revisão.
    const [abertas, setAbertas] = useState(() => new Set(p.fases.length <= 6 ? p.fases.map((f) => f.id) : []));
    const [sel, setSel] = useState(null);
    const alternar = (id) => setAbertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const irParaFase = (id) => {
        setSel(id);
        setAbertas((s) => new Set(s).add(id));
        // Espera o cartão abrir para rolar até ele.
        requestAnimationFrame(() => document.getElementById(`fase-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    };
    const comPendencia = useMemo(() => new Set(pendencias.map((x) => x.fase)), [pendencias]);
    const fluxo = useMemo(() => p.fases.filter((f) => f.nome.trim()).map((f) => ({ ...f, proximas: f.final ? [] : f.proximas, raia: nomeUnidade(f.unidade_ref) })),
        [p.fases, p.unidades, estado.unidades]);
    const todasAbertas = abertas.size >= p.fases.length;

    return (
        <>
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-4 pb-0 space-y-3">
                    {rascunho?.p && (
                        <div role="status" className="flex flex-wrap items-center gap-2 rounded-md border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 p-3 text-sm">
                            {deCopia ? (
                                <span className="flex-1 min-w-[12rem]">Há um rito novo não implantado, <b>{rascunho.p.nome}</b>, de {new Date(rascunho.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. Mexer nesta cópia substitui aquele rascunho.</span>
                            ) : (
                                <span className="flex-1 min-w-[12rem]">Há alterações não salvas deste rito, de {new Date(rascunho.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}{rascunho.versao && rascunho.versao !== p.versao ? `, feitas sobre a versão ${rascunho.versao} (a atual é a ${p.versao})` : ''}.</span>
                            )}
                            <Button size="sm" onClick={onContinuarRascunho}>{deCopia ? 'Abrir aquele rascunho' : 'Recuperar as alterações'}</Button>
                            <Button size="sm" variant="ghost" onClick={onDescartarRascunho}>Descartar</Button>
                        </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-3">
                        <div><Label htmlFor="pr-nome">Nome do rito</Label><Input id="pr-nome" value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} /></div>
                        <div><Label htmlFor="pr-desc">Descrição</Label><Input id="pr-desc" value={p.descricao} onChange={(e) => setP({ ...p, descricao: e.target.value })} /></div>
                    </div>
                    <section aria-label="Fluxo do rito" className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
                        <div className="mb-1 flex flex-wrap items-baseline gap-x-3">
                            <h3 className="text-sm font-semibold flex items-center gap-1.5"><GitBranch className="w-4 h-4" aria-hidden /> Fluxo</h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300">Uma raia por unidade. Clique numa fase para abrir e ajustar.</p>
                        </div>
                        {fluxo.length > 0
                            ? <FluxoRito fases={fluxo} atual={sel} onSelecionar={irParaFase} legenda alturaMaxima="62vh" />
                            : <p className="text-sm text-slate-600">Dê nome às fases para ver o fluxo.</p>}
                    </section>
                </div>
                <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 p-4">
                    <div className="space-y-3 min-w-0">
                        {p.avisos?.length > 0 && (
                            <details className="rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 p-3 text-xs" open={p.avisos.length <= 3}>
                                <summary className="cursor-pointer font-semibold">{p.avisos.length} {p.avisos.length > 1 ? 'observações' : 'observação'} da leitura do arquivo</summary>
                                <ul className="mt-2 space-y-1">
                                    {p.avisos.slice(0, 12).map((a, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />{a}</li>)}
                                </ul>
                            </details>
                        )}
                        {pendencias.length > 0 && (
                            <section aria-label="Pendências" className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3">
                                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" aria-hidden /> {pendencias.length} pendência{pendencias.length > 1 ? 's' : ''} {editando ? 'antes de salvar' : 'antes de implantar'}</h3>
                                <ul className="mt-1.5 space-y-1 text-xs text-amber-900 dark:text-amber-100">
                                    {pendencias.slice(0, 10).map((x, k) => (
                                        <li key={k} className="flex flex-wrap items-center gap-2">
                                            <span className="flex-1 min-w-[10rem]">{x.grave ? <b>Impede: </b> : ''}{x.texto}</span>
                                            <button type="button" className="underline underline-offset-2 font-medium" onClick={() => irParaFase(x.fase)} hidden={!x.fase}>Ir</button>
                                        </li>
                                    ))}
                                    {pendencias.length > 10 && <li>e mais {pendencias.length - 10}…</li>}
                                </ul>
                            </section>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                            <h3 className="text-sm font-semibold">{p.fases.length} fases</h3>
                            <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => setAbertas(new Set(todasAbertas ? [] : p.fases.map((f) => f.id)))}>{todasAbertas ? 'Recolher todas' : 'Abrir todas'}</Button>
                        </div>
                        {p.fases.map((f, i) => (
                            <CartaoFase key={f.id} f={f} i={i} total={p.fases.length} fases={p.fases} existentes={existentes} unidadesNovas={p.unidades}
                                aberta={abertas.has(f.id)} onAlternar={() => alternar(f.id)} selecionada={sel === f.id} pendente={comPendencia.has(f.id)} unidadeNome={nomeUnidade(f.unidade_ref)}
                                nomeModelo={nomeModelo} modelos={estado.modelos || []} mudar={(d) => mudarFase(f.id, d)} mover={(d) => mover(i, d)} remover={() => remover(f.id)}
                                novaUnidade={() => novaUnidade(f.id)} addModelo={(n) => addModelo(f, n)} />
                        ))}
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => { const id = novoIdFase(); setP({ ...p, fases: [...p.fases, { id, nome: '', proximas: [] }] }); setAbertas((s) => new Set(s).add(id)); }}><Plus className="w-4 h-4" /> Adicionar fase</Button>
                    </div>

                    <aside className="space-y-4 lg:sticky lg:top-0 self-start">
                        {editando && (
                            <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                <h3 className="text-sm font-semibold">Situação</h3>
                                <label className="flex items-center gap-2 text-sm"><Checkbox checked={p.ativo !== false} onCheckedChange={(c) => setP({ ...p, ativo: c === true })} /> Disponível para novas autuações</label>
                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                    {tiposDoRito.length ? `Usado por: ${tiposDoRito.map((t) => t.nome).join(', ')}.` : 'Nenhum tipo de processo usa este rito.'} Processos em andamento seguem com a versão com que foram autuados.
                                </p>
                                {extra}
                            </section>
                        )}
                        {p.fases.some((f) => f.nome.trim()) && (
                            <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                <h3 className="text-sm font-semibold">Exportar</h3>
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" className="gap-1" onClick={() => baixarPlanilha(p.fases, p.nome)}><FileSpreadsheet className="w-4 h-4" aria-hidden /> Planilha</Button>
                                    <Button size="sm" variant="outline" className="gap-1" onClick={() => copiarTexto(ritoParaMermaid(p.fases), 'Diagrama copiado em Mermaid')}><Copy className="w-4 h-4" aria-hidden /> Diagrama (Mermaid)</Button>
                                </div>
                            </section>
                        )}
                        <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                            <h3 className="text-sm font-semibold flex items-center gap-1.5"><Building2 className="w-4 h-4" aria-hidden /> Unidades novas ({unNovas.length})</h3>
                            {unNovas.length === 0 && <p className="text-xs text-slate-600">Todas as unidades citadas já existem no órgão.</p>}
                            {unNovas.map((u) => (
                                <div key={u.ref} className="space-y-1.5 border-t first:border-0 border-slate-100 dark:border-slate-800 pt-2 first:pt-0">
                                    <div className="flex gap-2">
                                        <Input aria-label="Nome da unidade nova" value={u.nome} onChange={(e) => setP({ ...p, unidades: p.unidades.map((x) => (x.ref === u.ref ? { ...x, nome: e.target.value } : x)) })} className="h-8" />
                                        <select aria-label="Tipo da unidade nova" value={u.tipo} onChange={(e) => setP({ ...p, unidades: p.unidades.map((x) => (x.ref === u.ref ? { ...x, tipo: e.target.value } : x)) })} className={`${campo} h-8`}>
                                            {Object.entries(TIPOS_UNIDADE).map(([k, t]) => <option key={k} value={k}>{t.rotulo}</option>)}
                                        </select>
                                    </div>
                                    {existentes.length > 0 && (
                                        <select aria-label={`Usar uma unidade existente no lugar de ${u.nome}`} value="" onChange={(e) => e.target.value && trocarUnidade(u.ref, e.target.value)} className={`${campo} h-8 w-full text-xs`}>
                                            <option value="">Ou usar uma unidade que já existe…</option>
                                            {existentes.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                                        </select>
                                    )}
                                </div>
                            ))}
                        </section>
                        <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                            <h3 className="text-sm font-semibold flex items-center gap-1.5"><FileText className="w-4 h-4" aria-hidden /> Modelos novos ({modNovos.length})</h3>
                            {modNovos.length === 0 && <p className="text-xs text-slate-600">Nenhum modelo novo. Documentos citados nas fases aparecem aqui.</p>}
                            {modNovos.map((m) => (
                                <div key={m.ref} className="space-y-1.5 border-t first:border-0 border-slate-100 dark:border-slate-800 pt-2 first:pt-0">
                                    <div className="flex gap-2">
                                        <Input aria-label="Nome do modelo novo" value={m.nome} onChange={(e) => setP({ ...p, modelos: p.modelos.map((x) => (x.ref === m.ref ? { ...x, nome: e.target.value } : x)) })} className="h-8" />
                                        <select aria-label="Tipo de documento" value={m.tipo_documento || ''} onChange={(e) => setP({ ...p, modelos: p.modelos.map((x) => (x.ref === m.ref ? { ...x, tipo_documento: e.target.value } : x)) })} className={`${campo} h-8 max-w-[9rem]`}>
                                            <option value="">Qualquer tipo</option>
                                            {(estado.documento?.tipos_documento || []).map((t) => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <p className="text-xs text-slate-600">{m.unidade_ref ? `Da unidade ${nomeUnidade(m.unidade_ref)}` : 'Do órgão'} · sai com um texto-base com campos automáticos para completar.</p>
                                    {(estado.modelos || []).length > 0 && (
                                        <select aria-label={`Usar um modelo existente no lugar de ${m.nome}`} value="" onChange={(e) => e.target.value && trocarModelo(m.ref, e.target.value)} className={`${campo} h-8 w-full text-xs`}>
                                            <option value="">Ou usar um modelo que já existe…</option>
                                            {estado.modelos.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                                        </select>
                                    )}
                                </div>
                            ))}
                        </section>
                        <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                            <label className="flex items-center gap-2 text-sm font-semibold"><Checkbox checked={tipo.criar} onCheckedChange={(c) => setTipo({ ...tipo, criar: c === true })} /> Criar tipo de processo com este rito</label>
                            {tipo.criar && (
                                <div className="flex gap-2">
                                    <Input aria-label="Nome do tipo de processo" placeholder={p.nome} value={tipo.nome} onChange={(e) => setTipo({ ...tipo, nome: e.target.value })} className="h-8" />
                                    <Input aria-label="Sigla" placeholder="Sigla" value={tipo.sigla} onChange={(e) => setTipo({ ...tipo, sigla: e.target.value })} className="h-8 w-24" />
                                </div>
                            )}
                            {tipo.criar && <p className="text-xs text-slate-600">Começa na unidade da primeira fase{p.fases[0]?.unidade_ref ? ` (${nomeUnidade(p.fases[0].unidade_ref)})` : ''}.</p>}
                        </section>
                    </aside>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-900">
                {editando
                    ? <Button variant="ghost" className="gap-1 text-red-700 dark:text-red-300" onClick={() => setExcluir(true)}><Trash2 className="w-4 h-4" aria-hidden /> Excluir rito</Button>
                    : <Button variant="ghost" onClick={onVoltar}>Voltar ao início</Button>}
                {editando && <Button variant="ghost" className="gap-1" onClick={onTrocarFases}><FileUp className="w-4 h-4" aria-hidden /> Substituir fases</Button>}
                <span className="text-xs text-slate-600 dark:text-slate-300">Rascunho salvo neste navegador.</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 ml-auto text-right">
                    {editando ? `Será salvo como versão ${(p.versao || 1) + 1} (${p.fases.length} fases)` : `Será criado: 1 rito (${p.fases.length} fases)`}{unNovas.length ? `, ${unNovas.length} unidade${unNovas.length > 1 ? 's' : ''} nova${unNovas.length > 1 ? 's' : ''}` : ''}{modNovos.length ? `, ${modNovos.length} modelo${modNovos.length > 1 ? 's' : ''} novo${modNovos.length > 1 ? 's' : ''}` : ''}{tipo.criar && (tipo.nome || p.nome).trim() ? ', 1 tipo de processo' : ''}.
                </p>
                {confirmar ? (
                    <>
                        <Button variant="outline" onClick={() => setConfirmar(false)} disabled={implantando}>Revisar mais</Button>
                        <Button className="gap-1" onClick={onImplantar} disabled={implantando}>{implantando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {editando ? 'Confirmar e salvar' : 'Confirmar implantação'}</Button>
                    </>
                ) : (
                    <Button className="gap-1" disabled={semNome || !p.nome.trim()} onClick={() => setConfirmar(true)} title={semNome ? 'Resolva as pendências marcadas como "Impede"' : !p.nome.trim() ? 'Dê um nome ao rito' : undefined}>
                        {editando ? <><Save className="w-4 h-4" /> Salvar alterações</> : <><Rocket className="w-4 h-4" /> Implantar rito</>}
                    </Button>
                )}
            </div>
            <AlertDialog open={excluir} onOpenChange={setExcluir}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir o rito “{p.nome}”?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-2">
                                {tiposDoRito.length
                                    ? <BloqueioRito tipos={tiposDoRito} onAbrirTipo={onAbrirTipo} />
                                    : <p>O rito sai das listas e não pode mais ser usado em novas autuações. Os processos já autuados seguem com as fases que copiaram dele, e o histórico fica guardado. Dá para restaurar depois, em “Excluídos”. Se só quer parar de usá-lo por um tempo, desmarque “Disponível para novas autuações”.</p>}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        {!tiposDoRito.length && <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={onExcluir}>Excluir rito</AlertDialogAction>}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function CartaoFase({ f, i, total, fases, existentes, unidadesNovas, nomeModelo, modelos, mudar, mover, remover, novaUnidade, addModelo, aberta, onAlternar, selecionada, pendente, unidadeNome }) {
    const [novoModelo, setNovoModelo] = useState('');
    const outras = fases.filter((x) => x.id !== f.id);
    const saidas = f.proximas || [];
    const proxLista = i < total - 1 ? fases[i + 1].nome : null;
    const setSaida = (k, id) => {
        const novas = [...saidas];
        const antiga = novas[k];
        novas[k] = id;
        const condicoes = { ...(f.condicoes || {}) };
        if (antiga && condicoes[antiga] !== undefined) { condicoes[id] = condicoes[antiga]; delete condicoes[antiga]; }
        mudar({ proximas: [...new Set(novas.filter(Boolean))], condicoes });
    };
    const nomeDe = (id) => fases.find((x) => x.id === id)?.nome || '?';
    const nAcoes = (f.acoes || []).filter((a) => a.trim()).length;
    const resumo = f.final ? 'Fim do processo' : saidas.length > 1 ? `${saidas.length} saídas` : saidas.length === 1 ? `→ ${nomeDe(saidas[0])}` : proxLista ? `→ ${proxLista}` : 'Sem saída';
    return (
        <div id={`fase-${f.id}`} className={`rounded-lg border bg-white dark:bg-slate-900 scroll-mt-4 ${selecionada ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900' : 'border-slate-200 dark:border-slate-700'}`}>
            <button type="button" onClick={onAlternar} aria-expanded={aberta} aria-controls={`fase-corpo-${f.id}`}
                className="flex w-full items-center gap-2 rounded-lg p-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
                <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-100 text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-medium ${f.nome.trim() ? '' : 'text-red-700 dark:text-red-300'}`}>{f.nome.trim() || 'Fase sem nome'}</span>
                    <span className="block truncate text-xs text-slate-600 dark:text-slate-300">
                        {[unidadeNome || 'Sem unidade', f.prazo_dias ? `${f.prazo_dias} dias` : '', nAcoes ? `${nAcoes} ${nAcoes > 1 ? 'ações' : 'ação'}` : '', resumo].filter(Boolean).join(' · ')}
                    </span>
                </span>
                {pendente && <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" aria-label="Tem pendência" />}
                <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${aberta ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {aberta && (
            <div id={`fase-corpo-${f.id}`} className="space-y-3 border-t border-slate-100 dark:border-slate-800 p-3">
            <div className="flex flex-wrap items-center gap-2">
                <Input aria-label={`Nome da fase ${i + 1}`} value={f.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Nome da fase" className="h-9 flex-1 min-w-[10rem] font-medium" />
                <Input aria-label={`Prazo da fase ${i + 1}, em dias`} type="number" min={1} max={3650} placeholder="Dias" value={f.prazo_dias || ''} onChange={(e) => mudar({ prazo_dias: Number(e.target.value) || undefined })} className="h-9 w-20" />
                <div className="flex">
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} onClick={() => mover(-1)} aria-label="Subir fase"><ArrowUp className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === total - 1} onClick={() => mover(1)} aria-label="Descer fase"><ArrowDown className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" disabled={total === 1} onClick={remover} aria-label={`Remover a fase ${f.nome || i + 1}`}><Trash2 className="w-4 h-4" /></Button>
                </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <Label htmlFor={`un-${f.id}`} className="text-xs">Unidade</Label>
                    <select id={`un-${f.id}`} value={f.unidade_ref || ''} onChange={(e) => (e.target.value === '__nova' ? novaUnidade() : mudar({ unidade_ref: e.target.value || null }))} className={`${campo} w-full`}>
                        <option value="">Sem unidade definida</option>
                        {existentes.length > 0 && <optgroup label="Do órgão">{existentes.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</optgroup>}
                        {unidadesNovas.length > 0 && <optgroup label="Novas (serão criadas)">{unidadesNovas.map((u) => <option key={u.ref} value={u.ref}>{u.nome}</option>)}</optgroup>}
                        <option value="__nova">+ Nova unidade…</option>
                    </select>
                </div>
                <div>
                    <Label htmlFor={`ag-${f.id}`} className="text-xs">Quem faz (cargo ou papel)</Label>
                    <Input id={`ag-${f.id}`} value={f.agente || ''} onChange={(e) => mudar({ agente: e.target.value })} placeholder="Ex.: Analista, Promotor" className="h-9" />
                </div>
            </div>
            <AcoesDaFase f={f} modelos={modelos} mudar={mudar} idBase={`pr-${f.id}`} />
            <RegistroEDocumentos f={f} modelos={modelos} mudar={mudar} />
            <div>
                <p className="text-xs font-medium mb-1">Modelos de documento</p>
                <div className="flex flex-wrap gap-1.5 items-center">
                    {(f.modelos_ref || []).map((r) => (
                        <Badge key={r} variant={String(r).startsWith('+') ? 'outline' : 'secondary'} className="gap-1">
                            {nomeModelo(r)}{String(r).startsWith('+') && <span className="text-[10px] text-indigo-600">novo</span>}
                            <button type="button" onClick={() => mudar({ modelos_ref: f.modelos_ref.filter((x) => x !== r) })} aria-label={`Tirar ${nomeModelo(r)}`}><X className="w-3 h-3" /></button>
                        </Badge>
                    ))}
                    <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); addModelo(novoModelo); setNovoModelo(''); }}>
                        <Input aria-label="Adicionar modelo pelo nome" value={novoModelo} onChange={(e) => setNovoModelo(e.target.value)} placeholder="+ modelo" className="h-7 w-36 text-xs" />
                    </form>
                </div>
            </div>
            <fieldset>
                <legend className="text-xs font-medium mb-1">Encaminhamentos</legend>
                <label className="flex items-center gap-2 text-sm mb-2"><Checkbox checked={!!f.final} onCheckedChange={(c) => mudar({ final: c === true })} /> O processo termina nesta fase</label>
                {!f.final && (
                    <div className="space-y-1.5">
                        {saidas.length === 0 && <p className="text-xs text-slate-600">{proxLista ? `Segue para a próxima da lista (${proxLista}).` : 'Última fase.'}</p>}
                        {saidas.map((id, k) => (
                            <div key={`${id}-${k}`} className="flex flex-wrap gap-2 items-center">
                                <span className="text-xs text-slate-600">→</span>
                                <select aria-label="Próxima fase" value={id} onChange={(e) => setSaida(k, e.target.value)} className={`${campo} h-8 flex-1 min-w-[9rem]`}>
                                    {outras.map((x) => <option key={x.id} value={x.id}>{x.nome || '(sem nome)'}</option>)}
                                </select>
                                <Input aria-label="Condição desta saída" value={f.condicoes?.[id] || ''} onChange={(e) => mudar({ condicoes: { ...(f.condicoes || {}), [id]: e.target.value } })} placeholder="Condição (ex.: se deferido)" className="h-8 flex-1 min-w-[9rem]" />
                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => mudar({ proximas: saidas.filter((x) => x !== id) })} aria-label="Tirar esta saída"><X className="w-4 h-4" /></Button>
                            </div>
                        ))}
                        {outras.length > 0 && (
                            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => {
                                const livre = outras.find((x) => !saidas.includes(x.id) && x.id === fases[i + 1]?.id) || outras.find((x) => !saidas.includes(x.id));
                                if (livre) mudar({ proximas: [...saidas, livre.id] });
                            }}><Plus className="w-3.5 h-3.5" /> Alternativa</Button>
                        )}
                    </div>
                )}
            </fieldset>
            <div>
                <Label htmlFor={`or-${f.id}`} className="text-xs">Orientação para a equipe</Label>
                <Textarea id={`or-${f.id}`} rows={2} value={f.orientacao || ''} onChange={(e) => mudar({ orientacao: e.target.value })} />
            </div>
            </div>
            )}
        </div>
    );
}
