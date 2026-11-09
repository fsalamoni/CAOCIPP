import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, ImagePlus, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { secConfig } from '@/services/secretariaService';
import { NativeSelect, documentoDaUnidade } from './comum';
import EditorDocumento, { CAMPOS_MODELO, FONTES, prepararImagem } from './EditorDocumento';

const CSS_FONTE = { serif: '"Times New Roman", Times, serif', 'sans-serif': 'Arial, Helvetica, sans-serif', monospace: '"Courier New", Courier, monospace' };

const paraForm = (d = {}) => ({
    cabecalho_linhas: [...(d.cabecalho_linhas || []), '', '', '', ''].slice(0, 4),
    brasao: d.brasao || null,
    rodape: d.rodape || '',
    fonte_padrao: d.fonte_padrao || 'serif',
    tamanho_padrao: d.tamanho_padrao || 12,
});

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
                <div className="mt-auto flex justify-between text-[8px] text-slate-500 border-t border-slate-200 pt-1">
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
export function FormTimbrado({ cfg, setCfg, idPrefixo = 'doc' }) {
    const brasaoRef = useRef(null);
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
                    <legend className="text-sm font-medium">Cabeçalho (até 4 linhas; a primeira em destaque)</legend>
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
                    <span className="text-xs text-slate-500">PNG ou JPG, até 300 KB</span>
                </div>
                <div><Label htmlFor={`${idPrefixo}-rodape`}>Rodapé</Label><Input id={`${idPrefixo}-rodape`} value={cfg.rodape} maxLength={200} onChange={(e) => setCfg({ ...cfg, rodape: e.target.value })} placeholder="Ex.: Rua …, nº … · telefone · e-mail" /></div>
                <div className="grid grid-cols-2 gap-3">
                    <NativeSelect id={`${idPrefixo}-fonte`} label="Fonte padrão" value={cfg.fonte_padrao} onChange={(v) => setCfg({ ...cfg, fonte_padrao: v })} options={FONTES.filter(([v]) => v)} />
                    <NativeSelect id={`${idPrefixo}-tam`} label="Tamanho padrão" value={String(cfg.tamanho_padrao)} onChange={(v) => setCfg({ ...cfg, tamanho_padrao: Number(v) })} options={[9, 10, 11, 12, 13, 14, 16].map((t) => [String(t), `${t} pt`])} />
                </div>
            </div>
            <div className="min-w-0">
                <p className="text-sm font-medium mb-2">Prévia da folha</p>
                <PreviaFolha cfg={cfg} />
            </div>
        </div>
    );
}

/** Papel timbrado e tipos de documento do órgão, mais os modelos do órgão. */
export default function ConfiguracaoDocumentos({ orgId, estado }) {
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
                    <FormTimbrado cfg={cfg} setCfg={setCfg} />
                    <div className="max-w-xl">
                        <Label htmlFor="doc-tipos">Tipos de documento do órgão (um por linha)</Label>
                        <Textarea id="doc-tipos" rows={6} value={tiposTexto} onChange={(e) => setTiposTexto(e.target.value)} placeholder={'Despacho\nDecisão\nCertidão\n…'} />
                        <p className="text-xs text-slate-500 mt-1">Todas as unidades usam estes tipos; cada unidade pode somar os seus. Vazio volta à lista padrão.</p>
                    </div>
                    <Button className="gap-1" disabled={salvando} onClick={salvarCfg}>{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar</Button>
                </CardContent>
            </Card>
            <ListaModelos orgId={orgId} estado={estado} unidadeId={null} />
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
    if (!dados) return <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>;

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
                    <span><span className="font-medium">Usar o do órgão</span><span className="block text-slate-500">{(orgao.cabecalho_linhas || []).filter(Boolean)[0] || 'Sem cabeçalho definido'}</span></span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                    <input type="radio" name={`timbre-${unidade.id}`} className="mt-1" checked={dados.proprio} onChange={() => setDados({ ...dados, proprio: true })} />
                    <span><span className="font-medium">Timbrado próprio da unidade</span><span className="block text-slate-500">Para documentos redigidos por esta unidade.</span></span>
                </label>
            </fieldset>
            {dados.proprio && <FormTimbrado cfg={dados.cfg} setCfg={(cfg) => setDados({ ...dados, cfg })} idPrefixo={`un-${unidade.id}`} />}
            <div className="max-w-xl">
                <Label htmlFor={`un-tipos-${unidade.id}`}>Tipos de documento próprios (um por linha)</Label>
                <Textarea id={`un-tipos-${unidade.id}`} rows={4} value={dados.tipos} onChange={(e) => setDados({ ...dados, tipos: e.target.value })} placeholder={'Ex.: Parecer técnico\nNota de assessoria'} />
                <p className="text-xs text-slate-500 mt-1">Somam-se aos do órgão: {(estado.documento?.tipos_documento || []).join(', ')}.</p>
            </div>
            <Button className="gap-1" disabled={salvando} onClick={salvar}>{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar documentos da unidade</Button>
        </div>
    );
}

/** Modelos do órgão (unidadeId null) ou de uma unidade. */
export function ListaModelos({ orgId, estado, unidadeId, semCartao = false }) {
    const qc = useQueryClient();
    const [modelo, setModelo] = useState(null);
    const lista = (estado.modelos || []).filter((m) => (unidadeId ? m.unidade_id === unidadeId : !m.unidade_id));
    const abrirModelo = async (m) => {
        if (!m) { setModelo({ _k: Date.now(), nome: '', tipo_documento: '', descricao: '', ativo: true, conteudo: null, unidade_id: unidadeId }); return; }
        try {
            setModelo({ ...(await secConfig(orgId, 'obterModelo', { id: m.id })), _k: Date.now() });
        } catch (e) { toast.error(e?.message || 'Não foi possível abrir o modelo'); }
    };
    const corpo = (
        <div className="grid md:grid-cols-2 gap-2">
            {lista.length === 0 && <p className="text-sm text-slate-500">Nenhum modelo ainda.</p>}
            {lista.map((m) => (
                <button key={m.id} onClick={() => abrirModelo(m)} className="w-full text-left p-3 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <div className="flex flex-wrap items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-600" aria-hidden />
                        <span className="font-medium">{m.nome}</span>
                        {m.tipo_documento && <Badge variant="outline">{m.tipo_documento}</Badge>}
                        {!m.ativo && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                    {m.descricao && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{m.descricao}</p>}
                </button>
            ))}
        </div>
    );
    const novo = <Button size="sm" className="gap-1 shrink-0" onClick={() => abrirModelo(null)}><Plus className="w-4 h-4" /> Novo modelo</Button>;
    const editor = <EditorModelo modelo={modelo} setModelo={setModelo} orgId={orgId} estado={estado} onSalvo={() => qc.invalidateQueries({ queryKey: ['sec-estado', orgId] })} />;
    if (semCartao) return <div className="space-y-3"><div className="flex justify-end">{novo}</div>{corpo}{editor}</div>;
    return (
        <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div>
                    <CardTitle className="text-base">Modelos de documento do órgão</CardTitle>
                    <CardDescription>Textos prontos para todas as unidades. Campos como {'{{numero}}'} e {'{{partes}}'} se preenchem sozinhos com os dados do processo. Cada unidade também pode ter os seus.</CardDescription>
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
    const conteudo = useRef(null);
    useEffect(() => { if (!modelo) conteudo.current = null; }, [modelo]);
    if (!modelo) return null;
    const docCfg = modelo.unidade_id ? documentoDaUnidade(estado, modelo.unidade_id) : (estado.documento || {});
    const tipos = docCfg.tipos_documento || [];
    const salvar = async () => {
        setSalvando(true);
        try {
            const texto = conteudo.current || modelo.conteudo || { type: 'doc', content: [{ type: 'paragraph' }] };
            const { _k, ...dados } = modelo;
            const r = await secConfig(orgId, 'salvarModelo', { id: modelo.id, modelo: { ...dados, conteudo: texto } });
            toast.success('Modelo salvo');
            setModelo({ ...modelo, id: r.id, conteudo: texto });
            onSalvo();
        } catch (e) { toast.error(e?.message || 'Não foi possível salvar'); } finally { setSalvando(false); }
    };
    return (
        <Dialog open onOpenChange={(o) => !o && setModelo(null)}>
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
                    <div className="flex gap-2 ml-auto">
                        <Button size="sm" className="gap-1" disabled={salvando || !modelo.nome.trim()} onClick={salvar}>{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setModelo(null)} aria-label="Fechar"><X className="w-4 h-4" /></Button>
                    </div>
                </div>
                <div className="flex-1 min-h-0 p-0 sm:p-2">
                    <EditorDocumento key={modelo._k} conteudo={modelo.conteudo} config={docCfg} campos={CAMPOS_MODELO}
                        onChange={(j) => { conteudo.current = j; }} onSalvar={salvar} autoFocus rotulo="Texto do modelo" />
                </div>
            </DialogContent>
        </Dialog>
    );
}
