import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const getUserOrganizations = onCall(
    { region: 'southamerica-east1', cors: true },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        try {
            // 1. Get all memberships for the user
            const membershipsSnapshot = await db.collection('userOrganizations')
                .where('user_id', '==', userId)
                .get();

            if (membershipsSnapshot.empty) {
                return { organizations: [] };
            }

            const orgIds = membershipsSnapshot.docs.map(doc => doc.data().organization_id);

            // 2. Fetch organization details
            // Firestore 'in' query supports up to 10 items. If user has > 10 orgs, we need to batch or loop.
            // For now, assume <= 10. If > 10, better to rely on separate get calls or client-side fetches.
            // Alternatively, we can just return the membership data and let client fetch details if needed,
            // but the UI likely needs names.

            const organizations: any[] = [];

            // Batch fetch (chunks of 10)
            for (let i = 0; i < orgIds.length; i += 10) {
                const chunk = orgIds.slice(i, i + 10);
                if (chunk.length > 0) {
                    const orgsSnapshot = await db.collection('organizations')
                        .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
                        .get();

                    orgsSnapshot.docs.forEach(doc => {
                        organizations.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });
                }
            }

            return { organizations };

        } catch (error) {
            console.error('Error fetching user organizations:', error);
            throw new HttpsError('internal', 'Failed to fetch organizations');
        }
    }
);
