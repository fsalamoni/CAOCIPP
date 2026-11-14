// Impressão interna: o que pode ser marcado e o pedido ao servidor. npm run test:lib
import test from 'node:test';
import assert from 'node:assert/strict';
import { itensInternos, rotuloDocumentoInterno, selecaoInterna, totalMarcado } from './impressaoInterna.js';

const movimentos = [
    { seq: 1, origem: 'usuario', titulo: 'Termo de autuação' },
    { seq: 2, origem: 'interno', titulo: 'Remessa (registro interno)', dados: { interno: true, fora_impressao: true } },
    { seq: 3, origem: 'sistema', titulo: 'Atribuição' },
    { seq: 4, origem: 'interno', titulo: 'Registro', dados: { interno: true, oculto: true } },
    { seq: 5, origem: 'usuario', titulo: 'Termo de juntada' },
];
const documentos = [
    { id: 'm', status: 'minuta', titulo: 'Parecer', versoes: 1 },
    { id: 'c', status: 'controle', titulo: 'Rascunho de cálculo', versoes: 0 },
    { id: 'j', status: 'juntado', ordem: 1, titulo: 'Resposta', versoes: 2 },
    { id: 'k', status: 'juntado', ordem: 2, titulo: 'Anexo', versoes: 0 },
];

test('impressão interna: só o que fica fora dos autos pode ser marcado', () => {
    const it = itensInternos(movimentos, documentos);
    assert.deepEqual(it.registros.map((m) => m.seq), [2, 3], 'atos dos autos e registros ocultos ficam de fora');
    assert.deepEqual(it.documentos.map((d) => d.id), ['m', 'c']);
    assert.deepEqual(it.soVersoes.map((d) => d.id), ['j'], 'da peça dos autos, só as redações anteriores');
    assert.deepEqual(documentos.map(rotuloDocumentoInterno), ['Minuta', 'Guardado fora dos autos', 'Doc. nº 1 dos autos', 'Doc. nº 2 dos autos']);
    assert.deepEqual(itensInternos(null, null), { registros: [], documentos: [], soVersoes: [] });
});

test('impressão interna: o pedido leva só o que foi marcado e existe', () => {
    const it = itensInternos(movimentos, documentos);
    const s = selecaoInterna(new Set(['r:2', 'r:1', 'r:4', 'd:m', 'v:m', 'v:j', 'v:c', 'd:j']), it);
    assert.deepEqual(s, { registros: [2], documentos: ['m'], versoes: ['m', 'j'] });
    assert.equal(totalMarcado(s), 4);
    assert.equal(totalMarcado(selecaoInterna(new Set(), it)), 0);
});
