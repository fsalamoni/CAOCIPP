import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

interface OrgEntity {
  id: string;
  name: string;
  invite_code: string;
  [key: string]: any;
}

interface UserEntity {
  id: string;
  email: string;
  full_name: string;
}

// Função para gerar código de convite único
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
  const consultasCao = createClientFromRequest(req);
  const user = await consultasCao.auth.me() as UserEntity | null;

  if (!user) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { name, description } = await req.json();

  if (!name) {
    return Response.json({ error: 'Nome da organização é obrigatório' }, { status: 400 });
  }

  // Gerar código de convite único
  let inviteCode = generateInviteCode();
  let isUnique = false;

  // Verificar se o código já existe
  while (!isUnique) {
    const existing = await consultasCao.entities.Organization.filter({ invite_code: inviteCode }) as OrgEntity[];
    if (existing.length === 0) {
      isUnique = true;
    } else {
      inviteCode = generateInviteCode();
    }
  }

  // Criar organização
  const organization = await consultasCao.entities.Organization.create({
    name,
    description: description || '',
    invite_code: inviteCode
  });

  // Adicionar criador como membro com role "creator"
  await consultasCao.entities.UserOrganization.create({
    user_id: user.id,
    user_email: user.email,
    user_name: user.full_name,
    organization_id: organization.id,
    role: "creator",
    function: "Criador"
  });

  // Criar log de auditoria
  await consultasCao.entities.AuditLog.create({
    organization_id: organization.id,
    user_id: user.id,
    user_name: user.full_name,
    action: "CREATE_ORGANIZATION",
    details: {
      organization_name: name
    }
  });

  return Response.json({
    success: true,
    organization,
    message: 'Organização criada com sucesso!'
  });
});