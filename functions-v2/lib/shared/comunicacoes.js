"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_TEXTOS_PRONTOS = exports.limiteCiencia = exports.textoPrazo = exports.cienciaDias = exports.MAX_COMUNICACOES = exports.MAX_CIENCIA_DIAS = exports.CIENCIA_DIAS_PADRAO = exports.ESPECIES = void 0;
exports.sanitizePedido = sanitizePedido;
exports.aplicarCiencia = aplicarCiencia;
exports.derivadosComunicacoes = derivadosComunicacoes;
exports.destinatario = destinatario;
exports.sanitizeTextosProntos = sanitizeTextosProntos;
exports.textosProntosDe = textosProntosDe;
/**
 * Comunicações processuais (intimação, notificação, citação, ciência,
 * comunicação): a secretaria expede, o destinatário dá ciência (ou ela se dá
 * por decurso) e o prazo de resposta abre a partir da ciência. Lógica pura.
 */
const secretaria_1 = require("./secretaria");
exports.ESPECIES = {
    intimacao: 'Intimação',
    notificacao: 'Notificação',
    citacao: 'Citação',
    ciencia: 'Ciência',
    comunicacao: 'Comunicação',
};
/** Dias corridos, da expedição, até a ciência se dar por decurso. 0 desliga. */
exports.CIENCIA_DIAS_PADRAO = 10;
exports.MAX_CIENCIA_DIAS = 90;
exports.MAX_COMUNICACOES = 200;
const cienciaDias = (v) => {
    const n = Number(v);
    return v === undefined || v === null || !Number.isInteger(n) || n < 0 ? exports.CIENCIA_DIAS_PADRAO : Math.min(n, exports.MAX_CIENCIA_DIAS);
};
exports.cienciaDias = cienciaDias;
/** Valida o que a secretaria informou ao expedir. `hoje`: AAAA-MM-DD. */
function sanitizePedido(raw, hoje) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const especie = String(r.especie || '');
    if (!exports.ESPECIES[especie])
        throw new Error('Escolha a espécie da comunicação');
    const txt = (0, secretaria_1.texto)(r.texto, 4000);
    if (!txt)
        throw new Error('Escreva o que está sendo comunicado');
    const partes_idx = [...new Set((Array.isArray(r.partes_idx) ? r.partes_idx : []).filter((n) => Number.isInteger(n) && n >= 0))];
    if (!partes_idx.length)
        throw new Error('Escolha ao menos um destinatário');
    // O prazo precisa ser dito: dias, ou "sem prazo" de forma explícita.
    const semPrazo = r.sem_prazo === true;
    const dias = semPrazo ? 0 : Number(r.dias);
    if (!semPrazo && (!Number.isInteger(dias) || dias < 1 || dias > secretaria_1.MAX_PRAZO_DIAS))
        throw new Error('Informe o prazo em dias ou marque que a comunicação não abre prazo');
    const outro_meio = r.meio === 'outro' ? (0, secretaria_1.texto)(r.outro_meio, 120) : '';
    const ciencia_data = String(r.ciencia_data || '');
    if (r.meio === 'outro') {
        if (!outro_meio)
            throw new Error('Informe por qual meio a comunicação foi feita');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ciencia_data) || ciencia_data > hoje)
            throw new Error('Informe a data em que a parte tomou ciência (até hoje)');
    }
    return {
        especie, texto: txt, partes_idx, documento_id: typeof r.documento_id === 'string' ? r.documento_id : '',
        dias, contagem: r.contagem === 'corridos' ? 'corridos' : 'uteis', outro_meio, ciencia_data: outro_meio ? ciencia_data : '',
    };
}
const textoPrazo = (c) => (c.dias ? `${c.dias} dia${c.dias > 1 ? 's' : ''} ${c.contagem === 'uteis' ? (c.dias > 1 ? 'úteis' : 'útil') : (c.dias > 1 ? 'corridos' : 'corrido')}` : '');
exports.textoPrazo = textoPrazo;
const limiteCiencia = (hoje, dias) => (dias > 0 ? (0, secretaria_1.somarDias)(hoje, dias) : null);
exports.limiteCiencia = limiteCiencia;
/**
 * Registra a ciência: muda a comunicação e, havendo prazo, abre-o contando do
 * dia da ciência (o primeiro dia contado é o seguinte, CPC art. 224).
 */
function aplicarCiencia(c, dataCiencia, quando, por, meio, prazoId, cal) {
    if (c.status !== 'aguardando')
        throw new Error('Esta comunicação não está mais aguardando ciência');
    const prazo = c.dias ? {
        id: prazoId, descricao: `Responder à ${exports.ESPECIES[c.especie].toLowerCase()}`, destinatario: c.parte_nome, dias: c.dias, contagem: c.contagem,
        inicio: dataCiencia, vence_em: (0, secretaria_1.calcularVencimento)(dataCiencia, c.dias, c.contagem, cal), status: 'aberto',
        aberto_em: quando, aberto_por: por, comunicacao_id: c.id,
    } : null;
    return {
        comunicacao: Object.assign(Object.assign(Object.assign({}, c), { status: meio === 'decurso' ? 'decurso' : 'ciente', ciencia_em: quando, ciencia_por: por, ciencia_meio: meio }), (prazo ? { prazo_id: prazo.id, vence_em: prazo.vence_em } : {})),
        prazo,
    };
}
/** Campos do processo que as listas e a rotina diária consultam. */
function derivadosComunicacoes(lista) {
    const aguardando = lista.filter((c) => c.status === 'aguardando');
    return {
        comunicacoes_aguardando: aguardando.length,
        ciencia_limite: aguardando.map((c) => c.limite_ciencia).filter((x) => !!x).sort()[0] || null,
    };
}
/** A comunicação é dirigida a esta conta? (a parte ou um representante dela) */
function destinatario(c, partes, uid) {
    const p = partes[c.parte_idx];
    return !!p && (p.uid === uid || (p.representantes || []).some((r) => r.uid === uid));
}
exports.MAX_TEXTOS_PRONTOS = 40;
function sanitizeTextosProntos(raw) {
    const lista = Array.isArray(raw) ? raw : [];
    if (lista.length > exports.MAX_TEXTOS_PRONTOS)
        throw new Error(`São até ${exports.MAX_TEXTOS_PRONTOS} textos prontos`);
    const ids = new Set();
    return lista.map((x, i) => {
        const t = (x && typeof x === 'object' ? x : {});
        const nome = (0, secretaria_1.texto)(t.nome, 80);
        const corpo = (0, secretaria_1.texto)(t.texto, 2000);
        if (!nome || !corpo)
            throw new Error('Cada texto pronto precisa de nome e de texto');
        let id = /^[A-Za-z0-9_-]{1,40}$/.test(String(t.id || '')) ? String(t.id) : `t${i}`;
        while (ids.has(id))
            id += 'x';
        ids.add(id);
        const dias = Number(t.dias);
        return {
            id, nome, texto: corpo, especie: exports.ESPECIES[String(t.especie)] ? String(t.especie) : '',
            dias: Number.isInteger(dias) && dias > 0 && dias <= secretaria_1.MAX_PRAZO_DIAS ? dias : 0,
            contagem: t.contagem === 'corridos' ? 'corridos' : 'uteis',
        };
    });
}
/** Lê o que está gravado sem lançar. */
function textosProntosDe(raw) {
    try {
        return sanitizeTextosProntos(Array.isArray(raw) ? raw.slice(0, exports.MAX_TEXTOS_PRONTOS) : []);
    }
    catch (_a) {
        return [];
    }
}
//# sourceMappingURL=comunicacoes.js.map