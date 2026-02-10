import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

interface UserOrgEntity {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  user_name: string;
  [key: string]: any;
}

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
  const consultasCao = createClientFromRequest(req);
  const user = await consultasCao.auth.me();

  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { membership_id, organization_id } = await req.json();

  // Verificar se usuário é criador da organização
  const userMembership = await consultasCao.entities.UserOrganization.filter({
    user_id: user.id,
    organization_id: organization_id,
    role: "creator"
  }) as UserOrgEntity[];

  if (userMembership.length === 0) {
    return Response.json({ error: 'Apenas o criador pode remover membros' }, { status: 403 });
  }

  // Buscar dados do membro a ser removido
  const memberToRemove = await consultasCao.entities.UserOrganization.filter({
    id: membership_id
  }) as UserOrgEntity[];

  if (memberToRemove.length === 0) {
    return Response.json({ error: 'Membro não encontrado' }, { status: 404 });
  }

  // Não permitir remover o criador
  if (memberToRemove[0].role === "creator") {
    return Response.json({ error: 'Não é possível remover o criador da organização' }, { status: 400 });
  }

  // Remover membro
  await consultasCao.asServiceRole.entities.UserOrganization.delete(membership_id);

  // Criar log de auditoria
  await consultasCao.asServiceRole.entities.AuditLog.create({
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