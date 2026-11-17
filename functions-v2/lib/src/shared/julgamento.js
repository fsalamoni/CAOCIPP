"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DESEMPATES = exports.SITUACOES = exports.FUNCOES = exports.MAX_MEMBROS = exports.MAX_RESULTADOS = void 0;
exports.sanitizeJulgamentoDaAcao = sanitizeJulgamentoDaAcao;
exports.dadosDoJulgamento = dadosDoJulgamento;
exports.apurar = apurar;
exports.textoDoJulgamento = textoDoJulgamento;
/**
 * Julgamento colegiado como ação do rito (`pede: 'julgamento'`): turma,
 * câmara, comissão, conselho ou plenário que decide por votos. O rito diz os
 * resultados possíveis (as opções que decidem as saídas da fase), o quórum
 * mínimo de votos válidos e como se desempata. A equipe registra a data da
 * sessão e o voto de cada membro; o servidor apura o resultado, que vira a
 * resposta da ação (como uma escolha) e a certidão de julgamento nos autos,
 * que as partes veem.
 *
 * Impedimento, suspeição, ausência e abstenção ficam registrados e não contam
 * como voto. O conteúdo dos votos (fundamentos) fica nos documentos do rito
 * (voto do relator, acórdão, ata), não aqui.
 *
 * Lógica pura; o servidor grava. Espelho no cliente: src/lib/julgamento.js.
 */
const secretaria_1 = require("./secretaria");
exports.MAX_RESULTADOS = 8;
exports.MAX_MEMBROS = 30;
exports.FUNCOES = { relator: 'relator', revisor: 'revisor', presidente: 'presidente', membro: 'membro' };
/** Situações que não são voto: ficam na certidão e não contam para o quórum. */
exports.SITUACOES = { impedido: 'impedido', suspeito: 'suspeito', ausente: 'ausente', abstencao: 'abstenção' };
exports.DESEMPATES = { presidente: 'voto do presidente', favoravel: 'resultado mais favorável à parte' };
/** Valida o que o rito diz do julgamento. Lança com mensagem. */
function sanitizeJulgamentoDaAcao(raw, acao) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const resultados = [...new Set((Array.isArray(r.resultados) ? r.resultados : []).map((s) => (0, secretaria_1.texto)(s, 80)).filter(Boolean))];
    if (resultados.length < 2)
        throw new Error(`A ação "${acao}" julga em colegiado: informe ao menos dois resultados possíveis`);
    if (resultados.length > exports.MAX_RESULTADOS)
        throw new Error(`A ação "${acao}" aceita até ${exports.MAX_RESULTADOS} resultados`);
    if (resultados.some((x) => exports.SITUACOES[x.toLowerCase()] || x.toLowerCase() === 'abstenção')) {
        throw new Error(`A ação "${acao}": impedido, suspeito, ausente e abstenção já são registrados à parte; não são resultados`);
    }
    const out = { resultados };
    if (r.quorum !== undefined && r.quorum !== null && r.quorum !== '') {
        const q = Number(r.quorum);
        if (!Number.isInteger(q) || q < 1 || q > exports.MAX_MEMBROS)
            throw new Error(`A ação "${acao}": o quórum é um número de votos de 1 a ${exports.MAX_MEMBROS}`);
        if (q > 1)
            out.quorum = q;
    }
    if (r.desempate === 'favoravel') {
        const fav = (0, secretaria_1.texto)(r.favoravel, 80);
        if (!resultados.includes(fav))
            throw new Error(`A ação "${acao}": no empate prevalece o resultado mais favorável; escolha qual é, entre os resultados`);
        out.desempate = 'favoravel';
        out.favoravel = fav;
    }
    return out;
}
/** Confere a sessão e os votos informados pela equipe. `hoje` em AAAA-MM-DD. Lança com mensagem. */
function dadosDoJulgamento(cfg, bruto, hoje) {
    const r = (bruto && typeof bruto === 'object' ? bruto : {});
    const data = String(r.data || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`)))
        throw new Error('Informe a data da sessão de julgamento');
    if (data > hoje)
        throw new Error('Registre o julgamento depois da sessão: a data não pode ser futura');
    const brutos = Array.isArray(r.votos) ? r.votos : [];
    const votos = brutos.map((x) => {
        const o = (x && typeof x === 'object' ? x : {});
        return { nome: (0, secretaria_1.texto)(o.nome, 120), funcao: String(o.funcao || 'membro'), voto: (0, secretaria_1.texto)(o.voto, 80) };
    }).filter((v) => v.nome);
    if (!votos.length)
        throw new Error('Informe os membros do colegiado e o voto de cada um');
    if (votos.length > exports.MAX_MEMBROS)
        throw new Error(`Até ${exports.MAX_MEMBROS} membros`);
    const nomes = new Set();
    for (const v of votos) {
        if (!exports.FUNCOES[v.funcao])
            throw new Error(`Função desconhecida para ${v.nome}`);
        if (!cfg.resultados.includes(v.voto) && !exports.SITUACOES[v.voto])
            throw new Error(`Informe o voto de ${v.nome}`);
        const k = v.nome.toLowerCase();
        if (nomes.has(k))
            throw new Error(`${v.nome} aparece duas vezes`);
        nomes.add(k);
    }
    const relatores = votos.filter((v) => v.funcao === 'relator');
    if (relatores.length !== 1)
        throw new Error('Indique um relator, e só um');
    if (!cfg.resultados.includes(relatores[0].voto))
        throw new Error('O relator precisa votar. Se ele está impedido ou ausente, indique quem relatou no lugar dele');
    if (votos.filter((v) => v.funcao === 'presidente').length > 1)
        throw new Error('Indique no máximo um presidente');
    apurar(cfg, votos);
    return { data, votos };
}
/** Apura os votos: maioria dos válidos; no empate, o critério do rito. Lança com mensagem se não há resultado. */
function apurar(cfg, votos) {
    const validos = votos.filter((v) => cfg.resultados.includes(v.voto));
    const quorum = cfg.quorum || 1;
    if (validos.length < quorum) {
        throw new Error(`Quórum não alcançado: ${validos.length} ${validos.length === 1 ? 'voto válido' : 'votos válidos'}, e o rito exige ${quorum}`);
    }
    const placar = cfg.resultados.map((o) => [o, validos.filter((v) => v.voto === o).length])
        .filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const topo = placar.filter(([, n]) => n === placar[0][1]).map(([o]) => o);
    const base = { placar, validos: validos.length, unanime: placar.length === 1 };
    if (topo.length === 1)
        return Object.assign({ resultado: topo[0] }, base);
    if (cfg.desempate === 'favoravel' && cfg.favoravel && topo.includes(cfg.favoravel))
        return Object.assign(Object.assign({ resultado: cfg.favoravel }, base), { desempate: 'favoravel' });
    const pres = votos.find((v) => v.funcao === 'presidente');
    if (cfg.desempate !== 'favoravel' && pres && topo.includes(pres.voto))
        return Object.assign(Object.assign({ resultado: pres.voto }, base), { desempate: 'presidente' });
    throw new Error(cfg.desempate === 'favoravel'
        ? `Empate entre ${topo.join(' e ')}, e o resultado mais favorável (${cfg.favoravel}) não está entre eles. Confira os votos`
        : `Empate entre ${topo.join(' e ')}: o presidente desempata, e o voto dele precisa ser um dos resultados empatados`);
}
const br = (iso) => iso.split('-').reverse().join('/');
const lista = (vs) => vs.map((v) => v.nome).join(', ');
/**
 * Texto da certidão: "Procedente, por maioria (3 a 1), em 20/11/2026. Relator: Ana.
 * Vencido: Bruno (Improcedente). Impedido: Carla."
 */
function textoDoJulgamento(cfg, d) {
    const a = apurar(cfg, d.votos);
    const contas = a.placar.map(([, n]) => n).join(' a ');
    const como = a.unanime ? `por unanimidade (${a.validos} ${a.validos === 1 ? 'voto' : 'votos'})`
        : a.desempate === 'presidente' ? `pelo voto de desempate do presidente (${contas})`
            : a.desempate === 'favoravel' ? `no empate (${contas}), pelo resultado mais favorável à parte, como prevê o rito`
                : `por maioria (${contas})`;
    const relator = d.votos.find((v) => v.funcao === 'relator');
    const partes = [`${a.resultado}, ${como}, em sessão de ${br(d.data)}`, `Relator: ${relator.nome}`];
    const vencidos = d.votos.filter((v) => cfg.resultados.includes(v.voto) && v.voto !== a.resultado);
    if (vencidos.length)
        partes.push(`${vencidos.length > 1 ? 'Vencidos' : 'Vencido'}: ${vencidos.map((v) => `${v.nome} (${v.voto})`).join(', ')}`);
    for (const [s, nome] of Object.entries(exports.SITUACOES)) {
        const vs = d.votos.filter((v) => v.voto === s);
        if (vs.length)
            partes.push(`${nome[0].toUpperCase()}${nome.slice(1)}${vs.length > 1 && s !== 'abstencao' ? 's' : ''}: ${lista(vs)}`);
    }
    return partes.join('. ');
}
//# sourceMappingURL=julgamento.js.map