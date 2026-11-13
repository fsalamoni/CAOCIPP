import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2, ZoomIn, ZoomOut } from 'lucide-react';
import { seguintes } from '@/lib/secretariaRito';
import { TH, TW, desenharFluxo, quebrar } from '@/lib/fluxoBpmn';

// Diagrama do fluxo de um rito no formato BPMN, como o Bizagi desenha: da
// esquerda para a direita, uma raia por unidade, círculo verde de início,
// tarefas em caixas azuis, losango amarelo quando a fase tem mais de uma
// saída (com a condição escrita na seta) e círculo vermelho no fim.
// Abre ajustado à largura (o fluxo inteiro à vista); dá para ampliar, rolar e
// ver em tela cheia. SVG puro, segue o tema claro/escuro. A lista oculta
// repete o fluxo em texto para leitores de tela. Geometria: lib/fluxoBpmn.js.

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const ESCALA_MINIMA = 0.85; // abaixo disso o texto fica ilegível: o fluxo passa a mudar de linha
const botao = 'inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded px-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-40';

/** Nome da raia de uma fase: o que a fase traz ou a unidade do órgão. */
function raiaPadrao(unidades) {
    const porId = new Map((unidades || []).map((u) => [u.id, u.sigla || u.nome]));
    return (f) => f.raia || porId.get(f.unidade_id) || (typeof f.unidade === 'string' ? f.unidade : '') || '';
}

export default function FluxoRito({ fases, atual, onSelecionar, unidades, raiaDe, className = '', alturaMaxima = '60vh', legenda = false, alertas = null }) {
    const uid = useId().replace(/:/g, '');
    const [zoom, setZoom] = useState(null); // null = ajustado à largura
    const [cheia, setCheia] = useState(false);
    const raia = useMemo(() => raiaDe || raiaPadrao(unidades), [raiaDe, unidades]);
    // O fluxo muda de linha quando não cabe na largura, para aparecer inteiro e legível.
    const caixa = useRef(null);
    const [larguraCaixa, setLarguraCaixa] = useState(0);
    const temFases = fases.length > 0;
    useEffect(() => {
        const el = caixa.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver(([e]) => setLarguraCaixa(Math.round(e.contentRect.width)));
        ro.observe(el);
        return () => ro.disconnect();
    }, [cheia, temFases]);
    const g = useMemo(() => {
        let d = desenharFluxo(fases, raia);
        if (!larguraCaixa) return d;
        const limite = larguraCaixa / ESCALA_MINIMA;
        for (let n = d.tarefas.reduce((m, t) => Math.max(m, t.col), 0); n >= 2 && d.largura > limite; n--) d = desenharFluxo(fases, raia, n);
        return d;
    }, [fases, raia, larguraCaixa]);

    useEffect(() => {
        if (!cheia) return undefined;
        const tecla = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setCheia(false); } };
        window.addEventListener('keydown', tecla, true);
        return () => window.removeEventListener('keydown', tecla, true);
    }, [cheia]);

    if (!fases.length) return null;
    const nome = (id) => fases.find((f) => f.id === id)?.nome || id;
    const passo = (d) => {
        const i = zoom === null ? ZOOMS.indexOf(1) : ZOOMS.indexOf(zoom);
        setZoom(ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + d))]);
    };
    const seta = `seta-${uid}`;

    const svg = (
        <svg viewBox={`0 0 ${g.largura} ${g.altura}`} role="img" aria-label="Diagrama do fluxo do rito"
            style={zoom === null ? { width: '100%', maxWidth: g.largura * 1.15, height: 'auto' } : { width: g.largura * zoom, height: g.altura * zoom, maxWidth: 'none' }}
            className="mx-auto block">
            <defs>
                <marker id={seta} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" className="fill-slate-600 dark:fill-slate-300" />
                </marker>
                <linearGradient id={`tarefa-${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#f5f9fe" /><stop offset="1" stopColor="#d6e6f7" />
                </linearGradient>
            </defs>
            {/* Raias */}
            {g.raias.map((r) => (
                <g key={`${r.faixa}:${r.nome}`}>
                    <rect x={r.x} y={r.y} width={r.largura} height={r.altura} strokeWidth="1" className="fill-white stroke-slate-400 dark:fill-slate-900 dark:stroke-slate-600" />
                    {r.cab > 0 && (
                        <>
                            <rect x={r.x} y={r.y} width={r.cab} height={r.altura} strokeWidth="1" className="fill-slate-100 stroke-slate-400 dark:fill-slate-800 dark:stroke-slate-600" />
                            <text transform={`translate(${r.x + r.cab / 2},${r.y + r.altura / 2}) rotate(-90)`} textAnchor="middle" fontSize="10"fontWeight="600" className="fill-slate-700 dark:fill-slate-200">
                                <title>{r.nome}</title>
                                {(() => {
                                    const ls = quebrar(r.nome, Math.max(6, Math.floor(r.altura / 5.8)), 2);
                                    return ls.map((l, k) => <tspan key={k} x="0" y={ls.length === 1 ? 4 : k * 13 - 2.5}>{l}</tspan>);
                                })()}
                            </text>
                        </>
                    )}
                </g>
            ))}
            {/* Setas */}
            {g.setas.map((s, k) => (
                <path key={k} d={s.d} fill="none" strokeWidth="1.4" strokeLinejoin="round" markerEnd={s.tipo === 'fim' || s.tipo === 'desvio' ? undefined : `url(#${seta})`}
                    strokeDasharray={s.tipo === 'volta' ? '5 4' : undefined} className="stroke-slate-600 dark:stroke-slate-300" />
            ))}
            {g.setas.filter((s) => s.rotulo).map((s, k) => (
                <text key={k} x={s.rx} y={s.ry} textAnchor="end" fontSize="10" fontStyle="italic" paintOrder="stroke" strokeWidth="3.5" strokeLinejoin="round"
                    className="fill-slate-800 stroke-white dark:fill-slate-100 dark:stroke-slate-900">
                    <title>{s.rotuloCompleto}</title>{s.rotulo}
                </text>
            ))}
            {/* Início, desvios e fins */}
            <circle cx={g.inicio.cx} cy={g.inicio.cy} r={g.inicio.r} strokeWidth="1.5" className="fill-[#e6f4c8] stroke-[#5b9a12] dark:fill-[#2f4a12] dark:stroke-[#9bd14a]"><title>Início</title></circle>
            {g.desvios.map((d) => (
                <g key={d.id}>
                    <title>Desvio: o processo segue por uma das saídas</title>
                    <path d={`M${d.cx - d.r},${d.cy} L${d.cx},${d.cy - d.r} L${d.cx + d.r},${d.cy} L${d.cx},${d.cy + d.r} z`} strokeWidth="1.4" className="fill-[#fff7c2] stroke-[#a58a00] dark:fill-[#4a4210] dark:stroke-[#e2c94a]" />
                    <path d={`M${d.cx - 5},${d.cy - 5} L${d.cx + 5},${d.cy + 5} M${d.cx + 5},${d.cy - 5} L${d.cx - 5},${d.cy + 5}`} strokeWidth="1.8" className="stroke-[#7a6600] dark:stroke-[#e2c94a]" />
                </g>
            ))}
            {g.fins.map((f) => <circle key={f.id} cx={f.cx} cy={f.cy} r={f.r} strokeWidth="3.5" className="fill-[#f8d2d2] stroke-[#a61b1b] dark:fill-[#4a1717] dark:stroke-[#ef7373]"><title>Fim do processo</title></circle>)}
            {/* Tarefas */}
            {g.tarefas.map((t) => {
                const f = fases[t.indice];
                const ativo = f.id === atual;
                const props = onSelecionar ? { role: 'button', tabIndex: 0, onClick: () => onSelecionar(f.id), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelecionar(f.id); } }, className: 'cursor-pointer focus:outline-none group' } : {};
                const alturaTexto = t.linhas.length * 12 + (t.prazo ? 12 : 0);
                const y0 = t.y + (TH - alturaTexto) / 2 + 9;
                return (
                    <g key={t.id} {...props}>
                        <title>{`${t.indice + 1}. ${f.nome}${f.prazo_dias ? ` · ${f.prazo_dias} dias` : ''}${alertas?.has(f.id) ? ' · fora do caminho até o fim (veja as pendências)' : ''}${f.orientacao ? `\n${f.orientacao}` : ''}`}</title>
                        {alertas?.has(f.id) && <rect x={t.x - 3} y={t.y - 3} width={TW + 6} height={TH + 6} rx="10" strokeWidth="2" strokeDasharray="5 3" fill="none" className="stroke-amber-500 dark:stroke-amber-400" />}
                        {ativo && <rect x={t.x - 4} y={t.y - 4} width={TW + 8} height={TH + 8} rx="11" strokeWidth="2.5" fill="none" className="stroke-indigo-600 dark:stroke-indigo-400" />}
                        <rect x={t.x} y={t.y} width={TW} height={TH} rx="8" strokeWidth="1.4" fill={`url(#tarefa-${uid})`}
                            className={`stroke-[#2c6aa8] dark:stroke-[#7fb2e6] dark:[fill:#1c2f47] ${onSelecionar ? 'group-hover:stroke-indigo-600 group-focus-visible:stroke-indigo-600 group-focus-visible:[stroke-width:2.5]' : ''}`} />
                        {t.linhas.map((l, k) => <text key={k} x={t.cx} y={y0 + k * 12} textAnchor="middle" fontSize="10.5" fontWeight={ativo ? 700 : 500} className="fill-slate-900 dark:fill-slate-50">{l}</text>)}
                        {t.prazo && <text x={t.cx} y={y0 + t.linhas.length * 12} textAnchor="middle" fontSize="9.5" className="fill-slate-600 dark:fill-slate-300">{t.prazo} dias</text>}
                    </g>
                );
            })}
        </svg>
    );

    return (
        <div className={`${cheia ? 'fixed inset-0 z-[70] flex flex-col bg-white dark:bg-slate-950 p-3' : ''} ${className}`}>
            <div className="mb-1.5 flex flex-wrap items-center gap-1">
                {cheia && <span className="mr-2 text-sm font-semibold">Fluxo do rito</span>}
                {legenda && (
                    <span className="mr-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300" aria-hidden>
                        <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full border border-[#5b9a12] bg-[#e6f4c8]" />Início</span>
                        <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm border border-[#2c6aa8] bg-[#d6e6f7]" />Fase</span>
                        <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rotate-45 border border-[#a58a00] bg-[#fff7c2]" />Desvio</span>
                        <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#a61b1b] bg-[#f8d2d2]" />Fim</span>
                        <span className="inline-flex items-center gap-1"><i className="inline-block w-4 border-t border-dashed border-slate-600" />Volta</span>
                        {alertas?.size > 0 && <span className="inline-flex items-center gap-1"><i className="inline-block h-2.5 w-4 rounded-sm border-2 border-dashed border-amber-500" />Fora do caminho</span>}
                    </span>
                )}
                <div className={`flex items-center gap-0.5 rounded-md bg-slate-100 dark:bg-slate-800 p-0.5 ${legenda ? '' : 'ml-auto'}`} role="group" aria-label="Visualização do fluxo">
                    <button type="button" className={botao} onClick={() => passo(-1)} disabled={zoom === ZOOMS[0]} aria-label="Reduzir" title="Reduzir"><ZoomOut className="h-3.5 w-3.5" aria-hidden /></button>
                    <button type="button" className={`${botao} ${zoom === null ? 'bg-white dark:bg-slate-900 shadow-sm font-medium' : ''}`} onClick={() => setZoom(null)} aria-pressed={zoom === null} title="Ajustar o fluxo à largura da tela">{zoom === null ? 'Fluxo inteiro' : `${Math.round(zoom * 100)}%`}</button>
                    <button type="button" className={botao} onClick={() => passo(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Ampliar" title="Ampliar"><ZoomIn className="h-3.5 w-3.5" aria-hidden /></button>
                    <button type="button" className={botao} onClick={() => setCheia(!cheia)} title={cheia ? 'Sair da tela cheia (Esc)' : 'Ver em tela cheia'}>
                        {cheia ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
                        <span>{cheia ? 'Fechar' : 'Tela cheia'}</span>
                    </button>
                </div>
            </div>
            <div className={`overflow-auto rounded-md ${cheia ? 'flex-1 min-h-0' : ''}`} style={cheia ? undefined : { maxHeight: alturaMaxima }} ref={caixa} tabIndex={0} aria-label="Diagrama do fluxo (role para ver tudo)">
                {svg}
            </div>
            <ol className="sr-only">
                {fases.map((f, i) => {
                    const s = seguintes(fases, i);
                    return <li key={f.id}>{f.nome}{raia(f) ? ` (${raia(f)})` : ''}{f.id === atual ? ' (fase atual)' : ''}: {s.length ? `segue para ${s.map((id) => `${nome(id)}${f.condicoes?.[id] ? ` (${f.condicoes[id]})` : ''}`).join(' ou ')}` : 'fim do fluxo'}</li>;
                })}
            </ol>
        </div>
    );
}
