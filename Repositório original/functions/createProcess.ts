import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { CreateProcessSchema, validateData, sanitizeObject } from './validation.ts';

interface ProcessData {
  organization_id: string;
  process_number: string;
  consultant?: string;
  urgency_request?: boolean;
  responsible_user_id?: string;
  analysis_start_date?: string | null;
  review_submission_date?: string | null;
  review_return_date?: string | null;
  archived_date?: string | null;
  distribution_date?: string | null;
  [key: string]: any;
}

interface UserEntity {
  id: string;
  full_name: string;
}

// Função para calcular o status
function calculateStatus(processData: Partial<ProcessData>): string {
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

  // HIGH-005 FIX: Validate and sanitize input
  let processData: ProcessData;
  try {
    processData = await req.json();
  } catch (error) {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // Sanitize all string fields
  processData = sanitizeObject(processData) as ProcessData;

  // Validate schema
  const validation = validateData(processData, CreateProcessSchema);
  if (!validation.valid) {
    return Response.json({
      error: 'Dados inválidos',
      details: validation.errors
    }, { status: 422 });
  }

  // Verificar se usuário pertence à organização
  const membership = await consultasCao.entities.UserOrganization.filter({
    user_id: user.id,
    organization_id: processData.organization_id
  });

  if (membership.length === 0) {
    return Response.json({ error: 'Você não pertence a esta organização' }, { status: 403 });
  }

  // Calcular status automaticamente
  const status = calculateStatus(processData);

  // Criar processo
  const process = await consultasCao.entities.Process.create({
    ...processData,
    status
  });

  // Criar log de auditoria
  await consultasCao.entities.AuditLog.create({
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
    await consultasCao.asServiceRole.entities.Notification.create({
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
    const members = await consultasCao.asServiceRole.entities.UserOrganization.filter({
      organization_id: process.organization_id
    });

    for (const member of members) {
      if (member.user_id !== user.id) {
        await consultasCao.asServiceRole.entities.Notification.create({
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