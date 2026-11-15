"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.votavel = exports.NOME_MAIORIA = exports.NOME_VOTACAO = exports.MAX_ENCAMINHAMENTO = exports.MAX_DESCRICAO = exports.MAX_ASSUNTOS = exports.VOTOS = exports.QUORUNS = exports.MAIORIAS = exports.TIPOS_VOTACAO = void 0;
exports.regrasReuniao = regrasReuniao;
exports.sanitizeAssunto = sanitizeAssunto;
exports.quorumMinimo = quorumMinimo;
exports.votosNecessarios = votosNecessarios;
exports.textoPlacar = textoPlacar;
exports.apurar = apurar;
exports.desempatar = desempatar;
exports.placarDe = placarDe;
exports.desfechoDoAssunto = desfechoDoAssunto;
exports.textoDaAtaReuniao = textoDaAtaReuniao;
exports.reordenarAssuntos = reordenarAssuntos;
const secretaria_1 = require("./secretaria");
const sessoes_1 = require("./sessoes");
/**
 * Reunião deliberativa do colegiado (S9): uma sessão (`tipo: 'reuniao'`) cuja
 * pauta são assuntos, não processos. Cada assunto se vota de forma nominal,
 * simbólica ou secreta (ou é só apresentado, sem votação), com a maioria que
 * ele exige; o quórum e o desempate vêm das regras do colegiado. Regras puras,
 * sem banco (a gravação está em secretaria/reunioes.ts).
 */
exports.TIPOS_VOTACAO = ['nominal', 'simbolica', 'secreta', 'sem_votacao'];
exports.MAIORIAS = ['simples', 'absoluta', 'dois_tercos'];
exports.QUORUNS = ['maioria', 'um_terco', 'dois_tercos', 'livre'];
exports.VOTOS = ['sim', 'nao', 'abstencao'];
function regrasReuniao(pauta) {
    return {
        quorum: exports.QUORUNS.includes(pauta === null || pauta === void 0 ? void 0 : pauta.quorum) ? pauta.quorum : 'maioria',
        desempate: (pauta === null || pauta === void 0 ? void 0 : pauta.desempate) === 'rejeita' ? 'rejeita' : 'presidente',
    };
}
exports.MAX_ASSUNTOS = 60;
exports.MAX_DESCRICAO = 5000;
exports.MAX_ENCAMINHAMENTO = 5000;
exports.NOME_VOTACAO = { nominal: 'Votação nominal', simbolica: 'Votação simbólica', secreta: 'Votação secreta', sem_votacao: 'Sem votação (informe)' };
exports.NOME_MAIORIA = { simples: 'maioria simples', absoluta: 'maioria absoluta', dois_tercos: 'dois terços' };
/** Campos do assunto que a secretaria escreve. Na reunião virtual, só voto pelo sistema (nominal ou secreto). */
function sanitizeAssunto(raw, modo) {
    const a = (raw && typeof raw === 'object' ? raw : {});
    const titulo = (0, secretaria_1.texto)(a.titulo, 200);
    if (titulo.length < 3)
        throw new Error('Dê um título ao assunto');
    const votacao = exports.TIPOS_VOTACAO.includes(a.votacao) ? a.votacao : 'nominal';
    if (modo === 'assincrona' && votacao === 'simbolica')
        throw new Error('Na reunião virtual cada membro vota pelo sistema: escolha votação nominal ou secreta');
    return {
        titulo, descricao: (0, secretaria_1.texto)(a.descricao, exports.MAX_DESCRICAO), proponente: (0, secretaria_1.texto)(a.proponente, 120), votacao,
        maioria: exports.MAIORIAS.includes(a.maioria) ? a.maioria : 'simples',
    };
}
/** Mínimo de membros (presentes, ou que votaram) para deliberar. `n`: quem pode votar o assunto. */
function quorumMinimo(n, q) {
    if (n <= 0)
        return 1;
    if (q === 'livre')
        return 1;
    if (q === 'um_terco')
        return Math.ceil(n / 3);
    if (q === 'dois_tercos')
        return Math.ceil((2 * n) / 3);
    return Math.floor(n / 2) + 1;
}
/** Votos a favor que a maioria exige (absoluta e dois terços contam sobre quem pode votar). */
function votosNecessarios(m, n) {
    if (m === 'absoluta')
        return Math.floor(n / 2) + 1;
    if (m === 'dois_tercos')
        return Math.ceil((2 * n) / 3);
    return 0;
}
const qt = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
function textoPlacar(p) {
    const partes = [qt(p.sim, 'voto a favor', 'votos a favor'), qt(p.nao, 'contra', 'contra')];
    if (p.abstencao)
        partes.push(qt(p.abstencao, 'abstenção', 'abstenções'));
    return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}
/**
 * Resultado do assunto pelo placar. `n`: quem pode votar (composição que vota
 * no dia, menos os impedidos). Sem quórum, o assunto não se decide; empate na
 * maioria simples espera o voto de qualidade do presidente (ou rejeita, se o
 * colegiado não o prevê).
 */
function apurar(p, maioria, n, regras) {
    const total = p.sim + p.nao + p.abstencao;
    const min = quorumMinimo(n, regras.quorum);
    if (total < min) {
        return Object.assign(Object.assign({}, p), { aprovado: null, sem_quorum: true, texto: `Sem quórum para deliberar: ${qt(total, 'membro votou', 'membros votaram')} de ${n} (mínimo de ${min}).` });
    }
    const placar = textoPlacar(p);
    if (maioria === 'simples') {
        if (p.sim > 0 && p.nao === 0 && p.abstencao === 0)
            return Object.assign(Object.assign({}, p), { aprovado: true, texto: `Aprovado por unanimidade (${qt(p.sim, 'voto', 'votos')}).` });
        if (p.sim > p.nao)
            return Object.assign(Object.assign({}, p), { aprovado: true, texto: `Aprovado por maioria simples: ${placar}.` });
        if (p.sim < p.nao || p.sim === 0)
            return Object.assign(Object.assign({}, p), { aprovado: false, texto: `Rejeitado: ${placar}.` });
        if (regras.desempate === 'presidente')
            return Object.assign(Object.assign({}, p), { aprovado: null, texto: `Empate de ${p.sim} a ${p.nao}: cabe o voto de qualidade do presidente.` });
        return Object.assign(Object.assign({}, p), { aprovado: false, texto: `Rejeitado por empate (${p.sim} a ${p.nao}), sem voto de qualidade: fica como está.` });
    }
    const precisa = votosNecessarios(maioria, n);
    const minimo = `mínimo de ${precisa} de ${n}`;
    return p.sim >= precisa
        ? Object.assign(Object.assign({}, p), { aprovado: true, texto: `Aprovado por ${exports.NOME_MAIORIA[maioria]} (${minimo}): ${placar}.` }) : Object.assign(Object.assign({}, p), { aprovado: false, texto: `Rejeitado: não alcançou ${maioria === 'absoluta' ? 'a maioria absoluta' : 'os dois terços'} (${minimo}); ${placar}.` });
}
/** Empate desfeito pelo voto de qualidade do presidente. */
function desempatar(r, voto, presidente) {
    return Object.assign(Object.assign({}, r), { aprovado: voto === 'sim', desempate: voto, texto: `Empate de ${r.sim} a ${r.nao}, desfeito pelo voto de qualidade de ${presidente}: ${voto === 'sim' ? 'aprovado' : 'rejeitado'}.` });
}
/** Placar dos votos nominais. */
function placarDe(votos) {
    const vs = Object.values(votos || {});
    return { sim: vs.filter((v) => v.voto === 'sim').length, nao: vs.filter((v) => v.voto === 'nao').length, abstencao: vs.filter((v) => v.voto === 'abstencao').length };
}
/** Na reunião, é "o processo em julgamento": quem pode chamar e votar o assunto agora. */
const votavel = (a) => a.votacao !== 'sem_votacao' && (a.situacao === 'pauta' || a.situacao === 'em_votacao');
exports.votavel = votavel;
const lista = (nomes) => (nomes.length > 1 ? `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}` : nomes[0] || '');
const ponto = (t) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
const semPonto = (t) => t.replace(/[.\s]+$/, '');
/** O que aconteceu com o assunto, para a ata. */
function desfechoDoAssunto(a) {
    const m = a.motivo ? `: ${semPonto(a.motivo)}` : '';
    if (a.situacao === 'retirado')
        return `Retirado de pauta${m}.`;
    if (a.situacao === 'adiado')
        return `Adiado${m}.`;
    if (a.situacao !== 'deliberado')
        return 'Não deliberado nesta reunião.';
    if (a.votacao === 'sem_votacao')
        return 'Assunto apresentado, sem votação.';
    const r = a.resultado;
    if (!r)
        return 'Não deliberado nesta reunião.';
    const grupos = a.votacao === 'nominal' ? [['sim', 'a favor'], ['nao', 'contra'], ['abstencao', 'abstenção']]
        .map(([v, rot]) => [rot, (a.nominais || []).filter((x) => x.voto === v).map((x) => x.nome)])
        .filter(([, ns]) => ns.length).map(([rot, ns]) => `${rot}: ${lista(ns)}`) : [];
    const nominais = grupos.length ? ` Votaram ${grupos.join('; ')}.` : '';
    const forma = a.votacao === 'secreta' ? ' Votação secreta.' : a.votacao === 'simbolica' ? ' Votação simbólica.' : '';
    return `${ponto(r.texto)}${forma}${nominais}`;
}
/** Texto da ata da reunião, gerado ao encerrar (presença, cada assunto, falas, votos e encaminhamentos). */
function textoDaAtaReuniao(s, colegiado, p, assuntos, encerradaEm) {
    const car = s.carater === 'extraordinaria' ? 'extraordinária' : 'ordinária';
    const pres = p.presidente ? `, sob a presidência de ${p.presidente}` : '';
    const linhas = [`ATA DA ${s.titulo.toUpperCase()} DO ${colegiado.toUpperCase()}`];
    if (s.modo === 'assincrona') {
        linhas.push(`Reunião ${car} virtual do ${colegiado}, com votação de ${(0, sessoes_1.br)(s.data)} a ${(0, sessoes_1.br)(s.fim || s.data)}${pres}. ${p.presentes.length ? `Votaram ${lista(p.presentes)}.` : 'Nenhum membro votou pelo sistema.'}`);
    }
    else {
        const quem = p.registrada
            ? `${p.presentes.length ? `, presentes ${lista(p.presentes)}` : ''}${p.ausentes.length ? `; ${p.ausentes.length > 1 ? 'ausentes' : 'ausente'} ${lista(p.ausentes)}` : ''}`
            : `${p.presentes.length ? `, com a composição do dia: ${lista(p.presentes)}` : ''} (a presença não foi registrada no sistema)`;
        linhas.push(`Em ${(0, sessoes_1.br)(s.data)}, às ${s.hora}, ${(0, sessoes_1.ondeSessao)(s)}, reuniu-se o ${colegiado} em reunião ${car}${pres}${quem}.`);
    }
    linhas.push(assuntos.length ? 'Pauta:' : 'Não houve assuntos na pauta.');
    assuntos.forEach((a, i) => {
        var _a, _b;
        const partes = [`${i + 1}. ${semPonto(a.titulo)}${a.proponente ? ` (proposto por ${a.proponente})` : ''}.`];
        if (a.inclusao === 'extrapauta' && a.motivo && a.situacao !== 'retirado' && a.situacao !== 'adiado')
            partes.push(`Incluído depois da convocação: ${ponto(a.motivo)}`);
        if (a.vem_de)
            partes.push(`Vindo da ${a.vem_de.titulo}.`);
        if ((_a = a.falaram) === null || _a === void 0 ? void 0 : _a.length)
            partes.push(`Fizeram uso da palavra ${lista(a.falaram)}.`);
        if ((_b = a.impedidos) === null || _b === void 0 ? void 0 : _b.length)
            partes.push(`${a.impedidos.length > 1 ? 'Declararam' : 'Declarou'} impedimento ${lista(a.impedidos.map((x) => x.nome))}.`);
        partes.push(desfechoDoAssunto(a));
        if (a.encaminhamento)
            partes.push(`Encaminhamento: ${ponto(a.encaminhamento)}`);
        linhas.push(partes.join(' '));
    });
    linhas.push(`Encerrada a reunião em ${(0, sessoes_1.br)(encerradaEm)}. Esta ata, lavrada pela secretaria do colegiado, vai assinada pelo presidente e pela secretaria.`);
    return linhas.join('\n\n');
}
/** Reordena os assuntos pela lista de ids (os que faltarem vão ao fim, na ordem atual). */
function reordenarAssuntos(as, ids) {
    const atual = [...as].sort((a, b) => a.ordem - b.ordem);
    const pos = new Map(ids.map((id, i) => [id, i]));
    return [...atual].sort((a, b) => { var _a, _b; return ((_a = pos.get(a.id)) !== null && _a !== void 0 ? _a : 1e6 + a.ordem) - ((_b = pos.get(b.id)) !== null && _b !== void 0 ? _b : 1e6 + b.ordem); }).map((a, i) => (Object.assign(Object.assign({}, a), { ordem: i + 1 })));
}
//# sourceMappingURL=reunioes.js.map