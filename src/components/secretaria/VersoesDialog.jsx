import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Eye, FolderOpen, History, Loader2, Minus, PenLine, Plus, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { secConfig } from '@/services/secretariaService';
import { dataHora } from './comum';
import FluxoRito from './FluxoRito';
import PreviaRito from './PreviaRito';
import { diffRito, diffTipo } from '@/lib/versoes';
import { TIPOS_CAMPO } from '@/lib/camposProcesso';

/**
 * Versões anteriores de um rito, modelo ou tipo. Com `onAbrir(conteudo)` (tipo),
 * a versão abre no editor e só vale ao salvar; sem ela, "Restaurar" grava
 * direto (a atual vira versão também).
 */
export default function VersoesDialog({ orgId, colecao, id, nome, estado, onRestaurado, onAbrir }) {
    const qc = useQueryClient();
    const [aberto, setAberto] = useState(false);
    const [restaurando, setRestaurando] = useState(null);
    const [ver, setVer] = useState(null); // versão aberta na prévia e comparação
    // Ao voltar da comparação, o foco volta ao "Ver" da versão que estava aberta.
    const voltarPara = useRef(null);
    const botoesVer = useRef({});
    useEffect(() => {
        if (ver != null || voltarPara.current == null) return;
        botoesVer.current[voltarPara.current]?.focus();
        voltarPara.current = null;
    }, [ver]);
    const fechar = () => { setAberto(false); setVer(null); voltarPara.current = null; };
    const podeVer = colecao === 'rito' || colecao === 'tipo';
    const q = useQuery({ queryKey: ['sec-versoes', colecao, id], queryFn: () => secConfig(orgId, 'versoes', { colecao, id }), enabled: aberto && !!id });
    // Versão guardada não muda: lida uma vez.
    const qv = useQuery({ queryKey: ['sec-versoes', colecao, id, ver], queryFn: () => secConfig(orgId, 'versoes', { colecao, id, versao: ver }), enabled: aberto && ver != null && podeVer, staleTime: Infinity });
    const atual = colecao === 'rito' ? estado?.ritos?.find((r) => r.id === id) : colecao === 'tipo' ? estado?.tipos?.find((t) => t.id === id) : null;
    const conteudo = colecao === 'rito' ? qv.data?.rito : qv.data?.tipo;
    const dif = conteudo && atual ? (colecao === 'rito' ? diffRito(conteudo, atual) : diffTipo(conteudo, atual)) : null;
    const nomePessoa = (uid) => estado?.membros?.find((m) => m.uid === uid)?.nome || '';
    const restaurar = async (v) => {
        setRestaurando(v.versao);
        try {
            if (onAbrir) {
                const r = await qc.fetchQuery({ queryKey: ['sec-versoes', colecao, id, v.versao], queryFn: () => secConfig(orgId, 'versoes', { colecao, id, versao: v.versao }), staleTime: Infinity });
                onAbrir(r.tipo, v.versao);
                toast.success(`Versão ${v.versao} aberta no editor: confira e salve para valer`);
                fechar();
                return;
            }
            await secConfig(orgId, 'restaurarVersao', { colecao, id, versao: v.versao });
            toast.success(`Versão ${v.versao} restaurada`);
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
            qc.invalidateQueries({ queryKey: ['sec-versoes', colecao, id] });
            fechar();
            onRestaurado?.();
        } catch (e) { toast.error(e?.message || (onAbrir ? 'Não foi possível abrir a versão' : 'Não foi possível restaurar')); } finally { setRestaurando(null); }
    };
    if (!id) return null;
    return (
        <>
            <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => setAberto(true)}><History className="w-4 h-4" aria-hidden /> Versões</Button>
            <Dialog open={aberto} onOpenChange={(o) => (o ? setAberto(true) : fechar())}>
                <DialogContent className={`${ver != null ? 'max-w-5xl' : 'max-w-lg'} max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full`}>
                    <DialogHeader>
                        <DialogTitle>Versões de {nome}</DialogTitle>
                        <DialogDescription>Cada salvamento guarda a versão anterior (até 20). {onAbrir
                            ? 'Abrir carrega a versão no editor; nada muda até você salvar, e salvar cria uma versão nova. Processos já autuados mantêm os dados gravados.'
                            : `Restaurar cria uma versão nova com o conteúdo antigo; ${colecao === 'rito' ? 'processos em andamento continuam com a versão com que foram autuados' : 'documentos já redigidos não mudam'}.`}</DialogDescription>
                    </DialogHeader>
                    {q.isLoading && <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando…</p>}
                    {q.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{q.error.message}</p>}
                    {ver != null && (
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button type="button" variant="ghost" size="sm" className="gap-1 h-10" autoFocus onClick={() => { voltarPara.current = ver; setVer(null); }}><ArrowLeft className="w-4 h-4" aria-hidden /> Voltar às versões</Button>
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Versão {ver} comparada à versão atual{q.data ? ` (${q.data.versao_atual}, salva)` : ''}</h3>
                            </div>
                            {qv.isLoading && <p role="status" className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando a versão…</p>}
                            {qv.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{qv.error.message}</p>}
                            {qv.data && !conteudo && <p className="text-sm text-slate-600 dark:text-slate-400">Prévia indisponível para esta versão.</p>}
                            {conteudo && (
                                <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                                    <section aria-labelledby="versao-resumo" className="space-y-2 text-sm">
                                        <h4 id="versao-resumo" className="font-medium text-slate-800 dark:text-slate-100">O que muda em relação à atual</h4>
                                        <Resumo dif={dif} colecao={colecao} temAtual={!!atual} />
                                    </section>
                                    <section aria-label="Prévia da versão" className="space-y-2 min-w-0">
                                        {colecao === 'rito' ? (
                                            <>
                                                <FluxoRito acoes fases={conteudo.fases} unidades={estado?.unidades} alturaMaxima="50vh" />
                                                <PreviaRito key={ver} estado={estado} rascunho={{ ...conteudo, id }} rotuloBotao="Ver esta versão como a equipe e a parte" />
                                            </>
                                        ) : (
                                            <CamposDaVersao tipo={conteudo} estado={estado} />
                                        )}
                                    </section>
                                </div>
                            )}
                            {conteudo && (
                                <div className="flex justify-end">
                                    <Button className="gap-1 h-10" disabled={restaurando != null} onClick={() => restaurar({ versao: ver })}>
                                        {restaurando === ver ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : onAbrir ? <FolderOpen className="w-4 h-4" aria-hidden /> : <Undo2 className="w-4 h-4" aria-hidden />} {onAbrir ? 'Abrir esta versão no editor' : 'Restaurar esta versão'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                    {q.data && ver == null && (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            <li className="py-2 text-sm text-slate-600 dark:text-slate-400">Versão atual: {q.data.versao_atual}</li>
                            {q.data.versoes.length === 0 && <li className="py-2 text-sm text-slate-600">Nenhuma versão anterior ainda.</li>}
                            {q.data.versoes.map((v) => (
                                <li key={v.versao} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                                    <span className="font-medium">Versão {v.versao}</span>
                                    <span className="text-slate-600 dark:text-slate-400">{v.em ? dataHora(v.em) : ''}{v.por && nomePessoa(v.por) ? ` · ${nomePessoa(v.por)}` : ''}{v.fases != null ? ` · ${v.fases} fases` : ''}{v.campos != null ? ` · ${v.campos} ${v.campos === 1 ? 'campo próprio' : 'campos próprios'}` : ''}{v.nome && v.nome !== nome ? ` · "${v.nome}"` : ''}</span>
                                    {podeVer && (
                                        <Button size="sm" variant="ghost" className="gap-1 ml-auto h-9" ref={(el) => { botoesVer.current[v.versao] = el; }} aria-label={`Ver e comparar a versão ${v.versao}`} onClick={() => setVer(v.versao)}>
                                            <Eye className="w-3.5 h-3.5" aria-hidden /> Ver
                                        </Button>
                                    )}
                                    <Button size="sm" variant="outline" className={`gap-1 h-9 ${podeVer ? '' : 'ml-auto'}`} aria-label={`${onAbrir ? 'Abrir no editor' : 'Restaurar'} a versão ${v.versao}`} disabled={restaurando != null} onClick={() => restaurar(v)}>
                                        {restaurando === v.versao ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : onAbrir ? <FolderOpen className="w-3.5 h-3.5" aria-hidden /> : <Undo2 className="w-3.5 h-3.5" aria-hidden />} {onAbrir ? 'Abrir no editor' : 'Restaurar'}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

const juntar = (l) => l.join(', ');

/** Resumo da diferença, com ícone e título em cada grupo (sem depender de cor). */
function Resumo({ dif, colecao, temAtual }) {
    if (!temAtual) return <p className="text-slate-600 dark:text-slate-400">Não foi possível comparar com a versão atual.</p>;
    if (!dif) return null;
    if (dif.iguais) return <p className="text-slate-600 dark:text-slate-400">Mesmo conteúdo da versão atual.</p>;
    const rito = colecao === 'rito';
    const novos = rito ? dif.fases.adicionadas.map((x) => x.nome) : dif.campos.adicionados.map((x) => x.rotulo);
    const saem = rito ? dif.fases.removidas.map((x) => x.nome) : dif.campos.removidos.map((x) => x.rotulo);
    const tambem = rito ? dif.rito : [...dif.dados, ...dif.formulario];
    const Grupo = ({ icone: Icone, titulo, children }) => (
        <div>
            <p className="flex items-center gap-1.5 font-medium text-indigo-700 dark:text-indigo-300"><Icone className="w-4 h-4" aria-hidden /> {titulo}</p>
            <div className="pl-6 text-slate-700 dark:text-slate-300">{children}</div>
        </div>
    );
    const quais = rito ? 'Fases' : 'Campos próprios';
    return (
        <div className="space-y-3">
            {novos.length > 0 && <Grupo icone={Plus} titulo={`${quais} nesta versão e não na atual`}><ul className="list-disc pl-4">{novos.map((n, i) => <li key={i}>{n}</li>)}</ul></Grupo>}
            {saem.length > 0 && <Grupo icone={Minus} titulo={`${quais} na atual e não nesta versão`}><ul className="list-disc pl-4">{saem.map((n, i) => <li key={i}>{n}</li>)}</ul></Grupo>}
            {rito && dif.fases.alteradas.length > 0 && (
                <Grupo icone={PenLine} titulo="Fases diferentes da atual">
                    <ul className="list-disc pl-4 space-y-1">
                        {dif.fases.alteradas.map((f) => (
                            <li key={f.id}>
                                <span className="font-medium">{f.nome}</span>{f.nome_atual !== f.nome ? ` (hoje "${f.nome_atual}")` : ''}{f.mudou.length ? `: ${juntar(f.mudou)}` : ''}
                                {(f.acoes.adicionadas.length + f.acoes.removidas.length + f.acoes.alteradas.length) > 0 && (
                                    <ul className="pl-4 text-xs space-y-0.5 mt-0.5">
                                        {f.acoes.adicionadas.map((a, i) => <li key={`a${i}`}>Ação só nesta versão: {a}</li>)}
                                        {f.acoes.removidas.map((a, i) => <li key={`r${i}`}>Ação só na atual: {a}</li>)}
                                        {f.acoes.alteradas.map((a, i) => <li key={`m${i}`}>{a.texto}: {juntar(a.mudou)}</li>)}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                </Grupo>
            )}
            {!rito && dif.campos.alterados.length > 0 && (
                <Grupo icone={PenLine} titulo="Campos diferentes da atual">
                    <ul className="list-disc pl-4">{dif.campos.alterados.map((c) => <li key={c.id}><span className="font-medium">{c.rotulo}</span>: {juntar(c.mudou)}</li>)}</ul>
                </Grupo>
            )}
            {tambem.length > 0 && <p className="text-slate-700 dark:text-slate-300"><span className="font-medium">Também muda:</span> {juntar(tambem)}.</p>}
        </div>
    );
}

/** Campos próprios da versão do tipo e o fluxo do rito que ela usa (como está hoje). */
function CamposDaVersao({ tipo, estado }) {
    const campos = tipo.formulario?.campos || [];
    const rito = estado?.ritos?.find((r) => r.id === tipo.rito_id);
    const rotuloTipo = (t) => TIPOS_CAMPO.find(([v]) => v === t)?.[1] || t;
    return (
        <div className="space-y-3 text-sm">
            <p className="font-medium text-slate-800 dark:text-slate-100">Campos próprios desta versão</p>
            {campos.length ? (
                <ol className="list-decimal pl-5 space-y-0.5 text-slate-700 dark:text-slate-300">
                    {campos.map((c) => <li key={c.id}>{c.rotulo} · {rotuloTipo(c.tipo)}{c.obrigatorio ? ' · obrigatório' : ''}</li>)}
                </ol>
            ) : <p className="text-slate-600 dark:text-slate-400">Nenhum campo próprio.</p>}
            {rito && (
                <figure className="space-y-1">
                    <figcaption className="text-xs text-slate-600 dark:text-slate-400">Fases do rito {rito.nome} (como está hoje)</figcaption>
                    <FluxoRito acoes fases={rito.fases} unidades={estado?.unidades} alturaMaxima="40vh" />
                </figure>
            )}
        </div>
    );
}
