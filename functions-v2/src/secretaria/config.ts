import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { MAX_TEXTO_LONGO, Rito, documentoEfetivo, lotacoesDe, sanitizeCalendario, sanitizeRito, texto, tipoUnidade } from '../shared/secretaria';
import { sanitizeDoc } from '../shared/documento';
import { formularioDe, sanitizeFormulario } from '../shared/camposProcesso';
import { COL, REGION, carregarContexto, erroUsuario, exigirAdmin, exigirAuth, exigirGestor } from './context';
import { sanitizeDocumentoConfig } from './documentoConfig';
import { MAX_MODELO_BYTES, MIME_BIZAGI, MIMES_ORIGINAL, interpretarModelo, preencherDocx, textoParaRito } from './importarModelo';
import { MIME_DOCX } from './conversao';
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
// O documento do Firestore tem teto de 1 MB; modelo com imagens maiores fica no original.
const MAX_MODELO_JSON = 900_000;
const caminhoModelo = (orgId: string, id: string) => `secretaria/${orgId}/modelos/${id}`;

const MAX_UNIDADES_PROPOSTA = 30;
const MAX_MODELOS_PROPOSTA = 60;

/** Tira do rito referências a unidades e modelos que não são do órgão. */
function filtrarRefsRito(rito: Rito, unidades: Set<string>, modelos: Set<string>): Rito {
    return {
        ...rito,
        fases: rito.fases.map((f) => {
            const { unidade_id, modelos: ms, ...resto } = f;
            const validos = (ms || []).filter((m) => modelos.has(m));
            return { ...resto, ...(unidade_id && unidades.has(unidade_id) ? { unidade_id } : {}), ...(validos.length ? { modelos: validos } : {}) };
        }),
    };
}

/** Esqueleto de modelo criado pela implantação de um rito, para completar no editor. */
function esqueletoModelo(nome: string) {
    const p = (t: string) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] });
    return {
        type: 'doc',
        content: [
            { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [{ type: 'text', text: nome.toUpperCase() }] },
            p('Processo nº {{numero}} · {{assunto}}'),
            p('Interessados: {{partes}}'),
            p('[Texto do documento]'),
            p('{{unidade}}, {{data_extenso}}.'),
            p('{{usuario}}'),
        ],
    };
}

/** Arquivo enviado pelo navegador (base64), conferido em tipo e tamanho. */
function arquivoRecebido(v: unknown, tipos: string[]) {
    const a = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    const mime = String(a.mime || '');
    if (!tipos.includes(mime)) throw new HttpsError('invalid-argument', 'Formato de arquivo não aceito');
    const buf = Buffer.from(String(a.base64 || ''), 'base64');
    if (!buf.length) throw new HttpsError('invalid-argument', 'Arquivo vazio');
    if (buf.length > MAX_MODELO_BYTES) throw new HttpsError('invalid-argument', 'Arquivo acima de 5 MB');
    return { buf, mime, nome: texto(a.nome, 160) || 'modelo' };
}
const MAX_RITOS = 50;
/** Versões guardadas por rito ou modelo (as mais antigas saem). */
const MAX_VERSOES = 20;

/**
 * Guarda a versão atual de um rito ou modelo em `versoes/{n}` antes de
 * sobrescrever, para o admin poder voltar atrás. Só os campos editáveis.
 */
async function guardarVersao(ref: admin.firestore.DocumentReference, atual: admin.firestore.DocumentData, campos: string[]) {
    const n = Number(atual.versao) || 1;
    const dados: Record<string, unknown> = { versao: n, salvo_em: atual.updated_at || atual.created_at || null, salvo_por: atual.updated_by || atual.created_by || null };
    for (const k of campos) if (atual[k] !== undefined) dados[k] = atual[k];
    await ref.collection('versoes').doc(String(n).padStart(6, '0')).set(dados);
    const antigas = await ref.collection('versoes').orderBy('versao', 'desc').offset(MAX_VERSOES).get();
    if (!antigas.empty) { const b = ref.firestore.batch(); antigas.docs.forEach((d) => b.delete(d.ref)); await b.commit(); }
}
const CAMPOS_RITO = ['nome', 'descricao', 'fases'];
const CAMPOS_MODELO = ['nome', 'tipo_documento', 'descricao', 'conteudo'];

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
    | 'pedirLotacao' | 'decidirPedido' | 'verConviteEquipe' | 'aceitarConviteEquipe'
    | 'importarModelo' | 'baixarModelo' | 'extrairTextoRito' | 'aplicarPropostaRito'
    | 'versoes' | 'restaurarVersao';

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
    unidade_id?: string;
    arquivo?: unknown;
    valores?: unknown;
    proposta?: unknown;
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
                    sigilo_padrao: t.sigilo_padrao || 'normal', urgente: t.urgente === true, unidade_inicial: t.unidade_inicial || null, ativo: t.ativo !== false,
                    formulario: formularioDe(t),
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

    if (p.action === 'baixarModelo') {
        exigirAtivo();
        const m = (await db.collection(COL.modelos).doc(String(p.id || '_')).get()).data();
        if (!m || m.organization_id !== orgId || !m.storage_path) throw new HttpsError('not-found', 'Modelo sem arquivo original');
        let [buf] = await admin.storage().bucket().file(m.storage_path).download();
        const valores = p.valores && typeof p.valores === 'object' ? p.valores as Record<string, unknown> : null;
        if (valores && m.arquivo_mime === MIME_DOCX) {
            const limpos: Record<string, string> = {};
            for (const [k, v] of Object.entries(valores).slice(0, 40)) if (/^[a-z0-9_]{1,40}$/.test(k)) limpos[k] = texto(v, 2000);
            buf = await preencherDocx(buf, limpos);
        }
        return { base64: buf.toString('base64'), mime: m.arquivo_mime, nome: m.arquivo_nome || 'modelo' };
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

    if (p.action === 'importarModelo') {
        // Só interpreta e devolve a proposta; nada é gravado até salvarModelo.
        const unidadeId = p.unidade_id ? String(p.unidade_id) : null;
        if (unidadeId) exigirGestor(c, unidadeId); else exigirAdmin(c);
        const a = arquivoRecebido(p.arquivo, ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf', 'text/html', 'text/plain']);
        try {
            return { ...(await interpretarModelo(a.buf, a.mime)), nome: a.nome.replace(/\.[a-z0-9]{2,5}$/i, ''), original_possivel: MIMES_ORIGINAL.includes(a.mime) };
        } catch (e) {
            const msg = e instanceof Error ? e.message : '';
            throw new HttpsError('invalid-argument', msg && msg.length < 300 ? msg : 'Não foi possível ler o arquivo');
        }
    }

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
        // Formato: 'editor' (conteúdo do editor) ou 'original' (arquivo DOCX/PDF guardado).
        const formato = (p.id ? atual?.formato : m.formato) === 'original' ? 'original' : 'editor';
        const arquivo = formato === 'original' && (m.arquivo || !p.id) ? arquivoRecebido(m.arquivo, MIMES_ORIGINAL) : null;
        let conteudo = null;
        if (formato === 'editor') {
            try { conteudo = sanitizeDoc(m.conteudo); } catch (e) { erroUsuario(e); }
            if (JSON.stringify(conteudo).length > MAX_MODELO_JSON) {
                throw new HttpsError('invalid-argument', 'Modelo grande demais (imagens pesadas); reduza as imagens ou guarde o arquivo original');
            }
        }
        const dados: Record<string, unknown> = {
            nome, tipo_documento: texto(m.tipo_documento, 60), descricao: texto(m.descricao, 500), conteudo, unidade_id: unidadeId,
            ativo: m.ativo !== false, updated_at: agora, updated_by: auth.uid,
        };
        const ref = p.id ? col.doc(p.id) : col.doc();
        if (!p.id && (await col.where('organization_id', '==', orgId).count().get()).data().count >= MAX_MODELOS) {
            throw new HttpsError('resource-exhausted', 'Limite de modelos atingido');
        }
        if (arquivo) {
            const path = caminhoModelo(orgId, ref.id);
            await admin.storage().bucket().file(path).save(arquivo.buf, { contentType: arquivo.mime, resumable: false });
            Object.assign(dados, { storage_path: path, arquivo_nome: arquivo.nome, arquivo_mime: arquivo.mime, tamanho: arquivo.buf.length });
        }
        if (p.id) {
            // Versão anterior fica guardada (só modelos do editor têm conteúdo a versionar).
            if (formato === 'editor' && atual) await guardarVersao(ref, atual, CAMPOS_MODELO);
            await ref.update({ ...dados, versao: (Number(atual?.versao) || 1) + 1 });
        } else await ref.set({ ...dados, versao: 1, formato, organization_id: orgId, created_at: agora, created_by: auth.uid });
        p.id = ref.id;
        await audit('SECRETARIA_MODELO_SALVO', { modelo_id: p.id, nome, unidade_id: unidadeId, formato });
        return { success: true, id: p.id };
    }

    // Versões anteriores de um rito (admin) ou de um modelo do editor (gestão).
    if (p.action === 'versoes' || p.action === 'restaurarVersao') {
        const col = p.colecao === 'rito' ? COL.ritos : p.colecao === 'modelo' ? COL.modelos : null;
        if (!col) throw new HttpsError('invalid-argument', 'Coleção inválida');
        const ref = db.collection(col).doc(String(p.id || '_'));
        const atual = (await ref.get()).data();
        if (!atual || atual.organization_id !== orgId) throw new HttpsError('not-found', 'Não encontrado');
        if (col === COL.ritos || !atual.unidade_id) exigirAdmin(c); else exigirGestor(c, String(atual.unidade_id));
        if (p.action === 'versoes') {
            const snap = await ref.collection('versoes').orderBy('versao', 'desc').limit(MAX_VERSOES).get();
            return {
                versao_atual: Number(atual.versao) || 1,
                versoes: snap.docs.map((d) => {
                    const v = d.data();
                    const em = v.salvo_em && typeof v.salvo_em.toDate === 'function' ? v.salvo_em.toDate().toISOString() : (v.salvo_em || null);
                    return { versao: v.versao, em, por: v.salvo_por || null, nome: v.nome || '', fases: Array.isArray(v.fases) ? v.fases.length : undefined };
                }),
            };
        }
        const vSnap = await ref.collection('versoes').doc(String(Number(p.versao) || 0).padStart(6, '0')).get();
        const v = vSnap.data();
        if (!v) throw new HttpsError('not-found', 'Versão não encontrada');
        const campos = col === COL.ritos ? CAMPOS_RITO : CAMPOS_MODELO;
        await guardarVersao(ref, atual, campos);
        const volta: Record<string, unknown> = { versao: (Number(atual.versao) || 1) + 1, updated_at: agora, updated_by: auth.uid };
        for (const k of campos) if (v[k] !== undefined) volta[k] = v[k];
        await ref.update(volta);
        await audit('SECRETARIA_VERSAO_RESTAURADA', { colecao: p.colecao, id: ref.id, nome: v.nome || atual.nome, de_versao: v.versao, nova_versao: volta.versao });
        return { success: true, versao: volta.versao };
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

    if (p.action === 'extrairTextoRito') {
        const a = arquivoRecebido(p.arquivo, [MIME_DOCX, 'application/pdf', 'text/plain', MIME_BIZAGI]);
        if (a.mime === MIME_BIZAGI && a.buf.subarray(0, 2).toString('latin1') !== 'PK') {
            throw new HttpsError('invalid-argument', 'O arquivo não é um pacote do Bizagi (.bpm). Exporte o diagrama em BPMN ou XPDL e envie esse arquivo.');
        }
        try {
            return await textoParaRito(a.buf, a.mime);
        } catch (e) {
            // Mensagens nossas (PDF digitalizado, pacote sem diagrama) vão para a tela; o resto fica genérico.
            const msg = e instanceof Error && /^(O PDF|O arquivo|Não achei|O pacote)/.test(e.message) ? e.message : 'Não foi possível ler o arquivo';
            console.warn('extrairTextoRito', a.mime, e instanceof Error ? e.message : e);
            throw new HttpsError('invalid-argument', msg);
        }
    }

    if (p.action === 'aplicarPropostaRito') {
        // Implanta de uma vez (lote atômico): unidades e modelos novos, o rito
        // com as fases ligadas a eles e, se pedido, o tipo de processo.
        const pr = (p.proposta && typeof p.proposta === 'object' ? p.proposta : {}) as Record<string, unknown>;
        const unidadesIn = (Array.isArray(pr.unidades) ? pr.unidades : []) as Array<Record<string, unknown>>;
        const modelosIn = (Array.isArray(pr.modelos) ? pr.modelos : []) as Array<Record<string, unknown>>;
        if (unidadesIn.length > MAX_UNIDADES_PROPOSTA) throw new HttpsError('invalid-argument', `No máximo ${MAX_UNIDADES_PROPOSTA} unidades novas por rito`);
        if (modelosIn.length > MAX_MODELOS_PROPOSTA) throw new HttpsError('invalid-argument', `No máximo ${MAX_MODELOS_PROPOSTA} modelos novos por rito`);
        const [ritosQtd, modelosSnap] = await Promise.all([
            db.collection(COL.ritos).where('organization_id', '==', orgId).count().get(),
            db.collection(COL.modelos).where('organization_id', '==', orgId).select('unidade_id').get(),
        ]);
        if (ritosQtd.data().count >= MAX_RITOS) throw new HttpsError('resource-exhausted', 'Limite de ritos atingido');
        if (modelosSnap.size + modelosIn.length > MAX_MODELOS) throw new HttpsError('resource-exhausted', 'Limite de modelos atingido');
        const refUn = new Map<string, string>();
        const novasUnidades = unidadesIn.map((u) => {
            const nome = texto(u.nome, 120);
            if (!nome) throw new HttpsError('invalid-argument', 'Unidade nova sem nome');
            const ref = db.collection(COL.unidades).doc();
            refUn.set(String(u.ref), ref.id);
            return { ref, nome, sigla: texto(u.sigla, 12), tipo: tipoUnidade(u.tipo) };
        });
        const unidadesValidas = new Set([...c.unidades.map((u) => u.id), ...refUn.values()]);
        const unidadeDe = (r: unknown) => {
            const s = String(r || '');
            const id = refUn.get(s) || s;
            return unidadesValidas.has(id) ? id : null;
        };
        const refMod = new Map<string, string>();
        const novosModelos = modelosIn.map((m) => {
            const nome = texto(m.nome, 120);
            if (!nome) throw new HttpsError('invalid-argument', 'Modelo novo sem nome');
            const ref = db.collection(COL.modelos).doc();
            refMod.set(String(m.ref), ref.id);
            return { ref, nome, unidade_id: unidadeDe(m.unidade_ref), tipo_documento: texto(m.tipo_documento, 60) };
        });
        const modelosValidos = new Set([...modelosSnap.docs.map((d) => d.id), ...refMod.values()]);
        const ritoIn = (pr.rito && typeof pr.rito === 'object' ? pr.rito : {}) as Record<string, unknown>;
        const fasesIn = (Array.isArray(ritoIn.fases) ? ritoIn.fases : []) as Array<Record<string, unknown>>;
        let rito: Rito;
        try {
            rito = sanitizeRito({
                ...ritoIn,
                fases: fasesIn.map((f) => ({
                    ...f,
                    unidade_id: unidadeDe(f.unidade_ref ?? f.unidade_id) || undefined,
                    modelos: (Array.isArray(f.modelos_ref) ? f.modelos_ref : []).map((r) => refMod.get(String(r)) || String(r)),
                })),
            });
        } catch (e) { erroUsuario(e); }
        rito = filtrarRefsRito(rito!, unidadesValidas, modelosValidos);
        const batch = db.batch();
        const origem = `Criada ao implantar o rito "${rito.nome}".`;
        for (const u of novasUnidades) {
            batch.set(u.ref, {
                organization_id: orgId, nome: u.nome, sigla: u.sigla, tipo: u.tipo, descricao: origem,
                lotacoes: [], membros_uids: [], pedidos: [], ativa: true, created_at: agora, created_by: auth.uid,
            });
        }
        for (const m of novosModelos) {
            batch.set(m.ref, {
                organization_id: orgId, nome: m.nome, tipo_documento: m.tipo_documento, descricao: `Modelo do rito "${rito.nome}". Complete o texto.`,
                conteudo: sanitizeDoc(esqueletoModelo(m.nome)), unidade_id: m.unidade_id, formato: 'editor', ativo: true,
                created_at: agora, created_by: auth.uid, updated_at: agora, updated_by: auth.uid,
            });
        }
        const ritoRef = db.collection(COL.ritos).doc();
        batch.set(ritoRef, { ...rito, organization_id: orgId, versao: 1, ativo: true, created_at: agora, created_by: auth.uid, origem: 'importacao' });
        const tp = pr.tipo_processo && typeof pr.tipo_processo === 'object' ? pr.tipo_processo as Record<string, unknown> : null;
        let tipoId: string | null = null;
        if (tp && texto(tp.nome)) {
            const ref = db.collection(COL.tipos).doc();
            tipoId = ref.id;
            batch.set(ref, {
                nome: texto(tp.nome), sigla: texto(tp.sigla, 12), descricao: texto(tp.descricao, MAX_TEXTO_LONGO), rito_id: ritoRef.id,
                sigilo_padrao: tp.sigilo_padrao === 'restrito' ? 'restrito' : 'normal', unidade_inicial: rito.fases[0]?.unidade_id || null,
                ativo: true, organization_id: orgId, created_at: agora, created_by: auth.uid, updated_at: agora, updated_by: auth.uid,
            });
        }
        await batch.commit();
        await audit('SECRETARIA_RITO_IMPLANTADO', {
            rito_id: ritoRef.id, nome: rito.nome, fases: rito.fases.length, unidades_novas: novasUnidades.length, modelos_novos: novosModelos.length, tipo_id: tipoId,
        });
        return { success: true, rito_id: ritoRef.id, tipo_id: tipoId, unidades: novasUnidades.map((u) => u.ref.id), modelos: novosModelos.map((m) => m.ref.id) };
    }

    if (p.action === 'salvarRito') {
        let rito;
        try { rito = sanitizeRito(p.rito); } catch (e) { erroUsuario(e); }
        const modelosOrg = await db.collection(COL.modelos).where('organization_id', '==', orgId).select().get();
        rito = filtrarRefsRito(rito!, new Set(c.unidades.map((u) => u.id)), new Set(modelosOrg.docs.map((d) => d.id)));
        const col = db.collection(COL.ritos);
        if (p.id) {
            const ref = col.doc(p.id);
            const snap = await ref.get();
            if (!snap.exists || snap.data()?.organization_id !== orgId) throw new HttpsError('not-found', 'Rito não encontrado');
            // Processos guardam a cópia das fases com que foram autuados; mudar
            // o rito só vale para os próximos. A versão anterior fica guardada.
            await guardarVersao(ref, snap.data()!, CAMPOS_RITO);
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
        // Campos do "Novo processo" deste tipo: os padrões e os próprios do órgão.
        let formulario;
        try { formulario = sanitizeFormulario(t.formulario); } catch (e) { erroUsuario(e); }
        const dados = {
            nome, sigla: texto(t.sigla, 12), descricao: texto(t.descricao, MAX_TEXTO_LONGO), rito_id: String(t.rito_id), formulario,
            sigilo_padrao: t.sigilo_padrao === 'restrito' ? 'restrito' : 'normal', urgente: t.urgente === true, unidade_inicial: unidadeInicial || null,
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
        await audit('SECRETARIA_TIPO_SALVO', { tipo_id: p.id, nome, campos: formulario!.campos.length });
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
