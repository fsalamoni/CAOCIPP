import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

interface OrgEntity {
  id: string;
  name: string;
  [key: string]: any;
}

interface ProcessEntity {
  id: string;
  [key: string]: any;
}

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
  try {
    const consultasCao = createClientFromRequest(req);
    const user = await consultasCao.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const { organization_name } = body;

    if (!organization_name) {
      return Response.json({ error: 'organization_name é obrigatório' }, { status: 400 });
    }

    // Buscar organização por nome
    const orgs = await consultasCao.entities.Organization.filter({}) as OrgEntity[];
    const org = orgs.find(o => o.name === organization_name);

    if (!org) {
      return Response.json({ error: `Organização "${organization_name}" não encontrada` }, { status: 404 });
    }

    console.log(`Limpando organização (Consultas CAO): ${org.name} (${org.id})`);

    // Buscar e deletar todos os processos
    const processes = await consultasCao.entities.Process.filter({ organization_id: org.id }) as ProcessEntity[];
    console.log(`Total de processos para deletar: ${processes.length}`);

    let deleted = 0;
    for (let i = 0; i < processes.length; i += 10) {
      const batch = processes.slice(i, i + 10);
      for (const process of batch) {
        await consultasCao.entities.Process.delete(process.id);
        deleted++;
      }
      console.log(`${deleted}/${processes.length} deletados`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return Response.json({
      success: true,
      organization: org.name,
      deletedCount: processes.length,
      message: `✅ ${processes.length} processos deletados com sucesso de "${org.name}"`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Erro (Clean Org Data):', errorMessage);
    return Response.json({
      error: errorMessage
    }, { status: 500 });
  }
});