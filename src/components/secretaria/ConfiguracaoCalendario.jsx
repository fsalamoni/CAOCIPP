import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarPlus, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { secConfig } from '@/services/secretariaService';

// No celular a descrição desce para a segunda linha e a lixeira fica ao lado da data.
const MOVEL_LINHA2 = 'col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto';
const MOVEL_LIXEIRA = 'col-start-2 row-start-1 sm:col-start-auto sm:row-start-auto';

/**
 * Calendário do órgão: feriados locais e recessos entram na contagem dos
 * prazos abertos a partir de agora (os já abertos mantêm o vencimento). O
 * alerta diário avisa por e-mail quem está lotado na unidade do processo.
 */
export default function ConfiguracaoCalendario({ orgId, estado }) {
    const qc = useQueryClient();
    const inicial = estado.calendario || {};
    const [feriados, setFeriados] = useState(inicial.feriados || []);
    const [recessos, setRecessos] = useState(inicial.recessos || []);
    const [forense, setForense] = useState(inicial.recesso_forense === true);
    const [alerta, setAlerta] = useState(estado.alerta_prazos === true);
    const [salvando, setSalvando] = useState(false);

    const muda = (lista, setLista, i, k, v) => setLista(lista.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
    // Repete no ano seguinte os recessos do último ano cadastrado (mesmos dias).
    const maisUmAno = (d) => (d ? `${Number(d.slice(0, 4)) + 1}${d.slice(4)}` : d);
    const ultimoAno = recessos.map((r) => r.inicio?.slice(0, 4)).filter(Boolean).sort().pop();
    const replicar = () => {
        const novos = recessos.filter((r) => r.inicio?.startsWith(ultimoAno)).map((r) => ({ inicio: maisUmAno(r.inicio), fim: maisUmAno(r.fim), descricao: r.descricao }))
            .filter((n) => !recessos.some((r) => r.inicio === n.inicio && r.fim === n.fim));
        if (!novos.length) { toast.info(`Os recessos de ${Number(ultimoAno) + 1} já estão cadastrados.`); return; }
        setRecessos([...recessos, ...novos]);
        toast.success(`${novos.length} recesso${novos.length > 1 ? 's' : ''} de ${ultimoAno} copiado${novos.length > 1 ? 's' : ''} para ${Number(ultimoAno) + 1}. Revise e salve.`);
    };
    const tira = (lista, setLista, i) => setLista(lista.filter((_, j) => j !== i));

    const salvar = async () => {
        setSalvando(true);
        try {
            const r = await secConfig(orgId, 'salvarCalendario', {
                calendario: { feriados, recessos, recesso_forense: forense },
                alerta_prazos: alerta,
            });
            const descartados = feriados.length + recessos.length - (r.calendario.feriados.length + r.calendario.recessos.length);
            setFeriados(r.calendario.feriados);
            setRecessos(r.calendario.recessos);
            toast.success(descartados > 0 ? `Salvo. ${descartados} linha(s) incompleta(s) ou inválida(s) foram descartadas.` : 'Calendário salvo');
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
        } catch (e) {
            toast.error(e?.message || 'Não foi possível salvar');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Card className="lg:col-span-2 min-w-0">
            <CardHeader>
                <CardTitle className="text-base">Calendário e alertas de prazo</CardTitle>
                <CardDescription>
                    Fins de semana e feriados nacionais (inclusive Carnaval, Sexta-feira Santa e Corpus Christi) já contam sozinhos. Aqui entram os feriados do município ou do estado e os recessos do órgão. Vale para prazos abertos daqui em diante.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="grid lg:grid-cols-2 gap-5">
                    <fieldset className="space-y-2 min-w-0">
                        <legend className="text-sm font-medium mb-1">Feriados locais</legend>
                        {feriados.length === 0 && <p className="text-sm text-slate-600">Nenhum feriado local.</p>}
                        {feriados.map((f, i) => (
                            <div key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[10rem_1fr_auto] gap-2 items-center">
                                <Input type="date" className="min-w-0" aria-label={`Data do feriado ${i + 1}`} value={f.data} onChange={(e) => muda(feriados, setFeriados, i, 'data', e.target.value)} />
                                <Input aria-label={`Descrição do feriado ${i + 1}`} placeholder="Ex.: Aniversário da cidade" value={f.descricao || ''} onChange={(e) => muda(feriados, setFeriados, i, 'descricao', e.target.value)} className={MOVEL_LINHA2} />
                                <Button variant="ghost" size="sm" aria-label={`Remover feriado ${i + 1}`} onClick={() => tira(feriados, setFeriados, i)} className={MOVEL_LIXEIRA}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" className="gap-1" onClick={() => setFeriados([...feriados, { data: '', descricao: '' }])}><Plus className="w-4 h-4" /> Feriado</Button>
                    </fieldset>
                    <fieldset className="space-y-2 min-w-0">
                        <legend className="text-sm font-medium mb-1">Recessos e suspensões</legend>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Os dias do período não contam nem em prazo de dias corridos.</p>
                        {recessos.length === 0 && <p className="text-sm text-slate-600">Nenhum recesso.</p>}
                        {recessos.map((r, i) => (
                            <div key={i} className="grid grid-cols-[1fr_1fr_auto] sm:grid-cols-[10rem_10rem_1fr_auto] gap-2 items-center">
                                <Input type="date" className="min-w-0" aria-label={`Início do recesso ${i + 1}`} value={r.inicio} onChange={(e) => muda(recessos, setRecessos, i, 'inicio', e.target.value)} />
                                <Input type="date" className="min-w-0" aria-label={`Fim do recesso ${i + 1}`} value={r.fim} min={r.inicio || undefined} onChange={(e) => muda(recessos, setRecessos, i, 'fim', e.target.value)} />
                                <Input aria-label={`Descrição do recesso ${i + 1}`} placeholder="Motivo" value={r.descricao || ''} onChange={(e) => muda(recessos, setRecessos, i, 'descricao', e.target.value)} className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto" />
                                <Button variant="ghost" size="sm" aria-label={`Remover recesso ${i + 1}`} onClick={() => tira(recessos, setRecessos, i)} className="col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                        ))}
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => setRecessos([...recessos, { inicio: '', fim: '', descricao: '' }])}><Plus className="w-4 h-4" /> Recesso</Button>
                            {ultimoAno && <Button variant="ghost" size="sm" className="gap-1" onClick={replicar} title={`Copia os recessos de ${ultimoAno} para ${Number(ultimoAno) + 1}`}><CalendarPlus className="w-4 h-4" /> Repetir os de {ultimoAno} em {Number(ultimoAno) + 1}</Button>}
                        </div>
                    </fieldset>
                </div>
                <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                    <label className="flex items-start gap-2 text-sm">
                        <Checkbox checked={forense} onCheckedChange={(v) => setForense(v === true)} className="mt-0.5" />
                        <span>Suspender prazos no recesso forense (20 de dezembro a 20 de janeiro, como no CPC, art. 220)</span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                        <Checkbox checked={alerta} onCheckedChange={(v) => setAlerta(v === true)} className="mt-0.5" />
                        <span>Enviar e-mail diário, às 7h, a quem está lotado na unidade do processo quando um prazo vencer em até 2 dias ou já tiver vencido</span>
                    </label>
                </div>
                <Button onClick={salvar} disabled={salvando} className="gap-2">
                    {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar calendário
                </Button>
            </CardContent>
        </Card>
    );
}
