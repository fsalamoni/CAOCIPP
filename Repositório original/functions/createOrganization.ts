import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função para gerar código de convite único
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

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
    const existing = await base44.entities.Organization.filter({ invite_code: inviteCode });
    if (existing.length === 0) {
      isUnique = true;
    } else {
      inviteCode = generateInviteCode();
    }
  }

  // Criar organização
  const organization = await base44.entities.Organization.create({
    name,
    description: description || '',
    invite_code: inviteCode
  });

  // Adicionar criador como membro com role "creator"
  await base44.entities.UserOrganization.create({
    user_id: user.id,
    user_email: user.email,
    user_name: user.full_name,
    organization_id: organization.id,
    role: "creator",
    function: "Criador"
  });

  // Criar log de auditoria
  await base44.entities.AuditLog.create({
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