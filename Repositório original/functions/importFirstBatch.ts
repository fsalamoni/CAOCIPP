import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { processes, organization_id } = body;

    if (!processes || !Array.isArray(processes)) {
      return Response.json({ error: 'processes array é obrigatório' }, { status: 400 });
    }

    if (!organization_id) {
      return Response.json({ error: 'organization_id é obrigatório' }, { status: 400 });
    }

    // Buscar assessores para mapear nomes
    const users = await base44.asServiceRole.entities.User.list();
    const userMap = {};
    users.forEach(u => {
      userMap[u.full_name?.toLowerCase()] = u.id;
    });

    console.log(`Importando ${processes.length} processos...`);

    let created = 0;
    let updated = 0;
    let errors = [];

    // Processar em lotes para evitar rate limit
    for (let i = 0; i < processes.length; i++) {
      const row = processes[i];
      
      try {
        // Mapear campos do JSON para o schema
        const processNumber = row["PROCESSO SIM\n(NÚMERO)"]?.trim();
        const consultant = row["CONSULENTE"]?.trim();
        const location = row["LOCAL DOS FATOS\n(CIDADE)"]?.trim();
        const entryDate = parseDate(row["ENTRADA NO CAOPP\n(DATA)"]);
        const matterObject = row["MATÉRIA E OBJETO DA CONSULTA"]?.trim();
        const urgencyRequest = row["PEDIDO DE URGÊNCIA"]?.toLowerCase().trim() === "sim";
        const distributionDate = parseDate(row["DISTRIBUIÇÃO\n(DATA)"]);
        const responsibleName = row["ASSESSOR RESPONSÁVEL"]?.trim();
        const responsibleUserId = responsibleName ? userMap[responsibleName.toLowerCase()] : null;
        const analysisStartDate = parseDate(row["INÍCIO DA ANÁLISE\n(DATA)"]);
        const observations = row["OBSERVAÇÕES E PONTOS IMPORTANTES DA RESPOSTA"]?.trim();
        const reviewSubmissionDate = parseDate(row["REMESSA AO DR. PARA REVISÃO (DATA)"]);
        const reviewReturnDate = parseDate(row["DEVOLUÇÃO APÓS REVISÃO\n(DATA)"]);
        const accessRestriction = row["RESTRIÇÃO DE ACESSO"]?.toLowerCase().trim() === "sim";
        const archivedDate = parseDate(row["NA PASTA\nARQUIVADO\n(DATA)"]);
        const status = row["STATUS"]?.trim() || calculateStatus({
          analysis_start_date: analysisStartDate,
          review_submission_date: reviewSubmissionDate,
          review_return_date: reviewReturnDate,
          archived_date: archivedDate
        });
        const networkFolder = row["PASTA NA REDE"]?.trim();

        // Validações básicas
        if (!processNumber) {
          errors.push({ row: i + 1, error: 'Número do processo não informado' });
          continue;
        }

        // Buscar processo existente
        const existingProcesses = await base44.entities.Process.filter({
          organization_id,
          process_number: processNumber
        });

        const processData = {
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
          // Atualizar
          await base44.entities.Process.update(existingProcesses[0].id, processData);
          updated++;
        } else {
          // Criar novo
          await base44.entities.Process.create(processData);
          created++;
        }

        if ((created + updated) % 10 === 0) {
          console.log(`${created + updated}/${processes.length} processados...`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        errors.push({ row: i + 1, error: error.message });
        console.error(`Erro na linha ${i + 1}:`, error.message);
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
    console.error('Erro na importação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;

  dateStr = dateStr.trim();

  // Tentar MM/DD/YY ou M/D/YY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    let month = parseInt(parts[0]);
    let day = parseInt(parts[1]);
    let year = parseInt(parts[2]);

    // Se ano tem 2 dígitos, adicionar 20
    if (year < 100) {
      year += 2000;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  return null;
}

function calculateStatus(data) {
  if (data.archived_date) return 'Na pasta';
  if (data.review_return_date) return 'Para revisão';
  if (data.review_submission_date) return 'Em revisão';
  if (data.analysis_start_date) return 'Em elaboração';
  return 'Pendente';
}