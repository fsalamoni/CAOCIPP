import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        // Atualiza o estado para renderizar UI de fallback
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log do erro para console (apenas em dev)
        if (import.meta.env.DEV) {
            console.error('ErrorBoundary caught an error:', error, errorInfo);
        }

        this.setState({
            error,
            errorInfo
        });

        // TODO: Enviar para serviço de logging em produção (Sentry, LogRocket, etc)
        // Example: logErrorToService(error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
                    <Card className="max-w-md w-full shadow-lg">
                        <CardContent className="p-8 text-center space-y-4">
                            <div className="flex justify-center">
                                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                                    <AlertCircle className="w-8 h-8 text-red-600" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold text-slate-900">
                                    Ops! Algo deu errado
                                </h2>
                                <p className="text-slate-600">
                                    A aplicação encontrou um erro inesperado e não conseguiu continuar.
                                </p>
                            </div>

                            {import.meta.env.DEV && this.state.error && (
                                <details className="text-left bg-slate-100 rounded-lg p-4 text-sm">
                                    <summary className="cursor-pointer font-medium text-slate-700 mb-2">
                                        Detalhes do erro (apenas em desenvolvimento)
                                    </summary>
                                    <div className="space-y-2 text-xs font-mono">
                                        <div>
                                            <strong>Erro:</strong>
                                            <pre className="mt-1 text-red-600 whitespace-pre-wrap">
                                                {this.state.error.toString()}
                                            </pre>
                                        </div>
                                        {this.state.errorInfo && (
                                            <div>
                                                <strong>Stack trace:</strong>
                                                <pre className="mt-1 text-slate-600 whitespace-pre-wrap max-h-48 overflow-auto">
                                                    {this.state.errorInfo.componentStack}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <Button
                                    onClick={this.handleReset}
                                    className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Recarregar Página
                                </Button>
                                <Button
                                    onClick={() => window.location.href = '/'}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    Voltar ao Início
                                </Button>
                            </div>

                            <p className="text-xs text-slate-500 pt-2">
                                Se o problema persistir, entre em contato com o suporte.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
