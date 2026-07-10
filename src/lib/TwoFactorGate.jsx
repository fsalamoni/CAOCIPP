// ============================================================================
// TwoFactorGate — autenticação em duas etapas por e-mail (flag `two_factor_auth`).
// ----------------------------------------------------------------------------
// NÃO é MFA nativo do Firebase/Identity Platform (exigiria upgrade de projeto
// fora do alcance desta implementação) — é uma camada própria mais simples:
// um código de 6 dígitos por e-mail, uma vez por SESSÃO DE NAVEGADOR (não a
// cada navegação de página), verificado via Cloud Functions sendLoginOtp/
// verifyLoginOtp. Falha aberta: se o e-mail não puder ser enviado (provedor
// não configurado), o acesso é liberado mesmo assim — nunca tranca o usuário
// para fora da própria conta por um problema alheio a ele.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useFlag } from '@/lib/FeatureFlagsContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { sendLoginOtp, verifyLoginOtp } from '@/services/functionsService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

function sessionKey(uid) {
    return `2fa_verified_${uid}`;
}

export default function TwoFactorGate({ children }) {
    const enabled = useFlag(FEATURE_FLAGS.TWO_FACTOR_AUTH.key);
    const { user, userProfile } = useAuth();
    const [status, setStatus] = useState('checking'); // checking | pending | verified | bypassed
    const [code, setCode] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);

    const requires2fa = enabled && userProfile?.two_factor_enabled === true;

    useEffect(() => {
        if (!user) return;
        if (!requires2fa) {
            setStatus('bypassed');
            return;
        }
        if (sessionStorage.getItem(sessionKey(user.uid)) === 'true') {
            setStatus('verified');
            return;
        }

        setStatus('pending');
        setSending(true);
        sendLoginOtp()
            .then((result) => {
                if (!result?.sent) {
                    // Falha aberta: provedor de e-mail indisponível — não bloqueia o acesso.
                    toast.warning('Verificação por e-mail temporariamente indisponível. Acesso liberado.');
                    sessionStorage.setItem(sessionKey(user.uid), 'true');
                    setStatus('verified');
                }
            })
            .catch(() => {
                toast.warning('Verificação por e-mail temporariamente indisponível. Acesso liberado.');
                sessionStorage.setItem(sessionKey(user.uid), 'true');
                setStatus('verified');
            })
            .finally(() => setSending(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid, requires2fa]);

    const handleVerify = async () => {
        if (!code.trim()) return;
        setVerifying(true);
        try {
            await verifyLoginOtp(code.trim());
            sessionStorage.setItem(sessionKey(user.uid), 'true');
            setStatus('verified');
            setCode('');
        } catch (error) {
            toast.error(error.message || 'Código incorreto.');
        } finally {
            setVerifying(false);
        }
    };

    const handleResend = async () => {
        setSending(true);
        try {
            const result = await sendLoginOtp();
            if (result?.sent) {
                toast.success('Novo código enviado.');
            } else {
                toast.warning('Verificação por e-mail temporariamente indisponível. Acesso liberado.');
                sessionStorage.setItem(sessionKey(user.uid), 'true');
                setStatus('verified');
            }
        } catch (error) {
            toast.error('Erro ao reenviar código.');
        } finally {
            setSending(false);
        }
    };

    if (status === 'pending') {
        return (
            <Dialog open modal>
                <DialogContent className="max-w-sm" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-primary" /> Verificação em duas etapas
                        </DialogTitle>
                        <DialogDescription>
                            {sending ? 'Enviando código para o seu e-mail...' : 'Digite o código de 6 dígitos enviado para o seu e-mail.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="text-center text-2xl tracking-[0.5em] font-mono"
                            maxLength={6}
                            disabled={sending}
                        />
                        <Button className="w-full gap-2" onClick={handleVerify} disabled={verifying || sending || code.length < 6}>
                            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Verificar
                        </Button>
                        <Button variant="ghost" className="w-full" onClick={handleResend} disabled={sending}>
                            Reenviar código
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return <>{children}</>;
}
