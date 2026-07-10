import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
    Settings,
    RefreshCw,
    Loader2,
    AlertCircle,
    CheckCircle2,
    AlertTriangle,
    ShieldCheck,
    Mail,
    UserCog,
    CalendarClock,
    Receipt,
    KeyRound,
} from 'lucide-react';
import { getSetupStatus } from '@/services/platformService';
import { logger } from '@/utils/logger';

// Painel de plataforma (super-admin): checklist de configurações que vivem
// FORA do Firestore — variáveis de ambiente da Cloud Function, secrets do
// GitHub Actions e APIs do Google Cloud. Nenhum botão aqui grava nada: são
// passos manuais, feitos uma única vez, fora do app (GitHub, GCP Console,
// Resend). O objetivo é só deixar claro o que falta e como fazer, num só
// lugar, em vez de espalhado em comentários de código e PRs.
function StatusBadge({ ok, label }) {
    return ok ? (
        <Badge className="gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <CheckCircle2 className="w-3.5 h-3.5" /> {label || 'Configurado'}
        </Badge>
    ) : (
        <Badge className="gap-1 bg-amber-100 text-amber-700 hover:bg-amber-100">
            <AlertTriangle className="w-3.5 h-3.5" /> {label || 'Pendente'}
        </Badge>
    );
}

function Step({ children }) {
    return <li className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{children}</li>;
}

function Code({ children }) {
    return (
        <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs">
            {children}
        </code>
    );
}

export default function SetupGuidePanel() {
    const [status, setStatus] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await getSetupStatus();
            setStatus(result);
        } catch (err) {
            logger.error('Falha ao carregar checklist de configuração:', err);
            setError(err?.message || 'Erro ao carregar checklist de configuração.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Verificando configuração...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center gap-2 text-red-600 py-8 justify-center">
                <AlertCircle className="w-5 h-5" />
                {error}
            </div>
        );
    }

    const s = status || {};
    const emailReady = s.emailApiKeyConfigured && s.emailFromConfigured;

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Settings className="w-5 h-5 text-slate-600" />
                        Configuração necessária
                    </CardTitle>
                    <Button variant="outline" size="sm" onClick={load} className="gap-2">
                        <RefreshCw className="w-4 h-4" /> Atualizar
                    </Button>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-slate-500">
                        Algumas funcionalidades dependem de configurações feitas fora do app
                        (no GitHub, no Google Cloud ou no provedor de e-mail). Elas não ficam
                        no Firestore por segurança — são chaves e senhas. Abaixo, o que falta
                        e o passo a passo para cada uma.
                    </p>
                </CardContent>
            </Card>

            <Accordion type="multiple" defaultValue={['admin']} className="space-y-3">
                <AccordionItem value="admin" className="border border-slate-200 dark:border-slate-700 rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="font-medium">Acesso de super-administrador</span>
                            <StatusBadge ok={s.platformAdminBootstrapConfigured} label={s.platformAdminBootstrapConfigured ? 'Configurado' : 'Sem redundância'} />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <ul className="space-y-2 list-disc pl-5">
                            <Step>
                                Você está vendo esta página, então já tem acesso — seja por já
                                estar na variável <Code>PLATFORM_ADMIN_EMAILS</Code>, seja por já
                                ter um registro em <Code>platformAdmins</Code>. Não é preciso
                                fazer nada agora.
                            </Step>
                            <Step>
                                Para adicionar outros super-admins no dia a dia, use a aba{' '}
                                <strong>Administradores</strong> — não mexe em variável de
                                ambiente, é só um e-mail.
                            </Step>
                            <Step>
                                <Code>PLATFORM_ADMIN_EMAILS</Code> serve só como plano B: uma
                                lista de e-mails (separados por vírgula) com acesso garantido
                                mesmo que o Firestore de <Code>platformAdmins</Code> fique vazio
                                ou corrompido. Para configurar: Settings → Secrets and variables →
                                Actions no GitHub, crie o secret{' '}
                                <Code>PLATFORM_ADMIN_EMAILS</Code> com os e-mails de backup e
                                rode o deploy de novo (push no <Code>main</Code> ou "Run workflow"
                                na aba Actions).
                            </Step>
                        </ul>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="email" className="border border-slate-200 dark:border-slate-700 rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                            <Mail className="w-4 h-4 text-sky-600 shrink-0" />
                            <span className="font-medium">E-mail transacional (Resend)</span>
                            <StatusBadge ok={emailReady} />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <p className="text-sm text-slate-500 mb-2">
                            Usado por: código de verificação em duas etapas, resumo diário de
                            urgentes e relatório semanal por e-mail.
                        </p>
                        <ul className="space-y-2 list-disc pl-5">
                            <Step>
                                <StatusBadge ok={s.emailFromConfigured} label={s.emailFromConfigured ? 'Remetente definido' : 'Remetente pendente'} />{' '}
                                Preencha o e-mail e nome do remetente na aba <strong>E-mail</strong> aqui ao lado.
                            </Step>
                            <Step>
                                <StatusBadge ok={s.emailApiKeyConfigured} label={s.emailApiKeyConfigured ? 'Chave de API definida' : 'Chave de API pendente'} />{' '}
                                Crie uma conta grátis em <Code>resend.com</Code>, verifique um
                                domínio de envio (registros DNS que o próprio Resend indica) e
                                gere uma API Key.
                            </Step>
                            <Step>
                                No GitHub do projeto: Settings → Secrets and variables → Actions
                                → New repository secret → nome <Code>EMAIL_API_KEY</Code>, valor
                                a chave gerada no Resend.
                            </Step>
                            <Step>
                                Rode o deploy de novo (push no <Code>main</Code> ou "Run
                                workflow" na aba Actions) — a chave é injetada automaticamente na
                                Cloud Function no próximo deploy, sem precisar editar código.
                            </Step>
                            <Step>
                                O e-mail remetente configurado na aba <strong>E-mail</strong>{' '}
                                precisa pertencer ao domínio verificado no Resend, senão o envio
                                falha.
                            </Step>
                        </ul>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="userEmail" className="border border-slate-200 dark:border-slate-700 rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                            <UserCog className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-medium">Para qual e-mail cada usuário recebe notificações</span>
                            <StatusBadge ok label="Já ativo" />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <ul className="space-y-2 list-disc pl-5">
                            <Step>
                                Já funciona sem nenhuma configuração de sua parte: cada usuário
                                pode indicar um e-mail preferido em{' '}
                                <strong>Meu Perfil → Email para Notificações</strong>.
                            </Step>
                            <Step>
                                Se o usuário deixar esse campo vazio, o sistema usa
                                automaticamente o e-mail da própria conta (o mesmo usado para
                                fazer login).
                            </Step>
                            <Step>
                                Isso vale para os três tipos de e-mail enviados pela plataforma:
                                código de verificação em duas etapas, resumo diário de urgentes e
                                relatório semanal do órgão.
                            </Step>
                        </ul>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="scheduler" className="border border-slate-200 dark:border-slate-700 rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                            <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="font-medium">Automações agendadas</span>
                            <StatusBadge ok={false} label="Ação manual pendente" />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <p className="text-sm text-slate-500 mb-2">
                            Afeta as funcionalidades <strong>Escalonamento automático</strong> e{' '}
                            <strong>Relatórios agendados por e-mail</strong>: a tela de
                            configuração de ambas já está disponível, mas o disparo automático
                            (todo dia / toda semana) está temporariamente desligado porque
                            depende de uma API do Google Cloud que ainda não foi habilitada
                            neste projeto.
                        </p>
                        <ul className="space-y-2 list-disc pl-5">
                            <Step>
                                Acesse{' '}
                                <Code>console.cloud.google.com/apis/library/cloudscheduler.googleapis.com</Code>{' '}
                                com uma conta com papel de dono/editor do projeto do Google Cloud
                                e clique em "Ativar" (ou rode{' '}
                                <Code>gcloud services enable cloudscheduler.googleapis.com --project=&lt;id&gt;</Code>
                                ).
                            </Step>
                            <Step>
                                Depois de habilitar, avise para reativarmos as 3 funções
                                agendadas no código (estão comentadas em{' '}
                                <Code>functions-v2/src/index.ts</Code> com instruções) e fazer um
                                novo deploy — sem isso, o deploy inteiro falha, por isso ficaram
                                temporariamente desligadas.
                            </Step>
                        </ul>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="billing" className="border border-slate-200 dark:border-slate-700 rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3">
                            <Receipt className="w-4 h-4 text-violet-600 shrink-0" />
                            <span className="font-medium">Custos reais (opcional)</span>
                            <StatusBadge ok={s.billingExportConfigured} label={s.billingExportConfigured ? 'Configurado' : 'Usando estimativa'} />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <p className="text-sm text-slate-500 mb-2">
                            Sem isso a aba <strong>Custos</strong> segue funcionando normalmente,
                            só que com uma estimativa em vez do valor exato cobrado pelo Google
                            Cloud.
                        </p>
                        <ul className="space-y-2 list-disc pl-5">
                            <Step>
                                No Google Cloud Console, ative a exportação do Cloud Billing para
                                o BigQuery (Faturamento → Gerenciamento de faturamento → Exportações
                                de dados de faturamento).
                            </Step>
                            <Step>
                                Adicione 3 secrets no GitHub (Settings → Secrets and variables →
                                Actions): <Code>BILLING_BQ_PROJECT</Code>,{' '}
                                <Code>BILLING_BQ_DATASET</Code> e <Code>BILLING_BQ_TABLE</Code>{' '}
                                (o nome da tabela criada pela exportação, algo como{' '}
                                <Code>gcp_billing_export_v1_XXXXXX</Code>).
                            </Step>
                            <Step>Rode o deploy de novo para a aba Custos passar a mostrar valores reais.</Step>
                        </ul>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <KeyRound className="w-4 h-4 text-slate-500" />
                        Resumo dos secrets do GitHub Actions
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <p className="text-slate-500">
                        Configurados em Settings → Secrets and variables → Actions, no
                        repositório do projeto. Sem os obrigatórios, o deploy roda "verde" mas
                        não publica nada, para nunca publicar um app quebrado.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3 pt-2">
                        <div>
                            <p className="font-medium text-slate-700 dark:text-slate-200">Obrigatórios</p>
                            <ul className="list-disc pl-5 text-slate-500 space-y-0.5">
                                <li><Code>FIREBASE_SERVICE_ACCOUNT</Code> ou <Code>FIREBASE_TOKEN</Code></li>
                                <li><Code>VITE_FIREBASE_API_KEY</Code> e demais <Code>VITE_FIREBASE_*</Code></li>
                            </ul>
                        </div>
                        <div>
                            <p className="font-medium text-slate-700 dark:text-slate-200">Opcionais</p>
                            <ul className="list-disc pl-5 text-slate-500 space-y-0.5">
                                <li><Code>EMAIL_API_KEY</Code></li>
                                <li><Code>PLATFORM_ADMIN_EMAILS</Code></li>
                                <li><Code>BILLING_BQ_PROJECT</Code> / <Code>_DATASET</Code> / <Code>_TABLE</Code></li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
