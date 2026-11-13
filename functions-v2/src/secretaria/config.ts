import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { MAX_TEXTO_LONGO, Rito, documentoEfetivo, lotacoesDe, sanitizeCalendario, sanitizeRito, texto, tipoUnidade } from '../shared/secretaria';
import { sanitizeDoc } from '../shared/documento';
import { formularioDe, sanitizeFormulario } from '../shared/camposProcesso';
import { numeracaoDe, numeracaoTipoDe, sanitizeNumeracao, sanitizeNumeracaoTipo } from '../shared/numeracao';
import { COL, REGION, carregarContexto, erroUsuario, exigirAdmin, exigirAuth, exigirGestor } from './context';
import { cienciaDias, sanitizeTextosProntos, textosProntosDe } from '../shared/comunicacoes';
import { emArvore, orgaosDe, sanitizeCompetencias } from '../shared/orgaos';
import { criarEstrutura, lerOrgaos, removerOrgao, salvarOrgao } from './orgaos';
import { sanitizeDocumentoConfig } from './documentoConfig';
import { MAX_MODELO_BYTES, MIME_BIZAGI, MIMES_ORIGINAL, interpretarModelo, preencherDocx, textoParaRito } from './importarModelo';
import { MIME_DOCX } from './conversao';
import { MODULOS, ROTULO_MODULO, ehModuloOrigem, integracoesDe, integracoesGravadas, lerFlags, modulosAtivos } from '../shared/modulos';
import type { Contexto } from './context';
import {
    aceitarConviteEquipe, convidarEquipe, convitesPendentes, decidirPedido, obterUnidadeDocumento, pedirLotacao,
    excluirUnidade, revogarConviteEquipe, salvarUnidade, salvarUnidadeDocumento, verConviteEquipe,
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
            // Documento exigido com modelo de fora do órgão: fica a exigência, sem o modelo.
            const limpa = <T extends { modelo_id?: string }>(e: T): T => {
                if (!e.modelo_id || modelos.has(e.modelo_id)) return e;
                const { modelo_id: _fora, ...sem } = e;
                return sem as T;
            };
            if (resto.documentos) resto.documentos = resto.documentos.map(limpa);
            if (resto.acoes_regras) resto.acoes_regras = resto.acoes_regras.map((r) => (r?.documento ? { ...r, documento: limpa(r.documento) } : r));
            return { ...resto,...(unidade_id && unidades.has(unidade_id) ? { unidade_id } : {}), ...(validos.length ? { modelos: validos } : {}) };
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
const MAX_TIPOS = 100;
/** Ritos, tipos e modelos excluídos (suave) não contam no limite nem aparecem nas listas. */
const naoExcluidos = (snap: admin.firestore.QuerySnapshot) => snap.docs.filter((d) => d.data().excluido !== true);
const quando = (v: unknown): string | null => (v && typeof (v as { toDate?: unknown }).toDate === 'function'
    ? (v as admin.firestore.Timestamp).toDate().toISOString() : typeof v === 'string' ? v : null);
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

type Acao = 'estado' | 'ativar' | 'salvarUnidade' | 'salvarRito' | 'salvarPreferencias' | 'salvarTipo' | 'salvarNumeracao'
    | 'salvarDocumentoConfig' | 'salvarModelo' | 'obterModelo' | 'salvarCalendario'
    | 'obterUnidadeDocumento' | 'salvarUnidadeDocumento' | 'convidarEquipe' | 'revogarConviteEquipe'
    | 'pedirLotacao' | 'decidirPedido' | 'verConviteEquipe' | 'aceitarConviteEquipe'
    | 'importarModelo' | 'baixarModelo' | 'extrairTextoRito' | 'aplicarPropostaRito'
    | 'versoes' | 'restaurarVersao' | 'excluirRito' | 'salvarOrgao' | 'removerOrgao' | 'criarEstrutura' | 'salvarTextosComunicacao' | 'excluirUnidade'
    | 'excluirTipo' | 'excluirModelo' | 'restaurar' | 'salvarIntegracoes';

interface ConfigRequest extends Record<string, unknown> {
    organizationId: string;
    action: Acao;
    calendario?: unknown;
    alerta_prazos?: boolean;
    documento?: unknown;
    modelo?: unknown;
    tipo?: unknown;
    peticao_interrompe?: boolean;
    /** Dias corridos até a ciência por decurso (0 desliga). */
    ciencia_dias?: number;
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
    orgao?: unknown;
    orgaos?: unknown;
    textos?: unknown;
    integracoes?: unknown;
}

/** Módulos de onde o tipo (campos) ou o rito (ações) puxam registros. */
const modulosDoForm = (f: { campos?: Array<{ tipo?: string; modulo?: string }> } | null | undefined) =>
    new Set((f?.campos || []).filter((x) => x.tipo === 'registro' && x.modulo).map((x) => String(x.modulo)));
const modulosDoRito = (r: { fases?: unknown } | null | undefined) => new Set((Array.isArray(r?.fases) ? r!.fases as Array<{ acoes_regras?: Array<{ pede?: string; modulo?: string } | null> }> : [])
    .flatMap((f) => (f.acoes_regras || []).filter((x) => x?.pede === 'registro' && x.modulo).map((x) => String(x!.modulo))));

/** De onde o tipo pode nascer ("Criar processo eletrônico" no outro módulo ou "Novo processo derivado"). */
const nascerDe = (v: unknown): string[] => [...new Set(Array.isArray(v) ? v.filter(ehModuloOrigem) : [])];
/** Módulos que o tipo usa: os dos campos e os de onde pode nascer. */
const modulosDoTipo = (t: { formulario?: unknown; pode_nascer_de?: unknown } | null | undefined) =>
    new Set([...modulosDoForm(t?.formulario as never), ...nascerDe(t?.pode_nascer_de).filter((m) => m !== 'pe')]);

/** Módulo novo no tipo ou no rito precisa da integração ligada (o que já estava gravado segue valendo). */
async function exigirIntegracoes(c: Contexto, usados: Set<string>, antes: Set<string>) {
    const novos = [...usados].filter((m) => !antes.has(m));
    if (!novos.length) return;
    const ligadas = integracoesDe(c.org, await lerFlags(c.db)) as Record<string, boolean>;
    const off = novos.filter((m) => !ligadas[m]);
    if (off.length) {
        throw new HttpsError('failed-precondition', `Ligue a integração com ${off.map((m) => ROTULO_MODULO[m as keyof typeof ROTULO_MODULO] || m).join(' e ')} em "Integrações com outros módulos" antes de usar registros dele`);
    }
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
            db.collection(COL.modelos).where('organization_id', '==', orgId).select('nome', 'tipo_documento', 'descricao', 'ativo', 'unidade_id', 'orgao_id', 'formato', 'arquivo_nome', 'excluido', 'excluido_em').get(),
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
                // Sem nome cadastrado, o e-mail só serve de nome para quem já pode vê-lo.
                nome: String(m.user_name || (veEmail && m.user_email) || 'Membro'),
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
            // Integrações: o que o admin ligou e quais módulos o órgão tem ativos.
            integracoes: integracoesGravadas(c.org),
            modulos_ativos: modulosAtivos(c.org, await lerFlags(db)),
            isAdmin: c.ctx.isAdmin,
            uid: c.ctx.uid,
            minhasUnidades: minhas,
            gestorDe: c.gestorDe,
            // Órgãos internos, na ordem do organograma (vazio = entidade singular).
            orgaos: emArvore(orgaosDe(cfgSnap.data()?.orgaos)),
            // Unidade excluída só empresta o nome ao que já está nos autos.
            unidades_excluidas: c.unidades.filter((u) => u.excluida).map((u) => ({ id: u.id, nome: u.nome, sigla: u.sigla || '' })),
            unidades: c.unidades.filter((u) => !u.excluida).map((u) => {
                const gere = c.ctx.isAdmin || c.gestorDe.includes(u.id);
                const lotacoes = lotacoesDe(u);
                return {
                    id: u.id, nome: u.nome, sigla: u.sigla || '', tipo: u.tipo || 'secretaria', descricao: u.descricao || '',
                    orgao_id: u.orgao_id || null, competencias: sanitizeCompetencias(u.competencias),
                    ativa: u.ativa !== false, membros_uids: lotacoes.map((l) => l.uid), lotacoes,
                    ...(gere ? { pedidos: Array.isArray(u.pedidos) ? u.pedidos : [] } : {}),
                    pedi_lotacao: Array.isArray(u.pedidos) && u.pedidos.some((x: { uid: string }) => x.uid === auth.uid),
                    criada_por_mim: u.created_by === auth.uid,
                };
            }).sort((a, b) => String(a.nome).localeCompare(String(b.nome))),
            convitesEquipe: convites,
            ritos: ritosSnap.docs.filter((d) => d.data().excluido !== true).map((d) => {
                const r = d.data();
                return { id: d.id, nome: r.nome, descricao: r.descricao, fases: r.fases, versao: r.versao, ativo: r.ativo !== false };
            }),
            tipos: naoExcluidos(tiposSnap).map((d) => {
                const t = d.data();
                return {
                    id: d.id, nome: t.nome, sigla: t.sigla || '', descricao: t.descricao || '', rito_id: t.rito_id,
                    sigilo_padrao: t.sigilo_padrao || 'normal', urgente: t.urgente === true, unidade_inicial: t.unidade_inicial || null, ativo: t.ativo !== false,
                    orgao_id: t.orgao_id || null, formulario: formularioDe(t), numeracao: numeracaoTipoDe(t.numeracao), pode_nascer_de: nascerDe(t.pode_nascer_de),
                };
            }).sort((a, b) => a.nome.localeCompare(b.nome)),
            // Processos já autuados com um tipo excluído seguem com o formulário dele (Editar dados, filtro da lista).
            tipos_excluidos: tiposSnap.docs.filter((d) => d.data().excluido === true)
                .map((d) => ({ id: d.id, nome: d.data().nome, formulario: formularioDe(d.data()) })),
            documento,
            documentoUnidades,
            calendario: sanitizeCalendario(cfgSnap.data()?.calendario),
            numeracao: numeracaoDe(cfgSnap.data()?.numeracao),
            alerta_prazos: cfgSnap.data()?.alerta_prazos === true,
            ciencia_dias: cienciaDias(cfgSnap.data()?.ciencia_dias),
            textos_comunicacao: textosProntosDe(cfgSnap.data()?.textos_comunicacao),
            modelos: naoExcluidos(modelosSnap).map((d) => {
                const m = d.data();
                return {
                    id: d.id, nome: m.nome, tipo_documento: m.tipo_documento || '', descricao: m.descricao || '', ativo: m.ativo !== false,
                    unidade_id: m.unidade_id || null, orgao_id: m.orgao_id || null, formato: m.formato || 'editor', arquivo_nome: m.arquivo_nome || '',
                };
            }).sort((a, b) => a.nome.localeCompare(b.nome)),
            // Lixeira: o admin restaura ritos, tipos e modelos; a gestão, os modelos da sua unidade.
            excluidos: [
                ...(c.ctx.isAdmin ? ritosSnap.docs.filter((d) => d.data().excluido === true).map((d) => ({ colecao: 'rito', id: d.id, nome: d.data().nome, em: quando(d.data().excluido_em) })) : []),
                ...(c.ctx.isAdmin ? tiposSnap.docs.filter((d) => d.data().excluido === true).map((d) => ({ colecao: 'tipo', id: d.id, nome: d.data().nome, em: quando(d.data().excluido_em), rito_id: d.data().rito_id || null })) : []),
                ...modelosSnap.docs.filter((d) => d.data().excluido === true && (c.ctx.isAdmin || (d.data().unidade_id && c.gestorDe.includes(d.data().unidade_id))))
                    .map((d) => ({ colecao: 'modelo', id: d.id, nome: d.data().nome, em: quando(d.data().excluido_em), unidade_id: d.data().unidade_id || null, orgao_id: d.data().orgao_id || null })),
            ].sort((a, b) => String(b.em || '').localeCompare(String(a.em || ''))),
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
            ativo: m.ativo !== false, unidade_id: m.unidade_id || null, orgao_id: m.orgao_id || null, formato: m.formato || 'editor', arquivo_nome: m.arquivo_nome || '',
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
    if (p.action === 'excluirUnidade') return excluirUnidade(c, p, auth.uid, audit);
    if (p.action === 'salvarOrgao') return salvarOrgao(c, p, auth.uid, audit);
    if (p.action === 'removerOrgao') return removerOrgao(c, p, auth.uid, audit);
    if (p.action === 'criarEstrutura') return criarEstrutura(c, p, auth.uid, audit);
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
        if (p.id && (atual?.organization_id !== orgId || atual?.excluido === true)) throw new HttpsError('not-found', 'Modelo não encontrado');
        // Modelo do órgão: admin. Modelo de unidade: gestão dela (antes e depois de mudar).
        const unidadeId = m.unidade_id ? String(m.unidade_id) : null;
        for (const u of new Set([unidadeId, atual ? (atual.unidade_id || null) : unidadeId])) {
            if (u) exigirGestor(c, u); else exigirAdmin(c);
        }
        const nome = texto(m.nome, 120);
        if (!nome) throw new HttpsError('invalid-argument', 'Dê um nome ao modelo');
        // Modelo da entidade pode ser só de um órgão interno (vale para as unidades dele).
        const orgaoModelo = unidadeId ? '' : String(m.orgao_id || '');
        if (orgaoModelo && !(await lerOrgaos(db, orgId)).some((o) => o.id === orgaoModelo)) throw new HttpsError('invalid-argument', 'Órgão do modelo inválido');
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
            nome, tipo_documento: texto(m.tipo_documento, 60), descricao: texto(m.descricao, 500), conteudo, unidade_id: unidadeId, ...('orgao_id' in m || unidadeId ? { orgao_id: orgaoModelo || null } : {}),
            ativo: m.ativo !== false, updated_at: agora, updated_by: auth.uid,
        };
        const ref = p.id ? col.doc(p.id) : col.doc();
        if (!p.id && naoExcluidos(await col.where('organization_id', '==', orgId).select('excluido').get()).length >= MAX_MODELOS) {
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

    // Exclusão suave de modelo: some das listas e das indicações novas. Documentos
    // já redigidos a partir dele não mudam; restaurar o traz de volta, inativo.
    if (p.action === 'excluirModelo' || (p.action === 'restaurar' && p.colecao === 'modelo')) {
        const ref = db.collection(COL.modelos).doc(String(p.id || '_'));
        const atual = (await ref.get()).data();
        const excluir = p.action === 'excluirModelo';
        if (!atual || atual.organization_id !== orgId || (atual.excluido === true) !== !excluir) throw new HttpsError('not-found', 'Modelo não encontrado');
        if (atual.unidade_id && c.unidades.some((u) => u.id === atual.unidade_id && !u.excluida)) exigirGestor(c, String(atual.unidade_id)); else exigirAdmin(c);
        if (!excluir && naoExcluidos(await db.collection(COL.modelos).where('organization_id', '==', orgId).select('excluido').get()).length >= MAX_MODELOS) {
            throw new HttpsError('resource-exhausted', 'Limite de modelos atingido');
        }
        await ref.update(excluir
            ? { excluido: true, ativo: false, excluido_em: agora, excluido_por: auth.uid, updated_at: agora, updated_by: auth.uid }
            : { excluido: false, ativo: false, excluido_em: FieldValue.delete(), excluido_por: FieldValue.delete(), updated_at: agora, updated_by: auth.uid });
        await audit(excluir ? 'SECRETARIA_MODELO_EXCLUIDO' : 'SECRETARIA_MODELO_RESTAURADO', { modelo_id: ref.id, nome: atual.nome, unidade_id: atual.unidade_id || null });
        return { success: true };
    }

    // Versões anteriores de um rito (admin) ou de um modelo do editor (gestão).
    if (p.action === 'versoes' || p.action === 'restaurarVersao') {
        const col = p.colecao === 'rito' ? COL.ritos : p.colecao === 'modelo' ? COL.modelos : null;
        if (!col) throw new HttpsError('invalid-argument', 'Coleção inválida');
        const ref = db.collection(col).doc(String(p.id || '_'));
        const atual = (await ref.get()).data();
        if (!atual || atual.organization_id !== orgId || atual.excluido === true) throw new HttpsError('not-found', 'Não encontrado');
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
        const dias = cienciaDias(p.ciencia_dias);
        await db.collection(COL.config).doc(orgId).set({ organization_id: orgId, ciencia_dias: dias, updated_at: agora, updated_by: auth.uid }, { merge: true });
        await audit('SECRETARIA_PREFERENCIAS', { peticao_interrompe: interrompe, ciencia_dias: dias });
        return { success: true };
    }

    if (p.action === 'salvarIntegracoes') {
        // Cada módulo do órgão pode entrar nos processos (campo e ação "registro"). Só o admin.
        exigirAdmin(c);
        const pedido = (p.integracoes && typeof p.integracoes === 'object' ? p.integracoes : {}) as Record<string, unknown>;
        const ativos = modulosAtivos(c.org, await lerFlags(db));
        // Módulo inativo agora não liga, mas guarda o que o admin tinha escolhido (volta a valer quando o módulo voltar).
        const gravadas = integracoesGravadas(c.org);
        const integracoes = Object.fromEntries(MODULOS.map((m) => [m, pedido[m] === true && (ativos[m] || gravadas[m])]));
        await db.collection('organizations').doc(orgId).update({
            'secretariaConfig.integracoes': integracoes, 'secretariaConfig.updated_at': agora, 'secretariaConfig.updated_by': auth.uid,
        });
        await audit('SECRETARIA_INTEGRACOES', integracoes);
        return { success: true, integracoes };
    }

    if (p.action === 'salvarNumeracao') {
        // Numeração do órgão: vale para quem autua sem tipo e para os tipos que não têm a sua.
        let numeracao;
        try { numeracao = sanitizeNumeracao(p.numeracao); } catch (e) { erroUsuario(e); }
        await db.collection(COL.config).doc(orgId).set({ organization_id: orgId, numeracao, updated_at: agora, updated_by: auth.uid }, { merge: true });
        await audit('SECRETARIA_NUMERACAO', { partes: numeracao!.partes.map((x) => x.t).join(',') });
        return { success: true };
    }

    if (p.action === 'salvarTextosComunicacao') {
        let textos;
        try { textos = sanitizeTextosProntos(p.textos); } catch (e) { erroUsuario(e); }
        await db.collection(COL.config).doc(orgId).set({ organization_id: orgId, textos_comunicacao: textos, updated_at: agora, updated_by: auth.uid }, { merge: true });
        await audit('SECRETARIA_TEXTOS_COMUNICACAO', { textos: textos!.length });
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
        // Com rito_id, a mesma tela edita um rito existente (nova versão); sem, cria.
        const editarId = typeof pr.rito_id === 'string' && pr.rito_id ? pr.rito_id : null;
        const [ritosSnap, modelosSnap, ritoAtualSnap] = await Promise.all([
            editarId ? null : db.collection(COL.ritos).where('organization_id', '==', orgId).select('excluido').get(),
            db.collection(COL.modelos).where('organization_id', '==', orgId).select('excluido').get(),
            editarId ? db.collection(COL.ritos).doc(editarId).get() : null,
        ]);
        const ritoAtual = ritoAtualSnap?.data();
        if (editarId && (!ritoAtual || ritoAtual.organization_id !== orgId || ritoAtual.excluido === true)) throw new HttpsError('not-found', 'Rito não encontrado');
        if (ritosSnap && ritosSnap.docs.filter((d) => d.data().excluido !== true).length >= MAX_RITOS) throw new HttpsError('resource-exhausted', 'Limite de ritos atingido');
        if (naoExcluidos(modelosSnap).length + modelosIn.length > MAX_MODELOS) throw new HttpsError('resource-exhausted', 'Limite de modelos atingido');
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
        const modelosValidos = new Set([...naoExcluidos(modelosSnap).map((d) => d.id), ...refMod.values()]);
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
        await exigirIntegracoes(c, modulosDoRito(rito), modulosDoRito(ritoAtual));
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
        const ritoRef = editarId ? db.collection(COL.ritos).doc(editarId) : db.collection(COL.ritos).doc();
        let versao = 1;
        if (editarId) {
            // Processos guardam a cópia das fases com que foram autuados; a versão anterior fica guardada.
            await guardarVersao(ritoRef, ritoAtual!, CAMPOS_RITO);
            versao = (Number(ritoAtual!.versao) || 1) + 1;
            batch.update(ritoRef, { ...rito, ativo: pr.ativo !== false, versao, updated_at: agora, updated_by: auth.uid });
        } else {
            batch.set(ritoRef, { ...rito, organization_id: orgId, versao, ativo: true, created_at: agora, created_by: auth.uid, origem: 'importacao' });
        }
        const tp = pr.tipo_processo && typeof pr.tipo_processo === 'object' ? pr.tipo_processo as Record<string, unknown> : null;
        let tipoId: string | null = null;
        if (tp && texto(tp.nome)) {
            if (naoExcluidos(await db.collection(COL.tipos).where('organization_id', '==', orgId).select('excluido').get()).length >= MAX_TIPOS) {
                throw new HttpsError('resource-exhausted', 'Limite de tipos atingido. Implante sem criar o tipo, ou exclua um tipo antes.');
            }
            const ref = db.collection(COL.tipos).doc();
            tipoId = ref.id;
            batch.set(ref, {
                nome: texto(tp.nome), sigla: texto(tp.sigla, 12), descricao: texto(tp.descricao, MAX_TEXTO_LONGO), rito_id: ritoRef.id,
                sigilo_padrao: tp.sigilo_padrao === 'restrito' ? 'restrito' : 'normal', unidade_inicial: rito.fases[0]?.unidade_id || null,
                ativo: true, organization_id: orgId, created_at: agora, created_by: auth.uid, updated_at: agora, updated_by: auth.uid,
            });
        }
        await batch.commit();
        await audit(editarId ? 'SECRETARIA_RITO_SALVO' : 'SECRETARIA_RITO_IMPLANTADO', {
            rito_id: ritoRef.id, nome: rito.nome, fases: rito.fases.length, unidades_novas: novasUnidades.length, modelos_novos: novosModelos.length, tipo_id: tipoId, versao,
        });
        return { success: true, rito_id: ritoRef.id, versao, tipo_id: tipoId, unidades: novasUnidades.map((u) => u.ref.id), modelos: novosModelos.map((m) => m.ref.id) };
    }

    if (p.action === 'salvarRito') {
        let rito;
        try { rito = sanitizeRito(p.rito); } catch (e) { erroUsuario(e); }
        const modelosOrg = await db.collection(COL.modelos).where('organization_id', '==', orgId).select('excluido').get();
        rito = filtrarRefsRito(rito!, new Set(c.unidades.map((u) => u.id)), new Set(naoExcluidos(modelosOrg).map((d) => d.id)));
        const col = db.collection(COL.ritos);
        if (p.id) {
            const ref = col.doc(p.id);
            const snap = await ref.get();
            if (!snap.exists || snap.data()?.organization_id !== orgId || snap.data()?.excluido === true) throw new HttpsError('not-found', 'Rito não encontrado');
            await exigirIntegracoes(c, modulosDoRito(rito), modulosDoRito(snap.data()));
            // Processos guardam a cópia das fases com que foram autuados; mudar
            // o rito só vale para os próximos. A versão anterior fica guardada.
            await guardarVersao(ref, snap.data()!, CAMPOS_RITO);
            await ref.update({ ...rito, ativo: p.ativo !== false, versao: (Number(snap.data()?.versao) || 1) + 1, updated_at: agora, updated_by: auth.uid });
        } else {
            const qtd = (await col.where('organization_id', '==', orgId).select('excluido').get()).docs.filter((d) => d.data().excluido !== true).length;
            if (qtd >= MAX_RITOS) throw new HttpsError('resource-exhausted', 'Limite de ritos atingido');
            await exigirIntegracoes(c, modulosDoRito(rito), new Set());
            const ref = await col.add({ ...rito, organization_id: orgId, versao: 1, ativo: true, created_at: agora, created_by: auth.uid });
            p.id = ref.id;
        }
        await audit('SECRETARIA_RITO_SALVO', { rito_id: p.id, nome: rito!.nome });
        return { success: true, id: p.id };
    }

    if (p.action === 'excluirRito') {
        // Exclusão suave: o rito some das listas e não autua mais. Processos já
        // autuados seguem com a cópia das fases; o histórico fica guardado.
        const ref = db.collection(COL.ritos).doc(String(p.id || '_'));
        const atual = (await ref.get()).data();
        if (!atual || atual.organization_id !== orgId || atual.excluido === true) throw new HttpsError('not-found', 'Rito não encontrado');
        // Tipo excluído não prende o rito (os processos dele já têm a cópia das fases).
        const tipos = naoExcluidos(await db.collection(COL.tipos).where('organization_id', '==', orgId).where('rito_id', '==', ref.id).select('nome', 'excluido').get());
        if (tipos.length) {
            throw new HttpsError('failed-precondition', `O rito é usado por ${tipos.length === 1 ? 'um tipo de processo' : `${tipos.length} tipos de processo`} (${tipos.map((d) => d.data().nome).join(', ')}). Troque o rito desses tipos (inclusive os inativos) ou exclua-os antes.`);
        }
        await ref.update({ excluido: true, ativo: false, excluido_em: agora, excluido_por: auth.uid, updated_at: agora, updated_by: auth.uid });
        await audit('SECRETARIA_RITO_EXCLUIDO', { rito_id: ref.id, nome: atual.nome });
        return { success: true };
    }

    if (p.action === 'salvarTipo') {
        const t = (p.tipo && typeof p.tipo === 'object' ? p.tipo : {}) as Record<string, unknown>;
        const nome = texto(t.nome);
        if (!nome) throw new HttpsError('invalid-argument', 'Dê um nome ao tipo de processo');
        const rito = (await db.collection(COL.ritos).doc(String(t.rito_id || '_')).get()).data();
        if (!rito || rito.organization_id !== orgId || rito.excluido === true) throw new HttpsError('invalid-argument', 'Escolha o rito do tipo de processo');
        const unidadeInicial = String(t.unidade_inicial || '');
        if (unidadeInicial && !c.unidades.some((u) => u.id === unidadeInicial)) throw new HttpsError('invalid-argument', 'Unidade inicial inválida');
        // Tipo próprio de um órgão interno: só as unidades dele autuam.
        const orgaoId = String(t.orgao_id || '');
        if (orgaoId && !(await lerOrgaos(db, orgId)).some((o) => o.id === orgaoId)) throw new HttpsError('invalid-argument', 'Órgão do tipo de processo inválido');
        // Campos do "Novo processo" deste tipo: os padrões e os próprios do órgão.
        let formulario;
        let numeracao;
        try { formulario = sanitizeFormulario(t.formulario); numeracao = sanitizeNumeracaoTipo(t.numeracao); } catch (e) { erroUsuario(e); }
        // "Exigido para sair das fases": só fases do rito escolhido.
        const faseIds = new Set(((rito.fases || []) as Array<{ id: string }>).map((f) => f.id));
        formulario!.campos = formulario!.campos.map(({ exigir_em: ex, ...x }) => {
            const l = (ex || []).filter((f) => faseIds.has(f));
            // Todas as fases marcadas sumiram do rito: o campo ficaria sem exigência nenhuma sem ninguém ver.
            if (ex?.length && !l.length) {
                throw new HttpsError('invalid-argument', `"${x.rotulo}": as fases marcadas em "Exigir para sair das fases" não existem no rito deste tipo. Marque outras ou volte a torná-lo obrigatório.`);
            }
            return l.length ? { ...x, exigir_em: l } : x;
        });
        const dados = {
            nome, sigla: texto(t.sigla, 12), descricao: texto(t.descricao, MAX_TEXTO_LONGO), rito_id: String(t.rito_id), formulario, numeracao, pode_nascer_de: nascerDe(t.pode_nascer_de),
            sigilo_padrao: t.sigilo_padrao === 'restrito' ? 'restrito' : 'normal', urgente: t.urgente === true, unidade_inicial: unidadeInicial || null, ...('orgao_id' in t ? { orgao_id: orgaoId || null } : {}),
            ativo: t.ativo !== false, updated_at: agora, updated_by: auth.uid,
        };
        const col = db.collection(COL.tipos);
        if (p.id) {
            const ref = col.doc(p.id);
            const atual = (await ref.get()).data();
            if (atual?.organization_id !== orgId || atual?.excluido === true) throw new HttpsError('not-found', 'Tipo não encontrado');
            await exigirIntegracoes(c, modulosDoTipo(dados), modulosDoTipo(atual));
            await ref.update(dados);
        } else {
            if (naoExcluidos(await col.where('organization_id', '==', orgId).select('excluido').get()).length >= MAX_TIPOS) throw new HttpsError('resource-exhausted', 'Limite de tipos atingido');
            await exigirIntegracoes(c, modulosDoTipo(dados), new Set());
            p.id = (await col.add({ ...dados, organization_id: orgId, created_at: agora, created_by: auth.uid })).id;
        }
        await audit('SECRETARIA_TIPO_SALVO', { tipo_id: p.id, nome, campos: formulario!.campos.length });
        return { success: true, id: p.id };
    }

    if (p.action === 'excluirTipo') {
        // Exclusão suave: o tipo some das listas e não autua mais. Processos já
        // autuados com ele seguem iguais (guardam as fases e os campos).
        const ref = db.collection(COL.tipos).doc(String(p.id || '_'));
        const atual = (await ref.get()).data();
        if (!atual || atual.organization_id !== orgId || atual.excluido === true) throw new HttpsError('not-found', 'Tipo não encontrado');
        await ref.update({ excluido: true, ativo: false, excluido_em: agora, excluido_por: auth.uid, updated_at: agora, updated_by: auth.uid });
        await audit('SECRETARIA_TIPO_EXCLUIDO', { tipo_id: ref.id, nome: atual.nome });
        return { success: true };
    }

    if (p.action === 'restaurar') {
        // Volta inativo: o admin confere e reativa de propósito.
        const col = p.colecao === 'rito' ? COL.ritos : p.colecao === 'tipo' ? COL.tipos : null;
        if (!col) throw new HttpsError('invalid-argument', 'Coleção inválida');
        const ref = db.collection(col).doc(String(p.id || '_'));
        const atual = (await ref.get()).data();
        if (!atual || atual.organization_id !== orgId || atual.excluido !== true) throw new HttpsError('not-found', 'Não encontrado');
        if (naoExcluidos(await db.collection(col).where('organization_id', '==', orgId).select('excluido').get()).length >= (col === COL.ritos ? MAX_RITOS : MAX_TIPOS)) {
            throw new HttpsError('resource-exhausted', col === COL.ritos ? 'Limite de ritos atingido' : 'Limite de tipos atingido');
        }
        const volta: Record<string, unknown> = { excluido: false, ativo: false, excluido_em: FieldValue.delete(), excluido_por: FieldValue.delete(), updated_at: agora, updated_by: auth.uid };
        if (col === COL.tipos) {
            // Tipo cujo rito foi excluído volta com outro rito, escolhido por quem restaura.
            const ritoId = String(p.rito_id || atual.rito_id || '_');
            const rito = (await db.collection(COL.ritos).doc(ritoId).get()).data();
            if (!rito || rito.organization_id !== orgId || rito.excluido === true) {
                throw new HttpsError('failed-precondition', 'O rito deste tipo foi excluído. Escolha outro rito para restaurá-lo.');
            }
            volta.rito_id = ritoId;
        }
        await ref.update(volta);
        await audit(col === COL.ritos ? 'SECRETARIA_RITO_RESTAURADO' : 'SECRETARIA_TIPO_RESTAURADO', { id: ref.id, nome: atual.nome });
        return { success: true };
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
