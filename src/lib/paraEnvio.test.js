import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paraEnvio } from './paraEnvio.js';

test('atributos sem protótipo (como os do editor) viram objetos comuns', () => {
    const attrs = Object.assign(Object.create(null), { textAlign: null, layout: Object.assign(Object.create(null), { papel: 'A4' }) });
    const doc = { type: 'doc', attrs, content: [{ type: 'paragraph', attrs: Object.assign(Object.create(null), { recuo: 1.25 }) }] };
    const r = paraEnvio(doc);
    assert.equal(Object.getPrototypeOf(r.attrs), Object.prototype);
    assert.equal(Object.getPrototypeOf(r.attrs.layout), Object.prototype);
    assert.equal(typeof r.content[0].attrs.hasOwnProperty, 'function');
    assert.deepEqual(JSON.parse(JSON.stringify(r)), JSON.parse(JSON.stringify(doc)));
});

test('valores que não são objetos simples seguem como estão', () => {
    const data = new Date(0);
    const r = paraEnvio({ data, n: 1, s: 'x', nada: null, indef: undefined });
    assert.equal(r.data, data);
    assert.equal('indef' in r, true);
    assert.equal(r.nada, null);
});
