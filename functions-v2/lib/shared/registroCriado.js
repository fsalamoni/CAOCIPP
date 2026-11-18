"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.faseDoRegistro = exports.MODULOS_CRIACAO = exports.FONTES = void 0;
exports.sanitizeCriaRegistro = sanitizeCriaRegistro;
exports.errosCriaRegistro = errosCriaRegistro;
exports.paraCampo = paraCampo;
exports.valoresDoRegistro = valoresDoRegistro;
const modulos_1 = require("./modulos");
const schema_1 = require("../customEntities/schema");
exports.FONTES = ['numero', 'assunto', 'descricao', 'autuacao', 'unidade', 'tipo', 'partes', 'fixo'];
const MAX_VALORES = 40;
const CHAVE = /^[a-z][a-z0-9_]{0,39}$/;
const ID_CAMPO = /^campo:[a-z0-9_]{1,24}$/;
/** Módulos fixos onde a autuação também cria o registro (os campos estão em shared/painelModulos.ts, CAMPOS_CRIACAO). */
exports.MODULOS_CRIACAO = ['consultas', 'expedientes'];
/** Limpa o que veio da tela. Sem página nem módulo: null (o tipo não cria registro). */
function sanitizeCriaRegistro(v) {
    var _a;
    const o = (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
    const modulo = exports.MODULOS_CRIACAO.find((m) => m === o.modulo);
    const pagina = modulo ? '' : typeof o.pagina === 'string' ? o.pagina.trim() : '';
    if (!modulo && !modulos_1.ID_PAGINA.test(pagina))
        return null;
    const vistos = new Set();
    const valores = [];
    for (const x of (Array.isArray(o.valores) ? o.valores : []).slice(0, MAX_VALORES)) {
        const campo = typeof (x === null || x === void 0 ? void 0 : x.campo) === 'string' ? x.campo : '';
        const de = typeof (x === null || x === void 0 ? void 0 : x.de) === 'string' ? x.de : '';
        if (!CHAVE.test(campo) || vistos.has(campo) || !(exports.FONTES.includes(de) || ID_CAMPO.test(de)))
            continue;
        vistos.add(campo);
        valores.push(de === 'fixo' ? { campo, de, valor: String((_a = x.valor) !== null && _a !== void 0 ? _a : '').slice(0, 500) } : { campo, de: de });
    }
    if (modulo)
        return { pagina: '', modulo, valores };
    const fase = typeof o.fase === 'string' && CHAVE.test(o.fase) ? o.fase : '';
    return Object.assign(Object.assign({ pagina }, (fase ? { fase } : {})), { valores });
}
/** Fase em que o registro nasce: a escolhida (se ainda existe na página) ou a inicial. */
const faseDoRegistro = (cfg, def) => (cfg.fase && (def.phases || []).some((p) => p.key === cfg.fase) ? cfg.fase : (0, schema_1.initialPhase)(def));
exports.faseDoRegistro = faseDoRegistro;
/** Conferência ao salvar o tipo: página, fase, campos e as fontes que o formulário tem. */
function errosCriaRegistro(cfg, def, form) {
    var _a, _b;
    if (!def)
        return ['A página própria escolhida em "Criar registro na autuação" não existe mais. Escolha outra ou desligue a opção.'];
    const nome = String(def.label_singular || 'Página');
    if (def.enabled === false)
        return [`A página ${nome} está desativada. Ative-a em Páginas personalizadas ou escolha outra.`];
    const campos = def.fields || [];
    const erros = [];
    if (cfg.fase && !(def.phases || []).some((p) => p.key === cfg.fase))
        erros.push(`A fase escolhida para o registro não existe mais em ${nome}.`);
    const ids = new Set(form.campos.map((c) => `campo:${c.id}`));
    for (const v of cfg.valores) {
        const f = campos.find((x) => x.key === v.campo);
        if (!f) {
            erros.push(`Um campo escolhido não existe mais em ${nome}. Tire-o da lista.`);
            continue;
        }
        if (f.type === 'user_ref')
            erros.push(`"${f.label}" é uma pessoa da equipe e não recebe valor do processo. Tire-o da lista.`);
        else if (v.de.startsWith('campo:') && !ids.has(v.de))
            erros.push(`"${f.label}": o campo do formulário escolhido não existe mais neste tipo.`);
        else if (v.de === 'fixo') {
            if (!String((_a = v.valor) !== null && _a !== void 0 ? _a : '').trim())
                erros.push(`"${f.label}": informe o valor fixo.`);
            else {
                const r = (0, schema_1.validateRecordValues)([f], { [f.key]: paraCampo(f, (_b = v.valor) !== null && _b !== void 0 ? _b : '') });
                if (!r.ok)
                    erros.push(Object.values(r.errors)[0]);
            }
        }
    }
    // O que a página exige já na fase em que o registro nasce precisa de uma fonte.
    const alcancadas = (0, schema_1.phasesReachedUpTo)(def, (0, exports.faseDoRegistro)(cfg, def));
    for (const f of campos) {
        if (f.required && (!f.phase || alcancadas.has(f.phase)) && !cfg.valores.some((v) => v.campo === f.key)) {
            erros.push(`"${f.label}" é obrigatório em ${nome}: diga de onde vem o valor.`);
        }
    }
    return erros;
}
/** Converte o valor do processo para o tipo do campo da página (o que não casa fica como veio e a validação recusa). */
function paraCampo(f, b) {
    if (b === null || b === undefined || b === '' || (Array.isArray(b) && !b.length))
        return null;
    const opcao = (s) => { var _a, _b; return (_b = (_a = (f.options || []).find((o) => o.value === s || o.label.toLowerCase() === s.toLowerCase())) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : s; };
    const lista = Array.isArray(b) ? b.map(String) : String(b).split(',').map((s) => s.trim()).filter(Boolean);
    switch (f.type) {
        case 'number':
        case 'currency': return typeof b === 'number' ? b : Number(String(b).replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
        case 'date': {
            const s = String(b);
            const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
            return br ? `${br[3]}-${br[2]}-${br[1]}` : s;
        }
        case 'boolean': return b === true || /^(sim|true)$/i.test(String(b));
        case 'select': return opcao(Array.isArray(b) ? String(b[0]) : String(b));
        case 'multiselect': return lista.map(opcao);
        default: return Array.isArray(b) ? b.join(', ') : typeof b === 'boolean' ? (b ? 'Sim' : 'Não') : String(b);
    }
}
/** Valores do registro novo, no formato da página (a validação da página vem depois). */
function valoresDoRegistro(cfg, def, d) {
    var _a, _b;
    const out = {};
    for (const v of cfg.valores) {
        const f = (def.fields || []).find((x) => x.key === v.campo);
        if (!f || f.type === 'user_ref')
            continue;
        const campo = v.de.startsWith('campo:') ? d.campos.find((c) => `campo:${c.id}` === v.de) : undefined;
        const bruto = v.de === 'numero' ? d.numero : v.de === 'assunto' ? d.assunto : v.de === 'descricao' ? d.descricao
            : v.de === 'autuacao' ? d.hoje : v.de === 'unidade' ? d.unidade : v.de === 'tipo' ? d.tipo : v.de === 'partes' ? d.partes
                : v.de === 'fixo' ? (_a = v.valor) !== null && _a !== void 0 ? _a : '' : (_b = campo === null || campo === void 0 ? void 0 : campo.valor) !== null && _b !== void 0 ? _b : null;
        out[f.key] = paraCampo(f, bruto);
    }
    return out;
}
//# sourceMappingURL=registroCriado.js.map