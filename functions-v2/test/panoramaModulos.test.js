// Panorama: erro "INTERNAL" na criação da base e panorama a partir das
// funcionalidades do órgão. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../lib/shared/panorama');
const m = require('../lib/shared/panoramaModulos');
const { lotes } = require('../lib/panorama/importar');

/** Caminhos com `undefined` (o Firestore recusa gravar). */
function indefinidos(obj, caminho = '') {
    if (obj === undefined) return [caminho];
    if (!obj || typeof obj !== 'object') return [];
    return Object.entries(obj).flatMap(([k, v]) => indefinidos(v, `${caminho}.${k}`));
}

test('base: coluna sem lista nem amostra não leva undefined ao Firestore', () => {
    const def = p.sanitizeBaseDef({
        nome: 'Consultas',
        columns: [
            { key: 'num', label: 'Nº', type: 'texto', role: 'identificador' },
            { key: 'mat', label: 'Matéria', type: 'lista', lista: ['A', 'B'] },
        ],
    });
    assert.deepEqual(indefinidos(def), []);
    assert.equal('lista' in def.columns[0], false);
    assert.deepEqual(def.columns[1].lista, ['A', 'B']);
});

test('lotes: fecha em 200 itens ou no tamanho, o que vier antes', () => {
    const pequenos = Array.from({ length: 450 }, () => 10);
    assert.deepEqual(lotes(pequenos, (x) => x).map((l) => l.length), [200, 200, 50]);
    const grandes = Array.from({ length: 10 }, () => 1_500_000);
    assert.deepEqual(lotes(grandes, (x) => x).map((l) => l.length), [2, 2, 2, 2, 2]);
    // Um item maior que o teto ainda vai, sozinho.
    assert.deepEqual(lotes([9_000_000, 1], (x) => x).map((l) => l.length), [1, 1]);
});

test('módulos: só os conhecidos, na ordem fixa, e nome legível', () => {
    assert.deepEqual(m.sanitizeModulos(['parcerias', 'x', 'consultas', 'consultas']), ['consultas', 'parcerias']);
    assert.deepEqual(m.sanitizeModulos('consultas'), []);
    assert.equal(m.nomeFonte(['consultas', 'expedientes']), 'Consultas + Expedientes');
});

test('dataIso: texto ISO, data brasileira, Timestamp e vazio', () => {
    assert.equal(m.dataIso('2026-03-04'), '2026-03-04');
    assert.equal(m.dataIso('4/3/2026'), '2026-03-04');
    assert.equal(m.dataIso({ toDate: () => new Date('2026-05-06T12:00:00Z') }), '2026-05-06');
    assert.equal(m.dataIso(null), '');
});

test('consulta vira linha com o registro como identificador e a situação do quadro', () => {
    const l = m.linhaDoRegistro('consultas', 'abc', {
        process_number: '00021.000.145/2026', consultant: 'PJ Caxias do Sul',
        matter_category: 'Cível', matter_subcategory: 'Família', matter_object: 'Paternidade',
        entry_date: '2026-01-10', analysis_start_date: '2026-01-12', responsible_user_name: 'Ana',
        aditivo_de: 'orig',
    }, false);
    assert.equal(l[m.COLUNA_REGISTRO], 'consulta/abc');
    assert.equal(l['Número PGEA'], '00021.000.145/2026');
    assert.equal(l['Situação'], 'Em Análise');
    assert.equal(l['Matéria'], 'Cível / Família');
    assert.equal(l['Aditivo'], 'Sim');
    assert.equal(m.COLUNA_FUNCIONALIDADE in l, false);
});

test('juntos: mesmos rótulos nos três módulos e a coluna Funcionalidade', () => {
    const c = m.linhaDoRegistro('consultas', '1', { process_number: '1' }, true);
    const e = m.linhaDoRegistro('expedientes', '2', { expediente_number: '2', object: 'X' }, true);
    const pa = m.linhaDoRegistro('parcerias', '3', { pgea: '3', subject: 'S', aditivo_count: 2 }, true);
    for (const l of [c, e, pa]) {
        for (const col of ['Número PGEA', 'Situação', 'Entrada', 'Objeto', 'Responsável', m.COLUNA_FUNCIONALIDADE]) {
            assert.ok(col in l, `${col} em ${l[m.COLUNA_FUNCIONALIDADE]}`);
        }
        assert.deepEqual(indefinidos(l), []);
    }
    assert.deepEqual([c, e, pa].map((l) => l[m.COLUNA_FUNCIONALIDADE]), ['Consulta', 'Expediente', 'Parceria']);
    assert.equal(e['Objeto'], 'X');
    assert.equal(pa['Situação'], 'Pendente');
    assert.equal(pa['Aditivos'], 2);
});
