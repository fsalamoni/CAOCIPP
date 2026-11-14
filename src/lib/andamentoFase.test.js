import test from 'node:test';
import assert from 'node:assert/strict';
import { comRegistroConduzido, comSituacao, nomeDoModuloDaRegra, problemaDaPagina, resumoAndamento, situacoesDaRegra, textoAvanco, valorDaRegra } from './andamentoFase.js';

test('andamento da fase: resumo, regra do registro ligado e aviso de avanço', () => {
    assert.deepEqual(resumoAndamento({}), []);
    assert.deepEqual(resumoAndamento({ avanco: 'auto', final: true }), [], 'fase final não segue');
    assert.deepEqual(resumoAndamento({ avanco: 'auto', ao_entrar: { arquivar: true }, situacao_registro: { modulo: 'consultas', ao_entrar: 'Pendente', ao_assumir: 'Em elaboração' } }), [
        'segue sozinha ao cumprir o que a fase exige', 'arquiva o processo ao entrar',
        'a consulta fica "Pendente" ao entrar', 'a consulta fica "Em elaboração" quando alguém assume',
    ]);
    assert.deepEqual(resumoAndamento({ situacao_registro: { modulo: 'expedientes', ao_entrar: 'Na pasta' } }), ['o expediente fica "Na pasta" ao entrar']);

    assert.deepEqual(comSituacao({}, { modulo: 'consultas' }), { modulo: 'consultas' });
    assert.deepEqual(comSituacao({ situacao_registro: { modulo: 'consultas', ao_entrar: 'Pendente' } }, { ao_entrar: '' }), { modulo: 'consultas' });
    assert.equal(comSituacao({ situacao_registro: { modulo: 'consultas', ao_entrar: 'Pendente' } }, { modulo: '' }), undefined, 'sem módulo, a regra sai');

    assert.equal(textoAvanco({ fase: 'Análise', unidade: 'Assessoria' }), 'Fase concluída: o processo seguiu para Análise, em Assessoria.');
    assert.equal(textoAvanco({ fase: 'Arquivamento', unidade: '', arquivado: true }), 'Fase concluída: o processo seguiu para Arquivamento, e foi arquivado.');
});

test('página própria: a fase conduz o registro pelas fases da página', () => {
    const paginas = [{ id: 't1', nome: 'Contrato', plural: 'Contratos', fases: [{ key: 'triagem', label: 'Triagem' }, { key: 'assinado', label: 'Assinado' }] }];
    const regra = { modulo: 'paginas', pagina: 't1', ao_entrar: 'triagem', ao_assumir: 'assinado' };
    assert.deepEqual(resumoAndamento({ situacao_registro: regra }, paginas), ['o registro de Contrato fica "Triagem" ao entrar', 'o registro de Contrato fica "Assinado" quando alguém assume']);
    assert.deepEqual(resumoAndamento({ situacao_registro: regra }), ['o registro de página própria fica "triagem" ao entrar', 'o registro de página própria fica "assinado" quando alguém assume'], 'sem a lista de páginas, mostra a chave');
    assert.deepEqual(situacoesDaRegra(regra, paginas), [['triagem', 'Triagem'], ['assinado', 'Assinado']]);
    assert.equal(situacoesDaRegra({ modulo: 'consultas' }, paginas).length, 6);
    assert.equal(nomeDoModuloDaRegra(regra, paginas), 'Contratos');
    assert.equal(valorDaRegra(regra), 'paginas:t1');
    assert.equal(valorDaRegra({ modulo: 'consultas' }), 'consultas');

    // Trocar o que a fase conduz: de consulta para página (ou de página), as situações zeram; entre consulta e expediente, ficam.
    const f = { situacao_registro: { modulo: 'consultas', ao_entrar: 'Pendente' } };
    assert.deepEqual(comRegistroConduzido(f, 'paginas:t1'), { modulo: 'paginas', pagina: 't1' });
    assert.deepEqual(comRegistroConduzido(f, 'expedientes'), { modulo: 'expedientes', ao_entrar: 'Pendente' });
    assert.deepEqual(comRegistroConduzido({ situacao_registro: regra }, 'consultas'), { modulo: 'consultas' });
    assert.deepEqual(comRegistroConduzido({ situacao_registro: regra }, 'paginas:t2'), { modulo: 'paginas', pagina: 't2' });
    assert.equal(comRegistroConduzido({ situacao_registro: regra }, ''), undefined);
    assert.deepEqual(comSituacao({ situacao_registro: regra }, { ao_assumir: '' }), { modulo: 'paginas', pagina: 't1', ao_entrar: 'triagem' });

    assert.equal(problemaDaPagina(regra, paginas), null);
    assert.equal(problemaDaPagina(regra, null), null, 'sem saber as páginas, não acusa');
    assert.equal(problemaDaPagina({ ...regra, pagina: 'x' }, paginas), 'conduz o registro de uma página própria que não existe mais ou está desativada');
    assert.equal(problemaDaPagina({ ...regra, ao_assumir: 'sumiu' }, paginas), 'manda o registro de Contrato para a fase "sumiu", que a página não tem mais');
    assert.equal(problemaDaPagina({ modulo: 'consultas', ao_entrar: 'Pendente' }, paginas), null);
});
