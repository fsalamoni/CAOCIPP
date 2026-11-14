import test from 'node:test';
import assert from 'node:assert/strict';
import { alvosDaComunicacao, comunicacoesDaAcao, situacaoDaResposta, textoDosPolos } from './comunicacaoRito.js';
import { opcoesDaResposta, pedeDado, regraComPedido, remapearCondicoes, resumoDaAcao } from './exigencias.js';

const partes = [{ nome: 'A', polo: 'requerido' }, { nome: 'B', polo: 'requerente' }, { nome: 'C', polo: 'requerido', retirada: { em: 'x' } }];
const fase = {
    id: 'def', acoes: ['Citar', 'Aguardar defesa'],
    acoes_regras: [{ pede: 'comunicacao', comunicacao: { especie: 'citacao', polos: ['requerido'], dias: 10 } }, { pede: 'resposta', resposta: { de: 0 } }],
};
const com = (parte_idx, extra = {}) => ({ id: `c${parte_idx}`, parte_idx, parte_nome: partes[parte_idx].nome, fase_id: 'def', acao_idx: 0, status: 'ciente', ...extra });

test('comunicação do rito na tela: alvos, rodada e espera (igual ao servidor)', () => {
    assert.deepEqual(alvosDaComunicacao(fase.acoes_regras[0].comunicacao, partes), [0], 'só o polo pedido, sem a retirada');
    assert.equal(textoDosPolos(fase.acoes_regras[0].comunicacao), 'requerido');
    assert.equal(textoDosPolos({ especie: 'ciencia' }), 'todas as partes');
    assert.equal(comunicacoesDaAcao([com(0, { rodada_fim: true }), com(0, { status: 'sem_efeito' })], 'def', 0).length, 0);
    assert.equal(situacaoDaResposta(fase, 1, [com(0, { vence_em: '2026-11-20' })], '2026-11-20').valor, null, 'vence hoje: ainda pode responder');
    assert.equal(situacaoDaResposta(fase, 1, [com(0, { vence_em: '2026-11-19' })], '2026-11-20').valor, 'Sem manifestação');
    assert.equal(situacaoDaResposta(fase, 1, [com(0, { respondida_em: 'x' })], '2026-11-20').valor, 'Apresentada');
});

test('editor: comunicar e esperar não pedem dado, sem destino nem partes; a espera segue a comunicação ao reordenar', () => {
    const c = regraComPedido({ obrigatoria: true, destino: 'autos', partes: true, folha_dados: true, quem: 'gestor', prazo_dias: 3 }, 'comunicacao', 'Citar');
    assert.deepEqual(c, { pede: 'comunicacao', comunicacao: { especie: 'intimacao', dias: 0 }, obrigatoria: true, quem: 'gestor', prazo_dias: 3 });
    const e = regraComPedido({ quem: 'gestor', prazo_dias: 3 }, 'resposta', 'Aguardar');
    assert.deepEqual(e, { pede: 'resposta', resposta: { de: -1 } }, 'a espera se cumpre sozinha: sem quem cumpre nem prazo próprio');
    assert.equal(pedeDado(c) || pedeDado(e), false);
    assert.deepEqual(opcoesDaResposta(fase.acoes_regras[1]).map(([v]) => v), ['Apresentada', 'Parcial', 'Sem manifestação']);
    assert.match(resumoDaAcao(fase.acoes_regras[0]), /comunica requerido \(citação, prazo de resposta de 10 dias úteis\)/);
    // Uma ação nova entra antes das duas: a espera passa a apontar para o índice novo da comunicação.
    const r = remapearCondicoes(fase, [-1, 0, 1], [null, ...fase.acoes_regras]);
    assert.deepEqual(r.acoes_regras[2].resposta, { de: 1 });
    // A comunicação sai: a espera fica sem alvo (o editor e o servidor pedem para escolher).
    assert.deepEqual(remapearCondicoes(fase, [1], [fase.acoes_regras[1]]).acoes_regras[0].resposta, { de: -1 });
});
