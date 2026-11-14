const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeFormulario, formularioDe, nomeDoPolo, retificarPartes } = require('../lib/shared/camposProcesso');
const { secoesDaFolha } = require('../lib/shared/folhaDados');

test('tipo: nomes dos polos saneados; repetidos recusados', () => {
    const f = sanitizeFormulario({ nomes_polos: { requerente: '  Denunciante ', requerido: 'Acusado', juiz: 'X', terceiro: '' }, campos: [] });
    assert.deepEqual(f.nomes_polos, { requerente: 'Denunciante', requerido: 'Acusado' });
    assert.deepEqual(sanitizeFormulario({ polos: ['requerido'], nomes_polos: { requerente: 'Denunciante', requerido: 'Acusado' } }).nomes_polos, { requerido: 'Acusado' });
    assert.deepEqual(formularioDe({}).nomes_polos, {});
    assert.throws(() => sanitizeFormulario({ nomes_polos: { requerente: 'Parte', requerido: 'parte' } }), /mesmo nome/);
    // Polo desmarcado não conta na comparação.
    assert.doesNotThrow(() => sanitizeFormulario({ polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Parte', requerido: 'parte' } }));
});

test('nome do polo nas certidões de retificação', () => {
    assert.equal(nomeDoPolo({ requerido: 'Acusado' }, 'requerido'), 'Acusado');
    assert.equal(nomeDoPolo(undefined, 'requerido'), 'requerido');
    const r = retificarPartes([{ nome: 'Maria', polo: 'requerido' }], [{ nome: 'Maria', polo: 'requerido', existente: true, idx: 0 }, { nome: 'Ana', polo: 'requerente' }],
        ['requerente', 'requerido'], 10, { em: 'x', por: 'y' }, { requerente: 'Denunciante' });
    assert.ok(r.mudou.includes('Parte incluída: Ana (Denunciante)'), JSON.stringify(r.mudou));
});

test('capa impressa usa o nome do polo', () => {
    const p = { numero: '1/2026', assunto: 'A', partes: [{ nome: 'Maria', polo: 'requerido' }], nomes_polos: { requerido: 'Acusado' } };
    const txt = JSON.stringify(secoesDaFolha({ proc: p, equipe: true, campos: [], informacoes: [] }));
    assert.match(txt, /Acusado: Maria/);
});
