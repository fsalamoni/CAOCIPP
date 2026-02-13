import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

interface UserOrgEntity {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  function: string;
  [key: string]: any;
}

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
  const consultasCao = createClientFromRequest(req);
  const user = await consultasCao.auth.me();

  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { membership_id, new_function, organization_id } = await req.json();

  // Verificar se usuário é criador da organização
  const userMembership = await consultasCao.entities.UserOrganization.filter({
    user_id: user.id,
    organization_id: organization_id,
    role: "creator"
  }) as UserOrgEntity[];

  if (userMembership.length === 0) {
    return Response.json({ error: 'Apenas o criador pode editar funções de membros' }, { status: 403 });
  }

  // Atualizar função do membro
  const updated = await consultasCao.asServiceRole.entities.UserOrganization.update(membership_id, {
    function: new_function
  });

  return Response.json({ success: true, membership: updated });
});