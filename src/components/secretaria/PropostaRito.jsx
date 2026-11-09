import React, { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    AlertTriangle, ArrowDown, ArrowUp, Building2, CheckCircle2, Download, FileText, FileUp, GitBranch, Loader2, Plus, Rocket, Shapes, Trash2, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { arquivoParaBase64, secConfig } from '@/services/secretariaService';
import { propostaDeConteudo, propostaDeTabela, propostaDeTexto, sem, tipoDocumentoDe, vincularProposta } from '@/lib/propostaRito';
import { modelosDeRito, novoIdFase } from '@/lib/secretariaRito';
import FluxoRito from './FluxoRito';
import { baixarPlanilha } from './RitoEditor';
import { TIPOS_UNIDADE } from './comum';

const MAX_MB = 5;
const ACEITOS = '.xlsx,.xls,.csv,.ods,.docx,.pdf,.txt,.md,.bpmn,.xml,.drawio,.mmd';
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const campo = 'h-9 rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm';
const chaveRascunho = (orgId) => `rito-rascunho-${orgId}`;
const lerRascunho = (orgId) => { try { return JSON.parse(localStorage.getItem(chaveRascunho(orgId)) || 'null'); } catch { return null; } };

/** Pendências que travam ou enfraquecem a implantação, com a fase para ir até ela. */
export function pendenciasDaProposta(p) {
    const out = [];
    const ids = new Set(p.fases.map((f) => f.id));
    p.fases.forEach((f, i) => {
        const rot = f.nome.trim() || `Fase ${i + 1}`;
        if (!f.nome.trim()) out.push({ fase: f.id, grave: true, texto: `${rot} está sem nome.` });
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
    if (['xlsx', 'xls', 'csv', 'ods'].includes(ext)) {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        for (const nome of wb.SheetNames) {
            const r = propostaDeTabela(XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: false, blankrows: false, defval: '' }));
            if (r.fases.length) return { ...r, origem: `planilha (aba ${nome})` };
        }
        return { fases: [], avisos: ['Nenhuma aba com fases. A primeira linha precisa ter os títulos das colunas (Fase, Unidade, Responsável, Prazo, Ações, Documentos, Segue para, Condição).'] };
    }
    if (ext === 'docx' || ext === 'pdf') {
        const r = await secConfig(orgId, 'extrairTextoRito', { arquivo: { base64: await arquivoParaBase64(file), mime: ext === 'pdf' ? 'application/pdf' : MIME_DOCX, nome: file.name } });
        // Tabela do Word com coluna "Fase" vale mais que o texto corrido.
        for (const t of r.tabelas || []) {
            const p = propostaDeTabela(t);
            if (p.fases.length > 1) return { ...p, origem: 'tabela do Word' };
        }
        return { ...propostaDeTexto(r.texto), origem: ext === 'pdf' ? 'texto do PDF' : 'texto do Word' };
    }
    return propostaDeConteudo(await file.text(), file.name);
}

/**
 * Importação de rito: lê planilha, Word, PDF, BPMN, draw.io, Mermaid ou texto,
 * monta a proposta (fases com unidade, agente, ações, modelos e saídas com
 * condição) e deixa o admin revisar tudo antes de implantar. Implantar cria,
 * de uma vez, as unidades e os modelos que faltam, o rito e o tipo de processo.
 */
export default function PropostaRito({ aberto, orgId, estado, onFechar, onIr }) {
    const qc = useQueryClient();
    const [lendo, setLendo] = useState(false);
    const [colado, setColado] = useState('');
    const [p, setP] = useState(null); // proposta vinculada
    const [tipo, setTipo] = useState({ criar: true, nome: '', sigla: '' });
    const [confirmar, setConfirmar] = useState(false);
    const [implantando, setImplantando] = useState(false);
    const [criado, setCriado] = useState(null); // resumo após implantar
    const [rascunho, setRascunho] = useState(() => lerRascunho(orgId));

    // Rascunho da revisão fica no navegador: fechar ou cair não perde o trabalho.
    useEffect(() => {
        if (!p) return;
        try { localStorage.setItem(chaveRascunho(orgId), JSON.stringify({ p, tipo, em: Date.now() })); } catch { /* sem espaço: segue sem rascunho */ }
    }, [p, tipo, orgId]);
    const descartarRascunho = () => { try { localStorage.removeItem(chaveRascunho(orgId)); } catch { /* ignora */ } setRascunho(null); };
    const continuarRascunho = () => { setP(rascunho.p); setTipo(rascunho.tipo || { criar: true, nome: rascunho.p.nome, sigla: '' }); setConfirmar(false); };

    const fechar = () => { if (p && !criado) setRascunho(lerRascunho(orgId)); setP(null); setColado(''); setConfirmar(false); setCriado(null); onFechar(); };
    const carregar = (r, nomePadrao) => {
        if (!r.fases.length) { toast.error(r.avisos?.[0] || 'Não achei fases'); return; }
        const v = vincularProposta(r, estado);
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
                    <DialogTitle className="text-base">Importar rito de arquivo</DialogTitle>
                    <DialogDescription className="sr-only">Leia um arquivo, revise a proposta e implante o rito</DialogDescription>
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={fechar} aria-label="Fechar"><X className="w-4 h-4" /></Button>
                </div>
                {criado ? (
                    <ResumoImplantacao r={criado} onIr={(aba) => { fechar(); onIr?.(aba); }} onFechar={fechar} />
                ) : !p ? (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                        <div className="max-w-3xl mx-auto space-y-6">
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                O sistema lê o arquivo e monta uma <b>proposta de rito</b>: fases, unidades, quem faz, ações, documentos, prazos,
                                encaminhamentos e alternativas. Você revisa e ajusta tudo antes de implantar. Nada é criado até você confirmar.
                            </p>
                            {rascunho?.p && (
                                <div className="flex flex-wrap items-center gap-2 rounded-md border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 p-3 text-sm">
                                    <span className="flex-1 min-w-[12rem]">Há uma revisão não implantada: <b>{rascunho.p.nome}</b> ({rascunho.p.fases.length} fases), de {new Date(rascunho.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.</span>
                                    <Button size="sm" onClick={continuarRascunho}>Continuar a revisão</Button>
                                    <Button size="sm" variant="ghost" onClick={descartarRascunho}>Descartar</Button>
                                </div>
                            )}
                            <label className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-400 ${lendo ? 'opacity-60 pointer-events-none' : ''}`}>
                                {lendo ? <Loader2 className="w-7 h-7 animate-spin text-indigo-600" aria-hidden /> : <FileUp className="w-7 h-7 text-indigo-600" aria-hidden />}
                                <span className="font-medium">{lendo ? 'Lendo…' : 'Escolher arquivo'}</span>
                                <span className="text-xs text-slate-600">Planilha (Excel, CSV), Word, PDF, BPMN, draw.io, Mermaid ou texto · até {MAX_MB} MB</span>
                                <input type="file" accept={ACEITOS} className="sr-only" onChange={escolher} disabled={lendo} />
                            </label>
                            <div className="grid sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
                                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3"><b className="block mb-1">Planilha</b>Uma linha por fase ou por atividade. Colunas: Fase, Unidade, Responsável, Prazo, Ações, Documentos, Segue para, Condição, Orientação.</div>
                                <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3"><b className="block mb-1">Diagrama</b>BPMN (Bizagi, Camunda, bpmn.io), draw.io ou Mermaid. Raias viram unidades; losangos, alternativas com a condição da seta.</div>
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
                        implantando={implantando} onVoltar={() => setP(null)}
                        onImplantar={async () => {
                            setImplantando(true);
                            try {
                                const payload = montarPayload(p, tipo);
                                const r = await secConfig(orgId, 'aplicarPropostaRito', { proposta: payload });
                                toast.success('Rito implantado');
                                qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
                                descartarRascunho();
                                setCriado({ nome: p.nome, fases: p.fases.length, unidades: payload.unidades.map((u) => u.nome), modelos: payload.modelos.map((m) => m.nome), tipo: payload.tipo_processo?.nome || null, ...r });
                                setP(null);
                            } catch (e) { toast.error(e?.message || 'Não foi possível implantar'); setConfirmar(false); } finally { setImplantando(false); }
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
                        <h3 className="text-lg font-semibold">Rito “{r.nome}” implantado</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300">Foram criados: 1 rito com {n(r.fases, 'fase', 'fases')}{r.unidades.length ? `, ${n(r.unidades.length, 'unidade', 'unidades')}` : ''}{r.modelos.length ? `, ${n(r.modelos.length, 'modelo', 'modelos')}` : ''}{r.tipo ? ', 1 tipo de processo' : ''}.</p>
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
                        <span className="flex-1 min-w-[12rem]">O rito está ativo. Use “Ver como a equipe e a parte” no topo para conferir cada fase.</span>
                        <Button size="sm" variant="outline" onClick={() => onIr('ritos')}>Abrir o rito</Button>
                    </li>
                </ul>
                <Button onClick={onFechar}>Fechar</Button>
            </div>
        </div>
    );
}

/** Só vai o que as fases usam; refs "+N" viram ids no servidor. */
function montarPayload(p, tipo) {
    const usadosUn = new Set(p.fases.map((f) => f.unidade_ref).filter(Boolean));
    const usadosMod = new Set(p.fases.flatMap((f) => f.modelos_ref || []));
    const modelos = p.modelos.filter((m) => usadosMod.has(m.ref));
    modelos.forEach((m) => m.unidade_ref && usadosUn.add(m.unidade_ref));
    return {
        rito: {
            nome: p.nome, descricao: p.descricao,
            fases: p.fases.map((f) => ({
                id: f.id, nome: f.nome, prazo_dias: f.prazo_dias, orientacao: f.orientacao, final: f.final === true,
                proximas: f.final ? [] : (f.proximas || []).filter((id) => id !== f.id && p.fases.some((x) => x.id === id)),
                condicoes: f.condicoes, agente: f.agente, acoes: f.acoes, unidade_ref: f.unidade_ref, modelos_ref: f.modelos_ref,
            })),
        },
        unidades: p.unidades.filter((u) => usadosUn.has(u.ref)),
        modelos,
        tipo_processo: tipo.criar && tipo.nome.trim() ? { nome: tipo.nome.trim(), sigla: tipo.sigla.trim() } : null,
    };
}

function Revisao({ p, setP, estado, tipo, setTipo, confirmar, setConfirmar, implantando, onVoltar, onImplantar }) {
    const existentes = estado.unidades.filter((u) => u.ativa !== false);
    const nomeUnidade = (ref) => existentes.find((u) => u.id === ref)?.nome || p.unidades.find((u) => u.ref === ref)?.nome || '';
    const nomeModelo = (ref) => (estado.modelos || []).find((m) => m.id === ref)?.nome || p.modelos.find((m) => m.ref === ref)?.nome || ref;
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
    const irParaFase = (id) => document.getElementById(`fase-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const fluxo = p.fases.map((f) => ({ ...f, proximas: f.final ? [] : f.proximas }));

    return (
        <>
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 p-4">
                    <div className="space-y-3 min-w-0">
                        <div className="grid sm:grid-cols-2 gap-3">
                            <div><Label htmlFor="pr-nome">Nome do rito</Label><Input id="pr-nome" value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} /></div>
                            <div><Label htmlFor="pr-desc">Descrição</Label><Input id="pr-desc" value={p.descricao} onChange={(e) => setP({ ...p, descricao: e.target.value })} /></div>
                        </div>
                        {p.avisos?.length > 0 && (
                            <ul className="text-xs space-y-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 p-3">
                                {p.avisos.slice(0, 8).map((a, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />{a}</li>)}
                            </ul>
                        )}
                        {pendencias.length > 0 && (
                            <section aria-label="Pendências" className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3">
                                <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" aria-hidden /> {pendencias.length} pendência{pendencias.length > 1 ? 's' : ''} antes de implantar</h3>
                                <ul className="mt-1.5 space-y-1 text-xs text-amber-900 dark:text-amber-100">
                                    {pendencias.slice(0, 10).map((x, k) => (
                                        <li key={k} className="flex flex-wrap items-center gap-2">
                                            <span className="flex-1 min-w-[10rem]">{x.grave ? <b>Impede: </b> : ''}{x.texto}</span>
                                            <button type="button" className="underline underline-offset-2 font-medium" onClick={() => irParaFase(x.fase)}>Ir</button>
                                        </li>
                                    ))}
                                    {pendencias.length > 10 && <li>e mais {pendencias.length - 10}…</li>}
                                </ul>
                            </section>
                        )}
                        <h3 className="text-sm font-semibold pt-1">{p.fases.length} fases</h3>
                        {p.fases.map((f, i) => (
                            <CartaoFase key={f.id} f={f} i={i} total={p.fases.length} fases={p.fases} existentes={existentes} unidadesNovas={p.unidades}
                                nomeModelo={nomeModelo} mudar={(d) => mudarFase(f.id, d)} mover={(d) => mover(i, d)} remover={() => remover(f.id)}
                                novaUnidade={() => novaUnidade(f.id)} addModelo={(n) => addModelo(f, n)} />
                        ))}
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => setP({ ...p, fases: [...p.fases, { id: novoIdFase(), nome: '', proximas: [] }] })}><Plus className="w-4 h-4" /> Adicionar fase</Button>
                    </div>

                    <aside className="space-y-4 lg:sticky lg:top-0 self-start">
                        <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                            <h3 className="text-sm font-semibold mb-2">Fluxo</h3>
                            <div className="max-h-[42vh] overflow-auto"><FluxoRito fases={fluxo} /></div>
                        </section>
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
                                    <Input aria-label="Nome do tipo de processo" value={tipo.nome} onChange={(e) => setTipo({ ...tipo, nome: e.target.value })} className="h-8" />
                                    <Input aria-label="Sigla" placeholder="Sigla" value={tipo.sigla} onChange={(e) => setTipo({ ...tipo, sigla: e.target.value })} className="h-8 w-24" />
                                </div>
                            )}
                            {tipo.criar && <p className="text-xs text-slate-600">Começa na unidade da primeira fase{p.fases[0]?.unidade_ref ? ` (${nomeUnidade(p.fases[0].unidade_ref)})` : ''}.</p>}
                        </section>
                    </aside>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-900">
                <Button variant="ghost" onClick={onVoltar}>Outro arquivo</Button>
                <span className="text-xs text-slate-600 dark:text-slate-300">Rascunho salvo neste navegador.</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 ml-auto text-right">
                    Será criado: 1 rito ({p.fases.length} fases){unNovas.length ? `, ${unNovas.length} unidade${unNovas.length > 1 ? 's' : ''}` : ''}{modNovos.length ? `, ${modNovos.length} modelo${modNovos.length > 1 ? 's' : ''}` : ''}{tipo.criar && tipo.nome.trim() ? ', 1 tipo de processo' : ''}.
                </p>
                {confirmar ? (
                    <>
                        <Button variant="outline" onClick={() => setConfirmar(false)} disabled={implantando}>Revisar mais</Button>
                        <Button className="gap-1" onClick={onImplantar} disabled={implantando}>{implantando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Confirmar implantação</Button>
                    </>
                ) : (
                    <Button className="gap-1" disabled={semNome || !p.nome.trim()} onClick={() => setConfirmar(true)} title={semNome ? 'Resolva as pendências marcadas como "Impede"' : undefined}><Rocket className="w-4 h-4" /> Implantar rito</Button>
                )}
            </div>
        </>
    );
}

function CartaoFase({ f, i, total, fases, existentes, unidadesNovas, nomeModelo, mudar, mover, remover, novaUnidade, addModelo }) {
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
    return (
        <div id={`fase-${f.id}`} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3 scroll-mt-4">
            <div className="flex flex-wrap items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-100 text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                <Input aria-label={`Nome da fase ${i + 1}`} value={f.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Nome da fase" className="h-9 flex-1 min-w-[10rem] font-medium" />
                <Input aria-label={`Prazo da fase ${i + 1}, em dias`} type="number" min={1} max={3650} placeholder="Dias" value={f.prazo_dias || ''} onChange={(e) => mudar({ prazo_dias: Number(e.target.value) || undefined })} className="h-9 w-20" />
                <div className="flex">
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === 0} onClick={() => mover(-1)} aria-label="Subir fase"><ArrowUp className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" disabled={i === total - 1} onClick={() => mover(1)} aria-label="Descer fase"><ArrowDown className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={remover} aria-label={`Remover a fase ${f.nome || i + 1}`}><Trash2 className="w-4 h-4" /></Button>
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
            <div>
                <Label htmlFor={`ac-${f.id}`} className="text-xs">Ações (uma por linha)</Label>
                <Textarea id={`ac-${f.id}`} rows={Math.min(5, Math.max(2, (f.acoes || []).length))} value={(f.acoes || []).join('\n')} onChange={(e) => mudar({ acoes: e.target.value.split('\n') })} placeholder="O que a equipe faz nesta fase" />
            </div>
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
    );
}
