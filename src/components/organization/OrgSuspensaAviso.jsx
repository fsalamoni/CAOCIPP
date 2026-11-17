import React from 'react';
import { PauseCircle } from 'lucide-react';

/**
 * Aviso de órgão suspenso pela administração da plataforma. Os dados do órgão
 * continuam guardados; ninguém do órgão abre nada até a reativação.
 */
export default function OrgSuspensaAviso({ orgs = [] }) {
    if (orgs.length === 0) return null;
    return (
        <div className="space-y-3">
            {orgs.map((o) => (
                <section
                    key={o.id} role="status" aria-label={`${o.name}: órgão suspenso`}
                    className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4"
                >
                    <PauseCircle className="w-5 h-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                    <div className="space-y-1 min-w-0">
                        <h2 className="font-semibold text-slate-900 dark:text-white">{o.bloqueio ? 'Seu acesso ao SIGO está bloqueado' : `${o.name} está suspenso`}</h2>
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                            {o.bloqueio
                                ? 'A administração da plataforma bloqueou o seu acesso. Nenhum dado foi apagado e tudo volta a abrir quando o bloqueio for retirado.'
                                : 'A administração da plataforma suspendeu o acesso a este órgão. Os dados continuam guardados e voltam a abrir quando o órgão for reativado.'}
                        </p>
                        {o.motivo && <p className="text-sm text-slate-700 dark:text-slate-200"><span className="font-medium">Motivo:</span> {o.motivo}</p>}
                    </div>
                </section>
            ))}
        </div>
    );
}
