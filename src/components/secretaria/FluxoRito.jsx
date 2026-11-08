import React, { useMemo } from 'react';
import { niveisDoFluxo, seguintes } from '@/lib/secretariaRito';

// Diagrama do fluxo de um rito, de cima para baixo: cada linha é um passo do
// fluxo; ramificações ficam lado a lado; voltas aparecem tracejadas pela
// lateral. SVG puro, segue o tema claro/escuro e rola na horizontal em telas
// estreitas. A lista oculta repete o fluxo em texto para leitores de tela.
const W = 168;
const H = 52;
const GX = 24;
const GY = 40;

export default function FluxoRito({ fases, atual, onSelecionar, className = '' }) {
    const g = useMemo(() => {
        const nivel = niveisDoFluxo(fases);
        const linhas = [];
        fases.forEach((f) => { (linhas[nivel.get(f.id)] ||= []).push(f); });
        // Margem lateral larga o bastante para as voltas, que passam por fora.
        const largura = Math.max(1, ...linhas.map((l) => l?.length || 0)) * (W + GX) - GX + 112;
        const pos = new Map();
        linhas.forEach((l, li) => (l || []).forEach((f, k) => {
            const total = l.length * (W + GX) - GX;
            pos.set(f.id, { x: (largura - total) / 2 + k * (W + GX), y: 8 + li * (H + GY) });
        }));
        const arestas = [];
        fases.forEach((f, i) => seguintes(fases, i).forEach((alvo) => arestas.push({ de: f.id, para: alvo })));
        return { pos, arestas, largura, altura: linhas.length * (H + GY) - GY + 16 };
    }, [fases]);

    if (!fases.length) return null;
    const nome = (id) => fases.find((f) => f.id === id)?.nome || id;

    return (
        <div className={`overflow-x-auto ${className}`}>
            <svg viewBox={`0 0 ${g.largura} ${g.altura}`} width={g.largura} height={g.altura} className="mx-auto block max-w-none" role="img" aria-label="Diagrama do fluxo do rito">
                <defs>
                    <marker id="seta-fluxo" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M0,0 L10,5 L0,10 z" className="fill-slate-400 dark:fill-slate-500" />
                    </marker>
                </defs>
                {g.arestas.map(({ de, para }) => {
                    const a = g.pos.get(de);
                    const b = g.pos.get(para);
                    if (!a || !b) return null;
                    const volta = b.y <= a.y;
                    // Atalho que pula linhas passaria por trás das fases do meio: vai por fora, à esquerda.
                    const atalho = !volta && b.y - a.y > H + GY && a.x === b.x;
                    const d = volta
                        // Volta: sai pela direita e entra pela direita, por fora.
                        ? `M${a.x + W},${a.y + H / 2} C${a.x + W + 40},${a.y + H / 2} ${b.x + W + 40},${b.y + H / 2} ${b.x + W + 2},${b.y + H / 2}`
                        : atalho
                            ? `M${a.x},${a.y + H / 2} C${a.x - 40},${a.y + H / 2} ${b.x - 40},${b.y + H / 2} ${b.x - 2},${b.y + H / 2}`
                            : `M${a.x + W / 2},${a.y + H} C${a.x + W / 2},${a.y + H + GY / 2} ${b.x + W / 2},${b.y - GY / 2} ${b.x + W / 2},${b.y - 2}`;
                    return <path key={`${de}-${para}`} d={d} fill="none" strokeWidth="1.5" markerEnd="url(#seta-fluxo)" strokeDasharray={volta ? '5 4' : undefined} className="stroke-slate-400 dark:stroke-slate-500" />;
                })}
                {fases.map((f, i) => {
                    const p = g.pos.get(f.id);
                    const ativo = f.id === atual;
                    const fim = seguintes(fases, i).length === 0;
                    const titulo = f.nome.length > 22 ? `${f.nome.slice(0, 21)}…` : f.nome;
                    const Tag = 'g';
                    const props = onSelecionar ? { role: 'button', tabIndex: 0, onClick: () => onSelecionar(f.id), onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && onSelecionar(f.id), className: 'cursor-pointer focus:outline-none' } : {};
                    return (
                        <Tag key={f.id} {...props}>
                            <title>{`${i + 1}. ${f.nome}${f.prazo_dias ? ` · ${f.prazo_dias} dias` : ''}${f.orientacao ? `\n${f.orientacao}` : ''}`}</title>
                            <rect x={p.x} y={p.y} width={W} height={H} rx={fim ? 26 : 8} strokeWidth={ativo ? 2.5 : 1.25}
                                className={ativo ? 'fill-indigo-50 stroke-indigo-600 dark:fill-indigo-950 dark:stroke-indigo-400' : 'fill-white stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-600'} />
                            <text x={p.x + W / 2} y={p.y + (f.prazo_dias ? 22 : 30)} textAnchor="middle" fontSize="13" fontWeight={ativo ? 600 : 500} className="fill-slate-800 dark:fill-slate-100">{titulo}</text>
                            {f.prazo_dias && <text x={p.x + W / 2} y={p.y + 39} textAnchor="middle" fontSize="11" className="fill-slate-500 dark:fill-slate-400">{f.prazo_dias} dias</text>}
                        </Tag>
                    );
                })}
            </svg>
            <ol className="sr-only">
                {fases.map((f, i) => {
                    const s = seguintes(fases, i);
                    return <li key={f.id}>{f.nome}{f.id === atual ? ' (fase atual)' : ''}: {s.length ? `segue para ${s.map(nome).join(' ou ')}` : 'fim do fluxo'}</li>;
                })}
            </ol>
        </div>
    );
}
