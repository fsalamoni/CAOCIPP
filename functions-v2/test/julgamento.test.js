const test = require('node:test');
const assert = require('node:assert/strict');
const j = require('../lib/shared/julgamento');
const { sanitizeRegras, respondeNaRodada, respostasDaAcao, opcoesDaResposta } = require('../lib/shared/exigencias');

const CFG = { resultados: ['Procedente', 'Improcedente', 'Arquivamento'] };
const v = (nome, voto, funcao = 'membro') => ({ nome, voto, funcao });

test('rito: julgamento colegiado sempre nos autos, visto pelas partes, e responde como escolha', () => {
    const r = sanitizeRegras({ acoes_regras: [{ pede: 'julgamento', julgamento: { resultados: ['Procedente', ' Improcedente ', 'Procedente'], quorum: 3 }, destino: 'evento', partes: false, obrigatoria: true }] }, ['Julgar']);
    assert.deepEqual(r.acoes_regras[0], { pede: 'julgamento', julgamento: { resultados: ['Procedente', 'Improcedente'], quorum: 3 }, destino: 'autos', partes: true, obrigatoria: true });
    assert.equal(respondeNaRodada(r.acoes_regras[0]), true);
    assert.deepEqual(opcoesDaResposta(r.acoes_regras[0]), ['Procedente', 'Improcedente']);
    assert.deepEqual(respostasDaAcao(r.acoes_regras[0], 2, 'Improcedente'), { 2: 'Improcedente' });
    assert.throws(() => sanitizeRegras({ acoes_regras: [{ pede: 'julgamento', julgamento: { resultados: ['Só um'] } }] }, ['X']), /ao menos dois/);
    assert.throws(() => sanitizeRegras({ acoes_regras: [{ pede: 'julgamento', julgamento: { resultados: ['A', 'Impedido'] } }] }, ['X']), /não são resultados/);
    assert.throws(() => sanitizeRegras({ acoes_regras: [{ pede: 'julgamento', julgamento: { resultados: ['A', 'B'], quorum: 0 } }] }, ['X']), /quórum/);
    assert.throws(() => sanitizeRegras({ acoes_regras: [{ pede: 'julgamento', julgamento: { resultados: ['A', 'B'], desempate: 'favoravel', favoravel: 'C' } }] }, ['X']), /mais favorável/);
    assert.deepEqual(j.sanitizeJulgamentoDaAcao({ resultados: ['A', 'B'], quorum: 1, desempate: 'favoravel', favoravel: 'B' }, 'X'), { resultados: ['A', 'B'], desempate: 'favoravel', favoravel: 'B' });
});

test('apuração: maioria dos válidos; impedido, suspeito, ausente e abstenção não contam', () => {
    const votos = [v('Ana', 'Procedente', 'relator'), v('Bruno', 'Improcedente'), v('Carla', 'Procedente'), v('Davi', 'impedido'), v('Eva', 'ausente'), v('Fábio', 'Procedente')];
    assert.deepEqual(j.apurar(CFG, votos), { resultado: 'Procedente', placar: [['Procedente', 3], ['Improcedente', 1]], validos: 4, unanime: false });
    const d = j.dadosDoJulgamento(CFG, { data: '2026-11-20', votos: [...votos, { nome: ' ' }] }, '2026-11-20');
    assert.equal(d.votos.length, 6);
    assert.equal(j.textoDoJulgamento(CFG, d),
        'Procedente, por maioria (3 a 1), em sessão de 20/11/2026. Relator: Ana. Vencido: Bruno (Improcedente). Impedido: Davi. Ausente: Eva');
    const un = { data: '2026-11-20', votos: [v('Ana', 'Arquivamento', 'relator'), v('Bia', 'Arquivamento'), v('Caio', 'suspeito'), v('Dora', 'suspeito')] };
    assert.equal(j.textoDoJulgamento(CFG, un), 'Arquivamento, por unanimidade (2 votos), em sessão de 20/11/2026. Relator: Ana. Suspeitos: Caio, Dora');
});

test('quórum e empate: presidente desempata, ou prevalece o mais favorável', () => {
    const empate = [v('Ana', 'Procedente', 'relator'), v('Bruno', 'Improcedente'), v('Carla', 'Procedente'), v('Davi', 'Improcedente', 'presidente')];
    assert.deepEqual(j.apurar(CFG, empate), { resultado: 'Improcedente', placar: [['Procedente', 2], ['Improcedente', 2]], validos: 4, unanime: false, desempate: 'presidente' });
    assert.match(j.textoDoJulgamento(CFG, { data: '2026-11-20', votos: empate }), /^Improcedente, pelo voto de desempate do presidente \(2 a 2\)/);
    const semPres = empate.map((x) => ({ ...x, funcao: x.funcao === 'presidente' ? 'membro' : x.funcao }));
    assert.throws(() => j.apurar(CFG, semPres), /presidente desempata/);
    const fav = { ...CFG, desempate: 'favoravel', favoravel: 'Improcedente' };
    assert.equal(j.apurar(fav, semPres).resultado, 'Improcedente');
    assert.match(j.textoDoJulgamento(fav, { data: '2026-11-20', votos: semPres }), /no empate \(2 a 2\), pelo resultado mais favorável/);
    assert.throws(() => j.apurar({ ...CFG, quorum: 3 }, [v('Ana', 'Procedente', 'relator'), v('Bia', 'Procedente'), v('Caio', 'ausente')]), /Quórum não alcançado: 2 votos válidos, e o rito exige 3/);
});

test('registro: data, relator, presidente, nomes e votos conferidos', () => {
    const ok = [v('Ana', 'Procedente', 'relator'), v('Bia', 'Procedente')];
    assert.throws(() => j.dadosDoJulgamento(CFG, { data: '2026-11-21', votos: ok }, '2026-11-20'), /não pode ser futura/);
    assert.throws(() => j.dadosDoJulgamento(CFG, { data: '', votos: ok }, '2026-11-20'), /data da sessão/);
    assert.throws(() => j.dadosDoJulgamento(CFG, { data: '2026-11-20', votos: [] }, '2026-11-20'), /membros/);
    assert.throws(() => j.dadosDoJulgamento(CFG, { data: '2026-11-20', votos: [v('Ana', 'Procedente'), v('Bia', 'Procedente')] }, '2026-11-20'), /um relator/);
    assert.throws(() => j.dadosDoJulgamento(CFG, { data: '2026-11-20', votos: [v('Ana', 'impedido', 'relator'), v('Bia', 'Procedente')] }, '2026-11-20'), /relator precisa votar/);
    assert.throws(() => j.dadosDoJulgamento(CFG, { data: '2026-11-20', votos: [...ok, v('ana', 'Procedente')] }, '2026-11-20'), /duas vezes/);
    assert.throws(() => j.dadosDoJulgamento(CFG, { data: '2026-11-20', votos: [...ok, v('Caio', 'Talvez')] }, '2026-11-20'), /voto de Caio/);
    assert.throws(() => j.dadosDoJulgamento(CFG, { data: '2026-11-20', votos: [...ok, v('Caio', 'Procedente', 'juiz')] }, '2026-11-20'), /Função desconhecida/);
    assert.throws(() => j.dadosDoJulgamento(CFG, { data: '2026-11-20', votos: [...ok, v('Caio', 'Procedente', 'presidente'), v('Davi', 'Procedente', 'presidente')] }, '2026-11-20'), /no máximo um presidente/);
    assert.deepEqual(j.dadosDoJulgamento(CFG, { data: '2026-11-20', votos: ok, extra: 1 }, '2026-11-20'), { data: '2026-11-20', votos: ok });
});
