// ============================================================================
// globalSearch — busca por número de Consulta/Expediente ou consulente em
// TODOS os órgãos do usuário (flag `global_search`).
// ----------------------------------------------------------------------------
// Reaproveita exatamente a mesma consulta (organization_id + orderBy
// updated_at) já usada pelos hooks useProcesses/useExpedientes — mesmo
// índice composto, mesmas regras de segurança (isMemberOf) — só que como
// leitura pontual (getDocs) em vez de listener em tempo real, e repetida
// para cada órgão do usuário em paralelo.
// ============================================================================

import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

const PER_ORG_LIMIT = 500;
const MAX_RESULTS = 20;

function matches(value, needle) {
    return typeof value === 'string' && value.toLowerCase().includes(needle);
}

export async function searchAcrossOrganizations(organizations, searchText) {
    const needle = (searchText || '').trim().toLowerCase();
    if (needle.length < 2 || !Array.isArray(organizations) || organizations.length === 0) {
        return [];
    }

    const perOrgResults = await Promise.all(organizations.map(async (org) => {
        const found = [];
        try {
            const processesQ = query(
                collection(db, 'processes'),
                where('organization_id', '==', org.id),
                orderBy('updated_at', 'desc'),
                limit(PER_ORG_LIMIT)
            );
            const expedientesQ = query(
                collection(db, 'expedientes'),
                where('organization_id', '==', org.id),
                orderBy('updated_at', 'desc'),
                limit(PER_ORG_LIMIT)
            );
            const [processesSnap, expedientesSnap] = await Promise.all([getDocs(processesQ), getDocs(expedientesQ)]);

            processesSnap.forEach((docSnap) => {
                const data = docSnap.data();
                if (matches(data.process_number, needle) || matches(data.consulente, needle) || matches(data.matter_object, needle)) {
                    found.push({
                        kind: 'processo',
                        id: docSnap.id,
                        orgId: org.id,
                        orgName: org.name,
                        number: data.process_number,
                        subtitle: data.consulente || data.matter_object || '',
                        status: data.status,
                    });
                }
            });

            expedientesSnap.forEach((docSnap) => {
                const data = docSnap.data();
                if (matches(data.expediente_number, needle) || matches(data.origin, needle) || matches(data.matter_object, needle)) {
                    found.push({
                        kind: 'expediente',
                        id: docSnap.id,
                        orgId: org.id,
                        orgName: org.name,
                        number: data.expediente_number,
                        subtitle: data.origin || data.matter_object || '',
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
