// ============================================================================
// globalSearch — busca por número de Consulta/Expediente ou consulente em
// TODOS os órgãos do usuário (flag `global_search`).
// ----------------------------------------------------------------------------
// Reaproveita exatamente a mesma consulta (organization_id + orderBy
// updated_at) já usada pelos hooks useProcesses/useExpedientes — mesmo
// índice composto, mesmas regras de segurança (isMemberOf) — só que como
// leitura pontual (getDocs) em vez de listener em tempo real, e repetida
// para cada órgão do usuário em paralelo.
//
// Cache em memória por órgão (TTL curto): sem isto, cada tecla digitada (após
// o debounce da paleta) dispararia 2 queries x N órgãos de novo — para um
// usuário em 10 órgãos, cada pausa de digitação custaria até 10.000 leituras.
// Com o cache, os documentos só são buscados uma vez por órgão a cada
// CACHE_TTL_MS; teclas adicionais apenas refiltram em memória (barato).
// Trade-off aceito: um registro criado por outro usuário pode demorar até
// CACHE_TTL_MS para aparecer na busca — razoável para uma busca rápida.
// ============================================================================

import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { getProcessField } from '@/utils/processUtils';
import { getExpedienteField } from '@/utils/expedienteUtils';

const PER_ORG_LIMIT = 500;
const MAX_RESULTS = 20;
const CACHE_TTL_MS = 60000;

const orgDataCache = new Map(); // orgId -> { processes, expedientes, fetchedAt }

function matches(value, needle) {
    return typeof value === 'string' && value.toLowerCase().includes(needle);
}

async function getOrgData(orgId) {
    const cached = orgDataCache.get(orgId);
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
        return cached;
    }

    const processesQ = query(
        collection(db, 'processes'),
        where('organization_id', '==', orgId),
        orderBy('updated_at', 'desc'),
        limit(PER_ORG_LIMIT)
    );
    const expedientesQ = query(
        collection(db, 'expedientes'),
        where('organization_id', '==', orgId),
        orderBy('updated_at', 'desc'),
        limit(PER_ORG_LIMIT)
    );
    const [processesSnap, expedientesSnap] = await Promise.all([getDocs(processesQ), getDocs(expedientesQ)]);

    const data = {
        processes: processesSnap.docs.map((d) => ({ id: d.id, data: d.data() })),
        expedientes: expedientesSnap.docs.map((d) => ({ id: d.id, data: d.data() })),
        fetchedAt: Date.now(),
    };
    orgDataCache.set(orgId, data);
    return data;
}

export async function searchAcrossOrganizations(organizations, searchText) {
    const needle = (searchText || '').trim().toLowerCase();
    if (needle.length < 2 || !Array.isArray(organizations) || organizations.length === 0) {
        return [];
    }

    const perOrgResults = await Promise.all(organizations.map(async (org) => {
        const found = [];
        try {
            const { processes, expedientes } = await getOrgData(org.id);

            processes.forEach(({ id, data }) => {
                // Usa os mesmos resolvedores de alias da tabela (getProcessField):
                // o campo canônico é `consultant` — `consulente` só existe em
                // dados legados de import, e buscar só por ele não encontrava
                // praticamente nenhum registro atual.
                const consultant = getProcessField(data, 'consultant');
                const matterObject = data.matter_object;
                if (matches(data.process_number, needle) || matches(consultant, needle) || matches(matterObject, needle)) {
                    found.push({
                        kind: 'processo',
                        id,
                        orgId: org.id,
                        orgName: org.name,
                        number: data.process_number,
                        subtitle: consultant || matterObject || '',
                        status: data.status,
                    });
                }
            });

            expedientes.forEach(({ id, data }) => {
                // Campo canônico do objeto/assunto do expediente é `object`
                // (não `matter_object`, que não existe nesta coleção).
                const origin = getExpedienteField(data, 'origin');
                const object = getExpedienteField(data, 'object');
                if (matches(data.expediente_number, needle) || matches(origin, needle) || matches(object, needle)) {
                    found.push({
                        kind: 'expediente',
                        id,
                        orgId: org.id,
                        orgName: org.name,
                        number: data.expediente_number,
                        subtitle: origin || object || '',
                        status: data.status,
                    });
                }
            });
        } catch {
            // Falha ao buscar num órgão (ex.: sem permissão) não deve quebrar a busca nos demais.
        }
        return found;
    }));

    return perOrgResults.flat().slice(0, MAX_RESULTS);
}
