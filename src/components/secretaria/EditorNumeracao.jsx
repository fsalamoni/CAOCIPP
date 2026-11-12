import React from 'react';
import { ArrowLeft, ArrowRight, Hash, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ESCOPOS, PARTES_NUMERO, REINICIOS, formatarNumero, novaParte, problemasNumeracao, resumoContagem } from '@/lib/numeracao';

// ============================================================================
// Montagem da numeração única por partes, com prévia ao vivo. Serve à
// numeração do órgão e à própria de um tipo de processo.
// ============================================================================

const seletor = 'h-8 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
const nomeParte = (t) => PARTES_NUMERO.find(([id]) => id === t)?.[1] || t;
const SEPARADORES = ['/', '-', '.', ' '];

/** `valor` = { partes }; `exemplo` = contexto da prévia { tipo, unidade, orgao }. */
export default function EditorNumeracao({ valor, onChange, exemplo = {} }) {
    const partes = valor?.partes || [];
    const mudar = (lista) => onChange({ ...valor, partes: lista });
    const setParte = (i, d) => mudar(partes.map((p, j) => (j === i ? { ...p, ...d } : p)));
    const mover = (i, d) => { const l = [...partes]; [l[i], l[i + d]] = [l[i + d], l[i]]; mudar(l); };
    const temSeq = partes.some((p) => p.t === 'seq');
    const problemas = problemasNumeracao({ partes });
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const ctx = { hoje, tipo: exemplo.tipo || { sigla: 'REQ', nome: 'Requerimento' }, unidade: exemplo.unidade || { sigla: 'SEC', nome: 'Secretaria' }, orgao: exemplo.orgao || { sigla: 'ORG', nome: 'Órgão' } };

    return (
        <div className="space-y-3">
            <div className="rounded-md border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 px-3 py-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">Prévia</p>
                <p className="font-mono text-lg font-semibold break-all" aria-live="polite">{temSeq ? `${formatarNumero({ partes }, ctx, 1)}, ${formatarNumero({ partes }, ctx, 2)}, …` : '—'}</p>
                {temSeq && <p className="text-xs text-slate-600 dark:text-slate-300">{resumoContagem({ partes })}</p>}
            </div>
            <ol className="flex flex-wrap items-stretch gap-2" aria-label="Partes do número, na ordem">
                {partes.map((p, i) => (
                    <li key={i} className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 space-y-1.5 min-w-[7rem]">
                        <div className="flex items-center gap-1">
                            <span className="flex-1 text-xs font-medium">{nomeParte(p.t)}</span>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Mover ${nomeParte(p.t)} para a esquerda`}><ArrowLeft className="w-3.5 h-3.5" /></Button>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={i === partes.length - 1} onClick={() => mover(i, 1)} aria-label={`Mover ${nomeParte(p.t)} para a direita`}><ArrowRight className="w-3.5 h-3.5" /></Button>
                            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => mudar(partes.filter((_, j) => j !== i))} aria-label={`Tirar ${nomeParte(p.t)}`}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                        {p.t === 'seq' && (
                            <div className="flex flex-col gap-1.5">
                                <select aria-label="Como contar" className={seletor} value={p.escopo} onChange={(e) => setParte(i, { escopo: e.target.value })}>
                                    {ESCOPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                                <select aria-label="Quando recomeçar" className={seletor} value={p.reinicia} onChange={(e) => setParte(i, { reinicia: e.target.value })}>
                                    {REINICIOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                                <label className="flex items-center gap-1.5 text-xs">Dígitos
                                    <Input type="number" min={1} max={10} className="h-8 w-16" value={p.digitos} onChange={(e) => setParte(i, { digitos: Math.min(10, Math.max(1, Number(e.target.value) || 1)) })} />
                                </label>
                            </div>
                        )}
                        {p.t === 'ano' && (
                            <select aria-label="Formato do ano" className={seletor} value={p.digitos} onChange={(e) => setParte(i, { digitos: Number(e.target.value) })}>
                                <option value={4}>4 dígitos</option><option value={2}>2 dígitos</option>
                            </select>
                        )}
                        {p.t === 'texto' && (
                            <div className="flex flex-wrap items-center gap-1">
                                <Input aria-label="Texto fixo" className="h-8 w-20 font-mono" maxLength={10} value={p.v} onChange={(e) => setParte(i, { v: e.target.value })} />
                                {SEPARADORES.filter((s) => s !== p.v).map((s) => (
                                    <button key={s} type="button" className="h-7 min-w-7 rounded border border-slate-200 dark:border-slate-700 px-1.5 font-mono text-xs hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setParte(i, { v: s })} aria-label={`Usar ${s === ' ' ? 'espaço' : s}`}>{s === ' ' ? '␣' : s}</button>
                                ))}
                            </div>
                        )}
                    </li>
                ))}
            </ol>
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1"><Plus className="w-3.5 h-3.5" aria-hidden /> Acrescentar:</span>
                {PARTES_NUMERO.filter(([t]) => t !== 'seq' || !temSeq).map(([t, l]) => (
                    <Button key={t} type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={partes.length >= 12} onClick={() => mudar([...partes, novaParte(t)])}>
                        {t === 'seq' && <Hash className="w-3 h-3" aria-hidden />}{l}
                    </Button>
                ))}
            </div>
            {problemas.length > 0 && (
                <ul className="text-sm text-amber-800 dark:text-amber-300 list-disc pl-5" role="alert">
                    {problemas.map((m) => <li key={m}>{m}</li>)}
                </ul>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-400">Sem sigla cadastrada, entram as iniciais do nome. O número nunca se repete: se uma mudança fizer a contagem cair num número já usado, ela pula para o próximo livre.</p>
        </div>
    );
}
