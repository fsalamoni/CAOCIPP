"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupGhostExpedientes = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
exports.cleanupGhostExpedientes = (0, https_1.onRequest)({ region: 'southamerica-east1', timeoutSeconds: 540 }, async (req, res) => {
    try {
        const db = admin.firestore();
        const snap = await db.collection('expedientes').get();
        let toDel = [];
        snap.forEach(doc => {
            const data = doc.data();
            if (data.expediente_number && data.expediente_number.startsWith('AUTO-')) {
                toDel.push(doc.ref);
            }
        });
        console.log(`[Cleanup] Found ${toDel.length} ghost expedientes.`);
        if (toDel.length === 0) {
            res.status(200).send('No ghost expedientes found.');
            return;
        }
        let batch = db.batch();
        let count = 0;
        let total = 0;
        for (let ref of toDel) {
            batch.delete(ref);
            count++;
            if (count >= 400) {
                await batch.commit();
                total += count;
                batch = db.batch();
                count = 0;
                console.log(`[Cleanup] Deleted batch. Total so far: ${total}`);
            }
        }
        if (count > 0) {
            await batch.commit();
            total += count;
        }
        console.log(`[Cleanup] Complete. Deleted total: ${total}`);
        res.status(200).send(`Successfully deleted ${total} ghost expedientes.`);
    }
    catch (error) {
        console.error('[Cleanup] Error:', error);
        res.status(500).send(`Error: ${error.message}`);
    }
});
//# sourceMappingURL=cleanup.js.map