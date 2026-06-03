import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Flag, ShieldAlert, Info } from 'lucide-react';
import {
    FEATURE_FLAG_LIST,
    FEATURE_FLAG_CATEGORIES,
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

    return (
        <div className="space-y-6">
            <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription className="text-sm">
                    Todas as novas funcionalidades chegam <strong>desligadas</strong> por
                    padrão — o sistema continua exatamente como está. Ao ligar uma chave,
                    a melhoria correspondente é ativada e pode ser desligada a qualquer
                    momento, voltando 100% ao comportamento anterior.
                </AlertDescription>
            </Alert>

            {FEATURE_FLAG_CATEGORIES.map((category) => {
                const flagsInCategory = FEATURE_FLAG_LIST.filter(
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
                                        className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0"
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
                                            <p className="text-sm text-slate-500 mt-1">
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
        </div>
    );
}
