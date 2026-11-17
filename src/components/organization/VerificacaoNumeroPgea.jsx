import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertTriangle, Loader2, ExternalLink, FilePlus2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import { verificarNumeroPgea } from '@/services/functionsService';
import { MODULOS_PGEA, rotuloVinculo } from '@/lib/registrosPgea';
import { format, isValid } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';

const dataBR = (v) => { const d = parseLocalDate(v); return d && isValid(d) ? format(d, 'dd/MM/yyyy') : ''; };

/**
 * Confere o nº do PGEA digitado no "Novo" de Consultas e Expedientes contra
 * o banco do órgão (arquivados inclusive), no servidor. Número novo: check
 * verde. Número que já existe: aviso com fase e responsável de cada
 * procedimento e o botão para abrir (ou criar aditivo, quando houver `onCriarAditivo`).
 *
 * `onEstado(estado)` informa 'vazio' | 'conferindo' | 'novo' | 'existe' | 'erro'.
 */
export default function VerificacaoNumeroPgea({ organizationId, modulo, numero, onEstado, onFechar, onCriarAditivo }) {
    const cfg = MODULOS_PGEA[modulo];
    const [estado, setEstado] = useState('vazio');
    const [registros, setRegistros] = useState([]);
    const [, setParams] = useSearchParams();
    const pedido = useRef(0);
    const onEstadoRef = useRef(onEstado);
    onEstadoRef.current = onEstado;

    useEffect(() => {
        const texto = String(numero || '').trim();
        const id = ++pedido.current;
        const mudar = (e, regs = []) => {
            if (id !== pedido.current) return;
            setEstado(e);
            setRegistros(regs);
            onEstadoRef.current?.(e);
        };
        if (!texto || !/[0-9a-z]/i.test(texto) || !organizationId) { mudar('vazio'); return undefined; }
        mudar('conferindo');
        const t = setTimeout(() => {
            verificarNumeroPgea({ organizationId, modulo, numero: texto })
                .then((r) => mudar(r?.existe ? 'existe' : 'novo', r?.registros || []))
                .catch(() => mudar('erro'));
        }, 600);
        return () => clearTimeout(t);
    }, [numero, organizationId, modulo]);

    const abrir = (reg) => {
        onFechar?.();
        setParams((prev) => {
            const n = new URLSearchParams(prev);
            n.set('tab', cfg.tab);
            n.set('abrir', reg.id);
            return n;
        });
    };

    if (estado === 'vazio') return null;

    if (estado === 'conferindo') {
        return (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" role="status">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                Conferindo o número no banco do órgão…
            </p>
        );
    }

    if (estado === 'erro') {
        return (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400" role="status">
                Não foi possível conferir o número agora. Você pode continuar o cadastro.
            </p>
        );
    }

    if (estado === 'novo') {
        return (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300" role="status">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                Número novo: não há {cfg.nome} com este número no órgão, nem entre {cfg.a}s arquivad{cfg.a}s. É um procedimento novo.
            </p>
        );
    }

    const um = registros.length === 1;
    return (
        <div className="mt-2 rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2" role="alert">
            <p className="flex items-start gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                {um ? `Já existe ${cfg.a === 'a' ? 'uma' : 'um'} ${cfg.nome} com este número.` : `Já existem ${registros.length} procedimentos com este número.`}
            </p>
            <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
                Se for continuidade, entre no procedimento{onCriarAditivo ? ' ou crie um aditivo dele' : ''}. Se for mesmo um procedimento novo, você pode continuar o cadastro.
            </p>
            <ul className="space-y-2">
                {registros.map((r) => {
                    const vinculo = rotuloVinculo(r);
                    return (
                        <li key={r.id} className="rounded-md bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 p-2.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.numero}</span>
                                {vinculo && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900 text-violet-700 dark:text-violet-200">{vinculo}</span>}
                                <StatusBadge status={r.fase} />
                            </div>
                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                <User className="inline w-3 h-3 mr-1 -mt-0.5" aria-hidden="true" />
                                {r.responsavel ? `${r.arquivado ? 'Era responsável' : 'Responsável'}: ${r.responsavel}` : 'Sem responsável'}
                                {dataBR(r.entrada) && <span className="text-slate-400 dark:text-slate-500"> · entrada em {dataBR(r.entrada)}</span>}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => abrir(r)}>
                                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                    Entrar {cfg.a === 'a' ? 'na' : 'no'} {cfg.nome}
                                </Button>
                                {onCriarAditivo && (
                                    <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => onCriarAditivo(r)}>
                                        <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                                        Criar aditivo
                                    </Button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
