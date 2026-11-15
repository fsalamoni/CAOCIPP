const test = require('node:test');
const assert = require('node:assert/strict');
const {
    apurar, desempatar, quorumMinimo, votosNecessarios, regrasReuniao, sanitizeAssunto, textoDaAtaReuniao, reordenarAssuntos, placarDe, desfechoDoAssunto,
} = require('../lib/shared/reunioes');
const { sanitizeRegrasSessao } = require('../lib/shared/sessoes');

const R = { quorum: 'maioria', desempate: 'presidente' };

test('regras da reunião: ausente é maioria e voto de qualidade; só o que difere se guarda', () => {
    assert.deepEqual(regrasReuniao(undefined), R);
    assert.deepEqual(regrasReuniao({ quorum: 'um_terco', desempate: 'rejeita' }), { quorum: 'um_terco', desempate: 'rejeita' });
    assert.deepEqual(sanitizeRegrasSessao({ antecedencia: 2, quorum: 'maioria', desempate: 'presidente' }), { antecedencia: 2, contagem: 'uteis' });
    assert.deepEqual(sanitizeRegrasSessao({ quorum: 'livre', desempate: 'rejeita' }), { antecedencia: 0, contagem: 'uteis', quorum: 'livre', desempate: 'rejeita' });
});

test('quórum e votos necessários', () => {
    assert.equal(quorumMinimo(7, 'maioria'), 4);
    assert.equal(quorumMinimo(6, 'maioria'), 4);
    assert.equal(quorumMinimo(7, 'um_terco'), 3);
    assert.equal(quorumMinimo(7, 'dois_tercos'), 5);
    assert.equal(quorumMinimo(7, 'livre'), 1);
    assert.equal(votosNecessarios('absoluta', 7), 4);
    assert.equal(votosNecessarios('dois_tercos', 9), 6);
});

test('apuração: unanimidade, maioria simples, rejeição, sem quórum e empate', () => {
    assert.match(apurar({ sim: 5, nao: 0, abstencao: 0 }, 'simples', 7, R).texto, /unanimidade \(5 votos\)/);
    const r = apurar({ sim: 4, nao: 2, abstencao: 1 }, 'simples', 7, R);
    assert.equal(r.aprovado, true);
    assert.equal(r.texto, 'Aprovado por maioria simples: 4 votos a favor, 2 contra e 1 abstenção.');
    assert.equal(apurar({ sim: 2, nao: 3, abstencao: 0 }, 'simples', 7, R).aprovado, false);
    const sq = apurar({ sim: 2, nao: 1, abstencao: 0 }, 'simples', 7, R);
    assert.equal(sq.sem_quorum, true);
    assert.match(sq.texto, /3 membros votaram de 7 \(mínimo de 4\)/);
    const e = apurar({ sim: 2, nao: 2, abstencao: 1 }, 'simples', 7, R);
    assert.equal(e.aprovado, null);
    assert.match(e.texto, /voto de qualidade/);
    assert.equal(apurar({ sim: 2, nao: 2, abstencao: 1 }, 'simples', 7, { ...R, desempate: 'rejeita' }).aprovado, false);
    // Só abstenções: não aprova.
    assert.equal(apurar({ sim: 0, nao: 0, abstencao: 4 }, 'simples', 7, R).aprovado, false);
    const d = desempatar(e, 'sim', 'Eva');
    assert.equal(d.aprovado, true);
    assert.match(d.texto, /desfeito pelo voto de qualidade de Eva: aprovado/);
});

test('apuração: maioria absoluta e dois terços contam sobre quem pode votar', () => {
    const a = apurar({ sim: 4, nao: 0, abstencao: 1 }, 'absoluta', 7, R);
    assert.equal(a.aprovado, true);
    assert.match(a.texto, /maioria absoluta \(mínimo de 4 de 7\)/);
    const b = apurar({ sim: 3, nao: 1, abstencao: 1 }, 'absoluta', 7, R);
    assert.equal(b.aprovado, false);
    assert.match(b.texto, /não alcançou a maioria absoluta/);
    assert.equal(apurar({ sim: 5, nao: 2, abstencao: 0 }, 'dois_tercos', 7, R).aprovado, true);
    assert.equal(apurar({ sim: 4, nao: 3, abstencao: 0 }, 'dois_tercos', 7, R).aprovado, false);
});

test('assunto: título obrigatório; simbólica não vale na reunião virtual', () => {
    assert.throws(() => sanitizeAssunto({ titulo: 'x' }, 'presencial'), /título/);
    assert.deepEqual(sanitizeAssunto({ titulo: 'Plano anual', votacao: 'xx', maioria: 'yy' }, 'presencial'), { titulo: 'Plano anual', descricao: '', proponente: '', votacao: 'nominal', maioria: 'simples' });
    assert.throws(() => sanitizeAssunto({ titulo: 'Plano anual', votacao: 'simbolica' }, 'assincrona'), /nominal ou secreta/);
    assert.equal(sanitizeAssunto({ titulo: 'Eleição', votacao: 'secreta' }, 'assincrona').votacao, 'secreta');
});

test('placar nominal e ordem dos assuntos', () => {
    assert.deepEqual(placarDe({ a: { voto: 'sim' }, b: { voto: 'nao' }, c: { voto: 'sim' }, d: { voto: 'abstencao' } }), { sim: 2, nao: 1, abstencao: 1 });
    const as = [{ id: 'a', ordem: 1 }, { id: 'b', ordem: 2 }, { id: 'c', ordem: 3 }];
    assert.deepEqual(reordenarAssuntos(as, ['c', 'a']).map((x) => `${x.id}${x.ordem}`), ['c1', 'a2', 'b3']);
});

test('ata da reunião: presença, palavra, impedimento, votos nominais, secreta e encaminhamento', () => {
    const base = { impedidos: [], inscritos: [], falaram: [], encaminhamento: '', inclusao: 'pauta', motivo: '', proponente: '' };
    const as = [
        { ...base, id: '1', ordem: 1, titulo: 'Plano de trabalho 2027', votacao: 'nominal', maioria: 'simples', situacao: 'deliberado', proponente: 'Hugo',
            falaram: ['Julia', 'Hugo'], impedidos: [{ uid: 'd', nome: 'Dora' }],
            resultado: { sim: 2, nao: 1, abstencao: 0, aprovado: true, texto: 'Aprovado por maioria simples: 2 votos a favor e 1 contra.' },
            nominais: [{ nome: 'Eva', voto: 'sim' }, { nome: 'Hugo', voto: 'sim' }, { nome: 'Julia', voto: 'nao' }], encaminhamento: 'Publicar no site' },
        { ...base, id: '2', ordem: 2, titulo: 'Eleição da vice-presidência', votacao: 'secreta', maioria: 'absoluta', situacao: 'deliberado',
            resultado: { sim: 3, nao: 0, abstencao: 0, aprovado: true, texto: 'Aprovado por maioria absoluta (mínimo de 2 de 3): 3 votos a favor e 0 contra.' } },
        { ...base, id: '3', ordem: 3, titulo: 'Informes da presidência', votacao: 'sem_votacao', maioria: 'simples', situacao: 'deliberado' },
        { ...base, id: '4', ordem: 4, titulo: 'Regimento', votacao: 'nominal', maioria: 'dois_tercos', situacao: 'adiado', motivo: 'sem quórum para deliberar' },
    ];
    const s = { titulo: 'Reunião ordinária de 20/11/2026', carater: 'ordinaria', modo: 'presencial', data: '2026-11-20', hora: '14:00', local: 'Sala 2', link: '', observacoes: '' };
    const t = textoDaAtaReuniao(s, 'Conselho de Ética', { presidente: 'Eva', presentes: ['Hugo', 'Julia'], ausentes: ['Dora'], registrada: true }, as, '2026-11-20');
    assert.match(t, /^ATA DA REUNIÃO ORDINÁRIA DE 20\/11\/2026 DO CONSELHO DE ÉTICA/);
    assert.match(t, /reuniu-se o Conselho de Ética em reunião ordinária, sob a presidência de Eva, presentes Hugo e Julia; ausente Dora\./);
    assert.match(t, /1\. Plano de trabalho 2027 \(proposto por Hugo\)\. Fizeram uso da palavra Julia e Hugo\. Declarou impedimento Dora\. Aprovado por maioria simples: 2 votos a favor e 1 contra\. Votaram a favor: Eva e Hugo; contra: Julia\. Encaminhamento: Publicar no site\./);
    assert.match(t, /2\. Eleição da vice-presidência\. Aprovado por maioria absoluta .* Votação secreta\./);
    assert.match(t, /3\. Informes da presidência\. Assunto apresentado, sem votação\./);
    assert.match(t, /4\. Regimento\. Adiado: sem quórum para deliberar\./);
    assert.match(t, /Encerrada a reunião em 20\/11\/2026/);
    assert.equal(desfechoDoAssunto({ ...as[0], situacao: 'pauta' }), 'Não deliberado nesta reunião.');
});
