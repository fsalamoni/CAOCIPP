"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformSecurity = exports.ITENS_MANUAIS = void 0;
exports.montarChecklist = montarChecklist;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const helpers_1 = require("./helpers");
const googleApi_1 = require("../shared/googleApi");
/** Itens que só o console do Google mostra: a administração confirma que fez. */
exports.ITENS_MANUAIS = ['app_check', 'chave_api'];
const DIA = 24 * 60 * 60 * 1000;
const INATIVO_DIAS = 90;
/** Monta o checklist a partir dos fatos lidos. Pura, exportada para teste. */
function montarChecklist(f) {
    const itens = [];
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
    const estado2fa = !f.flag2fa || !f.emailKey ? 'risco' : sem2fa.length ? 'atencao' : 'ok';
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
    const manuais = {
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
    for (const key of exports.ITENS_MANUAIS) {
        const c = f.confirmados[key];
        itens.push(Object.assign(Object.assign({ key }, manuais[key]), { estado: c ? 'ok' : 'atencao', manual: true, confirmado: c || null, acao: c ? '' : manuais[key].acao }));
    }
    const pesos = { ok: 2, atencao: 1, risco: 0, desconhecido: null };
    const contados = itens.map((i) => pesos[i.estado]).filter((p) => p !== null);
    const pontuacao = contados.length ? Math.round((100 * contados.reduce((a, p) => a + p, 0)) / (2 * contados.length)) : 0;
    return { itens, pontuacao };
}
/** Lê a configuração do banco e as cópias agendadas pela API do Firestore. */
async function lerBanco() {
    if (!(0, googleApi_1.projeto)() || (0, googleApi_1.noEmulador)())
        return null;
    try {
        const [db, agenda] = await Promise.all([(0, googleApi_1.googleApi)((0, googleApi_1.bancoApi)()), (0, googleApi_1.googleApi)(`${(0, googleApi_1.bancoApi)()}/backupSchedules`)]);
        const diaria = (agenda.backupSchedules || []).find((s) => s.dailyRecurrence);
        const qualquer = diaria || (agenda.backupSchedules || [])[0];
        return {
            pitr: db.pointInTimeRecoveryEnablement === 'POINT_IN_TIME_RECOVERY_ENABLED',
            protecaoExclusao: db.deleteProtectionState === 'DELETE_PROTECTION_ENABLED',
            copiaDiaria: !!qualquer,
            retencaoDias: (qualquer === null || qualquer === void 0 ? void 0 : qualquer.retention) ? Math.round(parseInt(qualquer.retention, 10) / 86400) : null,
        };
    }
    catch (e) {
        console.warn('platformSecurity: banco não consultado', e.message);
        return null;
    }
}
const iso = (v) => ((v === null || v === void 0 ? void 0 : v.toDate) ? v.toDate().toISOString() : null);
async function painel(db) {
    var _a, _b, _c, _d, _e;
    const [adminsSnap, flagsSnap, brandingSnap, segSnap, banco, bloqueados, suspensos] = await Promise.all([
        db.collection('platformAdmins').get(),
        db.collection('platformConfig').doc('featureFlags').get(),
        db.collection('platformConfig').doc('branding').get(),
        db.collection('platformConfig').doc('seguranca').get(),
        lerBanco(),
        db.collection('platformBlocks').where('ativa', '==', true).count().get().then((s) => s.data().count).catch(() => null),
        db.collection('organizations').where('platform_suspension.ativa', '==', true).count().get().then((s) => s.data().count).catch(() => null),
    ]);
    const docs = adminsSnap.docs.map((d) => (Object.assign({ uid: d.id }, d.data())));
    const uids = docs.map((d) => d.uid);
    const contas = new Map();
    for (let i = 0; i < uids.length; i += 100) {
        const r = await admin.auth().getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
        r.users.forEach((u) => contas.set(u.uid, u));
    }
    const perfis = uids.length ? await db.getAll(...uids.map((u) => db.collection('users').doc(u))) : [];
    const perfil = new Map(perfis.map((p) => [p.id, p.data() || {}]));
    const lista = docs.map((d) => {
        var _a;
        const c = contas.get(d.uid);
        const p = perfil.get(d.uid) || {};
        return {
            uid: d.uid,
            email: (c === null || c === void 0 ? void 0 : c.email) || d.email || null,
            nome: p.platform_name || p.full_name || (c === null || c === void 0 ? void 0 : c.displayName) || null,
            ativo: d.active === true,
            concedido_por: d.granted_by || null,
            concedido_em: iso(d.granted_at),
            retirado_por: d.revoked_by || null,
            retirado_em: iso(d.revoked_at),
            ultimo_acesso: ((_a = c === null || c === void 0 ? void 0 : c.metadata) === null || _a === void 0 ? void 0 : _a.lastSignInTime) ? new Date(c.metadata.lastSignInTime).toISOString() : null,
            email_verificado: (c === null || c === void 0 ? void 0 : c.emailVerified) === true,
            dois_fatores: p.two_factor_enabled === true,
            conta_existe: !!c,
        };
    });
    const seg = segSnap.data() || {};
    const confirmados = {};
    for (const k of exports.ITENS_MANUAIS) {
        const c = (_a = seg.confirmados) === null || _a === void 0 ? void 0 : _a[k];
        if (c)
            confirmados[k] = { por: c.por, em: iso(c.em) || undefined };
    }
    const fatos = {
        admins: lista.filter((a) => a.ativo),
        bootstrap: !!process.env.PLATFORM_ADMIN_EMAILS,
        flag2fa: ((_c = (_b = flagsSnap.data()) === null || _b === void 0 ? void 0 : _b.flags) === null || _c === void 0 ? void 0 : _c.two_factor_auth) === true,
        emailKey: !!process.env.EMAIL_API_KEY,
        banco,
        termosVersao: ((_e = (_d = brandingSnap.data()) === null || _d === void 0 ? void 0 : _d.termos) === null || _e === void 0 ? void 0 : _e.versao) || null,
        confirmados,
        agora: Date.now(),
    };
    return Object.assign(Object.assign({}, montarChecklist(fatos)), { admins: lista, resumo: { bloqueados, orgsSuspensos: suspensos }, geradoEm: new Date().toISOString() });
}
async function auditoria(db, p) {
    var _a;
    const limite = Math.min(Math.max(Number(p.limite) || 50, 1), 200);
    let q = db.collection('auditLogs').where('scope', '==', 'platform');
    if (p.acao)
        q = q.where('action', '==', String(p.acao).slice(0, 80));
    const data = (v, campo) => {
        const d = new Date(String(v));
        if (Number.isNaN(d.getTime()))
            throw new https_1.HttpsError('invalid-argument', `${campo}: data inválida.`);
        return firestore_1.Timestamp.fromDate(d);
    };
    if (p.de)
        q = q.where('timestamp', '>=', data(p.de, 'De'));
    if (p.ate)
        q = q.where('timestamp', '<=', data(p.ate, 'Até'));
    q = q.orderBy('timestamp', 'desc');
    if (p.cursor)
        q = q.startAfter(data(p.cursor, 'Cursor'));
    const snap = await q.limit(limite + 1).get();
    const itens = snap.docs.slice(0, limite).map((d) => {
        const x = d.data();
        return {
            id: d.id, acao: x.action || null, por: x.user_name || null, por_uid: x.user_id || null,
            organization_id: x.organization_id || null, detalhes: x.details || null, em: iso(x.timestamp),
        };
    });
    const temMais = snap.size > limite;
    return { itens, temMais, cursor: temMais ? (_a = itens[itens.length - 1]) === null || _a === void 0 ? void 0 : _a.em : null };
}
exports.platformSecurity = (0, https_1.onCall)({ region: helpers_1.REGION }, async (request) => {
    const ator = await (0, helpers_1.assertPlatformAdmin)(request);
    const db = admin.firestore();
    const p = request.data || {};
    switch (p.action) {
        case 'painel':
            return painel(db);
        case 'auditoria':
            return auditoria(db, p);
        case 'confirmar': {
            const item = String(p.item || '');
            if (!exports.ITENS_MANUAIS.includes(item))
                throw new https_1.HttpsError('invalid-argument', 'Item desconhecido.');
            const valor = p.confirmado === false ? firestore_1.FieldValue.delete() : { por: ator.name, por_uid: ator.uid, em: firestore_1.FieldValue.serverTimestamp() };
            await db.collection('platformConfig').doc('seguranca').set({ confirmados: { [item]: valor } }, { merge: true });
            await (0, helpers_1.writePlatformAudit)(ator.uid, ator.name, 'PLATFORM_SECURITY_CONFIRMED', { item, confirmado: p.confirmado !== false });
            return { success: true };
        }
        default:
            throw new https_1.HttpsError('invalid-argument', 'Ação desconhecida.');
    }
});
//# sourceMappingURL=security.js.map