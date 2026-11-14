"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARCA_AUDIENCIA = exports.MAX_PARTICIPANTES = exports.QUALIDADES = exports.MODOS_AUDIENCIA = exports.ESPECIES_AUDIENCIA = void 0;
exports.sanitizeAudienciaDaAcao = sanitizeAudienciaDaAcao;
exports.dadosDaAudiencia = dadosDaAudiencia;
exports.textoDaAudiencia = textoDaAudiencia;
exports.audienciasFuturas = audienciasFuturas;
exports.aplicarAudiencia = aplicarAudiencia;
/**
 * Audiência como ação do rito (`pede: 'audiencia'`): a equipe designa data,
 * hora, modo, local ou link e quem participa além das partes (testemunha,
 * perito...). A designação é certidão nos autos, que as partes veem; a
 * comunicação às partes usa `{audiencia}` no texto para levar a data. A
 * realização e o resultado ficam com as ações seguintes do rito (escolha,
 * documento da ata).
 *
 * Lógica pura; o servidor grava. Ver docs/PROCESSO_ELETRONICO.md.
 */
const secretaria_1 = require("./secretaria");
exports.ESPECIES_AUDIENCIA = {
    audiencia: 'Audiência', instrucao: 'Audiência de instrução', conciliacao: 'Audiência de conciliação', oitiva: 'Oitiva',
    sessao: 'Sessão de julgamento', reuniao: 'Reunião', inspecao: 'Inspeção ou vistoria',
};
exports.MODOS_AUDIENCIA = { presencial: 'presencial', virtual: 'por videoconferência', hibrida: 'híbrida (presencial e por videoconferência)' };
exports.QUALIDADES = { testemunha: 'testemunha', perito: 'perito', informante: 'informante', assistente: 'assistente técnico', interprete: 'intérprete', outro: 'outro participante' };
exports.MAX_PARTICIPANTES = 20;
/** Marca que a comunicação troca pela audiência designada. */
exports.MARCA_AUDIENCIA = '{audiencia}';
/** Valida o que o rito diz da audiência. Lança com mensagem. */
function sanitizeAudienciaDaAcao(raw, acao) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const especie = String(r.especie || 'audiencia');
    if (!exports.ESPECIES_AUDIENCIA[especie])
        throw new Error(`A ação "${acao}" designa audiência: espécie desconhecida`);
    return { especie };
}
/** Confere o que a equipe informa ao designar. `hoje` em AAAA-MM-DD. Lança com mensagem. */
function dadosDaAudiencia(bruto, hoje) {
    const r = (bruto && typeof bruto === 'object' ? bruto : {});
    const data = String(r.data || '');
    const hora = String(r.hora || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(`${data}T12:00:00Z`)))
        throw new Error('Informe a data da audiência');
    if (data < hoje)
        throw new Error('A audiência não pode ser designada para data passada');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora))
        throw new Error('Informe a hora da audiência (hh:mm)');
    const modo = String(r.modo || 'presencial');
    if (!exports.MODOS_AUDIENCIA[modo])
        throw new Error('Modo da audiência desconhecido');
    const local = (0, secretaria_1.texto)(r.local, 200);
    const link = (0, secretaria_1.texto)(r.link, 300);
    if (modo !== 'virtual' && !local)
        throw new Error('Informe o local da audiência');
    if (modo !== 'presencial' && !link)
        throw new Error('Informe o link ou a sala virtual da audiência');
    const brutos = Array.isArray(r.participantes) ? r.participantes : [];
    if (brutos.length > exports.MAX_PARTICIPANTES)
        throw new Error(`Até ${exports.MAX_PARTICIPANTES} participantes além das partes`);
    const participantes = brutos.map((x) => {
        const o = (x && typeof x === 'object' ? x : {});
        const qualidade = String(o.qualidade || 'testemunha');
        if (!exports.QUALIDADES[qualidade])
            throw new Error('Qualidade do participante desconhecida');
        return { nome: (0, secretaria_1.texto)(o.nome, 120), qualidade };
    }).filter((p) => p.nome);
    return Object.assign(Object.assign(Object.assign({ data, hora, modo }, (modo !== 'virtual' ? { local } : {})), (modo !== 'presencial' ? { link } : {})), (participantes.length ? { participantes } : {}));
}
const br = (iso) => iso.split('-').reverse().join('/');
/** "20/11/2026, às 14:00, presencial, em Sala 3" (com link e participantes, se houver). */
function textoDaAudiencia(a, comParticipantes = true) {
    var _a;
    const onde = a.modo === 'virtual' ? `por videoconferência (${a.link})`
        : a.modo === 'hibrida' ? `em ${a.local} e por videoconferência (${a.link})` : `em ${a.local}`;
    const quem = comParticipantes && ((_a = a.participantes) === null || _a === void 0 ? void 0 : _a.length)
        ? `. Participam, além das partes: ${a.participantes.map((p) => `${p.nome} (${exports.QUALIDADES[p.qualidade]})`).join('; ')}` : '';
    return `${br(a.data)}, às ${a.hora}, ${onde}${quem}`;
}
/** Audiências designadas (não canceladas) de hoje em diante, da mais próxima à mais distante. */
function audienciasFuturas(lista, hoje) {
    return (lista || []).filter((a) => a.status === 'designada' && a.data >= hoje)
        .sort((a, b) => `${a.data}T${a.hora}`.localeCompare(`${b.data}T${b.hora}`));
}
/** Designa (feita) ou cancela (desfeita) a audiência da ação na lista do processo. */
function aplicarAudiencia(lista, faseId, idx, nova) {
    const atual = [...(lista || [])];
    if (nova)
        return [...atual, nova];
    const k = atual.map((a) => a.fase_id === faseId && a.acao_idx === idx && a.status === 'designada').lastIndexOf(true);
    if (k >= 0)
        atual[k] = Object.assign(Object.assign({}, atual[k]), { status: 'cancelada' });
    return atual;
}
//# sourceMappingURL=audiencias.js.map