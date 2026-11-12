// Formulário mais livre: múltipla escolha, formatos, seções, campos condicionais
// e campos exigidos para sair de uma fase. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../lib/shared/camposProcesso');

const form = () => c.sanitizeFormulario({
    campos: [
        { id: 'tem_dano', rotulo: 'Houve dano?', tipo: 'sim_nao' },
        { id: 'valor', rotulo: 'Valor do dano', tipo: 'numero', formato: 'moeda', obrigatorio: true, secao: 'Dano', condicao: { campo_id: 'tem_dano', valor: 'sim' } },
        { id: 'areas', rotulo: 'Áreas', tipo: 'multipla', opcoes: ['Saúde', 'Educação', 'Meio ambiente'] },
        { id: 'laudo', rotulo: 'Laudo ambiental', tipo: 'texto', formato: 'link', condicao: { campo_id: 'areas', valor: 'Meio ambiente' } },
        { id: 'doc', rotulo: 'CPF ou CNPJ do responsável', tipo: 'texto', formato: 'cpf_cnpj', obrigatorio: true, exigir_em: ['instrucao'] },
        { id: 'mail', rotulo: 'E-mail', tipo: 'texto', formato: 'email' },
        { id: 'fone', rotulo: 'Telefone', tipo: 'texto', formato: 'telefone' },
    ],
});

test('formulário: formatos, seção, condição e exigir_em são saneados', () => {
    const f = form();
    assert.equal(f.campos[1].formato, 'moeda');
    assert.equal(f.campos[1].secao, 'Dano');
    assert.deepEqual(f.campos[1].condicao, { campo_id: 'tem_dano', valor: true }, 'sim vira true');
    assert.deepEqual(f.campos[2].opcoes, ['Saúde', 'Educação', 'Meio ambiente']);
    assert.equal(f.campos[4].obrigatorio, false, 'exigido numa fase não é obrigatório na autuação');
    assert.deepEqual(f.campos[4].exigir_em, ['instrucao']);
    // Formato que não serve ao tipo some.
    assert.equal(c.sanitizeFormulario({ campos: [{ rotulo: 'X', tipo: 'data', formato: 'email' }] }).campos[0].formato, undefined);
});

test('formulário: condição só aponta campo de escolha anterior, com valor que ele aceita', () => {
    assert.throws(() => c.sanitizeFormulario({ campos: [{ id: 'a', rotulo: 'A', tipo: 'texto', condicao: { campo_id: 'b', valor: 'x' } }, { id: 'b', rotulo: 'B', tipo: 'lista', opcoes: ['x', 'y'] }] }), /venha antes/);
    assert.throws(() => c.sanitizeFormulario({ campos: [{ id: 'a', rotulo: 'A', tipo: 'texto' }, { id: 'b', rotulo: 'B', tipo: 'texto', condicao: { campo_id: 'a', valor: 'x' } }] }), /lista ou de sim ou não/);
    assert.throws(() => c.sanitizeFormulario({ campos: [{ id: 'a', rotulo: 'A', tipo: 'lista', opcoes: ['x', 'y'] }, { id: 'b', rotulo: 'B', tipo: 'texto', condicao: { campo_id: 'a', valor: 'z' } }] }), /Escolha quando "B" aparece/);
    assert.throws(() => c.sanitizeFormulario({ campos: [{ rotulo: 'M', tipo: 'multipla', opcoes: ['só uma'] }] }), /duas opções/);
});

test('valores: campo condicional escondido não vale nem é exigido; em cadeia também', () => {
    const f = form();
    // Sem dano: o valor (obrigatório) não é pedido e o que veio é descartado.
    const sem = c.validarCampos(f, { tem_dano: 'nao', valor: '100', laudo: 'exemplo.org' });
    assert.deepEqual(sem.map((x) => x.id), ['tem_dano']);
    assert.throws(() => c.validarCampos(f, { tem_dano: 'sim' }), /Preencha "Valor do dano"/);
    const com = c.validarCampos(f, { tem_dano: true, valor: '1.234,5', areas: ['Meio ambiente', 'Saúde'], laudo: 'exemplo.org/laudo' });
    assert.equal(com.find((x) => x.id === 'valor').valor, 1234.5);
    assert.equal(c.valorTexto(com.find((x) => x.id === 'valor')), 'R$ 1.234,50');
    assert.deepEqual(com.find((x) => x.id === 'areas').valor, ['Saúde', 'Meio ambiente'], 'na ordem das opções');
    assert.equal(c.valorTexto(com.find((x) => x.id === 'areas')), 'Saúde, Meio ambiente');
    assert.equal(com.find((x) => x.id === 'laudo').valor, 'https://exemplo.org/laudo');
    // Em cadeia: C depende de B, que depende de A. A escondendo B esconde C.
    const cadeia = c.sanitizeFormulario({ campos: [
        { id: 'a', rotulo: 'A', tipo: 'sim_nao' },
        { id: 'b', rotulo: 'B', tipo: 'lista', opcoes: ['x', 'y'], condicao: { campo_id: 'a', valor: true } },
        { id: 'k', rotulo: 'C', tipo: 'texto', obrigatorio: true, condicao: { campo_id: 'b', valor: 'x' } },
    ] });
    assert.deepEqual(c.validarCampos(cadeia, { a: 'nao', b: 'x' }).map((x) => x.id), ['a']);
});

test('valores: múltipla, CPF, CNPJ, e-mail, telefone e link', () => {
    const f = form();
    assert.throws(() => c.validarCampos(f, { areas: ['Cultura'] }), /Escolha entre as opções de "Áreas"/);
    assert.deepEqual(c.validarCampos(f, { areas: [] }), [], 'nenhuma marcada = vazio');
    assert.equal(c.validarCampos(f, { doc: '52998224725' })[0].valor, '529.982.247-25');
    assert.equal(c.validarCampos(f, { doc: '11.222.333/0001-81' })[0].valor, '11.222.333/0001-81');
    assert.throws(() => c.validarCampos(f, { doc: '529.982.247-26' }), /CPF ou CNPJ válido/);
    assert.throws(() => c.validarCampos(f, { doc: '111.111.111-11' }), /CPF ou CNPJ válido/);
    assert.equal(c.validarCampos(f, { mail: 'Fulano@Exemplo.org ' })[0].valor, 'fulano@exemplo.org');
    assert.throws(() => c.validarCampos(f, { mail: 'fulano@' }), /e-mail válido/);
    assert.equal(c.validarCampos(f, { fone: '(51) 3295-1100' })[0].valor, '(51) 3295-1100');
    assert.throws(() => c.validarCampos(f, { fone: '3295-1100' }), /telefone com DDD/);
    assert.throws(() => c.validarCampos(f, { tem_dano: true, valor: 1, areas: ['Meio ambiente'], laudo: 'javascript:alert(1)' }), /endereço da internet/);
});

test('campos exigidos por fase: cópia na autuação, falta enquanto vazio, some quando preenchido', () => {
    const f = form();
    const exigidos = c.camposExigidos(f, ['triagem', 'instrucao']);
    assert.deepEqual(exigidos, { instrucao: [{ id: 'doc', rotulo: 'CPF ou CNPJ do responsável' }] });
    assert.deepEqual(c.camposExigidos(f, ['triagem']), {}, 'fase que o processo não tem fica de fora');
    const campos = c.validarCampos(f, {});
    assert.deepEqual(c.camposFaltando(exigidos.instrucao, campos).map((x) => x.rotulo), ['CPF ou CNPJ do responsável']);
    assert.deepEqual(c.camposFaltando(exigidos.instrucao, c.validarCampos(f, { doc: '52998224725' })), []);
    // Exigido mas condicional: só falta quando a condição se cumpre.
    const cond = [{ id: 'valor', rotulo: 'Valor do dano', condicao: { campo_id: 'tem_dano', valor: true } }];
    assert.deepEqual(c.camposFaltando(cond, c.validarCampos(f, { tem_dano: 'nao' })), []);
    assert.equal(c.camposFaltando(cond, [{ id: 'tem_dano', tipo: 'sim_nao', valor: true }]).length, 1);
    assert.deepEqual(c.camposFaltando(undefined, undefined), []);
});

test('revisão: CNPJ alfanumérico, link com porta, limites de telefone e de moeda', () => {
    assert.equal(c.cpfCnpj('12.abc.345/01de-35'), '12.ABC.345/01DE-35', 'CNPJ alfanumérico (IN RFB 2.229/2024)');
    assert.equal(c.cpfCnpj('12ABC34501DE36'), null);
    assert.equal(c.linkValido('exemplo.org:8080/x'), 'https://exemplo.org:8080/x');
    assert.equal(c.linkValido('javascript:alert(1)'), null);
    const f = form();
    assert.throws(() => c.validarCampos(f, { fone: `(51)${' '.repeat(100)}32951100` }), /telefone/);
    assert.throws(() => c.validarCampos(f, { tem_dano: 'sim', valor: `1${'0'.repeat(307)}` }), /fora do limite/);
    // Opção longa: a condição compara já cortada em 80, como as opções.
    const longa = 'x'.repeat(90);
    const g = c.sanitizeFormulario({ campos: [{ id: 'a', rotulo: 'A', tipo: 'lista', opcoes: [longa, 'y'] }, { id: 'b', rotulo: 'B', tipo: 'texto', condicao: { campo_id: 'a', valor: longa } }] });
    assert.equal(g.campos[1].condicao.valor, 'x'.repeat(80));
});

test('revisão: corrigir dados não trava nem muda valor antigo que o tipo passou a formatar', () => {
    const f = form();
    const antes = [
        { id: 'doc', rotulo: 'Doc', tipo: 'texto', valor: 'não informado', visivel_partes: false },
        { id: 'tem_dano', rotulo: 'Houve dano?', tipo: 'sim_nao', valor: true, visivel_partes: false },
        { id: 'valor', rotulo: 'Valor', tipo: 'numero', valor: 10.555, visivel_partes: false },
    ];
    const depois = c.validarCampos(f, { doc: 'não informado', tem_dano: 'sim', valor: '10,555' }, antes);
    assert.equal(depois.find((x) => x.id === 'doc').valor, 'não informado', 'texto antigo fica, mesmo sem ser CPF');
    assert.equal(depois.find((x) => x.id === 'valor').valor, 10.555, 'número antigo não é arredondado');
    assert.equal(depois.find((x) => x.id === 'doc').rotulo, 'CPF ou CNPJ do responsável', 'nome de agora');
    assert.deepEqual(c.diferencasCampos(antes, depois).filter((s) => !s.startsWith('CPF')), []);
    assert.throws(() => c.validarCampos(f, { doc: 'outro texto' }, antes), /CPF ou CNPJ/, 'valor novo segue o formato');
});

test('revisão: campo exigido conta pelo tipo de hoje', () => {
    const exigidos = [{ id: 'doc', rotulo: 'Doc antigo' }, { id: 'sumiu', rotulo: 'Sumiu' }];
    const f = form();
    assert.deepEqual(c.camposFaltando(exigidos, [], f).map((x) => x.rotulo), ['CPF ou CNPJ do responsável'], 'o que o tipo não tem mais não trava');
    assert.equal(c.camposFaltando(exigidos, [], null).length, 2, 'sem o tipo, vale a cópia');
    // Condição que o tipo ganhou depois também vale.
    const comCond = { campos: [{ id: 'doc', rotulo: 'Doc', condicao: { campo_id: 'tem_dano', valor: true } }] };
    assert.deepEqual(c.camposFaltando(exigidos, [{ id: 'tem_dano', valor: false }], comCond), []);
});

test('diferenças no histórico com múltipla escolha', () => {
    const antes = [{ id: 'areas', rotulo: 'Áreas', tipo: 'multipla', valor: ['Saúde'] }];
    const depois = [{ id: 'areas', rotulo: 'Áreas', tipo: 'multipla', valor: ['Saúde', 'Educação'] }];
    assert.deepEqual(c.diferencasCampos(antes, depois), ['Áreas: de "Saúde" para "Saúde, Educação"']);
});
