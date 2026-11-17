// npm run test:lib
// Importar listas do órgão de um arquivo: o que entra na prévia e a mescla.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesclar, mimeDoArquivo, resumo } from './listasImportar.js';

test('importar de arquivo: já existe, repetido, limite e mescla', () => {
    const listas = { comunicacao: [{ id: 'o_edital', nome: 'Edital', m: true }], origem: [] };
    const sistema = { comunicacao: ['Intimação'], audiencia: [], origem: ['Ofício'] };
    const itens = [
        { lista: 'comunicacao', nome: 'EDITAL', incluir: true }, { lista: 'comunicacao', nome: 'intimacao', incluir: true },
        { lista: 'comunicacao', nome: 'Convocação', incluir: true }, { lista: 'comunicacao', nome: 'Convocação', incluir: true },
        { lista: null, nome: 'Solto', incluir: true }, { lista: 'origem', nome: 'Ouvidoria', m: true, incluir: true }, { lista: 'origem', nome: 'Desmarcado', incluir: false },
    ];
    const r = resumo(itens, listas, sistema);
    assert.deepEqual(r.sit, ['existe', 'existe', 'ok', 'repetido', 'sem_lista', 'ok', 'ok']);
    assert.equal(r.total, 2);
    assert.deepEqual(r.estouro, []);
    assert.deepEqual(mesclar(listas, r.entram), { comunicacao: [...listas.comunicacao, { nome: 'Convocação' }], origem: [{ nome: 'Ouvidoria' }] }, 'origem sem gênero');
    const cheio = { origem: Array.from({ length: 30 }, (_, i) => ({ nome: `O${i}` })) };
    assert.deepEqual(resumo([{ lista: 'origem', nome: 'Nova', incluir: true }], cheio, sistema).estouro, ['origem']);
    assert.equal(mimeDoArquivo('Listas.XLSX'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.equal(mimeDoArquivo('foto.png'), null);
});
