import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função para calcular o status
function calculateStatus(processData) {
  if (processData.archived_date) return "Na pasta";
  if (processData.review_return_date) return "Para revisão";
  if (processData.review_submission_date) return "Em revisão";
  if (processData.analysis_start_date) return "Em elaboração";
  if (processData.distribution_date) return "Pendente";
  return "Em triagem";
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { process_id, updates } = await req.json();

  // Buscar processo existente
  const existingProcesses = await base44.entities.Process.filter({ id: process_id });
  
  if (existingProcesses.length === 0) {
    return Response.json({ error: 'Processo não encontrado' }, { status: 404 });
  }

  const existingProcess = existingProcesses[0];

  // Verificar se usuário pertence à organização
  const membership = await base44.entities.UserOrganization.filter({
    user_id: user.id,
    organization_id: existingProcess.organization_id
  });

  if (membership.length === 0) {
    return Response.json({ error: 'Você não pertence a esta organização' }, { status: 403 });
  }

  // Calcular novo status
  const mergedData = { ...existingProcess, ...updates };
  const newStatus = calculateStatus(mergedData);
  const oldStatus = existingProcess.status;

  // Atualizar processo
  const updatedProcess = await base44.asServiceRole.entities.Process.update(process_id, {
    ...updates,
    status: newStatus
  });

  // Criar log de auditoria
  await base44.asServiceRole.entities.AuditLog.create({
    organization_id: existingProcess.organization_id,
    process_id: process_id,
    user_id: user.id,
    user_name: user.full_name,
    action: "UPDATE_PROCESS",
    details: {
      updated_fields: Object.keys(updates),
      old_status: oldStatus,
      new_status: newStatus
    }
  });

  // Se o responsável mudou, criar notificação
  if (updates.responsible_user_id && updates.responsible_user_id !== existingProcess.responsible_user_id) {
    await base44.asServiceRole.entities.Notification.create({
      user_id: updates.responsible_user_id,
      organization_id: existingProcess.organization_id,
      process_id: process_id,
      type: "process_assigned",
      title: "Processo atribuído a você",
      message: `Você foi atribuído ao processo ${existingProcess.process_number}`,
      read: false
    });

    // Log de mudança de responsável
    await base44.asServiceRole.entities.AuditLog.create({
      organization_id: existingProcess.organization_id,
      process_id: process_id,
      user_id: user.id,
      user_name: user.full_name,
      action: "ASSIGN_RESPONSIBLE",
      details: {
        old_responsible: existingProcess.responsible_user_name,
        new_responsible: updates.responsible_user_name
      }
    });
  }

  // Se status mudou, notificar
  if (newStatus !== oldStatus) {
    await base44.asServiceRole.entities.Notification.create({
      user_id: existingProcess.responsible_user_id || user.id,
      organization_id: existingProcess.organization_id,
      process_id: process_id,
      type: "status_changed",
      title: "Status do processo alterado",
      message: `Processo ${existingProcess.process_number}: ${oldStatus} → ${newStatus}`,
      read: false
    });
  }

  return Response.json({ success: true, process: updatedProcess });
});