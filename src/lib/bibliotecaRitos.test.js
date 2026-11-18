import test from 'node:test';
import assert from 'node:assert/strict';
import { bibliotecaDeModelos } from './bibliotecaRitos.js';
import { problemasDoFluxo, ritoDeMermaid, ritoParaMermaid } from './secretariaRito.js';
import { RESULTADOS_DISPUTA } from './certames.js';

// MODELOS_AREA=correcional confere só o arquivo daquela área (src/lib/modelos/<área>.js).
const carregar = async () => (process.env.MODELOS_AREA
    ? (await import(`./modelos/${process.env.MODELOS_AREA}.js`)).modelos.map((m) => m())
    : bibliotecaDeModelos());

/** Problemas de lógica que o servidor não recusa, mas que deixariam o modelo sem sentido na prática. */
export function problemasDoModelo(m) {
    const out = [];
    const fluxo = problemasDoFluxo(m.fases);
    if (fluxo.soltas.length) out.push(`fases que nunca são alcançadas: ${fluxo.soltas.map((id) => m.fases.find((f) => f.id === id)?.nome).join(', ')}`);
    if (fluxo.presas.length) out.push(`fases de onde não se chega ao fim: ${fluxo.presas.map((id) => m.fases.find((f) => f.id === id)?.nome).join(', ')}`);
    if (!m.fases.some((f) => f.final) && !m.fases.at(-1)) out.push('sem fase final');
    m.fases.forEach((f) => {
        const regras = f.acoes_regras || [];
        const opcoesDe = (i) => {
            const r = regras[i];
            if (r?.pede === 'lista') return r.opcoes || [];
            if (r?.pede === 'sim_nao') return ['sim', 'nao'];
            if (r?.pede === 'resposta') return ['Apresentada', 'Parcial', 'Sem manifestação'];
            if (r?.pede === 'julgamento') return r.julgamento?.resultados || [];
            if (r?.pede === 'disputa') return RESULTADOS_DISPUTA;
            return null;
        };
        const conferirCond = (c, onde) => {
            const ops = opcoesDe(c.acao);
            if (!ops) return out.push(`${f.nome}: ${onde} lê a ação ${c.acao + 1}, que não é escolha, sim/não nem espera de resposta`);
            c.valores.forEach((v) => { if (!ops.includes(v)) out.push(`${f.nome}: ${onde} espera "${v}", que não é opção de "${f.acoes[c.acao]}"`); });
        };
        regras.forEach((r, i) => {
            if (!r) return;
            if (r.pede === 'lista' && (r.opcoes || []).length < 2) out.push(`${f.nome}: "${f.acoes[i]}" tem menos de duas opções`);
            if (r.pede === 'resposta') {
                const c = regras[r.resposta?.de];
                if (!(r.resposta?.de < i && c?.pede === 'comunicacao' && c.comunicacao?.dias > 0)) out.push(`${f.nome}: "${f.acoes[i]}" espera resposta de ação que não comunica com prazo antes dela`);
            }
            if (r.se) {
                if (r.se.acao >= i) out.push(`${f.nome}: "${f.acoes[i]}" depende de ação posterior`);
                conferirCond(r.se, `"${f.acoes[i]}"`);
            }
            if (r.pede === 'formulario' && !(r.campos || []).length) out.push(`${f.nome}: formulário sem campos`);
            if ((r.ajuda || '').length > 200) out.push(`${f.nome}: ajuda de "${f.acoes[i]}" passa de 200 caracteres`);
        });
        Object.entries(f.condicoes_regra || {}).forEach(([alvo, c]) => {
            if (!(f.proximas || []).includes(alvo)) out.push(`${f.nome}: saída pela resposta para fase que não está em "vai"`);
            conferirCond(c, 'a saída');
        });
        if ((f.acoes || []).length > 20) out.push(`${f.nome}: mais de 20 ações`);
        if (f.prazo_auto && !f.prazo_dias) out.push(`${f.nome}: prazo automático sem dias`);
        if (f.espera && !f.avanco) out.push(`${f.nome}: fase de espera sem avanco 'auto' (não voltaria sozinha)`);
    });
    return out;
}

test('biblioteca: cada modelo tem fluxo e lógica coerentes', async () => {
    for (const m of await carregar()) assert.deepEqual(problemasDoModelo(m), [], m.nome);
});

test('biblioteca: o diagrama (Mermaid) preserva fases e prazos', async () => {
    for (const m of await carregar()) {
        const volta = ritoDeMermaid(ritoParaMermaid(m.fases)).fases;
        assert.deepEqual(volta.map((f) => [f.nome, f.prazo_dias]), m.fases.map((f) => [f.nome, f.prazo_dias]), m.nome);
    }
});

test('biblioteca: todo modelo propõe o nome do painel e da planilha de acompanhamento', () => {
    for (const m of bibliotecaDeModelos()) {
        assert.ok(Array.isArray(m.painel) && m.painel.length === 2 && m.painel.every((n) => n && n.length <= 60), m.id);
    }
});
