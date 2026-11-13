import test from 'node:test';
import assert from 'node:assert/strict';
import { comSituacao, resumoAndamento, textoAvanco } from './andamentoFase.js';

test('andamento da fase: resumo, regra do registro ligado e aviso de avanço', () => {
    assert.deepEqual(resumoAndamento({}), []);
    assert.deepEqual(resumoAndamento({ avanco: 'auto', final: true }), [], 'fase final não segue');
    assert.deepEqual(resumoAndamento({ avanco: 'auto', ao_entrar: { arquivar: true }, situacao_registro: { modulo: 'consultas', ao_entrar: 'Pendente', ao_assumir: 'Em elaboração' } }), [
        'segue sozinha ao cumprir as ações obrigatórias', 'arquiva o processo ao entrar',
        'a consulta fica "Pendente" ao entrar', 'a consulta fica "Em elaboração" quando alguém assume',
    ]);
    assert.deepEqual(resumoAndamento({ situacao_registro: { modulo: 'expedientes', ao_entrar: 'Na pasta' } }), ['o expediente fica "Na pasta" ao entrar']);

    assert.deepEqual(comSituacao({}, { modulo: 'consultas' }), { modulo: 'consultas' });
    assert.deepEqual(comSituacao({ situacao_registro: { modulo: 'consultas', ao_entrar: 'Pendente' } }, { ao_entrar: '' }), { modulo: 'consultas' });
    assert.equal(comSituacao({ situacao_registro: { modulo: 'consultas', ao_entrar: 'Pendente' } }, { modulo: '' }), undefined, 'sem módulo, a regra sai');

    assert.equal(textoAvanco({ fase: 'Análise', unidade: 'Assessoria' }), 'Fase concluída: o processo seguiu para Análise, em Assessoria.');
    assert.equal(textoAvanco({ fase: 'Arquivamento', unidade: '', arquivado: true }), 'Fase concluída: o processo seguiu para Arquivamento, e foi arquivado.');
});
