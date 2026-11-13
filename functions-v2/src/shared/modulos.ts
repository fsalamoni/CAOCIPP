import * as admin from 'firebase-admin';
import { getSmartField } from './fields';
import type { CampoValor, Formulario } from './camposProcesso';

/**
 * Integração do Processo Eletrônico com os outros módulos do órgão. O admin
 * liga cada uma em `secretariaConfig.integracoes`; só vale com o módulo ativo
 * no órgão. O processo guarda só número e título do registro escolhido, nunca
 * consulente, partes, promotor, responsável ou situação.
 */
export const MODULOS = ['consultas', 'expedientes', 'parcerias', 'juri'] as const;
export type Modulo = typeof MODULOS[number];
export const ROTULO_MODULO: Record<Modulo, string> = { consultas: 'Consultas', expedientes: 'Expedientes', parcerias: 'Parcerias', juri: 'Júri' };
const COLECAO: Record<Modulo, string> = { consultas: 'processes', expedientes: 'expedientes', parcerias: 'parcerias', juri: 'juris' };

/** Registro de outro módulo, como fica no processo. `restrito`: a origem tem acesso restrito (as partes nunca veem). */
export interface Ref { modulo: Modulo; id: string; numero: string; titulo?: string; restrito?: true }

type Flags = Record<string, unknown>;

/**
 * Módulos ativos no órgão, com a mesma regra das abas (resolveBuiltinModules e
 * getOrganizationTabs no cliente): sem `moduleConfig`, tudo ligado; páginas
 * personalizadas desligadas na plataforma, tudo ligado; Parcerias e Júri
 * dependem também da flag da plataforma (Júri entra desligado).
 */
export function modulosAtivos(org: Record<string, unknown> | null | undefined, flags: Flags): Record<Modulo, boolean> {
    const cfg = org?.moduleConfig as Record<string, { enabled?: unknown }> | undefined;
    const legado = !cfg || typeof cfg !== 'object';
    const livre = flags.custom_entities === false || legado;
    const on = (k: string) => livre || cfg![k]?.enabled === true;
    return {
        consultas: on('processes'),
        expedientes: on('expedientes'),
        parcerias: flags.parcerias_enabled !== false && on('parcerias'),
        juri: flags.jurimetria_enabled === true && on('jurimetria'),
    };
}

/** O que o admin gravou (sem conferir se o módulo está ativo). */
export function integracoesGravadas(org: Record<string, unknown> | null | undefined): Record<Modulo, boolean> {
    const g = ((org?.secretariaConfig as Record<string, unknown> | undefined)?.integracoes || {}) as Record<string, unknown>;
    return Object.fromEntries(MODULOS.map((m) => [m, g[m] === true])) as Record<Modulo, boolean>;
}

/** Integrações que valem agora: ligadas pelo admin e com o módulo ativo. */
export function integracoesDe(org: Record<string, unknown> | null | undefined, flags: Flags): Record<Modulo, boolean> {
    const ativos = modulosAtivos(org, flags);
    const g = integracoesGravadas(org);
    return Object.fromEntries(MODULOS.map((m) => [m, ativos[m] && g[m]])) as Record<Modulo, boolean>;
}

export async function lerFlags(db: admin.firestore.Firestore): Promise<Flags> {
    const s = await db.collection('platformConfig').doc('featureFlags').get();
    return ((s.data() || {}).flags || {}) as Flags;
}

const curto = (v: unknown, max: number) => (v === undefined || v === null ? '' : String(v).trim().slice(0, max));
const sim = (v: unknown) => v === true || (typeof v === 'string' && /^sim$/i.test(v.trim()));

/** Número e título do registro, por módulo (o que se mostra e se guarda no processo). */
export function refDe(modulo: Modulo, id: string, d: Record<string, unknown>): Ref {
    const pares: Record<Modulo, [unknown, unknown]> = {
        consultas: [getSmartField(d, 'process_number'), d.matter_object],
        expedientes: [d.expediente_number, d.object],
        parcerias: [d.pgea || d.PGEA || d.partnership_number, d.subject || d.assunto],
        juri: [d.numero_processo, d.comarca],
    };
    const [numero, titulo] = pares[modulo];
    const t = curto(titulo, 160);
    return {
        modulo, id, numero: curto(numero, 80) || 'sem número', ...(t ? { titulo: t } : {}),
        ...(sim(d.access_restriction) || d.anonymized === true ? { restrito: true as const } : {}),
    };
}

/** Lê o registro do outro módulo, conferindo o órgão. Qualquer falha: null (sem dizer se existe noutro órgão). */
export async function resolverRegistro(db: admin.firestore.Firestore, orgId: string, modulo: Modulo, id: unknown): Promise<Ref | null> {
    if (!MODULOS.includes(modulo) || typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
    try {
        const s = await db.collection(COLECAO[modulo]).doc(id).get();
        const d = s.data();
        if (!s.exists || !d || d.organization_id !== orgId) return null;
        return refDe(modulo, id, d);
    } catch {
        return null;
    }
}

/** Id do registro escolhido na tela (o cliente manda o id ou {id, ...}; só o id vale). */
export const idEscolhido = (v: unknown): string => {
    const x = v && typeof v === 'object' && !Array.isArray(v) ? (v as { id?: unknown }).id : v;
    return typeof x === 'string' ? x.trim() : '';
};

/**
 * Lê os registros escolhidos nos campos 'registro' do formulário (só os que
 * mudaram em relação ao gravado). Integração desligada: Error com mensagem
 * para o usuário. Registro inexistente ou de outro órgão: null no mapa
 * (validarCampos recusa).
 */
export async function refsDoFormulario(
    db: admin.firestore.Firestore, orgId: string, org: Record<string, unknown>,
    form: Pick<Formulario, 'campos'>, valores: unknown, antes: CampoValor[] = [],
): Promise<Map<string, Ref | null | 'desligada'>> {
    const v = (valores && typeof valores === 'object' ? valores : {}) as Record<string, unknown>;
    const gravados = new Map(antes.map((a) => [a.id, a.ref?.id]));
    const pedidos = form.campos.filter((c) => c.tipo === 'registro' && c.modulo && idEscolhido(v[c.id]) && gravados.get(c.id) !== idEscolhido(v[c.id]));
    const out = new Map<string, Ref | null | 'desligada'>();
    if (!pedidos.length) return out;
    const ligadas = integracoesDe(org, await lerFlags(db));
    // Desligada: não lê; validarCampos só recusa se o campo aparece e mudou de fato.
    for (const c of pedidos) out.set(c.id, ligadas[c.modulo!] ? await resolverRegistro(db, orgId, c.modulo!, idEscolhido(v[c.id])) : 'desligada');
    return out;
}

/**
 * Registros (por `modulo:id`) que hoje estão restritos, anonimizados ou não
 * existem mais no órgão. O portal das partes esconde o que estiver aqui, mesmo
 * que fosse público quando foi escolhido.
 */
export async function refsFechadas(db: admin.firestore.Firestore, orgId: string, refs: Array<Ref | undefined | null>): Promise<Set<string>> {
    const unicos = [...new Map(refs.filter((r): r is Ref => !!r && MODULOS.includes(r.modulo)).map((r) => [`${r.modulo}:${r.id}`, r])).values()];
    const fechadas = new Set<string>();
    if (!unicos.length) return fechadas;
    const snaps = await db.getAll(...unicos.map((r) => db.collection(COLECAO[r.modulo]).doc(r.id)));
    snaps.forEach((s, i) => {
        const d = s.data();
        if (!s.exists || !d || d.organization_id !== orgId || sim(d.access_restriction) || d.anonymized === true) fechadas.add(`${unicos[i].modulo}:${unicos[i].id}`);
    });
    return fechadas;
}
