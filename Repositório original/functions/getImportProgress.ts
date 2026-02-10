import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

interface ImportProgress {
  total: number;
  processed: number;
  created: number;
  updated: number;
  errors: number;
  status: string;
  message: string;
}

// Armazenar referência global para compartilhar entre requisições
const globalProgressMap = (globalThis as any).importProgressMap || new Map<string, ImportProgress>();
if (!(globalThis as any).importProgressMap) {
  (globalThis as any).importProgressMap = globalProgressMap;
}

// @ts-ignore: Deno is defined in Deno environment
Deno.serve(async (req: Request) => {
  try {
    const consultasCao = createClientFromRequest(req);
    const user = await consultasCao.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return Response.json({ error: 'sessionId é obrigatório' }, { status: 400 });
    }

    const progress = (globalThis as any).importProgressMap.get(sessionId);

    if (!progress) {
      return Response.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }

    return Response.json(progress);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return Response.json({ error: errorMessage }, { status: 500 });
  }
});

export function setProgress(sessionId: string, progress: ImportProgress) {
  if (!(globalThis as any).importProgressMap) {
    (globalThis as any).importProgressMap = new Map<string, ImportProgress>();
  }
  (globalThis as any).importProgressMap.set(sessionId, progress);
}

export function getProgress(sessionId: string): ImportProgress | null {
  if (!(globalThis as any).importProgressMap) {
    return null;
  }
  return (globalThis as any).importProgressMap.get(sessionId) || null;
}