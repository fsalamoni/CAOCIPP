"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defDaCriacao = exports.NOME_CRIACAO = exports.CAMPOS_CRIACAO = exports.rotuloDaColuna = exports.PAINEIS = exports.MODULOS_AO_REGISTRO = exports.MODULOS_PAINEL = void 0;
exports.sanitizeAoRegistro = sanitizeAoRegistro;
exports.paresDaAcao = paresDaAcao;
exports.camposParaModulo = camposParaModulo;
exports.camposParaPagina = camposParaPagina;
exports.aoRegistroInvalido = aoRegistroInvalido;
exports.docDoModulo = docDoModulo;
const registroCriado_1 = require("./registroCriado");
const schema_1 = require("../customEntities/schema");
exports.MODULOS_PAINEL = ['consultas', 'expedientes', 'parcerias'];
/** Módulos para onde a ação leva o dado: os painéis fixos e as páginas próprias. */
exports.MODULOS_AO_REGISTRO = [...exports.MODULOS_PAINEL, 'paginas'];
const TEXTO = ['texto', 'lista'];
const LONGO = ['texto', 'texto_longo', 'lista'];
const DATA = ['data'];
/** Colunas de Consultas e Expedientes (as mesmas nos dois quadros). */
const COLUNAS_CONSULTA = (nome) => [
    { id: 'Pendente', rotulo: 'Pendentes', infos: [] },
    { id: 'Em elaboração', rotulo: 'Em Análise', infos: [
            { campo: 'responsible_user_id', rotulo: 'Responsável', auto: 'quem assume o processo na fase (ou quem a fase designa)', obrigatoria: true },
            { campo: 'analysis_start_date', rotulo: 'Início da análise', auto: 'a data em que o registro entra na coluna' },
            { campo: 'distribution_date', rotulo: 'Distribuição', auto: 'a data em que o registro entra na coluna' },
        ] },
    { id: 'Aguarda retorno de terceiros', rotulo: 'Aguarda Terceiros', infos: [
            { campo: 'third_party_referral_date', rotulo: 'Data da remessa a terceiros', auto: 'a data em que o registro entra na coluna', obrigatoria: true },
            { campo: 'third_party_recipient', rotulo: 'Remetido a (terceiro)', obrigatoria: true },
        ] },
    { id: 'Em revisão', rotulo: 'Em Revisão', infos: [
            { campo: 'review_submission_date', rotulo: 'Remessa para revisão', auto: 'a data em que o registro entra na coluna' },
            { campo: 'network_folder', rotulo: 'Pasta na rede', obrigatoria: true },
            { campo: 'observations', rotulo: 'Observações' },
        ] },
    { id: 'Revisadas', rotulo: 'Revisadas', infos: [
            { campo: 'reviewed_date', rotulo: 'Data da revisão', auto: 'a data em que o registro entra na coluna', obrigatoria: true },
        ] },
    { id: 'Na pasta', rotulo: 'Arquivados', infos: [
            { campo: 'review_return_date', rotulo: `Devolução ${nome}`, auto: 'a data em que o registro entra na coluna, se ainda vazia', obrigatoria: true },
            { campo: 'archived_date', rotulo: 'Arquivamento', auto: 'a data em que o registro entra na coluna' },
        ] },
];
/** Campos comuns de Consultas e Expedientes que vêm de ações do rito. */
const CAMPOS_TRAMITE = [
    { campo: 'entry_date', rotulo: 'Entrada no órgão', tipos: DATA },
    { campo: 'urgency_request', rotulo: 'Urgência', tipos: ['sim_nao'] },
    { campo: 'observations', rotulo: 'Observações', tipos: LONGO },
    { campo: 'third_party_recipient', rotulo: 'Remetido a (terceiro)', tipos: TEXTO },
    { campo: 'third_party_referral_date', rotulo: 'Data da remessa a terceiros', tipos: DATA, coluna: 'Aguarda retorno de terceiros' },
    { campo: 'network_folder', rotulo: 'Pasta na rede', tipos: ['texto'] },
    { campo: 'reviewed_date', rotulo: 'Data da revisão', tipos: DATA, coluna: 'Revisadas' },
    { campo: 'review_return_date', rotulo: 'Data da devolução', tipos: DATA },
];
exports.PAINEIS = {
    consultas: {
        nome: 'Painel de Consultas', registro: 'a consulta', colunas: COLUNAS_CONSULTA('ao consulente'),
        campos: [
            { campo: 'process_number', rotulo: 'Nº da Consulta - PGEA', tipos: ['texto', 'numero'] },
            { campo: 'consultant', rotulo: 'Consulente (quem pediu)', tipos: TEXTO },
            { campo: 'location', rotulo: 'Local', tipos: TEXTO },
            { campo: 'matter_object', rotulo: 'Objeto ou assunto', tipos: LONGO },
            { campo: 'decision', rotulo: 'Decisão ou conclusão', tipos: LONGO },
            ...CAMPOS_TRAMITE,
        ],
    },
    expedientes: {
        nome: 'Painel de Expedientes', registro: 'o expediente', colunas: COLUNAS_CONSULTA('à origem'),
        campos: [
            { campo: 'expediente_number', rotulo: 'Nº do Expediente - PGEA', tipos: ['texto', 'numero'] },
            { campo: 'system', rotulo: 'Sistema', tipos: TEXTO },
            { campo: 'origin', rotulo: 'Origem', tipos: TEXTO },
            { campo: 'object', rotulo: 'Objeto', tipos: LONGO },
            ...CAMPOS_TRAMITE,
        ],
    },
    // Em Parcerias o quadro confere o que cada fase exige ao entrar: o dado precisa chegar antes.
    parcerias: {
        nome: 'Painel de Parcerias', registro: 'a parceria', antes: true,
        colunas: [
            { id: 'Pendente', rotulo: 'Pendentes', infos: [
                    { campo: 'pgea', rotulo: 'PGEA', obrigatoria: true }, { campo: 'subject', rotulo: 'Assunto', obrigatoria: true }, { campo: 'parties', rotulo: 'Partes', obrigatoria: true },
                ] },
            { id: 'Em análise', rotulo: 'Em Análise', infos: [
                    { campo: 'responsible_user_id', rotulo: 'Assessor responsável', auto: 'quem assume o processo na fase', obrigatoria: true },
                    { campo: 'responsibility_date', rotulo: 'Data de responsabilidade', auto: 'a data em que a parceria entra na coluna', obrigatoria: true },
                ] },
            { id: 'Em revisão', rotulo: 'Em Revisão', infos: [
                    { campo: 'review_start_date', rotulo: 'Início da revisão', auto: 'a data em que a parceria entra na coluna', obrigatoria: true },
                    { campo: 'network_folder', rotulo: 'Pasta na rede', obrigatoria: true },
                ] },
            { id: 'Revisadas', rotulo: 'Revisadas', infos: [{ campo: 'reviewed_date', rotulo: 'Conclusão da revisão', auto: 'a data em que a parceria entra na coluna', obrigatoria: true }] },
            { id: 'Aguarda Terceiros', rotulo: 'Aguarda Terceiros', infos: [
                    { campo: 'third_party_referral_date', rotulo: 'Data da remessa a terceiros', auto: 'a data em que a parceria entra na coluna', obrigatoria: true },
                    { campo: 'third_party', rotulo: 'Remetido para', obrigatoria: true },
                ] },
            { id: 'Parcerias', rotulo: 'Parcerias', infos: [
                    { campo: 'third_party_return_date', rotulo: 'Retorno de terceiros', obrigatoria: true },
                    { campo: 'partnership_type', rotulo: 'Tipo de parceria', obrigatoria: true },
                    { campo: 'signature_date', rotulo: 'Data da assinatura', obrigatoria: true },
                    { campo: 'demp', rotulo: 'Publicação no DEMP', obrigatoria: true },
                    { campo: 'validity_period', rotulo: 'Vigência', obrigatoria: true },
                    { campo: 'object', rotulo: 'Objeto', obrigatoria: true },
                    { campo: 'end_date', rotulo: 'Termo final', obrigatoria: true },
                    { campo: 'renewal_notice_date', rotulo: 'Aviso de renovação', obrigatoria: true },
                ] },
        ],
        campos: [
            { campo: 'pgea', rotulo: 'PGEA', tipos: ['texto', 'numero'] },
            { campo: 'subject', rotulo: 'Assunto', tipos: LONGO },
            { campo: 'parties', rotulo: 'Partes', tipos: LONGO },
            { campo: 'object', rotulo: 'Objeto', tipos: LONGO },
            { campo: 'observations', rotulo: 'Observações', tipos: LONGO },
            { campo: 'network_folder', rotulo: 'Pasta na rede', tipos: ['texto'] },
            { campo: 'third_party', rotulo: 'Remetido para', tipos: TEXTO },
            { campo: 'third_party_referral_date', rotulo: 'Data da remessa a terceiros', tipos: DATA },
            { campo: 'third_party_return_date', rotulo: 'Retorno de terceiros', tipos: DATA },
            { campo: 'partnership_type', rotulo: 'Tipo de parceria', tipos: TEXTO },
            { campo: 'partnership_number', rotulo: 'Número da parceria', tipos: ['texto', 'numero'] },
            { campo: 'signature_date', rotulo: 'Data da assinatura', tipos: DATA },
            { campo: 'demp', rotulo: 'Publicação no DEMP', tipos: TEXTO },
            { campo: 'validity_period', rotulo: 'Vigência', tipos: TEXTO },
            { campo: 'end_date', rotulo: 'Termo final', tipos: DATA },
            { campo: 'renewal_notice_date', rotulo: 'Aviso de renovação', tipos: DATA },
        ],
    },
};
/** Rótulo da coluna como a equipe vê no quadro. */
const rotuloDaColuna = (modulo, id) => { var _a, _b; return ((_b = (_a = exports.PAINEIS[modulo]) === null || _a === void 0 ? void 0 : _a.colunas.find((c) => c.id === id)) === null || _b === void 0 ? void 0 : _b.rotulo) || id; };
exports.rotuloDaColuna = rotuloDaColuna;
const CHAVE = /^[a-z][a-z0-9_]{0,39}$/;
const ID_PAGINA = /^[A-Za-z0-9_-]{1,128}$/;
/** O que a ação pede e que pode ir ao registro. */
const PEDIDOS_LEVAVEIS = ['texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao', 'formulario'];
const TIPOS_FORM = ['texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao'];
/**
 * Saneia "Leva ao painel". Só ação que pede dado (e não reservado); nas
 * consultas, expedientes e parcerias, só para os campos de `PAINEIS` e do
 * tipo que combina. Nas páginas, a chave do campo (o servidor confere a
 * página ao salvar o rito, `aoRegistroInvalido`).
 */
function sanitizeAoRegistro(raw, regra) {
    const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null);
    if (!r || regra.ve || !regra.pede || !PEDIDOS_LEVAVEIS.includes(regra.pede))
        return null;
    const modulo = exports.MODULOS_AO_REGISTRO.find((m) => m === r.modulo);
    if (!modulo)
        return null;
    const pagina = modulo === 'paginas' && typeof r.pagina === 'string' && ID_PAGINA.test(r.pagina) ? r.pagina : '';
    if (modulo === 'paginas' && !pagina)
        return null;
    const serve = (campo, tipo) => {
        if (typeof campo !== 'string' || !CHAVE.test(campo))
            return false;
        if (modulo === 'paginas')
            return true;
        const def = exports.PAINEIS[modulo].campos.find((c) => c.campo === campo);
        return !!def && def.tipos.includes(tipo);
    };
    const base = Object.assign({ modulo }, (pagina ? { pagina } : {}));
    if (regra.pede === 'formulario') {
        const bruto = (r.campos && typeof r.campos === 'object' ? r.campos : {});
        const usados = new Set();
        const campos = {};
        for (const c of regra.campos || []) {
            const alvo = bruto[c.id];
            if (!TIPOS_FORM.includes(c.tipo) || !serve(alvo, c.tipo) || usados.has(alvo))
                continue;
            usados.add(alvo);
            campos[c.id] = alvo;
        }
        return Object.keys(campos).length ? Object.assign(Object.assign({}, base), { campos }) : null;
    }
    return serve(r.campo, regra.pede) ? Object.assign(Object.assign({}, base), { campo: r.campo }) : null;
}
/** Os pares a levar, a partir do dado da ação (`valor` do formulário: a lista de campos preenchidos). */
function paresDaAcao(ao, dado) {
    if (ao.campos) {
        const lista = (Array.isArray(dado.valor) ? dado.valor : []);
        return lista.filter((c) => ao.campos[c.id]).map((c) => ({ campo: ao.campos[c.id], tipo: c.tipo, rotulo: c.rotulo, valor: c.valor }));
    }
    return ao.campo ? [{ campo: ao.campo, tipo: dado.tipo, rotulo: dado.rotulo, valor: dado.valor }] : [];
}
const vazio = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Situação de Consultas e Expedientes pelas datas (a mesma conta de `calculateStatus`). */
function colunaPelasDatas(doc) {
    if (!vazio(doc.archived_date))
        return 'Na pasta';
    if (!vazio(doc.reviewed_date))
        return 'Revisadas';
    if (!vazio(doc.review_submission_date))
        return 'Em revisão';
    if (!vazio(doc.third_party_referral_date))
        return 'Aguarda retorno de terceiros';
    if (!vazio(doc.analysis_start_date))
        return 'Em elaboração';
    return String(doc.status || 'Pendente');
}
/**
 * O que gravar numa consulta, expediente ou parceria. Texto é aparado e
 * limitado; data precisa ser AAAA-MM-DD; sim/não vira booleano. Data que
 * marca coluna só vale com o registro já nela. `fora`: o que não foi levado e por quê.
 */
function camposParaModulo(modulo, doc, pares) {
    const campos = {};
    const levados = [];
    const fora = [];
    for (const p of pares) {
        const def = exports.PAINEIS[modulo].campos.find((c) => c.campo === p.campo);
        if (!def || vazio(p.valor))
            continue;
        let v = p.valor;
        if (def.tipos.includes('data') && def.tipos.length === 1) {
            if (typeof v !== 'string' || !DATA_ISO.test(v)) {
                fora.push(`${def.rotulo}: data inválida`);
                continue;
            }
            if (def.coluna && modulo !== 'parcerias' && colunaPelasDatas(doc) !== def.coluna) {
                fora.push(`${def.rotulo}: só se ajusta com ${exports.PAINEIS[modulo].registro} em "${(0, exports.rotuloDaColuna)(modulo, def.coluna)}" (a data mudaria a coluna por fora do rito)`);
                continue;
            }
        }
        else if (def.tipos.includes('sim_nao')) {
            v = v === true || v === 'sim';
        }
        else {
            v = String(v).trim().slice(0, def.tipos.includes('texto_longo') ? 5000 : 500);
            if (!v)
                continue;
        }
        campos[def.campo] = v;
        levados.push(`${def.rotulo}: ${v === true ? 'Sim' : v === false ? 'Não' : String(v)}`);
    }
    return { campos, levados, fora };
}
/**
 * O que gravar num registro de página própria: cada valor convertido para o
 * tipo do campo (`paraCampo`) e conferido pelas regras do campo. Campo de
 * pessoa da equipe não recebe valor do processo.
 */
function camposParaPagina(fields, doc, pares) {
    const valores = {};
    const levados = [];
    const fora = [];
    for (const p of pares) {
        const f = fields.find((x) => x.key === p.campo);
        if (!f) {
            fora.push(`${p.rotulo}: o campo não existe mais na página`);
            continue;
        }
        if (f.type === 'user_ref' || vazio(p.valor))
            continue;
        const bruto = typeof p.valor === 'boolean' ? (p.valor ? 'sim' : 'nao') : p.valor;
        const v = (0, registroCriado_1.paraCampo)(f, bruto);
        const r = (0, schema_1.validateRecordValues)([Object.assign(Object.assign({}, f), { required: false })], { [f.key]: v });
        if (!r.ok) {
            fora.push(`${f.label}: ${Object.values(r.errors)[0]}`);
            continue;
        }
        valores[f.key] = r.normalized[f.key];
        levados.push(`${f.label}: ${Array.isArray(v) ? v.join(', ') : v === true ? 'Sim' : v === false ? 'Não' : String(v)}`);
    }
    const antes = (doc.values && typeof doc.values === 'object' ? doc.values : {});
    return { campos: levados.length ? { values: Object.assign(Object.assign({}, antes), valores) } : {}, levados, fora };
}
/** Campos de página que as ações levam e a página não tem (ou é de pessoa). `tipos`: id -> tipo da página. */
function aoRegistroInvalido(fases, tipos) {
    const erros = [];
    for (const f of fases) {
        (f.acoes_regras || []).forEach((r, i) => {
            var _a;
            const ao = r === null || r === void 0 ? void 0 : r.ao_registro;
            if ((ao === null || ao === void 0 ? void 0 : ao.modulo) !== 'paginas')
                return;
            const tipo = tipos[String(ao.pagina)];
            const acao = ((_a = f.acoes) === null || _a === void 0 ? void 0 : _a[i]) || `ação ${i + 1}`;
            if (!tipo) {
                erros.push(`A ação "${acao}" (fase ${f.nome || ''}) leva o dado a uma página própria que não existe mais.`);
                return;
            }
            for (const k of [ao.campo, ...Object.values(ao.campos || {})].filter(Boolean)) {
                const def = (tipo.fields || []).find((x) => x.key === k);
                if (!def)
                    erros.push(`A ação "${acao}" (fase ${f.nome || ''}) leva o dado ao campo "${k}", que a página não tem.`);
                else if (def.type === 'user_ref')
                    erros.push(`A ação "${acao}" (fase ${f.nome || ''}) leva o dado a "${def.label}", que é uma pessoa da equipe: escolha outro campo.`);
            }
        });
    }
    return erros;
}
// ---------------------------------------------------------------------------
// Consulta ou expediente criado na autuação
// ---------------------------------------------------------------------------
/** Campos da consulta e do expediente que o tipo de processo preenche na autuação, no formato de página (para reaproveitar `registroCriado`). */
exports.CAMPOS_CRIACAO = {
    consultas: [
        { key: 'process_number', label: 'Nº da Consulta - PGEA', type: 'text', required: true },
        { key: 'consultant', label: 'Consulente (quem pediu)', type: 'text', required: true },
        { key: 'location', label: 'Local', type: 'text' },
        { key: 'entry_date', label: 'Entrada no órgão', type: 'date' },
        { key: 'matter_object', label: 'Objeto ou assunto', type: 'textarea' },
        { key: 'urgency_request', label: 'Urgência', type: 'boolean' },
        { key: 'observations', label: 'Observações', type: 'textarea' },
    ],
    expedientes: [
        { key: 'expediente_number', label: 'Nº do Expediente - PGEA', type: 'text', required: true },
        { key: 'system', label: 'Sistema', type: 'text' },
        { key: 'origin', label: 'Origem', type: 'text' },
        { key: 'entry_date', label: 'Entrada no órgão', type: 'date' },
        { key: 'object', label: 'Objeto', type: 'textarea' },
        { key: 'urgency_request', label: 'Urgência', type: 'boolean' },
        { key: 'observations', label: 'Observações', type: 'textarea' },
    ],
};
exports.NOME_CRIACAO = {
    consultas: { singular: 'Consulta', plural: 'Consultas' },
    expedientes: { singular: 'Expediente', plural: 'Expedientes' },
};
/**
 * Documento novo de consulta ou expediente, no formato de createProcess e
 * createExpediente: Pendente, sem datas de tramitação. `valores` já
 * normalizados pelos campos de `CAMPOS_CRIACAO`.
 */
function docDoModulo(modulo, valores) {
    const s = (k) => (typeof valores[k] === 'string' ? String(valores[k]) : '');
    const tramite = {
        status: 'Pendente', urgency_request: valores.urgency_request === true, entry_date: s('entry_date') || null, observations: s('observations'),
        distribution_date: null, responsible_user_id: null, responsible_user_name: null, analysis_start_date: null,
        review_submission_date: null, reviewed_date: null, review_return_date: null, archived_date: null, network_folder: '',
    };
    return modulo === 'consultas'
        ? Object.assign({ process_number: s('process_number'), consultant: s('consultant'), location: s('location'), matter_object: s('matter_object'), matter_category: '', matter_subcategory: '', access_restriction: false, decision: '' }, tramite) : Object.assign({ expediente_number: s('expediente_number'), system: s('system'), origin: s('origin'), object: s('object') }, tramite);
}
/** A consulta ou o expediente como "página" (campos e nome), para as contas de shared/registroCriado.ts. */
const defDaCriacao = (m) => ({ label_singular: exports.NOME_CRIACAO[m].singular, label_plural: exports.NOME_CRIACAO[m].plural, enabled: true, fields: exports.CAMPOS_CRIACAO[m], phases: [] });
exports.defDaCriacao = defDaCriacao;
//# sourceMappingURL=painelModulos.js.map