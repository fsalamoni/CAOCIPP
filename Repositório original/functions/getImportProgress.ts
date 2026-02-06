import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const progressMap = new Map();

// Armazenar referência global para compartilhar entre requisições
if (!globalThis.importProgressMap) {
  globalThis.importProgressMap = new Map();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return Response.json({ error: 'sessionId é obrigatório' }, { status: 400 });
    }

    const progress = globalThis.importProgressMap.get(sessionId);
    
    if (!progress) {
      return Response.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }

    return Response.json(progress);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

export function setProgress(sessionId, progress) {
  if (!globalThis.importProgressMap) {
    globalThis.importProgressMap = new Map();
  }
  globalThis.importProgressMap.set(sessionId, progress);
}

export function getProgress(sessionId) {
  if (!globalThis.importProgressMap) {
    return null;
  }
  return globalThis.importProgressMap.get(sessionId);
}