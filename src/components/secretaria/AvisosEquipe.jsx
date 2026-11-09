import React from 'react';
import { BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useUserPreferences } from '@/hooks/useFirestore';

const OPCOES_EMAIL = [
    ['cada', 'Um e-mail a cada aviso', 'Processo que chegou, pedido de assinatura, pendência, petição.'],
    ['resumo', 'Um resumo por dia', 'Pela manhã, junto com o alerta de prazos, só o que ainda não foi lido.'],
    ['nenhum', 'Nenhum e-mail', 'Só o sino aqui na plataforma, se estiver ligado.'],
];

/** Preferências de aviso do Processo Eletrônico (sino e e-mail), salvas em userPreferences. */
export default function AvisosEquipe() {
    const { preferences, updatePreferences } = useUserPreferences();
    const atual = preferences?.notificationPreferences?.processo_eletronico || {};
    const sino = atual.sino !== false;
    const email = ['resumo', 'nenhum'].includes(atual.email) ? atual.email : 'cada';

    // updatePreferences faz a mescla otimista e avisa em caso de erro.
    const salvar = (mudanca) => updatePreferences({ notificationPreferences: { ...(preferences?.notificationPreferences || {}), processo_eletronico: { sino, email, ...mudanca } } });

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><BellRing className="w-4 h-4" aria-hidden /> Avisos</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Como avisar você</DialogTitle>
                    <DialogDescription>Vale para todos os órgãos em que você está lotado. Alertas de prazo vencendo saem sempre por e-mail.</DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <Label htmlFor="aviso-sino" className="font-normal">Sino na plataforma</Label>
                    <Switch id="aviso-sino" checked={sino} onCheckedChange={(v) => salvar({ sino: v })} />
                </div>
                <RadioGroup value={email} onValueChange={(v) => salvar({ email: v })} aria-label="E-mail">
                    {OPCOES_EMAIL.map(([valor, rotulo, desc]) => (
                        <div key={valor} className="flex items-start gap-3 rounded-lg border p-3">
                            <RadioGroupItem value={valor} id={`aviso-email-${valor}`} className="mt-0.5" />
                            <Label htmlFor={`aviso-email-${valor}`} className="font-normal leading-snug">
                                {rotulo}
                                <span className="block text-xs text-slate-600 dark:text-slate-400">{desc}</span>
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </DialogContent>
        </Dialog>
    );
}
