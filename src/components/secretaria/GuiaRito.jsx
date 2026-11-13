import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DESTINO_INFO, NIVEIS, PEDIDOS } from '@/lib/exigencias';
import FluxoRito from './FluxoRito';

// Guia prático do editor de rito: o que é cada peça, como montar e o que cada
// opção faz. Os nomes das opções vêm das mesmas listas do editor
// (lib/exigencias), para o guia nunca falar de um rótulo que a tela não tem.

/** Fase de exemplo, desenhada pelo mesmo componente do editor. */
export const EXEMPLO_GUIA = [
    {
        id: 'g1', nome: 'Recebimento', raia: 'Secretaria', prazo_dias: 2, proximas: ['g2'],
        acoes: ['Registrar os dados básicos', 'Registrar no SIM e converter em PGEA', 'Informar o solicitante', 'Conferir se há consulta anterior do mesmo órgão', 'Análise superficial'],
        acoes_regras: [
            { pede: 'formulario', obrigatoria: true, destino: 'informacao', folha_dados: true, campos: [{ id: 'orgao', rotulo: 'Órgão solicitante', tipo: 'texto' }, { id: 'assunto', rotulo: 'Assunto', tipo: 'texto' },
                { id: 'sistema', rotulo: 'Sistema utilizado', tipo: 'lista', opcoes: ['SIM', 'SPU', 'E-mail', 'Whatsapp', 'Outros'] }] },
            { pede: 'texto', rotulo: 'Número do PGEA', obrigatoria: true, destino: 'informacao', folha_dados: true, se: { acao: 0, campo: 'sistema', valores: ['SPU', 'E-mail', 'Whatsapp', 'Outros'] } },
            { pede: 'formulario', campos: [{ id: 'data', rotulo: 'Data', tipo: 'data' }, { id: 'meio', rotulo: 'Meio', tipo: 'texto' }], obrigatoria: true, destino: 'informacao', folha_dados: true, se: { acao: 0, campo: 'sistema', valores: ['SPU', 'E-mail', 'Whatsapp', 'Outros'] } },
            { pede: 'orientacao' },
            { pede: 'texto_longo', rotulo: 'Observações', destino: 'nenhum' },
        ],
    },
    { id: 'g2', nome: 'Análise', raia: 'Assessoria', proximas: ['g3', 'g4'], condicoes: { g3: 'minuta pronta', g4: 'falta informação' }, acoes: ['Redigir a minuta'], acoes_regras: [{ obrigatoria: true }] },
    { id: 'g3', nome: 'Revisão', raia: 'Gabinete', proximas: [], final: true },
    { id: 'g4', nome: 'Devolução', raia: 'Secretaria', proximas: [], final: true },
];

const QUANDO_USAR = {
    confirmar: 'A ação só precisa ser marcada como feita.',
    texto: 'Um dado curto, como o número do PGEA.',
    texto_longo: 'Um relato ou observação.',
    numero: 'Uma quantidade ou valor.',
    data: 'Quando algo aconteceu ou vai acontecer.',
    lista: 'Uma opção entre as que você define. Serve para criar desvios.',
    sim_nao: 'Uma decisão de sim ou não. Também serve para criar desvios.',
    registro: 'Ligar o processo a um registro de outro módulo, como uma consulta.',
    formulario: 'Vários dados de uma vez, cada um com o seu campo. Um campo de lista ou de sim ou não também serve para criar desvios.',
    documento: 'Uma peça redigida no órgão ou um arquivo recebido.',
    orientacao: 'Um lembrete a quem está na fase, ou uma ação que o nome da fase já diz. Ninguém marca e nada fica registrado.',
};

function Parte({ titulo, children, aberta = false }) {
    return (
        <details open={aberta} className="group rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <summary className="cursor-pointer select-none px-3 py-2.5 text-sm font-semibold text-slate-900 dark:text-white">{titulo}</summary>
            <div className="space-y-2 border-t border-slate-200 dark:border-slate-700 px-3 py-3 text-sm text-slate-700 dark:text-slate-200">{children}</div>
        </details>
    );
}

const Termo = ({ nome, children }) => <li><strong className="text-slate-900 dark:text-white">{nome}.</strong> {children}</li>;
const tabela = 'w-full text-left text-sm [&_td]:border-t [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_td]:py-1.5 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-1 [&_th]:pr-3 [&_th]:text-xs [&_th]:font-medium [&_th]:text-slate-600 dark:[&_th]:text-slate-300';

export default function GuiaRito({ variante = 'outline', className = '' }) {
    const [aberto, setAberto] = useState(false);
    return (
        <>
            <Button type="button" size="sm" variant={variante} className={`gap-1 ${className}`} onClick={() => setAberto(true)}>
                <BookOpen className="w-4 h-4" aria-hidden /> Guia do rito
            </Button>
            <Dialog open={aberto} onOpenChange={setAberto}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Guia do rito</DialogTitle>
                        <DialogDescription>O que é cada peça do rito, como montar um e o que cada opção do editor faz.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Parte titulo="1. As peças do rito" aberta>
                            <ul className="space-y-1.5">
                                <Termo nome="Fase">Etapa do processo. Tem unidade, prazo, ações e encaminhamentos. No desenho é a moldura com o nome no alto.</Termo>
                                <Termo nome="Ação">Uma coisa que alguém faz ou registra na fase. No desenho é a caixa azul dentro da moldura. A borda tracejada indica ação opcional. A caixa branca pontilhada é só orientação: ninguém marca.</Termo>
                                <Termo nome="Desvio (gateway)">Ponto de escolha, desenhado como losango. Dentro da fase, decide se uma ação vale. Na saída da fase, decide para qual fase o processo vai.</Termo>
                                <Termo nome="Início e fim">Círculo verde onde o processo é autuado e círculo vermelho onde termina.</Termo>
                                <Termo nome="Raia">Faixa horizontal de cada unidade. A fase fica na raia da unidade que cuida dela.</Termo>
                            </ul>
                            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2">
                                <FluxoRito acoes legenda fases={EXEMPLO_GUIA} alturaMaxima="none" />
                            </div>
                            <p>No exemplo, registrar no SIM e informar o solicitante só valem quando a consulta não chegou pelo SIM. Quem veio pelo SIM segue pelo caminho do "não" e pula as duas.</p>
                        </Parte>
                        <Parte titulo="2. Montar um rito, passo a passo">
                            <ol className="list-decimal space-y-1.5 pl-5">
                                <li>Dê nome ao rito e crie as fases em <strong>Adicionar fase</strong>, na ordem em que o processo anda.</li>
                                <li>Abra cada fase e escolha a <strong>Unidade</strong> que cuida dela. Se a fase tem prazo, informe os dias ao lado do nome.</li>
                                <li>Em <strong>Ações da fase</strong>, escreva uma ação por linha: o que precisa ser feito ou registrado ali.</li>
                                <li>Abra a ação para dizer o que ela pede, onde fica o cumprimento e se a fase depende dela para seguir.</li>
                                <li>Em <strong>Encaminhamentos</strong>, diga para onde o processo vai depois. Com mais de uma saída, o desenho ganha um desvio, e cada saída pode ter condição.</li>
                                <li>Resolva as pendências que o editor aponta, confira em <strong>Prévia</strong> como a equipe e as partes vão ver, e salve.</li>
                            </ol>
                            <p>O desenho do alto se monta sozinho a partir do que você preenche. Clique numa fase do desenho para abrir e ajustar.</p>
                        </Parte>
                        <Parte titulo="3. O que a ação pede">
                            <p>Nem toda ação precisa de um registro. Em <strong>O que pede</strong>, escolha:</p>
                            <table className={tabela}>
                                <thead><tr><th>Opção</th><th>Quando usar</th></tr></thead>
                                <tbody>{PEDIDOS.map(([k, rotulo]) => <tr key={k}><td className="font-medium whitespace-nowrap">{rotulo}</td><td>{QUANDO_USAR[k]}</td></tr>)}</tbody>
                            </table>
                        </Parte>
                        <Parte titulo="4. Onde fica o cumprimento">
                            <p>Em <strong>Onde fica o cumprimento</strong>, cada ação diz onde o seu registro aparece.</p>
                            <table className={tabela}>
                                <thead><tr><th>Opção</th><th>O que acontece</th></tr></thead>
                                <tbody>{Object.entries(DESTINO_INFO).map(([k, d]) => <tr key={k}><td className="font-medium whitespace-nowrap">{d.rotulo}</td><td>{d.frase}</td></tr>)}</tbody>
                            </table>
                            <p>As partes só veem o que você marcar em <strong>As partes veem no portal</strong>. Sem essa marca, o registro fica com a equipe.</p>
                            <p><strong>Folha de dados do processo.</strong> No PDF, a primeira página é a capa, só com o órgão, o número, a data da autuação e se o processo está ativo ou arquivado. A segunda é a folha de dados, que é a folha do evento 1: traz a autuação, o assunto, as partes e os dados do processo. Para um dado registrado depois (como o número do PGEA) aparecer ali, marque <strong>Entra na folha de dados do processo</strong> na ação. Ele completa a folha sem criar outra, e você ainda escolhe acima se a ação gera evento próprio.</p>
                        </Parte>
                        <Parte titulo="5. Ação que só vale em alguns casos (desvio)">
                            <ol className="list-decimal space-y-1.5 pl-5">
                                <li>Crie antes uma ação de escolha: <strong>Uma escolha numa lista</strong> ou <strong>Sim ou não</strong>. Também serve um <strong>formulário</strong> com um campo de lista ou de sim ou não.</li>
                                <li>Na ação que depende dela, em <strong>Quando vale</strong>, escolha de onde vem a resposta e marque as respostas que fazem a ação valer.</li>
                                <li>O desenho mostra um losango antes da ação, com a condição escrita.</li>
                            </ol>
                            <p>A ação condicional só aparece para a equipe, e só é cobrada, quando a resposta for uma das marcadas. A mesma regra serve para as saídas da fase, em <strong>Regra desta saída</strong>.</p>
                            <p>O campo de um formulário com dado reservado a quem gere a unidade não serve de condição, para a resposta não aparecer a quem não pode vê-la.</p>
                        </Parte>
                        <Parte titulo="6. Obrigatória, recomendada ou opcional">
                            <p>Em <strong>Para a fase seguir</strong>, escolha o peso da ação:</p>
                            <ul className="list-disc space-y-1 pl-5">{NIVEIS.map(([k, rotulo]) => <li key={k}>{rotulo}.</li>)}</ul>
                            <p><strong>Ações alternativas.</strong> Para "faça isto ou aquilo", abra a segunda ação e, em <strong>Alternativa a</strong>, escolha a primeira. Cumprida uma, a outra deixa de ser cobrada. No desenho aparece "ou" entre as duas.</p>
                        </Parte>
                        <Parte titulo="7. Quem cumpre e quem vê">
                            <ul className="space-y-1.5">
                                <Termo nome="Quem pode cumprir">Quem tem o processo, só o responsável designado ou só quem gere a unidade.</Termo>
                                <Termo nome="Quem vê o dado na equipe">Toda a equipe do processo ou só quem gere a unidade. Dado reservado nunca vai aos autos nem ao portal.</Termo>
                                <Termo nome="Orientação a quem cumpre">Texto curto que aparece abaixo da ação, na tela do processo.</Termo>
                            </ul>
                        </Parte>
                        <Parte titulo="8. Exemplo: a fase Recebimento de uma consulta">
                            <table className={tabela}>
                                <thead><tr><th>Ação</th><th>O que pede</th><th>Quando vale</th></tr></thead>
                                <tbody>
                                    <tr><td>Registrar os dados básicos</td><td>Um formulário: órgão solicitante, data de chegada, assunto, local dos fatos e sistema utilizado (lista: SIM, SPU, E-mail, Whatsapp, Outros). Só no sistema, na folha de dados</td><td>Sempre</td></tr>
                                    <tr><td>Registrar no SIM e converter em PGEA</td><td>Um texto curto: número do PGEA. Só no sistema, na folha de dados</td><td>Se o campo "Sistema utilizado" não for SIM</td></tr>
                                    <tr><td>Informar o solicitante</td><td>Um formulário: data e meio. Só no sistema, na folha de dados</td><td>Se o campo "Sistema utilizado" não for SIM</td></tr>
                                    <tr><td>Conferir se há consulta anterior do mesmo órgão</td><td>Nada: só orienta</td><td>Sempre</td></tr>
                                    <tr><td>Análise superficial</td><td>Um texto longo, sem evento, opcional</td><td>Sempre</td></tr>
                                </tbody>
                            </table>
                            <p>É a fase desenhada na parte 1. Use como ponto de partida e troque os nomes pelos do seu órgão.</p>
                        </Parte>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
