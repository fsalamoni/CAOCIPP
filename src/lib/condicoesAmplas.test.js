import test from 'node:test';
import assert from 'node:assert/strict';
import {
    acaoAtiva, chaveDaCondicao, condicaoAtendida, condicaoIncompleta, fontesDaCondicao, juntarPartes, opcoesDaParte, parteDaFonte, partesDaCondicao, problemaDaCondicao,
    remapearCondicoes, remapearDeOutraFase, respostasDoProcesso, saidaPadrao, saidasComCondicao, textoCondicao,
} from './exigencias.js';
import { copiarFases } from './secretariaRito.js';

// Processo disciplinar em miniatura: a Admissibilidade escolhe o rito; a Instrução lê essa escolha, o resultado dela e a urgência.
const fases = [
    { id: 'adm', nome: 'Admissibilidade', acoes: ['Rito do processo', 'Há indícios?'], acoes_regras: [{ pede: 'lista', opcoes: ['Ordinário', 'Sumário'] }, { pede: 'sim_nao' }], proximas: ['ins'] },
    {
        id: 'ins', nome: 'Instrução', acoes: ['Ouvir testemunhas', 'Perícia', 'Resultado'], proximas: ['aleg', 'julg', 'arq'], saida_padrao: 'julg',
        acoes_regras: [null, { se: { acao: 0, fase: 'adm', valores: ['Ordinário'] } }, { pede: 'lista', opcoes: ['Procede', 'Não procede'], rotulo: 'Resultado' }],
        condicoes_regra: {
            aleg: { acao: 0, fase: 'adm', valores: ['Ordinário'], e: [{ acao: 2, valores: ['Procede'] }] },
            arq: { acao: 2, valores: ['Não procede'], e: [{ acao: -1, dado: 'urgente', valores: ['nao'] }] },
        },
    },
    { id: 'aleg', nome: 'Alegações finais', proximas: ['julg'] },
    { id: 'julg', nome: 'Julgamento', proximas: ['arq'] },
    { id: 'arq', nome: 'Arquivo', final: true },
];
const ins = fases[1];
const tipos = [
    { id: 't1', nome: 'Sindicância', formulario: { campos: [{ id: 'gravidade', rotulo: 'Gravidade', tipo: 'lista', opcoes: ['Leve', 'Grave'] }, { id: 'obs', rotulo: 'Obs', tipo: 'texto' }] } },
    { id: 't2', nome: 'PAD', formulario: { campos: [{ id: 'gravidade', rotulo: 'Gravidade', tipo: 'lista', opcoes: ['Leve', 'Grave'] }, { id: 'reinc', rotulo: 'Reincidente', tipo: 'sim_nao' }, { id: 'fora', rotulo: 'Fora', tipo: 'lista', uso: 'oculto', opcoes: ['a', 'b'] }] } },
];
const proc = (extra = {}) => ({ fase_atual: 'ins', fases, ...extra });

test('a chave diz de onde a condição lê; as partes vão e voltam', () => {
    assert.equal(chaveDaCondicao({ acao: 2, valores: [] }), '2');
    assert.equal(chaveDaCondicao({ acao: 2, campo: 'sistema', valores: [] }), '2.sistema');
    assert.equal(chaveDaCondicao({ acao: 0, fase: 'adm', valores: [] }), 'adm/0');
    assert.equal(chaveDaCondicao({ acao: -1, dado: 'campo:gravidade', valores: [] }), '@campo:gravidade');
    const c = ins.condicoes_regra.aleg;
    assert.deepEqual(partesDaCondicao(c), [{ acao: 0, fase: 'adm', valores: ['Ordinário'] }, { acao: 2, valores: ['Procede'] }]);
    assert.deepEqual(juntarPartes(partesDaCondicao(c)), c);
    assert.deepEqual(partesDaCondicao(undefined), []);
    assert.equal(juntarPartes([]), undefined);
    assert.equal(condicaoIncompleta(c), false);
    assert.equal(condicaoIncompleta({ ...c, e: [{ acao: 2, valores: [] }] }), true);
});

test('fontes da condição: a própria fase, as outras e os dados do processo', () => {
    const f = fontesDaCondicao(ins, Infinity, { fases, tipos });
    assert.deepEqual(f.filter((s) => s.grupo === 'fase').map(chaveDaCondicao), ['2']);
    assert.deepEqual(f.filter((s) => s.grupo === 'outra').map(chaveDaCondicao), ['adm/0', 'adm/1']);
    assert.match(f.find((s) => chaveDaCondicao(s) === 'adm/0').rotulo, /"Rito do processo", na fase "Admissibilidade"/);
    assert.deepEqual(f.filter((s) => s.grupo === 'processo').map(chaveDaCondicao), ['@urgente', '@sigilo', '@partes', '@origem', '@tipo', '@campo:gravidade', '@campo:reinc']);
    // Na ação condicional, só as ações anteriores da própria fase; as de outra fase valem todas.
    assert.deepEqual(fontesDaCondicao(ins, 1, { fases }).filter((s) => s.grupo !== 'processo').map(chaveDaCondicao), ['adm/0', 'adm/1']);
    // Com um tipo só (ou nenhum), "Tipo de processo" não decide nada.
    assert.equal(fontesDaCondicao(ins, Infinity, { fases, tipos: [tipos[0]] }).some((s) => s.dado === 'tipo'), false);
    assert.equal(fontesDaCondicao(ins).some((s) => s.dado === 'tipo'), false);
});

test('respostas de cada parte e parte nova a partir da fonte', () => {
    const ctx = { fases, tipos };
    assert.deepEqual(opcoesDaParte(ins, { acao: 0, fase: 'adm', valores: [] }, ctx), [['Ordinário', 'Ordinário'], ['Sumário', 'Sumário']]);
    assert.deepEqual(opcoesDaParte(ins, { acao: -1, dado: 'sigilo', valores: [] }, ctx), [['normal', 'Normal'], ['restrito', 'Restrito']]);
    assert.deepEqual(opcoesDaParte(ins, { acao: -1, dado: 'tipo', valores: [] }, ctx), [['t1', 'Sindicância'], ['t2', 'PAD']]);
    assert.deepEqual(opcoesDaParte(ins, { acao: -1, dado: 'campo:reinc', valores: [] }, ctx), [['sim', 'Sim'], ['nao', 'Não']]);
    assert.equal(opcoesDaParte(ins, { acao: -1, dado: 'campo:sumiu', valores: [] }, ctx), null);
    assert.equal(opcoesDaParte(ins, { acao: 0, fase: 'sumiu', valores: [] }, ctx), null);
    // O dado de valor livre leva o nome do campo e o de cada valor, para as mensagens do processo.
    const fonte = fontesDaCondicao(ins, Infinity, ctx).find((s) => s.dado === 'campo:reinc');
    assert.deepEqual(parteDaFonte(fonte, ['sim'], opcoesDaParte(ins, fonte, ctx)), { acao: -1, dado: 'campo:reinc', valores: ['sim'], rotulo: 'Reincidente', nomes: ['Sim'] });
    assert.deepEqual(parteDaFonte({ acao: -1, dado: 'tipo' }, ['t2'], [['t1', 'Sindicância'], ['t2', 'PAD']]), { acao: -1, dado: 'tipo', valores: ['t2'], nomes: ['PAD'] });
    assert.deepEqual(parteDaFonte({ acao: -1, dado: 'urgente', rotulo: 'x' }, ['sim'], []), { acao: -1, dado: 'urgente', valores: ['sim'] });
    assert.deepEqual(parteDaFonte({ acao: 0, fase: 'adm', rotulo: 'x' }), { acao: 0, fase: 'adm', valores: [] });
});

test('o processo vira uma tabela só: rodada, outras fases e dados (igual ao servidor)', () => {
    const ctx = respostasDoProcesso(proc({
        acoes_respostas: { adm: { 0: 'Ordinário', 1: 'sim' }, ins: { 2: 'Procede' } }, urgente: true, sigilo: 'restrito', partes: [{ nome: 'A', retirada: {} }, { nome: 'B' }],
        origem: { tipo: 'oficio' }, tipo_id: 't1', campos: [{ id: 'modalidade', valor: 'Pregão' }, { id: 'srp', valor: true }, { id: 'vazio', valor: '' }, { id: 'ref', valor: { x: 1 } }],
    }));
    assert.deepEqual(ctx, { 'adm/0': 'Ordinário', 'adm/1': 'sim', 2: 'Procede', '@urgente': 'sim', '@sigilo': 'restrito', '@partes': 'sim', '@origem': 'oficio', '@tipo': 't1', '@campo:modalidade': 'Pregão', '@campo:srp': 'sim' });
    assert.deepEqual(respostasDoProcesso({ fase_atual: 'x' }), { '@urgente': 'nao', '@sigilo': 'normal', '@partes': 'nao' });
    assert.equal(acaoAtiva(ins, 1, ctx), true, 'ação que só vale no rito ordinário, escolhido na Admissibilidade');
    assert.equal(acaoAtiva(ins, 1, respostasDoProcesso(proc({ acoes_respostas: { adm: { 0: 'Sumário' } } }))), false);
    assert.equal(acaoAtiva(ins, 1, respostasDoProcesso(proc())), false, 'sem a resposta da outra fase, não vale');
    assert.equal(condicaoAtendida(ins.condicoes_regra.aleg, ctx, ins), true);
    assert.equal(condicaoAtendida(ins.condicoes_regra.aleg, respostasDoProcesso(proc({ acoes_respostas: { adm: { 0: 'Ordinário' }, ins: { 2: 'Não procede' } } })), ins), false, 'todas as partes precisam valer');
    assert.equal(condicaoAtendida(ins.condicoes_regra.arq, respostasDoProcesso(proc({ acoes_respostas: { ins: { 2: 'Não procede' } } })), ins), true);
    assert.equal(condicaoAtendida(ins.condicoes_regra.arq, respostasDoProcesso(proc({ acoes_respostas: { ins: { 2: 'Não procede' } }, urgente: true })), ins), false);
    assert.equal(condicaoAtendida(undefined, {}, ins), true);
});

test('o texto da condição diz de que fase é a resposta e junta as partes com "e"', () => {
    assert.equal(textoCondicao(ins, ins.condicoes_regra.aleg, fases), '"Rito do processo (fase Admissibilidade)" for Ordinário e "Resultado" for Procede');
    assert.equal(textoCondicao(ins, ins.condicoes_regra.arq, fases), '"Resultado" for Não procede e "Urgente" for Não');
    assert.equal(textoCondicao(ins, { acao: -1, dado: 'campo:reinc', valores: ['sim'], rotulo: 'Reincidente', nomes: ['Sim'] }), '"Reincidente" for Sim');
    assert.equal(textoCondicao(ins, { acao: -1, dado: 'tipo', valores: ['t1', 't2'], nomes: ['Sindicância', 'PAD'] }), '"Tipo de processo" for Sindicância ou PAD');
    assert.equal(textoCondicao(ins, undefined), '');
});

test('pendências do editor: a condição que lê fase, ação ou dado que não existe mais', () => {
    const ctx = { fases, tipos };
    assert.equal(problemaDaCondicao(ins, ins.condicoes_regra.aleg, Infinity, ctx), null);
    assert.equal(problemaDaCondicao(ins, ins.condicoes_regra.arq, Infinity, ctx), null);
    assert.match(problemaDaCondicao(ins, { acao: 0, fase: 'sumiu', valores: ['x'] }, Infinity, ctx), /fase que não existe mais/);
    assert.match(problemaDaCondicao(ins, { acao: 5, fase: 'adm', valores: ['x'] }, Infinity, ctx), /outra fase que não é mais de escolha/);
    assert.match(problemaDaCondicao(ins, { acao: 0, fase: 'adm', valores: ['Especial'] }, Infinity, ctx), /nenhuma das respostas escolhidas existe mais/);
    assert.match(problemaDaCondicao(ins, { acao: -1, dado: 'campo:sumiu', valores: ['x'] }, Infinity, ctx), /dado do processo que não existe mais/);
    assert.match(problemaDaCondicao(ins, { acao: -1, dado: 'tipo', valores: ['t9'] }, Infinity, ctx), /nenhuma das respostas/);
    // O problema pode estar numa parte de "e também".
    assert.match(problemaDaCondicao(ins, { acao: 2, valores: ['Procede'], e: [{ acao: 0, fase: 'sumiu', valores: ['x'] }] }, Infinity, ctx), /fase que não existe mais/);
    // Sem o rito em mãos, o que está fora da fase não se confere aqui (o servidor confere).
    assert.equal(problemaDaCondicao(ins, { acao: 0, fase: 'sumiu', valores: ['x'] }), null);
    assert.equal(problemaDaCondicao(ins, { acao: -1, dado: 'tipo', valores: ['t9'] }), null);
    // Na ação condicional, a parte de outra fase não precisa "vir antes".
    assert.equal(problemaDaCondicao(ins, ins.acoes_regras[1].se, 1, ctx), null);
});

test('ações que mudam de lugar: as condições acompanham, na fase e nas outras', () => {
    // Na Instrução, "Resultado" sobe da posição 2 para a 0.
    const r = remapearCondicoes(ins, [2, 0, 1], [ins.acoes_regras[2], ins.acoes_regras[0], ins.acoes_regras[1]]);
    assert.deepEqual(r.condicoes_regra.aleg, { acao: 0, fase: 'adm', valores: ['Ordinário'], e: [{ acao: 0, valores: ['Procede'] }] }, 'só a parte local muda de índice');
    assert.deepEqual(r.condicoes_regra.arq, { acao: 0, valores: ['Não procede'], e: [{ acao: -1, dado: 'urgente', valores: ['nao'] }] });
    assert.deepEqual(r.acoes_regras[2].se, { acao: 0, fase: 'adm', valores: ['Ordinário'] }, 'a que lê outra fase fica como está');
    // "Resultado" saiu: a parte que dependia dela sai; a outra parte assume a condição.
    const sem = remapearCondicoes(ins, [0, 1], [ins.acoes_regras[0], ins.acoes_regras[1]]);
    assert.deepEqual(sem.condicoes_regra, { aleg: { acao: 0, fase: 'adm', valores: ['Ordinário'] }, arq: { acao: -1, dado: 'urgente', valores: ['nao'] } });
    // Na Admissibilidade, as duas ações trocam de lugar: a Instrução, que lê a resposta dela, acompanha.
    const novas = remapearDeOutraFase(fases, 'adm', [1, 0]);
    assert.deepEqual(novas[1].acoes_regras[1].se, { acao: 1, fase: 'adm', valores: ['Ordinário'] });
    assert.deepEqual(novas[1].condicoes_regra.aleg, { acao: 1, fase: 'adm', valores: ['Ordinário'], e: [{ acao: 2, valores: ['Procede'] }] });
    assert.equal(novas[0], fases[0]);
    assert.equal(novas[2], fases[2], 'fase que não lê a outra fica a mesma');
    // "Rito do processo" saiu da Admissibilidade: a ação deixa de ser condicional e a saída fica com a parte que sobrou.
    const tirada = remapearDeOutraFase(fases, 'adm', [1]);
    assert.equal(tirada[1].acoes_regras[1], null);
    assert.deepEqual(tirada[1].condicoes_regra.aleg, { acao: 2, valores: ['Procede'] });
    assert.deepEqual(tirada[1].condicoes_regra.arq, ins.condicoes_regra.arq);
});

test('saída padrão ("senão"): indicada quando nenhuma regra indica outra', () => {
    assert.equal(saidaPadrao(fases, ins), 'julg');
    const marca = (resp) => saidasComCondicao(fases, ins, resp).map((s) => [s.fase.id, s.indicada, s.padrao]);
    assert.deepEqual(marca(respostasDoProcesso(proc({ acoes_respostas: { adm: { 0: 'Sumário' }, ins: { 2: 'Procede' } } }))), [['aleg', false, false], ['julg', false, true], ['arq', false, false]]);
    assert.deepEqual(marca(respostasDoProcesso(proc({ acoes_respostas: { adm: { 0: 'Ordinário' }, ins: { 2: 'Procede' } } }))), [['aleg', true, false], ['julg', false, false], ['arq', false, false]]);
    // Não vale: saída com regra própria, saída que não existe, fase com um caminho só.
    assert.equal(saidaPadrao(fases, { ...ins, saida_padrao: 'aleg' }), '');
    assert.equal(saidaPadrao(fases, { ...ins, saida_padrao: 'sumiu' }), '');
    assert.equal(saidaPadrao(fases, { ...fases[0], saida_padrao: 'ins' }), '');
    assert.equal(saidaPadrao(fases, fases[2]), '');
});

test('copiar fases leva as condições de outra fase e a saída padrão', () => {
    const copias = copiarFases(fases, new Set(), fases);
    const [adm2, ins2, , julg2] = copias;
    assert.notEqual(adm2.id, 'adm');
    assert.equal(ins2.acoes_regras[1].se.fase, adm2.id);
    assert.equal(ins2.condicoes_regra[copias[2].id].fase, adm2.id);
    assert.equal(ins2.saida_padrao, julg2.id);
    // Só a Instrução, para outro rito: o que lia a Admissibilidade sai; o resto fica.
    const [so] = copiarFases([ins], new Set(), fases);
    assert.equal(so.acoes_regras[1], null);
    assert.equal(so.condicoes_regra, undefined, 'as saídas não vieram junto');
    assert.equal(so.saida_padrao, undefined);
    // Duplicada no mesmo rito: continua lendo a Admissibilidade de lá.
    const [dup] = copiarFases([ins], new Set(fases.map((f) => f.id)), fases);
    assert.equal(dup.acoes_regras[1].se.fase, 'adm');
    assert.deepEqual(dup.condicoes_regra.aleg, ins.condicoes_regra.aleg);
    assert.equal(dup.saida_padrao, 'julg');
});
