import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { resumoAndamento } from '@/lib/andamentoFase';
import { DESTINO_INFO, NIVEIS, PEDIDOS, resumoDaAcao, textoCondicao } from '@/lib/exigencias';
import { ritoConsultas } from '@/lib/secretariaRito';
import FluxoRito from './FluxoRito';

// Guia prático do editor de rito: o que é cada peça, como montar e o que cada
// opção faz. Os nomes das opções vêm das mesmas listas do editor
// (lib/exigencias), para o guia nunca falar de um rótulo que a tela não tem.

// O exemplo do guia é o modelo pronto "Rito Consultas CAOCIPP": o que o guia
// mostra é o que o editor cria ao escolher o modelo.
const CONSULTAS = ritoConsultas();

/** Fase de exemplo (a Recebimento do modelo), desenhada pelo mesmo componente do editor. */
export const EXEMPLO_GUIA = [
    { ...CONSULTAS.fases[0], id: 'g1', raia: 'Secretaria', proximas: ['g2'] },
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
                            <p>No exemplo, registrar no SIM, informar o solicitante e juntar a cópia da comunicação só valem quando a consulta não chegou pelo SIM. Quem veio pelo SIM segue pelo caminho do "não" e pula as três.</p>
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
                        <Parte titulo="8. Andamento automático da fase">
                            <p>Em <strong>Andamento automático</strong>, a fase pode andar sem que ninguém precise lembrar do passo seguinte.</p>
                            <ul className="space-y-1.5">
                                <Termo nome="Seguir sozinha">Cumprido o último item obrigatório da fase (uma ação marcada, um documento juntado ou guardado), o processo vai para a próxima fase. Se ela corre em outra unidade, ele é enviado para lá no mesmo ato. Com o botão Finalizar, segue depois do último documento. Com mais de uma saída, a fase segue quando a resposta de uma ação indicar uma só. Minutas não seguem junto: se quem envia precisa escolher as que acompanham o processo, deixe a fase terminar pelo botão. Se ainda faltar algo exigido, nada acontece e o botão Concluir continua na tela.</Termo>
                                <Termo nome="Arquivar ao entrar">Para a última fase do rito. O processo é arquivado assim que chega nela, com quem fez e a data nos autos.</Termo>
                                <Termo nome="Registro ligado ao processo">A fase diz em que coluna do quadro de Consultas (ou de Expedientes) o registro fica quando o processo entra nela e quando alguém assume o processo. Vale para o registro de onde o processo nasceu, ou para o único ligado a ele. Na autuação o registro fica como está: a regra da primeira fase vale quando alguém assume ou quando o processo volta para ela.</Termo>
                                <Termo nome="Página própria">Se o órgão tem páginas próprias (quadros criados por ele, como Contratos ou Atendimentos), a fase também pode conduzir o registro de uma delas: escolha a página em <strong>A fase conduz</strong> e as colunas dela aparecem como situações. As regras da página continuam valendo. Se ela exige um campo preenchido ou a aprovação de outra pessoa para mudar de coluna, o registro fica onde está, o processo segue e a equipe vê o motivo no processo.</Termo>
                                <Termo nome="Assumir">Na tela do processo, quem é da unidade vê o botão <strong>Assumir</strong> enquanto o processo não tem responsável. Onde esse registro fica, você escolhe em Registros, na linha "Atribuir a uma pessoa".</Termo>
                            </ul>
                            <p>O que a fase faz sozinha fica num registro só da equipe, nos eventos do processo. Quando o processo não tem consulta ligada, o registro diz isso e nada muda no quadro.</p>
                            <table className={tabela}>
                                <thead><tr><th>Fase do exemplo</th><th>Ao entrar, a consulta fica</th><th>Outras regras</th></tr></thead>
                                <tbody>
                                    <tr><td>Recebimento</td><td>Não muda</td><td>Segue sozinha</td></tr>
                                    <tr><td>Análise</td><td>Pendente</td><td>Ao assumir: Em elaboração</td></tr>
                                    <tr><td>Revisão</td><td>Em revisão</td><td></td></tr>
                                    <tr><td>Devolução</td><td>Revisadas</td><td>Segue sozinha</td></tr>
                                    <tr><td>Arquivamento</td><td>Na pasta</td><td>Arquiva ao entrar</td></tr>
                                    <tr><td>Diligências externas</td><td>Aguarda retorno de terceiros</td><td>Fase de espera; volta sozinha</td></tr>
                                </tbody>
                            </table>
                        </Parte>
                        <Parte titulo="9. Fase de espera (diligências externas)">
                            <p>Às vezes o trabalho de uma fase para à espera de alguém de fora: um ofício a outro órgão, uma informação pedida a terceiros. Para isso existe a <strong>fase de espera</strong>: o processo entra nela, aguarda e <strong>volta para a fase de onde veio</strong>, que é retomada como estava.</p>
                            <ol className="list-decimal space-y-1.5 pl-5">
                                <li>Crie a fase (ex.: Diligências externas) e, em <strong>Encaminhamentos</strong>, marque <strong>Fase de espera</strong>. Ela não tem saídas próprias.</li>
                                <li>Nas fases em que a espera pode acontecer (ex.: Análise e Revisão), em Encaminhamentos, acrescente a fase de espera como <strong>alternativa</strong>.</li>
                                <li>Na fase de espera, cadastre as ações que registram a ida e a volta (ex.: Registrar a remessa, com data e destinatário; Registrar o retorno, com data). Escolha onde cada uma fica em <strong>Onde fica o cumprimento</strong>.</li>
                            </ol>
                            <ul className="space-y-1.5">
                                <Termo nome="Na tela do processo">A fase que leva à espera mostra o botão <strong>Aguardar</strong>. Na espera, o botão principal é <strong>Encerrar a espera e voltar</strong>.</Termo>
                                <Termo nome="Nada se perde">Ir para a espera não conclui a fase: o que falta nela não precisa de dispensa, e o que já foi cumprido continua cumprido na volta. Quem respondia pelo processo continua respondendo.</Termo>
                                <Termo nome="Onde fica o registro">A ida e a volta seguem a regra de <strong>Registros</strong> das duas fases. Para não gerar evento impresso, deixe a entrada e a saída da fase de espera como informação.</Termo>
                                <Termo nome="Consulta ligada">Em Andamento automático, a fase de espera pode pôr a consulta em <em>Aguarda retorno de terceiros</em>. Na volta, vale a situação da fase de origem (a de quem assumiu, se o processo tem responsável).</Termo>
                                <Termo nome="Voltar sozinha">Com <strong>Seguir sozinha</strong> marcada, a espera termina quando o último item obrigatório (ex.: Registrar o retorno) é cumprido.</Termo>
                            </ul>
                            <p>A fase de espera não pode ser a primeira nem a final. O prazo automático da fase de origem é encerrado na ida e reaberto inteiro na volta.</p>
                        </Parte>
                        <Parte titulo="10. Revisão: minuta original e botão Finalizar">
                            <p>Quando uma unidade redige e outra revisa (ex.: a assessoria escreve a minuta e o gabinete a corrige e assina), duas coisas ajudam: a <strong>redação original fica guardada</strong> e a fase pode terminar com o botão <strong>Finalizar</strong>.</p>
                            <ul className="space-y-1.5">
                                <Termo nome="A minuta segue com o processo">Ao enviar o processo para a unidade da revisão, quem envia escolhe as minutas e os anexos que vão junto. Quem recebe pode editar a minuta.</Termo>
                                <Termo nome="Redação original guardada">Sempre que outra pessoa altera a minuta, o texto de quem escreveu antes fica guardado em <strong>Versões</strong>, ao lado do documento. Não é preciso configurar nada. Só a equipe vê as versões; elas não vão aos autos nem ao portal das partes, e continuam lá depois da juntada.</Termo>
                                <Termo nome="Botão Finalizar">Na fase da revisão, em <strong>Andamento automático</strong>, marque <strong>Botão Finalizar</strong>. Na tela do processo aparece "Finalizar (nome da fase)": quem tem o processo escolhe quais minutas e anexos entram nos autos, põe na ordem, anexa o que faltar, assina e junta tudo de uma vez.</Termo>
                                <Termo nome="O que entra e o que fica">Os documentos escolhidos são juntados na ordem da lista e formam o evento da fase, que sai na impressão. O que não for escolhido continua como minuta ou é guardado fora dos autos, à vista da equipe.</Termo>
                                <Termo nome="Depois de finalizar">A tela já abre o passo seguinte da fase (ex.: Concluir e enviar para a Secretaria). Para a consulta ficar <em>Revisadas</em>, use a situação "ao entrar" da fase seguinte.</Termo>
                            </ul>
                            <p>Arquivo enviado (PDF, Word) não se edita no sistema, então não tem versões: o original é o próprio arquivo. Minuta já assinada também não se edita.</p>
                        </Parte>
                        <Parte titulo="11. Impressão interna (o que fica fora dos autos)">
                            <p>Nem tudo o que o rito registra vai para os autos: a remessa que ficou só no sistema, o dado guardado como informação, a minuta, o documento guardado fora dos autos. Isso não sai no PDF dos autos, mas a equipe pode imprimir quando precisar, pela <strong>Impressão interna</strong>.</p>
                            <ul className="space-y-1.5">
                                <Termo nome="Onde fica">Na tela do processo, no menu de três pontos e na aba Autos, ao lado de PDF dos autos.</Termo>
                                <Termo nome="O que pode sair">Registros internos e do sistema (um a um), minutas que a sua unidade vê, documentos guardados fora dos autos e as redações anteriores de qualquer documento. Só sai o que for marcado.</Termo>
                                <Termo nome="Como sai">Um PDF de uso da equipe, sem folhas dos autos, com a marca de uso interno em toda página. Não é cópia do processo e não deve ser entregue às partes.</Termo>
                                <Termo nome="O que nunca sai">O que o rito marcou como <strong>sem evento</strong> não sai em impressão nenhuma. Dado reservado a quem gere a unidade continua sem o valor.</Termo>
                            </ul>
                            <p>Por isso, uma fase só de trabalho interno (ex.: Análise, Diligências externas) pode ficar inteira como informação: nada dela entra nos autos, e ainda assim pode ser impressa para uso interno, por seleção.</p>
                        </Parte>
                        <Parte titulo="12. Exemplo completo: o Rito Consultas CAOCIPP">
                            <p>O modelo <strong>{CONSULTAS.nome}</strong> está em <strong>Novo rito</strong>, em "Começar sem arquivo". Ele vem com as seis fases configuradas e usa o que este guia explica. Escolha o modelo, confira as unidades, ajuste o que for diferente no seu órgão e implante.</p>
                            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2">
                                <FluxoRito acoes fases={CONSULTAS.fases} alturaMaxima="none" />
                            </div>
                            <p className="font-semibold text-slate-900 dark:text-white">Antes de usar</p>
                            <ul className="space-y-1.5">
                                <Termo nome="Integração com Consultas">Precisa estar ligada em "Integrações com outros módulos". Sem ela, o editor aponta a pendência e não deixa implantar.</Termo>
                                <Termo nome="Consulta ligada ao processo">O rito conduz a situação da consulta, mas não cria a consulta: o processo precisa nascer de uma consulta ou ter uma ligada a ele.</Termo>
                                <Termo nome="Unidades">Secretaria, Assessoria e Gabinete são casadas pelo nome com as unidades do órgão. A que não existir é proposta para criação. Com outros nomes, troque a unidade em cada fase.</Termo>
                                <Termo nome="Tipo de documento Parecer">É por ele que a Revisão reconhece o parecer juntado. Ele já vem no sistema; a minuta precisa ser criada com esse tipo.</Termo>
                                <Termo nome="A Análise termina pelo botão">Quem envia escolhe as minutas e os anexos que seguem com o processo para o Gabinete. As outras fases seguem sozinhas: a Revisão, quando o Finalizar junta o parecer.</Termo>
                            </ul>
                            {CONSULTAS.fases.map((f) => (
                                <section key={f.id} className="space-y-1.5 border-t border-slate-200 dark:border-slate-700 pt-2">
                                    <h4 className="font-semibold text-slate-900 dark:text-white">{f.nome} ({f.unidade || 'na unidade em que o processo estiver'})</h4>
                                    <p>{f.orientacao}</p>
                                    {resumoAndamento(f).length > 0 && <p><strong>Andamento automático:</strong> {resumoAndamento(f).join('; ')}.</p>}
                                    {f.registro_atos && <p><strong>Registros:</strong> entrada, saída, remessas e demais atos da fase ficam só no sistema.</p>}
                                    {f.acoes && (
                                        <table className={tabela}>
                                            <thead><tr><th>Ação</th><th>O que faz</th><th>Quando vale</th></tr></thead>
                                            <tbody>
                                                {f.acoes.map((a, i) => (
                                                    <tr key={a}><td>{a}</td><td>{resumoDaAcao(f.acoes_regras[i])}</td><td>{f.acoes_regras[i].se ? `Se ${textoCondicao(f, f.acoes_regras[i].se)}` : 'Sempre'}</td></tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </section>
                            ))}
                        </Parte>
                        <Parte titulo="13. Use tudo isso no seu rito">
                            <p>Nada do exemplo é exclusivo dele. Cada recurso é uma opção do editor e vale para qualquer rito, de qualquer procedimento. Para aproveitar o que já está pronto, há três caminhos: em <strong>Novo rito</strong>, partir do modelo Rito Consultas CAOCIPP e trocar nomes, unidades e ações; no menu de um rito já implantado, <strong>Duplicar</strong>; ou, dentro de um rito, <strong>Copiar fases de outro rito</strong>.</p>
                            <table className={tabela}>
                                <thead><tr><th>O que o exemplo faz</th><th>Onde ligar no seu rito</th></tr></thead>
                                <tbody>
                                    <tr><td>Formulário cujos dados formam a folha de dados (evento 1 do PDF)</td><td>Na ação: <strong>O que pede</strong>, "Um formulário (vários campos)", e marque <strong>Entra na folha de dados do processo</strong>. Vale também para um dado só (texto, número, data, lista)</td></tr>
                                    <tr><td>Ação que só vale conforme uma resposta (ex.: só se não veio pelo SIM)</td><td>Na ação: <strong>Quando vale</strong>. A resposta pode ser de uma ação de escolha ou de um campo de lista ou sim/não de um formulário</td></tr>
                                    <tr><td>Passo que só orienta, sem marcar</td><td>Na ação: <strong>O que pede</strong>, "Nada: só orienta (não se marca)"</td></tr>
                                    <tr><td>Anotação da equipe que não gera evento</td><td>Na ação: <strong>Onde fica o cumprimento</strong>, "Sem evento (registro oculto)" ou "Só no sistema (não imprime)"</td></tr>
                                    <tr><td>Fase inteira fora dos autos (análise, diligências)</td><td>Em <strong>Registros, certidão conjunta e documentos</strong>: "Entrar e sair da fase", "Remessas entre unidades durante a fase" e "Outros atos durante a fase" em "Só no sistema"</td></tr>
                                    <tr><td>Documento exigido, reconhecido pelo tipo (ex.: Parecer)</td><td>Na ação: <strong>O que pede</strong>, um documento, com o <strong>Tipo de documento</strong>; ou em "Documentos da fase". "Para a fase seguir" diz se é obrigatório, recomendado ou opcional</td></tr>
                                    <tr><td>Seguir sozinha, arquivar ao entrar, botão Finalizar</td><td>Em <strong>Andamento automático</strong>, uma caixa para cada um</td></tr>
                                    <tr><td>Conduzir a consulta ligada (a coluna dela no quadro muda com o processo)</td><td>Em <strong>Andamento automático</strong>, "A fase conduz": Consulta, Expediente ou uma página própria do órgão, com a situação ao entrar e quando alguém assume</td></tr>
                                    <tr><td>Fase de espera que volta para a fase de origem (diligências externas)</td><td>Em <strong>Encaminhamentos</strong>: "Fase de espera". Nas fases que podem aguardar, indique a espera como uma das saídas</td></tr>
                                    <tr><td>Fases em unidades diferentes (Secretaria, Assessoria, Gabinete)</td><td>No cabeçalho de cada fase, a unidade. Ao seguir, o processo é enviado para a unidade da fase seguinte</td></tr>
                                    <tr><td>Capa simples, botão Assumir, redação original guardada em Versões, Impressão interna</td><td>Não precisam de configuração: valem para todo processo</td></tr>
                                </tbody>
                            </table>
                            <p>O que o rito não faz sozinho: criar a consulta, o expediente ou o registro da página (o processo nasce de um registro ou é ligado a ele) e preencher o que os outros módulos pedem a mais nas suas fichas. Parcerias e Júri não são conduzidos pelo rito: as fases deles pedem dados próprios a cada passo, que só a ficha do módulo recebe.</p>
                        </Parte>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
