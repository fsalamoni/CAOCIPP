import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

interface OrgEntity {
  id: string;
  name: string;
  [key: string]: any;
}

interface UserEntity {
  id: string;
  email: string;
  full_name: string;
}

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
  const consultasCao = createClientFromRequest(req);
  const user = await consultasCao.auth.me() as UserEntity | null;

  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { invite_code } = await req.json();

  if (!invite_code) {
    return Response.json({ error: 'Código de convite é obrigatório' }, { status: 400 });
  }

  // Buscar organização pelo código de convite
  const organizations = await consultasCao.entities.Organization.filter({
    invite_code: invite_code.toUpperCase()
  }) as OrgEntity[];

  if (organizations.length === 0) {
    return Response.json({ error: 'Código de convite inválido' }, { status: 404 });
  }

  const organization = organizations[0];

  // Verificar se usuário já é membro
  const existingMembership = await consultasCao.entities.UserOrganization.filter({
    user_id: user.id,
    organization_id: organization.id
  });

  if (existingMembership.length > 0) {
    return Response.json({ error: 'Você já é membro desta organização' }, { status: 400 });
  }

  // Adicionar usuário como membro
  await consultasCao.entities.UserOrganization.create({
    user_id: user.id,
    user_email: user.email,
    user_name: user.full_name,
    organization_id: organization.id,
    role: "member",
    function: ""
  });

  // Criar log de auditoria
  await consultasCao.entities.AuditLog.create({
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