"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaPortal = exports.COL_ACESSOS = exports.AVISOS_PARTE = exports.TIPOS_PETICAO_PORTAL = exports.MOVIMENTOS_INTERNOS = void 0;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const context_1 = require("./context");
const documentos_1 = require("./documentos");
const autos_1 = require("./autos");
const pdfDocumento_1 = require("./pdfDocumento");
const exportar_1 = require("./exportar");
const autos_2 = require("../shared/autos");
const portalAvisos_1 = require("./portalAvisos");
const avisosEquipe_1 = require("./avisosEquipe");
/**
 * Portal das partes. A parte é um usuário autenticado (Google ou e-mail e
 * senha) que NUNCA vira membro do órgão: não ganha vínculo em
 * userOrganizations e só alcança os processos em que foi habilitada por
 * convite (processo.partes_uids). Tudo passa por aqui; nada de leitura direta.
 *
 * O que a parte vê: dados do processo, movimentos públicos (sem atribuições
 * internas e sem pendências abertas à mão) e documentos juntados marcados como
 * visíveis às partes. O que a parte faz: peticiona a qualquer tempo. A petição
 * é juntada na hora (protocolo eletrônico) e abre pendência para o decisor.
 */
exports.MOVIMENTOS_INTERNOS = ['atribuicao', 'pendencia', 'acao_fase', 'orientacao_concluida'];
const TIPOS_PETICAO = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
/** Tipos de petição oferecidos no portal; o texto vai no título e no movimento. */
exports.TIPOS_PETICAO_PORTAL = ['Manifestação', 'Juntada de documento', 'Pedido de prazo', 'Pedido de vista', 'Recurso', 'Outro'];
exports.AVISOS_PARTE = ['tudo', 'prazos', 'nenhum'];
/** Dados do portal por conta de parte: último acesso a cada processo e preferência de aviso. */
exports.COL_ACESSOS = 'secPortalAcessos';
const brData = (iso) => iso.split('-').reverse().join('/');
const brDataHora = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
/** Prazos abertos dirigidos a esta parte (ou sem destinatário). */
function prazosDaParte(proc, parte) {
    const nome = ((parte === null || parte === void 0 ? void 0 : parte.nome) || '').toLowerCase();
    return (proc.prazos || []).filter((x) => x.status === 'aberto'
        && (!x.destinatario || String(x.destinatario).toLowerCase().includes(nome)));
}
/** Fases vistas pela parte: só o que não é interno da equipe. */
function fasesPublicas(proc) {
    return (proc.fases || []).map(({ id, nome, prazo_dias, proximas, final }) => (Object.assign(Object.assign(Object.assign({ id, nome }, (prazo_dias ? { prazo_dias } : {})), (proximas ? { proximas } : {})), (final ? { final } : {}))));
}
/** Petições desta conta com a situação da apreciação. */
function peticoesDaParte(proc, docs, uid) {
    const pend = (proc.pendencias || []);
    return docs.filter((d) => d.peticao && d.autor_uid === uid).map((d) => {
        const x = pend.find((q) => q.documento_id === d.id);
        return {
            id: d.id, ordem: d.ordem, titulo: d.titulo, em: d.juntado_em, tipo_peticao: d.peticao_tipo || null, protocolo: `${proc.numero}-${d.ordem}`,
            situacao: !x ? 'juntada' : x.status === 'aberta' ? 'aguardando' : 'apreciada',
            apreciada_em: (x === null || x === void 0 ? void 0 : x.status) === 'resolvida' ? x.resolvida_em || null : null,
            resolucao: (x === null || x === void 0 ? void 0 : x.status) === 'resolvida' ? x.resolucao || null : null,
        };
    });
}
/** Processo em que o usuário é parte habilitada, com o órgão ainda com a Secretaria ativa. */
async function lerComoParte(db, uid, id, tx) {
    var _a, _b;
    if (typeof id !== 'string' || !id)
        throw new https_1.HttpsError('invalid-argument', 'processoId é obrigatório');
    const ref = db.collection(context_1.COL.processos).doc(id);
    const snap = tx ? await tx.get(ref) : await ref.get();
    const data = snap.data();
    if (!data || !(data.partes_uids || []).includes(uid))
        throw new https_1.HttpsError('not-found', 'Processo não encontrado');
    const org = (await db.collection('organizations').doc(data.organization_id).get()).data() || {};
    if (((_a = org.secretariaConfig) === null || _a === void 0 ? void 0 : _a.enabled) !== true || ((_b = org.secretariaConfig) === null || _b === void 0 ? void 0 : _b.suspensa_plataforma) === true) {
        throw new https_1.HttpsError('failed-precondition', 'A Secretaria deste órgão está desativada');
    }
    return { ref, data, org };
}
function parteDoUsuario(proc, uid) {
    const partes = (proc.partes || []);
    const propria = partes.find((p) => p.uid === uid);
    if (propria)
        return { nome: propria.nome, polo: propria.polo, como: 'parte', assina: propria.nome, rotulo: `${propria.nome} (${propria.polo})` };
    for (const p of partes) {
        const r = (p.representantes || []).find((x) => x.uid === uid);
        if (r)
            return { nome: p.nome, polo: p.polo, como: 'representante', representante: r.nome, assina: `${r.nome}, representante de ${p.nome}`, rotulo: `${r.nome}, representante de ${p.nome} (${p.polo})` };
    }
    return undefined;
}
exports.secretariaPortal = (0, https_1.onCall)({ region: context_1.REGION, memory: '512MiB' }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const auth = (0, context_1.exigirAuth)(request);
    const p = request.data || {};
    const db = admin.firestore();
    const uid = auth.uid;
    const nomeConta = String(auth.token.name || auth.token.email || 'Parte');
    if (p.action === 'aceitarConvite') {
        const token = String(p.convite || '');
        if (token.length < 20)
            throw new https_1.HttpsError('invalid-argument', 'Convite inválido');
        const conviteRef = db.collection(context_1.COL.convites).doc((0, secretaria_1.sha256)(token));
        return db.runTransaction(async (tx) => {
            const cSnap = await tx.get(conviteRef);
            const conv = cSnap.data();
            if (!conv)
                throw new https_1.HttpsError('not-found', 'Convite inválido');
            if (conv.usado_por && conv.usado_por !== uid)
                throw new https_1.HttpsError('failed-precondition', 'Este convite já foi usado por outra conta');
            if (conv.revogado)
                throw new https_1.HttpsError('failed-precondition', 'Este convite foi revogado');
            if (!conv.usado_por && new Date(conv.expira_em) < new Date())
                throw new https_1.HttpsError('deadline-exceeded', 'Convite vencido. Peça um novo à secretaria.');
            const ref = db.collection(context_1.COL.processos).doc(conv.processo_id);
            const proc = (await tx.get(ref)).data();
            if (!proc)
                throw new https_1.HttpsError('not-found', 'Processo não encontrado');
            if (conv.usado_por === uid)
                return { success: true, processoId: ref.id, organizationId: proc.organization_id };
            const partes = [...(proc.partes || [])];
            const parte = partes[conv.parte_idx];
            if (!parte || parte.nome !== conv.parte_nome)
                throw new https_1.HttpsError('failed-precondition', 'A parte do convite não existe mais no processo');
            const ridx = typeof conv.representante_idx === 'number' ? conv.representante_idx : -1;
            let rotulo = `${parte.nome} (${parte.polo})`;
            let assina = parte.nome;
            if (ridx >= 0) {
                // Convite a um representante: a conta fica no representante, não na parte.
                const reps = [...(parte.representantes || [])];
                const rep = reps[ridx];
                if (!rep || rep.nome !== conv.representante_nome)
                    throw new https_1.HttpsError('failed-precondition', 'O representante do convite não consta mais no processo');
                if (rep.uid && rep.uid !== uid)
                    throw new https_1.HttpsError('failed-precondition', 'Este representante já está vinculado a outra conta');
                reps[ridx] = Object.assign(Object.assign({}, rep), { uid, habilitada_em: new Date().toISOString(), conta: nomeConta });
                partes[conv.parte_idx] = Object.assign(Object.assign({}, parte), { representantes: reps });
                rotulo = `${rep.nome}, representante de ${parte.nome} (${parte.polo}),`;
                assina = `${rep.nome}, representante de ${parte.nome}`;
            }
            else {
                if (parte.uid && parte.uid !== uid)
                    throw new https_1.HttpsError('failed-precondition', 'Esta parte já está vinculada a outra conta');
                partes[conv.parte_idx] = Object.assign(Object.assign({}, parte), { uid, habilitada_em: new Date().toISOString(), conta: nomeConta });
            }
            const c = contextoParte(db, proc, uid, `${assina} (parte)`);
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, proc, 'habilitacao', `${rotulo} passou a acompanhar o processo pelo portal das partes.`, Object.assign({ parte_idx: conv.parte_idx }, (ridx >= 0 ? { representante: conv.representante_nome } : {})));
            tx.update(ref, Object.assign(Object.assign({}, mov), { partes, partes_uids: firestore_1.FieldValue.arrayUnion(uid) }));
            tx.update(conviteRef, { usado_por: uid, usado_em: new Date().toISOString() });
            // Marca no perfil para o menu do SIGO oferecer "Processos em que sou parte" a quem também é membro de órgão.
            tx.set(db.collection('users').doc(uid), { portal_partes: true }, { merge: true });
            return { success: true, processoId: ref.id, organizationId: proc.organization_id };
        });
    }
    if (p.action === 'preferencias') {
        const avisos = exports.AVISOS_PARTE.includes(p.avisos) ? p.avisos : 'tudo';
        await db.collection(exports.COL_ACESSOS).doc(uid).set({ avisos, email: auth.token.email || null, updated_at: new Date().toISOString() }, { merge: true });
        return { success: true, avisos };
    }
    if (p.action === 'meusProcessos') {
        const [snap, acessosSnap] = await Promise.all([
            db.collection(context_1.COL.processos).where('partes_uids', 'array-contains', uid).limit(200).get(),
            db.collection(exports.COL_ACESSOS).doc(uid).get(),
        ]);
        const acessos = (((_a = acessosSnap.data()) === null || _a === void 0 ? void 0 : _a.processos) || {});
        const orgIds = [...new Set(snap.docs.map((d) => d.data().organization_id))];
        const orgs = orgIds.length ? await db.getAll(...orgIds.map((id) => db.collection('organizations').doc(id))) : [];
        const ativo = new Map(orgs.map((o) => { var _a, _b, _c; return [o.id, { on: ((_b = (_a = o.data()) === null || _a === void 0 ? void 0 : _a.secretariaConfig) === null || _b === void 0 ? void 0 : _b.enabled) === true, nome: ((_c = o.data()) === null || _c === void 0 ? void 0 : _c.name) || '' }]; }));
        const visiveis = snap.docs.filter((d) => { var _a; return (_a = ativo.get(d.data().organization_id)) === null || _a === void 0 ? void 0 : _a.on; });
        const hoje = (0, secretaria_1.hojeBrasil)();
        // "Para você": o que pede atenção da parte, em todos os processos.
        const paraVoce = [];
        const processos = visiveis.map((d) => {
            var _a, _b, _c;
            const x = d.data();
            const parte = parteDoUsuario(x, uid);
            const visto = acessos[d.id] || '';
            const novidades = ((_a = x.ultimo_movimento) === null || _a === void 0 ? void 0 : _a.em) && x.ultimo_movimento.em > visto;
            for (const pr of prazosDaParte(x, parte)) {
                paraVoce.push({ tipo: 'prazo', processoId: d.id, numero: x.numero, assunto: x.assunto, descricao: pr.descricao, vence_em: pr.vence_em, vencido: pr.vence_em < hoje, prazo_id: pr.id });
            }
            for (const pe of (x.pendencias || []).filter((q) => q.tipo === 'peticao' && q.status === 'aberta' && String(q.aberta_por || '').startsWith(`${parte === null || parte === void 0 ? void 0 : parte.nome} (`))) {
                paraVoce.push({ tipo: 'peticao', processoId: d.id, numero: x.numero, assunto: x.assunto, descricao: pe.descricao, desde: pe.aberta_em });
            }
            if (novidades)
                paraVoce.push({ tipo: 'novidade', processoId: d.id, numero: x.numero, assunto: x.assunto, descricao: x.ultimo_movimento.descricao, em: x.ultimo_movimento.em });
            return {
                id: d.id, numero: x.numero, assunto: x.assunto, status: x.status, orgao: (_b = ativo.get(x.organization_id)) === null || _b === void 0 ? void 0 : _b.nome,
                fase_nome: ((_c = (x.fases || []).find((f) => f.id === x.fase_atual)) === null || _c === void 0 ? void 0 : _c.nome) || x.fase_atual,
                polo: parte === null || parte === void 0 ? void 0 : parte.polo, parte_nome: (parte === null || parte === void 0 ? void 0 : parte.nome) || null, como: (parte === null || parte === void 0 ? void 0 : parte.como) || 'parte', representante: (parte === null || parte === void 0 ? void 0 : parte.representante) || null,
                ultimo_movimento: x.ultimo_movimento || null, novidades: !!novidades, visto_em: visto || null,
            };
        });
        const ordem = { prazo: 0, peticao: 1, novidade: 2 };
        paraVoce.sort((a, b) => (ordem[a.tipo] - ordem[b.tipo]) || String(a.vence_em || a.em || '').localeCompare(String(b.vence_em || b.em || '')));
        return { processos, para_voce: paraVoce, avisos: ((_b = acessosSnap.data()) === null || _b === void 0 ? void 0 : _b.avisos) || 'tudo' };
    }
    if (p.action === 'obter') {
        const { ref, data, org } = await lerComoParte(db, uid, p.processoId);
        const [movs, docs] = await Promise.all([
            ref.collection('movimentos').orderBy('seq').get(),
            ref.collection('documentos').where('status', '==', 'juntado')
                .select('ordem', 'titulo', 'tipo', 'juntado_em', 'origem', 'sha256', 'visivel_partes', 'folha_inicial', 'folha_final', 'codigo_verificacao', 'peticao', 'peticao_tipo', 'autor_uid').get(),
        ]);
        const todos = movs.docs.map((d) => d.data());
        const parte = parteDoUsuario(data, uid);
        const acessoRef = db.collection(exports.COL_ACESSOS).doc(uid);
        const vistoEm = (((_c = (await acessoRef.get()).data()) === null || _c === void 0 ? void 0 : _c.processos) || {})[ref.id] || null;
        // Marca o acesso para o "Para você" saber o que é novidade.
        await acessoRef.set({ processos: { [ref.id]: new Date().toISOString() }, email: auth.token.email || null }, { merge: true });
        const documentos = docs.docs.map((d) => (Object.assign({ id: d.id }, d.data())))
            .filter((d) => d.visivel_partes !== false)
            .sort((a, b) => a.ordem - b.ordem);
        return {
            orgao: org.name || '',
            processo: {
                id: ref.id, numero: data.numero, assunto: data.assunto, status: data.status, descricao: data.descricao,
                // Só os campos que o órgão marcou para as partes verem.
                campos: (data.campos || [])
                    .filter((x) => x.visivel_partes === true).map((x) => ({ rotulo: x.rotulo, tipo: x.tipo, valor: x.valor })),
                fase_nome: ((_d = (data.fases || []).find((f) => f.id === data.fase_atual)) === null || _d === void 0 ? void 0 : _d.nome) || data.fase_atual,
                fase_atual: data.fase_atual,
                fases: fasesPublicas(data),
                partes: (data.partes || []).map((x) => ({ nome: x.nome, polo: x.polo })),
                prazos: (data.prazos || []).filter((x) => x.status === 'aberto')
                    .map((x) => ({ id: x.id, descricao: x.descricao, destinatario: x.destinatario || '', vence_em: x.vence_em, meu: prazosDaParte(data, parte).some((q) => q.id === x.id) })),
                minha_parte: parte,
                autuado_em: data.autuado_em || null,
            },
            movimentos: todos.filter((m) => { var _a; return !exports.MOVIMENTOS_INTERNOS.includes(m.tipo) && ((_a = m.dados) === null || _a === void 0 ? void 0 : _a.visivel_partes) !== false; })
                .map((m) => (Object.assign({ seq: m.seq, tipo: m.tipo, descricao: m.descricao, em: m.em, autor_nome: m.autor_nome, hash: m.hash, novo: !!vistoEm && m.em > vistoEm }, (0, autos_2.extrasDoEvento)(m, new Map(documentos.map((d) => [d.id, d])))))),
            documentos: documentos.map((d) => ({ id: d.id, ordem: d.ordem, titulo: d.titulo, tipo: d.tipo, juntado_em: d.juntado_em, origem: d.origem, sha256: d.sha256, folha_inicial: d.folha_inicial || null, folha_final: d.folha_final || null, codigo_verificacao: d.codigo_verificacao || null, novo: !!vistoEm && d.juntado_em > vistoEm })),
            minhas_peticoes: peticoesDaParte(data, documentos, uid),
            tipos_peticao: exports.TIPOS_PETICAO_PORTAL,
            visto_em: vistoEm,
            cadeiaIntegra: (0, secretaria_1.verificarCadeia)(todos) === null,
        };
    }
    if (p.action === 'exportar') {
        // Íntegra do que a parte pode ver: movimentos públicos e documentos visíveis.
        const { ref, data: proc, org } = await lerComoParte(db, uid, p.processoId);
        const [movs, docs] = await Promise.all([
            ref.collection('movimentos').orderBy('seq').get(),
            ref.collection('documentos').where('status', '==', 'juntado').get(),
        ]);
        const movimentos = movs.docs.map((d) => d.data()).filter((m) => { var _a; return !exports.MOVIMENTOS_INTERNOS.includes(m.tipo) && ((_a = m.dados) === null || _a === void 0 ? void 0 : _a.visivel_partes) !== false; });
        const documentos = docs.docs.map((d) => (Object.assign({ id: d.id }, d.data()))).filter((d) => d.visivel_partes !== false).sort((a, b) => a.ordem - b.ordem);
        const bytes = await (0, exportar_1.montarPdfAutos)({
            db, orgId: proc.organization_id, orgNome: String(org.name || ''), ref, proc, movimentos, docs: documentos,
            geradoPor: `${((_e = parteDoUsuario(proc, uid)) === null || _e === void 0 ? void 0 : _e.assina) || nomeConta} (parte)`, nomeUnidade: () => '', selecao: (0, exportar_1.selecaoOuErro)(p.selecao),
        });
        return { base64: Buffer.from(bytes).toString('base64'), nome: `processo-${String(proc.numero).replace('/', '-')}.pdf` };
    }
    if (p.action === 'certidao') {
        // Uma folha: situação atual e últimos movimentos públicos, com data e hora.
        const { ref, data: proc, org } = await lerComoParte(db, uid, p.processoId);
        const movs = (await ref.collection('movimentos').orderBy('seq', 'desc').limit(40).get()).docs.map((d) => d.data())
            .filter((m) => { var _a; return !exports.MOVIMENTOS_INTERNOS.includes(m.tipo) && ((_a = m.dados) === null || _a === void 0 ? void 0 : _a.visivel_partes) !== false; }).slice(0, 10);
        const fase = ((_f = (proc.fases || []).find((f) => f.id === proc.fase_atual)) === null || _f === void 0 ? void 0 : _f.nome) || proc.fase_atual;
        const situacao = { em_tramitacao: 'Em tramitação', sobrestado: 'Sobrestado', arquivado: 'Arquivado' }[proc.status] || proc.status;
        const parte = parteDoUsuario(proc, uid);
        const linhas = [
            `CERTIDÃO DE ANDAMENTO`, '',
            `${org.name || ''}`,
            `Processo nº ${proc.numero}`, `Assunto: ${proc.assunto}`, '',
            `Situação: ${situacao}. Fase atual: ${fase}.`,
            `Autuado em ${proc.autuado_em ? brDataHora(proc.autuado_em) : '—'}.`,
            `Partes: ${(proc.partes || []).map((x) => `${x.nome} (${x.polo})`).join('; ')}.`, '',
            `Prazos em aberto: ${(proc.prazos || []).filter((x) => x.status === 'aberto').map((x) => `${x.descricao}, vence em ${brData(x.vence_em)}`).join('; ') || 'nenhum'}.`, '',
            'Últimos movimentos:',
            ...movs.map((m) => `${brDataHora(m.em)} — ${m.descricao}`), '',
            `Certidão emitida pelo portal das partes em ${brDataHora(new Date().toISOString())} a pedido de ${(parte === null || parte === void 0 ? void 0 : parte.assina) || nomeConta}.`,
            `Confira cada documento pelo código impresso nas folhas em ${process.env.APP_URL || 'https://sigo-caocipp.web.app'}/Conferir.`,
        ];
        const r = await (0, pdfDocumento_1.renderizarDocumento)((0, pdfDocumento_1.textoParaDoc)(linhas.join('\n')), {}, { semCabecalho: true });
        return { base64: r.buffer.toString('base64'), nome: `certidao-${String(proc.numero).replace('/', '-')}.pdf` };
    }
    if (p.action === 'comprovante') {
        // Comprovante de protocolo de uma petição desta conta.
        const { ref, data: proc, org } = await lerComoParte(db, uid, p.processoId);
        const d = (await ref.collection('documentos').doc(String(p.docId || '_')).get()).data();
        if (!d || !d.peticao || d.autor_uid !== uid)
            throw new https_1.HttpsError('not-found', 'Petição não encontrada');
        const linhas = [
            'COMPROVANTE DE PROTOCOLO', '',
            `${org.name || ''}`,
            `Processo nº ${proc.numero} — ${proc.assunto}`, '',
            `Protocolo: ${proc.numero}-${d.ordem}`,
            `Petição: ${d.titulo}${d.peticao_tipo ? ` (${d.peticao_tipo})` : ''}`,
            `Protocolada em ${brDataHora(d.juntado_em)} por ${d.autor_nome}.`,
            `Juntada como documento nº ${d.ordem}, ${(0, autos_1.textoFolhas)(Number(d.folha_inicial || 1), Number(d.paginas || 1))}.`,
            `SHA-256 do conteúdo: ${d.sha256}`,
            d.codigo_verificacao ? `Código de conferência: ${d.codigo_verificacao}` : '',
            '', `Emitido em ${brDataHora(new Date().toISOString())} pelo portal das partes.`,
        ];
        const r = await (0, pdfDocumento_1.renderizarDocumento)((0, pdfDocumento_1.textoParaDoc)(linhas.join('\n')), {}, { semCabecalho: true });
        return { base64: r.buffer.toString('base64'), nome: `protocolo-${String(proc.numero).replace('/', '-')}-${d.ordem}.pdf` };
    }
    if (p.action === 'baixar' || p.action === 'pdf') {
        const { ref, data: proc } = await lerComoParte(db, uid, p.processoId);
        const d = (await ref.collection('documentos').doc(String(p.docId || '_')).get()).data();
        if (!d || d.status !== 'juntado' || d.visivel_partes === false)
            throw new https_1.HttpsError('not-found', 'Documento não encontrado');
        if (p.action === 'pdf')
            return { base64: await (0, autos_1.pdfCarimbado)(db, proc.organization_id, ref.id, String(proc.numero), String(p.docId), d), nome: `documento-${d.ordem}.pdf` };
        if (d.origem === 'editor')
            return { origem: 'editor', titulo: d.titulo, conteudo: (0, autos_1.conteudoDoDocumento)(d) };
        const [buf] = await admin.storage().bucket().file(d.storage_path).download();
        return { origem: 'upload', titulo: d.titulo, mime: d.mime, nomeArquivo: d.nome_arquivo, base64: buf.toString('base64') };
    }
    if (p.action === 'peticionar') {
        const tipoPeticao = exports.TIPOS_PETICAO_PORTAL.includes(String(p.tipo)) ? String(p.tipo) : '';
        const titulo = (0, secretaria_1.texto)(p.titulo) || tipoPeticao || 'Petição';
        const prazoId = (0, secretaria_1.texto)(p.prazo_id, 60);
        const corpo = (0, secretaria_1.texto)(p.texto, secretaria_1.MAX_TEXTO_LONGO * 10);
        const temArquivo = !!p.base64;
        if (!corpo && !temArquivo)
            throw new https_1.HttpsError('invalid-argument', 'Escreva a petição ou anexe um arquivo');
        let buf = null;
        if (temArquivo) {
            if (!TIPOS_PETICAO[String(p.mime)])
                throw new https_1.HttpsError('invalid-argument', 'Anexe PDF, Word (DOCX), PNG ou JPG');
            buf = Buffer.from(String(p.base64), 'base64');
            if (!buf.length || buf.length > secretaria_1.MAX_UPLOAD_BYTES)
                throw new https_1.HttpsError('invalid-argument', 'Arquivo vazio ou acima de 5 MB');
        }
        // Confere acesso antes de gravar o arquivo.
        const { ref: procRef, data: procAntes } = await lerComoParte(db, uid, p.processoId);
        const docRef = procRef.collection('documentos').doc();
        let path = null;
        if (buf) {
            path = (0, documentos_1.caminhoArquivo)(procAntes.organization_id, procRef.id, docRef.id);
            await admin.storage().bucket().file(path).save(buf, { contentType: String(p.mime), resumable: false });
        }
        const agora = new Date().toISOString();
        // Petição escrita vira documento do editor, com PDF próprio (sem o
        // cabeçalho do órgão) assinado pela parte; anexo conta as próprias páginas.
        const conteudoDoc = !buf && corpo ? (0, pdfDocumento_1.textoParaDoc)(corpo) : null;
        const hashConteudo = buf ? (0, secretaria_1.sha256)(buf) : (0, secretaria_1.sha256)((0, secretaria_1.jsonCanonico)(conteudoDoc));
        const parteAntes = parteDoUsuario(procAntes, uid);
        let paginas = 1;
        let pdf = null;
        if (buf)
            paginas = await (0, autos_1.paginasDeArquivo)(buf, String(p.mime));
        else if (conteudoDoc) {
            const rr = await (0, pdfDocumento_1.renderizarDocumento)(conteudoDoc, {}, { semCabecalho: true, sha256: hashConteudo, assinaturas: [{ nome: (parteAntes === null || parteAntes === void 0 ? void 0 : parteAntes.assina) || nomeConta, em: agora }] });
            paginas = rr.paginas;
            pdf = { path: (0, autos_1.caminhoPdf)((0, documentos_1.caminhoArquivo)(procAntes.organization_id, procRef.id, docRef.id)), sha256: (0, secretaria_1.sha256)(rr.buffer) };
            await admin.storage().bucket().file(pdf.path).save(rr.buffer, { contentType: 'application/pdf', resumable: false });
        }
        const r = await db.runTransaction(async (tx) => {
            var _a;
            const { data: proc, org } = await lerComoParte(db, uid, p.processoId, tx);
            const parte = parteDoUsuario(proc, uid);
            const folha = (await (0, autos_1.folhasDoProcesso)(tx, procRef, proc)) + 1;
            const ordem = (Number(proc.doc_seq) || 0) + 1;
            // Tempestividade: compara com prazos abertos para esta parte (ou sem destinatário).
            const hoje = (0, secretaria_1.hojeBrasil)();
            // Se a parte disse a qual prazo responde, a tempestividade é só desse.
            const prazos = prazosDaParte(proc, parte).filter((x) => !prazoId || x.id === prazoId);
            const tempest = prazos.map((x) => `prazo "${x.descricao}" vence em ${x.vence_em.split('-').reverse().join('/')}: ${hoje <= x.vence_em ? 'tempestiva' : 'intempestiva'}`).join('; ');
            const interrompe = ((_a = org.secretariaConfig) === null || _a === void 0 ? void 0 : _a.peticao_interrompe) === true;
            const pend = {
                id: procRef.collection('_').doc().id, tipo: 'peticao', interrompe, status: 'aberta',
                descricao: `Apreciar petição nº ${ordem} de ${parte.rotulo}${tipoPeticao ? ` [${tipoPeticao}]` : ''}: ${titulo}${tempest ? `. ${tempest}` : ''}`,
                documento_id: docRef.id, aberta_em: agora, aberta_por: parte.como === 'representante' ? `${parte.nome} (parte, por ${parte.representante})` : `${parte.nome} (parte)`,
            };
            const pendencias = [...(proc.pendencias || []), pend];
            const c = contextoParte(db, proc, uid, `${parte.assina} (parte)`);
            const mov = (0, context_1.registrarMovimento)(tx, c, procRef, proc, 'peticao', `Petição protocolada por ${parte.rotulo}: ${titulo}. Juntada como documento nº ${ordem}, ${(0, autos_1.textoFolhas)(folha, paginas)}.${tempest ? ` ${tempest[0].toUpperCase()}${tempest.slice(1)}.` : ''} Pendência aberta para o decisor${interrompe ? ', com interrupção da fase' : ''}.`, { documento_id: docRef.id, ordem, folha_inicial: folha, paginas });
            const codigo = (0, autos_1.novoCodigo)();
            const dadosDoc = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ titulo, tipo: 'Petição', origem: buf ? 'upload' : 'editor', peticao: true, status: 'juntado', ordem }, (tipoPeticao ? { peticao_tipo: tipoPeticao } : {})), (prazoId ? { prazo_id: prazoId } : {})), (buf ? { mime: p.mime, nome_arquivo: (0, secretaria_1.texto)(p.nomeArquivo) || titulo, tamanho: buf.length, storage_path: path } : { conteudo: conteudoDoc })), (pdf ? { pdf_path: pdf.path, pdf_sha256: pdf.sha256 } : {})), (buf && corpo ? { observacao: corpo } : {})), { paginas, folha_inicial: folha, folha_final: folha + paginas - 1, sha256: hashConteudo, unidade_origem: 'parte', autor_uid: uid, autor_nome: parte.assina, criado_em: agora, juntado_em: agora, juntado_por: uid, juntado_por_nome: `${parte.assina} (parte)`, visivel_partes: true, assinaturas: [{ uid, nome: parte.assina, em: agora, sha256: hashConteudo, nivel: 'simples' }], codigo_verificacao: codigo });
            tx.set(docRef, dadosDoc);
            tx.set(db.collection(context_1.COL.verificacao).doc(codigo), (0, autos_1.registroVerificacao)(proc.organization_id, String(org.name || ''), procRef.id, proc, docRef.id, dadosDoc));
            tx.update(procRef, Object.assign(Object.assign(Object.assign({}, mov), { doc_seq: ordem, folhas_seq: folha + paginas - 1, pendencias }), (0, secretaria_1.derivados)(pendencias, (proc.prazos || []))));
            return { ordem, protocolo: `${proc.numero}-${ordem}`, em: agora, docId: docRef.id };
        });
        void (0, portalAvisos_1.avisarPartesDoMovimento)(db, procRef.id, uid);
        void (0, avisosEquipe_1.avisarPeticao)(db, procAntes, procRef.id, String(((_g = parteDoUsuario(procAntes, uid)) === null || _g === void 0 ? void 0 : _g.assina) || 'A parte'), titulo, tipoPeticao);
        return Object.assign({ success: true }, r);
    }
    throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
});
/** Contexto mínimo para registrar movimento em nome de uma parte. */
function contextoParte(db, proc, uid, nome) {
    return { db, orgId: proc.organization_id, org: {}, ctx: { uid, isAdmin: false, unidadeIds: [] }, userName: nome, unidades: [], gestorDe: [] };
}
//# sourceMappingURL=portal.js.map