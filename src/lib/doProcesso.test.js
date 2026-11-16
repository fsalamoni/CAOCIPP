// npm run test:lib
// "Vem do processo": campos que servem a cada ação e as ligações propostas pelo nome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acoesPorCampo, aplicarSugestoes, camposLigaveis, nomeDoCampo, problemasDasLigacoes, sugestoesDeLigacao } from './doProcesso.js';
import { ritoConsultas } from './secretariaRito.js';
import { acaoAtiva, respostasDoProcesso, textoCondicao } from './exigencias.js';

// Tipo como o que entra pelo SIM: o formulário do "Novo processo" já traz o que a primeira fase pedia.
const TIPO = {
    id: 't1', nome: 'Consulta', rito_id: 'r1', formulario: {
        campos: [
            { id: 'pgea', rotulo: 'Número do PGEA', tipo: 'texto' },
            { id: 'orgao', rotulo: 'Órgão solicitante', tipo: 'texto' },
            { id: 'chegada', rotulo: 'Data de chegada', tipo: 'data' },
            { id: 'sistema', rotulo: 'Sistema', tipo: 'lista', opcoes: ['SIM', 'SPU', 'E-mail', 'Whatsapp', 'Outros'] },
        ],
    },
};

test('campos que servem a cada pedido, mais assunto e descrição', () => {
    assert.deepEqual(camposLigaveis([TIPO], 'texto').map((c) => c.id), ['pgea', 'orgao', '@assunto']);
    assert.deepEqual(camposLigaveis([TIPO], 'data').map((c) => c.id), ['chegada']);
    assert.equal(camposLigaveis([TIPO], 'confirmar').length, 6);
    assert.equal(nomeDoCampo([TIPO], 'pgea'), 'Número do PGEA');
    assert.equal(nomeDoCampo([TIPO], '@assunto'), 'Assunto');
    assert.equal(nomeDoCampo([TIPO], 'sumiu'), null);
});

test('Rito Consultas: o SIGO propõe ligar o PGEA, os dados básicos e dispensar a conversão', () => {
    const m = ritoConsultas();
    const rec = m.fases[0];
    const sug = sugestoesDeLigacao(m.fases, [TIPO]);
    const daRec = sug.filter((s) => s.fase === rec.id);
    assert.ok(daRec.some((s) => s.tipo === 'ligar' && s.idx === 2 && s.campo === 'pgea'), 'Registrar o número do PGEA');
    assert.ok(daRec.some((s) => s.tipo === 'ligar' && s.idx === 0 && s.alvo === 'orgao' && s.campo === 'orgao'));
    assert.ok(daRec.some((s) => s.tipo === 'ligar' && s.idx === 0 && s.alvo === 'chegada' && s.campo === 'chegada'));
    assert.ok(daRec.some((s) => s.tipo === 'ligar' && s.idx === 0 && s.alvo === 'sistema' && s.campo === 'sistema'));
    const disp = daRec.filter((s) => s.tipo === 'dispensar');
    assert.deepEqual(disp.map((s) => s.idx), [1], 'só a conversão em PGEA, que cita o PGEA');
    // Nada nas fases sem dado do processo.
    assert.ok(sug.every((s) => s.fase === rec.id));

    const fases = aplicarSugestoes(m.fases, sug);
    const f = fases[0];
    assert.equal(f.acoes_regras[2].do_processo, 'pgea');
    // "Assunto da consulta" vem do assunto do "Novo processo"; "Local dos fatos" não tem campo e fica para preencher.
    assert.deepEqual(f.acoes_regras[0].do_processo_campos, { orgao: 'orgao', chegada: 'chegada', assunto: '@assunto', sistema: 'sistema' });
    // A conversão mantém o "fora do SIM" e ganha "e também: PGEA vazio".
    const se = f.acoes_regras[1].se;
    assert.equal(se.campo, 'sistema');
    assert.equal(se.e[0].dado, 'campo:pgea');
    const comPgea = respostasDoProcesso({ fase_atual: f.id, campos: [{ id: 'pgea', valor: '123' }], acoes_respostas: { [f.id]: { '0.sistema': 'SPU' } } });
    const semPgea = respostasDoProcesso({ fase_atual: f.id, campos: [], acoes_respostas: { [f.id]: { '0.sistema': 'SPU' } } });
    assert.equal(acaoAtiva(f, 1, semPgea), true, 'fora do SIM e sem PGEA: converte');
    assert.equal(acaoAtiva(f, 1, comPgea), false, 'com PGEA: dispensada');
    assert.match(textoCondicao(f, se, fases), /"Número do PGEA" estiver vazio/);
    // Aplicar de novo não duplica: as sugestões somem com a ligação feita.
    assert.deepEqual(sugestoesDeLigacao(fases, [TIPO]), []);
});

test('conferência das ligações: campo que o tipo não tem ou de outro tipo de dado', () => {
    const { fases: base } = ritoConsultas();
    const fases = aplicarSugestoes(base, sugestoesDeLigacao(base, [TIPO]));
    assert.deepEqual(problemasDasLigacoes(fases, [TIPO]), [], 'com o tipo de onde vieram: tudo certo');
    assert.deepEqual(problemasDasLigacoes(fases, []), [], 'sem tipo ainda: nada a conferir');
    const semPgea = { ...TIPO, formulario: { campos: TIPO.formulario.campos.filter((c) => c.id !== 'pgea') } };
    const p = problemasDasLigacoes(fases, [semPgea]);
    assert.equal(p.length, 1);
    assert.match(p[0].texto, /este tipo de processo não tem/);
    const pgeaNumero = { ...TIPO, formulario: { campos: TIPO.formulario.campos.map((c) => (c.id === 'pgea' ? { ...c, tipo: 'numero' } : c)) } };
    assert.match(problemasDasLigacoes(fases, [pgeaNumero])[0].texto, /outro tipo de dado/);
    const porCampo = acoesPorCampo(fases);
    assert.equal(porCampo.pgea.length, 1);
    assert.equal(porCampo.orgao.length, 1);
});

test('nome ambíguo não liga sozinho: o admin escolhe', () => {
    const tipo = { ...TIPO, formulario: { campos: [{ id: 'a', rotulo: 'Número do PGEA', tipo: 'texto' }, { id: 'b', rotulo: 'PGEA', tipo: 'texto' }] } };
    const fases = [{ id: 'x', nome: 'X', acoes: ['Registrar o número do PGEA'], acoes_regras: [{ pede: 'texto' }] }];
    assert.deepEqual(sugestoesDeLigacao(fases, [tipo]), []);
});
