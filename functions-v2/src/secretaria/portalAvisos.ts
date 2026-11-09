import * as admin from 'firebase-admin';
import { Prazo, hojeBrasil, somarDias } from '../shared/secretaria';
import { sendEmail } from '../shared/email';
import { APP_URL } from './autos';
import { COL } from './context';
import { AVISOS_PARTE, AvisosParte, COL_ACESSOS, MOVIMENTOS_INTERNOS } from './portal';

/**
 * Avisos por e-mail às partes habilitadas no portal. Chamado depois da
 * transação que registrou o movimento (nunca dentro dela) e sempre com
 * `catch`: falha de e-mail não desfaz o ato.
 *
 * Preferência por conta (secPortalAcessos/{uid}.avisos): "tudo" (padrão),
 * "prazos" (só prazos, decisões e situação) ou "nenhum".
 */

const TIPOS_PRAZOS_DECISOES = ['prazo', 'prazo_encerrado', 'pendencia_resolvida', 'situacao', 'fase'];
const escapar = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const br = (iso: string) => iso.split('-').reverse().join('/');

interface Parte { uid?: string; nome: string; polo: string; email?: string; representantes?: Parte[] }

async function destinatarios(db: admin.firestore.Firestore, proc: admin.firestore.DocumentData, filtro: (pref: AvisosParte) => boolean) {
    // Cada conta habilitada: a parte e cada representante dela.
    const partes: Parte[] = [];
    for (const x of (proc.partes || []) as Parte[]) {
        if (x.uid) partes.push(x);
        for (const r of x.representantes || []) if (r.uid) partes.push({ ...r, polo: x.polo });
    }
    if (!partes.length) return [];
    const prefs = await db.getAll(...partes.map((x) => db.collection(COL_ACESSOS).doc(x.uid!)));
    const out: Array<{ parte: Parte; email: string }> = [];
    for (let i = 0; i < partes.length; i++) {
        const d = prefs[i].data() || {};
        const pref = (AVISOS_PARTE.includes(d.avisos) ? d.avisos : 'tudo') as AvisosParte;
        if (!filtro(pref)) continue;
        let email = String(d.email || partes[i].email || '');
        if (!email) {
            try { email = (await admin.auth().getUser(partes[i].uid!)).email || ''; } catch { email = ''; }
        }
        if (email) out.push({ parte: partes[i], email });
    }
    return out;
}

const rodape = (procId: string) => `<p><a href="${APP_URL}/Portal?p=${procId}">Abrir o processo no portal das partes</a></p><p style="color:#64748b;font-size:12px">Você recebe este aviso porque acompanha o processo pelo portal. Para mudar, abra o portal e ajuste "Avisos por e-mail".</p>`;

/** Avisa as partes sobre o último movimento público do processo. */
export async function avisarPartesDoMovimento(db: admin.firestore.Firestore, procId: string, autorUid?: string): Promise<void> {
    try {
        const ref = db.collection(COL.processos).doc(procId);
        const proc = (await ref.get()).data();
        if (!proc || !(proc.partes_uids || []).length) return;
        const seq = Number(proc.mov_seq) || 0;
        const mov = (await ref.collection('movimentos').doc(String(seq).padStart(6, '0')).get()).data();
        if (!mov || MOVIMENTOS_INTERNOS.includes(mov.tipo) || mov.dados?.visivel_partes === false) return;
        if (['convite', 'habilitacao', 'acesso_revogado'].includes(mov.tipo)) return; // já têm e-mail próprio ou não interessam
        const org = (await db.collection('organizations').doc(proc.organization_id).get()).data();
        const dest = await destinatarios(db, proc, (pref) => pref === 'tudo' || (pref === 'prazos' && TIPOS_PRAZOS_DECISOES.includes(mov.tipo)));
        for (const { parte, email } of dest) {
            if (autorUid && parte.uid === autorUid) continue; // quem peticionou não precisa do aviso do próprio ato
            await sendEmail({
                to: email,
                subject: `Processo ${proc.numero}: ${rotulo(mov.tipo)}`,
                html: `<p>Olá, ${escapar(parte.nome)}.</p><p>Novo andamento no processo <b>${escapar(String(proc.numero))}</b> (${escapar(String(org?.name || ''))}):</p><blockquote style="border-left:3px solid #6366f1;margin:0;padding:4px 12px;color:#1e293b">${escapar(String(mov.descricao))}</blockquote>${rodape(procId)}`,
            }).catch(() => false);
        }
    } catch (e) {
        console.warn('[portal] aviso às partes falhou', e);
    }
}

function rotulo(tipo: string): string {
    return ({
        juntada: 'novo documento nos autos', peticao: 'petição protocolada', fase: 'o processo mudou de fase', situacao: 'a situação do processo mudou',
        prazo: 'prazo aberto', prazo_encerrado: 'prazo encerrado', pendencia_resolvida: 'decisão registrada', autuacao: 'processo autuado',
    } as Record<string, string>)[tipo] || 'novo andamento';
}

/**
 * Lembrete de prazo às partes: 3 dias antes e no dia do vencimento, para os
 * prazos dirigidos à parte (ou sem destinatário). Roda junto do alerta diário
 * da equipe, mas não depende da preferência do órgão.
 */
export async function lembrarPrazosDasPartes(db: admin.firestore.Firestore, procs: admin.firestore.QueryDocumentSnapshot[]): Promise<void> {
    const hoje = hojeBrasil();
    const em3 = somarDias(hoje, 3);
    for (const snap of procs) {
        const proc = snap.data();
        if (!(proc.partes_uids || []).length) continue;
        const prazos = ((proc.prazos || []) as Prazo[]).filter((x) => x.status === 'aberto' && (x.vence_em === hoje || x.vence_em === em3));
        if (!prazos.length) continue;
        const dest = await destinatarios(db, proc, (pref) => pref !== 'nenhum');
        for (const { parte, email } of dest) {
            const meus = prazos.filter((x) => !x.destinatario || String(x.destinatario).toLowerCase().includes(parte.nome.toLowerCase()));
            if (!meus.length) continue;
            const linhas = meus.map((x) => `<li>${escapar(x.descricao)}: ${x.vence_em === hoje ? '<b>vence hoje</b>' : `vence em ${br(x.vence_em)}`}</li>`).join('');
            await sendEmail({
                to: email,
                subject: `Processo ${proc.numero}: prazo ${meus.some((x) => x.vence_em === hoje) ? 'vence hoje' : 'vence em 3 dias'}`,
                html: `<p>Olá, ${escapar(parte.nome)}.</p><p>Prazo no processo <b>${escapar(String(proc.numero))}</b>:</p><ul>${linhas}</ul><p>Você pode se manifestar pelo portal a qualquer momento.</p>${rodape(snap.id)}`,
            }).catch(() => false);
        }
    }
}
