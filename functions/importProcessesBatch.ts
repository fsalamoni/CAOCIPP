import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { file_url, organization_id, batch_size = 20 } = body;

    if (!file_url || !organization_id) {
      return Response.json({ error: 'file_url e organization_id são obrigatórios' }, { status: 400 });
    }

    // Download arquivo
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      throw new Error(`Erro ao baixar arquivo: ${fileResponse.statusText}`);
    }
    
    const fileContent = await fileResponse.text();
    let processes = JSON.parse(fileContent);

    if (!Array.isArray(processes)) {
      throw new Error('Arquivo deve conter um array JSON');
    }

    console.log(`📊 Total de processos: ${processes.length}`);

    // Buscar assessores
    const users = await base44.asServiceRole.entities.User.list();
    const userMap = {};
    users.forEach(u => {
      userMap[u.full_name?.toLowerCase()] = u.id;
    });

    let created = 0;
    let updated = 0;
    let errors = [];

    // Processar sequencialmente (sem paralelismo)
    for (let i = 0; i < processes.length; i++) {
      const row = processes[i];
      const rowNum = i + 1;

      try {
         const processData = buildProcessData(row, userMap, organization_id);

         if (!processData.process_number) {
           console.log(`⚠️ Linha ${rowNum}: Pulada (sem número de processo)`);
           continue;
         }

         // Buscar processo existente
         const existingProcesses = await base44.entities.Process.filter({
           organization_id,
           process_number: processData.process_number
         });

         if (existingProcesses.length > 0) {
           await base44.entities.Process.update(existingProcesses[0].id, processData);
           console.log(`🔄 Linha ${rowNum}: Atualizado - ${processData.process_number}`);
           updated++;
         } else {
           await base44.entities.Process.create(processData);
           console.log(`✅ Linha ${rowNum}: Criado - ${processData.process_number}`);
           created++;
         }

         if ((i + 1) % 5 === 0) {
           console.log(`\n📊 Progresso: ${i + 1}/${processes.length} processados (${created} criados, ${updated} atualizados)\n`);
           await new Promise(resolve => setTimeout(resolve, 500));
         } else {
           await new Promise(resolve => setTimeout(resolve, 200));
         }

       } catch (error) {
         console.error(`❌ Erro na linha ${rowNum}:`, error.message);
         console.log(`   Dados da linha: ${JSON.stringify(row)}`);
         errors.push({ linha: rowNum, erro: error.message, dados: row });
         await new Promise(resolve => setTimeout(resolve, 300));
       }
    }

    console.log(`\n🎉 Importação finalizada!`);
    console.log(`✅ Criados: ${created}`);
    console.log(`🔄 Atualizados: ${updated}`);
    console.log(`⚠️  Erros: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log(`\n📋 Detalhes dos erros:`);
      errors.forEach(e => {
        console.log(`   Linha ${e.linha}: ${e.erro}`);
      });
    }

    return Response.json({
      success: true,
      created,
      updated,
      total: processes.length,
      totalProcessed: created + updated,
      errors: errors.length,
      errorDetails: errors,
      message: `✅ Importação concluída: ${created} criados, ${updated} atualizados, ${errors.length} com erro`
    });

  } catch (error) {
    console.error('❌ Erro fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildProcessData(row, userMap, organization_id) {
  const processNumber = row["PROCESSO SIM\n(NÚMERO)"]?.trim() || null;
  const consultant = row["CONSULENTE"]?.trim() || null;
  const location = row["LOCAL DOS FATOS\n(CIDADE)"]?.trim() || null;
  const entryDate = parseDate(row["ENTRADA NO CAOPP\n(DATA)"]) || null;
  const matterObject = row["MATÉRIA E OBJETO DA CONSULTA"]?.trim() || null;
  const urgencyRequest = row["PEDIDO DE URGÊNCIA"]?.toLowerCase().trim() === "sim" || false;
  const distributionDate = parseDate(row["DISTRIBUIÇÃO\n(DATA)"]) || null;
  const responsibleName = row["ASSESSOR RESPONSÁVEL"]?.trim() || null;
  const responsibleUserId = responsibleName ? userMap[responsibleName.toLowerCase()] || null : null;
  const analysisStartDate = parseDate(row["INÍCIO DA ANÁLISE\n(DATA)"]) || null;
  const observations = row["OBSERVAÇÕES E PONTOS IMPORTANTES DA RESPOSTA"]?.trim() || null;
  const reviewSubmissionDate = parseDate(row["REMESSA AO DR. PARA REVISÃO (DATA)"]) || null;
  const reviewReturnDate = parseDate(row["DEVOLUÇÃO APÓS REVISÃO\n(DATA)"]) || null;
  const accessRestriction = row["RESTRIÇÃO DE ACESSO"]?.toLowerCase().trim() === "sim" || false;
  const archivedDate = parseDate(row["NA PASTA\nARQUIVADO\n(DATA)"]) || null;
  const statusFromRow = row["STATUS"]?.trim();
  const status = statusFromRow || calculateStatus({
    analysis_start_date: analysisStartDate,
    review_submission_date: reviewSubmissionDate,
    review_return_date: reviewReturnDate,
    archived_date: archivedDate
  });
  const networkFolder = row["PASTA NA REDE"]?.trim() || null;

  const data = {
    process_number: processNumber,
    organization_id
  };

  // Adiciona campos não-nulos ou campos que devem ser atualizados mesmo que vazios
  if (consultant !== null) data.consultant = consultant;
  if (location !== null) data.location = location;
  if (entryDate !== null) data.entry_date = entryDate;
  if (matterObject !== null) data.matter_object = matterObject;
  if (urgencyRequest) data.urgency_request = urgencyRequest;
  if (distributionDate !== null) data.distribution_date = distributionDate;
  if (responsibleUserId !== null) data.responsible_user_id = responsibleUserId;
  if (responsibleName !== null) data.responsible_user_name = responsibleName;
  if (analysisStartDate !== null) data.analysis_start_date = analysisStartDate;
  if (observations !== null) data.observations = observations;
  if (reviewSubmissionDate !== null) data.review_submission_date = reviewSubmissionDate;
  if (reviewReturnDate !== null) data.review_return_date = reviewReturnDate;
  if (accessRestriction) data.access_restriction = accessRestriction;
  if (archivedDate !== null) data.archived_date = archivedDate;
  if (status !== null) data.status = status;
  if (networkFolder !== null) data.network_folder = networkFolder;

  return data;
}

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  dateStr = dateStr.trim();
  const parts = dateStr.split('/');
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
  return null;
}

function calculateStatus(data) {
  if (data.archived_date) return 'Na pasta';
  if (data.review_return_date) return 'Para revisão';
  if (data.review_submission_date) return 'Em revisão';
  if (data.analysis_start_date) return 'Em elaboração';
  return 'Pendente';
}