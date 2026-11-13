// Páginas próprias (customRecords) como módulo integrável ao Processo Eletrônico.
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../lib/shared/modulos');
const c = require('../lib/shared/camposProcesso');
const ex = require('../lib/shared/exigencias');

const tipo = { label_singular: 'Atendimento', fields: [{ key: 'qtd', type: 'number' }, { key: 'vazio', type: 'text' }, { key: 'nome', type: 'text' }] };

test('páginas próprias: ativas só com a flag da plataforma', () => {
    assert.equal(m.modulosAtivos({}, {}).paginas, false);
    assert.equal(m.modulosAtivos({ moduleConfig: {} }, { custom_entities: true }).paginas, true);
});

test('referência: primeiro texto preenchido na ordem do tipo, nome do tipo e página', () => {
    const r = m.refDePagina('abcdef123', { entity_type_id: 'tp1', values: { qtd: 3, vazio: '  ', nome: ' Maria ' } }, tipo);
    assert.deepEqual(r, { modulo: 'paginas', id: 'abcdef123', numero: 'Maria', titulo: 'Atendimento', pagina: 'tp1' });
    assert.equal(m.refDePagina('abcdef123', { entity_type_id: 'tp1', values: {} }, tipo).numero, '#abcdef');
    assert.equal(m.ehInterno(r), true);
    assert.equal(m.ehInterno({ modulo: 'consultas' }), false);
});

test('fechadas: página própria nunca chega às partes, sem ler o banco', async () => {
    const db = { getAll: () => { throw new Error('não devia ler'); } };
    const f = await m.refsFechadas(db, 'org', [{ modulo: 'paginas', id: 'r1', numero: 'x' }]);
    assert.deepEqual([...f], ['paginas:r1']);
});

test('campo e ação de página própria exigem qual página; o campo nunca fica visível às partes', () => {
    const base = { rotulo: 'Atendimento', tipo: 'registro', modulo: 'paginas', visivel_partes: true };
    assert.throws(() => c.sanitizeCampos([base]), /de qual página própria/);
    const [campo] = c.sanitizeCampos([{ ...base, pagina: 'tp1' }]);
    assert.equal(campo.pagina, 'tp1');
    assert.equal(campo.visivel_partes, false);
    const ref = { modulo: 'paginas', id: 'r1', numero: 'Maria', pagina: 'tp1' };
    const [v] = c.validarCampos({ campos: [campo] }, { [campo.id]: 'r1' }, [], new Map([[campo.id, ref]]));
    assert.equal(v.visivel_partes, false);
    // Registro de outra página não serve.
    assert.throws(() => c.validarCampos({ campos: [campo] }, { [campo.id]: 'r1' }, [], new Map([[campo.id, { ...ref, pagina: 'tp2' }]])), /não encontrado/);
    const regras = (regra) => ex.sanitizeRegras({ acoes_regras: [regra] }, ['Ligar atendimento']);
    assert.throws(() => regras({ pede: 'registro', modulo: 'paginas' }), /de qual página própria/);
    assert.equal(regras({ pede: 'registro', modulo: 'paginas', pagina: 'tp1' }).acoes_regras[0].pagina, 'tp1');
});
