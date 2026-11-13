import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Eye, FilePen, Info, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { etapasAteOFim, seguintes } from '@/lib/secretariaRito';
import FluxoRito from './FluxoRito';
import { NativeSelect } from './comum';
import { OUTROS_ATOS, ROTULO_DESTINO, destinoDaAcao, destinoDaMudanca, destinoDoAto, destinoTransicao, grupoDe, niveisDaFase, partesVeem, pedidoDaAcao, resumoDaAcao, saidasDaFase, tituloCertidao, acaoAtiva, camposDeEscolha, opcoesDaResposta, saidasComCondicao, soOrienta, textoCondicao } from '@/lib/exigencias';

/** Rascunho do editor de rito (unidade_ref, modelos_ref) no formato do rito gravado. */
const doRascunho = (r) => ({
    ...r,
    id: r.id || '_rascunho',
    // No editor valem os campos _ref (o `modelos` de uma proposta importada traz nomes, não ids).
    fases: (r.fases || []).filter((f) => f.nome?.trim()).map((f) => ({ ...f, unidade_id: f.unidade_ref !== undefined ? f.unidade_ref : f.unidade_id, modelos: f.modelos_ref ?? f.modelos ?? [] })),
});

/** Onde cada ato da fase fica nos autos: termo/certidão com folha, extrato, só na tela ou oculto. */
function comoFica(d) {
    if (d === 'autos') return { onde: 'Fl. –', cor: 'text-indigo-700 dark:text-indigo-300' };
    if (d === 'evento') return { onde: 'Extrato:', cor: 'text-slate-700 dark:text-slate-300' };
    if (d === 'informacao') return { onde: 'Só na tela:', cor: 'text-slate-600 dark:text-slate-400' };
    if (d === 'consolidar') return { onde: 'Na certidão:', cor: 'text-indigo-700 dark:text-indigo-300' };
    return { onde: 'Oculto:', cor: 'text-slate-500 dark:text-slate-500' };
}

function ItemAutos({ d, children, nota }) {
    const c = comoFica(d);
    return (
        <li className="text-sm">
            <span className={`font-mono text-xs mr-1.5 ${c.cor}`}>{c.onde}</span>{children}
            {nota && <span className="block text-xs text-slate-600 dark:text-slate-400 pl-1">{nota}</span>}
        </li>
    );
}

/**
 * "Ver como a equipe" e "Ver como a parte": prévia, sem gravar nada, do que
 * cada um vê num processo de exemplo autuado com o rito escolhido, e de como
 * cada ato da fase fica nos autos. `rascunho`: o rito ainda não salvo do
 * editor (a prévia mostra ele em vez dos ritos gravados).
 */
export default function PreviaRito({ estado, rascunho = null, rotuloBotao = 'Ver como a equipe e a parte' }) {
    const ritos = rascunho ? [doRascunho(rascunho)] : (estado.ritos || []).filter((r) => r.ativo);
    const [aberto, setAberto] = useState(false);
    const [ritoId, setRitoId] = useState('');
    const [faseId, setFaseIdBruto] = useState('');
    // Simulação: respostas dadas às ações de escolha da fase mostrada (zeram ao trocar de fase, como no processo).
    const [sim, setSim] = useState({});
    const setFaseId = (v) => { setFaseIdBruto(v); setSim({}); };
    const rito = ritos.find((r) => r.id === ritoId) || ritos[0];
    const fases = rito?.fases || [];
    const i = Math.max(0, fases.findIndex((f) => f.id === faseId));
    const fase = fases[i];
    const nomeUnidade = (id) => estado.unidades.find((u) => u.id === id)?.nome || rascunho?.unidades?.find((u) => u.ref === id)?.nome || '';
    const nomeModelo = (id) => (estado.modelos || []).find((m) => m.id === id)?.nome || rascunho?.modelos?.find((m) => m.ref === id)?.nome || 'modelo excluído';
    const prox = fase ? seguintes(fases, i).map((id) => fases.find((f) => f.id === id)).filter(Boolean) : [];
    const saidas = fase && prox.length ? saidasComCondicao(fases, fase, sim).filter((s) => prox.some((p) => p.id === s.fase.id)) : [];
    const indicadas = saidas.filter((s) => s.indicada);
    let principal = null;
    if (fase) {
        if (prox.length === 0) principal = { rotulo: 'Fase final: arquivar', icone: CheckCircle2 };
        else if (prox.length === 1) {
            const outra = prox[0].unidade_id && prox[0].unidade_id !== fase.unidade_id;
            // Saída única com regra pela resposta: sem a resposta, o processo pede motivo para seguir.
            const motivo = saidas[0]?.contra ? ' (sem a resposta indicada: pede motivo)' : '';
            principal = outra ? { rotulo: `Concluir e enviar para ${nomeUnidade(prox[0].unidade_id)}${motivo}`, icone: Send } : { rotulo: `Concluir e seguir para ${prox[0].nome}${motivo}`, icone: CheckCircle2 };
        } else if (indicadas.length === 1) principal = { rotulo: `Concluir e seguir para ${indicadas[0].fase.nome} (indicada pela resposta)`, icone: CheckCircle2 };
        else principal = { rotulo: 'Seguir para a próxima fase…', icone: CheckCircle2 };
    }
    const faltam = fase ? etapasAteOFim(fases, fase.id) : null;
    const tipo = (estado.tipos || []).find((t) => t.rito_id === rito?.id);
    const niveis = niveisDaFase(fase);
    // De onde o processo chega a esta fase: as fases que seguem para ela (a primeira também recebe a autuação).
    const primeira = fase?.id === fases[0]?.id;
    const anteriores = fase ? fases.filter((x) => x.id !== fase.id && saidasDaFase(fases, x).some((s) => s.id === fase.id)) : [];
    const entrada = (x) => destinoTransicao(niveisDaFase(x).fase, niveis.fase);
    const acoes = (fase?.acoes || []).map((a, k) => ({ a, k, r: fase.acoes_regras?.[k] || null })).filter((x) => x.a?.trim());

    // O que a parte vê desta fase, tirado das regras do rito.
    const acoesPartes = acoes.filter((x) => partesVeem(x.r));
    const camposPartes = (tipo?.formulario?.campos || []).filter((c) => c.visivel_partes);
    const docsAutos = [...(fase?.documentos || []).filter((d) => !d.destino).map((d) => d.descricao),
        ...acoes.filter((x) => pedidoDaAcao(x.r) === 'documento' && destinoDaAcao(x.r) === 'autos').map((x) => x.a)];
    const entradaAutos = primeira || anteriores.some((x) => entrada(x) === 'autos');
    const remessasAutos = niveis.remessas === 'autos';
    const nadaParaParte = !acoesPartes.length && !docsAutos.length && !entradaAutos && !remessasAutos;

    return (
        <>
            <Button variant="outline" className="gap-2" disabled={!ritos.length || !fases.length} onClick={() => setAberto(true)}
                title={!ritos.length ? 'Crie um rito ativo primeiro' : !fases.length ? 'Dê nome a uma fase primeiro' : undefined}>
                <Eye className="w-4 h-4" aria-hidden /> {rotuloBotao}
            </Button>
            <Dialog open={aberto} onOpenChange={setAberto}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>Prévia de um processo de exemplo</DialogTitle>
                        <DialogDescription>
                            {rascunho ? 'Nada é gravado. Mostra o rito como está agora no editor, antes de salvar.' : 'Nada é gravado. Escolha o rito e a fase para ver o que a equipe e a parte veriam num processo autuado assim.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {!rascunho && <NativeSelect id="pv-rito" label="Rito" value={rito?.id || ''} onChange={(v) => { setRitoId(v); setFaseId(''); }} options={ritos.map((r) => [r.id, r.nome])} />}
                        <NativeSelect id="pv-fase" label="Fase" value={fase?.id || ''} onChange={setFaseId} options={fases.map((f) => [f.id, f.nome])} />
                    </div>
                    {fase && (
                        <Tabs defaultValue="equipe">
                            <TabsList className="flex-wrap h-auto">
                                <TabsTrigger value="equipe">Como a equipe vê</TabsTrigger>
                                <TabsTrigger value="parte">Como a parte vê</TabsTrigger>
                                <TabsTrigger value="autos">Como fica nos autos</TabsTrigger>
                            </TabsList>
                            <TabsContent value="equipe" className="space-y-3">
                                <h3 className="text-lg font-semibold"><span className="font-mono">000001/{new Date().getFullYear()}</span> · Processo de exemplo{tipo ? <span className="text-sm font-normal text-slate-600 dark:text-slate-400"> · {tipo.nome}</span> : ''}</h3>
                                <div className="rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 p-3 space-y-2">
                                    <p className="text-sm font-semibold">Nesta fase: {fase.nome}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-300">
                                        {fase.unidade_id ? `Corre em ${nomeUnidade(fase.unidade_id)}` : 'Corre na unidade que estiver com o processo'}{fase.agente ? ` · quem faz: ${fase.agente}` : ''}{fase.prazo_dias ? ` · prazo da fase: ${fase.prazo_dias} dias${fase.prazo_auto ? ` ${fase.prazo_contagem === 'corridos' ? 'corridos' : 'úteis'}, aberto sozinho ao entrar` : ''}` : ''}
                                    </p>
                                    {(fase.ao_entrar?.urgente || fase.ao_entrar?.sem_responsavel) && (
                                        <p className="text-xs text-slate-600 dark:text-slate-300">Ao entrar: {[fase.ao_entrar.urgente && 'o processo fica urgente', fase.ao_entrar.sem_responsavel && 'sai o responsável designado'].filter(Boolean).join(' e ')}.</p>
                                    )}
                                    {fase.orientacao && <p className="text-sm text-slate-700 dark:text-slate-200">{fase.orientacao}</p>}
                                    {acoes.length > 0 && (
                                        <ul className="space-y-1.5">{acoes.map(({ a, k, r }) => {
                                            const ativa = acaoAtiva(fase, k, sim);
                                            const ops = opcoesDaResposta(r);
                                            // O que se simula: a resposta da ação, ou cada campo de escolha do formulário dela.
                                            const simulaveis = ops ? [{ chave: String(k), rotulo: 'Simular resposta', ops }]
                                                : camposDeEscolha(r).filter((c) => c.id).map((c) => ({ chave: `${k}.${c.id}`, rotulo: `Simular "${c.rotulo || 'campo'}"`, ops: opcoesDaResposta(r, c.id) || [] }));
                                            return (
                                                <li key={k} className={`flex items-start gap-2 text-sm ${ativa ? '' : 'text-slate-600 dark:text-slate-400'}`}>
                                                    {soOrienta(r) ? <Info className="w-4 h-4 mt-0.5 shrink-0 text-indigo-700 dark:text-indigo-300" aria-hidden /> : <Checkbox disabled aria-label={a} className="mt-0.5" />}
                                                    <div className="min-w-0 flex-1">
                                                        <span>{a} <span className="text-xs text-slate-600 dark:text-slate-400">· {soOrienta(r) ? '' : 'pede '}{resumoDaAcao(r)}{ativa ? '' : ` · vale só se ${textoCondicao(fase, r.se)}`}</span></span>
                                                        {ativa && simulaveis.map((s) => (
                                                            <label key={s.chave} className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-700 dark:text-slate-300">{s.rotulo}:
                                                                <select value={sim[s.chave] ?? ''} onChange={(e) => setSim((x) => { const n = { ...x }; if (e.target.value) n[s.chave] = e.target.value; else delete n[s.chave]; return n; })}
                                                                    className="h-11 sm:h-8 w-full sm:w-auto max-w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                                                                    <option value="">(sem resposta)</option>
                                                                    {s.ops.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                                                </select>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </li>
                                            );
                                        })}</ul>
                                    )}
                                    {(fase.documentos || []).length > 0 && <p className="text-sm">Documentos da fase: {fase.documentos.map((d) => `${d.descricao}${d.nivel === 'recomendado' ? ' (recomendado)' : d.nivel === 'opcional' ? ' (opcional)' : ''}`).join('; ')}</p>}
                                    {(niveis.fase !== 'autos' || niveis.remessas !== 'autos') && (
                                        <p className="text-xs text-slate-600 dark:text-slate-300">
                                            {prox.length ? `Mudança para ${prox.map((x) => `${x.nome}: ${ROTULO_DESTINO[destinoTransicao(niveis.fase, niveisDaFase(x).fase)]}`).join('; para ')}. ` : ''}Remessas durante a fase: {ROTULO_DESTINO[niveis.remessas]}.
                                        </p>
                                    )}
                                    {(fase.modelos || []).length > 0 && (
                                        <div className="flex flex-wrap gap-2">{fase.modelos.map((m) => <Button key={m} size="sm" variant="outline" className="gap-1 pointer-events-none"><FilePen className="w-3.5 h-3.5" aria-hidden /> Redigir {nomeModelo(m)}</Button>)}</div>
                                    )}
                                    {principal && <Button className="gap-2 pointer-events-none" aria-disabled><principal.icone className="w-4 h-4" aria-hidden /> {principal.rotulo}</Button>}
                                    {(prox.length > 1 || fase.condicoes_regra?.[prox[0]?.id]) && <p className="text-xs text-slate-600 dark:text-slate-300">{prox.length > 1 ? 'Alternativas' : 'Saída'}: {prox.map((f) => {
                                        const c = fase.condicoes_regra?.[f.id];
                                        const s = saidas.find((x) => x.fase.id === f.id);
                                        const extra = [fase.condicoes?.[f.id], c ? `quando ${textoCondicao(fase, c)}` : null].filter(Boolean).join('; ');
                                        return `${f.nome}${extra ? ` (${extra})` : ''}${s?.indicada ? ' [indicada]' : s?.contra ? ' [pede motivo]' : ''}`;
                                    }).join(' · ')}</p>}
                                    {prox.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-2 border-t border-indigo-200/70 dark:border-indigo-900 pt-2">
                                            <span className="text-xs text-slate-600 dark:text-slate-300">Simular o andamento:</span>
                                            {prox.map((p) => (
                                                <Button key={p.id} size="sm" variant={saidas.find((s) => s.fase.id === p.id)?.indicada ? 'default' : 'outline'} className="gap-1" onClick={() => setFaseId(p.id)}>
                                                    Ir para {p.nome} <ArrowRight className="w-3.5 h-3.5" aria-hidden />
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <FluxoRito acoes fases={fases} atual={fase.id} unidades={estado.unidades} />
                            </TabsContent>
                            <TabsContent value="parte" className="space-y-3">
                                <div className="rounded-lg border p-3 space-y-2">
                                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm">000001/{new Date().getFullYear()}</span> <Badge>{fase.nome_publico || fase.nome}</Badge> <Badge variant="secondary">Em tramitação</Badge></div>
                                    <p className="text-sm text-slate-700 dark:text-slate-200">Você fez o pedido (requerente) · em: {fase.nome_publico || fase.nome}</p>
                                    <p className="text-sm font-medium">{faltam === 0 ? 'Esta é a última etapa.' : faltam != null ? `Faltam ${faltam} etapa${faltam > 1 ? 's' : ''} até o fim.` : 'Em andamento.'}</p>
                                </div>
                                <div className="rounded-lg border p-3 space-y-1.5 text-sm">
                                    <p className="font-semibold">O que a parte vê desta fase</p>
                                    {nadaParaParte ? <p className="text-slate-600 dark:text-slate-400">Nada desta fase aparece para a parte, além do nome da fase.</p> : (
                                        <ul className="list-disc pl-5 space-y-1">
                                            {entradaAutos && <li>{primeira ? 'O termo de autuação' : 'O termo de mudança para esta fase'}, nos autos{!primeira && anteriores.some((x) => entrada(x) !== 'autos') ? ` (vindo de ${anteriores.filter((x) => entrada(x) === 'autos').map((x) => x.nome).join(' ou ')})` : ''}.</li>}
                                            {remessasAutos && <li>As remessas entre unidades durante a fase, com o nome das unidades, nos autos.</li>}
                                            {acoesPartes.map(({ a, k, r }) => (
                                                <li key={k}>{a}: {destinoDaAcao(r) === 'autos' ? 'a certidão nos autos' : destinoDaAcao(r) === 'consolidar' ? 'um item da certidão conjunta, nos autos' : 'o dado informado, nas informações do processo'}{pedidoDaAcao(r) !== 'confirmar' ? ` (${r?.rotulo || a})` : ''}.</li>
                                            ))}
                                            {docsAutos.map((d, k) => <li key={`doc${k}`}>{d}: o documento juntado, se quem juntar liberar para as partes.</li>)}
                                        </ul>
                                    )}
                                    {camposPartes.length > 0 && <p className="text-xs text-slate-600 dark:text-slate-400">Dados do processo que a parte vê: {camposPartes.map((c) => c.rotulo).join(', ')}.</p>}
                                    <p className="text-xs text-slate-600 dark:text-slate-400">A parte nunca vê orientações internas, condições nem o que o rito deixou fora do portal. Unidades, só pelo nome, nos termos de remessa que vão aos autos.</p>
                                </div>
                                <FluxoRito fases={fases.map((f) => ({ id: f.id, nome: f.nome_publico || f.nome, proximas: f.proximas, final: f.final }))} atual={fase.id} />
                            </TabsContent>
                            <TabsContent value="autos" className="space-y-3">
                                <div className="rounded-lg border p-3 space-y-2">
                                    <p className="text-sm font-semibold">Como cada ato desta fase fica registrado</p>
                                    <ul className="space-y-1.5">
                                        {primeira && <ItemAutos d="autos">Termo de autuação</ItemAutos>}
                                        {anteriores.map((x) => <ItemAutos key={`de${x.id}`} d={destinoDaMudanca(fases, x, fase)}>Mudança de {x.nome} para {fase.nome}</ItemAutos>)}
                                        {acoes.map(({ a, k, r }) => {
                                            const d = destinoDaAcao(r);
                                            const doc = pedidoDaAcao(r) === 'documento';
                                            return (
                                                <ItemAutos key={k} d={d} nota={!doc && d === 'autos' ? 'Desfazer gera nova certidão, de desfazimento.' : null}>
                                                    {doc ? (d === 'autos' ? `${a} (documento juntado)` : `${a} (documento guardado fora dos autos)`)
                                                        : d === 'autos' ? `Certidão de cumprimento: ${a}` : `Feita a ação "${a}"`}
                                                </ItemAutos>
                                            );
                                        })}
                                        {acoes.some(({ r }) => destinoDaAcao(r) === 'consolidar') && (
                                            <ItemAutos d="autos" nota="Sai quando o processo deixa a fase (ou o grupo de fases), é arquivado ou alguém pede para emitir.">
                                                {tituloCertidao(fases, grupoDe(fases, fase))}, reunindo os itens "Na certidão"
                                            </ItemAutos>
                                        )}
                                        {(fase.documentos || []).map((d, k) => <ItemAutos key={`d${k}`} d={d.destino || 'autos'}>{d.descricao}{d.destino ? ' (guardado fora dos autos)' : ' (documento juntado)'}</ItemAutos>)}
                                        <ItemAutos d={niveis.remessas}>Remessa entre unidades durante a fase</ItemAutos>
                                        {OUTROS_ATOS.map(([a, rotulo]) => <ItemAutos key={a} d={destinoDoAto(fase, a)}>{rotulo}</ItemAutos>)}
                                        {prox.map((p) => <ItemAutos key={p.id} d={destinoDaMudanca(fases, fase, p)}>Mudança para {p.nome}</ItemAutos>)}
                                    </ul>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">
                                        Fl.: termo ou certidão com folha, que sai no PDF dos autos. Extrato: sai ao fim do PDF, sem folha. Só na tela: aba Eventos e informações, não imprime.
                                        Oculto: sem evento, só no registro de auditoria. Remessa entre órgãos e dispensa de exigência vão sempre aos autos.
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
