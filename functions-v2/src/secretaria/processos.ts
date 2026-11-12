import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
    CalendarioOrgao, Contagem, Fase, MAX_ITENS, sanitizeCalendario, MAX_PRAZO_DIAS, MAX_TEXTO_LONGO, Pendencia, Prazo, calcularVencimento, derivados,
    fasesSeguintes, hojeBrasil, MAX_MINUTAS_REMESSA, minutaAcessivel, podeAgir, podeExcluirProcesso, podeVer, proximaFase, sanitizeOrigem, sha256, texto, verificarCadeia,
} from '../shared/secretaria';
import { auditar } from './config';
import { extrasDoEvento, urgentesPrimeiro } from '../shared/autos';
import {
    Cumpridas, RegraAcao, acoesObrigatoriasPendentes, camposAoEntrarNaFase, destinoDaAcao, destinoDoMovimento, marcasDoDestino, partesVeem,
    pedidoDaAcao, pendentesDaFase,
} from '../shared/exigencias';
import { sendEmail } from '../shared/email';
import { CampoValor, POLOS, TipoCampo, diferencasCampos, formularioDe, validarCampos, validarPadrao, valorDe, valorTexto } from '../shared/camposProcesso';
import { chaveContador, formatarNumero, identificadorSemNumero, numeracaoDe, numeracaoTipoDe } from '../shared/numeracao';
import { informacoesDoAndamento } from '../shared/informacoes';
import { avisarPartesDoMovimento } from './portalAvisos';
import { nomeOrgao } from '../shared/orgaos';
import { lerOrgaos } from './orgaos';
import { avisarPendencia, avisarUnidadeRecebeu } from './avisosEquipe';
import { configComunicacoes, expedir, tornarSemEfeito } from './comunicacoes';
import {
    COL, REGION, carregarContexto, conferirVersao, erroUsuario, exigirAdmin, exigirAuth, exigirPosse, lerProcesso,
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
        | 'abrirPendencia' | 'resolverPendencia' | 'abrirPrazo' | 'encerrarPrazo' | 'convidarParte' | 'revogarParte'
        | 'marcarAcao' | 'concluirOrientacao' | 'contadores' | 'alterarDados' | 'urgencia' | 'expedirComunicacao' | 'tornarSemEfeito'
        | 'excluir' | 'restaurar' | 'excluidos';
    /** Comunicação a expedir (espécie, texto, destinatários, prazo, meio). */
    comunicacao?: unknown;
    comunicacao_id?: string;
    /** Urgência: na autuação (com `motivo_urgencia`) e na ação `urgencia` (com `motivo`). */
    urgente?: boolean;
    motivo_urgencia?: string;
    origem?: { tipo?: string; descricao?: string };
    /** tramitar: minutas que seguem com o processo para a unidade de destino. */
    minutas?: string[];
    // listar paginado (sem `limite`, devolve até 1000 como antes)
    limite?: number;
    cursor?: number;
    // ações da fase (caixas de marcar) e orientação do gabinete ao devolver
    acao_idx?: number;
    feita?: boolean;
    /** marcarAcao: o dado que a ação pede (texto, número, data, escolha, sim ou não). */
    valor?: unknown;
    orientacao?: string;
    // portal das partes
    parte_idx?: number;
    email?: string;
    /** Convite a um representante novo da parte ({ nome, email? }). */
    representante?: unknown;
    /** Convite de novo ou revogação de um representante já listado. */
    representante_idx?: number;
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
    tipo_id?: string;
    unidade_id?: string;
    sigilo?: string;
    partes?: unknown;
    /** Valores dos campos próprios do tipo de processo: { id do campo: valor }. */
    campos?: unknown;
    // movimentações
    unidade_destino?: string;
    responsavel_uid?: string | null;
    fase_id?: string;
    status?: string;
    motivo?: string;
}

const CONVITE_DIAS = 7;
const MAX_LISTA = 5000;
const APP_URL = process.env.APP_URL || 'https://sigo-caocipp.web.app';
const escapar = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const MAX_PARTES = 50;
const MAX_REPRESENTANTES = 5;

/** Quantos números já usados a autuação pula antes de desistir. */
const MAX_PULOS = 200;

function sanitizePartes(input: unknown, polos: readonly string[] = POLOS) {
    const lista = Array.isArray(input) ? input.slice(0, MAX_PARTES) : [];
    const reserva = polos.includes('interessado') ? 'interessado' : polos[0];
    return lista
        .map((x) => {
            const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
            if (o.polo !== undefined && o.polo !== '' && !polos.includes(String(o.polo))) {
                throw new HttpsError('invalid-argument', `O polo "${String(o.polo).slice(0, 20)}" não é aceito neste tipo de processo`);
            }
            const polo = typeof o.polo === 'string' && polos.includes(o.polo) ? o.polo : reserva;
            return { nome: texto(o.nome), documento: texto(o.documento, 30), email: texto(o.email, 120), polo };
        })
        .filter((p) => p.nome);
}

/** O que o rito exige na fase atual e ainda falta: documentos e ações obrigatórias. */
function exigenciasAbertas(proc: admin.firestore.DocumentData) {
    const fase = ((proc.fases || []) as Fase[]).find((f) => f.id === proc.fase_atual);
    return [
        ...pendentesDaFase(fase, proc.exigencias_cumpridas as Cumpridas | undefined),
        ...acoesObrigatoriasPendentes(fase, (proc.acoes_feitas || {})[String(proc.fase_atual)]),
    ];
}

/**
 * Sair da fase com exigência em aberto: sem motivo, recusa; com motivo, a
 * dispensa fica no movimento (e nos autos). Devolve o que foi dispensado.
 */
function dispensarExigencias(proc: admin.firestore.DocumentData, motivo: string): string[] {
    const abertas = exigenciasAbertas(proc).map((e) => e.descricao);
    if (abertas.length && !motivo) {
        throw new HttpsError('failed-precondition', `O rito exige nesta fase: ${abertas.join('; ')}. Cumpra o que falta ou informe o motivo da dispensa.`);
    }
    return abertas;
}
const textoDispensa = (d: string[]) => (d.length ? ` Dispensado o que o rito exigia na fase: ${d.join('; ')}.` : '');

/** Valor informado ao cumprir a ação, conferido contra o que o rito pede. Lança HttpsError. */
function valorDaAcao(regra: RegraAcao | null | undefined, acao: string, bruto: unknown) {
    const pede = pedidoDaAcao(regra);
    if (pede === 'confirmar' || pede === 'documento') return null;
    const rotulo = regra?.rotulo || acao;
    const tipo = pede as TipoCampo;
    let valor: string | number | boolean | null = null;
    try { valor = valorDe({ rotulo, tipo, opcoes: regra?.opcoes || [] }, bruto); } catch (e) { erroUsuario(e); }
    if (valor === null) throw new HttpsError('invalid-argument', tipo === 'sim_nao' ? `Responda sim ou não em "${rotulo}"` : `Informe "${rotulo}"`);
    return { rotulo, tipo, valor, valor_texto: valorTexto({ tipo, valor }) };
}

function resumo(id: string, d: admin.firestore.DocumentData) {
    return {
        id,
        numero: d.numero,
        assunto: d.assunto,
        status: d.status,
        sigilo: d.sigilo,
        urgente: d.urgente === true,
        urgencia: d.urgente === true ? d.urgencia || null : null,
        fase_atual: d.fase_atual,
        fase_nome: (d.fases || []).find((f: Fase) => f.id === d.fase_atual)?.nome || d.fase_atual,
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
        comunicacoes_aguardando: d.comunicacoes_aguardando || 0,
        // Pesquisa e painéis.
        rito_id: d.rito_id || null,
        autuado_em: d.autuado_em || null,
        campos_resumo: ((d.campos || []) as CampoValor[]).map((x) => valorTexto(x)).join(' · ').slice(0, 500),
        partes_resumo: (d.partes || []).map((x: { nome?: string; documento?: string }) => [x.nome, x.documento].filter(Boolean).join(' ')).join(' · ').slice(0, 500),
        pendencia_desde: ((d.pendencias || []) as Pendencia[])
            .filter((x) => x.status === 'aberta').map((x) => String(x.aberta_em || '')).filter(Boolean).sort()[0] || null,
        // Fila de trabalho: quando chegou na unidade, pedidos de assinatura e orientação do gabinete.
        recebido_em: d.recebido_em || d.autuado_em || null,
        assinaturas_pendentes: d.assinaturas_pendentes || [],
        orientacao: d.orientacao || null,
    };
}

export const secretariaProcesso = onCall<ProcRequest>({ region: REGION }, async (request) => {
    const auth = exigirAuth(request);
    const p = request.data || ({} as ProcRequest);
    const c = await carregarContexto(auth, p.organizationId);
    const { db, orgId } = c;

    if (p.action === 'listar' && p.limite) {
        // Paginado pelo servidor: do mais recente para o mais antigo por
        // updated_at (índice organization_id + updated_at), filtrando a posse
        // e o sigilo em memória; `cursor` é o updated_at (ms) do último lido.
        const limite = Math.min(Math.max(Number(p.limite) || 50, 1), 200);
        let q = db.collection(COL.processos).where('organization_id', '==', orgId).orderBy('updated_at', 'desc');
        if (p.cursor) q = q.startAfter(Timestamp.fromMillis(Number(p.cursor)));
        const snap = await q.limit(limite).get();
        const processos = urgentesPrimeiro(snap.docs
            .filter((d) => d.data().status !== 'excluido' && podeVer(d.data() as never, c.ctx))
            .filter((d) => p.escopo !== 'caixa' || podeAgir(d.data() as never, c.ctx))
            .map((d) => resumo(d.id, d.data())));
        const ultimo = snap.docs[snap.docs.length - 1];
        return { processos, cursor: ultimo?.data().updated_at?.toMillis?.() || null, mais: snap.size === limite };
    }

    if (p.action === 'contadores') {
        // Carga por unidade (processos não arquivados) e totais, por contagem
        // no servidor: não traz documentos.
        const base = db.collection(COL.processos).where('organization_id', '==', orgId);
        const conta = async (q: admin.firestore.Query) => (await q.count().get()).data().count;
        const [total, arquivados, excluidos, porUnidade] = await Promise.all([
            conta(base),
            conta(base.where('status', '==', 'arquivado')),
            conta(base.where('status', '==', 'excluido')),
            Promise.all(c.unidades.map(async (u) => {
                const [t, a] = await Promise.all([conta(base.where('unidade_atual', '==', u.id)), conta(base.where('unidade_atual', '==', u.id).where('status', '==', 'arquivado'))]);
                return [u.id, t - a] as const;
            })),
        ]);
        return { total: total - excluidos, arquivados, ativos: total - arquivados - excluidos, por_unidade: Object.fromEntries(porUnidade) };
    }

    if (p.action === 'listar') {
        // Lista inteira (Meu trabalho, Mesa, Painel). A caixa lê só as unidades
        // da pessoa; "todos" percorre o órgão em páginas de 500. O teto evita
        // resposta grande demais e é avisado em `truncado`.
        const docs: admin.firestore.QueryDocumentSnapshot[] = [];
        const base = db.collection(COL.processos).where('organization_id', '==', orgId);
        if (p.escopo === 'caixa') {
            for (let i = 0; i < c.ctx.unidadeIds.length; i += 30) {
                docs.push(...(await base.where('unidade_atual', 'in', c.ctx.unidadeIds.slice(i, i + 30)).limit(MAX_LISTA).get()).docs);
            }
        } else {
            let q = base.orderBy('updated_at', 'desc').limit(500);
            for (;;) {
                const snap = await q.get();
                docs.push(...snap.docs);
                if (snap.size < 500 || docs.length >= MAX_LISTA) break;
                q = base.orderBy('updated_at', 'desc').startAfter(snap.docs[snap.size - 1]).limit(500);
            }
        }
        const truncado = docs.length >= MAX_LISTA;
        const lista = docs.slice(0, MAX_LISTA)
            .filter((d) => d.data().status !== 'excluido' && podeVer(d.data() as never, c.ctx))
            .filter((d) => p.escopo !== 'caixa' || podeAgir(d.data() as never, c.ctx))
            .map((d) => ({ ...resumo(d.id, d.data()), _t: d.data().updated_at?.toMillis?.() || 0 }))
            .sort((a, b) => b._t - a._t)
            .map(({ _t, ...r }) => r);
        return { processos: urgentesPrimeiro(lista), truncado };
    }

    if (p.action === 'excluidos') {
        exigirAdmin(c);
        const snap = await db.collection(COL.processos).where('organization_id', '==', orgId).where('status', '==', 'excluido').limit(500).get();
        return {
            processos: snap.docs.map((d) => {
                const x = d.data();
                return {
                    id: d.id, numero: x.numero, assunto: x.assunto, tipo_nome: x.tipo_nome || null,
                    em: x.excluido?.em || null, por: x.excluido?.por_nome || '', motivo: x.excluido?.motivo || '',
                    unidade_anterior: x.excluido?.antes?.unidade_atual || null, status_anterior: x.excluido?.antes?.status || 'em_tramitacao',
                };
            }).sort((a, b) => String(b.em).localeCompare(String(a.em))),
        };
    }

    if (p.action === 'excluir' || p.action === 'restaurar') {
        const motivo = texto(p.motivo, 500);
        if (p.action === 'excluir' && motivo.length < 5) throw new HttpsError('invalid-argument', 'Diga o motivo da exclusão (ao menos 5 letras)');
        if (p.action === 'restaurar') exigirAdmin(c);
        const ref = db.collection(COL.processos).doc(String(p.id || '_'));
        const numero = await db.runTransaction(async (tx) => {
            const snap = await tx.get(ref);
            const data = snap.data();
            if (!data || data.organization_id !== orgId) throw new HttpsError('not-found', 'Processo não encontrado');
            if (p.action === 'excluir') {
                conferirVersao(data, p.version);
                const movs = (await tx.get(ref.collection('movimentos').select('autor_uid'))).docs.map((d) => d.data());
                if (!podeExcluirProcesso(data as never, movs, c.ctx)) {
                    throw new HttpsError('permission-denied', 'Só o admin do órgão exclui este processo. Quem autuou só exclui enquanto ninguém mais agiu nele.');
                }
                const mov = registrarMovimento(tx, c, ref, data, 'exclusao', `Processo excluído. Motivo: ${motivo}`, { motivo });
                // O que tira o processo das listas, do portal e das rotinas diárias; a restauração devolve.
                const antes = {
                    status: data.status, unidade_atual: data.unidade_atual, responsavel_uid: data.responsavel_uid || null,
                    partes_uids: data.partes_uids || [], ciencia_limite: data.ciencia_limite || null, proximo_vencimento: data.proximo_vencimento || null,
                };
                tx.update(ref, {
                    ...mov, status: 'excluido', unidade_atual: '', responsavel_uid: null, partes_uids: [], ciencia_limite: null, proximo_vencimento: null,
                    excluido: { em: new Date().toISOString(), por_uid: c.ctx.uid, por_nome: c.userName, motivo, antes },
                });
                return String(data.numero);
            }
            if (data.status !== 'excluido') throw new HttpsError('failed-precondition', 'O processo não está excluído');
            const antes = data.excluido?.antes || {};
            const destinoId = String(p.unidade_destino || antes.unidade_atual || '');
            const destino = c.unidades.find((u) => u.id === destinoId && u.ativa !== false);
            if (!destino) throw new HttpsError('invalid-argument', 'A unidade de antes não está mais ativa. Escolha para qual unidade o processo volta.');
            const mov = registrarMovimento(tx, c, ref, { ...data, unidade_atual: destino.id }, 'restauracao',
                `Processo restaurado na unidade ${destino.nome}.${motivo ? ` ${motivo}` : ''}`, { unidade: destino.id, ...(motivo ? { motivo } : {}) });
            tx.update(ref, {
                ...mov, status: antes.status || 'em_tramitacao', unidade_atual: destino.id, unidades_historico: FieldValue.arrayUnion(destino.id),
                responsavel_uid: destino.id === antes.unidade_atual ? antes.responsavel_uid || null : null,
                partes_uids: antes.partes_uids || [], ciencia_limite: antes.ciencia_limite || null, proximo_vencimento: antes.proximo_vencimento || null,
                excluido: FieldValue.delete(), recebido_em: new Date().toISOString(),
            });
            return String(data.numero);
        });
        await auditar(db, orgId, c.ctx.uid, c.userName, p.action === 'excluir' ? 'SECRETARIA_PROCESSO_EXCLUIDO' : 'SECRETARIA_PROCESSO_RESTAURADO', { processo_id: ref.id, numero, motivo });
        return { success: true };
    }

    if (p.action === 'obter') {
        const { ref, data } = await lerProcesso(c, p.id);
        const [movs, docs] = await Promise.all([
            ref.collection('movimentos').orderBy('seq').get(),
            // Sem o conteúdo (pode ter imagens): só o que a lista mostra.
            ref.collection('documentos').select(
                'titulo', 'tipo', 'origem', 'status', 'mime', 'nome_arquivo', 'tamanho', 'sha256', 'ordem', 'unidade_origem',
                'autor_nome', 'criado_em', 'juntado_em', 'assinaturas', 'peticao', 'visivel_partes', 'paginas', 'folha_inicial', 'folha_final', 'codigo_verificacao',
                'assinaturas_pedidas', 'peticao_tipo', 'modelo_id', 'unidades_acesso', 'guardado_em', 'guardado_por_nome',
            ).get(),
        ]);
        const movimentos = movs.docs.map((d) => d.data());
        const posse = podeAgir(data as never, c.ctx);
        const documentos = docs.docs
            .map((d) => ({ id: d.id, ...d.data() } as admin.firestore.DocumentData))
            // Minuta só é vista pela unidade que a redigiu; juntado = autos; controle = guardado fora dos autos (toda a equipe).
            .filter((d) => d.status === 'juntado' || d.status === 'controle' || minutaAcessivel(d, c.ctx.unidadeIds))
            .map((d) => ({
                id: d.id, titulo: d.titulo, tipo: d.tipo, origem: d.origem, status: d.status,
                mime: d.mime || null, nome_arquivo: d.nome_arquivo || null, tamanho: d.tamanho || null,
                sha256: d.sha256, ordem: d.ordem || null, unidade_origem: d.unidade_origem,
                autor_nome: d.autor_nome, criado_em: d.criado_em, juntado_em: d.juntado_em || null,
                assinaturas: d.assinaturas || [], assinaturas_pedidas: d.assinaturas_pedidas || [],
                peticao: d.peticao === true, peticao_tipo: d.peticao_tipo || null, visivel_partes: d.visivel_partes !== false,
                paginas: d.paginas || null, folha_inicial: d.folha_inicial || null, folha_final: d.folha_final || null, codigo_verificacao: d.codigo_verificacao || null, modelo_id: d.modelo_id || null, unidades_acesso: d.unidades_acesso || [],
                guardado_em: d.guardado_em || null, guardado_por: d.guardado_por_nome || null,
            }))
            .sort((a, b) => (a.ordem || 1e9) - (b.ordem || 1e9) || String(a.criado_em).localeCompare(String(b.criado_em)));
        return {
            processo: {
                ...resumo(ref.id, data),
                descricao: data.descricao,
                campos: data.campos || [],
                partes: (data.partes || []).map(({ convite_hash, uid, representantes, ...x }: Record<string, unknown>) => ({
                    ...x, portal: uid ? 'ativo' : convite_hash ? 'convidado' : null,
                    representantes: ((representantes || []) as Array<Record<string, unknown>>).map(({ convite_hash: ch, uid: u, nome, email }) => ({
                        nome, email: email || null, portal: u ? 'ativo' : ch ? 'convidado' : null,
                    })),
                })),
                fases: data.fases || [],
                unidades_historico: data.unidades_historico || [],
                // A primeira unidade da lista é a que autuou (arrayUnion só acrescenta).
                unidade_autuacao: (data.unidades_historico || [])[0] || null,
                origem: data.origem || null,
                autuado_em: data.autuado_em,
                autuado_por: data.autuado_por_nome,
                pendencias: data.pendencias || [],
                prazos: data.prazos || [],
                comunicacoes: data.comunicacoes || [],
                acoes_feitas: data.acoes_feitas || {},
                exigencias_cumpridas: data.exigencias_cumpridas || {},
            },
            hoje: hojeBrasil(),
            movimentos: movimentos.map((m) => ({ ...m, ...extrasDoEvento(m as never, new Map(documentos.map((d) => [d.id, d]))) })),
            documentos,
            informacoes: informacoesDoAndamento(movimentos as never, data.fases || []),
            cadeiaQuebradaEm: verificarCadeia(movimentos as never),
            posse,
            pode_excluir: podeExcluirProcesso(data as never, movimentos as never, c.ctx),
        };
    }

    if (p.action === 'autuar') {
        let unidadeId = String(p.unidade_id || '');
        // Unidade fixa pelo tipo: a sugerida, se quem autua está lotado nela; senão a escolhida (a de quem autua).
        if (p.tipo_id) {
            const t = (await db.collection(COL.tipos).doc(String(p.tipo_id)).get()).data();
            const sugerida = String(t?.unidade_inicial || '');
            if (t?.organization_id === orgId && formularioDe(t).unidade === 'oculto' && sugerida && c.ctx.unidadeIds.includes(sugerida)
                && c.unidades.some((u) => u.id === sugerida && u.ativa !== false)) unidadeId = sugerida;
        }
        const unidade = c.unidades.find((u) => u.id === unidadeId && u.ativa !== false);
        if (!unidade) throw new HttpsError('invalid-argument', 'Escolha a unidade que autua o processo');
        if (!c.ctx.unidadeIds.includes(unidadeId)) {
            throw new HttpsError('permission-denied', 'Você só autua processos em unidade onde está lotado');
        }
        // Tipo de processo: define o rito e o sigilo padrão.
        let tipo: admin.firestore.DocumentData | null = null;
        if (p.tipo_id) {
            tipo = (await db.collection(COL.tipos).doc(String(p.tipo_id)).get()).data() || null;
            if (!tipo || tipo.organization_id !== orgId || tipo.ativo === false || tipo.excluido === true) throw new HttpsError('invalid-argument', 'Escolha um tipo de processo ativo');
            if (tipo.orgao_id && tipo.orgao_id !== (unidade.orgao_id || null)) {
                const dono = nomeOrgao(await lerOrgaos(db, orgId), tipo.orgao_id);
                // Órgão removido deixa o tipo livre; órgão existente restringe.
                if (dono) throw new HttpsError('failed-precondition', `${tipo.nome} é um tipo de processo de ${dono}. Autue por uma unidade desse órgão.`);
            }
        }
        const ritoSnap = await db.collection(COL.ritos).doc(String(tipo?.rito_id || p.rito_id || '_')).get();
        const rito = ritoSnap.data();
        if (!ritoSnap.exists || !rito || rito.organization_id !== orgId || rito.ativo === false || rito.excluido === true) {
            throw new HttpsError('invalid-argument', tipo ? 'O rito deste tipo de processo está inativo. Ajuste o tipo na Configuração.' : 'Escolha um rito ativo');
        }
        // Formulário do tipo: o que se pede, o que é obrigatório, o que não se usa e os campos próprios.
        const form = formularioDe(tipo);
        // Sigilo e urgência fora do formulário valem o que o tipo define.
        const sigilo = (form.sigilo === 'oculto' ? tipo?.sigilo_padrao : p.sigilo || tipo?.sigilo_padrao) === 'restrito' ? 'restrito' : 'normal';
        const urgente = (form.urgencia !== 'oculto' && p.urgente === true) || tipo?.urgente === true;
        const motivoUrgencia = texto(p.motivo_urgencia, MAX_TEXTO_LONGO) || (tipo?.urgente === true ? `Tipo de processo urgente (${tipo.nome})` : '');
        if (urgente && !motivoUrgencia) throw new HttpsError('invalid-argument', 'Informe o motivo da urgência');
        const assuntoInformado = form.assunto === 'oculto' ? '' : texto(p.assunto);
        const descricao = form.descricao === 'oculto' ? '' : texto(p.descricao, MAX_TEXTO_LONGO);
        const partes = form.partes === 'oculto' ? [] : sanitizePartes(p.partes, form.polos);
        const origem = form.origem === 'oculto' ? null : sanitizeOrigem(p.origem);
        let campos: CampoValor[] = [];
        try {
            validarPadrao(form, { assunto: assuntoInformado, descricao, partes, origem });
            campos = validarCampos(form, p.campos);
        } catch (e) { erroUsuario(e); }
        // Sem assunto pedido, o processo se chama pelo tipo.
        const assunto = assuntoInformado || tipo?.nome || rito.nome;
        // Numeração: a do tipo, a do órgão ou nenhuma (identificador SN-...).
        const numTipo = numeracaoTipoDe(tipo?.numeracao);
        const numeracao = numTipo.modo === 'nenhuma' ? null
            : numTipo.modo === 'propria' ? { partes: numTipo.partes! }
                : numeracaoDe((await db.collection(COL.config).doc(orgId).get()).data()?.numeracao);
        const usaOrgao = numeracao?.partes.some((x) => x.t === 'sigla_orgao' || (x.t === 'seq' && x.escopo === 'orgao'));
        const orgao = usaOrgao && unidade.orgao_id ? (await lerOrgaos(db, orgId)).find((o) => o.id === unidade.orgao_id) || null : null;
        const ctxNumero = { hoje: hojeBrasil(), tipo: tipo ? { id: String(p.tipo_id), sigla: tipo.sigla, nome: tipo.nome } : null, unidade, orgao };
        const procRef = db.collection(COL.processos).doc();
        const contadorRef = numeracao ? db.collection(COL.contadores).doc(chaveContador(orgId, numeracao, ctxNumero)) : null;
        const numero = await db.runTransaction(async (tx) => {
            let numero = identificadorSemNumero(procRef.id);
            if (numeracao && contadorRef) {
                const cont = await tx.get(contadorRef);
                let seq = (Number(cont.data()?.seq) || 0) + 1;
                // O número nunca se repete: se uma mudança de numeração fizer a
                // contagem cair num número já usado, pula para o próximo livre.
                // ponytail: até MAX_PULOS consultas; acima disso, pede ajuste da numeração.
                for (let i = 0; ; i++, seq++) {
                    numero = formatarNumero(numeracao, ctxNumero, seq);
                    const repetido = await tx.get(db.collection(COL.processos).where('organization_id', '==', orgId).where('numero', '==', numero).limit(1));
                    if (repetido.empty) break;
                    if (i >= MAX_PULOS) throw new HttpsError('failed-precondition', `Os números a partir de ${numero} já existem. Peça ao administrador para ajustar a numeração em Configuração, Tipos de processo.`);
                }
                tx.set(contadorRef, { organization_id: orgId, chave: contadorRef.id, seq, atualizado_em: new Date().toISOString() }, { merge: true });
            }
            const fases = rito.fases as Fase[];
            const base = {
                organization_id: orgId,
                numero,
                ...(numeracao ? {} : { sem_numero: true }),
                assunto,
                descricao,
                partes,
                campos,
                sigilo,
                ...(origem ? { origem } : {}),
                ...(urgente ? { urgente: true, urgencia: { motivo: motivoUrgencia, por: c.userName, em: new Date().toISOString() } } : {}),
                ...(tipo ? { tipo_id: String(p.tipo_id), tipo_nome: tipo.nome } : {}),
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
                `Processo${tipo ? ` (${tipo.nome})` : ''} autuado na unidade ${unidade.nome}, rito ${rito.nome} (versão ${base.rito_versao}), fase ${fases[0].nome}.${urgente ? ` Tramitação urgente: ${motivoUrgencia}` : ''}`,
                { assunto, rito_id: ritoSnap.id, rito_versao: base.rito_versao, unidade: unidadeId, ...(urgente ? { urgente: true } : {}), ...(origem ? { origem } : {}),
                    ...(campos.length ? { campos: Object.fromEntries(campos.map((x) => [x.rotulo, valorTexto(x)])) } : {}) });
            tx.set(procRef, { ...base, ...mov });
            return numero;
        });
        return { success: true, id: procRef.id, numero };
    }

    // ---- Movimentações sobre um processo existente --------------------------
    const motivo = texto(p.motivo, MAX_TEXTO_LONGO);
    // Feriados locais e recesso do órgão entram na contagem de prazos.
    const calendario: CalendarioOrgao | undefined = p.action === 'abrirPrazo'
        ? sanitizeCalendario((await db.collection(COL.config).doc(orgId).get()).data()?.calendario)
        : undefined;
    const cfgCom = p.action === 'expedirComunicacao' ? await configComunicacoes(db, orgId) : null;
    let expedidas = 1;
    const convite = { token: '', email: '', parte: '', numero: '', representaQuem: '' };
    let recebeu: { unidadeId: string; proc: admin.firestore.DocumentData } | null = null;
    let pendenciaAberta: { proc: admin.firestore.DocumentData; descricao: string } | null = null;
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
            // Opcional, num só ato: mudar a fase (quando a próxima corre em outra unidade)
            // e deixar uma orientação para a unidade que recebe (devolução do gabinete).
            const fases = (data.fases || []) as Fase[];
            const novaFase = p.fase_id ? fases.find((f) => f.id === p.fase_id) : null;
            if (p.fase_id && !novaFase) throw new HttpsError('invalid-argument', 'Fase inválida');
            if (novaFase && novaFase.id === data.fase_atual) throw new HttpsError('invalid-argument', 'O processo já está nessa fase');
            if (novaFase && data.fase_suspensa === true) throw new HttpsError('failed-precondition', 'A fase está interrompida por pendência aberta. O decisor precisa apreciá-la antes.');
            const foraDoFluxo = !!novaFase && !fasesSeguintes(fases, data.fase_atual).some((f) => f.id === novaFase.id);
            if (foraDoFluxo && !motivo) throw new HttpsError('invalid-argument', `${novaFase!.nome} não é a próxima fase prevista no rito. Informe o motivo.`);
            const orientacao = texto(p.orientacao, MAX_TEXTO_LONGO);
            const faseDe = fases.find((f) => f.id === data.fase_atual)?.nome || data.fase_atual;
            // Remessa entre órgãos internos: o termo diz de qual órgão para qual.
            const orgaoDe = c.unidades.find((u) => u.id === data.unidade_atual)?.orgao_id || null;
            const orgaoPara = destino.orgao_id || null;
            const entreOrgaos = orgaoDe !== orgaoPara;
            const orgaos = entreOrgaos ? await lerOrgaos(db, orgId, tx) : [];
            const com = (nome: string, orgaoId: unknown) => (nomeOrgao(orgaos, orgaoId) ? `${nomeOrgao(orgaos, orgaoId)} › ${nome}` : nome);
            // Minutas que seguem com o processo (ex.: a da assessoria para o gabinete revisar e assinar).
            const idsMinutas = [...new Set((Array.isArray(p.minutas) ? p.minutas : []).map(String))].slice(0, MAX_MINUTAS_REMESSA);
            const minutas = await Promise.all(idsMinutas.map((id) => tx.get(ref.collection('documentos').doc(id))));
            for (const s of minutas) {
                const d = s.data();
                if (!d || d.status !== 'minuta' || !minutaAcessivel(d, [String(data.unidade_atual)])) {
                    throw new HttpsError('invalid-argument', 'Só seguem com o processo minutas que estão com a unidade que remete');
                }
            }
            const dispensadas = novaFase ? dispensarExigencias(data, motivo) : [];
            // O rito pode deixar a remessa fora dos autos (ex.: distribuição a assessoria).
            // Remessa entre órgãos muda quem é competente: sempre nos autos.
            const destinoMov = entreOrgaos || dispensadas.length ? 'autos' : destinoDoMovimento(fases, data.fase_atual, novaFase?.id);
            const mov = registrarMovimento(tx, c, ref, data, conclusao ? 'conclusao' : 'tramitacao',
                `${conclusao ? 'Conclusos a' : 'Remetido de ' + com(nomeUnidade(c, data.unidade_atual), orgaoDe) + ' para'} ${com(destino.nome, orgaoPara)}.`
                + `${novaFase ? ` Fase alterada de ${faseDe} para ${novaFase.nome}${foraDoFluxo ? ' (fora do fluxo do rito)' : ''}.` : ''}`
                + `${textoDispensa(dispensadas)}${motivo ? ` Motivo: ${motivo}` : ''}${orientacao ? ` Orientação: ${orientacao}` : ''}`,
                { de: data.unidade_atual, para: destino.id, ...(entreOrgaos ? { orgao_de: orgaoDe, orgao_para: orgaoPara } : {}), ...(novaFase ? { fase_de: data.fase_atual, fase_para: novaFase.id, ...(foraDoFluxo ? { fora_do_fluxo: true } : {}) } : {}),
                    ...(dispensadas.length ? { dispensadas } : {}), ...marcasDoDestino(destinoMov), ...(idsMinutas.length ? { minutas: idsMinutas } : {}) });
            minutas.forEach((s) => tx.update(s.ref, { unidades_acesso: FieldValue.arrayUnion(destino.id) }));
            tx.update(ref, {
                ...mov,
                unidade_atual: destino.id,
                unidades_historico: FieldValue.arrayUnion(destino.id),
                responsavel_uid: null,
                recebido_em: new Date().toISOString(),
                ...(novaFase ? { fase_atual: novaFase.id, ...camposAoEntrarNaFase(data, novaFase.id) } : {}),
                orientacao: orientacao
                    ? { texto: orientacao, por: c.userName, em: new Date().toISOString(), de: nomeUnidade(c, data.unidade_atual) }
                    : FieldValue.delete(),
            });
            recebeu = { unidadeId: destino.id, proc: data };
            return mov;
        }

        if (p.action === 'alterarDados') {
            // Corrige a descrição e os campos próprios; o que mudou fica no histórico.
            const tipo = data.tipo_id ? (await tx.get(db.collection(COL.tipos).doc(String(data.tipo_id)))).data() : null;
            const form = formularioDe(tipo && tipo.organization_id === orgId ? tipo : null);
            const antes = (data.campos || []) as CampoValor[];
            const descricao = form.descricao === 'oculto' ? String(data.descricao || '') : texto(p.descricao, MAX_TEXTO_LONGO);
            let campos: CampoValor[] = [];
            try {
                validarPadrao({ ...form, assunto: 'opcional', partes: 'opcional', origem: 'opcional' }, { assunto: '', descricao, partes: [], origem: null });
                campos = validarCampos(form, p.campos);
            } catch (e) { erroUsuario(e); }
            // Campo que o tipo deixou de ter continua no processo como foi gravado.
            const idsForm = new Set(form.campos.map((x) => x.id));
            campos = [...campos, ...antes.filter((x) => !idsForm.has(x.id))];
            const mudou = diferencasCampos(antes, campos);
            if (descricao !== String(data.descricao || '')) mudou.unshift('Descrição alterada');
            if (!mudou.length) throw new HttpsError('invalid-argument', 'Nada foi alterado');
            const mov = registrarMovimento(tx, c, ref, data, 'dados',
                `Dados do processo alterados. ${mudou.join('; ')}.${motivo ? ` Motivo: ${motivo}` : ''}`.slice(0, MAX_TEXTO_LONGO),
                { campos: mudou.length, visivel_partes: false });
            tx.update(ref, { ...mov, descricao, campos });
            return mov;
        }

        if (p.action === 'concluirOrientacao') {
            if (!data.orientacao) throw new HttpsError('failed-precondition', 'Não há orientação pendente');
            const mov = registrarMovimento(tx, c, ref, data, 'orientacao_concluida',
                `Orientação de ${data.orientacao.de || 'outra unidade'} concluída: ${data.orientacao.texto}${motivo ? ` ${motivo}` : ''}`);
            tx.update(ref, { ...mov, orientacao: FieldValue.delete() });
            return mov;
        }

        if (p.action === 'marcarAcao') {
            // Caixa de marcar das ações da fase: movimento interno leve, sem documento.
            const fase = ((data.fases || []) as Fase[]).find((f) => f.id === data.fase_atual);
            const idx = Number(p.acao_idx);
            const acao = fase?.acoes?.[idx];
            if (!fase || !acao) throw new HttpsError('invalid-argument', 'Ação da fase inválida');
            const regra = fase.acoes_regras?.[idx];
            // Ação que o rito liga a um documento se cumpre na juntada (ou guardando o documento), não aqui.
            if (regra?.documento) {
                throw new HttpsError('failed-precondition', regra.documento.destino
                    ? `"${acao}" se cumpre guardando o documento no processo. Redija ou envie o documento e use "Guardar fora dos autos".`
                    : `"${acao}" se cumpre com a juntada do documento. Redija ou envie o documento e junte-o aos autos.`);
            }
            const feita = p.feita !== false;
            const feitas: Record<string, number[]> = { ...(data.acoes_feitas || {}) };
            const lista = new Set<number>(feitas[fase.id] || []);
            // Duas pessoas marcando a mesma caixa: a segunda não gera movimento repetido.
            if (lista.has(idx) === feita) throw new HttpsError('aborted', feita ? 'Esta ação já estava feita' : 'Esta ação já estava desfeita');
            // O dado que a ação pede (texto, número, data, escolha), conferido como num campo do processo.
            const dado = feita ? valorDaAcao(regra, acao, p.valor) : null;
            if (feita) lista.add(idx); else lista.delete(idx);
            feitas[fase.id] = [...lista].sort((a, b) => a - b);
            // O rito diz onde fica: certidão nos autos (com folha), evento no extrato ou só no sistema.
            const dest = destinoDaAcao(regra);
            const comDado = dado ? ` ${dado.rotulo}: ${dado.valor_texto}.` : '';
            const mov = registrarMovimento(tx, c, ref, data, 'acao_fase',
                dest === 'autos'
                    ? `Certifico que ${feita ? 'foi cumprida' : 'foi desfeita'} a providência "${acao}", da fase ${fase.nome}.${comDado}`
                    : `${feita ? 'Feita' : 'Desfeita'} a ação "${acao}" da fase ${fase.nome}.${comDado}`,
                {
                    fase_id: fase.id, acao_idx: idx, feita,
                    ...(dado ? { rotulo: dado.rotulo, tipo_valor: dado.tipo, valor: dado.valor, valor_texto: dado.valor_texto } : {}),
                    ...(dest === 'autos' ? { nos_autos: true } : {}),
                    ...(dest === 'informacao' ? { fora_impressao: true } : {}),
                    visivel_partes: partesVeem(regra),
                });
            tx.update(ref, { ...mov, acoes_feitas: feitas });
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
            // Sair do fluxo desenhado no rito é permitido, mas exige justificativa.
            const foraDoFluxo = !fasesSeguintes(fases, data.fase_atual).some((f) => f.id === alvo.id);
            if (foraDoFluxo && !motivo) throw new HttpsError('invalid-argument', `${alvo.nome} não é a próxima fase prevista no rito. Informe o motivo.`);
            const de = fases.find((f) => f.id === data.fase_atual)?.nome || data.fase_atual;
            const dispensadas = dispensarExigencias(data, motivo);
            const destinoMov = dispensadas.length ? 'autos' : destinoDoMovimento(fases, data.fase_atual, alvo.id);
            const mov = registrarMovimento(tx, c, ref, data, 'fase',
                `Fase alterada de ${de} para ${alvo.nome}${foraDoFluxo ? ' (fora do fluxo do rito)' : ''}.${textoDispensa(dispensadas)}${motivo ? ` ${motivo}` : ''}`,
                { de: data.fase_atual, para: alvo.id, ...(foraDoFluxo ? { fora_do_fluxo: true } : {}), ...(dispensadas.length ? { dispensadas } : {}), ...marcasDoDestino(destinoMov) });
            tx.update(ref, { ...mov, fase_atual: alvo.id, ...camposAoEntrarNaFase(data, alvo.id) });
            return mov;
        }

        if (p.action === 'urgencia') {
            const urgente = p.urgente === true;
            if (urgente === (data.urgente === true)) throw new HttpsError('invalid-argument', urgente ? 'O processo já está marcado como urgente' : 'O processo não está marcado como urgente');
            if (!motivo) throw new HttpsError('invalid-argument', 'Informe o motivo');
            const mov = registrarMovimento(tx, c, ref, data, 'urgencia',
                `${urgente ? 'Processo marcado como urgente' : 'Urgência retirada'}. Motivo: ${motivo}`, { urgente });
            tx.update(ref, { ...mov, urgente, urgencia: urgente ? { motivo, por: c.userName, em: new Date().toISOString() } : FieldValue.delete() });
            return mov;
        }

        // ---- Comunicações às partes (intimação, notificação...) ---------------
        if (p.action === 'expedirComunicacao') {
            if (data.status !== 'em_tramitacao') throw new HttpsError('failed-precondition', 'O processo não está em tramitação');
            const lista = (p.comunicacao as { partes_idx?: unknown[] } | undefined)?.partes_idx;
            expedidas = Array.isArray(lista) ? new Set(lista).size || 1 : 1;
            return expedir(tx, c, ref, data, p.comunicacao, cfgCom!);
        }
        if (p.action === 'tornarSemEfeito') return tornarSemEfeito(tx, c, ref, data, p.comunicacao_id, motivo);

        if (p.action === 'alterarStatus') {
            const status = String(p.status || '');
            if (!['em_tramitacao', 'sobrestado', 'arquivado'].includes(status)) {
                throw new HttpsError('invalid-argument', 'Situação inválida');
            }
            if (status === data.status) throw new HttpsError('invalid-argument', 'O processo já está nessa situação');
            if (!motivo) throw new HttpsError('invalid-argument', 'Informe o motivo');
            const rotulo = { em_tramitacao: 'Reativado', sobrestado: 'Sobrestado', arquivado: 'Arquivado' }[status];
            // Arquivar com documento exigido em aberto: o motivo vale como dispensa, e fica dito.
            const dispensadas = status === 'arquivado' ? exigenciasAbertas(data).map((e) => e.descricao) : [];
            const mov = registrarMovimento(tx, c, ref, data, 'situacao',
                `${rotulo}. Motivo: ${motivo}${dispensadas.length ? ` Documentos exigidos pelo rito não produzidos: ${dispensadas.join('; ')}.` : ''}`,
                { de: data.status, para: status, ...(dispensadas.length ? { dispensadas } : {}) });
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
            pendenciaAberta = { proc: data, descricao };
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
                inicio, vence_em: calcularVencimento(inicio, dias, contagem, calendario), status: 'aberto',
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
            // Alvo: a própria parte, um representante já listado (representante_idx)
            // ou um representante novo ({ nome, email }). Cada um tem a própria conta.
            type Rep = { nome: string; email?: string; uid?: string; convite_hash?: string };
            const reps: Rep[] = [...((parte.representantes || []) as Rep[])];
            let ridx = p.representante_idx === undefined || p.representante_idx === null ? -1 : Number(p.representante_idx);
            const novoRep = p.action === 'convidarParte' && p.representante && typeof p.representante === 'object' ? p.representante as Record<string, unknown> : null;
            if (novoRep) {
                const nome = texto(novoRep.nome, 120);
                if (!nome) throw new HttpsError('invalid-argument', 'Informe o nome do representante');
                if (reps.length >= MAX_REPRESENTANTES) throw new HttpsError('invalid-argument', `Até ${MAX_REPRESENTANTES} representantes por parte`);
                const emailRep = texto(novoRep.email, 120);
                reps.push({ nome, ...(emailRep ? { email: emailRep } : {}) });
                ridx = reps.length - 1;
            }
            const alvo: Rep = ridx >= 0 ? reps[ridx] : parte;
            if (!alvo) throw new HttpsError('invalid-argument', 'Representante inválido');
            const rotulo = ridx >= 0 ? `${alvo.nome}, representante de ${parte.nome} (${parte.polo})` : `${parte.nome} (${parte.polo})`;
            const dadosMov = { parte_idx: idx, ...(ridx >= 0 ? { representante: alvo.nome } : {}) };
            // Convite anterior ainda não usado deixa de valer em qualquer dos dois casos.
            if (alvo.convite_hash) tx.set(db.collection(COL.convites).doc(alvo.convite_hash), { revogado: true }, { merge: true });
            if (p.action === 'revogarParte') {
                const antigo = alvo.uid;
                // A parte continua no processo; sem conta nem convite, não há o que revogar.
                if (ridx < 0 && !antigo && !alvo.convite_hash) throw new HttpsError('failed-precondition', `${parte.nome} não tem acesso nem convite pendente no portal`);
                if (ridx >= 0) {
                    reps.splice(ridx, 1);
                    partes[idx] = { ...parte, representantes: reps };
                } else {
                    const { uid: _u, convite_hash: _c, ...resto } = parte;
                    partes[idx] = resto;
                }
                const mov = registrarMovimento(tx, c, ref, data, 'acesso_revogado',
                    antigo || alvo.convite_hash ? `Acesso de ${rotulo} ao portal das partes revogado.` : `${rotulo} retirado do processo.`, dadosMov);
                tx.update(ref, { ...mov, partes, ...(antigo ? { partes_uids: FieldValue.arrayRemove(antigo) } : {}) });
                return mov;
            }
            if (alvo.uid) throw new HttpsError('failed-precondition', `${ridx >= 0 ? 'Este representante' : 'Esta parte'} já acompanha o processo. Revogue o acesso antes de convidar de novo.`);
            const email = texto(p.email, 120) || alvo.email || '';
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument', 'E-mail inválido');
            convite.token = randomBytes(24).toString('base64url');
            convite.email = email;
            convite.parte = alvo.nome;
            convite.representaQuem = ridx >= 0 ? parte.nome : '';
            convite.numero = data.numero;
            const hash = sha256(convite.token);
            tx.set(db.collection(COL.convites).doc(hash), {
                organization_id: orgId, processo_id: ref.id, parte_idx: idx, parte_nome: parte.nome, email,
                representante_idx: ridx >= 0 ? ridx : null, representante_nome: ridx >= 0 ? alvo.nome : null,
                criado_por: c.ctx.uid, criado_em: new Date().toISOString(),
                expira_em: new Date(Date.now() + CONVITE_DIAS * 86400000).toISOString(), usado_por: null, revogado: false,
            });
            const atualizado = { ...alvo, convite_hash: hash, ...(email ? { email } : {}) };
            if (ridx >= 0) { reps[ridx] = atualizado; partes[idx] = { ...parte, representantes: reps }; } else partes[idx] = atualizado;
            const mov = registrarMovimento(tx, c, ref, data, 'convite',
                `${rotulo} convidado a acompanhar o processo pelo portal das partes${email ? ' (convite por e-mail)' : ''}.`, dadosMov);
            tx.update(ref, { ...mov, partes });
            return mov;
        }

        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    });
    // Partes habilitadas recebem e-mail dos movimentos públicos (fora da transação, sem travar o ato).
    void avisarPartesDoMovimento(db, String(p.id), undefined, expedidas);
    const r = recebeu as { unidadeId: string; proc: admin.firestore.DocumentData } | null;
    if (r) void avisarUnidadeRecebeu(c, r.unidadeId, r.proc, String(p.id), motivo || texto(p.orientacao, MAX_TEXTO_LONGO));
    const pa = pendenciaAberta as { proc: admin.firestore.DocumentData; descricao: string } | null;
    if (pa) void avisarPendencia(c, pa.proc, String(p.id), pa.descricao);
    if (convite.token) {
        const link = `${APP_URL}/Portal?convite=${convite.token}`;
        const enviado = convite.email ? await sendEmail({
            to: convite.email,
            subject: `Convite para acompanhar o processo ${convite.numero}`,
            html: `<p>Olá, ${escapar(convite.parte)}.</p><p>Você foi habilitado a acompanhar o processo <b>${escapar(convite.numero)}</b>${convite.representaQuem ? ` como representante de <b>${escapar(convite.representaQuem)}</b>` : ''} e a peticionar nele pelo portal das partes.</p><p><a href="${link}">Aceitar o convite</a> (vale por ${CONVITE_DIAS} dias).</p><p>Entre com sua conta Google ou crie uma senha. Se você não esperava este e-mail, ignore-o.</p>`,
        }).catch(() => false) : false;
        return { success: true, version: resultado.version, link, emailEnviado: enviado };
    }
    return { success: true, version: resultado.version };
});
