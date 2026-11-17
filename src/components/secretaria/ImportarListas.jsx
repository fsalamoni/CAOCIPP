import React, { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { arquivoParaBase64, secConfig } from '@/services/secretariaService';
import { ACEITOS, MAX_ITENS, ROTULO_LISTA, mesclar, mimeDoArquivo, resumo } from '@/lib/listasImportar';

const MAX_MB = 5;
const sel = 'h-10 rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm';
const AVISO = { existe: 'Já existe', repetido: 'Repetido', sem_lista: 'Escolha a lista', sem_nome: 'Sem nome' };

/** Base64 de um texto em UTF-8 (o que se cola vai ao servidor como arquivo .txt). */
const base64Texto = (t) => {
    let bin = '';
    for (const b of new TextEncoder().encode(t)) bin += String.fromCharCode(b);
    return btoa(bin);
};

/**
 * Importar listas do órgão de um arquivo (ou texto colado): o servidor lê e
 * devolve os itens que achou; aqui o admin confere cada um (nome, lista,
 * gênero), desmarca o que não quer e insere. Inserir salva as listas.
 */
export default function ImportarListas({ aberto, onFechar, orgId, listas, sistema, onInserido }) {
    const [lendo, setLendo] = useState(false);
    const [colado, setColado] = useState('');
    const [prev, setPrev] = useState(null); // { arquivo, itens: [{lista, nome, m, m_suposto, incluir}], avisos }
    const [salvando, setSalvando] = useState(false);
    const fechar = () => { setPrev(null); setColado(''); onFechar(); };

    const ler = async (base64, mime, nome) => {
        setLendo(true);
        try {
            const r = await secConfig(orgId, 'lerListas', { arquivo: { base64, mime, nome } });
            const itens = (r.itens || []).map((it) => ({ ...it, incluir: true }));
            setPrev({ arquivo: nome, itens, avisos: r.avisos || [] });
        } catch (e) { toast.error(e?.message || 'Não foi possível ler o arquivo'); } finally { setLendo(false); }
    };
    const escolher = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const mime = mimeDoArquivo(file.name);
        if (!mime) { toast.error('Formato não aceito. Use texto, CSV, JSON, Word, LibreOffice, Excel ou PDF.'); return; }
        if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Arquivo acima de ${MAX_MB} MB`); return; }
        await ler(await arquivoParaBase64(file), mime, file.name);
    };

    const muda = (i, campo, v) => setPrev((p) => ({ ...p, itens: p.itens.map((it, j) => (j === i ? { ...it, [campo]: v, ...(campo === 'm' ? { m_suposto: false } : {}) } : it)) }));
    const todos = (v) => setPrev((p) => ({ ...p, itens: p.itens.map((it) => ({ ...it, incluir: v })) }));
    const r = prev ? resumo(prev.itens, listas, sistema) : null;

    const inserir = async () => {
        const novas = mesclar(listas, r.entram);
        setSalvando(true);
        try {
            await secConfig(orgId, 'salvarListas', { listas: novas, arquivo_nome: prev.arquivo, itens_importados: r.total });
            toast.success(`${r.total === 1 ? 'Um item inserido' : `${r.total} itens inseridos`} e listas salvas`);
            await onInserido(novas);
            fechar();
        } catch (e) { toast.error(e?.message || 'Não foi possível salvar'); } finally { setSalvando(false); }
    };

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && !salvando && fechar()}>
            <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-3xl max-h-[92dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Importar listas de um arquivo</DialogTitle>
                    <DialogDescription>
                        {prev ? `Confira o que li em “${prev.arquivo}”. Nada foi gravado ainda: ajuste, desmarque o que não quiser e insira.`
                            : 'O sistema lê o arquivo, separa os itens de cada lista e mostra uma prévia. Nada é gravado antes da sua aprovação.'}
                    </DialogDescription>
                </DialogHeader>

                {!prev && (
                    <div className="space-y-4">
                        <label className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-400 ${lendo ? 'opacity-60 pointer-events-none' : ''}`}>
                            {lendo ? <Loader2 className="w-7 h-7 animate-spin text-indigo-600" aria-hidden /> : <FileUp className="w-7 h-7 text-indigo-600" aria-hidden />}
                            <span className="font-medium">{lendo ? 'Lendo o arquivo…' : 'Escolher arquivo'}</span>
                            <span className="text-xs text-slate-600 dark:text-slate-400">Texto (.txt, .md), CSV, JSON, Word (.docx, .doc), LibreOffice (.odt, .ods), Excel (.xlsx, .xls) ou PDF · até {MAX_MB} MB</span>
                            <input type="file" accept={ACEITOS} className="sr-only" onChange={escolher} disabled={lendo} />
                        </label>
                        <div className="grid sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
                            <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3"><b className="block mb-1">Texto ou Word</b>Um título por lista (“Espécies de comunicação”, “Espécies de audiência”, “Origens do processo”) e um item por linha embaixo. Vale “Comunicação: Edital; Convocação”.</div>
                            <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3"><b className="block mb-1">Planilha ou CSV</b>Uma coluna por lista (com o nome dela no alto), ou colunas “Lista” e “Nome”, ou uma aba por lista. Coluna “Gênero” ou “Masculino” opcional.</div>
                            <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3"><b className="block mb-1">JSON</b>{'{"comunicacao": ["Edital"], "origem": ["Ouvidoria"]}'} ou uma lista de {'{"lista": "...", "nome": "..."}'}. “(m)” ou “o” no começo marcam nome masculino.</div>
                        </div>
                        <div>
                            <Label htmlFor="listas-colado">Ou cole aqui</Label>
                            <Textarea id="listas-colado" rows={6} value={colado} onChange={(e) => setColado(e.target.value)} className="font-mono text-xs"
                                placeholder={'Espécies de comunicação\nEdital (m)\nConvocação\n\nOrigens do processo\nOuvidoria'} />
                            <Button size="sm" className="mt-2" disabled={!colado.trim() || lendo} onClick={() => ler(base64Texto(colado), 'text/plain', 'texto colado')}>Ler o texto</Button>
                        </div>
                    </div>
                )}

                {prev && (
                    <div className="space-y-3">
                        {prev.avisos.map((a) => (
                            <p key={a} className="flex gap-2 rounded-md bg-amber-50 dark:bg-amber-950/40 p-2 text-sm text-amber-900 dark:text-amber-200"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> {a}</p>
                        ))}
                        {!!prev.itens.length && (
                            <>
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                    <span className="font-medium">{prev.itens.length} {prev.itens.length === 1 ? 'item achado' : 'itens achados'}</span>
                                    <Button size="sm" variant="ghost" onClick={() => todos(true)}>Marcar todos</Button>
                                    <Button size="sm" variant="ghost" onClick={() => todos(false)}>Desmarcar todos</Button>
                                </div>
                                <ul className="divide-y divide-slate-200 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                                    {prev.itens.map((it, i) => {
                                        const s = r.sit[i];
                                        const ruim = s !== 'ok';
                                        return (
                                            <li key={i} className={`flex flex-wrap items-center gap-2 p-2 ${it.incluir && !ruim ? '' : 'bg-slate-50 dark:bg-slate-900/60'}`}>
                                                <Checkbox id={`imp-${i}`} checked={it.incluir} onCheckedChange={(v) => muda(i, 'incluir', v === true)} aria-label={`Inserir ${it.nome}`} />
                                                <Input aria-label={`Nome do item ${i + 1}`} value={it.nome} maxLength={40} onChange={(e) => muda(i, 'nome', e.target.value)} className="h-9 flex-1 min-w-[10rem]" />
                                                <select aria-label={`Lista de ${it.nome}`} value={it.lista || ''} onChange={(e) => muda(i, 'lista', e.target.value || null)} className={`${sel} h-9`}>
                                                    <option value="">Escolha a lista…</option>
                                                    {Object.entries(ROTULO_LISTA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                                </select>
                                                {it.lista && it.lista !== 'origem' && (
                                                    <label className="flex items-center gap-1.5 text-xs" htmlFor={`imp-${i}-m`}>
                                                        <Checkbox id={`imp-${i}-m`} checked={it.m === true} onCheckedChange={(v) => muda(i, 'm', v === true ? true : undefined)} />
                                                        Masculino{it.m_suposto && <span className="text-slate-500"> (estimado)</span>}
                                                    </label>
                                                )}
                                                {it.incluir && ruim && <Badge variant="outline" className="font-normal border-amber-400 text-amber-800 dark:text-amber-200">{AVISO[s]}</Badge>}
                                            </li>
                                        );
                                    })}
                                </ul>
                                <div role="status" aria-live="polite" className="rounded-md border border-slate-200 dark:border-slate-700 p-3 text-sm space-y-1">
                                    {Object.entries(r.entram).map(([k, l]) => (
                                        <p key={k} className={r.estouro.includes(k) ? 'text-red-700 dark:text-red-300' : ''}>
                                            <b>{ROTULO_LISTA[k]}</b>: {l.length ? `${l.length} ${l.length === 1 ? 'novo' : 'novos'}` : 'nada novo'} · ficará com {(listas[k] || []).length + l.length} de {MAX_ITENS}
                                            {r.estouro.includes(k) && ' (passa do limite: desmarque alguns)'}
                                        </p>
                                    ))}
                                    <p className="text-xs text-slate-600 dark:text-slate-400">“Já existe” e “Repetido” não entram. Inserir também salva o que você tiver mudado nas listas nesta tela.</p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    {prev && <Button variant="outline" onClick={() => setPrev(null)} disabled={salvando}>Outro arquivo</Button>}
                    <Button variant="ghost" onClick={fechar} disabled={salvando}>Cancelar</Button>
                    {prev && (
                        <Button onClick={inserir} disabled={salvando || !r.total || r.estouro.length > 0} className="gap-2">
                            {salvando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <CheckCircle2 className="w-4 h-4" aria-hidden />}
                            {r.total ? `Inserir ${r.total} ${r.total === 1 ? 'item' : 'itens'}` : 'Nada para inserir'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
