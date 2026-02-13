import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

interface UserEntity {
    id: string;
    email: string;
    full_name: string;
}

interface ExcelRow {
    [key: string]: any;
}

interface ProcessEntity {
    id: string;
    [key: string]: any;
}

interface ImportSummary {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
}

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
    let consultasCao;
    let user: UserEntity | null;

    try {
        // 1. Inicializar cliente e autenticar
        consultasCao = createClientFromRequest(req);
        user = await consultasCao.auth.me() as UserEntity | null;

        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // 2. Parse do body
        const body = await req.json();
        const { file_url, organization_id } = body;

        if (!file_url || !organization_id) {
            return Response.json({
                error: 'Parâmetros faltando',
                received: { file_url: !!file_url, organization_id: !!organization_id }
            }, { status: 400 });
        }

        console.log('Iniciando importação (Consultas CAO):', { file_url, organization_id, user: user.email });

        // 3. Baixar arquivo COM VALIDAÇÃO DE TAMANHO
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            throw new Error('Falha ao baixar arquivo');
        }

        const contentLength = fileResponse.headers.get('content-length');
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

        if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
            return Response.json({
                error: 'Arquivo muito grande',
                details: `Tamanho máximo permitido: 10MB. Arquivo enviado: ${(parseInt(contentLength) / 1024 / 1024).toFixed(2)}MB`,
                suggestion: 'Para arquivos maiores, divida em múltiplos arquivos menores.'
            }, { status: 413 });
        }

        // Detectar tipo e processar
        let excelData: ExcelRow[];
        const contentType = fileResponse.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json') || file_url.endsWith('.json');

        if (isJson) {
            const jsonText = await fileResponse.text();

            if (jsonText.length > MAX_FILE_SIZE) {
                return Response.json({
                    error: 'Arquivo JSON muito grande',
                    details: `Tamanho máximo: 10MB.`
                }, { status: 413 });
            }

            excelData = JSON.parse(jsonText);
            if (!Array.isArray(excelData)) {
                throw new Error('JSON deve ser um array de objetos');
            }
        } else {
            const arrayBuffer = await fileResponse.arrayBuffer();

            if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
                return Response.json({
                    error: 'Arquivo Excel muito grande',
                    details: `Tamanho máximo: 10MB.`
                }, { status: 413 });
            }

            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const firstSheet = workbook.Sheets[firstSheetName];
            excelData = XLSX.utils.sheet_to_json(firstSheet);
        }

        const MAX_ROWS = 5000;
        if (excelData.length > MAX_ROWS) {
            return Response.json({
                error: 'Arquivo excede limite de registros',
                details: `Máximo: ${MAX_ROWS} registros. Arquivo possui: ${excelData.length} registros.`,
                suggestion: 'Use a função de importação em lote (batch import) para arquivos maiores.'
            }, { status: 413 });
        }

        console.log('Arquivo processado e validado:', {
            type: isJson ? 'JSON' : 'Excel',
            rows: excelData.length,
            firstRow: excelData[0],
            sizeOk: true
        });

        let created = 0, updated = 0, skipped = 0;
        const errors: string[] = [];

        // 4. Processar cada linha
        for (let i = 0; i < excelData.length; i++) {
            const row = excelData[i];

            try {
                const processNumber = String(row['Nº Processo'] || row['processo'] || row['Processo'] || '').trim();
                const consultant = String(row['Consulente'] || row['consulente'] || '').trim();
                const location = String(row['Local'] || row['Cidade'] || row['cidade'] || '').trim();
                const matterObject = String(row['Matéria/Objeto'] || row['Matéria'] || row['Objeto'] || '').trim();
                const entryDateRaw = row['Data Entrada'] || row['Data de Entrada'] || row['Entrada'];

                if (!processNumber || !consultant || !location || !matterObject || !entryDateRaw) {
                    errors.push(`Linha ${i + 2}: Faltando campos obrigatórios`);
                    skipped++;
                    continue;
                }

                // Converter data
                let entryDate: string;
                if (typeof entryDateRaw === 'number') {
                    const EXCEL_EPOCH_OFFSET = 25569;
                    const MS_PER_DAY = 86400 * 1000;
                    const date = new Date((entryDateRaw - EXCEL_EPOCH_OFFSET) * MS_PER_DAY);
                    entryDate = date.toISOString().split('T')[0];
                } else if (entryDateRaw instanceof Date) {
                    entryDate = entryDateRaw.toISOString().split('T')[0];
                } else {
                    const dateStr = String(entryDateRaw);
                    if (dateStr.includes('/')) {
                        const [day, month, year] = dateStr.split('/');
                        entryDate = `${year.length === 2 ? '20' + year : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    } else {
                        entryDate = dateStr;
                    }
                }

                // Verificar existência
                const existing = await consultasCao.entities.Process.filter({
                    organization_id: organization_id,
                    process_number: processNumber
                }) as ProcessEntity[];

                const processData: any = {
                    organization_id,
                    process_number: processNumber,
                    consultant,
                    location,
                    entry_date: entryDate,
                    matter_object: matterObject,
                    urgency_request: row['Urgência'] === 'Sim' || row['Urgente'] === 'Sim' || false
                };

                const optionalFields: { [key: string]: any } = {
                    distribution_date: row['Data Distribuição'] || row['Distribuição'],
                    responsible_user_name: row['Responsável'],
                    analysis_start_date: row['Início Análise'] || row['Análise'],
                    observations: row['Observações'],
                    review_submission_date: row['Data Revisão'],
                    review_return_date: row['Retorno Revisão'],
                    archived_date: row['Data Arquivamento'] || row['Arquivamento'],
                    network_folder: row['Pasta']
                };

                for (const [key, value] of Object.entries(optionalFields)) {
                    if (value && value !== '') {
                        processData[key] = value;
                    }
                }

                if (existing && existing.length > 0) {
                    const existingProcess = existing[0];
                    const updates: any = {};
                    let hasUpdates = false;

                    for (const [key, value] of Object.entries(processData)) {
                        if (key !== 'organization_id' && key !== 'process_number') {
                            const existingValue = existingProcess[key];
                            if ((!existingValue || existingValue === '') && value && value !== '') {
                                updates[key] = value;
                                hasUpdates = true;
                            }
                        }
                    }

                    if (hasUpdates) {
                        await consultasCao.entities.Process.update(existingProcess.id, updates);
                        updated++;
                    } else {
                        skipped++;
                    }
                } else {
                    await consultasCao.entities.Process.create(processData);
                    created++;
                }

            } catch (rowError) {
                const errorMessage = rowError instanceof Error ? rowError.message : String(rowError);
                console.error(`Erro linha ${i + 2}:`, errorMessage);
                errors.push(`Linha ${i + 2}: ${errorMessage}`);
                skipped++;
            }
        }

        const summary: ImportSummary = { total: excelData.length, created, updated, skipped, errors };
        return Response.json({ success: true, summary });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('ERRO CRÍTICO (Consultas CAO):', errorMessage);
        return Response.json({
            error: errorMessage,
            stack: errorStack,
            details: 'Erro ao processar importação'
        }, { status: 500 });
    }
});