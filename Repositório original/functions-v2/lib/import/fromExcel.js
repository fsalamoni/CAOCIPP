"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importProcessesFromExcel = void 0;
const admin = require("firebase-admin");
const https_1 = require("firebase-functions/v2/https");
const XLSX = require("xlsx");
const status_1 = require("../shared/status");
exports.importProcessesFromExcel = (0, https_1.onCall)({
    region: 'southamerica-east1',
    memory: '1GiB',
    timeoutSeconds: 540, // 9 minutes for large imports
    invoker: 'public', // Allow public invocation (Cloud Run level)
    cors: true // Enable CORS (should be automatic but being explicit)
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Usuário deve estar autenticado');
    }
    const { organizationId, fileData } = request.data;
    if (!organizationId || !fileData) {
        throw new https_1.HttpsError('invalid-argument', 'Campos obrigatórios faltando (organizationId ou fileData)');
    }
    const db = admin.firestore();
    const userId = request.auth.uid;
    // 1. Verify permissions
    const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
    const membershipSnap = await membershipRef.get();
    if (!membershipSnap.exists) {
        throw new https_1.HttpsError('permission-denied', 'Você não é membro desta organização');
    }
    try {
        console.log(`[Import] Started by user ${userId} for org ${organizationId}`);
        console.log(`[Import] File size: ${fileData.length} bytes (base64)`);
        // 2. Parse file (JSON, Excel, or CSV)
        const buffer = Buffer.from(fileData, 'base64');
        let rows = [];
        let fileType = 'unknown';
        // Try JSON first
        try {
            const jsonString = buffer.toString('utf-8');
            const parsed = JSON.parse(jsonString);
            rows = Array.isArray(parsed) ? parsed : [parsed];
            fileType = 'json';
            console.log(`[Import] ✅ Parsed as JSON: ${rows.length} entries`);
        }
        catch (jsonError) {
            // Not JSON - try Excel/CSV
            try {
                const workbook = XLSX.read(buffer, { type: 'buffer' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                rows = XLSX.utils.sheet_to_json(sheet);
                fileType = 'excel/csv';
                console.log(`[Import] ✅ Parsed as Excel/CSV: ${rows.length} rows`);
            }
            catch (excelError) {
                console.error('[Import] ❌ Failed to parse file:', {
                    jsonError: jsonError.message,
                    excelError: excelError.message
                });
                throw new https_1.HttpsError('invalid-argument', 'Formato de arquivo inválido. Use JSON válido, Excel (.xlsx, .xls) ou CSV');
            }
        }
        if (rows.length === 0) {
            return {
                success: false,
                created: 0,
                updated: 0,
                errors: 0,
                total: 0,
                message: 'Arquivo vazio - nenhum processo encontrado'
            };
        }
        // Increased limit to 50,000 (user requested no limit)
        if (rows.length > 50000) {
            throw new https_1.HttpsError('invalid-argument', `Arquivo muito grande (${rows.length} processos). Máximo: 50.000. ` +
                'Para importações maiores, divida em múltiplos arquivos.');
        }
        console.log(`[Import] Processing ${rows.length} processes (file type: ${fileType})...`);
        // 3. Process Rows with UPSERT logic
        const batchSize = 450; // Firestore limit is 500, use 450 for safety
        let batch = db.batch();
        let batchCount = 0;
        const stats = {
            created: 0,
            updated: 0,
            errors: 0,
            errorDetails: []
        };
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                // Normalize process number (trim, uppercase)
                // CRITICAL: Real files use "PROCESSO SIM\n(NÚMERO)" with line break!
                const rawNumber = row['PROCESSO SIM\n(NÚMERO)'] || // Real format with \n
                    row['PROCESSO SIM\\n(NÚMERO)'] || // Escaped version
                    row['Número'] || row['Numero'] || row['NÚMERO'] ||
                    row['número'] || row['numero'] || row['Process Number'] || '';
                let processNumber = rawNumber.toString().trim();
                // If no number, generate unique one
                if (!processNumber || processNumber === 'SEM NÚMERO' || processNumber === '') {
                    processNumber = `AUTO-${Date.now()}-${i}`;
                    console.log(`[Import] Row ${i + 1}: Generated number ${processNumber}`);
                }
                // Extract entry date early for UPSERT logic
                const entryDate = parseExcelDate(row['ENTRADA NO CAOPP\n(DATA)'] || // Real format with \n
                    row['ENTRADA NO CAOPP\\n(DATA)'] || // Escaped
                    row['Data Entrada'] || row['DATA ENTRADA']) || null;
                // Query existing process by number + entry_date + organization
                // NEW LOGIC: If same number BUT different date, it's a DIFFERENT process
                const existingQuery = await db.collection('processes')
                    .where('organization_id', '==', organizationId)
                    .where('process_number', '==', processNumber)
                    .where('entry_date', '==', entryDate)
                    .limit(1)
                    .get();
                let processRef;
                let isUpdate = false;
                if (!existingQuery.empty) {
                    // Process EXISTS with SAME NUMBER and SAME DATE - UPDATE
                    processRef = existingQuery.docs[0].ref;
                    isUpdate = true;
                }
                else {
                    // Process DOES NOT EXIST (or has different date) - CREATE
                    processRef = db.collection('processes').doc();
                    isUpdate = false;
                }
                // Build process data - FLEXIBLE (accept empty fields)
                // CRITICAL: Real files use column names with \n line breaks!
                const processData = {
                    organization_id: organizationId,
                    process_number: processNumber,
                    // Core fields - EXACT names from real files
                    consultant: (row['CONSULENTE'] || row['Consulente'] || row['consulente'] || '').toString().trim(),
                    location: (row['LOCAL DOS FATOS\n(CIDADE)'] || // Real format with \n
                        row['LOCAL DOS FATOS\\n(CIDADE)'] || // Escaped
                        row['Local'] || row['LOCAL'] || row['Município'] || '').toString().trim(),
                    matter_object: (row['MATÉRIA E OBJETO DA CONSULTA'] || // Real format
                        row['Objeto'] || row['OBJETO'] || row['Assunto'] || '').toString().trim(),
                    // Entry date - Already parsed above
                    entry_date: entryDate,
                    // Responsible user fields (separate name from ID)
                    responsible_user_name: (row['ASSESSOR RESPONSÁVEL'] || // Real format
                        row['Responsável'] || row['RESPONSÁVEL'] || '').toString().trim() || null,
                    responsible_user_id: null, // Not in import files, leave null
                    // Urgency - EXACT name from real files
                    urgency_request: (row['PEDIDO DE URGÊNCIA'] === 'Sim' ||
                        row['Solicitação de Urgência'] === 'Sim' ||
                        row['Urgente'] === 'Sim'),
                    // Observations - EXACT name from real files (long name!)
                    observations: (row['OBSERVAÇÕES E PONTOS IMPORTANTES DA RESPOSTA'] ||
                        row['Observações'] || row['Obs'] || '').toString().trim(),
                    // === NEW WORKFLOW DATE FIELDS (from real files) ===
                    // These are valuable for SLA analysis and workflow tracking
                    distribution_date: parseExcelDate(row['DISTRIBUIÇÃO\n(DATA)'] || row['DISTRIBUIÇÃO\\n(DATA)']) || null,
                    analysis_start_date: parseExcelDate(row['INÍCIO DA ANÁLISE\n(DATA)'] || row['INÍCIO DA ANÁLISE\\n(DATA)']) || null,
                    review_submission_date: parseExcelDate(row['REMESSA AO DR. PARA REVISÃO (DATA)']) || null,
                    review_return_date: parseExcelDate(row['DEVOLUÇÃO APÓS REVISÃO\n(DATA)'] ||
                        row['DEVOLUÇÃO APÓS REV ISÃO\\n(DATA)']) || null,
                    archived_date: parseExcelDate(row['NA PASTA\nARQUIVADO\n(DATA)'] ||
                        row['NA PASTA\\nARQUIVADO\\n(DATA)']) || null,
                    // Extra metadata fields
                    access_restriction: (row['RESTRIÇÃO DE ACESSO'] || '').toString().trim(),
                    network_folder: (row['PASTA NA REDE'] || '').toString().trim(),
                    // Timestamps
                    updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    last_imported_at: admin.firestore.FieldValue.serverTimestamp()
                };
                // CALCULATE STATUS AUTOMATICALLY (AFTER all workflow dates are defined)
                // This ensures status reflects the actual process state based on workflow progression
                processData.status = (0, status_1.calculateStatus)(processData);
                // Remove undefined values for updates (don't overwrite existing data with undefined)
                if (isUpdate) {
                    Object.keys(processData).forEach(key => {
                        if (processData[key] === undefined) {
                            delete processData[key];
                        }
                    });
                }
                // If creating new, add creation fields
                if (!isUpdate) {
                    processData.id = processRef.id;
                    processData.created_by = userId;
                    processData.created_at = admin.firestore.FieldValue.serverTimestamp();
                }
                // Add to batch
                if (isUpdate) {
                    batch.update(processRef, processData);
                    stats.updated++;
                }
                else {
                    batch.set(processRef, processData);
                    stats.created++;
                }
                batchCount++;
                // Commit batch when reaching limit
                if (batchCount >= batchSize) {
                    await batch.commit();
                    console.log(`[Import] ✅ Batch committed: ${batchCount} processes (${stats.created} created, ${stats.updated} updated)`);
                    batch = db.batch();
                    batchCount = 0;
                }
            }
            catch (error) {
                // Individual process error - LOG and CONTINUE (don't fail entire import)
                stats.errors++;
                const errorDetail = {
                    row: i + 1,
                    processNumber: row['Número'] || row['Numero'] || row['número'] || 'DESCONHECIDO',
                    error: error.message || error.toString() || 'Erro desconhecido'
                };
                stats.errorDetails.push(errorDetail);
                console.error(`[Import] ❌ Error on row ${i + 1}:`, {
                    processNumber: errorDetail.processNumber,
                    error: errorDetail.error,
                    rowData: JSON.stringify(row).substring(0, 200) // First 200 chars
                });
                // Continue to next process - ERROR TOLERANCE
                continue;
            }
        }
        // Commit remaining batch
        if (batchCount > 0) {
            await batch.commit();
            console.log(`[Import] ✅ Final batch committed: ${batchCount} processes`);
        }
        // 4. Update organization stats (only count NEW processes)
        const netIncrement = stats.created; // Don't increment for updates
        if (netIncrement > 0) {
            await db.collection('organizations').doc(organizationId).update({
                'stats.processes_count': admin.firestore.FieldValue.increment(netIncrement),
                'stats.active_processes': admin.firestore.FieldValue.increment(netIncrement),
                'stats.last_import_at': admin.firestore.FieldValue.serverTimestamp()
            });
        }
        // 5. Build detailed response message
        let message = '';
        if (stats.created > 0)
            message += `${stats.created} criados`;
        if (stats.updated > 0) {
            if (message)
                message += ', ';
            message += `${stats.updated} atualizados`;
        }
        if (stats.errors > 0) {
            if (message)
                message += ', ';
            message += `${stats.errors} erros`;
        }
        console.log(`[Import] ✅ Complete:`, {
            total: rows.length,
            created: stats.created,
            updated: stats.updated,
            errors: stats.errors
        });
        return {
            success: stats.errors < rows.length, // Success if at least SOME imported
            created: stats.created,
            updated: stats.updated,
            errors: stats.errors,
            errorDetails: stats.errorDetails.slice(0, 20), // Return max 20 error samples
            total: rows.length,
            message: message || 'Nenhum processo importado'
        };
    }
    catch (error) {
        console.error('[Import] ❌ Fatal error:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        // If already HttpsError, re-throw
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        // Generic internal error
        throw new https_1.HttpsError('internal', `Erro ao importar arquivo: ${error.message || 'Erro desconhecido'}`);
    }
});
/**
 * Parse Excel date to ISO string (YYYY-MM-DD)
 * Handles: Excel serial number, JS Date object, DD/MM/YYYY string, YYYY-MM-DD string
 */
function parseExcelDate(value) {
    if (!value)
        return null;
    try {
        // Handle Excel serial date (number like 44927)
        if (typeof value === 'number') {
            const date = XLSX.SSF.parse_date_code(value);
            const year = date.y;
            const month = String(date.m).padStart(2, '0');
            const day = String(date.d).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        // Handle Date object
        if (value instanceof Date) {
            const year = value.getFullYear();
            const month = String(value.getMonth() + 1).padStart(2, '0');
            const day = String(value.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        // Handle string formats
        const dateString = value.toString().trim();
        // Try DD/MM/YYYY
        const ddmmyyyyMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyyMatch) {
            const [_, day, month, year] = ddmmyyyyMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // Try YYYY-MM-DD (already correct format)
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateString;
        }
        // Try DD-MM-YYYY (with dash)
        const ddmmyyyyDashMatch = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (ddmmyyyyDashMatch) {
            const [_, day, month, year] = ddmmyyyyDashMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        // Fallback: return original string
        return (value === null || value === void 0 ? void 0 : value.toString()) || null;
    }
    catch (error) {
        console.warn(`[Import] Date parsing error for value: ${value}`, error);
        return (value === null || value === void 0 ? void 0 : value.toString()) || null;
    }
}
//# sourceMappingURL=fromExcel.js.map