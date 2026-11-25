import test from 'node:test';
import assert from 'node:assert/strict';
import { bibliotecaDeModelos } from './bibliotecaRitos.js';
import { seguintes } from './secretariaRito.js';
import { propostaDeAbas, propostaDeBpmn, propostaDeMermaid } from './propostaRito.js';
import { rotuloSaida } from './fluxoBpmn.js';
import { FORMATOS, desenhoCompleto, nomeDoArquivo, raiaPadrao, ritoParaAbas, ritoParaBpmn, ritoParaMermaid, ritoParaSvg } from './exportarRito.js';

// Cada formato é conferido em TODOS os modelos da biblioteca: o que sai tem de
// voltar igual pela importação do rito (mesmas fases, mesmos caminhos, mesmas
// unidades), e o desenho tem de sair inteiro, numa faixa só e sem texto cortado.

const MODELOS = bibliotecaDeModelos();
const raia = (f) => f.unidade || '';
const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Caminhos do rito pelo nome das fases: "de > para", em ordem. */
const caminhos = (fases) => fases.flatMap((f, i) => seguintes(fases, i).map((id) => `${sem(f.nome)} > ${sem(fases.find((x) => x.id === id).nome)}`)).sort();
const nomes = (fases) => fases.map((f) => sem(f.nome)).sort();

/** XML bem formado: toda etiqueta aberta fecha, na ordem. */
function bemFormado(xml) {
    const pilha = [];
    for (const m of xml.matchAll(/<(\/?)([\w:.-]+)((?:"[^"]*"|[^>"])*?)(\/?)>/g)) {
        if (m[1]) { if (pilha.pop() !== m[2]) return false; } else if (!m[4]) pilha.push(m[2]);
    }
    return pilha.length === 0;
}

test('biblioteca: nenhum modelo tem duas fases com o mesmo nome (a ida e volta compara por nome)', () => {
    for (const m of MODELOS) assert.equal(new Set(nomes(m.fases)).size, m.fases.length, m.nome);
});

test('BPMN: todo modelo volta igual pela importação (fases, caminhos, prazos e unidades)', () => {
    for (const m of MODELOS) {
        const xml = ritoParaBpmn(m.fases, { nome: m.nome, raiaDe: raia });
        assert.ok(bemFormado(xml), `${m.nome}: XML mal formado`);
        const { fases, avisos } = propostaDeBpmn(xml);
        assert.deepEqual(avisos, [], m.nome);
        assert.deepEqual(nomes(fases), nomes(m.fases), m.nome);
        assert.deepEqual(caminhos(fases), caminhos(m.fases), m.nome);
        for (const f of m.fases) {
            const g = fases.find((y) => sem(y.nome) === sem(f.nome));
            assert.equal(g.prazo_dias || 0, f.prazo_dias || 0, `${m.nome} / ${f.nome}: prazo`);
            assert.equal(g.unidade || '', f.unidade || (f.espera ? 'Onde o processo estiver' : 'Sem unidade'), `${m.nome} / ${f.nome}: unidade`);
        }
    }
});

test('BPMN: uma raia por unidade, um desvio por fase com várias saídas, condição no nome do fluxo e desenho de tudo', () => {
    for (const m of MODELOS) {
        const xml = ritoParaBpmn(m.fases, { nome: m.nome, raiaDe: raia });
        const conta = (re) => (xml.match(re) || []).length;
        const unidades = new Set(m.fases.map((f) => f.unidade || (f.espera ? 'Onde o processo estiver' : 'Sem unidade')));
        assert.equal(conta(/<lane /g), unidades.size, `${m.nome}: raias`);
        assert.equal(conta(/<task /g), m.fases.length, `${m.nome}: tarefas`);
        assert.equal(conta(/<exclusiveGateway /g), m.fases.filter((_f, i) => seguintes(m.fases, i).length > 1).length, `${m.nome}: desvios`);
        assert.equal(conta(/<endEvent /g), m.fases.filter((_f, i) => seguintes(m.fases, i).length === 0).length, `${m.nome}: fins`);
        // Todo elemento e todo fluxo tem o seu desenho; toda fase está numa raia.
        const formas = conta(/<bpmndi:BPMNShape /g);
        assert.equal(formas, 1 + unidades.size + 1 + m.fases.length + conta(/<exclusiveGateway /g) + conta(/<endEvent /g), `${m.nome}: formas`);
        assert.equal(conta(/<bpmndi:BPMNEdge /g), conta(/<sequenceFlow /g), `${m.nome}: fluxos desenhados`);
        assert.equal(conta(/<flowNodeRef>/g), formas - 1 - unidades.size, `${m.nome}: elementos nas raias`);
        // A condição de cada saída vai inteira no nome do fluxo.
        m.fases.forEach((f, i) => seguintes(m.fases, i).forEach((id) => {
            const rot = rotuloSaida(f, id, m.fases);
            if (rot) assert.ok(xml.includes(`name="${rot.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}"`), `${m.nome} / ${f.nome}: ${rot}`);
        }));
        assert.ok(!/NaN|undefined/.test(xml), `${m.nome}: coordenada inválida`);
    }
});

test('Mermaid: todo modelo volta igual pela importação e todo rótulo vai entre aspas', () => {
    for (const m of MODELOS) {
        const texto = ritoParaMermaid(m.fases, raia);
        const { fases, avisos } = propostaDeMermaid(texto);
        assert.deepEqual(avisos, [], m.nome);
        assert.deepEqual(nomes(fases), nomes(m.fases).map((n) => n.replace(/"/g, "'")), m.nome);
        assert.deepEqual(caminhos(fases).length, caminhos(m.fases).length, m.nome);
        for (const f of m.fases) assert.equal(fases.find((y) => sem(y.nome) === sem(f.nome).replace(/"/g, "'"))?.unidade || '', f.unidade || '', `${m.nome} / ${f.nome}`);
        // Nó: F1["..."]; seta com condição: -->|"..."|. Nada fora das aspas que o Mermaid não entenda.
        for (const l of texto.split('\n').slice(1).filter(Boolean)) {
            assert.match(l, /^\s*(INICIO\(\("Início"\)\)|FIM\d+\(\("Fim"\)\)|subgraph U\d+\["[^"\[\]|;]+"\]|end|F\d+\["[^"\[\]|;]+"\]|(INICIO|F\d+) -->(\|"[^"|;]+"\|)? (F\d+|FIM\d+))$/, `${m.nome}: ${l}`);
        }
    }
});

test('planilha: todo modelo volta igual pela importação (fases, caminhos, prazos, unidades e ações)', () => {
    for (const m of MODELOS) {
        const abas = ritoParaAbas(m.fases, raia);
        const { fases, avisos } = propostaDeAbas(abas);
        assert.deepEqual(avisos.filter((a) => !/^Lidas/.test(a)), [], m.nome);
        assert.deepEqual(nomes(fases), nomes(m.fases), m.nome);
        // A fase de espera não escreve saída: volta para de onde veio, e a importação não tem como saber que é espera.
        const semEspera = (lista, ref) => caminhos(lista).filter((c) => !ref.some((f, i) => f.espera && i > 0 && c.startsWith(`${sem(f.nome)} > `)));
        assert.deepEqual(semEspera(fases, m.fases), semEspera(m.fases, m.fases), m.nome);
        for (const f of m.fases) {
            const g = fases.find((y) => sem(y.nome) === sem(f.nome));
            assert.equal(g.prazo_dias || 0, f.prazo_dias || 0, `${m.nome} / ${f.nome}: prazo`);
            assert.equal(g.unidade || '', f.unidade || '', `${m.nome} / ${f.nome}: unidade`);
            assert.equal((g.acoes || []).length, new Set((f.acoes || []).filter((a) => String(a).trim())).size, `${m.nome} / ${f.nome}: ações`);
        }
        // A aba de detalhe traz uma linha por ação, e não é lida como lista de fases.
        const total = m.fases.reduce((n, f) => n + (f.acoes || []).filter((a) => String(a).trim()).length, 0);
        if (total) assert.equal(abas[1].linhas.length - 1, total, `${m.nome}: ações em detalhe`);
    }
});

test('imagem: o rito inteiro numa faixa só, uma raia por unidade, sem texto cortado', () => {
    for (const m of MODELOS) {
        for (const acoes of [true, false]) {
            const g = desenhoCompleto(m.fases, raia, acoes);
            const { svg, largura, altura } = ritoParaSvg(m.fases, { nome: m.nome, raiaDe: raia, acoes });
            assert.equal(g.faixas, 1, `${m.nome}: o fluxo não pode dobrar`);
            assert.equal(g.raias.length, new Set(m.fases.map((f) => f.unidade || (f.espera ? 'Onde o processo estiver' : 'Sem unidade'))).size, `${m.nome}: uma raia por unidade`);
            assert.ok(bemFormado(svg), `${m.nome}: SVG mal formado`);
            assert.ok(!svg.includes('…'), `${m.nome}: texto cortado`);
            assert.ok(!/NaN|undefined/.test(svg), `${m.nome}: coordenada inválida`);
            assert.ok(largura >= g.largura && altura >= g.altura, m.nome);
            // Tudo dentro da imagem: nenhuma fase passa da largura ou da altura.
            for (const t of g.tarefas) assert.ok(t.x >= 0 && t.x + t.w <= g.largura && t.y >= 0 && t.y + t.h <= g.altura, `${m.nome}: fase fora do desenho`);
            // Cada seta que chega tem a sua altura na caixa da fase (as condições não se sobrepõem).
            const chegadas = new Map();
            for (const s of g.setas.filter((q) => q.para && q.tipo !== 'desvio' && q.tipo !== 'inicio')) {
                const y = s.pts[s.pts.length - 1][1];
                const t = g.tarefas.find((q) => q.id === s.para);
                assert.ok(y >= t.y && y <= t.y + t.th, `${m.nome}: seta chega fora da caixa de ${t.nome}`);
                const ys = chegadas.get(s.para) || [];
                assert.ok(ys.every((q) => Math.abs(q - y) >= 12), `${m.nome}: setas sobrepostas chegando a ${t.nome}`);
                chegadas.set(s.para, [...ys, y]);
            }
        }
    }
});

test('formatos e nome do arquivo', () => {
    assert.deepEqual(FORMATOS.map((f) => f.id), ['bpmn', 'png', 'pdf', 'svg', 'xlsx', 'mmd']);
    assert.equal(nomeDoArquivo('Inquérito civil: emendas/2026 (MPRS)', 'bpmn'), 'Inquerito civil emendas 2026 MPRS.bpmn');
    assert.equal(nomeDoArquivo('', 'png'), 'rito.png');
    assert.equal(raiaPadrao([{ id: 'u1', nome: 'Secretaria', sigla: 'SEC' }])({ unidade_id: 'u1' }), 'SEC');
    assert.equal(ritoParaBpmn([], {}), '');
    assert.equal(ritoParaSvg([], {}).svg, '');
});
