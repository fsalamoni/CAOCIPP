// "Vem do processo": ação da fase cumprida pelo campo do processo, condição
// "preenchido / vazio" e a volta (ação cumprida à mão preenche o campo vazio).
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const x = require('../lib/shared/exigencias');
const d = require('../lib/shared/doProcesso');

const fase = (acoes, regras) => ({ id: 'rec', nome: 'Recebimento', acoes, acoes_regras: regras });
const campos = [
    { id: 'pgea', tipo: 'texto', rotulo: 'Número do PGEA', valor: '01234.000.567/2026' },
    { id: 'sistema', tipo: 'lista', rotulo: 'Sistema', valor: 'SIM' },
    { id: 'chegada', tipo: 'data', rotulo: 'Data de chegada', valor: '2026-11-16' },
];

test('o servidor guarda a ligação só onde ela faz sentido', () => {
    const rito = s.sanitizeRito({
        nome: 'R', fases: [{
            id: 'a', nome: 'A',
            acoes: ['Registrar o PGEA', 'Juntar o ofício', 'Dados básicos', 'Conferir', 'Ler'],
            acoes_regras: [
                { pede: 'texto', do_processo: 'pgea' },
                { documento: { forma: 'qualquer' }, do_processo: 'pgea' },
                { pede: 'formulario', campos: [{ id: 'orgao', rotulo: 'Órgão', tipo: 'texto' }, { id: 'quando', rotulo: 'Quando', tipo: 'data' }],
                    do_processo_campos: { orgao: 'orgao_sol', quando: 'chegada', fantasma: 'x' } },
                { do_processo: '@assunto' },
                { pede: 'orientacao', do_processo: 'pgea' },
            ],
        }, { id: 'b', nome: 'B' }],
    });
    const r = rito.fases[0].acoes_regras;
    assert.equal(r[0].do_processo, 'pgea');
    assert.equal(r[1].do_processo, undefined, 'documento não vem do processo');
    assert.deepEqual(r[2].do_processo_campos, { orgao: 'orgao_sol', quando: 'chegada' }, 'só campos que existem no formulário');
    assert.equal(r[3].do_processo, '@assunto', 'campo padrão do Novo processo');
    assert.equal(r[4].do_processo, undefined, 'orientação não se cumpre');
});

test('valor pelo processo: tipo que combina, opção que existe, formulário completo', () => {
    assert.equal(d.valorPeloProcesso({ pede: 'texto', do_processo: 'pgea' }, campos), '01234.000.567/2026');
    assert.equal(d.valorPeloProcesso({ do_processo: 'pgea' }, campos), true, 'só confirmar: basta estar preenchido');
    assert.equal(d.valorPeloProcesso({ pede: 'numero', do_processo: 'pgea' }, campos), undefined, 'texto não vira número');
    assert.equal(d.valorPeloProcesso({ pede: 'lista', opcoes: ['SPU', 'E-mail'], do_processo: 'sistema' }, campos), undefined, 'opção que a ação não tem');
    assert.equal(d.valorPeloProcesso({ pede: 'lista', opcoes: ['SIM', 'SPU'], do_processo: 'sistema' }, campos), 'SIM');
    assert.equal(d.valorPeloProcesso({ pede: 'texto', do_processo: 'vazio' }, campos), undefined);
    const form = { pede: 'formulario', campos: [{ id: 'q', tipo: 'data', obrigatorio: true }, { id: 'obs', tipo: 'texto' }], do_processo_campos: { q: 'chegada' } };
    assert.deepEqual(d.valorPeloProcesso(form, campos), { q: '2026-11-16' }, 'campo opcional sem ligação fica vazio');
    const faltando = { ...form, campos: [...form.campos, { id: 'orgao', tipo: 'texto', obrigatorio: true }] };
    assert.equal(d.valorPeloProcesso(faltando, campos), undefined, 'obrigatório sem valor: fica para a equipe');
    assert.equal(d.valorPeloProcesso({ pede: 'texto', do_processo: '@assunto' }, d.camposParaLigar({ assunto: ' Licitação ' })), 'Licitação');
});

test('passos: cumpre, não refaz o que foi desfeito à mão, desfaz quando apaga, refaz quando muda', () => {
    const f = fase(['Converter em PGEA', 'Registrar o PGEA'], [null, { pede: 'texto', do_processo: 'pgea', obrigatoria: true }]);
    const sempre = () => true;
    assert.deepEqual(d.passosPeloProcesso(f, campos, [], {}, [], sempre), [{ idx: 1, feita: true, valor: '01234.000.567/2026' }]);
    assert.deepEqual(d.passosPeloProcesso(f, campos, [], {}, [1], sempre), [], 'desfeita à mão: o sistema não refaz na rodada');
    assert.deepEqual(d.passosPeloProcesso(f, campos, [], {}, [], () => false), [], 'ação que não vale agora');
    const chave = d.chaveDoValor('01234.000.567/2026');
    assert.deepEqual(d.passosPeloProcesso(f, campos, [1], { 1: chave }, [], sempre), [], 'cumprida e igual: nada');
    assert.deepEqual(d.passosPeloProcesso(f, campos, [1], {}, [], sempre), [], 'cumprida à mão: o sistema não mexe');
    const apagado = campos.filter((c) => c.id !== 'pgea');
    assert.deepEqual(d.passosPeloProcesso(f, apagado, [1], { 1: chave }, [], sempre), [{ idx: 1, feita: false }]);
    const mudou = [{ ...campos[0], valor: 'outro' }];
    assert.deepEqual(d.passosPeloProcesso(f, mudou, [1], { 1: chave }, [], sempre), [{ idx: 1, feita: false }], 'mudou: desfaz para cumprir de novo');
});

test('volta: a ação cumprida à mão preenche o campo vazio do mesmo tipo, nunca sobrescreve', () => {
    const defs = [{ id: 'pgea', tipo: 'texto', rotulo: 'Número do PGEA' }, { id: 'chegada', tipo: 'data', rotulo: 'Chegada' }];
    assert.deepEqual(d.camposPelaAcao({ pede: 'texto', do_processo: 'pgea' }, '123', [], defs).map((c) => [c.def.id, c.valor]), [['pgea', '123']]);
    assert.deepEqual(d.camposPelaAcao({ pede: 'texto', do_processo: 'pgea' }, '123', campos, defs), [], 'já preenchido');
    assert.deepEqual(d.camposPelaAcao({ pede: 'numero', do_processo: 'pgea' }, 5, [], defs), [], 'tipos diferentes');
    assert.deepEqual(d.camposPelaAcao({ pede: 'texto', do_processo: '@assunto' }, 'x', [], defs), [], 'assunto se corrige pela retificação');
    const form = { pede: 'formulario', campos: [{ id: 'q', tipo: 'data' }], do_processo_campos: { q: 'chegada' } };
    assert.deepEqual(d.camposPelaAcao(form, { q: '2026-01-02' }, [], defs).map((c) => [c.def.id, c.valor]), [['chegada', '2026-01-02']]);
});

test('condição "preenchido / vazio" num campo do processo', () => {
    const rito = s.sanitizeRito({
        nome: 'R', fases: [{
            id: 'a', nome: 'A', acoes: ['Converter em PGEA', 'Registrar o PGEA'],
            acoes_regras: [{ obrigatoria: true, se: { acao: -1, dado: 'campo:pgea', valores: ['@vazio'], rotulo: 'Número do PGEA' } }, { pede: 'texto', do_processo: 'pgea' }],
        }, { id: 'b', nome: 'B' }],
    });
    const f = rito.fases[0];
    assert.deepEqual(f.acoes_regras[0].se.valores, ['@vazio']);
    const sem = x.respostasDaFase({ fase_atual: 'a', campos: [] });
    const com = x.respostasDaFase({ fase_atual: 'a', campos: [campos[0]] });
    assert.equal(x.acaoAtiva(f, 0, sem), true, 'sem PGEA: a conversão é cobrada');
    assert.equal(x.acaoAtiva(f, 0, com), false, 'com PGEA: dispensada');
    assert.deepEqual(x.acoesObrigatoriasPendentes(f, [], com), [], 'não impede a fase');
    assert.match(x.textoDaCondicao(f, f.acoes_regras[0].se), /"Número do PGEA" estiver vazio/);
    const multi = x.respostasDaFase({ fase_atual: 'a', campos: [{ id: 'm', valor: ['a'] }] });
    assert.equal(x.valorAtende({ acao: -1, dado: 'campo:m', valores: ['@preenchido'] }, multi['@campo:m']), true);
});

test('documento detalhado ao entrar: do que se trata e a data dele vão ao registro', () => {
    const { descritivos, textoDescritivo } = require('../lib/secretaria/documentos');
    assert.deepEqual(descritivos({ descricao: ' Ofício do solicitante ', data_documento: '2026-11-10' }, '2026-11-16'), { descricao: 'Ofício do solicitante', data_documento: '2026-11-10' });
    assert.deepEqual(descritivos({}, '2026-11-16'), {});
    assert.throws(() => descritivos({ data_documento: '2026-11-17' }, '2026-11-16'), /futura/);
    assert.throws(() => descritivos({ data_documento: '2026-02-30' }, '2026-11-16'), /inválida/);
    assert.equal(textoDescritivo({ descricao: 'Prova do pagamento.', data_documento: '2026-11-10' }), ' Documento datado de 10/11/2026. Do que se trata: Prova do pagamento.');
    assert.equal(textoDescritivo({}), '');
});

test('a ligação é zerada ao entrar de novo na fase', () => {
    const out = x.camposAoEntrarNaFase({ acoes_auto: { a: { 1: '"x"' }, b: {} }, acoes_auto_off: { a: [0] } }, 'a');
    assert.deepEqual(out.acoes_auto, { b: {} });
    assert.deepEqual(out.acoes_auto_off, {});
});
