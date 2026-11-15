"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aptos = exports.ACOES_S9 = void 0;
exports.placarDoAssunto = placarDoAssunto;
exports.comResultado = comResultado;
exports.acaoReuniao = acaoReuniao;
exports.fecharReuniao = fecharReuniao;
exports.devemVotoNaReuniao = devemVotoNaReuniao;
exports.votaramNaReuniao = votaramNaReuniao;
exports.assuntosParaTela = assuntosParaTela;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const orgaos_1 = require("../shared/orgaos");
const sessoes_1 = require("../shared/sessoes");
const reunioes_1 = require("../shared/reunioes");
const config_1 = require("./config");
const context_1 = require("./context");
const sessoes_2 = require("./sessoes");
/**
 * Etapa S9: reunião deliberativa (secSessoes com `tipo: 'reuniao'`). A pauta
 * são `assuntos`; os votos ficam em secSessoes/{s}/deliberacoes/{assunto}:
 * nominal guarda o voto de cada um; secreta guarda só quem votou e a soma
 * (o vínculo entre a pessoa e o voto não é gravado); simbólica guarda o placar
 * que o presidente anuncia. Palavra, impedimento, quórum e desempate ficam no
 * assunto, dentro da sessão.
 */
exports.ACOES_S9 = [
    'reuniaoAssunto', 'reuniaoTirar', 'reuniaoOrdenar', 'reuniaoPalavra', 'reuniaoImpedimento',
    'reuniaoAbrir', 'reuniaoVotar', 'reuniaoSimbolica', 'reuniaoApurar', 'reuniaoDesempate', 'reuniaoEncaminhar',
];
const MOTIVO_MIN = 5;
const vivo = (a) => a.situacao === 'pauta' || a.situacao === 'em_votacao' || a.situacao === 'empate';
/** Quem vota no dia (presidente e titulares), menos os impedidos no assunto. */
const aptos = (o, dia, a) => (0, orgaos_1.composicaoEm)(o.composicao, dia)
    .filter((m) => m.funcao !== 'suplente' && !(a.impedidos || []).some((i) => i.uid === m.uid)).map((m) => m.uid);
exports.aptos = aptos;
/** Placar do assunto: nominal pelos votos de quem ainda pode votar; secreta e simbólica pela soma. */
function placarDoAssunto(a, d, podem) {
    if (a.votacao === 'nominal')
        return (0, reunioes_1.placarDe)(Object.fromEntries(Object.entries((d === null || d === void 0 ? void 0 : d.votos) || {}).filter(([u]) => podem.includes(u))));
    return { sim: (d === null || d === void 0 ? void 0 : d.sim) || 0, nao: (d === null || d === void 0 ? void 0 : d.nao) || 0, abstencao: (d === null || d === void 0 ? void 0 : d.abstencao) || 0 };
}
/** Grava o resultado no assunto: sem quórum, adia; empate, espera o presidente; senão, deliberado. */
function comResultado(a, r, d) {
    const nominais = a.votacao === 'nominal' ? Object.entries((d === null || d === void 0 ? void 0 : d.votos) || {}).filter(([u]) => !(a.impedidos || []).some((i) => i.uid === u)).map(([, v]) => ({ nome: v.nome, voto: v.voto })) : undefined;
    const base = Object.assign(Object.assign(Object.assign({}, a), { resultado: r, com_a_palavra: null, falaram: falaramCom(a) }), (nominais ? { nominais } : {}));
    if (r.sem_quorum)
        return Object.assign(Object.assign({}, base), { situacao: 'adiado', motivo: 'sem quórum para deliberar' });
    if (r.aprovado === null)
        return Object.assign(Object.assign({}, base), { situacao: 'empate' });
    return Object.assign(Object.assign({}, base), { situacao: 'deliberado' });
}
/** Quem falou, com quem está com a palavra ao fechar. */
const falaramCom = (a) => [...new Set([...(a.falaram || []), ...(a.com_a_palavra ? [a.com_a_palavra.nome] : [])])];
async function acaoReuniao(c, p) {
    const hoje = (0, secretaria_1.hojeBrasil)();
    const quem = { uid: c.ctx.uid, nome: c.userName };
    let auditoria = null;
    const r = await c.db.runTransaction(async (tx) => {
        var _a, _b, _c, _d, _e;
        auditoria = null;
        const { orgaos } = await (0, sessoes_2.lerConfig)(c, tx);
        const { ref, s } = await (0, sessoes_2.lerSessao)(c, p.id, tx);
        if (s.tipo !== 'reuniao')
            throw new https_1.HttpsError('failed-precondition', 'Esta ação é das reuniões deliberativas');
        const o = (0, sessoes_2.colegiado)(orgaos, s.orgao_id);
        const gere = (0, sessoes_2.gereSessoes)(c, o.id);
        if (!(0, sessoes_2.veSessoes)(c, o, hoje) || (s.situacao === 'rascunho' && !gere))
            throw new https_1.HttpsError('not-found', 'Reunião não encontrada');
        const comp = (0, orgaos_1.composicaoEm)(o.composicao, s.data);
        const preside = comp.some((m) => m.uid === quem.uid && m.funcao === 'presidente');
        const conduz = gere || preside;
        const sincrona = s.modo !== 'assincrona';
        const ativa = s.ativa && (s.situacao === 'rascunho' || s.situacao === 'publicada');
        const noDia = s.situacao === 'publicada' && s.ativa && sincrona && s.data <= hoje;
        const regras = (0, reunioes_1.regrasReuniao)(o.pauta);
        const marcas = (s.presencas || {});
        const registrada = Object.keys(marcas).length > 0;
        const assuntos = [...(s.assuntos || [])].sort((a, b) => a.ordem - b.ordem);
        const k = assuntos.findIndex((a) => a.id === p.assunto_id);
        const a = k >= 0 ? assuntos[k] : undefined;
        const dref = a ? ref.collection('deliberacoes').doc(a.id) : null;
        // Todas as leituras antes das escritas.
        const d = dref && ['reuniaoImpedimento', 'reuniaoVotar', 'reuniaoApurar', 'reuniaoSimbolica'].includes(String(p.action)) ? (await tx.get(dref)).data() : undefined;
        const de = p.action === 'reuniaoAssunto' && p.de && typeof p.de === 'object' ? p.de : null;
        const origem = de ? await (0, sessoes_2.lerSessao)(c, de.sessao_id, tx) : null;
        const versao = { version: (s.version || 0) + 1, updated_at: firestore_1.FieldValue.serverTimestamp() };
        const gravar = (lista) => tx.update(ref, Object.assign({ assuntos: lista }, versao));
        const exigirGere = () => { if (!gere)
            throw new https_1.HttpsError('permission-denied', 'Só a secretaria do colegiado cuida da pauta da reunião'); };
        const exigirAssunto = () => { if (!a)
            throw new https_1.HttpsError('not-found', 'Assunto não encontrado nesta reunião'); return a; };
        const motivo = (0, secretaria_1.texto)(p.motivo, 500);
        if (p.action === 'reuniaoAssunto') {
            exigirGere();
            if (!ativa)
                throw new https_1.HttpsError('failed-precondition', 'A reunião já foi encerrada ou cancelada');
            const publicada = s.situacao === 'publicada';
            if (publicada && (sincrona ? s.data < hoje : (0, sessoes_1.votacaoAberta)(s, hoje) || s.data <= hoje)) {
                throw new https_1.HttpsError('failed-precondition', sincrona ? 'A reunião já passou' : 'A votação virtual já abriu: a pauta não muda mais');
            }
            if (a) {
                // Edição: só antes da votação do assunto.
                if (a.situacao !== 'pauta')
                    throw new https_1.HttpsError('failed-precondition', 'O assunto já foi votado ou saiu da pauta: não muda mais');
                let campos;
                try {
                    campos = (0, reunioes_1.sanitizeAssunto)(p.assunto, s.modo);
                }
                catch (e) {
                    (0, context_1.erroUsuario)(e);
                }
                assuntos[k] = Object.assign(Object.assign({}, a), campos);
                gravar(assuntos);
                return { ok: true, assunto_id: a.id };
            }
            if (assuntos.filter(vivo).length >= reunioes_1.MAX_ASSUNTOS)
                throw new https_1.HttpsError('failed-precondition', `A pauta comporta até ${reunioes_1.MAX_ASSUNTOS} assuntos`);
            if (publicada && motivo.length < MOTIVO_MIN)
                throw new https_1.HttpsError('invalid-argument', `Diga o motivo da inclusão depois da convocação (ao menos ${MOTIVO_MIN} letras)`);
            let campos;
            let vem = null;
            if (origem) {
                // Assunto adiado de outra reunião do mesmo colegiado: vem com o que já tinha.
                const ant = (origem.s.assuntos || []).find((x) => x.id === de.assunto_id);
                if (origem.s.orgao_id !== o.id || origem.ref.id === ref.id || !ant || ant.situacao !== 'adiado' || ant.levado_para)
                    throw new https_1.HttpsError('failed-precondition', 'Esse assunto não está pendente em outra reunião do colegiado');
                try {
                    campos = (0, reunioes_1.sanitizeAssunto)(Object.assign(Object.assign({}, ant), (p.assunto || {})), s.modo);
                }
                catch (e) {
                    (0, context_1.erroUsuario)(e);
                }
                vem = { sessao_id: origem.ref.id, titulo: origem.s.titulo };
                tx.update(origem.ref, { assuntos: origem.s.assuntos.map((x) => (x.id === ant.id ? Object.assign(Object.assign({}, x), { levado_para: ref.id }) : x)), version: (origem.s.version || 0) + 1 });
            }
            else {
                try {
                    campos = (0, reunioes_1.sanitizeAssunto)(p.assunto, s.modo);
                }
                catch (e) {
                    (0, context_1.erroUsuario)(e);
                }
            }
            const novo = Object.assign(Object.assign({ id: c.db.collection(sessoes_2.COL_SESSOES).doc().id, ordem: assuntos.length + 1 }, campos), { inclusao: publicada ? 'extrapauta' : 'pauta', motivo: publicada ? motivo : '', situacao: 'pauta', incluido_em: new Date().toISOString(), impedidos: [], inscritos: [], com_a_palavra: null, falaram: [], resultado: null, encaminhamento: '', vem_de: vem });
            gravar([...assuntos, novo]);
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_ASSUNTO', { sessao_id: ref.id, assunto_id: novo.id, titulo: novo.titulo, extrapauta: publicada }];
            return { ok: true, assunto_id: novo.id };
        }
        if (p.action === 'reuniaoTirar') {
            exigirGere();
            const x = exigirAssunto();
            if (!ativa)
                throw new https_1.HttpsError('failed-precondition', 'A reunião já foi encerrada ou cancelada');
            if (s.situacao === 'rascunho') {
                gravar((0, reunioes_1.reordenarAssuntos)(assuntos.filter((y) => y.id !== x.id), []));
                return { ok: true };
            }
            if (!vivo(x))
                throw new https_1.HttpsError('failed-precondition', 'O assunto já foi deliberado ou saiu da pauta');
            if (motivo.length < MOTIVO_MIN)
                throw new https_1.HttpsError('invalid-argument', `Diga o motivo (ao menos ${MOTIVO_MIN} letras)`);
            assuntos[k] = Object.assign(Object.assign({}, x), { situacao: p.adiar === true ? 'adiado' : 'retirado', motivo, com_a_palavra: null, falaram: falaramCom(x), inscritos: [] });
            tx.update(ref, Object.assign(Object.assign({ assuntos }, (s.em_julgamento === x.id ? { em_julgamento: firestore_1.FieldValue.delete() } : {})), versao));
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_ASSUNTO_RETIRADO', { sessao_id: ref.id, assunto_id: x.id, adiado: p.adiar === true, motivo }];
            return { ok: true };
        }
        if (p.action === 'reuniaoOrdenar') {
            exigirGere();
            if (!ativa)
                throw new https_1.HttpsError('failed-precondition', 'A reunião já foi encerrada ou cancelada');
            gravar((0, reunioes_1.reordenarAssuntos)(assuntos, (Array.isArray(p.ordem) ? p.ordem : []).map(String)));
            return { ok: true };
        }
        if (p.action === 'reuniaoEncaminhar') {
            exigirGere();
            const x = exigirAssunto();
            if (s.situacao === 'cancelada' || s.situacao === 'rascunho')
                throw new https_1.HttpsError('failed-precondition', 'O encaminhamento se registra na reunião publicada');
            if ((_b = (_a = s.ata) === null || _a === void 0 ? void 0 : _a.assinaturas) === null || _b === void 0 ? void 0 : _b.length)
                throw new https_1.HttpsError('failed-precondition', 'A ata já tem assinatura e não muda mais');
            assuntos[k] = Object.assign(Object.assign({}, x), { encaminhamento: String((_c = p.texto) !== null && _c !== void 0 ? _c : '').replace(/\r\n/g, '\n').trim().slice(0, reunioes_1.MAX_ENCAMINHAMENTO) });
            gravar(assuntos);
            return { ok: true };
        }
        // Daqui em diante, o assunto na reunião em andamento.
        const x = exigirAssunto();
        if (s.situacao !== 'publicada' || !s.ativa)
            throw new https_1.HttpsError('failed-precondition', 'A reunião não está em andamento');
        if (p.action === 'reuniaoPalavra') {
            if (!noDia)
                throw new https_1.HttpsError('failed-precondition', 'A palavra se pede no dia da reunião (na reunião virtual, cada um vota no seu tempo)');
            if (!vivo(x))
                throw new https_1.HttpsError('failed-precondition', 'O assunto já foi deliberado');
            const acao = String(p.acao || '');
            const inscritos = [...(x.inscritos || [])];
            if (acao === 'pedir' || acao === 'desistir') {
                if (!comp.some((m) => m.uid === quem.uid))
                    throw new https_1.HttpsError('permission-denied', 'Pede a palavra quem compõe o colegiado');
                if (acao === 'pedir') {
                    if (inscritos.some((i) => i.uid === quem.uid) || ((_d = x.com_a_palavra) === null || _d === void 0 ? void 0 : _d.uid) === quem.uid)
                        throw new https_1.HttpsError('already-exists', 'Você já está inscrito para falar neste assunto');
                    inscritos.push({ uid: quem.uid, nome: quem.nome, em: new Date().toISOString() });
                }
                assuntos[k] = Object.assign(Object.assign({}, x), { inscritos: acao === 'pedir' ? inscritos : inscritos.filter((i) => i.uid !== quem.uid) });
                gravar(assuntos);
                return { ok: true };
            }
            if (!conduz)
                throw new https_1.HttpsError('permission-denied', 'Quem dá e encerra a palavra é o presidente (ou a secretaria)');
            if (acao === 'conceder') {
                const uid = String(p.uid || '');
                const m = comp.find((y) => y.uid === uid);
                const insc = inscritos.find((i) => i.uid === uid);
                if (!m && !insc)
                    throw new https_1.HttpsError('invalid-argument', 'A palavra vai a quem compõe o colegiado');
                const nome = (insc === null || insc === void 0 ? void 0 : insc.nome) || String(p.nome || 'Membro').slice(0, 120);
                assuntos[k] = Object.assign(Object.assign({}, x), { falaram: falaramCom(x), com_a_palavra: { uid, nome, em: new Date().toISOString() }, inscritos: inscritos.filter((i) => i.uid !== uid) });
            }
            else if (acao === 'encerrar') {
                assuntos[k] = Object.assign(Object.assign({}, x), { falaram: falaramCom(x), com_a_palavra: null });
            }
            else
                throw new https_1.HttpsError('invalid-argument', 'Ação da palavra desconhecida');
            tx.update(ref, Object.assign({ assuntos, em_julgamento: x.id }, versao));
            return { ok: true };
        }
        if (p.action === 'reuniaoImpedimento') {
            if (!comp.some((m) => m.uid === quem.uid && m.funcao !== 'suplente'))
                throw new https_1.HttpsError('permission-denied', 'Declara impedimento quem vota no colegiado');
            if (!(0, reunioes_1.votavel)(x))
                throw new https_1.HttpsError('failed-precondition', 'O assunto não está em votação nem na pauta');
            const impedido = p.impedido === true;
            const ja = (x.impedidos || []).some((i) => i.uid === quem.uid);
            if (impedido === ja)
                return { ok: true };
            if (impedido && x.votacao === 'secreta' && ((d === null || d === void 0 ? void 0 : d.votaram) || []).includes(quem.uid))
                throw new https_1.HttpsError('failed-precondition', 'Você já votou em votação secreta: o voto não se separa de quem votou depois');
            assuntos[k] = Object.assign(Object.assign({}, x), { impedidos: impedido ? [...(x.impedidos || []), { uid: quem.uid, nome: quem.nome }] : x.impedidos.filter((i) => i.uid !== quem.uid) });
            gravar(assuntos);
            // Impedido, o voto nominal já dado sai.
            if (impedido && ((_e = d === null || d === void 0 ? void 0 : d.votos) === null || _e === void 0 ? void 0 : _e[quem.uid]) && dref)
                tx.update(dref, { [`votos.${quem.uid}`]: firestore_1.FieldValue.delete() });
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_IMPEDIMENTO', { sessao_id: ref.id, assunto_id: x.id, impedido }];
            return { ok: true };
        }
        if (p.action === 'reuniaoAbrir') {
            if (!conduz)
                throw new https_1.HttpsError('permission-denied', 'Abre a votação o presidente (ou a secretaria)');
            if (!noDia)
                throw new https_1.HttpsError('failed-precondition', 'A votação se abre no dia da reunião (na virtual, ela abre sozinha no primeiro dia)');
            if (x.votacao === 'sem_votacao' || x.situacao !== 'pauta')
                throw new https_1.HttpsError('failed-precondition', 'Este assunto não tem votação a abrir');
            const outro = assuntos.find((y) => y.situacao === 'em_votacao');
            if (outro)
                throw new https_1.HttpsError('failed-precondition', `Feche antes a votação de "${outro.titulo}"`);
            const podem = (0, exports.aptos)(o, s.data, x);
            const min = (0, reunioes_1.quorumMinimo)(podem.length, regras.quorum);
            if (regras.quorum !== 'livre') {
                if (!registrada)
                    throw new https_1.HttpsError('failed-precondition', 'Registre a presença antes: o quórum se conta pelos presentes');
                const presentes = podem.filter((u) => marcas[u] === true).length;
                if (presentes < min)
                    throw new https_1.HttpsError('failed-precondition', `Sem quórum: ${presentes} presentes aptos a votar de ${podem.length} (mínimo de ${min}). Adie o assunto ou aguarde.`);
            }
            assuntos[k] = Object.assign(Object.assign({}, x), { situacao: 'em_votacao' });
            tx.update(ref, Object.assign({ assuntos, em_julgamento: x.id }, versao));
            tx.set(ref.collection('deliberacoes').doc(x.id), { aberta_em: new Date().toISOString(), votos: {}, votaram: [], sim: 0, nao: 0, abstencao: 0 });
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_VOTACAO_ABERTA', { sessao_id: ref.id, assunto_id: x.id }];
            return { ok: true };
        }
        if (p.action === 'reuniaoVotar') {
            const voto = reunioes_1.VOTOS.includes(p.voto) ? p.voto : null;
            if (!voto)
                throw new https_1.HttpsError('invalid-argument', 'Vote a favor, contra ou abstenção');
            if (x.votacao === 'simbolica')
                throw new https_1.HttpsError('failed-precondition', 'Na votação simbólica, o presidente anuncia o resultado e a secretaria registra');
            if (x.votacao === 'sem_votacao')
                throw new https_1.HttpsError('failed-precondition', 'Este assunto não tem votação');
            const porOutro = typeof p.por_uid === 'string' && p.por_uid && p.por_uid !== quem.uid;
            if (porOutro && (!gere || x.votacao !== 'nominal' || !sincrona))
                throw new https_1.HttpsError('permission-denied', 'A secretaria registra só o voto nominal dado de viva voz na reunião');
            const alvo = porOutro ? String(p.por_uid) : quem.uid;
            const membro = comp.find((m) => m.uid === alvo);
            if (!membro || membro.funcao === 'suplente')
                throw new https_1.HttpsError('permission-denied', 'Vota quem compõe o colegiado no dia (o suplente, só substituindo)');
            if ((x.impedidos || []).some((i) => i.uid === alvo))
                throw new https_1.HttpsError('failed-precondition', 'Com impedimento declarado, não se vota o assunto');
            if (sincrona) {
                if (x.situacao !== 'em_votacao' || !noDia)
                    throw new https_1.HttpsError('failed-precondition', 'A votação deste assunto não está aberta');
                if (registrada && marcas[alvo] !== true)
                    throw new https_1.HttpsError('failed-precondition', 'Só vota quem está presente: a secretaria marca a presença');
            }
            else if (x.situacao !== 'pauta' || !(0, sessoes_1.votacaoAberta)(s, hoje))
                throw new https_1.HttpsError('failed-precondition', 'A votação virtual não está aberta');
            const nomeAlvo = porOutro ? (0, secretaria_1.texto)(p.nome, 120) || 'Membro' : quem.nome;
            const dd = sincrona ? d : (d || { sim: 0, nao: 0, abstencao: 0, votos: {}, votaram: [] });
            if (!dd || !dref)
                throw new https_1.HttpsError('failed-precondition', 'A votação deste assunto não está aberta');
            if (x.votacao === 'secreta') {
                if ((dd.votaram || []).includes(alvo))
                    throw new https_1.HttpsError('already-exists', 'Você já votou: na votação secreta, o voto não muda');
                // Só a soma e a lista de quem votou: nada liga a pessoa ao voto.
                tx.set(dref, { votaram: firestore_1.FieldValue.arrayUnion(alvo), [voto]: firestore_1.FieldValue.increment(1) }, { merge: true });
                return { ok: true };
            }
            tx.set(dref, { votos: { [alvo]: Object.assign({ voto, nome: nomeAlvo, em: new Date().toISOString() }, (porOutro ? { por: quem.nome } : {})) } }, { merge: true });
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_VOTO', Object.assign({ sessao_id: ref.id, assunto_id: x.id, voto, de: nomeAlvo }, (porOutro ? { registrado_por: quem.nome } : {}))];
            return { ok: true };
        }
        if (p.action === 'reuniaoSimbolica' || p.action === 'reuniaoApurar') {
            if (!conduz)
                throw new https_1.HttpsError('permission-denied', 'Apura a votação o presidente (ou a secretaria)');
            if (x.votacao === 'sem_votacao') {
                if (x.situacao !== 'pauta')
                    throw new https_1.HttpsError('failed-precondition', 'O assunto já foi tratado');
                assuntos[k] = Object.assign(Object.assign({}, x), { situacao: 'deliberado', com_a_palavra: null, falaram: falaramCom(x) });
                tx.update(ref, Object.assign(Object.assign({ assuntos }, (s.em_julgamento === x.id ? { em_julgamento: firestore_1.FieldValue.delete() } : {})), versao));
                return { ok: true };
            }
            if (!sincrona)
                throw new https_1.HttpsError('failed-precondition', 'Na reunião virtual, o sistema apura no fim da votação');
            if (x.situacao !== 'em_votacao')
                throw new https_1.HttpsError('failed-precondition', 'A votação deste assunto não está aberta');
            const podem = (0, exports.aptos)(o, s.data, x);
            let placar;
            if (p.action === 'reuniaoSimbolica') {
                if (x.votacao !== 'simbolica')
                    throw new https_1.HttpsError('failed-precondition', 'O placar se registra à mão só na votação simbólica');
                const n = (v) => { const y = Math.round(Number(v)); return Number.isFinite(y) && y >= 0 ? y : -1; };
                placar = { sim: n(p.sim), nao: n(p.nao), abstencao: n(p.abstencao) };
                if (placar.sim < 0 || placar.nao < 0 || placar.abstencao < 0)
                    throw new https_1.HttpsError('invalid-argument', 'Informe quantos votaram a favor, contra e se abstiveram');
                const teto = registrada ? podem.filter((u) => marcas[u] === true).length : podem.length;
                if (placar.sim + placar.nao + placar.abstencao > teto)
                    throw new https_1.HttpsError('invalid-argument', `O placar passa de ${teto}, o número de ${registrada ? 'presentes aptos a votar' : 'membros aptos a votar'}`);
            }
            else {
                if (x.votacao === 'simbolica')
                    throw new https_1.HttpsError('failed-precondition', 'Na votação simbólica, registre o placar anunciado');
                placar = placarDoAssunto(x, d, podem);
            }
            const res = (0, reunioes_1.apurar)(placar, x.maioria, podem.length, regras);
            assuntos[k] = comResultado(x, res, d);
            tx.update(ref, Object.assign(Object.assign({ assuntos }, (res.aprovado === null && !res.sem_quorum ? {} : s.em_julgamento === x.id ? { em_julgamento: firestore_1.FieldValue.delete() } : {})), versao));
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_APURADA', { sessao_id: ref.id, assunto_id: x.id, resultado: res.texto }];
            return { ok: true, resultado: res.texto };
        }
        if (p.action === 'reuniaoDesempate') {
            if (!preside)
                throw new https_1.HttpsError('permission-denied', 'O voto de qualidade é de quem preside o colegiado');
            if (x.situacao !== 'empate' || !x.resultado)
                throw new https_1.HttpsError('failed-precondition', 'O assunto não está empatado');
            const voto = p.voto === 'sim' ? 'sim' : p.voto === 'nao' ? 'nao' : null;
            if (!voto)
                throw new https_1.HttpsError('invalid-argument', 'Desempate a favor ou contra');
            assuntos[k] = Object.assign(Object.assign({}, x), { situacao: 'deliberado', resultado: (0, reunioes_1.desempatar)(x.resultado, voto, quem.nome) });
            tx.update(ref, Object.assign(Object.assign({ assuntos }, (s.em_julgamento === x.id ? { em_julgamento: firestore_1.FieldValue.delete() } : {})), versao));
            auditoria = ['SECRETARIA_SESSAO_REUNIAO_DESEMPATE', { sessao_id: ref.id, assunto_id: x.id, voto }];
            return { ok: true };
        }
        throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
    });
    if (auditoria)
        await (0, config_1.auditar)(c.db, c.orgId, quem.uid, quem.nome, auditoria[0], auditoria[1]);
    return r;
}
/**
 * Ao encerrar a reunião: na virtual, apura cada assunto (o empate vai à próxima
 * reunião, para o voto de qualidade); na síncrona, o que não foi deliberado é
 * adiado. Quem estava com a palavra entra entre os que falaram.
 */
async function fecharReuniao(db, ref, o) {
    await db.runTransaction(async (tx) => {
        const s = (await tx.get(ref)).data();
        const assuntos = [...(s.assuntos || [])];
        const virtual = s.modo === 'assincrona';
        const ds = assuntos.length ? await tx.getAll(...assuntos.map((a) => ref.collection('deliberacoes').doc(a.id))) : [];
        const regras = (0, reunioes_1.regrasReuniao)(o.pauta);
        const fechados = assuntos.map((a, i) => {
            var _a;
            if (!vivo(a))
                return a;
            const fecha = Object.assign(Object.assign({}, a), { com_a_palavra: null, falaram: falaramCom(a), inscritos: [] });
            if (a.votacao === 'sem_votacao')
                return Object.assign(Object.assign({}, fecha), { situacao: (virtual ? 'deliberado' : 'adiado'), motivo: virtual ? a.motivo : 'não tratado na reunião' });
            if (virtual && a.situacao === 'pauta') {
                const d = (_a = ds[i]) === null || _a === void 0 ? void 0 : _a.data();
                const podem = (0, exports.aptos)(o, s.data, a);
                const r = (0, reunioes_1.apurar)(placarDoAssunto(a, d, podem), a.maioria, podem.length, regras);
                // Empate na virtual: vai à próxima reunião, onde o presidente desempata (Res. CNJ 591, art. 5º, § 8º, por analogia).
                if (r.aprovado === null && !r.sem_quorum)
                    return Object.assign(Object.assign({}, fecha), { resultado: r, situacao: 'adiado', motivo: 'empate na votação virtual, para o voto de qualidade na próxima reunião' });
                return comResultado(fecha, r, d);
            }
            return Object.assign(Object.assign({}, fecha), { situacao: 'adiado', motivo: a.situacao === 'empate' ? 'empate sem o voto de qualidade' : 'não deliberado na reunião' });
        });
        tx.update(ref, { assuntos: fechados });
    });
}
/** Membros que ainda devem voto em assunto aberto da reunião virtual (para o lembrete do último dia). */
async function devemVotoNaReuniao(ref, s, o) {
    const abertos = (s.assuntos || []).filter((a) => a.situacao === 'pauta' && (a.votacao === 'nominal' || a.votacao === 'secreta'));
    if (!abertos.length)
        return [];
    const ds = await ref.firestore.getAll(...abertos.map((a) => ref.collection('deliberacoes').doc(a.id)));
    const devem = new Set();
    abertos.forEach((a, i) => {
        const d = ds[i].data();
        const ja = new Set([...Object.keys((d === null || d === void 0 ? void 0 : d.votos) || {}), ...((d === null || d === void 0 ? void 0 : d.votaram) || [])]);
        for (const u of (0, exports.aptos)(o, s.data, a))
            if (!ja.has(u))
                devem.add(u);
    });
    return [...devem];
}
/** Quem votou em algum assunto (presença da reunião virtual, na ata). */
async function votaramNaReuniao(ref, s) {
    const as = (s.assuntos || []);
    if (!as.length)
        return [];
    const ds = await ref.firestore.getAll(...as.map((a) => ref.collection('deliberacoes').doc(a.id)));
    return [...new Set(ds.flatMap((d) => { const x = d.data(); return [...Object.keys((x === null || x === void 0 ? void 0 : x.votos) || {}), ...((x === null || x === void 0 ? void 0 : x.votaram) || [])]; }))];
}
/**
 * Para a tela: cada assunto com o que a pessoa pode ver e fazer. Antes da
 * apuração, só quantos votaram (e o próprio voto); depois, o resultado e, na
 * nominal, os nomes. Na secreta, nunca o voto de ninguém.
 */
async function assuntosParaTela(c, ref, s, o, hoje) {
    const as = [...(s.assuntos || [])].sort((a, b) => a.ordem - b.ordem);
    const ds = as.length ? await c.db.getAll(...as.map((a) => ref.collection('deliberacoes').doc(a.id))) : [];
    const comp = (0, orgaos_1.composicaoEm)(o.composicao, s.data);
    const eu = comp.find((m) => m.uid === c.ctx.uid);
    const votante = !!eu && eu.funcao !== 'suplente';
    const sincrona = s.modo !== 'assincrona';
    const noDia = s.situacao === 'publicada' && s.ativa && sincrona && s.data <= hoje;
    const marcas = (s.presencas || {});
    const registrada = Object.keys(marcas).length > 0;
    const aberta = s.situacao === 'publicada' && s.ativa && (sincrona ? noDia : (0, sessoes_1.votacaoAberta)(s, hoje));
    return as.map((a, i) => {
        var _a, _b, _c;
        const d = (_a = ds[i]) === null || _a === void 0 ? void 0 : _a.data();
        const podem = (0, exports.aptos)(o, s.data, a);
        const votaram = a.votacao === 'secreta' ? ((d === null || d === void 0 ? void 0 : d.votaram) || []).filter((u) => podem.includes(u)).length : Object.keys((d === null || d === void 0 ? void 0 : d.votos) || {}).filter((u) => podem.includes(u)).length;
        const impedido = (a.impedidos || []).some((x) => x.uid === c.ctx.uid);
        const emAberto = sincrona ? a.situacao === 'em_votacao' : a.situacao === 'pauta';
        const presente = !sincrona || !registrada || marcas[c.ctx.uid] === true;
        const meuVoto = a.votacao === 'nominal' ? ((_c = (_b = d === null || d === void 0 ? void 0 : d.votos) === null || _b === void 0 ? void 0 : _b[c.ctx.uid]) === null || _c === void 0 ? void 0 : _c.voto) || null : null;
        const jaVotei = a.votacao === 'secreta' ? ((d === null || d === void 0 ? void 0 : d.votaram) || []).includes(c.ctx.uid) : !!meuVoto;
        return {
            id: a.id, ordem: a.ordem, titulo: a.titulo, descricao: a.descricao, proponente: a.proponente, votacao: a.votacao, maioria: a.maioria,
            inclusao: a.inclusao, motivo: a.motivo, situacao: a.situacao, encaminhamento: a.encaminhamento || '',
            vem_de: a.vem_de || null, levado: !!a.levado_para,
            impedidos: (a.impedidos || []).map((x) => x.nome), eu_impedido: impedido,
            inscritos: (a.inscritos || []).map((x) => ({ uid: x.uid, nome: x.nome, sou_eu: x.uid === c.ctx.uid })),
            com_a_palavra: a.com_a_palavra ? { nome: a.com_a_palavra.nome, em: a.com_a_palavra.em, sou_eu: a.com_a_palavra.uid === c.ctx.uid } : null,
            falaram: a.falaram || [],
            resultado: a.resultado || null,
            nominais: a.situacao === 'deliberado' || a.situacao === 'empate' ? a.nominais || [] : [],
            votaram, aptos: podem.length,
            meu_voto: meuVoto, ja_votei: jaVotei,
            votos_registrados: a.votacao === 'nominal' && a.situacao === 'em_votacao' && (0, sessoes_2.gereSessoes)(c, o.id)
                ? Object.entries((d === null || d === void 0 ? void 0 : d.votos) || {}).map(([uid, v]) => ({ uid, nome: v.nome, voto: v.voto })) : undefined,
            pode_votar: votante && aberta && emAberto && !impedido && presente && (a.votacao === 'nominal' || (a.votacao === 'secreta' && !jaVotei)),
            pode_impedir: votante && (0, reunioes_1.votavel)(a) && s.situacao === 'publicada' && !(a.votacao === 'secreta' && jaVotei && !impedido),
            pode_pedir_palavra: !!eu && noDia && vivo(a),
        };
    });
}
//# sourceMappingURL=reunioes.js.map