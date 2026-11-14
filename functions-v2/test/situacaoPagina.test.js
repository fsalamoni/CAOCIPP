// Rito que conduz o registro de uma página própria: a regra gravada, a
// conferência das fases e a mudança pelas regras de transição da página.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const sr = require('../lib/shared/situacaoRegistro');

const tipo = {
    label_singular: 'Contrato',
    phases: [{ key: 'triagem', label: 'Triagem' }, { key: 'analise', label: 'Em análise' }, { key: 'assinado', label: 'Assinado' }],
    fields: [{ key: 'valor', label: 'Valor', type: 'number', phase: 'analise', required_to_advance: true }, { key: 'assinado_em', label: 'Assinado em', type: 'date' }],
    transitions: [
        { from: 'analise', to: 'assinado', requirements: [{ type: 'approval', mode: 'roles', roles: ['creator'] }], on_success: { set_fields: [{ field: 'assinado_em', value: 'now' }], require_comment: true } },
    ],
};
const HOJE = '2026-11-14';
const membro = { userId: 'u1', userRole: 'member' };
const dono = { userId: 'u9', userRole: 'creator' };

test('rito: guarda a página e as fases dela; sem página ou com chave inválida, a regra sai', () => {
    const [a, b, c] = s.sanitizeRito({ nome: 'R', fases: [
        { nome: 'A', situacao_registro: { modulo: 'paginas', pagina: 'tipo1', ao_entrar: 'triagem', ao_assumir: 'analise' } },
        { nome: 'B', situacao_registro: { modulo: 'paginas', ao_entrar: 'triagem' } },
        { nome: 'C', situacao_registro: { modulo: 'paginas', pagina: 'tipo1', ao_entrar: 'Em revisão', ao_assumir: 'assinado' } },
    ] }).fases;
    assert.deepEqual(a.situacao_registro, { modulo: 'paginas', pagina: 'tipo1', ao_entrar: 'triagem', ao_assumir: 'analise' });
    assert.equal(b.situacao_registro, undefined, 'sem a página, não há o que conduzir');
    assert.deepEqual(c.situacao_registro, { modulo: 'paginas', pagina: 'tipo1', ao_assumir: 'assinado' }, 'situação de consulta não é fase de página');
    assert.deepEqual(sr.sanitizeSituacaoRegistro({ modulo: 'consultas', pagina: 'tipo1', ao_entrar: 'Pendente' }), { modulo: 'consultas', ao_entrar: 'Pendente' }, 'consulta não guarda página');
    assert.equal(sr.sanitizeSituacaoRegistro({ modulo: 'consultas', ao_entrar: 'triagem' }), null, 'fase de página não é situação de consulta');
    assert.equal(sr.chaveDoRegistro(a.situacao_registro), 'paginas:tipo1');
    assert.equal(sr.chaveDoRegistro({ modulo: 'expedientes' }), 'expedientes');
});

test('salvar o rito: a página e as fases citadas têm de existir', () => {
    const fases = [
        { nome: 'A', situacao_registro: { modulo: 'paginas', pagina: 'tipo1', ao_entrar: 'triagem', ao_assumir: 'sumiu' } },
        { nome: 'B', situacao_registro: { modulo: 'paginas', pagina: 'outra', ao_entrar: 'triagem' } },
        { nome: 'C', situacao_registro: { modulo: 'consultas', ao_entrar: 'Pendente' } },
    ];
    assert.deepEqual(sr.fasesDePaginaInvalidas(fases, { tipo1: tipo, outra: null }), [
        'A fase "A" manda o registro da página para a fase "sumiu", que a página não tem.',
        'A fase "B" conduz o registro de uma página própria que não existe mais.',
    ]);
    assert.deepEqual(sr.fasesDePaginaInvalidas(fases.slice(2), {}), []);
});

test('página: a mudança de fase segue as regras de transição do tipo', () => {
    assert.equal(sr.mudancasDaPagina(tipo, { phase: 'triagem' }, 'triagem', membro, HOJE), null, 'já está na fase');
    assert.deepEqual(sr.mudancasDaPagina(tipo, { phase: 'triagem', values: { valor: 5 } }, 'analise', membro, HOJE), { campos: { phase: 'analise' }, de: 'Triagem', para: 'Em análise' });
    assert.deepEqual(sr.mudancasDaPagina(tipo, {}, 'triagem', membro, HOJE), { campos: { phase: 'triagem' }, de: 'sem fase', para: 'Triagem' });
    // Campo exigido para sair da fase.
    assert.deepEqual(sr.mudancasDaPagina(tipo, { phase: 'analise', values: {} }, 'assinado', dono, HOJE), { motivo: 'Preencha "Valor" para avançar de fase.', para: 'Assinado' });
    // Aprovação: vale o papel de quem pratica o ato no processo.
    assert.deepEqual(sr.mudancasDaPagina(tipo, { phase: 'analise', values: { valor: 5 } }, 'assinado', membro, HOJE), { motivo: 'Esta mudança exige aprovação de: creator.', para: 'Assinado' });
    // Permitida: grava os campos automáticos da regra, sem perder os demais.
    assert.deepEqual(sr.mudancasDaPagina(tipo, { phase: 'analise', values: { valor: 5 } }, 'assinado', dono, HOJE),
        { campos: { phase: 'assinado', values: { valor: 5, assinado_em: HOJE } }, de: 'Em análise', para: 'Assinado' });
    assert.deepEqual(sr.mudancasDaPagina(tipo, { phase: 'triagem' }, 'sumiu', dono, HOJE), { motivo: 'Fase de destino inexistente.', para: 'sumiu' });
});
