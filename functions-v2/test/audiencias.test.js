const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../lib/shared/audiencias');
const { sanitizeRegras, respondeNaRodada } = require('../lib/shared/exigencias');
const { sanitizePedido } = require('../lib/shared/comunicacoes');

test('rito: a ação designa audiência, sempre nos autos e vista pelas partes', () => {
    const r = sanitizeRegras({ acoes_regras: [{ pede: 'audiencia', audiencia: { especie: 'instrucao' }, destino: 'evento', partes: false, obrigatoria: true, quem: 'gestor' }] }, ['Designar audiência']);
    assert.deepEqual(r.acoes_regras[0], { quem: 'gestor', pede: 'audiencia', audiencia: { especie: 'instrucao' }, destino: 'autos', partes: true, obrigatoria: true });
    assert.deepEqual(sanitizeRegras({ acoes_regras: [{ pede: 'audiencia' }] }, ['X']).acoes_regras[0].audiencia, { especie: 'audiencia' });
    assert.throws(() => sanitizeRegras({ acoes_regras: [{ pede: 'audiencia', audiencia: { especie: 'juri' } }] }, ['X']), /espécie desconhecida/);
    assert.equal(respondeNaRodada(r.acoes_regras[0]), false);
});

test('designação: data, hora, modo, local ou link e participantes conferidos', () => {
    const hoje = '2026-11-14';
    const d = a.dadosDaAudiencia({ data: '2026-11-20', hora: '14:00', modo: 'hibrida', local: ' Sala 3 ', link: 'https://meet/x', participantes: [{ nome: 'José', qualidade: 'testemunha' }, { nome: ' ' }] }, hoje);
    assert.deepEqual(d, { data: '2026-11-20', hora: '14:00', modo: 'hibrida', local: 'Sala 3', link: 'https://meet/x', participantes: [{ nome: 'José', qualidade: 'testemunha' }] });
    assert.equal(a.textoDaAudiencia(d), '20/11/2026, às 14:00, em Sala 3 e por videoconferência (https://meet/x). Participam, além das partes: José (testemunha)');
    assert.equal(a.textoDaAudiencia({ data: '2026-11-20', hora: '09:30', modo: 'virtual', link: 'L' }), '20/11/2026, às 09:30, por videoconferência (L)');
    assert.deepEqual(a.dadosDaAudiencia({ data: hoje, hora: '08:00', local: 'Sala' }, hoje), { data: hoje, hora: '08:00', modo: 'presencial', local: 'Sala' }, 'presencial sem link');
    assert.throws(() => a.dadosDaAudiencia({ data: '2026-11-13', hora: '08:00', local: 'S' }, hoje), /data passada/);
    assert.throws(() => a.dadosDaAudiencia({ data: '2026-11-20', hora: '25:00', local: 'S' }, hoje), /hora/);
    assert.throws(() => a.dadosDaAudiencia({ data: '2026-11-20', hora: '08:00' }, hoje), /local/);
    assert.throws(() => a.dadosDaAudiencia({ data: '2026-11-20', hora: '08:00', modo: 'virtual' }, hoje), /link/);
    assert.throws(() => a.dadosDaAudiencia({ data: '2026-11-20', hora: '08:00', local: 'S', participantes: [{ nome: 'X', qualidade: 'reu' }] }, hoje), /Qualidade/);
});

test('lista do processo: designar, cancelar a última da ação e saber a próxima', () => {
    const nova = (id, data, extra = {}) => ({ id, fase_id: 'f', acao_idx: 0, especie: 'audiencia', data, hora: '10:00', modo: 'presencial', local: 'S', designada_em: 'x', designada_por: 'Ana', status: 'designada', ...extra });
    let l = a.aplicarAudiencia([], 'f', 0, nova('a1', '2026-11-20'));
    l = a.aplicarAudiencia(l, 'f', 0, null);
    assert.equal(l[0].status, 'cancelada', 'desfazer cancela a designada');
    l = a.aplicarAudiencia(l, 'f', 0, nova('a2', '2026-11-25'));
    l = a.aplicarAudiencia(l, 'f', 1, nova('a3', '2026-11-22', { acao_idx: 1 }));
    assert.deepEqual(a.audienciasFuturas(l, '2026-11-14').map((x) => x.id), ['a3', 'a2'], 'da mais próxima; sem a cancelada');
    assert.deepEqual(a.audienciasFuturas(l, '2026-11-23').map((x) => x.id), ['a2'], 'a que passou sai');
});

test('comunicação: a marca {audiencia} que sobrou impede expedir', () => {
    assert.throws(() => sanitizePedido({ especie: 'intimacao', texto: 'Compareça à audiência de {audiencia}.', partes_idx: [0], sem_prazo: true }, '2026-11-14'), /designe a audiência/);
});
