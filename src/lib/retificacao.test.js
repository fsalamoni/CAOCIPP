import test from 'node:test';
import assert from 'node:assert/strict';
import { faltando, partesParaCorrecao, pedidoDeCorrecao } from './camposProcesso.js';

const form = { assunto: 'obrigatorio', descricao: 'opcional', origem: 'opcional', partes: 'obrigatorio', sigilo: 'opcional', campos: [] };
const p = {
    assunto: 'Pedido', sigilo: 'normal', origem: { tipo: 'oficio', descricao: 'Of. 1', ref: { modulo: 'consultas', id: 'c1' } },
    partes: [{ nome: 'Fulano', documento: '1', polo: 'requerente', portal: 'ativo' }, { nome: 'Velho', polo: 'requerido', retirada: { em: 'x', por: 'y' } }],
};
const f0 = () => ({ assunto: p.assunto, sigilo: p.sigilo, origem: { tipo: 'oficio', descricao: 'Of. 1', ref: p.origem.ref }, partes: partesParaCorrecao(p.partes) });

test('sem mudança na autuação: só descrição e campos, sem motivo', () => {
    const r = pedidoDeCorrecao(p, f0(), form);
    assert.deepEqual(r, { pedido: {}, retifica: false });
});

test('manda só o que mudou, e as partes inteiras na mesma ordem', () => {
    const f = f0();
    f.assunto = ' Pedido novo ';
    f.partes[0].retirada = true;
    f.partes.push({ nome: 'Nova', documento: '', email: '', polo: 'requerido' }, { nome: '', polo: 'requerido' });
    const r = pedidoDeCorrecao(p, f, form);
    assert.equal(r.retifica, true);
    assert.equal(r.pedido.assunto, 'Pedido novo');
    assert.equal(r.pedido.sigilo, undefined);
    assert.equal(r.pedido.origem, undefined, 'origem igual não vai (a ligação nunca vai)');
    assert.equal(r.pedido.partes.length, 4);
    assert.equal(r.pedido.partes[0].retirada, true);
    assert.equal(r.pedido.partes[1].retirada, undefined, 'parte já retirada não é pedida de novo');
    assert.equal(r.pedido.partes[0].portal, undefined, 'só nome, documento, e-mail e polo');
});

test('linha nova em branco não conta como mudança; retirada não conta como parte', () => {
    const f = f0();
    f.partes.push({ nome: '  ', polo: 'requerido' });
    assert.equal(pedidoDeCorrecao(p, f, form).retifica, false);
    const g = f0();
    g.partes[0].retirada = true;
    assert.match(faltando(form, g).join(), /ao menos um item/);
    assert.equal(partesParaCorrecao(p.partes)[1].ja_retirada, true);
});
