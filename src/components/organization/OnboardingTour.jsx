// ============================================================================
// OnboardingTour — tour guiado de primeiro acesso (flag `onboarding_tour`).
// ----------------------------------------------------------------------------
// Mostra, na primeira visita de um usuário a um órgão, um passo a passo curto
// e dispensável apontando a navegação principal (as mesmas abas de
// getOrganizationTabs). Preferência de "já visto" fica em
// preferences.onboardingSeenOrgIds (persistida por usuário, não por órgão —
// cada usuário vê o tour uma vez por órgão que visita).
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { useUserPreferences } from '@/hooks/useFirestore';
import { Compass } from 'lucide-react';

const TAB_DESCRIPTIONS = {
    info: 'Visão geral do órgão: dados gerais, indicadores e atividade recente.',
    kanban: 'Painel visual das Consultas, organizadas por etapa do fluxo de trabalho.',
    processes: 'Lista completa de Consultas, com filtros, busca e exportação.',
    'kanban-expedientes': 'Painel visual dos Expedientes Administrativos, por etapa.',
    expedientes: 'Lista completa de Expedientes, com filtros, busca e exportação.',
    summary: 'Indicadores e gráficos consolidados do órgão.',
    calendar: 'Calendário mensal com as datas relevantes de Consultas e Expedientes.',
    admin: 'Configurações do órgão: membros, permissões, matérias e módulos.',
};

export default function OnboardingTour({ organization, orgTabs = [] }) {
    const enabled = useFlag(FEATURE_FLAGS.ONBOARDING_TOUR.key);
    const { preferences, updatePreferences, isLoading: prefsLoading } = useUserPreferences();
    const [step, setStep] = useState(0);
    const [dismissed, setDismissed] = useState(false);

    const slides = useMemo(
        () => orgTabs.map((tab) => ({
            key: tab.key,
            label: tab.label,
            icon: tab.icon,
            description: TAB_DESCRIPTIONS[tab.key] || `Acesse ${tab.label} pela navegação do órgão.`,
        })),
        [orgTabs]
    );

    const seenOrgIds = preferences?.onboardingSeenOrgIds || [];
    const alreadySeen = seenOrgIds.includes(organization?.id);
    const shouldShow = enabled && !prefsLoading && !dismissed && !alreadySeen && slides.length > 0 && Boolean(organization?.id);

    // Reseta a cada troca de órgão — sem isto, dispensar o tour num órgão
    // suprimiria silenciosamente o tour de QUALQUER outro órgão visitado
    // depois, na mesma sessão (o componente não desmonta ao trocar de órgão).
    useEffect(() => {
        setStep(0);
        setDismissed(false);
    }, [organization?.id]);

    const markSeen = () => {
        setDismissed(true);
        if (!organization?.id) return;
        updatePreferences({ onboardingSeenOrgIds: [...seenOrgIds, organization.id] });
    };

    if (!shouldShow) return null;

    const current = slides[Math.min(step, slides.length - 1)];
    const Icon = current.icon || Compass;
    const isLast = step >= slides.length - 1;

    return (
        <Dialog open onOpenChange={(open) => { if (!open) markSeen(); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Icon className="w-5 h-5 text-primary" />
                        {current.label}
                    </DialogTitle>
                    <DialogDescription>{current.description}</DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-center gap-1.5 py-2">
                    {slides.map((s, idx) => (
                        <span
                            key={s.key}
                            className={`h-1.5 rounded-full transition-all ${idx === step ? 'w-6 bg-primary' : 'w-1.5 bg-slate-200 dark:bg-slate-700'}`}
                        />
                    ))}
                </div>
                <DialogFooter className="flex-row justify-between sm:justify-between">
                    <Button variant="ghost" size="sm" onClick={markSeen}>
                        Pular tour
                    </Button>
                    <div className="flex gap-2">
                        {step > 0 && (
                            <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                                Anterior
                            </Button>
                        )}
                        <Button size="sm" onClick={() => (isLast ? markSeen() : setStep((s) => s + 1))}>
                            {isLast ? 'Concluir' : 'Próximo'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
