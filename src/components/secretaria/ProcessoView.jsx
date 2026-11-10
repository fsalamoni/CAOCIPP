import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    AlertCircle, ArrowLeft, BookOpen, CalendarClock, CheckCircle2, ChevronDown, Download, Eye, FilePen, Loader2, MoreHorizontal,
    PenLine, Plus, Send, ShieldCheck, ShieldAlert, Paperclip, Trash2, Undo2, UserPlus, Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { secConfig, secDocumento, secExportarPdf, secProcesso, baixarBase64, base64ParaUrl, arquivoParaBase64 } from '@/services/secretariaService';
import { NativeSelect, STATUS_ROTULO, SeloUrgente, dataHora, documentoDaUnidade, modelosDaUnidade, rotuloUnidade } from './comum';
import FluxoRito from './FluxoRito';
import { CamposProcesso, DadosCampos } from './CamposProcesso';
import { faltando, formularioDe, valoresDe } from '@/lib/camposProcesso';
import LeitorAutos from './LeitorAutos';
import EventosAutos from './EventosAutos';
import ErroQuery from './ErroQuery';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { seguintes } from '@/lib/secretariaRito';
import RedacaoDocumento, { VisualizadorPdf } from './RedacaoDocumento';

const MAX_MB = 5;
const folhas = (d) => (d.folha_inicial ? (d.folha_final > d.folha_inicial ? `fls. ${d.folha_inicial}–${d.folha_final}` : `fl. ${d.folha_inicial}`) : null);
const diasDesde = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
const emCampo = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;

export default function ProcessoView({ orgId, procId, estado, onVoltar }) {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['sec-proc', orgId, procId], queryFn: () => secProcesso(orgId, 'obter', { id: procId }) });
    const [acao, setAcao] = useState(null); // {tipo, ...}
    const [ocupado, setOcupado] = useState(false);
    const [linkConvite, setLinkConvite] = useState(null); // {link, emailEnviado}
    const [editor, setEditor] = useState(null); // {docId?, titulo, tipo, conteudo, somenteLeitura, modeloId?}
    const [pdf, setPdf] = useState(null); // {base64, nome, titulo}
    const [novoDoc, setNovoDoc] = useState(false);
    const [leitura, setLeitura] = useState(null); // id do documento aberto no leitor contínuo
    const pendenciasRef = useRef(null);
    const eventosRef = useRef(null);

    const p = q.data?.processo;
    const posse = q.data?.posse;
    const arquivado = p?.status === 'arquivado';
    const podeMexer = !!posse && !arquivado;
    const algoAberto = !!(acao || editor || pdf || novoDoc || leitura || linkConvite);

    // Atalhos: N novo documento, T tramitar, J ir às pendências. Só com nada aberto e fora de campos.
    useEffect(() => {
        const aoTeclar = (e) => {
            if (algoAberto || emCampo(e) || e.ctrlKey || e.metaKey || e.altKey) return;
            const k = e.key.toLowerCase();
            if (k === 'n' && podeMexer) { e.preventDefault(); setNovoDoc(true); }
            if (k === 't' && podeMexer) { e.preventDefault(); setAcao({ tipo: 'tramitar' }); }
            if (k === 'j') { e.preventDefault(); pendenciasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [algoAberto, podeMexer]);

    if (q.isLoading) return <div className="py-8 flex gap-2 items-center text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Carregando processo…</div>;
    if (q.error?.message?.includes('Portal das partes')) {
        // Membro que é parte neste processo: aqui ele não é o órgão.
        return (
            <div role="alert" className="py-8 max-w-xl space-y-3">
                <p className="font-medium">Você é parte neste processo.</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Neste processo você não atua pelo órgão: acompanhe-o e manifeste-se pelo Portal das partes, como qualquer outra parte. As ferramentas da equipe ficam fechadas para você aqui.</p>
                <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm"><Link to={`${createPageUrl('Portal')}?p=${procId}`}>Abrir no Portal das partes</Link></Button>
                    <Button variant="ghost" size="sm" onClick={onVoltar}>Voltar</Button>
                </div>
            </div>
        );
    }
    if (q.error) return <ErroQuery q={q}><Button variant="ghost" size="sm" onClick={onVoltar}>Voltar</Button></ErroQuery>;

    const { movimentos, documentos, cadeiaQuebradaEm, hoje } = q.data;
    const unidadeAtual = estado.unidades.find((u) => u.id === p.unidade_atual);
    const noGabinete = unidadeAtual?.tipo === 'gabinete';
    const nomeUnidade = (id) => estado.unidades.find((u) => u.id === id)?.nome || id;
    const atualizar = () => {
        qc.invalidateQueries({ queryKey: ['sec-proc', orgId, procId] });
        qc.invalidateQueries({ queryKey: ['sec-processos', orgId] });
    };
    const executar = async (fn, okMsg) => {
        setOcupado(true);
        try {
            await fn();
            if (okMsg) toast.success(okMsg);
            setAcao(null);
            atualizar();
        } catch (e) {
            toast.error(e?.message || 'Não foi possível concluir');
            if (e?.code === 'functions/aborted') atualizar();
        } finally {
            setOcupado(false);
        }
    };
    const mov = (action, extra, msg) => executar(() => secProcesso(orgId, action, { id: procId, version: p.version, ...extra }), msg);
    const doc = (action, extra, msg) => executar(() => secDocumento(orgId, procId, action, extra), msg);
    const convidar = (parte_idx, email, extra = {}) => executar(async () => {
        const r = await secProcesso(orgId, 'convidarParte', { id: procId, version: p.version, parte_idx, email, ...extra });
        setLinkConvite(r);
    }, 'Convite gerado');
    const membrosDaUnidade = estado.membros.filter((m) => unidadeAtual?.membros_uids.includes(m.uid));

    const exportar = () => executar(async () => {
        const r = await secExportarPdf(orgId, procId);
        baixarBase64(r.base64, r.nome);
    }, 'PDF gerado');

    /** Arquivo original como foi enviado. */
    const baixarOriginal = (d) => executar(async () => {
        const r = await secDocumento(orgId, procId, 'baixar', { docId: d.id });
        baixarBase64(r.base64, r.nomeArquivo, r.mime);
    });

    /** Peça dos autos como está no processo: PDF com folhas e carimbo. */
    const verNosAutos = (d) => executar(async () => {
        const r = await secDocumento(orgId, procId, 'pdf', { docId: d.id });
        setPdf({ ...r, titulo: `Doc. nº ${d.ordem} · ${d.titulo}` });
    });

    const abrirMinuta = (d) => executar(async () => {
        const r = await secDocumento(orgId, procId, 'baixar', { docId: d.id });
        setEditor({ docId: d.id, titulo: r.titulo, tipo: d.tipo, conteudo: r.conteudo, somenteLeitura: (d.assinaturas || []).length > 0 });
    });

    const agora = new Date();
    const valoresCampos = {
        numero: p.numero, assunto: p.assunto, tipo_processo: p.tipo_nome || '', unidade: nomeUnidade(p.unidade_atual), fase: p.fase_nome,
        partes: p.partes.map((x) => `${x.nome} (${x.polo})`).join('; '), orgao: estado.orgao || '',
        usuario: estado.membros.find((m) => m.uid === estado.uid)?.nome || '',
        data: agora.toLocaleDateString('pt-BR'), data_extenso: agora.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
    };

    const enviarArquivo = async (file) => {
        if (!file) return;
        if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Arquivo acima de ${MAX_MB} MB`); return; }
        setNovoDoc(false);
        await executar(async () => {
            const base64 = await arquivoParaBase64(file);
            await secDocumento(orgId, procId, 'upload', { titulo: file.name.replace(/\.[^.]+$/, ''), tipo: 'Documento', nomeArquivo: file.name, mime: file.type, base64 });
        }, 'Arquivo enviado como minuta');
    };

    const tipoPadrao = documentoDaUnidade(estado, p.unidade_atual).tipos_documento?.[0] || 'Despacho';
    const modelos = modelosDaUnidade(estado, p.unidade_atual);
    /** Abre o editor (ou cria a minuta do Word/PDF) a partir de um modelo. */
    const usarModelo = (m) => {
        setNovoDoc(false);
        if (m.formato === 'original') {
            executar(async () => {
                const r = await secConfig(orgId, 'baixarModelo', { id: m.id, valores: valoresCampos });
                await secDocumento(orgId, procId, 'upload', { titulo: m.nome, tipo: m.tipo_documento || 'Documento', nomeArquivo: r.nome, mime: r.mime, base64: r.base64 });
            }, /\.pdf$/i.test(m.arquivo_nome) ? 'Minuta criada com o PDF do modelo' : 'Minuta criada com o Word do modelo, campos preenchidos');
            return;
        }
        setEditor({ titulo: m.nome, tipo: m.tipo_documento || tipoPadrao, conteudo: null, modeloId: m.id });
    };
    const redigirEmBranco = (tipo = tipoPadrao, titulo = '') => { setNovoDoc(false); setEditor({ titulo, tipo, conteudo: null }); };

    const minutas = documentos.filter((d) => d.status === 'minuta');
    const autos = documentos.filter((d) => d.status === 'juntado');
    const iAtual = p.fases.findIndex((f) => f.id === p.fase_atual);
    const faseAtual = p.fases[iAtual];
    const proximas = seguintes(p.fases, iAtual).map((id) => p.fases.find((f) => f.id === id)).filter(Boolean);
    // O rito pode dizer em que unidade a fase corre: sugere remeter para lá.
    const unidadeDaFase = faseAtual?.unidade_id && faseAtual.unidade_id !== p.unidade_atual
        ? estado.unidades.find((u) => u.id === faseAtual.unidade_id && u.ativa) : null;
    const modelosDaFase = (faseAtual?.modelos || []).map((id) => (estado.modelos || []).find((m) => m.id === id)).filter(Boolean);
    const feitas = new Set(p.acoes_feitas?.[p.fase_atual] || []);
    const pendenciasAbertas = p.pendencias.filter((x) => x.status === 'aberta');

    // Botão único da fase: o que o rito espera agora.
    let principal = null;
    if (podeMexer) {
        if (unidadeDaFase) {
            principal = { rotulo: `Enviar para ${unidadeDaFase.nome}`, icone: Send, acao: () => setAcao({ tipo: 'tramitar', destino: unidadeDaFase.id }) };
        } else if (p.fase_suspensa) {
            principal = noGabinete
                ? { rotulo: 'Apreciar a pendência', icone: AlertCircle, acao: () => setAcao({ tipo: 'resolver', pendencia: pendenciasAbertas.find((x) => x.interrompe) || pendenciasAbertas[0] }) }
                : null;
        } else if (proximas.length === 1) {
            const f = proximas[0];
            const un = f.unidade_id && f.unidade_id !== p.unidade_atual ? estado.unidades.find((u) => u.id === f.unidade_id && u.ativa) : null;
            principal = un
                ? { rotulo: `Concluir e enviar para ${un.nome}`, icone: Send, acao: () => setAcao({ tipo: 'tramitar', destino: un.id, fase_id: f.id }) }
                : { rotulo: `Concluir e seguir para ${f.nome}`, icone: CheckCircle2, acao: () => setAcao({ tipo: 'fase', fase_id: f.id }) };
        } else if (proximas.length > 1) {
            principal = { rotulo: 'Seguir para a próxima fase…', icone: CheckCircle2, acao: () => setAcao({ tipo: 'fase' }) };
        } else if (noGabinete && pendenciasAbertas.length) {
            principal = { rotulo: 'Apreciar a pendência', icone: AlertCircle, acao: () => setAcao({ tipo: 'resolver', pendencia: pendenciasAbertas[0] }) };
        } else {
            principal = { rotulo: 'Fase final: arquivar', icone: CheckCircle2, acao: () => setAcao({ tipo: 'situacao', status: 'arquivado' }) };
        }
    }

    const ultimoDoc = autos[autos.length - 1];
    const diasTramitando = diasDesde(p.autuado_em);

    return (
        <div className="space-y-5 pb-20 sm:pb-0">
            {(principal || podeMexer) && (
                <div className="sm:hidden fixed bottom-0 inset-x-0 z-20 flex gap-2 border-t bg-white/95 dark:bg-slate-950/95 backdrop-blur p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                    {principal && <Button className="flex-1 gap-2" disabled={ocupado} onClick={principal.acao}><principal.icone className="w-4 h-4" aria-hidden /> <span className="truncate">{principal.rotulo}</span></Button>}
                    {podeMexer && <Button variant="outline" size="icon" disabled={ocupado} onClick={() => setNovoDoc(true)} aria-label="Novo documento"><Plus className="w-4 h-4" aria-hidden /></Button>}
                </div>
            )}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                    <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={onVoltar}><ArrowLeft className="w-4 h-4" /> Processos</Button>
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-white"><span className="font-mono">{p.numero}</span> · {p.assunto}</h2>
                    <div className="flex flex-wrap gap-2 text-sm">
                        <Badge>{p.fase_nome}</Badge>
                        <Badge variant="secondary">{STATUS_ROTULO[p.status]}</Badge>
                        <Badge variant="outline">Com: {nomeUnidade(p.unidade_atual)}</Badge>
                        {p.responsavel_uid && <Badge variant="outline">Responsável: {estado.membros.find((m) => m.uid === p.responsavel_uid)?.nome || '—'}</Badge>}
                        {p.urgente && <SeloUrgente motivo={p.urgencia?.motivo} />}
                        {p.sigilo === 'restrito' && <Badge variant="outline">Restrito</Badge>}
                        {cadeiaQuebradaEm === null
                            ? <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><ShieldCheck className="w-4 h-4" /> Integridade conferida</span>
                            : <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400"><ShieldAlert className="w-4 h-4" /> Cadeia quebrada no movimento {cadeiaQuebradaEm}</span>}
                    </div>
                    {noGabinete && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {p.partes.map((x) => `${x.nome} (${x.polo})`).join(' · ') || 'Sem partes'}{p.tipo_nome ? ` · ${p.tipo_nome}` : ''}
                            {diasTramitando != null && ` · ${diasTramitando} dia${diasTramitando === 1 ? '' : 's'} em tramitação`}
                            {ultimoDoc && ` · último documento: nº ${ultimoDoc.ordem}, ${ultimoDoc.titulo}`}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                    {principal && (
                        <Button className="gap-2 hidden sm:inline-flex" disabled={ocupado} onClick={principal.acao}><principal.icone className="w-4 h-4" /> {principal.rotulo}</Button>
                    )}
                    {podeMexer && <Button variant="outline" className="gap-2 hidden sm:inline-flex" disabled={ocupado} onClick={() => setNovoDoc(true)} title="Atalho: N"><Plus className="w-4 h-4" /> Novo documento</Button>}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" className="gap-1" aria-label="Mais ações"><MoreHorizontal className="w-4 h-4" /> Mais <ChevronDown className="w-3 h-3" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {posse && (
                                <>
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'tramitar' })}>Enviar para outra unidade <span className="ml-auto text-xs text-slate-400">T</span></DropdownMenuItem>
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'fase' })}>Mudar a fase</DropdownMenuItem>
                                    {noGabinete && <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'devolver' })}>Devolver à secretaria com orientação</DropdownMenuItem>}
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'atribuir' })}>Atribuir a alguém da unidade</DropdownMenuItem>
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'pendencia' })}>Abrir pendência para o decisor</DropdownMenuItem>
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'prazo' })}>Abrir prazo</DropdownMenuItem>
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'urgencia' })}>{p.urgente ? 'Retirar a urgência' : 'Marcar como urgente'}</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setAcao({ tipo: 'situacao' })}>Alterar a situação</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            <DropdownMenuItem disabled={!autos.length} onSelect={() => setLeitura(autos[0]?.id)}>Ler os autos em sequência</DropdownMenuItem>
                            <DropdownMenuItem onSelect={exportar}>Exportar PDF dos autos</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            {!posse && <p className="text-sm text-slate-600 dark:text-slate-400">Você consulta este processo. Só a unidade que está com ele pode movimentá-lo.</p>}

            {p.orientacao && (
                <div role="status" className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-4 py-3 text-sm">
                    <Undo2 className="w-4 h-4 mt-0.5 text-amber-700 dark:text-amber-300 shrink-0" aria-hidden />
                    <div className="flex-1 min-w-[12rem]">
                        <p className="font-medium">Orientação de {p.orientacao.de || 'outra unidade'} ({p.orientacao.por}, {dataHora(p.orientacao.em)})</p>
                        <p className="whitespace-pre-wrap">{p.orientacao.texto}</p>
                    </div>
                    {podeMexer && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => mov('concluirOrientacao', {}, 'Orientação concluída')}>Concluída</Button>}
                </div>
            )}

            {/* Nesta fase: o que o rito espera, com caixas para marcar e os modelos indicados. */}
            <Card className="border-indigo-200 dark:border-indigo-900">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span>Nesta fase: {p.fase_nome}</span>
                        {proximas.length > 0 && <span className="text-sm font-normal text-slate-600">segue para {proximas.map((f) => f.nome).join(' ou ')}</span>}
                        {proximas.length === 0 && <span className="text-sm font-normal text-slate-600">fase final</span>}
                        {faseAtual?.prazo_dias > 0 && <span className="text-sm font-normal text-slate-600">· prazo da fase: {faseAtual.prazo_dias} dias</span>}
                    </CardTitle>
                    {(faseAtual?.unidade_id || faseAtual?.agente) && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {faseAtual.unidade_id && <>Corre em <b>{nomeUnidade(faseAtual.unidade_id)}</b></>}
                            {faseAtual.unidade_id && faseAtual.agente && ' · '}
                            {faseAtual.agente && <>quem faz: <b>{faseAtual.agente}</b></>}
                        </p>
                    )}
                </CardHeader>
                <CardContent className="space-y-3">
                    {faseAtual?.orientacao && <p className="text-sm rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 px-3 py-2">{faseAtual.orientacao}</p>}
                    {faseAtual?.acoes?.length > 0 && (
                        <ul className="space-y-1">
                            {faseAtual.acoes.map((a, i) => (
                                <li key={i}>
                                    <label className={`flex items-start gap-2 text-sm ${podeMexer ? 'cursor-pointer' : ''}`}>
                                        <input type="checkbox" className="mt-1" checked={feitas.has(i)} disabled={!podeMexer || ocupado}
                                            onChange={(e) => mov('marcarAcao', { acao_idx: i, feita: e.target.checked })} />
                                        <span className={feitas.has(i) ? 'line-through text-slate-600' : ''}>{a}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    )}
                    {modelosDaFase.length > 0 && podeMexer && (
                        <div className="flex flex-wrap gap-2">
                            {modelosDaFase.map((m) => (
                                <Button key={m.id} size="sm" variant="outline" className="gap-1" disabled={ocupado} onClick={() => usarModelo(m)}><FilePen className="w-4 h-4" /> Redigir {m.nome}</Button>
                            ))}
                        </div>
                    )}
                    {faseAtual?.condicoes && Object.keys(faseAtual.condicoes).length > 0 && (
                        <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-0.5">
                            {Object.entries(faseAtual.condicoes).map(([id, cond]) => <li key={id}>Se {cond}: segue para <b>{p.fases.find((f) => f.id === id)?.nome || id}</b></li>)}
                        </ul>
                    )}
                    {!faseAtual?.acoes?.length && !modelosDaFase.length && !faseAtual?.orientacao && (
                        <p className="text-sm text-slate-600">O rito não detalha esta fase. {podeMexer ? 'Use Novo documento para redigir e o botão acima para seguir.' : ''}</p>
                    )}
                    <details className="group text-sm">
                        <summary className="cursor-pointer text-indigo-700 dark:text-indigo-300 list-none"><span className="group-open:hidden">Ver o fluxo do rito</span><span className="hidden group-open:inline">Ocultar o fluxo</span></summary>
                        <FluxoRito fases={p.fases} atual={p.fase_atual} unidades={estado.unidades} className="mt-2" />
                    </details>
                </CardContent>
            </Card>

            <div className="grid lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3 space-y-5">
                    <Card>
                        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-base">Autos ({autos.length} documentos)</CardTitle>
                            {autos.length > 0 && <Button size="sm" variant="outline" className="gap-1" onClick={() => setLeitura(autos[0].id)}><BookOpen className="w-4 h-4" /> Ler em sequência</Button>}
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {autos.length === 0 && <p className="text-sm text-slate-600">Nenhum documento juntado ainda.{podeMexer ? ' Comece por Novo documento.' : ''}</p>}
                            {autos.map((d) => (
                                <div key={d.id} className="flex items-center gap-3 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                    <span className="font-mono text-xs w-8 text-slate-600">{d.ordem}</span>
                                    <div className="flex-1 min-w-0">
                                        <button type="button" className="font-medium truncate block max-w-full text-left hover:underline" onClick={() => setLeitura(d.id)}>{d.titulo}</button>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">{[d.tipo, folhas(d), dataHora(d.juntado_em), d.assinaturas.length ? `assinado por ${d.assinaturas.map((a) => a.nome).join(', ')}` : 'sem assinatura'].filter(Boolean).join(' · ')}</p>
                                        {d.codigo_verificacao && (
                                            <a href={`/Conferir?c=${d.codigo_verificacao}`} target="_blank" rel="noreferrer" className="text-xs font-mono text-indigo-700 dark:text-indigo-300 hover:underline" title="Abrir a conferência pública deste documento">
                                                Conferência {d.codigo_verificacao}
                                            </a>
                                        )}
                                    </div>
                                    {d.peticao && <Badge variant="secondary">Petição da parte{d.peticao_tipo ? `: ${d.peticao_tipo}` : ''}</Badge>}
                                    {!d.visivel_partes && <Badge variant="outline">Fora do portal</Badge>}
                                    <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => verNosAutos(d)} aria-label={`Ver ${d.titulo} nos autos`} title="Ver nos autos (PDF com folhas)"><Eye className="w-4 h-4" /></Button>
                                    {d.origem === 'upload' && <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => baixarOriginal(d)} aria-label={`Baixar o arquivo original de ${d.titulo}`} title="Baixar o arquivo original"><Download className="w-4 h-4" /></Button>}
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {posse && (
                        <Card>
                            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-base" title="Rascunhos da unidade: só entram nos autos quando alguém os junta">Minutas da unidade</CardTitle>
                                <Button size="sm" variant="outline" className="gap-1" disabled={!podeMexer || ocupado} onClick={() => setNovoDoc(true)}><Plus className="w-4 h-4" /> Novo documento</Button>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {minutas.length === 0 && <p className="text-sm text-slate-600">Minutas ficam visíveis só para a sua unidade até a juntada.</p>}
                                {minutas.map((d) => {
                                    const assinei = d.assinaturas.some((a) => a.uid === estado.uid);
                                    const pedidoAMim = (d.assinaturas_pedidas || []).some((x) => x.uid === estado.uid) && !assinei;
                                    const pedidos = (d.assinaturas_pedidas || []).filter((x) => !d.assinaturas.some((a) => a.uid === x.uid));
                                    return (
                                        <div key={d.id} className={`flex flex-wrap items-center gap-2 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800 ${pedidoAMim ? 'bg-amber-50 dark:bg-amber-950/40 -mx-2 px-2 rounded' : ''}`}>
                                            <Paperclip className="w-4 h-4 text-slate-400" />
                                            <div className="flex-1 min-w-[10rem]">
                                                <p className="font-medium">{d.titulo}{pedidoAMim && <Badge className="ml-2 bg-amber-500 hover:bg-amber-500">Pediram sua assinatura</Badge>}</p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                                    {d.tipo} · {d.origem === 'editor' ? 'redigido' : d.nome_arquivo} · {d.autor_nome}{d.assinaturas.length ? ` · assinado por ${d.assinaturas.map((a) => a.nome).join(', ')}` : ''}
                                                    {pedidos.length ? ` · aguarda assinatura de ${pedidos.map((x) => x.nome).join(', ')}` : ''}
                                                </p>
                                            </div>
                                            {d.origem === 'editor'
                                                ? <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => abrirMinuta(d)}>{d.assinaturas.length ? 'Ler' : 'Editar'}</Button>
                                                : <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => baixarOriginal(d)} aria-label="Baixar"><Download className="w-4 h-4" /></Button>}
                                            <Button size="sm" variant="outline" className="gap-1" disabled={assinei || ocupado || !podeMexer} onClick={() => doc('assinar', { docId: d.id }, 'Documento assinado')}><PenLine className="w-4 h-4" /> {assinei ? 'Assinado' : 'Assinar'}</Button>
                                            {membrosDaUnidade.length > 1 && <Button size="sm" variant="ghost" className="gap-1" disabled={ocupado || !podeMexer} onClick={() => setAcao({ tipo: 'pedirAssinatura', documento: d })} title="Pedir a assinatura de alguém da unidade"><UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Pedir assinatura</span></Button>}
                                            <Button size="sm" disabled={ocupado || !podeMexer} onClick={() => setAcao({ tipo: 'juntar', documento: d, assinei })} title="Incluir nos autos, com numeração e data; não pode ser desfeito">Juntar</Button>
                                            <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => doc('excluirMinuta', { docId: d.id }, 'Minuta excluída')} aria-label="Excluir minuta"><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    <Card ref={pendenciasRef} className={noGabinete && pendenciasAbertas.length ? 'border-amber-300 dark:border-amber-700' : ''}>
                        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-base">{noGabinete ? 'Para decidir' : 'Pendências e prazos'}</CardTitle>
                            {posse && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" className="gap-1" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'pendencia' })}><AlertCircle className="w-4 h-4" /> Pendência</Button>
                                    <Button size="sm" variant="outline" className="gap-1" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'prazo' })}><CalendarClock className="w-4 h-4" /> Prazo</Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            {p.fase_suspensa && <p className="text-amber-700 dark:text-amber-400 font-medium">Fase interrompida até o decisor apreciar a pendência.</p>}
                            {pendenciasAbertas.map((x) => {
                                const dias = diasDesde(x.aberta_em);
                                const docDaPend = x.documento_id ? autos.find((d) => d.id === x.documento_id) : null;
                                return (
                                    <div key={x.id} className="flex flex-wrap items-center gap-2 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                        <AlertCircle className="w-4 h-4 text-amber-600" />
                                        <div className="flex-1 min-w-[10rem]">
                                            <p>{x.descricao}</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                Aberta {dias === 0 ? 'hoje' : `há ${dias} dia${dias === 1 ? '' : 's'}`} por {x.aberta_por}{x.interrompe ? ' · interrompe a fase' : ''}
                                                {docDaPend && <> · <button type="button" className="underline" onClick={() => setLeitura(docDaPend.id)}>ver doc. nº {docDaPend.ordem}</button></>}
                                            </p>
                                        </div>
                                        {posse && noGabinete && <Button size="sm" disabled={ocupado || arquivado} onClick={() => setAcao({ tipo: 'resolver', pendencia: x })}>Apreciar</Button>}
                                    </div>
                                );
                            })}
                            {p.prazos.filter((x) => x.status === 'aberto').map((x) => {
                                const vencido = hoje > x.vence_em;
                                return (
                                    <div key={x.id} className="flex flex-wrap items-center gap-2 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                        <CalendarClock className={`w-4 h-4 ${vencido ? 'text-red-600' : 'text-indigo-600'}`} />
                                        <div className="flex-1 min-w-[10rem]">
                                            <p>{x.descricao}{x.destinatario ? ` · ${x.destinatario}` : ''}</p>
                                            <p className={`text-xs ${vencido ? 'text-red-700 dark:text-red-400 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {x.dias} dias {x.contagem === 'uteis' ? 'úteis' : 'corridos'} · {vencido ? 'venceu' : 'vence'} em {x.vence_em.split('-').reverse().join('/')}
                                            </p>
                                        </div>
                                        {posse && <Button size="sm" variant="outline" disabled={ocupado || arquivado} onClick={() => setAcao({ tipo: 'encerrarPrazo', prazo: x })}>Encerrar</Button>}
                                    </div>
                                );
                            })}
                            {pendenciasAbertas.length === 0 && !p.prazos.some((x) => x.status === 'aberto') && <p className="text-slate-600">Nenhuma pendência ou prazo aberto.</p>}
                            {noGabinete && p.pendencias.some((x) => x.status === 'resolvida') && (
                                <details className="pt-1">
                                    <summary className="cursor-pointer text-slate-600">Decisões anteriores ({p.pendencias.filter((x) => x.status === 'resolvida').length})</summary>
                                    <ul className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                        {p.pendencias.filter((x) => x.status === 'resolvida').map((x) => <li key={x.id}><b>{dataHora(x.resolvida_em)}</b> · {x.descricao}: {x.resolucao}</li>)}
                                    </ul>
                                </details>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
                            <CardTitle className="text-base">Dados do processo</CardTitle>
                            <Button size="sm" variant="outline" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'dados' })}>Editar dados</Button>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
                            <p>Rito: {p.rito_nome} · autuado em {dataHora(p.autuado_em)} por {p.autuado_por}</p>
                            {p.descricao && <p className="whitespace-pre-wrap">{p.descricao}</p>}
                            <DadosCampos campos={p.campos} className="pt-2" />
                            {p.partes.length > 0 && (
                                <div className="pt-1">
                                    <p>Partes</p>
                                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {p.partes.map((x, i) => (
                                            <li key={i} className="py-1.5 space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="flex-1 min-w-[10rem]">{x.nome} ({x.polo}){x.email ? ` · ${x.email}` : ''}</span>
                                                    {x.portal === 'ativo' && <Badge variant="secondary">Acompanha pelo portal</Badge>}
                                                    {x.portal === 'convidado' && <Badge variant="outline">Convite pendente</Badge>}
                                                    {x.portal !== 'ativo' && <Button size="sm" variant="outline" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'convidar', idx: i, parte: x })}>{x.portal ? 'Novo convite' : 'Convidar'}</Button>}
                                                    {x.portal && <Button size="sm" variant="ghost" disabled={!podeMexer || ocupado} onClick={() => mov('revogarParte', { parte_idx: i }, 'Acesso revogado')}>Revogar</Button>}
                                                    <Button size="sm" variant="ghost" className="gap-1" disabled={!podeMexer || ocupado} title={`Advogado, procurador ou preposto que fala por ${x.nome}`} onClick={() => setAcao({ tipo: 'convidar', idx: i, parte: x, novoRep: true })}><UserPlus className="w-4 h-4" /> Representante</Button>
                                                </div>
                                                {(x.representantes || []).length > 0 && (
                                                    <ul className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-1">
                                                        {x.representantes.map((r, k) => (
                                                            <li key={k} className="flex flex-wrap items-center gap-2 text-xs">
                                                                <span className="flex-1 min-w-[10rem]">{r.nome}, representante{r.email ? ` · ${r.email}` : ''}</span>
                                                                {r.portal === 'ativo' && <Badge variant="secondary">Acompanha pelo portal</Badge>}
                                                                {r.portal === 'convidado' && <Badge variant="outline">Convite pendente</Badge>}
                                                                {r.portal !== 'ativo' && <Button size="sm" variant="outline" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'convidar', idx: i, parte: x, representante: r, representante_idx: k })}>{r.portal ? 'Novo convite' : 'Convidar'}</Button>}
                                                                <Button size="sm" variant="ghost" disabled={!podeMexer || ocupado} onClick={() => mov('revogarParte', { parte_idx: i, representante_idx: k }, r.portal ? 'Acesso revogado' : 'Representante retirado')}>{r.portal ? 'Revogar' : 'Retirar'}</Button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {p.tipo_nome && <p>Tipo: {p.tipo_nome}</p>}
                            <p className="text-xs text-slate-400 pt-1">Atalhos: <kbd>N</kbd> novo documento · <kbd>T</kbd> enviar para outra unidade · <kbd>J</kbd> ir às pendências</p>
                        </CardContent>
                    </Card>
                </div>

                <Card className="lg:col-span-2 h-fit">
                    <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-base">Últimos eventos</CardTitle>
                        <Button size="sm" variant="link" className="h-auto p-0" onClick={() => eventosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ver todos ({movimentos.length})</Button>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-3">
                            {[...movimentos].reverse().slice(0, 6).map((m) => (
                                <li key={m.seq} className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-3">
                                    <p className="text-xs text-slate-600 dark:text-slate-400">#{m.seq} · {dataHora(m.em)} · {m.autor_nome} · {nomeUnidade(m.unidade_id)}</p>
                                    <p className="text-sm text-slate-800 dark:text-slate-200">{m.descricao}</p>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            </div>

            <div ref={eventosRef} className="scroll-mt-4">
                <EventosAutos movimentos={movimentos} nomeUnidade={nomeUnidade} gerarPdf={(selecao) => secExportarPdf(orgId, procId, selecao)} />
            </div>

            {acao?.tipo === 'dados' && (
                <EditarDados p={p} tipo={(estado.tipos || []).find((t) => t.id === p.tipo_id)} ocupado={ocupado} onFechar={() => setAcao(null)}
                    onSalvar={(dados) => mov('alterarDados', dados, 'Dados do processo alterados')} />
            )}

            <AcaoDialog acao={acao?.tipo === 'dados' ? null : acao} onClose={() => setAcao(null)} ocupado={ocupado} p={p} estado={estado} membros={membrosDaUnidade} mov={mov} doc={doc} convidar={convidar}
                noGabinete={noGabinete} orgId={orgId} procId={procId}
                onDespacho={(pend) => { setAcao(null); setEditor({ titulo: `Despacho: ${pend.descricao}`.slice(0, 200), tipo: 'Despacho', conteudo: null, modeloId: modelos.find((m) => /despacho/i.test(m.nome) && m.formato !== 'original')?.id }); }} />

            <NovoDocumento aberto={novoDoc} onFechar={() => setNovoDoc(false)} tipos={documentoDaUnidade(estado, p.unidade_atual).tipos_documento || []} tipoPadrao={tipoPadrao}
                modelosDaFase={modelosDaFase} modelos={modelos} onModelo={usarModelo} onEmBranco={redigirEmBranco} onArquivo={enviarArquivo} ocupado={ocupado} />

            <Dialog open={!!linkConvite} onOpenChange={(o) => !o && setLinkConvite(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Convite gerado</DialogTitle></DialogHeader>
                    <div className="space-y-2 text-sm">
                        <p>{linkConvite?.emailEnviado ? 'O convite foi enviado por e-mail. Você também pode copiar o link abaixo.' : 'Envie este link à parte pelo meio que preferir. Ele não será mostrado de novo.'}</p>
                        <Input readOnly value={linkConvite?.link || ''} onFocus={(e) => e.target.select()} aria-label="Link do convite" />
                        <p className="text-xs text-slate-600">Vale por 7 dias e só pode ser aceito por uma conta. Quem aceitar vê os documentos marcados como visíveis às partes e pode peticionar.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => navigator.clipboard?.writeText(linkConvite?.link || '').then(() => toast.success('Link copiado'))}>Copiar link</Button>
                        <Button onClick={() => setLinkConvite(null)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <RedacaoDocumento
                aberto={!!editor}
                inicial={editor}
                estado={estado}
                orgId={orgId}
                unidadeId={p.unidade_atual}
                valoresCampos={valoresCampos}
                onSalvar={async ({ docId, titulo, tipo, conteudo }) => {
                    if (docId) await secDocumento(orgId, procId, 'editarMinuta', { docId, titulo, tipo, conteudo });
                    const r = docId ? { id: docId } : await secDocumento(orgId, procId, 'criarMinuta', { titulo, tipo, conteudo });
                    atualizar();
                    return r.id;
                }}
                onPdf={(docId) => secDocumento(orgId, procId, 'pdf', { docId })}
                onFechar={() => setEditor(null)}
            />
            <VisualizadorPdf pdf={pdf} onFechar={() => setPdf(null)} />
            <LeitorAutos documentos={autos} abertoId={leitura} onFechar={() => setLeitura(null)} titulo={`Processo ${p.numero}`} chaveLido={`autos-lidos-${procId}`}
                carregar={(d) => secDocumento(orgId, procId, 'pdf', { docId: d.id })} />
        </div>
    );
}

/** Um só ponto de partida para redigir ou enviar: modelos da fase primeiro, depois os demais. */
function NovoDocumento({ aberto, onFechar, tipos, tipoPadrao, modelosDaFase, modelos, onModelo, onEmBranco, onArquivo, ocupado }) {
    const [tipo, setTipo] = useState('');
    const outros = modelos.filter((m) => !modelosDaFase.some((x) => x.id === m.id));
    const lista = [...new Set([...tipos, tipoPadrao].filter(Boolean))];
    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Novo documento</DialogTitle>
                    <DialogDescription>Nasce como minuta da sua unidade. Depois você assina e junta aos autos.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    {modelosDaFase.length > 0 && (
                        <div>
                            <p className="text-sm font-medium mb-1">Indicados para esta fase</p>
                            <div className="grid gap-2">
                                {modelosDaFase.map((m) => (
                                    <button key={m.id} type="button" disabled={ocupado} onClick={() => onModelo(m)} className="text-left rounded-md border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950 px-3 py-2 text-sm hover:border-indigo-500">
                                        <span className="font-medium">{m.nome}</span>{m.tipo_documento && <span className="text-slate-600"> · {m.tipo_documento}</span>}{m.formato === 'original' && <span className="text-xs text-slate-600"> · arquivo {m.arquivo_nome}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {outros.length > 0 && (
                        <NativeSelect id="novo-modelo" label={modelosDaFase.length ? 'Outros modelos' : 'Começar de um modelo'} value="" onChange={(id) => { const m = outros.find((x) => x.id === id); if (m) onModelo(m); }}
                            options={[['', 'Escolha…'], ...outros.map((m) => [m.id, `${m.nome}${m.tipo_documento ? ` (${m.tipo_documento})` : ''}${m.unidade_id ? '' : ' · do órgão'}`])]} />
                    )}
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[10rem]">
                            <NativeSelect id="novo-tipo" label="Em branco, do tipo" value={tipo || tipoPadrao} onChange={setTipo} options={lista.map((t) => [t, t])} />
                        </div>
                        <Button className="gap-1" disabled={ocupado} onClick={() => onEmBranco(tipo || tipoPadrao)}><FilePen className="w-4 h-4" /> Redigir</Button>
                    </div>
                    <div>
                        <Label htmlFor="novo-arquivo">Ou enviar um arquivo (PDF, Word, Excel, imagem ou texto, até {MAX_MB} MB)</Label>
                        <Input id="novo-arquivo" type="file" disabled={ocupado} accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx,.odt,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onArquivo(f); }} />
                        <Label htmlFor="novo-foto" className="mt-2 inline-flex items-center gap-1 text-sm font-normal text-indigo-700 dark:text-indigo-300 cursor-pointer sm:hidden"><Camera className="w-4 h-4" aria-hidden /> Fotografar um documento</Label>
                        <input id="novo-foto" type="file" accept="image/*" capture="environment" className="sr-only" disabled={ocupado} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onArquivo(f); }} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function AcaoDialog({ acao, onClose, ocupado, p, estado, membros, mov, doc, convidar, noGabinete, orgId, procId, onDespacho }) {
    const [valor, setValor] = useState('');
    const [visivel, setVisivel] = useState('sim');
    const [motivo, setMotivo] = useState('');
    const [dias, setDias] = useState('15');
    const [contagem, setContagem] = useState('uteis');
    const [destinatario, setDestinatario] = useState('');
    const [assinar, setAssinar] = useState(true);
    const [resolve, setResolve] = useState('');
    const [pdfPend, setPdfPend] = useState(null); // {url} do documento da pendência em apreciação
    const tipo = acao?.tipo;
    const reset = () => { setValor(''); setMotivo(''); setDestinatario(''); setVisivel('sim'); setAssinar(true); setResolve(''); onClose(); };
    const pendenciasAbertas = p.pendencias.filter((x) => x.status === 'aberta');

    // Apreciar: o documento que gerou a pendência (petição) aparece ao lado da decisão.
    useEffect(() => {
        const docId = tipo === 'resolver' ? acao?.pendencia?.documento_id : null;
        if (!docId) { setPdfPend(null); return undefined; }
        let url = null; let vivo = true;
        secDocumento(orgId, procId, 'pdf', { docId }).then((r) => { if (!vivo) return; url = base64ParaUrl(r.base64, 'application/pdf'); setPdfPend({ url }); }).catch(() => vivo && setPdfPend({ erro: true }));
        return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
    }, [tipo, acao?.pendencia?.documento_id, orgId, procId]);

    let titulo = '';
    let campo = null;
    let enviar = () => {};
    let rotuloTexto = 'Observação';
    let exigeTexto = false;
    let exigeValor = tipo === 'tramitar' || tipo === 'situacao';
    let largo = false;
    let rodape = null;
    if (tipo === 'pendencia') {
        titulo = 'Abrir pendência para o decisor';
        rotuloTexto = 'O que precisa ser apreciado';
        exigeTexto = true;
        campo = <NativeSelect label="Efeito na fase" value={valor} onChange={setValor} options={[['', 'Só registrar, a fase segue'], ['sim', 'Interromper a fase até a apreciação']]} />;
        enviar = () => mov('abrirPendencia', { descricao: motivo, interrompe: valor === 'sim' }, 'Pendência aberta');
    } else if (tipo === 'resolver') {
        titulo = 'Apreciar pendência';
        rotuloTexto = 'Decisão (nota curta, vira movimento)';
        exigeTexto = true;
        largo = !!acao.pendencia.documento_id;
        campo = (
            <div className="space-y-2">
                <p className="text-sm text-slate-700 dark:text-slate-300"><b>{acao.pendencia.descricao}</b> · aberta por {acao.pendencia.aberta_por} em {dataHora(acao.pendencia.aberta_em)}{acao.pendencia.interrompe ? ' · a fase está interrompida' : ''}</p>
                {acao.pendencia.documento_id && (
                    <div className="h-[50vh] rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        {pdfPend?.url ? <iframe title="Documento da pendência" src={pdfPend.url} className="w-full h-full rounded-md" />
                            : pdfPend?.erro ? <p className="text-sm text-slate-600">Não foi possível abrir o documento.</p>
                                : <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo o documento…</p>}
                    </div>
                )}
            </div>
        );
        enviar = () => mov('resolverPendencia', { pendencia_id: acao.pendencia.id, resolucao: motivo }, 'Pendência apreciada');
        rodape = <Button variant="outline" className="gap-1 mr-auto" disabled={ocupado} onClick={() => onDespacho(acao.pendencia)}><FilePen className="w-4 h-4" /> Decidir por despacho</Button>;
    } else if (tipo === 'prazo') {
        titulo = 'Abrir prazo';
        rotuloTexto = 'Para quê (ex.: manifestação sobre o laudo)';
        exigeTexto = true;
        campo = (
            <div className="grid grid-cols-3 gap-3">
                <div><Label htmlFor="prazo-dias">Dias</Label><Input id="prazo-dias" type="number" min={1} value={dias} onChange={(e) => setDias(e.target.value)} /></div>
                <NativeSelect label="Contagem" value={contagem} onChange={setContagem} options={[['uteis', 'Dias úteis'], ['corridos', 'Dias corridos']]} />
                <div><Label htmlFor="prazo-dest">Destinatário</Label><Input id="prazo-dest" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="Opcional" /></div>
            </div>
        );
        enviar = () => mov('abrirPrazo', { descricao: motivo, dias: Number(dias), contagem, destinatario }, 'Prazo aberto');
    } else if (tipo === 'encerrarPrazo') {
        titulo = 'Encerrar prazo';
        exigeValor = true;
        campo = (
            <>
                <p className="text-sm text-slate-700 dark:text-slate-300">{acao.prazo.descricao} · vence {acao.prazo.vence_em.split('-').reverse().join('/')}</p>
                <NativeSelect label="Resultado" value={valor} onChange={setValor} options={[['', 'Escolha…'], ['cumprido', 'Cumprido'], ['cancelado', 'Cancelado']]} />
            </>
        );
        enviar = () => mov('encerrarPrazo', { prazo_id: acao.prazo.id, resultado: valor, motivo }, 'Prazo encerrado');
    } else if (tipo === 'juntar') {
        titulo = `Juntar aos autos: ${acao.documento.titulo}`;
        const decideAlguma = noGabinete && pendenciasAbertas.length > 0;
        campo = (
            <>
                {!acao.assinei && (
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={assinar} onChange={(e) => setAssinar(e.target.checked)} /> Assinar antes de juntar (assinatura eletrônica simples, com seu nome)</label>
                )}
                {decideAlguma && (
                    <NativeSelect label="Este documento decide uma pendência?" value={resolve} onChange={setResolve}
                        options={[['', 'Não'], ...pendenciasAbertas.map((x) => [x.id, x.descricao.slice(0, 80)])]} />
                )}
                {!resolve && <NativeSelect label="Pendência para o decisor" value={valor} onChange={setValor} options={[['', 'Não abrir'], ['sim', 'Abrir pendência, a fase segue'], ['interrompe', 'Abrir pendência e interromper a fase']]} />}
                <NativeSelect label="Portal das partes" value={visivel} onChange={setVisivel} options={[['sim', 'Visível às partes'], ['nao', 'Só para a equipe']]} />
            </>
        );
        enviar = () => doc('juntar', {
            docId: acao.documento.id, version: p.version, pendencia: resolve ? 'nao' : (valor || 'nao'), visivel_partes: visivel === 'sim',
            assinar: !acao.assinei && assinar, ...(resolve ? { resolve_pendencia_id: resolve } : {}),
        }, resolve ? 'Documento juntado e pendência decidida' : 'Documento juntado aos autos');
    } else if (tipo === 'pedirAssinatura') {
        titulo = `Pedir assinatura: ${acao.documento.titulo}`;
        exigeValor = true;
        const jaAssinaram = acao.documento.assinaturas.map((a) => a.uid);
        campo = <NativeSelect label="Quem assina" value={valor} onChange={setValor} options={[['', 'Escolha…'], ...membros.filter((m) => m.uid !== estado.uid && !jaAssinaram.includes(m.uid)).map((m) => [m.uid, m.nome])]} />;
        enviar = () => doc('pedirAssinatura', { docId: acao.documento.id, uid: valor }, 'Pedido de assinatura enviado');
    } else if (tipo === 'convidar') {
        // Alvo: a parte, um representante já listado ou um representante novo (nome obrigatório).
        const alvo = acao.representante || (acao.novoRep ? null : acao.parte);
        titulo = acao.novoRep ? `Convidar um representante de ${acao.parte.nome}` : `Convidar ${alvo.nome} para o portal das partes`;
        exigeValor = !!acao.novoRep;
        campo = (
            <div className="space-y-3">
                {acao.novoRep && (
                    <div>
                        <Label htmlFor="conv-nome">Nome do representante</Label>
                        <Input id="conv-nome" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Advogado, procurador, preposto…" autoFocus />
                    </div>
                )}
                {(acao.novoRep || acao.representante) && <p className="text-xs text-slate-600 dark:text-slate-400">O representante tem a própria conta e vê o processo como {acao.parte.nome}; o que ele protocolar sai em nome da parte, assinado por ele.</p>}
                <div>
                    <Label htmlFor="conv-email">E-mail para envio do convite</Label>
                    <Input id="conv-email" type="email" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder={alvo?.email || 'Opcional: sem e-mail, você copia o link'} />
                </div>
            </div>
        );
        enviar = () => convidar(acao.idx, destinatario.trim() || alvo?.email || '',
            acao.novoRep ? { representante: { nome: valor.trim(), email: destinatario.trim() } } : acao.representante ? { representante_idx: acao.representante_idx } : {});
    }
    if (tipo === 'tramitar' || tipo === 'devolver') {
        const devolver = tipo === 'devolver';
        titulo = devolver ? 'Devolver à secretaria com orientação' : acao.fase_id ? 'Concluir a fase e enviar para outra unidade' : 'Enviar para outra unidade';
        const opcoes = estado.unidades.filter((u) => u.ativa && u.id !== p.unidade_atual);
        const passou = p.unidades_historico || [];
        // Devolver: a unidade que remeteu ao gabinete, ou a primeira secretaria.
        const origem = devolver ? ([...passou].reverse().find((id) => id !== p.unidade_atual && estado.unidades.find((u) => u.id === id)?.tipo !== 'gabinete') || opcoes.find((u) => u.tipo === 'secretaria')?.id || '') : '';
        const destino = valor || acao.destino || origem || '';
        const uDest = estado.unidades.find((u) => u.id === destino);
        const recebem = uDest ? estado.membros.filter((m) => uDest.membros_uids.includes(m.uid)) : [];
        const faseNova = acao.fase_id ? p.fases.find((f) => f.id === acao.fase_id) : null;
        const rot = (u) => `${u.nome} (${rotuloUnidade(u.tipo).toLowerCase()})${u.id === acao.destino ? ' · indicada pelo rito' : passou.includes(u.id) ? ' · já passou por aqui' : ''}`;
        campo = (
            <div className="space-y-2">
                {faseNova && <p className="text-sm text-slate-700 dark:text-slate-300">A fase passa de <b>{p.fase_nome}</b> para <b>{faseNova.nome}</b> no mesmo ato.</p>}
                <NativeSelect label="Destino" value={destino} onChange={setValor} options={[['', 'Escolha…'], ...opcoes.map((u) => [u.id, rot(u)])]} />
                {uDest && (
                    <p className="text-xs text-slate-600">
                        {recebem.length ? `Quem recebe: ${recebem.map((m) => m.nome).join(', ')}. Serão avisados por e-mail.` : 'Atenção: ninguém está lotado nessa unidade.'}
                    </p>
                )}
            </div>
        );
        exigeValor = !destino;
        if (devolver) { exigeTexto = true; rotuloTexto = 'Orientação para a secretaria (fica em destaque no processo até ser concluída)'; }
        enviar = () => mov('tramitar', { unidade_destino: destino, ...(devolver ? { orientacao: motivo } : { motivo }), ...(acao.fase_id ? { fase_id: acao.fase_id } : {}) }, devolver ? 'Processo devolvido com orientação' : 'Processo remetido');
    } else if (tipo === 'fase') {
        titulo = 'Mudar a fase';
        const noFluxo = seguintes(p.fases, p.fases.findIndex((f) => f.id === p.fase_atual));
        const escolhida = valor || acao.fase_id || noFluxo[0] || '';
        const fora = !!escolhida && !noFluxo.includes(escolhida);
        const nomeFase = (id) => p.fases.find((f) => f.id === id)?.nome;
        const condicoes = p.fases.find((f) => f.id === p.fase_atual)?.condicoes || {};
        campo = (
            <div className="space-y-3">
                {noFluxo.length > 0 ? (
                    <fieldset>
                        <legend className="text-sm font-medium mb-2">Seguir o fluxo do rito</legend>
                        <div className="grid gap-2">
                            {noFluxo.map((id) => (
                                <button key={id} type="button" onClick={() => setValor(id)} aria-pressed={escolhida === id}
                                    className={`text-left rounded-md border px-3 py-2 text-sm ${escolhida === id ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-400' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>
                                    <span className="font-medium">{nomeFase(id)}</span>
                                    {condicoes[id] && <span className="block text-xs text-indigo-700 dark:text-indigo-300">Se {condicoes[id]}</span>}
                                    {p.fases.find((f) => f.id === id)?.orientacao && <span className="block text-xs text-slate-600">{p.fases.find((f) => f.id === id).orientacao}</span>}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                ) : <p className="text-sm text-slate-600 dark:text-slate-300">Esta é a fase final do rito.</p>}
                <NativeSelect id="fase-fora" label="Ou ir para outra fase (fora do caminho previsto no rito, exige motivo)" value={fora ? escolhida : ''} onChange={(v) => setValor(v || '')}
                    options={[['', '—'], ...p.fases.filter((f) => f.id !== p.fase_atual && !noFluxo.includes(f.id)).map((f) => [f.id, f.nome])]} />
            </div>
        );
        if (fora) { exigeTexto = true; rotuloTexto = 'Motivo para sair do caminho previsto'; }
        exigeValor = !escolhida;
        enviar = () => mov('avancarFase', { fase_id: escolhida, motivo }, 'Fase alterada');
    } else if (tipo === 'atribuir') {
        titulo = 'Atribuir a uma pessoa da unidade';
        campo = <NativeSelect label="Responsável" value={valor} onChange={setValor} options={[['', 'Ninguém'], ...membros.map((m) => [m.uid, m.nome])]} />;
        enviar = () => mov('atribuir', { responsavel_uid: valor || null }, 'Atribuição registrada');
    } else if (tipo === 'situacao') {
        titulo = 'Alterar a situação';
        const status = valor || acao.status || '';
        campo = <NativeSelect label="Situação" value={status} onChange={setValor} options={[['', 'Escolha…'], ...Object.entries(STATUS_ROTULO).filter(([k]) => k !== p.status)]} />;
        exigeValor = !status;
        enviar = () => mov('alterarStatus', { status, motivo }, 'Situação alterada');
    }
    else if (tipo === 'urgencia') {
        titulo = p.urgente ? 'Retirar a urgência' : 'Marcar como urgente';
        campo = <p className="text-sm text-slate-600 dark:text-slate-300">{p.urgente
            ? `Urgente desde ${dataHora(p.urgencia?.em)}, por ${p.urgencia?.por || 'alguém da equipe'}: ${p.urgencia?.motivo || ''}`
            : 'O processo passa a aparecer primeiro nas listas, com selo vermelho, e os avisos saem marcados como urgentes.'}</p>;
        exigeValor = false;
        enviar = () => mov('urgencia', { urgente: !p.urgente, motivo }, p.urgente ? 'Urgência retirada' : 'Processo marcado como urgente');
    }
    if (tipo === 'situacao' || tipo === 'urgencia') { exigeTexto = true; rotuloTexto = 'Motivo'; }
    const semTexto = tipo === 'atribuir' || tipo === 'juntar' || tipo === 'convidar' || tipo === 'pedirAssinatura';

    return (
        <Dialog open={!!acao} onOpenChange={(o) => !o && reset()}>
            <DialogContent className={largo ? 'max-w-4xl max-h-[92vh] overflow-y-auto' : undefined}>
                <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                    {campo}
                    {!semTexto && (
                        <div><Label htmlFor="acao-motivo">{rotuloTexto}{exigeTexto ? ' (obrigatório)' : ''}</Label><Textarea id="acao-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
                    )}
                    <p className="text-xs text-slate-600">Fica registrado na linha do tempo com seu nome, data e hora.</p>
                </div>
                <DialogFooter className="flex-row flex-wrap gap-2">
                    {rodape}
                    <Button variant="outline" onClick={reset}>Cancelar</Button>
                    <Button disabled={ocupado || (exigeValor && !valor && !acao?.destino && !acao?.fase_id && !acao?.status && tipo !== 'devolver') || (exigeTexto && !motivo.trim())} onClick={async () => { await enviar(); setValor(''); setMotivo(''); setDestinatario(''); setVisivel('sim'); setResolve(''); }}>
                        {ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} {tipo === 'resolver' ? 'Registrar a decisão' : 'Confirmar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Corrige a descrição e os campos próprios do tipo; o que mudou vai para o histórico. */
function EditarDados({ p, tipo, ocupado, onFechar, onSalvar }) {
    const form = formularioDe(tipo);
    const [descricao, setDescricao] = useState(p.descricao || '');
    const [campos, setCampos] = useState(() => valoresDe(p.campos));
    const [motivo, setMotivo] = useState('');
    const falta = faltando({ ...form, partes: 'opcional' }, { descricao, campos });
    // Campos que o tipo deixou de ter continuam gravados, só para leitura.
    const antigos = (p.campos || []).filter((c) => !form.campos.some((d) => d.id === c.id));
    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Editar dados do processo</DialogTitle>
                    <DialogDescription>A alteração fica registrada no histórico do processo, com o que mudou.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    {form.descricao !== 'oculto' && (
                        <div>
                            <Label htmlFor="ed-desc">Descrição{form.descricao === 'obrigatorio' && <span className="text-red-600 dark:text-red-400" aria-hidden> *</span>}</Label>
                            <Textarea id="ed-desc" className="mt-1" rows={3} maxLength={4000} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                        </div>
                    )}
                    <CamposProcesso prefixo="ed" campos={form.campos} valores={campos} onChange={(id, v) => setCampos((x) => ({ ...x, [id]: v }))} />
                    {antigos.length > 0 && (
                        <div className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-3">
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Campos que este tipo de processo não usa mais (mantidos como foram gravados)</p>
                            <DadosCampos campos={antigos} />
                        </div>
                    )}
                    <div><Label htmlFor="ed-motivo">Motivo da alteração</Label><Input id="ed-motivo" className="mt-1" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Opcional" /></div>
                    {falta.length > 0 && <p className="text-sm text-amber-800 dark:text-amber-300" role="status">Para salvar: {falta.join('; ')}.</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onFechar}>Cancelar</Button>
                    <Button disabled={ocupado || falta.length > 0} onClick={() => onSalvar({ descricao, campos, motivo })}>
                        {ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
