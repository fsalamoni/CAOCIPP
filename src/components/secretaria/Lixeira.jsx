import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Loader2, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { secConfig, secProcesso } from '@/services/secretariaService';
import { unidadeComOrgao } from '@/lib/orgaos';
import { dataHora } from './comum';
import ErroQuery from './ErroQuery';

// ============================================================================
// Editar, duplicar, excluir e restaurar o que o admin cria (ritos, tipos de
// processo e modelos). Excluir é suave: processos já autuados guardam a
// própria cópia e não mudam; o item volta pela lista "Excluídos".
// ============================================================================

const NOMES = { rito: 'o rito', tipo: 'o tipo de processo', modelo: 'o modelo' };

/** Cartão clicável (abre para editar) com o menu ⋯ de Editar, Duplicar e Excluir. */
export function CartaoComMenu({ nome, className, onEditar, onDuplicar, onExcluir, extras = [], children }) {
    return (
        <div className="relative">
            <button type="button" onClick={onEditar} className={`${className} pr-11`}>{children}</button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button type="button" size="icon" variant="ghost" className="absolute top-1.5 right-1.5 h-9 w-9" aria-label={`Mais opções: ${nome}`}>
                        <MoreHorizontal className="w-4 h-4" aria-hidden />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={onEditar} className="gap-2"><Pencil className="w-4 h-4" aria-hidden /> Editar</DropdownMenuItem>
                    {onDuplicar && <DropdownMenuItem onSelect={onDuplicar} className="gap-2"><Copy className="w-4 h-4" aria-hidden /> Duplicar</DropdownMenuItem>}
                    {extras.map(({ rotulo, icone: Icone, onSelect }) => <DropdownMenuItem key={rotulo} onSelect={onSelect} className="gap-2">{Icone && <Icone className="w-4 h-4" aria-hidden />} {rotulo}</DropdownMenuItem>)}
                    {onExcluir && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={onExcluir} className="gap-2 text-red-700 focus:text-red-700 dark:text-red-300"><Trash2 className="w-4 h-4" aria-hidden /> Excluir</DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

/** Por que o rito não pode ser excluído, com atalho para cada tipo que o usa. */
export function BloqueioRito({ tipos, onAbrirTipo }) {
    return (
        <>
            <p>{tipos.length === 1 ? 'Um tipo de processo usa este rito' : `${tipos.length} tipos de processo usam este rito`}. Troque o rito deles ou exclua-os antes. Processos já autuados não são afetados.</p>
            <ul className="space-y-1 text-left">
                {tipos.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-2">
                        <span className="flex-1">{t.nome}{!t.ativo && ' (inativo)'}</span>
                        {onAbrirTipo && <Button size="sm" variant="outline" onClick={() => onAbrirTipo(t.id)}>Abrir o tipo</Button>}
                    </li>
                ))}
            </ul>
        </>
    );
}

/**
 * Confirmação de exclusão. `alvo` = { colecao, id, nome } ou null; `bloqueio`
 * (texto + elementos) substitui o botão de excluir quando não dá para excluir.
 */
export function ConfirmarExclusao({ orgId, alvo, onFechar, onExcluido, bloqueio = null }) {
    const qc = useQueryClient();
    const [indo, setIndo] = useState(false);
    const acao = { rito: 'excluirRito', tipo: 'excluirTipo', modelo: 'excluirModelo' }[alvo?.colecao];
    const excluir = async () => {
        setIndo(true);
        try {
            await secConfig(orgId, acao, { id: alvo.id });
            toast.success('Excluído. Dá para restaurar em "Excluídos".');
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
            onExcluido?.();
            onFechar();
        } catch (e) { toast.error(e?.message || 'Não foi possível excluir'); } finally { setIndo(false); }
    };
    return (
        <AlertDialog open={!!alvo} onOpenChange={(o) => !o && onFechar()}>
            <AlertDialogContent className="w-[calc(100vw-1rem)] sm:w-full">
                <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {NOMES[alvo?.colecao] || ''} “{alvo?.nome}”?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-2">
                            {bloqueio || (
                                <>
                                    <p>Sai das listas e não pode mais ser usado em novos processos{alvo?.colecao === 'modelo' ? ' nem indicado nas fases' : ''}.</p>
                                    <p>Processos já autuados guardam a própria cópia e não mudam. Dá para restaurar depois, em “Excluídos”.</p>
                                </>
                            )}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{bloqueio ? 'Fechar' : 'Cancelar'}</AlertDialogCancel>
                    {!bloqueio && (
                        <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" disabled={indo} onClick={(e) => { e.preventDefault(); excluir(); }}>
                            {indo && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />} Excluir
                        </AlertDialogAction>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

const ROTULO = { rito: 'Rito', tipo: 'Tipo de processo', modelo: 'Modelo', processo: 'Processo' };
const sel = 'h-10 rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm';

/**
 * Linhas de itens excluídos com Restaurar: ritos, tipos e modelos (`restaurar`
 * da configuração; voltam inativos) e processos (`restaurar` do processo, para
 * a unidade escolhida). `comTipo` mostra de que é cada linha (aba Lixeira).
 */
function ListaExcluidos({ orgId, estado, lista, comTipo = false }) {
    const qc = useQueryClient();
    const [indo, setIndo] = useState(null);
    const [escolha, setEscolha] = useState({}); // id -> rito (tipo) ou unidade de destino (processo)
    const ritosAtivos = estado.ritos || [];
    const ativas = (estado.unidades || []).filter((u) => u.ativa);
    const voltaPara = (x) => (ativas.some((u) => u.id === x.unidade_anterior) ? x.unidade_anterior : '');
    const restaurar = async (x) => {
        setIndo(x.id);
        try {
            if (x.colecao === 'processo') {
                await secProcesso(orgId, 'restaurar', { id: x.id, unidade_destino: escolha[x.id] || voltaPara(x) || undefined });
                toast.success(`Processo ${x.numero} restaurado`);
                qc.invalidateQueries({ queryKey: ['sec-processos', orgId] });
                qc.invalidateQueries({ queryKey: ['sec-contadores', orgId] });
            } else {
                await secConfig(orgId, 'restaurar', { colecao: x.colecao, id: x.id, ...(escolha[x.id] ? { rito_id: escolha[x.id] } : {}) });
                toast.success('Restaurado. Está inativo: reative quando quiser usar.');
                qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
            }
        } catch (e) { toast.error(e?.message || 'Não foi possível restaurar'); } finally { setIndo(null); }
    };
    return (
        <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
            {lista.map((x) => {
                // Tipo cujo rito também foi excluído só volta apontando para outro rito.
                const semRito = x.colecao === 'tipo' && !ritosAtivos.some((r) => r.id === x.rito_id);
                const processo = x.colecao === 'processo';
                const destino = escolha[x.id] ?? voltaPara(x);
                return (
                    <li key={`${x.colecao}:${x.id}`} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                        <span className="flex-1 min-w-[12rem]">
                            {comTipo && <Badge variant="outline" className="mr-2 font-normal">{ROTULO[x.colecao]}</Badge>}
                            {processo ? <><span className="font-mono text-indigo-700 dark:text-indigo-300">{x.numero}</span> · {x.assunto}</> : x.nome}
                            {(x.em || x.por) && <span className="block text-xs text-slate-600 dark:text-slate-400">Excluído{x.em ? ` em ${dataHora(x.em)}` : ''}{x.por ? ` por ${x.por}` : ''}</span>}
                            {x.motivo && <span className="block text-xs text-slate-600 dark:text-slate-400">Motivo: {x.motivo}</span>}
                        </span>
                        {semRito && (
                            <select aria-label={`Rito para restaurar ${x.nome}`} value={escolha[x.id] || ''} onChange={(e) => setEscolha({ ...escolha, [x.id]: e.target.value })} className={sel}>
                                <option value="">Escolha o rito…</option>
                                {ritosAtivos.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                            </select>
                        )}
                        {processo && (
                            <select aria-label={`Unidade para onde volta o processo ${x.numero}`} value={destino} onChange={(e) => setEscolha({ ...escolha, [x.id]: e.target.value })} className={`${sel} max-w-full`}>
                                <option value="">Volta para…</option>
                                {ativas.map((u) => <option key={u.id} value={u.id}>{unidadeComOrgao(estado, u.id)}</option>)}
                            </select>
                        )}
                        <Button size="sm" variant="outline" className="gap-1 h-10" disabled={!!indo || (semRito && !escolha[x.id]) || (processo && !destino)} onClick={() => restaurar(x)}>
                            {indo === x.id ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <RotateCcw className="w-4 h-4" aria-hidden />} Restaurar
                        </Button>
                    </li>
                );
            })}
        </ul>
    );
}

/** Lista "Excluídos" de uma coleção, com Restaurar. `filtro` escolhe os itens (ex.: modelos de uma unidade). */
export function Excluidos({ orgId, estado, colecao, filtro = () => true }) {
    const lista = (estado.excluidos || []).filter((x) => x.colecao === colecao && filtro(x));
    if (!lista.length) return null;
    return (
        <details className="md:col-span-2 rounded-md border border-dashed border-slate-300 dark:border-slate-700 p-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">Excluídos ({lista.length})</summary>
            <ListaExcluidos orgId={orgId} estado={estado} lista={lista} />
        </details>
    );
}

const norm = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Aba Lixeira (admin): tudo o que foi excluído, com quem excluiu, quando, busca e Restaurar. */
export function LixeiraConfiguracao({ orgId, estado }) {
    const [busca, setBusca] = useState('');
    const [tipo, setTipo] = useState('');
    const procQ = useQuery({ queryKey: ['sec-processos', orgId, 'excluidos'], queryFn: () => secProcesso(orgId, 'excluidos'), enabled: estado.isAdmin === true });
    const procs = (procQ.data?.processos || []).map((x) => ({ ...x, colecao: 'processo', nome: `${x.numero} ${x.assunto}` }));
    const todos = [...(estado.excluidos || []), ...procs].sort((a, b) => String(b.em || '').localeCompare(String(a.em || '')));
    const t = norm(busca.trim());
    const lista = todos.filter((x) => (!tipo || x.colecao === tipo) && (!t || norm(`${x.nome} ${x.por || ''} ${x.motivo || ''}`).includes(t)));
    return (
        <section aria-labelledby="lixeira-titulo" className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <div>
                <h3 id="lixeira-titulo" className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Trash2 className="w-4 h-4" aria-hidden /> Lixeira</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Ritos, tipos de processo, modelos e processos excluídos. Nada foi apagado: ritos, tipos e modelos voltam inativos; o processo volta à unidade escolhida, com o registro nos autos.
                </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
                <Input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar na lixeira" placeholder="Buscar por nome, número ou quem excluiu" className="h-10 sm:max-w-sm" />
                <select aria-label="Mostrar" value={tipo} onChange={(e) => setTipo(e.target.value)} className={sel}>
                    <option value="">Tudo</option>
                    <option value="rito">Ritos</option>
                    <option value="tipo">Tipos de processo</option>
                    <option value="modelo">Modelos</option>
                    <option value="processo">Processos</option>
                </select>
            </div>
            {procQ.isLoading && <p role="status" className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" aria-hidden /> Procurando processos excluídos…</p>}
            {procQ.error && <ErroQuery q={procQ} />}
            <p aria-live="polite" className="text-xs text-slate-600 dark:text-slate-400">{lista.length} de {todos.length}</p>
            {!lista.length && <p className="text-sm text-slate-600 dark:text-slate-400">{todos.length ? 'Nada encontrado para essa busca.' : 'Nada na lixeira.'}</p>}
            <ListaExcluidos orgId={orgId} estado={estado} lista={lista} comTipo />
        </section>
    );
}
