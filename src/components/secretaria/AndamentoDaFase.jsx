import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MODULOS_SITUACAO, SITUACOES, comSituacao, nomeDoRegistro } from '@/lib/andamentoFase';

const campo = 'h-9 w-full rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm';
const caixa = 'flex min-h-[2.75rem] sm:min-h-0 items-start gap-2 text-sm';
const dica = 'block text-xs text-slate-600 dark:text-slate-400';

/**
 * O que a fase faz sozinha no andamento: seguir quando o que ela exige (ação
 * ou documento obrigatório) é cumprido, arquivar ao entrar e conduzir a consulta ou o expediente
 * ligado ao processo. `ligadas`: integrações com outros módulos.
 */
export default function AndamentoDaFase({ f, mudar, ligadas }) {
    const ae = f.ao_entrar || {};
    const s = f.situacao_registro || {};
    const setArquivar = (v) => {
        const { arquivar: _fora, ...resto } = ae;
        const n = v ? { ...resto, arquivar: true } : resto;
        mudar({ ao_entrar: Object.keys(n).length ? n : undefined });
    };
    const setSit = (parte) => mudar({ situacao_registro: comSituacao(f, parte) });
    // Só os módulos com a integração ligada (o que a fase já usa continua à vista).
    const modulos = MODULOS_SITUACAO.filter(([m]) => !ligadas || ligadas[m] || s.modulo === m);
    const situacoes = <><option value="">Não muda</option>{SITUACOES.map((x) => <option key={x} value={x}>{x}</option>)}</>;
    return (
        <div className="space-y-3">
            <label className={caixa}>
                <Checkbox className="mt-0.5" checked={f.avanco === 'auto' && !f.final} disabled={!!f.final}
                    onCheckedChange={(c) => mudar({ avanco: c === true ? 'auto' : undefined })} />
                <span>Seguir sozinha quando o que a fase exige for cumprido
                    <span className={dica}>
                        {f.final
                            ? 'Fase final não tem para onde seguir.'
                            : 'Cumprido o último item obrigatório (ação marcada, documento juntado ou guardado), o processo vai para a próxima fase e, se ela corre em outra unidade, é enviado para lá. Com o botão Finalizar, segue depois do último documento. Com mais de uma saída, segue quando a resposta de uma ação indicar uma só. Minutas não seguem junto: para escolher as que acompanham o processo, deixe a fase terminar pelo botão. Se algo exigido ficar em aberto, fica o botão Concluir.'}
                    </span>
                </span>
            </label>
            <label className={caixa}>
                <Checkbox className="mt-0.5" checked={!!ae.arquivar} onCheckedChange={(c) => setArquivar(c === true)} />
                <span>Arquivar o processo ao entrar nesta fase
                    <span className={dica}>O arquivamento fica registrado com quem fez e a data, e sai no extrato do PDF. Use na última fase do rito.</span>
                </span>
            </label>
            <label className={caixa}>
                <Checkbox className="mt-0.5" checked={f.juntada_conjunta === true} onCheckedChange={(c) => mudar({ juntada_conjunta: c === true ? true : undefined })} />
                <span>Botão Finalizar: escolher, ordenar, assinar e juntar os documentos de uma vez
                    <span className={dica}>
                        Na tela do processo, a fase ganha o botão Finalizar {f.nome?.trim() ? `(aqui, "Finalizar ${f.nome.trim()[0].toLowerCase()}${f.nome.trim().slice(1)}")` : ''}. Quem tem o processo
                        escolhe quais minutas e anexos entram nos autos e em que ordem, assina e junta tudo. O que ficar de fora continua como minuta ou é guardado fora dos autos.
                        A redação original de cada minuta continua guardada para a equipe.
                    </span>
                </span>
            </label>
            <fieldset className="space-y-2">
                <legend className="text-xs font-medium">Consulta ou expediente ligado ao processo</legend>
                {modulos.length === 0 ? (
                    <p className={dica}>Para a fase mudar a situação de uma consulta ou de um expediente, ligue a integração com o módulo em Integrações com outros módulos.</p>
                ) : (
                    <div className="grid sm:grid-cols-3 gap-3">
                        <div>
                            <Label htmlFor={`sm-${f.id}`} className="text-xs">A fase conduz</Label>
                            <select id={`sm-${f.id}`} value={s.modulo || ''} onChange={(e) => setSit({ modulo: e.target.value })} className={campo}>
                                <option value="">Nenhum registro</option>
                                {modulos.map(([m, , nome]) => <option key={m} value={m}>{nome.replace(/^(a|o) /, (x) => x.toUpperCase())}</option>)}
                            </select>
                        </div>
                        {s.modulo && (
                            <>
                                <div>
                                    <Label htmlFor={`se-${f.id}`} className="text-xs">Ao entrar na fase, {nomeDoRegistro(s.modulo)} fica</Label>
                                    <select id={`se-${f.id}`} value={s.ao_entrar || ''} onChange={(e) => setSit({ ao_entrar: e.target.value })} className={campo}>{situacoes}</select>
                                </div>
                                <div>
                                    <Label htmlFor={`sa-${f.id}`} className="text-xs">Quando alguém assume o processo, fica</Label>
                                    <select id={`sa-${f.id}`} value={s.ao_assumir || ''} onChange={(e) => setSit({ ao_assumir: e.target.value })} className={campo}>{situacoes}</select>
                                </div>
                            </>
                        )}
                    </div>
                )}
                <p className={dica}>
                    Vale para a consulta ou o expediente de onde o processo nasceu (ou o único ligado a ele). A mudança aparece no quadro do módulo, com a data do dia, e fica no histórico do registro.
                    Na pasta é o arquivamento. Quem assume vira o responsável quando a situação é Em elaboração.
                </p>
            </fieldset>
        </div>
    );
}
