import React, { useEffect, useId, useRef, useState } from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CaseUpper, Italic, Plus, RotateCcw, Trash2, Underline, Wand2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    CAMPOS_PAGINA, CHAVES_ESTILO, ESTILOS_PADRAO, FORMATOS_NUMERO, FORMATOS_PARAGRAFO, FORMATOS_TITULO, MARGENS_PADRAO, MARGENS_PRONTAS, MODOS_FAIXA, PAGINAS_FAIXA, PAPEIS,
    POSICOES_NUMERO, TAMANHO_NUMERO, comTimbrado, cssDoEstilo, estiloEfetivo, faixaDoTimbrado, folhaCm, idDeEstilo, limparLayout, margensDe,
} from '@/lib/layoutDocumento';

/**
 * "Página e estilos" do documento, como Configurar página, Estilos e
 * Numeração do Word: papel, orientação e margens; Normal, Títulos, Citação e
 * estilos próprios; numeração automática de títulos e de parágrafos. Muda o
 * documento na hora (Ctrl+Z desfaz) e vale no PDF dos autos e no .docx.
 */

const ESPACAMENTOS = [1, 1.15, 1.5, 2, 2.5, 3];
const virgula = (n) => String(n).replace('.', ',');
const numOuVazio = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));
const campo = 'h-9 w-full rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm';

/** Número com unidade; vale ao sair do campo ou com Enter (digitar "0,8" não passa por "0"). */
function Medida({ id, rotulo, valor, onChange, unidade = 'cm', min = 0, max = 10, passo = 0.1, placeholder }) {
    const [txt, setTxt] = useState(valor ?? '');
    useEffect(() => { setTxt(valor ?? ''); }, [valor]);
    const confirmar = () => {
        const v = numOuVazio(String(txt).replace(',', '.'));
        if (v !== undefined && (!Number.isFinite(v) || v < min || v > max)) { setTxt(valor ?? ''); return; }
        if (v !== valor) onChange(v);
    };
    return (
        <div className="min-w-0">
            <Label htmlFor={id} className="text-xs">{rotulo}</Label>
            <div className="mt-1 flex items-center gap-1">
                <Input id={id} type="number" inputMode="decimal" min={min} max={max} step={passo} value={txt} placeholder={placeholder}
                    onChange={(e) => setTxt(e.target.value)} onBlur={confirmar} onKeyDown={(e) => e.key === 'Enter' && confirmar()} className="h-9" />
                <span className="text-xs text-slate-600 dark:text-slate-400 shrink-0">{unidade}</span>
            </div>
        </div>
    );
}

function Alternar({ titulo, ativo, onClick, children }) {
    return (
        <button type="button" title={titulo} aria-label={titulo} aria-pressed={!!ativo} onClick={onClick}
            className={`h-9 w-9 inline-flex items-center justify-center rounded-md border focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${ativo ? 'bg-indigo-100 border-indigo-400 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100' : 'border-input text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            {children}
        </button>
    );
}

/** Folha em miniatura com a área do texto, para ver papel, orientação e margens. */
function MiniFolha({ layout }) {
    const { w, h } = folhaCm(layout);
    const m = margensDe(layout);
    const escala = 150 / Math.max(w, h);
    return (
        <div className="flex items-center justify-center rounded-md bg-slate-200 dark:bg-slate-800 p-4 min-h-[190px]" aria-hidden>
            <div className="relative bg-white shadow" style={{ width: w * escala, height: h * escala }}>
                <div className="absolute border border-dashed border-indigo-400 bg-indigo-50/60"
                    style={{ top: m.sup * escala, bottom: m.inf * escala, left: m.esq * escala, right: m.dir * escala }}>
                    <div className="m-1 space-y-1">{[100, 92, 100, 70].map((p, i) => <div key={i} className="h-1 bg-slate-300 rounded" style={{ width: `${p}%` }} />)}</div>
                </div>
            </div>
        </div>
    );
}

function FormEstilo({ estilo, setEstilo, fontes, prefixo }) {
    const e = estilo;
    const mudar = (k, v) => setEstilo({ ...e, [k]: v });
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
                <div>
                    <Label htmlFor={`${prefixo}-fonte`} className="text-xs">Fonte</Label>
                    <select id={`${prefixo}-fonte`} className={`mt-1 ${campo}`} value={e.fonte || ''} onChange={(x) => mudar('fonte', x.target.value || undefined)}>
                        {fontes.map(([v, l]) => <option key={v} value={v}>{v ? l : 'A do documento'}</option>)}
                    </select>
                </div>
                <div className="w-24"><Medida id={`${prefixo}-tam`} rotulo="Tamanho" unidade="pt" min={6} max={96} passo={0.5} valor={e.tamanho} placeholder="padrão" onChange={(v) => mudar('tamanho', v)} /></div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Efeitos do texto">
                <Alternar titulo="Negrito" ativo={e.negrito} onClick={() => mudar('negrito', e.negrito ? false : true)}><Bold className="w-4 h-4" /></Alternar>
                <Alternar titulo="Itálico" ativo={e.italico} onClick={() => mudar('italico', !e.italico || undefined)}><Italic className="w-4 h-4" /></Alternar>
                <Alternar titulo="Sublinhado" ativo={e.sublinhado} onClick={() => mudar('sublinhado', !e.sublinhado || undefined)}><Underline className="w-4 h-4" /></Alternar>
                <Alternar titulo="Tudo em maiúsculas" ativo={e.maiusculas} onClick={() => mudar('maiusculas', !e.maiusculas || undefined)}><CaseUpper className="w-4 h-4" /></Alternar>
                <span className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" aria-hidden />
                {[['left', 'À esquerda', AlignLeft], ['center', 'Centralizado', AlignCenter], ['right', 'À direita', AlignRight], ['justify', 'Justificado', AlignJustify]].map(([v, t, I]) => (
                    <Alternar key={v} titulo={t} ativo={e.alinhamento === v} onClick={() => mudar('alinhamento', e.alinhamento === v ? undefined : v)}><I className="w-4 h-4" /></Alternar>
                ))}
                <span className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" aria-hidden />
                <label className="flex items-center gap-1 text-xs">Cor
                    <input type="color" aria-label="Cor do texto do estilo" value={e.cor || '#000000'} onChange={(x) => mudar('cor', x.target.value)} className="h-8 w-9 p-0 border-0 bg-transparent" />
                </label>
                {e.cor && <button type="button" className="text-xs text-indigo-700 dark:text-indigo-300 hover:underline" onClick={() => mudar('cor', undefined)}>Automática</button>}
            </div>
            <div className="grid grid-cols-3 gap-2">
                <Medida id={`${prefixo}-recuo`} rotulo="1ª linha" valor={e.recuo} max={5} placeholder="0" onChange={(v) => mudar('recuo', v)} />
                <Medida id={`${prefixo}-esq`} rotulo="Recuo à esquerda" valor={e.margemEsq} placeholder="0" onChange={(v) => mudar('margemEsq', v)} />
                <Medida id={`${prefixo}-dir`} rotulo="Recuo à direita" valor={e.margemDir} placeholder="0" onChange={(v) => mudar('margemDir', v)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <Label htmlFor={`${prefixo}-esp`} className="text-xs">Entre linhas</Label>
                    <select id={`${prefixo}-esp`} className={`mt-1 ${campo}`} value={String(e.espacamento ?? '')} onChange={(x) => mudar('espacamento', numOuVazio(x.target.value))}>
                        <option value="">1,15 (padrão)</option>
                        {ESPACAMENTOS.filter((v) => v !== 1.15).map((v) => <option key={v} value={String(v)}>{virgula(v)}</option>)}
                    </select>
                </div>
                <Medida id={`${prefixo}-antes`} rotulo="Antes" unidade="pt" max={72} passo={1} valor={e.antes} onChange={(v) => mudar('antes', v)} />
                <Medida id={`${prefixo}-depois`} rotulo="Depois" unidade="pt" max={72} passo={1} valor={e.depois} onChange={(v) => mudar('depois', v)} />
            </div>
        </div>
    );
}

/** Formatação do parágrafo onde está o cursor, para "atualizar o estilo" (como no Word). */
export function formatoDoParagrafo(editor) {
    if (!editor) return {};
    const b = editor.isActive('heading') ? editor.getAttributes('heading') : editor.getAttributes('paragraph');
    const ts = editor.getAttributes('textStyle');
    const e = {
        fonte: ts.fontFamily || undefined,
        tamanho: ts.fontSize ? parseFloat(ts.fontSize) : undefined,
        negrito: editor.isActive('bold') || undefined,
        italico: editor.isActive('italic') || undefined,
        sublinhado: editor.isActive('underline') || undefined,
        cor: /^#[0-9a-f]{6}$/i.test(ts.color || '') ? ts.color : undefined,
        alinhamento: b.textAlign && b.textAlign !== 'left' ? b.textAlign : undefined,
        recuo: b.recuo ?? undefined, margemEsq: b.margemEsq ?? undefined, margemDir: b.margemDir ?? undefined,
        espacamento: b.espacamento ?? undefined, antes: b.antes ?? undefined, depois: b.depois ?? undefined,
    };
    return Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined));
}

/** Escolha em botões (como "Retrato | Paisagem"), com descrição opcional em cada um. */
function Opcoes({ rotulo, valor, opcoes, onChange, colunas = 'sm:grid-cols-3' }) {
    return (
        <div className={`grid grid-cols-1 ${colunas} gap-1.5`} role="radiogroup" aria-label={rotulo}>
            {opcoes.map(([v, r, d]) => (
                <button key={v} type="button" role="radio" aria-checked={valor === v} onClick={() => onChange(v)}
                    className={`rounded-md border px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${valor === v ? 'bg-indigo-50 border-indigo-400 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100' : 'border-input hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <span className="font-medium block">{r}</span>
                    {d && <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">{d}</span>}
                </button>
            ))}
        </div>
    );
}

/** Cabeçalho ou rodapé: o da unidade, um próprio (editado como o texto) ou nenhum; e em quais páginas. */
function EditarFaixa({ tipo, rotulo, faixa, herdada, onFaixa, config = {}, campos, EditorFaixa, larguraUtil, uid, modoTimbrado = false }) {
    const f = faixa || {};
    const ultima = useRef(f);
    ultima.current = f;
    const modo = f.modo || 'unidade';
    const [versao, setVersao] = useState(0); // recria o editor quando o texto é trocado por fora
    const simples = tipo === 'cabecalho' ? (config.cabecalho_linhas || []).filter(Boolean)[0] || (config.brasao ? 'Brasão' : '') : config.rodape || '';
    // No documento, "da unidade" segue o papel timbrado, que pode ter cabeçalho/rodapé completo.
    const daUnidade = modoTimbrado ? simples || 'Preencha as linhas do formulário'
        : herdada?.modo === 'proprio' ? `O do papel timbrado (editor completo)` : herdada?.modo === 'nenhum' ? `O papel timbrado não tem ${rotulo.toLowerCase()}` : simples || 'A unidade não definiu';
    const recomecar = () => { onFaixa({ ...f, modo: 'proprio', conteudo: herdada?.modo === 'proprio' && herdada.conteudo?.length ? herdada.conteudo : faixaDoTimbrado(config, tipo) }); setVersao((v) => v + 1); };
    const escolher = (m) => (m === 'proprio' && !f.conteudo?.length ? recomecar() : onFaixa({ ...f, modo: m }));
    const rotulos = modoTimbrado ? { unidade: tipo === 'cabecalho' ? 'Simples (linhas e brasão)' : 'Simples (uma linha)', proprio: 'Editor completo', nenhum: 'Nenhum' } : {};
    return (
        <fieldset className="space-y-2 min-w-0">
            <legend className="text-sm font-semibold">{rotulo}</legend>
            <Opcoes rotulo={rotulo} valor={modo} onChange={escolher} opcoes={MODOS_FAIXA.map(([v, r]) => [v, rotulos[v] || r,
                v === 'unidade' ? daUnidade : v === 'proprio' ? 'Texto, imagens e tabelas à vontade' : `Sem ${rotulo.toLowerCase()}`])} />
            <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[13rem]">
                    <Label htmlFor={`${uid}-${tipo}-pag`} className="text-xs">Aparece em</Label>
                    <select id={`${uid}-${tipo}-pag`} className={`mt-1 ${campo}`} value={f.paginas || herdada?.paginas || 'todas'} disabled={modo === 'nenhum'} onChange={(e) => onFaixa({ ...f, paginas: e.target.value })}>
                        {PAGINAS_FAIXA.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                    </select>
                </div>
                {modo === 'proprio' && <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={recomecar}><RotateCcw className="w-4 h-4" /> {modoTimbrado ? 'Partir das linhas simples' : 'Recomeçar do timbrado'}</Button>}
            </div>
            {modo === 'proprio' && EditorFaixa && (
                <>
                    <div className="h-[340px]">
                        <EditorFaixa key={versao} faixa={{ largura: larguraUtil }} config={config} rotulo={`Texto do ${rotulo.toLowerCase()}`}
                            conteudo={{ type: 'doc', content: f.conteudo?.length ? f.conteudo : [{ type: 'paragraph' }] }}
                            campos={[...CAMPOS_PAGINA, ...(campos || [])]} onChange={(j) => onFaixa({ ...ultima.current, modo: 'proprio', conteudo: j.content || [] })} />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        Em <span className="font-semibold">Campos</span> ({'{ }'}), "Número da página" e "Total de páginas" viram {'{{pagina}}'} e {'{{paginas}}'}, que saem com o número de cada folha. Para logotipo à esquerda e texto à direita, use uma tabela sem bordas.
                    </p>
                </>
            )}
        </fieldset>
    );
}

/**
 * `herdado`: layout do papel timbrado por baixo deste documento (mostra o que
 * vale e guarda só o que o documento muda). `modoTimbrado`: a janela edita o
 * próprio papel timbrado do órgão ou da unidade.
 */
export default function ConfigurarPagina({
    aberto, aba = 'pagina', onAba, layout, onMudar, onFechar, fontes, cssFonte, editor, config, campos, EditorFaixa, larguraUtil = 16, herdado = null, modoTimbrado = false,
}) {
    const uid = useId().replace(/[^a-z0-9]/gi, '');
    const [sel, setSel] = useState('normal');
    const [novoNome, setNovoNome] = useState('');
    const l = layout || {};
    // O editor do cabeçalho/rodapé pode chamar com o fechamento antigo: parte sempre do layout atual.
    const atual = useRef(l);
    atual.current = l;
    const mudar = (parcial) => onMudar(limparLayout({ ...atual.current, ...parcial }, herdado));
    const vale = comTimbrado(l, herdado); // o que vale: o do documento por cima do timbrado
    const m = margensDe(vale);
    const np = vale.numero_pagina || {};
    const doDoc = l.proprios || [];
    const proprios = vale.proprios || [];
    const proprio = sel.startsWith('p:') ? proprios.find((p) => p.id === sel.slice(2)) : null;
    const estiloSel = proprio || estiloEfetivo(vale, sel);
    const setEstilo = (e) => {
        if (proprio) {
            const novo = { ...e, id: proprio.id, nome: proprio.nome };
            return mudar({ proprios: doDoc.some((p) => p.id === proprio.id) ? doDoc.map((p) => (p.id === proprio.id ? novo : p)) : [...doDoc, novo] });
        }
        // Guarda só o que difere do herdado (padrão do SIGO ou papel timbrado).
        const padrao = estiloEfetivo(herdado || {}, sel);
        const dif = Object.fromEntries(Object.entries(e).filter(([k, v]) => v !== undefined && v !== padrao[k]));
        for (const k of Object.keys(padrao)) if (e[k] === undefined) dif[k] = undefined;
        return mudar({ estilos: { ...(l.estilos || {}), [sel]: dif } });
    };
    const criar = () => {
        const nome = novoNome.trim().slice(0, 40);
        if (!nome) return;
        const id = idDeEstilo(nome, proprios.map((p) => p.id));
        mudar({ proprios: [...doDoc, { id, nome, ...formatoDoParagrafo(editor) }] });
        setSel(`p:${id}`);
        setNovoNome('');
    };
    const nomeSel = proprio ? proprio.nome : (CHAVES_ESTILO.find(([k]) => k === sel) || [])[1];
    const cssPrevia = cssDoEstilo(proprio ? { ...estiloEfetivo(vale, 'normal'), ...proprio } : estiloSel, cssFonte);

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className={`${aba === 'faixas' ? 'max-w-5xl' : 'max-w-3xl'} w-[96vw] max-h-[92dvh] overflow-y-auto grid-cols-[minmax(0,1fr)] p-4 sm:p-6`}>
                <DialogTitle>{modoTimbrado ? 'Página, cabeçalho e estilos do papel timbrado' : 'Página e estilos do documento'}</DialogTitle>
                <DialogDescription>
                    {modoTimbrado
                        ? 'Vale para todos os documentos que usam este papel timbrado, na tela, no PDF dos autos e no Word. Cada modelo ou documento pode mudar por cima. Salve a tela para valer.'
                        : `Vale para este documento: na tela, no PDF que entra nos autos e no Word (.docx). As mudanças aparecem na hora; Ctrl+Z desfaz.${herdado ? ' O que não mudar aqui segue o papel timbrado.' : ''}`}
                </DialogDescription>
                <Tabs value={aba} onValueChange={onAba} className="mt-2">
                    <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto">
                        <TabsTrigger value="pagina" className="text-xs sm:text-sm">Papel e margens</TabsTrigger>
                        <TabsTrigger value="faixas" className="text-xs sm:text-sm">Cabeçalho e rodapé</TabsTrigger>
                        <TabsTrigger value="estilos" className="text-xs sm:text-sm">Estilos</TabsTrigger>
                        <TabsTrigger value="numeracao" className="text-xs sm:text-sm">Numeração</TabsTrigger>
                    </TabsList>

                    <TabsContent value="pagina" className="grid sm:grid-cols-[1fr_200px] gap-4">
                        <div className="space-y-4 min-w-0">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor={`${uid}-papel`}>Tamanho do papel</Label>
                                    <select id={`${uid}-papel`} className={`mt-1 ${campo}`} value={vale.papel || 'A4'} onChange={(e) => mudar({ papel: e.target.value })}>
                                        {Object.entries(PAPEIS).map(([k, p]) => <option key={k} value={k}>{p.nome}</option>)}
                                    </select>
                                </div>
                                <fieldset>
                                    <legend className="text-sm font-medium">Orientação</legend>
                                    <div className="mt-1 grid grid-cols-2 gap-1" role="radiogroup" aria-label="Orientação">
                                        {[['retrato', 'Retrato'], ['paisagem', 'Paisagem']].map(([v, r]) => (
                                            <button key={v} type="button" role="radio" aria-checked={(vale.orientacao || 'retrato') === v} onClick={() => mudar({ orientacao: v })}
                                                className={`h-9 rounded-md border text-sm flex items-center justify-center gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${(vale.orientacao || 'retrato') === v ? 'bg-indigo-100 border-indigo-400 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100' : 'border-input hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                                <span aria-hidden className={`inline-block border border-current ${v === 'retrato' ? 'w-2.5 h-3.5' : 'w-3.5 h-2.5'}`} />{r}
                                            </button>
                                        ))}
                                    </div>
                                </fieldset>
                            </div>
                            <fieldset>
                                <legend className="text-sm font-medium">Margens</legend>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                    {MARGENS_PRONTAS.map(([nome, mm]) => {
                                        const ativo = Object.keys(MARGENS_PADRAO).every((k) => m[k] === mm[k]);
                                        return <Button key={nome} type="button" size="sm" variant={ativo ? 'default' : 'outline'} aria-pressed={ativo} onClick={() => mudar({ margens: mm })}>{nome}</Button>;
                                    })}
                                </div>
                                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[['sup', 'Superior'], ['inf', 'Inferior'], ['esq', 'Esquerda'], ['dir', 'Direita']].map(([k, r]) => (
                                        <Medida key={k} id={`${uid}-m-${k}`} rotulo={r} min={0.5} max={8} valor={m[k]}
                                            onChange={(v) => v !== undefined && mudar({ margens: { ...m, [k]: v } })} />
                                    ))}
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">Com papel timbrado, o texto começa abaixo do cabeçalho; a margem superior só vale se for maior que ele.</p>
                            </fieldset>
                        </div>
                        <div><p className="text-sm font-medium mb-1">Prévia</p><MiniFolha layout={vale} /></div>
                    </TabsContent>

                    <TabsContent value="faixas" className="space-y-6">
                        <EditarFaixa tipo="cabecalho" rotulo="Cabeçalho" faixa={l.cabecalho} herdada={herdado?.cabecalho} onFaixa={(f) => mudar({ cabecalho: f })} modoTimbrado={modoTimbrado}
                            config={config} campos={campos} EditorFaixa={EditorFaixa} larguraUtil={larguraUtil} uid={uid} />
                        <EditarFaixa tipo="rodape" rotulo="Rodapé" faixa={l.rodape} herdada={herdado?.rodape} onFaixa={(f) => mudar({ rodape: f })} modoTimbrado={modoTimbrado}
                            config={config} campos={campos} EditorFaixa={EditorFaixa} larguraUtil={larguraUtil} uid={uid} />
                        <fieldset className="space-y-2">
                            <legend className="text-sm font-semibold">Número de página</legend>
                            <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_6rem] gap-2">
                                <div>
                                    <Label htmlFor={`${uid}-np-pos`} className="text-xs">Posição</Label>
                                    <select id={`${uid}-np-pos`} className={`mt-1 ${campo}`} value={np.posicao || 'rodape-direita'} onChange={(e) => mudar({ numero_pagina: { ...np, posicao: e.target.value } })}>
                                        {POSICOES_NUMERO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor={`${uid}-np-fmt`} className="text-xs">Formato</Label>
                                    <select id={`${uid}-np-fmt`} className={`mt-1 ${campo}`} value={np.formato || 'pagina-de'} disabled={np.posicao === 'nenhum'} onChange={(e) => mudar({ numero_pagina: { ...np, formato: e.target.value } })}>
                                        {FORMATOS_NUMERO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                                    </select>
                                </div>
                                <Medida id={`${uid}-np-tam`} rotulo="Tamanho" unidade="pt" min={6} max={16} passo={0.5} valor={np.tamanho || TAMANHO_NUMERO}
                                    onChange={(v) => mudar({ numero_pagina: { ...np, tamanho: v } })} />
                            </div>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={np.primeira !== false} disabled={np.posicao === 'nenhum'} onChange={(e) => mudar({ numero_pagina: { ...np, primeira: e.target.checked } })} />
                                Mostrar o número também na primeira página
                            </label>
                        </fieldset>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Na tela, o cabeçalho e o rodapé aparecem como na primeira página; a prévia em PDF mostra cada folha. No Word, a opção vira "Primeira página diferente".</p>
                    </TabsContent>

                    <TabsContent value="estilos" className="grid sm:grid-cols-[190px_1fr] gap-4">
                        <div className="min-w-0 space-y-2">
                            <div role="listbox" aria-label="Estilos do documento" className="rounded-md border border-input divide-y divide-slate-200 dark:divide-slate-700 overflow-hidden">
                                {[...CHAVES_ESTILO, ...proprios.map((p) => [`p:${p.id}`, p.nome])].map(([k, nome]) => (
                                    <button key={k} type="button" role="option" aria-selected={sel === k} onClick={() => setSel(k)}
                                        className={`w-full text-left px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 ${sel === k ? 'bg-indigo-50 text-indigo-900 font-medium dark:bg-indigo-950 dark:text-indigo-100' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                        {nome}{k.startsWith('p:') && <span className="block text-[11px] text-slate-500">estilo próprio</span>}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-1">
                                <Input aria-label="Nome do novo estilo" placeholder="Novo estilo (ex.: Ementa)" value={novoNome} maxLength={40}
                                    onChange={(e) => setNovoNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && criar()} className="h-9" />
                                <Button type="button" size="sm" variant="outline" className="h-9 px-2" disabled={!novoNome.trim() || proprios.length >= 30} onClick={criar} aria-label="Criar estilo"><Plus className="w-4 h-4" /></Button>
                            </div>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400">{editor ? 'O estilo novo nasce com a formatação do parágrafo onde está o cursor.' : 'O estilo novo aparece na lista de estilos de todos os documentos.'}</p>
                        </div>
                        <div className="min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-sm flex-1">{nomeSel}</p>
                                {editor && (
                                    <Button type="button" size="sm" variant="outline" className="gap-1" title="Copia fonte, tamanho, efeitos, alinhamento, recuos e espaços do parágrafo onde está o cursor"
                                        onClick={() => setEstilo({ ...(proprio ? {} : ESTILOS_PADRAO[sel]), ...formatoDoParagrafo(editor) })}>
                                        <Wand2 className="w-4 h-4" /> Usar o parágrafo atual
                                    </Button>
                                )}
                                {proprio && !doDoc.some((p) => p.id === proprio.id)
                                    ? <span className="text-xs text-slate-600 dark:text-slate-400">Do papel timbrado</span>
                                    : proprio
                                    ? <Button type="button" size="sm" variant="ghost" className="gap-1 text-red-700" onClick={() => { mudar({ proprios: doDoc.filter((p) => p.id !== proprio.id) }); setSel('normal'); }}><Trash2 className="w-4 h-4" /> Excluir</Button>
                                    : <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => mudar({ estilos: { ...(l.estilos || {}), [sel]: {} } })}><RotateCcw className="w-4 h-4" /> Padrão</Button>}
                            </div>
                            {proprio && doDoc.some((p) => p.id === proprio.id) && (
                                <div>
                                    <Label htmlFor={`${uid}-nome`} className="text-xs">Nome do estilo</Label>
                                    <Input id={`${uid}-nome`} className="h-9 mt-1" maxLength={40} value={proprio.nome}
                                        onChange={(e) => e.target.value.trim() && mudar({ proprios: doDoc.map((p) => (p.id === proprio.id ? { ...p, nome: e.target.value } : p)) })} />
                                </div>
                            )}
                            <FormEstilo key={sel} estilo={estiloSel} setEstilo={setEstilo} fontes={fontes} prefixo={`${uid}-${sel.replace(/[^a-z0-9]/g, '')}`} />
                            <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-600 bg-white text-slate-900 p-3" aria-label="Prévia do estilo">
                                <style>{`#prev-${uid} p { margin: 0; ${cssPrevia} }`}</style>
                                <div id={`prev-${uid}`}><p>{sel.startsWith('h') ? 'Fundamentação jurídica' : 'Trata-se de procedimento instaurado para apurar os fatos narrados na representação, com a observância do contraditório.'}</p></div>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">O que for marcado direto num parágrafo (pela barra do editor) vale mais que o estilo, como no Word.</p>
                        </div>
                    </TabsContent>

                    <TabsContent value="numeracao" className="space-y-5">
                        <fieldset>
                            <legend className="text-sm font-medium">Numerar os títulos sozinho</legend>
                            <div className="mt-2 grid sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Numeração dos títulos">
                                {FORMATOS_TITULO.map(([v, r]) => (
                                    <button key={v || 'sem'} type="button" role="radio" aria-checked={(vale.numeracao_titulos || '') === v} onClick={() => mudar({ numeracao_titulos: v })}
                                        className={`rounded-md border p-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${(vale.numeracao_titulos || '') === v ? 'bg-indigo-50 border-indigo-400 dark:bg-indigo-950' : 'border-input hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                        <span className="font-medium block">{r}</span>
                                        {v && <span className="block text-xs text-slate-600 dark:text-slate-400 mt-1">{v === 'romano' ? 'Título 1 em romanos; Título 2 a 4 em 1., 1.1., 1.1.1.' : 'Título 1 em 1., Título 2 em 1.1., e assim por diante.'}</span>}
                                    </button>
                                ))}
                            </div>
                        </fieldset>
                        <fieldset>
                            <legend className="text-sm font-medium">Parágrafos numerados</legend>
                            <p className="text-xs text-slate-600 dark:text-slate-400">Marque cada parágrafo com o botão <span className="font-semibold">Parágrafo numerado</span> (#) da barra; a numeração segue sozinha pelo documento, como em pareceres e decisões.</p>
                            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2" role="radiogroup" aria-label="Formato do número do parágrafo">
                                {FORMATOS_PARAGRAFO.map(([v, r]) => (
                                    <button key={v} type="button" role="radio" aria-checked={(vale.numeracao_paragrafos || '1.') === v} onClick={() => mudar({ numeracao_paragrafos: v })}
                                        className={`h-10 rounded-md border text-sm font-mono focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${(vale.numeracao_paragrafos || '1.') === v ? 'bg-indigo-50 border-indigo-400 dark:bg-indigo-950' : 'border-input hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{r}</button>
                                ))}
                            </div>
                        </fieldset>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Listas com marcadores (•, ◦, ▪, –) e numeradas (1, a, A, i, I) se ajustam na barra que aparece quando o cursor está numa lista.</p>
                    </TabsContent>
                </Tabs>
                <div className="flex justify-end mt-4"><Button onClick={onFechar}>Pronto</Button></div>
            </DialogContent>
        </Dialog>
    );
}
