// ============================================================================
// Geometria do diagrama do rito no formato BPMN (como o Bizagi desenha): da
// esquerda para a direita, uma raia por unidade, evento de início, tarefas,
// desvio (losango) quando a fase tem mais de uma saída, evento de fim e setas
// em ângulo reto com a condição escrita. Lógica pura (sem React), testada em
// src/lib/fluxoBpmn.test.js. Quem desenha é components/secretaria/FluxoRito.
// ============================================================================

import { niveisDoFluxo, seguintes } from './secretariaRito.js';
import { textoCondicao } from './exigencias.js';

/** Rótulo da seta: a condição escrita e, se houver, a regra pela resposta. */
const rotuloSaida = (f, alvo) => [String(f.condicoes?.[alvo] || '').trim(), f.condicoes_regra?.[alvo] ? `quando ${textoCondicao(f, f.condicoes_regra[alvo])}` : '']
    .filter(Boolean).join('; ');

export const TW = 128; // tarefa
export const TH = 60;
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
 * fases: as do rito ({ id, nome, prazo_dias?, proximas?, final?, condicoes? }).
 * raiaDe(fase): nome da raia (unidade) da fase, ou '' se não tem.
 * porFaixa: quantas colunas cabem na largura. Passando disso, o fluxo continua
 * na faixa de baixo (como um texto que muda de linha), para caber inteiro na tela.
 * Devolve { largura, altura, faixas, raias, inicio, tarefas, desvios, fins, setas }.
 */
export function desenharFluxo(fases, raiaDe = () => '', porFaixa = Infinity) {
    if (!fases?.length) return { largura: 0, altura: 0, faixas: 0, raias: [], inicio: null, tarefas: [], desvios: [], fins: [], setas: [] };
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
        if (!blocos.has(kb)) blocos.set(kb, { nome: nomes[raiaIdx[i]], faixa: faixaDe(c), ordem: raiaIdx[i], linhas: 1 });
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
        largura = Math.max(largura, x + TW + (extra[c] ? FOLGA + DES : 0));
        x += TW + (extra[c] ? FOLGA + DES : 0) + vao[c];
    }
    largura = Math.round(largura + (nFaixas > 1 ? 30 : 0) + MARGEM + 6);
    const fimCorpo = (c) => colX[c] + TW + (extra[c] ? FOLGA + DES : 0); // onde começa o vão depois da coluna
    const vaoAntes = (c) => (primeira(c) ? x0 - vaoInicio - 26 : fimCorpo(c - 1)); // onde começa o vão antes da coluna

    const alturaLinha = TH + CANAL;
    let y = MARGEM;
    raias.forEach((r, k) => {
        if (k > 0 && r.faixa !== raias[k - 1].faixa) y += ENTRE_FAIXAS;
        Object.assign(r, { x: MARGEM, y, largura: largura - 2 * MARGEM, altura: TOPO + r.linhas * alturaLinha, cab });
        y += r.altura;
    });
    const altura = y + MARGEM;

    const tarefas = fases.map((f, i) => {
        const c = nivel.get(f.id);
        const ty = blocos.get(`${faixaDe(c)}:${raiaIdx[i]}`).y + TOPO + sub[i] * alturaLinha;
        return { id: f.id, indice: i, x: colX[c], y: ty, cx: colX[c] + TW / 2, cy: ty + TH / 2, col: c, linhas: quebrar(f.nome, 19, f.prazo_dias ? 2 : 3), prazo: f.prazo_dias || null, nome: f.nome };
    });
    const desvios = [];
    const fins = [];
    tarefas.forEach((t, i) => {
        const cx = t.x + TW + FOLGA + DES / 2;
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
        if (n === 0) { setas.push({ de: t.id, para: null, d: caminho([[t.x + TW, t.cy], [t.x + TW + FOLGA + 4, t.cy]]), tipo: 'fim' }); return; }
        if (n > 1) setas.push({ de: t.id, para: t.id, d: caminho([[t.x + TW, t.cy], [t.x + TW + FOLGA, t.cy]]), tipo: 'desvio' });
        const sx = n > 1 ? t.x + TW + FOLGA + DES : t.x + TW;
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
                : [[sx, t.cy], [gx1, t.cy], [gx1, t.y + TH + 8 + p * 6], [gx2, t.y + TH + 8 + p * 6], [gx2, ey], [b.x - 1, ey]];
            const rot = rotuloSaida(fases[i], alvo);
            setas.push({
                de: t.id, para: alvo, d: caminho(pts), tipo: volta ? 'volta' : 'fluxo',
                // A condição fica acima da seta; na última de várias entradas, abaixo, para não cair sobre a seta vizinha.
                ...(rot ? { rotulo: curto(rot), rotuloCompleto: rot, rx: b.x - 7, ry: ent.length > 1 && k === ent.length - 1 ? ey + 12 : ey - 4 } : {}),
            });
        });
    });
    return { largura, altura: Math.round(altura), faixas: nFaixas, raias, inicio, tarefas, desvios, fins, setas };
}
