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
import { texto } from './secretaria';

export const MAX_RESULTADOS = 8;
export const MAX_MEMBROS = 30;
export const FUNCOES: Record<string, string> = { relator: 'relator', revisor: 'revisor', presidente: 'presidente', membro: 'membro' };
/** Situações que não são voto: ficam na certidão e não contam para o quórum. */
export const SITUACOES: Record<string, string> = { impedido: 'impedido', suspeito: 'suspeito', ausente: 'ausente', abstencao: 'abstenção' };
export const DESEMPATES: Record<string, string> = { presidente: 'voto do presidente', favoravel: 'resultado mais favorável à parte' };

export interface JulgamentoDaAcao { resultados: string[]; quorum?: number; desempate?: 'presidente' | 'favoravel'; favoravel?: string }
export interface Voto { nome: string; funcao: string; voto: string }
export interface DadosJulgamento { data: string; votos: Voto[] }
export interface Apuracao { resultado: string; placar: Array<[string, number]>; validos: number; unanime: boolean; desempate?: 'presidente' | 'favoravel' }

/** Valida o que o rito diz do julgamento. Lança com mensagem. */
export function sanitizeJulgamentoDaAcao(raw: unknown, acao: string): JulgamentoDaAcao {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const resultados = [...new Set((Array.isArray(r.resultados) ? r.resultados : []).map((s) => texto(s, 80)).filter(Boolean))];
    if (resultados.length < 2) throw new Error(`A ação "${acao}" julga em colegiado: informe ao menos dois resultados possíveis`);
    if (resultados.length > MAX_RESULTADOS) throw new Error(`A ação "${acao}" aceita até ${MAX_RESULTADOS} resultados`);
    if (resultados.some((x) => SITUACOES[x.toLowerCase()] || x.toLowerCase() === 'abstenção')) {
        throw new Error(`A ação "${acao}": impedido, suspeito, ausente e abstenção já são registrados à parte; não são resultados`);
    }
    const out: JulgamentoDaAcao = { resultados };
    if (r.quorum !== undefined && r.quorum !== null && r.quorum !== '') {
        const q = Number(r.quorum);
        if (!Number.isInteger(q) || q < 1 || q > MAX_MEMBROS) throw new Error(`A ação "${acao}": o quórum é um número de votos de 1 a ${MAX_MEMBROS}`);
        if (q > 1) out.quorum = q;
    }
    if (r.desempate === 'favoravel') {
        const fav = texto(r.favoravel, 80);
        if (!resultados.includes(fav)) throw new Error(`A ação "${acao}": no empate prevalece o resultado mais favorável; escolha qual é, entre os resultados`);
        out.desempate = 'favoravel';
        out.favoravel = fav;
    }
    return out;
}

/** Confere a sessão e os votos informados pela equipe. `hoje` em AAAA-MM-DD. Lança com mensagem. */
export function dadosDoJulgamento(cfg: JulgamentoDaAcao, bruto: unknown, hoje: string): DadosJulgamento {
    const r = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
    const data = String(r.data || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`))) throw new Error('Informe a data da sessão de julgamento');
    if (data > hoje) throw new Error('Registre o julgamento depois da sessão: a data não pode ser futura');
    const brutos = Array.isArray(r.votos) ? r.votos : [];
    const votos = brutos.map((x) => {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
        return { nome: texto(o.nome, 120), funcao: String(o.funcao || 'membro'), voto: texto(o.voto, 80) };
    }).filter((v) => v.nome);
    if (!votos.length) throw new Error('Informe os membros do colegiado e o voto de cada um');
    if (votos.length > MAX_MEMBROS) throw new Error(`Até ${MAX_MEMBROS} membros`);
    const nomes = new Set<string>();
    for (const v of votos) {
        if (!FUNCOES[v.funcao]) throw new Error(`Função desconhecida para ${v.nome}`);
        if (!cfg.resultados.includes(v.voto) && !SITUACOES[v.voto]) throw new Error(`Informe o voto de ${v.nome}`);
        const k = v.nome.toLowerCase();
        if (nomes.has(k)) throw new Error(`${v.nome} aparece duas vezes`);
        nomes.add(k);
    }
    const relatores = votos.filter((v) => v.funcao === 'relator');
    if (relatores.length !== 1) throw new Error('Indique um relator, e só um');
    if (!cfg.resultados.includes(relatores[0].voto)) throw new Error('O relator precisa votar. Se ele está impedido ou ausente, indique quem relatou no lugar dele');
    if (votos.filter((v) => v.funcao === 'presidente').length > 1) throw new Error('Indique no máximo um presidente');
    apurar(cfg, votos);
    return { data, votos };
}

/** Apura os votos: maioria dos válidos; no empate, o critério do rito. Lança com mensagem se não há resultado. */
export function apurar(cfg: JulgamentoDaAcao, votos: Voto[]): Apuracao {
    const validos = votos.filter((v) => cfg.resultados.includes(v.voto));
    const quorum = cfg.quorum || 1;
    if (validos.length < quorum) {
        throw new Error(`Quórum não alcançado: ${validos.length} ${validos.length === 1 ? 'voto válido' : 'votos válidos'}, e o rito exige ${quorum}`);
    }
    const placar = cfg.resultados.map((o) => [o, validos.filter((v) => v.voto === o).length] as [string, number])
        .filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    const topo = placar.filter(([, n]) => n === placar[0][1]).map(([o]) => o);
    const base = { placar, validos: validos.length, unanime: placar.length === 1 };
    if (topo.length === 1) return { resultado: topo[0], ...base };
    if (cfg.desempate === 'favoravel' && cfg.favoravel && topo.includes(cfg.favoravel)) return { resultado: cfg.favoravel, ...base, desempate: 'favoravel' };
    const pres = votos.find((v) => v.funcao === 'presidente');
    if (cfg.desempate !== 'favoravel' && pres && topo.includes(pres.voto)) return { resultado: pres.voto, ...base, desempate: 'presidente' };
    throw new Error(cfg.desempate === 'favoravel'
        ? `Empate entre ${topo.join(' e ')}, e o resultado mais favorável (${cfg.favoravel}) não está entre eles. Confira os votos`
        : `Empate entre ${topo.join(' e ')}: o presidente desempata, e o voto dele precisa ser um dos resultados empatados`);
}

const br = (iso: string) => iso.split('-').reverse().join('/');
const lista = (vs: Voto[]) => vs.map((v) => v.nome).join(', ');

/**
 * Texto da certidão: "Procedente, por maioria (3 a 1), em 20/11/2026. Relator: Ana.
 * Vencido: Bruno (Improcedente). Impedido: Carla."
 */
export function textoDoJulgamento(cfg: JulgamentoDaAcao, d: DadosJulgamento): string {
    const a = apurar(cfg, d.votos);
    const contas = a.placar.map(([, n]) => n).join(' a ');
    const como = a.unanime ? `por unanimidade (${a.validos} ${a.validos === 1 ? 'voto' : 'votos'})`
        : a.desempate === 'presidente' ? `pelo voto de desempate do presidente (${contas})`
            : a.desempate === 'favoravel' ? `no empate (${contas}), pelo resultado mais favorável à parte, como prevê o rito`
                : `por maioria (${contas})`;
    const relator = d.votos.find((v) => v.funcao === 'relator')!;
    const partes = [`${a.resultado}, ${como}, em sessão de ${br(d.data)}`, `Relator: ${relator.nome}`];
    const vencidos = d.votos.filter((v) => cfg.resultados.includes(v.voto) && v.voto !== a.resultado);
    if (vencidos.length) partes.push(`${vencidos.length > 1 ? 'Vencidos' : 'Vencido'}: ${vencidos.map((v) => `${v.nome} (${v.voto})`).join(', ')}`);
    for (const [s, nome] of Object.entries(SITUACOES)) {
        const vs = d.votos.filter((v) => v.voto === s);
        if (vs.length) partes.push(`${nome[0].toUpperCase()}${nome.slice(1)}${vs.length > 1 && s !== 'abstencao' ? 's' : ''}: ${lista(vs)}`);
    }
    return partes.join('. ');
}
