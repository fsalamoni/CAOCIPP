// Revisão: a minuta que muda de mãos guarda a redação anterior, e a fase pode
// ter o botão Finalizar (juntada em conjunto). Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');

const minuta = { autor_uid: 'ana', autor_nome: 'Ana', criado_em: '2026-11-01', sha256: 'aaa', titulo: 'Parecer', tipo: 'Parecer' };

test('minuta: quem corrige o próprio texto não gera versão; outra pessoa, sim', () => {
    assert.equal(s.versaoAnterior(minuta, 'ana', 'bbb'), null, 'a autora edita a própria redação');
    assert.equal(s.versaoAnterior(minuta, 'gab', 'aaa'), null, 'salvar sem mudar o texto não guarda nada');
    assert.deepEqual(s.versaoAnterior(minuta, 'gab', 'bbb'), { autor_uid: 'ana', autor_nome: 'Ana', de: '2026-11-01', sha256: 'aaa', titulo: 'Parecer', tipo: 'Parecer' });
});

test('minuta: a versão guardada é de quem escreveu por último, não de quem criou', () => {
    const revisada = { ...minuta, sha256: 'bbb', editado_por: 'gab', editado_por_nome: 'Gabinete', editado_em: '2026-11-05' };
    assert.equal(s.versaoAnterior(revisada, 'gab', 'ccc'), null, 'o revisor segue na própria redação');
    const v = s.versaoAnterior(revisada, 'ana', 'ccc');
    assert.deepEqual([v.autor_uid, v.autor_nome, v.de, v.sha256], ['gab', 'Gabinete', '2026-11-05', 'bbb']);
    assert.equal(s.versaoAnterior({ sha256: 'x' }, 'gab', 'y'), null, 'sem autor conhecido, nada a atribuir');
});

test('rito: o botão Finalizar da fase só passa quando marcado de verdade', () => {
    const fases = s.sanitizeRito({ nome: 'R', fases: [
        { id: 'a', nome: 'Análise', juntada_conjunta: 'sim' },
        { id: 'r', nome: 'Revisão', juntada_conjunta: true },
    ] }).fases;
    assert.equal(fases[0].juntada_conjunta, undefined);
    assert.equal(fases[1].juntada_conjunta, true);
});
