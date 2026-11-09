// Escritas diretas do cliente no Firestore que as regras ainda permitem:
// notificação lida e preferências do próprio usuário. Todo o resto (órgãos,
// vínculos, registros) passa pelas Cloud Functions em functionsService.js.
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { logger } from '@/utils/logger';

/** Marca a notificação como lida (as regras só aceitam read e read_at). */
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

/** Preferências do próprio usuário ({} se não houver ou se a leitura falhar). */
export async function getUserPreferences(userId) {
    try {
        const prefDoc = await getDoc(doc(db, 'userPreferences', userId));
        return prefDoc.exists() ? prefDoc.data() : {};
    } catch (error) {
        logger.error('Error fetching user preferences:', error);
        return {};
    }
}

/**
 * Grava preferências do próprio usuário. Propaga o erro: quem chama
 * (useUserPreferences.updatePreferences) reverte a atualização otimista.
 */
export async function saveUserPreferences(userId, preferences) {
    try {
        await setDoc(doc(db, 'userPreferences', userId), {
            ...preferences,
            updated_at: serverTimestamp()
        }, { merge: true });
        logger.debug('User preferences saved:', userId);
    } catch (error) {
        logger.error('Error saving user preferences:', error);
        throw error;
    }
}
