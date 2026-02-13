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

        console.log('INICIANDO RESET E IMPORTAÇÃO COMPLETA (Consultas CAO)');

        // 1. DELETAR TODOS OS PROCESSOS DA ORGANIZAÇÃO EM LOTES
        const existingProcesses = await consultasCao.asServiceRole.entities.Process.filter({ organization_id }) as ProcessEntity[];
        console.log(`Deletando ${existingProcesses.length} processos existentes...`);

        for (let i = 0; i < existingProcesses.length; i++) {
            await consultasCao.asServiceRole.entities.Process.delete(existingProcesses[i].id);
            if ((i + 1) % 10 === 0) {
                console.log(`Deletados: ${i + 1}/${existingProcesses.length}`);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }

        console.log('Todos os processos deletados!');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 2. BAIXAR E PARSEAR JSON
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            throw new Error('Falha ao baixar arquivo');
        }

        const jsonText = await fileResponse.text();
        const allData: ImportRow[] = JSON.parse(jsonText);

        if (!Array.isArray(allData)) {
            throw new Error('JSON deve ser um array');
        }

        console.log(`Total de registros no arquivo: ${allData.length}`);

        // 3. FUNÇÃO PARA CONVERTER DATA
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
                return null;
            }
        };

        // 4. PREPARAR PROCESSOS
        let createdCount = 0;
        const errors: string[] = [];
        const toCreate: any[] = [];

        for (let i = 0; i < allData.length; i++) {
            const row = allData[i];

            try {
                const processNumber = String(row['PROCESSO SIM\n(NÚMERO)'] || '').trim();

                if (!processNumber) {
                    errors.push(`Linha ${i + 1}: Número vazio`);
                    continue;
                }

                const processData = {
                    organization_id,
                    process_number: processNumber,
                    consultant: String(row['CONSULENTE'] || '').trim() || null,
                    location: String(row['LOCAL DOS FATOS\n(CIDADE)'] || '').trim() || null,
                    entry_date: parseDate(row['ENTRADA NO CAOPP\n(DATA)']),
                    matter_object: String(row['MATÉRIA E OBJETO DA CONSULTA'] || '').trim() || null,
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

                toCreate.push(processData);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                errors.push(`Linha ${i + 1}: ${errorMessage}`);
            }
        }

        // 5. CRIAR EM LOTES DE 50
        console.log(`Criando ${toCreate.length} processos em lotes...`);

        for (let i = 0; i < toCreate.length; i += 50) {
            const batch = toCreate.slice(i, i + 50);
            await consultasCao.asServiceRole.entities.Process.bulkCreate(batch);
            createdCount += batch.length;
            console.log(`Lote ${Math.floor(i / 50) + 1}: ${createdCount}/${toCreate.length} criados`);

            if (i + 50 < toCreate.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // 6. VERIFICAR RESULTADO
        const finalResults = await consultasCao.asServiceRole.entities.Process.filter({ organization_id }) as ProcessEntity[];

        return Response.json({
            success: true,
            summary: {
                deletedOld: existingProcesses.length,
                totalInFile: allData.length,
                created: createdCount,
                finalCount: finalResults.length,
                errors: errors.length
            },
            errorDetails: errors.length > 0 ? errors.slice(0, 10) : []
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('ERRO CRÍTICO (Reset and Import All):', errorMessage);
        return Response.json({
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
});