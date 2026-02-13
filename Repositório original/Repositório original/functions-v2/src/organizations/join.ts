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

        const { inviteCode: rawInviteCode } = request.data;
        if (!rawInviteCode) {
            throw new HttpsError('invalid-argument', 'Invite code is required');
        }

        const inviteCode = rawInviteCode.trim().toUpperCase();
        console.log(`[joinOrganization] Attempting join for user ${request.auth.uid} with code [${inviteCode}]`);

        const db = admin.firestore();
        const userId = request.auth.uid;
        const userEmail = request.auth.token.email || '';
        const userName = request.auth.token.name || '';

        try {
            const result = await db.runTransaction(async (transaction) => {
                // 1. Find organization by invite code
                const orgsQuery = db.collection('organizations')
                    .where('invite_code', '==', inviteCode)
                    .limit(1);

                const orgsSnapshot = await transaction.get(orgsQuery);

                if (orgsSnapshot.empty) {
                    throw new HttpsError('not-found', 'Organização não encontrada com este código.');
                }

                const orgDoc = orgsSnapshot.docs[0];
                const orgData = orgDoc.data();
                const orgId = orgDoc.id;

                // 2. Check if already a member
                const membershipRef = db.collection('userOrganizations').doc(`${userId}_${orgId}`);
                const membershipDoc = await transaction.get(membershipRef);

                if (membershipDoc.exists) {
                    throw new HttpsError('already-exists', 'Você já é membro desta organização.');
                }

                // 3. Create membership
                transaction.set(membershipRef, {
                    id: `${userId}_${orgId}`,
                    user_id: userId,
                    organization_id: orgId,
                    user_email: userEmail,
                    user_name: userName,
                    role: 'member',
                    function: 'Membro',
                    joined_at: admin.firestore.FieldValue.serverTimestamp()
                });

                // 4. Update organization stats
                transaction.update(orgDoc.ref, {
                    'stats.members_count': admin.firestore.FieldValue.increment(1)
                });

                return { orgId, orgName: orgData.name };
            });

            // 5. Audit log (outside transaction for better performance if it fails, or keep inside if critical)
            await db.collection('auditLogs').add({
                organization_id: result.orgId,
                user_id: userId,
                user_name: userName,
                action: 'JOIN_ORGANIZATION',
                details: { invite_code: inviteCode },
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return {
                success: true,
                orgId: result.orgId,
                message: `Você entrou na organização ${result.orgName} com sucesso!`
            };
        } catch (error: any) {
            if (error instanceof HttpsError) throw error;
            console.error('[joinOrganization] Error:', error);
            throw new HttpsError('internal', error.message || 'Erro ao entrar na organização');
        }
    }
);
