import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileUp, Loader2, Plus, Trash2 } from 'lucide-react';
import ImportarListas from './ImportarListas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { secConfig } from '@/services/secretariaService';
import { ESPECIES } from '@/lib/comunicacaoRito';
import { ESPECIES_AUDIENCIA } from '@/lib/audiencias';
import { ORIGENS } from './comum';

/** Espelho de MAX_ITENS_LISTA e MAX_NOME_ITEM em functions-v2/src/shared/listasOrgao.ts. */
const MAX_ITENS = 30;
const MAX_NOME = 40;

const LISTAS = [
    {
        k: 'comunicacao', titulo: 'Espécies de comunicação', genero: true, sistema: ESPECIES.map((e) => e[1]),
        exemplo: 'Ex.: Notificação extrajudicial', dica: 'Somam-se às do sistema na hora de expedir e nas ações do rito. Funcionam como as do sistema: com prazo, a parte responde no prazo; sem prazo, fica só a ciência.',
    },
    {
        k: 'audiencia', titulo: 'Espécies de audiência', genero: true, sistema: ESPECIES_AUDIENCIA.map((e) => e[1]),
        exemplo: 'Ex.: Sessão de mediação', dica: 'Aparecem na ação "Designar audiência" do rito e no portal das partes.',
    },
    {
        k: 'origem', titulo: 'Origens do processo', genero: false, sistema: ORIGENS.map((o) => o[1]),
        exemplo: 'Ex.: Ouvidoria', dica: 'Aparecem na autuação e na capa, e o rito pode usá-las nas condições ("Origem é Ouvidoria").',
    },
];

/**
 * Listas do órgão: espécies de comunicação e de audiência e origens a mais,
 * além das do sistema. O que já foi feito guarda o nome do item, então
 * renomear ou tirar um item não muda processo nenhum.
 */
export default function ListasOrgao({ orgId, estado }) {
    const qc = useQueryClient();
    const [listas, setListas] = useState(() => Object.fromEntries(LISTAS.map(({ k }) => [k, estado.listas?.[k] || []])));
    const [salvando, setSalvando] = useState(false);
    const [importar, setImportar] = useState(false);
    const muda = (k, i, campo, v) => setListas((x) => ({ ...x, [k]: x[k].map((it, j) => (j === i ? { ...it, [campo]: v } : it)) }));
    const tira = (k, i) => setListas((x) => ({ ...x, [k]: x[k].filter((_, j) => j !== i) }));
    const poe = (k) => setListas((x) => ({ ...x, [k]: [...x[k], { nome: '' }] }));

    const salvar = async () => {
        setSalvando(true);
        try {
            await secConfig(orgId, 'salvarListas', { listas });
            toast.success('Listas salvas');
            await qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
        } catch (e) {
            toast.error(e?.message || 'Não foi possível salvar');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Listas do órgão</CardTitle>
                <CardDescription>
                    O que o seu órgão usa e o sistema não traz: outras espécies de comunicação (edital, notificação extrajudicial), de audiência
                    (sessão de mediação, reunião de conciliação) e de origem do processo (ouvidoria, corregedoria). Cada processo guarda o nome do item:
                    renomear ou tirar um item da lista não muda o que já foi feito.
                </CardDescription>
                <div>
                    <Button type="button" variant="outline" size="sm" className="gap-1 mt-1" onClick={() => setImportar(true)}>
                        <FileUp className="w-4 h-4" aria-hidden /> Importar de arquivo
                    </Button>
                </div>
            </CardHeader>
            <ImportarListas aberto={importar} onFechar={() => setImportar(false)} orgId={orgId} listas={listas}
                sistema={Object.fromEntries(LISTAS.map(({ k, sistema }) => [k, sistema]))}
                onInserido={async (novas) => { setListas(novas); await qc.invalidateQueries({ queryKey: ['sec-estado', orgId] }); }} />
            <CardContent className="space-y-6">
                {LISTAS.map(({ k, titulo, genero, sistema, exemplo, dica }) => (
                    <fieldset key={k} className="space-y-2">
                        <legend className="text-sm font-semibold">{titulo}</legend>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{dica} Já no sistema: {sistema.join(', ')}.</p>
                        {listas[k].map((it, i) => (
                            <div key={it.id || `novo-${i}`} className="flex flex-wrap items-center gap-2">
                                <Input id={`lst-${k}-${i}`} aria-label={`${titulo}: item ${i + 1}`} className="flex-1 min-w-[12rem]" value={it.nome} maxLength={MAX_NOME}
                                    placeholder={exemplo} onChange={(e) => muda(k, i, 'nome', e.target.value)} />
                                {genero && (
                                    <label className="flex items-center gap-2 text-xs" htmlFor={`lst-${k}-${i}-m`}>
                                        <Checkbox id={`lst-${k}-${i}-m`} checked={it.m === true} onCheckedChange={(v) => muda(k, i, 'm', v === true ? true : undefined)} />
                                        Nome masculino (&quot;o&quot;, &quot;ao&quot;)
                                    </label>
                                )}
                                <Button type="button" variant="ghost" size="icon" aria-label={`Tirar ${it.nome || 'o item'}`} onClick={() => tira(k, i)}><Trash2 className="w-4 h-4" /></Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" className="gap-1" disabled={listas[k].length >= MAX_ITENS} onClick={() => poe(k)}>
                            <Plus className="w-4 h-4" aria-hidden /> Acrescentar
                        </Button>
                    </fieldset>
                ))}
                <Button onClick={salvar} disabled={salvando} className="gap-2">{salvando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Salvar listas</Button>
            </CardContent>
        </Card>
    );
}
