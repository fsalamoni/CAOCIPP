import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { invite_code } = await req.json();

  if (!invite_code) {
    return Response.json({ error: 'Código de convite é obrigatório' }, { status: 400 });
  }

  // Buscar organização pelo código de convite
  const organizations = await base44.entities.Organization.filter({ 
    invite_code: invite_code.toUpperCase() 
  });

  if (organizations.length === 0) {
    return Response.json({ error: 'Código de convite inválido' }, { status: 404 });
  }

  const organization = organizations[0];

  // Verificar se usuário já é membro
  const existingMembership = await base44.entities.UserOrganization.filter({
    user_id: user.id,
    organization_id: organization.id
  });

  if (existingMembership.length > 0) {
    return Response.json({ error: 'Você já é membro desta organização' }, { status: 400 });
  }

  // Adicionar usuário como membro
  await base44.entities.UserOrganization.create({
    user_id: user.id,
    user_email: user.email,
    user_name: user.full_name,
    organization_id: organization.id,
    role: "member",
    function: ""
  });

  // Criar log de auditoria
  await base44.entities.AuditLog.create({
    organization_id: organization.id,
    user_id: user.id,
    user_name: user.full_name,
    action: "JOIN_ORGANIZATION",
    details: {
      organization_name: organization.name
    }
  });

  return Response.json({ 
    success: true, 
    organization,
    message: 'Você ingressou na organização com sucesso!'
  });
});