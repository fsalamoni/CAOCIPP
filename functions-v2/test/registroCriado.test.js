// "Criar registro na autuação": o tipo cria um registro numa página própria com dados do processo.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const rc = require('../lib/shared/registroCriado');
const { validateRecordValues, phasesReachedUpTo } = require('../lib/customEntities/schema');

const PAGINA = {
    label_singular: 'Contrato', enabled: true,
    phases: [{ key: 'novo', label: 'Novo', order: 0, is_initial: true }, { key: 'vigente', label: 'Vigente', order: 1 }],
    fields: [
        { key: 'numero_pe', label: 'Processo', type: 'text', required: true },
        { key: 'objeto', label: 'Objeto', type: 'textarea' },
        { key: 'valor', label: 'Valor', type: 'currency' },
        { key: 'modalidade', label: 'Modalidade', type: 'select', options: [{ value: 'pregao', label: 'Pregão' }, { value: 'dispensa', label: 'Dispensa' }] },
        { key: 'inicio', label: 'Início', type: 'date' },
        { key: 'gestor', label: 'Gestor', type: 'user_ref' },
        { key: 'fiscal', label: 'Fiscal', type: 'text', required: true, phase: 'vigente' },
    ],
};
const FORM = { campos: [{ id: 'valor' }, { id: 'modal' }] };

test('limpa a configuração: sem página não cria; fonte e campo inválidos saem; repetido fica o primeiro', () => {
    assert.equal(rc.sanitizeCriaRegistro(null), null);
    assert.equal(rc.sanitizeCriaRegistro({ pagina: '../x' }), null);
    const c = rc.sanitizeCriaRegistro({ pagina: 'pg1', fase: 'novo', valores: [
        { campo: 'numero_pe', de: 'numero' }, { campo: 'numero_pe', de: 'assunto' }, { campo: 'Objeto', de: 'assunto' },
        { campo: 'objeto', de: 'qualquer' }, { campo: 'valor', de: 'campo:valor' }, { campo: 'modalidade', de: 'fixo', valor: 'Pregão' }] });
    assert.deepEqual(c, { pagina: 'pg1', fase: 'novo', valores: [{ campo: 'numero_pe', de: 'numero' }, { campo: 'valor', de: 'campo:valor' }, { campo: 'modalidade', de: 'fixo', valor: 'Pregão' }] });
});

test('ao salvar o tipo: página, campos, fontes e o que a página exige na fase em que o registro nasce', () => {
    const ok = { pagina: 'pg1', valores: [{ campo: 'numero_pe', de: 'numero' }] };
    assert.deepEqual(rc.errosCriaRegistro(ok, PAGINA, FORM), []);
    assert.match(rc.errosCriaRegistro(ok, null, FORM)[0], /não existe mais/);
    assert.match(rc.errosCriaRegistro(ok, { ...PAGINA, enabled: false }, FORM)[0], /desativada/);
    assert.match(rc.errosCriaRegistro({ pagina: 'pg1', valores: [] }, PAGINA, FORM)[0], /"Processo" é obrigatório em Contrato/);
    // Nascendo em "Vigente", o fiscal também passa a ser exigido.
    assert.match(rc.errosCriaRegistro({ ...ok, fase: 'vigente' }, PAGINA, FORM).join(' | '), /"Fiscal" é obrigatório/);
    const e = rc.errosCriaRegistro({ pagina: 'pg1', fase: 'sumiu', valores: [{ campo: 'numero_pe', de: 'numero' }, { campo: 'gestor', de: 'unidade' },
        { campo: 'objeto', de: 'campo:apagado' }, { campo: 'modalidade', de: 'fixo', valor: 'Leilão' }, { campo: 'inicio', de: 'fixo', valor: ' ' }, { campo: 'xx', de: 'tipo' }] }, PAGINA, FORM);
    assert.equal(e.length, 6, e.join(' | '));
    assert.match(e.join(' | '), /fase escolhida.*não existe/);
    assert.match(e.join(' | '), /"Gestor" é uma pessoa da equipe/);
    assert.match(e.join(' | '), /"Objeto": o campo do formulário escolhido não existe mais/);
    assert.match(e.join(' | '), /Modalidade: opção inválida/);
    assert.match(e.join(' | '), /"Início": informe o valor fixo/);
    assert.match(e.join(' | '), /Um campo escolhido não existe mais em Contrato/);
});

test('valores do registro novo, convertidos ao tipo de cada campo da página', () => {
    const cfg = { pagina: 'pg1', valores: [
        { campo: 'numero_pe', de: 'numero' }, { campo: 'objeto', de: 'partes' }, { campo: 'valor', de: 'campo:valor' },
        { campo: 'modalidade', de: 'campo:modal' }, { campo: 'inicio', de: 'autuacao' }, { campo: 'gestor', de: 'unidade' }] };
    const d = { numero: '000012/2026', assunto: 'Compra', descricao: '', hoje: '2026-11-14', unidade: 'Compras', tipo: 'Contratação', partes: ['Empresa A', 'Empresa B'],
        campos: [{ id: 'valor', tipo: 'numero', valor: 1500.5 }, { id: 'modal', tipo: 'lista', valor: 'pregão' }] };
    const v = rc.valoresDoRegistro(cfg, PAGINA, d);
    assert.deepEqual(v, { numero_pe: '000012/2026', objeto: 'Empresa A, Empresa B', valor: 1500.5, modalidade: 'pregao', inicio: '2026-11-14' });
    const r = validateRecordValues(PAGINA.fields, v, { requiredPhases: phasesReachedUpTo(PAGINA, rc.faseDoRegistro(cfg, PAGINA)) });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    // Campo do formulário vazio deixa o obrigatório sem valor: a página recusa e a autuação diz por quê.
    const vazio = rc.valoresDoRegistro({ pagina: 'pg1', valores: [{ campo: 'numero_pe', de: 'campo:nada' }] }, PAGINA, d);
    assert.equal(validateRecordValues(PAGINA.fields, vazio, { requiredPhases: phasesReachedUpTo(PAGINA, 'novo') }).errors.numero_pe, 'Processo é obrigatório.');
    assert.equal(rc.faseDoRegistro({ pagina: 'pg1', fase: 'sumiu', valores: [] }, PAGINA), 'novo');
    assert.equal(rc.faseDoRegistro({ pagina: 'pg1', fase: 'vigente', valores: [] }, PAGINA), 'vigente');
});

test('conversões: moeda em reais, data dd/mm/aaaa, sim/não e múltipla escolha pelo rótulo', () => {
    assert.equal(rc.paraCampo({ type: 'currency' }, 'R$ 1.234,56'), 1234.56);
    assert.equal(rc.paraCampo({ type: 'number' }, '12.5'), 12.5);
    assert.equal(rc.paraCampo({ type: 'date' }, '05/03/2026'), '2026-03-05');
    assert.equal(rc.paraCampo({ type: 'boolean' }, 'Sim'), true);
    assert.equal(rc.paraCampo({ type: 'text' }, true), 'Sim');
    assert.deepEqual(rc.paraCampo({ type: 'multiselect', options: PAGINA.fields[3].options }, ['Pregão', 'dispensa']), ['pregao', 'dispensa']);
    assert.equal(rc.paraCampo({ type: 'text' }, ''), null);
});
