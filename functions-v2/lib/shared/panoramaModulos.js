"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLUNA_FUNCIONALIDADE = exports.COLUNA_REGISTRO = exports.NOME_MODULO = exports.COLECAO_MODULO = exports.MODULOS_PANORAMA = void 0;
exports.sanitizeModulos = sanitizeModulos;
exports.nomeFonte = nomeFonte;
exports.dataIso = dataIso;
exports.linhaDoRegistro = linhaDoRegistro;
// ============================================================================
// Panorama a partir das funcionalidades do próprio órgão (Consultas,
// Expedientes, Parcerias).
//
// Em vez de exportar a planilha e importá-la, o Panorama lê os registros do
// órgão e os transforma em LINHAS, com os mesmos rótulos para o que tem o
// mesmo significado nos três módulos ("Número PGEA", "Entrada", "Situação",
// "Responsável"...). Assim, juntos numa base só, eles caem nas mesmas colunas;
// separados, cada base tem as colunas do seu módulo.
//
// As linhas seguem o mesmo caminho da planilha (detecção de colunas, papéis,
// confronto com o que já existe), com uma diferença: o identificador é o
// registro no SIGO ("consulta/abc123"), não o número PGEA — um aditivo tem o
// mesmo número do original e, pela planilha, virava "identificador repetido".
// Lógica pura, testada em test/panoramaModulos.test.js.
// ============================================================================
const fields_1 = require("./fields");
const status_1 = require("./status");
exports.MODULOS_PANORAMA = ['consultas', 'expedientes', 'parcerias'];
exports.COLECAO_MODULO = {
    consultas: 'processes',
    expedientes: 'expedientes',
    parcerias: 'parcerias',
};
exports.NOME_MODULO = {
    consultas: 'Consultas',
    expedientes: 'Expedientes',
    parcerias: 'Parcerias',
};
const SINGULAR = {
    consultas: 'Consulta',
    expedientes: 'Expediente',
    parcerias: 'Parceria',
};
/** Coluna que identifica o registro no SIGO. É ela que vira o identificador da base. */
exports.COLUNA_REGISTRO = 'Registro no SIGO';
/** Coluna que diz de que funcionalidade veio a linha (só quando há mais de uma). */
exports.COLUNA_FUNCIONALIDADE = 'Funcionalidade';
/** Como os quadros de Consultas e Expedientes chamam cada situação gravada. */
const ROTULO_SITUACAO = {
    'Pendente': 'Pendentes',
    'Em elaboração': 'Em Análise',
    'Aguarda retorno de terceiros': 'Aguarda Terceiros',
    'Em revisão': 'Em Revisão',
    'Revisadas': 'Revisadas',
    'Na pasta': 'Arquivados',
};
/** Normaliza módulos pedidos: só os conhecidos, sem repetição, na ordem fixa. */
function sanitizeModulos(input) {
    const pedidos = new Set(Array.isArray(input) ? input.map(String) : []);
    return exports.MODULOS_PANORAMA.filter((m) => pedidos.has(m));
}
/** Nome legível da fonte ("Consultas + Expedientes"). */
function nomeFonte(modulos) {
    return modulos.map((m) => exports.NOME_MODULO[m]).join(' + ');
}
/** Data gravada (texto, Timestamp do Firestore ou Date) em `AAAA-MM-DD`, ou ''. */
function dataIso(v) {
    if (v === null || v === undefined || v === '')
        return '';
    if (v instanceof Date)
        return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
    const t = v;
    if (typeof t.toDate === 'function')
        return dataIso(t.toDate());
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s))
        return s.slice(0, 10);
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (br)
        return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
    return s;
}
function texto(v) {
    if (v === null || v === undefined)
        return '';
    if (typeof v === 'object')
        return '';
    return String(v).trim();
}
function simNao(v) {
    return v === true || ['sim', 'true', '1'].includes(String(v !== null && v !== void 0 ? v : '').toLowerCase().trim()) ? 'Sim' : 'Não';
}
/** Campos de tramitação que Consultas e Expedientes têm em comum. */
function tramitacao(d, campo) {
    return {
        'Distribuição': dataIso(campo('distribution_date')),
        'Responsável': texto(d.responsible_user_name),
        'Início da análise': dataIso(campo('analysis_start_date')),
        'Remessa a terceiros': dataIso(d.third_party_referral_date),
        'Remetido para': texto(d.third_party_recipient),
        'Remessa para revisão': dataIso(campo('review_submission_date')),
        'Revisão concluída': dataIso(campo('reviewed_date')),
        'Devolução após revisão': dataIso(campo('review_return_date')),
        'Arquivamento': dataIso(campo('archived_date')),
        'Pasta na rede': texto(d.network_folder),
        'Observações': texto(d.observations),
        'Urgente': simNao(campo('urgency_request')),
        'Aditivo': d.aditivo_de ? 'Sim' : 'Não',
    };
}
/** Uma linha do Panorama a partir de um registro do módulo. */
function linhaDoRegistro(modulo, id, d, comFuncionalidade) {
    const campo = (k) => (0, fields_1.getSmartField)(d, k);
    const base = { [exports.COLUNA_REGISTRO]: `${SINGULAR[modulo].toLowerCase()}/${id}` };
    if (comFuncionalidade)
        base[exports.COLUNA_FUNCIONALIDADE] = SINGULAR[modulo];
    let proprio;
    if (modulo === 'consultas') {
        const situacao = (0, status_1.calculateStatus)(d);
        proprio = Object.assign(Object.assign({ 'Número PGEA': texto(campo('process_number')), 'Situação': ROTULO_SITUACAO[situacao] || situacao, 'Entrada': dataIso(campo('entry_date')), 'Consulente': texto(campo('consultant')), 'Local dos fatos': texto(campo('location')), 'Matéria': [texto(d.matter_category), texto(d.matter_subcategory)].filter(Boolean).join(' / '), 'Objeto': texto(d.matter_object) }, tramitacao(d, campo)), { 'Restrição de acesso': simNao(d.access_restriction) });
    }
    else if (modulo === 'expedientes') {
        const situacao = (0, status_1.calculateStatus)(d);
        proprio = Object.assign({ 'Número PGEA': texto(d.expediente_number), 'Situação': ROTULO_SITUACAO[situacao] || situacao, 'Entrada': dataIso(campo('entry_date')), 'Sistema': texto(d.system), 'Origem': texto(d.origin), 'Objeto': texto(d.object) }, tramitacao(d, campo));
    }
    else {
        proprio = {
            'Número PGEA': texto(d.pgea),
            'Situação': (0, status_1.calculateParceriaStatus)(d),
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
    return Object.assign(Object.assign({}, base), proprio);
}
//# sourceMappingURL=panoramaModulos.js.map