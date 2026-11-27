// Minuta devolvida para correção (para onde volta) e fase que segue quando
// alguém assume. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');

const rito = (extra = {}) => s.sanitizeRito({ nome: 'Demandas', fases: [
    { id: 'pen', nome: 'Pendente', segue_ao_assumir: true, ...extra.pen },
    { id: 'ana', nome: 'Em análise', elaboracao: true, ...extra.ana },
    { id: 'rev', nome: 'Revisão', juntada_conjunta: true, ...extra.rev },
    { id: 'arq', nome: 'Arquivamento', final: true, segue_ao_assumir: true },
] }).fases;

const unidades = [
    { id: 'ass', ativa: true, membros_uids: ['ana', 'bia'] },
    { id: 'gab', ativa: true, membros_uids: ['dra'] },
    { id: 'velha', ativa: false, membros_uids: ['ana'] },
];

test('rito: guarda "segue ao assumir", menos na fase final e na de espera', () => {
    const fases = rito();
    assert.equal(fases[0].segue_ao_assumir, true);
    assert.equal(fases[3].segue_ao_assumir, undefined, 'fase final não tem para onde seguir');
    const comEspera = s.sanitizeRito({ nome: 'R', fases: [{ id: 'a', nome: 'A', proximas: ['b', 'e'] }, { id: 'b', nome: 'B', final: true }, { id: 'e', nome: 'Espera', espera: true, segue_ao_assumir: true }] }).fases;
    assert.equal(comEspera[2].segue_ao_assumir, undefined);
    assert.equal(s.sanitizeRito({ nome: 'R', fases: [{ nome: 'A', segue_ao_assumir: 'sim' }, { nome: 'B' }] }).fases[0].segue_ao_assumir, undefined);
});

test('rito: guarda quem aprova a minuta e cobra a atribuição', () => {
    const fases = rito({ rev: { permissoes: { aprovar: 'gestor' } }, ana: { permissoes: { aprovar: 'atribuicao', aprovar_atribuicao: ' Promotor ' } } });
    assert.deepEqual(fases[2].permissoes, { aprovar: 'gestor' });
    assert.deepEqual(fases[1].permissoes, { aprovar: 'atribuicao', aprovar_atribuicao: 'Promotor' });
    assert.throws(() => rito({ rev: { permissoes: { aprovar: 'atribuicao' } } }), /quem aprova a minuta: informe a atribuição/);
    assert.equal(rito({ rev: { permissoes: { aprovar: 'todos' } } })[2].permissoes, undefined);
});

test('correção: a minuta volta para a unidade, a fase e a pessoa que a redigiu', () => {
    const proc = { fases: rito(), fase_atual: 'rev', unidade_atual: 'gab' };
    assert.deepEqual(s.destinoDaCorrecao(proc, { unidade_origem: 'ass', fase_id: 'ana', autor_uid: 'ana' }, unidades),
        { unidade_id: 'ass', fase_id: 'ana', responsavel_uid: 'ana' });
});

test('correção: mesma unidade muda só a fase; mesma fase não muda nada', () => {
    const proc = { fases: rito(), fase_atual: 'rev', unidade_atual: 'ass' };
    assert.deepEqual(s.destinoDaCorrecao(proc, { unidade_origem: 'ass', fase_id: 'ana', autor_uid: 'bia' }, unidades),
        { unidade_id: null, fase_id: 'ana', responsavel_uid: 'bia' });
    assert.deepEqual(s.destinoDaCorrecao(proc, { unidade_origem: 'ass', fase_id: 'rev', autor_uid: 'bia' }, unidades),
        { unidade_id: null, fase_id: null, responsavel_uid: 'bia' });
});

test('correção: minuta antiga, sem a fase gravada, volta para a fase de elaboração que leva à atual', () => {
    const proc = { fases: rito(), fase_atual: 'rev', unidade_atual: 'gab' };
    assert.equal(s.destinoDaCorrecao(proc, { unidade_origem: 'ass', autor_uid: 'ana' }, unidades).fase_id, 'ana');
    // Sem fase de elaboração antes: o processo volta à unidade, na fase em que está.
    const semElab = { ...proc, fases: rito({ ana: { elaboracao: false } }) };
    assert.deepEqual(s.destinoDaCorrecao(semElab, { unidade_origem: 'ass', autor_uid: 'ana' }, unidades), { unidade_id: 'ass', fase_id: null, responsavel_uid: 'ana' });
});

test('correção: unidade desativada, fase que sumiu e autor que saiu não travam a devolução', () => {
    const proc = { fases: rito(), fase_atual: 'rev', unidade_atual: 'gab' };
    assert.deepEqual(s.destinoDaCorrecao(proc, { unidade_origem: 'velha', fase_id: 'sumiu', autor_uid: 'ana' }, unidades),
        { unidade_id: null, fase_id: null, responsavel_uid: null }, 'fica com quem decide, sem responsável novo');
    assert.equal(s.destinoDaCorrecao(proc, { unidade_origem: 'ass', fase_id: 'ana', autor_uid: 'saiu' }, unidades).responsavel_uid, null);
    assert.equal(s.destinoDaCorrecao(proc, { unidade_origem: 'ass', fase_id: 'arq', autor_uid: 'ana' }, unidades).fase_id, null, 'nunca para a fase final');
});

test('a tela diz o mesmo destino que o servidor aplica', async () => {
    const tela = await import('../../src/lib/secretariaRito.js');
    const fases = rito();
    for (const [fase_atual, unidade_atual] of [['rev', 'gab'], ['rev', 'ass'], ['ana', 'ass']]) {
        for (const doc of [{ unidade_origem: 'ass', fase_id: 'ana', autor_uid: 'ana' }, { unidade_origem: 'ass', autor_uid: 'saiu' }, { unidade_origem: 'velha', fase_id: 'arq', autor_uid: 'ana' }, { unidade_origem: 'gab', fase_id: 'rev', autor_uid: 'dra' }]) {
            const proc = { fases, fase_atual, unidade_atual };
            assert.deepEqual(tela.destinoDaCorrecao(proc, doc, unidades), s.destinoDaCorrecao(proc, doc, unidades), JSON.stringify([fase_atual, unidade_atual, doc]));
        }
    }
});

test('modelo "Demanda com minuta e aprovação": o servidor guarda tudo o que o modelo e o par de fases configuram', async () => {
    const { modelosDeRito, fasesDeMinuta } = await import('../../src/lib/secretariaRito.js');
    const m = modelosDeRito().find((x) => x.nome === 'Demanda com minuta e aprovação');
    const salvo = s.sanitizeRito(m).fases;
    assert.deepEqual(salvo.map((f) => [f.nome, !!f.segue_ao_assumir, !!f.elaboracao, !!f.juntada_conjunta, !!f.final]), [
        ['Pendente', true, false, false, false], ['Em análise', false, true, false, false], ['Revisão', false, false, true, false], ['Arquivamento', false, false, false, true],
    ]);
    m.fases.forEach((orig, i) => {
        for (const k of ['orientacao', 'rotulo_concluir', 'acoes', 'ao_entrar', 'permissoes']) assert.deepEqual(salvo[i][k], orig[k], `${orig.nome}: ${k}`);
        (orig.acoes_regras || []).forEach((r, k) => assert.equal(salvo[i].acoes_regras[k].ajuda, r.ajuda, `${orig.nome}: ajuda da ação ${k + 1} (cabe em 200 caracteres)`));
    });
    const nomes = (id) => s.fasesSeguintes(salvo, id).map((y) => y.nome);
    assert.deepEqual(salvo.map((f) => nomes(f.id)), [['Em análise'], ['Revisão'], ['Arquivamento'], []]);
    // Devolvida na Revisão, a minuta volta para Em análise, com quem a redigiu.
    const proc = { fases: salvo, fase_atual: salvo[2].id, unidade_atual: 'ass' };
    assert.deepEqual(s.destinoDaCorrecao(proc, { unidade_origem: 'ass', fase_id: salvo[1].id, autor_uid: 'ana' }, unidades), { unidade_id: null, fase_id: salvo[1].id, responsavel_uid: 'ana' });
    // O par inserido pelo botão do editor: sem fase seguinte dita, a aprovação segue para a próxima da lista.
    const par = s.sanitizeRito({ nome: 'R', fases: [...fasesDeMinuta(), { id: 'fim', nome: 'Fim', final: true }] }).fases;
    assert.deepEqual(par.map((f) => s.fasesSeguintes(par, f.id).map((y) => y.nome)), [['Aprovação da minuta'], ['Fim'], []]);
});

test('segue ao assumir: usa a mesma saída do avanço automático, sem remeter', () => {
    const fases = rito();
    const proc = { fases: fases.map((f) => (f.id === 'pen' ? { ...f, avanco: 'auto' } : f)), fase_atual: 'pen', status: 'em_tramitacao', unidade_atual: 'ass' };
    assert.deepEqual(s.saidaAutomatica(proc, []), { fase_id: 'ana' });
});
