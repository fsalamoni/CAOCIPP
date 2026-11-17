import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { vinculoBloqueado } from '../shared/vinculo';
import { moduloPgea, normalizarNumeroPgea, resumoRegistro, ordenarResumos, CAMPOS_RESUMO } from '../shared/registrosPgea';

interface Req {
    organizationId: string;
    modulo: string;
    numero: string;
}

/**
 * Confere se o nº do PGEA já existe no banco do órgão (Consultas ou
 * Expedientes, cada um no seu), arquivados inclusive. Devolve um resumo de
 * cada registro com o número: fase, responsável, original ou aditivo.
 */
export const verificarNumeroPgea = onCall<Req>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta.');
        const { organizationId, modulo, numero } = request.data || ({} as Req);
        const cfg = moduloPgea(modulo);
        const alvo = normalizarNumeroPgea(numero);
        if (!organizationId || !cfg || !alvo || String(numero).length > 120) {
            throw new HttpsError('invalid-argument', 'Informe o número.');
        }
        const db = admin.firestore();
        const vinculo = await db.collection('userOrganizations').doc(`${request.auth.uid}_${organizationId}`).get();
        if (!vinculo.exists || vinculoBloqueado(vinculo.data())) {
            throw new HttpsError('permission-denied', 'Você não faz parte deste órgão.');
        }
        // ponytail: lê o número de todos os registros do órgão (só os campos do
        // resumo) para achar o mesmo número escrito de outro jeito. Se um órgão
        // passar de dezenas de milhares, gravar o número normalizado e consultar por ele.
        const snap = await db.collection(cfg.colecao)
            .where('organization_id', '==', organizationId)
            .select(cfg.campoNumero, ...CAMPOS_RESUMO)
            .get();
        const achados = snap.docs
            .filter((d) => normalizarNumeroPgea(d.get(cfg.campoNumero)) === alvo)
            .map((d) => resumoRegistro(d.id, d.data(), cfg.campoNumero));
        return { existe: achados.length > 0, registros: ordenarResumos(achados).slice(0, 20), total: achados.length };
    }
);
