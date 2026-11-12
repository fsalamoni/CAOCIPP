import React from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DadosCampos } from './CamposProcesso';
import { POLOS, STATUS_ROTULO, SeloUrgente, dataHora, rotuloOrigem } from './comum';
import { ROTULO_DESTINO } from '@/lib/exigencias';

// Capa do processo: só informação, igual para todos os perfis, sem nenhum
// botão de ato (intimar, juntar, tramitar ficam no Andamento). O que entra e
// por quê está em docs/LOGICA_PROCESSUAL.md, seção 4.

const diasDesde = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const textoFolhas = (f) => (f ? (f[1] > f[0] ? `fls. ${f[0]}–${f[1]}` : `fl. ${f[0]}`) : null);

function Item({ rotulo, children, largo = false }) {
    return (
        <div className={largo ? 'sm:col-span-2' : ''}>
            <dt className="text-xs text-slate-600 dark:text-slate-400">{rotulo}</dt>
            <dd className="text-sm text-slate-900 dark:text-slate-100 break-words">{children || <span className="text-slate-600 dark:text-slate-400">Não informado</span>}</dd>
        </div>
    );
}

function Bloco({ titulo, children, className = '' }) {
    return (
        <Card className={className}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

function Parte({ x }) {
    return (
        <li className="py-1.5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{x.nome}</span>
                <span className="text-slate-600 dark:text-slate-400">{POLOS[x.polo] || x.polo}{x.documento ? ` · ${x.documento}` : ''}</span>
                {x.portal === 'ativo' && <Badge variant="secondary">Acompanha pelo portal</Badge>}
            </div>
            {(x.representantes || []).length > 0 && (
                <p className="text-xs text-slate-600 dark:text-slate-400 pl-3 border-l-2 border-slate-200 dark:border-slate-700 mt-1">
                    Representada por {x.representantes.map((r) => r.nome).join(', ')}
                </p>
            )}
        </li>
    );
}


export default function CapaProcesso({ p, movimentos, informacoes = [], estado, nomeUnidade, cadeiaQuebradaEm, onLer, onVerEventos }) {
    const responsavel = p.responsavel_uid ? estado.membros.find((m) => m.uid === p.responsavel_uid)?.nome : null;
    const requerentes = p.partes.filter((x) => x.polo === 'requerente');
    const ordemPolo = Object.keys(POLOS);
    const partes = [...p.partes].sort((a, b) => ordemPolo.indexOf(a.polo) - ordemPolo.indexOf(b.polo));
    const unidadeAutuacao = p.unidade_autuacao ? nomeUnidade(p.unidade_autuacao) : null;
    const dias = diasDesde(p.recebido_em);
    const atos = movimentos.filter((m) => m.origem === 'usuario');
    const outros = movimentos.filter((m) => m.origem !== 'usuario' && m.dados?.oculto !== true).length;

    return (
        <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
                <Bloco titulo="Identificação">
                    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                        <Item rotulo="Número"><span className="font-mono">{p.numero}</span></Item>
                        <Item rotulo="Tipo de processo">{p.tipo_nome}</Item>
                        <Item rotulo="Assunto" largo>{p.assunto}</Item>
                        <Item rotulo="Rito">{p.rito_nome}</Item>
                        <Item rotulo="Autuado em">{dataHora(p.autuado_em)}{p.autuado_por ? ` por ${p.autuado_por}` : ''}</Item>
                        {p.descricao && <Item rotulo="Descrição" largo><span className="whitespace-pre-wrap">{p.descricao}</span></Item>}
                    </dl>
                    <DadosCampos campos={p.campos} className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800" />
                </Bloco>

                <Bloco titulo="Origem e quem solicitou">
                    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                        <Item rotulo="Origem">{p.origem ? rotuloOrigem(p.origem.tipo) : null}</Item>
                        <Item rotulo="Unidade de autuação">{unidadeAutuacao}</Item>
                        {p.origem?.descricao && <Item rotulo="Referência" largo>{p.origem.descricao}</Item>}
                        <Item rotulo="Quem solicitou" largo>
                            {requerentes.length > 0
                                ? requerentes.map((x) => `${x.nome}${(x.representantes || []).length ? ` (representado por ${x.representantes.map((r) => r.nome).join(', ')})` : ''}`).join('; ')
                                : p.origem?.tipo === 'de_oficio' ? `De ofício${unidadeAutuacao ? `, por ${unidadeAutuacao}` : ''}` : null}
                        </Item>
                    </dl>
                </Bloco>

                <Bloco titulo="Tramitação">
                    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                        <Item rotulo="Situação">{STATUS_ROTULO[p.status]}</Item>
                        <Item rotulo="Fase">{p.fase_nome}</Item>
                        <Item rotulo="Com">{nomeUnidade(p.unidade_atual)}{dias != null ? ` · ${dias === 0 ? 'desde hoje' : `há ${plural(dias, 'dia', 'dias')}`}` : ''}</Item>
                        <Item rotulo="Responsável">{responsavel || 'Ninguém designado'}</Item>
                        <Item rotulo="Urgência">
                            {p.urgente
                                ? <span className="inline-flex flex-wrap items-center gap-2"><SeloUrgente motivo={p.urgencia?.motivo} /> {p.urgencia?.motivo}</span>
                                : 'Não'}
                        </Item>
                        <Item rotulo="Sigilo">{p.sigilo === 'restrito' ? 'Restrito: só as unidades por onde passou e a administração' : 'Normal: visível à equipe do órgão'}</Item>
                    </dl>
                </Bloco>

                {informacoes.length > 0 && (
                    <Bloco titulo="Informações registradas no andamento" className="md:col-span-2">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Dados que as ações do rito pediram, na ordem em que foram registrados.</p>
                        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                            {informacoes.map((i) => (
                                <div key={i.seq}>
                                    <dt className="text-xs text-slate-600 dark:text-slate-400">{i.rotulo} <span className="whitespace-nowrap">· {i.fase_nome}</span></dt>
                                    <dd className="text-sm text-slate-900 dark:text-slate-100 break-words whitespace-pre-wrap">{i.valor_texto}</dd>
                                    <dd className="text-xs text-slate-600 dark:text-slate-400">{i.por}, {dataHora(i.em)} · {ROTULO_DESTINO[i.destino]}{i.visivel_partes ? ' · partes veem' : ''}</dd>
                                </div>
                            ))}
                        </dl>
                    </Bloco>
                )}

                <Bloco titulo={`Partes (${p.partes.length})`}>
                    {partes.length
                        ? <ul className="divide-y divide-slate-100 dark:divide-slate-800">{partes.map((x, i) => <Parte key={i} x={x} />)}</ul>
                        : <p className="text-sm text-slate-600">Nenhuma parte cadastrada.</p>}
                </Bloco>
            </div>

            <Bloco titulo="Cronologia dos autos">
                {atos.length === 0 && <p className="text-sm text-slate-600">Nenhum ato registrado nos autos.</p>}
                <ol className="space-y-3">
                    {atos.map((m) => (
                        <li key={m.seq} className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-3">
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                                {dataHora(m.em)} · {m.autor_nome}{m.unidade_id ? ` · ${nomeUnidade(m.unidade_id)}` : ''}{m.folhas ? ` · ${textoFolhas(m.folhas)}` : ''}
                            </p>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {m.documento_id
                                    ? <button type="button" className="text-left hover:underline" onClick={() => onLer(m.documento_id)}>{m.titulo}</button>
                                    : m.titulo}
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300">{m.descricao}</p>
                        </li>
                    ))}
                </ol>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-sm">
                    {cadeiaQuebradaEm === null
                        ? <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><ShieldCheck className="w-4 h-4" aria-hidden /> Integridade dos {plural(movimentos.length, 'evento', 'eventos')} conferida</span>
                        : <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400"><ShieldAlert className="w-4 h-4" aria-hidden /> Cadeia quebrada no evento {cadeiaQuebradaEm}</span>}
                    {outros > 0 && <Button variant="link" size="sm" className="h-auto p-0" onClick={onVerEventos}>Mais {plural(outros, 'registro', 'registros')} internos e do sistema na aba Eventos</Button>}
                </div>
            </Bloco>
        </div>
    );
}
