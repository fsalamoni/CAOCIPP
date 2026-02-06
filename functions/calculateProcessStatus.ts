import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função auxiliar para calcular o status de um processo
export function calculateStatus(process) {
  if (process.archived_date) return "Na pasta";
  if (process.review_return_date) return "Para revisão";
  if (process.review_submission_date) return "Em revisão";
  if (process.analysis_start_date) return "Em elaboração";
  if (process.distribution_date) return "Pendente";
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const body = await req.json();
    const { process_id, process_data, organization_id } = body;

    // Se foi passado organization_id, recalcular todos os processos da organização
    if (organization_id) {
      const processes = await base44.asServiceRole.entities.Process.filter({ organization_id });
      
      for (const process of processes) {
        const newStatus = calculateStatus(process);
        if (process.status !== newStatus) {
          await base44.asServiceRole.entities.Process.update(process.id, {
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

    const updatedProcess = await base44.asServiceRole.entities.Process.update(process_id, {
      ...process_data,
      status: newStatus
    });

    await base44.asServiceRole.entities.AuditLog.create({
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
    console.error('Erro ao calcular status:', error);
    return Response.json({ 
      error: error.message || 'Erro ao calcular status',
      details: error.toString()
    }, { status: 500 });
  }
});