// Sala da audiência (S10): convocados, presença, registros e termo.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/audienciaSala');
const { audienciasFuturas } = require('../lib/shared/audiencias');

const partes = [
    { nome: 'Maria Souza', polo: 'requerido', representantes: [{ nome: 'Dr. Paulo Lima' }] },
    { nome: 'Ana Denunciante', polo: 'requerente' },
    { nome: 'Quem saiu', polo: 'requerente', retirada: { em: '2026-01-01', por: 'x' } },
];
const aud = {
    id: 'a1', fase_id: 'f', acao_idx: 0, especie: 'conciliacao', data: '2026-11-20', hora: '14:00', modo: 'presencial', local: 'Sala 3',
    participantes: [{ nome: 'João Testemunha', qualidade: 'testemunha' }], designada_em: '', designada_por: '', status: 'designada',
};

test('sala: convocados são as partes ativas, quem as representa e os participantes', () => {
    const c = s.convocadosDaAudiencia(partes, {}, aud);
    assert.deepEqual(c.map((x) => x.chave), ['p0', 'p0r0', 'p1', 'x0']);
    assert.equal(c[1].representa, 'Maria Souza');
    assert.equal(c[3].qualidade, 'testemunha');
    assert.deepEqual(s.sanitizePresencas({ p0: true, zz: true, p1: 'sim' }, c), { p0: true, p0r0: false, p1: false, x0: false });
    assert.deepEqual(s.sanitizeOutros([{ nome: 'Promotora Lia', qualidade: 'Ministério Público' }, { nome: '' }]), [{ nome: 'Promotora Lia', qualidade: 'Ministério Público' }]);
    assert.throws(() => s.sanitizeOutros(Array.from({ length: 21 }, () => ({ nome: 'x' }))), /Até 20/);
});

test('sala: registro exige texto e, na fala, alguém presente', () => {
    assert.throws(() => s.sanitizeOcorrencia({ tipo: 'xyz', texto: 'abc' }, []), /desconhecido/);
    assert.throws(() => s.sanitizeOcorrencia({ tipo: 'deliberacao', texto: 'a' }, []), /ao menos 3/);
    assert.deepEqual(s.sanitizeOcorrencia({ tipo: 'sem_acordo' }, []), { tipo: 'sem_acordo', texto: '' });
    assert.throws(() => s.sanitizeOcorrencia({ tipo: 'depoimento', texto: 'Viu o fato.' }, ['Maria Souza']), /de quem é o depoimento/);
    assert.throws(() => s.sanitizeOcorrencia({ tipo: 'depoimento', texto: 'Viu o fato.', quem: 'João Testemunha' }, ['Maria Souza']), /não está entre os presentes/);
    assert.deepEqual(s.sanitizeOcorrencia({ tipo: 'depoimento', texto: 'Viu o fato.', quem: 'Maria Souza' }, ['Maria Souza']), { tipo: 'depoimento', texto: 'Viu o fato.', quem: 'Maria Souza' });
});

test('sala: termo da audiência realizada e da não realizada', () => {
    const conv = s.convocadosDaAudiencia(partes, {}, aud);
    const sala = {
        aberta_em: '2026-11-20T17:05:00.000Z', presencas: { p0: true, p0r0: true, p1: false, x0: true }, outros: [{ nome: 'Promotora Lia', qualidade: 'Ministério Público' }],
        ocorrencias: [
            { id: '1', tipo: 'depoimento', texto: 'Confirmou o atraso', quem: 'João Testemunha', em: '2026-11-20T17:10:00.000Z', por: 'Hugo' },
            { id: '2', tipo: 'suspensao', texto: '', em: '2026-11-20T17:20:00.000Z', por: 'Hugo' },
            { id: '3', tipo: 'sem_acordo', texto: '', em: '2026-11-20T17:30:00.000Z', por: 'Hugo' },
        ],
    };
    const t = s.textoDoTermo({ numero: 'SEC-1', unidade: 'Vara', audiencia: aud, condutor: 'Hugo Analista', lavrou: 'Hugo Analista', convocados: conv, sala, realizada: true, encerrada_em: '2026-11-20T17:40:00.000Z' });
    assert.match(t, /^Processo SEC-1 · Vara/);
    assert.match(t, /Audiência de conciliação designada para 20\/11\/2026, às 14:00, em Sala 3\. Aberta às 14:05, sob a condução de Hugo Analista\./);
    assert.match(t, /Presentes: Maria Souza \(Requerido\); Dr\. Paulo Lima \(representante de Maria Souza\) e João Testemunha \(testemunha\)\. Ausentes: Ana Denunciante \(Requerente\)\. Também presentes: Promotora Lia \(Ministério Público\)\./);
    assert.match(t, /1\. Depoimento de João Testemunha: Confirmou o atraso\./);
    assert.match(t, /2\. Suspensa a audiência às 14:20\./);
    assert.match(t, /3\. Não houve acordo\./);
    assert.match(t, /encerrou-se a audiência às 14:40\. Eu, Hugo Analista, conduzi a audiência e lavrei este termo\.$/);
    const n = s.textoDoTermo({ numero: 'SEC-1', unidade: 'Vara', audiencia: aud, condutor: 'Eva', lavrou: 'Hugo Analista', convocados: conv, sala: { ...sala, presencas: {}, outros: [], ocorrencias: [] }, realizada: false, motivo: 'Ninguém compareceu', encerrada_em: '2026-11-20T17:40:00.000Z' });
    assert.match(n, /não se realizou: Ninguém compareceu\./);
    assert.match(n, /Presentes: nenhum dos convocados\./);
    assert.ok(!/encerrou-se/.test(n));
    const d = s.documentoDoTermo('Termo de audiência de conciliação', t);
    assert.equal(d.content[0].content[0].text, 'TERMO DE AUDIÊNCIA DE CONCILIAÇÃO');
});

test('sala: encerrada, a audiência sai das próximas', () => {
    assert.equal(audienciasFuturas([aud], '2026-11-20').length, 1);
    assert.equal(audienciasFuturas([{ ...aud, realizada_em: '2026-11-20T17:40:00Z', realizada: true }], '2026-11-20').length, 0);
});
