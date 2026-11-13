import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Check, Crown, Gavel, Loader2, LogIn, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/FirebaseAuthContext';
import { secConfig } from '@/services/secretariaService';
import { TIPOS_UNIDADE, dataHora } from './comum';
import GestaoUnidade from './GestaoUnidade';
import EstruturaOrgaos, { Organograma } from './Orgaos';
import { nomeOrgao } from '@/lib/orgaos';

/**
 * Aba "Unidades" do Processo Eletrônico: quem é quem em cada unidade,
 * pedido de lotação e, para quem gere uma unidade, a gestão dela (equipe,
 * timbrado, tipos e modelos) sem precisar do Painel Administrativo.
 */
export default function UnidadesDoUsuario({ orgId, estado }) {
    const qc = useQueryClient();
    const geridas = estado.unidades.filter((u) => (estado.gestorDe || []).includes(u.id));
    const [gerida, setGerida] = useState(geridas[0]?.id || null);
    const [pedido, setPedido] = useState(null); // unidade
    const [mensagem, setMensagem] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const nome = (uid) => estado.membros.find((m) => m.uid === uid)?.nome;
    const ativas = estado.unidades.filter((u) => u.ativa);

    const pedir = async () => {
        setOcupado(true);
        try {
            await secConfig(orgId, 'pedirLotacao', { unidadeId: pedido.id, mensagem });
            toast.success('Pedido enviado à gestão da unidade');
            setPedido(null);
            setMensagem('');
            qc.invalidateQueries({ queryKey: ['sec-estado', orgId] });
        } catch (e) { toast.error(e?.message || 'Não foi possível enviar o pedido'); } finally { setOcupado(false); }
    };

    return (
        <div className="space-y-5 pt-2">
            {geridas.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><Crown className="w-4 h-4 text-amber-600" aria-hidden /> {geridas.length > 1 ? 'Unidades que você gere' : 'Unidade que você gere'}</CardTitle>
                        <CardDescription>Monte a equipe, defina atribuições, admita pedidos, convide pessoas e ajuste o papel timbrado, os tipos de documento e os modelos.</CardDescription>
                        {geridas.length > 1 && (
                            <div className="flex flex-wrap gap-2 pt-2" role="group" aria-label="Escolher unidade">
                                {geridas.map((u) => (
                                    <Button key={u.id} size="sm" variant={gerida === u.id ? 'default' : 'outline'} aria-pressed={gerida === u.id} onClick={() => setGerida(u.id)}>
                                        {u.nome}{(u.pedidos || []).length > 0 && <Badge className="ml-2 bg-amber-500 hover:bg-amber-500">{u.pedidos.length}</Badge>}
                                    </Button>
                                ))}
                            </div>
                        )}
                    </CardHeader>
                    <CardContent>{gerida && <GestaoUnidade orgId={orgId} estado={estado} unidadeId={gerida} embutido />}</CardContent>
                </Card>
            )}

            {!estado.isAdmin && (estado.adminOrgaos || []).length > 0 && <EstruturaOrgaos orgId={orgId} estado={estado} />}

            {(estado.orgaos || []).length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Estrutura de {estado.orgao || 'entidade'}</CardTitle>
                        <CardDescription>Os órgãos internos, o que compete a cada um, quem responde e por quais unidades os processos passam.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Organograma detalhado nos={estado.orgaos.filter((o) => o.ativo !== false)} unidadesDe={(o) => ativas.filter((u) => u.orgao_id === o.id)} nomeTitular={(o) => nome(o.titular_uid)} />
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Unidades do órgão</CardTitle>
                    <CardDescription>Quem trabalha em cada unidade e com que atribuição. Para atuar nos processos de uma unidade, é preciso estar lotado nela.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-3">
                    {ativas.length === 0 && <p className="text-sm text-slate-600">Nenhuma unidade ativa.</p>}
                    {ativas.map((u) => {
                        const lotado = estado.minhasUnidades.includes(u.id);
                        return (
                            <div key={u.id} className="rounded-md border border-slate-200 dark:border-slate-700 p-3 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    {u.tipo === 'gabinete' ? <Gavel className="w-4 h-4 text-indigo-600" aria-hidden /> : <Building2 className="w-4 h-4 text-indigo-600" aria-hidden />}
                                    <span className="font-medium">{u.nome}</span>
                                    <Badge variant="outline">{TIPOS_UNIDADE[u.tipo]?.rotulo}</Badge>
                                    {lotado && <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-100">Você está lotado</Badge>}
                                </div>
                                {nomeOrgao(estado, u.orgao_id) && <p className="text-xs text-slate-600 dark:text-slate-400">Órgão: {nomeOrgao(estado, u.orgao_id)}</p>}
                                {u.descricao && <p className="text-sm text-slate-600 dark:text-slate-300">{u.descricao}</p>}
                                {(u.competencias || []).length > 0 && <ul className="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">{u.competencias.map((c) => <li key={c}>{c}</li>)}</ul>}
                                <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-0.5">
                                    {(u.lotacoes || []).filter((l) => nome(l.uid)).map((l) => (
                                        <li key={l.uid}>{nome(l.uid)}{l.atribuicao && <span className="text-slate-600"> · {l.atribuicao}</span>}{l.gestor && <span className="text-amber-700 dark:text-amber-300"> · gestão</span>}</li>
                                    ))}
                                    {!(u.lotacoes || []).length && <li className="text-slate-600">Ninguém lotado</li>}
                                </ul>
                                {!lotado && (u.pedi_lotacao
                                    ? <p className="text-xs text-slate-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" aria-hidden /> Pedido de lotação enviado; aguarde a gestão.</p>
                                    : <Button size="sm" variant="outline" className="gap-1" onClick={() => setPedido(u)}><Send className="w-4 h-4" aria-hidden /> Pedir lotação</Button>)}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <Dialog open={!!pedido} onOpenChange={(o) => !o && setPedido(null)}>
                <DialogContent className="w-[calc(100vw-1rem)] sm:w-full">
                    <DialogHeader>
                        <DialogTitle>Pedir lotação em {pedido?.nome}</DialogTitle>
                        <DialogDescription>A gestão da unidade recebe o pedido e define a sua atribuição ao admiti-lo.</DialogDescription>
                    </DialogHeader>
                    <div><Label htmlFor="pedido-msg">Mensagem (opcional)</Label><Textarea id="pedido-msg" rows={3} maxLength={300} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Ex.: Fui designado para auxiliar na secretaria a partir de hoje." /></div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPedido(null)}>Cancelar</Button>
                        <Button disabled={ocupado} onClick={pedir}>{ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Enviar pedido</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** Aceite do convite de equipe (link `/ProcessoEletronico?equipe=…`). */
export function ConviteEquipe({ token }) {
    const { isAuthenticated, user, signInWithGoogle, signOut } = useAuth();
    const navigate = useNavigate();
    const qc = useQueryClient();
    const [ocupado, setOcupado] = useState(false);
    const q = useQuery({ queryKey: ['convite-equipe', token], queryFn: () => secConfig(null, 'verConviteEquipe', { token }), enabled: !!isAuthenticated, retry: false });
    const c = q.data;
    const emailConta = (user?.email || '').toLowerCase();

    const aceitar = async () => {
        setOcupado(true);
        try {
            const r = await secConfig(null, 'aceitarConviteEquipe', { token });
            toast.success(`Bem-vindo à equipe de ${r.unidade}`);
            await qc.invalidateQueries();
            navigate(`/ProcessoEletronico?org=${r.organizationId}`, { replace: true });
        } catch (e) { toast.error(e?.message || 'Não foi possível aceitar o convite'); } finally { setOcupado(false); }
    };

    return (
        <div className="min-h-[70vh] flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-lg">Convite para equipe do Processo Eletrônico</CardTitle>
                    {c && <CardDescription>{c.convidado_por ? `${c.convidado_por} convidou você` : 'Você foi convidado'} para a unidade <b>{c.unidade}</b> de <b>{c.orgao}</b>{c.atribuicao ? `, como ${c.atribuicao}` : ''}.</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                    {!isAuthenticated && (
                        <>
                            <p>Entre com a conta Google do e-mail convidado para ver e aceitar o convite.</p>
                            <Button className="w-full gap-2" onClick={() => signInWithGoogle().catch(() => {})}><LogIn className="w-4 h-4" aria-hidden /> Entrar com Google</Button>
                        </>
                    )}
                    {isAuthenticated && q.isLoading && <p className="flex items-center gap-2 text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Conferindo o convite…</p>}
                    {isAuthenticated && q.error && <p role="alert" className="text-red-600">{q.error.message}</p>}
                    {c && !c.valido && <p role="alert" className="text-amber-800 dark:text-amber-200">{c.usado ? 'Este convite já foi usado.' : 'Este convite expirou ou foi revogado.'} Peça um novo à gestão da unidade.</p>}
                    {c && c.valido && c.email !== emailConta && (
                        <div role="alert" className="space-y-2">
                            <p>Este convite é para <b>{c.email}</b>, e você entrou como <b>{emailConta}</b>.</p>
                            <Button variant="outline" onClick={() => signOut?.()}>Trocar de conta</Button>
                        </div>
                    )}
                    {c && c.valido && c.email === emailConta && (
                        <>
                            <p>Ao aceitar, você passa a ser membro de {c.orgao} (se ainda não for) e fica lotado em {c.unidade}. O convite vale até {dataHora(c.expira_em)}.</p>
                            <Button className="w-full" disabled={ocupado} onClick={aceitar}>{ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Aceitar e entrar na equipe</Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
