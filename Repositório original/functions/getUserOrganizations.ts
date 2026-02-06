import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  // Buscar todas as organizações do usuário
  const userOrgs = await base44.entities.UserOrganization.filter({
    user_id: user.id
  });

  // Buscar detalhes de cada organização
  const organizationsData = [];
  
  for (const userOrg of userOrgs) {
    const orgData = await base44.entities.Organization.filter({
      id: userOrg.organization_id
    });
    
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