import React, { useContext, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    DESTINO_INFO, DESTINOS_DOCUMENTO, MAX_CAMPOS_ACAO, DESTINOS_FASE, FORMAS, NIVEIS, OUTROS_ATOS, PEDIDOS, ROTULO_DESTINO, comOutros, destinoDaAcao, destinoDaMudanca, destinoDoAto,
    grupoDe, nivelDaAcao, niveisDaFase, opcoesDoAto, partesVeem, regraComNivel, registroComOutros,
    pedidoDaAcao, regraComPedido, resumoDaAcao, saidasDaFase, tituloCertidao,
    QUEM, acoesDeEscolha, opcoesDaResposta, problemaDaCondicao, remapearCondicoes,
} from '@/lib/exigencias';
import { NativeSelect } from './comum';
import { MODULOS } from '@/lib/camposProcesso';
import { RegistroContexto } from './SeletorRegistro';
import AjudaTermo from './AjudaTermo';
import { EditorCampos } from './CamposProcesso';
import { ItemOrdenavel, ListaOrdenavel } from './Ordenavel';

// Editor do que cada fase do rito pede e de onde cada ato fica registrado.
// Usado pela tela de rito (criar e alterar). Fundamento e exemplos:
// docs/LOGICA_PROCESSUAL.md, seções 5 e 6.

export const MAX_ACOES = 20;
export const MAX_DOCUMENTOS_FASE = 5;
const MAX_OPCOES = 30; // igual ao servidor (MAX_OPCOES_ACAO)
// Botões de ícone: 44px no toque, compactos a partir do tablet.
const ICONE = 'shrink-0 h-11 w-11 sm:h-8 sm:w-8';
const NIVEIS_DOC = [['', 'Obrigatório'], ['recomendado', 'Recomendado: avisa, não impede'], ['opcional', 'Opcional: só lembra']];
const FRASE_NIVEL = {
    '': 'Obrigatória: sem ela, a fase só segue com motivo de dispensa, que fica registrado.',
    recomendado: 'Recomendada: a fase segue sem ela, mas quem conclui a fase é avisado de que ficou por fazer.',
    opcional: 'Opcional: aparece na fase como lembrete e não impede nada.',
};

/** Move o item `de` para a posição `para` (as duas listas juntas). */
const mudarDeLugar = (lista, de, para) => { const l = [...lista]; const [x] = l.splice(de, 1); l.splice(para, 0, x); return l; };

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

/**
 * Condição pela resposta de uma ação de escolha (lista ou sim/não) da fase: qual
 * ação e quais respostas. `limite`: só ações antes dele (ação condicional).
 */
export function CondicaoPorResposta({ id, f, limite = Infinity, valor, onChange, rotulo, vazio }) {
    const escolhas = acoesDeEscolha(f, limite);
    if (!escolhas.length && !valor) {
        return <p className="text-xs text-slate-600 dark:text-slate-400">{rotulo}: {vazio.toLowerCase()}. Para condicionar, crie {limite === Infinity ? 'nesta fase' : 'antes dela'} uma ação que pede escolha (lista ou sim/não).</p>;
    }
    const ops = valor ? opcoesDaResposta(f.acoes_regras?.[valor.acao]) || [] : [];
    const problema = problemaDaCondicao(f, valor, limite);
    const opcoes = [['', vazio], ...escolhas.map(([i, a]) => [String(i), `Conforme a resposta de "${a.trim()}"`])];
    if (valor && !escolhas.some(([i]) => i === valor.acao)) opcoes.push([String(valor.acao), `Ação ${valor.acao + 1} (não serve mais)`]);
    return (
        <div className="space-y-1">
            <NativeSelect id={`${id}-acao`} label={rotulo} value={valor ? String(valor.acao) : ''} options={opcoes}
                onChange={(v) => onChange(v === '' ? undefined : { acao: Number(v), valores: [] })} />
            {valor && ops.length > 0 && (
                <div role="group" aria-label={`Respostas que fazem valer: ${rotulo}`} className="flex flex-wrap gap-x-4 gap-y-1 pl-1">
                    {ops.map(([v, l]) => (
                        <label key={v} className="flex min-h-[2.75rem] sm:min-h-0 items-center gap-2 text-sm">
                            <Checkbox checked={valor.valores.includes(v)}
                                onCheckedChange={(c) => onChange({ ...valor, valores: c === true ? [...new Set([...valor.valores, v])] : valor.valores.filter((x) => x !== v) })} />
                            {l}
                        </label>
                    ))}
                </div>
            )}
            {problema
                ? <p className="text-xs text-amber-800 dark:text-amber-200">Esta condição {problema}: escolha de novo.</p>
                : valor && !valor.valores.length && <p className="text-xs text-amber-800 dark:text-amber-200">Marque ao menos uma resposta.</p>}
        </div>
    );
}

/** Configuração de uma ação: o que pede, onde fica, quem vê, se é obrigatória. */
function ConfigAcao({ id, acao, r, modelos, onChange, fase, f, i }) {
    const { ligadas } = useContext(RegistroContexto);
    const pede = pedidoDaAcao(r);
    const dest = destinoDaAcao(r);
    const set = (patch) => {
        const n = { ...(r || {}), ...patch };
        Object.keys(n).forEach((k) => (n[k] === undefined || n[k] === false) && delete n[k]);
        onChange(Object.keys(n).length ? n : null);
    };
    const setDestino = (v) => (pede === 'documento'
        ? onChange({ ...r, documento: { ...r.documento, destino: v === 'autos' ? undefined : v } })
        // Sem evento não aparece para ninguém: some também a marca das partes.
        : set({ destino: v === 'evento' ? undefined : v, autos: undefined, partes: (v !== 'nenhum' && partesVeem(r)) || undefined }));
    // Por que a parte não pode ver (a opção fica visível, desligada, com o motivo).
    const semPartes = dest === 'nenhum' ? 'Sem evento nunca aparece no portal.'
        : pede === 'confirmar' && !['autos', 'consolidar'].includes(dest) ? 'Só confirmar, fora dos autos, não tem o que mostrar: escolha "Nos autos" ou peça um dado.' : null;
    return (
        <div className="space-y-3 rounded-md bg-slate-50 dark:bg-slate-800/60 p-2">
            <div className="sm:max-w-sm">
                <NativeSelect id={`${id}-pede`} label="O que pede" value={pede} onChange={(v) => {
                    const n = regraComPedido(r, v, acao);
                    // Registro: o primeiro módulo com a integração ligada (o mesmo critério do campo do tipo).
                    onChange(v === 'registro' && !r?.modulo ? { ...n, modulo: MODULOS.find(([m]) => ligadas?.[m])?.[0] || 'consultas' } : n);
                }} options={PEDIDOS} />
            </div>
            <EscolhaDestino id={`${id}-dest`} valor={dest} onChange={setDestino} acao={acao} fase={fase}
                documento={pede === 'documento'} opcoes={pede === 'documento' ? DESTINOS_DOCUMENTO : Object.entries(DESTINO_INFO).map(([d, x]) => [d, x.rotulo])} />
            {pede !== 'confirmar' && pede !== 'documento' && (
                <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                        <Label htmlFor={`${id}-rot`}>Nome do dado</Label>
                        <Input id={`${id}-rot`} className="mt-1" value={r?.rotulo || ''} maxLength={80} placeholder={acao || 'Ex.: Número no SIM'} onChange={(e) => set({ rotulo: e.target.value || undefined })} />
                    </div>
                    {pede === 'registro' ? (
                        <div>
                            <NativeSelect id={`${id}-mod`} label="De qual módulo" value={r?.modulo || 'consultas'} onChange={(v) => set({ modulo: v })}
                                options={MODULOS.map(([m, l]) => [m, ligadas?.[m] ? l : `${l} (integração desligada)`])} />
                            {!ligadas?.[r?.modulo || 'consultas'] && <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">A integração com este módulo está desligada: ligue em "Integrações com outros módulos", na configuração do Processo Eletrônico, para salvar o rito.</p>}
                        </div>
                    ) : pede === 'lista' ? (
                        <OpcoesDaLista id={`${id}-op`} opcoes={r?.opcoes || []} onChange={(opcoes) => set({ opcoes })} />
                    ) : null}
                </div>
            )}
            {pede === 'formulario' && (
                <EditorCampos campos={r?.campos || []} onChange={(campos) => set({ campos })} max={MAX_CAMPOS_ACAO} paraAcao prefixo={`${id}-fc`} />
            )}
            {pede === 'documento' && (
                <CamposExigencia id={`${id}-doc`} e={r.documento} modelos={modelos} onChange={(d) => onChange({ ...r, documento: { ...d, descricao: acao } })} />
            )}
            <div>
                <Label htmlFor={`${id}-aj`}>Orientação a quem cumpre</Label>
                <Input id={`${id}-aj`} className="mt-1" value={r?.ajuda || ''} maxLength={200} placeholder="Opcional: aparece abaixo da ação, na tela do processo"
                    onChange={(e) => onChange(regraAjuda(r, e.target.value))} />
            </div>
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
            </div>
            <div className="sm:max-w-sm">
                <NativeSelect id={`${id}-nivel`} label="Para a fase seguir" value={nivelDaAcao(r)} onChange={(v) => onChange(regraComNivel(r, v))} options={NIVEIS} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
                {FRASE_NIVEL[nivelDaAcao(r)]}{pede === 'documento' ? ' Na juntada, quem junta decide se as partes veem.' : ''}
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
                <div>
                    <CondicaoPorResposta id={`${id}-se`} f={f} limite={i} valor={r?.se} rotulo="Quando vale" vazio="Sempre" onChange={(se) => set({ se })} />
                    {r?.se && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Só aparece e só é cobrada quando a resposta for uma das marcadas.</p>}
                </div>
                {pede !== 'documento' && (
                    <div>
                        <NativeSelect id={`${id}-quem`} label="Quem pode cumprir" value={r?.quem || ''} onChange={(v) => set({ quem: v || undefined })} options={QUEM} />
                        {r?.quem && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">A administração do órgão também pode.</p>}
                    </div>
                )}
            </div>
        </div>
    );
}

/** Ajuda da ação, guardada na regra (sem regra e sem ajuda, a ação volta a ser só confirmar). */
function regraAjuda(r, v) {
    const { ajuda: _a, ...resto } = r || {};
    const n = { ...resto, ...(v ? { ajuda: v } : {}) };
    return Object.keys(n).length ? n : null;
}

/** Opções de uma ação de escolha: uma por linha, com o limite à vista. */
function OpcoesDaLista({ id, opcoes, onChange }) {
    const validas = opcoes.filter((s) => s.trim()).length;
    return (
        <div>
            <Label htmlFor={id}>Opções (uma por linha)</Label>
            <Textarea id={id} className="mt-1" rows={Math.min(8, Math.max(3, opcoes.length + 1))} value={opcoes.join('\n')} placeholder={'PGEA\nArquivamento\nOutro'}
                aria-describedby={`${id}-n`}
                // Texto colado com ponto e vírgula (formato antigo) também vira uma opção por item.
                onChange={(e) => onChange(e.target.value.split(/\r?\n|;/))}
                onBlur={() => onChange([...new Set(opcoes.map((s) => s.trim()).filter(Boolean))])} />
            <p id={`${id}-n`} className={`mt-1 text-xs ${validas > MAX_OPCOES || validas < 2 ? 'text-amber-800 dark:text-amber-200' : 'text-slate-600 dark:text-slate-400'}`}>
                {validas} de {MAX_OPCOES} opções{validas < 2 ? ': informe ao menos duas' : validas > MAX_OPCOES ? `: só as ${MAX_OPCOES} primeiras ficam` : ''}.
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
    // Chave estável de cada ação (acompanha a ação ao arrastar): o foco do teclado fica na ação que foi movida.
    const chaves = useRef({ lista: [], seq: 0 });
    const nova = () => `k${chaves.current.seq++}`;
    while (chaves.current.lista.length < acoes.length) chaves.current.lista.push(nova());
    if (chaves.current.lista.length > acoes.length) chaves.current.lista = chaves.current.lista.slice(0, acoes.length);
    // `origem[j]`: de que posição veio a ação j (-1, nova). As condições acompanham a ação de que dependem.
    const gravar = (as, rs, origem = as.map((_, j) => (j < acoes.length ? j : -1))) => {
        const alinhadas = as.map((_, i) => rs[i] || null);
        mudar({ acoes: as, ...remapearCondicoes(f, origem, alinhadas) });
    };
    const indices = acoes.map((_, j) => j);
    const setTexto = (i, v) => {
        const linhas = v.split(/\r?\n/);
        if (linhas.length > 1) {
            // Só cabem as linhas que não passam do limite: nenhuma ação existente (e sua regra) se perde.
            const todas = linhas.map((s) => s.trim()).filter(Boolean);
            const novas = todas.slice(0, MAX_ACOES - acoes.length + 1);
            if (novas.length < todas.length) toast.warning(`Cabem ${MAX_ACOES} ações por fase: ${todas.length - novas.length} linha(s) ficaram de fora.`);
            const as = [...acoes.slice(0, i), ...novas, ...acoes.slice(i + 1)];
            chaves.current.lista.splice(i + 1, 0, ...novas.slice(1).map(nova));
            const rs = [...regras.slice(0, i), regras[i] || null, ...novas.slice(1).map(() => null), ...regras.slice(i + 1)];
            return gravar(as, rs, [...indices.slice(0, i + 1), ...novas.slice(1).map(() => -1), ...indices.slice(i + 1)]);
        }
        const rs = [...regras];
        if (rs[i]?.documento) rs[i] = { ...rs[i], documento: { ...rs[i].documento, descricao: v } };
        return gravar(acoes.map((a, j) => (j === i ? v : a)), rs);
    };
    const remover = (i) => {
        chaves.current.lista.splice(i, 1);
        gravar(acoes.filter((_, j) => j !== i), regras.filter((_, j) => j !== i), indices.filter((j) => j !== i));
    };
    const moverPara = (de, para) => {
        chaves.current.lista = mudarDeLugar(chaves.current.lista, de, para);
        gravar(mudarDeLugar(acoes, de, para), mudarDeLugar(acoes.map((_, j) => regras[j] || null), de, para), mudarDeLugar(indices, de, para));
        // A ação aberta continua aberta no lugar novo.
        if (aberta !== null) setAberta(mudarDeLugar(acoes.map((_, j) => j), de, para).indexOf(aberta));
    };
    const mover = (i, d) => moverPara(i, i + d);
    const id = idBase || f.id;
    const ids = chaves.current.lista.map((k) => `${id}-acao-${k}`);
    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Ações da fase</legend>
            <p className="text-xs text-slate-600 dark:text-slate-400 -mt-1">
                Cada ação aparece na tela do processo. Defina o que ela pede (só confirmar, um dado ou um documento), onde o cumprimento fica registrado e quem vê.
            </p>
            <ListaOrdenavel ids={ids} nome={(k) => `a ação ${ids.indexOf(k) + 1}${acoes[ids.indexOf(k)]?.trim() ? `, ${acoes[ids.indexOf(k)].trim()}` : ''}`} onMover={moverPara}>
            {acoes.map((a, i) => {
                const r = regras[i] || null;
                const aberto = aberta === i;
                return (
                    <ItemOrdenavel key={ids[i]} id={ids[i]} rotulo={`Arrastar a ação ${i + 1}`} className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 space-y-2">
                    {({ alca }) => (<>
                        <div className="flex items-center gap-1">
                            {alca}
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
                            <Button variant="ghost" size="icon" className={`${ICONE} hidden sm:inline-flex`} disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Subir a ação ${i + 1}`}><ArrowUp className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className={`${ICONE} hidden sm:inline-flex`} disabled={i === acoes.length - 1} onClick={() => mover(i, 1)} aria-label={`Descer a ação ${i + 1}`}><ArrowDown className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className={ICONE} onClick={() => { remover(i); setAberta(null); }} aria-label={`Remover a ação ${i + 1}`}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        <button type="button" className="flex min-h-[2.75rem] sm:min-h-0 items-start gap-1 text-left text-xs text-indigo-700 dark:text-indigo-300 pl-6" aria-expanded={aberto} onClick={() => setAberta(aberto ? null : i)}>
                            {aberto ? <ChevronDown className="w-3.5 h-3.5 mt-px shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 mt-px shrink-0" />}
                            <span>Pede {resumoDaAcao(r)}</span>
                        </button>
                        {aberto && a.trim() && <div className="sm:pl-6"><ConfigAcao id={`${id}-a${i}`} acao={a.trim()} fase={f.nome} f={f} i={i} r={r} modelos={modelos} onChange={(n) => { const rs = acoes.map((_, j) => regras[j] || null); rs[i] = n; gravar(acoes, rs); }} /></div>}
                        {aberto && !a.trim() && <p className="text-xs text-slate-600 pl-6">Escreva a ação para configurá-la.</p>}
                        {aberto && acoes.length > 1 && (
                            // No celular, além de arrastar: subir e descer com botões.
                            <div className="flex gap-2 sm:hidden">
                                <Button variant="outline" size="sm" className="h-11 gap-1" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp className="w-4 h-4" aria-hidden /> Subir</Button>
                                <Button variant="outline" size="sm" className="h-11 gap-1" disabled={i === acoes.length - 1} onClick={() => mover(i, 1)}><ArrowDown className="w-4 h-4" aria-hidden /> Descer</Button>
                            </div>
                        )}
                    </>)}
                    </ItemOrdenavel>
                );
            })}
            </ListaOrdenavel>
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
        <fieldset className="space-y-2" aria-labelledby={`${id}-cc`}>
            <legend className="text-sm font-medium inline-flex items-center gap-1"><span id={`${id}-cc`}>Certidão conjunta</span> <AjudaTermo id="certidao_conjunta" /></legend>
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
                Sempre nos autos: autuação, juntada de documento, petição, comunicação e ciência, mudança de situação (sobrestar <AjudaTermo id="sobrestar" />, arquivar, reativar), exclusão e restauração.
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
                    Nos autos <AjudaTermo id="autos" />: termo com folha, que as partes veem. Evento no extrato: aparece na aba Eventos e ao fim do PDF, sem folha, e as partes não veem.
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
                <legend className="text-sm font-medium">Documentos da fase</legend>
                <p className="text-xs text-slate-600 dark:text-slate-400">Obrigatório: para sair da fase sem ele, é preciso informar o motivo da dispensa <AjudaTermo id="dispensa" />, que fica registrado. Recomendado: quem conclui a fase é avisado, sem precisar de motivo. Opcional: só aparece como lembrete.</p>
                {docs.map((d, k) => (
                    <div key={k} className="space-y-2 pl-3 border-l-2 border-indigo-200 dark:border-indigo-800">
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <Label htmlFor={`${id}-dex-${k}`}>Documento</Label>
                                <Input id={`${id}-dex-${k}`} className="mt-1" value={d.descricao || ''} maxLength={200} onChange={(e) => setDocs(docs.map((x, j) => (j === k ? { ...x, descricao: e.target.value } : x)))} placeholder="Ex.: Parecer da assessoria" />
                            </div>
                            <Button variant="ghost" size="icon" className={ICONE} onClick={() => setDocs(docs.filter((_, j) => j !== k))} aria-label={`Remover o documento exigido ${k + 1}`}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                        <CamposExigencia id={`${id}-dex-${k}`} e={d} modelos={modelos} onChange={(nv) => setDocs(docs.map((x, j) => (j === k ? nv : x)))} />
                        <div className="grid sm:grid-cols-2 gap-2">
                            <NativeSelect id={`${id}-dexd-${k}`} label="Onde fica" value={d.destino || 'autos'} onChange={(v) => setDocs(docs.map((x, j) => (j === k ? { ...x, destino: v === 'autos' ? undefined : v } : x)))} options={DESTINOS_DOCUMENTO} />
                            <NativeSelect id={`${id}-dexn-${k}`} label="Para a fase seguir" value={d.nivel || ''} onChange={(v) => setDocs(docs.map((x, j) => (j === k ? { ...x, nivel: v || undefined } : x)))} options={NIVEIS_DOC} />
                        </div>
                    </div>
                ))}
                {docs.length < MAX_DOCUMENTOS_FASE && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setDocs([...docs, { descricao: '', forma: 'qualquer' }])}><Plus className="w-4 h-4" /> Exigir documento</Button>
                )}
            </fieldset>
        </div>
    );
}
