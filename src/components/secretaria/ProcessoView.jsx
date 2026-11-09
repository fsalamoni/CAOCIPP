import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    AlertCircle, ArrowLeft, CalendarClock, Download, Eye, FilePen, FileUp, FileDown, Loader2, PenLine, Send, ShieldCheck, ShieldAlert, Paperclip, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { secConfig, secDocumento, secExportarPdf, secProcesso, baixarBase64, arquivoParaBase64 } from '@/services/secretariaService';
import { NativeSelect, STATUS_ROTULO, dataHora, documentoDaUnidade, modelosDaUnidade, rotuloUnidade } from './comum';
import FluxoRito from './FluxoRito';
import { seguintes } from '@/lib/secretariaRito';
import RedacaoDocumento, { VisualizadorPdf } from './RedacaoDocumento';

const MAX_MB = 5;
const folhas = (d) => (d.folha_inicial ? (d.folha_final > d.folha_inicial ? `fls. ${d.folha_inicial}–${d.folha_final}` : `fl. ${d.folha_inicial}`) : null);

export default function ProcessoView({ orgId, procId, estado, onVoltar }) {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['sec-proc', orgId, procId], queryFn: () => secProcesso(orgId, 'obter', { id: procId }) });
    const [acao, setAcao] = useState(null); // {tipo, ...}
    const [ocupado, setOcupado] = useState(false);
    const [linkConvite, setLinkConvite] = useState(null); // {link, emailEnviado}
    const [editor, setEditor] = useState(null); // {docId?, titulo, tipo, conteudo, somenteLeitura}
    const [pdf, setPdf] = useState(null); // {base64, nome, titulo}

    if (q.isLoading) return <div className="py-8 flex gap-2 items-center text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando processo…</div>;
    if (q.error) return <div className="py-8 text-red-600">{q.error.message} <Button variant="link" onClick={onVoltar}>Voltar</Button></div>;

    const { processo: p, movimentos, documentos, cadeiaQuebradaEm, posse, hoje } = q.data;
    const noGabinete = estado.unidades.find((u) => u.id === p.unidade_atual)?.tipo === 'gabinete';
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
    const convidar = (parte_idx, email) => executar(async () => {
        const r = await secProcesso(orgId, 'convidarParte', { id: procId, version: p.version, parte_idx, email });
        setLinkConvite(r);
    }, 'Convite gerado');
    const arquivado = p.status === 'arquivado';
    const podeMexer = posse && !arquivado;
    const membrosDaUnidade = estado.membros.filter((m) => estado.unidades.find((u) => u.id === p.unidade_atual)?.membros_uids.includes(m.uid));

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

    const enviarArquivo = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Arquivo acima de ${MAX_MB} MB`); return; }
        await executar(async () => {
            const base64 = await arquivoParaBase64(file);
            await secDocumento(orgId, procId, 'upload', { titulo: file.name.replace(/\.[^.]+$/, ''), tipo: 'Documento', nomeArquivo: file.name, mime: file.type, base64 });
        }, 'Arquivo enviado como minuta');
    };

    // Modelo guardado em Word/PDF: o Word sai com os campos preenchidos e vira minuta.
    const modelosArquivo = modelosDaUnidade(estado, p.unidade_atual).filter((m) => m.formato === 'original');
    const usarModeloArquivo = (id) => {
        const m = modelosArquivo.find((x) => x.id === id);
        if (!m) return;
        executar(async () => {
            const r = await secConfig(orgId, 'baixarModelo', { id: m.id, valores: valoresCampos });
            await secDocumento(orgId, procId, 'upload', { titulo: m.nome, tipo: m.tipo_documento || 'Documento', nomeArquivo: r.nome, mime: r.mime, base64: r.base64 });
        }, /\.pdf$/i.test(m.arquivo_nome) ? 'Minuta criada com o PDF do modelo' : 'Minuta criada com o Word do modelo, campos preenchidos');
    };

    const minutas = documentos.filter((d) => d.status === 'minuta');
    const autos = documentos.filter((d) => d.status === 'juntado');
    const iAtual = p.fases.findIndex((f) => f.id === p.fase_atual);
    const faseAtual = p.fases[iAtual];
    const proximasNomes = seguintes(p.fases, iAtual).map((id) => p.fases.find((f) => f.id === id)?.nome).join(' ou ');
    // O rito pode dizer em que unidade a fase corre: sugere remeter para lá.
    const unidadeDaFase = faseAtual?.unidade_id && faseAtual.unidade_id !== p.unidade_atual
        ? estado.unidades.find((u) => u.id === faseAtual.unidade_id && u.ativa) : null;
    const modelosSugeridos = (faseAtual?.modelos || []).map((id) => (estado.modelos || []).find((m) => m.id === id)).filter(Boolean);
    const temDetalhes = !!(faseAtual?.orientacao || faseAtual?.acoes?.length || faseAtual?.agente || faseAtual?.unidade_id || modelosSugeridos.length);

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                    <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={onVoltar}><ArrowLeft className="w-4 h-4" /> Processos</Button>
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-white"><span className="font-mono">{p.numero}</span> · {p.assunto}</h2>
                    <div className="flex flex-wrap gap-2 text-sm">
                        <Badge>{p.fase_nome}</Badge>
                        <Badge variant="secondary">{STATUS_ROTULO[p.status]}</Badge>
                        <Badge variant="outline">Com: {nomeUnidade(p.unidade_atual)}</Badge>
                        {p.responsavel_uid && <Badge variant="outline">Responsável: {estado.membros.find((m) => m.uid === p.responsavel_uid)?.nome || '—'}</Badge>}
                        {p.sigilo === 'restrito' && <Badge variant="outline">Restrito</Badge>}
                        {cadeiaQuebradaEm === null
                            ? <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><ShieldCheck className="w-4 h-4" /> Integridade conferida</span>
                            : <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400"><ShieldAlert className="w-4 h-4" /> Cadeia quebrada no movimento {cadeiaQuebradaEm}</span>}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-2" onClick={exportar} disabled={ocupado}><FileDown className="w-4 h-4" /> Exportar PDF</Button>
                    {posse && (
                        <>
                            <Button variant="outline" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'tramitar' })} className="gap-2"><Send className="w-4 h-4" /> Tramitar</Button>
                            <Button variant="outline" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'fase' })}>Mudar fase</Button>
                            <Button variant="outline" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'atribuir' })}>Atribuir</Button>
                            <Button variant="outline" disabled={ocupado} onClick={() => setAcao({ tipo: 'situacao' })}>Situação</Button>
                        </>
                    )}
                </div>
            </div>
            {!posse && <p className="text-sm text-slate-500 dark:text-slate-400">Você consulta este processo. Só a unidade que está com ele pode movimentá-lo.</p>}

            {posse && podeMexer && unidadeDaFase && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-4 py-3 text-sm">
                    <span className="flex-1 min-w-0">Pelo rito, a fase <b>{p.fase_nome}</b> corre em <b>{unidadeDaFase.nome}</b>.</span>
                    <Button size="sm" variant="outline" className="gap-2" disabled={ocupado} onClick={() => setAcao({ tipo: 'tramitar', destino: unidadeDaFase.id })}><Send className="w-4 h-4" /> Tramitar para lá</Button>
                </div>
            )}

            <details className="group rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" open={temDetalhes}>
                <summary className="cursor-pointer list-none px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-sm text-slate-500">Fase atual</span>
                    <span className="font-medium">{p.fase_nome}</span>
                    {proximasNomes && <span className="text-sm text-slate-500">· segue para {proximasNomes}</span>}
                    <span className="ml-auto text-xs text-indigo-700 dark:text-indigo-300 group-open:hidden">Ver fluxo</span>
                    <span className="ml-auto text-xs text-indigo-700 dark:text-indigo-300 hidden group-open:inline">Ocultar fluxo</span>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                    {(faseAtual?.unidade_id || faseAtual?.agente) && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {faseAtual.unidade_id && <>Unidade: <b>{nomeUnidade(faseAtual.unidade_id)}</b></>}
                            {faseAtual.unidade_id && faseAtual.agente && ' · '}
                            {faseAtual.agente && <>Quem faz: <b>{faseAtual.agente}</b></>}
                        </p>
                    )}
                    {faseAtual?.orientacao && <p className="text-sm rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 px-3 py-2"><b>Orientação:</b> {faseAtual.orientacao}</p>}
                    {faseAtual?.acoes?.length > 0 && (
                        <div className="text-sm">
                            <p className="font-medium mb-1">O que fazer nesta fase</p>
                            <ul className="list-disc pl-5 space-y-0.5 text-slate-700 dark:text-slate-300">{faseAtual.acoes.map((a, i) => <li key={i}>{a}</li>)}</ul>
                        </div>
                    )}
                    {modelosSugeridos.length > 0 && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">Modelos indicados: {modelosSugeridos.map((m) => m.nome).join(', ')}</p>
                    )}
                    {faseAtual?.condicoes && Object.keys(faseAtual.condicoes).length > 0 && (
                        <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-0.5">
                            {Object.entries(faseAtual.condicoes).map(([id, cond]) => <li key={id}>Se {cond}: segue para <b>{p.fases.find((f) => f.id === id)?.nome || id}</b></li>)}
                        </ul>
                    )}
                    <FluxoRito fases={p.fases} atual={p.fase_atual} />
                </div>
            </details>

            <div className="grid lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3 space-y-5">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">Autos ({autos.length} documentos)</CardTitle></CardHeader>
                        <CardContent className="space-y-2">
                            {autos.length === 0 && <p className="text-sm text-slate-500">Nenhum documento juntado ainda.</p>}
                            {autos.map((d) => (
                                <div key={d.id} className="flex items-center gap-3 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                    <span className="font-mono text-xs w-8 text-slate-500">{d.ordem}</span>
                                    <div className="flex-1 min-w-0">
                                        <button type="button" className="font-medium truncate block max-w-full text-left hover:underline" onClick={() => verNosAutos(d)}>{d.titulo}</button>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{[d.tipo, folhas(d), dataHora(d.juntado_em), d.assinaturas.length ? `assinado por ${d.assinaturas.map((a) => a.nome).join(', ')}` : 'sem assinatura'].filter(Boolean).join(' · ')}</p>
                                        {d.codigo_verificacao && (
                                            <a href={`/Conferir?c=${d.codigo_verificacao}`} target="_blank" rel="noreferrer" className="text-xs font-mono text-indigo-700 dark:text-indigo-300 hover:underline" title="Abrir a conferência pública deste documento">
                                                Conferência {d.codigo_verificacao}
                                            </a>
                                        )}
                                    </div>
                                    {d.peticao && <Badge variant="secondary">Petição da parte</Badge>}
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
                                <CardTitle className="text-base">Minutas da unidade</CardTitle>
                                <div className="flex flex-wrap justify-end gap-2">
                                    {modelosArquivo.length > 0 && (
                                        <select aria-label="Criar minuta de um modelo em arquivo" value="" disabled={!podeMexer || ocupado} onChange={(e) => usarModeloArquivo(e.target.value)}
                                            className="h-8 rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm max-w-[12rem]">
                                            <option value="">Modelo em arquivo…</option>
                                            {modelosArquivo.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                                        </select>
                                    )}
                                    <Button size="sm" variant="outline" className="gap-1" disabled={!podeMexer} onClick={() => setEditor({ titulo: '', tipo: documentoDaUnidade(estado, p.unidade_atual).tipos_documento?.[0] || 'Despacho', conteudo: null })}><FilePen className="w-4 h-4" /> Redigir</Button>
                                    <Button size="sm" variant="outline" className="gap-1" disabled={!podeMexer || ocupado} asChild={podeMexer}>
                                        {podeMexer ? (
                                            <label className="cursor-pointer"><FileUp className="w-4 h-4" /> Enviar arquivo
                                                <input type="file" className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx,.odt,.xlsx" onChange={enviarArquivo} />
                                            </label>
                                        ) : <span><FileUp className="w-4 h-4" /> Enviar arquivo</span>}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {minutas.length === 0 && <p className="text-sm text-slate-500">Minutas ficam visíveis só para a sua unidade até a juntada.</p>}
                                {minutas.map((d) => {
                                    const assinei = d.assinaturas.some((a) => a.uid === estado.uid);
                                    return (
                                        <div key={d.id} className="flex flex-wrap items-center gap-2 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                            <Paperclip className="w-4 h-4 text-slate-400" />
                                            <div className="flex-1 min-w-[10rem]">
                                                <p className="font-medium">{d.titulo}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{d.tipo} · {d.origem === 'editor' ? 'redigido' : d.nome_arquivo} · {d.autor_nome}{d.assinaturas.length ? ` · assinado por ${d.assinaturas.map((a) => a.nome).join(', ')}` : ''}</p>
                                            </div>
                                            {d.origem === 'editor'
                                                ? <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => abrirMinuta(d)}>{d.assinaturas.length ? 'Ler' : 'Editar'}</Button>
                                                : <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => baixarOriginal(d)} aria-label="Baixar"><Download className="w-4 h-4" /></Button>}
                                            <Button size="sm" variant="outline" className="gap-1" disabled={assinei || ocupado || !podeMexer} onClick={() => doc('assinar', { docId: d.id }, 'Documento assinado')}><PenLine className="w-4 h-4" /> {assinei ? 'Assinado' : 'Assinar'}</Button>
                                            <Button size="sm" disabled={ocupado || !podeMexer} onClick={() => setAcao({ tipo: 'juntar', documento: d })}>Juntar</Button>
                                            <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => doc('excluirMinuta', { docId: d.id }, 'Minuta excluída')} aria-label="Excluir minuta"><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-base">Pendências e prazos</CardTitle>
                            {posse && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" className="gap-1" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'pendencia' })}><AlertCircle className="w-4 h-4" /> Pendência</Button>
                                    <Button size="sm" variant="outline" className="gap-1" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'prazo' })}><CalendarClock className="w-4 h-4" /> Prazo</Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            {p.fase_suspensa && <p className="text-amber-700 dark:text-amber-400 font-medium">Fase interrompida até o decisor apreciar a pendência.</p>}
                            {p.pendencias.filter((x) => x.status === 'aberta').map((x) => (
                                <div key={x.id} className="flex flex-wrap items-center gap-2 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                    <AlertCircle className="w-4 h-4 text-amber-600" />
                                    <div className="flex-1 min-w-[10rem]">
                                        <p>{x.descricao}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Aberta em {dataHora(x.aberta_em)} por {x.aberta_por}{x.interrompe ? ' · interrompe a fase' : ''}</p>
                                    </div>
                                    {posse && noGabinete && <Button size="sm" disabled={ocupado || arquivado} onClick={() => setAcao({ tipo: 'resolver', pendencia: x })}>Apreciar</Button>}
                                </div>
                            ))}
                            {p.prazos.filter((x) => x.status === 'aberto').map((x) => {
                                const vencido = hoje > x.vence_em;
                                return (
                                    <div key={x.id} className="flex flex-wrap items-center gap-2 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                        <CalendarClock className={`w-4 h-4 ${vencido ? 'text-red-600' : 'text-indigo-600'}`} />
                                        <div className="flex-1 min-w-[10rem]">
                                            <p>{x.descricao}{x.destinatario ? ` · ${x.destinatario}` : ''}</p>
                                            <p className={`text-xs ${vencido ? 'text-red-700 dark:text-red-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                                                {x.dias} dias {x.contagem === 'uteis' ? 'úteis' : 'corridos'} · {vencido ? 'venceu' : 'vence'} em {x.vence_em.split('-').reverse().join('/')}
                                            </p>
                                        </div>
                                        {posse && <Button size="sm" variant="outline" disabled={ocupado || arquivado} onClick={() => setAcao({ tipo: 'encerrarPrazo', prazo: x })}>Encerrar</Button>}
                                    </div>
                                );
                            })}
                            {p.pendencias_abertas === 0 && !p.prazos.some((x) => x.status === 'aberto') && <p className="text-slate-500">Nenhuma pendência ou prazo aberto.</p>}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">Dados do processo</CardTitle></CardHeader>
                        <CardContent className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
                            <p>Rito: {p.rito_nome} · autuado em {dataHora(p.autuado_em)} por {p.autuado_por}</p>
                            {p.descricao && <p className="whitespace-pre-wrap">{p.descricao}</p>}
                            {p.partes.length > 0 && (
                                <div className="pt-1">
                                    <p>Partes</p>
                                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {p.partes.map((x, i) => (
                                            <li key={i} className="flex flex-wrap items-center gap-2 py-1.5">
                                                <span className="flex-1 min-w-[10rem]">{x.nome} ({x.polo}){x.email ? ` · ${x.email}` : ''}</span>
                                                {x.portal === 'ativo' && <Badge variant="secondary">Acompanha pelo portal</Badge>}
                                                {x.portal === 'convidado' && <Badge variant="outline">Convite pendente</Badge>}
                                                {x.portal !== 'ativo' && <Button size="sm" variant="outline" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'convidar', idx: i, parte: x })}>{x.portal ? 'Novo convite' : 'Convidar'}</Button>}
                                                {x.portal && <Button size="sm" variant="ghost" disabled={!podeMexer || ocupado} onClick={() => mov('revogarParte', { parte_idx: i }, 'Acesso revogado')}>Revogar</Button>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {p.tipo_nome && <p>Tipo: {p.tipo_nome}</p>}
                        </CardContent>
                    </Card>
                </div>

                <Card className="lg:col-span-2 h-fit">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Linha do tempo</CardTitle></CardHeader>
                    <CardContent>
                        <ol className="space-y-3">
                            {[...movimentos].reverse().map((m) => (
                                <li key={m.seq} className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400">#{m.seq} · {dataHora(m.em)} · {m.autor_nome} · {nomeUnidade(m.unidade_id)}</p>
                                    <p className="text-sm text-slate-800 dark:text-slate-200">{m.descricao}</p>
                                    <p className="text-[10px] font-mono text-slate-400 truncate" title={m.hash}>{m.hash}</p>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            </div>

            <AcaoDialog acao={acao} onClose={() => setAcao(null)} ocupado={ocupado} p={p} estado={estado} membros={membrosDaUnidade} mov={mov} doc={doc} convidar={convidar} />

            <Dialog open={!!linkConvite} onOpenChange={(o) => !o && setLinkConvite(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Convite gerado</DialogTitle></DialogHeader>
                    <div className="space-y-2 text-sm">
                        <p>{linkConvite?.emailEnviado ? 'O convite foi enviado por e-mail. Você também pode copiar o link abaixo.' : 'Envie este link à parte pelo meio que preferir. Ele não será mostrado de novo.'}</p>
                        <Input readOnly value={linkConvite?.link || ''} onFocus={(e) => e.target.select()} aria-label="Link do convite" />
                        <p className="text-xs text-slate-500">Vale por 7 dias e só pode ser aceito por uma conta. Quem aceitar vê os documentos marcados como visíveis às partes e pode peticionar.</p>
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
        </div>
    );
}

function AcaoDialog({ acao, onClose, ocupado, p, estado, membros, mov, doc, convidar }) {
    const [valor, setValor] = useState('');
    const [visivel, setVisivel] = useState('sim');
    const [motivo, setMotivo] = useState('');
    const [dias, setDias] = useState('15');
    const [contagem, setContagem] = useState('uteis');
    const [destinatario, setDestinatario] = useState('');
    const tipo = acao?.tipo;
    const reset = () => { setValor(''); setMotivo(''); setDestinatario(''); setVisivel('sim'); onClose(); };

    let titulo = '';
    let campo = null;
    let enviar = () => {};
    let rotuloTexto = 'Observação';
    let exigeTexto = false;
    let exigeValor = tipo === 'tramitar' || tipo === 'situacao';
    if (tipo === 'pendencia') {
        titulo = 'Abrir pendência para o decisor';
        rotuloTexto = 'O que precisa ser apreciado';
        exigeTexto = true;
        campo = <NativeSelect label="Efeito na fase" value={valor} onChange={setValor} options={[['', 'Só registrar, a fase segue'], ['sim', 'Interromper a fase até a apreciação']]} />;
        enviar = () => mov('abrirPendencia', { descricao: motivo, interrompe: valor === 'sim' }, 'Pendência aberta');
    } else if (tipo === 'resolver') {
        titulo = 'Apreciar pendência';
        rotuloTexto = 'Decisão';
        exigeTexto = true;
        campo = <p className="text-sm text-slate-700 dark:text-slate-300">{acao.pendencia.descricao}</p>;
        enviar = () => mov('resolverPendencia', { pendencia_id: acao.pendencia.id, resolucao: motivo }, 'Pendência apreciada');
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
        campo = (
            <>
                <NativeSelect label="Pendência para o decisor" value={valor} onChange={setValor} options={[['', 'Não abrir'], ['sim', 'Abrir pendência, a fase segue'], ['interrompe', 'Abrir pendência e interromper a fase']]} />
                <NativeSelect label="Portal das partes" value={visivel} onChange={setVisivel} options={[['sim', 'Visível às partes'], ['nao', 'Só para a equipe']]} />
            </>
        );
        enviar = () => doc('juntar', { docId: acao.documento.id, version: p.version, pendencia: valor || 'nao', visivel_partes: visivel === 'sim' }, 'Documento juntado aos autos');
    } else if (tipo === 'convidar') {
        titulo = `Convidar ${acao.parte.nome} para o portal das partes`;
        campo = (
            <div>
                <Label htmlFor="conv-email">E-mail para envio do convite</Label>
                <Input id="conv-email" type="email" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder={acao.parte.email || 'Opcional: sem e-mail, você copia o link'} />
            </div>
        );
        enviar = () => convidar(acao.idx, destinatario.trim() || acao.parte.email || '');
    }
    if (tipo === 'tramitar') {
        titulo = 'Tramitar para outra unidade';
        const opcoes = estado.unidades.filter((u) => u.ativa && u.id !== p.unidade_atual);
        const destino = valor || acao.destino || '';
        campo = <NativeSelect label="Destino" value={destino} onChange={setValor} options={[['', 'Escolha…'], ...opcoes.map((u) => [u.id, `${u.nome} (${rotuloUnidade(u.tipo).toLowerCase()})`])]} />;
        exigeValor = !destino;
        enviar = () => mov('tramitar', { unidade_destino: destino, motivo }, 'Processo remetido');
    } else if (tipo === 'fase') {
        titulo = 'Mudar a fase';
        const noFluxo = seguintes(p.fases, p.fases.findIndex((f) => f.id === p.fase_atual));
        const escolhida = valor || noFluxo[0] || '';
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
                                    {p.fases.find((f) => f.id === id)?.orientacao && <span className="block text-xs text-slate-500">{p.fases.find((f) => f.id === id).orientacao}</span>}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                ) : <p className="text-sm text-slate-600 dark:text-slate-300">Esta é a fase final do rito.</p>}
                <NativeSelect id="fase-fora" label="Ou ir para outra fase (fora do fluxo, exige motivo)" value={fora ? escolhida : ''} onChange={(v) => setValor(v || '')}
                    options={[['', '—'], ...p.fases.filter((f) => f.id !== p.fase_atual && !noFluxo.includes(f.id)).map((f) => [f.id, f.nome])]} />
            </div>
        );
        if (fora) { exigeTexto = true; rotuloTexto = 'Motivo para sair do fluxo'; }
        exigeValor = !escolhida;
        enviar = () => mov('avancarFase', { fase_id: escolhida, motivo }, 'Fase alterada');
    } else if (tipo === 'atribuir') {
        titulo = 'Atribuir a uma pessoa da unidade';
        campo = <NativeSelect label="Responsável" value={valor} onChange={setValor} options={[['', 'Ninguém'], ...membros.map((m) => [m.uid, m.nome])]} />;
        enviar = () => mov('atribuir', { responsavel_uid: valor || null }, 'Atribuição registrada');
    } else if (tipo === 'situacao') {
        titulo = 'Alterar a situação';
        campo = <NativeSelect label="Situação" value={valor} onChange={setValor} options={[['', 'Escolha…'], ...Object.entries(STATUS_ROTULO).filter(([k]) => k !== p.status)]} />;
        enviar = () => mov('alterarStatus', { status: valor, motivo }, 'Situação alterada');
    }
    if (tipo === 'situacao') { exigeTexto = true; rotuloTexto = 'Motivo'; }
    const semTexto = tipo === 'atribuir' || tipo === 'juntar' || tipo === 'convidar';

    return (
        <Dialog open={!!acao} onOpenChange={(o) => !o && reset()}>
            <DialogContent>
                <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                    {campo}
                    {!semTexto && (
                        <div><Label htmlFor="acao-motivo">{rotuloTexto}{exigeTexto ? ' (obrigatório)' : ''}</Label><Textarea id="acao-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
                    )}
                    <p className="text-xs text-slate-500">Fica registrado na linha do tempo com seu nome, data e hora.</p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={reset}>Cancelar</Button>
                    <Button disabled={ocupado || (exigeValor && !valor) || (exigeTexto && !motivo.trim())} onClick={async () => { await enviar(); setValor(''); setMotivo(''); setDestinatario(''); setVisivel('sim'); }}>
                        {ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
