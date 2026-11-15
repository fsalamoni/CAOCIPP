import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, DoorOpen, FileText, Loader2, Plus, Trash2, UserCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { secProcesso } from '@/services/secretariaService';
import AjudaTermo from './AjudaTermo';
import { AJUDA_OCORRENCIA, COM_QUEM, TEXTO_OPCIONAL, TIPOS_OCORRENCIA, horaBrasil, linhaDaOcorrencia } from '@/lib/audienciaSala';

/**
 * Sala da audiência (S10): no dia, quem tem o processo abre a sala, marca a
 * presença, registra o que acontece e encerra. O termo vai à lista de
 * documentos como minuta assinada, para a juntada.
 */
const sel = 'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';

function Presenca({ convocados, sala, pode, chamar, indo }) {
    const [marcas, setMarcas] = useState(() => ({ ...sala.presencas }));
    const [outros, setOutros] = useState(() => (sala.outros || []).map((x) => ({ ...x })));
    const mudou = JSON.stringify(marcas) !== JSON.stringify(sala.presencas) || JSON.stringify(outros) !== JSON.stringify(sala.outros || []);
    return (
        <section className="space-y-2" aria-label="Presença">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><UserCheck className="w-4 h-4" aria-hidden /> Presença</h3>
            <ul className="grid gap-1 sm:grid-cols-2">
                {convocados.map((c) => (
                    <li key={c.chave}>
                        <label className="flex items-start gap-2 text-sm rounded-md border border-slate-200 dark:border-slate-700 p-2 cursor-pointer">
                            <input type="checkbox" className="mt-0.5" checked={!!marcas[c.chave]} disabled={!pode.registrar} onChange={(e) => setMarcas((m) => ({ ...m, [c.chave]: e.target.checked }))} />
                            <span><span className="font-medium text-slate-900 dark:text-white">{c.nome}</span> <span className="text-xs text-slate-600 dark:text-slate-400">{c.representa ? `representante de ${c.representa}` : c.qualidade}</span></span>
                        </label>
                    </li>
                ))}
            </ul>
            <div className="space-y-1">
                <p className="text-xs text-slate-700 dark:text-slate-300">Também presentes (quem não foi convocado: membro do Ministério Público, defensor nomeado, intérprete)</p>
                {outros.map((x, i) => (
                    <div key={i} className="flex flex-wrap gap-2 items-center">
                        <Input aria-label={`Nome do presente ${i + 1}`} className="flex-1 min-w-[10rem]" value={x.nome} maxLength={120} disabled={!pode.registrar} onChange={(e) => setOutros((o) => o.map((y, k) => (k === i ? { ...y, nome: e.target.value } : y)))} />
                        <Input aria-label={`Qualidade do presente ${i + 1}`} className="w-48" placeholder="Qualidade" value={x.qualidade} maxLength={60} disabled={!pode.registrar} onChange={(e) => setOutros((o) => o.map((y, k) => (k === i ? { ...y, qualidade: e.target.value } : y)))} />
                        {pode.registrar && <Button size="icon" variant="ghost" aria-label={`Tirar o presente ${i + 1}`} onClick={() => setOutros((o) => o.filter((_, k) => k !== i))}><X className="w-4 h-4" aria-hidden /></Button>}
                    </div>
                ))}
                {pode.registrar && outros.length < 20 && <Button size="sm" variant="ghost" className="gap-1" onClick={() => setOutros((o) => [...o, { nome: '', qualidade: '' }])}><Plus className="w-4 h-4" aria-hidden /> Outro presente</Button>}
            </div>
            {pode.registrar && <Button size="sm" disabled={indo || !mudou} onClick={() => chamar('salaPresenca', { presencas: marcas, outros }, 'Presença registrada: vai para o termo')}>Salvar presença</Button>}
        </section>
    );
}

function NovoRegistro({ presentes, chamar, indo }) {
    const [f, setF] = useState({ tipo: 'manifestacao', quem: '', texto: '' });
    const comQuem = COM_QUEM.includes(f.tipo);
    const pronto = (!comQuem || f.quem) && (TEXTO_OPCIONAL.includes(f.tipo) || f.texto.trim().length >= 3);
    const registrar = async () => {
        if (await chamar('salaRegistrar', { ocorrencia: f }, 'Registrado no termo')) setF((x) => ({ ...x, texto: '' }));
    };
    return (
        <section className="space-y-2 rounded-md border border-indigo-200 dark:border-indigo-900 p-3" aria-label="Novo registro">
            <div className="grid gap-2 sm:grid-cols-2">
                <label htmlFor="sa-tipo" className="text-sm space-y-1 block"><span className="block text-slate-700 dark:text-slate-300">O que houve</span>
                    <select id="sa-tipo" className={sel} value={f.tipo} onChange={(e) => setF((x) => ({ ...x, tipo: e.target.value }))}>
                        {Object.entries(TIPOS_OCORRENCIA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                    </select>
                </label>
                {comQuem && (
                    <label htmlFor="sa-quem" className="text-sm space-y-1 block"><span className="block text-slate-700 dark:text-slate-300">De quem</span>
                        <select id="sa-quem" className={sel} value={f.quem} onChange={(e) => setF((x) => ({ ...x, quem: e.target.value }))}>
                            <option value="">{presentes.length ? 'Escolha entre os presentes' : 'Marque a presença antes'}</option>
                            {presentes.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">{TIPOS_OCORRENCIA[f.tipo]}: {AJUDA_OCORRENCIA[f.tipo]}</p>
            <label htmlFor="sa-texto" className="text-sm space-y-1 block"><span className="block text-slate-700 dark:text-slate-300">Texto{TEXTO_OPCIONAL.includes(f.tipo) ? ' (opcional)' : ''}</span>
                <Textarea id="sa-texto" rows={4} value={f.texto} maxLength={20000} onChange={(e) => setF((x) => ({ ...x, texto: e.target.value }))} />
            </label>
            <Button size="sm" className="gap-1" disabled={indo || !pronto} onClick={registrar}><Plus className="w-4 h-4" aria-hidden /> Registrar</Button>
        </section>
    );
}

export default function SalaAudiencia({ orgId, procId, audienciaId, onFechar }) {
    const qc = useQueryClient();
    const chave = ['sec-sala', orgId, procId, audienciaId];
    const q = useQuery({ queryKey: chave, queryFn: () => secProcesso(orgId, 'salaAudiencia', { processo_id: procId, audiencia_id: audienciaId }) });
    const [indo, setIndo] = useState(false);
    const [fim, setFim] = useState(null); // 'realizada' | 'nao'
    const [motivo, setMotivo] = useState('');
    const chamar = async (action, extra, ok) => {
        setIndo(true);
        try {
            await secProcesso(orgId, action, { processo_id: procId, audiencia_id: audienciaId, ...extra });
            toast.success(ok);
            await qc.invalidateQueries({ queryKey: chave });
            if (action === 'salaEncerrar') qc.invalidateQueries({ queryKey: ['sec-proc', orgId, procId] });
            return true;
        } catch (e) { toast.error(e?.message || 'Não foi possível concluir'); return false; } finally { setIndo(false); }
    };
    const d = q.data;
    const sala = d?.sala;
    const pode = d?.pode || {};
    const presentes = d && sala ? [...d.convocados.filter((c) => sala.presencas[c.chave]).map((c) => c.nome), ...(sala.outros || []).map((x) => x.nome)] : [];
    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-3xl max-h-[94vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2"><DoorOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden /> Sala da audiência <AjudaTermo id="termo_audiencia" />
                        {sala?.encerrada_em ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Encerrada</Badge> : sala ? <Badge className="bg-indigo-600 hover:bg-indigo-600">Aberta</Badge> : null}
                    </DialogTitle>
                    <DialogDescription>{d ? `${d.audiencia.nome} do processo ${d.processo.numero}: ${d.audiencia.texto}.` : 'Carregando…'}</DialogDescription>
                </DialogHeader>
                {q.isLoading && <p className="text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Carregando a sala…</p>}
                {q.error && <p className="text-sm text-rose-700 dark:text-rose-300">{q.error.message}</p>}
                {d && !sala && (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                            {pode.abrir ? 'Abra a sala quando a audiência começar: marque a presença e registre o que acontece. Ao encerrar, o termo vai para a lista de documentos, assinado por você, para a juntada.' : d.audiencia.data > d.hoje ? 'A sala abre no dia da audiência.' : 'Só quem tem o processo consigo abre a sala.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {pode.abrir && <Button className="gap-1" disabled={indo} onClick={() => chamar('salaAbrir', {}, 'Sala aberta')}><DoorOpen className="w-4 h-4" aria-hidden /> Abrir a sala</Button>}
                            {pode.encerrar && <Button variant="outline" disabled={indo} onClick={() => { setFim('nao'); setMotivo(''); }}>Não se realizou</Button>}
                        </div>
                    </div>
                )}
                {d && sala && (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-600 dark:text-slate-400">Aberta às {horaBrasil(sala.aberta_em)} por {sala.aberta_por.nome}{sala.encerrada_em ? `; encerrada às ${horaBrasil(sala.encerrada_em)}${sala.realizada === false ? ' (não se realizou)' : ''}` : ''}.</p>
                        {sala.encerrada_em && (
                            <p className="text-sm rounded-md bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100 p-2 flex items-start gap-1.5"><FileText className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
                                O termo está na lista de documentos do processo, como minuta assinada, para a juntada. Se precisar corrigir, exclua a minuta: a sala volta a ficar aberta.</p>
                        )}
                        <Presenca key={JSON.stringify([sala.presencas, sala.outros])} convocados={d.convocados} sala={sala} pode={pode} chamar={chamar} indo={indo} />
                        <section className="space-y-2" aria-label="Registros da audiência">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Registros ({sala.ocorrencias.length})</h3>
                            {!sala.ocorrencias.length && <p className="text-sm text-slate-600 dark:text-slate-400">Nada registrado ainda.</p>}
                            <ol className="space-y-1.5">
                                {sala.ocorrencias.map((o, i) => (
                                    <li key={o.id} className="flex gap-2 text-sm rounded-md bg-slate-50 dark:bg-slate-800/60 p-2">
                                        <span className="w-6 shrink-0 text-right font-semibold text-slate-500 dark:text-slate-400">{i + 1}.</span>
                                        <span className="flex-1 min-w-0 whitespace-pre-line text-slate-800 dark:text-slate-200">{linhaDaOcorrencia(o)} <span className="text-xs text-slate-500 dark:text-slate-400">· {horaBrasil(o.em)}, {o.por}</span></span>
                                        {pode.remover && <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-700 dark:text-rose-300" disabled={indo} aria-label={`Tirar o registro ${i + 1}`} onClick={() => chamar('salaRemover', { ocorrencia_id: o.id }, 'Registro tirado')}><Trash2 className="w-4 h-4" aria-hidden /></Button>}
                                    </li>
                                ))}
                            </ol>
                        </section>
                        {pode.registrar && <NovoRegistro presentes={presentes} chamar={chamar} indo={indo} />}
                        {pode.encerrar && (
                            <div className="flex flex-wrap gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
                                <Button className="gap-1" disabled={indo} onClick={() => setFim('realizada')}><CheckCircle2 className="w-4 h-4" aria-hidden /> Encerrar e lavrar o termo</Button>
                                <Button variant="outline" disabled={indo} onClick={() => { setFim('nao'); setMotivo(''); }}>Não se realizou</Button>
                            </div>
                        )}
                    </div>
                )}
                <DialogFooter><Button variant="outline" onClick={onFechar}>Fechar</Button></DialogFooter>
            </DialogContent>
            {fim && (
                <Dialog open onOpenChange={(o) => !o && setFim(null)}>
                    <DialogContent className="max-w-lg w-[calc(100vw-1rem)] sm:w-full">
                        <DialogHeader>
                            <DialogTitle>{fim === 'realizada' ? 'Encerrar a audiência?' : 'Registrar que não se realizou?'}</DialogTitle>
                            <DialogDescription>
                                {fim === 'realizada'
                                    ? 'O sistema lavra o termo com a presença e os registros, em ordem, e o manda à lista de documentos como minuta assinada por você. A unidade junta aos autos pelo caminho de sempre.'
                                    : 'O termo diz que a audiência não se realizou, com o motivo e a presença marcada. Vai à lista de documentos para a juntada.'}
                            </DialogDescription>
                        </DialogHeader>
                        {fim === 'nao' && <label htmlFor="sa-motivo" className="text-sm space-y-1 block"><span className="block">Motivo</span><Input id="sa-motivo" value={motivo} maxLength={1000} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: ausência das partes, devidamente intimadas" /></label>}
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setFim(null)}>Voltar</Button>
                            <Button disabled={indo || (fim === 'nao' && motivo.trim().length < 5)} onClick={async () => { if (await chamar('salaEncerrar', fim === 'nao' ? { realizada: false, motivo } : {}, 'Audiência encerrada. O termo está na lista de documentos para a juntada.')) setFim(null); }}>
                                {indo && <Loader2 className="w-4 h-4 animate-spin mr-1" aria-hidden />}{fim === 'realizada' ? 'Encerrar' : 'Registrar'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </Dialog>
    );
}
