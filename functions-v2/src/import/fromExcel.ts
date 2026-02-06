import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as XLSX from 'xlsx';

interface ImportExcelRequest {
    organizationId: string;
    fileData: string; // Base64
}

export const importProcessesFromExcel = onCall<ImportExcelRequest>(
    {
        region: 'southamerica-east1',
        memory: '1GiB',
        timeoutSeconds: 300 // 5 minutes
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { organizationId, fileData } = request.data;
        if (!organizationId || !fileData) {
            throw new HttpsError('invalid-argument', 'Missing fields');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // 1. Verify permissions
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Not a member');
        }
        // Only admins/creators/assessoria can import?
        // Let's assume member can import for now, or check role if strict.

        try {
            // 2. Parse Excel
            const buffer = Buffer.from(fileData, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet);

            if (rows.length === 0) {
                return { success: false, message: 'Arquivo vazio' };
            }

            if (rows.length > 5000) {
                // This restriction was in Task.md (CRIT-002)
                throw new HttpsError('invalid-argument', 'Arquivo excede limite de 5000 linhas');
            }

            // 3. Process Rows (Batching)
            // Firestore batch limit is 500.
            const batchSize = 450;
            let batch = db.batch();
            let count = 0;
            let totalImported = 0;

            for (const row of rows) {
                // Map columns (adjust keys based on actual Excel headers)
                // Assuming headers: Numero, Consulente, Local, DataEntrada, Objeto, etc.

                const processRef = db.collection('processes').doc();

                const entryDate = row['Data Entrada'] || row['Data de Entrada'] || row['DATA ENTRADA'];
                // Need robust date parsing here. Assuming string or Excel serial.

                const processData = {
                    id: processRef.id,
                    organization_id: organizationId,
                    process_number: row['Número'] || row['Numero'] || row['NÚMERO'] || 'SEM NÚMERO',
                    consultant: row['Consulente'] || row['CONSULENTE'] || '',
                    location: row['Local'] || row['Município'] || '',
                    entry_date: parseExcelDate(entryDate),
                    matter_object: row['Objeto'] || row['Assunto'] || '',
                    status: 'Em triagem', // Start fresh or try to infer?
                    // If importing historical data, maybe infer status?
                    // For now, default.
                    created_by: userId,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                    updated_at: admin.firestore.FieldValue.serverTimestamp()
                };

                batch.set(processRef, processData);
                count++;

                if (count >= batchSize) {
                    await batch.commit();
                    batch = db.batch();
                    count = 0;
                }
                totalImported++;
            }

            if (count > 0) {
                await batch.commit();
            }

            // 4. Update stats
            await db.collection('organizations').doc(organizationId).update({
                'stats.processes_count': admin.firestore.FieldValue.increment(totalImported),
                'stats.active_processes': admin.firestore.FieldValue.increment(totalImported)
            });

            return { success: true, count: totalImported, message: `${totalImported} processos importados` };

        } catch (error) {
            console.error('Import error:', error);
            throw new HttpsError('internal', 'Erro ao importar arquivo');
        }
    }
);

function parseExcelDate(value: any): string | null {
    if (!value) return null;
    // Handle JS Date, Excel Serial, or String DD/MM/YYYY
    // Simplified implementation
    return value.toString();
}
