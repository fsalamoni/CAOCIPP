import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { POLOS, rotuloDe } from '@/lib/camposProcesso';
import { CamposProcesso } from './CamposProcesso';
import { ORIGENS, NativeSelect } from './comum';

// ============================================================================
// Campos do "Novo processo" conforme o formulário do tipo: cada campo padrão
// aparece, é obrigatório ou fica fixo pelo tipo, com o nome e a orientação
// que o admin definiu, e os campos próprios. A mesma tela serve à autuação e
// à prévia no editor do tipo.
// ============================================================================

const Obrigatorio = () => <span className="text-red-600 dark:text-red-400" aria-hidden> *</span>;
const seletor = 'h-9 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-slate-900';

/**
 * `f` = { assunto, descricao, origem, unidade_id, sigilo, urgente, motivo_urgencia, partes, campos };
 * `unidades` = [[id, nome]]; `rito` = o que mostrar no lugar do rito; `tipo` = tipo escolhido (ou null).
 */
export default function FormularioAutuacao({ form, f, setF, prefixo = 'sec', unidades = [], rito = null, tipo = null }) {
    const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
    const id = (k) => `${prefixo}-${k}`;
    const rot = (k) => rotuloDe(form, k);
    const ajuda = (k, padrao) => {
        const t = form.ajudas?.[k] || padrao;
        return t ? <p id={id(`${k}-ajuda`)} className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t}</p> : null;
    };
    const desc = (k, padrao) => (form.ajudas?.[k] || padrao ? id(`${k}-ajuda`) : undefined);
    const req = (uso) => (uso === 'obrigatorio' ? <Obrigatorio /> : null);
    const polos = POLOS.filter(([p]) => form.polos.includes(p));
    const poloNovo = form.polos.includes('requerente') ? 'requerente' : form.polos[0];
    const nomeUnidade = unidades.find(([u]) => u === f.unidade_id)?.[1];
    // O que o tipo fixa e quem autua não escolhe, numa linha só.
    const fixos = [
        form.unidade === 'oculto' && nomeUnidade && `${rot('unidade').toLowerCase()} ${nomeUnidade}`,
        form.sigilo === 'oculto' && `${rot('sigilo').toLowerCase()} ${f.sigilo === 'restrito' ? 'restrito' : 'normal'}`,
        form.urgencia === 'oculto' && (tipo?.urgente ? 'tramitação urgente' : 'tramitação comum'),
    ].filter(Boolean);
    const urgenteFixo = tipo?.urgente === true;

    return (
        <div className="space-y-4">
            {form.assunto !== 'oculto' && (
                <div>
                    <Label htmlFor={id('assunto')}>{rot('assunto')}{req(form.assunto)}</Label>
                    <Input id={id('assunto')} className="mt-1" value={f.assunto} onChange={(e) => set('assunto', e.target.value)} maxLength={200}
                        aria-required={form.assunto === 'obrigatorio' || undefined} aria-describedby={desc('assunto')} />
                    {ajuda('assunto')}
                </div>
            )}
            {form.descricao !== 'oculto' && (
                <div>
                    <Label htmlFor={id('desc')}>{rot('descricao')}{req(form.descricao)}</Label>
                    <Textarea id={id('desc')} className="mt-1" value={f.descricao} onChange={(e) => set('descricao', e.target.value)} rows={3}
                        aria-required={form.descricao === 'obrigatorio' || undefined} aria-describedby={desc('descricao')} />
                    {ajuda('descricao')}
                </div>
            )}
            <CamposProcesso prefixo={`${prefixo}-cp`} campos={form.campos} valores={f.campos} onChange={(cid, v) => setF((x) => ({ ...x, campos: { ...x.campos, [cid]: v } }))} />
            {form.origem !== 'oculto' && (
                <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                        <Label htmlFor={id('origem')}>{rot('origem')}{req(form.origem)}</Label>
                        <select id={id('origem')} className={`mt-1 w-full ${seletor}`} value={f.origem.tipo} onChange={(e) => set('origem', { ...f.origem, tipo: e.target.value })}
                            aria-required={form.origem === 'obrigatorio' || undefined}>
                            <option value="">{form.origem === 'obrigatorio' ? 'Escolha…' : 'Não informar'}</option>
                            {ORIGENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                    </div>
                    <div className="sm:col-span-2">
                        <Label htmlFor={id('origem-ref')}>Referência da origem</Label>
                        <Input id={id('origem-ref')} className="mt-1" value={f.origem.descricao} maxLength={200} onChange={(e) => set('origem', { ...f.origem, descricao: e.target.value })}
                            placeholder="Ex.: Ofício nº 12/2026 da Prefeitura, recebido por e-mail" aria-describedby={desc('origem', true)} />
                    </div>
                    <div className="sm:col-span-3 -mt-2">{ajuda('origem', 'Como o processo chegou ao órgão. Aparece na capa e no PDF da equipe; as partes não veem a referência.')}</div>
                </div>
            )}
            <div className="grid sm:grid-cols-3 gap-3">
                {rito}
                {form.unidade !== 'oculto' && (
                    <div>
                        <NativeSelect id={id('unidade')} label={rot('unidade')} value={f.unidade_id} onChange={(v) => set('unidade_id', v)} options={unidades} />
                        {ajuda('unidade')}
                    </div>
                )}
                {form.sigilo !== 'oculto' && (
                    <div>
                        <NativeSelect id={id('sigilo')} label={rot('sigilo')} value={f.sigilo} onChange={(v) => set('sigilo', v)}
                            options={[['normal', 'Normal'], ['restrito', 'Restrito às unidades por onde passar']]} />
                        {ajuda('sigilo')}
                    </div>
                )}
            </div>
            {fixos.length > 0 && <p className="text-xs text-slate-600 dark:text-slate-400">Definido pelo tipo: {fixos.join(' · ')}.</p>}
            {(form.urgencia !== 'oculto' || urgenteFixo) && (
                <div className={`rounded-lg border px-3 py-2 space-y-2 ${f.urgente ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                    <label className="flex items-center gap-2 text-sm font-medium">
                        <input type="checkbox" checked={f.urgente} disabled={urgenteFixo || form.urgencia === 'oculto'} onChange={(e) => set('urgente', e.target.checked)} />
                        {rot('urgencia')}
                        {urgenteFixo && <span className="font-normal text-xs text-slate-600 dark:text-slate-400">(este tipo de processo é sempre urgente)</span>}
                    </label>
                    {f.urgente && !urgenteFixo && (
                        <div><Label htmlFor={id('urg')}>Motivo da urgência<Obrigatorio /></Label>
                            <Input id={id('urg')} className="mt-1" value={f.motivo_urgencia} onChange={(e) => set('motivo_urgencia', e.target.value)} maxLength={300} placeholder="Ex.: risco de perecimento do direito, prazo legal curto" aria-required /></div>
                    )}
                    {!f.urgente && <p className="text-xs text-slate-600 dark:text-slate-400">{form.ajudas?.urgencia || 'O processo urgente aparece primeiro nas listas, com selo vermelho, e os avisos saem marcados como urgentes.'}</p>}
                </div>
            )}
            {form.partes !== 'oculto' && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <Label>{rot('partes')}{req(form.partes)}</Label>
                        <Button type="button" size="sm" variant="outline" onClick={() => set('partes', [...f.partes, { nome: '', documento: '', polo: poloNovo }])}>Adicionar</Button>
                    </div>
                    {ajuda('partes')}
                    {f.partes.map((pa, i) => {
                        const mudar = (d) => set('partes', f.partes.map((x, j) => (j === i ? { ...x, ...d } : x)));
                        return (
                            <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end rounded-md sm:rounded-none border sm:border-0 border-slate-200 dark:border-slate-700 p-2 sm:p-0">
                                <Input className="col-span-2 sm:col-span-4" placeholder="Nome" aria-label="Nome da parte" value={pa.nome} onChange={(e) => mudar({ nome: e.target.value })} />
                                <Input className="sm:col-span-2" placeholder="CPF/CNPJ" aria-label="CPF ou CNPJ" value={pa.documento} onChange={(e) => mudar({ documento: e.target.value })} />
                                <Input className="sm:col-span-3" type="email" placeholder="E-mail (convite)" aria-label="E-mail da parte" value={pa.email || ''} onChange={(e) => mudar({ email: e.target.value })} />
                                {polos.length > 1
                                    ? <select className={`sm:col-span-2 ${seletor}`} value={pa.polo} onChange={(e) => mudar({ polo: e.target.value })} aria-label="Polo">
                                        {polos.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                    </select>
                                    : <span className="sm:col-span-2 h-9 flex items-center text-sm text-slate-600 dark:text-slate-400">{polos[0]?.[1]}</span>}
                                <Button type="button" variant="ghost" size="sm" className="sm:col-span-1" onClick={() => set('partes', f.partes.filter((_, j) => j !== i))} aria-label="Remover parte">×</Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
