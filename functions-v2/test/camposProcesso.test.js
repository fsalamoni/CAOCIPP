// Formulário de autuação por tipo de processo. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../lib/shared/camposProcesso');

const form = () => c.sanitizeFormulario({
    descricao: 'obrigatorio', partes: 'oculto',
    campos: [
        { id: 'valor', rotulo: 'Valor da causa', tipo: 'numero', obrigatorio: true },
        { id: 'origem', rotulo: 'Origem', tipo: 'lista', opcoes: ['Ouvidoria', 'Ofício', 'Ofício', ''], visivel_partes: true },
        { id: 'fato', rotulo: 'Data do fato', tipo: 'data' },
        { id: 'urg', rotulo: 'Urgente', tipo: 'sim_nao' },
        { id: 'obs', rotulo: 'Observações', tipo: 'texto_longo', ajuda: 'O que mais importa' },
    ],
});

test('formulário: saneia tipos, opções repetidas e usos; tipo antigo recebe o padrão', () => {
    const f = form();
    assert.equal(f.descricao, 'obrigatorio');
    assert.equal(f.partes, 'oculto');
    assert.deepEqual(f.campos[1].opcoes, ['Ouvidoria', 'Ofício']);
    assert.equal(f.campos[1].visivel_partes, true);
    assert.equal(f.campos[0].visivel_partes, false);
    assert.deepEqual(c.formularioDe({}), {
        assunto: 'obrigatorio', descricao: 'opcional', partes: 'opcional', origem: 'opcional', sigilo: 'opcional', urgencia: 'opcional', unidade: 'opcional',
        rotulos: {}, ajudas: {}, polos: ['requerente', 'requerido', 'interessado', 'terceiro'], campos: [],
    });
    assert.deepEqual(c.formularioDe(null).campos, []);
    assert.equal(c.sanitizeFormulario({ descricao: 'xx' }).descricao, 'opcional');
});

test('formulário: recusa campo sem nome, nomes repetidos, nome de campo padrão e lista sem opções', () => {
    assert.throws(() => c.sanitizeFormulario({ campos: [{ rotulo: ' ' }] }), /nome ao campo 1/);
    assert.throws(() => c.sanitizeFormulario({ campos: [{ rotulo: 'Origem' }, { rotulo: 'origem' }] }), /dois campos/);
    assert.throws(() => c.sanitizeFormulario({ campos: [{ rotulo: 'Descrição' }] }), /campo padrão/);
    assert.throws(() => c.sanitizeFormulario({ campos: [{ rotulo: 'Via', tipo: 'lista', opcoes: ['uma'] }] }), /duas opções/);
    assert.throws(() => c.sanitizeFormulario({ campos: Array.from({ length: 41 }, (_x, i) => ({ rotulo: `C${i}` })) }), /até 40/);
});

test('formulário: id inválido ou repetido é trocado; id válido é mantido', () => {
    const f = c.sanitizeFormulario({ campos: [{ id: 'a', rotulo: 'A' }, { id: 'a', rotulo: 'B' }, { id: 'Com Espaço', rotulo: 'C' }] });
    assert.equal(f.campos[0].id, 'a');
    assert.equal(new Set(f.campos.map((x) => x.id)).size, 3);
    f.campos.forEach((x) => assert.match(x.id, /^[a-z0-9_]{1,24}$/));
});

test('valores: converte, guarda a cópia do nome e ignora campo desconhecido', () => {
    const v = c.validarCampos(form(), { valor: '1.234,56', origem: 'Ofício', fato: '2026-02-28', urg: 'nao', obs: '  texto  ', intruso: 'x' });
    assert.deepEqual(v.map((x) => [x.id, x.valor]), [['valor', 1234.56], ['origem', 'Ofício'], ['fato', '2026-02-28'], ['urg', false], ['obs', 'texto']]);
    assert.equal(v[1].rotulo, 'Origem');
    assert.equal(v[1].visivel_partes, true);
    // Vazio e opcional: não grava.
    assert.deepEqual(c.validarCampos(form(), { valor: 10, origem: '', obs: '   ' }).map((x) => x.id), ['valor']);
});

test('valores: obrigatório vazio e valores inválidos são recusados com o nome do campo', () => {
    assert.throws(() => c.validarCampos(form(), {}), /Preencha "Valor da causa"/);
    assert.throws(() => c.validarCampos(form(), { valor: 'dez' }), /precisa ser um número/);
    assert.throws(() => c.validarCampos(form(), { valor: 1, origem: 'Outra' }), /opções de "Origem"/);
    assert.throws(() => c.validarCampos(form(), { valor: 1, fato: '2026-02-30' }), /data válida/);
    assert.throws(() => c.validarCampos(form(), { valor: 1, fato: '30/02/2026' }), /data válida/);
    assert.throws(() => c.validarCampos(form(), { valor: 1, urg: 'talvez' }), /sim ou não/);
});

test('padrões: descrição e partes obrigatórias', () => {
    const v = (o) => ({ assunto: 'x', descricao: '', partes: [], origem: null, ...o });
    assert.throws(() => c.validarPadrao(form(), v()), /Descrição/);
    c.validarPadrao(form(), v({ descricao: 'ok' }));
    assert.throws(() => c.validarPadrao(c.formularioDe({ formulario: { partes: 'obrigatorio' } }), v()), /Partes e interessados/);
});

test('texto do valor e diferenças para o histórico', () => {
    const antes = c.validarCampos(form(), { valor: 10, origem: 'Ofício', urg: 'sim' });
    const depois = c.validarCampos(form(), { valor: '12,5', origem: 'Ofício', fato: '2026-03-01' });
    assert.equal(c.valorTexto(depois[0]), '12,5');
    assert.equal(c.valorTexto(depois[2]), '01/03/2026');
    assert.deepEqual(c.diferencasCampos(antes, depois), [
        'Valor da causa: de "10" para "12,5"', 'Data do fato: "01/03/2026"', 'Urgente: apagado (era "Sim")',
    ]);
    assert.deepEqual(c.diferencasCampos(antes, antes), []);
});

test('formulário: todos os campos padrão são configuráveis (uso, nome, orientação e polos)', () => {
    const f = c.sanitizeFormulario({
        assunto: 'oculto', origem: 'obrigatorio', sigilo: 'oculto', urgencia: 'obrigatorio', unidade: 'xx',
        rotulos: { descricao: 'Relato do fato', partes: 'Envolvidos', invalido: 'x' }, ajudas: { origem: 'Como chegou' },
        polos: ['interessado', 'nada'], campos: [{ rotulo: 'Número do ofício' }],
    });
    assert.equal(f.assunto, 'oculto');
    assert.equal(f.origem, 'obrigatorio');
    assert.equal(f.sigilo, 'oculto');
    assert.equal(f.urgencia, 'opcional', 'escolha só aparece ou não');
    assert.equal(f.unidade, 'opcional');
    assert.deepEqual(f.rotulos, { descricao: 'Relato do fato', partes: 'Envolvidos' });
    assert.deepEqual(f.ajudas, { origem: 'Como chegou' });
    assert.deepEqual(f.polos, ['interessado']);
    assert.equal(c.rotuloDe(f, 'descricao'), 'Relato do fato');
    assert.equal(c.rotuloDe(f, 'assunto'), 'Assunto');
    const v = { assunto: '', descricao: '', partes: [], origem: null };
    assert.throws(() => c.validarPadrao(f, v), /Origem/);
    c.validarPadrao(f, { ...v, origem: { tipo: 'oficio' } });
    assert.throws(() => c.sanitizeFormulario({ rotulos: { partes: 'Envolvidos' }, campos: [{ rotulo: 'envolvidos' }] }), /campo padrão/);
    assert.throws(() => c.sanitizeFormulario({ assunto: 'oculto', descricao: 'oculto', partes: 'oculto' }), /identificar o processo/);
    assert.equal(c.sanitizeFormulario({ assunto: 'oculto', descricao: 'oculto', partes: 'oculto', campos: [{ rotulo: 'Protocolo' }] }).assunto, 'oculto');
});
