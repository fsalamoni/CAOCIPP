"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACOES_S8 = exports.COL_PAINEIS = void 0;
exports.atualizarPainel = atualizarPainel;
exports.montarAta = montarAta;
exports.acaoAta = acaoAta;
exports.avisarComposicao = avisarComposicao;
exports.lembrarSessoes = lembrarSessoes;
exports.ataParaTela = ataParaTela;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const orgaos_1 = require("../shared/orgaos");
const sessoes_1 = require("../shared/sessoes");
const config_1 = require("./config");
const context_1 = require("./context");
const avisosEquipe_1 = require("./avisosEquipe");
const sessoes_2 = require("./sessoes");
const votacao_1 = require("./votacao");
/**
 * Etapa S8: presença, chamada do processo em julgamento, ata da sessão
 * (gerada ao encerrar, assinada pelo presidente e pela secretaria), o painel ao
 * vivo (secPaineis/{sessao}) e os avisos à composição (publicação,
 * cancelamento e lembretes da rotina diária).
 *
 * O painel é uma cópia do que todos os leitores podem ver (sem votos antes da
 * proclamação, sem assunto de processo restrito): as regras do Firestore deixam
 * ler quem está em `leitores`, e a tela recarrega quando `versao` muda.
 */
exports.COL_PAINEIS = 'secPaineis';
exports.ACOES_S8 = ['sessaoPresenca', 'sessaoChamar', 'sessaoAta', 'sessaoAtaAssinar'];
/** Nome de cada conta na entidade (userOrganizations). */
async function nomesPor(db, orgId, uids) {
    const lista = [...new Set(uids)].filter(Boolean);
    if (!lista.length)
        return new Map();
    const snaps = await db.getAll(...lista.map((u) => db.collection('userOrganizations').doc(`${u}_${orgId}`)));
    return new Map(snaps.map((s, i) => { var _a, _b; return [lista[i], String(((_a = s.data()) === null || _a === void 0 ? void 0 : _a.user_name) || ((_b = s.data()) === null || _b === void 0 ? void 0 : _b.user_email) || 'Membro')]; }));
}
async function orgaoDa(db, orgId, s) {
    const cfg = (await db.collection(context_1.COL.config).doc(orgId).get()).data();
    return (0, orgaos_1.orgaosDe)(cfg === null || cfg === void 0 ? void 0 : cfg.orgaos).find((o) => o.id === s.orgao_id);
}
/** Quem vota no dia (presidente e titulares), como na votação. */
const votamNoDia = (o, dia) => (0, orgaos_1.composicaoEm)(o.composicao, dia).filter((m) => m.funcao !== 'suplente').map((m) => m.uid);
/**
 * Refaz o painel da sessão. `extra`: alguém que pode ver a sessão e não está
 * entre os leitores de base (admin, gestor fora do colegiado). Nunca lança:
 * painel desatualizado não desfaz o ato.
 */
async function atualizarPainel(db, orgId, sessaoId, extra) {
    var _a;
    try {
        const sref = db.collection(sessoes_2.COL_SESSOES).doc(sessaoId);
        const pref = db.collection(exports.COL_PAINEIS).doc(sessaoId);
        const [ss, ps] = await Promise.all([sref.get(), pref.get()]);
        const s = ss.data();
        if (!s || s.organization_id !== orgId)
            return;
        const o = await orgaoDa(db, orgId, s);
        if (!o)
            return;
        const pauta = [...(s.pauta || [])].sort((a, b) => a.ordem - b.ordem);
        const [vs, procs, unis] = await Promise.all([
            pauta.length ? db.getAll(...pauta.map((x) => sref.collection('votacoes').doc(x.processo_id))) : Promise.resolve([]),
            pauta.length ? db.getAll(...pauta.map((x) => db.collection(context_1.COL.processos).doc(x.processo_id))) : Promise.resolve([]),
            db.collection(context_1.COL.unidades).where('organization_id', '==', orgId).where('orgao_id', '==', o.id).get(),
        ]);
        const extras = [...new Set([...(((_a = ps.data()) === null || _a === void 0 ? void 0 : _a.extras) || []), ...(extra ? [extra] : [])])];
        // Rascunho: só quem o abriu (a secretaria). Publicada: a composição, quem está lotado no colegiado e os extras.
        const base = s.situacao === 'rascunho' ? [] : [
            ...(0, orgaos_1.composicaoEm)(o.composicao, s.data).map((m) => m.uid),
            ...unis.docs.filter((u) => !u.data().excluida).flatMap((u) => (0, secretaria_1.lotacoesDe)(u.data()).map((l) => l.uid)),
        ];
        const quemVota = votamNoDia(o, s.data);
        const itens = pauta.map((x, i) => {
            var _a, _b, _c, _d, _e;
            const v = (_a = vs[i]) === null || _a === void 0 ? void 0 : _a.data();
            const d = (_b = procs[i]) === null || _b === void 0 ? void 0 : _b.data();
            const julgado = !!d && ((_c = d.ultima_sessao) === null || _c === void 0 ? void 0 : _c.id) === sessaoId && ((_d = d.sessao) === null || _d === void 0 ? void 0 : _d.id) !== sessaoId;
            const r = (0, votacao_1.resumoVotacao)(v, '', x.situacao === 'pautado' ? quemVota : [], x.relator_uid || '');
            return {
                processo_id: x.processo_id, ordem: x.ordem, numero: x.numero, inclusao: x.inclusao,
                assunto: (d === null || d === void 0 ? void 0 : d.sigilo) === 'restrito' ? 'Processo sob sigilo' : x.assunto,
                situacao: julgado || (x.situacao === 'pautado' && (v === null || v === void 0 ? void 0 : v.proclamado)) ? 'julgado' : x.situacao,
                relator: x.relator_nome || '',
                // Só o resultado proclamado; o voto de cada um fica na tela de julgamento.
                resultado: ((_e = v === null || v === void 0 ? void 0 : v.proclamado) === null || _e === void 0 ? void 0 : _e.resultado) || null,
                liberado: r.liberado, votaram: r.votaram, vogais: r.vogais,
            };
        });
        await pref.set({
            organization_id: orgId, orgao_id: o.id, colegiado: o.nome,
            leitores: [...new Set([...base, ...extras])].slice(0, 500), extras,
            titulo: s.titulo, carater: s.carater, modo: s.modo, data: s.data, hora: s.hora, fim: s.fim || null, local: s.local || '', link: s.link || '',
            situacao: s.situacao, em_julgamento: s.em_julgamento || null, ata_assinada: (0, sessoes_1.ataAssinada)(s.ata),
            itens, versao: firestore_1.FieldValue.increment(1), atualizado_em: new Date().toISOString(),
        }, { merge: true });
    }
    catch (e) {
        console.error('painel não atualizado', sessaoId, e);
    }
}
/** Gera a ata com o que a sessão registrou (presença, pauta, votações, sustentações). */
async function montarAta(db, orgId, sessaoId) {
    const sref = db.collection(sessoes_2.COL_SESSOES).doc(sessaoId);
    const s = (await sref.get()).data();
    const o = await orgaoDa(db, orgId, s);
    if (!o)
        throw new https_1.HttpsError('failed-precondition', 'O colegiado da sessão não existe mais');
    const pauta = [...(s.pauta || [])].sort((a, b) => a.ordem - b.ordem);
    const [vs, procs, peds] = await Promise.all([
        pauta.length ? db.getAll(...pauta.map((x) => sref.collection('votacoes').doc(x.processo_id))) : Promise.resolve([]),
        pauta.length ? db.getAll(...pauta.map((x) => db.collection(context_1.COL.processos).doc(x.processo_id))) : Promise.resolve([]),
        sref.collection('pedidos').get(),
    ]);
    const vots = vs.map((d) => d.data());
    const comp = (0, orgaos_1.composicaoEm)(o.composicao, s.data);
    // Na virtual, participou quem votou (o relator, ao liberar o voto).
    const votaram = new Set(vots.flatMap((v) => (v ? [...(v.liberado_em ? [v.relator_uid] : []), ...Object.keys(v.votos || {})] : [])));
    const nm = await nomesPor(db, orgId, [...comp.map((m) => m.uid), ...votaram]);
    const nome = (u) => nm.get(u) || 'Membro';
    const presid = comp.find((m) => m.funcao === 'presidente');
    const marcas = (s.presencas || {});
    const registrada = s.modo !== 'assincrona' && Object.keys(marcas).length > 0;
    const presidenteFaltou = !!presid && registrada && marcas[presid.uid] !== true;
    const outros = comp.filter((m) => m.uid !== (presid === null || presid === void 0 ? void 0 : presid.uid));
    const presenca = s.modo === 'assincrona'
        ? { presidente: presid ? nome(presid.uid) : '', presentes: [...votaram].map(nome), ausentes: [], registrada: true }
        : {
            presidente: presid && !presidenteFaltou ? nome(presid.uid) : '',
            presentes: (registrada ? outros.filter((m) => marcas[m.uid] === true) : outros).map((m) => nome(m.uid)),
            ausentes: registrada ? comp.filter((m) => marcas[m.uid] !== true).map((m) => nome(m.uid)) : [],
            registrada,
        };
    const pedidos = peds.docs.map((d) => d.data());
    const itens = pauta.map((x, i) => {
        var _a, _b, _c;
        const v = vots[i];
        const restrito = ((_b = (_a = procs[i]) === null || _a === void 0 ? void 0 : _a.data()) === null || _b === void 0 ? void 0 : _b.sigilo) === 'restrito';
        return {
            numero: x.numero, assunto: restrito ? '' : x.assunto, situacao: x.situacao, motivo: x.motivo || '', relator: x.relator_nome || (v === null || v === void 0 ? void 0 : v.relator_nome) || '',
            vista: x.vista, proclamado: ((_c = v === null || v === void 0 ? void 0 : v.proclamado) === null || _c === void 0 ? void 0 : _c.texto) || '', redator: (v === null || v === void 0 ? void 0 : v.proclamado) && v.acordao ? v.acordao.redator_nome : '',
            sustentacoes: [...new Set(pedidos.filter((p) => p.processo_id === x.processo_id && p.tipo === 'sustentacao' && p.situacao !== 'indeferido').map((p) => p.parte))],
        };
    });
    const textoAta = (0, sessoes_1.textoDaAta)(s, o.nome, presenca, itens, String(s.encerrada_em || new Date().toISOString()).slice(0, 10)).slice(0, sessoes_1.MAX_ATA);
    return { texto: textoAta, gerada_em: new Date().toISOString(), sha256: (0, secretaria_1.sha256)(textoAta), assinaturas: [] };
}
async function acaoAta(c, p) {
    var _a, _b;
    const hoje = (0, secretaria_1.hojeBrasil)();
    const quem = { uid: c.ctx.uid, nome: c.userName };
    const { orgaos } = await (0, sessoes_2.lerConfig)(c);
    const { ref, s } = await (0, sessoes_2.lerSessao)(c, p.id);
    const o = (0, sessoes_2.colegiado)(orgaos, s.orgao_id);
    const gere = (0, sessoes_2.gereSessoes)(c, o.id);
    if (!(0, sessoes_2.veSessoes)(c, o, hoje) || (s.situacao === 'rascunho' && !gere))
        throw new https_1.HttpsError('not-found', 'Sessão não encontrada');
    const comp = (0, orgaos_1.composicaoEm)(o.composicao, s.data);
    const preside = comp.some((m) => m.uid === quem.uid && m.funcao === 'presidente');
    const noDia = s.situacao === 'publicada' && s.ativa && s.modo !== 'assincrona' && s.data <= hoje;
    if (p.action === 'sessaoPresenca') {
        if (!gere)
            throw new https_1.HttpsError('permission-denied', 'Quem registra a presença é a secretaria do colegiado');
        if (!noDia)
            throw new https_1.HttpsError('failed-precondition', s.modo === 'assincrona' ? 'Na sessão virtual, participa quem vota: não há presença a registrar' : 'A presença se registra no dia da sessão publicada, até o encerramento');
        const raw = (p.presencas && typeof p.presencas === 'object' ? p.presencas : {});
        const presencas = {};
        for (const m of comp)
            if (typeof raw[m.uid] === 'boolean')
                presencas[m.uid] = raw[m.uid];
        await ref.update({ presencas, version: firestore_1.FieldValue.increment(1), updated_at: firestore_1.FieldValue.serverTimestamp() });
        return { ok: true, presentes: Object.values(presencas).filter(Boolean).length };
    }
    if (p.action === 'sessaoChamar') {
        if (!gere && !preside)
            throw new https_1.HttpsError('permission-denied', 'Chama o processo o presidente do colegiado (ou a secretaria)');
        if (!noDia)
            throw new https_1.HttpsError('failed-precondition', 'Chama-se o processo no dia da sessão publicada');
        const pid = typeof p.processo_id === 'string' ? p.processo_id : '';
        if (pid && !(s.pauta || []).some((x) => x.processo_id === pid && x.situacao === 'pautado'))
            throw new https_1.HttpsError('failed-precondition', 'O processo não está pautado nesta sessão');
        await ref.update({ em_julgamento: pid || firestore_1.FieldValue.delete(), version: firestore_1.FieldValue.increment(1), updated_at: firestore_1.FieldValue.serverTimestamp() });
        return { ok: true };
    }
    const ata = s.ata;
    if (p.action === 'sessaoAta') {
        if (!gere)
            throw new https_1.HttpsError('permission-denied', 'Quem lavra a ata é a secretaria do colegiado');
        if (s.situacao !== 'encerrada')
            throw new https_1.HttpsError('failed-precondition', 'A ata se lavra depois de encerrada a sessão');
        if ((_a = ata === null || ata === void 0 ? void 0 : ata.assinaturas) === null || _a === void 0 ? void 0 : _a.length)
            throw new https_1.HttpsError('failed-precondition', 'A ata já tem assinatura e não muda mais');
        let nova;
        if (p.refazer === true || !ata)
            nova = await montarAta(c.db, c.orgId, ref.id);
        else {
            const t = String((_b = p.texto) !== null && _b !== void 0 ? _b : '').replace(/\r\n/g, '\n').slice(0, sessoes_1.MAX_ATA);
            if (t.trim().length < 20)
                throw new https_1.HttpsError('invalid-argument', 'A ata ficou curta demais');
            nova = Object.assign(Object.assign({}, ata), { texto: t, sha256: (0, secretaria_1.sha256)(t), editada_por: quem.nome });
        }
        await ref.update({ ata: nova, version: firestore_1.FieldValue.increment(1) });
        await (0, config_1.auditar)(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_ATA', { sessao_id: ref.id, refeita: p.refazer === true || !ata });
        return { ok: true };
    }
    if (p.action === 'sessaoAtaAssinar') {
        const papel = p.papel === 'presidente' ? 'presidente' : 'secretaria';
        if (papel === 'presidente' ? !preside : !gere) {
            throw new https_1.HttpsError('permission-denied', papel === 'presidente' ? 'Assina como presidente quem preside o colegiado no dia da sessão' : 'Assina como secretaria quem cuida das sessões do colegiado');
        }
        await c.db.runTransaction(async (tx) => {
            const atual = (await tx.get(ref)).data();
            const a = atual.ata;
            if (!a)
                throw new https_1.HttpsError('failed-precondition', 'A ata ainda não foi lavrada');
            if (a.assinaturas.some((x) => x.papel === papel))
                throw new https_1.HttpsError('already-exists', `A ata já tem a assinatura ${papel === 'presidente' ? 'do presidente' : 'da secretaria'}`);
            if (a.assinaturas.some((x) => x.uid === quem.uid))
                throw new https_1.HttpsError('failed-precondition', 'Você já assinou esta ata: a outra assinatura é de outra pessoa');
            tx.update(ref, { 'ata.assinaturas': [...a.assinaturas, { uid: quem.uid, nome: quem.nome, papel, em: new Date().toISOString(), sha256: a.sha256 }], version: firestore_1.FieldValue.increment(1) });
        });
        await (0, config_1.auditar)(c.db, c.orgId, quem.uid, quem.nome, 'SECRETARIA_SESSAO_ATA_ASSINADA', { sessao_id: ref.id, papel });
        return { ok: true };
    }
    throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
}
const esc = (t) => t.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const quando = (s) => (s.modo === 'assincrona' ? `votação virtual de ${(0, sessoes_1.br)(s.data)} a ${(0, sessoes_1.br)(String(s.fim || s.data))}` : `${(0, sessoes_1.br)(s.data)}, às ${s.hora}, ${(0, sessoes_1.ondeSessao)(s)}`);
/** Avisa quem compõe o colegiado no dia da sessão (sino e e-mail, pela preferência de cada um). */
async function avisarComposicao(db, orgId, sessaoId, s, o, oQue, uids, autorUid) {
    const n = (s.pauta || []).filter((x) => x.situacao === 'pautado').length;
    const proc = n === 1 ? '1 processo' : `${n} processos`;
    const t = {
        publicada: [`Pauta publicada: ${s.titulo}`, `${o.nome}, ${quando(s)} · ${proc}. Os autos ficam abertos a quem compõe o colegiado enquanto pautados.`],
        cancelada: [`Sessão cancelada: ${s.titulo}`, `${o.nome}, que seria em ${quando(s)}. Motivo: ${s.motivo_cancelamento || ''}`],
        amanha: [`Sessão amanhã: ${s.titulo}`, `${o.nome}, ${quando(s)} · ${proc} na pauta.`],
        abriu: [`Votação virtual aberta: ${s.titulo}`, `${o.nome}, ${quando(s)} · ${proc} na pauta. Vote até ${(0, sessoes_1.br)(String(s.fim || s.data))}.`],
        ultimo_dia: [`Último dia para votar: ${s.titulo}`, `${o.nome}: a votação virtual termina hoje e você ainda tem voto a dar. Quem não vota fica ausente.`],
    }[oQue];
    await (0, avisosEquipe_1.notificarPessoas)(db, orgId, uids || (0, orgaos_1.composicaoEm)(o.composicao, s.data).map((m) => m.uid), {
        subtipo: 'sessao', procId: '', sessaoId, titulo: t[0], mensagem: t[1].slice(0, 300), html: `<p>${esc(t[1])}</p>`,
    }, autorUid);
}
/**
 * Rotina das 7h: lembra a composição da sessão de amanhã, da votação virtual
 * que abre hoje e, no último dia, quem ainda não votou. Uma vez por dia e sessão.
 */
async function lembrarSessoes(db, hoje = (0, secretaria_1.hojeBrasil)()) {
    var _a;
    const amanha = (0, secretaria_1.somarDias)(hoje, 1);
    const [a, b, f] = await Promise.all([
        db.collection(sessoes_2.COL_SESSOES).where('data', '==', amanha).limit(300).get(),
        db.collection(sessoes_2.COL_SESSOES).where('data', '==', hoje).limit(300).get(),
        db.collection(sessoes_2.COL_SESSOES).where('fim', '==', hoje).limit(300).get(),
    ]);
    const vistos = new Set();
    let n = 0;
    for (const d of [...f.docs, ...b.docs, ...a.docs]) {
        if (vistos.has(d.id))
            continue;
        vistos.add(d.id);
        const s = d.data();
        if (s.situacao !== 'publicada' || !s.ativa || s.lembrado_em === hoje)
            continue;
        const virtual = s.modo === 'assincrona';
        const oQue = virtual ? (s.fim === hoje ? 'ultimo_dia' : s.data === hoje ? 'abriu' : null) : s.data === amanha ? 'amanha' : null;
        if (!oQue)
            continue;
        try {
            const orgId = String(s.organization_id);
            const o = await orgaoDa(db, orgId, s);
            if (!o)
                continue;
            let uids;
            if (oQue === 'ultimo_dia') {
                // Só quem ainda deve voto em processo com o voto do relator liberado.
                const quemVota = votamNoDia(o, s.data);
                const pautados = (s.pauta || []).filter((x) => x.situacao === 'pautado');
                const vs = pautados.length ? await db.getAll(...pautados.map((x) => d.ref.collection('votacoes').doc(x.processo_id))) : [];
                const devem = new Set();
                for (const v of vs.map((x) => x.data())) {
                    if (!(v === null || v === void 0 ? void 0 : v.liberado_em) || v.proclamado)
                        continue;
                    for (const u of quemVota)
                        if (u !== v.relator_uid && !((_a = v.votos) === null || _a === void 0 ? void 0 : _a[u]))
                            devem.add(u);
                }
                uids = [...devem];
            }
            await d.ref.update({ lembrado_em: hoje });
            if (uids && !uids.length)
                continue;
            await avisarComposicao(db, orgId, d.id, s, o, oQue, uids);
            n++;
        }
        catch (e) {
            console.error('lembrete da sessão', d.id, e);
        }
    }
    return n;
}
/** Para a tela: a ata sem o que é interno (uid de quem assinou). */
function ataParaTela(a) {
    if (!a)
        return null;
    return {
        texto: a.texto, gerada_em: a.gerada_em, sha256: a.sha256, editada_por: a.editada_por || '', assinada: (0, sessoes_1.ataAssinada)(a),
        assinaturas: (a.assinaturas || []).map((x) => ({ nome: x.nome, papel: x.papel, em: x.em })),
    };
}
//# sourceMappingURL=painelAta.js.map