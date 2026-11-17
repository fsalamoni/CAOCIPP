import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, RotateCcw, CheckCircle2, AlertTriangle, FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBranding } from '@/lib/BrandingContext';
import { BRANDING_PADRAO, contrasteComBranco, LOGO_MAX_BYTES } from '@/lib/platformBranding';
import { platformBranding } from '@/services/platformService';

const LOGO_PADRAO = '/logo.png';

const doBranding = (b) => ({
    nome_curto: b.nome_curto, nome_completo: b.nome_completo, cor: b.cor, logo: b.logo,
    inicio: { titulo: b.inicio.titulo, subtitulo: b.inicio.subtitulo },
    rodape: b.rodape, suporte: { ...b.suporte },
});

function Bloco({ titulo, descricao, children }) {
    return (
        <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
            <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{titulo}</h3>
                {descricao && <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{descricao}</p>}
            </div>
            {children}
        </section>
    );
}

function Campo({ id, rotulo, ajuda, children }) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{rotulo}</Label>
            {children}
            {ajuda && <p className="text-xs text-slate-500 dark:text-slate-400">{ajuda}</p>}
        </div>
    );
}

/** Prévia ao vivo: cabeçalho do app, tela de entrada e rodapé com os valores do formulário. */
function Previa({ f }) {
    const logo = f.logo || LOGO_PADRAO;
    const suporte = [f.suporte.email, f.suporte.telefone, f.suporte.site.replace(/^https:\/\//, '')].filter(Boolean).join(' · ');
    return (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 text-slate-900" aria-label="Prévia da identidade">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-white border-b border-slate-200">
                <img src={logo} alt="" width={36} height={36} className="rounded object-contain" />
                <span className="flex flex-col leading-none min-w-0">
                    <span className="text-lg font-bold truncate" style={{ color: f.cor }}>{f.nome_curto || BRANDING_PADRAO.nome_curto}</span>
                    <span className="text-[9px] text-slate-500 font-medium tracking-wider uppercase mt-0.5 truncate">{f.nome_completo || BRANDING_PADRAO.nome_completo}</span>
                </span>
            </div>
            <div className="px-4 py-6 text-center space-y-2">
                <p className="text-xl font-bold leading-tight break-words">
                    {f.inicio.titulo || <>{f.nome_curto || BRANDING_PADRAO.nome_curto}<br />{f.nome_completo || BRANDING_PADRAO.nome_completo}</>}
                </p>
                <p className="text-sm text-slate-600 break-words">{f.inicio.subtitulo || BRANDING_PADRAO.inicio.subtitulo}</p>
                <span className="inline-block mt-2 px-3 py-1.5 rounded-md text-xs font-medium text-white" style={{ background: f.cor }}>Entrar com Google</span>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 bg-white text-center text-xs text-slate-600 space-y-1 break-words">
                <p>{f.rodape || `© ${new Date().getFullYear()} ${f.nome_curto || BRANDING_PADRAO.nome_curto} - ${f.nome_completo || BRANDING_PADRAO.nome_completo}`}</p>
                {suporte && <p>Suporte: {suporte}</p>}
            </div>
        </div>
    );
}

export default function BrandingPanel() {
    const atual = useBranding();
    const [f, setF] = useState(() => doBranding(atual));
    const [salvando, setSalvando] = useState(false);
    const [termos, setTermos] = useState(atual.termos?.texto || '');
    const [exigir, setExigir] = useState(atual.termos?.exigir_aceite ?? true);
    const [confirmar, setConfirmar] = useState(false);
    const [publicando, setPublicando] = useState(false);
    const arquivo = useRef(null);

    // Quando o documento chega (ou outro super-admin salva), o formulário acompanha
    // se ninguém estiver editando.
    const original = JSON.stringify(doBranding(atual));
    const sujo = JSON.stringify(f) !== original;
    const [base, setBase] = useState(original);
    useEffect(() => {
        if (original !== base && !sujo) setF(doBranding(atual));
        setBase(original);
    }, [original]);
    useEffect(() => {
        if (!termos && atual.termos?.texto) setTermos(atual.termos.texto);
    }, [atual.termos?.versao]);

    const set = (caminho, valor) => setF((x) => {
        const [a, b] = caminho.split('.');
        return b ? { ...x, [a]: { ...x[a], [b]: valor } } : { ...x, [a]: valor };
    });

    const contraste = contrasteComBranco(f.cor);
    const corOk = contraste >= 4.5;

    const escolherLogo = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { toast.error('Use uma imagem PNG, JPEG ou WebP.'); return; }
        if (file.size > LOGO_MAX_BYTES) { toast.error('A imagem passa de 220 KB. Reduza e tente de novo.'); return; }
        const leitor = new FileReader();
        leitor.onload = () => set('logo', String(leitor.result));
        leitor.readAsDataURL(file);
    };

    const salvar = async () => {
        setSalvando(true);
        try {
            await platformBranding('salvar', { identidade: f });
            toast.success('Identidade salva. Já vale para todos.');
        } catch (e) {
            toast.error(e?.message || 'Não foi possível salvar.');
        } finally {
            setSalvando(false);
        }
    };

    const publicar = async () => {
        setPublicando(true);
        try {
            const r = await platformBranding('publicarTermos', { texto: termos, exigir_aceite: exigir });
            toast.success(`Versão ${r.versao} dos termos publicada.`);
            setConfirmar(false);
        } catch (e) {
            toast.error(e?.message || 'Não foi possível publicar.');
        } finally {
            setPublicando(false);
        }
    };

    const proxima = (atual.termos?.versao || 0) + 1;
    const publicadaEm = atual.termos?.publicado_em?.toDate?.();

    return (
        <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
                <div className="space-y-6">
                    <Bloco titulo="Nome, cor e logo" descricao="Aparecem no topo de todas as telas, na tela de entrada e na aba do navegador.">
                        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                            <Campo id="b-curto" rotulo="Nome curto" ajuda="Até 20 caracteres.">
                                <Input id="b-curto" value={f.nome_curto} maxLength={20} onChange={(e) => set('nome_curto', e.target.value)} />
                            </Campo>
                            <Campo id="b-completo" rotulo="Nome completo" ajuda="Até 80 caracteres.">
                                <Input id="b-completo" value={f.nome_completo} maxLength={80} onChange={(e) => set('nome_completo', e.target.value)} />
                            </Campo>
                        </div>
                        <Campo id="b-cor" rotulo="Cor principal">
                            <div className="flex flex-wrap items-center gap-3">
                                <input
                                    type="color" value={/^#[0-9a-fA-F]{6}$/.test(f.cor) ? f.cor : '#000000'} onChange={(e) => set('cor', e.target.value.toUpperCase())}
                                    aria-label="Escolher a cor principal" className="h-10 w-14 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer"
                                />
                                <Input id="b-cor" value={f.cor} maxLength={7} onChange={(e) => set('cor', e.target.value.trim())} className="w-32 font-mono" aria-describedby="b-cor-contraste" />
                                <Button type="button" variant="ghost" size="sm" onClick={() => set('cor', BRANDING_PADRAO.cor)} className="gap-1.5"><RotateCcw className="w-4 h-4" aria-hidden />Cor padrão</Button>
                            </div>
                            <p id="b-cor-contraste" className={`flex items-center gap-1.5 text-sm ${corOk ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                                {corOk ? <CheckCircle2 className="w-4 h-4" aria-hidden /> : <AlertTriangle className="w-4 h-4" aria-hidden />}
                                {contraste ? `Contraste com o branco: ${contraste.toFixed(1)} para 1. ` : ''}
                                {corOk ? 'Legível.' : 'Escolha um tom mais escuro (mínimo 4,5 para 1).'}
                            </p>
                        </Campo>
                        <Campo id="b-logo" rotulo="Logo" ajuda="PNG, JPEG ou WebP, quadrada, até 220 KB. Sem logo próprio, vale o logo oficial do SIGO.">
                            <div className="flex flex-wrap items-center gap-3">
                                <img src={f.logo || LOGO_PADRAO} alt="Logo atual" width={56} height={56} className="rounded-md border border-slate-200 dark:border-slate-700 object-contain bg-white" />
                                <input ref={arquivo} id="b-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={escolherLogo} className="sr-only" />
                                <Button type="button" variant="outline" onClick={() => arquivo.current?.click()} className="gap-1.5"><Upload className="w-4 h-4" aria-hidden />Enviar logo</Button>
                                {f.logo && <Button type="button" variant="ghost" onClick={() => set('logo', null)} className="gap-1.5"><RotateCcw className="w-4 h-4" aria-hidden />Voltar ao logo oficial</Button>}
                            </div>
                        </Campo>
                    </Bloco>

                    <Bloco titulo="Tela de entrada e rodapé" descricao="Campo vazio usa o texto padrão.">
                        <Campo id="b-titulo" rotulo="Título da tela de entrada" ajuda="Vazio: o nome curto e o nome completo.">
                            <Input id="b-titulo" value={f.inicio.titulo} maxLength={120} onChange={(e) => set('inicio.titulo', e.target.value)} placeholder={`${f.nome_curto} ${f.nome_completo}`} />
                        </Campo>
                        <Campo id="b-sub" rotulo="Texto de apresentação" ajuda={`${f.inicio.subtitulo.length}/400`}>
                            <Textarea id="b-sub" rows={3} value={f.inicio.subtitulo} maxLength={400} onChange={(e) => set('inicio.subtitulo', e.target.value)} />
                        </Campo>
                        <Campo id="b-rodape" rotulo="Rodapé" ajuda="Vazio: © ano, nome curto e nome completo.">
                            <Input id="b-rodape" value={f.rodape} maxLength={200} onChange={(e) => set('rodape', e.target.value)} />
                        </Campo>
                    </Bloco>

                    <Bloco titulo="Contato de suporte" descricao="Aparece no rodapé da tela de entrada. Preencha só o que existir.">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Campo id="b-email" rotulo="E-mail">
                                <Input id="b-email" type="email" value={f.suporte.email} maxLength={120} onChange={(e) => set('suporte.email', e.target.value)} placeholder="suporte@exemplo.gov.br" />
                            </Campo>
                            <Campo id="b-tel" rotulo="Telefone">
                                <Input id="b-tel" type="tel" value={f.suporte.telefone} maxLength={40} onChange={(e) => set('suporte.telefone', e.target.value)} />
                            </Campo>
                        </div>
                        <Campo id="b-site" rotulo="Página de ajuda ou chamados" ajuda="Começa com https://">
                            <Input id="b-site" type="url" value={f.suporte.site} maxLength={200} onChange={(e) => set('suporte.site', e.target.value)} placeholder="https://" />
                        </Campo>
                    </Bloco>
                </div>

                <div className="space-y-3 xl:sticky xl:top-4">
                    <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Eye className="w-4 h-4" aria-hidden />Prévia</h3>
                    <Previa f={f} />
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={salvar} disabled={salvando || !sujo || !corOk} className="gap-1.5">
                            {salvando && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}Salvar identidade
                        </Button>
                        <Button variant="ghost" onClick={() => setF(doBranding(atual))} disabled={salvando || !sujo}>Desfazer alterações</Button>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{sujo ? 'Há alterações não salvas.' : 'Tudo salvo.'}</p>
                </div>
            </div>

            <Bloco
                titulo="Termos de uso"
                descricao={atual.termos
                    ? `Versão ${atual.termos.versao} publicada${publicadaEm ? ` em ${publicadaEm.toLocaleDateString('pt-BR')}` : ''}${atual.termos.publicado_por ? ` por ${atual.termos.publicado_por}` : ''}. ${atual.termos.exigir_aceite ? 'Aceite obrigatório.' : 'Sem aceite obrigatório.'}`
                    : 'Ainda valem os termos padrão do sistema. Publique o texto oficial para substituí-los.'}
            >
                <Campo id="b-termos" rotulo="Texto dos termos" ajuda={`${termos.length.toLocaleString('pt-BR')}/60.000. Parágrafos separados por uma linha em branco.`}>
                    <Textarea id="b-termos" rows={12} value={termos} maxLength={60000} onChange={(e) => setTermos(e.target.value)} className="font-normal leading-relaxed" />
                </Campo>
                <div className="flex items-start gap-3">
                    <Switch id="b-exigir" checked={exigir} onCheckedChange={setExigir} />
                    <Label htmlFor="b-exigir" className="leading-snug cursor-pointer">
                        Exigir aceite
                        <span className="block font-normal text-sm text-slate-600 dark:text-slate-300">Cada pessoa vê os termos ao entrar e só continua depois de aceitar esta versão.</span>
                    </Label>
                </div>
                <Button onClick={() => setConfirmar(true)} disabled={termos.trim().length < 50 || termos.trim() === (atual.termos?.texto || '') && exigir === (atual.termos?.exigir_aceite ?? true)} className="gap-1.5">
                    <FileText className="w-4 h-4" aria-hidden />Publicar versão {proxima}
                </Button>
            </Bloco>

            <Dialog open={confirmar} onOpenChange={(v) => !v && setConfirmar(false)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Publicar a versão {proxima} dos termos</DialogTitle>
                        <DialogDescription>
                            {exigir
                                ? 'Todas as pessoas, inclusive você, vão ver os termos na próxima vez que abrirem o SIGO e só seguem depois de aceitar.'
                                : 'O texto passa a valer na página Termos de Uso, sem pedir aceite.'}
                            {' '}Cada versão publicada fica guardada, com data e autor.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setConfirmar(false)} disabled={publicando}>Cancelar</Button>
                        <Button onClick={publicar} disabled={publicando}>
                            {publicando && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Publicar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
