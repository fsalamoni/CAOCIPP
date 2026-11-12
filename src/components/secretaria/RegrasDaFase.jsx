import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DESTINOS, DESTINOS_DOCUMENTO, DESTINOS_FASE, FORMAS, PEDIDOS, destinoDaAcao, niveisDaFase, partesVeem, pedidoDaAcao, regraComPedido, resumoDaAcao,
} from '@/lib/exigencias';
import { NativeSelect } from './comum';

// Editor do que cada fase do rito pede e de onde cada ato fica registrado.
// Usado pela tela de rito (criar e alterar). Fundamento e exemplos:
// docs/LOGICA_PROCESSUAL.md, seções 5 e 6.

export const MAX_ACOES = 20;
export const MAX_DOCUMENTOS_FASE = 5;

/** Campos de um documento exigido: forma, tipo e modelo (a descrição fica com quem chama). */
function CamposExigencia({ id, e, modelos, onChange }) {
    return (
        <div className="grid sm:grid-cols-3 gap-2">
            <NativeSelect id={`${id}-forma`} label="Como" value={e.forma || 'qualquer'} onChange={(v) => onChange({ ...e, forma: v })} options={FORMAS} />
            <div>
                <Label htmlFor={`${id}-tipo`}>Tipo de documento</Label>
                <Input id={`${id}-tipo`} className="mt-1" value={e.tipo || ''} maxLength={60} onChange={(ev) => onChange({ ...e, tipo: ev.target.value })} placeholder="Ex.: Parecer (opcional)" />
            </div>
            <NativeSelect id={`${id}-modelo`} label="Modelo indicado" value={e.modelo_id || ''} onChange={(v) => onChange({ ...e, modelo_id: v || undefined })}
                options={[['', 'Nenhum'], ...modelos.map((m) => [m.id, m.nome])]} />
        </div>
    );
}

/** Configuração de uma ação: o que pede, onde fica, quem vê, se é obrigatória. */
function ConfigAcao({ id, acao, r, modelos, onChange }) {
    const pede = pedidoDaAcao(r);
    const dest = destinoDaAcao(r);
    const set = (patch) => {
        const n = { ...(r || {}), ...patch };
        Object.keys(n).forEach((k) => (n[k] === undefined || n[k] === false) && delete n[k]);
        onChange(Object.keys(n).length ? n : null);
    };
    const setDestino = (v) => (pede === 'documento'
        ? onChange({ documento: { ...r.documento, destino: v === 'autos' ? undefined : v } })
        : set({ destino: v === 'evento' ? undefined : v, autos: undefined, partes: partesVeem(r) || undefined }));
    return (
        <div className="space-y-2 rounded-md bg-slate-50 dark:bg-slate-800/60 p-2">
            <div className="grid sm:grid-cols-2 gap-2">
                <NativeSelect id={`${id}-pede`} label="O que pede" value={pede} onChange={(v) => onChange(regraComPedido(r, v, acao))} options={PEDIDOS} />
                <NativeSelect id={`${id}-dest`} label={pede === 'documento' ? 'Onde fica o documento' : 'Onde fica o registro'} value={dest} onChange={setDestino}
                    options={pede === 'documento' ? DESTINOS_DOCUMENTO : DESTINOS} />
            </div>
            {pede !== 'confirmar' && pede !== 'documento' && (
                <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                        <Label htmlFor={`${id}-rot`}>Nome do dado</Label>
                        <Input id={`${id}-rot`} className="mt-1" value={r?.rotulo || ''} maxLength={80} placeholder={acao || 'Ex.: Número no SIM'} onChange={(e) => set({ rotulo: e.target.value || undefined })} />
                    </div>
                    {pede === 'lista' ? (
                        <div>
                            <Label htmlFor={`${id}-op`}>Opções (separe por ponto e vírgula)</Label>
                            <Input id={`${id}-op`} className="mt-1" value={(r?.opcoes || []).join(';')} placeholder="Ex.: PGEA; Arquivamento; Outro"
                                onChange={(e) => set({ opcoes: e.target.value.split(';') })}
                                onBlur={() => set({ opcoes: (r?.opcoes || []).map((s) => s.trim()).filter(Boolean) })} />
                        </div>
                    ) : (
                        <div>
                            <Label htmlFor={`${id}-aj`}>Orientação ao preencher</Label>
                            <Input id={`${id}-aj`} className="mt-1" value={r?.ajuda || ''} maxLength={200} placeholder="Opcional" onChange={(e) => set({ ajuda: e.target.value || undefined })} />
                        </div>
                    )}
                </div>
            )}
            {pede === 'documento' && (
                <CamposExigencia id={`${id}-doc`} e={r.documento} modelos={modelos} onChange={(d) => onChange({ documento: { ...d, descricao: acao } })} />
            )}
            <div className="flex flex-wrap gap-x-5 gap-y-1">
                {/* Ação de só confirmar fora dos autos não tem o que mostrar às partes. */}
                {pede !== 'documento' && (pede !== 'confirmar' || dest === 'autos') && (
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={partesVeem(r)} onCheckedChange={(c) => set({ partes: c === true ? true : undefined, ...(r?.autos ? { autos: undefined, destino: 'autos' } : {}) })} />
                        As partes veem no portal
                    </label>
                )}
                <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={pede === 'documento' || r?.obrigatoria === true} disabled={pede === 'documento'} onCheckedChange={(c) => set({ obrigatoria: c === true ? true : undefined })} />
                    Obrigatória para a fase seguir
                </label>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
                {pede === 'documento'
                    ? 'Documento exigido: sem ele, a fase só segue com motivo de dispensa. Na juntada, quem junta decide se as partes veem.'
                    : r?.obrigatoria ? 'Sem ela, a fase só segue com motivo de dispensa, que fica registrado.' : 'Opcional: a fase pode seguir sem ela.'}
            </p>
        </div>
    );
}

/**
 * Ações da fase, uma por linha, cada uma com a sua regra. Colar várias linhas
 * numa ação cria uma ação por linha.
 */
export function AcoesDaFase({ f, modelos = [], mudar, idBase }) {
    const [aberta, setAberta] = useState(null);
    const acoes = f.acoes || [];
    const regras = f.acoes_regras || [];
    const gravar = (as, rs) => {
        const alinhadas = as.map((_, i) => rs[i] || null);
        mudar({ acoes: as, acoes_regras: alinhadas.some(Boolean) ? alinhadas : undefined });
    };
    const setTexto = (i, v) => {
        const linhas = v.split(/\r?\n/);
        if (linhas.length > 1) {
            // Só cabem as linhas que não passam do limite: nenhuma ação existente (e sua regra) se perde.
            const todas = linhas.map((s) => s.trim()).filter(Boolean);
            const novas = todas.slice(0, MAX_ACOES - acoes.length + 1);
            if (novas.length < todas.length) toast.warning(`Cabem ${MAX_ACOES} ações por fase: ${todas.length - novas.length} linha(s) ficaram de fora.`);
            const as = [...acoes.slice(0, i), ...novas, ...acoes.slice(i + 1)];
            const rs = [...regras.slice(0, i), regras[i] || null, ...novas.slice(1).map(() => null), ...regras.slice(i + 1)];
            return gravar(as, rs);
        }
        const rs = [...regras];
        if (rs[i]?.documento) rs[i] = { documento: { ...rs[i].documento, descricao: v } };
        return gravar(acoes.map((a, j) => (j === i ? v : a)), rs);
    };
    const remover = (i) => gravar(acoes.filter((_, j) => j !== i), regras.filter((_, j) => j !== i));
    const mover = (i, d) => {
        const as = [...acoes]; const rs = acoes.map((_, j) => regras[j] || null);
        [as[i], as[i + d]] = [as[i + d], as[i]]; [rs[i], rs[i + d]] = [rs[i + d], rs[i]];
        gravar(as, rs);
        if (aberta === i) setAberta(i + d);
    };
    const id = idBase || f.id;
    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Ações da fase</legend>
            <p className="text-xs text-slate-600 dark:text-slate-400 -mt-1">
                Cada ação aparece na tela do processo. Defina o que ela pede (só confirmar, um dado ou um documento), onde o cumprimento fica registrado e quem vê.
            </p>
            {acoes.map((a, i) => {
                const r = regras[i] || null;
                const aberto = aberta === i;
                return (
                    <div key={i} className="rounded-md border border-slate-200 dark:border-slate-700 p-2 space-y-2">
                        <div className="flex items-center gap-1">
                            <span className="text-xs font-mono w-5 text-slate-500" aria-hidden>{i + 1}</span>
                            <Input className="flex-1 min-w-0" value={a} maxLength={200} placeholder="Ex.: Registrar a consulta no SIM" aria-label={`Ação ${i + 1}`}
                                onChange={(e) => setTexto(i, e.target.value)}
                                onPaste={(e) => {
                                    const txt = e.clipboardData.getData('text');
                                    if (/\n/.test(txt.trim())) {
                                        e.preventDefault();
                                        const { selectionStart: s, selectionEnd: fim } = e.target;
                                        setTexto(i, a.slice(0, s ?? a.length) + txt + a.slice(fim ?? a.length));
                                    }
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter' && a.trim() && i === acoes.length - 1 && acoes.length < MAX_ACOES) { e.preventDefault(); gravar([...acoes, ''], regras); } }} />
                            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Subir a ação ${i + 1}`}><ArrowUp className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" disabled={i === acoes.length - 1} onClick={() => mover(i, 1)} aria-label={`Descer a ação ${i + 1}`}><ArrowDown className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => { remover(i); setAberta(null); }} aria-label={`Remover a ação ${i + 1}`}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        <button type="button" className="flex items-start gap-1 text-left text-xs text-indigo-700 dark:text-indigo-300 pl-6" aria-expanded={aberto} onClick={() => setAberta(aberto ? null : i)}>
                            {aberto ? <ChevronDown className="w-3.5 h-3.5 mt-px shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 mt-px shrink-0" />}
                            <span>Pede {resumoDaAcao(r)}</span>
                        </button>
                        {aberto && a.trim() && <div className="sm:pl-6"><ConfigAcao id={`${id}-a${i}`} acao={a.trim()} r={r} modelos={modelos} onChange={(n) => { const rs = acoes.map((_, j) => regras[j] || null); rs[i] = n; gravar(acoes, rs); }} /></div>}
                        {aberto && !a.trim() && <p className="text-xs text-slate-600 pl-6">Escreva a ação para configurá-la.</p>}
                    </div>
                );
            })}
            {acoes.length < MAX_ACOES && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => { gravar([...acoes, ''], regras); setAberta(null); }}><Plus className="w-4 h-4" /> Adicionar ação</Button>
            )}
        </fieldset>
    );
}

/** Onde ficam a entrada/saída da fase e as remessas, e os documentos exigidos na fase. */
export function RegistroEDocumentos({ f, modelos = [], mudar, idBase }) {
    const id = idBase || f.id;
    const n = niveisDaFase(f);
    const setNivel = (k, v) => {
        const novo = { ...n, [k]: v };
        const ra = { ...(novo.fase !== 'autos' ? { fase: novo.fase } : {}), ...(novo.remessas !== 'autos' ? { remessas: novo.remessas } : {}) };
        mudar({ registro_atos: Object.keys(ra).length ? ra : undefined, registro: undefined });
    };
    const docs = f.documentos || [];
    const setDocs = (ds) => mudar({ documentos: ds.length ? ds : undefined });
    return (
        <div className="space-y-3">
            <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Onde ficam os atos de tramitação da fase</legend>
                <div className="grid sm:grid-cols-2 gap-2">
                    <NativeSelect id={`${id}-rfase`} label="Entrar e sair da fase" value={n.fase} onChange={(v) => setNivel('fase', v)} options={DESTINOS_FASE} />
                    <NativeSelect id={`${id}-rrem`} label="Remessas entre unidades durante a fase" value={n.remessas} onChange={(v) => setNivel('remessas', v)} options={DESTINOS_FASE} />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    Nos autos: termo com folha, que as partes veem. Evento no extrato: aparece na aba Eventos e ao fim do PDF, sem folha, e as partes não veem.
                    Só no sistema: aparece só na aba Eventos, para controle, e não sai em impressão. Remessa entre órgãos e dispensa de exigência vão sempre aos autos.
                </p>
            </fieldset>
            <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Documentos exigidos na fase</legend>
                <p className="text-xs text-slate-600 dark:text-slate-400">Para sair da fase sem eles, é preciso informar o motivo da dispensa, que fica registrado.</p>
                {docs.map((d, k) => (
                    <div key={k} className="space-y-2 pl-3 border-l-2 border-indigo-200 dark:border-indigo-800">
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <Label htmlFor={`${id}-dex-${k}`}>Documento</Label>
                                <Input id={`${id}-dex-${k}`} className="mt-1" value={d.descricao || ''} maxLength={200} onChange={(e) => setDocs(docs.map((x, j) => (j === k ? { ...x, descricao: e.target.value } : x)))} placeholder="Ex.: Parecer da assessoria" />
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setDocs(docs.filter((_, j) => j !== k))} aria-label={`Remover o documento exigido ${k + 1}`}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        <CamposExigencia id={`${id}-dex-${k}`} e={d} modelos={modelos} onChange={(nv) => setDocs(docs.map((x, j) => (j === k ? nv : x)))} />
                        <NativeSelect id={`${id}-dexd-${k}`} label="Onde fica" value={d.destino || 'autos'} onChange={(v) => setDocs(docs.map((x, j) => (j === k ? { ...x, destino: v === 'autos' ? undefined : v } : x)))} options={DESTINOS_DOCUMENTO} />
                    </div>
                ))}
                {docs.length < MAX_DOCUMENTOS_FASE && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setDocs([...docs, { descricao: '', forma: 'qualquer' }])}><Plus className="w-4 h-4" /> Exigir documento</Button>
                )}
            </fieldset>
        </div>
    );
}
