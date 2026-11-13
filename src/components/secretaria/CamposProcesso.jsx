import React, { useContext, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ChevronDown, Eye, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    COM_OPCOES, CONDICIONANTES, copiarCampos, FORMATOS, MAX_CAMPOS, MODULOS, PADROES, POLOS, ROTULO_MODULO, TIPOS_CAMPO, USOS_CAMPO, USOS_ESCOLHA, novoCampo, opcoesImportar, textoCondicao, valorTexto, visiveis,
} from '@/lib/camposProcesso';
import { NativeSelect } from './comum';
import SeletorRegistro, { RegistroContexto } from './SeletorRegistro';
import FormularioAutuacao from './FormularioAutuacao';

// ============================================================================
// Campos próprios do tipo de processo:
// - CamposProcesso: os campos para preencher (Novo processo e Editar dados);
// - DadosCampos: os valores gravados, para ler (processo e portal);
// - EditorFormulario: a configuração no tipo de processo, com prévia.
// ============================================================================

const seletor = 'mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
// Botões de ícone: 44px no toque, compactos a partir do tablet.
const ICONE = 'h-11 w-11 sm:h-8 sm:w-auto shrink-0 px-0 sm:px-2';
const Obrigatorio = () => <span className="text-red-600 dark:text-red-400" aria-hidden> *</span>;

// Texto curto com formato: o teclado e a dica certos no celular.
const ENTRADA = {
    email: { type: 'email', inputMode: 'email', autoComplete: 'email', placeholder: 'nome@exemplo.com' },
    telefone: { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '(51) 99999-9999' },
    cpf_cnpj: { inputMode: 'numeric', placeholder: 'Só os números ou com pontuação' },
    link: { type: 'url', inputMode: 'url', placeholder: 'https://' },
};

/** Campos para preencher. `valores` = { id: valor }; `onChange(id, valor)`. Mostra seções e só os campos cuja condição se cumpre. */
export function CamposProcesso({ campos, valores, onChange, prefixo = 'cp' }) {
    if (!campos?.length) return null;
    const aparecem = visiveis(campos, valores);
    const lista = campos.filter((c) => aparecem.has(c.id));
    return (
        <div className="grid sm:grid-cols-2 gap-3">
            {lista.map((c, i) => {
                const id = `${prefixo}-${c.id}`;
                const bruto = valores?.[c.id];
                // Múltipla sempre recebe lista (um valor antigo de uma opção só vira lista de um).
                const v = c.tipo === 'multipla' ? (Array.isArray(bruto) ? bruto : bruto ? [String(bruto)] : []) : Array.isArray(bruto) ? (bruto[0] ?? '') : (bruto ?? '');
                const largo = c.tipo === 'texto_longo' || c.tipo === 'multipla' || c.tipo === 'registro';
                const comum = { id, 'aria-required': c.obrigatorio || undefined, 'aria-describedby': c.ajuda ? `${id}-ajuda` : undefined };
                const secao = c.secao?.trim();
                const novaSecao = secao && secao !== lista[i - 1]?.secao?.trim();
                return (
                    <React.Fragment key={c.id}>
                        {novaSecao && <h3 className="sm:col-span-2 pt-2 text-sm font-semibold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-1">{secao}</h3>}
                    <div className={largo ? 'sm:col-span-2' : ''}>
                        {c.tipo === 'multipla' ? (
                            <fieldset aria-describedby={comum['aria-describedby']}>
                                <legend className="text-sm font-medium leading-none">{c.rotulo || 'Campo sem nome'}{c.obrigatorio && <Obrigatorio />}</legend>
                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                    {(c.opcoes || []).filter(Boolean).map((o, j) => (
                                        <label key={o} className="flex items-center gap-2 text-sm min-h-[2rem]">
                                            <Checkbox id={j === 0 ? id : undefined} checked={v.includes(o)}
                                                onCheckedChange={(x) => onChange(c.id, x === true ? (c.opcoes || []).filter((y) => y === o || v.includes(y)) : v.filter((y) => y !== o))} /> {o}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        ) : <Label htmlFor={id}>{c.rotulo || 'Campo sem nome'}{c.obrigatorio && <Obrigatorio />}</Label>}
                        {c.tipo === 'texto_longo' && <Textarea {...comum} className="mt-1" rows={3} maxLength={4000} value={v} onChange={(e) => onChange(c.id, e.target.value)} />}
                        {c.tipo === 'texto' && <Input {...comum} {...(ENTRADA[c.formato] || {})} className="mt-1" maxLength={c.formato === 'link' ? 500 : 200} value={v} onChange={(e) => onChange(c.id, e.target.value)} />}
                        {c.tipo === 'numero' && (c.formato === 'moeda' ? (
                            <div className="relative mt-1">
                                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-600 dark:text-slate-400" aria-hidden>R$</span>
                                <Input {...comum} className="pl-9" inputMode="decimal" placeholder="0,00" value={v} onChange={(e) => onChange(c.id, e.target.value)} />
                            </div>
                        ) : <Input {...comum} className="mt-1" inputMode="decimal" placeholder="0" value={v} onChange={(e) => onChange(c.id, e.target.value)} />)}
                        {c.tipo === 'data' && <Input {...comum} className="mt-1" type="date" value={v} onChange={(e) => onChange(c.id, e.target.value)} />}
                        {c.tipo === 'registro' && <SeletorRegistro id={id} aria-required={comum['aria-required']} aria-describedby={comum['aria-describedby']} modulo={c.modulo} value={bruto && typeof bruto === 'object' ? bruto : ''} onChange={(x) => onChange(c.id, x)} />}
                        {c.tipo === 'registro' && bruto?.restrito && campos.some((d) => d.importar?.de === c.id) && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Registro de acesso restrito: os dados dele não são trazidos para os campos.</p>}
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
                    </React.Fragment>
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

/** Um campo padrão do "Novo processo": uso, nome na tela e orientação. */
function LinhaPadrao({ p, form, onChange }) {
    const [aberto, setAberto] = useState(false);
    const usoAtual = form[p.id];
    const nome = form.rotulos?.[p.id] || '';
    const ajuda = form.ajudas?.[p.id] || '';
    const set = (k, v) => onChange({ ...form, [k]: { ...(form[k] || {}), [p.id]: v } });
    const oculto = usoAtual === 'oculto';
    return (
        <li className="py-2 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-[8rem] flex-1 text-sm">
                    <span className="font-medium">{nome.trim() || p.rotulo}</span>
                    {nome.trim() && <span className="text-xs text-slate-600 dark:text-slate-400"> (padrão: {p.rotulo})</span>}
                </span>
                <select aria-label={`Uso de ${p.rotulo}`} value={usoAtual} onChange={(e) => onChange({ ...form, [p.id]: e.target.value })}
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                    {(p.escolha ? USOS_ESCOLHA : USOS_CAMPO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 text-xs" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
                    Nome e orientação <ChevronDown className={`w-3.5 h-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden />
                </Button>
            </div>
            {oculto && p.oculto && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{p.oculto}</p>}
            {aberto && (
                <div className="grid sm:grid-cols-2 gap-2 mt-2">
                    <div><Label htmlFor={`fp-nome-${p.id}`} className="text-xs">Nome na tela</Label><Input id={`fp-nome-${p.id}`} className="mt-1 h-8" maxLength={60} placeholder={p.rotulo} value={nome} onChange={(e) => set('rotulos', e.target.value)} /></div>
                    <div><Label htmlFor={`fp-ajuda-${p.id}`} className="text-xs">Orientação para quem preenche</Label><Input id={`fp-ajuda-${p.id}`} className="mt-1 h-8" maxLength={200} placeholder="Opcional; aparece abaixo do campo" value={ajuda} onChange={(e) => set('ajudas', e.target.value)} /></div>
                </div>
            )}
            {p.id === 'partes' && !oculto && (
                <fieldset className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <legend className="sr-only">Polos que as partes podem ter</legend>
                    <span className="text-xs text-slate-600 dark:text-slate-400">Polos:</span>
                    {POLOS.map(([v, l]) => (
                        <label key={v} className="flex items-center gap-1.5 text-sm">
                            <Checkbox checked={form.polos.includes(v)} onCheckedChange={(c) => onChange({ ...form, polos: c === true ? POLOS.map(([x]) => x).filter((x) => x === v || form.polos.includes(x)) : form.polos.filter((x) => x !== v) })} /> {l}
                        </label>
                    ))}
                </fieldset>
            )}
        </li>
    );
}

const PREVIA_VAZIA = { assunto: '', descricao: '', origem: { tipo: '', descricao: '' }, unidade_id: 'u', sigilo: 'normal', urgente: false, motivo_urgencia: '', partes: [], campos: {} };

/** Quando o campo aparece: depende de um campo de escolha anterior. */
function MostrarQuando({ c, anteriores, onChange, p = (x) => `fc-${x}` }) {
    const alvo = anteriores.find((d) => d.id === c.condicao?.campo_id);
    const valores = alvo?.tipo === 'sim_nao' ? [['sim', 'Sim'], ['nao', 'Não']] : (alvo?.opcoes || []).map((o) => o.trim()).filter(Boolean).map((o) => [o, o]);
    const atual = typeof c.condicao?.valor === 'boolean' ? (c.condicao.valor ? 'sim' : 'nao') : c.condicao?.valor || '';
    // Condição que perdeu o campo ou o valor (removido, movido, renomeado): aparece como pendente, para escolher de novo.
    const semAlvo = !!c.condicao && !alvo;
    const semValor = !!alvo && !valores.some(([v]) => v === atual);
    const valorDe = (d, v) => (d?.tipo === 'sim_nao' ? v === 'sim' : v);
    return (
        <div className="grid sm:grid-cols-2 gap-3">
            <div>
                <Label htmlFor={p(`cond-${c.id}`)}>Mostrar este campo</Label>
                <select id={p(`cond-${c.id}`)} className={seletor} value={semAlvo ? '__perdido' : alvo?.id || ''}
                    onChange={(e) => {
                        const d = anteriores.find((x) => x.id === e.target.value);
                        const primeiro = d?.tipo === 'sim_nao' ? true : (d?.opcoes || []).map((o) => o.trim()).find(Boolean);
                        onChange({ condicao: d ? { campo_id: d.id, valor: primeiro ?? '' } : undefined });
                    }}>
                    {semAlvo && <option value="__perdido" disabled>Dependia de um campo que saiu daqui: escolha de novo</option>}
                    <option value="">Sempre</option>
                    {anteriores.map((d) => <option key={d.id} value={d.id}>Só quando “{d.rotulo || 'Campo sem nome'}”…</option>)}
                </select>
                {!anteriores.length && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Para depender de outro, ponha antes dele um campo de lista ou de sim ou não.</p>}
            </div>
            {alvo && (
                <div>
                    <Label htmlFor={p(`condv-${c.id}`)}>{alvo.tipo === 'multipla' ? 'incluir' : 'for'}</Label>
                    <select id={p(`condv-${c.id}`)} className={seletor} value={semValor ? '__perdido' : atual} onChange={(e) => onChange({ condicao: { campo_id: alvo.id, valor: valorDe(alvo, e.target.value) } })}>
                        {semValor && <option value="__perdido" disabled>Escolha um valor</option>}
                        {valores.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                </div>
            )}
        </div>
    );
}

/** Fases do rito que só se deixam com o campo preenchido. */
function ExigirEm({ c, fases, onChange }) {
    if (!fases?.length) return null;
    const sel = c.exigir_em || [];
    const sumidas = sel.filter((id) => !fases.some((f) => f.id === id));
    const alternar = (id) => {
        const l = sel.includes(id) ? sel.filter((x) => x !== id) : fases.map((f) => f.id).filter((x) => x === id || sel.includes(x));
        onChange({ exigir_em: l.length ? l : undefined, ...(l.length ? { obrigatorio: false } : {}) });
    };
    return (
        <fieldset>
            <legend className="text-sm font-medium">Exigir para sair das fases</legend>
            <p className="text-xs text-slate-600 dark:text-slate-400">Pode ficar em branco na autuação; antes de deixar a fase marcada, alguém precisa preencher (ou dispensar com motivo).</p>
            <div className="mt-2 flex flex-wrap gap-2">
                {fases.map((f) => {
                    const on = sel.includes(f.id);
                    return (
                        <button key={f.id} type="button" aria-pressed={on} onClick={() => alternar(f.id)}
                            className={`min-h-[2.75rem] sm:min-h-0 rounded-full border px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${on ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                            {f.nome}
                        </button>
                    );
                })}
            </div>
            {sumidas.length > 0 && (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
                    {sumidas.length === 1 ? 'Uma fase marcada não existe' : `${sumidas.length} fases marcadas não existem`} no rito deste tipo.{' '}
                    <button type="button" className="underline font-medium" onClick={() => {
                        const l = sel.filter((id) => !sumidas.includes(id));
                        onChange({ exigir_em: l.length ? l : undefined });
                    }}>Tirar da lista</button>
                </p>
            )}
        </fieldset>
    );
}

/**
 * Lista de campos para criar, ordenar, configurar e remover. Serve ao
 * formulário do tipo de processo e à ação do rito que pede um formulário
 * (`paraAcao`: obrigatório vale ao cumprir a ação; sem "exigir em" nem
 * "partes veem" por campo, que são da ação inteira).
 */
export function EditorCampos({ campos, onChange, fases = [], max = MAX_CAMPOS, paraAcao = false, prefixo = 'fc' }) {
    const { ligadas } = useContext(RegistroContexto);
    const [aberto, setAberto] = useState(null);
    const setCampo = (i, patch) => onChange(campos.map((c, j) => (j === i ? { ...c, ...patch } : c)));
    const mover = (i, d) => {
        const lista = [...campos];
        [lista[i], lista[i + d]] = [lista[i + d], lista[i]];
        onChange(lista);
    };
    const adicionar = () => {
        const c = novoCampo();
        onChange([...campos, c]);
        setAberto(c.id);
    };
    const rotuloTipo = (c) => (c.tipo === 'registro' ? `Registro de ${ROTULO_MODULO[c.modulo] || 'outro módulo'}` : TIPOS_CAMPO.find(([id]) => id === c.tipo)?.[1] || c.tipo);
    // Registro: vem de um módulo com a integração ligada (os desligados aparecem, sem poder escolher).
    const opcoesModulo = MODULOS.map(([m, l]) => [m, ligadas?.[m] ? l : `${l} (integração desligada)`]);
    // Trocar o tipo ou o formato solta o dado importado; o registro que muda de módulo solta quem importava dele.
    const trocarTipo = (i, v) => onChange(campos.map((c, j) => (j === i
        ? { ...c, tipo: v, formato: undefined, importar: undefined, modulo: v === 'registro' ? (MODULOS.find(([m]) => ligadas?.[m])?.[0] || 'consultas') : undefined }
        : c.importar?.de === campos[i].id ? { ...c, importar: undefined } : c)));
    const trocarModulo = (i, v) => onChange(campos.map((c, j) => (j === i ? { ...c, modulo: v } : c.importar?.de === campos[i].id ? { ...c, importar: undefined } : c)));
    const secoes = [...new Set(campos.map((c) => c.secao?.trim()).filter(Boolean))];
    const nomeFase = (id) => fases.find((f) => f.id === id)?.nome;
    // Remover um campo solta quem dependia dele (o campo volta a aparecer sempre).
    const remover = (i) => {
        const id = campos[i].id;
        onChange(campos.filter((_x, j) => j !== i).map((c) => ({ ...c, ...(c.condicao?.campo_id === id ? { condicao: undefined } : {}), ...(c.importar?.de === id ? { importar: undefined } : {}) })));
    };
    const p = (s) => `${prefixo}-${s}`;

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{paraAcao ? 'Campos do formulário' : 'Campos próprios'} <span className="font-normal text-slate-600 dark:text-slate-400">({campos.length} de {max})</span></p>
                <Button type="button" size="sm" variant="outline" className="gap-1 h-11 sm:h-8" disabled={campos.length >= max} onClick={adicionar}><Plus className="w-4 h-4" /> Adicionar campo</Button>
            </div>
            {campos.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">{paraAcao ? 'Nenhum campo ainda. Crie ao menos um.' : 'Nenhum campo próprio. Exemplos: Número de origem, Valor, Data do fato, Urgente.'}</p>}
            {campos.map((c, i) => {
                const expandido = aberto === c.id;
                return (
                    <div key={c.id} className="rounded-md border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-1 px-2 py-1.5">
                            <button type="button" className="flex w-0 flex-1 min-w-0 overflow-hidden items-center gap-2 text-left rounded min-h-[2.75rem] sm:min-h-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500" aria-expanded={expandido} onClick={() => setAberto(expandido ? null : c.id)}>
                                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${expandido ? 'rotate-180' : ''}`} aria-hidden />
                                <span className="truncate text-sm font-medium">{c.rotulo.trim() || 'Campo sem nome'}{c.obrigatorio && <span className="sm:hidden"><Obrigatorio /><span className="sr-only"> (obrigatório)</span></span>}</span>
                                <span className="shrink-0 hidden sm:inline text-xs text-slate-600 dark:text-slate-400">{rotuloTipo(c)}</span>
                                {c.obrigatorio && <Badge variant="outline" className="shrink-0 hidden sm:inline-flex">Obrigatório</Badge>}
                                {!paraAcao && c.exigir_em?.some(nomeFase) && <Badge variant="outline" className="shrink-0 hidden sm:inline-flex" title={`Exigido para sair de: ${c.exigir_em.map(nomeFase).filter(Boolean).join(', ')}`}>Exigido em {c.exigir_em.filter(nomeFase).length === 1 ? nomeFase(c.exigir_em.find(nomeFase)) : `${c.exigir_em.filter(nomeFase).length} fases`}</Badge>}
                                {c.condicao && <Badge variant="outline" className="shrink-0 hidden sm:inline-flex" title={textoCondicao(campos, c)}>Condicional</Badge>}
                                {!paraAcao && c.importar && <Badge variant="outline" className="shrink-0 hidden sm:inline-flex">Do registro</Badge>}
                                {!paraAcao && c.visivel_partes && <Badge variant="secondary" className="shrink-0 hidden sm:inline-flex">Partes veem</Badge>}
                            </button>
                            <Button type="button" size="sm" variant="ghost" className={ICONE} disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Subir ${c.rotulo || 'campo'}`}><ArrowUp className="w-4 h-4" /></Button>
                            <Button type="button" size="sm" variant="ghost" className={ICONE} disabled={i === campos.length - 1} onClick={() => mover(i, 1)} aria-label={`Descer ${c.rotulo || 'campo'}`}><ArrowDown className="w-4 h-4" /></Button>
                            <Button type="button" size="sm" variant="ghost" className={ICONE} onClick={() => remover(i)} aria-label={`Remover ${c.rotulo || 'campo'}`}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        {expandido && (
                            <div className="border-t border-slate-200 dark:border-slate-700 p-3 space-y-3">
                                <div className="grid sm:grid-cols-3 gap-3">
                                    <div className="sm:col-span-2"><Label htmlFor={p(`nome-${c.id}`)}>Nome do campo</Label><Input id={p(`nome-${c.id}`)} className="mt-1" maxLength={80} value={c.rotulo} onChange={(e) => setCampo(i, { rotulo: e.target.value })} placeholder={paraAcao ? 'Ex.: Data da audiência' : 'Ex.: Número de origem'} autoFocus={!c.rotulo} /></div>
                                    <NativeSelect id={p(`tipo-${c.id}`)} label="Tipo" value={c.tipo} onChange={(v) => trocarTipo(i, v)} options={TIPOS_CAMPO} />
                                </div>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    {FORMATOS[c.tipo] && <NativeSelect id={p(`formato-${c.id}`)} label="Formato" value={c.formato || ''} onChange={(v) => setCampo(i, { formato: v || undefined, ...(v ? { importar: undefined } : {}) })} options={FORMATOS[c.tipo]} />}
                                    <div>
                                        <Label htmlFor={p(`secao-${c.id}`)}>Seção</Label>
                                        <Input id={p(`secao-${c.id}`)} className="mt-1" maxLength={60} list={p(`secoes-${c.id}`)} value={c.secao || ''} onChange={(e) => setCampo(i, { secao: e.target.value })} placeholder="Opcional. Ex.: Dados do fato" />
                                        <datalist id={p(`secoes-${c.id}`)}>{secoes.map((s) => <option key={s} value={s} />)}</datalist>
                                    </div>
                                </div>
                                {c.tipo === 'registro' && (
                                    <div className="space-y-1">
                                        <div className="sm:max-w-xs"><NativeSelect id={p(`mod-${c.id}`)} label="De qual módulo" value={c.modulo || ''} onChange={(v) => trocarModulo(i, v)} options={opcoesModulo} /></div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">Quem preenche procura pelo número ou assunto. O processo guarda só o número e o título; as partes veem só o número, e nunca o de acesso restrito.{!paraAcao && ' Outros campos podem ser preenchidos com dados dele (em cada campo, "Preencher com dado de").'}</p>
                                        {c.modulo && !ligadas?.[c.modulo] && <p className="text-xs text-amber-800 dark:text-amber-200">A integração com {ROTULO_MODULO[c.modulo]} está desligada: ligue em "Integrações com outros módulos", no alto da configuração do Processo Eletrônico, para salvar e usar este campo.</p>}
                                    </div>
                                )}
                                {COM_OPCOES.includes(c.tipo) && (
                                    <div>
                                        <Label htmlFor={p(`op-${c.id}`)}>Opções (uma por linha)</Label>
                                        <Textarea id={p(`op-${c.id}`)} className="mt-1" rows={4} value={(c.opcoes || []).join('\n')} onChange={(e) => setCampo(i, { opcoes: e.target.value.split('\n').slice(0, 30) })} placeholder={'Ouvidoria\nOfício\nRepresentação'} />
                                    </div>
                                )}
                                <div><Label htmlFor={p(`ajuda-${c.id}`)}>Orientação para quem preenche</Label><Input id={p(`ajuda-${c.id}`)} className="mt-1" maxLength={200} value={c.ajuda || ''} onChange={(e) => setCampo(i, { ajuda: e.target.value })} placeholder="Opcional; aparece abaixo do campo" /></div>
                                {!paraAcao && opcoesImportar(campos, c).length > 0 && (
                                    <div className="sm:max-w-md">
                                        <NativeSelect id={p(`imp-${c.id}`)} label="Preencher com dado de" value={c.importar ? `${c.importar.de}|${c.importar.dado}` : ''}
                                            onChange={(v) => { const [de, dado] = v.split('|'); setCampo(i, v ? { importar: { de, dado }, visivel_partes: false } : { importar: undefined }); }}
                                            options={[['', 'Não preencher'], ...opcoesImportar(campos, c)]} />
                                        {c.importar && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Preenchido ao escolher o registro na autuação; quem autua pode editar; nunca aparece às partes.</p>}
                                    </div>
                                )}
                                <MostrarQuando p={p} c={c} anteriores={campos.slice(0, i).filter((d) => CONDICIONANTES.includes(d.tipo))} onChange={(patch) => setCampo(i, patch)} />
                                <div className="flex flex-wrap gap-x-6 gap-y-2">
                                    <label className="flex items-center gap-2 text-sm min-h-[2.75rem] sm:min-h-0"><Checkbox checked={c.obrigatorio} disabled={!paraAcao && !!c.exigir_em?.some(nomeFase)} onCheckedChange={(x) => setCampo(i, { obrigatorio: x === true })} /> {paraAcao ? 'Obrigatório ao cumprir a ação' : 'Obrigatório na autuação'}</label>
                                    {!paraAcao && <label className="flex items-center gap-2 text-sm min-h-[2.75rem] sm:min-h-0"><Checkbox checked={c.visivel_partes} disabled={!!c.importar} onCheckedChange={(x) => setCampo(i, { visivel_partes: x === true })} /> Mostrar às partes no portal</label>}
                                </div>
                                {!paraAcao && <ExigirEm c={c} fases={fases} onChange={(patch) => setCampo(i, patch)} />}
                            </div>
                        )}
                    </div>
                );
            })}
            {paraAcao && <p className="text-xs text-slate-600 dark:text-slate-400">Quem cumpre a ação preenche estes campos de uma vez. O que for preenchido vai num só registro, com destino e partes como a ação disser.</p>}
        </div>
    );
}

/**
 * Configuração do formulário de autuação de um tipo de processo. `tipo` serve à
 * prévia (urgência e sigilo); `fases`, as do rito do tipo, a "Exigir para sair das fases".
 */
export function EditorFormulario({ form, onChange, tipo = null, fases = [], previa: comPrevia = true, outros = [] }) {
    const [previa, setPrevia] = useState(PREVIA_VAZIA);
    const [copiarId, setCopiarId] = useState('');
    const campos = form.campos;
    // Copiar os campos próprios de outro tipo: entram todos (até o limite); tira-se o que não quiser.
    const copiarDe = (id) => {
        const outro = outros.find((t) => t.id === id);
        if (!outro) return;
        const novos = copiarCampos(outro.formulario?.campos, fases.map((f) => f.id), MAX_CAMPOS - campos.length);
        if (!novos.length) { toast.error(`Não cabem mais campos (máximo de ${MAX_CAMPOS})`); return; }
        onChange({ ...form, campos: [...campos, ...novos] });
        toast.success(`${novos.length === 1 ? '1 campo copiado' : `${novos.length} campos copiados`} de ${outro.nome}. Confira os nomes e o que as partes veem.`);
    };

    return (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
            <div>
                <p className="text-sm font-medium">Formulário do “Novo processo”</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Tudo o que quem autua este tipo vê e preenche. Cada campo padrão pode ser obrigatório, opcional ou não usado (as escolhas podem ficar fixas pelo tipo), com nome e orientação próprios. O que for preenchido fica nos dados do processo.</p>
            </div>
            <section aria-label="Campos padrão" className="space-y-1">
                <p className="text-sm font-medium">Campos padrão</p>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {PADROES.map((p) => <LinhaPadrao key={p.id} p={p} form={form} onChange={onChange} />)}
                </ul>
            </section>

            {outros.length > 0 && (
                <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[12rem] sm:max-w-sm">
                        <NativeSelect id="fp-copiar" label="Copiar campos de outro tipo" value={copiarId} onChange={setCopiarId}
                            options={[['', 'Escolha o tipo…'], ...outros.map((t) => [t.id, `${t.nome}${t.excluido ? ' (excluído)' : ''} (${t.formulario.campos.length} ${t.formulario.campos.length === 1 ? 'campo' : 'campos'})`])]} />
                    </div>
                    <Button type="button" variant="outline" className="h-11 sm:h-9" disabled={!copiarId} onClick={() => { copiarDe(copiarId); setCopiarId(''); }}>Copiar</Button>
                </div>
            )}
            <EditorCampos campos={campos} fases={fases} onChange={(l) => onChange({ ...form, campos: l })} />

            {comPrevia && <details className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 px-3 py-2">
                <summary className="flex items-center gap-2 text-sm cursor-pointer"><Eye className="w-4 h-4" aria-hidden /> Ver como fica para quem autua</summary>
                <div className="pt-3">
                    <FormularioAutuacao prefixo="previa" tipo={tipo} f={{ ...previa, sigilo: form.sigilo === 'oculto' ? tipo?.sigilo_padrao || 'normal' : previa.sigilo, urgente: tipo?.urgente === true || previa.urgente }} setF={setPrevia}
                        form={{ ...form, polos: form.polos.length ? form.polos : POLOS.map(([x]) => x), campos: campos.map((c) => ({ ...c, opcoes: (c.opcoes || []).map((o) => o.trim()).filter(Boolean) })) }}
                        unidades={[['u', 'A unidade de quem autua']]} />
                </div>
            </details>}
        </div>
    );
}
