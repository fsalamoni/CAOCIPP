// Registro nos autos e documentos exigidos pelo rito. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const x = require('../lib/shared/exigencias');
const a = require('../lib/shared/autos');
const s = require('../lib/shared/secretaria');

test('cumprimento grava exigência e marca a ação; reentrada na fase recomeça', () => {
    const proc = { exigencias_cumpridas: { f0: { d0: { documento_id: 'z', ordem: 1 } } }, acoes_feitas: { f1: [2] } };
    const c = x.camposDoCumprimento(proc, 'f1', [{ chave: 'd0' }, { chave: 'a0', acao_idx: 0 }], 'doc1', 4);
    assert.deepEqual(c.exigencias_cumpridas.f1, { d0: { documento_id: 'doc1', ordem: 4 }, a0: { documento_id: 'doc1', ordem: 4 } });
    assert.ok(c.exigencias_cumpridas.f0);
    assert.deepEqual(c.acoes_feitas.f1, [0, 2]);
    assert.deepEqual(x.camposDoCumprimento(proc, 'f1', [], 'doc1', 4), {});
    const volta = x.camposAoEntrarNaFase({ ...proc, ...c }, 'f1');
    assert.deepEqual(Object.keys(volta.exigencias_cumpridas), ['f0']);
    assert.deepEqual(volta.acoes_feitas, {});
    assert.deepEqual(x.camposAoEntrarNaFase(proc, 'f9'), {});
});

test('pendência aberta à mão não aparece para as partes, mesmo com termo nos autos', () => {
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'pendencia' }), false);
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'atribuicao' }), false);
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'pendencia_resolvida' }), true);
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'peticao' }), true);
});

test('petição da parte conta como documento recebido de fora', () => {
    const redigir = { descricao: 'R', forma: 'redigir' };
    const juntar = { descricao: 'J', forma: 'juntar', tipo: 'Contestação' };
    const pet = { origem: 'editor', tipo: 'Contestação', peticao: true };
    assert.equal(x.atende(redigir, pet), false);
    assert.equal(x.atende(juntar, pet), true);
    assert.deepEqual(x.reconhecer([{ ...juntar, chave: 'd0' }, { ...redigir, tipo: 'Contestação', chave: 'd1' }], pet), ['d0']);
});

test('sanitizeRegras alinha regras às ações e descarta lixo', () => {
    const r = x.sanitizeRegras({
        registro: 'interno',
        acoes_regras: [{ autos: true }, { documento: { forma: 'redigir', tipo: 'Despacho' } }, { autos: 'sim' }],
        documentos: [{ descricao: 'Parecer', forma: 'xyz' }, { descricao: '' }, ...Array(9).fill({ descricao: 'D' })],
    }, ['Certificar', 'Despachar', 'Outra']);
    // formato antigo convertido: registro 'interno' = fase e remessas no extrato; autos: true = certidão vista pelas partes
    assert.deepEqual(r.registro_atos, { fase: 'evento', remessas: 'evento' });
    assert.deepEqual(r.acoes_regras, [{ destino: 'autos', partes: true }, { documento: { descricao: 'Despachar', forma: 'redigir', tipo: 'Despacho' } }, null]);
    assert.equal(r.documentos.length, x.MAX_DOCUMENTOS_FASE);
    assert.equal(r.documentos[0].forma, 'qualquer');
    assert.deepEqual(x.sanitizeRegras({ registro: 'outro' }, ['A']), {});
});

test('sanitizeRito preserva as regras da fase', () => {
    const rito = s.sanitizeRito({ nome: 'R', fases: [{ nome: 'F', acoes: ['A'], registro: 'remessas_fora', acoes_regras: [{ autos: true }], documentos: [{ descricao: 'Parecer' }] }] });
    const f = rito.fases[0];
    assert.deepEqual(f.registro_atos, { remessas: 'evento' });
    assert.equal(f.registro, undefined);
    assert.deepEqual(f.acoes_regras, [{ destino: 'autos', partes: true }]);
    assert.deepEqual(f.documentos, [{ descricao: 'Parecer', forma: 'qualquer' }]);
    // linha vazia entre as ações: a regra continua com a ação certa
    const r2 = s.sanitizeRito({ nome: 'R', fases: [{ nome: 'F', acoes: ['A', ' ', 'B'], acoes_regras: [null, null, { autos: true }] }] });
    assert.deepEqual(r2.fases[0].acoes, ['A', 'B']);
    assert.deepEqual(r2.fases[0].acoes_regras, [null, { destino: 'autos', partes: true }]);
});

test('pendências, reconhecimento e forma do documento', () => {
    const fase = { id: 'f1', acoes: ['Despachar'], documentos: [{ descricao: 'Parecer', forma: 'juntar', tipo: 'Parecer' }],
        acoes_regras: [{ documento: { descricao: 'Despachar', forma: 'redigir', modelo_id: 'm1' } }] };
    assert.deepEqual(x.pendentesDaFase(fase, {}).map((e) => e.chave), ['d0', 'a0']);
    assert.deepEqual(x.pendentesDaFase(fase, { f1: { d0: { documento_id: 'x', ordem: 1 } } }).map((e) => e.chave), ['a0']);
    const pend = x.pendentesDaFase(fase, {});
    // reconhece pelo modelo e pelo tipo, respeitando a forma
    assert.deepEqual(x.reconhecer(pend, { origem: 'editor', modelo_id: 'm1' }), ['a0']);
    assert.deepEqual(x.reconhecer(pend, { origem: 'upload', tipo: 'parecer' }), ['d0']);
    assert.deepEqual(x.reconhecer(pend, { origem: 'editor', tipo: 'Parecer' }), []);
    // escolha explícita é validada
    assert.deepEqual(x.reconhecer(pend, { origem: 'upload' }, ['d0']), ['d0']);
    assert.deepEqual(x.reconhecer(pend, { origem: 'upload' }, []), []);
    assert.throws(() => x.reconhecer(pend, { origem: 'upload' }, ['a0']), /redigido/);
    assert.throws(() => x.reconhecer(pend, { origem: 'upload' }, ['d9']), /não está pendente/);
});

test('minuta: vê a unidade que redigiu e as unidades para onde seguiu com o processo', () => {
    const doc = { unidade_origem: 'assessoria', unidades_acesso: ['gabinete'] };
    assert.equal(s.minutaAcessivel(doc, ['assessoria']), true);
    assert.equal(s.minutaAcessivel(doc, ['secretaria', 'gabinete']), true);
    assert.equal(s.minutaAcessivel(doc, ['secretaria']), false);
    assert.equal(s.minutaAcessivel({ unidade_origem: 'a' }, ['b']), false);
});

test('movimentoInterno segue o registro das fases (formato antigo)', () => {
    const fases = [{ id: 'a' }, { id: 'b', registro: 'interno' }, { id: 'c', registro: 'remessas_fora' }];
    assert.equal(x.movimentoInterno(fases, 'a', 'b'), true);
    assert.equal(x.movimentoInterno(fases, 'b', 'a'), true);
    assert.equal(x.movimentoInterno(fases, 'a', 'c'), false);
    assert.equal(x.movimentoInterno(fases, 'c', null), true);
    assert.equal(x.movimentoInterno(fases, 'a', 'a'), false);
});

test('origem do evento e visibilidade para as partes', () => {
    assert.equal(a.origemEvento({ seq: 1, tipo: 'tramitacao', dados: { interno: true } }), 'interno');
    assert.equal(a.origemEvento({ seq: 1, tipo: 'acao_fase', dados: { nos_autos: true } }), 'usuario');
    assert.equal(a.origemEvento({ seq: 1, tipo: 'acao_fase' }), 'sistema');
    assert.equal(a.geraTermo({ seq: 1, tipo: 'tramitacao', dados: { interno: true } }), false);
    assert.equal(a.tituloEvento({ seq: 1, tipo: 'acao_fase', dados: { nos_autos: true } }), 'Certidão de cumprimento');
    assert.equal(a.tituloEvento({ seq: 1, tipo: 'tramitacao', dados: { interno: true } }), 'Remessa (registro interno)');
    assert.equal(a.tituloEvento({ seq: 1, tipo: 'fase', dados: { interno: true } }), 'Mudança de fase (registro interno)');
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'tramitacao' }), true);
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'tramitacao', dados: { interno: true } }), false);
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'acao_fase' }), false);
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'acao_fase', dados: { nos_autos: true } }), true);
    assert.equal(a.visivelParaPartes({ seq: 1, tipo: 'juntada', dados: { visivel_partes: false } }), false);
});

test('ação que pede um dado: saneamento, destino, quem vê e obrigatoriedade', () => {
    const r = x.sanitizeRegras({
        registro_atos: { fase: 'informacao', remessas: 'autos' },
        acoes_regras: [
            { pede: 'texto', rotulo: 'Sistema de origem', destino: 'informacao', partes: false, obrigatoria: true },
            { pede: 'numero', rotulo: 'Número no SIM', destino: 'autos', partes: true },
            { pede: 'lista', opcoes: ['PGEA', 'Arquivamento', 'PGEA'] },
            { pede: 'documento', documento: { forma: 'juntar', destino: 'informacao' } },
            { pede: 'xyz', destino: 'lugar nenhum' },
        ],
    }, ['Informar sistema', 'Registrar no SIM', 'Converter', 'Anexar print', 'Conferir']);
    assert.deepEqual(r.registro_atos, { fase: 'informacao' });
    assert.deepEqual(r.acoes_regras[0], { pede: 'texto', rotulo: 'Sistema de origem', destino: 'informacao', obrigatoria: true });
    assert.deepEqual(r.acoes_regras[1], { pede: 'numero', rotulo: 'Número no SIM', destino: 'autos', partes: true });
    assert.deepEqual(r.acoes_regras[2], { pede: 'lista', opcoes: ['PGEA', 'Arquivamento'] });
    assert.deepEqual(r.acoes_regras[3], { documento: { descricao: 'Anexar print', forma: 'juntar', destino: 'informacao' } });
    assert.equal(r.acoes_regras[4], null);
    assert.throws(() => x.sanitizeRegras({ acoes_regras: [{ pede: 'lista', opcoes: ['Só uma'] }] }, ['Escolher']), /duas opções/);
    assert.equal(x.destinoDaAcao(null), 'evento');
    assert.equal(x.destinoDaAcao({ autos: true }), 'autos');
    assert.equal(x.destinoDaAcao({ documento: { descricao: 'D', forma: 'qualquer' } }), 'autos');
    assert.equal(x.destinoDaAcao(r.acoes_regras[3]), 'informacao');
    assert.equal(x.partesVeem({ autos: true }), true);
    assert.equal(x.partesVeem({ destino: 'autos' }), false);
    assert.equal(x.pedidoDaAcao(r.acoes_regras[1]), 'numero');
    assert.equal(x.pedidoDaAcao(r.acoes_regras[3]), 'documento');
    const fase = { id: 'f', acoes: ['Informar sistema', 'Registrar no SIM'], acoes_regras: r.acoes_regras.slice(0, 2) };
    assert.deepEqual(x.acoesObrigatoriasPendentes(fase, []).map((e) => e.acao_idx), [0]);
    assert.deepEqual(x.acoesObrigatoriasPendentes(fase, [0]), []);
});

test('destino do movimento em três níveis e marcas nos dados', () => {
    const fases = [{ id: 'a' }, { id: 'b', registro_atos: { fase: 'informacao' } }, { id: 'c', registro_atos: { fase: 'evento', remessas: 'informacao' } }, { id: 'd', registro: 'interno' }];
    assert.equal(x.destinoDoMovimento(fases, 'a', 'b'), 'informacao');
    assert.equal(x.destinoDoMovimento(fases, 'c', 'a'), 'evento');
    assert.equal(x.destinoDoMovimento(fases, 'c', 'b'), 'informacao');
    assert.equal(x.destinoDoMovimento(fases, 'c', null), 'informacao');
    assert.equal(x.destinoDoMovimento(fases, 'd', 'a'), 'evento');
    assert.equal(x.destinoDoMovimento(fases, 'a', null), 'autos');
    assert.deepEqual(x.marcasDoDestino('autos'), {});
    assert.deepEqual(x.marcasDoDestino('evento'), { interno: true });
    assert.deepEqual(x.marcasDoDestino('informacao'), { interno: true, fora_impressao: true });
});

test('documento de controle só cumpre exigência de controle, e juntada só a dos autos', () => {
    const pend = [{ chave: 'd0', descricao: 'Parecer', forma: 'qualquer', tipo: 'Parecer' }, { chave: 'a1', descricao: 'Print', forma: 'juntar', tipo: 'Print', destino: 'informacao' }];
    assert.deepEqual(x.reconhecer(pend, { origem: 'upload', tipo: 'Print' }), []);
    assert.deepEqual(x.reconhecer(pend, { origem: 'upload', tipo: 'Print', controle: true }), ['a1']);
    assert.deepEqual(x.reconhecer(pend, { origem: 'upload', tipo: 'Parecer', controle: true }), []);
    assert.throws(() => x.reconhecer(pend, { origem: 'upload' }, ['a1']), /Guardar fora dos autos/);
    assert.throws(() => x.reconhecer(pend, { origem: 'upload', controle: true }, ['d0']), /juntado aos autos/);
    assert.equal(a.tituloEvento({ seq: 1, tipo: 'guarda', dados: { interno: true } }), 'Documento guardado fora dos autos (registro interno)');
    assert.equal(a.documentoDoEvento({ seq: 1, tipo: 'guarda', dados: { documento_id: 'z', interno: true } }), null);
});

test('informações do andamento: valor por ação, desfazer tira a última, partes só o liberado', () => {
    const i = require('../lib/shared/informacoes');
    const fases = [{ id: 'f', nome: 'Entrada' }];
    const movs = [
        { seq: 1, tipo: 'autuacao' },
        { seq: 2, tipo: 'acao_fase', autor_nome: 'Ana', em: '2026-11-12T10:00:00Z', dados: { fase_id: 'f', acao_idx: 0, feita: true, rotulo: 'Sistema', tipo_valor: 'texto', valor: 'SEI', valor_texto: 'SEI', fora_impressao: true, visivel_partes: false } },
        { seq: 3, tipo: 'acao_fase', dados: { fase_id: 'f', acao_idx: 1, feita: true, rotulo: 'Nº SIM', tipo_valor: 'numero', valor: 12, valor_texto: '12', nos_autos: true, visivel_partes: true } },
        { seq: 4, tipo: 'acao_fase', dados: { fase_id: 'f', acao_idx: 0, feita: false } },
        { seq: 5, tipo: 'acao_fase', dados: { fase_id: 'f', acao_idx: 0, feita: true, rotulo: 'Sistema', tipo_valor: 'texto', valor: 'eproc', valor_texto: 'eproc', visivel_partes: false } },
        { seq: 6, tipo: 'acao_fase', dados: { fase_id: 'f', acao_idx: 2, feita: true } },
    ];
    const todas = i.informacoesDoAndamento(movs, fases);
    assert.deepEqual(todas.map((x) => [x.rotulo, x.valor_texto, x.destino]), [['Nº SIM', '12', 'autos'], ['Sistema', 'eproc', 'evento']]);
    assert.equal(todas[0].fase_nome, 'Entrada');
    assert.deepEqual(i.informacoesDoAndamento(movs, fases, true).map((x) => x.rotulo), ['Nº SIM']);
});

test('partes: ação de só confirmar fora dos autos não tem o que mostrar; guarda é interna', () => {
    const { partesVeem } = require('../lib/shared/exigencias');
    const { visivelParaPartes } = require('../lib/shared/autos');
    assert.equal(partesVeem({ partes: true }), false);
    assert.equal(partesVeem({ partes: true, destino: 'autos' }), true);
    assert.equal(partesVeem({ partes: true, pede: 'numero', destino: 'informacao' }), true);
    assert.equal(partesVeem({ autos: true }), true);
    assert.equal(visivelParaPartes({ seq: 1, tipo: 'guarda' }), false);
});

test('documento recomendado ou opcional não impede a fase; orientação em qualquer ação', () => {
    const r = x.sanitizeRegras({
        documentos: [{ descricao: 'Parecer', nivel: 'recomendado' }, { descricao: 'Foto', nivel: 'opcional' }, { descricao: 'Ofício', nivel: 'estranho' }],
        acoes_regras: [
            { documento: { forma: 'redigir', nivel: 'opcional' }, ajuda: 'Use o modelo da casa' },
            { ajuda: 'Confira o SIM antes' },
            { recomendada: true },
            { obrigatoria: true, recomendada: true },
        ],
    }, ['Despachar', 'Conferir', 'Avisar', 'Certificar']);
    assert.deepEqual(r.documentos.map((d) => d.nivel || null), ['recomendado', 'opcional', null]);
    assert.deepEqual(r.acoes_regras[0], { documento: { descricao: 'Despachar', forma: 'redigir', nivel: 'opcional' }, ajuda: 'Use o modelo da casa' });
    assert.deepEqual(r.acoes_regras[1], { ajuda: 'Confira o SIM antes' });
    assert.deepEqual(r.acoes_regras[2], { recomendada: true });
    assert.deepEqual(r.acoes_regras[3], { obrigatoria: true });
    const fase = { id: 'f', acoes: ['Despachar', 'Conferir', 'Avisar', 'Certificar'], ...r };
    // Pendentes (para reconhecer na juntada) seguem todos; o que impede a fase é só o obrigatório.
    assert.deepEqual(x.pendentesDaFase(fase, {}).map((e) => e.chave), ['d0', 'd1', 'd2', 'a0']);
    assert.deepEqual(x.documentosQueFaltam(fase, {}).map((e) => e.chave), ['d2']);
    assert.deepEqual(x.acoesObrigatoriasPendentes(fase, []).map((e) => e.acao_idx), [3]);
});

test('condições pela resposta: ação e saída, com índices e validação', () => {
    const rito = s.sanitizeRito({ nome: 'R', fases: [
        { id: 'a', nome: 'Análise', proximas: ['b', 'c'], acoes: ['Decidir', ' ', 'Notificar', 'Arquivar nota'],
            acoes_regras: [{ pede: 'lista', opcoes: ['Deferido', 'Indeferido'], obrigatoria: true }, null,
                { se: { acao: 0, valores: ['Indeferido', 'xpto'] }, obrigatoria: true, quem: 'gestor' }, { quem: 'qualquer' }],
            condicoes_regra: { b: { acao: 0, valores: ['Deferido'] }, c: { acao: 0, valores: ['Indeferido'] }, zz: { acao: 0, valores: ['Deferido'] } } },
        { id: 'b', nome: 'Deferimento', final: true },
        { id: 'c', nome: 'Recurso', final: true }] });
    const f = rito.fases[0];
    // Linha vazia saiu: "Notificar" passou a ser a ação 1 e a condição continua na ação 0.
    assert.deepEqual(f.acoes, ['Decidir', 'Notificar', 'Arquivar nota']);
    assert.deepEqual(f.acoes_regras[1].se, { acao: 0, valores: ['Indeferido'] });
    assert.equal(f.acoes_regras[1].quem, 'gestor');
    assert.equal(f.acoes_regras[2], null);
    assert.deepEqual(f.condicoes_regra, { b: { acao: 0, valores: ['Deferido'] }, c: { acao: 0, valores: ['Indeferido'] } });
    // Ação condicional não cobrada sem a resposta; cobrada com ela.
    assert.deepEqual(x.acoesObrigatoriasPendentes(f, [0], { 0: 'Deferido' }), []);
    assert.deepEqual(x.acoesObrigatoriasPendentes(f, [0], { 0: 'Indeferido' }).map((e) => e.acao_idx), [1]);
    assert.equal(x.condicaoAtendida(f.condicoes_regra.b, { 0: 'Deferido' }), true);
    assert.equal(x.condicaoAtendida(f.condicoes_regra.b, undefined), false);
    assert.equal(x.chaveDaResposta(false), 'nao');
    // Depender de ação posterior, de ação que não é escolha, ou sem resposta válida: recusa.
    assert.throws(() => s.sanitizeRito({ nome: 'R', fases: [{ nome: 'F', acoes: ['A', 'B'], acoes_regras: [{ se: { acao: 1, valores: ['sim'] } }, { pede: 'sim_nao' }] }] }), /ação de escolha anterior/);
    assert.throws(() => s.sanitizeRito({ nome: 'R', fases: [{ nome: 'F', acoes: ['A', 'B'], acoes_regras: [{ pede: 'texto' }, { se: { acao: 0, valores: ['x'] } }] }] }), /ação de escolha/);
    assert.throws(() => s.sanitizeRito({ nome: 'R', fases: [{ nome: 'F', acoes: ['A', 'B'], acoes_regras: [{ pede: 'sim_nao' }, { se: { acao: 0, valores: ['talvez'] } }] }] }), /ao menos uma resposta/);
    // Saída implícita (a seguinte da lista) também pode ter condição.
    const r2 = s.sanitizeRito({ nome: 'R', fases: [{ id: 'p', nome: 'P', acoes: ['Ok?'], acoes_regras: [{ pede: 'sim_nao' }], condicoes_regra: { q: { acao: 0, valores: ['sim'] } } }, { id: 'q', nome: 'Q' }] });
    assert.deepEqual(r2.fases[0].condicoes_regra, { q: { acao: 0, valores: ['sim'] } });
    // Documento de ação condicional só é exigido quando ela vale.
    const r3 = s.sanitizeRito({ nome: 'R', fases: [{ nome: 'F', acoes: ['Há recurso?', 'Juntar recurso'], acoes_regras: [{ pede: 'sim_nao' }, { pede: 'documento', se: { acao: 0, valores: ['sim'] } }] }] });
    assert.equal(x.pendentesDaFase(r3.fases[0], {}, { 0: 'nao' }).length, 0);
    assert.equal(x.pendentesDaFase(r3.fases[0], {}, { 0: 'sim' }).length, 1);
    // Reentrar na fase limpa as respostas da rodada.
    assert.deepEqual(x.camposAoEntrarNaFase({ acoes_respostas: { f: { 0: 'sim' }, g: {} } }, 'f'), { acoes_respostas: { g: {} } });
});

test('condições em cadeia: resposta de ação que deixou de valer não pesa', () => {
    const f = { acoes: ['Cabe recurso?', 'Decisão', 'Notificar'], acoes_regras: [{ pede: 'sim_nao' },
        { pede: 'lista', opcoes: ['A', 'B'], se: { acao: 0, valores: ['sim'] } },
        { obrigatoria: true, se: { acao: 1, valores: ['A'] } }] };
    assert.equal(x.acaoAtiva(f, 2, { 0: 'sim', 1: 'A' }), true);
    assert.equal(x.acaoAtiva(f, 2, { 0: 'nao', 1: 'A' }), false);
    assert.equal(x.condicaoAtendida({ acao: 1, valores: ['A'] }, { 1: 'A' }, f), false);
    assert.deepEqual(x.acoesObrigatoriasPendentes(f, [0, 1], { 0: 'nao', 1: 'A' }), []);
});

test('fase: prazo automático, nome para as partes e efeitos ao entrar', () => {
    const r = s.sanitizeRito({ nome: 'R', fases: [
        { id: 'a', nome: 'Análise', prazo_dias: 10, prazo_auto: true, prazo_contagem: 'corridos', nome_publico: 'Em análise', ao_entrar: { urgente: true, sem_responsavel: true, outro: true } },
        { id: 'b', nome: 'Fim', prazo_auto: true, nome_publico: 'Fim', ao_entrar: { urgente: 'sim' } },
    ] });
    const [a, b] = r.fases;
    assert.deepEqual([a.prazo_auto, a.prazo_contagem, a.nome_publico, a.ao_entrar], [true, 'corridos', 'Em análise', { urgente: true, sem_responsavel: true }]);
    // Sem dias, nada de prazo automático; nome igual ao oficial e efeito inválido saem.
    assert.deepEqual([b.prazo_auto, b.nome_publico, b.ao_entrar], [undefined, undefined, undefined]);
});
