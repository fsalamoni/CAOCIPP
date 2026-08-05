"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const normalization_1 = require("../shared/normalization");
exports.updateProfile = (0, https_1.onCall)({ region: 'southamerica-east1' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authenticated user required');
    }
    const { full_name, platform_name, function: userFunction, notification_email, two_factor_enabled } = request.data;
    const userId = request.auth.uid;
    const db = admin.firestore();
    const updates = {};
    if (full_name !== undefined)
        updates.full_name = (0, normalization_1.formatPersonName)(full_name);
    if (platform_name !== undefined)
        updates.platform_name = (0, normalization_1.formatPersonName)(platform_name);
    if (userFunction !== undefined)
        updates.function = String(userFunction || '').trim().slice(0, 120);
    if (notification_email !== undefined) {
        const trimmedEmail = String(notification_email || '').trim().slice(0, 200);
        if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            throw new https_1.HttpsError('invalid-argument', 'notification_email inválido.');
        }
        updates.notification_email = trimmedEmail;
    }
    if (two_factor_enabled !== undefined)
        updates.two_factor_enabled = two_factor_enabled === true;
    updates.updated_at = admin.firestore.FieldValue.serverTimestamp();
    // Update 'users' collection
    await db.collection('users').doc(userId).update(updates);
    // Also update all memberships to keep names in sync?
    // This is expensive (denormalization trade-off). 
    // For now, let's NOT update memberships automatically, or only if name changes.
    // If name changes, finding all userOrganizations where user_id == userId and updating user_name.
    if (full_name || platform_name) {
        const normalizedName = (0, normalization_1.formatPersonName)(full_name || platform_name);
        const modulesSnap = await db.collection('userOrganizations')
            .where('user_id', '==', userId)
            .get();
        if (!modulesSnap.empty) {
            const batch = db.batch();
            modulesSnap.docs.forEach(doc => {
                batch.update(doc.ref, { user_name: normalizedName });
            });
            await batch.commit();
        }
    }
    // Propagar a "função" (texto livre do /Profile) para TODOS os
    // memberships do usuário, desde que o admin do órgão não tenha
    // sobrescrito manualmente o member.function. Heurística: se a
    // função atual do member for um dos genéricos do sistema
    // ("Membro", "Criador", "Admin", "Owner") OU for igual ao nome
    // antigo do usuário no profile, sobrescrevemos. Caso contrário
    // (admin já personalizou), mantemos a função do org.
    //
    // Isso resolve o bug "estou com a função 'criador' mas meu perfil
    // diz outra coisa": o que vale é o /Profile, e o admin pode
    // customizar localmente sem perder a sincronia.
    if (userFunction !== undefined) {
        const GENERIC_FUNCTIONS = new Set(['Membro', 'Criador', 'Admin', 'Owner', 'Membro fundador']);
        const oldProfileFunction = String((await db.collection('users').doc(userId).get()).get('function') || '');
        const membershipsSnap = await db.collection('userOrganizations')
            .where('user_id', '==', userId)
            .get();
        if (!membershipsSnap.empty) {
            const batch = db.batch();
            membershipsSnap.docs.forEach((doc) => {
                const currentFunction = String(doc.get('function') || '');
                const shouldSync = GENERIC_FUNCTIONS.has(currentFunction) ||
                    currentFunction === '' ||
                    (oldProfileFunction && currentFunction === oldProfileFunction);
                if (shouldSync) {
                    batch.update(doc.ref, { function: userFunction || '' });
                }
            });
            await batch.commit();
        }
    }
    return { success: true };
});
//# sourceMappingURL=updateProfile.js.map