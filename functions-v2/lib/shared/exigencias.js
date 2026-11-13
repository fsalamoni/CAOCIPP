"use strict";
// ============================================================================
// O que o rito diz sobre cada ato: onde fica registrado (autos, extrato do
// PDF ou só nas informações do processo), o que cada ação da fase pede (só
// confirmar, um dado ou um documento) e quem vê. Lógica pura, testada em
// test/exigencias.test.js; o cliente tem o espelho em src/lib/exigencias.js
// (só para a tela; quem decide é o servidor).
// Fundamento: docs/LOGICA_PROCESSUAL.md, seções 5 e 6.
// ============================================================================
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.visivelCertidao = exports.cabeNaCertidao = exports.textoDoItem = exports.mudancaNaCertidao = exports.grupoDe = exports.MAX_ITEM_CERTIDAO = exports.MAX_TEXTO_CERTIDAO = exports.movimentoInterno = exports.documentosQueFaltam = exports.marcasNaFase = exports.partesVeem = exports.pedidoDaAcao = exports.MAX_DOCUMENTOS_FASE = exports.MAX_OPCOES_ACAO = exports.PEDIDOS = exports.NIVEIS = exports.FORMAS = exports.PADRAO_OUTRO = exports.OUTROS_ATOS = exports.REGISTROS = exports.destinoTransicao = exports.maisReservado = exports.DESTINOS_ACAO = exports.DESTINOS_ATO = exports.DESTINOS = void 0;
exports.destinoDaAcao = destinoDaAcao;
exports.niveisDaFase = niveisDaFase;
exports.sanitizeExigencia = sanitizeExigencia;
exports.destinoDoAto = destinoDoAto;
exports.marcasDoAto = marcasDoAto;
exports.sanitizeRegras = sanitizeRegras;
exports.exigenciasDaFase = exigenciasDaFase;
exports.pendentesDaFase = pendentesDaFase;
exports.acoesObrigatoriasPendentes = acoesObrigatoriasPendentes;
exports.atende = atende;
exports.reconhecer = reconhecer;
exports.camposDoCumprimento = camposDoCumprimento;
exports.camposAoEntrarNaFase = camposAoEntrarNaFase;
exports.destinoDoMovimento = destinoDoMovimento;
exports.tituloCertidao = tituloCertidao;
exports.deveEmitir = deveEmitir;
exports.textoCertidao = textoCertidao;
exports.marcasDoDestino = marcasDoDestino;
const modulos_1 = require("./modulos");
// Sem importar ./secretaria (que importa este módulo): o mesmo corte de texto.
const MAX_TEXTO_CURTO = 200;
const texto = (v, max = MAX_TEXTO_CURTO) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
/**
 * Onde um ato fica registrado:
 * - 'autos': termo ou certidão com folha; sai na impressão dos autos;
 * - 'evento': registro interno, sem folha, listado no extrato ao fim do PDF;
 * - 'informacao': só no sistema (aba Eventos e informações do processo); não sai em impressão nenhuma;
 * - 'nenhum' (só ações e atos da fase, nunca documento): sem evento. Fica um
 *   registro oculto, para a cadeia de eventos e a auditoria; ninguém o vê por
 *   padrão, não conta como último andamento e as partes nunca o veem.
 */
exports.DESTINOS = ['autos', 'evento', 'informacao'];
exports.DESTINOS_ATO = [...exports.DESTINOS, 'nenhum'];
/**
 * Ação da fase aceita também 'consolidar': entra na certidão conjunta da fase
 * (ou do grupo de fases), emitida uma vez, com folha, quando o processo sai
 * do grupo, é arquivado ou alguém pede "Emitir certidão agora".
 */
exports.DESTINOS_ACAO = [...exports.DESTINOS_ATO, 'consolidar'];
/** Valor desconhecido (cópia antiga do rito, dado mexido) vira o padrão. */
const lido = (v, lista, padrao) => (lista.includes(v) ? v : padrao);
const destino = (v, padrao) => lido(v, exports.DESTINOS, padrao);
const ORDEM = { autos: 2, evento: 1, informacao: 0, nenhum: -1 };
/** O mais reservado dos dois (ex.: sair de fase nos autos para fase só no sistema = só no sistema). */
const maisReservado = (a, b) => (ORDEM[a] <= ORDEM[b] ? a : b);
exports.maisReservado = maisReservado;
/**
 * Destino da mudança entre duas fases. "Sem evento" numa só delas não apaga o
 * registro que a outra pede: vale a outra. Sem evento só quando as duas dizem.
 */
const destinoTransicao = (a, b) => (a === 'nenhum' ? b : b === 'nenhum' ? a : (0, exports.maisReservado)(a, b));
exports.destinoTransicao = destinoTransicao;
/** Formato antigo do registro da fase (ainda lido em processos autuados antes). */
exports.REGISTROS = ['remessas_fora', 'interno'];
/**
 * Outros atos durante a fase cujo registro o rito escolhe. `prazo` vale para
 * abrir e encerrar; `pendencia`, para abrir e apreciar. O padrão é como era
 * antes: termo nos autos, e atribuição como registro de controle no extrato.
 * Ficam sempre nos autos: autuação, juntada, petição, comunicação e ciência,
 * situação (arquivar pode levar dispensa), exclusão e restauração.
 */
exports.OUTROS_ATOS = ['prazo', 'pendencia', 'urgencia', 'dados', 'atribuicao'];
exports.PADRAO_OUTRO = { prazo: 'autos', pendencia: 'autos', urgencia: 'autos', dados: 'autos', atribuicao: 'evento' };
/** Atribuição é sempre registro de controle: não vira termo nos autos. */
const opcoesDoAto = (a) => (a === 'atribuicao' ? ['evento', 'informacao', 'nenhum'] : exports.DESTINOS_ATO);
exports.FORMAS = ['redigir', 'juntar', 'qualquer'];
exports.NIVEIS = ['recomendado', 'opcional'];
/** O que a ação pede a quem a cumpre. */
exports.PEDIDOS = ['confirmar', 'texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao', 'registro', 'documento'];
exports.MAX_OPCOES_ACAO = 30;
exports.MAX_DOCUMENTOS_FASE = 5;
/** Onde fica o cumprimento da ação. */
function destinoDaAcao(r) {
    if (r === null || r === void 0 ? void 0 : r.documento)
        return destino(r.documento.destino, 'autos');
    if (r === null || r === void 0 ? void 0 : r.destino)
        return lido(r.destino, exports.DESTINOS_ACAO, 'evento');
    return (r === null || r === void 0 ? void 0 : r.autos) ? 'autos' : 'evento';
}
/** O que a ação pede. */
const pedidoDaAcao = (r) => ((r === null || r === void 0 ? void 0 : r.documento) ? 'documento' : (r === null || r === void 0 ? void 0 : r.pede) || 'confirmar');
exports.pedidoDaAcao = pedidoDaAcao;
/** As partes veem? Regra antiga com certidão nos autos: sim (era assim). */
/** As partes veem? Ação de só confirmar fora dos autos não tem o que mostrar (nem certidão, nem dado). */
const partesVeem = (r) => destinoDaAcao(r) !== 'nenhum'
    && ((r === null || r === void 0 ? void 0 : r.partes) === true || ((r === null || r === void 0 ? void 0 : r.partes) === undefined && (r === null || r === void 0 ? void 0 : r.autos) === true))
    // Certidão (própria ou conjunta) mostra até a confirmação simples.
    && ((0, exports.pedidoDaAcao)(r) !== 'confirmar' || ['autos', 'consolidar'].includes(destinoDaAcao(r)));
exports.partesVeem = partesVeem;
/** Entrada/saída e remessas da fase: onde ficam (lê também o formato antigo). */
function niveisDaFase(f) {
    if (!f)
        return { fase: 'autos', remessas: 'autos' };
    if (f.registro_atos)
        return { fase: lido(f.registro_atos.fase, exports.DESTINOS_ATO, 'autos'), remessas: lido(f.registro_atos.remessas, exports.DESTINOS_ATO, 'autos') };
    if (f.registro === 'interno')
        return { fase: 'evento', remessas: 'evento' };
    if (f.registro === 'remessas_fora')
        return { fase: 'autos', remessas: 'evento' };
    return { fase: 'autos', remessas: 'autos' };
}
function sanitizeExigencia(raw, descricaoPadrao = '') {
    if (!raw || typeof raw !== 'object')
        return null;
    const o = raw;
    const descricao = texto(o.descricao, MAX_TEXTO_CURTO) || descricaoPadrao;
    if (!descricao)
        return null;
    const forma = exports.FORMAS.includes(o.forma) ? o.forma : 'qualquer';
    const tipo = texto(o.tipo, 60);
    const modelo = texto(o.modelo_id, 40);
    const dest = destino(o.destino, 'autos');
    const nivel = exports.NIVEIS.includes(o.nivel) ? o.nivel : null;
    return Object.assign(Object.assign(Object.assign(Object.assign({ descricao, forma }, (tipo ? { tipo } : {})), (modelo ? { modelo_id: modelo } : {})), (dest !== 'autos' ? { destino: dest } : {})), (nivel ? { nivel } : {}));
}
function sanitizeRegra(raw, acao) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const pedeBruto = exports.PEDIDOS.includes(r.pede) ? r.pede : (r.documento ? 'documento' : 'confirmar');
    // Orientação a quem cumpre: vale para qualquer ação.
    const ajuda = texto(r.ajuda, 200);
    if (pedeBruto === 'documento') {
        const documento = sanitizeExigencia(r.documento || {}, acao);
        if (!documento)
            return null;
        documento.descricao = acao;
        return Object.assign({ documento }, (ajuda ? { ajuda } : {}));
    }
    const out = {};
    if (ajuda)
        out.ajuda = ajuda;
    if (pedeBruto !== 'confirmar') {
        out.pede = pedeBruto;
        const rotulo = texto(r.rotulo, 80);
        if (rotulo && rotulo !== acao)
            out.rotulo = rotulo;
        if (pedeBruto === 'lista') {
            const opcoes = [...new Set((Array.isArray(r.opcoes) ? r.opcoes : []).map((s) => texto(s, 80)).filter(Boolean))].slice(0, exports.MAX_OPCOES_ACAO);
            if (opcoes.length < 2)
                throw new Error(`A ação "${acao}" pede uma escolha: informe ao menos duas opções`);
            out.opcoes = opcoes;
        }
        if (pedeBruto === 'registro') {
            if (!modulos_1.MODULOS.includes(r.modulo))
                throw new Error(`A ação "${acao}" pede um registro: escolha de que módulo`);
            out.modulo = r.modulo;
        }
    }
    const dest = lido(r.destino, exports.DESTINOS_ACAO, r.autos === true ? 'autos' : 'evento');
    if (dest !== 'evento')
        out.destino = dest;
    // Sem evento não aparece para ninguém: nem para as partes.
    const partes = dest !== 'nenhum' && (r.partes === true || (r.partes === undefined && r.autos === true));
    if (partes)
        out.partes = true;
    if (r.obrigatoria === true)
        out.obrigatoria = true;
    else if (r.recomendada === true)
        out.recomendada = true;
    return Object.keys(out).length ? out : null;
}
/** Onde fica o ato durante a fase (valor estranho lê como o padrão). */
function destinoDoAto(f, ato) {
    var _a, _b;
    return lido((_b = (_a = f === null || f === void 0 ? void 0 : f.registro_atos) === null || _a === void 0 ? void 0 : _a.outros) === null || _b === void 0 ? void 0 : _b[ato], opcoesDoAto(ato), exports.PADRAO_OUTRO[ato]);
}
/** Marcas do movimento para o ato; no padrão, nenhuma (fica como sempre foi). */
function marcasDoAto(f, ato) {
    const d = destinoDoAto(f, ato);
    return d === exports.PADRAO_OUTRO[ato] ? {} : marcasDoDestino(d);
}
/** Marcas do ato pelo que o rito diz na fase em que o processo está. */
const marcasNaFase = (proc, ato) => marcasDoAto((proc.fases || []).find((f) => f.id === proc.fase_atual), ato);
exports.marcasNaFase = marcasNaFase;
function sanitizeRegistroAtos(fo) {
    const ra = (fo.registro_atos && typeof fo.registro_atos === 'object' ? fo.registro_atos : null);
    const ob = ((ra === null || ra === void 0 ? void 0 : ra.outros) && typeof ra.outros === 'object' ? ra.outros : {});
    const outros = {};
    for (const a of exports.OUTROS_ATOS) {
        const d = lido(ob[a], opcoesDoAto(a), exports.PADRAO_OUTRO[a]);
        if (d !== exports.PADRAO_OUTRO[a])
            outros[a] = d;
    }
    const n = ra
        ? { fase: lido(ra.fase, exports.DESTINOS_ATO, 'autos'), remessas: lido(ra.remessas, exports.DESTINOS_ATO, 'autos') }
        : niveisDaFase({ id: '', registro: exports.REGISTROS.includes(fo.registro) ? fo.registro : undefined });
    const out = Object.assign(Object.assign(Object.assign({}, (n.fase !== 'autos' ? { fase: n.fase } : {})), (n.remessas !== 'autos' ? { remessas: n.remessas } : {})), (Object.keys(outros).length ? { outros } : {}));
    return Object.keys(out).length ? out : undefined;
}
/** Saneia registro, regras das ações (alinhadas às ações) e documentos da fase. Lança Error com mensagem para o usuário. */
function sanitizeRegras(fo, acoes) {
    const registroAtos = sanitizeRegistroAtos(fo);
    const brutas = Array.isArray(fo.acoes_regras) ? fo.acoes_regras : [];
    const regras = acoes.map((a, i) => sanitizeRegra(brutas[i], a));
    const documentos = (Array.isArray(fo.documentos) ? fo.documentos : [])
        .map((d) => sanitizeExigencia(d)).filter((d) => !!d).slice(0, exports.MAX_DOCUMENTOS_FASE);
    return Object.assign(Object.assign(Object.assign({}, (registroAtos ? { registro_atos: registroAtos } : {})), (regras.some(Boolean) ? { acoes_regras: regras } : {})), (documentos.length ? { documentos } : {}));
}
/** Exigências de documento da fase com a chave que o processo grava: 'd0' (da fase), 'a2' (da ação 2). */
function exigenciasDaFase(f) {
    if (!f)
        return [];
    return [
        ...(f.documentos || []).map((d, i) => (Object.assign(Object.assign({}, d), { chave: `d${i}` }))),
        ...(f.acoes_regras || []).flatMap((r, i) => { var _a; return ((r === null || r === void 0 ? void 0 : r.documento) && ((_a = f.acoes) === null || _a === void 0 ? void 0 : _a[i]) ? [Object.assign(Object.assign({}, r.documento), { chave: `a${i}`, acao_idx: i })] : []); }),
    ];
}
/** Documentos exigidos ainda não cumpridos na fase. */
function pendentesDaFase(f, cumpridas) {
    const feitas = (f && (cumpridas === null || cumpridas === void 0 ? void 0 : cumpridas[f.id])) || {};
    return exigenciasDaFase(f).filter((e) => !feitas[e.chave]);
}
/** Documentos obrigatórios ainda não cumpridos: os recomendados e opcionais não impedem a fase de seguir. */
const documentosQueFaltam = (f, cumpridas) => pendentesDaFase(f, cumpridas).filter((e) => !e.nivel);
exports.documentosQueFaltam = documentosQueFaltam;
/** Ações obrigatórias (sem documento) ainda não feitas na fase. */
function acoesObrigatoriasPendentes(f, feitas) {
    if (!f)
        return [];
    const ok = new Set(feitas || []);
    return (f.acoes || []).flatMap((a, i) => { var _a, _b, _c; return (((_b = (_a = f.acoes_regras) === null || _a === void 0 ? void 0 : _a[i]) === null || _b === void 0 ? void 0 : _b.obrigatoria) && !((_c = f.acoes_regras[i]) === null || _c === void 0 ? void 0 : _c.documento) && !ok.has(i) ? [{ descricao: a, acao_idx: i }] : []); });
}
/** Redigir = produzido pelo órgão (editor ou modelo); juntar = recebido de fora (arquivo ou petição da parte). */
function atende(e, d) {
    // Exigência para os autos só se cumpre com juntada; a de controle, só guardando fora dos autos.
    if (!!e.destino !== (d.controle === true))
        return false;
    const redigido = !d.peticao && (d.origem === 'editor' || !!d.modelo_id);
    if (e.forma === 'redigir' && !redigido)
        return false;
    if (e.forma === 'juntar' && redigido)
        return false;
    return true;
}
const igual = (a, b) => !!a && !!b && a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;
/**
 * Exigências pendentes que o documento cumpre. Com `escolhidas` (chaves que
 * quem junta marcou), valida cada uma; sem elas, reconhece pelo modelo usado
 * ou pelo tipo do documento. Lança Error com mensagem para o usuário.
 */
function reconhecer(pendentes, d, escolhidas) {
    if (Array.isArray(escolhidas)) {
        const chaves = [...new Set(escolhidas.map(String))];
        for (const k of chaves) {
            const e = pendentes.find((x) => x.chave === k);
            if (!e)
                throw new Error('Uma das exigências marcadas não está pendente nesta fase');
            if (!!e.destino !== (d.controle === true)) {
                throw new Error(e.destino ? `"${e.descricao}" pede documento guardado fora dos autos: use "Guardar fora dos autos"` : `"${e.descricao}" pede documento juntado aos autos`);
            }
            if (!atende(e, d))
                throw new Error(`"${e.descricao}" pede documento ${e.forma === 'redigir' ? 'redigido pelo órgão' : 'recebido de fora (arquivo enviado)'}`);
        }
        return chaves;
    }
    return pendentes
        .filter((e) => atende(e, d) && ((e.modelo_id && e.modelo_id === d.modelo_id) || igual(e.tipo, d.tipo)))
        .map((e) => e.chave);
}
/**
 * Campos do processo a gravar quando a juntada (ou a guarda fora dos autos)
 * cumpre exigências da fase: `exigencias_cumpridas` e, para as de ação, a
 * ação marcada em `acoes_feitas`.
 */
function camposDoCumprimento(proc, faseId, cumpridas, documentoId, ordem) {
    if (!cumpridas.length)
        return {};
    const todas = (proc.exigencias_cumpridas || {});
    const out = {
        exigencias_cumpridas: Object.assign(Object.assign({}, todas), { [faseId]: Object.assign(Object.assign({}, (todas[faseId] || {})), Object.fromEntries(cumpridas.map((e) => [e.chave, { documento_id: documentoId, ordem }]))) }),
    };
    const acoes = cumpridas.filter((e) => typeof e.acao_idx === 'number').map((e) => e.acao_idx);
    if (acoes.length) {
        const feitasTodas = (proc.acoes_feitas || {});
        out.acoes_feitas = Object.assign(Object.assign({}, feitasTodas), { [faseId]: [...new Set([...(feitasTodas[faseId] || []), ...acoes])].sort((a, b) => a - b) });
    }
    return out;
}
/** Ao entrar numa fase (inclusive voltando a ela), o que ela exige recomeça: a rodada anterior fica nos movimentos. */
function camposAoEntrarNaFase(proc, faseId) {
    const out = {};
    const ex = (proc.exigencias_cumpridas || {});
    const ac = (proc.acoes_feitas || {});
    if (faseId in ex) {
        const _a = ex, _b = faseId, _x = _a[_b], resto = __rest(_a, [typeof _b === "symbol" ? _b : _b + ""]);
        out.exigencias_cumpridas = resto;
    }
    if (faseId in ac) {
        const _c = ac, _d = faseId, _y = _c[_d], resto = __rest(_c, [typeof _d === "symbol" ? _d : _d + ""]);
        out.acoes_feitas = resto;
    }
    return out;
}
/**
 * Onde fica o ato de tramitação. Mudança de fase: o mais reservado entre a
 * fase de onde sai e a para onde vai. Remessa sem mudar de fase: o que a fase
 * atual diz das remessas.
 */
function destinoDoMovimento(fases, deId, paraId) {
    const de = niveisDaFase(fases.find((f) => f.id === deId));
    if (paraId && paraId !== deId)
        return (0, exports.destinoTransicao)(de.fase, niveisDaFase(fases.find((f) => f.id === paraId)).fase);
    return de.remessas;
}
/** O ato vai só para o registro interno (fora dos autos)? */
const movimentoInterno = (fases, deId, paraId) => destinoDoMovimento(fases, deId, paraId) !== 'autos';
exports.movimentoInterno = movimentoInterno;
// ============================================================================
// Certidão conjunta. Os atos marcados 'consolidar' (e, se a fase pedir, as
// mudanças de fase dentro do grupo) ficam como registro oculto e entram como
// itens em `proc.consolidacao`; ao sair do grupo, arquivar ou "Emitir
// certidão agora", vira UMA certidão nos autos, com folha.
// ============================================================================
/**
 * A certidão ocupa uma folha: o texto inteiro tem de caber numa página do
 * termo (exportar.ts: A4, corpo 11pt, cerca de 29 linhas livres). 1800
 * caracteres dão uns 24 linhas, com folga para título longo e palavras largas.
 * Passou disso, a pendente é emitida e outra começa.
 */
exports.MAX_TEXTO_CERTIDAO = 1800;
/** Item longo (dado de texto longo) entra resumido; a íntegra fica no registro do ato e nas informações. */
exports.MAX_ITEM_CERTIDAO = 300;
/** Grupo da certidão da fase: o configurado, ou a própria fase. */
const grupoDe = (f) => { var _a; return (f ? ((_a = f.certidao) === null || _a === void 0 ? void 0 : _a.grupo) || f.id : ''); };
exports.grupoDe = grupoDe;
/** Título da certidão do grupo: o que a primeira fase do grupo deu, ou o nome das fases. */
function tituloCertidao(fases, grupo) {
    var _a, _b, _c, _d;
    const membros = fases.filter((f) => (0, exports.grupoDe)(f) === grupo);
    // Vale o título da fase raiz; o de outra fase do grupo só se a raiz não deu.
    const dado = ((_b = (_a = membros.find((f) => f.id === grupo)) === null || _a === void 0 ? void 0 : _a.certidao) === null || _b === void 0 ? void 0 : _b.titulo) || ((_d = (_c = membros.find((f) => { var _a; return (_a = f.certidao) === null || _a === void 0 ? void 0 : _a.titulo; })) === null || _c === void 0 ? void 0 : _c.certidao) === null || _d === void 0 ? void 0 : _d.titulo);
    if (dado)
        return dado;
    const nomes = membros.map((f) => f.nome || f.id);
    return nomes.length > 1 ? `Certidão das fases ${nomes.join(', ')}` : `Certidão da fase ${nomes[0] || grupo}`;
}
/** Mudança de fase dentro do mesmo grupo vira item da certidão (em vez de termo próprio)? */
const mudancaNaCertidao = (fases, deId, paraId) => {
    var _a, _b;
    const de = fases.find((f) => f.id === deId);
    const para = fases.find((f) => f.id === paraId);
    return !!de && !!para && (0, exports.grupoDe)(de) === (0, exports.grupoDe)(para) && (((_a = de.certidao) === null || _a === void 0 ? void 0 : _a.incluir_mudancas) === true || ((_b = para.certidao) === null || _b === void 0 ? void 0 : _b.incluir_mudancas) === true);
};
exports.mudancaNaCertidao = mudancaNaCertidao;
/** Há certidão por emitir antes deste ato? `paraId` null = sai do fluxo (arquivar). */
function deveEmitir(fases, c, deId, paraId) {
    var _a;
    if (!((_a = c === null || c === void 0 ? void 0 : c.itens) === null || _a === void 0 ? void 0 : _a.length))
        return false;
    if (!paraId)
        return true;
    return (0, exports.grupoDe)(fases.find((f) => f.id === paraId)) !== c.grupo || (0, exports.grupoDe)(fases.find((f) => f.id === deId)) !== c.grupo;
}
const quando = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
/** Texto da certidão conjunta (o título vai no evento): um item por ato, com quem fez e quando. */
function textoCertidao(itens) {
    const linhas = itens.map((i, k) => `${k + 1}) ${i.texto}${i.autor ? ` (${i.autor}${i.em ? `, ${quando(i.em)}` : ''})` : ''}`);
    return `Certifico que foram cumpridos os seguintes atos: ${linhas.join('; ')}.`;
}
const textoDoItem = (t) => (t.length > exports.MAX_ITEM_CERTIDAO ? `${t.slice(0, exports.MAX_ITEM_CERTIDAO - 40).trimEnd()}… (íntegra no registro do ato)` : t);
exports.textoDoItem = textoDoItem;
/** O item ainda cabe na folha da certidão pendente? */
const cabeNaCertidao = (itens, item) => textoCertidao([...itens, item]).length <= exports.MAX_TEXTO_CERTIDAO;
exports.cabeNaCertidao = cabeNaCertidao;
/** As partes veem a certidão só se puderem ver todos os itens. */
const visivelCertidao = (itens) => itens.length > 0 && itens.every((i) => i.partes);
exports.visivelCertidao = visivelCertidao;
/** Campos de `dados` do movimento para o destino: interno (sem folha), fora da impressão e oculto (sem evento). */
function marcasDoDestino(d) {
    if (d === 'autos')
        return {};
    if (d === 'nenhum')
        return { interno: true, fora_impressao: true, oculto: true, visivel_partes: false };
    return d === 'informacao' ? { interno: true, fora_impressao: true } : { interno: true };
}
//# sourceMappingURL=exigencias.js.map