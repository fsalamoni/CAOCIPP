// Firestore Services - CRUD operations for Firebase collections
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { logger } from '@/utils/logger';

// ========== ORGANIZATIONS ==========

/**
 * Create a new organization
 * @param {object} data - Organization data
 * @param {string} creatorUid - Creator's Firebase UID
 * @returns {Promise<string>} Organization ID
 */
export async function createOrganization(data, creatorUid) {
    try {
        // Generate unique 8-character invite code
        const inviteCode = generateInviteCode();

        const orgData = {
            name: data.name,
            description: data.description || '',
            invite_code: inviteCode,
            created_by: creatorUid,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            stats: {
                members_count: 1,
                processes_count: 0,
                active_processes: 0,
            }
        };

        const orgRef = await addDoc(collection(db, 'organizations'), orgData);

        // Also create creator's membership
        await createMembership(creatorUid, orgRef.id, 'creator');

        logger.info('Organization created:', orgRef.id);
        return orgRef.id;
    } catch (error) {
        logger.error('Error creating organization:', error);
        throw error;
    }
}

/**
 * Update organization
 * @param {string} orgId - Organization ID
 * @param {object} updates - Fields to update
 */
export async function updateOrganization(orgId, updates) {
    try {
        const orgRef = doc(db, 'organizations', orgId);
        await updateDoc(orgRef, {
            ...updates,
            updated_at: serverTimestamp()
        });
        logger.info('Organization updated:', orgId);
    } catch (error) {
        logger.error('Error updating organization:', error);
        throw error;
    }
}

/**
 * Delete organization
 * @param {string} orgId - Organization ID
 */
export async function deleteOrganization(orgId) {
    try {
        // TODO: In production, this should be a Cloud Function that:
        // 1. Deletes all processes
        // 2. Deletes all memberships
        // 3. Deletes audit logs
        // 4. Finally deletes the organization

        const orgRef = doc(db, 'organizations', orgId);
        await deleteDoc(orgRef);
        logger.info('Organization deleted:', orgId);
    } catch (error) {
        logger.error('Error deleting organization:', error);
        throw error;
    }
}

/**
 * Join organization via invite code
 * @param {string} inviteCode - Invite code
 * @param {string} userId - User's Firebase UID
 * @returns {Promise<string>} Organization ID
 */
export async function joinOrganizationByInvite(inviteCode, userId) {
    try {
        // Find organization by invite code
        const orgsRef = collection(db, 'organizations');
        const q = query(orgsRef, where('invite_code', '==', inviteCode.toUpperCase()));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            throw new Error('Código de convite inválido');
        }

        const orgDoc = snapshot.docs[0];
        const orgId = orgDoc.id;

        // Check if user is already a member
        const membershipId = `${userId}_${orgId}`;
        const membershipRef = doc(db, 'userOrganizations', membershipId);
        const existingMembership = await getDoc(membershipRef);

        if (existingMembership.exists()) {
            throw new Error('Você já é membro desta organização');
        }

        // Create membership
        await createMembership(userId, orgId, 'member');

        // Update organization stats
        await updateDoc(doc(db, 'organizations', orgId), {
            'stats.members_count': (orgDoc.data().stats?.members_count || 0) + 1,
            updated_at: serverTimestamp()
        });

        logger.info('User joined organization:', orgId);
        return orgId;
    } catch (error) {
        logger.error('Error joining organization:', error);
        throw error;
    }
}

// ========== MEMBERSHIPS ==========

/**
 * Create user-organization membership
 * @param {string} userId - User's Firebase UID
 * @param {string} orgId - Organization ID
 * @param {string} role - User role ('creator', 'admin', 'member')
 */
export async function createMembership(userId, orgId, role = 'member') {
    try {
        // Get user profile for denormalization
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.data();

        const membershipId = `${userId}_${orgId}`;
        const membershipData = {
            id: membershipId,
            user_id: userId,
            organization_id: orgId,
            user_email: userData?.email || '',
            user_name: userData?.full_name || '',
            user_photo: userData?.photo_url || '',
            role: role,
            function: userData?.function || '',
            joined_at: serverTimestamp(),
            updated_at: serverTimestamp(),
        };

        await setDoc(doc(db, 'userOrganizations', membershipId), membershipData);
        logger.info('Membership created:', membershipId);
    } catch (error) {
        logger.error('Error creating membership:', error);
        throw error;
    }
}

/**
 * Update membership role
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 * @param {string} newRole - New role
 */
export async function updateMembershipRole(userId, orgId, newRole) {
    try {
        const membershipId = `${userId}_${orgId}`;
        await updateDoc(doc(db, 'userOrganizations', membershipId), {
            role: newRole,
            updated_at: serverTimestamp()
        });
        logger.info('Membership role updated:', membershipId);
    } catch (error) {
        logger.error('Error updating membership role:', error);
        throw error;
    }
}

/**
 * Remove member from organization
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 */
export async function removeMember(userId, orgId) {
    try {
        const membershipId = `${userId}_${orgId}`;
        await deleteDoc(doc(db, 'userOrganizations', membershipId));

        // Update organization stats
        const orgDoc = await getDoc(doc(db, 'organizations', orgId));
        if (orgDoc.exists()) {
            await updateDoc(doc(db, 'organizations', orgId), {
                'stats.members_count': Math.max(0, (orgDoc.data().stats?.members_count || 1) - 1),
                updated_at: serverTimestamp()
            });
        }

        logger.info('Member removed:', membershipId);
    } catch (error) {
        logger.error('Error removing member:', error);
        throw error;
    }
}

// ========== PROCESSES ==========

/**
 * Create a new process
 * @param {object} data - Process data
 * @param {string} creatorUid - Creator's Firebase UID
 * @returns {Promise<string>} Process ID
 */
export async function createProcess(data, creatorUid) {
    try {
        const processData = {
            organization_id: data.organization_id,
            process_number: data.process_number,
            consultant: data.consultant,
            location: data.location,
            entry_date: data.entry_date, // YYYY-MM-DD format
            distribution_date: data.distribution_date || null,
            analysis_start_date: data.analysis_start_date || null,
            review_submission_date: data.review_submission_date || null,
            review_return_date: data.review_return_date || null,
            archived_date: data.archived_date || null,
            matter_object: data.matter_object || '',
            decision: data.decision || '',
            status: data.status || 'Em triagem',
            urgency_request: data.urgency_request || false,
            responsible_user_id: data.responsible_user_id || null,
            responsible_user_name: data.responsible_user_name || null,
            created_by: creatorUid,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
            updated_by: creatorUid,
        };

        const processRef = await addDoc(collection(db, 'processes'), processData);

        // Update organization stats
        const orgDoc = await getDoc(doc(db, 'organizations', data.organization_id));
        if (orgDoc.exists()) {
            const stats = orgDoc.data().stats || {};
            await updateDoc(doc(db, 'organizations', data.organization_id), {
                'stats.processes_count': (stats.processes_count || 0) + 1,
                'stats.active_processes': (stats.active_processes || 0) + 1,
                updated_at: serverTimestamp()
            });
        }

        logger.info('Process created:', processRef.id);
        return processRef.id;
    } catch (error) {
        logger.error('Error creating process:', error);
        throw error;
    }
}

/**
 * Update process
 * @param {string} processId - Process ID
 * @param {object} updates - Fields to update
 * @param {string} updaterUid - Updater's Firebase UID
 */
export async function updateProcess(processId, updates, updaterUid) {
    try {
        await updateDoc(doc(db, 'processes', processId), {
            ...updates,
            updated_at: serverTimestamp(),
            updated_by: updaterUid
        });
        logger.info('Process updated:', processId);
    } catch (error) {
        logger.error('Error updating process:', error);
        throw error;
    }
}

/**
 * Delete process
 * @param {string} processId - Process ID
 * @param {string} orgId - Organization ID (for stats update)
 */
export async function deleteProcess(processId, orgId) {
    try {
        await deleteDoc(doc(db, 'processes', processId));

        // Update organization stats
        const orgDoc = await getDoc(doc(db, 'organizations', orgId));
        if (orgDoc.exists()) {
            const stats = orgDoc.data().stats || {};
            await updateDoc(doc(db, 'organizations', orgId), {
                'stats.processes_count': Math.max(0, (stats.processes_count || 1) - 1),
                'stats.active_processes': Math.max(0, (stats.active_processes || 1) - 1),
                updated_at: serverTimestamp()
            });
        }

        logger.info('Process deleted:', processId);
    } catch (error) {
        logger.error('Error deleting process:', error);
        throw error;
    }
}

/**
 * Batch import processes
 * @param {array} processesData - Array of process objects
 * @param {string} orgId - Organization ID
 * @param {string} creatorUid - Creator's Firebase UID
 * @returns {Promise<number>} Number of processes created
 */
export async function batchImportProcesses(processesData, orgId, creatorUid) {
    try {
        const batch = writeBatch(db);
        const processesRef = collection(db, 'processes');

        processesData.forEach(data => {
            const newProcessRef = doc(processesRef);
            batch.set(newProcessRef, {
                ...data,
                organization_id: orgId,
                created_by: creatorUid,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp(),
                updated_by: creatorUid,
            });
        });

        await batch.commit();

        // Update organization stats
        const orgDoc = await getDoc(doc(db, 'organizations', orgId));
        if (orgDoc.exists()) {
            const stats = orgDoc.data().stats || {};
            await updateDoc(doc(db, 'organizations', orgId), {
                'stats.processes_count': (stats.processes_count || 0) + processesData.length,
                'stats.active_processes': (stats.active_processes || 0) + processesData.length,
                updated_at: serverTimestamp()
            });
        }

        logger.info(`Batch imported ${processesData.length} processes`);
        return processesData.length;
    } catch (error) {
        logger.error('Error batch importing processes:', error);
        throw error;
    }
}

// ========== NOTIFICATIONS ==========

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 */
export async function markNotificationAsRead(notificationId) {
    try {
        await updateDoc(doc(db, 'notifications', notificationId), {
            read: true,
            read_at: serverTimestamp()
        });
    } catch (error) {
        logger.error('Error marking notification as read:', error);
        throw error;
    }
}

// ========== HELPERS ==========

/**
 * Generate random 8-character invite code
 * @returns {string} Invite code (uppercase alphanumeric)
 */
function generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
