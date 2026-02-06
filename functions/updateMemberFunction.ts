import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { membership_id, new_function, organization_id } = await req.json();

  // Verificar se usuário é criador da organização
  const userMembership = await base44.entities.UserOrganization.filter({
    user_id: user.id,
    organization_id: organization_id,
    role: "creator"
  });

  if (userMembership.length === 0) {
    return Response.json({ error: 'Apenas o criador pode editar funções de membros' }, { status: 403 });
  }

  // Atualizar função do membro
  const updated = await base44.asServiceRole.entities.UserOrganization.update(membership_id, {
    function: new_function
  });

  return Response.json({ success: true, membership: updated });
});