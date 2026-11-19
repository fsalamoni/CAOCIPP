import React, { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { prepararEnvio, secDocumento } from '@/services/secretariaService';
import { atende, exigeDoDocumento, sugeridas } from '@/lib/exigencias';
import { NativeSelect } from './comum';

// Documento detalhado no momento em que entra no processo (na autuação ou numa
// fase): do que se trata, a data dele, o que fazer (juntar aos autos, guardar
// fora dos autos ou deixar como minuta), assinatura, portal das partes,
// pendência para o decisor e o que o rito exigia e ele cumpre. Cada um é
// registrado na hora, na ordem da lista, com a data e a hora da juntada.

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const semExtensao = (nome) => String(nome || '').replace(/\.[^.]+$/, '');

export const DESTINOS_ENTRADA = [
    ['juntar', 'Juntar aos autos agora', 'Ganha número de ordem, folhas e a data e a hora de hoje. Não pode ser desfeito.'],
    ['guardar', 'Guardar no processo, fora dos autos', 'Fica com a equipe, sem folha e fora do PDF dos autos. Não pode ser desfeito.'],
    ['minuta', 'Deixar como minuta', 'Só a equipe vê. Dá para trocar, assinar e juntar depois, no processo.'],
];

/** Detalhes iniciais de um arquivo: o tipo vem do primeiro da unidade; juntar é o padrão. */
export const detalheInicial = (file, tipoPadrao = 'Documento') => ({
    file, titulo: semExtensao(file?.name).slice(0, 200), tipo: tipoPadrao, descricao: '', data_documento: '',
    destino: 'juntar', assinar: false, visivel: 'sim', pendencia: '', atende: null,
});

/** Resumo de uma linha do que vai acontecer com o arquivo (para a lista do "Novo processo"). */
export function resumoDetalhe(d) {
    const o = DESTINOS_ENTRADA.find(([v]) => v === d.destino)?.[1] || '';
    return [d.tipo, o, d.destino === 'juntar' && d.assinar ? 'com sua assinatura' : '', d.destino === 'juntar' && d.visivel === 'nao' ? 'só a equipe vê' : ''].filter(Boolean).join(' · ');
}

/**
 * Envia e registra os documentos, um por vez, na ordem: cada um é enviado e,
 * conforme o detalhe, juntado ou guardado em seguida (a data e a hora ficam as
 * do ato). Falha num não desfaz os anteriores: devolve onde parou.
 * `version`: a do processo (sem ela, o servidor não confere).
 */
export async function enviarDetalhados(orgId, procId, itens, { version, onProgresso } = {}) {
    let v = version;
    const feitos = [];
    let ultimo = null;
    const registrar = itens.filter((d) => d.destino !== 'minuta').length;
    let registrados = 0;
    for (const d of itens) {
        // Já enviado numa tentativa anterior (a juntada é que falhou): não envia de novo.
        let docId = d.docId;
        try {
            if (!docId) {
                const envio = await prepararEnvio(d.file, onProgresso ? { onProgresso: (x) => onProgresso(d, x) } : {});
                docId = (await secDocumento(orgId, procId, 'upload', {
                    titulo: d.titulo.trim() || semExtensao(d.file.name), tipo: d.tipo || 'Documento', ...envio,
                    ...(d.descricao.trim() ? { descricao: d.descricao.trim() } : {}), ...(d.data_documento ? { data_documento: d.data_documento } : {}),
                })).id;
            }
            const up = { id: docId };
            if (d.destino !== 'minuta') {
                registrados += 1;
                // Fase que segue sozinha: só o último registro deixa o servidor concluir a fase.
                const aguardar = registrados < registrar;
                const r = d.destino === 'juntar'
                    ? await secDocumento(orgId, procId, 'juntar', {
                        docId: up.id, ...(typeof v === 'number' ? { version: v } : {}), pendencia: d.pendencia || 'nao', visivel_partes: d.visivel !== 'nao', assinar: d.assinar, aguardar,
                        ...(Array.isArray(d.atende) ? { atende: d.atende } : {}),
                    })
                    : await secDocumento(orgId, procId, 'guardar', { docId: up.id, ...(typeof v === 'number' ? { version: v } : {}), aguardar, ...(Array.isArray(d.atende) ? { atende: d.atende } : {}) });
                if (typeof r?.version === 'number') v = r.version;
                ultimo = r;
            }
            feitos.push(d);
        } catch (e) {
            return { feitos, falhou: docId ? { ...d, docId } : d, erro: e?.message || 'não foi possível concluir', ultimo };
        }
    }
    return { feitos, falhou: null, erro: '', ultimo };
}

/**
 * Diálogo que detalha os arquivos um a um, antes de entrarem no processo.
 * `exigencias`: o que o rito exige agora na fase (pendentes), para marcar o
 * que o documento cumpre; sem elas, o servidor reconhece pelo tipo.
 * `naAutuacao`: o processo ainda vai ser criado (o texto muda um pouco).
 */
export default function DetalharDocumentos({ aberto, itens: iniciais, tipos = [], exigencias = [], naAutuacao = false, soMinuta = false, ocupado = false, onConfirmar, onFechar }) {
    const [itens, setItens] = useState(iniciais || []);
    const [k, setK] = useState(0);
    useEffect(() => { if (aberto) { setItens(iniciais || []); setK(0); } }, [aberto, iniciais]);
    const d = itens[k];
    if (!aberto || !d) return null;
    const set = (patch) => setItens((l) => l.map((x, j) => (j === k ? { ...x, ...patch } : x)));
    const listaTipos = [...new Set([...(tipos || []), d.tipo, 'Documento'].filter(Boolean))];
    // O que o rito exige e este documento pode cumprir: juntado (autos) ou guardado (fora dos autos).
    const comoDoc = { tipo: d.tipo, controle: d.destino === 'guardar', n_assinaturas: d.destino === 'juntar' && d.assinar ? 1 : 0 };
    const cabem = d.destino === 'minuta' ? [] : exigencias.filter((e) => !e.cumprida && atende(e, comoDoc));
    const auto = sugeridas(cabem, comoDoc);
    const marcadas = Array.isArray(d.atende) ? d.atende.filter((c) => cabem.some((e) => e.chave === c)) : auto;
    const ultimo = k === itens.length - 1;
    const tituloOk = d.titulo.trim().length > 0;
    const dataOk = !d.data_documento || d.data_documento <= hoje();
    const pronto = itens.every((x) => x.titulo.trim() && (!x.data_documento || x.data_documento <= hoje()));
    const id = (s) => `det-${k}-${s}`;
    return (
        <Dialog open onOpenChange={(o) => { if (!o && !ocupado) onFechar(); }}>
            <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 shrink-0" aria-hidden /> Detalhar o documento{itens.length > 1 ? ` ${k + 1} de ${itens.length}` : ''}</DialogTitle>
                    <DialogDescription className="break-all">{d.file?.name}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <Label htmlFor={id('tit')}>Título</Label>
                        <Input id={id('tit')} className="mt-1" value={d.titulo} maxLength={200} onChange={(e) => set({ titulo: e.target.value })} aria-invalid={!tituloOk} />
                        {!tituloOk && <p className="mt-1 text-xs text-red-700 dark:text-red-300">Dê um título ao documento.</p>}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <NativeSelect id={id('tipo')} label="Tipo do documento" value={d.tipo} onChange={(v) => set({ tipo: v, atende: null })} options={listaTipos.map((t) => [t, t])} />
                        <div>
                            <Label htmlFor={id('data')}>Data do documento (opcional)</Label>
                            <Input id={id('data')} type="date" max={hoje()} className="mt-1" value={d.data_documento} onChange={(e) => set({ data_documento: e.target.value })} aria-describedby={id('data-aj')} />
                            <p id={id('data-aj')} className={`mt-1 text-xs ${dataOk ? 'text-slate-600 dark:text-slate-400' : 'text-red-700 dark:text-red-300'}`}>{dataOk ? 'A da assinatura ou da emissão, se for outra que não hoje.' : 'A data não pode ser futura.'}</p>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor={id('desc')}>Do que se trata (opcional)</Label>
                        <Textarea id={id('desc')} className="mt-1" rows={2} maxLength={500} value={d.descricao} placeholder="Ex.: ofício do solicitante com a íntegra do procedimento; comprovante de pagamento"
                            onChange={(e) => set({ descricao: e.target.value })} />
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Entra no registro da juntada, junto com o título e o tipo.</p>
                    </div>
                    {soMinuta ? (
                        <p className="rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 px-3 py-2 text-sm">
                            Entra como minuta, só para a equipe. Nesta fase não se assina nem se junta: o documento e os anexos seguem com o processo, e quem revisa decide o que vai aos autos.
                        </p>
                    ) : (
                    <fieldset>
                        <legend className="text-sm font-medium mb-1">O que fazer {naAutuacao ? 'ao criar o processo' : 'agora'}</legend>
                        <RadioGroup value={d.destino} onValueChange={(v) => set({ destino: v, atende: null })} className="space-y-1">
                            {DESTINOS_ENTRADA.map(([v, rotulo, explica]) => (
                                <label key={v} htmlFor={id(`d-${v}`)} className="flex items-start gap-2 rounded-md border border-slate-200 dark:border-slate-700 p-2 text-sm cursor-pointer">
                                    <RadioGroupItem id={id(`d-${v}`)} value={v} className="mt-0.5" />
                                    <span><span className="font-medium">{rotulo}</span><span className="block text-xs text-slate-600 dark:text-slate-400">{explica}</span></span>
                                </label>
                            ))}
                        </RadioGroup>
                    </fieldset>
                    )}
                    {d.destino === 'juntar' && (
                        <>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.assinar} onChange={(e) => set({ assinar: e.target.checked })} /> Assinar ao juntar (assinatura eletrônica simples, com seu nome, a data e a hora)</label>
                            <div className="grid sm:grid-cols-2 gap-3">
                                <NativeSelect id={id('vis')} label="Portal das partes" value={d.visivel} onChange={(v) => set({ visivel: v })} options={[['sim', 'Visível às partes'], ['nao', 'Só para a equipe']]} />
                                <NativeSelect id={id('pend')} label="Pendência para o decisor" value={d.pendencia} onChange={(v) => set({ pendencia: v })} options={[['', 'Não abrir'], ['sim', 'Abrir pendência, a fase segue'], ['interrompe', 'Abrir pendência e interromper a fase']]} />
                            </div>
                        </>
                    )}
                    {cabem.length > 0 && (
                        <fieldset>
                            <legend className="text-sm font-medium mb-1">O que o rito exige e este documento cumpre</legend>
                            {cabem.map((e) => (
                                <label key={e.chave} className="flex items-start gap-2 text-sm">
                                    <input type="checkbox" className="mt-1" checked={marcadas.includes(e.chave)}
                                        onChange={(ev) => set({ atende: ev.target.checked ? [...marcadas, e.chave] : marcadas.filter((c) => c !== e.chave) })} />
                                    <span>{e.descricao}{e.tipo ? ` (${e.tipo})` : ''}{exigeDoDocumento(e) ? <span className="block text-xs text-slate-600 dark:text-slate-400">{exigeDoDocumento(e)}</span> : null}</span>
                                </label>
                            ))}
                        </fieldset>
                    )}
                    {naAutuacao && d.destino !== 'minuta' && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">Se a primeira fase do rito exige um documento deste tipo, a juntada já o cumpre.</p>
                    )}
                </div>
                <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
                    {k > 0 && <Button variant="outline" disabled={ocupado} onClick={() => setK(k - 1)}>Anterior</Button>}
                    <Button variant="ghost" disabled={ocupado} onClick={onFechar}>Cancelar</Button>
                    {!ultimo
                        ? <Button disabled={ocupado || !tituloOk || !dataOk} onClick={() => setK(k + 1)}>Próximo</Button>
                        : <Button disabled={ocupado || !pronto} onClick={() => onConfirmar(soMinuta ? itens.map((x) => ({ ...x, destino: 'minuta', assinar: false })) : itens)}>{soMinuta ? 'Incluir como minuta' : naAutuacao ? 'Guardar os detalhes' : itens.length > 1 ? `Registrar os ${itens.length}` : DESTINOS_ENTRADA.find(([v]) => v === d.destino)?.[1]}</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
