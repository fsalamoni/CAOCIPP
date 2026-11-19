// Integração rito ↔ painel na tela: nomes das colunas, relatório de
// cobertura e sugestões pelo nome, com o Rito Consultas CAOCIPP. npm run test:lib
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ritoConsultas } from './secretariaRito.js';
import { PAINEIS, aplicarIntegracao, camposParaLevar, ligarAoPainelGerado, painelDe, painelDoRito, relatorioIntegracao, rotuloDaColuna, sugestoesDeIntegracao } from './painelModulos.js';
import { situacoesDaRegra } from './andamentoFase.js';

const require = createRequire(import.meta.url);
let servidor = null;
try { servidor = require('../../functions-v2/lib/shared/painelModulos.js'); } catch { /* sem build do servidor: o espelho é conferido no CI do servidor */ }

const CONSULTAS = { modulo: 'consultas' };

test('o editor mostra as colunas com o nome do quadro', () => {
    assert.equal(rotuloDaColuna('consultas', 'Em elaboração'), 'Em Análise');
    assert.deepEqual(situacoesDaRegra({ modulo: 'consultas' }).map(([, r]) => r), ['Pendentes', 'Em Análise', 'Aguarda Terceiros', 'Em Revisão', 'Revisadas', 'Arquivados']);
    assert.deepEqual(situacoesDaRegra({ modulo: 'consultas' }).map(([v]) => v)[1], 'Em elaboração', 'o valor gravado segue o mesmo');
});

test('espelho igual ao servidor: colunas, informações e campos', { skip: !servidor }, () => {
    for (const m of ['consultas', 'expedientes', 'parcerias']) {
        assert.deepEqual(PAINEIS[m].colunas.map((c) => [c.id, c.rotulo]), servidor.PAINEIS[m].colunas.map((c) => [c.id, c.rotulo]), m);
        assert.deepEqual(PAINEIS[m].campos.map((c) => [c.campo, [...c.tipos]]), servidor.PAINEIS[m].campos.map((c) => [c.campo, [...c.tipos]]), m);
        for (const [i, c] of PAINEIS[m].colunas.entries()) {
            const s = servidor.PAINEIS[m].colunas[i].infos.filter((x) => x.campo !== 'distribution_date');
            assert.deepEqual(c.infos.map((x) => [x.campo, !!x.auto, !!x.obrigatoria]), s.map((x) => [x.campo, !!x.auto, !!x.obrigatoria]), `${m} ${c.id}`);
        }
    }
});

test('Rito Consultas CAOCIPP: todas as colunas cobertas, falta só a pasta na rede', () => {
    const { fases } = ritoConsultas();
    const rel = relatorioIntegracao(fases, CONSULTAS);
    assert.ok(rel.colunas.every((c) => c.coberta), 'cada coluna do painel tem a sua fase');
    assert.deepEqual(rel.colunas.find((c) => c.id === 'Em elaboração').fases.map((f) => [f.nome, f.ao_assumir]), [['Análise', true]]);
    assert.deepEqual(rel.semColuna, ['Recebimento']);
    // Sem ligações, o destinatário e a pasta na rede não chegam ao painel.
    assert.equal(rel.faltas.length, 2);
    const sug = sugestoesDeIntegracao(fases, CONSULTAS);
    const levar = sug.filter((s) => s.tipo === 'levar').map((s) => s.campo).sort();
    assert.deepEqual(levar, ['consultant', 'entry_date', 'location', 'matter_object', 'observations', 'process_number', 'review_return_date', 'third_party_recipient', 'third_party_referral_date'].sort());
    const criar = sug.filter((s) => s.tipo === 'criar');
    assert.deepEqual(criar.map((s) => [fases.find((f) => f.id === s.fase).nome, s.campo]), [['Revisão', 'network_folder']]);
    assert.equal(sug.filter((s) => s.tipo === 'coluna').length, 0, 'as fases do modelo já conduzem a consulta');
    // Aplicado tudo, o painel fica coberto.
    const depois = aplicarIntegracao(fases, sug, CONSULTAS);
    const rel2 = relatorioIntegracao(depois, CONSULTAS);
    assert.deepEqual(rel2.faltas, []);
    assert.ok(rel2.pronto);
    const rev = depois.find((f) => f.nome === 'Revisão');
    assert.equal(rev.acoes.at(-1), 'Informar: Pasta na rede');
    assert.deepEqual(rev.acoes_regras.at(-1), { pede: 'texto', obrigatoria: true, destino: 'informacao', ao_registro: { modulo: 'consultas', campo: 'network_folder' } });
    const dil = depois.find((f) => f.nome === 'Diligências externas');
    assert.deepEqual(dil.acoes_regras[0].ao_registro, { modulo: 'consultas', campos: { data: 'third_party_referral_date', destinatario: 'third_party_recipient' } });
});

test('rito sem regras: as fases são reconhecidas pelo nome', () => {
    const fases = ['Recebimento', 'Análise', 'Diligências', 'Revisão', 'Devolução', 'Arquivamento'].map((nome, i) => ({ id: `f${i}`, nome, ...(i === 5 ? { final: true } : {}) }));
    const sug = sugestoesDeIntegracao(fases, CONSULTAS).filter((s) => s.tipo === 'coluna');
    assert.deepEqual(sug.map((s) => [s.fase, s.regra.ao_entrar, s.regra.ao_assumir || '']), [
        ['f1', 'Pendente', 'Em elaboração'], ['f2', 'Aguarda retorno de terceiros', ''], ['f3', 'Em revisão', ''], ['f4', 'Revisadas', ''], ['f5', 'Na pasta', ''],
    ]);
    const rel = relatorioIntegracao(aplicarIntegracao(fases, sug, CONSULTAS), CONSULTAS);
    assert.ok(rel.colunas.every((c) => c.coberta));
});

test('página própria: colunas são as fases dela e os campos os dela', () => {
    const paginas = [{ id: 'tp', nome: 'Contrato', plural: 'Contratos', fases: [{ key: 'assinatura', label: 'Assinatura' }, { key: 'execucao', label: 'Execução' }],
        campos: [{ key: 'numero', label: 'Número do contrato', type: 'text', phase: 'assinatura', required: true }, { key: 'gestor', label: 'Gestor', type: 'user_ref' }, { key: 'valor', label: 'Valor', type: 'currency' }] }];
    const alvo = { modulo: 'paginas', pagina: 'tp' };
    assert.deepEqual(painelDe(alvo, paginas).colunas.map((c) => c.rotulo), ['Assinatura', 'Execução']);
    assert.deepEqual(camposParaLevar(alvo, 'numero', paginas), [['numero', 'Número do contrato'], ['valor', 'Valor']], 'pessoa da equipe não recebe valor');
    const fases = [{ id: 'a', nome: 'Assinatura do contrato', acoes: ['Registrar o número do contrato'], acoes_regras: [{ pede: 'texto' }] }, { id: 'b', nome: 'Execução' }];
    const sug = sugestoesDeIntegracao(fases, alvo, paginas);
    assert.deepEqual(sug.map((s) => s.tipo), ['coluna', 'levar']);
    assert.ok(relatorioIntegracao(aplicarIntegracao(fases, sug, alvo), alvo, paginas).pronto);
});

test('gerar o painel do rito: uma coluna por fase, um campo por dado', () => {
    const fases = [
        { id: 'a', nome: 'Assinatura do contrato', acoes: ['Informar o número do contrato', 'Conferir garantia'], acoes_regras: [{ pede: 'texto', obrigatoria: true }, null] },
        { id: 'b', nome: 'Execução', acoes: ['Registrar medição'], acoes_regras: [{ pede: 'formulario', campos: [{ id: 'm', rotulo: 'Data da medição', tipo: 'data' }, { id: 'v', rotulo: 'Situação', tipo: 'lista', opcoes: ['Regular', 'Irregular'] }] }] },
        { id: 'c', nome: 'Execução', situacao_registro: { modulo: 'consultas', ao_entrar: 'Pendente' } },
        { id: 'd', nome: 'Encerramento', final: true },
    ];
    const g = painelDoRito(fases, ['Contrato', 'Contratos']);
    assert.deepEqual(g.def.phases.map((p) => [p.key, !!p.is_initial, !!p.is_final]), [['assinatura_do_contrato', true, false], ['execucao', false, false], ['execucao_2', false, false], ['encerramento', false, true]]);
    assert.deepEqual(g.def.fields.map((f) => [f.key, f.type, f.phase || '']), [
        ['processo', 'text', ''], ['assunto', 'textarea', ''], ['informar_o_numero_do_contrato', 'text', 'assinatura_do_contrato'],
        ['data_da_medicao', 'date', 'execucao'], ['situacao', 'select', 'execucao'],
    ]);
    const ligadas = ligarAoPainelGerado(fases, g, 'pg9');
    assert.deepEqual(ligadas[0].situacao_registro, { modulo: 'paginas', pagina: 'pg9', ao_entrar: 'assinatura_do_contrato', na_autuacao: true });
    assert.deepEqual(ligadas[0].acoes_regras[0].ao_registro, { modulo: 'paginas', pagina: 'pg9', campo: 'informar_o_numero_do_contrato' });
    assert.equal(ligadas[0].acoes_regras[1], null);
    assert.deepEqual(ligadas[1].acoes_regras[0].ao_registro.campos, { m: 'data_da_medicao', v: 'situacao' });
    assert.equal(ligadas[2].situacao_registro.modulo, 'consultas', 'fase que conduz outro painel fica como está');
    const paginas = [{ id: 'pg9', nome: 'Contrato', plural: 'Contratos', fases: g.def.phases, campos: g.def.fields }];
    const rel = relatorioIntegracao(ligadas, { modulo: 'paginas', pagina: 'pg9' }, paginas);
    assert.equal(rel.colunas.filter((c) => !c.coberta).map((c) => c.rotulo).join(), 'Execução', 'só a coluna da fase que conduz outro painel');
});

test('todo modelo da biblioteca gera um painel que o servidor aceita', { skip: !servidor }, async () => {
    const { sanitizeEntityTypeDefinition } = require('../../functions-v2/lib/customEntities/schema.js');
    const { bibliotecaDeModelos } = await import('./bibliotecaRitos.js');
    for (const m of bibliotecaDeModelos()) {
        const g = painelDoRito(m.fases, [m.nome.slice(0, 40), m.nome.slice(0, 40)]);
        assert.doesNotThrow(() => sanitizeEntityTypeDefinition(g.def), m.nome);
        assert.equal(g.def.phases.length, m.fases.length, `${m.nome}: uma coluna por fase`);
        // Modelo que já conduz um painel do sistema (parcerias do MPRS) não recebe o convite do painel gerado.
        if (m.fases.some((f) => f.situacao_registro?.modulo)) continue;
        const ligadas = ligarAoPainelGerado(m.fases, g, 'pg');
        assert.ok(ligadas.every((f) => f.situacao_registro?.pagina === 'pg'), `${m.nome}: toda fase move o cartão`);
    }
});
