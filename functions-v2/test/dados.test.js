// Cópias e exportação: conversão para JSON e catálogo de coleções. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Timestamp, GeoPoint } = require('firebase-admin/firestore');
const { paraJson, COLECOES_ORGAO } = require('../lib/platform/dados');

test('valores do Firestore viram JSON simples', () => {
    const r = paraJson({
        em: Timestamp.fromDate(new Date('2026-11-17T10:00:00Z')),
        lugar: new GeoPoint(-30, -51),
        bin: Buffer.from('oi'),
        lista: [Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')), 1, null],
        n: { a: undefined, b: 'x' },
    });
    assert.deepEqual(JSON.parse(JSON.stringify(r)), {
        em: '2026-11-17T10:00:00.000Z', lugar: { lat: -30, lng: -51 }, bin: { base64: 'b2k=' },
        lista: ['2026-01-01T00:00:00.000Z', 1, null], n: { a: null, b: 'x' },
    });
});

test('exportação cobre toda coleção do órgão que a exclusão conhece (menos as transitórias)', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'organizations', 'delete.ts'), 'utf8');
    const bloco = src.slice(src.indexOf('const ORG_SCOPED_COLLECTIONS = ['), src.indexOf('];', src.indexOf('const ORG_SCOPED_COLLECTIONS = [')));
    const nomes = [...bloco.matchAll(/^\s*'(\w+)',/gm)].map((m) => m[1]).filter((n) => !['presence', 'notifications'].includes(n));
    assert.ok(nomes.length >= 10);
    for (const n of nomes) assert.ok(COLECOES_ORGAO.includes(n), `${n} fora da exportação`);
});
