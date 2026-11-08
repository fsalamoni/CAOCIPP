import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Eye, FileText, Loader2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { base64ParaUrl, baixarBase64, secConfig } from '@/services/secretariaService';
import EditorDocumento, { preencherCampos } from './EditorDocumento';

const DIALOGO_CHEIO = 'max-w-none w-screen h-[100dvh] sm:w-[96vw] sm:h-[96vh] sm:max-w-[1240px] p-0 gap-0 flex flex-col overflow-hidden sm:rounded-lg [&>button:last-child]:hidden';

/** Pré-visualização de PDF dentro da plataforma, com download. */
export function VisualizadorPdf({ pdf, onFechar }) {
    const [url, setUrl] = useState(null);
    useEffect(() => {
        if (!pdf) return undefined;
        const u = base64ParaUrl(pdf.base64);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [pdf]);
    return (
        <Dialog open={!!pdf} onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className={DIALOGO_CHEIO}>
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-3 py-2">
                    <DialogTitle className="text-base truncate flex-1">{pdf?.titulo || 'Documento'}</DialogTitle>
                    <DialogDescription className="sr-only">Visualização do PDF</DialogDescription>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => baixarBase64(pdf.base64, pdf.nome)}><Download className="w-4 h-4" /> Baixar</Button>
                    <Button size="sm" variant="ghost" onClick={onFechar} aria-label="Fechar"><X className="w-4 h-4" /></Button>
                </div>
                {url && <iframe title={pdf?.titulo || 'PDF'} src={url} className="flex-1 w-full bg-slate-200 dark:bg-slate-800" />}
                <p className="sm:hidden text-xs text-slate-500 px-3 py-2">No celular, se o PDF não aparecer inteiro, use Baixar.</p>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Janela de redação: título, tipo, modelo do órgão e o editor completo.
 * Salvar não fecha (Ctrl+S); a prévia em PDF mostra como o documento entra
 * nos autos, com cabeçalho e assinaturas.
 */
export default function RedacaoDocumento({ aberto, inicial, estado, orgId, valoresCampos, onSalvar, onPdf, onFechar }) {
    const [titulo, setTitulo] = useState('');
    const [tipo, setTipo] = useState('Despacho');
    const [docId, setDocId] = useState(null);
    const [versaoEditor, setVersaoEditor] = useState(0);
    const [conteudoInicial, setConteudoInicial] = useState(null);
    const [sujo, setSujo] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [confirmarSaida, setConfirmarSaida] = useState(false);
    const [pdf, setPdf] = useState(null);
    const conteudo = useRef(null);

    useEffect(() => {
        if (!aberto || !inicial) return;
        setTitulo(inicial.titulo || '');
        setTipo(inicial.tipo || 'Despacho');
        setDocId(inicial.docId || null);
        setConteudoInicial(inicial.conteudo || null);
        conteudo.current = inicial.conteudo || null;
        setSujo(false);
        setConfirmarSaida(false);
        setVersaoEditor((v) => v + 1);
    }, [aberto, inicial]);

    const leitura = !!inicial?.somenteLeitura;
    const tipos = [...new Set([...(estado.documento?.tipos_documento || []), tipo].filter(Boolean))];
    const modelos = (estado.modelos || []).filter((m) => m.ativo);

    const usarModelo = async (id) => {
        if (!id) return;
        if (sujo && !window.confirm('Trocar pelo modelo apaga o que foi escrito. Continuar?')) return;
        setOcupado(true);
        try {
            const m = await secConfig(orgId, 'obterModelo', { id });
            const doc = preencherCampos(m.conteudo, valoresCampos || {});
            setConteudoInicial(doc);
            conteudo.current = doc;
            if (m.tipo_documento) setTipo(m.tipo_documento);
            if (!titulo.trim()) setTitulo(m.nome);
            setSujo(true);
            setVersaoEditor((v) => v + 1);
        } catch (e) { toast.error(e?.message || 'Não foi possível abrir o modelo'); } finally { setOcupado(false); }
    };

    const salvar = async () => {
        if (leitura || ocupado) return null;
        if (!titulo.trim()) { toast.error('Dê um título ao documento'); return null; }
        setOcupado(true);
        try {
            const id = await onSalvar({ docId, titulo: titulo.trim(), tipo, conteudo: conteudo.current || { type: 'doc', content: [{ type: 'paragraph' }] } });
            setDocId(id);
            setSujo(false);
            toast.success('Minuta salva');
            return id;
        } catch (e) {
            toast.error(e?.message || 'Não foi possível salvar');
            return null;
        } finally { setOcupado(false); }
    };

    const visualizar = async () => {
        let id = docId;
        if (!leitura && (sujo || !id)) id = await salvar();
        if (!id) return;
        setOcupado(true);
        try {
            const r = await onPdf(id);
            setPdf({ ...r, titulo: titulo || 'Documento' });
        } catch (e) { toast.error(e?.message || 'Não foi possível gerar o PDF'); } finally { setOcupado(false); }
    };

    const fechar = () => {
        if (sujo && !leitura) { setConfirmarSaida(true); return; }
        onFechar();
    };

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
            <DialogContent className={DIALOGO_CHEIO} onEscapeKeyDown={(e) => { if (sujo && !leitura) { e.preventDefault(); setConfirmarSaida(true); } }}>
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-3 py-2">
                    <FileText className="w-5 h-5 text-indigo-600 shrink-0 hidden sm:block" aria-hidden />
                    <DialogTitle className="sr-only">{leitura ? titulo : docId ? 'Editar minuta' : 'Nova minuta'}</DialogTitle>
                    <DialogDescription className="sr-only">Editor de documento do processo</DialogDescription>
                    {leitura ? (
                        <p className="font-medium flex-1 min-w-0 truncate">{titulo} <span className="text-sm font-normal text-slate-500">· {tipo}</span></p>
                    ) : (
                        <>
                            <Input aria-label="Título do documento" placeholder="Título do documento" value={titulo} onChange={(e) => { setTitulo(e.target.value); setSujo(true); }} className="h-9 flex-1 min-w-[12rem]" />
                            <select aria-label="Tipo de documento" value={tipo} onChange={(e) => { setTipo(e.target.value); setSujo(true); }} className="h-9 rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm w-full sm:w-auto">
                                {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                            {!docId && modelos.length > 0 && (
                                <select aria-label="Começar de um modelo" value="" onChange={(e) => usarModelo(e.target.value)} className="h-9 rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm w-full sm:w-auto">
                                    <option value="">Usar modelo…</option>
                                    {modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.tipo_documento ? ` (${m.tipo_documento})` : ''}</option>)}
                                </select>
                            )}
                        </>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                        {!leitura && <span className="text-xs text-slate-500 hidden md:inline" aria-live="polite">{ocupado ? 'Salvando…' : sujo ? 'Alterações não salvas' : docId ? 'Salvo' : ''}</span>}
                        <Button size="sm" variant="outline" className="gap-1" disabled={ocupado} onClick={visualizar}><Eye className="w-4 h-4" /> <span className="hidden sm:inline">{leitura ? 'PDF' : 'Visualizar PDF'}</span></Button>
                        {!leitura && <Button size="sm" className="gap-1" disabled={ocupado || !titulo.trim()} onClick={salvar}>{ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar</Button>}
                        <Button size="sm" variant="ghost" onClick={fechar} aria-label="Fechar"><X className="w-4 h-4" /></Button>
                    </div>
                </div>
                {confirmarSaida && (
                    <div role="alert" className="flex flex-wrap items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 text-sm text-amber-900 dark:text-amber-100">
                        <span className="flex-1 min-w-[12rem]">Há alterações não salvas.</span>
                        <Button size="sm" variant="outline" onClick={() => setConfirmarSaida(false)}>Continuar editando</Button>
                        <Button size="sm" variant="outline" onClick={onFechar}>Descartar</Button>
                        <Button size="sm" onClick={async () => { if (await salvar()) onFechar(); }}>Salvar e fechar</Button>
                    </div>
                )}
                <div className="flex-1 min-h-0 p-0 sm:p-2">
                    {aberto && (
                        <EditorDocumento
                            key={versaoEditor}
                            conteudo={conteudoInicial}
                            somenteLeitura={leitura}
                            config={estado.documento || {}}
                            autoFocus={!leitura}
                            onChange={(j) => { conteudo.current = j; setSujo(true); }}
                            onSalvar={salvar}
                        />
                    )}
                </div>
                <VisualizadorPdf pdf={pdf} onFechar={() => setPdf(null)} />
            </DialogContent>
        </Dialog>
    );
}
