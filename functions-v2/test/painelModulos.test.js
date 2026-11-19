// Integração rito ↔ painel: nomes das colunas, "Leva ao painel" (a ação
// preenche o campo do registro ligado) e consulta ou expediente criado na
// autuação. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const pm = require('../lib/shared/painelModulos');
const rc = require('../lib/shared/registroCriado');
const sr = require('../lib/shared/situacaoRegistro');
const { calculateStatus } = require('../lib/shared/status');

test('painel: as colunas têm o id da situação e o nome que a equipe vê no quadro', () => {
    assert.deepEqual(pm.PAINEIS.consultas.colunas.map((c) => c.id), [...sr.SITUACOES]);
    assert.deepEqual(pm.PAINEIS.parcerias.colunas.map((c) => c.id), [...sr.SITUACOES_PARCERIA]);
    assert.equal(pm.rotuloDaColuna('consultas', 'Em elaboração'), 'Em Análise');
    assert.equal(pm.rotuloDaColuna('expedientes', 'Na pasta'), 'Arquivados');
    assert.equal(pm.rotuloDaColuna('consultas', 'qualquer'), 'qualquer');
    // O que o quadro pede e o sistema não preenche precisa vir de ação: destinatário e pasta na rede.
    const semAuto = pm.PAINEIS.consultas.colunas.flatMap((c) => c.infos.filter((i) => i.obrigatoria && !i.auto).map((i) => i.campo));
    assert.deepEqual(semAuto, ['third_party_recipient', 'network_folder']);
    for (const m of pm.MODULOS_PAINEL) {
        for (const c of pm.PAINEIS[m].colunas) for (const i of c.infos) {
            if (!i.auto) assert.ok(pm.PAINEIS[m].campos.some((x) => x.campo === i.campo), `${m}: "${i.rotulo}" sem campo que a ação preencha`);
        }
    }
});

test('leva ao painel: só ação com dado, não reservada, para campo do módulo e do tipo que combina', () => {
    assert.deepEqual(pm.sanitizeAoRegistro({ modulo: 'consultas', campo: 'network_folder' }, { pede: 'texto' }), { modulo: 'consultas', campo: 'network_folder' });
    assert.equal(pm.sanitizeAoRegistro({ modulo: 'consultas', campo: 'network_folder' }, { pede: 'data' }), null, 'data não vai para pasta na rede');
    assert.equal(pm.sanitizeAoRegistro({ modulo: 'consultas', campo: 'status' }, { pede: 'texto' }), null, 'situação só pela regra da fase');
    assert.equal(pm.sanitizeAoRegistro({ modulo: 'consultas', campo: 'observations' }, { pede: 'texto', ve: 'gestor' }), null, 'dado reservado não vai a outro módulo');
    assert.equal(pm.sanitizeAoRegistro({ modulo: 'consultas', campo: 'observations' }, {}), null, 'confirmar não tem dado');
    assert.equal(pm.sanitizeAoRegistro({ modulo: 'paginas', campo: 'x' }, { pede: 'texto' }), null, 'página sem id');
    assert.deepEqual(pm.sanitizeAoRegistro({ modulo: 'paginas', pagina: 'tp1', campo: 'valor' }, { pede: 'numero' }), { modulo: 'paginas', pagina: 'tp1', campo: 'valor' });
    const form = { pede: 'formulario', campos: [{ id: 'data', tipo: 'data' }, { id: 'destinatario', tipo: 'texto' }, { id: 'meio', tipo: 'texto' }] };
    assert.deepEqual(pm.sanitizeAoRegistro({ modulo: 'consultas', campos: { data: 'third_party_referral_date', destinatario: 'third_party_recipient', meio: 'third_party_recipient', x: 'location' } }, form),
        { modulo: 'consultas', campos: { data: 'third_party_referral_date', destinatario: 'third_party_recipient' } }, 'um campo do registro por campo da ação, sem repetir');
});

test('leva ao painel: o rito guarda a ligação na ação', () => {
    const [f] = s.sanitizeRito({ nome: 'R', fases: [{ nome: 'Revisão', acoes: ['Pasta', 'Ok'], acoes_regras: [
        { pede: 'texto', ao_registro: { modulo: 'consultas', campo: 'network_folder' } }, { ao_registro: { modulo: 'consultas', campo: 'network_folder' } },
    ] }] }).fases;
    assert.deepEqual(f.acoes_regras[0].ao_registro, { modulo: 'consultas', campo: 'network_folder' });
    assert.equal(f.acoes_regras[1]?.ao_registro, undefined);
});

test('leva ao painel: o que gravar na consulta, sem mudar a coluna por fora do rito', () => {
    const consulta = { status: 'Aguarda retorno de terceiros', analysis_start_date: '2026-11-01', third_party_referral_date: '2026-11-10' };
    const ao = { modulo: 'consultas', campos: { data: 'third_party_referral_date', destinatario: 'third_party_recipient' } };
    const pares = pm.paresDaAcao(ao, { tipo: 'formulario', rotulo: 'Remessa', valor: [{ id: 'data', tipo: 'data', rotulo: 'Data', valor: '2026-11-09' }, { id: 'destinatario', tipo: 'texto', rotulo: 'Destinatário', valor: '  Prefeitura  ' }] });
    const g = pm.camposParaModulo('consultas', consulta, pares);
    assert.deepEqual(g.campos, { third_party_referral_date: '2026-11-09', third_party_recipient: 'Prefeitura' });
    assert.equal(calculateStatus({ ...consulta, ...g.campos }), 'Aguarda retorno de terceiros');
    // A consulta ainda em análise: a data da remessa a colocaria em "Aguarda Terceiros".
    const h = pm.camposParaModulo('consultas', { analysis_start_date: '2026-11-01' }, pares);
    assert.deepEqual(h.campos, { third_party_recipient: 'Prefeitura' });
    assert.match(h.fora[0], /Aguarda Terceiros/);
    assert.deepEqual(pm.camposParaModulo('consultas', {}, [{ campo: 'urgency_request', tipo: 'sim_nao', rotulo: 'U', valor: 'sim' }]).campos, { urgency_request: true });
    assert.match(pm.camposParaModulo('consultas', {}, [{ campo: 'entry_date', tipo: 'data', rotulo: 'D', valor: '09/11/2026' }]).fora[0], /data inválida/);
});

test('leva ao painel: registro de página convertido e conferido pelo campo da página', () => {
    const fields = [{ key: 'valor', label: 'Valor', type: 'currency' }, { key: 'gestor', label: 'Gestor', type: 'user_ref' }, { key: 'situacao', label: 'Situação', type: 'select', options: [{ value: 'ok', label: 'Regular' }] }];
    const g = pm.camposParaPagina(fields, { values: { antigo: 1 } }, [
        { campo: 'valor', tipo: 'numero', rotulo: 'Valor', valor: 1500.5 }, { campo: 'gestor', tipo: 'texto', rotulo: 'G', valor: 'u1' },
        { campo: 'situacao', tipo: 'lista', rotulo: 'S', valor: 'Regular' }, { campo: 'sumiu', tipo: 'texto', rotulo: 'Sumiu', valor: 'x' },
    ]);
    assert.deepEqual(g.campos, { values: { antigo: 1, valor: 1500.5, situacao: 'ok' } });
    assert.match(g.fora[0], /não existe mais/);
    const erros = pm.aoRegistroInvalido([{ nome: 'F', acoes: ['A', 'B'], acoes_regras: [{ ao_registro: { modulo: 'paginas', pagina: 'tp', campo: 'gestor' } }, { ao_registro: { modulo: 'paginas', pagina: 'outra', campo: 'x' } }] }], { tp: { fields } });
    assert.equal(erros.length, 2);
    assert.match(erros[0], /pessoa da equipe/);
    assert.match(erros[1], /não existe mais/);
});

test('autuação cria consulta ou expediente: campos do módulo, obrigatórios e documento Pendente', () => {
    const cfg = rc.sanitizeCriaRegistro({ modulo: 'consultas', pagina: 'ignorada', valores: [{ campo: 'process_number', de: 'campo:pgea' }, { campo: 'consultant', de: 'partes' }] });
    assert.deepEqual(cfg, { pagina: '', modulo: 'consultas', valores: [{ campo: 'process_number', de: 'campo:pgea' }, { campo: 'consultant', de: 'partes' }] });
    const def = pm.defDaCriacao('consultas');
    assert.deepEqual(rc.errosCriaRegistro(cfg, def, { campos: [{ id: 'pgea' }] }), []);
    assert.match(rc.errosCriaRegistro({ ...cfg, valores: [] }, def, { campos: [] })[0], /obrigatório em Consulta/);
    const valores = rc.valoresDoRegistro(cfg, def, { numero: 'PE 1/2026', assunto: 'A', descricao: '', hoje: '2026-11-18', unidade: 'U', tipo: 'T', partes: ['Prefeitura de X'], campos: [{ id: 'pgea', tipo: 'texto', valor: '00123.000.456/2026' }] });
    const doc = pm.docDoModulo('consultas', valores);
    assert.equal(doc.process_number, '00123.000.456/2026');
    assert.equal(doc.consultant, 'Prefeitura de X');
    assert.equal(doc.status, 'Pendente');
    assert.equal(calculateStatus(doc), 'Pendente');
    assert.equal(pm.docDoModulo('expedientes', { expediente_number: '9' }).expediente_number, '9');
    // O rito conduz a consulta criada, mesmo com outra ligada por campo.
    assert.deepEqual(sr.registroDoProcesso({ registro_criado: { modulo: 'consultas', id: 'c1' }, vinculos: ['consultas:c1', 'consultas:c2'] }, 'consultas'), { id: 'c1' });
});
