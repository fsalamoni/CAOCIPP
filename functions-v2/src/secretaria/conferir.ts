import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Pendencia, Prazo, derivados, hojeBrasil, lotacoesDe, somarDias } from '../shared/secretaria';
import { ALERTA_PADRAO } from '../shared/efeitosFase';
import { marcasDoDestino } from '../shared/exigencias';
import { prazosEmAlerta, vencidosATratar } from '../shared/prazosFase';
import { sendEmail } from '../shared/email';
import { APP_URL, normalizarCodigo } from './autos';
import { COL, Contexto, REGION, registrarMovimento } from './context';
import { lembrarPrazosDasPartes } from './portalAvisos';
import { enviarResumosDiarios, notificarPessoas, prefDe } from './avisosEquipe';
import { certificarDecursos, cienciaPorDecurso } from './comunicacoes';
import { avancarSozinho } from './processos';
import { contextoDoSistema } from './context';
import { encerrarSessoesVirtuais } from './votacao';
import { lembrarSessoes } from './painelAta';
import { avisarPartesDoMovimento } from './portalAvisos';

export const CONFERENCIAS_POR_HORA = 60;

/**
 * Chamada pública: no máximo `limite` por hora por endereço de rede (guardado
 * só como hash). Freia quem tenta adivinhar códigos sem atrapalhar quem confere.
 */
async function limitarPorHora(chave: string, origem: string, limite: number) {
    const db = admin.firestore();
    const hora = new Date().toISOString().slice(0, 13);
    const id = `${chave}_${createHash('sha256').update(origem || 'sem-origem').digest('hex').slice(0, 32)}_${hora}`;
    const ref = db.collection(COL.limites).doc(id);
    const n = await db.runTransaction(async (tx) => {
        const atual = Number((await tx.get(ref)).data()?.n || 0) + 1;
        tx.set(ref, { n: atual, expira_em: Timestamp.fromMillis(Date.now() + 2 * 3600 * 1000) });
        return atual;
    });
    if (n > limite) throw new HttpsError('resource-exhausted', 'Muitas consultas seguidas deste endereço. Tente de novo daqui a uma hora.');
}

/**
 * Conferência pública (sem login) de um documento juntado pelo código
 * impresso nas folhas. Responde só os dados da juntada: quem tem o código
 * tem o próprio documento.
 */
export const secretariaConferir = onCall<{ codigo?: string }>({ region: REGION }, async (request) => {
    const ip = String(request.rawRequest?.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || request.rawRequest?.ip || '';
    await limitarPorHora('conferir', ip, CONFERENCIAS_POR_HORA);
    const codigo = normalizarCodigo(request.data?.codigo);
    if (!codigo) throw new HttpsError('invalid-argument', 'Código inválido. Ele tem 16 letras e números, no formato XXXX-XXXX-XXXX-XXXX.');
    const v = (await admin.firestore().collection(COL.verificacao).doc(codigo).get()).data();
    if (!v) throw new HttpsError('not-found', 'Nenhum documento com este código.');
    return {
        codigo,
        orgao: v.orgao, numero: v.numero, ordem: v.ordem, titulo: v.titulo, tipo: v.tipo, origem: v.origem,
        nome_arquivo: v.nome_arquivo, juntado_em: v.juntado_em, juntado_por: v.juntado_por,
        folha_inicial: v.folha_inicial, folha_final: v.folha_final, paginas: v.paginas,
        assinaturas: v.assinaturas || [], sha256: v.sha256, pdf_sha256: v.pdf_sha256, peticao: v.peticao === true,
    };
});

const escapar = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const br = (iso: string) => iso.split('-').reverse().join('/');
export const DIAS_ALERTA = ALERTA_PADRAO;

/**
 * Prazo aberto pela fase que venceu sem ser cumprido, quando o rito diz o que
 * fazer: marca o processo como urgente e avisa quem gere a unidade. Uma vez
 * por prazo (`vencido_tratado_em`). O registro é interno: prazo interno não vai
 * às partes. Devolve os prazos tratados, para o aviso.
 */
export async function tratarVencidos(db: admin.firestore.Firestore, ref: admin.firestore.DocumentReference, hoje: string): Promise<{ proc: admin.firestore.DocumentData; prazos: Prazo[] } | null> {
    return db.runTransaction(async (tx) => {
        const proc = (await tx.get(ref)).data();
        if (!proc || proc.status !== 'em_tramitacao') return null;
        const vencidos = vencidosATratar(proc.prazos, hoje);
        if (!vencidos.length) return null;
        const prazos = ((proc.prazos || []) as Prazo[]).map((x) => (vencidos.some((v) => v.id === x.id) ? { ...x, vencido_tratado_em: hoje } : x));
        const urgencia = vencidos.some((x) => (x.ao_vencer as { urgente?: unknown }).urgente === true) && proc.urgente !== true;
        const gestores = vencidos.some((x) => (x.ao_vencer as { avisar_gestores?: unknown }).avisar_gestores === true);
        const c: Contexto = { db, orgId: String(proc.organization_id), org: {}, ctx: { uid: 'sistema', isAdmin: false, unidadeIds: [] }, userName: 'Sistema', unidades: [], gestorDe: [] };
        const mov = registrarMovimento(tx, c, ref, proc, 'efeitos_fase',
            `${vencidos.map((x) => `Prazo vencido em ${br(x.vence_em)} sem cumprimento: ${x.descricao}.`).join(' ')} Pela regra do rito: ${[urgencia && 'o processo passa a tramitar com urgência', gestores && 'quem gere a unidade foi avisado'].filter(Boolean).join(' e ') || 'o processo já tramitava com urgência'}.`,
            { automatico: true, prazos: vencidos.map((x) => x.id), ...marcasDoDestino('informacao') });
        tx.update(ref, {
            ...mov, prazos, ...derivados((proc.pendencias || []) as Pendencia[], prazos),
            ...(urgencia ? { urgente: true, urgencia: { motivo: `Prazo vencido em ${br(vencidos[0].vence_em)}: ${vencidos[0].descricao}`, por: 'Regra do rito', em: new Date().toISOString() } } : {}),
        });
        return { proc, prazos: vencidos.filter((x) => (x.ao_vencer as { avisar_gestores?: unknown }).avisar_gestores === true) };
    });
}

/**
 * O prazo de resposta que o rito espera decorreu sem manifestação: certidão de
 * decurso (as partes são avisadas), ações do rito acertadas e, se a fase segue
 * sozinha, o avanço pela regra do rito.
 */
export async function respostasPorDecurso(db: admin.firestore.Firestore, hoje = hojeBrasil()): Promise<number> {
    // ponytail: até 1000 por dia (os que esperam resposta são poucos); paginar se passar disso.
    const snap = await db.collection(COL.processos).where('aguarda_resposta', '==', true).limit(1000).get();
    const sistemas = new Map<string, Promise<Contexto | null>>();
    let certidoes = 0;
    for (const d of snap.docs) {
        const r = await certificarDecursos(db, d.ref, hoje).catch((e) => { console.warn('[comunicacoes] decurso não certificado', d.id, e); return null; });
        if (!r) continue;
        certidoes += 1;
        if (r.movimentos) await avisarPartesDoMovimento(db, d.id, undefined, r.movimentos).catch(() => undefined);
        if (!r.avancar) continue;
        if (!sistemas.has(r.orgId)) sistemas.set(r.orgId, contextoDoSistema(db, r.orgId));
        const c = await sistemas.get(r.orgId);
        if (c) await avancarSozinho(c, d.id);
    }
    return certidoes;
}

/**
 * Todo dia às 7h: para os órgãos que ligaram o alerta, avisa por e-mail os
 * lotados na unidade que tem o processo sobre prazos vencidos ou que vencem
 * em até 2 dias. Um e-mail por pessoa, com a lista.
 */
export const secretariaAlertaPrazos = onSchedule(
    { schedule: 'every day 07:00', timeZone: 'America/Sao_Paulo', region: REGION },
    async () => {
        const db = admin.firestore();
        // Antes dos alertas: a ciência por decurso abre prazos que entram neles.
        await cienciaPorDecurso(db).catch((e) => console.warn('[comunicacoes] ciência por decurso falhou', e));
        await respostasPorDecurso(db).catch((e) => console.warn('[comunicacoes] decurso do prazo de resposta falhou', e));
        // S7: sessões virtuais cuja votação terminou: o sistema apura e encerra.
        await encerrarSessoesVirtuais(db).catch((e) => console.warn('[sessoes] encerramento das sessões virtuais falhou', e));
        await lembrarSessoes(db).catch((e) => console.warn('[sessoes] lembretes das sessões falharam', e));
        const hoje = hojeBrasil();
        const limite = somarDias(hoje, DIAS_ALERTA);
        // Só campo único em faixa: dispensa índice composto.
        const snap = await db.collection(COL.processos).where('proximo_vencimento', '<=', limite).limit(2000).get();
        // Prazos com antecedência maior que a padrão (a fase do rito pede): o dia do alerta deles já chegou.
        const antecipados = await db.collection(COL.processos).where('proximo_alerta', '<=', hoje).limit(2000).get();
        const todos = [...snap.docs, ...antecipados.docs.filter((d) => !snap.docs.some((x) => x.id === d.id))];
        const porOrg = new Map<string, admin.firestore.QueryDocumentSnapshot[]>();
        await lembrarPrazosDasPartes(db, snap.docs.filter((d) => d.data().status === 'em_tramitacao')).catch(() => undefined);
        for (const d of todos) {
            if (d.data().status !== 'em_tramitacao') continue;
            const org = String(d.data().organization_id);
            porOrg.set(org, [...(porOrg.get(org) || []), d]);
        }
        for (const [orgId, procs] of porOrg) {
            const [cfg, org] = await Promise.all([db.collection(COL.config).doc(orgId).get(), db.collection('organizations').doc(orgId).get()]);
            const sc = org.data()?.secretariaConfig || {};
            if (sc.enabled !== true || sc.suspensa_plataforma === true) continue;
            const unidades = new Map((await db.collection(COL.unidades).where('organization_id', '==', orgId).get()).docs.map((u) => [u.id, u.data()]));
            // Regra do vencimento (do rito): vale mesmo com o alerta por e-mail do órgão desligado.
            for (const p of procs) {
                if (!vencidosATratar(p.data().prazos, hoje).length) continue;
                const t = await tratarVencidos(db, p.ref, hoje).catch((e) => { console.warn('[prazos] regra do vencimento falhou', p.id, e); return null; });
                const u = t?.prazos.length ? unidades.get(t.proc.unidade_atual) : null;
                if (!t || !u) continue;
                const gestores = lotacoesDe(u).filter((l) => l.gestor).map((l) => l.uid).filter((uid) => !(t.proc.partes_uids || []).includes(uid));
                await notificarPessoas(db, orgId, gestores, {
                    subtipo: 'prazo', procId: p.id,
                    titulo: `Prazo vencido no processo ${t.proc.numero}`,
                    mensagem: t.prazos.map((x) => `Venceu em ${br(x.vence_em)}: ${x.descricao}`).join(' · ').slice(0, 300),
                    html: `<p>No processo <b>${escapar(String(t.proc.numero))}</b> (${escapar(String(t.proc.assunto || ''))}), que está com ${escapar(String(u.nome || 'a sua unidade'))}, venceu sem cumprimento:</p><ul>${t.prazos.map((x) => `<li>${escapar(String(x.descricao))}, em ${br(x.vence_em)}</li>`).join('')}</ul><p>O rito manda avisar quem gere a unidade.</p>`,
                });
            }
            if (cfg.data()?.alerta_prazos !== true) continue;
            const porPessoa = new Map<string, string[]>();
            const sinoPorPessoa = new Map<string, Array<{ id: string; numero: string; venc: string }>>();
            for (const p of procs) {
                const d = p.data();
                // Só o prazo que já pede alerta: vencido ou dentro da antecedência dele (a da fase, ou 2 dias).
                const emAlerta = prazosEmAlerta(d.prazos, hoje);
                if (!emAlerta.length) continue;
                const venc = emAlerta[0].vence_em;
                const linha = `<li><b>${escapar(String(d.numero))}</b> — ${escapar(String(d.assunto || ''))}: prazo ${venc < hoje ? `<b>vencido em ${br(venc)}</b>` : `vence em ${br(venc)}`}</li>`;
                for (const uid of ((unidades.get(d.unidade_atual)?.membros_uids || []) as string[]).filter((u) => !(d.partes_uids || []).includes(u))) {
                    porPessoa.set(uid, [...(porPessoa.get(uid) || []), linha]);
                    sinoPorPessoa.set(uid, [...(sinoPorPessoa.get(uid) || []), { id: p.id, numero: String(d.numero), venc }]);
                }
            }
            // Sino: um aviso por processo com prazo vencendo ou vencido (sem e-mail, que vai abaixo).
            for (const [uid, itens] of sinoPorPessoa) {
                // O sino avisa até o dia seguinte ao vencimento; depois, só o e-mail diário lista o atraso.
                for (const it of itens.filter((x) => x.venc >= somarDias(hoje, -1)).slice(0, 20)) {
                    await notificarPessoas(db, orgId, [uid], {
                        subtipo: 'prazo', procId: it.id, soSino: true,
                        titulo: `Prazo ${it.venc < hoje ? 'vencido' : 'vencendo'} no processo ${it.numero}`,
                        mensagem: `${it.venc < hoje ? 'Venceu' : 'Vence'} em ${br(it.venc)}`, html: '',
                    });
                }
            }
            for (const [uid, linhas] of porPessoa) {
                const [memSnap, prefSnap] = await Promise.all([
                    db.collection('userOrganizations').doc(`${uid}_${orgId}`).get(),
                    db.collection('userPreferences').doc(uid).get(),
                ]);
                const mem = memSnap.data();
                const email = mem?.user_email;
                // Quem escolheu "Nenhum e-mail" fica só com o sino; vínculo desativado não recebe nada.
                if (!email || mem?.active === false || prefDe(prefSnap.data()?.notificationPreferences).email === 'nenhum') continue;
                await sendEmail({
                    to: String(email),
                    subject: `Processo Eletrônico: ${linhas.length} prazo(s) vencendo ou vencido(s)`,
                    html: `<p>Processos com a sua unidade em ${escapar(String(org.data()?.name || ''))}:</p><ul>${linhas.slice(0, 50).join('')}</ul>${linhas.length > 50 ? `<p>… e mais ${linhas.length - 50}.</p>` : ''}<p><a href="${APP_URL}/ProcessoEletronico?org=${orgId}">Abrir o Processo Eletrônico</a></p><p style="color:#64748b;font-size:12px">O administrador do órgão liga ou desliga este aviso em Painel Administrativo → Processo Eletrônico → Calendário.</p>`,
                }).catch(() => false);
            }
        }
        await enviarResumosDiarios(db);
    },
);
