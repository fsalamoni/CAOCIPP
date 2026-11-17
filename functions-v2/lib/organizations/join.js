"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinOrganization = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const normalization_1 = require("../shared/normalization");
const vinculo_1 = require("../shared/vinculo");
const cotas_1 = require("../shared/cotas");
exports.joinOrganization = (0, https_1.onCall)({ region: 'southamerica-east1', cors: true }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { inviteCode: rawInviteCode } = request.data;
    if (!rawInviteCode) {
        throw new https_1.HttpsError('invalid-argument', 'Invite code is required');
    }
    const inviteCode = rawInviteCode.trim().toUpperCase();
    console.log(`[joinOrganization] Attempting join for user ${request.auth.uid} with code [${inviteCode}]`);
    const db = admin.firestore();
    const userId = request.auth.uid;
    await (0, vinculo_1.exigirContaLiberada)(db, userId);
    const userEmail = request.auth.token.email || '';
    const userName = (0, normalization_1.formatPersonName)(request.auth.token.name || '');
    // Cota da plataforma: membros ativos por órgão (fora da transação;
    // ponytail: duas entradas simultâneas no último lugar podem passar juntas).
    const alvo = await db.collection('organizations').where('invite_code', '==', inviteCode).limit(1).get();
    if (!alvo.empty) {
        const alvoId = alvo.docs[0].id;
        const meu = await db.collection('userOrganizations').doc(`${userId}_${alvoId}`).get();
        if (!(meu.exists && ((_a = meu.data()) === null || _a === void 0 ? void 0 : _a.active) !== false)) {
            const doOrgao = db.collection('userOrganizations').where('organization_id', '==', alvoId);
            const [total, inativos] = await Promise.all([
                doOrgao.count().get(),
                doOrgao.where('active', '==', false).count().get(),
            ]);
            await (0, cotas_1.exigirDentroDaCota)('max_members_per_org', total.data().count - inativos.data().count);
        }
    }
    try {
        const result = await db.runTransaction(async (transaction) => {
            // 1. Find organization by invite code
            const orgsQuery = db.collection('organizations')
                .where('invite_code', '==', inviteCode)
                .limit(1);
            const orgsSnapshot = await transaction.get(orgsQuery);
            if (orgsSnapshot.empty) {
                throw new https_1.HttpsError('not-found', 'Organização não encontrada com este código.');
            }
            const orgDoc = orgsSnapshot.docs[0];
            const orgData = orgDoc.data();
            const orgId = orgDoc.id;
            if ((0, vinculo_1.orgSuspensa)(orgData)) {
                throw new https_1.HttpsError('failed-precondition', 'Este órgão está suspenso pela administração da plataforma e não aceita novos membros agora.');
            }
            // 2. Puxar a função do "meu perfil" (users/{userId}.function) —
            //    a mesma fonte que /Profile usa. Se o usuário preencheu a
            //    função no meu perfil, ela vira a função deste member; se
            //    não preencheu, fallback para "Membro". O member.function
            //    deixa de ser o genérico "Membro" quando o usuário já tem
            //    uma função real definida, evitando que o admin precise
            //    re-cadastrar manualmente.
            const userProfileRef = db.collection('users').doc(userId);
            const userProfileDoc = await transaction.get(userProfileRef);
            const profileFunction = userProfileDoc.exists
                ? String(userProfileDoc.get('function') || '').trim()
                : '';
            const memberFunction = profileFunction || 'Membro';
            // 3. Check if already a member
            const membershipRef = db.collection('userOrganizations').doc(`${userId}_${orgId}`);
            const membershipDoc = await transaction.get(membershipRef);
            if (membershipDoc.exists) {
                const memberData = membershipDoc.data();
                // If member is active, throw error
                if ((memberData === null || memberData === void 0 ? void 0 : memberData.active) !== false) {
                    throw new https_1.HttpsError('already-exists', 'Você já é membro desta organização.');
                }
                // If inactive (soft deleted), reactivate. Mantemos a função
                // que o member já tinha (não sobrescrevemos com a do profile
                // porque pode ter sido editada pelo admin do órgão).
                transaction.update(membershipRef, {
                    role: 'member',
                    function: (memberData === null || memberData === void 0 ? void 0 : memberData.function) || memberFunction,
                    active: true,
                    // We update joined_at to request time to reflect "new" entry, 
                    // or we could keep original and add "rejoined_at". 
                    // User requested "Data de Entrada e Saída". 
                    // If we overwrite joined_at, we lose original entry.
                    // But if we don't, it looks like they were always there.
                    // Simple approach: Overwrite joined_at to now (new term).
                    // And clear left_at.
                    joined_at: admin.firestore.FieldValue.serverTimestamp(),
                    left_at: admin.firestore.FieldValue.delete()
                });
            }
            else {
                // 4. Create new membership
                transaction.set(membershipRef, {
                    id: `${userId}_${orgId}`,
                    user_id: userId,
                    organization_id: orgId,
                    user_email: userEmail,
                    user_name: userName,
                    role: 'member',
                    function: memberFunction,
                    active: true, // Mark as active
                    joined_at: admin.firestore.FieldValue.serverTimestamp()
                });
            }
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
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        console.error('[joinOrganization] Error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Erro ao entrar na organização');
    }
});
//# sourceMappingURL=join.js.map