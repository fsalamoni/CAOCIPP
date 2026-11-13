// ============================================================================
// Busca de registros de outro módulo do órgão (Consultas, Expedientes,
// Parcerias, Júri) para o campo e a ação "registro" do Processo Eletrônico.
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
export async function buscarRegistros(orgId, modulo, texto) {
    if (!orgId || !COLECAO[modulo]) return [];
    const bruto = String(texto || '').trim();
    const t = bruto.toLowerCase();
    const lista = await registros(orgId, modulo);
    const achados = (t ? lista.filter((r) => r.numero.toLowerCase().includes(t) || r.titulo.toLowerCase().includes(t)) : lista).slice(0, MAX_RESULTADOS);
    if (achados.length || !bruto) return achados;
    const snap = await getDocs(query(collection(db, COLECAO[modulo]), where('organization_id', '==', orgId), where(CAMPO_NUMERO[modulo], '==', bruto), limit(5)));
    return snap.docs.map((d) => registroDe(modulo, d.id, d.data()));
}

/** Um registro pelo id (para "Criar processo eletrônico" vindo do outro módulo); null se não for do órgão. */
export async function buscarRegistro(orgId, modulo, id) {
    if (!orgId || !COLECAO[modulo] || !id) return null;
    const s = await getDoc(doc(db, COLECAO[modulo], id));
    const d = s.data();
    return s.exists() && d?.organization_id === orgId ? { modulo, ...registroDe(modulo, s.id, d) } : null;
}
