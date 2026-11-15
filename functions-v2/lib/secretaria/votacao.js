"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACOES_VOTACAO = void 0;
exports.regraDoJulgamento = regraDoJulgamento;
exports.resumoVotacao = resumoVotacao;
exports.acaoVotacao = acaoVotacao;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const orgaos_1 = require("../shared/orgaos");
const julgamento_1 = require("../shared/julgamento");
const sessoes_1 = require("../shared/sessoes");
const config_1 = require("./config");
const context_1 = require("./context");
const sessoes_2 = require("./sessoes");
const processos_1 = require("./processos");
const portalAvisos_1 = require("./portalAvisos");
const ACOES_S5 = ['sessaoVista', 'sessaoDevolverVista', 'sessaoAdiar', 'sessaoDiligencia'];
exports.ACOES_VOTACAO = ['sessaoVotacao', 'sessaoRelator', 'sessaoRelatar', 'sessaoVotar', 'sessaoProclamar', ...ACOES_S5];
const MIN_TEXTO = 10;
const vazia = (pid) => ({
    processo_id: pid, relator_uid: '', relator_nome: '', relatorio: '', resultado: '', fundamentos: '', liberado_em: null, votos: {}, proclamado: null,
});
/** Nome de cada conta na entidade (userOrganizations). */
async function nomes(c, uids) {
    if (!uids.length)
        return new Map();
    const snaps = await c.db.getAll(...uids.map((u) => c.db.collection('userOrganizations').doc(`${u}_${c.orgId}`)));
    return new Map(snaps.map((s, i) => { var _a; return [uids[i], String(((_a = s.data()) === null || _a === void 0 ? void 0 : _a.user_name) || '')]; }));
}
/** A ação de julgamento pendente na fase (índice e regra do rito); null quando não há mais. */
function regraDoJulgamento(proc) {
    var _a, _b;
    const idx = (0, sessoes_1.julgamentoPendente)(proc);
    if (idx < 0)
        return null;
    const fase = (proc.fases || []).find((f) => f.id === proc.fase_atual);
    const cfg = (_b = (_a = fase === null || fase === void 0 ? void 0 : fase.acoes_regras) === null || _a === void 0 ? void 0 : _a[idx]) === null || _b === void 0 ? void 0 : _b.julgamento;
    return cfg ? { idx, cfg } : null;
}
/** Resumo da votação para a linha da pauta. */
function resumoVotacao(v, uid, quemVota, relatorUid) {
    var _a, _b;
    const liberado = !!(v === null || v === void 0 ? void 0 : v.liberado_em);
    const votaram = liberado ? Object.keys(v.votos || {}).filter((u) => quemVota.includes(u) && u !== v.relator_uid).length : 0;
    const vogais = quemVota.filter((u) => u !== relatorUid).length;
    return {
        liberado, votaram, vogais, proclamado: ((_a = v === null || v === void 0 ? void 0 : v.proclamado) === null || _a === void 0 ? void 0 : _a.resultado) || null,
        sou_relator: !!relatorUid && relatorUid === uid,
        aguarda_meu_voto: liberado && !v.proclamado && quemVota.includes(uid) && uid !== relatorUid && !((_b = v.votos) === null || _b === void 0 ? void 0 : _b[uid]),
    };
}
async function acaoVotacao(c, p) {
    var _a, _b, _c, _d, _e, _f, _g;
    const hoje = (0, secretaria_1.hojeBrasil)();
    const quem = { uid: c.ctx.uid, nome: c.userName };
    const { orgaos, calendario } = await (0, sessoes_2.lerConfig)(c);
    const { ref: sref, s } = await (0, sessoes_2.lerSessao)(c, p.id);
    const o = (0, sessoes_2.colegiado)(orgaos, s.orgao_id);
    const gere = (0, sessoes_2.gereSessoes)(c, o.id);
    if (!(0, sessoes_2.veSessoes)(c, o, hoje) || (s.situacao === 'rascunho' && !gere))
        throw new https_1.HttpsError('not-found', 'Sessão não encontrada');
    const pid = String(p.processo_id || '');
    const item = (s.pauta || []).find((x) => x.processo_id === pid);
    if (!item)
        throw new https_1.HttpsError('not-found', 'O processo não está nesta pauta');
    const uidsDia = (0, orgaos_1.composicaoEm)(o.composicao, s.data).filter((m) => m.funcao !== 'suplente').map((m) => m.uid);
    const nm = await nomes(c, uidsDia);
    const membros = (0, sessoes_1.votantes)(o.composicao, s.data, (u) => nm.get(u) || '');
    const eu = membros.find((m) => m.uid === quem.uid);
    const preside = (eu === null || eu === void 0 ? void 0 : eu.funcao) === 'presidente';
    const vref = sref.collection('votacoes').doc(pid);
    const pref = c.db.collection(context_1.COL.processos).doc(pid);
    const ativa = s.ativa && item.situacao === 'pautado';
    if (p.action === 'sessaoVotacao') {
        const [vs, ps] = await Promise.all([vref.get(), pref.get()]);
        const v = Object.assign(Object.assign({}, vazia(pid)), (vs.data() || {}));
        const proc = ps.data();
        const regra = proc && ((_a = proc.sessao) === null || _a === void 0 ? void 0 : _a.id) === sref.id ? regraDoJulgamento(proc) : null;
        const relatorUid = v.liberado_em ? v.relator_uid : item.relator_uid || '';
        const souRelator = !!relatorUid && relatorUid === quem.uid;
        const emJulgamento = ativa && !!v.liberado_em && !v.proclamado && !!regra && s.situacao === 'publicada';
        // Com vista nesta sessão: o processo saiu da pauta até a devolução.
        const vista = ((_b = proc === null || proc === void 0 ? void 0 : proc.vista) === null || _b === void 0 ? void 0 : _b.sessao_id) === sref.id ? proc.vista : null;
        const comVista = !!vista && (vista.uids || []).includes(quem.uid);
        // Liberado o voto, os pares e a secretaria acompanham; antes, só o relator vê o que escreve.
        const vePares = !!v.liberado_em && (!!eu || gere);
        const votos = vePares ? (0, sessoes_1.votosDaSessao)(v, membros) : [];
        let previa = null;
        if (vePares && regra && !v.proclamado && (preside || gere)) {
            try {
                previa = { texto: (0, julgamento_1.textoDoJulgamento)(regra.cfg, (0, julgamento_1.dadosDoJulgamento)(regra.cfg, { data: hoje, votos }, hoje)) };
            }
            catch (e) {
                previa = { erro: e.message };
            }
        }
        return Object.assign(Object.assign({ hoje, data_sessao: s.data, situacao: s.situacao, gere, preside, sou_relator: souRelator, sou_membro: !!eu, numero: item.numero, assunto: item.assunto, membros: membros.map((m) => ({ uid: m.uid, nome: m.nome, funcao: m.funcao })), relator: relatorUid ? { uid: relatorUid, nome: v.liberado_em ? v.relator_nome : item.relator_nome || nm.get(relatorUid) || '' } : null, resultados: (regra === null || regra === void 0 ? void 0 : regra.cfg.resultados) || [], pendente: !!regra, liberado_em: v.liberado_em }, (souRelator || vePares ? { relatorio: v.relatorio, resultado: v.resultado, fundamentos: v.fundamentos } : {})), { votos: vePares ? membros.filter((m) => m.uid !== v.relator_uid).map((m) => (Object.assign(Object.assign({}, (v.votos[m.uid] || {})), { uid: m.uid, nome: m.nome, funcao: m.funcao }))) : [], meu_voto: v.votos[quem.uid] || null, placar: vePares && regra ? (0, sessoes_1.placarParcial)(regra.cfg.resultados, votos) : [], previa, proclamado: v.proclamado ? { resultado: v.proclamado.resultado, texto: v.proclamado.texto, em: v.proclamado.em, por_nome: v.proclamado.por_nome } : null, 
            // Registrado na ação do rito: o processo saiu da pauta com esta sessão como a última.
            registrado: !!v.proclamado && !!proc && ((_c = proc.ultima_sessao) === null || _c === void 0 ? void 0 : _c.id) === sref.id && ((_d = proc.sessao) === null || _d === void 0 ? void 0 : _d.id) !== sref.id, situacao_item: item.situacao, motivo: item.motivo || '', vista: vista ? { nomes: vista.nomes || [], desde: vista.desde, prazo: vista.prazo, vencida: vista.prazo < hoje, minha: comVista } : item.vista ? Object.assign(Object.assign({}, item.vista), { encerrada: true }) : null, vista_dias: ((_e = o.pauta) === null || _e === void 0 ? void 0 : _e.vista_dias) || 10, pode: {
                designar: gere && ativa && !v.liberado_em,
                relatar: souRelator && ativa && !v.liberado_em && !!regra,
                votar: emJulgamento && !!eu && !souRelator,
                proclamar: emJulgamento && (preside || gere) && s.data <= hoje,
                vista: emJulgamento && !!eu && !souRelator,
                juntar_vista: !!vista && !!eu && !souRelator && !comVista,
                devolver_vista: !!vista && (comVista || ((preside || gere) && vista.prazo < hoje)),
                adiar: (preside || gere) && ativa && !v.proclamado && !!regra && s.situacao === 'publicada',
            } });
    }
    if (p.action === 'sessaoRelator') {
        if (!gere)
            throw new https_1.HttpsError('permission-denied', 'Quem designa o relator é a secretaria do colegiado');
        const uid = String(p.uid || '');
        const m = membros.find((x) => x.uid === uid);
        if (uid && !m)
            throw new https_1.HttpsError('invalid-argument', 'O relator precisa estar entre quem vota no dia da sessão (presidente ou titular)');
        await c.db.runTransaction(async (tx) => {
            var _a;
            const [{ ref, s: s2 }, vs] = await Promise.all([(0, sessoes_2.lerSessao)(c, p.id, tx), tx.get(vref)]);
            if ((_a = vs.data()) === null || _a === void 0 ? void 0 : _a.liberado_em)
                throw new https_1.HttpsError('failed-precondition', 'O relator já liberou o voto aos pares: a relatoria não muda mais nesta sessão');
            if (!s2.ativa)
                throw new https_1.HttpsError('failed-precondition', 'A sessão foi cancelada');
            const pauta = (s2.pauta || []).map((x) => (x.processo_id === pid && x.situacao === 'pautado' ? Object.assign(Object.assign({}, x), { relator_uid: uid, relator_nome: (m === null || m === void 0 ? void 0 : m.nome) || '' }) : x));
            if (!pauta.some((x) => x.processo_id === pid && x.situacao === 'pautado'))
                throw new https_1.HttpsError('failed-precondition', 'O processo não está pautado');
            tx.update(ref, { pauta, version: (s2.version || 0) + 1 });
        });
        await (0, config_1.auditar)(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_RELATOR', { sessao_id: sref.id, processo_id: pid, numero: item.numero, relator: (m === null || m === void 0 ? void 0 : m.nome) || '' });
        return { ok: true };
    }
    if (p.action === 'sessaoRelatar') {
        if (!item.relator_uid || item.relator_uid !== quem.uid)
            throw new https_1.HttpsError('permission-denied', 'Só o relator designado escreve o relatório e o voto');
        const liberar = p.liberar === true;
        const relatorio = String((_f = p.relatorio) !== null && _f !== void 0 ? _f : '').replace(/\r\n/g, '\n').slice(0, sessoes_1.MAX_RELATORIO);
        const fundamentos = String((_g = p.fundamentos) !== null && _g !== void 0 ? _g : '').replace(/\r\n/g, '\n').slice(0, sessoes_1.MAX_RELATORIO);
        const resultado = (0, secretaria_1.texto)(p.resultado, 80);
        await c.db.runTransaction(async (tx) => {
            var _a;
            const [vs, ps] = await Promise.all([tx.get(vref), tx.get(pref)]);
            const v = vs.data();
            if (v === null || v === void 0 ? void 0 : v.liberado_em)
                throw new https_1.HttpsError('failed-precondition', 'O voto já foi liberado aos pares e não muda mais');
            const proc = ps.data();
            const regra = proc && ((_a = proc.sessao) === null || _a === void 0 ? void 0 : _a.id) === sref.id ? regraDoJulgamento(proc) : null;
            if (!ativa || !regra)
                throw new https_1.HttpsError('failed-precondition', 'O processo não está mais pautado para julgamento nesta sessão');
            if (resultado && !regra.cfg.resultados.includes(resultado))
                throw new https_1.HttpsError('invalid-argument', 'Escolha um dos resultados que o rito prevê');
            if (liberar) {
                if (s.situacao !== 'publicada')
                    throw new https_1.HttpsError('failed-precondition', 'Libere o voto depois que a pauta for publicada: antes disso os pares não veem a sessão');
                if (!resultado)
                    throw new https_1.HttpsError('invalid-argument', 'Escolha o resultado do seu voto antes de liberar');
                if (relatorio.trim().length < MIN_TEXTO || fundamentos.trim().length < MIN_TEXTO)
                    throw new https_1.HttpsError('invalid-argument', 'Escreva o relatório e os fundamentos do voto antes de liberar');
            }
            tx.set(vref, Object.assign(Object.assign(Object.assign(Object.assign({}, vazia(pid)), (v || {})), { relator_uid: quem.uid, relator_nome: item.relator_nome || quem.nome, relatorio, resultado, fundamentos, atualizado_em: new Date().toISOString() }), (liberar ? { liberado_em: new Date().toISOString() } : {})));
        });
        if (liberar)
            await (0, config_1.auditar)(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_VOTO_LIBERADO', { sessao_id: sref.id, processo_id: pid, numero: item.numero });
        return { ok: true, liberado: liberar };
    }
    if (p.action === 'sessaoVotar') {
        if (!eu)
            throw new https_1.HttpsError('permission-denied', 'Vota quem compõe o colegiado no dia da sessão (presidente e titulares)');
        let voto = null;
        await c.db.runTransaction(async (tx) => {
            var _a;
            const [vs, ps] = await Promise.all([tx.get(vref), tx.get(pref)]);
            const v = vs.data();
            if (!(v === null || v === void 0 ? void 0 : v.liberado_em))
                throw new https_1.HttpsError('failed-precondition', 'O relator ainda não liberou o voto');
            if (v.relator_uid === quem.uid)
                throw new https_1.HttpsError('failed-precondition', 'O voto do relator é o que ele liberou');
            if (v.proclamado)
                throw new https_1.HttpsError('failed-precondition', 'O resultado já foi proclamado');
            const proc = ps.data();
            const regra = proc && ((_a = proc.sessao) === null || _a === void 0 ? void 0 : _a.id) === sref.id ? regraDoJulgamento(proc) : null;
            if (!ativa || s.situacao !== 'publicada' || !regra)
                throw new https_1.HttpsError('failed-precondition', 'O processo não está mais pautado para julgamento nesta sessão');
            try {
                voto = (0, sessoes_1.sanitizeVoto)(p.voto, regra.cfg.resultados, v.resultado);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            tx.set(vref, { votos: { [quem.uid]: Object.assign(Object.assign({}, voto), { nome: quem.nome, funcao: eu.funcao, em: new Date().toISOString() }) } }, { merge: true });
        });
        await (0, config_1.auditar)(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_VOTO', { sessao_id: sref.id, processo_id: pid, numero: item.numero, modo: voto.modo });
        return { ok: true };
    }
    if (p.action === 'sessaoProclamar') {
        if (!preside && !gere)
            throw new https_1.HttpsError('permission-denied', 'Proclama o resultado o presidente do colegiado (ou a secretaria, que conduz a sessão)');
        if (s.data > hoje)
            throw new https_1.HttpsError('failed-precondition', `O resultado se proclama na sessão, em ${s.data.split('-').reverse().join('/')}`);
        let proclamado = null;
        await c.db.runTransaction(async (tx) => {
            var _a;
            const [vs, ps] = await Promise.all([tx.get(vref), tx.get(pref)]);
            const v = vs.data();
            if (!(v === null || v === void 0 ? void 0 : v.liberado_em))
                throw new https_1.HttpsError('failed-precondition', 'O relator ainda não liberou o voto');
            if (v.proclamado)
                throw new https_1.HttpsError('failed-precondition', 'O resultado já foi proclamado');
            const proc = ps.data();
            const regra = proc && ((_a = proc.sessao) === null || _a === void 0 ? void 0 : _a.id) === sref.id ? regraDoJulgamento(proc) : null;
            if (!ativa || s.situacao !== 'publicada' || !regra)
                throw new https_1.HttpsError('failed-precondition', 'O processo não está mais pautado para julgamento nesta sessão');
            // Quem não votou fica ausente; quórum, empate e desempate seguem a regra do rito (shared/julgamento).
            let dados = null;
            try {
                dados = (0, julgamento_1.dadosDoJulgamento)(regra.cfg, { data: hoje, votos: (0, sessoes_1.votosDaSessao)(v, membros) }, hoje);
            }
            catch (e) {
                (0, context_1.erroUsuario)(e);
            }
            proclamado = {
                resultado: (0, julgamento_1.apurar)(regra.cfg, dados.votos).resultado, texto: (0, julgamento_1.textoDoJulgamento)(regra.cfg, dados),
                data: hoje, em: new Date().toISOString(), por_nome: quem.nome, votos: dados.votos,
            };
            tx.set(vref, { proclamado }, { merge: true });
            tx.update(pref, { 'sessao.proclamado': proclamado });
        });
        const p2 = proclamado;
        await (0, config_1.auditar)(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_PROCLAMADO', { sessao_id: sref.id, processo_id: pid, numero: item.numero, resultado: p2.resultado });
        // O registro na ação do rito: se não couber agora (o rito mudou, ação reservada), a equipe registra com os votos da sessão.
        const aviso = await (0, processos_1.registrarJulgamentoDaSessao)(c.db, c.orgId, pid, quem.nome);
        return { ok: true, resultado: p2.resultado, texto: p2.texto, registrado: !aviso, aviso };
    }
    // ---- S5: vista, adiamento e conversão em diligência ----
    if (!ACOES_S5.includes(String(p.action)))
        throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
    const motivo = (0, secretaria_1.texto)(p.motivo, 2000);
    const avisar = [];
    let auditoria = null;
    const resultado = await c.db.runTransaction(async (tx) => {
        var _a, _b;
        avisar.length = 0;
        const [{ ref, s: s2 }, vs, ps] = await Promise.all([(0, sessoes_2.lerSessao)(c, p.id, tx), tx.get(vref), tx.get(pref)]);
        const v = vs.data();
        const proc = ps.data();
        const it = (s2.pauta || []).find((x) => x.processo_id === pid);
        if (!proc || !it)
            throw new https_1.HttpsError('not-found', 'O processo não está nesta pauta');
        const regra = ((_a = proc.sessao) === null || _a === void 0 ? void 0 : _a.id) === ref.id && it.situacao === 'pautado' && s2.ativa && s2.situacao === 'publicada' ? regraDoJulgamento(proc) : null;
        const marcarItem = (patch) => tx.update(ref, {
            pauta: (s2.pauta || []).map((x) => (x.processo_id === pid ? Object.assign(Object.assign({}, x), patch) : x)), version: (s2.version || 0) + 1, updated_at: firestore_1.FieldValue.serverTimestamp(),
        });
        const relator = { relator_uid: it.relator_uid || '', relator_nome: it.relator_nome || '' };
        const emCurso = (manter) => (Object.assign({ sessao_id: ref.id, manter_votos: manter }, relator));
        /** Continua na próxima sessão do colegiado, se já houver uma marcada. */
        const continuar = async (proc2, porque) => {
            const prox = await (0, sessoes_2.proximaSessao)(tx, c, o.id, ref.id, s2.data);
            if (!prox)
                return { prox: null, inc: {} };
            const publicada = prox.s.situacao === 'publicada';
            return { prox, inc: { publicada, fazer: (base) => (0, sessoes_2.incluirNaSessao)(tx, c, prox, o, pref, base, publicada ? 'extrapauta' : 'pauta', publicada ? porque : '', Object.assign({ de: ref.id, v }, relator)) } };
        };
        if (p.action === 'sessaoVista') {
            if (!eu)
                throw new https_1.HttpsError('permission-denied', 'Pede vista quem vota no dia da sessão (presidente e titulares)');
            if ((v === null || v === void 0 ? void 0 : v.relator_uid) === quem.uid)
                throw new https_1.HttpsError('failed-precondition', 'O relator não pede vista do próprio voto');
            // Vista coletiva: outro membro se junta ao pedido, no mesmo prazo.
            if (it.situacao === 'vista' && ((_b = proc.vista) === null || _b === void 0 ? void 0 : _b.sessao_id) === ref.id) {
                if ((proc.vista.uids || []).includes(quem.uid))
                    throw new https_1.HttpsError('already-exists', 'Você já pediu vista deste processo');
                const nomes = [...(proc.vista.nomes || []), quem.nome];
                tx.update(pref, { 'vista.uids': [...(proc.vista.uids || []), quem.uid], 'vista.nomes': nomes });
                marcarItem({ vista: Object.assign(Object.assign({}, it.vista), { nomes }) });
                auditoria = ['SECRETARIA_SESSAO_VISTA', { sessao_id: ref.id, processo_id: pid, numero: it.numero, coletiva: true }];
                return { ok: true, prazo: proc.vista.prazo };
            }
            if (!regra)
                throw new https_1.HttpsError('failed-precondition', 'O processo não está mais pautado para julgamento nesta sessão');
            if (!(v === null || v === void 0 ? void 0 : v.liberado_em))
                throw new https_1.HttpsError('failed-precondition', 'Peça vista depois que o relator liberar o voto');
            if (v.proclamado)
                throw new https_1.HttpsError('failed-precondition', 'O resultado já foi proclamado');
            const prazo = (0, sessoes_1.prazoDaVista)(hoje, o.pauta, calendario);
            const mov = (0, context_1.registrarMovimento)(tx, c, pref, proc, 'vista', (0, sessoes_1.textoDaVista)(s2, [quem.nome], prazo), { sessao_id: ref.id });
            tx.update(pref, Object.assign(Object.assign({}, mov), { sessao: firestore_1.FieldValue.delete(), julgamento_em_curso: emCurso(true), vista: { sessao_id: ref.id, sessao: s2.titulo, orgao_id: o.id, colegiado: o.nome, uids: [quem.uid], nomes: [quem.nome], desde: hoje, prazo } }));
            marcarItem({ situacao: 'vista', vista: { nomes: [quem.nome], prazo } });
            avisar.push(pid);
            auditoria = ['SECRETARIA_SESSAO_VISTA', { sessao_id: ref.id, processo_id: pid, numero: it.numero, prazo }];
            return { ok: true, prazo };
        }
        if (p.action === 'sessaoDevolverVista') {
            const vi = proc.vista;
            if (!vi || vi.sessao_id !== ref.id)
                throw new https_1.HttpsError('failed-precondition', 'O processo não está com vista nesta sessão');
            const pediu = (vi.uids || []).includes(quem.uid);
            if (!pediu && !gere && !preside)
                throw new https_1.HttpsError('permission-denied', 'Devolve a vista quem a pediu');
            if (!pediu && vi.prazo >= hoje)
                throw new https_1.HttpsError('failed-precondition', `Antes do fim do prazo (${vi.prazo.split('-').reverse().join('/')}), só quem pediu vista devolve`);
            const { prox, inc } = await continuar(proc, 'retorno de vista');
            const mov = (0, context_1.registrarMovimento)(tx, c, pref, proc, 'vista_devolvida', (0, sessoes_1.textoDaDevolucao)(vi.nomes || [], prox === null || prox === void 0 ? void 0 : prox.s), { sessao_id: ref.id });
            const mais = 'fazer' in inc && inc.fazer ? inc.fazer(Object.assign(Object.assign({}, proc), mov)) : {};
            tx.update(pref, Object.assign(Object.assign(Object.assign({}, mov), { vista: firestore_1.FieldValue.delete() }), mais));
            marcarItem({ vista: Object.assign(Object.assign({}, (it.vista || { nomes: vi.nomes, prazo: vi.prazo })), { devolvida: true }) });
            avisar.push(pid);
            auditoria = ['SECRETARIA_SESSAO_VISTA_DEVOLVIDA', { sessao_id: ref.id, processo_id: pid, numero: it.numero, continua_em: (prox === null || prox === void 0 ? void 0 : prox.ref.id) || null }];
            return { ok: true, continua_em: prox ? { id: prox.ref.id, titulo: prox.s.titulo, data: prox.s.data } : null };
        }
        if (p.action === 'sessaoAdiar' || p.action === 'sessaoDiligencia') {
            if (!gere && !preside)
                throw new https_1.HttpsError('permission-denied', 'Adia ou converte em diligência o presidente do colegiado (ou a secretaria)');
            if (!regra)
                throw new https_1.HttpsError('failed-precondition', 'O processo não está mais pautado para julgamento nesta sessão');
            if (v === null || v === void 0 ? void 0 : v.proclamado)
                throw new https_1.HttpsError('failed-precondition', 'O resultado já foi proclamado');
            const adiar = p.action === 'sessaoAdiar';
            if (motivo.length < (adiar ? 5 : 10)) {
                throw new https_1.HttpsError('invalid-argument', adiar ? 'Diga o motivo do adiamento (ao menos 5 letras)' : 'Diga o que a diligência deve fazer (ao menos 10 letras)');
            }
            // Adiado, segue para a próxima sessão com os votos já dados; em diligência, volta à unidade e, depois, a uma nova pauta com o mesmo relator.
            const { prox, inc } = adiar ? await continuar(proc, `adiado da ${s2.titulo}`) : { prox: null, inc: {} };
            const mov = (0, context_1.registrarMovimento)(tx, c, pref, proc, adiar ? 'adiamento' : 'diligencia', adiar ? (0, sessoes_1.textoDoAdiamento)(s2, motivo) : (0, sessoes_1.textoDaDiligencia)(s2, motivo), { sessao_id: ref.id });
            const mais = 'fazer' in inc && inc.fazer ? inc.fazer(Object.assign(Object.assign({}, proc), mov)) : {};
            tx.update(pref, Object.assign(Object.assign(Object.assign(Object.assign({}, mov), { sessao: firestore_1.FieldValue.delete(), julgamento_em_curso: emCurso(adiar) }), (adiar ? {} : { orientacao: { texto: `Diligência determinada pelo ${o.nome}: ${motivo}`, por: quem.nome, em: new Date().toISOString(), de: o.nome } })), mais));
            marcarItem({ situacao: adiar ? 'adiado' : 'diligencia', motivo });
            avisar.push(pid);
            auditoria = [adiar ? 'SECRETARIA_SESSAO_ADIADO' : 'SECRETARIA_SESSAO_DILIGENCIA', { sessao_id: ref.id, processo_id: pid, numero: it.numero, motivo, continua_em: (prox === null || prox === void 0 ? void 0 : prox.ref.id) || null }];
            return { ok: true, continua_em: prox ? { id: prox.ref.id, titulo: prox.s.titulo, data: prox.s.data } : null };
        }
        throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
    });
    if (auditoria)
        await (0, config_1.auditar)(c.db, c.orgId, quem.uid, quem.nome, auditoria[0], auditoria[1]);
    // E-mail às partes depois da transação: falha de envio não desfaz o ato.
    await Promise.all(avisar.map((id) => (0, portalAvisos_1.avisarPartesDoMovimento)(c.db, id, quem.uid).catch(() => undefined)));
    return resultado;
}
//# sourceMappingURL=votacao.js.map