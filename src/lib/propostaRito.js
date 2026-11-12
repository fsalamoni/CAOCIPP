// ============================================================================
// Proposta de rito a partir de arquivos (etapa 3), sem IA: planilha com
// colunas ricas e várias abas, BPMN (Camunda, Bizagi, bpmn.io), XPDL e o
// pacote .bpm do Bizagi (várias páginas, subprocessos, paralelos), draw.io
// (diagrams.net), Mermaid e texto corrido (Word, PDF, TXT). Tudo vira a mesma
// proposta:
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
const SUBPROCESSOS_BPMN = /^(subProcess|adHocSubProcess|transaction)$/;
const DECISOES_BPMN = /^(exclusiveGateway|inclusiveGateway|complexGateway|eventBasedGateway)$/;
const PASSAGEM_BPMN = /^(parallelGateway|intermediateThrowEvent|intermediateCatchEvent|boundaryEvent)$/;

/*
 * Os leitores de diagrama (BPMN e XPDL) devolvem um "modelo" com níveis:
 *   { nos: [{ chave, nome, tipo, container, sub?, paralelo?, unidade?, documentos, orientacao? }],
 *     arestas: [{ de, para, rotulo? }], containers: [{ id, nome }], avisos }
 * `container` é o processo (piscina/página) ou subprocesso em que o nó está;
 * `sub` é o container que a atividade detalha (subprocesso embutido, página
 * de subprocesso do Bizagi, callActivity). `propostaDeModelos` junta vários
 * modelos (as páginas de um pacote do Bizagi), abre os subprocessos no lugar
 * da atividade, encadeia processos soltos e põe ramos paralelos em sequência,
 * porque o processo eletrônico anda uma fase por vez.
 */

/** BPMN 2.0 (XML) → modelo com níveis. Tarefas viram fases; raias e piscinas, unidades. */
export function modeloDeBpmn(xml) {
    const avisos = [];
    const nos = new Map();
    const arestas = [];
    const containers = [];
    const raiaDe = new Map();
    const piscinaDoProcesso = new Map();
    const docs = new Map(); // id do dataObjectReference -> nome
    const docsDaTarefa = []; // [tarefa, idDoc]
    const notas = new Map(); // id da textAnnotation -> texto
    const associacoes = [];
    const pilha = []; // processo e subprocessos abertos
    let raia = null;
    let tarefa = null; // dentro de uma tarefa (para dataInput/OutputAssociation)
    let assoc = null;
    let campo = null; // etiqueta de texto que estamos lendo
    let fluxo = null;
    let notaAtual = null;
    let fluxoNoRef = false;
    let docNo = null; // nó cuja <documentation> estamos lendo
    for (const e of etiquetas(String(xml || ''))) {
        if (e.texto !== undefined) {
            const t = limpar(e.texto);
            if (fluxoNoRef && raia) raiaDe.set(t, raia);
            else if (campo === 'targetRef' && assoc) assoc.alvo = t;
            else if (campo === 'sourceRef' && assoc) assoc.origem = t;
            else if (campo === 'conditionExpression' && fluxo && !fluxo.rotulo) fluxo.rotulo = t;
            else if (campo === 'text' && notaAtual) notas.set(notaAtual, t);
            else if (campo === 'documentation' && docNo && t) docNo.orientacao = [docNo.orientacao, t].filter(Boolean).join(' ').slice(0, 2000);
            continue;
        }
        const { nome, attrs } = e;
        if (e.fecha) {
            if (nome === 'flowNodeRef') fluxoNoRef = false;
            if (nome === 'lane') raia = null;
            if (nome === 'process' || SUBPROCESSOS_BPMN.test(nome)) pilha.pop();
            if (ATIVIDADES_BPMN.test(nome)) tarefa = null;
            if (/^data(Input|Output)Association$/.test(nome) && assoc) { if (tarefa) docsDaTarefa.push([tarefa, nome === 'dataOutputAssociation' ? assoc.alvo : assoc.origem]); assoc = null; }
            if (nome === 'sequenceFlow') fluxo = null;
            if (nome === 'textAnnotation') notaAtual = null;
            if (nome === 'documentation') docNo = null;
            campo = null;
            continue;
        }
        const container = pilha[pilha.length - 1] || '';
        if (nome === 'participant' && attrs.processRef) piscinaDoProcesso.set(attrs.processRef, limpar(attrs.name));
        else if (nome === 'process') { if (!e.auto) pilha.push(attrs.id); containers.push({ id: attrs.id, nome: limpar(attrs.name) }); }
        else if (nome === 'lane') { raia = limpar(attrs.name) || null; }
        else if (nome === 'flowNodeRef') fluxoNoRef = !e.auto;
        else if (ATIVIDADES_BPMN.test(nome) || DECISOES_BPMN.test(nome) || PASSAGEM_BPMN.test(nome) || nome === 'startEvent' || nome === 'endEvent') {
            const tipo = ATIVIDADES_BPMN.test(nome) ? 'atividade' : DECISOES_BPMN.test(nome) ? 'decisao' : nome === 'startEvent' ? 'inicio' : nome === 'endEvent' ? 'fim' : 'passa';
            const no = { chave: attrs.id, nome: limpar(attrs.name), tipo, container, documentos: [] };
            if (nome === 'parallelGateway') no.paralelo = true;
            if (SUBPROCESSOS_BPMN.test(nome)) no.sub = attrs.id;
            if (nome === 'callActivity' && attrs.calledElement) no.sub = attrs.calledElement;
            nos.set(attrs.id, no);
            if (!e.auto) docNo = no;
            if (tipo === 'atividade' && !e.auto) tarefa = attrs.id;
            if (SUBPROCESSOS_BPMN.test(nome) && !e.auto) { pilha.push(attrs.id); containers.push({ id: attrs.id, nome: no.nome }); }
            // Evento de borda (prazo, erro) sai da tarefa a que está preso.
            if (nome === 'boundaryEvent' && attrs.attachedToRef) arestas.push({ de: attrs.attachedToRef, para: attrs.id, rotulo: limpar(attrs.name) });
        } else if (nome === 'sequenceFlow' || nome === 'messageFlow') {
            // Mensagem entre piscinas também passa o processo adiante.
            fluxo = { de: attrs.sourceRef, para: attrs.targetRef, rotulo: limpar(attrs.name), ...(nome === 'messageFlow' ? { mensagem: true } : {}) };
            arestas.push(fluxo);
            if (e.auto) fluxo = null;
        } else if (nome === 'conditionExpression' || nome === 'targetRef' || nome === 'sourceRef' || nome === 'text') campo = nome;
        else if (nome === 'documentation' && docNo) campo = nome;
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
    for (const n of nos.values()) n.unidade = raiaDe.get(n.chave) || piscinaDoProcesso.get(n.container) || undefined;
    for (const c of containers) { c.piscina = piscinaDoProcesso.get(c.id) || ''; if (!c.nome) c.nome = c.piscina; }
    if (!nos.size) avisos.push('Não parece um BPMN: nenhuma tarefa ou evento encontrado');
    return { nos: [...nos.values()], arestas, containers, avisos };
}

/**
 * XPDL 2.x (exportação do Bizagi, e o Diagram.xml de cada página do .bpm).
 * Atividade com Event é início/fim/intermediário; com Route é desvio
 * (Parallel/AND = paralelo); com BlockActivity ou SubFlow é subprocesso.
 * A raia vem do LaneId do desenho; o documento, de Artifact DataObject.
 */
export function modeloDeXpdl(xml) {
    const avisos = [];
    const nos = [];
    const arestas = [];
    const containers = [];
    const raias = new Map(); // id -> nome
    const piscinaDoProcesso = new Map();
    const participantes = new Map();
    const artefatos = new Map(); // id -> { doc?: nome, nota?: texto }
    const associacoes = [];
    const pilha = [];
    let at = null; // atividade aberta
    let trans = null;
    let campo = null;
    let dentroDeEvento = false;
    for (const e of etiquetas(String(xml || ''))) {
        if (e.texto !== undefined) {
            const t = limpar(e.texto);
            if (campo === 'Description' && at && t) at.orientacao = [at.orientacao, t].filter(Boolean).join(' ').slice(0, 2000);
            else if (campo === 'Performer' && at && t) at.performer = t;
            else if (campo === 'Expression' && trans && !trans.rotulo) trans.rotulo = t;
            continue;
        }
        const { nome, attrs } = e;
        if (e.fecha) {
            if (nome === 'WorkflowProcess' || nome === 'ActivitySet') pilha.pop();
            if (nome === 'Activity' && at) { nos.push(fecharAtividadeXpdl(at)); at = null; }
            if (nome === 'Event') dentroDeEvento = false;
            if (nome === 'Transition') trans = null;
            campo = null;
            continue;
        }
        const container = pilha[pilha.length - 1] || '';
        if (nome === 'Pool' && attrs.Process) piscinaDoProcesso.set(attrs.Process, limpar(attrs.Name));
        else if (nome === 'Lane' && attrs.Id) raias.set(attrs.Id, limpar(attrs.Name));
        else if (nome === 'Participant' && attrs.Id) participantes.set(attrs.Id, limpar(attrs.Name));
        else if (nome === 'WorkflowProcess' || nome === 'ActivitySet') {
            containers.push({ id: attrs.Id, nome: limpar(attrs.Name) });
            if (!e.auto) pilha.push(attrs.Id);
        } else if (nome === 'Activity') {
            at = { chave: attrs.Id, nome: limpar(attrs.Name), tipo: 'atividade', container, documentos: [] };
            if (e.auto) { nos.push(fecharAtividadeXpdl(at)); at = null; }
        } else if (at && nome === 'Event') dentroDeEvento = true;
        else if (at && dentroDeEvento && /^(StartEvent|EndEvent|IntermediateEvent)$/.test(nome)) {
            at.evento = nome;
            // Evento preso à borda de uma atividade (prazo, erro).
            if (nome === 'IntermediateEvent' && attrs.Target) arestas.push({ de: attrs.Target, para: at.chave, rotulo: at.nome });
        } else if (at && nome === 'Route') at.route = String(attrs.GatewayType || attrs.ExclusiveType || 'Exclusive');
        else if (at && nome === 'SubFlow' && attrs.Id) at.sub = attrs.Id;
        else if (at && nome === 'BlockActivity' && attrs.ActivitySetId) at.sub = attrs.ActivitySetId;
        else if (at && nome === 'NodeGraphicsInfo' && attrs.LaneId && !at.lane) at.lane = attrs.LaneId;
        else if (at && (nome === 'Description' || nome === 'Performer')) { campo = nome; if (nome === 'Description' && attrs.Value) at.orientacao = limpar(attrs.Value); }
        else if (nome === 'Transition') { trans = { de: attrs.From, para: attrs.To, rotulo: limpar(attrs.Name) }; arestas.push(trans); if (e.auto) trans = null; }
        else if (trans && nome === 'Expression') campo = nome;
        else if (nome === 'MessageFlow' && attrs.Source && attrs.Target) arestas.push({ de: attrs.Source, para: attrs.Target, rotulo: limpar(attrs.Name), mensagem: true });
        else if (nome === 'Artifact' && attrs.Id) {
            if (/DataObject/i.test(attrs.ArtifactType || '')) artefatos.set(attrs.Id, { doc: limpar(attrs.Name) });
            else if (/Annotation/i.test(attrs.ArtifactType || '')) artefatos.set(attrs.Id, { nota: limpar(attrs.TextAnnotation || attrs.Name) });
        } else if (nome === 'Association' && attrs.Source && attrs.Target) associacoes.push([attrs.Source, attrs.Target]);
    }
    const porChave = new Map(nos.map((n) => [n.chave, n]));
    for (const [a, b] of associacoes) {
        const [no, art] = artefatos.has(b) ? [porChave.get(a), artefatos.get(b)] : [porChave.get(b), artefatos.get(a)];
        if (!no || !art) continue;
        if (art.doc) no.documentos.push(art.doc);
        if (art.nota) no.orientacao = [no.orientacao, art.nota].filter(Boolean).join(' ').slice(0, 2000);
    }
    for (const n of nos) {
        n.unidade = raias.get(n.lane) || participantes.get(n.performer) || piscinaDoProcesso.get(n.container) || undefined;
        delete n.lane;
        delete n.performer;
    }
    for (const c of containers) { c.piscina = piscinaDoProcesso.get(c.id) || ''; if (!c.nome) c.nome = c.piscina; }
    if (!nos.length) avisos.push('Não parece um XPDL: nenhuma atividade encontrada');
    return { nos, arestas, containers, avisos };
}

function fecharAtividadeXpdl(at) {
    const { evento, route, ...n } = at;
    if (evento) n.tipo = evento === 'StartEvent' ? 'inicio' : evento === 'EndEvent' ? 'fim' : 'passa';
    else if (route) {
        if (/^(parallel|and)$/i.test(route)) { n.tipo = 'passa'; n.paralelo = true; } else n.tipo = 'decisao';
    }
    if (n.tipo !== 'atividade') delete n.sub;
    return n;
}

/** Abre a atividade-subprocesso no lugar dela: entra no início de dentro, sai pelo fim de dentro. */
function abrirSubprocessos(nos, arestas, avisos) {
    const abertos = new Set();
    for (let volta = 0; volta < 5; volta++) {
        const pendentes = nos.filter((n) => n.sub && n.tipo === 'atividade');
        if (!pendentes.length) break;
        for (const s of pendentes) {
            const dentro = nos.filter((n) => n.container === s.sub);
            if (!dentro.some((n) => n.tipo === 'atividade') || abertos.has(s.sub) || s.container === s.sub) {
                if (abertos.has(s.sub)) avisos.push(`O subprocesso "${s.nome}" aparece mais de uma vez; as etapas dele ficaram só no primeiro uso.`);
                delete s.sub;
                continue;
            }
            abertos.add(s.sub);
            const saida = { chave: `${s.chave}#saida`, nome: '', tipo: 'passa', container: s.container };
            nos.push(saida);
            for (const a of arestas) if (a.de === s.chave) a.de = saida.chave;
            const chaves = new Set(dentro.map((n) => n.chave));
            const entra = new Set(arestas.filter((a) => chaves.has(a.para) && chaves.has(a.de)).map((a) => a.para));
            const sai = new Set(arestas.filter((a) => chaves.has(a.de)).map((a) => a.de));
            const inicios = dentro.filter((n) => n.tipo === 'inicio');
            for (const n of inicios.length ? inicios : dentro.filter((x) => !entra.has(x.chave) && x.tipo !== 'fim')) arestas.push({ de: s.chave, para: n.chave });
            for (const n of dentro) {
                if (n.tipo === 'inicio') n.tipo = 'passa';
                if (n.tipo === 'fim') { n.tipo = 'passa'; arestas.push({ de: n.chave, para: saida.chave }); }
                else if (n.tipo === 'atividade' && !sai.has(n.chave)) arestas.push({ de: n.chave, para: saida.chave });
                if (n.tipo === 'atividade') {
                    n.etapaDe = n.etapaDe ? `${s.nome} › ${n.etapaDe}` : s.nome;
                    if (!n.unidade && s.unidade) n.unidade = s.unidade;
                }
            }
            s.tipo = 'passa';
            delete s.sub;
        }
    }
}

/**
 * Ramos paralelos (desvio AND) ficam em sequência: o fim de cada ramo segue
 * para o começo do próximo e o último segue para depois da junção. Cada fase
 * ganha a anotação de com quem corria em paralelo.
 */
function sequenciarParalelos(nos, arestas, avisos) {
    const porChave = new Map(nos.map((n) => [n.chave, n]));
    const saem = (k) => arestas.filter((a) => a.de === k);
    const entram = (k) => arestas.filter((a) => a.para === k).length;
    for (const p of nos.filter((n) => n.paralelo && saem(n.chave).length > 1)) {
        // Junções contadas antes de mexer nas setas deste desvio.
        const juncoes = new Set(nos.filter((n) => n.paralelo && entram(n.chave) > 1).map((n) => n.chave));
        const ehJuncao = (k) => juncoes.has(k);
        const ramos = saem(p.chave);
        const percorrer = (inicio) => {
            const vistos = new Set();
            const fila = [inicio];
            while (fila.length && vistos.size < 500) {
                const k = fila.shift();
                if (vistos.has(k) || k === p.chave || ehJuncao(k)) continue;
                vistos.add(k);
                fila.push(...saem(k).map((a) => a.para));
            }
            return vistos;
        };
        const membros = ramos.map((r) => percorrer(r.para));
        const nomesRamo = membros.map((m) => [...m].map((k) => porChave.get(k)).filter((n) => n?.tipo === 'atividade' && n.nome).map((n) => n.nome));
        membros.forEach((m, i) => {
            const outros = nomesRamo.filter((_x, j) => j !== i).flat();
            for (const k of m) {
                const n = porChave.get(k);
                if (n?.tipo === 'atividade' && outros.length) n.paraleloCom = unicos([...(n.paraleloCom || []), ...outros]);
            }
        });
        for (let i = 0; i < ramos.length - 1; i++) {
            const proximo = ramos[i + 1].para;
            // Saídas do ramo i que vão para a junção (ou para um fim) passam a ir para o ramo seguinte.
            for (const a of arestas) {
                if (!membros[i].has(a.de) || membros[i].has(a.para)) continue;
                if (ehJuncao(a.para) || porChave.get(a.para)?.tipo === 'fim') a.para = proximo;
            }
        }
        for (const r of ramos.slice(1)) arestas.splice(arestas.indexOf(r), 1);
        if (nomesRamo.flat().length > 1) avisos.push(`Etapas paralelas no arquivo (${nomesRamo.map((n) => n.join(', ')).filter(Boolean).join(' | ')}) ficaram em sequência, porque o processo anda uma fase por vez. Confira a ordem.`);
    }
}

/** Nomes que dizem a mesma coisa: iguais sem acento/caixa, ou um contém o outro (5+ letras). */
function casa(a, b) {
    const x = sem(a);
    const y = sem(b);
    if (!x || !y) return false;
    return x === y || (Math.min(x.length, y.length) >= 5 && (x.includes(y) || y.includes(x)));
}

/**
 * Junta um ou mais modelos (BPMN/XPDL, páginas de um pacote) numa proposta.
 * Processos que nenhum outro chama são os principais. Quando há vários, eles
 * são unidos onde um termina e o outro começa, nesta ordem de confiança:
 * 1. atividade com o nome de outro diagrama abre esse diagrama no lugar dela;
 * 2. evento de ligação (ou fim) com o mesmo nome de um evento sem entrada
 *    (ou início) de outro ponto: a seta continua ali;
 * 3. fim com o nome de outro diagrama (ou da piscina dele) segue para o início dele;
 * 4. mensagem entre piscinas;
 * 5. sem nada disso, o fim principal (o mais distante do início) de um
 *    diagrama segue para o início do seguinte, e os outros fins encerram.
 */
export function propostaDeModelos(modelos) {
    const nos = [];
    const arestas = [];
    const containers = [];
    const avisos = [];
    for (const m of modelos) { nos.push(...m.nos); arestas.push(...m.arestas); containers.push(...m.containers); avisos.push(...m.avisos); }
    if (modelos.length > 1) avisos.splice(0, avisos.length, ...avisos.filter((a) => !/^Não parece/.test(a)));
    const comAtividade = new Set(nos.filter((n) => n.tipo === 'atividade').map((n) => n.container));
    const generico = (s) => /^(processo|process|proceso|diagrama|diagram)\s*\d*$/i.test(String(s || '').trim());
    const nomeDe = (id) => {
        const c = containers.find((x) => x.id === id) || {};
        return (c.piscina && (!c.nome || generico(c.nome)) ? c.piscina : c.nome || c.piscina) || 'diagrama sem nome';
    };
    const nomesDe = (id) => containers.filter((c) => c.id === id).flatMap((c) => [c.nome, c.piscina]).filter((s) => s && !generico(s));
    // 1. Atividade que leva o nome de outro diagrama é a chamada dele.
    for (const n of nos) {
        if (n.tipo !== 'atividade' || n.sub || !n.nome) continue;
        const alvo = containers.find((c) => c.id !== n.container && comAtividade.has(c.id) && nomesDe(c.id).some((x) => sem(x) === sem(n.nome)));
        if (alvo && !nos.some((x) => x.sub === alvo.id)) n.sub = alvo.id;
    }
    const chamados = new Set(nos.map((n) => n.sub).filter(Boolean));
    const raizes = unicos(containers.map((c) => c.id)).filter((id) => !chamados.has(id) && comAtividade.has(id));
    // Diagrama principal de cada container (os subprocessos pertencem a quem os chama).
    const raizDe = new Map(raizes.map((id) => [id, id]));
    for (let mudou = true, volta = 0; mudou && volta < 10; volta++) {
        mudou = false;
        for (const n of nos) if (n.sub && raizDe.has(n.container) && !raizDe.has(n.sub)) { raizDe.set(n.sub, raizDe.get(n.container)); mudou = true; }
    }
    abrirSubprocessos(nos, arestas, avisos);
    const porChave = new Map(nos.map((n) => [n.chave, n]));
    const raizDoNo = (k) => raizDe.get(porChave.get(k)?.container);
    const temSaida = (k) => arestas.some((a) => a.de === k && porChave.has(a.para));
    const temEntrada = (k) => arestas.some((a) => a.para === k && porChave.has(a.de));
    const entrada = (id) => arestas.some((a) => raizDoNo(a.para) === id && raizDoNo(a.de) && raizDoNo(a.de) !== id);
    const iniciosDe = (id) => {
        const ini = nos.filter((n) => n.container === id && n.tipo === 'inicio');
        return ini.length ? ini : nos.filter((n) => n.container === id && n.tipo === 'atividade' && !temEntrada(n.chave));
    };
    const ligar = (de, para) => {
        arestas.push({ de: de.chave, para: para.chave });
        if (de.tipo === 'fim') de.tipo = 'passa';
        if (para.tipo === 'inicio') para.tipo = 'passa';
    };
    // 2. Eventos de mesmo nome: quem não tem saída continua em quem não tem entrada.
    for (const de of nos.filter((n) => n.nome && (n.tipo === 'fim' || (n.tipo === 'passa' && !n.paralelo)))) {
        if (temSaida(de.chave)) continue;
        const para = nos.find((n) => n !== de && sem(n.nome) === sem(de.nome) && !temEntrada(n.chave)
            && ((n.tipo === 'passa' && !n.paralelo) || (n.tipo === 'inicio' && raizDoNo(n.chave) !== raizDoNo(de.chave))));
        if (!para || (de.tipo === 'fim' && raizDoNo(para.chave) === raizDoNo(de.chave))) continue;
        const [a, b] = [raizDoNo(de.chave), raizDoNo(para.chave)];
        ligar(de, para);
        if (a && b && a !== b) avisos.push(`Diagramas unidos pelo evento "${de.nome}": "${nomeDe(a)}" continua em "${nomeDe(b)}".`);
    }
    // 3. Fim com o nome de outro diagrama segue para o início dele.
    for (const fim of nos.filter((n) => n.tipo === 'fim' && n.nome)) {
        const alvo = raizes.find((id) => id !== raizDoNo(fim.chave) && nomesDe(id).some((x) => casa(x, fim.nome)));
        const inicios = alvo ? iniciosDe(alvo) : [];
        if (!inicios.length) continue;
        avisos.push(`Diagramas unidos: o fim "${fim.nome}" de "${nomeDe(raizDoNo(fim.chave))}" continua em "${nomeDe(alvo)}".`);
        for (const i of inicios) ligar(fim, i);
    }
    // 5. Diagramas principais que ninguém alcança: o anterior termina onde ele começa.
    const primeiro = raizes.find((id) => !entrada(id)) || raizes[0];
    const sequencia = [primeiro, ...raizes.filter((id) => id !== primeiro)];
    sequencia.forEach((id, k) => {
        if (k === 0 || entrada(id)) return;
        const inicios = iniciosDe(id);
        // O diagrama anterior mais próximo que ainda tem um fim livre.
        let fins = [];
        let anterior = null;
        for (let j = k - 1; j >= 0 && !fins.length; j--) { anterior = sequencia[j]; fins = nos.filter((n) => n.tipo === 'fim' && raizDoNo(n.chave) === anterior); }
        if (!inicios.length || !fins.length) return;
        let principal = fins[0];
        if (fins.length > 1) {
            // Fim principal: o mais distante do começo do diagrama (os outros costumam ser saídas antecipadas).
            const dist = new Map();
            const fila = nos.filter((n) => raizDoNo(n.chave) === anterior && !arestas.some((a) => a.para === n.chave && raizDoNo(a.de) === anterior)).map((n) => n.chave);
            fila.forEach((c) => dist.set(c, 0));
            while (fila.length) {
                const c = fila.shift();
                for (const a of arestas) if (a.de === c && !dist.has(a.para) && raizDoNo(a.para) === anterior) { dist.set(a.para, dist.get(c) + 1); fila.push(a.para); }
            }
            for (const f of fins) if ((dist.get(f.chave) ?? -1) >= (dist.get(principal.chave) ?? -1)) principal = f;
            avisos.push(`"${nomeDe(anterior)}" tem ${fins.length} fins: o principal${principal.nome ? ` ("${principal.nome}")` : ''} foi ligado ao início de "${nomeDe(id)}" e os outros encerram o processo. Confira na revisão.`);
        } else avisos.push(`Diagramas unidos: "${nomeDe(id)}" começa onde "${nomeDe(anterior)}" termina.`);
        for (const i of inicios) ligar(principal, i);
    });
    // Só o primeiro diagrama começa o rito.
    for (const n of nos) if (n.tipo === 'inicio' && raizDoNo(n.chave) && raizDoNo(n.chave) !== primeiro) n.tipo = 'passa';
    sequenciarParalelos(nos, arestas, avisos);
    for (const n of nos) {
        const notas = [n.etapaDe ? `Parte do subprocesso "${n.etapaDe}".` : '', n.paraleloCom?.length ? `No diagrama, corre em paralelo com: ${n.paraleloCom.join(', ')}.` : ''].filter(Boolean);
        if (notas.length) n.orientacao = [...notas, n.orientacao].filter(Boolean).join(' ').slice(0, 2000);
    }
    return propostaDeGrafo(nos, arestas, avisos);
}

/** BPMN 2.0 (XML): tarefas viram fases, raias (lanes) e piscinas viram unidades. */
export function propostaDeBpmn(xml) {
    return propostaDeModelos([modeloDeBpmn(xml)]);
}

/** XPDL (Bizagi e outros). */
export function propostaDeXpdl(xml) {
    return propostaDeModelos([modeloDeXpdl(xml)]);
}

/** Vários diagramas (as páginas de um pacote do Bizagi): BPMN ou XPDL, juntos. */
export function propostaDeDiagramas(lista) {
    const modelos = (lista || []).map(({ xml }) => (/<(\w+:)?definitions\b/.test(xml) ? modeloDeBpmn(xml) : modeloDeXpdl(xml)));
    if (!modelos.length) return { fases: [], avisos: ['Nenhum diagrama no arquivo'] };
    const r = propostaDeModelos(modelos);
    if (lista.length > 1) r.avisos.unshift(`Lidas ${lista.length} páginas do diagrama.`);
    return r;
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
    // Níveis: a linha é etapa de outra fase (que vira grupo) ou abre a aba de mesmo nome.
    pai: ['fase pai', 'fase principal', 'etapa principal', 'macroetapa', 'macrofase', 'macroprocesso', 'parte de', 'subprocesso de', 'pertence a', 'grupo'],
    sub: ['subprocesso', 'sub-processo', 'detalhamento', 'detalhado em', 'ver aba'],
    paralela: ['paralela', 'paralelo', 'em paralelo', 'paralela com', 'paralelo com', 'simultanea', 'simultanea com', 'concomitante', 'concomitante com'],
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

/** Fases brutas de uma aba (com as saídas ainda em texto), ou null se a aba não tem cabeçalho de fases. */
function fasesDaAba(linhas, aceitarSemCabecalho) {
    const rows = (linhas || []).map((r) => (r || []).map((c) => String(c ?? '').trim())).filter((r) => r.some(Boolean));
    if (!rows.length) return null;
    // O cabeçalho pode estar abaixo de um título: vale a primeira das 5 linhas com a coluna da fase.
    const iCab = rows.slice(0, 5).findIndex((r) => r.map(sem).some((c) => COLUNAS.nome.includes(c)));
    const temCab = iCab >= 0;
    if (!temCab && !aceitarSemCabecalho) return null;
    const cab = temCab ? rows[iCab].map(sem) : [];
    const idx = Object.fromEntries(Object.entries(COLUNAS).map(([k, nomes]) => [k, cab.findIndex((c) => nomes.includes(c))]));
    const col = temCab ? idx : { nome: 0, prazo: 1, proximas: 2, orientacao: 3 };
    const cel = (r, k) => (col[k] >= 0 ? r[col[k]] || '' : '');
    const fases = [];
    let atual = null;
    for (const r of temCab ? rows.slice(iCab + 1) : rows) {
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
        if (cel(r, 'pai') && !atual._pai) atual._pai = cel(r, 'pai');
        if (cel(r, 'sub') && !atual._sub) atual._sub = cel(r, 'sub');
        const par = cel(r, 'paralela');
        if (par && !/^(nao|n|nenhuma|-)$/.test(sem(par))) atual._paralela = /^(sim|s|x)$/.test(sem(par)) ? 'sim' : par;
        atual.acoes.push(...lista(cel(r, 'acoes')));
        atual.modelos.push(...lista(cel(r, 'modelos')).flatMap((m) => m.split(/\s*,\s*/)));
        if (cel(r, 'orientacao')) atual._orient.push(cel(r, 'orientacao'));
        const refs = cel(r, 'proximas').split(/[;\n/]|,(?![^(]*\))|\s+e\s+|\s+ou\s+/).map((s) => s.trim()).filter(Boolean);
        const conds = lista(cel(r, 'condicao'));
        refs.forEach((ref, i) => atual._saidas.push({ ref, condicao: conds[i] || (refs.length === 1 ? conds.join(' ') : '') }));
    }
    return fases;
}

/** Planilha de uma aba só (matriz de células). Ver `propostaDeAbas`. */
export function propostaDeTabela(linhas) {
    return propostaDeAbas([{ nome: '', linhas }]);
}

/**
 * Planilha (uma ou várias abas, ou as várias tabelas de um Word). Cabeçalho
 * com qualquer das colunas de COLUNAS, em qualquer ordem (até a 5ª linha).
 * Várias linhas da mesma fase (ou com a célula da fase vazia) somam ações,
 * modelos e saídas. Sem cabeçalho reconhecido, só numa aba única, a ordem é
 * Fase | Prazo | Próximas | Orientação.
 *
 * Com várias abas, todas são lidas:
 * - aba com o nome de uma fase de outra aba (ou citada na coluna
 *   "Subprocesso") detalha essa fase: as etapas dela entram no lugar da fase;
 * - a coluna "Fase principal"/"Macroetapa" faz o mesmo dentro da aba;
 * - "Segue para" pode citar fase de qualquer aba, ou o nome de uma aba;
 * - abas principais sem ligação entre si ficam em sequência, na ordem;
 * - a coluna "Paralela" vira anotação (o processo anda uma fase por vez).
 */
export function propostaDeAbas(abas) {
    const avisos = [];
    const lidas = [];
    const validas = (abas || []).filter((a) => (a.linhas || []).some((r) => (r || []).some((c) => String(c ?? '').trim())));
    for (const aba of validas) {
        const fases = fasesDaAba(aba.linhas, validas.length === 1);
        if (fases?.length) lidas.push({ nome: String(aba.nome || ''), fases });
    }
    if (!lidas.length) return { fases: [], avisos: [validas.length ? 'Nenhuma aba com fases. A primeira linha precisa ter os títulos das colunas (Fase, Unidade, Responsável, Prazo, Ações, Documentos, Segue para, Condição).' : 'A planilha está vazia'] };
    const todas = lidas.flatMap((a) => a.fases.map((f) => Object.assign(f, { _aba: a })));
    const porNome = new Map();
    for (const f of todas) if (!porNome.has(sem(f.nome))) porNome.set(sem(f.nome), f);
    const abaPorNome = new Map(lidas.map((a) => [sem(a.nome), a]));
    // Níveis: filhos de cada fase (coluna "Fase principal" e abas de detalhamento).
    const filhos = new Map();
    const grupos = new Map(); // fase -> nome do grupo que não é fase (só anotação)
    const abasUsadas = new Set();
    for (const f of todas) {
        if (!f._pai) continue;
        const pai = porNome.get(sem(f._pai));
        if (pai && pai !== f) { if (!filhos.has(pai)) filhos.set(pai, []); filhos.get(pai).push(f); f._temPai = true; } else grupos.set(f, f._pai);
    }
    for (const f of todas) {
        const aba = abaPorNome.get(sem(f._sub || '')) || (lidas.length > 1 ? lidas.find((a) => a !== f._aba && sem(a.nome) === sem(f.nome)) : null);
        if (!aba || aba === f._aba || abasUsadas.has(aba)) continue;
        abasUsadas.add(aba);
        const etapas = aba.fases.filter((x) => !x._temPai && x !== f);
        if (!filhos.has(f)) filhos.set(f, []);
        for (const x of etapas) { filhos.get(f).push(x); x._temPai = true; }
    }
    const principais = lidas.filter((a) => !abasUsadas.has(a));
    // Ordem final: cada grupo é trocado pelas etapas dele, recursivamente.
    const fases = [];
    const vistos = new Set();
    const caminho = new Map(); // fase folha -> nomes dos grupos acima
    const emitir = (f, acima) => {
        if (vistos.has(f)) return;
        vistos.add(f);
        if (filhos.has(f)) { for (const c of filhos.get(f)) emitir(c, [...acima, f]); return; }
        if (acima.length) caminho.set(f, acima);
        fases.push(f);
    };
    for (const a of lidas) for (const f of a.fases) if (!f._temPai) emitir(f, []);
    for (const f of todas) if (!vistos.has(f)) emitir(f, []); // ciclo de "fase principal": entra solto
    const primeira = (f) => (filhos.has(f) && filhos.get(f).length ? primeira(filhos.get(f)[0]) : f);
    const ultima = (f) => (filhos.has(f) && filhos.get(f).length ? ultima(filhos.get(f)[filhos.get(f).length - 1]) : f);
    // As saídas do grupo passam para a última etapa dele (se ela não tem as suas).
    for (const g of filhos.keys()) {
        const u = ultima(g);
        if (u !== g && !u._saidas.length && !u.final) u._saidas.push(...g._saidas);
        for (const c of fases) if (caminho.get(c)?.includes(g)) {
            if (!c.unidade && g.unidade) c.unidade = g.unidade;
            if (!c.agente && g.agente) c.agente = g.agente;
        }
    }
    const nomes = new Set([...porNome.keys()]);
    const idDe = (f) => primeira(f).id;
    for (const f of fases) {
        const proximas = [];
        const condicoes = {};
        for (const s of f._saidas) {
            if (/^(fim|final|encerra(mento)?|encerrar|-)$/.test(sem(s.ref))) { if (!f._saidas.some((x) => x !== s && porNome.has(sem(refComCondicao(x.ref, nomes).alvo)))) f.final = true; continue; }
            const n = Number(s.ref);
            const { alvo, condicao } = refComCondicao(s.ref, nomes);
            const daAba = f._aba.fases;
            const destino = Number.isInteger(n) && daAba[n - 1] ? daAba[n - 1] : porNome.get(sem(alvo)) || abaPorNome.get(sem(alvo))?.fases[0];
            if (!destino) { avisos.push(`"${f.nome}" segue para "${s.ref}", que não está na planilha`); continue; }
            const id = idDe(destino);
            if (id === f.id) continue;
            if (!proximas.includes(id)) proximas.push(id);
            const c = s.condicao || condicao;
            if (c) condicoes[id] = c.slice(0, 80);
        }
        f.proximas = proximas;
        if (Object.keys(condicoes).length) f.condicoes = condicoes;
        const notas = [];
        if (caminho.has(f)) notas.push(`Parte de "${caminho.get(f).map((g) => g.nome).join(' › ')}".`);
        if (grupos.has(f)) notas.push(`Etapa: ${grupos.get(f)}.`);
        if (f._paralela) notas.push(f._paralela === 'sim' ? 'Pode correr em paralelo com outras etapas.' : `Corre em paralelo com: ${f._paralela}.`);
        const orient = [...notas, ...unicos(f._orient)];
        if (orient.length) f.orientacao = orient.join('\n').slice(0, 2000);
        f.acoes = unicos(f.acoes);
        f.modelos = unicos(f.modelos);
        if (!f.acoes.length) delete f.acoes;
        if (!f.modelos.length) delete f.modelos;
        for (const k of ['_saidas', '_orient', '_aba', '_pai', '_sub', '_paralela', '_temPai']) delete f[k];
    }
    if (lidas.length > 1) {
        avisos.unshift(`Lidas ${lidas.length} abas: ${lidas.map((a) => a.nome || 'sem nome').join(', ')}.`);
        if (principais.length > 1) avisos.push(`As abas ${principais.map((a) => `"${a.nome}"`).join(', ')} ficaram em sequência, nessa ordem. Confira se é isso.`);
    }
    if (fases.some((f) => /em paralelo/.test(f.orientacao || ''))) avisos.push('Etapas marcadas como paralelas ficaram em sequência, porque o processo anda uma fase por vez. A anotação fica na orientação da fase.');
    return { fases: simplificar(fases), avisos };
}

// ---- Texto corrido -------------------------------------------------------------

const CABECALHO_FASE = [
    /^(?:#{1,4}\s*)?(?:fase|etapa|passo)\s*(?:n[ºo°.]?\s*)?(\d{1,2}|[ivxl]{1,5})?\s*[-–—:.)]?\s*(.+)$/i,
    // "1. Nome", "1) Nome" e "1.Nome" (o PDF às vezes perde o espaço); "1.1 Nome" não é fase.
    /^(?:#{1,4}\s*)?(\d{1,2})\s*[.)–—-]\s*(?=[A-Za-zÀ-ÿ"“(])(.{2,120})$/,
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
    if (/<(\w+:)?(Package|WorkflowProcesses)\b/.test(t) || ext === 'xpdl') return { ...propostaDeXpdl(t), origem: 'XPDL' };
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

/** Rito gravado (ou modelo pronto) no formato da tela: unidade e modelos por referência. */
export function deRito(r) {
    return {
        ...(r.id ? { id: r.id, versao: r.versao, ativo: r.ativo !== false } : {}),
        nome: r.nome || '', descricao: r.descricao || '',
        fases: (r.fases || []).map(({ unidade_id: un, modelos: ms, ...f }) => ({ ...f, unidade_ref: un || null, modelos_ref: ms || [] })),
        unidades: [], modelos: [],
    };
}

/** Só vai o que as fases usam; refs "+N" viram ids no servidor. */
export function montarPayload(p, tipo) {
    const usadosUn = new Set(p.fases.map((f) => f.unidade_ref).filter(Boolean));
    const usadosMod = new Set(p.fases.flatMap((f) => f.modelos_ref || []));
    const modelos = p.modelos.filter((m) => usadosMod.has(m.ref));
    modelos.forEach((m) => m.unidade_ref && usadosUn.add(m.unidade_ref));
    return {
        rito: {
            nome: p.nome, descricao: p.descricao,
            fases: p.fases.map((f) => ({
                id: f.id, nome: f.nome, prazo_dias: f.prazo_dias, orientacao: f.orientacao, final: f.final === true,
                proximas: f.final ? [] : (f.proximas || []).filter((id) => id !== f.id && p.fases.some((x) => x.id === id)),
                condicoes: f.condicoes, agente: f.agente, acoes: f.acoes, acoes_regras: f.acoes_regras,
                registro_atos: f.registro_atos, registro: f.registro, documentos: f.documentos, certidao: f.certidao,
                unidade_ref: f.unidade_ref, modelos_ref: f.modelos_ref,
            })),
        },
        ...(p.id ? { rito_id: p.id, ativo: p.ativo !== false } : {}),
        unidades: p.unidades.filter((u) => usadosUn.has(u.ref)),
        modelos,
        tipo_processo: tipo.criar && (tipo.nome || p.nome || '').trim() ? { nome: (tipo.nome || p.nome).trim(), sigla: tipo.sigla.trim() } : null,
    };
}
