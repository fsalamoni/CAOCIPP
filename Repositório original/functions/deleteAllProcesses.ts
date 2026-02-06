import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { organization_id } = body;

    if (!organization_id) {
      return Response.json({ error: 'organization_id é obrigatório' }, { status: 400 });
    }

    // Buscar todos os processos da organização
    const processes = await base44.entities.Process.filter({ organization_id });
    console.log(`Deletando ${processes.length} processos...`);

    // Deletar em lotes
    for (let i = 0; i < processes.length; i += 50) {
      const batch = processes.slice(i, i + 50);
      for (const process of batch) {
        await base44.entities.Process.delete(process.id);
      }
      console.log(`${i + batch.length}/${processes.length} deletados`);
    }

    return Response.json({
      success: true,
      deleted: processes.length,
      message: `${processes.length} processos deletados com sucesso`
    });

  } catch (error) {
    console.error('Erro ao deletar processos:', error);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});