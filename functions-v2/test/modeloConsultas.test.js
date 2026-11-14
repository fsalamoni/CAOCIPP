// O modelo pronto "Rito Consultas CAOCIPP" (src/lib/secretariaRito.js) contra as
// regras do servidor: nada do que o modelo configura pode ser descartado ao salvar.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const x = require('../lib/shared/exigencias');

const UNIDADES = { Secretaria: 'u1', Assessoria: 'u2', Gabinete: 'u3' };
const carregar = async () => {
    const { ritoConsultas } = await import('../../src/lib/secretariaRito.js');
    const m = ritoConsultas();
    const rito = s.sanitizeRito({ ...m, fases: m.fases.map((f) => ({ ...f, unidade_id: UNIDADES[f.unidade] })) });
    return { m, rito, f: Object.fromEntries(rito.fases.map((y) => [y.nome, y])) };
};

test('modelo Consultas: o servidor aceita e guarda tudo o que o modelo configura', async () => {
    const { m, rito } = await carregar();
    assert.deepEqual(rito.fases.map((f) => f.nome), ['Recebimento', 'Análise', 'Revisão', 'Devolução', 'Arquivamento', 'Diligências externas']);
    m.fases.forEach((orig, i) => {
        const salva = rito.fases[i];
        // Cada opção marcada no modelo chega ao rito gravado (ids e unidade mudam de forma, o resto fica).
        for (const k of Object.keys(orig).filter((y) => !['id', 'unidade', 'proximas', 'condicoes', 'acoes_regras'].includes(y))) {
            assert.deepEqual(salva[k], orig[k], `${orig.nome}: ${k}`);
        }
        assert.equal(salva.unidade_id, UNIDADES[orig.unidade], `${orig.nome}: unidade`);
        assert.equal((salva.proximas || []).length, (orig.proximas || []).length, `${orig.nome}: saídas`);
        assert.equal(Object.keys(salva.condicoes || {}).length, Object.keys(orig.condicoes || {}).length, `${orig.nome}: condições das saídas`);
        (orig.acoes_regras || []).forEach((r, k) => {
            const g = salva.acoes_regras[k];
            const rot = `${orig.nome}: ${orig.acoes[k]}`;
            assert.equal(x.pedidoDaAcao(g), r.documento ? 'documento' : r.pede || 'confirmar', rot);
            for (const c of ['rotulo', 'ajuda', 'obrigatoria', 'folha_dados', 'se']) assert.deepEqual(g[c], r[c], `${rot}: ${c}`);
            if (r.pede !== 'orientacao') assert.equal(x.destinoDaAcao(g), r.documento ? r.documento.destino || 'autos' : r.destino || 'evento', `${rot}: destino`);
            if (r.campos) assert.deepEqual(g.campos.map((c) => [c.id, c.rotulo, c.tipo, c.obrigatorio, c.opcoes || []]), r.campos.map((c) => [c.id, c.rotulo, c.tipo, c.obrigatorio, c.opcoes || []]), `${rot}: campos`);
            if (r.documento) assert.deepEqual([g.documento.forma, g.documento.tipo, g.documento.nivel], [r.documento.forma, r.documento.tipo, r.documento.nivel], `${rot}: documento`);
        });
    });
});

test('modelo Consultas: o caminho que o servidor segue é o que o rito descreve', async () => {
    const { rito, f } = await carregar();
    const ativas = ['u1', 'u2', 'u3'];
    const proc = (fase, extra = {}) => ({ fases: rito.fases, fase_atual: f[fase].id, status: 'em_tramitacao', ...extra });
    const nomes = (fase) => s.fasesSeguintes(rito.fases, f[fase].id).map((y) => y.nome);
    assert.deepEqual(nomes('Recebimento'), ['Análise']);
    assert.deepEqual(nomes('Análise'), ['Revisão', 'Diligências externas']);
    assert.deepEqual(nomes('Revisão'), ['Devolução', 'Diligências externas']);
    assert.deepEqual(nomes('Devolução'), ['Arquivamento']);
    assert.deepEqual(nomes('Arquivamento'), []);
    // Seguem sozinhas: Recebimento (para a Assessoria) e Devolução (na mesma unidade, onde arquiva ao entrar).
    assert.deepEqual(s.saidaAutomatica(proc('Recebimento', { unidade_atual: 'u1' }), ativas), { fase_id: f['Análise'].id, unidade_destino: 'u2' });
    assert.deepEqual(s.saidaAutomatica(proc('Devolução', { unidade_atual: 'u1' }), ativas), { fase_id: f.Arquivamento.id });
    assert.equal(f.Arquivamento.ao_entrar.arquivar, true);
    // Terminam pelo botão: quem envia escolhe as minutas (Análise) e a juntada vem antes (Revisão).
    assert.equal(s.saidaAutomatica(proc('Análise', { unidade_atual: 'u2' }), ativas), null);
    assert.equal(s.saidaAutomatica(proc('Revisão', { unidade_atual: 'u3' }), ativas), null);
    // A espera volta para a fase de onde o processo veio, na unidade em que ele estava.
    for (const [origem, un] of [['Análise', 'u2'], ['Revisão', 'u3']]) {
        const p = proc('Diligências externas', { unidade_atual: un, espera: { fase: f[origem].id, unidade: un } });
        assert.deepEqual(s.saidasDoProcesso(p).map((y) => y.nome), [origem]);
        assert.deepEqual(s.saidaAutomatica(p, ativas), { fase_id: f[origem].id });
    }
});

test('modelo Consultas: análise e diligências ficam fora dos autos; o parecer e a devolução entram', async () => {
    const { rito, f } = await carregar();
    const mov = (de, para) => x.destinoDoMovimento(rito.fases, f[de].id, f[para].id);
    assert.equal(mov('Recebimento', 'Análise'), 'informacao');
    assert.equal(mov('Análise', 'Revisão'), 'informacao');
    assert.equal(mov('Análise', 'Diligências externas'), 'informacao');
    assert.equal(mov('Revisão', 'Diligências externas'), 'informacao');
    assert.equal(mov('Revisão', 'Devolução'), 'autos');
    assert.equal(mov('Devolução', 'Arquivamento'), 'autos');
    assert.equal(x.destinoDoAto(f['Análise'], 'atribuicao'), 'informacao', 'assumir fica só no sistema');
    // Documento guardado fora dos autos: na fase interna não vai ao extrato impresso; na Revisão, vai.
    assert.equal(x.destinoDaGuarda(f['Análise'], []), 'informacao');
    assert.equal(x.destinoDaGuarda(f['Diligências externas'], []), 'informacao');
    assert.equal(x.destinoDaGuarda(f['Diligências externas'], x.exigenciasDaFase(f['Diligências externas'])), 'informacao');
    assert.equal(x.destinoDaGuarda(f['Revisão'], []), 'evento');
    assert.equal(x.destinoDaGuarda(f['Análise'], [{ descricao: 'Nota', forma: 'qualquer', destino: 'evento' }]), 'evento', 'a exigência que pede extrato vale mais que a fase');
    assert.equal(x.destinoDaGuarda(undefined, []), 'evento');
    // Recebimento: só o que vale para o sistema informado é cobrado.
    const cobradas = (sistema) => x.acoesObrigatoriasPendentes(f.Recebimento, [0], { '0.sistema': sistema }).map((a) => a.acao_idx);
    assert.deepEqual(cobradas('SIM'), [2, 6]);
    assert.deepEqual(cobradas('E-mail'), [1, 2, 3, 6]);
    assert.deepEqual(x.exigenciasDaFase(f.Recebimento, { '0.sistema': 'SIM' }), [], 'pelo SIM, a cópia da comunicação nem aparece');
    // Revisão: só o parecer juntado aos autos libera a fase.
    const [parecer] = x.documentosQueFaltam(f['Revisão'], {});
    assert.equal(parecer.tipo, 'Parecer');
    assert.deepEqual(x.reconhecer([parecer], { origem: 'editor', tipo: 'Parecer' }), ['a1']);
    assert.deepEqual(x.reconhecer([parecer], { origem: 'editor', tipo: 'Parecer', controle: true }), []);
});
