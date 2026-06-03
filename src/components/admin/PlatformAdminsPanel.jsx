import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, UserPlus, Loader2, Info } from 'lucide-react';
import {
    listPlatformAdmins,
    grantPlatformAdmin,
    revokePlatformAdmin,
} from '@/services/platformService';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

export default function PlatformAdminsPanel() {
    const { user } = useAuth();
    const [admins, setAdmins] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [email, setEmail] = useState('');
    const [granting, setGranting] = useState(false);
    const [busyUid, setBusyUid] = useState(null);

    const load = async () => {
        setIsLoading(true);
        try {
            const result = await listPlatformAdmins();
            setAdmins(result?.admins || []);
        } catch (err) {
            logger.error('Falha ao listar admins:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleGrant = async () => {
        const value = email.trim().toLowerCase();
        if (!value) return;
        setGranting(true);
        try {
            await grantPlatformAdmin(value);
            toast.success('Acesso de super-admin concedido.');
            setEmail('');
            await load();
        } catch (err) {
            logger.error('Falha ao conceder admin:', err);
            toast.error(err?.message || 'Não foi possível conceder o acesso.');
        } finally {
            setGranting(false);
        }
    };

    const handleRevoke = async (uid) => {
        setBusyUid(uid);
        try {
            await revokePlatformAdmin(uid);
            toast.success('Acesso revogado.');
            await load();
        } catch (err) {
            logger.error('Falha ao revogar admin:', err);
            toast.error(err?.message || 'Não foi possível revogar.');
        } finally {
            setBusyUid(null);
        }
    };

    return (
        <div className="space-y-6">
            <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription className="text-sm">
                    Super-administradores têm acesso total a esta página. A pessoa
                    precisa ter feito login ao menos uma vez antes de receber o acesso.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <UserPlus className="w-4 h-4" /> Conceder acesso
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-2">
                        <Input
                            type="email"
                            placeholder="email@exemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGrant()}
                        />
                        <Button onClick={handleGrant} disabled={granting || !email.trim()}>
                            {granting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                'Conceder'
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <ShieldCheck className="w-4 h-4" /> Super-administradores
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-slate-500">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
                        </div>
                    ) : admins.length === 0 ? (
                        <p className="text-sm text-slate-500 py-4">
                            Nenhum super-admin registrado na allowlist ainda. O acesso
                            atual pode vir do e-mail de bootstrap configurado no servidor.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {admins.map((a) => (
                                <div
                                    key={a.uid}
                                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-900 truncate">
                                                {a.email || a.uid}
                                            </span>
                                            {a.active ? (
                                                <Badge className="text-[10px] bg-emerald-600">
                                                    Ativo
                                                </Badge>
                                            ) : (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[10px]"
                                                >
                                                    Revogado
                                                </Badge>
                                            )}
                                            {a.uid === user?.uid && (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px]"
                                                >
                                                    Você
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    {a.active && a.uid !== user?.uid && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-600 hover:bg-red-50"
                                            disabled={busyUid === a.uid}
                                            onClick={() => handleRevoke(a.uid)}
                                        >
                                            {busyUid === a.uid ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                'Revogar'
                                            )}
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
