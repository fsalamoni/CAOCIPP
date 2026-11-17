// Identidade da plataforma: validação do que o painel envia. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const { validarIdentidade, contrasteComBranco } = require('../lib/platform/branding');

const base = { nome_curto: 'SIGO', nome_completo: 'Sistema Interno de Gestão Operacional', cor: '#33495C' };

test('aceita a identidade padrão e normaliza campos vazios', () => {
    const r = validarIdentidade(base);
    assert.equal(r.nome_curto, 'SIGO');
    assert.equal(r.logo, null);
    assert.deepEqual(r.suporte, { email: '', telefone: '', site: '' });
});

test('contraste: cor clara demais é recusada, escura passa', () => {
    assert.ok(contrasteComBranco('#33495C') > 4.5);
    assert.ok(contrasteComBranco('#FFFF00') < 2);
    assert.throws(() => validarIdentidade({ ...base, cor: '#FFD966' }), /clara demais/);
    assert.throws(() => validarIdentidade({ ...base, cor: 'azul' }), /#RRGGBB/);
});

test('logo só como imagem rasterizada em data URL e com limite de tamanho', () => {
    assert.ok(validarIdentidade({ ...base, logo: 'data:image/png;base64,iVBORw0KGgo=' }).logo);
    assert.throws(() => validarIdentidade({ ...base, logo: 'data:image/svg+xml;base64,PHN2Zz4=' }), /Logo/);
    assert.throws(() => validarIdentidade({ ...base, logo: 'https://exemplo.com/logo.png' }), /Logo/);
    assert.throws(() => validarIdentidade({ ...base, logo: `data:image/png;base64,${'A'.repeat(310000)}` }), /Logo/);
});

test('nomes obrigatórios, limites de texto, e-mail e site de suporte', () => {
    assert.throws(() => validarIdentidade({ ...base, nome_curto: ' ' }), /Nome curto/);
    assert.throws(() => validarIdentidade({ ...base, nome_curto: 'x'.repeat(21) }), /até 20/);
    assert.throws(() => validarIdentidade({ ...base, suporte: { email: 'sem-arroba' } }), /E-mail/);
    assert.throws(() => validarIdentidade({ ...base, suporte: { site: 'http://inseguro.com' } }), /https/);
    assert.equal(validarIdentidade({ ...base, suporte: { site: 'https://mprs.mp.br' } }).suporte.site, 'https://mprs.mp.br');
});
