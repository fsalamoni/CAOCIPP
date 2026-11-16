const test = require('node:test');
const assert = require('node:assert/strict');
const { pacoteDoRito, paginasCitadas, FORMATO_PACOTE } = require('../lib/shared/pacoteRito');
const { sanitizeRito } = require('../lib/shared/secretaria');

const rito = sanitizeRito({
    nome: 'Recurso', descricao: 'Do órgão A',
    fases: [
        {
            id: 'f1', nome: 'Análise', unidade_id: 'unA', modelos: ['mod1', 'fora'], proximas: ['f2'],
            acoes: ['Julgar', 'Juntar parecer'],
            acoes_regras: [
                { pede: 'julgamento', julgamento: { resultados: ['Provido', 'Negado'], quorum: 3, desempate: 'presidente' } },
                { documento: { descricao: 'Juntar parecer', modelo_id: 'mod2' } },
            ],
            documentos: [{ descricao: 'Relatório', modelo_id: 'mod1' }],
            situacao_registro: { modulo: 'paginas', pagina: 'pagX', ao_entrar: 'aberto' },
        },
        { id: 'f2', nome: 'Fim', final: true },
    ],
});

test('pacote do rito: leva todas as regras, sem ids nem dados do órgão de origem', () => {
    const p = pacoteDoRito(rito, {
        unidades: [{ id: 'unA', nome: 'Assessoria', sigla: 'ASS', tipo: 'assessoria' }, { id: 'unB', nome: 'Outra' }],
        modelos: [
            { id: 'mod1', nome: 'Relatório', conteudo: { type: 'doc', content: [] }, created_by: 'uid-secreto' },
            { id: 'mod2', nome: 'Parecer', formato: 'original' },
        ],
        tipo: { nome: 'Recurso', sigla: 'REC', formulario: { campos: [] } },
        paginas: { pagX: 'Denúncia' },
        agora: '2026-11-16T00:00:00.000Z',
    });
    assert.equal(p.formato, FORMATO_PACOTE);
    const f = p.rito.fases[0];
    assert.equal(f.unidade, 'u1');
    assert.equal(f.unidade_id, undefined);
    assert.deepEqual(f.modelos, ['m1', 'm2'], 'modelo de fora do órgão sai; o indicado no documento exigido entra');
    assert.equal(f.documentos[0].modelo_id, 'm1');
    assert.equal(f.acoes_regras[1].documento.modelo_id, 'm2');
    assert.deepEqual(f.acoes_regras[0].julgamento, { resultados: ['Provido', 'Negado'], quorum: 3 });
    assert.deepEqual(p.unidades, [{ ref: 'u1', nome: 'Assessoria', sigla: 'ASS', tipo: 'assessoria' }], 'só a unidade que o rito usa');
    assert.deepEqual(p.modelos.map((m) => [m.ref, m.nome, !!m.conteudo]), [['m1', 'Relatório', true], ['m2', 'Parecer', false]]);
    assert.equal(p.avisos.length, 1, 'avisa do modelo guardado como arquivo original');
    assert.deepEqual(p.paginas, [{ ref: 'p1', nome: 'Denúncia' }]);
    assert.equal(f.situacao_registro.pagina, 'p1');
    assert.equal(p.tipo.nome, 'Recurso');
    const texto = JSON.stringify(p);
    for (const segredo of ['unA', 'mod1', 'mod2', 'uid-secreto', 'pagX', 'organization_id', 'created_by']) assert.ok(!texto.includes(segredo), `sem ${segredo}`);
});

test('pacote do rito: páginas citadas no rito e no formulário do tipo', () => {
    assert.deepEqual(paginasCitadas(rito, { campos: [{ modulo: 'paginas', pagina: 'pagY' }] }), ['pagX', 'pagY']);
});
