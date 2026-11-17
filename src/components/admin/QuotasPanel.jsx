import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, AlertCircle, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getPlatformQuotas, setPlatformQuota } from '@/services/platformService';

const fmt = (n) => new Intl.NumberFormat('pt-BR').format(n || 0);

/** Barra de uso: maior valor de hoje contra o limite. */
function Uso({ uso, limite, unidade }) {
    if (!uso) return <p className="text-sm text-slate-600 dark:text-slate-300">Conferido a cada importação; não há uso acumulado.</p>;
    const pct = limite ? Math.min(100, Math.round((uso.maior / limite) * 100)) : 0;
    const perto = pct >= 80;
    return (
        <div className="space-y-1.5">
            <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                <span className="text-slate-700 dark:text-slate-200">
                    Maior uso hoje: <span className="font-semibold">{fmt(uso.maior)} {uso.maior === 1 ? unidade.replace(/s$/, '') : unidade}</span>{uso.quem ? ` (${uso.quem})` : ''}
                </span>
                <span className={perto ? 'font-medium text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'}>{pct}% do limite</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Uso do limite">
                <div className={`h-full rounded-full ${perto ? 'bg-amber-500' : 'bg-indigo-600 dark:bg-indigo-400'}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

/** Cotas e limites: todas valem, conferidas no servidor. */
export default function QuotasPanel() {
    const { data, isLoading, error, refetch } = useQuery({ queryKey: ['platformQuotas'], queryFn: getPlatformQuotas });
    const [drafts, setDrafts] = useState({});
    const [salvando, setSalvando] = useState(null);

    if (isLoading) {
        return <div role="status" className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden />Carregando cotas...</div>;
    }
    if (error || !data) {
        return (
            <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center text-red-700 dark:text-red-400">
                <AlertCircle className="w-6 h-6" aria-hidden />{error?.message || 'Erro ao carregar cotas.'}
                <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
            </div>
        );
    }

    const salvar = async (def) => {
        const value = Number(drafts[def.key]);
        if (!Number.isFinite(value) || value < def.min || value > def.max) {
            toast.error(`${def.label}: use um valor entre ${fmt(def.min)} e ${fmt(def.max)}.`);
            return;
        }
        setSalvando(def.key);
        try {
            await setPlatformQuota(def.key, value);
            toast.success(`${def.label}: ${fmt(value)} ${def.unit}. Vale em até 1 minuto.`);
            setDrafts((d) => { const n = { ...d }; delete n[def.key]; return n; });
            await refetch();
        } catch (e) {
            toast.error(e?.message || 'Não foi possível salvar.');
        } finally {
            setSalvando(null);
        }
    };

    return (
        <div className="space-y-4">
            <p className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                Todas as cotas abaixo valem: o servidor confere cada uma antes de aceitar a ação. Quem passa do limite vê uma mensagem pedindo para falar com a administração.
            </p>
            {data.definitions.map((def) => {
                const atual = data.quotas[def.key];
                const valor = drafts[def.key] ?? String(atual);
                const mudou = Number(valor) !== atual;
                return (
                    <section key={def.key} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
                        <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white">{def.label}</h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300">{def.description}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Vale em: {def.onde}. Padrão: {fmt(def.default)} {def.unit}.</p>
                        </div>
                        <Uso uso={data.uso?.[def.key]} limite={atual} unidade={def.unit} />
                        <div className="flex flex-wrap items-end gap-2">
                            <div className="space-y-1">
                                <Label htmlFor={`cota-${def.key}`}>Limite ({def.unit})</Label>
                                <Input
                                    id={`cota-${def.key}`} type="number" inputMode="numeric" min={def.min} max={def.max} value={valor}
                                    onChange={(e) => setDrafts((d) => ({ ...d, [def.key]: e.target.value }))} className="w-36"
                                />
                            </div>
                            <Button onClick={() => salvar(def)} disabled={!mudou || salvando === def.key} className="gap-1.5">
                                {salvando === def.key ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Save className="w-4 h-4" aria-hidden />}Salvar
                            </Button>
                            <span className="text-xs text-slate-500 dark:text-slate-400 pb-2">Entre {fmt(def.min)} e {fmt(def.max)}.</span>
                        </div>
                    </section>
                );
            })}
            {data.updatedAt && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Última alteração em {new Date(data.updatedAt).toLocaleString('pt-BR')}{data.updatedBy ? ` por ${data.updatedBy}` : ''}.</p>
            )}
        </div>
    );
}
