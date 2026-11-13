import test from 'node:test';
import assert from 'node:assert/strict';
import { copiarCampos, formParaCorrecao, problemasFormulario } from './camposProcesso.js';
import { deRito, montarPayload } from './propostaRito.js';

test('copiar campos: id novo, condição remapeada e exigir_em só do rito deste tipo', () => {
    const origem = [
        { id: 'modo', rotulo: 'Modo', tipo: 'lista', opcoes: ['A', 'B'], obrigatorio: false, visivel_partes: true, exigir_em: ['x', 'f1'] },
        { id: 'sala', rotulo: 'Sala', tipo: 'texto', obrigatorio: false, visivel_partes: false, condicao: { campo_id: 'modo', valor: 'A' }, exigir_em: ['x'] },
    ];
    const novos = copiarCampos(origem, ['f1']);
    assert.equal(novos.length, 2);
    assert.ok(novos.every((c, i) => c.id !== origem[i].id && /^[a-z0-9_]{1,24}$/.test(c.id)));
    assert.notEqual(novos[0].id, novos[1].id);
    assert.equal(novos[1].condicao.campo_id, novos[0].id);
    assert.deepEqual(novos[0].exigir_em, ['f1']);
    assert.equal('exigir_em' in novos[1], false);
    assert.deepEqual(problemasFormulario({ ...formularioMin(), campos: novos }, ['f1']), []);
    // Sem lugar para o campo de que dependia: a condição sai.
    const um = copiarCampos([origem[1]], []);
    assert.equal(um[0].condicao, undefined);
    assert.equal(copiarCampos(origem, [], 1).length, 1);
    assert.equal(copiarCampos(origem, [], 0).length, 0);
});

function formularioMin() { return { assunto: 'obrigatorio', descricao: 'opcional', partes: 'opcional', origem: 'opcional', polos: ['requerente'], rotulos: {} }; }

test('correção: só o obrigatório que o processo já tinha segue valendo', () => {
    const f = formParaCorrecao({ campos: [{ id: 'a', obrigatorio: true }, { id: 'b', obrigatorio: true }] }, [{ id: 'a' }]);
    assert.deepEqual(f.campos.map((c) => c.obrigatorio), [true, false]);
    const cond = { descricao: 'obrigatorio', campos: [{ id: 'm', obrigatorio: false }, { id: 's', obrigatorio: true, condicao: { campo_id: 'm', valor: 'A' } }] };
    assert.equal(formParaCorrecao(cond, [{ id: 'm', valor: 'B' }], '').campos[1].obrigatorio, true);
    assert.equal(formParaCorrecao(cond, [{ id: 'm', valor: 'A' }], '').campos[1].obrigatorio, false);
    assert.equal(formParaCorrecao(cond, [], '').descricao, 'opcional');
    assert.equal(formParaCorrecao(cond, [], 'x').descricao, 'obrigatorio');
});

test('o rito leva "autuar só por tipo" da tela ao servidor', () => {
    const p = deRito({ id: 'r1', nome: 'R', exigir_tipo: true, fases: [{ id: 'f', nome: 'F' }] });
    assert.equal(p.exigir_tipo, true);
    assert.equal(montarPayload(p, { criar: false }).rito.exigir_tipo, true);
    assert.equal(montarPayload(deRito({ nome: 'R', fases: [] }), { criar: false }).rito.exigir_tipo, false);
});
