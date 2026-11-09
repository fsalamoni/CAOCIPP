import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Os quatro passos para a equipe conseguir trabalhar, a partir do estado do órgão. */
export function passosConfiguracao(estado) {
    const unidades = (estado.unidades || []).filter((u) => u.ativa !== false);
    return [
        { aba: 'unidades', feito: unidades.length > 0, titulo: 'Criar as unidades', dica: 'A Secretaria já vem criada; adicione o Gabinete e, se houver, a Assessoria.' },
        { aba: 'unidades', feito: unidades.some((u) => (u.membros_uids || []).length > 0), titulo: 'Montar a equipe de cada unidade', dica: 'Insira membros do órgão ou convide por e-mail. Sem lotação, ninguém vê processos.' },
        { aba: 'ritos', feito: (estado.ritos || []).some((r) => r.ativo), titulo: 'Ter um rito ativo', dica: 'Parta de um modelo pronto ou importe de planilha, Word, PDF ou diagrama.' },
        { aba: 'tipos', feito: (estado.tipos || []).some((t) => t.ativo), titulo: 'Criar o primeiro tipo de processo', dica: 'O tipo escolhe o rito, o sigilo e a unidade de entrada para quem autua.' },
    ];
}

/** Indicador permanente "Configuração: N de 4" com o que falta, linkado à aba certa. */
export default function PrimeirosPassos({ estado, onIr }) {
    const passos = passosConfiguracao(estado);
    const feitos = passos.filter((p) => p.feito).length;
    const completo = feitos === passos.length;
    const [aberto, setAberto] = useState(!completo);
    return (
        <section aria-label="Primeiros passos" className={`rounded-lg border p-3 ${completo ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30' : 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30'}`}>
            <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="w-full flex items-center gap-3 text-left">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Configuração: {feitos} de {passos.length}</span>
                <span className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={passos.length} aria-valuenow={feitos}>
                    <span className={`block h-full ${completo ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${(feitos / passos.length) * 100}%` }} />
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-300 hidden sm:inline">{completo ? 'A equipe já consegue trabalhar.' : `Falta${passos.length - feitos > 1 ? 'm' : ''} ${passos.length - feitos} passo${passos.length - feitos > 1 ? 's' : ''}`}</span>
                {aberto ? <ChevronUp className="w-4 h-4" aria-hidden /> : <ChevronDown className="w-4 h-4" aria-hidden />}
            </button>
            {aberto && (
                <ol className="mt-3 grid sm:grid-cols-2 gap-2">
                    {passos.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 rounded-md bg-white/70 dark:bg-slate-900/60 p-2">
                            {p.feito ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" aria-hidden /> : <Circle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" aria-hidden />}
                            <div className="min-w-0 flex-1">
                                <p className={`text-sm ${p.feito ? 'text-slate-600 dark:text-slate-300 line-through' : 'font-medium text-slate-900 dark:text-white'}`}>{i + 1}. {p.titulo}</p>
                                {!p.feito && <p className="text-xs text-slate-600 dark:text-slate-400">{p.dica}</p>}
                            </div>
                            {!p.feito && <Button size="sm" variant="outline" onClick={() => onIr(p.aba)}>Ir</Button>}
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
