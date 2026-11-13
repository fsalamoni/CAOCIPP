// Ações com mais opções: condição por campo do formulário, ações alternativas e
// ação que só orienta. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const x = require('../lib/shared/exigencias');
const s = require('../lib/shared/secretaria');
const cp = require('../lib/shared/camposProcesso');
const { migrarEstado } = require('../lib/shared/migrarRito');

const campo = (id, rotulo, extra = {}) => ({ id, rotulo, tipo: 'texto', obrigatorio: false, visivel_partes: false, ...extra });
const SISTEMA = campo('sistema', 'Sistema utilizado', { tipo: 'lista', opcoes: ['SIM', 'SPU', 'E-mail'] });
const fase = (acoes, acoes_regras) => s.sanitizeRito({ nome: 'R', fases: [{ nome: 'Recebimento', acoes, acoes_regras }] }).fases[0];

test('condição por campo de escolha do formulário: guarda o campo, responde por campo e ativa a ação', () => {
    const f = fase(['Dados básicos', 'Registrar no SIM'], [
        { pede: 'formulario', campos: [campo('orgao', 'Órgão'), SISTEMA, campo('urgente', 'Urgente', { tipo: 'sim_nao' })] },
        { pede: 'texto', rotulo: 'PGEA', obrigatoria: true, se: { acao: 0, campo: 'sistema', valores: ['SPU', 'E-mail', 'xpto'] } },
    ]);
    assert.deepEqual(f.acoes_regras[1].se, { acao: 0, campo: 'sistema', valores: ['SPU', 'E-mail'] });
    assert.equal(x.chaveDaCondicao(f.acoes_regras[1].se), '0.sistema');
    assert.equal(x.rotuloDaCondicao(f, f.acoes_regras[1].se), 'Sistema utilizado');
    assert.equal(x.respondeNaRodada(f.acoes_regras[0]), true);

    // O valor do formulário cumprido vira uma resposta por campo de escolha preenchido.
    const form = { campos: f.acoes_regras[0].campos };
    const dado = cp.dadoDoFormulario('Dados', cp.validarCampos(form, { orgao: 'PJ de X', sistema: 'SPU', urgente: 'nao' }));
    const resp = x.respostasDaAcao(f.acoes_regras[0], 0, dado.valor);
    assert.deepEqual(resp, { '0.sistema': 'SPU', '0.urgente': 'nao' });
    assert.equal(x.acaoAtiva(f, 1, resp), true);
    assert.equal(x.acaoAtiva(f, 1, { '0.sistema': 'SIM' }), false);
    assert.equal(x.acaoAtiva(f, 1, {}), false);
    assert.deepEqual(x.acoesObrigatoriasPendentes(f, [0], resp).map((p) => p.acao_idx), [1]);
    assert.deepEqual(x.acoesObrigatoriasPendentes(f, [0], { '0.sistema': 'SIM' }), []);
    // Campo de escolha em branco não responde.
    const semSistema = cp.dadoDoFormulario('Dados', cp.validarCampos(form, { orgao: 'PJ de X' }));
    assert.deepEqual(x.respostasDaAcao(f.acoes_regras[0], 0, semSistema.valor), {});
    // As chaves de uma ação saem juntas ao desfazer.
    assert.deepEqual(Object.keys({ 0: 'a', '0.sistema': 'b', 10: 'c', '1.x': 'd' }).filter((k) => x.respostaDaAcao(k, 0)), ['0', '0.sistema']);
});

test('condição por campo: recusa campo que não é de escolha, que não existe ou de ação com dado reservado', () => {
    const regras = (se, extra = {}) => [{ pede: 'formulario', campos: [campo('orgao', 'Órgão'), SISTEMA], ...extra }, { se }];
    assert.throws(() => fase(['A', 'B'], regras({ acao: 0, campo: 'orgao', valores: ['x'] })), /campo de escolha do formulário/);
    assert.throws(() => fase(['A', 'B'], regras({ acao: 0, campo: 'nada', valores: ['SPU'] })), /campo de escolha do formulário/);
    assert.throws(() => fase(['A', 'B'], regras({ acao: 0, campo: 'sistema', valores: ['SPU'] }, { destino: 'nenhum', ve: 'gestor' })), /sem dado reservado/);
    assert.throws(() => fase(['A', 'B'], regras({ acao: 0, campo: 'sistema', valores: ['fora'] })), /escolha ao menos uma resposta/);
    // Formulário reservado não deixa resposta na rodada.
    const reservado = x.sanitizeRegras({ acoes_regras: [{ pede: 'formulario', campos: [SISTEMA], destino: 'nenhum', ve: 'gestor' }] }, ['A']).acoes_regras[0];
    assert.equal(x.respondeNaRodada(reservado), false);
    assert.deepEqual(x.respostasDaAcao(reservado, 0, [{ id: 'sistema', valor: 'SPU' }]), {});
});

test('ações alternativas: cumprida uma do grupo, as outras deixam de ser cobradas', () => {
    const f = fase(['Enviar pelo SIGO', 'Inserir o PDF no SIM', 'Entregar em mãos', 'Arquivar cópia'], [
        { obrigatoria: true }, { obrigatoria: true, ou: 0 }, { obrigatoria: true, ou: 1 }, { obrigatoria: true },
    ]);
    assert.equal(f.acoes_regras[1].ou, 0);
    assert.deepEqual(x.grupoDeAlternativas(f, 2), [0, 1, 2], 'o grupo é pela raiz');
    assert.deepEqual(x.grupoDeAlternativas(f, 3), [3]);
    const pend = (feitas) => x.acoesObrigatoriasPendentes(f, feitas).map((p) => p.acao_idx);
    assert.deepEqual(pend([]), [0, 3], 'o grupo aparece uma vez');
    assert.equal(x.acoesObrigatoriasPendentes(f, [])[0].descricao, 'Enviar pelo SIGO ou Inserir o PDF no SIM ou Entregar em mãos');
    assert.deepEqual(pend([1]), [3]);
    assert.deepEqual(pend([2, 3]), []);
    assert.equal(x.alternativaCumprida(f, 0, new Set([2]), {}), true);
    assert.equal(x.alternativaCumprida(f, 2, new Set([2]), {}), false, 'a própria ação não a dispensa');
});

test('ações alternativas: a alternativa que não vale agora (condicional) não dispensa a outra', () => {
    const f = fase(['Há SIGO?', 'Enviar pelo SIGO', 'Inserir no SIM'], [
        { pede: 'sim_nao' }, { obrigatoria: true, se: { acao: 0, valores: ['sim'] } }, { obrigatoria: true, ou: 1 },
    ]);
    // Enviar pelo SIGO foi marcada com "sim"; a resposta mudou para "não": ela não vale mais, e a do SIM volta a ser cobrada.
    assert.deepEqual(x.acoesObrigatoriasPendentes(f, [0, 1], { 0: 'sim' }), []);
    assert.deepEqual(x.acoesObrigatoriasPendentes(f, [0, 1], { 0: 'nao' }).map((p) => p.acao_idx), [2]);
});

test('ações alternativas: só a uma ação anterior que se marca', () => {
    assert.throws(() => fase(['A', 'B'], [{ ou: 1 }, null]), /alternativa a uma ação anterior/);
    assert.throws(() => fase(['A', 'B'], [null, { ou: 1 }]), /alternativa a uma ação anterior/);
    assert.throws(() => fase(['A', 'B'], [{ pede: 'orientacao' }, { ou: 0 }]), /alternativa a uma ação anterior/);
    assert.throws(() => fase(['A', 'B'], [{ pede: 'documento', documento: { forma: 'qualquer' } }, { ou: 0 }]), /alternativa a uma ação anterior/);
});

test('ação que só orienta: não guarda destino, nível nem quem cumpre, e nunca fica pendente', () => {
    const f = fase(['Há urgência?', 'Avisar o gabinete por telefone', 'Conferir anexos'], [
        { pede: 'sim_nao' },
        { pede: 'orientacao', ajuda: 'Ramal 1234', obrigatoria: true, destino: 'autos', quem: 'gestor', partes: true, se: { acao: 0, valores: ['sim'] } },
        { pede: 'orientacao' },
    ]);
    assert.throws(() => fase(['A', 'B'], [null, { pede: 'orientacao', ou: 0 }]), /alternativa a uma ação anterior/, 'orientação não é alternativa de nada');
    assert.deepEqual(f.acoes_regras[1], { ajuda: 'Ramal 1234', pede: 'orientacao', se: { acao: 0, valores: ['sim'] } });
    assert.deepEqual(f.acoes_regras[2], { pede: 'orientacao' });
    assert.deepEqual(x.acoesObrigatoriasPendentes(f, [], { 0: 'sim' }), []);
    assert.equal(x.respondeNaRodada(f.acoes_regras[1]), false);
});

test('migrarEstado: a resposta de campo do formulário acompanha a ação', () => {
    const v1 = [{ id: 'f1', nome: 'Triagem', acoes: ['Conferir', 'Certificar', 'Dados básicos'] }];
    const v2 = [{ id: 'f1', nome: 'Triagem', acoes: ['Dados básicos', 'Conferir'] }];
    const r = migrarEstado({ fases: v1, fase_atual: 'f1', acoes_feitas: { f1: [2] }, acoes_respostas: { f1: { '2.sistema': 'SPU', '1.x': 'sai' } } }, v2, 'f1');
    assert.deepEqual(r.acoes_respostas, { f1: { '0.sistema': 'SPU' } });
});
