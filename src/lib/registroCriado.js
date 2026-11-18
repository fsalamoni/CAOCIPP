// "Criar registro na autuação" no editor do tipo (espelho de functions-v2/src/shared/registroCriado.ts).
// O servidor confere tudo de novo ao salvar o tipo e ao autuar.

/** De onde o valor do campo da página pode vir: [fonte, rótulo]. Os campos do formulário entram como `campo:<id>`. */
export const FONTES_REGISTRO = [
    ['numero', 'Número do processo'],
    ['assunto', 'Assunto'],
    ['descricao', 'Descrição'],
    ['autuacao', 'Data da autuação'],
    ['unidade', 'Unidade que autuou'],
    ['tipo', 'Nome do tipo de processo'],
    ['partes', 'Nomes das partes'],
    ['fixo', 'Valor fixo'],
];

/** Fontes para um campo da página: as do processo e os campos do formulário do tipo. */
export function fontesDoTipo(form) {
    return [...FONTES_REGISTRO, ...(form?.campos || []).map((c) => [`campo:${c.id}`, `Campo do formulário: ${c.rotulo || c.id}`])];
}

const ordenadas = (fases) => [...(fases || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
/** Fase em que o registro nasce: a escolhida (se existe) ou a inicial da página. */
export function faseInicial(cfg, pagina) {
    const fases = pagina?.fases || [];
    if (cfg?.fase && fases.some((f) => f.key === cfg.fase)) return cfg.fase;
    return (fases.find((f) => f.is_initial) || fases[0])?.key || '';
}

/** O que impede salvar, com o mesmo texto do servidor. */
export function problemasCriaRegistro(cfg, pagina, form) {
    if (!cfg?.pagina && !cfg?.modulo) return [];
    if (!pagina) return ['A página própria escolhida em "Criar registro na autuação" não existe mais. Escolha outra ou desligue a opção.'];
    const campos = pagina.campos || [];
    const erros = [];
    if (cfg.fase && !(pagina.fases || []).some((f) => f.key === cfg.fase)) erros.push(`A fase escolhida para o registro não existe mais em ${pagina.nome}.`);
    const ids = new Set((form?.campos || []).map((c) => `campo:${c.id}`));
    for (const v of cfg.valores || []) {
        const f = campos.find((x) => x.key === v.campo);
        if (!f) erros.push(`Um campo escolhido não existe mais em ${pagina.nome}. Tire-o da lista.`);
        else if (v.de.startsWith('campo:') && !ids.has(v.de)) erros.push(`"${f.label}": o campo do formulário escolhido não existe mais neste tipo.`);
        else if (v.de === 'fixo' && !String(v.valor ?? '').trim()) erros.push(`"${f.label}": informe o valor fixo.`);
    }
    const fases = ordenadas(pagina.fases);
    const ate = fases.find((f) => f.key === faseInicial(cfg, pagina))?.order ?? 0;
    const alcancadas = new Set(fases.filter((f) => (f.order ?? 0) <= ate).map((f) => f.key));
    for (const f of campos) {
        if (f.required && (!f.phase || alcancadas.has(f.phase)) && !(cfg.valores || []).some((v) => v.campo === f.key)) {
            erros.push(`"${f.label}" é obrigatório em ${pagina.nome}: diga de onde vem o valor.`);
        }
    }
    return erros;
}

/**
 * Consultas e Expedientes também nascem na autuação (`cria_registro.modulo`):
 * os campos da ficha que o tipo pode preencher. Espelho de CAMPOS_CRIACAO em
 * functions-v2/src/shared/painelModulos.ts.
 */
export const CAMPOS_CRIACAO = {
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
const NOMES_CRIACAO = { consultas: ['Consulta', 'Consultas'], expedientes: ['Expediente', 'Expedientes'] };

/** Valor do seletor "Onde criar": `modulo:<id>` ou o id da página. */
export const valorDoCriaRegistro = (cfg) => (cfg?.modulo ? `modulo:${cfg.modulo}` : cfg?.pagina || '');
/** Configuração depois de trocar onde criar (os campos começam de novo). */
export const comDestino = (v) => (v.startsWith('modulo:') ? { pagina: '', modulo: v.slice(7), valores: [] } : { pagina: v, valores: [] });
/** O destino como página ({ nome, plural, fases, campos }), para a tela e para problemasCriaRegistro. */
export function destinoDoCriaRegistro(cfg, paginas) {
    if (cfg?.modulo) {
        const n = NOMES_CRIACAO[cfg.modulo];
        return n ? { id: `modulo:${cfg.modulo}`, nome: n[0], plural: n[1], fases: [], campos: CAMPOS_CRIACAO[cfg.modulo], modulo: cfg.modulo } : null;
    }
    return (paginas || []).find((x) => x.id === cfg?.pagina) || null;
}

/** Troca a fonte de um campo da página ('' tira o campo da lista). */
export function comFonte(cfg, campo, de, valor) {
    const resto = (cfg.valores || []).filter((v) => v.campo !== campo);
    if (!de) return { ...cfg, valores: resto };
    const atual = (cfg.valores || []).find((v) => v.campo === campo);
    const novo = de === 'fixo' ? { campo, de, valor: valor ?? (atual?.de === 'fixo' ? atual.valor : '') } : { campo, de };
    const i = (cfg.valores || []).findIndex((v) => v.campo === campo);
    const valores = [...resto];
    valores.splice(i < 0 ? valores.length : i, 0, novo);
    return { ...cfg, valores };
}
