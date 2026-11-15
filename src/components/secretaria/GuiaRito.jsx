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
    comunicacao: 'Intimar, notificar ou citar as partes de um polo, com prazo e texto que o rito propõe. Cumpre-se expedindo pela própria ação (parte 15).',
    audiencia: 'Marcar audiência, oitiva, sessão de julgamento, reunião ou inspeção: data, hora, local ou link e quem participa. A designação vai aos autos (parte 15).',
    resposta: 'Esperar a defesa ou manifestação das partes comunicadas. Cumpre-se sozinha, com a resposta no prazo ou com o fim dele (parte 15).',
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

/** `inicial`: abre já aberto (link direto para o guia, na Central de Ajuda). */
export default function GuiaRito({ variante = 'outline', className = '', inicial = false }) {
    const [aberto, setAberto] = useState(inicial);
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
                            <p><strong>De onde a condição pode ler.</strong> A lista de <strong>Quando vale</strong> e de <strong>Regra desta saída</strong> oferece três origens:</p>
                            <ul className="list-disc space-y-1 pl-5">
                                <li><strong>Uma resposta desta fase.</strong> É o caso comum, descrito acima.</li>
                                <li><strong>Uma resposta dada em outra fase.</strong> Ex.: a Admissibilidade escolhe entre rito ordinário e sumário, e a Instrução só cobra a perícia no ordinário. A resposta vale como ficou quando o processo passou pela outra fase. Se ele ainda não passou por lá, a condição não vale.</li>
                                <li><strong>Um dado do processo.</strong> Urgente, sigilo, se tem partes e a origem. Quando mais de um tipo de processo usa o rito, também o tipo. Os campos de lista e de sim ou não do formulário do tipo aparecem aqui depois que um tipo de processo passa a usar o rito.</li>
                            </ul>
                            <p><strong>Mais de uma condição.</strong> O botão <strong>E também</strong> soma até três condições à primeira. Todas precisam valer ao mesmo tempo (ex.: "Resultado" for Procede <em>e</em> "Urgente" for Não). Para "ou", marque mais de uma resposta na mesma condição.</p>
                            <p><strong>Saída padrão (o "senão").</strong> Numa fase com mais de uma saída, em Encaminhamentos, <strong>Se nenhuma regra indicar outra saída</strong> diz por onde o processo segue quando nenhuma regra vale. No processo, essa saída aparece como a indicada. Com <strong>Seguir sozinha</strong> ligado, a fase vai por ela sem esperar o botão. Sem saída padrão, continua como sempre: a equipe escolhe.</p>
                            <p>A <strong>Prévia</strong> do rito simula tudo isso: as respostas dadas numa fase seguem valendo quando você anda para a seguinte, e os dados do processo que o rito lê aparecem para você trocar.</p>
                        </Parte>
                        <Parte titulo="6. Obrigatória, recomendada ou opcional">
                            <p>Em <strong>Para a fase seguir</strong>, escolha o peso da ação:</p>
                            <ul className="list-disc space-y-1 pl-5">{NIVEIS.map(([k, rotulo]) => <li key={k}>{rotulo}.</li>)}</ul>
                            <p><strong>Ações alternativas.</strong> Para "faça isto ou aquilo", abra a segunda ação e, em <strong>Alternativa a</strong>, escolha a primeira. Cumprida uma, a outra deixa de ser cobrada. No desenho aparece "ou" entre as duas.</p>
                        </Parte>
                        <Parte titulo="7. Quem cumpre e quem vê">
                            <ul className="space-y-1.5">
                                <Termo nome="Quem pode cumprir">Quem tem o processo, só o responsável designado, só quem gere a unidade ou só quem tem certa atribuição (ex.: Promotor). A atribuição é a que a pessoa tem na lotação, em Unidades, na unidade que estiver com o processo. Não conta acento nem maiúscula, mas o nome precisa ser o mesmo.</Termo>
                                <Termo nome="Quem vê o dado na equipe">Toda a equipe do processo ou só quem gere a unidade. Dado reservado nunca vai aos autos nem ao portal.</Termo>
                                <Termo nome="Orientação a quem cumpre">Texto curto que aparece abaixo da ação, na tela do processo.</Termo>
                            </ul>
                            <p>Cada fase também diz quem pratica os atos que mudam o andamento, em <strong>Quem pode nesta fase</strong>. Sem escolha, vale o de sempre: quem tem o processo, com motivo quando o ato pede.</p>
                            <ul className="space-y-1.5">
                                <Termo nome="Quem conclui a fase">Quem leva o processo a outra fase: quem tem o processo, só o responsável designado, só quem gere a unidade ou só quem tem certa atribuição. Ir para uma fase de espera não conclui e continua livre. Com <strong>Seguir sozinha</strong>, a fase só segue sozinha quando quem cumpre o último item pode concluí-la; senão fica o botão para quem pode.</Termo>
                                <Termo nome="Quem dispensa o que a fase exige">Por padrão, quem conclui a fase dispensa o que ficou em aberto, com motivo. Reservada a quem gere a unidade ou à administração, os demais precisam cumprir tudo para a fase seguir.</Termo>
                                <Termo nome="Quem segue por caminho fora do previsto">Vale para a fase que não é saída desta e para a saída sem a resposta que a regra dela pede. Por padrão, quem conclui, com motivo.</Termo>
                                <Termo nome="Quem arquiva, sobresta ou reativa">Enquanto o processo estiver na fase. O arquivamento que o rito faz sozinho ao entrar numa fase não depende disto.</Termo>
                            </ul>
                            <p>A administração do Processo Eletrônico sempre pode. Na tela do processo, a fase mostra o que está reservado, e quem não pode vê a quem o ato cabe antes de tentar. <strong>Aplicar a todas as fases</strong> copia as escolhas para o rito inteiro.</p>
                            <p>Dois atos não dependem do rito, e sim da <strong>unidade</strong> que está com o processo. Receber a conclusão e apreciar pendências e petições cabe à unidade que <strong>decide</strong>. Intimar, notificar e citar as partes cabe à unidade que <strong>expede</strong>. Por padrão, o gabinete decide e a secretaria expede. Para uma comissão processante, um pregoeiro ou um fiscal de contrato fazerem as duas coisas, marque as caixas <strong>Decide</strong> e <strong>Expede</strong> em Unidades, nos Dados da unidade, sob "Papel no processo".</p>
                        </Parte>
                        <Parte titulo="8. Andamento automático da fase">
                            <p>Em <strong>Andamento automático</strong>, a fase pode andar sem que ninguém precise lembrar do passo seguinte.</p>
                            <ul className="space-y-1.5">
                                <Termo nome="Seguir sozinha">Cumprido o último item obrigatório da fase (uma ação marcada, um documento juntado ou guardado), o processo vai para a próxima fase. Se ela corre em outra unidade, ele é enviado para lá no mesmo ato. Com o botão Finalizar, segue depois do último documento. Com mais de uma saída, a fase segue quando a resposta de uma ação indicar uma só. Minutas não seguem junto: se quem envia precisa escolher as que acompanham o processo, deixe a fase terminar pelo botão. Se ainda faltar algo exigido, nada acontece e o botão Concluir continua na tela.</Termo>
                                <Termo nome="Arquivar ao entrar">Para a última fase do rito. O processo é arquivado assim que chega nela, com quem fez e a data nos autos.</Termo>
                                <Termo nome="Registro ligado ao processo">A fase diz em que coluna do quadro de Consultas, de Expedientes ou de Parcerias o registro fica quando o processo entra nela e quando alguém assume o processo. Vale para o registro de onde o processo nasceu, ou para o único ligado a ele. Na primeira fase, marque <strong>Valer já na autuação</strong> para o registro mudar no momento em que o processo é autuado; sem isso, ele fica como está até alguém assumir ou o processo voltar para ela.</Termo>
                                <Termo nome="Parceria">A fase pode conduzir a parceria ligada pelas fases do quadro de Parcerias (Pendente, Em análise, Em revisão, Revisadas, Aguarda Terceiros, Parcerias), com as regras do módulo: as datas da fase se preenchem sozinhas, quem assume vira o responsável em Em análise e, se faltar um campo que a fase exige (pasta na rede, remetido para, dados da formalização), a parceria fica onde está e a equipe vê o motivo no processo. Parceria formalizada não volta pelo rito, e a extinção continua sendo feita no módulo.</Termo>
                                <Termo nome="Página própria">Se o órgão tem páginas próprias (quadros criados por ele, como Contratos ou Atendimentos), a fase também pode conduzir o registro de uma delas: escolha a página em <strong>A fase conduz</strong> e as colunas dela aparecem como situações. As regras da página continuam valendo. Se ela exige um campo preenchido ou a aprovação de outra pessoa para mudar de coluna, o registro fica onde está, o processo segue e a equipe vê o motivo no processo.</Termo>
                                <Termo nome="Registro criado na autuação">Quando o processo não nasce de um registro, o <strong>tipo de processo</strong> pode criá-lo: em Dados, marque <strong>Criar registro na autuação</strong> e escolha a página. É esse registro que a fase conduz, mesmo que outros da mesma página estejam ligados ao processo. Veja a parte 19.</Termo>
                                <Termo nome="Assumir">Na tela do processo, quem é da unidade vê o botão <strong>Assumir</strong> enquanto o processo não tem responsável. Onde esse registro fica, você escolhe em Registros, na linha "Atribuir a uma pessoa".</Termo>
                            </ul>
                            <p>O que a fase faz sozinha fica num registro só da equipe, nos eventos do processo. Quando o processo não tem consulta ligada, o registro diz isso e nada muda no quadro. Urgência, sigilo, responsável, pendência, avisos e prazos que a fase ajusta ao entrar estão na parte 14.</p>
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
                                    <tr><td>Caminho que depende do que foi decidido lá atrás (ex.: rito ordinário ou sumário, escolhido na admissibilidade)</td><td>Em <strong>Quando vale</strong> ou em <strong>Regra desta saída</strong>, escolha a resposta "na fase" em que ela foi dada</td></tr>
                                    <tr><td>Caminho que depende do processo (urgente, com partes, sigiloso, origem, tipo, campo do tipo)</td><td>Na mesma lista, as opções que começam por "Conforme o dado do processo"</td></tr>
                                    <tr><td>Regra com duas exigências ao mesmo tempo</td><td>Depois de marcar as respostas, o botão <strong>E também</strong></td></tr>
                                    <tr><td>Saída "senão" de um desvio, inclusive para a fase seguir sozinha por ela</td><td>Em <strong>Encaminhamentos</strong>: "Se nenhuma regra indicar outra saída"</td></tr>
                                    <tr><td>Passo que só orienta, sem marcar</td><td>Na ação: <strong>O que pede</strong>, "Nada: só orienta (não se marca)"</td></tr>
                                    <tr><td>Anotação da equipe que não gera evento</td><td>Na ação: <strong>Onde fica o cumprimento</strong>, "Sem evento (registro oculto)" ou "Só no sistema (não imprime)"</td></tr>
                                    <tr><td>Fase inteira fora dos autos (análise, diligências)</td><td>Em <strong>Registros, certidão conjunta e documentos</strong>: "Entrar e sair da fase", "Remessas entre unidades durante a fase" e "Outros atos durante a fase" em "Só no sistema"</td></tr>
                                    <tr><td>Documento exigido, reconhecido pelo tipo (ex.: Parecer)</td><td>Na ação: <strong>O que pede</strong>, um documento, com o <strong>Tipo de documento</strong>; ou em "Documentos da fase". "Para a fase seguir" diz se é obrigatório, recomendado ou opcional</td></tr>
                                    <tr><td>Seguir sozinha, arquivar ao entrar, botão Finalizar</td><td>Em <strong>Andamento automático</strong>, uma caixa para cada um</td></tr>
                                    <tr><td>Conduzir a consulta ligada (a coluna dela no quadro muda com o processo)</td><td>Em <strong>Andamento automático</strong>, "A fase conduz": Consulta, Expediente, Parceria ou uma página própria do órgão, com a situação ao entrar, quando alguém assume e, na primeira fase, já na autuação</td></tr>
                                    <tr><td>Fase de espera que volta para a fase de origem (diligências externas)</td><td>Em <strong>Encaminhamentos</strong>: "Fase de espera". Nas fases que podem aguardar, indique a espera como uma das saídas</td></tr>
                                    <tr><td>Ato que só uma pessoa pode praticar (ex.: só o Promotor conclui a Revisão; só quem gere a unidade dispensa)</td><td>Na ação: <strong>Quem pode cumprir</strong>. Na fase: <strong>Quem pode nesta fase</strong></td></tr>
                                    <tr><td>Fases em unidades diferentes (Secretaria, Assessoria, Gabinete)</td><td>No cabeçalho de cada fase, a unidade. Ao seguir, o processo é enviado para a unidade da fase seguinte</td></tr>
                                    <tr><td>Unidade que intima e também decide (comissão processante, pregoeiro, fiscal de contrato)</td><td>Fora do rito: em Unidades, nos <strong>Dados da unidade</strong>, as caixas <strong>Decide</strong> e <strong>Expede</strong></td></tr>
                                    <tr><td>Processo que chega já com responsável, sigilo, urgência ou pendência certos; aviso só para quem precisa; prazo para uma ação</td><td>Em <strong>Prazo, nome para as partes e ao entrar</strong> e, na ação, <strong>Prazo próprio da ação</strong> (parte 14)</td></tr>
                                    <tr><td>Capa simples, botão Assumir, redação original guardada em Versões, Impressão interna</td><td>Não precisam de configuração: valem para todo processo</td></tr>
                                </tbody>
                            </table>
                            <p>O que o rito não faz sozinho: criar a consulta, o expediente ou o registro da página (o processo nasce de um registro ou é ligado a ele) e preencher o que os outros módulos pedem a mais nas suas fichas. O Júri não é conduzido pelo rito, porque não tem quadro de fases. A parceria é conduzida, mas os dados que cada fase dela pede (pasta na rede, remetido para, formalização) continuam sendo preenchidos na ficha de Parcerias.</p>
                        </Parte>
                        <Parte titulo="14. Ao entrar na fase: efeitos, avisos e prazos">
                            <p>Em <strong>Prazo, nome para as partes e ao entrar</strong>, a fase pode ajustar o processo sozinha quando ele chega, escolher quem da equipe é avisado e dizer o que acontece com os prazos que ela abre. Tudo é opcional: o que ficar vazio continua como sempre foi.</p>
                            <ul className="space-y-1.5">
                                <Termo nome="Urgência">A fase pode <strong>marcar</strong> o processo como urgente ou <strong>tirar</strong> a urgência (para a fase em que a pressa acabou). As partes veem isso no termo da mudança de fase.</Termo>
                                <Termo nome="Sigilo">A fase pode tornar o processo <strong>restrito</strong> (só as unidades por onde ele passou leem os autos) ou devolver o sigilo ao <strong>normal</strong>. Serve, por exemplo, para a instrução de um processo disciplinar.</Termo>
                                <Termo nome="Responsável">A fase pode tirar o responsável ou <strong>designar</strong> um: quem moveu o processo, quem gere a unidade ou quem tem certa atribuição na lotação (ex.: Promotor, Pregoeiro, Fiscal do contrato). Vale entre os lotados na unidade que fica com o processo. Se houver mais de uma pessoa assim, ou nenhuma, ninguém é designado e o registro interno diz por quê; o botão Assumir continua na tela.</Termo>
                                <Termo nome="Pendência para quem decide">A fase pode abrir uma pendência com o texto que você escrever (ex.: Decidir sobre a admissibilidade). Quem aprecia é a unidade que decide, com o processo: se a fase corre em outra unidade, o processo vai concluso para ela. Marcada como <strong>interrompe a fase</strong>, o processo não muda de fase até ser apreciada. O texto da pendência fica com a equipe: o ato público da apreciação traz só a decisão.</Termo>
                                <Termo nome="Quem é avisado">Por padrão, a unidade é avisada quando o processo chega por remessa. A fase pode avisar toda a unidade sempre que o processo entra nela, só quem gere a unidade, só o responsável ou ninguém, e acrescentar uma <strong>mensagem</strong> ao aviso. Sem responsável designado, ou sem ninguém que gere a unidade, o aviso vai à unidade inteira. É aviso da equipe (sino e e-mail, conforme cada pessoa escolheu em Avisos); as partes continuam avisadas pelo portal.</Termo>
                                <Termo nome="Prazo próprio da ação">Na ação, em <strong>Prazo próprio da ação</strong>, informe os dias (úteis ou corridos). O prazo abre quando a ação passa a valer na fase e encerra quando ela é cumprida. Se a ação for desfeita, ele reabre com o vencimento de antes; se ela deixou de valer e volta a valer, o prazo conta de novo a partir desse dia. Se a fase terminar sem o cumprimento, é encerrado com esse registro. Ação condicional só abre prazo quando a condição vale.</Termo>
                                <Termo nome="Antecedência do alerta">Para os prazos que a fase abre (o dela e os das ações), quantos dias antes do vencimento o alerta diário começa. Vazio: 2 dias. Zero: só no dia. Até 30. O alerta diário (sino e e-mail) é o que o órgão liga em Calendário.</Termo>
                                <Termo nome="Prazo vencido">A fase pode marcar o processo como urgente e avisar quem gere a unidade quando um prazo dela vence sem ser cumprido. O motivo da urgência fica com a equipe: as partes leem só que o processo é urgente. Acontece uma vez por prazo, às 7h do dia seguinte ao vencimento, mesmo com o alerta diário do órgão desligado.</Termo>
                            </ul>
                            <p>Tudo o que a fase faz sozinha fica num registro só da equipe, nos eventos do processo. Prazos de ação e prazos da fase são <strong>internos</strong>: as partes não os veem; para elas, valem as intimações. Na volta de uma fase de espera, a fase é retomada como estava: não designa de novo nem reabre a pendência. Fase que arquiva ao entrar não designa responsável nem abre pendência.</p>
                            <table className={tabela}>
                                <thead><tr><th>Exemplo: processo disciplinar</th><th>Ao entrar</th><th>Avisos e prazos</th></tr></thead>
                                <tbody>
                                    <tr><td>Admissibilidade</td><td>Processo restrito; pendência "Decidir sobre a admissibilidade", que interrompe a fase</td><td>Avisa só quem gere a unidade</td></tr>
                                    <tr><td>Instrução</td><td>Designa quem tem a atribuição "Presidente da comissão"</td><td>Ação "Juntar o relatório" com prazo próprio de 30 dias corridos; alerta 5 dias antes; vencido, fica urgente e avisa quem gere</td></tr>
                                    <tr><td>Julgamento</td><td>Marca urgente; tira o responsável</td><td>Avisa toda a unidade, com a mensagem "Autos conclusos para julgamento"</td></tr>
                                    <tr><td>Arquivo</td><td>Tira a urgência; arquiva ao entrar</td><td>Não avisa ninguém</td></tr>
                                </tbody>
                            </table>
                        </Parte>
                        <Parte titulo="15. Comunicação, resposta e audiência (contraditório)">
                            <p>Em processos com partes, como o disciplinar, o sancionador, a apuração em contrato ou o recurso, o rito pode conduzir o contraditório. Duas opções de <strong>O que pede</strong> fazem isso juntas:</p>
                            <ul className="space-y-1.5">
                                <Termo nome="Comunicar as partes">Escolha a <strong>espécie</strong> (intimação, notificação, citação, ciência ou comunicação), <strong>a quem</strong> (os polos: requerente, requerido, interessado, terceiro; todos marcados é todo mundo; o tipo de processo pode dar a cada polo um nome próprio, como Denunciante e Acusado, e a ação continua valendo), o <strong>prazo de resposta</strong> (úteis ou corridos; vazio é sem prazo) e um <strong>texto proposto</strong>. Na tela do processo a ação ganha o botão <strong>Expedir</strong>, que abre a comunicação preenchida, só com as partes que a ação alcança. Ela se cumpre quando todas foram comunicadas, e volta a ficar por cumprir se uma comunicação for tornada sem efeito. O <strong>Prazo para expedir</strong> é interno, para a equipe.</Termo>
                                <Termo nome="Esperar a resposta das partes">Escolha a comunicação anterior, da mesma fase, cuja resposta se espera (ela precisa ter prazo). A ação se cumpre sozinha quando cada parte comunicada se manifesta pelo portal dentro do prazo, ou quando o prazo dela acaba sem manifestação. A resposta fica <strong>Apresentada</strong>, <strong>Parcial</strong> (alguns responderam) ou <strong>Sem manifestação</strong>, e pode guiar o <strong>Quando vale</strong> de outras ações e as saídas da fase. Se a peça chegou por outro meio, a equipe registra a resposta à mão.</Termo>
                                <Termo nome="Decurso do prazo">No dia seguinte ao fim do prazo sem manifestação, às 7h, o sistema certifica nos autos que o prazo decorreu sem manifestação. A certidão é pública: a parte a vê no portal e é avisada. A manifestação que chega depois do prazo é juntada normalmente, mas não desfaz a certidão nem conta como resposta no prazo.</Termo>
                                <Termo nome="Nomes dos polos">Não é opção do rito: é do <strong>tipo de processo</strong>, no formulário, em Partes. Ao lado de cada polo marcado, escreva o nome que ele tem naquele tipo: Denunciante e Acusado no disciplinar, Licitante na contratação, Contratante e Contratada na gestão de contrato, Reclamante e Reclamado na ouvidoria. O nome aparece na autuação, na capa, nas certidões, nas comunicações e no portal da parte, e fica gravado no processo como estava na autuação. Dois polos não podem ter o mesmo nome.</Termo>
                                <Termo nome="Prorrogar e devolver prazo">Não é opção do rito: é da tela do processo, em cada prazo aberto. Enquanto o prazo corre, <strong>Prorrogar</strong> soma dias ao vencimento (por exemplo, ao deferir o pedido de prazo da parte). Depois que venceu, <strong>Devolver</strong> faz o prazo correr de novo, a contar de hoje, quando houve justa causa (sistema fora do ar, autos indisponíveis). Os dois pedem o motivo e viram certidão nos autos; a parte vê o novo vencimento no portal. Na devolução, se a parte ainda não respondeu, o decurso certificado deixa de valer e a ação de resposta volta a esperar.</Termo>
                                <Termo nome="Designar audiência ou sessão">Escolha a <strong>espécie</strong> (audiência, de instrução, de conciliação, oitiva, sessão de julgamento, reunião, inspeção ou vistoria). Na tela do processo, o botão <strong>Designar</strong> pede a data, a hora, o modo (presencial, por videoconferência ou híbrido), o local ou o link e quem participa além das partes (testemunha, perito, informante, assistente técnico, intérprete). A designação é certidão nos autos, as partes a veem no portal e o processo mostra a próxima audiência. Desfazer cancela a audiência, também com certidão. Para intimar, ponha depois uma ação <strong>Comunicar as partes</strong> com <strong>{'{audiencia}'}</strong> no texto: na hora de expedir, vira a data, a hora e o local. A realização e a ata ficam com as ações seguintes: uma escolha (Realizada, Não realizada, Redesignada) e um documento da ata.</Termo>
                                <Termo nome="Fase que segue sozinha">Com <strong>Andamento automático</strong>, a fase segue assim que a resposta (ou o decurso) cumpre o que faltava. Se o rito reservou a conclusão da fase a alguém, quem conclui é essa pessoa.</Termo>
                            </ul>
                            <p>Cada comunicação é uma certidão nos autos, e o prazo conta da ciência. A fase de espera não interrompe a espera: ela continua contando enquanto o processo está em diligência. Ao sair da fase, as comunicações daquela rodada deixam de contar; se o processo voltar, a ação comunica de novo.</p>
                            <table className={tabela}>
                                <thead><tr><th>Exemplo: processo disciplinar</th><th>Ações da fase</th><th>Saídas</th></tr></thead>
                                <tbody>
                                    <tr><td>Citação e defesa</td><td>"Citar o acusado" (citação ao requerido, 10 dias úteis, obrigatória); "Aguardar a defesa" (espera a resposta da citação, obrigatória)</td><td>Resposta "Sem manifestação": vai a "Nomear defensor dativo"; senão, a "Instrução"</td></tr>
                                    <tr><td>Instrução</td><td>"Designar audiência de instrução" (com testemunhas); "Intimar para a audiência" (intimação a todas as partes, sem prazo, texto com {'{audiencia}'}); "Audiência realizada?" (escolha); "Juntar a ata" (documento)</td><td>"Não realizada": volta a designar; senão, "Alegações finais"</td></tr>
                                    <tr><td>Alegações finais</td><td>"Intimar para alegações" (intimação a todas as partes, 10 dias corridos); "Aguardar alegações"</td><td>Segue sozinha para "Relatório"</td></tr>
                                    <tr><td>Julgamento</td><td>"Notificar a decisão" (notificação ao requerido, sem prazo)</td><td>Segue para "Prazo de recurso", fase com prazo próprio</td></tr>
                                </tbody>
                            </table>
                        </Parte>
                        <Parte titulo="16. Começar de um modelo da biblioteca">
                            <p>Em <strong>Novo rito</strong>, a <strong>Biblioteca de modelos de processo</strong> traz processos completos, montados a partir da lei de cada área: administrativo geral, disciplinar, ético, sancionador e fiscalização, contratações e contratos, ouvidoria e acesso à informação, gestão de pessoas, contas e procedimentos extrajudiciais do Ministério Público. Nenhum é penal. Filtre por <strong>área</strong> e <strong>porte</strong> (curto, médio, longo) ou busque por palavra ou número de lei. Em cada modelo, <strong>Quando usar, base legal e fases</strong> mostra para que ele serve e de onde vêm os prazos.</p>
                            <ol className="list-decimal space-y-1.5 pl-5">
                                <li>Escolha o modelo mais próximo do seu processo e clique em <strong>Usar este modelo</strong>. Nada é criado ainda.</li>
                                <li>As unidades do modelo têm nomes genéricos (Secretaria, Gabinete, Comissão processante). A revisão casa cada uma com as do órgão pelo nome ou propõe criar. Troque pela unidade certa em cada fase.</li>
                                <li>Confira prazos e contagem (úteis ou corridos) com a norma que vale para o seu órgão. Regimentos locais costumam mudar prazos.</li>
                                <li>Ajuste ações, documentos e saídas: tire o que não se aplica, acrescente o que o seu órgão exige.</li>
                                <li>Se o modelo tem partes, o tipo de processo é proposto já com os polos e os nomes (Denunciante, Acusado, Licitante). Desmarque se quiser ligar o rito a um tipo que já existe.</li>
                                <li>Implante. Depois, o rito e o tipo se editam como qualquer outro.</li>
                            </ol>
                        </Parte>
                        <Parte titulo="17. Documentos e textos do rito">
                            <p>O rito também define como o documento exigido precisa estar para valer, e os textos que a equipe e as partes leem.</p>
                            <table className={tabela}>
                                <thead><tr><th>Opção</th><th>Onde</th><th>O que faz</th></tr></thead>
                                <tbody>
                                    <tr><td>Assinaturas exigidas</td><td>Documento exigido (da fase ou da ação)</td><td>O documento só cumpre a exigência com esse número de assinaturas (1 a 5). Ex.: decisão de comissão com 3 membros. "Assinar antes de juntar" conta. Não vale para documento recebido de fora.</td></tr>
                                    <tr><td>Uma das assinaturas é de quem tem a atribuição</td><td>Documento exigido</td><td>Ao menos um signatário tem essa atribuição na lotação, em qualquer unidade do órgão. Ex.: o parecer só vale assinado pelo Promotor. Sem ela, quem marcar a exigência na juntada recebe o aviso do que falta.</td></tr>
                                    <tr><td>Fica fora do portal das partes</td><td>Documento exigido que vai aos autos</td><td>O documento juntado para cumprir a exigência não aparece no portal, mesmo que quem junta escolha "Visível às partes". Só esconde: nunca mostra o que quem juntou deixou só para a equipe. Ex.: relatório preliminar da comissão.</td></tr>
                                    <tr><td>Frase de abertura</td><td>Certidão conjunta, na fase que reúne o grupo</td><td>Troca "Certifico que foram cumpridos os seguintes atos:" por outra frase. Os itens vêm logo depois, numerados. Ex.: "Certifico, para os devidos fins, que foram praticados os seguintes atos:".</td></tr>
                                    <tr><td>Nome do botão que conclui a fase</td><td>Fase, junto do nome para as partes</td><td>O botão principal passa a dizer o que o ato é, em vez de "Concluir e seguir para…". Ex.: "Enviar ao relator", "Publicar o edital". Para onde vai continua o mesmo: o rótulo não muda o caminho.</td></tr>
                                    <tr><td>Explicação para as partes no portal</td><td>Fase</td><td>Até 400 caracteres, sob o nome da fase no portal. Diga o que acontece na etapa e o que a parte pode fazer. É texto público: nada interno.</td></tr>
                                </tbody>
                            </table>
                            <p>Processos antigos seguem como estavam: sem essas opções, nada muda.</p>
                        </Parte>
                        <Parte titulo="18. Listas do órgão: espécies e origens a mais">
                            <p>
                                Quando o órgão usa um ato que o sistema não traz, cadastre-o em Configuração, aba Listas do órgão. Ele passa a aparecer ao lado
                                dos do sistema, no editor de rito e nas telas da equipe.
                            </p>
                            <table className={tabela}>
                                <thead><tr><th>Lista</th><th>Onde aparece</th><th>Exemplos</th></tr></thead>
                                <tbody>
                                    <tr><td>Espécies de comunicação</td><td>Expedir comunicação, ação do rito que pede comunicação às partes, textos prontos, portal</td><td>Edital, notificação extrajudicial, convocação</td></tr>
                                    <tr><td>Espécies de audiência</td><td>Ação do rito que designa audiência, aviso na capa, portal das partes</td><td>Sessão de mediação, reunião de conciliação, audiência pública</td></tr>
                                    <tr><td>Origens do processo</td><td>Autuação, retificação, capa, PDF da equipe, condições do rito (dado Origem)</td><td>Ouvidoria, corregedoria, auditoria interna</td></tr>
                                </tbody>
                            </table>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Marque "Nome masculino" nas espécies como edital ou ofício: os textos saem "ao edital", "ciência do edital", "edital expedido".</li>
                                <li>Uma espécie do órgão funciona como as do sistema: com prazo, a parte responde no prazo; sem prazo, fica só a ciência.</li>
                                <li>O processo, a comunicação, a audiência e o rito guardam o nome do item. Renomear ou tirar um item da lista não muda nada do que já foi feito.</li>
                                <li>Na condição "Origem é…", as origens do órgão aparecem junto das do sistema, e a regra vale para os processos autuados com elas.</li>
                            </ul>
                        </Parte>
                        <Parte titulo="19. Tipo de processo que cria o registro">
                            <p>
                                Muitos processos geram um registro que a equipe acompanha fora dos autos: a contratação gera o contrato, a ouvidoria gera o atendimento,
                                o disciplinar gera a ficha do procedimento. Em vez de cadastrar duas vezes, o tipo de processo cria o registro na página própria no momento da autuação.
                            </p>
                            <ol className="list-decimal space-y-1.5 pl-5">
                                <li>Ligue Páginas próprias em "Integrações com outros módulos" e tenha a página criada (ex.: Contratos), com as colunas e os campos dela.</li>
                                <li>No tipo de processo, aba Dados, marque <strong>Criar registro na autuação</strong> e escolha a página.</li>
                                <li>Em <strong>Fase em que o registro nasce</strong>, deixe a inicial da página ou escolha outra coluna.</li>
                                <li>Para cada campo do registro, diga de onde vem o valor: o número do processo, o assunto, a descrição, a data da autuação, a unidade que autuou, o nome do tipo, os nomes das partes, um campo do formulário do tipo ou um valor fixo. O que ficar vazio nasce em branco.</li>
                                <li>No rito, se quiser que o registro ande junto com o processo, ponha nas fases a regra da página (parte 8). Na primeira fase, marque <strong>Valer já na autuação</strong> para o registro já nascer na coluna dela.</li>
                            </ol>
                            <ul className="space-y-1.5">
                                <Termo nome="Obrigatórios da página">O campo que a página exige na fase em que o registro nasce precisa de uma fonte, ou o tipo não salva. Se a fonte for um campo opcional do formulário e ele vier vazio, a autuação para e diz o que falta: torne o campo obrigatório no formulário.</Termo>
                                <Termo nome="Conversão">O valor vira o tipo do campo da página: data em data, número em número (R$ 1.234,56 também), sim ou não em caixa marcada, e a escolha pelo valor ou pelo nome da opção. O que não couber (uma opção que a página não tem) para a autuação com o motivo.</Termo>
                                <Termo nome="Quando não cria">Se o processo nasce de um registro dessa mesma página ("Criar processo eletrônico" nela), nada é criado: a origem já é o registro.</Termo>
                                <Termo nome="Onde aparece">Na capa, em Registros ligados, como "Criado na autuação", com o botão para abrir. Na página, o processo aparece em Processos eletrônicos. O registro interno da autuação diz qual foi criado. As partes não veem nada disso: página própria é interna.</Termo>
                                <Termo nome="Campos de pessoa">Campo da página que aponta uma pessoa da equipe não recebe valor do processo; preencha-o na página.</Termo>
                            </ul>
                            <table className={tabela}>
                                <thead><tr><th>Tipo de processo</th><th>Página</th><th>Campos preenchidos</th></tr></thead>
                                <tbody>
                                    <tr><td>Contratação direta</td><td>Contratos</td><td>Processo (número), Objeto (assunto), Valor (campo Valor estimado), Modalidade (valor fixo Dispensa)</td></tr>
                                    <tr><td>Manifestação de ouvidoria</td><td>Atendimentos</td><td>Protocolo (número), Assunto, Manifestante (nomes das partes), Entrada (data da autuação)</td></tr>
                                    <tr><td>Processo ético-disciplinar</td><td>Procedimentos disciplinares</td><td>Processo (número), Fato (descrição), Unidade (unidade que autuou)</td></tr>
                                    <tr><td>Recebimento de bens</td><td>Entregas</td><td>Processo (número), Fornecedor (campo do formulário), Nota fiscal (campo do formulário)</td></tr>
                                </tbody>
                            </table>
                        </Parte>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
