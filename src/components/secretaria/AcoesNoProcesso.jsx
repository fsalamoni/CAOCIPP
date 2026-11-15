import React, { useState } from 'react';
import { CheckCircle2, Circle, Send, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ROTULO_DESTINO, destinoDaAcao, partesVeem, pedidoDaAcao } from '@/lib/exigencias';
import { rotuloQuem, textoQuem } from '@/lib/permissoesFase';
import { dataHora } from './comum';
import SeletorRegistro from './SeletorRegistro';
import { CamposProcesso, DadosCampos } from './CamposProcesso';
import { faltando } from '@/lib/camposProcesso';
import { RESPOSTAS } from '@/lib/comunicacaoRito';
import { MAX_PARTICIPANTES, MODOS_AUDIENCIA, QUALIDADES } from '@/lib/audiencias';
import { FUNCOES, MAX_MEMBROS, SITUACOES, apurar, problemasDosVotos, textoDaApuracao } from '@/lib/julgamento';

const br = (iso) => (iso || '').slice(0, 10).split('-').reverse().join('/');

// Ações da fase na tela do processo (aba Andamento): cada uma do jeito que o
// rito pediu (caixa de marcar, um dado ou um documento), dizendo onde o
// cumprimento fica e quem vê. Quem decide é o servidor (marcarAcao).

const ONDE = { ...ROTULO_DESTINO, autos: 'certidão nos autos' };

/** Selos discretos do que o rito diz da ação. */
export function SelosAcao({ r }) {
    const dest = destinoDaAcao(r);
    const pede = pedidoDaAcao(r);
    const selos = [
        ...(pede !== 'documento' && dest !== 'evento' ? [ONDE[dest]] : []),
        ...(pede !== 'documento' && partesVeem(r) ? ['partes veem'] : []),
        ...(r?.obrigatoria ? ['obrigatória'] : r?.recomendada ? ['recomendada'] : []),
        ...(r?.quem ? [rotuloQuem(r.quem, r.atribuicao)] : []),
        ...(r?.ve === 'gestor' ? ['dado só para quem gere a unidade'] : []),
    ];
    if (!selos.length) return null;
    return <span className="text-xs text-slate-600 dark:text-slate-400"> · {selos.join(' · ')}</span>;
}

/**
 * Uma ação da fase. `info`: a informação registrada nesta rodada da fase (se a ação pede um dado).
 * `onMarcar(feita, valor)` chama o servidor.
 */
export function AcaoDaFase({ acao, r, feita, info, podeMexer, reservada, ocupado, nota, onMarcar, onRegistrar, onDesfazer, partes = [], comunicacao, espera, onExpedir }) {
    const pede = pedidoDaAcao(r);
    // Reservada pelo rito a outra pessoa: quem tem o processo vê por quê não pode cumprir.
    // `nota`: recado sobre a ação pendente (ex.: a alternativa já foi cumprida).
    const aviso = !feita && (reservada || nota) && (
        <span className="block text-xs text-slate-600 dark:text-slate-400">
            {reservada && (r?.quem === 'responsavel' ? 'Só o responsável designado cumpre esta ação (use "Atribuir" se for o caso).' : `Só ${textoQuem(r?.quem, r?.atribuicao)} cumpre esta ação.`)}
            {reservada && nota ? ' ' : ''}{nota}
        </span>
    );
    if (pede === 'confirmar') {
        return (
            <label className={`flex items-start gap-2 text-sm ${podeMexer ? 'cursor-pointer' : ''}`}>
                <input type="checkbox" className="mt-1" checked={feita} disabled={!podeMexer || ocupado}
                    onChange={(e) => onMarcar(e.target.checked)} />
                <span><span className={feita ? 'line-through text-slate-600' : ''}>{acao}</span><SelosAcao r={r} />
                    {r?.ajuda && !feita && <span className="block text-xs text-slate-600 dark:text-slate-400">{r.ajuda}</span>}{aviso}</span>
            </label>
        );
    }
    // Comunicar as partes: cumpre-se expedindo, pela própria ação, a todas as partes que ela alcança.
    if (pede === 'comunicacao') {
        const nomes = (l) => l.map((x) => partes[x]?.nome).filter(Boolean).join(', ');
        const { alvos = [], faltam = [] } = comunicacao || {};
        return (
            <div className="flex flex-wrap items-start gap-2 text-sm">
                {feita
                    ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden />
                    : <Circle className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" aria-hidden />}
                <span className="flex-1 min-w-[10rem]">
                    <span className={feita ? 'line-through text-slate-600' : ''}>{acao}</span><SelosAcao r={r} />
                    {r?.ajuda && !feita && <span className="block text-xs text-slate-600 dark:text-slate-400">{r.ajuda}</span>}
                    {aviso}
                    <span className="block text-xs text-slate-600 dark:text-slate-400">
                        {!alvos.length ? 'Nenhuma parte do processo está no polo que esta ação comunica.'
                            : `Comunicadas ${alvos.length - faltam.length} de ${alvos.length}${faltam.length ? `; falta: ${nomes(faltam)}` : ''}.`}
                    </span>
                </span>
                {podeMexer && faltam.length > 0 && <Button size="sm" variant="outline" className="gap-1" disabled={ocupado} onClick={onExpedir}><Send className="w-4 h-4" aria-hidden /> Expedir</Button>}
            </div>
        );
    }
    // Pede um dado: registra num diálogo; feita mostra o valor e permite desfazer.
    // Esperar a resposta: diz quem ainda pode responder e até quando.
    const situacaoEspera = pede === 'resposta' && !feita && espera && (
        <span className="block text-xs text-slate-600 dark:text-slate-400">
            {!espera.comunicacoes.length ? 'Aguarda a comunicação às partes.'
                : `${espera.apresentadas.length} de ${espera.comunicacoes.length} ${espera.comunicacoes.length > 1 ? 'responderam' : 'respondeu'}`
                + `${espera.pendentes.length ? `; no prazo: ${espera.pendentes.map((c) => `${c.parte_nome} (${c.vence_em ? `até ${br(c.vence_em)}` : 'aguarda ciência'})`).join(', ')}` : ''}.`
                + ' Cumpre-se sozinha com a manifestação pelo portal ou com o fim do prazo.'}
        </span>
    );
    return (
        <div className="flex flex-wrap items-start gap-2 text-sm">
            {feita
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden />
                : <Circle className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" aria-hidden />}
            <span className="flex-1 min-w-[10rem]">
                <span className={feita ? 'line-through text-slate-600' : ''}>{acao}</span><SelosAcao r={r} />
                {r?.ajuda && !feita && <span className="block text-xs text-slate-600 dark:text-slate-400">{r.ajuda}</span>}
                {aviso}{situacaoEspera}
                {feita && info?.oculta ? (
                    <span className="block text-slate-800 dark:text-slate-200">
                        {info.rotulo}: <i className="text-slate-600 dark:text-slate-400">reservado a quem gere a unidade</i>
                        <span className="text-xs text-slate-600 dark:text-slate-400"> · {info.por}, {dataHora(info.em)}</span>
                    </span>
                ) : feita && info && info.tipo === 'formulario' && Array.isArray(info.valor) ? (
                    <span className="block mt-1 rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1.5">
                        <DadosCampos campos={info.valor} />
                        <span className="block text-xs text-slate-600 dark:text-slate-400 mt-1">{info.por}, {dataHora(info.em)}</span>
                    </span>
                ) : feita && info && (
                    <span className="block text-slate-800 dark:text-slate-200">
                        {info.rotulo}: <b className="whitespace-pre-wrap break-words">{info.valor_texto}</b>
                        <span className="text-xs text-slate-600 dark:text-slate-400"> · {info.por}, {dataHora(info.em)}</span>
                    </span>
                )}
            </span>
            {podeMexer && !feita && <Button size="sm" variant="outline" disabled={ocupado} onClick={onRegistrar}>{pede === 'audiencia' ? 'Designar' : pede === 'julgamento' ? 'Registrar julgamento' : 'Registrar'}</Button>}
            {podeMexer && feita && <Button size="sm" variant="ghost" className="gap-1" disabled={ocupado} onClick={onDesfazer}><Undo2 className="w-4 h-4" /> Desfazer</Button>}
        </div>
    );
}

/** Data, hora, modo, local ou link e participantes da audiência (conferidos de novo no servidor). */
function CamposAudiencia({ a, onChange }) {
    const sel = 'mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const parts = a.participantes || [];
    const setP = (k, x) => onChange({ participantes: parts.map((p, j) => (j === k ? { ...p, ...x } : p)) });
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <div><Label htmlFor="aud-data">Data</Label><Input id="aud-data" type="date" min={hoje} className="mt-1" value={a.data || ''} onChange={(e) => onChange({ data: e.target.value })} autoFocus /></div>
                <div><Label htmlFor="aud-hora">Hora</Label><Input id="aud-hora" type="time" className="mt-1" value={a.hora || ''} onChange={(e) => onChange({ hora: e.target.value })} /></div>
            </div>
            <div>
                <Label htmlFor="aud-modo">Modo</Label>
                <select id="aud-modo" className={sel} value={a.modo} onChange={(e) => onChange({ modo: e.target.value })}>
                    {MODOS_AUDIENCIA.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
            </div>
            {a.modo !== 'virtual' && <div><Label htmlFor="aud-local">Local</Label><Input id="aud-local" className="mt-1" maxLength={200} value={a.local || ''} placeholder="Ex.: Sala de audiências, 3º andar" onChange={(e) => onChange({ local: e.target.value })} /></div>}
            {a.modo !== 'presencial' && <div><Label htmlFor="aud-link">Link ou sala virtual</Label><Input id="aud-link" className="mt-1" maxLength={300} value={a.link || ''} placeholder="Ex.: https://..." onChange={(e) => onChange({ link: e.target.value })} /></div>}
            <fieldset>
                <legend className="text-sm font-medium">Participam, além das partes (opcional)</legend>
                <div className="mt-1 space-y-2">
                    {parts.map((p, k) => (
                        <div key={k} className="flex gap-2">
                            <Input aria-label={`Nome do participante ${k + 1}`} placeholder="Nome" maxLength={120} value={p.nome} onChange={(e) => setP(k, { nome: e.target.value })} />
                            <select aria-label={`Qualidade do participante ${k + 1}`} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900" value={p.qualidade} onChange={(e) => setP(k, { qualidade: e.target.value })}>
                                {QUALIDADES.map(([q, n]) => <option key={q} value={q}>{n}</option>)}
                            </select>
                            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ participantes: parts.filter((_, j) => j !== k) })}>Tirar</Button>
                        </div>
                    ))}
                    {parts.length < MAX_PARTICIPANTES && (
                        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ participantes: [...parts, { nome: '', qualidade: 'testemunha' }] })}>Incluir participante</Button>
                    )}
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Testemunhas, peritos e outros não têm conta no portal: o nome sai na certidão, e o órgão os convoca pelo meio que usa.</p>
            </fieldset>
        </div>
    );
}

const hojeBr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const MEMBRO_VAZIO = { nome: '', funcao: 'membro', voto: '' };

/** Sessão e votos do julgamento colegiado: a apuração aparece enquanto se preenche; o servidor apura de novo. */
function CamposJulgamento({ cfg, j, onChange }) {
    const sel = 'h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';
    const vs = j.votos;
    const setV = (k, x) => onChange({ votos: vs.map((v, n) => (n === k ? { ...v, ...x } : v)) });
    const preenchidos = vs.filter((v) => v.nome.trim());
    const problemas = problemasDosVotos(cfg, vs);
    const a = !problemas.length && preenchidos.length ? apurar(cfg, preenchidos) : null;
    return (
        <div className="space-y-3">
            <div className="sm:max-w-[12rem]">
                <Label htmlFor="jul-data">Data da sessão</Label>
                <Input id="jul-data" type="date" max={hojeBr()} className="mt-1" value={j.data || ''} onChange={(e) => onChange({ data: e.target.value })} />
            </div>
            <fieldset>
                <legend className="text-sm font-medium">Membros e votos</legend>
                <div className="mt-1 space-y-2">
                    {vs.map((v, k) => (
                        <div key={k} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[1fr_8rem_10rem_auto] gap-2 items-center">
                            <Input aria-label={`Nome do membro ${k + 1}`} placeholder="Nome" maxLength={120} value={v.nome} onChange={(e) => setV(k, { nome: e.target.value })} className="col-span-2 sm:col-span-1" />
                            <Button type="button" variant="ghost" size="sm" className="sm:order-last" aria-label={`Tirar o membro ${k + 1}`} disabled={vs.length <= 1} onClick={() => onChange({ votos: vs.filter((_, n) => n !== k) })}>Tirar</Button>
                            <select aria-label={`Função do membro ${k + 1}`} className={sel} value={v.funcao} onChange={(e) => setV(k, { funcao: e.target.value })}>
                                {FUNCOES.map(([f, n]) => <option key={f} value={f}>{n}</option>)}
                            </select>
                            <select aria-label={`Voto do membro ${k + 1}`} className={`${sel} col-span-2 sm:col-span-1`} value={v.voto} onChange={(e) => setV(k, { voto: e.target.value })}>
                                <option value="">Voto…</option>
                                <optgroup label="Vota">{cfg.resultados.map((o) => <option key={o} value={o}>{o}</option>)}</optgroup>
                                <optgroup label="Não vota">{SITUACOES.map(([s, n]) => <option key={s} value={s}>{n}</option>)}</optgroup>
                            </select>
                        </div>
                    ))}
                    {vs.length < MAX_MEMBROS && (
                        <Button type="button" variant="outline" size="sm" onClick={() => onChange({ votos: [...vs, MEMBRO_VAZIO] })}>Incluir membro</Button>
                    )}
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Impedido, suspeito, ausente e abstenção saem na certidão e não contam como voto.
                    {cfg.quorum > 1 ? ` O rito exige ao menos ${cfg.quorum} votos válidos.` : ''}
                    {cfg.desempate === 'favoravel' ? ` No empate, prevalece ${cfg.favoravel}.` : ' No empate, vale o voto do presidente.'}
                </p>
            </fieldset>
            <div role="status" className={`rounded-md px-2 py-1.5 text-sm ${a ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100' : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                {a ? <>Resultado: <b>{textoDaApuracao(a)}</b></> : preenchidos.length ? <ul className="list-disc pl-5">{problemas.map((p) => <li key={p}>{p}</li>)}</ul> : 'Informe os membros e os votos para ver a apuração.'}
            </div>
        </div>
    );
}

/** Diálogo para informar o dado que a ação pede. */
export function RegistrarAcao({ alvo, ocupado, onFechar, onEnviar }) {
    const [valor, setValor] = useState('');
    const [tentou, setTentou] = useState(false);
    if (!alvo) return null;
    const { acao, r, fase } = alvo;
    const pede = pedidoDaAcao(r);
    const dest = destinoDaAcao(r);
    const rotulo = r?.rotulo || acao;
    // Formulário: vários campos de uma vez, conferidos como os do tipo de processo.
    const form = pede === 'formulario' ? { campos: r?.campos || [] } : null;
    const valores = form && valor && typeof valor === 'object' ? valor : {};
    const falta = form ? faltando(form, { campos: valores }) : [];
    const algum = Object.values(valores).some((x) => (Array.isArray(x) ? x.length : x && typeof x === 'object' ? true : String(x ?? '').trim()));
    const aud = pede === 'audiencia' ? { modo: 'presencial', participantes: [], ...(valor && typeof valor === 'object' ? valor : {}) } : null;
    // Unidade de colegiado com composição: os membros do dia já vêm na lista (quem registra indica o relator).
    const doColegiado = alvo.membros?.length ? alvo.membros : null;
    // Proclamado na sessão de julgamento: valem a data e os votos da sessão (o servidor confere).
    const procl = pede === 'julgamento' ? alvo.proclamado : null;
    const jul = procl ? { data: procl.data, votos: procl.votos }
        : pede === 'julgamento' ? { data: hojeBr(), votos: doColegiado || [{ ...MEMBRO_VAZIO, funcao: 'relator' }, MEMBRO_VAZIO, MEMBRO_VAZIO], ...(valor && typeof valor === 'object' ? valor : {}) } : null;
    const vazio = jul ? !jul.data || problemasDosVotos(r.julgamento, jul.votos).length > 0 : aud ? !aud.data || !aud.hora || (aud.modo !== 'virtual' && !aud.local?.trim()) || (aud.modo !== 'presencial' && !aud.link?.trim())
        : form ? !algum : pede === 'sim_nao' ? valor === '' : !String(valor).trim();
    const fechar = () => { setValor(''); setTentou(false); onFechar(); };
    const onde = pede === 'julgamento'
        ? 'O sistema apura os votos. O resultado decide a saída da fase, e a certidão de julgamento (resultado, placar, relator, vencidos, impedidos e ausentes) vai aos autos, com folha; as partes a veem no portal. Os fundamentos ficam nos documentos da fase.'
        : pede === 'audiencia'
        ? 'A designação vira certidão nos autos, com folha, e as partes a veem no portal. Para intimá-las, use a ação de comunicação do rito: {audiencia} no texto vira esta data e local.'
        : pede === 'resposta'
        ? 'Registre só quando a manifestação chegou por outro meio (a equipe junta a peça). Com parte ainda no prazo, só "Apresentada" é aceita; o resto o sistema registra sozinho.'
        : dest === 'autos'
        ? 'Vira certidão nos autos, com folha, e sai na impressão.'
        : dest === 'evento'
            ? 'Fica nas informações do processo e como evento no extrato ao fim da impressão, sem folha.'
            : dest === 'nenhum'
                ? 'Não gera evento: fica só nas informações do processo, para a equipe.'
                : dest === 'consolidar'
                    ? 'Entra como item da certidão conjunta da fase, emitida nos autos quando o processo sair da fase (ou do grupo de fases).'
                : 'Fica só nas informações do processo e na aba Eventos, para controle. Não sai em impressão.';
    const quem = pede === 'audiencia' || pede === 'julgamento' ? '' : partesVeem(r) ? 'As partes também veem no portal.' : 'Só a equipe vê.';
    let campo;
    if (procl) {
        campo = (
            <div className="rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-900 dark:text-emerald-100 space-y-1">
                <p className="font-semibold">Proclamado na sessão: {procl.resultado}</p>
                <p>{procl.texto}.</p>
                <p className="text-xs">Por {procl.por_nome}. O registro usa a data e os votos da sessão; não se digitam de novo.</p>
            </div>
        );
    } else if (jul) campo = <CamposJulgamento cfg={r.julgamento} j={jul} onChange={(x) => setValor({ ...jul, ...x })} />;
    else if (aud) campo = <CamposAudiencia a={aud} onChange={(x) => setValor({ ...aud, ...x })} />;
    else if (form) campo = <CamposProcesso prefixo="acao-f" campos={form.campos} valores={valores} onChange={(id, x) => setValor({ ...valores, [id]: x })} />;
    else if (pede === 'texto_longo') campo = <Textarea id="acao-valor" rows={4} maxLength={4000} value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />;
    else if (pede === 'numero') campo = <Input id="acao-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 12345" autoFocus />;
    else if (pede === 'data') campo = <Input id="acao-valor" type="date" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />;
    else if (pede === 'registro') campo = <SeletorRegistro id="acao-valor" aria-describedby={r?.ajuda ? 'acao-ajuda' : undefined} modulo={r.modulo} pagina={r.pagina} value={valor} onChange={setValor} autoFocus />;
    else if (pede === 'lista' || pede === 'sim_nao' || pede === 'resposta') {
        const opcoes = pede === 'lista' ? (r.opcoes || []).map((o) => [o, o]) : pede === 'resposta' ? RESPOSTAS.map((o) => [o, o]) : [['sim', 'Sim'], ['nao', 'Não']];
        campo = (
            <select id="acao-valor" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                <option value="">Escolha…</option>
                {opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
        );
    } else campo = <Input id="acao-valor" maxLength={200} value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />;
    return (
        <Dialog open onOpenChange={(o) => !o && fechar()}>
            <DialogContent className={`${form || jul ? 'max-w-2xl' : 'max-w-lg'} max-h-[90dvh] overflow-y-auto`}>
                <DialogHeader>
                    <DialogTitle>{acao}</DialogTitle>
                    <DialogDescription>Fase {fase}. {onde} {quem}</DialogDescription>
                </DialogHeader>
                <form className="space-y-2" onSubmit={(e) => {
                    e.preventDefault();
                    if (falta.length) { setTentou(true); return; }
                    if (!vazio) onEnviar(form ? valores : jul ? { data: jul.data, votos: jul.votos.filter((x) => x.nome.trim()) } : aud ? { ...aud, participantes: aud.participantes.filter((x) => x.nome.trim()) } : valor).then((ok) => ok && (setValor(''), setTentou(false)));
                }}>
                    {form || aud || jul ? <p className="text-sm font-medium">{aud ? 'Quando e onde' : jul ? 'Sessão de julgamento' : rotulo}</p> : <Label htmlFor="acao-valor">{rotulo}</Label>}
                    {r?.ajuda && form && <p id="acao-ajuda" className="text-xs text-slate-600 dark:text-slate-400">{r.ajuda}</p>}
                    {jul && !procl && doColegiado && <p className="text-xs text-slate-600 dark:text-slate-400">Os membros vieram da composição de hoje do colegiado. Indique o relator e ajuste quem faltou, foi substituído pelo suplente ou se declarou impedido.</p>}
                    {campo}
                    {r?.ajuda && !form && <p id="acao-ajuda" className="text-xs text-slate-600 dark:text-slate-400">{r.ajuda}</p>}
                    {tentou && falta.length > 0 && (
                        <ul role="alert" className="text-sm text-red-700 dark:text-red-300 list-disc pl-5">{falta.map((x) => <li key={x}>{x}</li>)}</ul>
                    )}
                    <DialogFooter className="pt-2">
                        <Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button>
                        <Button type="submit" disabled={ocupado || vazio}>Registrar</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
