import React, { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Clock, Loader2, Megaphone, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { dataHora } from './comum';

/**
 * Comunicações às partes, do lado da equipe: o cartão no processo e o
 * formulário de expedição. A secretaria expede; o prazo de resposta só abre
 * quando a parte dá ciência (ou quando a ciência se dá por decurso).
 */

export const ESPECIES = [
    ['intimacao', 'Intimação', 'Chama a parte a fazer ou responder algo'],
    ['notificacao', 'Notificação', 'Dá conhecimento de um ato ou de uma data'],
    ['citacao', 'Citação', 'Chama a parte ao processo para se defender'],
    ['ciencia', 'Ciência', 'Só registra que a parte tomou conhecimento'],
    ['comunicacao', 'Comunicação', 'Outro aviso formal'],
];
export const nomeEspecie = (id) => ESPECIES.find((e) => e[0] === id)?.[1] || 'Comunicação';
export const brData = (iso) => (iso || '').slice(0, 10).split('-').reverse().join('/');
const hojeIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const somarDias = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
export const textoPrazo = (c) => (c.dias ? `${c.dias} dia${c.dias > 1 ? 's' : ''} ${c.contagem === 'uteis' ? (c.dias > 1 ? 'úteis' : 'útil') : (c.dias > 1 ? 'corridos' : 'corrido')}` : '');

const SITUACAO = {
    aguardando: { rotulo: 'Aguardando ciência', icone: Clock, classe: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100' },
    ciente: { rotulo: 'Ciente', icone: CheckCircle2, classe: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' },
    decurso: { rotulo: 'Ciência por decurso', icone: CheckCircle2, classe: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100' },
    sem_efeito: { rotulo: 'Sem efeito', icone: XCircle, classe: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

/** Selo da situação: ícone e texto, não só cor. */
export function SeloComunicacao({ status }) {
    const s = SITUACAO[status] || SITUACAO.aguardando;
    return <Badge className={`gap-1 font-normal hover:bg-transparent ${s.classe}`}><s.icone className="w-3 h-3" aria-hidden /> {s.rotulo}</Badge>;
}

/** Cartão do processo: o que foi comunicado, a quem e em que pé está. */
export function CartaoComunicacoes({ p, posse, podeMexer, naSecretaria, ocupado, onNova, onSemEfeito }) {
    const lista = [...(p.comunicacoes || [])].reverse();
    if (!lista.length && !posse) return null;
    return (
        <Card className={p.comunicacoes_aguardando ? 'border-sky-300 dark:border-sky-800' : ''}>
            <CardHeader className="pb-2 flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">Comunicações às partes{p.comunicacoes_aguardando > 0 && <Badge className="ml-2 bg-sky-600 hover:bg-sky-600">{p.comunicacoes_aguardando} aguardando ciência</Badge>}</CardTitle>
                {posse && <Button size="sm" variant="outline" className="gap-1" disabled={!podeMexer || !naSecretaria || ocupado} onClick={onNova}><Megaphone className="w-4 h-4" aria-hidden /> Intimar ou comunicar</Button>}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
                {posse && !naSecretaria && <p className="text-slate-600 dark:text-slate-300">Intimações e demais comunicações são expedidas pela secretaria. Envie o processo para a secretaria cumprir.</p>}
                {lista.length === 0 && naSecretaria && <p className="text-slate-600 dark:text-slate-300">Nenhuma comunicação expedida. Use o botão acima para intimar, notificar, citar ou dar ciência a uma parte.</p>}
                {lista.map((c) => (
                    <div key={c.id} className="py-2 border-b last:border-0 border-slate-100 dark:border-slate-800 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{nomeEspecie(c.especie)} a {c.parte_nome}</span>
                            <SeloComunicacao status={c.status} />
                            {c.status === 'aguardando' && posse && naSecretaria && (
                                <Button size="sm" variant="ghost" className="ml-auto h-7" disabled={!podeMexer || ocupado} onClick={() => onSemEfeito(c)}>Tornar sem efeito</Button>
                            )}
                        </div>
                        <p className="whitespace-pre-wrap text-slate-800 dark:text-slate-200">{c.texto}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                            Expedida em {dataHora(c.expedida_em)} por {c.expedida_por}
                            {c.documento_titulo ? ` · ${c.documento_titulo}` : ''}
                            {c.dias ? ` · prazo de ${textoPrazo(c)}` : ' · sem prazo de resposta'}
                            {c.status === 'aguardando' && (c.limite_ciencia ? ` · sem ciência até ${brData(c.limite_ciencia)}, vale por decurso` : ' · sem ciência por decurso')}
                            {c.ciencia_em && ` · ciência em ${dataHora(c.ciencia_em)}${c.ciencia_meio && !['plataforma', 'decurso'].includes(c.ciencia_meio) ? ` (${c.ciencia_meio})` : ''}`}
                            {c.vence_em && ` · prazo vence em ${brData(c.vence_em)}`}
                            {c.sem_efeito_motivo && ` · motivo: ${c.sem_efeito_motivo}`}
                        </p>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

const temConta = (x) => x.portal === 'ativo' || (x.representantes || []).some((r) => r.portal === 'ativo');

/**
 * Formulário de expedição. O prazo vem sugerido da fase do rito quando ela
 * tem um; se não tem, quem expede precisa dizer os dias ou marcar "sem prazo".
 */
export function ExpedirComunicacao({ aberto, p, autos, faseAtual, cienciaDias, ocupado, onFechar, onExpedir }) {
    const [especie, setEspecie] = useState('intimacao');
    const [partes, setPartes] = useState([]);
    const [texto, setTexto] = useState('');
    const [documento, setDocumento] = useState('');
    const [modoPrazo, setModoPrazo] = useState('dias');
    const [dias, setDias] = useState('');
    const [contagem, setContagem] = useState('uteis');
    const [meio, setMeio] = useState('plataforma');
    const [outroMeio, setOutroMeio] = useState('');
    const [dataCiencia, setDataCiencia] = useState('');
    const sugerido = faseAtual?.prazo_dias > 0 ? faseAtual.prazo_dias : null;

    useEffect(() => {
        if (!aberto) return;
        setEspecie('intimacao'); setTexto(''); setDocumento(''); setMeio('plataforma'); setOutroMeio(''); setDataCiencia(hojeIso());
        setModoPrazo('dias'); setDias(sugerido ? String(sugerido) : ''); setContagem('uteis');
        setPartes(p.partes.length === 1 ? [0] : []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aberto]);

    const marcar = (i) => setPartes((l) => (l.includes(i) ? l.filter((x) => x !== i) : [...l, i]));
    const escolherEspecie = (id) => { setEspecie(id); if (id === 'ciencia') setModoPrazo('sem'); };
    const semConta = partes.filter((i) => !temConta(p.partes[i]));
    const n = Number(dias);
    const prazoOk = modoPrazo === 'sem' || (Number.isInteger(n) && n >= 1);
    const meioOk = meio === 'plataforma' ? semConta.length === 0 : !!outroMeio.trim() && !!dataCiencia && dataCiencia <= hojeIso();
    const falta = !partes.length ? 'Escolha a quem comunicar'
        : !texto.trim() ? 'Escreva o que está sendo comunicado'
            : !prazoOk ? 'Diga o prazo em dias ou marque que não abre prazo'
                : !meioOk ? (meio === 'plataforma' ? 'Há destinatário sem conta no portal' : 'Informe o meio e a data da ciência') : '';
    const nomes = partes.map((i) => p.partes[i].nome).join(', ');
    const prazoTxt = modoPrazo === 'sem' ? '' : textoPrazo({ dias: n, contagem });
    const resumo = !partes.length ? '' : meio === 'plataforma'
        ? `${nomes} ${partes.length > 1 ? 'verão' : 'verá'} o aviso ao entrar na plataforma e ${partes.length > 1 ? 'precisarão' : 'precisará'} clicar em "Dar ciência". ${prazoTxt ? `O prazo de ${prazoTxt} começa a contar da ciência.` : 'Não abre prazo de resposta.'}${cienciaDias > 0 ? ` Sem ciência até ${brData(somarDias(hojeIso(), cienciaDias))}, ela vale por decurso.` : ''}`
        : `A ciência de ${nomes} fica registrada em ${brData(dataCiencia)}${outroMeio.trim() ? `, por ${outroMeio.trim()}` : ''}. ${prazoTxt ? `O prazo de ${prazoTxt} é aberto agora, contado dessa data.` : 'Não abre prazo de resposta.'}`;

    const expedir = () => onExpedir({
        especie, texto: texto.trim(), partes_idx: partes, documento_id: documento || undefined,
        ...(modoPrazo === 'sem' ? { sem_prazo: true } : { dias: n, contagem }),
        ...(meio === 'outro' ? { meio: 'outro', outro_meio: outroMeio.trim(), ciencia_data: dataCiencia } : {}),
    });
    const radio = 'flex items-start gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer';
    const ativo = 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950';
    const inativo = 'border-slate-200 dark:border-slate-700';

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Intimar ou comunicar uma parte</DialogTitle>
                    <DialogDescription>A comunicação fica certificada nos autos. O prazo de resposta só começa a contar quando a parte toma ciência.</DialogDescription>
                </DialogHeader>
                <div className="space-y-5">
                    <fieldset>
                        <legend className="text-sm font-medium mb-1">1. Espécie</legend>
                        <div className="grid sm:grid-cols-2 gap-2">
                            {ESPECIES.map(([id, nome, dica]) => (
                                <label key={id} className={`${radio} ${especie === id ? ativo : inativo}`}>
                                    <input type="radio" name="especie" className="mt-1" checked={especie === id} onChange={() => escolherEspecie(id)} />
                                    <span><span className="font-medium">{nome}</span><span className="block text-xs text-slate-600 dark:text-slate-400">{dica}</span></span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset>
                        <legend className="text-sm font-medium mb-1">2. A quem</legend>
                        {p.partes.length === 0 && <p className="text-sm text-slate-600">O processo não tem partes cadastradas. Inclua as partes em Dados do processo.</p>}
                        <div className="space-y-1">
                            {p.partes.map((x, i) => (
                                <label key={i} className={`${radio} items-center ${partes.includes(i) ? ativo : inativo}`}>
                                    <input type="checkbox" checked={partes.includes(i)} onChange={() => marcar(i)} />
                                    <span className="flex-1">{x.nome} <span className="text-slate-600 dark:text-slate-400">({x.polo})</span></span>
                                    {temConta(x) ? <Badge variant="secondary">Tem conta no portal</Badge> : <Badge variant="outline">Sem conta no portal</Badge>}
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="com-texto" className="text-sm font-medium">3. O que está sendo comunicado</Label>
                            <Textarea id="com-texto" rows={4} className="mt-1" value={texto} onChange={(e) => setTexto(e.target.value)}
                                placeholder="Ex.: Fica intimado a se manifestar sobre o relatório da comissão, juntado às fls. 12–18." />
                        </div>
                        {autos.length > 0 && (
                            <div>
                                <Label htmlFor="com-doc">Documento dos autos a que se refere (opcional)</Label>
                                <select id="com-doc" value={documento} onChange={(e) => setDocumento(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                                    <option value="">Nenhum</option>
                                    {autos.filter((d) => d.visivel_partes).map((d) => <option key={d.id} value={d.id}>Doc. nº {d.ordem}: {d.titulo}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <fieldset>
                        <legend className="text-sm font-medium mb-1">4. Prazo de resposta</legend>
                        <div className="grid sm:grid-cols-2 gap-2">
                            <label className={`${radio} ${modoPrazo === 'dias' ? ativo : inativo}`}>
                                <input type="radio" name="prazo" className="mt-1" checked={modoPrazo === 'dias'} onChange={() => setModoPrazo('dias')} />
                                <span className="flex-1 space-y-1">
                                    <span className="font-medium">Abre prazo</span>
                                    <span className="flex gap-2">
                                        <Input type="number" min={1} inputMode="numeric" aria-label="Dias de prazo" placeholder="dias" className="h-8 w-20" value={dias} onFocus={() => setModoPrazo('dias')} onChange={(e) => setDias(e.target.value)} />
                                        <select aria-label="Contagem do prazo" value={contagem} onChange={(e) => setContagem(e.target.value)} className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                                            <option value="uteis">dias úteis</option>
                                            <option value="corridos">dias corridos</option>
                                        </select>
                                    </span>
                                </span>
                            </label>
                            <label className={`${radio} ${modoPrazo === 'sem' ? ativo : inativo}`}>
                                <input type="radio" name="prazo" className="mt-1" checked={modoPrazo === 'sem'} onChange={() => setModoPrazo('sem')} />
                                <span><span className="font-medium">Não abre prazo</span><span className="block text-xs text-slate-600 dark:text-slate-400">Só dá conhecimento</span></span>
                            </label>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {sugerido ? `Sugestão do rito para a fase ${faseAtual.nome}: ${sugerido} dias. Mude se a decisão fixou outro prazo.`
                                : 'O rito não fixa prazo para esta fase. Informe o prazo da decisão que mandou comunicar.'}
                        </p>
                    </fieldset>

                    <fieldset>
                        <legend className="text-sm font-medium mb-1">5. Como a parte fica sabendo</legend>
                        <div className="grid sm:grid-cols-2 gap-2">
                            <label className={`${radio} ${meio === 'plataforma' ? ativo : inativo}`}>
                                <input type="radio" name="meio" className="mt-1" checked={meio === 'plataforma'} onChange={() => setMeio('plataforma')} />
                                <span><span className="font-medium">Pela plataforma</span><span className="block text-xs text-slate-600 dark:text-slate-400">Aviso ao entrar, com botão de ciência, e e-mail</span></span>
                            </label>
                            <label className={`${radio} ${meio === 'outro' ? ativo : inativo}`}>
                                <input type="radio" name="meio" className="mt-1" checked={meio === 'outro'} onChange={() => setMeio('outro')} />
                                <span><span className="font-medium">Por outro meio, já feita</span><span className="block text-xs text-slate-600 dark:text-slate-400">Correio, pessoalmente, edital: registra a ciência</span></span>
                            </label>
                        </div>
                        {meio === 'plataforma' && semConta.length > 0 && (
                            <p role="alert" className="mt-2 text-sm rounded-md bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 px-3 py-2">
                                {semConta.map((i) => p.partes[i].nome).join(', ')} ainda não {semConta.length > 1 ? 'têm' : 'tem'} conta no portal. Convide a parte em Dados do processo ou registre a comunicação feita por outro meio.
                            </p>
                        )}
                        {meio === 'outro' && (
                            <div className="grid sm:grid-cols-2 gap-3 mt-2">
                                <div><Label htmlFor="com-meio">Meio usado</Label><Input id="com-meio" className="mt-1" value={outroMeio} onChange={(e) => setOutroMeio(e.target.value)} placeholder="Ex.: correio com aviso de recebimento" /></div>
                                <div><Label htmlFor="com-data">Data da ciência</Label><Input id="com-data" type="date" className="mt-1" max={hojeIso()} value={dataCiencia} onChange={(e) => setDataCiencia(e.target.value)} /></div>
                            </div>
                        )}
                    </fieldset>

                    {resumo && !falta && (
                        <p className="text-sm rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-2" aria-live="polite"><b>{nomeEspecie(especie)}.</b> {resumo}</p>
                    )}
                </div>
                <DialogFooter className="items-center gap-2">
                    {falta && <span className="text-xs text-slate-600 dark:text-slate-400 mr-auto">{falta}</span>}
                    <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
                    <Button className="gap-2" disabled={!!falta || ocupado} onClick={expedir}>
                        {ocupado ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : meio === 'outro' ? <BellRing className="w-4 h-4" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
                        {meio === 'outro' ? 'Registrar a ciência' : 'Expedir'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
