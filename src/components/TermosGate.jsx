import React, { useState } from 'react';
import { FileText, Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useBranding } from '@/lib/BrandingContext';
import { precisaAceitarTermos } from '@/lib/platformBranding';
import Logo from '@/components/Logo';

/**
 * Quando a administração da plataforma publica termos com aceite obrigatório,
 * quem ainda não aceitou a versão atual vê os termos antes de qualquer tela.
 * O aceite (versão e data) fica no perfil da pessoa.
 */
export default function TermosGate({ children }) {
    const { user, userProfile, updateUserProfile, signOut } = useAuth();
    const branding = useBranding();
    const [salvando, setSalvando] = useState(false);

    if (!user || !userProfile || !precisaAceitarTermos(branding, userProfile)) return children;

    const t = branding.termos;
    const aceitar = async () => {
        setSalvando(true);
        try {
            await updateUserProfile({ termos_versao_aceita: t.versao, termos_aceitos_em: new Date().toISOString() });
        } catch {
            toast.error('Não foi possível registrar o aceite. Tente de novo.');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 sm:py-12">
            <div className="max-w-3xl mx-auto space-y-5">
                <Logo size="md" showText />
                <header className="space-y-1">
                    <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
                        <FileText className="w-6 h-6" aria-hidden />Termos de uso
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300">
                        {Number(userProfile.termos_versao_aceita || 0) > 0 ? 'Os termos mudaram. ' : ''}
                        Leia e aceite a versão {t.versao} para continuar usando o {branding.nome_curto}.
                    </p>
                </header>
                <article
                    tabIndex={0} aria-label="Texto dos termos de uso"
                    className="max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                    {t.texto}
                </article>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <Button variant="ghost" onClick={signOut} className="gap-1.5"><LogOut className="w-4 h-4" aria-hidden />Sair</Button>
                    <Button onClick={aceitar} disabled={salvando}>
                        {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Li e aceito os termos
                    </Button>
                </div>
            </div>
        </main>
    );
}
