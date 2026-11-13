// npm run test:lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abaInicial, ABAS_CONFIG } from './passosConfiguracao.js';
import { alvoDoEvento, combina, resumoDetalhes, rotuloAcao } from './historicoConfiguracao.js';

const u = (extra = {}) => ({ id: 'u1', nome: 'Secretaria', ativa: true, membros_uids: ['a'], ...extra });

test('abaInicial: primeiro passo pendente, Ritos quando completo, ?aba= válido vence', () => {
    assert.equal(abaInicial({}), 'unidades');
    assert.equal(abaInicial({ unidades: [u({ ativa: false })] }), 'unidades', 'unidade inativa não conta');
    assert.equal(abaInicial({ unidades: [u({ membros_uids: [] })] }), 'unidades', 'sem equipe');
    assert.equal(abaInicial({ unidades: [u()], ritos: [{ ativo: false }] }), 'ritos');
    assert.equal(abaInicial({ unidades: [u()], ritos: [{ ativo: true }] }), 'tipos');
    const pronto = { unidades: [u()], ritos: [{ ativo: true }], tipos: [{ ativo: true }] };
    assert.equal(abaInicial(pronto), 'ritos');
    assert.equal(abaInicial(pronto, 'preferencias'), 'preferencias');
    assert.equal(abaInicial({}, 'xyz'), 'unidades', 'valor desconhecido cai no pendente');
    for (const a of ['estrutura', 'unidades', 'tipos', 'ritos', 'documentos', 'calendario', 'historico', 'integracoes', 'lixeira']) assert.ok(ABAS_CONFIG.includes(a));
});

test('histórico: rótulo, busca sem acento e detalhes sem ids', () => {
    assert.equal(rotuloAcao('SECRETARIA_RITO_EXCLUIDO'), 'Rito excluído');
    assert.equal(rotuloAcao('SECRETARIA_NOVA_COISA'), 'nova coisa');
    const e = { action: 'SECRETARIA_UNIDADE_SALVA', user_name: 'Ana', details: { unidade_id: 'u1', nome: 'Gabinete', ativa: true } };
    assert.equal(resumoDetalhes(e.details), 'nome: Gabinete · ativa: sim');
    assert.ok(combina(e, 'unidade'));
    assert.ok(combina(e, 'gabinete'));
    assert.ok(!combina(e, 'rito'));
    assert.ok(combina({ action: 'SECRETARIA_CALENDARIO', details: {} }, 'calendario'), 'sem acento acha "Calendário"');
});

test('histórico: Abrir leva ao item que ainda existe', () => {
    const estado = {
        ritos: [{ id: 'r1', nome: 'Rito comum' }], tipos: [{ id: 't1', nome: 'Representação' }], unidades: [u()],
        modelos: [{ id: 'm1', nome: 'Despacho' }, { id: 'm2', nome: 'Ofício', unidade_id: 'u1' }, { id: 'm3', nome: 'Termo', orgao_id: 'o1' }],
        orgaos: [{ id: 'o1', nome: 'Promotoria' }],
    };
    assert.deepEqual(alvoDoEvento({ action: 'SECRETARIA_RITO_IMPLANTADO', details: { rito_id: 'r1', tipo_id: 't1' } }, estado), { aba: 'ritos', id: 'r1', nome: 'Rito comum', rotulo: 'Abrir Rito comum' });
    assert.deepEqual(alvoDoEvento({ action: 'SECRETARIA_TIPO_RESTAURADO', details: { id: 't1' } }, estado), { aba: 'tipos', id: 't1', nome: 'Representação', rotulo: 'Abrir Representação' });
    assert.deepEqual(alvoDoEvento({ action: 'SECRETARIA_VERSAO_RESTAURADA', details: { colecao: 'modelo', id: 'm1' } }, estado), { aba: 'documentos', id: 'm1', nome: 'Despacho', rotulo: 'Abrir Despacho' });
    assert.deepEqual(alvoDoEvento({ action: 'SECRETARIA_MODELO_SALVO', details: { modelo_id: 'm2', unidade_id: 'u1' } }, estado), { aba: 'unidades', id: 'u1', nome: 'Ofício', rotulo: 'Abrir a unidade Secretaria, dona do modelo Ofício' });
    assert.deepEqual(alvoDoEvento({ action: 'SECRETARIA_MODELO_SALVO', details: { modelo_id: 'm3' } }, estado), { aba: 'estrutura', id: null, nome: 'Termo', rotulo: 'Ir para Estrutura (Termo)' });
    assert.equal(alvoDoEvento({ action: 'SECRETARIA_RITO_EXCLUIDO', details: { rito_id: 'r9' } }, estado), null, 'excluído não abre');
    assert.equal(alvoDoEvento({ action: 'SECRETARIA_CALENDARIO', details: {} }, estado), null);
});
