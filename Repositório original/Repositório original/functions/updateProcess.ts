import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

interface ProcessEntity {
  id: string;
  organization_id: string;
  status: string;
  process_number: string;
  responsible_user_id?: string;
  responsible_user_name?: string;
  archived_date?: string | null;
  review_return_date?: string | null;
  review_submission_date?: string | null;
  analysis_start_date?: string | null;
  distribution_date?: string | null;
  [key: string]: any;
}

interface UserEntity {
  id: string;
  full_name: string;
}

// Função para calcular o status
function calculateStatus(processData: Partial<ProcessEntity>): string {
  if (processData.archived_date) return "Na pasta";
  if (processData.review_return_date) return "Para revisão";
  if (processData.review_submission_date) return "Em revisão";
  if (processData.analysis_start_date) return "Em elaboração";
  if (processData.distribution_date) return "Pendente";
  return "Em triagem";
}

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
  const consultasCao = createClientFromRequest(req);
  const user = await consultasCao.auth.me() as UserEntity | null;

  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { process_id, updates } = await req.json();

  // Buscar processo existente
  const existingProcesses = await consultasCao.entities.Process.filter({ id: process_id }) as ProcessEntity[];

  if (existingProcesses.length === 0) {
    return Response.json({ error: 'Processo não encontrado' }, { status: 404 });
  }

  const existingProcess = existingProcesses[0];

  // Verificar se usuário pertence à organização
  const membership = await consultasCao.entities.UserOrganization.filter({
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
  const updatedProcess = await consultasCao.asServiceRole.entities.Process.update(process_id, {
    ...updates,
    status: newStatus
  });

  // Criar log de auditoria
  await consultasCao.asServiceRole.entities.AuditLog.create({
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
    await consultasCao.asServiceRole.entities.Notification.create({
      user_id: updates.responsible_user_id,
      organization_id: existingProcess.organization_id,
      process_id: process_id,
      type: "process_assigned",
      title: "Processo atribuído a você",
      message: `Você foi atribuído ao processo ${existingProcess.process_number}`,
      read: false
    });

    // Log de mudança de responsável
    await consultasCao.asServiceRole.entities.AuditLog.create({
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
    await consultasCao.asServiceRole.entities.Notification.create({
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