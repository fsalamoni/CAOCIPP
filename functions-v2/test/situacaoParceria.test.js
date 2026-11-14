// Rito que conduz a parceria ligada (regras do quadro de Parcerias) e regra da primeira fase na autuação.
// Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const sr = require('../lib/shared/situacaoRegistro');

const HOJE = '2026-11-14';
const ana = { uid: 'u1', nome: 'Ana Assessora' };
const base = { pgea: '01.2026', subject: 'Cooperação', parties: 'Município X', status: 'Pendente' };

test('rito: guarda a parceria com as situações dela e a marca da autuação', () => {
    const [a, b] = s.sanitizeRito({ nome: 'R', fases: [
        { nome: 'A', situacao_registro: { modulo: 'parcerias', ao_entrar: 'Pendente', ao_assumir: 'Em análise', na_autuacao: true } },
        { nome: 'B', situacao_registro: { modulo: 'parcerias', ao_entrar: 'Extintos', ao_assumir: 'Em elaboração', na_autuacao: 'sim' } },
    ] }).fases;
    assert.deepEqual(a.situacao_registro, { modulo: 'parcerias', ao_entrar: 'Pendente', ao_assumir: 'Em análise', na_autuacao: true });
    assert.equal(b.situacao_registro, undefined, 'extinção e situação de consulta não valem para a parceria');
    assert.deepEqual(sr.sanitizeSituacaoRegistro({ modulo: 'consultas', ao_entrar: 'Em análise' }), null, 'situação de parceria não vale para consulta');
});

test('parceria para frente: datas automáticas e quem assume vira o responsável', () => {
    assert.deepEqual(sr.mudancasDaParceria(base, 'Em análise', HOJE, ana),
        { campos: { status: 'Em análise', responsible_user_id: 'u1', responsible_user_name: 'Ana Assessora', responsibility_date: HOJE, distribution_date: HOJE } });
    // Ao entrar, sem ninguém assumindo e sem responsável: a regra do quadro não deixa.
    assert.match(sr.mudancasDaParceria(base, 'Em análise', HOJE).motivo, /Assessor Responsável/);
    // Revisão pede a pasta na rede: sem ela, fica onde está e diz o porquê.
    assert.match(sr.mudancasDaParceria({ ...base, status: 'Em análise' }, 'Em revisão', HOJE).motivo, /Pasta na Rede/);
    assert.deepEqual(sr.mudancasDaParceria({ ...base, status: 'Em análise', network_folder: 'R:/x' }, 'Em revisão', HOJE),
        { campos: { status: 'Em revisão', review_start_date: HOJE, review_submission_date: HOJE } });
    // Data já preenchida fica.
    assert.deepEqual(sr.mudancasDaParceria({ ...base, status: 'Em revisão', reviewed_date: '2026-11-01' }, 'Revisadas', HOJE),
        { campos: { status: 'Revisadas', review_conclusion_date: HOJE } });
    assert.match(sr.mudancasDaParceria({ ...base, status: 'Revisadas' }, 'Parcerias', HOJE).motivo, /Tipo de Parceria/);
    assert.equal(sr.mudancasDaParceria({ ...base, status: 'Revisadas' }, 'Revisadas', HOJE), null);
    assert.equal(sr.mudancasDaParceria(base, 'Extintos', HOJE), null, 'o rito não extingue');
});

test('parceria para trás: apaga os marcadores das fases seguintes; formalizada ou extinta não volta', () => {
    const antes = { ...base, status: 'Aguarda Terceiros', network_folder: 'R:/x', review_start_date: '2026-11-02', reviewed_date: '2026-11-05', third_party: 'PGE', third_party_referral_date: '2026-11-10' };
    const r = sr.mudancasDaParceria(antes, 'Em revisão', HOJE);
    assert.equal(r.campos.status, 'Em revisão');
    assert.equal(r.campos.third_party, null);
    assert.equal(r.campos.reviewed_date, null);
    assert.ok(!('network_folder' in r.campos), 'a pasta da fase de destino fica');
    // Voltar para a revisão sem a pasta na rede: a regra do quadro não deixa.
    assert.match(sr.mudancasDaParceria({ ...antes, network_folder: '' }, 'Em revisão', HOJE).motivo, /Pasta na Rede/);
    assert.match(sr.mudancasDaParceria({ ...base, status: 'Parcerias' }, 'Revisadas', HOJE).motivo, /formalizada/);
    assert.match(sr.mudancasDaParceria({ ...base, status: 'Extintos', extinguished: true }, 'Pendente', HOJE).motivo, /extinta/);
});
