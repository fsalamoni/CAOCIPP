// ============================================================================
// Panorama ligado às funcionalidades do órgão — espelho para a tela.
//
// Uma base "ligada" não guarda cópia: a tela assina Consultas, Expedientes e
// Parcerias do órgão e transforma cada registro numa linha do Panorama na
// hora, então toda consulta nova ou alterada aparece no painel em seguida.
//
// Mesma lógica de functions-v2/src/shared/panoramaModulos.ts (que o servidor
// usa para propor as colunas ao criar a base). Sem imports, para o teste
// src/lib/panoramaModulos.test.js comparar os dois sobre os mesmos registros.
// ============================================================================

export const MODULOS_PANORAMA = ['consultas', 'expedientes', 'parcerias'];
export const COLECAO_MODULO = { consultas: 'processes', expedientes: 'expedientes', parcerias: 'parcerias' };
export const NOME_MODULO = { consultas: 'Consultas', expedientes: 'Expedientes', parcerias: 'Parcerias' };
const SINGULAR = { consultas: 'Consulta', expedientes: 'Expediente', parcerias: 'Parceria' };
export const COLUNA_REGISTRO = 'Registro no SIGO';
export const COLUNA_FUNCIONALIDADE = 'Funcionalidade';

// Apelidos de campos legados (functions-v2/src/shared/fields.ts).
const ALIASES = {
    process_number: ['process_number', 'numero', 'n_processo', 'processo', 'PROCESSO SIM\n(NÚMERO)', 'PROCESSO SIM\\n(NÚMERO)'],
    consultant: ['consultant', 'consulente', 'cliente', 'interessado', 'CONSULENTE'],
    location: ['location', 'local', 'cidade', 'local_fatos', 'municipio', 'LOCAL DOS FATOS\n(CIDADE)', 'LOCAL DOS FATOS\\n(CIDADE)'],
    entry_date: ['entry_date', 'data_entrada', 'entrada', 'data', 'ENTRADA NO CAOPP\n(DATA)', 'ENTRADA NO CAOPP\\n(DATA)'],
    distribution_date: ['distribution_date', 'data_distribuicao', 'distribuicao', 'DISTRIBUIÇÃO\n(DATA)', 'DISTRIBUIÇÃO\\n(DATA)'],
    analysis_start_date: ['analysis_start_date', 'inicio_analise', 'data_inicio', 'INÍCIO DA ANÁLISE\n(DATA)', 'INÍCIO DA ANÁLISE\\n(DATA)'],
    review_submission_date: ['review_submission_date', 'remessa_revisao', 'data_revisao', 'remessa', 'REMESSA AO DR. PARA REVISÃO (DATA)'],
    reviewed_date: ['reviewed_date', 'data_revisao_concluida', 'revisado', 'revisao_concluida', 'REVISÃO CONCLUÍDA (DATA)', 'REVISADAS\n(DATA)'],
    review_return_date: ['review_return_date', 'devolucao_revisao', 'retorno_revisao', 'retorno', 'DEVOLUÇÃO APÓS REVISÃO\n(DATA)', 'DEVOLUÇÃO APÓS REV ISÃO\\n(DATA)'],
    archived_date: ['archived_date', 'data_arquivamento', 'arquivamento', 'data_arquivo', 'NA PASTA\nARQUIVADO\n(DATA)', 'NA PASTA\\nARQUIVADO\\n(DATA)'],
    urgency_request: ['urgency_request', 'urgente', 'prioridade', 'PEDIDO DE URGÊNCIA', 'Solicitação de Urgência'],
    status: ['status', 'situacao', 'estado'],
};
const cheio = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function campo(d, chave) {
    const nomes = ALIASES[chave] || [chave];
    for (const n of nomes) if (cheio(d[n])) return d[n];
    const alvos = nomes.map(norm);
    for (const k of Object.keys(d)) if (alvos.includes(norm(k)) && cheio(d[k])) return d[k];
    return null;
}

function situacaoConsulta(d) {
    if (campo(d, 'archived_date')) return 'Na pasta';
    if (campo(d, 'reviewed_date')) return 'Revisadas';
    if (campo(d, 'review_submission_date')) return 'Em revisão';
    if (campo(d, 'third_party_referral_date')) return 'Aguarda retorno de terceiros';
    if (campo(d, 'analysis_start_date')) return 'Em elaboração';
    return campo(d, 'status') || 'Pendente';
}

function situacaoParceria(d) {
    if (d?.extinguished === true) return 'Extintos';
    if (campo(d, 'partnership_type') && campo(d, 'signature_date') && campo(d, 'end_date') && campo(d, 'renewal_notice_date')) return 'Parcerias';
    if (campo(d, 'third_party_referral_date') && campo(d, 'third_party')) return 'Aguarda Terceiros';
    if (campo(d, 'reviewed_date') || campo(d, 'review_conclusion_date')) return 'Revisadas';
    if (campo(d, 'review_start_date') || (campo(d, 'network_folder') && campo(d, 'observations'))) return 'Em revisão';
    if (campo(d, 'responsibility_date')) return 'Em análise';
    const s = campo(d, 'status');
    return s === 'Revisão' ? 'Em revisão' : (s || 'Pendente');
}

const ROTULO_SITUACAO = {
    'Pendente': 'Pendentes',
    'Em elaboração': 'Em Análise',
    'Aguarda retorno de terceiros': 'Aguarda Terceiros',
    'Em revisão': 'Em Revisão',
    'Revisadas': 'Revisadas',
    'Na pasta': 'Arquivados',
};

export function nomeFonte(modulos) {
    return modulos.map((m) => NOME_MODULO[m]).join(' + ');
}

export function dataIso(v) {
    if (v === null || v === undefined || v === '') return '';
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
    if (typeof v?.toDate === 'function') return dataIso(v.toDate());
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
    return s;
}

const texto = (v) => (v === null || v === undefined || typeof v === 'object' ? '' : String(v).trim());
const simNao = (v) => (v === true || ['sim', 'true', '1'].includes(String(v ?? '').toLowerCase().trim()) ? 'Sim' : 'Não');

function tramitacao(d) {
    return {
        'Distribuição': dataIso(campo(d, 'distribution_date')),
        'Responsável': texto(d.responsible_user_name),
        'Início da análise': dataIso(campo(d, 'analysis_start_date')),
        'Remessa a terceiros': dataIso(d.third_party_referral_date),
        'Remetido para': texto(d.third_party_recipient),
        'Remessa para revisão': dataIso(campo(d, 'review_submission_date')),
        'Revisão concluída': dataIso(campo(d, 'reviewed_date')),
        'Devolução após revisão': dataIso(campo(d, 'review_return_date')),
        'Arquivamento': dataIso(campo(d, 'archived_date')),
        'Pasta na rede': texto(d.network_folder),
        'Observações': texto(d.observations),
        'Urgente': simNao(campo(d, 'urgency_request')),
        'Aditivo': d.aditivo_de ? 'Sim' : 'Não',
    };
}

/** Uma linha do Panorama (rótulo → valor) a partir de um registro do módulo. */
export function linhaDoRegistro(modulo, id, d, comFuncionalidade) {
    const base = { [COLUNA_REGISTRO]: `${SINGULAR[modulo].toLowerCase()}/${id}` };
    if (comFuncionalidade) base[COLUNA_FUNCIONALIDADE] = SINGULAR[modulo];
    if (modulo === 'consultas') {
        const s = situacaoConsulta(d);
        return {
            ...base,
            'Número PGEA': texto(campo(d, 'process_number')),
            'Situação': ROTULO_SITUACAO[s] || s,
            'Entrada': dataIso(campo(d, 'entry_date')),
            'Consulente': texto(campo(d, 'consultant')),
            'Local dos fatos': texto(campo(d, 'location')),
            'Matéria': [texto(d.matter_category), texto(d.matter_subcategory)].filter(Boolean).join(' / '),
            'Objeto': texto(d.matter_object),
            ...tramitacao(d),
            'Restrição de acesso': simNao(d.access_restriction),
        };
    }
    if (modulo === 'expedientes') {
        const s = situacaoConsulta(d);
        return {
            ...base,
            'Número PGEA': texto(d.expediente_number),
            'Situação': ROTULO_SITUACAO[s] || s,
            'Entrada': dataIso(campo(d, 'entry_date')),
            'Sistema': texto(d.system),
            'Origem': texto(d.origin),
            'Objeto': texto(d.object),
            ...tramitacao(d),
        };
    }
    return {
        ...base,
        'Número PGEA': texto(d.pgea),
        'Situação': situacaoParceria(d),
        'Entrada': dataIso(d.pgea_date) || dataIso(d.created_at),
        'Tipo de parceria': texto(d.partnership_type),
        'Número do termo': texto(d.partnership_number),
        'Assunto': texto(d.subject),
        'Objeto': texto(d.object),
        'Partes': texto(d.parties),
        'Categoria': texto(d.categoria),
        'Distribuição': dataIso(d.distribution_date),
        'Responsável': texto(d.responsible_user_name),
        'Início da análise': dataIso(d.responsibility_date),
        'Remessa para revisão': dataIso(d.review_start_date),
        'Revisão concluída': dataIso(d.reviewed_date) || dataIso(d.review_conclusion_date),
        'Remessa a terceiros': dataIso(d.third_party_referral_date),
        'Remetido para': texto(d.third_party),
        'Assinatura': dataIso(d.signature_date),
        'Termo final': dataIso(d.end_date),
        'Aviso de renovação': dataIso(d.renewal_notice_date),
        'Arquivamento': dataIso(d.archived_date),
        'Aditivos': Number(d.aditivo_count) || 0,
        'Pasta na rede': texto(d.network_folder),
        'Observações': texto(d.observations),
        'Urgente': simNao(d.urgency_request),
    };
}

/** Valor da linha convertido pelo tipo da coluna da base (o que o motor do Panorama espera). */
export function valorPeloTipo(bruto, tipo) {
    if (bruto === null || bruto === undefined || bruto === '') return null;
    switch (tipo) {
        case 'data': return /^\d{4}-\d{2}-\d{2}$/.test(String(bruto)) ? String(bruto) : null;
        case 'numero':
        case 'moeda': { const n = Number(bruto); return Number.isFinite(n) ? n : null; }
        case 'booleano': return bruto === 'Sim' ? true : bruto === 'Não' ? false : null;
        default: return String(bruto).slice(0, 2000);
    }
}

/**
 * Registros do Panorama a partir dos documentos dos módulos, no formato que a
 * tela já usa ({ id, values }). `docsPorModulo`: { consultas: [{id, ...dados}] }.
 * Cada coluna da base acha o seu valor pela `origem` (o rótulo da linha).
 */
export function registrosLigados(base, docsPorModulo) {
    const modulos = MODULOS_PANORAMA.filter((m) => (base?.fonte_modulos || []).includes(m));
    const colunas = base?.columns || [];
    const out = [];
    for (const m of modulos) {
        for (const d of docsPorModulo[m] || []) {
            const linha = linhaDoRegistro(m, d.id, d, modulos.length > 1);
            const values = {};
            for (const c of colunas) values[c.key] = valorPeloTipo(linha[c.origem ?? c.label], c.type);
            out.push({ id: linha[COLUNA_REGISTRO], values, modulo: m, origem_id: d.id, vinculado: true });
        }
    }
    return out;
}
