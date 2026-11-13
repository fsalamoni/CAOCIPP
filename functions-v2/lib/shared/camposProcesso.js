"use strict";
// ============================================================================
// Formulário de autuação por tipo de processo: como o "Novo processo" mostra
// cada campo padrão (assunto, descrição, partes, origem, sigilo, urgência e
// unidade: uso, nome e orientação), que polos as partes podem ter, os campos
// próprios do órgão e a validação do que foi preenchido. Lógica pura, testada em
// test/camposProcesso.test.js. O cliente tem o espelho em
// src/lib/camposProcesso.js (só para a tela; quem decide é o servidor).
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
exports.atendeCondicao = exports.rotuloDe = exports.POLOS = exports.ROTULO_PADRAO = exports.PADROES = exports.MAX_OPCOES = exports.MAX_CAMPOS = exports.FORMATOS = exports.TIPOS_CAMPO = void 0;
exports.formularioDe = formularioDe;
exports.sanitizeCampos = sanitizeCampos;
exports.sanitizeFormulario = sanitizeFormulario;
exports.cpfCnpj = cpfCnpj;
exports.linkValido = linkValido;
exports.valorDe = valorDe;
exports.validarCampos = validarCampos;
exports.camposExigidos = camposExigidos;
exports.camposFaltando = camposFaltando;
exports.validarPadrao = validarPadrao;
exports.valorTexto = valorTexto;
exports.dadoDoFormulario = dadoDoFormulario;
exports.formParaCorrecao = formParaCorrecao;
exports.diferencasCampos = diferencasCampos;
exports.retificarPartes = retificarPartes;
const modulos_1 = require("./modulos");
// Sem importar ./secretaria: o rito (./exigencias, que ./secretaria importa) usa os campos
// na ação que pede um formulário. O mesmo corte de texto de lá.
const MAX_TEXTO_CURTO = 200;
const MAX_TEXTO_LONGO = 4000;
const texto = (v, max = MAX_TEXTO_CURTO) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
exports.TIPOS_CAMPO = ['texto', 'texto_longo', 'numero', 'data', 'lista', 'multipla', 'sim_nao', 'registro'];
/** Formato que valida e mostra o valor: os de texto curto e, para número, moeda. */
exports.FORMATOS = ['email', 'telefone', 'cpf_cnpj', 'link', 'moeda'];
const FORMATO_DO_TIPO = { email: 'texto', telefone: 'texto', cpf_cnpj: 'texto', link: 'texto', moeda: 'numero' };
const COM_OPCOES = ['lista', 'multipla'];
/** Campos que podem decidir se outro aparece. */
const CONDICIONANTES = ['lista', 'multipla', 'sim_nao'];
exports.MAX_CAMPOS = 40;
exports.MAX_OPCOES = 30;
const USOS = ['opcional', 'obrigatorio', 'oculto'];
/** Campos padrão do "Novo processo". Os de escolha (sigilo, urgência, unidade) só se mostram ou não. */
exports.PADROES = ['assunto', 'descricao', 'partes', 'origem', 'sigilo', 'urgencia', 'unidade'];
const DE_ESCOLHA = ['sigilo', 'urgencia', 'unidade'];
exports.ROTULO_PADRAO = {
    assunto: 'Assunto', descricao: 'Descrição', partes: 'Partes e interessados', origem: 'Origem',
    sigilo: 'Sigilo', urgencia: 'Tramitação urgente', unidade: 'Unidade',
};
exports.POLOS = ['requerente', 'requerido', 'interessado', 'terceiro'];
const uso = (v, padrao = 'opcional') => (USOS.includes(v) ? v : padrao);
// Sigilo, urgência e unidade são escolhas: aparecem (opcional) ou não (oculto).
const usoDe = (k, v) => {
    if (DE_ESCOLHA.includes(k))
        return v === 'oculto' ? 'oculto' : 'opcional';
    return uso(v, k === 'assunto' ? 'obrigatorio' : 'opcional');
};
const textos = (v, max) => {
    const o = (v && typeof v === 'object' ? v : {});
    return Object.fromEntries(exports.PADROES.map((k) => [k, texto(o[k], max)]).filter(([, s]) => s));
};
const polosDe = (v) => {
    const l = exports.POLOS.filter((p) => Array.isArray(v) && v.includes(p));
    return l.length ? l : [...exports.POLOS];
};
const padroesDe = (f) => ({
    assunto: usoDe('assunto', f.assunto), descricao: usoDe('descricao', f.descricao), partes: usoDe('partes', f.partes),
    origem: usoDe('origem', f.origem), sigilo: usoDe('sigilo', f.sigilo), urgencia: usoDe('urgencia', f.urgencia), unidade: usoDe('unidade', f.unidade),
    rotulos: textos(f.rotulos, 60), ajudas: textos(f.ajudas, 200), polos: polosDe(f.polos),
});
/** Nome do campo padrão neste formulário. */
const rotuloDe = (form, k) => { var _a; return ((_a = form.rotulos) === null || _a === void 0 ? void 0 : _a[k]) || exports.ROTULO_PADRAO[k]; };
exports.rotuloDe = rotuloDe;
const igual = (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;
/** Formulário gravado no tipo, com os padrões para o que faltar (tipos antigos não têm). */
function formularioDe(tipo) {
    const f = ((tipo === null || tipo === void 0 ? void 0 : tipo.formulario) && typeof tipo.formulario === 'object' ? tipo.formulario : {});
    return Object.assign(Object.assign({}, padroesDe(f)), { campos: Array.isArray(f.campos) ? f.campos : [] });
}
/**
 * Saneia uma lista de campos (do tipo de processo ou da ação que pede um
 * formulário): nome, tipo, opções, módulo, formato, condição e nomes repetidos.
 * Lança Error com mensagem para o usuário. O teto de quantidade fica com quem chama.
 */
function sanitizeCampos(lista) {
    const ids = new Set();
    const campos = lista.map((x, i) => {
        const o = (x && typeof x === 'object' ? x : {});
        const rotulo = texto(o.rotulo, 80);
        if (!rotulo)
            throw new Error(`Dê um nome ao campo ${i + 1}`);
        const tipo = exports.TIPOS_CAMPO.includes(o.tipo) ? o.tipo : 'texto';
        const opcoes = COM_OPCOES.includes(tipo)
            ? [...new Set((Array.isArray(o.opcoes) ? o.opcoes : []).map((s) => texto(s, 80)).filter(Boolean))].slice(0, exports.MAX_OPCOES)
            : [];
        if (COM_OPCOES.includes(tipo) && opcoes.length < 2)
            throw new Error(`O campo "${rotulo}" é uma lista: informe ao menos duas opções`);
        const modulo = tipo === 'registro' && modulos_1.MODULOS.includes(o.modulo) ? o.modulo : undefined;
        if (tipo === 'registro' && !modulo)
            throw new Error(`Escolha de que módulo vem o registro de "${rotulo}"`);
        const formato = exports.FORMATOS.includes(o.formato) && FORMATO_DO_TIPO[o.formato] === tipo ? o.formato : undefined;
        const secao = texto(o.secao, 60);
        const exigir = [...new Set((Array.isArray(o.exigir_em) ? o.exigir_em : []).map((s) => texto(s, 60)).filter(Boolean))].slice(0, 30);
        // O id identifica o campo nos processos já autuados: não muda quando o nome muda.
        let id = typeof o.id === 'string' && /^[a-z0-9_]{1,24}$/.test(o.id) ? o.id : '';
        if (!id || ids.has(id))
            id = `c${Date.now().toString(36)}${i}`;
        ids.add(id);
        return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ id, rotulo, tipo, obrigatorio: o.obrigatorio === true && !exigir.length, ajuda: texto(o.ajuda), opcoes, visivel_partes: o.visivel_partes === true }, (formato ? { formato } : {})), (modulo ? { modulo } : {})), (secao ? { secao } : {})), (exigir.length ? { exigir_em: exigir } : {})), (o.condicao && typeof o.condicao === 'object' ? { condicao: o.condicao } : {})), (o.importar && typeof o.importar === 'object' ? { importar: { de: texto(o.importar.de, 24), dado: texto(o.importar.dado, 24) } } : {}));
    });
    // Dado importado: vem de um campo 'registro' do mesmo formulário, de um dado
    // que o módulo dele tem, e cabe no tipo do campo; nunca vai às partes.
    campos.forEach((c) => {
        if (!c.importar)
            return;
        const alvo = campos.find((d) => d.id === c.importar.de && d.tipo === 'registro');
        if (!alvo || !alvo.modulo)
            throw new Error(`"${c.rotulo}" só pode ser preenchido com dado de um campo de registro deste formulário`);
        const tipoDado = modulos_1.DADOS_REGISTRO[alvo.modulo][c.importar.dado];
        if (!tipoDado)
            throw new Error(`"${c.rotulo}": ${modulos_1.ROTULO_MODULO[alvo.modulo]} não tem esse dado`);
        if (tipoDado === 'data' ? c.tipo !== 'data' : !(c.tipo === 'texto_longo' || (c.tipo === 'texto' && !c.formato))) {
            throw new Error(`"${c.rotulo}" não combina com esse dado: ${tipoDado === 'data' ? 'uma data só vai para campo de data' : 'um texto só vai para campo de texto livre ou de texto longo'}`);
        }
        c.visivel_partes = false;
    });
    // Condição: aponta um campo de escolha que vem antes, e um valor que ele aceita.
    campos.forEach((c, i) => {
        if (!c.condicao)
            return;
        const alvo = campos.slice(0, i).find((d) => d.id === String(c.condicao.campo_id));
        if (!alvo || !CONDICIONANTES.includes(alvo.tipo)) {
            throw new Error(`"${c.rotulo}" só pode depender de um campo de lista ou de sim ou não que venha antes dele`);
        }
        const v = c.condicao.valor;
        const valor = alvo.tipo === 'sim_nao' ? (v === true || v === 'sim' ? true : v === false || v === 'nao' ? false : null) : typeof v === 'string' && alvo.opcoes.includes(texto(v, 80)) ? texto(v, 80) : null;
        if (valor === null)
            throw new Error(`Escolha quando "${c.rotulo}" aparece: um valor de "${alvo.rotulo}"`);
        c.condicao = { campo_id: alvo.id, valor };
    });
    campos.forEach((c, i) => {
        if (campos.some((d, j) => j < i && igual(d.rotulo, c.rotulo)))
            throw new Error(`Há dois campos chamados "${c.rotulo}"`);
    });
    return campos;
}
/** Saneia o formulário vindo do cliente. Lança Error com mensagem para o usuário. */
function sanitizeFormulario(input) {
    const src = (input && typeof input === 'object' ? input : {});
    const lista = Array.isArray(src.campos) ? src.campos : [];
    if (lista.length > exports.MAX_CAMPOS)
        throw new Error(`O tipo aceita até ${exports.MAX_CAMPOS} campos próprios`);
    const campos = sanitizeCampos(lista);
    const padroes = padroesDe(src);
    const reservados = [...Object.values(padroes.rotulos), 'assunto', 'descrição', 'descricao', 'partes'];
    campos.forEach((c) => {
        if (reservados.some((r) => igual(r, c.rotulo)))
            throw new Error(`"${c.rotulo}" já é um campo padrão do processo`);
    });
    if (padroes.assunto === 'oculto' && padroes.descricao === 'oculto' && padroes.partes === 'oculto' && !campos.length) {
        throw new Error('O formulário ficaria sem nada para identificar o processo: use ao menos o assunto, a descrição, as partes ou um campo próprio');
    }
    return Object.assign(Object.assign({}, padroes), { campos });
}
const vazio = (v) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);
const digitos = (s) => s.replace(/\D/g, '');
// Valor de cada caractere no cálculo: dígito vale o próprio número; letra (CNPJ alfanumérico) vale o código ASCII menos 48.
function dv(base, pesos) {
    const r = pesos.reduce((t, p, i) => t + (base.charCodeAt(i) - 48) * p, 0) % 11;
    return r < 2 ? 0 : 11 - r;
}
/**
 * CPF (11 dígitos) ou CNPJ (14 posições; as 12 primeiras podem ter letras,
 * IN RFB 2.229/2024), com os dígitos verificadores. Devolve formatado ou null.
 */
function cpfCnpj(s) {
    const d = s.toUpperCase().replace(/[\s./-]/g, '');
    if (/^(.)\1+$/.test(d))
        return null;
    if (/^\d{11}$/.test(d)) {
        const ok = dv(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[9]) && dv(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[10]);
        return ok ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : null;
    }
    if (/^[0-9A-Z]{12}\d{2}$/.test(d)) {
        const ok = dv(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12]) && dv(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13]);
        return ok ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : null;
    }
    return null;
}
/** Endereço da internet só http ou https; sem esquema, vale https (exemplo.org:8080 é porta, não esquema). */
function linkValido(s) {
    let u = null;
    const comEsquema = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s);
    try {
        u = new URL(comEsquema ? s : `https://${s}`);
    }
    catch (_a) {
        u = null;
    }
    if (!u || !['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.') || u.href.length > 500)
        return null;
    return u.href;
}
/** Texto curto conforme o formato. Lança Error se não servir. */
function comFormato(rotulo, formato, s) {
    if (formato === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 120)
            throw new Error(`"${rotulo}" precisa ser um e-mail válido`);
        return s.toLowerCase();
    }
    if (formato === 'telefone') {
        const n = digitos(s).length;
        if (!/^[\d\s()+.-]+$/.test(s) || s.length > 40 || n < 10 || n > 13)
            throw new Error(`"${rotulo}" precisa ser um telefone com DDD`);
        return s;
    }
    if (formato === 'cpf_cnpj') {
        const f = cpfCnpj(s);
        if (!f)
            throw new Error(`"${rotulo}" precisa ser um CPF ou CNPJ válido`);
        return f;
    }
    if (formato === 'link') {
        const href = linkValido(s);
        if (!href)
            throw new Error(`"${rotulo}" precisa ser um endereço da internet`);
        return href;
    }
    return s;
}
/** Um valor, já no formato de gravar; null se veio vazio. Lança Error se inválido. */
function valorDe(c, v) {
    if (vazio(v))
        return null;
    if (c.tipo === 'multipla') {
        const l = [...new Set((Array.isArray(v) ? v : [v]).map((x) => String(x !== null && x !== void 0 ? x : '').trim()).filter(Boolean))];
        if (l.some((x) => !c.opcoes.includes(x)))
            throw new Error(`Escolha entre as opções de "${c.rotulo}"`);
        // Na ordem das opções, para mostrar e comparar sempre igual.
        return l.length ? c.opcoes.filter((x) => l.includes(x)) : null;
    }
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
        const r = c.formato === 'moeda' ? Math.round(n * 100) / 100 : n;
        if (!Number.isFinite(r) || Math.abs(r) > 1e15)
            throw new Error(`"${c.rotulo}" está fora do limite`);
        return r;
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
    if (c.tipo === 'texto' && c.formato)
        return comFormato(c.rotulo, c.formato, s);
    return s.slice(0, c.tipo === 'texto_longo' ? MAX_TEXTO_LONGO : MAX_TEXTO_CURTO);
}
/** O valor atende a condição? (lista: igual; múltipla: entre os marcados; sim ou não: igual). */
const atendeCondicao = (valor, cond) => Array.isArray(valor) ? valor.includes(String(cond.valor)) : valor === cond.valor;
exports.atendeCondicao = atendeCondicao;
/**
 * Confere o que foi preenchido contra o formulário do tipo e devolve os campos
 * a gravar no processo (cópia do nome e do tipo: mudar o tipo depois não
 * altera processos já autuados). Lança Error com mensagem para o usuário.
 */
/** O valor veio igual ao gravado, como a tela o mostra (espelho de valoresDe no cliente)? */
function igualAoGravado(a, bruto) {
    if (a.tipo === 'registro')
        return !!a.ref && (0, modulos_1.idEscolhido)(bruto) === a.ref.id;
    if (Array.isArray(a.valor))
        return Array.isArray(bruto) && bruto.length === a.valor.length && bruto.every((x, i) => x === a.valor[i]);
    if (a.tipo === 'sim_nao')
        return bruto === a.valor || bruto === (a.valor ? 'sim' : 'nao');
    if (a.tipo === 'numero')
        return bruto === a.valor || String(bruto !== null && bruto !== void 0 ? bruto : '').trim() === String(a.valor).replace('.', ',');
    return typeof bruto === 'string' && bruto.trim() === String(a.valor);
}
/**
 * `antes` (ao corrigir os dados): valor que voltou igual ao gravado fica como
 * está, mesmo que o tipo tenha mudado depois (formato, opções, tipo do campo).
 * Assim um processo antigo não trava nem ganha diferença que ninguém fez.
 */
function validarCampos(form, valores, antes = [], refs = new Map()) {
    var _a, _b, _c;
    const v = (valores && typeof valores === 'object' ? valores : {});
    const out = [];
    const lidos = new Map();
    const gravados = new Map(antes.map((a) => [a.id, a]));
    for (const c of form.campos) {
        // Campo que não aparece (a condição não se cumpre) não vale nem é exigido.
        if (c.condicao && !(0, exports.atendeCondicao)(lidos.get(c.condicao.campo_id), c.condicao))
            continue;
        const gravado = gravados.get(c.id);
        if (gravado && igualAoGravado(gravado, v[c.id])) {
            lidos.set(c.id, gravado.valor);
            out.push(Object.assign(Object.assign({}, gravado), { rotulo: c.rotulo, visivel_partes: c.visivel_partes && !((_a = gravado.ref) === null || _a === void 0 ? void 0 : _a.restrito) }));
            continue;
        }
        if (c.tipo === 'registro') {
            // O servidor já leu o registro escolhido (refs); do cliente só vale o id.
            const id = (0, modulos_1.idEscolhido)(v[c.id]);
            if (!id) {
                if (c.obrigatorio && !((_b = c.exigir_em) === null || _b === void 0 ? void 0 : _b.length))
                    throw new Error(`Escolha "${c.rotulo}"`);
                continue;
            }
            const ref = refs.get(c.id);
            if (ref === 'desligada')
                throw new Error(`A integração com ${modulos_1.ROTULO_MODULO[c.modulo]} está desligada neste órgão: "${c.rotulo}" não pode ser escolhido agora`);
            if (!ref || ref.id !== id || ref.modulo !== c.modulo)
                throw new Error(`"${c.rotulo}": registro não encontrado em ${modulos_1.ROTULO_MODULO[c.modulo] || 'outro módulo'}`);
            lidos.set(c.id, ref.numero);
            out.push({ id: c.id, rotulo: c.rotulo, tipo: 'registro', valor: ref.numero, ref, visivel_partes: c.visivel_partes && !ref.restrito });
            continue;
        }
        const valor = valorDe(c, v[c.id]);
        if (valor === null) {
            if (c.obrigatorio && !((_c = c.exigir_em) === null || _c === void 0 ? void 0 : _c.length))
                throw new Error(`Preencha "${c.rotulo}"`);
            continue;
        }
        lidos.set(c.id, valor);
        out.push(Object.assign({ id: c.id, rotulo: c.rotulo, tipo: c.tipo, valor, visivel_partes: c.visivel_partes }, (c.formato ? { formato: c.formato } : {})));
    }
    return out;
}
/** Na autuação: por fase do processo, os campos exigidos para sair dela. */
function camposExigidos(form, faseIds) {
    const out = {};
    for (const c of form.campos) {
        for (const f of c.exigir_em || []) {
            if (faseIds.includes(f))
                (out[f] || (out[f] = [])).push(Object.assign({ id: c.id, rotulo: c.rotulo }, (c.condicao ? { condicao: c.condicao } : {})));
        }
    }
    return out;
}
/**
 * Campos exigidos na fase que o processo ainda não tem (os que não aparecem
 * pela condição não contam). Com `form` (o do tipo hoje), só conta o campo que
 * o tipo ainda pede, com o nome e a condição de agora: o que o tipo deixou de
 * ter não teria como ser preenchido.
 */
function camposFaltando(exigidos, campos, form) {
    const tem = new Map((campos || []).map((c) => [c.id, c.valor]));
    const atuais = form ? new Map(form.campos.map((c) => [c.id, c])) : null;
    const out = [];
    for (const e of exigidos || []) {
        const def = atuais ? atuais.get(e.id) : e;
        if (!def || tem.has(e.id))
            continue;
        if (def.condicao && !(0, exports.atendeCondicao)(tem.get(def.condicao.campo_id), def.condicao))
            continue;
        out.push(Object.assign({ id: e.id, rotulo: def.rotulo }, (def.condicao ? { condicao: def.condicao } : {})));
    }
    return out;
}
/** Confere os campos padrão conforme o tipo. */
function validarPadrao(form, v) {
    if (form.assunto === 'obrigatorio' && !v.assunto)
        throw new Error(`Preencha "${(0, exports.rotuloDe)(form, 'assunto')}"`);
    if (form.descricao === 'obrigatorio' && !v.descricao)
        throw new Error(`Preencha "${(0, exports.rotuloDe)(form, 'descricao')}"`);
    if (form.partes === 'obrigatorio' && !v.partes.length)
        throw new Error(`Informe ao menos um item em "${(0, exports.rotuloDe)(form, 'partes')}"`);
    if (form.origem === 'obrigatorio' && !v.origem)
        throw new Error(`Informe "${(0, exports.rotuloDe)(form, 'origem')}"`);
}
/** Valor como texto, para movimentos, busca e PDF. */
function valorTexto(c) {
    var _a;
    if (c.tipo === 'registro' && ((_a = c.ref) === null || _a === void 0 ? void 0 : _a.titulo))
        return `${c.valor} (${c.ref.titulo})`;
    if (Array.isArray(c.valor))
        return c.valor.join(', ');
    if (c.tipo === 'sim_nao')
        return c.valor ? 'Sim' : 'Não';
    if (c.tipo === 'data')
        return String(c.valor).split('-').reverse().join('/');
    if (c.tipo === 'numero' && c.formato === 'moeda') {
        return `R$ ${Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (c.tipo === 'numero')
        return String(c.valor).replace('.', ',');
    return String(c.valor);
}
/**
 * O dado de uma ação que pede um formulário: os campos preenchidos (sem a
 * marca de partes, que é da ação), em texto "Campo: valor; ..." e os
 * registros escolhidos (restrito se algum for).
 */
function dadoDoFormulario(rotulo, campos) {
    const refs = campos.map((c) => c.ref).filter((r) => !!r);
    return {
        rotulo, tipo: 'formulario',
        valor: campos.map((_a) => {
            var { visivel_partes: _v } = _a, c = __rest(_a, ["visivel_partes"]);
            return c;
        }),
        // Registro só pelo número (como a ação que pede um registro): o título pode não ser das partes.
        valor_texto: campos.map((c) => `${c.rotulo}: ${c.tipo === 'registro' ? c.valor : valorTexto(c)}`).join('; '),
        ref: undefined, refs, restrito: refs.some((r) => r.restrito === true),
    };
}
/**
 * Formulário para corrigir os dados de um processo já autuado: campo que o
 * processo nunca teve, mas que apareceria com os valores gravados, deixa de
 * ser obrigatório (o tipo ganhou o obrigatório depois); campo que só estava
 * oculto pela condição segue cobrado quando aparece; campo já gravado segue
 * obrigatório (não se apaga). A descrição que ficou obrigatória depois não
 * trava processo que nunca a teve.
 */
function formParaCorrecao(form, antes, descricaoAntes) {
    const tinha = new Set(antes.map((a) => a.id));
    const valores = new Map(antes.map((a) => [a.id, a.valor]));
    const aparecia = (c) => !c.condicao || (0, exports.atendeCondicao)(valores.get(c.condicao.campo_id), c.condicao);
    return Object.assign(Object.assign(Object.assign({}, form), (form.descricao === 'obrigatorio' && descricaoAntes !== undefined && !descricaoAntes.trim() ? { descricao: 'opcional' } : {})), { campos: form.campos.map((c) => (c.obrigatorio && !tinha.has(c.id) && aparecia(c) ? Object.assign(Object.assign({}, c), { obrigatorio: false }) : c)) });
}
/** O que mudou entre os campos gravados e os novos, em frases para o movimento. */
function diferencasCampos(antes, depois) {
    const a = new Map(antes.map((c) => [c.id, c]));
    const d = new Map(depois.map((c) => [c.id, c]));
    const curto = (s) => (s.length > 80 ? `${s.slice(0, 79)}…` : s);
    // Registro: outro registro com o mesmo número e título também é mudança.
    const chave = (c) => `${valorTexto(c)}|${c.ref ? `${c.ref.modulo}:${c.ref.id}` : ''}`;
    const out = [];
    for (const c of depois) {
        const ant = a.get(c.id);
        if (!ant)
            out.push(`${c.rotulo}: "${curto(valorTexto(c))}"`);
        else if (chave(ant) !== chave(c) && valorTexto(ant) === valorTexto(c))
            out.push(`${c.rotulo}: trocado por outro registro com o mesmo número ("${curto(valorTexto(c))}")`);
        else if (valorTexto(ant) !== valorTexto(c))
            out.push(`${c.rotulo}: de "${curto(valorTexto(ant))}" para "${curto(valorTexto(c))}"`);
    }
    for (const c of antes)
        if (!d.has(c.id))
            out.push(`${c.rotulo}: apagado (era "${curto(valorTexto(c))}")`);
    return out;
}
/**
 * Retificação da lista de partes: a lista só cresce (a posição i é sempre a
 * mesma parte, porque comunicações e convites apontam pelo índice). Parte
 * existente não perde o nome; sai por `retirada`, que não volta atrás. Do
 * cliente vêm só nome, documento, e-mail, polo e o pedido de retirada; conta,
 * convites e representantes ficam como estavam. Lança Error com texto ao usuário.
 */
function retificarPartes(antes, entrada, polos, max, quem) {
    if (!Array.isArray(entrada))
        throw new Error('Lista de partes inválida');
    if (entrada.length < antes.length)
        throw new Error('Nenhuma parte pode ser apagada: use "Retirar" para tirá-la do processo');
    const reserva = polos.includes('interessado') ? 'interessado' : polos[0];
    const partes = [];
    const mudou = [];
    const retiradas = [];
    const renomeadas = [];
    entrada.forEach((x, i) => {
        const o = (x && typeof x === 'object' ? x : {});
        const a = antes[i];
        if (a === null || a === void 0 ? void 0 : a.retirada) {
            partes.push(a);
            return;
        }
        // Quem sai fica com os dados gravados: edição na mesma linha não vale.
        if (a && o.retirada === true) {
            partes.push(Object.assign(Object.assign({}, a), { retirada: quem }));
            retiradas.push(i);
            mudou.push(`Parte retirada: ${a.nome} (${a.polo})`);
            return;
        }
        const nome = texto(o.nome);
        const polo = typeof o.polo === 'string' && o.polo ? o.polo : ((a === null || a === void 0 ? void 0 : a.polo) || reserva);
        // Polo antigo que o tipo deixou de aceitar pode ficar; novo ou trocado precisa estar no tipo.
        if (polo !== (a === null || a === void 0 ? void 0 : a.polo) && !polos.includes(polo))
            throw new Error(`O polo "${polo.slice(0, 20)}" não é aceito neste tipo de processo`);
        const dados = { nome, documento: texto(o.documento, 30), email: texto(o.email, 120), polo };
        if (!a) {
            if (!nome)
                return; // linha nova em branco
            partes.push(dados);
            mudou.push(`Parte incluída: ${nome} (${polo})`);
            return;
        }
        if (!nome)
            throw new Error(`Informe o nome da ${i + 1}ª parte. Para tirá-la do processo, use "Retirar".`);
        const nova = Object.assign(Object.assign({}, a), dados);
        if (nome !== a.nome || dados.documento !== (a.documento || '') || dados.email !== (a.email || '') || polo !== a.polo) {
            mudou.push(`Parte corrigida: ${nome !== a.nome ? `${a.nome} → ${nome}` : nome} (${polo !== a.polo ? `${a.polo} → ${polo}` : polo})`);
        }
        if (nome !== a.nome)
            renomeadas.push(i);
        partes.push(nova);
    });
    if (partes.length > max)
        throw new Error(`Até ${max} partes por processo (contando as retiradas)`);
    return { partes, mudou, retiradas, renomeadas };
}
//# sourceMappingURL=camposProcesso.js.map