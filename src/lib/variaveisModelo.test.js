import test from 'node:test';
import assert from 'node:assert/strict';
import { chaveCampo, variaveisDoProcesso } from './camposProcesso.js';
import { variaveisDisponiveis } from './exigencias.js';

test('chaveCampo segue a regra do servidor', () => {
    assert.equal(chaveCampo('Nº do contrato'), 'n_do_contrato');
    assert.equal(chaveCampo('Prazo (30 dias)'), 'prazo_30_dias');
    assert.equal(chaveCampo(' Ação civil '), 'acao_civil');
});

test('variaveisDoProcesso: só o que as partes veem, registro pelo número e nunca restrito', () => {
    const p = {
        campos: [
            { id: 'a', rotulo: 'Valor da causa', tipo: 'numero', formato: 'moeda', valor: 1500, visivel_partes: true },
            { id: 'b', rotulo: 'Nota interna', tipo: 'texto', valor: 'segredo', visivel_partes: false },
            { id: 'c', rotulo: 'Consulta', tipo: 'registro', valor: '7/2026', visivel_partes: true, ref: { modulo: 'consultas', id: 'x', numero: '7/2026', titulo: 'Título interno' } },
            { id: 'd', rotulo: 'Expediente', tipo: 'registro', valor: '9/2026', visivel_partes: true, ref: { modulo: 'expedientes', id: 'y', numero: '9/2026', restrito: true } },
            { id: 'e', rotulo: 'Decisão', tipo: 'texto', valor: 'Do campo', visivel_partes: true },
        ],
        partes: [{ nome: 'Maria', polo: 'requerente' }, { nome: 'Ana', polo: 'requerente' }, { nome: 'Saiu', polo: 'requerido', retirada: { em: 'x' } }, { nome: 'Empresa', polo: 'requerido' }],
        origem: { tipo: 'consulta', descricao: 'interna', ref: { modulo: 'consultas', id: 'x', numero: '7/2026', titulo: 'Título interno' } },
    };
    const informacoes = [
        { rotulo: 'Decisão', valor_texto: 'Da ação', visivel_partes: true, seq: 1 },
        { rotulo: 'Parecer', valor_texto: 'Antigo', visivel_partes: true, seq: 1 },
        { rotulo: 'Parecer', valor_texto: 'Novo', visivel_partes: true, seq: 2 },
        { rotulo: 'Interno', valor_texto: 'não', visivel_partes: false, seq: 3 },
        { rotulo: 'Fechado', valor_texto: '3/2026', visivel_partes: true, restrito: true, seq: 4 },
    ];
    const v = variaveisDoProcesso(p, informacoes);
    assert.equal(v.valor_da_causa, 'R$ 1.500,00');
    assert.equal(v.nota_interna, undefined);
    assert.equal(v.consulta, '7/2026');
    assert.equal(v.expediente, undefined);
    assert.equal(v.decisao, 'Do campo');
    assert.equal(v.parecer, 'Novo');
    assert.equal(v.interno, undefined);
    assert.equal(v.fechado, undefined);
    assert.equal(v.partes_requerente, 'Maria; Ana');
    assert.equal(v.partes_requerido, 'Empresa');
    assert.equal(v.partes_terceiro, undefined);
    // A origem é interna: nem número, nem título, nem descrição.
    assert.equal(v.origem, undefined);
    assert.equal(v.origem_numero, undefined);
    assert.ok(!JSON.stringify(v).includes('Título interno') && !JSON.stringify(v).includes('segredo') && !JSON.stringify(v).includes('interna'));
});

test('variaveisDisponiveis: campos dos tipos e informações das ações, sem repetir nem as fixas', () => {
    const estado = {
        tipos: [{ formulario: { campos: [{ rotulo: 'Valor da causa' }, { rotulo: 'Assunto' }] } }, { formulario: { campos: [{ rotulo: 'Valor da Causa' }] } }],
        ritos: [{ fases: [{ acoes: ['Registrar parecer', 'Confirmar', 'Juntar'], acoes_regras: [{ pede: 'texto' }, null, { documento: true }] }, { acoes: ['X'], acoes_regras: [{ pede: 'lista', rotulo: 'Resultado' }] }] }],
    };
    assert.deepEqual(variaveisDisponiveis(estado, ['assunto']), [
        ['valor_da_causa', 'Valor da causa', 'Campos dos tipos'],
        ['registrar_parecer', 'Registrar parecer', 'Informações das ações'],
        ['resultado', 'Resultado', 'Informações das ações'],
    ]);
});
