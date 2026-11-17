// Importar listas do órgão de um arquivo: o que já existe, o que cabe e a mescla
// com as listas da tela (o servidor lê o arquivo; ver functions-v2/src/shared/listasOrgao.ts).

/** Espelho de MAX_ITENS_LISTA em functions-v2/src/shared/listasOrgao.ts. */
export const MAX_ITENS = 30;
export const ROTULO_LISTA = { comunicacao: 'Espécies de comunicação', audiencia: 'Espécies de audiência', origem: 'Origens do processo' };

const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Situação de cada item da prévia: 'existe' (já no sistema ou na lista), 'repetido'
 * (outro item marcado igual), 'sem_lista' ou 'ok'. `sistema`: nomes do sistema por lista.
 */
export function situacoes(itens, listas, sistema) {
    const vistos = new Set();
    return itens.map((it) => {
        if (!it.lista) return 'sem_lista';
        const k = sem(it.nome);
        if (!k) return 'sem_nome';
        if ((sistema[it.lista] || []).some((n) => sem(n) === k) || (listas[it.lista] || []).some((x) => sem(x.nome) === k)) return 'existe';
        if (it.incluir && vistos.has(`${it.lista}:${k}`)) return 'repetido';
        if (it.incluir) vistos.add(`${it.lista}:${k}`);
        return 'ok';
    });
}

/** Itens marcados que entram, por lista, e as listas que passariam do limite. */
export function resumo(itens, listas, sistema) {
    const sit = situacoes(itens, listas, sistema);
    const entram = { comunicacao: [], audiencia: [], origem: [] };
    itens.forEach((it, i) => { if (it.incluir && sit[i] === 'ok') entram[it.lista].push(it); });
    const estouro = Object.keys(entram).filter((k) => entram[k].length && (listas[k] || []).length + entram[k].length > MAX_ITENS);
    return { sit, entram, total: Object.values(entram).reduce((n, l) => n + l.length, 0), estouro };
}

/** Listas da tela com os itens novos no fim (gênero só nas espécies). */
export function mesclar(listas, entram) {
    const out = { ...listas };
    for (const [k, novos] of Object.entries(entram)) {
        if (!novos.length) continue;
        out[k] = [...(listas[k] || []), ...novos.map((it) => ({ nome: it.nome.trim(), ...(k !== 'origem' && it.m ? { m: true } : {}) }))];
    }
    return out;
}

const MIMES = {
    txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', tsv: 'text/csv', json: 'application/json',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', doc: 'application/msword', odt: 'application/vnd.oasis.opendocument.text',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel', ods: 'application/vnd.oasis.opendocument.spreadsheet',
    pdf: 'application/pdf',
};
export const ACEITOS = Object.keys(MIMES).map((e) => `.${e}`).join(',');
/** Tipo do arquivo pela extensão (o servidor confere o conteúdo), ou null se não for aceito. */
export const mimeDoArquivo = (nome) => MIMES[String(nome || '').split('.').pop().toLowerCase()] || null;
