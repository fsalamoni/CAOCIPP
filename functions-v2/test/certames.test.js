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

test('julgamento: empate ficto ME/EPP, desempate, recusa e resultado (S13)', () => {
    const d = { criterio: 'menor_preco' };
    const c = (uid, total, porte = 'demais') => ({ uid, valor: total, total, porte, em: '2026-11-15T12:00:00.000Z' });
    // ME/EPP a até 5% da primeira (demais) entra no desempate; acima de 5% não.
    assert.deepEqual(s.candidatosDoDesempate([c('a', 100), c('b', 104, 'me_epp'), c('x', 106, 'me_epp'), c('e', 105, 'me_epp')], d), ['b', 'e']);
    assert.deepEqual(s.candidatosDoDesempate([c('b', 100, 'me_epp'), c('a', 101)], d), [], 'a primeira já é ME/EPP: sem empate ficto');
    // No desconto, compara o preço equivalente (100 - desconto): 20% x 16,5% fica a 4,375%.
    assert.deepEqual(s.candidatosDoDesempate([c('a', 20), c('b', 16.5, 'me_epp'), c('x', 15, 'me_epp')], { criterio: 'maior_desconto' }), ['b']);
    let u = s.abrirUnidade([c('a', 100), c('b', 104, 'me_epp')], d);
    assert.equal(u.situacao, 'desempate');
    assert.equal(u.vez, null);
    assert.match(s.aplicarDesempate(u, 'b', 100, 100, 'x', d), /menor que a da primeira colocada/);
    const v = s.aplicarDesempate(u, 'b', 99, 99, 'x', d);
    assert.equal(v.situacao, 'analise');
    assert.equal(v.vez, 'b');
    assert.deepEqual(v.ordem.map((o) => o.uid), ['b', 'a']);
    assert.ok(v.ordem[0].desempate && !v.desempate);
    u = s.fimDoDesempate({ ...u, desempate: { candidatos: ['b'], feitos: ['b'] } });
    assert.equal(u.vez, 'a');
    assert.equal(s.proximaVez({ ordem: u.ordem, recusas: [{ uid: 'a' }] }), 'b');
    assert.equal(s.proximaVez({ ordem: u.ordem, recusas: [{ uid: 'a' }, { uid: 'b' }] }), null);
    assert.equal(s.abrirUnidade([], d).situacao, 'deserta');
    assert.equal(s.resultadoDaDisputa([{ situacao: 'habilitada' }, { situacao: 'fracassada' }]), 'Homologada');
    assert.equal(s.resultadoDaDisputa([{ situacao: 'deserta' }, { situacao: 'deserta' }]), 'Deserta');
    assert.equal(s.resultadoDaDisputa([{ situacao: 'deserta' }, { situacao: 'fracassada' }]), 'Fracassada');
    assert.ok(s.julgamentoConcluido([{ situacao: 'habilitada' }, { situacao: 'deserta' }]));
    assert.ok(!s.julgamentoConcluido([{ situacao: 'aceita' }]));
});

test('julgamento: prazos do recurso em dias úteis, momentos e ata (S13)', () => {
    // Sexta, 13/11/2026: 3 dias úteis (16, 17 e 18) vencem na quarta, 18/11, às 23:59 de Brasília.
    assert.equal(s.fimDoPrazoUtil('2026-11-13', 3), '2026-11-19T02:59:59.000Z');
    const r = { intencao_ate: '2026-11-16T12:10:00.000Z', razoes_ate: '2026-11-19T02:59:59.000Z', contrarrazoes_ate: '2026-11-24T02:59:59.000Z', intencoes: [], contrarrazoes: [] };
    assert.equal(s.momentoDoRecurso(r, '2026-11-16T12:05:00.000Z'), 'intencao');
    assert.equal(s.momentoDoRecurso(r, '2026-11-16T12:11:00.000Z'), 'sem_recurso');
    const i = { ...r, intencoes: [{ uid: 'b', nome: 'B', motivo: 'm', em: 'x' }] };
    assert.equal(s.momentoDoRecurso(i, '2026-11-17T12:00:00.000Z'), 'razoes');
    assert.equal(s.momentoDoRecurso(i, '2026-11-20T12:00:00.000Z'), 'decisao', 'sem razões no prazo, decide-se já');
    const a = { ...r, intencoes: [{ uid: 'b', nome: 'B', motivo: 'm', em: 'x', razoes: { texto: 't', em: 'x' } }] };
    assert.equal(s.momentoDoRecurso(a, '2026-11-20T12:00:00.000Z'), 'contrarrazoes');
    assert.equal(s.momentoDoRecurso(a, '2026-11-25T12:00:00.000Z'), 'decisao');
    assert.equal(s.momentoDoRecurso({ ...a, decisao: { provimento: 'nao' } }, '2026-11-25T12:00:00.000Z'), 'decidido');
    const ata = s.textoDaAta({ criterio: 'menor_preco', objeto: 'Papel', perfil: 'dispensa', processo_numero: '1/2026', abertura_em: '2026-11-16T12:00:00.000Z' },
        [{ nome: 'Item 1', u: { situacao: 'habilitada', ordem: [{ uid: 'b', total: 900, porte: 'me_epp', desempate: true }], recusas: [{ uid: 'a', etapa: 'habilitacao', motivo: 'Certidão vencida' }], habilitada: { uid: 'b', total: 900 } } }],
        (x) => ({ a: 'Alfa', b: 'Beta' })[x], [{ ...a, contrarrazoes: [{ nome: 'Alfa' }], decisao: { provimento: 'nao', fundamentos: 'Sem razão.' } }], 'Homologada', 3);
    assert.match(ata, /ATA DA DISPENSA ELETRÔNICA/);
    assert.match(ata, /1º Beta \(ME\/EPP\): R\$\s?900,00, oferta de desempate/);
    assert.match(ata, /Inabilitado: Alfa\. Motivo: Certidão vencida/);
    assert.match(ata, /Desfecho: Beta, R\$\s?900,00\./);
    assert.match(ata, /Decisão: Negado provimento\. Sem razão\./);
    assert.match(ata, /Resultado: Homologada\./);
});

test('equipe da disputa: papéis, recurso em duas instâncias e observador (S14)', () => {
    // Sem equipe: tudo de quem tem o processo (como antes).
    for (const ato of ['conduzir', 'conversar', 'homologar']) {
        assert.equal(s.podeNaDisputa(undefined, 'u1', true, ato), true);
        assert.equal(s.podeNaDisputa(undefined, 'u1', false, ato), false);
    }
    const eq = { agente: { uid: 'ag', nome: 'Ana' }, apoio: [{ uid: 'ap', nome: 'Beto' }], autoridade: { uid: 'au', nome: 'Caio' } };
    assert.equal(s.podeNaDisputa(eq, 'ag', false, 'conduzir'), true, 'o agente conduz mesmo fora da unidade');
    assert.equal(s.podeNaDisputa(eq, 'dono', true, 'conduzir'), false, 'com agente, quem tem o processo não conduz');
    assert.equal(s.podeNaDisputa(eq, 'ap', false, 'conversar'), true);
    assert.equal(s.podeNaDisputa(eq, 'ap', false, 'conduzir'), false);
    assert.equal(s.podeNaDisputa(eq, 'au', false, 'homologar'), true);
    assert.equal(s.podeNaDisputa(eq, 'ag', false, 'homologar'), false, 'com autoridade, o agente não homologa');
    assert.equal(s.podeNaDisputa({ apoio: [] }, 'dono', true, 'homologar'), true, 'sem autoridade, homologa quem conduz');
    assert.deepEqual(s.uidsDaEquipe(eq).sort(), ['ag', 'ap', 'au']);
    assert.deepEqual(s.papeisNaEquipe(eq, 'au'), ['Autoridade superior']);
    assert.match(s.textoDaEquipe({ apoio: [] }), /não designado \(conduz quem tem o processo\)/);

    const r = { intencao_ate: '2026-11-16T12:10:00.000Z', razoes_ate: '2026-11-19T02:59:59.000Z', contrarrazoes_ate: '2026-11-24T02:59:59.000Z', contrarrazoes: [],
        intencoes: [{ uid: 'b', nome: 'B', motivo: 'm', em: 'x', razoes: { texto: 't', em: 'x' } }] };
    const enc = { ...r, encaminhado: { fundamentos: 'Mantenho.', em: 'x', por: 'Ana' } };
    assert.equal(s.momentoDoRecurso(enc, '2026-11-25T12:00:00.000Z'), 'autoridade');
    assert.equal(s.momentoDoRecurso({ ...enc, decisao: { provimento: 'nao' } }, '2026-11-25T12:00:00.000Z'), 'decidido');
    const ata = s.textoDaAta({ criterio: 'menor_preco', objeto: 'Papel', perfil: 'dispensa', processo_numero: '1/2026' },
        [], () => 'B', [{ ...enc, decisao: { provimento: 'nao', fundamentos: 'Sem razão.' } }], 'Homologada', 0);
    assert.match(ata, /Mantida a decisão por Ana, que encaminhou o recurso à autoridade superior: Mantenho\./);
    assert.match(ata, /Decisão da autoridade superior: Negado provimento\./);

    const x = { perfil: 'dispensa', situacao: 'publicado', abertura_em: '2026-11-16T12:00:00.000Z', fornecedores_uids: ['f1'] };
    assert.equal(s.podeObservar(x, 'outro', '2026-11-16T11:00:00.000Z'), false, 'antes da abertura, não');
    assert.equal(s.podeObservar(x, 'outro', '2026-11-16T13:00:00.000Z'), true);
    assert.equal(s.podeObservar({ ...x, perfil: 'cotacao' }, 'outro', '2026-11-16T13:00:00.000Z'), false, 'cotação privada: só convidados');
    assert.equal(s.podeObservar({ ...x, perfil: 'cotacao' }, 'f1', '2026-11-16T13:00:00.000Z'), true);
});
