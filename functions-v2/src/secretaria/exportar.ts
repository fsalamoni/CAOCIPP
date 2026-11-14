import * as admin from 'firebase-admin';
import { numeroArquivo } from '../shared/numeracao';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { verificarCadeia } from '../shared/secretaria';
import { CampoValor } from '../shared/camposProcesso';
import { InformacaoAndamento, informacoesDaFolha, informacoesDoAndamento } from '../shared/informacoes';
import { secoesDaFolha, situacaoDaCapa } from '../shared/folhaDados';
import {
    Selecao, documentoDoEvento, documentoInterno, folhasDoEvento, origemEvento, registroInterno, sanitizeSelecao, sanitizeSelecaoInterna, selecionar, tituloEvento,
} from '../shared/autos';
import { minutaAcessivel } from '../shared/secretaria';
import { conteudoDoDocumento } from './autos';
import { renderizarDocumento } from './pdfDocumento';
import { REGION, carregarContexto, exigirAuth, lerProcesso, nomeUnidade } from './context';
import { auditar } from './config';
import { anexarCarimbado, folhaSimples, garantirCodigo, lerConfigDocumento, pdfDoDocumento, textoFolhas } from './autos';

/**
 * Exporta os autos em um PDF único: capa (só órgão, número, data da autuação e
 * se está ativo ou arquivado), a folha de dados do processo (a folha do evento
 * 1, a autuação), o índice dos eventos (com folhas e hash) e as demais peças,
 * em ordem cronológica. Cada ato de usuário tem a sua
 * página: o documento juntado (redigidos viram texto, PDFs entram página a
 * página, imagens como página, Word/planilha como folha de referência com o
 * hash) ou, sem documento, um termo de uma folha. Os registros do sistema
 * saem reunidos num extrato ao fim. `selecao` gera o PDF integral ou parcial
 * (apenas os eventos marcados, todos exceto eles, ou um intervalo de folhas).
 * Minutas nunca entram: só o que está nos autos. O que fica fora dos autos
 * tem a sua impressão, a interna (`montarPdfInterno`, pedido com `interno`).
 */

// ponytail: o PDF volta inteiro na resposta (limite ~32 MB do Cloud Run).
// Acima disso os anexos viram folha de referência; gravar no Storage e
// devolver link assinado quando processos grandes forem comuns.
const LIMITE_ANEXOS_BYTES = 18 * 1024 * 1024;

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 56;

/** Helvetica padrão só codifica WinAnsi; o resto vira '?'. */
const EXTRAS_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
function seguro(t: string): string {
    return Array.from(t.replace(/\t/g, '    ').replace(/\r/g, ''))
        .map((ch) => (ch === '\n' || (ch >= ' ' && ch.charCodeAt(0) < 256) || EXTRAS_WINANSI.includes(ch) ? ch : '?'))
        .join('');
}

class Escritor {
    page!: PDFPage;
    y = 0;
    constructor(private pdf: PDFDocument, private font: PDFFont, private bold: PDFFont, private rodape: string) {
        this.novaPagina();
    }
    novaPagina() {
        this.page = this.pdf.addPage(A4);
        this.y = A4[1] - MARGEM;
        this.page.drawText(seguro(this.rodape), { x: MARGEM, y: 28, size: 7, font: this.font, color: rgb(0.45, 0.45, 0.45) });
    }
    texto(t: string, opts: { size?: number; bold?: boolean; cor?: [number, number, number]; espaco?: number } = {}) {
        const size = opts.size || 10;
        const f = opts.bold ? this.bold : this.font;
        const largura = A4[0] - MARGEM * 2;
        for (const paragrafo of seguro(t).split('\n')) {
            const palavras = paragrafo.split(' ');
            let linha = '';
            const linhas: string[] = [];
            for (const w of palavras) {
                const tentativa = linha ? `${linha} ${w}` : w;
                if (f.widthOfTextAtSize(tentativa, size) > largura && linha) {
                    linhas.push(linha);
                    linha = w;
                } else linha = tentativa;
            }
            linhas.push(linha);
            for (const l of linhas) {
                if (this.y < MARGEM + size) this.novaPagina();
                this.page.drawText(l, { x: MARGEM, y: this.y - size, size, font: f, color: rgb(...(opts.cor || [0.1, 0.1, 0.1])) });
                this.y -= size * 1.4;
            }
        }
        this.y -= opts.espaco ?? 4;
    }
}

export interface OpcoesAutos {
    db: admin.firestore.Firestore;
    orgId: string;
    orgNome: string;
    ref: admin.firestore.DocumentReference;
    proc: admin.firestore.DocumentData;
    movimentos: admin.firestore.DocumentData[];
    docs: admin.firestore.DocumentData[];
    geradoPor: string;
    nomeUnidade: (id: string) => string;
    selecao?: Selecao;
    /** PDF da equipe: a folha de dados traz a origem (a referência é dado interno) e o CPF/CNPJ das partes. */
    equipe?: boolean;
    /** Folha de dados: campos do processo e informações do andamento, já filtrados para quem lê. */
    campos?: CampoValor[];
    informacoes?: InformacaoAndamento[];
}

export function selecaoOuErro(raw: unknown): Selecao {
    try { return sanitizeSelecao(raw); } catch (e) { throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'Seleção inválida'); }
}

const quandoBR = (iso: unknown) => new Date(String(iso)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const CINZA: [number, number, number] = [0.4, 0.4, 0.4];

/**
 * Folha de dados do processo: a página do evento 1 (autuação). Traz o termo
 * de autuação, os dados do processo e os que o rito manda para cá. Pode
 * passar de uma página; todas levam a folha do evento.
 */
async function folhaDadosPdf(o: OpcoesAutos, m: admin.firestore.DocumentData, geradoEm: string, integridade: string): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const w = new Escritor(pdf, await pdf.embedFont(StandardFonts.Helvetica), await pdf.embedFont(StandardFonts.HelveticaBold), '');
    const unidade = o.nomeUnidade(String(m.unidade_id || ''));
    w.y -= 40;
    w.texto(String(o.orgNome || 'Órgão'), { size: 11, bold: true, espaco: 2 });
    w.texto(`Processo nº ${o.proc.numero}`, { size: 10, cor: CINZA, espaco: 20 });
    w.texto('TERMO DE AUTUAÇÃO', { size: 14, bold: true, espaco: 4 });
    w.texto(`Evento nº ${m.seq} · Folha de dados do processo`, { size: 10, cor: CINZA, espaco: 14 });
    w.texto(String(m.descricao), { size: 10, espaco: 2 });
    w.texto(`Praticado por ${m.autor_nome}${unidade ? `, ${unidade}` : ''}, em ${quandoBR(m.em)}.`, { size: 9, cor: CINZA, espaco: 14 });
    const secoes = secoesDaFolha({
        proc: o.proc, equipe: o.equipe === true, campos: o.campos || [], informacoes: o.informacoes || [],
        unidadeAtual: o.nomeUnidade(String(o.proc.unidade_atual || '')), geradoEm, quando: quandoBR,
    });
    for (const s of secoes) {
        w.texto(s.titulo, { size: 10, bold: true, espaco: 3 });
        for (const it of s.itens) {
            w.texto(it.texto, { size: 10, espaco: it.nota ? 0 : 3 });
            if (it.nota) w.texto(it.nota, { size: 7.5, cor: CINZA, espaco: 4 });
        }
        w.y -= 8;
    }
    w.texto('Folha montada pela plataforma na impressão, com o registro da autuação, os dados do processo e os que o rito traz para cá. Cada dado vem de um evento do processo, conferido pela cadeia de hash.', { size: 8, cor: [0.45, 0.45, 0.45], espaco: 4 });
    w.texto(integridade, { size: 8, cor: [0.45, 0.45, 0.45], espaco: 4 });
    w.texto(`SHA-256 do evento: ${m.hash}`, { size: 7, cor: [0.45, 0.45, 0.45] });
    return pdf.save();
}

/** Página do ato de usuário que não juntou documento: o que foi feito, por quem e quando. */
async function termoPdf(orgNome: string, numero: string, m: admin.firestore.DocumentData, unidade: string): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const w = new Escritor(pdf, await pdf.embedFont(StandardFonts.Helvetica), await pdf.embedFont(StandardFonts.HelveticaBold), '');
    w.y -= 40;
    w.texto(orgNome || 'Órgão', { size: 11, bold: true, espaco: 2 });
    w.texto(`Processo nº ${numero}`, { size: 10, cor: [0.4, 0.4, 0.4], espaco: 36 });
    w.texto(tituloEvento(m as never).toUpperCase(), { size: 14, bold: true, espaco: 6 });
    w.texto(`Evento nº ${m.seq}`, { size: 10, cor: [0.4, 0.4, 0.4], espaco: 24 });
    w.texto(String(m.descricao), { size: 11, espaco: 24 });
    w.texto(`Praticado por ${m.autor_nome}${unidade ? `, ${unidade}` : ''}, em ${quandoBR(m.em)}.`, { size: 10, espaco: 30 });
    w.texto('Termo gerado pela plataforma a partir do registro do evento. A integridade é conferida pela cadeia de hash dos eventos do processo.', { size: 8, cor: [0.45, 0.45, 0.45], espaco: 4 });
    w.texto(`SHA-256 do evento: ${m.hash}`, { size: 7, cor: [0.45, 0.45, 0.45] });
    return pdf.save();
}

/** Monta o PDF único dos autos. A equipe passa tudo; o portal passa só o que a parte pode ver. */
export async function montarPdfAutos(o: OpcoesAutos): Promise<Uint8Array> {
    const { proc, movimentos, docs } = o;
    const quebra = verificarCadeia(movimentos as never);
    const unid = (id: unknown) => { const n = o.nomeUnidade(String(id || '')); return n ? ` (${n})` : ''; };
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Processo ${proc.numero}`);
    pdf.setCreator('SIGO — Processo Eletrônico');
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const rodape = `Processo ${proc.numero} — gerado em ${geradoEm} por ${o.geradoPor}`;
    const sel = o.selecao || sanitizeSelecao(null);
    const docsPorId = new Map(docs.map((d) => [String(d.id), d]));
    const { incluidos, recorte } = selecionar(movimentos as never, docsPorId, sel);
    const escolhidos = movimentos.filter((m) => incluidos.has(m.seq));
    const atos = escolhidos.filter((m) => origemEvento(m as never) === 'usuario');
    // O que o rito deixou só no sistema (`fora_impressao`) não sai em impressão nenhuma.
    const sistema = escolhidos.filter((m) => origemEvento(m as never) !== 'usuario' && m.dados?.fora_impressao !== true);
    const parcial = sel.modo !== 'integral';
    if (!escolhidos.length) throw new HttpsError('failed-precondition', 'Nenhum evento dos autos corresponde à seleção');
    const folhasTxt = (m: admin.firestore.DocumentData) => {
        const f = recorte.get(m.seq) || folhasDoEvento(m as never, docsPorId);
        return f ? textoFolhas(f[0], f[1] - f[0] + 1) : '';
    };

    const integridade = quebra === null
        ? `Integridade: cadeia de ${movimentos.length} eventos conferida (SHA-256).`
        : `ATENÇÃO: a cadeia de eventos não confere a partir do evento ${quebra}.`;
    // Capa: só o órgão, o número, a data da autuação e se está ativo ou arquivado.
    // O resto (assunto, rito, partes, dados) está na folha de dados, que é a folha do evento 1.
    if (sel.capa) {
        const w = new Escritor(pdf, font, bold, rodape);
        w.y -= 150;
        w.texto(String(o.orgNome || 'Órgão'), { size: 14, bold: true });
        w.texto('Processo Eletrônico', { size: 10, cor: CINZA, espaco: 30 });
        w.texto(`Processo nº ${proc.numero}`, { size: 22, bold: true, espaco: 18 });
        w.texto(`Autuado em ${new Date(String(proc.autuado_em)).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, { size: 12 });
        w.texto(`Situação: ${situacaoDaCapa(proc.status)}`, { size: 12, espaco: 24 });
        if (parcial) {
            w.texto(sel.modo === 'intervalo'
                ? `CÓPIA PARCIAL DOS AUTOS: ${textoFolhas(sel.folha_de!, sel.folha_a! - sel.folha_de! + 1)}.`
                : `CÓPIA PARCIAL DOS AUTOS: ${escolhidos.length} de ${movimentos.length} eventos.`, { bold: true, cor: [0.7, 0.35, 0], espaco: 10 });
        }
        // Cadeia que não confere é aviso de capa; conferida, a frase vai na folha de dados.
        if (quebra !== null) w.texto(integridade, { bold: true, cor: [0.7, 0.1, 0.1] });
    }

    // Peças: o documento juntado ou o termo do ato.
    const cfgs = new Map<string, ReturnType<typeof lerConfigDocumento>>();
    const cfgDe = (u: string) => { if (!cfgs.has(u)) cfgs.set(u, lerConfigDocumento(o.db, o.orgId, u)); return cfgs.get(u)!; };
    let bytesAnexos = 0;
    let folhaLegado = 1; // processos anteriores às folhas gravadas
    const anexarDocumento = async (d: admin.firestore.DocumentData, corte?: [number, number]) => {
        let bytes: Uint8Array;
        if (d.origem === 'upload' && bytesAnexos + (d.tamanho || 0) > LIMITE_ANEXOS_BYTES) {
            bytes = await folhaSimples(String(d.titulo), [
                'Arquivo não incorporado: o PDF único dos autos passou do limite de tamanho.',
                'Baixe o documento avulso ou gere o PDF em partes; o hash abaixo permite conferir o original.',
                `SHA-256 ${d.sha256}`,
            ]);
        } else {
            bytes = await pdfDoDocumento(d, await cfgDe(String(d.unidade_origem || '')));
            bytesAnexos += d.origem === 'upload' ? (d.tamanho || 0) : bytes.length;
        }
        const gravada = typeof d.folha_inicial === 'number';
        const folha = gravada ? d.folha_inicial : folhaLegado;
        const codigo = d.codigo_verificacao || await garantirCodigo(o.db, o.orgId, o.ref.id, String(proc.numero), d.id);
        const qtd = await anexarCarimbado(pdf, bytes, {
            processo: String(proc.numero), folha, ordem: d.ordem, titulo: String(d.titulo),
            juntadoEm: d.juntado_em, juntadoPor: d.juntado_por_nome, sha256: d.sha256, codigo,
            ...(corte ? { paginas: [corte[0] - folha, corte[1] - folha] as [number, number] } : {}),
        });
        if (!gravada) folhaLegado += qtd;
    };
    const anexados = new Set<string>();
    const anexarAto = async (m: admin.firestore.DocumentData) => {
        const docId = documentoDoEvento(m as never);
        if (docId) {
            const d = docsPorId.get(docId);
            if (!d) return; // documento que quem pede não pode ver
            anexados.add(docId);
            await anexarDocumento(d, recorte.get(m.seq));
            return;
        }
        const info = { processo: String(proc.numero), folha: typeof m.folha === 'number' ? m.folha : null, titulo: tituloEvento(m as never) };
        // A autuação é a folha de dados do processo; os demais atos sem documento, um termo de uma folha.
        if (m.tipo === 'autuacao') await anexarCarimbado(pdf, await folhaDadosPdf(o, m, geradoEm, integridade), { ...info, mesmaFolha: true });
        else await anexarCarimbado(pdf, await termoPdf(String(o.orgNome || ''), String(proc.numero), m, o.nomeUnidade(String(m.unidade_id || ''))), info);
    };
    // A folha de dados (evento 1) vem logo depois da capa: é a segunda folha do processo impresso.
    const autuacao = atos[0]?.tipo === 'autuacao' ? atos[0] : null;
    if (autuacao) await anexarAto(autuacao);

    // Índice: os atos de usuário, na ordem, com as folhas de cada um.
    if (sel.indice && atos.length) {
        const w = new Escritor(pdf, font, bold, rodape);
        w.texto('Índice dos autos', { size: 14, bold: true, espaco: 10 });
        for (const m of atos) {
            const d = docsPorId.get(documentoDoEvento(m as never) || '');
            w.texto(`Evento ${m.seq} · ${quandoBR(m.em)} · ${m.autor_nome}${unid(m.unidade_id)}${folhasTxt(m) ? ` · ${folhasTxt(m)}` : ''}`, { bold: true, size: 9, espaco: 0 });
            w.texto(d ? `Doc. nº ${d.ordem}: ${d.titulo} (${d.tipo})` : `${tituloEvento(m as never)}. ${m.descricao}`, { size: 9, espaco: 0 });
            w.texto(`hash ${m.hash}`, { size: 6, cor: [0.5, 0.5, 0.5], espaco: 6 });
        }
    }

    // As demais peças, em ordem cronológica.
    for (const m of atos) if (m !== autuacao) await anexarAto(m);
    // Documento sem evento de juntada legível (dados antigos): entra ao fim da íntegra.
    if (!parcial) for (const d of docs) if (!anexados.has(String(d.id))) await anexarDocumento(d);

    // Registros do sistema, todos numa só seção.
    if (sistema.length) {
        const w = new Escritor(pdf, font, bold, rodape);
        w.texto('Extrato de registros internos e do sistema', { size: 14, bold: true, espaco: 4 });
        w.texto('Registros automáticos, de controle interno e os que o rito deixa fora dos autos, em ordem cronológica. Não ocupam folhas dos autos.', { size: 8, cor: [0.45, 0.45, 0.45], espaco: 10 });
        for (const m of sistema) {
            w.texto(`Evento ${m.seq} · ${quandoBR(m.em)} · ${m.autor_nome}${unid(m.unidade_id)}`, { bold: true, size: 9, espaco: 0 });
            w.texto(String(m.descricao), { size: 9, espaco: 0 });
            w.texto(`hash ${m.hash}`, { size: 6, cor: [0.5, 0.5, 0.5], espaco: 6 });
        }
    }
    if (!pdf.getPageCount()) throw new HttpsError('failed-precondition', 'A seleção não tem nenhuma folha para gerar');

    return pdf.save();
}

/** Uma redação anterior de um documento (documentos/{doc}/versoes). */
type Versao = { autor_nome?: string; substituida_em?: string; sha256?: string; conteudo?: unknown };

export interface OpcoesInterno {
    db: admin.firestore.Firestore;
    orgId: string;
    orgNome: string;
    proc: admin.firestore.DocumentData;
    registros: admin.firestore.DocumentData[];
    documentos: admin.firestore.DocumentData[];
    /** Documentos com as redações anteriores a imprimir. */
    versoes: Array<{ doc: admin.firestore.DocumentData; versoes: Versao[] }>;
    geradoPor: string;
    nomeUnidade: (id: string) => string;
}

const rotuloInterno = (d: admin.firestore.DocumentData) => (d.status === 'controle' ? 'Documento guardado fora dos autos' : d.status === 'juntado' ? 'Documento dos autos' : 'Minuta');

/**
 * PDF de uso interno da equipe: registros que não são peça dos autos,
 * minutas, documentos guardados fora dos autos e redações anteriores, só o
 * que foi marcado. Não tem folhas nem carimbo dos autos, e toda página diz
 * que é de uso interno. Nunca é servido às partes.
 */
export async function montarPdfInterno(o: OpcoesInterno): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    pdf.setTitle(`Processo ${o.proc.numero} (uso interno)`);
    pdf.setCreator('SIGO — Processo Eletrônico');
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const rodape = `USO INTERNO · Processo ${o.proc.numero} · gerado em ${geradoEm} por ${o.geradoPor} · não integra os autos`;
    const ALERTA: [number, number, number] = [0.7, 0.35, 0];

    const w = new Escritor(pdf, font, bold, rodape);
    w.y -= 120;
    w.texto(String(o.orgNome || 'Órgão'), { size: 14, bold: true });
    w.texto('Processo Eletrônico', { size: 10, cor: CINZA, espaco: 30 });
    w.texto(`Processo nº ${o.proc.numero}`, { size: 22, bold: true, espaco: 14 });
    w.texto('IMPRESSÃO INTERNA', { size: 14, bold: true, cor: ALERTA, espaco: 6 });
    w.texto('Uso interno da equipe. Este PDF não integra os autos, não tem numeração de folhas e não deve ser entregue às partes. Traz só o que foi marcado: registros internos, minutas, documentos guardados fora dos autos e redações anteriores.', { size: 10, espaco: 18 });
    w.texto('Conteúdo', { size: 11, bold: true, espaco: 4 });
    if (o.registros.length) w.texto(`Registros internos: ${o.registros.length}`, { size: 10, espaco: 2 });
    for (const d of o.documentos) w.texto(`${rotuloInterno(d)}: ${d.titulo} (${d.tipo})`, { size: 10, espaco: 2 });
    for (const x of o.versoes) w.texto(`Redações anteriores de ${x.doc.titulo}: ${x.versoes.length}`, { size: 10, espaco: 2 });

    if (o.registros.length) {
        const r = new Escritor(pdf, font, bold, rodape);
        r.texto('Registros internos', { size: 14, bold: true, espaco: 4 });
        r.texto('Registros do andamento que não são peça dos autos, em ordem cronológica.', { size: 8, cor: [0.45, 0.45, 0.45], espaco: 10 });
        for (const m of o.registros) {
            const un = o.nomeUnidade(String(m.unidade_id || ''));
            r.texto(`Evento ${m.seq} · ${tituloEvento(m as never)}`, { bold: true, size: 10, espaco: 0 });
            r.texto(`${quandoBR(m.em)} · ${m.autor_nome}${un ? ` (${un})` : ''}`, { size: 8, cor: CINZA, espaco: 2 });
            r.texto(String(m.descricao), { size: 10, espaco: 10 });
        }
    }

    const cfgs = new Map<string, ReturnType<typeof lerConfigDocumento>>();
    const cfgDe = (u: string) => { if (!cfgs.has(u)) cfgs.set(u, lerConfigDocumento(o.db, o.orgId, u)); return cfgs.get(u)!; };
    let bytesAnexos = 0;
    /** Copia as páginas e marca cada uma no alto: o que é, e que é de uso interno. */
    const anexar = async (bytes: Uint8Array, faixa: string) => {
        const origem = await PDFDocument.load(bytes, { ignoreEncryption: true });
        for (const pg of await pdf.copyPages(origem, origem.getPageIndices())) {
            pdf.addPage(pg);
            pg.drawText(seguro(faixa).slice(0, 130), { x: 24, y: pg.getHeight() - 16, size: 7, font, color: rgb(...ALERTA) });
        }
    };
    for (const d of o.documentos) {
        const faixa = `USO INTERNO · ${rotuloInterno(d)}: ${d.titulo} · não integra os autos`;
        if (d.origem === 'upload' && bytesAnexos + (d.tamanho || 0) > LIMITE_ANEXOS_BYTES) {
            await anexar(await folhaSimples(String(d.titulo), ['Arquivo não incorporado: o PDF passou do limite de tamanho.', 'Baixe o documento avulso no Processo Eletrônico.', `SHA-256 ${d.sha256}`]), faixa);
            continue;
        }
        const cfg = await cfgDe(String(d.unidade_origem || ''));
        const bytes = d.origem === 'editor'
            ? (await renderizarDocumento(conteudoDoDocumento(d), cfg, { assinaturas: d.assinaturas || [], sha256: d.sha256, marcaDagua: d.status === 'controle' ? 'FORA DOS AUTOS' : 'MINUTA' })).buffer
            : await pdfDoDocumento(d, cfg);
        bytesAnexos += d.origem === 'upload' ? (d.tamanho || 0) : bytes.length;
        await anexar(bytes, faixa);
    }
    for (const x of o.versoes) {
        const cfg = await cfgDe(String(x.doc.unidade_origem || ''));
        for (const [i, v] of x.versoes.entries()) {
            const r = await renderizarDocumento(v.conteudo as never, cfg, { assinaturas: [], sha256: v.sha256, marcaDagua: 'VERSÃO ANTERIOR' });
            await anexar(r.buffer, `USO INTERNO · ${i === 0 ? 'Redação original' : `${i + 1}ª redação`} de ${x.doc.titulo}, por ${v.autor_nome || 'autor não identificado'} · revista em ${quandoBR(v.substituida_em)}`);
        }
    }
    return pdf.save();
}

export const secretariaExportarPdf = onCall<{ organizationId: string; processoId: string; selecao?: unknown; interno?: unknown }>(
    { region: REGION, memory: '1GiB', timeoutSeconds: 120 },
    async (request) => {
        const auth = exigirAuth(request);
        const c = await carregarContexto(auth, request.data?.organizationId);
        const { ref, data: proc } = await lerProcesso(c, request.data?.processoId);
        // Impressão interna: só o que a pessoa marcou e pode ver. As partes não chegam aqui (o portal tem a sua função).
        if (request.data?.interno) {
            let si;
            try { si = sanitizeSelecaoInterna(request.data.interno); } catch (e) { throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'Seleção inválida'); }
            const lerDocs = async (ids: string[]) => (await Promise.all(ids.map((id) => ref.collection('documentos').doc(id).get())))
                .filter((s) => s.exists).map((s) => ({ id: s.id, ...s.data() } as admin.firestore.DocumentData));
            const minha = (d: admin.firestore.DocumentData) => minutaAcessivel(d, c.ctx.unidadeIds);
            const marcados = new Set(si.registros);
            const [movSnap, docsLidos, docsVersoes] = await Promise.all([
                si.registros.length ? ref.collection('movimentos').orderBy('seq').get() : null,
                lerDocs(si.documentos), lerDocs(si.versoes),
            ]);
            const registros = (movSnap?.docs || []).map((d) => d.data()).filter((m) => marcados.has(m.seq) && registroInterno(m as never));
            const documentos = docsLidos.filter((d) => documentoInterno(d, minha(d)))
                .sort((a, b) => String(a.criado_em).localeCompare(String(b.criado_em)));
            // Redações anteriores: a mesma regra de quem vê o documento.
            const versoes = (await Promise.all(docsVersoes
                .filter((d) => d.status === 'juntado' || d.status === 'controle' || minha(d))
                .map(async (d) => ({
                    doc: d,
                    versoes: (await ref.collection('documentos').doc(String(d.id)).collection('versoes').get()).docs.map((v) => v.data() as Versao)
                        .sort((a, b) => String(a.substituida_em).localeCompare(String(b.substituida_em))),
                })))).filter((x) => x.versoes.length);
            if (!registros.length && !documentos.length && !versoes.length) throw new HttpsError('failed-precondition', 'Nada do que foi marcado pode sair na impressão interna');
            const bytes = await montarPdfInterno({
                db: c.db, orgId: c.orgId, orgNome: String(c.org.name || ''), proc, registros, documentos, versoes, geradoPor: c.userName, nomeUnidade: (id) => nomeUnidade(c, id),
            });
            await auditar(c.db, c.orgId, auth.uid, c.userName, 'SECRETARIA_PDF_INTERNO_EXPORTADO', {
                processo_id: ref.id, numero: proc.numero, registros: registros.length, documentos: documentos.length, versoes: versoes.reduce((n, x) => n + x.versoes.length, 0),
            });
            return { base64: Buffer.from(bytes).toString('base64'), nome: `interno-processo-${numeroArquivo(proc.numero)}.pdf` };
        }
        const selecao = selecaoOuErro(request.data?.selecao);
        const [movSnap, docSnap] = await Promise.all([
            ref.collection('movimentos').orderBy('seq').get(),
            ref.collection('documentos').where('status', '==', 'juntado').get(),
        ]);
        const movimentos = movSnap.docs.map((d) => d.data());
        const docs = docSnap.docs.map((d) => ({ id: d.id, ...d.data() } as admin.firestore.DocumentData))
            .sort((a, b) => a.ordem - b.ordem);

        const bytes = await montarPdfAutos({
            db: c.db, orgId: c.orgId, orgNome: String(c.org.name || ''), ref, proc, movimentos, docs, geradoPor: c.userName, nomeUnidade: (id) => nomeUnidade(c, id), selecao, equipe: true,
            campos: (proc.campos || []) as CampoValor[],
            informacoes: informacoesDaFolha(informacoesDoAndamento(movimentos as never, proc.fases || [])),
        });
        // Abrir uma peça no leitor não é exportação: só registra o PDF com capa ou de várias peças.
        if (selecao.capa || selecao.eventos.length !== 1) await auditar(c.db, c.orgId, auth.uid, c.userName, 'SECRETARIA_PDF_EXPORTADO', { processo_id: ref.id, numero: proc.numero, modo: selecao.modo });
        return { base64: Buffer.from(bytes).toString('base64'), nome: `processo-${numeroArquivo(proc.numero)}.pdf` };
    }
);
