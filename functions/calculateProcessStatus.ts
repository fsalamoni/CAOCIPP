import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

interface ProcessEntity {
  id: string;
  organization_id: string;
  process_number: string;
  status: string | null;
  distribution_date?: string | null;
  analysis_start_date?: string | null;
  review_submission_date?: string | null;
  review_return_date?: string | null;
  archived_date?: string | null;
  [key: string]: any;
}

// Função auxiliar para calcular o status de um processo
export function calculateStatus(process: Partial<ProcessEntity>): string | null {
  if (process.archived_date) return "Na pasta";
  if (process.review_return_date) return "Para revisão";
  if (process.review_submission_date) return "Em revisão";
  if (process.analysis_start_date) return "Em elaboração";
  if (process.distribution_date) return "Pendente";
  return null;
}

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
  const consultasCao = createClientFromRequest(req);

  try {
    const user = await consultasCao.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { process_id, process_data, organization_id } = body;

    // Se foi passado organization_id, recalcular todos os processos da organização
    if (organization_id) {
      const processes = await consultasCao.asServiceRole.entities.Process.filter({ organization_id }) as ProcessEntity[];

      for (const process of processes) {
        const newStatus = calculateStatus(process);
        if (process.status !== newStatus) {
          await consultasCao.asServiceRole.entities.Process.update(process.id, {
            status: newStatus
          });
        }
      }

      return Response.json({
        success: true,
        message: `${processes.length} processos atualizados`
      });
    }

    // Recalcular status de um processo específico
    if (!process_id || !process_data) {
      return Response.json({ error: 'process_id e process_data são obrigatórios' }, { status: 400 });
    }

    const newStatus = calculateStatus(process_data);

    const updatedProcess = await consultasCao.asServiceRole.entities.Process.update(process_id, {
      ...process_data,
      status: newStatus
    }) as ProcessEntity;

    await consultasCao.asServiceRole.entities.AuditLog.create({
      organization_id: updatedProcess.organization_id,
      process_id: process_id,
      user_id: user.id,
      user_name: user.full_name,
      action: "UPDATE_STATUS",
      details: {
        old_status: process_data.status,
        new_status: newStatus
      }
    });

    return Response.json({ success: true, status: newStatus, process: updatedProcess });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Erro ao calcular status:', errorMessage);
    return Response.json({
      error: errorMessage,
      details: error.toString()
    }, { status: 500 });
  }
});