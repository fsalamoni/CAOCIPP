import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, TrendingUp, Users, Shield, Chrome, AlertCircle, Loader2 } from 'lucide-react';
import { logger } from '@/utils/logger';

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth, signInWithGoogle, authError, clearAuthError } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoadingAuth) {
      navigate('/Dashboard');
    }
  }, [isAuthenticated, isLoadingAuth, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      clearAuthError();

      await signInWithGoogle(false); // false = popup mode (desktop)
      // Note: Navigation will happen automatically via useEffect above
    } catch (error) {
      logger.error('Login error:', error);
      // Error is already set in AuthContext
      setIsSigningIn(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Consultas CAO</h1>
          </div>
          <Button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            variant="outline"
            className="gap-2"
          >
            {isSigningIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                <Chrome className="w-4 h-4" />
                Entrar com Google
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <h2 className="text-5xl font-bold text-slate-900 dark:text-white mb-6">
            Gestão Inteligente de<br />Processos Administrativos
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-8">
            Plataforma completa para controle, análise e acompanhamento de processos.
            Organize seu fluxo de trabalho com eficiência e transparência.
          </p>

          {/* Error Alert */}
          {authError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 h-4" />
              <AlertDescription>{authError.message}</AlertDescription>
            </Alert>
          )}

          {/* Google Sign In Card */}
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Acesse sua conta</CardTitle>
              <CardDescription>
                Faça login com sua conta Google para começar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
                size="lg"
                className="w-full gap-3 text-base"
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Chrome className="w-5 h-5" />
                    Continuar com Google
                  </>
                )}
              </Button>

              <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
                Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <FileText className="w-12 h-12 text-primary mx-auto mb-4" />
              <CardTitle>Controle Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-300">
                Gerencie processos com status workflow completo, urgências e responsáveis.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
              <CardTitle>Analytics Poderosos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-300">
                Dashboard com KPIs, gráficos e insights para tomada de decisão estratégica.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <Users className="w-12 h-12 text-primary mx-auto mb-4" />
              <CardTitle>Colaboração</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-300">
                Múltiplos usuários, organizações e permissões granulares por role.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Security Badge */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-full">
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Autenticado via Firebase • Dados criptografados
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-slate-600 dark:text-slate-400">
          <p className="text-sm">
            © 2026 Consultas CAO - Gestão de Processos Administrativos
          </p>
        </div>
      </footer>
    </div>
  );
}