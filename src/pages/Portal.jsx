import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile,
} from 'firebase/auth';
import { ArrowLeft, Download, FileText, Gavel, Loader2, LogOut, Send, ShieldAlert, ShieldCheck } from 'lucide-react';
import { auth } from '@/config/firebase';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { secPortal, baixarBase64, arquivoParaBase64 } from '@/services/secretariaService';
import { STATUS_ROTULO, dataHora } from '@/components/secretaria/comum';
import FluxoRito from '@/components/secretaria/FluxoRito';

// Portal das partes: página pública (fora do menu do SIGO). A parte entra com
// conta própria, aceita o convite da secretaria e acompanha só os processos em
// que foi habilitada. Nunca vira membro do órgão.
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
            .then((r) => { toast.success('Convite aceito'); ir(r.processoId); })
            .catch((e) => { toast.error(e?.message || 'Convite inválido'); ir(null); });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, convite]);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold"><Gavel className="w-5 h-5 text-indigo-600" /> Portal das partes</div>
                    {isAuthenticated && (
                        <div className="flex items-center gap-2 text-sm min-w-0">
                            <span className="truncate text-slate-500 hidden sm:inline">{user?.email}</span>
                            <Button variant="ghost" size="sm" className="gap-1" onClick={() => signOut()}><LogOut className="w-4 h-4" /> Sair</Button>
                        </div>
                    )}
                </div>
            </header>
            <main className="max-w-5xl mx-auto px-4 py-6">
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
    return <div className="py-10 flex gap-2 items-center text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> {texto}</div>;
}

function Entrar({ convite }) {
    const { signInWithGoogle } = useAuth();
    const [modo, setModo] = useState('entrar'); // entrar | criar
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [ocupado, setOcupado] = useState(false);

    const enviar = async (e) => {
        e.preventDefault();
        setOcupado(true);
        try {
            if (modo === 'criar') {
                const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
                if (nome.trim()) await updateProfile(cred.user, { displayName: nome.trim() });
                await cred.user.getIdToken(true);
            } else {
                await signInWithEmailAndPassword(auth, email.trim(), senha);
            }
        } catch (err) {
            const c = err?.code || '';
            toast.error(c.includes('invalid-credential') || c.includes('wrong-password') ? 'E-mail ou senha incorretos'
                : c.includes('email-already-in-use') ? 'Já existe conta com este e-mail. Use “Entrar”.'
                    : c.includes('weak-password') ? 'Use uma senha com pelo menos 6 caracteres'
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
        <Card className="max-w-md mx-auto">
            <CardHeader><CardTitle className="text-lg">{convite ? 'Entre para aceitar o convite' : 'Entrar no portal das partes'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    Aqui você acompanha os processos para os quais a secretaria o convidou e protocola petições a qualquer tempo.
                </p>
                <Button variant="outline" className="w-full" disabled={ocupado} onClick={() => signInWithGoogle().catch(() => {})}>Entrar com Google</Button>
                <div className="text-center text-xs text-slate-400">ou com e-mail e senha</div>
                <form onSubmit={enviar} className="space-y-3">
                    {modo === 'criar' && <div><Label htmlFor="pt-nome">Nome</Label><Input id="pt-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" /></div>}
                    <div><Label htmlFor="pt-email">E-mail</Label><Input id="pt-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
                    <div><Label htmlFor="pt-senha">Senha</Label><Input id="pt-senha" type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete={modo === 'criar' ? 'new-password' : 'current-password'} /></div>
                    <Button type="submit" className="w-full" disabled={ocupado}>
                        {ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />}{modo === 'criar' ? 'Criar conta' : 'Entrar'}
                    </Button>
                </form>
                <div className="flex justify-between text-sm">
                    <Button variant="link" className="px-0" onClick={() => setModo(modo === 'criar' ? 'entrar' : 'criar')}>{modo === 'criar' ? 'Já tenho conta' : 'Criar conta'}</Button>
                    {modo === 'entrar' && <Button variant="link" className="px-0" onClick={recuperar}>Esqueci a senha</Button>}
                </div>
            </CardContent>
        </Card>
    );
}

function MeusProcessos({ onAbrir }) {
    const q = useQuery({ queryKey: ['portal-processos'], queryFn: () => secPortal('meusProcessos') });
    if (q.isLoading) return <Carregando texto="Carregando seus processos…" />;
    if (q.error) return <p className="text-red-600">{q.error.message}</p>;
    const lista = q.data.processos;
    return (
        <div className="space-y-3">
            <h1 className="text-xl font-semibold">Meus processos</h1>
            {lista.length === 0 && (
                <p className="text-sm text-slate-500">Nenhum processo por aqui. Para acompanhar um processo, abra o link de convite enviado pela secretaria.</p>
            )}
            {lista.map((p) => (
                <button key={p.id} type="button" onClick={() => onAbrir(p.id)} className="w-full text-left rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm">{p.numero}</span>
                        <Badge variant="secondary">{STATUS_ROTULO[p.status] || p.status}</Badge>
                        <span className="text-xs text-slate-500">{p.orgao} · fase {p.fase_nome} · você: {p.polo}</span>
                    </div>
                    <p className="font-medium mt-1">{p.assunto}</p>
                    {p.ultimo_movimento && <p className="text-xs text-slate-500 mt-1 truncate">{dataHora(p.ultimo_movimento.em)} · {p.ultimo_movimento.descricao}</p>}
                </button>
            ))}
        </div>
    );
}

function ProcessoParte({ id, onVoltar }) {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['portal-proc', id], queryFn: () => secPortal('obter', { processoId: id }) });
    const [leitura, setLeitura] = useState(null); // {titulo, texto}
    const [ocupado, setOcupado] = useState(false);

    if (q.isLoading) return <Carregando texto="Carregando processo…" />;
    if (q.error) return <div className="text-red-600">{q.error.message} <Button variant="link" onClick={onVoltar}>Voltar</Button></div>;
    const { processo: p, movimentos, documentos, cadeiaIntegra, orgao } = q.data;

    const baixar = async (d) => {
        setOcupado(true);
        try {
            const r = await secPortal('baixar', { processoId: id, docId: d.id });
            if (r.origem === 'editor') setLeitura({ titulo: r.titulo, texto: r.delta.map((o) => (typeof o.insert === 'string' ? o.insert : '')).join('') });
            else baixarBase64(r.base64, r.nomeArquivo || r.titulo, r.mime);
        } catch (e) {
            toast.error(e?.message || 'Não foi possível abrir');
        } finally {
            setOcupado(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-start gap-3">
                <Button variant="ghost" size="sm" className="gap-1" onClick={onVoltar}><ArrowLeft className="w-4 h-4" /> Meus processos</Button>
                <div className="flex-1 min-w-[14rem]">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-semibold font-mono">{p.numero}</h1>
                        <Badge variant="secondary">{STATUS_ROTULO[p.status] || p.status}</Badge>
                        {cadeiaIntegra
                            ? <Badge variant="outline" className="gap-1"><ShieldCheck className="w-3 h-3" /> Registro íntegro</Badge>
                            : <Badge variant="destructive" className="gap-1"><ShieldAlert className="w-3 h-3" /> Registro com falha de integridade</Badge>}
                    </div>
                    <p className="font-medium">{p.assunto}</p>
                    <p className="text-sm text-slate-500">{orgao} · fase {p.fase_nome} · você participa como {p.minha_parte?.nome} ({p.minha_parte?.polo})</p>
                </div>
            </div>

            {p.fases?.length > 1 && (
                <details className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <summary className="cursor-pointer px-4 py-3 text-sm">Em que ponto está o processo: <b>{p.fase_nome}</b> <span className="text-indigo-700 dark:text-indigo-300">(ver o caminho completo)</span></summary>
                    <div className="px-4 pb-4"><FluxoRito fases={p.fases} atual={p.fase_atual} /></div>
                </details>
            )}

            <div className="grid lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3 space-y-5">
                    <Peticionar id={id} prazos={p.prazos} onFeito={() => { qc.invalidateQueries({ queryKey: ['portal-proc', id] }); qc.invalidateQueries({ queryKey: ['portal-processos'] }); }} />

                    {p.prazos.length > 0 && (
                        <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-base">Prazos em aberto</CardTitle></CardHeader>
                            <CardContent className="space-y-1 text-sm">
                                {p.prazos.map((x, i) => <p key={i}>{x.descricao}{x.destinatario ? ` (${x.destinatario})` : ''} · vence em {x.vence_em.split('-').reverse().join('/')}</p>)}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-base">Documentos ({documentos.length})</CardTitle></CardHeader>
                        <CardContent className="space-y-1">
                            {documentos.length === 0 && <p className="text-sm text-slate-500">Nenhum documento disponível.</p>}
                            {documentos.map((d) => (
                                <div key={d.id} className="flex items-center gap-3 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                    <span className="font-mono text-xs w-8 text-slate-500">{d.ordem}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{d.titulo}</p>
                                        <p className="text-xs text-slate-500">{d.tipo} · {dataHora(d.juntado_em)}</p>
                                    </div>
                                    <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => baixar(d)} aria-label={`Abrir ${d.titulo}`}>
                                        {d.origem === 'editor' ? <FileText className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                                    </Button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                <Card className="lg:col-span-2 h-fit">
                    <CardHeader className="pb-2"><CardTitle className="text-base">Andamento</CardTitle></CardHeader>
                    <CardContent>
                        <ol className="space-y-3">
                            {[...movimentos].reverse().map((m) => (
                                <li key={m.seq} className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-3">
                                    <p className="text-xs text-slate-500">{dataHora(m.em)} · {m.autor_nome}</p>
                                    <p className="text-sm">{m.descricao}</p>
                                </li>
                            ))}
                        </ol>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={!!leitura} onOpenChange={(o) => !o && setLeitura(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{leitura?.titulo}</DialogTitle></DialogHeader>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{leitura?.texto}</div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

const MAX_MB = 5;

function Peticionar({ id, onFeito }) {
    const [titulo, setTitulo] = useState('');
    const [texto, setTexto] = useState('');
    const [arquivo, setArquivo] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const [protocolo, setProtocolo] = useState(null);
    const inputArquivo = useRef(null);

    const enviar = async () => {
        if (!texto.trim() && !arquivo) { toast.error('Escreva a petição ou anexe um arquivo'); return; }
        if (arquivo && arquivo.size > MAX_MB * 1024 * 1024) { toast.error(`O arquivo passa de ${MAX_MB} MB`); return; }
        setOcupado(true);
        try {
            const extra = arquivo ? { base64: await arquivoParaBase64(arquivo), mime: arquivo.type, nomeArquivo: arquivo.name } : {};
            const r = await secPortal('peticionar', { processoId: id, titulo: titulo.trim() || 'Petição', texto, ...extra });
            setProtocolo(r);
            setTitulo(''); setTexto(''); setArquivo(null);
            if (inputArquivo.current) inputArquivo.current.value = '';
            onFeito();
        } catch (e) {
            toast.error(e?.message || 'Não foi possível protocolar');
        } finally {
            setOcupado(false);
        }
    };

    return (
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Peticionar</CardTitle></CardHeader>
            <CardContent className="space-y-3">
                {protocolo && (
                    <div role="status" className="rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 p-3 text-sm">
                        Petição protocolada sob nº {protocolo.protocolo} em {dataHora(protocolo.em)} e juntada como documento nº {protocolo.ordem}.
                    </div>
                )}
                <div><Label htmlFor="pt-tit">Título</Label><Input id="pt-tit" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Manifestação sobre o laudo" maxLength={200} /></div>
                <div><Label htmlFor="pt-txt">Texto</Label><Textarea id="pt-txt" rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={40000} /></div>
                <div>
                    <Label htmlFor="pt-arq">Anexo (PDF, PNG ou JPG, até {MAX_MB} MB)</Label>
                    <Input id="pt-arq" ref={inputArquivo} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setArquivo(e.target.files?.[0] || null)} />
                </div>
                <p className="text-xs text-slate-500">A petição entra nos autos na hora, com seu nome, data e hora, e vai para apreciação de quem decide.</p>
                <Button disabled={ocupado} onClick={enviar} className="gap-2">
                    {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Protocolar
                </Button>
            </CardContent>
        </Card>
    );
}
