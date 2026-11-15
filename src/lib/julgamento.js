/**
 * Julgamento colegiado (`pede: 'julgamento'`), espelho de
 * functions-v2/src/shared/julgamento.ts: a tela mostra a apuração enquanto a
 * equipe registra os votos; o servidor confere e apura de novo.
 */
export const FUNCOES = [['relator', 'Relator'], ['revisor', 'Revisor'], ['presidente', 'Presidente'], ['membro', 'Membro']];
export const SITUACOES = [['impedido', 'Impedido'], ['suspeito', 'Suspeito'], ['ausente', 'Ausente'], ['abstencao', 'Abstenção']];
export const MAX_RESULTADOS = 8;
export const MAX_MEMBROS = 30;

/** Apuração: { resultado, placar, validos, unanime, desempate } ou { erro }. */
export function apurar(cfg, votos) {
    const resultados = cfg?.resultados || [];
    const validos = (votos || []).filter((v) => v.nome?.trim() && resultados.includes(v.voto));
    const quorum = cfg?.quorum || 1;
    if (validos.length < quorum) return { erro: `Quórum não alcançado: ${validos.length} ${validos.length === 1 ? 'voto válido' : 'votos válidos'}, e o rito exige ${quorum}` };
    const placar = resultados.map((o) => [o, validos.filter((v) => v.voto === o).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const topo = placar.filter(([, n]) => n === placar[0][1]).map(([o]) => o);
    const base = { placar, validos: validos.length, unanime: placar.length === 1 };
    if (topo.length === 1) return { resultado: topo[0], ...base };
    if (cfg.desempate === 'favoravel' && topo.includes(cfg.favoravel)) return { resultado: cfg.favoravel, ...base, desempate: 'favoravel' };
    const pres = votos.find((v) => v.funcao === 'presidente');
    if (cfg.desempate !== 'favoravel' && pres && topo.includes(pres.voto)) return { resultado: pres.voto, ...base, desempate: 'presidente' };
    return { erro: cfg.desempate === 'favoravel'
        ? `Empate entre ${topo.join(' e ')}, e o resultado mais favorável (${cfg.favoravel}) não está entre eles`
        : `Empate entre ${topo.join(' e ')}: o presidente desempata, e o voto dele precisa ser um dos resultados empatados` };
}

/** Frase da apuração para a tela: "Procedente, por maioria (3 a 1)". */
export function textoDaApuracao(a) {
    if (a.erro) return a.erro;
    const contas = a.placar.map(([, n]) => n).join(' a ');
    return `${a.resultado}, ${a.unanime ? `por unanimidade (${a.validos} ${a.validos === 1 ? 'voto' : 'votos'})`
        : a.desempate === 'presidente' ? `pelo voto de desempate do presidente (${contas})`
            : a.desempate === 'favoravel' ? `no empate (${contas}), pelo resultado mais favorável`
                : `por maioria (${contas})`}`;
}

/** O que falta para registrar (a tela avisa antes de enviar). */
export function problemasDosVotos(cfg, votos) {
    const vs = (votos || []).filter((v) => v.nome?.trim());
    const out = [];
    if (!vs.length) return ['Informe os membros e o voto de cada um.'];
    vs.filter((v) => !v.voto).forEach((v) => out.push(`Falta o voto de ${v.nome.trim()}.`));
    const rel = vs.filter((v) => v.funcao === 'relator');
    if (rel.length !== 1) out.push('Indique um relator, e só um.');
    else if (!(cfg?.resultados || []).includes(rel[0].voto)) out.push('O relator precisa votar um dos resultados.');
    if (vs.filter((v) => v.funcao === 'presidente').length > 1) out.push('Indique no máximo um presidente.');
    const nomes = vs.map((v) => v.nome.trim().toLowerCase());
    if (new Set(nomes).size !== nomes.length) out.push('Há nome repetido.');
    if (!out.length) { const a = apurar(cfg, vs); if (a.erro) out.push(`${a.erro}.`); }
    return out;
}
