import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as XLSX from 'xlsx';
import { calculateParceriaStatus } from '../shared/status';
import { historyEntryId } from '../shared/history';

interface ImportParceriasRequest {
    organizationId: string;
    fileData: string; // Base64
}

interface ImportStats {
    created: number;
    updated: number;
    errors: number;
    errorDetails: Array<{
        row: number;
        pgea: string;
        error: string;
    }>;
}

// Mapeamento de colunas — case-insensitive, aceita acentos e variações.
function pickFirst(row: any, keys: string[]): string {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
            return String(row[key]).trim();
        }
    }
    return '';
}

const PARTNERSHIP_TYPE_MAP: Record<string, string> = {
    'convenio': 'convenio',
    'convênio': 'convenio',
    'termo de cooperacao': 'termo_cooperacao',
    'termo de cooperação': 'termo_cooperacao',
    'termo_cooperacao': 'termo_cooperacao',
    'termo de fomento': 'termo_fomento',
    'termo_de_fomento': 'termo_fomento',
};

function normalizePartnershipType(raw: string): string {
    if (!raw) return '';
    const norm = String(raw).toLowerCase().trim();
    return PARTNERSHIP_TYPE_MAP[norm] || '';
}

export const importParceriasFromExcel = onCall<ImportParceriasRequest>(
    {
        region: 'southamerica-east1',
        memory: '1GiB',
        timeoutSeconds: 540,
        invoker: 'public',
        cors: true,
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Usuário deve estar autenticado');
        }

        const { organizationId, fileData } = request.data || ({} as ImportParceriasRequest);
        if (!organizationId || !fileData) {
            throw new HttpsError('invalid-argument', 'organizationId e fileData são obrigatórios');
        }

        const db = admin.firestore();
        const userId = request.auth.uid;

        // 1. Verify membership
        const membershipRef = db.collection('userOrganizations').doc(`${userId}_${organizationId}`);
        const membershipSnap = await membershipRef.get();
        if (!membershipSnap.exists) {
            throw new HttpsError('permission-denied', 'Você não é membro desta organização');
        }

        try {
            console.log(`[ImportParcerias] Started by user ${userId} for org ${organizationId}`);

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
                    throw new HttpsError(
                        'invalid-argument',
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
                    message: 'Arquivo vazio - nenhuma Parceria encontrada',
                };
            }

            if (rows.length > 50000) {
                throw new HttpsError(
                    'invalid-argument',
                    `Arquivo muito grande (${rows.length} parcerias). Máximo: 50.000.`
                );
            }

            console.log(`[ImportParcerias] Processing ${rows.length} parcerias (${fileType})...`);

            const batchSize = 450;
            const lookupBatchSize = 50;
            let batch = db.batch();
            let batchCount = 0;

            const importNow = new Date();
            const importLogDate = importNow.toISOString().split('T')[0];
            const importLogTime = importNow.toTimeString().split(' ')[0];
            const importUserName = request.auth.token.name || 'Usuário desconhecido';

            const stats: ImportStats = { created: 0, updated: 0, errors: 0, errorDetails: [] };

            for (let i = 0; i < rows.length; i += lookupBatchSize) {
                const chunk = rows.slice(i, i + lookupBatchSize);

                const lookupPromises = chunk.map(async (row, index) => {
                    const rowIndex = i + index;
                    try {
                        const pgea = pickFirst(row, [
                            'PGEA', 'pgea', 'Pgea',
                        ]);
                        const subject = pickFirst(row, [
                            'ASSUNTO', 'Assunto', 'assunto', 'subject',
                        ]);
                        const object = pickFirst(row, [
                            'OBJETO', 'Objeto', 'objeto', 'object',
                        ]);
                        const parties = pickFirst(row, [
                            'PARTES', 'Partes', 'partes', 'parties',
                        ]);
                        const partnershipTypeRaw = pickFirst(row, [
                            'TIPO DE PARCERIA', 'Tipo de Parceria', 'tipo_parceria',
                            'partnership_type', 'TIPO PARCERIA',
                        ]);
                        const partnershipNumber = pickFirst(row, [
                            'NÚMERO DA PARCERIA', 'Número da Parceria', 'numero_parceria',
                            'partnership_number', 'NUMERO PARCERIA',
                        ]);
                        const signatureDate = parseExcelDate(
                            pickFirst(row, [
                                'DATA DA ASSINATURA', 'Data da Assinatura',
                                'data_assinatura', 'signature_date',
                            ])
                        );
                        const validityPeriod = pickFirst(row, [
                            'VIGÊNCIA', 'Vigência', 'vigencia', 'validity_period',
                        ]);
                        const endDate = parseExcelDate(
                            pickFirst(row, [
                                'TERMO FINAL', 'Termo Final', 'termo_final', 'end_date',
                            ])
                        );
                        const renewalNoticeDate = parseExcelDate(
                            pickFirst(row, [
                                'DATA DO AVISO DE RENOVAÇÃO', 'Data do Aviso de Renovação',
                                'data_aviso_renovacao', 'renewal_notice_date',
                                'AVISO RENOVAÇÃO', 'Aviso Renovação',
                            ])
                        );
                        const responsibleUserName = pickFirst(row, [
                            'ASSESSOR RESPONSÁVEL', 'Assessor Responsável',
                            'assessor_responsavel', 'responsible_user_name',
                            'RESPONSÁVEL', 'Responsável',
                        ]);
                        // pgea_date removido (item 1 do plano — não é mais usado).

                        // Anti-lixo: linha integralmente vazia é descartada.
                        const isGarbage =
                            !pgea &&
                            !subject &&
                            !object &&
                            !parties &&
                            !partnershipTypeRaw &&
                            !partnershipNumber &&
                            !signatureDate;
                        if (isGarbage) {
                            return { row, rowIndex, skip: true as const };
                        }

                        if (!pgea) {
                            return {
                                row, rowIndex, skip: false as const,
                                error: 'PGEA é obrigatório',
                            };
                        }

                        // Validar partnership_type (se preenchido).
                        const partnershipType = partnershipTypeRaw
                            ? normalizePartnershipType(partnershipTypeRaw)
                            : '';
                        if (partnershipTypeRaw && !partnershipType) {
                            return {
                                row, rowIndex, skip: false as const,
                                error: `Tipo de parceria inválido: "${partnershipTypeRaw}". Use Convênio, Termo de Cooperação ou Termo de Fomento.`,
                            };
                        }

                        // Lookup de duplicata: (organization_id, pgea, signature_date)
                        let existingQuery = await db.collection('parcerias')
                            .where('organization_id', '==', organizationId)
                            .where('pgea', '==', pgea)
                            .limit(5)
                            .get();
                        let existingDoc = null;
                        if (!existingQuery.empty) {
                            // Refinar para casar signature_date
                            for (const doc of existingQuery.docs) {
                                const data = doc.data();
                                if ((data.signature_date || null) === (signatureDate || null)) {
                                    existingDoc = doc;
                                    break;
                                }
                            }
                            if (!existingDoc) {
                                existingDoc = existingQuery.docs[0];
                            }
                        }

                        return {
                            row, rowIndex, skip: false as const,
                            pgea, subject, object, parties, partnershipType,
                            partnershipNumber, signatureDate, validityPeriod, endDate,
                            renewalNoticeDate, responsibleUserName,
                            existingDoc,
                        };
                    } catch (err: any) {
                        return {
                            row, rowIndex, skip: false as const,
                            error: err.message || 'Erro no lookup',
                        };
                    }
                });

                const results = await Promise.all(lookupPromises);

                for (const res of results) {
                    if (res.skip === true) continue;
                    if ('error' in res && res.error) {
                        stats.errors++;
                        stats.errorDetails.push({
                            row: res.rowIndex + 1,
                            pgea: 'pgea' in res ? (res.pgea || '?') : '?',
                            error: res.error,
                        });
                        continue;
                    }
                    if (!('pgea' in res)) continue;

                    try {
                        const r = res as any;
                        const isUpdate = !!r.existingDoc;
                        const parceriaRef = isUpdate
                            ? r.existingDoc.ref
                            : db.collection('parcerias').doc();

                        const parceriaData: Record<string, any> = {
                            organization_id: organizationId,
                            pgea: r.pgea,
                            subject: r.subject || '',
                            object: r.object || '',
                            parties: r.parties || '',
                            partnership_type: r.partnershipType || null,
                            partnership_number: r.partnershipNumber || null,
                            signature_date: r.signatureDate || null,
                            validity_period: r.validityPeriod || null,
                            end_date: r.endDate || null,
                            renewal_notice_date: r.renewalNoticeDate || null,
                            responsible_user_name: r.responsibleUserName || null,
                            responsible_user_id: null,
                            responsibility_date: null,
                            network_folder: '',
                            observations: '',
                            review_conclusion_date: null,
                            third_party: null,
                            extinguished: false,
                            extinguished_at: null,
                            extinguished_by: null,
                            aditivo_count: 0,
                            current_additive_id: '',
                            updated_at: admin.firestore.FieldValue.serverTimestamp(),
                            last_imported_at: admin.firestore.FieldValue.serverTimestamp(),
                        };

                        // Calcular status derivado (não usar "Pendente" automático —
                        // queremos inferir a fase atual baseado nos campos importados).
                        parceriaData.status = calculateParceriaStatus(parceriaData);

                        const fieldLabels: Record<string, string> = {
                            pgea: 'PGEA',
                            subject: 'Assunto',
                            object: 'Objeto',
                            parties: 'Partes',
                            partnership_type: 'Tipo de Parceria',
                            partnership_number: 'Número da Parceria',
                            signature_date: 'Data da Assinatura',
                            validity_period: 'Vigência',
                            end_date: 'Termo Final',
                            renewal_notice_date: 'Data do Aviso de Renovação',
                            responsible_user_name: 'Assessor Responsável',
                            status: 'Status',
                        };

                        let importAction = '';
                        if (isUpdate) {
                            const oldData = r.existingDoc.data() || {};
                            const changedLabels: string[] = [];
                            for (const [key, label] of Object.entries(fieldLabels)) {
                                const oldVal = (oldData[key] ?? '').toString().trim();
                                const newVal = (parceriaData[key] ?? '').toString().trim();
                                if (oldVal !== newVal && parceriaData[key] !== undefined) {
                                    changedLabels.push(label);
                                }
                            }
                            importAction = changedLabels.length > 0
                                ? `Dados atualizados via planilha: ${changedLabels.join(', ')}`
                                : 'Reimportação via planilha (sem alterações nos dados)';
                        } else {
                            importAction = 'Parceria criada via importação de planilha';
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
                            Object.keys(parceriaData).forEach((key) => {
                                if (parceriaData[key] === undefined) delete parceriaData[key];
                            });
                            parceriaData.activity_log = admin.firestore.FieldValue.arrayUnion(importLogEntry);
                            batch.update(parceriaRef, parceriaData);
                            stats.updated++;
                        } else {
                            parceriaData.id = parceriaRef.id;
                            parceriaData.created_by = userId;
                            parceriaData.created_at = admin.firestore.FieldValue.serverTimestamp();
                            parceriaData.activity_log = [importLogEntry];
                            batch.set(parceriaRef, parceriaData);
                            stats.created++;
                        }

                        // Dual-write do log no histórico.
                        batch.set(
                            parceriaRef.collection('history').doc(historyEntryId(importLogEntry)),
                            {
                                ...importLogEntry,
                                created_at: admin.firestore.FieldValue.serverTimestamp(),
                            }
                        );

                        batchCount += 2;

                        if (batchCount >= batchSize) {
                            await batch.commit();
                            batch = db.batch();
                            batchCount = 0;
                        }
                    } catch (error: any) {
                        stats.errors++;
                        stats.errorDetails.push({
                            row: res.rowIndex + 1,
                            pgea: (res as any).pgea || '?',
                            error: error.message || 'Erro ao processar linha',
                        });
                    }
                }
            }

            if (batchCount > 0) {
                await batch.commit();
            }

            // Update stats
            if (stats.created > 0) {
                await db.collection('organizations').doc(organizationId).update({
                    'stats.parcerias_count': admin.firestore.FieldValue.increment(stats.created),
                    'stats.active_parcerias': admin.firestore.FieldValue.increment(stats.created),
                    'stats.last_parceria_import_at': admin.firestore.FieldValue.serverTimestamp(),
                });
            }

            let message = '';
            if (stats.created > 0) message += `${stats.created} criadas`;
            if (stats.updated > 0) {
                if (message) message += ', ';
                message += `${stats.updated} atualizadas`;
            }
            if (stats.errors > 0) {
                if (message) message += ', ';
                message += `${stats.errors} erros`;
            }

            console.log(`[ImportParcerias] Complete:`, {
                total: rows.length,
                created: stats.created,
                updated: stats.updated,
                errors: stats.errors,
            });

            return {
                success: stats.errors < rows.length,
                created: stats.created,
                updated: stats.updated,
                errors: stats.errors,
                errorDetails: stats.errorDetails.slice(0, 20),
                total: rows.length,
                message: message || 'Nenhuma Parceria importada',
            };
        } catch (error: any) {
            console.error('[ImportParcerias] Fatal error:', error);
            if (
                error?.code === 'functions/unauthenticated' ||
                error?.code === 'functions/permission-denied' ||
                error?.code === 'functions/invalid-argument'
            ) {
                throw error;
            }
            throw new HttpsError('internal', `Erro ao importar arquivo: ${error.message || 'Erro desconhecido'}`);
        }
    }
);

// ============================================================================
// parseExcelDate — Helper para converter datas vindas do Excel/CSV/JSON.
// Mesma estratégia usada em fromExcelExpedientes.ts.
// ============================================================================
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
            const [, day, month, year] = ddmmyyyyMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return dateString;
        }

        const ddmmyyyyDashMatch = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (ddmmyyyyDashMatch) {
            const [, day, month, year] = ddmmyyyyDashMatch;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        return value?.toString() || null;
    } catch (error) {
        console.warn(`[ImportParcerias] Date parsing error for value: ${value}`, error);
        return value?.toString() || null;
    }
}
