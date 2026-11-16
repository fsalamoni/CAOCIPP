// ============================================================================
// "Vem do processo": ligar uma ação da fase a um campo do processo (espelho de
// functions-v2/src/shared/doProcesso.ts, só para a tela; quem decide é o
// servidor). Também propõe as ligações pelo nome, para o admin conferir e
// aplicar de uma vez no editor do rito. Testado em src/lib/doProcesso.test.js.
// ============================================================================

/** O que a ação pede e os tipos de campo do processo que a cumprem. 'confirmar': qualquer campo preenchido. */
export const LIGAVEL = {
    confirmar: ['texto', 'texto_longo', 'numero', 'data', 'lista', 'multipla', 'sim_nao', 'registro'],
    texto: ['texto'],
    texto_longo: ['texto', 'texto_longo'],
    numero: ['numero'],
    data: ['data'],
    lista: ['lista'],
    sim_nao: ['sim_nao'],
};
/** Campo do formulário de uma ação: os tipos de campo do processo que o preenchem. */
export const LIGAVEL_NO_FORM = { texto: ['texto'], texto_longo: ['texto', 'texto_longo'], numero: ['numero'], data: ['data'], lista: ['lista'], multipla: ['multipla'], sim_nao: ['sim_nao'] };

/** Assunto e descrição, campos padrão do "Novo processo", também servem (como texto). */
export const PADROES_LIGAVEIS = [
    { id: '@assunto', tipo: 'texto', rotulo: 'Assunto' },
    { id: '@descricao', tipo: 'texto_longo', rotulo: 'Descrição' },
];

const pedeDe = (r) => (r?.documento ? 'documento' : r?.pede || 'confirmar');
/** A ação (pelo que pede) pode vir do processo? */
export const podeLigar = (r) => pedeDe(r) === 'formulario' || pedeDe(r) in LIGAVEL;
/** A ação está ligada? */
export const ligada = (r) => !!r && (!!r.do_processo || Object.keys(r.do_processo_campos || {}).length > 0);

/**
 * Campos do processo que podem cumprir algo do tipo `tipo` (o que a ação pede,
 * ou o tipo do campo do formulário com `noForm`): os dos tipos de processo que
 * usam o rito, um por id, e o assunto e a descrição.
 */
export function camposLigaveis(tipos, tipo, noForm = false) {
    const aceitos = (noForm ? LIGAVEL_NO_FORM : LIGAVEL)[tipo] || [];
    const vistos = new Map();
    for (const t of tipos || []) {
        for (const c of t.formulario?.campos || []) {
            if (c.id && aceitos.includes(c.tipo) && !vistos.has(c.id)) vistos.set(c.id, { id: c.id, tipo: c.tipo, rotulo: c.rotulo || c.id, tipo_nome: t.nome });
        }
    }
    const padroes = tipo === 'registro' || (noForm && tipo === 'multipla') ? [] : PADROES_LIGAVEIS.filter((c) => aceitos.includes(c.tipo));
    return [...vistos.values(), ...padroes];
}

/** Nome do campo ligado, para mostrar (ou o id, se o campo saiu dos tipos). */
export function nomeDoCampo(tipos, id) {
    const p = PADROES_LIGAVEIS.find((c) => c.id === id);
    if (p) return p.rotulo;
    for (const t of tipos || []) {
        const c = (t.formulario?.campos || []).find((x) => x.id === id);
        if (c) return c.rotulo || id;
    }
    return null;
}

// ---- Sugestões pelo nome ---------------------------------------------------

const PARADAS = new Set(['a', 'o', 'as', 'os', 'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'um', 'uma', 'para', 'por', 'com', 'que', 'se',
    'registrar', 'informar', 'informe', 'anotar', 'preencher', 'indicar', 'cadastrar', 'numero', 'n', 'nº', 'data', 'dados', 'dado', 'nome']);
const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const palavras = (s) => sem(s).split(/[^a-z0-9]+/).filter((w) => w && !PARADAS.has(w));
const normal = (s) => palavras(s).join(' ');

/** O nome do dado casa com o do campo? Igual (sem acento, artigos e verbos de registro) ou um contém o outro inteiro. */
function casa(nomeDado, nomeCampo) {
    const a = normal(nomeDado);
    const b = normal(nomeCampo);
    if (!a || !b) return false;
    if (a === b) return true;
    return (` ${a} `.includes(` ${b} `) && b.length >= 4) || (` ${b} `.includes(` ${a} `) && a.length >= 4);
}

/** O melhor campo para o dado: o único que casa (com mais de um, nenhum: o admin escolhe). */
function campoQueCasa(nomes, candidatos) {
    const achados = candidatos.filter((c) => nomes.some((n) => casa(n, c.rotulo)));
    return achados.length === 1 ? achados[0] : null;
}

/**
 * Ligações que o SIGO propõe no rito, pelo nome, para o admin conferir:
 * - `ligar`: ação de dado (ou campo do formulário dela) cujo nome casa com o
 *   de um campo do processo, ainda sem ligação;
 * - `dispensar`: ação que só se marca, sem condição, na mesma fase de uma
 *   ação ligada (ou proposta), cujo texto cita a palavra-chave do campo
 *   (ex.: "converter em PGEA" e "Número do PGEA"): passa a valer só com o
 *   campo vazio.
 * [{ fase, idx, tipo: 'ligar'|'dispensar', campo, campoNome, alvo?, texto }].
 */
export function sugestoesDeLigacao(fases, tipos) {
    const out = [];
    for (const f of fases || []) {
        const ligadosNaFase = [];
        (f.acoes || []).forEach((a, i) => {
            const r = f.acoes_regras?.[i];
            if (!a?.trim() || !podeLigar(r)) return;
            const pede = pedeDe(r);
            if (pede === 'formulario') {
                for (const c of r.campos || []) {
                    if (r.do_processo_campos?.[c.id]) { ligadosNaFase.push({ idx: i, campo: r.do_processo_campos[c.id] }); continue; }
                    const alvo = campoQueCasa([c.rotulo], camposLigaveis(tipos, c.tipo, true));
                    if (alvo) {
                        out.push({ fase: f.id, idx: i, tipo: 'ligar', alvo: c.id, campo: alvo.id, campoNome: alvo.rotulo, texto: `"${c.rotulo}", em "${a.trim()}", vem de "${alvo.rotulo}"` });
                        ligadosNaFase.push({ idx: i, campo: alvo.id });
                    }
                }
                return;
            }
            if (pede === 'confirmar') return; // confirmação simples: o admin liga à mão (o nome raramente diz qual campo).
            if (r?.do_processo) { ligadosNaFase.push({ idx: i, campo: r.do_processo }); return; }
            const alvo = campoQueCasa([r?.rotulo, a].filter(Boolean), camposLigaveis(tipos, pede));
            if (alvo) {
                out.push({ fase: f.id, idx: i, tipo: 'ligar', campo: alvo.id, campoNome: alvo.rotulo, texto: `"${a.trim()}" vem de "${alvo.rotulo}"` });
                ligadosNaFase.push({ idx: i, campo: alvo.id });
            }
        });
        // Dispensa: só campo do tipo (a condição lê campo do tipo, não assunto nem descrição).
        for (const { campo } of ligadosNaFase) {
            if (campo.startsWith('@')) continue;
            const nome = nomeDoCampo(tipos, campo) || '';
            const chaves = palavras(nome).filter((w) => w.length >= 3);
            if (!chaves.length) continue;
            (f.acoes || []).forEach((a, i) => {
                const r = f.acoes_regras?.[i];
                // Com condição, a dispensa entra como "e também" (cabem até 4 partes); a que já lê o campo fica como está.
                const partes = r?.se ? [r.se, ...(r.se.e || [])] : [];
                if (pedeDe(r) !== 'confirmar' || ligada(r) || !a?.trim() || partes.length >= 4 || partes.some((p) => p.dado === `campo:${campo}`)) return;
                const ws = new Set(palavras(a));
                if (!chaves.some((w) => ws.has(w))) return;
                if (out.some((x) => x.fase === f.id && x.idx === i && x.tipo === 'dispensar')) return;
                out.push({ fase: f.id, idx: i, tipo: 'dispensar', campo, campoNome: nome, texto: `"${a.trim()}" fica dispensada quando "${nome}" já estiver preenchido` });
            });
        }
    }
    return out;
}

/** Fases com as sugestões escolhidas aplicadas (cópias; o rito original não muda). */
export function aplicarSugestoes(fases, sugestoes) {
    return (fases || []).map((f) => {
        const daFase = sugestoes.filter((s) => s.fase === f.id);
        if (!daFase.length) return f;
        const regras = (f.acoes || []).map((_a, i) => (f.acoes_regras?.[i] ? { ...f.acoes_regras[i] } : null));
        for (const s of daFase) {
            const r = regras[s.idx] || {};
            if (s.tipo === 'ligar' && s.alvo) r.do_processo_campos = { ...(r.do_processo_campos || {}), [s.alvo]: s.campo };
            else if (s.tipo === 'ligar') r.do_processo = s.campo;
            else if (s.tipo === 'dispensar') {
                const parte = { acao: -1, dado: `campo:${s.campo}`, valores: ['@vazio'], rotulo: s.campoNome, nomes: ['vazio'] };
                r.se = r.se ? { ...r.se, e: [...(r.se.e || []), parte] } : parte;
            }
            regras[s.idx] = r;
        }
        return { ...f, acoes_regras: regras };
    });
}
