import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Wrench, Megaphone, Power, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAvisos } from '@/lib/BrandingContext';
import { situacaoAviso, TONS_AVISO } from '@/lib/platformAvisos';
import { FaixaAviso } from '@/components/AvisoPlataforma';
import { platformAvisos } from '@/services/platformService';

// datetime-local trabalha no fuso de quem usa; o servidor recebe ISO.
const paraLocal = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const paraIso = (local) => (local ? new Date(local).toISOString() : null);
const fmt = (v) => {
    const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
    return d ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
};

const SITUACAO = {
    nenhum: { rotulo: 'Nenhum aviso', tom: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
    no_ar: { rotulo: 'No ar', tom: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
    agendado: { rotulo: 'Agendado', tom: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' },
    encerrado: { rotulo: 'Encerrado', tom: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
    expirado: { rotulo: 'Expirado', tom: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
};

function Bloco({ titulo, icone: Icone, descricao, acao, children }) {
    return (
        <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                    <h3 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Icone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden />{titulo}</h3>
                    {descricao && <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">{descricao}</p>}
                </div>
                {acao}
            </div>
            {children}
        </section>
    );
}

const vazio = { tom: 'info', titulo: '', texto: '', link_url: '', link_rotulo: '', inicio: '', fim: '', dispensavel: true };

export default function AvisosPanel() {
    const { aviso, manutencao } = useAvisos();
    const [f, setF] = useState(() => (aviso?.titulo
        ? { ...vazio, ...aviso, inicio: paraLocal(aviso.inicio), fim: paraLocal(aviso.fim) }
        : vazio));
    const [msg, setMsg] = useState(manutencao?.ativa ? manutencao.mensagem : '');
    const [previsao, setPrevisao] = useState(paraLocal(manutencao?.ativa ? manutencao.previsao : null));
    const [dialogo, setDialogo] = useState(null); // 'publicar' | 'encerrar' | 'ligar' | 'desligar'
    const [salvando, setSalvando] = useState(false);

    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
    const situacao = situacaoAviso(aviso);
    const emManutencao = manutencao?.ativa === true;

    const executar = async (fn, ok) => {
        setSalvando(true);
        try {
            await fn();
            toast.success(ok);
            setDialogo(null);
        } catch (e) {
            toast.error(e?.message || 'Não foi possível concluir.');
        } finally {
            setSalvando(false);
        }
    };

    const previa = { ...f, id: 'previa', ativo: true, titulo: f.titulo || 'Título do aviso' };

    return (
        <div className="space-y-6">
            <Bloco
                titulo="Modo manutenção" icone={Wrench}
                descricao="Enquanto estiver ligado, só a administração da plataforma usa o sistema. Os demais veem uma tela de manutenção com a sua mensagem. Nada é apagado."
                acao={<span className={`px-2.5 py-1 rounded-full text-xs font-medium ${emManutencao ? 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>{emManutencao ? 'Ligado' : 'Desligado'}</span>}
            >
                {emManutencao ? (
                    <div className="space-y-3">
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                            Ligado {manutencao.por ? `por ${manutencao.por} ` : ''}{manutencao.em ? `em ${fmt(manutencao.em)}` : ''}.
                            {manutencao.previsao ? ` Previsão de volta: ${fmt(manutencao.previsao)}.` : ''}
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-200"><span className="font-medium">Mensagem:</span> {manutencao.mensagem}</p>
                        <Button onClick={() => setDialogo('desligar')} className="gap-1.5"><Power className="w-4 h-4" aria-hidden />Desligar manutenção</Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="m-msg">Mensagem para quem tentar entrar</Label>
                            <Textarea id="m-msg" rows={2} maxLength={400} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="O sistema está em manutenção. Volte em instantes." />
                        </div>
                        <div className="space-y-1.5 max-w-xs">
                            <Label htmlFor="m-prev">Previsão de volta (opcional)</Label>
                            <Input id="m-prev" type="datetime-local" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
                        </div>
                        <Button variant="outline" onClick={() => setDialogo('ligar')} className="gap-1.5"><Wrench className="w-4 h-4" aria-hidden />Ligar manutenção</Button>
                    </div>
                )}
            </Bloco>

            <Bloco
                titulo="Aviso para todos" icone={Megaphone}
                descricao="Faixa no topo de todas as telas e na tela de entrada. Publicar um aviso novo substitui o atual e faz ele reaparecer para quem dispensou o anterior."
                acao={<span className={`px-2.5 py-1 rounded-full text-xs font-medium ${SITUACAO[situacao].tom}`}>{SITUACAO[situacao].rotulo}</span>}
            >
                {aviso?.titulo && (
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Atual: “{aviso.titulo}”{aviso.por ? `, publicado por ${aviso.por}` : ''}{aviso.em ? ` em ${fmt(aviso.em)}` : ''}.
                        {aviso.inicio ? ` De ${fmt(aviso.inicio)}` : ''}{aviso.fim ? ` até ${fmt(aviso.fim)}` : ''}.
                    </p>
                )}
                <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
                    <div className="space-y-4">
                        <fieldset className="space-y-1.5">
                            <legend className="text-sm font-medium text-slate-900 dark:text-white">Tom</legend>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(TONS_AVISO).map(([k, t]) => (
                                    <button
                                        key={k} type="button" onClick={() => set('tom', k)} aria-pressed={f.tom === k}
                                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${f.tom === k
                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                    >{t.rotulo}</button>
                                ))}
                            </div>
                        </fieldset>
                        <div className="space-y-1.5">
                            <Label htmlFor="a-titulo">Título</Label>
                            <Input id="a-titulo" maxLength={100} value={f.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex.: Nova versão do Processo Eletrônico" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="a-texto">Texto (opcional)</Label>
                            <Textarea id="a-texto" rows={3} maxLength={600} value={f.texto} onChange={(e) => set('texto', e.target.value)} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                            <div className="space-y-1.5">
                                <Label htmlFor="a-link">Link (opcional)</Label>
                                <Input id="a-link" maxLength={300} value={f.link_url} onChange={(e) => set('link_url', e.target.value)} placeholder="https://… ou /Help" />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="a-rotulo">Texto do link</Label>
                                <Input id="a-rotulo" maxLength={40} value={f.link_rotulo} onChange={(e) => set('link_rotulo', e.target.value)} placeholder="Saiba mais" />
                            </div>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="a-inicio">Começa em (opcional)</Label>
                                <Input id="a-inicio" type="datetime-local" value={f.inicio} onChange={(e) => set('inicio', e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="a-fim">Sai do ar em (opcional)</Label>
                                <Input id="a-fim" type="datetime-local" value={f.fim} onChange={(e) => set('fim', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Switch id="a-disp" checked={f.dispensavel} onCheckedChange={(v) => set('dispensavel', v)} />
                            <Label htmlFor="a-disp" className="leading-snug cursor-pointer">
                                Pode ser dispensado
                                <span className="block font-normal text-sm text-slate-600 dark:text-slate-300">Cada pessoa fecha a faixa no X. Desligue para avisos que precisam ficar visíveis.</span>
                            </Label>
                        </div>
                    </div>
                    <div className="space-y-3 xl:sticky xl:top-4">
                        <h4 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white"><Eye className="w-4 h-4" aria-hidden />Prévia</h4>
                        <FaixaAviso aviso={previa} onDispensar={() => {}} />
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={() => setDialogo('publicar')} disabled={!f.titulo.trim()} className="gap-1.5"><Megaphone className="w-4 h-4" aria-hidden />Publicar aviso</Button>
                            {aviso?.ativo && <Button variant="ghost" onClick={() => setDialogo('encerrar')}>Encerrar aviso atual</Button>}
                        </div>
                    </div>
                </div>
            </Bloco>

            <Dialog open={!!dialogo} onOpenChange={(v) => !v && setDialogo(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {{ publicar: 'Publicar o aviso', encerrar: 'Encerrar o aviso', ligar: 'Ligar o modo manutenção', desligar: 'Desligar o modo manutenção' }[dialogo]}
                        </DialogTitle>
                        <DialogDescription>
                            {{
                                publicar: aviso?.ativo ? 'O aviso atual sai do ar e este entra no lugar, para todas as pessoas.' : 'A faixa aparece para todas as pessoas, no período escolhido.',
                                encerrar: 'A faixa some para todos na hora.',
                                ligar: 'Na hora, todas as pessoas que não administram a plataforma passam a ver só a tela de manutenção. Quem estiver no meio de um trabalho perde o que não salvou.',
                                desligar: 'Todos voltam a usar o sistema na hora.',
                            }[dialogo]}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setDialogo(null)} disabled={salvando}>Cancelar</Button>
                        <Button
                            disabled={salvando}
                            onClick={() => ({
                                publicar: () => executar(() => platformAvisos('publicarAviso', { aviso: { ...f, inicio: paraIso(f.inicio), fim: paraIso(f.fim) } }), 'Aviso publicado.'),
                                encerrar: () => executar(() => platformAvisos('encerrarAviso'), 'Aviso encerrado.'),
                                ligar: () => executar(() => platformAvisos('ligarManutencao', { mensagem: msg, previsao: paraIso(previsao) }), 'Modo manutenção ligado.'),
                                desligar: () => executar(() => platformAvisos('desligarManutencao'), 'Modo manutenção desligado.'),
                            }[dialogo]())}
                        >
                            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
