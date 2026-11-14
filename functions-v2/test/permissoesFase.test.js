// Quem pode, pelo rito: cumprir a ação, concluir a fase, dispensar o que ela
// exige, seguir por outro caminho e mudar a situação do processo.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const pf = require('../lib/shared/permissoesFase');

const ator = (x = {}) => ({ isAdmin: false, gestor: false, responsavel: false, atribuicao: '', ...x });

test('rito: guarda as permissões da fase e a atribuição da ação; valor estranho sai', () => {
    const [a, b, c] = s.sanitizeRito({ nome: 'R', fases: [
        { nome: 'A', permissoes: { concluir: 'atribuicao', concluir_atribuicao: '  Promotor  ', dispensar: 'admin', desviar: 'gestor', situacao: 'gestor' },
            acoes: ['Decidir', 'Conferir'], acoes_regras: [{ quem: 'atribuicao', atribuicao: 'Promotor' }, { quem: 'gestor', atribuicao: 'sobra' }] },
        { nome: 'B', permissoes: { concluir: 'qualquer', concluir_atribuicao: 'Analista', dispensar: 'todos', desviar: '', situacao: 'nunca' } },
        { nome: 'C', permissoes: { concluir: 'responsavel' } },
    ] }).fases;
    assert.deepEqual(a.permissoes, { concluir: 'atribuicao', concluir_atribuicao: 'Promotor', dispensar: 'admin', desviar: 'gestor', situacao: 'gestor' });
    assert.deepEqual(a.acoes_regras, [{ quem: 'atribuicao', atribuicao: 'Promotor' }, { quem: 'gestor' }], 'a atribuição só fica com a reserva por atribuição');
    assert.equal(b.permissoes, undefined, 'nada válido: a fase fica como sempre foi');
    assert.deepEqual(c.permissoes, { concluir: 'responsavel' });
});

test('rito: reserva por atribuição sem dizer qual é recusada, na fase e na ação', () => {
    assert.throws(() => s.sanitizeRito({ nome: 'R', fases: [{ nome: 'Decisão', permissoes: { concluir: 'atribuicao', concluir_atribuicao: ' ' } }] }),
        /Em "Decisão", quem conclui a fase: informe a atribuição/);
    assert.throws(() => s.sanitizeRito({ nome: 'R', fases: [{ nome: 'A', acoes: ['Assinar'], acoes_regras: [{ quem: 'atribuicao' }] }] }),
        /A ação "Assinar": informe a atribuição/);
});

test('quem pode: sem reserva, todos; a administração, sempre; cada reserva pelo que a pessoa é na unidade', () => {
    assert.equal(pf.podeQuem(undefined, undefined, ator()), true);
    assert.equal(pf.podeQuem('gestor', undefined, ator({ isAdmin: true })), true);
    assert.equal(pf.podeQuem('responsavel', undefined, ator()), false);
    assert.equal(pf.podeQuem('responsavel', undefined, ator({ responsavel: true })), true);
    assert.equal(pf.podeQuem('responsavel', undefined, ator({ gestor: true })), false, 'gerir a unidade não é responder pelo processo');
    assert.equal(pf.podeQuem('gestor', undefined, ator({ gestor: true })), true);
    assert.equal(pf.podeQuem('atribuicao', 'Promotor de Justiça', ator({ atribuicao: ' promotor  de justica ' })), true, 'sem contar acento, caixa e espaços');
    assert.equal(pf.podeQuem('atribuicao', 'Promotor', ator({ atribuicao: 'Promotor Substituto' })), false, 'a atribuição inteira, não um pedaço');
    assert.equal(pf.podeQuem('atribuicao', 'Promotor', ator({ gestor: true, atribuicao: 'Chefe' })), false, 'quem gere a unidade não ganha a atribuição dos outros');
    assert.equal(pf.podeQuem('atribuicao', '', ator({ atribuicao: '' })), false, 'atribuição vazia não casa com lotação sem atribuição');
});

test('ato reservado: a quem gere a unidade ou só à administração', () => {
    assert.equal(pf.podeReserva(undefined, ator()), true);
    assert.equal(pf.podeReserva('gestor', ator()), false);
    assert.equal(pf.podeReserva('gestor', ator({ gestor: true })), true);
    assert.equal(pf.podeReserva('admin', ator({ gestor: true })), false);
    assert.equal(pf.podeReserva('admin', ator({ isAdmin: true })), true);
    assert.equal(pf.textoQuem('atribuicao', 'Promotor'), 'quem tem a atribuição "Promotor"');
    assert.equal(pf.textoReserva('admin'), 'a administração do Processo Eletrônico');
});
