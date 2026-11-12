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
/** Sigilo, urgência e unidade são escolhas: aparecem ou valem o que o tipo define. */
export const USOS_ESCOLHA = [['opcional', 'Quem autua escolhe'], ['oculto', 'Fixo pelo tipo']];
export const MAX_CAMPOS = 20;

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

const vazio = (v) => v === undefined || v === null || String(v).trim() === '';
const numeroValido = (v) => /^-?\d+(\.\d+)?$/.test(String(v).trim().replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));

/** O que impede de autuar: lista de frases (vazia = pode). `f` = { assunto, descricao, origem, partes, campos: {id: valor} }. */
export function faltando(form, f) {
    const out = [];
    if (form.assunto === 'obrigatorio' && vazio(f.assunto)) out.push(`Preencha "${rotuloDe(form, 'assunto')}"`);
    if (form.descricao === 'obrigatorio' && vazio(f.descricao)) out.push(`Preencha "${rotuloDe(form, 'descricao')}"`);
    if (form.origem === 'obrigatorio' && vazio(f.origem?.tipo) && vazio(f.origem?.descricao)) out.push(`Informe "${rotuloDe(form, 'origem')}"`);
    if (form.partes === 'obrigatorio' && !(f.partes || []).some((p) => !vazio(p.nome))) out.push(`Informe ao menos um item em "${rotuloDe(form, 'partes')}"`);
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
