import React, { useContext, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDashed, LayoutGrid, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { NativeSelect } from './comum';
import { RegistroContexto } from './SeletorRegistro';
import {
    alvoDe, alvoDoRito, aplicarIntegracao, camposParaLevar, paineisDisponiveis, relatorioIntegracao, sugestoesDeIntegracao, valorDoAlvo,
} from '@/lib/painelModulos';

// Integração do rito com o painel do órgão (Consultas, Expedientes, Parcerias
// ou uma página própria): o que cada coluna do quadro pede e de onde vem no
// rito, com sugestões pelo nome. Lógica em src/lib/painelModulos.js; o
// servidor confere tudo ao salvar. Guia do rito, parte 21.

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Ícone e cor de cada estado da informação que a coluna pede. */
function EstadoInfo({ info }) {
    if (info.estado === 'auto') return <span className="flex gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden /><span><b className="font-medium">{info.rotulo}</b>: o sistema preenche ({info.auto}).</span></span>;
    if (info.estado === 'acao') return <span className="flex gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden /><span><b className="font-medium">{info.rotulo}</b>: vem de "{info.fonte.dado}", na fase {info.fonte.faseNome}.</span></span>;
    if (info.estado === 'falta') return <span className="flex gap-1.5 text-amber-900 dark:text-amber-100"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden /><span><b className="font-medium">{info.rotulo}</b>: o painel pede e nenhuma ação dá.</span></span>;
    return <span className="flex gap-1.5 text-slate-600 dark:text-slate-400"><CircleDashed className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden /><span>{info.rotulo}: opcional, nenhuma ação dá.</span></span>;
}

/**
 * Painel "Integração com o painel" no editor do rito. `fases`: as do rito em
 * edição; `onAplicar(fases, n)`: grava as fases com as sugestões aplicadas;
 * `irParaFase(id)`: abre a fase no editor.
 */
export default function IntegracaoPainel({ fases, onAplicar, irParaFase }) {
    const { ligadas, paginas } = useContext(RegistroContexto);
    const opcoes = paineisDisponiveis(ligadas, paginas);
    const doRito = alvoDoRito(fases);
    const [escolhido, setEscolhido] = useState('');
    const valor = escolhido || valorDoAlvo(doRito) || opcoes[0]?.[0] || '';
    const alvo = valor ? alvoDe(valor) : null;
    const rel = useMemo(() => (alvo ? relatorioIntegracao(fases, alvo, paginas) : null), [fases, valor, paginas]);
    const sugestoes = useMemo(() => (alvo ? sugestoesDeIntegracao(fases, alvo, paginas) : []), [fases, valor, paginas]);
    const [fora, setFora] = useState(() => new Set());
    const [aberto, setAberto] = useState(!!doRito);
    const escolhidas = sugestoes.filter((s) => !fora.has(s.chave));
    const integrado = !!doRito && valorDoAlvo(doRito) === valor;
    const estado = !opcoes.length ? 'Nenhum painel disponível'
        : !integrado ? 'Não integrado'
            : rel?.pronto ? 'Pronto' : `${plural(rel?.faltas.length || 0, 'pendência', 'pendências')}`;
    const corEstado = integrado && rel?.pronto ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100' : integrado ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
    return (
        <section aria-labelledby="int-painel" className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <button type="button" className="w-full flex items-center gap-2 p-3 text-left min-h-[2.75rem]" aria-expanded={aberto} aria-controls="int-painel-corpo" onClick={() => setAberto((x) => !x)}>
                <LayoutGrid className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden />
                <span id="int-painel" className="text-sm font-semibold flex-1">Integração com o painel</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${corEstado}`}>{estado}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {aberto && (
                <div id="int-painel-corpo" className="border-t border-slate-200 dark:border-slate-700 p-3 space-y-3">
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                        Cada fase pode mover o cartão do processo no painel (a coluna dele no quadro) e cada ação pode levar o dado que pede para a ficha do registro. Aqui você vê, coluna por coluna, se o rito cobre o que o painel precisa e aplica de uma vez o que o SIGO reconheceu pelos nomes. Para funcionar, o processo precisa estar ligado ao registro: nascer dele, ou o tipo de processo criá-lo na autuação.
                    </p>
                    {!opcoes.length ? (
                        <p className="text-sm text-amber-900 dark:text-amber-100">Nenhuma integração ligada. Ligue Consultas, Expedientes, Parcerias ou Páginas próprias em "Integrações com outros módulos", na configuração do Processo Eletrônico.</p>
                    ) : (
                        <>
                            <div className="sm:max-w-sm">
                                <NativeSelect id="int-painel-alvo" label="Painel" value={valor} onChange={(v) => { setEscolhido(v); setFora(new Set()); }} options={opcoes} />
                            </div>
                            {rel && (
                                <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" aria-label={`Colunas do ${rel.painel.nome}`}>
                                    {rel.colunas.map((c) => (
                                        <li key={c.id} className={`rounded-md border p-2 text-xs space-y-1.5 ${c.coberta ? 'border-slate-200 dark:border-slate-700' : 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30'}`}>
                                            <p className="text-sm font-semibold">{c.rotulo}</p>
                                            <p className="text-slate-700 dark:text-slate-300">
                                                {c.fases.length ? c.fases.map((f, k) => (
                                                    <React.Fragment key={f.id}>{k ? ', ' : 'Fase '}<button type="button" className="underline underline-offset-2" onClick={() => irParaFase(f.id)}>{f.nome}</button>{f.ao_assumir ? ' (quando alguém assume)' : ''}</React.Fragment>
                                                )) : c.inicial ? 'O registro já nasce nesta coluna.' : <span className="text-amber-900 dark:text-amber-100">Nenhuma fase põe o registro aqui.</span>}
                                            </p>
                                            {c.infos.length > 0 && <ul className="space-y-1">{c.infos.map((i) => <li key={i.campo}><EstadoInfo info={i} /></li>)}</ul>}
                                        </li>
                                    ))}
                                </ol>
                            )}
                            {rel?.levados.length > 0 && (
                                <details className="text-xs">
                                    <summary className="cursor-pointer font-medium min-h-[2.75rem] sm:min-h-0 flex items-center">{plural(rel.levados.length, 'dado do rito vai', 'dados do rito vão')} para a ficha do registro</summary>
                                    <ul className="mt-1 space-y-0.5 text-slate-700 dark:text-slate-300">{rel.levados.map((l) => <li key={`${l.fase}-${l.campo}`}>"{l.dado}" ({l.faseNome}) → {l.campoNome}</li>)}</ul>
                                </details>
                            )}
                            {rel?.outroPainel.length > 0 && <p className="text-xs text-slate-600 dark:text-slate-400">Conduzem outro painel: {rel.outroPainel.join(', ')}. Uma fase conduz um painel só.</p>}
                            {sugestoes.length > 0 && (
                                <div className="rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/40 p-2 space-y-2">
                                    <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5"><Wand2 className="w-4 h-4" aria-hidden /> O SIGO reconheceu {plural(sugestoes.length, 'ligação', 'ligações')} pelos nomes</p>
                                    <ul className="space-y-1">
                                        {sugestoes.map((s) => (
                                            <li key={s.chave}>
                                                <label className="flex min-h-[2.75rem] sm:min-h-0 items-start gap-2 text-sm">
                                                    <Checkbox className="mt-0.5" checked={!fora.has(s.chave)} onCheckedChange={(c) => setFora((x) => { const n = new Set(x); if (c === true) n.delete(s.chave); else n.add(s.chave); return n; })} />
                                                    <span>{s.texto}.</span>
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                    <Button size="sm" disabled={!escolhidas.length} onClick={() => { onAplicar(aplicarIntegracao(fases, escolhidas, alvo), escolhidas.length); setFora(new Set()); }}>Aplicar {plural(escolhidas.length, 'ligação', 'ligações')}</Button>
                                </div>
                            )}
                            {rel && integrado && rel.pronto && !sugestoes.length && <p className="text-sm text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" aria-hidden /> Todas as colunas e informações do painel estão cobertas pelo rito.</p>}
                        </>
                    )}
                </div>
            )}
        </section>
    );
}

/**
 * "Leva ao painel", na configuração da ação: o dado que a ação pede vai para
 * um campo da ficha do registro ligado. No formulário, um campo por campo.
 */
export function LevaAoPainel({ id, r, set }) {
    const { ligadas, paginas } = useContext(RegistroContexto);
    const paineis = paineisDisponiveis(ligadas, paginas);
    if (!paineis.length || r?.ve) return null;
    const ao = r?.ao_registro;
    const valorAo = ao ? valorDoAlvo(ao) : '';
    // [valor 'painel|campo', rótulo] de todos os painéis, para o tipo do dado.
    const opcoes = (tipo) => paineis.flatMap(([v, nome]) => camposParaLevar(alvoDe(v), tipo, paginas).map(([c, rot]) => [`${v}|${c}`, `${nome.replace(/^Painel de /, '')}: ${rot}`]));
    const comAlvo = (v) => { const [p] = v.split('|'); return alvoDe(p); };
    const explica = 'Ao cumprir a ação, o dado também vai para a ficha do registro ligado ao processo (a consulta, o expediente, a parceria ou o registro da página), com uma entrada no histórico dele. Sem registro ligado, nada muda lá e a equipe vê o motivo no processo.';
    if (r?.pede === 'formulario') {
        const campos = (r?.campos || []).filter((c) => c.id && ['texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao'].includes(c.tipo));
        if (!campos.length) return null;
        const mudar = (cid, v) => {
            if (!v) {
                const resto = { ...(ao?.campos || {}) };
                delete resto[cid];
                set({ ao_registro: Object.keys(resto).length ? { ...ao, campos: resto } : undefined });
                return;
            }
            const alvo = comAlvo(v);
            const campo = v.split('|')[1];
            // Um painel por ação: trocar de painel começa a ligação de novo.
            const base = valorAo === valorDoAlvo(alvo) ? ao.campos || {} : {};
            set({ ao_registro: { ...alvo, campos: { ...base, [cid]: campo } } });
        };
        return (
            <fieldset className="space-y-2 rounded-md border border-slate-200 dark:border-slate-700 p-2">
                <legend className="px-1 text-sm font-medium">Leva ao painel</legend>
                <p className="text-xs text-slate-600 dark:text-slate-400">{explica}</p>
                <div className="grid sm:grid-cols-2 gap-2">
                    {campos.map((c) => (
                        <NativeSelect key={c.id} id={`${id}-ap-${c.id}`} label={c.rotulo || 'Campo'} value={ao?.campos?.[c.id] ? `${valorAo}|${ao.campos[c.id]}` : ''} onChange={(v) => mudar(c.id, v)}
                            options={[['', 'Não leva'], ...opcoes(c.tipo)]} />
                    ))}
                </div>
            </fieldset>
        );
    }
    if (!['texto', 'texto_longo', 'numero', 'data', 'lista', 'sim_nao'].includes(r?.pede)) return null;
    const atual = ao?.campo ? `${valorAo}|${ao.campo}` : '';
    return (
        <div className="sm:max-w-md">
            <NativeSelect id={`${id}-ap`} label="Leva ao painel" value={atual} onChange={(v) => set({ ao_registro: v ? { ...comAlvo(v), campo: v.split('|')[1] } : undefined })}
                options={[['', 'Não leva'], ...opcoes(r.pede)]} />
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{atual ? explica : 'Para o dado aparecer também no painel (ex.: a pasta na rede ou o destinatário da diligência), escolha o campo da ficha.'}</p>
        </div>
    );
}
