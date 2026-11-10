import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    createUserWithEmailAndPassword, isSignInWithEmailLink, sendPasswordResetEmail, sendSignInLinkToEmail, signInWithEmailAndPassword,
    signInWithEmailLink, updateProfile,
} from 'firebase/auth';
import {
    ArrowLeft, Bell, BookOpen, CalendarCheck, CalendarClock, Download, FileCheck, FilePlus, FileText, Flag, Gavel, GitBranch, Loader2,
    LogOut, Mail, Printer, Search, Send, ShieldAlert, ShieldCheck, UserCheck, Camera, RefreshCw, Building2, LayoutDashboard,
} from 'lucide-react';
import { auth } from '@/config/firebase';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { useOrganizations } from '@/hooks/useFirestore';
import { createPageUrl } from '@/utils';
import { ThemeToggleButton } from '@/lib/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { secPortal, baixarBase64, base64ParaUrl, arquivoParaBase64 } from '@/services/secretariaService';
import { STATUS_ROTULO, dataHora } from '@/components/secretaria/comum';
import FluxoRito from '@/components/secretaria/FluxoRito';
import { DadosCampos } from '@/components/secretaria/CamposProcesso';
import LeitorAutos from '@/components/secretaria/LeitorAutos';
import EventosAutos from '@/components/secretaria/EventosAutos';
import { etapasAteOFim } from '@/lib/secretariaRito';

// Portal das partes: página pública (fora do menu do SIGO). A parte entra com
// conta própria, aceita o convite da secretaria e acompanha só os processos em
// que foi habilitada. Nunca vira membro do órgão. A linguagem aqui evita os
// termos internos da equipe: a parte "se manifesta", "baixa o processo
// completo", vê "em que ponto está".

const CHAVE_EMAIL = 'portal-email';
const brData = (iso) => (iso || '').split('-').reverse().join('/');
const hojeIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const diasAte = (iso) => Math.round((new Date(`${iso}T12:00:00`) - new Date(`${hojeIso()}T12:00:00`)) / 86400000);

/** O papel da parte dito em uma frase, sem jargão. */
/** Quem você é neste processo: a própria parte ou representante dela. */
export function fraseQuem(p) {
    if (!p) return '';
    if (p.como === 'representante') return `Você representa ${p.parte_nome || p.nome}${p.polo ? ` (${p.polo})` : ''}`;
    return frasePolo(p.polo);
}

export function frasePolo(polo) {
    return ({
        requerente: 'Você fez o pedido (requerente)', requerido: 'O pedido é contra você (requerido)',
        interessado: 'Você é interessado', terceiro: 'Você participa como terceiro',
    })[polo] || `Você participa como ${polo || 'parte'}`;
}

const ICONE_MOV = {
    juntada: FileText, peticao: Send, fase: GitBranch, situacao: Flag, prazo: CalendarClock, prazo_encerrado: CalendarCheck,
    pendencia_resolvida: Gavel, autuacao: FilePlus, habilitacao: UserCheck, convite: Mail,
};

export default function Portal() {
    const { user, isAuthenticated, isLoadingAuth, signOut } = useAuth();
    const [params, setParams] = useSearchParams();
    const convite = params.get('convite');
    const procId = params.get('p');
    const aceitando = useRef(false);

    const ir = (id) => {
        const next = new URLSearchParams();
        if (id) next.set('p', id);
        setParams(next);
    };

    useEffect(() => {
        if (!isAuthenticated || !convite || aceitando.current) return;
        aceitando.current = true;
        secPortal('aceitarConvite', { convite })
            .then((r) => { toast.success('Convite aceito. Este processo agora aparece na sua lista.'); ir(r.processoId); })
            .catch((e) => { toast.error(e?.message || 'Convite inválido'); ir(null); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, convite]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20">
                <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
                    <button type="button" onClick={() => ir(null)} className="flex items-center gap-2 font-semibold"><Gavel className="w-5 h-5 text-indigo-600" aria-hidden /> Portal das partes</button>
                    {!isAuthenticated && <ThemeToggleButton />}
                    {isAuthenticated && (
                        <div className="flex items-center gap-1 text-sm min-w-0">
                            <span className="truncate text-slate-600 dark:text-slate-400 hidden md:inline max-w-[14rem]">{user?.email}</span>
                            <ThemeToggleButton />
                            <VoltarAoSigo uid={user?.uid} />
                            <Avisos />
                            <Button variant="ghost" size="sm" className="gap-1" onClick={() => signOut()}><LogOut className="w-4 h-4" aria-hidden /> <span className="hidden sm:inline">Sair</span></Button>
                        </div>
                    )}
                </div>
            </header>
            <main className="max-w-5xl mx-auto px-4 py-6 pb-24 sm:pb-6">
                {isLoadingAuth ? <Carregando texto="Carregando…" />
                    : !isAuthenticated ? <Entrar convite={!!convite} />
                        : convite ? <Carregando texto="Aceitando o convite…" />
                            : procId ? <ProcessoParte id={procId} onVoltar={() => ir(null)} />
                                : <MeusProcessos onAbrir={ir} />}
            </main>
        </div>
    );
}

function Carregando({ texto }) {
    return <div className="py-10 flex gap-2 items-center text-slate-600" role="status"><Loader2 className="w-4 h-4 animate-spin" aria-hidden /> {texto}</div>;
}

/** Preferência de avisos por e-mail da conta. */
function Avisos() {
    const qc = useQueryClient();
    const [aberto, setAberto] = useState(false);
    const q = useQuery({ queryKey: ['portal-processos'], queryFn: () => secPortal('meusProcessos') });
    const atual = q.data?.avisos || 'tudo';
    const [valor, setValor] = useState(null);
    const [salvando, setSalvando] = useState(false);
    const salvar = async () => {
        setSalvando(true);
        try {
            await secPortal('preferencias', { avisos: valor || atual });
            toast.success('Preferência de avisos salva');
            qc.invalidateQueries({ queryKey: ['portal-processos'] });
            setAberto(false);
        } catch (e) { toast.error(e?.message || 'Não foi possível salvar'); } finally { setSalvando(false); }
    };
    const opcoes = [
        ['tudo', 'Tudo', 'Cada novo documento, decisão, prazo e mudança de fase.'],
        ['prazos', 'Só prazos e decisões', 'Prazos abertos, lembrete 3 dias antes e no dia, decisões e mudanças de fase.'],
        ['nenhum', 'Nenhum', 'Você acompanha pelo portal, sem e-mails.'],
    ];
    return (
        <Dialog open={aberto} onOpenChange={setAberto}>
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setValor(atual); setAberto(true); }}><Bell className="w-4 h-4" aria-hidden /> <span className="hidden sm:inline">Avisos</span></Button>
            <DialogContent className="w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Avisos por e-mail</DialogTitle>
                    <DialogDescription>Enviados para {auth.currentUser?.email || 'o e-mail da sua conta'}, com link direto para o processo.</DialogDescription>
                </DialogHeader>
                <fieldset className="space-y-2">
                    <legend className="sr-only">O que avisar</legend>
                    {opcoes.map(([v, rotulo, desc]) => (
                        <label key={v} className={`flex gap-3 rounded-md border p-3 cursor-pointer ${(valor || atual) === v ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-slate-200 dark:border-slate-700'}`}>
                            <input type="radio" name="avisos" value={v} checked={(valor || atual) === v} onChange={() => setValor(v)} className="mt-1" />
                            <span><span className="font-medium block">{rotulo}</span><span className="text-sm text-slate-600 dark:text-slate-300">{desc}</span></span>
                        </label>
                    ))}
                </fieldset>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
                    <Button onClick={salvar} disabled={salvando}>{salvando && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />}Salvar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Entrar({ convite }) {
    const { signInWithGoogle } = useAuth();
    const [modo, setModo] = useState('entrar'); // entrar | criar | link
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState(() => { try { return localStorage.getItem(CHAVE_EMAIL) || ''; } catch { return ''; } });
    const [senha, setSenha] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [linkEnviado, setLinkEnviado] = useState(false);
    const [pedirEmailDoLink, setPedirEmailDoLink] = useState(false);

    // Volta do link mágico: termina o acesso com o e-mail guardado (ou pede para confirmar).
    useEffect(() => {
        if (!isSignInWithEmailLink(auth, window.location.href)) return;
        let guardado = '';
        try { guardado = localStorage.getItem(CHAVE_EMAIL) || ''; } catch { guardado = ''; }
        if (!guardado) { setPedirEmailDoLink(true); setModo('link'); return; }
        setOcupado(true);
        signInWithEmailLink(auth, guardado, window.location.href)
            .catch(() => toast.error('O link de acesso venceu ou já foi usado. Peça outro.'))
            .finally(() => setOcupado(false));
    }, []);

    const guardarEmail = (e) => { try { localStorage.setItem(CHAVE_EMAIL, e); } catch { /* sem armazenamento */ } };

    const enviar = async (e) => {
        e.preventDefault();
        setOcupado(true);
        try {
            guardarEmail(email.trim());
            if (modo === 'criar') {
                const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
                if (nome.trim()) await updateProfile(cred.user, { displayName: nome.trim() });
                await cred.user.getIdToken(true);
            } else if (modo === 'link') {
                if (pedirEmailDoLink) {
                    await signInWithEmailLink(auth, email.trim(), window.location.href);
                } else {
                    await sendSignInLinkToEmail(auth, email.trim(), { url: window.location.href, handleCodeInApp: true });
                    setLinkEnviado(true);
                }
            } else {
                await signInWithEmailAndPassword(auth, email.trim(), senha);
            }
        } catch (err) {
            const c = err?.code || '';
            toast.error(c.includes('invalid-credential') || c.includes('wrong-password') ? 'E-mail ou senha incorretos'
                : c.includes('email-already-in-use') ? 'Já existe conta com este e-mail. Use “Entrar”.'
                    : c.includes('weak-password') ? 'Use uma senha com pelo menos 6 caracteres'
                        : c.includes('invalid-action-code') ? 'O link de acesso venceu ou já foi usado. Peça outro.'
                            : 'Não foi possível entrar');
        } finally {
            setOcupado(false);
        }
    };

    const recuperar = async () => {
        if (!email.trim()) { toast.error('Informe o e-mail'); return; }
        try {
            await sendPasswordResetEmail(auth, email.trim());
            toast.success('Se houver conta com este e-mail, enviamos o link para criar nova senha');
        } catch {
            toast.error('Não foi possível enviar o e-mail');
        }
    };

    return (
        <div className="max-w-md mx-auto space-y-4">
            <div className="text-center space-y-1">
                <h1 className="text-2xl font-semibold">{convite ? 'Entre para aceitar o convite' : 'Portal das partes'}</h1>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Aqui você acompanha os processos em que participa, lê todos os documentos, baixa o processo completo e se manifesta a qualquer momento.
                    Para entrar pela primeira vez, use o link de convite que recebeu.
                </p>
            </div>
            <Card>
                <CardContent className="pt-6 space-y-4">
                    <Button variant="outline" className="w-full" disabled={ocupado} onClick={() => signInWithGoogle().catch(() => {})}>Entrar com Google</Button>
                    <div className="text-center text-xs text-slate-400">ou</div>
                    {linkEnviado ? (
                        <div role="status" className="rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 p-3 text-sm">
                            Enviamos um link de acesso para <b>{email}</b>. Abra o e-mail neste aparelho e toque no link. Ele vale por pouco tempo.
                        </div>
                    ) : (
                        <form onSubmit={enviar} className="space-y-3">
                            {modo === 'criar' && <div><Label htmlFor="pt-nome">Nome</Label><Input id="pt-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></div>}
                            <div><Label htmlFor="pt-email">E-mail</Label><Input id="pt-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" /></div>
                            {modo !== 'link' && <div><Label htmlFor="pt-senha">Senha</Label><Input id="pt-senha" type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} /></div>}
                            {modo === 'link' && <p className="text-xs text-slate-600">{pedirEmailDoLink ? 'Confirme o e-mail que recebeu o link para concluir o acesso.' : 'Você recebe um link por e-mail e entra sem senha.'}</p>}
                            <Button type="submit" className="w-full" disabled={ocupado}>
                                {ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />}{modo === 'criar' ? 'Criar conta' : modo === 'link' ? (pedirEmailDoLink ? 'Concluir acesso' : 'Enviar link de acesso') : 'Entrar'}
                            </Button>
                        </form>
                    )}
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                        <Button variant="link" className="px-0 h-auto" onClick={() => { setModo(modo === 'criar' ? 'entrar' : 'criar'); setLinkEnviado(false); }}>{modo === 'criar' ? 'Já tenho conta' : 'Criar conta com senha'}</Button>
                        {modo !== 'link' && <Button variant="link" className="px-0 h-auto" onClick={() => setModo('link')}>Entrar sem senha (link por e-mail)</Button>}
                        {modo === 'link' && <Button variant="link" className="px-0 h-auto" onClick={() => { setModo('entrar'); setLinkEnviado(false); }}>Entrar com senha</Button>}
                        {modo === 'entrar' && <Button variant="link" className="px-0 h-auto" onClick={recuperar}>Esqueci a senha</Button>}
                    </div>
                </CardContent>
            </Card>
            <p className="text-xs text-slate-600 text-center">Convite vencido ou não recebido? Peça um novo à secretaria do órgão que conduz o processo.</p>
        </div>
    );
}

/** Quem também é membro de algum órgão volta ao SIGO por aqui. Aqui dentro, é só parte. */
function VoltarAoSigo({ uid }) {
    const { organizations } = useOrganizations(uid);
    if (!organizations?.length) return null;
    return (
        <Button asChild variant="ghost" size="sm" className="gap-1" title="Voltar às ferramentas dos seus órgãos">
            <Link to={createPageUrl('Dashboard')}><LayoutDashboard className="w-4 h-4" aria-hidden /> <span className="hidden sm:inline">Ir para o SIGO</span></Link>
        </Button>
    );
}

function MeusProcessos({ onAbrir }) {
    const q = useQuery({ queryKey: ['portal-processos'], queryFn: () => secPortal('meusProcessos') });
    const [busca, setBusca] = useState('');
    const [situacao, setSituacao] = useState('todos');
    const [orgaoSel, setOrgaoSel] = useState('');
    if (q.isLoading) return <Carregando texto="Carregando seus processos…" />;
    if (q.error) return <p role="alert" className="text-red-700 dark:text-red-400">{q.error.message} <Button variant="link" size="sm" className="gap-1 px-1" onClick={() => q.refetch()}><RefreshCw className="w-3 h-3" aria-hidden /> Tentar de novo</Button></p>;
    const lista = q.data.processos;
    const paraVoce = q.data.para_voce || [];
    const termo = busca.trim().toLowerCase();
    const filtrada = lista
        .filter((p) => !termo || `${p.numero} ${p.assunto} ${p.orgao}`.toLowerCase().includes(termo))
        .filter((p) => !orgaoSel || p.orgao === orgaoSel)
        .filter((p) => situacao === 'todos' || (situacao === 'novidades' ? p.novidades : p.status === situacao));
    // Processos de órgãos ou entidades distintos ficam separados por órgão.
    const orgaos = [...new Set(lista.map((p) => p.orgao))];
    const grupos = orgaos.length > 1 ? orgaos.map((o) => [o, filtrada.filter((p) => p.orgao === o)]).filter(([, ps]) => ps.length) : [[null, filtrada]];
    const souRepresentante = lista.some((p) => p.como === 'representante');
    return (
        <div className="space-y-5">
            {paraVoce.length > 0 && (
                <section aria-labelledby="para-voce" className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-4 space-y-2">
                    <h2 id="para-voce" className="font-semibold text-amber-900 dark:text-amber-100">Para você</h2>
                    <ul className="space-y-1">
                        {paraVoce.slice(0, 8).map((x, i) => (
                            <li key={i}>
                                <button type="button" onClick={() => onAbrir(x.processoId)} className="w-full text-left text-sm rounded-md px-2 py-1.5 hover:bg-amber-100 dark:hover:bg-amber-900 flex flex-wrap items-baseline gap-x-2">
                                    <span className="font-mono text-xs">{x.numero}</span>
                                    {x.tipo === 'prazo' && <span>{x.vencido ? <b className="text-red-700 dark:text-red-300">Prazo vencido em {brData(x.vence_em)}</b> : <b>Prazo vence em {brData(x.vence_em)}{diasAte(x.vence_em) <= 3 ? ` (${diasAte(x.vence_em) === 0 ? 'hoje' : `${diasAte(x.vence_em)} dias`})` : ''}</b>}: {x.descricao}</span>}
                                    {x.tipo === 'peticao' && <span>Sua manifestação aguarda apreciação desde {dataHora(x.desde)}</span>}
                                    {x.tipo === 'novidade' && <span><b>Novidade:</b> {x.descricao}</span>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold flex-1">Meus processos</h1>
                {orgaos.length > 1 && (
                    <select aria-label="Filtrar por órgão ou entidade" value={orgaoSel} onChange={(e) => setOrgaoSel(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900 max-w-[14rem]">
                        <option value="">Todos os órgãos</option>
                        {orgaos.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                )}
                {lista.length > 3 && (
                    <>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" aria-hidden />
                            <Input className="pl-8 w-56" placeholder="Número, assunto ou órgão" aria-label="Buscar nos meus processos" value={busca} onChange={(e) => setBusca(e.target.value)} />
                        </div>
                        <select aria-label="Filtrar" value={situacao} onChange={(e) => setSituacao(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                            <option value="todos">Todos</option>
                            <option value="novidades">Com novidades</option>
                            <option value="em_tramitacao">Em andamento</option>
                            <option value="arquivado">Arquivados</option>
                        </select>
                    </>
                )}
            </div>
            {lista.length === 0 && (
                <Card><CardContent className="pt-6 text-sm text-slate-600 dark:text-slate-300 space-y-2">
                    <p>Nenhum processo por aqui ainda.</p>
                    <p>Para acompanhar um processo, abra o link de convite que a secretaria enviou ao seu e-mail. Se não recebeu, peça o convite ao órgão ou entidade responsável, informando seu nome e CPF ou CNPJ.</p>
                </CardContent></Card>
            )}
            {souRepresentante && lista.length > 0 && <p className="text-xs text-slate-600 dark:text-slate-400">Em alguns processos você atua como representante: o que você protocolar sai em nome da parte, assinado por você.</p>}
            {filtrada.length === 0 && lista.length > 0 && <p className="text-sm text-slate-600">Nenhum processo com esse filtro.</p>}
            {grupos.map(([orgao, ps]) => (
                <section key={orgao || 'todos'} aria-label={orgao ? `Processos em ${orgao}` : undefined} className="space-y-3">
                    {orgao && <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 pt-1"><Building2 className="w-4 h-4 text-indigo-600" aria-hidden /> {orgao} <span className="font-normal text-slate-500">· {ps.length}</span></h2>}
                    <ul className="space-y-3">
                        {ps.map((p) => (
                            <li key={p.id}>
                                <button type="button" onClick={() => onAbrir(p.id)} className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-sm">{p.numero}</span>
                                        <Badge variant="secondary">{STATUS_ROTULO[p.status] || p.status}</Badge>
                                        {p.novidades && <Badge className="bg-indigo-600 hover:bg-indigo-600">Novidades</Badge>}
                                        {p.como === 'representante' && <Badge variant="outline">Representante</Badge>}
                                        {!orgao && <span className="text-xs text-slate-600">{p.orgao}</span>}
                                    </div>
                                    <p className="font-medium mt-1">{p.assunto}</p>
                                    <p className="text-xs text-slate-600 mt-1">{fraseQuem(p)} · em: {p.fase_nome}</p>
                                    {p.ultimo_movimento && <p className="text-xs text-slate-600 mt-1 truncate">{dataHora(p.ultimo_movimento.em)} · {p.ultimo_movimento.descricao}</p>}
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}

function ProcessoParte({ id, onVoltar }) {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['portal-proc', id], queryFn: () => secPortal('obter', { processoId: id }) });
    const [leitura, setLeitura] = useState(null); // id do documento aberto no leitor
    const [ocupado, setOcupado] = useState('');
    const [responderPrazo, setResponderPrazo] = useState(null);
    const formRef = useRef(null);

    if (q.isLoading) return <Carregando texto="Carregando processo…" />;
    if (q.error) return <div role="alert" className="text-red-700 dark:text-red-400">{q.error.message} <Button variant="link" size="sm" className="gap-1 px-1" onClick={() => q.refetch()}><RefreshCw className="w-3 h-3" aria-hidden /> Tentar de novo</Button><Button variant="link" size="sm" onClick={onVoltar}>Voltar</Button></div>;
    const { processo: p, movimentos, documentos, cadeiaIntegra, orgao, minhas_peticoes: peticoes, tipos_peticao: tipos } = q.data;
    const faltam = etapasAteOFim(p.fases || [], p.fase_atual);
    const novosDocs = documentos.filter((d) => d.novo).length;

    const baixarOriginal = async (d) => {
        setOcupado(d.id);
        try {
            const r = await secPortal('baixar', { processoId: id, docId: d.id });
            baixarBase64(r.base64, r.nomeArquivo || r.titulo, r.mime);
        } catch (e) { toast.error(e?.message || 'Não foi possível baixar'); } finally { setOcupado(''); }
    };
    const pdfDe = async (acao, extra = {}) => {
        setOcupado(acao);
        try { return await secPortal(acao, { processoId: id, ...extra }); } catch (e) { toast.error(e?.message || 'Não foi possível gerar o PDF'); return null; } finally { setOcupado(''); }
    };
    const integra = async (imprimir) => {
        const r = await pdfDe('exportar');
        if (!r) return;
        if (imprimir) {
            const w = window.open(base64ParaUrl(r.base64, 'application/pdf'), '_blank');
            if (!w) baixarBase64(r.base64, r.nome);
        } else baixarBase64(r.base64, r.nome);
    };
    const certidao = async () => { const r = await pdfDe('certidao'); if (r) baixarBase64(r.base64, r.nome); };
    const comprovante = async (docId) => { const r = await pdfDe('comprovante', { docId }); if (r) baixarBase64(r.base64, r.nome); };
    const irParaManifestar = (prazo) => {
        setResponderPrazo(prazo || null);
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const atualizar = () => { qc.invalidateQueries({ queryKey: ['portal-proc', id] }); qc.invalidateQueries({ queryKey: ['portal-processos'] }); };

    const Icone = ({ tipo }) => { const C = ICONE_MOV[tipo] || Flag; return <C className="w-3.5 h-3.5" aria-hidden />; };

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start gap-3">
                <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={onVoltar}><ArrowLeft className="w-4 h-4" aria-hidden /> Meus processos</Button>
                <div className="flex-1 min-w-[14rem]">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-semibold font-mono">{p.numero}</h1>
                        <Badge variant="secondary">{STATUS_ROTULO[p.status] || p.status}</Badge>
                        {cadeiaIntegra
                            ? <Badge variant="outline" className="gap-1" title="Nenhum registro foi alterado depois de feito"><ShieldCheck className="w-3 h-3" aria-hidden /> Registro íntegro</Badge>
                            : <Badge variant="destructive" className="gap-1"><ShieldAlert className="w-3 h-3" aria-hidden /> Registro com falha de integridade</Badge>}
                    </div>
                    <p className="font-medium">{p.assunto}</p>
                    <p className="text-sm text-slate-600">{orgao} · {fraseQuem(p.minha_parte)}{p.minha_parte?.como !== 'representante' && p.minha_parte?.nome ? `, como ${p.minha_parte.nome}` : ''}</p>
                </div>
                <div className="hidden sm:flex flex-wrap gap-2">
                    <Button variant="outline" className="gap-2" disabled={!!ocupado} onClick={() => integra(false)}>{ocupado === 'exportar' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Download className="w-4 h-4" aria-hidden />} Processo completo (PDF)</Button>
                    <Button variant="outline" className="gap-2" disabled={!!ocupado} onClick={() => integra(true)}><Printer className="w-4 h-4" aria-hidden /> Imprimir</Button>
                    <Button variant="outline" className="gap-2" disabled={!!ocupado} onClick={certidao}>{ocupado === 'certidao' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <FileCheck className="w-4 h-4" aria-hidden />} Certidão de andamento</Button>
                </div>
            </div>

            {p.campos?.length > 0 && (
                <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3" aria-label="Dados do processo">
                    <DadosCampos campos={p.campos} />
                </section>
            )}

            <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <details>
                    <summary className="cursor-pointer px-4 py-3 text-sm">
                        Em que ponto está: <b>{p.fase_nome}</b>
                        {faltam != null && faltam > 0 && <span className="text-slate-600"> · {faltam === 1 ? 'falta 1 etapa' : `faltam ${faltam} etapas`} até o fim</span>}
                        {faltam === 0 && <span className="text-slate-600"> · etapa final</span>}
                        {p.fases?.length > 1 && <span className="text-indigo-700 dark:text-indigo-300"> (ver o caminho completo)</span>}
                    </summary>
                    {p.fases?.length > 1 && <div className="px-4 pb-4"><FluxoRito fases={p.fases} atual={p.fase_atual} /></div>}
                </details>
            </section>

            <div className="grid lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3 space-y-5">
                    {p.prazos.length > 0 && (
                        <Card className={p.prazos.some((x) => x.meu) ? 'border-amber-300 dark:border-amber-700' : ''}>
                            <CardHeader className="pb-2"><CardTitle className="text-base">Prazos em aberto</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {p.prazos.map((x) => {
                                    const dias = diasAte(x.vence_em);
                                    return (
                                        <div key={x.id} className="flex flex-wrap items-center gap-2">
                                            <CalendarClock className={`w-4 h-4 ${dias < 0 ? 'text-red-600' : 'text-indigo-600'}`} aria-hidden />
                                            <span className="flex-1 min-w-[10rem]">
                                                {x.descricao}{x.destinatario ? ` (${x.destinatario})` : ''} · <span className={dias < 0 ? 'text-red-700 dark:text-red-300 font-medium' : ''}>{dias < 0 ? `venceu em ${brData(x.vence_em)}` : dias === 0 ? 'vence hoje' : `vence em ${brData(x.vence_em)} (${dias} dias)`}</span>
                                            </span>
                                            {x.meu && p.status === 'em_tramitacao' && <Button size="sm" variant="outline" onClick={() => irParaManifestar(x)}>Responder</Button>}
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-base">Documentos ({documentos.length}){novosDocs > 0 && <Badge className="ml-2 bg-indigo-600 hover:bg-indigo-600">{novosDocs} novo{novosDocs > 1 ? 's' : ''}</Badge>}</CardTitle>
                            {documentos.length > 0 && <Button size="sm" variant="outline" className="gap-1" onClick={() => setLeitura(documentos[0].id)}><BookOpen className="w-4 h-4" aria-hidden /> Ler em sequência</Button>}
                        </CardHeader>
                        <CardContent className="space-y-1">
                            {documentos.length === 0 && <p className="text-sm text-slate-600">Nenhum documento disponível ainda.</p>}
                            {documentos.map((d) => (
                                <div key={d.id} className="flex items-center gap-3 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                    <span className="font-mono text-xs w-8 text-slate-600">{d.ordem}</span>
                                    <div className="flex-1 min-w-0">
                                        <button type="button" className="font-medium truncate block max-w-full text-left hover:underline" onClick={() => setLeitura(d.id)}>{d.titulo}{d.novo && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-indigo-500 align-middle" aria-label="novo" />}</button>
                                        <p className="text-xs text-slate-600">{[d.tipo, d.folha_inicial ? (d.folha_final > d.folha_inicial ? `fls. ${d.folha_inicial}–${d.folha_final}` : `fl. ${d.folha_inicial}`) : null, dataHora(d.juntado_em)].filter(Boolean).join(' · ')}</p>
                                    </div>
                                    {d.codigo_verificacao && (
                                        <Button variant="ghost" size="sm" title="Copiar o link de conferência pública deste documento" aria-label={`Copiar link de conferência de ${d.titulo}`}
                                            onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/Conferir?c=${d.codigo_verificacao}`).then(() => toast.success('Link de conferência copiado'))}>
                                            <ShieldCheck className="w-4 h-4" aria-hidden />
                                        </Button>
                                    )}
                                    {d.origem === 'upload' && <Button variant="ghost" size="sm" disabled={!!ocupado} onClick={() => baixarOriginal(d)} aria-label={`Baixar o arquivo original de ${d.titulo}`} title="Baixar o arquivo original"><Download className="w-4 h-4" aria-hidden /></Button>}
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <div ref={formRef}>
                        {p.status === 'em_tramitacao'
                            ? <Peticionar id={id} prazos={p.prazos.filter((x) => x.meu)} tipos={tipos} prazoInicial={responderPrazo} onFeito={atualizar} onComprovante={comprovante} />
                            : <Card><CardContent className="pt-6 text-sm text-slate-600 dark:text-slate-300">Este processo está {STATUS_ROTULO[p.status]?.toLowerCase() || p.status}. Não é possível se manifestar agora; se precisar, procure o órgão responsável.</CardContent></Card>}
                    </div>

                    {peticoes?.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-base">Minhas manifestações</CardTitle></CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                {[...peticoes].reverse().map((x) => (
                                    <div key={x.id} className="flex flex-wrap items-center gap-2 py-1.5 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                        <div className="flex-1 min-w-[10rem]">
                                            <p className="font-medium">{x.titulo}{x.tipo_peticao ? <span className="font-normal text-slate-600"> · {x.tipo_peticao}</span> : null}</p>
                                            <p className="text-xs text-slate-600">Protocolo {x.protocolo} · {dataHora(x.em)}</p>
                                            {x.situacao === 'apreciada' && x.resolucao && <p className="text-xs mt-1 rounded bg-slate-50 dark:bg-slate-800 px-2 py-1"><b>Decisão</b>{x.apreciada_em ? ` em ${dataHora(x.apreciada_em)}` : ''}: {x.resolucao}</p>}
                                        </div>
                                        <Badge variant={x.situacao === 'aguardando' ? 'outline' : 'secondary'}>{x.situacao === 'aguardando' ? 'Aguardando apreciação' : x.situacao === 'apreciada' ? 'Apreciada' : 'Nos autos'}</Badge>
                                        <Button size="sm" variant="ghost" className="gap-1" disabled={!!ocupado} onClick={() => comprovante(x.id)}><FileCheck className="w-4 h-4" aria-hidden /> Comprovante</Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>

                <Card className="lg:col-span-2 h-fit">
                    <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-base">Últimos andamentos</CardTitle>
                        <Button size="sm" variant="link" className="h-auto p-0" onClick={() => document.getElementById('portal-eventos')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ver todos ({movimentos.length})</Button>
                    </CardHeader>
                    <CardContent>
                        <ol className="space-y-3">
                            {[...movimentos].reverse().slice(0, 6).map((m) => (
                                <li key={m.seq} className={`border-l-2 pl-3 ${m.novo ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <p className="text-xs text-slate-600 flex items-center gap-1.5"><Icone tipo={m.tipo} /> {dataHora(m.em)} · {m.autor_nome}{m.novo && <Badge className="ml-1 bg-indigo-600 hover:bg-indigo-600 text-[10px] px-1.5 py-0">novo</Badge>}</p>
                                    <p className="text-sm">{m.descricao}</p>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            </div>

            <div id="portal-eventos" className="scroll-mt-4">
                <EventosAutos titulo="Andamento do processo" movimentos={movimentos} gerarPdf={(selecao) => secPortal('exportar', { processoId: id, selecao })} />
            </div>

            {/* Celular: as duas ações mais usadas ficam sempre à mão. */}
            {p.status === 'em_tramitacao' && (
                <div className="sm:hidden fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 grid grid-cols-2 gap-2">
                    <Button variant="outline" className="gap-2" disabled={!!ocupado} onClick={() => integra(false)}><Download className="w-4 h-4" aria-hidden /> Processo (PDF)</Button>
                    <Button className="gap-2" onClick={() => irParaManifestar(null)}><Send className="w-4 h-4" aria-hidden /> Manifestar-se</Button>
                </div>
            )}

            <LeitorAutos documentos={documentos} abertoId={leitura} onFechar={() => setLeitura(null)} chaveLido={`portal-lidos-${id}`}
                carregar={(d) => secPortal('pdf', { processoId: id, docId: d.id })} titulo={`Processo ${p.numero}`} />
        </div>
    );
}

const MAX_MB = 5;
const MODELOS_PETICAO = {
    'Manifestação': { texto: 'Venho me manifestar sobre ', dica: 'Diga sobre o que se manifesta e o que pede ao final.' },
    'Juntada de documento': { texto: 'Junto aos autos o documento anexo, ', dica: 'Anexe o arquivo e diga em poucas palavras o que ele é e por que o junta.' },
    'Pedido de prazo': { texto: 'Solicito a prorrogação do prazo por ____ dias, porque ', dica: 'Informe quantos dias precisa e o motivo.' },
    'Pedido de vista': { texto: 'Solicito vista dos autos ', dica: 'Se precisar de documento específico, diga qual.' },
    'Recurso': { texto: 'Recorro da decisão de ____, pelos motivos a seguir: ', dica: 'Indique a decisão e os motivos. Anexe o que sustenta o recurso.' },
    'Outro': { texto: '', dica: '' },
};

function Peticionar({ id, prazos, tipos = [], prazoInicial, onFeito, onComprovante }) {
    const chave = `portal-rascunho-${id}`;
    const rascunho = useMemo(() => { try { return JSON.parse(localStorage.getItem(chave) || 'null'); } catch { return null; } }, [chave]);
    const [tipo, setTipo] = useState(rascunho?.tipo || '');
    const [titulo, setTitulo] = useState(rascunho?.titulo || '');
    const [texto, setTexto] = useState(rascunho?.texto || '');
    const [prazoId, setPrazoId] = useState(rascunho?.prazo_id || '');
    const [arquivo, setArquivo] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const [protocolo, setProtocolo] = useState(null);
    const inputArquivo = useRef(null);

    useEffect(() => {
        if (!prazoInicial) return;
        setPrazoId(prazoInicial.id);
        if (!tipo) setTipo('Manifestação');
        if (!titulo) setTitulo(`Manifestação sobre: ${prazoInicial.descricao}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prazoInicial]);

    useEffect(() => {
        try {
            if (tipo || titulo || texto || prazoId) localStorage.setItem(chave, JSON.stringify({ tipo, titulo, texto, prazo_id: prazoId }));
            else localStorage.removeItem(chave);
        } catch { /* sem armazenamento */ }
    }, [chave, tipo, titulo, texto, prazoId]);

    const escolherTipo = (t) => {
        setTipo(t);
        const m = MODELOS_PETICAO[t];
        if (m && !texto.trim()) setTexto(m.texto);
        if (!titulo.trim() && t && t !== 'Outro') setTitulo(t);
    };

    const enviar = async () => {
        if (!texto.trim() && !arquivo) { toast.error('Escreva a manifestação ou anexe um arquivo'); return; }
        if (arquivo && arquivo.size > MAX_MB * 1024 * 1024) { toast.error(`O arquivo passa de ${MAX_MB} MB`); return; }
        setOcupado(true);
        try {
            const extra = arquivo ? { base64: await arquivoParaBase64(arquivo), mime: arquivo.type, nomeArquivo: arquivo.name } : {};
            const r = await secPortal('peticionar', { processoId: id, titulo: titulo.trim() || tipo || 'Petição', texto, tipo: tipo || undefined, prazo_id: prazoId || undefined, ...extra });
            setProtocolo(r);
            setTipo(''); setTitulo(''); setTexto(''); setArquivo(null); setPrazoId('');
            try { localStorage.removeItem(chave); } catch { /* sem armazenamento */ }
            if (inputArquivo.current) inputArquivo.current.value = '';
            onFeito();
        } catch (e) {
            toast.error(e?.message || 'Não foi possível protocolar');
        } finally {
            setOcupado(false);
        }
    };

    const dica = MODELOS_PETICAO[tipo]?.dica;
    return (
        <Card id="manifestar">
            <CardHeader className="pb-2"><CardTitle className="text-base">Manifestar-se neste processo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                {protocolo && (
                    <div role="status" className="rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 p-3 text-sm space-y-2">
                        <p>Protocolado sob nº <b>{protocolo.protocolo}</b> em {dataHora(protocolo.em)} e incluído nos autos como documento nº {protocolo.ordem}. Quem decide foi avisado.</p>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => onComprovante(protocolo.docId)}><FileCheck className="w-4 h-4" aria-hidden /> Baixar comprovante</Button>
                    </div>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                        <Label htmlFor="pt-tipo">O que você quer fazer</Label>
                        <select id="pt-tipo" value={tipo} onChange={(e) => escolherTipo(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                            <option value="">Escolha…</option>
                            {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    {prazos.length > 0 && (
                        <div>
                            <Label htmlFor="pt-prazo">Responde a algum prazo?</Label>
                            <select id="pt-prazo" value={prazoId} onChange={(e) => setPrazoId(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                                <option value="">Não</option>
                                {prazos.map((x) => <option key={x.id} value={x.id}>{x.descricao} (vence {brData(x.vence_em)})</option>)}
                            </select>
                        </div>
                    )}
                </div>
                {dica && <p className="text-xs text-indigo-800 dark:text-indigo-200 rounded-md bg-indigo-50 dark:bg-indigo-950 px-3 py-2">{dica}</p>}
                <div><Label htmlFor="pt-tit">Título</Label><Input id="pt-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Manifestação sobre o laudo" maxLength={200} /></div>
                <div><Label htmlFor="pt-txt">Texto</Label><Textarea id="pt-txt" rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={40000} /></div>
                <div>
                    <Label htmlFor="pt-arq">Anexo (PDF, Word, foto ou imagem, até {MAX_MB} MB)</Label>
                    <Input id="pt-arq" ref={inputArquivo} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,image/*,application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
                    <Label htmlFor="pt-foto" className="mt-2 inline-flex items-center gap-1 text-sm font-normal text-indigo-700 dark:text-indigo-300 cursor-pointer sm:hidden"><Camera className="w-4 h-4" aria-hidden /> Fotografar um documento</Label>
                    <input id="pt-foto" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
                    {arquivo && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Anexo: {arquivo.name}</p>}
                </div>
                <p className="text-xs text-slate-600">Sua manifestação entra nos autos na hora, com seu nome, data e hora, e vai para quem decide. {rascunho && !protocolo ? 'Rascunho recuperado deste aparelho.' : 'O que você escreve fica salvo neste aparelho até protocolar.'}</p>
                <Button disabled={ocupado} onClick={enviar} className="gap-2 w-full sm:w-auto">
                    {ocupado ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />} Protocolar
                </Button>
            </CardContent>
        </Card>
    );
}
