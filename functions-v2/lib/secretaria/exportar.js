"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaExportarPdf = void 0;
const https_1 = require("firebase-functions/v2/https");
const pdf_lib_1 = require("pdf-lib");
const secretaria_1 = require("../shared/secretaria");
const context_1 = require("./context");
const config_1 = require("./config");
const autos_1 = require("./autos");
/**
 * Exporta os autos em um PDF único, em ordem cronológica: capa, índice de
 * movimentos (com hash), e cada documento juntado na ordem da juntada —
 * redigidos viram texto, PDFs enviados são anexados página a página, imagens
 * entram como página; outros formatos (Word, planilha) aparecem como folha de
 * referência com o hash, porque não há conversão no servidor (fase 5).
 * Minutas nunca entram: só o que está nos autos.
 */
// ponytail: o PDF volta inteiro na resposta (limite ~32 MB do Cloud Run).
// Acima disso os anexos viram folha de referência; gravar no Storage e
// devolver link assinado quando processos grandes forem comuns.
const LIMITE_ANEXOS_BYTES = 18 * 1024 * 1024;
const A4 = [595.28, 841.89];
const MARGEM = 56;
/** Helvetica padrão só codifica WinAnsi; o resto vira '?'. */
const EXTRAS_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function seguro(t) {
    return Array.from(t.replace(/\t/g, '    ').replace(/\r/g, ''))
        .map((ch) => (ch === '\n' || (ch >= ' ' && ch.charCodeAt(0) < 256) || EXTRAS_WINANSI.includes(ch) ? ch : '?'))
        .join('');
}
class Escritor {
    constructor(pdf, font, bold, rodape) {
        this.pdf = pdf;
        this.font = font;
        this.bold = bold;
        this.rodape = rodape;
        this.y = 0;
        this.novaPagina();
    }
    novaPagina() {
        this.page = this.pdf.addPage(A4);
        this.y = A4[1] - MARGEM;
        this.page.drawText(seguro(this.rodape), { x: MARGEM, y: 28, size: 7, font: this.font, color: (0, pdf_lib_1.rgb)(0.45, 0.45, 0.45) });
    }
    texto(t, opts = {}) {
        var _a;
        const size = opts.size || 10;
        const f = opts.bold ? this.bold : this.font;
        const largura = A4[0] - MARGEM * 2;
        for (const paragrafo of seguro(t).split('\n')) {
            const palavras = paragrafo.split(' ');
            let linha = '';
            const linhas = [];
            for (const w of palavras) {
                const tentativa = linha ? `${linha} ${w}` : w;
                if (f.widthOfTextAtSize(tentativa, size) > largura && linha) {
                    linhas.push(linha);
                    linha = w;
                }
                else
                    linha = tentativa;
            }
            linhas.push(linha);
            for (const l of linhas) {
                if (this.y < MARGEM + size)
                    this.novaPagina();
                this.page.drawText(l, { x: MARGEM, y: this.y - size, size, font: f, color: (0, pdf_lib_1.rgb)(...(opts.cor || [0.1, 0.1, 0.1])) });
                this.y -= size * 1.4;
            }
        }
        this.y -= (_a = opts.espaco) !== null && _a !== void 0 ? _a : 4;
    }
}
exports.secretariaExportarPdf = (0, https_1.onCall)({ region: context_1.REGION, memory: '1GiB', timeoutSeconds: 120 }, async (request) => {
    var _a, _b, _c;
    const auth = (0, context_1.exigirAuth)(request);
    const c = await (0, context_1.carregarContexto)(auth, (_a = request.data) === null || _a === void 0 ? void 0 : _a.organizationId);
    const { ref, data: proc } = await (0, context_1.lerProcesso)(c, (_b = request.data) === null || _b === void 0 ? void 0 : _b.processoId);
    const [movSnap, docSnap] = await Promise.all([
        ref.collection('movimentos').orderBy('seq').get(),
        ref.collection('documentos').where('status', '==', 'juntado').get(),
    ]);
    const movimentos = movSnap.docs.map((d) => d.data());
    const docs = docSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())))
        .sort((a, b) => a.ordem - b.ordem);
    const quebra = (0, secretaria_1.verificarCadeia)(movimentos);
    const pdf = await pdf_lib_1.PDFDocument.create();
    pdf.setTitle(`Processo ${proc.numero}`);
    pdf.setCreator('SIGO — Secretaria Processual');
    const font = await pdf.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const bold = await pdf.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
    const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const w = new Escritor(pdf, font, bold, `Processo ${proc.numero} — gerado em ${geradoEm} por ${c.userName}`);
    // Capa
    w.texto(String(c.org.name || 'Órgão'), { size: 12, bold: true });
    w.texto('Secretaria Processual', { size: 10, cor: [0.4, 0.4, 0.4], espaco: 20 });
    w.texto(`Processo nº ${proc.numero}`, { size: 18, bold: true });
    w.texto(String(proc.assunto || ''), { size: 13, espaco: 14 });
    const fase = ((_c = (proc.fases || []).find((f) => f.id === proc.fase_atual)) === null || _c === void 0 ? void 0 : _c.nome) || proc.fase_atual;
    const situacao = { em_tramitacao: 'Em tramitação', sobrestado: 'Sobrestado', arquivado: 'Arquivado' }[proc.status] || proc.status;
    for (const [k, v] of [
        ['Rito', `${proc.rito_nome} (versão ${proc.rito_versao})`],
        ['Fase atual', fase],
        ['Situação', situacao],
        ['Unidade atual', (0, context_1.nomeUnidade)(c, proc.unidade_atual)],
        ['Sigilo', proc.sigilo === 'restrito' ? 'Restrito' : 'Normal'],
        ['Autuado em', `${new Date(proc.autuado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} por ${proc.autuado_por_nome}`],
    ])
        w.texto(`${k}: ${v}`);
    if (proc.descricao)
        w.texto(`\n${proc.descricao}`);
    const partes = (proc.partes || []);
    if (partes.length) {
        w.texto('\nPartes', { bold: true });
        for (const pa of partes)
            w.texto(`${pa.polo}: ${pa.nome}${pa.documento ? ` (${pa.documento})` : ''}`);
    }
    w.texto(quebra === null
        ? `\nIntegridade: cadeia de ${movimentos.length} movimentos conferida (SHA-256).`
        : `\nATENÇÃO: a cadeia de movimentos não confere a partir do movimento ${quebra}.`, { bold: quebra !== null, cor: quebra === null ? [0.1, 0.4, 0.2] : [0.7, 0.1, 0.1] });
    // Índice cronológico
    w.novaPagina();
    w.texto('Movimentos (ordem cronológica)', { size: 14, bold: true, espaco: 10 });
    for (const m of movimentos) {
        const quando = new Date(m.em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        w.texto(`${m.seq}. ${quando} — ${m.autor_nome} (${(0, context_1.nomeUnidade)(c, m.unidade_id)})`, { bold: true, size: 9, espaco: 0 });
        w.texto(String(m.descricao), { size: 9, espaco: 0 });
        w.texto(`hash ${m.hash}`, { size: 6, cor: [0.5, 0.5, 0.5], espaco: 6 });
    }
    // Índice dos documentos, com as folhas que cada um ocupa.
    const cfg = await (0, autos_1.lerConfigDocumento)(c.db, c.orgId);
    let bytesAnexos = 0;
    const pecas = [];
    for (const d of docs) {
        let bytes;
        if (d.origem === 'upload' && bytesAnexos + (d.tamanho || 0) > LIMITE_ANEXOS_BYTES) {
            bytes = await (0, autos_1.folhaSimples)(String(d.titulo), [
                'Arquivo não incorporado: o PDF único dos autos passou do limite de tamanho.',
                'Baixe o documento avulso na Secretaria; o hash abaixo permite conferir o original.',
                `SHA-256 ${d.sha256}`,
            ]);
        }
        else {
            bytes = await (0, autos_1.pdfDoDocumento)(d, cfg);
            bytesAnexos += d.origem === 'upload' ? (d.tamanho || 0) : bytes.length;
        }
        pecas.push({ d, bytes });
    }
    w.novaPagina();
    w.texto('Documentos (folhas dos autos)', { size: 14, bold: true, espaco: 10 });
    const fimIndice = pdf.getPageCount();
    // Documentos juntados, em folhas contínuas e carimbadas.
    let folha = 1;
    const linhasIndice = [];
    for (const { d, bytes } of pecas) {
        const codigo = d.codigo_verificacao || await (0, autos_1.garantirCodigo)(c.db, c.orgId, ref.id, String(proc.numero), d.id);
        const qtd = await (0, autos_1.anexarCarimbado)(pdf, bytes, {
            processo: String(proc.numero), folha, ordem: d.ordem, titulo: String(d.titulo),
            juntadoEm: d.juntado_em, juntadoPor: d.juntado_por_nome, sha256: d.sha256, codigo,
        });
        linhasIndice.push(`Doc. nº ${d.ordem} — ${d.titulo} (${d.tipo}) — ${(0, autos_1.textoFolhas)(folha, qtd)}`);
        folha += qtd;
    }
    // O índice é escrito depois de anexar, na página reservada antes dos documentos.
    const paginaIndice = pdf.getPage(fimIndice - 1);
    let y = paginaIndice.getHeight() - MARGEM - 30;
    for (const l of linhasIndice) {
        if (y < MARGEM)
            break; // ponytail: índice de uma página (~45 documentos); paginar se passar disso
        paginaIndice.drawText(seguro(l).slice(0, 110), { x: MARGEM, y, size: 9, font, color: (0, pdf_lib_1.rgb)(0.1, 0.1, 0.1) });
        y -= 14;
    }
    if (linhasIndice.length > 45)
        paginaIndice.drawText(seguro(`... e mais ${linhasIndice.length - 45} documentos (ver movimentos).`), { x: MARGEM, y: MARGEM - 10, size: 8, font });
    const bytes = await pdf.save();
    await (0, config_1.auditar)(c.db, c.orgId, auth.uid, c.userName, 'SECRETARIA_PDF_EXPORTADO', { processo_id: ref.id, numero: proc.numero });
    return { base64: Buffer.from(bytes).toString('base64'), nome: `processo-${String(proc.numero).replace('/', '-')}.pdf` };
});
//# sourceMappingURL=exportar.js.map