import React, { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    DESTINO_INFO, DESTINOS_DOCUMENTO, DESTINOS_FASE, FORMAS, OUTROS_ATOS, PEDIDOS, ROTULO_DESTINO, comOutros, destinoDaAcao, destinoDaMudanca, destinoDoAto,
    grupoDe, niveisDaFase, opcoesDoAto, partesVeem, registroComOutros,
    pedidoDaAcao, regraComPedido, resumoDaAcao, saidasDaFase, tituloCertidao,
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

/** Como o cumprimento aparece em cada destino (o texto que o servidor grava). */
function amostraDoCumprimento(d, acao, fase) {
    if (d === 'autos') return `Certifico que foi cumprida a providência "${acao}", da fase ${fase || '…'}.`;
    if (d === 'nenhum') return null;
    if (d === 'consolidar') return `Item da certidão conjunta: "${acao}", da fase ${fase || '…'}.`;
    return `Feita a ação "${acao}" da fase ${fase || '…'}.`;
}

/** Onde fica o cumprimento da ação: um cartão por destino, com a consequência e a amostra. */
function EscolhaDestino({ id, valor, opcoes, onChange, acao, fase, documento }) {
    return (
        <fieldset>
            <legend className="text-sm font-medium">{documento ? 'Onde fica o documento' : 'Onde fica o cumprimento'}</legend>
            <RadioGroup value={valor} onValueChange={onChange} className="mt-1 grid sm:grid-cols-2 gap-2">
                {opcoes.map(([d, rotulo]) => {
                    const amostra = !documento && amostraDoCumprimento(d, acao, fase);
                    return (
                        <label key={d} htmlFor={`${id}-${d}`}
                            className={`flex cursor-pointer gap-2 rounded-md border p-2 text-sm ${valor === d ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
                            <RadioGroupItem id={`${id}-${d}`} value={d} className="mt-0.5 shrink-0" />
                            <span className="min-w-0">
                                <span className="block font-medium">{documento ? rotulo : DESTINO_INFO[d].rotulo}</span>
                                {!documento && <span className="block text-xs text-slate-600 dark:text-slate-400">{DESTINO_INFO[d].frase}</span>}
                                {amostra && <span className="mt-1 block rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-1 text-xs italic text-slate-700 dark:text-slate-300">{amostra}</span>}
                            </span>
                        </label>
                    );
                })}
            </RadioGroup>
        </fieldset>
    );
}

/** Configuração de uma ação: o que pede, onde fica, quem vê, se é obrigatória. */
function ConfigAcao({ id, acao, r, modelos, onChange, fase }) {
    const pede = pedidoDaAcao(r);
    const dest = destinoDaAcao(r);
    const set = (patch) => {
        const n = { ...(r || {}), ...patch };
        Object.keys(n).forEach((k) => (n[k] === undefined || n[k] === false) && delete n[k]);
        onChange(Object.keys(n).length ? n : null);
    };
    const setDestino = (v) => (pede === 'documento'
        ? onChange({ documento: { ...r.documento, destino: v === 'autos' ? undefined : v } })
        // Sem evento não aparece para ninguém: some também a marca das partes.
        : set({ destino: v === 'evento' ? undefined : v, autos: undefined, partes: (v !== 'nenhum' && partesVeem(r)) || undefined }));
    // Por que a parte não pode ver (a opção fica visível, desligada, com o motivo).
    const semPartes = dest === 'nenhum' ? 'Sem evento nunca aparece no portal.'
        : pede === 'confirmar' && !['autos', 'consolidar'].includes(dest) ? 'Só confirmar, fora dos autos, não tem o que mostrar: escolha "Nos autos" ou peça um dado.' : null;
    return (
        <div className="space-y-3 rounded-md bg-slate-50 dark:bg-slate-800/60 p-2">
            <div className="sm:max-w-sm">
                <NativeSelect id={`${id}-pede`} label="O que pede" value={pede} onChange={(v) => onChange(regraComPedido(r, v, acao))} options={PEDIDOS} />
            </div>
            <EscolhaDestino id={`${id}-dest`} valor={dest} onChange={setDestino} acao={acao} fase={fase}
                documento={pede === 'documento'} opcoes={pede === 'documento' ? DESTINOS_DOCUMENTO : Object.entries(DESTINO_INFO).map(([d, x]) => [d, x.rotulo])} />
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
                {pede !== 'documento' && (
                    <div className="text-sm">
                        <label className={`flex items-center gap-2 ${semPartes ? 'text-slate-500 dark:text-slate-500' : ''}`}>
                            <Checkbox checked={partesVeem(r)} disabled={!!semPartes} onCheckedChange={(c) => set({ partes: c === true ? true : undefined, ...(r?.autos ? { autos: undefined, destino: 'autos' } : {}) })} />
                            As partes veem no portal
                        </label>
                        {semPartes && <p className="text-xs text-slate-600 dark:text-slate-400 pl-6">{semPartes}</p>}
                    </div>
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
                        {aberto && a.trim() && <div className="sm:pl-6"><ConfigAcao id={`${id}-a${i}`} acao={a.trim()} fase={f.nome} r={r} modelos={modelos} onChange={(n) => { const rs = acoes.map((_, j) => regras[j] || null); rs[i] = n; gravar(acoes, rs); }} /></div>}
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

/**
 * Certidão conjunta: as ações "Na certidão conjunta" desta fase (e das fases
 * que dividem a certidão com ela) saem numa só certidão, com folha.
 */
function CertidaoConjunta({ f, fases, mudar, id }) {
    const comNome = fases.filter((x) => x.nome?.trim());
    const grupo = grupoDe(fases, f);
    const membros = comNome.filter((x) => x.id !== f.id && grupoDe(fases, x) === grupo);
    const usa = [f, ...membros].some((x) => (x.acoes_regras || []).some((r) => destinoDaAcao(r) === 'consolidar'));
    const set = (patch) => {
        const c = { ...(f.certidao || {}), ...patch };
        Object.keys(c).forEach((k) => (c[k] === undefined || c[k] === '' || c[k] === false) && delete c[k]);
        mudar({ certidao: Object.keys(c).length ? c : undefined });
    };
    // Escolher outra fase põe esta no grupo dela; se a outra já aponta para esta, esta segue sendo a raiz.
    const reunir = (v) => {
        const alvo = v ? grupoDe(fases, fases.find((x) => x.id === v)) : '';
        // Ao entrar noutro grupo, vale o título dele: o desta fase sai.
        set({ grupo: alvo && alvo !== f.id ? alvo : undefined, ...(alvo && alvo !== f.id ? { titulo: undefined } : {}) });
    };
    const raiz = fases.find((x) => x.id === grupo);
    const reunidaCom = f.certidao?.grupo && grupo !== f.id ? grupo : '';
    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Certidão conjunta</legend>
            <p className="text-xs text-slate-600 dark:text-slate-400">
                {usa
                    ? 'As ações marcadas "Na certidão conjunta" não geram certidão cada uma: viram itens de uma só, com folha, quando o processo sai destas fases, é arquivado ou alguém pede "Emitir certidão agora".'
                    : 'Para usar, marque em alguma ação "Na certidão conjunta". Os atos ficam reunidos numa só certidão, com folha.'}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
                {grupo === f.id ? (
                    <div>
                        <Label htmlFor={`${id}-ctit`}>Título da certidão</Label>
                        <Input id={`${id}-ctit`} className="mt-1" value={f.certidao?.titulo || ''} maxLength={120} placeholder={tituloCertidao(fases, grupo)}
                            onChange={(e) => set({ titulo: e.target.value || undefined })} />
                    </div>
                ) : (
                    // O título é do grupo: muda-se na fase que reúne as outras.
                    <p className="text-sm self-end">Título: <b>{tituloCertidao(fases, grupo)}</b>
                        <span className="block text-xs text-slate-600 dark:text-slate-400">Para mudar, abra a fase {raiz?.nome || 'que reúne o grupo'}.</span></p>
                )}
                <NativeSelect id={`${id}-cgr`} label="Dividir a certidão com" value={reunidaCom} onChange={reunir}
                    options={[['', reunidaCom ? 'Só esta fase (sai do grupo)' : membros.length ? 'Esta fase reúne as outras' : 'Só esta fase'], ...comNome.filter((x) => x.id !== f.id).map((x) => [x.id, x.nome])]} />
            </div>
            {membros.length > 0 && <p className="text-xs text-slate-700 dark:text-slate-300">Dividem esta certidão: <b>{[f, ...membros].map((x) => x.nome || 'esta fase').join(', ')}</b>.</p>}
            {membros.length > 0 && (
                <label className="flex items-start gap-2 text-sm">
                    <Checkbox className="mt-0.5" checked={f.certidao?.incluir_mudancas === true} onCheckedChange={(c) => set({ incluir_mudancas: c === true ? true : undefined })} />
                    <span>Mudar desta fase para outra do grupo (ou de outra para esta) entra na certidão, em vez de termo próprio
                        <span className="block text-xs text-slate-600 dark:text-slate-400">
                            {membros.some((x) => x.certidao?.incluir_mudancas) && `Já vale para as mudanças com ${membros.filter((x) => x.certidao?.incluir_mudancas).map((x) => x.nome).join(', ')}, ${membros.filter((x) => x.certidao?.incluir_mudancas).length > 1 ? 'que marcaram' : 'que marcou'} esta opção. `}
                            Com dispensa de exigência, a mudança continua indo aos autos sozinha.
                        </span></span>
                </label>
            )}
        </fieldset>
    );
}

/** Onde ficam a entrada/saída da fase e as remessas, e os documentos exigidos na fase. */
/** Prazo, pendência, urgência, dados e atribuição durante a fase: onde cada um fica. */
function OutrosAtos({ f, id, mudar, aplicarATodas }) {
    const atual = Object.fromEntries(OUTROS_ATOS.map(([a]) => [a, destinoDoAto(f, a)]));
    const set = (a, v) => mudar({ registro_atos: registroComOutros(f, { ...atual, [a]: v }), registro: undefined });
    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Outros atos durante a fase</legend>
            <div className="grid sm:grid-cols-2 gap-2">
                {OUTROS_ATOS.map(([a, rotulo]) => (
                    <NativeSelect key={a} id={`${id}-out-${a}`} label={rotulo} value={atual[a]} onChange={(v) => set(a, v)} options={opcoesDoAto(a)} />
                ))}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
                Sempre nos autos: autuação, juntada de documento, petição, comunicação e ciência, mudança de situação (sobrestar, arquivar, reativar), exclusão e restauração.
            </p>
            {aplicarATodas && (
                <Button variant="outline" size="sm" onClick={() => { aplicarATodas(atual); toast.success('Aplicado a todas as fases do rito'); }}>Aplicar a todas as fases</Button>
            )}
        </fieldset>
    );
}

export function RegistroEDocumentos({ f, fases = [], modelos = [], mudar, idBase, aplicarATodas }) {
    const id = idBase || f.id;
    const n = niveisDaFase(f);
    // Como ficam, de fato, as mudanças com as fases vizinhas (vale o mais reservado; "sem evento" só se as duas pedem).
    const comNome = (x) => x.nome?.trim();
    const vizinhas = [
        ...fases.filter((x) => x.id !== f.id && comNome(x) && saidasDaFase(fases, x).some((s) => s.id === f.id))
            .map((x) => ({ k: `de-${x.id}`, texto: `Chegando de ${x.nome}`, d: destinoDaMudanca(fases, x, f) })),
        ...saidasDaFase(fases, f).filter((x) => x.id !== f.id && comNome(x))
            .map((x) => ({ k: `para-${x.id}`, texto: `Seguindo para ${x.nome}`, d: destinoDaMudanca(fases, f, x) })),
    ];
    const setNivel = (k, v) => {
        const novo = { ...n, [k]: v };
        const ra = { ...(novo.fase !== 'autos' ? { fase: novo.fase } : {}), ...(novo.remessas !== 'autos' ? { remessas: novo.remessas } : {}) };
        // Os outros atos da fase continuam como estavam.
        mudar({ registro_atos: comOutros(Object.keys(ra).length ? ra : undefined, f.registro_atos?.outros), registro: undefined });
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
                    Só no sistema: aparece só na aba Eventos, para controle, e não sai em impressão. Sem evento: fica só um registro oculto, que não aparece nem como último andamento.
                    Remessa entre órgãos e dispensa de exigência vão sempre aos autos.
                </p>
                {vizinhas.length > 0 && (
                    <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5" aria-label="Como ficam as mudanças de fase">
                        {vizinhas.map((v) => <li key={v.k}>{v.texto}: <b>{ROTULO_DESTINO[v.d]}</b></li>)}
                        <li className="text-slate-600 dark:text-slate-400">Entre órgãos e com dispensa de exigência: <b>nos autos</b></li>
                    </ul>
                )}
            </fieldset>
            <OutrosAtos f={f} id={id} mudar={mudar} aplicarATodas={fases.length > 1 ? aplicarATodas : null} />
            <CertidaoConjunta f={f} fases={fases} mudar={mudar} id={id} />
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
