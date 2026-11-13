import React, { useState } from 'react';
import { CheckCircle2, Circle, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ROTULO_DESTINO, ROTULO_QUEM, destinoDaAcao, partesVeem, pedidoDaAcao } from '@/lib/exigencias';
import { dataHora } from './comum';
import SeletorRegistro from './SeletorRegistro';

// Ações da fase na tela do processo (aba Andamento): cada uma do jeito que o
// rito pediu (caixa de marcar, um dado ou um documento), dizendo onde o
// cumprimento fica e quem vê. Quem decide é o servidor (marcarAcao).

const ONDE = { ...ROTULO_DESTINO, autos: 'certidão nos autos' };

/** Selos discretos do que o rito diz da ação. */
export function SelosAcao({ r }) {
    const dest = destinoDaAcao(r);
    const pede = pedidoDaAcao(r);
    const selos = [
        ...(pede !== 'documento' && dest !== 'evento' ? [ONDE[dest]] : []),
        ...(pede !== 'documento' && partesVeem(r) ? ['partes veem'] : []),
        ...(r?.obrigatoria ? ['obrigatória'] : r?.recomendada ? ['recomendada'] : []),
        ...(r?.quem ? [ROTULO_QUEM[r.quem]] : []),
    ];
    if (!selos.length) return null;
    return <span className="text-xs text-slate-600 dark:text-slate-400"> · {selos.join(' · ')}</span>;
}

/**
 * Uma ação da fase. `info`: a informação registrada nesta rodada da fase (se a ação pede um dado).
 * `onMarcar(feita, valor)` chama o servidor.
 */
export function AcaoDaFase({ acao, r, feita, info, podeMexer, reservada, ocupado, onMarcar, onRegistrar, onDesfazer }) {
    const pede = pedidoDaAcao(r);
    // Reservada pelo rito a outra pessoa: quem tem o processo vê por quê não pode cumprir.
    const aviso = reservada && !feita && (
        <span className="block text-xs text-slate-600 dark:text-slate-400">
            {r?.quem === 'responsavel' ? 'Só o responsável designado cumpre esta ação (use "Atribuir" se for o caso).' : 'Só quem gere a unidade cumpre esta ação.'}
        </span>
    );
    if (pede === 'confirmar') {
        return (
            <label className={`flex items-start gap-2 text-sm ${podeMexer ? 'cursor-pointer' : ''}`}>
                <input type="checkbox" className="mt-1" checked={feita} disabled={!podeMexer || ocupado}
                    onChange={(e) => onMarcar(e.target.checked)} />
                <span><span className={feita ? 'line-through text-slate-600' : ''}>{acao}</span><SelosAcao r={r} />
                    {r?.ajuda && !feita && <span className="block text-xs text-slate-600 dark:text-slate-400">{r.ajuda}</span>}{aviso}</span>
            </label>
        );
    }
    // Pede um dado: registra num diálogo; feita mostra o valor e permite desfazer.
    return (
        <div className="flex flex-wrap items-start gap-2 text-sm">
            {feita
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden />
                : <Circle className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" aria-hidden />}
            <span className="flex-1 min-w-[10rem]">
                <span className={feita ? 'line-through text-slate-600' : ''}>{acao}</span><SelosAcao r={r} />
                {r?.ajuda && !feita && <span className="block text-xs text-slate-600 dark:text-slate-400">{r.ajuda}</span>}
                {aviso}
                {feita && info && (
                    <span className="block text-slate-800 dark:text-slate-200">
                        {info.rotulo}: <b className="whitespace-pre-wrap break-words">{info.valor_texto}</b>
                        <span className="text-xs text-slate-600 dark:text-slate-400"> · {info.por}, {dataHora(info.em)}</span>
                    </span>
                )}
            </span>
            {podeMexer && !feita && <Button size="sm" variant="outline" disabled={ocupado} onClick={onRegistrar}>Registrar</Button>}
            {podeMexer && feita && <Button size="sm" variant="ghost" className="gap-1" disabled={ocupado} onClick={onDesfazer}><Undo2 className="w-4 h-4" /> Desfazer</Button>}
        </div>
    );
}

/** Diálogo para informar o dado que a ação pede. */
export function RegistrarAcao({ alvo, ocupado, onFechar, onEnviar }) {
    const [valor, setValor] = useState('');
    if (!alvo) return null;
    const { acao, r, fase } = alvo;
    const pede = pedidoDaAcao(r);
    const dest = destinoDaAcao(r);
    const rotulo = r?.rotulo || acao;
    const vazio = pede === 'sim_nao' ? valor === '' : !String(valor).trim();
    const fechar = () => { setValor(''); onFechar(); };
    const onde = dest === 'autos'
        ? 'Vira certidão nos autos, com folha, e sai na impressão.'
        : dest === 'evento'
            ? 'Fica nas informações do processo e como evento no extrato ao fim da impressão, sem folha.'
            : dest === 'nenhum'
                ? 'Não gera evento: fica só nas informações do processo, para a equipe.'
                : dest === 'consolidar'
                    ? 'Entra como item da certidão conjunta da fase, emitida nos autos quando o processo sair da fase (ou do grupo de fases).'
                : 'Fica só nas informações do processo e na aba Eventos, para controle. Não sai em impressão.';
    const quem = partesVeem(r) ? 'As partes também veem no portal.' : 'Só a equipe vê.';
    let campo;
    if (pede === 'texto_longo') campo = <Textarea id="acao-valor" rows={4} maxLength={4000} value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />;
    else if (pede === 'numero') campo = <Input id="acao-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 12345" autoFocus />;
    else if (pede === 'data') campo = <Input id="acao-valor" type="date" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />;
    else if (pede === 'registro') campo = <SeletorRegistro id="acao-valor" aria-describedby={r?.ajuda ? 'acao-ajuda' : undefined} modulo={r.modulo} value={valor} onChange={setValor} autoFocus />;
    else if (pede === 'lista' || pede === 'sim_nao') {
        const opcoes = pede === 'lista' ? (r.opcoes || []).map((o) => [o, o]) : [['sim', 'Sim'], ['nao', 'Não']];
        campo = (
            <select id="acao-valor" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus
                className="mt-1 h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900">
                <option value="">Escolha…</option>
                {opcoes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
        );
    } else campo = <Input id="acao-valor" maxLength={200} value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />;
    return (
        <Dialog open onOpenChange={(o) => !o && fechar()}>
            <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{acao}</DialogTitle>
                    <DialogDescription>Fase {fase}. {onde} {quem}</DialogDescription>
                </DialogHeader>
                <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (!vazio) onEnviar(valor).then((ok) => ok && setValor('')); }}>
                    <Label htmlFor="acao-valor">{rotulo}</Label>
                    {campo}
                    {r?.ajuda && <p id="acao-ajuda" className="text-xs text-slate-600 dark:text-slate-400">{r.ajuda}</p>}
                    <DialogFooter className="pt-2">
                        <Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button>
                        <Button type="submit" disabled={ocupado || vazio}>Registrar</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
