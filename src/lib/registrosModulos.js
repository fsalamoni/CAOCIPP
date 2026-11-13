// ============================================================================
// Busca de registros de outro módulo do órgão (Consultas, Expedientes,
// Parcerias, Júri e páginas próprias) para o campo e a ação "registro" do
// Processo Eletrônico.
// Mesma leitura da busca global (organization_id + updated_at, regra
// isMemberOf), por módulo, com cache curto: as teclas só refiltram em memória.
// Mostra e procura só número e título; o servidor relê o registro escolhido.
// ============================================================================

import { collection, doc, getDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { getProcessField } from '@/utils/processUtils';
import { getParceriaField } from '@/utils/parceriaUtils';
import { getExpedienteField } from '@/utils/expedienteUtils';
import { parseLocalDate } from '@/lib/dateUtils';

// ponytail: os 500 mais recentes por módulo, filtrados na tela; um índice de busca no servidor se os órgãos passarem disso.
const LIMITE = 500;
const MAX_RESULTADOS = 20;
const TTL = 60000;
const COLECAO = { consultas: 'processes', expedientes: 'expedientes', parcerias: 'parcerias', juri: 'juris' };
/** Campo do número em cada coleção, para achar pelo número exato um registro fora dos mais recentes. */
const CAMPO_NUMERO = { consultas: 'process_number', expedientes: 'expediente_number', parcerias: 'pgea', juri: 'numero_processo' };
const cache = new Map();

/** Dados do catálogo (DADOS_REGISTRO) que um campo próprio pode importar; o que não for data válida fica de fora. */
function dadosDe(modulo, d) {
    const txt = (v) => (v === undefined || v === null ? '' : String(v).trim().slice(0, 4000));
    const data = (v) => {
        const x = v ? parseLocalDate(v) : null;
        return x && !Number.isNaN(x.getTime()) ? `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` : '';
    };
    const brutos = {
        consultas: { consulente: txt(getProcessField(d, 'consultant')), local: txt(getProcessField(d, 'location')), materia: txt(d.matter_object), entrada: data(getProcessField(d, 'entry_date')) },
        expedientes: { origem: txt(getExpedienteField(d, 'origin')), sistema: txt(getExpedienteField(d, 'system')), objeto: txt(getExpedienteField(d, 'object')), entrada: data(getExpedienteField(d, 'entry_date')) },
        parcerias: { tipo: txt(getParceriaField(d, 'partnership_type')), objeto: txt(getParceriaField(d, 'object')), partes: txt(getParceriaField(d, 'parties')), assinatura: data(getParceriaField(d, 'signature_date')), termo_final: data(getParceriaField(d, 'end_date')) },
        juri: { comarca: txt(d.comarca), data_juri: data(d.data_juri) },
    }[modulo] || {};
    return Object.fromEntries(Object.entries(brutos).filter(([, v]) => v));
}

/**
 * Página própria como o servidor guarda (espelho de refDePagina): o primeiro
 * campo de texto preenchido, na ordem do tipo, e o nome do tipo. Sem dados
 * para pré-preencher (página própria é interna).
 */
export function registroDePagina(id, d, tipo) {
    const s = (v) => (v === undefined || v === null ? '' : String(v).trim());
    const valores = d?.values || {};
    const campo = (tipo?.fields || []).find((f) => f.type === 'text' && s(valores[f.key]));
    return { id, numero: (campo ? s(valores[campo.key]).slice(0, 80) : '') || `#${id.slice(0, 6)}`, titulo: s(tipo?.label_singular).slice(0, 160), pagina: s(d?.entity_type_id), dados: {} };
}

async function tipoDaPagina(pagina) {
    const k = `tipo:${pagina}`;
    const c = cache.get(k);
    if (c && Date.now() - c.em < TTL) return c.lista;
    const t = (await getDoc(doc(db, 'entityTypes', pagina))).data() || null;
    cache.set(k, { lista: t, em: Date.now() });
    return t;
}

async function registrosDaPagina(orgId, pagina) {
    const k = `${orgId}:paginas:${pagina}`;
    const c = cache.get(k);
    if (c && Date.now() - c.em < TTL) return c.lista;
    const [tipo, snap] = await Promise.all([
        tipoDaPagina(pagina),
        getDocs(query(collection(db, 'customRecords'), where('organization_id', '==', orgId), where('entity_type_id', '==', pagina), orderBy('updated_at', 'desc'), limit(LIMITE))),
    ]);
    const lista = snap.docs.map((d) => registroDePagina(d.id, d.data(), tipo));
    cache.set(k, { lista, em: Date.now() });
    return lista;
}

/** Número e título como o servidor guarda (espelho de refDe em shared/modulos.ts); `dados` só de registro sem restrição, para pré-preencher. */
export function registroDe(modulo, id, d) {
    const par = {
        consultas: [getProcessField(d, 'process_number'), d.matter_object],
        expedientes: [d.expediente_number, d.object],
        parcerias: [getParceriaField(d, 'pgea') || getParceriaField(d, 'partnership_number'), getParceriaField(d, 'subject')],
        juri: [d.numero_processo, d.comarca],
    }[modulo] || [];
    const s = (v) => (v === undefined || v === null ? '' : String(v).trim());
    const restrito = /^sim$/i.test(s(d.access_restriction)) || d.access_restriction === true || d.anonymized === true;
    return { id, numero: s(par[0]).slice(0, 80) || 'sem número', titulo: s(par[1]).slice(0, 160), ...(restrito ? { restrito: true } : { dados: dadosDe(modulo, d) }) };
}

async function registros(orgId, modulo) {
    const k = `${orgId}:${modulo}`;
    const c = cache.get(k);
    if (c && Date.now() - c.em < TTL) return c.lista;
    const snap = await getDocs(query(collection(db, COLECAO[modulo]), where('organization_id', '==', orgId), orderBy('updated_at', 'desc'), limit(LIMITE)));
    const lista = snap.docs.map((d) => registroDe(modulo, d.id, d.data()));
    cache.set(k, { lista, em: Date.now() });
    return lista;
}

/**
 * Até 20 registros cujo número ou título contém o texto (sem texto: os mais
 * recentes). Nada entre os recentes: procura pelo número exato em todo o módulo.
 */
export async function buscarRegistros(orgId, modulo, texto, pagina) {
    if (!orgId || (!COLECAO[modulo] && !(modulo === 'paginas' && pagina))) return [];
    const bruto = String(texto || '').trim();
    const t = bruto.toLowerCase();
    if (modulo === 'paginas') {
        const lista = await registrosDaPagina(orgId, pagina);
        return (t ? lista.filter((r) => r.numero.toLowerCase().includes(t) || r.titulo.toLowerCase().includes(t)) : lista).slice(0, MAX_RESULTADOS);
    }
    const lista = await registros(orgId, modulo);
    const achados = (t ? lista.filter((r) => r.numero.toLowerCase().includes(t) || r.titulo.toLowerCase().includes(t)) : lista).slice(0, MAX_RESULTADOS);
    if (achados.length || !bruto) return achados;
    const snap = await getDocs(query(collection(db, COLECAO[modulo]), where('organization_id', '==', orgId), where(CAMPO_NUMERO[modulo], '==', bruto), limit(5)));
    return snap.docs.map((d) => registroDe(modulo, d.id, d.data()));
}

/** Um registro pelo id (para "Criar processo eletrônico" vindo do outro módulo); null se não for do órgão. */
export async function buscarRegistro(orgId, modulo, id) {
    if (orgId && modulo === 'paginas' && id) {
        const s = await getDoc(doc(db, 'customRecords', id));
        const d = s.data();
        if (!s.exists() || d?.organization_id !== orgId) return null;
        return { modulo, ...registroDePagina(s.id, d, await tipoDaPagina(String(d.entity_type_id || ''))) };
    }
    if (!orgId || !COLECAO[modulo] || !id) return null;
    const s = await getDoc(doc(db, COLECAO[modulo], id));
    const d = s.data();
    return s.exists() && d?.organization_id === orgId ? { modulo, ...registroDe(modulo, s.id, d) } : null;
}
