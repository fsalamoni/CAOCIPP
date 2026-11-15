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
exports.visivelCertidao = exports.cabeNaCertidao = exports.textoDoItem = exports.MAX_ABERTURA_CERTIDAO = exports.ABERTURA_CERTIDAO = exports.mudancaNaCertidao = exports.grupoDe = exports.MAX_ITEM_CERTIDAO = exports.MAX_TEXTO_CERTIDAO = exports.movimentoInterno = exports.documentosQueFaltam = exports.exigeAlgo = exports.marcasNaFase = exports.respondeNaRodada = exports.respostaDaAcao = exports.chaveDaCondicao = exports.chaveDaResposta = exports.partesVeem = exports.pedidoDaAcao = exports.MAX_DOCUMENTOS_FASE = exports.PEDIDOS_RESERVAVEIS = exports.VE = exports.DADOS_CONDICAO = exports.MAX_CONDICOES_E = exports.MAX_CAMPOS_ACAO = exports.MAX_OPCOES_ACAO = exports.PEDIDOS = exports.NIVEIS = exports.MAX_ASSINATURAS_EXIGIDAS = exports.FORMAS = exports.PADRAO_OUTRO = exports.OUTROS_ATOS = exports.REGISTROS = exports.destinoTransicao = exports.maisReservado = exports.DESTINOS_ACAO = exports.DESTINOS_ATO = exports.DESTINOS = exports.QUEM = void 0;
exports.destinoDaAcao = destinoDaAcao;
exports.niveisDaFase = niveisDaFase;
exports.sanitizeExigencia = sanitizeExigencia;
exports.opcoesDaResposta = opcoesDaResposta;
exports.respostasDaAcao = respostasDaAcao;
exports.sanitizeCondicao = sanitizeCondicao;
exports.condicaoAmpla = condicaoAmpla;
exports.sanitizeCondicaoAmpla = sanitizeCondicaoAmpla;
exports.rotuloDaCondicao = rotuloDaCondicao;
exports.textoDaCondicao = textoDaCondicao;
exports.grupoDeAlternativas = grupoDeAlternativas;
exports.alternativaCumprida = alternativaCumprida;
exports.condicaoAtendida = condicaoAtendida;
exports.acaoAtiva = acaoAtiva;
exports.respostasDaFase = respostasDaFase;
exports.destinoDoAto = destinoDoAto;
exports.marcasDoAto = marcasDoAto;
exports.sanitizeRegras = sanitizeRegras;
exports.destinoDaGuarda = destinoDaGuarda;
exports.exigenciasDaFase = exigenciasDaFase;
exports.pendentesDaFase = pendentesDaFase;
exports.acoesObrigatoriasPendentes = acoesObrigatoriasPendentes;
exports.faltaAssinatura = faltaAssinatura;
exports.atende = atende;
exports.reconhecer = reconhecer;
exports.camposDoCumprimento = camposDoCumprimento;
exports.camposAoEntrarNaFase = camposAoEntrarNaFase;
exports.destinoDoMovimento = destinoDoMovimento;
exports.tituloCertidao = tituloCertidao;
exports.deveEmitir = deveEmitir;
exports.aberturaCertidao = aberturaCertidao;
exports.textoCertidao = textoCertidao;
exports.marcasDoDestino = marcasDoDestino;
const modulos_1 = require("./modulos");
const camposProcesso_1 = require("./camposProcesso");
const permissoesFase_1 = require("./permissoesFase");
Object.defineProperty(exports, "QUEM", { enumerable: true, get: function () { return permissoesFase_1.QUEM; } });
const comunicacaoRito_1 = require("./comunicacaoRito");
const audiencias_1 = require("./audiencias");
const julgamento_1 = require("./julgamento");
const certames_1 = require("./certames");
const listasOrgao_1 = require("./listasOrgao");
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
exports.MAX_ASSINATURAS_EXIGIDAS = 5;
exports.NIVEIS = ['recomendado', 'opcional'];
/** O que a ação pede a quem a cumpre. */
exports.PEDIDOS = ['confirmar', 'texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao', 'registro', 'formulario', 'documento', 'orientacao', 'comunicacao', 'resposta', 'audiencia', 'julgamento', 'disputa'];
exports.MAX_OPCOES_ACAO = 30;
/** Campos de uma ação que pede um formulário. */
exports.MAX_CAMPOS_ACAO = 10;
/** Condições a mais numa mesma regra (além da primeira). */
exports.MAX_CONDICOES_E = 3;
/**
 * Dados do processo que uma condição lê, com os valores que cada um assume
 * (null: valor livre, vindo do cadastro do órgão). As origens são as de
 * `ORIGENS` (shared/secretaria.ts); o teste confere que as duas listas batem.
 */
exports.DADOS_CONDICAO = {
    urgente: ['sim', 'nao'],
    sigilo: ['normal', 'restrito'],
    partes: ['sim', 'nao'],
    origem: ['requerimento', 'representacao', 'oficio', 'de_oficio', 'outro_processo', 'outro'],
    tipo: null,
};
const ROTULO_DADO = { urgente: 'Urgente', sigilo: 'Sigilo', partes: 'Tem partes', origem: 'Origem', tipo: 'Tipo de processo' };
const ROTULO_VALOR = {
    sim: 'Sim', nao: 'Não', normal: 'Normal', restrito: 'Restrito', requerimento: 'Requerimento', representacao: 'Representação',
    oficio: 'Ofício', de_oficio: 'De ofício', outro_processo: 'Outro processo', outro: 'Outra',
};
/** A condição (uma parte dela) lê a rodada da própria fase? */
const condicaoLocal = (c) => c.fase === undefined && c.dado === undefined;
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
    // Assinatura vale para o que o órgão produz: documento recebido de fora não se assina aqui.
    const assina = forma !== 'juntar';
    const nAss = assina ? Math.min(exports.MAX_ASSINATURAS_EXIGIDAS, Math.max(0, Math.trunc(Number(o.assinaturas) || 0))) : 0;
    const atrib = assina ? texto(o.assinatura_atribuicao, permissoesFase_1.MAX_ATRIBUICAO) : '';
    return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ descricao, forma }, (tipo ? { tipo } : {})), (modelo ? { modelo_id: modelo } : {})), (dest !== 'autos' ? { destino: dest } : {})), (nivel ? { nivel } : {})), (o.partes === false && dest === 'autos' ? { partes: false } : {})), (nAss ? { assinaturas: nAss } : {})), (atrib ? { assinatura_atribuicao: atrib } : {}));
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
    // Comunicar as partes: cumpre-se expedindo pela ação; o registro são as próprias comunicações (nos autos).
    if (pedeBruto === 'comunicacao') {
        Object.assign(out, (0, permissoesFase_1.sanitizeQuem)(r.quem, r.atribuicao, `A ação "${acao}"`));
        return Object.assign(Object.assign(Object.assign({}, out), { pede: 'comunicacao', comunicacao: (0, comunicacaoRito_1.sanitizeComunicacaoDaAcao)(r.comunicacao, acao) }), (r.obrigatoria === true ? { obrigatoria: true } : r.recomendada === true ? { recomendada: true } : {}));
    }
    // Designar audiência: ato público, sempre nos autos e visto pelas partes.
    if (pedeBruto === 'audiencia') {
        Object.assign(out, (0, permissoesFase_1.sanitizeQuem)(r.quem, r.atribuicao, `A ação "${acao}"`));
        return Object.assign(Object.assign(Object.assign({}, out), { pede: 'audiencia', audiencia: (0, audiencias_1.sanitizeAudienciaDaAcao)(r.audiencia, acao), destino: 'autos', partes: true }), (r.obrigatoria === true ? { obrigatoria: true } : r.recomendada === true ? { recomendada: true } : {}));
    }
    // Disputa de preços: aviso, propostas e resultado são atos públicos, nos autos.
    if (pedeBruto === 'disputa') {
        Object.assign(out, (0, permissoesFase_1.sanitizeQuem)(r.quem, r.atribuicao, `A ação "${acao}"`));
        return Object.assign(Object.assign(Object.assign({}, out), { pede: 'disputa', disputa: (0, certames_1.sanitizeDisputaDaAcao)(r.disputa, acao), destino: 'autos', partes: true }), (r.obrigatoria === true ? { obrigatoria: true } : r.recomendada === true ? { recomendada: true } : {}));
    }
    // Julgamento colegiado: a certidão (resultado, placar, relator, vencidos, impedidos) é ato público, nos autos.
    if (pedeBruto === 'julgamento') {
        Object.assign(out, (0, permissoesFase_1.sanitizeQuem)(r.quem, r.atribuicao, `A ação "${acao}"`));
        return Object.assign(Object.assign(Object.assign({}, out), { pede: 'julgamento', julgamento: (0, julgamento_1.sanitizeJulgamentoDaAcao)(r.julgamento, acao), destino: 'autos', partes: true }), (r.obrigatoria === true ? { obrigatoria: true } : r.recomendada === true ? { recomendada: true } : {}));
    }
    // Esperar a resposta: a ação de que depende é validada com todas as regras da fase (sanitizeRegras).
    if (pedeBruto === 'resposta') {
        return Object.assign(Object.assign(Object.assign({}, out), { pede: 'resposta', resposta: { de: -1 } }), (r.obrigatoria === true ? { obrigatoria: true } : r.recomendada === true ? { recomendada: true } : {}));
    }
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
    Object.assign(out, (0, permissoesFase_1.sanitizeQuem)(r.quem, r.atribuicao, `A ação "${acao}"`));
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
    var _b;
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
    if (r.pede === 'resposta')
        return [...comunicacaoRito_1.RESPOSTAS];
    if (r.pede === 'julgamento')
        return [...(((_b = r.julgamento) === null || _b === void 0 ? void 0 : _b.resultados) || [])];
    if (r.pede === 'disputa')
        return [...certames_1.RESULTADOS_DISPUTA];
    return null;
}
/** Valor gravado como chave da resposta: a opção escolhida, ou 'sim'/'nao'. */
const chaveDaResposta = (v) => (typeof v === 'boolean' ? (v ? 'sim' : 'nao') : String(v !== null && v !== void 0 ? v : ''));
exports.chaveDaResposta = chaveDaResposta;
/** Onde a resposta fica na rodada da fase: '2' (a ação 2) ou '2.sistema' (o campo "sistema" do formulário da ação 2). */
const chaveDaCondicao = (c) => (c.dado ? `@${c.dado}` : `${c.fase ? `${c.fase}/` : ''}${c.campo ? `${c.acao}.${c.campo}` : c.acao}`);
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
function sanitizeCondicao(raw, regras, acoes, quem, mapa, antesDe = Infinity, onde = antesDe === Infinity ? 'desta fase' : 'anterior') {
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
            ? `${quem} depende de um campo de escolha do formulário de uma ação ${onde} (sem dado reservado)`
            : `${quem} depende da resposta de uma ação de escolha ${onde}`);
    }
    const valores = [...new Set((Array.isArray(o.valores) ? o.valores : []).map((v) => texto(v, 80)))].filter((v) => opcoes.includes(v));
    if (!valores.length)
        throw new Error(`${quem}: escolha ao menos uma resposta de "${acoes[acao]}"`);
    return Object.assign(Object.assign({ acao }, (campo ? { campo } : {})), { valores });
}
/** Condição sobre um dado do processo (urgente, sigilo, partes, origem, tipo ou campo de escolha do tipo). */
function sanitizeDado(o, quem) {
    const dado = String(o.dado).slice(0, 48);
    const campo = dado.startsWith('campo:') ? dado.slice(6) : '';
    const opcoes = campo ? null : exports.DADOS_CONDICAO[dado];
    if (campo ? !/^[\w-]{1,40}$/.test(campo) : opcoes === undefined)
        throw new Error(`${quem} depende de um dado do processo que não existe`);
    const brutos = (Array.isArray(o.valores) ? o.valores : []).map((v) => texto(v, 80));
    // Com valor livre (tipo, campo do tipo), o nome de cada valor acompanha o valor.
    const nomesBrutos = Array.isArray(o.nomes) ? o.nomes : [];
    // Origem: além das do sistema, as da lista do órgão (id "o_..."), com o nome.
    const aceita = (v) => !opcoes || opcoes.includes(v) || (dado === 'origem' && (0, listasOrgao_1.ehDoOrgao)(v));
    const pares = brutos.map((v, i) => [v, texto(nomesBrutos[i], 80)])
        .filter(([v], i) => v && brutos.indexOf(v) === i && aceita(v)).slice(0, exports.MAX_OPCOES_ACAO);
    const rotulo = opcoes ? '' : texto(o.rotulo, 80);
    if (!pares.length)
        throw new Error(`${quem}: escolha ao menos um valor de "${rotulo || ROTULO_DADO[dado] || 'dado do processo'}"`);
    return Object.assign(Object.assign({ acao: -1, dado, valores: pares.map(([v]) => v) }, (rotulo ? { rotulo } : {})), ((!opcoes || dado === 'origem') && pares.some(([v, n]) => n && n !== v && !(opcoes || []).includes(v)) ? { nomes: pares.map(([v, n]) => n || v) } : {}));
}
/** A condição bruta lê mais do que a rodada da própria fase (outra fase, dado do processo, várias ao mesmo tempo)? */
function condicaoAmpla(raw) {
    const o = (raw && typeof raw === 'object' ? raw : {});
    return !!o.fase || !!o.dado || (Array.isArray(o.e) && o.e.length > 0);
}
/**
 * Saneia a condição que lê mais do que a rodada da própria fase. Cada parte (a
 * primeira e as de `e`) é: um dado do processo; a resposta de uma ação de
 * escolha de outra fase (`outras` resolve o id mandado pelo cliente); ou a de
 * uma ação da própria fase (`antesDe`, na ação condicional). A parte cuja ação
 * ou fase saiu do rito sai com ela. Inválida: lança com mensagem.
 */
function sanitizeCondicaoAmpla(raw, propria, outras, quem, antesDe = Infinity) {
    if (!raw || typeof raw !== 'object')
        return undefined;
    const o = raw;
    const parte = (p) => {
        if (!p || typeof p !== 'object')
            return undefined;
        const x = p;
        if (typeof x.dado === 'string' && x.dado)
            return sanitizeDado(x, quem);
        if (typeof x.fase === 'string' && x.fase) {
            const alvo = outras(x.fase);
            if (!alvo)
                return undefined;
            if (alvo.id !== propria.id) {
                const c = sanitizeCondicao(x, alvo.regras, alvo.acoes, quem, alvo.mapa, Infinity, `da fase "${alvo.nome}"`);
                return c ? Object.assign(Object.assign({}, c), { fase: alvo.id }) : undefined;
            }
        }
        return sanitizeCondicao(x, propria.regras, propria.acoes, quem, propria.mapa, antesDe);
    };
    const vistas = new Set();
    const partes = [o, ...(Array.isArray(o.e) ? o.e : [])].map(parte)
        .filter((c) => !!c && !vistas.has((0, exports.chaveDaCondicao)(c)) && !!vistas.add((0, exports.chaveDaCondicao)(c)))
        .slice(0, exports.MAX_CONDICOES_E + 1);
    if (!partes.length)
        return undefined;
    return Object.assign(Object.assign({}, partes[0]), (partes.length > 1 ? { e: partes.slice(1) } : {}));
}
/** Rótulo do dado que a condição lê: o da ação, o do campo do formulário ou o do dado do processo. Com `fases`, diz de que fase é a resposta. */
function rotuloDaCondicao(f, c, fases) {
    var _b, _c, _d;
    if (c.dado)
        return c.rotulo || ROTULO_DADO[c.dado] || 'o dado do processo';
    const dona = c.fase ? fases === null || fases === void 0 ? void 0 : fases.find((x) => x.id === c.fase) : f;
    const r = (_b = dona === null || dona === void 0 ? void 0 : dona.acoes_regras) === null || _b === void 0 ? void 0 : _b[c.acao];
    const campo = c.campo ? (_c = r === null || r === void 0 ? void 0 : r.campos) === null || _c === void 0 ? void 0 : _c.find((x) => x.id === c.campo) : undefined;
    const nome = (campo === null || campo === void 0 ? void 0 : campo.rotulo) || (r === null || r === void 0 ? void 0 : r.rotulo) || ((_d = dona === null || dona === void 0 ? void 0 : dona.acoes) === null || _d === void 0 ? void 0 : _d[c.acao]) || 'a resposta';
    return c.fase ? `${nome} (fase ${(dona === null || dona === void 0 ? void 0 : dona.nome) || 'anterior'})` : nome;
}
/** Texto da condição para mensagens: "Decisão" for Deferido ou Parcial e "Urgente" for Sim. */
function textoDaCondicao(f, c, fases) {
    const uma = (x) => {
        var _b, _c, _d;
        const dona = x.fase ? fases === null || fases === void 0 ? void 0 : fases.find((y) => y.id === x.fase) : f;
        const r = x.dado ? undefined : (_b = dona === null || dona === void 0 ? void 0 : dona.acoes_regras) === null || _b === void 0 ? void 0 : _b[x.acao];
        const simNao = !x.dado && (x.campo ? (_d = (_c = r === null || r === void 0 ? void 0 : r.campos) === null || _c === void 0 ? void 0 : _c.find((y) => y.id === x.campo)) === null || _d === void 0 ? void 0 : _d.tipo : r === null || r === void 0 ? void 0 : r.pede) === 'sim_nao';
        const fixo = !!x.dado && !!exports.DADOS_CONDICAO[x.dado];
        const rot = (v, i) => { var _b, _c; return (simNao || fixo ? ROTULO_VALOR[v] || ((_b = x.nomes) === null || _b === void 0 ? void 0 : _b[i]) || v : ((_c = x.nomes) === null || _c === void 0 ? void 0 : _c[i]) || v); };
        return `"${rotuloDaCondicao(f, x, fases)}" for ${x.valores.map(rot).join(' ou ')}`;
    };
    return [c, ...(c.e || [])].map(uma).join(' e ');
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
    const uma = (x) => {
        const k = (0, exports.chaveDaCondicao)(x);
        if ((resp === null || resp === void 0 ? void 0 : resp[k]) === undefined || !x.valores.includes(resp[k]))
            return false;
        // Na própria fase, a condição só aponta para ação anterior (o rito é validado assim): a recursão termina.
        // A resposta de outra fase e o dado do processo valem como estão.
        return !condicaoLocal(x) || !f || acaoAtiva(f, x.acao, resp);
    };
    return uma(c) && (c.e || []).every(uma);
}
/** A ação vale agora (sem condição, ou com a resposta que ela pede, de ação que também vale)? */
function acaoAtiva(f, i, resp) {
    var _b, _c;
    const se = (_c = (_b = f === null || f === void 0 ? void 0 : f.acoes_regras) === null || _b === void 0 ? void 0 : _b[i]) === null || _c === void 0 ? void 0 : _c.se;
    if (!se)
        return true;
    return [se, ...(se.e || [])].every((x) => !condicaoLocal(x) || x.acao < i) && condicaoAtendida(se, resp, f);
}
/**
 * Tudo o que uma condição do rito pode ler no processo, numa só tabela:
 * - as respostas da rodada da fase atual ('2', '2.sistema'), como sempre;
 * - as respostas dadas nas outras fases ('analise/2'), como ficaram quando o
 *   processo passou por lá (a rodada recomeça quando ele volta à fase);
 * - dados do processo ('@urgente', '@sigilo', '@partes', '@origem', '@tipo' e
 *   '@campo:<id>' para os campos do tipo de processo).
 * O que se grava em `acoes_respostas` não passa por aqui.
 */
function respostasDaFase(proc) {
    var _b;
    const todas = (proc.acoes_respostas || {});
    const atual = String(proc.fase_atual);
    const out = {};
    for (const [fase, resp] of Object.entries(todas)) {
        if (fase !== atual)
            for (const [k, v] of Object.entries(resp || {}))
                out[`${fase}/${k}`] = v;
    }
    Object.assign(out, todas[atual] || {});
    out['@urgente'] = proc.urgente === true ? 'sim' : 'nao';
    out['@sigilo'] = proc.sigilo === 'restrito' ? 'restrito' : 'normal';
    out['@partes'] = (Array.isArray(proc.partes) ? proc.partes : []).some((p) => p && !p.retirada) ? 'sim' : 'nao';
    const origem = (_b = proc.origem) === null || _b === void 0 ? void 0 : _b.tipo;
    if (typeof origem === 'string' && origem)
        out['@origem'] = origem;
    if (typeof proc.tipo_id === 'string' && proc.tipo_id)
        out['@tipo'] = proc.tipo_id;
    for (const c of (Array.isArray(proc.campos) ? proc.campos : [])) {
        if (typeof (c === null || c === void 0 ? void 0 : c.id) === 'string' && c.id && c.valor !== null && c.valor !== undefined && c.valor !== '' && typeof c.valor !== 'object') {
            out[`@campo:${c.id}`] = (0, exports.chaveDaResposta)(c.valor);
        }
    }
    return out;
}
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
        var _b, _c;
        const b = brutas[i];
        // A que lê outra fase, dado do processo ou várias coisas fica para o fim do rito (sanitizeRito), com todas as fases prontas.
        const se = condicaoAmpla(b === null || b === void 0 ? void 0 : b.se) ? undefined : sanitizeCondicao(b === null || b === void 0 ? void 0 : b.se, regras, acoes, `A ação "${acoes[i]}"`, mapa, i);
        if (se)
            regras[i] = Object.assign(Object.assign({}, (r || {})), { se });
        const ou = sanitizeOu(b === null || b === void 0 ? void 0 : b.ou, regras, acoes, i, mapa);
        if (ou !== undefined)
            regras[i] = Object.assign(Object.assign({}, (regras[i] || {})), { ou });
        if (((_b = regras[i]) === null || _b === void 0 ? void 0 : _b.pede) === 'resposta')
            regras[i] = Object.assign(Object.assign({}, regras[i]), { resposta: (0, comunicacaoRito_1.sanitizeRespostaDaAcao)(b === null || b === void 0 ? void 0 : b.resposta, regras, acoes, i, mapa) });
        // Prazo próprio: qualquer ação que se cumpre (a que é só orientação não tem o que cumprir).
        const prazo = Number(b === null || b === void 0 ? void 0 : b.prazo_dias);
        if (Number.isInteger(prazo) && prazo > 0 && prazo <= 3650 && !['orientacao', 'resposta'].includes(String((_c = regras[i]) === null || _c === void 0 ? void 0 : _c.pede))) {
            regras[i] = Object.assign(Object.assign(Object.assign({}, (regras[i] || {})), { prazo_dias: prazo }), ((b === null || b === void 0 ? void 0 : b.prazo_contagem) === 'corridos' ? { prazo_contagem: 'corridos' } : {}));
        }
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
/**
 * A fase tem algum item obrigatório que vale agora (documento exigido ou ação
 * obrigatória)? Sem nenhum, ela não segue sozinha por juntada: não haveria o
 * que cumprir, e qualquer documento a encerraria.
 */
const exigeAlgo = (f, resp) => exigenciasDaFase(f, resp).some((e) => !e.nivel)
    || ((f === null || f === void 0 ? void 0 : f.acoes_regras) || []).some((r, i) => { var _b; return (r === null || r === void 0 ? void 0 : r.obrigatoria) === true && !!((_b = f === null || f === void 0 ? void 0 : f.acoes) === null || _b === void 0 ? void 0 : _b[i]) && acaoAtiva(f, i, resp); });
exports.exigeAlgo = exigeAlgo;
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
/** O que falta de assinatura para o documento cumprir a exigência (null = nada). */
function faltaAssinatura(e, d) {
    const n = e.assinaturas || 0;
    if (n && (d.assinaturas || 0) < n)
        return `"${e.descricao}" pede ${n === 1 ? 'o documento assinado' : `${n} assinaturas no documento`} antes de juntar`;
    if (e.assinatura_atribuicao && !(d.atribuicoes || []).some((a) => (0, permissoesFase_1.mesmaAtribuicao)(a, e.assinatura_atribuicao))) {
        return `"${e.descricao}" pede a assinatura de quem tem a atribuição ${e.assinatura_atribuicao}`;
    }
    return null;
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
            const falta = faltaAssinatura(e, d);
            if (falta)
                throw new Error(falta);
        }
        return chaves;
    }
    return pendentes
        .filter((e) => atende(e, d) && !faltaAssinatura(e, d) && ((e.modelo_id && e.modelo_id === d.modelo_id) || igual(e.tipo, d.tipo)))
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
exports.ABERTURA_CERTIDAO = 'Certifico que foram cumpridos os seguintes atos:';
exports.MAX_ABERTURA_CERTIDAO = 200;
/** Frase de abertura da certidão do grupo: a da fase raiz, a de outra fase do grupo, ou a padrão. */
function aberturaCertidao(fases, grupo) {
    var _b, _c, _d, _e;
    const membros = fases.filter((f) => (0, exports.grupoDe)(f) === grupo);
    return ((_c = (_b = membros.find((f) => f.id === grupo)) === null || _b === void 0 ? void 0 : _b.certidao) === null || _c === void 0 ? void 0 : _c.abertura) || ((_e = (_d = membros.find((f) => { var _b; return (_b = f.certidao) === null || _b === void 0 ? void 0 : _b.abertura; })) === null || _d === void 0 ? void 0 : _d.certidao) === null || _e === void 0 ? void 0 : _e.abertura) || exports.ABERTURA_CERTIDAO;
}
/** Texto da certidão conjunta (o título vai no evento): um item por ato, com quem fez e quando. */
function textoCertidao(itens, abertura = exports.ABERTURA_CERTIDAO) {
    const linhas = itens.map((i, k) => `${k + 1}) ${i.texto}${i.autor ? ` (${i.autor}${i.em ? `, ${quando(i.em)}` : ''})` : ''}`);
    return `${abertura} ${linhas.join('; ')}.`;
}
const textoDoItem = (t) => (t.length > exports.MAX_ITEM_CERTIDAO ? `${t.slice(0, exports.MAX_ITEM_CERTIDAO - 40).trimEnd()}… (íntegra no registro do ato)` : t);
exports.textoDoItem = textoDoItem;
/** O item ainda cabe na folha da certidão pendente? */
const cabeNaCertidao = (itens, item, abertura) => textoCertidao([...itens, item], abertura).length <= exports.MAX_TEXTO_CERTIDAO;
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