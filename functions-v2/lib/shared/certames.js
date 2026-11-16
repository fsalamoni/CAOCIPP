"use strict";
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
exports.MAX_APOIO = exports.PROVIMENTOS = exports.julgamentoConcluido = exports.proximoDoDesempate = exports.proximaVez = exports.ofertaMelhor = exports.ETAPAS_JULGAMENTO = exports.SITUACOES_JULGAMENTO = exports.MAX_ARQUIVOS_CONVOCACAO = exports.DIAS_RECURSO = exports.HORAS_CONVOCACAO = exports.MINUTOS_INTENCAO = exports.MINUTOS_DESEMPATE = exports.MARGEM_EMPATE_FICTO = exports.valorTexto = exports.totalDoValor = exports.fimDosLances = exports.SEGUNDOS_ENTRE_LANCES = exports.SEGUNDOS_PARA_DESFAZER = exports.moeda = exports.instanteDaAbertura = exports.num = exports.DECLARACOES = exports.HORAS_LANCES = exports.DIAS_UTEIS_MINIMOS = exports.MAX_FORNECEDORES = exports.MAX_CONVITES = exports.MAX_ITENS = exports.SITUACOES_CERTAME = exports.RESULTADOS_DISPUTA = exports.PORTES = exports.UNIDADES_DISPUTA = exports.CRITERIOS = exports.PERFIS_DISPUTA = void 0;
exports.sanitizeDisputaDaAcao = sanitizeDisputaDaAcao;
exports.aberturaMinima = aberturaMinima;
exports.sanitizeDadosCertame = sanitizeDadosCertame;
exports.problemasParaPublicar = problemasParaPublicar;
exports.unidadesDeDisputa = unidadesDeDisputa;
exports.valorEstimado = valorEstimado;
exports.sanitizeLicitante = sanitizeLicitante;
exports.sanitizeProposta = sanitizeProposta;
exports.valorNaUnidade = valorNaUnidade;
exports.alertasDaProposta = alertasDaProposta;
exports.textoDoAviso = textoDoAviso;
exports.codigoDoAviso = codigoDoAviso;
exports.momentoDaDisputa = momentoDaDisputa;
exports.valorDaProposta = valorDaProposta;
exports.problemaDoLance = problemaDoLance;
exports.ordenarPosicoes = ordenarPosicoes;
exports.posicaoDe = posicaoDe;
exports.candidatosDoDesempate = candidatosDoDesempate;
exports.abrirUnidade = abrirUnidade;
exports.fimDoDesempate = fimDoDesempate;
exports.aplicarDesempate = aplicarDesempate;
exports.resultadoDaDisputa = resultadoDaDisputa;
exports.fimDoPrazoUtil = fimDoPrazoUtil;
exports.momentoDoRecurso = momentoDoRecurso;
exports.linhaDaUnidade = linhaDaUnidade;
exports.textoDaAta = textoDaAta;
exports.podeNaDisputa = podeNaDisputa;
exports.uidsDaEquipe = uidsDaEquipe;
exports.papeisNaEquipe = papeisNaEquipe;
exports.podeObservar = podeObservar;
exports.textoDaEquipe = textoDaEquipe;
/**
 * Disputa de preços como ação do rito (`pede: 'disputa'`), S11: o certame.
 * A unidade que tem o processo monta o aviso (objeto, itens, critério, prazo)
 * e o publica; fornecedores entram por convite (cotação privada) ou pelo link
 * do aviso (dispensa eletrônica, IN SEGES/ME 67/2021) e enviam a proposta.
 * Até a abertura, o conteúdo das propostas é sigiloso: o órgão sabe só quantas
 * chegaram. A sala de lances (S12) e o julgamento com o resultado (S13) estão
 * no fim deste arquivo.
 *
 * Lógica pura; o servidor grava. Ver docs/PROCESSO_ELETRONICO.md.
 */
const secretaria_1 = require("./secretaria");
const camposProcesso_1 = require("./camposProcesso");
exports.PERFIS_DISPUTA = { cotacao: 'Cotação privada', dispensa: 'Dispensa eletrônica' };
exports.CRITERIOS = { menor_preco: 'menor preço', maior_desconto: 'maior desconto' };
exports.UNIDADES_DISPUTA = { item: 'por item', lote: 'por lote' };
exports.PORTES = { me_epp: 'microempresa ou empresa de pequeno porte', demais: 'demais empresas ou pessoa física' };
/** Saídas da ação no rito (decidem o caminho, como os resultados do julgamento). */
exports.RESULTADOS_DISPUTA = ['Homologada', 'Deserta', 'Fracassada'];
exports.SITUACOES_CERTAME = {
    rascunho: 'Em montagem', publicado: 'Recebendo propostas', em_disputa: 'Em disputa', encerrado: 'Encerrado', cancelado: 'Cancelado',
};
exports.MAX_ITENS = 200;
exports.MAX_CONVITES = 100;
exports.MAX_FORNECEDORES = 500;
/** Dias úteis mínimos entre a publicação e a abertura: IN 67/2021, art. 6º, parágrafo único (dispensa); 1 na cotação privada. */
exports.DIAS_UTEIS_MINIMOS = { cotacao: 1, dispensa: 3 };
/** Duração dos lances, em horas: IN 67/2021, art. 11 (6 a 10 h na dispensa). */
exports.HORAS_LANCES = { cotacao: [1, 10], dispensa: [6, 10] };
/** Declarações do fornecedor (IN 67/2021, art. 8º; IN 73/2022, art. 18, § 2º). As marcadas com `!` são obrigatórias. */
exports.DECLARACOES = [
    ['conformidade', 'A proposta atende a todas as exigências do aviso e o preço inclui todos os custos da contratação.', true],
    ['habilitacao', 'Cumpro os requisitos de habilitação e respondo pela veracidade das informações e dos documentos.', true],
    ['impedimento', 'Não estou impedido de licitar ou contratar com a Administração.', true],
    ['trabalho_menor', 'Não emprego menor de 18 anos em trabalho noturno, perigoso ou insalubre, nem menor de 16, salvo aprendiz a partir de 14.', true],
    ['meepp', 'Sou microempresa ou empresa de pequeno porte e cumpro os requisitos da Lei Complementar 123/2006 para o tratamento diferenciado.', false],
];
const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/\./g, '').replace(',', '.')) : NaN);
exports.num = num;
/** Até 4 casas decimais (IN 73/2022 e manual do fornecedor). */
const casas4 = (n) => Math.round(n * 10000) / 10000;
const ehData = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));
function sanitizeDisputaDaAcao(raw, acao) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const perfil = String(r.perfil || 'cotacao');
    if (!exports.PERFIS_DISPUTA[perfil])
        throw new Error(`A ação "${acao}" faz disputa de preços: tipo de disputa desconhecido`);
    return { perfil: perfil };
}
/** Primeiro dia possível para a abertura: n dias úteis depois de `hoje` (AAAA-MM-DD). */
function aberturaMinima(perfil, hoje, cal) {
    var _a;
    const d = new Date(`${hoje}T00:00:00Z`);
    let n = (_a = exports.DIAS_UTEIS_MINIMOS[perfil]) !== null && _a !== void 0 ? _a : 1;
    while (n > 0) {
        d.setUTCDate(d.getUTCDate() + 1);
        if ((0, secretaria_1.diaUtil)(d, cal))
            n--;
    }
    // A contagem é de dias úteis inteiros; a abertura no dia seguinte ao último.
    d.setUTCDate(d.getUTCDate() + 1);
    while (!(0, secretaria_1.diaUtil)(d, cal))
        d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}
/** Instante (ISO, UTC) da abertura, a partir da data e hora de Brasília (UTC-3, sem horário de verão). */
const instanteDaAbertura = (d) => new Date(`${d.abertura_data}T${d.abertura_hora}:00-03:00`).toISOString();
exports.instanteDaAbertura = instanteDaAbertura;
/** Confere o aviso como a unidade o monta. Lança com mensagem. Não confere prazo (só na publicação). */
function sanitizeDadosCertame(raw, perfil) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const objeto = (0, secretaria_1.texto)(r.objeto, 2000);
    const criterio = String(r.criterio || 'menor_preco');
    if (!exports.CRITERIOS[criterio])
        throw new Error('Critério de julgamento desconhecido');
    const unidade = String(r.unidade_disputa || 'item');
    if (!exports.UNIDADES_DISPUTA[unidade])
        throw new Error('Diga se a disputa é por item ou por lote');
    const brutos = Array.isArray(r.itens) ? r.itens : [];
    if (brutos.length > exports.MAX_ITENS)
        throw new Error(`Até ${exports.MAX_ITENS} itens por disputa`);
    const ids = new Set();
    const itens = brutos.map((x, i) => {
        const o = (x && typeof x === 'object' ? x : {});
        const n = i + 1;
        const descricao = (0, secretaria_1.texto)(o.descricao, 500);
        if (descricao.length < 3)
            throw new Error(`Descreva o item ${n}`);
        const quantidade = casas4((0, exports.num)(o.quantidade));
        if (!(quantidade > 0) || quantidade > 1e9)
            throw new Error(`Informe a quantidade do item ${n}`);
        const est = o.valor_estimado === '' || o.valor_estimado == null ? NaN : (0, exports.num)(o.valor_estimado);
        if (!Number.isNaN(est) && !(est > 0 && est < 1e12))
            throw new Error(`Valor estimado do item ${n} inválido`);
        const lote = unidade === 'lote' ? Math.trunc((0, exports.num)(o.lote)) : NaN;
        if (unidade === 'lote' && !(lote >= 1 && lote <= 99))
            throw new Error(`Diga em que lote está o item ${n} (1 a 99)`);
        let id = typeof o.id === 'string' && /^[a-z0-9]{1,12}$/.test(o.id) ? o.id : `i${n}`;
        while (ids.has(id))
            id = `${id}x`;
        ids.add(id);
        return Object.assign(Object.assign(Object.assign({ id, numero: n, descricao, unidade: (0, secretaria_1.texto)(o.unidade, 30) || 'unidade', quantidade }, (Number.isNaN(est) ? {} : { valor_estimado: casas4(est) })), (unidade === 'lote' ? { lote } : {})), (o.exclusivo_meepp === true ? { exclusivo_meepp: true } : {}));
    });
    const iv = (r.intervalo && typeof r.intervalo === 'object' ? r.intervalo : {});
    const ivTipo = iv.tipo === 'valor' ? 'valor' : 'percentual';
    const ivValor = iv.valor === '' || iv.valor == null ? 0 : casas4((0, exports.num)(iv.valor));
    if (!(ivValor >= 0) || (ivTipo === 'percentual' && ivValor > 50))
        throw new Error('Intervalo mínimo entre lances inválido (percentual de 0 a 50)');
    const abertura_data = String(r.abertura_data || '');
    const abertura_hora = String(r.abertura_hora || '');
    if (abertura_data && !ehData(abertura_data))
        throw new Error('Data da abertura inválida');
    if (abertura_hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(abertura_hora))
        throw new Error('Hora da abertura inválida (hh:mm)');
    const lances = perfil === 'dispensa' ? true : r.lances === true;
    const [hMin, hMax] = exports.HORAS_LANCES[perfil];
    const horas = r.horas_lances == null || r.horas_lances === '' ? hMin : Math.trunc((0, exports.num)(r.horas_lances));
    if (lances && !(horas >= hMin && horas <= hMax))
        throw new Error(`Os lances duram de ${hMin} a ${hMax} horas${perfil === 'dispensa' ? ' na dispensa eletrônica (IN 67/2021, art. 11)' : ''}`);
    return {
        objeto, criterio: criterio, unidade_disputa: unidade, itens,
        intervalo: { tipo: ivTipo, valor: ivValor }, orcamento_sigiloso: r.orcamento_sigiloso === true,
        abertura_data, abertura_hora, lances, horas_lances: lances ? horas : 0,
        condicoes: (0, secretaria_1.texto)(r.condicoes, 4000), habilitacao: (0, secretaria_1.texto)(r.habilitacao, 4000),
    };
}
/** O que falta para publicar; lista vazia quando pode. `hoje` em AAAA-MM-DD. */
function problemasParaPublicar(d, perfil, hoje, cal) {
    const out = [];
    if (d.objeto.length < 10)
        out.push('Descreva o objeto (ao menos 10 letras)');
    if (!d.itens.length)
        out.push('Inclua ao menos um item');
    if (!d.abertura_data || !d.abertura_hora)
        out.push('Informe a data e a hora da abertura');
    else {
        const min = aberturaMinima(perfil, hoje, cal);
        if (d.abertura_data < min)
            out.push(`A abertura precisa ser a partir de ${min.split('-').reverse().join('/')} (${exports.DIAS_UTEIS_MINIMOS[perfil]} dia${exports.DIAS_UTEIS_MINIMOS[perfil] > 1 ? 's' : ''} út${exports.DIAS_UTEIS_MINIMOS[perfil] > 1 ? 'eis' : 'il'} depois da publicação${perfil === 'dispensa' ? ', IN 67/2021, art. 6º' : ''})`);
        else if (!(0, secretaria_1.diaUtil)(new Date(`${d.abertura_data}T00:00:00Z`), cal))
            out.push('A abertura precisa ser em dia útil');
        if (d.abertura_hora < '08:00' || d.abertura_hora > '18:00')
            out.push('A abertura precisa ser em horário comercial (8h às 18h)');
    }
    if (d.criterio === 'maior_desconto' && d.itens.some((i) => i.valor_estimado == null))
        out.push('No maior desconto, informe o preço de referência de cada item (o desconto é sobre ele)');
    return out;
}
/** Lotes da disputa com os itens de cada um (por item: um "lote" por item). */
function unidadesDeDisputa(d) {
    if (d.unidade_disputa === 'item')
        return d.itens.map((i) => ({ chave: i.id, nome: `Item ${i.numero}`, itens: [i] }));
    const lotes = [...new Set(d.itens.map((i) => i.lote || 1))].sort((a, b) => a - b);
    return lotes.map((l) => ({ chave: `l${l}`, nome: `Lote ${l}`, itens: d.itens.filter((i) => (i.lote || 1) === l) }));
}
/** Valor estimado da disputa (soma de quantidade x valor dos itens que têm), ou null. */
function valorEstimado(itens) {
    const com = itens.filter((i) => i.valor_estimado != null);
    return com.length ? casas4(com.reduce((s, i) => s + i.quantidade * (i.valor_estimado || 0), 0)) : null;
}
/** Confere o cadastro do fornecedor. Lança com mensagem. */
function sanitizeLicitante(raw, email) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const razao = (0, secretaria_1.texto)(r.razao_social, 200);
    if (razao.length < 3)
        throw new Error('Informe o nome ou a razão social');
    const documento = (0, camposProcesso_1.cpfCnpj)(String(r.documento || ''));
    if (!documento)
        throw new Error('CPF ou CNPJ inválido');
    const porte = r.porte === 'me_epp' ? 'me_epp' : 'demais';
    return { razao_social: razao, documento, porte, email: (0, secretaria_1.texto)(email, 120), representante: (0, secretaria_1.texto)(r.representante, 120) };
}
/**
 * Confere a proposta contra o aviso. Lança com mensagem. Por lote, cota todos
 * os itens do lote ou nenhum; item exclusivo só aceita ME/EPP. No maior
 * desconto, o valor é o percentual (0 a 100, exclusive).
 */
function sanitizeProposta(raw, d, licitante) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const brutos = Array.isArray(r.itens) ? r.itens : [];
    const porId = new Map(d.itens.map((i) => [i.id, i]));
    const vistos = new Set();
    const itens = [];
    for (const x of brutos) {
        const o = (x && typeof x === 'object' ? x : {});
        const item = porId.get(String(o.item_id));
        if (!item || vistos.has(item.id))
            continue;
        if (o.valor === '' || o.valor == null)
            continue;
        const valor = casas4((0, exports.num)(o.valor));
        if (d.criterio === 'maior_desconto' ? !(valor > 0 && valor < 100) : !(valor > 0 && valor < 1e12)) {
            throw new Error(`Item ${item.numero}: ${d.criterio === 'maior_desconto' ? 'informe o desconto em percentual (maior que 0 e menor que 100)' : 'informe o valor unitário'}`);
        }
        if (item.exclusivo_meepp && licitante.porte !== 'me_epp')
            throw new Error(`O item ${item.numero} é exclusivo para microempresa e empresa de pequeno porte`);
        vistos.add(item.id);
        itens.push(Object.assign(Object.assign(Object.assign({ item_id: item.id, valor }, ((0, secretaria_1.texto)(o.marca, 120) ? { marca: (0, secretaria_1.texto)(o.marca, 120) } : {})), ((0, secretaria_1.texto)(o.modelo, 120) ? { modelo: (0, secretaria_1.texto)(o.modelo, 120) } : {})), ((0, secretaria_1.texto)(o.descricao, 1000) ? { descricao: (0, secretaria_1.texto)(o.descricao, 1000) } : {})));
    }
    if (!itens.length)
        throw new Error('Cote ao menos um item');
    if (d.unidade_disputa === 'lote') {
        for (const u of unidadesDeDisputa(d)) {
            const cotados = u.itens.filter((i) => vistos.has(i.id)).length;
            if (cotados && cotados < u.itens.length)
                throw new Error(`${u.nome}: cote todos os itens do lote ou nenhum`);
        }
    }
    const marcadas = new Set((Array.isArray(r.declaracoes) ? r.declaracoes : []).map(String));
    const faltam = exports.DECLARACOES.filter(([id, , obrig]) => obrig && !marcadas.has(id));
    if (faltam.length)
        throw new Error('Marque as declarações obrigatórias');
    if (licitante.porte === 'me_epp' && !marcadas.has('meepp'))
        throw new Error('Quem se declara microempresa ou empresa de pequeno porte marca a declaração correspondente');
    const declaracoes = exports.DECLARACOES.map(([id]) => id).filter((id) => marcadas.has(id) && (id !== 'meepp' || licitante.porte === 'me_epp'));
    return { itens, declaracoes };
}
/** Valor da proposta numa unidade de disputa (lote: soma de quantidade x unitário). Null se não cotou. */
function valorNaUnidade(p, u, criterio) {
    const vals = u.itens.map((i) => p.itens.find((x) => x.item_id === i.id));
    if (vals.some((v) => !v))
        return null;
    if (criterio === 'maior_desconto')
        return casas4(vals.reduce((s, v) => s + v.valor, 0) / vals.length);
    return casas4(u.itens.reduce((s, i, k) => s + i.quantidade * vals[k].valor, 0));
}
/** Alertas (não bloqueiam) da proposta: valor abaixo de 50% do estimado (indício de inexequibilidade). */
function alertasDaProposta(p, d) {
    if (d.criterio !== 'menor_preco' || d.orcamento_sigiloso)
        return [];
    return p.itens.flatMap((x) => {
        const i = d.itens.find((y) => y.id === x.item_id);
        return (i === null || i === void 0 ? void 0 : i.valor_estimado) && x.valor < i.valor_estimado * 0.5 ? [`Item ${i.numero}: o valor está abaixo da metade do estimado`] : [];
    });
}
const moeda = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
exports.moeda = moeda;
const brData = (s) => s.split('-').reverse().join('/');
/** Texto do aviso, para os autos e para os fornecedores. O valor estimado sai quando o orçamento não é sigiloso. */
function textoDoAviso(perfil, d, numero, unidade) {
    const linhas = [
        `${exports.PERFIS_DISPUTA[perfil]} · Processo ${numero} · ${unidade}`,
        `Objeto: ${d.objeto}`,
        `Julgamento pelo ${exports.CRITERIOS[d.criterio]}, ${exports.UNIDADES_DISPUTA[d.unidade_disputa]}.`,
        `Propostas até ${brData(d.abertura_data)}, às ${d.abertura_hora} (horário de Brasília), pela plataforma.`
            + (d.lances ? ` Em seguida, lances por ${d.horas_lances} hora${d.horas_lances > 1 ? 's' : ''}${d.intervalo.valor ? `, com intervalo mínimo de ${d.intervalo.tipo === 'valor' ? moeda(d.intervalo.valor) : `${String(d.intervalo.valor).replace('.', ',')}%`} entre lances` : ''}.` : ' Sem fase de lances: vale a proposta.'),
        'Itens:',
        ...d.itens.map((i) => `${i.numero}. ${i.descricao} · ${String(i.quantidade).replace('.', ',')} ${i.unidade}${i.lote ? ` · lote ${i.lote}` : ''}${i.exclusivo_meepp ? ' · exclusivo ME/EPP' : ''}${!d.orcamento_sigiloso && i.valor_estimado != null ? ` · ${d.criterio === 'maior_desconto' ? 'preço de referência' : 'valor estimado unitário'} ${moeda(i.valor_estimado)}` : ''}`),
        ...(d.orcamento_sigiloso ? ['O orçamento estimado é sigiloso e será divulgado depois do julgamento.'] : []),
        ...(d.condicoes ? [`Condições da contratação: ${d.condicoes}`] : []),
        ...(d.habilitacao ? [`Habilitação: ${d.habilitacao}`] : []),
    ];
    return linhas.join('\n');
}
/** Código curto do aviso para o link público (sem letras que se confundem). */
function codigoDoAviso(bytes) {
    const ALF = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(bytes.slice(0, 8), (b) => ALF[b % ALF.length]).join('');
}
// ─── Sala de lances (S12) ─────────────────────────────────────────────────
/** O licitante desfaz o próprio último lance uma vez por item ou lote, em até 15 segundos (IN 73/2022, art. 21, § 3º). */
exports.SEGUNDOS_PARA_DESFAZER = 15;
/** Intervalo mínimo entre dois lances do mesmo licitante, contra cliques repetidos. */
exports.SEGUNDOS_ENTRE_LANCES = 3;
/** Fim da fase de lances (ISO), ou undefined sem lances. A dispensa não prorroga (IN 67/2021, art. 11). */
const fimDosLances = (x) => (x.abertura_em && x.lances ? new Date(Date.parse(x.abertura_em) + x.horas_lances * 3600e3).toISOString() : undefined);
exports.fimDosLances = fimDosLances;
/** Em que ponto está a disputa publicada: recebendo propostas, em lances ou encerrada (sem lances, encerra na abertura). */
function momentoDaDisputa(x, agora) {
    if (!x.abertura_em || agora < x.abertura_em)
        return 'propostas';
    const fim = (0, exports.fimDosLances)(x);
    return fim && agora < fim ? 'lances' : 'encerrada';
}
const unitario = (d) => d.criterio === 'menor_preco' && d.unidade_disputa === 'item';
const totalDoValor = (v, u, d) => (unitario(d) ? casas4(v * u.itens[0].quantidade) : casas4(v));
exports.totalDoValor = totalDoValor;
/** O valor da proposta na unidade, no que o licitante digita no lance. Null se não cotou. */
function valorDaProposta(p, u, d) {
    const t = valorNaUnidade(p, u, d.criterio);
    if (t == null)
        return null;
    return unitario(d) ? p.itens.find((x) => x.item_id === u.itens[0].id).valor : t;
}
const valorTexto = (v, d) => (d.criterio === 'maior_desconto' ? `${String(v).replace('.', ',')}%` : moeda(v));
exports.valorTexto = valorTexto;
/**
 * Confere o lance contra o último valor do próprio licitante (lance intermediário
 * vale: não precisa vencer o melhor). Devolve o problema, ou '' quando vale.
 * No desconto, o intervalo é em pontos percentuais.
 */
function problemaDoLance(valor, atual, d) {
    var _a, _b;
    const desc = d.criterio === 'maior_desconto';
    if (!Number.isFinite(valor) || valor <= 0 || valor >= 1e12)
        return 'Informe o valor do lance';
    if (desc && valor >= 100)
        return 'O desconto precisa ser menor que 100%';
    const iv = ((_a = d.intervalo) === null || _a === void 0 ? void 0 : _a.valor) || 0;
    const passo = desc || ((_b = d.intervalo) === null || _b === void 0 ? void 0 : _b.tipo) === 'valor' ? iv : casas4((atual * iv) / 100);
    if (desc ? !(valor > atual) : !(valor < atual))
        return `O lance precisa ser ${desc ? 'maior' : 'menor'} que o seu último (${(0, exports.valorTexto)(atual, d)})`;
    const limite = casas4(desc ? atual + passo : atual - passo);
    if (passo > 0 && (desc ? valor < limite : valor > limite)) {
        return `Respeite o intervalo mínimo entre lances: ${desc ? 'ao menos' : 'no máximo'} ${(0, exports.valorTexto)(limite, d)}`;
    }
    return '';
}
/** Ordena as posições: menor total (ou maior desconto); empate, quem chegou antes ao valor (IN 67/2021, art. 12, § 1º). */
function ordenarPosicoes(ps, d) {
    const desc = d.criterio === 'maior_desconto';
    return [...ps].sort((a, b) => (desc ? b.total - a.total : a.total - b.total) || a.em.localeCompare(b.em) || a.seq - b.seq);
}
/** Posição de um licitante: o último lance não excluído, ou a proposta. Null se não cotou a unidade. */
function posicaoDe(uid, p, u, d, lances) {
    const base = valorDaProposta(p, u, d);
    if (base == null)
        return null;
    const ult = lances.filter((l) => l.uid === uid && l.chave === u.chave && !l.excluido).sort((a, b) => a.seq - b.seq).at(-1);
    return ult ? { uid, valor: ult.valor, total: ult.total, em: ult.em, seq: ult.seq } : { uid, valor: base, total: (0, exports.totalDoValor)(base, u, d), em: p.atualizada_em, seq: 0 };
}
// ─── Julgamento e resultado (S13) ─────────────────────────────────────────
/** Empate ficto: ME/EPP até 5% acima da melhor oferta (LC 123/2006, art. 44, § 2º), com 5 minutos para cobrir (art. 45, § 3º). */
exports.MARGEM_EMPATE_FICTO = 0.05;
exports.MINUTOS_DESEMPATE = 5;
/** Janela da intenção de recurso, em minutos: ao menos 10, logo depois de declarado o vencedor (Lei 14.133/2021, art. 165, § 1º, I). */
exports.MINUTOS_INTENCAO = [10, 60];
/** Prazo para enviar proposta ajustada ou documentos de habilitação, em horas (IN SEGES 73/2022: ao menos 2 horas). */
exports.HORAS_CONVOCACAO = [2, 72];
/** Razões e contrarrazões: 3 dias úteis cada (Lei 14.133/2021, art. 165, I e § 4º). */
exports.DIAS_RECURSO = 3;
exports.MAX_ARQUIVOS_CONVOCACAO = 10;
exports.SITUACOES_JULGAMENTO = {
    desempate: 'Em desempate (ME/EPP)', analise: 'Proposta em análise', aceita: 'Proposta aceita, habilitação em análise',
    habilitada: 'Vencedor habilitado', fracassada: 'Fracassado', deserta: 'Deserto',
};
exports.ETAPAS_JULGAMENTO = {
    julgamento: 'Julgamento e habilitação', recurso: 'Prazo de recurso', resultado: 'Pronto para o resultado', encerrado: 'Encerrado',
};
const melhor = (a, b, d) => (d.criterio === 'maior_desconto' ? a > b : a < b);
exports.ofertaMelhor = melhor;
/**
 * ME/EPP em empate ficto com a primeira colocada, na ordem de classificação.
 * Não há empate ficto se a primeira já é ME/EPP. No desconto, compara-se o
 * preço equivalente (100 menos o desconto).
 */
function candidatosDoDesempate(ordem, d) {
    const [primeira, ...resto] = ordem;
    if (!primeira || primeira.porte === 'me_epp')
        return [];
    const preco = (c) => (d.criterio === 'maior_desconto' ? 100 - c.total : c.total);
    const limite = preco(primeira) * (1 + exports.MARGEM_EMPATE_FICTO);
    return resto.filter((c) => c.porte === 'me_epp' && preco(c) <= limite + 1e-9).map((c) => c.uid);
}
/** Abre o julgamento de uma unidade a partir das posições finais. */
function abrirUnidade(ordem, d) {
    if (!ordem.length)
        return { situacao: 'deserta', ordem, vez: null, recusas: [] };
    const candidatos = candidatosDoDesempate(ordem, d);
    return candidatos.length
        ? { situacao: 'desempate', ordem, vez: null, recusas: [], desempate: { candidatos, feitos: [] } }
        : { situacao: 'analise', ordem, vez: ordem[0].uid, recusas: [] };
}
/** Próximo a analisar: o melhor classificado ainda não recusado. */
const proximaVez = (u) => { var _a; return ((_a = u.ordem.find((c) => !u.recusas.some((r) => r.uid === c.uid))) === null || _a === void 0 ? void 0 : _a.uid) || null; };
exports.proximaVez = proximaVez;
/** Próximo candidato do desempate ainda não chamado (ou null: o desempate acabou). */
const proximoDoDesempate = (u) => { var _a; return ((_a = u.desempate) === null || _a === void 0 ? void 0 : _a.candidatos.find((x) => !u.desempate.feitos.includes(x))) || null; };
exports.proximoDoDesempate = proximoDoDesempate;
/** Encerra o desempate sem oferta vencedora: vai à análise a primeira colocada. */
function fimDoDesempate(u) {
    const { desempate: _d } = u, resto = __rest(u, ["desempate"]);
    return Object.assign(Object.assign({}, resto), { situacao: 'analise', vez: (0, exports.proximaVez)(u) });
}
/** Oferta da ME/EPP no desempate: precisa ser melhor que a primeira; se for, passa à frente e vai à análise. */
function aplicarDesempate(u, uid, valor, total, em, d) {
    const primeira = u.ordem[0];
    if (!melhor(total, primeira.total, d))
        return `A oferta precisa ser ${d.criterio === 'maior_desconto' ? 'maior' : 'menor'} que a da primeira colocada (${(0, exports.valorTexto)(primeira.total, d)})`;
    const eu = u.ordem.find((c) => c.uid === uid);
    const ordem = [Object.assign(Object.assign({}, eu), { valor, total, em, desempate: true }), ...u.ordem.filter((c) => c.uid !== uid)];
    const { desempate: _d } = u, resto = __rest(u, ["desempate"]);
    return Object.assign(Object.assign({}, resto), { ordem, situacao: 'analise', vez: uid });
}
/** Todas as unidades decididas: pode declarar o vencedor (ou concluir sem ele). */
const julgamentoConcluido = (us) => us.every((u) => ['habilitada', 'fracassada', 'deserta'].includes(u.situacao));
exports.julgamentoConcluido = julgamentoConcluido;
/** Resultado da disputa: homologada se há vencedor em ao menos uma unidade; deserta se ninguém propôs; fracassada nos demais casos. */
function resultadoDaDisputa(us) {
    if (us.some((u) => u.situacao === 'habilitada'))
        return 'Homologada';
    return us.every((u) => u.situacao === 'deserta') ? 'Deserta' : 'Fracassada';
}
/** Fim do dia útil (23:59 de Brasília) do vencimento de n dias úteis contados de `inicio` (AAAA-MM-DD). */
function fimDoPrazoUtil(inicio, n, cal) {
    const d = new Date(`${inicio}T00:00:00Z`);
    let k = n;
    while (k > 0) {
        d.setUTCDate(d.getUTCDate() + 1);
        if ((0, secretaria_1.diaUtil)(d, cal))
            k--;
    }
    return new Date(`${d.toISOString().slice(0, 10)}T23:59:59-03:00`).toISOString();
}
exports.PROVIMENTOS = { nao: 'Negado provimento', sim: 'Dado provimento', parcial: 'Dado provimento em parte' };
/** Em que ponto está o recurso: intenção, razões, contrarrazões, decisão, ou sem recurso (ninguém manifestou). */
function momentoDoRecurso(r, agora) {
    if (r.decisao)
        return 'decidido';
    if (r.encaminhado)
        return 'autoridade';
    if (agora <= r.intencao_ate)
        return 'intencao';
    if (!r.intencoes.length)
        return 'sem_recurso';
    if (agora <= r.razoes_ate)
        return 'razoes';
    // Ninguém arrazoou: o recurso não segue (decide-se já).
    if (!r.intencoes.some((i) => i.razoes))
        return 'decisao';
    return agora <= r.contrarrazoes_ate ? 'contrarrazoes' : 'decisao';
}
/** Linha de cada unidade para a certidão e o resumo: vencedor e valor, ou o desfecho. */
function linhaDaUnidade(nome, u, quem, d) {
    if (u.situacao === 'habilitada' && u.habilitada)
        return `${nome}: ${quem(u.habilitada.uid)}, ${(0, exports.valorTexto)(u.habilitada.total, d)}`;
    return `${nome}: ${u.situacao === 'deserta' ? 'deserto (sem proposta)' : 'fracassado (nenhuma proposta aceita e habilitada)'}`;
}
/** Ata da disputa: o que aconteceu em cada unidade, o recurso e o resultado. Texto puro, nos autos. */
function textoDaAta(x, unidades, quem, recursos, resultado, lances) {
    const br = (iso) => {
        const d = new Date(Date.parse(iso) - 3 * 3600e3).toISOString();
        return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}, ${d.slice(11, 16)}`;
    };
    const l = [`ATA DA ${exports.PERFIS_DISPUTA[x.perfil].toUpperCase()}`, `Processo ${x.processo_numero}. Objeto: ${x.objeto}.`];
    if (x.abertura_em)
        l.push(`Abertura em ${br(x.abertura_em)} (horário de Brasília)${lances ? `, com ${lances} lance${lances === 1 ? '' : 's'}` : ', sem fase de lances'}.`);
    for (const { nome, u } of unidades) {
        l.push('', `${nome}`);
        if (!u.ordem.length) {
            l.push('Sem proposta: deserto.');
            continue;
        }
        l.push(...u.ordem.map((c, k) => `${k + 1}º ${quem(c.uid)}${c.porte === 'me_epp' ? ' (ME/EPP)' : ''}: ${(0, exports.valorTexto)(c.total, x)}${c.desempate ? ', oferta de desempate' : ''}${c.negociado ? ', após negociação' : ''}`));
        for (const r of u.recusas)
            l.push(`${r.etapa === 'proposta' ? 'Proposta recusada' : 'Inabilitado'}: ${quem(r.uid)}. Motivo: ${r.motivo}`);
        l.push(linhaDaUnidade('Desfecho', u, quem, x) + '.');
    }
    recursos.forEach((r, k) => {
        l.push('', recursos.length > 1 ? `Recurso (${k + 1}ª rodada)` : 'Recurso');
        if (!r.intencoes.length) {
            l.push(`Aberta a intenção de recurso até ${br(r.intencao_ate)}, ninguém manifestou.`);
            return;
        }
        for (const i of r.intencoes)
            l.push(`Intenção de ${i.nome}: ${i.motivo}${i.razoes ? ' (razões apresentadas)' : ' (sem razões no prazo)'}`);
        if (r.contrarrazoes.length)
            l.push(`Contrarrazões de ${r.contrarrazoes.map((c) => c.nome).join(', ')}.`);
        if (r.encaminhado)
            l.push(`Mantida a decisão por ${r.encaminhado.por}, que encaminhou o recurso à autoridade superior: ${r.encaminhado.fundamentos}`);
        if (r.decisao)
            l.push(`Decisão${r.encaminhado ? ' da autoridade superior' : ''}: ${exports.PROVIMENTOS[r.decisao.provimento]}. ${r.decisao.fundamentos}`);
    });
    l.push('', `Resultado: ${resultado}.`);
    return l.join('\n');
}
exports.MAX_APOIO = 10;
function podeNaDisputa(eq, uid, posse, ato) {
    var _a;
    const conduz = (eq === null || eq === void 0 ? void 0 : eq.agente) ? eq.agente.uid === uid : posse;
    if (ato === 'conduzir')
        return conduz;
    if (ato === 'conversar')
        return conduz || !!((_a = eq === null || eq === void 0 ? void 0 : eq.apoio) === null || _a === void 0 ? void 0 : _a.some((m) => m.uid === uid));
    return (eq === null || eq === void 0 ? void 0 : eq.autoridade) ? eq.autoridade.uid === uid : conduz;
}
function uidsDaEquipe(eq) {
    var _a, _b;
    if (!eq)
        return [];
    return [...new Set([(_a = eq.agente) === null || _a === void 0 ? void 0 : _a.uid, (_b = eq.autoridade) === null || _b === void 0 ? void 0 : _b.uid, ...eq.apoio.map((m) => m.uid)].filter((v) => !!v))];
}
/** Papéis de alguém na equipe, para a tela e a lista "Minhas disputas". */
function papeisNaEquipe(eq, uid) {
    var _a, _b;
    if (!eq)
        return [];
    return [((_a = eq.agente) === null || _a === void 0 ? void 0 : _a.uid) === uid && 'Agente de contratação', eq.apoio.some((m) => m.uid === uid) && 'Equipe de apoio', ((_b = eq.autoridade) === null || _b === void 0 ? void 0 : _b.uid) === uid && 'Autoridade superior']
        .filter((v) => !!v);
}
/**
 * Observador (S14): na dispensa, cujo aviso é público, qualquer conta acompanha
 * a sessão pública depois da abertura (lances por apelido, avisos do agente,
 * julgamento e ata). Na cotação privada, só quem participa.
 */
function podeObservar(x, uid, agora) {
    if ((x.fornecedores_uids || []).includes(uid))
        return true;
    return x.perfil === 'dispensa' && !!x.abertura_em && x.abertura_em <= agora && (x.situacao === 'publicado' || x.situacao === 'encerrado');
}
/** Texto do ato de designação, para os autos. */
function textoDaEquipe(eq) {
    var _a, _b;
    return [
        `Agente de contratação: ${((_a = eq.agente) === null || _a === void 0 ? void 0 : _a.nome) || 'não designado (conduz quem tem o processo)'}.`,
        `Equipe de apoio: ${eq.apoio.length ? eq.apoio.map((m) => m.nome).join(', ') : 'nenhuma'}.`,
        `Autoridade superior: ${((_b = eq.autoridade) === null || _b === void 0 ? void 0 : _b.nome) || 'não designada (o agente homologa e decide o recurso)'}.`,
    ].join('\n');
}
//# sourceMappingURL=certames.js.map