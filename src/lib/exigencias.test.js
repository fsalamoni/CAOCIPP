import test from 'node:test';
import assert from 'node:assert/strict';
import { atende, pendentesDaFase, realinharRegras, situacaoDaFase, sugeridas } from './exigencias.js';

const fase = { id: 'f1', acoes: ['Despachar', 'Certificar'], documentos: [{ descricao: 'Parecer', forma: 'juntar', tipo: 'Parecer' }],
    acoes_regras: [{ documento: { descricao: 'Despachar', forma: 'redigir', modelo_id: 'm1' } }, { autos: true }] };

test('situação e pendências da fase', () => {
    const cumpridas = { f1: { d0: { documento_id: 'x', ordem: 3 } } };
    assert.deepEqual(situacaoDaFase(fase, cumpridas).map((e) => [e.chave, e.cumprida?.ordem ?? null]), [['d0', 3], ['a0', null]]);
    assert.deepEqual(pendentesDaFase(fase, cumpridas).map((e) => e.chave), ['a0']);
    assert.deepEqual(pendentesDaFase(undefined, {}), []);
});

test('sugere pelo modelo ou tipo, respeitando a forma', () => {
    const pend = pendentesDaFase(fase, {});
    assert.deepEqual(sugeridas(pend, { origem: 'editor', modelo_id: 'm1' }), ['a0']);
    assert.deepEqual(sugeridas(pend, { origem: 'upload', tipo: 'PARECER' }), ['d0']);
    assert.equal(atende({ forma: 'juntar' }, { origem: 'editor' }), false);
    assert.equal(atende({ forma: 'qualquer' }, { origem: 'upload' }), true);
    assert.equal(atende({ forma: 'juntar' }, { origem: 'editor', peticao: true }), true);
});

test('regras seguem o texto da ação ao editar a lista', () => {
    const r = [{ autos: true }, null, { documento: { descricao: 'C' } }];
    // apagar a primeira linha: a regra de "C" continua em "C"
    assert.deepEqual(realinharRegras(['A', 'B', 'C'], r, ['B', 'C']), [null, r[2]]);
    // reordenar
    assert.deepEqual(realinharRegras(['A', 'B', 'C'], r, ['C', 'A', 'B']), [r[2], r[0], null]);
    // corrigir o texto de uma linha mantém a posição
    assert.deepEqual(realinharRegras(['A', 'B', 'C'], r, ['Ax', 'B', 'C']), r);
    // linha nova em branco no fim
    assert.deepEqual(realinharRegras(['A', 'B', 'C'], r, ['A', 'B', 'C', '']), [...r, null]);
    assert.equal(realinharRegras(['A'], undefined, ['B']), undefined);
    assert.equal(realinharRegras(['A', 'B'], [{ autos: true }, null], ['B']), undefined);
});

test('ação: o que pede, onde fica e troca de pedido sem perder destino', async () => {
    const m = await import('./exigencias.js');
    assert.equal(m.destinoDaAcao(null), 'evento');
    assert.equal(m.destinoDaAcao({ autos: true }), 'autos');
    assert.equal(m.partesVeem({ autos: true }), true);
    assert.deepEqual(m.regraComPedido({ destino: 'informacao', obrigatoria: true }, 'numero', 'Registrar'), { pede: 'numero', destino: 'informacao', obrigatoria: true });
    assert.deepEqual(m.regraComPedido(null, 'documento', 'Anexar'), { documento: { descricao: 'Anexar', forma: 'qualquer' } });
    assert.deepEqual(m.regraComPedido({ destino: 'informacao' }, 'documento', 'Anexar'), { documento: { descricao: 'Anexar', forma: 'qualquer', destino: 'informacao' } });
    assert.equal(m.regraComPedido(null, 'confirmar', 'A'), null);
    assert.match(m.resumoDaAcao({ pede: 'numero', rotulo: 'Nº SIM', destino: 'autos', partes: true }), /número \(Nº SIM\); certidão nos autos; partes veem/);
    assert.deepEqual(m.niveisDaFase({ registro: 'remessas_fora' }), { fase: 'autos', remessas: 'evento' });
    // Sem evento: as partes nunca veem; documento não fica sem evento; valor desconhecido vira o padrão.
    assert.equal(m.partesVeem({ pede: 'texto', destino: 'nenhum', partes: true }), false);
    assert.deepEqual(m.regraComPedido({ destino: 'nenhum' }, 'documento', 'Anexar'), { documento: { descricao: 'Anexar', forma: 'qualquer' } });
    assert.equal(m.destinoDaAcao({ destino: 'xx' }), 'evento');
    assert.match(m.resumoDaAcao({ destino: 'nenhum' }), /sem evento/);
    // Espelho do servidor: mesma regra de transição.
    for (const [a, b, r] of [['nenhum', 'autos', 'autos'], ['evento', 'nenhum', 'evento'], ['nenhum', 'nenhum', 'nenhum'], ['informacao', 'evento', 'informacao'], ['autos', 'evento', 'evento']]) {
        assert.equal(m.destinoTransicao(a, b), r, `${a}+${b}`);
    }
    const fs = [{ id: 'a' }, { id: 'b', proximas: ['a'] }, { id: 'c', final: true }];
    assert.deepEqual(m.saidasDaFase(fs, fs[0]).map((x) => x.id), ['b']);
    assert.deepEqual(m.saidasDaFase(fs, fs[1]).map((x) => x.id), ['a']);
    assert.deepEqual(m.saidasDaFase(fs, fs[2]), []);
    const f = { id: 'f', acoes: ['A', 'B'], acoes_regras: [{ obrigatoria: true }, { documento: { descricao: 'B', forma: 'qualquer', destino: 'evento' } }] };
    assert.deepEqual(m.faltaNaFase(f, {}, []).map((e) => e.descricao), ['B', 'A']);
    assert.equal(m.atende({ forma: 'qualquer', destino: 'evento' }, { origem: 'upload' }), false);
    assert.equal(m.atende({ forma: 'qualquer', destino: 'evento' }, { origem: 'upload', controle: true }), true);
});

test('certidão conjunta: destino da ação, grupo pela raiz e título', async () => {
    const m = await import('./exigencias.js');
    assert.equal(m.destinoDaAcao({ destino: 'consolidar' }), 'consolidar');
    assert.equal(m.partesVeem({ destino: 'consolidar', partes: true }), true, 'confirmação simples aparece na certidão');
    assert.equal(m.ROTULO_DESTINO.consolidar, 'na certidão conjunta');
    const fs = [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B', certidao: { grupo: 'a' } }, { id: 'c', nome: 'C', certidao: { grupo: 'b' } }, { id: 'd', nome: 'D' }];
    assert.equal(m.grupoDe(fs, fs[2]), 'a', 'no editor a cadeia segue até a raiz');
    assert.equal(m.grupoDe(fs, fs[3]), 'd');
    assert.equal(m.tituloCertidao(fs, 'a'), 'Certidão das fases A, B, C');
    const ciclo = [{ id: 'p', certidao: { grupo: 'q' } }, { id: 'q', certidao: { grupo: 'p' } }];
    assert.ok(['p', 'q'].includes(m.grupoDe(ciclo, ciclo[0])), 'ciclo não trava');
});

test('certidão conjunta: mudança dentro do grupo e exclusão da fase raiz', async () => {
    const m = await import('./exigencias.js');
    const fs = [{ id: 'a', nome: 'A', certidao: { titulo: 'T' } }, { id: 'b', nome: 'B', certidao: { grupo: 'a', incluir_mudancas: true } },
        { id: 'c', nome: 'C', certidao: { grupo: 'a' } }, { id: 'd', nome: 'D' }];
    assert.equal(m.destinoDaMudanca(fs, fs[0], fs[1]), 'consolidar');
    assert.equal(m.destinoDaMudanca(fs, fs[0], fs[2]), 'autos', 'nenhuma das duas pediu');
    assert.equal(m.destinoDaMudanca(fs, fs[1], fs[3]), 'autos', 'fora do grupo');
    const sem = m.tirarDoGrupo(fs, 'a').filter((f) => f.id !== 'a');
    assert.deepEqual(sem.find((f) => f.id === 'b').certidao, { incluir_mudancas: true, titulo: 'T' }, 'a primeira vira raiz e herda o título');
    assert.deepEqual(sem.find((f) => f.id === 'c').certidao, { grupo: 'b' });
    const meio = m.tirarDoGrupo([{ id: 'r' }, { id: 's', certidao: { grupo: 'r' } }, { id: 't', certidao: { grupo: 's' } }], 's');
    assert.deepEqual(meio[2].certidao, { grupo: 'r' }, 'fase do meio sai e as outras sobem para o grupo dela');
    assert.equal(m.tirarDoGrupo(fs, 'd'), fs);
});

test('outros atos da fase: padrão, escolha e registro_atos sem perder fase e remessas', async () => {
    const m = await import('./exigencias.js');
    assert.equal(m.destinoDoAto({}, 'prazo'), 'autos');
    assert.equal(m.destinoDoAto({}, 'atribuicao'), 'evento');
    assert.equal(m.destinoDoAto({ registro_atos: { outros: { atribuicao: 'autos' } } }, 'atribuicao'), 'evento');
    assert.ok(!m.opcoesDoAto('atribuicao').some(([d]) => d === 'autos'));
    assert.deepEqual(m.comOutros({ fase: 'evento' }, { prazo: 'nenhum', pendencia: 'autos', atribuicao: 'evento' }), { fase: 'evento', outros: { prazo: 'nenhum' } });
    assert.deepEqual(m.comOutros({ fase: 'evento', outros: { prazo: 'nenhum' } }, { prazo: 'autos' }), { fase: 'evento' });
    assert.equal(m.comOutros(undefined, {}), undefined);
    // Fase no formato antigo: mudar os outros atos não perde entrar/sair e remessas.
    assert.deepEqual(m.registroComOutros({ registro: 'interno' }, { prazo: 'nenhum' }), { fase: 'evento', remessas: 'evento', outros: { prazo: 'nenhum' } });
    assert.deepEqual(m.registroComOutros({ registro: 'remessas_fora' }, {}), { remessas: 'evento' });
});

test('níveis: obrigatório, recomendado e opcional', async () => {
    const m = await import('./exigencias.js');
    const f = {
        id: 'f', acoes: ['Doc', 'Avisar', 'Conferir'],
        documentos: [{ descricao: 'Parecer' }, { descricao: 'Foto', nivel: 'recomendado' }, { descricao: 'Mapa', nivel: 'opcional' }],
        acoes_regras: [{ documento: { descricao: 'Doc', forma: 'qualquer', nivel: 'opcional' } }, { recomendada: true }, { obrigatoria: true }],
    };
    assert.deepEqual(m.faltaNaFase(f, {}, []).map((e) => e.descricao), ['Parecer', 'Conferir']);
    assert.deepEqual(m.recomendadosNaFase(f, {}, []).map((e) => e.descricao), ['Foto', 'Avisar']);
    assert.deepEqual(m.recomendadosNaFase(f, { f: { d1: { documento_id: 'x' } } }, [1]), []);
    assert.equal(m.nivelDaAcao(null), 'opcional');
    assert.equal(m.nivelDaAcao({ documento: { descricao: 'a' } }), '');
    assert.deepEqual(m.regraComNivel({ ajuda: 'x', obrigatoria: true }, 'recomendado'), { ajuda: 'x', recomendada: true });
    assert.equal(m.regraComNivel({ obrigatoria: true }, 'opcional'), null);
    assert.deepEqual(m.regraComNivel({ documento: { descricao: 'a', nivel: 'opcional' }, ajuda: 'y' }, ''), { documento: { descricao: 'a' }, ajuda: 'y' });
    // Trocar o que a ação pede mantém a orientação e o nível.
    assert.deepEqual(m.regraComPedido({ ajuda: 'z', recomendada: true }, 'texto', 'A'), { pede: 'texto', recomendada: true, ajuda: 'z' });
    assert.equal(m.regraComPedido({ ajuda: 'z' }, 'documento', 'A').ajuda, 'z');
    // O nível sobrevive à troca entre documento e as demais.
    const doc = { documento: { descricao: 'A', forma: 'qualquer' } };
    assert.equal(m.nivelDaAcao(m.regraComPedido(doc, 'texto', 'A')), '');
    assert.equal(m.nivelDaAcao(m.regraComPedido({ recomendada: true }, 'documento', 'A')), 'recomendado');
    assert.equal(m.nivelDaAcao(m.regraComPedido({ documento: { descricao: 'A', nivel: 'recomendado' } }, 'confirmar', 'A')), 'recomendado');
    assert.equal(m.nivelDaAcao(m.regraComPedido(null, 'documento', 'A')), '');
});

test('dado reservado: só dado digitado fora dos autos, e segue na troca de pedido que ainda serve', async () => {
    const { podeReservar, regraComPedido } = await import('./exigencias.js');
    assert.equal(podeReservar({ pede: 'texto' }), true);
    assert.equal(podeReservar({ pede: 'texto', destino: 'autos' }), false);
    assert.equal(podeReservar({ pede: 'lista', opcoes: ['a', 'b'] }), false);
    assert.equal(podeReservar(null), false);
    assert.equal(podeReservar({ pede: 'formulario', campos: [{ tipo: 'registro' }] }), false);
    assert.equal(regraComPedido({ pede: 'texto', ve: 'gestor' }, 'numero', 'X').ve, 'gestor');
    assert.equal(regraComPedido({ pede: 'texto', ve: 'gestor' }, 'sim_nao', 'X')?.ve, undefined);
});

test('condição por campo do formulário, ações alternativas e ação que só orienta', async () => {
    const x = await import('./exigencias.js');
    const sistema = { id: 'sistema', rotulo: 'Sistema utilizado', tipo: 'lista', opcoes: ['SIM', 'SPU'] };
    const f = { acoes: ['Dados básicos', 'Há urgência?', 'Registrar no SIM', 'Enviar pelo SIGO', 'Inserir no SIM', 'Conferir anexos'], acoes_regras: [
        { pede: 'formulario', campos: [{ id: 'orgao', rotulo: 'Órgão', tipo: 'texto' }, sistema] },
        { pede: 'sim_nao' },
        { obrigatoria: true, se: { acao: 0, campo: 'sistema', valores: ['SPU'] } },
        { obrigatoria: true },
        { recomendada: true, ou: 3 },
        { pede: 'orientacao' },
    ] };
    // O que pode condicionar: a resposta da ação de escolha e o campo de escolha do formulário.
    assert.deepEqual(x.fontesDeEscolha(f).map((s) => x.chaveDaCondicao(s)), ['0.sistema', '1']);
    assert.deepEqual(x.fontesDeEscolha(f, 1).map((s) => s.campo), ['sistema'], 'só as ações antes do limite');
    assert.deepEqual(x.opcoesDaResposta(f.acoes_regras[0], 'sistema'), [['SIM', 'SIM'], ['SPU', 'SPU']]);
    assert.equal(x.opcoesDaResposta(f.acoes_regras[0], 'orgao'), null);
    assert.equal(x.opcoesDaResposta({ ...f.acoes_regras[0], ve: 'gestor' }, 'sistema'), null, 'dado reservado não condiciona');
    assert.equal(x.textoCondicao(f, f.acoes_regras[2].se), '"Sistema utilizado" for SPU');
    assert.equal(x.problemaDaCondicao(f, f.acoes_regras[2].se, 2), null);
    assert.match(x.problemaDaCondicao(f, { acao: 0, campo: 'sumiu', valores: ['SPU'] }, 2), /campo que não existe mais/);
    assert.equal(x.acaoAtiva(f, 2, { '0.sistema': 'SPU' }), true);
    assert.equal(x.acaoAtiva(f, 2, { '0.sistema': 'SIM' }), false);

    // Alternativas: cumprida uma, a outra não é cobrada nem recomendada.
    assert.deepEqual(x.alternativasPossiveis(f, 4).map(([k]) => k), [0, 1, 2, 3], 'as anteriores que se marcam');
    assert.deepEqual(x.alternativasPossiveis(f, 0), []);
    assert.deepEqual(x.acoesObrigatoriasPendentes(f, [], {}), [{ descricao: 'Enviar pelo SIGO ou Inserir no SIM', acao_idx: 3 }]);
    assert.deepEqual(x.acoesObrigatoriasPendentes(f, [4], {}), []);
    assert.deepEqual(x.recomendadosNaFase(f, {}, [3], {}), []);
    assert.equal(x.alternativaCumprida(f, 3, new Set([4]), {}), true);

    // Só orientação: não se marca; ao virar orientação, perde nível, destino e alternativa, e mantém a condição.
    assert.equal(x.soOrienta(f.acoes_regras[5]), true);
    assert.equal(x.pedeDado(f.acoes_regras[5]), false);
    assert.match(x.resumoDaAcao(f.acoes_regras[5]), /só orientação/);
    const virou = x.regraComPedido({ obrigatoria: true, destino: 'autos', ou: 3, quem: 'gestor', ajuda: 'Ramal', se: { acao: 1, valores: ['sim'] } }, 'orientacao', 'X');
    assert.deepEqual(virou, { pede: 'orientacao', ajuda: 'Ramal', se: { acao: 1, valores: ['sim'] } });
    assert.equal(x.regraComPedido({ ou: 3, obrigatoria: true }, 'texto', 'X').ou, 3, 'a alternativa segue na troca de pedido');

    // Ao reordenar: a condição por campo e a alternativa acompanham a ação; alternativa que passou para a frente sai.
    const troca = x.remapearCondicoes(f, [1, 0, 2, 3, 4, 5], [f.acoes_regras[1], f.acoes_regras[0], ...f.acoes_regras.slice(2)]);
    assert.deepEqual(troca.acoes_regras[2].se, { acao: 1, campo: 'sistema', valores: ['SPU'] });
    assert.equal(troca.acoes_regras[4].ou, 3);
    const inverte = x.remapearCondicoes(f, [0, 1, 2, 4, 3, 5], [f.acoes_regras[0], f.acoes_regras[1], f.acoes_regras[2], f.acoes_regras[4], f.acoes_regras[3], f.acoes_regras[5]]);
    assert.equal(inverte.acoes_regras[3].ou, undefined);
});

test('folha de dados: só ação que pede dado, sem reserva; a marca segue na troca de pedido', async () => {
    const x = await import('./exigencias.js');
    assert.equal(x.podeIrParaFolha({ pede: 'texto' }), true);
    assert.equal(x.podeIrParaFolha({ pede: 'formulario', campos: [] }), true);
    assert.equal(x.podeIrParaFolha(null), false, 'só confirmar');
    assert.equal(x.podeIrParaFolha({ pede: 'orientacao' }), false);
    assert.equal(x.podeIrParaFolha({ documento: { forma: 'qualquer' } }), false);
    assert.equal(x.podeIrParaFolha({ pede: 'texto', ve: 'gestor' }), false);
    assert.equal(x.regraComPedido({ pede: 'texto', folha_dados: true }, 'data', 'X').folha_dados, true);
    assert.equal(x.regraComPedido({ pede: 'texto', folha_dados: true }, 'confirmar', 'X')?.folha_dados, undefined);
    assert.equal(x.regraComPedido({ pede: 'texto', folha_dados: true }, 'orientacao', 'X').folha_dados, undefined);
    assert.match(x.resumoDaAcao({ pede: 'texto', destino: 'informacao', folha_dados: true }), /na folha de dados/);
});
