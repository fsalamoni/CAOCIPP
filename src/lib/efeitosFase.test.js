// O que a fase faz sozinha: escolhas do editor, resumos e o que o servidor recusaria.
// Rodar: npm run test:lib
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrePrazo, comAoEntrar, comAviso, comPrazoVencido, efeitosAoEntrar, notaDoPrazo, prazoAbertoDaAcao, problemasDosEfeitos, textoDoAviso, textoPrazoDaAcao, textosDosPrazos } from './efeitosFase.js';

test('ao entrar: escolhas que se excluem não ficam juntas, e o vazio sai', () => {
    assert.deepEqual(comAoEntrar({ ao_entrar: { urgente: true } }, { sem_urgencia: true }), { sem_urgencia: true });
    assert.deepEqual(comAoEntrar({ ao_entrar: { sem_urgencia: true } }, { urgente: true }), { urgente: true });
    assert.deepEqual(comAoEntrar({ ao_entrar: { sem_responsavel: true } }, { responsavel: 'gestor' }), { responsavel: 'gestor' });
    assert.deepEqual(comAoEntrar({ ao_entrar: { responsavel: 'atribuicao', responsavel_atribuicao: 'Promotor' } }, { sem_responsavel: true }), { sem_responsavel: true });
    assert.deepEqual(comAoEntrar({}, { responsavel: 'atribuicao' }), { responsavel: 'atribuicao', responsavel_atribuicao: '' }, 'a atribuição em branco fica à espera do nome');
    assert.deepEqual(comAoEntrar({ ao_entrar: { responsavel: 'atribuicao', responsavel_atribuicao: 'Promotor' } }, { responsavel: 'autor' }), { responsavel: 'autor' });
    assert.deepEqual(comAoEntrar({ ao_entrar: { pendencia: 'Decidir', pendencia_interrompe: true } }, { pendencia: '' }), undefined);
    assert.deepEqual(comAoEntrar({ ao_entrar: { responsavel: 'gestor', pendencia: 'Decidir', sigilo: 'restrito' } }, { arquivar: true }), { sigilo: 'restrito', arquivar: true });
    assert.equal(comAoEntrar({ ao_entrar: { urgente: true } }, { urgente: false }), undefined);
    assert.deepEqual(comAoEntrar({ ao_entrar: { urgente: true } }, { sigilo: '' }), { urgente: true });
});

test('aviso e regra do vencimento: sem aviso a mensagem sai; nada marcado, nada gravado', () => {
    assert.deepEqual(comAviso({ aviso: { para: 'unidade', mensagem: 'Olhar hoje' } }, { para: 'ninguem' }), { para: 'ninguem' });
    assert.deepEqual(comAviso({ aviso: { para: 'unidade' } }, { para: '' }), undefined);
    assert.deepEqual(comAviso({}, { mensagem: 'Olhar hoje' }), { mensagem: 'Olhar hoje' });
    assert.deepEqual(comPrazoVencido({ prazo_vencido: { urgente: true } }, { avisar_gestores: true }), { urgente: true, avisar_gestores: true });
    assert.equal(comPrazoVencido({ prazo_vencido: { urgente: true } }, { urgente: false }), undefined);
});

test('resumos: efeitos ao entrar, aviso e prazos, nas palavras da tela', () => {
    assert.deepEqual(efeitosAoEntrar({}), []);
    assert.deepEqual(efeitosAoEntrar({ ao_entrar: { arquivar: true } }), [], 'o arquivamento tem lugar próprio');
    assert.deepEqual(efeitosAoEntrar({ ao_entrar: { sem_urgencia: true, sigilo: 'restrito', responsavel: 'atribuicao', responsavel_atribuicao: 'Promotor', pendencia: 'Decidir', pendencia_interrompe: true } }), [
        'tira a urgência', 'torna o processo restrito', 'designa como responsável quem tem a atribuição "Promotor"', 'abre pendência para quem decide, que interrompe a fase até ser apreciada',
    ]);
    assert.deepEqual(efeitosAoEntrar({ ao_entrar: { urgente: true, sigilo: 'normal', responsavel: 'autor' } }), ['marca o processo como urgente', 'volta o sigilo ao normal', 'designa como responsável quem moveu o processo']);
    assert.equal(textoDoAviso({}), null);
    assert.equal(textoDoAviso({ aviso: { para: 'gestores', mensagem: 'Distribuir' } }), 'avisa quem gere a unidade ao entrar, com a mensagem "Distribuir"');
    assert.equal(textoDoAviso({ aviso: { para: 'ninguem' } }), 'não avisa ninguém ao entrar');
    assert.equal(textoDoAviso({ aviso: { mensagem: 'Conferir' } }), 'avisa a unidade quando chega por remessa, com a mensagem "Conferir"');
});

test('prazos da fase: só para quem abre prazo; antecedência padrão não se repete', () => {
    const comPrazo = { prazo_dias: 5, prazo_auto: true };
    assert.equal(abrePrazo({ prazo_dias: 5 }), false, 'prazo só anotado não abre sozinho');
    assert.equal(abrePrazo(comPrazo), true);
    assert.equal(abrePrazo({ acoes: ['Parecer'], acoes_regras: [{ prazo_dias: 3 }] }), true);
    assert.equal(abrePrazo({ acoes: [' '], acoes_regras: [{ prazo_dias: 3 }] }), false, 'ação sem texto sai ao salvar');
    assert.deepEqual(textosDosPrazos({ prazo_alerta_dias: 5, prazo_vencido: { urgente: true } }), [], 'sem prazo, nada vale');
    assert.deepEqual(textosDosPrazos({ ...comPrazo, prazo_alerta_dias: 2 }), []);
    assert.deepEqual(textosDosPrazos({ ...comPrazo, prazo_alerta_dias: 0, prazo_vencido: { urgente: true, avisar_gestores: true } }),
        ['alerta de prazo só no dia do vencimento', 'prazo vencido: o processo fica urgente e quem gere a unidade é avisado']);
    assert.deepEqual(textosDosPrazos({ ...comPrazo, prazo_alerta_dias: 10 }), ['alerta de prazo 10 dias antes do vencimento']);
    assert.equal(textoPrazoDaAcao({ prazo_dias: 3 }), '3 dias úteis');
    assert.equal(textoPrazoDaAcao({ prazo_dias: 1, prazo_contagem: 'corridos' }), '1 dia corrido');
    assert.equal(textoPrazoDaAcao({}), '');
});

test('problemas: o que o servidor recusaria vira pendência do editor', () => {
    assert.deepEqual(problemasDosEfeitos({}), []);
    assert.deepEqual(problemasDosEfeitos({ ao_entrar: { responsavel: 'atribuicao', responsavel_atribuicao: 'Promotor' } }), []);
    assert.match(problemasDosEfeitos({ ao_entrar: { responsavel: 'atribuicao', responsavel_atribuicao: ' ' } })[0], /não diz qual/);
    assert.match(problemasDosEfeitos({ ao_entrar: { urgente: true, sem_urgencia: true } })[0], /marca e tira a urgência/);
    assert.match(problemasDosEfeitos({ ao_entrar: { sem_responsavel: true, responsavel: 'autor' } })[0], /tira e designa/);
    assert.match(problemasDosEfeitos({ ao_entrar: { arquivar: true, pendencia: 'x' } })[0], /arquiva o processo/);
});

test('tela do processo: o prazo aberto da ação é o da rodada atual', () => {
    const prazos = [
        { id: '1', status: 'cancelado', fase_id: 'b', acao_idx: 0, rodada_fim: true },
        { id: '2', status: 'aberto', fase_id: 'b', acao_idx: 0, vence_em: '2026-11-19' },
        { id: '3', status: 'aberto', fase_id: 'b', vence_em: '2026-11-30' },
    ];
    assert.equal(prazoAbertoDaAcao(prazos, 'b', 0).id, '2');
    assert.equal(prazoAbertoDaAcao(prazos, 'b', 1), null);
    assert.equal(prazoAbertoDaAcao(undefined, 'b', 0), null);
    assert.equal(notaDoPrazo(prazos[1], '2026-11-14'), 'Prazo da ação: vence em 19/11/2026.');
    assert.equal(notaDoPrazo(prazos[1], '2026-11-19'), 'Prazo da ação: vence em 19/11/2026.', 'no dia do vencimento ainda não venceu');
    assert.equal(notaDoPrazo(prazos[1], '2026-11-20'), 'Prazo da ação: venceu em 19/11/2026.');
    assert.equal(notaDoPrazo(null, '2026-11-20'), undefined);
});
