import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';
import type { PDFDocument } from 'pdf-lib';
// Bibliotecas pesadas carregadas só quando usadas (partida a frio das functions).
const pdfLib = () => require('pdf-lib') as typeof import('pdf-lib');
const qrcode = () => require('qrcode') as typeof import('qrcode');
import { No, deltaParaDoc } from '../shared/documento';
import { DeltaOp, documentoEfetivo } from '../shared/secretaria';
import { COL } from './context';
import { ConfigDocumento, dataHora, renderizarDocumento, textoParaDoc, winAnsi } from './pdfDocumento';
import { conversivel, officeParaDoc } from './conversao';
import { lerConteudo, lerOriginal } from './arquivos';
import { otimizarImagem } from './imagem';

/**
 * Peças dos autos em PDF: cada documento juntado vira páginas numeradas em
 * folhas (fls.) contínuas no processo, com carimbo de processo, folha,
 * número do documento e hash. Usado na juntada, no download e na exportação.
 */

/**
 * Papel timbrado de um documento: o da unidade que o redigiu, se ela tiver
 * timbrado próprio, ou o do órgão.
 */
export async function lerConfigDocumento(db: admin.firestore.Firestore, orgId: string, unidadeId?: string): Promise<ConfigDocumento> {
    const [s, u] = await Promise.all([
        db.collection(COL.config).doc(orgId).get(),
        unidadeId ? db.collection(COL.unidadeConfig).doc(unidadeId).get() : Promise.resolve(null),
    ]);
    const un = u?.data();
    return documentoEfetivo((s.data()?.documento || {}) as ConfigDocumento, un?.organization_id === orgId ? un as never : null);
}

/** Texto do editor de um documento ou versão (JSON no banco ou no Storage, mapa antigo, Delta do Quill). */
export async function conteudoDoDocumento(d: admin.firestore.DocumentData): Promise<No> {
    return (await lerConteudo(d)) || deltaParaDoc((d.delta || []) as DeltaOp[]);
}

export const caminhoPdf = (storagePath: string) => `${storagePath}.pdf`;

/**
 * Documento gravado a partir de 16/11/2026 traz `fontes: 2`: PDF com as
 * fontes novas e conversão nova de Word/LibreOffice. Sem a marca, o PDF é
 * refeito como era (mesmas folhas já numeradas nos autos).
 */
export const FONTES_ATUAIS = 2;
export const ehLegado = (d: { fontes?: unknown }) => d.fontes !== FONTES_ATUAIS;

/** Folhas que um arquivo enviado ocupa nos autos. */
export async function paginasDeArquivo(buf: Buffer, mime: string, legado = false): Promise<number> {
    if (mime === 'application/pdf') {
        try { return (await pdfLib().PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount(); } catch { return 1; }
    }
    if (mime === 'text/plain') return (await renderizarDocumento(textoParaDoc(buf.toString('utf8')), {}, { semCabecalho: true, legado })).paginas;
    if (conversivel(mime, legado)) {
        try { return (await renderizarDocumento((await officeParaDoc(buf, mime, legado))!, {}, { semCabecalho: true, legado })).paginas; } catch { return 1; }
    }
    return 1; // imagem numa folha; outros formatos, folha de referência
}

export async function folhaSimples(titulo: string, linhas: string[], imagem?: { buf: Buffer; mime: string }): Promise<Uint8Array> {
    const pdf = await pdfLib().PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(pdfLib().StandardFonts.Helvetica);
    const bold = await pdf.embedFont(pdfLib().StandardFonts.HelveticaBold);
    if (imagem) {
        const img = imagem.mime === 'image/png' ? await pdf.embedPng(imagem.buf) : await pdf.embedJpg(imagem.buf);
        const esc = img.scaleToFit(595.28 - 112, 841.89 - 140);
        page.drawImage(img, { x: (595.28 - esc.width) / 2, y: 841.89 - 70 - esc.height, width: esc.width, height: esc.height });
        return pdf.save();
    }
    let y = 760;
    page.drawText(winAnsi(titulo).slice(0, 90), { x: 56, y, size: 13, font: bold });
    for (const l of linhas) {
        y -= 18;
        page.drawText(winAnsi(l).slice(0, 110), { x: 56, y, size: 9, font, color: pdfLib().rgb(0.3, 0.3, 0.3) });
    }
    return pdf.save();
}

/**
 * PDF de um documento como entra nos autos (sem carimbo). Documento do
 * editor usa o PDF gerado na juntada; se faltar, gera de novo do conteúdo.
 */
export async function pdfDoDocumento(d: admin.firestore.DocumentData, cfg: ConfigDocumento): Promise<Uint8Array> {
    const bucket = admin.storage().bucket();
    if (d.origem === 'editor') {
        if (d.pdf_path) {
            try { return (await bucket.file(d.pdf_path).download())[0]; } catch { /* gera de novo abaixo */ }
        }
        return (await renderizarDocumento(await conteudoDoDocumento(d), d.peticao ? {} : cfg, {
            assinaturas: d.assinaturas || [], sha256: d.sha256, semCabecalho: !!d.peticao, legado: ehLegado(d),
        })).buffer;
    }
    // Versão de leitura feita no envio (imagem otimizada, PDF reorganizado, Word convertido).
    if (d.leitura_path) {
        try { return (await bucket.file(d.leitura_path).download())[0]; } catch { /* volta ao original abaixo */ }
    }
    try {
        return await pdfDeArquivo(await lerOriginal(d), { ...d, legado: ehLegado(d) });
    } catch {
        return folhaSimples(String(d.titulo), ['Não foi possível incorporar este arquivo (corrompido ou protegido).', 'O original continua nos autos eletrônicos.', `SHA-256 ${d.sha256}`]);
    }
}

/** O arquivo enviado como páginas dos autos (sem carimbo). Lança se o arquivo não abrir. */
export async function pdfDeArquivo(buf: Buffer, d: { mime?: string; titulo?: string; nome_arquivo?: string; sha256?: string; legado?: boolean }): Promise<Uint8Array> {
    const legado = !!d.legado;
    const mime = String(d.mime);
    if (mime === 'application/pdf') {
        await pdfLib().PDFDocument.load(buf, { ignoreEncryption: true }); // valida
        return buf;
    }
    if (mime === 'image/png' || mime === 'image/jpeg') return folhaSimples(String(d.titulo), [], { buf, mime });
    if (mime === 'text/plain') return (await renderizarDocumento(textoParaDoc(buf.toString('utf8')), {}, { semCabecalho: true, legado })).buffer;
    if (conversivel(mime, legado)) return (await renderizarDocumento((await officeParaDoc(buf, mime, legado))!, {}, { semCabecalho: true, legado })).buffer;
    return folhaSimples(String(d.titulo), [
        `Arquivo ${d.nome_arquivo} (${mime}), sem conversão para PDF nesta versão.`,
        'O original está nos autos eletrônicos e pode ser baixado no Processo Eletrônico.',
        `SHA-256 ${d.sha256}`,
    ]);
}

/**
 * Versão de leitura de um arquivo enviado: o que vai às folhas dos autos, à
 * tela e ao PDF do processo. O original fica intacto (é a prova, com o
 * SHA-256) e pode ser baixado a qualquer tempo.
 *   - Imagem: reduzida a até 300 dpi numa folha A4 e recomprimida sem perda
 *     perceptível (JPEG de alta qualidade ou PNG sem perda, o menor), já na
 *     orientação certa da câmera.
 *   - PDF: reorganizado sem perda (fluxos de objetos); só se ficar ao menos
 *     10% menor. PDF protegido por senha fica como veio.
 *   - Word, planilha e texto: a conversão para PDF, feita uma vez só.
 * Devolve null quando o original já serve como está.
 */
export async function versaoDeLeitura(buf: Buffer, d: { mime: string; titulo: string; nome_arquivo?: string; sha256?: string }): Promise<Uint8Array | null> {
    if (d.mime === 'image/png' || d.mime === 'image/jpeg') {
        const img = await otimizarImagem(buf, d.mime);
        return folhaSimples(d.titulo, [], img || { buf, mime: d.mime });
    }
    if (d.mime === 'application/pdf') {
        const pdf = await pdfLib().PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
        if (pdf.isEncrypted) return null;
        const novo = await pdf.save({ useObjectStreams: true });
        return novo.length <= buf.length * 0.9 ? novo : null;
    }
    return pdfDeArquivo(buf, d);
}

// ---------------------------------------------------------------------------
// Código de verificação: cada documento juntado ganha um código aleatório
// (80 bits) impresso em todas as folhas, com QR para a página pública
// /Conferir, que mostra os dados da juntada, signatários e hashes.
// ---------------------------------------------------------------------------

export const APP_URL = process.env.APP_URL || 'https://sigo-caocipp.web.app';
const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function novoCodigo(): string {
    const b = randomBytes(10);
    let bits = 0, valor = 0, out = '';
    for (const byte of b) {
        valor = (valor << 8) | byte; bits += 8;
        while (bits >= 5) { out += BASE32[(valor >>> (bits - 5)) & 31]; bits -= 5; }
    }
    return out.match(/.{4}/g)!.join('-');
}

/** Aceita minúsculas, espaços, sem hífen e O/I/L no lugar de 0/1. */
export function normalizarCodigo(v: unknown): string {
    const s = String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    return s.length === 16 && [...s].every((ch) => BASE32.includes(ch)) ? s.match(/.{4}/g)!.join('-') : '';
}

export const urlConferencia = (codigo: string) => `${APP_URL}/Conferir?c=${codigo}`;

/** O que a página pública mostra sobre um documento juntado. */
export function registroVerificacao(
    orgId: string, orgao: string, procId: string, proc: admin.firestore.DocumentData,
    docId: string, d: admin.firestore.DocumentData,
) {
    return {
        organization_id: orgId, orgao, processo_id: procId, numero: String(proc.numero), documento_id: docId,
        ordem: d.ordem ?? null, titulo: String(d.titulo || ''), tipo: String(d.tipo || ''), origem: d.origem || null,
        nome_arquivo: d.nome_arquivo || null, juntado_em: d.juntado_em || null, juntado_por: d.juntado_por_nome || null,
        folha_inicial: d.folha_inicial ?? null, folha_final: d.folha_final ?? null, paginas: d.paginas ?? null,
        assinaturas: ((d.assinaturas || []) as Array<{ nome: string; em: string; nivel?: string }>).map((a) => ({ nome: a.nome, em: a.em, nivel: a.nivel || 'simples' })),
        sha256: d.sha256 || null, pdf_sha256: d.pdf_sha256 || null, peticao: d.peticao === true,
        criado_em: new Date().toISOString(),
    };
}

/** Código do documento juntado; cria (uma vez) para documentos juntados antes desta função. */
export async function garantirCodigo(
    db: admin.firestore.Firestore, orgId: string, procId: string, numero: string, docId: string,
): Promise<string | null> {
    const procRef = db.collection(COL.processos).doc(procId);
    const ref = procRef.collection('documentos').doc(docId);
    return db.runTransaction(async (tx) => {
        const [s, p, o] = await Promise.all([tx.get(ref), tx.get(procRef), tx.get(db.collection('organizations').doc(orgId))]);
        const d = s.data();
        if (!d || d.status !== 'juntado') return null;
        if (d.codigo_verificacao) return String(d.codigo_verificacao);
        const codigo = novoCodigo();
        tx.set(db.collection(COL.verificacao).doc(codigo), registroVerificacao(orgId, String(o.data()?.name || ''), procId, p.data() || { numero }, docId, d));
        tx.update(ref, { codigo_verificacao: codigo });
        return codigo;
    });
}

/**
 * Carimba as páginas: no topo, processo e folha (e código de conferência com
 * QR); no rodapé, documento, juntada e hash. Devolve quantas páginas o
 * documento ocupou.
 */
export async function anexarCarimbado(
    destino: PDFDocument,
    origem: Uint8Array,
    info: { processo: string; folha: number | null; ordem?: number; titulo: string; juntadoEm?: string; juntadoPor?: string; sha256?: string; codigo?: string | null; paginas?: [number, number];
        /** Termo que passou de uma página: todas levam a mesma folha (a numeração dos autos não muda). */
        mesmaFolha?: boolean;
        /** Aviso no lugar de várias folhas (documento desentranhado): o rótulo delas no carimbo. */
        rotuloFolhas?: string },
): Promise<number> {
    let src: PDFDocument;
    try { src = await pdfLib().PDFDocument.load(origem, { ignoreEncryption: true }); } catch {
        src = await pdfLib().PDFDocument.load(await folhaSimples(info.titulo, ['Arquivo não pôde ser lido.', `SHA-256 ${info.sha256 || ''}`]));
    }
    const font = await destino.embedFont(pdfLib().StandardFonts.Helvetica);
    const qr = info.codigo ? await destino.embedPng(await qrcode().toBuffer(urlConferencia(info.codigo), { margin: 0, width: 96, errorCorrectionLevel: 'M' })) : null;
    // `paginas`: só essas páginas do documento (índices a partir de 0), no PDF parcial por folhas.
    const indices = info.paginas ? src.getPageIndices().slice(info.paginas[0], info.paginas[1] + 1) : src.getPageIndices();
    const paginas = await destino.copyPages(src, indices);
    paginas.forEach((pg, n) => {
        const i = indices[n];
        destino.addPage(pg);
        const { width, height } = pg.getSize();
        const fls = info.rotuloFolhas ? ` · ${info.rotuloFolhas}` : !info.folha ? '' : info.mesmaFolha ? ` · fls. ${info.folha}${i ? ' (continuação)' : ''}` : ` · fls. ${info.folha + i}`;
        const topo = winAnsi(`Processo nº ${info.processo}${fls}`);
        pg.drawText(topo, { x: width - 20 - font.widthOfTextAtSize(topo, 8), y: height - 16, size: 8, font, color: pdfLib().rgb(0.25, 0.25, 0.4) });
        if (qr && info.codigo) {
            pg.drawImage(qr, { x: 14, y: height - 52, width: 34, height: 34 });
            pg.drawText(winAnsi(`Conferência: ${info.codigo}`), { x: 52, y: height - 26, size: 6.5, font, color: pdfLib().rgb(0.25, 0.25, 0.4) });
            pg.drawText(winAnsi(`${APP_URL.replace(/^https?:\/\//, '')}/Conferir`), { x: 52, y: height - 35, size: 6, font, color: pdfLib().rgb(0.4, 0.4, 0.4) });
        }
        if (info.ordem) {
            const base = winAnsi(`Doc. nº ${info.ordem} · ${info.titulo.slice(0, 60)}${info.juntadoEm ? ` · juntado em ${dataHora(info.juntadoEm)}${info.juntadoPor ? ` por ${info.juntadoPor}` : ''}` : ''}${info.sha256 ? ` · SHA-256 ${info.sha256.slice(0, 16)}…` : ''}`);
            pg.drawText(base, { x: 20, y: 8, size: 6, font, color: pdfLib().rgb(0.4, 0.4, 0.4), maxWidth: width - 40 });
        }
    });
    return paginas.length;
}

/**
 * Próxima folha livre do processo. Processo anterior às folhas: soma as
 * páginas dos documentos já juntados (1 quando não se sabe).
 */
export async function folhasDoProcesso(
    tx: admin.firestore.Transaction,
    procRef: admin.firestore.DocumentReference,
    proc: admin.firestore.DocumentData,
): Promise<number> {
    if (typeof proc.folhas_seq === 'number') return proc.folhas_seq;
    if (!Number(proc.doc_seq)) return 0;
    const s = await tx.get(procRef.collection('documentos').where('status', '==', 'juntado'));
    return s.docs.reduce((acc, x) => acc + (Number(x.data().paginas) || 1), 0);
}

export const textoFolhas = (ini: number, qtd: number) => (qtd > 1 ? `fls. ${ini} a ${ini + qtd - 1}` : `fl. ${ini}`);

/** Um documento juntado, carimbado, em PDF próprio (download avulso). */
export async function pdfCarimbado(
    db: admin.firestore.Firestore, orgId: string, procId: string, numero: string, docId: string, d: admin.firestore.DocumentData,
): Promise<Buffer> {
    const cfg = await lerConfigDocumento(db, orgId, d.unidade_origem);
    const destino = await pdfLib().PDFDocument.create();
    const codigo = d.codigo_verificacao || await garantirCodigo(db, orgId, procId, numero, docId);
    await anexarCarimbado(destino, await pdfDoDocumento(d, cfg), {
        processo: numero, folha: typeof d.folha_inicial === 'number' ? d.folha_inicial : null, ordem: d.ordem,
        titulo: String(d.titulo), juntadoEm: d.juntado_em, juntadoPor: d.juntado_por_nome, sha256: d.sha256, codigo,
    });
    return Buffer.from(await destino.save());
}
