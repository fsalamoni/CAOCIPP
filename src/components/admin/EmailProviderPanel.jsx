import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Save, Loader2, Info } from 'lucide-react';
import { getEmailProviderConfig, setEmailProviderConfig } from '@/services/platformService';
import { toast } from 'sonner';

// Painel de plataforma (super-admin): remetente usado nos relatórios
// agendados por e-mail (flag `scheduled_email_reports`). A chave de API do
// provedor (Resend) NUNCA passa por aqui — é um secret do Cloud Functions
// (EMAIL_API_KEY), configurado fora do app. Sem o secret, o envio permanece
// inativo mesmo com o remetente preenchido.
export default function EmailProviderPanel() {
    const [fromEmail, setFromEmail] = useState('');
    const [fromName, setFromName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getEmailProviderConfig()
            .then((data) => {
                setFromEmail(data?.fromEmail || '');
                setFromName(data?.fromName || '');
            })
            .catch(() => toast.error('Erro ao carregar configuração de e-mail.'))
            .finally(() => setIsLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setEmailProviderConfig(fromEmail, fromName);
            toast.success('Configuração de e-mail salva!');
        } catch (error) {
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription className="text-sm">
                    Provedor: <strong>Resend</strong>. A chave de API (secret{' '}
                    <code>EMAIL_API_KEY</code> no GitHub Actions do repositório) nunca é
                    armazenada no Firestore. Enquanto ela não existir, os relatórios agendados
                    e a autenticação em duas etapas ficam inativos mesmo com um remetente
                    configurado aqui e com as flags ligadas. Veja o passo a passo completo na
                    aba <strong>Configuração</strong>.
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Mail className="w-5 h-5 text-sky-600" />
                        Remetente dos relatórios
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="fromEmail">E-mail remetente</Label>
                            <Input
                                id="fromEmail"
                                type="email"
                                value={fromEmail}
                                onChange={(e) => setFromEmail(e.target.value)}
                                placeholder="relatorios@seudominio.com.br"
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <Label htmlFor="fromName">Nome do remetente</Label>
                            <Input
                                id="fromName"
                                value={fromName}
                                onChange={(e) => setFromName(e.target.value)}
                                placeholder="Consultas CAO"
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2 border-t border-slate-100">
                        <Button onClick={handleSave} disabled={saving} className="gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
