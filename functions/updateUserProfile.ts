import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { platform_name, function: userFunction, notification_email } = body;

    // Primeiro, tenta atualizar via auth.updateMe
    const updateData = {};
    if (platform_name !== undefined) updateData.platform_name = platform_name;
    if (userFunction !== undefined) updateData.function = userFunction;
    if (notification_email !== undefined) updateData.notification_email = notification_email;

    // Atualiza o usuário
    await base44.auth.updateMe(updateData);

    // Aguarda um pouco para garantir propagação
    await new Promise(resolve => setTimeout(resolve, 500));

    // Recarrega para confirmar que foi salvo
    const updatedUser = await base44.auth.me();

    console.log('✅ Perfil atualizado:', {
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
    console.error('❌ Erro ao atualizar perfil:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});