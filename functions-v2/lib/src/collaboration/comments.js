"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.addComment = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const vinculo_1 = require("../shared/vinculo");
const ENTITY_COLLECTION = {
    process: 'processes',
    expediente: 'expedientes',
    parceria: 'parcerias',
};
const ENTITY_NUMBER_FIELD = {
    process: 'process_number',
    expediente: 'expediente_number',
    parceria: 'pgea',
};
const ENTITY_LABEL = {
    process: 'Consulta',
    expediente: 'Expediente',
    parceria: 'Parceria',
};
// Comentários internos com @menção (flag `process_comments`). Escrita
// exclusiva via Cloud Function: valida associação ao órgão, valida que o
// registro pertence ao órgão informado, e só notifica quem for de fato
// membro do órgão (mesmo que o cliente tenha enviado IDs incorretos/antigos).
exports.addComment = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { organizationId, entityType, entityId } = request.data;
    const text = (request.data.text || '').trim();
    const mentionedUserIds = Array.isArray(request.data.mentionedUserIds) ? request.data.mentionedUserIds : [];
    if (!organizationId || !entityType || !entityId || !text) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    const collectionName = ENTITY_COLLECTION[entityType];
    if (!collectionName) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid entityType');
    }
    if (text.length > 2000) {
        throw new https_1.HttpsError('invalid-argument', 'Comment too long (max 2000 characters)');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    // 1. Verifica associação ao órgão.
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists || (0, vinculo_1.vinculoBloqueado)(membershipSnap.data())) {
        throw new https_1.HttpsError('permission-denied', 'You are not a member of this organization');
    }
    // 2. Verifica que o registro pertence a este órgão.
    const entityRef = db.collection(collectionName).doc(entityId);
    const entitySnap = await entityRef.get();
    const entityData = entitySnap.data();
    if (!entitySnap.exists || (entityData === null || entityData === void 0 ? void 0 : entityData.organization_id) !== organizationId) {
        throw new https_1.HttpsError('not-found', 'Record not found in this organization');
    }
    // 3. Só notifica quem for realmente membro do órgão (defesa contra IDs
    // arbitrários enviados pelo cliente).
    const candidateMentions = mentionedUserIds.filter((id) => id && id !== userId);
    let validMentions = [];
    if (candidateMentions.length > 0) {
        const checks = await Promise.all(candidateMentions.map(async (id) => {
            var _a;
            const snap = await db.collection('userOrganizations').doc(`${id}_${organizationId}`).get();
            return snap.exists && ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.active) !== false ? id : null;
        }));
        validMentions = checks.filter((id) => Boolean(id));
    }
    const userName = request.auth.token.name || 'Usuário';
    const commentRef = entityRef.collection('comments').doc();
    await commentRef.set({
        text,
        author_id: userId,
        author_name: userName,
        mentioned_user_ids: validMentions,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    // 4. Notificações para os mencionados — respeita a preferência de
    // notificação de cada usuário (userPreferences/{uid}.notificationPreferences.mention),
    // que por padrão (campo ausente) é considerada ligada.
    if (validMentions.length > 0) {
        const prefSnaps = await Promise.all(validMentions.map((id) => db.collection('userPreferences').doc(id).get()));
        const recipients = validMentions.filter((_, idx) => {
            var _a;
            const prefs = (_a = prefSnaps[idx].data()) === null || _a === void 0 ? void 0 : _a.notificationPreferences;
            return (prefs === null || prefs === void 0 ? void 0 : prefs.mention) !== false;
        });
        if (recipients.length > 0) {
            const batch = db.batch();
            const entityNumber = (entityData === null || entityData === void 0 ? void 0 : entityData[ENTITY_NUMBER_FIELD[entityType]]) || '';
            recipients.forEach((mentionedId) => {
                const notifRef = db.collection('notifications').doc();
                batch.set(notifRef, {
                    user_id: mentionedId,
                    type: 'mention',
                    title: `${userName} mencionou você em um comentário`,
                    message: `${ENTITY_LABEL[entityType]} ${entityNumber}`.trim(),
                    organization_id: organizationId,
                    entity_type: entityType,
                    entity_id: entityId,
                    read: false,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                });
            });
            await batch.commit();
        }
    }
    return { success: true, commentId: commentRef.id };
});
//# sourceMappingURL=comments.js.map