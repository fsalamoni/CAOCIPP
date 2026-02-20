"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProcesses = exports.exportProcesses = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const SECRET_TOKEN = "ANTIGRAVITY_TEMP_SECRET";
exports.exportProcesses = (0, https_1.onRequest)({ region: 'southamerica-east1' }, async (req, res) => {
    if (req.query.token !== SECRET_TOKEN) {
        res.status(403).send("Forbidden");
        return;
    }
    try {
        const db = admin.firestore();
        const snapshot = await db.collection("processes").get();
        const processes = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.status !== "Pendente") {
                processes.push({
                    id: doc.id,
                    process_number: data.process_number || "Sem Número",
                    matter_object: data.matter_object || "",
                    network_folder: data.network_folder || "",
                    current_category: data.matter_category || "",
                    current_subcategory: data.matter_subcategory || ""
                });
            }
        });
        res.status(200).json(processes);
    }
    catch (error) {
        console.error("Error exporting processes:", error);
        res.status(500).send(error.message);
    }
});
exports.updateProcesses = (0, https_1.onRequest)({ region: 'southamerica-east1', cors: true }, async (req, res) => {
    if (req.query.token !== SECRET_TOKEN) {
        res.status(403).send("Forbidden");
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).send("Method Not Allowed");
        return;
    }
    try {
        const db = admin.firestore();
        const updates = req.body.updates; // Expected: [{ id: string, category: string, subcategory: string }]
        if (!updates || !Array.isArray(updates)) {
            res.status(400).send("Invalid payload");
            return;
        }
        const batch = db.batch();
        let count = 0;
        for (const update of updates) {
            const docRef = db.collection("processes").doc(update.id);
            batch.update(docRef, {
                matter_category: update.category,
                matter_subcategory: update.subcategory,
                updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            count++;
        }
        await batch.commit();
        res.status(200).send(`Successfully updated ${count} processes.`);
    }
    catch (error) {
        console.error("Error updating processes:", error);
        res.status(500).send(error.message);
    }
});
//# sourceMappingURL=processAnalysisTools.js.map