// npm run test:lib
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerPacote, nomeArquivoPacote, pacoteDeDocumento, propostaDePacote, trocarModeloNasFases } from './pacoteModelos.js';

const pacote = {
    formato: 'sigo-pacote', versao: 1, conteudo: 'rito',
    rito: {
        nome: 'Recurso', descricao: 'Vindo do órgão A', exigir_tipo: true,
        fases: [
            {
                id: 'f1', nome: 'Análise', unidade: 'u1', modelos: ['m1', 'm2'], acoes: ['Julgar', 'Ver denúncia'],
                acoes_regras: [{ pede: 'julgamento', julgamento: { resultados: ['Provido', 'Negado'] }, documento: undefined }, { pede: 'registro', modulo: 'paginas', pagina: 'p2' }],
                documentos: [{ descricao: 'Parecer', modelo_id: 'm2' }],
                situacao_registro: { modulo: 'paginas', pagina: 'p1', ao_entrar: 'x' },
            },
            { id: 'f2', nome: 'Fim', final: true, unidade: 'u2' },
        ],
    },
    unidades: [{ ref: 'u1', nome: 'Assessória', sigla: 'ASS' }, { ref: 'u2', nome: 'Gabinete novo', tipo: 'gabinete' }],
    modelos: [{ ref: 'm1', nome: 'Relatório', conteudo: { type: 'doc' } }, { ref: 'm2', nome: 'Parecer', unidade: 'u1', conteudo: { type: 'doc', content: [] } }],
    paginas: [{ ref: 'p1', nome: 'Denúncia' }, { ref: 'p2', nome: 'Ouvidoria' }],
    tipo: { nome: 'Recurso', sigla: 'REC', formulario: { campos: [{ id: 'a', rotulo: 'Ouv', tipo: 'registro', modulo: 'paginas', pagina: 'p2' }, { id: 'b', rotulo: 'Dado', tipo: 'texto', importar: { de: 'a', dado: 'x' } }] } },
    avisos: ['Aviso de origem'],
};

test('lerPacote: recusa o que não é pacote e versão mais nova', () => {
    assert.throws(() => lerPacote('não é json'), /não é um pacote/);
    assert.throws(() => lerPacote(JSON.stringify({ formato: 'outro' })), /não é um pacote/);
    assert.throws(() => lerPacote(JSON.stringify({ ...pacote, versao: 9 })), /versão mais nova/);
    assert.throws(() => lerPacote(JSON.stringify({ ...pacote, rito: { fases: [] } })), /fases/);
    assert.equal(lerPacote(JSON.stringify(pacote)).rito.nome, 'Recurso');
    const doc = pacoteDeDocumento({ nome: 'Ofício', conteudo: { type: 'doc' }, id: 'x', created_by: 'u' }, 'T');
    assert.deepEqual(lerPacote(JSON.stringify(doc)).modelo, { nome: 'Ofício', conteudo: { type: 'doc' } }, 'o modelo de documento leva só nome, tipo, descrição e texto');
});

test('propostaDePacote: casa unidades, modelos e páginas pelo nome; o que falta vira novo', () => {
    const estado = { unidades: [{ id: 'U-ASS', nome: 'Assessoria', ativa: true }], modelos: [{ id: 'M-REL', nome: 'relatorio' }] };
    const { proposta: p, tipo } = propostaDePacote(pacote, estado, [{ id: 'PG-DEN', nome: 'Denúncia' }]);
    const [f1, f2] = p.fases;
    assert.equal(f1.unidade_ref, 'U-ASS', 'mesma unidade pelo nome, sem acento');
    assert.equal(f2.unidade_ref, '+0');
    assert.deepEqual(p.unidades, [{ ref: '+0', nome: 'Gabinete novo', sigla: '', tipo: 'gabinete' }]);
    assert.deepEqual(f1.modelos_ref, ['M-REL', '+0'], 'o modelo do órgão de mesmo nome é usado; o outro é criado com o texto');
    assert.equal(p.modelos[0].nome, 'Parecer');
    assert.equal(p.modelos[0].unidade_ref, 'U-ASS');
    assert.ok(p.modelos[0].conteudo);
    assert.equal(f1.documentos[0].modelo_id, '+0');
    assert.equal(f1.situacao_registro.pagina, 'PG-DEN');
    assert.equal(f1.acoes_regras[1].pagina, '', 'página que o órgão não tem fica para escolher');
    assert.ok(p.avisos.some((a) => /Ouvidoria/.test(a)) && p.avisos.includes('Aviso de origem'));
    assert.deepEqual(f1.acoes_regras[0].julgamento, { resultados: ['Provido', 'Negado'] });
    assert.deepEqual(tipo.formulario.campos, [{ id: 'b', rotulo: 'Dado', tipo: 'texto' }], 'campo de página que falta sai do tipo, com o que dependia dele');
    assert.equal(p.exigir_tipo, true);
});

test('propostaDePacote: sem a página da regra de andamento, a regra sai com aviso', () => {
    const { proposta: p } = propostaDePacote(pacote, {}, []);
    assert.equal(p.fases[0].situacao_registro, undefined);
    assert.ok(p.avisos.some((a) => /Denúncia/.test(a)));
});

test('trocarModeloNasFases: troca também o modelo indicado do documento exigido', () => {
    const fases = [{ modelos_ref: ['+0', 'X'], documentos: [{ modelo_id: '+0' }], acoes_regras: [{ documento: { modelo_id: '+0' } }, null] }];
    const [f] = trocarModeloNasFases(fases, '+0', 'M1');
    assert.deepEqual(f.modelos_ref, ['M1', 'X']);
    assert.equal(f.documentos[0].modelo_id, 'M1');
    assert.equal(f.acoes_regras[0].documento.modelo_id, 'M1');
    assert.equal(nomeArquivoPacote('rito', 'Ação de Improbidade'), 'rito-acao-de-improbidade.json');
});
