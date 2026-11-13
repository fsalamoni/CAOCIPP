// Ação do rito que pede um formulário (vários campos). Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const x = require('../lib/shared/exigencias');
const s = require('../lib/shared/secretaria');
const cp = require('../lib/shared/camposProcesso');
const { informacoesDoAndamento } = require('../lib/shared/informacoes');

const regra = (r, acao) => x.sanitizeRegras({ acoes_regras: [r] }, [acao]).acoes_regras[0];
const campo = (id, rotulo, extra = {}) => ({ id, rotulo, tipo: 'texto', obrigatorio: false, visivel_partes: false, ...extra });

test('sanitizeRegra guarda os campos do formulário, sem "exigir em" nem partes por campo', () => {
    const r = regra({ pede: 'formulario', rotulo: 'Audiência', campos: [
        campo('data', 'Data', { tipo: 'data', obrigatorio: true, exigir_em: ['f1'], visivel_partes: true }),
        campo('local', 'Local'),
    ] }, 'Marcar audiência');
    assert.equal(r.pede, 'formulario');
    assert.equal(r.campos.length, 2);
    assert.equal(r.campos[0].obrigatorio, true);
    assert.equal(r.campos[0].exigir_em, undefined);
    assert.equal(r.campos[0].visivel_partes, false);
    assert.equal(x.opcoesDaResposta(r), null);
});

test('formulário sem campo, com campos demais ou nomes repetidos é recusado', () => {
    assert.throws(() => regra({ pede: 'formulario', campos: [] }, 'A'), /crie ao menos um campo/);
    const muitos = Array.from({ length: x.MAX_CAMPOS_ACAO + 1 }, (_, i) => campo(`c${i}`, `C${i}`));
    assert.throws(() => regra({ pede: 'formulario', campos: muitos }, 'A'), /aceita até 10 campos/);
    assert.throws(() => regra({ pede: 'formulario', campos: [campo('a', 'X'), campo('b', 'x')] }, 'A'), /Na ação "A": Há dois campos chamados/);
    // "Assunto" é nome livre no formulário da ação (só o do tipo reserva os campos padrão).
    assert.equal(regra({ pede: 'formulario', campos: [campo('a', 'Assunto')] }, 'A').campos[0].rotulo, 'Assunto');
});

test('o rito limita os campos de formulário somados', () => {
    const dez = Array.from({ length: 10 }, (_, i) => campo(`c${i}`, `C${i}`));
    const fases = Array.from({ length: 21 }, (_, i) => ({ nome: `F${i}`, acoes: ['A'], acoes_regras: [{ pede: 'formulario', campos: dez }] }));
    assert.throws(() => s.sanitizeRito({ nome: 'R', fases }), /até 200 campos de formulário/);
    assert.equal(s.sanitizeRito({ nome: 'R', fases: fases.slice(0, 20) }).fases.length, 20);
});

test('dadoDoFormulario: texto "Campo: valor", registros e restrição', () => {
    const form = { campos: [campo('data', 'Data', { tipo: 'data' }), campo('ok', 'Confirmado', { tipo: 'sim_nao' }), campo('n', 'Obs')] };
    const valores = cp.validarCampos(form, { data: '2026-11-20', ok: 'sim' });
    const d = cp.dadoDoFormulario('Audiência', valores);
    assert.equal(d.tipo, 'formulario');
    assert.equal(d.valor_texto, 'Data: 20/11/2026; Confirmado: Sim');
    assert.equal(d.valor.length, 2);
    assert.equal('visivel_partes' in d.valor[0], false);
    assert.equal(d.restrito, false);
    const ref = { modulo: 'consultas', id: 'k1', numero: 'C-1', titulo: 'T', restrito: true };
    const comRef = cp.dadoDoFormulario('X', [{ id: 'r', rotulo: 'Consulta', tipo: 'registro', valor: 'C-1', ref, visivel_partes: false }]);
    assert.equal(comRef.restrito, true);
    assert.deepEqual(comRef.refs, [ref]);
    assert.equal(comRef.valor_texto, 'Consulta: C-1');
});

test('informações do andamento trazem os registros do formulário', () => {
    const ref = { modulo: 'juri', id: 'j1', numero: 'J-1' };
    const movs = [{ seq: 1, tipo: 'acao_fase', dados: { fase_id: 'f', acao_idx: 0, feita: true, rotulo: 'Sessão', tipo_valor: 'formulario',
        valor: [{ id: 'r', rotulo: 'Júri', tipo: 'registro', valor: 'J-1', ref }], valor_texto: 'Júri: J-1' } }];
    const [i] = informacoesDoAndamento(movs, [{ id: 'f', nome: 'F' }]);
    assert.equal(i.tipo, 'formulario');
    assert.deepEqual(i.refs, [ref]);
});
