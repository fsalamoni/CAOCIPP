import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    AlertCircle, ArrowLeft, BookOpen, CalendarClock, CheckCircle2, ChevronDown, Download, Eye, FilePen, Loader2, MoreHorizontal,
    PenLine, Plus, Send, ShieldCheck, ShieldAlert, Paperclip, Trash2, Undo2, UserPlus, Camera, Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { secConfig, secDocumento, secExportarPdf, secProcesso, baixarBase64, base64ParaUrl, arquivoParaBase64 } from '@/services/secretariaService';
import { NativeSelect, STATUS_ROTULO, SeloUrgente, copiarTexto, dataHora, documentoDaUnidade, modelosDaUnidade, rotuloUnidade } from './comum';
import FluxoRito from './FluxoRito';
import { CamposProcesso, DadosCampos } from './CamposProcesso';
import { faltando, formularioDe, valoresDe } from '@/lib/camposProcesso';
import LeitorAutos from './LeitorAutos';
import EventosAutos from './EventosAutos';
import { CartaoComunicacoes, ExpedirComunicacao, nomeEspecie } from './Comunicacoes';
import ErroQuery from './ErroQuery';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { seguintes } from '@/lib/secretariaRito';
import { FORMAS, ROTULO_DESTINO, faltaNaFase, niveisDaFase, pedidoDaAcao, pendentesDaFase, situacaoDaFase, sugeridas } from '@/lib/exigencias';
import { AcaoDaFase, RegistrarAcao } from './AcoesNoProcesso';
import { nomeOrgao, unidadeComOrgao } from '@/lib/orgaos';
import RedacaoDocumento, { VisualizadorPdf } from './RedacaoDocumento';
import CapaProcesso from './CapaProcesso';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MAX_MB = 5;
const folhas = (d) => (d.folha_inicial ? (d.folha_final > d.folha_inicial ? `fls. ${d.folha_inicial}–${d.folha_final}` : `fl. ${d.folha_inicial}`) : null);
const diasDesde = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
const emCampo = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;

export default function ProcessoView({ orgId, procId, estado, onVoltar }) {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['sec-proc', orgId, procId], queryFn: () => secProcesso(orgId, 'obter', { id: procId }) });
    const [acao, setAcao] = useState(null); // {tipo, ...}
    const [ocupado, setOcupado] = useState(false);
    const [linkConvite, setLinkConvite] = useState(null); // {link, emailEnviado}
    const [editor, setEditor] = useState(null); // {docId?, titulo, tipo, conteudo, somenteLeitura, modeloId?}
    const [pdf, setPdf] = useState(null); // {base64, nome, titulo}
    const [novoDoc, setNovoDoc] = useState(false);
    const [leitura, setLeitura] = useState(null); // id do documento aberto no leitor contínuo
    const [confirmar, setConfirmar] = useState(null); // {titulo, texto, rotulo, fn}: ato que não se desfaz
    const [vista, setVista] = useState(null); // capa | andamento | autos | eventos (null = padrão do perfil)
    const [registrar, setRegistrar] = useState(null); // ação da fase que pede um dado: {idx, acao, r, fase}
    const pendenciasRef = useRef(null);
    const eventosRef = useRef(null);

    const p = q.data?.processo;
    const posse = q.data?.posse;
    const arquivado = p?.status === 'arquivado';
    const podeMexer = !!posse && !arquivado;
    const algoAberto = !!(acao || editor || pdf || novoDoc || leitura || linkConvite);

    // Atalhos: N novo documento, T tramitar, J ir às pendências. Só com nada aberto e fora de campos.
    useEffect(() => {
        const aoTeclar = (e) => {
            if (algoAberto || emCampo(e) || e.ctrlKey || e.metaKey || e.altKey) return;
            const k = e.key.toLowerCase();
            if (k === 'n' && podeMexer) { e.preventDefault(); setNovoDoc(true); }
            if (k === 't' && podeMexer) { e.preventDefault(); setAcao({ tipo: 'tramitar' }); }
            if (k === 'j') {
                e.preventDefault();
                setVista('andamento');
                setTimeout(() => pendenciasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
            }
        };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [algoAberto, podeMexer]);

    if (q.isLoading) return <div className="py-8 flex gap-2 items-center text-slate-600"><Loader2 className="w-4 h-4 animate-spin" /> Carregando processo…</div>;
    if (q.error?.message?.includes('Portal das partes')) {
        // Membro que é parte neste processo: aqui ele não é o órgão.
        return (
            <div role="alert" className="py-8 max-w-xl space-y-3">
                <p className="font-medium">Você é parte neste processo.</p>
                <p className="text-sm text-slate-600 dark:text-slate-300">Neste processo você não atua pelo órgão: acompanhe-o e manifeste-se pelo Portal das partes, como qualquer outra parte. As ferramentas da equipe ficam fechadas para você aqui.</p>
                <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm"><Link to={`${createPageUrl('Portal')}?p=${procId}`}>Abrir no Portal das partes</Link></Button>
                    <Button variant="ghost" size="sm" onClick={onVoltar}>Voltar</Button>
                </div>
            </div>
        );
    }
    if (q.error) return <ErroQuery q={q}><Button variant="ghost" size="sm" onClick={onVoltar}>Voltar</Button></ErroQuery>;

    const { movimentos, documentos, cadeiaQuebradaEm, hoje, informacoes = [] } = q.data;
    const unidadeAtual = estado.unidades.find((u) => u.id === p.unidade_atual);
    const noGabinete = unidadeAtual?.tipo === 'gabinete';
    const naSecretaria = (unidadeAtual?.tipo || 'secretaria') === 'secretaria';
    const nomeUnidade = (id) => unidadeComOrgao(estado, id, id);
    const atualizar = () => {
        qc.invalidateQueries({ queryKey: ['sec-proc', orgId, procId] });
        qc.invalidateQueries({ queryKey: ['sec-processos', orgId] });
    };
    const executar = async (fn, okMsg) => {
        setOcupado(true);
        try {
            await fn();
            if (okMsg) toast.success(okMsg);
            setAcao(null);
            atualizar();
            return true;
        } catch (e) {
            toast.error(e?.message || 'Não foi possível concluir');
            if (e?.code === 'functions/aborted') atualizar();
            return false;
        } finally {
            setOcupado(false);
        }
    };
    const mov = (action, extra, msg) => executar(() => secProcesso(orgId, action, { id: procId, version: p.version, ...extra }), msg);
    const doc = (action, extra, msg) => executar(() => secDocumento(orgId, procId, action, extra), msg);
    const convidar = (parte_idx, email, extra = {}) => executar(async () => {
        const r = await secProcesso(orgId, 'convidarParte', { id: procId, version: p.version, parte_idx, email, ...extra });
        setLinkConvite(r);
    }, 'Convite gerado');
    const membrosDaUnidade = estado.membros.filter((m) => unidadeAtual?.membros_uids.includes(m.uid));

    const exportar = () => executar(async () => {
        const r = await secExportarPdf(orgId, procId);
        baixarBase64(r.base64, r.nome);
    }, 'PDF gerado');

    /** Arquivo original como foi enviado. */
    const baixarOriginal = (d) => executar(async () => {
        const r = await secDocumento(orgId, procId, 'baixar', { docId: d.id });
        baixarBase64(r.base64, r.nomeArquivo, r.mime);
    });

    /** Peça dos autos como está no processo: PDF com folhas e carimbo. */
    const verNosAutos = (d) => executar(async () => {
        const r = await secDocumento(orgId, procId, 'pdf', { docId: d.id });
        setPdf({ ...r, titulo: `Doc. nº ${d.ordem} · ${d.titulo}` });
    });

    const abrirMinuta = (d) => executar(async () => {
        const r = await secDocumento(orgId, procId, 'baixar', { docId: d.id });
        setEditor({ docId: d.id, titulo: r.titulo, tipo: d.tipo, conteudo: r.conteudo, somenteLeitura: d.status === 'controle' || (d.assinaturas || []).length > 0 });
    });

    const agora = new Date();
    const valoresCampos = {
        numero: p.numero, assunto: p.assunto, tipo_processo: p.tipo_nome || '', unidade: nomeUnidade(p.unidade_atual), fase: p.fase_nome,
        partes: p.partes.map((x) => `${x.nome} (${x.polo})`).join('; '), orgao: estado.orgao || '',
        usuario: estado.membros.find((m) => m.uid === estado.uid)?.nome || '',
        data: agora.toLocaleDateString('pt-BR'), data_extenso: agora.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
    };

    const enviarArquivo = async (file) => {
        if (!file) return;
        if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Arquivo acima de ${MAX_MB} MB`); return; }
        setNovoDoc(false);
        await executar(async () => {
            const base64 = await arquivoParaBase64(file);
            await secDocumento(orgId, procId, 'upload', { titulo: file.name.replace(/\.[^.]+$/, ''), tipo: 'Documento', nomeArquivo: file.name, mime: file.type, base64 });
        }, 'Arquivo enviado como minuta');
    };

    const tipoPadrao = documentoDaUnidade(estado, p.unidade_atual).tipos_documento?.[0] || 'Despacho';
    const modelos = modelosDaUnidade(estado, p.unidade_atual);
    /** Abre o editor (ou cria a minuta do Word/PDF) a partir de um modelo. */
    const usarModelo = (m) => {
        setNovoDoc(false);
        if (m.formato === 'original') {
            executar(async () => {
                const r = await secConfig(orgId, 'baixarModelo', { id: m.id, valores: valoresCampos });
                await secDocumento(orgId, procId, 'upload', { titulo: m.nome, tipo: m.tipo_documento || 'Documento', nomeArquivo: r.nome, mime: r.mime, base64: r.base64, modelo_id: m.id });
            }, /\.pdf$/i.test(m.arquivo_nome) ? 'Minuta criada com o PDF do modelo' : 'Minuta criada com o Word do modelo, campos preenchidos');
            return;
        }
        setEditor({ titulo: m.nome, tipo: m.tipo_documento || tipoPadrao, conteudo: null, modeloId: m.id });
    };
    const redigirEmBranco = (tipo = tipoPadrao, titulo = '') => { setNovoDoc(false); setEditor({ titulo, tipo, conteudo: null }); };

    const minutas = documentos.filter((d) => d.status === 'minuta');
    const autos = documentos.filter((d) => d.status === 'juntado');
    // Documentos de controle: guardados no processo, fora dos autos e da impressão.
    const controles = documentos.filter((d) => d.status === 'controle');
    const iAtual = p.fases.findIndex((f) => f.id === p.fase_atual);
    const faseAtual = p.fases[iAtual];
    const proximas = seguintes(p.fases, iAtual).map((id) => p.fases.find((f) => f.id === id)).filter(Boolean);
    // O rito pode dizer em que unidade a fase corre: sugere remeter para lá.
    const unidadeDaFase = faseAtual?.unidade_id && faseAtual.unidade_id !== p.unidade_atual
        ? estado.unidades.find((u) => u.id === faseAtual.unidade_id && u.ativa) : null;
    const modelosDaFase = (faseAtual?.modelos || []).map((id) => (estado.modelos || []).find((m) => m.id === id)).filter(Boolean);
    const feitas = new Set(p.acoes_feitas?.[p.fase_atual] || []);
    // Documentos que o rito exige na fase (dela ou de uma ação) e o que já foi juntado.
    const exigencias = situacaoDaFase(faseAtual, p.exigencias_cumpridas);
    const docsDaFase = exigencias.filter((e) => e.acao_idx === undefined);
    const itemExigencia = (e) => (
        <ItemExigencia e={e} podeMexer={podeMexer} ocupado={ocupado} modelo={(estado.modelos || []).find((m) => m.id === e.modelo_id)}
            onModelo={usarModelo} onNovo={() => setNovoDoc(true)} />
    );
    const pendenciasAbertas = p.pendencias.filter((x) => x.status === 'aberta');
    const niveis = niveisDaFase(faseAtual);
    // Informação registrada nesta rodada da fase, por ação (a última de cada uma).
    const infoDaAcao = (i) => [...informacoes].reverse().find((x) => x.fase_id === p.fase_atual && x.acao_idx === i);
    const temControlePendente = exigencias.some((e) => e.destino && !e.cumprida);

    // Botão único da fase: o que o rito espera agora.
    let principal = null;
    if (podeMexer) {
        if (unidadeDaFase) {
            principal = { rotulo: `Enviar para ${unidadeDaFase.nome}`, icone: Send, acao: () => setAcao({ tipo: 'tramitar', destino: unidadeDaFase.id }) };
        } else if (p.fase_suspensa) {
            principal = noGabinete
                ? { rotulo: 'Apreciar a pendência', icone: AlertCircle, acao: () => setAcao({ tipo: 'resolver', pendencia: pendenciasAbertas.find((x) => x.interrompe) || pendenciasAbertas[0] }) }
                : null;
        } else if (proximas.length === 1) {
            const f = proximas[0];
            const un = f.unidade_id && f.unidade_id !== p.unidade_atual ? estado.unidades.find((u) => u.id === f.unidade_id && u.ativa) : null;
            principal = un
                ? { rotulo: `Concluir e enviar para ${un.nome}`, icone: Send, acao: () => setAcao({ tipo: 'tramitar', destino: un.id, fase_id: f.id }) }
                : { rotulo: `Concluir e seguir para ${f.nome}`, icone: CheckCircle2, acao: () => setAcao({ tipo: 'fase', fase_id: f.id }) };
        } else if (proximas.length > 1) {
            principal = { rotulo: 'Seguir para a próxima fase…', icone: CheckCircle2, acao: () => setAcao({ tipo: 'fase' }) };
        } else if (noGabinete && pendenciasAbertas.length) {
            principal = { rotulo: 'Apreciar a pendência', icone: AlertCircle, acao: () => setAcao({ tipo: 'resolver', pendencia: pendenciasAbertas[0] }) };
        } else {
            principal = { rotulo: 'Fase final: arquivar', icone: CheckCircle2, acao: () => setAcao({ tipo: 'situacao', status: 'arquivado' }) };
        }
    }

    const ultimoDoc = autos[autos.length - 1];
    const diasTramitando = diasDesde(p.autuado_em);
    // Quem tem o processo abre no Andamento (onde age); os demais, na Capa.
    const vistaAtual = vista || (podeMexer ? 'andamento' : 'capa');
    const noAndamento = vistaAtual === 'andamento';

    return (
        <div className="space-y-4 pb-20 sm:pb-0">
            {noAndamento && (principal || podeMexer) && (
                <div className="sm:hidden fixed bottom-0 inset-x-0 z-20 flex gap-2 border-t bg-white/95 dark:bg-slate-950/95 backdrop-blur p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
                    {principal && <Button className="flex-1 gap-2" disabled={ocupado} onClick={principal.acao}><principal.icone className="w-4 h-4" aria-hidden /> <span className="truncate">{principal.rotulo}</span></Button>}
                    {podeMexer && <Button variant="outline" size="icon" disabled={ocupado} onClick={() => setNovoDoc(true)} aria-label="Novo documento"><Plus className="w-4 h-4" aria-hidden /></Button>}
                </div>
            )}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                    <Button variant="ghost" size="sm" className="gap-1 -ml-2" onClick={onVoltar}><ArrowLeft className="w-4 h-4" /> Processos</Button>
                    <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white break-words"><span className="font-mono">{p.numero}</span> · {p.assunto}</h2>
                    <div className="flex flex-wrap gap-2 text-sm">
                        <Badge>{p.fase_nome}</Badge>
                        <Badge variant="secondary">{STATUS_ROTULO[p.status]}</Badge>
                        <Badge variant="outline">Com: {nomeUnidade(p.unidade_atual)}</Badge>
                        {p.responsavel_uid && <Badge variant="outline">Responsável: {estado.membros.find((m) => m.uid === p.responsavel_uid)?.nome || '—'}</Badge>}
                        {p.urgente && <SeloUrgente motivo={p.urgencia?.motivo} />}
                        {p.sigilo === 'restrito' && <Badge variant="outline">Restrito</Badge>}
                        {cadeiaQuebradaEm === null
                            ? <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><ShieldCheck className="w-4 h-4" /> Integridade conferida</span>
                            : <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400"><ShieldAlert className="w-4 h-4" /> Cadeia quebrada no movimento {cadeiaQuebradaEm}</span>}
                    </div>
                    {noGabinete && noAndamento && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {p.partes.map((x) => `${x.nome} (${x.polo})`).join(' · ') || 'Sem partes'}{p.tipo_nome ? ` · ${p.tipo_nome}` : ''}
                            {diasTramitando != null && ` · ${diasTramitando} dia${diasTramitando === 1 ? '' : 's'} em tramitação`}
                            {ultimoDoc && ` · último documento: nº ${ultimoDoc.ordem}, ${ultimoDoc.titulo}`}
                        </p>
                    )}
                </div>
            </div>

            <Tabs value={vistaAtual} onValueChange={setVista}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList className="flex-wrap h-auto">
                    <TabsTrigger value="capa">Capa</TabsTrigger>
                    <TabsTrigger value="andamento">Andamento{p.pendencias_abertas > 0 ? ` (${p.pendencias_abertas})` : ''}</TabsTrigger>
                    <TabsTrigger value="autos">Autos ({autos.length})</TabsTrigger>
                    <TabsTrigger value="eventos">Eventos ({movimentos.length})</TabsTrigger>
                </TabsList>
                {noAndamento && (
                <div className="flex flex-wrap gap-2 items-start">
                    {principal && (
                        <Button className="gap-2 hidden sm:inline-flex" disabled={ocupado} onClick={principal.acao}><principal.icone className="w-4 h-4" /> {principal.rotulo}</Button>
                    )}
                    {podeMexer && <Button variant="outline" className="gap-2 hidden sm:inline-flex" disabled={ocupado} onClick={() => setNovoDoc(true)} title="Atalho: N"><Plus className="w-4 h-4" /> Novo documento</Button>}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" className="gap-1" aria-label="Mais ações"><MoreHorizontal className="w-4 h-4" /> Mais <ChevronDown className="w-3 h-3" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {posse && (
                                <>
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'tramitar' })}>Enviar para outra unidade <span className="ml-auto text-xs text-slate-400">T</span></DropdownMenuItem>
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'fase' })}>Mudar a fase</DropdownMenuItem>
                                    {noGabinete && <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'devolver' })}>Devolver à secretaria com orientação</DropdownMenuItem>}
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'atribuir' })}>Atribuir a alguém da unidade</DropdownMenuItem>
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'pendencia' })}>Abrir pendência para o decisor</DropdownMenuItem>
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'prazo' })}>Abrir prazo</DropdownMenuItem>
                                    <DropdownMenuItem disabled={!podeMexer || !naSecretaria || p.status !== 'em_tramitacao'} onSelect={() => setAcao({ tipo: 'comunicar' })}>Intimar ou comunicar uma parte</DropdownMenuItem>
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'urgencia' })}>{p.urgente ? 'Retirar a urgência' : 'Marcar como urgente'}</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setAcao({ tipo: 'situacao' })}>Alterar a situação</DropdownMenuItem>
                                    <DropdownMenuItem disabled={!podeMexer} onSelect={() => setAcao({ tipo: 'dados' })}>Corrigir os dados do processo</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            <DropdownMenuItem disabled={!autos.length} onSelect={() => setLeitura(autos[0]?.id)}>Ler os autos em sequência</DropdownMenuItem>
                            <DropdownMenuItem onSelect={exportar}>Exportar PDF dos autos</DropdownMenuItem>
                            {q.data?.pode_excluir && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem className="text-red-700 dark:text-red-400 focus:text-red-700" onSelect={() => setAcao({ tipo: 'excluir' })}>Excluir processo</DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                )}
            </div>

            <TabsContent value="capa" className="mt-4">
                <CapaProcesso p={p} movimentos={movimentos} informacoes={informacoes} estado={estado} nomeUnidade={nomeUnidade} cadeiaQuebradaEm={cadeiaQuebradaEm}
                    onLer={(id) => setLeitura(id)} onVerEventos={() => setVista('eventos')} />
            </TabsContent>

            <TabsContent value="andamento" className="mt-4 space-y-5">
            {!posse && <p className="text-sm text-slate-600 dark:text-slate-400">Você consulta este processo. Só a unidade que está com ele pode movimentá-lo.</p>}

            {p.orientacao && (
                <div role="status" className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-4 py-3 text-sm">
                    <Undo2 className="w-4 h-4 mt-0.5 text-amber-700 dark:text-amber-300 shrink-0" aria-hidden />
                    <div className="flex-1 min-w-[12rem]">
                        <p className="font-medium">Orientação de {p.orientacao.de || 'outra unidade'} ({p.orientacao.por}, {dataHora(p.orientacao.em)})</p>
                        <p className="whitespace-pre-wrap">{p.orientacao.texto}</p>
                    </div>
                    {podeMexer && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => mov('concluirOrientacao', {}, 'Orientação concluída')}>Concluída</Button>}
                </div>
            )}

            {/* Nesta fase: o que o rito espera, com caixas para marcar e os modelos indicados. */}
            <Card className="border-indigo-200 dark:border-indigo-900">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span>Nesta fase: {p.fase_nome}</span>
                        {proximas.length > 0 && <span className="text-sm font-normal text-slate-600">segue para {proximas.map((f) => f.nome).join(' ou ')}</span>}
                        {proximas.length === 0 && <span className="text-sm font-normal text-slate-600">fase final</span>}
                        {faseAtual?.prazo_dias > 0 && <span className="text-sm font-normal text-slate-600">· prazo da fase: {faseAtual.prazo_dias} dias</span>}
                    </CardTitle>
                    {(faseAtual?.unidade_id || faseAtual?.agente) && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {faseAtual.unidade_id && <>Corre em <b>{nomeUnidade(faseAtual.unidade_id)}</b></>}
                            {faseAtual.unidade_id && faseAtual.agente && ' · '}
                            {faseAtual.agente && <>quem faz: <b>{faseAtual.agente}</b></>}
                        </p>
                    )}
                </CardHeader>
                <CardContent className="space-y-3">
                    {faseAtual?.orientacao && <p className="text-sm rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100 px-3 py-2">{faseAtual.orientacao}</p>}
                    {faseAtual?.acoes?.length > 0 && (
                        <ul className="space-y-1">
                            {faseAtual.acoes.map((a, i) => {
                                // Ação que pede documento: cumpre-se com a juntada (ou guardando-o), não aqui.
                                const exig = exigencias.find((e) => e.acao_idx === i);
                                if (exig) return <li key={i}>{itemExigencia(exig)}</li>;
                                const r = faseAtual.acoes_regras?.[i] || null;
                                const desfazer = () => setConfirmar({
                                    titulo: 'Desfazer a ação?',
                                    texto: `"${a}" volta a ficar pendente${pedidoDaAcao(r) !== 'confirmar' ? ' e a informação registrada sai das informações do processo' : ''}. O desfazimento fica registrado${r?.destino === 'autos' || r?.autos ? ' nos autos, em certidão' : ' nos eventos'}.`,
                                    rotulo: 'Desfazer',
                                    fn: () => mov('marcarAcao', { acao_idx: i, feita: false }, 'Ação desfeita'),
                                });
                                return (
                                    <li key={i}>
                                        <AcaoDaFase acao={a} r={r} feita={feitas.has(i)} info={infoDaAcao(i)} podeMexer={podeMexer} ocupado={ocupado}
                                            onMarcar={(feita) => mov('marcarAcao', { acao_idx: i, feita })}
                                            onRegistrar={() => setRegistrar({ idx: i, acao: a, r, fase: p.fase_nome, version: p.version })}
                                            onDesfazer={desfazer} />
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {docsDaFase.length > 0 && (
                        <div>
                            <p className="text-sm font-medium">Documentos exigidos nesta fase</p>
                            <ul className="space-y-1 mt-1">{docsDaFase.map((e) => <li key={e.chave}>{itemExigencia(e)}</li>)}</ul>
                        </div>
                    )}
                    {(niveis.fase !== 'autos' || niveis.remessas !== 'autos') && (
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                            Pelo rito, entrar e sair desta fase fica {niveis.fase === 'autos' ? 'nos autos' : ROTULO_DESTINO[niveis.fase]}, e as remessas entre unidades durante ela,
                            {' '}{niveis.remessas === 'autos' ? 'nos autos' : ROTULO_DESTINO[niveis.remessas]}. Documento juntado continua nos autos.
                        </p>
                    )}
                    {modelosDaFase.length > 0 && podeMexer && (
                        <div className="flex flex-wrap gap-2">
                            {modelosDaFase.map((m) => (
                                <Button key={m.id} size="sm" variant="outline" className="gap-1" disabled={ocupado} onClick={() => usarModelo(m)}><FilePen className="w-4 h-4" /> Redigir {m.nome}</Button>
                            ))}
                        </div>
                    )}
                    {faseAtual?.condicoes && Object.keys(faseAtual.condicoes).length > 0 && (
                        <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-0.5">
                            {Object.entries(faseAtual.condicoes).map(([id, cond]) => <li key={id}>Se {cond}: segue para <b>{p.fases.find((f) => f.id === id)?.nome || id}</b></li>)}
                        </ul>
                    )}
                    {!faseAtual?.acoes?.length && !modelosDaFase.length && !faseAtual?.orientacao && !exigencias.length && (
                        <p className="text-sm text-slate-600">O rito não detalha esta fase. {podeMexer ? 'Use Novo documento para redigir e o botão acima para seguir.' : ''}</p>
                    )}
                    <details className="group text-sm">
                        <summary className="cursor-pointer text-indigo-700 dark:text-indigo-300 list-none"><span className="group-open:hidden">Ver o fluxo do rito</span><span className="hidden group-open:inline">Ocultar o fluxo</span></summary>
                        <FluxoRito fases={p.fases} atual={p.fase_atual} unidades={estado.unidades} className="mt-2" />
                    </details>
                </CardContent>
            </Card>

            <div className="grid lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3 space-y-5">
                    {posse && (
                        <Card>
                            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-base" title="Rascunhos da unidade: só entram nos autos quando alguém os junta">Minutas da unidade</CardTitle>
                                <Button size="sm" variant="outline" className="gap-1" disabled={!podeMexer || ocupado} onClick={() => setNovoDoc(true)}><Plus className="w-4 h-4" /> Novo documento</Button>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {minutas.length === 0 && <p className="text-sm text-slate-600">Minutas ficam visíveis só para a sua unidade até a juntada, salvo as que seguem com o processo numa remessa.</p>}
                                {minutas.map((d) => {
                                    const assinei = d.assinaturas.some((a) => a.uid === estado.uid);
                                    const pedidoAMim = (d.assinaturas_pedidas || []).some((x) => x.uid === estado.uid) && !assinei;
                                    const pedidos = (d.assinaturas_pedidas || []).filter((x) => !d.assinaturas.some((a) => a.uid === x.uid));
                                    return (
                                        <div key={d.id} className={`flex flex-wrap items-center gap-2 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800 ${pedidoAMim ? 'bg-amber-50 dark:bg-amber-950/40 -mx-2 px-2 rounded' : ''}`}>
                                            <Paperclip className="w-4 h-4 text-slate-400" />
                                            <div className="flex-1 min-w-[10rem]">
                                                <p className="font-medium">{d.titulo}{pedidoAMim && <Badge className="ml-2 bg-amber-500 hover:bg-amber-500">Pediram sua assinatura</Badge>}</p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                                    {d.tipo} · {d.origem === 'editor' ? 'redigido' : d.nome_arquivo} · {d.autor_nome}{d.assinaturas.length ? ` · assinado por ${d.assinaturas.map((a) => a.nome).join(', ')}` : ''}
                                                    {pedidos.length ? ` · aguarda assinatura de ${pedidos.map((x) => x.nome).join(', ')}` : ''}
                                                    {d.unidade_origem !== p.unidade_atual && ` · redigida em ${nomeUnidade(d.unidade_origem)}`}
                                                </p>
                                            </div>
                                            {d.origem === 'editor'
                                                ? <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => abrirMinuta(d)}>{d.assinaturas.length ? 'Ler' : 'Editar'}</Button>
                                                : <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => baixarOriginal(d)} aria-label="Baixar"><Download className="w-4 h-4" /></Button>}
                                            <Button size="sm" variant="outline" className="gap-1" disabled={assinei || ocupado || !podeMexer} onClick={() => doc('assinar', { docId: d.id }, 'Documento assinado')}><PenLine className="w-4 h-4" /> {assinei ? 'Assinado' : 'Assinar'}</Button>
                                            {membrosDaUnidade.length > 1 && <Button size="sm" variant="ghost" className="gap-1" disabled={ocupado || !podeMexer} onClick={() => setAcao({ tipo: 'pedirAssinatura', documento: d })} title="Pedir a assinatura de alguém da unidade"><UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Pedir assinatura</span></Button>}
                                            <Button size="sm" disabled={ocupado || !podeMexer} onClick={() => setAcao({ tipo: 'juntar', documento: d, assinei })} title="Incluir nos autos, com numeração e data; não pode ser desfeito">Juntar</Button>
                                            <Button size="sm" variant={temControlePendente ? 'outline' : 'ghost'} className="gap-1" disabled={ocupado || !podeMexer} onClick={() => setAcao({ tipo: 'guardar', documento: d })} title="Guardar no processo como documento de controle: fica com a equipe, fora dos autos e da impressão; não pode ser desfeito"><Archive className="w-4 h-4" /> <span className={temControlePendente ? '' : 'hidden sm:inline'}>Guardar fora dos autos</span></Button>
                                            {/* Quem recebeu a minuta com o processo não apaga o trabalho da outra unidade. */}
                                            {(d.unidade_origem === p.unidade_atual || !posse) && <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setConfirmar({ titulo: 'Excluir a minuta?', texto: `"${d.titulo}" será apagada de vez. Minuta não fica nos autos, então não há como recuperar.`, rotulo: 'Excluir minuta', fn: () => doc('excluirMinuta', { docId: d.id }, 'Minuta excluída') })} aria-label={`Excluir a minuta ${d.titulo}`}><Trash2 className="w-4 h-4" /></Button>}
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    <Card ref={pendenciasRef} className={noGabinete && pendenciasAbertas.length ? 'border-amber-300 dark:border-amber-700' : ''}>
                        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-base">{noGabinete ? 'Para decidir' : 'Pendências e prazos'}</CardTitle>
                            {posse && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" className="gap-1" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'pendencia' })}><AlertCircle className="w-4 h-4" /> Pendência</Button>
                                    <Button size="sm" variant="outline" className="gap-1" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'prazo' })}><CalendarClock className="w-4 h-4" /> Prazo</Button>
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            {p.fase_suspensa && <p className="text-amber-700 dark:text-amber-400 font-medium">Fase interrompida até o decisor apreciar a pendência.</p>}
                            {pendenciasAbertas.map((x) => {
                                const dias = diasDesde(x.aberta_em);
                                const docDaPend = x.documento_id ? autos.find((d) => d.id === x.documento_id) : null;
                                return (
                                    <div key={x.id} className="flex flex-wrap items-center gap-2 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                        <AlertCircle className="w-4 h-4 text-amber-600" />
                                        <div className="flex-1 min-w-[10rem]">
                                            <p>{x.descricao}</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                                Aberta {dias === 0 ? 'hoje' : `há ${dias} dia${dias === 1 ? '' : 's'}`} por {x.aberta_por}{x.interrompe ? ' · interrompe a fase' : ''}
                                                {docDaPend && <> · <button type="button" className="underline" onClick={() => setLeitura(docDaPend.id)}>ver doc. nº {docDaPend.ordem}</button></>}
                                            </p>
                                        </div>
                                        {posse && noGabinete && <Button size="sm" disabled={ocupado || arquivado} onClick={() => setAcao({ tipo: 'resolver', pendencia: x })}>Apreciar</Button>}
                                    </div>
                                );
                            })}
                            {p.prazos.filter((x) => x.status === 'aberto').map((x) => {
                                const vencido = hoje > x.vence_em;
                                return (
                                    <div key={x.id} className="flex flex-wrap items-center gap-2 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                        <CalendarClock className={`w-4 h-4 ${vencido ? 'text-red-600' : 'text-indigo-600'}`} />
                                        <div className="flex-1 min-w-[10rem]">
                                            <p>{x.descricao}{x.destinatario ? ` · ${x.destinatario}` : ''}</p>
                                            <p className={`text-xs ${vencido ? 'text-red-700 dark:text-red-400 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                                                {x.dias} dias {x.contagem === 'uteis' ? 'úteis' : 'corridos'} · {vencido ? 'venceu' : 'vence'} em {x.vence_em.split('-').reverse().join('/')}
                                            </p>
                                        </div>
                                        {posse && <Button size="sm" variant="outline" disabled={ocupado || arquivado} onClick={() => setAcao({ tipo: 'encerrarPrazo', prazo: x })}>Encerrar</Button>}
                                    </div>
                                );
                            })}
                            {pendenciasAbertas.length === 0 && !p.prazos.some((x) => x.status === 'aberto') && <p className="text-slate-600">Nenhuma pendência ou prazo aberto.</p>}
                            {noGabinete && p.pendencias.some((x) => x.status === 'resolvida') && (
                                <details className="pt-1">
                                    <summary className="cursor-pointer text-slate-600">Decisões anteriores ({p.pendencias.filter((x) => x.status === 'resolvida').length})</summary>
                                    <ul className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                        {p.pendencias.filter((x) => x.status === 'resolvida').map((x) => <li key={x.id}><b>{dataHora(x.resolvida_em)}</b> · {x.descricao}: {x.resolucao}</li>)}
                                    </ul>
                                </details>
                            )}
                        </CardContent>
                    </Card>

                </div>

                <div className="lg:col-span-2 space-y-5">
                    <CartaoComunicacoes p={p} posse={posse} podeMexer={podeMexer && p.status === 'em_tramitacao'} naSecretaria={naSecretaria} ocupado={ocupado}
                        onNova={() => setAcao({ tipo: 'comunicar' })} onSemEfeito={(c) => setAcao({ tipo: 'semEfeito', comunicacao: c })} />

                    {posse && (
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">Partes no portal</CardTitle>
                                <p className="text-sm text-slate-600 dark:text-slate-400">Convide as partes e os representantes para acompanharem e peticionarem pelo portal.</p>
                            </CardHeader>
                            <CardContent className="text-sm">
                                {p.partes.length === 0 && <p className="text-slate-600">Nenhuma parte cadastrada. Inclua partes em Mais › Corrigir os dados do processo, se o tipo permitir.</p>}
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {p.partes.map((x, i) => (
                                        <li key={i} className="py-2 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="flex-1 min-w-[10rem]">{x.nome} ({x.polo}){x.email ? ` · ${x.email}` : ''}</span>
                                                {x.portal === 'ativo' && <Badge variant="secondary">Acompanha pelo portal</Badge>}
                                                {x.portal === 'convidado' && <Badge variant="outline">Convite pendente</Badge>}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {x.portal !== 'ativo' && <Button size="sm" variant="outline" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'convidar', idx: i, parte: x })}>{x.portal ? 'Novo convite' : 'Convidar'}</Button>}
                                                {x.portal && <Button size="sm" variant="ghost" disabled={!podeMexer || ocupado} onClick={() => setConfirmar({ titulo: 'Revogar o acesso ao portal?', texto: `${x.nome} deixa de ver o processo e de peticionar pelo portal. A revogação fica registrada nos autos. Você pode convidar de novo depois.`, rotulo: 'Revogar acesso', fn: () => mov('revogarParte', { parte_idx: i }, 'Acesso revogado') })}>Revogar</Button>}
                                                <Button size="sm" variant="ghost" className="gap-1" disabled={!podeMexer || ocupado} title={`Advogado, procurador ou preposto que fala por ${x.nome}`} onClick={() => setAcao({ tipo: 'convidar', idx: i, parte: x, novoRep: true })}><UserPlus className="w-4 h-4" /> Representante</Button>
                                            </div>
                                            {(x.representantes || []).length > 0 && (
                                                <ul className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-1">
                                                    {x.representantes.map((r, k) => (
                                                        <li key={k} className="flex flex-wrap items-center gap-2 text-xs">
                                                            <span className="flex-1 min-w-[10rem]">{r.nome}, representante{r.email ? ` · ${r.email}` : ''}</span>
                                                            {r.portal === 'ativo' && <Badge variant="secondary">Acompanha pelo portal</Badge>}
                                                            {r.portal === 'convidado' && <Badge variant="outline">Convite pendente</Badge>}
                                                            {r.portal !== 'ativo' && <Button size="sm" variant="outline" disabled={!podeMexer || ocupado} onClick={() => setAcao({ tipo: 'convidar', idx: i, parte: x, representante: r, representante_idx: k })}>{r.portal ? 'Novo convite' : 'Convidar'}</Button>}
                                                            <Button size="sm" variant="ghost" disabled={!podeMexer || ocupado} onClick={() => setConfirmar({ titulo: 'Retirar o representante?', texto: `${r.nome} deixa de constar como representante de ${x.nome}${r.portal ? ' e perde o acesso ao portal' : ''}. O ato fica registrado.`, rotulo: r.portal ? 'Revogar e retirar' : 'Retirar', fn: () => mov('revogarParte', { parte_idx: i, representante_idx: k }, r.portal ? 'Acesso revogado' : 'Representante retirado') })}>{r.portal ? 'Revogar' : 'Retirar'}</Button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                    {posse && <p className="hidden sm:block text-xs text-slate-600 dark:text-slate-400">Atalhos: <kbd>N</kbd> novo documento · <kbd>T</kbd> enviar para outra unidade · <kbd>J</kbd> ir às pendências</p>}
                </div>
            </div>
            </TabsContent>

            <TabsContent value="autos" className="mt-4">
                <Card>
                    <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-base">Autos ({autos.length} documentos)</CardTitle>
                        <div className="flex flex-wrap gap-2">
                            {autos.length > 0 && <Button size="sm" variant="outline" className="gap-1" onClick={() => setLeitura(autos[0].id)}><BookOpen className="w-4 h-4" /> Ler em sequência</Button>}
                            <Button size="sm" variant="outline" className="gap-1" disabled={ocupado} onClick={exportar}><Download className="w-4 h-4" /> PDF dos autos</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {autos.length === 0 && <p className="text-sm text-slate-600">Nenhum documento juntado ainda.{podeMexer ? ' Comece por Novo documento.' : ''}</p>}
                        {autos.map((d) => (
                            <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                <span className="font-mono text-xs w-8 text-slate-600">{d.ordem}</span>
                                <div className="flex-1 min-w-[11rem]">
                                    <button type="button" className="font-medium block max-w-full text-left break-words hover:underline" onClick={() => setLeitura(d.id)}>{d.titulo}</button>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">{[d.tipo, folhas(d), dataHora(d.juntado_em), d.assinaturas.length ? `assinado por ${d.assinaturas.map((a) => a.nome).join(', ')}` : 'sem assinatura'].filter(Boolean).join(' · ')}</p>
                                    {d.codigo_verificacao && (
                                        <a href={`/Conferir?c=${d.codigo_verificacao}`} target="_blank" rel="noreferrer" className="text-xs font-mono text-indigo-700 dark:text-indigo-300 hover:underline" title="Abrir a conferência pública deste documento">
                                            Conferência {d.codigo_verificacao}
                                        </a>
                                    )}
                                </div>
                                {d.peticao && <Badge variant="secondary">Petição da parte{d.peticao_tipo ? `: ${d.peticao_tipo}` : ''}</Badge>}
                                {!d.visivel_partes && <Badge variant="outline">Fora do portal</Badge>}
                                <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => verNosAutos(d)} aria-label={`Ver ${d.titulo} nos autos`} title="Ver nos autos (PDF com folhas)"><Eye className="w-4 h-4" /></Button>
                                {d.origem === 'upload' && <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => baixarOriginal(d)} aria-label={`Baixar o arquivo original de ${d.titulo}`} title="Baixar o arquivo original"><Download className="w-4 h-4" /></Button>}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </TabsContent>

            {controles.length > 0 && (
                <TabsContent value="autos" className="mt-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Documentos guardados fora dos autos ({controles.length})</CardTitle>
                            <p className="text-xs text-slate-600 dark:text-slate-400">Documentos de controle: a equipe vê, as partes não. Não têm folha e não saem no PDF dos autos.</p>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {controles.map((d) => (
                                <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 border-b last:border-0 border-slate-100 dark:border-slate-800">
                                    <Archive className="w-4 h-4 text-slate-400" aria-hidden />
                                    <div className="flex-1 min-w-[11rem]">
                                        <p className="font-medium break-words">{d.titulo}</p>
                                        <p className="text-xs text-slate-600 dark:text-slate-400">{[d.tipo, d.guardado_em && `guardado em ${dataHora(d.guardado_em)}`, d.guardado_por, d.assinaturas.length ? `assinado por ${d.assinaturas.map((a) => a.nome).join(', ')}` : ''].filter(Boolean).join(' · ')}</p>
                                    </div>
                                    {d.origem === 'editor'
                                        ? <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => abrirMinuta(d)} aria-label={`Ler ${d.titulo}`}><Eye className="w-4 h-4" /></Button>
                                        : <Button variant="ghost" size="sm" disabled={ocupado} onClick={() => baixarOriginal(d)} aria-label={`Baixar ${d.titulo}`}><Download className="w-4 h-4" /></Button>}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>
            )}

            <TabsContent value="eventos" className="mt-4">
                <div ref={eventosRef} className="scroll-mt-4">
                    <EventosAutos movimentos={movimentos} nomeUnidade={nomeUnidade} gerarPdf={(selecao) => secExportarPdf(orgId, procId, selecao)} />
                </div>
            </TabsContent>
            </Tabs>

            <RegistrarAcao alvo={registrar} ocupado={ocupado} onFechar={() => setRegistrar(null)}
                onEnviar={async (valor) => { const ok = await mov('marcarAcao', { acao_idx: registrar.idx, feita: true, valor, version: registrar.version }, 'Ação registrada'); if (ok) setRegistrar(null); return ok; }} />

            {acao?.tipo === 'dados' && (
                <EditarDados p={p} tipo={(estado.tipos || []).find((t) => t.id === p.tipo_id)} ocupado={ocupado} onFechar={() => setAcao(null)}
                    onSalvar={(dados) => mov('alterarDados', dados, 'Dados do processo alterados')} />
            )}

            <ExpedirComunicacao aberto={acao?.tipo === 'comunicar'} p={p} autos={autos} faseAtual={faseAtual} cienciaDias={estado.ciencia_dias ?? 10} textosProntos={estado.textos_comunicacao || []} ocupado={ocupado}
                onFechar={() => setAcao(null)} onExpedir={(comunicacao) => mov('expedirComunicacao', { comunicacao }, comunicacao.meio === 'outro' ? 'Ciência registrada nos autos' : 'Comunicação expedida')} />

            {acao?.tipo === 'excluir' && (
                <ExcluirProcesso p={p} admin={estado.isAdmin} ocupado={ocupado} onFechar={() => setAcao(null)}
                    onExcluir={async (motivo) => { if (await mov('excluir', { motivo }, `Processo ${p.numero} excluído`)) onVoltar(); }} />
            )}

            <AcaoDialog acao={['dados', 'comunicar', 'excluir'].includes(acao?.tipo) ? null : acao} onClose={() => setAcao(null)} ocupado={ocupado} p={p} estado={estado} membros={membrosDaUnidade} minutas={minutas} mov={mov} doc={doc} convidar={convidar}
                noGabinete={noGabinete} orgId={orgId} procId={procId}
                onDespacho={(pend) => { setAcao(null); setEditor({ titulo: `Despacho: ${pend.descricao}`.slice(0, 200), tipo: 'Despacho', conteudo: null, modeloId: modelos.find((m) => /despacho/i.test(m.nome) && m.formato !== 'original')?.id }); }} />

            <NovoDocumento aberto={novoDoc} onFechar={() => setNovoDoc(false)} tipos={documentoDaUnidade(estado, p.unidade_atual).tipos_documento || []} tipoPadrao={tipoPadrao}
                modelosDaFase={modelosDaFase} modelos={modelos} onModelo={usarModelo} onEmBranco={redigirEmBranco} onArquivo={enviarArquivo} ocupado={ocupado} />

            <Dialog open={!!linkConvite} onOpenChange={(o) => !o && setLinkConvite(null)}>
                <DialogContent className="max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                    <DialogHeader><DialogTitle>Convite gerado</DialogTitle></DialogHeader>
                    <div className="space-y-2 text-sm">
                        <p>{linkConvite?.emailEnviado ? 'O convite foi enviado por e-mail. Você também pode copiar o link abaixo.' : 'Envie este link à parte pelo meio que preferir. Ele não será mostrado de novo.'}</p>
                        <Input readOnly value={linkConvite?.link || ''} onFocus={(e) => e.target.select()} aria-label="Link do convite" />
                        <p className="text-xs text-slate-600">Vale por 7 dias e só pode ser aceito por uma conta. Quem aceitar vê os documentos marcados como visíveis às partes e pode peticionar.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => copiarTexto(linkConvite?.link || '', 'Link copiado')}>Copiar link</Button>
                        <Button onClick={() => setLinkConvite(null)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <RedacaoDocumento
                aberto={!!editor}
                inicial={editor}
                estado={estado}
                orgId={orgId}
                unidadeId={p.unidade_atual}
                valoresCampos={valoresCampos}
                onSalvar={async ({ docId, titulo, tipo, conteudo, modeloId }) => {
                    if (docId) await secDocumento(orgId, procId, 'editarMinuta', { docId, titulo, tipo, conteudo });
                    const r = docId ? { id: docId } : await secDocumento(orgId, procId, 'criarMinuta', { titulo, tipo, conteudo, ...(modeloId ? { modelo_id: modeloId } : {}) });
                    atualizar();
                    return r.id;
                }}
                onPdf={(docId) => secDocumento(orgId, procId, 'pdf', { docId })}
                onFechar={() => setEditor(null)}
            />
            <Dialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
                <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                    <DialogHeader><DialogTitle>{confirmar?.titulo}</DialogTitle><DialogDescription>{confirmar?.texto}</DialogDescription></DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setConfirmar(null)}>Cancelar</Button>
                        <Button variant="destructive" disabled={ocupado} onClick={() => { const f = confirmar.fn; setConfirmar(null); f(); }}>{confirmar?.rotulo}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <VisualizadorPdf pdf={pdf} onFechar={() => setPdf(null)} />
            <LeitorAutos documentos={autos} abertoId={leitura} onFechar={() => setLeitura(null)} titulo={`Processo ${p.numero}`} chaveLido={`autos-lidos-${procId}`}
                carregar={(d) => secDocumento(orgId, procId, 'pdf', { docId: d.id })} />
        </div>
    );
}

/** Um só ponto de partida para redigir ou enviar: modelos da fase primeiro, depois os demais. */
/** Exclusão: some das listas e do portal, com motivo nos autos; o admin do órgão restaura. */
function ExcluirProcesso({ p, admin, ocupado, onFechar, onExcluir }) {
    const [motivo, setMotivo] = useState('');
    const curto = motivo.trim().length < 5;
    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Excluir o processo {p.numero}?</DialogTitle>
                    <DialogDescription>
                        Use para processo autuado por engano ou em duplicidade. Ele sai de todas as listas, da caixa das unidades e do portal das partes; prazos e comunicações param de correr.
                        Nada é apagado: o termo de exclusão fica nos autos e {admin ? 'você (ou outro admin)' : 'o admin do órgão'} pode restaurá-lo em Processos › Excluídos.
                    </DialogDescription>
                </DialogHeader>
                <div>
                    <Label htmlFor="excl-motivo">Motivo<span className="text-red-600 dark:text-red-400" aria-hidden> *</span></Label>
                    <Textarea id="excl-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: autuado em duplicidade com o processo 000123/2026" aria-required />
                    {curto && motivo && <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">Escreva um pouco mais (ao menos 5 letras).</p>}
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onFechar}>Cancelar</Button>
                    <Button variant="destructive" disabled={ocupado || curto} onClick={() => onExcluir(motivo.trim())}>{ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Excluir processo</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function NovoDocumento({ aberto, onFechar, tipos, tipoPadrao, modelosDaFase, modelos, onModelo, onEmBranco, onArquivo, ocupado }) {
    const [tipo, setTipo] = useState('');
    const outros = modelos.filter((m) => !modelosDaFase.some((x) => x.id === m.id));
    const lista = [...new Set([...tipos, tipoPadrao].filter(Boolean))];
    return (
        <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Novo documento</DialogTitle>
                    <DialogDescription>Nasce como minuta da sua unidade. Depois você assina e junta aos autos.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    {modelosDaFase.length > 0 && (
                        <div>
                            <p className="text-sm font-medium mb-1">Indicados para esta fase</p>
                            <div className="grid gap-2">
                                {modelosDaFase.map((m) => (
                                    <button key={m.id} type="button" disabled={ocupado} onClick={() => onModelo(m)} className="text-left rounded-md border border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950 px-3 py-2 text-sm hover:border-indigo-500">
                                        <span className="font-medium">{m.nome}</span>{m.tipo_documento && <span className="text-slate-600"> · {m.tipo_documento}</span>}{m.formato === 'original' && <span className="text-xs text-slate-600"> · arquivo {m.arquivo_nome}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {outros.length > 0 && (
                        <NativeSelect id="novo-modelo" label={modelosDaFase.length ? 'Outros modelos' : 'Começar de um modelo'} value="" onChange={(id) => { const m = outros.find((x) => x.id === id); if (m) onModelo(m); }}
                            options={[['', 'Escolha…'], ...outros.map((m) => [m.id, `${m.nome}${m.tipo_documento ? ` (${m.tipo_documento})` : ''}${m.unidade_id ? '' : ' · do órgão'}`])]} />
                    )}
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[10rem]">
                            <NativeSelect id="novo-tipo" label="Em branco, do tipo" value={tipo || tipoPadrao} onChange={setTipo} options={lista.map((t) => [t, t])} />
                        </div>
                        <Button className="gap-1" disabled={ocupado} onClick={() => onEmBranco(tipo || tipoPadrao)}><FilePen className="w-4 h-4" /> Redigir</Button>
                    </div>
                    <div>
                        <Label htmlFor="novo-arquivo">Ou enviar um arquivo (PDF, Word, Excel, imagem ou texto, até {MAX_MB} MB)</Label>
                        <Input id="novo-arquivo" type="file" disabled={ocupado} accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx,.odt,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onArquivo(f); }} />
                        <Label htmlFor="novo-foto" className="mt-2 inline-flex items-center gap-1 text-sm font-normal text-indigo-700 dark:text-indigo-300 cursor-pointer sm:hidden"><Camera className="w-4 h-4" aria-hidden /> Fotografar um documento</Label>
                        <input id="novo-foto" type="file" accept="image/*" capture="environment" className="sr-only" disabled={ocupado} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; onArquivo(f); }} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/** Documento exigido pelo rito: pendente (com atalho para produzir) ou cumprido (com o nº nos autos). */
function ItemExigencia({ e, podeMexer, ocupado, modelo, onModelo, onNovo }) {
    const forma = FORMAS.find(([v]) => v === (e.forma || 'qualquer'))?.[1];
    if (e.cumprida) {
        return (
            <p className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden />
                <span><span className="line-through text-slate-600">{e.descricao}</span> <span className="text-xs text-slate-600 dark:text-slate-400">· {e.cumprida.ordem ? `cumprido com o documento nº ${e.cumprida.ordem}` : 'cumprido com documento guardado fora dos autos'}</span></span>
            </p>
        );
    }
    return (
        <div className="flex flex-wrap items-start gap-2 text-sm">
            <FilePen className="w-4 h-4 mt-0.5 text-amber-700 dark:text-amber-400 shrink-0" aria-hidden />
            <span className="flex-1 min-w-[10rem]">{e.descricao} <span className="text-xs text-slate-600 dark:text-slate-400">· exige documento ({[forma?.toLowerCase(), e.tipo].filter(Boolean).join(', ')}); {e.destino ? `cumpre-se guardando-o fora dos autos (${ROTULO_DESTINO[e.destino]})` : 'cumpre-se ao juntar'}</span></span>
            {podeMexer && e.forma !== 'juntar' && modelo && <Button size="sm" variant="outline" disabled={ocupado} onClick={() => onModelo(modelo)}>Redigir {modelo.nome}</Button>}
            {podeMexer && !(e.forma !== 'juntar' && modelo) && <Button size="sm" variant="outline" disabled={ocupado} onClick={onNovo}>Novo documento</Button>}
        </div>
    );
}

function AcaoDialog({ acao, onClose, ocupado, p, estado, membros, minutas = [], mov, doc, convidar, noGabinete, orgId, procId, onDespacho }) {
    const [valor, setValor] = useState('');
    const [visivel, setVisivel] = useState('sim');
    const [motivo, setMotivo] = useState('');
    const [dias, setDias] = useState('15');
    const [contagem, setContagem] = useState('uteis');
    const [destinatario, setDestinatario] = useState('');
    const [assinar, setAssinar] = useState(true);
    const [resolve, setResolve] = useState('');
    const [pdfPend, setPdfPend] = useState(null); // {url} do documento da pendência em apreciação
    const [atende, setAtende] = useState(null); // juntada: exigências marcadas (null = as que o sistema reconhece)
    const [levar, setLevar] = useState(null); // remessa: minutas que seguem (null = todas)
    const tipo = acao?.tipo;
    const reset = () => { setValor(''); setMotivo(''); setDestinatario(''); setVisivel('sim'); setAssinar(true); setResolve(''); setAtende(null); setLevar(null); onClose(); };
    const pendenciasAbertas = p.pendencias.filter((x) => x.status === 'aberta');
    const faseDoProc = p.fases.find((f) => f.id === p.fase_atual);
    const exigDocs = pendentesDaFase(faseDoProc, p.exigencias_cumpridas);
    // Sair da fase com exigência em aberto (documento ou ação obrigatória): o motivo vira a dispensa, registrada.
    const exigPendentes = faltaNaFase(faseDoProc, p.exigencias_cumpridas, p.acoes_feitas?.[p.fase_atual]);
    const avisoDispensa = exigPendentes.length > 0 && (
        <p className="text-sm rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-3 py-2" role="status">
            O rito exige nesta fase: <b>{exigPendentes.map((e) => e.descricao).join('; ')}</b>. Cumpra antes ou informe abaixo o motivo da dispensa, que fica registrado.
        </p>
    );

    // Apreciar: o documento que gerou a pendência (petição) aparece ao lado da decisão.
    useEffect(() => {
        const docId = tipo === 'resolver' ? acao?.pendencia?.documento_id : null;
        if (!docId) { setPdfPend(null); return undefined; }
        let url = null; let vivo = true;
        secDocumento(orgId, procId, 'pdf', { docId }).then((r) => { if (!vivo) return; url = base64ParaUrl(r.base64, 'application/pdf'); setPdfPend({ url }); }).catch(() => vivo && setPdfPend({ erro: true }));
        return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
    }, [tipo, acao?.pendencia?.documento_id, orgId, procId]);

    let titulo = '';
    let campo = null;
    let enviar = () => {};
    let rotuloTexto = 'Observação';
    let exigeTexto = false;
    let exigeValor = tipo === 'tramitar' || tipo === 'situacao';
    let largo = false;
    let rodape = null;
    if (tipo === 'pendencia') {
        titulo = 'Abrir pendência para o decisor';
        rotuloTexto = 'O que precisa ser apreciado';
        exigeTexto = true;
        campo = <NativeSelect label="Efeito na fase" value={valor} onChange={setValor} options={[['', 'Só registrar, a fase segue'], ['sim', 'Interromper a fase até a apreciação']]} />;
        enviar = () => mov('abrirPendencia', { descricao: motivo, interrompe: valor === 'sim' }, 'Pendência aberta');
    } else if (tipo === 'resolver') {
        titulo = 'Apreciar pendência';
        rotuloTexto = 'Decisão (nota curta, vira movimento)';
        exigeTexto = true;
        largo = !!acao.pendencia.documento_id;
        campo = (
            <div className="space-y-2">
                <p className="text-sm text-slate-700 dark:text-slate-300"><b>{acao.pendencia.descricao}</b> · aberta por {acao.pendencia.aberta_por} em {dataHora(acao.pendencia.aberta_em)}{acao.pendencia.interrompe ? ' · a fase está interrompida' : ''}</p>
                {acao.pendencia.documento_id && (
                    <div className="h-[50vh] rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        {pdfPend?.url ? <iframe title="Documento da pendência" src={pdfPend.url} className="w-full h-full rounded-md" />
                            : pdfPend?.erro ? <p className="text-sm text-slate-600">Não foi possível abrir o documento.</p>
                                : <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo o documento…</p>}
                    </div>
                )}
            </div>
        );
        enviar = () => mov('resolverPendencia', { pendencia_id: acao.pendencia.id, resolucao: motivo }, 'Pendência apreciada');
        rodape = <Button variant="outline" className="gap-1 mr-auto" disabled={ocupado} onClick={() => onDespacho(acao.pendencia)}><FilePen className="w-4 h-4" /> Decidir por despacho</Button>;
    } else if (tipo === 'semEfeito') {
        titulo = `Tornar sem efeito: ${nomeEspecie(acao.comunicacao.especie).toLowerCase()} a ${acao.comunicacao.parte_nome}`;
        rotuloTexto = 'Motivo (fica certificado nos autos)';
        exigeTexto = true;
        campo = <p className="text-sm text-slate-700 dark:text-slate-300">A parte deixa de ver o aviso e nenhum prazo é aberto. Só é possível enquanto ela não deu ciência.</p>;
        enviar = () => mov('tornarSemEfeito', { comunicacao_id: acao.comunicacao.id, motivo }, 'Comunicação tornada sem efeito');
    } else if (tipo === 'prazo') {
        titulo = 'Abrir prazo';
        rotuloTexto = 'Para quê (ex.: manifestação sobre o laudo)';
        exigeTexto = true;
        campo = (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><Label htmlFor="prazo-dias">Dias</Label><Input id="prazo-dias" type="number" inputMode="numeric" min={1} max={3650} value={dias} onChange={(e) => setDias(e.target.value)} /></div>
                <NativeSelect label="Contagem" value={contagem} onChange={setContagem} options={[['uteis', 'Dias úteis'], ['corridos', 'Dias corridos']]} />
                <div className="col-span-2 sm:col-span-1">
                    <Label htmlFor="prazo-dest">Destinatário</Label>
                    <Input id="prazo-dest" list="prazo-partes" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder="Opcional" />
                    <datalist id="prazo-partes">{(p.partes || []).map((x, i) => <option key={i} value={x.nome} />)}</datalist>
                </div>
            </div>
        );
        enviar = () => mov('abrirPrazo', { descricao: motivo, dias: Number(dias), contagem, destinatario }, 'Prazo aberto');
    } else if (tipo === 'encerrarPrazo') {
        titulo = 'Encerrar prazo';
        exigeValor = true;
        campo = (
            <>
                <p className="text-sm text-slate-700 dark:text-slate-300">{acao.prazo.descricao} · vence {acao.prazo.vence_em.split('-').reverse().join('/')}</p>
                <NativeSelect label="Resultado" value={valor} onChange={setValor} options={[['', 'Escolha…'], ['cumprido', 'Cumprido'], ['cancelado', 'Cancelado']]} />
            </>
        );
        enviar = () => mov('encerrarPrazo', { prazo_id: acao.prazo.id, resultado: valor, motivo }, 'Prazo encerrado');
    } else if (tipo === 'juntar') {
        titulo = `Juntar aos autos: ${acao.documento.titulo}`;
        const decideAlguma = noGabinete && pendenciasAbertas.length > 0;
        const exigAutos = exigDocs.filter((e) => !e.destino);
        const marcadas = atende ?? sugeridas(exigAutos, acao.documento);
        campo = (
            <>
                {exigAutos.length > 0 && (
                    <fieldset>
                        <legend className="text-sm font-medium mb-1">Este documento cumpre o que o rito exige?</legend>
                        {exigAutos.map((e) => (
                            <label key={e.chave} className="flex items-start gap-2 text-sm">
                                <input type="checkbox" className="mt-1" checked={marcadas.includes(e.chave)}
                                    onChange={(ev) => setAtende(ev.target.checked ? [...marcadas, e.chave] : marcadas.filter((k) => k !== e.chave))} />
                                <span>{e.descricao}{e.tipo ? ` (${e.tipo})` : ''}</span>
                            </label>
                        ))}
                    </fieldset>
                )}
                {!acao.assinei && (
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={assinar} onChange={(e) => setAssinar(e.target.checked)} /> Assinar antes de juntar (assinatura eletrônica simples, com seu nome)</label>
                )}
                {decideAlguma && (
                    <NativeSelect label="Este documento decide uma pendência?" value={resolve} onChange={setResolve}
                        options={[['', 'Não'], ...pendenciasAbertas.map((x) => [x.id, x.descricao.slice(0, 80)])]} />
                )}
                {!resolve && <NativeSelect label="Pendência para o decisor" value={valor} onChange={setValor} options={[['', 'Não abrir'], ['sim', 'Abrir pendência, a fase segue'], ['interrompe', 'Abrir pendência e interromper a fase']]} />}
                <NativeSelect label="Portal das partes" value={visivel} onChange={setVisivel} options={[['sim', 'Visível às partes'], ['nao', 'Só para a equipe']]} />
            </>
        );
        enviar = () => doc('juntar', {
            docId: acao.documento.id, version: p.version, pendencia: resolve ? 'nao' : (valor || 'nao'), visivel_partes: visivel === 'sim',
            assinar: !acao.assinei && assinar, ...(resolve ? { resolve_pendencia_id: resolve } : {}),
            ...(exigAutos.length ? { atende: marcadas } : {}),
        },resolve ? 'Documento juntado e pendência decidida' : 'Documento juntado aos autos');
    } else if (tipo === 'guardar') {
        titulo = `Guardar fora dos autos: ${acao.documento.titulo}`;
        const exigControle = exigDocs.filter((e) => e.destino);
        const marcadas = atende ?? sugeridas(exigControle, { ...acao.documento, controle: true });
        campo = (
            <>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                    O documento fica guardado no processo como documento de controle: a equipe vê, as partes não, e ele não ganha folha nem sai no PDF dos autos.
                    Depois de guardado, não se edita nem se apaga.
                </p>
                {exigControle.length > 0 && (
                    <fieldset>
                        <legend className="text-sm font-medium mb-1">Este documento cumpre o que o rito pede?</legend>
                        {exigControle.map((e) => (
                            <label key={e.chave} className="flex items-start gap-2 text-sm">
                                <input type="checkbox" className="mt-1" checked={marcadas.includes(e.chave)}
                                    onChange={(ev) => setAtende(ev.target.checked ? [...marcadas, e.chave] : marcadas.filter((k) => k !== e.chave))} />
                                <span>{e.descricao}{e.tipo ? ` (${e.tipo})` : ''}</span>
                            </label>
                        ))}
                    </fieldset>
                )}
            </>
        );
        enviar = () => doc('guardar', { docId: acao.documento.id, version: p.version, ...(exigControle.length ? { atende: marcadas } : {}) }, 'Documento guardado fora dos autos');
    } else if (tipo === 'pedirAssinatura') {
        titulo = `Pedir assinatura: ${acao.documento.titulo}`;
        exigeValor = true;
        const jaAssinaram = acao.documento.assinaturas.map((a) => a.uid);
        campo = <NativeSelect label="Quem assina" value={valor} onChange={setValor} options={[['', 'Escolha…'], ...membros.filter((m) => m.uid !== estado.uid && !jaAssinaram.includes(m.uid)).map((m) => [m.uid, m.nome])]} />;
        enviar = () => doc('pedirAssinatura', { docId: acao.documento.id, uid: valor }, 'Pedido de assinatura enviado');
    } else if (tipo === 'convidar') {
        // Alvo: a parte, um representante já listado ou um representante novo (nome obrigatório).
        const alvo = acao.representante || (acao.novoRep ? null : acao.parte);
        titulo = acao.novoRep ? `Convidar um representante de ${acao.parte.nome}` : `Convidar ${alvo.nome} para o portal das partes`;
        exigeValor = !!acao.novoRep;
        campo = (
            <div className="space-y-3">
                {acao.novoRep && (
                    <div>
                        <Label htmlFor="conv-nome">Nome do representante</Label>
                        <Input id="conv-nome" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Advogado, procurador, preposto…" autoFocus />
                    </div>
                )}
                {(acao.novoRep || acao.representante) && <p className="text-xs text-slate-600 dark:text-slate-400">O representante tem a própria conta e vê o processo como {acao.parte.nome}; o que ele protocolar sai em nome da parte, assinado por ele.</p>}
                <div>
                    <Label htmlFor="conv-email">E-mail para envio do convite</Label>
                    <Input id="conv-email" type="email" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} placeholder={alvo?.email || 'Opcional: sem e-mail, você copia o link'} />
                </div>
            </div>
        );
        enviar = () => convidar(acao.idx, destinatario.trim() || alvo?.email || '',
            acao.novoRep ? { representante: { nome: valor.trim(), email: destinatario.trim() } } : acao.representante ? { representante_idx: acao.representante_idx } : {});
    }
    if (tipo === 'tramitar' || tipo === 'devolver') {
        const devolver = tipo === 'devolver';
        titulo = devolver ? 'Devolver à secretaria com orientação' : acao.fase_id ? 'Concluir a fase e enviar para outra unidade' : 'Enviar para outra unidade';
        const opcoes = estado.unidades.filter((u) => u.ativa && u.id !== p.unidade_atual);
        const passou = p.unidades_historico || [];
        // Devolver: a unidade que remeteu ao gabinete, ou a primeira secretaria.
        const origem = devolver ? ([...passou].reverse().find((id) => id !== p.unidade_atual && estado.unidades.find((u) => u.id === id)?.tipo !== 'gabinete') || opcoes.find((u) => u.tipo === 'secretaria')?.id || '') : '';
        const destino = valor || acao.destino || origem || '';
        const uDest = estado.unidades.find((u) => u.id === destino);
        const recebem = uDest ? estado.membros.filter((m) => uDest.membros_uids.includes(m.uid)) : [];
        const faseNova = acao.fase_id ? p.fases.find((f) => f.id === acao.fase_id) : null;
        // Minutas com a unidade que remete; por padrão, todas seguem (ex.: a da assessoria para o gabinete).
        const minutasDaUnidade = minutas.filter((d) => d.unidade_origem === p.unidade_atual || (d.unidades_acesso || []).includes(p.unidade_atual));
        const levarIds = levar ?? minutasDaUnidade.map((d) => d.id);
        const orgaoAtual = estado.unidades.find((u) => u.id === p.unidade_atual)?.orgao_id || null;
        const outroOrgao = !!uDest && (uDest.orgao_id || null) !== orgaoAtual && (estado.orgaos || []).length > 0;
        const rot = (u) => `${nomeOrgao(estado, u.orgao_id) ? `${nomeOrgao(estado, u.orgao_id)} › ` : ''}${u.nome} (${rotuloUnidade(u.tipo).toLowerCase()})${u.id === acao.destino ? ' · indicada pelo rito' : passou.includes(u.id) ? ' · já passou por aqui' : ''}`;
        campo = (
            <div className="space-y-2">
                {faseNova && <p className="text-sm text-slate-700 dark:text-slate-300">A fase passa de <b>{p.fase_nome}</b> para <b>{faseNova.nome}</b> no mesmo ato.</p>}
                {faseNova && avisoDispensa}
                {!devolver && minutasDaUnidade.length > 0 && (
                    <fieldset>
                        <legend className="text-sm font-medium mb-1">Minutas que seguem com o processo</legend>
                        {minutasDaUnidade.map((d) => (
                            <label key={d.id} className="flex items-start gap-2 text-sm">
                                <input type="checkbox" className="mt-1" checked={levarIds.includes(d.id)}
                                    onChange={(ev) => setLevar(ev.target.checked ? [...levarIds, d.id] : levarIds.filter((x) => x !== d.id))} />
                                <span>{d.titulo} <span className="text-xs text-slate-600 dark:text-slate-400">({d.tipo})</span></span>
                            </label>
                        ))}
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">A unidade de destino poderá ler, revisar, assinar e juntar. Sua unidade continua vendo a minuta.</p>
                    </fieldset>
                )}
                <NativeSelect label="Destino" value={destino} onChange={setValor} options={[['', 'Escolha…'], ...opcoes.map((u) => [u.id, rot(u)])]} />
                {outroOrgao && <p className="text-sm text-indigo-800 dark:text-indigo-200">Remessa para outro órgão: de <b>{nomeOrgao(estado, orgaoAtual) || estado.orgao || 'entidade'}</b> para <b>{nomeOrgao(estado, uDest.orgao_id) || estado.orgao || 'entidade'}</b>. O termo de remessa registra os dois órgãos.</p>}
                {uDest && (
                    <p className="text-xs text-slate-600">
                        {recebem.length ? `Quem recebe: ${recebem.map((m) => m.nome).join(', ')}. Serão avisados por e-mail.` : 'Atenção: ninguém está lotado nessa unidade.'}
                    </p>
                )}
            </div>
        );
        exigeValor = !destino;
        if (devolver) { exigeTexto = true; rotuloTexto = 'Orientação para a secretaria (fica em destaque no processo até ser concluída)'; }
        else if (faseNova && exigPendentes.length) { exigeTexto = true; rotuloTexto = 'Motivo da dispensa do que o rito exige'; }
        enviar = () => mov('tramitar', { unidade_destino: destino, ...(devolver ? { orientacao: motivo } : { motivo }), ...(acao.fase_id ? { fase_id: acao.fase_id } : {}),
            ...(!devolver && levarIds.length ? { minutas: levarIds } : {}) }, devolver ? 'Processo devolvido com orientação' : 'Processo remetido');
    } else if (tipo === 'fase') {
        titulo = 'Mudar a fase';
        const noFluxo = seguintes(p.fases, p.fases.findIndex((f) => f.id === p.fase_atual));
        const escolhida = valor || acao.fase_id || noFluxo[0] || '';
        const fora = !!escolhida && !noFluxo.includes(escolhida);
        const nomeFase = (id) => p.fases.find((f) => f.id === id)?.nome;
        const condicoes = p.fases.find((f) => f.id === p.fase_atual)?.condicoes || {};
        campo = (
            <div className="space-y-3">
                {noFluxo.length > 0 ? (
                    <fieldset>
                        <legend className="text-sm font-medium mb-2">Seguir o fluxo do rito</legend>
                        <div className="grid gap-2">
                            {noFluxo.map((id) => (
                                <button key={id} type="button" onClick={() => setValor(id)} aria-pressed={escolhida === id}
                                    className={`text-left rounded-md border px-3 py-2 text-sm ${escolhida === id ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 dark:border-indigo-400' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>
                                    <span className="font-medium">{nomeFase(id)}</span>
                                    {condicoes[id] && <span className="block text-xs text-indigo-700 dark:text-indigo-300">Se {condicoes[id]}</span>}
                                    {p.fases.find((f) => f.id === id)?.orientacao && <span className="block text-xs text-slate-600">{p.fases.find((f) => f.id === id).orientacao}</span>}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                ) : <p className="text-sm text-slate-600 dark:text-slate-300">Esta é a fase final do rito.</p>}
                {avisoDispensa}
                <NativeSelect id="fase-fora" label="Ou ir para outra fase (fora do caminho previsto no rito, exige motivo)" value={fora ? escolhida : ''} onChange={(v) => setValor(v || '')}
                    options={[['', '—'], ...p.fases.filter((f) => f.id !== p.fase_atual && !noFluxo.includes(f.id)).map((f) => [f.id, f.nome])]} />
            </div>
        );
        if (fora) { exigeTexto = true; rotuloTexto = 'Motivo para sair do caminho previsto'; }
        if (exigPendentes.length) { exigeTexto = true; rotuloTexto = fora ? 'Motivo para sair do caminho previsto e dispensar o que o rito exige' : 'Motivo da dispensa do que o rito exige'; }
        exigeValor = !escolhida;
        enviar = () => mov('avancarFase', { fase_id: escolhida, motivo }, 'Fase alterada');
    } else if (tipo === 'atribuir') {
        titulo = 'Atribuir a uma pessoa da unidade';
        campo = <NativeSelect label="Responsável" value={valor} onChange={setValor} options={[['', 'Ninguém'], ...membros.map((m) => [m.uid, m.nome])]} />;
        enviar = () => mov('atribuir', { responsavel_uid: valor || null }, 'Atribuição registrada');
    } else if (tipo === 'situacao') {
        titulo = 'Alterar a situação';
        const status = valor || acao.status || '';
        campo = (
            <>
                <NativeSelect label="Situação" value={status} onChange={setValor} options={[['', 'Escolha…'], ...Object.entries(STATUS_ROTULO).filter(([k]) => k !== p.status && k !== 'excluido')]} />
                {status === 'arquivado' && avisoDispensa}
            </>
        );
        exigeValor = !status;
        enviar = () => mov('alterarStatus', { status, motivo }, 'Situação alterada');
    }
    else if (tipo === 'urgencia') {
        titulo = p.urgente ? 'Retirar a urgência' : 'Marcar como urgente';
        campo = <p className="text-sm text-slate-600 dark:text-slate-300">{p.urgente
            ? `Urgente desde ${dataHora(p.urgencia?.em)}, por ${p.urgencia?.por || 'alguém da equipe'}: ${p.urgencia?.motivo || ''}`
            : 'O processo passa a aparecer primeiro nas listas, com selo vermelho, e os avisos saem marcados como urgentes.'}</p>;
        exigeValor = false;
        enviar = () => mov('urgencia', { urgente: !p.urgente, motivo }, p.urgente ? 'Urgência retirada' : 'Processo marcado como urgente');
    }
    if (tipo === 'situacao' || tipo === 'urgencia') { exigeTexto = true; rotuloTexto = 'Motivo'; }
    const diasInvalidos = tipo === 'prazo' && !(Number(dias) >= 1);
    const semTexto = tipo === 'atribuir' || tipo === 'juntar' || tipo === 'guardar' || tipo === 'convidar' || tipo === 'pedirAssinatura';

    return (
        <Dialog open={!!acao} onOpenChange={(o) => !o && reset()}>
            <DialogContent className={`max-h-[92vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full ${largo ? 'max-w-4xl' : ''}`}>
                <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                    {campo}
                    {!semTexto && (
                        <div><Label htmlFor="acao-motivo">{rotuloTexto}{exigeTexto ? ' (obrigatório)' : ''}</Label><Textarea id="acao-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
                    )}
                    <p className="text-xs text-slate-600">Fica registrado na linha do tempo com seu nome, data e hora.</p>
                </div>
                <DialogFooter className="flex-row flex-wrap gap-2">
                    {rodape}
                    <Button variant="outline" onClick={reset}>Cancelar</Button>
                    <Button disabled={ocupado || diasInvalidos || (exigeValor && !valor && !acao?.destino && !acao?.fase_id && !acao?.status && tipo !== 'devolver') || (exigeTexto && !motivo.trim())} onClick={async () => { if (await enviar() === false) return; setValor(''); setMotivo(''); setDestinatario(''); setVisivel('sim'); setResolve(''); setAtende(null); setLevar(null); }}>
                        {ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} {tipo === 'resolver' ? 'Registrar a decisão' : 'Confirmar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Corrige a descrição e os campos próprios do tipo; o que mudou vai para o histórico. */
function EditarDados({ p, tipo, ocupado, onFechar, onSalvar }) {
    const form = formularioDe(tipo);
    const [descricao, setDescricao] = useState(p.descricao || '');
    const [campos, setCampos] = useState(() => valoresDe(p.campos));
    const [motivo, setMotivo] = useState('');
    const falta = faltando({ ...form, partes: 'opcional' }, { descricao, campos });
    // Campos que o tipo deixou de ter continuam gravados, só para leitura.
    const antigos = (p.campos || []).filter((c) => !form.campos.some((d) => d.id === c.id));
    return (
        <Dialog open onOpenChange={(o) => !o && onFechar()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-1rem)] sm:w-full">
                <DialogHeader>
                    <DialogTitle>Editar dados do processo</DialogTitle>
                    <DialogDescription>A alteração fica registrada no histórico do processo, com o que mudou.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    {form.descricao !== 'oculto' && (
                        <div>
                            <Label htmlFor="ed-desc">Descrição{form.descricao === 'obrigatorio' && <span className="text-red-600 dark:text-red-400" aria-hidden> *</span>}</Label>
                            <Textarea id="ed-desc" className="mt-1" rows={3} maxLength={4000} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                        </div>
                    )}
                    <CamposProcesso prefixo="ed" campos={form.campos} valores={campos} onChange={(id, v) => setCampos((x) => ({ ...x, [id]: v }))} />
                    {antigos.length > 0 && (
                        <div className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-3">
                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Campos que este tipo de processo não usa mais (mantidos como foram gravados)</p>
                            <DadosCampos campos={antigos} />
                        </div>
                    )}
                    <div><Label htmlFor="ed-motivo">Motivo da alteração</Label><Input id="ed-motivo" className="mt-1" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Opcional" /></div>
                    {falta.length > 0 && <p className="text-sm text-amber-800 dark:text-amber-300" role="status">Para salvar: {falta.join('; ')}.</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onFechar}>Cancelar</Button>
                    <Button disabled={ocupado || falta.length > 0} onClick={() => onSalvar({ descricao, campos, motivo })}>
                        {ocupado && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
