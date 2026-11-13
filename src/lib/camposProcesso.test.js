import test from 'node:test';
import assert from 'node:assert/strict';
import { abaDoRegistro, camposDaOrigem, faltando, formularioDe, formularioPadrao, novoCampo, problemasFormulario, registrosLigados, rotuloDe, valorTexto, valoresDe } from './camposProcesso.js';

test('página própria: abre na lista do tipo e entra nos registros ligados', () => {
    assert.equal(abaDoRegistro({ modulo: 'paginas', id: 'r1', pagina: 'tp1' }), 'clist:tp1');
    assert.equal(abaDoRegistro({ modulo: 'paginas', id: 'r1' }), '');
    assert.equal(abaDoRegistro({ modulo: 'juri', id: 'j' }), 'jurimetria');
    const l = registrosLigados({ campos: [{ rotulo: 'Atendimento', ref: { modulo: 'paginas', id: 'r1', numero: 'Maria', pagina: 'tp1' } }] });
    assert.deepEqual(l.map((r) => [r.modulo, r.pagina, r.de[0]]), [['paginas', 'tp1', 'Atendimento']]);
});

const form = {
    ...formularioPadrao(), assunto: 'opcional', descricao: 'obrigatorio', partes: 'obrigatorio',
    campos: [
        { id: 'valor', rotulo: 'Valor', tipo: 'numero', obrigatorio: true },
        { id: 'origem', rotulo: 'Origem', tipo: 'lista', opcoes: ['A', 'B'] },
    ],
};

test('formularioDe: tipo antigo recebe o padrão', () => {
    assert.deepEqual(formularioDe({}), formularioPadrao());
    assert.equal(formularioDe({}).assunto, 'obrigatorio', 'assunto segue obrigatório nos tipos antigos');
    assert.equal(formularioDe({ formulario: { partes: 'oculto' } }).partes, 'oculto');
    assert.match(novoCampo().id, /^[a-z0-9_]{1,24}$/);
});

test('faltando: aponta padrões e campos obrigatórios e número inválido', () => {
    assert.deepEqual(faltando(form, { descricao: ' ', partes: [{ nome: '' }], campos: {} }),
        ['Preencha "Descrição"', 'Informe ao menos um item em "Partes e interessados"', 'Preencha "Valor"']);
    assert.deepEqual(faltando(form, { descricao: 'x', partes: [{ nome: 'Ana' }], campos: { valor: 'dez' } }), ['"Valor" precisa ser um número']);
    assert.deepEqual(faltando(form, { descricao: 'x', partes: [{ nome: 'Ana' }], campos: { valor: '1.234,5' } }), []);
});

test('problemasFormulario: nome vazio, repetido, padrão e lista curta', () => {
    assert.deepEqual(problemasFormulario(form), []);
    const p = problemasFormulario({ ...formularioPadrao(), campos: [{ rotulo: '' }, { rotulo: 'Origem' }, { rotulo: 'origem ' }, { rotulo: 'Partes' }, { rotulo: 'Via', tipo: 'lista', opcoes: ['a', 'a'] }] });
    assert.equal(p.length, 4);
});

test('valorTexto e valoresDe', () => {
    assert.equal(valorTexto({ tipo: 'sim_nao', valor: false }), 'Não');
    assert.equal(valorTexto({ tipo: 'data', valor: '2026-03-01' }), '01/03/2026');
    assert.equal(valorTexto({ tipo: 'texto', valor: 'abc' }), 'abc');
    assert.deepEqual(valoresDe([{ id: 'a', tipo: 'sim_nao', valor: true }, { id: 'b', tipo: 'numero', valor: 1.5 }, { id: 'c', tipo: 'data', valor: '2026-03-01' }]),
        { a: 'sim', b: '1,5', c: '2026-03-01' });
});

test('campos padrão configuráveis: nome próprio, assunto e origem obrigatórios', () => {
    const f = { ...formularioPadrao(), origem: 'obrigatorio', rotulos: { assunto: 'Objeto', partes: 'Envolvidos' }, campos: [] };
    assert.equal(rotuloDe(f, 'assunto'), 'Objeto');
    assert.equal(rotuloDe(f, 'descricao'), 'Descrição');
    assert.deepEqual(faltando(f, { assunto: '', origem: { tipo: '', descricao: '' }, partes: [], campos: {} }), ['Preencha "Objeto"', 'Informe "Origem"']);
    assert.deepEqual(faltando(f, { assunto: 'x', origem: { tipo: 'oficio', descricao: '' }, partes: [], campos: {} }), []);
    assert.match(problemasFormulario({ ...f, campos: [{ rotulo: 'envolvidos', tipo: 'texto' }] })[0], /campo padrão/);
    assert.match(problemasFormulario({ ...f, assunto: 'oculto', descricao: 'oculto', partes: 'oculto' })[0], /identificar/);
    assert.match(problemasFormulario({ ...f, polos: [] })[0], /polo/);
});

test('formulário mais livre: condição, múltipla, formatos e o que falta na fase', async () => {
    const m = await import('./camposProcesso.js');
    const campos = [
        { id: 'a', rotulo: 'Houve dano?', tipo: 'sim_nao' },
        { id: 'b', rotulo: 'Valor', tipo: 'numero', formato: 'moeda', obrigatorio: true, condicao: { campo_id: 'a', valor: true } },
        { id: 'c', rotulo: 'Áreas', tipo: 'multipla', opcoes: ['X', 'Y'] },
        { id: 'd', rotulo: 'Doc', tipo: 'texto', formato: 'cpf_cnpj', exigir_em: ['f2'], obrigatorio: false },
    ];
    const f = { ...formularioPadrao(), assunto: 'opcional', campos };
    assert.deepEqual([...m.visiveis(campos, { a: 'nao' })], ['a', 'c', 'd']);
    assert.deepEqual(faltando(f, { campos: { a: 'nao' } }), [], 'valor escondido não é exigido');
    assert.deepEqual(faltando(f, { campos: { a: 'sim' } }), ['Preencha "Valor"']);
    assert.deepEqual(faltando(f, { campos: { d: '529.982.247-26' } }), ['"Doc" precisa ser um CPF ou CNPJ válido']);
    assert.equal(m.cpfCnpjValido('11222333000181'), true);
    assert.equal(valorTexto({ tipo: 'multipla', valor: ['X', 'Y'] }), 'X, Y');
    assert.match(valorTexto({ tipo: 'numero', formato: 'moeda', valor: 1234.5 }), /^R\$ 1\.234,50$/);
    assert.deepEqual(valoresDe([{ id: 'c', tipo: 'multipla', valor: ['X'] }]), { c: ['X'] });
    assert.match(problemasFormulario({ ...f, campos: [campos[1], campos[0]] }).join(), /venha antes/);
    assert.match(problemasFormulario({ ...f, campos: [{ rotulo: 'M', tipo: 'multipla', opcoes: ['só'] }] }).join(), /duas opções/);
    assert.equal(m.textoCondicao(campos, campos[1]), 'quando "Houve dano?" for Sim');
    const p = { fase_atual: 'f2', campos_exigidos: { f2: [{ id: 'd', rotulo: 'Doc' }, { id: 'b', rotulo: 'Valor', condicao: { campo_id: 'a', valor: true } }] }, campos: [{ id: 'a', tipo: 'sim_nao', valor: false }] };
    assert.deepEqual(m.camposFaltandoNaFase(p).map((x) => x.id), ['d']);
    assert.deepEqual(m.camposFaltandoNaFase({ ...p, fase_atual: 'f1' }), []);
    // Pelo tipo de hoje: o campo que o tipo não tem mais não conta.
    assert.deepEqual(m.camposFaltandoNaFase(p, { campos: [campos[0]] }), []);
    assert.deepEqual(m.camposFaltandoNaFase(p, { campos }).map((x) => x.id), ['d']);
});

test('revisão: CNPJ alfanumérico, link, fases que sumiram e valor que mudou de lista', async () => {
    const m = await import('./camposProcesso.js');
    assert.equal(m.cpfCnpjValido('12.ABC.345/01DE-35'), true);
    assert.equal(m.linkValido('exemplo.org:8080'), true);
    assert.equal(m.linkValido('javascript:alert(1)'), false);
    const f = { ...formularioPadrao(), campos: [{ id: 'a', rotulo: 'A', tipo: 'texto', exigir_em: ['velha'] }] };
    assert.match(problemasFormulario(f, ['nova']).join(), /não existem no rito/);
    assert.deepEqual(problemasFormulario(f), [], 'sem as fases, não confere');
    const form = { campos: [{ id: 'l', tipo: 'multipla', opcoes: ['X', 'Y'] }, { id: 'u', tipo: 'lista', opcoes: ['X', 'Y'] }] };
    assert.deepEqual(valoresDe([{ id: 'l', tipo: 'lista', valor: 'X' }, { id: 'u', tipo: 'multipla', valor: ['Z', 'Y'] }], form), { l: ['X'], u: 'Y' });
});

test('prévia: valor como o servidor gravaria', async () => {
    const { valorComoGravado: g } = await import('./camposProcesso.js');
    assert.equal(g({ tipo: 'texto', formato: 'cpf_cnpj' }, '52998224725'), '529.982.247-25');
    assert.equal(g({ tipo: 'texto', formato: 'cpf_cnpj' }, '52998224726'), null);
    assert.equal(g({ tipo: 'texto', formato: 'email' }, 'A@B.org'), 'a@b.org');
    assert.equal(g({ tipo: 'texto', formato: 'link' }, 'exemplo.org'), 'https://exemplo.org/');
    assert.equal(g({ tipo: 'numero', formato: 'moeda' }, '1.234,567'), 1234.57);
    assert.equal(g({ tipo: 'sim_nao' }, 'abc'), null);
    assert.equal(g({ tipo: 'lista', opcoes: ['A'] }, 'B'), null);
    assert.deepEqual(g({ tipo: 'multipla', opcoes: ['A', 'B'] }, ['B', 'A']), ['A', 'B']);
    assert.equal(g({ tipo: 'multipla', opcoes: ['A'] }, ['C']), null);
});

test('registro de outro módulo: integração, configuração, valor e texto', async () => {
    const m = await import('./camposProcesso.js');
    assert.deepEqual(m.integracoesLigadas({ integracoes: { consultas: true, juri: true }, modulos_ativos: { consultas: true, juri: false } }),
        { consultas: true, expedientes: false, parcerias: false, juri: false, paginas: false });
    assert.match(problemasFormulario({ ...formularioPadrao(), campos: [{ rotulo: 'Consulta', tipo: 'registro' }] }).join(), /de que módulo/);
    const c = { id: 'r', rotulo: 'Consulta', tipo: 'registro', modulo: 'consultas' };
    assert.equal(m.valorComoGravado(c, { id: 'p1', numero: '00123/2026', titulo: 'Licitação' }), '00123/2026');
    assert.equal(m.valorComoGravado(c, ''), null);
    const gravado = { id: 'r', tipo: 'registro', valor: '00123/2026', ref: { modulo: 'consultas', id: 'p1', numero: '00123/2026', titulo: 'Licitação' } };
    assert.equal(valorTexto(gravado), '00123/2026 (Licitação)');
    assert.deepEqual(valoresDe([gravado]), { r: { id: 'p1', numero: '00123/2026', titulo: 'Licitação' } });
    assert.deepEqual(faltando({ ...formularioPadrao(), assunto: 'opcional', campos: [{ ...c, obrigatorio: true }] }, { campos: { r: '' } }), ['Preencha "Consulta"']);
});

test('origem com registro: preenche os campos do mesmo módulo e conta como origem informada', () => {
    const ref = { modulo: 'consultas', id: 'p1', numero: '00123/2026', titulo: 'Licitação' };
    const form = { campos: [{ id: 'a', tipo: 'registro', modulo: 'consultas' }, { id: 'b', tipo: 'registro', modulo: 'expedientes' }, { id: 'c', tipo: 'texto' }] };
    assert.deepEqual(camposDaOrigem(form, ref), { a: { id: 'p1', numero: '00123/2026', titulo: 'Licitação' } });
    assert.deepEqual(camposDaOrigem(form, { ...ref, modulo: 'pe' }), {});
    assert.deepEqual(camposDaOrigem(form, null), {});
    const obrig = { ...formularioPadrao(), assunto: 'opcional', origem: 'obrigatorio' };
    assert.deepEqual(faltando(obrig, { origem: { tipo: '', descricao: '', ref } }), []);
    assert.deepEqual(faltando(obrig, { origem: { tipo: '', descricao: '' } }), ['Informe "Origem"']);
});

test('registrosLigados junta origem, campos e ações sem repetir e ignora processo', async () => {
    const { registrosLigados } = await import('./camposProcesso.js');
    const p = {
        origem: { ref: { modulo: 'consultas', id: 'c1', numero: '10' } },
        campos: [
            { rotulo: 'Consulta base', ref: { modulo: 'consultas', id: 'c1', numero: '10', titulo: 'Merenda', restrito: true } },
            { rotulo: 'Parceria', ref: { modulo: 'parcerias', id: 'p1', numero: 'PGEA 5', restrito: true } },
            { rotulo: 'Texto', valor: 'x' },
        ],
    };
    const info = [
        { rotulo: 'Júri', fase_nome: 'Instrução', ref: { modulo: 'juri', id: 'j1', numero: '0001' } },
        { rotulo: 'Outro processo', fase_nome: 'Instrução', ref: { modulo: 'pe', id: 'x', numero: 'PE 1' } },
    ];
    const r = registrosLigados(p, info);
    assert.deepEqual(r.map((x) => `${x.modulo}:${x.id}`), ['consultas:c1', 'parcerias:p1', 'juri:j1']);
    assert.deepEqual(r[0].de, ['origem', 'Consulta base']);
    assert.equal(r[0].restrito, true);
    assert.equal(r[0].titulo, 'Merenda');
    assert.equal(r[1].restrito, true);
    assert.deepEqual(r[2].de, ['Júri (Instrução)']);
    assert.deepEqual(registrosLigados({ campos: [] }), []);
});
