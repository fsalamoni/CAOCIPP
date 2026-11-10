import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, List, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { base64ParaUrl, baixarBase64 } from '@/services/secretariaService';
import { dataHora } from './comum';

const DIALOGO_CHEIO = 'max-w-none w-screen h-[100dvh] sm:w-[96vw] sm:h-[96vh] sm:max-w-[1400px] p-0 gap-0 flex flex-col overflow-hidden sm:rounded-lg [&>button:last-child]:hidden';

const lerLidos = (chave) => { try { return new Set(JSON.parse(localStorage.getItem(chave) || '[]')); } catch { return new Set(); } };
const guardarLidos = (chave, set) => { try { localStorage.setItem(chave, JSON.stringify([...set])); } catch { /* sem armazenamento */ } };

/**
 * Leitor contínuo dos autos: a lista de documentos de um lado, as folhas do
 * outro, com anterior/próximo e marca de "lido" guardada no navegador.
 * `carregar(doc)` devolve `{ base64, nome }` do PDF carimbado; o resultado
 * fica em cache enquanto o leitor está aberto.
 */
export default function LeitorAutos({ documentos, abertoId, onFechar, carregar, titulo, chaveLido, prefixo = 'Doc. nº' }) {
    const [atual, setAtual] = useState(abertoId);
    const [listaAberta, setListaAberta] = useState(false);
    const [carregando, setCarregando] = useState(false);
    const [erro, setErro] = useState('');
    const [lidos, setLidos] = useState(() => (chaveLido ? lerLidos(chaveLido) : new Set()));
    const cache = useRef(new Map());
    const [url, setUrl] = useState(null);

    useEffect(() => { setAtual(abertoId); }, [abertoId]);

    const idx = documentos.findIndex((d) => d.id === atual);
    const doc = documentos[idx];

    useEffect(() => {
        if (!doc) return undefined;
        let vivo = true;
        setErro('');
        const mostrar = (pdf) => {
            if (!vivo) return;
            const u = base64ParaUrl(pdf.base64, 'application/pdf');
            setUrl(u);
            if (chaveLido) setLidos((s) => { const n = new Set(s); n.add(doc.id); guardarLidos(chaveLido, n); return n; });
        };
        if (cache.current.has(doc.id)) { mostrar(cache.current.get(doc.id)); return undefined; }
        setCarregando(true);
        carregar(doc).then((pdf) => { cache.current.set(doc.id, pdf); mostrar(pdf); })
            .catch((e) => vivo && setErro(e?.message || 'Não foi possível abrir o documento'))
            .finally(() => vivo && setCarregando(false));
        return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doc?.id]);

    useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

    const folhas = useMemo(() => (d) => (d.folha_inicial ? (d.folha_final > d.folha_inicial ? `fls. ${d.folha_inicial}–${d.folha_final}` : `fl. ${d.folha_inicial}`) : ''), []);
    const ir = (i) => { if (i >= 0 && i < documentos.length) { setAtual(documentos[i].id); setListaAberta(false); } };

    const aoTeclar = (e) => {
        if (e.key === 'ArrowLeft') ir(idx - 1);
        if (e.key === 'ArrowRight') ir(idx + 1);
    };

    return (
        <Dialog open={!!abertoId} onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className={DIALOGO_CHEIO} onKeyDown={aoTeclar}>
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-3 py-2">
                    <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => setListaAberta((v) => !v)} aria-expanded={listaAberta} aria-label="Lista de documentos"><List className="w-4 h-4" /></Button>
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="text-base truncate">{doc ? `${prefixo} ${doc.ordem} · ${doc.titulo}` : titulo || 'Autos'}</DialogTitle>
                        <DialogDescription className="text-xs truncate">{doc ? [doc.tipo, folhas(doc), dataHora(doc.juntado_em)].filter(Boolean).join(' · ') : 'Leitura dos documentos dos autos'}</DialogDescription>
                    </div>
                    <span className="hidden sm:inline text-xs text-slate-600 tabular-nums">{idx + 1} de {documentos.length}</span>
                    <Button size="sm" variant="outline" disabled={idx <= 0} onClick={() => ir(idx - 1)} aria-label="Documento anterior"><ChevronLeft className="w-4 h-4" /></Button>
                    <Button size="sm" variant="outline" disabled={idx >= documentos.length - 1} onClick={() => ir(idx + 1)} aria-label="Próximo documento"><ChevronRight className="w-4 h-4" /></Button>
                    {doc && cache.current.has(doc.id) && (
                        <Button size="sm" variant="outline" className="gap-1 hidden sm:inline-flex" onClick={() => { const p = cache.current.get(doc.id); baixarBase64(p.base64, p.nome); }}><Download className="w-4 h-4" /> Baixar</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={onFechar} aria-label="Fechar"><X className="w-4 h-4" /></Button>
                </div>
                <div className="flex flex-1 min-h-0 relative">
                    <nav aria-label="Documentos dos autos" className={`${listaAberta ? 'absolute inset-y-0 left-0 z-10 w-72 shadow-xl' : 'hidden'} lg:static lg:block lg:w-80 shrink-0 overflow-y-auto border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900`}>
                        <ol>
                            {documentos.map((d, i) => (
                                <li key={d.id}>
                                    <button type="button" onClick={() => ir(i)} aria-current={d.id === atual ? 'true' : undefined}
                                        className={`w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-sm ${d.id === atual ? 'bg-indigo-50 dark:bg-indigo-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                        <span className="flex items-baseline gap-2">
                                            <span className="font-mono text-xs text-slate-600 w-6 shrink-0">{d.ordem}</span>
                                            <span className={`flex-1 min-w-0 truncate ${chaveLido && !lidos.has(d.id) ? 'font-medium' : 'text-slate-700 dark:text-slate-300'}`}>{d.titulo}</span>
                                            {chaveLido && !lidos.has(d.id) && <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" aria-label="Não lido" />}
                                        </span>
                                        <span className="block text-xs text-slate-600 pl-8">{[d.tipo, folhas(d)].filter(Boolean).join(' · ')}</span>
                                    </button>
                                </li>
                            ))}
                        </ol>
                    </nav>
                    <div className="flex-1 min-w-0 bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                        {carregando ? <p className="flex items-center gap-2 text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo o documento…</p>
                            : erro ? <p className="text-red-700 dark:text-red-300 p-4 text-center">{erro}</p>
                                : url ? <iframe title={doc?.titulo || 'Documento'} src={url} className="w-full h-full" /> : null}
                    </div>
                </div>
                <p className="sm:hidden text-xs text-slate-600 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700">Deslize a lista pelo botão ☰. Se o PDF não aparecer inteiro, use Baixar no computador.</p>
            </DialogContent>
        </Dialog>
    );
}
