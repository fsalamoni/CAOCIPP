import test from 'node:test';
import assert from 'node:assert/strict';
import { ESTRUTURAS, descendentes, emArvore, orgaosDoDelegado, problemasEstrutura, unidadeComOrgao, unidadesDoOrgao } from './orgaos.js';

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
