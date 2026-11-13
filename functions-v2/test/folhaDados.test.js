// Folha de dados do processo (a folha do evento 1 no PDF) e a capa simples.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const x = require('../lib/shared/exigencias');
const { informacoesDoAndamento, informacoesDaFolha, linhasDaInformacao } = require('../lib/shared/informacoes');
const { secoesDaFolha, situacaoDaCapa } = require('../lib/shared/folhaDados');

const regra = (r, acao = 'A') => x.sanitizeRegras({ acoes_regras: [r] }, [acao]).acoes_regras[0];

test('rito: "entra na folha de dados" só em ação que pede dado, e nunca com dado reservado', () => {
    assert.equal(regra({ pede: 'texto', folha_dados: true }).folha_dados, true);
    assert.equal(regra({ pede: 'texto', destino: 'nenhum', folha_dados: true }).folha_dados, true, 'sem evento, o dado ainda vai à folha');
    assert.equal(regra({ folha_dados: true, obrigatoria: true }).folha_dados, undefined, 'só confirmar não tem o que mostrar');
    assert.equal(regra({ pede: 'orientacao', folha_dados: true }).folha_dados, undefined);
    assert.throws(() => regra({ pede: 'texto', destino: 'informacao', ve: 'gestor', folha_dados: true }), /reservado a quem gere a unidade não entra na folha de dados/);
});

const fases = [{ id: 'f1', nome: 'Recebimento', nome_publico: 'Em análise' }];
const mov = (seq, dados, extra = {}) => ({ seq, tipo: 'acao_fase', autor_nome: 'Ana', autor_uid: 'u1', em: `2026-11-1${seq}T12:00:00.000Z`, dados: { fase_id: 'f1', feita: true, ...dados }, ...extra });
const FORM = [{ id: 'orgao', rotulo: 'Órgão solicitante', tipo: 'texto', valor: 'PJ de X' }, { id: 'sistema', rotulo: 'Sistema utilizado', tipo: 'lista', valor: 'SPU' },
    { id: 'urg', rotulo: 'Urgente', tipo: 'sim_nao', valor: false }, { id: 'c', rotulo: 'Consulta', tipo: 'registro', valor: 'C-7', ref: { modulo: 'consultas', id: 'k', titulo: 'Título interno' } }];

test('informações da folha: só as marcadas pelo rito, sem as reservadas e sem a ação desfeita', () => {
    const movs = [
        mov(2, { acao_idx: 0, rotulo: 'Dados básicos', tipo_valor: 'formulario', valor: FORM, valor_texto: 'x', folha_dados: true, visivel_partes: true }),
        mov(3, { acao_idx: 1, rotulo: 'Número do PGEA', valor: '00123', valor_texto: '00123', folha_dados: true }),
        mov(4, { acao_idx: 2, rotulo: 'Observações', valor: 'interno', valor_texto: 'interno' }),
        mov(5, { acao_idx: 3, rotulo: 'Meio', valor: 'E-mail', valor_texto: 'E-mail', folha_dados: true }),
        mov(6, { acao_idx: 3, feita: false }),
        // Dado antigo que ficou com as duas marcas: o reservado nunca vai à folha.
        mov(7, { acao_idx: 4, rotulo: 'Avaliação', valor: 'sigilosa', valor_texto: 'sigilosa', folha_dados: true, reservado: 'gestor', ve_unidade: 'un1' }),
    ];
    const equipe = informacoesDaFolha(informacoesDoAndamento(movs, fases));
    assert.deepEqual(equipe.map((i) => i.rotulo), ['Dados básicos', 'Número do PGEA']);
    assert.deepEqual(informacoesDaFolha(informacoesDoAndamento(movs, fases, true)).map((i) => i.rotulo), ['Dados básicos'], 'para as partes, só o que o rito mostra a elas');
    assert.deepEqual(linhasDaInformacao(equipe[0]), ['Órgão solicitante: PJ de X', 'Sistema utilizado: SPU', 'Urgente: Não', 'Consulta: C-7']);
    assert.deepEqual(linhasDaInformacao(equipe[1]), ['Número do PGEA: 00123']);
});

test('folha de dados: a equipe lê tudo; a parte não lê origem, CPF, parte retirada, título de registro nem quem registrou', () => {
    const proc = {
        assunto: 'Consulta sobre contratação', tipo_nome: 'Consulta', rito_nome: 'Rito Consultas', rito_versao: 3, sigilo: 'normal', urgente: true, urgencia: { motivo: 'Prazo' },
        origem: { tipo: 'oficio', descricao: 'Ofício 12/2026' }, descricao: 'Texto da descrição.', status: 'em_tramitacao', fase_atual: 'f1', fases,
        partes: [{ nome: 'Maria', polo: 'requerente', documento: '123.456.789-00' }, { nome: 'João', polo: 'requerido', retirada: { em: 'x' } }],
    };
    const campos = [{ id: 'v', rotulo: 'Valor', tipo: 'numero', formato: 'moeda', valor: 10, visivel_partes: true }, { id: 'r', rotulo: 'Consulta', tipo: 'registro', valor: 'C-7', visivel_partes: true, ref: { modulo: 'consultas', id: 'k', titulo: 'Título interno' } }];
    const informacoes = informacoesDaFolha(informacoesDoAndamento([mov(2, { acao_idx: 1, rotulo: 'Número do PGEA', valor: '00123', valor_texto: '00123', folha_dados: true, visivel_partes: true })], fases));
    const base = { proc, campos, informacoes, unidadeAtual: 'Secretaria', geradoEm: '13/11/2026', quando: () => 'DATA' };
    const texto = (s) => s.flatMap((x) => [x.titulo, ...x.itens.flatMap((i) => [i.texto, i.nota || ''])]).join('\n');

    const eq = secoesDaFolha({ ...base, equipe: true });
    assert.deepEqual(eq.map((s) => s.titulo), ['Identificação', 'Descrição', 'Partes', 'Dados do processo', 'Dados registrados no andamento', 'Situação em 13/11/2026']);
    const te = texto(eq);
    for (const trecho of ['Assunto: Consulta sobre contratação', 'Tipo de processo: Consulta', 'Rito: Rito Consultas (versão 3)', 'Tramitação: URGENTE (Prazo)', 'Ofício 12/2026',
        'requerente: Maria (123.456.789-00)', 'requerido: João (retirada)', 'Valor: R$ 10,00', 'Consulta: C-7 (Título interno)', 'Número do PGEA: 00123',
        'Fase Recebimento · evento 2 · Ana, DATA', 'Situação: Em tramitação', 'Fase atual: Recebimento', 'Unidade atual: Secretaria']) assert.ok(te.includes(trecho), `equipe: ${trecho}`);

    const tp = texto(secoesDaFolha({ ...base, equipe: false, unidadeAtual: '' }));
    for (const trecho of ['Assunto: Consulta sobre contratação', 'requerente: Maria', 'Valor: R$ 10,00', 'Consulta: C-7', 'Número do PGEA: 00123', 'Registrado em DATA', 'Fase atual: Em análise']) assert.ok(tp.includes(trecho), `parte: ${trecho}`);
    for (const trecho of ['Ofício 12/2026', '123.456.789-00', 'João', 'Título interno', 'Ana', 'evento 2', 'Recebimento', 'Unidade atual']) assert.ok(!tp.includes(trecho), `a parte não lê: ${trecho}`);

    // Processo sem nada além do básico: só as seções que têm conteúdo.
    assert.deepEqual(secoesDaFolha({ ...base, proc: { assunto: 'X', status: 'arquivado', fase_atual: 'f1', fases }, campos: [], informacoes: [], equipe: true }).map((s) => s.titulo),
        ['Identificação', 'Situação em 13/11/2026']);
});

test('capa: só ativo ou arquivado', () => {
    assert.equal(situacaoDaCapa('em_tramitacao'), 'Ativo');
    assert.equal(situacaoDaCapa('sobrestado'), 'Ativo (sobrestado)');
    assert.equal(situacaoDaCapa('arquivado'), 'Arquivado');
    assert.equal(situacaoDaCapa(undefined), 'Ativo');
});
