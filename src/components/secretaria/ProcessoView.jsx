import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import {
    ArrowLeft, Download, FilePen, FileUp, FileDown, Loader2, PenLine, Send, ShieldCheck, ShieldAlert, Paperclip, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { secDocumento, secExportarPdf, secProcesso, baixarBase64, arquivoParaBase64 } from '@/services/secretariaService';
import { NativeSelect, STATUS_ROTULO, dataHora } from './comum';

const TOOLBAR = [[{ header: [1, 2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], [{ align: [] }], ['blockquote'], ['clean']];
const FORMATOS = ['header', 'bold', 'italic', 'underline', 'list', 'bullet', 'align', 'blockquote', 'indent'];
const MAX_MB = 5;

export default function ProcessoView({ orgId, procId, estado, onVoltar }) {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['sec-proc', orgId, procId], queryFn: () => secProcesso(orgId, 'obter', { id: procId }) });
    const [acao, setAcao] = useState(null); // {tipo, ...}
    const [ocupado, setOcupado] = useState(false);
    const [editor, setEditorRaw] = useState(null); // {docId?, titulo, tipo, delta}
    const deltaRef = useRef(null);
    const setEditor = (e) => {
        if (!e || e.delta !== editor?.delta) deltaRef.current = null; // novo documento aberto
        setEditorRaw(e);
    };

    if (q.isLoading) return <div className="py-8 flex gap-2 items-center text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando processo…</div>;
    if (q.error) return <div className="py-8 text-red-600">{q.error.message} <Button variant="link" onClick={onVoltar}>Voltar</Button></div>;

    const { processo: p, movimentos, documentos, cadeiaQuebradaEm, posse } = q.data;
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
    const arquivado = p.status === 'arquivado';
    const podeMexer = posse && !arquivado;
    const membrosDaUnidade = estado.membros.filter((m) => estado.unidades.find((u) => u.id === p.unidade_atual)?.membros_uids.includes(m.uid));

    const exportar = () => executar(async () => {
        const r = await secExportarPdf(orgId, procId);
        baixarBase64(r.base64, r.nome);
    }, 'PDF gerado');

    const baixar = (d) => executar(async () => {
        const r = await secDocumento(orgId, procId, 'baixar', { docId: d.id });
        if (r.origem === 'editor') setEditor({ docId: d.id, titulo: r.titulo, tipo: d.tipo, delta: { ops: r.delta }, somenteLeitura: true });
        else baixarBase64(r.base64, r.nomeArquivo, r.mime);
    });

    const abrirMinuta = (d) => executar(async () => {
        const r = await secDocumento(orgId, procId, 'baixar', { docId: d.id });
        setEditor({ docId: d.id, titulo: r.titulo, tipo: d.tipo, delta: { ops: r.delta }, somenteLeitura: (d.assinaturas || []).length > 0 });
    });

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

    const minutas = documentos.filter((d) => d.status === 'minuta');
    const autos = documentos.filter((d) => d.status === 'juntado');

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
                                        <p className="font-medium truncate">{d.titulo}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{d.tipo} · {dataHora(d.juntado_em)} · {d.assinaturas.length ? `assinado por ${d.assinaturas.map((a) => a.nome).join(', ')}` : 'sem assinatura'}</p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => baixar(d)} aria-label={`Abrir ${d.titulo}`}><Download className="w-4 h-4" /></Button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {posse && (
                        <Card>
                            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-base">Minutas da unidade</CardTitle>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" className="gap-1" disabled={!podeMexer} onClick={() => setEditor({ titulo: '', tipo: 'Despacho', delta: { ops: [] } })}><FilePen className="w-4 h-4" /> Redigir</Button>
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
                                                ? <Button size="sm" variant="ghost" onClick={() => abrirMinuta(d)}>Abrir</Button>
                                                : <Button size="sm" variant="ghost" onClick={() => baixar(d)} aria-label="Baixar"><Download className="w-4 h-4" /></Button>}
                                            <Button size="sm" variant="outline" className="gap-1" disabled={assinei || ocupado || !podeMexer} onClick={() => doc('assinar', { docId: d.id }, 'Documento assinado')}><PenLine className="w-4 h-4" /> {assinei ? 'Assinado' : 'Assinar'}</Button>
                                            <Button size="sm" disabled={ocupado || !podeMexer} onClick={() => doc('juntar', { docId: d.id, version: p.version }, 'Documento juntado aos autos')}>Juntar</Button>
                                            <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => doc('excluirMinuta', { docId: d.id }, 'Minuta excluída')} aria-label="Excluir minuta"><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">Dados do processo</CardTitle></CardHeader>
                        <CardContent className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
                            <p>Rito: {p.rito_nome} · autuado em {dataHora(p.autuado_em)} por {p.autuado_por}</p>
                            {p.descricao && <p className="whitespace-pre-wrap">{p.descricao}</p>}
                            {p.partes.length > 0 && <p>Partes: {p.partes.map((x) => `${x.nome} (${x.polo})`).join('; ')}</p>}
                            <p>Fases: {p.fases.map((f) => f.id === p.fase_atual ? `[${f.nome}]` : f.nome).join(' → ')}</p>
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

            <AcaoDialog acao={acao} onClose={() => setAcao(null)} ocupado={ocupado} p={p} estado={estado} membros={membrosDaUnidade} mov={mov} />

            <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
                <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{editor?.somenteLeitura ? editor?.titulo : editor?.docId ? 'Editar minuta' : 'Nova minuta'}</DialogTitle></DialogHeader>
                    {editor && (
                        <div className="space-y-3">
                            {!editor.somenteLeitura && (
                                <div className="grid sm:grid-cols-3 gap-3">
                                    <div className="sm:col-span-2"><Label htmlFor="min-tit">Título</Label><Input id="min-tit" value={editor.titulo} onChange={(e) => setEditor({ ...editor, titulo: e.target.value })} /></div>
                                    <div><Label htmlFor="min-tipo">Tipo</Label><Input id="min-tipo" value={editor.tipo} onChange={(e) => setEditor({ ...editor, tipo: e.target.value })} list="sec-tipos" />
                                        <datalist id="sec-tipos">{['Despacho', 'Decisão', 'Certidão', 'Ofício', 'Termo', 'Parecer', 'Petição', 'Ata'].map((t) => <option key={t} value={t} />)}</datalist>
                                    </div>
                                </div>
                            )}
                            <ReactQuill
                                theme="snow"
                                readOnly={editor.somenteLeitura}
                                modules={{ toolbar: editor.somenteLeitura ? false : TOOLBAR }}
                                formats={FORMATOS}
                                defaultValue={editor.delta}
                                key={editor.docId || 'nova'}
                                onChange={(_html, _delta, _src, ed) => { deltaRef.current = ed.getContents(); }}
                                className="bg-white dark:bg-slate-900 [&_.ql-editor]:min-h-[320px]"
                            />
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditor(null)}>Fechar</Button>
                        {editor && !editor.somenteLeitura && (
                            <Button disabled={ocupado || !editor.titulo.trim()} onClick={() => executar(async () => {
                                const delta = deltaRef.current || editor.delta;
                                if (editor.docId) await secDocumento(orgId, procId, 'editarMinuta', { docId: editor.docId, titulo: editor.titulo, tipo: editor.tipo, delta });
                                else await secDocumento(orgId, procId, 'criarMinuta', { titulo: editor.titulo, tipo: editor.tipo, delta });
                                setEditor(null);
                            }, 'Minuta salva')}>
                                {ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar minuta
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function AcaoDialog({ acao, onClose, ocupado, p, estado, membros, mov }) {
    const [valor, setValor] = useState('');
    const [motivo, setMotivo] = useState('');
    const tipo = acao?.tipo;
    const reset = () => { setValor(''); setMotivo(''); onClose(); };

    let titulo = '';
    let campo = null;
    let enviar = () => {};
    if (tipo === 'tramitar') {
        titulo = 'Tramitar para outra unidade';
        const opcoes = estado.unidades.filter((u) => u.ativa && u.id !== p.unidade_atual);
        campo = <NativeSelect label="Destino" value={valor} onChange={setValor} options={[['', 'Escolha…'], ...opcoes.map((u) => [u.id, `${u.nome}${u.tipo === 'gabinete' ? ' (gabinete)' : ''}`])]} />;
        enviar = () => mov('tramitar', { unidade_destino: valor, motivo }, 'Processo remetido');
    } else if (tipo === 'fase') {
        titulo = 'Mudar a fase';
        campo = <NativeSelect label="Fase" value={valor} onChange={setValor} options={[['', 'Próxima fase do rito'], ...p.fases.filter((f) => f.id !== p.fase_atual).map((f) => [f.id, f.nome])]} />;
        enviar = () => mov('avancarFase', { fase_id: valor || undefined, motivo }, 'Fase alterada');
    } else if (tipo === 'atribuir') {
        titulo = 'Atribuir a uma pessoa da unidade';
        campo = <NativeSelect label="Responsável" value={valor} onChange={setValor} options={[['', 'Ninguém'], ...membros.map((m) => [m.uid, m.nome])]} />;
        enviar = () => mov('atribuir', { responsavel_uid: valor || null }, 'Atribuição registrada');
    } else if (tipo === 'situacao') {
        titulo = 'Alterar a situação';
        campo = <NativeSelect label="Situação" value={valor} onChange={setValor} options={[['', 'Escolha…'], ...Object.entries(STATUS_ROTULO).filter(([k]) => k !== p.status)]} />;
        enviar = () => mov('alterarStatus', { status: valor, motivo }, 'Situação alterada');
    }
    const exigeValor = tipo === 'tramitar' || tipo === 'situacao';
    const exigeMotivo = tipo === 'situacao';

    return (
        <Dialog open={!!acao} onOpenChange={(o) => !o && reset()}>
            <DialogContent>
                <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                    {campo}
                    {tipo !== 'atribuir' && (
                        <div><Label htmlFor="acao-motivo">{exigeMotivo ? 'Motivo (obrigatório)' : 'Observação'}</Label><Textarea id="acao-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
                    )}
                    <p className="text-xs text-slate-500">Fica registrado na linha do tempo com seu nome, data e hora.</p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={reset}>Cancelar</Button>
                    <Button disabled={ocupado || (exigeValor && !valor) || (exigeMotivo && !motivo.trim())} onClick={async () => { await enviar(); setValor(''); setMotivo(''); }}>
                        {ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Confirmar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
