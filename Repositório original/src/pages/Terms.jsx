import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Termos de Uso</h1>
        <p className="text-slate-600">Última atualização: Janeiro de 2025</p>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            1. Aceitação dos Termos
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-slate max-w-none">
          <p>
            Ao acessar e usar esta plataforma de gerenciamento de processos jurídicos, você aceita 
            e concorda em ficar vinculado aos termos e condições deste acordo. Se você não concordar 
            com qualquer parte destes termos, não deverá usar a plataforma.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>2. Uso da Plataforma</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-slate max-w-none">
          <p>Esta plataforma destina-se ao gerenciamento de processos jurídicos e deve ser utilizada apenas para fins legítimos e em conformidade com todas as leis aplicáveis.</p>
          <ul className="space-y-2 mt-4">
            <li>Você é responsável por manter a confidencialidade de sua conta e senha</li>
            <li>Você concorda em notificar imediatamente sobre qualquer uso não autorizado</li>
            <li>Você não deve usar a plataforma para qualquer finalidade ilegal</li>
            <li>Você é responsável por todo o conteúdo que criar ou compartilhar</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>3. Privacidade e Proteção de Dados</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-slate max-w-none">
          <p>
            Levamos a privacidade a sério e estamos comprometidos em proteger seus dados pessoais. 
            Todos os dados são armazenados de forma segura e criptografada. Não compartilhamos 
            suas informações com terceiros sem seu consentimento.
          </p>
          <ul className="space-y-2 mt-4">
            <li>Os dados são isolados por organização (multi-tenancy)</li>
            <li>Apenas membros autorizados podem acessar dados da organização</li>
            <li>Mantemos logs de auditoria para rastreabilidade</li>
            <li>Você pode solicitar a exclusão de seus dados a qualquer momento</li>
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>4. Organizações e Membros</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-slate max-w-none">
          <p>
            Ao criar uma organização, você se torna o "criador" e tem permissões adicionais para 
            gerenciar membros e configurações. Membros convidados têm acesso aos processos mas 
            permissões limitadas de administração.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>5. Limitação de Responsabilidade</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-slate max-w-none">
          <p>
            A plataforma é fornecida "como está" sem garantias de qualquer tipo. Não nos 
            responsabilizamos por perda de dados, interrupções de serviço ou danos decorrentes 
            do uso da plataforma.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>6. Modificações dos Termos</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-slate max-w-none">
          <p>
            Reservamo-nos o direito de modificar estes termos a qualquer momento. Mudanças 
            significativas serão notificadas através da plataforma. O uso continuado após 
            modificações constitui aceitação dos novos termos.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-indigo-50 to-violet-50">
        <CardContent className="p-6">
          <p className="text-sm text-slate-700">
            Se você tiver dúvidas sobre estes termos, entre em contato através do suporte da plataforma.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}