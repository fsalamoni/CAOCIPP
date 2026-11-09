"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secretariaPortal = void 0;
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const secretaria_1 = require("../shared/secretaria");
const context_1 = require("./context");
const documentos_1 = require("./documentos");
const autos_1 = require("./autos");
const pdfDocumento_1 = require("./pdfDocumento");
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
const MOVIMENTOS_INTERNOS = ['atribuicao', 'pendencia'];
const TIPOS_PETICAO = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
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
    return (proc.partes || []).find((p) => p.uid === uid);
}
exports.secretariaPortal = (0, https_1.onCall)({ region: context_1.REGION, memory: '512MiB' }, async (request) => {
    var _a;
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
            if (parte.uid && parte.uid !== uid)
                throw new https_1.HttpsError('failed-precondition', 'Esta parte já está vinculada a outra conta');
            partes[conv.parte_idx] = Object.assign(Object.assign({}, parte), { uid, habilitada_em: new Date().toISOString(), conta: nomeConta });
            const c = contextoParte(db, proc, uid, `${parte.nome} (parte)`);
            const mov = (0, context_1.registrarMovimento)(tx, c, ref, proc, 'habilitacao', `${parte.nome} (${parte.polo}) passou a acompanhar o processo pelo portal das partes.`, { parte_idx: conv.parte_idx });
            tx.update(ref, Object.assign(Object.assign({}, mov), { partes, partes_uids: firestore_1.FieldValue.arrayUnion(uid) }));
            tx.update(conviteRef, { usado_por: uid, usado_em: new Date().toISOString() });
            return { success: true, processoId: ref.id, organizationId: proc.organization_id };
        });
    }
    if (p.action === 'meusProcessos') {
        const snap = await db.collection(context_1.COL.processos).where('partes_uids', 'array-contains', uid).limit(200).get();
        const orgIds = [...new Set(snap.docs.map((d) => d.data().organization_id))];
        const orgs = orgIds.length ? await db.getAll(...orgIds.map((id) => db.collection('organizations').doc(id))) : [];
        const ativo = new Map(orgs.map((o) => { var _a, _b, _c; return [o.id, { on: ((_b = (_a = o.data()) === null || _a === void 0 ? void 0 : _a.secretariaConfig) === null || _b === void 0 ? void 0 : _b.enabled) === true, nome: ((_c = o.data()) === null || _c === void 0 ? void 0 : _c.name) || '' }]; }));
        return {
            processos: snap.docs.filter((d) => { var _a; return (_a = ativo.get(d.data().organization_id)) === null || _a === void 0 ? void 0 : _a.on; }).map((d) => {
                var _a, _b, _c;
                const x = d.data();
                return {
                    id: d.id, numero: x.numero, assunto: x.assunto, status: x.status, orgao: (_a = ativo.get(x.organization_id)) === null || _a === void 0 ? void 0 : _a.nome,
                    fase_nome: ((_b = (x.fases || []).find((f) => f.id === x.fase_atual)) === null || _b === void 0 ? void 0 : _b.nome) || x.fase_atual,
                    polo: (_c = parteDoUsuario(x, uid)) === null || _c === void 0 ? void 0 : _c.polo, ultimo_movimento: x.ultimo_movimento || null,
                };
            }),
        };
    }
    if (p.action === 'obter') {
        const { ref, data, org } = await lerComoParte(db, uid, p.processoId);
        const [movs, docs] = await Promise.all([
            ref.collection('movimentos').orderBy('seq').get(),
            ref.collection('documentos').where('status', '==', 'juntado')
                .select('ordem', 'titulo', 'tipo', 'juntado_em', 'origem', 'sha256', 'visivel_partes', 'folha_inicial', 'folha_final').get(),
        ]);
        const todos = movs.docs.map((d) => d.data());
        return {
            orgao: org.name || '',
            processo: {
                id: ref.id, numero: data.numero, assunto: data.assunto, status: data.status, descricao: data.descricao,
                fase_nome: ((_a = (data.fases || []).find((f) => f.id === data.fase_atual)) === null || _a === void 0 ? void 0 : _a.nome) || data.fase_atual,
                fase_atual: data.fase_atual,
                // Fluxo sem o que é interno da equipe (orientação, unidade, quem faz, ações, modelos, condições).
                fases: (data.fases || []).map(({ id, nome, prazo_dias, proximas, final }) => (Object.assign(Object.assign(Object.assign({ id, nome }, (prazo_dias ? { prazo_dias } : {})), (proximas ? { proximas } : {})), (final ? { final } : {})))),
                partes: (data.partes || []).map((x) => ({ nome: x.nome, polo: x.polo })),
                prazos: (data.prazos || []).filter((x) => x.status === 'aberto')
                    .map((x) => ({ descricao: x.descricao, destinatario: x.destinatario || '', vence_em: x.vence_em })),
                minha_parte: parteDoUsuario(data, uid),
            },
            movimentos: todos.filter((m) => { var _a; return !MOVIMENTOS_INTERNOS.includes(m.tipo) && ((_a = m.dados) === null || _a === void 0 ? void 0 : _a.visivel_partes) !== false; })
                .map((m) => ({ seq: m.seq, tipo: m.tipo, descricao: m.descricao, em: m.em, autor_nome: m.autor_nome, hash: m.hash })),
            documentos: docs.docs.map((d) => (Object.assign({ id: d.id }, d.data())))
                .filter((d) => d.visivel_partes !== false)
                .sort((a, b) => a.ordem - b.ordem)
                .map((d) => ({ id: d.id, ordem: d.ordem, titulo: d.titulo, tipo: d.tipo, juntado_em: d.juntado_em, origem: d.origem, sha256: d.sha256, folha_inicial: d.folha_inicial || null, folha_final: d.folha_final || null })),
            cadeiaIntegra: (0, secretaria_1.verificarCadeia)(todos) === null,
        };
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
        const titulo = (0, secretaria_1.texto)(p.titulo) || 'Petição';
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
            const rr = await (0, pdfDocumento_1.renderizarDocumento)(conteudoDoc, {}, { semCabecalho: true, sha256: hashConteudo, assinaturas: [{ nome: (parteAntes === null || parteAntes === void 0 ? void 0 : parteAntes.nome) || nomeConta, em: agora }] });
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
            const prazos = (proc.prazos || []).filter((x) => x.status === 'aberto'
                && (!x.destinatario || String(x.destinatario).toLowerCase().includes(parte.nome.toLowerCase())));
            const tempest = prazos.map((x) => `prazo "${x.descricao}" vence em ${x.vence_em.split('-').reverse().join('/')}: ${hoje <= x.vence_em ? 'tempestiva' : 'intempestiva'}`).join('; ');
            const interrompe = ((_a = org.secretariaConfig) === null || _a === void 0 ? void 0 : _a.peticao_interrompe) === true;
            const pend = {
                id: procRef.collection('_').doc().id, tipo: 'peticao', interrompe, status: 'aberta',
                descricao: `Apreciar petição nº ${ordem} de ${parte.nome} (${parte.polo}): ${titulo}${tempest ? `. ${tempest}` : ''}`,
                documento_id: docRef.id, aberta_em: agora, aberta_por: `${parte.nome} (parte)`,
            };
            const pendencias = [...(proc.pendencias || []), pend];
            const c = contextoParte(db, proc, uid, `${parte.nome} (parte)`);
            const mov = (0, context_1.registrarMovimento)(tx, c, procRef, proc, 'peticao', `Petição protocolada por ${parte.nome} (${parte.polo}): ${titulo}. Juntada como documento nº ${ordem}, ${(0, autos_1.textoFolhas)(folha, paginas)}.${tempest ? ` ${tempest[0].toUpperCase()}${tempest.slice(1)}.` : ''} Pendência aberta para o decisor${interrompe ? ', com interrupção da fase' : ''}.`, { documento_id: docRef.id, ordem, folha_inicial: folha, paginas });
            const codigo = (0, autos_1.novoCodigo)();
            const dadosDoc = Object.assign(Object.assign(Object.assign(Object.assign({ titulo, tipo: 'Petição', origem: buf ? 'upload' : 'editor', peticao: true, status: 'juntado', ordem }, (buf ? { mime: p.mime, nome_arquivo: (0, secretaria_1.texto)(p.nomeArquivo) || titulo, tamanho: buf.length, storage_path: path } : { conteudo: conteudoDoc })), (pdf ? { pdf_path: pdf.path, pdf_sha256: pdf.sha256 } : {})), (buf && corpo ? { observacao: corpo } : {})), { paginas, folha_inicial: folha, folha_final: folha + paginas - 1, sha256: hashConteudo, unidade_origem: 'parte', autor_uid: uid, autor_nome: parte.nome, criado_em: agora, juntado_em: agora, juntado_por: uid, juntado_por_nome: `${parte.nome} (parte)`, visivel_partes: true, assinaturas: [{ uid, nome: parte.nome, em: agora, sha256: hashConteudo, nivel: 'simples' }], codigo_verificacao: codigo });
            tx.set(docRef, dadosDoc);
            tx.set(db.collection(context_1.COL.verificacao).doc(codigo), (0, autos_1.registroVerificacao)(proc.organization_id, String(org.name || ''), procRef.id, proc, docRef.id, dadosDoc));
            tx.update(procRef, Object.assign(Object.assign(Object.assign({}, mov), { doc_seq: ordem, folhas_seq: folha + paginas - 1, pendencias }), (0, secretaria_1.derivados)(pendencias, (proc.prazos || []))));
            return { ordem, protocolo: `${proc.numero}-${ordem}`, em: agora };
        });
        return Object.assign({ success: true }, r);
    }
    throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida');
});
/** Contexto mínimo para registrar movimento em nome de uma parte. */
function contextoParte(db, proc, uid, nome) {
    return { db, orgId: proc.organization_id, org: {}, ctx: { uid, isAdmin: false, unidadeIds: [] }, userName: nome, unidades: [], gestorDe: [] };
}
//# sourceMappingURL=portal.js.map