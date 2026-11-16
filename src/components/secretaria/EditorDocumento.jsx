import React, { useEffect, useRef, useState } from 'react';
import { EditorContent, Extension, Node, mergeAttributes, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { FontFamily, TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table, TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { CharacterCount, Placeholder } from '@tiptap/extensions';
import {
    AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowUpDown, Baseline, Bold, Braces, Code, Columns3, FolderOpen, Highlighter, ImagePlus, IndentDecrease,
    IndentIncrease, Italic, Link as LinkIcon, List, ListOrdered, Loader2, Minus, Omega, Pilcrow, Redo2, RemoveFormatting, Rows3, Search,
    SeparatorHorizontal, Square, Strikethrough, Subscript as SubIcon, Superscript as SupIcon, Table as TableIcon, TableCellsMerge, TableCellsSplit,
    Trash2, Underline as UnderlineIcon, Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import './fontesDocumento';
import './editorDocumento.css';

/**
 * Editor de documentos da Secretaria, com recursos de processador de texto:
 * estilos, fontes, tamanhos, cores, marca-texto, alinhamento, espaçamento,
 * recuos, listas, tabelas (mesclar, cabeçalho), imagens, links, quebra de
 * página, caracteres especiais, localizar e substituir, contagem de palavras
 * e zoom. O conteúdo é o mesmo que o servidor valida e converte em PDF.
 */

// Fontes livres com as mesmas medidas das do Office: a linha quebra no mesmo
// lugar no editor, no PDF dos autos e no Word/LibreOffice.
export const FONTES = [['', 'Fonte padrão'], ['serif', 'Times New Roman'], ['sans-serif', 'Arial'], ['calibri', 'Calibri'], ['cambria', 'Cambria'], ['monospace', 'Courier New']];
export const CSS_FONTE = {
    serif: 'Tinos, "Times New Roman", Times, serif',
    'sans-serif': 'Arimo, Arial, Helvetica, sans-serif',
    calibri: 'Carlito, Calibri, sans-serif',
    cambria: 'Caladea, Cambria, serif',
    monospace: 'Cousine, "Courier New", Courier, monospace',
};
/** Nome de fonte (do Word, LibreOffice ou de uma página colada) → chave do editor. */
export function chaveFonte(css) {
    const s = String(css || '').toLowerCase();
    if (!s) return null;
    if (CSS_FONTE[s.trim()]) return s.trim();
    if (/calibri|carlito/.test(s)) return 'calibri';
    if (/cambria|caladea/.test(s)) return 'cambria';
    if (/courier|cousine|consolas|mono/.test(s)) return 'monospace';
    if (/times|tinos|georgia|garamond|book antiqua|palatino|liberation serif|\bserif/.test(s) && !/sans/.test(s)) return 'serif';
    if (/arial|arimo|helvetica|verdana|tahoma|segoe|liberation sans|open sans|roboto|sans/.test(s)) return 'sans-serif';
    return null;
}
const TAMANHOS = [8, 9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];
const ESPACAMENTOS = [1, 1.15, 1.5, 2, 2.5, 3];
const ESPACOS_PT = [0, 3, 6, 8, 10, 12, 18, 24];
const virgula = (n) => String(n).replace('.', ',');
/** Altura de linha do CSS para o "múltiplo" do Word (simples = 1,15 da fonte). */
export const alturaLinha = (esp) => Math.round((Number(esp) || 1.15) * 1.15 * 10000) / 10000;
const CORES = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#ffffff',
    '#7f1d1d', '#b91c1c', '#c2410c', '#a16207', '#15803d', '#0f766e',
    '#1d4ed8', '#1e3a8a', '#6d28d9', '#86198f', '#be185d', '#0e7490',
    '#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#bfdbfe', '#e9d5ff',
];
// Só caracteres que as fontes do PDF (Times, Courier) também imprimem.
const ESPECIAIS = '§ º ª ° ¹ ² ³ – — “ ” ‘ ’ « » … • ± × ÷ € £ © ® ™ ½ ¼ ¾ ¶ † ‡ µ ¿ ¡'.split(' ');
const LARGURA_UTIL_PX = 605; // 16 cm a 96 dpi
const MAX_IMAGEM = 1.4 * 1024 * 1024;
const IMAGEM_LEVE = 400 * 1024;

/** Medida do CSS (cm, mm, in, pt, px) → cm. */
export function emCm(v) {
    const m = String(v || '').trim().match(/^(-?[\d.]+)(cm|mm|in|pt|px)$/);
    if (!m) return null;
    const n = Number(m[1]);
    return { cm: n, mm: n / 10, in: n * 2.54, pt: (n * 2.54) / 72, px: (n * 2.54) / 96 }[m[2]];
}
const limitar = (n, min, max, casas = 2) => (n === null || !Number.isFinite(n) ? null : Math.round(Math.min(max, Math.max(min, n)) * 10 ** casas) / 10 ** casas);
/** line-height do CSS (do Word: "115%", "1.5", "18pt") → múltiplo do Word. */
export function espacamentoDoCss(v, fontePt = 12) {
    const s = String(v || '').trim();
    let n = null;
    if (/%$/.test(s)) n = parseFloat(s) / 100;
    else if (/^[\d.]+$/.test(s)) n = Number(s) / 1.15;
    else if (emCm(s) !== null) n = ((emCm(s) * 72) / 2.54) / (fontePt * 1.15);
    return limitar(n, 0.8, 3);
}

// Recuos, espaçamento entre linhas e antes/depois do parágrafo, como no Word.
// Lê também o estilo do texto colado do Word, do LibreOffice ou de páginas.
const ParagrafoFormato = Extension.create({
    name: 'paragrafoFormato',
    addGlobalAttributes() {
        const dado = (el, nome) => (el.dataset[nome] !== undefined && el.dataset[nome] !== '' ? Number(el.dataset[nome]) : undefined);
        const attr = (nome, ler, estilo) => ({
            default: null,
            parseHTML: (el) => { const d = dado(el, nome); return d !== undefined ? d : ler(el); },
            renderHTML: (a) => (a[nome] === null || a[nome] === undefined ? {} : { [`data-${nome.toLowerCase()}`]: a[nome], style: estilo(a[nome]) }),
        });
        const pt = (cm) => (cm === null ? null : (cm * 72) / 2.54);
        return [{
            types: ['paragraph', 'heading'],
            attributes: {
                recuo: attr('recuo', (el) => limitar(emCm(el.style.textIndent), 0, 5) || null, (v) => `text-indent: ${v}cm`),
                margemEsq: attr('margemEsq', (el) => limitar(emCm(el.style.marginLeft), 0, 10) || null, (v) => `margin-left: ${v}cm`),
                espacamento: attr('espacamento', (el) => espacamentoDoCss(el.style.lineHeight), (v) => `line-height: ${alturaLinha(v)}`),
                antes: attr('antes', (el) => limitar(pt(emCm(el.style.marginTop)), 0, 72, 1), (v) => `margin-top: ${v}pt`),
                depois: attr('depois', (el) => limitar(pt(emCm(el.style.marginBottom)), 0, 72, 1), (v) => `margin-bottom: ${v}pt`),
            },
        }];
    },
});

// Fonte guardada como chave (serif, calibri…) e desenhada com a fonte de mesma medida.
const FonteSigo = FontFamily.extend({
    addGlobalAttributes() {
        return [{
            types: this.options.types,
            attributes: {
                fontFamily: {
                    default: null,
                    parseHTML: (el) => chaveFonte(el.style.fontFamily),
                    renderHTML: (a) => (a.fontFamily ? { style: `font-family: ${CSS_FONTE[a.fontFamily] || a.fontFamily}` } : {}),
                },
            },
        }];
    },
});

// Imagem alinhada à esquerda, ao centro ou à direita.
const ImagemSigo = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            align: {
                default: null,
                parseHTML: (el) => el.getAttribute('data-align') || (el.getAttribute('align') === 'center' ? 'center' : null),
                renderHTML: (a) => (a.align ? { 'data-align': a.align } : {}),
            },
        };
    },
});

// Tabela sem bordas (de diagramação): no editor, linhas tracejadas só para orientar.
const TabelaSigo = Table.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            semBordas: {
                default: null,
                parseHTML: (el) => (el.hasAttribute('data-sem-bordas') ? true : null),
                renderHTML: (a) => (a.semBordas ? { 'data-sem-bordas': '' } : {}),
            },
        };
    },
});

const QuebraPagina = Node.create({
    name: 'pageBreak',
    group: 'block',
    atom: true,
    selectable: true,
    parseHTML: () => [{ tag: 'div[data-quebra-pagina]' }],
    renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-quebra-pagina': '' })],
    addKeyboardShortcuts() {
        return { 'Mod-Enter': () => this.editor.chain().insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }]).run() };
    },
});

/** Reduz imagem grande (lado maior até 1600 px; JPEG se preciso) para caber no limite. */
export async function prepararImagem(file) {
    if (!/^image\/(png|jpeg)$/.test(file.type)) throw new Error('Use imagem PNG ou JPG');
    const url = await new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = erro; r.readAsDataURL(file); });
    const img = await new Promise((ok, erro) => { const i = new window.Image(); i.onload = () => ok(i); i.onerror = () => erro(new Error('Imagem inválida')); i.src = url; });
    const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
    // Imagem leve fica como está; a pesada (foto de celular) vira JPEG de boa qualidade, sem diferença visível na folha.
    if (escala === 1 && url.length * 0.75 <= IMAGEM_LEVE) return { src: url, largura: img.width };
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * escala);
    c.height = Math.round(img.height * escala);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.7, 0.55]) {
        const d = c.toDataURL('image/jpeg', q);
        // Captura de tela costuma ficar menor no PNG original: fica ele.
        if (escala === 1 && url.length <= d.length && url.length * 0.75 <= MAX_IMAGEM) return { src: url, largura: img.width };
        if (d.length * 0.75 <= MAX_IMAGEM) return { src: d, largura: c.width };
    }
    throw new Error('Imagem grande demais mesmo reduzida');
}

/** Ocorrências de um termo nos trechos de texto (não atravessa mudança de formatação). */
export function acharOcorrencias(doc, termo, caso) {
    const res = [];
    if (!termo) return res;
    const alvo = caso ? termo : termo.toLocaleLowerCase('pt-BR');
    doc.descendants((n, pos) => {
        if (!n.isText) return;
        const t = caso ? n.text : n.text.toLocaleLowerCase('pt-BR');
        for (let i = t.indexOf(alvo); i !== -1; i = t.indexOf(alvo, i + alvo.length)) res.push({ from: pos + i, to: pos + i + alvo.length });
    });
    return res;
}

function Botao({ titulo, ativo, onClick, children, disabled }) {
    return (
        <button
            type="button" title={titulo} aria-label={titulo} aria-pressed={ativo === undefined ? undefined : !!ativo} disabled={disabled}
            onMouseDown={(e) => e.preventDefault()} onClick={onClick}
            className={`h-8 min-w-8 px-1.5 shrink-0 inline-flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${ativo ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}
        >{children}</button>
    );
}
const Sep = () => <span className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1 shrink-0" aria-hidden />;
function Lista({ titulo, value, onChange, options, className = '' }) {
    return (
        <select aria-label={titulo} title={titulo} value={value} onChange={(e) => onChange(e.target.value)}
            className={`h-8 shrink-0 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-1 ${className}`}>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
    );
}
function Paleta({ titulo, icone, cor, aoEscolher, rotuloLimpar }) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button type="button" title={titulo} aria-label={titulo} onMouseDown={(e) => e.preventDefault()}
                    className="h-8 px-1.5 shrink-0 inline-flex flex-col items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">
                    {icone}<span className="block h-1 w-4 rounded-sm -mt-0.5" style={{ background: cor || 'transparent', border: cor ? 0 : '1px solid #94a3b8' }} />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="grid grid-cols-6 gap-1">
                    {CORES.map((c) => (
                        <button key={c} type="button" title={c} aria-label={`Cor ${c}`} onClick={() => aoEscolher(c)}
                            className="h-7 w-7 rounded border border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500" style={{ background: c }} />
                    ))}
                </div>
                <div className="flex items-center justify-between gap-2 mt-2">
                    <button type="button" className="text-xs text-indigo-700 dark:text-indigo-300 hover:underline" onClick={() => aoEscolher(null)}>{rotuloLimpar}</button>
                    <label className="text-xs flex items-center gap-1">Outra
                        <input type="color" className="h-6 w-8 p-0 border-0 bg-transparent" onChange={(e) => aoEscolher(e.target.value)} />
                    </label>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export default function EditorDocumento({
    conteudo, onChange, somenteLeitura = false, config = {}, campos = null, onSalvar, autoFocus = false, rotulo = 'Texto do documento',
    converterArquivo = null,
}) {
    const salvarRef = useRef(onSalvar);
    salvarRef.current = onSalvar;
    const [zoom, setZoom] = useState('1');
    const [paginas, setPaginas] = useState(1);
    const [abrindo, setAbrindo] = useState(false);
    const abrirRef = useRef(null);
    const folhaRef = useRef(null);
    const [busca, setBusca] = useState({ termo: '', subst: '', caso: false });
    const [link, setLink] = useState('');
    const [grade, setGrade] = useState({ l: 0, c: 0 });
    const arquivoRef = useRef(null);
    const pronto = useRef(false);

    const editor = useEditor({
        editable: !somenteLeitura,
        immediatelyRender: true,
        shouldRerenderOnTransaction: true,
        autofocus: autoFocus ? 'start' : false,
        content: conteudo || { type: 'doc', content: [{ type: 'paragraph' }] },
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4] },
                codeBlock: false,
                link: { openOnClick: false, autolink: true, protocols: ['http', 'https', 'mailto'], defaultProtocol: 'https' },
            }),
            TextStyleKit.configure({ lineHeight: false, fontFamily: false }),
            FonteSigo,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Highlight.configure({ multicolor: true }),
            Subscript, Superscript,
            TableKit.configure({ table: false }),
            TabelaSigo.configure({ resizable: true }),
            ImagemSigo.configure({ allowBase64: true, inline: false }),
            CharacterCount, Placeholder.configure({ placeholder: 'Comece a escrever…' }),
            ParagrafoFormato, QuebraPagina,
            Extension.create({ name: 'atalhosSigo', addKeyboardShortcuts: () => ({ 'Mod-s': () => { salvarRef.current?.(); return true; } }) }),
        ],
        editorProps: { attributes: { 'aria-label': rotulo, role: 'textbox', 'aria-multiline': 'true', spellcheck: 'true', lang: 'pt-BR' } },
        // A normalização inicial (ex.: tabelas) dispara um update que não é edição do usuário.
        onCreate: () => { setTimeout(() => { pronto.current = true; }, 0); },
        onUpdate: ({ editor: ed }) => { if (pronto.current) onChange?.(ed.getJSON()); },
    });

    useEffect(() => { editor?.setEditable(!somenteLeitura); }, [editor, somenteLeitura]);
    const temCab = (config.cabecalho_linhas || []).some(Boolean) || !!config.brasao;
    // Páginas estimadas pela altura do texto (folha A4 no computador); o PDF tem a paginação exata.
    useEffect(() => {
        const folha = folhaRef.current;
        const pm = folha?.querySelector('.ProseMirror');
        if (!pm || !window.matchMedia?.('(min-width: 861px)').matches) return;
        const cm = 21 / folha.offsetWidth;
        const util = 24.7 - (temCab ? 2.2 : 0);
        let ini = 0;
        let total = 0;
        for (const y of [...[...pm.querySelectorAll('div[data-quebra-pagina]')].map((e) => e.offsetTop), pm.scrollHeight]) {
            total += Math.max(1, Math.ceil(((y - ini) * cm) / util));
            ini = y;
        }
        setPaginas(total);
    });
    if (!editor) return null;

    const ch = () => editor.chain().focus();
    const estilo = (() => {
        for (let n = 1; n <= 4; n++) if (editor.isActive('heading', { level: n })) return `h${n}`;
        return editor.isActive('blockquote') ? 'citacao' : 'p';
    })();
    const setEstilo = (v) => {
        if (v === 'citacao') return ch().setParagraph().toggleBlockquote().run();
        const c = editor.isActive('blockquote') ? ch().lift('blockquote') : ch();
        return v === 'p' ? c.setParagraph().run() : c.setHeading({ level: Number(v[1]) }).run();
    };
    const ts = editor.getAttributes('textStyle');
    const bloco = editor.isActive('heading') ? editor.getAttributes('heading') : editor.getAttributes('paragraph');
    const attrBloco = (a) => ch().updateAttributes('paragraph', a).updateAttributes('heading', a).run();
    const recuar = (delta) => {
        if (editor.isActive('listItem')) return delta > 0 ? ch().sinkListItem('listItem').run() : ch().liftListItem('listItem').run();
        const atual = Number(bloco.margemEsq) || 0;
        return attrBloco({ margemEsq: Math.max(0, Math.min(10, atual + delta)) || null });
    };
    const ocorrencias = acharOcorrencias(editor.state.doc, busca.termo, busca.caso);
    const proxima = () => {
        if (!ocorrencias.length) return toast.info('Nada encontrado');
        const de = editor.state.selection.to;
        const m = ocorrencias.find((o) => o.from >= de) || ocorrencias[0];
        editor.chain().focus().setTextSelection(m).scrollIntoView().run();
    };
    const substituir = () => {
        const { from, to } = editor.state.selection;
        const atual = ocorrencias.find((o) => o.from === from && o.to === to);
        if (!atual) return proxima();
        editor.view.dispatch(editor.state.tr.insertText(busca.subst, from, to));
        proxima();
    };
    const substituirTodas = () => {
        let tr = editor.state.tr;
        [...ocorrencias].reverse().forEach((o) => { tr = tr.insertText(busca.subst, o.from, o.to); });
        editor.view.dispatch(tr);
        toast.success(`${ocorrencias.length} substituição(ões)`);
    };
    const inserirImagem = async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try {
            const { src, largura } = await prepararImagem(f);
            ch().setImage({ src, alt: f.name.replace(/\.[^.]+$/, '') }).run();
            ch().updateAttributes('image', { width: Math.min(largura, LARGURA_UTIL_PX) }).run();
        } catch (err) { toast.error(err.message); }
    };
    const abrirArquivo = async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f || !converterArquivo) return;
        setAbrindo(true);
        const aviso = toast.loading(`Abrindo ${f.name}…`);
        try {
            const r = await converterArquivo(f);
            const blocos = r?.conteudo?.content || [];
            if (!blocos.length) throw new Error('O arquivo não tem texto para trazer ao editor');
            // Documento em branco recebe o arquivo inteiro; com texto, entra onde está o cursor.
            if (editor.isEmpty) editor.commands.setContent(r.conteudo, { emitUpdate: true });
            else ch().insertContent(blocos).run();
            (r.avisos || []).forEach((a) => toast.warning(a, { duration: 8000 }));
            toast.success(`${f.name} aberto no editor`, { id: aviso });
        } catch (err) {
            toast.error(err?.message || 'Não foi possível abrir o arquivo', { id: aviso });
        } finally { setAbrindo(false); }
    };
    const aplicarLink = () => {
        const url = link.trim();
        if (!url) return ch().extendMarkRange('link').unsetLink().run();
        if (!/^(https?:\/\/|mailto:)/i.test(url)) return toast.error('Use um endereço que comece com http://, https:// ou mailto:');
        if (editor.state.selection.empty) return ch().insertContent({ type: 'text', text: url, marks: [{ type: 'link', attrs: { href: url } }] }).run();
        return ch().extendMarkRange('link').setLink({ href: url }).run();
    };
    const naTabela = editor.isActive('table');
    const imagemSel = editor.isActive('image');
    const fontePadrao = config.fonte_padrao || 'serif';
    const linhasCab = (config.cabecalho_linhas || []).filter(Boolean);
    const palavras = editor.storage.characterCount.words();
    const caracteres = editor.storage.characterCount.characters();

    return (
        <div className="flex flex-col min-h-0 h-full rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden">
            {!somenteLeitura && (
                <div role="toolbar" aria-label="Formatação do documento" className="bg-slate-50 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 px-1 py-1 flex flex-nowrap sm:flex-wrap items-center gap-0.5 overflow-x-auto">
                    <Botao titulo="Desfazer (Ctrl+Z)" disabled={!editor.can().undo()} onClick={() => ch().undo().run()}><Undo2 className="w-4 h-4" /></Botao>
                    <Botao titulo="Refazer (Ctrl+Y)" disabled={!editor.can().redo()} onClick={() => ch().redo().run()}><Redo2 className="w-4 h-4" /></Botao>
                    {converterArquivo && (
                        <>
                            <Botao titulo="Abrir arquivo do Word, LibreOffice, PDF ou texto no editor" disabled={abrindo} onClick={() => abrirRef.current?.click()}>
                                {abrindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}<span className="text-xs ml-1 hidden lg:inline">Abrir arquivo</span>
                            </Botao>
                            <input ref={abrirRef} type="file" accept=".docx,.odt,.doc,.pdf,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/msword,application/pdf,text/plain"
                                className="sr-only" tabIndex={-1} aria-label="Arquivo para abrir no editor" onChange={abrirArquivo} />
                        </>
                    )}
                    <Sep />
                    <Lista titulo="Estilo do parágrafo" value={estilo} onChange={setEstilo} className="w-32"
                        options={[['p', 'Texto normal'], ['h1', 'Título 1'], ['h2', 'Título 2'], ['h3', 'Título 3'], ['h4', 'Título 4'], ['citacao', 'Citação']]} />
                    <Lista titulo="Fonte" value={ts.fontFamily || ''} className="w-36"
                        onChange={(v) => (v ? ch().setFontFamily(v).run() : ch().unsetFontFamily().run())} options={FONTES} />
                    <Lista titulo="Tamanho da fonte" value={ts.fontSize ? String(parseFloat(ts.fontSize)) : ''} className="w-16"
                        onChange={(v) => (v ? ch().setFontSize(`${v}pt`).run() : ch().unsetFontSize().run())}
                        options={[['', `${config.tamanho_padrao || 12}`], ...TAMANHOS.map((t) => [String(t), String(t)])]} />
                    <Sep />
                    <Botao titulo="Negrito (Ctrl+B)" ativo={editor.isActive('bold')} onClick={() => ch().toggleBold().run()}><Bold className="w-4 h-4" /></Botao>
                    <Botao titulo="Itálico (Ctrl+I)" ativo={editor.isActive('italic')} onClick={() => ch().toggleItalic().run()}><Italic className="w-4 h-4" /></Botao>
                    <Botao titulo="Sublinhado (Ctrl+U)" ativo={editor.isActive('underline')} onClick={() => ch().toggleUnderline().run()}><UnderlineIcon className="w-4 h-4" /></Botao>
                    <Botao titulo="Tachado" ativo={editor.isActive('strike')} onClick={() => ch().toggleStrike().run()}><Strikethrough className="w-4 h-4" /></Botao>
                    <Botao titulo="Sobrescrito" ativo={editor.isActive('superscript')} onClick={() => ch().toggleSuperscript().run()}><SupIcon className="w-4 h-4" /></Botao>
                    <Botao titulo="Subscrito" ativo={editor.isActive('subscript')} onClick={() => ch().toggleSubscript().run()}><SubIcon className="w-4 h-4" /></Botao>
                    <Botao titulo="Código / texto monoespaçado" ativo={editor.isActive('code')} onClick={() => ch().toggleCode().run()}><Code className="w-4 h-4" /></Botao>
                    <Paleta titulo="Cor do texto" icone={<Baseline className="w-4 h-4" />} cor={ts.color} rotuloLimpar="Automática"
                        aoEscolher={(c) => (c ? ch().setColor(c).run() : ch().unsetColor().run())} />
                    <Paleta titulo="Marca-texto" icone={<Highlighter className="w-4 h-4" />} cor={editor.getAttributes('highlight').color} rotuloLimpar="Sem marca-texto"
                        aoEscolher={(c) => (c ? ch().setHighlight({ color: c }).run() : ch().unsetHighlight().run())} />
                    <Sep />
                    <Botao titulo="Alinhar à esquerda" ativo={editor.isActive({ textAlign: 'left' })} onClick={() => ch().setTextAlign('left').run()}><AlignLeft className="w-4 h-4" /></Botao>
                    <Botao titulo="Centralizar" ativo={editor.isActive({ textAlign: 'center' })} onClick={() => ch().setTextAlign('center').run()}><AlignCenter className="w-4 h-4" /></Botao>
                    <Botao titulo="Alinhar à direita" ativo={editor.isActive({ textAlign: 'right' })} onClick={() => ch().setTextAlign('right').run()}><AlignRight className="w-4 h-4" /></Botao>
                    <Botao titulo="Justificar" ativo={editor.isActive({ textAlign: 'justify' })} onClick={() => ch().setTextAlign('justify').run()}><AlignJustify className="w-4 h-4" /></Botao>
                    <Popover>
                        <PopoverTrigger asChild>
                            <button type="button" title="Espaçamento entre linhas e entre parágrafos" aria-label="Espaçamento entre linhas e entre parágrafos" onMouseDown={(e) => e.preventDefault()}
                                className="h-8 px-1.5 shrink-0 inline-flex items-center gap-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm">
                                <ArrowUpDown className="w-4 h-4" /> {virgula(bloco.espacamento || 1.15)}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3 space-y-2" onOpenAutoFocus={(e) => e.preventDefault()}>
                            <p className="text-xs text-slate-600 dark:text-slate-300">Como no Word: vale para o parágrafo onde está o cursor ou para os selecionados.</p>
                            <label className="flex items-center justify-between gap-2 text-sm">Entre linhas
                                <Lista titulo="Espaçamento entre linhas" value={String(bloco.espacamento ?? '')} className="w-24"
                                    onChange={(v) => attrBloco({ espacamento: v ? Number(v) : null })}
                                    options={[['', '1,15 (padrão)'], ...[...new Set([...ESPACAMENTOS, ...(bloco.espacamento ? [bloco.espacamento] : [])])].filter((e) => e !== 1.15).sort((a, b) => a - b).map((e) => [String(e), virgula(e)])]} />
                            </label>
                            <label className="flex items-center justify-between gap-2 text-sm">Antes do parágrafo
                                <Lista titulo="Espaço antes do parágrafo" value={String(bloco.antes ?? '')} className="w-24"
                                    onChange={(v) => attrBloco({ antes: v === '' ? null : Number(v) })}
                                    options={[['', 'Padrão'], ...[...new Set([...ESPACOS_PT, ...(bloco.antes != null ? [bloco.antes] : [])])].sort((a, b) => a - b).map((e) => [String(e), `${virgula(e)} pt`])]} />
                            </label>
                            <label className="flex items-center justify-between gap-2 text-sm">Depois do parágrafo
                                <Lista titulo="Espaço depois do parágrafo" value={String(bloco.depois ?? '')} className="w-24"
                                    onChange={(v) => attrBloco({ depois: v === '' ? null : Number(v) })}
                                    options={[['', 'Padrão (6 pt)'], ...[...new Set([...ESPACOS_PT, ...(bloco.depois != null ? [bloco.depois] : [])])].sort((a, b) => a - b).map((e) => [String(e), `${virgula(e)} pt`])]} />
                            </label>
                        </PopoverContent>
                    </Popover>
                    <Botao titulo="Recuo de primeira linha (1,25 cm)" ativo={!!bloco.recuo} onClick={() => attrBloco({ recuo: bloco.recuo ? null : 1.25 })}><Pilcrow className="w-4 h-4" /></Botao>
                    <Botao titulo="Diminuir recuo" onClick={() => recuar(-1)}><IndentDecrease className="w-4 h-4" /></Botao>
                    <Botao titulo="Aumentar recuo" onClick={() => recuar(1)}><IndentIncrease className="w-4 h-4" /></Botao>
                    <Sep />
                    <Botao titulo="Lista com marcadores" ativo={editor.isActive('bulletList')} onClick={() => ch().toggleBulletList().run()}><List className="w-4 h-4" /></Botao>
                    <Botao titulo="Lista numerada" ativo={editor.isActive('orderedList')} onClick={() => ch().toggleOrderedList().run()}><ListOrdered className="w-4 h-4" /></Botao>
                    <Sep />
                    <Popover onOpenChange={() => setGrade({ l: 0, c: 0 })}>
                        <PopoverTrigger asChild>
                            <button type="button" title="Inserir tabela" aria-label="Inserir tabela" onMouseDown={(e) => e.preventDefault()} className="h-8 min-w-8 px-1.5 shrink-0 inline-flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700"><TableIcon className="w-4 h-4" /></button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
                            <p className="text-xs mb-1 text-slate-600 dark:text-slate-300">{grade.l ? `${grade.l} × ${grade.c}` : 'Escolha linhas × colunas'}</p>
                            <div className="grid grid-cols-8 gap-0.5" onMouseLeave={() => setGrade({ l: 0, c: 0 })}>
                                {Array.from({ length: 64 }, (_, i) => {
                                    const l = Math.floor(i / 8) + 1;
                                    const c = (i % 8) + 1;
                                    return (
                                        <button key={i} type="button" aria-label={`${l} linhas por ${c} colunas`}
                                            onMouseEnter={() => setGrade({ l, c })} onFocus={() => setGrade({ l, c })}
                                            onClick={() => ch().insertTable({ rows: l, cols: c, withHeaderRow: l > 1 }).run()}
                                            className={`h-5 w-5 border ${l <= grade.l && c <= grade.c ? 'bg-indigo-200 border-indigo-500' : 'border-slate-300 dark:border-slate-600'}`} />
                                    );
                                })}
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Botao titulo="Inserir imagem (PNG ou JPG)" onClick={() => arquivoRef.current?.click()}><ImagePlus className="w-4 h-4" /></Botao>
                    <input ref={arquivoRef} type="file" accept="image/png,image/jpeg" className="sr-only" tabIndex={-1} onChange={inserirImagem} />
                    <Popover onOpenChange={(o) => o && setLink(editor.getAttributes('link').href || '')}>
                        <PopoverTrigger asChild>
                            <button type="button" title="Link" aria-label="Link" onMouseDown={(e) => e.preventDefault()} className={`h-8 min-w-8 px-1.5 shrink-0 inline-flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${editor.isActive('link') ? 'bg-indigo-100 dark:bg-indigo-900' : ''}`}><LinkIcon className="w-4 h-4" /></button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-2 space-y-2">
                            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" aria-label="Endereço do link" onKeyDown={(e) => e.key === 'Enter' && aplicarLink()} />
                            <div className="flex gap-2 justify-end">
                                {editor.isActive('link') && <Button size="sm" variant="ghost" onClick={() => ch().extendMarkRange('link').unsetLink().run()}>Remover</Button>}
                                <Button size="sm" onClick={aplicarLink}>Aplicar</Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Botao titulo="Linha horizontal" onClick={() => ch().setHorizontalRule().run()}><Minus className="w-4 h-4" /></Botao>
                    <Botao titulo="Quebra de página (Ctrl+Enter)" onClick={() => ch().insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }]).run()}><SeparatorHorizontal className="w-4 h-4" /></Botao>
                    <Popover>
                        <PopoverTrigger asChild>
                            <button type="button" title="Caracteres especiais" aria-label="Caracteres especiais" onMouseDown={(e) => e.preventDefault()} className="h-8 min-w-8 px-1.5 shrink-0 inline-flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700"><Omega className="w-4 h-4" /></button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
                            <div className="grid grid-cols-8 gap-1">
                                {ESPECIAIS.map((s) => <button key={s} type="button" aria-label={`Inserir ${s}`} onClick={() => ch().insertContent(s).run()} className="h-7 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm">{s}</button>)}
                            </div>
                        </PopoverContent>
                    </Popover>
                    {campos && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <button type="button" title="Inserir campo automático" aria-label="Inserir campo automático" onMouseDown={(e) => e.preventDefault()} className="h-8 px-1.5 shrink-0 inline-flex items-center gap-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-sm"><Braces className="w-4 h-4" /> Campo</button>
                            </PopoverTrigger>
                            <PopoverContent className="w-72 p-1 max-h-80 overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
                                <p className="text-xs px-2 py-1 text-slate-600">Preenchido sozinho quando o modelo for usado num processo.</p>
                                {campos.map(([k, r, grupo], i) => (
                                    <React.Fragment key={k}>
                                        {grupo && grupo !== campos[i - 1]?.[2] && (
                                            <>
                                                <p className="text-xs font-semibold px-2 pt-2 text-slate-700 dark:text-slate-300">{grupo}</p>
                                                {!campos[i - 1]?.[2] && <p className="text-xs px-2 pb-1 text-slate-600">Só entra o que as partes podem ver; o resto fica para preencher à mão.</p>}
                                            </>
                                        )}
                                        <button type="button" onClick={() => ch().insertContent(`{{${k}}}`).run()} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800">{r} <span className="text-xs font-mono text-slate-600 break-all">{`{{${k}}}`}</span></button>
                                    </React.Fragment>
                                ))}
                            </PopoverContent>
                        </Popover>
                    )}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button type="button" title="Localizar e substituir" aria-label="Localizar e substituir" onMouseDown={(e) => e.preventDefault()} className="h-8 min-w-8 px-1.5 shrink-0 inline-flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700"><Search className="w-4 h-4" /></button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-2 space-y-2">
                            <Input value={busca.termo} onChange={(e) => setBusca({ ...busca, termo: e.target.value })} placeholder="Localizar" aria-label="Localizar" onKeyDown={(e) => e.key === 'Enter' && proxima()} />
                            <Input value={busca.subst} onChange={(e) => setBusca({ ...busca, subst: e.target.value })} placeholder="Substituir por" aria-label="Substituir por" />
                            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={busca.caso} onChange={(e) => setBusca({ ...busca, caso: e.target.checked })} /> Diferenciar maiúsculas</label>
                            <p className="text-xs text-slate-600" aria-live="polite">{busca.termo ? `${ocorrencias.length} ocorrência(s)` : ''}</p>
                            <div className="flex flex-wrap gap-1 justify-end">
                                <Button size="sm" variant="outline" disabled={!ocorrencias.length} onClick={proxima}>Próxima</Button>
                                <Button size="sm" variant="outline" disabled={!ocorrencias.length} onClick={substituir}>Substituir</Button>
                                <Button size="sm" disabled={!ocorrencias.length} onClick={substituirTodas}>Todas</Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Botao titulo="Limpar formatação" onClick={() => ch().unsetAllMarks().clearNodes().run()}><RemoveFormatting className="w-4 h-4" /></Botao>
                </div>
            )}
            {!somenteLeitura && (naTabela || imagemSel) && (
                <div role="toolbar" aria-label={naTabela ? 'Tabela' : 'Imagem'} className="bg-indigo-50 dark:bg-indigo-950 border-b border-slate-300 dark:border-slate-700 px-1 py-1 flex flex-nowrap sm:flex-wrap items-center gap-0.5 overflow-x-auto text-sm">
                    {naTabela && (
                        <>
                            <span className="px-2 text-xs font-medium text-indigo-900 dark:text-indigo-100 shrink-0">Tabela</span>
                            <Botao titulo="Linha acima" onClick={() => ch().addRowBefore().run()}><Rows3 className="w-4 h-4" /><span className="text-xs ml-0.5">↑</span></Botao>
                            <Botao titulo="Linha abaixo" onClick={() => ch().addRowAfter().run()}><Rows3 className="w-4 h-4" /><span className="text-xs ml-0.5">↓</span></Botao>
                            <Botao titulo="Coluna à esquerda" onClick={() => ch().addColumnBefore().run()}><Columns3 className="w-4 h-4" /><span className="text-xs ml-0.5">←</span></Botao>
                            <Botao titulo="Coluna à direita" onClick={() => ch().addColumnAfter().run()}><Columns3 className="w-4 h-4" /><span className="text-xs ml-0.5">→</span></Botao>
                            <Botao titulo="Excluir linha" onClick={() => ch().deleteRow().run()}><Rows3 className="w-4 h-4" /><span className="text-xs ml-0.5">✕</span></Botao>
                            <Botao titulo="Excluir coluna" onClick={() => ch().deleteColumn().run()}><Columns3 className="w-4 h-4" /><span className="text-xs ml-0.5">✕</span></Botao>
                            <Botao titulo="Mesclar células" disabled={!editor.can().mergeCells()} onClick={() => ch().mergeCells().run()}><TableCellsMerge className="w-4 h-4" /></Botao>
                            <Botao titulo="Dividir célula" disabled={!editor.can().splitCell()} onClick={() => ch().splitCell().run()}><TableCellsSplit className="w-4 h-4" /></Botao>
                            <Botao titulo="Linha de cabeçalho" onClick={() => ch().toggleHeaderRow().run()}><span className="text-xs font-semibold">Cab.</span></Botao>
                            <Botao titulo="Tabela sem bordas (as linhas tracejadas só aparecem no editor)" ativo={!!editor.getAttributes('table').semBordas}
                                onClick={() => ch().updateAttributes('table', { semBordas: editor.getAttributes('table').semBordas ? null : true }).run()}><Square className="w-4 h-4" strokeDasharray="3 3" /></Botao>
                            <Botao titulo="Excluir tabela" onClick={() => ch().deleteTable().run()}><Trash2 className="w-4 h-4" /></Botao>
                        </>
                    )}
                    {imagemSel && (
                        <>
                            <span className="px-2 text-xs font-medium text-indigo-900 dark:text-indigo-100 shrink-0">Largura da imagem</span>
                            {[25, 50, 75, 100].map((pct) => (
                                <Botao key={pct} titulo={`${pct}% da largura`} onClick={() => ch().updateAttributes('image', { width: Math.round(LARGURA_UTIL_PX * pct / 100) }).run()}><span className="text-xs">{pct}%</span></Botao>
                            ))}
                            <Sep />
                            {[['left', 'Imagem à esquerda', AlignLeft], ['center', 'Imagem centralizada', AlignCenter], ['right', 'Imagem à direita', AlignRight]].map(([a, t, Icone]) => (
                                <Botao key={a} titulo={t} ativo={(editor.getAttributes('image').align || 'left') === a}
                                    onClick={() => ch().updateAttributes('image', { align: a === 'left' ? null : a }).run()}><Icone className="w-4 h-4" /></Botao>
                            ))}
                            <Botao titulo="Remover imagem" onClick={() => ch().deleteSelection().run()}><Trash2 className="w-4 h-4" /></Botao>
                        </>
                    )}
                </div>
            )}
            <div className="doc-mesa flex-1 min-h-0 overflow-auto py-4 sm:py-6 px-0 sm:px-4">
                <div ref={folhaRef} className="doc-folha" style={{ zoom: Number(zoom), fontFamily: CSS_FONTE[fontePadrao] || CSS_FONTE.serif, fontSize: `${config.tamanho_padrao || 12}pt`, lineHeight: alturaLinha(1.15) }}>
                    {(linhasCab.length > 0 || config.brasao) && (
                        <div className="text-center mb-6 select-none" aria-hidden style={{ fontFamily: CSS_FONTE[fontePadrao] }}>
                            {config.brasao && <img src={config.brasao} alt="" className="mx-auto h-12 w-auto mb-1" />}
                            {linhasCab.map((l, i) => <p key={i} className={i === 0 ? 'font-bold text-[11pt]' : 'text-[9pt]'}>{l}</p>)}
                        </div>
                    )}
                    <EditorContent editor={editor} />
                </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700 px-3 py-1 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                <span aria-live="polite">{palavras} palavra{palavras === 1 ? '' : 's'} · {caracteres} caractere{caracteres === 1 ? '' : 's'}</span>
                <span className="hidden md:inline" title="Estimativa pela altura do texto; o PDF mostra a paginação exata">≈ {paginas} página{paginas === 1 ? '' : 's'}</span>
                <span className="ml-auto hidden sm:inline">A4 · margens de 3 cm e 2 cm</span>
                <label className="flex items-center gap-1">Zoom
                    <select aria-label="Zoom" value={zoom} onChange={(e) => setZoom(e.target.value)} className="h-6 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">
                        {['0.75', '1', '1.25', '1.5'].map((z) => <option key={z} value={z}>{Math.round(Number(z) * 100)}%</option>)}
                    </select>
                </label>
            </div>
        </div>
    );
}

/** Troca {{campo}} pelos valores do processo em todo o documento (modelos). */
export function preencherCampos(doc, valores) {
    const troca = (t) => t.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (m, k) => (valores[k] !== undefined && valores[k] !== null ? String(valores[k]) : m));
    const andar = (n) => (n.type === 'text' ? { ...n, text: troca(n.text) } : n.content ? { ...n, content: n.content.map(andar) } : n);
    return andar(doc);
}

export const CAMPOS_MODELO = [
    ['numero', 'Número do processo'], ['assunto', 'Assunto'], ['tipo_processo', 'Tipo de processo'], ['partes', 'Partes'],
    ['unidade', 'Unidade atual'], ['fase', 'Fase atual'], ['orgao', 'Nome do órgão'], ['usuario', 'Seu nome'],
    ['data', 'Data de hoje'], ['data_extenso', 'Data por extenso'],
    ['partes_requerente', 'Requerentes'], ['partes_requerido', 'Requeridos'], ['partes_interessado', 'Interessados'], ['partes_terceiro', 'Terceiros'],
];
