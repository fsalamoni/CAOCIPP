import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

interface UserOrgEntity {
  organization_id: string;
  role: string;
  function: string;
  created_date: string;
  [key: string]: any;
}

interface OrgEntity {
  id: string;
  name: string;
  [key: string]: any;
}

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
  const consultasCao = createClientFromRequest(req);
  const user = await consultasCao.auth.me();

  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  // Buscar todas as organizações do usuário
  const userOrgs = await consultasCao.entities.UserOrganization.filter({
    user_id: user.id
  }) as UserOrgEntity[];

  // Buscar detalhes de cada organização
  const organizationsData = [];

  for (const userOrg of userOrgs) {
    const orgData = await consultasCao.entities.Organization.filter({
      id: userOrg.organization_id
    }) as OrgEntity[];

    if (orgData.length > 0) {
      organizationsData.push({
        ...orgData[0],
        userRole: userOrg.role,
        userFunction: userOrg.function,
        joined_at: userOrg.created_date
      });
    }
  }

  return Response.json({
    success: true,
    organizations: organizationsData
  });
});