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

        // Baixar e parsear JSON
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            throw new Error('Falha ao baixar arquivo');
        }

        const jsonText = await fileResponse.text();
        const allData = JSON.parse(jsonText);

        // Buscar todos os processos existentes
        const existingProcesses = await base44.entities.Process.filter({ organization_id });
        const existingNumbers = new Set(existingProcesses.map(p => p.process_number));

        // Identificar registros faltantes
        const missing = [];
        const inFile = [];
        
        for (let i = 0; i < allData.length; i++) {
            const row = allData[i];
            const processNumber = String(row['PROCESSO SIM\n(NÚMERO)'] || '').trim();
            
            inFile.push({
                index: i,
                number: processNumber,
                consultant: row['CONSULENTE'],
                exists: existingNumbers.has(processNumber)
            });

            if (!existingNumbers.has(processNumber)) {
                missing.push({
                    index: i + 1,
                    processNumber: processNumber || 'VAZIO',
                    consultant: row['CONSULENTE'] || 'N/A',
                    location: row['LOCAL DOS FATOS\n(CIDADE)'] || 'N/A',
                    entryDate: row['ENTRADA NO CAOPP\n(DATA)'] || 'N/A'
                });
            }
        }

        return Response.json({
            summary: {
                totalInFile: allData.length,
                totalInDatabase: existingProcesses.length,
                missing: missing.length
            },
            missingProcesses: missing,
            allInFile: inFile
        });

    } catch (error) {
        console.error('ERRO:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});