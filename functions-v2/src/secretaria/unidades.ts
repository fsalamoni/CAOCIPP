import * as admin from 'firebase-admin';
import { createHash, randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { Lotacao, lotacoesDe, mesclarLotacoes, minutaAcessivel, sanitizeLotacoes, texto, tipoUnidade, trocarUnidadeDasFases } from '../shared/secretaria';
import { formatPersonName } from '../shared/normalization';
import { sendEmail } from '../shared/email';
import { COL, Contexto, administraOrgao, erroUsuario, exigirAdminDoOrgao, exigirGestor, registrarMovimento } from './context';
import { APP_URL } from './autos';
import { sanitizeDocumentoConfig } from './documentoConfig';
import { sanitizeCompetencias } from '../shared/orgaos';
import { lerOrgaos } from './orgaos';
import { marcasNaFase } from '../shared/exigencias';

/**
 * Unidades de lotação do Processo Eletrônico: dados, equipe (lotações com
 * atribuição e gestão), convites, pedidos de lotação e papel timbrado/tipos
 * de documento próprios. O admin do órgão faz tudo; o gestor da unidade
 * cuida da equipe, do timbrado e dos modelos dela.
 */

const MAX_UNIDADES = 100;
const MAX_PEDIDOS = 50;
const CONVITE_DIAS = 7;
const escapar = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

type Payload = Record<string, unknown> & { id?: string; unidadeId?: string };

/** Confere que todas as pessoas são membros ativos do órgão. */
async function exigirMembros(c: Contexto, uids: string[]) {
    if (!uids.length) return;
    const snaps = await c.db.getAll(...uids.map((uid) => c.db.collection('userOrganizations').doc(`${uid}_${c.orgId}`)));
    const fora = snaps.filter((s) => !s.exists || s.data()?.active === false).length;
    if (fora) throw new HttpsError('invalid-argument', `${fora} pessoa(s) não são membros ativos do órgão`);
}

/** Campos a gravar quando as lotações mudam (membros_uids segue em sincronia). */
const camposLotacao = (lotacoes: Lotacao[]) => ({ lotacoes, membros_uids: lotacoes.map((l) => l.uid) });

export async function salvarUnidade(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    const u = (p.unidade && typeof p.unidade === 'object' ? p.unidade : {}) as Record<string, unknown>;
    const lotacoes = sanitizeLotacoes(u.lotacoes ?? (Array.isArray(u.membros_uids) ? u.membros_uids.map((x) => ({ uid: x })) : []));
    await exigirMembros(c, lotacoes.map((l) => l.uid));
    const agora = FieldValue.serverTimestamp();
    // Órgão interno a que a unidade pertence (vazio = ligada direto à entidade).
    const orgaoId = String(u.orgao_id || '');
    if (c.ctx.isAdmin && orgaoId && !(await lerOrgaos(c.db, c.orgId)).some((o) => o.id === orgaoId)) {
        throw new HttpsError('invalid-argument', 'Órgão interno inválido');
    }
    const competencias = sanitizeCompetencias(u.competencias);
    if (p.id) {
        const atual = exigirGestor(c, p.id);
        // O gestor cuida da equipe e da descrição; nome, tipo, ativação e
        // órgão são do admin da entidade ou de quem administra o órgão da unidade.
        const estrutura = administraOrgao(c, atual.orgao_id);
        // Delegado só leva a unidade para outro órgão que administra (nunca direto à entidade).
        if (estrutura && !c.ctx.isAdmin && 'orgao_id' in u) exigirAdminDoOrgao(c, orgaoId || null);
        const dados: Record<string, unknown> = estrutura
            ? { nome: texto(u.nome) || atual.nome, sigla: texto(u.sigla, 20), tipo: tipoUnidade(u.tipo), ativa: u.ativa !== false, ...('orgao_id' in u ? { orgao_id: orgaoId || null } : {}) }
            : {};
        if (estrutura && !texto(u.nome)) throw new HttpsError('invalid-argument', 'A unidade precisa de um nome');
        // Unidade inativa não movimenta: desativar com processo em andamento deixaria o processo preso.
        if (dados.ativa === false && atual.ativa !== false) {
            const base = c.db.collection(COL.processos).where('organization_id', '==', c.orgId).where('unidade_atual', '==', atual.id);
            const [todos, arquivados] = await Promise.all([base.count().get(), base.where('status', '==', 'arquivado').count().get()]);
            const presos = todos.data().count - arquivados.data().count;
            if (presos > 0) {
                throw new HttpsError('failed-precondition', `A unidade tem ${presos} processo(s) em andamento. Envie-os para outra unidade antes de desativá-la.`);
            }
        }
        // Quem salva parte da equipe que carregou (`lotacoes_base`): só o que essa
        // pessoa mudou vale sobre a equipe atual, sem desfazer admissões feitas no meio-tempo.
        const ref = c.db.collection(COL.unidades).doc(atual.id);
        let removidos: string[] = [];
        let total = 0;
        await c.db.runTransaction(async (tx) => {
            const atuais = lotacoesDe((await tx.get(ref)).data() || {});
            const final = sanitizeLotacoes(Array.isArray(p.lotacoes_base) ? mesclarLotacoes(atuais, sanitizeLotacoes(p.lotacoes_base), lotacoes) : lotacoes);
            // Gestor não tira a própria gestão (evita unidade sem ninguém que a gerencie por engano).
            if (!estrutura && !final.some((l) => l.uid === uid && l.gestor)) {
                throw new HttpsError('failed-precondition', 'Você não pode tirar a sua própria gestão da unidade; peça ao admin do órgão');
            }
            removidos = atuais.filter((l) => !final.some((x) => x.uid === l.uid)).map((l) => l.uid);
            total = final.length;
            tx.update(ref, {
                ...dados, descricao: texto(u.descricao, 500), ...('competencias' in u ? { competencias } : {}), ...camposLotacao(final), updated_at: agora, updated_by: uid,
            });
        });
        const liberados = await liberarResponsaveis(c, atual.id, removidos);
        await auditar('SECRETARIA_UNIDADE_SALVA', { unidade_id: atual.id, nome: dados.nome || atual.nome, lotacoes: total, ...(liberados ? { atribuicoes_removidas: liberados } : {}) });
        return { success: true, id: atual.id, atribuicoes_removidas: liberados };
    }
    // Unidade nova: o admin da entidade, ou o delegado dentro de um órgão que administra.
    exigirAdminDoOrgao(c, orgaoId || null);
    const nome = texto(u.nome);
    if (!nome) throw new HttpsError('invalid-argument', 'A unidade precisa de um nome');
    if (c.unidades.filter((x) => !x.excluida).length >= MAX_UNIDADES) throw new HttpsError('resource-exhausted', 'Limite de unidades atingido');
    const ref = await c.db.collection(COL.unidades).add({
        organization_id: c.orgId, nome, sigla: texto(u.sigla, 20), tipo: tipoUnidade(u.tipo), descricao: texto(u.descricao, 500),
        orgao_id: orgaoId || null, competencias, ativa: u.ativa !== false, ...camposLotacao(lotacoes), pedidos: [], created_at: agora, created_by: uid,
    });
    await auditar('SECRETARIA_UNIDADE_SALVA', { unidade_id: ref.id, nome, lotacoes: lotacoes.length });
    return { success: true, id: ref.id };
}

/**
 * Quem saiu da equipe deixa de ser responsável pelos processos da unidade:
 * a atribuição desfeita fica registrada (registro de controle, fora dos autos).
 */
async function liberarResponsaveis(c: Contexto, unidadeId: string, uids: string[]): Promise<number> {
    let n = 0;
    for (let i = 0; i < uids.length; i += 30) {
        const snap = await c.db.collection(COL.processos).where('organization_id', '==', c.orgId).where('unidade_atual', '==', unidadeId)
            .where('responsavel_uid', 'in', uids.slice(i, i + 30)).limit(500).get();
        for (const d of snap.docs) {
            n += await c.db.runTransaction(async (tx) => {
                const data = (await tx.get(d.ref)).data();
                if (!data || data.unidade_atual !== unidadeId || !uids.includes(data.responsavel_uid)) return 0;
                const mov = registrarMovimento(tx, c, d.ref, data, 'atribuicao', 'Atribuição removida: a pessoa responsável deixou a equipe da unidade.', { responsavel_uid: null, automatico: true, ...marcasNaFase(data, 'atribuicao') });
                tx.update(d.ref, { ...mov, responsavel_uid: null });
                return 1;
            });
        }
    }
    return n;
}

const MAX_SUCESSAO = 500;
const MAX_LOTE = 400; // como removerOrgao (orgaos.ts)

/**
 * Exclui a unidade. Nada se apaga: ela some das listas e da escolha de destino,
 * mas o nome continua nos autos. Processos dela vão para a sucessora, com termo
 * de remessa e as minutas junto. Modelos dela, tipos que entram por ela e fases
 * de rito que correm nela passam para a sucessora. Sem sucessora, os modelos vão,
 * inativos, para o órgão interno dela (ou o órgão); os tipos entram pela unidade
 * de quem autua e as fases correm na unidade que estiver com o processo.
 * Processos já autuados guardam a cópia das fases e não mudam. A equipe, os
 * pedidos e os convites em aberto deixam de valer. `simular` só devolve o
 * impacto. Admin exclui qualquer unidade; quem a criou, só a que não tem
 * processo nem é usada por tipo ou fase de rito.
 */
export async function excluirUnidade(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    const u = c.unidades.find((x) => x.id === String(p.id || '') && !x.excluida);
    if (!u) throw new HttpsError('not-found', 'Unidade não encontrada');
    if (!c.ctx.isAdmin && u.created_by !== uid) throw new HttpsError('permission-denied', 'Só o admin do órgão ou quem criou a unidade pode excluí-la');
    const doOrgao = (col: string) => c.db.collection(col).where('organization_id', '==', c.orgId);
    const [procs, modelos, tipos, ritosSnap, convites, orgaos] = await Promise.all([
        doOrgao(COL.processos).where('unidade_atual', '==', u.id).limit(MAX_SUCESSAO + 1).get(),
        doOrgao(COL.modelos).where('unidade_id', '==', u.id).select('excluido').get(),
        doOrgao(COL.tipos).where('unidade_inicial', '==', u.id).select('excluido', 'orgao_id').get(),
        doOrgao(COL.ritos).select('nome', 'fases', 'excluido').get(),
        doOrgao(COL.convitesEquipe).where('unidade_id', '==', u.id).get(),
        lerOrgaos(c.db, c.orgId),
    ]);
    const vivo = (d: admin.firestore.QueryDocumentSnapshot) => d.data().excluido !== true;
    // Itens na lixeira também mudam (se restaurados, não podem apontar para unidade excluída), mas só os vivos contam e bloqueiam.
    const ritos = ritosSnap.docs.map((d) => ({ d, n: trocarUnidadeDasFases(d.data().fases, u.id, null).trocadas })).filter((r) => r.n > 0);
    const ritosVivos = ritos.filter((r) => vivo(r.d));
    const tiposVivos = tipos.docs.filter(vivo).length;
    const abertos = convites.docs.filter((d) => !d.data().usado_por && !d.data().revogado);
    const orgao = orgaos.find((o) => o.id === u.orgao_id) || null;
    const arquivados = procs.docs.filter((d) => d.data().status === 'arquivado').length;
    if (p.simular === true) {
        return {
            processos: procs.size, arquivados, em_andamento: procs.size - arquivados, modelos: modelos.docs.filter(vivo).length, equipe: lotacoesDe(u).length,
            pode_mover: c.ctx.isAdmin, tipos: tiposVivos,
            ritos: ritosVivos.map((r) => ({ id: r.d.id, nome: String(r.d.data().nome || ''), fases: r.n })),
            orgao: orgao?.nome || null,
        };
    }
    // Tipos e ritos são configuração do órgão: só o admin os reatribui.
    if (!c.ctx.isAdmin && (procs.size || tiposVivos || ritosVivos.length)) {
        throw new HttpsError('permission-denied', 'A unidade tem processos ou é usada por tipos de processo e fases de rito. Só o admin do órgão pode excluí-la.');
    }
    const sucId = String(p.sucessora || '');
    const sucessora = sucId ? c.unidades.find((x) => x.id === sucId && x.id !== u.id && x.ativa !== false && !x.excluida) || null : null;
    if (sucId && !sucessora) throw new HttpsError('invalid-argument', 'A unidade escolhida para receber não está ativa');
    if (sucessora && !c.ctx.isAdmin && !c.gestorDe.includes(sucessora.id)) throw new HttpsError('permission-denied', 'Escolha uma unidade que você gere');
    if (procs.size > MAX_SUCESSAO) throw new HttpsError('resource-exhausted', `A unidade tem mais de ${MAX_SUCESSAO} processos. Envie parte deles antes de excluí-la.`);
    if (procs.size && !sucessora) throw new HttpsError('invalid-argument', `Escolha a unidade ativa que recebe os ${procs.size} processo(s) desta unidade.`);
    if (1 + modelos.size + tipos.size + ritos.length + abertos.length > MAX_LOTE) {
        throw new HttpsError('resource-exhausted', 'A unidade tem itens demais ligados a ela para excluir de uma vez. Mova ou exclua parte dos modelos antes.');
    }
    // Validado tudo antes: nenhum processo sai se a exclusão for recusada. Repetir é seguro (os já movidos não voltam na consulta).
    for (const d of procs.docs) {
        await c.db.runTransaction(async (tx) => {
            const data = (await tx.get(d.ref)).data();
            if (!data || data.unidade_atual !== u.id) return;
            const minutas = (await tx.get(d.ref.collection('documentos').where('status', '==', 'minuta'))).docs
                .filter((m) => minutaAcessivel(m.data(), [u.id]));
            const mov = registrarMovimento(tx, c, d.ref, data, 'tramitacao', `Remetido de ${u.nome} para ${sucessora!.nome}, por exclusão da unidade.`,
                { de: u.id, para: sucessora!.id, exclusao_unidade: true, ...(minutas.length ? { minutas: minutas.map((m) => m.id) } : {}) });
            minutas.forEach((m) => tx.update(m.ref, { unidades_acesso: FieldValue.arrayUnion(sucessora!.id) }));
            tx.update(d.ref, { ...mov, unidade_atual: sucessora!.id, unidades_historico: FieldValue.arrayUnion(sucessora!.id), responsavel_uid: null, recebido_em: new Date().toISOString() });
        });
    }
    const agora = FieldValue.serverTimestamp();
    const para = sucessora?.id || null;
    const orgaoSuc = sucessora?.orgao_id || null;
    const b = c.db.batch();
    // Modelos, tipos e ritos foram lidos antes de mover os processos (pode levar segundos): só grava se ninguém os mudou desde então.
    const igual = (d: admin.firestore.QueryDocumentSnapshot) => ({ lastUpdateTime: d.updateTime });
    b.update(c.db.collection(COL.unidades).doc(u.id), {
        excluida: true, ativa: false, ...camposLotacao([]), pedidos: [], excluida_em: new Date().toISOString(), excluida_por: uid, updated_at: agora, updated_by: uid,
    });
    // Sem sucessora, o modelo vira do órgão, inativo: o admin revê antes de valer para todas as unidades.
    modelos.docs.forEach((d) => b.update(d.ref, para
        ? { unidade_id: para, orgao_id: null, updated_at: agora, updated_by: uid }
        : { unidade_id: null, orgao_id: orgao?.id || null, ativo: false, updated_at: agora, updated_by: uid }, igual(d)));
    tipos.docs.forEach((d) => {
        // Tipo de órgão interno só autua por unidade dele (processos.ts, autuar).
        const oT = d.data().orgao_id || null;
        const preso = oT && oT !== orgaoSuc && orgaos.some((o) => o.id === oT);
        b.update(d.ref, { unidade_inicial: para && !preso ? para : null, updated_at: agora, updated_by: uid }, igual(d));
    });
    // ponytail: troca sem versão nova do rito ou do tipo (como removerOrgao); a auditoria registra. Versionar se o histórico precisar mostrar.
    ritos.forEach(({ d }) => b.update(d.ref, { fases: trocarUnidadeDasFases(d.data().fases, u.id, para).fases, updated_at: agora, updated_by: uid }, igual(d)));
    abertos.forEach((d) => b.update(d.ref, { revogado: true }));
    try {
        await b.commit();
    } catch (e) {
        // Os processos já movidos ficam na sucessora; repetir termina o resto com a configuração nova.
        if ((e as { code?: number }).code === 9) throw new HttpsError('aborted', 'Um modelo, tipo ou rito ligado à unidade mudou enquanto ela era excluída. Os processos já foram enviados; tente excluir de novo.');
        throw e;
    }
    const fases = ritos.reduce((s, r) => s + r.n, 0);
    await auditar('SECRETARIA_UNIDADE_EXCLUIDA', { unidade_id: u.id, nome: u.nome, processos: procs.size, sucessora: para, modelos: modelos.size, tipos: tipos.size, ritos: ritos.map((r) => r.d.id), fases });
    return { success: true, processos: procs.size, sucessora: sucessora?.nome || null, modelos: modelos.size, tipos: tipos.size, fases };
}

export async function obterUnidadeDocumento(c: Contexto, p: Payload) {
    const u = exigirGestor(c, p.unidadeId);
    const d = (await c.db.collection(COL.unidadeConfig).doc(u.id).get()).data() || {};
    return {
        timbrado_proprio: d.timbrado_proprio === true,
        documento: d.documento ? sanitizeDocumentoConfig(d.documento, { semTiposPadrao: true }) : null,
        tipos_documento: Array.isArray(d.tipos_documento) ? d.tipos_documento : [],
    };
}

export async function salvarUnidadeDocumento(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    const u = exigirGestor(c, p.unidadeId);
    let documento = null;
    try {
        documento = p.documento ? sanitizeDocumentoConfig(p.documento, { semTiposPadrao: true }) : null;
    } catch (e) { erroUsuario(e); }
    const tipos = [...new Set((Array.isArray(p.tipos_documento) ? p.tipos_documento : []).map((t) => texto(t, 60)).filter(Boolean))].slice(0, 60);
    const proprio = p.timbrado_proprio === true && !!documento;
    await c.db.collection(COL.unidadeConfig).doc(u.id).set({
        organization_id: c.orgId, unidade_id: u.id, timbrado_proprio: proprio,
        documento: documento ? { ...documento, tipos_documento: [] } : null,
        tipos_documento: tipos, updated_at: FieldValue.serverTimestamp(), updated_by: uid,
    });
    await auditar('SECRETARIA_UNIDADE_DOCUMENTO', { unidade_id: u.id, timbrado_proprio: proprio, tipos: tipos.length });
    return { success: true };
}

export async function convidarEquipe(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    const u = exigirGestor(c, p.unidadeId);
    const email = texto(p.email, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'Informe um e-mail válido');
    const token = randomBytes(24).toString('base64url');
    const hash = hashToken(token);
    const expira = new Date(Date.now() + CONVITE_DIAS * 86400000).toISOString();
    await c.db.collection(COL.convitesEquipe).doc(hash).set({
        organization_id: c.orgId, unidade_id: u.id, unidade_nome: u.nome, email,
        atribuicao: texto(p.atribuicao, 80), gestor: p.gestor === true,
        expira_em: expira, criado_por: uid, criado_por_nome: c.userName, criado_em: FieldValue.serverTimestamp(), usado_por: null, revogado: false,
    });
    const link = `${APP_URL}/ProcessoEletronico?equipe=${token}`;
    const orgao = String(c.org.name || '');
    const enviado = await sendEmail({
        to: email,
        subject: `Convite para a equipe de ${u.nome} (${orgao})`,
        html: `<p>Olá.</p><p>${escapar(c.userName)} convidou você para a unidade <b>${escapar(String(u.nome))}</b> do Processo Eletrônico de <b>${escapar(orgao)}</b>${p.atribuicao ? `, com a atribuição <b>${escapar(texto(p.atribuicao, 80))}</b>` : ''}.</p><p><a href="${link}">Aceitar o convite</a> (vale por ${CONVITE_DIAS} dias). Entre com a conta Google deste e-mail.</p><p>Se você não esperava este e-mail, ignore-o.</p>`,
    }).catch(() => false);
    await auditar('SECRETARIA_EQUIPE_CONVITE', { unidade_id: u.id, email });
    return { success: true, link, emailEnviado: enviado, expira_em: expira };
}

export async function revogarConviteEquipe(c: Contexto, p: Payload, auditar: Auditar) {
    const ref = c.db.collection(COL.convitesEquipe).doc(texto(p.id, 80) || '_');
    const d = (await ref.get()).data();
    if (!d || d.organization_id !== c.orgId) throw new HttpsError('not-found', 'Convite não encontrado');
    exigirGestor(c, d.unidade_id);
    await ref.update({ revogado: true });
    await auditar('SECRETARIA_EQUIPE_CONVITE_REVOGADO', { unidade_id: d.unidade_id, email: d.email });
    return { success: true };
}

/** Convites pendentes das unidades que a pessoa gere (todas, para o admin). */
export async function convitesPendentes(c: Contexto) {
    if (!c.ctx.isAdmin && !c.gestorDe.length) return [];
    const snap = await c.db.collection(COL.convitesEquipe).where('organization_id', '==', c.orgId).get();
    const agora = new Date().toISOString();
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
        .filter((d) => !d.usado_por && !d.revogado && String(d.expira_em) > agora)
        .filter((d) => c.ctx.isAdmin || c.gestorDe.includes(String(d.unidade_id)))
        .map((d) => ({ id: d.id, unidade_id: d.unidade_id, email: d.email, atribuicao: d.atribuicao || '', gestor: d.gestor === true, expira_em: d.expira_em }));
}

/** Membro do órgão pede para ser lotado numa unidade; a gestão admite ou recusa. */
export async function pedirLotacao(c: Contexto, p: Payload, uid: string, email: string) {
    const ref = c.db.collection(COL.unidades).doc(String(p.unidadeId || '_'));
    await c.db.runTransaction(async (tx) => {
        const u = (await tx.get(ref)).data();
        if (!u || u.organization_id !== c.orgId || u.ativa === false) throw new HttpsError('not-found', 'Unidade não encontrada');
        if (lotacoesDe(u).some((l) => l.uid === uid)) throw new HttpsError('already-exists', 'Você já está lotado nesta unidade');
        const pedidos = (Array.isArray(u.pedidos) ? u.pedidos : []).filter((x: { uid: string }) => x.uid !== uid);
        if (pedidos.length >= MAX_PEDIDOS) throw new HttpsError('resource-exhausted', 'A unidade tem pedidos demais em aberto');
        pedidos.push({ uid, nome: c.userName, email, mensagem: texto(p.mensagem, 300), em: new Date().toISOString() });
        tx.update(ref, { pedidos });
    });
    return { success: true };
}

export async function decidirPedido(c: Contexto, p: Payload, uid: string, auditar: Auditar) {
    const u0 = exigirGestor(c, p.unidadeId);
    const alvo = texto(p.uid, 128);
    const admitir = p.admitir === true;
    if (admitir) await exigirMembros(c, [alvo]);
    const ref = c.db.collection(COL.unidades).doc(u0.id);
    await c.db.runTransaction(async (tx) => {
        const u = (await tx.get(ref)).data() || {};
        const pedidos = (Array.isArray(u.pedidos) ? u.pedidos : []) as Array<{ uid: string }>;
        if (!pedidos.some((x) => x.uid === alvo)) throw new HttpsError('not-found', 'Pedido não encontrado');
        const lotacoes = lotacoesDe(u);
        if (admitir && !lotacoes.some((l) => l.uid === alvo)) {
            lotacoes.push({ uid: alvo, atribuicao: texto(p.atribuicao, 80), gestor: false });
        }
        tx.update(ref, { pedidos: pedidos.filter((x) => x.uid !== alvo), ...camposLotacao(lotacoes), updated_at: FieldValue.serverTimestamp(), updated_by: uid });
    });
    await auditar(admitir ? 'SECRETARIA_LOTACAO_ADMITIDA' : 'SECRETARIA_LOTACAO_RECUSADA', { unidade_id: u0.id, uid: alvo });
    return { success: true };
}

/** Prévia do convite (antes do aceite): órgão, unidade e validade. */
export async function verConviteEquipe(token: unknown) {
    const d = (await admin.firestore().collection(COL.convitesEquipe).doc(hashToken(String(token || ''))).get()).data();
    if (!d) throw new HttpsError('not-found', 'Convite não encontrado');
    const org = (await admin.firestore().collection('organizations').doc(d.organization_id).get()).data() || {};
    const valido = !d.usado_por && !d.revogado && String(d.expira_em) > new Date().toISOString();
    return {
        valido, orgao: String(org.name || ''), organizationId: d.organization_id, unidade: d.unidade_nome, email: d.email,
        atribuicao: d.atribuicao || '', convidado_por: d.criado_por_nome || '', expira_em: d.expira_em, usado: !!d.usado_por,
    };
}

/**
 * Aceite do convite de equipe: cria (ou reativa) o vínculo com o órgão e
 * lota a pessoa na unidade. Exige a conta do e-mail convidado.
 */
export async function aceitarConviteEquipe(auth: { uid: string; token: Record<string, unknown> }, token: unknown) {
    const db = admin.firestore();
    const ref = db.collection(COL.convitesEquipe).doc(hashToken(String(token || '')));
    const email = String(auth.token.email || '').toLowerCase();
    const nome = formatPersonName(String(auth.token.name || '')) || email;
    const r = await db.runTransaction(async (tx) => {
        const d = (await tx.get(ref)).data();
        if (!d) throw new HttpsError('not-found', 'Convite não encontrado');
        if (d.usado_por || d.revogado || String(d.expira_em) <= new Date().toISOString()) {
            throw new HttpsError('failed-precondition', 'Este convite já foi usado, foi revogado ou expirou. Peça um novo.');
        }
        if (!email || email !== d.email) {
            throw new HttpsError('permission-denied', `Este convite é para ${d.email}. Entre com a conta desse e-mail.`);
        }
        const orgId = d.organization_id as string;
        const unRef = db.collection(COL.unidades).doc(d.unidade_id);
        const memRef = db.collection('userOrganizations').doc(`${auth.uid}_${orgId}`);
        const [un, mem, perfil] = await Promise.all([tx.get(unRef), tx.get(memRef), tx.get(db.collection('users').doc(auth.uid))]);
        const u = un.data();
        if (!u || u.ativa === false) throw new HttpsError('failed-precondition', 'A unidade do convite não está mais ativa');
        const funcao = String(perfil.data()?.function || '').trim() || 'Membro';
        if (!mem.exists) {
            tx.set(memRef, {
                id: `${auth.uid}_${orgId}`, user_id: auth.uid, organization_id: orgId, user_email: email, user_name: nome,
                role: 'member', function: funcao, active: true, joined_at: FieldValue.serverTimestamp(), via: 'convite_equipe',
            });
            tx.update(db.collection('organizations').doc(orgId), { 'stats.members_count': FieldValue.increment(1) });
        } else if (mem.data()?.active === false) {
            tx.update(memRef, { active: true, role: 'member', joined_at: FieldValue.serverTimestamp(), left_at: FieldValue.delete() });
            tx.update(db.collection('organizations').doc(orgId), { 'stats.members_count': FieldValue.increment(1) });
        }
        const lotacoes = lotacoesDe(u).filter((l) => l.uid !== auth.uid);
        lotacoes.push({ uid: auth.uid, atribuicao: String(d.atribuicao || ''), gestor: d.gestor === true });
        const pedidos = (Array.isArray(u.pedidos) ? u.pedidos : []).filter((x: { uid: string }) => x.uid !== auth.uid);
        tx.update(unRef, { ...camposLotacao(lotacoes), pedidos });
        tx.update(ref, { usado_por: auth.uid, usado_em: FieldValue.serverTimestamp() });
        return { orgId, unidade: String(u.nome) };
    });
    await db.collection('auditLogs').add({
        organization_id: r.orgId, user_id: auth.uid, user_name: nome, action: 'SECRETARIA_EQUIPE_CONVITE_ACEITO',
        details: { unidade: r.unidade }, timestamp: FieldValue.serverTimestamp(),
    });
    return { success: true, organizationId: r.orgId, unidade: r.unidade };
}

export type Auditar = (action: string, details: Record<string, unknown>) => Promise<void>;
