import React, { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import { CalendarPlus, CheckCircle2, FileSignature, Gavel, Loader2, Pencil, Printer, RefreshCw, ScrollText, UserCheck, X } from 'lucide-react';
import { db } from '@/config/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PAPEL_ATA, SITUACAO_ITEM, icsDaSessao, quandoSessao } from '@/lib/sessoes';
import AjudaTermo from './AjudaTermo';

/**
 * Etapa S8: painel ao vivo, agenda (.ics), presença e ata da sessão.
 * O painel (secPaineis/{sessao}) é escrito só pelo servidor, com o que todos os
 * leitores podem ver; a tela escuta e recarrega quando a versão muda.
 */

/** Escuta o painel; `aoMudar` roda a cada mudança depois da primeira leitura. */
export function usePainelSessao(id, aoMudar) {
    const [painel, setPainel] = useState(null);
    const ultima = useRef(null);
    const cb = useRef(aoMudar);
    cb.current = aoMudar;
    useEffect(() => {
        if (!id) return undefined;
        ultima.current = null;
        return onSnapshot(doc(db, 'secPaineis', id), (snap) => {
            const d = snap.data() || null;
            setPainel(d);
            if (d && ultima.current !== null && d.versao !== ultima.current) cb.current?.();
            if (d) ultima.current = d.versao;
        }, () => setPainel(null));
    }, [id]);
    return painel;
}

/** Baixa o arquivo de agenda (.ics) da sessão, para o Google Agenda, Outlook ou o calendário do celular. */
export function BotaoAgenda({ s, colegiado = '', className = '' }) {
    const baixar = () => {
        const blob = new Blob([icsDaSessao(s, { colegiado, url: window.location.href })], { type: 'text/calendar;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        // Nome sem acento: alguns Chromium (Linux) trocam o nome acentuado por "download".
        a.download = `${String(s.titulo || 'sessao').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-')}.ics`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        toast.success('Arquivo de agenda baixado: abra para incluir no seu calendário');
    };
    return <Button variant="outline" size="sm" className={`gap-1 ${className}`} onClick={baixar}><CalendarPlus className="w-4 h-4" aria-hidden /> Adicionar à agenda</Button>;
}

const COR_ITEM = {
    julgado: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
    pautado: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100',
    vista: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100',
};

/** Tela cheia para acompanhar (ou projetar na sala): o processo chamado, a ordem do dia e os resultados. */
export function PainelAoVivo({ painel, onFechar }) {
    useEffect(() => {
        const esc = (e) => { if (e.key === 'Escape') onFechar(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onFechar]);
    const itens = painel?.itens || [];
    const atual = itens.find((x) => x.processo_id === painel?.em_julgamento);
    const julgados = itens.filter((x) => x.situacao === 'julgado').length;
    return (
        <div role="dialog" aria-modal="true" aria-label="Painel ao vivo da sessão" className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
            <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                            {painel?.situacao === 'publicada'
                                ? <><span className="relative flex h-2.5 w-2.5" aria-hidden><span className="absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75 animate-ping motion-reduce:animate-none" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600" /></span> Ao vivo</>
                                : 'Sessão encerrada'}
                            <span className="text-slate-500 dark:text-slate-400">· {painel?.colegiado}</span>
                        </p>
                        <h2 className="text-2xl sm:text-4xl font-semibold">{painel?.titulo || 'Sessão'}</h2>
                        {painel && <p className="text-base sm:text-lg text-slate-700 dark:text-slate-300">{quandoSessao(painel)}</p>}
                    </div>
                    <Button variant="outline" size="icon" onClick={onFechar} aria-label="Fechar o painel"><X className="w-5 h-5" aria-hidden /></Button>
                </div>
                {!painel && <p className="text-lg flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" aria-hidden /> Carregando o painel…</p>}
                <section aria-live="polite" aria-label="Em julgamento">
                    {atual ? (
                        <div className="rounded-2xl border-2 border-indigo-500 bg-white dark:bg-slate-900 p-5 sm:p-8 space-y-2 shadow-sm">
                            <p className="text-sm uppercase tracking-wide font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-2"><Gavel className="w-4 h-4" aria-hidden /> Em julgamento</p>
                            <p className="text-3xl sm:text-5xl font-mono font-semibold">{atual.numero}</p>
                            <p className="text-lg sm:text-2xl">{atual.assunto}</p>
                            {atual.relator && <p className="text-base sm:text-lg text-slate-700 dark:text-slate-300">Relator: {atual.relator}</p>}
                            <p className="text-base sm:text-xl font-medium">
                                {atual.resultado ? `Resultado proclamado: ${atual.resultado}`
                                    : atual.liberado ? `Votaram ${atual.votaram} de ${atual.vogais} vogais` : 'Aguardando o voto do relator'}
                            </p>
                        </div>
                    ) : painel?.situacao === 'publicada' && (
                        <p className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-lg text-slate-700 dark:text-slate-300">
                            {painel.modo === 'assincrona' ? 'Sessão virtual: cada membro vota no seu tempo, até o último dia da votação.' : 'Nenhum processo chamado agora. O presidente ou a secretaria chamam o próximo.'}
                        </p>
                    )}
                </section>
                {itens.length > 0 && (
                    <section className="space-y-2" aria-label="Ordem do dia">
                        <h3 className="text-lg font-semibold">Ordem do dia <span className="font-normal text-slate-600 dark:text-slate-400">· {julgados} de {itens.length} julgados</span></h3>
                        <ol className="space-y-2">
                            {itens.map((x, i) => (
                                <li key={x.processo_id} className={`rounded-xl bg-white dark:bg-slate-900 border p-3 sm:p-4 flex flex-wrap items-center gap-x-4 gap-y-1 ${x.processo_id === painel.em_julgamento ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900' : 'border-slate-200 dark:border-slate-800'}`}>
                                    <span className="w-8 text-right text-lg font-semibold text-slate-500 dark:text-slate-400">{i + 1}.</span>
                                    <span className="font-mono text-lg">{x.numero}</span>
                                    <span className="flex-1 min-w-[10rem] text-base">{x.assunto}{x.relator ? <span className="text-slate-600 dark:text-slate-400"> · Relator: {x.relator}</span> : null}</span>
                                    <Badge variant="outline" className={`border-0 text-sm ${COR_ITEM[x.situacao] || 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'}`}>
                                        {x.situacao === 'julgado' ? <><CheckCircle2 className="w-4 h-4 mr-1" aria-hidden />{x.resultado || 'Julgado'}</> : SITUACAO_ITEM[x.situacao] || x.situacao}
                                    </Badge>
                                </li>
                            ))}
                        </ol>
                    </section>
                )}
                {painel?.atualizado_em && <p className="text-xs text-slate-500 dark:text-slate-400">Atualizado às {new Date(painel.atualizado_em).toLocaleTimeString('pt-BR')}. O painel mostra só o que já é público na sessão: votos aparecem no resultado proclamado.</p>}
            </div>
        </div>
    );
}

/** Lista de presença do dia (síncrona): a secretaria marca quem está; vai para a ata. */
export function PresencaSessao({ presenca, reuniao, indo, onSalvar }) {
    const [marcas, setMarcas] = useState(() => ({ ...(presenca.marcas || {}) }));
    const comp = presenca.composicao || [];
    if (!comp.length) return null;
    const funcao = { presidente: 'presidente', vice: 'vice-presidente', titular: 'titular', suplente: 'suplente' };
    return (
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3" aria-labelledby="pr-titulo">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="pr-titulo" className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2"><UserCheck className="w-4 h-4" aria-hidden /> Presença</h3>
                <Button variant="ghost" size="sm" onClick={() => setMarcas(Object.fromEntries(comp.map((m) => [m.uid, true])))}>Marcar todos</Button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Marque quem está na sessão. Quem não for marcado sai como ausente na ata. {reuniao ? 'Na reunião, o quórum se conta pelos presentes, e só vota quem está marcado.' : 'A votação continua aberta a quem compõe o colegiado no dia.'}</p>
            <ul className="grid gap-1 sm:grid-cols-2">
                {comp.map((m) => (
                    <li key={m.uid}>
                        <label className="flex items-center gap-2 text-sm rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                            <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={marcas[m.uid] === true} onChange={(e) => setMarcas((x) => ({ ...x, [m.uid]: e.target.checked }))} />
                            <span>{m.nome}</span><span className="text-xs text-slate-600 dark:text-slate-400">({funcao[m.funcao] || m.funcao})</span>
                        </label>
                    </li>
                ))}
            </ul>
            <Button size="sm" disabled={indo} onClick={() => onSalvar(Object.fromEntries(comp.map((m) => [m.uid, marcas[m.uid] === true])))}>
                {indo && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}Salvar presença
            </Button>
        </section>
    );
}

const esc = (t) => String(t || '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** Abre a ata numa página para imprimir ou salvar em PDF. */
function imprimirAta(ata) {
    const w = window.open('', '_blank');
    if (!w) { toast.error('O navegador bloqueou a janela de impressão: libere as janelas deste site.'); return; }
    const [titulo, ...resto] = ata.texto.split('\n\n');
    const ass = (ata.assinaturas || []).map((a) => `<p class="ass">Assinado eletronicamente por <b>${esc(a.nome)}</b> (${esc(PAPEL_ATA[a.papel] || a.papel)}), em ${esc(new Date(a.em).toLocaleString('pt-BR'))}.</p>`).join('');
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font-family:Georgia,serif;max-width:46rem;margin:2rem auto;padding:0 1rem;line-height:1.55;color:#111}h1{font-size:1.1rem;text-align:center}p{text-align:justify}.ass{font-size:.9rem}.hash{font-family:monospace;font-size:.75rem;color:#555;word-break:break-all}</style></head><body><h1>${esc(titulo)}</h1>${resto.map((p) => `<p>${esc(p)}</p>`).join('')}${ass || '<p class="ass">Ata ainda sem assinaturas.</p>'}<p class="hash">Código do conteúdo (SHA-256): ${esc(ata.sha256)}</p></body></html>`);
    w.document.close();
    w.focus();
    w.print();
}

/** A ata lavrada ao encerrar: conferir, ajustar (até a primeira assinatura), assinar e imprimir. */
export function AtaDaSessao({ ata, pode, indo, acao, reuniao = false }) {
    const [editando, setEditando] = useState(false);
    const [texto, setTexto] = useState('');
    if (!ata && !pode.ata_editar) return null;
    return (
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3" aria-labelledby="ata-titulo">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="ata-titulo" className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex flex-wrap items-center gap-2">
                    <ScrollText className="w-4 h-4" aria-hidden /> {reuniao ? 'Ata da reunião' : 'Ata da sessão'} <AjudaTermo id="ata_sessao" />
                    {ata && (ata.assinada
                        ? <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> Assinada</Badge>
                        : <Badge variant="outline" className="border-amber-300 text-amber-900 dark:border-amber-800 dark:text-amber-200">{ata.assinaturas.length ? 'Falta uma assinatura' : 'Aguarda conferência e assinaturas'}</Badge>)}
                </h3>
                <div className="flex flex-wrap gap-2">
                    {ata && pode.ata_editar && <Button variant="outline" size="sm" className="gap-1" onClick={() => { setTexto(ata.texto); setEditando(true); }}><Pencil className="w-4 h-4" aria-hidden /> Ajustar texto</Button>}
                    {pode.ata_editar && <Button variant="outline" size="sm" className="gap-1" disabled={indo} onClick={() => acao('sessaoAta', { refazer: true }, ata ? 'Ata refeita com os dados da sessão' : 'Ata lavrada')}><RefreshCw className="w-4 h-4" aria-hidden /> {ata ? 'Refazer com os dados' : 'Lavrar a ata'}</Button>}
                    {pode.assinar_presidente && <Button size="sm" className="gap-1" disabled={indo} onClick={() => acao('sessaoAtaAssinar', { papel: 'presidente' }, 'Ata assinada como presidente')}><FileSignature className="w-4 h-4" aria-hidden /> Assinar como presidente</Button>}
                    {pode.assinar_secretaria && <Button size="sm" className="gap-1" disabled={indo} onClick={() => acao('sessaoAtaAssinar', { papel: 'secretaria' }, 'Ata assinada pela secretaria')}><FileSignature className="w-4 h-4" aria-hidden /> Assinar pela secretaria</Button>}
                    {ata && <Button variant="ghost" size="sm" className="gap-1" onClick={() => imprimirAta(ata)}><Printer className="w-4 h-4" aria-hidden /> Imprimir</Button>}
                </div>
            </div>
            {!ata && <p className="text-sm text-slate-600 dark:text-slate-400">A sessão foi encerrada antes de existir a ata no sistema. Lavre-a com os dados que a sessão registrou.</p>}
            {ata && (
                <>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        Lavrada pelo sistema em {new Date(ata.gerada_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}{ata.editada_por ? `, ajustada por ${ata.editada_por}` : ''}.
                        {pode.ata_editar ? ' Confira e ajuste antes de assinar: depois da primeira assinatura, o texto não muda.' : ''}
                    </p>
                    <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-4 text-sm leading-relaxed text-slate-900 dark:text-slate-100 whitespace-pre-wrap font-serif max-h-[28rem] overflow-y-auto" tabIndex={0} aria-label="Texto da ata">{ata.texto}</div>
                    {ata.assinaturas.length > 0 && (
                        <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5">
                            {ata.assinaturas.map((a) => <li key={a.papel}><FileSignature className="inline w-3.5 h-3.5 -mt-0.5 mr-1" aria-hidden />{PAPEL_ATA[a.papel]}: {a.nome}, em {new Date(a.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</li>)}
                        </ul>
                    )}
                </>
            )}
            {editando && (
                <Dialog open onOpenChange={(o) => !o && setEditando(false)}>
                    <DialogContent className="max-w-3xl w-[calc(100vw-1rem)] sm:w-full">
                        <DialogHeader>
                            <DialogTitle>Ajustar a ata</DialogTitle>
                            <DialogDescription>Corrija o que for preciso (um nome, uma menção, um registro da sessão). Para voltar ao texto do sistema, use Refazer com os dados.</DialogDescription>
                        </DialogHeader>
                        <label htmlFor="ata-texto" className="sr-only">Texto da ata</label>
                        <Textarea id="ata-texto" rows={16} value={texto} onChange={(e) => setTexto(e.target.value)} className="font-serif text-sm" />
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setEditando(false)}>Voltar</Button>
                            <Button disabled={indo || texto.trim().length < 20} onClick={async () => { await acao('sessaoAta', { texto }, 'Ata ajustada'); setEditando(false); }}>Salvar ata</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </section>
    );
}
