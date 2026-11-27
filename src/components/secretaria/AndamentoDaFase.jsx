import React, { useContext } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { MODULOS_SITUACAO, comPapelNaMinuta, comRegistroConduzido, comSituacao, nomeDoRegistro, papelNaMinuta, situacoesDaRegra, valorDaRegra } from '@/lib/andamentoFase';
import { comAoEntrar } from '@/lib/efeitosFase';
import { QUEM, comPermissao } from '@/lib/permissoesFase';
import { CampoAtribuicao } from './PermissoesDaFase';
import { RegistroContexto } from './SeletorRegistro';

const campo = 'h-9 w-full rounded-md border border-input bg-transparent dark:bg-slate-900 px-2 text-sm';
const caixa = 'flex min-h-[2.75rem] sm:min-h-0 items-start gap-2 text-sm';
const dica = 'block text-xs text-slate-600 dark:text-slate-400';

const PAPEIS = [
    ['', 'Não', 'A fase trata os documentos do jeito comum: quem tem o processo redige, assina e junta um a um. Se chegar minuta de outra pessoa, continuam valendo Aprovar e juntar e Devolver para correção.'],
    ['elaboracao', 'Elaboração: aqui se redige a minuta',
        'Para quem redige e não decide (assessoria, analista). Tudo o que a pessoa redige ou anexa entra como minuta, com o selo Minuta: nesta fase ninguém assina nem junta aos autos. A ação que pede documento se cumpre com a minuta. Ao concluir, as minutas e os anexos seguem com o processo para quem aprova.'],
    ['aprovacao', 'Aprovação: aqui se aprova a minuta ou se devolve para correção',
        'Para quem decide. A pessoa lê, pode alterar o texto (a redação original fica guardada em Versões) e escolhe: Aprovar e juntar, que torna a minuta documento definitivo dos autos, ou Devolver para correção, que manda o processo de volta a quem redigiu, com o que precisa mudar. O botão Finalizar junta de uma vez o que foi aprovado, na ordem escolhida, e deixa de fora os anexos que não devem entrar.'],
];

/**
 * Papel da fase na minuta: nenhum, elaboração (só se redige) ou aprovação
 * (aprovar e juntar ou devolver para correção). São as marcas `elaboracao` e
 * `juntada_conjunta` do rito, ditas pelo que o usuário quer fazer.
 */
export function MinutaDaFase({ f, mudar }) {
    const papel = papelNaMinuta(f);
    const pm = f.permissoes || {};
    const setPm = (parte) => mudar({ permissoes: comPermissao(pm, parte) });
    return (
        <fieldset className="space-y-2">
            <legend className="text-xs font-medium mb-1">Esta fase tem papel na minuta?</legend>
            {PAPEIS.filter(([id]) => id !== 'elaboracao' || !f.final).map(([id, rotulo, ajuda]) => (
                <label key={id} className={caixa}>
                    <input type="radio" name={`minuta-${f.id}`} className="mt-1" checked={papel === id} onChange={() => mudar(comPapelNaMinuta(id))} />
                    <span>{rotulo}<span className={dica}>{ajuda}</span></span>
                </label>
            ))}
            {papel !== 'elaboracao' && (
                <div className="sm:max-w-md">
                    <Label htmlFor={`ap-${f.id}`} className="text-xs">Quem aprova a minuta nesta fase (junta aos autos ou devolve para correção)</Label>
                    <select id={`ap-${f.id}`} value={pm.aprovar || ''} className={campo}
                        onChange={(e) => setPm({ aprovar: e.target.value, aprovar_atribuicao: e.target.value === 'atribuicao' ? pm.aprovar_atribuicao || '' : undefined })}>
                        {QUEM.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    {pm.aprovar === 'atribuicao' && <CampoAtribuicao id={`apa-${f.id}`} value={pm.aprovar_atribuicao} onChange={(v) => setPm({ aprovar_atribuicao: v })} />}
                    <span className={dica}>
                        Sem reserva, aprova quem estiver lotado na unidade que tem o processo. Se quem redige e quem decide ficam na mesma unidade, reserve a aprovação a quem decide: os demais leem, editam e anexam, mas não juntam nem devolvem.
                        Para o processo chegar à pessoa certa, use também "Designar como responsável" em "Prazo, nome para as partes e ao entrar". A administração do Processo Eletrônico sempre pode.
                    </span>
                </div>
            )}
            <p className={dica}>
                O motivo da devolução fica só com a equipe (na minuta e num registro interno): não vai aos autos nem às partes. Corrigida a minuta, quem redigiu envia o processo de novo e ela volta para a aprovação com o pedido à vista.
                {papel === 'elaboracao' && !f.rotulo_concluir ? ' Dica: em "Prazo, nome para as partes e ao entrar", dê ao botão que conclui a fase um nome como "Enviar para aprovação".' : ''}
            </p>
        </fieldset>
    );
}

/**
 * O que a fase faz sozinha no andamento: seguir quando o que ela exige (ação
 * ou documento obrigatório) é cumprido, arquivar ao entrar e conduzir o registro
 * ligado ao processo (consulta, expediente ou registro de uma página própria).
 * `ligadas`: integrações com outros módulos.
 */
export default function AndamentoDaFase({ f, mudar, ligadas, primeira = false }) {
    const { paginas } = useContext(RegistroContexto);
    const ae = f.ao_entrar || {};
    const s = f.situacao_registro || {};
    // Fase que arquiva não designa responsável nem abre pendência: as duas escolhas saem.
    const setArquivar = (v) => mudar({ ao_entrar: comAoEntrar(f, { arquivar: v }) });
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
    const parada = !!f.final || !!f.espera;
    return (
        <div className="space-y-3">
            <label className={caixa}>
                <Checkbox className="mt-0.5" checked={f.segue_ao_assumir === true && !parada} disabled={parada}
                    onCheckedChange={(c) => mudar({ segue_ao_assumir: c === true ? true : undefined })} />
                <span>Seguir sozinha quando alguém assumir o processo
                    <span className={dica}>
                        {parada
                            ? 'Fase final ou de espera não segue ao ser assumida.'
                            : 'Para a fase em que o processo só aguarda um responsável (por exemplo, Pendente). Quando alguém usa Assumir, ou o gestor distribui o processo a uma pessoa, ele vai na hora para a fase seguinte, com essa pessoa como responsável. Vale quando a fase tem uma só saída e a fase seguinte corre na mesma unidade; se algo obrigatório ficar em aberto, o processo espera pelo botão.'}
                    </span>
                </span>
            </label>
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
            <p className={dica}>Elaboração e aprovação de minuta ficam na seção acima, "Minuta: elaboração e aprovação".</p>
            <fieldset className="space-y-2">
                <legend className="text-xs font-medium">Registro ligado ao processo (consulta, expediente, parceria ou página própria)</legend>
                {modulos.length === 0 && dasPaginas.length === 0 && !orfa ? (
                    <p className={dica}>Para a fase mudar a situação de uma consulta, de um expediente, de uma parceria ou do registro de uma página própria, ligue a integração com o módulo em Integrações com outros módulos.</p>
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
                {s.modulo && primeira && (
                    <label className={caixa}>
                        <Checkbox id={`sn-${f.id}`} className="mt-0.5" checked={s.na_autuacao === true} onCheckedChange={(c) => setSit({ na_autuacao: c === true })} />
                        <span>Valer já na autuação
                            <span className={dica}>O processo nasce nesta fase: ao autuar, {nomeDoRegistro(s, paginas)} já vai para a situação escolhida (ou a de quem assume, se a fase designa o responsável). Sem marcar, o registro fica como está até alguém assumir ou o processo voltar a esta fase.</span>
                        </span>
                    </label>
                )}
                <p className={dica}>
                    {s.modulo === 'paginas'
                        ? 'Vale para o registro da página de onde o processo nasceu (ou o único dela ligado a ele). O registro muda de coluna no quadro da página e a mudança fica no histórico dele. As regras da página continuam valendo: se ela exige um campo preenchido ou a aprovação de outra pessoa, o registro fica onde está e a equipe é avisada no processo.'
                        : s.modulo === 'parcerias'
                            ? 'Vale para a parceria de onde o processo nasceu (ou a única ligada a ele), com as regras do quadro de Parcerias: as datas da fase se preenchem sozinhas e quem assume vira o responsável em Em análise; se faltar um campo que a fase exige (pasta na rede, remetido para, dados da formalização), a parceria fica onde está e a equipe é avisada no processo. Parceria formalizada não volta pelo rito, e a extinção continua sendo feita no módulo.'
                            : 'Vale para a consulta ou o expediente de onde o processo nasceu (ou o único ligado a ele). A mudança aparece no quadro do módulo, com a data do dia, e fica no histórico do registro. Na pasta é o arquivamento. Quem assume vira o responsável quando a situação é Em elaboração.'}
                    {' '}Sem "Valer já na autuação", na autuação o registro fica como está: a regra da primeira fase vale quando alguém assume ou quando o processo volta para ela.
                </p>
            </fieldset>
        </div>
    );
}
