import React, { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { arquivoParaBase64, baixarBase64, secConfig } from '@/services/secretariaService';
import { CAMPOS_MODELO } from './EditorDocumento';
import { PreviaFolha } from './ConfiguracaoDocumentos';

const MAX_MB = 5;
const ACEITOS = '.docx,.pdf,.html,.htm,.txt';
const MIME_POR_EXT = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf',
    html: 'text/html', htm: 'text/html', txt: 'text/plain',
};
const ROTULO_CAMPO = Object.fromEntries(CAMPOS_MODELO);
export const rotuloFormatoOriginal = (mime) => (mime === 'application/pdf' || /\.pdf$/i.test(mime || '') ? 'PDF original' : 'Word original');

/** Lê o arquivo escolhido e devolve {base64, mime, nome}, ou null com aviso. */
async function lerArquivo(file) {
    if (!file) return null;
    const ext = file.name.split('.').pop().toLowerCase();
    const mime = MIME_POR_EXT[ext];
    if (!mime) { toast.error('Use Word (.docx), PDF, HTML ou TXT. Documentos .doc antigos: salve como .docx no Word.'); return null; }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Arquivo acima de ${MAX_MB} MB`); return null; }
    return { base64: await arquivoParaBase64(file), mime, nome: file.name };
}

/**
 * Importação de modelo: o servidor lê o arquivo e propõe o texto, os campos
 * automáticos e o papel timbrado achado; a pessoa escolhe guardar como modelo
 * editável (abre no editor para revisar) ou manter o arquivo original.
 */
export default function ImportarModelo({ aberto, orgId, estado, unidadeId, orgaoId = null, onEditar, onSalvo, onFechar }) {
    const [arquivo, setArquivo] = useState(null);
    const [proposta, setProposta] = useState(null);
    const [lendo, setLendo] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [nome, setNome] = useState('');
    const [modo, setModo] = useState('editor');
    const [aplicarTimbre, setAplicarTimbre] = useState(false);

    const fechar = () => { setArquivo(null); setProposta(null); setModo('editor'); setAplicarTimbre(false); onFechar(); };

    const escolher = async (e) => {
        const a = await lerArquivo(e.target.files?.[0]);
        e.target.value = '';
        if (!a) return;
        setLendo(true);
        setProposta(null);
        try {
            const r = await secConfig(orgId, 'importarModelo', { unidade_id: unidadeId || null, arquivo: a });
            setArquivo(a);
            setProposta(r);
            setNome(r.nome || '');
            setModo('editor');
            setAplicarTimbre(false);
        } catch (err) {
            // Sem texto legível ainda dá para guardar o original.
            if (/PDF não tem texto/.test(err?.message || '')) {
                setArquivo(a);
                setProposta({ semTexto: true, original_possivel: true, avisos: [err.message], campos: [], desconhecidos: [], timbrado: null });
                setNome(a.nome.replace(/\.[a-z0-9]{2,5}$/i, ''));
                setModo('original');
            } else toast.error(err?.message || 'Não foi possível ler o arquivo');
        } finally { setLendo(false); }
    };

    const aplicarTimbrado = async () => {
        const t = proposta.timbrado;
        const atual = estado.documento || {};
        const mesclar = (base) => ({ ...base, cabecalho_linhas: t.cabecalho_linhas, rodape: t.rodape || base.rodape || '', brasao: t.brasao || base.brasao || null, ...(t.fonte_padrao ? { fonte_padrao: t.fonte_padrao } : {}), ...(t.tamanho_padrao ? { tamanho_padrao: t.tamanho_padrao } : {}) });
        if (!unidadeId) {
            await secConfig(orgId, 'salvarDocumentoConfig', { documento: mesclar(atual) });
            return;
        }
        const u = await secConfig(orgId, 'obterUnidadeDocumento', { unidadeId });
        await secConfig(orgId, 'salvarUnidadeDocumento', {
            unidadeId, timbrado_proprio: true, documento: mesclar(u.timbrado_proprio && u.documento ? u.documento : atual), tipos_documento: u.tipos_documento || [],
        });
    };

    const continuar = async () => {
        setSalvando(true);
        try {
            if (aplicarTimbre && proposta.timbrado) await aplicarTimbrado();
            if (modo === 'original') {
                await secConfig(orgId, 'salvarModelo', { modelo: { nome: nome.trim(), formato: 'original', unidade_id: unidadeId || null, orgao_id: orgaoId, ativo: true, arquivo } });
                toast.success('Modelo guardado no arquivo original');
                onSalvo();
                fechar();
                return;
            }
            if (aplicarTimbre && proposta.timbrado) toast.success('Papel timbrado atualizado');
            onSalvo();
            onEditar({ nome: nome.trim(), tipo_documento: '', descricao: `Importado de ${arquivo.nome}`, ativo: true, conteudo: proposta.conteudo, unidade_id: unidadeId || null, orgao_id: orgaoId });
            fechar();
        } catch (e) { toast.error(e?.message || 'Não foi possível salvar'); } finally { setSalvando(false); }
    };

    const t = proposta?.timbrado;
    const temTimbre = t && (t.cabecalho_linhas?.length || t.brasao || t.rodape);
    const destinoTimbre = unidadeId ? 'desta unidade (timbrado próprio)' : 'do órgão';

    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && fechar()}>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Importar modelo de arquivo</DialogTitle>
                    <DialogDescription>
                        Envie um Word (.docx), PDF, HTML ou TXT. O sistema lê o texto, o cabeçalho, o rodapé e as imagens e marca campos como
                        {' '}<span className="font-mono">{'{{numero}}'}</span>, <span className="font-mono">«Data»</span> ou <span className="font-mono">[NÚMERO DO PROCESSO]</span> para preenchimento automático.
                    </DialogDescription>
                </DialogHeader>

                <label className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 focus-within:ring-2 focus-within:ring-indigo-400 ${lendo ? 'opacity-60 pointer-events-none' : ''}`}>
                    {lendo ? <Loader2 className="w-6 h-6 animate-spin text-indigo-600" aria-hidden /> : <FileUp className="w-6 h-6 text-indigo-600" aria-hidden />}
                    <span className="text-sm font-medium">{lendo ? 'Lendo o arquivo…' : arquivo ? `Trocar arquivo (${arquivo.nome})` : 'Escolher arquivo'}</span>
                    <span className="text-xs text-slate-600">Até {MAX_MB} MB</span>
                    <input type="file" accept={ACEITOS} className="sr-only" onChange={escolher} disabled={lendo} />
                </label>

                {proposta && (
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="imp-nome">Nome do modelo</Label>
                            <Input id="imp-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
                        </div>

                        <fieldset className="space-y-2">
                            <legend className="text-sm font-medium">Como guardar</legend>
                            <label className={`flex items-start gap-2 rounded-md border p-3 text-sm ${proposta.semTexto ? 'opacity-50' : 'cursor-pointer'} ${modo === 'editor' ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                                <input type="radio" name="imp-modo" className="mt-1" checked={modo === 'editor'} disabled={proposta.semTexto} onChange={() => setModo('editor')} />
                                <span><span className="font-medium">Modelo editável (recomendado)</span>
                                    <span className="block text-slate-600">Abre no editor para revisar. Sai com o papel timbrado e os campos preenchidos sozinhos.</span></span>
                            </label>
                            {proposta.original_possivel && (
                                <label className={`flex items-start gap-2 rounded-md border p-3 text-sm cursor-pointer ${modo === 'original' ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <input type="radio" name="imp-modo" className="mt-1" checked={modo === 'original'} onChange={() => setModo('original')} />
                                    <span><span className="font-medium">Manter o arquivo original ({rotuloFormatoOriginal(arquivo?.mime)})</span>
                                        <span className="block text-slate-600">
                                            {arquivo?.mime === 'application/pdf'
                                                ? 'O PDF entra como minuta do processo, sem alteração.'
                                                : 'O Word entra como minuta do processo com os campos já preenchidos, no layout exato do arquivo.'}
                                        </span></span>
                                </label>
                            )}
                        </fieldset>

                        {!proposta.semTexto && (
                            <div className="space-y-1">
                                <p className="text-sm font-medium">Campos automáticos encontrados</p>
                                {proposta.campos.length
                                    ? <div className="flex flex-wrap gap-1">{proposta.campos.map((c) => <Badge key={c} variant="secondary" className="gap-1"><CheckCircle2 className="w-3 h-3" aria-hidden />{ROTULO_CAMPO[c] || c}</Badge>)}</div>
                                    : <p className="text-xs text-slate-600">Nenhum. Você pode inserir campos depois no editor (botão Campos).</p>}
                            </div>
                        )}

                        {temTimbre && (
                            <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                                <p className="text-sm font-medium">Papel timbrado encontrado no arquivo</p>
                                <div className="grid sm:grid-cols-[10rem_1fr] gap-3 items-start">
                                    <PreviaFolha cfg={{ ...(estado.documento || {}), ...t, brasao: t.brasao || null }} />
                                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                                        {t.cabecalho_linhas?.map((l, i) => <p key={i}>{l}</p>)}
                                        {t.rodape && <p className="text-slate-600">Rodapé: {t.rodape}</p>}
                                        {t.brasao && <p className="text-slate-600">Com imagem (brasão).</p>}
                                    </div>
                                </div>
                                <label className="flex items-start gap-2 text-sm">
                                    <Checkbox checked={aplicarTimbre} onCheckedChange={(c) => setAplicarTimbre(c === true)} className="mt-0.5" />
                                    <span>Usar como papel timbrado {destinoTimbre}. <span className="text-slate-600">Substitui o cabeçalho e o rodapé atuais.</span></span>
                                </label>
                            </div>
                        )}

                        {proposta.avisos?.length > 0 && (
                            <ul className="text-xs space-y-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 p-3">
                                {proposta.avisos.map((a, i) => <li key={i} className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />{a}</li>)}
                            </ul>
                        )}
                    </div>
                )}

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={fechar}><X className="w-4 h-4 mr-1" />Cancelar</Button>
                    <Button className="gap-1" disabled={!proposta || salvando || !nome.trim()} onClick={continuar}>
                        {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {modo === 'original' ? 'Guardar modelo' : 'Revisar no editor'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Ficha de um modelo guardado no arquivo original: dados, baixar e trocar o arquivo. */
export function EditorOriginal({ modelo, setModelo, orgId, tipos, onSalvo }) {
    const [salvando, setSalvando] = useState(false);
    const [novoArquivo, setNovoArquivo] = useState(null);
    const baixar = async () => {
        try {
            const r = await secConfig(orgId, 'baixarModelo', { id: modelo.id });
            baixarBase64(r.base64, r.nome, r.mime);
        } catch (e) { toast.error(e?.message || 'Não foi possível baixar'); }
    };
    const salvar = async () => {
        setSalvando(true);
        try {
            const { _k, conteudo: _c, ...dados } = modelo;
            await secConfig(orgId, 'salvarModelo', { id: modelo.id, modelo: { ...dados, ...(novoArquivo ? { arquivo: novoArquivo } : {}) } });
            toast.success('Modelo salvo');
            onSalvo();
            setModelo(null);
        } catch (e) { toast.error(e?.message || 'Não foi possível salvar'); } finally { setSalvando(false); }
    };
    return (
        <Dialog open onOpenChange={(o) => !o && setModelo(null)}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Modelo em arquivo</DialogTitle>
                    <DialogDescription>{rotuloFormatoOriginal(modelo.arquivo_nome)}: {modelo.arquivo_nome}. Quem redige escolhe este modelo na lista de minutas do processo.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div><Label htmlFor="orig-nome">Nome</Label><Input id="orig-nome" value={modelo.nome} onChange={(e) => setModelo({ ...modelo, nome: e.target.value })} /></div>
                    <div>
                        <Label htmlFor="orig-tipo">Tipo de documento</Label>
                        <select id="orig-tipo" value={modelo.tipo_documento || ''} onChange={(e) => setModelo({ ...modelo, tipo_documento: e.target.value })} className="h-9 w-full rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm">
                            <option value="">Qualquer tipo</option>
                            {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div><Label htmlFor="orig-desc">Para que serve</Label><Input id="orig-desc" value={modelo.descricao || ''} onChange={(e) => setModelo({ ...modelo, descricao: e.target.value })} /></div>
                    <label className="flex items-center gap-2 text-sm"><Checkbox checked={modelo.ativo !== false} onCheckedChange={(c) => setModelo({ ...modelo, ativo: c === true })} /> Ativo</label>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-1" onClick={baixar}><Download className="w-4 h-4" /> Baixar arquivo</Button>
                        <Button variant="outline" size="sm" className="gap-1" asChild>
                            <label className="cursor-pointer"><FileUp className="w-4 h-4" /> {novoArquivo ? `Novo: ${novoArquivo.nome}` : 'Trocar arquivo'}
                                <input type="file" accept=".docx,.pdf" className="sr-only" onChange={async (e) => { const a = await lerArquivo(e.target.files?.[0]); e.target.value = ''; if (a && ['application/pdf', MIME_POR_EXT.docx].includes(a.mime)) setNovoArquivo(a); else if (a) toast.error('Use .docx ou .pdf'); }} />
                            </label>
                        </Button>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setModelo(null)}>Fechar</Button>
                    <Button className="gap-1" disabled={salvando || !modelo.nome.trim()} onClick={salvar}>{salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
