import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

interface JoinOrgRequest {
    inviteCode: string;
}

export const joinOrganization = onCall<JoinOrgRequest>(
    { region: 'southamerica-east1', cors: true },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { inviteCode } = request.data;
        if (!inviteCode) {
            throw new HttpsError('invalid-argument', 'Invite code is required');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;
        const userEmail = request.auth.token.email || '';
        const userName = request.auth.token.name || '';

        // 1. Find organization by invite code
        const orgsSnapshot = await db.collection('organizations')
            .where('invite_code', '==', inviteCode)
            .limit(1)
            .get();

        if (orgsSnapshot.empty) {
            throw new HttpsError('not-found', 'Organização não encontrada com este código.');
        }

        const orgDoc = orgsSnapshot.docs[0];
        const orgData = orgDoc.data();
        const orgId = orgDoc.id;

        // 2. Check if already a member
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${orgId}`);
        const membershipDoc = await membershipRef.get();

        if (membershipDoc.exists) {
            throw new HttpsError('already-exists', 'Você já é membro desta organização.');
        }

        // 3. Create membership
        await membershipRef.set({
            id: `${userId}_${orgId}`,
            user_id: userId,
            organization_id: orgId,
            user_email: userEmail,
            user_name: userName,
            role: 'member',
            function: 'Membro',
            joined_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // 4. Update organization stats (optional but good)
        await orgDoc.ref.update({
            'stats.members_count': admin.firestore.FieldValue.increment(1)
        });

        // 5. Audit log
        await db.collection('auditLogs').add({
            organization_id: orgId,
            user_id: userId,
            user_name: userName,
            action: 'JOIN_ORGANIZATION',
            details: { invite_code: inviteCode },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            message: `Você entrou na organização ${orgData.name} com sucesso!`
        };
    }
);
