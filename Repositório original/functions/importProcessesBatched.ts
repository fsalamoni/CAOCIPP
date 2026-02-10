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

interface UserEntity {
  id: string;
  full_name: string;
  [key: string]: any;
}

function calculateStatus(process: any): string | null {
  if (process.archived_date) return "Na pasta";
  if (process.review_return_date) return "Para revisão";
  if (process.review_submission_date) return "Em revisão";
  if (process.analysis_start_date) return "Em elaboração";
  if (process.distribution_date) return "Pendente";
  return null;
}

function parseDate(dateValue: any): string | null {
  if (!dateValue || dateValue === '') return null;

  try {
    if (typeof dateValue === 'number') {
      const date = new Date((dateValue - 25569) * 86400 * 1000);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    } else if (dateValue instanceof Date) {
      if (isNaN(dateValue.getTime())) return null;
      return dateValue.toISOString().split('T')[0];
    } else {
      const dateStr = String(dateValue).trim();
      if (!dateStr) return null;

      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        const [month, day, year] = parts;
        const fullYear = year.length === 2 ? '20' + year : year;
        const formatted = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        const testDate = new Date(formatted);
        if (isNaN(testDate.getTime())) return null;
        return formatted;
      }

      const testDate = new Date(dateStr);
      if (isNaN(testDate.getTime())) return null;
      return dateStr;
    }
  } catch (e) {
    console.error('Erro ao parsear data:', dateValue, e);
    return null;
  }
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
    const { file_url, organization_id, offset = 0, limit = 100 } = body;

    if (!file_url || !organization_id) {
      return Response.json({
        error: 'Parâmetros faltando: file_url e organization_id'
      }, { status: 400 });
    }

    console.log(`Iniciando importação (Consultas CAO): offset=${offset}, limit=${limit}`);

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

    console.log(`Total de registros no arquivo: ${allData.length}`);

    // Aplicar paginação
    const paginatedData = allData.slice(offset, offset + limit);
    console.log(`Processando lote: ${paginatedData.length} registros`);

    // Buscar processos existentes para evitar duplicatas
    const existingProcesses = await consultasCao.entities.Process.filter({ organization_id }) as ProcessEntity[];
    const existingMap = new Map<string, ProcessEntity>(existingProcesses.map(p => [p.process_number, p]));

    let createdCount = 0, updatedCount = 0, skippedCount = 0;
    const errors: string[] = [];

    // Encontrar assessores para vincular por nome
    const users = await consultasCao.entities.User.list() as UserEntity[];
    const userMap = new Map<string, string>(users.map(u => [u.full_name?.toLowerCase(), u.id]));

    for (let i = 0; i < paginatedData.length; i++) {
      const row = paginatedData[i];

      try {
        const processNumber = String(row['PROCESSO SIM\n(NÚMERO)'] || '').trim();

        if (!processNumber) {
          skippedCount++;
          continue;
        }

        const consultant = String(row['CONSULENTE'] || '').trim() || null;
        const location = String(row['LOCAL DOS FATOS\n(CIDADE)'] || '').trim() || null;
        const matterObject = String(row['MATÉRIA E OBJETO DA CONSULTA'] || '').trim() || null;
        const entryDate = parseDate(row['ENTRADA NO CAOPP\n(DATA)']);

        const responsibleName = String(row['ASSESSOR RESPONSÁVEL'] || '').trim() || null;
        const responsibleUserId = responsibleName ? userMap.get(responsibleName.toLowerCase()) : null;

        const processData: any = {
          organization_id,
          process_number: processNumber,
          consultant,
          location,
          entry_date: entryDate,
          matter_object: matterObject,
          urgency_request: row['PEDIDO DE URGÊNCIA']?.toString().toLowerCase() === 'sim',
          distribution_date: parseDate(row['DISTRIBUIÇÃO\n(DATA)']),
          responsible_user_id: responsibleUserId || null,
          responsible_user_name: responsibleName,
          analysis_start_date: parseDate(row['INÍCIO DA ANÁLISE\n(DATA)']),
          observations: row['OBSERVAÇÕES E PONTOS IMPORTANTES DA RESPOSTA'] || null,
          review_submission_date: parseDate(row['REMESSA AO DR. PARA REVISÃO (DATA)']),
          review_return_date: parseDate(row['DEVOLUÇÃO APÓS REVISÃO\n(DATA)']),
          access_restriction: row['RESTRIÇÃO DE ACESSO']?.toString().toLowerCase() === 'sim',
          archived_date: parseDate(row['NA PASTA\nARQUIVADO\n(DATA)']),
          network_folder: row['PASTA NA REDE'] || null
        };

        // Calcular status
        processData.status = calculateStatus(processData);

        const existing = existingMap.get(processNumber);

        if (existing) {
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
          await consultasCao.entities.Process.create(processData);
          createdCount++;
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Erro na linha ${offset + i + 1}:`, errorMessage);
        errors.push(`Linha ${offset + i + 1}: ${errorMessage}`);
        skippedCount++;
      }
    }

    const totalProcessed = createdCount + updatedCount + skippedCount;
    const hasMore = (offset + limit) < allData.length;

    return Response.json({
      success: true,
      summary: {
        offset,
        limit,
        processed: totalProcessed,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errors.length,
        hasMore,
        nextOffset: hasMore ? offset + limit : null,
        totalInFile: allData.length
      },
      errorDetails: errors.length > 0 ? errors.slice(0, 20) : []
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('ERRO CRÍTICO (Import Processes Batched):', errorMessage);
    return Response.json({
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
});