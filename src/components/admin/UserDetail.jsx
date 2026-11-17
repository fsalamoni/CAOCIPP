import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, AlertCircle, Ban, CheckCircle2, ShieldCheck, Building2, KeyRound, Activity, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { roleLabel } from '@/constants';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { platformUser } from '@/services/platformService';

const fmtData = (iso, hora = false) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return hora ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString('pt-BR');
};

function Selo({ tom = 'neutro', children }) {
    const tons = {
        neutro: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
        ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
        alerta: 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
        perigo: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    };
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tons[tom]}`}>{children}</span>;
}

function Bloco({ titulo, icone: Icone, children }) {
    return (
        <section className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <h4 className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                {Icone && <Icone className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden />}{titulo}
            </h4>
            {children}
        </section>
    );
}

function Dado({ rotulo, children }) {
    return (
        <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-3 py-1.5 text-sm">
            <dt className="text-slate-600 dark:text-slate-300">{rotulo}</dt>
            <dd className="font-medium text-slate-900 dark:text-white sm:text-right break-words">{children}</dd>
        </div>
    );
}

/** Ficha de uma pessoa: conta, vínculos com órgãos, bloqueio no SIGO e atividade. */
export default function UserDetail({ uid, onBack }) {
    const qc = useQueryClient();
    const { user } = useAuth();
    const { data: f, isLoading, error, refetch } = useQuery({
        queryKey: ['platformUser', uid],
        queryFn: () => platformUser('ficha', uid),
    });
    const [dialogo, setDialogo] = useState(null); // 'bloquear' | 'desbloquear'
    const [motivo, setMotivo] = useState('');
    const [salvando, setSalvando] = useState(false);

    const fechar = () => { setDialogo(null); setMotivo(''); };
    const executar = async (fn, okMsg) => {
        setSalvando(true);
        try {
            await fn();
            toast.success(okMsg);
            fechar();
            await refetch();
            qc.invalidateQueries({ queryKey: ['platformUsers'] });
        } catch (e) {
            toast.error(e?.message || 'Não foi possível concluir. Tente de novo.');
        } finally {
            setSalvando(false);
        }
    };

    const voltar = (
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
            <ArrowLeft className="w-4 h-4" aria-hidden /> Todas as pessoas
        </Button>
    );

    if (isLoading) {
        return <div className="space-y-4">{voltar}<div role="status" className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400"><Loader2 className="w-5 h-5 animate-spin mr-2" aria-hidden />Carregando a ficha...</div></div>;
    }
    if (error || !f) {
        return (
            <div className="space-y-4">{voltar}
                <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center text-red-700 dark:text-red-400">
                    <AlertCircle className="w-6 h-6" aria-hidden />{error?.message || 'Não foi possível abrir esta pessoa.'}
                    <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar de novo</Button>
                </div>
            </div>
        );
    }

    const eu = user?.uid === uid;
    const podeBloquear = !eu && !f.super_admin;
    const ativos = f.vinculos.filter((v) => v.ativo);

    return (
        <div className="space-y-5">
            {voltar}

            <header className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white break-words">{f.nome || 'Sem nome'}</h3>
                        {f.bloqueio ? <Selo tom="perigo"><Ban className="w-3.5 h-3.5" aria-hidden />Bloqueada no SIGO</Selo> : <Selo tom="ok">Ativa</Selo>}
                        {f.super_admin && <Selo><ShieldCheck className="w-3.5 h-3.5" aria-hidden />Super-admin</Selo>}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 break-all">{f.email || 'sem e-mail'}{f.funcao ? ` · ${f.funcao}` : ''}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    {f.bloqueio ? (
                        <Button onClick={() => setDialogo('desbloquear')} className="gap-1.5"><CheckCircle2 className="w-4 h-4" aria-hidden />Desbloquear</Button>
                    ) : (
                        <Button
                            variant="outline" onClick={() => setDialogo('bloquear')} disabled={!podeBloquear} className="gap-1.5"
                            title={eu ? 'Você não pode bloquear a si mesmo' : f.super_admin ? 'Retire o acesso de super-admin antes' : undefined}
                        >
                            <Ban className="w-4 h-4" aria-hidden />Bloquear no SIGO
                        </Button>
                    )}
                </div>
            </header>

            {f.bloqueio && (
                <div role="status" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-950 dark:text-red-50">
                    <p className="font-semibold">Bloqueada em {fmtData(f.bloqueio.em, true)}{f.bloqueio.por ? ` por ${f.bloqueio.por}` : ''}.</p>
                    <p>Motivo mostrado à pessoa: {f.bloqueio.motivo}</p>
                    <p className="mt-1">Não abre nenhum órgão, não usa o Portal das partes, não cria órgão nem entra por convite. O login dela em outros sistemas continua funcionando.</p>
                </div>
            )}
            {!podeBloquear && !f.bloqueio && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    {eu ? 'Esta é a sua conta: você não pode bloquear a si mesmo.' : 'Esta pessoa administra a plataforma. Para bloquear, retire antes o acesso em Super-admins.'}
                </p>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Bloco titulo={`Órgãos (${ativos.length} ${ativos.length === 1 ? 'ativo' : 'ativos'})`} icone={Building2}>
                    {f.vinculos.length === 0 ? (
                        <p className="text-sm text-slate-600 dark:text-slate-300">Não participa de nenhum órgão.</p>
                    ) : (
                        <ul className="divide-y divide-slate-100 dark:divide-slate-800 -mx-1">
                            {f.vinculos.map((v) => (
                                <li key={v.org_id}>
                                    <Link
                                        to={`/Admin?secao=orgs&orgao=${encodeURIComponent(v.org_id)}`}
                                        className={`group flex items-center gap-3 px-1 py-2.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${v.ativo ? '' : 'opacity-60'}`}
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-medium text-slate-900 dark:text-white truncate">{v.org_nome}</span>
                                            <span className="flex flex-wrap items-center gap-1.5 mt-1 text-xs">
                                                <Selo tom={v.papel === 'creator' ? 'ok' : 'neutro'}>{roleLabel(v.papel)}</Selo>
                                                {v.funcao && v.funcao !== 'member' && <Selo>{v.funcao}</Selo>}
                                                {v.org_suspenso && <Selo tom="alerta">Órgão suspenso</Selo>}
                                                <span className="text-slate-500 dark:text-slate-400">{v.ativo ? `desde ${fmtData(v.entrou_em)}` : `saiu em ${fmtData(v.saiu_em)}`}</span>
                                            </span>
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </Bloco>

                <div className="space-y-4">
                    <Bloco titulo="Conta" icone={KeyRound}>
                        {f.conta ? (
                            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                                <Dado rotulo="Entra com">{f.conta.provedores.join(', ') || '—'}</Dado>
                                <Dado rotulo="E-mail confirmado">{f.conta.email_confirmado ? 'Sim' : 'Não'}</Dado>
                                <Dado rotulo="Verificação em duas etapas">{f.conta.dois_fatores ? 'Ligada' : 'Desligada'}</Dado>
                                <Dado rotulo="Conta criada em">{fmtData(f.conta.criada_em)}</Dado>
                                <Dado rotulo="Último acesso">{fmtData(f.conta.ultimo_acesso, true)}</Dado>
                                <Dado rotulo="Termos aceitos em">{fmtData(f.termos_aceitos_em)}{f.termos_versao ? ` (versão ${f.termos_versao})` : ''}</Dado>
                            </dl>
                        ) : (
                            <p className="text-sm text-slate-600 dark:text-slate-300">A conta de login não existe mais. Ficaram só os registros no SIGO.</p>
                        )}
                    </Bloco>
                    <Bloco titulo="Atividade recente" icone={Activity}>
                        {f.atividade.length === 0 ? (
                            <p className="text-sm text-slate-600 dark:text-slate-300">Nada registrado.</p>
                        ) : (
                            <ol className="space-y-2 text-sm">
                                {f.atividade.map((a) => (
                                    <li key={a.id}>
                                        <p className="font-mono text-xs text-slate-800 dark:text-slate-100 break-all">{a.acao}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{a.orgao || '—'} · {fmtData(a.quando, true)}</p>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </Bloco>
                </div>
            </div>

            <Dialog open={dialogo === 'bloquear'} onOpenChange={(v) => !v && fechar()}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Bloquear {f.nome || f.email} no SIGO</DialogTitle>
                        <DialogDescription>
                            A pessoa deixa de abrir todos os órgãos e o Portal das partes, e não consegue criar órgão nem entrar por convite.
                            O login dela não é desativado, porque é o mesmo de outros sistemas. Nada é apagado e você pode desbloquear quando quiser.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="motivo-bloqueio">Motivo (a pessoa vai ler este texto)</Label>
                        <Textarea id="motivo-bloqueio" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} rows={3} placeholder="Ex.: acesso suspenso por desligamento; procure a administração do SIGO." />
                        <p className="text-xs text-slate-500 dark:text-slate-400">{motivo.length}/300</p>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={fechar} disabled={salvando}>Cancelar</Button>
                        <Button onClick={() => executar(() => platformUser('bloquear', uid, { motivo }), 'Pessoa bloqueada no SIGO.')} disabled={salvando || motivo.trim().length < 5}>
                            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Bloquear
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={dialogo === 'desbloquear'} onOpenChange={(v) => !v && fechar()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Desbloquear {f.nome || f.email}</DialogTitle>
                        <DialogDescription>A pessoa volta a abrir os órgãos de que participa, com os mesmos papéis de antes.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={fechar} disabled={salvando}>Cancelar</Button>
                        <Button onClick={() => executar(() => platformUser('desbloquear', uid), 'Pessoa desbloqueada.')} disabled={salvando}>
                            {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}Desbloquear
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
