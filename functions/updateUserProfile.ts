import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

interface UserUpdateData {
  platform_name?: string;
  function?: string;
  notification_email?: string;
}

interface UserEntity {
  id: string;
  email: string;
  full_name: string;
  platform_name?: string;
  function?: string;
  notification_email?: string;
  created_date?: string;
  [key: string]: any;
}

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
  try {
    const consultasCao = createClientFromRequest(req);
    const user = await consultasCao.auth.me() as UserEntity | null;

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { platform_name, function: userFunction, notification_email } = body;

    // Primeiro, tenta atualizar via auth.updateMe
    const updateData: UserUpdateData = {};
    if (platform_name !== undefined) updateData.platform_name = platform_name;
    if (userFunction !== undefined) updateData.function = userFunction;
    if (notification_email !== undefined) updateData.notification_email = notification_email;

    // Atualiza o usuário
    await consultasCao.auth.updateMe(updateData);

    // Aguarda um pouco para garantir propagação
    await new Promise(resolve => setTimeout(resolve, 500));

    // Recarrega para confirmar que foi salvo
    const updatedUser = await consultasCao.auth.me() as UserEntity;

    console.log('✅ Perfil atualizado (Consultas CAO):', {
      id: updatedUser.id,
      platform_name: updatedUser.platform_name,
      function: updatedUser.function,
      notification_email: updatedUser.notification_email
    });

    return Response.json({
      success: true,
      user: {
        id: updatedUser.id,
        platform_name: updatedUser.platform_name,
        email: updatedUser.email,
        function: updatedUser.function,
        notification_email: updatedUser.notification_email,
        created_date: updatedUser.created_date
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro ao atualizar perfil:', errorMessage);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
});