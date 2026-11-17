import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    ArrowLeft, Loader2, AlertCircle, PauseCircle, PlayCircle, Crown, Trash2, AlertTriangle,
    Users, FileText, ScrollText, Handshake, Scale, Gavel, Database, Mail, Phone, Globe, Activity, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { roleLabel } from '@/constants';
import { platformOrg, deleteOrganization } from '@/services/platformService';

const fmtNum = (n) => (n === null || n === undefined ? '—' : new Intl.NumberFormat('pt-BR').format(n));
const fmtData = (iso, hora = false) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return hora ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString('pt-BR');
};

const MODULOS = {
    processes: 'Consultas', expedientes: 'Expedientes', parcerias: 'Parcerias', jurimetria: 'Jurimetria',
    panorama: 'Panorama', summary: 'Resumos', calendar: 'Calendário',
};

function Selo({ tom = 'neutro', children }) {
    const tons = {
        neutro: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
        ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
        alerta: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
    };
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tons[tom]}`}>{children}</span>;
}

function Bloco({ titulo, icone: Icone, children, acao }) {
    return (
        <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                    {Icone && <Icone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden />}{titulo}
                </h4>
                {acao}
            </div>
            {children}
        </section>
    );
}

/** Ficha de um órgão: situação, ações da plataforma, volumes, membros e atividade. */
export default function OrgDetail({ orgId, onBack, onChanged }) {
    const qc = useQueryClient();
    const { data: f, isLoading, error, refetch } = useQuery({
        queryKey: ['platformOrg', orgId],
        queryFn: () => platformOrg('ficha', orgId),
    });
    const [dialogo, setDialogo] = useState(null); // 'suspender' | 'reativar' | 'criador' | 'excluir'
    const [motivo, setMotivo] = useState('');
    const [novoCriador, setNovoCriador] = useState('');
    const [confirmaNome, setConfirmaNome] = useState('');
    const [salvando, setSalvando] = useState(false);

    const fechar = () => { setDialogo(null); setMotivo(''); setNovoCriador(''); setConfirmaNome(''); };
    const executar = async (fn, okMsg) => {
        setSalvando(true);
        try {
            await fn();
            toast.success(okMsg);
            fechar();
            await refetch();
            qc.invalidateQueries({ queryKey: ['platformOrgsReport'] });
            onChanged?.();
        } catch (e) {
            toast.error(e?.message || 'Não foi possível concluir. Tente de novo.');
        } finally {
            setSalvando(false);
        }
    };

    const voltar = (
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
            <ArrowLeft className="w-4 h-4" aria-hidden /> Todos os órgãos
        </Button>
    );

    if (isLoading) {
        return <div className="space-y-4">{voltar}<div role="status" className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden />Carregando a ficha do órgão...</div></div>;
    }
    if (error || !f) {
        return (
            <div className="space-y-4">{voltar}
                <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center text-red-700 dark:text-red-400">
                    <AlertCircle className="w-6 h-6" aria-hidden />{error?.message || 'Não foi possível abrir este órgão.'}
                    <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
                </div>
            </div>
        );
    }

    const ativos = f.membros.filter((m) => m.ativo);
    const elegiveis = ativos.filter((m) => m.papel !== 'creator');
    const criador = f.membros.find((m) => m.papel === 'creator' && m.ativo);
    const volumes = [
        { k: 'processos', label: 'Consultas', icon: FileText },
        { k: 'expedientes', label: 'Expedientes', icon: ScrollText },
        { k: 'parcerias', label: 'Parcerias', icon: Handshake },
        { k: 'juris', label: 'Júris', icon: Scale },
        { k: 'processos_eletronicos', label: 'Processos eletrônicos', icon: Gavel },
        { k: 'bases_panorama', label: 'Bases do Panorama', icon: Database },
    ];
    const contato = f.contato || {};

    return (
        <div className="space-y-5">
            {voltar}

            <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white break-words">{f.nome}</h3>
                        {f.suspensao ? <Selo tom="alerta"><PauseCircle className="w-3.5 h-3.5" aria-hidden />Suspenso</Selo> : <Selo tom="ok">Ativo</Selo>}
                        {f.processo_eletronico.ligado && (
                            <Selo tom={f.processo_eletronico.suspenso ? 'alerta' : 'neutro'}>
                                Processo Eletrônico {f.processo_eletronico.suspenso ? 'suspenso' : 'ligado'}
                            </Selo>
                        )}
                    </div>
                    {f.descricao && <p className="text-sm text-slate-600 dark:text-slate-300">{f.descricao}</p>}
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Criado em {fmtData(f.criado_em)}{criador ? ` · criador: ${criador.nome || criador.email}` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    {f.suspensao
                        ? <Button onClick={() => setDialogo('reativar')} className="gap-1.5"><PlayCircle className="w-4 h-4" aria-hidden />Reativar</Button>
                        : <Button variant="outline" onClick={() => setDialogo('suspender')} className="gap-1.5"><PauseCircle className="w-4 h-4" aria-hidden />Suspender</Button>}
                    <Button variant="outline" onClick={() => setDialogo('criador')} disabled={elegiveis.length === 0} className="gap-1.5" title={elegiveis.length === 0 ? 'Não há outro membro ativo' : undefined}>
                        <Crown className="w-4 h-4" aria-hidden />Trocar criador
                    </Button>
                    <Button variant="outline" asChild className="gap-1.5">
                        <Link to={`/Admin?secao=copias&orgao=${encodeURIComponent(orgId)}`}><Download className="w-4 h-4" aria-hidden />Exportar dados</Link>
                    </Button>
                    <Button variant="ghost" onClick={() => setDialogo('excluir')} className="gap-1.5 text-red-700 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950">
                        <Trash2 className="w-4 h-4" aria-hidden />Excluir
                    </Button>
                </div>
            </header>

            {f.suspensao && (
                <div role="status" className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-950 dark:text-amber-50">
                    <p className="font-semibold">Suspenso em {fmtData(f.suspensao.em, true)}{f.suspensao.por ? ` por ${f.suspensao.por}` : ''}.</p>
                    <p>Motivo mostrado aos membros: {f.suspensao.motivo}</p>
                    <p className="text-amber-900 dark:text-amber-100 mt-1">Ninguém do órgão abre nada, as partes não acessam o Portal e ninguém entra pelo código de convite. Os dados continuam guardados.</p>
                </div>
            )}

            <ul className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3" aria-label="Volumes do órgão">
                {volumes.map(({ k, label, icon: Icon }) => (
                    <li key={k} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                        <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden />
                        <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{fmtNum(f.volumes[k])}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">{label}</p>
                    </li>
                ))}
            </ul>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Bloco titulo={`Membros (${ativos.length} ativos)`} icone={Users}>
                    {f.membros.length === 0 ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">Nenhum membro.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {f.membros.map((m) => (
                                <li key={m.uid} className={`py-2.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 ${m.ativo ? '' : 'opacity-60'}`}>
                                    <div className="min-w-0 flex-1">
                                        <Link to={`/Admin?secao=users&pessoa=${encodeURIComponent(m.uid)}`} className="block font-medium text-indigo-700 dark:text-indigo-300 hover:underline truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">{m.nome || 'Sem nome'}</Link>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 truncate">{m.email}{m.funcao ? ` · ${m.funcao}` : ''}</p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                        <Selo tom={m.papel === 'creator' ? 'ok' : 'neutro'}>{roleLabel(m.papel)}</Selo>
                                        {m.atribuicoes > 0 && <Selo>{m.atribuicoes} atribuições</Selo>}
                                        {!m.ativo && <Selo>Saiu em {fmtData(m.saiu_em)}</Selo>}
                                        {m.ativo && <span className="text-slate-500 dark:text-slate-400">desde {fmtData(m.entrou_em)}</span>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Bloco>

                <div className="space-y-4">
                    <Bloco titulo="Páginas ligadas">
                        {f.modulos ? (
                            <ul className="flex flex-wrap gap-1.5">
                                {Object.entries(MODULOS).map(([k, label]) => (
                                    <li key={k}><Selo tom={f.modulos[k] ? 'ok' : 'neutro'}>{label}: {f.modulos[k] ? 'ligada' : 'desligada'}</Selo></li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-slate-600 dark:text-slate-300">Configuração antiga: todas as páginas padrão estão ligadas.</p>
                        )}
                    </Bloco>
                    {(contato.email || contato.phone || contato.website) && (
                        <Bloco titulo="Contato">
                            <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200 break-words">
                                {contato.email && <li className="flex gap-2"><Mail className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />{contato.email}</li>}
                                {contato.phone && <li className="flex gap-2"><Phone className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />{contato.phone}</li>}
                                {contato.website && <li className="flex gap-2"><Globe className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />{contato.website}</li>}
                            </ul>
                        </Bloco>
                    )}
                    <Bloco titulo="Atividade recente" icone={Activity}>
                        {f.atividade.length === 0 ? (
                            <p className="text-sm text-slate-600 dark:text-slate-300">Nada registrado ainda.</p>
                        ) : (
                            <ol className="space-y-2 text-sm">
                                {f.atividade.map((a) => (
                                    <li key={a.id}>
                                        <p className="font-mono text-xs text-slate-800 dark:text-slate-100 break-all">{a.acao}{a.plataforma && <span className="ml-1 font-sans text-amber-700 dark:text-amber-300">(plataforma)</span>}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{a.quem || '—'} · {fmtData(a.quando, true)}</p>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Bloco>
                </div>
            </div>

            {/* Diálogos */}
            <Dialog open={dialogo === 'suspender'} onOpenChange={(v) => !v && fechar()}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Suspender {f.nome}</DialogTitle>
                        <DialogDescription>
                            Ninguém do órgão abre nada (nem o criador), as partes perdem o acesso ao Portal e o convite deixa de funcionar.
                            Nenhum dado é apagado e você pode reativar quando quiser.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="motivo-suspensao">Motivo (os membros vão ler este texto)</Label>
                        <Textarea id="motivo-suspensao" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={3} placeholder="Ex.: órgão em reestruturação; procure a administração do SIGO." />
                        <p className="text-xs text-slate-500 dark:text-slate-400">{motivo.length}/300</p>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={fechar} disabled={salvando}>Cancelar</Button>
                        <Button onClick={() => executar(() => platformOrg('suspender', orgId, { motivo }), 'Órgão suspenso.')} disabled={salvando || motivo.trim().length < 5}>
                            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Suspender
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={dialogo === 'reativar'} onOpenChange={(v) => !v && fechar()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reativar {f.nome}</DialogTitle>
                        <DialogDescription>Os membros voltam a abrir o órgão na hora, com tudo como estava.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={fechar} disabled={salvando}>Cancelar</Button>
                        <Button onClick={() => executar(() => platformOrg('reativar', orgId), 'Órgão reativado.')} disabled={salvando}>
                            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Reativar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={dialogo === 'criador'} onOpenChange={(v) => !v && fechar()}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Trocar o criador de {f.nome}</DialogTitle>
                        <DialogDescription>
                            O criador tem todos os poderes no órgão. {criador ? `${criador.nome || criador.email} continua no órgão como administrador.` : 'Hoje o órgão não tem criador ativo.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="novo-criador">Novo criador</Label>
                        <select
                            id="novo-criador" value={novoCriador} onChange={(e) => setNovoCriador(e.target.value)}
                            className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">Escolha um membro ativo</option>
                            {elegiveis.map((m) => <option key={m.uid} value={m.uid}>{m.nome || m.email} ({roleLabel(m.papel)})</option>)}
                        </select>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={fechar} disabled={salvando}>Cancelar</Button>
                        <Button onClick={() => executar(() => platformOrg('trocarCriador', orgId, { novoCriadorUid: novoCriador }), 'Criador trocado.')} disabled={salvando || !novoCriador}>
                            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Trocar criador
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={dialogo === 'excluir'} onOpenChange={(v) => !v && fechar()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400"><AlertTriangle className="w-5 h-5" aria-hidden />Excluir {f.nome}</DialogTitle>
                        <DialogDescription>
                            Apaga para sempre o órgão e todo o seu banco: registros, históricos e vínculos. Não há como desfazer.
                            Se quiser só impedir o acesso, use Suspender.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="confirma-nome">Digite o nome do órgão para confirmar</Label>
                        <Input id="confirma-nome" value={confirmaNome} onChange={(e) => setConfirmaNome(e.target.value)} placeholder={f.nome} autoComplete="off" />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={fechar} disabled={salvando}>Cancelar</Button>
                        <Button
                            variant="destructive" disabled={salvando || confirmaNome !== f.nome}
                            onClick={async () => {
                                setSalvando(true);
                                try {
                                    await deleteOrganization(orgId, confirmaNome);
                                    toast.success('Órgão excluído.');
                                    fechar();
                                    qc.invalidateQueries({ queryKey: ['platformOrgsReport'] });
                                    onBack();
                                } catch (e) {
                                    toast.error(e?.message || 'Não foi possível excluir.');
                                } finally {
                                    setSalvando(false);
                                }
                            }}
                        >
                            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Excluir para sempre
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
