import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
    Contagem, Fase, MAX_ITENS, MAX_PRAZO_DIAS, MAX_TEXTO_LONGO, Pendencia, Prazo, calcularVencimento, derivados,
    hojeBrasil, numeroProcesso, podeAgir, podeVer, proximaFase, sha256, texto, verificarCadeia,
} from '../shared/secretaria';
import { sendEmail } from '../shared/email';
import {
    COL, REGION, carregarContexto, conferirVersao, exigirAuth, exigirPosse, lerProcesso,
    nomeUnidade, registrarMovimento,
} from './context';

/**
 * Processos da Secretaria: autuação, consulta, tramitação entre unidades,
 * atribuição a uma pessoa, avanço de fase e situação (sobrestar, arquivar,
 * reativar). Toda mudança grava um movimento encadeado por hash.
 */

interface ProcRequest {
    organizationId: string;
    action: 'listar' | 'obter' | 'autuar' | 'tramitar' | 'atribuir' | 'avancarFase' | 'alterarStatus'
        | 'abrirPendencia' | 'resolverPendencia' | 'abrirPrazo' | 'encerrarPrazo' | 'convidarParte' | 'revogarParte';
    // portal das partes
    parte_idx?: number;
    email?: string;
    // pendências e prazos
    interrompe?: boolean;
    pendencia_id?: string;
    resolucao?: string;
    dias?: number;
    contagem?: string;
    destinatario?: string;
    prazo_id?: string;
    resultado?: string;
    id?: string;
    version?: number;
    escopo?: 'caixa' | 'todos';
    // autuar
    assunto?: string;
    descricao?: string;
    rito_id?: string;
    unidade_id?: string;
    sigilo?: string;
    partes?: unknown;
    // movimentações
    unidade_destino?: string;
    responsavel_uid?: string | null;
    fase_id?: string;
    status?: string;
    motivo?: string;
}

const CONVITE_DIAS = 7;
const APP_URL = process.env.APP_URL || 'https://sigo-caocipp.web.app';
const escapar = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const POLOS =['requerente', 'requerido', 'interessado', 'terceiro'];
const MAX_PARTES = 50;

function sanitizePartes(input: unknown) {
    const lista = Array.isArray(input) ? input.slice(0, MAX_PARTES) : [];
    return lista
        .map((x) => {
            const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
            const polo = typeof o.polo === 'string' && POLOS.includes(o.polo) ? o.polo : 'interessado';
            return { nome: texto(o.nome), documento: texto(o.documento, 30), email: texto(o.email, 120), polo };
        })
        .filter((p) => p.nome);
}

function resumo(id: string, d: admin.firestore.DocumentData) {
    return {
        id,
        numero: d.numero,
        assunto: d.assunto,
        status: d.status,
        sigilo: d.sigilo,
        fase_atual: d.fase_atual,
        fase_nome: (d.fases || []).find((f: Fase) => f.id === d.fase_atual)?.nome || d.fase_atual,
        unidade_atual: d.unidade_atual,
        responsavel_uid: d.responsavel_uid || null,
        rito_nome: d.rito_nome,
        ultimo_movimento: d.ultimo_movimento || null,
        version: d.version,
        pendencias_abertas: d.pendencias_abertas || 0,
        fase_suspensa: d.fase_suspensa === true,
        proximo_vencimento: d.proximo_vencimento || null,
    };
}

export const secretariaProcesso = onCall<ProcRequest>({ region: REGION }, async (request) => {
    const auth = exigirAuth(request);
    const p = request.data || ({} as ProcRequest);
    const c = await carregarContexto(auth, p.organizationId);
    const { db, orgId } = c;

    if (p.action === 'listar') {
        // ponytail: lê até 1000 processos do órgão e filtra/ordena em memória
        // (sem índice composto). Paginar por updated_at quando passar disso.
        const snap = await db.collection(COL.processos).where('organization_id', '==', orgId).limit(1000).get();
        const lista = snap.docs
            .filter((d) => podeVer(d.data() as never, c.ctx))
            .filter((d) => p.escopo !== 'caixa' || podeAgir(d.data() as never, c.ctx))
            .map((d) => ({ ...resumo(d.id, d.data()), _t: d.data().updated_at?.toMillis?.() || 0 }))
            .sort((a, b) => b._t - a._t)
            .map(({ _t, ...r }) => r);
        return { processos: lista };
    }

    if (p.action === 'obter') {
        const { ref, data } = await lerProcesso(c, p.id);
        const [movs, docs] = await Promise.all([
            ref.collection('movimentos').orderBy('seq').get(),
            ref.collection('documentos').get(),
        ]);
        const movimentos = movs.docs.map((d) => d.data());
        const posse = podeAgir(data as never, c.ctx);
        const documentos = docs.docs
            .map((d) => ({ id: d.id, ...d.data() } as admin.firestore.DocumentData))
            // Minuta só é vista pela unidade que a redigiu; juntado = autos.
            .filter((d) => d.status === 'juntado' || c.ctx.unidadeIds.includes(d.unidade_origem))
            .map((d) => ({
                id: d.id, titulo: d.titulo, tipo: d.tipo, origem: d.origem, status: d.status,
                mime: d.mime || null, nome_arquivo: d.nome_arquivo || null, tamanho: d.tamanho || null,
                sha256: d.sha256, ordem: d.ordem || null, unidade_origem: d.unidade_origem,
                autor_nome: d.autor_nome, criado_em: d.criado_em, juntado_em: d.juntado_em || null,
                assinaturas: d.assinaturas || [],
                peticao: d.peticao === true, visivel_partes: d.visivel_partes !== false,
            }))
            .sort((a, b) => (a.ordem || 1e9) - (b.ordem || 1e9) || String(a.criado_em).localeCompare(String(b.criado_em)));
        return {
            processo: {
                ...resumo(ref.id, data),
                descricao: data.descricao,
                partes: (data.partes || []).map(({ convite_hash, uid, ...x }: Record<string, unknown>) => ({
                    ...x, portal: uid ? 'ativo' : convite_hash ? 'convidado' : null,
                })),
                fases: data.fases || [],
                unidades_historico: data.unidades_historico || [],
                autuado_em: data.autuado_em,
                autuado_por: data.autuado_por_nome,
                pendencias: data.pendencias || [],
                prazos: data.prazos || [],
            },
            hoje: hojeBrasil(),
            movimentos,
            documentos,
            cadeiaQuebradaEm: verificarCadeia(movimentos as never),
            posse,
        };
    }

    if (p.action === 'autuar') {
        const assunto = texto(p.assunto);
        if (!assunto) throw new HttpsError('invalid-argument', 'Informe o assunto');
        const unidadeId = String(p.unidade_id || '');
        const unidade = c.unidades.find((u) => u.id === unidadeId && u.ativa !== false);
        if (!unidade) throw new HttpsError('invalid-argument', 'Escolha a unidade que autua o processo');
        if (!c.ctx.unidadeIds.includes(unidadeId)) {
            throw new HttpsError('permission-denied', 'Você só autua processos em unidade onde está lotado');
        }
        const ritoSnap = await db.collection(COL.ritos).doc(String(p.rito_id || '_')).get();
        const rito = ritoSnap.data();
        if (!ritoSnap.exists || !rito || rito.organization_id !== orgId || rito.ativo === false) {
            throw new HttpsError('invalid-argument', 'Escolha um rito ativo');
        }
        const ano = new Date().getFullYear();
        const contadorRef = db.collection(COL.contadores).doc(`${orgId}_${ano}`);
        const procRef = db.collection(COL.processos).doc();
        const numero = await db.runTransaction(async (tx) => {
            const cont = await tx.get(contadorRef);
            const seq = (Number(cont.data()?.seq) || 0) + 1;
            tx.set(contadorRef, { organization_id: orgId, ano, seq }, { merge: true });
            const numero = numeroProcesso(ano, seq);
            const fases = rito.fases as Fase[];
            const base = {
                organization_id: orgId,
                numero,
                assunto,
                descricao: texto(p.descricao, MAX_TEXTO_LONGO),
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
                created_at: FieldValue.serverTimestamp(),
                mov_seq: 0,
                doc_seq: 0,
                ultimo_hash: '',
                version: 0,
                pendencias: [],
                prazos: [],
                ...derivados([], []),
            };
            const mov = registrarMovimento(tx, c, procRef, base, 'autuacao',
                `Processo autuado na unidade ${unidade.nome}, rito ${rito.nome} (versão ${base.rito_versao}), fase ${fases[0].nome}.`,
                { assunto, rito_id: ritoSnap.id, rito_versao: base.rito_versao, unidade: unidadeId });
            tx.set(procRef, { ...base, ...mov });
            return numero;
        });
        return { success: true, id: procRef.id, numero };
    }

    // ---- Movimentações sobre um processo existente --------------------------
    const motivo = texto(p.motivo, MAX_TEXTO_LONGO);
    const convite = { token: '', email: '', parte: '', numero: '' };
    const resultado = await db.runTransaction(async (tx) => {
        const { ref, data } = await lerProcesso(c, p.id, tx);
        conferirVersao(data, p.version);
        exigirPosse(c, data);
        if (data.status === 'arquivado' && p.action !== 'alterarStatus') {
            throw new HttpsError('failed-precondition', 'Processo arquivado: reative-o antes de movimentar');
        }

        if (p.action === 'tramitar') {
            const destino = c.unidades.find((u) => u.id === p.unidade_destino && u.ativa !== false);
            if (!destino) throw new HttpsError('invalid-argument', 'Unidade de destino inválida');
            if (destino.id === data.unidade_atual) throw new HttpsError('invalid-argument', 'O processo já está nessa unidade');
            // Remessa a gabinete é conclusão: o processo vai para quem decide.
            const conclusao = destino.tipo === 'gabinete';
            const mov = registrarMovimento(tx, c, ref, data, conclusao ? 'conclusao' : 'tramitacao',
                `${conclusao ? 'Conclusos a' : 'Remetido de ' + nomeUnidade(c, data.unidade_atual) + ' para'} ${destino.nome}.${motivo ? ` Motivo: ${motivo}` : ''}`,
                { de: data.unidade_atual, para: destino.id });
            tx.update(ref, {
                ...mov,
                unidade_atual: destino.id,
                unidades_historico: FieldValue.arrayUnion(destino.id),
                responsavel_uid: null,
            });
            return mov;
        }

        if (p.action === 'atribuir') {
            const alvo = p.responsavel_uid || null;
            const unidade = c.unidades.find((u) => u.id === data.unidade_atual);
            if (alvo && !(unidade?.membros_uids || []).includes(alvo)) {
                throw new HttpsError('invalid-argument', 'A pessoa precisa estar lotada na unidade que tem o processo');
            }
            const nomeAlvo = alvo ? (await tx.get(db.collection('userOrganizations').doc(`${alvo}_${orgId}`))).data()?.user_name || 'membro' : '';
            const mov = registrarMovimento(tx, c, ref, data, 'atribuicao',
                alvo ? `Atribuído a ${nomeAlvo}.` : 'Atribuição removida.', { responsavel_uid: alvo });
            tx.update(ref, { ...mov, responsavel_uid: alvo });
            return mov;
        }

        if (p.action === 'avancarFase') {
            const fases = (data.fases || []) as Fase[];
            const alvo = p.fase_id
                ? fases.find((f) => f.id === p.fase_id)
                : proximaFase({ nome: '', descricao: '', fases }, data.fase_atual);
            if (!alvo) throw new HttpsError('invalid-argument', 'Não há fase seguinte; escolha uma fase do rito');
            if (alvo.id === data.fase_atual) throw new HttpsError('invalid-argument', 'O processo já está nessa fase');
            if (data.fase_suspensa === true) {
                throw new HttpsError('failed-precondition', 'A fase está interrompida por pendência aberta. O decisor precisa apreciá-la antes.');
            }
            const de = fases.find((f) => f.id === data.fase_atual)?.nome || data.fase_atual;
            const mov = registrarMovimento(tx, c, ref, data, 'fase',
                `Fase alterada de ${de} para ${alvo.nome}.${motivo ? ` ${motivo}` : ''}`, { de: data.fase_atual, para: alvo.id });
            tx.update(ref, { ...mov, fase_atual: alvo.id });
            return mov;
        }

        if (p.action === 'alterarStatus') {
            const status = String(p.status || '');
            if (!['em_tramitacao', 'sobrestado', 'arquivado'].includes(status)) {
                throw new HttpsError('invalid-argument', 'Situação inválida');
            }
            if (status === data.status) throw new HttpsError('invalid-argument', 'O processo já está nessa situação');
            if (!motivo) throw new HttpsError('invalid-argument', 'Informe o motivo');
            const rotulo = { em_tramitacao: 'Reativado', sobrestado: 'Sobrestado', arquivado: 'Arquivado' }[status];
            const mov = registrarMovimento(tx, c, ref, data, 'situacao', `${rotulo}. Motivo: ${motivo}`, { de: data.status, para: status });
            tx.update(ref, { ...mov, status });
            return mov;
        }

        // ---- Pendências: o que o decisor precisa apreciar --------------------
        const pendencias = (data.pendencias || []) as Pendencia[];
        const prazos = (data.prazos || []) as Prazo[];
        const agora = new Date().toISOString();

        if (p.action === 'abrirPendencia') {
            const descricao = texto(p.descricao, MAX_TEXTO_LONGO);
            if (!descricao) throw new HttpsError('invalid-argument', 'Descreva o que precisa ser apreciado');
            if (pendencias.length >= MAX_ITENS) throw new HttpsError('resource-exhausted', 'Limite de pendências do processo');
            const nova: Pendencia = {
                id: ref.collection('_').doc().id, tipo: 'manual', descricao, interrompe: p.interrompe === true,
                status: 'aberta', aberta_em: agora, aberta_por: c.userName,
            };
            const lista = [...pendencias, nova];
            const mov = registrarMovimento(tx, c, ref, data, 'pendencia',
                `Pendência aberta para o decisor: ${descricao}${nova.interrompe ? ' (fase interrompida)' : ''}.`, { pendencia_id: nova.id, interrompe: nova.interrompe });
            tx.update(ref, { ...mov, pendencias: lista, ...derivados(lista, prazos) });
            return mov;
        }

        if (p.action === 'resolverPendencia') {
            // Apreciar é ato de decisão: só o gabinete que tem o processo.
            if (c.unidades.find((u) => u.id === data.unidade_atual)?.tipo !== 'gabinete') {
                throw new HttpsError('permission-denied', 'Pendências são apreciadas pelo gabinete. Faça a conclusão do processo antes.');
            }
            const alvo = pendencias.find((x) => x.id === p.pendencia_id && x.status === 'aberta');
            if (!alvo) throw new HttpsError('not-found', 'Pendência aberta não encontrada');
            const resolucao = texto(p.resolucao, MAX_TEXTO_LONGO);
            if (!resolucao) throw new HttpsError('invalid-argument', 'Registre a decisão sobre a pendência');
            const lista = pendencias.map((x) => (x.id === alvo.id
                ? { ...x, status: 'resolvida' as const, resolvida_em: agora, resolvida_por: c.userName, resolucao }
                : x));
            const der = derivados(lista, prazos);
            const mov = registrarMovimento(tx, c, ref, data, 'pendencia_resolvida',
                `Pendência apreciada (${alvo.descricao}): ${resolucao}${alvo.interrompe && !der.fase_suspensa ? ' Fase retomada.' : ''}`,
                { pendencia_id: alvo.id });
            tx.update(ref, { ...mov, pendencias: lista, ...der });
            return mov;
        }

        // ---- Prazos -----------------------------------------------------------
        if (p.action === 'abrirPrazo') {
            const descricao = texto(p.descricao, MAX_TEXTO_LONGO);
            const dias = Number(p.dias);
            const contagem: Contagem = p.contagem === 'corridos' ? 'corridos' : 'uteis';
            if (!descricao) throw new HttpsError('invalid-argument', 'Descreva o prazo');
            if (!Number.isInteger(dias) || dias < 1 || dias > MAX_PRAZO_DIAS) throw new HttpsError('invalid-argument', 'Informe os dias do prazo');
            if (prazos.length >= MAX_ITENS) throw new HttpsError('resource-exhausted', 'Limite de prazos do processo');
            const inicio = hojeBrasil();
            const novo: Prazo = {
                id: ref.collection('_').doc().id, descricao, destinatario: texto(p.destinatario), dias, contagem,
                inicio, vence_em: calcularVencimento(inicio, dias, contagem), status: 'aberto',
                aberto_em: agora, aberto_por: c.userName,
            };
            const lista = [...prazos, novo];
            const mov = registrarMovimento(tx, c, ref, data, 'prazo',
                `Prazo de ${dias} dias ${contagem === 'uteis' ? 'úteis' : 'corridos'} aberto: ${descricao}${novo.destinatario ? ` (${novo.destinatario})` : ''}. Vence em ${novo.vence_em.split('-').reverse().join('/')}.`,
                { prazo_id: novo.id, vence_em: novo.vence_em });
            tx.update(ref, { ...mov, prazos: lista, ...derivados(pendencias, lista) });
            return mov;
        }

        if (p.action === 'encerrarPrazo') {
            const alvo = prazos.find((x) => x.id === p.prazo_id && x.status === 'aberto');
            if (!alvo) throw new HttpsError('not-found', 'Prazo aberto não encontrado');
            const res = p.resultado === 'cancelado' ? 'cancelado' : 'cumprido';
            const hoje = hojeBrasil();
            const lista = prazos.map((x) => (x.id === alvo.id ? { ...x, status: res as Prazo['status'], encerrado_em: hoje, encerrado_por: c.userName } : x));
            const quando = res === 'cumprido' ? (hoje <= alvo.vence_em ? ' no prazo' : ' fora do prazo') : '';
            const mov = registrarMovimento(tx, c, ref, data, 'prazo_encerrado',
                `Prazo ${res}${quando}: ${alvo.descricao}.${motivo ? ` ${motivo}` : ''}`, { prazo_id: alvo.id, resultado: res });
            tx.update(ref, { ...mov, prazos: lista, ...derivados(pendencias, lista) });
            return mov;
        }

        if (p.action === 'convidarParte' || p.action === 'revogarParte') {
            const idx = Number(p.parte_idx);
            const partes = [...(data.partes || [])];
            const parte = partes[idx];
            if (!Number.isInteger(idx) || !parte) throw new HttpsError('invalid-argument', 'Parte inválida');
            // Convite anterior ainda não usado deixa de valer em qualquer dos dois casos.
            if (parte.convite_hash) tx.set(db.collection(COL.convites).doc(parte.convite_hash), { revogado: true }, { merge: true });
            if (p.action === 'revogarParte') {
                const { uid: antigo, convite_hash: _c, ...resto } = parte;
                partes[idx] = resto;
                const mov = registrarMovimento(tx, c, ref, data, 'acesso_revogado',
                    `Acesso de ${parte.nome} (${parte.polo}) ao portal das partes revogado.`, { parte_idx: idx });
                tx.update(ref, { ...mov, partes, ...(antigo ? { partes_uids: FieldValue.arrayRemove(antigo) } : {}) });
                return mov;
            }
            if (parte.uid) throw new HttpsError('failed-precondition', 'Esta parte já acompanha o processo. Revogue o acesso antes de convidar de novo.');
            const email = texto(p.email, 120) || parte.email || '';
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'E-mail inválido');
            convite.token = randomBytes(24).toString('base64url');
            convite.email = email;
            convite.parte = parte.nome;
            convite.numero = data.numero;
            const hash = sha256(convite.token);
            tx.set(db.collection(COL.convites).doc(hash), {
                organization_id: orgId, processo_id: ref.id, parte_idx: idx, parte_nome: parte.nome, email,
                criado_por: c.ctx.uid, criado_em: new Date().toISOString(),
                expira_em: new Date(Date.now() + CONVITE_DIAS * 86400000).toISOString(), usado_por: null, revogado: false,
            });
            partes[idx] = { ...parte, convite_hash: hash, ...(email ? { email } : {}) };
            const mov = registrarMovimento(tx, c, ref, data, 'convite',
                `${parte.nome} (${parte.polo}) convidado a acompanhar o processo pelo portal das partes${email ? ' (convite por e-mail)' : ''}.`, { parte_idx: idx });
            tx.update(ref, { ...mov, partes });
            return mov;
        }

        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    });
    if (convite.token) {
        const link = `${APP_URL}/Portal?convite=${convite.token}`;
        const enviado = convite.email ? await sendEmail({
            to: convite.email,
            subject: `Convite para acompanhar o processo ${convite.numero}`,
            html: `<p>Olá, ${escapar(convite.parte)}.</p><p>Você foi habilitado a acompanhar o processo <b>${escapar(convite.numero)}</b> e a peticionar nele pelo portal das partes.</p><p><a href="${link}">Aceitar o convite</a> (vale por ${CONVITE_DIAS} dias).</p><p>Entre com sua conta Google ou crie uma senha. Se você não esperava este e-mail, ignore-o.</p>`,
        }).catch(() => false) : false;
        return { success: true, version: resultado.version, link, emailEnviado: enviado };
    }
    return { success: true, version: resultado.version };
});
