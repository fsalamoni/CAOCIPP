import test from 'node:test';
import assert from 'node:assert/strict';
import { FILTRO_VAZIO, agrupar, filtroAtivo, usaRecurso, filtrar, ordenar, pontos, recursosEmTexto, referencias, trechos } from './bibliotecaFiltro.js';
import { bibliotecaDeModelos } from './bibliotecaRitos.js';

const m = (id, nome, area, porte, n, extra = {}) => ({ id, nome, area, porte, descricao: '', quando: '', base: '', fases: Array.from({ length: n }, (_, i) => ({ id: `${id}${i}`, nome: `F${i}` })), ...extra });
const L = [
    m('a', 'Licitação', 'contratacoes', 'longo', 12, { referencia: 'Lei 14.133', base: 'Lei 14.133/2021' }),
    m('b', 'Notícia de Fato', 'ministerio_publico', 'curto', 4, { referencia: 'CNMP' }),
    m('c', 'Processo disciplinar no TED', 'etica', 'longo', 14, { referencia: 'OAB/RS', tipo: { polos: ['requerente', 'requerido'] }, descricao: 'Ética da advocacia.' }),
    m('d', 'Recomendação', 'ministerio_publico', 'curto', 3, { referencia: 'CNMP', descricao: 'Disciplinar? não.' }),
];

test('busca ignora acentos, exige todos os termos e pesa o nome', () => {
    assert.deepEqual(filtrar(L, { ...FILTRO_VAZIO, busca: 'noticia' }).map((x) => x.id), ['b']);
    assert.deepEqual(filtrar(L, { ...FILTRO_VAZIO, busca: 'licitacao 14.133' }).map((x) => x.id), ['a']);
    assert.deepEqual(filtrar(L, { ...FILTRO_VAZIO, busca: 'licitacao oab' }), []);
    assert.ok(pontos(L[2], 'disciplinar') > pontos(L[3], 'disciplinar'));
    assert.deepEqual(ordenar(filtrar(L, { ...FILTRO_VAZIO, busca: 'disciplinar' }), 'relevancia', 'disciplinar').map((x) => x.id), ['c', 'd']);
});

test('filtros por área, porte e referência', () => {
    assert.deepEqual(filtrar(L, { ...FILTRO_VAZIO, area: 'ministerio_publico', porte: 'curto' }).map((x) => x.id), ['b', 'd']);
    assert.deepEqual(filtrar(L, { ...FILTRO_VAZIO, referencia: 'OAB/RS' }).map((x) => x.id), ['c']);
    assert.deepEqual(referencias(L), [['CNMP', 2], ['Lei 14.133', 1], ['OAB/RS', 1]]);
});

test('ordens e grupos por área', () => {
    assert.deepEqual(ordenar(L, 'nome').map((x) => x.id), ['a', 'b', 'c', 'd']);
    assert.deepEqual(ordenar(L, 'curto').map((x) => x.id), ['d', 'b', 'a', 'c']);
    assert.deepEqual(ordenar(L, 'longo').map((x) => x.id), ['c', 'a', 'b', 'd']);
    assert.deepEqual(agrupar(ordenar(L, 'area')).map((g) => [g.area, g.modelos.map((x) => x.id).join('')]),
        [['etica', 'c'], ['contratacoes', 'a'], ['ministerio_publico', 'db']]);
});

test('trechos destacam sem perder o texto original', () => {
    const t = trechos('Notícia de Fato e notícias', 'noticia');
    assert.equal(t.map((x) => x.t).join(''), 'Notícia de Fato e notícias');
    assert.deepEqual(t.filter((x) => x.marca).map((x) => x.t), ['Notícia', 'notícia']);
    assert.deepEqual(trechos('Sem busca', ''), [{ t: 'Sem busca', marca: false }]);
});

test('a biblioteca real: ids únicos, referência e recursos em cada modelo', () => {
    const ms = bibliotecaDeModelos();
    assert.equal(new Set(ms.map((x) => x.id)).size, ms.length);
    for (const x of ms) {
        assert.ok(x.referencia, `${x.nome}: sem referência`);
        for (const c of ['nome', 'descricao', 'quando', 'base']) assert.ok((x[c] || '').length > 10, `${x.nome}: ${c}`);
        assert.ok(!/—/.test(`${x.descricao} ${x.quando}`), `${x.nome}: travessão no texto`);
        assert.ok(Array.isArray(recursosEmTexto(x)));
    }
});

test('filtro pelo recurso: modelos com sessão de colegiado e com disputa (S15)', () => {
    const todos = bibliotecaDeModelos();
    const comSessao = filtrar(todos, { ...FILTRO_VAZIO, recurso: 'julgamento' }).map((m) => m.id);
    for (const id of ['recurso-colegiado', 'deliberacao-normativa', 'revisao-arquivamento-csmp', 'comissao-etica-publica', 'ted-oab-rs']) assert.ok(comSessao.includes(id), id);
    assert.ok(!comSessao.includes('pa-geral'));
    assert.deepEqual(filtrar(todos, { ...FILTRO_VAZIO, recurso: 'disputa' }).map((m) => m.id).sort(), ['compra-privada', 'contratacao-direta']);
    assert.equal(filtroAtivo({ ...FILTRO_VAZIO, recurso: 'julgamento' }), true);
});

test('âmbito: todo modelo tem o seu, o filtro separa e os grupos trazem as áreas', async () => {
    const { AMBITOS, AMBITO_DO_MODELO } = await import('./bibliotecaRitos.js');
    const { agruparPorAmbito } = await import('./bibliotecaFiltro.js');
    const todos = bibliotecaDeModelos();
    const validos = AMBITOS.map(([a]) => a);
    for (const x of todos) assert.ok(validos.includes(x.ambito), `${x.id}: sem âmbito em MODELOS_POR_AMBITO`);
    assert.equal(Object.keys(AMBITO_DO_MODELO).length, todos.length, 'âmbito de modelo que não existe, ou repetido');
    const mprs = filtrar(todos, { ...FILTRO_VAZIO, ambito: 'mprs' });
    assert.ok(mprs.length >= 14 && mprs.every((x) => x.ambito === 'mprs'));
    assert.equal(filtroAtivo({ ...FILTRO_VAZIO, ambito: 'mprs' }), true);
    const gs = agruparPorAmbito(ordenar(todos, 'ambito'));
    assert.deepEqual(gs.map((g) => g.ambito), validos);
    assert.equal(gs.reduce((n, g) => n + g.areas.reduce((k, a) => k + a.modelos.length, 0), 0), todos.length);
    // Parcerias: formalização e acompanhamento nos três âmbitos, e a busca acha pelo nome do âmbito.
    for (const a of ['mprs', 'estadual_rs', 'federal']) {
        const ps = filtrar(todos, { ...FILTRO_VAZIO, ambito: a, area: 'parcerias' }).map((x) => x.id);
        assert.ok(ps.some((id) => id.startsWith('parceria-formalizacao')) && ps.some((id) => id.startsWith('parceria-acompanhamento')), a);
    }
    assert.ok(filtrar(todos, { ...FILTRO_VAZIO, busca: 'conselhos' }).some((x) => x.id === 'ted-oab-rs'));
});

test('o rito de formalização do MPRS cobre o Painel de Parcerias inteiro', async () => {
    const { relatorioIntegracao } = await import('./painelModulos.js');
    const m = bibliotecaDeModelos().find((x) => x.id === 'parceria-formalizacao-mprs');
    const r = relatorioIntegracao(m.fases, { modulo: 'parcerias' }, []);
    assert.deepEqual(r.faltas, []);
    assert.equal(r.pronto, true);
    for (const c of r.colunas.filter((x) => x.id !== 'Pendente' && x.id !== 'Extintos')) assert.ok(c.fases.length, `coluna ${c.id} sem fase`);
    // Órgão sem a integração de Parcerias: o modelo chega sem a ligação (e sem pendência), e o resto fica igual.
    const { semPaineisDesligados } = await import('./painelModulos.js');
    const [fs, fora] = semPaineisDesligados(m.fases, { parcerias: false });
    assert.deepEqual(fora, ['parcerias']);
    assert.ok(fs.every((f) => !f.situacao_registro && (f.acoes_regras || []).every((x) => !x?.ao_registro)));
    assert.deepEqual(fs.map((f) => f.acoes), m.fases.map((f) => f.acoes));
    assert.equal(fs[0].acoes_regras[0].campos.length, m.fases[0].acoes_regras[0].campos.length);
    const [iguais, nada] = semPaineisDesligados(m.fases, { parcerias: true });
    assert.equal(iguais, m.fases);
    assert.deepEqual(nada, []);
});
