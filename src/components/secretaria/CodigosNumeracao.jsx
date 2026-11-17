import React, { useMemo, useState } from 'react';
import { AlertTriangle, ListOrdered, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { codigoDe, codigosRepetidos, digitosCodigos } from '@/lib/numeracao';

// ============================================================================
// Códigos numéricos da numeração: um número fixo para cada tipo de processo,
// unidade e órgão interno, que entra no número do processo no lugar da sigla
// (ex.: gabinete 001, assessoria 002). Quem confere repetição é o servidor
// (ação salvarCodigos); aqui só mostra e avisa antes.
// ============================================================================

const SECOES = [
    ['tipos', 'tipo', 'Tipos de processo'],
    ['unidades', 'unidade', 'Unidades'],
    ['orgaos', 'orgao', 'Órgãos internos'],
];

const inicial = (lista, dig) => Object.fromEntries(lista.map((x) => {
    const c = codigoDe(x.codigo);
    return [x.id, c === null ? '' : String(c).padStart(dig || 1, '0')];
}));

/** `numeracoes` = a do órgão e as próprias dos tipos (para saber os dígitos de cada seção). */
export default function CodigosNumeracao({ aberto, onFechar, estado, numeracoes, salvar, salvando }) {
    const listas = { tipos: estado.tipos || [], unidades: estado.unidades || [], orgaos: estado.orgaos || [] };
    const digitos = useMemo(() => digitosCodigos(numeracoes), [numeracoes]);
    const [valores, setValores] = useState(null);
    // Reabre do que está gravado.
    const v = valores || Object.fromEntries(SECOES.map(([k, s]) => [k, inicial(listas[k], digitos[s])]));
    const setValor = (k, id, x) => setValores({ ...v, [k]: { ...v[k], [id]: x.replace(/\D/g, '').slice(0, 6) } });
    const fechar = () => { setValores(null); onFechar(); };

    const repetidos = Object.fromEntries(SECOES.map(([k]) => [k, codigosRepetidos(listas[k].map((x) => ({ nome: x.nome, codigo: v[k][x.id] })))]));
    const temRepetido = SECOES.some(([k]) => repetidos[k].size > 0);

    /** Dá códigos em sequência aos itens sem código, a partir do maior já usado. */
    const preencher = (k, s) => {
        let prox = Math.max(0, ...Object.values(v[k]).map(codigoDe).filter((c) => c !== null)) + 1;
        const novo = { ...v[k] };
        for (const x of listas[k]) if (codigoDe(novo[x.id]) === null) novo[x.id] = String(prox++).padStart(digitos[s] || 1, '0');
        setValores({ ...v, [k]: novo });
    };

    const enviar = () => {
        const codigos = Object.fromEntries(SECOES.map(([k]) => [k, Object.fromEntries(listas[k].map((x) => [x.id, v[k][x.id] === '' ? null : Number(v[k][x.id])]))]));
        salvar('salvarCodigos', { codigos }, fechar);
    };

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Códigos numéricos</DialogTitle>
                    <DialogDescription>
                        Dê um número fixo a cada tipo, unidade e órgão interno. Ele entra no número do processo quando a numeração usa a parte “Código do tipo”, “Código da unidade” ou “Código do órgão interno”, completado com zeros à esquerda. Cada código vale para um item só dentro da sua seção. Mudar um código não muda o número de processos já autuados.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-5">
                    {SECOES.map(([k, s, titulo]) => {
                        const lista = listas[k];
                        if (!lista.length && k === 'orgaos') return null;
                        const dig = digitos[s];
                        const semCodigo = dig ? lista.filter((x) => codigoDe(v[k][x.id]) === null).length : 0;
                        return (
                            <section key={k} aria-labelledby={`cod-${k}`} className="space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h3 id={`cod-${k}`} className="text-sm font-semibold">{titulo}</h3>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">
                                            {dig ? `Na numeração com ${dig} dígito(s).` : 'Ainda não está na numeração: os códigos ficam guardados para quando entrar.'}
                                        </p>
                                    </div>
                                    {lista.length > 0 && (
                                        <Button type="button" size="sm" variant="outline" className="gap-1 h-8" onClick={() => preencher(k, s)}>
                                            <ListOrdered className="w-3.5 h-3.5" aria-hidden /> Numerar os vazios em ordem
                                        </Button>
                                    )}
                                </div>
                                {!lista.length && <p className="text-sm text-slate-600 dark:text-slate-400">Nada cadastrado ainda.</p>}
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                                    {lista.map((x) => {
                                        const bruto = v[k][x.id];
                                        const cod = codigoDe(bruto);
                                        const repete = cod !== null && repetidos[k].has(cod);
                                        const longo = cod !== null && dig > 0 && String(cod).length > dig;
                                        const idInput = `cod-${k}-${x.id}`;
                                        const aviso = repete ? `Repetido: ${repetidos[k].get(cod).filter((n) => n !== x.nome).join(', ') || 'outro item'} tem o mesmo código`
                                            : longo ? `Maior que ${dig} dígito(s): o processo não será autuado`
                                                : dig && cod === null ? 'Sem código: este item não autua enquanto a numeração usar o código' : '';
                                        return (
                                            <li key={x.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                                                <label htmlFor={idInput} className="flex-1 min-w-[10rem] text-sm">
                                                    {x.nome}{x.sigla ? <span className="text-xs text-slate-600 dark:text-slate-400"> · {x.sigla}</span> : null}
                                                </label>
                                                <span className="flex items-center gap-2">
                                                <Input id={idInput} inputMode="numeric" pattern="[0-9]*" maxLength={6} className={`h-8 w-24 font-mono ${repete || longo ? 'border-red-500' : ''}`}
                                                    value={bruto} placeholder="—" onChange={(e) => setValor(k, x.id, e.target.value)}
                                                    aria-invalid={repete || longo} aria-describedby={aviso ? `${idInput}-aviso` : undefined} />
                                                {dig > 0 && <span className="w-20 font-mono text-xs text-slate-600 dark:text-slate-400" aria-label="Como sai no número">{cod === null ? '?'.repeat(dig) : String(cod).padStart(dig, '0')}</span>}
                                                </span>
                                                {aviso && (
                                                    <p id={`${idInput}-aviso`} className={`basis-full text-xs flex items-center gap-1 ${repete || longo ? 'text-red-700 dark:text-red-400' : 'text-amber-800 dark:text-amber-300'}`}>
                                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden /> {aviso}
                                                    </p>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                                {semCodigo > 0 && <p className="text-xs text-amber-800 dark:text-amber-300">{semCodigo} sem código.</p>}
                            </section>
                        );
                    })}
                </div>
                <DialogFooter className="gap-2">
                    {temRepetido && <p className="text-sm text-red-700 dark:text-red-400 sm:mr-auto" role="alert">Há códigos repetidos. Cada item precisa de um código próprio.</p>}
                    <Button variant="outline" onClick={fechar}>Cancelar</Button>
                    <Button disabled={salvando || temRepetido} onClick={enviar}>
                        {salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar códigos
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
