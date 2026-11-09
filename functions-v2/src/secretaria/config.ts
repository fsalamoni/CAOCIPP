import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { MAX_TEXTO_LONGO, documentoEfetivo, lotacoesDe, sanitizeCalendario, sanitizeRito, texto } from '../shared/secretaria';
import { sanitizeDoc } from '../shared/documento';
import { COL, REGION, carregarContexto, erroUsuario, exigirAdmin, exigirAuth, exigirGestor } from './context';
import { sanitizeDocumentoConfig } from './documentoConfig';
import {
    aceitarConviteEquipe, convidarEquipe, convitesPendentes, decidirPedido, obterUnidadeDocumento, pedirLotacao,
    revogarConviteEquipe, salvarUnidade, salvarUnidadeDocumento, verConviteEquipe,
} from './unidades';

export { TIPOS_DOCUMENTO_PADRAO } from './documentoConfig';

/**
 * Configuração do Processo Eletrônico do órgão (function `secretariaConfig`,
 * nome mantido): ativação, unidades de lotação e equipes, ritos, tipos de
 * processo, papel timbrado, modelos e calendário. A tela fica no Painel
 * Administrativo do órgão; a gestão de cada unidade, também na própria
 * página do Processo Eletrônico.
 */

const MAX_MODELOS = 200;
const MAX_RITOS = 50;

const RITO_PADRAO = {
    nome: 'Rito comum',
    descricao: 'Rito inicial criado na ativação. Pode ser editado ou substituído.',
    fases: [
        { id: 'autuacao', nome: 'Autuação' },
        { id: 'instrucao', nome: 'Instrução' },
        { id: 'decisao', nome: 'Decisão' },
        { id: 'cumprimento', nome: 'Cumprimento' },
        { id: 'encerramento', nome: 'Encerramento' },
    ],
};

type Acao = 'estado' | 'ativar' | 'salvarUnidade' | 'salvarRito' | 'salvarPreferencias' | 'salvarTipo'
    | 'salvarDocumentoConfig' | 'salvarModelo' | 'obterModelo' | 'salvarCalendario'
    | 'obterUnidadeDocumento' | 'salvarUnidadeDocumento' | 'convidarEquipe' | 'revogarConviteEquipe'
    | 'pedirLotacao' | 'decidirPedido' | 'verConviteEquipe' | 'aceitarConviteEquipe';

interface ConfigRequest extends Record<string, unknown> {
    organizationId: string;
    action: Acao;
    calendario?: unknown;
    alerta_prazos?: boolean;
    documento?: unknown;
    modelo?: unknown;
    tipo?: unknown;
    peticao_interrompe?: boolean;
    enabled?: boolean;
    id?: string;
    unidadeId?: string;
    unidade?: unknown;
    rito?: unknown;
    ativo?: boolean;
    token?: string;
}

export const secretariaConfig = onCall<ConfigRequest>({ region: REGION }, async (request) => {
    const auth = exigirAuth(request);
    const p = request.data || ({} as ConfigRequest);

    // Convite de equipe: quem aceita pode ainda não ser membro do órgão.
    if (p.action === 'verConviteEquipe') return verConviteEquipe(p.token);
    if (p.action === 'aceitarConviteEquipe') return aceitarConviteEquipe(auth, p.token);

    const c = await carregarContexto(auth, p.organizationId, { permitirInativa: true });
    const { db, orgId } = c;
    const enabled = c.org.secretariaConfig?.enabled === true;
    const agora = FieldValue.serverTimestamp();
    const audit = (action: string, details: Record<string, unknown>) => auditar(db, orgId, auth.uid, c.userName, action, details);
    const exigirAtivo = () => {
        if (!enabled) throw new HttpsError('failed-precondition', 'O Processo Eletrônico não está ativo neste órgão');
    };

    if (p.action === 'estado') {
        if (!enabled && !c.ctx.isAdmin) return { enabled: false, isAdmin: false };
        const minhas = c.ctx.unidadeIds;
        const [ritosSnap, tiposSnap, cfgSnap, modelosSnap, memSnap, unCfgSnaps, convites] = await Promise.all([
            db.collection(COL.ritos).where('organization_id', '==', orgId).get(),
            db.collection(COL.tipos).where('organization_id', '==', orgId).get(),
            db.collection(COL.config).doc(orgId).get(),
            db.collection(COL.modelos).where('organization_id', '==', orgId).select('nome', 'tipo_documento', 'descricao', 'ativo', 'unidade_id', 'formato', 'arquivo_nome').get(),
            db.collection('userOrganizations').where('organization_id', '==', orgId).get(),
            minhas.length ? db.getAll(...minhas.map((id) => db.collection(COL.unidadeConfig).doc(id))) : Promise.resolve([]),
            convitesPendentes(c),
        ]);
        // Todo usuário lotado precisa ver os nomes de colegas para atribuir
        // processos; e-mail só para quem administra ou gere unidade.
        const veEmail = c.ctx.isAdmin || c.gestorDe.length > 0;
        const membros = memSnap.docs.filter((d) => d.data().active !== false).map((d) => {
            const m = d.data();
            return {
                uid: String(m.user_id || d.id.split('_')[0]),
                nome: String(m.user_name || m.user_email || 'Membro'),
                email: veEmail ? String(m.user_email || '') : '',
                funcao: String(m.function || ''),
            };
        });
        const documento = sanitizeDocumentoConfig(cfgSnap.data()?.documento);
        // Timbrado e tipos efetivos das unidades em que a pessoa está lotada
        // (o editor e a redação usam o da unidade que tem o processo).
        const documentoUnidades: Record<string, unknown> = {};
        for (const s of unCfgSnaps) documentoUnidades[s.id] = documentoEfetivo(documento, s.data() as never);
        return {
            enabled,
            peticao_interrompe: c.org.secretariaConfig?.peticao_interrompe === true,
            isAdmin: c.ctx.isAdmin,
            uid: c.ctx.uid,
            minhasUnidades: minhas,
            gestorDe: c.gestorDe,
            unidades: c.unidades.map((u) => {
                const gere = c.ctx.isAdmin || c.gestorDe.includes(u.id);
                const lotacoes = lotacoesDe(u);
                return {
                    id: u.id, nome: u.nome, sigla: u.sigla || '', tipo: u.tipo || 'secretaria', descricao: u.descricao || '',
                    ativa: u.ativa !== false, membros_uids: lotacoes.map((l) => l.uid), lotacoes,
                    ...(gere ? { pedidos: Array.isArray(u.pedidos) ? u.pedidos : [] } : {}),
                    pedi_lotacao: Array.isArray(u.pedidos) && u.pedidos.some((x: { uid: string }) => x.uid === auth.uid),
                };
            }).sort((a, b) => String(a.nome).localeCompare(String(b.nome))),
            convitesEquipe: convites,
            ritos: ritosSnap.docs.map((d) => {
                const r = d.data();
                return { id: d.id, nome: r.nome, descricao: r.descricao, fases: r.fases, versao: r.versao, ativo: r.ativo !== false };
            }),
            tipos: tiposSnap.docs.map((d) => {
                const t = d.data();
                return {
                    id: d.id, nome: t.nome, sigla: t.sigla || '', descricao: t.descricao || '', rito_id: t.rito_id,
                    sigilo_padrao: t.sigilo_padrao || 'normal', unidade_inicial: t.unidade_inicial || null, ativo: t.ativo !== false,
                };
            }).sort((a, b) => a.nome.localeCompare(b.nome)),
            documento,
            documentoUnidades,
            calendario: sanitizeCalendario(cfgSnap.data()?.calendario),
            alerta_prazos: cfgSnap.data()?.alerta_prazos === true,
            modelos: modelosSnap.docs.map((d) => {
                const m = d.data();
                return {
                    id: d.id, nome: m.nome, tipo_documento: m.tipo_documento || '', descricao: m.descricao || '', ativo: m.ativo !== false,
                    unidade_id: m.unidade_id || null, formato: m.formato || 'editor', arquivo_nome: m.arquivo_nome || '',
                };
            }).sort((a, b) => a.nome.localeCompare(b.nome)),
            suspensa_plataforma: c.org.secretariaConfig?.suspensa_plataforma === true,
            motivo_suspensao: c.org.secretariaConfig?.motivo_suspensao || '',
            orgao: String(c.org.name || ''),
            membros,
        };
    }

    if (p.action === 'obterModelo') {
        exigirAtivo();
        const m = (await db.collection(COL.modelos).doc(String(p.id || '_')).get()).data();
        if (!m || m.organization_id !== orgId) throw new HttpsError('not-found', 'Modelo não encontrado');
        return {
            id: p.id, nome: m.nome, tipo_documento: m.tipo_documento || '', descricao: m.descricao || '', conteudo: m.conteudo,
            ativo: m.ativo !== false, unidade_id: m.unidade_id || null, formato: m.formato || 'editor', arquivo_nome: m.arquivo_nome || '',
        };
    }

    if (p.action === 'pedirLotacao') {
        exigirAtivo();
        return pedirLotacao(c, p, auth.uid, String(auth.token.email || ''));
    }

    // Gestão de unidade: admin do órgão ou gestor da unidade.
    if (p.action === 'salvarUnidade') return salvarUnidade(c, p, auth.uid, audit);
    if (p.action === 'obterUnidadeDocumento') return obterUnidadeDocumento(c, p);
    if (p.action === 'salvarUnidadeDocumento') return salvarUnidadeDocumento(c, p, auth.uid, audit);
    if (p.action === 'convidarEquipe') { exigirAtivo(); return convidarEquipe(c, p, auth.uid, audit); }
    if (p.action === 'revogarConviteEquipe') return revogarConviteEquipe(c, p, audit);
    if (p.action === 'decidirPedido') return decidirPedido(c, p, auth.uid, audit);

    if (p.action === 'salvarModelo') {
        const m = (p.modelo && typeof p.modelo === 'object' ? p.modelo : {}) as Record<string, unknown>;
        const col = db.collection(COL.modelos);
        const atual = p.id ? (await col.doc(p.id).get()).data() : null;
        if (p.id && atual?.organization_id !== orgId) throw new HttpsError('not-found', 'Modelo não encontrado');
        // Modelo do órgão: admin. Modelo de unidade: gestão dela (antes e depois de mudar).
        const unidadeId = m.unidade_id ? String(m.unidade_id) : null;
        for (const u of new Set([unidadeId, atual ? (atual.unidade_id || null) : unidadeId])) {
            if (u) exigirGestor(c, u); else exigirAdmin(c);
        }
        const nome = texto(m.nome, 120);
        if (!nome) throw new HttpsError('invalid-argument', 'Dê um nome ao modelo');
        let conteudo;
        try { conteudo = sanitizeDoc(m.conteudo); } catch (e) { erroUsuario(e); }
        const dados = {
            nome, tipo_documento: texto(m.tipo_documento, 60), descricao: texto(m.descricao, 500), conteudo, unidade_id: unidadeId,
            ativo: m.ativo !== false, updated_at: agora, updated_by: auth.uid,
        };
        if (p.id) {
            await col.doc(p.id).update(dados);
        } else {
            if ((await col.where('organization_id', '==', orgId).count().get()).data().count >= MAX_MODELOS) {
                throw new HttpsError('resource-exhausted', 'Limite de modelos atingido');
            }
            p.id = (await col.add({ ...dados, formato: 'editor', organization_id: orgId, created_at: agora, created_by: auth.uid })).id;
        }
        await audit('SECRETARIA_MODELO_SALVO', { modelo_id: p.id, nome, unidade_id: unidadeId });
        return { success: true, id: p.id };
    }

    exigirAdmin(c);

    if (p.action === 'salvarDocumentoConfig') {
        let documento;
        try { documento = sanitizeDocumentoConfig(p.documento); } catch (e) { erroUsuario(e); }
        await db.collection(COL.config).doc(orgId).set({ organization_id: orgId, documento, updated_at: agora, updated_by: auth.uid }, { merge: true });
        await audit('SECRETARIA_DOCUMENTO_CONFIG', { linhas: documento!.cabecalho_linhas.length, brasao: !!documento!.brasao });
        return { success: true };
    }

    if (p.action === 'salvarCalendario') {
        const calendario = sanitizeCalendario(p.calendario);
        const alerta = p.alerta_prazos === true;
        await db.collection(COL.config).doc(orgId).set({ organization_id: orgId, calendario, alerta_prazos: alerta, updated_at: agora, updated_by: auth.uid }, { merge: true });
        await audit('SECRETARIA_CALENDARIO', {
            feriados: calendario.feriados.length, recessos: calendario.recessos.length, recesso_forense: calendario.recesso_forense, alerta_prazos: alerta,
        });
        return { success: true, calendario };
    }

    if (p.action === 'ativar') {
        const ligar = p.enabled === true;
        await db.collection('organizations').doc(orgId).update({
            'secretariaConfig.enabled': ligar,
            'secretariaConfig.updated_at': agora,
            'secretariaConfig.updated_by': auth.uid,
        });
        // Primeira ativação: deixa o órgão pronto para autuar, com uma
        // secretaria (o admin lotado e gestor) e um rito comum. Nada é criado
        // se já existir unidade ou rito.
        if (ligar && c.unidades.length === 0) {
            await db.collection(COL.unidades).add({
                organization_id: orgId, nome: 'Secretaria', sigla: 'SEC', tipo: 'secretaria', descricao: '',
                lotacoes: [{ uid: auth.uid, atribuicao: 'Administração do Processo Eletrônico', gestor: true }],
                membros_uids: [auth.uid], pedidos: [], ativa: true, created_at: agora, created_by: auth.uid,
            });
        }
        const temRito = !(await db.collection(COL.ritos).where('organization_id', '==', orgId).limit(1).get()).empty;
        if (ligar && !temRito) {
            await db.collection(COL.ritos).add({
                organization_id: orgId, ...RITO_PADRAO, versao: 1, ativo: true, created_at: agora, created_by: auth.uid,
            });
        }
        await audit(ligar ? 'SECRETARIA_ATIVADA' : 'SECRETARIA_DESATIVADA', {});
        return { success: true, enabled: ligar };
    }

    if (p.action === 'salvarPreferencias') {
        const interrompe = p.peticao_interrompe === true;
        await db.collection('organizations').doc(orgId).update({
            'secretariaConfig.peticao_interrompe': interrompe,
            'secretariaConfig.updated_at': agora,
            'secretariaConfig.updated_by': auth.uid,
        });
        await audit('SECRETARIA_PREFERENCIAS', { peticao_interrompe: interrompe });
        return { success: true };
    }

    if (p.action === 'salvarRito') {
        let rito;
        try { rito = sanitizeRito(p.rito); } catch (e) { erroUsuario(e); }
        const col = db.collection(COL.ritos);
        if (p.id) {
            const ref = col.doc(p.id);
            const snap = await ref.get();
            if (!snap.exists || snap.data()?.organization_id !== orgId) throw new HttpsError('not-found', 'Rito não encontrado');
            // Processos guardam a cópia das fases com que foram autuados; mudar
            // o rito só vale para os próximos.
            await ref.update({ ...rito, ativo: p.ativo !== false, versao: (Number(snap.data()?.versao) || 1) + 1, updated_at: agora, updated_by: auth.uid });
        } else {
            const qtd = (await col.where('organization_id', '==', orgId).get()).size;
            if (qtd >= MAX_RITOS) throw new HttpsError('resource-exhausted', 'Limite de ritos atingido');
            const ref = await col.add({ ...rito, organization_id: orgId, versao: 1, ativo: true, created_at: agora, created_by: auth.uid });
            p.id = ref.id;
        }
        await audit('SECRETARIA_RITO_SALVO', { rito_id: p.id, nome: rito!.nome });
        return { success: true, id: p.id };
    }

    if (p.action === 'salvarTipo') {
        const t = (p.tipo && typeof p.tipo === 'object' ? p.tipo : {}) as Record<string, unknown>;
        const nome = texto(t.nome);
        if (!nome) throw new HttpsError('invalid-argument', 'Dê um nome ao tipo de processo');
        const rito = (await db.collection(COL.ritos).doc(String(t.rito_id || '_')).get()).data();
        if (!rito || rito.organization_id !== orgId) throw new HttpsError('invalid-argument', 'Escolha o rito do tipo de processo');
        const unidadeInicial = String(t.unidade_inicial || '');
        if (unidadeInicial && !c.unidades.some((u) => u.id === unidadeInicial)) throw new HttpsError('invalid-argument', 'Unidade inicial inválida');
        const dados = {
            nome, sigla: texto(t.sigla, 12), descricao: texto(t.descricao, MAX_TEXTO_LONGO), rito_id: String(t.rito_id),
            sigilo_padrao: t.sigilo_padrao === 'restrito' ? 'restrito' : 'normal', unidade_inicial: unidadeInicial || null,
            ativo: t.ativo !== false, updated_at: agora, updated_by: auth.uid,
        };
        const col = db.collection(COL.tipos);
        if (p.id) {
            const ref = col.doc(p.id);
            if ((await ref.get()).data()?.organization_id !== orgId) throw new HttpsError('not-found', 'Tipo não encontrado');
            await ref.update(dados);
        } else {
            if ((await col.where('organization_id', '==', orgId).get()).size >= MAX_RITOS) throw new HttpsError('resource-exhausted', 'Limite de tipos atingido');
            p.id = (await col.add({ ...dados, organization_id: orgId, created_at: agora, created_by: auth.uid })).id;
        }
        await audit('SECRETARIA_TIPO_SALVO', { tipo_id: p.id, nome });
        return { success: true, id: p.id };
    }

    throw new HttpsError('invalid-argument', 'Ação desconhecida');
});

export async function auditar(
    db: admin.firestore.Firestore, orgId: string, uid: string, nome: string,
    action: string, details: Record<string, unknown>
) {
    await db.collection('auditLogs').add({
        organization_id: orgId, user_id: uid, user_name: nome, action,
        details,
        timestamp: FieldValue.serverTimestamp(),
    });
}
