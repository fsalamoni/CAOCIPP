import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { organization_name } = body;

    if (!organization_name) {
      return Response.json({ error: 'organization_name é obrigatório' }, { status: 400 });
    }

    // Buscar organização por nome
    const orgs = await base44.entities.Organization.filter({});
    const org = orgs.find(o => o.name === organization_name);

    if (!org) {
      return Response.json({ error: `Organização "${organization_name}" não encontrada` }, { status: 404 });
    }

    console.log(`Limpando organização: ${org.name} (${org.id})`);

    // Buscar e deletar todos os processos
    const processes = await base44.entities.Process.filter({ organization_id: org.id });
    console.log(`Total de processos para deletar: ${processes.length}`);

    let deleted = 0;
    for (let i = 0; i < processes.length; i += 5) {
      const batch = processes.slice(i, i + 5);
      for (const process of batch) {
        await base44.entities.Process.delete(process.id);
        deleted++;
      }
      console.log(`${deleted}/${processes.length} deletados`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return Response.json({
      success: true,
      organization: org.name,
      deleted: processes.length,
      message: `✅ ${processes.length} processos deletados com sucesso de "${org.name}"`
    });

  } catch (error) {
    console.error('Erro:', error);
    return Response.json({ 
      error: error.message
    }, { status: 500 });
  }
});