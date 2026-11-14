import test from 'node:test';
import assert from 'node:assert/strict';
import { TH, TW, TWA, caminho, desenharFluxo, itensDaFase, quebrar } from './fluxoBpmn.js';

const fases = [
    { id: 'a', nome: 'Receber', unidade: 'Protocolo', proximas: ['b', 'c'], condicoes: { b: 'Sim', c: 'Não' } },
    { id: 'b', nome: 'Analisar', unidade: 'Assessoria', proximas: ['d'] },
    { id: 'c', nome: 'Devolver', unidade: 'Protocolo', proximas: [], final: true },
    { id: 'd', nome: 'Revisar', unidade: 'Assessoria', proximas: ['b', 'e'], condicoes: { b: 'Com ajustes' } },
    { id: 'e', nome: 'Arquivar', unidade: 'Protocolo', proximas: [], final: true },
];
const raia = (f) => f.unidade;

test('quebrar: divide em linhas e corta o excesso com reticências', () => {
    assert.deepEqual(quebrar('Solicitar pesquisa de jurisprudência', 19, 3), ['Solicitar pesquisa', 'de jurisprudência']);
    const l = quebrar('um dois três quatro cinco seis sete oito nove dez', 8, 2);
    assert.equal(l.length, 2);
    assert.ok(l[1].endsWith('…'));
    assert.deepEqual(quebrar('', 10, 2), []);
});

test('caminho: começa no primeiro ponto, termina no último e arredonda os cantos', () => {
    const d = caminho([[0, 0], [20, 0], [20, 30]]);
    assert.ok(d.startsWith('M0,0'));
    assert.ok(d.endsWith('L20,30'));
    assert.match(d, /Q20,0/);
});

test('desenharFluxo: raias por unidade, desvio com mais de uma saída, fim sem saída', () => {
    const g = desenharFluxo(fases, raia);
    assert.deepEqual(g.raias.map((r) => r.nome), ['Protocolo', 'Assessoria']);
    assert.deepEqual(g.desvios.map((d) => d.id), ['a', 'd']);
    assert.deepEqual(g.fins.map((f) => f.id), ['c', 'e']);
    assert.equal(g.tarefas.length, 5);
    // Cada tarefa fica dentro da sua raia e do desenho.
    for (const t of g.tarefas) {
        const r = g.raias.find((x) => x.nome === fases[t.indice].unidade);
        assert.ok(t.y >= r.y && t.y + 60 <= r.y + r.altura, `${t.nome} fora da raia`);
        assert.ok(t.x > 0 && t.x + TW < g.largura, `${t.nome} fora do desenho`);
    }
    // Uma seta por ligação, mais a do início, as dos fins e as que levam ao losango.
    assert.equal(g.setas.filter((s) => s.tipo === 'inicio').length, 1);
    assert.equal(g.setas.filter((s) => s.tipo === 'fim').length, 2);
    assert.equal(g.setas.filter((s) => s.tipo === 'desvio').length, 2);
    assert.equal(g.setas.filter((s) => s.tipo === 'fluxo' || s.tipo === 'volta').length, 5);
});

test('desenharFluxo: volta é tracejada (tipo volta) e leva a condição escrita', () => {
    const g = desenharFluxo(fases, raia);
    const volta = g.setas.find((s) => s.de === 'd' && s.para === 'b');
    assert.equal(volta.tipo, 'volta');
    assert.equal(volta.rotulo, 'Com ajustes');
    assert.equal(g.setas.find((s) => s.de === 'a' && s.para === 'b').rotulo, 'Sim');
    // Duas entradas na mesma tarefa: as condições não ficam na mesma altura.
    const ida = g.setas.find((s) => s.de === 'a' && s.para === 'b');
    assert.notEqual(ida.ry, volta.ry);
});

test('desenharFluxo: sem unidades não há cabeçalho de raia; vazio não quebra', () => {
    const g = desenharFluxo(fases.map(({ unidade, ...f }) => f));
    assert.equal(g.raias.length, 1);
    assert.equal(g.raias[0].cab, 0);
    assert.deepEqual(desenharFluxo([]).tarefas, []);
    assert.equal(desenharFluxo(null).largura, 0);
});

test('desenharFluxo: fase de espera sem unidade fica na raia "Onde o processo estiver"', () => {
    const fs = [{ id: 'a', nome: 'Análise', unidade: 'Assessoria', proximas: ['e', 'x'] }, { id: 'e', nome: 'Diligências', espera: true }, { id: 'x', nome: 'Solta' }];
    assert.deepEqual(desenharFluxo(fs, (f) => f.unidade).raias.map((r) => r.nome), ['Assessoria', 'Onde o processo estiver', 'Sem unidade']);
});

test('desenharFluxo: fluxo longo muda de faixa e cabe na largura pedida', () => {
    const longas = Array.from({ length: 9 }, (_x, i) => ({ id: `f${i}`, nome: `Fase ${i}`, unidade: i < 4 ? 'A' : 'B', proximas: i < 8 ? [`f${i + 1}`] : [] }));
    const uma = desenharFluxo(longas, raia);
    const g = desenharFluxo(longas, raia, 3);
    assert.equal(uma.faixas, 1);
    assert.equal(g.faixas, 3);
    assert.ok(g.largura < uma.largura / 2);
    assert.ok(g.altura > uma.altura);
    // A 4ª fase volta para a esquerda, abaixo da 1ª; cada faixa só tem as raias que usa.
    assert.equal(g.tarefas[3].x, g.tarefas[0].x);
    assert.ok(g.tarefas[3].y > g.tarefas[0].y);
    assert.deepEqual(g.raias.map((r) => `${r.faixa}:${r.nome}`), ['0:A', '1:A', '1:B', '2:B']);
    for (const t of g.tarefas) assert.ok(t.x + TW < g.largura);
    assert.equal(g.setas.filter((s) => s.tipo === 'fluxo').length, 8);
});

test('desenharFluxo: fases da mesma coluna e raia se empilham sem se sobrepor', () => {
    const g = desenharFluxo([
        { id: 'a', nome: 'A', proximas: ['b', 'c'] },
        { id: 'b', nome: 'B', proximas: ['d'] },
        { id: 'c', nome: 'C', proximas: ['d'] },
        { id: 'd', nome: 'D', proximas: [] },
    ]);
    const [b, c] = [g.tarefas[1], g.tarefas[2]];
    assert.equal(b.x, c.x);
    assert.ok(Math.abs(b.y - c.y) >= 60);
});

// Fase "Recebimento" do Rito Consultas: as ações complementares só valem se a consulta não veio pelo SIM.
const recebimento = {
    id: 'r', nome: 'Recebimento', unidade: 'Secretaria', proximas: ['n'],
    acoes: ['Registrar os dados básicos', 'Sistema utilizado', 'Registrar no SIM e converter em PGEA', 'Informar o solicitante', '', 'Análise superficial'],
    acoes_regras: [
        { pede: 'formulario', campos: [{ rotulo: 'Assunto', tipo: 'texto' }], obrigatoria: true },
        { pede: 'lista', opcoes: ['SIM', 'SPU', 'E-mail'], obrigatoria: true },
        { obrigatoria: true, se: { acao: 1, valores: ['SPU', 'E-mail'] } },
        { obrigatoria: true, se: { acao: 1, valores: ['SPU', 'E-mail'] } },
        null,
        { pede: 'texto_longo', destino: 'informacao' },
    ],
};

test('itensDaFase: um desvio antes de cada grupo de ações com o mesmo "só se"; ação sem nome não entra', () => {
    const itens = itensDaFase(recebimento);
    assert.deepEqual(itens.map((i) => i.tipo), ['acao', 'acao', 'desvio', 'acao', 'acao', 'acao']);
    assert.equal(itens[2].texto, 'Se "Sistema utilizado" for SPU ou E-mail');
    assert.deepEqual(itens.filter((i) => i.tipo === 'acao').map((i) => !!i.chave), [false, false, true, true, false]);
    assert.equal(itens[0].nivel, '');
    assert.equal(itens[5].nivel, 'opcional');
    assert.deepEqual(itensDaFase({ nome: 'x' }), []);
    // Dois "só se" diferentes em seguida: dois desvios.
    const dois = itensDaFase({ acoes: ['Decisão', 'A', 'B'], acoes_regras: [{ pede: 'sim_nao' }, { se: { acao: 0, valores: ['sim'] } }, { se: { acao: 0, valores: ['nao'] } }] });
    assert.deepEqual(dois.map((i) => i.tipo), ['acao', 'desvio', 'acao', 'desvio', 'acao']);
});

test('desenharFluxo com ações: a fase vira moldura e as ações ficam dentro dela, sem se sobrepor', () => {
    const fs = [recebimento, { id: 'n', nome: 'Análise', unidade: 'Assessoria', proximas: [], acoes: ['Assumir'] }];
    const simples = desenharFluxo(fs, raia);
    assert.equal(simples.comAcoes, false);
    assert.equal(simples.tarefas[0].dentro, null);
    assert.equal(simples.tarefas[0].w, TW);
    const g = desenharFluxo(fs, raia, Infinity, { acoes: true });
    assert.equal(g.comAcoes, true);
    const [r, n] = g.tarefas;
    assert.equal(r.w, TWA);
    assert.ok(r.h > n.h && n.h > TH);
    const nos = r.dentro.nos;
    assert.equal(nos.filter((x) => x.tipo === 'acao').length, 5);
    assert.equal(nos.filter((x) => x.tipo === 'desvio').length, 1);
    // Tudo dentro da moldura, abaixo do cabeçalho, uma coisa abaixo da outra.
    let fim = r.y + TH;
    for (const x of nos) {
        const [a, b] = x.tipo === 'acao' ? [x.y, x.y + x.h] : [x.ly - 8, x.cy + x.r];
        assert.ok(a >= fim, `${x.nome || x.texto} sobrepõe o anterior`);
        if (x.tipo === 'acao') assert.ok(x.x >= r.x && x.x + x.w <= r.x + r.w);
        fim = b;
    }
    assert.ok(fim <= r.y + r.h);
    // Ação condicional é mais estreita: à direita passa o caminho do "não".
    const [livre, cond] = [nos.find((x) => x.indice === 0), nos.find((x) => x.indice === 2)];
    assert.ok(cond.w < livre.w);
    assert.equal(r.dentro.ligacoes.filter((l) => l.tipo === 'pulo').length, 1);
    assert.deepEqual(r.dentro.rotulos.map((x) => x.texto), ['não', 'sim']);
    // A raia cresce com a fase mais alta e o desenho continua contendo tudo.
    const rr = g.raias.find((x) => x.nome === 'Secretaria');
    assert.ok(r.y + r.h <= rr.y + rr.altura);
    for (const t of g.tarefas) assert.ok(t.x + t.w < g.largura && t.y + t.h < g.altura);
});

test('desenharFluxo com ações: grupo condicional no fim da fase fecha dentro da moldura; uma fase por faixa', () => {
    const f = { id: 'a', nome: 'Decidir', proximas: ['b'], acoes: ['Decisão', 'Intimar'], acoes_regras: [{ pede: 'sim_nao' }, { se: { acao: 0, valores: ['sim'] } }] };
    const g = desenharFluxo([f, { id: 'b', nome: 'Fim', proximas: [] }], undefined, 1, { acoes: true });
    assert.equal(g.faixas, 2);
    const t = g.tarefas[0];
    assert.deepEqual(t.dentro.ligacoes.map((l) => l.tipo), ['passo', 'passo', 'pe', 'pulo']);
    assert.ok(t.dentro.nos.at(-1).y + t.dentro.nos.at(-1).h < t.y + t.h);
    // A seta para a fase de baixo passa abaixo da moldura inteira, não por dentro dela.
    assert.ok(g.tarefas[1].y > t.y + t.h);
});

test('itensDaFase: condição por campo do formulário, alternativa ("ou") e ação que só orienta', () => {
    const f = { id: 'r', nome: 'Devolução', acoes: ['Dados', 'Avisar por telefone', 'Enviar pelo SIGO', 'Inserir no SIM', 'Conferir anexos'], acoes_regras: [
        { pede: 'formulario', campos: [{ id: 'meio', rotulo: 'Meio', tipo: 'lista', opcoes: ['SIGO', 'SIM'] }, { id: 'urg', rotulo: 'Urgente', tipo: 'sim_nao' }] },
        { se: { acao: 0, campo: 'urg', valores: ['sim'] } },
        { se: { acao: 0, campo: 'meio', valores: ['sim'] } },
        { ou: 2 },
        { pede: 'orientacao' },
    ] };
    const itens = itensDaFase(f);
    // Campos diferentes da mesma ação (com a mesma resposta) são desvios diferentes.
    assert.deepEqual(itens.map((i) => i.tipo), ['acao', 'desvio', 'acao', 'desvio', 'acao', 'acao', 'acao']);
    assert.equal(itens[1].texto, 'Se "Urgente" for Sim');
    assert.deepEqual(itens.filter((i) => i.ou).map((i) => i.nome), ['Inserir no SIM']);
    assert.deepEqual(itens.filter((i) => i.orienta).map((i) => i.nome), ['Conferir anexos']);
    const t = desenharFluxo([f], () => '', Infinity, { acoes: true }).tarefas[0];
    assert.deepEqual(t.dentro.rotulos.filter((r) => r.texto === 'ou').length, 1);
});
