// Biblioteca de modelos de rito (src/lib/bibliotecaRitos.js) contra as regras do
// servidor: cada modelo é aceito e nada do que ele configura se perde ao salvar.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const x = require('../lib/shared/exigencias');
const { sanitizeFormulario } = require('../lib/shared/camposProcesso');

// MODELOS_AREA=correcional confere só o arquivo daquela área (src/lib/modelos/<área>.js).
const carregar = async () => (process.env.MODELOS_AREA
    ? (await import(`../../src/lib/modelos/${process.env.MODELOS_AREA}.js`)).modelos.map((m) => m())
    : (await import('../../src/lib/bibliotecaRitos.js')).bibliotecaDeModelos());

test('biblioteca: metadados completos e ids únicos', async () => {
    const lib = await import('../../src/lib/modelos/dsl.js');
    const modelos = await carregar();
    if (!process.env.MODELOS_AREA) assert.ok(modelos.length >= 1);
    const ids = new Set();
    for (const m of modelos) {
        assert.ok(!ids.has(m.id), `id repetido: ${m.id}`);
        ids.add(m.id);
        assert.ok(lib.AREAS.some(([a]) => a === m.area), `${m.nome}: área`);
        assert.ok(lib.PORTES.some(([p]) => p === m.porte), `${m.nome}: porte`);
        for (const k of ['nome', 'descricao', 'quando', 'base']) assert.ok(String(m[k] || '').trim().length > 10, `${m.nome}: ${k}`);
        assert.ok(!/penal|crime|criminal/i.test(`${m.nome} ${m.descricao} ${m.quando}`), `${m.nome}: nada penal`);
        if (m.tipo) assert.doesNotThrow(() => sanitizeFormulario(m.tipo), `${m.nome}: tipo`);
    }
});

test('biblioteca: o servidor aceita cada modelo e guarda tudo o que ele configura', async () => {
    for (const m of await carregar()) {
        const nomesUn = [...new Set(m.fases.map((f) => f.unidade).filter(Boolean))];
        const un = Object.fromEntries(nomesUn.map((n, i) => [n, `u${i}`]));
        let rito;
        assert.doesNotThrow(() => { rito = s.sanitizeRito({ ...m, fases: m.fases.map((f) => ({ ...f, unidade_id: un[f.unidade] })) }); }, m.nome);
        assert.equal(rito.fases.length, m.fases.length, m.nome);
        m.fases.forEach((orig, i) => {
            const salva = rito.fases[i];
            const onde = `${m.nome} / ${orig.nome}`;
            for (const k of ['nome', 'prazo_dias', 'prazo_auto', 'prazo_contagem', 'avanco', 'espera', 'final', 'ao_entrar', 'nome_publico', 'orientacao', 'juntada_conjunta']) {
                if (orig[k] !== undefined) assert.deepEqual(salva[k], orig[k], `${onde}: ${k}`);
            }
            assert.equal(salva.unidade_id, un[orig.unidade], `${onde}: unidade`);
            if (orig.proximas) assert.equal((salva.proximas || []).length, orig.proximas.length, `${onde}: saídas`);
            assert.equal(Object.keys(salva.condicoes_regra || {}).length, Object.keys(orig.condicoes_regra || {}).length, `${onde}: saídas pela resposta`);
            if (orig.saida_padrao && !orig.condicoes_regra?.[orig.saida_padrao]) assert.ok(salva.saida_padrao, `${onde}: saída senão`);
            (orig.acoes_regras || []).forEach((r, k) => {
                if (!r) return;
                const g = salva.acoes_regras?.[k];
                const rot = `${onde}: ${orig.acoes[k]}`;
                assert.ok(g, rot);
                assert.equal(x.pedidoDaAcao(g), r.documento ? 'documento' : r.pede || 'confirmar', rot);
                for (const c of ['ajuda', 'obrigatoria', 'folha_dados', 'se', 'ou', 'quem', 'resposta', 'opcoes']) {
                    if (r[c] !== undefined) assert.deepEqual(g[c], r[c], `${rot}: ${c}`);
                }
                if (r.comunicacao) assert.deepEqual(g.comunicacao, r.comunicacao, `${rot}: comunicação`);
                if (r.audiencia) assert.deepEqual(g.audiencia, r.audiencia, `${rot}: audiência`);
                if (r.campos) assert.deepEqual(g.campos.map((c) => [c.id, c.rotulo, c.tipo]), r.campos.map((c) => [c.id, c.rotulo, c.tipo]), `${rot}: campos`);
                if (r.documento) assert.deepEqual([g.documento.forma, g.documento.tipo || undefined, g.documento.nivel], [r.documento.forma, r.documento.tipo || undefined, r.documento.nivel], `${rot}: documento`);
            });
        });
    }
});
