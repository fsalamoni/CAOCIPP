import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ImportProgressModal({ open, onClose, progress, isComplete, stats }) {
  const percentage = Math.round((progress.current / Math.max(progress.total, 1)) * 100);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isComplete ? '✅ Importação Concluída' : '📥 Importando Processos'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!isComplete ? (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Progresso</span>
                  <span className="font-semibold text-slate-900">
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
                <div className="text-center text-sm font-semibold text-slate-700">
                  {percentage}%
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-700">{progress.created}</div>
                  <div className="text-xs text-green-600">Criados</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-700">{progress.updated}</div>
                  <div className="text-xs text-blue-600">Atualizados</div>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="text-lg font-bold text-red-700">{progress.errors}</div>
                  <div className="text-xs text-red-600">Erros</div>
                </div>
              </div>

              <div className="text-center text-sm text-slate-500">
                Aguarde a conclusão da importação...
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-green-100 rounded-full p-2 mt-1">
                    <CheckCircle2 className="w-4 h-4 text-green-700" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{stats?.created || 0} processos criados</div>
                    <div className="text-sm text-slate-500">Novos registros adicionados</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-2 mt-1">
                    <CheckCircle2 className="w-4 h-4 text-blue-700" />
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{stats?.updated || 0} processos atualizados</div>
                    <div className="text-sm text-slate-500">Registros existentes substituídos</div>
                  </div>
                </div>

                {stats?.totalErrors > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="bg-red-100 rounded-full p-2 mt-1">
                      <AlertCircle className="w-4 h-4 text-red-700" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{stats.totalErrors} erros</div>
                      <div className="text-sm text-slate-500">Linhas com problemas na importação</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900">
                  {(stats?.created || 0) + (stats?.updated || 0)} / {stats?.total || 0}
                </div>
                <div className="text-sm text-slate-500">processos processados com sucesso</div>
              </div>

              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg font-medium transition-colors"
              >
                Fechar
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}