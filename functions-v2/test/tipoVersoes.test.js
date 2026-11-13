// Versões do tipo, correção sem trava e rito só por tipo. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const cp = require('../lib/shared/camposProcesso');

test('obrigatório criado depois não trava a correção; o já gravado segue obrigatório', () => {
    const form = { campos: [
        { id: 'a', rotulo: 'Antigo', tipo: 'texto', obrigatorio: true, visivel_partes: false },
        { id: 'b', rotulo: 'Novo', tipo: 'texto', obrigatorio: true, visivel_partes: false },
    ] };
    const antes = [{ id: 'a', rotulo: 'Antigo', tipo: 'texto', valor: 'x', visivel_partes: false }];
    const corr = cp.formParaCorrecao(form, antes);
    assert.equal(corr.campos[0].obrigatorio, true);
    assert.equal(corr.campos[1].obrigatorio, false);
    assert.equal(form.campos[1].obrigatorio, true, 'não altera o formulário recebido');
    // Corrige o antigo sem preencher o novo.
    assert.equal(cp.validarCampos(corr, { a: 'y' }, antes)[0].valor, 'y');
    // Apagar o já gravado continua recusado.
    assert.throws(() => cp.validarCampos(corr, { a: '' }, antes), /Preencha "Antigo"/);
});

test('correção: obrigatório só oculto pela condição volta a ser cobrado quando aparece', () => {
    const form = cp.sanitizeFormulario({ assunto: 'obrigatorio', descricao: 'obrigatorio', campos: [
        { id: 'modo', rotulo: 'Modo', tipo: 'lista', opcoes: ['A', 'B'] },
        { id: 'sala', rotulo: 'Sala', tipo: 'texto', obrigatorio: true, condicao: { campo_id: 'modo', valor: 'A' } }] });
    const antes = [{ id: 'modo', rotulo: 'Modo', tipo: 'lista', valor: 'B' }];
    const corr = cp.formParaCorrecao(form, antes, '');
    assert.equal(corr.campos[1].obrigatorio, true, 'com B a sala estava oculta: continua obrigatória');
    assert.throws(() => cp.validarCampos(corr, { modo: 'A' }, antes), /Preencha "Sala"/);
    assert.equal(corr.descricao, 'opcional', 'processo sem descrição não trava');
    assert.equal(cp.formParaCorrecao(form, antes, 'tinha').descricao, 'obrigatorio');
    const comA = cp.formParaCorrecao(form, [{ id: 'modo', valor: 'A' }], 'x');
    assert.equal(comA.campos[1].obrigatorio, false, 'com A a sala aparecia e nunca foi gravada');
});

test('rito grava sempre exigir_tipo (desligar apaga a marca)', () => {
    const base = { nome: 'R', fases: [{ nome: 'F' }] };
    assert.equal(s.sanitizeRito({ ...base, exigir_tipo: true }).exigir_tipo, true);
    assert.equal(s.sanitizeRito(base).exigir_tipo, false);
    assert.equal(s.sanitizeRito({ ...base, exigir_tipo: 'sim' }).exigir_tipo, false);
});
