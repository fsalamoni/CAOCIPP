"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ataAssinada = exports.PAPEIS_ATA = exports.MAX_ATA = exports.MAX_NOTA_VOTO = exports.MAX_RELATORIO = exports.MODOS_VOTO = exports.MAX_PEDIDO = exports.NOME_PEDIDO = exports.TIPOS_PEDIDO = exports.virtualEncerrou = exports.MAX_DIAS_VIRTUAL = exports.br = exports.MAX_EMENTA = exports.ACORDAO_PADRAO = exports.MAX_VISTA = exports.VISTA_PADRAO = exports.MAX_ANTECEDENCIA = exports.MAX_PAUTA = exports.INCLUSOES = exports.CARATER_SESSAO = exports.MODOS_SESSAO = void 0;
exports.sanitizeRegrasSessao = sanitizeRegrasSessao;
exports.prazoDoAcordao = prazoDoAcordao;
exports.prazoDaVista = prazoDaVista;
exports.sanitizeDadosSessao = sanitizeDadosSessao;
exports.dataMinimaDaSessao = dataMinimaDaSessao;
exports.problemaDaAntecedencia = problemaDaAntecedencia;
exports.julgamentoPendente = julgamentoPendente;
exports.leituraDeJulgador = leituraDeJulgador;
exports.ondeSessao = ondeSessao;
exports.textoDaInclusao = textoDaInclusao;
exports.votacaoAberta = votacaoAberta;
exports.problemaDoPedido = problemaDoPedido;
exports.sanitizePedido = sanitizePedido;
exports.textoDoDestaque = textoDoDestaque;
exports.textoDaRetirada = textoDaRetirada;
exports.textoDaVista = textoDaVista;
exports.textoDaDevolucao = textoDaDevolucao;
exports.textoDoAdiamento = textoDoAdiamento;
exports.textoDaDiligencia = textoDaDiligencia;
exports.reordenar = reordenar;
exports.votantes = votantes;
exports.sanitizeVoto = sanitizeVoto;
exports.votoCondutor = votoCondutor;
exports.votosDoAcordao = votosDoAcordao;
exports.modeloDoAcordao = modeloDoAcordao;
exports.documentoDoAcordao = documentoDoAcordao;
exports.votosDaSessao = votosDaSessao;
exports.placarParcial = placarParcial;
exports.desfechoNaAta = desfechoNaAta;
exports.textoDaAta = textoDaAta;
const secretaria_1 = require("./secretaria");
const exigencias_1 = require("./exigencias");
const orgaos_1 = require("./orgaos");
/**
 * Sessões de julgamento de um colegiado: dados da sessão, pauta e
 * antecedência mínima. Regras puras, sem banco (a gravação está em
 * secretaria/sessoes.ts). A sessão é do órgão interno que decide em
 * colegiado; a pauta lista processos que têm o julgamento pendente na fase.
 */
exports.MODOS_SESSAO = ['presencial', 'virtual', 'hibrida', 'assincrona'];
exports.CARATER_SESSAO = ['ordinaria', 'extraordinaria'];
/** Como o item entrou: na pauta publicada, depois dela (extrapauta) ou em mesa (urgente, sem pauta). */
exports.INCLUSOES = ['pauta', 'extrapauta', 'mesa'];
exports.MAX_PAUTA = 100;
exports.MAX_ANTECEDENCIA = 60;
exports.VISTA_PADRAO = 10;
exports.MAX_VISTA = 90;
exports.ACORDAO_PADRAO = 30;
exports.MAX_EMENTA = 5000;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
function sanitizeRegrasSessao(raw) {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const n = Math.round(Number(r.antecedencia));
    const v = Math.round(Number(r.vista_dias));
    const a = Math.round(Number(r.acordao_dias));
    return Object.assign(Object.assign({ antecedencia: Number.isFinite(n) ? Math.max(0, Math.min(exports.MAX_ANTECEDENCIA, n)) : 0, contagem: r.contagem === 'corridos' ? 'corridos' : 'uteis' }, (Number.isFinite(v) && v >= 1 && v <= exports.MAX_VISTA && v !== exports.VISTA_PADRAO ? { vista_dias: v } : {})), (Number.isFinite(a) && a >= 1 && a <= exports.MAX_VISTA && a !== exports.ACORDAO_PADRAO ? { acordao_dias: a } : {}));
}
/** Último dia para o redator entregar o acórdão (S6). */
function prazoDoAcordao(hoje, regras, cal) {
    return (0, secretaria_1.calcularVencimento)(hoje, regras.acordao_dias || exports.ACORDAO_PADRAO, regras.contagem, cal);
}
/** Último dia para devolver a vista pedida em `hoje`. */
function prazoDaVista(hoje, regras, cal) {
    return (0, secretaria_1.calcularVencimento)(hoje, regras.vista_dias || exports.VISTA_PADRAO, regras.contagem, cal);
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
    if (d.modo === 'assincrona') {
        // Sem local nem sala: o link é opcional (onde acompanhar, se houver).
        const fim = typeof s.fim === 'string' && DATA.test(s.fim) && !Number.isNaN(Date.parse(`${s.fim}T00:00:00Z`)) ? s.fim : '';
        if (!fim)
            throw new Error('Informe o último dia da votação virtual');
        if (fim < d.data)
            throw new Error('O último dia da votação não pode ser antes do primeiro');
        if (fim > (0, secretaria_1.somarDias)(d.data, exports.MAX_DIAS_VIRTUAL))
            throw new Error(`A votação virtual dura no máximo ${exports.MAX_DIAS_VIRTUAL} dias`);
        d.fim = fim;
        d.local = '';
    }
    else {
        if (d.modo !== 'virtual' && !d.local)
            throw new Error('Informe o local da sessão');
        if (d.modo !== 'presencial' && !d.link)
            throw new Error('Informe o link ou a sala virtual da sessão');
        if (d.modo === 'virtual')
            d.local = '';
        if (d.modo === 'presencial')
            d.link = '';
    }
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
    var _a;
    if (!compoe.length || proc.status === 'excluido')
        return false;
    if (proc.sessao && compoe.includes(String(proc.sessao.orgao_id)))
        return true;
    // Com vista (S5): o julgamento está suspenso, mas o colegiado segue lendo.
    if (proc.vista && proc.status === 'em_tramitacao' && compoe.includes(String(proc.vista.orgao_id)))
        return true;
    // Julgado, lê até o acórdão ser juntado aos autos (S6), enquanto segue no colegiado.
    const ult = proc.ultima_sessao && !((_a = proc.acordao) === null || _a === void 0 ? void 0 : _a.juntado_em) ? String(proc.ultima_sessao.orgao_id) : '';
    return !!ult && proc.status === 'em_tramitacao' && compoe.includes(ult) && orgaoDaUnidade(String(proc.unidade_atual || '')) === ult;
}
/** Onde e como, no mesmo jeito das audiências: "em Sala 2", "por videoconferência (link)", "em Sala 2 e por videoconferência (link)". */
function ondeSessao(s) {
    if (s.modo === 'assincrona')
        return `em sessão virtual, com votação de ${(0, exports.br)(s.data || '')} a ${(0, exports.br)(s.fim || '')}`;
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
    const quando = s.modo === 'assincrona' ? ondeSessao(s) : `em ${(0, exports.br)(s.data)}, às ${s.hora}, ${ondeSessao(s)}`;
    return `${como} para julgamento na ${s.titulo}${colegiado ? ` do ${colegiado}` : ''}, ${quando}.${motivo}`;
}
// ---- S7: sessão virtual assíncrona, destaque, sustentação oral e preferência ----
exports.MAX_DIAS_VIRTUAL = 30;
/** Na sessão virtual, vota-se do primeiro ao último dia; nas outras, a qualquer tempo depois de liberado o voto (como antes). */
function votacaoAberta(s, hoje) {
    return s.modo !== 'assincrona' || (s.data <= hoje && hoje <= String(s.fim || ''));
}
/** A votação virtual terminou (o resultado se apura no dia seguinte ao último). */
const virtualEncerrou = (s, hoje) => s.modo === 'assincrona' && !!s.fim && s.fim < hoje;
exports.virtualEncerrou = virtualEncerrou;
/**
 * O que a parte (ou quem a representa) pede para a sessão: sustentação oral
 * (CPC, art. 937), preferência no julgamento (art. 936), destaque da sessão
 * virtual para uma síncrona (Res. CNJ 591/2024, art. 8º) e esclarecimento de
 * fato durante a votação virtual (art. 9º, § 6º).
 */
exports.TIPOS_PEDIDO = ['sustentacao', 'preferencia', 'destaque', 'esclarecimento'];
exports.NOME_PEDIDO = {
    sustentacao: 'Sustentação oral', preferencia: 'Preferência', destaque: 'Destaque', esclarecimento: 'Esclarecimento de fato',
};
exports.MAX_PEDIDO = 4000;
/**
 * Por que a parte não pode fazer este pedido agora ('' quando pode). Na
 * sessão virtual, sustentação gravada e destaque vão até 48 horas antes do
 * início (dois dias antes); o esclarecimento, durante a votação. Na síncrona,
 * sustentação e preferência até o dia da sessão (CPC, art. 937, § 2º).
 */
function problemaDoPedido(s, tipo, hoje) {
    const virtual = s.modo === 'assincrona';
    if (tipo === 'destaque' && !virtual)
        return 'O destaque é só da sessão virtual';
    if (tipo === 'esclarecimento') {
        if (!virtual)
            return 'Na sessão síncrona, o esclarecimento de fato se pede ao presidente, durante a sessão';
        return votacaoAberta(s, hoje) ? '' : `O esclarecimento se envia durante a votação, de ${(0, exports.br)(s.data)} a ${(0, exports.br)(String(s.fim))}`;
    }
    const limite = virtual && tipo !== 'preferencia' ? (0, secretaria_1.somarDias)(s.data, -2) : s.data;
    return hoje > limite ? `O prazo para este pedido terminou em ${(0, exports.br)(limite)}` : '';
}
/** Pedido conferido (lança com a explicação). */
function sanitizePedido(raw, s) {
    var _a;
    const r = (raw && typeof raw === 'object' ? raw : {});
    const tipo = String(r.tipo || '');
    if (!exports.TIPOS_PEDIDO.includes(tipo))
        throw new Error('Escolha o que pede');
    const txt = String((_a = r.texto) !== null && _a !== void 0 ? _a : '').replace(/\r\n/g, '\n').trim().slice(0, exports.MAX_PEDIDO);
    const link = (0, secretaria_1.texto)(r.link, 500);
    if (link && !/^https:\/\/[^\s]+$/i.test(link))
        throw new Error('O link precisa começar com https://');
    if ((tipo === 'destaque' || tipo === 'esclarecimento') && txt.length < 10)
        throw new Error(tipo === 'destaque' ? 'Diga por que o processo deve ir à sessão síncrona (ao menos 10 letras)' : 'Escreva o esclarecimento (ao menos 10 letras)');
    // Na sessão virtual, a sustentação é gravada: o link do áudio ou vídeo (o sistema não guarda arquivos grandes).
    if (tipo === 'sustentacao' && s.modo === 'assincrona' && !link)
        throw new Error('Na sessão virtual, a sustentação é gravada: informe o link do áudio ou do vídeo');
    return { tipo, texto: txt, link: tipo === 'sustentacao' ? link : '' };
}
/** Certidão do destaque: o processo sai da sessão virtual e o julgamento recomeça numa síncrona. */
function textoDoDestaque(s, quem, incluido) {
    return `Destacado da ${s.titulo}, de ${(0, exports.br)(s.data)}, por ${quem}, para julgamento em sessão síncrona; o julgamento recomeça. `
        + (incluido ? `Incluído na ${incluido.titulo}, de ${(0, exports.br)(incluido.data)}.` : 'Será incluído na próxima sessão síncrona do colegiado.');
}
/** Texto da certidão de retirada (ou de cancelamento da sessão). */
function textoDaRetirada(s, motivo, cancelada = false) {
    return `${cancelada ? `A ${s.titulo}, de ${(0, exports.br)(s.data)}, foi cancelada, e o processo saiu da pauta` : `Retirado da pauta da ${s.titulo}, de ${(0, exports.br)(s.data)}`}. Motivo: ${motivo}.`;
}
const lista = (nomes) => (nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0] || '');
/** Certidão do pedido de vista (S5). */
function textoDaVista(s, nomes, prazo) {
    return `Pedido de vista por ${lista(nomes)} na ${s.titulo}, de ${(0, exports.br)(s.data)}. Julgamento suspenso; os autos devem ser devolvidos até ${(0, exports.br)(prazo)}.`;
}
/** Certidão da devolução da vista; `incluido`: a sessão em que o processo entrou, se já há. */
function textoDaDevolucao(nomes, incluido) {
    return `Devolvidos os autos do pedido de vista de ${lista(nomes)}. ${incluido ? `O julgamento continua na ${incluido.titulo}, de ${(0, exports.br)(incluido.data)}.` : 'O julgamento continua na próxima sessão do colegiado.'}`;
}
/** Certidão do adiamento. */
function textoDoAdiamento(s, motivo) {
    return `Adiado o julgamento na ${s.titulo}, de ${(0, exports.br)(s.data)}, para a sessão seguinte. Motivo: ${motivo}.`;
}
/** Certidão da conversão em diligência. */
function textoDaDiligencia(s, oQue) {
    return `O colegiado converteu o julgamento em diligência na ${s.titulo}, de ${(0, exports.br)(s.data)}: ${oQue.replace(/[.\s]+$/, '')}.`;
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
    var _a;
    const r = (raw && typeof raw === 'object' ? raw : {});
    const modo = String(r.modo || '');
    if (!exports.MODOS_VOTO.includes(modo))
        throw new Error('Escolha como vota');
    const nota = (0, secretaria_1.texto)(r.nota, exports.MAX_NOTA_VOTO);
    // Voto divergente fundamentado ou declaração de voto (S6): texto longo, que vai ao acórdão.
    const fundamentos = String((_a = r.fundamentos) !== null && _a !== void 0 ? _a : '').replace(/\r\n/g, '\n').slice(0, exports.MAX_RELATORIO).trim();
    const comFund = fundamentos ? { fundamentos } : {};
    if (modo === 'impedido' || modo === 'suspeito')
        return { modo, resultado: '', nota };
    if (modo === 'diverge') {
        const resultado = (0, secretaria_1.texto)(r.resultado, 80);
        if (!resultados.includes(resultado))
            throw new Error('Na divergência, escolha o resultado do seu voto');
        if (resultado === doRelator)
            throw new Error(`O relator votou por ${doRelator}: para esse resultado, acompanhe o relator`);
        return Object.assign({ modo, resultado, nota }, comFund);
    }
    if (modo === 'ressalva' && nota.length < 5)
        throw new Error('Escreva a ressalva (ao menos 5 letras)');
    return modo === 'ressalva' ? Object.assign({ modo, resultado: doRelator, nota }, comFund) : { modo, resultado: doRelator, nota: '' };
}
// ---- S6: voto condutor, votos vencidos e acórdão ----
/**
 * Quem conduz o resultado: o relator, se venceu; senão, quem primeiro divergiu
 * para o resultado proclamado (CPC, art. 941, por analogia). Sem divergente
 * (resultado por regra de desempate), fica o relator.
 */
function votoCondutor(v, resultado) {
    if (v.resultado === resultado)
        return { uid: v.relator_uid, nome: v.relator_nome, relator: true };
    const primeiro = Object.entries(v.votos || {})
        .filter(([, x]) => x.modo === 'diverge' && x.resultado === resultado)
        .sort((a, b) => (a[1].divergiu_em || a[1].em).localeCompare(b[1].divergiu_em || b[1].em))[0];
    return primeiro ? { uid: primeiro[0], nome: primeiro[1].nome, relator: false } : { uid: v.relator_uid, nome: v.relator_nome, relator: true };
}
/** Votos vencidos (com o do relator, se vencido) e declarações de voto, para o acórdão. */
function votosDoAcordao(v, resultado, condutorUid) {
    const vencidos = [];
    const declaracoes = [];
    if (v.resultado && v.resultado !== resultado)
        vencidos.push({ nome: v.relator_nome, resultado: v.resultado, texto: v.fundamentos });
    for (const [uid, x] of Object.entries(v.votos || {})) {
        if (uid === condutorUid || !x.resultado)
            continue;
        const t = x.fundamentos || x.nota || '';
        if (x.resultado !== resultado)
            vencidos.push({ nome: x.nome, resultado: x.resultado, texto: t });
        else if (t && (x.modo === 'ressalva' || x.modo === 'diverge'))
            declaracoes.push({ nome: x.nome, resultado: x.resultado, texto: t });
    }
    return { vencidos, declaracoes };
}
/** Dispositivo sugerido ao redator. */
function modeloDoAcordao(numero, colegiado, s, textoProclamado, condutor) {
    return `Vistos, relatados e discutidos os autos do processo ${numero}, acordam os membros do ${colegiado}, na ${s.titulo}, de ${(0, exports.br)(s.data)}, no seguinte resultado: ${textoProclamado.replace(/[.\s]+$/, '')}, nos termos do voto ${condutor.relator ? 'do relator' : `condutor de ${condutor.nome}`}.`;
}
const titulo = (t, level = 2) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text: t }] });
const paragrafos = (t) => t.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)
    .map((x) => ({ type: 'paragraph', attrs: { textAlign: 'justify' }, content: x.split('\n').flatMap((l, i) => [...(i ? [{ type: 'hardBreak' }] : []), ...(l ? [{ type: 'text', text: l }] : [])]) }));
/**
 * O acórdão como documento do editor (vai à unidade como minuta assinada pelo
 * redator; a unidade junta aos autos): ementa, acórdão, relatório, voto
 * condutor, votos vencidos e declarações de voto (CPC, art. 941, § 3º).
 */
function documentoDoAcordao(a) {
    const voto = (x, rotulo) => [titulo(`${rotulo} de ${x.nome} (${x.resultado})`, 3), ...(x.texto ? paragrafos(x.texto) : [{ type: 'paragraph', content: [{ type: 'text', text: 'Sem declaração escrita.' }] }])];
    return {
        type: 'doc',
        content: [
            { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'ACÓRDÃO' }] },
            { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: `Processo ${a.numero} · ${a.colegiado} · ${a.sessao}` }] },
            titulo('Ementa'), ...paragrafos(a.ementa),
            titulo('Acórdão'), ...paragrafos(a.texto),
            titulo(`Relatório (${a.relator})`), ...paragrafos(a.relatorio || 'Sem relatório escrito.'),
            titulo(a.condutor.relator ? `Voto do relator (${a.condutor.nome})` : `Voto condutor (${a.condutor.nome})`), ...paragrafos(a.fundamentosCondutor || 'Sem fundamentos escritos.'),
            ...(a.vencidos.length ? [titulo('Votos vencidos'), ...a.vencidos.flatMap((x) => voto(x, 'Voto vencido'))] : []),
            ...(a.declaracoes.length ? [titulo('Declarações de voto'), ...a.declaracoes.flatMap((x) => voto(x, 'Declaração'))] : []),
        ],
    };
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
// ---- S8: presença, ata da sessão e assinaturas ----
exports.MAX_ATA = 50000;
exports.PAPEIS_ATA = ['presidente', 'secretaria'];
/** Assinada pelo presidente e pela secretaria. */
const ataAssinada = (a) => !!a && exports.PAPEIS_ATA.every((p) => (a.assinaturas || []).some((x) => x.papel === p));
exports.ataAssinada = ataAssinada;
const ponto = (t) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
/** O que aconteceu com o processo na sessão, numa frase da ata. */
function desfechoNaAta(x) {
    const m = x.motivo ? `: ${x.motivo.replace(/[.\s]+$/, '')}` : '';
    if (x.situacao === 'retirado')
        return `Retirado de pauta${m}.`;
    if (x.situacao === 'adiado')
        return `Adiado${m}.`;
    if (x.situacao === 'diligencia')
        return `Convertido em diligência${m}.`;
    if (x.situacao === 'destacado')
        return `Destacado para julgamento em sessão síncrona${x.motivo ? ` (${x.motivo.replace(/[.\s]+$/, '')})` : ''}.`;
    if (x.situacao === 'vista') {
        const v = x.vista || { nomes: [], prazo: '' };
        return `Pedido de vista de ${lista(v.nomes)}${v.prazo ? `, com prazo até ${(0, exports.br)(v.prazo)}` : ''}; julgamento suspenso${v.devolvida ? ' (vista já devolvida)' : ''}.`;
    }
    return x.proclamado ? `${ponto(x.proclamado)}${x.redator ? ` Redator do acórdão: ${x.redator}.` : ''}` : 'Não julgado nesta sessão.';
}
/** Texto da ata, gerado pelo sistema ao encerrar a sessão (CPC, art. 941, § 2º, e regimentos dos colegiados). */
function textoDaAta(s, colegiado, p, itens, encerradaEm) {
    const car = s.carater === 'extraordinaria' ? 'extraordinária' : 'ordinária';
    const pres = p.presidente ? `, sob a presidência de ${p.presidente}` : '';
    const linhas = [`ATA DA ${s.titulo.toUpperCase()} DO ${colegiado.toUpperCase()}`];
    if (s.modo === 'assincrona') {
        linhas.push(`Sessão ${car} virtual do ${colegiado}, com votação de ${(0, exports.br)(s.data)} a ${(0, exports.br)(s.fim || s.data)}${pres}. ${p.presentes.length ? `Votaram ${lista(p.presentes)}.` : 'Nenhum membro votou pelo sistema.'}`);
    }
    else {
        const quem = p.registrada
            ? `${p.presentes.length ? `, presentes ${lista(p.presentes)}` : ''}${p.ausentes.length ? `; ${p.ausentes.length > 1 ? 'ausentes' : 'ausente'} ${lista(p.ausentes)}` : ''}`
            : `${p.presentes.length ? `, com a composição do dia: ${lista(p.presentes)}` : ''} (a presença não foi registrada no sistema)`;
        linhas.push(`Em ${(0, exports.br)(s.data)}, às ${s.hora}, ${ondeSessao(s)}, reuniu-se o ${colegiado} em sessão ${car}${pres}${quem}.`);
    }
    linhas.push(itens.length ? 'Ordem do dia:' : 'Não houve processos na pauta.');
    itens.forEach((x, i) => {
        var _a;
        const relator = x.relator && !x.proclamado ? `, relator ${x.relator}` : '';
        const sust = ((_a = x.sustentacoes) === null || _a === void 0 ? void 0 : _a.length) ? ` Sustentação oral por ${lista(x.sustentacoes)}.` : '';
        linhas.push(`${i + 1}. Processo ${x.numero}${x.assunto ? ` (${x.assunto})` : ''}${relator}.${sust} ${desfechoNaAta(x)}`);
    });
    linhas.push(`Encerrada a sessão em ${(0, exports.br)(encerradaEm)}. Esta ata, lavrada pela secretaria do colegiado, vai assinada pelo presidente e pela secretaria.`);
    return linhas.join('\n\n');
}
//# sourceMappingURL=sessoes.js.map