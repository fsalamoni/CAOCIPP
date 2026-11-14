// Rodar: npm run test:lib
import test from 'node:test';
import assert from 'node:assert/strict';
import { alguemTem, atorNoProcesso, atribuicoesDoOrgao, comPermissao, podeQuem, podeReserva, resumoPermissoes, rotuloQuem } from './permissoesFase.js';

const unidades = [
    { id: 'gab', lotacoes: [{ uid: 'ana', atribuicao: 'Promotor de Justiça', gestor: true }, { uid: 'bob', atribuicao: 'Assessor' }] },
    { id: 'sec', lotacoes: [{ uid: 'bob', atribuicao: ' assessor ' }, { uid: 'cai', atribuicao: '' }] },
];

test('quem a pessoa é na unidade que tem o processo', () => {
    const estado = { uid: 'bob', isAdmin: false, gestorDe: ['sec'], unidades };
    assert.deepEqual(atorNoProcesso(estado, { unidade_atual: 'gab', responsavel_uid: 'bob' }), { isAdmin: false, gestor: false, responsavel: true, atribuicao: 'Assessor' });
    assert.deepEqual(atorNoProcesso(estado, { unidade_atual: 'sec', responsavel_uid: null }), { isAdmin: false, gestor: true, responsavel: false, atribuicao: ' assessor ' });
    assert.deepEqual(atorNoProcesso({ uid: 'zed', unidades }, { unidade_atual: 'gab' }), { isAdmin: false, gestor: false, responsavel: false, atribuicao: '' });
});

test('a tela segue a mesma regra do servidor', () => {
    const a = (x) => ({ isAdmin: false, gestor: false, responsavel: false, atribuicao: '', ...x });
    assert.equal(podeQuem(undefined, undefined, a()), true);
    assert.equal(podeQuem('atribuicao', 'Promotor de Justiça', a({ atribuicao: 'promotor  de justica' })), true);
    assert.equal(podeQuem('atribuicao', 'Promotor', a({ gestor: true, atribuicao: 'Assessor' })), false);
    assert.equal(podeQuem('gestor', undefined, a({ isAdmin: true })), true);
    assert.equal(podeReserva('admin', a({ gestor: true })), false);
    assert.equal(podeReserva('gestor', a({ gestor: true })), true);
    assert.equal(rotuloQuem('responsavel'), 'só o responsável');
    assert.equal(rotuloQuem('atribuicao', 'Promotor'), 'só quem tem a atribuição "Promotor"');
});

test('editor: trocar um pedaço das permissões, sem deixar sobra', () => {
    assert.equal(comPermissao(undefined, { concluir: undefined }), undefined);
    assert.deepEqual(comPermissao(undefined, { concluir: 'atribuicao', concluir_atribuicao: '' }), { concluir: 'atribuicao', concluir_atribuicao: '' }, 'a atribuição vazia fica enquanto se digita');
    assert.deepEqual(comPermissao({ concluir: 'atribuicao', concluir_atribuicao: 'Promotor', dispensar: 'gestor' }, { concluir: 'gestor' }), { concluir: 'gestor', dispensar: 'gestor' });
    assert.equal(comPermissao({ situacao: 'admin' }, { situacao: '' }), undefined);
});

test('resumo do que a fase reserva e sugestões de atribuição', () => {
    assert.deepEqual(resumoPermissoes(undefined), []);
    assert.deepEqual(resumoPermissoes({ concluir: 'atribuicao', concluir_atribuicao: 'Promotor', dispensar: 'gestor', desviar: 'admin', situacao: 'gestor' }), [
        'só quem tem a atribuição "Promotor" conclui a fase', 'só quem gere a unidade dispensa o que ela exige',
        'só a administração do Processo Eletrônico segue por caminho fora do previsto', 'só quem gere a unidade arquiva, sobresta ou reativa o processo',
    ]);
    assert.deepEqual(atribuicoesDoOrgao(unidades), ['Assessor', 'Promotor de Justiça']);
    assert.equal(alguemTem(unidades, 'gab', 'promotor de justica'), true);
    assert.equal(alguemTem(unidades, 'sec', 'Promotor de Justiça'), false);
    assert.equal(alguemTem(unidades, '+nova', 'Promotor'), null, 'unidade que ainda não existe: não dá para saber');
});
