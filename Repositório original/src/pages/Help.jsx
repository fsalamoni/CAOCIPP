import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  HelpCircle,
  Users,
  FileText,
  BarChart3,
  Building2,
  Mail
} from 'lucide-react';

export default function Help() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Central de Ajuda</h1>
        <p className="text-slate-600">Aprenda a usar todas as funcionalidades da plataforma</p>
      </div>

      {/* Getting Started */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            Primeiros Passos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <HelpItem
            number="1"
            title="Criar ou Ingressar em uma Organização"
            description="Acesse 'Meu Perfil' e crie uma nova organização ou ingresse em uma existente usando o código de convite."
          />
          <HelpItem
            number="2"
            title="Adicionar Membros"
            description="Compartilhe o código de convite da sua organização com outros usuários. Você encontra o código em 'Informações Gerais'."
          />
          <HelpItem
            number="3"
            title="Cadastrar Processos"
            description="Na aba 'Controle de Processos', clique em 'Adicionar Processo' e preencha os dados do processo jurídico."
          />
          <HelpItem
            number="4"
            title="Acompanhar Status"
            description="O status dos processos é calculado automaticamente baseado nas datas preenchidas. Acompanhe no dashboard."
          />
        </CardContent>
      </Card>

      {/* Features */}
      <div className="grid md:grid-cols-2 gap-6">
        <FeatureCard
          icon={Building2}
          title="Organizações"
          items={[
            "Crie múltiplas organizações",
            "Convide membros com código único",
            "Defina funções para cada membro",
            "Controle de acesso por organização"
          ]}
        />
        <FeatureCard
          icon={FileText}
          title="Processos"
          items={[
            "Cadastro completo de processos",
            "Status automático baseado em datas",
            "Atribuição de responsáveis",
            "Marcação de processos urgentes"
          ]}
        />
        <FeatureCard
          icon={BarChart3}
          title="Dashboards"
          items={[
            "Métricas em tempo real",
            "Gráficos de distribuição",
            "Análise de performance",
            "Tempo médio de resposta"
          ]}
        />
        <FeatureCard
          icon={Users}
          title="Colaboração"
          items={[
            "Múltiplos assessores por organização",
            "Sistema de notificações",
            "Logs de auditoria",
            "Controle de permissões"
          ]}
        />
      </div>

      {/* Status Flow */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Fluxo de Status dos Processos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <StatusFlow step="1" status="Pendente" description="Estado padrão para novos processos (Fundo Branco)." />
            <StatusFlow step="2" status="Em elaboração" description="Análise iniciada (Fundo Amarelo/Âmbar)." />
            <StatusFlow step="3" status="Em revisão" description="Remessa para revisão técnica (Fundo Azul/Roxo)." />
            <StatusFlow step="4" status="Na pasta" description="Processo finalizado e arquivado (Fundo Verde)." />
          </div>
          <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-sm text-indigo-900">
              💡 <strong>Dica:</strong> O status é calculado automaticamente baseado nas datas que você preenche.
              Você não precisa alterar o status manualmente!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-indigo-50 to-violet-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Precisa de mais ajuda?</h3>
              <p className="text-sm text-slate-600 mt-1">
                Entre em contato com o suporte para assistência personalizada
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HelpItem({ number, title, description }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold shrink-0">
        {number}
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600 mt-1">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, items }) {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="w-5 h-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-slate-600">
              <span className="text-indigo-600 mt-0.5">•</span>
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function StatusFlow({ step, status, description }) {
  return (
    <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold shrink-0">
        {step}
      </div>
      <div className="flex-1">
        <div className="font-semibold text-slate-900">{status}</div>
        <div className="text-sm text-slate-600">{description}</div>
      </div>
    </div>
  );
}