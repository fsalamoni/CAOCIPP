"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_NOTA_VOTO = exports.MAX_RELATORIO = exports.MODOS_VOTO = exports.br = exports.MAX_ANTECEDENCIA = exports.MAX_PAUTA = exports.INCLUSOES = exports.CARATER_SESSAO = exports.MODOS_SESSAO = void 0;
exports.sanitizeRegrasSessao = sanitizeRegrasSessao;
exports.sanitizeDadosSessao = sanitizeDadosSessao;
exports.dataMinimaDaSessao = dataMinimaDaSessao;
exports.problemaDaAntecedencia = problemaDaAntecedencia;
exports.julgamentoPendente = julgamentoPendente;
exports.leituraDeJulgador = leituraDeJulgador;
exports.ondeSessao = ondeSessao;
exports.textoDaInclusao = textoDaInclusao;
exports.textoDaRetirada = textoDaRetirada;
exports.reordenar = reordenar;
exports.votantes = votantes;
exports.sanitizeVoto = sanitizeVoto;
exports.votosDaSessao = votosDaSessao;
exports.placarParcial = placarParcial;
const secretaria_1 = require("./secretaria");
const exigencias_1 = require("./exigencias");
const orgaos_1 = require("./orgaos");
/**
 * Sessões de julgamento de um colegiado: dados da sessão, pauta e
 * antecedência mínima. Regras puras, sem banco (a gravação está em
 * secretaria/sessoes.ts). A sessão é do órgão interno que decide em
 * colegiado; a pauta lista processos que têm o julgamento pendente na fase.
 */
exports.MODOS_SESSAO = ['presencial', 'virtual', 'hibrida'];
exports.CARATER_SESSAO = ['ordinaria', 'extraordinaria'];
/** Como o item entrou: na pauta publicada, depois dela (extrapauta) ou em mesa (urgente, sem pauta). */
exports.INCLUSOES = ['pauta', 'extrapauta', 'mesa'];
exports.MAX_PAUTA = 100;
exports.MAX_ANTECEDENCIA = 60;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
function sanitizeRegrasSessao(raw) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const n = Math.round(Number(r.antecedencia));
    return { antecedencia: Number.isFinite(n) ? Math.max(0, Math.min(exports.MAX_ANTECEDENCIA, n)) : 0, contagem: r.contagem === 'corridos' ? 'corridos' : 'uteis' };
}
/** Dados da sessão conferidos; lança com a explicação. */
function sanitizeDadosSessao(raw) {
    const s = (raw && typeof raw === 'object' ? raw : {});
    const d = {
        titulo: (0, secretaria_1.texto)(s.titulo, 120),
        carater: s.carater === 'extraordinaria' ? 'extraordinaria' : 'ordinaria',
        modo: exports.MODOS_SESSAO.includes(s.modo) ? s.modo : 'presencial',
        data: typeof s.data === 'string' && DATA.test(s.data) && !Number.isNaN(Date.parse(`${s.data}T00:00:00Z`)) ? s.data : '',
        hora: typeof s.hora === 'string' && HORA.test(s.hora) ? s.hora : '',
        local: (0, secretaria_1.texto)(s.local, 200),
        link: (0, secretaria_1.texto)(s.link, 500),
        observacoes: (0, secretaria_1.texto)(s.observacoes, 2000),
    };
    if (!d.data)
        throw new Error('Informe a data da sessão');
    if (!d.hora)
        throw new Error('Informe a hora da sessão (HH:MM)');
    if (d.modo !== 'virtual' && !d.local)
        throw new Error('Informe o local da sessão');
    if (d.modo !== 'presencial' && !d.link)
        throw new Error('Informe o link ou a sala virtual da sessão');
    if (d.modo === 'virtual')
        d.local = '';
    if (d.modo === 'presencial')
        d.link = '';
    if (!d.titulo)
        d.titulo = `Sessão ${d.carater === 'ordinaria' ? 'ordinária' : 'extraordinária'} de ${(0, exports.br)(d.data)}`;
    return d;
}
const br = (d) => d.split('-').reverse().join('/');
exports.br = br;
/** Primeira data em que a sessão pode acontecer se a pauta sair em `hoje`. */
function dataMinimaDaSessao(hoje, regras, cal) {
    return regras.antecedencia > 0 ? (0, secretaria_1.calcularVencimento)(hoje, regras.antecedencia, regras.contagem, cal) : hoje;
}
/** Explica por que a pauta não pode sair agora para a sessão de `data` (ou '' se pode). */
function problemaDaAntecedencia(hoje, data, regras, cal) {
    if (data < hoje)
        return 'A data da sessão já passou';
    const minima = dataMinimaDaSessao(hoje, regras, cal);
    if (data >= minima)
        return '';
    return `O colegiado pede ${regras.antecedencia} ${regras.contagem === 'uteis' ? 'dias úteis' : 'dias'} entre a publicação da pauta e a sessão: publicada hoje, a sessão pode ser a partir de ${(0, exports.br)(minima)}. `
        + 'Mude a data ou inclua o processo como extrapauta ou em mesa, com o motivo.';
}
/**
 * Índice da ação de julgamento colegiado pendente na fase atual (-1 quando não
 * há): é o que torna o processo apto para a pauta.
 */
function julgamentoPendente(proc) {
    if (proc.status !== 'em_tramitacao')
        return -1;
    const fase = (proc.fases || []).find((f) => f.id === proc.fase_atual);
    if (!fase)
        return -1;
    const feitas = (proc.acoes_feitas || {})[String(proc.fase_atual)] || [];
    const resp = (0, exigencias_1.respostasDaFase)(proc);
    return (fase.acoes_regras || []).findIndex((r, i) => (r === null || r === void 0 ? void 0 : r.pede) === 'julgamento' && !feitas.includes(i) && (0, exigencias_1.acaoAtiva)(fase, i, resp));
}
/**
 * Leitura do julgador (decisão do Flavio, 15/11/2026): quem compõe o
 * colegiado lê os autos enquanto o processo está pautado numa sessão dele e,
 * julgado, enquanto o processo segue em unidade do colegiado (o acórdão é
 * feito ali). Saiu do colegiado, a leitura acaba.
 */
function leituraDeJulgador(proc, compoe, orgaoDaUnidade) {
    if (!compoe.length || proc.status === 'excluido')
        return false;
    if (proc.sessao && compoe.includes(String(proc.sessao.orgao_id)))
        return true;
    const ult = proc.ultima_sessao ? String(proc.ultima_sessao.orgao_id) : '';
    return !!ult && proc.status === 'em_tramitacao' && compoe.includes(ult) && orgaoDaUnidade(String(proc.unidade_atual || '')) === ult;
}
/** Onde e como, no mesmo jeito das audiências: "em Sala 2", "por videoconferência (link)", "em Sala 2 e por videoconferência (link)". */
function ondeSessao(s) {
    if (s.modo === 'virtual')
        return `por videoconferência (${s.link})`;
    if (s.modo === 'hibrida')
        return `em ${s.local} e por videoconferência (${s.link})`;
    return `em ${s.local}`;
}
/** Texto da certidão de inclusão em pauta, nos autos e visto pelas partes. */
function textoDaInclusao(s, colegiado, item) {
    const como = item.inclusao === 'extrapauta' ? 'Incluído em extrapauta' : item.inclusao === 'mesa' ? 'Apresentado em mesa' : 'Incluído em pauta';
    const motivo = item.inclusao !== 'pauta' && item.motivo ? ` Motivo: ${item.motivo}.` : '';
    return `${como} para julgamento na ${s.titulo}${colegiado ? ` do ${colegiado}` : ''}, em ${(0, exports.br)(s.data)}, às ${s.hora}, ${ondeSessao(s)}.${motivo}`;
}
/** Texto da certidão de retirada (ou de cancelamento da sessão). */
function textoDaRetirada(s, motivo, cancelada = false) {
    return `${cancelada ? `A ${s.titulo}, de ${(0, exports.br)(s.data)}, foi cancelada, e o processo saiu da pauta` : `Retirado da pauta da ${s.titulo}, de ${(0, exports.br)(s.data)}`}. Motivo: ${motivo}.`;
}
/** Reordena a pauta com a lista de ids (os que faltam ficam no fim, na ordem atual). */
function reordenar(pauta, ids) {
    const pos = (id) => { const i = ids.indexOf(id); return i < 0 ? ids.length : i; };
    return [...pauta].sort((a, b) => pos(a.processo_id) - pos(b.processo_id) || a.ordem - b.ordem).map((x, i) => (Object.assign(Object.assign({}, x), { ordem: i + 1 })));
}
// ---- Votação na sessão (S4): relator, vogais, proclamação ----
/** Como o vogal vota: acompanha o relator (com ou sem ressalva), diverge, ou se declara impedido ou suspeito. */
exports.MODOS_VOTO = ['acompanha', 'ressalva', 'diverge', 'impedido', 'suspeito'];
exports.MAX_RELATORIO = 50000;
exports.MAX_NOTA_VOTO = 4000;
/**
 * Quem vota no dia: o presidente e os titulares. O suplente fica de fora
 * (vota quando convocado no lugar de um titular, numa etapa seguinte).
 */
function votantes(composicao, dia, nome) {
    return (0, orgaos_1.composicaoEm)(composicao, dia).filter((m) => m.funcao !== 'suplente')
        .map((m) => ({ uid: m.uid, nome: nome(m.uid) || `Membro ${m.uid.slice(0, 6)}`, funcao: m.funcao === 'presidente' ? 'presidente' : 'membro' }));
}
/** Confere o voto do vogal contra os resultados do rito e o voto do relator. Lança com mensagem. */
function sanitizeVoto(raw, resultados, doRelator) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const modo = String(r.modo || '');
    if (!exports.MODOS_VOTO.includes(modo))
        throw new Error('Escolha como vota');
    const nota = (0, secretaria_1.texto)(r.nota, exports.MAX_NOTA_VOTO);
    if (modo === 'impedido' || modo === 'suspeito')
        return { modo, resultado: '', nota };
    if (modo === 'diverge') {
        const resultado = (0, secretaria_1.texto)(r.resultado, 80);
        if (!resultados.includes(resultado))
            throw new Error('Na divergência, escolha o resultado do seu voto');
        if (resultado === doRelator)
            throw new Error(`O relator votou por ${doRelator}: para esse resultado, acompanhe o relator`);
        return { modo, resultado, nota };
    }
    if (modo === 'ressalva' && nota.length < 5)
        throw new Error('Escreva a ressalva (ao menos 5 letras)');
    return { modo, resultado: doRelator, nota: modo === 'ressalva' ? nota : '' };
}
/**
 * Votos no formato do registro do julgamento (shared/julgamento.ts): o relator
 * primeiro, depois quem vota no dia; quem não votou fica ausente.
 */
function votosDaSessao(v, membros) {
    const out = [{ nome: v.relator_nome, funcao: 'relator', voto: v.resultado }];
    for (const m of membros) {
        if (m.uid === v.relator_uid)
            continue;
        const x = v.votos[m.uid];
        out.push({ nome: (x === null || x === void 0 ? void 0 : x.nome) || m.nome, funcao: m.funcao, voto: !x ? 'ausente' : x.modo === 'impedido' || x.modo === 'suspeito' ? x.modo : x.resultado });
    }
    return out;
}
/** Placar dos votos já dados (sem quórum nem desempate): para acompanhar ao vivo. */
function placarParcial(resultados, votos) {
    return resultados.map((o) => [o, votos.filter((v) => v.voto === o).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
}
//# sourceMappingURL=sessoes.js.map