"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ehModuloOrigem = exports.idEscolhido = exports.ROTULO_MODULO = exports.MODULOS = void 0;
exports.modulosAtivos = modulosAtivos;
exports.integracoesGravadas = integracoesGravadas;
exports.integracoesDe = integracoesDe;
exports.lerFlags = lerFlags;
exports.refDe = refDe;
exports.resolverRegistro = resolverRegistro;
exports.refsDoFormulario = refsDoFormulario;
exports.refsFechadas = refsFechadas;
exports.vinculosDe = vinculosDe;
const fields_1 = require("./fields");
/**
 * Integração do Processo Eletrônico com os outros módulos do órgão. O admin
 * liga cada uma em `secretariaConfig.integracoes`; só vale com o módulo ativo
 * no órgão. O processo guarda só número e título do registro escolhido, nunca
 * consulente, partes, promotor, responsável ou situação.
 */
exports.MODULOS = ['consultas', 'expedientes', 'parcerias', 'juri'];
exports.ROTULO_MODULO = { consultas: 'Consultas', expedientes: 'Expedientes', parcerias: 'Parcerias', juri: 'Júri' };
const COLECAO = { consultas: 'processes', expedientes: 'expedientes', parcerias: 'parcerias', juri: 'juris' };
/**
 * Módulos ativos no órgão, com a mesma regra das abas (resolveBuiltinModules e
 * getOrganizationTabs no cliente): sem `moduleConfig`, tudo ligado; páginas
 * personalizadas desligadas na plataforma, tudo ligado; Parcerias e Júri
 * dependem também da flag da plataforma (Júri entra desligado).
 */
function modulosAtivos(org, flags) {
    const cfg = org === null || org === void 0 ? void 0 : org.moduleConfig;
    const legado = !cfg || typeof cfg !== 'object';
    const livre = flags.custom_entities === false || legado;
    const on = (k) => { var _a; return livre || ((_a = cfg[k]) === null || _a === void 0 ? void 0 : _a.enabled) === true; };
    return {
        consultas: on('processes'),
        expedientes: on('expedientes'),
        parcerias: flags.parcerias_enabled !== false && on('parcerias'),
        juri: flags.jurimetria_enabled === true && on('jurimetria'),
    };
}
/** O que o admin gravou (sem conferir se o módulo está ativo). */
function integracoesGravadas(org) {
    var _a;
    const g = (((_a = org === null || org === void 0 ? void 0 : org.secretariaConfig) === null || _a === void 0 ? void 0 : _a.integracoes) || {});
    return Object.fromEntries(exports.MODULOS.map((m) => [m, g[m] === true]));
}
/** Integrações que valem agora: ligadas pelo admin e com o módulo ativo. */
function integracoesDe(org, flags) {
    const ativos = modulosAtivos(org, flags);
    const g = integracoesGravadas(org);
    return Object.fromEntries(exports.MODULOS.map((m) => [m, ativos[m] && g[m]]));
}
async function lerFlags(db) {
    const s = await db.collection('platformConfig').doc('featureFlags').get();
    return ((s.data() || {}).flags || {});
}
const curto = (v, max) => (v === undefined || v === null ? '' : String(v).trim().slice(0, max));
const sim = (v) => v === true || (typeof v === 'string' && /^sim$/i.test(v.trim()));
/** Número e título do registro, por módulo (o que se mostra e se guarda no processo). */
function refDe(modulo, id, d) {
    const pares = {
        consultas: [(0, fields_1.getSmartField)(d, 'process_number'), d.matter_object],
        expedientes: [d.expediente_number, d.object],
        parcerias: [d.pgea || d.PGEA || d.partnership_number, d.subject || d.assunto],
        juri: [d.numero_processo, d.comarca],
    };
    const [numero, titulo] = pares[modulo];
    const t = curto(titulo, 160);
    return Object.assign(Object.assign({ modulo, id, numero: curto(numero, 80) || 'sem número' }, (t ? { titulo: t } : {})), (sim(d.access_restriction) || d.anonymized === true ? { restrito: true } : {}));
}
/** Lê o registro do outro módulo, conferindo o órgão. Qualquer falha: null (sem dizer se existe noutro órgão). */
async function resolverRegistro(db, orgId, modulo, id) {
    if (!exports.MODULOS.includes(modulo) || typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id))
        return null;
    try {
        const s = await db.collection(COLECAO[modulo]).doc(id).get();
        const d = s.data();
        if (!s.exists || !d || d.organization_id !== orgId)
            return null;
        return refDe(modulo, id, d);
    }
    catch (_a) {
        return null;
    }
}
/** Id do registro escolhido na tela (o cliente manda o id ou {id, ...}; só o id vale). */
const idEscolhido = (v) => {
    const x = v && typeof v === 'object' && !Array.isArray(v) ? v.id : v;
    return typeof x === 'string' ? x.trim() : '';
};
exports.idEscolhido = idEscolhido;
/**
 * Lê os registros escolhidos nos campos 'registro' do formulário (só os que
 * mudaram em relação ao gravado). Integração desligada: Error com mensagem
 * para o usuário. Registro inexistente ou de outro órgão: null no mapa
 * (validarCampos recusa).
 */
async function refsDoFormulario(db, orgId, org, form, valores, antes = []) {
    const v = (valores && typeof valores === 'object' ? valores : {});
    const gravados = new Map(antes.map((a) => { var _a; return [a.id, (_a = a.ref) === null || _a === void 0 ? void 0 : _a.id]; }));
    const pedidos = form.campos.filter((c) => c.tipo === 'registro' && c.modulo && (0, exports.idEscolhido)(v[c.id]) && gravados.get(c.id) !== (0, exports.idEscolhido)(v[c.id]));
    const out = new Map();
    if (!pedidos.length)
        return out;
    const ligadas = integracoesDe(org, await lerFlags(db));
    // Desligada: não lê; validarCampos só recusa se o campo aparece e mudou de fato.
    for (const c of pedidos)
        out.set(c.id, ligadas[c.modulo] ? await resolverRegistro(db, orgId, c.modulo, (0, exports.idEscolhido)(v[c.id])) : 'desligada');
    return out;
}
/**
 * Registros (por `modulo:id`) que hoje estão restritos, anonimizados ou não
 * existem mais no órgão. O portal das partes esconde o que estiver aqui, mesmo
 * que fosse público quando foi escolhido.
 */
async function refsFechadas(db, orgId, refs) {
    const unicos = [...new Map(refs.filter((r) => !!r && exports.MODULOS.includes(r.modulo)).map((r) => [`${r.modulo}:${r.id}`, r])).values()];
    const fechadas = new Set();
    if (!unicos.length)
        return fechadas;
    const snaps = await db.getAll(...unicos.map((r) => db.collection(COLECAO[r.modulo]).doc(r.id)));
    snaps.forEach((s, i) => {
        const d = s.data();
        if (!s.exists || !d || d.organization_id !== orgId || sim(d.access_restriction) || d.anonymized === true)
            fechadas.add(`${unicos[i].modulo}:${unicos[i].id}`);
    });
    return fechadas;
}
const ehModuloOrigem = (v) => v === 'pe' || exports.MODULOS.includes(v);
exports.ehModuloOrigem = ehModuloOrigem;
/**
 * Chaves `modulo:id` de tudo a que o processo se liga: a origem, os campos
 * 'registro' e os registros pedidos por ações (`outros`). Guardadas em
 * `vinculos` para achar os processos de um registro.
 */
function vinculosDe(origem, campos = [], outros = []) {
    var _a, _b;
    const s = new Set(outros);
    if ((_a = origem === null || origem === void 0 ? void 0 : origem.ref) === null || _a === void 0 ? void 0 : _a.id)
        s.add(`${origem.ref.modulo}:${origem.ref.id}`);
    for (const c of campos)
        if ((_b = c.ref) === null || _b === void 0 ? void 0 : _b.id)
            s.add(`${c.ref.modulo}:${c.ref.id}`);
    return [...s];
}
//# sourceMappingURL=modulos.js.map