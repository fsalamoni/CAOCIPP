import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
    let base44, user, body;

    try {
        // 1. Inicializar cliente e autenticar
        base44 = createClientFromRequest(req);
        user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        // 2. Parse do body
        body = await req.json();
        const { file_url, organization_id } = body;

        if (!file_url || !organization_id) {
            return Response.json({ 
                error: 'Parâmetros faltando',
                received: { file_url: !!file_url, organization_id: !!organization_id }
            }, { status: 400 });
        }

        console.log('Iniciando importação:', { file_url, organization_id, user: user.email });

        // 3. Baixar arquivo
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            throw new Error('Falha ao baixar arquivo');
        }

        // Detectar tipo e processar
        let excelData;
        const contentType = fileResponse.headers.get('content-type') || '';
        const isJson = contentType.includes('application/json') || file_url.endsWith('.json');

        if (isJson) {
            // Processar JSON
            const jsonText = await fileResponse.text();
            excelData = JSON.parse(jsonText);
            if (!Array.isArray(excelData)) {
                throw new Error('JSON deve ser um array de objetos');
            }
        } else {
            // Processar Excel
            const arrayBuffer = await fileResponse.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            excelData = XLSX.utils.sheet_to_json(firstSheet);
        }

        console.log('Arquivo processado:', { type: isJson ? 'JSON' : 'Excel', rows: excelData.length, firstRow: excelData[0] });

        let created = 0, updated = 0, skipped = 0;
        const errors = [];

        // 4. Processar cada linha
        for (let i = 0; i < excelData.length; i++) {
            const row = excelData[i];
            
            try {
                // Extrair e limpar dados
                const processNumber = String(row['Nº Processo'] || row['processo'] || row['Processo'] || '').trim();
                const consultant = String(row['Consulente'] || row['consulente'] || '').trim();
                const location = String(row['Local'] || row['Cidade'] || row['cidade'] || '').trim();
                const matterObject = String(row['Matéria/Objeto'] || row['Matéria'] || row['Objeto'] || '').trim();
                const entryDateRaw = row['Data Entrada'] || row['Data de Entrada'] || row['Entrada'];

                // Log para debug
                console.log(`Linha ${i + 2}:`, { processNumber, consultant, location, matterObject, entryDateRaw });

                // Validação
                if (!processNumber || !consultant || !location || !matterObject || !entryDateRaw) {
                    errors.push(`Linha ${i + 2}: Faltando - ${!processNumber ? 'Processo' : ''} ${!consultant ? 'Consulente' : ''} ${!location ? 'Local' : ''} ${!matterObject ? 'Matéria' : ''} ${!entryDateRaw ? 'Data' : ''}`);
                    skipped++;
                    continue;
                }

                // Converter data
                let entryDate;
                try {
                    if (typeof entryDateRaw === 'number') {
                        const date = new Date((entryDateRaw - 25569) * 86400 * 1000);
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
                } catch (dateError) {
                    errors.push(`Linha ${i + 2}: Data inválida - ${entryDateRaw}`);
                    skipped++;
                    continue;
                }

                // Verificar existência
                const existing = await base44.entities.Process.filter({
                    organization_id: organization_id,
                    process_number: processNumber
                });

                const processData = {
                    organization_id,
                    process_number: processNumber,
                    consultant,
                    location,
                    entry_date: entryDate,
                    matter_object: matterObject,
                    urgency_request: row['Urgência'] === 'Sim' || row['Urgente'] === 'Sim' || false
                };

                // Campos opcionais
                const optionalFields = {
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
                    // Atualizar apenas campos vazios
                    const existingProcess = existing[0];
                    const updates = {};
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
                        await base44.entities.Process.update(existingProcess.id, updates);
                        updated++;
                    } else {
                        skipped++;
                    }
                } else {
                    await base44.entities.Process.create(processData);
                    created++;
                }

            } catch (rowError) {
                console.error(`Erro linha ${i + 2}:`, rowError);
                errors.push(`Linha ${i + 2}: ${rowError.message}`);
                skipped++;
            }
        }

        return Response.json({
            success: true,
            summary: { total: excelData.length, created, updated, skipped, errors }
        });

    } catch (error) {
        console.error('ERRO CRÍTICO:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack,
            details: 'Erro ao processar importação'
        }, { status: 500 });
    }
});