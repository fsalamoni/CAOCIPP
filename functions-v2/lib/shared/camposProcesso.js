"use strict";
// ============================================================================
// Formulário de autuação por tipo de processo: quais campos o "Novo processo"
// mostra (os padrões Descrição e Partes, e campos próprios do órgão) e a
// validação do que foi preenchido. Lógica pura, testada em
// test/camposProcesso.test.js. O cliente tem o espelho em
// src/lib/camposProcesso.js (só para a tela; quem decide é o servidor).
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_OPCOES = exports.MAX_CAMPOS = exports.TIPOS_CAMPO = void 0;
exports.formularioDe = formularioDe;
exports.sanitizeFormulario = sanitizeFormulario;
exports.validarCampos = validarCampos;
exports.validarPadrao = validarPadrao;
exports.valorTexto = valorTexto;
exports.diferencasCampos = diferencasCampos;
const secretaria_1 = require("./secretaria");
exports.TIPOS_CAMPO = ['texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao'];
exports.MAX_CAMPOS = 20;
exports.MAX_OPCOES = 30;
const USOS = ['opcional', 'obrigatorio', 'oculto'];
const uso = (v) => (USOS.includes(v) ? v : 'opcional');
const igual = (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;
/** Formulário gravado no tipo, com os padrões para o que faltar (tipos antigos não têm). */
function formularioDe(tipo) {
    const f = ((tipo === null || tipo === void 0 ? void 0 : tipo.formulario) && typeof tipo.formulario === 'object' ? tipo.formulario : {});
    return { descricao: uso(f.descricao), partes: uso(f.partes), campos: Array.isArray(f.campos) ? f.campos : [] };
}
/** Saneia o formulário vindo do cliente. Lança Error com mensagem para o usuário. */
function sanitizeFormulario(input) {
    const src = (input && typeof input === 'object' ? input : {});
    const lista = Array.isArray(src.campos) ? src.campos : [];
    if (lista.length > exports.MAX_CAMPOS)
        throw new Error(`O tipo aceita até ${exports.MAX_CAMPOS} campos próprios`);
    const ids = new Set();
    const campos = lista.map((x, i) => {
        const o = (x && typeof x === 'object' ? x : {});
        const rotulo = (0, secretaria_1.texto)(o.rotulo, 80);
        if (!rotulo)
            throw new Error(`Dê um nome ao campo ${i + 1}`);
        const tipo = exports.TIPOS_CAMPO.includes(o.tipo) ? o.tipo : 'texto';
        const opcoes = tipo === 'lista'
            ? [...new Set((Array.isArray(o.opcoes) ? o.opcoes : []).map((s) => (0, secretaria_1.texto)(s, 80)).filter(Boolean))].slice(0, exports.MAX_OPCOES)
            : [];
        if (tipo === 'lista' && opcoes.length < 2)
            throw new Error(`O campo "${rotulo}" é uma lista: informe ao menos duas opções`);
        // O id identifica o campo nos processos já autuados: não muda quando o nome muda.
        let id = typeof o.id === 'string' && /^[a-z0-9_]{1,24}$/.test(o.id) ? o.id : '';
        if (!id || ids.has(id))
            id = `c${Date.now().toString(36)}${i}`;
        ids.add(id);
        return { id, rotulo, tipo, obrigatorio: o.obrigatorio === true, ajuda: (0, secretaria_1.texto)(o.ajuda), opcoes, visivel_partes: o.visivel_partes === true };
    });
    campos.forEach((c, i) => {
        if (campos.some((d, j) => j < i && igual(d.rotulo, c.rotulo)))
            throw new Error(`Há dois campos chamados "${c.rotulo}"`);
        if (['assunto', 'descrição', 'descricao', 'partes'].some((r) => igual(r, c.rotulo)))
            throw new Error(`"${c.rotulo}" já é um campo padrão do processo`);
    });
    return { descricao: uso(src.descricao), partes: uso(src.partes), campos };
}
const vazio = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim());
/** Um valor, já no formato de gravar; null se veio vazio. Lança Error se inválido. */
function valorDe(c, v) {
    if (vazio(v))
        return null;
    if (c.tipo === 'sim_nao') {
        if (v === true || v === 'sim')
            return true;
        if (v === false || v === 'nao')
            return false;
        throw new Error(`Responda sim ou não em "${c.rotulo}"`);
    }
    if (c.tipo === 'numero') {
        const s = typeof v === 'number' ? String(v) : String(v).trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
        const n = Number(s);
        if (!/^-?\d+(\.\d+)?$/.test(s) || !Number.isFinite(n))
            throw new Error(`"${c.rotulo}" precisa ser um número`);
        return n;
    }
    const s = String(v).trim();
    if (c.tipo === 'data') {
        const d = new Date(`${s}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s)
            throw new Error(`"${c.rotulo}" precisa ser uma data válida`);
        return s;
    }
    if (c.tipo === 'lista') {
        if (!c.opcoes.includes(s))
            throw new Error(`Escolha uma das opções de "${c.rotulo}"`);
        return s;
    }
    return s.slice(0, c.tipo === 'texto_longo' ? secretaria_1.MAX_TEXTO_LONGO : secretaria_1.MAX_TEXTO_CURTO);
}
/**
 * Confere o que foi preenchido contra o formulário do tipo e devolve os campos
 * a gravar no processo (cópia do nome e do tipo: mudar o tipo depois não
 * altera processos já autuados). Lança Error com mensagem para o usuário.
 */
function validarCampos(form, valores) {
    const v = (valores && typeof valores === 'object' ? valores : {});
    const out = [];
    for (const c of form.campos) {
        const valor = valorDe(c, v[c.id]);
        if (valor === null) {
            if (c.obrigatorio)
                throw new Error(`Preencha "${c.rotulo}"`);
            continue;
        }
        out.push({ id: c.id, rotulo: c.rotulo, tipo: c.tipo, valor, visivel_partes: c.visivel_partes });
    }
    return out;
}
/** Confere os campos padrão (Descrição e Partes) conforme o tipo. */
function validarPadrao(form, descricao, partes) {
    if (form.descricao === 'obrigatorio' && !descricao)
        throw new Error('Preencha a descrição');
    if (form.partes === 'obrigatorio' && !partes.length)
        throw new Error('Informe ao menos uma parte ou interessado');
}
/** Valor como texto, para movimentos, busca e PDF. */
function valorTexto(c) {
    if (c.tipo === 'sim_nao')
        return c.valor ? 'Sim' : 'Não';
    if (c.tipo === 'data')
        return String(c.valor).split('-').reverse().join('/');
    if (c.tipo === 'numero')
        return String(c.valor).replace('.', ',');
    return String(c.valor);
}
/** O que mudou entre os campos gravados e os novos, em frases para o movimento. */
function diferencasCampos(antes, depois) {
    const a = new Map(antes.map((c) => [c.id, c]));
    const d = new Map(depois.map((c) => [c.id, c]));
    const curto = (s) => (s.length > 80 ? `${s.slice(0, 79)}…` : s);
    const out = [];
    for (const c of depois) {
        const ant = a.get(c.id);
        if (!ant)
            out.push(`${c.rotulo}: "${curto(valorTexto(c))}"`);
        else if (valorTexto(ant) !== valorTexto(c))
            out.push(`${c.rotulo}: de "${curto(valorTexto(ant))}" para "${curto(valorTexto(c))}"`);
    }
    for (const c of antes)
        if (!d.has(c.id))
            out.push(`${c.rotulo}: apagado (era "${curto(valorTexto(c))}")`);
    return out;
}
//# sourceMappingURL=camposProcesso.js.map