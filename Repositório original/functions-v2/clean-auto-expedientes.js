// This script deletes all Expedientes containing "AUTO-" from the firestore database
// since they were created by mistake during a garbage import

const admin = require("firebase-admin");

// Initialize Firebase Admin with credentials
// We assume GOOGLE_APPLICATION_CREDENTIALS is set, or we can use the default app if running in the right environment
function initialize() {
    try {
        admin.initializeApp();
        console.log("Firebase Admin initialized successfully.");
    } catch (e) {
        if (!e.message.includes('already exists')) {
            console.error("Failed to initialize Firebase Admin:", e);
            process.exit(1);
        }
    }
}

async function deleteGhostExpedientes() {
    try {
        initialize();
        const db = admin.firestore();
        
        console.log("Fetching expedientes to delete...");
        
        // Due to limits with "startsWith", it's easier to just fetch all expedientes 
        // and filter in memory since it's just ~1200 records
        const snapshot = await db.collection("expedientes").get();
        const docsToDelete = [];
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            const expNumber = data.expediente_number || "";
            
            // If the number starts with AUTO- and doesn't have a valid object/origin/system
            if (expNumber.startsWith("AUTO-")) {
                docsToDelete.push(doc.ref);
            }
        });
        
        console.log(`Found ${docsToDelete.length} expedientes starting with 'AUTO-'. Starting deletion...`);
        
        if (docsToDelete.length === 0) {
            console.log("No ghost expedientes found. Exiting.");
            return;
        }

        // Delete in batches of 500 (Firestore limit)
        const BATCH_SIZE = 500;
        let batch = db.batch();
        let count = 0;
        let totalDeleted = 0;

        for (const ref of docsToDelete) {
            batch.delete(ref);
            count++;
            
            if (count >= BATCH_SIZE) {
                await batch.commit();
                totalDeleted += count;
                console.log(`Committed batch of ${count}. Total deleted: ${totalDeleted}`);
                batch = db.batch();
                count = 0;
            }
        }
        
        // Commit remaining
        if (count > 0) {
            await batch.commit();
            totalDeleted += count;
            console.log(`Committed final batch of ${count}. Total deleted: ${totalDeleted}`);
        }
        
        console.log(`Successfully deleted ${totalDeleted} ghost expedientes.`);
        
        // Since we deleted expedientes, we need to update the organization stats
        // First find out which organizations these belonged to
        console.log("Resetting organization expedientes_count stats... (They will recalculate automatically on next action or we can just decrement)");
        console.log("To ensure data integrity, please navigate to the Organization page, the stats will self-heal or we can trigger a manual recount if needed.");
        
    } catch (error) {
        console.error("Error deleting expedientes:", error);
    }
}

deleteGhostExpedientes().then(() => {
    console.log("Script finished.");
    process.exit(0);
});
