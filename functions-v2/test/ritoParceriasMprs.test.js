// O rito de formalização de parcerias do MPRS (biblioteca de modelos) contra as regras do quadro de
// Parcerias: percorrendo as fases, cada coluna recebe a parceria sem recusa, porque as ações já
// levaram o que ela exige. Rodar: npm --prefix functions-v2 test
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../lib/shared/secretaria');
const sr = require('../lib/shared/situacaoRegistro');

const HOJE = '2026-11-19';
const ana = { uid: 'u1', nome: 'Ana Assessora' };

const rito = async () => {
    const m = (await import('../../src/lib/bibliotecaRitos.js')).bibliotecaDeModelos().find((x) => x.id === 'parceria-formalizacao-mprs');
    return s.sanitizeRito({ ...m, fases: m.fases.map((f) => ({ ...f, unidade_id: 'u' })) });
};

/** Cumpre as ações da fase que levam dado ao painel, com um valor do tipo certo. */
const levar = (fase, doc) => {
    (fase.acoes_regras || []).forEach((r) => {
        const ao = r?.ao_registro;
        if (!ao) return;
        assert.equal(ao.modulo, 'parcerias');
        if (ao.campo) doc[ao.campo] = r.pede === 'data' ? '2027-01-10' : 'Direção-Geral';
        for (const [id, campo] of Object.entries(ao.campos || {})) {
            const c = r.campos.find((x) => x.id === id);
            assert.ok(c, `campo ${id} do formulário`);
            doc[campo] = c.tipo === 'data' ? '2027-01-10' : campo === 'partnership_type' ? 'Convênio' : 'Texto de teste';
        }
    });
};

/** Entra na fase: aplica a regra de coluna como o servidor (ao entrar e, depois, quando alguém assume). */
const entrar = (fase, doc) => {
    const sit = fase.situacao_registro;
    if (!sit) return;
    for (const [alvo, quem] of [[sit.ao_entrar, undefined], [sit.ao_assumir, ana]]) {
        if (!alvo) continue;
        const r = sr.mudancasDaParceria(doc, alvo, HOJE, quem);
        if (!r) continue; // já está na coluna
        assert.equal(r.motivo, undefined, `${fase.nome} → ${alvo}: ${r.motivo}`);
        Object.assign(doc, r.campos);
    }
};

const percorrer = async (caminho) => {
    const fases = (await rito()).fases;
    // A parceria nasce no painel, em Pendentes, só com o que a criação exige.
    const doc = { pgea: '00001.000.123/2026', subject: 'Cooperação técnica', parties: 'Município X', status: 'Pendente' };
    const colunas = [];
    for (const nome of caminho) {
        const fase = fases.find((f) => f.nome === nome);
        assert.ok(fase, `fase ${nome}`);
        entrar(fase, doc);
        colunas.push(doc.status);
        levar(fase, doc);
    }
    return { doc, colunas };
};

test('parceria com recursos: da proposta à coluna Parcerias, passando pela Direção-Geral', async () => {
    const { doc, colunas } = await percorrer(['Proposta e contato com os partícipes', 'Estudo técnico, plano de trabalho e minuta', 'Revisão da instrução',
        'Aprovação da minuta', 'Direção-Geral e CAGE', 'Aprovação do Procurador-Geral', 'Assinatura', 'Publicação e registro', 'Parceria formalizada']);
    assert.deepEqual(colunas, ['Pendente', 'Em análise', 'Em revisão', 'Revisadas', 'Aguarda Terceiros', 'Aguarda Terceiros', 'Aguarda Terceiros', 'Aguarda Terceiros', 'Parcerias']);
    assert.equal(doc.responsible_user_id, 'u1');
    for (const k of ['network_folder', 'third_party', 'partnership_type', 'signature_date', 'demp', 'validity_period', 'object', 'end_date', 'renewal_notice_date', 'third_party_return_date']) {
        assert.ok(doc[k], `a ficha ficou sem ${k}`);
    }
});

test('parceria sem recursos: da aprovação da minuta direto ao Procurador-Geral, com chamamento público no caminho', async () => {
    const { doc, colunas } = await percorrer(['Proposta e contato com os partícipes', 'Estudo técnico, plano de trabalho e minuta', 'Chamamento público', 'Revisão da instrução',
        'Aprovação da minuta', 'Aprovação do Procurador-Geral', 'Assinatura', 'Publicação e registro', 'Parceria formalizada']);
    assert.deepEqual(colunas, ['Pendente', 'Em análise', 'Em análise', 'Em revisão', 'Revisadas', 'Revisadas', 'Aguarda Terceiros', 'Aguarda Terceiros', 'Parcerias']);
    assert.equal(doc.status, 'Parcerias');
});

test('devolução para ajustes: a parceria volta a Pendentes e refaz o caminho', async () => {
    const { doc, colunas } = await percorrer(['Proposta e contato com os partícipes', 'Estudo técnico, plano de trabalho e minuta', 'Revisão da instrução',
        'Estudo técnico, plano de trabalho e minuta', 'Revisão da instrução', 'Aprovação da minuta']);
    assert.deepEqual(colunas, ['Pendente', 'Em análise', 'Em revisão', 'Em análise', 'Em revisão', 'Revisadas']);
    assert.ok(doc.network_folder);
});
