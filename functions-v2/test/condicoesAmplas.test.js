// Gateways mais ricos: condição pela resposta de outra fase, por dado do
// processo, várias condições ao mesmo tempo e saída padrão ("senão").
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const ex = require('../lib/shared/exigencias');

const rito = (fases) => s.sanitizeRito({ nome: 'R', fases }).fases;
const erro = (fases) => { try { rito(fases); return ''; } catch (e) { return e.message; } };

const base = () => [
    { id: 'adm', nome: 'Admissibilidade', acoes: ['Rito do processo', 'Cautelar?'], acoes_regras: [{ pede: 'lista', opcoes: ['Sumário', 'Ordinário'] }, { pede: 'sim_nao' }] },
    { id: 'ins', nome: 'Instrução', avanco: 'auto', acoes: ['Conferir', 'Ouvir testemunhas', 'Resultado'],
        acoes_regras: [{ obrigatoria: true }, { se: { fase: 'adm', acao: 0, valores: ['Ordinário'] } }, { pede: 'lista', opcoes: ['Procede', 'Não procede'] }],
        proximas: ['aleg', 'julg', 'arq'],
        condicoes_regra: {
            aleg: { fase: 'adm', acao: 0, valores: ['Ordinário'], e: [{ acao: 2, valores: ['Procede'] }] },
            arq: { acao: 2, valores: ['Não procede'], e: [{ dado: 'urgente', valores: ['nao'] }] },
        },
        saida_padrao: 'julg' },
    { id: 'aleg', nome: 'Alegações finais' },
    { id: 'julg', nome: 'Julgamento' },
    { id: 'arq', nome: 'Arquivamento', final: true },
];

test('as origens que a condição aceita são as do processo', () => {
    assert.deepEqual([...ex.DADOS_CONDICAO.origem], [...s.ORIGENS]);
});

test('rito: guarda a condição por outra fase, por dado do processo, as várias ao mesmo tempo e a saída padrão', () => {
    const f = rito(base());
    assert.deepEqual(f[1].acoes_regras[1].se, { acao: 0, valores: ['Ordinário'], fase: 'adm' });
    assert.deepEqual(f[1].condicoes_regra.aleg, { acao: 0, valores: ['Ordinário'], fase: 'adm', e: [{ acao: 2, valores: ['Procede'] }] });
    assert.deepEqual(f[1].condicoes_regra.arq, { acao: 2, valores: ['Não procede'], e: [{ acao: -1, dado: 'urgente', valores: ['nao'] }] });
    assert.equal(f[1].saida_padrao, 'julg');
    // Rito de sempre: nada muda no que se grava.
    const antigo = rito([{ id: 'a', nome: 'A', acoes: ['X'], acoes_regras: [{ pede: 'sim_nao' }], proximas: ['b', 'c'], condicoes_regra: { b: { acao: 0, valores: ['sim'] } } }, { id: 'b', nome: 'B' }, { id: 'c', nome: 'C' }]);
    assert.deepEqual(antigo[0].condicoes_regra, { b: { acao: 0, valores: ['sim'] } });
    assert.equal(antigo[0].saida_padrao, undefined);
});

test('rito: condição ampla inválida é recusada com mensagem; a que perdeu a ação ou a fase sai', () => {
    const com = (mud) => { const f = base(); mud(f); return f; };
    assert.match(erro(com((f) => { f[2].acoes = ['Intimar']; f[2].acoes_regras = [{ se: { fase: 'ins', acao: 0, valores: ['x'] } }]; })), /A ação "Intimar" depende da resposta de uma ação de escolha da fase "Instrução"/);
    // Ação que não existe na outra fase é como ação que saiu: a condição sai com ela.
    assert.equal(rito(com((f) => { f[1].acoes_regras[1].se = { fase: 'adm', acao: 5, valores: ['x'] }; }))[1].acoes_regras[1], null);
    assert.match(erro(com((f) => { f[1].acoes_regras[1].se = { fase: 'adm', acao: 0, valores: ['Outro'] }; })), /escolha ao menos uma resposta de "Rito do processo"/);
    assert.match(erro(com((f) => { f[1].condicoes_regra.arq = { dado: 'cor', valores: ['azul'] }; })), /A saída de "Instrução" para "Arquivamento" depende de um dado do processo que não existe/);
    assert.match(erro(com((f) => { f[1].condicoes_regra.arq = { dado: 'sigilo', valores: ['secreto'] }; })), /escolha ao menos um valor de "Sigilo"/);
    assert.match(erro(com((f) => { f[1].condicoes_regra.arq = { dado: 'campo:mod alidade', valores: ['a'] }; })), /dado do processo que não existe/);
    // Na ação condicional, a parte que lê a própria fase continua só podendo olhar para trás.
    assert.match(erro(com((f) => { f[1].acoes_regras[1].se = { dado: 'urgente', valores: ['sim'], e: [{ acao: 2, valores: ['Procede'] }] }; })), /depende da resposta de uma ação de escolha anterior/);
    // A fase de que dependia saiu do rito: a parte sai com ela e fica o resto.
    const sem = rito(com((f) => { f.shift(); }));
    assert.equal(sem[0].acoes_regras[1], null);
    assert.deepEqual(sem[0].condicoes_regra.aleg, { acao: 2, valores: ['Procede'] });
    // Linha de ação vazia na outra fase: o índice acompanha a ação que ficou.
    const f2 = rito(com((f) => { f[0].acoes = ['', 'Rito do processo', 'Cautelar?']; f[0].acoes_regras = [null, ...f[0].acoes_regras]; f[1].acoes_regras[1].se = { fase: 'adm', acao: 1, valores: ['Ordinário'] }; }));
    assert.deepEqual(f2[1].acoes_regras[1].se, { acao: 0, valores: ['Ordinário'], fase: 'adm' });
    // "fase" apontando para a própria fase é a condição de sempre.
    const f3 = rito(com((f) => { f[1].condicoes_regra.arq = { fase: 'ins', acao: 2, valores: ['Não procede'] }; }));
    assert.deepEqual(f3[1].condicoes_regra.arq, { acao: 2, valores: ['Não procede'] });
    // Limite de partes e parte repetida.
    const muitas = rito(com((f) => { f[1].condicoes_regra.arq = { dado: 'urgente', valores: ['sim'], e: [{ dado: 'urgente', valores: ['nao'] }, { dado: 'sigilo', valores: ['normal'] }, { dado: 'partes', valores: ['sim'] }, { dado: 'origem', valores: ['oficio'] }, { dado: 'tipo', valores: ['t1'] }] }; }));
    assert.deepEqual(muitas[1].condicoes_regra.arq.e.map((x) => x.dado), ['sigilo', 'partes', 'origem']);
});

test('rito: dado de valor livre guarda o nome do campo e o dos valores; saída padrão só entre os caminhos da fase', () => {
    const f = rito([
        { id: 'a', nome: 'A', proximas: ['b', 'c', 'e'], saida_padrao: 'c',
            condicoes_regra: { b: { dado: 'campo:modalidade', rotulo: 'Modalidade', valores: ['Pregão', 'Pregão', ''], nomes: ['Pregão'] }, c: { dado: 'tipo', valores: ['t1', 't2'], nomes: ['PAD', 'Sindicância'] } } },
        { id: 'b', nome: 'B' }, { id: 'c', nome: 'C' }, { id: 'e', nome: 'E', espera: true },
    ]);
    assert.deepEqual(f[0].condicoes_regra.b, { acao: -1, dado: 'campo:modalidade', valores: ['Pregão'], rotulo: 'Modalidade' });
    assert.deepEqual(f[0].condicoes_regra.c, { acao: -1, dado: 'tipo', valores: ['t1', 't2'], nomes: ['PAD', 'Sindicância'] });
    assert.equal(f[0].saida_padrao, undefined, 'saída com regra própria não é "senão": sai ao gravar');
    const padrao = (p, proximas = ['b', 'c', 'e']) => rito([{ id: 'a', nome: 'A', proximas, saida_padrao: p }, { id: 'b', nome: 'B' }, { id: 'c', nome: 'C' }, { id: 'e', nome: 'E', espera: true }])[0].saida_padrao;
    assert.equal(padrao('c'), 'c');
    assert.equal(padrao('e'), undefined, 'fase de espera não é caminho do rito');
    assert.equal(padrao('zz'), undefined);
    assert.equal(padrao('b', ['b', 'e']), undefined, 'com um caminho só, não há o que escolher');
    assert.equal(ex.textoDaCondicao(f[0], f[0].condicoes_regra.c, f), '"Tipo de processo" for PAD ou Sindicância');
    assert.equal(ex.textoDaCondicao(f[0], f[0].condicoes_regra.b, f), '"Modalidade" for Pregão');
});

test('condição: lê a rodada da fase, a resposta de outra fase e os dados do processo', () => {
    const fases = rito(base());
    const proc = (extra) => ({ fases, fase_atual: 'ins', status: 'em_tramitacao', unidade_atual: 'u', ...extra });
    const ctx = ex.respostasDaFase(proc({ acoes_respostas: { adm: { 0: 'Ordinário', 1: 'sim' }, ins: { 2: 'Procede' } }, urgente: true, sigilo: 'restrito', partes: [{ nome: 'A', retirada: true }, { nome: 'B' }],
        origem: { tipo: 'oficio' }, tipo_id: 't1', campos: [{ id: 'modalidade', valor: 'Pregão' }, { id: 'srp', valor: true }, { id: 'vazio', valor: '' }, { id: 'ref', valor: { x: 1 } }] }));
    assert.deepEqual(ctx, { 'adm/0': 'Ordinário', 'adm/1': 'sim', 2: 'Procede', '@urgente': 'sim', '@sigilo': 'restrito', '@partes': 'sim', '@origem': 'oficio', '@tipo': 't1', '@campo:modalidade': 'Pregão', '@campo:srp': 'sim' });
    assert.deepEqual(ex.respostasDaFase({ fase_atual: 'x' }), { '@urgente': 'nao', '@sigilo': 'normal', '@partes': 'nao' });
    const ins = fases[1];
    assert.equal(ex.acaoAtiva(ins, 1, ctx), true, 'ação que só vale no rito ordinário, escolhido na Admissibilidade');
    assert.equal(ex.acaoAtiva(ins, 1, ex.respostasDaFase(proc({ acoes_respostas: { adm: { 0: 'Sumário' } } }))), false);
    assert.equal(ex.acaoAtiva(ins, 1, ex.respostasDaFase(proc())), false, 'sem a resposta da outra fase, não vale');
    assert.equal(ex.condicaoAtendida(ins.condicoes_regra.aleg, ctx, ins), true);
    assert.equal(ex.condicaoAtendida(ins.condicoes_regra.aleg, ex.respostasDaFase(proc({ acoes_respostas: { adm: { 0: 'Ordinário' }, ins: { 2: 'Não procede' } } })), ins), false, 'todas as partes precisam valer');
    assert.equal(ex.condicaoAtendida(ins.condicoes_regra.arq, ex.respostasDaFase(proc({ acoes_respostas: { ins: { 2: 'Não procede' } } })), ins), true);
    assert.equal(ex.condicaoAtendida(ins.condicoes_regra.arq, ex.respostasDaFase(proc({ acoes_respostas: { ins: { 2: 'Não procede' } }, urgente: true })), ins), false);
    assert.equal(ex.textoDaCondicao(ins, ins.condicoes_regra.aleg, fases), '"Rito do processo (fase Admissibilidade)" for Ordinário e "Resultado" for Procede');
    assert.equal(ex.textoDaCondicao(ins, ins.condicoes_regra.arq, fases), '"Resultado" for Não procede e "Urgente" for Não');
});

test('saída automática: a regra que vale indica a saída; sem regra indicada, a saída padrão', () => {
    const fases = rito(base());
    const sai = (acoes_respostas, extra) => s.saidaAutomatica({ fases, fase_atual: 'ins', status: 'em_tramitacao', unidade_atual: 'u', acoes_respostas, ...extra }, ['u'])?.fase_id;
    assert.equal(sai({ adm: { 0: 'Ordinário' }, ins: { 2: 'Procede' } }), 'aleg');
    assert.equal(sai({ adm: { 0: 'Sumário' }, ins: { 2: 'Procede' } }), 'julg', 'no sumário, nenhuma regra indica saída: vai pela padrão');
    assert.equal(sai({ ins: { 2: 'Não procede' } }), 'arq');
    assert.equal(sai({ ins: { 2: 'Não procede' } }, { urgente: true }), 'julg');
    assert.equal(sai(undefined), 'julg');
    // Sem saída padrão, continua como sempre: espera o botão.
    const sem = base(); delete sem[1].saida_padrao;
    assert.equal(s.saidaAutomatica({ fases: rito(sem), fase_atual: 'ins', status: 'em_tramitacao', unidade_atual: 'u' }, ['u']), null);
    // Saída padrão que também tem regra não é "senão": só segue por ela quando a regra dela vale.
    const dupla = base(); dupla[1].saida_padrao = 'arq';
    assert.equal(s.saidaAutomatica({ fases: rito(dupla), fase_atual: 'ins', status: 'em_tramitacao', unidade_atual: 'u' }, ['u']), null);
});
