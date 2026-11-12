// Onde ficam prazo, pendência, urgência, dados e atribuição durante a fase. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const x = require('../lib/shared/exigencias');

test('padrão: como era antes (sem marcas)', () => {
    const f = { id: 'f' };
    for (const a of x.OUTROS_ATOS) assert.deepEqual(x.marcasDoAto(f, a), {}, a);
    assert.equal(x.destinoDoAto(f, 'prazo'), 'autos');
    assert.equal(x.destinoDoAto(f, 'atribuicao'), 'evento');
    assert.equal(x.destinoDoAto(undefined, 'dados'), 'autos');
});

test('o rito escolhe; valor estranho lê como o padrão', () => {
    const f = { id: 'f', registro_atos: { outros: { prazo: 'evento', pendencia: 'nenhum', urgencia: 'qualquer', atribuicao: 'autos', dados: 'informacao' } } };
    assert.deepEqual(x.marcasDoAto(f, 'prazo'), { interno: true });
    assert.deepEqual(x.marcasDoAto(f, 'pendencia'), { interno: true, fora_impressao: true, oculto: true, visivel_partes: false });
    assert.deepEqual(x.marcasDoAto(f, 'urgencia'), {});
    assert.equal(x.destinoDoAto(f, 'atribuicao'), 'evento', 'atribuição nunca vira termo nos autos');
    assert.deepEqual(x.marcasDoAto(f, 'dados'), { interno: true, fora_impressao: true });
});

test('saneamento guarda só o que difere do padrão e mantém fase e remessas', () => {
    const r = x.sanitizeRegras({ registro_atos: { fase: 'evento', outros: { prazo: 'autos', pendencia: 'evento', atribuicao: 'autos', dados: 'x', urgencia: 'nenhum', outro: 'nenhum' } } }, []);
    assert.deepEqual(r.registro_atos, { fase: 'evento', outros: { pendencia: 'evento', urgencia: 'nenhum' } });
    const s = x.sanitizeRegras({ registro_atos: { outros: { atribuicao: 'nenhum' } } }, []);
    assert.deepEqual(s.registro_atos, { outros: { atribuicao: 'nenhum' } });
    assert.equal(x.sanitizeRegras({ registro_atos: { outros: { prazo: 'autos' } } }, []).registro_atos, undefined);
});
