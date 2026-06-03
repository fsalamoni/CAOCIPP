import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as XLSX from 'xlsx';
import { calculateStatus } from '../shared/status';
import { formatPersonName } from '../shared/normalization';

interface ImportExpedientesRequest {
    organizationId: string;
    fileData: string; // Base64
}

interface ImportStats {
    created: number;
    updated: number;
    errors: number;
    errorDetails: Array<{
        row: number;
        expedienteNumber: string;
        error: string;
    }>;
}

export const importExpedientesFromExcel = onCall<ImportExpedientesRequest>(
    {
        region: 'southamerica-east1',
        memory: '1GiB',
        timeoutSeconds: 540,
        invoker: 'public',
        cors: true
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
            console.log(`[ImportExpedientes] Started by user ${userId} for org ${organizationId}`);

            // 2. Parse file
            const buffer = Buffer.from(fileData, 'base64');
            let rows: any[] = [];
            let fileType = 'unknown';

            try {
                const jsonString = buffer.toString('utf-8');
                const parsed = JSON.parse(jsonString);
                rows = Array.isArray(parsed) ? parsed : [parsed];
                fileType = 'json';
            } catch (jsonError) {
                try {
                    const workbook = XLSX.read(buffer, { type: 'buffer' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    rows = XLSX.utils.sheet_to_json(sheet);
                    fileType = 'excel/csv';
                } catch (excelError) {
                    throw new HttpsError('invalid-argument',
                        'Formato de arquivo inválido. Use JSON válido, Excel (.xlsx, .xls) ou CSV'
                    );
                }
            }

            if (rows.length === 0) {
                return {
                    success: false, created: 0, updated: 0, errors: 0, total: 0,
                    message: 'Arquivo vazio - nenhum expediente encontrado'
                };
            }

            if (rows.length > 50000) {
                throw new HttpsError('invalid-argument',
                    `Arquivo muito grande (${rows.length} expedientes). Máximo: 50.000.`
                );
            }

            console.log(`[ImportExpedientes] Processing ${rows.length} expedientes (${fileType})...`);

            // 3. Process rows with UPSERT logic
            const batchSize = 450;
            const lookupBatchSize = 50;
            let batch = db.batch();
            let batchCount = 0;

            const importNow = new Date();
            const importLogDate = importNow.toISOString().split('T')[0];
            const importLogTime = importNow.toTimeString().split(' ')[0];
            const importUserName = request.auth.token.name || 'Usuário desconhecido';

            const stats: ImportStats = {
                created: 0, updated: 0, errors: 0, errorDetails: []
            };

            for (let i = 0; i < rows.length; i += lookupBatchSize) {
                const chunk = rows.slice(i, i + lookupBatchSize);

                const lookupPromises = chunk.map(async (row, index) => {
                    const rowIndex = i + index;
                    try {
                        // Normalize expediente number
                        const rawNumber = row['EXPEDIENTE'] || row['Expediente'] ||
                            row['expediente'] || row['Número'] || row['Numero'] ||
                            row['NÚMERO'] || row['número'] || row['numero'] || 
                            row['expediente_number'] || '';

                        let expedienteNumber = rawNumber.toString().trim();
                        if (!expedienteNumber || expedienteNumber === '') {
                            expedienteNumber = `AUTO-${Date.now()}-${rowIndex}`;
                        }

                        const systemVal = (row['SISTEMA'] || row['Sistema'] || row['sistema'] || row['system'] || '').toString().trim();
                        const originVal = (row['ORIGEM'] || row['Origem'] || row['origem'] || row['origin'] || '').toString().trim();
                        const objectVal = (row['OBJETO'] || row['Objeto'] || row['objeto'] || row['Assunto'] || row['ASSUNTO'] || row['object'] || '').toString().trim();
                        
                        // Extract entry date
                        const entryDate = parseExcelDate(
                            row['ENTRADA'] || row['Entrada'] || row['entrada'] ||
                            row['DATA DE ENTRADA'] || row['Data de Entrada'] ||
                            row['Data Entrada'] || row['DATA ENTRADA'] ||
                            row['entry_date']
                        ) || null;

                        // Check for fully blank/unrelated rows (prevents garbage import)
                        const isGarbageRow = expedienteNumber.startsWith('AUTO-') && 
                            !systemVal && !originVal && !objectVal && !entryDate;
                            
                        if (isGarbageRow) {
                            return { row, rowIndex, skip: true };
                        }

                        // Query existing
                        const existingQuery = await db.collection('expedientes')
                            .where('organization_id', '==', organizationId)
                            .where('expediente_number', '==', expedienteNumber)
                            .where('entry_date', '==', entryDate)
                            .limit(1)
                            .get();

                        return {
                            row, rowIndex, expedienteNumber, entryDate, systemVal, originVal, objectVal,
                            existingDoc: existingQuery.empty ? null : existingQuery.docs[0],
                            error: null, skip: false
                        };
                    } catch (err: any) {
                        return { row, rowIndex, error: err.message || 'Erro no lookup', skip: false };
                    }
                });

                const results = await Promise.all(lookupPromises);

                for (const res of results) {
                    if (res.skip) continue;
                    if (res.error) {
                        stats.errors++;
                        stats.errorDetails.push({
                            row: res.rowIndex + 1,
                            expedienteNumber: '?',
                            error: res.error
                        });
                        continue;
                    }

                    try {
                        const { row, expedienteNumber, entryDate, existingDoc, systemVal, originVal, objectVal } = res;
                        const isUpdate = !!existingDoc;
                        const expedienteRef = isUpdate ? existingDoc!.ref : db.collection('expedientes').doc();

                        const expedienteData: any = {
                            organization_id: organizationId,
                            expediente_number: expedienteNumber,
                            system: systemVal,
                            origin: originVal,
                            object: objectVal,
                            entry_date: entryDate,
                            responsible_user_name: (
                                row['ASSESSOR RESPONSÁVEL'] || row['Assessor Responsável'] ||
                                row['Responsável'] || row['RESPONSÁVEL'] || row['responsible_user_name'] || ''
                            ).toString().trim() ? formatPersonName(
                                (
                                    row['ASSESSOR RESPONSÁVEL'] || row['Assessor Responsável'] ||
                                    row['Responsável'] || row['RESPONSÁVEL'] || row['responsible_user_name'] || ''
                                ).toString().trim()
                            ) : null,
                            responsible_user_id: row['responsible_user_id'] || null,
                            urgency_request: (
                                row['PEDIDO DE URGÊNCIA'] === 'Sim' ||
                                row['Pedido de Urgência'] === 'Sim' ||
                                row['Urgente'] === 'Sim' ||
                                row['urgency_request'] === true ||
                                row['urgency_request'] === 'true'
                            ),
                            observations: (
                                row['OBSERVAÇÕES'] || row['Observações'] || row['Obs'] || row['observations'] || ''
                            ).toString().trim(),
                            distribution_date: parseExcelDate(
                                row['DISTRIBUIÇÃO'] || row['Distribuição'] || row['distribuição'] || row['distribution_date']
                            ) || null,
                            analysis_start_date: parseExcelDate(
                                row['INÍCIO DA ANÁLISE'] || row['Início da Análise'] ||
                                row['INÍCIO ANÁLISE'] || row['analysis_start_date']
                            ) || null,
                            review_submission_date: parseExcelDate(
                                row['REMESSA P/ REVISÃO'] || row['Remessa p/ Revisão'] ||
                                row['REMESSA PARA REVISÃO'] || row['Remessa'] || row['review_submission_date']
                            ) || null,
                            review_return_date: parseExcelDate(
                                row['DEVOLUÇÃO APÓS REVISÃO'] || row['Devolução após Revisão'] ||
                                row['DEVOLUÇÃO'] || row['Devolução'] || row['review_return_date']
                            ) || null,
                            archived_date: parseExcelDate(
                                row['ARQUIVAMENTO'] || row['Arquivamento'] || row['arquivamento'] || row['archived_date']
                            ) || null,
                            network_folder: (row['PASTA NA REDE'] || row['Pasta na Rede'] || row['network_folder'] || '').toString().trim(),
                            updated_at: admin.firestore.FieldValue.serverTimestamp(),
                            last_imported_at: admin.firestore.FieldValue.serverTimestamp()
                        };

                        expedienteData.status = calculateStatus(expedienteData);

                        // Build log entry
                        const fieldLabels: Record<string, string> = {
                            expediente_number: 'Número do Expediente',
                            system: 'Sistema',
                            origin: 'Origem',
                            entry_date: 'Data de Entrada',
                            object: 'Objeto',
                            urgency_request: 'Pedido de Urgência',
                            distribution_date: 'Data de Distribuição',
                            responsible_user_name: 'Assessor Responsável',
                            analysis_start_date: 'Início da Análise',
                            observations: 'Observações',
                            review_submission_date: 'Remessa para Revisão',
                            review_return_date: 'Devolução após Revisão',
                            archived_date: 'Data de Arquivamento',
                            network_folder: 'Pasta na Rede',
                            status: 'Status',
                        };

                        let importAction = '';
                        if (isUpdate) {
                            const oldData = existingDoc!.data() || {};
                            const changedLabels: string[] = [];
                            for (const [key, label] of Object.entries(fieldLabels)) {
                                const oldVal = (oldData[key] ?? '').toString().trim();
                                const newVal = (expedienteData[key] ?? '').toString().trim();
                                if (oldVal !== newVal && expedienteData[key] !== undefined) {
                                    changedLabels.push(label);
                                }
                            }
                            importAction = changedLabels.length > 0
                                ? `Dados atualizados via planilha: ${changedLabels.join(', ')}`
                                : 'Reimportação via planilha (sem alterações nos dados)';
                        } else {
                            importAction = 'Expediente criado via importação de planilha';
                        }

                        const importLogEntry = {
                            date: importLogDate,
                            time: importLogTime,
                            user_id: userId,
                            user_name: importUserName,
                            action: importAction,
                            timestamp: importNow.toISOString(),
                        };

                        if (isUpdate) {
                            Object.keys(expedienteData).forEach(key => {
                                if (expedienteData[key] === undefined) delete expedienteData[key];
                            });
                            expedienteData.activity_log = admin.firestore.FieldValue.arrayUnion(importLogEntry);
                            batch.update(expedienteRef, expedienteData);
                            stats.updated++;
                        } else {
                            expedienteData.id = expedienteRef.id;
                            expedienteData.created_by = userId;
                            expedienteData.created_at = admin.firestore.FieldValue.serverTimestamp();
                            expedienteData.activity_log = [importLogEntry];
                            batch.set(expedienteRef, expedienteData);
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
                            expedienteNumber: res.expedienteNumber || '?',
                            error: error.message || 'Erro ao processar linha'
                        });
                    }
                }
            }

            // Commit remaining batch
            if (batchCount > 0) {
                await batch.commit();
            }

            // 4. Update organization stats
            if (stats.created > 0) {
                await db.collection('organizations').doc(organizationId).update({
                    'stats.expedientes_count': admin.firestore.FieldValue.increment(stats.created),
                    'stats.active_expedientes': admin.firestore.FieldValue.increment(stats.created),
                    'stats.last_expediente_import_at': admin.firestore.FieldValue.serverTimestamp()
                });
            }

            // 5. Build response
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

            console.log(`[ImportExpedientes] ✅ Complete:`, {
                total: rows.length, created: stats.created,
                updated: stats.updated, errors: stats.errors
            });

            return {
                success: stats.errors < rows.length,
                created: stats.created,
                updated: stats.updated,
                errors: stats.errors,
                errorDetails: stats.errorDetails.slice(0, 20),
                total: rows.length,
                message: message || 'Nenhum expediente importado'
            };

        } catch (error: any) {
            console.error('[ImportExpedientes] ❌ Fatal error:', error);
            if (error?.code === 'functions/unauthenticated' || error?.code === 'functions/permission-denied' || error?.code === 'functions/invalid-argument') {
                throw error;
            }
            throw new HttpsError('internal',
                `Erro ao importar arquivo: ${error.message || 'Erro desconhecido'}`
            );
        }
    }
);

/**
 * Parse Excel date to ISO string (YYYY-MM-DD)
 */
function parseExcelDate(value: any): string | null {
    if (!value) return null;

    try {
        if (typeof value === 'number') {
            const date = XLSX.SSF.parse_date_code(value);
            const year = date.y;
            const month = String(date.m).padStart(2, '0');
            const day = String(date.d).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        if (value instanceof Date) {
            const year = value.getFullYear();
            const month = String(value.getMonth() + 1).padStart(2, '0');
            const day = String(value.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        const dateString = value.toString().trim();

        const ddmmyyyyMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyyMatch) {
            const [_, day, month, year] = ddmmyyyyMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateString;
        }

        const ddmmyyyyDashMatch = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (ddmmyyyyDashMatch) {
            const [_, day, month, year] = ddmmyyyyDashMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        return value?.toString() || null;
    } catch (error) {
        console.warn(`[ImportExpedientes] Date parsing error for value: ${value}`, error);
        return value?.toString() || null;
    }
}
