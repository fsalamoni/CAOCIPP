import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Eye, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { MAX_CAMPOS, TIPOS_CAMPO, USOS_CAMPO, novoCampo, valorTexto } from '@/lib/camposProcesso';
import { NativeSelect } from './comum';

// ============================================================================
// Campos próprios do tipo de processo:
// - CamposProcesso: os campos para preencher (Novo processo e Editar dados);
// - DadosCampos: os valores gravados, para ler (processo e portal);
// - EditorFormulario: a configuração no tipo de processo, com prévia.
// ============================================================================

const seletor = 'mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
const Obrigatorio = () => <span className="text-red-600 dark:text-red-400" aria-hidden> *</span>;

/** Campos para preencher. `valores` = { id: valor }; `onChange(id, valor)`. */
export function CamposProcesso({ campos, valores, onChange, prefixo = 'cp' }) {
    if (!campos?.length) return null;
    return (
        <div className="grid sm:grid-cols-2 gap-3">
            {campos.map((c) => {
                const id = `${prefixo}-${c.id}`;
                const v = valores?.[c.id] ?? '';
                const largo = c.tipo === 'texto_longo';
                const comum = { id, 'aria-required': c.obrigatorio || undefined, 'aria-describedby': c.ajuda ? `${id}-ajuda` : undefined };
                return (
                    <div key={c.id} className={largo ? 'sm:col-span-2' : ''}>
                        <Label htmlFor={id}>{c.rotulo || 'Campo sem nome'}{c.obrigatorio && <Obrigatorio />}</Label>
                        {c.tipo === 'texto_longo' && <Textarea {...comum} className="mt-1" rows={3} maxLength={4000} value={v} onChange={(e) => onChange(c.id, e.target.value)} />}
                        {c.tipo === 'texto' && <Input {...comum} className="mt-1" maxLength={200} value={v} onChange={(e) => onChange(c.id, e.target.value)} />}
                        {c.tipo === 'numero' && <Input {...comum} className="mt-1" inputMode="decimal" placeholder="0" value={v} onChange={(e) => onChange(c.id, e.target.value)} />}
                        {c.tipo === 'data' && <Input {...comum} className="mt-1" type="date" value={v} onChange={(e) => onChange(c.id, e.target.value)} />}
                        {c.tipo === 'lista' && (
                            <select {...comum} className={seletor} value={v} onChange={(e) => onChange(c.id, e.target.value)}>
                                <option value="">Escolha…</option>
                                {(c.opcoes || []).filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        )}
                        {c.tipo === 'sim_nao' && (
                            <select {...comum} className={seletor} value={v} onChange={(e) => onChange(c.id, e.target.value)}>
                                <option value="">{c.obrigatorio ? 'Escolha…' : 'Não informado'}</option>
                                <option value="sim">Sim</option>
                                <option value="nao">Não</option>
                            </select>
                        )}
                        {c.ajuda && <p id={`${id}-ajuda`} className="text-xs text-slate-600 dark:text-slate-400 mt-1">{c.ajuda}</p>}
                    </div>
                );
            })}
        </div>
    );
}

/** Valores gravados no processo, para leitura. */
export function DadosCampos({ campos, className = '' }) {
    if (!campos?.length) return null;
    return (
        <dl className={`grid sm:grid-cols-2 gap-x-6 gap-y-2 ${className}`}>
            {campos.map((c, i) => (
                <div key={c.id || i} className={c.tipo === 'texto_longo' ? 'sm:col-span-2' : ''}>
                    <dt className="text-xs text-slate-600 dark:text-slate-400">{c.rotulo}</dt>
                    <dd className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words">{valorTexto(c)}</dd>
                </div>
            ))}
        </dl>
    );
}

/** Configuração do formulário de autuação de um tipo de processo. */
export function EditorFormulario({ form, onChange }) {
    const [aberto, setAberto] = useState(null);
    const [previa, setPrevia] = useState({});
    const campos = form.campos;
    const setCampo = (i, patch) => onChange({ ...form, campos: campos.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
    const mover = (i, d) => {
        const lista = [...campos];
        [lista[i], lista[i + d]] = [lista[i + d], lista[i]];
        onChange({ ...form, campos: lista });
    };
    const adicionar = () => {
        const c = novoCampo();
        onChange({ ...form, campos: [...campos, c] });
        setAberto(c.id);
    };
    const rotuloTipo = (t) => TIPOS_CAMPO.find(([id]) => id === t)?.[1] || t;

    return (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
            <div>
                <p className="text-sm font-medium">Formulário do “Novo processo”</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">O que quem autua este tipo preenche. Assunto, unidade e sigilo aparecem sempre. O que for preenchido fica nos dados do processo.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
                <NativeSelect id="fm-descricao" label="Descrição" value={form.descricao} onChange={(v) => onChange({ ...form, descricao: v })} options={USOS_CAMPO} />
                <NativeSelect id="fm-partes" label="Partes e interessados" value={form.partes} onChange={(v) => onChange({ ...form, partes: v })} options={USOS_CAMPO} />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Campos próprios <span className="font-normal text-slate-600 dark:text-slate-400">({campos.length} de {MAX_CAMPOS})</span></p>
                    <Button type="button" size="sm" variant="outline" className="gap-1" disabled={campos.length >= MAX_CAMPOS} onClick={adicionar}><Plus className="w-4 h-4" /> Adicionar campo</Button>
                </div>
                {campos.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">Nenhum campo próprio. Exemplos: Número de origem, Valor, Data do fato, Urgente.</p>}
                {campos.map((c, i) => {
                    const expandido = aberto === c.id;
                    return (
                        <div key={c.id} className="rounded-md border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-1 px-2 py-1.5">
                                <button type="button" className="flex flex-1 min-w-0 items-center gap-2 text-left rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500" aria-expanded={expandido} onClick={() => setAberto(expandido ? null : c.id)}>
                                    <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${expandido ? 'rotate-180' : ''}`} aria-hidden />
                                    <span className="truncate text-sm font-medium">{c.rotulo.trim() || 'Campo sem nome'}</span>
                                    <span className="shrink-0 text-xs text-slate-600 dark:text-slate-400">{rotuloTipo(c.tipo)}</span>
                                    {c.obrigatorio && <Badge variant="outline" className="shrink-0">Obrigatório</Badge>}
                                    {c.visivel_partes && <Badge variant="secondary" className="shrink-0">Partes veem</Badge>}
                                </button>
                                <Button type="button" size="sm" variant="ghost" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Subir ${c.rotulo || 'campo'}`}><ArrowUp className="w-4 h-4" /></Button>
                                <Button type="button" size="sm" variant="ghost" disabled={i === campos.length - 1} onClick={() => mover(i, 1)} aria-label={`Descer ${c.rotulo || 'campo'}`}><ArrowDown className="w-4 h-4" /></Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...form, campos: campos.filter((_x, j) => j !== i) })} aria-label={`Remover ${c.rotulo || 'campo'}`}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                            {expandido && (
                                <div className="border-t border-slate-200 dark:border-slate-700 p-3 space-y-3">
                                    <div className="grid sm:grid-cols-3 gap-3">
                                        <div className="sm:col-span-2"><Label htmlFor={`fc-nome-${c.id}`}>Nome do campo</Label><Input id={`fc-nome-${c.id}`} className="mt-1" maxLength={80} value={c.rotulo} onChange={(e) => setCampo(i, { rotulo: e.target.value })} placeholder="Ex.: Número de origem" autoFocus={!c.rotulo} /></div>
                                        <NativeSelect id={`fc-tipo-${c.id}`} label="Tipo" value={c.tipo} onChange={(v) => setCampo(i, { tipo: v })} options={TIPOS_CAMPO} />
                                    </div>
                                    {c.tipo === 'lista' && (
                                        <div>
                                            <Label htmlFor={`fc-op-${c.id}`}>Opções (uma por linha)</Label>
                                            <Textarea id={`fc-op-${c.id}`} className="mt-1" rows={4} value={(c.opcoes || []).join('\n')} onChange={(e) => setCampo(i, { opcoes: e.target.value.split('\n').slice(0, 30) })} placeholder={'Ouvidoria\nOfício\nRepresentação'} />
                                        </div>
                                    )}
                                    <div><Label htmlFor={`fc-ajuda-${c.id}`}>Orientação para quem preenche</Label><Input id={`fc-ajuda-${c.id}`} className="mt-1" maxLength={200} value={c.ajuda || ''} onChange={(e) => setCampo(i, { ajuda: e.target.value })} placeholder="Opcional; aparece abaixo do campo" /></div>
                                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                                        <label className="flex items-center gap-2 text-sm"><Checkbox checked={c.obrigatorio} onCheckedChange={(x) => setCampo(i, { obrigatorio: x === true })} /> Obrigatório</label>
                                        <label className="flex items-center gap-2 text-sm"><Checkbox checked={c.visivel_partes} onCheckedChange={(x) => setCampo(i, { visivel_partes: x === true })} /> Mostrar às partes no portal</label>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {campos.length > 0 && (
                <details className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <summary className="flex items-center gap-2 text-sm cursor-pointer"><Eye className="w-4 h-4" aria-hidden /> Ver como fica para quem autua</summary>
                    <div className="pt-3">
                        <CamposProcesso prefixo="previa" campos={campos.map((c) => ({ ...c, opcoes: (c.opcoes || []).map((o) => o.trim()).filter(Boolean) }))} valores={previa} onChange={(id, v) => setPrevia((p) => ({ ...p, [id]: v }))} />
                    </div>
                </details>
            )}
        </div>
    );
}
