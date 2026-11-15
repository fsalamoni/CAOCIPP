import React, { useId, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Flag, Search, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AREAS, PORTES, bibliotecaDeModelos, nomeArea, nomePorte } from '@/lib/bibliotecaRitos';
import { FILTRO_VAZIO, ORDENS, agrupar, filtrar, filtroAtivo, ordenar, recursosEmTexto, referencias, temPartes, trechos } from '@/lib/bibliotecaFiltro';
import { NativeSelect } from './comum';

const CHAVE_ABERTA = 'sigo.biblioteca.aberta';
const lerAberta = () => { try { return localStorage.getItem(CHAVE_ABERTA) !== '0'; } catch { return true; } };
const gravarAberta = (v) => { try { localStorage.setItem(CHAVE_ABERTA, v ? '1' : '0'); } catch { /* sem armazenamento: só não lembra */ } };

/** Texto com os termos da busca destacados. */
function Destaque({ texto, busca }) {
    return trechos(texto, busca).map((p, i) => (p.marca
        ? <mark key={i} className="rounded-sm bg-amber-100 text-inherit dark:bg-amber-800/60">{p.t}</mark>
        : <React.Fragment key={i}>{p.t}</React.Fragment>));
}

function Modelo({ m, busca, aberto, comArea, onAlternar, onUsar }) {
    const det = `modelo-${m.id}-detalhes`;
    const recursos = recursosEmTexto(m);
    const partes = temPartes(m) ? m.tipo.polos.map((x) => m.tipo.nomes_polos?.[x] || x) : [];
    return (
        <li className={`rounded-md border bg-white dark:bg-slate-900 ${aberto ? 'lg:col-span-2 border-indigo-300 dark:border-indigo-800' : 'border-slate-200 dark:border-slate-700'}`}>
            <div className="flex items-start gap-2 p-2.5">
                <button type="button" onClick={onAlternar} aria-expanded={aberto} aria-controls={det}
                    className="flex-1 min-w-0 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                    <span className="flex items-start gap-1.5">
                        {aberto ? <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" aria-hidden /> : <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" aria-hidden />}
                        <span className="min-w-0">
                            <span className="block font-medium text-sm text-slate-900 dark:text-slate-100"><Destaque texto={m.nome} busca={busca} /></span>
                            <span className="mt-1 flex flex-wrap items-center gap-1">
                                {comArea && <Badge variant="secondary" className="text-[11px] font-normal">{nomeArea(m.area)}</Badge>}
                                <Badge variant="outline" className="text-[11px] font-normal">{nomePorte(m.porte)} · {m.fases.length} fases</Badge>
                                {m.referencia && <Badge variant="outline" className="text-[11px] font-normal border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-300"><Destaque texto={m.referencia} busca={busca} /></Badge>}
                                {partes.length > 0 && <Badge variant="outline" className="text-[11px] font-normal gap-1"><Users className="w-3 h-3" aria-hidden /> {partes.join(' e ')}</Badge>}
                            </span>
                            {!aberto && <span className="mt-1 text-xs text-slate-600 dark:text-slate-300 line-clamp-2"><Destaque texto={m.descricao} busca={busca} /></span>}
                        </span>
                    </span>
                </button>
                <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={onUsar} aria-label={`Usar o modelo ${m.nome}`}>Usar</Button>
            </div>
            {aberto && (
                <div id={det} className="space-y-2 border-t border-slate-100 dark:border-slate-800 px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <p><Destaque texto={m.descricao} busca={busca} /></p>
                    <p><b>Quando usar:</b> <Destaque texto={m.quando} busca={busca} /></p>
                    <p><b>Base:</b> <Destaque texto={m.base} busca={busca} /></p>
                    {partes.length > 0 && <p><b>Partes:</b> {partes.join(', ')}. A revisão propõe criar o tipo de processo com esses polos.</p>}
                    {recursos.length > 0 && <p><b>O que o rito faz:</b> {recursos.join('; ')}.</p>}
                    <div>
                        <p className="font-semibold">Fases</p>
                        <ol className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
                            {m.fases.map((f, i) => (
                                <li key={f.id} className="flex items-baseline gap-1.5">
                                    <span className="w-5 shrink-0 text-right tabular-nums text-slate-400">{i + 1}.</span>
                                    <span className="min-w-0">
                                        <Destaque texto={f.nome} busca={busca} />
                                        {f.final && <Flag className="ml-1 inline w-3 h-3 text-emerald-600" aria-label="fase final" />}
                                        <span className="text-slate-500 dark:text-slate-400">
                                            {f.prazo_dias ? ` · ${f.prazo_dias} dias${f.prazo_contagem === 'corridos' ? ' corridos' : ''}` : ''}{f.unidade ? ` · ${f.unidade}` : ''}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                    <Button size="sm" className="h-7 text-xs" onClick={onUsar}>Usar este modelo</Button>
                </div>
            )}
        </li>
    );
}

/**
 * Biblioteca de modelos de processo, por área: seção colapsável, com busca (sem
 * acentos, com destaque), filtros (área, porte, inspiração) e ordem.
 * Os grupos ficam fechados até haver filtro; o órgão revisa tudo antes de implantar.
 */
export default function BibliotecaModelos({ onEscolher }) {
    // Gerados uma vez só para listar; ao escolher, gera de novo com ids novos.
    const modelos = useMemo(() => bibliotecaDeModelos(), []);
    const uid = useId();
    const [aberta, setAberta] = useState(lerAberta);
    const [f, setF] = useState(FILTRO_VAZIO);
    const [ordem, setOrdem] = useState('area');
    const [grupos, setGrupos] = useState({});
    const [detalhe, setDetalhe] = useState(() => new Set());
    const ativo = filtroAtivo(f);
    const mudar = (campo, v) => { setF((x) => ({ ...x, [campo]: v })); setGrupos({}); };
    const limpar = () => { setF(FILTRO_VAZIO); setGrupos({}); };
    const alternarAberta = (v = !aberta) => { setAberta(v); gravarAberta(v); };
    const alternarDetalhe = (id) => setDetalhe((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

    const areas = AREAS.filter(([a]) => modelos.some((m) => m.area === a));
    const refs = referencias(modelos);
    const achados = filtrar(modelos, f);
    const agrupado = ordem === 'area';
    const lista = ordenar(achados, agrupado && f.busca.trim() ? 'relevancia' : ordem, f.busca);
    const gs = agrupado ? agrupar(lista) : [];
    const grupoAberto = (a) => grupos[a] ?? (ativo || gs.length === 1);
    const todosAbertos = gs.length > 0 && gs.every((g) => grupoAberto(g.area));

    // O id do modelo é da biblioteca, não do rito: com ele, a implantação tomaria o modelo por um rito já gravado.
    const escolher = (id) => {
        const { id: _modelo, ...r } = bibliotecaDeModelos().find((m) => m.id === id);
        onEscolher(r);
    };
    const item = (m) => (
        <Modelo key={m.id} m={m} busca={f.busca} aberto={detalhe.has(m.id)} comArea={!agrupado} onAlternar={() => alternarDetalhe(m.id)} onUsar={() => escolher(m.id)} />
    );

    return (
        <section aria-labelledby={`${uid}-titulo`} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
            <div className="flex flex-wrap items-center gap-2 p-3">
                <h3 id={`${uid}-titulo`} className="text-sm font-semibold">
                    <button type="button" onClick={() => alternarAberta()} aria-expanded={aberta} aria-controls={`${uid}-corpo`}
                        className="flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                        {aberta ? <ChevronDown className="w-4 h-4" aria-hidden /> : <ChevronRight className="w-4 h-4" aria-hidden />}
                        <BookOpen className="w-4 h-4 text-indigo-600" aria-hidden /> Biblioteca de modelos de processo
                    </button>
                </h3>
                <span className="text-xs text-slate-600 dark:text-slate-400">{modelos.length} modelos em {areas.length} áreas</span>
            </div>
            {!aberta && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                    {areas.map(([a, nome]) => (
                        <button key={a} type="button" onClick={() => { setF({ ...FILTRO_VAZIO, area: a }); setGrupos({}); alternarAberta(true); }}
                            className="rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-0.5 text-xs hover:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                            {nome} <span className="text-slate-500">{modelos.filter((m) => m.area === a).length}</span>
                        </button>
                    ))}
                </div>
            )}
            {aberta && (
                <div id={`${uid}-corpo`} className="space-y-3 px-3 pb-3">
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                        Processos completos, com base na lei ou na norma de cada instituição: fases, unidades, prazos, comunicações às partes, audiências,
                        documentos e saídas. O modelo é só o ponto de partida: tudo se ajusta antes de implantar. Nenhum modelo é penal.
                    </p>
                    <div className="space-y-2">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" aria-hidden />
                            <Input aria-label="Buscar modelo" placeholder="Buscar por nome, instituição, lei ou fase"
                                value={f.busca} onChange={(e) => mudar('busca', e.target.value)} className="h-9 pl-8 pr-8" />
                            {f.busca && (
                                <button type="button" onClick={() => mudar('busca', '')} aria-label="Limpar a busca"
                                    className="absolute right-2 top-2 rounded p-0.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                                    <X className="w-4 h-4" aria-hidden />
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                            <NativeSelect id="biblioteca-area" label="Área" value={f.area} onChange={(v) => mudar('area', v)}
                                options={[['', 'Todas as áreas'], ...areas.map(([a, n]) => [a, `${n} (${modelos.filter((m) => m.area === a).length})`])]} />
                            <NativeSelect id="biblioteca-porte" label="Porte" value={f.porte} onChange={(v) => mudar('porte', v)} options={[['', 'Todos os portes'], ...PORTES]} />
                            <NativeSelect id="biblioteca-referencia" label="Inspirado em" value={f.referencia} onChange={(v) => mudar('referencia', v)}
                                options={[['', 'Qualquer instituição ou lei'], ...refs.map(([r, n]) => [r, `${r} (${n})`])]} />
                            <NativeSelect id="biblioteca-ordem" label="Ordenar" value={ordem} onChange={setOrdem} options={ORDENS} />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                            <span role="status" aria-live="polite" className="text-slate-600 dark:text-slate-400">
                                {ativo ? `${achados.length} de ${modelos.length} modelos` : `${modelos.length} modelos`}
                            </span>
                            {ativo && <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={limpar}>Limpar filtros</Button>}
                            {agrupado && gs.length > 1 && (
                                <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-xs"
                                    onClick={() => setGrupos(Object.fromEntries(gs.map((g) => [g.area, !todosAbertos])))}>
                                    {todosAbertos ? 'Recolher todas as áreas' : 'Abrir todas as áreas'}
                                </Button>
                            )}
                        </div>
                    </div>
                    {!achados.length && (
                        <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-600 p-4 text-center text-xs text-slate-600 dark:text-slate-300">
                            Nenhum modelo com esses filtros. <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={limpar}>Limpar filtros</Button>
                        </div>
                    )}
                    {agrupado ? (
                        <div className="space-y-2">
                            {gs.map((g) => {
                                const ab = grupoAberto(g.area);
                                const gid = `${uid}-area-${g.area}`;
                                return (
                                    <div key={g.area} className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60">
                                        <h4>
                                            <button type="button" aria-expanded={ab} aria-controls={gid} onClick={() => setGrupos((x) => ({ ...x, [g.area]: !ab }))}
                                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                                                {ab ? <ChevronDown className="w-4 h-4 text-slate-500" aria-hidden /> : <ChevronRight className="w-4 h-4 text-slate-500" aria-hidden />}
                                                <span className="flex-1">{g.nome}</span>
                                                <Badge variant="secondary" className="text-[11px]">{g.modelos.length}</Badge>
                                            </button>
                                        </h4>
                                        {!ab && <div className="px-9 pb-2 -mt-1"><p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{g.modelos.map((m) => m.nome).join(' · ')}</p></div>}
                                        {ab && <ul id={gid} className="grid items-start gap-2 px-2 pb-2 lg:grid-cols-2">{g.modelos.map(item)}</ul>}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        achados.length > 0 && (
                            <ul className="grid items-start gap-2 lg:grid-cols-2">
                                {lista.map(item)}
                            </ul>
                        )
                    )}
                </div>
            )}
        </section>
    );
}
