// Certidão conjunta da fase (ou do grupo de fases). Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const x = require('../lib/shared/exigencias');
const s = require('../lib/shared/secretaria');
const a = require('../lib/shared/autos');
const { registrarMovimento } = require('../lib/secretaria/context');

const fases = [
    { id: 'a', nome: 'Análise', certidao: { titulo: 'Certidão da análise' } },
    { id: 'b', nome: 'Diligências', certidao: { grupo: 'a', incluir_mudancas: true } },
    { id: 'c', nome: 'Decisão' },
];

test('consolidar: aceito só em ação; partes veem até a confirmação simples', () => {
    const r = x.sanitizeRegras({ registro_atos: { fase: 'consolidar' }, acoes_regras: [{ destino: 'consolidar', partes: true }] }, ['Conferir']);
    assert.deepEqual(r.acoes_regras[0], { destino: 'consolidar', partes: true });
    assert.equal(r.registro_atos, undefined, 'entrada e saída da fase não vão para a certidão conjunta');
    assert.equal(x.destinoDaAcao({ destino: 'consolidar' }), 'consolidar');
    assert.equal(x.partesVeem({ destino: 'consolidar', partes: true }), true);
});

test('grupo, título e quando emitir', () => {
    assert.equal(x.grupoDe(fases[1]), 'a');
    assert.equal(x.grupoDe(fases[2]), 'c');
    assert.equal(x.tituloCertidao(fases, 'a'), 'Certidão da análise');
    assert.equal(x.tituloCertidao(fases, 'c'), 'Certidão da fase Decisão');
    assert.equal(x.tituloCertidao([{ id: 'p', nome: 'P' }, { id: 'q', nome: 'Q', certidao: { grupo: 'p' } }], 'p'), 'Certidão das fases P, Q');
    assert.equal(x.mudancaNaCertidao(fases, 'a', 'b'), true);
    assert.equal(x.mudancaNaCertidao(fases, 'b', 'c'), false);
    const c = { grupo: 'a', itens: [{ seq: 3, fase_id: 'a', texto: 't', autor: 'X', em: '', partes: true }] };
    assert.equal(x.deveEmitir(fases, c, 'a', 'b'), false, 'dentro do grupo, espera');
    assert.equal(x.deveEmitir(fases, c, 'b', 'c'), true, 'saindo do grupo, emite');
    assert.equal(x.deveEmitir(fases, c, 'a', null), true, 'arquivar emite');
    assert.equal(x.deveEmitir(fases, null, 'a', 'c'), false);
});

test('texto e visibilidade da certidão', () => {
    const itens = [
        { seq: 3, fase_id: 'a', texto: '"Conferir", da fase Análise', autor: 'Ana', em: '2026-11-12T13:00:00Z', partes: true },
        { seq: 4, fase_id: 'b', texto: '"Oficiar", da fase Diligências', autor: 'Bia', em: '', partes: false },
    ];
    const t = x.textoCertidao(itens);
    assert.match(t, /^Certifico que foram cumpridos os seguintes atos: 1\) "Conferir", da fase Análise \(Ana, 12\/11\/2026, 10:00\); 2\) "Oficiar", da fase Diligências \(Bia\)\.$/);
    assert.equal(x.visivelCertidao(itens), false, 'um item reservado deixa a certidão só para a equipe');
    assert.equal(x.visivelCertidao(itens.slice(0, 1)), true);
    assert.equal(x.visivelCertidao([]), false);
    assert.equal(a.tituloEvento({ seq: 5, tipo: 'certidao_fase', dados: { titulo: 'Certidão da análise' } }), 'Certidão da análise');
    assert.equal(a.origemEvento({ seq: 5, tipo: 'certidao_fase', dados: {} }), 'usuario', 'certidão conjunta tem folha');
});

test('certidão cabe numa folha: item longo resumido, pendente cheia é emitida antes', () => {
    const longo = x.textoDoItem('a'.repeat(4000));
    assert.ok(longo.length <= x.MAX_ITEM_CERTIDAO && longo.endsWith('(íntegra no registro do ato)'));
    assert.equal(x.textoDoItem('curto'), 'curto');
    const item = (k) => ({ seq: k, fase_id: 'a', texto: x.textoDoItem(`"Ação ${k}", da fase Análise. Dado: ${'b'.repeat(250)}`), autor: 'Ana Secretária', em: '2026-11-12T13:00:00Z', partes: true });
    const itens = [];
    while (x.cabeNaCertidao(itens, item(itens.length))) itens.push(item(itens.length));
    assert.ok(itens.length >= 4, 'cabem alguns itens longos');
    assert.ok(x.textoCertidao(itens).length <= x.MAX_TEXTO_CERTIDAO);
    assert.ok(x.cabeNaCertidao([], item(0)), 'um item sozinho sempre cabe');
    // Título: o da fase raiz vale sobre o de outra fase do grupo.
    assert.equal(x.tituloCertidao([{ id: 'p', nome: 'P', certidao: { titulo: 'Raiz' } }, { id: 'q', nome: 'Q', certidao: { grupo: 'p', titulo: 'Outra' } }], 'p'), 'Raiz');
    assert.equal(x.tituloCertidao([{ id: 'q', nome: 'Q', certidao: { grupo: 'p', titulo: 'Outra' } }, { id: 'p', nome: 'P' }], 'p'), 'Outra');
});

test('sanitizeRito: grupo pelo id do cliente, sempre a raiz, sem ciclo nem fase inexistente', () => {
    const r = s.sanitizeRito({
        nome: 'R', fases: [
            { id: 'x1', nome: 'Um' },
            { id: 'x2', nome: 'Dois', certidao: { grupo: 'x1', titulo: '  T  ' } },
            { id: 'x3', nome: 'Três', certidao: { grupo: 'x2', incluir_mudancas: true } },
            { id: 'x4', nome: 'Quatro', certidao: { grupo: 'nao_existe' } },
            { id: 'x5', nome: 'Cinco', certidao: { grupo: 'x6' } },
            { id: 'x6', nome: 'Seis', certidao: { grupo: 'x5' } },
        ],
    });
    const [um, dois, tres, quatro, cinco, seis] = r.fases;
    assert.equal(um.certidao, undefined);
    assert.deepEqual(dois.certidao, { grupo: um.id, titulo: 'T' });
    assert.deepEqual(tres.certidao, { grupo: um.id, incluir_mudancas: true }, 'cadeia vira a raiz');
    assert.equal(quatro.certidao, undefined);
    assert.equal(cinco.certidao, undefined, 'em ciclo, cada fase fica só');
    assert.equal(seis.certidao, undefined);
});

test('emissão e ato seguinte na mesma transação ficam encadeados', () => {
    const gravados = [];
    const tx = { set: (_ref, d) => gravados.push(d) };
    const ref = { collection: () => ({ doc: (id) => ({ id }) }) };
    const c = { ctx: { uid: 'u1' }, userName: 'Ana' };
    let proc = { mov_seq: 0, folhas_seq: 0, unidade_atual: 'un' };
    const m1 = registrarMovimento(tx, c, ref, proc, 'acao_fase', 'Feita', { consolidada: true, ...x.marcasDoDestino('nenhum') });
    proc = { ...proc, ...m1 };
    assert.equal(m1.ultimo_movimento, undefined, 'item oculto não vira último andamento');
    assert.equal(m1.folhas_seq, undefined, 'item oculto não ocupa folha');
    const m2 = registrarMovimento(tx, c, ref, proc, 'certidao_fase', 'Certidão', { titulo: 'T', itens: [1] });
    const m3 = registrarMovimento(tx, c, ref, { ...proc, ...m2 }, 'fase', 'Fase alterada', {});
    assert.equal(m2.folhas_seq, 1);
    assert.equal(m3.folhas_seq, 2);
    assert.equal(m3.mov_seq, 3);
    assert.equal(s.verificarCadeia(gravados), null);
});
