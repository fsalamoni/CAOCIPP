import test from 'node:test';
import assert from 'node:assert/strict';
import { bibliotecaDeModelos } from './bibliotecaRitos.js';
import { usaRecurso } from './bibliotecaFiltro.js';
import { ETAPAS, RECEITAS, TEMAS, PERGUNTAS_MODELO, buscarReceitas, sugerirModelos } from './tutorialRito.js';

const MODELOS = bibliotecaDeModelos();
const ids = new Set(MODELOS.map((m) => m.id));
const PARTES_DO_GUIA = 22;
const perguntas = ETAPAS.flatMap((e) => e.perguntas);

test('toda etapa tem objetivo, passos, perguntas e o que conferir', () => {
    assert.ok(ETAPAS.length >= 10);
    assert.equal(new Set(ETAPAS.map((e) => e.id)).size, ETAPAS.length);
    for (const e of ETAPAS) {
        assert.ok(e.titulo && e.objetivo, e.id);
        assert.ok(e.passos.length >= 3, e.id);
        assert.ok(e.perguntas.length >= 2, e.id);
        assert.ok(e.conferir.length >= 1, e.id);
    }
});

test('toda parte citada existe no Guia do rito e todo modelo citado existe na biblioteca', () => {
    for (const x of [...perguntas, ...RECEITAS]) {
        if (x.parte !== undefined) assert.ok(Number.isInteger(x.parte) && x.parte >= 1 && x.parte <= PARTES_DO_GUIA, JSON.stringify(x));
        for (const m of x.modelos || []) assert.ok(ids.has(m), `modelo ${m}`);
    }
});

test('toda receita tem tema conhecido e todos os temas têm receita', () => {
    const temas = new Set(TEMAS.map(([t]) => t));
    for (const r of RECEITAS) assert.ok(temas.has(r.tema) && r.quero && r.use && r.onde, r.quero);
    for (const t of temas) assert.ok(RECEITAS.some((r) => r.tema === t), t);
});

test('os textos não usam travessão', () => {
    const texto = JSON.stringify([ETAPAS, RECEITAS, PERGUNTAS_MODELO]);
    assert.ok(!texto.includes('—'));
});

test('buscarReceitas ignora acento e exige todos os termos', () => {
    assert.ok(buscarReceitas('audiencia').some((r) => /audiência/i.test(r.quero)));
    assert.ok(buscarReceitas('sigilo restrito').length >= 1);
    assert.equal(buscarReceitas('xyzinexistente').length, 0);
    assert.ok(buscarReceitas('', 'colegiado').every((r) => r.tema === 'colegiado'));
    assert.equal(buscarReceitas('').length, RECEITAS.length);
});

test('sugerirModelos respeita as respostas', () => {
    const col = sugerirModelos(MODELOS, { recurso: 'julgamento', area: 'etica' }, 50);
    assert.ok(col.total > 0 && col.soltos.length === 0);
    assert.ok(col.modelos.every((m) => m.area === 'etica' && usaRecurso(m, 'julgamento')));

    const compra = sugerirModelos(MODELOS, { recurso: 'disputa' }, 50).modelos.map((m) => m.id);
    assert.ok(compra.includes('compra-privada') && compra.includes('contratacao-direta'));

    const mono = sugerirModelos(MODELOS, { recurso: 'monocratica', defesa: 'nao' }, 50);
    assert.ok(mono.total > 0 && mono.soltos.length === 0);
    assert.ok(mono.modelos.every((m) => !usaRecurso(m, 'julgamento') && !usaRecurso(m, 'resposta')));

    const defesa = sugerirModelos(MODELOS, { defesa: 'sim', area: 'correcional' }, 50).modelos;
    assert.ok(defesa.length && defesa.every((m) => usaRecurso(m, 'resposta') && m.area === 'correcional'));

    // Âmbito: os do próprio órgão vêm primeiro, depois os de norma geral; nunca os de outro âmbito.
    const mprs = sugerirModelos(MODELOS, { ambito: 'mprs', area: 'parcerias' }, 50).modelos;
    assert.deepEqual(mprs.map((m) => m.id).sort(), ['parceria-acompanhamento-mprs', 'parceria-formalizacao-mprs']);
    const rs = sugerirModelos(MODELOS, { ambito: 'estadual_rs' }, 100).modelos;
    assert.ok(rs[0].ambito === 'estadual_rs' && rs.every((m) => ['estadual_rs', 'nacional'].includes(m.ambito)));

    const curtos = sugerirModelos(MODELOS, { porte: 'curto' }, 50).modelos;
    assert.ok(curtos.length && curtos.every((m) => m.porte === 'curto'));
});

test('sugerirModelos solta o tamanho antes de mostrar lista vazia, e diz o que soltou', () => {
    // Não há modelo curto de disputa de preços: o tamanho é solto.
    const r = sugerirModelos(MODELOS, { recurso: 'disputa', porte: 'curto' });
    assert.ok(r.total > 0);
    assert.deepEqual(r.soltos, ['o tamanho']);
    assert.ok(r.modelos.every((m) => usaRecurso(m, 'disputa')));
});

test('sem respostas, sugere a biblioteca inteira, do mais curto ao mais longo, até o limite', () => {
    const r = sugerirModelos(MODELOS, {}, 6);
    assert.equal(r.total, MODELOS.length);
    assert.equal(r.modelos.length, 6);
    assert.ok(r.modelos.every((m) => m.porte === 'curto'));
});
