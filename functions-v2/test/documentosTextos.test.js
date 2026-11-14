// Etapa 4: documento exigido (assinaturas e portal), abertura da certidão, botão e explicação da fase.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const x = require('../lib/shared/exigencias');
const s = require('../lib/shared/secretaria');

test('exigência: assinaturas, atribuição e portal saneados; documento de fora não se assina', () => {
    assert.deepEqual(x.sanitizeExigencia({ descricao: 'Decisão', forma: 'redigir', assinaturas: 9, assinatura_atribuicao: ' Promotor ', partes: false }),
        { descricao: 'Decisão', forma: 'redigir', partes: false, assinaturas: 5, assinatura_atribuicao: 'Promotor' });
    assert.deepEqual(x.sanitizeExigencia({ descricao: 'Defesa', forma: 'juntar', assinaturas: 2, assinatura_atribuicao: 'X' }), { descricao: 'Defesa', forma: 'juntar' });
    // Fora dos autos já não vai às partes: a marca é desnecessária. Valor estranho também não liga nada.
    assert.equal(x.sanitizeExigencia({ descricao: 'Nota', destino: 'informacao', partes: false }).partes, undefined);
    assert.equal(x.sanitizeExigencia({ descricao: 'Nota', partes: 'nao', assinaturas: -1 }).partes, undefined);
    assert.equal(x.sanitizeExigencia({ descricao: 'Nota', assinaturas: 'abc' }).assinaturas, undefined);
});

test('reconhecer: assinaturas e atribuição exigidas', () => {
    const pend = [{ chave: 'd0', descricao: 'Decisão da comissão', forma: 'qualquer', tipo: 'Decisão', assinaturas: 2, assinatura_atribuicao: 'Presidente da comissão' }];
    const doc = { origem: 'editor', tipo: 'Decisão' };
    // Sozinho: não reconhece sem as assinaturas; reconhece com elas (atribuição sem acento e caixa).
    assert.deepEqual(x.reconhecer(pend, { ...doc, assinaturas: 1, atribuicoes: ['Presidente da Comissão'] }), []);
    assert.deepEqual(x.reconhecer(pend, { ...doc, assinaturas: 2, atribuicoes: ['Membro'] }), []);
    assert.deepEqual(x.reconhecer(pend, { ...doc, assinaturas: 2, atribuicoes: ['Membro', 'presidente da comissao'] }), ['d0']);
    // Marcada por quem junta: diz o que falta.
    assert.throws(() => x.reconhecer(pend, { ...doc, assinaturas: 1 }, ['d0']), /pede 2 assinaturas/);
    assert.throws(() => x.reconhecer(pend, { ...doc, assinaturas: 3, atribuicoes: [] }, ['d0']), /atribuição Presidente da comissão/);
    assert.deepEqual(x.reconhecer(pend, { ...doc, assinaturas: 2, atribuicoes: ['Presidente da comissão'] }, ['d0']), ['d0']);
    // Exigência sem as opções: como antes (sem contar assinatura).
    assert.deepEqual(x.reconhecer([{ chave: 'd1', descricao: 'Parecer', forma: 'qualquer', tipo: 'Parecer' }], { origem: 'upload', tipo: 'Parecer' }), ['d1']);
    // Petição da parte não tem assinatura na plataforma: não cumpre a que pede.
    assert.deepEqual(x.reconhecer(pend, { origem: 'upload', tipo: 'Decisão', peticao: true }), []);
    assert.equal(x.faltaAssinatura({ descricao: 'D', assinaturas: 1 }, { assinaturas: 0 }), '"D" pede o documento assinado antes de juntar');
});

test('certidão: frase de abertura do grupo, saneada e usada no texto e no limite da folha', () => {
    const r = s.sanitizeRito({ nome: 'R', fases: [
        { id: 'a', nome: 'A', acoes: ['X'], certidao: { abertura: '  Certifico,   para os devidos fins, que:  ' } },
        { id: 'b', nome: 'B', acoes: ['Y'], certidao: { grupo: 'a', abertura: 'Outra' } },
        { id: 'c', nome: 'C', acoes: ['Z'], certidao: { abertura: x.ABERTURA_CERTIDAO } },
    ] });
    const [a, b, c] = r.fases;
    assert.equal(a.certidao.abertura, 'Certifico, para os devidos fins, que:');
    assert.equal(c.certidao, undefined, 'a frase padrão não se grava');
    assert.equal(x.aberturaCertidao(r.fases, a.id), 'Certifico, para os devidos fins, que:');
    assert.equal(b.certidao.abertura, 'Outra');
    assert.equal(x.aberturaCertidao(r.fases, c.id), x.ABERTURA_CERTIDAO);
    const itens = [{ seq: 1, fase_id: 'a', texto: 'Feito', autor: '', em: '', partes: true }];
    assert.equal(x.textoCertidao(itens, x.aberturaCertidao(r.fases, a.id)), 'Certifico, para os devidos fins, que: 1) Feito.');
    assert.equal(x.textoCertidao(itens), 'Certifico que foram cumpridos os seguintes atos: 1) Feito.');
    const longo = 'L'.repeat(x.MAX_ABERTURA_CERTIDAO);
    const grande = [{ ...itens[0], texto: 'T'.repeat(1640) }];
    assert.equal(x.cabeNaCertidao(grande, itens[0]), true);
    assert.equal(x.cabeNaCertidao(grande, itens[0], longo), false, 'a abertura longa conta no limite da folha');
});

test('fase: nome do botão (não na final) e explicação para as partes', () => {
    const r = s.sanitizeRito({ nome: 'R', fases: [
        { nome: 'Instrução', acoes: ['X'], rotulo_concluir: '  Enviar ao relator  ', explicacao_publica: 'Você pode apresentar provas.' },
        { nome: 'Fim', final: true, rotulo_concluir: 'Encerrar', explicacao_publica: 'E'.repeat(500) },
    ] });
    assert.equal(r.fases[0].rotulo_concluir, 'Enviar ao relator');
    assert.equal(r.fases[0].explicacao_publica, 'Você pode apresentar provas.');
    assert.equal(r.fases[1].rotulo_concluir, undefined);
    assert.equal(r.fases[1].explicacao_publica.length, s.MAX_EXPLICACAO_PUBLICA);
    const antigo = s.sanitizeRito({ nome: 'R', fases: [{ nome: 'F', acoes: ['A'] }] }).fases[0];
    assert.equal('rotulo_concluir' in antigo || 'explicacao_publica' in antigo, false, 'rito sem as opções fica como era');
});
