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
  'STATUS'?: string;
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

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
  try {
    const consultasCao = createClientFromRequest(req);
    const user = await consultasCao.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { processes, organization_id } = body as { processes: ImportRow[], organization_id: string };

    if (!processes || !Array.isArray(processes)) {
      return Response.json({ error: 'processes array é obrigatório' }, { status: 400 });
    }

    if (!organization_id) {
      return Response.json({ error: 'organization_id é obrigatório' }, { status: 400 });
    }

    // Buscar assessores para mapear nomes
    const users = await consultasCao.asServiceRole.entities.User.list() as UserEntity[];
    const userMap: { [key: string]: string } = {};
    users.forEach(u => {
      if (u.full_name) {
        userMap[u.full_name.toLowerCase()] = u.id;
      }
    });

    console.log(`Importando ${processes.length} processos (Consultas CAO)...`);

    let created = 0;
    let updated = 0;
    const errors: any[] = [];

    // Processar em lotes para evitar rate limit
    for (let i = 0; i < processes.length; i++) {
      const row = processes[i];

      try {
        // Mapear campos do JSON para o schema
        const processNumber = row["PROCESSO SIM\n(NÚMERO)"]?.trim();
        const consultant = row["CONSULENTE"]?.trim() || null;
        const location = row["LOCAL DOS FATOS\n(CIDADE)"]?.trim() || null;
        const entryDate = parseDate(row["ENTRADA NO CAOPP\n(DATA)"]);
        const matterObject = row["MATÉRIA E OBJETO DA CONSULTA"]?.trim() || null;
        const urgencyRequest = row["PEDIDO DE URGÊNCIA"]?.toLowerCase().trim() === "sim";
        const distributionDate = parseDate(row["DISTRIBUIÇÃO\n(DATA)"]);
        const responsibleName = row["ASSESSOR RESPONSÁVEL"]?.trim() || null;
        const responsibleUserId = responsibleName ? userMap[responsibleName.toLowerCase()] || null : null;
        const analysisStartDate = parseDate(row["INÍCIO DA ANÁLISE\n(DATA)"]);
        const observations = row["OBSERVAÇÕES E PONTOS IMPORTANTES DA RESPOSTA"]?.trim() || null;
        const reviewSubmissionDate = parseDate(row["REMESSA AO DR. PARA REVISÃO (DATA)"]);
        const reviewReturnDate = parseDate(row["DEVOLUÇÃO APÓS REVISÃO\n(DATA)"]);
        const accessRestriction = row["RESTRIÇÃO DE ACESSO"]?.toLowerCase().trim() === "sim";
        const archivedDate = parseDate(row["NA PASTA\nARQUIVADO\n(DATA)"]);
        const status = row["STATUS"]?.trim() || calculateStatus({
          analysis_start_date: analysisStartDate,
          review_submission_date: reviewSubmissionDate,
          review_return_date: reviewReturnDate,
          archived_date: archivedDate,
          distribution_date: distributionDate
        });
        const networkFolder = row["PASTA NA REDE"]?.trim() || null;

        // Validações básicas
        if (!processNumber) {
          errors.push({ row: i + 1, error: 'Número do processo não informado' });
          continue;
        }

        // Buscar processo existente
        const existingProcesses = await consultasCao.entities.Process.filter({
          organization_id,
          process_number: processNumber
        }) as ProcessEntity[];

        const processData: any = {
          process_number: processNumber,
          consultant,
          location,
          entry_date: entryDate,
          matter_object: matterObject,
          urgency_request: urgencyRequest,
          distribution_date: distributionDate,
          responsible_user_id: responsibleUserId,
          responsible_user_name: responsibleName,
          analysis_start_date: analysisStartDate,
          observations,
          review_submission_date: reviewSubmissionDate,
          review_return_date: reviewReturnDate,
          access_restriction: accessRestriction,
          archived_date: archivedDate,
          status,
          network_folder: networkFolder,
          organization_id
        };

        if (existingProcesses.length > 0) {
          await consultasCao.entities.Process.update(existingProcesses[0].id, processData);
          updated++;
        } else {
          await consultasCao.entities.Process.create(processData);
          created++;
        }

        if ((created + updated) % 20 === 0) {
          console.log(`${created + updated}/${processes.length} processados...`);
          await new Promise(resolve => setTimeout(resolve, 300));
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ row: i + 1, error: errorMessage });
        console.error(`Erro na linha ${i + 1}:`, errorMessage);
      }
    }

    console.log(`Importação concluída: ${created} criados, ${updated} atualizados, ${errors.length} erros`);

    return Response.json({
      success: true,
      created,
      updated,
      errors,
      total: processes.length,
      message: `✅ Importação concluída: ${created} criados, ${updated} atualizados`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Erro na importação:', errorMessage);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
});

function parseDate(dateStr: any): string | null {
  if (!dateStr || String(dateStr).trim() === '') return null;
  const str = String(dateStr).trim();
  const parts = str.split('/');
  if (parts.length === 3) {
    let month = parseInt(parts[0]);
    let day = parseInt(parts[1]);
    let year = parseInt(parts[2]);
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  return str.includes('-') ? str : null;
}

function calculateStatus(data: any): string {
  if (data.archived_date) return 'Na pasta';
  if (data.review_return_date) return 'Para revisão';
  if (data.review_submission_date) return 'Em revisão';
  if (data.analysis_start_date) return 'Em elaboração';
  if (data.distribution_date) return 'Pendente';
  return 'Pendente';
}