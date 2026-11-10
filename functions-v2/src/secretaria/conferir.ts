import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { hojeBrasil, somarDias } from '../shared/secretaria';
import { sendEmail } from '../shared/email';
import { APP_URL, normalizarCodigo } from './autos';
import { COL, REGION } from './context';
import { lembrarPrazosDasPartes } from './portalAvisos';
import { enviarResumosDiarios, notificarPessoas } from './avisosEquipe';
import { cienciaPorDecurso } from './comunicacoes';

/**
 * Conferência pública (sem login) de um documento juntado pelo código
 * impresso nas folhas. Responde só os dados da juntada: quem tem o código
 * tem o próprio documento.
 */
export const secretariaConferir = onCall<{ codigo?: string }>({ region: REGION }, async (request) => {
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
export const DIAS_ALERTA = 2;

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
        const hoje = hojeBrasil();
        const limite = somarDias(hoje, DIAS_ALERTA);
        // Só campo único em faixa: dispensa índice composto.
        const snap = await db.collection(COL.processos).where('proximo_vencimento', '<=', limite).limit(2000).get();
        const porOrg = new Map<string, admin.firestore.QueryDocumentSnapshot[]>();
        await lembrarPrazosDasPartes(db, snap.docs.filter((d) => d.data().status === 'em_tramitacao')).catch(() => undefined);
        for (const d of snap.docs) {
            if (d.data().status !== 'em_tramitacao') continue;
            const org = String(d.data().organization_id);
            porOrg.set(org, [...(porOrg.get(org) || []), d]);
        }
        for (const [orgId, procs] of porOrg) {
            const [cfg, org] = await Promise.all([db.collection(COL.config).doc(orgId).get(), db.collection('organizations').doc(orgId).get()]);
            const sc = org.data()?.secretariaConfig || {};
            if (cfg.data()?.alerta_prazos !== true || sc.enabled !== true || sc.suspensa_plataforma === true) continue;
            const unidades = new Map((await db.collection(COL.unidades).where('organization_id', '==', orgId).get()).docs.map((u) => [u.id, u.data()]));
            const porPessoa = new Map<string, string[]>();
            const sinoPorPessoa = new Map<string, Array<{ id: string; numero: string; venc: string }>>();
            for (const p of procs) {
                const d = p.data();
                const venc = String(d.proximo_vencimento);
                const linha = `<li><b>${escapar(String(d.numero))}</b> — ${escapar(String(d.assunto || ''))}: prazo ${venc < hoje ? `<b>vencido em ${br(venc)}</b>` : `vence em ${br(venc)}`}</li>`;
                for (const uid of ((unidades.get(d.unidade_atual)?.membros_uids || []) as string[]).filter((u) => !(d.partes_uids || []).includes(u))) {
                    porPessoa.set(uid, [...(porPessoa.get(uid) || []), linha]);
                    sinoPorPessoa.set(uid, [...(sinoPorPessoa.get(uid) || []), { id: p.id, numero: String(d.numero), venc }]);
                }
            }
            // Sino: um aviso por processo com prazo vencendo ou vencido (sem e-mail, que vai abaixo).
            for (const [uid, itens] of sinoPorPessoa) {
                for (const it of itens.slice(0, 20)) {
                    await notificarPessoas(db, orgId, [uid], {
                        subtipo: 'prazo', procId: it.id, soSino: true,
                        titulo: `Prazo ${it.venc < hoje ? 'vencido' : 'vencendo'} no processo ${it.numero}`,
                        mensagem: `${it.venc < hoje ? 'Venceu' : 'Vence'} em ${br(it.venc)}`, html: '',
                    });
                }
            }
            for (const [uid, linhas] of porPessoa) {
                const mem = (await db.collection('userOrganizations').doc(`${uid}_${orgId}`).get()).data();
                const email = mem?.user_email;
                if (!email) continue;
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
