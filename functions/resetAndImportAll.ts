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
                error: 'Parâmetros faltando'
            }, { status: 400 });
        }

        console.log('INICIANDO RESET E IMPORTAÇÃO COMPLETA');

        // 1. DELETAR TODOS OS PROCESSOS DA ORGANIZAÇÃO EM LOTES
        const existingProcesses = await base44.asServiceRole.entities.Process.filter({ organization_id });
        console.log(`Deletando ${existingProcesses.length} processos existentes...`);
        
        for (let i = 0; i < existingProcesses.length; i++) {
            await base44.asServiceRole.entities.Process.delete(existingProcesses[i].id);
            if ((i + 1) % 5 === 0) {
                console.log(`Deletados: ${i + 1}/${existingProcesses.length}`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        console.log('Todos os processos deletados!');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 2. BAIXAR E PARSEAR JSON
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            throw new Error('Falha ao baixar arquivo');
        }

        const jsonText = await fileResponse.text();
        const allData = JSON.parse(jsonText);

        if (!Array.isArray(allData)) {
            throw new Error('JSON deve ser um array');
        }

        console.log(`Total de registros no arquivo: ${allData.length}`);

        // 3. FUNÇÃO PARA CONVERTER DATA
        const parseDate = (dateValue) => {
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

        // 4. IMPORTAR TODOS OS 593 PROCESSOS
        let created = 0;
        const errors = [];
        const toCreate = [];

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
                errors.push(`Linha ${i + 1}: ${error.message}`);
            }
        }

        // 5. CRIAR EM LOTES DE 20
        console.log(`Criando ${toCreate.length} processos em lotes...`);
        
        for (let i = 0; i < toCreate.length; i += 20) {
            const batch = toCreate.slice(i, i + 20);
            await base44.asServiceRole.entities.Process.bulkCreate(batch);
            created += batch.length;
            console.log(`Lote ${Math.floor(i / 20) + 1}: ${created}/${toCreate.length} criados`);
            
            if (i + 20 < toCreate.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // 6. VERIFICAR RESULTADO
        const finalCount = await base44.asServiceRole.entities.Process.filter({ organization_id });
        
        return Response.json({
            success: true,
            summary: {
                deletedOld: existingProcesses.length,
                totalInFile: allData.length,
                created: created,
                finalCount: finalCount.length,
                errors: errors.length
            },
            errorDetails: errors.length > 0 ? errors.slice(0, 10) : []
        });

    } catch (error) {
        console.error('ERRO CRÍTICO:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});