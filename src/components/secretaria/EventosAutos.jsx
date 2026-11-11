import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownUp, BookOpen, Cpu, Download, FileText, Loader2, Search, Stamp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { baixarBase64 } from '@/services/secretariaService';
import { dataHora } from './comum';
import LeitorAutos from './LeitorAutos';

const textoFolhas = (f) => (f ? (f[1] > f[0] ? `fls. ${f[0]}–${f[1]}` : `fl. ${f[0]}`) : '');
// Internos: atos que o rito deixa fora dos autos (sem termo nem folha).
const FILTROS = [['todos', 'Todos'], ['usuario', 'Atos de usuários'], ['interno', 'Internos'], ['sistema', 'Sistema'], ['docs', 'Com documentos']];

function IconeEvento({ m }) {
    const I = m.origem !== 'usuario' ? Cpu : m.documento_id ? FileText : Stamp;
    return <I className={`w-4 h-4 shrink-0 ${m.origem !== 'usuario' ? 'text-slate-400' : 'text-indigo-600 dark:text-indigo-400'}`} aria-hidden />;
}

/**
 * Eventos do processo, como a capa do eproc: tudo o que aconteceu, numerado,
 * com quem fez, quando e as folhas que ocupa nos autos. Daqui se leem os
 * autos peça a peça e se gera o PDF integral ou só das partes marcadas.
 * `gerarPdf(selecao)` devolve `{ base64, nome }`.
 */
export default function EventosAutos({ movimentos, nomeUnidade, gerarPdf, titulo = 'Eventos', className = '' }) {
    const [filtro, setFiltro] = useState('todos');
    const [busca, setBusca] = useState('');
    const [crescente, setCrescente] = useState(false);
    const [marcados, setMarcados] = useState(() => new Set());
    const [leitura, setLeitura] = useState(null);
    const [pdfAberto, setPdfAberto] = useState(false);

    const temOrigem = (o) => movimentos.some((m) => m.origem === o);
    const ultimaFolha = movimentos.reduce((n, m) => Math.max(n, m.folhas?.[1] || 0), 0);
    const visiveis = useMemo(() => {
        const t = busca.trim().toLowerCase();
        const l = movimentos.filter((m) => (filtro === 'todos' || (filtro === 'docs' ? !!m.documento_id : m.origem === filtro))
            && (!t || `${m.seq} ${m.titulo} ${m.descricao} ${m.autor_nome}`.toLowerCase().includes(t)));
        return crescente ? l : [...l].reverse();
    }, [movimentos, filtro, busca, crescente]);

    const marcar = (seq) => setMarcados((s) => { const n = new Set(s); if (n.has(seq)) n.delete(seq); else n.add(seq); return n; });
    const todosMarcados = visiveis.length > 0 && visiveis.every((m) => marcados.has(m.seq));
    const marcarTodos = () => setMarcados((s) => {
        const n = new Set(s);
        visiveis.forEach((m) => (todosMarcados ? n.delete(m.seq) : n.add(m.seq)));
        return n;
    });
    const unidade = (m) => (nomeUnidade && m.unidade_id ? nomeUnidade(m.unidade_id) : '');
    // O leitor percorre os eventos em ordem cronológica, cada um na sua página.
    const pecas = useMemo(() => movimentos.map((m) => ({
        id: m.seq, ordem: m.seq, titulo: m.titulo, tipo: m.autor_nome, juntado_em: m.em,
        folha_inicial: m.folhas?.[0], folha_final: m.folhas?.[1],
    })), [movimentos]);

    return (
        <Card className={className}>
            <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base mr-auto">{titulo} <span className="font-normal text-slate-600 dark:text-slate-400">({movimentos.length})</span></CardTitle>
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={!movimentos.length} onClick={() => setLeitura(movimentos[0]?.seq)}><BookOpen className="w-4 h-4" aria-hidden /> Ler os autos</Button>
                    <Button size="sm" className="gap-1.5" disabled={!movimentos.length} onClick={() => setPdfAberto(true)}><Download className="w-4 h-4" aria-hidden /> Gerar PDF{marcados.size ? ` (${marcados.size})` : ''}</Button>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                    <div role="group" aria-label="Filtrar eventos" className="flex flex-wrap gap-1">
                        {FILTROS.filter(([v]) => !['sistema', 'interno'].includes(v) || temOrigem(v)).map(([v, l]) => (
                            <button key={v} type="button" aria-pressed={filtro === v} onClick={() => setFiltro(v)}
                                className={`rounded-full border px-2.5 py-1 text-xs ${filtro === v ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{l}</button>
                        ))}
                    </div>
                    <div className="relative flex-1 min-w-[10rem]">
                        <Search className="w-4 h-4 absolute left-2 top-2 text-slate-400" aria-hidden />
                        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nos eventos" aria-label="Buscar nos eventos" className="h-8 pl-8" />
                    </div>
                    <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setCrescente((v) => !v)}><ArrowDownUp className="w-3.5 h-3.5" aria-hidden /> {crescente ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}</Button>
                </div>
            </CardHeader>
            <CardContent>
                {!visiveis.length ? <p className="text-sm text-slate-600 dark:text-slate-400 py-4">Nenhum evento com esse filtro.</p> : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-1.5 pr-2 w-6"><input type="checkbox" checked={todosMarcados} onChange={marcarTodos} aria-label="Marcar todos os eventos listados" /></th>
                                    <th className="py-1.5 pr-3 font-medium">Nº</th>
                                    <th className="py-1.5 pr-3 font-medium hidden sm:table-cell">Data e hora</th>
                                    <th className="py-1.5 pr-3 font-medium">Evento</th>
                                    <th className="py-1.5 pr-3 font-medium hidden md:table-cell">Quem</th>
                                    <th className="py-1.5 font-medium text-right hidden sm:table-cell">Folhas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visiveis.map((m) => (
                                    <tr key={m.seq} className={`border-b border-slate-100 dark:border-slate-800 align-top ${marcados.has(m.seq) ? 'bg-indigo-50/60 dark:bg-indigo-950/40' : ''}`}>
                                        <td className="py-2 pr-2"><input type="checkbox" checked={marcados.has(m.seq)} onChange={() => marcar(m.seq)} aria-label={`Marcar o evento ${m.seq}`} /></td>
                                        <td className="py-2 pr-3 font-mono text-xs tabular-nums" title={m.hash ? `SHA-256 ${m.hash}` : undefined}>{m.seq}</td>
                                        <td className="py-2 pr-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-400 hidden sm:table-cell">{dataHora(m.em)}</td>
                                        <td className="py-2 pr-3 sm:min-w-[14rem] break-words">
                                            <button type="button" onClick={() => setLeitura(m.seq)} className="text-left group">
                                                <span className="flex flex-wrap items-center gap-1.5 font-medium group-hover:underline"><IconeEvento m={m} /> {m.titulo}
                                                    {m.novo && <Badge className="bg-indigo-600 hover:bg-indigo-600 text-[10px] px-1.5 py-0">novo</Badge>}
                                                    {m.origem !== 'usuario' && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">{m.origem === 'interno' ? 'interno' : 'sistema'}</Badge>}
                                                </span>
                                                <span className="block text-slate-700 dark:text-slate-300">{m.descricao}</span>
                                            </button>
                                            <span className="md:hidden block text-xs text-slate-600 dark:text-slate-400"><span className="sm:hidden">{[dataHora(m.em), textoFolhas(m.folhas)].filter(Boolean).join(' · ')} · </span>{[m.autor_nome, unidade(m)].filter(Boolean).join(' · ')}</span>
                                        </td>
                                        <td className="py-2 pr-3 hidden md:table-cell text-xs"><span className="block">{m.autor_nome}</span><span className="text-slate-600 dark:text-slate-400">{unidade(m)}</span></td>
                                        <td className="py-2 text-right whitespace-nowrap text-xs tabular-nums hidden sm:table-cell">{textoFolhas(m.folhas) || <span className="text-slate-400">—</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>

            <LeitorAutos documentos={pecas} abertoId={leitura} onFechar={() => setLeitura(null)} prefixo="Evento" titulo="Autos"
                carregar={(x) => gerarPdf({ modo: 'apenas', eventos: [x.id], capa: false, indice: false })} />
            {pdfAberto && <GerarPdf marcados={marcados} total={movimentos.length} ultimaFolha={ultimaFolha} gerarPdf={gerarPdf} onFechar={() => setPdfAberto(false)} />}
        </Card>
    );
}

function GerarPdf({ marcados, total, ultimaFolha, gerarPdf, onFechar }) {
    const n = marcados.size;
    const [modo, setModo] = useState(n ? 'apenas' : 'integral');
    const [de, setDe] = useState('1');
    const [a, setA] = useState(String(ultimaFolha || 1));
    const [capa, setCapa] = useState(true);
    const [indice, setIndice] = useState(true);
    const [ocupado, setOcupado] = useState(false);
    const opcoes = [
        ['integral', 'Processo inteiro', `Todos os ${total} eventos, do primeiro ao último.`, false],
        ['apenas', `Apenas os ${n} eventos marcados`, n ? 'Só as peças que você marcou na lista.' : 'Marque eventos na lista para usar esta opção.', !n],
        ['exceto', `Tudo, menos os ${n} eventos marcados`, n ? 'O processo sem as peças marcadas.' : 'Marque eventos na lista para usar esta opção.', !n],
        ['intervalo', 'Intervalo de folhas', ultimaFolha ? `Os autos vão da folha 1 à ${ultimaFolha}.` : 'Este processo ainda não tem folhas numeradas.', !ultimaFolha],
    ];
    const invalido = modo === 'intervalo' && !(Number(de) >= 1 && Number(a) >= Number(de));
    const gerar = async () => {
        setOcupado(true);
        try {
            const r = await gerarPdf({ modo, eventos: [...marcados], folha_de: Number(de), folha_a: Number(a), capa, indice });
            baixarBase64(r.base64, r.nome);
            toast.success('PDF gerado');
            onFechar();
        } catch (e) { toast.error(e?.message || 'Não foi possível gerar o PDF'); } finally { setOcupado(false); }
    };
    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Gerar PDF dos autos</DialogTitle>
                    <DialogDescription>Cada ato de usuário sai na sua página, com a folha carimbada. Os registros internos e do sistema saem reunidos num extrato ao fim.</DialogDescription>
                </DialogHeader>
                <fieldset className="space-y-2">
                    <legend className="sr-only">O que entra no PDF</legend>
                    {opcoes.map(([v, rotulo, ajuda, desligado]) => (
                        <label key={v} className={`flex gap-3 rounded-md border p-3 ${desligado ? 'opacity-50' : 'cursor-pointer'} ${modo === v ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                            <input type="radio" name="modo-pdf" className="mt-1" checked={modo === v} disabled={desligado} onChange={() => setModo(v)} />
                            <span className="flex-1">
                                <span className="block text-sm font-medium">{rotulo}</span>
                                <span className="block text-xs text-slate-600 dark:text-slate-400">{ajuda}</span>
                                {v === 'intervalo' && modo === 'intervalo' && (
                                    <span className="mt-2 flex items-center gap-2 text-sm">
                                        da folha <Input type="number" min={1} max={ultimaFolha} value={de} onChange={(e) => setDe(e.target.value)} aria-label="Primeira folha" className="h-8 w-20" />
                                        até a <Input type="number" min={1} max={ultimaFolha} value={a} onChange={(e) => setA(e.target.value)} aria-label="Última folha" className="h-8 w-20" />
                                    </span>
                                )}
                            </span>
                        </label>
                    ))}
                </fieldset>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={capa} onChange={(e) => setCapa(e.target.checked)} /> Capa do processo</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={indice} onChange={(e) => setIndice(e.target.checked)} /> Índice dos autos</label>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
                    <Button onClick={gerar} disabled={ocupado || invalido} className="gap-2">{ocupado ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Download className="w-4 h-4" aria-hidden />} Gerar PDF</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
