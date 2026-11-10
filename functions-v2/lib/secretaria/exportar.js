"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaExportarPdf = void 0;
exports.selecaoOuErro = selecaoOuErro;
exports.montarPdfAutos = montarPdfAutos;
const https_1 = require("firebase-functions/v2/https");
const pdf_lib_1 = require("pdf-lib");
const secretaria_1 = require("../shared/secretaria");
const autos_1 = require("../shared/autos");
const context_1 = require("./context");
const config_1 = require("./config");
const autos_2 = require("./autos");
/**
 * Exporta os autos em um PDF único, em ordem cronológica: capa, índice dos
 * eventos (com folhas e hash) e as peças. Cada ato de usuário tem a sua
 * página: o documento juntado (redigidos viram texto, PDFs entram página a
 * página, imagens como página, Word/planilha como folha de referência com o
 * hash) ou, sem documento, um termo de uma folha. Os registros do sistema
 * saem reunidos num extrato ao fim. `selecao` gera o PDF integral ou parcial
 * (apenas os eventos marcados, todos exceto eles, ou um intervalo de folhas).
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
function selecaoOuErro(raw) {
    try {
        return (0, autos_1.sanitizeSelecao)(raw);
    }
    catch (e) {
        throw new https_1.HttpsError('invalid-argument', e instanceof Error ? e.message : 'Seleção inválida');
    }
}
const quandoBR = (iso) => new Date(String(iso)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
/** Página do ato de usuário que não juntou documento: o que foi feito, por quem e quando. */
async function termoPdf(orgNome, numero, m, unidade) {
    const pdf = await pdf_lib_1.PDFDocument.create();
    const w = new Escritor(pdf, await pdf.embedFont(pdf_lib_1.StandardFonts.Helvetica), await pdf.embedFont(pdf_lib_1.StandardFonts.HelveticaBold), '');
    w.y -= 40;
    w.texto(orgNome || 'Órgão', { size: 11, bold: true, espaco: 2 });
    w.texto(`Processo nº ${numero}`, { size: 10, cor: [0.4, 0.4, 0.4], espaco: 36 });
    w.texto((0, autos_1.tituloEvento)(m).toUpperCase(), { size: 14, bold: true, espaco: 6 });
    w.texto(`Evento nº ${m.seq}`, { size: 10, cor: [0.4, 0.4, 0.4], espaco: 24 });
    w.texto(String(m.descricao), { size: 11, espaco: 24 });
    w.texto(`Praticado por ${m.autor_nome}${unidade ? `, ${unidade}` : ''}, em ${quandoBR(m.em)}.`, { size: 10, espaco: 30 });
    w.texto('Termo gerado pela plataforma a partir do registro do evento. A integridade é conferida pela cadeia de hash dos eventos do processo.', { size: 8, cor: [0.45, 0.45, 0.45], espaco: 4 });
    w.texto(`SHA-256 do evento: ${m.hash}`, { size: 7, cor: [0.45, 0.45, 0.45] });
    return pdf.save();
}
/** Monta o PDF único dos autos. A equipe passa tudo; o portal passa só o que a parte pode ver. */
async function montarPdfAutos(o) {
    var _a, _b;
    const { proc, movimentos, docs } = o;
    const quebra = (0, secretaria_1.verificarCadeia)(movimentos);
    const unid = (id) => { const n = o.nomeUnidade(String(id || '')); return n ? ` (${n})` : ''; };
    const pdf = await pdf_lib_1.PDFDocument.create();
    pdf.setTitle(`Processo ${proc.numero}`);
    pdf.setCreator('SIGO — Processo Eletrônico');
    const font = await pdf.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const bold = await pdf.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
    const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const rodape = `Processo ${proc.numero} — gerado em ${geradoEm} por ${o.geradoPor}`;
    const sel = o.selecao || (0, autos_1.sanitizeSelecao)(null);
    const docsPorId = new Map(docs.map((d) => [String(d.id), d]));
    const { incluidos, recorte } = (0, autos_1.selecionar)(movimentos, docsPorId, sel);
    const escolhidos = movimentos.filter((m) => incluidos.has(m.seq));
    const atos = escolhidos.filter((m) => (0, autos_1.origemEvento)(m) === 'usuario');
    const sistema = escolhidos.filter((m) => (0, autos_1.origemEvento)(m) === 'sistema');
    const parcial = sel.modo !== 'integral';
    if (!escolhidos.length)
        throw new https_1.HttpsError('failed-precondition', 'Nenhum evento dos autos corresponde à seleção');
    const folhasTxt = (m) => {
        const f = recorte.get(m.seq) || (0, autos_1.folhasDoEvento)(m, docsPorId);
        return f ? (0, autos_2.textoFolhas)(f[0], f[1] - f[0] + 1) : '';
    };
    if (sel.capa) {
        const w = new Escritor(pdf, font, bold, rodape);
        w.texto(String(o.orgNome || 'Órgão'), { size: 12, bold: true });
        w.texto('Processo Eletrônico', { size: 10, cor: [0.4, 0.4, 0.4], espaco: 20 });
        w.texto(`Processo nº ${proc.numero}`, { size: 18, bold: true });
        w.texto(String(proc.assunto || ''), { size: 13, espaco: 14 });
        if (parcial) {
            w.texto(sel.modo === 'intervalo'
                ? `CÓPIA PARCIAL DOS AUTOS: ${(0, autos_2.textoFolhas)(sel.folha_de, sel.folha_a - sel.folha_de + 1)}.`
                : `CÓPIA PARCIAL DOS AUTOS: ${escolhidos.length} de ${movimentos.length} eventos.`, { bold: true, cor: [0.7, 0.35, 0], espaco: 10 });
        }
        const fase = ((_a = (proc.fases || []).find((f) => f.id === proc.fase_atual)) === null || _a === void 0 ? void 0 : _a.nome) || proc.fase_atual;
        const situacao = { em_tramitacao: 'Em tramitação', sobrestado: 'Sobrestado', arquivado: 'Arquivado' }[proc.status] || proc.status;
        for (const [k, v] of [
            ['Rito', `${proc.rito_nome} (versão ${proc.rito_versao})`],
            ['Fase atual', fase],
            ['Situação', situacao],
            ['Unidade atual', o.nomeUnidade(String(proc.unidade_atual || ''))],
            ['Sigilo', proc.sigilo === 'restrito' ? 'Restrito' : 'Normal'],
            ...(proc.urgente === true ? [['Tramitação', `URGENTE${((_b = proc.urgencia) === null || _b === void 0 ? void 0 : _b.motivo) ? ` (${proc.urgencia.motivo})` : ''}`]] : []),
            ['Autuado em', `${quandoBR(proc.autuado_em)} por ${proc.autuado_por_nome}`],
            ...(o.equipe && proc.origem ? [['Origem', (0, secretaria_1.textoOrigem)(proc.origem)]] : []),
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
            ? `\nIntegridade: cadeia de ${movimentos.length} eventos conferida (SHA-256).`
            : `\nATENÇÃO: a cadeia de eventos não confere a partir do evento ${quebra}.`, { bold: quebra !== null, cor: quebra === null ? [0.1, 0.4, 0.2] : [0.7, 0.1, 0.1] });
    }
    // Índice: os atos de usuário, na ordem, com as folhas de cada um.
    if (sel.indice && atos.length) {
        const w = new Escritor(pdf, font, bold, rodape);
        w.texto('Índice dos autos', { size: 14, bold: true, espaco: 10 });
        for (const m of atos) {
            const d = docsPorId.get((0, autos_1.documentoDoEvento)(m) || '');
            w.texto(`Evento ${m.seq} · ${quandoBR(m.em)} · ${m.autor_nome}${unid(m.unidade_id)}${folhasTxt(m) ? ` · ${folhasTxt(m)}` : ''}`, { bold: true, size: 9, espaco: 0 });
            w.texto(d ? `Doc. nº ${d.ordem}: ${d.titulo} (${d.tipo})` : `${(0, autos_1.tituloEvento)(m)}. ${m.descricao}`, { size: 9, espaco: 0 });
            w.texto(`hash ${m.hash}`, { size: 6, cor: [0.5, 0.5, 0.5], espaco: 6 });
        }
    }
    // Peças em ordem cronológica: o documento juntado ou o termo do ato.
    const cfgs = new Map();
    const cfgDe = (u) => { if (!cfgs.has(u))
        cfgs.set(u, (0, autos_2.lerConfigDocumento)(o.db, o.orgId, u)); return cfgs.get(u); };
    let bytesAnexos = 0;
    let folhaLegado = 1; // processos anteriores às folhas gravadas
    const anexarDocumento = async (d, corte) => {
        let bytes;
        if (d.origem === 'upload' && bytesAnexos + (d.tamanho || 0) > LIMITE_ANEXOS_BYTES) {
            bytes = await (0, autos_2.folhaSimples)(String(d.titulo), [
                'Arquivo não incorporado: o PDF único dos autos passou do limite de tamanho.',
                'Baixe o documento avulso ou gere o PDF em partes; o hash abaixo permite conferir o original.',
                `SHA-256 ${d.sha256}`,
            ]);
        }
        else {
            bytes = await (0, autos_2.pdfDoDocumento)(d, await cfgDe(String(d.unidade_origem || '')));
            bytesAnexos += d.origem === 'upload' ? (d.tamanho || 0) : bytes.length;
        }
        const gravada = typeof d.folha_inicial === 'number';
        const folha = gravada ? d.folha_inicial : folhaLegado;
        const codigo = d.codigo_verificacao || await (0, autos_2.garantirCodigo)(o.db, o.orgId, o.ref.id, String(proc.numero), d.id);
        const qtd = await (0, autos_2.anexarCarimbado)(pdf, bytes, Object.assign({ processo: String(proc.numero), folha, ordem: d.ordem, titulo: String(d.titulo), juntadoEm: d.juntado_em, juntadoPor: d.juntado_por_nome, sha256: d.sha256, codigo }, (corte ? { paginas: [corte[0] - folha, corte[1] - folha] } : {})));
        if (!gravada)
            folhaLegado += qtd;
    };
    const anexados = new Set();
    for (const m of atos) {
        const docId = (0, autos_1.documentoDoEvento)(m);
        if (docId) {
            const d = docsPorId.get(docId);
            if (!d)
                continue; // documento que quem pede não pode ver
            anexados.add(docId);
            await anexarDocumento(d, recorte.get(m.seq));
        }
        else {
            await (0, autos_2.anexarCarimbado)(pdf, await termoPdf(String(o.orgNome || ''), String(proc.numero), m, o.nomeUnidade(String(m.unidade_id || ''))), {
                processo: String(proc.numero), folha: typeof m.folha === 'number' ? m.folha : null, titulo: (0, autos_1.tituloEvento)(m),
            });
        }
    }
    // Documento sem evento de juntada legível (dados antigos): entra ao fim da íntegra.
    if (!parcial)
        for (const d of docs)
            if (!anexados.has(String(d.id)))
                await anexarDocumento(d);
    // Registros do sistema, todos numa só seção.
    if (sistema.length) {
        const w = new Escritor(pdf, font, bold, rodape);
        w.texto('Extrato de registros do sistema', { size: 14, bold: true, espaco: 4 });
        w.texto('Registros automáticos e de controle interno, em ordem cronológica. Não ocupam folhas dos autos.', { size: 8, cor: [0.45, 0.45, 0.45], espaco: 10 });
        for (const m of sistema) {
            w.texto(`Evento ${m.seq} · ${quandoBR(m.em)} · ${m.autor_nome}${unid(m.unidade_id)}`, { bold: true, size: 9, espaco: 0 });
            w.texto(String(m.descricao), { size: 9, espaco: 0 });
            w.texto(`hash ${m.hash}`, { size: 6, cor: [0.5, 0.5, 0.5], espaco: 6 });
        }
    }
    if (!pdf.getPageCount())
        throw new https_1.HttpsError('failed-precondition', 'A seleção não tem nenhuma folha para gerar');
    return pdf.save();
}
exports.secretariaExportarPdf = (0, https_1.onCall)({ region: context_1.REGION, memory: '1GiB', timeoutSeconds: 120 }, async (request) => {
    var _a, _b, _c;
    const auth = (0, context_1.exigirAuth)(request);
    const c = await (0, context_1.carregarContexto)(auth, (_a = request.data) === null || _a === void 0 ? void 0 : _a.organizationId);
    const { ref, data: proc } = await (0, context_1.lerProcesso)(c, (_b = request.data) === null || _b === void 0 ? void 0 : _b.processoId);
    const selecao = selecaoOuErro((_c = request.data) === null || _c === void 0 ? void 0 : _c.selecao);
    const [movSnap, docSnap] = await Promise.all([
        ref.collection('movimentos').orderBy('seq').get(),
        ref.collection('documentos').where('status', '==', 'juntado').get(),
    ]);
    const movimentos = movSnap.docs.map((d) => d.data());
    const docs = docSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())))
        .sort((a, b) => a.ordem - b.ordem);
    const bytes = await montarPdfAutos({ db: c.db, orgId: c.orgId, orgNome: String(c.org.name || ''), ref, proc, movimentos, docs, geradoPor: c.userName, nomeUnidade: (id) => (0, context_1.nomeUnidade)(c, id), selecao, equipe: true });
    // Abrir uma peça no leitor não é exportação: só registra o PDF com capa ou de várias peças.
    if (selecao.capa || selecao.eventos.length !== 1)
        await (0, config_1.auditar)(c.db, c.orgId, auth.uid, c.userName, 'SECRETARIA_PDF_EXPORTADO', { processo_id: ref.id, numero: proc.numero, modo: selecao.modo });
    return { base64: Buffer.from(bytes).toString('base64'), nome: `processo-${String(proc.numero).replace('/', '-')}.pdf` };
});
//# sourceMappingURL=exportar.js.map