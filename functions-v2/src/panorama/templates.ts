import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

/**
 * Modelos de relatório dinâmico, compartilhados dentro do órgão.
 *
 * Antes eles viviam no `localStorage` de cada navegador, como no aplicativo de
 * origem — o que significava que o cruzamento que alguém levou uma tarde para
 * desenhar morria com o cache do navegador e não chegava a mais ninguém.
 *
 * Agora vivem no Firestore, com uma regra simples de autoria: qualquer membro
 * do órgão usa qualquer modelo; só quem criou — ou quem administra o órgão —
 * edita ou exclui. A checagem é feita aqui, no servidor, porque as regras do
 * Firestore bloqueiam toda escrita direta do cliente nesta coleção.
 */

const MAX_TEMPLATES_POR_ORGAO = 300;
const TIPOS = new Set(['pivot', 'descritivo']);

interface TemplateRequest {
    organizationId: string;
    /** Base a que o modelo pertence. Um cruzamento desenhado para improbidade
     *  não significa nada numa base de consumidor, com outras colunas. */
    baseId?: string;
    /** 'create' | 'update' | 'delete' */
    action?: string;
    id?: string;
    nome?: string;
    tipo?: string;
    /** Configuração do relatório (forma livre, validada por tamanho). */
    config?: unknown;
}

/**
 * A configuração é opaca para o servidor — quem a interpreta é a engine no
 * cliente, e ela muda a cada evolução do módulo. O que o servidor garante é
 * que não vira um depósito: JSON válido, com teto de tamanho e profundidade.
 */
function sanitizeConfig(input: unknown): Record<string, unknown> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new HttpsError('invalid-argument', 'Configuração do modelo inválida');
    }
    let serialized: string;
    try {
        serialized = JSON.stringify(input);
    } catch {
        throw new HttpsError('invalid-argument', 'Configuração do modelo não é serializável');
    }
    if (serialized.length > 20000) {
        throw new HttpsError('invalid-argument', 'Configuração do modelo excede o tamanho permitido');
    }
    // Reserializa a partir do texto: derruba undefined, funções e protótipos
    // exóticos que por acaso tenham chegado.
    return JSON.parse(serialized) as Record<string, unknown>;
}

/** Vínculo do usuário com o órgão + se ele administra (criador ou delegado). */
async function loadMembership(
    db: admin.firestore.Firestore,
    userId: string,
    organizationId: string
) {
    const snap = await db
        .collection('userOrganizations')
        .doc(`${userId}_${organizationId}`)
        .get();
    if (!snap.exists) {
        throw new HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    const data = snap.data() || {};
    const isCreator = data.role === 'creator';
    const permissions = (data.permissions && typeof data.permissions === 'object')
        ? data.permissions as Record<string, unknown>
        : {};
    return {
        data,
        // "Administra o módulo" é a mesma permissão que configura a Panorama:
        // quem pode mudar as listas oficiais do órgão pode faxinar os modelos.
        isAdmin: isCreator || permissions.configure_panorama === true,
        userName: String(data.user_name || '') || 'Usuário desconhecido',
    };
}

export const managePanoramaTemplate = onCall<TemplateRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const payload = request.data || ({} as TemplateRequest);
        const { organizationId, action = 'create', id } = payload;
        if (!organizationId) {
            throw new HttpsError('invalid-argument', 'organizationId é obrigatório');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;
        const membership = await loadMembership(db, userId, organizationId);
        const userName = request.auth.token.name || membership.userName;
        const collection = db.collection('panoramaTemplates');

        // ---- Exclusão -------------------------------------------------------
        if (action === 'delete') {
            if (!id) throw new HttpsError('invalid-argument', 'id é obrigatório');
            const snap = await collection.doc(id).get();
            if (!snap.exists) throw new HttpsError('not-found', 'Modelo não encontrado');

            const modelo = snap.data() || {};
            // IDOR: um id de outro órgão não pode ser apagado daqui.
            if (modelo.organization_id !== organizationId) {
                throw new HttpsError('not-found', 'Modelo não encontrado');
            }
            if (modelo.created_by !== userId && !membership.isAdmin) {
                throw new HttpsError(
                    'permission-denied',
                    'Somente quem criou o modelo ou um administrador do órgão pode excluí-lo'
                );
            }

            await snap.ref.delete();
            await db.collection('auditLogs').add({
                organization_id: organizationId,
                user_id: userId,
                user_name: userName,
                action: 'DELETE_PANORAMA_TEMPLATE',
                details: { id, nome: modelo.nome || '', tipo: modelo.tipo || '' },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { success: true, id };
        }

        // ---- Criação e edição ----------------------------------------------
        const nome = String(payload.nome ?? '').trim().slice(0, 120);
        if (!nome) throw new HttpsError('invalid-argument', 'Informe um nome para o modelo');

        const tipo = String(payload.tipo ?? '');
        if (!TIPOS.has(tipo)) {
            throw new HttpsError('invalid-argument', 'Tipo de modelo inválido');
        }
        const config = sanitizeConfig(payload.config);

        if (action === 'update') {
            if (!id) throw new HttpsError('invalid-argument', 'id é obrigatório');
            const snap = await collection.doc(id).get();
            if (!snap.exists) throw new HttpsError('not-found', 'Modelo não encontrado');

            const modelo = snap.data() || {};
            if (modelo.organization_id !== organizationId) {
                throw new HttpsError('not-found', 'Modelo não encontrado');
            }
            if (modelo.created_by !== userId && !membership.isAdmin) {
                throw new HttpsError(
                    'permission-denied',
                    'Somente quem criou o modelo ou um administrador do órgão pode editá-lo'
                );
            }
            // O tipo é a identidade do modelo: uma tabela dinâmica não vira um
            // descritivo no meio do caminho.
            if (modelo.tipo !== tipo) {
                throw new HttpsError('invalid-argument', 'O tipo do modelo não pode ser alterado');
            }

            await snap.ref.update({
                nome,
                config,
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_by: userId,
                updated_by_name: userName,
            });
            return { success: true, id };
        }

        if (action !== 'create') {
            throw new HttpsError('invalid-argument', 'Ação inválida');
        }

        const existentes = await collection
            .where('organization_id', '==', organizationId)
            .count()
            .get();
        if (existentes.data().count >= MAX_TEMPLATES_POR_ORGAO) {
            throw new HttpsError(
                'resource-exhausted',
                `Este órgão já tem ${MAX_TEMPLATES_POR_ORGAO} modelos salvos. Exclua algum antes de criar outro.`
            );
        }

        const doc = await collection.add({
            organization_id: organizationId,
            base_id: String(payload.baseId || ''),
            nome,
            tipo,
            config,
            created_by: userId,
            created_by_name: userName,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_by: userId,
            updated_by_name: userName,
        });

        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: userId,
            user_name: userName,
            action: 'CREATE_PANORAMA_TEMPLATE',
            details: { id: doc.id, nome, tipo, base_id: payload.baseId || '' },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { success: true, id: doc.id };
    }
);
