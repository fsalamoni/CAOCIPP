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
    skipped: number;
    existing: number;
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

        console.log('Iniciando importação em lotes (Consultas CAO):', { file_url, organization_id });

        // Baixar e parsear JSON
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            throw new Error('Falha ao baixar arquivo');
        }

        const jsonText = await fileResponse.text();
        const allData: ImportRow[] = JSON.parse(jsonText);

        if (!Array.isArray(allData)) {
            throw new Error('JSON deve ser um array de objetos');
        }

        console.log(`Total de registros: ${allData.length}`);

        // Primeiro, buscar todos os processos existentes
        const existingProcesses = await consultasCao.entities.Process.filter({ organization_id }) as ProcessEntity[];
        const existingNumbers = new Set(existingProcesses.map(p => p.process_number));
        console.log(`Processos já existentes: ${existingNumbers.size}`);

        // Preparar dados para criação em lote
        const toCreate: any[] = [];
        let skipped = 0;

        for (let i = 0; i < allData.length; i++) {
            const row = allData[i];

            let processNumber = String(row['PROCESSO SIM\n(NÚMERO)'] || '').trim();

            // Se não tem número, criar um automático
            if (!processNumber) {
                processNumber = `AUTO-${Date.now()}-${i}`;
            }

            // Pular se já existe
            if (existingNumbers.has(processNumber)) {
                skipped++;
                continue;
            }

            // Extrair e converter datas
            const convertDate = (dateStr: any): string | null => {
                if (!dateStr || String(dateStr).trim() === '') return null;
                try {
                    const str = String(dateStr);
                    if (str.includes('/')) {
                        const [month, day, year] = str.split('/');
                        const fullYear = year.length === 2 ? '20' + year : year;
                        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    }
                    return str;
                } catch (e) {
                    return null;
                }
            };

            const processData: any = {
                organization_id,
                process_number: processNumber,
                consultant: String(row['CONSULENTE'] || 'Não informado').trim(),
                location: String(row['LOCAL DOS FATOS\n(CIDADE)'] || 'Não informado').trim(),
                entry_date: convertDate(row['ENTRADA NO CAOPP\n(DATA)']) || new Date().toISOString().split('T')[0],
                matter_object: String(row['MATÉRIA E OBJETO DA CONSULTA'] || 'Não informado').trim(),
                urgency_request: (row['PEDIDO DE URGÊNCIA'] || '').toLowerCase() === 'sim'
            };

            // Campos opcionais com datas
            const distDate = convertDate(row['DISTRIBUIÇÃO\n(DATA)']);
            if (distDate) processData.distribution_date = distDate;

            const analysisDate = convertDate(row['INÍCIO DA ANÁLISE\n(DATA)']);
            if (analysisDate) processData.analysis_start_date = analysisDate;

            const reviewDate = convertDate(row['REMESSA AO DR. PARA REVISÃO (DATA)']);
            if (reviewDate) processData.review_submission_date = reviewDate;

            const returnDate = convertDate(row['DEVOLUÇÃO APÓS REVISÃO\n(DATA)']);
            if (returnDate) processData.review_return_date = returnDate;

            const archiveDate = convertDate(row['NA PASTA\nARQUIVADO\n(DATA)']);
            if (archiveDate) processData.archived_date = archiveDate;

            // Outros campos
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

            toCreate.push(processData);
        }

        console.log(`Preparados para criar: ${toCreate.length}, pulados: ${skipped}`);

        // Criar em lotes de 50
        const BATCH_SIZE = 50;
        let created = 0;

        for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
            const batch = toCreate.slice(i, i + BATCH_SIZE);
            console.log(`Criando lote ${Math.floor(i / BATCH_SIZE) + 1} de ${Math.ceil(toCreate.length / BATCH_SIZE)} (${batch.length} registros)`);

            try {
                await consultasCao.entities.Process.bulkCreate(batch);
                created += batch.length;

                // Delay entre lotes para evitar rate limit
                if (i + BATCH_SIZE < toCreate.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}:`, errorMessage);
            }
        }

        const summary: ImportSummary = {
            total: allData.length,
            created,
            skipped,
            existing: existingNumbers.size
        };
        return Response.json({ success: true, summary });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('ERRO (Bulk Import Batched):', errorMessage);
        return Response.json({
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
});