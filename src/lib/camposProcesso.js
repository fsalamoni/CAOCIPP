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
    ['lista', 'Lista de opções'],
    ['sim_nao', 'Sim ou não'],
];
export const USOS_CAMPO = [['opcional', 'Opcional'], ['obrigatorio', 'Obrigatório'], ['oculto', 'Não usar']];
export const MAX_CAMPOS = 20;

export const formularioPadrao = () => ({ descricao: 'opcional', partes: 'opcional', campos: [] });

/** Formulário do tipo, com os padrões para o que faltar. */
export function formularioDe(tipo) {
    const f = tipo?.formulario || {};
    return { ...formularioPadrao(), ...f, campos: Array.isArray(f.campos) ? f.campos : [] };
}

export const novoCampo = () => ({
    id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    rotulo: '', tipo: 'texto', obrigatorio: false, ajuda: '', opcoes: [], visivel_partes: false,
});

const vazio = (v) => v === undefined || v === null || String(v).trim() === '';
const numeroValido = (v) => /^-?\d+(\.\d+)?$/.test(String(v).trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));

/** O que impede de autuar: lista de frases (vazia = pode). `f` = { descricao, partes, campos: {id: valor} }. */
export function faltando(form, f) {
    const out = [];
    if (form.descricao === 'obrigatorio' && vazio(f.descricao)) out.push('Preencha a descrição');
    if (form.partes === 'obrigatorio' && !(f.partes || []).some((p) => !vazio(p.nome))) out.push('Informe ao menos uma parte ou interessado');
    for (const c of form.campos) {
        const v = f.campos?.[c.id];
        if (vazio(v)) { if (c.obrigatorio) out.push(`Preencha "${c.rotulo}"`); continue; }
        if (c.tipo === 'numero' && !numeroValido(v)) out.push(`"${c.rotulo}" precisa ser um número`);
    }
    return out;
}

/** Problemas na configuração do formulário (vazia = pode salvar). */
export function problemasFormulario(form) {
    const out = [];
    const nomes = new Set();
    form.campos.forEach((c, i) => {
        const nome = String(c.rotulo || '').trim().toLowerCase();
        if (!nome) out.push(`Dê um nome ao campo ${i + 1}`);
        else if (nomes.has(nome)) out.push(`Há dois campos chamados "${c.rotulo.trim()}"`);
        else if (['assunto', 'descrição', 'descricao', 'partes'].includes(nome)) out.push(`"${c.rotulo.trim()}" já é um campo padrão do processo`);
        nomes.add(nome);
        if (c.tipo === 'lista' && new Set((c.opcoes || []).map((o) => o.trim()).filter(Boolean)).size < 2) out.push(`"${c.rotulo || `Campo ${i + 1}`}": informe ao menos duas opções`);
    });
    return out;
}

/** Valor gravado, como texto para mostrar. */
export function valorTexto(c) {
    if (c.tipo === 'sim_nao') return c.valor ? 'Sim' : 'Não';
    if (c.tipo === 'data') return String(c.valor).split('-').reverse().join('/');
    if (c.tipo === 'numero') return Number(c.valor).toLocaleString('pt-BR', { maximumFractionDigits: 10 });
    return String(c.valor);
}

/** Campos gravados no processo → valores do formulário ({ id: valor }), para editar. */
export function valoresDe(campos) {
    return Object.fromEntries((campos || []).map((c) => [c.id,
        c.tipo === 'sim_nao' ? (c.valor ? 'sim' : 'nao') : c.tipo === 'numero' ? String(c.valor).replace('.', ',') : String(c.valor)]));
}
