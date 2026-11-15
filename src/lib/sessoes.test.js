// npm run test:lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparSessoes, juntarNomes, ordemDoCPC, selosDosPedidos, ondeSessao, problemasDaSessao, quandoSessao, situacaoDaVotacao, textoAntecedencia, textoDaVistaNaPauta, textoDoVoto, veSessoes } from './sessoes.js';

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
    assert.equal(textoDoVoto({ modo: 'diverge', resultado: 'Improcedente' }), 'Diverge: Improcedente');
    assert.equal(situacaoDaVotacao({ votacao: { liberado: true, votaram: 1, vogais: 2 } }), '1 de 2 vogais votaram');
    assert.equal(situacaoDaVotacao({ votacao: { liberado: true, aguarda_meu_voto: true } }), 'Aguarda o seu voto');
    assert.equal(situacaoDaVotacao({ relator_nome: 'Ana', votacao: { liberado: false } }), 'Voto do relator a liberar');
    const g = agruparSessoes(ss, '2026-11-16');
    assert.deepEqual([g.minhas, g.proximas, g.rascunhos, g.passadas].map((l) => l.map((x) => x.id)), [['2'], [], ['3'], ['4', '1']]);
});

test('sessões: vista na pauta (S5)', () => {
    assert.equal(juntarNomes(['Ana', 'Bruno', 'Carla']), 'Ana, Bruno e Carla');
    assert.equal(textoDaVistaNaPauta({ nomes: ['Ana'], prazo: '2026-11-26' }), 'Vista: Ana, até 26/11/2026.');
    assert.equal(textoDaVistaNaPauta({ nomes: ['Ana', 'Bruno'], prazo: '2026-11-26', devolvida: true }), 'Vista de Ana e Bruno, devolvida.');
    assert.equal(situacaoDaVotacao({ situacao: 'vista', votacao: { liberado: true } }), 'Julgamento suspenso pela vista');
    assert.equal(situacaoDaVotacao({ situacao: 'adiado', votacao: { liberado: true } }), '');
});

test('sessões: virtual assíncrona, pedidos e ordem do CPC (S7)', () => {
    const v = { modo: 'assincrona', data: '2026-12-07', hora: '09:00', fim: '2026-12-14' };
    assert.equal(quandoSessao(v), 'votação virtual de 07/12/2026 (a partir das 09:00) a 14/12/2026');
    assert.equal(ondeSessao(v), 'em sessão virtual');
    assert.deepEqual(problemasDaSessao(v, '2026-12-01'), []);
    assert.deepEqual(problemasDaSessao({ ...v, fim: '' }, '2026-12-01'), ['Informe o último dia da votação.']);
    assert.deepEqual(problemasDaSessao({ ...v, fim: '2027-01-30' }, '2026-12-01'), ['A votação virtual dura no máximo 30 dias.']);
    assert.equal(agruparSessoes([{ ...v, situacao: 'publicada', componho: true }], '2026-12-10').minhas.length, 1);
    assert.deepEqual(selosDosPedidos({ sustentacao: 2, preferencia: 1, destaque: 1, esclarecimento: 0 }), ['2 sustentações orais', 'Preferência', 'Destaque pedido']);
    const it = (id, ordem, extra = {}) => ({ processo_id: id, ordem, situacao: 'pautado', ...extra });
    assert.deepEqual(ordemDoCPC([
        it('a', 1), it('b', 2, { continua: true }), it('c', 3, { pedidos: { preferencia: 1 } }), it('d', 4, { situacao: 'retirado', pedidos: { sustentacao: 1 } }), it('e', 5, { pedidos: { sustentacao: 1 } }),
    ]), ['e', 'c', 'b', 'a', 'd']);
});
