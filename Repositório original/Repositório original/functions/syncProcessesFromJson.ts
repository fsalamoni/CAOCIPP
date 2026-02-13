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
    'RESTRIÇÃO DE ACESSO'?: string;
    'PASTA NA REDE'?: string;
    [key: string]: any;
}

interface ProcessEntity {
    id: string;
    process_number: string;
    [key: string]: any;
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
                error: 'Parâmetros faltando'
            }, { status: 400 });
        }

        console.log('Iniciando sincronização (Consultas CAO):', { file_url, organization_id });

        // Baixar e parsear JSON
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            throw new Error('Falha ao baixar arquivo');
        }

        const jsonText = await fileResponse.text();
        const allData: ImportRow[] = JSON.parse(jsonText);

        if (!Array.isArray(allData)) {
            throw new Error('JSON deve ser um array');
        }

        console.log('Total de registros no arquivo:', allData.length);

        // Buscar todos os processos existentes
        const existingProcesses = await consultasCao.entities.Process.filter({ organization_id }) as ProcessEntity[];
        const existingMap = new Map<string, ProcessEntity>(existingProcesses.map(p => [p.process_number, p]));

        console.log('Processos existentes no banco:', existingProcesses.length);

        let createdCount = 0, updatedCount = 0, skippedCount = 0;
        const errors: string[] = [];

        // Função para converter data
        const parseDate = (dateValue: any): string | null => {
            if (!dateValue || dateValue === '') return null;

            try {
                if (typeof dateValue === 'number') {
                    const date = new Date((dateValue - 25569) * 86400 * 1000);
                    return date.toISOString().split('T')[0];
                } else if (dateValue instanceof Date) {
                    return dateValue.toISOString().split('T')[0];
                } else {
                    const dateStr = String(dateValue);
                    if (dateStr.includes('/')) {
                        const [month, day, year] = dateStr.split('/');
                        const fullYear = year.length === 2 ? '20' + year : year;
                        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    }
                    return dateStr;
                }
            } catch (e) {
                console.error('Erro ao parsear data:', dateValue, e);
                return null;
            }
        };

        // Processar cada registro
        for (let i = 0; i < allData.length; i++) {
            const row = allData[i];

            try {
                const processNumber = String(row['PROCESSO SIM\n(NÚMERO)'] || '').trim();

                if (!processNumber) {
                    errors.push(`Linha ${i + 1}: Número do processo vazio`);
                    skippedCount++;
                    continue;
                }

                const consultant = String(row['CONSULENTE'] || '').trim() || null;
                const location = String(row['LOCAL DOS FATOS\n(CIDADE)'] || '').trim() || null;
                const matterObject = String(row['MATÉRIA E OBJETO DA CONSULTA'] || '').trim() || null;
                const entryDate = parseDate(row['ENTRADA NO CAOPP\n(DATA)']);

                // Montar dados do processo
                const processData: any = {
                    organization_id,
                    process_number: processNumber,
                    consultant,
                    location,
                    entry_date: entryDate,
                    matter_object: matterObject,
                    urgency_request: row['PEDIDO DE URGÊNCIA'] === 'Sim',
                    distribution_date: parseDate(row['DISTRIBUIÇÃO\n(DATA)']),
                    responsible_user_name: row['ASSESSOR RESPONSÁVEL'] || null,
                    analysis_start_date: parseDate(row['INÍCIO DA ANÁLISE\n(DATA)']),
                    observations: row['OBSERVAÇÕES E PONTOS IMPORTANTES DA RESPOSTA'] || null,
                    review_submission_date: parseDate(row['REMESSA AO DR. PARA REVISÃO (DATA)']),
                    review_return_date: parseDate(row['DEVOLUÇÃO APÓS REVISÃO\n(DATA)']),
                    access_restriction: row['RESTRIÇÃO DE ACESSO'] === 'Sim',
                    archived_date: parseDate(row['NA PASTA\nARQUIVADO\n(DATA)']),
                    network_folder: row['PASTA NA REDE'] || null
                };

                // Verificar se existe
                const existing = existingMap.get(processNumber);

                if (existing) {
                    // Atualizar apenas se houver diferenças
                    let hasChanges = false;
                    const updates: any = {};

                    for (const [key, value] of Object.entries(processData)) {
                        if (key !== 'organization_id' && existing[key] !== value) {
                            updates[key] = value;
                            hasChanges = true;
                        }
                    }

                    if (hasChanges) {
                        await consultasCao.entities.Process.update(existing.id, updates);
                        updatedCount++;
                    } else {
                        skippedCount++;
                    }
                } else {
                    // Criar novo
                    await consultasCao.entities.Process.create(processData);
                    createdCount++;
                }

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Erro na linha ${i + 1}:`, errorMessage);
                errors.push(`Linha ${i + 1}: ${errorMessage}`);
                skippedCount++;
            }
        }

        return Response.json({
            success: true,
            summary: {
                total: allData.length,
                created: createdCount,
                updated: updatedCount,
                skipped: skippedCount,
                errors: errors.length
            },
            errorDetails: errors.length > 0 ? errors.slice(0, 10) : []
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('ERRO CRÍTICO (Sync Processes From JSON):', errorMessage);
        return Response.json({
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
});