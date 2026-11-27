import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { bibliotecaDeModelos, nomeArea, nomePorte } from '@/lib/bibliotecaRitos';
import { RECURSOS_FILTRO, usaRecurso } from '@/lib/bibliotecaFiltro';
import { ETAPAS, PERGUNTAS_MODELO, TEMAS, buscarReceitas, sugerirModelos } from '@/lib/tutorialRito';

// Tutorial do Guia do rito: passo a passo em etapas, receitas "quero fazer
// isto, use aquilo" e escolha do modelo da biblioteca. Os textos estão em
// lib/tutorialRito.js; `onParte(n)` abre a parte n da referência do guia.

const MODELOS = bibliotecaDeModelos();
const POR_ID = Object.fromEntries(MODELOS.map((m) => [m.id, m]));
const NOME_TEMA = Object.fromEntries(TEMAS);
const titulo = 'font-semibold text-slate-900 dark:text-white';
const caixa = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900';

function LinkParte({ n, onParte }) {
    if (!n) return null;
    return (
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-indigo-700 dark:text-indigo-300" onClick={() => onParte(n)}>
            Ver no guia: parte {n}
        </Button>
    );
}

function Modelos({ ids }) {
    const nomes = (ids || []).map((id) => POR_ID[id]?.nome).filter(Boolean);
    if (!nomes.length) return null;
    return <p className="text-xs text-slate-600 dark:text-slate-400">Pronto na biblioteca: {nomes.join('; ')}.</p>;
}

function PassoAPasso({ onParte }) {
    const [i, setI] = useState(0);
    const [feitos, setFeitos] = useState({});
    const cabecalho = useRef(null);
    const primeira = useRef(true);
    const e = ETAPAS[i];
    useEffect(() => {
        if (primeira.current) { primeira.current = false; return; }
        cabecalho.current?.focus();
    }, [i]);
    const marcar = (k) => setFeitos((f) => ({ ...f, [k]: !f[k] }));
    const completa = (j) => ETAPAS[j].conferir.every((_, c) => feitos[`${j}-${c}`]);
    return (
        <div className="space-y-3">
            <nav aria-label="Etapas do tutorial">
                <ol className="flex flex-wrap gap-1.5">
                    {ETAPAS.map((x, j) => (
                        <li key={x.id}>
                            <button type="button" onClick={() => setI(j)} title={x.titulo} aria-label={`Etapa ${j + 1}: ${x.titulo}${completa(j) ? ' (conferida)' : ''}`}
                                aria-current={j === i ? 'step' : undefined}
                                className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${j === i
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : completa(j) ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                {completa(j) && j !== i ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : j + 1}
                            </button>
                        </li>
                    ))}
                </ol>
            </nav>
            <section className={`${caixa} space-y-3 p-3 text-sm text-slate-700 dark:text-slate-200`} aria-labelledby="tut-etapa">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Etapa {i + 1} de {ETAPAS.length}</p>
                    <h3 id="tut-etapa" ref={cabecalho} tabIndex={-1} className={`text-base ${titulo} focus:outline-none`}>{e.titulo}</h3>
                    <p className="mt-1">{e.objetivo}</p>
                </div>
                <div>
                    <h4 className={titulo}>Faça assim</h4>
                    <ol className="mt-1 list-decimal space-y-1.5 pl-5">{e.passos.map((p) => <li key={p}>{p}</li>)}</ol>
                </div>
                <div>
                    <h4 className={titulo}>Perguntas desta etapa</h4>
                    <div className="mt-1 space-y-1.5">
                        {e.perguntas.map((q) => (
                            <details key={q.p} className="rounded-md border border-slate-200 dark:border-slate-700">
                                <summary className="cursor-pointer select-none px-2.5 py-2 font-medium text-slate-900 dark:text-white">{q.p}</summary>
                                <div className="space-y-1 border-t border-slate-200 dark:border-slate-700 px-2.5 py-2">
                                    <p>{q.r}</p>
                                    <Modelos ids={q.modelos} />
                                    <LinkParte n={q.parte} onParte={onParte} />
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
                <fieldset>
                    <legend className={titulo}>Antes de seguir, confira</legend>
                    <ul className="mt-1 space-y-1">
                        {e.conferir.map((c, k) => {
                            const id = `tut-${i}-${k}`;
                            return (
                                <li key={c} className="flex items-start gap-2">
                                    <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 accent-indigo-600" checked={!!feitos[`${i}-${k}`]} onChange={() => marcar(`${i}-${k}`)} />
                                    <label htmlFor={id}>{c}</label>
                                </li>
                            );
                        })}
                    </ul>
                </fieldset>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-700 pt-2">
                    <Button type="button" variant="outline" size="sm" className="gap-1" disabled={i === 0} onClick={() => setI(i - 1)}><ArrowLeft className="h-4 w-4" aria-hidden /> Anterior</Button>
                    {i < ETAPAS.length - 1
                        ? <Button type="button" size="sm" className="gap-1" onClick={() => setI(i + 1)} title={ETAPAS[i + 1].titulo}>Próxima etapa <ArrowRight className="h-4 w-4" aria-hidden /></Button>
                        : <p className="text-sm text-slate-600 dark:text-slate-400">Fim do tutorial. Consulte a referência sempre que precisar do detalhe de uma opção.</p>}
                </div>
            </section>
        </div>
    );
}

function Receitas({ onParte }) {
    const [busca, setBusca] = useState('');
    const [tema, setTema] = useState('');
    const lista = useMemo(() => buscarReceitas(busca, tema), [busca, tema]);
    return (
        <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-200">Diga o que quer que o processo faça e veja qual ferramenta usar, onde ela fica e o modelo da biblioteca que já faz assim.</p>
            <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
                <Input type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Ex.: audiência, sigilo, prazo, assinatura, fornecedor" aria-label="Buscar o que você quer fazer" className="pl-8" />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tema">
                {[['', 'Todos'], ...TEMAS].map(([k, rotulo]) => (
                    <button key={k || 'todos'} type="button" aria-pressed={tema === k} onClick={() => setTema(k)}
                        className={`rounded-full border px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${tema === k ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                        {rotulo}
                    </button>
                ))}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400" aria-live="polite">{lista.length === 1 ? '1 resposta' : `${lista.length} respostas`}</p>
            {lista.length === 0 && <p className={`${caixa} p-3 text-sm text-slate-700 dark:text-slate-200`}>Nada encontrado. Tente outra palavra ou veja o passo a passo, que percorre todas as ferramentas.</p>}
            <ul className="space-y-2">
                {lista.map((r) => (
                    <li key={r.quero} className={`${caixa} space-y-1 p-3 text-sm text-slate-700 dark:text-slate-200`}>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{NOME_TEMA[r.tema]}</p>
                        <p className={titulo}>Quero: {r.quero}</p>
                        <p><strong className="text-slate-900 dark:text-white">Use:</strong> {r.use}</p>
                        <p><strong className="text-slate-900 dark:text-white">Onde:</strong> {r.onde}</p>
                        <Modelos ids={r.modelos} />
                        <LinkParte n={r.parte} onParte={onParte} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

const ROTULO_RECURSO = Object.fromEntries(RECURSOS_FILTRO.filter(([k]) => k));

function EscolherModelo() {
    const [resp, setResp] = useState({});
    const r = useMemo(() => sugerirModelos(MODELOS, resp), [resp]);
    return (
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <p>Responda e veja os modelos da biblioteca mais próximos do seu processo. Para usar um deles, vá em Ritos, Novo rito, Biblioteca de modelos de processo, busque pelo nome e clique em Usar. Você ajusta tudo antes de implantar.</p>
            <div className="grid gap-3 sm:grid-cols-2">
                {PERGUNTAS_MODELO.map((q) => (
                    <fieldset key={q.id} className={`${caixa} p-3`}>
                        <legend className={`px-1 ${titulo}`}>{q.pergunta}</legend>
                        <div className="mt-1 space-y-1">
                            {q.opcoes.map(([v, rotulo]) => {
                                const id = `tm-${q.id}-${v || 'qualquer'}`;
                                return (
                                    <div key={id} className="flex items-start gap-2">
                                        <input id={id} type="radio" name={`tm-${q.id}`} className="mt-0.5 h-4 w-4 accent-indigo-600" checked={(resp[q.id] || '') === v} onChange={() => setResp({ ...resp, [q.id]: v })} />
                                        <label htmlFor={id}>{rotulo}</label>
                                    </div>
                                );
                            })}
                        </div>
                    </fieldset>
                ))}
            </div>
            <div aria-live="polite" className="space-y-2">
                <p className={titulo}>{r.total === 0 ? 'Nenhum modelo encontrado' : r.total === 1 ? '1 modelo indicado' : `${r.total} modelos indicados${r.total > r.modelos.length ? `, os ${r.modelos.length} primeiros abaixo` : ''}`}</p>
                {r.soltos.length > 0 && <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">Nenhum modelo atende a tudo. Mostramos os mais próximos, sem considerar {r.soltos.join(' e ')}.</p>}
                {r.total === 0 && <p>Comece pelo rito em branco e siga o passo a passo.</p>}
                <ul className="space-y-2">
                    {r.modelos.map((m) => {
                        const usa = Object.keys(ROTULO_RECURSO).filter((k) => usaRecurso(m, k)).map((k) => ROTULO_RECURSO[k].toLowerCase());
                        return (
                            <li key={m.id} className={`${caixa} space-y-1 p-3`}>
                                <p className={titulo}>{m.nome}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-400">{nomeArea(m.area)} · {nomePorte(m.porte)} · {m.fases.length} fases{m.referencia ? ` · ${m.referencia}` : ''}</p>
                                <p><strong className="text-slate-900 dark:text-white">Quando usar:</strong> {m.quando}</p>
                                {usa.length > 0 && <p><strong className="text-slate-900 dark:text-white">Usa:</strong> {usa.join(', ')}.</p>}
                                <p className="text-xs text-slate-600 dark:text-slate-400">Fases: {m.fases.map((f) => f.nome).join(', ')}.</p>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}

/** Tutorial com três abas. `onParte(n)`: abre a parte n da referência do Guia do rito. */
export default function TutorialRito({ onParte }) {
    return (
        <Tabs defaultValue="passos">
            <TabsList className="h-auto flex-wrap justify-start">
                <TabsTrigger value="passos">Passo a passo</TabsTrigger>
                <TabsTrigger value="receitas">Quero fazer…</TabsTrigger>
                <TabsTrigger value="modelo">Qual modelo usar?</TabsTrigger>
            </TabsList>
            <TabsContent value="passos"><PassoAPasso onParte={onParte} /></TabsContent>
            <TabsContent value="receitas"><Receitas onParte={onParte} /></TabsContent>
            <TabsContent value="modelo"><EscolherModelo /></TabsContent>
        </Tabs>
    );
}
