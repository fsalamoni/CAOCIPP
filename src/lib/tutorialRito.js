/**
 * Tutorial do Guia do rito: o passo a passo para montar um rito do começo ao
 * fim, as receitas "quero fazer isto, use aquilo" e a escolha do modelo da
 * biblioteca. Lógica e textos puros: a tela está em
 * src/components/secretaria/TutorialRito.jsx. `parte` aponta para a parte do
 * Guia do rito (referência) que explica a opção em detalhe; `modelos` são ids
 * da biblioteca (src/lib/bibliotecaRitos.js). O teste confere os dois.
 */
import { semAcento, usaRecurso } from './bibliotecaFiltro.js';

/** Onde ficam as coisas na Configuração do Processo Eletrônico. */
export const CAMINHO = {
    ritos: 'Configuração do Processo Eletrônico, aba Ritos',
    tipos: 'Configuração do Processo Eletrônico, aba Tipos de processo',
    unidades: 'Configuração do Processo Eletrônico, aba Unidades e equipes',
    estrutura: 'Configuração do Processo Eletrônico, aba Estrutura',
    documentos: 'Configuração do Processo Eletrônico, aba Documentos e modelos',
    listas: 'Configuração do Processo Eletrônico, aba Listas do órgão',
    calendario: 'Configuração do Processo Eletrônico, aba Calendário',
    integracoes: 'Configuração do Processo Eletrônico, aba Integrações',
};

/**
 * Etapas do passo a passo. Cada uma: o objetivo, o que fazer (em ordem), as
 * perguntas que costumam surgir nela (com a resposta e a parte do guia) e o
 * que conferir antes de seguir.
 */
export const ETAPAS = [
    {
        id: 'planejar',
        titulo: 'Planeje o processo antes de abrir o editor',
        objetivo: 'Um rito bom nasce de uma descrição clara do processo. Gaste dez minutos respondendo, no papel, às perguntas abaixo. Cada resposta vira uma peça do editor.',
        passos: [
            'Escreva em uma frase o que o processo resolve e como ele termina (ex.: "apura a falta do servidor e termina com a absolvição, a sanção ou o arquivamento").',
            'Liste as etapas na ordem em que acontecem. Cada etapa em que o processo para numa unidade, à espera de um ato, é uma fase.',
            'Para cada etapa, anote quem faz (a unidade e, se for o caso, a atribuição da pessoa, como Promotor ou Presidente da comissão), o prazo e o que precisa ficar registrado.',
            'Marque os pontos de decisão ("se procedente, vai para...; se não, arquiva") e de onde vem a resposta que decide.',
            'Anote se há partes de fora (interessado, acusado, licitante, fornecedor) e o nome de cada polo nesse tipo de processo.',
            'Separe os documentos que o processo exige (parecer, relatório, decisão, termo) e quais precisam de assinatura de alguém específico.',
            'Tenha à mão a norma que rege o processo: prazos e contagem (dias úteis ou corridos) vêm dela.',
        ],
        perguntas: [
            { p: 'Meu processo é penal (inquérito policial, ação penal, Júri). Posso montar?', r: 'Não. A plataforma não é feita para processos penais: a biblioteca não traz nenhum e o rito não deve ser usado para isso. Processos disciplinares, éticos e sancionadores administrativos podem.' },
            { p: 'Não sei se o meu caso pede um rito curto ou longo.', r: 'Curto: duas a quatro fases, sem contraditório formal (consulta, pedido simples). Médio: com partes e uma rodada de defesa. Longo: instrução com provas, audiência, julgamento colegiado e recurso. Use a aba "Qual modelo usar?" deste tutorial para ver exemplos de cada porte.' },
            { p: 'Uma etapa é feita por outro órgão, fora do sistema, e depois o processo volta.', r: 'Isso não é uma fase comum: é uma fase de espera, que aguarda e volta sozinha para a fase de onde saiu. Anote-a à parte.', parte: 9 },
            { p: 'Duas etapas acontecem ao mesmo tempo em unidades diferentes.', r: 'O rito anda por uma fase de cada vez. Ponha as duas tarefas como ações da mesma fase, cada uma com quem pode cumprir, ou em fases seguidas.', parte: 7 },
        ],
        conferir: ['Sei como o processo começa e todas as formas como termina.', 'Cada fase tem uma unidade responsável.', 'Sei quais decisões mudam o caminho.'],
    },
    {
        id: 'preparar',
        titulo: 'Prepare o órgão: unidades, pessoas, colegiados e listas',
        objetivo: 'O rito aponta para unidades, atribuições, tipos de documento e colegiados. Cadastre-os antes, para escolher em vez de digitar e para o editor não apontar pendências.',
        passos: [
            `Em ${CAMINHO.unidades}, crie as unidades que aparecem no rito (Secretaria, Gabinete, Comissão processante) e lote as pessoas. Na lotação, escreva a atribuição de cada uma (ex.: Promotor, Presidente da comissão, Pregoeiro): é por ela que o rito reserva atos.`,
            'Nos Dados da unidade, em "Papel no processo", marque Decide (recebe conclusão e aprecia pendências e petições) e Expede (intima, notifica e cita). Por padrão o gabinete decide e a secretaria expede.',
            `Se houver julgamento em turma, câmara, comissão ou conselho, cadastre em ${CAMINHO.estrutura} o órgão colegiado com a composição (presidente e titulares) e as regras da pauta (antecedência, prazo de vista, prazo do redator do acórdão).`,
            `Em ${CAMINHO.documentos}, confira os tipos de documento que o rito vai exigir (Parecer, Relatório, Decisão, Termo de audiência) e crie os modelos de texto que a equipe usará.`,
            `Em ${CAMINHO.listas}, acrescente as espécies de comunicação, as espécies de audiência e as origens que o seu órgão usa e o sistema não traz.`,
            `Em ${CAMINHO.calendario}, cadastre os feriados locais e os recessos do órgão (os nacionais já contam) e veja o alerta diário de prazos.`,
            `Se o processo vai conduzir uma consulta, um expediente, uma parceria ou o registro de uma página própria, ligue a integração em ${CAMINHO.integracoes}.`,
        ],
        perguntas: [
            { p: 'Uma comissão processante intima as partes e também decide. Como faço?', r: 'Na unidade da comissão, marque as duas caixas, Decide e Expede, em "Papel no processo". Não é opção do rito.', parte: 7 },
            { p: 'Só o Promotor pode assinar o parecer e concluir a revisão.', r: 'Escreva "Promotor" como atribuição na lotação dele. No rito, use "Quem pode cumprir" e "Quem pode nesta fase" com essa atribuição, e no documento exigido, "Uma das assinaturas é de quem tem a atribuição".', parte: 7 },
            { p: 'Esqueci de criar uma unidade. Preciso voltar?', r: 'Não. Ao implantar um modelo ou um arquivo, a revisão casa as unidades pelo nome e propõe criar as que faltam. No editor em branco, você pode criá-la depois e trocar na fase.', parte: 16 },
            { p: 'O meu órgão chama a citação de "Convocação".', r: 'Cadastre "Convocação" em Listas do órgão, nas espécies de comunicação. Ela aparece no editor ao lado das do sistema.', parte: 18 },
        ],
        conferir: ['As unidades existem e têm pessoas lotadas.', 'As atribuições estão escritas igual nas lotações.', 'O colegiado tem composição, se houver julgamento.'],
    },
    {
        id: 'comecar',
        titulo: 'Escolha por onde começar',
        objetivo: `Em ${CAMINHO.ritos}, o botão Novo rito oferece vários pontos de partida. Partir de algo pronto economiza horas e evita esquecer etapas da lei.`,
        passos: [
            'Abra Novo rito.',
            'Se existe um processo parecido com o seu na Biblioteca de modelos de processo, clique no nome para ler a descrição e as fases e, se servir, em Usar. A aba "Qual modelo usar?" deste tutorial ajuda a achar.',
            'Se o seu processo é a análise de consultas com minuta e revisão, use o Rito Consultas CAOCIPP, em "Começar sem arquivo".',
            'Se você já tem o fluxo escrito, use "Ou a partir de um arquivo": planilha, diagrama (Mermaid ou XML), Word, PDF ou texto com "Fase 1 – Nome", "Unidade:", "Prazo de N dias" e "Se…, segue para…". Também dá para colar o texto.',
            'Se o rito é parecido com um que o órgão já tem, use Duplicar no menu desse rito, ou, dentro do editor, Copiar fases de outro rito.',
            'Se outro órgão já montou o rito, peça o arquivo e use Importar de outro órgão.',
            'Se nada serve, escolha Em branco: uma fase vazia para montar do zero.',
        ],
        perguntas: [
            { p: 'Se eu usar um modelo, ele fica preso à plataforma?', r: 'Não. Usar cria uma cópia só do seu órgão, gravada no banco do órgão. Você muda tudo nela, e uma atualização do modelo na plataforma não altera a sua cópia.', parte: 20 },
            { p: 'Nenhum modelo é igual ao meu processo.', r: 'Use o mais próximo e ajuste. Tirar uma fase ou uma ação é mais rápido que montar do zero, e as regras do modelo (prazos, comunicações, desvios) servem de exemplo.', parte: 16 },
            { p: 'Posso juntar fases de dois ritos?', r: 'Sim. Comece por um deles e, no editor, use Copiar fases de outro rito para trazer as fases do outro.', parte: 13 },
            { p: 'Quero o mesmo rito de outro órgão que usa o SIGO.', r: 'O administrador de lá exporta pelo menu do rito, em Exportar para outro órgão. Aqui, use Importar de outro órgão. O rito chega com unidades, modelos de documento e tipo de processo, e nada se grava até você implantar.', parte: 20 },
        ],
        conferir: ['O rito tem um nome claro (ex.: "PAD rito ordinário").', 'As fases do ponto de partida fazem sentido para o meu processo.'],
    },
    {
        id: 'fases',
        titulo: 'Monte as fases',
        objetivo: 'A fase é a etapa em que o processo fica numa unidade até cumprir o que ela pede. O desenho do alto se monta sozinho a partir das fases.',
        passos: [
            'Crie as fases em Adicionar fase, na ordem em que o processo anda. Use nomes que digam o que acontece (Admissibilidade, Instrução, Defesa, Julgamento).',
            'Em cada fase, escolha a Unidade que cuida dela. Ao seguir para uma fase de outra unidade, o processo é enviado para lá.',
            'Se a fase tem prazo, informe os dias ao lado do nome.',
            'Em "Prazo, nome para as partes e ao entrar", dê à fase o nome que as partes leem no portal e a explicação (até 400 caracteres) do que acontece nela. É texto público.',
            'Se quiser, troque o nome do botão que conclui a fase (ex.: "Enviar ao relator", "Publicar o edital").',
            'Marque como final a fase em que o processo termina. Para arquivar ao chegar nela, use Arquivar ao entrar, em Andamento automático.',
        ],
        perguntas: [
            { p: 'A fase é só de trabalho interno e não deve aparecer nos autos.', r: 'Em "Registros, certidão conjunta e documentos", deixe "Entrar e sair da fase", "Remessas entre unidades durante a fase" e "Outros atos durante a fase" em "Só no sistema". A equipe ainda imprime pela Impressão interna.', parte: 11 },
            { p: 'Vários atos pequenos da fase deveriam virar uma certidão só.', r: 'Use a certidão conjunta: as ações com "Na certidão conjunta" em Onde fica o cumprimento entram numa certidão única, emitida ao sair do grupo de fases. Você pode trocar a frase de abertura.', parte: 17 },
            { p: 'O processo pode parar à espera de terceiros em mais de uma fase.', r: 'Crie uma fase de espera (Encaminhamentos, Fase de espera) e ponha-a como saída alternativa em cada fase que pode aguardar. Ela volta sempre para a fase de origem.', parte: 9 },
            { p: 'Quero que a parte entenda em que pé está o processo.', r: 'Preencha o nome para as partes e a explicação no portal de cada fase. A parte vê isso, nunca o nome interno nem as ações.', parte: 17 },
        ],
        conferir: ['Toda fase tem unidade.', 'Há ao menos uma fase final.', 'O nome para as partes não revela nada interno.'],
    },
    {
        id: 'acoes',
        titulo: 'Cadastre o que cada fase pede (as ações)',
        objetivo: 'A ação é o que alguém faz ou registra na fase. Em "O que pede" você escolhe a ferramenta certa para cada ato: marcar como feito, um dado, um formulário, um documento, uma comunicação, uma audiência, um julgamento, uma disputa.',
        passos: [
            'Em Ações da fase, escreva uma ação por linha, com verbo no começo (Registrar no SIM, Juntar o relatório, Citar o acusado).',
            'Abra cada ação e escolha O que pede. A tabela "O que a ação pede" da referência diz quando usar cada opção.',
            'Em "Para a fase seguir", diga se a ação é obrigatória, recomendada ou opcional. Para "faça isto ou aquilo", abra a segunda e escolha a primeira em "Alternativa a".',
            'Em "Onde fica o cumprimento", diga se o registro vai aos autos, fica só no sistema, entra numa certidão conjunta ou não gera evento. Marque "As partes veem no portal" só no que a parte pode ver.',
            'Para um dado que deve aparecer na folha de dados do PDF (a página do evento 1), marque "Entra na folha de dados do processo".',
            'Se a ação tem prazo próprio (ex.: 30 dias para o relatório), informe em "Prazo próprio da ação".',
            'Escreva em "Orientação a quem cumpre" a dica que a equipe lê abaixo da ação.',
        ],
        perguntas: [
            { p: 'Quero só lembrar a equipe de algo, sem ninguém marcar.', r: 'Em O que pede, escolha "Nada: só orienta (não se marca)". Nada fica registrado.', parte: 3 },
            { p: 'Preciso registrar vários dados de uma vez (número, data, valor, responsável).', r: 'Use "Um formulário (vários campos)". Cada campo tem o seu tipo; um campo de lista ou de sim ou não também serve para criar desvios.', parte: 3 },
            { p: 'A fase só pode seguir com o parecer juntado.', r: 'Na ação, O que pede: um documento, com o Tipo de documento Parecer, e "Para a fase seguir" obrigatória. Ou cadastre em "Documentos da fase".', parte: 17 },
            { p: 'Preciso intimar a parte e esperar a defesa.', r: 'Duas ações: "Comunicar as partes" (espécie, polos, prazo e texto) e, logo depois, "Esperar a resposta das partes" apontando para a comunicação. Veja a etapa 9 deste tutorial.', parte: 15 },
            { p: 'Quero ligar o processo a uma consulta, um expediente ou outro registro.', r: 'Use "Um registro de outro módulo". A integração precisa estar ligada.', parte: 3 },
        ],
        conferir: ['Cada ação tem verbo e diz o que pede.', 'O que é obrigatório está marcado como obrigatório.', 'Nada interno está marcado como visível às partes.'],
    },
    {
        id: 'caminhos',
        titulo: 'Defina os caminhos: saídas, desvios e condições',
        objetivo: 'Os encaminhamentos dizem para onde o processo vai depois de cada fase. Com mais de uma saída, o desenho ganha um losango (desvio), e cada saída pode ter uma regra.',
        passos: [
            'Em Encaminhamentos, acrescente as fases para onde o processo pode ir.',
            'Para o caminho depender de uma resposta, crie antes uma ação de escolha (Uma escolha numa lista ou Sim ou não) ou um campo de lista no formulário.',
            'Em cada saída, use "Regra desta saída" e marque as respostas que levam a ela. Para "ou", marque mais de uma resposta; para "e", use E também (até quatro condições).',
            'Diga a saída padrão em "Se nenhuma regra indicar outra saída" (o "senão").',
            'Para uma ação valer só em alguns casos, use "Quando vale" na própria ação, com a mesma lógica.',
            'A condição pode ler uma resposta desta fase, uma resposta dada em outra fase ou um dado do processo (urgente, sigilo, se tem partes, origem, tipo e campos do formulário do tipo).',
        ],
        perguntas: [
            { p: 'Se veio pelo SIM, pula três ações.', r: 'Crie a ação "Veio pelo SIM?" (Sim ou não) e, nas três, "Quando vale" com a resposta Não. O desenho mostra o losango antes delas.', parte: 5 },
            { p: 'A admissibilidade escolhe entre rito ordinário e sumário, e a instrução muda conforme.', r: 'Na Instrução, em Quando vale, escolha "Uma resposta dada em outra fase" e a resposta da Admissibilidade.', parte: 5 },
            { p: 'Processo urgente vai direto ao gabinete.', r: 'Na saída para o gabinete, Regra desta saída com o dado do processo "Urgente" Sim; a outra saída como padrão.', parte: 5 },
            { p: 'O julgamento procedente vai para a sanção; o improcedente, para o arquivo.', r: 'Use a ação "Julgar em colegiado" (ou uma escolha) com os resultados Procedente e Improcedente, e uma regra em cada saída.', parte: 15 },
            { p: 'Se a parte não se defender, nomeia-se defensor dativo.', r: 'Na saída para "Nomear defensor dativo", Regra desta saída com a resposta "Sem manifestação" da ação de esperar a resposta.', parte: 15 },
        ],
        conferir: ['Toda fase que não é final tem saída.', 'As fases com mais de uma saída têm regras ou saída padrão.', 'A Prévia percorre cada caminho como eu esperava.'],
    },
    {
        id: 'pessoas',
        titulo: 'Diga quem cumpre, quem vê e quem pode cada ato',
        objetivo: 'Por padrão, quem tem o processo faz tudo. Reserve só o que a norma reserva: a assinatura do relator, a decisão do presidente, a dispensa pelo gestor.',
        passos: [
            'Na ação, em Quem pode cumprir: quem tem o processo, só o responsável designado, só quem gere a unidade ou só quem tem certa atribuição.',
            'Na ação, em Quem vê o dado na equipe: toda a equipe ou só quem gere a unidade. Dado reservado nunca vai aos autos nem ao portal.',
            'Na fase, em Quem pode nesta fase: quem conclui a fase, quem dispensa o que ela exige, quem segue por caminho fora do previsto e quem arquiva, sobresta ou reativa.',
            'Use Aplicar a todas as fases para copiar as escolhas para o rito inteiro.',
        ],
        perguntas: [
            { p: 'Só quem gere a unidade pode dispensar uma exigência.', r: 'Na fase, Quem pode nesta fase, "Quem dispensa o que a fase exige": só quem gere a unidade.', parte: 7 },
            { p: 'O processo deve chegar já com o presidente da comissão como responsável.', r: 'Em "Prazo, nome para as partes e ao entrar", Responsável: designar quem tem a atribuição "Presidente da comissão".', parte: 14 },
            { p: 'Um dado da análise não pode ser visto por toda a equipe.', r: 'Na ação, Quem vê o dado na equipe: só quem gere a unidade. Esse dado não serve de condição.', parte: 7 },
        ],
        conferir: ['As atribuições escritas no rito existem nas lotações.', 'Nenhum ato ficou reservado a quem não está lotado na unidade da fase.'],
    },
    {
        id: 'automatizar',
        titulo: 'Automatize o andamento, os avisos e os prazos',
        objetivo: 'O rito pode andar sozinho, ajustar o processo ao entrar na fase e cuidar dos prazos, para ninguém precisar lembrar do passo seguinte.',
        passos: [
            'Em Andamento automático, ligue Seguir sozinha nas fases em que, cumprido o último item obrigatório, o próximo passo é sempre o mesmo.',
            'Na última fase, ligue Arquivar ao entrar.',
            'Na fase de revisão em que se escolhem as minutas e se junta tudo de uma vez, ligue Botão Finalizar.',
            'Em "A fase conduz", diga em que coluna do quadro a consulta, o expediente, a parceria ou o registro da página própria fica quando o processo entra na fase e quando alguém assume.',
            'Em "Prazo, nome para as partes e ao entrar", escolha o que a fase faz ao receber o processo: urgência, sigilo, responsável, pendência para quem decide e quem é avisado.',
            'Defina a antecedência do alerta e o que acontece com o prazo vencido (marcar urgente e avisar quem gere).',
        ],
        perguntas: [
            { p: 'A instrução de um processo disciplinar deve ser sigilosa.', r: 'Na fase, ao entrar, Sigilo: restrito. Na fase seguinte, devolva ao normal se for o caso.', parte: 14 },
            { p: 'A admissibilidade só anda depois que o gabinete decidir.', r: 'Ao entrar, abra a pendência "Decidir sobre a admissibilidade" marcada como "interrompe a fase". O processo vai concluso para a unidade que decide.', parte: 14 },
            { p: 'A fase não seguiu sozinha, mesmo com tudo feito.', r: 'Confira: se há mais de uma saída, uma resposta precisa indicar uma só (ou haver saída padrão); se há minutas a escolher, a fase termina pelo botão; e quem cumpriu o último item precisa poder concluir a fase.', parte: 8 },
            { p: 'A consulta deve mudar de coluna no quadro quando o processo anda.', r: 'Em Andamento automático, A fase conduz: Consulta, com a situação ao entrar e ao assumir. Na primeira fase, marque Valer já na autuação.', parte: 8 },
        ],
        conferir: ['As fases automáticas têm um único próximo passo possível.', 'Os avisos vão a quem precisa, não a todos.'],
    },
    {
        id: 'partes',
        titulo: 'Conduza as partes: comunicação, defesa, audiência, julgamento e disputa',
        objetivo: 'Em processos com partes, o rito conduz o contraditório com ferramentas próprias, que funcionam em qualquer rito: comunicar, esperar a resposta, designar audiência, julgar em colegiado e disputar preços.',
        passos: [
            'Para intimar, notificar ou citar: ação "Comunicar as partes", com a espécie, os polos, o prazo de resposta (úteis ou corridos) e o texto proposto. Na tela do processo ela ganha o botão Expedir.',
            'Para esperar a defesa: ação "Esperar a resposta das partes", apontando para a comunicação anterior da mesma fase. Ela se cumpre sozinha com a resposta ou com o fim do prazo, e o sistema certifica o decurso.',
            'Para audiência, oitiva, inspeção ou reunião com data: ação "Designar audiência ou sessão". Ponha depois uma comunicação com {audiencia} no texto para intimar. No dia, a sala da audiência registra presença e ocorrências e lavra o termo.',
            'Para decisão de turma, câmara, comissão ou conselho: ação "Julgar em colegiado", com os resultados possíveis, o quórum e o desempate. O processo aparece na aba Sessões para a secretaria pautar.',
            'Para escolher fornecedor por menor preço ou maior desconto: ação "Disputa de preços", com cotação privada ou dispensa eletrônica. O resultado (Homologada, Deserta, Fracassada) decide a saída.',
            `Os nomes dos polos (Denunciante, Acusado, Licitante) ficam no tipo de processo, em ${CAMINHO.tipos}, aba Formulário, em Partes.`,
        ],
        perguntas: [
            { p: 'A parte pediu mais prazo.', r: 'Não é opção do rito: na tela do processo, no prazo aberto, Prorrogar soma dias ao vencimento, com motivo e certidão.', parte: 15 },
            { p: 'Quero julgamento virtual, com voto de cada conselheiro na sua conta.', r: 'Use "Julgar em colegiado" no rito e marque a sessão como virtual assíncrona na aba Sessões. Vista, adiamento, divergência, voto condutor e acórdão já vêm com a sessão.', parte: 15, modelos: ['recurso-colegiado'] },
            { p: 'Preciso de uma reunião do conselho para aprovar o regimento, sem processo.', r: 'Não é ação do rito: na aba Sessões, Marcar sessão, Reunião deliberativa. A pauta são assuntos, com votação nominal, simbólica ou secreta.', parte: 15 },
            { p: 'A compra direta precisa de cotação com três fornecedores.', r: 'Use "Disputa de preços" com cotação privada: só os convidados por e-mail mandam proposta.', parte: 15, modelos: ['compra-privada', 'contratacao-direta'] },
            { p: 'Quero intimar para a audiência com data e local no texto.', r: 'Depois da ação de audiência, uma "Comunicar as partes" com {audiencia} no texto proposto. Ao expedir, vira data, hora e local.', parte: 15 },
        ],
        conferir: ['Toda espera de resposta aponta para uma comunicação com prazo.', 'O tipo de processo tem os polos que as comunicações alcançam.', 'O colegiado da unidade do julgamento tem composição.'],
    },
    {
        id: 'documentos',
        titulo: 'Decida o que vai aos autos e como os documentos valem',
        objetivo: 'O rito define o que vira evento nos autos, o que fica só com a equipe e como o documento exigido precisa estar para cumprir a exigência.',
        passos: [
            'Revise o "Onde fica o cumprimento" de cada ação: Nos autos, Evento no extrato, Só no sistema, Na certidão conjunta ou Sem evento.',
            'Em "Registros, certidão conjunta e documentos", diga onde ficam a entrada e a saída da fase, as remessas e os outros atos.',
            'No documento exigido, defina o tipo, quantas assinaturas exige (1 a 5), se uma delas é de quem tem certa atribuição e se fica fora do portal das partes.',
            'Para a certidão conjunta, ajuste a frase de abertura.',
        ],
        perguntas: [
            { p: 'A decisão da comissão só vale com três assinaturas.', r: 'No documento exigido, Assinaturas exigidas: 3.', parte: 17 },
            { p: 'O relatório preliminar não pode aparecer para a parte.', r: 'No documento exigido, marque "Fica fora do portal das partes".', parte: 17 },
            { p: 'O número do PGEA tem de aparecer na folha de dados do PDF.', r: 'Na ação que registra o número, marque "Entra na folha de dados do processo".', parte: 4 },
            { p: 'A equipe precisa imprimir o que ficou fora dos autos.', r: 'Não precisa de configuração: a Impressão interna, no menu do processo, imprime o que for marcado, com a marca de uso interno.', parte: 11 },
        ],
        conferir: ['O que a parte precisa conhecer vai aos autos e ao portal.', 'Nada reservado vai aos autos.'],
    },
    {
        id: 'tipo',
        titulo: 'Crie o tipo de processo que usa o rito',
        objetivo: 'O rito diz como o processo anda; o tipo de processo diz o que se autua. É o tipo que aparece no "+ Novo processo", com o formulário, as partes e a numeração.',
        passos: [
            `Em ${CAMINHO.tipos}, clique em Novo tipo (ou edite o que o modelo propôs).`,
            'Aba Dados: nome, sigla, o Rito, o sigilo padrão, a unidade de entrada e, se só um órgão interno autua, qual. Se o processo deve criar o registro numa página própria, marque Criar registro na autuação.',
            'Aba Formulário: os campos do "Novo processo", em seções, com formatos (como CPF e CNPJ), campos condicionais e em que momento cada um é exigido. Em Partes, marque os polos e dê o nome de cada um.',
            'Aba Numeração: as partes do número (como sigla, sequência e ano), se a sequência é do órgão todo, do tipo, da unidade que autua ou do órgão interno, e quando recomeça.',
            'Confira na prévia ao lado o "Novo processo" e o que as partes veem no portal.',
        ],
        perguntas: [
            { p: 'Dois tipos de processo podem usar o mesmo rito?', r: 'Sim. O rito pode até mudar o caminho conforme o tipo: a condição "Conforme o dado do processo" oferece o tipo e os campos do formulário dele.', parte: 5 },
            { p: 'Um campo só é obrigatório antes do julgamento.', r: 'No formulário do tipo, diga em que momento o campo é exigido. A exigência fica no tipo, e não no rito, porque o rito serve a vários tipos.' },
            { p: 'A contratação deve criar o contrato na página Contratos.', r: 'No tipo, aba Dados, Criar registro na autuação, página Contratos, e diga de onde vem cada campo.', parte: 19 },
        ],
        conferir: ['O tipo aponta para o rito certo.', 'Os polos do tipo são os que as comunicações do rito alcançam.'],
    },
    {
        id: 'testar',
        titulo: 'Teste, implante e mantenha',
        objetivo: 'Antes de implantar, simule. Depois, ajuste com segurança: processos em andamento seguem a versão com que foram autuados.',
        passos: [
            'Resolva as pendências que o editor aponta. Implantar leva até a primeira que impede.',
            'Abra a Prévia: ande pelas fases, dê respostas diferentes, troque os dados do processo e confira as abas "Como a parte vê" e "Como fica nos autos".',
            'Clique em Implantar rito (ou Salvar alterações) e confirme.',
            'Autue um processo de teste com o tipo e percorra o caminho principal e um desvio. Depois, exclua o processo de teste.',
            'Ao mudar o rito, uma nova versão é criada. Para levar processos em andamento à versão nova, use Atualizar processos no menu do rito.',
            'O que se exclui vai para a Lixeira e pode ser restaurado. O Histórico registra quem mudou o quê.',
            'Para levar o rito a outro órgão, use Exportar para outro órgão no menu do rito.',
        ],
        perguntas: [
            { p: 'Mudei o rito. Os processos antigos mudam?', r: 'Não. Cada processo segue a versão com que foi autuado, até alguém usar Atualizar processos. Processos sem uma opção nova continuam como estavam.' },
            { p: 'Apaguei um rito por engano.', r: 'Restaure na aba Lixeira. Nada se apaga do banco.' },
            { p: 'Como explico o rito à equipe?', r: 'Mostre o desenho do alto do editor e este guia. A tela do processo mostra a cada pessoa o que falta e a quem cabe cada ato.' },
        ],
        conferir: ['A Prévia percorreu todos os caminhos.', 'Um processo de teste chegou ao fim.', 'A equipe sabe onde está o Guia do rito.'],
    },
];

/** Temas das receitas, na ordem da tela. */
export const TEMAS = [
    ['comecar', 'Começar e reaproveitar'],
    ['fases', 'Fases e caminhos'],
    ['acoes', 'Ações e registros'],
    ['pessoas', 'Pessoas e permissões'],
    ['automacao', 'Automação, avisos e prazos'],
    ['partes', 'Partes e contraditório'],
    ['colegiado', 'Julgamento colegiado e reuniões'],
    ['contratacao', 'Contratações e disputa de preços'],
    ['documentos', 'Documentos e autos'],
    ['integracao', 'Outros módulos e tipo de processo'],
];

/**
 * Receitas: "quero fazer isto" → "use esta ferramenta, aqui, com estes detalhes".
 * `modelos`: modelos da biblioteca que já fazem isso, para ver pronto.
 */
export const RECEITAS = [
    { tema: 'comecar', quero: 'Montar um processo disciplinar completo', use: 'O modelo da biblioteca e ajuste unidades e prazos ao regimento do órgão.', onde: 'Ritos, Novo rito, Biblioteca: área Correcional e disciplinar, Usar.', parte: 16, modelos: ['pad-ordinario', 'pad-sumario', 'sindicancia-investigativa'] },
    { tema: 'comecar', quero: 'Montar um processo ético de conselho profissional ou entidade de classe', use: 'Um modelo da área Ética e conselhos profissionais.', onde: 'Biblioteca, filtro de área, Usar.', parte: 16, modelos: ['etico-profissional', 'ted-oab-rs', 'etico-disciplinar-cau'] },
    { tema: 'comecar', quero: 'Analisar consultas com minuta, revisão e devolução', use: 'O Rito Consultas CAOCIPP.', onde: 'Novo rito, Começar sem arquivo.', parte: 12 },
    { tema: 'comecar', quero: 'Aproveitar o fluxo que já tenho em planilha, diagrama ou Word', use: 'A importação de arquivo: o sistema monta a proposta para revisar.', onde: 'Novo rito, "Ou a partir de um arquivo" (ou cole o texto).', parte: 2 },
    { tema: 'comecar', quero: 'Fazer um rito parecido com um que o órgão já tem', use: 'Duplicar o rito, ou Copiar fases de outro rito dentro do editor.', onde: 'Ritos, menu do rito (⋯), Duplicar.', parte: 13 },
    { tema: 'comecar', quero: 'Usar o rito de outro órgão', use: 'O pacote exportado pelo outro órgão.', onde: 'Ritos, Importar de outro órgão.', parte: 20 },
    { tema: 'comecar', quero: 'Começar do zero', use: 'O rito em branco e o passo a passo deste tutorial.', onde: 'Novo rito, Começar sem arquivo, Em branco.', parte: 2 },
    { tema: 'fases', quero: 'Que o caminho dependa de uma decisão (procede, não procede)', use: 'Uma ação de escolha e a "Regra desta saída" em cada encaminhamento.', onde: 'Fase, Encaminhamentos.', parte: 5 },
    { tema: 'fases', quero: 'Uma saída "senão" quando nenhuma regra vale', use: '"Se nenhuma regra indicar outra saída".', onde: 'Fase, Encaminhamentos.', parte: 5 },
    { tema: 'fases', quero: 'Que a decisão de uma fase antiga mude o caminho mais à frente', use: 'Condição com "Uma resposta dada em outra fase".', onde: 'Quando vale ou Regra desta saída.', parte: 5 },
    { tema: 'fases', quero: 'Caminhos diferentes para processo urgente, sigiloso, com partes ou de certa origem', use: 'Condição "Conforme o dado do processo".', onde: 'Quando vale ou Regra desta saída.', parte: 5 },
    { tema: 'fases', quero: 'Esperar resposta de outro órgão e voltar à mesma fase', use: 'A fase de espera, posta como saída alternativa das fases que podem aguardar.', onde: 'Fase, Encaminhamentos, Fase de espera.', parte: 9 },
    { tema: 'fases', quero: 'Que a parte entenda cada etapa no portal', use: 'O nome para as partes e a explicação no portal de cada fase.', onde: 'Fase, "Prazo, nome para as partes e ao entrar".', parte: 17 },
    { tema: 'fases', quero: 'Que o botão da fase diga o ato (ex.: "Enviar ao relator")', use: 'Nome do botão que conclui a fase.', onde: 'Fase, junto do nome para as partes.', parte: 17 },
    { tema: 'acoes', quero: 'Uma ação que só vale em alguns casos', use: '"Quando vale" na ação, com a resposta de uma escolha ou de um dado do processo.', onde: 'Ação, Quando vale.', parte: 5 },
    { tema: 'acoes', quero: '"Faça isto ou aquilo"', use: '"Alternativa a" na segunda ação.', onde: 'Ação, Para a fase seguir.', parte: 6 },
    { tema: 'acoes', quero: 'Registrar vários dados de uma vez', use: 'O que pede: "Um formulário (vários campos)".', onde: 'Ação, O que pede.', parte: 3 },
    { tema: 'acoes', quero: 'Pôr um dado na folha de dados do PDF', use: '"Entra na folha de dados do processo".', onde: 'Ação, Onde fica o cumprimento.', parte: 4 },
    { tema: 'acoes', quero: 'Uma anotação da equipe que não gera evento', use: '"Sem evento" ou "Só no sistema".', onde: 'Ação, Onde fica o cumprimento.', parte: 4 },
    { tema: 'acoes', quero: 'Só um lembrete, sem marcar', use: 'O que pede: "Nada: só orienta (não se marca)".', onde: 'Ação, O que pede.', parte: 3 },
    { tema: 'acoes', quero: 'Juntar atos pequenos numa certidão só', use: 'A certidão conjunta: as ações com "Na certidão conjunta" em Onde fica o cumprimento, e a frase de abertura própria.', onde: 'Fase, "Registros, certidão conjunta e documentos".', parte: 17 },
    { tema: 'pessoas', quero: 'Que só o Promotor (ou o relator, o presidente) conclua a fase', use: '"Quem conclui a fase" com a atribuição, escrita igual na lotação.', onde: 'Fase, Quem pode nesta fase.', parte: 7 },
    { tema: 'pessoas', quero: 'Que só quem gere a unidade dispense exigências', use: '"Quem dispensa o que a fase exige": só quem gere a unidade.', onde: 'Fase, Quem pode nesta fase.', parte: 7 },
    { tema: 'pessoas', quero: 'Que um dado fique só com quem gere a unidade', use: '"Quem vê o dado na equipe": só quem gere a unidade.', onde: 'Ação, Quem vê o dado na equipe.', parte: 7 },
    { tema: 'pessoas', quero: 'Que a comissão intime e decida', use: 'As caixas Decide e Expede na unidade (fora do rito).', onde: 'Unidades e equipes, Dados da unidade, Papel no processo.', parte: 7 },
    { tema: 'pessoas', quero: 'Que o processo chegue com responsável designado', use: 'Responsável: designar quem moveu, quem gere ou quem tem a atribuição.', onde: 'Fase, "Prazo, nome para as partes e ao entrar".', parte: 14 },
    { tema: 'automacao', quero: 'Que a fase siga sozinha', use: 'Seguir sozinha, com uma só saída possível (ou saída padrão).', onde: 'Fase, Andamento automático.', parte: 8 },
    { tema: 'automacao', quero: 'Arquivar ao chegar na última fase', use: 'Arquivar ao entrar.', onde: 'Fase, Andamento automático.', parte: 8 },
    { tema: 'automacao', quero: 'Escolher as minutas e juntar tudo de uma vez na revisão', use: 'Botão Finalizar.', onde: 'Fase, Andamento automático.', parte: 10 },
    { tema: 'automacao', quero: 'Tornar o processo sigiloso numa fase', use: 'Sigilo: restrito, ao entrar.', onde: 'Fase, "Prazo, nome para as partes e ao entrar".', parte: 14 },
    { tema: 'automacao', quero: 'Que o processo só ande depois da decisão do gabinete', use: 'Pendência para quem decide, marcada como "interrompe a fase".', onde: 'Fase, ao entrar.', parte: 14 },
    { tema: 'automacao', quero: 'Avisar só quem precisa quando o processo chega', use: '"Quem é avisado" e a mensagem do aviso.', onde: 'Fase, ao entrar.', parte: 14 },
    { tema: 'automacao', quero: 'Prazo para uma ação específica, com alerta antes', use: '"Prazo próprio da ação" e a antecedência do alerta da fase.', onde: 'Ação e fase.', parte: 14 },
    { tema: 'automacao', quero: 'Que o prazo vencido deixe o processo urgente', use: 'Prazo vencido: marcar urgente e avisar quem gere.', onde: 'Fase, ao entrar.', parte: 14 },
    { tema: 'partes', quero: 'Intimar, notificar ou citar com prazo de resposta', use: '"Comunicar as partes", com espécie, polos, prazo e texto proposto.', onde: 'Ação, O que pede.', parte: 15, modelos: ['pa-geral'] },
    { tema: 'partes', quero: 'Esperar a defesa e certificar o decurso', use: '"Esperar a resposta das partes", apontando para a comunicação.', onde: 'Ação, O que pede.', parte: 15, modelos: ['pad-sumario'] },
    { tema: 'partes', quero: 'Nomear defensor dativo se a parte não se defender', use: 'Regra de saída com a resposta "Sem manifestação".', onde: 'Fase, Encaminhamentos.', parte: 15, modelos: ['pad-ordinario'] },
    { tema: 'partes', quero: 'Audiência de instrução com testemunhas, sala e termo', use: '"Designar audiência ou sessão" e, depois, uma comunicação com {audiencia} no texto.', onde: 'Ação, O que pede.', parte: 15, modelos: ['pad-ordinario', 'conciliacao-ccaf'] },
    { tema: 'partes', quero: 'Nomes próprios para os polos (Denunciante, Acusado, Licitante)', use: 'Os nomes dos polos no tipo de processo.', onde: 'Tipos de processo, aba Formulário, Partes.', parte: 15 },
    { tema: 'partes', quero: 'Prorrogar ou devolver um prazo à parte', use: 'Prorrogar e Devolver, na tela do processo (não é opção do rito).', onde: 'Processo, prazo aberto.', parte: 15 },
    { tema: 'partes', quero: 'Uma espécie de comunicação que o sistema não tem (edital, convocação)', use: 'A lista do órgão.', onde: 'Listas do órgão, Espécies de comunicação.', parte: 18 },
    { tema: 'colegiado', quero: 'Julgamento por turma, câmara, comissão ou conselho com votos', use: '"Julgar em colegiado", com resultados, quórum e desempate, e a composição cadastrada.', onde: 'Ação, O que pede; Estrutura, colegiado.', parte: 15, modelos: ['recurso-colegiado', 'etico-profissional'] },
    { tema: 'colegiado', quero: 'Pauta, sessão, vista, divergência e acórdão', use: 'A aba Sessões: o processo com "Julgar em colegiado" pendente aparece em Incluir processos.', onde: 'Processo Eletrônico, aba Sessões.', parte: 15, modelos: ['ted-oab-rs'] },
    { tema: 'colegiado', quero: 'Votação virtual assíncrona', use: 'Sessão virtual na aba Sessões, com o primeiro e o último dia da votação.', onde: 'Sessões, Marcar sessão.', parte: 15 },
    { tema: 'colegiado', quero: 'Reunião do conselho com assuntos, sem processo', use: 'Reunião deliberativa, com votação nominal, simbólica ou secreta.', onde: 'Sessões, Marcar sessão, Reunião deliberativa.', parte: 15, modelos: ['deliberacao-normativa'] },
    { tema: 'contratacao', quero: 'Cotação com fornecedores convidados', use: '"Disputa de preços", cotação privada.', onde: 'Ação, O que pede.', parte: 15, modelos: ['compra-privada'] },
    { tema: 'contratacao', quero: 'Dispensa eletrônica com lances públicos', use: '"Disputa de preços", dispensa eletrônica, com equipe (agente, apoio, autoridade).', onde: 'Ação, O que pede; no processo, Montar a disputa.', parte: 15, modelos: ['contratacao-direta'] },
    { tema: 'contratacao', quero: 'Que a contratação crie o contrato na página Contratos', use: 'Criar registro na autuação, no tipo de processo.', onde: 'Tipos de processo, aba Dados.', parte: 19, modelos: ['licitacao'] },
    { tema: 'contratacao', quero: 'Apurar infração de fornecedor e aplicar sanção', use: 'O modelo de sanção a fornecedor, com defesa e decisão.', onde: 'Biblioteca, área Sancionador e fiscalização.', parte: 16, modelos: ['sancao-fornecedor'] },
    { tema: 'documentos', quero: 'Exigir o parecer para a fase seguir', use: 'Ação que pede documento, com o Tipo de documento, obrigatória.', onde: 'Ação, O que pede, ou Documentos da fase.', parte: 17 },
    { tema: 'documentos', quero: 'Documento que só vale com três assinaturas, uma delas do presidente', use: 'Assinaturas exigidas e "Uma das assinaturas é de quem tem a atribuição".', onde: 'Documento exigido.', parte: 17 },
    { tema: 'documentos', quero: 'Esconder do portal um documento juntado', use: '"Fica fora do portal das partes".', onde: 'Documento exigido.', parte: 17 },
    { tema: 'documentos', quero: 'Guardar a redação original quando o gabinete revisa a minuta', use: 'Nada a configurar: Versões guarda o texto de cada pessoa.', onde: 'Documento, Versões.', parte: 10 },
    { tema: 'documentos', quero: 'Imprimir o que ficou fora dos autos', use: 'A Impressão interna.', onde: 'Processo, menu de três pontos.', parte: 11 },
    { tema: 'integracao', quero: 'Que a consulta, o expediente ou a parceria acompanhe o processo', use: '"A fase conduz", com a situação ao entrar e ao assumir.', onde: 'Fase, Andamento automático; integração ligada.', parte: 8 },
    { tema: 'integracao', quero: 'Que o processo crie o registro numa página própria', use: 'Criar registro na autuação, com a fonte de cada campo.', onde: 'Tipos de processo, aba Dados.', parte: 19 },
    { tema: 'integracao', quero: 'Uma origem que o sistema não tem (ouvidoria, corregedoria)', use: 'A lista do órgão; ela vale também nas condições do rito.', onde: 'Listas do órgão, Origens do processo.', parte: 18 },
    { tema: 'integracao', quero: 'Levar o rito ou um modelo de documento a outro órgão', use: 'Exportar para outro órgão; o outro órgão importa e recebe uma cópia própria.', onde: 'Ritos ou Documentos, menu do item.', parte: 20 },
];

/** Busca nas receitas, sem acento, em todos os termos. `tema` vazio = todos. */
export function buscarReceitas(busca = '', tema = '') {
    const ts = semAcento(busca).split(/\s+/).filter(Boolean);
    return RECEITAS.filter((r) => (!tema || r.tema === tema)
        && ts.every((t) => semAcento(`${r.quero} ${r.use} ${r.onde}`).includes(t)));
}

/** Perguntas do "Qual modelo usar?". A primeira opção de cada uma é "tanto faz". */
export const PERGUNTAS_MODELO = [
    { id: 'area', pergunta: 'Qual é o assunto do processo?', opcoes: [['', 'Ainda não sei'], ['geral', 'Pedido ou recurso administrativo'], ['correcional', 'Apurar falta de servidor ou empregado'], ['etica', 'Ética, conselho profissional, entidade de classe'], ['sancionador', 'Fiscalizar e aplicar multa ou sanção'], ['contratacoes', 'Comprar, contratar, gerir contrato, parceria'], ['atendimento', 'Ouvidoria e acesso à informação'], ['ministerio_publico', 'Ministério Público (não penal)'], ['gestao', 'Gestão interna, pessoas, normas'], ['controle', 'Controle e contas'], ['advocacia_publica', 'Advocacia pública, acordo, cobrança']] },
    { id: 'defesa', pergunta: 'A parte é intimada e tem prazo para responder ou se defender?', opcoes: [['', 'Tanto faz'], ['sim', 'Sim, há contraditório'], ['nao', 'Não, o órgão decide sem ouvir a parte']] },
    { id: 'recurso', pergunta: 'Como a decisão é tomada?', opcoes: [['', 'Tanto faz'], ['monocratica', 'Uma pessoa decide'], ['julgamento', 'Um colegiado vota em sessão'], ['disputa', 'Disputa de preços entre fornecedores'], ['audiencia', 'Com audiência ou reunião']] },
    { id: 'porte', pergunta: 'Qual o tamanho do processo?', opcoes: [['', 'Tanto faz'], ['curto', 'Curto (poucas fases)'], ['medio', 'Médio (com uma rodada de defesa)'], ['longo', 'Longo (instrução, julgamento e recurso)']] },
];

const ROTULO_FILTRO = { area: 'o assunto', defesa: 'a defesa das partes', recurso: 'a forma de decidir', porte: 'o tamanho' };

const cabe = (m, k, v) => {
    if (!v) return true;
    if (k === 'area') return m.area === v;
    if (k === 'porte') return m.porte === v;
    if (k === 'defesa') return usaRecurso(m, 'resposta') === (v === 'sim');
    if (k === 'recurso') return v === 'monocratica' ? !usaRecurso(m, 'julgamento') : usaRecurso(m, v);
    return true;
};

/**
 * Modelos que atendem às respostas. Se nenhum atende a todas, solta as menos
 * importantes (tamanho, depois partes, depois a forma de decidir) e diz quais
 * soltou, para a tela não mostrar lista vazia sem explicação.
 */
export function sugerirModelos(modelos, respostas = {}, limite = 6) {
    const ordemSoltar = ['porte', 'defesa', 'recurso'];
    const ativos = Object.keys(ROTULO_FILTRO).filter((k) => respostas[k]);
    const soltos = [];
    let lista = [];
    for (let i = 0; i <= ordemSoltar.length; i += 1) {
        const valem = ativos.filter((k) => !soltos.includes(k));
        lista = modelos.filter((m) => valem.every((k) => cabe(m, k, respostas[k])));
        if (lista.length || i === ordemSoltar.length) break;
        const proximo = ordemSoltar.find((k) => ativos.includes(k) && !soltos.includes(k));
        if (!proximo) break;
        soltos.push(proximo);
    }
    const ordemPorte = { curto: 0, medio: 1, longo: 2 };
    lista = [...lista].sort((a, b) => (ordemPorte[a.porte] - ordemPorte[b.porte]) || a.nome.localeCompare(b.nome, 'pt-BR'));
    return { modelos: lista.slice(0, limite), total: lista.length, soltos: soltos.map((k) => ROTULO_FILTRO[k]) };
}
