"use strict";
// ============================================================================
// shared/panorama — esquema, papéis semânticos e inferência do módulo Panorama
// ----------------------------------------------------------------------------
// O Panorama existe porque a Jurimetria resolveu um problema real (dar ao CAO
// do Júri o panorama estadual) com um modelo de dados FIXO: comarca, matéria,
// espécie de resultado, promotor. Esse modelo não serve a Improbidade, nem a
// Infância, nem a Consumidor — cada área tem suas próprias colunas.
//
// A saída é parar de perguntar "qual é a comarca?" e passar a perguntar "qual
// coluna faz o PAPEL de unidade territorial?". O órgão responde uma vez, ao
// importar, e toda a maquinaria analítica passa a funcionar sobre a planilha
// dele — sem que uma única linha de código conheça o domínio daquele órgão.
//
// Este arquivo é a autoridade do servidor sobre:
//   - quais papéis existem e o que cada um destrava;
//   - quais tipos de coluna existem e como um valor é normalizado;
//   - como INFERIR tipo, cardinalidade e papel provável a partir das linhas;
//   - como sanitizar a definição de uma base vinda do cliente.
//
// O espelho no frontend é `src/constants/panorama.js`. Mantenha os dois em
// sincronia — a inferência roda aqui, mas os rótulos aparecem lá.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PANORAMA_COR_NEUTRA = exports.PANORAMA_DEFAULT_DEF = exports.PANORAMA_PRESCRICAO_PADRAO = exports.PANORAMA_COLUMN_TYPES = exports.PANORAMA_ROLE_KEYS = exports.PANORAMA_ROLES = void 0;
exports.normalizeText = normalizeText;
exports.slugColumnKey = slugColumnKey;
exports.parseDateValue = parseDateValue;
exports.parseNumberValue = parseNumberValue;
exports.parseBooleanValue = parseBooleanValue;
exports.normalizeIdentifier = normalizeIdentifier;
exports.coerceValue = coerceValue;
exports.analyzeColumn = analyzeColumn;
exports.inferColumnType = inferColumnType;
exports.suggestRole = suggestRole;
exports.sanitizeBaseDef = sanitizeBaseDef;
exports.columnForRole = columnForRole;
exports.sanitizeRecordValues = sanitizeRecordValues;
exports.similarity = similarity;
exports.fuzzyMatchFromList = fuzzyMatchFromList;
exports.PANORAMA_ROLES = [
    {
        key: 'identificador',
        label: 'Identificador do registro',
        destrava: 'Reimportar a mesma planilha deixa de duplicar: é por esta coluna que a plataforma reconhece que o registro já existe.',
        tipos: ['texto'],
        unico: true,
    },
    {
        key: 'data_principal',
        label: 'Data principal',
        destrava: 'Série temporal, evolução mensal e anual, filtros por período.',
        tipos: ['data'],
        unico: true,
    },
    {
        key: 'data_referencia',
        label: 'Data de referência (fato/origem)',
        destrava: 'Base de contagem da prescrição, quando o prazo corre do fato e não da instauração.',
        tipos: ['data'],
        unico: true,
    },
    {
        key: 'unidade',
        label: 'Unidade territorial',
        destrava: 'Ranking por comarca/município, agrupamento por região, identificação de concentração de demanda.',
        tipos: ['texto', 'lista'],
        unico: true,
    },
    {
        key: 'responsavel',
        label: 'Responsável / membro',
        destrava: 'Distribuição de carga por promotor, atuação individual, identificação de sobrecarga.',
        tipos: ['texto', 'lista'],
        unico: true,
    },
    {
        key: 'assunto',
        label: 'Assunto / matéria',
        destrava: 'Distribuição temática, o que mais gera atuação, cruzamento assunto × território.',
        tipos: ['texto', 'lista'],
        unico: true,
    },
    {
        key: 'desfecho',
        label: 'Desfecho / resultado',
        destrava: 'Espécies de resultado, aproveitamento ponderado, cores na tabela.',
        tipos: ['texto', 'lista'],
        unico: true,
    },
    {
        key: 'situacao',
        label: 'Situação / fase',
        destrava: 'Funil de tramitação, identificação de gargalos, quantos estão parados em cada etapa.',
        tipos: ['texto', 'lista'],
        unico: true,
    },
    {
        key: 'valor',
        label: 'Valor monetário',
        destrava: 'Somatórios financeiros, valor médio, concentração de valor por território ou assunto.',
        tipos: ['moeda', 'numero'],
        unico: true,
    },
    {
        key: 'prazo',
        label: 'Data-limite / prescrição',
        destrava: 'Alerta de prescrição, ordenação por urgência, o que vence primeiro.',
        tipos: ['data'],
        unico: true,
    },
];
exports.PANORAMA_ROLE_KEYS = exports.PANORAMA_ROLES.map((r) => r.key);
exports.PANORAMA_COLUMN_TYPES = [
    'texto', 'numero', 'moeda', 'data', 'booleano', 'lista',
];
// ----------------------------------------------------------------------------
// Normalização de valores
// ----------------------------------------------------------------------------
/** Texto normalizado: minúsculo, sem acento, espaços colapsados. */
function normalizeText(value) {
    return String(value !== null && value !== void 0 ? value : '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}
/** Chave estável a partir de um cabeçalho de planilha. */
function slugColumnKey(label, taken = new Set()) {
    const base = normalizeText(label)
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'coluna';
    if (!taken.has(base))
        return base;
    // Colisão (duas colunas "Data" na mesma planilha): numera a segunda.
    for (let i = 2; i < 200; i++) {
        const candidate = `${base}_${i}`;
        if (!taken.has(candidate))
            return candidate;
    }
    return `${base}_${Date.now().toString(36)}`;
}
/**
 * Converte um valor de planilha em data ISO (`YYYY-MM-DD`), ou '' se não for
 * uma data. Aceita o serial do Excel, ISO e o formato brasileiro.
 */
function parseDateValue(raw) {
    if (raw === null || raw === undefined || raw === '')
        return '';
    if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
        return raw.toISOString().slice(0, 10);
    }
    // Serial do Excel: dias desde 1899-12-30. A faixa evita interpretar um
    // número qualquer (uma quantia, por exemplo) como se fosse data.
    if (typeof raw === 'number' && raw > 20000 && raw < 80000) {
        const ms = Math.round((raw - 25569) * 86400 * 1000);
        const d = new Date(ms);
        if (!Number.isNaN(d.getTime()))
            return d.toISOString().slice(0, 10);
    }
    const s = String(raw).trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso)
        return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(s);
    if (br) {
        const dia = Number(br[1]);
        const mes = Number(br[2]);
        let ano = Number(br[3]);
        if (ano < 100)
            ano += ano < 50 ? 2000 : 1900;
        if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12 && ano >= 1900 && ano <= 2200) {
            return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        }
    }
    return '';
}
/**
 * Converte um valor de planilha em número. Entende o formato brasileiro
 * ("1.234,56") e o americano ("1,234.56"), além de "R$" e sinal negativo.
 */
function parseNumberValue(raw) {
    if (raw === null || raw === undefined || raw === '')
        return null;
    if (typeof raw === 'number')
        return Number.isFinite(raw) ? raw : null;
    let s = String(raw).trim()
        .replace(/^R\$\s*/i, '')
        .replace(/\s/g, '');
    if (!s)
        return null;
    const negativo = /^\(.*\)$/.test(s) || s.startsWith('-');
    s = s.replace(/^[-(]|\)$/g, '');
    const temVirgula = s.includes(',');
    const temPonto = s.includes('.');
    if (temVirgula && temPonto) {
        // O separador decimal é o que aparece por ÚLTIMO.
        s = s.lastIndexOf(',') > s.lastIndexOf('.')
            ? s.replace(/\./g, '').replace(',', '.')
            : s.replace(/,/g, '');
    }
    else if (temVirgula) {
        // "1,5" é decimal; "1,234" com exatamente 3 casas é separador de milhar.
        const partes = s.split(',');
        s = (partes.length === 2 && partes[1].length === 3 && partes[0].length <= 3)
            ? s.replace(',', '')
            : s.replace(',', '.');
    }
    else if (temPonto) {
        // Mesmo dilema, do outro lado: "250.000" numa planilha brasileira é
        // duzentos e cinquenta mil, não duzentos e cinquenta. A regra é a mesma
        // usada para a vírgula — grupos de exatamente 3 dígitos depois do
        // primeiro separador são milhar; qualquer outra coisa é decimal.
        // Sem esta ramificação, "R$ 250.000" virava 250 e "R$ 1.234.567" virava
        // nulo, porque a validação final não aceita dois pontos.
        const partes = s.split('.');
        const milhar = partes.length >= 2
            && partes[0].length >= 1 && partes[0].length <= 3
            && partes.slice(1).every((g) => g.length === 3);
        if (milhar)
            s = partes.join('');
    }
    if (!/^\d*\.?\d+$/.test(s))
        return null;
    const n = Number(s);
    if (!Number.isFinite(n))
        return null;
    return negativo ? -n : n;
}
const VERDADEIROS = new Set(['sim', 's', 'true', 'verdadeiro', '1', 'x']);
const FALSOS = new Set(['nao', 'n', 'false', 'falso', '0', '']);
/** `true`/`false`, ou `null` quando o valor não é claramente booleano. */
function parseBooleanValue(raw) {
    if (typeof raw === 'boolean')
        return raw;
    const s = normalizeText(raw);
    if (VERDADEIROS.has(s))
        return true;
    if (FALSOS.has(s))
        return s !== '' ? false : null;
    return null;
}
/**
 * Chave de comparação de um identificador.
 *
 * Um número CNJ é o mesmo processo escrito com ou sem pontuação, então a
 * pontuação sai. As LETRAS ficam: "NF-2025-00001" e "PP-2025-00001" são
 * procedimentos diferentes, e descartar o prefixo faria os dois colidirem —
 * um sobrescreveria o outro na importação.
 */
function normalizeIdentifier(raw) {
    const s = String(raw !== null && raw !== void 0 ? raw : '').trim();
    if (!s)
        return '';
    const normalizado = normalizeText(s);
    // Só dígitos e pontuação: é um número (CNJ, protocolo numérico).
    if (!/[a-z]/.test(normalizado))
        return normalizado.replace(/\D/g, '');
    // Tem letra: mantém letras e dígitos, descarta apenas separadores.
    return normalizado.replace(/[^a-z0-9]/g, '');
}
/** Converte um valor bruto para a forma de armazenamento do tipo da coluna. */
function coerceValue(raw, type) {
    if (raw === null || raw === undefined)
        return null;
    switch (type) {
        case 'data': return parseDateValue(raw) || null;
        case 'numero':
        case 'moeda': return parseNumberValue(raw);
        case 'booleano': return parseBooleanValue(raw);
        default: {
            const s = String(raw).trim();
            return s ? s.slice(0, 2000) : null;
        }
    }
}
// ----------------------------------------------------------------------------
// Inferência automática
// ----------------------------------------------------------------------------
/**
 * Limite de valores distintos para uma coluna de texto ser tratada como LISTA.
 *
 * Abaixo disso a coluna é uma dimensão (serve para agrupar, filtrar, colorir);
 * acima, é texto livre. 60 cobre as 167 comarcas do RS? Não — e é de propósito:
 * a regra combina o teto absoluto com a PROPORÇÃO, porque 167 valores distintos
 * em 20.000 linhas é claramente uma dimensão, enquanto 167 em 200 linhas é
 * provavelmente texto livre.
 */
const LISTA_MAX_DISTINTOS = 300;
const LISTA_MAX_PROPORCAO = 0.5;
/** Estatísticas de uma coluna a partir dos valores brutos daquela coluna. */
function analyzeColumn(valores) {
    const distintos = new Map();
    let vazios = 0;
    let datas = 0;
    let numeros = 0;
    let moedas = 0;
    let booleanos = 0;
    for (const raw of valores) {
        const s = String(raw !== null && raw !== void 0 ? raw : '').trim();
        if (!s) {
            vazios += 1;
            continue;
        }
        distintos.set(s, (distintos.get(s) || 0) + 1);
        if (parseDateValue(raw))
            datas += 1;
        const n = parseNumberValue(raw);
        if (n !== null) {
            numeros += 1;
            // "R$" ou duas casas decimais com separador de milhar denunciam dinheiro.
            if (/R\$/i.test(s) || /\d{1,3}(\.\d{3})+,\d{2}$/.test(s) || /,\d{2}$/.test(s))
                moedas += 1;
        }
        if (parseBooleanValue(raw) !== null && s.length <= 12)
            booleanos += 1;
    }
    const ordenados = [...distintos.entries()].sort((a, b) => b[1] - a[1]);
    return {
        total: valores.length,
        vazios,
        distintos: distintos.size,
        amostra: ordenados.slice(0, 8).map(([v]) => v.slice(0, 80)),
        datas,
        numeros,
        moedas,
        booleanos,
        valores: distintos.size <= LISTA_MAX_DISTINTOS
            ? ordenados.map(([v]) => v).sort((a, b) => a.localeCompare(b, 'pt-BR'))
            : [],
    };
}
/**
 * Tipo provável da coluna.
 *
 * A regra é de MAIORIA com folga (80% dos valores preenchidos), não de
 * unanimidade: uma planilha real sempre tem a célula com "não informado" no
 * meio de uma coluna de datas, e exigir 100% jogaria a coluna inteira para
 * texto livre — perdendo a série temporal por causa de três células.
 */
function inferColumnType(stats) {
    const preenchidos = stats.total - stats.vazios;
    if (preenchidos === 0)
        return 'texto';
    const proporcao = (n) => n / preenchidos;
    if (proporcao(stats.booleanos) >= 0.9 && stats.distintos <= 3)
        return 'booleano';
    if (proporcao(stats.datas) >= 0.8)
        return 'data';
    if (proporcao(stats.numeros) >= 0.8) {
        return proporcao(stats.moedas) >= 0.5 ? 'moeda' : 'numero';
    }
    if (stats.distintos <= LISTA_MAX_DISTINTOS
        && proporcao(stats.distintos) <= LISTA_MAX_PROPORCAO)
        return 'lista';
    return 'texto';
}
/**
 * Pistas de nome por papel. É o que permite acertar o mapeamento na primeira
 * tentativa em planilhas do MP, que usam um vocabulário bastante estável.
 */
const PISTAS = {
    identificador: [
        'numero', 'processo', 'autos', 'nº', 'n°', 'protocolo', 'procedimento',
        'inquerito', 'ic', 'pp', 'noticia de fato', 'id',
    ],
    data_principal: [
        'data', 'instauracao', 'autuacao', 'distribuicao', 'abertura', 'cadastro',
        'ajuizamento', 'recebimento',
    ],
    data_referencia: [
        'data do fato', 'data do evento', 'data da ocorrencia', 'fato',
        'ocorrencia', 'evento', 'origem',
    ],
    unidade: [
        'comarca', 'municipio', 'cidade', 'localidade', 'foro', 'regional',
        'promotoria', 'unidade', 'circunscricao',
    ],
    responsavel: [
        'promotor', 'membro', 'responsavel', 'titular', 'designado', 'agente',
        'procurador',
    ],
    assunto: [
        'assunto', 'materia', 'tema', 'tipo', 'classe', 'natureza', 'objeto',
        'area', 'especie',
    ],
    desfecho: [
        'resultado', 'desfecho', 'decisao', 'providencia', 'encaminhamento',
        'solucao', 'conclusao',
    ],
    situacao: ['situacao', 'status', 'fase', 'etapa', 'estagio', 'andamento'],
    valor: ['valor', 'dano', 'quantia', 'montante', 'prejuizo', 'multa', 'r$'],
    prazo: ['prescricao', 'prazo', 'vencimento', 'limite', 'decadencia'],
};
/**
 * Papel provável de uma coluna, a partir do NOME e do CONTEÚDO.
 *
 * Nome e conteúdo têm de concordar. Uma coluna chamada "Data" que contém texto
 * livre não vira data principal; uma coluna com 170 valores distintos em 20 mil
 * linhas é candidata a unidade territorial mesmo que se chame "Local".
 */
function suggestRole(label, type, stats) {
    const nome = normalizeText(label);
    const preenchidos = Math.max(1, stats.total - stats.vazios);
    const proporcaoDistintos = stats.distintos / preenchidos;
    let melhor = null;
    // Comprimento da pista que produziu a sugestão vencedora. É o desempate
    // que importa: "Data do Fato" casa com a pista genérica "data" (papel de
    // data principal) E com "data do fato" (data de referência). Ganha a
    // pista mais LONGA, porque é a mais específica — sem isso, toda coluna de
    // data do órgão viraria a data principal e a prescrição perderia a base
    // de contagem.
    let melhorPista = 0;
    const propor = (role, confianca, motivo, pista = 0) => {
        if (!melhor
            || confianca > melhor.confianca
            || (confianca === melhor.confianca && pista > melhorPista)) {
            melhor = { role, confianca, motivo };
            melhorPista = pista;
        }
    };
    for (const role of exports.PANORAMA_ROLE_KEYS) {
        const def = exports.PANORAMA_ROLES.find((r) => r.key === role);
        if (!def.tipos.includes(type))
            continue;
        // A pista mais longa que aparece no nome desta coluna.
        const pista = PISTAS[role]
            .filter((p) => nome.includes(p))
            .sort((a, b) => b.length - a.length)[0];
        if (!pista)
            continue;
        propor(role, 0.85, `o nome da coluna contém "${pista}" e o conteúdo é do tipo ${type}`, pista.length);
    }
    // Identificador sem pista no nome: quase todos os valores distintos É a
    // assinatura de uma chave natural — mas também é a de um campo de
    // observações, onde cada linha tem um texto diferente. O que separa os
    // dois é a FORMA: identificador é curto e sem espaços; observação é longa
    // e cheia deles. Sem esta checagem, a coluna de observações seria proposta
    // como chave da importação, e a idempotência iria por água abaixo.
    if (type === 'texto' && proporcaoDistintos > 0.95 && preenchidos >= 5) {
        const amostra = stats.amostra.filter(Boolean);
        const comprimentoMedio = amostra.length
            ? amostra.reduce((acc, v) => acc + v.length, 0) / amostra.length
            : 0;
        const espacosMedios = amostra.length
            ? amostra.reduce((acc, v) => acc + (v.match(/\s/g) || []).length, 0) / amostra.length
            : 0;
        const pareceIdentificador = comprimentoMedio <= 40 && espacosMedios <= 2;
        if (pareceIdentificador) {
            propor('identificador', melhor ? 0.9 : 0.7, `${Math.round(proporcaoDistintos * 100)}% dos valores são distintos e têm forma de código`, 99);
        }
    }
    // Dimensão territorial: dezenas a poucas centenas de valores repetidos.
    if ((type === 'lista' || type === 'texto')
        && stats.distintos >= 5 && stats.distintos <= 300 && proporcaoDistintos < 0.3
        && !melhor) {
        propor('unidade', 0.35, `${stats.distintos} valores distintos em ${preenchidos} linhas — parece uma dimensão de agrupamento`);
    }
    return melhor;
}
exports.PANORAMA_PRESCRICAO_PADRAO = {
    modo: 'desligado',
    anosPadrao: 5,
    anosPorAssunto: {},
    contarDe: 'data_principal',
    alertas: [30, 90, 180, 365],
};
exports.PANORAMA_DEFAULT_DEF = {
    nome: 'Nova base',
    descricao: '',
    columns: [],
    desfechos: { pesos: {}, neutros: [], cores: {} },
    regioes: {},
    prescricao: exports.PANORAMA_PRESCRICAO_PADRAO,
    importPolicy: 'preserve',
    fuzzyThreshold: 0.7,
};
/** Cor neutra para desfechos sem cor definida. */
exports.PANORAMA_COR_NEUTRA = '#e2e8f0';
function sanitizeHexColor(value) {
    const raw = String(value !== null && value !== void 0 ? value : '').trim().replace(/^#/, '');
    const hex = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(hex))
        return null;
    return `#${hex.toLowerCase()}`;
}
/**
 * Nomes que nunca podem virar chave de coluna.
 *
 * Os valores de um registro são guardados num objeto indexado pela chave da
 * coluna (`values[key]`), e montar esse objeto num laço com `__proto__` como
 * chave mexeria no protótipo em vez de criar um campo.
 */
const CHAVES_PROIBIDAS = new Set(['__proto__', 'constructor', 'prototype']);
function sanitizeColumns(input) {
    var _a, _b, _c;
    const arr = Array.isArray(input) ? input : [];
    const out = [];
    const chaves = new Set();
    // Papéis únicos: o primeiro a reivindicar fica com ele. Sem isto, duas
    // colunas marcadas como "data principal" fariam a série temporal depender
    // da ordem em que o objeto foi serializado.
    const papeisUsados = new Set();
    for (const raw of arr) {
        const item = (raw && typeof raw === 'object' ? raw : {});
        const label = String((_a = item.label) !== null && _a !== void 0 ? _a : '').trim().slice(0, 120);
        if (!label)
            continue;
        // A chave da coluna vira CAMINHO DE CAMPO no Firestore
        // (`values.${key}` no patch da importação), então não pode ser o que o
        // cliente mandar. Uma chave com ponto criaria um mapa aninhado no lugar
        // do campo; uma com colchete ou crase produziria caminho malformado.
        // Só passa a forma que `slugColumnKey` produz — qualquer outra coisa é
        // reescrita a partir do rótulo.
        const keyRecebida = String((_b = item.key) !== null && _b !== void 0 ? _b : '').trim().slice(0, 60);
        const key = (/^[a-z0-9_]{1,60}$/.test(keyRecebida) && !CHAVES_PROIBIDAS.has(keyRecebida))
            ? keyRecebida
            : slugColumnKey(label, chaves);
        if (chaves.has(key))
            continue;
        chaves.add(key);
        const type = exports.PANORAMA_COLUMN_TYPES.includes(item.type)
            ? item.type
            : 'texto';
        let role = null;
        const roleRaw = String((_c = item.role) !== null && _c !== void 0 ? _c : '');
        if (exports.PANORAMA_ROLE_KEYS.includes(roleRaw)) {
            const def = exports.PANORAMA_ROLES.find((r) => r.key === roleRaw);
            // O papel tem de caber no tipo da coluna. "Valor monetário" numa
            // coluna de texto não soma nada, e o órgão veria zero em toda a
            // leitura financeira sem nenhum aviso — o papel órfão é descartado
            // aqui, de modo que a tela de mapeamento mostre a coluna sem papel
            // e o problema fique visível.
            const tipoCompativel = def.tipos.includes(type);
            if (tipoCompativel && !(def.unico && papeisUsados.has(roleRaw))) {
                role = roleRaw;
                papeisUsados.add(roleRaw);
            }
        }
        out.push({
            key,
            label,
            type,
            role,
            lista: Array.isArray(item.lista)
                ? [...new Set(item.lista.map((v) => String(v !== null && v !== void 0 ? v : '').trim()).filter(Boolean))].slice(0, 2000)
                : undefined,
            cardinalidade: Number.isFinite(Number(item.cardinalidade)) ? Number(item.cardinalidade) : undefined,
            amostra: Array.isArray(item.amostra)
                ? item.amostra.map((v) => String(v !== null && v !== void 0 ? v : '').slice(0, 80)).slice(0, 8)
                : undefined,
            vazios: Number.isFinite(Number(item.vazios)) ? Number(item.vazios) : undefined,
            visivel: item.visivel !== false,
            ordem: Number.isFinite(Number(item.ordem)) ? Number(item.ordem) : out.length,
            origem: item.origem ? String(item.origem).slice(0, 120) : undefined,
        });
        if (out.length >= 120)
            break;
    }
    return out.sort((a, b) => a.ordem - b.ordem).map((c, i) => (Object.assign(Object.assign({}, c), { ordem: i })));
}
/**
 * Teto de desfechos configuráveis.
 *
 * A versão anterior filtrava pesos e cores pela `lista` da coluna de desfecho —
 * e isso apagava em silêncio a configuração de todo desfecho que aparecesse
 * DEPOIS da primeira importação, porque `lista` é congelada ali. O limite agora
 * é de quantidade, não de pertinência: continua impedindo que o mapa vire
 * depósito de chaves arbitrárias, sem descartar o trabalho do administrador.
 */
const MAX_DESFECHOS_CONFIGURAVEIS = 300;
function sanitizeDesfechos(input) {
    const cfg = (input && typeof input === 'object' ? input : {});
    const pesos = {};
    const rawPesos = (cfg.pesos && typeof cfg.pesos === 'object' ? cfg.pesos : {});
    for (const [chave, valor] of Object.entries(rawPesos)) {
        if (Object.keys(pesos).length >= MAX_DESFECHOS_CONFIGURAVEIS)
            break;
        const nome = chave.trim().slice(0, 160);
        if (!nome)
            continue;
        const n = Number(valor);
        if (!Number.isFinite(n))
            continue;
        pesos[nome] = Math.min(1, Math.max(0, Math.round(n * 100) / 100));
    }
    const cores = {};
    const rawCores = (cfg.cores && typeof cfg.cores === 'object' ? cfg.cores : {});
    for (const [chave, valor] of Object.entries(rawCores)) {
        if (Object.keys(cores).length >= MAX_DESFECHOS_CONFIGURAVEIS)
            break;
        const nome = chave.trim().slice(0, 160);
        if (!nome)
            continue;
        const cor = sanitizeHexColor(valor);
        if (cor)
            cores[nome] = cor;
    }
    const neutros = [...new Set((Array.isArray(cfg.neutros) ? cfg.neutros : [])
            .map((v) => String(v !== null && v !== void 0 ? v : '').trim().slice(0, 160))
            .filter(Boolean))].slice(0, MAX_DESFECHOS_CONFIGURAVEIS);
    return { pesos, neutros, cores };
}
function sanitizeRegioes(input) {
    const raw = (input && typeof input === 'object' ? input : {});
    const out = {};
    let n = 0;
    for (const [nome, membros] of Object.entries(raw)) {
        const chave = String(nome !== null && nome !== void 0 ? nome : '').trim().slice(0, 120);
        if (!chave || !Array.isArray(membros))
            continue;
        const lista = [...new Set(membros.map((m) => String(m !== null && m !== void 0 ? m : '').trim()).filter(Boolean))].slice(0, 600);
        if (lista.length === 0)
            continue;
        out[chave] = lista;
        if (++n >= 80)
            break;
    }
    return out;
}
function sanitizePrescricao(input) {
    const base = exports.PANORAMA_PRESCRICAO_PADRAO;
    const cfg = (input && typeof input === 'object' ? input : {});
    const modo = ['desligado', 'coluna', 'prazo'].includes(String(cfg.modo))
        ? cfg.modo
        : base.modo;
    const anosPorAssunto = {};
    const raw = (cfg.anosPorAssunto && typeof cfg.anosPorAssunto === 'object'
        ? cfg.anosPorAssunto : {});
    for (const [assunto, anos] of Object.entries(raw)) {
        const n = Number(anos);
        if (!Number.isFinite(n) || n <= 0 || n > 100)
            continue;
        anosPorAssunto[String(assunto).slice(0, 160)] = Math.round(n * 10) / 10;
    }
    const anosPadraoRaw = Number(cfg.anosPadrao);
    const alertas = Array.isArray(cfg.alertas)
        ? [...new Set(cfg.alertas.map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 3650))]
            .sort((a, b) => a - b).slice(0, 6)
        : base.alertas;
    return {
        modo,
        anosPadrao: Number.isFinite(anosPadraoRaw) && anosPadraoRaw > 0 && anosPadraoRaw <= 100
            ? Math.round(anosPadraoRaw * 10) / 10
            : base.anosPadrao,
        anosPorAssunto,
        contarDe: cfg.contarDe === 'data_referencia' ? 'data_referencia' : 'data_principal',
        alertas: alertas.length > 0 ? alertas : base.alertas,
    };
}
/** Definição de base sanitizada — é o que o servidor aceita gravar. */
function sanitizeBaseDef(input) {
    var _a, _b;
    const cfg = (input && typeof input === 'object' ? input : {});
    const columns = sanitizeColumns(cfg.columns);
    const fuzzyRaw = Number(cfg.fuzzyThreshold);
    return {
        nome: String((_a = cfg.nome) !== null && _a !== void 0 ? _a : '').trim().slice(0, 120) || 'Nova base',
        descricao: String((_b = cfg.descricao) !== null && _b !== void 0 ? _b : '').trim().slice(0, 600),
        columns,
        desfechos: sanitizeDesfechos(cfg.desfechos),
        regioes: sanitizeRegioes(cfg.regioes),
        prescricao: sanitizePrescricao(cfg.prescricao),
        importPolicy: cfg.importPolicy === 'update' ? 'update' : 'preserve',
        fuzzyThreshold: Number.isFinite(fuzzyRaw)
            ? Math.min(1, Math.max(0.4, Math.round(fuzzyRaw * 100) / 100))
            : 0.7,
    };
}
/** Coluna que ocupa um papel, ou `null`. */
function columnForRole(def, role) {
    return def.columns.find((c) => c.role === role) || null;
}
/**
 * Valores de um registro, normalizados conforme o tipo de cada coluna.
 * Colunas que não existem na base são DESCARTADAS — a definição da base é a
 * autoridade sobre o que pode ser gravado.
 */
function sanitizeRecordValues(input, def) {
    const raw = (input && typeof input === 'object' ? input : {});
    const out = {};
    for (const col of def.columns) {
        if (!Object.prototype.hasOwnProperty.call(raw, col.key))
            continue;
        out[col.key] = coerceValue(raw[col.key], col.type);
    }
    return out;
}
// ----------------------------------------------------------------------------
// Correspondência aproximada (reaproveitada da Jurimetria)
// ----------------------------------------------------------------------------
/** Distância de Levenshtein entre dois textos já normalizados. */
function levenshtein(a, b) {
    if (a === b)
        return 0;
    if (!a.length)
        return b.length;
    if (!b.length)
        return a.length;
    let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const atual = [i];
        for (let j = 1; j <= b.length; j++) {
            atual[j] = Math.min(anterior[j] + 1, atual[j - 1] + 1, anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        anterior = atual;
    }
    return anterior[b.length];
}
/** Similaridade de 0 a 1 entre dois textos. */
function similarity(a, b) {
    const x = normalizeText(a);
    const y = normalizeText(b);
    if (!x && !y)
        return 1;
    if (!x || !y)
        return 0;
    const maior = Math.max(x.length, y.length);
    return 1 - levenshtein(x, y) / maior;
}
/**
 * Aproxima um valor da lista canônica da coluna.
 *
 * É o que impede que "PORTO ALEGRE", "Porto Alegre" e "P. Alegre" virem três
 * comarcas diferentes no relatório — o problema que mais estraga análise de
 * planilha vinda de sistema legado.
 */
function fuzzyMatchFromList(raw, lista, threshold) {
    const original = String(raw !== null && raw !== void 0 ? raw : '').trim();
    if (!original || lista.length === 0) {
        return { value: original, corrected: false, original, score: 1 };
    }
    const alvo = normalizeText(original);
    for (const item of lista) {
        if (normalizeText(item) === alvo) {
            return { value: item, corrected: item !== original, original, score: 1 };
        }
    }
    let melhor = '';
    let melhorScore = 0;
    for (const item of lista) {
        const score = similarity(original, item);
        if (score > melhorScore) {
            melhorScore = score;
            melhor = item;
        }
    }
    if (melhorScore >= threshold) {
        return { value: melhor, corrected: true, original, score: melhorScore };
    }
    return { value: original, corrected: false, original, score: melhorScore };
}
//# sourceMappingURL=panorama.js.map