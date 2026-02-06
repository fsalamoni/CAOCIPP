import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { membership_id, organization_id } = await req.json();

  // Verificar se usuário é criador da organização
  const userMembership = await base44.entities.UserOrganization.filter({
    user_id: user.id,
    organization_id: organization_id,
    role: "creator"
  });

  if (userMembership.length === 0) {
    return Response.json({ error: 'Apenas o criador pode remover membros' }, { status: 403 });
  }

  // Buscar dados do membro a ser removido
  const memberToRemove = await base44.entities.UserOrganization.filter({
    id: membership_id
  });

  if (memberToRemove.length === 0) {
    return Response.json({ error: 'Membro não encontrado' }, { status: 404 });
  }

  // Não permitir remover o criador
  if (memberToRemove[0].role === "creator") {
    return Response.json({ error: 'Não é possível remover o criador da organização' }, { status: 400 });
  }

  // Remover membro
  await base44.asServiceRole.entities.UserOrganization.delete(membership_id);

  // Criar log de auditoria
  await base44.asServiceRole.entities.AuditLog.create({
    organization_id: organization_id,
    user_id: user.id,
    user_name: user.full_name,
    action: "REMOVE_MEMBER",
    details: {
      removed_user: memberToRemove[0].user_name
    }
  });

  return Response.json({ success: true, message: 'Membro removido com sucesso' });
});