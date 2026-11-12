// ============================================================================
// Formulário de autuação por tipo de processo, lado da tela: tipos de campo,
// o que falta preencher e como mostrar os valores. Quem valida de verdade é o
// servidor (functions-v2/src/shared/camposProcesso.ts); isto só orienta quem
// preenche. Testado em src/lib/camposProcesso.test.js.
// ============================================================================

export const TIPOS_CAMPO = [
    ['texto', 'Texto curto'],
    ['texto_longo', 'Texto longo'],
    ['numero', 'Número'],
    ['data', 'Data'],
    ['lista', 'Lista (escolhe uma)'],
    ['multipla', 'Lista (marca várias)'],
    ['sim_nao', 'Sim ou não'],
];
/** Formatos por tipo (o primeiro é o livre). */
export const FORMATOS = {
    texto: [['', 'Livre'], ['email', 'E-mail'], ['telefone', 'Telefone'], ['cpf_cnpj', 'CPF ou CNPJ'], ['link', 'Endereço da internet']],
    numero: [['', 'Número'], ['moeda', 'Valor em reais']],
};
export const COM_OPCOES = ['lista', 'multipla'];
/** Campos que podem decidir se outro aparece. */
export const CONDICIONANTES = ['lista', 'multipla', 'sim_nao'];
export const USOS_CAMPO = [['opcional', 'Opcional'], ['obrigatorio', 'Obrigatório'], ['oculto', 'Não usar']];
/** Sigilo, urgência e unidade são escolhas: aparecem ou valem o que o tipo define. */
export const USOS_ESCOLHA = [['opcional', 'Quem autua escolhe'], ['oculto', 'Fixo pelo tipo']];
export const MAX_CAMPOS = 40;

/** Campos padrão do "Novo processo", na ordem da tela (espelho de PADROES no servidor). */
export const PADROES = [
    { id: 'assunto', rotulo: 'Assunto', escolha: false, oculto: 'O processo se chama pelo nome do tipo.' },
    { id: 'descricao', rotulo: 'Descrição', escolha: false },
    { id: 'origem', rotulo: 'Origem', escolha: false },
    { id: 'unidade', rotulo: 'Unidade', escolha: true, oculto: 'Autua pela unidade sugerida no tipo (ou a de quem autua).' },
    { id: 'sigilo', rotulo: 'Sigilo', escolha: true, oculto: 'Vale o sigilo padrão do tipo.' },
    { id: 'urgencia', rotulo: 'Tramitação urgente', escolha: true, oculto: 'Urgente só se o tipo for urgente.' },
    { id: 'partes', rotulo: 'Partes e interessados', escolha: false },
];
export const POLOS = [['requerente', 'Requerente'], ['requerido', 'Requerido'], ['interessado', 'Interessado'], ['terceiro', 'Terceiro']];

export const formularioPadrao = () => ({
    assunto: 'obrigatorio', descricao: 'opcional', partes: 'opcional', origem: 'opcional', sigilo: 'opcional', urgencia: 'opcional', unidade: 'opcional',
    rotulos: {}, ajudas: {}, polos: POLOS.map(([id]) => id), campos: [],
});

/** Formulário do tipo, com os padrões para o que faltar. */
export function formularioDe(tipo) {
    const f = tipo?.formulario || {};
    const p = formularioPadrao();
    return { ...p, ...f, rotulos: f.rotulos || {}, ajudas: f.ajudas || {}, polos: f.polos?.length ? f.polos : p.polos, campos: Array.isArray(f.campos) ? f.campos : [] };
}

/** Nome do campo padrão neste formulário. */
export const rotuloDe = (form, id) => String(form.rotulos?.[id] || '').trim() || PADROES.find((x) => x.id === id)?.rotulo || id;

export const novoCampo = () => ({
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    rotulo: '', tipo: 'texto', obrigatorio: false, ajuda: '', opcoes: [], visivel_partes: false,
});

const vazio = (v) => v === undefined || v === null || (Array.isArray(v) ? !v.length : String(v).trim() === '');
const numeroValido = (v) => /^-?\d+(\.\d+)?$/.test(String(v).trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
const digitos = (s) => String(s).replace(/\D/g, '');
// Letra (CNPJ alfanumérico) vale o código ASCII menos 48, como o dígito.
const dv = (d, pesos) => { const r = pesos.reduce((t, p, i) => t + (d.charCodeAt(i) - 48) * p, 0) % 11; return r < 2 ? 0 : 11 - r; };
/** CPF ou CNPJ (também o alfanumérico) com dígitos verificadores certos (espelho do servidor). */
export function cpfCnpjValido(s) {
    const d = String(s).toUpperCase().replace(/[\s./-]/g, '');
    if (/^(.)\1+$/.test(d)) return false;
    if (/^\d{11}$/.test(d)) return dv(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[9]) && dv(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[10]);
    if (/^[0-9A-Z]{12}\d{2}$/.test(d)) return dv(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[12]) && dv(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(d[13]);
    return false;
}
/** Endereço da internet só http ou https; sem esquema, vale https (espelho de linkValido no servidor). */
export function linkValido(s) {
    let u = null;
    try { u = new URL(/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s) ? s : `https://${s}`); } catch { u = null; }
    return !!u && ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.') && u.href.length <= 500;
}
/** O que há de errado no valor pelo formato (null = serve). */
export function erroDeFormato(c, v) {
    const s = String(v ?? '').trim();
    if (!s) return null;
    if (c.tipo === 'numero') return numeroValido(s) ? null : `"${c.rotulo}" precisa ser um número`;
    if (c.tipo !== 'texto') return null;
    if (c.formato === 'email' && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 120)) return `"${c.rotulo}" precisa ser um e-mail válido`;
    if (c.formato === 'telefone' && (!/^[\d\s()+.-]+$/.test(s) || s.length > 40 || digitos(s).length < 10 || digitos(s).length > 13)) return `"${c.rotulo}" precisa ser um telefone com DDD`;
    if (c.formato === 'cpf_cnpj' && !cpfCnpjValido(s)) return `"${c.rotulo}" precisa ser um CPF ou CNPJ válido`;
    if (c.formato === 'link' && !linkValido(s)) return `"${c.rotulo}" precisa ser um endereço da internet`;
    return null;
}

/**
 * O valor atende a condição? Na tela, sim ou não vem como 'sim'/'nao';
 * gravado, como true/false. Múltipla: a opção está entre as marcadas.
 */
export function atendeCondicao(v, cond) {
    if (Array.isArray(v)) return v.includes(String(cond.valor));
    if (typeof cond.valor === 'boolean') return v === cond.valor || v === (cond.valor ? 'sim' : 'nao');
    return v === cond.valor;
}
/** Ids dos campos que aparecem com estes valores (condição em cadeia: o campo de que depende também precisa aparecer). */
export function visiveis(campos, valores) {
    const out = new Set();
    for (const c of campos || []) {
        if (!c.condicao || (out.has(c.condicao.campo_id) && atendeCondicao(valores?.[c.condicao.campo_id], c.condicao))) out.add(c.id);
    }
    return out;
}
/** Texto curto da condição, para o editor e a prévia. */
export function textoCondicao(campos, c) {
    const alvo = (campos || []).find((d) => d.id === c.condicao?.campo_id);
    if (!alvo) return '';
    const v = typeof c.condicao.valor === 'boolean' ? (c.condicao.valor ? 'Sim' : 'Não') : c.condicao.valor;
    return alvo.tipo === 'multipla' ? `quando "${alvo.rotulo}" incluir ${v}` : `quando "${alvo.rotulo}" for ${v}`;
}

/** O que impede de autuar: lista de frases (vazia = pode). `f` = { assunto, descricao, origem, partes, campos: {id: valor} }. */
export function faltando(form, f) {
    const out = [];
    if (form.assunto === 'obrigatorio' && vazio(f.assunto)) out.push(`Preencha "${rotuloDe(form, 'assunto')}"`);
    if (form.descricao === 'obrigatorio' && vazio(f.descricao)) out.push(`Preencha "${rotuloDe(form, 'descricao')}"`);
    if (form.origem === 'obrigatorio' && vazio(f.origem?.tipo) && vazio(f.origem?.descricao)) out.push(`Informe "${rotuloDe(form, 'origem')}"`);
    if (form.partes === 'obrigatorio' && !(f.partes || []).some((p) => !vazio(p.nome))) out.push(`Informe ao menos um item em "${rotuloDe(form, 'partes')}"`);
    const aparecem = visiveis(form.campos, f.campos);
    for (const c of form.campos) {
        if (!aparecem.has(c.id)) continue;
        const v = f.campos?.[c.id];
        if (vazio(v)) { if (c.obrigatorio && !c.exigir_em?.length) out.push(`Preencha "${c.rotulo}"`); continue; }
        const erro = erroDeFormato(c, v);
        if (erro) out.push(erro);
    }
    return out;
}

/** Problemas na configuração do formulário (vazia = pode salvar). */
/** Problemas na configuração do formulário (vazia = pode salvar). `faseIds`: as do rito do tipo, para "Exigir para sair das fases". */
export function problemasFormulario(form, faseIds = null) {
    const out = [];
    const nomes = new Set();
    const reservados = [...Object.values(form.rotulos || {}).map((s) => String(s).trim().toLowerCase()).filter(Boolean), 'assunto', 'descrição', 'descricao', 'partes'];
    if (form.assunto === 'oculto' && form.descricao === 'oculto' && form.partes === 'oculto' && !form.campos.length) {
        out.push('O formulário ficaria sem nada para identificar o processo: use ao menos o assunto, a descrição, as partes ou um campo próprio');
    }
    if (form.polos && !form.polos.length) out.push('Escolha ao menos um polo para as partes');
    form.campos.forEach((c, i) => {
        const nome = String(c.rotulo || '').trim().toLowerCase();
        if (!nome) out.push(`Dê um nome ao campo ${i + 1}`);
        else if (nomes.has(nome)) out.push(`Há dois campos chamados "${c.rotulo.trim()}"`);
        else if (reservados.includes(nome)) out.push(`"${c.rotulo.trim()}" já é um campo padrão do processo`);
        nomes.add(nome);
        const nomeC = c.rotulo?.trim() || `Campo ${i + 1}`;
        const opcoes = (c.opcoes || []).map((o) => o.trim()).filter(Boolean);
        if (COM_OPCOES.includes(c.tipo) && new Set(opcoes).size < 2) out.push(`"${nomeC}": informe ao menos duas opções`);
        if (faseIds && c.exigir_em?.length && !c.exigir_em.some((f) => faseIds.includes(f))) {
            out.push(`"${nomeC}": as fases marcadas para exigir o campo não existem no rito deste tipo`);
        }
        if (c.condicao) {
            const alvo = form.campos.slice(0, i).find((d) => d.id === c.condicao.campo_id);
            const opcoesAlvo = (alvo?.opcoes || []).map((o) => o.trim());
            if (!alvo || !CONDICIONANTES.includes(alvo.tipo)) out.push(`"${nomeC}" só pode depender de um campo de lista ou de sim ou não que venha antes dele`);
            else if (alvo.tipo === 'sim_nao' ? typeof c.condicao.valor !== 'boolean' : !opcoesAlvo.includes(c.condicao.valor)) out.push(`Escolha quando "${nomeC}" aparece`);
        }
    });
    return out;
}

/**
 * O valor da tela como o servidor gravaria (null = vazio ou inválido): para a
 * prévia mostrar o que as partes veriam. Espelho de valorDe no servidor.
 */
export function valorComoGravado(c, v) {
    if (vazio(v)) return null;
    const opcoes = c.opcoes || [];
    if (c.tipo === 'multipla') {
        const l = [...new Set((Array.isArray(v) ? v : [v]).map(String))];
        return l.every((x) => opcoes.includes(x)) ? opcoes.filter((x) => l.includes(x)) : null;
    }
    if (c.tipo === 'sim_nao') return v === 'sim' || v === true ? true : v === 'nao' || v === false ? false : null;
    if (Array.isArray(v)) return null;
    const s = String(v).trim();
    if (c.tipo === 'lista') return opcoes.includes(s) ? s : null;
    if (c.tipo === 'data') return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    if (erroDeFormato(c, s)) return null;
    if (c.tipo === 'numero') {
        const n = Number(s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
        return c.formato === 'moeda' ? Math.round(n * 100) / 100 : n;
    }
    if (c.tipo !== 'texto') return s;
    if (c.formato === 'email') return s.toLowerCase();
    if (c.formato === 'link') return new URL(/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s) ? s : `https://${s}`).href;
    if (c.formato === 'cpf_cnpj') {
        const d = s.toUpperCase().replace(/[\s./-]/g, '');
        return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
    }
    return s;
}

/** Valor gravado, como texto para mostrar. */
export function valorTexto(c) {
    if (Array.isArray(c.valor)) return c.valor.join(', ');
    if (c.tipo === 'sim_nao') return c.valor ? 'Sim' : 'Não';
    if (c.tipo === 'data') return String(c.valor).split('-').reverse().join('/');
    if (c.tipo === 'numero' && c.formato === 'moeda') return `R$ ${Number(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (c.tipo === 'numero') return Number(c.valor).toLocaleString('pt-BR', { maximumFractionDigits: 10 });
    return String(c.valor);
}

/**
 * Campos gravados no processo → valores do formulário ({ id: valor }), para
 * editar. Com `form` (o do tipo hoje), o campo que virou lista de uma ou de
 * várias opções recebe o valor no jeito novo (só as opções que existem).
 */
export function valoresDe(campos, form = null) {
    const defs = new Map((form?.campos || []).map((d) => [d.id, d]));
    return Object.fromEntries((campos || []).map((c) => {
        const d = defs.get(c.id);
        if (d?.tipo === 'multipla' && !Array.isArray(c.valor)) return [c.id, (d.opcoes || []).filter((o) => o === String(c.valor))];
        if (d && d.tipo !== 'multipla' && Array.isArray(c.valor)) return [c.id, c.valor.find((o) => (d.opcoes || []).includes(o)) || ''];
        return [c.id, Array.isArray(c.valor) ? c.valor : c.tipo === 'sim_nao' ? (c.valor ? 'sim' : 'nao') : c.tipo === 'numero' ? String(c.valor).replace('.', ',') : String(c.valor)];
    }));
}

/**
 * Campos que o tipo exige para sair da fase atual e o processo ainda não tem
 * (espelho de camposFaltando no servidor). Com `form` (o do tipo hoje), só
 * conta o que o tipo ainda pede, com o nome e a condição de agora.
 */
export function camposFaltandoNaFase(p, form = null) {
    const exigidos = p?.campos_exigidos?.[p.fase_atual] || [];
    const tem = Object.fromEntries((p?.campos || []).map((c) => [c.id, c.valor]));
    const atuais = form ? new Map(form.campos.map((c) => [c.id, c])) : null;
    return exigidos.flatMap((e) => {
        const def = atuais ? atuais.get(e.id) : e;
        if (!def || e.id in tem || (def.condicao && !atendeCondicao(tem[def.condicao.campo_id], def.condicao))) return [];
        return [{ id: e.id, rotulo: def.rotulo, ...(def.condicao ? { condicao: def.condicao } : {}) }];
    });
}
