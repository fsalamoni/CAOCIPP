import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { REGION, assertPlatformAdmin, writePlatformAudit } from './helpers';
import { googleApi, projeto, noEmulador, bancoApi } from '../shared/googleApi';

/**
 * platformSecurity — central de segurança da plataforma (só super-admin).
 *
 *  - painel:     checklist com pontuação (o que o servidor consegue conferir
 *                sozinho + itens de console que a administração confirma),
 *                revisão de quem administra a plataforma e números de bloqueio.
 *  - confirmar:  marca (ou desmarca) um item de console como feito.
 *  - auditoria:  ações da administração da plataforma, com filtro por ação e
 *                período, paginada (a tela exporta o que carregou em CSV).
 *
 * Só leitura do banco, exceto `confirmar` (platformConfig/seguranca).
 */

export type Estado = 'ok' | 'atencao' | 'risco' | 'desconhecido';

export interface AdminFato {
    uid: string;
    email: string | null;
    nome: string | null;
    ultimo_acesso: string | null;
    email_verificado: boolean;
    dois_fatores: boolean;
}

export interface Fatos {
    admins: AdminFato[];
    bootstrap: boolean;
    flag2fa: boolean;
    emailKey: boolean;
    banco: { pitr: boolean; protecaoExclusao: boolean; copiaDiaria: boolean; retencaoDias: number | null } | null;
    termosVersao: number | null;
    confirmados: Record<string, { por?: string; em?: string } | undefined>;
    agora: number;
}

export interface Item {
    key: string;
    titulo: string;
    estado: Estado;
    detalhe: string;
    acao: string;
    secao?: string;
    manual?: boolean;
    confirmado?: { por?: string; em?: string } | null;
}

/** Itens que só o console do Google mostra: a administração confirma que fez. */
export const ITENS_MANUAIS = ['app_check', 'chave_api'] as const;

const DIA = 24 * 60 * 60 * 1000;
const INATIVO_DIAS = 90;

/** Monta o checklist a partir dos fatos lidos. Pura, exportada para teste. */
export function montarChecklist(f: Fatos): { itens: Item[]; pontuacao: number } {
    const itens: Item[] = [];
    const n = f.admins.length;
    itens.push({
        key: 'super_admins', titulo: 'Quantas pessoas administram a plataforma',
        estado: n === 1 || n > 5 ? 'atencao' : 'ok',
        detalhe: n === 1 ? 'Só uma pessoa. Se ela perder o acesso, ninguém administra a plataforma.'
            : n > 5 ? `${n} pessoas. Quanto mais gente com acesso total, maior a superfície de risco.`
                : `${n} pessoas com acesso total.`,
        acao: n === 1 ? 'Conceda o acesso a uma segunda pessoa de confiança.' : n > 5 ? 'Retire o acesso de quem não precisa mais.' : '',
        secao: 'admins',
    });

    const inativos = f.admins.filter((a) => !a.ultimo_acesso || f.agora - Date.parse(a.ultimo_acesso) > INATIVO_DIAS * DIA);
    itens.push({
        key: 'admins_inativos', titulo: 'Administradores sem entrar há mais de 90 dias',
        estado: inativos.length ? 'atencao' : 'ok',
        detalhe: inativos.length ? `${inativos.map((a) => a.nome || a.email || a.uid).join(', ')}.` : 'Todos entraram nos últimos 90 dias.',
        acao: inativos.length ? 'Confira se ainda precisam do acesso; se não, retire.' : '',
        secao: 'admins',
    });

    const semEmail = f.admins.filter((a) => !a.email_verificado);
    itens.push({
        key: 'admins_email', titulo: 'E-mail confirmado de quem administra',
        estado: semEmail.length ? 'atencao' : 'ok',
        detalhe: semEmail.length ? `Sem e-mail confirmado: ${semEmail.map((a) => a.nome || a.email || a.uid).join(', ')}.` : 'Todos com e-mail confirmado pelo provedor de login.',
        acao: semEmail.length ? 'Peça para a pessoa entrar com a conta Google ou confirmar o e-mail.' : '',
        secao: 'admins',
    });

    const sem2fa = f.admins.filter((a) => !a.dois_fatores);
    const estado2fa: Estado = !f.flag2fa || !f.emailKey ? 'risco' : sem2fa.length ? 'atencao' : 'ok';
    itens.push({
        key: 'dois_fatores', titulo: 'Código por e-mail no login de quem administra',
        estado: estado2fa,
        detalhe: !f.flag2fa ? 'A verificação em duas etapas está desligada para toda a plataforma.'
            : !f.emailKey ? 'Está ligada, mas a chave do serviço de e-mail falta: o código não sai e o login segue sem ele.'
                : sem2fa.length ? `Ainda não ligaram no próprio perfil: ${sem2fa.map((a) => a.nome || a.email || a.uid).join(', ')}.`
                    : 'Ligada e ativa no perfil de todos os administradores.',
        acao: !f.flag2fa ? 'Ligue "Autenticação em duas etapas" em Funcionalidades.'
            : !f.emailKey ? 'Configure a chave do serviço de e-mail (Configuração inicial).'
                : sem2fa.length ? 'Cada pessoa liga em Meu perfil, Segurança.' : '',
        secao: !f.flag2fa ? 'flags' : !f.emailKey ? 'setup' : 'admins',
    });

    itens.push({
        key: 'bootstrap', titulo: 'Acesso de super-admin por e-mail fixo',
        estado: f.bootstrap ? 'atencao' : 'ok',
        detalhe: f.bootstrap ? 'A variável PLATFORM_ADMIN_EMAILS está preenchida: quem tiver esses e-mails vira super-admin sem aparecer na lista.'
            : 'Desligado: só tem acesso quem está na lista de administradores.',
        acao: f.bootstrap ? 'Depois que o acesso estiver concedido pela lista, esvazie a variável no GitHub e publique de novo.' : '',
        secao: 'setup',
    });

    const b = f.banco;
    itens.push({
        key: 'copia_diaria', titulo: 'Cópia de segurança diária do banco',
        estado: !b ? 'desconhecido' : b.copiaDiaria ? 'ok' : 'risco',
        detalhe: !b ? 'Não foi possível consultar o banco agora.'
            : b.copiaDiaria ? `Ligada${b.retencaoDias ? `, guardada por ${b.retencaoDias} dias` : ''}.`
                : 'Nenhuma cópia automática agendada. Se dados forem apagados por engano, não há de onde recuperar.',
        acao: b && !b.copiaDiaria ? 'Ligue com um botão em Cópias e exportação.' : '',
        secao: 'copias',
    });
    itens.push({
        key: 'pitr', titulo: 'Recuperação de qualquer momento dos últimos 7 dias',
        estado: !b ? 'desconhecido' : b.pitr ? 'ok' : 'atencao',
        detalhe: !b ? 'Não foi possível consultar o banco agora.'
            : b.pitr ? 'Ligada: dá para ler o banco como estava em qualquer minuto dos últimos 7 dias.'
                : 'Desligada. A cópia diária cobre o essencial; isto dá precisão de minuto, com custo de armazenamento extra.',
        acao: b && !b.pitr ? 'Opcional: Firestore, Recuperação pontual (PITR), no console do Google Cloud.' : '',
    });
    itens.push({
        key: 'protecao_exclusao', titulo: 'Proteção contra exclusão do banco',
        estado: !b ? 'desconhecido' : b.protecaoExclusao ? 'ok' : 'atencao',
        detalhe: !b ? 'Não foi possível consultar o banco agora.'
            : b.protecaoExclusao ? 'Ligada: o banco inteiro não pode ser apagado por engano.'
                : 'Desligada: alguém com acesso ao console pode apagar o banco inteiro. Ligar não custa nada.',
        acao: b && !b.protecaoExclusao ? 'Ligue com um botão em Cópias e exportação (sem custo).' : '',
        secao: 'copias',
    });

    itens.push({
        key: 'termos', titulo: 'Termos de uso publicados',
        estado: f.termosVersao ? 'ok' : 'atencao',
        detalhe: f.termosVersao ? `Versão ${f.termosVersao} publicada.` : 'Nenhuma versão publicada pela administração.',
        acao: f.termosVersao ? '' : 'Publique os termos em Identidade e termos.',
        secao: 'branding',
    });

    const manuais: Record<(typeof ITENS_MANUAIS)[number], { titulo: string; detalhe: string; acao: string }> = {
        app_check: {
            titulo: 'App Check (só o app do SIGO fala com o banco)',
            detalhe: 'Impede que scripts de fora chamem o banco e as funções com a chave pública. Só o console mostra se está ligado.',
            acao: 'Atenção: o projeto do Firebase é compartilhado com outros apps; ligar a exigência vale para todos eles. Combine antes de ativar.',
        },
        chave_api: {
            titulo: 'Chave de API restrita ao endereço do SIGO',
            detalhe: 'A chave do Firebase é pública por natureza; restringir ao domínio do SIGO evita uso por outros sites. Só o console mostra.',
            acao: 'Console do Google Cloud, APIs e serviços, Credenciais: restrinja a chave ao domínio do SIGO.',
        },
    };
    for (const key of ITENS_MANUAIS) {
        const c = f.confirmados[key];
        itens.push({ key, ...manuais[key], estado: c ? 'ok' : 'atencao', manual: true, confirmado: c || null, acao: c ? '' : manuais[key].acao });
    }

    const pesos: Record<Estado, number | null> = { ok: 2, atencao: 1, risco: 0, desconhecido: null };
    const contados = itens.map((i) => pesos[i.estado]).filter((p): p is number => p !== null);
    const pontuacao = contados.length ? Math.round((100 * contados.reduce((a, p) => a + p, 0)) / (2 * contados.length)) : 0;
    return { itens, pontuacao };
}

/** Lê a configuração do banco e as cópias agendadas pela API do Firestore. */
async function lerBanco(): Promise<Fatos['banco']> {
    if (!projeto() || noEmulador()) return null;
    try {
        const [db, agenda] = await Promise.all([googleApi(bancoApi()), googleApi(`${bancoApi()}/backupSchedules`)]);
        const diaria = (agenda.backupSchedules || []).find((s: any) => s.dailyRecurrence);
        const qualquer = diaria || (agenda.backupSchedules || [])[0];
        return {
            pitr: db.pointInTimeRecoveryEnablement === 'POINT_IN_TIME_RECOVERY_ENABLED',
            protecaoExclusao: db.deleteProtectionState === 'DELETE_PROTECTION_ENABLED',
            copiaDiaria: !!qualquer,
            retencaoDias: qualquer?.retention ? Math.round(parseInt(qualquer.retention, 10) / 86400) : null,
        };
    } catch (e) {
        console.warn('platformSecurity: banco não consultado', (e as Error).message);
        return null;
    }
}

const iso = (v: any): string | null => (v?.toDate ? v.toDate().toISOString() : null);

async function painel(db: admin.firestore.Firestore) {
    const [adminsSnap, flagsSnap, brandingSnap, segSnap, banco, bloqueados, suspensos] = await Promise.all([
        db.collection('platformAdmins').get(),
        db.collection('platformConfig').doc('featureFlags').get(),
        db.collection('platformConfig').doc('branding').get(),
        db.collection('platformConfig').doc('seguranca').get(),
        lerBanco(),
        db.collection('platformBlocks').where('ativa', '==', true).count().get().then((s) => s.data().count).catch(() => null),
        db.collection('organizations').where('platform_suspension.ativa', '==', true).count().get().then((s) => s.data().count).catch(() => null),
    ]);

    const docs = adminsSnap.docs.map((d) => ({ uid: d.id, ...d.data() } as any));
    const uids = docs.map((d) => d.uid);
    const contas = new Map<string, admin.auth.UserRecord>();
    for (let i = 0; i < uids.length; i += 100) {
        const r = await admin.auth().getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
        r.users.forEach((u) => contas.set(u.uid, u));
    }
    const perfis = uids.length ? await db.getAll(...uids.map((u) => db.collection('users').doc(u))) : [];
    const perfil = new Map(perfis.map((p) => [p.id, p.data() || {}]));

    const lista = docs.map((d) => {
        const c = contas.get(d.uid);
        const p: any = perfil.get(d.uid) || {};
        return {
            uid: d.uid,
            email: c?.email || d.email || null,
            nome: p.platform_name || p.full_name || c?.displayName || null,
            ativo: d.active === true,
            concedido_por: d.granted_by || null,
            concedido_em: iso(d.granted_at),
            retirado_por: d.revoked_by || null,
            retirado_em: iso(d.revoked_at),
            ultimo_acesso: c?.metadata?.lastSignInTime ? new Date(c.metadata.lastSignInTime).toISOString() : null,
            email_verificado: c?.emailVerified === true,
            dois_fatores: p.two_factor_enabled === true,
            conta_existe: !!c,
        };
    });

    const seg = segSnap.data() || {};
    const confirmados: Fatos['confirmados'] = {};
    for (const k of ITENS_MANUAIS) {
        const c = seg.confirmados?.[k];
        if (c) confirmados[k] = { por: c.por, em: iso(c.em) || undefined };
    }
    const fatos: Fatos = {
        admins: lista.filter((a) => a.ativo),
        bootstrap: !!process.env.PLATFORM_ADMIN_EMAILS,
        flag2fa: flagsSnap.data()?.flags?.two_factor_auth === true,
        emailKey: !!process.env.EMAIL_API_KEY,
        banco,
        termosVersao: brandingSnap.data()?.termos?.versao || null,
        confirmados,
        agora: Date.now(),
    };
    return { ...montarChecklist(fatos), admins: lista, resumo: { bloqueados, orgsSuspensos: suspensos }, geradoEm: new Date().toISOString() };
}

async function auditoria(db: admin.firestore.Firestore, p: Pedido) {
    const limite = Math.min(Math.max(Number(p.limite) || 50, 1), 200);
    let q: admin.firestore.Query = db.collection('auditLogs').where('scope', '==', 'platform');
    if (p.acao) q = q.where('action', '==', String(p.acao).slice(0, 80));
    const data = (v: unknown, campo: string) => {
        const d = new Date(String(v));
        if (Number.isNaN(d.getTime())) throw new HttpsError('invalid-argument', `${campo}: data inválida.`);
        return Timestamp.fromDate(d);
    };
    if (p.de) q = q.where('timestamp', '>=', data(p.de, 'De'));
    if (p.ate) q = q.where('timestamp', '<=', data(p.ate, 'Até'));
    q = q.orderBy('timestamp', 'desc');
    if (p.cursor) q = q.startAfter(data(p.cursor, 'Cursor'));
    const snap = await q.limit(limite + 1).get();
    const itens = snap.docs.slice(0, limite).map((d) => {
        const x = d.data();
        return {
            id: d.id, acao: x.action || null, por: x.user_name || null, por_uid: x.user_id || null,
            organization_id: x.organization_id || null, detalhes: x.details || null, em: iso(x.timestamp),
        };
    });
    const temMais = snap.size > limite;
    return { itens, temMais, cursor: temMais ? itens[itens.length - 1]?.em : null };
}

interface Pedido { action?: string; item?: string; confirmado?: boolean; acao?: string; de?: string; ate?: string; cursor?: string; limite?: number }

export const platformSecurity = onCall<Pedido>({ region: REGION }, async (request) => {
    const ator = await assertPlatformAdmin(request);
    const db = admin.firestore();
    const p = request.data || {};
    switch (p.action) {
        case 'painel':
            return painel(db);
        case 'auditoria':
            return auditoria(db, p);
        case 'confirmar': {
            const item = String(p.item || '');
            if (!(ITENS_MANUAIS as readonly string[]).includes(item)) throw new HttpsError('invalid-argument', 'Item desconhecido.');
            const valor = p.confirmado === false ? FieldValue.delete() : { por: ator.name, por_uid: ator.uid, em: FieldValue.serverTimestamp() };
            await db.collection('platformConfig').doc('seguranca').set({ confirmados: { [item]: valor } }, { merge: true });
            await writePlatformAudit(ator.uid, ator.name, 'PLATFORM_SECURITY_CONFIRMED', { item, confirmado: p.confirmado !== false });
            return { success: true };
        }
        default:
            throw new HttpsError('invalid-argument', 'Ação desconhecida.');
    }
});
