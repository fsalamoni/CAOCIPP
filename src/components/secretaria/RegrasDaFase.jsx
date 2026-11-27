import React, { createContext, useContext, useRef, useState } from 'react';
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
    pedidoDaAcao, regraComPedido, resumoDaAcao, saidasDaFase, tituloCertidao, aberturaCertidao, ABERTURA_CERTIDAO, MAX_ABERTURA_CERTIDAO, MAX_ASSINATURAS_EXIGIDAS,
    QUEM, VE, podeReservar, podeIrParaFolha, alternativasPossiveis, chaveDaCondicao, condicaoIncompleta, fontesDaCondicao, juntarPartes, MAX_CONDICOES_E, opcoesDaParte, parteDaFonte, partesDaCondicao,
    problemaDaCondicao, remapearCondicoes, soOrienta, daPartes,
} from '@/lib/exigencias';
import { camposDaEspecie, especiesParaEscolher } from '@/lib/comunicacaoRito';
import { audienciasParaEscolher, camposDaAudiencia } from '@/lib/audiencias';
import { MAX_MEMBROS, MAX_RESULTADOS } from '@/lib/julgamento';
import { NativeSelect } from './comum';
import { MODULOS, POLOS } from '@/lib/camposProcesso';
import { RegistroContexto } from './SeletorRegistro';
import AjudaTermo from './AjudaTermo';
import { CampoAtribuicao } from './PermissoesDaFase';
import { EditorCampos, EscolhaPagina } from './CamposProcesso';
import { ItemOrdenavel, ListaOrdenavel } from './Ordenavel';
import { PERFIS_DISPUTA } from '@/lib/certames';
import { LIGAVEL_NO_FORM, camposLigaveis, podeLigar } from '@/lib/doProcesso';
import { LevaAoPainel } from './IntegracaoPainel';

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

const ASSINATURAS_EXIGIDAS = [['', 'Não exige'], ...Array.from({ length: MAX_ASSINATURAS_EXIGIDAS }, (_, i) => [String(i + 1), i ? `${i + 1} assinaturas` : '1 assinatura'])];

/** Campos de um documento exigido: forma, tipo, modelo, assinaturas e portal (a descrição fica com quem chama). */
function CamposExigencia({ id, e, modelos, onChange }) {
    // Documento recebido de fora não se assina aqui: as assinaturas valem para o que o órgão redige.
    const assina = e.forma !== 'juntar';
    const { atribuicoes = [] } = useContext(RegistroContexto);
    const mudarForma = (v) => onChange(v === 'juntar' ? { ...e, forma: v, assinaturas: undefined, assinatura_atribuicao: undefined } : { ...e, forma: v });
    return (
        <div className="space-y-2">
        <div className="grid sm:grid-cols-3 gap-2">
            <NativeSelect id={`${id}-forma`} label="Como" value={e.forma || 'qualquer'} onChange={mudarForma} options={FORMAS} />
            <div>
                <Label htmlFor={`${id}-tipo`}>Tipo de documento</Label>
                <Input id={`${id}-tipo`} className="mt-1" value={e.tipo || ''} maxLength={60} onChange={(ev) => onChange({ ...e, tipo: ev.target.value })} placeholder="Ex.: Parecer (opcional)" />
            </div>
            <NativeSelect id={`${id}-modelo`} label="Modelo indicado" value={e.modelo_id || ''} onChange={(v) => onChange({ ...e, modelo_id: v || undefined })}
                options={[['', 'Nenhum'], ...modelos.map((m) => [m.id, m.nome])]} />
        </div>
        {assina && (
            <div className="grid sm:grid-cols-3 gap-2">
                <NativeSelect id={`${id}-ass`} label="Assinaturas exigidas" value={e.assinaturas ? String(e.assinaturas) : ''}
                    onChange={(v) => onChange({ ...e, assinaturas: v ? Number(v) : undefined })} options={ASSINATURAS_EXIGIDAS} />
                <div className="sm:col-span-2">
                    <Label htmlFor={`${id}-assat`}>Uma das assinaturas é de quem tem a atribuição</Label>
                    <Input id={`${id}-assat`} className="mt-1" list={`${id}-assat-lista`} value={e.assinatura_atribuicao || ''} maxLength={80} placeholder="Ex.: Promotor (opcional)"
                        onChange={(ev) => onChange({ ...e, assinatura_atribuicao: ev.target.value || undefined })} />
                    <datalist id={`${id}-assat-lista`}>{atribuicoes.map((a) => <option key={a} value={a} />)}</datalist>
                </div>
            </div>
        )}
        {!e.destino && (
            <label className="flex items-start gap-2 text-sm">
                <input id={`${id}-fp`} type="checkbox" className="mt-1" checked={e.partes === false} onChange={(ev) => onChange({ ...e, partes: ev.target.checked ? false : undefined })} />
                <span>Fica fora do portal das partes</span>
            </label>
        )}
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
 * De onde uma condição pode ler além da própria fase: o rito inteiro (`fases`,
 * para a resposta dada em outra fase) e os tipos de processo que usam o rito
 * (`tipos`, para "Tipo de processo" e os campos de escolha do formulário).
 */
export const CondicaoContexto = createContext({ fases: [], tipos: [] });

/** Uma parte da condição: o que ela lê e quais respostas fazem valer. */
function ParteDaCondicao({ id, f, limite, ctx, parte, usadas, onChange, rotulo, vazio }) {
    const chave = parte ? chaveDaCondicao(parte) : '';
    // Cada coisa só entra uma vez na mesma condição.
    const fontes = fontesDaCondicao(f, limite, ctx).filter((s) => chaveDaCondicao(s) === chave || !usadas.has(chaveDaCondicao(s)));
    const ops = parte ? opcoesDaParte(f, parte, ctx) || [] : [];
    const opcoes = [['', vazio], ...fontes.map((s) => [chaveDaCondicao(s), `Conforme ${s.rotulo}`])];
    if (parte && !fontes.some((s) => chaveDaCondicao(s) === chave)) {
        opcoes.push([chave, parte.dado || parte.fase ? 'O que esta condição lia (não serve mais)' : `Ação ${parte.acao + 1} (não serve mais)`]);
    }
    const marcar = (v, c) => onChange(parteDaFonte({ ...parte, nome: parte.rotulo },
        c === true ? [...new Set([...parte.valores, v])] : parte.valores.filter((x) => x !== v), ops));
    return (
        <div className="space-y-1">
            <NativeSelect id={`${id}-acao`} label={rotulo} value={chave} options={opcoes}
                onChange={(v) => {
                    const fonte = fontes.find((x) => chaveDaCondicao(x) === v);
                    return onChange(fonte ? parteDaFonte(fonte) : undefined);
                }} />
            {parte && ops.length > 0 && (
                <div role="group" aria-label={`Respostas que fazem valer: ${rotulo}`} className="flex flex-wrap gap-x-4 gap-y-1 pl-1">
                    {ops.map(([v, l]) => (
                        <label key={v} className="flex min-h-[2.75rem] sm:min-h-0 items-center gap-2 text-sm">
                            <Checkbox checked={parte.valores.includes(v)} onCheckedChange={(c) => marcar(v, c)} />
                            {l}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Condição de uma ação ("quando vale") ou de uma saída ("regra desta saída").
 * Lê a resposta de uma ação de escolha (lista ou sim/não) ou de um campo de
 * escolha de formulário, desta fase ou de outra, ou um dado do processo
 * (urgente, sigilo, partes, origem, tipo, campo do tipo). "E também" soma
 * condições: todas precisam valer. `limite`: na própria fase, só ações antes
 * dele (ação condicional).
 */
export function CondicaoPorResposta({ id, f, limite = Infinity, valor, onChange, rotulo, vazio }) {
    const ctx = useContext(CondicaoContexto);
    const [mais, setMais] = useState(false);
    const partes = partesDaCondicao(valor);
    const set = (k, parte) => {
        const novas = [...partes];
        if (parte) novas[k] = parte; else novas.splice(k, 1);
        onChange(juntarPartes(novas));
    };
    const usadas = (k) => new Set(partes.filter((_, j) => j !== k).map(chaveDaCondicao));
    const problema = problemaDaCondicao(f, valor, limite, ctx);
    const cabeMais = partes.length > 0 && partes.length <= MAX_CONDICOES_E;
    const semEscolhaNaFase = !fontesDaCondicao(f, limite, ctx).some((s) => s.grupo === 'fase');
    return (
        <div className="space-y-1">
            {(partes.length ? partes : [undefined]).map((parte, k) => (
                <ParteDaCondicao key={k} id={k ? `${id}-e${k}` : id} f={f} limite={limite} ctx={ctx} parte={parte} usadas={usadas(k)}
                    rotulo={k ? `${rotulo}: e também` : rotulo} vazio={k ? '(tirar esta condição)' : vazio} onChange={(n) => set(k, n)} />
            ))}
            {mais && cabeMais && (
                <ParteDaCondicao id={`${id}-e${partes.length}`} f={f} limite={limite} ctx={ctx} parte={undefined} usadas={usadas(-1)}
                    rotulo={`${rotulo}: e também`} vazio="(escolha o que mais precisa valer)" onChange={(n) => { if (n) { set(partes.length, n); setMais(false); } }} />
            )}
            {cabeMais && !mais && !condicaoIncompleta(valor) && (
                <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setMais(true)}><Plus className="w-3.5 h-3.5" aria-hidden /> E também</Button>
            )}
            {!valor && semEscolhaNaFase && (
                <p className="text-xs text-slate-600 dark:text-slate-400">Para condicionar por uma resposta, crie {limite === Infinity ? 'nesta fase' : 'antes dela'} uma ação que pede escolha (lista ou sim/não) ou um formulário com um campo de escolha. Também dá para ler a resposta de outra fase ou um dado do processo.</p>
            )}
            {problema
                ? <p className="text-xs text-amber-800 dark:text-amber-200">Esta condição {problema}: escolha de novo.</p>
                : condicaoIncompleta(valor) && <p className="text-xs text-amber-800 dark:text-amber-200">Marque ao menos uma resposta{partes.length > 1 ? ' em cada condição' : ''}.</p>}
        </div>
    );
}

/**
 * "Vem do processo": o campo do processo (do tipo, ou assunto e descrição) que,
 * preenchido, cumpre a ação sozinho. No formulário, um campo do processo para
 * cada campo da ação. Igual ao servidor (shared/doProcesso.ts).
 */
function VemDoProcesso({ id, r, set }) {
    const { tipos } = useContext(CondicaoContexto);
    const pede = pedidoDaAcao(r);
    const semTipos = !(tipos || []).length;
    const explica = 'Quando o campo já está preenchido no processo (desde o "Novo processo" ou depois, ao corrigir os dados), a ação se cumpre sozinha, com o mesmo registro de quando alguém a marca, e o sistema aparece como autor. Apagado o campo, ela volta a ficar pendente. Cumprida à mão, a ação preenche o campo que estava vazio.';
    if (pede === 'formulario') {
        const mapa = r?.do_processo_campos || {};
        const campos = (r?.campos || []).filter((c) => c.id && LIGAVEL_NO_FORM[c.tipo]);
        if (!campos.length) return null;
        const mudar = (cid, v) => {
            const n = { ...mapa };
            if (v) n[cid] = v; else delete n[cid];
            set({ do_processo_campos: Object.keys(n).length ? n : undefined });
        };
        return (
            <fieldset className="space-y-2 rounded-md border border-slate-200 dark:border-slate-700 p-2">
                <legend className="px-1 text-sm font-medium">Vem do processo</legend>
                <p className="text-xs text-slate-600 dark:text-slate-400">{explica} No formulário, ele se cumpre quando todo campo obrigatório tem de onde vir.</p>
                {semTipos && <p className="text-xs text-amber-800 dark:text-amber-200">Nenhum tipo de processo usa este rito ainda: só assunto e descrição aparecem. Ligue o rito a um tipo para ver os campos dele.</p>}
                <div className="grid sm:grid-cols-2 gap-2">
                    {campos.map((c) => {
                        const ops = camposLigaveis(tipos, c.tipo, true);
                        const atual = mapa[c.id];
                        const perdido = atual && !ops.some((o) => o.id === atual);
                        return (
                            <NativeSelect key={c.id} id={`${id}-vp-${c.id}`} label={c.rotulo || 'Campo'} value={atual || ''} onChange={(v) => mudar(c.id, v)}
                                options={[['', 'Quem cumpre informa'], ...ops.map((o) => [o.id, `${o.rotulo}${o.tipo_nome && (tipos || []).length > 1 ? ` (${o.tipo_nome})` : ''}`]), ...(perdido ? [[atual, 'Campo que saiu do tipo (não cumpre mais)']] : [])]} />
                        );
                    })}
                </div>
            </fieldset>
        );
    }
    const ops = camposLigaveis(tipos, pede);
    const atual = r?.do_processo || '';
    const perdido = atual && !ops.some((o) => o.id === atual);
    const soMarca = pede === 'confirmar';
    // Ação que só se marca: o dado no processo a torna desnecessária (não há o que registrar).
    const explicaDispensa = 'Quando o campo já está preenchido no processo (desde o "Novo processo" ou depois, ao corrigir os dados), a ação não é precisa: ela some da tela do processo, não é cobrada e não gera registro. Apagado o campo, ela volta a valer. Para dispensar uma ação de documento ou de dado pelo mesmo campo, use "Quando vale" com o campo "vazio".';
    return (
        <div className="sm:max-w-md">
            <NativeSelect id={`${id}-vp`} label={soMarca ? 'Dispensada pelo processo' : 'Vem do processo'} value={atual} onChange={(v) => set({ do_processo: v || undefined })}
                options={[['', soMarca ? 'Não: alguém marca' : 'Não: quem cumpre informa'], ...ops.map((o) => [o.id, `${soMarca ? 'Dispensada quando preenchido: ' : ''}${o.rotulo}${o.tipo_nome && (tipos || []).length > 1 ? ` (${o.tipo_nome})` : ''}`]), ...(perdido ? [[atual, 'Campo que saiu do tipo (não dispensa mais)']] : [])]} />
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {atual ? (soMarca ? explicaDispensa : explica) : soMarca && !semTipos ? 'Para não pedir o que o "Novo processo" já resolve (ex.: converter em PGEA quando o número já veio), escolha o campo: preenchido, a ação some.' : semTipos ? 'Ligue o rito a um tipo de processo para escolher um campo do "Novo processo" (assunto e descrição já servem).' : 'Para não pedir de novo o que o "Novo processo" já informa (ex.: o número no sistema de origem), escolha o campo.'}
            </p>
        </div>
    );
}

/** Configuração de uma ação: o que pede, onde fica, quem vê, se é obrigatória. */
function ConfigAcao({ id, acao, r, modelos, onChange, fase, f, i }) {
    const { ligadas, paginas } = useContext(RegistroContexto);
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
        // Nos autos toda a equipe lê: o dado deixa de ser reservado.
        : set({ destino: v === 'evento' ? undefined : v, autos: undefined, partes: (v !== 'nenhum' && partesVeem(r)) || undefined, ...(['autos', 'consolidar'].includes(v) ? { ve: undefined } : {}) }));
    // Por que a parte não pode ver (a opção fica visível, desligada, com o motivo).
    const alternativas = alternativasPossiveis(f, i);
    const semPartes = r?.ve ? 'Dado reservado a quem gere a unidade não vai ao portal.'
        : dest === 'nenhum' ? 'Sem evento nunca aparece no portal.'
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
            {soOrienta(r) && (
                <>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Aparece na tela do processo como um lembrete da fase. Ninguém marca, não gera registro e não impede a fase de seguir.</p>
                    <div>
                        <Label htmlFor={`${id}-aj`}>Detalhe da orientação</Label>
                        <Input id={`${id}-aj`} className="mt-1" value={r?.ajuda || ''} maxLength={200} placeholder="Opcional: aparece abaixo da ação, na tela do processo"
                            onChange={(e) => set({ ajuda: e.target.value || undefined })} />
                    </div>
                    <div className="sm:max-w-sm">
                        <CondicaoPorResposta id={`${id}-se`} f={f} limite={i} valor={r?.se} rotulo="Quando vale" vazio="Sempre" onChange={(se) => set({ se })} />
                    </div>
                </>
            )}
            {!soOrienta(r) && <>
            {daPartes(r) ? <ConfigDasPartes id={id} r={r} f={f} i={i} onChange={onChange} /> : pede === 'quitacao' ? null : (
                <EscolhaDestino id={`${id}-dest`} valor={dest} onChange={setDestino} acao={acao} fase={fase}
                    documento={pede === 'documento'} opcoes={pede === 'documento' ? DESTINOS_DOCUMENTO : Object.entries(DESTINO_INFO).map(([d, x]) => [d, x.rotulo])} />
            )}
            {pede !== 'confirmar' && pede !== 'documento' && pede !== 'quitacao' && !daPartes(r) && (
                <div className="grid sm:grid-cols-2 gap-2">
                    <div>
                        <Label htmlFor={`${id}-rot`}>Nome do dado</Label>
                        <Input id={`${id}-rot`} className="mt-1" value={r?.rotulo || ''} maxLength={80} placeholder={acao || 'Ex.: Número no SIM'} onChange={(e) => set({ rotulo: e.target.value || undefined })} />
                    </div>
                    {pede === 'registro' ? (
                        <div>
                            <NativeSelect id={`${id}-mod`} label="De qual módulo" value={r?.modulo || 'consultas'} onChange={(v) => set({ modulo: v, pagina: v === 'paginas' ? r?.pagina || paginas?.[0]?.id : undefined })}
                                options={MODULOS.map(([m, l]) => [m, ligadas?.[m] ? l : `${l} (integração desligada)`])} />
                            {r?.modulo === 'paginas' && <div className="mt-2"><EscolhaPagina id={`${id}-pag`} paginas={paginas} value={r?.pagina} onChange={(v) => set({ pagina: v })} /></div>}
                            {!ligadas?.[r?.modulo || 'consultas'] && <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">A integração com este módulo está desligada: ligue em "Integrações com outros módulos", na configuração do Processo Eletrônico, para salvar o rito.</p>}
                        </div>
                    ) : pede === 'derivado' ? (
                        <div>
                            <Label htmlFor={`${id}-der`}>Tipo de processo ou rito sugerido</Label>
                            <Input id={`${id}-der`} className="mt-1" value={r?.derivado?.tipo || ''} maxLength={80} placeholder="Opcional: o nome do tipo ou do rito"
                                onChange={(e) => set({ derivado: e.target.value ? { tipo: e.target.value } : undefined })} />
                        </div>
                    ) : pede === 'lista' ? (
                        <OpcoesDaLista id={`${id}-op`} opcoes={r?.opcoes || []} onChange={(opcoes) => set({ opcoes })} />
                    ) : null}
                </div>
            )}
            {pede === 'cronograma' && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    Na tela do processo, a ação mostra o botão &quot;Montar cronograma&quot;: quem cumpre gera as parcelas (quantidade, primeiro vencimento, periodicidade e valor) ou inclui as obrigações uma a uma.
                    Cada obrigação vira um prazo do processo, com alerta de vencimento. A parte a vê no portal e responde a ela com o comprovante; quem conduz o processo a encerra como cumprida.
                    Para esperar o cumprimento de todas numa fase adiante, use &quot;Esperar o cumprimento do cronograma&quot;.
                </p>
            )}
            {pede === 'quitacao' && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    Esta ação não se marca à mão: ela se cumpre sozinha quando todas as obrigações do cronograma do processo estiverem cumpridas, e mostra o andamento enquanto isso (quantas cumpridas, quantas atrasadas, a próxima).
                    Obrigatória, ela impede que a fase seja concluída antes do cumprimento integral. O cronograma nasce de uma ação &quot;Registrar um cronograma de obrigações&quot; ou do botão &quot;Cronograma&quot; da tela do processo.
                </p>
            )}
            {pede === 'derivado' && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    Na tela do processo, a ação mostra o botão &quot;Abrir processo&quot;, que leva ao &quot;Novo processo&quot; com este processo como origem.
                    Se o órgão tem um só tipo de processo com o nome sugerido, ou que usa o rito com esse nome, ele já vem escolhido; quem abre pode trocar.
                    Criado o processo, a ação se cumpre sozinha, com o número dele. Se o processo já existia, &quot;Já existe&quot; deixa escolher entre os ligados a este.
                    Com duas ações destas pendentes na fase, a sugestão diz qual delas o processo novo cumpre.
                </p>
            )}
            {pede === 'formulario' && (
                <EditorCampos campos={r?.campos || []} onChange={(campos) => set({ campos })} max={MAX_CAMPOS_ACAO} paraAcao prefixo={`${id}-fc`} />
            )}
            {pede === 'documento' && (
                <CamposExigencia id={`${id}-doc`} e={r.documento} modelos={modelos} onChange={(d) => onChange({ ...r, documento: { ...d, descricao: acao } })} />
            )}
            {podeLigar(r) && <VemDoProcesso id={id} r={r} set={set} />}
            <LevaAoPainel id={id} r={r} set={set} />
            <div>
                <Label htmlFor={`${id}-aj`}>Orientação a quem cumpre</Label>
                <Input id={`${id}-aj`} className="mt-1" value={r?.ajuda || ''} maxLength={200} placeholder="Opcional: aparece abaixo da ação, na tela do processo"
                    onChange={(e) => onChange(regraAjuda(r, e.target.value))} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
                {pede !== 'documento' && !daPartes(r) && (
                    <div className="text-sm">
                        <label className={`flex items-center gap-2 ${semPartes ? 'text-slate-500 dark:text-slate-500' : ''}`}>
                            <Checkbox checked={partesVeem(r)} disabled={!!semPartes} onCheckedChange={(c) => set({ partes: c === true ? true : undefined, ...(r?.autos ? { autos: undefined, destino: 'autos' } : {}) })} />
                            As partes veem no portal
                        </label>
                        {semPartes && <p className="text-xs text-slate-600 dark:text-slate-400 pl-6">{semPartes}</p>}
                    </div>
                )}
                {(podeIrParaFolha(r) || r?.folha_dados) && (
                    <div className="text-sm">
                        <label className="flex items-center gap-2">
                            <Checkbox checked={r?.folha_dados === true} onCheckedChange={(c) => set({ folha_dados: c === true ? true : undefined })} />
                            Entra na folha de dados do processo
                        </label>
                        <p className="text-xs text-slate-600 dark:text-slate-400 pl-6">
                            O dado sai na segunda folha do PDF, junto com os dados da autuação (evento 1), sem criar outra folha. {partesVeem(r) ? 'As partes também o leem ali.' : 'Na cópia das partes ele só aparece com "As partes veem no portal" marcado.'}
                        </p>
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
                {pede !== 'documento' && pede !== 'resposta' && (
                    <div>
                        <NativeSelect id={`${id}-quem`} label="Quem pode cumprir" value={r?.quem || ''} onChange={(v) => set({ quem: v || undefined, atribuicao: v === 'atribuicao' ? r?.atribuicao || '' : undefined })} options={QUEM} />
                        {r?.quem === 'atribuicao' && <CampoAtribuicao id={`${id}-atr`} value={r.atribuicao} onChange={(v) => set({ atribuicao: v })} />}
                        {r?.quem && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">A administração do órgão também pode.</p>}
                    </div>
                )}
                {(podeReservar(r) || r?.ve) && (
                    <div>
                        <NativeSelect id={`${id}-ve`} label="Quem vê o dado na equipe" value={r?.ve || ''} onChange={(v) => set({ ve: v || undefined, ...(v ? { partes: undefined, folha_dados: undefined } : {}) })} options={VE} />
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            {r?.ve ? 'Também veem quem registrou e a administração. Os demais veem que a ação foi feita, sem o dado. Nunca vai aos autos nem ao portal.' : 'Para um dado interno, como uma anotação do gestor, escolha "Só quem gere a unidade".'}
                        </p>
                    </div>
                )}
                {pede !== 'resposta' && <div>
                    <Label htmlFor={`${id}-pz`}>{pede === 'comunicacao' ? 'Prazo para expedir (dias)' : pede === 'audiencia' ? 'Prazo para designar (dias)' : pede === 'julgamento' ? 'Prazo para julgar (dias)' : pede === 'disputa' ? 'Prazo para concluir a disputa (dias)' : 'Prazo próprio da ação (dias)'}</Label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Input id={`${id}-pz`} type="number" min={1} max={3650} placeholder="Sem prazo" className="h-9 w-28" value={r?.prazo_dias || ''}
                            onChange={(e) => { const n = Number(e.target.value); set({ prazo_dias: Number.isInteger(n) && n > 0 ? n : undefined, ...(Number.isInteger(n) && n > 0 ? {} : { prazo_contagem: undefined }) }); }} />
                        {r?.prazo_dias > 0 && (
                            <select aria-label="Contagem do prazo da ação" value={r.prazo_contagem || ''} onChange={(e) => set({ prazo_contagem: e.target.value || undefined })}
                                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                                <option value="">dias úteis</option>
                                <option value="corridos">dias corridos</option>
                            </select>
                        )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        {r?.prazo_dias > 0
                            ? 'Abre sozinho quando a ação passa a valer na fase e encerra quando ela é cumprida. É prazo interno: as partes não veem. O alerta e o que acontece no vencimento ficam em "Prazo, nome para as partes e ao entrar".'
                            : 'Vazio: a ação segue só o prazo da fase, se houver.'}
                    </p>
                </div>}
                {pede !== 'documento' && (alternativas.length > 0 || Number.isInteger(r?.ou)) && (
                    <div>
                        <NativeSelect id={`${id}-ou`} label="Alternativa a" value={Number.isInteger(r?.ou) ? String(r.ou) : ''}
                            onChange={(v) => set({ ou: v === '' ? undefined : Number(v) })}
                            options={[['', 'Nenhuma: vale por si'], ...alternativas.map(([k, a]) => [String(k), `"${a.trim()}"`])]} />
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                            {Number.isInteger(r?.ou) ? 'Cumprida uma das duas, a outra deixa de ser cobrada.' : 'Para "faça isto ou aquilo": escolha a ação anterior que esta substitui.'}
                        </p>
                    </div>
                )}
            </div>
            </>}
        </div>
    );
}

/**
 * Comunicar as partes e esperar a resposta (processos com partes): a espécie,
 * a quem, o prazo e o texto da comunicação; e de qual comunicação a espera
 * depende. Igual ao servidor (shared/comunicacaoRito.ts).
 */
function ConfigDasPartes({ id, r, f, i, onChange }) {
    // Listas do órgão: espécies a mais, além das do sistema.
    const { listas = {} } = useContext(RegistroContexto);
    if (r?.pede === 'audiencia') {
        const opcoesAud = audienciasParaEscolher(listas.audiencia, r.audiencia);
        return (
            <div className="space-y-1 sm:max-w-md">
                <NativeSelect id={`${id}-aud`} label="Espécie" value={r.audiencia?.especie || 'audiencia'} options={opcoesAud.map(([v, l]) => [v, l])}
                    onChange={(v) => onChange({ ...r, audiencia: camposDaAudiencia(v, opcoesAud) })} />
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    Na tela do processo, o botão &quot;Designar&quot; pede a data, a hora, o modo (presencial, por videoconferência ou híbrido), o local ou o link e quem participa além das partes (testemunha, perito...).
                    A designação vira certidão nos autos e as partes a veem no portal. Para intimar, ponha depois uma ação &quot;Comunicar as partes&quot; com {'{audiencia}'} no texto: ele é trocado pela data e pelo local.
                    Desfazer cancela a audiência, com certidão. A realização e a ata ficam com as ações seguintes (uma escolha &quot;Realizada / Não realizada&quot;, um documento da ata).
                </p>
            </div>
        );
    }
    if (r?.pede === 'disputa') {
        return (
            <div className="space-y-1 sm:max-w-md">
                <NativeSelect id={`${id}-disp`} label="Tipo de disputa" value={r.disputa?.perfil || 'cotacao'} options={Object.entries(PERFIS_DISPUTA)}
                    onChange={(v) => onChange({ ...r, disputa: { perfil: v } })} />
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    {r.disputa?.perfil === 'dispensa'
                        ? 'Dispensa eletrônica (IN 67/2021): aviso com link público, abertura ao menos 3 dias úteis depois da publicação, propostas de qualquer fornecedor com conta e lances de 6 a 10 horas.'
                        : 'Cotação privada: só os fornecedores convidados por e-mail veem o aviso e mandam proposta; abertura a partir do dia útil seguinte e lances opcionais.'}
                    {' '}Na tela do processo, o botão &quot;Montar a disputa&quot; abre o aviso (objeto, itens, critério, abertura). Aviso, adiamento e cancelamento vão aos autos; as propostas são sigilosas até a abertura.
                    A ação se cumpre com o resultado: Homologada, Deserta ou Fracassada, que podem levar a caminhos diferentes do rito.
                </p>
            </div>
        );
    }
    if (r?.pede === 'julgamento') {
        const j = r.julgamento || { resultados: [] };
        const setJ = (patch) => {
            const n = { ...j, ...patch };
            Object.keys(n).forEach((k) => n[k] === undefined && delete n[k]);
            onChange({ ...r, julgamento: n });
        };
        const res = j.resultados || [];
        const limpos = [...new Set(res.map((x) => x.trim()).filter(Boolean))];
        const setRes = (l) => setJ({ resultados: l, ...(j.favoravel && !l.includes(j.favoravel) ? { favoravel: undefined } : {}) });
        return (
            <div className="space-y-3">
                <fieldset>
                    <legend className="text-sm font-medium">Resultados possíveis</legend>
                    <ul className="mt-1 space-y-1">
                        {res.map((x, k) => (
                            <li key={k} className="flex items-center gap-2">
                                <Input aria-label={`Resultado ${k + 1}`} className="h-9 sm:max-w-xs" maxLength={80} value={x}
                                    onChange={(e) => setRes(res.map((y, n) => (n === k ? e.target.value : y)))} />
                                <Button type="button" variant="ghost" size="icon" aria-label={`Tirar o resultado ${x || k + 1}`} disabled={res.length <= 2}
                                    onClick={() => setRes(res.filter((_, n) => n !== k))}><Trash2 className="w-4 h-4" /></Button>
                            </li>
                        ))}
                    </ul>
                    {res.length < MAX_RESULTADOS && (
                        <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => setRes([...res, ''])}><Plus className="w-4 h-4 mr-1" />Resultado</Button>
                    )}
                    {limpos.length < 2 && <p role="alert" className="mt-1 text-xs text-amber-800 dark:text-amber-200">Informe ao menos dois resultados diferentes.</p>}
                </fieldset>
                <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                        <Label htmlFor={`${id}-quorum`}>Quórum (votos válidos)</Label>
                        <Input id={`${id}-quorum`} type="number" min={1} max={MAX_MEMBROS} placeholder="Sem mínimo" className="mt-1 h-9 w-28" value={j.quorum || ''}
                            onChange={(e) => { const n = Number(e.target.value); setJ({ quorum: Number.isInteger(n) && n > 1 ? n : undefined }); }} />
                    </div>
                    <NativeSelect id={`${id}-desempate`} label="No empate" value={j.desempate || 'presidente'}
                        onChange={(v) => setJ(v === 'favoravel' ? { desempate: 'favoravel', favoravel: limpos.includes(j.favoravel) ? j.favoravel : limpos[limpos.length - 1] } : { desempate: undefined, favoravel: undefined })}
                        options={[['presidente', 'Desempata o presidente'], ['favoravel', 'Prevalece o mais favorável']]} />
                    {j.desempate === 'favoravel' && (
                        <NativeSelect id={`${id}-favoravel`} label="Mais favorável à parte" value={j.favoravel || ''} onChange={(v) => setJ({ favoravel: v })}
                            options={limpos.map((x) => [x, x])} />
                    )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    Na tela do processo, o botão &quot;Registrar julgamento&quot; pede a data da sessão e, para cada membro, o nome, a função (relator, revisor, presidente, membro) e o voto: um dos resultados, ou impedido, suspeito, ausente ou abstenção, que ficam registrados e não contam.
                    O sistema apura pela maioria dos votos válidos, confere o quórum e aplica o desempate do rito. O resultado vira a resposta da ação (use-o nas saídas da fase) e a certidão de julgamento, com placar, relator e vencidos, vai aos autos, e as partes a veem.
                    Os fundamentos ficam nos documentos da fase (voto do relator, acórdão, ata).
                </p>
            </div>
        );
    }
    if (r?.pede === 'resposta') {
        const comunicam = (f?.acoes || []).map((a, k) => [k, a]).filter(([k]) => k < i && f.acoes_regras?.[k]?.pede === 'comunicacao' && f.acoes_regras[k].comunicacao?.dias > 0);
        const de = r.resposta?.de;
        const valida = comunicam.some(([k]) => k === de);
        return (
            <div className="space-y-1 sm:max-w-md">
                {comunicam.length ? (
                    <NativeSelect id={`${id}-de`} label="Espera a resposta de" value={valida ? String(de) : ''} onChange={(v) => onChange({ ...r, resposta: { de: v === '' ? -1 : Number(v) } })}
                        options={[['', 'Escolha a comunicação…'], ...comunicam.map(([k, a]) => [String(k), `"${a.trim()}"`])]} />
                ) : (
                    <p role="alert" className="text-xs text-amber-800 dark:text-amber-200">Antes desta ação, ponha na fase uma ação que comunique as partes com prazo de resposta.</p>
                )}
                <p className="text-xs text-slate-600 dark:text-slate-400">
                    Cumpre-se sozinha: quando cada parte comunicada se manifestar pelo portal dentro do prazo, ou quando o prazo dela acabar sem manifestação (o sistema certifica o decurso nos autos).
                    A resposta fica &quot;Apresentada&quot;, &quot;Parcial&quot; ou &quot;Sem manifestação&quot; e pode guiar as condições e as saídas da fase.
                </p>
            </div>
        );
    }
    const c = r?.comunicacao || { especie: 'intimacao', dias: 0 };
    const opcoesEsp = especiesParaEscolher(listas.comunicacao, c);
    const setC = (patch) => {
        const n = { ...c, ...patch };
        Object.keys(n).forEach((k) => n[k] === undefined && delete n[k]);
        onChange({ ...r, comunicacao: n });
    };
    const polos = c.polos || [];
    const marcarPolo = (p, sim) => {
        const l = sim ? [...polos, p] : polos.filter((x) => x !== p);
        setC({ polos: l.length && l.length < POLOS.length ? l : undefined });
    };
    return (
        <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
                <NativeSelect id={`${id}-esp`} label="Espécie" value={c.especie} options={opcoesEsp.map(([e, nome]) => [e, nome])}
                    onChange={(v) => setC({ especie_nome: undefined, especie_m: undefined, ...camposDaEspecie(v, opcoesEsp), ...(v === 'ciencia' ? { dias: 0, contagem: undefined } : {}) })} />
                <div>
                    <Label htmlFor={`${id}-cd`}>Prazo de resposta (dias)</Label>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Input id={`${id}-cd`} type="number" min={0} max={3650} placeholder="Sem prazo" className="h-9 w-28" value={c.dias || ''} disabled={c.especie === 'ciencia'}
                            onChange={(e) => { const n = Number(e.target.value); setC(Number.isInteger(n) && n > 0 ? { dias: n } : { dias: 0, contagem: undefined }); }} />
                        {c.dias > 0 && (
                            <select aria-label="Contagem do prazo de resposta" value={c.contagem || ''} onChange={(e) => setC({ contagem: e.target.value || undefined })}
                                className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                                <option value="">dias úteis</option>
                                <option value="corridos">dias corridos</option>
                            </select>
                        )}
                    </div>
                </div>
            </div>
            <fieldset>
                <legend className="text-sm font-medium">A quem comunica</legend>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {POLOS.map(([p, nome]) => (
                        <label key={p} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={!polos.length || polos.includes(p)} onCheckedChange={(v) => marcarPolo(p, v === true)}
                                disabled={!!polos.length && polos.length === 1 && polos[0] === p} />
                            {nome}
                        </label>
                    ))}
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Todos marcados: todas as partes do processo. As partes retiradas nunca são comunicadas. Cada tipo de processo pode dar outro nome ao polo (Acusado no lugar de Requerido, por exemplo): aqui vale o polo, qualquer que seja o nome.</p>
            </fieldset>
            <div>
                <Label htmlFor={`${id}-ct`}>Texto proposto</Label>
                <Textarea id={`${id}-ct`} className="mt-1" rows={3} maxLength={2000} value={c.texto || ''} placeholder="Ex.: Fica Vossa Senhoria citada para apresentar defesa escrita no prazo indicado."
                    onChange={(e) => setC({ texto: e.target.value || undefined })} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
                Na tela do processo, a ação ganha o botão &quot;Expedir&quot;, que abre a comunicação já preenchida (quem expede ajusta). Ela se cumpre quando todas as partes previstas forem comunicadas,
                e volta a ficar por cumprir se uma comunicação for tornada sem efeito. Cada comunicação vira certidão nos autos e aviso no portal; o prazo conta da ciência.
            </p>
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
        mudar({ acoes: as, ...remapearCondicoes(f, origem, alinhadas) }, origem);
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
                            <span className="text-xs font-mono w-5 text-slate-500 dark:text-slate-400" aria-hidden>{i + 1}</span>
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
                        {aberto && !a.trim() && <p className="text-xs text-slate-600 dark:text-slate-400 pl-6">Escreva a ação para configurá-la.</p>}
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
        set({ grupo: alvo && alvo !== f.id ? alvo : undefined, ...(alvo && alvo !== f.id ? { titulo: undefined, abertura: undefined } : {}) });
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
            {grupo === f.id ? (
                <div>
                    <Label htmlFor={`${id}-cab`} className="inline-flex items-center gap-1">Frase de abertura</Label>
                    <Input id={`${id}-cab`} className="mt-1" value={f.certidao?.abertura || ''} maxLength={MAX_ABERTURA_CERTIDAO} placeholder={ABERTURA_CERTIDAO}
                        onChange={(e) => set({ abertura: e.target.value || undefined })} />
                    <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">Os itens vêm logo depois, numerados: "{aberturaCertidao(fases, grupo)} 1) …; 2) …".</span>
                </div>
            ) : aberturaCertidao(fases, grupo) !== ABERTURA_CERTIDAO && <p className="text-xs text-slate-600 dark:text-slate-400">Abre com: "{aberturaCertidao(fases, grupo)}"</p>}
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
