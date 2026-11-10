import * as mammoth from 'mammoth';
import JSZip = require('jszip');
import { pathToFileURL } from 'url';
import { No, sanitizeDoc } from '../shared/documento';
import { MIME_DOCX, htmlParaDoc } from './conversao';
import { MAX_BRASAO } from './documentoConfig';

/**
 * Importação de modelos de documento (sem IA, por leitura estruturada):
 * - Word (DOCX): corpo pelo mammoth (com imagens), cabeçalho e rodapé lidos do
 *   XML do pacote (texto e primeira imagem como brasão), fonte e tamanho padrão.
 * - PDF: texto por linha (pdfjs), com cabeçalho e rodapé tirados das faixas de
 *   cima e de baixo da primeira página. Imagens do PDF não são extraídas.
 * - HTML e TXT: corpo.
 * Campos como {{numero}}, «Número», <<data>> ou [NÚMERO DO PROCESSO] viram os
 * campos automáticos do editor quando o nome é conhecido.
 * O modelo também pode ficar no arquivo original (DOCX ou PDF); o DOCX sai
 * preenchido com os dados do processo por `preencherDocx`.
 */

export const MIME_PDF = 'application/pdf';
export const MIMES_MODELO: Record<string, string> = {
    [MIME_DOCX]: 'docx', [MIME_PDF]: 'pdf', 'text/html': 'html', 'text/plain': 'txt',
};
export const MIMES_ORIGINAL = [MIME_DOCX, MIME_PDF];
export const MAX_MODELO_BYTES = 5 * 1024 * 1024;

export interface Timbrado { cabecalho_linhas: string[]; brasao: string | null; rodape: string; fonte_padrao?: string; tamanho_padrao?: number }
export interface Interpretacao { conteudo: No; timbrado: Timbrado | null; campos: string[]; desconhecidos: string[]; avisos: string[] }

// ---------- campos ----------

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const APELIDOS: Record<string, string> = {};
for (const [chave, nomes] of Object.entries({
    numero: ['numero', 'n', 'no', 'num', 'numero_processo', 'numero_do_processo', 'processo', 'n_processo', 'n_do_processo', 'autos', 'numero_dos_autos'],
    assunto: ['assunto', 'objeto', 'assunto_do_processo'],
    tipo_processo: ['tipo', 'tipo_processo', 'tipo_de_processo', 'classe', 'classe_processual'],
    partes: ['partes', 'parte', 'interessado', 'interessados', 'requerente', 'requerentes', 'nome_da_parte'],
    unidade: ['unidade', 'setor', 'unidade_atual', 'secretaria', 'gabinete', 'lotacao'],
    fase: ['fase', 'fase_atual', 'etapa'],
    orgao: ['orgao', 'instituicao', 'nome_do_orgao', 'entidade'],
    usuario: ['usuario', 'seu_nome', 'nome_usuario', 'servidor', 'signatario', 'assinante', 'responsavel', 'nome_do_servidor'],
    data: ['data', 'data_atual', 'hoje', 'data_de_hoje'],
    data_extenso: ['data_extenso', 'data_por_extenso', 'data_extensa'],
})) for (const n of nomes) APELIDOS[n] = chave;

/** Chave do campo automático para um nome de campo do arquivo, ou null. */
export const campoConhecido = (nome: string): string | null => APELIDOS[sem(nome)] || null;

// {{x}} ${x} «x» <<x>> e [X] (este só com nome conhecido, para não pegar citações).
const RE_CAMPO = /\{\{\s*([^{}]{1,60}?)\s*\}\}|\$\{\s*([^{}]{1,60}?)\s*\}|«\s*([^«»]{1,60}?)\s*»|<<\s*([^<>]{1,60}?)\s*>>|\[\s*([^[\]]{1,60}?)\s*\]/g;

/** Troca as variantes de campo pelo formato {{chave}} do editor. */
export function normalizarCampos(t: string, achados: Set<string>, desconhecidos: Set<string>): string {
    return t.replace(RE_CAMPO, (m, a, b, c, d, e) => {
        const nome = a ?? b ?? c ?? d ?? e;
        const chave = campoConhecido(nome);
        if (chave) { achados.add(chave); return `{{${chave}}}`; }
        if (e !== undefined) return m; // [texto] qualquer fica como está
        const k = sem(nome);
        if (!k) return m;
        desconhecidos.add(nome.trim());
        return `{{${k}}}`;
    });
}

function camposNoDoc(doc: No, achados: Set<string>, desconhecidos: Set<string>): No {
    const andar = (n: No): No => (n.type === 'text' && typeof n.text === 'string'
        ? { ...n, text: normalizarCampos(n.text, achados, desconhecidos) }
        : Array.isArray(n.content) ? { ...n, content: n.content.map(andar) } : n);
    return andar(doc);
}

// ---------- DOCX ----------

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const desXml = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);|&#(\d+);|&#x([0-9a-f]+);/gi, (_m, n, d, h) => (n ? ENT[n] : String.fromCodePoint(d ? Number(d) : parseInt(h, 16))));
const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Linhas de texto dos parágrafos de um XML do Word (cabeçalho ou rodapé). */
export function linhasXml(xml: string): string[] {
    return (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map((p) => desXml(
        (p.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>|<w:tab\/>/g) || []).map((t) => (t === '<w:tab/>' ? ' ' : t.replace(/<[^>]+>/g, ''))).join(''),
    ).replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const ehNumeroPagina = (l: string) => /^(p[aá]g(ina)?\.?\s*)?\d+(\s*(de|\/)\s*\d+)?$/i.test(l);

function relacoes(xml: string | undefined): Record<string, string> {
    const out: Record<string, string> = {};
    for (const m of (xml || '').matchAll(/<Relationship\b[^>]*>/g)) {
        const id = /Id="([^"]+)"/.exec(m[0])?.[1];
        const alvo = /Target="([^"]+)"/.exec(m[0])?.[1];
        if (id && alvo) out[id] = alvo;
    }
    return out;
}

const caminho = (base: string, alvo: string) => (alvo.startsWith('/') ? alvo.slice(1) : `${base}/${alvo}`).replace(/[^/]+\/\.\.\//g, '');

async function parteDocx(zip: JSZip, docXml: string, rels: Record<string, string>, tipo: 'header' | 'footer') {
    const sect = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g)?.pop() || '';
    const ref = new RegExp(`<w:${tipo}Reference[^>]*w:type="(default|first)"[^>]*r:id="([^"]+)"|<w:${tipo}Reference[^>]*r:id="([^"]+)"[^>]*w:type="(default|first)"`, 'g');
    const ids: Array<{ tipo: string; id: string }> = [];
    for (const m of sect.matchAll(ref)) ids.push({ tipo: m[1] || m[4], id: m[2] || m[3] });
    ids.sort((a, b) => (a.tipo === 'default' ? -1 : 1) - (b.tipo === 'default' ? -1 : 1));
    const nomes = ids.map((x) => rels[x.id]).filter(Boolean).map((t) => caminho('word', t));
    const arquivo = nomes.find((n) => zip.file(n)) || Object.keys(zip.files).find((n) => new RegExp(`^word/${tipo}\\d*\\.xml$`).test(n));
    if (!arquivo) return null;
    const xml = await zip.file(arquivo)!.async('string');
    return { arquivo, xml };
}

async function imagemDaParte(zip: JSZip, arquivo: string, xml: string): Promise<string | null> {
    const relsArq = arquivo.replace(/^word\/(.+)$/, 'word/_rels/$1.rels');
    const rels = relacoes(await zip.file(relsArq)?.async('string'));
    for (const m of xml.matchAll(/r:embed="([^"]+)"/g)) {
        const alvo = rels[m[1]];
        if (!alvo) continue;
        const nome = caminho('word', alvo);
        const ext = nome.split('.').pop()?.toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : null;
        const f = zip.file(nome);
        if (!mime || !f) continue;
        const buf = await f.async('nodebuffer');
        if (buf.length <= MAX_BRASAO) return `data:${mime};base64,${buf.toString('base64')}`;
    }
    return null;
}

async function timbradoDocx(buf: Buffer, avisos: string[]): Promise<Timbrado | null> {
    const zip = await JSZip.loadAsync(buf);
    const docXml = await zip.file('word/document.xml')?.async('string');
    if (!docXml) return null;
    const rels = relacoes(await zip.file('word/_rels/document.xml.rels')?.async('string'));
    const cab = await parteDocx(zip, docXml, rels, 'header');
    const rod = await parteDocx(zip, docXml, rels, 'footer');
    const linhas = cab ? linhasXml(cab.xml).filter((l) => !ehNumeroPagina(l)) : [];
    const brasao = cab ? await imagemDaParte(zip, cab.arquivo, cab.xml) : null;
    if (cab && !brasao && /r:embed=/.test(cab.xml)) avisos.push('A imagem do cabeçalho não é PNG/JPG ou passa de 300 KB; envie o brasão à parte.');
    if (linhas.length > 4) avisos.push(`O cabeçalho tem ${linhas.length} linhas; ficaram as 4 primeiras.`);
    const rodape = rod ? linhasXml(rod.xml).filter((l) => !ehNumeroPagina(l)).join(' · ').slice(0, 200) : '';
    // Fonte e tamanho padrão do documento (docDefaults ou estilo Normal).
    const estilos = (await zip.file('word/styles.xml')?.async('string')) || '';
    const fonte = /<w:rFonts[^>]*w:ascii="([^"]+)"/.exec(estilos)?.[1] || '';
    const sz = Number(/<w:sz w:val="(\d+)"/.exec(estilos)?.[1]) / 2;
    const fonte_padrao = /courier|mono|consol/i.test(fonte) ? 'monospace' : /arial|helvetica|calibri|roboto|verdana|segoe|tahoma|aptos|open sans|liberation sans/i.test(fonte) ? 'sans-serif' : fonte ? 'serif' : undefined;
    if (!linhas.length && !brasao && !rodape) return fonte_padrao ? { cabecalho_linhas: [], brasao: null, rodape: '', fonte_padrao, ...(sz >= 9 && sz <= 16 ? { tamanho_padrao: sz } : {}) } : null;
    return { cabecalho_linhas: linhas.slice(0, 4), brasao, rodape, ...(fonte_padrao ? { fonte_padrao } : {}), ...(sz >= 9 && sz <= 16 ? { tamanho_padrao: sz } : {}) };
}

/**
 * DOCX com os campos preenchidos. Tolera o Word ter quebrado o campo em vários
 * trechos de formatação ({{ nu</w:t></w:r><w:r><w:t>mero }}): as marcações
 * entre as chaves somem e o valor fica com a formatação do primeiro trecho.
 */
export async function preencherDocx(buf: Buffer, valores: Record<string, string>): Promise<Buffer> {
    const zip = await JSZip.loadAsync(buf);
    const tags = '(?:<[^>]+>)*';
    const re = new RegExp(
        `\\{${tags}\\{((?:<[^>]+>|[^<{}])*?)\\}${tags}\\}`
        + `|«((?:<[^>]+>|[^<«»])*?)»`
        + `|&lt;${tags}&lt;((?:<[^>]+>|[^<]){1,400}?)&gt;${tags}&gt;`
        + `|\\$${tags}\\{((?:<[^>]+>|[^<{}])*?)\\}`, 'g');
    for (const nome of Object.keys(zip.files).filter((n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n))) {
        const xml = await zip.file(nome)!.async('string');
        const novo = xml.replace(re, (m, a, b, c, d) => {
            const dentro = (a ?? b ?? c ?? d ?? '') as string;
            if (/<\/w:p>/.test(dentro)) return m;
            const nomeCampo = desXml(dentro.replace(/<[^>]+>/g, ''));
            const chave = campoConhecido(nomeCampo) || sem(nomeCampo);
            const v = valores[chave];
            return v === undefined || v === null ? m : escXml(String(v));
        });
        if (novo !== xml) zip.file(nome, novo);
    }
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ---------- PDF ----------

type Linha = { y: number; x: number; texto: string; altura: number };

async function linhasPdf(buf: Buffer): Promise<{ paginas: Linha[][]; alturaPagina: number }> {
    // pdfjs é ESM; o import dinâmico fica fora do alcance do tsc (CommonJS).
    const pdfjs = await (new Function('m', 'return import(m)') as (m: string) => Promise<any>)(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise;
    const paginas: Linha[][] = [];
    let alturaPagina = 842;
    for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
        const pg = await doc.getPage(i);
        if (i === 1) alturaPagina = pg.getViewport({ scale: 1 }).height;
        const itens = (await pg.getTextContent()).items as Array<{ str: string; transform: number[]; height: number; width: number }>;
        const porY = new Map<number, Array<{ x: number; w: number; s: string; h: number }>>();
        for (const it of itens) {
            if (!it.str) continue;
            const y = Math.round(it.transform[5]);
            const chave = [...porY.keys()].find((k) => Math.abs(k - y) <= 2) ?? y;
            porY.set(chave, [...(porY.get(chave) || []), { x: it.transform[4], w: it.width || 0, s: it.str, h: it.height || Math.abs(it.transform[3]) }]);
        }
        paginas.push([...porY.entries()].sort((a, b) => b[0] - a[0]).map(([y, ps]) => {
            ps.sort((a, b) => a.x - b.x);
            // Pedaços separados por um vão visível ganham espaço ("2." + "Nome" → "2. Nome").
            const texto = ps.reduce((acc, p, i) => {
                const ant = ps[i - 1];
                const vao = ant ? p.x - (ant.x + ant.w) : 0;
                return acc + (ant && vao > Math.max(1, p.h * 0.15) && !/\s$/.test(acc) && !/^\s/.test(p.s) ? ' ' : '') + p.s;
            }, '');
            return { y, x: ps[0].x, texto: texto.replace(/\s+/g, ' ').trim(), altura: Math.max(...ps.map((p) => p.h)) };
        }).filter((l) => l.texto));
    }
    await doc.destroy();
    return { paginas, alturaPagina };
}

async function interpretarPdf(buf: Buffer, avisos: string[]): Promise<{ doc: No; timbrado: Timbrado | null }> {
    const { paginas, alturaPagina } = await linhasPdf(buf);
    if (!paginas.some((p) => p.length)) throw new Error('O PDF não tem texto selecionável (é imagem digitalizada); mantenha-o como arquivo original.');
    const topo = alturaPagina * 0.88;
    const base = alturaPagina * 0.08;
    // Cabeçalho e rodapé: faixas de cima e de baixo; com mais de uma página,
    // só o que se repete nelas (o primeiro texto do corpo não vira cabeçalho).
    const repetidas = (faixa: (l: Linha) => boolean) => {
        const conj = paginas.map((p) => new Set(p.filter(faixa).map((l) => l.texto)));
        return paginas[0].filter(faixa).map((l) => l.texto).filter((t) => conj.length < 2 || conj.slice(1).every((s) => s.has(t) || ehNumeroPagina(t)));
    };
    const cab = repetidas((l) => l.y >= topo).filter((t) => !ehNumeroPagina(t));
    const rod = repetidas((l) => l.y <= base).filter((t) => !ehNumeroPagina(t));
    const corpo = paginas.map((p) => p.filter((l) => !(l.y >= topo && cab.includes(l.texto)) && !(l.y <= base && (rod.includes(l.texto) || ehNumeroPagina(l.texto)))));
    // Parágrafos: linhas seguidas se juntam; espaço maior que o normal separa.
    const blocos: No[] = [];
    for (const linhas of corpo) {
        const passos = linhas.slice(1).map((l, i) => linhas[i].y - l.y).filter((d) => d > 0).sort((a, b) => a - b);
        const normal = passos[Math.floor(passos.length / 2)] || 14;
        let atual: string[] = [];
        const fechar = () => { if (atual.length) blocos.push({ type: 'paragraph', content: [{ type: 'text', text: atual.join(' ') }] }); atual = []; };
        linhas.forEach((l, i) => {
            if (i > 0 && linhas[i - 1].y - l.y > normal * 1.4) fechar();
            atual.push(l.texto);
            if (/[.:;!?]$/.test(l.texto) && l.texto.length < 60) fechar();
        });
        fechar();
    }
    avisos.push('PDF: o texto foi lido por linha; negrito, tabelas e imagens do PDF não vêm. Confira a formatação ou mantenha o PDF original.');
    const timbrado = cab.length || rod.length ? { cabecalho_linhas: cab.slice(0, 4), brasao: null, rodape: rod.join(' · ').slice(0, 200) } : null;
    return { doc: { type: 'doc', content: blocos.length ? blocos : [{ type: 'paragraph' }] }, timbrado };
}

/**
 * Texto de um PDF, uma linha por linha visual e página separada por linha
 * vazia. Cabeçalho e rodapé que se repetem nas páginas (data de impressão,
 * endereço, "1/8") e números de página saem, para não virarem orientação.
 */
export async function textoDePdf(buf: Buffer): Promise<string> {
    const { paginas, alturaPagina } = await linhasPdf(buf);
    const borda = (l: Linha) => l.y >= alturaPagina * 0.9 || l.y <= alturaPagina * 0.1;
    const semNumeros = (t: string) => t.replace(/\d+/g, '#');
    const vezes = new Map<string, number>();
    for (const p of paginas) for (const t of new Set(p.filter(borda).map((l) => semNumeros(l.texto)))) vezes.set(t, (vezes.get(t) || 0) + 1);
    const repete = (l: Linha) => borda(l) && (ehNumeroPagina(l.texto) || (paginas.length > 1 && (vezes.get(semNumeros(l.texto)) || 0) >= 2));
    return paginas.map((p) => p.filter((l) => !repete(l)).map((l) => l.texto).join('\n')).join('\n\n');
}

export const MIME_BIZAGI = 'application/x-bizagi-bpm';
const MAX_DIAGRAMAS = 40;
const MAX_XML_TOTAL = 6 * 1024 * 1024;

/**
 * Diagramas de um pacote do Bizagi Modeler (.bpm). O .bpm é um ZIP; dentro,
 * cada diagrama (página) costuma ser outro ZIP (.diag) com um Diagram.xml em
 * XPDL. Abre os ZIPs aninhados (até 3 níveis) e devolve os XML que parecem
 * BPMN ou XPDL, na ordem do pacote. Limites contra arquivo malicioso: número
 * de entradas e tamanho total descompactado.
 */
export async function diagramasDoPacote(buf: Buffer): Promise<Array<{ nome: string; xml: string }>> {
    const out: Array<{ nome: string; xml: string }> = [];
    let total = 0;
    let entradas = 0;
    const abrir = async (b: Buffer, prefixo: string, nivel: number) => {
        let zip: JSZip;
        try { zip = await JSZip.loadAsync(b); } catch {
            if (nivel === 0) throw new Error('O arquivo do Bizagi (.bpm) não pôde ser aberto. Exporte o diagrama em BPMN ou XPDL e envie esse arquivo.');
            return;
        }
        for (const f of Object.values(zip.files)) {
            if (f.dir || ++entradas > 500 || out.length >= MAX_DIAGRAMAS) continue;
            const nome = prefixo + f.name;
            if (/\.(diag|bpm|zip)$/i.test(f.name)) { if (nivel < 3) await abrir(await f.async('nodebuffer'), `${nome}/`, nivel + 1); continue; }
            if (!/\.(xml|bpmn|xpdl)$/i.test(f.name)) continue;
            const conteudo = await f.async('nodebuffer');
            if (total + conteudo.length > MAX_XML_TOTAL) throw new Error('O pacote do Bizagi é grande demais (mais de 6 MB de diagramas).');
            const xml = conteudo.toString('utf8').replace(/^﻿/, '');
            if (!/<(\w+:)?(definitions|Package|WorkflowProcess)\b/.test(xml)) continue;
            total += conteudo.length;
            out.push({ nome, xml });
        }
    };
    await abrir(buf, '', 0);
    if (!out.length) throw new Error('Não achei diagramas no arquivo do Bizagi. No Bizagi Modeler, use Exportar > BPMN ou XPDL e envie o arquivo gerado.');
    return out;
}

/**
 * Texto e tabelas de um arquivo que descreve um rito (Word, PDF ou TXT), ou os
 * diagramas de um pacote do Bizagi (.bpm), para
 * a leitura de fases no navegador (src/lib/propostaRito.js).
 */
export async function textoParaRito(buf: Buffer, mime: string): Promise<{ texto: string; tabelas: string[][][]; diagramas?: Array<{ nome: string; xml: string }> }> {
    if (mime === MIME_DOCX) {
        const [raw, html] = await Promise.all([mammoth.extractRawText({ buffer: buf }), mammoth.convertToHtml({ buffer: buf })]);
        const tabelas = (html.value.match(/<table[\s\S]*?<\/table>/g) || []).slice(0, 10).map((t) =>
            (t.match(/<tr[\s\S]*?<\/tr>/g) || []).slice(0, 200).map((tr) =>
                (tr.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/g) || []).slice(0, 20).map((c) =>
                    desXml(c.replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '')).replace(/[ \t]+/g, ' ').trim())));
        return { texto: raw.value, tabelas };
    }
    if (mime === MIME_PDF) {
        const texto = await textoDePdf(buf);
        if (!texto.trim()) throw new Error('O PDF não tem texto selecionável (parece imagem digitalizada). Envie o Word, a planilha ou o diagrama original, ou um PDF salvo pelo editor de texto.');
        return { texto, tabelas: [] };
    }
    if (mime === MIME_BIZAGI) return { texto: '', tabelas: [], diagramas: await diagramasDoPacote(buf) };
    return { texto: buf.toString('utf8'), tabelas: [] };
}

// ---------- entrada ----------

export async function interpretarModelo(buf: Buffer, mime: string): Promise<Interpretacao> {
    const formato = MIMES_MODELO[mime];
    if (!formato) throw new Error('Formato não aceito para modelo (use Word .docx, PDF, HTML ou TXT)');
    if (!buf.length) throw new Error('Arquivo vazio');
    if (buf.length > MAX_MODELO_BYTES) throw new Error('Arquivo acima de 5 MB');
    const avisos: string[] = [];
    let doc: No;
    let timbrado: Timbrado | null = null;
    if (formato === 'docx') {
        const r = await mammoth.convertToHtml({ buffer: buf });
        doc = htmlParaDoc(r.value);
        try { timbrado = await timbradoDocx(buf, avisos); } catch { avisos.push('Não deu para ler o cabeçalho e o rodapé do Word.'); }
        avisos.push('Word: alinhamentos, recuos e cores podem precisar de ajuste no editor.');
    } else if (formato === 'pdf') {
        ({ doc, timbrado } = await interpretarPdf(buf, avisos));
    } else if (formato === 'html') {
        doc = htmlParaDoc(buf.toString('utf8').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ''));
    } else {
        const paras = buf.toString('utf8').replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
        doc = { type: 'doc', content: paras.length ? paras.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })) : [{ type: 'paragraph' }] };
    }
    const achados = new Set<string>();
    const desconhecidos = new Set<string>();
    const conteudo = sanitizeDoc(camposNoDoc(doc, achados, desconhecidos));
    if (timbrado) {
        const ach = new Set<string>();
        timbrado.cabecalho_linhas = timbrado.cabecalho_linhas.map((l) => normalizarCampos(l, ach, new Set()));
    }
    if (desconhecidos.size) avisos.push(`Campos sem correspondência (ficam como texto para preencher à mão): ${[...desconhecidos].slice(0, 10).join(', ')}.`);
    return { conteudo, timbrado, campos: [...achados], desconhecidos: [...desconhecidos], avisos };
}
