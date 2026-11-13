import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reinserir } from './textosProntos.js';

test('reinserir: volta na posição, não duplica, posição fora da lista vai para o fim', () => {
    const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' };
    assert.deepEqual(reinserir([a, c], b, 1), [a, b, c]);
    assert.deepEqual(reinserir([a, b, c], b, 1), [a, b, c]);
    assert.deepEqual(reinserir([a], c, 5), [a, c]);
    assert.deepEqual(reinserir([], a, 0), [a]);
    assert.deepEqual(reinserir([a], b, -1), [b, a]);
});
