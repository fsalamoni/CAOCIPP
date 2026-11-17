import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, AlertTriangle, OctagonAlert, X, Wrench, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAvisos, useBranding } from '@/lib/BrandingContext';
import { avisoVisivel } from '@/lib/platformAvisos';
import Logo from '@/components/Logo';

const CHAVE = 'sigo_avisos_dispensados';
const lerDispensados = () => {
    try { return JSON.parse(localStorage.getItem(CHAVE) || '[]'); } catch { return []; }
};

const ESTILO = {
    info: { icone: Info, caixa: 'bg-sky-50 border-sky-200 text-sky-950 dark:bg-sky-950/60 dark:border-sky-900 dark:text-sky-50', cor: 'text-sky-700 dark:text-sky-300' },
    alerta: { icone: AlertTriangle, caixa: 'bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-950/60 dark:border-amber-900 dark:text-amber-50', cor: 'text-amber-700 dark:text-amber-300' },
    critico: { icone: OctagonAlert, caixa: 'bg-red-50 border-red-200 text-red-950 dark:bg-red-950/60 dark:border-red-900 dark:text-red-50', cor: 'text-red-700 dark:text-red-300' },
};

/** Faixa do aviso da administração da plataforma, no topo das telas. */
export function AvisoPlataforma({ className = '' }) {
    const { aviso } = useAvisos();
    const [dispensados, setDispensados] = useState(lerDispensados);
    if (!avisoVisivel(aviso, new Date(), dispensados)) return null;
    const dispensar = () => {
        const novos = [...dispensados.slice(-19), aviso.id];
        setDispensados(novos);
        try { localStorage.setItem(CHAVE, JSON.stringify(novos)); } catch { /* sem armazenamento: some só nesta visita */ }
    };
    return <FaixaAviso aviso={aviso} onDispensar={dispensar} className={className} />;
}

/** Desenho da faixa (também usado na prévia do painel). */
export function FaixaAviso({ aviso, onDispensar, className = '' }) {
    const e = ESTILO[aviso.tom] || ESTILO.info;
    const Icone = e.icone;
    const link = aviso.link_url && (aviso.link_url.startsWith('/')
        ? <Link to={aviso.link_url} className="font-medium underline underline-offset-2">{aviso.link_rotulo}</Link>
        : <a href={aviso.link_url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">{aviso.link_rotulo}</a>);

    return (
        <section
            role={aviso.tom === 'critico' ? 'alert' : 'status'} aria-label={`Aviso: ${aviso.titulo}`}
            className={`flex items-start gap-3 rounded-lg border p-3 sm:p-4 ${e.caixa} ${className}`}
        >
            <Icone className={`w-5 h-5 mt-0.5 shrink-0 ${e.cor}`} aria-hidden />
            <div className="flex-1 min-w-0 text-sm space-y-0.5">
                <p className="font-semibold break-words">{aviso.titulo}</p>
                {aviso.texto && <p className="whitespace-pre-line break-words">{aviso.texto}</p>}
                {link && <p>{link}</p>}
            </div>
            {aviso.dispensavel !== false && (
                <button
                    type="button" onClick={onDispensar} aria-label="Dispensar aviso"
                    className="p-1.5 -m-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
                >
                    <X className="w-4 h-4" aria-hidden />
                </button>
            )}
        </section>
    );
}

/** Tela de manutenção: o que quem não é super-admin vê enquanto ela estiver ligada. */
export function TelaManutencao({ onSair }) {
    const { manutencao } = useAvisos();
    const { nome_curto } = useBranding();
    const previsao = manutencao?.previsao ? new Date(manutencao.previsao) : null;
    return (
        <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-10">
            <div className="max-w-md w-full text-center space-y-5">
                <div className="flex justify-center"><Logo size="xl" /></div>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950">
                    <Wrench className="w-6 h-6 text-amber-700 dark:text-amber-300" aria-hidden />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{nome_curto} em manutenção</h1>
                <p className="text-slate-700 dark:text-slate-200 whitespace-pre-line">{manutencao?.mensagem}</p>
                {previsao && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Previsão de volta: {previsao.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-300">Nenhum dado foi perdido. Esta página se atualiza sozinha quando o sistema voltar.</p>
                {onSair && <Button variant="outline" onClick={onSair} className="gap-1.5"><LogOut className="w-4 h-4" aria-hidden />Sair</Button>}
            </div>
        </main>
    );
}
