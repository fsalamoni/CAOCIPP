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
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const context_1 = require("./context");
const POLOS = ['requerente', 'requerido', 'interessado', 'terceiro'];
const MAX_PARTES = 50;
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
        ultimo_movimento: d.ultimo_movimento || null,
        version: d.version,
    };
}
exports.secretariaProcesso = (0, https_1.onCall)({ region: context_1.REGION }, async (request) => {
    const auth = (0, context_1.exigirAuth)(request);
    const p = request.data || {};
    const c = await (0, context_1.carregarContexto)(auth, p.organizationId);
    const { db, orgId } = c;
    if (p.action === 'listar') {
        // ponytail: lê até 1000 processos do órgão e filtra/ordena em memória
        // (sem índice composto). Paginar por updated_at quando passar disso.
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
            ref.collection('documentos').get(),
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
            assinaturas: d.assinaturas || [],
        }))
            .sort((a, b) => (a.ordem || 1e9) - (b.ordem || 1e9) || String(a.criado_em).localeCompare(String(b.criado_em)));
        return {
            processo: Object.assign(Object.assign({}, resumo(ref.id, data)), { descricao: data.descricao, partes: data.partes || [], fases: data.fases || [], unidades_historico: data.unidades_historico || [], autuado_em: data.autuado_em, autuado_por: data.autuado_por_nome }),
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
        const ritoSnap = await db.collection(context_1.COL.ritos).doc(String(p.rito_id || '_')).get();
        const rito = ritoSnap.data();
        if (!ritoSnap.exists || !rito || rito.organization_id !== orgId || rito.ativo === false) {
            throw new https_1.HttpsError('invalid-argument', 'Escolha um rito ativo');
        }
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
            const base = {
                organization_id: orgId,
                numero,
                assunto,
                descricao: (0, secretaria_1.texto)(p.descricao, secretaria_1.MAX_TEXTO_LONGO),
                partes: sanitizePartes(p.partes),
                sigilo: p.sigilo === 'restrito' ? 'restrito' : 'normal',
                status: 'em_tramitacao',
                rito_id: ritoSnap.id,
                rito_nome: rito.nome,
                rito_versao: rito.versao || 1,
                fases,
                fase_atual: fases[0].id,
                unidade_atual: unidadeId,
                unidades_historico: [unidadeId],
                responsavel_uid: null,
                autuado_por: auth.uid,
                autuado_por_nome: c.userName,
                autuado_em: new Date().toISOString(),
                created_at: firestore_1.FieldValue.serverTimestamp(),
                mov_seq: 0,
                doc_seq: 0,
                ultimo_hash: '',
                version: 0,
            };
            const mov = (0, context_1.registrarMovimento)(tx, c, procRef, base, 'autuacao', `Processo autuado na unidade ${unidade.nome}, rito ${rito.nome} (versão ${base.rito_versao}), fase ${fases[0].nome}.`, { assunto, rito_id: ritoSnap.id, rito_versao: base.rito_versao, unidade: unidadeId });
            tx.set(procRef, Object.assign(Object.assign({}, base), mov));
            return numero;
        });
        return { success: true, id: procRef.id, numero };
    }
    // ---- Movimentações sobre um processo existente --------------------------
    const motivo = (0, secretaria_1.texto)(p.motivo, secretaria_1.MAX_TEXTO_LONGO);
    const resultado = await db.runTransaction(async (tx) => {
        var _a, _b;
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
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'tramitacao', `Remetido de ${(0, context_1.nomeUnidade)(c, data.unidade_atual)} para ${destino.nome}.${motivo ? ` Motivo: ${motivo}` : ''}`, { de: data.unidade_atual, para: destino.id });
            tx.update(ref, Object.assign(Object.assign({}, mov), { unidade_atual: destino.id, unidades_historico: firestore_1.FieldValue.arrayUnion(destino.id), responsavel_uid: null }));
            return mov;
        }
        if (p.action === 'atribuir') {
            const alvo = p.responsavel_uid || null;
            const unidade = c.unidades.find((u) => u.id === data.unidade_atual);
            if (alvo && !((unidade === null || unidade === void 0 ? void 0 : unidade.membros_uids) || []).includes(alvo)) {
                throw new https_1.HttpsError('invalid-argument', 'A pessoa precisa estar lotada na unidade que tem o processo');
            }
            const nomeAlvo = alvo ? ((_a = (await tx.get(db.collection('userOrganizations').doc(`${alvo}_${orgId}`))).data()) === null || _a === void 0 ? void 0 : _a.user_name) || 'membro' : '';
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
            const de = ((_b = fases.find((f) => f.id === data.fase_atual)) === null || _b === void 0 ? void 0 : _b.nome) || data.fase_atual;
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, data, 'fase', `Fase alterada de ${de} para ${alvo.nome}.${motivo ? ` ${motivo}` : ''}`, { de: data.fase_atual, para: alvo.id });
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
        throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
    });
    return { success: true, version: resultado.version };
});
//# sourceMappingURL=processos.js.map