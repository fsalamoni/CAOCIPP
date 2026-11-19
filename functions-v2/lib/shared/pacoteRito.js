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
exports.VERSAO_PACOTE = exports.FORMATO_PACOTE = void 0;
exports.paginasCitadas = paginasCitadas;
exports.pacoteDoRito = pacoteDoRito;
exports.FORMATO_PACOTE = 'sigo-pacote';
exports.VERSAO_PACOTE = 1;
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
/** Ids de páginas próprias citadas no rito e no formulário do tipo (para mandar o nome junto). */
function paginasCitadas(rito, formulario) {
    var _a, _b, _c;
    const ids = new Set();
    const deCampos = (cs) => (Array.isArray(cs) ? cs : []).forEach((c) => { const o = obj(c); if ((o === null || o === void 0 ? void 0 : o.modulo) === 'paginas' && typeof o.pagina === 'string')
        ids.add(o.pagina); });
    for (const f of rito.fases) {
        if (((_a = f.situacao_registro) === null || _a === void 0 ? void 0 : _a.modulo) === 'paginas' && f.situacao_registro.pagina)
            ids.add(f.situacao_registro.pagina);
        for (const r of f.acoes_regras || []) {
            if ((r === null || r === void 0 ? void 0 : r.modulo) === 'paginas' && r.pagina)
                ids.add(r.pagina);
            if (((_b = r === null || r === void 0 ? void 0 : r.ao_registro) === null || _b === void 0 ? void 0 : _b.modulo) === 'paginas' && r.ao_registro.pagina)
                ids.add(r.ao_registro.pagina);
            deCampos(r === null || r === void 0 ? void 0 : r.campos);
        }
    }
    deCampos((_c = obj(formulario)) === null || _c === void 0 ? void 0 : _c.campos);
    return [...ids];
}
/**
 * Monta o pacote. `rito` já saneado (sanitizeRito); `unidades` e `modelos`, os
 * do órgão (só entram os que o rito cita); `paginas`, id → nome das páginas
 * próprias do órgão. Modelo guardado como arquivo original não leva o texto
 * (vai o nome, e o outro órgão completa ou importa o arquivo à parte).
 */
function pacoteDoRito(rito, ctx) {
    var _a, _b;
    const refUn = new Map();
    const refMod = new Map();
    const avisos = [];
    const un = (id) => {
        if (!id)
            return null;
        if (!refUn.has(id) && ctx.unidades.some((u) => u.id === id))
            refUn.set(id, `u${refUn.size + 1}`);
        return refUn.get(id) || null;
    };
    const mod = (id) => {
        if (!id)
            return undefined;
        if (!refMod.has(id) && ctx.modelos.some((m) => m.id === id))
            refMod.set(id, `m${refMod.size + 1}`);
        return refMod.get(id);
    };
    const comModelo = (e) => {
        if (!(e === null || e === void 0 ? void 0 : e.modelo_id))
            return e;
        const { modelo_id } = e, resto = __rest(e, ["modelo_id"]);
        const r = mod(modelo_id);
        return (r ? Object.assign(Object.assign({}, resto), { modelo_id: r }) : resto);
    };
    const fases = rito.fases.map((f) => {
        var _a, _b;
        const { unidade_id, modelos } = f, resto = __rest(f, ["unidade_id", "modelos"]);
        const documentos = (_a = resto.documentos) === null || _a === void 0 ? void 0 : _a.map(comModelo);
        const acoes_regras = (_b = resto.acoes_regras) === null || _b === void 0 ? void 0 : _b.map((r) => ((r === null || r === void 0 ? void 0 : r.documento) ? Object.assign(Object.assign({}, r), { documento: comModelo(r.documento) }) : r));
        // Modelo citado só como "modelo indicado" de documento exigido também entra nos modelos da fase.
        const indicados = [...(documentos || []), ...(acoes_regras || []).map((r) => r === null || r === void 0 ? void 0 : r.documento)].map((d) => d === null || d === void 0 ? void 0 : d.modelo_id).filter((x) => !!x);
        const ms = [...new Set([...(modelos || []).map(mod).filter((x) => !!x), ...indicados])];
        return Object.assign(Object.assign(Object.assign(Object.assign({}, resto), { unidade: un(unidade_id), modelos: ms }), (documentos ? { documentos } : {})), (acoes_regras ? { acoes_regras } : {}));
    });
    const unidades = [...refUn].map(([id, ref]) => {
        const u = ctx.unidades.find((x) => x.id === id);
        return Object.assign(Object.assign({ ref, nome: u.nome }, (u.sigla ? { sigla: u.sigla } : {})), (u.tipo ? { tipo: u.tipo } : {}));
    });
    const modelos = [...refMod].map(([id, ref]) => {
        var _a;
        const m = ctx.modelos.find((x) => x.id === id);
        const original = m.formato === 'original';
        if (original)
            avisos.push(`O modelo "${m.nome}" é um arquivo original (Word ou PDF): vai só o nome. Baixe o arquivo no órgão de origem e importe-o em Documentos.`);
        return Object.assign(Object.assign(Object.assign({ ref, nome: m.nome }, (m.tipo_documento ? { tipo_documento: m.tipo_documento } : {})), (m.descricao ? { descricao: m.descricao } : {})), { unidade: un(m.unidade_id), conteudo: original ? null : ((_a = m.conteudo) !== null && _a !== void 0 ? _a : null) });
    });
    // Página própria vai como "p1" com o nome; o outro órgão casa pelo nome com as suas.
    const ids = paginasCitadas(rito, (_a = ctx.tipo) === null || _a === void 0 ? void 0 : _a.formulario);
    const refPg = new Map(ids.map((id, i) => [id, `p${i + 1}`]));
    const paginas = ids.map((id) => { var _a; return ({ ref: refPg.get(id), nome: ((_a = ctx.paginas) === null || _a === void 0 ? void 0 : _a[id]) || '' }); });
    const pg = (o) => {
        const x = obj(o);
        return ((x === null || x === void 0 ? void 0 : x.modulo) === 'paginas' && typeof x.pagina === 'string' ? Object.assign(Object.assign({}, x), { pagina: refPg.get(x.pagina) || '' }) : o);
    };
    const comPaginas = (cs) => (Array.isArray(cs) ? cs.map(pg) : cs);
    const fasesPg = fases.map((f) => (Object.assign(Object.assign(Object.assign({}, f), (f.situacao_registro ? { situacao_registro: pg(f.situacao_registro) } : {})), (f.acoes_regras ? { acoes_regras: f.acoes_regras.map((r) => (r ? Object.assign(Object.assign(Object.assign({}, pg(r)), (r.campos ? { campos: comPaginas(r.campos) } : {})), (r.ao_registro ? { ao_registro: pg(r.ao_registro) } : {})) : r)) } : {}))));
    const form = obj((_b = ctx.tipo) === null || _b === void 0 ? void 0 : _b.formulario);
    const tipo = ctx.tipo ? Object.assign(Object.assign(Object.assign(Object.assign({ nome: ctx.tipo.nome }, (ctx.tipo.sigla ? { sigla: ctx.tipo.sigla } : {})), (ctx.tipo.descricao ? { descricao: ctx.tipo.descricao } : {})), (form ? { formulario: Object.assign(Object.assign({}, form), (form.campos ? { campos: comPaginas(form.campos) } : {})) } : {})), (ctx.tipo.sigilo_padrao === 'restrito' ? { sigilo_padrao: 'restrito' } : {})) : null;
    return {
        formato: exports.FORMATO_PACOTE, versao: exports.VERSAO_PACOTE, conteudo: 'rito', gerado_em: ctx.agora || new Date().toISOString(),
        rito: { nome: rito.nome, descricao: rito.descricao || '', exigir_tipo: rito.exigir_tipo === true, fases: fasesPg },
        unidades, modelos, paginas, tipo, avisos,
    };
}
//# sourceMappingURL=pacoteRito.js.map