import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

interface ImportRow {
    'PROCESSO SIM\n(NÚMERO)'?: string;
    'CONSULENTE'?: string;
    'LOCAL DOS FATOS\n(CIDADE)'?: string;
    'ENTRADA NO CAOPP\n(DATA)'?: string;
    'MATÉRIA E OBJETO DA CONSULTA'?: string;
    'PEDIDO DE URGÊNCIA'?: string;
    'DISTRIBUIÇÃO\n(DATA)'?: string;
    'ASSESSOR RESPONSÁVEL'?: string;
    'INÍCIO DA ANÁLISE\n(DATA)'?: string;
    'OBSERVAÇÕES E PONTOS IMPORTANTES DA RESPOSTA'?: string;
    'REMESSA AO DR. PARA REVISÃO (DATA)'?: string;
    'DEVOLUÇÃO APÓS REVISÃO\n(DATA)'?: string;
    'NA PASTA\nARQUIVADO\n(DATA)'?: string;
    'PASTA NA REDE'?: string;
    'STATUS'?: string;
    processo?: string;
    consulente?: string;
    Cidade?: string;
    Matéria?: string;
    'Data de Entrada'?: string;
    Entrada?: string;
    [key: string]: any;
}

interface ProcessEntity {
    id: string;
    process_number: string;
    [key: string]: any;
}

interface ImportSummary {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errorCount: number;
    errors: string[];
}

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
    try {
        const consultasCao = createClientFromRequest(req);
        const user = await consultasCao.auth.me();

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

        console.log('Iniciando importação em massa (Consultas CAO):', { file_url, organization_id });

        // Baixar arquivo JSON
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            throw new Error('Falha ao baixar arquivo');
        }

        const jsonText = await fileResponse.text();
        const allData: ImportRow[] = JSON.parse(jsonText);

        if (!Array.isArray(allData)) {
            throw new Error('JSON deve ser um array de objetos');
        }

        console.log(`Total de registros no arquivo: ${allData.length}`);

        let created = 0, updated = 0, skipped = 0;
        const errors: string[] = [];

        // Processar registros
        for (let i = 0; i < allData.length; i++) {
            const row = allData[i];

            try {
                // Extrair dados
                const processNumber = String(row['PROCESSO SIM\n(NÚMERO)'] || row['processo'] || '').trim();
                const consultant = String(row['CONSULENTE'] || row['consulente'] || '').trim();
                const location = String(row['LOCAL DOS FATOS\n(CIDADE)'] || row['Cidade'] || '').trim();
                const matterObject = String(row['MATÉRIA E OBJETO DA CONSULTA'] || row['Matéria'] || '').trim();
                const entryDateRaw = row['ENTRADA NO CAOPP\n(DATA)'] || row['Data de Entrada'] || row['Entrada'];

                // Validação mínima
                if (!processNumber) {
                    errors.push(`Linha ${i + 1}: Número do processo faltando`);
                    skipped++;
                    continue;
                }

                // Converter data
                let entryDate: string | null = null;
                if (entryDateRaw) {
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
                }

                // Verificar existência
                const existing = await consultasCao.entities.Process.filter({
                    organization_id: organization_id,
                    process_number: processNumber
                }) as ProcessEntity[];

                const processData: any = {
                    organization_id,
                    process_number: processNumber,
                    consultant: consultant || 'Não informado',
                    location: location || 'Não informado',
                    entry_date: entryDate || new Date().toISOString().split('T')[0],
                    matter_object: matterObject || 'Não informado',
                    urgency_request: (row['PEDIDO DE URGÊNCIA'] || '').toLowerCase() === 'sim'
                };

                // Campos opcionais com conversão de data
                const dateFields: { [key: string]: any } = {
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
                            } else {
                                processData[key] = dateStr;
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
                console.error(`Erro linha ${i + 1}:`, errorMessage);
                errors.push(`Linha ${i + 1}: ${errorMessage}`);
                skipped++;
            }
        }

        const summary: ImportSummary = {
            total: allData.length,
            created,
            updated,
            skipped,
            errorCount: errors.length,
            errors: errors.slice(0, 10)
        };
        return Response.json({ success: true, summary });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('ERRO CRÍTICO (Bulk Import From URL):', errorMessage);
        return Response.json({
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
});