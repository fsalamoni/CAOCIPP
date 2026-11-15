/**
 * Disputa de preços (S11): o certame da ação `pede: 'disputa'` do rito.
 *
 * Órgão, pelas ações `certame*` de secretariaProcesso (lê quem vê o processo;
 * escreve quem tem o processo consigo e pode cumprir a ação):
 *   certameLer        o certame da ação pendente (ou o último), com o aviso;
 *   certameSalvar     monta ou corrige o aviso em rascunho;
 *   certamePublicar   publica (aviso nos autos, link e código para fornecedores);
 *   certameAdiar      adia a abertura, com motivo (nos autos e por e-mail);
 *   certameCancelar   cancela, com motivo (a ação volta a pedir uma disputa);
 *   certameConvidar   convida fornecedor por e-mail (cotação privada, ou divulgação na dispensa);
 *   certameRevogarConvite;
 *   certamePropostas  depois da abertura: as propostas classificadas (sem lances).
 *
 * Fornecedor, pelas ações `disputa*` de secretariaPortal (qualquer conta):
 *   disputaMinhas, disputaAviso, disputaConvite, disputaParticipar,
 *   disputaProposta, disputaRetirar.
 *
 * O certame mora em `secCertames` (fora do processo, porque o fornecedor não é
 * parte e não vê os autos); a proposta, em `secCertames/{id}/propostas/{uid}`,
 * que ninguém do órgão lê antes da abertura. Regras do Firestore fecham tudo.
 */
import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { CalendarioOrgao, Fase, hojeBrasil, sanitizeCalendario, sha256, texto } from '../shared/secretaria';
import { acaoAtiva, respostasDaFase } from '../shared/exigencias';
import { podeQuem, textoQuem } from '../shared/permissoesFase';
import {
    ConviteCertame, DadosCertame, DECLARACOES, ItemProposta, Licitante, MAX_CONVITES, MAX_FORNECEDORES, PERFIS_DISPUTA, PerfilDisputa, Proposta,
    SITUACOES_CERTAME, SituacaoCertame, aberturaMinima, alertasDaProposta, codigoDoAviso, instanteDaAbertura, problemasParaPublicar,
    sanitizeDadosCertame, sanitizeLicitante, sanitizeProposta, textoDoAviso, unidadesDeDisputa, valorEstimado, valorNaUnidade,
    fimDosLances, momentoDaDisputa, valorTexto,
} from '../shared/certames';
import { ACOES_SALA_FORNECEDOR, ACOES_SALA_ORGAO, acaoSalaFornecedor, acaoSalaOrgao, lerEstado } from './salaLances';
import { sendEmail } from '../shared/email';
import { auditar } from './config';
import { COL, Contexto, atorDe, erroUsuario, exigirPosse, lerProcesso, registrarMovimento } from './context';

export const COL_CERTAMES = 'secCertames';
const COL_ACESSOS = 'secPortalAcessos';
export const ACOES_CERTAME = ['certameLer', 'certameSalvar', 'certamePublicar', 'certameAdiar', 'certameCancelar', 'certameConvidar', 'certameRevogarConvite', 'certamePropostas', ...ACOES_SALA_ORGAO];
export const ACOES_FORNECEDOR = ['disputaMinhas', 'disputaAviso', 'disputaConvite', 'disputaParticipar', 'disputaProposta', 'disputaRetirar', ...ACOES_SALA_FORNECEDOR];
const APP_URL = process.env.APP_URL || 'https://sigo-caocipp.web.app';
const escapar = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const CONVITE_DIAS = 60;
type Payload = Record<string, unknown>;

export type Certame = DadosCertame & {
    organization_id: string; orgao_nome: string; processo_id: string; processo_numero: string; unidade_id: string; unidade_nome: string;
    fase_id: string; acao_idx: number; acao: string; perfil: PerfilDisputa; situacao: SituacaoCertame;
    codigo?: string; abertura_em?: string; publicado_em?: string; criado_em: string; criado_por: { uid: string; nome: string };
    convites: ConviteCertame[]; convites_hashes?: string[]; fornecedores_uids: string[]; propostas_n: number;
    adiamentos?: Array<{ de: string; para: string; motivo: string; em: string; por: string }>;
    cancelado?: { motivo: string; em: string; por: string };
    version: number;
};
/** O que o processo guarda do certame (para a tela e para não haver dois na mesma ação). */
export interface CertameNoProcesso { id: string; situacao: SituacaoCertame; perfil: PerfilDisputa; fase_id: string; acao_idx: number; abertura_em?: string; codigo?: string; resultado?: string }

const brData = (s: string) => s.split('-').reverse().join('/');
const quando = (iso: string) => {
    const d = new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString();
    return `${brData(d.slice(0, 10))}, às ${d.slice(11, 16)}`;
};
const linkDoAviso = (codigo: string) => `${APP_URL}/Disputas?c=${codigo}`;

/** A ação `disputa` da fase atual que ainda pede o certame (ou a do certame em curso). */
function acaoDaDisputa(proc: admin.firestore.DocumentData, idx?: number) {
    const fase = ((proc.fases || []) as Fase[]).find((f) => f.id === proc.fase_atual);
    if (!fase) return null;
    const feitas = ((proc.acoes_feitas || {}) as Record<string, number[]>)[fase.id] || [];
    const resp = respostasDaFase(proc);
    const lista = (fase.acoes_regras || []).map((r, i) => ({ r, i }))
        .filter(({ r, i }) => r?.pede === 'disputa' && !feitas.includes(i) && acaoAtiva(fase, i, resp) && (idx === undefined || i === idx));
    const a = lista[0];
    return a ? { fase, idx: a.i, regra: a.r!, acao: fase.acoes?.[a.i] || 'Disputa de preços' } : null;
}

async function calendario(db: admin.firestore.Firestore, orgId: string): Promise<CalendarioOrgao> {
    return sanitizeCalendario((await db.collection(COL.config).doc(orgId).get()).data()?.calendario) as CalendarioOrgao;
}

function semSegredos(id: string, x: Certame) {
    const { convites, fornecedores_uids: _f, convites_hashes: _h, ...resto } = x;
    return { id, ...resto, convites: (convites || []).map(({ hash: _h, uid: _u, ...v }) => ({ ...v, aceito: !!v.aceito_em })), situacao_nome: SITUACOES_CERTAME[x.situacao] };
}

/** Aviso para o fornecedor: só o que é público (sem convites, sem e-mails, sem valor estimado se sigiloso). */
function avisoPublico(id: string, x: Certame) {
    return {
        id, perfil: x.perfil, perfil_nome: PERFIS_DISPUTA[x.perfil], orgao_nome: x.orgao_nome, unidade_nome: x.unidade_nome, processo_numero: x.processo_numero,
        situacao: x.situacao, situacao_nome: SITUACOES_CERTAME[x.situacao], objeto: x.objeto, criterio: x.criterio, unidade_disputa: x.unidade_disputa,
        itens: x.itens.map((i) => (x.orcamento_sigiloso ? { ...i, valor_estimado: undefined } : i)),
        orcamento_sigiloso: x.orcamento_sigiloso, intervalo: x.intervalo, lances: x.lances, horas_lances: x.horas_lances,
        abertura_data: x.abertura_data, abertura_hora: x.abertura_hora, abertura_em: x.abertura_em, condicoes: x.condicoes, habilitacao: x.habilitacao,
        participacao: x.perfil === 'cotacao' ? 'convidados' : 'aberta', codigo: x.codigo, adiamentos: (x.adiamentos || []).map(({ por: _p, ...a }) => a),
        cancelado: x.cancelado ? { motivo: x.cancelado.motivo, em: x.cancelado.em } : undefined,
        fim_lances: fimDosLances(x), momento: x.situacao === 'publicado' ? momentoDaDisputa(x, new Date().toISOString()) : null,
    };
}

export async function acaoCertame(c: Contexto, p: Payload): Promise<unknown> {
    if (ACOES_SALA_ORGAO.includes(String(p.action))) return acaoSalaOrgao(c, p, (data) => (data.certame as CertameNoProcesso | undefined)?.id || null);
    const quem = { uid: c.ctx.uid, nome: c.userName };
    const col = c.db.collection(COL_CERTAMES);

    if (p.action === 'certameLer' || p.action === 'certamePropostas') {
        const { ref, data } = await lerProcesso(c, p.processo_id);
        const atual = data.certame as CertameNoProcesso | undefined;
        const alvo = acaoDaDisputa(data);
        const posse = c.ctx.unidadeIds.includes(data.unidade_atual);
        const podeCumprir = !!alvo && (!alvo.regra.quem || podeQuem(alvo.regra.quem, alvo.regra.atribuicao, atorDe(c, data)));
        const cal = await calendario(c.db, c.orgId);
        const hoje = hojeBrasil();
        const snap = atual ? await col.doc(atual.id).get() : null;
        const x = snap?.exists ? (snap.data() as Certame) : null;
        if (p.action === 'certamePropostas') {
            if (!x || !atual) throw new HttpsError('not-found', 'Disputa não encontrada');
            if (!x.abertura_em || x.abertura_em > new Date().toISOString() || x.situacao === 'cancelado' || x.situacao === 'rascunho') {
                throw new HttpsError('failed-precondition', 'As propostas são sigilosas até a abertura');
            }
            if (x.lances) {
                if (momentoDaDisputa(x, new Date().toISOString()) !== 'encerrada') throw new HttpsError('failed-precondition', 'Os lances ainda estão em curso: a classificação sai no fim');
                return classificacaoComLances(c, ref, atual.id, x);
            }
            const ps = await col.doc(atual.id).collection('propostas').get();
            const propostas = ps.docs.map((d) => d.data() as Proposta);
            const desc = x.criterio === 'maior_desconto';
            return {
                unidades: unidadesDeDisputa(x).map((u) => ({
                    chave: u.chave, nome: u.nome,
                    classificacao: propostas.map((pr) => ({ fornecedor: pr.licitante.razao_social, documento: pr.licitante.documento, porte: pr.licitante.porte, valor: valorNaUnidade(pr, u, x.criterio), enviada_em: pr.atualizada_em }))
                        .filter((v) => v.valor != null)
                        // Empate: vale quem registrou antes (IN 67/2021, art. 12, § 1º).
                        .sort((a, b) => (desc ? b.valor! - a.valor! : a.valor! - b.valor!) || a.enviada_em.localeCompare(b.enviada_em)),
                })),
            };
        }
        return {
            processo: { id: ref.id, numero: data.numero || '', assunto: data.assunto || '' },
            acao: alvo ? { fase_id: alvo.fase.id, acao_idx: alvo.idx, nome: alvo.acao, perfil: alvo.regra.disputa?.perfil || 'cotacao' } : null,
            certame: x && atual ? { ...semSegredos(atual.id, x), aviso: textoDoAviso(x.perfil, x, x.processo_numero, x.unidade_nome), valor_estimado: valorEstimado(x.itens), link: x.codigo ? linkDoAviso(x.codigo) : null } : null,
            abertura_minima: aberturaMinima((x?.perfil || alvo?.regra.disputa?.perfil || 'cotacao') as PerfilDisputa, hoje, cal),
            hoje,
            agora: new Date().toISOString(),
            momento: x && x.situacao === 'publicado' ? momentoDaDisputa(x, new Date().toISOString()) : null,
            declaracoes: DECLARACOES.map(([id, t, o]) => ({ id, texto: t, obrigatoria: o })),
            pode: {
                editar: posse && podeCumprir && (!x || x.situacao === 'rascunho' || x.situacao === 'cancelado'),
                gerir: posse && !!x && !!atual && (x.situacao === 'publicado' || x.situacao === 'rascunho') && (!x.abertura_em || x.abertura_em > new Date().toISOString()),
            },
            motivo: !alvo && !x ? 'A fase atual não tem ação de disputa de preços pendente.' : !posse ? 'O processo não está com uma unidade em que você esteja lotado.' : !podeCumprir && alvo?.regra.quem ? `A disputa é de ${textoQuem(alvo.regra.quem, alvo.regra.atribuicao)}.` : '',
        };
    }

    let email: { id: string; uids: string[]; assunto: string; corpo: string } | null = null;
    let convite: { token: string; email: string; nome: string; certame: Certame } | null = null;
    const r = await c.db.runTransaction(async (tx) => {
        const { ref, data } = await lerProcesso(c, p.processo_id, tx);
        exigirPosse(c, data);
        const atual = data.certame as CertameNoProcesso | undefined;
        const cref = atual ? col.doc(atual.id) : null;
        const x = cref ? ((await tx.get(cref)).data() as Certame | undefined) : undefined;
        const agora = new Date().toISOString();
        const viva = x && x.situacao !== 'cancelado' ? x : undefined;

        if (p.action === 'certameSalvar') {
            const alvo = acaoDaDisputa(data, viva ? viva.acao_idx : undefined);
            if (!alvo) throw new HttpsError('failed-precondition', 'A fase atual não tem ação de disputa de preços pendente');
            if (alvo.regra.quem && !podeQuem(alvo.regra.quem, alvo.regra.atribuicao, atorDe(c, data))) {
                throw new HttpsError('permission-denied', `"${alvo.acao}" é de ${textoQuem(alvo.regra.quem, alvo.regra.atribuicao)}.`);
            }
            if (viva && viva.situacao !== 'rascunho') throw new HttpsError('failed-precondition', 'A disputa já foi publicada: o aviso não muda (adie ou cancele, se for o caso)');
            const perfil = (alvo.regra.disputa?.perfil || 'cotacao') as PerfilDisputa;
            let dados: DadosCertame | null = null;
            try { dados = sanitizeDadosCertame(p.dados, perfil); } catch (e) { erroUsuario(e); }
            if (viva && cref) {
                tx.update(cref, { ...dados!, version: (viva.version || 0) + 1, atualizado_em: agora });
                return { ok: true, certame_id: cref.id };
            }
            const nref = col.doc();
            const un = (await tx.get(c.db.collection(COL.unidades).doc(String(data.unidade_atual)))).data();
            const novo: Certame = {
                ...dados!, organization_id: c.orgId, orgao_nome: String(c.org.name || ''), processo_id: ref.id, processo_numero: String(data.numero || ''),
                unidade_id: String(data.unidade_atual), unidade_nome: String(un?.nome || ''), fase_id: alvo.fase.id, acao_idx: alvo.idx, acao: alvo.acao,
                perfil, situacao: 'rascunho', criado_em: agora, criado_por: quem, convites: [], fornecedores_uids: [], propostas_n: 0, version: 1,
            };
            tx.set(nref, novo);
            const resumo: CertameNoProcesso = { id: nref.id, situacao: 'rascunho', perfil, fase_id: alvo.fase.id, acao_idx: alvo.idx };
            tx.update(ref, { certame: resumo });
            return { ok: true, certame_id: nref.id, auditoria: 'SECRETARIA_SESSAO_DISPUTA_CRIADA' };
        }

        if (!viva || !cref || !atual) throw new HttpsError('not-found', 'Monte a disputa antes');
        const aberta = !!viva.abertura_em && viva.abertura_em <= agora;

        if (p.action === 'certamePublicar') {
            if (viva.situacao !== 'rascunho') throw new HttpsError('failed-precondition', 'A disputa já foi publicada');
            const cal = sanitizeCalendario((await tx.get(c.db.collection(COL.config).doc(c.orgId))).data()?.calendario) as CalendarioOrgao;
            const falta = problemasParaPublicar(viva, viva.perfil, hojeBrasil(), cal);
            if (falta.length) throw new HttpsError('failed-precondition', `Antes de publicar: ${falta.join('; ')}`);
            const codigo = codigoDoAviso(randomBytes(8));
            const abertura_em = instanteDaAbertura(viva);
            tx.update(cref, { situacao: 'publicado', codigo, abertura_em, publicado_em: agora, publicado_por: quem, version: viva.version + 1 });
            const aviso = textoDoAviso(viva.perfil, viva, viva.processo_numero, viva.unidade_nome);
            const mov = registrarMovimento(tx, c, ref, data, 'disputa_publicada',
                `Aviso de ${PERFIS_DISPUTA[viva.perfil].toLowerCase()} publicado. Propostas até ${quando(abertura_em)}${viva.perfil === 'dispensa' ? `, pelo link público ${linkDoAviso(codigo)}` : ', pelos fornecedores convidados'}.\n${aviso}`,
                { certame_id: cref.id, codigo });
            tx.update(ref, { ...mov, certame: { ...atual, situacao: 'publicado', abertura_em, codigo } });
            return { ok: true, codigo, link: linkDoAviso(codigo), auditoria: 'SECRETARIA_SESSAO_DISPUTA_PUBLICADA' };
        }

        if (p.action === 'certameAdiar') {
            if (viva.situacao !== 'publicado' || aberta) throw new HttpsError('failed-precondition', 'Só se adia a abertura de disputa publicada, antes da abertura');
            const motivo = texto(p.motivo, 1000);
            if (motivo.length < 5) throw new HttpsError('invalid-argument', 'Diga o motivo do adiamento (ao menos 5 letras)');
            let novos: DadosCertame | null = null;
            try { novos = sanitizeDadosCertame({ ...viva, abertura_data: p.abertura_data, abertura_hora: p.abertura_hora }, viva.perfil); } catch (e) { erroUsuario(e); }
            const para = instanteDaAbertura(novos!);
            if (para <= viva.abertura_em!) throw new HttpsError('invalid-argument', 'A nova abertura precisa ser depois da atual');
            const cal = sanitizeCalendario((await tx.get(c.db.collection(COL.config).doc(c.orgId))).data()?.calendario) as CalendarioOrgao;
            const falta = problemasParaPublicar(novos!, viva.perfil, hojeBrasil(), cal).filter((f) => /abertura/.test(f));
            if (falta.length) throw new HttpsError('failed-precondition', falta.join('; '));
            const adiamentos = [...(viva.adiamentos || []), { de: viva.abertura_em!, para, motivo, em: agora, por: quem.nome }];
            tx.update(cref, { abertura_data: novos!.abertura_data, abertura_hora: novos!.abertura_hora, abertura_em: para, adiamentos, version: viva.version + 1 });
            const mov = registrarMovimento(tx, c, ref, data, 'disputa_adiada',
                `Abertura da ${PERFIS_DISPUTA[viva.perfil].toLowerCase()} adiada de ${quando(viva.abertura_em!)} para ${quando(para)}: ${motivo.replace(/[.\s]+$/, '')}.`, { certame_id: cref.id });
            tx.update(ref, { ...mov, certame: { ...atual, abertura_em: para } });
            email = { id: cref.id, uids: viva.fornecedores_uids || [], assunto: `Abertura adiada: ${viva.objeto.slice(0, 60)}`, corpo: `A abertura da disputa do processo ${viva.processo_numero} foi adiada para ${quando(para)} (horário de Brasília). Motivo: ${motivo}` };
            return { ok: true, auditoria: 'SECRETARIA_SESSAO_DISPUTA_ADIADA' };
        }

        if (p.action === 'certameCancelar') {
            if (aberta && viva.situacao !== 'rascunho') throw new HttpsError('failed-precondition', 'A disputa já foi aberta: o desfecho sai pelo julgamento');
            const motivo = texto(p.motivo, 1000);
            if (viva.situacao !== 'rascunho' && motivo.length < 5) throw new HttpsError('invalid-argument', 'Diga o motivo do cancelamento (ao menos 5 letras)');
            if (viva.situacao === 'rascunho') {
                // Rascunho não chegou a ninguém: some sem deixar rastro nos autos.
                tx.delete(cref);
                tx.update(ref, { certame: FieldValue.delete() });
                return { ok: true };
            }
            tx.update(cref, { situacao: 'cancelado', cancelado: { motivo, em: agora, por: quem.nome }, version: viva.version + 1 });
            const mov = registrarMovimento(tx, c, ref, data, 'disputa_cancelada',
                `${PERFIS_DISPUTA[viva.perfil]} cancelada antes da abertura: ${motivo.replace(/[.\s]+$/, '')}.`, { certame_id: cref.id });
            tx.update(ref, { ...mov, certame: FieldValue.delete() });
            email = { id: cref.id, uids: viva.fornecedores_uids || [], assunto: `Disputa cancelada: ${viva.objeto.slice(0, 60)}`, corpo: `A disputa do processo ${viva.processo_numero} foi cancelada. Motivo: ${motivo}` };
            return { ok: true, auditoria: 'SECRETARIA_SESSAO_DISPUTA_CANCELADA' };
        }

        if (p.action === 'certameConvidar') {
            if (viva.situacao !== 'publicado' || aberta) throw new HttpsError('failed-precondition', 'Convida-se depois de publicar o aviso e antes da abertura');
            const nome = texto(p.nome, 200);
            const em = texto(p.email, 120).toLowerCase();
            if (nome.length < 3) throw new HttpsError('invalid-argument', 'Informe o nome do fornecedor');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new HttpsError('invalid-argument', 'E-mail inválido');
            const ativos = (viva.convites || []).filter((v) => !v.revogado);
            if (ativos.length >= MAX_CONVITES) throw new HttpsError('failed-precondition', `Até ${MAX_CONVITES} convites por disputa`);
            if (ativos.some((v) => v.email === em)) throw new HttpsError('already-exists', 'Este e-mail já foi convidado');
            const token = randomBytes(24).toString('base64url');
            const v: ConviteCertame = { id: c.db.collection('_').doc().id, nome, email: em, hash: sha256(token), criado_em: agora };
            tx.update(cref, { convites: [...(viva.convites || []), v], convites_hashes: FieldValue.arrayUnion(v.hash) });
            convite = { token, email: em, nome, certame: viva };
            return { ok: true, convite_id: v.id };
        }

        if (p.action === 'certameRevogarConvite') {
            const lista = [...(viva.convites || [])];
            const k = lista.findIndex((v) => v.id === p.convite_id);
            if (k < 0) throw new HttpsError('not-found', 'Convite não encontrado');
            if (lista[k].aceito_em) throw new HttpsError('failed-precondition', 'O fornecedor já aceitou o convite: a participação dele fica');
            lista[k] = { ...lista[k], revogado: true };
            tx.update(cref, { convites: lista });
            return { ok: true };
        }
        throw new HttpsError('invalid-argument', 'Ação desconhecida');
    });
    const { auditoria, ...resto } = r as { auditoria?: string } & Record<string, unknown>;
    if (auditoria) await auditar(c.db, c.orgId, quem.uid, quem.nome, auditoria, { processo_id: p.processo_id });
    const e = email as { id: string; uids: string[]; assunto: string; corpo: string } | null;
    if (e) void avisarPorEmail(c.db, e.id, e.uids, e.assunto, e.corpo);
    const cv = convite as { token: string; email: string; nome: string; certame: Certame } | null;
    if (cv) {
        const link = `${APP_URL}/Disputas?convite=${cv.token}`;
        const enviado = await sendEmail({
            to: cv.email,
            subject: `Convite para ${PERFIS_DISPUTA[cv.certame.perfil].toLowerCase()}: ${cv.certame.objeto.slice(0, 80)}`,
            html: `<p>Olá, ${escapar(cv.nome)}.</p><p>${escapar(cv.certame.orgao_nome || 'O órgão')} convida você a enviar proposta para <b>${escapar(cv.certame.objeto)}</b> (processo ${escapar(cv.certame.processo_numero)}).</p><p>Propostas até ${escapar(quando(cv.certame.abertura_em!))} (horário de Brasília).</p><p><a href="${link}">Ver o aviso e enviar a proposta</a> (o convite vale por ${CONVITE_DIAS} dias).</p><p>Entre com sua conta Google ou crie uma senha. Se você não esperava este e-mail, ignore-o.</p>`,
        }).catch(() => false);
        return { ...resto, link, emailEnviado: enviado };
    }
    return resto;
}

/**
 * Classificação depois da fase de lances: as posições finais da sala, com os
 * nomes. Na primeira leitura depois do fim, registra nos autos o encerramento
 * dos lances (melhor oferta de cada item ou lote, sem nomes: o julgamento os dá).
 */
async function classificacaoComLances(c: Contexto, pref: admin.firestore.DocumentReference, id: string, x0: Certame) {
    const ref = c.db.collection(COL_CERTAMES).doc(id);
    return c.db.runTransaction(async (tx) => {
        const [x, pdata] = await Promise.all([tx.get(ref).then((s) => (s.data() as Certame) || x0), tx.get(pref).then((s) => s.data()!)]);
        const { estado: e, novo } = await lerEstado(c.db, ref, x, tx);
        const ps = await tx.get(ref.collection('propostas'));
        const props = new Map(ps.docs.map((d) => [d.id, d.data() as Proposta]));
        const unidades = unidadesDeDisputa(x).map((u) => ({
            chave: u.chave, nome: u.nome,
            classificacao: (e.posicoes[u.chave] || []).map((v) => {
                const pr = props.get(v.uid);
                return { fornecedor: pr?.licitante.razao_social || `Licitante ${e.apelidos[v.uid]}`, documento: pr?.licitante.documento || '', porte: pr?.licitante.porte, valor: v.total, lance: v.valor, por_lance: v.seq > 0, enviada_em: v.em };
            }),
        }));
        if (!e.encerramento_registrado) {
            const linhas = unidades.map((u) => {
                const n = (e.posicoes[u.chave] || []).length;
                return `${u.nome}: ${u.classificacao[0] ? `melhor oferta ${valorTexto(u.classificacao[0].valor, x)}` : 'sem oferta'} (${n} licitante${n === 1 ? '' : 's'}).`;
            });
            const mov = registrarMovimento(tx, c, pref, pdata, 'disputa_lances_encerrados',
                `Encerrada a fase de lances da ${PERFIS_DISPUTA[x.perfil].toLowerCase()} em ${quando(fimDosLances(x)!)}, com ${e.seq} lance${e.seq === 1 ? '' : 's'}.\n${linhas.join('\n')}`, { certame_id: id });
            tx.update(pref, mov);
            e.encerramento_registrado = true;
            tx.set(ref.collection('sala').doc('estado'), e);
        } else if (novo) tx.set(ref.collection('sala').doc('estado'), e);
        return { unidades, lances: e.seq };
    });
}

/** E-mail a quem participa (fora da transação; a falha de envio não desfaz o ato). */
async function avisarPorEmail(db: admin.firestore.Firestore, certameId: string, uids: string[], assunto: string, corpo: string) {
    if (!uids.length) return;
    const props = await db.getAll(...uids.slice(0, MAX_FORNECEDORES).map((u) => db.collection(COL_CERTAMES).doc(certameId).collection('participantes').doc(u)));
    const emails = [...new Set(props.map((d) => String(d.data()?.email || '')).filter(Boolean))];
    await Promise.all(emails.map((to) => sendEmail({ to, subject: assunto, html: `<p>${escapar(corpo)}</p><p><a href="${APP_URL}/Disputas?d=${certameId}">Abrir a disputa</a></p>` }).catch(() => false)));
}

// ─── Fornecedor ────────────────────────────────────────────────────────────

const orgaoAtivo = (o: admin.firestore.DocumentData | undefined) => o?.secretariaConfig?.enabled === true && o?.secretariaConfig?.suspensa_plataforma !== true;

async function lerCertame(db: admin.firestore.Firestore, id: unknown, tx?: admin.firestore.Transaction) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new HttpsError('invalid-argument', 'Disputa inválida');
    const ref = db.collection(COL_CERTAMES).doc(id);
    const snap = tx ? await tx.get(ref) : await ref.get();
    const x = snap.data() as Certame | undefined;
    if (!x || x.situacao === 'rascunho') throw new HttpsError('not-found', 'Disputa não encontrada');
    const org = (await db.collection('organizations').doc(x.organization_id).get()).data();
    if (!orgaoAtivo(org)) throw new HttpsError('failed-precondition', 'O Processo Eletrônico deste órgão está desativado');
    return { ref, x };
}

/** Quem participa e o que mandou. `participantes/{uid}` guarda o e-mail da conta (para avisos) e o cadastro. */
async function minhaParte(ref: admin.firestore.DocumentReference, uid: string, tx?: admin.firestore.Transaction) {
    const [pa, pr] = tx ? await Promise.all([tx.get(ref.collection('participantes').doc(uid)), tx.get(ref.collection('propostas').doc(uid))])
        : await Promise.all([ref.collection('participantes').doc(uid).get(), ref.collection('propostas').doc(uid).get()]);
    return { participante: pa.data() as { email: string; desde: string } | undefined, proposta: pr.data() as Proposta | undefined };
}

export async function acaoFornecedor(db: admin.firestore.Firestore, auth: { uid: string; token: Record<string, unknown> }, p: Payload): Promise<unknown> {
    const uid = auth.uid;
    const emailConta = String(auth.token.email || '');
    const agora = () => new Date().toISOString();
    if (ACOES_SALA_FORNECEDOR.includes(String(p.action))) return acaoSalaFornecedor(db, uid, p, lerCertame);

    if (p.action === 'disputaMinhas') {
        const snap = await db.collection(COL_CERTAMES).where('fornecedores_uids', 'array-contains', uid).limit(200).get();
        const perfil = (await db.collection(COL_ACESSOS).doc(uid).get()).data()?.fornecedor || null;
        return {
            perfil,
            disputas: snap.docs.map((d) => avisoPublico(d.id, d.data() as Certame))
                .sort((a, b) => String(b.abertura_em || '').localeCompare(String(a.abertura_em || ''))),
        };
    }

    if (p.action === 'disputaAviso') {
        let id = p.certame_id;
        if (typeof p.codigo === 'string') {
            const cod = p.codigo.trim().toUpperCase();
            if (!/^[A-Z0-9]{8}$/.test(cod)) throw new HttpsError('invalid-argument', 'Código do aviso inválido');
            const q = await db.collection(COL_CERTAMES).where('codigo', '==', cod).limit(1).get();
            if (q.empty) throw new HttpsError('not-found', 'Aviso não encontrado');
            id = q.docs[0].id;
        }
        const { ref, x } = await lerCertame(db, id);
        const participa = (x.fornecedores_uids || []).includes(uid);
        // Cotação privada: só quem foi convidado vê o aviso.
        if (x.perfil === 'cotacao' && !participa) throw new HttpsError('not-found', 'Aviso não encontrado');
        const { proposta } = participa ? await minhaParte(ref, uid) : { proposta: undefined };
        const perfil = (await db.collection(COL_ACESSOS).doc(uid).get()).data()?.fornecedor || null;
        const aberta = !!x.abertura_em && x.abertura_em <= agora();
        return {
            aviso: avisoPublico(ref.id, x), participa, proposta: proposta || null, perfil, agora: agora(),
            alertas: proposta ? alertasDaProposta(proposta, x) : [],
            declaracoes: DECLARACOES.map(([i, t, o]) => ({ id: i, texto: t, obrigatoria: o })),
            pode: { participar: !participa && x.perfil === 'dispensa' && x.situacao === 'publicado' && !aberta, propor: participa && x.situacao === 'publicado' && !aberta },
        };
    }

    if (p.action === 'disputaConvite') {
        const token = String(p.convite || '');
        if (token.length < 20) throw new HttpsError('invalid-argument', 'Convite inválido');
        const hash = sha256(token);
        const q = await db.collection(COL_CERTAMES).where('convites_hashes', 'array-contains', hash).limit(1).get();
        const alvo = q.docs[0];
        if (!alvo) throw new HttpsError('not-found', 'Convite inválido');
        return db.runTransaction(async (tx) => {
            const { ref, x } = await lerCertame(db, alvo.id, tx);
            const lista = [...(x.convites || [])];
            const k = lista.findIndex((v) => v.hash === hash);
            const v = lista[k];
            if (!v || v.revogado) throw new HttpsError('failed-precondition', 'Este convite foi revogado');
            if (v.uid && v.uid !== uid) throw new HttpsError('failed-precondition', 'Este convite já foi usado por outra conta');
            if (!v.uid && Date.parse(v.criado_em) + CONVITE_DIAS * 86400e3 < Date.now()) throw new HttpsError('deadline-exceeded', 'Convite vencido. Peça um novo ao órgão.');
            if (x.situacao === 'cancelado') throw new HttpsError('failed-precondition', 'Esta disputa foi cancelada');
            if (!v.uid) {
                lista[k] = { ...v, uid, aceito_em: agora() };
                tx.update(ref, { convites: lista, fornecedores_uids: FieldValue.arrayUnion(uid) });
                tx.set(ref.collection('participantes').doc(uid), { email: emailConta || v.email, desde: agora(), convite_id: v.id });
            }
            return { ok: true, certame_id: ref.id };
        });
    }

    if (p.action === 'disputaParticipar') {
        return db.runTransaction(async (tx) => {
            const { ref, x } = await lerCertame(db, p.certame_id, tx);
            if (x.perfil !== 'dispensa') throw new HttpsError('permission-denied', 'Esta disputa é só para convidados');
            if (x.situacao !== 'publicado' || (x.abertura_em && x.abertura_em <= agora())) throw new HttpsError('failed-precondition', 'O prazo de propostas terminou');
            if ((x.fornecedores_uids || []).includes(uid)) return { ok: true, certame_id: ref.id };
            if ((x.fornecedores_uids || []).length >= MAX_FORNECEDORES) throw new HttpsError('resource-exhausted', 'A disputa chegou ao limite de participantes');
            tx.update(ref, { fornecedores_uids: FieldValue.arrayUnion(uid) });
            tx.set(ref.collection('participantes').doc(uid), { email: emailConta, desde: agora() });
            return { ok: true, certame_id: ref.id };
        });
    }

    if (p.action === 'disputaProposta' || p.action === 'disputaRetirar') {
        const r = await db.runTransaction(async (tx) => {
            const { ref, x } = await lerCertame(db, p.certame_id, tx);
            if (!(x.fornecedores_uids || []).includes(uid)) throw new HttpsError('permission-denied', 'Participe da disputa antes de enviar proposta');
            if (x.situacao !== 'publicado' || !x.abertura_em || x.abertura_em <= agora()) throw new HttpsError('failed-precondition', 'O prazo de propostas terminou');
            const { proposta } = await minhaParte(ref, uid, tx);
            const pref = ref.collection('propostas').doc(uid);
            if (p.action === 'disputaRetirar') {
                if (!proposta) throw new HttpsError('not-found', 'Você não tem proposta nesta disputa');
                tx.delete(pref);
                tx.update(ref, { propostas_n: FieldValue.increment(-1) });
                return { ok: true, retirada: true };
            }
            let lic: Licitante | null = null;
            let conteudo: { itens: ItemProposta[]; declaracoes: string[] } | null = null;
            try {
                lic = sanitizeLicitante(p.licitante, emailConta);
                conteudo = sanitizeProposta(p.proposta, x, lic);
            } catch (e) { erroUsuario(e); }
            const nova: Proposta = { licitante: lic!, ...conteudo!, enviada_em: proposta?.enviada_em || agora(), atualizada_em: agora() };
            tx.set(pref, nova);
            if (!proposta) tx.update(ref, { propostas_n: FieldValue.increment(1) });
            // O cadastro fica para preencher a próxima disputa.
            tx.set(db.collection(COL_ACESSOS).doc(uid), { fornecedor: lic, updated_at: agora() }, { merge: true });
            return { ok: true, recibo: { em: nova.atualizada_em, itens: nova.itens.length, codigo: sha256(JSON.stringify(nova)).slice(0, 12).toUpperCase() }, alertas: alertasDaProposta(nova, x) };
        });
        return r;
    }
    throw new HttpsError('invalid-argument', 'Ação desconhecida');
}
