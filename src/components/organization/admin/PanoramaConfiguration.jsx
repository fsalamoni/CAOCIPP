import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Save, Loader2, Trash2, RotateCcw, Info, AlertTriangle, Palette, MapPin,
    AlarmClock, Columns3, Upload, Database, Plus, Telescope,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { usePanoramaBases, usePanoramaRegistros } from '@/hooks/usePanorama';
import { updatePanoramaBase, deletePanoramaBase } from '@/services/panoramaService';
import {
    resolveBase, columnForRole, sugerirCoresDesfecho,
    normalizeHexColor, corDoDesfecho, rolesPreenchidos,
    PANORAMA_ROLES, PANORAMA_IMPORT_POLICIES, PANORAMA_PRESCRICAO_MODOS,
    PANORAMA_PRESCRICAO_PADRAO,
} from '@/constants/panorama';
import { formatNumber, valorDe } from '@/lib/panoramaEngine';
import PanoramaMapeamento from '../panorama/PanoramaMapeamento';
import PanoramaBadge from '../panorama/PanoramaBadge';

/**
 * Configuração das bases do Panorama, no Painel Administrativo do órgão.
 *
 * É aqui que o módulo deixa de ser genérico e passa a ser o do órgão: quais
 * colunas existem, o que cada uma significa, quanto vale cada desfecho, como
 * as unidades se agrupam em regiões e como a prescrição é contada.
 *
 * Nada disso toca os dados gravados — a definição da base é uma lente sobre
 * eles. Trocar um peso recalcula todos os relatórios na hora, sem alterar um
 * único registro.
 */
export default function PanoramaConfiguration({ organization }) {
    const { bases, isLoading } = usePanoramaBases(organization?.id);
    const [baseId, setBaseId] = useState('');
    const [saving, setSaving] = useState(false);
    const [excluindo, setExcluindo] = useState(false);
    const [confirmName, setConfirmName] = useState('');
    const savingRef = useRef(false);

    const baseAtual = useMemo(
        () => bases.find((b) => b.id === baseId) || bases[0] || null,
        [bases, baseId]
    );
    const remote = useMemo(() => (baseAtual ? resolveBase(baseAtual) : null), [baseAtual]);

    // Nasce já com a base carregada, quando ela está disponível: começar em
    // `null` e preencher num efeito deixava a tela em branco no primeiro quadro.
    // O efeito abaixo continua sincronizando nas trocas de base.
    const [draft, setDraft] = useState(() => (remote ? { ...remote } : null));

    // Registros da base: é deles que saem os valores reais de cada coluna, que
    // é o que o admin precisa ver para dar peso e cor a cada desfecho.
    const { registros } = usePanoramaRegistros(organization?.id, baseAtual?.id);

    useEffect(() => {
        if (savingRef.current) return;
        setDraft(remote ? { ...remote } : null);
        setConfirmName('');
    }, [remote]);

    const set = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

    const dirty = useMemo(
        () => Boolean(draft && remote) && JSON.stringify(draft) !== JSON.stringify(remote),
        [draft, remote]
    );

    /** Valores que de fato aparecem na coluna de desfecho dos registros. */
    const valoresDesfecho = useMemo(() => {
        const col = columnForRole(draft, 'desfecho');
        if (!col) return [];
        const vistos = new Map();
        for (const r of registros) {
            const v = valorDe(r, col.key);
            if (v === null || v === undefined || v === '') continue;
            const s = String(v);
            vistos.set(s, (vistos.get(s) || 0) + 1);
        }
        return [...vistos.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([valor, quantidade]) => ({ valor, quantidade }));
    }, [draft, registros]);

    /** Unidades que aparecem nos registros, para montar as regiões. */
    const unidades = useMemo(() => {
        const col = columnForRole(draft, 'unidade');
        if (!col) return [];
        const vistos = new Set();
        for (const r of registros) {
            const v = valorDe(r, col.key);
            if (v === null || v === undefined || v === '') continue;
            vistos.add(String(v));
        }
        return [...vistos].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [draft, registros]);

    /** Assuntos que aparecem, para os prazos de prescrição por assunto. */
    const assuntos = useMemo(() => {
        const col = columnForRole(draft, 'assunto');
        if (!col) return [];
        const vistos = new Set();
        for (const r of registros) {
            const v = valorDe(r, col.key);
            if (v === null || v === undefined || v === '') continue;
            vistos.add(String(v));
        }
        return [...vistos].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [draft, registros]);

    const handleSave = async () => {
        if (!draft || !baseAtual) return;
        savingRef.current = true;
        setSaving(true);
        try {
            await updatePanoramaBase({
                organizationId: organization.id, id: baseAtual.id, def: draft,
            });
            toast.success('Configuração da base salva.');
        } catch (error) {
            logger.error('[panorama] erro ao salvar configuração:', error);
            toast.error(error?.message || 'Não foi possível salvar.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setSaving(true);
        try {
            const resposta = await deletePanoramaBase({
                organizationId: organization.id, id: baseAtual.id, confirmName,
            });
            toast.success(
                `Base excluída, junto com ${formatNumber(resposta.registrosExcluidos || 0)} registro(s).`
            );
            setBaseId('');
            setExcluindo(false);
        } catch (error) {
            logger.error('[panorama] erro ao excluir base:', error);
            toast.error(error?.message || 'Não foi possível excluir a base.');
        } finally {
            setSaving(false);
        }
    };

    // ---- Desfechos ---------------------------------------------------------
    const setPeso = (valor, peso) => {
        const n = Number(peso);
        setDraft((prev) => ({
            ...prev,
            desfechos: {
                ...prev.desfechos,
                pesos: {
                    ...prev.desfechos.pesos,
                    [valor]: Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0,
                },
            },
        }));
    };

    const setCor = (valor, cor) => {
        const hex = normalizeHexColor(cor);
        if (!hex) return;
        setDraft((prev) => ({
            ...prev,
            desfechos: { ...prev.desfechos, cores: { ...prev.desfechos.cores, [valor]: hex } },
        }));
    };

    /**
     * Marca (ou desmarca) um desfecho como "sem mérito".
     *
     * Marcar zera o peso junto, e as duas mudanças vão na MESMA atualização:
     * aplicá-las em duas chamadas faria a segunda partir do mesmo `draft` e
     * descartar a primeira — o desfecho nunca chegaria a ficar neutro.
     */
    const toggleNeutro = (valor, marcado) => {
        setDraft((prev) => {
            const atual = new Set(prev.desfechos.neutros || []);
            if (marcado) atual.add(valor); else atual.delete(valor);
            return {
                ...prev,
                desfechos: {
                    ...prev.desfechos,
                    neutros: [...atual],
                    pesos: marcado
                        ? { ...prev.desfechos.pesos, [valor]: 0 }
                        : prev.desfechos.pesos,
                },
            };
        });
    };

    // ---- Regiões -----------------------------------------------------------
    const [novaRegiao, setNovaRegiao] = useState('');
    const [regiaoAberta, setRegiaoAberta] = useState('');

    const addRegiao = () => {
        const nome = novaRegiao.trim();
        if (!nome) return;
        if (draft.regioes[nome]) { toast.error('Já existe uma região com esse nome.'); return; }
        set({ regioes: { ...draft.regioes, [nome]: [] } });
        setNovaRegiao('');
        setRegiaoAberta(nome);
    };

    const removeRegiao = (nome) => {
        const next = { ...draft.regioes };
        delete next[nome];
        set({ regioes: next });
        if (regiaoAberta === nome) setRegiaoAberta('');
    };

    const toggleUnidadeNaRegiao = (regiao, unidade) => {
        const atual = new Set(draft.regioes[regiao] || []);
        if (atual.has(unidade)) atual.delete(unidade); else atual.add(unidade);
        set({ regioes: { ...draft.regioes, [regiao]: [...atual] } });
    };

    /** Unidade já alocada em OUTRA região — uma unidade pertence a uma só. */
    const regiaoDe = (unidade) => {
        for (const [nome, membros] of Object.entries(draft?.regioes || {})) {
            if (membros.includes(unidade)) return nome;
        }
        return null;
    };

    // ---- Prescrição ---------------------------------------------------------
    const setPrescricao = (patch) => set({ prescricao: { ...draft.prescricao, ...patch } });

    const setPrazoAssunto = (assunto, anos) => {
        const n = Number(anos);
        const next = { ...draft.prescricao.anosPorAssunto };
        if (!Number.isFinite(n) || n <= 0) delete next[assunto];
        else next[assunto] = n;
        setPrescricao({ anosPorAssunto: next });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Carregando as bases...
            </div>
        );
    }

    if (bases.length === 0) {
        return (
            <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Telescope className="w-5 h-5 text-indigo-500" />
                        Panorama — nenhuma base ainda
                    </CardTitle>
                    <CardDescription>
                        As bases nascem da importação: vá à página Panorama do órgão, aba Importação, e
                        envie uma planilha. As colunas dela viram a estrutura da base, e é aqui que você
                        depois ajusta o que cada uma significa.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (!draft) return null;

    const papeis = rolesPreenchidos(draft);
    const semCores = valoresDesfecho.filter((v) => !draft.desfechos.cores[v.valor]).length;

    return (
        <div className="space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                    <Label className="text-xs text-slate-500">Base</Label>
                    <Select value={baseAtual?.id || ''} onValueChange={setBaseId}>
                        <SelectTrigger className="max-w-md"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {bases.map((b) => (
                                <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatNumber(registros.length)} registro(s) · {formatNumber(draft.columns.length)}{' '}
                        coluna(s) · {papeis.length} de {PANORAMA_ROLES.length} papéis mapeados
                    </p>
                </div>
                <Button onClick={handleSave} disabled={!dirty || saving} className="gap-2 shrink-0">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar configuração
                </Button>
            </div>

            {dirty && (
                <Alert>
                    <Info className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                        Há alterações não salvas. Elas só passam a valer depois de clicar em
                        <strong> Salvar configuração</strong>. Nada aqui altera os dados gravados —
                        a configuração é uma lente sobre eles.
                    </AlertDescription>
                </Alert>
            )}

            <Tabs defaultValue="identificacao" className="space-y-4">
                <TabsList className="flex-wrap h-auto">
                    <TabsTrigger value="identificacao" className="gap-2">
                        <Database className="w-4 h-4" />
                        Identificação
                    </TabsTrigger>
                    <TabsTrigger value="colunas" className="gap-2">
                        <Columns3 className="w-4 h-4" />
                        Colunas e papéis
                    </TabsTrigger>
                    <TabsTrigger value="desfechos" className="gap-2">
                        <Palette className="w-4 h-4" />
                        Desfechos
                    </TabsTrigger>
                    <TabsTrigger value="regioes" className="gap-2">
                        <MapPin className="w-4 h-4" />
                        Regiões
                    </TabsTrigger>
                    <TabsTrigger value="prescricao" className="gap-2">
                        <AlarmClock className="w-4 h-4" />
                        Prescrição
                    </TabsTrigger>
                    <TabsTrigger value="importacao" className="gap-2">
                        <Upload className="w-4 h-4" />
                        Importação
                    </TabsTrigger>
                </TabsList>

                {/* ---- Identificação ---- */}
                <TabsContent value="identificacao" className="space-y-4 mt-0">
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Nome e descrição</CardTitle>
                            <CardDescription>
                                Como esta base aparece para quem usa o módulo.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5 max-w-lg">
                                <Label htmlFor="pan-nome">Nome da base</Label>
                                <Input
                                    id="pan-nome"
                                    value={draft.nome}
                                    onChange={(e) => set({ nome: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5 max-w-2xl">
                                <Label htmlFor="pan-desc">Descrição</Label>
                                <Textarea
                                    id="pan-desc"
                                    value={draft.descricao}
                                    onChange={(e) => set({ descricao: e.target.value })}
                                    rows={3}
                                    placeholder="Ex.: Procedimentos de improbidade administrativa instaurados no estado a partir de 2023."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-rose-200 dark:border-rose-900">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base text-rose-700 dark:text-rose-300">
                                Excluir esta base
                            </CardTitle>
                            <CardDescription>
                                Apaga a base <strong>e todos os seus registros</strong>. Não há como
                                desfazer. Os dados precisariam ser importados de novo.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="outline"
                                onClick={() => setExcluindo(true)}
                                className="gap-2 text-rose-600 hover:text-rose-700 border-rose-200"
                            >
                                <Trash2 className="w-4 h-4" />
                                Excluir base e {formatNumber(registros.length)} registro(s)
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---- Colunas e papéis ---- */}
                <TabsContent value="colunas" className="space-y-4 mt-0">
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Colunas e o que cada uma significa</CardTitle>
                            <CardDescription>
                                O <strong>papel</strong> é o que faz o painel e os relatórios saberem o que
                                calcular. Renomear uma coluna é livre — a ligação com os dados é pela chave
                                interna, não pelo rótulo.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <PanoramaMapeamento
                                columns={draft.columns}
                                onChange={(columns) => set({ columns })}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---- Desfechos ---- */}
                <TabsContent value="desfechos" className="space-y-4 mt-0">
                    {!columnForRole(draft, 'desfecho') ? (
                        <Alert>
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription className="text-sm">
                                Nenhuma coluna está no papel de <strong>desfecho</strong>. Vá à aba
                                “Colunas e papéis” e marque a coluna que registra o resultado do caso —
                                é ela que destrava o aproveitamento e as cores.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Card className="border-slate-200 dark:border-slate-700">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">
                                    Peso e cor de cada {columnForRole(draft, 'desfecho').label.toLowerCase()}
                                </CardTitle>
                                <CardDescription>
                                    A plataforma consegue ver <em>quais</em> desfechos existem, mas não tem
                                    como saber o que significam para este órgão. Só você pode dizer se um
                                    acordo é sucesso ou frustração. O <strong>peso</strong> (0 a 1) define
                                    o aproveitamento; <strong>sem mérito</strong> marca o que não é solução
                                    de mérito — conta no total, fica fora do cálculo de efetividade.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {valoresDesfecho.length === 0 ? (
                                    <p className="text-sm text-slate-400 py-6 text-center">
                                        Ainda não há registros com desfecho preenchido nesta base.
                                    </p>
                                ) : (
                                    <>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Desfecho</TableHead>
                                                    <TableHead className="w-24 text-right">Registros</TableHead>
                                                    <TableHead className="w-56">Peso</TableHead>
                                                    <TableHead className="w-44">Cor</TableHead>
                                                    <TableHead className="w-28 text-center">Sem mérito</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {valoresDesfecho.map(({ valor, quantidade }) => {
                                                    const neutro = (draft.desfechos.neutros || []).includes(valor);
                                                    const peso = draft.desfechos.pesos[valor] ?? 0;
                                                    const cor = corDoDesfecho(valor, draft);
                                                    return (
                                                        <TableRow key={valor}>
                                                            <TableCell>
                                                                <PanoramaBadge valor={valor} base={draft} />
                                                            </TableCell>
                                                            <TableCell className="text-right tabular-nums text-slate-500 text-sm">
                                                                {formatNumber(quantidade)}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <Slider
                                                                        value={[Math.round(peso * 100)]}
                                                                        onValueChange={([v]) => setPeso(valor, v / 100)}
                                                                        max={100}
                                                                        step={5}
                                                                        disabled={neutro}
                                                                        className="flex-1"
                                                                    />
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        max={1}
                                                                        step={0.05}
                                                                        value={peso}
                                                                        onChange={(e) => setPeso(valor, e.target.value)}
                                                                        disabled={neutro}
                                                                        className="w-20 h-8 text-sm tabular-nums"
                                                                    />
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="color"
                                                                        value={cor}
                                                                        onChange={(e) => setCor(valor, e.target.value)}
                                                                        className="w-10 h-8 rounded border border-slate-200 dark:border-slate-700 bg-transparent cursor-pointer p-0.5"
                                                                        aria-label={`Cor de ${valor}`}
                                                                    />
                                                                    <Input
                                                                        value={cor}
                                                                        onChange={(e) => setCor(valor, e.target.value)}
                                                                        className="w-24 h-8 text-xs font-mono uppercase"
                                                                        maxLength={7}
                                                                    />
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-center">
                                                                <Switch
                                                                    checked={neutro}
                                                                    onCheckedChange={(v) => toggleNeutro(valor, v)}
                                                                />
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>

                                        {semCores > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2"
                                                onClick={() => set({
                                                    desfechos: {
                                                        ...draft.desfechos,
                                                        cores: {
                                                            ...sugerirCoresDesfecho(valoresDesfecho.map((v) => v.valor)),
                                                            ...draft.desfechos.cores,
                                                        },
                                                    },
                                                })}
                                            >
                                                <Palette className="w-4 h-4" />
                                                Sugerir cores para os {semCores} sem cor
                                            </Button>
                                        )}

                                        <Alert>
                                            <Info className="w-4 h-4" />
                                            <AlertDescription className="text-xs">
                                                Alterar um peso recalcula todos os relatórios na hora, sem
                                                tocar em nenhum registro gravado. Um desfecho marcado como
                                                <strong> sem mérito</strong> tem peso fixo em zero.
                                            </AlertDescription>
                                        </Alert>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ---- Regiões ---- */}
                <TabsContent value="regioes" className="space-y-4 mt-0">
                    {!columnForRole(draft, 'unidade') ? (
                        <Alert>
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription className="text-sm">
                                Nenhuma coluna está no papel de <strong>unidade territorial</strong>. Marque
                                a coluna da comarca ou do município na aba “Colunas e papéis” para poder
                                agrupá-las em regiões.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Card className="border-slate-200 dark:border-slate-700">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Agrupar unidades em regiões</CardTitle>
                                <CardDescription>
                                    Qual comarca pertence a qual região é decisão do órgão — a plataforma não
                                    tem como deduzir. Defina aqui e todos os relatórios ganham o corte
                                    regional. Uma unidade pertence a uma única região.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2 max-w-md">
                                    <Input
                                        value={novaRegiao}
                                        onChange={(e) => setNovaRegiao(e.target.value)}
                                        placeholder="Nome da região (ex.: Metropolitana)"
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRegiao(); } }}
                                    />
                                    <Button type="button" variant="outline" onClick={addRegiao} className="gap-1.5 shrink-0">
                                        <Plus className="w-4 h-4" />
                                        Criar
                                    </Button>
                                </div>

                                {Object.keys(draft.regioes).length === 0 ? (
                                    <p className="text-sm text-slate-400 py-6 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                                        Nenhuma região definida. As {formatNumber(unidades.length)} unidades
                                        aparecem individualmente nos relatórios.
                                    </p>
                                ) : (
                                    <div className="space-y-3">
                                        {Object.entries(draft.regioes).map(([nome, membros]) => (
                                            <div key={nome} className="rounded-lg border border-slate-200 dark:border-slate-700">
                                                <div className="flex items-center justify-between gap-2 p-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setRegiaoAberta(regiaoAberta === nome ? '' : nome)}
                                                        className="flex items-center gap-2 text-sm font-medium min-w-0"
                                                    >
                                                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                                                        <span className="truncate">{nome}</span>
                                                        <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">
                                                            {membros.length}
                                                        </Badge>
                                                    </button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-rose-600"
                                                        onClick={() => removeRegiao(nome)}
                                                        title="Remover região"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>

                                                {regiaoAberta === nome && (
                                                    <div className="border-t border-slate-100 dark:border-slate-800 p-3">
                                                        <ScrollArea className="h-56">
                                                            <div className="space-y-0.5 pr-2">
                                                                {unidades.map((unidade) => {
                                                                    const dona = regiaoDe(unidade);
                                                                    const minha = dona === nome;
                                                                    const ocupada = dona && !minha;
                                                                    return (
                                                                        <label
                                                                            key={unidade}
                                                                            className={`flex items-center gap-2 rounded px-2 py-1.5 ${ocupada ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                                        >
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={minha}
                                                                                disabled={ocupada}
                                                                                onChange={() => toggleUnidadeNaRegiao(nome, unidade)}
                                                                                className="rounded"
                                                                            />
                                                                            <span className="text-sm leading-tight">{unidade}</span>
                                                                            {ocupada && (
                                                                                <span className="text-[11px] text-slate-400 ml-auto">
                                                                                    já em {dona}
                                                                                </span>
                                                                            )}
                                                                        </label>
                                                                    );
                                                                })}
                                                                {unidades.length === 0 && (
                                                                    <p className="text-xs text-slate-400 py-4 text-center">
                                                                        Nenhuma unidade nos registros ainda.
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </ScrollArea>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ---- Prescrição ---- */}
                <TabsContent value="prescricao" className="space-y-4 mt-0">
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Acompanhamento de prescrição</CardTitle>
                            <CardDescription>
                                A plataforma não tem como saber o prazo de cada matéria — isso é definição
                                jurídica do órgão. Escolha abaixo de onde vem a data-limite de cada registro.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-2 max-w-2xl">
                                <Label>Como calcular</Label>
                                <Select
                                    value={draft.prescricao.modo}
                                    onValueChange={(modo) => setPrescricao({ modo })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PANORAMA_PRESCRICAO_MODOS.map((m) => (
                                            <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {PANORAMA_PRESCRICAO_MODOS.find((m) => m.key === draft.prescricao.modo)?.descricao}
                                </p>
                            </div>

                            {draft.prescricao.modo === 'coluna' && !columnForRole(draft, 'prazo') && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="w-4 h-4" />
                                    <AlertDescription className="text-sm">
                                        Nenhuma coluna está no papel de <strong>data-limite / prescrição</strong>.
                                        Marque-a na aba “Colunas e papéis”, senão nenhum prazo será calculado.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {draft.prescricao.modo === 'prazo' && (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="pan-anos">Prazo padrão (anos)</Label>
                                            <Input
                                                id="pan-anos"
                                                type="number"
                                                min={0.5}
                                                max={100}
                                                step={0.5}
                                                value={draft.prescricao.anosPadrao}
                                                onChange={(e) => setPrescricao({ anosPadrao: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label>Contar a partir de</Label>
                                            <Select
                                                value={draft.prescricao.contarDe}
                                                onValueChange={(contarDe) => setPrescricao({ contarDe })}
                                            >
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="data_principal">
                                                        {columnForRole(draft, 'data_principal')?.label || 'Data principal'}
                                                    </SelectItem>
                                                    <SelectItem value="data_referencia">
                                                        {columnForRole(draft, 'data_referencia')?.label || 'Data de referência (fato)'}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {draft.prescricao.contarDe === 'data_referencia'
                                        && !columnForRole(draft, 'data_referencia') && (
                                        <Alert variant="destructive">
                                            <AlertTriangle className="w-4 h-4" />
                                            <AlertDescription className="text-sm">
                                                A contagem está configurada para a data de referência, mas
                                                nenhuma coluna ocupa esse papel. Nenhum prazo será calculado.
                                            </AlertDescription>
                                        </Alert>
                                    )}

                                    {assuntos.length > 0 && (
                                        <div className="space-y-2">
                                            <Label>Prazos diferentes por assunto</Label>
                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                Deixe em branco para usar o prazo padrão. Útil quando matérias
                                                diferentes prescrevem em prazos diferentes — improbidade por
                                                dano ao erário em um prazo, licitação em outro.
                                            </p>
                                            <ScrollArea className="h-64 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Assunto</TableHead>
                                                            <TableHead className="w-40">Prazo (anos)</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {assuntos.map((assunto) => (
                                                            <TableRow key={assunto}>
                                                                <TableCell className="text-sm">{assunto}</TableCell>
                                                                <TableCell>
                                                                    <Input
                                                                        type="number"
                                                                        min={0}
                                                                        max={100}
                                                                        step={0.5}
                                                                        value={draft.prescricao.anosPorAssunto[assunto] ?? ''}
                                                                        onChange={(e) => setPrazoAssunto(assunto, e.target.value)}
                                                                        placeholder={String(draft.prescricao.anosPadrao)}
                                                                        className="h-8 w-32 text-sm"
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </ScrollArea>
                                        </div>
                                    )}
                                </>
                            )}

                            {draft.prescricao.modo !== 'desligado' && (
                                <div className="space-y-2 max-w-xl">
                                    <Label>Faixas de alerta (dias restantes)</Label>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Até o primeiro número é <strong>crítico</strong>; até o segundo,
                                        <strong> em alerta</strong>; até o terceiro, <strong>atenção</strong>.
                                        Acima disso, confortável.
                                    </p>
                                    <div className="flex gap-2">
                                        {[0, 1, 2].map((i) => (
                                            <Input
                                                key={i}
                                                type="number"
                                                min={1}
                                                value={draft.prescricao.alertas[i] ?? ''}
                                                onChange={(e) => {
                                                    const next = [...draft.prescricao.alertas];
                                                    next[i] = Number(e.target.value);
                                                    setPrescricao({ alertas: next.filter((n) => n > 0) });
                                                }}
                                                className="w-24 h-9"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => set({ prescricao: { ...PANORAMA_PRESCRICAO_PADRAO } })}
                            >
                                <RotateCcw className="w-4 h-4" />
                                Restaurar padrão
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---- Importação ---- */}
                <TabsContent value="importacao" className="space-y-4 mt-0">
                    <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Comportamento da importação</CardTitle>
                            <CardDescription>
                                Vale para todas as importações desta base, e pode ser sobreposto a cada envio.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-2 max-w-2xl">
                                <Label>Política para dados divergentes</Label>
                                <Select
                                    value={draft.importPolicy}
                                    onValueChange={(importPolicy) => set({ importPolicy })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PANORAMA_IMPORT_POLICIES.map((p) => (
                                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {PANORAMA_IMPORT_POLICIES.find((p) => p.value === draft.importPolicy)?.description}
                                </p>
                            </div>

                            <div className="space-y-2 max-w-2xl">
                                <Label>
                                    Rigor da correção automática: {draft.fuzzyThreshold.toFixed(2)}
                                </Label>
                                <Slider
                                    value={[Math.round(draft.fuzzyThreshold * 100)]}
                                    onValueChange={([v]) => set({ fuzzyThreshold: v / 100 })}
                                    min={40}
                                    max={100}
                                    step={5}
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Similaridade mínima para a importação aproximar um valor de outro que já
                                    existe — é o que faz “PORTO ALEGRE”, “Porto Alegre” e “P. Alegre” virarem
                                    um só grupo. Em 1,00, só a grafia exata é aceita; quanto menor, mais a
                                    plataforma corrige por conta própria.
                                </p>
                            </div>

                            <Alert>
                                <Info className="w-4 h-4" />
                                <AlertDescription className="text-xs">
                                    O reconhecimento de registro repetido é feito pela coluna marcada como{' '}
                                    <strong>identificador</strong>
                                    {columnForRole(draft, 'identificador')
                                        ? ` (hoje: ${columnForRole(draft, 'identificador').label})`
                                        : ' — que esta base ainda não tem'}
                                    . Sem ela, cada importação acrescenta tudo de novo.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AlertDialog open={excluindo} onOpenChange={setExcluindo}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir a base “{draft.nome}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso apaga a base e os {formatNumber(registros.length)} registro(s) dela.
                            Não há como desfazer. Para confirmar, digite o nome exato da base.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                        value={confirmName}
                        onChange={(e) => setConfirmName(e.target.value)}
                        placeholder={draft.nome}
                        className="font-mono"
                    />
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={saving || confirmName !== draft.nome}
                            className="bg-rose-600 hover:bg-rose-700"
                        >
                            {saving ? 'Excluindo...' : 'Excluir definitivamente'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
