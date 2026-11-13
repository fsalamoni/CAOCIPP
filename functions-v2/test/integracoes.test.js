// Integração com os outros módulos do órgão: módulos ativos, integrações que
// valem, número e título do registro, campo e ação "registro".
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const m = require('../lib/shared/modulos');
const c = require('../lib/shared/camposProcesso');
const ex = require('../lib/shared/exigencias');

test('modulosAtivos: mesma regra das abas do órgão', () => {
    // Órgão antigo, sem moduleConfig: tudo ligado; Júri só com a flag da plataforma.
    assert.deepEqual(m.modulosAtivos({}, {}), { consultas: true, expedientes: true, parcerias: true, juri: false });
    assert.equal(m.modulosAtivos({}, { jurimetria_enabled: true }).juri, true);
    assert.equal(m.modulosAtivos({}, { parcerias_enabled: false }).parcerias, false);
    const org = { moduleConfig: { processes: { enabled: true }, expedientes: { enabled: false }, jurimetria: { enabled: true } } };
    assert.deepEqual(m.modulosAtivos(org, { jurimetria_enabled: true }), { consultas: true, expedientes: false, parcerias: false, juri: true });
    // Páginas personalizadas desligadas na plataforma: o moduleConfig não vale.
    assert.equal(m.modulosAtivos(org, { custom_entities: false }).expedientes, true);
});

test('integracoesDe: só o que o admin ligou e o órgão tem ativo', () => {
    const org = { moduleConfig: { processes: { enabled: true } }, secretariaConfig: { integracoes: { consultas: true, expedientes: true, juri: 'sim' } } };
    assert.deepEqual(m.integracoesGravadas(org), { consultas: true, expedientes: true, parcerias: false, juri: false });
    assert.deepEqual(m.integracoesDe(org, {}), { consultas: true, expedientes: false, parcerias: false, juri: false });
});

test('refDe: só número e título; acesso restrito marcado', () => {
    const r = m.refDe('consultas', 'p1', { process_number: '00123/2026', matter_object: 'Licitação', consultant: 'Prefeitura X', access_restriction: 'Sim', status: 'aberto' });
    assert.deepEqual(r, { modulo: 'consultas', id: 'p1', numero: '00123/2026', titulo: 'Licitação', restrito: true });
    assert.equal(JSON.stringify(m.refDe('juri', 'j', { numero_processo: '5000', comarca: 'Pelotas', promotor: 'Dr. Y' })).includes('Dr. Y'), false);
    assert.equal(m.refDe('parcerias', 'x', { PGEA: '77', subject: 'Convênio' }).numero, '77');
    assert.equal(m.refDe('expedientes', 'e', {}).numero, 'sem número');
    assert.equal(m.idEscolhido({ id: ' abc ', numero: 'forjado' }), 'abc');
});

test('campo registro: exige módulo, guarda a referência lida pelo servidor', () => {
    assert.throws(() => c.sanitizeFormulario({ campos: [{ rotulo: 'Consulta', tipo: 'registro' }] }), /de que módulo/);
    const f = c.sanitizeFormulario({ campos: [{ id: 'cons', rotulo: 'Consulta de origem', tipo: 'registro', modulo: 'consultas', visivel_partes: true, obrigatorio: true }] });
    assert.equal(f.campos[0].modulo, 'consultas');
    assert.throws(() => c.validarCampos(f, {}), /Escolha "Consulta de origem"/);
    // Sem a leitura do servidor (ou de outro órgão), não vale, mesmo com número mandado pelo cliente.
    assert.throws(() => c.validarCampos(f, { cons: { id: 'p1', numero: 'forjado' } }), /registro não encontrado em Consultas/);
    const ref = { modulo: 'consultas', id: 'p1', numero: '00123/2026', titulo: 'Licitação' };
    const [v] = c.validarCampos(f, { cons: { id: 'p1', numero: 'forjado' } }, [], new Map([['cons', ref]]));
    assert.equal(v.valor, '00123/2026');
    assert.deepEqual(v.ref, ref);
    assert.equal(v.visivel_partes, true);
    assert.equal(c.valorTexto(v), '00123/2026 (Licitação)');
    // Origem restrita: as partes não veem, mesmo com o campo marcado para elas.
    const [r] = c.validarCampos(f, { cons: 'p1' }, [], new Map([['cons', { ...ref, restrito: true }]]));
    assert.equal(r.visivel_partes, false);
    // Correção: o mesmo id volta como estava, sem nova leitura.
    const [k] = c.validarCampos(f, { cons: 'p1' }, [r]);
    assert.equal(k.valor, '00123/2026');
    assert.equal(k.visivel_partes, false);
});

test('revisão: integração desligada só pesa no registro que muda; troca de registro de mesmo número aparece', () => {
    const f = c.sanitizeFormulario({ campos: [{ id: 'cons', rotulo: 'Consulta', tipo: 'registro', modulo: 'consultas' }] });
    assert.throws(() => c.validarCampos(f, { cons: 'p2' }, [], new Map([['cons', 'desligada']])), /integração com Consultas está desligada/);
    // Campo que era texto e virou registro: o valor antigo volta igual e fica, sem ler nada.
    const antigo = [{ id: 'cons', rotulo: 'Consulta', tipo: 'texto', valor: 'abc', visivel_partes: false }];
    assert.equal(c.validarCampos(f, { cons: 'abc' }, antigo, new Map([['cons', 'desligada']]))[0].valor, 'abc');
    const a = { id: 'cons', rotulo: 'Consulta', tipo: 'registro', valor: 'sem número', visivel_partes: false, ref: { modulo: 'consultas', id: 'p1', numero: 'sem número' } };
    const b = { ...a, ref: { ...a.ref, id: 'p2' } };
    assert.match(c.diferencasCampos([a], [b])[0], /outro registro com o mesmo número/);
    assert.deepEqual(c.diferencasCampos([a], [a]), []);
});

test('ação que pede registro: exige o módulo', () => {
    assert.throws(() => ex.sanitizeRegras({ acoes_regras: [{ pede: 'registro' }] }, ['Vincular consulta']), /de que módulo/);
    const r = ex.sanitizeRegras({ acoes_regras: [{ pede: 'registro', modulo: 'expedientes', rotulo: 'Expediente', opcoes: ['x', 'y'] }] }, ['Vincular']);
    assert.deepEqual(r.acoes_regras, [{ pede: 'registro', rotulo: 'Expediente', modulo: 'expedientes' }]);
    assert.equal(ex.pedidoDaAcao(r.acoes_regras[0]), 'registro');
});
