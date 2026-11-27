import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Download, Eye, FileDown, FileText, FileUp, ImagePlus, Loader2, Paperclip, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { baixarResposta, secConfig } from '@/services/secretariaService';
import { VisualizadorPdf } from './RedacaoDocumento';
import { baixarPacote, nomeArquivoPacote, pacoteDeDocumento } from '@/lib/pacoteModelos';
import { NativeSelect, documentoDaUnidade } from './comum';
import EditorDocumento, { CAMPOS_MODELO, CSS_FONTE, FONTES, prepararImagem } from './EditorDocumento';
import { variaveisDisponiveis } from '@/lib/exigencias';
import { PAGINAS_FAIXA, POSICOES_NUMERO, folhaCm, margensDe, resumoPagina, textoNumero } from '@/lib/layoutDocumento';
import ConfigurarPagina from './LayoutDocumento';
import ImportarModelo, { EditorOriginal, rotuloFormatoOriginal } from './ImportarModelo';
import VersoesDialog from './VersoesDialog';
import { CartaoComMenu, ConfirmarExclusao, Excluidos } from './Lixeira';

/** "Rito › Fase" de cada fase que indica o modelo, por id de modelo. */
function fasesQueIndicam(estado) {
    const m = new Map();
    for (const r of estado.ritos || []) {
        for (const f of r.fases || []) for (const id of f.modelos || []) m.set(id, [...(m.get(id) || []), `${r.nome} › ${f.nome}`]);
    }
    return m;
}


const paraForm = (d = {}) => ({
    cabecalho_linhas: [...(d.cabecalho_linhas || []), '', '', '', ''].slice(0, 4),
    brasao: d.brasao || null,
    rodape: d.rodape || '',
    fonte_padrao: d.fonte_padrao || 'serif',
    tamanho_padrao: d.tamanho_padrao || 12,
    layout: d.layout || null,
});

/** Texto de exemplo para ver o papel timbrado na folha e no PDF. */
const AMOSTRA = {
    type: 'doc',
    content: [
        { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: 'Despacho' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Trata-se de procedimento instaurado para apurar os fatos narrados na representação, com a observância do contraditório e da ampla defesa.' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Fundamentação' }] },
        ...Array.from({ length: 3 }, () => ({ type: 'paragraph', content: [{ type: 'text', text: 'Os autos foram instruídos com os documentos apresentados pelas partes. Cumpre registrar que as diligências foram realizadas nos prazos previstos, sem prejuízo das providências que se mostrarem necessárias.' }] })),
        { type: 'paragraph', attrs: { textAlign: 'center' }, content: [{ type: 'text', text: 'Cidade, data.' }] },
    ],
};
const resumoFaixa = (f, simples) => (f?.modo === 'proprio' ? 'editor completo' : f?.modo === 'nenhum' ? 'nenhum' : simples);

/** Prévia em miniatura de uma folha com o papel timbrado. */
export function PreviaFolha({ cfg }) {
    const linhas = (cfg.cabecalho_linhas || []).filter(Boolean);
    return (
        <div className="rounded-md border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-950 p-3 sm:p-5">
            <div className="bg-white text-slate-900 shadow mx-auto max-w-sm aspect-[21/29.7] p-[8%] pl-[12%] flex flex-col text-[10px]" style={{ fontFamily: CSS_FONTE[cfg.fonte_padrao] }}>
                <div className="text-center">
                    {cfg.brasao && <img src={cfg.brasao} alt="Brasão" className="mx-auto h-8 w-auto mb-1" />}
                    {linhas.map((l, i) => <p key={i} className={i === 0 ? 'font-bold text-[11px]' : 'text-[9px]'}>{l}</p>)}
                    {!linhas.length && !cfg.brasao && <p className="text-slate-400">Sem cabeçalho</p>}
                </div>
                <div className="mt-4 space-y-1.5" aria-hidden>
                    <div className="h-2 w-1/2 bg-slate-300 rounded mx-auto" />
                    {Array.from({ length: 9 }, (_, i) => <div key={i} className="h-1.5 bg-slate-200 rounded" style={{ width: `${[100, 96, 100, 88, 100, 92, 70, 100, 60][i]}%` }} />)}
                </div>
                <div className="mt-auto flex justify-between text-[8px] text-slate-600 dark:text-slate-400 border-t border-slate-200 pt-1">
                    <span className="truncate">{cfg.rodape}</span><span className="shrink-0 ml-2">Página 1 de 1</span>
                </div>
            </div>
        </div>
    );
}

/**
 * Formulário de papel timbrado (cabeçalho, brasão, rodapé, fonte) com prévia.
 * Usado pelo órgão e pelas unidades com timbrado próprio.
 */
export function FormTimbrado({ cfg, setCfg, idPrefixo = 'doc', orgId, unidadeId = null }) {
    const brasaoRef = useRef(null);
    const [pagina, setPagina] = useState(null); // aba aberta de "Página, cabeçalho e estilos"
    const [pdf, setPdf] = useState(null);
    const [gerando, setGerando] = useState(false);
    // O editor do cabeçalho/rodapé guarda a função da primeira renderização: parte sempre do formulário atual.
    const cfgRef = useRef(cfg);
    cfgRef.current = cfg;
    const l = cfg.layout || {};
    const { w } = folhaCm(l);
    const mg = margensDe(l);
    // A prévia encolhe até a folha caber inteira na coluna (antes, 50% fixo cortava a margem direita).
    const previaRef = useRef(null);
    const [zoom, setZoom] = useState(0.5);
    useEffect(() => {
        const el = previaRef.current;
        if (!el || typeof ResizeObserver === 'undefined') return undefined;
        const medir = () => setZoom(Math.max(0.2, Math.min(0.5, el.clientWidth / (w * 37.8 + 48))));
        const ro = new ResizeObserver(medir);
        ro.observe(el);
        medir();
        return () => ro.disconnect();
    }, [w]);
    const np = l.numero_pagina || {};
    const simples = (cfg.cabecalho_linhas || []).some(Boolean) || cfg.brasao ? 'as linhas e o brasão acima' : 'vazio';
    const verPdf = async () => {
        setGerando(true);
        try {
            const r = await secConfig(orgId, 'previaModelo', { formato: 'pdf', modelo: { nome: 'papel-timbrado', unidade_id: unidadeId, conteudo: AMOSTRA }, timbrado: cfg });
            setPdf({ ...r, titulo: 'Prévia do papel timbrado' });
        } catch (e) { toast.error(e?.message || 'Não foi possível gerar a prévia'); } finally { setGerando(false); }
    };
    const escolherBrasao = async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try {
            const { src } = await prepararImagem(f);
            if (src.length * 0.75 > 300 * 1024) throw new Error('Use uma imagem de até 300 KB');
            setCfg({ ...cfg, brasao: src });
        } catch (err) { toast.error(err.message); }
    };
    return (
        <div className="grid lg:grid-cols-2 gap-5">
            <div className="space-y-3 min-w-0">
                <fieldset className="space-y-2">
                    <legend className="text-sm font-medium">Cabeçalho simples (até 4 linhas; a primeira em destaque)</legend>
                    {cfg.cabecalho_linhas.map((l, i) => (
                        <Input key={i} aria-label={`Linha ${i + 1} do cabeçalho`} value={l} maxLength={120}
                            placeholder={['Ex.: Ministério Público do Estado', 'Ex.: Promotoria de Justiça de …', 'Ex.: Secretaria', 'Ex.: endereço ou contato'][i]}
                            onChange={(e) => setCfg({ ...cfg, cabecalho_linhas: cfg.cabecalho_linhas.map((x, j) => (j === i ? e.target.value : x)) })} />
                    ))}
                </fieldset>
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => brasaoRef.current?.click()}><ImagePlus className="w-4 h-4" /> {cfg.brasao ? 'Trocar brasão' : 'Enviar brasão ou logotipo'}</Button>
                    {cfg.brasao && <Button type="button" size="sm" variant="ghost" className="gap-1" onClick={() => setCfg({ ...cfg, brasao: null })}><Trash2 className="w-4 h-4" /> Remover</Button>}
                    <input ref={brasaoRef} type="file" accept="image/png,image/jpeg" className="sr-only" tabIndex={-1} onChange={escolherBrasao} />
                    <span className="text-xs text-slate-600 dark:text-slate-400">PNG ou JPG, até 300 KB</span>
                </div>
                <div><Label htmlFor={`${idPrefixo}-rodape`}>Rodapé simples</Label><Input id={`${idPrefixo}-rodape`} value={cfg.rodape} maxLength={200} onChange={(e) => setCfg({ ...cfg, rodape: e.target.value })} placeholder="Ex.: Rua …, nº … · telefone · e-mail" /></div>
                <div className="grid grid-cols-2 gap-3">
                    <NativeSelect id={`${idPrefixo}-fonte`} label="Fonte padrão" value={cfg.fonte_padrao} onChange={(v) => setCfg({ ...cfg, fonte_padrao: v })} options={FONTES.filter(([v]) => v)} />
                    <NativeSelect id={`${idPrefixo}-tam`} label="Tamanho padrão" value={String(cfg.tamanho_padrao)} onChange={(v) => setCfg({ ...cfg, tamanho_padrao: Number(v) })} options={[9, 10, 11, 12, 13, 14, 16].map((t) => [String(t), `${t} pt`])} />
                </div>
                <fieldset className="rounded-md border border-slate-300 dark:border-slate-700 p-3 space-y-2">
                    <legend className="text-sm font-medium px-1">Página, cabeçalho, rodapé e estilos</legend>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                        As mesmas ferramentas dos modelos, para todos os documentos com este timbrado. Cada modelo ou documento pode mudar por cima.
                    </p>
                    <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5">
                        <li><span className="font-medium">Página:</span> {resumoPagina(l)}</li>
                        <li><span className="font-medium">Cabeçalho:</span> {resumoFaixa(l.cabecalho, simples)}{l.cabecalho?.paginas && l.cabecalho.paginas !== 'todas' ? ` (${(PAGINAS_FAIXA.find(([v]) => v === l.cabecalho.paginas) || [])[1]?.toLowerCase()})` : ''}</li>
                        <li><span className="font-medium">Rodapé:</span> {resumoFaixa(l.rodape, cfg.rodape ? 'o texto acima' : 'vazio')}{l.rodape?.paginas && l.rodape.paginas !== 'todas' ? ` (${(PAGINAS_FAIXA.find(([v]) => v === l.rodape.paginas) || [])[1]?.toLowerCase()})` : ''}</li>
                        <li><span className="font-medium">Número de página:</span> {np.posicao === 'nenhum' ? 'sem número' : `${(POSICOES_NUMERO.find(([v]) => v === (np.posicao || 'rodape-direita')) || [])[1]?.toLowerCase()}, "${textoNumero(np.formato, 1, 5)}"`}</li>
                        <li><span className="font-medium">Estilos:</span> {Object.keys(l.estilos || {}).length + (l.proprios || []).length ? `${Object.keys(l.estilos || {}).length} ajustado(s), ${(l.proprios || []).length} próprio(s)` : 'os do SIGO'}</li>
                    </ul>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => setPagina('pagina')}>Papel e margens</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setPagina('faixas')}>Cabeçalho, rodapé e número</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setPagina('estilos')}>Estilos e numeração</Button>
                    </div>
                </fieldset>
            </div>
            <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-medium flex-1">Prévia da folha</p>
                    {orgId && (
                        <Button type="button" size="sm" variant="outline" className="gap-1" disabled={gerando} title="Como sai no PDF dos autos, folha por folha, antes de salvar" onClick={verPdf}>
                            {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" aria-hidden />} Ver em PDF
                        </Button>
                    )}
                </div>
                <div ref={previaRef} className="h-[460px] sm:h-[560px] overflow-hidden rounded-md">
                    <div className="origin-top-left" style={{ zoom, height: `${100 / zoom}%` }}>
                        <EditorDocumento somenteLeitura previa conteudo={AMOSTRA} config={cfg} rotulo="Exemplo de documento com o papel timbrado" />
                    </div>
                </div>
            </div>
            <ConfigurarPagina aberto={!!pagina} aba={pagina || 'pagina'} onAba={setPagina} layout={l} modoTimbrado
                onMudar={(novo) => setCfg({ ...cfgRef.current, layout: novo })} onFechar={() => setPagina(null)}
                fontes={FONTES} cssFonte={CSS_FONTE} editor={null} config={cfg} campos={CAMPOS_MODELO} EditorFaixa={EditorDocumento} larguraUtil={w - mg.esq - mg.dir} />
            <VisualizadorPdf pdf={pdf} onFechar={() => setPdf(null)} />
        </div>
    );
}

/** Papel timbrado e tipos de documento do órgão, mais os modelos do órgão. */
export default function ConfiguracaoDocumentos({ orgId, estado, pedido = null, onPedidoAtendido }) {
    const qc = useQueryClient();
    const [cfg, setCfg] = useState(null);
    const [tiposTexto, setTiposTexto] = useState('');
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        setCfg(paraForm(estado.documento || {}));
        setTiposTexto((estado.documento?.tipos_documento || []).join('\n'));
    }, [estado.documento]);

    if (!cfg) return null;
    const salvarCfg = async () => {
        setSalvando(true);
        try {
            await secConfig(orgId, 'salvarDocumentoConfig', { documento: { ...cfg, tipos_documento: tiposTexto.split('\n').map((t) => t.trim()).filter(Boolean) } });
            toast.success('Papel timbrado e tipos salvos');
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
        } catch (e) { toast.error(e?.message || 'Não foi possível salvar'); } finally { setSalvando(false); }
    };

    return (
        <div className="space-y-5">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Papel timbrado e tipos de documento do órgão</CardTitle>
                    <CardDescription>Vale para todas as unidades que não tiverem timbrado próprio, na tela e no PDF que entra nos autos. Petições das partes não levam timbre.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <FormTimbrado cfg={cfg} setCfg={setCfg} orgId={orgId} />
                    <div className="max-w-xl">
                        <Label htmlFor="doc-tipos">Tipos de documento do órgão (um por linha)</Label>
                        <Textarea id="doc-tipos" rows={6} value={tiposTexto} onChange={(e) => setTiposTexto(e.target.value)} placeholder={'Despacho\nDecisão\nCertidão\n…'} />
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Todas as unidades usam estes tipos; cada unidade pode somar os seus. Vazio volta à lista padrão.</p>
                    </div>
                    <Button className="gap-1" disabled={salvando} onClick={salvarCfg}>{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar</Button>
                </CardContent>
            </Card>
            <ListaModelos orgId={orgId} estado={estado} unidadeId={null} pedido={pedido} onPedidoAtendido={onPedidoAtendido} />
        </div>
    );
}

/** Timbrado próprio e tipos da unidade (gestor ou admin). */
export function DocumentosDaUnidade({ orgId, estado, unidade }) {
    const qc = useQueryClient();
    const [dados, setDados] = useState(null);
    const [erro, setErro] = useState(null);
    const [salvando, setSalvando] = useState(false);

    useEffect(() => {
        let vivo = true;
        setDados(null);
        secConfig(orgId, 'obterUnidadeDocumento', { unidadeId: unidade.id })
            .then((r) => vivo && setDados({
                proprio: r.timbrado_proprio,
                cfg: paraForm(r.documento || estado.documento || {}),
                tipos: (r.tipos_documento || []).join('\n'),
            }))
            .catch((e) => vivo && setErro(e?.message || 'Não foi possível carregar'));
        return () => { vivo = false; };
    }, [orgId, unidade.id, estado.documento]);

    if (erro) return <p className="text-sm text-red-600">{erro}</p>;
    if (!dados) return <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>;

    const salvar = async () => {
        setSalvando(true);
        try {
            await secConfig(orgId, 'salvarUnidadeDocumento', {
                unidadeId: unidade.id, timbrado_proprio: dados.proprio, documento: dados.proprio ? dados.cfg : null,
                tipos_documento: dados.tipos.split('\n').map((t) => t.trim()).filter(Boolean),
            });
            toast.success('Documentos da unidade salvos');
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
        } catch (e) { toast.error(e?.message || 'Não foi possível salvar'); } finally { setSalvando(false); }
    };
    const orgao = documentoDaUnidade({ documento: estado.documento }, null);

    return (
        <div className="space-y-5">
            <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Papel timbrado</legend>
                <label className="flex items-start gap-2 text-sm">
                    <input type="radio" name={`timbre-${unidade.id}`} className="mt-1" checked={!dados.proprio} onChange={() => setDados({ ...dados, proprio: false })} />
                    <span><span className="font-medium">Usar o do órgão</span><span className="block text-slate-600 dark:text-slate-400">{(orgao.cabecalho_linhas || []).filter(Boolean)[0] || 'Sem cabeçalho definido'}</span></span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                    <input type="radio" name={`timbre-${unidade.id}`} className="mt-1" checked={dados.proprio} onChange={() => setDados({ ...dados, proprio: true })} />
                    <span><span className="font-medium">Timbrado próprio da unidade</span><span className="block text-slate-600 dark:text-slate-400">Para documentos redigidos por esta unidade.</span></span>
                </label>
            </fieldset>
            {dados.proprio && <FormTimbrado cfg={dados.cfg} setCfg={(cfg) => setDados((d) => ({ ...d, cfg }))} idPrefixo={`un-${unidade.id}`} orgId={orgId} unidadeId={unidade.id} />}
            <div className="max-w-xl">
                <Label htmlFor={`un-tipos-${unidade.id}`}>Tipos de documento próprios (um por linha)</Label>
                <Textarea id={`un-tipos-${unidade.id}`} rows={4} value={dados.tipos} onChange={(e) => setDados({ ...dados, tipos: e.target.value })} placeholder={'Ex.: Parecer técnico\nNota de assessoria'} />
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Somam-se aos do órgão: {(estado.documento?.tipos_documento || []).join(', ')}.</p>
            </div>
            <Button className="gap-1" disabled={salvando} onClick={salvar}>{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar documentos da unidade</Button>
        </div>
    );
}

/** Modelos da entidade (unidadeId null), de um órgão interno (orgaoId) ou de uma unidade. */
export function ListaModelos({ orgId, estado, unidadeId, orgaoId = null, semCartao = false, pedido = null, onPedidoAtendido }) {
    const qc = useQueryClient();
    const [modelo, setModelo] = useState(null);
    const [importando, setImportando] = useState(false);
    const [excluir, setExcluir] = useState(null);
    const desta = (m) => (unidadeId ? m.unidade_id === unidadeId : !m.unidade_id && (m.orgao_id || null) === orgaoId);
    const lista = (estado.modelos || []).filter(desta);
    const indicadoEm = fasesQueIndicam(estado);
    const recarregar = () => qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
    const abrirModelo = async (m) => {
        if (!m) { setModelo({ _k: Date.now(), nome: '', tipo_documento: '', descricao: '', ativo: true, conteudo: null, unidade_id: unidadeId, orgao_id: orgaoId }); return; }
        try {
            setModelo({ ...(await secConfig(orgId, 'obterModelo', { id: m.id })), _k: Date.now() });
        } catch (e) { toast.error(e?.message || 'Não foi possível abrir o modelo'); }
    };
    // "Abrir" do Histórico: abre o modelo pedido, se ainda está nesta lista.
    useEffect(() => {
        if (!pedido) return;
        const m = lista.find((x) => x.id === pedido);
        if (m) abrirModelo(m);
        onPedidoAtendido?.();
    }, [pedido]);
    // Cópia de modelo do editor: abre o texto como modelo novo, para ajustar e salvar.
    const duplicar = async (m) => {
        try {
            const o = await secConfig(orgId, 'obterModelo', { id: m.id });
            setModelo({ ...o, id: undefined, nome: `${o.nome} (cópia)`, _k: Date.now() });
        } catch (e) { toast.error(e?.message || 'Não foi possível abrir o modelo'); }
    };
    // Levar a outro órgão: só o nome, o tipo, a descrição e o texto (sem unidade, autor ou ids deste órgão).
    const exportar = async (m) => {
        try {
            const o = await secConfig(orgId, 'obterModelo', { id: m.id });
            baixarPacote(pacoteDeDocumento(o), nomeArquivoPacote('modelo', o.nome));
            toast.success(`Modelo "${o.nome}" baixado. No outro órgão, use "Importar de arquivo" em Documentos.`);
        } catch (e) { toast.error(e?.message || 'Não foi possível exportar o modelo'); }
    };
    const corpo = (
        <div className="grid md:grid-cols-2 gap-2">
            {lista.length === 0 && <p className="text-sm text-slate-600 dark:text-slate-400">Nenhum modelo ainda.</p>}
            {lista.map((m) => (
                <CartaoComMenu key={m.id} nome={m.nome} onEditar={() => abrirModelo(m)} onDuplicar={m.formato === 'original' ? null : () => duplicar(m)}
                    extras={m.formato === 'original' ? [] : [{ rotulo: 'Exportar para outro órgão', icone: Download, onSelect: () => exportar(m) }]}
                    onExcluir={() => setExcluir({ colecao: 'modelo', id: m.id, nome: m.nome })}
                    className="w-full text-left p-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <div className="flex flex-wrap items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" aria-hidden />
                        <span className="font-medium">{m.nome}</span>
                        {m.tipo_documento && <Badge variant="outline">{m.tipo_documento}</Badge>}
                        {m.formato === 'original' && <Badge variant="secondary" className="gap-1"><Paperclip className="w-3 h-3" aria-hidden />{rotuloFormatoOriginal(m.arquivo_nome)}</Badge>}
                        {!m.ativo && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                    {m.descricao && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{m.descricao}</p>}
                    {indicadoEm.has(m.id) && <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">Indicado em: {indicadoEm.get(m.id).slice(0, 3).join(' · ')}{indicadoEm.get(m.id).length > 3 ? ` e mais ${indicadoEm.get(m.id).length - 3}` : ''}</p>}
                </CartaoComMenu>
            ))}
            <Excluidos orgId={orgId} estado={estado} colecao="modelo" filtro={desta} />
            <ConfirmarExclusao orgId={orgId} alvo={excluir} onFechar={() => setExcluir(null)} />
        </div>
    );
    const novo = (
        <div className="flex flex-wrap gap-2 shrink-0">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setImportando(true)}><FileUp className="w-4 h-4" /> Importar de arquivo</Button>
            <Button size="sm" className="gap-1" onClick={() => abrirModelo(null)}><Plus className="w-4 h-4" /> Novo modelo</Button>
        </div>
    );
    const docCfg = unidadeId ? documentoDaUnidade(estado, unidadeId) : (estado.documento || {});
    const editor = (
        <>
            {modelo?.formato === 'original'
                ? <EditorOriginal modelo={modelo} setModelo={setModelo} orgId={orgId} tipos={docCfg.tipos_documento || []} onSalvo={recarregar} />
                : <EditorModelo modelo={modelo} setModelo={setModelo} orgId={orgId} estado={estado} onSalvo={recarregar} />}
            <ImportarModelo aberto={importando} orgId={orgId} estado={estado} unidadeId={unidadeId} orgaoId={orgaoId} onSalvo={recarregar}
                onEditar={(m) => setModelo({ ...m, _k: Date.now() })} onFechar={() => setImportando(false)} />
        </>
    );
    if (semCartao) return <div className="space-y-3"><div className="flex justify-end">{novo}</div>{corpo}{editor}</div>;
    return (
        <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="min-w-[14rem] flex-1">
                    <CardTitle className="text-base">Modelos de documento do órgão</CardTitle>
                    <CardDescription>Textos prontos para todas as unidades. Campos como {'{{numero}}'} e {'{{partes}}'} se preenchem sozinhos com os dados do processo. Crie no editor ou importe de um Word ou PDF. Cada unidade também pode ter os seus.</CardDescription>
                </div>
                {novo}
            </CardHeader>
            <CardContent>{corpo}</CardContent>
            {editor}
        </Card>
    );
}

function EditorModelo({ modelo, setModelo, orgId, estado, onSalvo }) {
    const [salvando, setSalvando] = useState(false);
    const [previa, setPrevia] = useState(null); // 'pdf' | 'docx' em andamento
    const [pdf, setPdf] = useState(null);
    const camposModelo = useMemo(() => [...CAMPOS_MODELO, ...variaveisDisponiveis(estado, CAMPOS_MODELO.map(([k]) => k))], [estado]);
    const conteudo = useRef(null);
    const sujo = useRef(false);
    useEffect(() => { if (!modelo) { conteudo.current = null; sujo.current = false; } }, [modelo]);
    if (!modelo) return null;
    // Texto de modelo costuma ser longo: fechar sem salvar pede confirmação.
    const fechar = () => { if (!sujo.current || window.confirm('O texto do modelo tem alterações não salvas. Fechar sem salvar?')) setModelo(null); };
    const docCfg = modelo.unidade_id ? documentoDaUnidade(estado, modelo.unidade_id) : (estado.documento || {});
    const tipos = docCfg.tipos_documento || [];
    const salvar = async () => {
        setSalvando(true);
        try {
            const texto = conteudo.current || modelo.conteudo || { type: 'doc', content: [{ type: 'paragraph' }] };
            const { _k, ...dados } = modelo;
            const r = await secConfig(orgId, 'salvarModelo', { id: modelo.id, modelo: { ...dados, conteudo: texto } });
            toast.success('Modelo salvo');
            sujo.current = false;
            setModelo({ ...modelo, id: r.id, conteudo: texto });
            onSalvo();
        } catch (e) { toast.error(e?.message || 'Não foi possível salvar'); } finally { setSalvando(false); }
    };
    // Como o modelo sai nos autos (timbrado, cabeçalho, rodapé, número de página) ou no Word, sem salvar.
    const verPrevia = async (formato) => {
        setPrevia(formato);
        try {
            const texto = conteudo.current || modelo.conteudo || { type: 'doc', content: [{ type: 'paragraph' }] };
            const r = await secConfig(orgId, 'previaModelo', { formato, modelo: { nome: modelo.nome, unidade_id: modelo.unidade_id || null, orgao_id: modelo.orgao_id || null, conteudo: texto } });
            if (formato === 'pdf') setPdf({ ...r, titulo: `Prévia: ${modelo.nome || 'modelo'}` });
            else baixarResposta(r);
        } catch (e) { toast.error(e?.message || 'Não foi possível gerar a prévia'); } finally { setPrevia(null); }
    };
    return (
        <Dialog open onOpenChange={(o) => !o && fechar()}>
            <DialogContent className="max-w-none w-screen h-[100dvh] sm:w-[96vw] sm:h-[96vh] sm:max-w-[1240px] p-0 gap-0 flex flex-col overflow-hidden sm:rounded-lg [&>button:last-child]:hidden">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-3 py-2">
                    <DialogTitle className="sr-only">{modelo.id ? 'Editar modelo' : 'Novo modelo'}</DialogTitle>
                    <DialogDescription className="sr-only">Modelo de documento</DialogDescription>
                    <Input aria-label="Nome do modelo" placeholder="Nome do modelo" value={modelo.nome} onChange={(e) => setModelo({ ...modelo, nome: e.target.value })} className="h-9 flex-1 min-w-[12rem]" />
                    <select aria-label="Tipo de documento" value={modelo.tipo_documento || ''} onChange={(e) => setModelo({ ...modelo, tipo_documento: e.target.value })} className="h-9 rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm w-full sm:w-auto">
                        <option value="">Qualquer tipo</option>
                        {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <Input aria-label="Descrição" placeholder="Para que serve (opcional)" value={modelo.descricao || ''} onChange={(e) => setModelo({ ...modelo, descricao: e.target.value })} className="h-9 flex-1 min-w-[12rem]" />
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={modelo.ativo !== false} onCheckedChange={(c) => setModelo({ ...modelo, ativo: c === true })} /> Ativo</label>
                    <div className="flex flex-wrap gap-2 ml-auto">
                        <Button size="sm" variant="outline" className="gap-1" disabled={!!previa} title="Como o modelo sai no PDF dos autos, com timbrado, cabeçalho, rodapé e número de página" onClick={() => verPrevia('pdf')}>
                            {previa === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" aria-hidden />} Prévia em PDF
                        </Button>
                        <Button size="sm" variant="ghost" className="gap-1" disabled={!!previa} title="Baixa o modelo em Word (.docx), para conferir no Word ou no LibreOffice" onClick={() => verPrevia('docx')}>
                            {previa === 'docx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" aria-hidden />} Word
                        </Button>
                        {modelo.id && <VersoesDialog orgId={orgId} colecao="modelo" id={modelo.id} nome={modelo.nome} estado={estado} onRestaurado={() => { onSalvo(); setModelo(null); }} />}
                        {modelo.id && (
                            <Button size="sm" variant="ghost" className="gap-1" title="Cria uma cópia deste modelo, para ajustar e salvar"
                                onClick={() => setModelo({ ...modelo, id: undefined, nome: `${modelo.nome} (cópia)`, conteudo: conteudo.current || modelo.conteudo, _k: Date.now() })}>
                                <Copy className="w-4 h-4" aria-hidden /> Duplicar
                            </Button>
                        )}
                        <Button size="sm" className="gap-1" disabled={salvando || !modelo.nome.trim()} onClick={salvar}>{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={fechar} aria-label="Fechar"><X className="w-4 h-4" /></Button>
                    </div>
                </div>
                <div className="flex-1 min-h-0 p-0 sm:p-2">
                    <EditorDocumento key={modelo._k} conteudo={modelo.conteudo} config={docCfg} campos={camposModelo}
                        onChange={(j) => { conteudo.current = j; sujo.current = true; }} onSalvar={salvar} autoFocus rotulo="Texto do modelo" />
                </div>
                <VisualizadorPdf pdf={pdf} onFechar={() => setPdf(null)} />
            </DialogContent>
        </Dialog>
    );
}
