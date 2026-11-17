import test from 'node:test';
import assert from 'node:assert/strict';
import { BRANDING_PADRAO, mesclarBranding, contrasteComBranco, precisaAceitarTermos } from './platformBranding.js';

test('sem documento salvo, vale o padrão', () => {
    const b = mesclarBranding(undefined);
    assert.equal(b.nome_curto, 'SIGO');
    assert.equal(b.cor, BRANDING_PADRAO.cor);
    assert.equal(b.termos, null);
});

test('campo vazio volta ao padrão; preenchido vale', () => {
    const b = mesclarBranding({ nome_curto: 'CAO', nome_completo: '  ', inicio: { titulo: 'Bem-vindo' } });
    assert.equal(b.nome_curto, 'CAO');
    assert.equal(b.nome_completo, BRANDING_PADRAO.nome_completo);
    assert.equal(b.inicio.titulo, 'Bem-vindo');
    assert.equal(b.inicio.subtitulo, BRANDING_PADRAO.inicio.subtitulo);
});

test('contraste com o branco', () => {
    assert.ok(contrasteComBranco('#33495C') >= 4.5);
    assert.ok(contrasteComBranco('#FFD966') < 4.5);
    assert.equal(contrasteComBranco('azul'), 0);
});

test('aceite dos termos só quando exigido e a versão aceita é antiga', () => {
    const termos = (exigir_aceite) => ({ termos: { versao: 2, exigir_aceite } });
    assert.equal(precisaAceitarTermos(termos(true), {}), true);
    assert.equal(precisaAceitarTermos(termos(true), { termos_versao_aceita: 1 }), true);
    assert.equal(precisaAceitarTermos(termos(true), { termos_versao_aceita: 2 }), false);
    assert.equal(precisaAceitarTermos(termos(false), {}), false);
    assert.equal(precisaAceitarTermos({ termos: null }, {}), false);
});
