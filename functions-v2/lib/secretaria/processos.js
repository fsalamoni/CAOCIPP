"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaProcesso = void 0;
const crypto_1 = require("crypto");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const email_1 = require("../shared/email");
const portalAvisos_1 = require("./portalAvisos");
const avisosEquipe_1 = require("./avisosEquipe");
const context_1 = require("./context");
const CONVITE_DIAS = 7;
const APP_URL = process.env.APP_URL || 'https://sigo-caocipp.web.app';
const escapar = (s) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const POLOS = ['requerente', 'requerido', 'interessado', 'terceiro'];
const MAX_PARTES = 50;
const MAX_REPRESENTANTES = 5;
function sanitizePartes(input) {
    const lista = Array.isArray(input) ? input.slice(0, MAX_PARTES) : [];
    return lista
        .map((x) => {
        const o = (x && typeof x === 'object' ? x : {});
        const polo = typeof o.polo === 'string' && POLOS.includes(o.polo) ? o.polo : 'interessado';
        return { nome: (0, secretaria_1.texto)(o.nome), documento: (0, secretaria_1.texto)(o.documento, 30), email: (0, secretaria_1.texto)(o.email, 120), polo };
    })
        .filter((p) => p.nome);
}
function resumo(id, d) {
    var _a;
    return {
        id,
        numero: d.numero,
        assunto: d.assunto,
        status: d.status,
        sigilo: d.sigilo,
        fase_atual: d.fase_atual,
        fase_nome: ((_a = (d.fases || []).find((f) => f.id === d.fase_atual)) === null || _a === void 0 ? void 0 : _a.nome) || d.fase_atual,
        unidade_atual: d.unidade_atual,
        responsavel_uid: d.responsavel_uid || null,
        rito_nome: d.rito_nome,
        tipo_id: d.tipo_id || null,
        tipo_nome: d.tipo_nome || null,
        ultimo_movimento: d.ultimo_movimento || null,
        version: d.version,
        pendencias_abertas: d.pendencias_abertas || 0,
        fase_suspensa: d.fase_suspensa === true,
        proximo_vencimento: d.proximo_vencimento || null,
        // Pesquisa e painéis.
        rito_id: d.rito_id || null,
        autuado_em: d.autuado_em || null,
        partes_resumo: (d.partes || []).map((x) => [x.nome, x.documento].filter(Boolean).join(' ')).join(' · ').slice(0, 500),
        pendencia_desde: (d.pendencias || [])
            .filter((x) => x.status === 'aberta').map((x) => String(x.aberta_em || '')).filter(Boolean).sort()[0] || null,
        // Fila de trabalho: quando chegou na unidade, pedidos de assinatura e orientação do gabinete.
        recebido_em: d.recebido_em || d.autuado_em || null,
        assinaturas_pendentes: d.assinaturas_pendentes || [],
        orientacao: d.orientacao || null,
    };
}
exports.secretariaProcesso = (0, https_1.onCall)({ region: context_1.REGION }, async (request) => {
    var _a, _b, _d;
    const auth = (0, context_1.exigirAuth)(request);
    const p = request.data || {};
    const c = await (0, context_1.carregarContexto)(auth, p.organizationId);
    const { db, orgId } = c;
    if (p.action === 'listar' && p.limite) {
        // Paginado pelo servidor: do mais recente para o mais antigo por
        // updated_at (índice organization_id + updated_at), filtrando a posse
        // e o sigilo em memória; `cursor` é o updated_at (ms) do último lido.
        const limite = Math.min(Math.max(Number(p.limite) || 50, 1), 200);
        let q = db.collection(context_1.COL.processos).where('organization_id', '==', orgId).orderBy('updated_at', 'desc');
        if (p.cursor)
            q = q.startAfter(firestore_1.Timestamp.fromMillis(Number(p.cursor)));
        const snap = await q.limit(limite).get();
        const processos = snap.docs
            .filter((d) => (0, secretaria_1.podeVer)(d.data(), c.ctx))
            .filter((d) => p.escopo !== 'caixa' || (0, secretaria_1.podeAgir)(d.data(), c.ctx))
            .map((d) => resumo(d.id, d.data()));
        const ultimo = snap.docs[snap.docs.length - 1];
        return { processos, cursor: ((_b = (_a = ultimo === null || ultimo === void 0 ? void 0 : ultimo.data().updated_at) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || null, mais: snap.size === limite };
    }
    if (p.action === 'contadores') {
        // Carga por unidade (processos não arquivados) e totais, por contagem
        // no servidor: não traz documentos.
        const base = db.collection(context_1.COL.processos).where('organization_id', '==', orgId);
        const conta = async (q) => (await q.count().get()).data().count;
        const [total, arquivados, porUnidade] = await Promise.all([
            conta(base),
            conta(base.where('status', '==', 'arquivado')),
            Promise.all(c.unidades.map(async (u) => {
                const [t, a] = await Promise.all([conta(base.where('unidade_atual', '==', u.id)), conta(base.where('unidade_atual', '==', u.id).where('status', '==', 'arquivado'))]);
                return [u.id, t - a];
            })),
        ]);
        return { total, arquivados, ativos: total - arquivados, por_unidade: Object.fromEntries(porUnidade) };
    }
    if (p.action === 'listar') {
        // ponytail: lê até 1000 processos do órgão e filtra/ordena em memória
        // (sem índice composto). A lista com filtros usa a versão paginada acima.
        const snap = await db.collection(context_1.COL.processos).where('organization_id', '==', orgId).limit(1000).get();
        const lista = snap.docs
            .filter((d) => (0, secretaria_1.podeVer)(d.data(), c.ctx))
            .filter((d) => p.escopo !== 'caixa' || (0, secretaria_1.podeAgir)(d.data(), c.ctx))
            .map((d) => { var _a, _b; return (Object.assign(Object.assign({}, resumo(d.id, d.data())), { _t: ((_b = (_a = d.data().updated_at) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) || 0 })); })
            .sort((a, b) => b._t - a._t)
            .map((_a) => {
            var { _t } = _a, r = __rest(_a, ["_t"]);
            return r;
        });
        return { processos: lista };
    }
    if (p.action === 'obter') {
        const { ref, data } = await (0, context_1.lerProcesso)(c, p.id);
        const [movs, docs] = await Promise.all([
            ref.collection('movimentos').orderBy('seq').get(),
            // Sem o conteúdo (pode ter imagens): só o que a lista mostra.
            ref.collection('documentos').select('titulo', 'tipo', 'origem', 'status', 'mime', 'nome_arquivo', 'tamanho', 'sha256', 'ordem', 'unidade_origem', 'autor_nome', 'criado_em', 'juntado_em', 'assinaturas', 'peticao', 'visivel_partes', 'paginas', 'folha_inicial', 'folha_final', 'codigo_verificacao', 'assinaturas_pedidas', 'peticao_tipo').get(),
        ]);
        const movimentos = movs.docs.map((d) => d.data());
        const posse = (0, secretaria_1.podeAgir)(data, c.ctx);
        const documentos = docs.docs
            .map((d) => (Object.assign({ id: d.id }, d.data())))
            // Minuta só é vista pela unidade que a redigiu; juntado = autos.
            .filter((d) => d.status === 'juntado' || c.ctx.unidadeIds.includes(d.unidade_origem))
            .map((d) => ({
            id: d.id, titulo: d.titulo, tipo: d.tipo, origem: d.origem, status: d.status,
            mime: d.mime || null, nome_arquivo: d.nome_arquivo || null, tamanho: d.tamanho || null,
            sha256: d.sha256, ordem: d.ordem || null, unidade_origem: d.unidade_origem,
            autor_nome: d.autor_nome, criado_em: d.criado_em, juntado_em: d.juntado_em || null,
            assinaturas: d.assinaturas || [], assinaturas_pedidas: d.assinaturas_pedidas || [],
            peticao: d.peticao === true, peticao_tipo: d.peticao_tipo || null, visivel_partes: d.visivel_partes !== false,
            paginas: d.paginas || null, folha_inicial: d.folha_inicial || null, folha_final: d.folha_final || null, codigo_verificacao: d.codigo_verificacao || null,
        }))
            .sort((a, b) => (a.ordem || 1e9) - (b.ordem || 1e9) || String(a.criado_em).localeCompare(String(b.criado_em)));
        return {
            processo: Object.assign(Object.assign({}, resumo(ref.id, data)), { descricao: data.descricao, partes: (data.partes || []).map((_a) => {
                    var { convite_hash, uid, representantes } = _a, x = __rest(_a, ["convite_hash", "uid", "representantes"]);
                    return (Object.assign(Object.assign({}, x), { portal: uid ? 'ativo' : convite_hash ? 'convidado' : null, representantes: (representantes || []).map(({ convite_hash: ch, uid: u, nome, email }) => ({
                            nome, email: email || null, portal: u ? 'ativo' : ch ? 'convidado' : null,
                        })) }));
                }), fases: data.fases || [], unidades_historico: data.unidades_historico || [], autuado_em: data.autuado_em, autuado_por: data.autuado_por_nome, pendencias: data.pendencias || [], prazos: data.prazos || [], acoes_feitas: data.acoes_feitas || {} }),
            hoje: (0, secretaria_1.hojeBrasil)(),
            movimentos,
            documentos,
            cadeiaQuebradaEm: (0, secretaria_1.verificarCadeia)(movimentos),
            posse,
        };
    }
    if (p.action === 'autuar') {
        const assunto = (0, secretaria_1.texto)(p.assunto);
        if (!assunto)
            throw new https_1.HttpsError('invalid-argument', 'Informe o assunto');
        const unidadeId = String(p.unidade_id || '');
        const unidade = c.unidades.find((u) => u.id === unidadeId && u.ativa !== false);
        if (!unidade)
            throw new https_1.HttpsError('invalid-argument', 'Escolha a unidade que autua o processo');
        if (!c.ctx.unidadeIds.includes(unidadeId)) {
            throw new https_1.HttpsError('permission-denied', 'Você só autua processos em unidade onde está lotado');
        }
        // Tipo de processo: define o rito e o sigilo padrão.
        let tipo = null;
        if (p.tipo_id) {
            tipo = (await db.collection(context_1.COL.tipos).doc(String(p.tipo_id)).get()).data() || null;
            if (!tipo || tipo.organization_id !== orgId || tipo.ativo === false)
                throw new https_1.HttpsError('invalid-argument', 'Escolha um tipo de processo ativo');
        }
        const ritoSnap = await db.collection(context_1.COL.ritos).doc(String((tipo === null || tipo === void 0 ? void 0 : tipo.rito_id) || p.rito_id || '_')).get();
        const rito = ritoSnap.data();
        if (!ritoSnap.exists || !rito || rito.organization_id !== orgId || rito.ativo === false) {
            throw new https_1.HttpsError('invalid-argument', tipo ? 'O rito deste tipo de processo está inativo. Ajuste o tipo na Configuração.' : 'Escolha um rito ativo');
        }
        const sigilo = (p.sigilo || (tipo === null || tipo === void 0 ? void 0 : tipo.sigilo_padrao)) === 'restrito' ? 'restrito' : 'normal';
        const ano = new Date().getFullYear();
        const contadorRef = db.collection(context_1.COL.contadores).doc(`${orgId}_${ano}`);
        const procRef = db.collection(context_1.COL.processos).doc();
        const numero = await db.runTransaction(async (tx) => {
            var _a;
            const cont = await tx.get(contadorRef);
            const seq = (Number((_a = cont.data()) === null || _a === void 0 ? void 0 : _a.seq) || 0) + 1;
            tx.set(contadorRef, { organization_id: orgId, ano, seq }, { merge: true });
            const numero = (0, secretaria_1.numeroProcesso)(ano, seq);
            const fases = rito.fases;
            const base = Object.assign(Object.assign(Object.assign({ organization_id: orgId, numero,
                assunto, descricao: (0, secretaria_1.texto)(p.descricao, secretaria_1.MAX_TEXTO_LONGO), partes: sanitizePartes(p.partes), sigilo }, (tipo ? { tipo_id: String(p.tipo_id), tipo_nome: tipo.nome } : {})), { status: 'em_tramitacao', rito_id: ritoSnap.id, rito_nome: rito.nome, rito_versao: rito.versao || 1, fases, fase_atual: fases[0].id, unidade_atual: unidadeId, unidades_historico: [unidadeId], responsavel_uid: null, autuado_por: auth.uid, autuado_por_nome: c.userName, autuado_em: new Date().toISOString(), created_at: firestore_1.FieldValue.serverTimestamp(), mov_seq: 0, doc_seq: 0, ultimo_hash: '', version: 0, pendencias: [], prazos: [] }), (0, secretaria_1.derivados)([], []));
            const mov = (0, context_1.registrarMovimento)(tx, c, procRef, base, 'autuacao', `Processo${tipo ? ` (${tipo.nome})` : ''} autuado na unidade ${unidade.nome}, rito ${rito.nome} (versão ${base.rito_versao}), fase ${fases[0].nome}.`, { assunto, rito_id: ritoSnap.id, rito_versao: base.rito_versao, unidade: unidadeId });
            tx.set(procRef, Object.assign(Object.assign({}, base), mov));
            return numero;
        });
        return { success: true, id: procRef.id, numero };
    }
    // ---- Movimentações sobre um processo existente --------------------------
    const motivo = (0, secretaria_1.texto)(p.motivo, secretaria_1.MAX_TEXTO_LONGO);
    // Feriados locais e recesso do órgão entram na contagem de prazos.
    const calendario = p.action === 'abrirPrazo'
        ? (0, secretaria_1.sanitizeCalendario)((_d = (await db.collection(context_1.COL.config).doc(orgId).get()).data()) === null || _d === void 0 ? void 0 : _d.calendario)
        : undefined;
    const convite = { token: '', email: '', parte: '', numero: '', representaQuem: '' };
    let recebeu = null;
    let pendenciaAberta = null;
    const resultado = await db.runTransaction(async (tx) => {
        var _a, _b, _d, _e, _f;
        const { ref, data } = await (0, context_1.lerProcesso)(c, p.id, tx);
        (0, context_1.conferirVersao)(data, p.version);
        (0, context_1.exigirPosse)(c, data);
        if (data.status === 'arquivado' && p.action !== 'alterarStatus') {
            throw new https_1.HttpsError('failed-precondition', 'Processo arquivado: reative-o antes de movimentar');
        }
        if (p.action === 'tramitar') {
            const destino = c.unidades.find((u) => u.id === p.unidade_destino && u.ativa !== false);
            if (!destino)
                throw new https_1.HttpsError('invalid-argument', 'Unidade de destino inválida');
            if (destino.id === data.unidade_atual)
                throw new https_1.HttpsError('invalid-argument', 'O processo já está nessa unidade');
            // Remessa a gabinete é conclusão: o processo vai para quem decide.
            const conclusao = destino.tipo === 'gabinete';
            // Opcional, num só ato: mudar a fase (quando a próxima corre em outra unidade)
            // e deixar uma orientação para a unidade que recebe (devolução do gabinete).
            const fases = (data.fases || []);
            const novaFase = p.fase_id ? fases.find((f) => f.id === p.fase_id) : null;
            if (p.fase_id && !novaFase)
                throw new https_1.HttpsError('invalid-argument', 'Fase inválida');
            if (novaFase && novaFase.id === data.fase_atual)
                throw new https_1.HttpsError('invalid-argument', 'O processo já está nessa fase');
            if (novaFase && data.fase_suspensa === true)
                throw new https_1.HttpsError('failed-precondition', 'A fase está interrompida por pendência aberta. O decisor precisa apreciá-la antes.');
            const foraDoFluxo = !!novaFase && !(0, secretaria_1.fasesSeguintes)(fases, data.fase_atual).some((f) => f.id === novaFase.id);
            if (foraDoFluxo && !motivo)
                throw new https_1.HttpsError('invalid-argument', `${novaFase.nome} não é a próxima fase prevista no rito. Informe o motivo.`);
            const orientacao = (0, secretaria_1.texto)(p.orientacao, secretaria_1.MAX_TEXTO_LONGO);
            const faseDe = ((_a = fases.find((f) => f.id === data.fase_atual)) === null || _a === void 0 ? void 0 : _a.nome) || data.fase_atual;
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, conclusao ? 'conclusao' : 'tramitacao', `${conclusao ? 'Conclusos a' : 'Remetido de ' + (0, context_1.nomeUnidade)(c, data.unidade_atual) + ' para'} ${destino.nome}.`
                + `${novaFase ? ` Fase alterada de ${faseDe} para ${novaFase.nome}${foraDoFluxo ? ' (fora do fluxo do rito)' : ''}.` : ''}`
                + `${motivo ? ` Motivo: ${motivo}` : ''}${orientacao ? ` Orientação: ${orientacao}` : ''}`, Object.assign({ de: data.unidade_atual, para: destino.id }, (novaFase ? Object.assign({ fase_de: data.fase_atual, fase_para: novaFase.id }, (foraDoFluxo ? { fora_do_fluxo: true } : {})) : {})));
            tx.update(ref, Object.assign(Object.assign(Object.assign(Object.assign({}, mov), { unidade_atual: destino.id, unidades_historico: firestore_1.FieldValue.arrayUnion(destino.id), responsavel_uid: null, recebido_em: new Date().toISOString() }), (novaFase ? { fase_atual: novaFase.id } : {})), { orientacao: orientacao
                    ? { texto: orientacao, por: c.userName, em: new Date().toISOString(), de: (0, context_1.nomeUnidade)(c, data.unidade_atual) }
                    : firestore_1.FieldValue.delete() }));
            recebeu = { unidadeId: destino.id, proc: data };
            return mov;
        }
        if (p.action === 'concluirOrientacao') {
            if (!data.orientacao)
                throw new https_1.HttpsError('failed-precondition', 'Não há orientação pendente');
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'orientacao_concluida', `Orientação de ${data.orientacao.de || 'outra unidade'} concluída: ${data.orientacao.texto}${motivo ? ` ${motivo}` : ''}`);
            tx.update(ref, Object.assign(Object.assign({}, mov), { orientacao: firestore_1.FieldValue.delete() }));
            return mov;
        }
        if (p.action === 'marcarAcao') {
            // Caixa de marcar das ações da fase: movimento interno leve, sem documento.
            const fase = (data.fases || []).find((f) => f.id === data.fase_atual);
            const idx = Number(p.acao_idx);
            const acao = (_b = fase === null || fase === void 0 ? void 0 : fase.acoes) === null || _b === void 0 ? void 0 : _b[idx];
            if (!fase || !acao)
                throw new https_1.HttpsError('invalid-argument', 'Ação da fase inválida');
            const feitas = Object.assign({}, (data.acoes_feitas || {}));
            const lista = new Set(feitas[fase.id] || []);
            if (p.feita === false)
                lista.delete(idx);
            else
                lista.add(idx);
            feitas[fase.id] = [...lista].sort((a, b) => a - b);
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'acao_fase', `${p.feita === false ? 'Desmarcada' : 'Feita'} a ação "${acao}" da fase ${fase.nome}.`, { fase_id: fase.id, acao_idx: idx, feita: p.feita !== false });
            tx.update(ref, Object.assign(Object.assign({}, mov), { acoes_feitas: feitas }));
            return mov;
        }
        if (p.action === 'atribuir') {
            const alvo = p.responsavel_uid || null;
            const unidade = c.unidades.find((u) => u.id === data.unidade_atual);
            if (alvo && !((unidade === null || unidade === void 0 ? void 0 : unidade.membros_uids) || []).includes(alvo)) {
                throw new https_1.HttpsError('invalid-argument', 'A pessoa precisa estar lotada na unidade que tem o processo');
            }
            const nomeAlvo = alvo ? ((_d = (await tx.get(db.collection('userOrganizations').doc(`${alvo}_${orgId}`))).data()) === null || _d === void 0 ? void 0 : _d.user_name) || 'membro' : '';
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'atribuicao', alvo ? `Atribuído a ${nomeAlvo}.` : 'Atribuição removida.', { responsavel_uid: alvo });
            tx.update(ref, Object.assign(Object.assign({}, mov), { responsavel_uid: alvo }));
            return mov;
        }
        if (p.action === 'avancarFase') {
            const fases = (data.fases || []);
            const alvo = p.fase_id
                ? fases.find((f) => f.id === p.fase_id)
                : (0, secretaria_1.proximaFase)({ nome: '', descricao: '', fases }, data.fase_atual);
            if (!alvo)
                throw new https_1.HttpsError('invalid-argument', 'Não há fase seguinte; escolha uma fase do rito');
            if (alvo.id === data.fase_atual)
                throw new https_1.HttpsError('invalid-argument', 'O processo já está nessa fase');
            if (data.fase_suspensa === true) {
                throw new https_1.HttpsError('failed-precondition', 'A fase está interrompida por pendência aberta. O decisor precisa apreciá-la antes.');
            }
            // Sair do fluxo desenhado no rito é permitido, mas exige justificativa.
            const foraDoFluxo = !(0, secretaria_1.fasesSeguintes)(fases, data.fase_atual).some((f) => f.id === alvo.id);
            if (foraDoFluxo && !motivo)
                throw new https_1.HttpsError('invalid-argument', `${alvo.nome} não é a próxima fase prevista no rito. Informe o motivo.`);
            const de = ((_e = fases.find((f) => f.id === data.fase_atual)) === null || _e === void 0 ? void 0 : _e.nome) || data.fase_atual;
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'fase', `Fase alterada de ${de} para ${alvo.nome}${foraDoFluxo ? ' (fora do fluxo do rito)' : ''}.${motivo ? ` ${motivo}` : ''}`, Object.assign({ de: data.fase_atual, para: alvo.id }, (foraDoFluxo ? { fora_do_fluxo: true } : {})));
            tx.update(ref, Object.assign(Object.assign({}, mov), { fase_atual: alvo.id }));
            return mov;
        }
        if (p.action === 'alterarStatus') {
            const status = String(p.status || '');
            if (!['em_tramitacao', 'sobrestado', 'arquivado'].includes(status)) {
                throw new https_1.HttpsError('invalid-argument', 'Situação inválida');
            }
            if (status === data.status)
                throw new https_1.HttpsError('invalid-argument', 'O processo já está nessa situação');
            if (!motivo)
                throw new https_1.HttpsError('invalid-argument', 'Informe o motivo');
            const rotulo = { em_tramitacao: 'Reativado', sobrestado: 'Sobrestado', arquivado: 'Arquivado' }[status];
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'situacao', `${rotulo}. Motivo: ${motivo}`, { de: data.status, para: status });
            tx.update(ref, Object.assign(Object.assign({}, mov), { status }));
            return mov;
        }
        // ---- Pendências: o que o decisor precisa apreciar --------------------
        const pendencias = (data.pendencias || []);
        const prazos = (data.prazos || []);
        const agora = new Date().toISOString();
        if (p.action === 'abrirPendencia') {
            const descricao = (0, secretaria_1.texto)(p.descricao, secretaria_1.MAX_TEXTO_LONGO);
            if (!descricao)
                throw new https_1.HttpsError('invalid-argument', 'Descreva o que precisa ser apreciado');
            if (pendencias.length >= secretaria_1.MAX_ITENS)
                throw new https_1.HttpsError('resource-exhausted', 'Limite de pendências do processo');
            const nova = {
                id: ref.collection('_').doc().id, tipo: 'manual', descricao, interrompe: p.interrompe === true,
                status: 'aberta', aberta_em: agora, aberta_por: c.userName,
            };
            const lista = [...pendencias, nova];
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'pendencia', `Pendência aberta para o decisor: ${descricao}${nova.interrompe ? ' (fase interrompida)' : ''}.`, { pendencia_id: nova.id, interrompe: nova.interrompe });
            tx.update(ref, Object.assign(Object.assign(Object.assign({}, mov), { pendencias: lista }), (0, secretaria_1.derivados)(lista, prazos)));
            pendenciaAberta = { proc: data, descricao };
            return mov;
        }
        if (p.action === 'resolverPendencia') {
            // Apreciar é ato de decisão: só o gabinete que tem o processo.
            if (((_f = c.unidades.find((u) => u.id === data.unidade_atual)) === null || _f === void 0 ? void 0 : _f.tipo) !== 'gabinete') {
                throw new https_1.HttpsError('permission-denied', 'Pendências são apreciadas pelo gabinete. Faça a conclusão do processo antes.');
            }
            const alvo = pendencias.find((x) => x.id === p.pendencia_id && x.status === 'aberta');
            if (!alvo)
                throw new https_1.HttpsError('not-found', 'Pendência aberta não encontrada');
            const resolucao = (0, secretaria_1.texto)(p.resolucao, secretaria_1.MAX_TEXTO_LONGO);
            if (!resolucao)
                throw new https_1.HttpsError('invalid-argument', 'Registre a decisão sobre a pendência');
            const lista = pendencias.map((x) => (x.id === alvo.id
                ? Object.assign(Object.assign({}, x), { status: 'resolvida', resolvida_em: agora, resolvida_por: c.userName, resolucao }) : x));
            const der = (0, secretaria_1.derivados)(lista, prazos);
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'pendencia_resolvida', `Pendência apreciada (${alvo.descricao}): ${resolucao}${alvo.interrompe && !der.fase_suspensa ? ' Fase retomada.' : ''}`, { pendencia_id: alvo.id });
            tx.update(ref, Object.assign(Object.assign(Object.assign({}, mov), { pendencias: lista }), der));
            return mov;
        }
        // ---- Prazos -----------------------------------------------------------
        if (p.action === 'abrirPrazo') {
            const descricao = (0, secretaria_1.texto)(p.descricao, secretaria_1.MAX_TEXTO_LONGO);
            const dias = Number(p.dias);
            const contagem = p.contagem === 'corridos' ? 'corridos' : 'uteis';
            if (!descricao)
                throw new https_1.HttpsError('invalid-argument', 'Descreva o prazo');
            if (!Number.isInteger(dias) || dias < 1 || dias > secretaria_1.MAX_PRAZO_DIAS)
                throw new https_1.HttpsError('invalid-argument', 'Informe os dias do prazo');
            if (prazos.length >= secretaria_1.MAX_ITENS)
                throw new https_1.HttpsError('resource-exhausted', 'Limite de prazos do processo');
            const inicio = (0, secretaria_1.hojeBrasil)();
            const novo = {
                id: ref.collection('_').doc().id, descricao, destinatario: (0, secretaria_1.texto)(p.destinatario), dias, contagem,
                inicio, vence_em: (0, secretaria_1.calcularVencimento)(inicio, dias, contagem, calendario), status: 'aberto',
                aberto_em: agora, aberto_por: c.userName,
            };
            const lista = [...prazos, novo];
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'prazo', `Prazo de ${dias} dias ${contagem === 'uteis' ? 'úteis' : 'corridos'} aberto: ${descricao}${novo.destinatario ? ` (${novo.destinatario})` : ''}. Vence em ${novo.vence_em.split('-').reverse().join('/')}.`, { prazo_id: novo.id, vence_em: novo.vence_em });
            tx.update(ref, Object.assign(Object.assign(Object.assign({}, mov), { prazos: lista }), (0, secretaria_1.derivados)(pendencias, lista)));
            return mov;
        }
        if (p.action === 'encerrarPrazo') {
            const alvo = prazos.find((x) => x.id === p.prazo_id && x.status === 'aberto');
            if (!alvo)
                throw new https_1.HttpsError('not-found', 'Prazo aberto não encontrado');
            const res = p.resultado === 'cancelado' ? 'cancelado' : 'cumprido';
            const hoje = (0, secretaria_1.hojeBrasil)();
            const lista = prazos.map((x) => (x.id === alvo.id ? Object.assign(Object.assign({}, x), { status: res, encerrado_em: hoje, encerrado_por: c.userName }) : x));
            const quando = res === 'cumprido' ? (hoje <= alvo.vence_em ? ' no prazo' : ' fora do prazo') : '';
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'prazo_encerrado', `Prazo ${res}${quando}: ${alvo.descricao}.${motivo ? ` ${motivo}` : ''}`, { prazo_id: alvo.id, resultado: res });
            tx.update(ref, Object.assign(Object.assign(Object.assign({}, mov), { prazos: lista }), (0, secretaria_1.derivados)(pendencias, lista)));
            return mov;
        }
        if (p.action === 'convidarParte' || p.action === 'revogarParte') {
            const idx = Number(p.parte_idx);
            const partes = [...(data.partes || [])];
            const parte = partes[idx];
            if (!Number.isInteger(idx) || !parte)
                throw new https_1.HttpsError('invalid-argument', 'Parte inválida');
            const reps = [...(parte.representantes || [])];
            let ridx = p.representante_idx === undefined || p.representante_idx === null ? -1 : Number(p.representante_idx);
            const novoRep = p.action === 'convidarParte' && p.representante && typeof p.representante === 'object' ? p.representante : null;
            if (novoRep) {
                const nome = (0, secretaria_1.texto)(novoRep.nome, 120);
                if (!nome)
                    throw new https_1.HttpsError('invalid-argument', 'Informe o nome do representante');
                if (reps.length >= MAX_REPRESENTANTES)
                    throw new https_1.HttpsError('invalid-argument', `Até ${MAX_REPRESENTANTES} representantes por parte`);
                const emailRep = (0, secretaria_1.texto)(novoRep.email, 120);
                reps.push(Object.assign({ nome }, (emailRep ? { email: emailRep } : {})));
                ridx = reps.length - 1;
            }
            const alvo = ridx >= 0 ? reps[ridx] : parte;
            if (!alvo)
                throw new https_1.HttpsError('invalid-argument', 'Representante inválido');
            const rotulo = ridx >= 0 ? `${alvo.nome}, representante de ${parte.nome} (${parte.polo})` : `${parte.nome} (${parte.polo})`;
            const dadosMov = Object.assign({ parte_idx: idx }, (ridx >= 0 ? { representante: alvo.nome } : {}));
            // Convite anterior ainda não usado deixa de valer em qualquer dos dois casos.
            if (alvo.convite_hash)
                tx.set(db.collection(context_1.COL.convites).doc(alvo.convite_hash), { revogado: true }, { merge: true });
            if (p.action === 'revogarParte') {
                const antigo = alvo.uid;
                if (ridx >= 0) {
                    reps.splice(ridx, 1);
                    partes[idx] = Object.assign(Object.assign({}, parte), { representantes: reps });
                }
                else {
                    const { uid: _u, convite_hash: _c } = parte, resto = __rest(parte, ["uid", "convite_hash"]);
                    partes[idx] = resto;
                }
                const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'acesso_revogado', antigo || alvo.convite_hash ? `Acesso de ${rotulo} ao portal das partes revogado.` : `${rotulo} retirado do processo.`, dadosMov);
                tx.update(ref, Object.assign(Object.assign(Object.assign({}, mov), { partes }), (antigo ? { partes_uids: firestore_1.FieldValue.arrayRemove(antigo) } : {})));
                return mov;
            }
            if (alvo.uid)
                throw new https_1.HttpsError('failed-precondition', `${ridx >= 0 ? 'Este representante' : 'Esta parte'} já acompanha o processo. Revogue o acesso antes de convidar de novo.`);
            const email = (0, secretaria_1.texto)(p.email, 120) || alvo.email || '';
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
                throw new https_1.HttpsError('invalid-argument', 'E-mail inválido');
            convite.token = (0, crypto_1.randomBytes)(24).toString('base64url');
            convite.email = email;
            convite.parte = alvo.nome;
            convite.representaQuem = ridx >= 0 ? parte.nome : '';
            convite.numero = data.numero;
            const hash = (0, secretaria_1.sha256)(convite.token);
            tx.set(db.collection(context_1.COL.convites).doc(hash), {
                organization_id: orgId, processo_id: ref.id, parte_idx: idx, parte_nome: parte.nome, email,
                representante_idx: ridx >= 0 ? ridx : null, representante_nome: ridx >= 0 ? alvo.nome : null,
                criado_por: c.ctx.uid, criado_em: new Date().toISOString(),
                expira_em: new Date(Date.now() + CONVITE_DIAS * 86400000).toISOString(), usado_por: null, revogado: false,
            });
            const atualizado = Object.assign(Object.assign(Object.assign({}, alvo), { convite_hash: hash }), (email ? { email } : {}));
            if (ridx >= 0) {
                reps[ridx] = atualizado;
                partes[idx] = Object.assign(Object.assign({}, parte), { representantes: reps });
            }
            else
                partes[idx] = atualizado;
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'convite', `${rotulo} convidado a acompanhar o processo pelo portal das partes${email ? ' (convite por e-mail)' : ''}.`, dadosMov);
            tx.update(ref, Object.assign(Object.assign({}, mov), { partes }));
            return mov;
        }
        throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
    });
    // Partes habilitadas recebem e-mail dos movimentos públicos (fora da transação, sem travar o ato).
    void (0, portalAvisos_1.avisarPartesDoMovimento)(db, String(p.id));
    const r = recebeu;
    if (r)
        void (0, avisosEquipe_1.avisarUnidadeRecebeu)(c, r.unidadeId, r.proc, String(p.id), motivo || (0, secretaria_1.texto)(p.orientacao, secretaria_1.MAX_TEXTO_LONGO));
    const pa = pendenciaAberta;
    if (pa)
        void (0, avisosEquipe_1.avisarPendencia)(c, pa.proc, String(p.id), pa.descricao);
    if (convite.token) {
        const link = `${APP_URL}/Portal?convite=${convite.token}`;
        const enviado = convite.email ? await (0, email_1.sendEmail)({
            to: convite.email,
            subject: `Convite para acompanhar o processo ${convite.numero}`,
            html: `<p>Olá, ${escapar(convite.parte)}.</p><p>Você foi habilitado a acompanhar o processo <b>${escapar(convite.numero)}</b>${convite.representaQuem ? ` como representante de <b>${escapar(convite.representaQuem)}</b>` : ''} e a peticionar nele pelo portal das partes.</p><p><a href="${link}">Aceitar o convite</a> (vale por ${CONVITE_DIAS} dias).</p><p>Entre com sua conta Google ou crie uma senha. Se você não esperava este e-mail, ignore-o.</p>`,
        }).catch(() => false) : false;
        return { success: true, version: resultado.version, link, emailEnviado: enviado };
    }
    return { success: true, version: resultado.version };
});
//# sourceMappingURL=processos.js.map