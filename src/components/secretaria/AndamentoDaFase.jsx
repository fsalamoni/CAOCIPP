import React, { useContext } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MODULOS_SITUACAO, comRegistroConduzido, comSituacao, nomeDoRegistro, situacoesDaRegra, valorDaRegra } from '@/lib/andamentoFase';
import { RegistroContexto } from './SeletorRegistro';

const campo = 'h-9 w-full rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm';
const caixa = 'flex min-h-[2.75rem] sm:min-h-0 items-start gap-2 text-sm';
const dica = 'block text-xs text-slate-600 dark:text-slate-400';

/**
 * O que a fase faz sozinha no andamento: seguir quando o que ela exige (ação
 * ou documento obrigatório) é cumprido, arquivar ao entrar e conduzir o registro
 * ligado ao processo (consulta, expediente ou registro de uma página própria).
 * `ligadas`: integrações com outros módulos.
 */
export default function AndamentoDaFase({ f, mudar, ligadas }) {
    const { paginas } = useContext(RegistroContexto);
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
    const dasPaginas = !ligadas || ligadas.paginas ? paginas : [];
    // A página que a fase já usa continua à vista, mesmo desativada ou com a integração desligada.
    const orfa = s.modulo === 'paginas' && !dasPaginas.some((x) => x.id === s.pagina);
    const opcoes = situacoesDaRegra(s, paginas);
    // Fase que a página não tem mais continua à vista, para ser trocada.
    const situacoes = (atual) => (
        <>
            <option value="">Não muda</option>
            {opcoes.map(([k, rot]) => <option key={k} value={k}>{rot}</option>)}
            {atual && !opcoes.some(([k]) => k === atual) && <option value={atual}>{atual} (não existe mais)</option>}
        </>
    );
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
                <legend className="text-xs font-medium">Registro ligado ao processo (consulta, expediente ou página própria)</legend>
                {modulos.length === 0 && dasPaginas.length === 0 && !orfa ? (
                    <p className={dica}>Para a fase mudar a situação de uma consulta, de um expediente ou do registro de uma página própria, ligue a integração com o módulo em Integrações com outros módulos.</p>
                ) : (
                    <div className="grid sm:grid-cols-3 gap-3">
                        <div>
                            <Label htmlFor={`sm-${f.id}`} className="text-xs">A fase conduz</Label>
                            <select id={`sm-${f.id}`} value={valorDaRegra(s)} onChange={(e) => mudar({ situacao_registro: comRegistroConduzido(f, e.target.value) })} className={campo}>
                                <option value="">Nenhum registro</option>
                                {modulos.map(([m, , nome]) => <option key={m} value={m}>{nome.replace(/^(a|o) /, (x) => x.toUpperCase())}</option>)}
                                {dasPaginas.map((pg) => <option key={pg.id} value={`paginas:${pg.id}`}>Página própria: {pg.nome}</option>)}
                                {orfa && <option value={valorDaRegra(s)}>Página própria que não existe mais</option>}
                            </select>
                        </div>
                        {s.modulo && (
                            <>
                                <div>
                                    <Label htmlFor={`se-${f.id}`} className="text-xs">Ao entrar na fase, {nomeDoRegistro(s, paginas)} fica</Label>
                                    <select id={`se-${f.id}`} value={s.ao_entrar || ''} onChange={(e) => setSit({ ao_entrar: e.target.value })} className={campo}>{situacoes(s.ao_entrar)}</select>
                                </div>
                                <div>
                                    <Label htmlFor={`sa-${f.id}`} className="text-xs">Quando alguém assume o processo, fica</Label>
                                    <select id={`sa-${f.id}`} value={s.ao_assumir || ''} onChange={(e) => setSit({ ao_assumir: e.target.value })} className={campo}>{situacoes(s.ao_assumir)}</select>
                                </div>
                            </>
                        )}
                    </div>
                )}
                <p className={dica}>
                    {s.modulo === 'paginas'
                        ? 'Vale para o registro da página de onde o processo nasceu (ou o único dela ligado a ele). O registro muda de coluna no quadro da página e a mudança fica no histórico dele. As regras da página continuam valendo: se ela exige um campo preenchido ou a aprovação de outra pessoa, o registro fica onde está e a equipe é avisada no processo.'
                        : 'Vale para a consulta ou o expediente de onde o processo nasceu (ou o único ligado a ele). A mudança aparece no quadro do módulo, com a data do dia, e fica no histórico do registro. Na pasta é o arquivamento. Quem assume vira o responsável quando a situação é Em elaboração.'}
                    {' '}Na autuação o registro fica como está: a regra da primeira fase vale quando alguém assume ou quando o processo volta para ela.
                </p>
            </fieldset>
        </div>
    );
}
