// ============================================================================
// Exportação do rito para fora do SIGO: planilha, Mermaid, BPMN 2.0 (o formato
// que Bizagi Modeler, Camunda, bpmn.io e draw.io abrem) e imagem (SVG, de onde
// saem o PNG e o PDF). Lógica pura, testada em src/lib/exportarRito.test.js;
// quem baixa os arquivos é components/secretaria/ExportarRito.
//
// O desenho (imagem e BPMN) vem de lib/fluxoBpmn.js com `completo`: uma faixa
// só, uma raia por unidade, nenhum texto cortado, do tamanho que precisar.
// Tudo o que sai daqui volta pela importação do rito (lib/propostaRito.js), e
// o teste confere essa ida e volta em todos os modelos da biblioteca.
// ============================================================================

import { seguintes } from './secretariaRito.js';
import { desenharFluxo, itensDaFase, rotuloSaida } from './fluxoBpmn.js';
import { resumoDaAcao, textoCondicao } from './exigencias.js';

export const FORMATOS = [
    { id: 'bpmn', nome: 'Bizagi e BPMN 2.0', ext: 'bpmn', texto: 'Diagrama editável, com as raias por unidade. Abre no Bizagi Modeler (Importar, BPMN), no Camunda, no bpmn.io e no draw.io.' },
    { id: 'png', nome: 'Imagem (PNG)', ext: 'png', texto: 'O rito inteiro numa imagem só, do tamanho que precisar, para colar em documento ou apresentação.' },
    { id: 'pdf', nome: 'PDF', ext: 'pdf', texto: 'O mesmo desenho numa página única, do tamanho do rito, para imprimir ou enviar.' },
    { id: 'svg', nome: 'Imagem vetorial (SVG)', ext: 'svg', texto: 'O mesmo desenho sem perder nitidez ao ampliar. Abre no navegador, no Inkscape e no Illustrator.' },
    { id: 'xlsx', nome: 'Planilha (Excel)', ext: 'xlsx', texto: 'Fases, unidades, prazos, ações, saídas e condições, mais uma aba com o detalhe de cada ação.' },
    { id: 'mmd', nome: 'Mermaid', ext: 'mmd', texto: 'Diagrama em texto, para o mermaid.live, o GitHub, o Notion e o draw.io.' },
];

/** Nome de arquivo seguro, com a extensão do formato. */
export function nomeDoArquivo(nome, ext) {
    const base = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'rito';
    return `${base}.${ext}`;
}

/** Nome da raia de uma fase: o que a fase traz ou a unidade do órgão. */
export function raiaPadrao(unidades) {
    const porId = new Map((unidades || []).map((u) => [u.id, u.sigla || u.nome]));
    return (f) => f.raia || porId.get(f.unidade_id) || (typeof f.unidade === 'string' ? f.unidade : '') || '';
}

const nomeComPrazo = (f) => `${String(f.nome || '').trim()}${f.prazo_dias ? ` (${f.prazo_dias} dias${f.prazo_contagem === 'corridos' ? ' corridos' : ''})` : ''}`;
const tipoDaFase = (fases, i) => (fases[i].final ? 'Fim' : fases[i].espera && i > 0 ? 'Espera' : i === 0 ? 'Início' : '');

// ---- Planilha ---------------------------------------------------------------

/** A ação numa célula só: sem o que a importação lê como separador de ações (o texto exato fica na aba de detalhe). */
const umaAcao = (s) => String(s ?? '').replace(/;/g, ',').replace(/\s\|\s/g, ' / ').replace(/•/g, '-').replace(/\s+/g, ' ').trim();

/**
 * Abas da planilha ([{ nome, linhas, larguras }]). A primeira é a que a
 * importação lê: uma linha por saída ou ação da fase (a célula da fase vazia
 * continua a fase de cima). A segunda detalha as ações e não tem coluna "Fase",
 * para a importação não a confundir com outra lista de fases.
 */
export function ritoParaAbas(fases, raiaDe = () => '') {
    const nome = (id) => fases.find((f) => f.id === id)?.nome || id;
    const rito = [['Nº', 'Fase', 'Unidade', 'Prazo (dias)', 'Contagem', 'Tipo', 'Ações', 'Segue para', 'Condição', 'Orientação']];
    const acoes = [['Nº da fase', 'Em qual fase', 'Ordem', 'Ação', 'O que pede', 'Só se']];
    fases.forEach((f, i) => {
        const itens = itensDaFase(f, fases).filter((x) => x.tipo === 'acao');
        // Fase final diz "Fim"; fase de espera não tem saída escrita (volta para de onde veio).
        const saidas = f.final ? [{ para: 'Fim', cond: '' }] : (f.espera && i > 0 ? [] : seguintes(fases, i)).map((id) => ({ para: nome(id), cond: rotuloSaida(f, id, fases) }));
        const n = Math.max(1, itens.length, saidas.length);
        for (let k = 0; k < n; k++) {
            rito.push(k === 0
                ? [i + 1, f.nome, raiaDe(f) || '', f.prazo_dias || '', f.prazo_dias ? (f.prazo_contagem === 'corridos' ? 'dias corridos' : 'dias úteis') : '', tipoDaFase(fases, i), umaAcao(itens[0]?.nome), saidas[0]?.para || '', saidas[0]?.cond || '', f.orientacao || '']
                : ['', '', '', '', '', '', umaAcao(itens[k]?.nome), saidas[k]?.para || '', saidas[k]?.cond || '', '']);
        }
        itens.forEach((it, k) => {
            const r = f.acoes_regras?.[it.indice];
            acoes.push([i + 1, f.nome, k + 1, it.nome, it.resumo || resumoDaAcao(r) || '', r?.se ? textoCondicao(f, r.se, fases) : '']);
        });
    });
    return [
        { nome: 'Rito', linhas: rito, larguras: [5, 34, 22, 12, 14, 9, 46, 34, 40, 80] },
        ...(acoes.length > 1 ? [{ nome: 'Ações em detalhe', linhas: acoes, larguras: [10, 34, 7, 50, 60, 40] }] : []),
    ];
}

// ---- Mermaid ----------------------------------------------------------------

/** Texto que cabe num rótulo entre aspas, sem o que quebra o Mermaid ou a leitura de volta. */
const mmd = (s) => String(s ?? '').replace(/"/g, "'").replace(/\[/g, '(').replace(/\]/g, ')').replace(/[{}]/g, ' ').replace(/\|/g, '/').replace(/;/g, ',').replace(/%%+/g, '%')
    .replace(/[<>]/g, ' ').replace(/#/g, 'nº ').replace(/\s+/g, ' ').trim();

/**
 * Fluxograma Mermaid, da esquerda para a direita: um subgraph por unidade,
 * círculo de início e de fim e a condição escrita em cada seta. Todo rótulo
 * vai entre aspas, para acento, dois-pontos e parênteses não quebrarem.
 */
export function ritoParaMermaid(fases, raiaDe = () => '') {
    const chave = new Map(fases.map((f, i) => [f.id, `F${i + 1}`]));
    const linhas = ['flowchart LR', '    INICIO(("Início"))'];
    const raias = new Map();
    fases.forEach((f) => { const r = String(raiaDe(f) || '').trim(); if (!raias.has(r)) raias.set(r, []); raias.get(r).push(f); });
    let u = 0;
    for (const [raia, lista] of raias) {
        const recuo = raia ? '        ' : '    ';
        if (raia) linhas.push(`    subgraph U${++u}["${mmd(raia)}"]`);
        for (const f of lista) linhas.push(`${recuo}${chave.get(f.id)}["${mmd(nomeComPrazo(f))}"]`);
        if (raia) linhas.push('    end');
    }
    if (fases.length) linhas.push(`    INICIO --> ${chave.get(fases[0].id)}`);
    let fim = 0;
    fases.forEach((f, i) => {
        const s = seguintes(fases, i);
        if (!s.length) { linhas.push(`    FIM${++fim}(("Fim"))`, `    ${chave.get(f.id)} --> FIM${fim}`); return; }
        for (const id of s) {
            const rot = mmd(rotuloSaida(f, id, fases));
            linhas.push(`    ${chave.get(f.id)} -->${rot ? `|"${rot}"|` : ''} ${chave.get(id)}`);
        }
    });
    return `${linhas.join('\n')}\n`;
}

// ---- Desenho (base da imagem e do BPMN) --------------------------------------

/** O rito inteiro numa faixa só, sem cortar texto. */
export const desenhoCompleto = (fases, raiaDe = () => '', acoes = false) => desenharFluxo(fases, raiaDe, Infinity, { acoes, completo: true });

const x = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n1 = (v) => Math.round(v * 10) / 10;

// ---- BPMN 2.0 ---------------------------------------------------------------

const NS = 'xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"';
const FAIXA_PISCINA = 30; // faixa do nome do processo, à esquerda das raias

/** O que a fase pede, em texto, para a descrição da tarefa no diagrama. */
function documentacaoDaFase(f, fases) {
    const itens = itensDaFase(f, fases);
    const linhas = [];
    if (f.orientacao) linhas.push(String(f.orientacao).trim());
    if (f.prazo_dias) linhas.push(`Prazo: ${f.prazo_dias} dias${f.prazo_contagem === 'corridos' ? ' corridos' : ' úteis'}.`);
    if (f.espera) linhas.push('Fase de espera: o processo volta para a fase de onde veio.');
    if (itens.length) {
        linhas.push('Ações:');
        let k = 0;
        for (const it of itens) linhas.push(it.tipo === 'desvio' ? `${it.texto}:` : `${++k}. ${it.ou ? '(ou) ' : ''}${it.nome}${it.orienta ? ' (orientação)' : ''}`);
    }
    return linhas.join('\n');
}

/**
 * BPMN 2.0 com o desenho (BPMNDI): uma piscina com o nome do rito, uma raia por
 * unidade, evento de início, uma tarefa por fase, desvio exclusivo quando a
 * fase tem mais de uma saída (a condição é o nome do fluxo) e evento de fim.
 * As ações e a orientação de cada fase vão na documentação da tarefa.
 */
export function ritoParaBpmn(fases, { nome = 'Rito', raiaDe = () => '' } = {}) {
    const lista = (fases || []).filter((f) => String(f.nome || '').trim());
    if (!lista.length) return '';
    const g = desenhoCompleto(lista, raiaDe, false);
    const dx = g.raias[0]?.cab ? FAIXA_PISCINA + 10 : 10;
    const dy = 10;
    const idx = new Map(lista.map((f, i) => [f.id, i]));
    const T = (id) => `Fase_${idx.get(id) + 1}`;
    const G = (id) => `Desvio_${idx.get(id) + 1}`;
    const E = (id) => `Fim_${idx.get(id) + 1}`;
    const temDesvio = new Set(g.desvios.map((d) => d.id));
    const nos = []; // { id, xml, cx, cy, caixa }
    nos.push({ id: 'Inicio', cy: g.inicio.cy, xml: (io) => `<startEvent id="Inicio" name="Início">${io}</startEvent>`, caixa: [g.inicio.cx - 15, g.inicio.cy - 15, 30, 30], evento: true });
    g.tarefas.forEach((t) => {
        const f = lista[t.indice];
        const doc = documentacaoDaFase(f, lista);
        nos.push({ id: T(f.id), cy: t.cy, xml: (io) => `<task id="${T(f.id)}" name="${x(nomeComPrazo(f))}">${doc ? `<documentation>${x(doc)}</documentation>` : ''}${io}</task>`, caixa: [t.x, t.y, t.w, t.th] });
    });
    g.desvios.forEach((d) => nos.push({ id: G(d.id), cy: d.cy, xml: (io) => `<exclusiveGateway id="${G(d.id)}" gatewayDirection="Diverging">${io}</exclusiveGateway>`, caixa: [d.cx - d.r, d.cy - d.r, 2 * d.r, 2 * d.r], desvio: true }));
    g.fins.forEach((d) => nos.push({ id: E(d.id), cy: d.cy, xml: (io) => `<endEvent id="${E(d.id)}" name="Fim">${io}</endEvent>`, caixa: [d.cx - 15, d.cy - 15, 30, 30], evento: true }));

    // Fluxos, na ordem do desenho. O último ponto encosta na borda do alvo.
    const fluxos = g.setas.map((s, k) => {
        const de = s.tipo === 'inicio' ? 'Inicio' : s.tipo === 'desvio' || s.tipo === 'fim' || !temDesvio.has(s.de) ? T(s.de) : G(s.de);
        const para = s.tipo === 'desvio' ? G(s.de) : s.tipo === 'fim' ? E(s.de) : T(s.para);
        const pts = s.pts.map((p) => [...p]);
        const alvo = nos.find((n) => n.id === para).caixa;
        pts[pts.length - 1][0] = alvo[0];
        return { id: `Fluxo_${k + 1}`, de, para, nome: s.rotuloCompleto || '', pts, rx: s.rx, ry: s.ry };
    });
    const entra = (id) => fluxos.filter((f) => f.para === id).map((f) => `<incoming>${f.id}</incoming>`).join('');
    const sai = (id) => fluxos.filter((f) => f.de === id).map((f) => `<outgoing>${f.id}</outgoing>`).join('');

    const raias = g.raias.filter((r) => r.cab > 0).map((r, k) => ({ ...r, id: `Raia_${k + 1}`, nos: nos.filter((n) => n.cy >= r.y && n.cy < r.y + r.altura) }));
    const out = ['<?xml version="1.0" encoding="UTF-8"?>',
        `<definitions ${NS} id="Definicoes_1" targetNamespace="http://sigo.caocipp/rito" exporter="SIGO" exporterVersion="1.0">`,
        '  <collaboration id="Colaboracao_1">', `    <participant id="Piscina_1" name="${x(nome)}" processRef="Processo_1"/>`, '  </collaboration>',
        `  <process id="Processo_1" name="${x(nome)}" isExecutable="false">`];
    if (raias.length) {
        out.push('    <laneSet id="Raias_1">');
        for (const r of raias) out.push(`      <lane id="${r.id}" name="${x(r.nome)}">${r.nos.map((n) => `<flowNodeRef>${n.id}</flowNodeRef>`).join('')}</lane>`);
        out.push('    </laneSet>');
    }
    for (const n of nos) out.push(`    ${n.xml(entra(n.id) + sai(n.id))}`);
    for (const f of fluxos) out.push(`    <sequenceFlow id="${f.id}"${f.nome ? ` name="${x(f.nome)}"` : ''} sourceRef="${f.de}" targetRef="${f.para}"/>`);
    out.push('  </process>', '  <bpmndi:BPMNDiagram id="Diagrama_1" name="' + x(nome) + '">', '    <bpmndi:BPMNPlane id="Plano_1" bpmnElement="Colaboracao_1">');
    const caixa = (c) => `<dc:Bounds x="${n1(c[0] + dx)}" y="${n1(c[1] + dy)}" width="${n1(c[2])}" height="${n1(c[3])}"/>`;
    const topo = Math.min(...g.raias.map((r) => r.y));
    const base = Math.max(...g.raias.map((r) => r.y + r.altura));
    const larg = g.raias[0].largura;
    const px = g.raias[0].x - (raias.length ? FAIXA_PISCINA : 0);
    out.push(`      <bpmndi:BPMNShape id="Piscina_1_di" bpmnElement="Piscina_1" isHorizontal="true">${caixa([px, topo, larg + (raias.length ? FAIXA_PISCINA : 0), base - topo])}</bpmndi:BPMNShape>`);
    for (const r of raias) out.push(`      <bpmndi:BPMNShape id="${r.id}_di" bpmnElement="${r.id}" isHorizontal="true">${caixa([r.x, r.y, r.largura, r.altura])}</bpmndi:BPMNShape>`);
    for (const n of nos) {
        const rot = n.evento ? `<bpmndi:BPMNLabel>${caixa([n.caixa[0] - 5, n.caixa[1] + 32, 40, 14])}</bpmndi:BPMNLabel>` : '';
        out.push(`      <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}"${n.desvio ? ' isMarkerVisible="true"' : ''}>${caixa(n.caixa)}${rot}</bpmndi:BPMNShape>`);
    }
    for (const f of fluxos) {
        const w = Math.min(f.nome.length, 400) * 5.4;
        const rot = f.nome ? `<bpmndi:BPMNLabel>${caixa([f.rx - w, f.ry - 11, w, 14])}</bpmndi:BPMNLabel>` : '';
        out.push(`      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">${f.pts.map((p) => `<di:waypoint x="${n1(p[0] + dx)}" y="${n1(p[1] + dy)}"/>`).join('')}${rot}</bpmndi:BPMNEdge>`);
    }
    out.push('    </bpmndi:BPMNPlane>', '  </bpmndi:BPMNDiagram>', '</definitions>', '');
    return out.join('\n');
}

// ---- Imagem (SVG) -----------------------------------------------------------

const COR = { linha: '#475569', texto: '#0f172a', fraco: '#475569', raia: '#94a3b8', cab: '#f1f5f9', tarefa1: '#f5f9fe', tarefa2: '#d6e6f7', borda: '#2c6aa8', moldura: '#f8fafc', topo: '#e0e7ff' };
const FONTE = 'Arial, Helvetica, sans-serif';
const TITULO = 34; // faixa do nome do rito, acima do desenho

/**
 * O desenho do rito num SVG independente (cores e fonte próprias, fundo
 * branco), do tamanho exato do rito: uma faixa, uma raia por unidade, nada
 * cortado. `acoes`: cada fase mostra dentro as ações e os desvios.
 * Devolve { svg, largura, altura }.
 */
export function ritoParaSvg(fases, { nome = '', raiaDe = () => '', acoes = true } = {}) {
    const lista = (fases || []).filter((f) => String(f.nome || '').trim());
    if (!lista.length) return { svg: '', largura: 0, altura: 0 };
    const g = desenhoCompleto(lista, raiaDe, acoes);
    const topo = nome ? TITULO : 0;
    const largura = Math.max(g.largura, nome ? 40 + nome.length * 8 : 0);
    const altura = g.altura + topo;
    const o = [];
    const txt = (px, py, t, extra = '') => `<text x="${n1(px)}" y="${n1(py)}" ${extra}>${x(t)}</text>`;
    const losango = (cx, cy, r, sw) => `<path d="M${cx - r},${cy} L${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} z" fill="#fff7c2" stroke="#a58a00" stroke-width="${sw}"/>`;
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}" font-family="${FONTE}">`);
    o.push(`<title>${x(nome || 'Fluxo do rito')}</title>`);
    o.push('<defs>',
        `<marker id="seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${COR.linha}"/></marker>`,
        `<marker id="seta-p" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#64748b"/></marker>`,
        `<linearGradient id="tarefa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COR.tarefa1}"/><stop offset="1" stop-color="${COR.tarefa2}"/></linearGradient>`,
        '</defs>');
    o.push(`<rect width="${largura}" height="${altura}" fill="#ffffff"/>`);
    if (nome) o.push(txt(10, 23, nome, `font-size="15" font-weight="700" fill="${COR.texto}"`));
    o.push(`<g transform="translate(0,${topo})">`);
    for (const r of g.raias) {
        o.push(`<rect x="${r.x}" y="${n1(r.y)}" width="${r.largura}" height="${n1(r.altura)}" fill="#ffffff" stroke="${COR.raia}"/>`);
        if (r.cab > 0) {
            o.push(`<rect x="${r.x}" y="${n1(r.y)}" width="${r.cab}" height="${n1(r.altura)}" fill="${COR.cab}" stroke="${COR.raia}"/>`);
            // O nome da raia inteiro: a letra diminui se a raia for baixa demais para ele.
            const fs = Math.max(6, Math.min(10, (r.altura - 8) / (r.nome.length * 0.56)));
            o.push(`<text transform="translate(${r.x + r.cab / 2},${n1(r.y + r.altura / 2)}) rotate(-90)" text-anchor="middle" font-size="${n1(fs)}" font-weight="600" fill="#334155"><tspan x="0" y="4">${x(r.nome)}</tspan></text>`);
        }
    }
    for (const s of g.setas) {
        o.push(`<path d="${s.d}" fill="none" stroke="${COR.linha}" stroke-width="1.4" stroke-linejoin="round"${s.tipo === 'fim' || s.tipo === 'desvio' ? '' : ' marker-end="url(#seta)"'}${s.tipo === 'volta' ? ' stroke-dasharray="5 4"' : ''}/>`);
    }
    for (const s of g.setas.filter((q) => q.rotulo)) {
        o.push(txt(s.rx, s.ry, s.rotulo, `text-anchor="end" font-size="10" font-style="italic" paint-order="stroke" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round" fill="#1e293b"`));
    }
    o.push(`<circle cx="${n1(g.inicio.cx)}" cy="${n1(g.inicio.cy)}" r="${g.inicio.r}" fill="#e6f4c8" stroke="#5b9a12" stroke-width="1.5"/>`);
    for (const d of g.desvios) {
        o.push(losango(n1(d.cx), n1(d.cy), d.r, 1.4));
        o.push(`<path d="M${n1(d.cx - 5)},${n1(d.cy - 5)} L${n1(d.cx + 5)},${n1(d.cy + 5)} M${n1(d.cx + 5)},${n1(d.cy - 5)} L${n1(d.cx - 5)},${n1(d.cy + 5)}" stroke="#7a6600" stroke-width="1.8"/>`);
    }
    for (const f of g.fins) o.push(`<circle cx="${n1(f.cx)}" cy="${n1(f.cy)}" r="${f.r}" fill="#f8d2d2" stroke="#a61b1b" stroke-width="3.5"/>`);
    for (const t of g.tarefas) {
        const alturaTexto = t.linhas.length * 12 + (t.prazo ? 12 : 0);
        const y0 = t.y + (t.th - alturaTexto) / 2 + 9;
        if (g.comAcoes) {
            o.push(`<rect x="${n1(t.x)}" y="${n1(t.y)}" width="${t.w}" height="${n1(t.h)}" rx="8" fill="${COR.moldura}" stroke="#64748b" stroke-width="1.4"/>`);
            o.push(`<path d="M${n1(t.x + 0.7)},${n1(t.y + t.th)} V${n1(t.y + 8)} Q${n1(t.x + 0.7)},${n1(t.y + 0.7)} ${n1(t.x + 8)},${n1(t.y + 0.7)} H${n1(t.x + t.w - 8)} Q${n1(t.x + t.w - 0.7)},${n1(t.y + 0.7)} ${n1(t.x + t.w - 0.7)},${n1(t.y + 8)} V${n1(t.y + t.th)} z" fill="${COR.topo}"/>`);
            if (t.dentro) o.push(`<path d="M${n1(t.x)},${n1(t.y + t.th)} H${n1(t.x + t.w)}" stroke="${COR.raia}"/>`);
            else o.push(`<rect x="${n1(t.x)}" y="${n1(t.y)}" width="${t.w}" height="${n1(t.h)}" rx="8" fill="${COR.topo}" stroke="#64748b" stroke-width="1.4"/>`);
        } else {
            o.push(`<rect x="${n1(t.x)}" y="${n1(t.y)}" width="${t.w}" height="${n1(t.h)}" rx="8" fill="url(#tarefa)" stroke="${COR.borda}" stroke-width="1.4"/>`);
        }
        t.linhas.forEach((l, k) => o.push(txt(t.cx, y0 + k * 12, l, `text-anchor="middle" font-size="10.5" font-weight="${g.comAcoes ? 700 : 500}" fill="${COR.texto}"`)));
        if (t.prazo) o.push(txt(t.cx, y0 + t.linhas.length * 12, `${t.prazo} dias`, `text-anchor="middle" font-size="9.5" fill="${COR.fraco}"`));
        if (!t.dentro) continue;
        for (const l of t.dentro.ligacoes) o.push(`<path d="${l.d}" fill="none" stroke="#64748b" stroke-width="1.1" stroke-linejoin="round"${l.tipo === 'passo' ? ' marker-end="url(#seta-p)"' : ''}/>`);
        for (const r of t.dentro.rotulos) o.push(txt(r.x, r.y, r.texto, `text-anchor="${r.ancora}" font-size="8.5" fill="${COR.fraco}"`));
        for (const n of t.dentro.nos) {
            if (n.tipo === 'desvio') {
                n.linhas.forEach((l, j) => o.push(txt(n.cx, n.ly + j * 11, l, `text-anchor="middle" font-size="9" font-style="italic" fill="#1e293b"`)));
                o.push(losango(n1(n.cx), n1(n.cy), n.r, 1.2));
            } else {
                o.push(n.orienta
                    ? `<rect x="${n1(n.x)}" y="${n1(n.y)}" width="${n1(n.w)}" height="${n1(n.h)}" rx="5" fill="#ffffff" stroke="#64748b" stroke-dasharray="2 2"/>`
                    : `<rect x="${n1(n.x)}" y="${n1(n.y)}" width="${n1(n.w)}" height="${n1(n.h)}" rx="5" fill="url(#tarefa)" stroke="${COR.borda}" stroke-width="1.1"${n.nivel === 'opcional' ? ' stroke-dasharray="4 3"' : ''}/>`);
                n.linhas.forEach((l, j) => o.push(txt(n.cx, n.y + 15 + j * 12, l, `text-anchor="middle" font-size="9.5"${n.orienta ? ' font-style="italic"' : ''} fill="${COR.texto}"`)));
            }
        }
    }
    o.push('</g>', '</svg>');
    return { svg: o.join('\n'), largura, altura };
}
