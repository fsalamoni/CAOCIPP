import * as admin from 'firebase-admin';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { No, deltaParaDoc } from '../shared/documento';
import { DeltaOp } from '../shared/secretaria';
import { COL } from './context';
import { ConfigDocumento, dataHora, renderizarDocumento, textoParaDoc, winAnsi } from './pdfDocumento';

/**
 * Peças dos autos em PDF: cada documento juntado vira páginas numeradas em
 * folhas (fls.) contínuas no processo, com carimbo de processo, folha,
 * número do documento e hash. Usado na juntada, no download e na exportação.
 */

export async function lerConfigDocumento(db: admin.firestore.Firestore, orgId: string): Promise<ConfigDocumento> {
    const s = await db.collection(COL.config).doc(orgId).get();
    return (s.data()?.documento || {}) as ConfigDocumento;
}

export function conteudoDoDocumento(d: admin.firestore.DocumentData): No {
    return d.conteudo ? (d.conteudo as No) : deltaParaDoc((d.delta || []) as DeltaOp[]);
}

export const caminhoPdf = (storagePath: string) => `${storagePath}.pdf`;

/** Folhas que um arquivo enviado ocupa nos autos. */
export async function paginasDeArquivo(buf: Buffer, mime: string): Promise<number> {
    if (mime === 'application/pdf') {
        try { return (await PDFDocument.load(buf, { ignoreEncryption: true })).getPageCount(); } catch { return 1; }
    }
    if (mime === 'text/plain') return (await renderizarDocumento(textoParaDoc(buf.toString('utf8')), {}, { semCabecalho: true })).paginas;
    return 1; // imagem numa folha; outros formatos, folha de referência
}

export async function folhaSimples(titulo: string, linhas: string[], imagem?: { buf: Buffer; mime: string }): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
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
        page.drawText(winAnsi(l).slice(0, 110), { x: 56, y, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
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
        return (await renderizarDocumento(conteudoDoDocumento(d), d.peticao ? {} : cfg, {
            assinaturas: d.assinaturas || [], sha256: d.sha256, semCabecalho: !!d.peticao,
        })).buffer;
    }
    try {
        const [buf] = await bucket.file(d.storage_path).download();
        if (d.mime === 'application/pdf') {
            await PDFDocument.load(buf, { ignoreEncryption: true }); // valida
            return buf;
        }
        if (d.mime === 'image/png' || d.mime === 'image/jpeg') return folhaSimples(d.titulo, [], { buf, mime: d.mime });
        if (d.mime === 'text/plain') return (await renderizarDocumento(textoParaDoc(buf.toString('utf8')), {}, { semCabecalho: true })).buffer;
    } catch {
        return folhaSimples(String(d.titulo), ['Não foi possível incorporar este arquivo (corrompido ou protegido).', 'O original continua nos autos eletrônicos.', `SHA-256 ${d.sha256}`]);
    }
    return folhaSimples(String(d.titulo), [
        `Arquivo ${d.nome_arquivo} (${d.mime}), sem conversão para PDF nesta versão.`,
        'O original está nos autos eletrônicos e pode ser baixado na Secretaria.',
        `SHA-256 ${d.sha256}`,
    ]);
}

/**
 * Carimba as páginas: no topo, processo e folha; no rodapé, documento,
 * juntada e hash. Devolve quantas páginas o documento ocupou.
 */
export async function anexarCarimbado(
    destino: PDFDocument,
    origem: Uint8Array,
    info: { processo: string; folha: number | null; ordem?: number; titulo: string; juntadoEm?: string; juntadoPor?: string; sha256?: string },
): Promise<number> {
    let src: PDFDocument;
    try { src = await PDFDocument.load(origem, { ignoreEncryption: true }); } catch {
        src = await PDFDocument.load(await folhaSimples(info.titulo, ['Arquivo não pôde ser lido.', `SHA-256 ${info.sha256 || ''}`]));
    }
    const font = await destino.embedFont(StandardFonts.Helvetica);
    const paginas = await destino.copyPages(src, src.getPageIndices());
    paginas.forEach((pg, i) => {
        destino.addPage(pg);
        const { width, height } = pg.getSize();
        const topo = winAnsi(`Processo nº ${info.processo}${info.folha ? ` · fls. ${info.folha + i}` : ''}`);
        pg.drawText(topo, { x: width - 20 - font.widthOfTextAtSize(topo, 8), y: height - 16, size: 8, font, color: rgb(0.25, 0.25, 0.4) });
        if (info.ordem) {
            const base = winAnsi(`Doc. nº ${info.ordem} · ${info.titulo.slice(0, 60)}${info.juntadoEm ? ` · juntado em ${dataHora(info.juntadoEm)}${info.juntadoPor ? ` por ${info.juntadoPor}` : ''}` : ''}${info.sha256 ? ` · SHA-256 ${info.sha256.slice(0, 16)}…` : ''}`);
            pg.drawText(base, { x: 20, y: 8, size: 6, font, color: rgb(0.4, 0.4, 0.4), maxWidth: width - 40 });
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
export async function pdfCarimbado(db: admin.firestore.Firestore, orgId: string, numero: string, d: admin.firestore.DocumentData): Promise<string> {
    const cfg = await lerConfigDocumento(db, orgId);
    const destino = await PDFDocument.create();
    await anexarCarimbado(destino, await pdfDoDocumento(d, cfg), {
        processo: numero, folha: typeof d.folha_inicial === 'number' ? d.folha_inicial : null, ordem: d.ordem,
        titulo: String(d.titulo), juntadoEm: d.juntado_em, juntadoPor: d.juntado_por_nome, sha256: d.sha256,
    });
    return Buffer.from(await destino.save()).toString('base64');
}
