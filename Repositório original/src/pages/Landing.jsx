import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Shield, 
  BarChart3, 
  Users,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function Landing() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (isAuth) {
          setIsAuthenticated(true);
          window.location.href = createPageUrl('Dashboard');
        }
      } catch (error) {
        // Usuário não autenticado
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              ProcessFlow
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => base44.auth.redirectToLogin(createPageUrl('Dashboard'))}
            >
              Entrar
            </Button>
            <Button 
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
              onClick={() => base44.auth.redirectToLogin(createPageUrl('Dashboard'))}
            >
              Começar Agora
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 lg:py-32">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Plataforma SaaS de Gerenciamento Jurídico
          </div>
          
          <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
            Gerencie processos jurídicos com
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              {' '}inteligência e precisão
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 mb-10 leading-relaxed">
            Automatize o controle de prazos, distribua tarefas entre assessores e visualize 
            métricas de performance em tempo real. Elimine planilhas e ganhe eficiência.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg"
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 h-12 px-8 text-base"
              onClick={() => base44.auth.redirectToLogin(createPageUrl('Dashboard'))}
            >
              Começar Gratuitamente
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Link to={createPageUrl('Help')}>
              <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                Saiba Mais
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard 
            icon={CheckCircle2}
            title="Status Automático"
            description="Cálculo inteligente de status baseado em datas e prazos"
            color="from-emerald-500 to-teal-500"
          />
          <FeatureCard 
             icon={Users}
             title="Multi-Órgão"
             description="Gerencie múltiplos órgãos, equipes e assessores em um só lugar"
             color="from-blue-500 to-cyan-500"
           />
          <FeatureCard 
            icon={BarChart3}
            title="Dashboards Analíticos"
            description="Visualize métricas e performance em tempo real"
            color="from-violet-500 to-purple-500"
          />
          <FeatureCard 
            icon={Shield}
            title="Segurança Total"
            description="Controle de acesso por organização e auditoria completa"
            color="from-orange-500 to-red-500"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 backdrop-blur-sm py-8 mt-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-slate-600">
            © 2025 ProcessFlow. Todos os direitos reservados.
          </p>
          <div className="flex items-center justify-center gap-6 mt-4">
            <Link to={createPageUrl('Terms')} className="text-sm text-slate-500 hover:text-slate-700">
              Termos de Uso
            </Link>
            <Link to={createPageUrl('Help')} className="text-sm text-slate-500 hover:text-slate-700">
              Ajuda
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description, color }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-200">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}