import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { CreateProcessSchema, validateData, sanitizeObject } from './validation.js';

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

  // HIGH-005 FIX: Validate and sanitize input
  let processData;
  try {
    processData = await req.json();
  } catch (error) {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // Sanitize all string fields
  processData = sanitizeObject(processData);

  // Validate schema
  const validation = validateData(processData, CreateProcessSchema);
  if (!validation.valid) {
    return Response.json({
      error: 'Dados inválidos',
      details: validation.errors
    }, { status: 422 });
  }

  // Verificar se usuário pertence à organização
  const membership = await base44.entities.UserOrganization.filter({
    user_id: user.id,
    organization_id: processData.organization_id
  });

  if (membership.length === 0) {
    return Response.json({ error: 'Você não pertence a esta organização' }, { status: 403 });
  }

  // Calcular status automaticamente
  const status = calculateStatus(processData);

  // Criar processo
  const process = await base44.entities.Process.create({
    ...processData,
    status
  });

  // Criar log de auditoria
  await base44.entities.AuditLog.create({
    organization_id: process.organization_id,
    process_id: process.id,
    user_id: user.id,
    user_name: user.full_name,
    action: "CREATE_PROCESS",
    details: {
      process_number: process.process_number,
      consultant: process.consultant
    }
  });

  // Se houver responsável atribuído, criar notificação
  if (processData.responsible_user_id && processData.responsible_user_id !== user.id) {
    await base44.asServiceRole.entities.Notification.create({
      user_id: processData.responsible_user_id,
      organization_id: process.organization_id,
      process_id: process.id,
      type: "process_assigned",
      title: "Novo processo atribuído",
      message: `Você foi atribuído ao processo ${process.process_number} - ${process.consultant}`,
      read: false
    });
  }

  // Se for urgente, notificar todos os membros da organização
  if (processData.urgency_request) {
    const members = await base44.asServiceRole.entities.UserOrganization.filter({
      organization_id: process.organization_id
    });

    for (const member of members) {
      if (member.user_id !== user.id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: member.user_id,
          organization_id: process.organization_id,
          process_id: process.id,
          type: "urgent_process",
          title: "Processo urgente criado",
          message: `Novo processo urgente: ${process.process_number} - ${process.consultant}`,
          read: false
        });
      }
    }
  }

  return Response.json({ success: true, process });
});