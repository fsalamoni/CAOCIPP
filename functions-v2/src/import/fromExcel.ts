import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as XLSX from 'xlsx';
import { calculateStatus } from '../shared/status';

interface ImportExcelRequest {
    organizationId: string;
    fileData: string; // Base64
}

interface ImportStats {
    created: number;
    updated: number;
    errors: number;
    errorDetails: Array<{
        row: number;
        processNumber: string;
        error: string;
    }>;
}

export const importProcessesFromExcel = onCall<ImportExcelRequest>(
    {
        region: 'southamerica-east1',
        memory: '1GiB',
        timeoutSeconds: 540, // 9 minutes for large imports
        invoker: 'public', // Allow public invocation (Cloud Run level)
        cors: true // Enable CORS (should be automatic but being explicit)
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
        }

        const { organizationId, fileData } = request.data;
        if (!organizationId || !fileData) {
            throw new HttpsError('invalid-argument', 'Campos obrigatórios faltando (organizationId ou fileData)');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // 1. Verify permissions
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Você não é membro desta organização');
        }

        try {
            console.log(`[Import] Started by user ${userId} for org ${organizationId}`);
            console.log(`[Import] File size: ${fileData.length} bytes (base64)`);

            // 2. Parse file (JSON, Excel, or CSV)
            const buffer = Buffer.from(fileData, 'base64');
            let rows: any[] = [];
            let fileType = 'unknown';

            // Try JSON first
            try {
                const jsonString = buffer.toString('utf-8');
                const parsed = JSON.parse(jsonString);
                rows = Array.isArray(parsed) ? parsed : [parsed];
                fileType = 'json';
                console.log(`[Import] ✅ Parsed as JSON: ${rows.length} entries`);
            } catch (jsonError) {
                // Not JSON - try Excel/CSV
                try {
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    rows = XLSX.utils.sheet_to_json(sheet);
                    fileType = 'excel/csv';
                    console.log(`[Import] ✅ Parsed as Excel/CSV: ${rows.length} rows`);
                } catch (excelError) {
                    console.error('[Import] ❌ Failed to parse file:', {
                        jsonError: (jsonError as Error).message,
                        excelError: (excelError as Error).message
                    });
                    throw new HttpsError('invalid-argument',
                        'Formato de arquivo inválido. Use JSON válido, Excel (.xlsx, .xls) ou CSV'
                    );
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
                throw new HttpsError('invalid-argument',
                    `Arquivo muito grande (${rows.length} processos). Máximo: 50.000. ` +
                    'Para importações maiores, divida em múltiplos arquivos.'
                );
            }

            console.log(`[Import] Processing ${rows.length} processes (file type: ${fileType})...`);

            // 3. Process Rows with UPSERT logic
            const batchSize = 450;
            const lookupBatchSize = 50; // Process 50 lookups in parallel
            let batch = db.batch();
            let batchCount = 0;

            const stats: ImportStats = {
                created: 0,
                updated: 0,
                errors: 0,
                errorDetails: []
            };

            // Process in chunks to balance parallelism and Firestore limits
            for (let i = 0; i < rows.length; i += lookupBatchSize) {
                const chunk = rows.slice(i, i + lookupBatchSize);

                // Parallel lookups for the current chunk
                const lookupPromises = chunk.map(async (row, index) => {
                    const rowIndex = i + index;
                    try {
                        // Normalize process number
                        const rawNumber = row['PROCESSO SIM\n(NÚMERO)'] ||
                            row['PROCESSO SIM\\n(NÚMERO)'] ||
                            row['Número'] || row['Numero'] || row['NÚMERO'] ||
                            row['número'] || row['numero'] || row['Process Number'] || '';

                        let processNumber = rawNumber.toString().trim();
                        if (!processNumber || processNumber === 'SEM NÚMERO' || processNumber === '') {
                            processNumber = `AUTO-${Date.now()}-${rowIndex}`;
                        }

                        // Extract entry date
                        const entryDate = parseExcelDate(
                            row['ENTRADA NO CAOPP\n(DATA)'] ||
                            row['ENTRADA NO CAOPP\\n(DATA)'] ||
                            row['Data Entrada'] || row['DATA ENTRADA']
                        ) || null;

                        // Query existing
                        const existingQuery = await db.collection('processes')
                            .where('organization_id', '==', organizationId)
                            .where('process_number', '==', processNumber)
                            .where('entry_date', '==', entryDate)
                            .limit(1)
                            .get();

                        return {
                            row,
                            rowIndex,
                            processNumber,
                            entryDate,
                            existingDoc: existingQuery.empty ? null : existingQuery.docs[0],
                            error: null
                        };
                    } catch (err: any) {
                        return { row, rowIndex, error: err.message || 'Erro no lookup' };
                    }
                });

                const results = await Promise.all(lookupPromises);

                // Process results and add to batch
                for (const res of results) {
                    if (res.error) {
                        stats.errors++;
                        stats.errorDetails.push({
                            row: res.rowIndex + 1,
                            processNumber: '?',
                            error: res.error
                        });
                        continue;
                    }

                    try {
                        const { row, processNumber, entryDate, existingDoc } = res;
                        const isUpdate = !!existingDoc;
                        const processRef = isUpdate ? existingDoc!.ref : db.collection('processes').doc();

                        const processData: any = {
                            organization_id: organizationId,
                            process_number: processNumber,
                            consultant: (row['CONSULENTE'] || row['Consulente'] || row['consulente'] || '').toString().trim(),
                            location: (
                                row['LOCAL DOS FATOS\n(CIDADE)'] ||
                                row['LOCAL DOS FATOS\\n(CIDADE)'] ||
                                row['Local'] || row['LOCAL'] || row['Município'] || ''
                            ).toString().trim(),
                            matter_object: (
                                row['MATÉRIA E OBJETO DA CONSULTA'] ||
                                row['Objeto'] || row['OBJETO'] || row['Assunto'] || ''
                            ).toString().trim(),
                            entry_date: entryDate,
                            responsible_user_name: (
                                row['ASSESSOR RESPONSÁVEL'] || row['Responsável'] || row['RESPONSÁVEL'] || ''
                            ).toString().trim() || null,
                            responsible_user_id: null,
                            urgency_request: (
                                row['PEDIDO DE URGÊNCIA'] === 'Sim' ||
                                row['Solicitação de Urgência'] === 'Sim' ||
                                row['Urgente'] === 'Sim'
                            ),
                            observations: (
                                row['OBSERVAÇÕES E PONTOS IMPORTANTES DA RESPOSTA'] ||
                                row['Observações'] || row['Obs'] || ''
                            ).toString().trim(),
                            distribution_date: parseExcelDate(row['DISTRIBUIÇÃO\n(DATA)'] || row['DISTRIBUIÇÃO\\n(DATA)']) || null,
                            analysis_start_date: parseExcelDate(row['INÍCIO DA ANÁLISE\n(DATA)'] || row['INÍCIO DA ANÁLISE\\n(DATA)']) || null,
                            review_submission_date: parseExcelDate(row['REMESSA AO DR. PARA REVISÃO (DATA)']) || null,
                            review_return_date: parseExcelDate(row['DEVOLUÇÃO APÓS REVISÃO\n(DATA)'] || row['DEVOLUÇÃO APÓS REV ISÃO\\n(DATA)']) || null,
                            archived_date: parseExcelDate(row['NA PASTA\nARQUIVADO\n(DATA)'] || row['NA PASTA\\nARQUIVADO\\n(DATA)']) || null,
                            access_restriction: (row['RESTRIÇÃO DE ACESSO'] || '').toString().trim(),
                            network_folder: (row['PASTA NA REDE'] || '').toString().trim(),
                            updated_at: admin.firestore.FieldValue.serverTimestamp(),
                            last_imported_at: admin.firestore.FieldValue.serverTimestamp()
                        };

                        processData.status = calculateStatus(processData);

                        if (isUpdate) {
                            Object.keys(processData).forEach(key => {
                                if (processData[key] === undefined) delete processData[key];
                            });
                            batch.update(processRef, processData);
                            stats.updated++;
                        } else {
                            processData.id = processRef.id;
                            processData.created_by = userId;
                            processData.created_at = admin.firestore.FieldValue.serverTimestamp();
                            batch.set(processRef, processData);
                            stats.created++;
                        }

                        batchCount++;

                        if (batchCount >= batchSize) {
                            await batch.commit();
                            batch = db.batch();
                            batchCount = 0;
                        }
                    } catch (error: any) {
                        stats.errors++;
                        stats.errorDetails.push({
                            row: res.rowIndex + 1,
                            processNumber: res.processNumber || '?',
                            error: error.message || 'Erro ao processar linha'
                        });
                    }
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
            if (stats.created > 0) message += `${stats.created} criados`;
            if (stats.updated > 0) {
                if (message) message += ', ';
                message += `${stats.updated} atualizados`;
            }
            if (stats.errors > 0) {
                if (message) message += ', ';
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

        } catch (error: any) {
            console.error('[Import] ❌ Fatal error:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });

            // If already HttpsError, re-throw
            if (error instanceof HttpsError) {
                throw error;
            }

            // Generic internal error
            throw new HttpsError('internal',
                `Erro ao importar arquivo: ${error.message || 'Erro desconhecido'}`
            );
        }
    }
);

/**
 * Parse Excel date to ISO string (YYYY-MM-DD)
 * Handles: Excel serial number, JS Date object, DD/MM/YYYY string, YYYY-MM-DD string
 */
function parseExcelDate(value: any): string | null {
    if (!value) return null;

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
        return value?.toString() || null;

    } catch (error) {
        console.warn(`[Import] Date parsing error for value: ${value}`, error);
        return value?.toString() || null;
    }
}
