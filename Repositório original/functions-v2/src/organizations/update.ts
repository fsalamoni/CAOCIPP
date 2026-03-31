import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

interface UpdateOrganizationRequest {
    organizationId: string;
    data: {
        name?: string;
        description?: string;
        matterSettings?: {
            custom: boolean;
            categories: string[];
            subcategories: Record<string, string[]>;
        };
        summarySettings?: Record<string, any>;
        expedienteSettings?: {
            systems: string[];
            origins: string[];
        };
    };
}

export const updateOrganization = onCall<UpdateOrganizationRequest>(
    { region: 'southamerica-east1' },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { organizationId, data } = request.data;
        const requesterId = request.auth.uid;
        const db = admin.firestore();

        // 1. Verify access (Must be CREATOR)
        // Memberships are stored in 'userOrganizations' collection as {userId}_{orgId}
        const membershipRef = db.collection('userOrganizations').doc(`${requesterId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();

        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'User is not a member of this organization');
        }

        const membership = membershipSnap.data();
        if (membership?.role !== 'creator') {
            throw new HttpsError('permission-denied', 'Only the organization Creator can update settings');
        }

        // 2. Validate Data
        if (!organizationId) {
            throw new HttpsError('invalid-argument', 'Organization ID is required');
        }

        // 3. Update Organization
        // Only allow specific fields to be updated
        const updates: any = {};
        if (data.name !== undefined) updates.name = data.name;
        if (data.description !== undefined) updates.description = data.description;
        if (data.matterSettings !== undefined) updates.matterSettings = data.matterSettings;
        if (data.summarySettings !== undefined) updates.summarySettings = data.summarySettings;
        if (data.expedienteSettings !== undefined) updates.expedienteSettings = data.expedienteSettings;

        updates.updated_at = admin.firestore.FieldValue.serverTimestamp();

        if (Object.keys(updates).length === 0) {
            return { success: true, message: 'No changes detected' };
        }

        await db.collection('organizations').doc(organizationId).update(updates);

        // 4. Audit Log
        await db.collection('auditLogs').add({
            organization_id: organizationId,
            user_id: requesterId,
            user_name: request.auth.token.name || 'Unknown',
            action: 'UPDATE_ORGANIZATION',
            details: {
                fields_updated: Object.keys(updates).filter(k => k !== 'updated_at')
            },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true, message: 'Organization updated successfully' };
    }
);
