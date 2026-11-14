// npm run test:lib
// Etapa 4: o que a tela sugere e mostra do documento exigido, a abertura da certidão e os textos da fase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABERTURA_CERTIDAO, aberturaCertidao, exigeDoDocumento, sugeridas } from './exigencias.js';
import { deRito, montarPayload } from './propostaRito.js';

test('juntada sugere a exigência só com as assinaturas pedidas (a de "assinar antes" conta)', () => {
    const pend = [{ chave: 'd0', descricao: 'Decisão', forma: 'qualquer', tipo: 'Decisão', assinaturas: 2 }, { chave: 'd1', descricao: 'Parecer', forma: 'qualquer', tipo: 'Parecer' }];
    assert.deepEqual(sugeridas(pend, { origem: 'editor', tipo: 'Decisão', assinaturas: [{ uid: 'a' }] }), []);
    assert.deepEqual(sugeridas(pend, { origem: 'editor', tipo: 'Decisão', assinaturas: [{ uid: 'a' }], n_assinaturas: 2 }), ['d0']);
    assert.deepEqual(sugeridas(pend, { origem: 'editor', tipo: 'Parecer' }), ['d1']);
});

test('o que a exigência pede do documento, numa linha', () => {
    assert.equal(exigeDoDocumento({ descricao: 'X' }), '');
    assert.equal(exigeDoDocumento({ assinaturas: 1 }), 'Assinado');
    assert.equal(exigeDoDocumento({ assinaturas: 3, assinatura_atribuicao: 'Presidente', partes: false }), '3 assinaturas · uma assinatura de Presidente · fica fora do portal das partes');
});

test('abertura da certidão: a da fase que reúne o grupo, igual ao servidor', () => {
    const fases = [{ id: 'a', nome: 'A', certidao: { abertura: 'Certifico que:' } }, { id: 'b', nome: 'B', certidao: { grupo: 'a' } }, { id: 'c', nome: 'C' }];
    assert.equal(aberturaCertidao(fases, 'a'), 'Certifico que:');
    assert.equal(aberturaCertidao(fases, 'c'), ABERTURA_CERTIDAO);
});

test('o editor manda ao servidor o botão e a explicação da fase', () => {
    const p = deRito({ id: 'r', nome: 'R', fases: [{ id: 'a', nome: 'A', rotulo_concluir: 'Enviar ao relator', explicacao_publica: 'Pode juntar provas.' }, { id: 'b', nome: 'Fim', final: true }] });
    const f = montarPayload(p, { criar: false, nome: '', sigla: '' }).rito.fases[0];
    assert.equal(f.rotulo_concluir, 'Enviar ao relator');
    assert.equal(f.explicacao_publica, 'Pode juntar provas.');
});
