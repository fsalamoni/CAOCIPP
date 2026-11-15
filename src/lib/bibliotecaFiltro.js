/**
 * Filtro, ordem, grupos e destaque da biblioteca de modelos de rito (tela Novo rito).
 * Lógica pura: a interface está em src/components/secretaria/BibliotecaModelos.jsx.
 */
import { AREAS, PORTES } from './modelos/dsl.js';

export const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const ORDENS = [
    ['area', 'Por área'],
    ['relevancia', 'Mais relevantes'],
    ['nome', 'Nome (A a Z)'],
    ['curto', 'Do mais curto ao mais longo'],
    ['longo', 'Do mais longo ao mais curto'],
];

export const FILTRO_VAZIO = { busca: '', area: '', porte: '', referencia: '' };

const termos = (busca) => semAcento(busca).split(/\s+/).filter(Boolean);

/**
 * Pontos do modelo para a busca: todos os termos têm de aparecer em algum lugar
 * (senão 0); o nome vale mais que a referência, que vale mais que a base e o resto.
 */
export function pontos(m, busca) {
    const ts = termos(busca);
    if (!ts.length) return 1;
    const campos = [
        [semAcento(m.nome), 8],
        [semAcento(m.referencia), 5],
        [semAcento(m.base), 3],
        [semAcento(`${m.quando} ${(m.fases || []).map((f) => f.nome).join(' ')}`), 2],
        [semAcento(m.descricao), 1],
    ];
    let total = 0;
    for (const t of ts) {
        const p = campos.reduce((s, [txt, peso]) => s + (txt.includes(t) ? peso : 0), 0);
        if (!p) return 0;
        total += p;
    }
    return total;
}

export const temPartes = (m) => (m.tipo?.polos?.length || 0) > 0;

export function filtrar(modelos, f = FILTRO_VAZIO) {
    return modelos.filter((m) => (!f.area || m.area === f.area) && (!f.porte || m.porte === f.porte)
        && (!f.referencia || m.referencia === f.referencia) && pontos(m, f.busca) > 0);
}

const ordemPorte = (p) => PORTES.findIndex(([x]) => x === p);
const ordemArea = (a) => AREAS.findIndex(([x]) => x === a);
const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');
const tamanho = (m) => ordemPorte(m.porte) * 1000 + m.fases.length;

export function ordenar(modelos, ordem, busca = '') {
    const l = [...modelos];
    if (ordem === 'nome') return l.sort(porNome);
    if (ordem === 'curto') return l.sort((a, b) => tamanho(a) - tamanho(b) || porNome(a, b));
    if (ordem === 'longo') return l.sort((a, b) => tamanho(b) - tamanho(a) || porNome(a, b));
    if (ordem === 'relevancia') return l.sort((a, b) => pontos(b, busca) - pontos(a, busca) || porNome(a, b));
    // Por área: na ordem das áreas; dentro da área, do mais curto ao mais longo.
    return l.sort((a, b) => ordemArea(a.area) - ordemArea(b.area) || tamanho(a) - tamanho(b) || porNome(a, b));
}

/** Grupos por área, na ordem de AREAS, só com as áreas que têm modelo: [{ area, nome, modelos }]. */
export function agrupar(modelos) {
    return AREAS.map(([area, nome]) => ({ area, nome, modelos: modelos.filter((m) => m.area === area) })).filter((g) => g.modelos.length);
}

/** Referências (instituição ou lei) presentes, em ordem alfabética, com a contagem. */
export function referencias(modelos) {
    const c = new Map();
    modelos.forEach((m) => { if (m.referencia) c.set(m.referencia, (c.get(m.referencia) || 0) + 1); });
    return [...c].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
}

export const filtroAtivo = (f) => !!(f.busca.trim() || f.area || f.porte || f.referencia);

/**
 * Trechos para destacar a busca: [{ t, marca }]. Casa sem acento, mas devolve o
 * texto original (a normalização NFD de letras latinas não muda o comprimento
 * depois de tirar as marcas, por isso compara letra a letra).
 */
export function trechos(texto, busca) {
    const s = String(texto || '');
    const ts = termos(busca).filter((t) => t.length > 1);
    if (!ts.length || !s) return [{ t: s, marca: false }];
    const base = [...s].map((ch) => semAcento(ch) || ch).join('');
    const marca = new Array(s.length).fill(false);
    if (base.length === s.length) {
        for (const t of ts) {
            let i = base.indexOf(t);
            while (i >= 0) { for (let k = i; k < i + t.length; k++) marca[k] = true; i = base.indexOf(t, i + t.length); }
        }
    }
    const out = [];
    for (let i = 0; i < s.length; i++) {
        const ult = out[out.length - 1];
        if (ult && ult.marca === marca[i]) ult.t += s[i];
        else out.push({ t: s[i], marca: marca[i] });
    }
    return out;
}

const ESPECIES = { audiencia: 'audiência', instrucao: 'audiência de instrução', conciliacao: 'conciliação', oitiva: 'oitiva', sessao: 'sessão', reuniao: 'reunião', inspecao: 'inspeção' };

/** O que o modelo usa do motor, contado: comunicações, esperas, audiências, documentos, formulários, saídas, esperas e sigilo. */
export function recursosDoModelo(m) {
    const rs = m.fases.flatMap((f) => (f.acoes_regras || []).filter(Boolean));
    const n = (fn) => rs.filter(fn).length;
    return {
        comunicacoes: n((r) => r.pede === 'comunicacao'),
        esperas: n((r) => r.pede === 'resposta'),
        audiencias: [...new Set(rs.filter((r) => r.pede === 'audiencia').map((r) => ESPECIES[r.audiencia?.especie] || r.audiencia?.especie))],
        documentos: n((r) => r.documento),
        formularios: n((r) => r.pede === 'formulario'),
        saidas: m.fases.filter((f) => f.condicoes_regra && Object.keys(f.condicoes_regra).length).length,
        fasesEspera: m.fases.filter((f) => f.espera).length,
        finais: m.fases.filter((f) => f.final).length,
        sigilo: m.fases.some((f) => f.ao_entrar?.sigilo === 'restrito'),
    };
}

/** Os recursos em frases curtas, para a tela e o catálogo. */
export function recursosEmTexto(m) {
    const r = recursosDoModelo(m);
    const out = [];
    const pl = (q, um, varios) => `${q} ${q === 1 ? um : varios}`;
    if (r.comunicacoes) out.push(pl(r.comunicacoes, 'comunicação às partes', 'comunicações às partes'));
    if (r.esperas) out.push(pl(r.esperas, 'espera de resposta', 'esperas de resposta'));
    if (r.audiencias.length) out.push(`audiência (${r.audiencias.join(', ')})`);
    if (r.documentos) out.push(pl(r.documentos, 'documento', 'documentos'));
    if (r.formularios) out.push(pl(r.formularios, 'formulário de dados', 'formulários de dados'));
    if (r.saidas) out.push(pl(r.saidas, 'fase com saída decidida pela resposta', 'fases com saída decidida pela resposta'));
    if (r.fasesEspera) out.push(pl(r.fasesEspera, 'fase de espera', 'fases de espera'));
    if (r.sigilo) out.push('sigilo ao entrar');
    return out;
}
