// npm run test:lib
// "Criar registro na autuação" no editor do tipo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comFonte, faseInicial, fontesDoTipo, problemasCriaRegistro } from './registroCriado.js';

const PAGINA = {
    id: 'pg1', nome: 'Contrato', plural: 'Contratos',
    fases: [{ key: 'novo', label: 'Novo', order: 0, is_initial: true }, { key: 'vigente', label: 'Vigente', order: 1 }],
    campos: [
        { key: 'numero_pe', label: 'Processo', type: 'text', required: true },
        { key: 'fiscal', label: 'Fiscal', type: 'text', required: true, phase: 'vigente' },
        { key: 'objeto', label: 'Objeto', type: 'textarea' },
    ],
};
const FORM = { campos: [{ id: 'valor', rotulo: 'Valor estimado' }] };

test('fontes: as do processo e os campos do formulário do tipo', () => {
    const f = fontesDoTipo(FORM);
    assert.deepEqual(f.at(-1), ['campo:valor', 'Campo do formulário: Valor estimado']);
    assert.ok(f.some(([v]) => v === 'fixo'));
});

test('problemas: obrigatórios da fase em que o registro nasce, campo do formulário apagado e valor fixo vazio', () => {
    assert.deepEqual(problemasCriaRegistro(null, null, FORM), []);
    assert.match(problemasCriaRegistro({ pagina: 'x', valores: [] }, null, FORM)[0], /não existe mais/);
    assert.deepEqual(problemasCriaRegistro({ pagina: 'pg1', valores: [] }, PAGINA, FORM), ['"Processo" é obrigatório em Contrato: diga de onde vem o valor.']);
    const p = problemasCriaRegistro({ pagina: 'pg1', fase: 'vigente', valores: [{ campo: 'numero_pe', de: 'campo:sumiu' }, { campo: 'objeto', de: 'fixo', valor: '' }] }, PAGINA, FORM);
    assert.deepEqual(p, ['"Processo": o campo do formulário escolhido não existe mais neste tipo.', '"Objeto": informe o valor fixo.', '"Fiscal" é obrigatório em Contrato: diga de onde vem o valor.']);
    assert.equal(faseInicial({ fase: 'sumiu' }, PAGINA), 'novo');
});

test('trocar a fonte mantém a ordem, guarda o valor fixo e "" tira o campo', () => {
    let c = { pagina: 'pg1', valores: [] };
    c = comFonte(c, 'numero_pe', 'numero');
    c = comFonte(c, 'objeto', 'fixo', 'Serviço de limpeza');
    c = comFonte(c, 'numero_pe', 'assunto');
    assert.deepEqual(c.valores, [{ campo: 'numero_pe', de: 'assunto' }, { campo: 'objeto', de: 'fixo', valor: 'Serviço de limpeza' }]);
    assert.deepEqual(comFonte(c, 'objeto', 'fixo').valores[1], { campo: 'objeto', de: 'fixo', valor: 'Serviço de limpeza' });
    assert.deepEqual(comFonte(c, 'numero_pe', '').valores, [{ campo: 'objeto', de: 'fixo', valor: 'Serviço de limpeza' }]);
});
