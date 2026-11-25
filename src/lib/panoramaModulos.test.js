import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { linhaDoRegistro, registrosLigados, valorPeloTipo, COLUNA_REGISTRO } from './panoramaModulos.js';

// O servidor propõe as colunas com a mesma lógica: as duas cópias não podem divergir.
const servidor = createRequire(import.meta.url)('../../functions-v2/lib/shared/panoramaModulos.js');

const consulta = {
    id: 'c1', process_number: '00832.000.123/2026', consultant: 'Promotoria de Canoas',
    location: 'Canoas', entry_date: '2026-03-02', matter_category: 'Licitações', matter_subcategory: 'Dispensa',
    analysis_start_date: '2026-03-05', responsible_user_name: 'Ana', urgency_request: true,
};
const expediente = { id: 'e1', expediente_number: 'EXP-9', system: 'SIM', origin: 'PGJ', entry_date: '05/04/2026' };
const parceria = { id: 'p1', pgea: '01', partnership_type: 'Convênio', aditivo_count: 2, signature_date: '2026-01-10' };

test('linha do registro: tela e servidor dão o mesmo resultado', () => {
    for (const [m, d] of [['consultas', consulta], ['expedientes', expediente], ['parcerias', parceria]]) {
        for (const comFuncionalidade of [false, true]) {
            assert.deepEqual(
                linhaDoRegistro(m, d.id, d, comFuncionalidade),
                servidor.linhaDoRegistro(m, d.id, d, comFuncionalidade),
                `${m} ${comFuncionalidade}`
            );
        }
    }
    const l = linhaDoRegistro('consultas', 'c1', consulta, false);
    assert.equal(l[COLUNA_REGISTRO], 'consulta/c1');
    assert.equal(l['Situação'], 'Em Análise');
    assert.equal(l['Matéria'], 'Licitações / Dispensa');
});

test('valor convertido pelo tipo da coluna', () => {
    assert.equal(valorPeloTipo('2026-03-02', 'data'), '2026-03-02');
    assert.equal(valorPeloTipo('março', 'data'), null);
    assert.equal(valorPeloTipo('2', 'numero'), 2);
    assert.equal(valorPeloTipo('x', 'moeda'), null);
    assert.equal(valorPeloTipo('Sim', 'booleano'), true);
    assert.equal(valorPeloTipo('Não', 'booleano'), false);
    assert.equal(valorPeloTipo('', 'texto'), null);
    assert.equal(valorPeloTipo('Canoas', 'lista'), 'Canoas');
});

test('base ligada: uma linha por registro, achada pela origem da coluna', () => {
    const base = {
        fonte_modulos: ['parcerias', 'consultas'],
        columns: [
            { key: 'reg', label: 'Registro', origem: COLUNA_REGISTRO, type: 'texto' },
            { key: 'func', label: 'Funcionalidade', type: 'lista' },
            { key: 'ent', label: 'Entrada', type: 'data' },
            { key: 'urg', label: 'Urgente', type: 'booleano' },
        ],
    };
    const rs = registrosLigados(base, { consultas: [consulta], parcerias: [parceria], expedientes: [expediente] });
    assert.equal(rs.length, 2, 'expedientes não marcados ficam de fora');
    assert.deepEqual(rs.map((r) => r.id), ['consulta/c1', 'parceria/p1']);
    assert.deepEqual(rs[0].values, { reg: 'consulta/c1', func: 'Consulta', ent: '2026-03-02', urg: true });
    assert.equal(rs[1].values.urg, false);
    assert.equal(rs[0].vinculado, true);
    assert.equal(rs[0].origem_id, 'c1');
});
