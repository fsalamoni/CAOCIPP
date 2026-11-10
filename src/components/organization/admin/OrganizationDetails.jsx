import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateOrganization } from '@/services/functionsService';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_OK = /^https?:\/\/[^\s]+$/i;

// Painel Administrativo → Identidade e contato. O servidor saneia tudo de novo
// (organizations/update.ts); a validação daqui só evita a ida e volta.
export default function OrganizationDetails({ organization }) {
    const contato = organization.contactInfo || {};
    const inicial = {
        name: organization.name || '',
        description: organization.description || '',
        acronym: contato.acronym || '',
        email: contato.email || '',
        phone: contato.phone || '',
        address: contato.address || '',
        website: contato.website || '',
    };
    const [form, setForm] = useState(inicial);
    const [loading, setLoading] = useState(false);

    const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
    const dirty = Object.keys(inicial).some((k) => form[k] !== inicial[k]);

    const erros = {
        name: form.name.trim() ? '' : 'Informe o nome do órgão.',
        email: !form.email.trim() || EMAIL_OK.test(form.email.trim()) ? '' : 'E-mail inválido.',
        website: !form.website.trim() || SITE_OK.test(form.website.trim()) ? '' : 'Comece o endereço com https://',
    };
    const temErro = Object.values(erros).some(Boolean);

    const handleSave = async (e) => {
        e.preventDefault();
        if (temErro) return;
        setLoading(true);
        try {
            const { name, description, ...contactInfo } = form;
            await updateOrganization({
                organizationId: organization.id,
                data: { name, description, contactInfo },
            });
            toast.success('Identidade do órgão atualizada.');
        } catch (error) {
            toast.error('Erro ao atualizar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const campo = (id, label, props = {}, erro = '') => (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} value={form[id]} onChange={set(id)} aria-invalid={Boolean(erro)} aria-describedby={erro ? `${id}-erro` : undefined} {...props} />
            {erro && <p id={`${id}-erro`} className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
        </div>
    );

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <section className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-lg border border-slate-200 dark:border-slate-800 space-y-4">
                <div>
                    <h3 className="text-lg font-medium">Identidade</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Como o órgão aparece no topo das páginas e em Informações Gerais.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                    {campo('name', 'Nome oficial', { placeholder: 'Ex.: Centro de Apoio Operacional…', maxLength: 150, required: true }, erros.name)}
                    {campo('acronym', 'Sigla', { placeholder: 'Ex.: CAO', maxLength: 20 })}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description">Descrição e competência</Label>
                    <Textarea
                        id="description" value={form.description} onChange={set('description')} maxLength={2000}
                        placeholder="Descreva a competência e as atribuições do órgão…" className="h-32"
                    />
                </div>
            </section>

            <section className="bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-lg border border-slate-200 dark:border-slate-800 space-y-4">
                <div>
                    <h3 className="text-lg font-medium">Contato</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Opcional. O que for preenchido aparece para a equipe em Informações Gerais.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    {campo('email', 'E-mail institucional', { type: 'email', placeholder: 'orgao@exemplo.gov.br', maxLength: 120 }, erros.email)}
                    {campo('phone', 'Telefone', { type: 'tel', placeholder: '(51) 3295-0000', maxLength: 40 })}
                </div>
                {campo('address', 'Endereço', { placeholder: 'Rua, número, sala, cidade', maxLength: 300 })}
                {campo('website', 'Site', { type: 'url', placeholder: 'https://', maxLength: 200 }, erros.website)}
            </section>

            <div className="flex items-center justify-end gap-3">
                {dirty && <span className="text-sm text-amber-700 dark:text-amber-400">Há alterações não salvas.</span>}
                <Button type="submit" disabled={loading || !dirty || temErro} className="gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar alterações
                </Button>
            </div>
        </form>
    );
}
