// Certame (S11): aviso, prazo mínimo, propostas e sigilo.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/certames');

const base = {
    objeto: 'Aquisição de material de expediente', criterio: 'menor_preco', unidade_disputa: 'item',
    itens: [
        { descricao: 'Papel A4, resma de 500 folhas', unidade: 'resma', quantidade: '100', valor_estimado: '25,90' },
        { descricao: 'Caneta esferográfica azul', unidade: 'caixa', quantidade: 10, valor_estimado: 40, exclusivo_meepp: true },
    ],
    intervalo: { tipo: 'percentual', valor: 1 }, abertura_data: '2026-11-23', abertura_hora: '09:00', horas_lances: 6,
};
const me = { razao_social: 'Papelaria Boa Ltda', documento: '11222333000181', porte: 'me_epp' };
const OBRIG = ['conformidade', 'habilitacao', 'impedimento', 'trabalho_menor'];

test('certame: aviso conferido, valores em formato brasileiro e lances sempre na dispensa', () => {
    const d = s.sanitizeDadosCertame(base, 'dispensa');
    assert.equal(d.itens[0].valor_estimado, 25.9);
    assert.equal(d.itens[0].id, 'i1');
    assert.equal(d.itens[1].exclusivo_meepp, true);
    assert.equal(d.lances, true);
    assert.equal(d.horas_lances, 6);
    assert.equal(s.valorEstimado(d.itens), 2990);
    assert.throws(() => s.sanitizeDadosCertame({ ...base, horas_lances: 4 }, 'dispensa'), /6 a 10 horas/);
    const c = s.sanitizeDadosCertame({ ...base, horas_lances: 4 }, 'cotacao');
    assert.equal(c.lances, false);
    assert.equal(c.horas_lances, 0);
    assert.throws(() => s.sanitizeDadosCertame({ ...base, unidade_disputa: 'lote' }, 'cotacao'), /lote está o item 1/);
    assert.throws(() => s.sanitizeDadosCertame({ ...base, itens: [{ descricao: 'x', quantidade: 1 }] }, 'cotacao'), /Descreva o item 1/);
});

test('certame: abertura só depois do prazo mínimo em dias úteis (IN 67, art. 6º), sem feriado', () => {
    // Segunda, 16/11/2026: 3 dias úteis (17, 18, 19); 20/11 é feriado nacional.
    assert.equal(s.aberturaMinima('dispensa', '2026-11-16'), '2026-11-23');
    assert.equal(s.aberturaMinima('cotacao', '2026-11-16'), '2026-11-18');
    const d = s.sanitizeDadosCertame({ ...base, abertura_data: '2026-11-19' }, 'dispensa');
    assert.match(s.problemasParaPublicar(d, 'dispensa', '2026-11-16').join(' '), /a partir de 23\/11\/2026/);
    assert.deepEqual(s.problemasParaPublicar(s.sanitizeDadosCertame(base, 'dispensa'), 'dispensa', '2026-11-16'), []);
    const noite = s.sanitizeDadosCertame({ ...base, abertura_hora: '19:00' }, 'dispensa');
    assert.match(s.problemasParaPublicar(noite, 'dispensa', '2026-11-16').join(' '), /horário comercial/);
    assert.equal(s.instanteDaAbertura(base), '2026-11-23T12:00:00.000Z');
});

test('certame: proposta confere itens, exclusividade ME/EPP, lote inteiro e declarações', () => {
    const d = s.sanitizeDadosCertame(base, 'dispensa');
    const lic = s.sanitizeLicitante(me, 'a@b.com');
    assert.equal(lic.documento, '11.222.333/0001-81');
    assert.throws(() => s.sanitizeLicitante({ ...me, documento: '11222333000180' }, ''), /CPF ou CNPJ/);
    const p = s.sanitizeProposta({ itens: [{ item_id: 'i1', valor: '24,5', marca: 'Boa' }, { item_id: 'i2', valor: 39 }], declaracoes: [...OBRIG, 'meepp'] }, d, lic);
    assert.equal(p.itens[0].valor, 24.5);
    assert.deepEqual(p.declaracoes, [...OBRIG, 'meepp']);
    const demais = { ...lic, porte: 'demais' };
    assert.throws(() => s.sanitizeProposta({ itens: [{ item_id: 'i2', valor: 39 }], declaracoes: OBRIG }, d, demais), /exclusivo/);
    assert.throws(() => s.sanitizeProposta({ itens: [{ item_id: 'i1', valor: 20 }], declaracoes: OBRIG.slice(1) }, d, demais), /obrigatórias/);
    assert.throws(() => s.sanitizeProposta({ itens: [{ item_id: 'i1', valor: 20 }], declaracoes: OBRIG }, d, lic), /marca a declaração/);
    // Quem não é ME/EPP não leva a declaração, mesmo marcada.
    assert.deepEqual(s.sanitizeProposta({ itens: [{ item_id: 'i1', valor: 20 }], declaracoes: [...OBRIG, 'meepp'] }, d, demais).declaracoes, OBRIG);
    assert.deepEqual(s.alertasDaProposta({ itens: [{ item_id: 'i1', valor: 10 }] }, d), ['Item 1: o valor está abaixo da metade do estimado']);
    const lote = s.sanitizeDadosCertame({ ...base, unidade_disputa: 'lote', itens: base.itens.map((i) => ({ ...i, lote: 1, exclusivo_meepp: false })) }, 'cotacao');
    assert.throws(() => s.sanitizeProposta({ itens: [{ item_id: 'i1', valor: 20 }], declaracoes: OBRIG }, lote, demais), /Lote 1: cote todos/);
    const pl = s.sanitizeProposta({ itens: [{ item_id: 'i1', valor: 20 }, { item_id: 'i2', valor: 30 }], declaracoes: OBRIG }, lote, demais);
    assert.equal(s.valorNaUnidade(pl, s.unidadesDeDisputa(lote)[0], 'menor_preco'), 2300);
});

test('certame: texto do aviso esconde o orçamento sigiloso', () => {
    const d = s.sanitizeDadosCertame(base, 'dispensa');
    const t = s.textoDoAviso('dispensa', d, '0001/2026', 'Compras');
    assert.match(t, /Dispensa eletrônica · Processo 0001\/2026/);
    assert.match(t, /lances por 6 horas, com intervalo mínimo de 1% entre lances/);
    assert.match(t, /valor estimado unitário R\$\s?25,90/);
    const sig = s.textoDoAviso('dispensa', { ...d, orcamento_sigiloso: true }, '0001/2026', 'Compras');
    assert.doesNotMatch(sig, /25,90/);
    assert.match(sig, /orçamento estimado é sigiloso/);
    assert.equal(s.codigoDoAviso(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 31])).length, 8);
});

test('sala de lances: momento, lance, intervalo e classificação (S12)', () => {
    const x = { abertura_em: '2026-11-20T13:00:00.000Z', lances: true, horas_lances: 6 };
    assert.equal(s.fimDosLances(x), '2026-11-20T19:00:00.000Z');
    assert.equal(s.momentoDaDisputa(x, '2026-11-20T12:59:59.000Z'), 'propostas');
    assert.equal(s.momentoDaDisputa(x, '2026-11-20T13:00:00.000Z'), 'lances');
    assert.equal(s.momentoDaDisputa(x, '2026-11-20T19:00:00.000Z'), 'encerrada');
    assert.equal(s.momentoDaDisputa({ ...x, lances: false }, '2026-11-20T13:00:01.000Z'), 'encerrada');
    const d = { criterio: 'menor_preco', unidade_disputa: 'item', intervalo: { tipo: 'percentual', valor: 1 } };
    assert.equal(s.problemaDoLance(99, 100, d), '');
    assert.match(s.problemaDoLance(99.5, 100, d), /intervalo mínimo.*99,00/);
    assert.match(s.problemaDoLance(100, 100, d), /menor que o seu último/);
    assert.equal(s.problemaDoLance(50, 100, { ...d, intervalo: { tipo: 'valor', valor: 0 } }), '');
    const desc = { criterio: 'maior_desconto', intervalo: { tipo: 'percentual', valor: 0.5 } };
    assert.equal(s.problemaDoLance(10.5, 10, desc), '');
    assert.match(s.problemaDoLance(10.2, 10, desc), /ao menos 10,5%/);
    assert.match(s.problemaDoLance(100, 10, desc), /menor que 100%/);
    const u = { chave: 'i1', itens: [{ id: 'i1', quantidade: 10 }] };
    const p = { itens: [{ item_id: 'i1', valor: 8 }], atualizada_em: '2026-11-19T10:00:00Z' };
    assert.equal(s.valorDaProposta(p, u, d), 8);
    assert.equal(s.totalDoValor(7.5, u, d), 75);
    assert.equal(s.valorDaProposta(p, u, { ...d, unidade_disputa: 'lote' }), 80);
    const lances = [
        { id: 'a', seq: 1, chave: 'i1', uid: 'A', valor: 7, total: 70, em: '2026-11-20T13:01:00Z' },
        { id: 'b', seq: 2, chave: 'i1', uid: 'A', valor: 6, total: 60, em: '2026-11-20T13:02:00Z', excluido: { por: 'agente', em: 'x' } },
    ];
    assert.deepEqual(s.posicaoDe('A', p, u, d, lances), { uid: 'A', valor: 7, total: 70, em: '2026-11-20T13:01:00Z', seq: 1 });
    assert.equal(s.posicaoDe('B', p, u, d, lances).seq, 0);
    // Empate: vale quem chegou antes ao valor.
    const ord = s.ordenarPosicoes([
        { uid: 'B', valor: 7, total: 70, em: '2026-11-20T13:05:00Z', seq: 4 },
        { uid: 'A', valor: 7, total: 70, em: '2026-11-20T13:01:00Z', seq: 1 },
        { uid: 'C', valor: 8, total: 80, em: '2026-11-19T10:00:00Z', seq: 0 },
    ], d);
    assert.deepEqual(ord.map((v) => v.uid), ['A', 'B', 'C']);
    assert.deepEqual(s.ordenarPosicoes(ord, { criterio: 'maior_desconto' }).map((v) => v.uid), ['C', 'A', 'B']);
});
