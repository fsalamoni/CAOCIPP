import React, { useContext, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDashed, LayoutGrid, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from './comum';
import { RegistroContexto } from './SeletorRegistro';
import { upsertEntityType } from '@/services/customEntitiesService';
import {
    alvoDe, alvoDoRito, aplicarIntegracao, camposParaLevar, ligarAoPainelGerado, paineisDisponiveis, painelDoRito, relatorioIntegracao, sugestoesDeIntegracao, valorDoAlvo,
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
 * `irParaFase(id)`: abre a fase no editor; `nomeRito`: sugere o nome do painel gerado;
 * `nomes`: [um registro, o painel] que o modelo da biblioteca propõe; `convite`:
 * rito novo, mostra a escolha "criar painel ou seguir sem" antes de tudo;
 * `criaTipo`: o tipo nasce com o rito e já cria o registro na autuação.
 */
export default function IntegracaoPainel({ fases, onAplicar, irParaFase, nomeRito, nomes, convite, criaTipo }) {
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
    // Escolha do convite: null (ainda não decidiu), 'criar' ou 'sem'.
    const [decisao, setDecisao] = useState(null);
    const escolhidas = sugestoes.filter((s) => !fora.has(s.chave));
    const integrado = !!doRito && valorDoAlvo(doRito) === valor;
    const estado = !opcoes.length ? 'Nenhum painel disponível'
        : !integrado ? 'Não integrado'
            : rel?.pronto ? 'Pronto' : `${plural(rel?.faltas.length || 0, 'pendência', 'pendências')}`;
    const corEstado = integrado && rel?.pronto ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100' : integrado ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
    const aoGerar = (novas, id, nome) => {
        setEscolhido(`paginas:${id}`); setFora(new Set());
        const depois = criaTipo
            ? `O tipo de processo criado com este rito vai abrir um registro em ${nome} a cada autuação. Implante para valer.`
            : `Salve o rito e, no tipo de processo, marque "Criar registro na autuação" com ${nome}.`;
        onAplicar(novas, novas.filter((f, i) => f !== fases[i]).length, `Painel ${nome} criado e ligado ao rito. ${depois}`, id);
    };
    if (convite && !doRito && decisao !== 'sem') {
        return (
            <section aria-labelledby="conv-painel" className="rounded-md border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50/60 dark:bg-indigo-950/40 p-3 space-y-3">
                <h3 id="conv-painel" className="text-sm font-semibold flex items-center gap-1.5"><LayoutGrid className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden /> Painel e planilha de acompanhamento: ligar ou não?</h3>
                <p className="text-sm text-slate-800 dark:text-slate-200">
                    Este rito pode ter um painel próprio: um quadro com uma coluna por fase, onde cada processo é um cartão que anda sozinho, e uma planilha com os dados que as ações pedem (valores, datas, responsáveis). <b>É opcional.</b> Sem o painel, o processo funciona igual e aparece só nas listas do Processo Eletrônico. Você pode ligar depois, abrindo o rito em "Integração com o painel".
                </p>
                <ul className="text-xs text-slate-700 dark:text-slate-300 list-disc pl-5 space-y-0.5">
                    <li><b>Ligar</b> cria agora uma página própria do órgão{nomes?.[1] ? ` (sugestão: ${nomes[1]})` : ''}. Ela fica gravada mesmo que você desista de implantar o rito, e pode ser ajustada ou excluída em Páginas personalizadas.</li>
                    <li><b>Não ligar</b> não cria nada. Vale a pena ligar quando a equipe precisa ver todos os processos deste rito num quadro ou exportar a planilha.</li>
                </ul>
                {decisao === 'criar' || !ligadas?.paginas
                    ? <GerarPainel fases={fases} nomeRito={nomeRito} nomes={nomes} aberto onCancelar={() => setDecisao(null)} onGerado={aoGerar} />
                    : null}
                <div className="flex flex-wrap gap-2">
                    {decisao !== 'criar' && ligadas?.paginas && <Button size="sm" className="h-11 sm:h-8 gap-1" onClick={() => setDecisao('criar')}><Sparkles className="w-4 h-4" aria-hidden /> Ligar: criar painel e planilha</Button>}
                    <Button size="sm" variant="outline" className="h-11 sm:h-8" onClick={() => setDecisao('sem')}>Seguir sem painel</Button>
                </div>
            </section>
        );
    }
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
                    <GerarPainel fases={fases} nomeRito={nomeRito} nomes={nomes} onGerado={aoGerar} />
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

/**
 * "Gerar painel e planilha": cria uma página própria com uma coluna por fase
 * do rito e um campo por dado que as ações pedem, e liga o rito a ela. A
 * página é gravada na hora (upsertEntityType confere no servidor); o rito,
 * ao salvar.
 */
function GerarPainel({ fases, nomeRito, nomes, aberto, onCancelar, onGerado }) {
    const { orgId, ligadas } = useContext(RegistroContexto);
    const [abrir, setAbrir] = useState(!!aberto);
    const base = String(nomeRito || '').replace(/^Rito\s+(d[aeo]s?\s+)?/i, '').trim() || 'Registro';
    const [singular, setSingular] = useState(nomes?.[0] || base);
    const [nomePlural, setNomePlural] = useState(nomes?.[1] || base);
    const [gravando, setGravando] = useState(false);
    const g = useMemo(() => painelDoRito(fases, [singular || base, nomePlural || base]), [fases, singular, nomePlural, base]);
    if (!ligadas?.paginas) {
        return <p className="text-xs text-slate-600 dark:text-slate-400">Para gerar um painel próprio a partir do rito (colunas das fases, campos dos dados das ações), ligue Páginas próprias em "Integrações com outros módulos", no alto da configuração do Processo Eletrônico. Depois, volte a este rito.</p>;
    }
    const gerar = async () => {
        setGravando(true);
        try {
            const r = await upsertEntityType(orgId, g.def);
            onGerado(ligarAoPainelGerado(fases, g, r.entityTypeId), r.entityTypeId, g.def.label_plural);
            setAbrir(false);
        } catch (e) {
            toast.error(e?.message || 'Não foi possível criar o painel');
        } finally { setGravando(false); }
    };
    if (!abrir) {
        return (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                <span>Nenhum painel serve? O SIGO monta um a partir do rito.</span>
                <Button size="sm" variant="outline" className="h-11 sm:h-8 gap-1" onClick={() => setAbrir(true)}><Sparkles className="w-4 h-4" aria-hidden /> Gerar painel e planilha</Button>
            </div>
        );
    }
    const livres = fases.filter((f) => !f.situacao_registro?.modulo).length;
    return (
        <div className="rounded-md border border-indigo-200 dark:border-indigo-800 p-3 space-y-3">
            <p className="text-sm font-semibold">Gerar painel e planilha do rito</p>
            <p className="text-xs text-slate-700 dark:text-slate-300">Cria uma página própria do órgão, com quadro (uma coluna por fase) e planilha (um campo por dado que as ações pedem, mais o número do processo e o assunto). O rito passa a mover o cartão e a levar os dados para a ficha. Depois, ajuste a página à vontade em Páginas personalizadas.</p>
            <div className="grid sm:grid-cols-2 gap-2 sm:max-w-lg">
                <div><Label htmlFor="gp-s">Nome de um registro</Label><Input id="gp-s" className="mt-1" value={singular} onChange={(e) => setSingular(e.target.value)} placeholder="Contrato" /></div>
                <div><Label htmlFor="gp-p">Nome do painel (plural)</Label><Input id="gp-p" className="mt-1" value={nomePlural} onChange={(e) => setNomePlural(e.target.value)} placeholder="Contratos" /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div>
                    <p className="font-medium mb-1">{plural(g.def.phases.length, 'coluna', 'colunas')}</p>
                    <ol className="list-decimal pl-5 space-y-0.5">{g.def.phases.map((p) => <li key={p.key}>{p.label}{p.is_initial ? ' (onde nasce)' : ''}{p.is_final ? ' (final)' : ''}</li>)}</ol>
                </div>
                <div>
                    <p className="font-medium mb-1">{plural(g.def.fields.length, 'campo', 'campos')}</p>
                    <ul className="list-disc pl-5 space-y-0.5">{g.def.fields.map((c) => <li key={c.key}>{c.label}{c.phase ? ` · ${g.def.phases.find((p) => p.key === c.phase)?.label}` : ''}</li>)}</ul>
                </div>
            </div>
            {livres < fases.length && <p className="text-xs text-amber-900 dark:text-amber-100">{plural(fases.length - livres, 'fase já conduz', 'fases já conduzem')} outro painel: {fases.length - livres === 1 ? 'vira' : 'viram'} coluna, mas continua{fases.length - livres === 1 ? '' : 'm'} movendo o outro.</p>}
            <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={gravando || !singular.trim() || !nomePlural.trim()} onClick={gerar}>{gravando ? 'Criando…' : 'Criar painel e ligar ao rito'}</Button>
                <Button size="sm" variant="ghost" onClick={() => (onCancelar ? onCancelar() : setAbrir(false))}>Cancelar</Button>
            </div>
        </div>
    );
}
