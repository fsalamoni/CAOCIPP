// Página e estilos do documento na tela: CSS da folha, limpeza do layout e o
// espelho do servidor (functions-v2/src/shared/layoutDocumento.ts). npm run test:lib
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
    ESTILOS_PADRAO, FORMATOS_LISTA, FORMATOS_NUMERO, FORMATOS_PARAGRAFO, FORMATOS_TITULO, MARCADORES, MARGENS_PADRAO, MODOS_FAIXA, PAGINAS_FAIXA, PAPEIS, POSICOES_NUMERO, TAMANHO_NUMERO,
    comTimbrado, cssDoLayout, faixaDoTimbrado, folhaCm, idDeEstilo, limparLayout, resumoPagina, textoNumero, trocarPagina,
} from './layoutDocumento.js';

const require = createRequire(import.meta.url);
let servidor = null;
try { servidor = require('../../functions-v2/lib/shared/layoutDocumento.js'); } catch { /* sem build do servidor: o espelho é conferido no CI do servidor */ }

test('espelho do servidor: papéis, margens, estilos e formatos', { skip: !servidor }, () => {
    assert.deepEqual(PAPEIS, servidor.PAPEIS);
    assert.deepEqual(MARGENS_PADRAO, servidor.MARGENS_PADRAO);
    assert.deepEqual(ESTILOS_PADRAO, servidor.ESTILOS_PADRAO);
    assert.deepEqual(FORMATOS_PARAGRAFO.map(([v]) => v), servidor.FORMATOS_PARAGRAFO);
    assert.deepEqual(FORMATOS_TITULO.map(([v]) => v), servidor.FORMATOS_TITULO);
    assert.deepEqual(MARCADORES.map(([v]) => v), servidor.MARCADORES);
    assert.deepEqual(FORMATOS_LISTA.map(([v]) => v), servidor.FORMATOS_LISTA);
    assert.deepEqual(MODOS_FAIXA.map(([v]) => v), servidor.MODOS_FAIXA);
    assert.deepEqual(PAGINAS_FAIXA.map(([v]) => v), servidor.PAGINAS_FAIXA);
    assert.deepEqual(POSICOES_NUMERO.map(([v]) => v), servidor.POSICOES_NUMERO);
    assert.deepEqual(FORMATOS_NUMERO.map(([v]) => v), servidor.FORMATOS_NUMERO);
    assert.equal(TAMANHO_NUMERO, servidor.TAMANHO_NUMERO);
    for (const f of FORMATOS_NUMERO.map(([v]) => v)) assert.equal(textoNumero(f, 3, 8), servidor.textoNumero(f, 3, 8));
    assert.deepEqual(trocarPagina([{ type: 'paragraph', content: [{ type: 'text', text: '{{pagina}}/{{paginas}}' }] }], 2, 4), servidor.trocarPagina([{ type: 'paragraph', content: [{ type: 'text', text: '{{pagina}}/{{paginas}}' }] }], 2, 4));
    // O cabeçalho que nasce do timbrado passa pela validação do servidor sem perder nada.
    const ini = faixaDoTimbrado({ cabecalho_linhas: ['MP', 'Promotoria'] });
    assert.deepEqual(servidor.sanitizeLayout({ cabecalho: { modo: 'proprio', conteudo: ini } }).cabecalho.conteudo, ini);
});

test('limparLayout guarda só o que mudou', () => {
    assert.equal(limparLayout({ papel: 'A4', orientacao: 'retrato', margens: { ...MARGENS_PADRAO }, estilos: { h1: {} }, proprios: [], numeracao_paragrafos: '1.' }), null);
    assert.deepEqual(limparLayout({ papel: 'A5', estilos: { h1: { tamanho: 14, cor: undefined } } }), { papel: 'A5', estilos: { h1: { tamanho: 14 } } });
});

test('papel timbrado por baixo: o documento guarda só o que difere do timbrado', () => {
    const t = { papel: 'oficio', numeracao_titulos: 'decimal', numero_pagina: { posicao: 'cabecalho-direita', primeira: false }, cabecalho: { modo: 'proprio', conteudo: [{ type: 'paragraph' }], paginas: 'primeira' } };
    // Igual ao timbrado: nada; voltar ao padrão do SIGO por cima do timbrado: fica explícito.
    assert.equal(limparLayout({ papel: 'oficio', numeracao_titulos: 'decimal', numero_pagina: { posicao: 'cabecalho-direita', primeira: false } }, t), null);
    assert.deepEqual(limparLayout({ papel: 'A4', numeracao_titulos: '', numero_pagina: { posicao: 'cabecalho-direita', primeira: true }, cabecalho: { paginas: 'todas' } }, t),
        { papel: 'A4', numeracao_titulos: '', numero_pagina: { primeira: true }, cabecalho: { paginas: 'todas' } });
    const v = comTimbrado({ cabecalho: { paginas: 'todas' } }, t);
    assert.equal(v.cabecalho.modo, 'proprio');
    assert.equal(v.cabecalho.paginas, 'todas');
    assert.equal(v.papel, 'oficio');
    assert.equal(comTimbrado({}, null).papel, undefined);
});

test('espelho do servidor: comTimbrado igual', { skip: !servidor }, () => {
    const t = servidor.sanitizeLayout({ papel: 'oficio', estilos: { normal: { tamanho: 13 } }, proprios: [{ id: 'a', nome: 'A' }], cabecalho: { modo: 'proprio', conteudo: [{ type: 'paragraph' }] }, numero_pagina: { formato: 'n' } });
    for (const l of [{}, { estilos: { normal: { alinhamento: 'center' } } }, { cabecalho: { modo: 'nenhum' } }, { rodape: { paginas: 'demais' } }, { proprios: [{ id: 'a', nome: 'B' }] }]) {
        assert.deepEqual(comTimbrado(l, t), servidor.comTimbrado(l, t));
    }
    // O que o cliente guarda o servidor aceita igual.
    const doc = limparLayout({ papel: 'A4', numeracao_paragrafos: '1)' }, t);
    assert.deepEqual(servidor.sanitizeLayout(doc), doc);
});

test('folha, resumo e id de estilo', () => {
    assert.deepEqual(folhaCm({ papel: 'oficio', orientacao: 'paisagem' }), { w: 33, h: 21.6 });
    assert.equal(resumoPagina({}), 'A4 retrato · margens 2,5 / 2 / 2,2 / 3 cm');
    assert.equal(idDeEstilo('Ementa', []), 'ementa');
    assert.equal(idDeEstilo('Ementa', ['ementa']), 'ementa-2');
    assert.equal(idDeEstilo('Citação longa (art.)', []), 'citacao-longa-art');
});

test('CSS da folha: estilos, próprios e numeração automática', () => {
    const css = cssDoLayout({
        estilos: { h1: { maiusculas: true, alinhamento: 'center' } }, numeracao_titulos: 'romano', numeracao_paragrafos: '1 –',
        proprios: [{ id: 'ementa', nome: 'Ementa', italico: true }, { id: 'x"}body{', nome: 'mal' }],
    }, '.dl-1', { georgia: 'Gelasio' });
    assert.match(css, /\.dl-1 \.ProseMirror h1 \{ font-size: 18pt; font-weight: 700; text-transform: uppercase; text-align: center; margin-top: 8pt; margin-bottom: 6pt \}/);
    assert.match(css, /p\[data-estilo="ementa"\] \{ font-style: italic \}/);
    assert.doesNotMatch(css, /body\{/, 'id inválido não entra no CSS');
    assert.match(css, /h1::before \{ content: counter\(sigo-t1, upper-roman\) "\. "; \}/);
    assert.match(css, /p\[data-numerado\]::before \{ content: counter\(sigo-np\) " – "; \}/);
    assert.doesNotMatch(cssDoLayout({}, '.dl-2'), /h1::before/, 'sem opção, títulos sem número');
});
