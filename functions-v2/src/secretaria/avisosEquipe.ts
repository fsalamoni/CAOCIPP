import * as admin from 'firebase-admin';
import { lotacoesDe } from '../shared/secretaria';
import { sendEmail } from '../shared/email';
import { APP_URL } from './autos';
import { Contexto } from './context';

/**
 * Avisos por e-mail à equipe. Chamados depois da transação (nunca dentro) e
 * sempre engolindo falhas: e-mail que não sai não desfaz o ato.
 */

const escapar = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const linkProcesso = (orgId: string, procId: string) => `${APP_URL}/ProcessoEletronico?org=${orgId}&p=${procId}`;

/** E-mails dos membros do órgão com os uids dados (lidos de userOrganizations). */
async function emailsDe(c: Contexto, uids: string[]): Promise<Array<{ uid: string; email: string; nome: string }>> {
    const out: Array<{ uid: string; email: string; nome: string }> = [];
    const refs = [...new Set(uids)].map((uid) => c.db.collection('userOrganizations').doc(`${uid}_${c.orgId}`));
    if (!refs.length) return out;
    for (const s of await c.db.getAll(...refs)) {
        const m = s.data();
        if (m && m.active !== false && m.user_email) out.push({ uid: String(m.user_id || s.id.split('_')[0]), email: String(m.user_email), nome: String(m.user_name || m.user_email) });
    }
    return out;
}

/** Processo chegou na unidade: avisa quem está lotado nela (menos quem remeteu). */
export async function avisarUnidadeRecebeu(c: Contexto, unidadeId: string, proc: admin.firestore.DocumentData, procId: string, motivo: string): Promise<void> {
    try {
        const unidade = c.unidades.find((u) => u.id === unidadeId);
        if (!unidade) return;
        const uids = lotacoesDe(unidade).map((l) => l.uid).filter((uid) => uid !== c.ctx.uid);
        for (const { email, nome } of await emailsDe(c, uids)) {
            await sendEmail({
                to: email,
                subject: `Processo ${proc.numero} chegou em ${unidade.nome}`,
                html: `<p>Olá, ${escapar(nome)}.</p><p>${escapar(c.userName)} remeteu o processo <b>${escapar(String(proc.numero))}</b> (${escapar(String(proc.assunto || ''))}) para <b>${escapar(String(unidade.nome))}</b>.</p>${motivo ? `<blockquote style="border-left:3px solid #6366f1;margin:0;padding:4px 12px;color:#1e293b">${escapar(motivo)}</blockquote>` : ''}<p><a href="${linkProcesso(c.orgId, procId)}">Abrir o processo</a></p>`,
            }).catch(() => false);
        }
    } catch { /* aviso é cortesia */ }
}

/** Alguém pediu a assinatura de uma pessoa da unidade numa minuta. */
export async function avisarPedidoAssinatura(c: Contexto, uid: string, proc: admin.firestore.DocumentData, procId: string, titulo: string): Promise<void> {
    try {
        for (const { email, nome } of await emailsDe(c, [uid])) {
            await sendEmail({
                to: email,
                subject: `Assinatura pedida: ${titulo} (processo ${proc.numero})`,
                html: `<p>Olá, ${escapar(nome)}.</p><p>${escapar(c.userName)} pediu a sua assinatura em <b>${escapar(titulo)}</b>, minuta do processo <b>${escapar(String(proc.numero))}</b>.</p><p><a href="${linkProcesso(c.orgId, procId)}">Abrir o processo</a> e assinar em Minutas da unidade.</p>`,
            }).catch(() => false);
        }
    } catch { /* aviso é cortesia */ }
}
