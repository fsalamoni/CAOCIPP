import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { formatPersonName } from '../shared/normalization';

interface CreateOrgRequest {
    name: string;
    description?: string;
}

export const createOrganization = onCall<CreateOrgRequest>(
    { region: 'southamerica-east1', cors: true },
    async (request) => {
        // Verify authentication
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { name, description = '' } = request.data;

        if (!name) {
            throw new HttpsError('invalid-argument', 'Organization name is required');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // Generate unique invite code
        let inviteCode = generateInviteCode();
        let isUnique = false;

        // Ensure uniqueness (simple retry logic)
        while (!isUnique) {
            const existing = await db.collection('organizations')
                .where('invite_code', '==', inviteCode)
                .get();

            if (existing.empty) {
                isUnique = true;
            } else {
                inviteCode = generateInviteCode();
            }
        }

        // Create organization
        const orgRef = db.collection('organizations').doc();
        const organization = {
            id: orgRef.id,
            name,
            description,
            invite_code: inviteCode,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            created_by: userId,
            stats: {
                members_count: 1,
                processes_count: 0,
                active_processes: 0
            }
        };

        await orgRef.set(organization);

        // Add creator as member
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${orgRef.id}`);
        await membershipRef.set({
            id: `${userId}_${orgRef.id}`,
            user_id: userId,
            user_email: request.auth.token.email,
            user_name: formatPersonName(request.auth.token.name || ''),
            organization_id: orgRef.id,
            role: 'creator',
            function: 'Criador',
            joined_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // Create audit log
        await db.collection('auditLogs').add({
            organization_id: orgRef.id,
            user_id: userId,
            user_name: request.auth.token.name || '',
            action: 'CREATE_ORGANIZATION',
            details: { organization_name: name },
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            success: true,
            organizationId: orgRef.id,
            message: 'Organização criada com sucesso!'
        };
    }
);

function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
