const test = require('node:test');
const assert = require('node:assert/strict');
const { podeExcluirProcesso, mesclarLotacoes, trocarUnidadeDasFases } = require('../lib/shared/secretaria');

const ctx = (uid, extra = {}) => ({ uid, isAdmin: false, unidadeIds: ['sec'], ...extra });
const proc = { unidade_atual: 'sec', autuado_por: 'ana', status: 'em_tramitacao', partes_uids: [] };

test('exclusão: admin exclui qualquer processo, menos onde é parte', () => {
    const adm = ctx('chefe', { isAdmin: true, unidadeIds: [] });
    assert.equal(podeExcluirProcesso({ ...proc, partes_uids: ['x'] }, [{ autor_uid: 'bia' }], adm), true);
    assert.equal(podeExcluirProcesso({ ...proc, partes_uids: ['chefe'] }, [], adm), false);
    assert.equal(podeExcluirProcesso({ ...proc, status: 'excluido' }, [], adm), false);
});

test('exclusão: quem autuou só exclui enquanto ninguém mais agiu', () => {
    assert.equal(podeExcluirProcesso(proc, [{ autor_uid: 'ana' }, { autor_uid: 'ana' }], ctx('ana')), true);
    assert.equal(podeExcluirProcesso(proc, [{ autor_uid: 'ana' }, { autor_uid: 'bia' }], ctx('ana')), false, 'outra pessoa agiu');
    assert.equal(podeExcluirProcesso({ ...proc, partes_uids: ['p1'] }, [{ autor_uid: 'ana' }], ctx('ana')), false, 'parte habilitada');
    assert.equal(podeExcluirProcesso({ ...proc, unidade_atual: 'gab' }, [{ autor_uid: 'ana' }], ctx('ana')), false, 'saiu da unidade');
    assert.equal(podeExcluirProcesso(proc, [{ autor_uid: 'ana' }], ctx('bia')), false, 'não autuou');
});

test('equipe: quem salva a partir de versão antiga não desfaz o que outro fez', () => {
    const base = [{ uid: 'a', gestor: true }, { uid: 'b' }];
    // Enquanto a pessoa editava, o gestor admitiu "c" e deu atribuição a "b".
    const atual = [{ uid: 'a', gestor: true }, { uid: 'b', atribuicao: 'Analista' }, { uid: 'c' }];
    // A pessoa tirou "a" da gestão e incluiu "d"; não mexeu em "b".
    const minha = [{ uid: 'a' }, { uid: 'b' }, { uid: 'd' }];
    assert.deepEqual(mesclarLotacoes(atual, base, minha), [{ uid: 'a' }, { uid: 'b', atribuicao: 'Analista' }, { uid: 'c' }, { uid: 'd' }]);
    // Quem tirou "b" da equipe tira mesmo que outro o tenha alterado.
    assert.deepEqual(mesclarLotacoes(atual, base, [{ uid: 'a', gestor: true }]).map((l) => l.uid), ['a', 'c']);
});

test('exclusão de unidade: fases trocam para a sucessora ou ficam sem unidade', () => {
    const fases = [{ id: 'a', unidade_id: 'x' }, { id: 'b', unidade_id: 'y' }, { id: 'c' }, { id: 'd', unidade_id: 'x', agente: 'Analista' }];
    const r = trocarUnidadeDasFases(fases, 'x', 'z');
    assert.equal(r.trocadas, 2);
    assert.deepEqual(r.fases.map((f) => f.unidade_id), ['z', 'y', undefined, 'z']);
    assert.equal(r.fases[3].agente, 'Analista');
    const sem = trocarUnidadeDasFases(fases, 'x', null).fases;
    assert.equal('unidade_id' in sem[0], false, 'sem sucessora a chave sai, como o sanitizeRito grava');
    assert.equal(sem[1].unidade_id, 'y');
    assert.deepEqual(trocarUnidadeDasFases(undefined, 'x', 'z'), { fases: [], trocadas: 0 });
});
