// ============================================================================
// Geometria do diagrama do rito no formato BPMN (como o Bizagi desenha): da
// esquerda para a direita, uma raia por unidade, evento de início, fases,
// desvio (losango) quando a fase tem mais de uma saída, evento de fim e setas
// em ângulo reto com a condição escrita. Com `acoes`, a fase é uma moldura e
// dentro dela cada ação é uma tarefa (retângulo) e cada "só se" é um desvio
// (losango) com o caminho que pula as ações condicionais. Lógica pura (sem
// React), testada em src/lib/fluxoBpmn.test.js. Quem desenha é
// components/secretaria/FluxoRito.
// ============================================================================

import { niveisDoFluxo, seguintes } from './secretariaRito.js';
import { chaveDaCondicao, nivelDaAcao, resumoDaAcao, soOrienta, textoCondicao } from './exigencias.js';

/** Rótulo da seta: a condição escrita e, se houver, a regra pela resposta. */
const rotuloSaida = (f, alvo) => (f.espera && !f.final ? 'volta' : null) || [String(f.condicoes?.[alvo] || '').trim(), f.condicoes_regra?.[alvo] ? `quando ${textoCondicao(f, f.condicoes_regra[alvo])}` : '']
    .filter(Boolean).join('; ');

export const TW = 128; // fase (sem as ações)
export const TH = 60; // fase sem ações; com ações, o cabeçalho da moldura
export const TWA = 176; // fase com as ações dentro
const MI = 8; // margem interna da moldura
const ENTRE = 14; // entre uma ação e a seguinte
const GR = 8; // meio losango do desvio interno
const PULO = 12; // faixa à direita das ações condicionais, por onde passa o "não"
const DES = 34; // losango do desvio e círculo do fim
const FOLGA = 14; // entre a tarefa e o desvio/fim
const VAO = 38; // entre colunas (cresce quando há condição escrita)
const CANAL = 34; // faixa abaixo de cada linha, por onde passam as setas longas
const TOPO = 16;
const MARGEM = 10;
const CAB = 36; // cabeçalho (nome) da raia, com até duas linhas
const INICIO = 62; // espaço do evento de início
const MAX_ROTULO = 20;
const ENTRE_FAIXAS = 16; // entre uma faixa e a seguinte, quando o fluxo muda de linha

/** Quebra o nome em até `linhas` linhas de `largura` caracteres; o resto vira "…". */
export function quebrar(texto, largura = 19, linhas = 3) {
    const out = [];
    let atual = '';
    const palavras = String(texto || '').trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < palavras.length; i++) {
        let p = palavras[i];
        while (p.length > largura) { // palavra maior que a linha
            if (atual) { out.push(atual); atual = ''; }
            out.push(`${p.slice(0, largura - 1)}-`);
            p = p.slice(largura - 1);
        }
        if (!atual) atual = p;
        else if (`${atual} ${p}`.length <= largura) atual = `${atual} ${p}`;
        else { out.push(atual); atual = p; }
    }
    if (atual) out.push(atual);
    if (out.length <= linhas) return out;
    const corte = out.slice(0, linhas);
    corte[linhas - 1] = `${corte[linhas - 1].slice(0, largura - 1).replace(/[\s-]+$/, '')}…`;
    return corte;
}

const curto = (s, n = MAX_ROTULO) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Caminho SVG por pontos em ângulo reto, com os cantos arredondados. */
export function caminho(pts, r = 6) {
    const p = pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1][0] || q[1] !== pts[i - 1][1]);
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 1; i < p.length; i++) {
        const [x, y] = p[i];
        const prox = p[i + 1];
        if (!prox) { d += ` L${x},${y}`; break; }
        const [ax, ay] = p[i - 1];
        const raio = Math.min(r, Math.hypot(x - ax, y - ay) / 2, Math.hypot(prox[0] - x, prox[1] - y) / 2);
        const ex = x - Math.sign(x - ax) * raio;
        const ey = y - Math.sign(y - ay) * raio;
        const sx = x + Math.sign(prox[0] - x) * raio;
        const sy = y + Math.sign(prox[1] - y) * raio;
        d += ` L${ex},${ey} Q${x},${y} ${sx},${sy}`;
    }
    return d;
}

/**
 * O que a fase tem dentro, na ordem do rito: as ações e, antes de cada grupo
 * de ações com o mesmo "só se", o desvio que decide se elas valem.
 */
export function itensDaFase(f) {
    const itens = [];
    let aberto = null;
    (f?.acoes || []).forEach((nome, i) => {
        if (!String(nome || '').trim()) return;
        const r = f.acoes_regras?.[i];
        const chave = r?.se ? `${chaveDaCondicao(r.se)}:${(r.se.valores || []).join('|')}` : null;
        if (chave && chave !== aberto) itens.push({ tipo: 'desvio', chave, texto: `Se ${textoCondicao(f, r.se)}` });
        aberto = chave;
        // `ou`: alternativa a uma ação anterior. `orienta`: lembrete, não se marca.
        itens.push({ tipo: 'acao', indice: i, nome: String(nome).trim(), chave, nivel: nivelDaAcao(r), resumo: resumoDaAcao(r),
            ...(Number.isInteger(r?.ou) ? { ou: true } : {}), ...(soOrienta(r) ? { orienta: true } : {}) });
    });
    return itens;
}

/** Posição de cada item dentro da moldura que começa em (x, y0) e tem largura w. */
function dentroDaFase(itens, x, y0, w) {
    const cx = x + w / 2;
    const nos = [];
    const ligacoes = [];
    const rotulos = [];
    let y = y0 + MI;
    let grupo = null; // desvio em aberto: { chave, cy }
    let pe = null; // de onde sai a ligação para o próximo item
    const fechar = (yj) => {
        ligacoes.push({ d: caminho([[cx + GR, grupo.cy], [x + w - MI + 2, grupo.cy], [x + w - MI + 2, yj], [cx + 1, yj]], 4), tipo: 'pulo' });
        grupo = null;
    };
    for (const it of itens) {
        if (grupo && it.chave !== grupo.chave) fechar(y - ENTRE / 2);
        if (pe !== null) ligacoes.push({ d: caminho([[cx, pe], [cx, y - 1]]), tipo: 'passo' });
        if (it.tipo === 'desvio') {
            const linhas = quebrar(it.texto, Math.floor((w - 2 * MI) / 4.9), 2);
            const cy = y + linhas.length * 11 + 3 + GR;
            nos.push({ ...it, cx, cy, r: GR, linhas, ly: y + 8 });
            rotulos.push({ x: cx + GR + 3, y: cy - 3, texto: 'não', ancora: 'start' }, { x: cx - 4, y: cy + GR + 9, texto: 'sim', ancora: 'end' });
            grupo = { chave: it.chave, cy };
            pe = cy + GR;
            y = pe + ENTRE;
        } else {
            if (it.ou && pe !== null) rotulos.push({ x: cx + 4, y: y - ENTRE / 2 + 3, texto: 'ou', ancora: 'start' });
            const larg = w - 2 * MI - (it.chave ? PULO : 0);
            const linhas = quebrar(it.nome, Math.floor((larg - 10) / 5.1), 2);
            const alt = linhas.length * 12 + 12;
            nos.push({ ...it, x: x + MI, y, w: larg, h: alt, cx: x + MI + larg / 2, linhas });
            pe = y + alt;
            y = pe + ENTRE;
        }
    }
    if (grupo) { // o grupo condicional fecha a fase: os dois caminhos se encontram no pé
        ligacoes.push({ d: caminho([[cx, pe], [cx, y - ENTRE / 2]]), tipo: 'pe' });
        fechar(y - ENTRE / 2);
    }
    return { nos, ligacoes, rotulos, altura: itens.length ? y - y0 : 0 };
}

/**
 * fases: as do rito ({ id, nome, prazo_dias?, proximas?, final?, condicoes? }).
 * opcoes.acoes: desenha a fase como moldura com as ações e os desvios dentro.
 * Sem isso (portal das partes), a fase é só a caixa com o nome.
 * raiaDe(fase): nome da raia (unidade) da fase, ou '' se não tem.
 * porFaixa: quantas colunas cabem na largura. Passando disso, o fluxo continua
 * na faixa de baixo (como um texto que muda de linha), para caber inteiro na tela.
 * Devolve { largura, altura, faixas, raias, inicio, tarefas, desvios, fins, setas }.
 * Cada tarefa (fase) traz w, h e, com as ações, `dentro` { nos, ligacoes, rotulos }.
 */
export function desenharFluxo(fases, raiaDe = () => '', porFaixa = Infinity, opcoes = {}) {
    if (!fases?.length) return { largura: 0, altura: 0, faixas: 0, raias: [], inicio: null, tarefas: [], desvios: [], fins: [], setas: [], comAcoes: false };
    const itens = fases.map((f) => (opcoes.acoes ? itensDaFase(f) : []));
    const comAcoes = itens.some((l) => l.length > 0);
    const W = comAcoes ? TWA : TW;
    const alt = itens.map((l) => TH + dentroDaFase(l, 0, 0, W).altura);
    const nivel = niveisDoFluxo(fases);
    const saidas = fases.map((_f, i) => seguintes(fases, i));
    const porId = new Map(fases.map((f, i) => [f.id, i]));
    const nCols = Math.max(...nivel.values()) + 1;
    const N = Math.max(1, Math.min(nCols, Math.floor(porFaixa) || 1)); // colunas por faixa
    const nFaixas = Math.ceil(nCols / N);
    const faixaDe = (c) => Math.floor(c / N);
    const primeira = (c) => c % N === 0; // primeira coluna da faixa

    // Raias, na ordem em que aparecem. Sem nenhuma unidade, não há cabeçalho de raia.
    const nomesRaia = fases.map((f) => String(raiaDe(f) || '').trim());
    const temRaias = nomesRaia.some(Boolean);
    const nomes = [];
    const raiaIdx = nomesRaia.map((n) => {
        const nome = temRaias ? (n || 'Sem unidade') : '';
        let k = nomes.indexOf(nome);
        if (k < 0) { k = nomes.length; nomes.push(nome); }
        return k;
    });
    // Cada faixa só desenha as raias que usa. Fases da mesma coluna e raia se empilham.
    const blocos = new Map(); // "faixa:raia" → { nome, linhas, ... }
    const ocupacao = new Map();
    const sub = fases.map((f, i) => {
        const c = nivel.get(f.id);
        const kb = `${faixaDe(c)}:${raiaIdx[i]}`;
        if (!blocos.has(kb)) blocos.set(kb, { nome: nomes[raiaIdx[i]], faixa: faixaDe(c), ordem: raiaIdx[i], linhas: 1, hMax: TH });
        blocos.get(kb).hMax = Math.max(blocos.get(kb).hMax, alt[i]);
        const chave = `${kb}:${c}`;
        const n = ocupacao.get(chave) || 0;
        ocupacao.set(chave, n + 1);
        blocos.get(kb).linhas = Math.max(blocos.get(kb).linhas, n + 1);
        return n;
    });
    const raias = [...blocos.values()].sort((a, b) => a.faixa - b.faixa || a.ordem - b.ordem);

    // Colunas: mais largas se alguma fase tem desvio/fim; vão maior se há condição escrita.
    const extra = Array(nCols).fill(false);
    const vao = Array(nCols).fill(VAO);
    let vaoInicio = 0; // vão antes da 1ª coluna da faixa (para setas com condição)
    fases.forEach((f, i) => {
        const c = nivel.get(f.id);
        if (saidas[i].length !== 1) extra[c] = true;
        for (const alvo of saidas[i]) {
            const rot = rotuloSaida(f, alvo);
            if (!rot) continue;
            const ct = nivel.get(alvo);
            const precisa = VAO + Math.min(rot.length, MAX_ROTULO) * 5.4;
            if (!primeira(ct)) vao[ct - 1] = Math.max(vao[ct - 1], precisa);
            else vaoInicio = Math.max(vaoInicio, precisa - VAO);
        }
    });
    if (nFaixas > 1) { // colunas iguais, para os vãos ficarem alinhados de uma faixa para a outra
        extra.fill(extra.some(Boolean));
        vao.fill(Math.max(...vao));
    }
    const cab = temRaias ? CAB : 0;
    const x0 = MARGEM + cab + INICIO + vaoInicio;
    const colX = [];
    let largura = 0;
    for (let c = 0, x = x0; c < nCols; c++) {
        if (primeira(c)) x = x0;
        colX.push(x);
        largura = Math.max(largura, x + W + (extra[c] ? FOLGA + DES : 0));
        x += W + (extra[c] ? FOLGA + DES : 0) + vao[c];
    }
    largura = Math.round(largura + (nFaixas > 1 ? 30 : 0) + MARGEM + 6);
    const fimCorpo = (c) => colX[c] + W + (extra[c] ? FOLGA + DES : 0); // onde começa o vão depois da coluna
    const vaoAntes = (c) => (primeira(c) ? x0 - vaoInicio - 26 : fimCorpo(c - 1)); // onde começa o vão antes da coluna

    let y = MARGEM;
    raias.forEach((r, k) => {
        if (k > 0 && r.faixa !== raias[k - 1].faixa) y += ENTRE_FAIXAS;
        Object.assign(r, { x: MARGEM, y, largura: largura - 2 * MARGEM, altura: TOPO + r.linhas * (r.hMax + CANAL), cab });
        y += r.altura;
    });
    const altura = y + MARGEM;

    const tarefas = fases.map((f, i) => {
        const c = nivel.get(f.id);
        const bloco = blocos.get(`${faixaDe(c)}:${raiaIdx[i]}`);
        const ty = bloco.y + TOPO + sub[i] * (bloco.hMax + CANAL);
        return {
            id: f.id, indice: i, x: colX[c], y: ty, w: W, h: alt[i], pe: ty + bloco.hMax, cx: colX[c] + W / 2, cy: ty + TH / 2, col: c,
            linhas: quebrar(f.nome, comAcoes ? 27 : 19, f.prazo_dias ? 2 : 3), prazo: f.prazo_dias || null, nome: f.nome,
            dentro: itens[i].length ? dentroDaFase(itens[i], colX[c], ty + TH, W) : null,
        };
    });
    const desvios = [];
    const fins = [];
    tarefas.forEach((t, i) => {
        const cx = t.x + W + FOLGA + DES / 2;
        if (saidas[i].length > 1) desvios.push({ id: t.id, cx, cy: t.cy, r: DES / 2 });
        else if (saidas[i].length === 0) fins.push({ id: t.id, cx, cy: t.cy, r: DES / 2 - 4 });
    });
    const inicio = { cx: x0 - vaoInicio - INICIO / 2 - 2, cy: tarefas[0].cy, r: 13 };

    // Setas. Entradas de uma mesma tarefa se espalham na vertical para não se sobrepor.
    const entradas = new Map();
    fases.forEach((f, i) => saidas[i].forEach((alvo) => { if (!entradas.has(alvo)) entradas.set(alvo, []); entradas.get(alvo).push(f.id); }));
    const setas = [{ de: null, para: fases[0].id, d: caminho([[inicio.cx + inicio.r, inicio.cy], [tarefas[0].x - 1, tarefas[0].cy]]), tipo: 'inicio' }];
    let pista = 0;
    tarefas.forEach((t, i) => {
        const n = saidas[i].length;
        if (n === 0) { setas.push({ de: t.id, para: null, d: caminho([[t.x + W, t.cy], [t.x + W + FOLGA + 4, t.cy]]), tipo: 'fim' }); return; }
        if (n > 1) setas.push({ de: t.id, para: t.id, d: caminho([[t.x + W, t.cy], [t.x + W + FOLGA, t.cy]]), tipo: 'desvio' });
        const sx = n > 1 ? t.x + W + FOLGA + DES : t.x + W;
        saidas[i].forEach((alvo) => {
            const b = tarefas[porId.get(alvo)];
            const ent = entradas.get(alvo);
            const k = ent.indexOf(t.id);
            const passo = Math.min(11, (TH - 16) / Math.max(1, ent.length - 1));
            const ey = Math.round(b.cy + (k - (ent.length - 1) / 2) * passo);
            const p = pista++ % 4;
            const gx1 = fimCorpo(t.col) + 9 + p * 5;
            const gx2 = vaoAntes(b.col) + 9 + p * 5;
            const volta = b.col <= t.col;
            // Coluna seguinte na mesma faixa: direto. Senão, pelo canal abaixo da linha de origem.
            const pts = b.col === t.col + 1 && !primeira(b.col)
                ? [[sx, t.cy], [gx1, t.cy], [gx1, ey], [b.x - 1, ey]]
                : [[sx, t.cy], [gx1, t.cy], [gx1, t.pe + 8 + p * 6], [gx2, t.pe + 8 + p * 6], [gx2, ey], [b.x - 1, ey]];
            const rot = rotuloSaida(fases[i], alvo);
            setas.push({
                de: t.id, para: alvo, d: caminho(pts), tipo: volta ? 'volta' : 'fluxo',
                // A condição fica acima da seta; na última de várias entradas, abaixo, para não cair sobre a seta vizinha.
                ...(rot ? { rotulo: curto(rot), rotuloCompleto: rot, rx: b.x - 7, ry: ent.length > 1 && k === ent.length - 1 ? ey + 12 : ey - 4 } : {}),
            });
        });
    });
    return { largura, altura: Math.round(altura), faixas: nFaixas, raias, inicio, tarefas, desvios, fins, setas, comAcoes };
}
