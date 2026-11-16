import React, { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Visor de PDF que funciona em qualquer aparelho. No computador com leitor
 * de PDF embutido, usa o do navegador (busca, impressão). No celular e no
 * tablet, onde o PDF num quadro não aparece (Android) ou mostra só a
 * primeira página (iPhone), desenha as páginas com o pdf.js, uma a uma,
 * conforme a pessoa rola, com zoom.
 *
 * `fonte`: `{ base64 }` ou `{ url }` (link temporário de arquivo grande, que
 * só se abre ou baixa: o navegador não o lê por dentro).
 */
export function leitorEmbutido() {
    if (typeof window === 'undefined') return false;
    const toque = window.matchMedia?.('(pointer: coarse)').matches;
    return navigator.pdfViewerEnabled === true && !toque;
}

const bytesDe = (base64) => {
    const bin = atob(base64);
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
};

export default function VisorPdf({ fonte, titulo = 'Documento', onBaixar, className = '' }) {
    const [blobUrl, setBlobUrl] = useState(null);
    const embutido = leitorEmbutido();

    useEffect(() => {
        if (!fonte?.base64 || !embutido) return undefined;
        const u = URL.createObjectURL(new Blob([bytesDe(fonte.base64)], { type: 'application/pdf' }));
        setBlobUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [fonte, embutido]);

    if (!fonte) return null;
    if (!fonte.base64 && fonte.url) {
        return (
            <div className={`flex flex-col items-center justify-center gap-3 p-6 text-center ${className}`}>
                <p className="text-sm text-slate-700 dark:text-slate-300 max-w-sm">Este PDF é grande demais para abrir aqui dentro. Abra ou baixe para ler; o link vale por pouco tempo.</p>
                <Button className="gap-2" onClick={onBaixar}><Download className="w-4 h-4" aria-hidden /> Abrir ou baixar o PDF</Button>
            </div>
        );
    }
    if (embutido) return blobUrl ? <iframe title={titulo} src={blobUrl} className={`w-full h-full ${className}`} /> : null;
    return <PaginasPdf base64={fonte.base64} titulo={titulo} className={className} />;
}

function PaginasPdf({ base64, titulo, className }) {
    const caixa = useRef(null);
    const [doc, setDoc] = useState(null);
    const [erro, setErro] = useState('');
    const [zoom, setZoom] = useState(1);
    const [largura, setLargura] = useState(0);

    useEffect(() => {
        let vivo = true;
        let carregado = null;
        setDoc(null);
        setErro('');
        (async () => {
            const [pdfjs, worker] = await Promise.all([
                import('pdfjs-dist/legacy/build/pdf.mjs'),
                import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
            ]);
            pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
            carregado = await pdfjs.getDocument({ data: bytesDe(base64), isEvalSupported: false }).promise;
            if (vivo) setDoc(carregado); else carregado.destroy();
        })().catch(() => vivo && setErro('Não foi possível abrir o PDF neste aparelho. Use Baixar.'));
        return () => { vivo = false; carregado?.destroy(); };
    }, [base64]);

    useEffect(() => {
        const el = caixa.current;
        if (!el) return undefined;
        const ro = new ResizeObserver(() => setLargura(el.clientWidth));
        ro.observe(el);
        setLargura(el.clientWidth);
        return () => ro.disconnect();
    }, []);

    const n = doc?.numPages || 0;
    return (
        <div className={`relative flex flex-col min-h-0 ${className}`}>
            <div ref={caixa} className="flex-1 min-h-0 overflow-auto bg-slate-200 dark:bg-slate-800 py-2" tabIndex={0} aria-label={`${titulo}: ${n} ${n === 1 ? 'página' : 'páginas'}`}>
                {erro ? <p role="alert" className="text-red-700 dark:text-red-300 p-4 text-center">{erro}</p>
                    : !doc ? <p className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300 p-6"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Montando o PDF…</p>
                        : Array.from({ length: n }, (_, i) => <Pagina key={i} doc={doc} numero={i + 1} total={n} largura={Math.max(200, (largura - 16) * zoom)} raiz={caixa} />)}
            </div>
            {doc && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-white/95 dark:bg-slate-900/95 shadow-md border border-slate-200 dark:border-slate-700 px-1 py-1">
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" disabled={zoom <= 0.5} onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label="Diminuir"><Minus className="w-4 h-4" /></Button>
                    <button type="button" className="text-xs tabular-nums w-12 text-center" onClick={() => setZoom(1)} aria-label="Ajustar à largura">{Math.round(zoom * 100)}%</button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full" disabled={zoom >= 3} onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} aria-label="Aumentar"><Plus className="w-4 h-4" /></Button>
                </div>
            )}
        </div>
    );
}

/** Uma página: reserva o espaço e só desenha quando chega perto da tela. */
function Pagina({ doc, numero, total, largura, raiz }) {
    const quadro = useRef(null);
    const tela = useRef(null);
    const [proporcao, setProporcao] = useState(1.414); // A4 até saber o tamanho real
    const [visivel, setVisivel] = useState(numero <= 2);

    useEffect(() => {
        const el = quadro.current;
        if (!el) return undefined;
        const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisivel(true); }, { root: raiz.current, rootMargin: '600px 0px' });
        io.observe(el);
        return () => io.disconnect();
    }, [raiz]);

    useEffect(() => {
        if (!visivel || !largura) return undefined;
        let tarefa = null;
        let vivo = true;
        doc.getPage(numero).then((pg) => {
            if (!vivo) return;
            const base = pg.getViewport({ scale: 1 });
            setProporcao(base.height / base.width);
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const vp = pg.getViewport({ scale: (largura / base.width) * dpr });
            const c = tela.current;
            if (!c) return;
            c.width = Math.floor(vp.width);
            c.height = Math.floor(vp.height);
            tarefa = pg.render({ canvasContext: c.getContext('2d'), viewport: vp });
            tarefa.promise.catch(() => undefined);
        });
        return () => { vivo = false; tarefa?.cancel(); };
    }, [doc, numero, visivel, largura]);

    return (
        <div ref={quadro} className="mx-auto mb-2 bg-white shadow" style={{ width: largura, height: largura * proporcao }}>
            <canvas ref={tela} role="img" aria-label={`Página ${numero} de ${total}`} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
    );
}
