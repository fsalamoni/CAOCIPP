import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Wrench,
    Loader2,
    AlertCircle,
    CheckCircle2,
    ShieldCheck,
    Info,
    History,
    DatabaseZap,
} from 'lucide-react';
import { runIntegrityAudit, recalcOrgStats, backfillHistory, getOrgsReport } from '@/services/platformService';
import { logger } from '@/utils/logger';

function formatNumber(n) {
    return new Intl.NumberFormat('pt-BR').format(n || 0);
}

export default function DataToolsPanel() {
    const [audit, setAudit] = useState(null);
    const [isAuditing, setIsAuditing] = useState(false);
    const [error, setError] = useState(null);
    const [fixingOrg, setFixingOrg] = useState(null);
    const [confirmOrg, setConfirmOrg] = useState(null);
    const [message, setMessage] = useState(null);

    // --- Backfill do histórico (Fase 3) ---
    const [orgs, setOrgs] = useState([]);
    const [backfillOrgId, setBackfillOrgId] = useState('');
    const [backfillMode, setBackfillMode] = useState(null); // 'verify' | 'write' | null
    const [backfillProgress, setBackfillProgress] = useState('');
    const [backfillResult, setBackfillResult] = useState(null);
    const [confirmBackfill, setConfirmBackfill] = useState(false);

    useEffect(() => {
        let active = true;
        getOrgsReport(500)
            .then((res) => {
                if (!active) return;
                const list = (res?.organizations || res?.orgs || res || [])
                    .map((o) => ({ id: o.id || o.organization_id, name: o.name || 'Sem nome' }))
                    .filter((o) => o.id);
                setOrgs(list);
            })
            .catch((err) => logger.error('Falha ao carregar órgãos para backfill:', err));
        return () => {
            active = false;
        };
    }, []);

    // Executa o backfill (ou a verificação) para o órgão selecionado, iterando
    // ambas as coleções (processes/expedientes) em lotes até concluir.
    const runBackfill = async (verifyOnly) => {
        if (!backfillOrgId) return;
        setBackfillMode(verifyOnly ? 'verify' : 'write');
        setError(null);
        setMessage(null);
        setBackfillResult(null);
        const totals = {
            processed: 0,
            entriesWritten: 0,
            arrayEntriesTotal: 0,
            historyEntriesTotal: 0,
            mismatches: [],
        };
        try {
            for (const collection of ['processes', 'expedientes']) {
                let startAfter = null;
                let done = false;
                let guard = 0;
                while (!done && guard < 1000) {
                    guard += 1;
                    setBackfillProgress(
                        `${verifyOnly ? 'Verificando' : 'Migrando'} ${collection}... (${totals.processed} documentos)`
                    );
                    const res = await backfillHistory({
                        organizationId: backfillOrgId,
                        collection,
                        startAfter,
                        batchDocs: 200,
                        verifyOnly,
                    });
                    totals.processed += res.processed || 0;
                    totals.entriesWritten += res.entriesWritten || 0;
                    totals.arrayEntriesTotal += res.arrayEntriesTotal || 0;
                    totals.historyEntriesTotal += res.historyEntriesTotal || 0;
                    if (Array.isArray(res.mismatches) && res.mismatches.length) {
                        totals.mismatches.push(...res.mismatches.map((m) => ({ ...m, collection })));
                    }
                    startAfter = res.lastDocId;
                    done = res.done || res.processed === 0;
                }
            }
            setBackfillResult(totals);
            setMessage(
                verifyOnly
                    ? `Verificação concluída: ${totals.processed} documentos. Divergências: ${totals.mismatches.length}.`
                    : `Migração concluída: ${totals.processed} documentos, ${totals.entriesWritten} entradas espelhadas.`
            );
        } catch (err) {
            logger.error('Falha no backfill de histórico:', err);
            setError(err?.message || 'Erro ao executar o backfill do histórico.');
        } finally {
            setBackfillMode(null);
            setBackfillProgress('');
            setConfirmBackfill(false);
        }
    };

    const backfillOrgName = orgs.find((o) => o.id === backfillOrgId)?.name || '';

    const handleAudit = async () => {
        setIsAuditing(true);
        setError(null);
        setMessage(null);
        try {
            const result = await runIntegrityAudit(200);
            setAudit(result);
        } catch (err) {
            logger.error('Falha na auditoria de integridade:', err);
            setError(err?.message || 'Erro ao executar auditoria.');
        } finally {
            setIsAuditing(false);
        }
    };

    const handleRecalc = async (organizationId) => {
        setFixingOrg(organizationId);
        setError(null);
        setMessage(null);
        try {
            await recalcOrgStats(organizationId);
            setMessage('Contadores recalculados com sucesso. Reexecutando auditoria...');
            await handleAudit();
        } catch (err) {
            logger.error('Falha ao recalcular contadores:', err);
            setError(err?.message || 'Erro ao recalcular contadores.');
        } finally {
            setFixingOrg(null);
            setConfirmOrg(null);
        }
    };

    const driftRows = audit?.driftRows || [];
    // Órgãos únicos com divergência (para o botão de correção).
    const orgsWithDrift = [
        ...new Map(
            driftRows.map((r) => [r.organization_id, { id: r.organization_id, name: r.name }])
        ).values(),
    ];

    return (
        <div className="space-y-4">
            <Alert className="border-sky-300 bg-sky-50 dark:bg-sky-950/30">
                <Info className="w-4 h-4 text-sky-600" />
                <AlertDescription className="text-sky-800 dark:text-sky-200">
                    A auditoria é <strong>somente leitura</strong>. A correção apenas
                    realinha os contadores de total (membros, processos, expedientes) com a
                    contagem real — nunca apaga ou altera dados. É uma operação segura e
                    idempotente.
                </AlertDescription>
            </Alert>

            {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </div>
            )}
            {message && (
                <div className="flex items-center gap-2 text-emerald-600 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    {message}
                </div>
            )}

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Wrench className="w-5 h-5 text-amber-600" />
                        Auditoria de integridade dos contadores
                    </CardTitle>
                    <Button size="sm" onClick={handleAudit} disabled={isAuditing} className="gap-2">
                        {isAuditing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <ShieldCheck className="w-4 h-4" />
                        )}
                        Executar auditoria
                    </Button>
                </CardHeader>
                <CardContent>
                    {!audit ? (
                        <p className="text-sm text-slate-500">
                            Compara os contadores armazenados em cada órgão com a contagem
                            real. Clique em “Executar auditoria”.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-4 text-sm">
                                <span className="text-slate-600 dark:text-slate-300">
                                    Órgãos verificados: <strong>{formatNumber(audit.scanned)}</strong>
                                </span>
                                <span className="text-emerald-600">
                                    Sem divergência: <strong>{formatNumber(audit.okCount)}</strong>
                                </span>
                                <span className={driftRows.length ? 'text-amber-600' : 'text-slate-500'}>
                                    Divergências: <strong>{formatNumber(driftRows.length)}</strong>
                                </span>
                            </div>

                            {driftRows.length === 0 ? (
                                <div className="flex items-center gap-2 text-emerald-600">
                                    <CheckCircle2 className="w-5 h-5" />
                                    Todos os contadores estão corretos.
                                </div>
                            ) : (
                                <>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Órgão</TableHead>
                                                <TableHead>Contador</TableHead>
                                                <TableHead className="text-right">Armazenado</TableHead>
                                                <TableHead className="text-right">Real</TableHead>
                                                <TableHead className="text-right">Diferença</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {driftRows.map((r, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium">{r.name}</TableCell>
                                                    <TableCell>{r.field}</TableCell>
                                                    <TableCell className="text-right">{formatNumber(r.stored)}</TableCell>
                                                    <TableCell className="text-right">{formatNumber(r.actual)}</TableCell>
                                                    <TableCell className={`text-right ${r.diff === 0 ? '' : 'text-amber-600'}`}>
                                                        {r.diff > 0 ? `+${r.diff}` : r.diff}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>

                                    <div className="space-y-2">
                                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                            Corrigir contadores:
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {orgsWithDrift.map((org) => (
                                                <Button
                                                    key={org.id}
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={fixingOrg === org.id}
                                                    onClick={() => setConfirmOrg(org)}
                                                    className="gap-2"
                                                >
                                                    {fixingOrg === org.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Wrench className="w-4 h-4" />
                                                    )}
                                                    {org.name}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <History className="w-5 h-5 text-indigo-600" />
                        Migração do histórico para subcoleção (Fase 3)
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert className="border-indigo-300 bg-indigo-50 dark:bg-indigo-950/30">
                        <Info className="w-4 h-4 text-indigo-600" />
                        <AlertDescription className="text-indigo-800 dark:text-indigo-200">
                            Copia o histórico de cada processo/expediente do campo{' '}
                            <code>activity_log</code> para a subcoleção <code>history</code>.
                            É <strong>aditivo e idempotente</strong>: não altera nem apaga os
                            dados atuais, pode ser repetido sem duplicar, e a leitura do app
                            continua igual. Use <strong>“Verificar paridade”</strong> (somente
                            leitura) antes e depois de migrar.
                        </AlertDescription>
                    </Alert>

                    <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                                Órgão
                            </label>
                            <select
                                value={backfillOrgId}
                                onChange={(e) => {
                                    setBackfillOrgId(e.target.value);
                                    setBackfillResult(null);
                                }}
                                disabled={!!backfillMode}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="">Selecione um órgão...</option>
                                {orgs.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        {o.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                disabled={!backfillOrgId || !!backfillMode}
                                onClick={() => runBackfill(true)}
                                className="gap-2"
                            >
                                {backfillMode === 'verify' ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <ShieldCheck className="w-4 h-4" />
                                )}
                                Verificar paridade
                            </Button>
                            <Button
                                disabled={!backfillOrgId || !!backfillMode}
                                onClick={() => setConfirmBackfill(true)}
                                className="gap-2"
                            >
                                {backfillMode === 'write' ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <DatabaseZap className="w-4 h-4" />
                                )}
                                Migrar histórico
                            </Button>
                        </div>
                    </div>

                    {backfillProgress && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {backfillProgress}
                        </div>
                    )}

                    {backfillResult && (
                        <div className="space-y-2 text-sm">
                            <div className="flex flex-wrap gap-4">
                                <span className="text-slate-600 dark:text-slate-300">
                                    Documentos: <strong>{formatNumber(backfillResult.processed)}</strong>
                                </span>
                                <span className="text-slate-600 dark:text-slate-300">
                                    Entradas no array: <strong>{formatNumber(backfillResult.arrayEntriesTotal)}</strong>
                                </span>
                                {backfillResult.entriesWritten > 0 && (
                                    <span className="text-emerald-600">
                                        Entradas espelhadas: <strong>{formatNumber(backfillResult.entriesWritten)}</strong>
                                    </span>
                                )}
                                <span className={backfillResult.mismatches.length ? 'text-amber-600' : 'text-emerald-600'}>
                                    Divergências: <strong>{formatNumber(backfillResult.mismatches.length)}</strong>
                                </span>
                            </div>
                            {backfillResult.mismatches.length > 0 && (
                                <p className="text-amber-600">
                                    Há documentos com menos entradas na subcoleção do que no array.
                                    Execute “Migrar histórico” para alinhá-los.
                                </p>
                            )}
                            {backfillResult.mismatches.length === 0 && (
                                <p className="text-emerald-600 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> Paridade OK: a subcoleção contém todas as entradas do array.
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!confirmOrg} onOpenChange={(open) => !open && setConfirmOrg(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Recalcular contadores?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação realinha os contadores de total do órgão{' '}
                            <strong>{confirmOrg?.name}</strong> com a contagem real de
                            membros, processos e expedientes. Nenhum dado é apagado ou
                            alterado. É seguro e pode ser repetido.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => confirmOrg && handleRecalc(confirmOrg.id)}>
                            Recalcular
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={confirmBackfill} onOpenChange={(open) => !open && setConfirmBackfill(false)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Migrar histórico do órgão?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Copia o histórico dos processos e expedientes de{' '}
                            <strong>{backfillOrgName}</strong> para a subcoleção <code>history</code>.
                            A operação é aditiva e idempotente: não altera nem apaga os dados
                            atuais e pode ser repetida sem duplicar. Em órgãos grandes pode
                            levar alguns minutos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => runBackfill(false)}>
                            Migrar histórico
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
