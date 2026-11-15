import test from 'node:test';
import assert from 'node:assert/strict';
import { ESTRUTURAS, composicaoEm, descendentes, emArvore, membrosDoJulgamento, orgaosDoDelegado, problemasComposicao, problemasEstrutura, unidadeComOrgao, unidadesDoOrgao } from './orgaos.js';

test('colegiado: quem compõe na data, conflitos e membros que já vêm no registro de julgamento', () => {
    const composicao = [
        { uid: 'davi', funcao: 'suplente', inicio: '', fim: '' },
        { uid: 'ana', funcao: 'presidente', inicio: '2025-01-01', fim: '2026-06-30' },
        { uid: 'bia', funcao: 'presidente', inicio: '2026-07-01', fim: '' },
        { uid: 'caio', funcao: 'titular', inicio: '', fim: '' },
        { uid: 'eva', funcao: 'titular', inicio: '', fim: '' },
    ];
    assert.deepEqual(composicaoEm(composicao, '2026-03-01').map((m) => m.uid), ['ana', 'caio', 'eva', 'davi']);
    assert.deepEqual(problemasComposicao(composicao), []);
    const nome = (u) => u.toUpperCase();
    assert.deepEqual(problemasComposicao([...composicao, { uid: 'eva', funcao: 'presidente', inicio: '2026-01-01', fim: '' }], nome),
        ['Há dois presidentes no mesmo período (ANA e EVA).', 'Há dois presidentes no mesmo período (BIA e EVA).', 'EVA aparece duas vezes no mesmo período.']);
    assert.deepEqual(problemasComposicao([{ uid: 'ana', inicio: '2026-05-01', fim: '2026-04-01' }], nome), ['O mandato de ANA termina antes de começar.']);
    const estado = {
        orgaos: [{ id: 'cam', decisao: 'colegiada', composicao }, { id: 'pres', decisao: 'singular', composicao }],
        unidades: [{ id: 'sec', orgao_id: 'cam' }, { id: 'gab', orgao_id: 'pres' }, { id: 'solta', orgao_id: null }],
        membros: [{ uid: 'bia', nome: 'Bia' }, { uid: 'caio', nome: 'Caio' }, { uid: 'davi', nome: 'Davi' }],
    };
    assert.deepEqual(membrosDoJulgamento(estado, 'sec', '2026-08-01'), [{ nome: 'Bia', funcao: 'presidente', voto: '' }, { nome: 'Caio', funcao: 'membro', voto: '' }],
        'presidente e titulares do dia; suplente e quem saiu da entidade ficam de fora');
    assert.deepEqual(membrosDoJulgamento(estado, 'gab', '2026-08-01'), [], 'órgão singular não preenche');
    assert.deepEqual(membrosDoJulgamento(estado, 'solta', '2026-08-01'), []);
});

test('admin delegado vê só o que administra, a partir do órgão delegado; o admin vê tudo', () => {
    const orgaos = [{ id: 'pres', pai_id: null }, { id: 'dir', pai_id: 'pres' }, { id: 'setor', pai_id: 'dir' }, { id: 'cons', pai_id: null }];
    assert.equal(orgaosDoDelegado({ isAdmin: true, orgaos }), null);
    const v = orgaosDoDelegado({ isAdmin: false, orgaos, adminOrgaos: ['dir', 'setor'] });
    assert.deepEqual(v.map((o) => [o.id, o.nivel, o.raiz, o.pai_id]), [['dir', 1, true, 'pres'], ['setor', 2, false, 'dir']]);
    assert.deepEqual(orgaosDoDelegado({ isAdmin: false, orgaos }), []);
});

test('organograma: subordinados logo abaixo; superior sumido vai para o primeiro nível', () => {
    const l = [{ id: 'c', pai_id: 'b' }, { id: 'a', pai_id: null }, { id: 'b', pai_id: 'a' }, { id: 'x', pai_id: 'sumiu' }];
    assert.deepEqual(emArvore(l).map((o) => `${o.nivel}${o.id}`), ['1a', '2b', '3c', '1x']);
    assert.deepEqual([...descendentes(l, 'a')].sort(), ['a', 'b', 'c']);
});

test('unidade com o órgão e unidades do assistente', () => {
    const estado = { orgaos: [{ id: 'p', nome: 'Presidência' }], unidades: [{ id: 'u', nome: 'Gabinete', orgao_id: 'p' }, { id: 's', nome: 'Protocolo', orgao_id: null }] };
    assert.equal(unidadeComOrgao(estado, 'u'), 'Presidência › Gabinete');
    assert.equal(unidadeComOrgao(estado, 's'), 'Protocolo');
    assert.equal(unidadeComOrgao(estado, 'nada'), '—');
    assert.equal(unidadeComOrgao({ ...estado, unidades_excluidas: [{ id: 'velha', nome: 'Assessoria antiga' }] }, 'velha'), 'Assessoria antiga (excluída)');
    assert.deepEqual(unidadesDoOrgao({ nome: 'Presidência', sigla: 'PRES', unidades: { secretaria: true, assessoria: true } }).map((u) => u.nome), ['Secretaria (PRES)', 'Assessoria (PRES)']);
});

test('estruturas de exemplo são válidas; problemas apontam nome vazio e repetido', () => {
    for (const e of ESTRUTURAS.filter((x) => x.id !== 'branco')) {
        assert.deepEqual(problemasEstrutura(e.orgaos), [], e.id);
        for (const o of e.orgaos) assert.ok(!o.pai_chave || e.orgaos.some((x) => x.chave === o.pai_chave), `${e.id}: ${o.nome}`);
    }
    assert.deepEqual(problemasEstrutura([{ nome: ' ', pai_chave: null }]), ['Há órgão sem nome.']);
    assert.equal(problemasEstrutura([{ nome: 'A', pai_chave: null }, { nome: 'a', pai_chave: null }]).length, 1);
});
