// npm run test:lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparSessoes, ondeSessao, problemasDaSessao, quandoSessao, textoAntecedencia, veSessoes } from './sessoes.js';

test('sessões: textos de onde e quando, no jeito das certidões', () => {
    assert.equal(ondeSessao({ modo: 'presencial', local: 'Sala 2' }), 'em Sala 2');
    assert.equal(quandoSessao({ data: '2026-12-01', hora: '14:00', modo: 'virtual', link: 'https://x' }), '01/12/2026, às 14:00, por videoconferência (https://x)');
    assert.equal(textoAntecedencia({ antecedencia: 0 }), '');
    assert.equal(textoAntecedencia({ antecedencia: 1, contagem: 'uteis' }), 'A pauta sai com ao menos 1 dia útil de antecedência.');
    assert.equal(textoAntecedencia({ antecedencia: 5, contagem: 'corridos' }), 'A pauta sai com ao menos 5 dias de antecedência.');
});

test('sessões: formulário avisa o que falta, como o servidor', () => {
    assert.deepEqual(problemasDaSessao({ data: '2026-11-01', hora: '', modo: 'hibrida', local: '', link: '' }, '2026-11-16'),
        ['A data da sessão já passou.', 'Informe a hora da sessão.', 'Informe o local da sessão.', 'Informe o link ou a sala virtual.']);
    assert.deepEqual(problemasDaSessao({ data: '2026-12-01', hora: '09:00', modo: 'virtual', link: 'sala 3' }, '2026-11-16'), []);
});

test('sessões: quem vê a aba e como a agenda se agrupa', () => {
    const orgaos = [{ id: 'c', decisao: 'colegiada', composicao: [{ uid: 'eva', funcao: 'titular', inicio: '', fim: '' }] }, { id: 's', decisao: 'singular' }];
    const unidades = [{ id: 'u1', orgao_id: 'c' }, { id: 'u2', orgao_id: 's' }];
    const base = { orgaos, unidades, minhasUnidades: [], adminOrgaos: [] };
    assert.equal(veSessoes({ ...base, uid: 'eva' }, '2026-11-16'), true, 'compõe o colegiado, mesmo sem lotação');
    assert.equal(veSessoes({ ...base, uid: 'ana', minhasUnidades: ['u1'] }, '2026-11-16'), true, 'lotada no colegiado');
    assert.equal(veSessoes({ ...base, uid: 'ana', minhasUnidades: ['u2'] }, '2026-11-16'), false, 'lotada fora');
    assert.equal(veSessoes({ ...base, uid: 'ana', isAdmin: true }, '2026-11-16'), true);
    assert.equal(veSessoes({ ...base, uid: 'eva' }, '2026-11-16', 's'), false, 'filtro por órgão');
    assert.equal(veSessoes({ ...base, orgaos: [orgaos[1]], isAdmin: true }, '2026-11-16'), false, 'sem colegiado, sem aba');
    const ss = [
        { id: '1', data: '2026-11-10', situacao: 'publicada' }, { id: '2', data: '2026-11-20', situacao: 'publicada', componho: true },
        { id: '3', data: '2026-11-25', situacao: 'rascunho' }, { id: '4', data: '2026-11-30', situacao: 'cancelada' },
    ];
    const g = agruparSessoes(ss, '2026-11-16');
    assert.deepEqual([g.minhas, g.proximas, g.rascunhos, g.passadas].map((l) => l.map((x) => x.id)), [['2'], [], ['3'], ['4', '1']]);
});
