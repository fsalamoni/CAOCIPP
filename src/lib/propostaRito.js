// ============================================================================
// Proposta de rito a partir de arquivos (etapa 3), sem IA: planilha com
// colunas ricas, BPMN (Camunda, Bizagi, bpmn.io), draw.io (diagrams.net),
// Mermaid e texto corrido (Word, PDF, TXT). Tudo vira a mesma proposta:
//
//   { nome, descricao, fases: [{ id, nome, prazo_dias?, orientacao?, proximas?,
//     final?, unidade?, agente?, acoes?: [], modelos?: [nomes], condicoes?:
//     { idDaProxima: 'se deferido' } }], avisos: [] }
//
// `unidade` e `modelos` aqui são NOMES; `vincularProposta` casa com as
// unidades e os modelos do órgão e diz o que será criado. O servidor revalida
// tudo (sanitizeRito e aplicarPropostaRito). Testes: propostaRito.test.js.
// ============================================================================

import { novoIdFase, simplificar } from './secretariaRito.js';

export const sem = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const limpar = (s) => String(s ?? '')
    .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
const lista = (s) => String(s ?? '').split(/\s*(?:\n|;|•|•|\s\|\s)\s*/).map((x) => x.replace(/^[-*–·]\s*/, '').trim()).filter(Boolean);
const unicos = (a) => [...new Set(a.filter(Boolean))];

/** "Análise (10 dias)", "Análise - 10 dias" → { nome, prazo_dias }. */
function nomeEPrazo(bruto) {
    const t = limpar(bruto);
    const m = t.match(/^(.+?)\s*(?:[-–:]\s*|\(\s*)(?:prazo:?\s*)?(\d{1,4})\s*dias?(?:\s*(?:uteis|úteis|corridos))?\s*\)?$/i);
    return m ? { nome: m[1].trim(), prazo_dias: Number(m[2]) } : { nome: t };
}

/** Tipo provável da unidade pelo nome (o admin confere na revisão). */
export function tipoProvavel(nome) {
    const n = sem(nome);
    if (/gabinete|promotor|procurador|juiz|magistrad|relator|decis|chefia|direcao|coordenac|titular/.test(n)) return 'gabinete';
    if (/assessor|analis|tecnic|pericia|consultor|juridic/.test(n)) return 'assessoria';
    if (/secretaria|cartorio|protocolo|expediente|cumprimento|distribuic|arquivo|escrivan/.test(n)) return 'secretaria';
    return 'outra';
}

// ---- Grafo genérico → proposta ---------------------------------------------

/**
 * nos: [{ chave, nome, tipo: 'atividade'|'decisao'|'inicio'|'fim'|'passa', unidade?, agente?, documentos?, orientacao? }]
 * arestas: [{ de, para, rotulo? }]
 * Decisões e eventos intermediários somem: a saída de uma atividade que passa
 * por uma decisão vira "próxima" com a condição escrita na seta.
 */
export function propostaDeGrafo(nos, arestas, avisos = []) {
    const porChave = new Map(nos.map((n) => [n.chave, n]));
    const saidas = new Map();
    for (const a of arestas) {
        if (!porChave.has(a.de) || !porChave.has(a.para)) continue;
        if (!saidas.has(a.de)) saidas.set(a.de, []);
        saidas.get(a.de).push(a);
    }
    const resolver = (chave, rotulo, vistos) => {
        const out = [];
        for (const a of saidas.get(chave) || []) {
            const alvo = porChave.get(a.para);
            const r = [rotulo, limpar(a.rotulo)].filter(Boolean).join(' e ');
            if (alvo.tipo === 'atividade') out.push({ alvo: alvo.chave, rotulo: r });
            else if (alvo.tipo === 'fim') out.push({ alvo: null, rotulo: r });
            else if (!vistos.has(alvo.chave)) { vistos.add(alvo.chave); out.push(...resolver(alvo.chave, alvo.tipo === 'decisao' && !limpar(a.rotulo) && alvo.nome ? '' : r, vistos)); }
        }
        return out;
    };
    const atividades = nos.filter((n) => n.tipo === 'atividade' && n.nome);
    if (!atividades.length) return { fases: [], avisos: [...avisos, 'Nenhuma atividade ou fase encontrada no diagrama'] };
    // Ordem: percurso em largura a partir do início; o que sobrar, na ordem do arquivo.
    const ordem = [];
    const fila = [];
    for (const n of nos.filter((x) => x.tipo === 'inicio')) fila.push(...resolver(n.chave, '', new Set()).map((x) => x.alvo).filter(Boolean));
    const comEntrada = new Set(arestas.map((a) => a.para));
    if (!fila.length) fila.push(...atividades.filter((n) => !comEntrada.has(n.chave)).map((n) => n.chave));
    while (fila.length) {
        const k = fila.shift();
        if (ordem.includes(k)) continue;
        ordem.push(k);
        fila.push(...resolver(k, '', new Set()).map((x) => x.alvo).filter(Boolean));
    }
    for (const n of atividades) if (!ordem.includes(n.chave)) ordem.push(n.chave);
    const ids = new Map(ordem.map((k) => [k, novoIdFase()]));
    const fases = ordem.map((k) => {
        const n = porChave.get(k);
        const saem = resolver(k, '', new Set());
        const proximas = unicos(saem.map((s) => ids.get(s.alvo)));
        const condicoes = {};
        for (const s of saem) if (s.alvo && s.rotulo) condicoes[ids.get(s.alvo)] = s.rotulo.slice(0, 80);
        const { nome, prazo_dias } = nomeEPrazo(n.nome);
        return {
            id: ids.get(k), nome, ...(prazo_dias ? { prazo_dias } : {}),
            ...(n.unidade ? { unidade: n.unidade } : {}), ...(n.agente ? { agente: n.agente } : {}),
            ...(n.documentos?.length ? { modelos: unicos(n.documentos) } : {}),
            ...(n.orientacao ? { orientacao: n.orientacao } : {}),
            proximas, ...(Object.keys(condicoes).length ? { condicoes } : {}),
            ...(!proximas.length && saem.some((s) => !s.alvo) ? { final: true } : {}),
        };
    });
    // Sem saída no meio da lista também é fim de ramo.
    fases.forEach((f, i) => { if (!f.proximas.length && i < fases.length - 1) f.final = true; });
    return { fases: simplificar(fases), avisos };
}

// ---- XML (BPMN e draw.io) ----------------------------------------------------

/** Etiquetas XML em ordem: { fecha, nome (sem prefixo), attrs, auto } ou { texto }. */
function* etiquetas(xml) {
    const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([\w.-]+:)?([\w.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
    let m;
    while ((m = re.exec(xml))) {
        if (m[1] !== undefined) yield { texto: m[1] };
        else if (m[7] !== undefined) { if (m[7].trim()) yield { texto: m[7] }; }
        else if (m[4]) {
            const attrs = {};
            for (const a of (m[5] || '').matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1].replace(/^[\w.-]+:/, '')] = a[2] ?? a[3];
            yield { fecha: m[2] === '/', nome: m[4], attrs, auto: m[6] === '/' };
        }
    }
}

const ATIVIDADES_BPMN = /^(task|userTask|manualTask|serviceTask|scriptTask|sendTask|receiveTask|businessRuleTask|subProcess|callActivity|adHocSubProcess|transaction)$/;
const DECISOES_BPMN = /^(exclusiveGateway|inclusiveGateway|complexGateway|eventBasedGateway)$/;
const PASSAGEM_BPMN = /^(parallelGateway|intermediateThrowEvent|intermediateCatchEvent|boundaryEvent)$/;

/** BPMN 2.0 (XML): tarefas viram fases, raias (lanes) e piscinas viram unidades. */
export function propostaDeBpmn(xml) {
    const avisos = [];
    const nos = new Map();
    const arestas = [];
    const raiaDe = new Map();
    const piscinaDoProcesso = new Map();
    const docs = new Map(); // id do dataObjectReference -> nome
    const docsDaTarefa = []; // [tarefa, idDoc]
    const notas = new Map(); // id da textAnnotation -> texto
    const associacoes = [];
    let raia = null;
    let processo = null;
    let tarefa = null; // dentro de uma tarefa (para dataInput/OutputAssociation)
    let assoc = null;
    let campo = null; // etiqueta de texto que estamos lendo
    let fluxo = null;
    let notaAtual = null;
    let fluxoNoRef = false;
    for (const e of etiquetas(String(xml || ''))) {
        if (e.texto !== undefined) {
            const t = limpar(e.texto);
            if (fluxoNoRef && raia) raiaDe.set(t, raia);
            else if (campo === 'targetRef' && assoc) assoc.alvo = t;
            else if (campo === 'sourceRef' && assoc) assoc.origem = t;
            else if (campo === 'conditionExpression' && fluxo && !fluxo.rotulo) fluxo.rotulo = t;
            else if (campo === 'text' && notaAtual) notas.set(notaAtual, t);
            continue;
        }
        const { nome, attrs } = e;
        if (e.fecha) {
            if (nome === 'flowNodeRef') fluxoNoRef = false;
            if (nome === 'lane') raia = null;
            if (ATIVIDADES_BPMN.test(nome)) tarefa = null;
            if (/^data(Input|Output)Association$/.test(nome) && assoc) { if (tarefa) docsDaTarefa.push([tarefa, nome === 'dataOutputAssociation' ? assoc.alvo : assoc.origem]); assoc = null; }
            if (nome === 'sequenceFlow') fluxo = null;
            if (nome === 'textAnnotation') notaAtual = null;
            campo = null;
            continue;
        }
        if (nome === 'participant' && attrs.processRef) piscinaDoProcesso.set(attrs.processRef, limpar(attrs.name));
        else if (nome === 'process') processo = attrs.id;
        else if (nome === 'lane') { raia = limpar(attrs.name) || null; }
        else if (nome === 'flowNodeRef') fluxoNoRef = !e.auto;
        else if (ATIVIDADES_BPMN.test(nome) || DECISOES_BPMN.test(nome) || PASSAGEM_BPMN.test(nome) || nome === 'startEvent' || nome === 'endEvent') {
            const tipo = ATIVIDADES_BPMN.test(nome) ? 'atividade' : DECISOES_BPMN.test(nome) ? 'decisao' : nome === 'startEvent' ? 'inicio' : nome === 'endEvent' ? 'fim' : 'passa';
            nos.set(attrs.id, { chave: attrs.id, nome: limpar(attrs.name), tipo, processo, documentos: [] });
            if (tipo === 'atividade' && !e.auto) tarefa = attrs.id;
            // Evento de borda (prazo, erro) sai da tarefa a que está preso.
            if (nome === 'boundaryEvent' && attrs.attachedToRef) arestas.push({ de: attrs.attachedToRef, para: attrs.id, rotulo: limpar(attrs.name) });
        } else if (nome === 'sequenceFlow') {
            fluxo = { de: attrs.sourceRef, para: attrs.targetRef, rotulo: limpar(attrs.name) };
            arestas.push(fluxo);
            if (e.auto) fluxo = null;
        } else if (nome === 'conditionExpression' || nome === 'targetRef' || nome === 'sourceRef' || nome === 'text') campo = nome;
        else if (/^data(Input|Output)Association$/.test(nome)) assoc = {};
        else if (nome === 'dataObjectReference' || nome === 'dataStoreReference') docs.set(attrs.id, limpar(attrs.name));
        else if (nome === 'textAnnotation') notaAtual = attrs.id;
        else if (nome === 'association') associacoes.push([attrs.sourceRef, attrs.targetRef]);
    }
    for (const [t, d] of docsDaTarefa) if (nos.get(t) && docs.get(d)) nos.get(t).documentos.push(docs.get(d));
    for (const [a, b] of associacoes) {
        const [no, nota] = notas.has(b) ? [a, b] : [b, a];
        if (nos.get(no) && notas.get(nota)) nos.get(no).orientacao = [nos.get(no).orientacao, notas.get(nota)].filter(Boolean).join(' ').slice(0, 2000);
    }
    for (const n of nos.values()) n.unidade = raiaDe.get(n.chave) || piscinaDoProcesso.get(n.processo) || undefined;
    if (!nos.size) avisos.push('Não parece um BPMN: nenhuma tarefa ou evento encontrado');
    return propostaDeGrafo([...nos.values()], arestas, avisos);
}

/** Texto do <diagram> do draw.io comprimido (deflate cru + base64 + URI). */
async function descomprimirDrawio(b64) {
    const bytes = Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0));
    const ds = new DecompressionStream('deflate-raw');
    const texto = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();
    try { return decodeURIComponent(texto); } catch { return texto; }
}

/**
 * draw.io / diagrams.net (.drawio ou .xml, comprimido ou não). Caixas viram
 * fases, losangos viram decisões, elipses início/fim, raias (swimlane) viram
 * unidades e a forma "documento" ligada a uma caixa vira modelo da fase.
 */
export async function propostaDeDrawio(xml) {
    let fonte = String(xml || '');
    const comprimido = fonte.match(/<diagram\b[^>]*>\s*([A-Za-z0-9+/=\s]+?)\s*<\/diagram>/);
    if (comprimido && !/<mxGraphModel/.test(fonte)) fonte = await descomprimirDrawio(comprimido[1]);
    const celulas = [];
    let objeto = null;
    for (const e of etiquetas(fonte)) {
        if (e.texto !== undefined || e.fecha) { if (e.fecha && /^(object|UserObject)$/.test(e.nome)) objeto = null; continue; }
        if (/^(object|UserObject)$/.test(e.nome)) objeto = e.attrs;
        else if (e.nome === 'mxCell') celulas.push({ ...e.attrs, ...(objeto ? { id: objeto.id, value: objeto.label ?? objeto.value ?? e.attrs.value } : {}) });
    }
    const porId = new Map(celulas.map((c) => [c.id, c]));
    const estilo = (c) => String(c.style || '');
    const ehRaia = (c) => /swimlane|shape=(pool|table)/.test(estilo(c));
    const vertices = celulas.filter((c) => c.vertex === '1' && !ehRaia(c) && !/^text;|edgeLabel/.test(estilo(c)));
    const arestasBrutas = celulas.filter((c) => c.edge === '1' && c.source && c.target);
    // Rótulo da seta que o draw.io guarda como filho da aresta.
    for (const c of celulas) if (/edgeLabel/.test(estilo(c)) && porId.get(c.parent)?.edge === '1' && limpar(c.value)) porId.get(c.parent).value = c.value;
    const raiaDe = (c) => { let p = porId.get(c.parent); while (p) { if (ehRaia(p) && limpar(p.value)) return limpar(p.value); p = porId.get(p.parent); } return undefined; };
    const entra = new Set(arestasBrutas.map((a) => a.target));
    const sai = new Set(arestasBrutas.map((a) => a.source));
    const docs = new Set(vertices.filter((c) => /shape=(document|note)|shape=mxgraph\.flowchart\.document/.test(estilo(c))).map((c) => c.id));
    const nos = vertices.filter((c) => !docs.has(c.id)).map((c) => {
        const s = estilo(c);
        const tipo = /rhombus|shape=mxgraph\.flowchart\.decision/.test(s) ? 'decisao'
            : /ellipse|shape=mxgraph\.flowchart\.(start|terminator)|rounded=1;.*arcSize=50/.test(s) && /^(inicio|início|start|fim|end|encerra|termino|término)/i.test(limpar(c.value) || (entra.has(c.id) ? 'fim' : 'inicio'))
                ? (entra.has(c.id) && !sai.has(c.id) ? 'fim' : 'inicio')
                : /ellipse/.test(s) && !limpar(c.value) ? (entra.has(c.id) ? 'fim' : 'inicio') : 'atividade';
        return { chave: c.id, nome: limpar(c.value), tipo, unidade: raiaDe(c), documentos: [] };
    });
    const porChave = new Map(nos.map((n) => [n.chave, n]));
    const arestas = [];
    for (const a of arestasBrutas) {
        // Documento ligado a uma caixa: modelo da fase, fora do fluxo.
        if (docs.has(a.source) || docs.has(a.target)) {
            const [doc, alvo] = docs.has(a.source) ? [a.source, a.target] : [a.target, a.source];
            porChave.get(alvo)?.documentos.push(limpar(porId.get(doc).value));
            continue;
        }
        arestas.push({ de: a.source, para: a.target, rotulo: limpar(a.value) });
    }
    const avisos = celulas.length ? [] : ['Não parece um diagrama do draw.io (nenhuma forma encontrada)'];
    return propostaDeGrafo(nos, arestas, avisos);
}

// ---- Mermaid -----------------------------------------------------------------

const NO_MMD = /([A-Za-z0-9_À-ſ]+)\s*(\(\(.+?\)\)|\(\[.+?\]\)|\[\[.+?\]\]|\[\(.+?\)\]|\[.+?\]|\(.+?\)|\{\{.+?\}\}|\{.+?\}|>.+?\])?/y;
const SETA_MMD = /\s*(?:--\s*([^->|]+?)\s*-->|(?:-->|---|-\.->|==>|-\.-|--o|--x))\s*(?:\|([^|]*)\|)?\s*/y;

/** Fluxograma Mermaid com decisões ({...}), rótulos nas setas e subgraphs como unidades. */
export function propostaDeMermaid(texto) {
    const nos = new Map();
    const arestas = [];
    const avisos = [];
    const raias = [];
    const no = (chave, bruto) => {
        if (!nos.has(chave)) nos.set(chave, { chave, nome: chave, tipo: 'atividade', unidade: raias[raias.length - 1] });
        const n = nos.get(chave);
        if (bruto) {
            // Vale o subgraph em que o nó ganha o rótulo (onde é "definido").
            if (raias.length) n.unidade = raias[raias.length - 1];
            n.nome = bruto.replace(/^(\(\(|\(\[|\[\[|\[\(|\{\{|\[|\(|\{|>)/, '').replace(/(\)\)|\]\)|\]\]|\)\]|\}\}|\]|\)|\})$/, '').replace(/^["']|["']$/g, '').trim();
            if (/^\{/.test(bruto)) n.tipo = 'decisao';
            else if (/^(\(\(|\(\[)/.test(bruto) && /^(inicio|início|start|fim|end|encerra|termino|término)/i.test(n.nome)) n.tipo = /^(inicio|início|start)/i.test(n.nome) ? 'inicio' : 'fim';
        }
        return n;
    };
    for (const bruta of String(texto || '').split(/\n|;/)) {
        const linha = bruta.replace(/%%.*$/, '').trim();
        if (!linha || /^(flowchart|graph|classDef|class |style |linkStyle|click |direction)/i.test(linha)) continue;
        const sg = linha.match(/^subgraph\s+(?:[\w-]+\s*\[\s*"?(.+?)"?\s*\]|"?(.+?)"?)\s*$/i);
        if (sg) { raias.push((sg[1] || sg[2]).trim()); continue; }
        if (/^end$/i.test(linha)) { raias.pop(); continue; }
        let pos = 0;
        let anterior = null;
        let rotulo = '';
        while (pos < linha.length) {
            NO_MMD.lastIndex = pos;
            const m = NO_MMD.exec(linha);
            if (!m) { avisos.push(`Linha ignorada: ${linha}`); break; }
            const atual = no(m[1], m[2]);
            if (anterior) arestas.push({ de: anterior.chave, para: atual.chave, rotulo });
            pos = NO_MMD.lastIndex;
            SETA_MMD.lastIndex = pos;
            const s = SETA_MMD.exec(linha);
            if (!s) break;
            rotulo = (s[1] || s[2] || '').trim();
            anterior = atual;
            pos = SETA_MMD.lastIndex;
        }
    }
    return propostaDeGrafo([...nos.values()], arestas, avisos);
}

// ---- Planilha ----------------------------------------------------------------

const COLUNAS = {
    nome: ['fase', 'nome', 'etapa', 'nome da fase', 'fase/etapa', 'passo'],
    unidade: ['unidade', 'setor', 'unidade responsavel', 'lotacao', 'area', 'departamento', 'orgao responsavel', 'raia'],
    agente: ['agente', 'responsavel', 'quem', 'cargo', 'papel', 'executor', 'ator', 'quem faz'],
    prazo: ['prazo', 'prazo (dias)', 'prazo dias', 'prazo em dias', 'dias'],
    acoes: ['acoes', 'acao', 'atividade', 'atividades', 'tarefa', 'tarefas', 'o que fazer', 'providencias', 'providencia'],
    modelos: ['modelos', 'modelo', 'documentos', 'documento', 'pecas', 'peca', 'documento gerado', 'documentos gerados'],
    proximas: ['proximas', 'proximas fases', 'segue para', 'proxima', 'proxima fase', 'destino', 'encaminhamento', 'encaminhamentos'],
    condicao: ['condicao', 'condicoes', 'se', 'quando', 'decisao', 'alternativa', 'alternativas', 'opcao', 'opcoes'],
    orientacao: ['orientacao', 'orientacoes', 'descricao', 'instrucoes', 'observacao', 'observacoes', 'obs'],
};

/** "Cumprimento (se deferido)", "se deferido: Cumprimento", "Deferido -> Cumprimento". */
function refComCondicao(ref, nomes) {
    let m = ref.match(/^(.+?)\s*\(\s*(.+?)\s*\)$/);
    if (m && nomes.has(sem(m[1]))) return { alvo: m[1], condicao: m[2] };
    m = ref.match(/^(.+?)\s*(?:->|→|=>|:)\s*(.+)$/);
    if (m && nomes.has(sem(m[2]))) return { alvo: m[2], condicao: m[1].replace(/^se\s+/i, 'se ') };
    if (m && nomes.has(sem(m[1]))) return { alvo: m[1], condicao: m[2] };
    return { alvo: ref, condicao: '' };
}

/**
 * Planilha (matriz de células). Cabeçalho com qualquer das colunas de COLUNAS,
 * em qualquer ordem. Várias linhas da mesma fase (ou com a célula da fase
 * vazia) somam ações, modelos e saídas. Sem cabeçalho reconhecido, a ordem é
 * Fase | Prazo | Próximas | Orientação.
 */
export function propostaDeTabela(linhas) {
    const rows = (linhas || []).map((r) => (r || []).map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean));
    if (!rows.length) return { fases: [], avisos: ['A planilha está vazia'] };
    const cab = rows[0].map(sem);
    const idx = Object.fromEntries(Object.entries(COLUNAS).map(([k, nomes]) => [k, cab.findIndex((c) => nomes.includes(c))]));
    const temCab = idx.nome >= 0;
    const col = temCab ? idx : { nome: 0, prazo: 1, proximas: 2, orientacao: 3, unidade: -1, agente: -1, acoes: -1, modelos: -1, condicao: -1 };
    const cel = (r, k) => (col[k] >= 0 ? r[col[k]] || '' : '');
    const fases = [];
    let atual = null;
    for (const r of temCab ? rows.slice(1) : rows) {
        const nomeCel = cel(r, 'nome');
        if (nomeCel) {
            const { nome, prazo_dias } = nomeEPrazo(nomeCel);
            atual = fases.find((f) => sem(f.nome) === sem(nome));
            if (!atual) { atual = { id: novoIdFase(), nome, acoes: [], modelos: [], _saidas: [], _orient: [] }; fases.push(atual); }
            if (prazo_dias && !atual.prazo_dias) atual.prazo_dias = prazo_dias;
        }
        if (!atual) continue;
        const prazo = parseInt(cel(r, 'prazo'), 10);
        if (prazo > 0 && !atual.prazo_dias) atual.prazo_dias = prazo;
        if (cel(r, 'unidade') && !atual.unidade) atual.unidade = cel(r, 'unidade');
        if (cel(r, 'agente') && !atual.agente) atual.agente = cel(r, 'agente');
        atual.acoes.push(...lista(cel(r, 'acoes')));
        atual.modelos.push(...lista(cel(r, 'modelos')).flatMap((m) => m.split(/\s*,\s*/)));
        if (cel(r, 'orientacao')) atual._orient.push(cel(r, 'orientacao'));
        const refs = cel(r, 'proximas').split(/[;\n/]|,(?![^(]*\))|\s+e\s+|\s+ou\s+/).map((s) => s.trim()).filter(Boolean);
        const conds = lista(cel(r, 'condicao'));
        refs.forEach((ref, i) => atual._saidas.push({ ref, condicao: conds[i] || (refs.length === 1 ? conds.join(' ') : '') }));
    }
    const avisos = [];
    const nomes = new Set(fases.map((f) => sem(f.nome)));
    const porNome = new Map(fases.map((f) => [sem(f.nome), f.id]));
    for (const f of fases) {
        const proximas = [];
        const condicoes = {};
        for (const s of f._saidas) {
            if (/^(fim|final|encerra(mento)?|encerrar|-)$/.test(sem(s.ref))) { if (!f._saidas.some((x) => x !== s && porNome.has(sem(refComCondicao(x.ref, nomes).alvo)))) f.final = true; continue; }
            const n = Number(s.ref);
            const { alvo, condicao } = refComCondicao(s.ref, nomes);
            const id = Number.isInteger(n) && fases[n - 1] ? fases[n - 1].id : porNome.get(sem(alvo));
            if (!id) { avisos.push(`"${f.nome}" segue para "${s.ref}", que não está na planilha`); continue; }
            if (!proximas.includes(id)) proximas.push(id);
            const c = s.condicao || condicao;
            if (c) condicoes[id] = c.slice(0, 80);
        }
        f.proximas = proximas;
        if (Object.keys(condicoes).length) f.condicoes = condicoes;
        if (f._orient.length) f.orientacao = unicos(f._orient).join('\n');
        f.acoes = unicos(f.acoes);
        f.modelos = unicos(f.modelos);
        if (!f.acoes.length) delete f.acoes;
        if (!f.modelos.length) delete f.modelos;
        delete f._saidas;
        delete f._orient;
    }
    return { fases: simplificar(fases), avisos };
}

// ---- Texto corrido -------------------------------------------------------------

const CABECALHO_FASE = [
    /^(?:#{1,4}\s*)?(?:fase|etapa|passo)\s*(?:n[ºo°.]?\s*)?(\d{1,2}|[ivxl]{1,5})?\s*[-–—:.)]?\s*(.+)$/i,
    /^(?:#{1,4}\s*)?(\d{1,2})\s*[.)–—-]\s+(.{2,120})$/,
    /^#{1,4}\s+(.{2,120})$/,
];
const CHAVES = [
    ['agente', /^(?:respons[aá]vel|agente|quem(?: faz)?|executor|cargo|papel)\s*[:–-]\s*(.+)$/i],
    ['unidade', /^(?:unidade|setor|lota[cç][aã]o|[aá]rea|departamento)(?: respons[aá]vel)?\s*[:–-]\s*(.+)$/i],
    ['modelos', /^(?:documentos?|modelos?|pe[cç]as?)(?: (?:gerad|produzid|expedid)[oa]s?)?\s*[:–-]\s*(.+)$/i],
    ['proximas', /^(?:pr[oó]xima(?:s)?(?: fases?| etapas?)?|segue para|encaminh(?:a|ar|amento)(?: para)?|depois|em seguida)\s*[:–-]\s*(.+)$/i],
    ['orientacao', /^(?:orienta[cç](?:[aã]o|[oõ]es)|observa[cç](?:[aã]o|[oõ]es)|obs\.?|descri[cç][aã]o|instru[cç](?:[aã]o|[oõ]es))\s*[:–-]\s*(.+)$/i],
    ['acoes', /^(?:a[cç](?:[aã]o|[oõ]es)|atividades?|tarefas?|provid[eê]ncias?)\s*[:–-]\s*(.+)$/i],
];
const SE_ENTAO = /^(?:[-*•]\s*)?(?:se|caso|quando|havendo|sendo)\s+(.+?)\s*[,:]\s*(?:o processo\s+)?(?:segue|vai|passa|encaminha(?:-se)?|remete(?:-se)?|volta|retorna)(?:\s+(?:para|à|ao|a|o))?\s+(.+?)\.?$/i;

/**
 * Texto de Word, PDF ou TXT. Reconhece fases por "Fase 1 – Nome", "1. Nome"
 * ou títulos; dentro de cada uma, "Responsável:", "Unidade:", "Prazo de N
 * dias", "Documentos:", "Segue para:", "Se X, segue para Y" e itens de lista
 * (ações). O restante vira orientação.
 */
export function propostaDeTexto(texto) {
    const linhas = String(texto || '').replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const fases = [];
    const avisos = [];
    let nomeRito = '';
    let atual = null;
    const cabecalho = (l) => {
        if (l.length > 140 || SE_ENTAO.test(l)) return null;
        for (const re of CABECALHO_FASE) {
            const m = l.match(re);
            if (m) {
                const nome = (m[2] ?? m[1]).replace(/[.:]$/, '').trim();
                if (nome && !CHAVES.some(([, r]) => r.test(nome))) return nome;
            }
        }
        return null;
    };
    for (const l of linhas) {
        const h = cabecalho(l);
        if (h) {
            const { nome, prazo_dias } = nomeEPrazo(h);
            atual = { id: novoIdFase(), nome, acoes: [], modelos: [], _saidas: [], _orient: [], ...(prazo_dias ? { prazo_dias } : {}) };
            fases.push(atual);
            continue;
        }
        if (!atual) { if (!nomeRito && l.length <= 120) nomeRito = l.replace(/[.:]$/, ''); continue; }
        const prazo = l.match(/prazo\s*(?:de|:)?\s*(?:at[eé]\s*)?(\d{1,4})\s*\(?[a-z ]*\)?\s*dias?/i);
        if (prazo && !atual.prazo_dias) atual.prazo_dias = Number(prazo[1]);
        const se = l.match(SE_ENTAO);
        if (se) { atual._saidas.push({ ref: se[2], condicao: `se ${se[1]}` }); continue; }
        const chave = CHAVES.find(([, re]) => re.test(l));
        if (chave) {
            const v = l.match(chave[1])[1].trim();
            if (chave[0] === 'agente' || chave[0] === 'unidade') { if (!atual[chave[0]]) atual[chave[0]] = v.replace(/[.;]$/, ''); }
            else if (chave[0] === 'modelos') atual.modelos.push(...v.split(/\s*[;,]\s*|\s+e\s+/).map((x) => x.replace(/[.]$/, '').trim()).filter(Boolean));
            else if (chave[0] === 'proximas') atual._saidas.push(...v.split(/\s*[;,]\s*|\s+ou\s+/).map((ref) => ({ ref: ref.replace(/[.]$/, ''), condicao: '' })));
            else if (chave[0] === 'acoes') atual.acoes.push(...v.split(/\s*;\s*/).filter(Boolean));
            else atual._orient.push(v);
            continue;
        }
        if (/^([-*•–·]|\d{1,2}\.\d{1,2}|[a-z]\))\s*/.test(l)) { atual.acoes.push(l.replace(/^([-*•–·]|\d{1,2}\.\d{1,2}\.?|[a-z]\))\s*/, '')); continue; }
        if (!prazo) atual._orient.push(l);
    }
    if (!fases.length) return { fases: [], avisos: ['Não achei fases no texto. Use títulos como "Fase 1 – Autuação" ou uma lista numerada, ou envie uma planilha.'] };
    const nomes = new Set(fases.map((f) => sem(f.nome)));
    const porNome = new Map(fases.map((f) => [sem(f.nome), f.id]));
    // Referência pelo nome exato, pelo início do nome ("Decisão" → "Decisão final") ou pelo número.
    const achar = (ref) => {
        const r = sem(ref).replace(/^(a|o|à|ao|fase|etapa)\s+/, '').replace(/^(fase|etapa)\s+/, '');
        if (porNome.has(r)) return porNome.get(r);
        const n = Number(r.match(/^\d{1,2}$/)?.[0]);
        if (n && fases[n - 1]) return fases[n - 1].id;
        const parcial = fases.find((f) => sem(f.nome).startsWith(r) || r.startsWith(sem(f.nome)));
        return parcial?.id || null;
    };
    fases.forEach((f, i) => {
        const proximas = [];
        const condicoes = {};
        for (const s of f._saidas) {
            if (/^(fim|o fim|encerra|encerramento|arquiva|arquivamento definitivo)$/.test(sem(s.ref)) && !nomes.has(sem(s.ref))) { if (!proximas.length) f.final = true; continue; }
            const id = achar(s.ref);
            if (!id) { avisos.push(`"${f.nome}" segue para "${s.ref}", que não achei entre as fases`); continue; }
            if (id === f.id) continue;
            if (!proximas.includes(id)) proximas.push(id);
            if (s.condicao) condicoes[id] = s.condicao.slice(0, 80);
        }
        if (proximas.length) delete f.final;
        // Só condições, sem a saída "normal": a próxima da lista continua valendo.
        if (proximas.length && Object.keys(condicoes).length === proximas.length && i < fases.length - 1 && !proximas.includes(fases[i + 1].id) && f._saidas.every((s) => s.condicao)) proximas.push(fases[i + 1].id);
        f.proximas = proximas;
        if (Object.keys(condicoes).length) f.condicoes = condicoes;
        if (f._orient.length) f.orientacao = f._orient.join(' ').slice(0, 2000);
        f.acoes = unicos(f.acoes).slice(0, 20);
        f.modelos = unicos(f.modelos).slice(0, 10);
        if (!f.acoes.length) delete f.acoes;
        if (!f.modelos.length) delete f.modelos;
        delete f._saidas;
        delete f._orient;
    });
    return { fases: simplificar(fases), avisos, nome: nomeRito };
}

// ---- Entrada por arquivo -------------------------------------------------------

/** Qual leitor usar para o texto (XML/diagrama) colado ou lido de arquivo. */
export async function propostaDeConteudo(texto, nomeArquivo = '') {
    const t = String(texto || '');
    const ext = (nomeArquivo.split('.').pop() || '').toLowerCase();
    if (/<(\w+:)?definitions\b[\s\S]*bpmn/i.test(t) || ext === 'bpmn') return { ...propostaDeBpmn(t), origem: 'BPMN' };
    if (/<mxfile\b|<mxGraphModel\b/.test(t) || ext === 'drawio') return { ...(await propostaDeDrawio(t)), origem: 'draw.io' };
    if (/^\s*(flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/im.test(t) || ext === 'mmd') return { ...propostaDeMermaid(t), origem: 'Mermaid' };
    // Tabela colada (separada por tabulação) com cabeçalho reconhecível.
    const linhas = t.split('\n').filter((l) => l.trim());
    if (linhas.length > 1 && linhas[0].includes('\t')) {
        const r = propostaDeTabela(linhas.map((l) => l.split('\t')));
        if (r.fases.length) return { ...r, origem: 'tabela' };
    }
    return { ...propostaDeTexto(t), origem: 'texto' };
}

// ---- Vínculo com o órgão --------------------------------------------------------

/**
 * Casa as unidades e modelos citados com os do órgão (nome ou sigla, sem
 * acento) e devolve o que precisa ser criado. As fases passam a ter
 * `unidade_ref` (id existente ou "+N" nova) e `modelos_ref` (idem).
 */
export function vincularProposta(proposta, estado) {
    const unidades = [];
    const modelos = [];
    const existentes = (estado.unidades || []).filter((u) => u.ativa !== false);
    const refUnidade = (nome) => {
        if (!nome) return null;
        const n = sem(nome);
        const u = existentes.find((x) => sem(x.nome) === n || (x.sigla && sem(x.sigla) === n));
        if (u) return u.id;
        let nova = unidades.find((x) => sem(x.nome) === n);
        if (!nova) { nova = { ref: `+${unidades.length}`, nome: nome.slice(0, 120), tipo: tipoProvavel(nome) }; unidades.push(nova); }
        return nova.ref;
    };
    const refModelo = (nome, unidadeRef) => {
        const n = sem(nome);
        const m = (estado.modelos || []).find((x) => sem(x.nome) === n && (!x.unidade_id || x.unidade_id === unidadeRef));
        if (m) return m.id;
        let novo = modelos.find((x) => sem(x.nome) === n && x.unidade_ref === unidadeRef);
        if (!novo) { novo = { ref: `+${modelos.length}`, nome: nome.slice(0, 120), unidade_ref: unidadeRef, tipo_documento: tipoDocumentoDe(nome, estado) }; modelos.push(novo); }
        return novo.ref;
    };
    const fases = proposta.fases.map((f) => {
        const unidade_ref = refUnidade(f.unidade);
        return { ...f, unidade_ref, modelos_ref: (f.modelos || []).map((m) => refModelo(m, unidade_ref)) };
    });
    return { ...proposta, fases, unidades, modelos };
}

/** Tipo de documento do órgão que aparece no nome do modelo ("Ofício de intimação" → Ofício). */
export function tipoDocumentoDe(nome, estado) {
    const n = sem(nome);
    return (estado.documento?.tipos_documento || []).find((t) => n.startsWith(sem(t)) || n.includes(` ${sem(t)}`)) || '';
}
