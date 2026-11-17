// Listas do órgão a partir de arquivo: leitura no servidor e proposta para a prévia.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const JSZip = require('jszip');
const l = require('../lib/shared/listasOrgao');
const { propostaDoArquivo, MIMES_LISTAS } = require('../lib/secretaria/listasArquivo');
const { docParaDocx } = require('../lib/secretaria/docxExportar');
const s = require('../lib/shared/secretaria');

const nomes = (r, lista) => r.itens.filter((i) => i.lista === lista).map((i) => i.nome);

test('títulos: reconhece cada lista pelo nome, com ou sem "espécies", acento, número ou dois-pontos', () => {
    assert.equal(l.listaDoTitulo('Espécies de comunicação:'), 'comunicacao');
    assert.equal(l.listaDoTitulo('2. COMUNICAÇÕES'), 'comunicacao');
    assert.equal(l.listaDoTitulo('# Tipos de audiência'), 'audiencia');
    assert.equal(l.listaDoTitulo('Planilha: Origens do processo'), 'origem');
    assert.equal(l.listaDoTitulo('Edital'), null);
    assert.equal(l.listaDoTitulo('Comunicação extrajudicial'), null, 'item com a palavra não é título');
});

test('texto: seções, marcadores, gênero escrito, artigo, inline e linha longa fora', () => {
    const r = l.propostaDeBlocos([
        { linha: 'Espécies de comunicação' }, { linha: '- Edital (m)' }, { linha: '2) A convocação' }, { linha: '• Notificação extrajudicial' },
        { linha: 'Audiências: Sessão de mediação; Reunião de conciliação' },
        { linha: 'Origens do processo' }, { linha: 'Ouvidoria' }, { linha: 'o Disque 100' },
        { linha: 'Este parágrafo explica o que é cada uma das listas acima e não é item.' },
        { linha: 'Outros:' }, { linha: 'Termo avulso' },
    ]);
    assert.deepEqual(r.itens.filter((i) => i.lista === 'comunicacao'), [
        { lista: 'comunicacao', nome: 'Edital', m: true }, { lista: 'comunicacao', nome: 'Convocação' }, { lista: 'comunicacao', nome: 'Notificação extrajudicial' },
    ]);
    assert.deepEqual(nomes(r, 'audiencia'), ['Sessão de mediação', 'Reunião de conciliação']);
    assert.deepEqual(r.itens.filter((i) => i.lista === 'origem'), [{ lista: 'origem', nome: 'Ouvidoria' }, { lista: 'origem', nome: 'Disque 100' }], 'origem não tem gênero');
    assert.deepEqual(r.itens.filter((i) => !i.lista), [{ lista: null, nome: 'Termo avulso', m: true, m_suposto: true }], '"Outros:" fecha a seção');
    assert.equal(r.avisos.length, 2);
    assert.match(r.avisos[0], /Uma linha ficou de fora/);
    assert.match(r.avisos[1], /Escolha a lista/);
});

test('gênero estimado só quando o arquivo não diz', () => {
    assert.equal(l.pareceMasculino('Edital'), true);
    assert.equal(l.pareceMasculino('Mandado de verificação'), true);
    assert.equal(l.pareceMasculino('Sessão de mediação'), false);
    assert.equal(l.pareceMasculino('Mensagem'), false);
    assert.equal(l.pareceMasculino('Convocação'), false);
});

test('tabelas: coluna por lista, colunas lista/nome/gênero e repetidos fora', () => {
    const porColuna = l.propostaDeBlocos([{ tabela: [['Comunicação', 'Origem'], ['Edital', 'Ouvidoria'], ['Convocação', ''], ['Edital', 'Corregedoria']] }]);
    assert.deepEqual(nomes(porColuna, 'comunicacao'), ['Edital', 'Convocação']);
    assert.deepEqual(nomes(porColuna, 'origem'), ['Ouvidoria', 'Corregedoria']);
    const linhas = l.propostaDeBlocos([{ tabela: [['Lista', 'Nome', 'Masculino'], ['Audiência', 'Oitiva especial', 'não'], ['comunicações', 'Ofício circular', 'sim'], ['', 'Solto', '']] }]);
    assert.deepEqual(linhas.itens, [
        { lista: 'audiencia', nome: 'Oitiva especial' }, { lista: 'comunicacao', nome: 'Ofício circular', m: true }, { lista: null, nome: 'Solto', m: true, m_suposto: true },
    ]);
    // Aba com o nome da lista e sem cabeçalho: todas as linhas são itens dela.
    const aba = l.propostaDeBlocos([{ linha: 'Planilha: Origens', titulo: true }, { tabela: [['Ouvidoria'], ['Disque 100']] }]);
    assert.deepEqual(nomes(aba, 'origem'), ['Ouvidoria', 'Disque 100']);
});

test('CSV e JSON', () => {
    assert.deepEqual(l.tabelaDoCsv('lista;nome\ncomunicacao;"Edital; com ponto e vírgula"\r\norigem;Ouvidoria\n'), [['lista', 'nome'], ['comunicacao', 'Edital; com ponto e vírgula'], ['origem', 'Ouvidoria']]);
    assert.equal(l.tabelaDoCsv('Edital\nConvocação'), null, 'uma coluna = texto');
    const j = l.propostaDeBlocos(l.blocosDoJson({ listas: { comunicacao: ['Edital', { nome: 'Convocação', m: false }], audiencias: [{ name: 'Sessão de mediação' }] }, origem: 'Ouvidoria' }));
    assert.deepEqual(j.itens, [
        { lista: 'comunicacao', nome: 'Edital', m: true, m_suposto: true }, { lista: 'comunicacao', nome: 'Convocação' },
        { lista: 'audiencia', nome: 'Sessão de mediação' }, { lista: 'origem', nome: 'Ouvidoria' },
    ]);
    const arr = l.propostaDeBlocos(l.blocosDoJson([{ lista: 'origem', nome: 'Corregedoria' }, 'Solto']));
    assert.deepEqual(arr.itens.map((i) => [i.lista, i.nome]), [['origem', 'Corregedoria'], [null, 'Solto']]);
});

test('teto de itens lidos', () => {
    const r = l.propostaDeBlocos([{ linha: 'Origens' }, ...Array.from({ length: 400 }, (_, i) => ({ linha: `Origem número ${i}` }))]);
    assert.equal(r.itens.length, l.MAX_ITENS_PROPOSTA);
    assert.match(r.avisos[0], /li os 300 primeiros/);
});

test('arquivos de verdade: texto, CSV, JSON, Word e Excel', async () => {
    const txt = await propostaDoArquivo(Buffer.from('Espécies de comunicação\nEdital (m)\n\nOrigens\nOuvidoria\n'), 'text/plain', 'listas.txt');
    assert.deepEqual(txt.itens.map((i) => i.nome), ['Edital', 'Ouvidoria']);
    const latin = await propostaDoArquivo(Buffer.from('Origens\nOuvidoria Geral\nCorreição\n', 'latin1'), 'text/plain', 'a.txt');
    assert.deepEqual(nomes(latin, 'origem'), ['Ouvidoria Geral', 'Correição'], 'texto em Latin-1 não vira lixo');
    const csv = await propostaDoArquivo(Buffer.from('Comunicação,Audiência\nEdital,Sessão de mediação\n'), 'text/csv', 'l.csv');
    assert.deepEqual(csv.itens.map((i) => [i.lista, i.nome]), [['comunicacao', 'Edital'], ['audiencia', 'Sessão de mediação']]);
    const json = await propostaDoArquivo(Buffer.from('{"origem":["Ouvidoria"]}'), 'application/json', 'l.json');
    assert.deepEqual(nomes(json, 'origem'), ['Ouvidoria']);
    await assert.rejects(propostaDoArquivo(Buffer.from('{"origem":['), 'application/json', 'l.json'), /JSON não pôde ser lido/);

    const doc = { type: 'doc', content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Espécies de audiência' }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sessão de mediação' }] }] }] },
        { type: 'table', content: [
            { type: 'tableRow', content: ['Origem', 'Comunicação'].map((t) => ({ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] })) },
            { type: 'tableRow', content: ['Ouvidoria', 'Edital'].map((t) => ({ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: t }] }] })) },
        ] },
    ] };
    const docx = await docParaDocx(doc);
    const w = await propostaDoArquivo(docx, MIMES_LISTAS[4], 'l.docx');
    assert.deepEqual(w.itens.map((i) => [i.lista, i.nome]), [['audiencia', 'Sessão de mediação'], ['origem', 'Ouvidoria'], ['comunicacao', 'Edital']]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Ouvidoria'], ['Disque 100']]), 'Origens');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Nome', 'Gênero'], ['Edital', 'm'], ['Carta precatória', 'f']]), 'Comunicações');
    const xlsx = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const x = await propostaDoArquivo(xlsx, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'l.xlsx');
    assert.deepEqual(x.itens, [
        { lista: 'origem', nome: 'Ouvidoria' }, { lista: 'origem', nome: 'Disque 100' },
        { lista: 'comunicacao', nome: 'Edital', m: true }, { lista: 'comunicacao', nome: 'Carta precatória' },
    ]);
    const ods = await propostaDoArquivo(XLSX.write(wb, { type: 'buffer', bookType: 'ods' }), 'application/vnd.oasis.opendocument.spreadsheet', 'l.ods');
    assert.equal(ods.itens.length, 4);
});

test('arquivo malicioso: ZIP que mente o tamanho não abre, nem disfarçado de .xls', async () => {
    const zip = new JSZip();
    zip.file('a.txt', 'x'.repeat(130 * 1024 * 1024));
    const bomba = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await assert.rejects(propostaDoArquivo(bomba, 'application/vnd.ms-excel', 'l.xls'), /grande demais/);
});

test('histórico: exclusões de vez têm assunto próprio', () => {
    for (const a of ['RITO', 'TIPO', 'MODELO', 'PROCESSO']) assert.equal(s.assuntoHistorico(`SECRETARIA_${a}_EXCLUIDO_DEFINITIVO`, {}), 'lixeira');
    assert.ok(s.acoesHistorico('lixeira').flat().includes('SECRETARIA_PROCESSO_EXCLUIDO_DEFINITIVO'));
});
