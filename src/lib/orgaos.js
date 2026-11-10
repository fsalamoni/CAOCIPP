/**
 * Órgãos internos da entidade, no lado da tela: rótulos, organograma e as
 * estruturas de exemplo do assistente. As regras que valem estão no servidor
 * (functions-v2/src/shared/orgaos.ts).
 */

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

export const nomeOrgao = (estado, orgaoId) => (estado?.orgaos || []).find((o) => o.id === orgaoId)?.nome || '';

/** "Presidência › Secretaria": a unidade com o órgão interno dela, quando há. */
export function unidadeComOrgao(estado, unidadeId, vazio = '—') {
    const u = (estado?.unidades || []).find((x) => x.id === unidadeId);
    if (!u) return vazio;
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
