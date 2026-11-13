import React, { useRef, useState } from 'react';
import { Eye, Loader2, PencilLine, Shapes, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ORIGENS_REF, POLOS, formularioDe, integracoesLigadas, problemasFormulario, valorComoGravado, visiveis } from '@/lib/camposProcesso';
import { problemasNumeracao } from '@/lib/numeracao';
import { NativeSelect } from './comum';
import FluxoRito from './FluxoRito';
import { DadosCampos, EditorFormulario } from './CamposProcesso';
import FormularioAutuacao from './FormularioAutuacao';
import EditorNumeracao from './EditorNumeracao';
import VersoesDialog from './VersoesDialog';

// ============================================================================
// Editor do tipo de processo em tela cheia: abas Dados, Formulário e
// Numeração, com a prévia ao lado (no celular, atrás do botão Prévia). A
// prévia é o próprio "Novo processo" e, abaixo, o que as partes veem no portal
// com o que for preenchido nela.
// ============================================================================

const MODOS_NUMERO = [
    ['orgao', 'A numeração do órgão', 'Igual à dos demais processos.'],
    ['propria', 'Numeração própria', 'Montada só para este tipo.'],
    ['nenhuma', 'Sem número', 'O processo recebe só um identificador (SN-…), sem ocupar número.'],
];
const PREVIA_VAZIA = { assunto: '', descricao: '', origem: { tipo: '', descricao: '' }, unidade_id: 'u', sigilo: 'normal', urgente: false, motivo_urgencia: '', partes: [], campos: {} };

/** O que se preencheu na prévia, no formato gravado, só dos campos que as partes veem (e que aparecem). */
function camposDasPartes(form, valores) {
    const aparecem = visiveis(form.campos, valores);
    return form.campos.filter((c) => c.visivel_partes && aparecem.has(c.id)).flatMap((c) => {
        // Vazio ou inválido (a autuação recusaria) não aparece.
        const valor = valorComoGravado(c, valores[c.id]);
        return valor === null ? [] : [{ id: c.id, rotulo: c.rotulo, tipo: c.tipo, formato: c.formato, valor }];
    });
}

function Previa({ tipo }) {
    const [f, setF] = useState(PREVIA_VAZIA);
    const form = tipo.formulario;
    const partes = camposDasPartes(form, f.campos || {});
    return (
        <div className="space-y-4">
            <section aria-label="Novo processo" className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-sm font-medium mb-2">Novo processo</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">É o que quem autua vê. Preencha à vontade para testar condições e formatos: nada é salvo.</p>
                <FormularioAutuacao prefixo="previa" tipo={tipo} f={{ ...f, sigilo: form.sigilo === 'oculto' ? tipo.sigilo_padrao || 'normal' : f.sigilo, urgente: tipo.urgente === true || f.urgente }} setF={setF}
                    form={{ ...form, polos: form.polos.length ? form.polos : POLOS.map(([x]) => x), campos: form.campos.map((c) => ({ ...c, opcoes: (c.opcoes || []).map((o) => o.trim()).filter(Boolean) })) }}
                    unidades={[['u', 'A unidade de quem autua']]} />
            </section>
            <section aria-label="O que as partes veem" className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <p className="text-sm font-medium">O que as partes veem no portal</p>
                {form.campos.some((c) => c.visivel_partes) ? (
                    partes.length ? <DadosCampos campos={partes} className="mt-2" /> : <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Preencha acima um campo marcado "Mostrar às partes" para ver como aparece.</p>
                ) : <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Nenhum campo próprio está marcado para as partes. Elas veem o número, o assunto, a fase e os documentos liberados.</p>}
            </section>
        </div>
    );
}

/** "Sugerir este tipo ao criar a partir de": outro processo e os módulos com integração ligada. */
function NascerDe({ tipo, set, ligadas }) {
    const marcados = tipo.pode_nascer_de || [];
    const trocar = (m, sim) => set({ pode_nascer_de: sim ? [...marcados, m] : marcados.filter((x) => x !== m) });
    return (
        <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <legend className="text-sm font-medium px-1">Sugerir este tipo ao criar um processo a partir de</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-1">
                {ORIGENS_REF.map(([m, rotulo]) => {
                    const marcado = marcados.includes(m);
                    // Módulo sem integração: não se marca de novo (o que já estava marcado pode ser desmarcado).
                    const desligado = m !== 'pe' && !ligadas[m];
                    return (
                        <label key={m} className={`flex items-center gap-2 text-sm ${desligado && !marcado ? 'text-slate-400 dark:text-slate-500' : ''}`}>
                            <Checkbox checked={marcado} disabled={desligado && !marcado} onCheckedChange={(c) => trocar(m, c === true)} />
                            {rotulo}{desligado ? ' (integração desligada)' : ''}
                        </label>
                    );
                })}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                Em "Criar processo eletrônico" no registro desses módulos (ou "Novo processo derivado"), o tipo já vem escolhido quando é o único sugerido. A origem e os campos de registro do mesmo módulo vêm preenchidos.
            </p>
        </fieldset>
    );
}

/**
 * `tipo` em edição (null = fechado). `onSalvar()` grava; `onExcluir()` abre a exclusão.
 * `exemplo(numeracao, tipo)` e `numeracaoOrgao` vêm da tela de tipos.
 */
export default function EditorTipo({ tipo, setTipo, estado, salvando, onSalvar, onExcluir, exemplo, numeracaoOrgao, orgId, onAbrirVersao }) {
    const [aba, setAba] = useState('dados');
    const [verPrevia, setVerPrevia] = useState(false);
    // O editor monta a cada tipo aberto (key): o que havia ao abrir, para avisar antes de descartar.
    const inicial = useRef(JSON.stringify(tipo));
    if (!tipo) return null;
    const sujo = JSON.stringify(tipo) !== inicial.current;
    const rito = estado.ritos.find((r) => r.id === tipo.rito_id);
    const fases = rito?.fases || [];
    const numTipo = tipo.numeracao || { modo: 'orgao' };
    const probForm = problemasFormulario(tipo.formulario, fases.map((f) => f.id));
    const probNum = numTipo.modo === 'propria' ? problemasNumeracao(numTipo) : [];
    const probDados = [!tipo.nome?.trim() && 'Dê um nome ao tipo', !tipo.rito_id && 'Escolha o rito'].filter(Boolean);
    const pendencias = { dados: probDados, formulario: probForm, numeracao: probNum };
    const total = probDados.length + probForm.length + probNum.length;
    const set = (patch) => setTipo({ ...tipo, ...patch });
    const fechar = () => {
        if (sujo && !window.confirm('Há alterações não salvas neste tipo. Fechar sem salvar?')) return;
        setTipo(null); setAba('dados'); setVerPrevia(false);
    };
    // Copiar campos: os outros tipos com campos próprios (também os excluídos).
    const outros = [...(estado.tipos || []), ...(estado.tipos_excluidos || []).map((t) => ({ ...t, excluido: true }))]
        .filter((t) => t.id !== tipo.id && formularioDe(t).campos.length).map((t) => ({ ...t, formulario: formularioDe(t) }));
    const aviso = (lista) => (lista.length > 0 && (
        <ul className="text-sm text-amber-800 dark:text-amber-300 list-disc pl-5 rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/40 py-2 pr-3">
            {lista.map((m) => <li key={m}>{m}</li>)}
        </ul>
    ));
    const marca = (k) => pendencias[k].length > 0 && <><span className="ml-1 inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden /><span className="sr-only"> (com ajuste pendente)</span></>;

    return (
        <Dialog open onOpenChange={(o) => !o && fechar()}>
            <DialogContent onOpenAutoFocus={(e) => { e.preventDefault(); document.getElementById('tp-nome')?.focus(); }} className="max-w-none w-screen h-[100dvh] sm:w-[96vw] sm:h-[94vh] sm:max-w-[1400px] p-0 gap-0 flex flex-col overflow-hidden sm:rounded-lg [&>button:last-child]:hidden">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
                    <Shapes className="w-5 h-5 text-indigo-600" aria-hidden />
                    <DialogTitle className="text-base truncate min-w-0 flex-1">{tipo.id ? `Editar tipo: ${tipo.nome || 'sem nome'}` : 'Novo tipo de processo'}</DialogTitle>
                    <DialogDescription className="sr-only">Ao autuar, quem escolhe este tipo já recebe o rito, o sigilo, a unidade, o formulário e a numeração definidos aqui.</DialogDescription>
                    <Button size="sm" variant="outline" className="shrink-0 gap-1 lg:hidden" onClick={() => setVerPrevia(!verPrevia)}>
                        {verPrevia ? <><PencilLine className="w-4 h-4" aria-hidden /> Editar</> : <><Eye className="w-4 h-4" aria-hidden /> Prévia</>}
                    </Button>
                    <Button size="sm" variant="ghost" className="shrink-0" onClick={fechar} aria-label="Fechar"><X className="w-4 h-4" /></Button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_440px] gap-4 p-4">
                        <div className={verPrevia ? 'hidden lg:block' : ''}>
                            <Tabs value={aba} onValueChange={setAba}>
                                <TabsList className="w-full sm:w-auto">
                                    <TabsTrigger value="dados" className="flex-1 sm:flex-none">Dados{marca('dados')}</TabsTrigger>
                                    <TabsTrigger value="formulario" className="flex-1 sm:flex-none">Formulário{marca('formulario')}</TabsTrigger>
                                    <TabsTrigger value="numeracao" className="flex-1 sm:flex-none">Numeração{marca('numeracao')}</TabsTrigger>
                                </TabsList>

                                <TabsContent value="dados" className="space-y-4 mt-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="col-span-2"><Label htmlFor="tp-nome">Nome</Label><Input id="tp-nome" className="mt-1" value={tipo.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Requerimento administrativo" /></div>
                                        <div><Label htmlFor="tp-sigla">Sigla</Label><Input id="tp-sigla" className="mt-1" value={tipo.sigla} maxLength={12} onChange={(e) => set({ sigla: e.target.value })} placeholder="REQ" /></div>
                                    </div>
                                    <div><Label htmlFor="tp-desc">Para que serve</Label><Input id="tp-desc" className="mt-1" value={tipo.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Opcional; aparece para quem autua" /></div>
                                    <div className="grid sm:grid-cols-3 gap-3">
                                        <NativeSelect id="tp-rito" label="Rito" value={tipo.rito_id} onChange={(v) => set({ rito_id: v })}
                                            options={estado.ritos.map((r) => [r.id, `${r.nome}${r.ativo ? '' : ' (inativo)'}`])} />
                                        <NativeSelect id="tp-sigilo" label="Sigilo padrão" value={tipo.sigilo_padrao} onChange={(v) => set({ sigilo_padrao: v })}
                                            options={[['normal', 'Normal'], ['restrito', 'Restrito']]} />
                                        <NativeSelect id="tp-unidade" label="Unidade sugerida para autuar" value={tipo.unidade_inicial} onChange={(v) => set({ unidade_inicial: v })}
                                            options={[['', 'A de quem autua'], ...estado.unidades.filter((u) => u.ativa).map((u) => [u.id, u.nome])]} />
                                    </div>
                                    {(estado.orgaos || []).length > 0 && (
                                        <div>
                                            <NativeSelect id="tp-orgao" label="Órgão interno deste tipo" value={tipo.orgao_id || ''} onChange={(v) => set({ orgao_id: v })}
                                                options={[['', 'Qualquer órgão pode autuar'], ...estado.orgaos.map((o) => [o.id, `${'— '.repeat((o.nivel || 1) - 1)}${o.nome}`])]} />
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Escolhendo um órgão, só as unidades dele autuam processos deste tipo.</p>
                                        </div>
                                    )}
                                    <label className="flex items-start gap-2 text-sm">
                                        <input type="checkbox" className="mt-1" checked={tipo.urgente === true} onChange={(e) => set({ urgente: e.target.checked })} />
                                        <span><span className="font-medium">Todo processo deste tipo é urgente</span><span className="block text-xs text-slate-600 dark:text-slate-400">Já nasce com o selo de urgência e aparece primeiro nas listas.</span></span>
                                    </label>
                                    <NascerDe tipo={tipo} set={set} ligadas={integracoesLigadas(estado)} />
                                    {tipo.id && <label className="flex items-center gap-2 text-sm"><Checkbox checked={tipo.ativo} onCheckedChange={(c) => set({ ativo: c === true })} /> Disponível para novas autuações</label>}
                                    {rito && (
                                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3">
                                            <p className="text-sm font-medium">Fluxo deste tipo</p>
                                            <FluxoRito acoes fases={fases} unidades={estado.unidades} className="mt-2" />
                                        </div>
                                    )}
                                    {aviso(probDados)}
                                </TabsContent>

                                <TabsContent value="formulario" className="space-y-3 mt-4">
                                    {aviso(probForm)}
                                    <EditorFormulario form={tipo.formulario} tipo={tipo} fases={fases} previa={false} outros={outros} onChange={(formulario) => set({ formulario })} />
                                </TabsContent>

                                <TabsContent value="numeracao" className="space-y-3 mt-4">
                                    <fieldset className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                                        <legend className="px-1 text-sm font-medium">Numeração única</legend>
                                        <div className="grid sm:grid-cols-3 gap-2">
                                            {MODOS_NUMERO.map(([v, l, d]) => (
                                                <label key={v} className={`flex items-start gap-2 rounded-md border p-2 text-sm cursor-pointer ${numTipo.modo === v ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                                                    <input type="radio" name="tp-numeracao" className="mt-1" checked={numTipo.modo === v}
                                                        onChange={() => set({ numeracao: v === 'propria' ? { modo: 'propria', partes: numTipo.partes || numeracaoOrgao.partes } : { modo: v } })} />
                                                    <span><span className="font-medium">{l}</span><span className="block text-xs text-slate-600 dark:text-slate-400">{v === 'orgao' ? `${d} Ex.: ${exemplo(numeracaoOrgao, tipo)}` : d}</span></span>
                                                </label>
                                            ))}
                                        </div>
                                        {numTipo.modo === 'propria' && <EditorNumeracao valor={numTipo} onChange={(n) => set({ numeracao: { ...n, modo: 'propria' } })} exemplo={{ tipo, unidade: estado.unidades[0], orgao: (estado.orgaos || [])[0] }} />}
                                    </fieldset>
                                    {aviso(probNum)}
                                </TabsContent>
                            </Tabs>
                        </div>

                        <aside aria-label="Prévia" className={`space-y-3 lg:sticky lg:top-0 self-start lg:max-h-[calc(94vh-10rem)] lg:overflow-y-auto lg:pr-1 ${verPrevia ? '' : 'hidden lg:block'}`}>
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">Prévia</p>
                            <Previa tipo={tipo} />
                        </aside>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-white dark:bg-slate-950">
                    {tipo.id && (
                        <Button variant="ghost" className="gap-1 text-red-700 dark:text-red-300" onClick={onExcluir}>
                            <Trash2 className="w-4 h-4" aria-hidden /> <span className="hidden sm:inline">Excluir tipo</span><span className="sm:hidden">Excluir</span>
                        </Button>
                    )}
                    {tipo.id && onAbrirVersao && <VersoesDialog orgId={orgId} colecao="tipo" id={tipo.id} nome={tipo.nome} estado={estado} onAbrir={onAbrirVersao} />}
                    {sujo && <span className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">Alterações não salvas</span>}
                    {total > 0 && (
                        <button type="button" className="text-sm text-amber-800 dark:text-amber-300 underline"
                            onClick={() => { setVerPrevia(false); setAba(probDados.length ? 'dados' : probForm.length ? 'formulario' : 'numeracao'); }}>
                            {total === 1 ? '1 ajuste antes de salvar' : `${total} ajustes antes de salvar`}
                        </button>
                    )}
                    <div className="ml-auto flex gap-2">
                        <Button variant="outline" onClick={fechar}>Cancelar</Button>
                        <Button disabled={salvando || total > 0} onClick={onSalvar}>
                            {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
