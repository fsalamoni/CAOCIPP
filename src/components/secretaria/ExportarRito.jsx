import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Download, FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FORMATOS, nomeDoArquivo, raiaPadrao, ritoParaAbas, ritoParaBpmn, ritoParaMermaid, ritoParaSvg } from '@/lib/exportarRito';
import { copiarTexto } from './comum';

// Exportar o rito em vários formatos, da tela de edição ou do menu do rito.
// A conversão é toda de lib/exportarRito (testada); aqui só se baixa o arquivo.
// A imagem sai do tamanho do rito inteiro: uma faixa, uma raia por unidade.

const LADO_MAX = 16000; // limite do navegador para o lado da imagem
const AREA_MAX = 200e6; // e para a área, em pixels
const PAGINA_MAX = 14000; // lado máximo de uma página de PDF, em pontos

function baixar(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** SVG → PNG (data URL) no maior tamanho que o navegador aceita, até o dobro (nítido ao ampliar). */
export async function svgParaPng({ svg, largura, altura }) {
    const escala = Math.max(0.2, Math.min(2, LADO_MAX / Math.max(largura, altura), Math.sqrt(AREA_MAX / (largura * altura))));
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    try {
        const img = new Image();
        await new Promise((ok, erro) => { img.onload = ok; img.onerror = () => erro(new Error('O navegador não conseguiu desenhar a imagem')); img.src = url; });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(largura * escala);
        canvas.height = Math.round(altura * escala);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('O navegador não conseguiu criar a imagem (rito grande demais). Use o SVG.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
        if (!blob) throw new Error('O navegador não conseguiu criar a imagem (rito grande demais). Use o SVG.');
        return { blob, dataUrl: canvas.toDataURL('image/png'), escala };
    } finally { URL.revokeObjectURL(url); }
}

/**
 * fases: as do rito (com `raia` ou `unidade_id`). unidades: as do órgão, para o nome da raia.
 * aberto/onFechar: controlado por quem chama.
 */
export default function ExportarRito({ aberto, onFechar, nome, fases, unidades }) {
    const [comAcoes, setComAcoes] = useState(true);
    const [ocupado, setOcupado] = useState(null);
    const lista = useMemo(() => (fases || []).filter((f) => String(f.nome || '').trim()), [fases]);
    const raia = useMemo(() => raiaPadrao(unidades), [unidades]);
    const temAcoes = lista.some((f) => (f.acoes || []).some((a) => String(a || '').trim()));

    const exportar = async (id) => {
        setOcupado(id);
        try {
            const arquivo = (ext) => nomeDoArquivo(nome, ext);
            if (id === 'bpmn') baixar(new Blob([ritoParaBpmn(lista, { nome: nome || 'Rito', raiaDe: raia })], { type: 'application/xml;charset=utf-8' }), arquivo('bpmn'));
            else if (id === 'mmd') baixar(new Blob([ritoParaMermaid(lista, raia)], { type: 'text/plain;charset=utf-8' }), arquivo('mmd'));
            else if (id === 'xlsx') {
                const XLSX = await import('xlsx');
                const wb = XLSX.utils.book_new();
                for (const aba of ritoParaAbas(lista, raia)) {
                    const ws = XLSX.utils.aoa_to_sheet(aba.linhas);
                    ws['!cols'] = aba.larguras.map((wch) => ({ wch }));
                    XLSX.utils.book_append_sheet(wb, ws, aba.nome);
                }
                XLSX.writeFile(wb, arquivo('xlsx'));
            } else {
                const desenho = ritoParaSvg(lista, { nome, raiaDe: raia, acoes: comAcoes && temAcoes });
                if (id === 'svg') baixar(new Blob([desenho.svg], { type: 'image/svg+xml;charset=utf-8' }), arquivo('svg'));
                else {
                    const png = await svgParaPng(desenho);
                    if (id === 'png') baixar(png.blob, arquivo('png'));
                    else {
                        const { default: JsPDF } = await import('jspdf');
                        const k = Math.min(1, PAGINA_MAX / Math.max(desenho.largura, desenho.altura));
                        const w = desenho.largura * k;
                        const h = desenho.altura * k;
                        const doc = new JsPDF({ orientation: w >= h ? 'landscape' : 'portrait', unit: 'pt', format: [w, h], compress: true });
                        doc.addImage(png.dataUrl, 'PNG', 0, 0, w, h, undefined, 'FAST');
                        doc.save(arquivo('pdf'));
                    }
                }
            }
            toast.success(`Rito exportado: ${FORMATOS.find((f) => f.id === id).nome}`);
        } catch (e) { toast.error(e?.message || 'Não foi possível exportar o rito'); }
        setOcupado(null);
    };

    return (
        <Dialog open={aberto} onOpenChange={(o) => { if (!o) onFechar(); }}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><FileDown className="w-5 h-5" aria-hidden /> Exportar o rito</DialogTitle>
                    <DialogDescription>
                        {nome ? <><b>{nome}</b>, com </> : 'Com '}{lista.length} {lista.length === 1 ? 'fase' : 'fases'}. A imagem e o diagrama saem com o rito inteiro, numa faixa só, com cada fase na raia da sua unidade, do tamanho que for preciso.
                    </DialogDescription>
                </DialogHeader>
                {lista.length === 0 ? <p className="text-sm text-slate-600 dark:text-slate-300">Dê nome a pelo menos uma fase para exportar.</p> : (
                    <>
                        {temAcoes && (
                            <label className="flex items-start gap-2 rounded-md border border-slate-200 dark:border-slate-700 p-2.5 text-sm">
                                <Checkbox checked={comAcoes} onCheckedChange={(c) => setComAcoes(c === true)} className="mt-0.5" />
                                <span>Na imagem e no PDF, mostrar as ações dentro de cada fase<span className="block text-xs text-slate-600 dark:text-slate-300">Desmarque para um desenho mais baixo, só com as fases e os caminhos.</span></span>
                            </label>
                        )}
                        <ul className="space-y-2">
                            {FORMATOS.map((f) => (
                                <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 dark:border-slate-700 p-2.5">
                                    <div className="min-w-[12rem] flex-1">
                                        <p className="text-sm font-medium">{f.nome} <span className="font-normal text-xs text-slate-600 dark:text-slate-300">.{f.ext}</span></p>
                                        <p className="text-xs text-slate-600 dark:text-slate-300">{f.texto}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {f.id === 'mmd' && <Button size="sm" variant="outline" className="gap-1" onClick={() => copiarTexto(ritoParaMermaid(lista, raia), 'Diagrama copiado em Mermaid')}><Copy className="w-4 h-4" aria-hidden /> Copiar</Button>}
                                        <Button size="sm" variant="outline" className="gap-1" disabled={ocupado !== null} onClick={() => exportar(f.id)} aria-label={`Baixar em ${f.nome}`}>
                                            {ocupado === f.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Download className="w-4 h-4" aria-hidden />} Baixar
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <p className="text-xs text-slate-600 dark:text-slate-300">Planilha, Mermaid e BPMN voltam para o SIGO pela importação do rito. Para levar o rito completo a outro órgão, com modelos de documento e configurações, use &quot;Exportar para outro órgão&quot; no menu do rito.</p>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
