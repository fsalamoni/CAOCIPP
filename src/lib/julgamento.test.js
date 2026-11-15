import test from 'node:test';
import assert from 'node:assert/strict';
import { apurar, problemasDosVotos, textoDaApuracao } from './julgamento.js';
import { opcoesDaResposta, regraComPedido, resumoDaAcao } from './exigencias.js';

const CFG = { resultados: ['Procedente', 'Improcedente'] };
const v = (nome, voto, funcao = 'membro') => ({ nome, voto, funcao });

test('tela: apuração igual à do servidor, com desempate e quórum', () => {
    const votos = [v('Ana', 'Procedente', 'relator'), v('Bia', 'Improcedente'), v('Caio', 'Procedente'), v('Davi', 'impedido')];
    assert.equal(textoDaApuracao(apurar(CFG, votos)), 'Procedente, por maioria (2 a 1)');
    const empate = [v('Ana', 'Procedente', 'relator'), v('Bia', 'Improcedente', 'presidente')];
    assert.equal(textoDaApuracao(apurar(CFG, empate)), 'Improcedente, pelo voto de desempate do presidente (1 a 1)');
    assert.equal(apurar({ ...CFG, desempate: 'favoravel', favoravel: 'Improcedente' }, empate.map((x) => ({ ...x, funcao: 'relator' }))).resultado, 'Improcedente');
    assert.match(apurar({ ...CFG, quorum: 3 }, empate).erro, /Quórum não alcançado: 2 votos válidos, e o rito exige 3/);
    assert.equal(textoDaApuracao(apurar(CFG, [v('Ana', 'Procedente', 'relator')])), 'Procedente, por unanimidade (1 voto)');
});

test('tela: o que falta antes de enviar', () => {
    assert.deepEqual(problemasDosVotos(CFG, [v('', '')]), ['Informe os membros e o voto de cada um.']);
    assert.deepEqual(problemasDosVotos(CFG, [v('Ana', ''), v('Bia', 'Procedente')]), ['Falta o voto de Ana.', 'Indique um relator, e só um.']);
    assert.deepEqual(problemasDosVotos(CFG, [v('Ana', 'ausente', 'relator')]), ['O relator precisa votar um dos resultados.']);
    assert.deepEqual(problemasDosVotos(CFG, [v('Ana', 'Procedente', 'relator'), v('ana', 'Procedente')]), ['Há nome repetido.']);
    assert.deepEqual(problemasDosVotos(CFG, [v('Ana', 'Procedente', 'relator'), v('Bia', 'Improcedente')]), ['Empate entre Procedente e Improcedente: o presidente desempata, e o voto dele precisa ser um dos resultados empatados.']);
    assert.deepEqual(problemasDosVotos(CFG, [v('Ana', 'Procedente', 'relator'), v('Bia', 'Procedente')]), []);
});

test('editor: escolher "Julgar em colegiado" aproveita as opções da escolha e vai aos autos', () => {
    const r = regraComPedido({ pede: 'lista', opcoes: ['Homologa', 'Rejeita'] }, 'julgamento', 'Deliberação');
    assert.deepEqual(r.julgamento, { resultados: ['Homologa', 'Rejeita'] });
    assert.equal(r.destino, 'autos');
    assert.equal(r.partes, true);
    assert.deepEqual(opcoesDaResposta(r), [['Homologa', 'Homologa'], ['Rejeita', 'Rejeita']]);
    assert.match(resumoDaAcao({ ...r, julgamento: { resultados: ['A', 'B'], quorum: 3 } }), /julgamento colegiado \(A, B; quórum de 3 votos; empate: desempata o presidente\)/);
    assert.deepEqual(regraComPedido(null, 'julgamento', 'Julgar').julgamento, { resultados: ['Procedente', 'Improcedente'] });
});
