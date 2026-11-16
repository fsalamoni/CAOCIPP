import type JSZip = require('jszip');
// Bibliotecas carregadas só quando usadas (partida a frio das functions).
const jszip = () => require('jszip') as typeof import('jszip');
import { Marca, No, fonteEquivalente, sanitizeDoc } from '../shared/documento';
import { ImagensDoc, Item, agruparListas, filhos, filho, ligado, novoOrcamento, xml } from './conversaoComum';

/**
 * Word (.docx) → documento do editor, lendo o próprio XML do arquivo para
 * manter o que o mammoth descartava: fonte, tamanho, cor, marca-texto,
 * alinhamento, recuos, espaço antes e depois, entrelinha, listas (com a
 * numeração do Word), tabelas com células mescladas e larguras, bordas,
 * imagens (com tamanho e alinhamento), links, quebras de página, notas de
 * rodapé e caixas de texto. Estilos do documento (Normal, Título 1, estilo
 * de tabela) e fontes do tema entram na conta, como no Word. Alterações
 * controladas são aceitas (o inserido entra, o excluído sai).
 *
 * Não vêm (o editor não tem): cabeçalho e rodapé do arquivo (a minuta usa o
 * timbrado da unidade), paradas de tabulação, colunas de texto, formas e
 * comentários.
 */

const TWIP_CM = 567;
const LARGURA_UTIL_PX = 605;
const MAX_LINHAS_TABELA = 400;
const MAX_COLUNAS = 30;

type PProps = {
    jc?: string; esq?: number; primeira?: number; deslocada?: number; antes?: number; depois?: number;
    linha?: number; regra?: string; numId?: string; ilvl?: number; nivelTitulo?: number; quebraAntes?: boolean; contextual?: boolean;
};
type RProps = {
    b?: boolean; i?: boolean; u?: boolean; strike?: boolean; vert?: string; cor?: string; realce?: string; fundo?: string;
    sz?: number; fonte?: string; caps?: boolean; oculto?: boolean;
};
type Estilo = { tipo: string; base?: string; nome: string; p: PProps; r: RProps; tblBordas?: boolean | null; padrao: boolean };
type Nivel = { formato: string; texto: string; inicio: number; p: PProps };

const definidos = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
const mesclar = <T extends object>(...ps: Array<Partial<T> | undefined>): T => Object.assign({}, ...ps.map((p) => definidos(p || {}))) as T;
const n = (v: string | null | undefined) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));

const REALCE: Record<string, string> = {
    yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000', darkBlue: '#000080',
    darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000', darkYellow: '#808000', darkGray: '#808080',
    lightGray: '#c0c0c0', black: '#000000',
};

function lerPPr(el: Element | null): PProps {
    if (!el) return {};
    const ind = filho(el, 'w:ind');
    const sp = filho(el, 'w:spacing');
    const num = filho(el, 'w:numPr');
    const ol = filho(el, 'w:outlineLvl');
    return definidos({
        jc: filho(el, 'w:jc')?.getAttribute('w:val') || undefined,
        esq: n(ind?.getAttribute('w:left') ?? ind?.getAttribute('w:start')),
        primeira: n(ind?.getAttribute('w:firstLine')),
        deslocada: n(ind?.getAttribute('w:hanging')),
        antes: sp?.getAttribute('w:beforeAutospacing') === '1' ? 14 * 20 : n(sp?.getAttribute('w:before')),
        depois: sp?.getAttribute('w:afterAutospacing') === '1' ? 14 * 20 : n(sp?.getAttribute('w:after')),
        linha: n(sp?.getAttribute('w:line')),
        regra: sp?.getAttribute('w:lineRule') || undefined,
        numId: num ? filho(num, 'w:numId')?.getAttribute('w:val') || undefined : undefined,
        ilvl: num ? n(filho(num, 'w:ilvl')?.getAttribute('w:val')) : undefined,
        nivelTitulo: n(ol?.getAttribute('w:val')),
        quebraAntes: ligado(filho(el, 'w:pageBreakBefore')),
        contextual: ligado(filho(el, 'w:contextualSpacing')),
    });
}

function lerRPr(el: Element | null, tema: Record<string, string>): RProps {
    if (!el) return {};
    const u = filho(el, 'w:u')?.getAttribute('w:val');
    const cor = filho(el, 'w:color')?.getAttribute('w:val');
    const shd = filho(el, 'w:shd')?.getAttribute('w:fill');
    const f = filho(el, 'w:rFonts');
    const fonte = f ? (f.getAttribute('w:ascii') || f.getAttribute('w:hAnsi') || tema[f.getAttribute('w:asciiTheme') || f.getAttribute('w:hAnsiTheme') || ''] || undefined) : undefined;
    const strike = ligado(filho(el, 'w:strike'));
    const dstrike = ligado(filho(el, 'w:dstrike'));
    return definidos({
        b: ligado(filho(el, 'w:b')),
        i: ligado(filho(el, 'w:i')),
        u: u === undefined || u === null ? (filho(el, 'w:u') ? true : undefined) : u !== 'none',
        strike: strike === undefined && dstrike === undefined ? undefined : !!(strike || dstrike),
        vert: filho(el, 'w:vertAlign')?.getAttribute('w:val') || undefined,
        cor: cor && /^[0-9a-f]{6}$/i.test(cor) ? `#${cor.toLowerCase()}` : cor === 'auto' ? '' : undefined,
        realce: filho(el, 'w:highlight')?.getAttribute('w:val') || undefined,
        fundo: shd && /^[0-9a-f]{6}$/i.test(shd) ? `#${shd.toLowerCase()}` : shd === 'auto' ? '' : undefined,
        sz: n(filho(el, 'w:sz')?.getAttribute('w:val')),
        fonte,
        caps: ligado(filho(el, 'w:caps')),
        oculto: ligado(filho(el, 'w:vanish')),
    });
}

function bordasDaTabela(tblPr: Element | null): boolean | null {
    const b = tblPr ? filho(tblPr, 'w:tblBorders') : null;
    if (!b) return null;
    return filhos(b).some((x) => !['nil', 'none'].includes(String(x.getAttribute('w:val'))));
}

/** Formata o número de um nível de lista (decimal, letra, romano). */
export function formatarNumero(v: number, formato: string): string {
    if (formato === 'lowerLetter' || formato === 'upperLetter') {
        let s = '';
        let x = v;
        while (x > 0) { x--; s = String.fromCharCode(97 + (x % 26)) + s; x = Math.floor(x / 26); }
        return formato === 'upperLetter' ? s.toUpperCase() : s;
    }
    if (formato === 'lowerRoman' || formato === 'upperRoman') {
        const tab: Array<[number, string]> = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
        let s = '';
        let x = v;
        for (const [k, r] of tab) while (x >= k) { s += r; x -= k; }
        return formato === 'upperRoman' ? s.toUpperCase() : s;
    }
    if (formato === 'ordinal') return `${v}º`;
    if (formato === 'decimalZero') return v < 10 ? `0${v}` : String(v);
    return String(v);
}


class Leitor {
    estilos: Record<string, Estilo> = {};
    padraoP: PProps = {};
    padraoR: RProps = {};
    estiloParagrafo = '';
    tema: Record<string, string> = {};
    rels: Record<string, { alvo: string; externo: boolean }> = {};
    niveis: Record<string, Record<number, Nivel>> = {};
    contadores: Record<string, number[]> = {};
    notas: Record<string, Element> = {};
    notasUsadas: Array<{ n: number; el: Element }> = [];
    avisos = new Set<string>();
    imagens: ImagensDoc;

    constructor(private zip: JSZip) { this.imagens = novoOrcamento(); }

    async carregar() {
        const ler = async (p: string) => (await this.zip.file(p)?.async('string')) || '';
        const temaXml = await ler('word/theme/theme1.xml');
        if (temaXml) {
            const t = xml(temaXml);
            const maior = t.getElementsByTagName('a:majorFont')[0];
            const menor = t.getElementsByTagName('a:minorFont')[0];
            const latin = (e?: Element) => (e ? filho(e, 'a:latin')?.getAttribute('typeface') || '' : '');
            this.tema = { majorHAnsi: latin(maior), majorAscii: latin(maior), minorHAnsi: latin(menor), minorAscii: latin(menor) };
        }
        const relXml = await ler('word/_rels/document.xml.rels');
        if (relXml) {
            for (const r of Array.from(xml(relXml).getElementsByTagName('Relationship'))) {
                this.rels[String(r.getAttribute('Id'))] = { alvo: String(r.getAttribute('Target') || ''), externo: r.getAttribute('TargetMode') === 'External' };
            }
        }
        const estXml = await ler('word/styles.xml');
        if (estXml) {
            const d = xml(estXml);
            const dd = d.getElementsByTagName('w:docDefaults')[0];
            if (dd) {
                this.padraoP = lerPPr(dd.getElementsByTagName('w:pPr')[0] || null);
                this.padraoR = lerRPr(dd.getElementsByTagName('w:rPr')[0] || null, this.tema);
            }
            for (const s of Array.from(d.getElementsByTagName('w:style'))) {
                const id = String(s.getAttribute('w:styleId'));
                const tblPr = filho(s, 'w:tblPr');
                this.estilos[id] = {
                    tipo: String(s.getAttribute('w:type')), base: filho(s, 'w:basedOn')?.getAttribute('w:val') || undefined,
                    nome: String(filho(s, 'w:name')?.getAttribute('w:val') || id), p: lerPPr(filho(s, 'w:pPr')), r: lerRPr(filho(s, 'w:rPr'), this.tema),
                    tblBordas: bordasDaTabela(tblPr), padrao: s.getAttribute('w:default') === '1',
                };
                if (this.estilos[id].padrao && this.estilos[id].tipo === 'paragraph') this.estiloParagrafo = id;
            }
        }
        const numXml = await ler('word/numbering.xml');
        if (numXml) {
            const d = xml(numXml);
            const abstratos: Record<string, Record<number, Nivel>> = {};
            for (const a of Array.from(d.getElementsByTagName('w:abstractNum'))) {
                const niv: Record<number, Nivel> = {};
                for (const l of filhos(a, 'w:lvl')) {
                    niv[Number(l.getAttribute('w:ilvl'))] = {
                        formato: String(filho(l, 'w:numFmt')?.getAttribute('w:val') || 'decimal'),
                        texto: String(filho(l, 'w:lvlText')?.getAttribute('w:val') ?? '%1.'),
                        inicio: n(filho(l, 'w:start')?.getAttribute('w:val')) ?? 1,
                        p: lerPPr(filho(l, 'w:pPr')),
                    };
                }
                abstratos[String(a.getAttribute('w:abstractNumId'))] = niv;
            }
            for (const num of Array.from(d.getElementsByTagName('w:num'))) {
                const base = abstratos[String(filho(num, 'w:abstractNumId')?.getAttribute('w:val'))] || {};
                const niv: Record<number, Nivel> = { ...base };
                for (const o of filhos(num, 'w:lvlOverride')) {
                    const ilvl = Number(o.getAttribute('w:ilvl'));
                    const ini = n(filho(o, 'w:startOverride')?.getAttribute('w:val'));
                    if (niv[ilvl] && ini !== undefined) niv[ilvl] = { ...niv[ilvl], inicio: ini };
                }
                this.niveis[String(num.getAttribute('w:numId'))] = niv;
            }
        }
        for (const parte of ['word/footnotes.xml', 'word/endnotes.xml']) {
            const x = await ler(parte);
            if (!x) continue;
            for (const nota of [...Array.from(xml(x).getElementsByTagName('w:footnote')), ...Array.from(xml(x).getElementsByTagName('w:endnote'))]) {
                const tipo = nota.getAttribute('w:type');
                if (!tipo || tipo === 'normal') this.notas[`${parte}:${nota.getAttribute('w:id')}`] = nota;
            }
        }
        const cab = Object.values(this.rels).some((r) => /^(header|footer)\d*\.xml$/.test(r.alvo));
        if (cab) this.avisos.add('O cabeçalho e o rodapé do arquivo não entram: a minuta usa o timbrado da unidade.');
    }

    cadeia(id: string | undefined, campo: 'p' | 'r', vistos = new Set<string>()): object {
        const e = id ? this.estilos[id] : undefined;
        if (!e || vistos.has(id!)) return {};
        vistos.add(id!);
        return mesclar(this.cadeia(e.base, campo, vistos) as never, e[campo] as never);
    }

    nivelDeTitulo(estiloId: string | undefined, p: PProps): number | null {
        const e = estiloId ? this.estilos[estiloId] : undefined;
        const nome = (e?.nome || '').toLowerCase();
        if (/^(title|t[ií]tulo)$/.test(nome)) return 1;
        const m = nome.match(/^(heading|t[ií]tulo)\s*(\d)$/);
        if (m) return Math.min(4, Number(m[2]));
        if (p.nivelTitulo !== undefined && p.nivelTitulo < 9) return Math.min(4, p.nivelTitulo + 1);
        return null;
    }

    async corpo(): Promise<{ doc: No; avisos: string[] }> {
        const docXml = await this.zip.file('word/document.xml')?.async('string');
        if (!docXml) throw new Error('Arquivo Word sem conteúdo (document.xml)');
        const body = xml(docXml).getElementsByTagName('w:body')[0];
        if (!body) throw new Error('Arquivo Word sem corpo de texto');
        const itens = await this.blocos(body, {});
        const content = agruparListas(itens);
        if (this.notasUsadas.length) {
            content.push({ type: 'horizontalRule' });
            for (const { n: numero, el } of this.notasUsadas) {
                const its = await this.blocos(el, {});
                const primeiros = agruparListas(its);
                const p = primeiros[0]?.type === 'paragraph' ? primeiros[0] : { type: 'paragraph', content: [] as No[] };
                p.content = [{ type: 'text', text: `${numero} `, marks: [{ type: 'superscript' }] }, ...(p.content || [])];
                content.push(p, ...primeiros.slice(primeiros[0] === p ? 1 : 0));
            }
        }
        const doc = sanitizeDoc({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] });
        return { doc, avisos: [...this.avisos, ...this.imagens.avisos] };
    }

    async blocos(el: Element, ctx: { tabela?: { p: PProps; r: RProps } }): Promise<Item[]> {
        const out: Item[] = [];
        for (const c of filhos(el)) {
            if (c.tagName === 'w:p') out.push(...await this.paragrafo(c, ctx));
            else if (c.tagName === 'w:tbl') { const t = await this.tabela(c); if (t) out.push({ no: t }); }
            else if (c.tagName === 'w:sdt') { const sc = filho(c, 'w:sdtContent'); if (sc) out.push(...await this.blocos(sc, ctx)); }
            else if (['w:customXml', 'w:ins', 'w:moveTo', 'w:smartTag'].includes(c.tagName)) out.push(...await this.blocos(c, ctx));
            else if (c.tagName === 'w:altChunk') this.avisos.add('Parte do arquivo veio de outro documento embutido e não pôde ser lida.');
        }
        return out;
    }

    async paragrafo(el: Element, ctx: { tabela?: { p: PProps; r: RProps } }): Promise<Item[]> {
        const pPrEl = filho(el, 'w:pPr');
        const direto = lerPPr(pPrEl);
        const estiloId = pPrEl ? filho(pPrEl, 'w:pStyle')?.getAttribute('w:val') || this.estiloParagrafo : this.estiloParagrafo;
        // Na tabela, o estilo da tabela vale sobre o estilo Normal (como o Word faz); estilo próprio do parágrafo vale sobre ele.
        const estiloPadrao = estiloId === this.estiloParagrafo;
        const pEstilo = this.cadeia(estiloId, 'p') as PProps;
        const rEstilo = this.cadeia(estiloId, 'r') as RProps;
        const pp = estiloPadrao
            ? mesclar<PProps>(this.padraoP, pEstilo, ctx.tabela?.p, direto)
            : mesclar<PProps>(this.padraoP, ctx.tabela?.p, pEstilo, direto);
        const rBase = estiloPadrao ? mesclar<RProps>(this.padraoR, rEstilo, ctx.tabela?.r) : mesclar<RProps>(this.padraoR, ctx.tabela?.r, rEstilo);
        const titulo = this.nivelDeTitulo(estiloId, pp);
        const out: Item[] = [];
        if (pp.quebraAntes) out.push({ no: { type: 'pageBreak' } });

        // Numeração do Word: lista de verdade (marcador ou 1., 2., 3.) ou o número como texto (a), I -, 1.1).
        let prefixo = '';
        let lista: Item['lista'];
        const numId = pp.numId && pp.numId !== '0' ? pp.numId : undefined;
        if (numId && this.niveis[numId]) {
            const ilvlWord = Math.max(0, Math.min(8, pp.ilvl ?? 0));
            const niv = this.niveis[numId];
            const cont = (this.contadores[numId] ||= []);
            for (let k = 0; k <= ilvlWord; k++) if (cont[k] === undefined) cont[k] = (niv[k]?.inicio ?? 1) - 1;
            cont[ilvlWord] += 1;
            cont.length = ilvlWord + 1;
            const lv = niv[ilvlWord] || { formato: 'decimal', texto: '%1.', inicio: 1, p: {} };
            // Recuo do nível da lista vale sobre o do estilo; o direto do parágrafo, sobre os dois.
            for (const [k, v] of Object.entries(lv.p)) if ((direto as Record<string, unknown>)[k] === undefined) (pp as Record<string, unknown>)[k] = v;
            // Nível visual: o do Word ou o do recuo (listas "Marcador 2" do Word usam outra lista, não outro nível).
            const nivel = pp.esq !== undefined ? Math.round(pp.esq / 360) : ilvlWord * 2;
            if (lv.formato === 'bullet') lista = { chave: `${numId}:b`, ilvl: nivel, ordenada: false, inicio: 1 };
            else if (lv.formato !== 'none') {
                const simples = lv.formato === 'decimal' && lv.texto === `%${ilvlWord + 1}.` && !titulo;
                if (simples) lista = { chave: `${numId}:o`, ilvl: nivel, ordenada: true, inicio: cont[ilvlWord] };
                else prefixo = lv.texto.replace(/%(\d)/g, (_m, d) => formatarNumero(cont[Number(d) - 1] ?? 1, niv[Number(d) - 1]?.formato || 'decimal'));
            }
        }

        const attrs = this.atributos(pp, !!lista, !!prefixo, rBase);
        const blocoTipo = titulo ? 'heading' : 'paragraph';
        const novo = (): No => ({ type: blocoTipo, attrs: { ...attrs, ...(titulo ? { level: titulo } : {}) }, content: [] });
        // Um parágrafo do Word pode virar vários blocos: texto, imagem, quebra de página.
        let atual = novo();
        let emitiu = false;
        let listaUsada = false;
        const emitir = (it: Item) => { out.push(it); emitiu = true; };
        const fechar = (forcar = false) => {
            if (atual.content!.length || forcar) {
                if (!atual.content!.length) delete atual.content;
                emitir(lista && !listaUsada ? { no: atual, lista } : { no: atual });
                listaUsada = true;
            }
            atual = novo();
        };
        if (prefixo) atual.content!.push(...this.texto(`${prefixo} `, rBase, []));
        await this.inline(el, rBase, [], {
            quebraPagina: () => { fechar(); emitir({ no: { type: 'pageBreak' } }); },
            bloco: (b) => { fechar(); emitir({ no: b }); },
            alinhamento: attrs.textAlign as string | undefined,
        }, () => atual);
        // Parágrafo vazio só com borda de baixo é a linha horizontal do Word ("---" + Enter).
        const borda = pPrEl ? filho(filho(pPrEl, 'w:pBdr'), 'w:bottom')?.getAttribute('w:val') : null;
        if (!emitiu && !atual.content!.length && borda && !['nil', 'none'].includes(borda)) {
            emitir({ no: { type: 'horizontalRule' } });
            return out;
        }
        // Parágrafo vazio fica (é a linha em branco do Word); o que só tinha imagem, não.
        fechar(!emitiu);
        // Fim de seção (salvo a contínua) começa página nova no Word.
        const sect = pPrEl ? filho(pPrEl, 'w:sectPr') : null;
        if (sect && filho(sect, 'w:type')?.getAttribute('w:val') !== 'continuous') out.push({ no: { type: 'pageBreak' } });
        return out;
    }

    atributos(pp: PProps, emLista: boolean, comPrefixo: boolean, r: RProps): Record<string, unknown> {
        const a: Record<string, unknown> = {};
        const jc = pp.jc;
        if (jc === 'center') a.textAlign = 'center';
        else if (jc === 'right' || jc === 'end') a.textAlign = 'right';
        else if (jc === 'both' || jc === 'distribute' || jc === 'justify' || jc === 'lowKashida' || jc === 'mediumKashida' || jc === 'highKashida') a.textAlign = 'justify';
        const cm = (tw?: number) => (tw === undefined ? 0 : Math.round((tw / TWIP_CM) * 100) / 100);
        if (!emLista) {
            // Com número no texto, o parágrafo começa onde o Word põe o número (recuo menos o deslocamento).
            const esq = cm((pp.esq || 0) - (comPrefixo ? pp.deslocada || 0 : 0));
            if (esq >= 0.05) a.margemEsq = Math.min(10, esq);
            const prim = cm(pp.primeira);
            if (prim >= 0.05 && !comPrefixo) a.recuo = Math.min(5, prim);
        }
        const pt = (tw?: number) => Math.max(0, Math.min(72, Math.round(((tw || 0) / 20) * 10) / 10));
        a.antes = pp.contextual && emLista ? 0 : pt(pp.antes);
        a.depois = pp.contextual && emLista ? 0 : pt(pp.depois);
        if (pp.linha) {
            let ent = 1;
            if (!pp.regra || pp.regra === 'auto') ent = pp.linha / 240;
            else ent = (pp.linha / 20) / (((r.sz || 24) / 2) * 1.15);
            a.espacamento = Math.max(0.8, Math.min(3, Math.round(ent * 100) / 100));
        } else a.espacamento = 1;
        return a;
    }

    marcas(r: RProps, extra: Marca[]): Marca[] {
        const m: Marca[] = [];
        if (r.b) m.push({ type: 'bold' });
        if (r.i) m.push({ type: 'italic' });
        if (r.u) m.push({ type: 'underline' });
        if (r.strike) m.push({ type: 'strike' });
        if (r.vert === 'superscript') m.push({ type: 'superscript' });
        if (r.vert === 'subscript') m.push({ type: 'subscript' });
        if (r.realce && REALCE[r.realce]) m.push({ type: 'highlight', attrs: { color: REALCE[r.realce] } });
        const ts: Record<string, unknown> = {};
        if (r.cor) ts.color = r.cor;
        if (r.fundo && r.fundo !== '#ffffff') ts.backgroundColor = r.fundo;
        if (r.sz) ts.fontSize = `${Math.max(6, Math.min(96, Math.round(r.sz * 5) / 10))}pt`.replace('.0pt', 'pt');
        const f = fonteEquivalente(r.fonte);
        if (f) ts.fontFamily = f;
        if (Object.keys(ts).length) m.push({ type: 'textStyle', attrs: ts });
        return [...m, ...extra];
    }

    texto(t: string, r: RProps, extra: Marca[]): No[] {
        if (!t || r.oculto) return [];
        const marks = this.marcas(r, extra);
        const txt = r.caps ? t.toLocaleUpperCase('pt-BR') : t;
        return [marks.length ? { type: 'text', text: txt, marks } : { type: 'text', text: txt }];
    }

    /** Percorre runs, links, campos e alterações controladas, juntando o texto no parágrafo atual. */
    async inline(el: Element, rBase: RProps, extra: Marca[], cb: { quebraPagina: () => void; bloco: (b: No) => void; alinhamento?: string }, corrente: () => No, campo = { pilha: [] as Array<{ instr: string; resultado: boolean }> }) {
        // O parágrafo corrente muda depois de uma imagem ou quebra de página no meio do texto.
        const pos = (lista: No[]) => corrente().content!.push(...lista);
        for (const c of filhos(el)) {
            const tag = c.tagName;
            if (tag === 'w:pPr' || tag === 'w:del' || tag === 'w:moveFrom' || tag === 'w:commentRangeStart' || tag === 'w:bookmarkStart') continue;
            if (tag === 'w:hyperlink') {
                const rel = this.rels[String(c.getAttribute('r:id'))];
                const href = rel?.externo ? rel.alvo : '';
                await this.inline(c, rBase, /^(https?:|mailto:)/i.test(href) ? [...extra, { type: 'link', attrs: { href } }] : extra, cb, corrente, campo);
                continue;
            }
            if (['w:ins', 'w:moveTo', 'w:smartTag', 'w:customXml', 'w:fldSimple', 'w:dir', 'w:bdo'].includes(tag)) {
                let ex = extra;
                if (tag === 'w:fldSimple') {
                    const m = String(c.getAttribute('w:instr') || '').match(/HYPERLINK\s+"([^"]+)"/);
                    if (m && /^(https?:|mailto:)/i.test(m[1])) ex = [...extra, { type: 'link', attrs: { href: m[1] } }];
                }
                await this.inline(c, rBase, ex, cb, corrente, campo);
                continue;
            }
            if (tag === 'w:sdt') { const sc = filho(c, 'w:sdtContent'); if (sc) await this.inline(sc, rBase, extra, cb, corrente, campo); continue; }
            if (tag === 'mc:AlternateContent') { const ch = filho(c, 'mc:Choice') || filho(c, 'mc:Fallback'); if (ch) await this.inline(ch, rBase, extra, cb, corrente, campo); continue; }
            if (tag !== 'w:r') continue;
            const rPrEl = filho(c, 'w:rPr');
            const estiloR = rPrEl ? filho(rPrEl, 'w:rStyle')?.getAttribute('w:val') : undefined;
            const r = mesclar<RProps>(rBase, this.cadeia(estiloR || undefined, 'r') as RProps, lerRPr(rPrEl, this.tema));
            // Campos complexos: a instrução não aparece; o resultado sim (com link, se for HYPERLINK).
            for (const x of filhos(c)) {
                const t = x.tagName;
                const topo = campo.pilha[campo.pilha.length - 1];
                const linkCampo = campo.pilha.map((y) => y.instr.match(/HYPERLINK\s+"([^"]+)"/)?.[1]).filter((h): h is string => !!h && /^(https?:|mailto:)/i.test(h)).pop();
                const ex: Marca[] = linkCampo ? [...extra, { type: 'link', attrs: { href: linkCampo } }] : extra;
                if (t === 'w:fldChar') {
                    const tipo = x.getAttribute('w:fldCharType');
                    if (tipo === 'begin') campo.pilha.push({ instr: '', resultado: false });
                    else if (tipo === 'separate' && campo.pilha.length) campo.pilha[campo.pilha.length - 1].resultado = true;
                    else if (tipo === 'end') campo.pilha.pop();
                    continue;
                }
                if (t === 'w:instrText') { if (topo) topo.instr += x.textContent || ''; continue; }
                if (topo && !topo.resultado) continue;
                if (t === 'w:t') pos(this.texto(x.textContent || '', r, ex));
                else if (t === 'w:tab') pos(this.texto(' '.repeat(Math.max(2, Math.min(12, Math.round(36 / (((r.sz || 24) / 2) * 0.25))))), r, ex));
                else if (t === 'w:br') {
                    if (x.getAttribute('w:type') === 'page') cb.quebraPagina();
                    else pos([{ type: 'hardBreak' }]);
                } else if (t === 'w:cr') pos([{ type: 'hardBreak' }]);
                else if (t === 'w:noBreakHyphen') pos(this.texto('-', r, ex));
                else if (t === 'w:sym') {
                    const code = parseInt(String(x.getAttribute('w:char') || ''), 16);
                    const fonteSym = String(x.getAttribute('w:font') || '');
                    const ch = /symbol|wingdings/i.test(fonteSym) ? (code === 0xf0b7 || code === 0xf0a7 ? '•' : code === 0xf0fc ? '✓' : '') : Number.isFinite(code) ? String.fromCharCode(code) : '';
                    if (ch) pos(this.texto(ch, r, ex));
                } else if (t === 'w:footnoteReference' || t === 'w:endnoteReference') {
                    const parte = t === 'w:footnoteReference' ? 'word/footnotes.xml' : 'word/endnotes.xml';
                    const nota = this.notas[`${parte}:${x.getAttribute('w:id')}`];
                    if (nota) {
                        const numero = this.notasUsadas.length + 1;
                        this.notasUsadas.push({ n: numero, el: nota });
                        pos(this.texto(String(numero), { ...r, vert: 'superscript' }, ex));
                    }
                } else if (t === 'w:drawing' || t === 'w:pict' || t === 'w:object' || t === 'mc:AlternateContent') {
                    await this.desenho(x, cb);
                }
            }
        }
    }

    /** Imagem (inline ou flutuante) e caixa de texto dentro de um desenho. */
    async desenho(el: Element, cb: { bloco: (b: No) => void; alinhamento?: string }) {
        let alvo = el;
        if (el.tagName === 'mc:AlternateContent') alvo = filho(el, 'mc:Choice') || filho(el, 'mc:Fallback') || el;
        const caixas = Array.from(alvo.getElementsByTagName('w:txbxContent'));
        for (const cx of caixas) for (const it of agruparListas(await this.blocos(cx, {}))) cb.bloco(it);
        const blip = alvo.getElementsByTagName('a:blip')[0];
        const vml = alvo.getElementsByTagName('v:imagedata')[0];
        const rid = blip?.getAttribute('r:embed') || vml?.getAttribute('r:id');
        if (!rid) return;
        const rel = this.rels[rid];
        if (!rel || rel.externo) return;
        const caminho = rel.alvo.startsWith('/') ? rel.alvo.slice(1) : `word/${rel.alvo}`.replace(/[^/]+\/\.\.\//g, '');
        const buf = await this.zip.file(caminho)?.async('nodebuffer');
        if (!buf) return;
        const ext = alvo.getElementsByTagName('wp:extent')[0];
        const cxEmu = Number(ext?.getAttribute('cx')) || 0;
        const largura = cxEmu ? Math.round(cxEmu / 9525) : null;
        const alt = String(alvo.getElementsByTagName('wp:docPr')[0]?.getAttribute('descr') || '').slice(0, 300);
        const img = await this.imagens.incluir(buf, caminho);
        if (!img) return;
        const w = Math.max(10, Math.min(LARGURA_UTIL_PX, largura || img.largura));
        const align = cb.alinhamento === 'center' || cb.alinhamento === 'right' ? cb.alinhamento : undefined;
        cb.bloco({ type: 'image', attrs: { src: img.src, alt, width: w, ...(align ? { align } : {}) } });
    }

    async tabela(el: Element): Promise<No | null> {
        const tblPr = filho(el, 'w:tblPr');
        const estiloId = tblPr ? filho(tblPr, 'w:tblStyle')?.getAttribute('w:val') || undefined : undefined;
        const cadeiaEstilos = (id?: string, vistos = new Set<string>()): Estilo[] => {
            const e = id ? this.estilos[id] : undefined;
            if (!e || vistos.has(id!)) return [];
            vistos.add(id!);
            return [...cadeiaEstilos(e.base, vistos), e];
        };
        const est = cadeiaEstilos(estiloId);
        const bordas = bordasDaTabela(tblPr) ?? [...est].reverse().map((e) => e.tblBordas).find((b) => b !== null && b !== undefined) ?? false;
        const ctx = { tabela: { p: mesclar<PProps>(...est.map((e) => e.p)), r: mesclar<RProps>(...est.map((e) => e.r)) } };
        const grade = filhos(filho(el, 'w:tblGrid') || el, 'w:gridCol').map((g) => Math.max(10, Math.round((Number(g.getAttribute('w:w')) || 0) / 15)));
        type Cel = { no: No; col: number; span: number };
        const linhas: Array<{ cab: boolean; cels: Cel[] }> = [];
        const abertas: Record<number, Cel> = {}; // coluna → célula mesclada na vertical
        let algumaBorda = false;
        for (const tr of filhos(el, 'w:tr').slice(0, MAX_LINHAS_TABELA)) {
            const trPr = filho(tr, 'w:trPr');
            const cab = !!(trPr && filho(trPr, 'w:tblHeader'));
            const cels: Cel[] = [];
            let col = n(trPr ? filho(trPr, 'w:gridBefore')?.getAttribute('w:val') : null) || 0;
            const tcs = filhos(tr).flatMap((x) => (x.tagName === 'w:sdt' ? filhos(filho(x, 'w:sdtContent') || x, 'w:tc') : x.tagName === 'w:tc' ? [x] : []));
            for (const tc of tcs) {
                const tcPr = filho(tc, 'w:tcPr');
                const span = Math.max(1, n(tcPr ? filho(tcPr, 'w:gridSpan')?.getAttribute('w:val') : null) || 1);
                const vm = tcPr ? filho(tcPr, 'w:vMerge') : null;
                const tb = tcPr ? filho(tcPr, 'w:tcBorders') : null;
                if (tb && filhos(tb).some((x) => !['nil', 'none'].includes(String(x.getAttribute('w:val'))))) algumaBorda = true;
                if (vm && vm.getAttribute('w:val') !== 'restart' && abertas[col]) {
                    const orig = abertas[col];
                    orig.no.attrs!.rowspan = Number(orig.no.attrs!.rowspan || 1) + 1;
                    col += span;
                    continue;
                }
                const conteudo = agruparListas(await this.blocos(tc, ctx));
                // Largura: a da célula (tcW, em twips) ou a da grade da tabela.
                const tcW = tcPr ? filho(tcPr, 'w:tcW') : null;
                const wCel = tcW?.getAttribute('w:type') === 'dxa' ? Number(tcW.getAttribute('w:w')) / 15 : 0;
                const larguras = wCel >= 10 ? Array(span).fill(Math.round(wCel / span))
                    : grade.length >= col + span ? grade.slice(col, col + span) : null;
                const no: No = {
                    type: cab ? 'tableHeader' : 'tableCell',
                    attrs: { colspan: span, rowspan: 1, ...(larguras ? { colwidth: larguras } : {}) },
                    content: conteudo.length ? conteudo : [{ type: 'paragraph' }],
                };
                const cel = { no, col, span };
                if (vm) abertas[col] = cel; else delete abertas[col];
                cels.push(cel);
                col += span;
                if (col >= MAX_COLUNAS) break;
            }
            if (cels.length) linhas.push({ cab, cels });
        }
        if (!linhas.length) return null;
        if (filhos(el, 'w:tr').length > MAX_LINHAS_TABELA) this.avisos.add(`Tabela com mais de ${MAX_LINHAS_TABELA} linhas: só as primeiras vieram.`);
        return {
            type: 'table',
            ...(bordas || algumaBorda ? {} : { attrs: { semBordas: true } }),
            content: linhas.map((l) => ({ type: 'tableRow', content: l.cels.map((c) => c.no) })),
        };
    }
}

/** Word (.docx) → documento do editor, com os avisos do que não veio. */
export async function docxParaDoc(buf: Buffer): Promise<{ doc: No; avisos: string[] }> {
    let zip: JSZip;
    try { zip = await jszip().loadAsync(buf); } catch { throw new Error('Arquivo Word danificado ou protegido por senha'); }
    const l = new Leitor(zip);
    await l.carregar();
    return l.corpo();
}
