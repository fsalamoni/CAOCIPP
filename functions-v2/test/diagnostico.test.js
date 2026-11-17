// Diagnóstico: rotinas agendadas e erros das Functions. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROTINAS, situacaoRotina } = require('../lib/shared/rotinas');
const { agruparErros } = require('../lib/platform/diagnostico');

test('situação da rotina: sem registro, ok, atrasada, erro', () => {
    const agora = Date.parse('2026-11-17T12:00:00Z');
    assert.equal(situacaoRotina(undefined, 24, agora), 'sem_registro');
    assert.equal(situacaoRotina({ ultima: { em: '2026-11-17T07:00:00Z', status: 'ok' } }, 24, agora), 'ok');
    assert.equal(situacaoRotina({ ultima: { em: '2026-11-14T07:00:00Z', status: 'ok' } }, 24, agora), 'atrasada');
    assert.equal(situacaoRotina({ ultima: { em: '2026-11-17T07:00:00Z', status: 'erro' } }, 24, agora), 'erro');
});

test('erros: só funções do SIGO, agrupados e com a mensagem mais nova', () => {
    const e = (svc, ts, msg) => ({ resource: { labels: { service_name: svc } }, timestamp: ts, textPayload: msg });
    const g = agruparErros([
        e('platformuser', '2026-11-17T10:00:00Z', 'velho'),
        e('platformuser', '2026-11-17T11:00:00Z', 'novo'),
        e('outroapp', '2026-11-17T11:00:00Z', 'não é do SIGO'),
        e('createorganization', '2026-11-17T09:00:00Z', 'x'),
    ], new Set(['platformuser', 'createorganization']));
    assert.deepEqual(g.map((x) => [x.funcao, x.quantidade, x.ultima_mensagem]), [['platformuser', 2, 'novo'], ['createorganization', 1, 'x']]);
});

test('toda rotina agendada passa por comRegistro e está no catálogo', () => {
    const raiz = path.join(__dirname, '..', 'src');
    const achadas = [];
    const varrer = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((ent) => {
        const p = path.join(d, ent.name);
        if (ent.isDirectory()) return varrer(p);
        if (!p.endsWith('.ts')) return;
        const s = fs.readFileSync(p, 'utf8');
        for (const m of s.matchAll(/export const (\w+) = onSchedule\(/g)) {
            const depois = s.slice(m.index, m.index + 600);
            assert.match(depois, new RegExp(`comRegistro\\('${m[1]}'`), `${m[1]} sem comRegistro`);
            achadas.push(m[1]);
        }
    });
    varrer(raiz);
    assert.deepEqual(achadas.sort(), Object.keys(ROTINAS).sort());
});
