import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const { file_url, organization_id } = body;

        if (!file_url || !organization_id) {
            return Response.json({ 
                error: 'Parâmetros faltando',
                received: { file_url: !!file_url, organization_id: !!organization_id }
            }, { status: 400 });
        }

        console.log('Iniciando importação em massa:', { file_url, organization_id });

        // Baixar arquivo JSON
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            throw new Error('Falha ao baixar arquivo');
        }

        const jsonText = await fileResponse.text();
        const allData = JSON.parse(jsonText);

        if (!Array.isArray(allData)) {
            throw new Error('JSON deve ser um array de objetos');
        }

        console.log(`Total de registros no arquivo: ${allData.length}`);

        let created = 0, updated = 0, skipped = 0;
        const errors = [];

        // Processar TODOS os registros
        for (let i = 0; i < allData.length; i++) {
            const row = allData[i];
            
            try {
                // Extrair dados
                const processNumber = String(row['PROCESSO SIM\n(NÚMERO)'] || row['processo'] || '').trim();
                const consultant = String(row['CONSULENTE'] || row['consulente'] || '').trim();
                const location = String(row['LOCAL DOS FATOS\n(CIDADE)'] || row['Cidade'] || '').trim();
                const matterObject = String(row['MATÉRIA E OBJETO DA CONSULTA'] || row['Matéria'] || '').trim();
                const entryDateRaw = row['ENTRADA NO CAOPP\n(DATA)'] || row['Data de Entrada'] || row['Entrada'];

                // Validação mínima - só número do processo é obrigatório
                if (!processNumber) {
                    errors.push(`Linha ${i + 1}: Número do processo faltando`);
                    skipped++;
                    continue;
                }

                // Converter data
                let entryDate;
                try {
                    const dateStr = String(entryDateRaw);
                    if (dateStr.includes('/')) {
                        const [month, day, year] = dateStr.split('/');
                        const fullYear = year.length === 2 ? '20' + year : year;
                        entryDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    } else {
                        entryDate = dateStr;
                    }
                } catch (dateError) {
                    errors.push(`Linha ${i + 1}: Data inválida`);
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
                    consultant: consultant || 'Não informado',
                    location: location || 'Não informado',
                    entry_date: entryDate || new Date().toISOString().split('T')[0],
                    matter_object: matterObject || 'Não informado',
                    urgency_request: (row['PEDIDO DE URGÊNCIA'] || '').toLowerCase() === 'sim'
                };

                // Campos opcionais com conversão de data
                const dateFields = {
                    'distribution_date': row['DISTRIBUIÇÃO\n(DATA)'],
                    'analysis_start_date': row['INÍCIO DA ANÁLISE\n(DATA)'],
                    'review_submission_date': row['REMESSA AO DR. PARA REVISÃO (DATA)'],
                    'review_return_date': row['DEVOLUÇÃO APÓS REVISÃO\n(DATA)'],
                    'archived_date': row['NA PASTA\nARQUIVADO\n(DATA)']
                };

                for (const [key, value] of Object.entries(dateFields)) {
                    if (value && String(value).trim() !== '') {
                        try {
                            const dateStr = String(value);
                            if (dateStr.includes('/')) {
                                const [month, day, year] = dateStr.split('/');
                                const fullYear = year.length === 2 ? '20' + year : year;
                                processData[key] = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                            }
                        } catch (e) {
                            // Ignorar erros de conversão de data opcional
                        }
                    }
                }

                // Outros campos opcionais
                if (row['ASSESSOR RESPONSÁVEL']) {
                    processData.responsible_user_name = String(row['ASSESSOR RESPONSÁVEL']).trim();
                }
                if (row['OBSERVAÇÕES E PONTOS IMPORTANTES DA RESPOSTA']) {
                    processData.observations = String(row['OBSERVAÇÕES E PONTOS IMPORTANTES DA RESPOSTA']).trim();
                }
                if (row['PASTA NA REDE']) {
                    processData.network_folder = String(row['PASTA NA REDE']).trim();
                }
                if (row['STATUS']) {
                    processData.status = String(row['STATUS']).trim();
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
                console.error(`Erro linha ${i + 1}:`, rowError);
                errors.push(`Linha ${i + 1}: ${rowError.message}`);
                skipped++;
            }
        }

        return Response.json({
            success: true,
            summary: { 
                total: allData.length, 
                created, 
                updated, 
                skipped, 
                errorCount: errors.length,
                errors: errors.slice(0, 10) // Primeiros 10 erros
            }
        });

    } catch (error) {
        console.error('ERRO CRÍTICO:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});