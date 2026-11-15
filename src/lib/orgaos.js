/**
 * Órgãos internos da entidade, no lado da tela: rótulos, organograma e as
 * estruturas de exemplo do assistente. As regras que valem estão no servidor
 * (functions-v2/src/shared/orgaos.ts).
 */
import { MAX_MEMBROS } from './julgamento.js';

export const NATUREZAS = {
    deliberativo: { rotulo: 'Deliberativo', descricao: 'Delibera e fixa as regras (assembleia, conselho, plenário)' },
    direcao: { rotulo: 'Direção', descricao: 'Dirige e representa (presidência, direção-geral)' },
    executivo: { rotulo: 'Executivo', descricao: 'Executa e administra (secretaria-geral, diretorias)' },
    consultivo: { rotulo: 'Consultivo ou técnico', descricao: 'Opina e assessora (comissões, câmaras técnicas)' },
    fiscal: { rotulo: 'Fiscal ou de controle', descricao: 'Fiscaliza contas e atos (conselho fiscal, corregedoria)' },
    julgador: { rotulo: 'Julgador', descricao: 'Julga processos e recursos (tribunal, comissão disciplinar)' },
    apoio: { rotulo: 'Apoio', descricao: 'Dá suporte aos demais (protocolo, ouvidoria)' },
    outro: { rotulo: 'Outro', descricao: 'Não se encaixa nos anteriores' },
};
export const rotuloNatureza = (n) => NATUREZAS[n]?.rotulo || NATUREZAS.outro.rotulo;

export const CARGOS = ['Presidente', 'Vice-Presidente', 'Secretário-Geral', 'Diretor', 'Coordenador', 'Conselheiro-Presidente', 'Relator', 'Corregedor', 'Ouvidor'];

/** Ordem de leitura do organograma: cada órgão seguido dos subordinados, com o nível. */
export function emArvore(orgaos, chave = 'id', chavePai = 'pai_id') {
    const out = [];
    const descer = (pai, nivel) => {
        for (const o of orgaos.filter((x) => (x[chavePai] || null) === pai)) {
            if (out.some((x) => x[chave] === o[chave])) continue;
            out.push({ ...o, nivel });
            descer(o[chave], nivel + 1);
        }
    };
    descer(null, 1);
    // Órgão com superior que não existe (mais) aparece no fim, no primeiro nível.
    for (const o of orgaos) if (!out.some((x) => x[chave] === o[chave])) out.push({ ...o, nivel: 1 });
    return out;
}

/**
 * Admin delegado: só os órgãos que administra, em árvore a partir dos que lhe
 * foram delegados (`raiz`). Para o admin da entidade, null (vê todos).
 */
export function orgaosDoDelegado(estado) {
    if (!estado || estado.isAdmin) return null;
    const meus = new Set(estado.adminOrgaos || []);
    const lista = (estado.orgaos || []).filter((o) => meus.has(o.id)).map((o) => ({ ...o, raiz: !meus.has(o.pai_id), pai_vis: meus.has(o.pai_id) ? o.pai_id : null }));
    return emArvore(lista, 'id', 'pai_vis').map(({ pai_vis, ...o }) => o);
}

/** Um órgão e todos os que estão abaixo dele (não podem ser o superior dele). */
export function descendentes(orgaos, id) {
    const ids = new Set([id]);
    let mudou = true;
    while (mudou) {
        mudou = false;
        for (const o of orgaos) if (o.pai_id && ids.has(o.pai_id) && !ids.has(o.id)) { ids.add(o.id); mudou = true; }
    }
    return ids;
}

/** Funções no colegiado, na ordem em que aparecem. Espelha FUNCOES_COLEGIADO do servidor. */
export const FUNCOES_COLEGIADO = [['presidente', 'Presidente'], ['vice', 'Vice-presidente'], ['titular', 'Titular'], ['suplente', 'Suplente']];
export const MAX_COMPOSICAO = 40;
const ORDEM_FUNCAO = FUNCOES_COLEGIADO.map(([f]) => f);
export const rotuloFuncao = (f) => (FUNCOES_COLEGIADO.find(([k]) => k === f) || FUNCOES_COLEGIADO[2])[1];

/** O mandato vale na data (AAAA-MM-DD)? Sem início, desde sempre; sem fim, até hoje. */
export const vigente = (m, dia) => (!m.inicio || m.inicio <= dia) && (!m.fim || m.fim >= dia);

/** Quem compõe o colegiado na data, do presidente aos suplentes. */
export function composicaoEm(composicao, dia) {
    return (composicao || []).filter((m) => m.uid && vigente(m, dia)).sort((a, b) => ORDEM_FUNCAO.indexOf(a.funcao) - ORDEM_FUNCAO.indexOf(b.funcao));
}

const cruzam = (a, b) => (!a.inicio || !b.fim || a.inicio <= b.fim) && (!b.inicio || !a.fim || b.inicio <= a.fim);

/** Os mesmos conflitos que o servidor recusa, para avisar antes de salvar. */
export function problemasComposicao(composicao, nome = (u) => u) {
    const lista = (composicao || []).filter((m) => m.uid);
    const out = [];
    lista.forEach((m, i) => {
        if (m.inicio && m.fim && m.fim < m.inicio) out.push(`O mandato de ${nome(m.uid)} termina antes de começar.`);
        for (const o of lista.slice(i + 1)) {
            if (!cruzam(m, o)) continue;
            if (o.uid === m.uid) out.push(`${nome(m.uid)} aparece duas vezes no mesmo período.`);
            else if (o.funcao === m.funcao && (m.funcao === 'presidente' || m.funcao === 'vice')) {
                out.push(`Há dois ${m.funcao === 'presidente' ? 'presidentes' : 'vice-presidentes'} no mesmo período (${nome(m.uid)} e ${nome(o.uid)}).`);
            }
        }
    });
    return [...new Set(out)];
}

/**
 * Membros para o registro de julgamento: a composição, na data, do colegiado
 * a que a unidade pertence. Suplentes ficam de fora (entram no lugar de um
 * titular, quem registra inclui). Vazio quando a unidade não é de colegiado.
 */
export function membrosDoJulgamento(estado, unidadeId, dia) {
    const u = (estado?.unidades || []).find((x) => x.id === unidadeId);
    const o = (estado?.orgaos || []).find((x) => x.id === u?.orgao_id);
    if (!o || o.decisao !== 'colegiada') return [];
    const nome = (uid) => (estado.membros || []).find((m) => m.uid === uid)?.nome || '';
    return composicaoEm(o.composicao, dia).filter((m) => m.funcao !== 'suplente' && nome(m.uid))
        .map((m) => ({ nome: nome(m.uid), funcao: m.funcao === 'presidente' ? 'presidente' : 'membro', voto: '' })).slice(0, MAX_MEMBROS);
}

export const nomeOrgao = (estado, orgaoId) => (estado?.orgaos || []).find((o) => o.id === orgaoId)?.nome || '';

/** "Presidência › Secretaria": a unidade com o órgão interno dela, quando há. */
export function unidadeComOrgao(estado, unidadeId, vazio = '—') {
    const u = (estado?.unidades || []).find((x) => x.id === unidadeId);
    if (!u) {
        // Unidade excluída: o nome continua valendo para o que já está nos autos.
        const ex = (estado?.unidades_excluidas || []).find((x) => x.id === unidadeId);
        return ex ? `${ex.nome} (excluída)` : vazio;
    }
    const o = nomeOrgao(estado, u.orgao_id);
    return o ? `${o} › ${u.nome}` : u.nome;
}

const NOME_UNIDADE = { secretaria: 'Secretaria', gabinete: 'Gabinete', assessoria: 'Assessoria' };
/** Unidades a criar para um órgão do assistente, a partir das caixas marcadas. */
export function unidadesDoOrgao(o) {
    return ['secretaria', 'gabinete', 'assessoria'].filter((t) => o.unidades?.[t])
        .map((t) => ({ tipo: t, nome: `${NOME_UNIDADE[t]} (${o.sigla?.trim() || o.nome.trim()})`, sigla: '' }));
}

const org = (chave, nome, sigla, natureza, pai_chave, decisao, titular_cargo, unidades, competencias = []) => ({
    chave, nome, sigla, natureza, pai_chave, decisao, titular_cargo, competencias,
    unidades: { secretaria: unidades.includes('s'), gabinete: unidades.includes('g'), assessoria: unidades.includes('a') },
});

/** Pontos de partida do assistente. Tudo pode ser renomeado, movido ou removido antes de criar. */
export const ESTRUTURAS = [
    {
        id: 'federacao', nome: 'Federação, associação ou clube', descricao: 'Conselho de representantes, presidência, secretaria-geral, diretorias, comissão técnica, conselho fiscal e comissão disciplinar.',
        orgaos: [
            org('cgr', 'Conselho Geral de Representantes', 'CGR', 'deliberativo', null, 'colegiada', 'Presidente do Conselho', 'sg', ['Aprovar o estatuto e os regulamentos', 'Eleger a Presidência', 'Julgar as contas']),
            org('pres', 'Presidência', 'PRES', 'direcao', 'cgr', 'singular', 'Presidente', 'ga', ['Representar a entidade', 'Decidir os processos de sua competência']),
            org('vice', 'Vice-Presidência', 'VP', 'direcao', 'pres', 'singular', 'Vice-Presidente', 'g', ['Substituir o Presidente nas ausências']),
            org('sg', 'Secretaria-Geral', 'SG', 'executivo', 'pres', 'singular', 'Secretário-Geral', 's', ['Receber, autuar e distribuir os processos', 'Expedir intimações e comunicações']),
            org('ct', 'Comissão Técnica', 'CT', 'consultivo', 'pres', 'colegiada', 'Coordenador', 'g', ['Emitir pareceres técnicos']),
            org('daf', 'Diretoria Administrativa e Financeira', 'DAF', 'executivo', 'pres', 'singular', 'Diretor', 'sg', []),
            org('desp', 'Diretoria de Esportes', 'DE', 'executivo', 'pres', 'singular', 'Diretor', 'g', []),
            org('cf', 'Conselho Fiscal', 'CF', 'fiscal', null, 'colegiada', 'Presidente do Conselho Fiscal', 'g', ['Examinar as contas e emitir parecer']),
            org('cd', 'Comissão Disciplinar', 'CD', 'julgador', null, 'colegiada', 'Presidente da Comissão', 'sg', ['Processar e julgar infrações disciplinares']),
        ],
    },
    {
        id: 'colegiado', nome: 'Órgão colegiado com câmaras', descricao: 'Plenário, presidência, câmaras, corregedoria e secretaria-geral.',
        orgaos: [
            org('pleno', 'Plenário', 'PLENO', 'deliberativo', null, 'colegiada', 'Presidente', 'g', ['Julgar os recursos contra decisões das câmaras']),
            org('pres', 'Presidência', 'PRES', 'direcao', 'pleno', 'singular', 'Presidente', 'ga', []),
            org('c1', '1ª Câmara', '1C', 'julgador', 'pleno', 'colegiada', 'Presidente da Câmara', 'sg', []),
            org('c2', '2ª Câmara', '2C', 'julgador', 'pleno', 'colegiada', 'Presidente da Câmara', 'sg', []),
            org('cor', 'Corregedoria', 'COR', 'fiscal', 'pleno', 'singular', 'Corregedor', 'sg', []),
            org('sg', 'Secretaria-Geral', 'SG', 'executivo', 'pres', 'singular', 'Secretário-Geral', 's', []),
        ],
    },
    {
        id: 'departamentos', nome: 'Instituição com departamentos', descricao: 'Direção-geral, departamentos e ouvidoria.',
        orgaos: [
            org('dg', 'Direção-Geral', 'DG', 'direcao', null, 'singular', 'Diretor-Geral', 'sga', []),
            org('adm', 'Departamento Administrativo', 'DA', 'executivo', 'dg', 'singular', 'Diretor', 'sg', []),
            org('jur', 'Departamento Jurídico', 'DJ', 'consultivo', 'dg', 'singular', 'Diretor', 'ga', []),
            org('tec', 'Departamento Técnico', 'DT', 'executivo', 'dg', 'singular', 'Diretor', 'sg', []),
            org('ouv', 'Ouvidoria', 'OUV', 'apoio', 'dg', 'singular', 'Ouvidor', 's', []),
        ],
    },
    { id: 'branco', nome: 'Começar em branco', descricao: 'Você inclui os órgãos um a um.', orgaos: [org('o1', '', '', 'direcao', null, 'singular', '', 'sg')] },
];

/** O que impede criar a estrutura do assistente (lista de frases; vazia = pode criar). */
export function problemasEstrutura(linhas) {
    const out = [];
    if (!linhas.length) out.push('Inclua ao menos um órgão.');
    if (linhas.some((o) => !o.nome.trim())) out.push('Há órgão sem nome.');
    const vistos = new Set();
    for (const o of linhas) {
        const k = `${o.pai_chave || ''}|${o.nome.trim().toLowerCase()}`;
        if (o.nome.trim() && vistos.has(k)) out.push(`Há dois órgãos chamados "${o.nome.trim()}" no mesmo nível.`);
        vistos.add(k);
    }
    return [...new Set(out)];
}
