import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Flag, ShieldAlert, Info, CheckCircle2 } from 'lucide-react';
import {
    OPTIONAL_FLAG_LIST,
    INTEGRATED_FLAG_LIST,
} from '@/constants/featureFlags';
import { useFeatureFlags } from '@/lib/FeatureFlagsContext';
import { setFeatureFlag } from '@/services/platformService';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

const RISK_META = {
    low: { label: 'Baixo risco', className: 'bg-emerald-100 text-emerald-700' },
    medium: { label: 'Risco médio', className: 'bg-amber-100 text-amber-700' },
    high: { label: 'Alto risco', className: 'bg-red-100 text-red-700' },
};

export default function FeatureFlagsPanel() {
    const { flags } = useFeatureFlags();
    const [saving, setSaving] = useState(null); // flagKey em salvamento

    const handleToggle = async (flagKey, current) => {
        const next = !current;
        setSaving(flagKey);
        try {
            await setFeatureFlag(flagKey, next);
            toast.success(
                next ? 'Funcionalidade habilitada.' : 'Funcionalidade desabilitada.'
            );
            // O estado atualiza sozinho via onSnapshot do FeatureFlagsProvider.
        } catch (err) {
            logger.error('Falha ao alterar flag:', err);
            toast.error('Não foi possível alterar. Tente novamente.');
        } finally {
            setSaving(null);
        }
    };

    // Categorias que ainda têm ao menos uma flag opcional (toggle).
    const optionalCategories = [
        ...new Set(OPTIONAL_FLAG_LIST.map((f) => f.category)),
    ];

    // Integradas agrupadas por categoria (somente leitura).
    const integratedCategories = [
        ...new Set(INTEGRATED_FLAG_LIST.map((f) => f.category)),
    ];

    return (
        <div className="space-y-6">
            <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription className="text-sm">
                    A maior parte das funcionalidades já foi <strong>integrada
                    permanentemente</strong> ao produto — elas ficam sempre ativas e não
                    aparecem aqui para ligar/desligar. Abaixo ficam apenas as
                    funcionalidades <strong>opcionais</strong>, que você pode ligar ou
                    desligar a qualquer momento.
                </AlertDescription>
            </Alert>

            {/* --- Funcionalidades opcionais (toggle) --- */}
            {optionalCategories.map((category) => {
                const flagsInCategory = OPTIONAL_FLAG_LIST.filter(
                    (f) => f.category === category
                );
                return (
                    <Card key={category}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Flag className="w-4 h-4" /> {category}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {flagsInCategory.map((flag) => {
                                const enabled = Boolean(flags?.[flag.key]);
                                const risk = RISK_META[flag.risk] || RISK_META.low;
                                return (
                                    <div
                                        key={flag.key}
                                        className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-medium text-slate-900 dark:text-white">
                                                    {flag.label}
                                                </span>
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-[10px] ${risk.className}`}
                                                >
                                                    {flag.risk === 'high' && (
                                                        <ShieldAlert className="w-3 h-3 mr-1" />
                                                    )}
                                                    {risk.label}
                                                </Badge>
                                                {enabled && (
                                                    <Badge className="text-[10px] bg-indigo-600">
                                                        Ativa
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                {flag.description}
                                            </p>
                                        </div>
                                        <Switch
                                            checked={enabled}
                                            disabled={saving === flag.key}
                                            onCheckedChange={() =>
                                                handleToggle(flag.key, enabled)
                                            }
                                        />
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                );
            })}

            {/* --- Integradas ao produto (somente leitura) --- */}
            {INTEGRATED_FLAG_LIST.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            Integradas ao produto (permanentes)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Estas funcionalidades fazem parte do produto e estão sempre
                            ativas. Não dependem mais de chave e não podem ser desligadas.
                        </p>
                        {integratedCategories.map((category) => {
                            const flagsInCategory = INTEGRATED_FLAG_LIST.filter(
                                (f) => f.category === category
                            );
                            return (
                                <div key={category}>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                                        {category}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {flagsInCategory.map((flag) => (
                                            <Badge
                                                key={flag.key}
                                                variant="secondary"
                                                className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 gap-1"
                                                title={flag.description}
                                            >
                                                <CheckCircle2 className="w-3 h-3" />
                                                {flag.label}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
