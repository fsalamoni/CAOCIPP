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
exports.visivelCertidao = exports.cabeNaCertidao = exports.textoDoItem = exports.mudancaNaCertidao = exports.grupoDe = exports.MAX_ITEM_CERTIDAO = exports.MAX_TEXTO_CERTIDAO = exports.movimentoInterno = exports.documentosQueFaltam = exports.marcasNaFase = exports.respostasDaFase = exports.respondeNaRodada = exports.respostaDaAcao = exports.chaveDaCondicao = exports.chaveDaResposta = exports.partesVeem = exports.pedidoDaAcao = exports.MAX_DOCUMENTOS_FASE = exports.PEDIDOS_RESERVAVEIS = exports.VE = exports.QUEM = exports.MAX_CAMPOS_ACAO = exports.MAX_OPCOES_ACAO = exports.PEDIDOS = exports.NIVEIS = exports.FORMAS = exports.PADRAO_OUTRO = exports.OUTROS_ATOS = exports.REGISTROS = exports.destinoTransicao = exports.maisReservado = exports.DESTINOS_ACAO = exports.DESTINOS_ATO = exports.DESTINOS = void 0;
exports.destinoDaAcao = destinoDaAcao;
exports.niveisDaFase = niveisDaFase;
exports.sanitizeExigencia = sanitizeExigencia;
exports.opcoesDaResposta = opcoesDaResposta;
exports.respostasDaAcao = respostasDaAcao;
exports.sanitizeCondicao = sanitizeCondicao;
exports.rotuloDaCondicao = rotuloDaCondicao;
exports.grupoDeAlternativas = grupoDeAlternativas;
exports.alternativaCumprida = alternativaCumprida;
exports.condicaoAtendida = condicaoAtendida;
exports.acaoAtiva = acaoAtiva;
exports.destinoDoAto = destinoDoAto;
exports.marcasDoAto = marcasDoAto;
exports.sanitizeRegras = sanitizeRegras;
exports.destinoDaGuarda = destinoDaGuarda;
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
const camposProcesso_1 = require("./camposProcesso");
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
exports.PEDIDOS = ['confirmar', 'texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao', 'registro', 'formulario', 'documento', 'orientacao'];
exports.MAX_OPCOES_ACAO = 30;
/** Campos de uma ação que pede um formulário. */
exports.MAX_CAMPOS_ACAO = 10;
/** Quem pode cumprir a ação, além da administração: o responsável designado ou quem gere a unidade. */
exports.QUEM = ['responsavel', 'gestor'];
/**
 * Quem da equipe vê o dado da ação. Ausente = toda a equipe que vê o processo.
 * 'gestor': só quem gere a unidade onde foi registrado, quem o registrou e a
 * administração. Dado reservado nunca vai aos autos, ao portal nem a outro módulo.
 */
exports.VE = ['gestor'];
/** O que pode ficar reservado: dado digitado (sem escolha que condiciona, sem registro de outro módulo). */
exports.PEDIDOS_RESERVAVEIS = ['texto', 'texto_longo', 'numero', 'data', 'formulario'];
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
    var _b;
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
    // Só orientação: não se marca, não gera registro, não é cobrada.
    if (pedeBruto === 'orientacao')
        return Object.assign(Object.assign({}, out), { pede: 'orientacao' });
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
            if (out.modulo === 'paginas')
                out.pagina = (0, camposProcesso_1.paginaDe)(r.pagina, acao);
        }
        if (pedeBruto === 'formulario') {
            const lista = Array.isArray(r.campos) ? r.campos : [];
            if (lista.length > exports.MAX_CAMPOS_ACAO)
                throw new Error(`A ação "${acao}" aceita até ${exports.MAX_CAMPOS_ACAO} campos`);
            // Sem "exigir em" (o obrigatório vale ao cumprir a ação) e sem "partes veem" por campo:
            // quem decide o que as partes veem é a ação inteira.
            let campos;
            try {
                campos = (0, camposProcesso_1.sanitizeCampos)(lista.map((x) => (x && typeof x === 'object' ? Object.assign(Object.assign({}, x), { exigir_em: undefined, importar: undefined }) : x)))
                    .map((c) => (Object.assign(Object.assign({}, c), { visivel_partes: false })));
            }
            catch (e) {
                throw new Error(`Na ação "${acao}": ${e.message}`);
            }
            if (!campos.length)
                throw new Error(`A ação "${acao}" pede um formulário: crie ao menos um campo`);
            out.campos = campos;
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
    if (exports.QUEM.includes(r.quem))
        out.quem = r.quem;
    // Folha de dados: só ação que pede um dado (a confirmação simples não tem o que mostrar).
    if (r.folha_dados === true && out.pede)
        out.folha_dados = true;
    if (exports.VE.includes(r.ve)) {
        if (out.folha_dados)
            throw new Error(`A ação "${acao}": dado reservado a quem gere a unidade não entra na folha de dados, que toda a equipe lê`);
        if (!out.pede || !exports.PEDIDOS_RESERVAVEIS.includes(out.pede)) {
            throw new Error(`A ação "${acao}": só texto, número, data ou formulário pode ficar reservado a quem gere a unidade`);
        }
        if ((_b = out.campos) === null || _b === void 0 ? void 0 : _b.some((c) => c.tipo === 'registro')) {
            throw new Error(`A ação "${acao}": formulário com registro de outro módulo não pode ficar reservado`);
        }
        if (dest === 'autos' || dest === 'consolidar') {
            throw new Error(`A ação "${acao}" fica nos autos, que toda a equipe lê: escolha outro lugar para reservar o dado`);
        }
        delete out.partes;
        out.ve = r.ve;
    }
    return Object.keys(out).length ? out : null;
}
/** Campos do formulário da ação que condicionam: os de escolha, e nunca os de ação com dado reservado. */
const camposDeEscolha = (r) => ((r === null || r === void 0 ? void 0 : r.pede) === 'formulario' && !r.ve ? (r.campos || []).filter((c) => c.tipo === 'lista' || c.tipo === 'sim_nao') : []);
/**
 * Opções que a resposta da ação pode ter (só ações de escolha condicionam).
 * Com `campo`, as do campo de escolha do formulário que a ação pede.
 */
function opcoesDaResposta(r, campo) {
    if (!r || r.documento)
        return null;
    if (campo) {
        const c = camposDeEscolha(r).find((x) => x.id === campo);
        return !c ? null : c.tipo === 'lista' ? c.opcoes || [] : ['sim', 'nao'];
    }
    if (r.pede === 'lista')
        return r.opcoes || [];
    if (r.pede === 'sim_nao')
        return ['sim', 'nao'];
    return null;
}
/** Valor gravado como chave da resposta: a opção escolhida, ou 'sim'/'nao'. */
const chaveDaResposta = (v) => (typeof v === 'boolean' ? (v ? 'sim' : 'nao') : String(v !== null && v !== void 0 ? v : ''));
exports.chaveDaResposta = chaveDaResposta;
/** Onde a resposta fica na rodada da fase: '2' (a ação 2) ou '2.sistema' (o campo "sistema" do formulário da ação 2). */
const chaveDaCondicao = (c) => (c.campo ? `${c.acao}.${c.campo}` : String(c.acao));
exports.chaveDaCondicao = chaveDaCondicao;
/** A chave da rodada é da ação `idx` (a própria resposta ou a de um campo dela)? */
const respostaDaAcao = (chave, idx) => chave === String(idx) || chave.startsWith(`${idx}.`);
exports.respostaDaAcao = respostaDaAcao;
/** A ação deixa resposta na rodada (é de escolha, ou pede formulário com campo de escolha)? */
const respondeNaRodada = (r) => opcoesDaResposta(r) !== null || camposDeEscolha(r).length > 0;
exports.respondeNaRodada = respondeNaRodada;
/** O que a ação cumprida responde na rodada: { '2': 'SPU' } ou, no formulário, { '2.sistema': 'SPU' } por campo de escolha preenchido. */
function respostasDaAcao(r, idx, valor) {
    var _b;
    if (opcoesDaResposta(r) !== null)
        return { [String(idx)]: (0, exports.chaveDaResposta)(valor) };
    const dados = Array.isArray(valor) ? valor : [];
    const out = {};
    for (const c of camposDeEscolha(r)) {
        const v = (_b = dados.find((x) => (x === null || x === void 0 ? void 0 : x.id) === c.id)) === null || _b === void 0 ? void 0 : _b.valor;
        if (v !== null && v !== undefined && v !== '')
            out[`${idx}.${c.id}`] = (0, exports.chaveDaResposta)(v);
    }
    return out;
}
/**
 * Saneia a condição contra as regras já saneadas da fase. `mapa` traduz o índice
 * mandado pelo cliente para o índice gravado (linhas vazias saem); `antesDe`
 * limita a ações anteriores (ação condicional). Inválida: lança com mensagem.
 */
function sanitizeCondicao(raw, regras, acoes, quem, mapa, antesDe = Infinity) {
    if (!raw || typeof raw !== 'object')
        return undefined;
    const o = raw;
    const bruto = Number(o.acao);
    const acao = mapa ? mapa.get(bruto) : bruto;
    // A ação de que dependia saiu (linha vazia): a condição sai com ela.
    if (acao === undefined)
        return undefined;
    const campo = typeof o.campo === 'string' && o.campo ? o.campo.slice(0, 24) : undefined;
    const opcoes = Number.isInteger(acao) && acao >= 0 && acao < Math.min(acoes.length, antesDe) ? opcoesDaResposta(regras[acao], campo) : null;
    if (!opcoes) {
        throw new Error(campo
            ? `${quem} depende de um campo de escolha do formulário de uma ação ${antesDe === Infinity ? 'desta fase' : 'anterior'} (sem dado reservado)`
            : `${quem} depende da resposta de uma ação de escolha ${antesDe === Infinity ? 'desta fase' : 'anterior'}`);
    }
    const valores = [...new Set((Array.isArray(o.valores) ? o.valores : []).map((v) => texto(v, 80)))].filter((v) => opcoes.includes(v));
    if (!valores.length)
        throw new Error(`${quem}: escolha ao menos uma resposta de "${acoes[acao]}"`);
    return Object.assign(Object.assign({ acao }, (campo ? { campo } : {})), { valores });
}
/** Rótulo do dado que a condição lê: o da ação ou o do campo do formulário. */
function rotuloDaCondicao(f, c) {
    var _b, _c, _d;
    const r = (_b = f === null || f === void 0 ? void 0 : f.acoes_regras) === null || _b === void 0 ? void 0 : _b[c.acao];
    const campo = c.campo ? (_c = r === null || r === void 0 ? void 0 : r.campos) === null || _c === void 0 ? void 0 : _c.find((x) => x.id === c.campo) : undefined;
    return (campo === null || campo === void 0 ? void 0 : campo.rotulo) || (r === null || r === void 0 ? void 0 : r.rotulo) || ((_d = f === null || f === void 0 ? void 0 : f.acoes) === null || _d === void 0 ? void 0 : _d[c.acao]) || 'a resposta';
}
/**
 * "Alternativa a": aponta para uma ação anterior da fase que se marca (não
 * documento nem orientação). Inválida: lança com mensagem.
 */
function sanitizeOu(raw, regras, acoes, i, mapa) {
    if (raw === undefined || raw === null || raw === '')
        return undefined;
    const alvo = mapa ? mapa.get(Number(raw)) : Number(raw);
    if (alvo === undefined)
        return undefined; // a ação de que era alternativa saiu
    const marca = (r) => !(r === null || r === void 0 ? void 0 : r.documento) && (r === null || r === void 0 ? void 0 : r.pede) !== 'orientacao';
    if (!Number.isInteger(alvo) || alvo < 0 || alvo >= i || !marca(regras[alvo]) || !marca(regras[i])) {
        throw new Error(`A ação "${acoes[i]}" só pode ser alternativa a uma ação anterior da fase que se marca (sem documento)`);
    }
    return alvo;
}
/** Ações do mesmo grupo de alternativas que `i` (inclui `i`). Sem alternativa, só ela. */
function grupoDeAlternativas(f, i) {
    const regras = (f === null || f === void 0 ? void 0 : f.acoes_regras) || [];
    // O rito só aponta para trás: a subida termina.
    const raiz = (k) => { var _b; const o = (_b = regras[k]) === null || _b === void 0 ? void 0 : _b.ou; return typeof o === 'number' && o >= 0 && o < k ? raiz(o) : k; };
    const r = raiz(i);
    return ((f === null || f === void 0 ? void 0 : f.acoes) || []).map((_a, k) => k).filter((k) => raiz(k) === r);
}
/** Outra ação do grupo de alternativas já foi cumprida (e vale agora)? */
function alternativaCumprida(f, i, feitas, resp) {
    return grupoDeAlternativas(f, i).some((k) => k !== i && feitas.has(k) && acaoAtiva(f, k, resp));
}
/**
 * A condição vale com as respostas da rodada? Sem condição, sempre. Com `f`,
 * a resposta só conta se a ação que a deu também vale (condições em cadeia:
 * desfeita a resposta de cima, a de baixo deixa de pesar).
 */
function condicaoAtendida(c, resp, f) {
    if (!c)
        return true;
    const k = (0, exports.chaveDaCondicao)(c);
    if ((resp === null || resp === void 0 ? void 0 : resp[k]) === undefined || !c.valores.includes(resp[k]))
        return false;
    // A condição só aponta para ação anterior (o rito é validado assim): a recursão termina.
    return !f || acaoAtiva(f, c.acao, resp);
}
/** A ação vale agora (sem condição, ou com a resposta que ela pede, de ação que também vale)? */
function acaoAtiva(f, i, resp) {
    var _b, _c;
    const se = (_c = (_b = f === null || f === void 0 ? void 0 : f.acoes_regras) === null || _b === void 0 ? void 0 : _b[i]) === null || _c === void 0 ? void 0 : _c.se;
    if (!se)
        return true;
    return se.acao < i && condicaoAtendida(se, resp, f);
}
/** Respostas da rodada da fase atual. */
const respostasDaFase = (proc) => (proc.acoes_respostas || {})[String(proc.fase_atual)];
exports.respostasDaFase = respostasDaFase;
/** Onde fica o ato durante a fase (valor estranho lê como o padrão). */
function destinoDoAto(f, ato) {
    var _b, _c;
    return lido((_c = (_b = f === null || f === void 0 ? void 0 : f.registro_atos) === null || _b === void 0 ? void 0 : _b.outros) === null || _c === void 0 ? void 0 : _c[ato], opcoesDoAto(ato), exports.PADRAO_OUTRO[ato]);
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
function sanitizeRegras(fo, acoes, mapa) {
    const registroAtos = sanitizeRegistroAtos(fo);
    const brutas = Array.isArray(fo.acoes_regras) ? fo.acoes_regras : [];
    const regras = acoes.map((a, i) => sanitizeRegra(brutas[i], a));
    // "Só vale se": depende de uma ação de escolha anterior (nunca dela mesma nem de uma posterior).
    regras.forEach((r, i) => {
        const b = brutas[i];
        const se = sanitizeCondicao(b === null || b === void 0 ? void 0 : b.se, regras, acoes, `A ação "${acoes[i]}"`, mapa, i);
        if (se)
            regras[i] = Object.assign(Object.assign({}, (r || {})), { se });
        const ou = sanitizeOu(b === null || b === void 0 ? void 0 : b.ou, regras, acoes, i, mapa);
        if (ou !== undefined)
            regras[i] = Object.assign(Object.assign({}, (regras[i] || {})), { ou });
    });
    const documentos = (Array.isArray(fo.documentos) ? fo.documentos : [])
        .map((d) => sanitizeExigencia(d)).filter((d) => !!d).slice(0, exports.MAX_DOCUMENTOS_FASE);
    return Object.assign(Object.assign(Object.assign({}, (registroAtos ? { registro_atos: registroAtos } : {})), (regras.some(Boolean) ? { acoes_regras: regras } : {})), (documentos.length ? { documentos } : {}));
}
/**
 * Onde fica o registro de um documento guardado fora dos autos. Cumprindo
 * exigência do rito, vale o que ela pede (só no sistema, se todas pedem). Sem
 * exigência, segue a fase: a que o rito deixa fora da impressão (só no
 * sistema ou sem evento) não põe a guarda no extrato impresso.
 */
function destinoDaGuarda(f, cumpridas) {
    if (cumpridas.length)
        return cumpridas.every((e) => e.destino === 'informacao') ? 'informacao' : 'evento';
    return ['informacao', 'nenhum'].includes(niveisDaFase(f).fase) ? 'informacao' : 'evento';
}
/** Exigências de documento da fase com a chave que o processo grava: 'd0' (da fase), 'a2' (da ação 2). */
function exigenciasDaFase(f, resp) {
    if (!f)
        return [];
    return [
        ...(f.documentos || []).map((d, i) => (Object.assign(Object.assign({}, d), { chave: `d${i}` }))),
        // Ação condicional que não vale agora não exige o documento.
        ...(f.acoes_regras || []).flatMap((r, i) => { var _b; return ((r === null || r === void 0 ? void 0 : r.documento) && ((_b = f.acoes) === null || _b === void 0 ? void 0 : _b[i]) && acaoAtiva(f, i, resp) ? [Object.assign(Object.assign({}, r.documento), { chave: `a${i}`, acao_idx: i })] : []); }),
    ];
}
/** Documentos exigidos ainda não cumpridos na fase. */
function pendentesDaFase(f, cumpridas, resp) {
    const feitas = (f && (cumpridas === null || cumpridas === void 0 ? void 0 : cumpridas[f.id])) || {};
    return exigenciasDaFase(f, resp).filter((e) => !feitas[e.chave]);
}
/** Documentos obrigatórios ainda não cumpridos: os recomendados e opcionais não impedem a fase de seguir. */
const documentosQueFaltam = (f, cumpridas, resp) => pendentesDaFase(f, cumpridas, resp).filter((e) => !e.nivel);
exports.documentosQueFaltam = documentosQueFaltam;
/** Ações obrigatórias (sem documento) ainda não feitas na fase. */
function acoesObrigatoriasPendentes(f, feitas, resp) {
    if (!f)
        return [];
    const ok = new Set(feitas || []);
    const cobrada = (i) => {
        var _b, _c, _d;
        return !!((_c = (_b = f.acoes_regras) === null || _b === void 0 ? void 0 : _b[i]) === null || _c === void 0 ? void 0 : _c.obrigatoria) && !((_d = f.acoes_regras[i]) === null || _d === void 0 ? void 0 : _d.documento) && !ok.has(i) && acaoAtiva(f, i, resp)
            && !alternativaCumprida(f, i, ok, resp);
    };
    return (f.acoes || []).flatMap((_a, i) => {
        if (!cobrada(i))
            return [];
        // Alternativas: o grupo aparece uma vez, como "A ou B" (só as que valem agora).
        const grupo = grupoDeAlternativas(f, i).filter((k) => acaoAtiva(f, k, resp));
        return grupo.find(cobrada) === i ? [{ descricao: grupo.map((k) => (f.acoes || [])[k]).join(' ou '), acao_idx: i }] : [];
    });
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
    const rs = (proc.acoes_respostas || {});
    if (faseId in ex) {
        const _b = ex, _c = faseId, _x = _b[_c], resto = __rest(_b, [typeof _c === "symbol" ? _c : _c + ""]);
        out.exigencias_cumpridas = resto;
    }
    if (faseId in ac) {
        const _d = ac, _e = faseId, _y = _d[_e], resto = __rest(_d, [typeof _e === "symbol" ? _e : _e + ""]);
        out.acoes_feitas = resto;
    }
    if (faseId in rs) {
        const _f = rs, _g = faseId, _z = _f[_g], resto = __rest(_f, [typeof _g === "symbol" ? _g : _g + ""]);
        out.acoes_respostas = resto;
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
const grupoDe = (f) => { var _b; return (f ? ((_b = f.certidao) === null || _b === void 0 ? void 0 : _b.grupo) || f.id : ''); };
exports.grupoDe = grupoDe;
/** Título da certidão do grupo: o que a primeira fase do grupo deu, ou o nome das fases. */
function tituloCertidao(fases, grupo) {
    var _b, _c, _d, _e;
    const membros = fases.filter((f) => (0, exports.grupoDe)(f) === grupo);
    // Vale o título da fase raiz; o de outra fase do grupo só se a raiz não deu.
    const dado = ((_c = (_b = membros.find((f) => f.id === grupo)) === null || _b === void 0 ? void 0 : _b.certidao) === null || _c === void 0 ? void 0 : _c.titulo) || ((_e = (_d = membros.find((f) => { var _b; return (_b = f.certidao) === null || _b === void 0 ? void 0 : _b.titulo; })) === null || _d === void 0 ? void 0 : _d.certidao) === null || _e === void 0 ? void 0 : _e.titulo);
    if (dado)
        return dado;
    const nomes = membros.map((f) => f.nome || f.id);
    return nomes.length > 1 ? `Certidão das fases ${nomes.join(', ')}` : `Certidão da fase ${nomes[0] || grupo}`;
}
/** Mudança de fase dentro do mesmo grupo vira item da certidão (em vez de termo próprio)? */
const mudancaNaCertidao = (fases, deId, paraId) => {
    var _b, _c;
    const de = fases.find((f) => f.id === deId);
    const para = fases.find((f) => f.id === paraId);
    return !!de && !!para && (0, exports.grupoDe)(de) === (0, exports.grupoDe)(para) && (((_b = de.certidao) === null || _b === void 0 ? void 0 : _b.incluir_mudancas) === true || ((_c = para.certidao) === null || _c === void 0 ? void 0 : _c.incluir_mudancas) === true);
};
exports.mudancaNaCertidao = mudancaNaCertidao;
/** Há certidão por emitir antes deste ato? `paraId` null = sai do fluxo (arquivar). */
function deveEmitir(fases, c, deId, paraId) {
    var _b;
    if (!((_b = c === null || c === void 0 ? void 0 : c.itens) === null || _b === void 0 ? void 0 : _b.length))
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