// Dado da ação reservado a quem gere a unidade ("quem vê na equipe").
const test = require('node:test');
const assert = require('node:assert/strict');
const ex = require('../lib/shared/exigencias');
const inf = require('../lib/shared/informacoes');

const regras = (regra) => ex.sanitizeRegras({ acoes_regras: [regra] }, ['Registrar parecer interno']).acoes_regras[0];

test('reservar: só dado digitado, fora dos autos e do portal', () => {
    const r = regras({ pede: 'texto_longo', ve: 'gestor', partes: true, destino: 'informacao' });
    assert.equal(r.ve, 'gestor');
    assert.equal(r.partes, undefined);
    assert.equal(ex.partesVeem(r), false);
    assert.equal(regras({ pede: 'texto', ve: 'qualquer' }).ve, undefined);
    assert.throws(() => regras({ ve: 'gestor' }), /só texto, número, data ou formulário/);
    assert.throws(() => regras({ pede: 'lista', opcoes: ['a', 'b'], ve: 'gestor' }), /só texto, número, data ou formulário/);
    assert.throws(() => regras({ pede: 'registro', modulo: 'consultas', ve: 'gestor' }), /só texto/);
    assert.throws(() => regras({ pede: 'texto', ve: 'gestor', destino: 'autos' }), /fica nos autos/);
    assert.throws(() => regras({ pede: 'texto', ve: 'gestor', destino: 'consolidar' }), /fica nos autos/);
    assert.throws(() => regras({ pede: 'formulario', ve: 'gestor', campos: [{ rotulo: 'Consulta', tipo: 'registro', modulo: 'consultas' }] }), /registro de outro módulo/);
    assert.equal(regras({ pede: 'formulario', ve: 'gestor', campos: [{ rotulo: 'Nota', tipo: 'texto' }] }).ve, 'gestor');
});

test('quem vê: gestor da unidade onde foi registrado, quem registrou e a administração', () => {
    const movs = [
        { seq: 1, tipo: 'acao_fase', autor_uid: 'ana', autor_nome: 'Ana', em: 'x', dados: { fase_id: 'f1', acao_idx: 0, feita: true, rotulo: 'Parecer', tipo_valor: 'texto', valor: 'segredo', valor_texto: 'segredo', destino: 'evento', reservado: 'gestor', ve_unidade: 'u1' } },
        { seq: 2, tipo: 'acao_fase', autor_uid: 'ana', autor_nome: 'Ana', em: 'x', dados: { fase_id: 'f1', acao_idx: 1, feita: true, rotulo: 'Nº', tipo_valor: 'texto', valor: '12', valor_texto: '12', destino: 'evento' } },
    ];
    const [reservada, aberta] = inf.informacoesDoAndamento(movs, [{ id: 'f1', nome: 'Fase' }]);
    const bia = { uid: 'bia', isAdmin: false, gestorDe: [] };
    const oculta = inf.informacaoVisivel(reservada, bia);
    assert.equal(oculta.oculta, true);
    assert.equal(oculta.valor, null);
    assert.equal(oculta.valor_texto, '');
    assert.equal(inf.informacaoVisivel(aberta, bia), aberta);
    for (const quem of [{ uid: 'ana', isAdmin: false, gestorDe: [] }, { uid: 'gil', isAdmin: false, gestorDe: ['u1'] }, { uid: 'adm', isAdmin: true, gestorDe: [] }]) {
        assert.equal(inf.informacaoVisivel(reservada, quem).valor_texto, 'segredo');
        assert.equal(inf.semReservado(movs[0], quem).dados.valor, 'segredo');
    }
    // Gestor de outra unidade não vê.
    assert.equal(inf.informacaoVisivel(reservada, { uid: 'gil', isAdmin: false, gestorDe: ['u2'] }).oculta, true);
    const m = inf.semReservado(movs[0], bia);
    assert.equal(m.dados.valor, undefined);
    assert.equal(m.dados.valor_texto, undefined);
    assert.equal(m.dados.oculta, true);
    assert.equal(inf.semReservado(movs[1], bia), movs[1]);
    // As partes nunca: o portal só lê o que é visível às partes.
    assert.equal(inf.informacoesDoAndamento(movs, [], true).length, 0);
});
