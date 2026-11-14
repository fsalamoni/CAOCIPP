// Impressão interna: PDF de uso da equipe com o que fica fora dos autos.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../lib/shared/autos');

test('impressão interna: a seleção é limpa e não pode vir vazia', () => {
    assert.deepEqual(a.sanitizeSelecaoInterna({ registros: [3, 3, '4', -1, 2.5, 7], documentos: ['abc', 'abc', 'a/b', 42, ''], versoes: ['v1'] }),
        { registros: [3, 7], documentos: ['abc'], versoes: ['v1'] });
    assert.throws(() => a.sanitizeSelecaoInterna({}), /Marque ao menos um/);
    assert.throws(() => a.sanitizeSelecaoInterna({ registros: ['x'], documentos: ['../segredo'] }), /Marque ao menos um/);
    const muitos = Array.from({ length: 200 }, (_, i) => `d${i}`);
    assert.equal(a.sanitizeSelecaoInterna({ documentos: muitos }).documentos.length, a.MAX_DOCS_INTERNOS);
});

test('impressão interna: entram os registros que não são peça dos autos, menos os ocultos', () => {
    const r = (m) => a.registroInterno(m);
    assert.equal(r({ seq: 1, tipo: 'autuacao' }), false, 'ato dos autos sai no PDF dos autos');
    assert.equal(r({ seq: 2, tipo: 'juntada' }), false);
    assert.equal(r({ seq: 3, tipo: 'tramitacao', dados: { interno: true, fora_impressao: true } }), true, 'remessa que o rito deixou só no sistema');
    assert.equal(r({ seq: 4, tipo: 'atribuicao' }), true, 'quem assumiu o processo');
    assert.equal(r({ seq: 5, tipo: 'acao_fase', dados: { interno: true, fora_impressao: true } }), true, 'dado registrado como informação');
    assert.equal(r({ seq: 6, tipo: 'acao_fase', dados: { nos_autos: true } }), false, 'certidão nos autos é peça');
    assert.equal(r({ seq: 7, tipo: 'acao_fase', dados: { interno: true, fora_impressao: true, oculto: true } }), false, 'sem evento não sai em impressão nenhuma');
});

test('impressão interna: documento só entra se for minuta que a pessoa vê ou guardado fora dos autos', () => {
    assert.equal(a.documentoInterno({ status: 'minuta' }, true), true);
    assert.equal(a.documentoInterno({ status: 'minuta' }, false), false, 'minuta de outra unidade');
    assert.equal(a.documentoInterno({ status: 'controle' }, false), true, 'guardado: toda a equipe vê');
    assert.equal(a.documentoInterno({ status: 'juntado' }, true), false, 'peça dos autos tem o PDF dos autos');
});
