"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.horaBrasil = exports.MAX_OUTROS = exports.MAX_TEXTO_OCORRENCIA = exports.MAX_OCORRENCIAS = exports.COM_QUEM = exports.TIPOS_OCORRENCIA = void 0;
exports.convocadosDaAudiencia = convocadosDaAudiencia;
exports.sanitizePresencas = sanitizePresencas;
exports.sanitizeOutros = sanitizeOutros;
exports.sanitizeOcorrencia = sanitizeOcorrencia;
exports.linhaDaOcorrencia = linhaDaOcorrencia;
exports.textoDoTermo = textoDoTermo;
exports.documentoDoTermo = documentoDoTermo;
/**
 * Sala da audiência (S10): no dia da audiência designada pelo rito, quem tem o
 * processo abre a sala, marca a presença dos convocados (partes, quem as
 * representa e os participantes da designação), registra o que acontece em
 * ordem (manifestações, depoimentos, acordo, deliberações) e encerra. O
 * encerramento monta o termo de audiência, que vai à unidade como minuta
 * assinada por quem conduziu; a unidade junta aos autos pelo caminho comum.
 *
 * Lógica pura; o servidor grava em `secProcessos/{id}/salas/{audienciaId}`.
 */
const secretaria_1 = require("./secretaria");
const camposProcesso_1 = require("./camposProcesso");
const audiencias_1 = require("./audiencias");
exports.TIPOS_OCORRENCIA = {
    manifestacao: 'Manifestação', depoimento: 'Depoimento', requerimento: 'Requerimento', proposta: 'Proposta de acordo',
    acordo: 'Acordo', sem_acordo: 'Sem acordo', deliberacao: 'Deliberação', documento: 'Documento apresentado',
    suspensao: 'Suspensão', retomada: 'Retomada', registro: 'Registro',
};
/** Tipos que dizem de quem é a fala. */
exports.COM_QUEM = ['manifestacao', 'depoimento', 'requerimento', 'proposta'];
/** Tipos em que o texto é opcional (o tipo já diz o que houve). */
const TEXTO_OPCIONAL = ['sem_acordo', 'suspensao', 'retomada'];
exports.MAX_OCORRENCIAS = 200;
exports.MAX_TEXTO_OCORRENCIA = 20000;
exports.MAX_OUTROS = 20;
/** Quem foi convocado: partes ativas, quem as representa e os participantes da designação. */
function convocadosDaAudiencia(partes, nomesPolos, a) {
    const out = [];
    (partes || []).forEach((x, i) => {
        if (x.retirada || !x.nome)
            return;
        const polo = (0, camposProcesso_1.nomeDoPolo)(nomesPolos, x.polo);
        out.push({ chave: `p${i}`, nome: x.nome, qualidade: polo.charAt(0).toUpperCase() + polo.slice(1) });
        (x.representantes || []).forEach((r, j) => { if (r.nome)
            out.push({ chave: `p${i}r${j}`, nome: r.nome, qualidade: 'representante', representa: x.nome }); });
    });
    (a.participantes || []).forEach((x, k) => out.push({ chave: `x${k}`, nome: x.nome, qualidade: audiencias_1.QUALIDADES[x.qualidade] || 'participante' }));
    return out;
}
/** Presença: só das chaves dos convocados. */
function sanitizePresencas(raw, convocados) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    return Object.fromEntries(convocados.map((c) => [c.chave, r[c.chave] === true]));
}
/** Outros presentes que não foram convocados (membro do Ministério Público, defensor nomeado, intérprete). */
function sanitizeOutros(raw) {
    const lista = Array.isArray(raw) ? raw : [];
    if (lista.length > exports.MAX_OUTROS)
        throw new Error(`Até ${exports.MAX_OUTROS} outros presentes`);
    return lista.map((x) => {
        const o = (x && typeof x === 'object' ? x : {});
        return { nome: (0, secretaria_1.texto)(o.nome, 120), qualidade: (0, secretaria_1.texto)(o.qualidade, 60) };
    }).filter((x) => x.nome);
}
/** Confere a ocorrência. `presentes`: nomes de quem pode falar (presentes e quem conduz). Lança com mensagem. */
function sanitizeOcorrencia(raw, presentes) {
    var _a;
    const r = (raw && typeof raw === 'object' ? raw : {});
    const tipo = String(r.tipo || 'registro');
    if (!exports.TIPOS_OCORRENCIA[tipo])
        throw new Error('Tipo de registro desconhecido');
    const t = String((_a = r.texto) !== null && _a !== void 0 ? _a : '').replace(/\r\n/g, '\n').trim().slice(0, exports.MAX_TEXTO_OCORRENCIA);
    if (!TEXTO_OPCIONAL.includes(tipo) && t.length < 3)
        throw new Error('Escreva o que houve (ao menos 3 letras)');
    if (!exports.COM_QUEM.includes(tipo))
        return { tipo, texto: t };
    const quem = (0, secretaria_1.texto)(r.quem, 120);
    if (!quem)
        throw new Error(`Diga de quem é ${tipo === 'depoimento' ? 'o depoimento' : tipo === 'proposta' ? 'a proposta' : `a ${exports.TIPOS_OCORRENCIA[tipo].toLowerCase()}`}`);
    if (!presentes.includes(quem))
        throw new Error(`${quem} não está entre os presentes: marque a presença antes`);
    return { tipo, texto: t, quem };
}
/** Hora de Brasília (hh:mm) de um ISO. */
const horaBrasil = (iso) => new Date(new Date(iso).getTime() - 108e5).toISOString().slice(11, 16);
exports.horaBrasil = horaBrasil;
const lista = (n) => (n.length > 1 ? `${n.slice(0, -1).join('; ')} e ${n[n.length - 1]}` : n[0] || '');
const comPonto = (t) => (/[.!?:]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
const rotuloConvocado = (c) => `${c.nome} (${c.representa ? `representante de ${c.representa}` : c.qualidade})`;
/** Linha da ocorrência no termo. */
function linhaDaOcorrencia(o) {
    const nome = exports.TIPOS_OCORRENCIA[o.tipo] || 'Registro';
    if (o.tipo === 'suspensao' || o.tipo === 'retomada')
        return `${o.tipo === 'suspensao' ? 'Suspensa' : 'Retomada'} a audiência às ${(0, exports.horaBrasil)(o.em)}${o.texto ? `: ${comPonto(o.texto)}` : '.'}`;
    if (o.tipo === 'sem_acordo')
        return `Não houve acordo${o.texto ? `: ${comPonto(o.texto)}` : '.'}`;
    const de = o.quem ? ` de ${o.quem}` : '';
    return `${nome}${de}: ${comPonto(o.texto)}`;
}
/** Texto do termo de audiência (parágrafos separados por linha em branco). */
function textoDoTermo(d) {
    const eu = d.lavrou === d.condutor ? `Eu, ${d.condutor}, conduzi a audiência e lavrei este termo.` : `Eu, ${d.lavrou}, lavrei este termo.`;
    const nome = (0, audiencias_1.nomeDaAudiencia)(d.audiencia);
    const quando = (0, audiencias_1.textoDaAudiencia)(d.audiencia, false);
    const presentes = d.convocados.filter((c) => d.sala.presencas[c.chave]).map(rotuloConvocado);
    const ausentes = d.convocados.filter((c) => !d.sala.presencas[c.chave]).map(rotuloConvocado);
    const outros = (d.sala.outros || []).map((x) => `${x.nome}${x.qualidade ? ` (${x.qualidade})` : ''}`);
    const linhas = [`Processo ${d.numero} · ${d.unidade}`];
    if (d.realizada)
        linhas.push(`${nome} designada para ${quando}. Aberta às ${(0, exports.horaBrasil)(d.sala.aberta_em)}, sob a condução de ${d.condutor}.`);
    else
        linhas.push(`${nome} designada para ${quando}. A audiência não se realizou${d.motivo ? `: ${comPonto(d.motivo)}` : '.'}`);
    linhas.push(`Presentes: ${presentes.length ? lista(presentes) : 'nenhum dos convocados'}.${ausentes.length ? ` Ausentes: ${lista(ausentes)}.` : ''}${outros.length ? ` Também presentes: ${lista(outros)}.` : ''}`);
    if (d.realizada) {
        const oc = d.sala.ocorrencias || [];
        if (oc.length)
            linhas.push(...oc.map((o, i) => `${i + 1}. ${linhaDaOcorrencia(o)}`));
        else
            linhas.push('Nada foi registrado durante a audiência.');
        linhas.push(`Nada mais havendo, encerrou-se a audiência às ${(0, exports.horaBrasil)(d.encerrada_em)}. ${eu}`);
    }
    else {
        linhas.push(`Eu, ${d.lavrou}, lavrei este termo às ${(0, exports.horaBrasil)(d.encerrada_em)}.`);
    }
    return linhas.join('\n\n');
}
/** O termo como documento do editor: título centralizado e os parágrafos. */
function documentoDoTermo(titulo, textoTermo) {
    const par = (x) => ({ type: 'paragraph', attrs: { textAlign: 'justify' }, content: x.split('\n').flatMap((l, i) => [...(i ? [{ type: 'hardBreak' }] : []), ...(l ? [{ type: 'text', text: l }] : [])]) });
    return {
        type: 'doc',
        content: [
            { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: titulo.toUpperCase() }] },
            ...textoTermo.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).map(par),
        ],
    };
}
//# sourceMappingURL=audienciaSala.js.map