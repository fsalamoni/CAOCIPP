import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { file_url, organization_id, batch_size = 100 } = body;

    if (!file_url || !organization_id) {
      return Response.json({ error: 'file_url e organization_id são obrigatórios' }, { status: 400 });
    }

    console.log(`Iniciando importação em lotes de ${batch_size}...`);

    // Download arquivo JSON
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      throw new Error(`Erro ao baixar arquivo: ${fileResponse.statusText}`);
    }
    
    const fileContent = await fileResponse.text();
    const processes = JSON.parse(fileContent);

    if (!Array.isArray(processes)) {
      throw new Error('Arquivo deve conter um array JSON');
    }

    console.log(`Total de processos no arquivo: ${processes.length}`);

    // Buscar assessores
    const users = await base44.asServiceRole.entities.User.list();
    const userMap = {};
    users.forEach(u => {
      userMap[u.full_name?.toLowerCase()] = u.id;
    });

    let created = 0;
    let updated = 0;
    let errors = [];
    let currentBatch = 0;

    // Processar em lotes
    for (let i = 0; i < processes.length; i += batch_size) {
      currentBatch++;
      const batch = processes.slice(i, Math.min(i + batch_size, processes.length));
      const batchStart = i;
      const batchEnd = Math.min(i + batch_size, processes.length);

      console.log(`\n📦 Lote ${currentBatch}: ${batchStart + 1} a ${batchEnd} (${batch.length} processos)`);

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const rowNum = batchStart + j + 1;

        try {
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

          if (!processNumber) {
            errors.push({ row: rowNum, error: 'Número do processo não informado' });
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
            await base44.entities.Process.update(existingProcesses[0].id, processData);
            updated++;
          } else {
            await base44.entities.Process.create(processData);
            created++;
          }

          // Mostrar progresso a cada 10
          if ((j + 1) % 10 === 0) {
            console.log(`  ✓ ${j + 1}/${batch.length} processados do lote`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          errors.push({ row: rowNum, error: error.message });
          console.error(`❌ Erro na linha ${rowNum}: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      console.log(`✅ Lote ${currentBatch} concluído: ${batch.filter((_, idx) => {
        const processNumber = batch[idx]["PROCESSO SIM\n(NÚMERO)"]?.trim();
        return processNumber;
      }).length} processos`);

      // Aguardar entre lotes para evitar rate limit
      if (i + batch_size < processes.length) {
        console.log('⏳ Aguardando 5 segundos antes do próximo lote...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`\n🎉 Importação finalizada!`);
    console.log(`📊 Total: ${created + updated} / ${processes.length}`);
    console.log(`✅ Criados: ${created}`);
    console.log(`🔄 Atualizados: ${updated}`);
    console.log(`⚠️  Erros: ${errors.length}`);

    return Response.json({
      success: true,
      created,
      updated,
      errors: errors.slice(0, 20), // Retornar apenas os primeiros 20 erros
      totalErrors: errors.length,
      total: processes.length,
      message: `✅ Importação concluída: ${created} criados, ${updated} atualizados, ${errors.length} erros`
    });

  } catch (error) {
    console.error('Erro fatal na importação:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;

  dateStr = dateStr.trim();

  const parts = dateStr.split('/');
  if (parts.length === 3) {
    let month = parseInt(parts[0]);
    let day = parseInt(parts[1]);
    let year = parseInt(parts[2]);

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