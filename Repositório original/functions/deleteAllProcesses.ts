import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
    const { organization_id } = body;

    if (!organization_id) {
      return Response.json({ error: 'organization_id é obrigatório' }, { status: 400 });
    }

    // Buscar todos os processos da organização
    const processes = await consultasCao.entities.Process.filter({ organization_id }) as ProcessEntity[];
    console.log(`Deletando ${processes.length} processos (Consultas CAO)...`);

    // Deletar em lotes
    for (let i = 0; i < processes.length; i += 50) {
      const batch = processes.slice(i, i + 50);
      for (const process of batch) {
        await consultasCao.entities.Process.delete(process.id);
      }
      console.log(`${i + batch.length}/${processes.length} deletados`);
    }

    return Response.json({
      success: true,
      deletedCount: processes.length,
      message: `${processes.length} processos deletados com sucesso`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Erro ao deletar processos:', errorMessage);
    return Response.json({
      error: errorMessage
    }, { status: 500 });
  }
});