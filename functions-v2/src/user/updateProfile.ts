import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { formatPersonName } from '../shared/normalization';

interface UpdateProfileRequest {
    full_name?: string;
    platform_name?: string;
    function?: string;
    notification_email?: string;
}

export const updateProfile = onCall<UpdateProfileRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authenticated user required');
        }

        const { full_name, platform_name, function: userFunction, notification_email } = request.data as any;
        const userId = request.auth.uid;
        const db = admin.firestore();

        const updates: any = {};
        if (full_name !== undefined) updates.full_name = formatPersonName(full_name);
        if (platform_name !== undefined) updates.platform_name = formatPersonName(platform_name);
        if (userFunction !== undefined) updates.function = userFunction;
        if (notification_email !== undefined) updates.notification_email = notification_email;

        updates.updated_at = admin.firestore.FieldValue.serverTimestamp();

        // Update 'users' collection
        await db.collection('users').doc(userId).update(updates);

        // Also update all memberships to keep names in sync?
        // This is expensive (denormalization trade-off). 
        // For now, let's NOT update memberships automatically, or only if name changes.
        // If name changes, finding all userOrganizations where user_id == userId and updating user_name.

        if (full_name || platform_name) {
            const normalizedName = formatPersonName(full_name || platform_name);
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

        return { success: true };
    }
);
