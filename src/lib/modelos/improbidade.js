// Improbidade administrativa no Ministério Público do RS: o inquérito civil
// pela Lei 8.429/1992 e o acordo de não persecução civil em dois processos, como
// o Provimento 27/2026-PGJ manda (tratativas, art. 11, § 1º; acompanhamento,
// art. 19), mais a versão num processo só. Nada aqui é penal: improbidade é
// ilícito civil e administrativo. Pesquisa e fontes:
// /mnt/project-files/modelos-rito/pesquisa-anpc-improbidade.md. Forma de
// escrever: ./dsl.js.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';
const PROV = 'Provimento 27/2026-PGJ';
const DERIVADO = '"Novo processo derivado deste", na capa';

/** O que o acordo prevê, em números e datas: é a base do acompanhamento. */
const CAMPOS_ACORDO = [
    { id: 'assinatura', rotulo: 'Data da assinatura', tipo: 'data', obrigatorio: true },
    { id: 'ressarcimento', rotulo: 'Ressarcimento do dano (R$)', tipo: 'numero', obrigatorio: false },
    { id: 'devolucao', rotulo: 'Bens e valores a devolver (R$)', tipo: 'numero', obrigatorio: false },
    { id: 'multa', rotulo: 'Multa civil (R$)', tipo: 'numero', obrigatorio: false },
    { id: 'destino_multa', rotulo: 'Destino da multa civil', tipo: 'lista', obrigatorio: false, opcoes: ['Fundo para Reconstituição de Bens Lesados', 'Projeto social, com concordância do ente lesado', 'Outro fundo'] },
    { id: 'parcelas', rotulo: 'Número de parcelas', tipo: 'numero', obrigatorio: false },
    { id: 'prazo_final', rotulo: 'Vencimento da última obrigação', tipo: 'data', obrigatorio: true },
    { id: 'sancoes', rotulo: 'Sanções e demais obrigações', tipo: 'texto_longo', obrigatorio: true },
    { id: 'garantias', rotulo: 'Garantias e bens indisponíveis', tipo: 'texto', obrigatorio: false },
    { id: 'colaboracao', rotulo: 'É acordo de colaboração?', tipo: 'sim_nao', obrigatorio: false },
];

/**
 * Fases das tratativas, da sinalização à homologação judicial. `depois` é a
 * fase que vem depois das providências da homologação; `derivado` diz se o
 * acompanhamento corre em outro processo (o rito só de tratativas).
 */
function fasesTratativas({ depois, derivado }) {
    return [
        {
            nome: 'Abertura das tratativas', unidade: 'Secretaria', nome_publico: 'Início das tratativas', ao_entrar: { sigilo: 'restrito' }, vai: ['Análise de cabimento'],
            orientacao: `As tratativas correm em procedimento administrativo próprio, separado da investigação ou da ação (${PROV}, art. 11, § 1º; Provimento 71/2017-PGJ, art. 47, VI). Tudo o que se diz nelas é confidencial para terceiros até a homologação judicial (art. 11, § 2º): por isso o processo entra em sigilo restrito. Cadastre o celebrante como parte e o advogado ou defensor público como representante dele, cada um com a própria conta no portal. O ente lesado não é parte aqui: é ouvido por ofício, na fase própria.`,
            acoes: [
                A.formulario('Dados das tratativas', [
                    { id: 'origem', rotulo: 'Número do procedimento ou da ação de origem', tipo: 'texto', obrigatorio: true },
                    { id: 'tipo_origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['Inquérito civil', 'Procedimento preparatório', 'Ação de improbidade em curso', 'Cumprimento de sentença', 'Outra'] },
                    { id: 'iniciativa', rotulo: 'Quem propôs as tratativas', tipo: 'lista', obrigatorio: true, opcoes: ['O Ministério Público', 'O investigado ou demandado'] },
                    { id: 'celebrante', rotulo: 'Celebrante', tipo: 'texto', obrigatorio: true },
                    { id: 'defensor', rotulo: 'Advogado ou defensor público', tipo: 'texto', obrigatorio: false },
                    { id: 'ente', rotulo: 'Pessoa jurídica lesada', tipo: 'texto', obrigatorio: true },
                    { id: 'fato', rotulo: 'Resumo do fato e do enquadramento', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o pedido ou a proposta inicial', 'Proposta', { forma: 'juntar', nivel: 'opcional' }),
                A.fazer('Cadastrar o celebrante como parte e o defensor como representante', { obrigatoria: true, ajuda: 'O acordo exige assistência de advogado ou defensor público (art. 1º). Convide os dois para o portal na aba Andamento, em Partes.' }),
            ],
        },
        {
            nome: 'Análise de cabimento', unidade: 'Gabinete', vai: ['Negociação', 'Recusa da proposta'],
            orientacao: `O acordo pede indícios suficientes de autoria e materialidade (${PROV}, art. 3º, § 1º) e tem de proteger o patrimônio público e a moralidade melhor que a ação, pesando custo e duração do processo, adequação das medidas, colaboração e capacidade de cumprir (art. 2º). A capacidade financeira se apura antes, com levantamento de dados (art. 2º, § 3º). Quem descumpriu outro acordo fica 5 anos sem poder celebrar (art. 3º, § 3º). Depois do trânsito em julgado da condenação, não se negocia a suspensão dos direitos políticos, a perda da função nem a proibição de contratar (art. 6º).`,
            acoes: [
                A.simNao('Há indícios suficientes de autoria e materialidade?', { obrigatoria: true }),
                A.simNao('O celebrante descumpriu outro acordo nos últimos 5 anos?', { obrigatoria: true, ajuda: 'Se sim, está impedido: o prazo conta de quando o Ministério Público soube do descumprimento (art. 3º, § 3º).' }),
                A.fazer('Levantar a capacidade financeira do celebrante', { ajuda: 'Base para o parcelamento e para as garantias (art. 2º, § 3º, e art. 8º, § 2º).' }),
                A.textoLongo('Por que o acordo atende melhor ao interesse público', { obrigatoria: true, destino: 'informacao' }),
                A.escolha('Decisão sobre as tratativas', ['Abrir a negociação', 'Recusar a proposta'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Negociação': quando('Decisão sobre as tratativas', 'Abrir a negociação'), 'Recusa da proposta': quando('Decisão sobre as tratativas', 'Recusar a proposta') },
        },
        {
            nome: 'Recusa da proposta', unidade: 'Gabinete', vai: ['Pedido de revisão', 'Encerramento sem acordo'],
            orientacao: `A recusa pede motivação idônea: a ação é mais conveniente ao interesse público (${PROV}, art. 5º). O interessado pode pedir revisão ao Conselho Superior em 10 dias da ciência, também quando discorda das condições exigidas (§ 1º). O pedido não suspende nada: a investigação ou a ação seguem (§ 3º).`,
            acoes: [
                A.documento('Decisão de recusa fundamentada', 'Despacho', { forma: 'redigir' }),
                A.comunicar('Dar ciência da recusa', { especie: 'ciencia', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'A proposta de acordo foi recusada, pelos motivos da decisão anexa. Cabe pedido de revisão ao Conselho Superior em 10 dias, apresentado neste processo.' }, { obrigatoria: true }),
                A.esperar('Aguardar o pedido de revisão', 'Dar ciência da recusa', { obrigatoria: true }),
            ],
            saidas: { 'Pedido de revisão': quando('Aguardar o pedido de revisão', 'Apresentada', 'Parcial'), 'Encerramento sem acordo': quando('Aguardar o pedido de revisão', 'Sem manifestação') },
        },
        {
            nome: 'Pedido de revisão', unidade: 'Gabinete', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Negociação', 'Revisão da recusa pelo Conselho Superior'],
            ao_entrar: { pendencia: 'Pedido de revisão da recusa: reconsiderar, ajustar as condições ou remeter ao Conselho Superior em 3 dias.' },
            orientacao: `O membro pode reconsiderar ou ajustar as condições. Se mantiver a recusa, o pedido sobe ao Conselho Superior em 3 dias (${PROV}, art. 5º, § 2º).`,
            acoes: [
                A.simNao('Reconsidera a recusa ou ajusta as condições?', { obrigatoria: true, destino: 'autos' }),
                A.fazer('Remeter o pedido de revisão ao Conselho Superior', { obrigatoria: true, destino: 'autos', se: quando('Reconsidera a recusa ou ajusta as condições?', 'nao') }),
            ],
            saidas: { 'Negociação': quando('Reconsidera a recusa ou ajusta as condições?', 'sim'), 'Revisão da recusa pelo Conselho Superior': quando('Reconsidera a recusa ou ajusta as condições?', 'nao') },
        },
        {
            nome: 'Revisão da recusa pelo Conselho Superior', unidade: 'Conselho Superior', nome_publico: 'Revisão pelo colegiado', vai: ['Negociação', 'Encerramento sem acordo'],
            ao_entrar: { pendencia: 'Pautar e deliberar sobre o pedido de revisão da recusa de acordo.' },
            orientacao: `O Conselho Superior só revê a recusa que não tem fundamentação (${PROV}, art. 5º, § 4º). Mantida a recusa, as tratativas se encerram; do contrário, voltam à negociação.`,
            acoes: [
                A.audiencia('Pautar a sessão', 'sessao'),
                A.julgamento('Deliberação sobre a recusa', ['Mantém a recusa', 'Determina a reabertura das tratativas'], {}, { obrigatoria: true }),
                A.documento('Juntar a decisão do colegiado', 'Decisão', { forma: 'juntar' }),
            ],
            saidas: { 'Encerramento sem acordo': quando('Deliberação sobre a recusa', 'Mantém a recusa'), 'Negociação': quando('Deliberação sobre a recusa', 'Determina a reabertura das tratativas') },
        },
        {
            nome: 'Negociação', unidade: 'Gabinete', nome_publico: 'Negociação do acordo', vai: ['Aguardando proposta ou documentos', 'Oitiva do ente lesado', 'Encerramento sem acordo'],
            orientacao: `Negociam o membro, o celebrante e o defensor (${PROV}, art. 11). No início da primeira reunião, alerte sobre a confidencialidade (§ 3º). Cada reunião vai para ata ou gravação, com data, local, participantes e resumo, e pode ser por videoconferência (§§ 5º e 6º). Sobre o dano não há desconto: negociam-se só a divisão entre os responsáveis, a forma, o prazo, o modo e os juros (art. 8º, § 4º). Cabem parcelamento e desconto em folha (§§ 2º e 3º). Pessoa natural pode assinar por procurador com poderes especiais; pessoa jurídica, por quem a representa (art. 11, §§ 8º e 9º).`,
            acoes: [
                A.audiencia('Designar reunião de negociação', 'reuniao'),
                A.comunicar('Convocar o celebrante e o defensor', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Compareça, com seu advogado ou defensor público, à reunião sobre o acordo em {audiencia}. O que for tratado é confidencial.' }),
                A.fazer('Alertar sobre a confidencialidade na primeira reunião', { obrigatoria: true, ajuda: 'Divulgar as tratativas ou os documentos delas é quebra de sigilo e de boa-fé (art. 11, §§ 2º e 3º).' }),
                A.documento('Juntar a ata ou o registro da reunião', 'Ata', { forma: 'qualquer', nivel: 'recomendado' }),
                A.documento('Juntar a procuração do defensor ou do representante', 'Procuração', { forma: 'juntar', nivel: 'recomendado' }),
                A.formulario('Apuração do dano e da vantagem', [
                    { id: 'dano', rotulo: 'Dano ao erário, atualizado (R$)', tipo: 'numero', obrigatorio: false },
                    { id: 'vantagem', rotulo: 'Valores acrescidos ilicitamente (R$)', tipo: 'numero', obrigatorio: false },
                    { id: 'data_base', rotulo: 'Data-base do cálculo', tipo: 'data', obrigatorio: false },
                    { id: 'juros', rotulo: 'Os juros foram flexibilizados?', tipo: 'sim_nao', obrigatorio: false },
                    { id: 'justificativa', rotulo: 'Justificativa da flexibilização', tipo: 'texto_longo', obrigatorio: false },
                ], { destino: 'informacao', folha_dados: true, ajuda: 'Valores atualizados e com juros desde o ilícito; os juros podem ser flexibilizados com justificativa (art. 8º, VII).' }),
                A.documento('Minuta do acordo', 'Minuta', { forma: 'redigir', nivel: 'recomendado' }),
                A.escolha('Resultado da negociação', ['Aguardar proposta ou documentos do celebrante', 'Consenso sobre os termos', 'Sem acordo'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Aguardando proposta ou documentos': quando('Resultado da negociação', 'Aguardar proposta ou documentos do celebrante'),
                'Oitiva do ente lesado': quando('Resultado da negociação', 'Consenso sobre os termos'),
                'Encerramento sem acordo': quando('Resultado da negociação', 'Sem acordo'),
            },
        },
        {
            nome: 'Aguardando proposta ou documentos', unidade: 'Secretaria', espera: true, avanco: 'auto', nome_publico: 'Aguardando o celebrante',
            orientacao: 'Peça ao celebrante a proposta, a contraproposta ou os documentos que faltam. Com a resposta ou o fim do prazo, o processo volta à negociação. O prazo é ajustável.',
            acoes: [
                A.comunicar('Pedir a proposta ou os documentos', { especie: 'notificacao', polos: ['requerido'], dias: 15, contagem: corridos, texto: 'Apresente, no prazo indicado, a proposta ou os documentos pedidos na negociação do acordo. Envie por aqui, em "Peticionar".' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta do celebrante', 'Pedir a proposta ou os documentos', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Oitiva do ente lesado', unidade: 'Secretaria', nome_publico: 'Consulta à pessoa jurídica lesada', vai: ['Celebração do acordo', 'Negociação'],
            orientacao: `A pessoa jurídica lesada é ouvida sobre o acordo, mas a concordância dela não é requisito (${PROV}, art. 12). Fora do juízo, ouça-a de preferência antes de mandar o acordo ao Conselho Superior (§ 1º). Se concordar, pode assinar junto ou anuir (§ 2º). Mande por ofício só os elementos necessários: as tratativas seguem confidenciais. O provimento não fixa prazo para a resposta; combine um no ofício.`,
            acoes: [
                A.fazer('Oficiar o ente lesado com os elementos necessários', { obrigatoria: true, destino: 'autos' }),
                A.data('Data do ofício', { obrigatoria: true, destino: 'informacao' }),
                A.documento('Juntar a manifestação do ente lesado', 'Manifestação', { forma: 'juntar', nivel: 'recomendado' }),
                A.escolha('Posição do ente lesado', ['Concorda e assina em conjunto', 'Concorda ou anui', 'Discorda', 'Não se manifestou'], { obrigatoria: true, destino: 'autos' }),
                A.simNao('A manifestação leva a rever os termos?', { obrigatoria: true }),
            ],
            saidas: { 'Negociação': quando('A manifestação leva a rever os termos?', 'sim'), 'Celebração do acordo': quando('A manifestação leva a rever os termos?', 'nao') },
        },
        {
            nome: 'Celebração do acordo', unidade: 'Gabinete', nome_publico: 'Assinatura do acordo', vai: ['Remessa ao Conselho Superior', 'Homologação judicial'],
            orientacao: `O instrumento é escrito, vincula todo o Ministério Público e traz os elementos do art. 8º do ${PROV}. Assinam o membro, o celebrante e o defensor (art. 11, § 7º). A eficácia fica condicionada à homologação judicial e, se o acordo é anterior à ação, também à aprovação do Conselho Superior (art. 8º, XVII, e art. 16). Qualquer das partes pode se retratar até a homologação (art. 13). Depois da sentença, não se combina a extinção do processo antes do cumprimento (art. 2º, § 2º).`,
            acoes: [
                A.orientar('Confira os elementos obrigatórios do instrumento', 'Identificação, conduta e enquadramento, dano e reparação integral, sanções, forma de cumprimento, multa por atraso, garantias, descumprimento e eficácia condicionada (art. 8º).'),
                A.documento('Instrumento do acordo', 'Acordo de não persecução civil', { forma: 'qualquer' }),
                A.formulario('Dados do acordo', CAMPOS_ACORDO, { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.simNao('O acordo esgota o objeto da investigação?', { obrigatoria: true, ajuda: 'Se não, extraia peças para outro procedimento, que também vai ao Conselho Superior em 3 dias (art. 14, parágrafo único).' }),
                A.fazer('Extrair peças para prosseguir quanto ao restante', { obrigatoria: true, se: quando('O acordo esgota o objeto da investigação?', 'nao') }),
                A.comunicar('Entregar cópia do acordo ao celebrante', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Segue cópia do acordo assinado. Ele só produz efeitos depois da homologação judicial.' }),
                A.escolha('Controle a que o acordo se submete', ['Conselho Superior e depois o juízo (acordo anterior à ação)', 'Só o juízo (ação em curso ou já julgada)'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Remessa ao Conselho Superior': quando('Controle a que o acordo se submete', 'Conselho Superior e depois o juízo (acordo anterior à ação)'),
                'Homologação judicial': quando('Controle a que o acordo se submete', 'Só o juízo (ação em curso ou já julgada)'),
            },
        },
        {
            nome: 'Remessa ao Conselho Superior', unidade: 'Secretaria', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Aprovação pelo Conselho Superior'],
            orientacao: `Celebrado o acordo e esgotado o objeto, os autos principais e os da negociação vão juntos ao Conselho Superior em 3 dias (${PROV}, art. 14). No acordo parcial, vai o procedimento formado com as peças extraídas (parágrafo único).`,
            acoes: [
                A.fazer('Remeter os autos principais e os da negociação', { obrigatoria: true, destino: 'autos' }),
                A.data('Data da remessa', { obrigatoria: true, destino: 'informacao' }),
            ],
        },
        {
            nome: 'Aprovação pelo Conselho Superior', unidade: 'Conselho Superior', nome_publico: 'Análise pelo colegiado', prazo_dias: 60, prazo_auto: true, prazo_contagem: corridos,
            vai: ['Homologação judicial', 'Ajustes pedidos pelo Conselho Superior', 'Diligências do Conselho Superior', 'Acordo reprovado'],
            ao_entrar: { pendencia: 'Deliberar sobre o acordo de não persecução civil em até 60 dias.' },
            orientacao: `O Conselho Superior delibera em até 60 dias (${PROV}, art. 16, I). Pode aprovar, devolver para ajustes nos termos, converter em diligência ou reprovar, caso em que decide pelo prosseguimento da investigação ou pela ação (art. 17).`,
            acoes: [
                A.audiencia('Pautar a sessão', 'sessao'),
                A.julgamento('Deliberação sobre o acordo', ['Aprova', 'Devolve para ajustes', 'Converte em diligência', 'Reprova'], {}, { obrigatoria: true }),
                A.documento('Juntar a decisão do colegiado', 'Decisão', { forma: 'juntar' }),
            ],
            saidas: {
                'Homologação judicial': quando('Deliberação sobre o acordo', 'Aprova'),
                'Ajustes pedidos pelo Conselho Superior': quando('Deliberação sobre o acordo', 'Devolve para ajustes'),
                'Diligências do Conselho Superior': quando('Deliberação sobre o acordo', 'Converte em diligência'),
                'Acordo reprovado': quando('Deliberação sobre o acordo', 'Reprova'),
            },
        },
        {
            nome: 'Ajustes pedidos pelo Conselho Superior', unidade: 'Gabinete', vai: ['Remessa ao Conselho Superior', 'Designação de outro membro'],
            orientacao: `Reformule a proposta nos pontos indicados e colha de novo a concordância do celebrante e do defensor (${PROV}, art. 17, II). Se o membro discordar dos ajustes, com fundamento, o Conselho providencia a designação de outro (§ 1º). Se o celebrante discordar, o acordo volta ao Conselho, que pode reprová-lo (§ 2º).`,
            acoes: [
                A.escolha('Resultado dos ajustes', ['Proposta reformulada, com a concordância do celebrante', 'O celebrante não concorda com os ajustes', 'O membro não concorda com os ajustes'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Instrumento reformulado', 'Acordo de não persecução civil', { forma: 'qualquer', se: quando('Resultado dos ajustes', 'Proposta reformulada, com a concordância do celebrante') }),
                A.documento('Manifestação fundamentada do membro', 'Despacho', { forma: 'redigir', se: quando('Resultado dos ajustes', 'O membro não concorda com os ajustes') }),
            ],
            saidas: {
                'Remessa ao Conselho Superior': quando('Resultado dos ajustes', 'Proposta reformulada, com a concordância do celebrante', 'O celebrante não concorda com os ajustes'),
                'Designação de outro membro': quando('Resultado dos ajustes', 'O membro não concorda com os ajustes'),
            },
        },
        {
            nome: 'Diligências do Conselho Superior', unidade: 'Gabinete', vai: ['Remessa ao Conselho Superior'],
            orientacao: `Cumpra os atos que o Conselho Superior especificou e devolva os autos (${PROV}, art. 17, III).`,
            acoes: [
                A.fazer('Cumprir as diligências especificadas', { obrigatoria: true }),
                A.documento('Juntar o resultado das diligências', '', { forma: 'qualquer', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Designação de outro membro', unidade: 'Secretaria', vai: ['Ajustes pedidos pelo Conselho Superior'],
            orientacao: `Registre o membro designado, que passa a conduzir os ajustes (${PROV}, art. 17, § 1º).`,
            acoes: [A.texto('Membro designado', { obrigatoria: true, destino: 'autos' })],
        },
        {
            nome: 'Acordo reprovado', unidade: 'Gabinete', vai: ['Encerramento sem acordo'],
            orientacao: `Reprovado o acordo, o Conselho Superior decide pelo prosseguimento da investigação ou pela ação de improbidade (${PROV}, art. 17, IV). Leve a decisão ao procedimento de origem.`,
            acoes: [
                A.comunicar('Dar ciência da reprovação ao celebrante', { especie: 'ciencia', polos: ['requerido'], dias: 0, texto: 'O Conselho Superior do Ministério Público não aprovou o acordo, que por isso não produz efeitos.' }, { obrigatoria: true }),
                A.fazer('Registrar a decisão no procedimento de origem', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Homologação judicial', unidade: 'Gabinete', nome_publico: 'Pedido de homologação ao juízo', vai: ['Providências da homologação', 'Negociação', 'Encerramento sem acordo'],
            orientacao: `O acordo depende sempre de homologação judicial, antes ou depois da ação (${PROV}, arts. 16, II, e 18; Lei 8.429/1992, art. 17, § 4º-A, quanto ao foro). No pedido, requeira o envio das informações à Justiça Eleitoral, para o INFODIP (art. 20) e, se convier às investigações, que a confidencialidade continue (art. 11, § 4º).`,
            acoes: [
                A.documento('Juntar o pedido de homologação', 'Petição', { forma: 'juntar' }),
                A.texto('Número do processo judicial', { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.fazer('Requerer o envio à Justiça Eleitoral (INFODIP)', { obrigatoria: true, ajuda: 'Resolução Conjunta CNJ/TSE 6/2020 (art. 20 do provimento).' }),
                A.simNao('Foi pedido que a confidencialidade continue?', { ajuda: 'Possível quando convém à eficiência das investigações (art. 11, § 4º).' }),
                A.escolha('Resultado no juízo', ['Homologado', 'Não homologado: rever os termos', 'Não homologado ou retratação: encerrar'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a decisão judicial', 'Decisão', { forma: 'juntar' }),
                A.data('Data da homologação', { obrigatoria: true, destino: 'informacao', folha_dados: true, se: quando('Resultado no juízo', 'Homologado') }),
            ],
            saidas: {
                'Providências da homologação': quando('Resultado no juízo', 'Homologado'),
                'Negociação': quando('Resultado no juízo', 'Não homologado: rever os termos'),
                'Encerramento sem acordo': quando('Resultado no juízo', 'Não homologado ou retratação: encerrar'),
            },
        },
        {
            nome: 'Providências da homologação', unidade: 'Secretaria', nome_publico: 'Acordo homologado', vai: [depois],
            orientacao: `Homologado, o inteiro teor vai ao sítio do Ministério Público, salvo exceção justificada (${PROV}, art. 24), e o acordo entra no cadastro de acordos (Resolução CNMP 306/2025, art. 21). ${derivado ? 'O cumprimento passa a ser acompanhado em procedimento próprio, salvo se der para conferir nos autos judiciais (art. 19). Este processo de negociação é arquivado no próprio órgão (art. 15).' : 'O cumprimento passa a ser acompanhado (art. 19).'}`,
            acoes: [
                A.fazer('Encaminhar o inteiro teor para publicação no sítio', { obrigatoria: true }),
                A.fazer('Registrar o acordo no cadastro de acordos', { obrigatoria: true }),
                A.fazer('Dar ciência da homologação ao ente lesado', { obrigatoria: true }),
                A.fazer('Registrar o resultado no procedimento de origem', { obrigatoria: true }),
                ...(derivado ? [
                    A.escolha('Onde o cumprimento será acompanhado', ['Em processo de acompanhamento', 'Nos autos do processo judicial'], { obrigatoria: true, destino: 'autos' }),
                    A.fazer('Abrir o processo derivado de acompanhamento', { obrigatoria: true, se: quando('Onde o cumprimento será acompanhado', 'Em processo de acompanhamento'), ajuda: `Use ${DERIVADO}, com o tipo do modelo "Acordo de não persecução civil no MPRS: acompanhamento do cumprimento".` }),
                ] : []),
            ],
        },
    ];
}

const SEM_ACORDO = { nome: 'Encerramento sem acordo', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: `Sem consenso, o procedimento de negociação é arquivado no próprio órgão (${PROV}, art. 15), e a investigação ou a ação seguem no processo de origem. Registre lá o resultado. O que foi dito nas tratativas continua confidencial.` };

/** Fases do acompanhamento, do início da fiscalização ao cumprimento ou à remessa. */
function fasesAcompanhamento() {
    return [
        {
            nome: 'Início do acompanhamento', unidade: 'Secretaria', nome_publico: 'Início do cumprimento', vai: ['Acompanhamento do cumprimento'],
            orientacao: 'Monte o cronograma: cada parcela e cada obrigação, com o vencimento. É dele que saem as cobranças. Confira se as garantias e as indisponibilidades combinadas foram registradas. Avise o celebrante e o ente lesado de que os comprovantes e as informações chegam por este processo, pelo portal.',
            acoes: [
                A.textoLongo('Cronograma das obrigações e dos vencimentos', { obrigatoria: true, destino: 'informacao', folha_dados: true, ajuda: 'Uma linha por parcela ou obrigação: o que é, o valor e o vencimento.' }),
                A.data('Próximo vencimento', { obrigatoria: true, destino: 'informacao' }),
                A.fazer('Conferir o registro das garantias e das indisponibilidades', { ajuda: 'Garantias reais ou fidejussórias e bens indisponíveis previstos no acordo (art. 8º, XII e XIII).' }),
                A.comunicar('Informar como comprovar o cumprimento', { especie: 'comunicacao', polos: ['requerido', 'interessado'], dias: 0, texto: 'Este processo acompanha o cumprimento do acordo. Os comprovantes e as informações devem ser enviados por aqui, em "Peticionar", até cada vencimento.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Acompanhamento do cumprimento', unidade: 'Gabinete', nome_publico: 'Cumprimento em acompanhamento', prazo_dias: 365, prazo_auto: true, prazo_contagem: corridos,
            vai: ['Pedido de comprovação', 'Consulta ao ente lesado', 'Atraso ou descumprimento', 'Aditamento do acordo', 'Prorrogação do acompanhamento', 'Cumprimento integral'],
            orientacao: `A cada vencimento, confira o comprovante e, no que é devido ao ente lesado, confirme com ele o recebimento. O descumprimento injustificado, mesmo parcial, vence todas as obrigações de uma vez (${PROV}, art. 22): por isso todo atraso passa pela fase própria. O procedimento de acompanhamento dura 1 ano, prorrogável enquanto houver obrigação a vencer (Provimento 71/2017-PGJ).`,
            acoes: [
                A.fazer('Conferir os vencimentos do período'),
                A.documento('Juntar comprovantes, relatórios e extratos', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.numero('Total já pago ou devolvido (R$)', { destino: 'informacao' }),
                A.data('Próximo vencimento a conferir', { destino: 'informacao' }),
                A.escolha('Situação do cumprimento', ['Pedir comprovação ao celebrante', 'Confirmar com o ente lesado', 'Há atraso ou descumprimento', 'Aditar o acordo', 'Prorrogar o acompanhamento', 'Todas as obrigações cumpridas'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Pedido de comprovação': quando('Situação do cumprimento', 'Pedir comprovação ao celebrante'),
                'Consulta ao ente lesado': quando('Situação do cumprimento', 'Confirmar com o ente lesado'),
                'Atraso ou descumprimento': quando('Situação do cumprimento', 'Há atraso ou descumprimento'),
                'Aditamento do acordo': quando('Situação do cumprimento', 'Aditar o acordo'),
                'Prorrogação do acompanhamento': quando('Situação do cumprimento', 'Prorrogar o acompanhamento'),
                'Cumprimento integral': quando('Situação do cumprimento', 'Todas as obrigações cumpridas'),
            },
        },
        {
            nome: 'Pedido de comprovação', unidade: 'Secretaria', espera: true, avanco: 'auto', nome_publico: 'Aguardando comprovação',
            orientacao: 'Peça ao celebrante o comprovante da parcela ou da obrigação vencida. Com a resposta ou o fim do prazo, o processo volta ao acompanhamento.',
            acoes: [
                A.comunicar('Pedir a comprovação do cumprimento', { especie: 'notificacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Comprove, no prazo indicado, o cumprimento das obrigações do acordo indicadas a seguir. Envie os comprovantes por aqui, em "Peticionar".' }, { obrigatoria: true }),
                A.esperar('Aguardar a comprovação', 'Pedir a comprovação do cumprimento', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Consulta ao ente lesado', unidade: 'Secretaria', espera: true, avanco: 'auto', nome_publico: 'Aguardando a pessoa jurídica lesada',
            orientacao: 'Pergunte à pessoa jurídica lesada se recebeu os valores e os bens que o acordo lhe destina. Com a resposta ou o fim do prazo, o processo volta ao acompanhamento.',
            acoes: [
                A.comunicar('Pedir a confirmação do recebimento', { especie: 'notificacao', polos: ['interessado'], dias: 15, contagem: corridos, texto: 'Informe, no prazo indicado, se foram recebidos os valores e os bens previstos no acordo, com as datas e os comprovantes.' }, { obrigatoria: true }),
                A.esperar('Aguardar a confirmação', 'Pedir a confirmação do recebimento', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Prorrogação do acompanhamento', unidade: 'Gabinete', vai: ['Acompanhamento do cumprimento'],
            orientacao: 'Prorrogue por decisão fundamentada enquanto houver obrigação a vencer, como em todo procedimento administrativo de acompanhamento (Provimento 71/2017-PGJ).',
            acoes: [A.documento('Despacho de prorrogação fundamentada', 'Despacho', { forma: 'redigir' })],
        },
        {
            nome: 'Atraso ou descumprimento', unidade: 'Gabinete', nome_publico: 'Apuração de descumprimento', vai: ['Acompanhamento do cumprimento', 'Aditamento do acordo', 'Vencimento antecipado'],
            ao_entrar: { pendencia: 'Atraso ou descumprimento do acordo: ouvir o celebrante e decidir.' },
            orientacao: `Ouça o celebrante antes de concluir: só o descumprimento injustificado traz o vencimento antecipado (${PROV}, art. 22). Justificado ou regularizado, o acompanhamento segue, com a multa por atraso prevista no acordo (art. 8º, XI). Anote a data em que o Ministério Público soube do descumprimento: dela contam os 5 anos sem novo acordo (art. 3º, § 3º).`,
            acoes: [
                A.comunicar('Notificar o celebrante para justificar', { especie: 'notificacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Foi constatado atraso ou descumprimento das obrigações do acordo indicadas a seguir. Comprove o cumprimento ou justifique no prazo indicado. O descumprimento sem justificativa vence todas as obrigações.' }, { obrigatoria: true }),
                A.esperar('Aguardar a justificativa', 'Notificar o celebrante para justificar', { obrigatoria: true }),
                A.data('Data em que o Ministério Público soube do descumprimento', { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Decisão sobre o descumprimento', 'Despacho', { forma: 'redigir' }),
                A.escolha('Conclusão', ['Justificado ou regularizado: seguir acompanhando', 'Repactuar por aditamento', 'Descumprimento injustificado'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Acompanhamento do cumprimento': quando('Conclusão', 'Justificado ou regularizado: seguir acompanhando'),
                'Aditamento do acordo': quando('Conclusão', 'Repactuar por aditamento'),
                'Vencimento antecipado': quando('Conclusão', 'Descumprimento injustificado'),
            },
        },
        {
            nome: 'Aditamento do acordo', unidade: 'Gabinete', vai: ['Aprovação do aditamento', 'Acompanhamento do cumprimento'],
            orientacao: `O aditamento do acordo feito fora do juízo vai a nova aprovação do Conselho Superior, tenha ou não sido homologado, salvo entendimento sumulado em contrário (${PROV}, art. 16, parágrafo único). Leve-o também ao juízo que homologou o acordo e atualize o cronograma.`,
            acoes: [
                A.documento('Termo aditivo', 'Termo aditivo', { forma: 'qualquer' }),
                A.simNao('O aditamento vai a nova aprovação do Conselho Superior?', { obrigatoria: true, destino: 'autos', ajuda: 'A regra é sim; só não vai se houver súmula do Conselho em contrário, ou se o acordo foi feito já no curso da ação.' }),
                A.fazer('Levar o aditamento ao juízo da homologação', { obrigatoria: true }),
                A.comunicar('Entregar cópia do aditamento', { especie: 'comunicacao', polos: ['requerido', 'interessado'], dias: 0, texto: 'Segue cópia do termo aditivo ao acordo.' }),
            ],
            saidas: { 'Aprovação do aditamento': quando('O aditamento vai a nova aprovação do Conselho Superior?', 'sim'), 'Acompanhamento do cumprimento': quando('O aditamento vai a nova aprovação do Conselho Superior?', 'nao') },
        },
        {
            nome: 'Aprovação do aditamento', unidade: 'Conselho Superior', nome_publico: 'Análise do aditamento', vai: ['Acompanhamento do cumprimento', 'Atraso ou descumprimento'],
            ao_entrar: { pendencia: 'Deliberar sobre o aditamento do acordo de não persecução civil.' },
            orientacao: `O Conselho Superior aprecia o aditamento como apreciou o acordo (${PROV}, arts. 16 e 17). Aprovado, o acompanhamento segue com os novos prazos; sem aprovação, vale o acordo original e o atraso volta a ser apurado.`,
            acoes: [
                A.julgamento('Deliberação sobre o aditamento', ['Aprova o aditamento', 'Não aprova o aditamento'], {}, { obrigatoria: true }),
                A.documento('Juntar a decisão do colegiado', 'Decisão', { forma: 'juntar' }),
            ],
            saidas: { 'Acompanhamento do cumprimento': quando('Deliberação sobre o aditamento', 'Aprova o aditamento'), 'Atraso ou descumprimento': quando('Deliberação sobre o aditamento', 'Não aprova o aditamento') },
        },
        {
            nome: 'Vencimento antecipado', unidade: 'Gabinete', nome_publico: 'Acordo descumprido', vai: ['Remessa ao órgão de execução', 'Execução ou ação pelo próprio órgão'],
            ao_entrar: { urgente: true, pendencia: 'Acordo descumprido: certificar o vencimento antecipado e definir a providência judicial.' },
            orientacao: `Com o descumprimento injustificado, todas as medidas do acordo vencem de uma vez. Cabe executar o título, com as multas, ajuizar a ação de improbidade ou prosseguir na ação que estava em curso (${PROV}, art. 22; Resolução CNMP 306/2025, art. 19). A prova que o celebrante forneceu continua válida (art. 8º, XIX), e o acordo pode prever sanções maiores para esse caso (XV). Se a providência cabe a outro órgão de execução, remeta o caso completo a ele.`,
            acoes: [
                A.fazer('Certificar o vencimento antecipado de todas as obrigações', { obrigatoria: true, destino: 'autos' }),
                A.numero('Saldo devedor na data (R$)', { destino: 'informacao', folha_dados: true }),
                A.escolha('Providência', ['Executar o título', 'Ajuizar a ação de improbidade', 'Prosseguir na ação em curso'], { obrigatoria: true, destino: 'autos' }),
                A.fazer('Anotar no cadastro o impedimento de novo acordo por 5 anos', { obrigatoria: true }),
                A.comunicar('Dar ciência do vencimento antecipado', { especie: 'ciencia', polos: ['requerido', 'interessado'], dias: 0, texto: 'O acordo foi descumprido sem justificativa. Todas as obrigações venceram e o Ministério Público adotará a medida judicial cabível.' }, { obrigatoria: true }),
                A.simNao('A providência cabe a outro órgão de execução?', { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Remessa ao órgão de execução': quando('A providência cabe a outro órgão de execução?', 'sim'), 'Execução ou ação pelo próprio órgão': quando('A providência cabe a outro órgão de execução?', 'nao') },
        },
        {
            nome: 'Remessa ao órgão de execução', unidade: 'Secretaria', vai: ['Encerramento por descumprimento'],
            orientacao: 'Remeta ao órgão de execução responsável pela ação ou pela execução tudo de que ele precisa: o acordo, as decisões do Conselho Superior e do juízo, os comprovantes do que foi pago, o cálculo do saldo e a certidão do vencimento antecipado. Quando ele informar o número da ação, registre aqui.',
            acoes: [
                A.texto('Órgão de execução destinatário', { obrigatoria: true, destino: 'autos' }),
                A.documento('Despacho de remessa', 'Despacho', { forma: 'redigir' }),
                A.fazer('Remeter o acordo, as decisões, os comprovantes e o cálculo', { obrigatoria: true, destino: 'autos' }),
                A.data('Data da remessa', { obrigatoria: true, destino: 'informacao' }),
                A.texto('Número da ação ou da execução, quando informado', { destino: 'informacao' }),
            ],
        },
        {
            nome: 'Execução ou ação pelo próprio órgão', unidade: 'Gabinete', vai: ['Encerramento por descumprimento'],
            orientacao: 'Junte a petição e registre o número. Na ação que já estava em curso, junte o pedido de prosseguimento.',
            acoes: [
                A.documento('Juntar a petição', 'Petição', { forma: 'juntar' }),
                A.texto('Número da ação ou da execução', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Cumprimento integral', unidade: 'Gabinete', nome_publico: 'Acordo cumprido', vai: ['Arquivamento'],
            orientacao: `Cumprido tudo, o procedimento de acompanhamento é arquivado (${PROV}, art. 21). Informe o juízo; no acordo feito depois da sentença, só agora cabe pedir a extinção do processo (art. 2º, § 2º). Libere as garantias e os bens que ficaram indisponíveis.`,
            acoes: [
                A.documento('Promoção de arquivamento do acompanhamento', 'Promoção de arquivamento', { forma: 'redigir' }),
                A.fazer('Informar o cumprimento ao juízo', { obrigatoria: true }),
                A.fazer('Providenciar a liberação das garantias e dos bens indisponíveis'),
                A.fazer('Atualizar o cadastro de acordos', { obrigatoria: true }),
                A.comunicar('Dar ciência do cumprimento', { especie: 'ciencia', polos: ['requerido', 'interessado'], dias: 0, texto: 'Todas as obrigações do acordo foram cumpridas. O acompanhamento foi arquivado.' }, { obrigatoria: true }),
            ],
        },
        { nome: 'Encerramento por descumprimento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Proposta a execução ou a ação, ou feita a remessa ao órgão responsável, o acompanhamento se encerra. O impedimento de novo acordo dura 5 anos.' },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: `Arquivado ao entrar, no próprio órgão (${PROV}, art. 21).` },
    ];
}

const POLOS_ACORDO = { polos: ['requerido', 'interessado'], nomes_polos: { requerido: 'Celebrante', interessado: 'Ente lesado' } };
const BASE_ACORDO = `${PROV} (MPRS), que revogou o Provimento 68/2022-PGJ; Resolução CNMP 306/2025; Lei 8.429/1992, arts. 17, § 4º-A, e 17-B; Provimento 71/2017-PGJ, arts. 47, V e VI, e 70 (prazos em dias corridos); Resolução CNMP 174/2017, art. 8º, V e VI.`;

/** 1. Tratativas e celebração (procedimento de negociação). */
export function anpcTratativas() {
    return montar({
        id: 'anpc-tratativas-mprs', nome: 'Acordo de não persecução civil no MPRS: tratativas e celebração', area: 'ministerio_publico', porte: 'longo', referencia: 'MPRS',
        descricao: 'O procedimento de negociação do acordo de não persecução civil (também chamado de não persecução cível) em caso de improbidade administrativa, da primeira sinalização à homologação judicial. Começa em sigilo, porque as tratativas são confidenciais para terceiros. O membro avalia se o acordo cabe e pode recusar, com pedido de revisão ao Conselho Superior em 10 dias. Na negociação, as reuniões vão para ata, o dano é apurado sem desconto e o celebrante participa sempre com advogado ou defensor público. Fechados os termos, a pessoa jurídica lesada é ouvida, o acordo é assinado e, se for anterior à ação, vai ao Conselho Superior em 3 dias, que decide em até 60: aprova, pede ajustes, converte em diligência ou reprova. Por fim vem a homologação judicial. Homologado, o inteiro teor é publicado, o acordo entra no cadastro e o cumprimento passa ao processo de acompanhamento.',
        quando: 'Quando o investigado ou demandado por improbidade sinaliza interesse em acordo, ou o Ministério Público o propõe, em inquérito civil, procedimento preparatório, ação em curso ou cumprimento de sentença. Abra como processo derivado do procedimento de origem. Para acompanhar um acordo já homologado, use o modelo de acompanhamento; para tudo num processo só, o modelo "das tratativas ao cumprimento".',
        base: BASE_ACORDO,
        tipo: { polos: ['requerido'], nomes_polos: { requerido: 'Celebrante' } },
    }, [
        ...fasesTratativas({ depois: 'Arquivamento das tratativas', derivado: true }),
        SEM_ACORDO,
        { nome: 'Arquivamento das tratativas', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: `Arquivado ao entrar, no próprio órgão de execução, depois da homologação judicial (${PROV}, art. 15). O cumprimento segue no processo de acompanhamento.` },
    ]);
}

/** 2. Acompanhamento do cumprimento (procedimento de fiscalização). */
export function anpcAcompanhamento() {
    return montar({
        id: 'anpc-acompanhamento-mprs', nome: 'Acordo de não persecução civil no MPRS: acompanhamento do cumprimento', area: 'ministerio_publico', porte: 'longo', referencia: 'MPRS',
        descricao: 'Controla o acordo de não persecução civil (ou cível) já firmado, do registro na plataforma até o fim. Guarda os números do acordo (ressarcimento, devolução, multa civil, parcelas, garantias e sanções), as datas da aprovação pelo Conselho Superior e da homologação judicial, e o cronograma dos vencimentos. A cada vencimento, o celebrante comprova pelo portal e a pessoa jurídica lesada confirma o recebimento. Havendo atraso, o celebrante é ouvido: se justificar ou regularizar, o acompanhamento segue; se couber, o acordo é aditado, com nova aprovação do Conselho Superior. O descumprimento sem justificativa vence todas as obrigações de uma vez, impede novo acordo por 5 anos e leva à execução do título ou à ação de improbidade, pelo próprio órgão ou com remessa completa ao órgão de execução responsável. Cumprido tudo, o juízo é informado, as garantias são liberadas e o acompanhamento é arquivado.',
        quando: 'Depois da homologação judicial do acordo, quando o cumprimento não pode ser conferido só nos autos judiciais. Abra como processo derivado das tratativas ou do procedimento de origem, um processo por acordo. Para ver todos os acordos num quadro, use "Gerar painel e planilha" na Integração com o painel.',
        base: `${BASE_ACORDO} Quanto ao acompanhamento: ${PROV}, arts. 3º, § 3º (impedimento por 5 anos), 16, parágrafo único (aditamento), 19 (procedimento de acompanhamento), 21 (arquivamento) e 22 (vencimento antecipado).`,
        tipo: POLOS_ACORDO,
    }, [
        {
            nome: 'Registro do acordo firmado', unidade: 'Secretaria', nome_publico: 'Registro do acordo', vai: ['Início do acompanhamento'],
            orientacao: `Homologado o acordo, o membro instaura o procedimento de acompanhamento (${PROV}, art. 19; Provimento 71/2017-PGJ, art. 47, V). Registre os números e as datas, junte o instrumento e as decisões e cadastre as partes: o celebrante, com o advogado ou defensor como representante, e a pessoa jurídica lesada como interessada. Cada um recebe a própria conta no portal. Confira o que a homologação deixou por fazer: publicação do inteiro teor (art. 24), cadastro do acordo e envio à Justiça Eleitoral (art. 20).`,
            acoes: [
                A.formulario('Origem e controles', [
                    { id: 'origem', rotulo: 'Número das tratativas ou do procedimento de origem', tipo: 'texto', obrigatorio: true },
                    { id: 'celebrante', rotulo: 'Celebrante', tipo: 'texto', obrigatorio: true },
                    { id: 'ente', rotulo: 'Pessoa jurídica lesada', tipo: 'texto', obrigatorio: true },
                    { id: 'aprovacao', rotulo: 'Data da aprovação pelo Conselho Superior', tipo: 'data', obrigatorio: false },
                    { id: 'homologacao', rotulo: 'Data da homologação judicial', tipo: 'data', obrigatorio: true },
                    { id: 'processo', rotulo: 'Número do processo judicial', tipo: 'texto', obrigatorio: true },
                    { id: 'juizo', rotulo: 'Juízo', tipo: 'texto', obrigatorio: false },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.formulario('Dados do acordo', CAMPOS_ACORDO, { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o instrumento do acordo', 'Acordo de não persecução civil', { forma: 'juntar' }),
                A.documento('Juntar a decisão de homologação', 'Decisão', { forma: 'juntar' }),
                A.documento('Juntar a decisão do Conselho Superior', 'Decisão', { forma: 'juntar', nivel: 'opcional' }),
                A.fazer('Cadastrar o celebrante, o defensor e o ente lesado', { obrigatoria: true, ajuda: 'Na aba Andamento, em Partes: o defensor entra como representante do celebrante. Convide cada um para o portal.' }),
                A.fazer('Conferir a publicação do inteiro teor, o cadastro e o envio à Justiça Eleitoral', { obrigatoria: true }),
            ],
        },
        ...fasesAcompanhamento(),
    ]);
}

/** 3. Das tratativas ao cumprimento, num processo só. */
export function anpcCompleto() {
    return montar({
        id: 'anpc-completo-mprs', nome: 'Acordo de não persecução civil no MPRS: das tratativas ao cumprimento', area: 'ministerio_publico', porte: 'longo', referencia: 'MPRS',
        descricao: 'O acordo de não persecução civil (ou cível) inteiro num único processo: sinalização das tratativas, análise de cabimento, negociação com o celebrante e seu advogado ou defensor, oitiva da pessoa jurídica lesada, assinatura, aprovação pelo Conselho Superior, homologação judicial e, em seguida, o acompanhamento de cada vencimento até o cumprimento integral ou até o vencimento antecipado, com execução, ação de improbidade ou remessa ao órgão de execução responsável. Reúne as fases dos modelos de tratativas e de acompanhamento. O provimento do Ministério Público do RS prevê dois procedimentos; este modelo serve ao órgão que prefere controlar tudo num lugar só.',
        quando: 'Quando o órgão quer um processo único por acordo, sem abrir outro depois da homologação. Como as tratativas são confidenciais, a pessoa jurídica lesada só deve ser cadastrada como parte depois da homologação judicial. Se o órgão segue à risca a divisão do provimento, use os dois modelos separados.',
        base: BASE_ACORDO,
        tipo: POLOS_ACORDO,
    }, [
        ...fasesTratativas({ depois: 'Início do acompanhamento', derivado: false }),
        SEM_ACORDO,
        ...fasesAcompanhamento(),
    ]);
}

/** 4. Inquérito civil de improbidade administrativa (Lei 8.429/1992; Provimento 71/2017-PGJ). */
export function inqueritoCivilImprobidade() {
    return montar({
        id: 'inquerito-civil-improbidade-mprs', nome: 'Inquérito civil de improbidade administrativa (MPRS)', area: 'ministerio_publico', porte: 'longo', referencia: 'MPRS',
        descricao: 'A investigação de ato de improbidade administrativa pelo Ministério Público, com o que a Lei 8.429/1992 tem de próprio. Registra a data do fato, para o controle dos 8 anos de prescrição, e a modalidade apurada. A instrução corre em 365 dias corridos, prorrogáveis uma única vez, e garante ao investigado a manifestação por escrito e a juntada de documentos. No caminho cabem o pedido judicial de indisponibilidade de bens e a abertura de tratativas de acordo de não persecução civil, que correm em processo derivado e confidencial; homologado o acordo, outro processo derivado acompanha o cumprimento. Encerrada a instrução, a ação de improbidade é proposta em 30 dias, ou o arquivamento é promovido e sobe ao Conselho Superior. Sem improbidade ou com prescrição, ainda cabe ajustamento de conduta para recompor o patrimônio.',
        quando: 'Quando há notícia de enriquecimento ilícito, dano ao erário ou ofensa aos princípios da administração por agente público ou terceiro. Para valores pequenos ou fato já apurado pelo ente, use antes a "Triagem de representação sobre patrimônio público (MPRS)". Para lesão a outros direitos coletivos, use o "Inquérito Civil" geral.',
        base: `Lei 8.429/1992 (redação da Lei 14.230/2021), arts. 9º a 11 (modalidades), 16 (indisponibilidade), 17 e 17-B (ação e acordo), 22 (inquérito e manifestação do investigado) e 23 (prescrição e prazos do inquérito); ${PROV} (acordo de não persecução civil); Provimento 71/2017-PGJ (inquérito civil, arquivamento e prazos em dias corridos); Provimento 04/2012-PGJ (patrimônio público); Resolução CNMP 23/2007.`,
        tipo: { polos: ['requerente', 'requerido', 'interessado', 'terceiro'], nomes_polos: { requerente: 'Representante', requerido: 'Investigado', interessado: 'Ente lesado', terceiro: 'Órgão requisitado' } },
    }, [
        {
            nome: 'Representação ou atuação de ofício', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Recebimento',
            orientacao: 'Registre o fato, quem o teria praticado e a pessoa jurídica lesada. A data do fato é a base da prescrição, de 8 anos (Lei 8.429/1992, art. 23): se não for conhecida, registre a mais antiga possível.',
            acoes: [
                A.formulario('Registrar a origem', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['Representação', 'De ofício', 'Notícia de fato convertida', 'Procedimento preparatório convertido', 'Tribunal de Contas', 'Outro órgão'] },
                    { id: 'fato', rotulo: 'Fato noticiado', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'agente', rotulo: 'Agente público ou terceiro apontado', tipo: 'texto', obrigatorio: false },
                    { id: 'ente', rotulo: 'Pessoa jurídica lesada', tipo: 'texto', obrigatorio: true },
                    { id: 'data_fato', rotulo: 'Data do fato', tipo: 'data', obrigatorio: true },
                    { id: 'modalidade', rotulo: 'Modalidade em apuração', tipo: 'lista', obrigatorio: true, opcoes: ['Enriquecimento ilícito (art. 9º)', 'Dano ao erário (art. 10)', 'Ofensa aos princípios (art. 11)', 'A definir'] },
                    { id: 'valor', rotulo: 'Valor estimado do dano ou da vantagem (R$)', tipo: 'numero', obrigatorio: false },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a representação ou o termo', 'Representação', { forma: 'juntar', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Admissibilidade', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Instauração', 'Indeferimento da representação', 'Declínio de atribuição'],
            orientacao: 'Decida em 30 dias. A improbidade exige dolo e o enquadramento num dos tipos da lei: sem indícios disso, com prescrição consumada ou com o fato já apurado, indefira. Valores pequenos e fatos que o próprio ente pode apurar seguem o Provimento 04/2012-PGJ (modelo de triagem). Sem improbidade, mas com dano a recompor, o caminho pode ser o ajustamento de conduta.',
            acoes: [
                A.simNao('A pretensão está prescrita?', { obrigatoria: true, ajuda: 'Oito anos do fato ou, na infração permanente, do dia em que cessou (art. 23).' }),
                A.escolha('Juízo sobre a representação', ['Instaurar inquérito civil', 'Indeferir a representação', 'Declinar atribuição'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Instauração': quando('Juízo sobre a representação', 'Instaurar inquérito civil'), 'Indeferimento da representação': quando('Juízo sobre a representação', 'Indeferir a representação'), 'Declínio de atribuição': quando('Juízo sobre a representação', 'Declinar atribuição') },
        },
        {
            nome: 'Indeferimento da representação', unidade: 'Gabinete', vai: ['Cientificação e remessa ao Conselho Superior'],
            orientacao: 'Indefira por decisão fundamentada e dê ciência ao representante, que pode recorrer em 10 dias. Em matéria de patrimônio público, o indeferimento sobe ao Conselho Superior depois do prazo de recurso, haja ou não recurso (Provimento 71/2017-PGJ, art. 5º, § 6º).',
            acoes: [
                A.documento('Decisão de indeferimento', 'Despacho', { forma: 'redigir' }),
                A.comunicar('Dar ciência do indeferimento', { especie: 'ciencia', polos: ['requerente'], dias: 10, contagem: corridos, texto: 'A representação foi indeferida. Cabe recurso em 10 dias, apresentado neste processo. A decisão será revista pelo Conselho Superior.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Dar ciência do indeferimento', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Instauração', unidade: 'Gabinete', vai: ['Registro e publicação'],
            orientacao: 'Portaria com o fundamento legal, o fato, a modalidade de improbidade em apuração, a qualificação possível do investigado e as diligências iniciais. A instauração suspende a prescrição por até 180 dias (Lei 8.429/1992, art. 23, § 1º). Anote a data-limite da prescrição: ela orienta o ritmo da investigação.',
            acoes: [
                A.formulario('Dados da portaria', [
                    { id: 'fundamento', rotulo: 'Fundamento legal', tipo: 'texto', obrigatorio: true },
                    { id: 'fato', rotulo: 'Descrição do fato', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'investigado', rotulo: 'Investigado, se identificado', tipo: 'texto', obrigatorio: false },
                    { id: 'prescricao', rotulo: 'Data-limite estimada da prescrição', tipo: 'data', obrigatorio: true },
                    { id: 'diligencias', rotulo: 'Diligências iniciais', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Portaria de instauração', 'Portaria', { forma: 'redigir' }),
                A.simNao('Há sigilo legal ou risco à investigação?', { obrigatoria: true, ajuda: 'Se sim, decrete o sigilo por decisão motivada. A publicidade é a regra.' }),
                A.documento('Decisão de sigilo', 'Despacho', { forma: 'redigir', se: quando('Há sigilo legal ou risco à investigação?', 'sim') }),
            ],
        },
        {
            nome: 'Registro e publicação', unidade: 'Secretaria', avanco: 'auto', vai: ['Instrução'],
            orientacao: 'Registre a portaria no sistema e remeta o extrato para publicação. Cadastre o investigado e a pessoa jurídica lesada como partes, para as comunicações.',
            acoes: [
                A.fazer('Registrar a portaria no sistema', { obrigatoria: true }),
                A.fazer('Remeter a portaria para publicação', { obrigatoria: true }),
                A.comunicar('Comunicar a instauração ao representante', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Foi instaurado inquérito civil a partir da sua representação.' }),
            ],
        },
        {
            nome: 'Instrução', unidade: 'Gabinete', prazo_dias: 365, prazo_auto: true, prazo_contagem: corridos,
            vai: ['Aguardando resposta a requisição', 'Indisponibilidade de bens', 'Tratativas de acordo', 'Prorrogação', 'Declínio de atribuição', 'Conclusão'],
            orientacao: 'O inquérito de improbidade termina em 365 dias corridos, prorrogáveis uma única vez por igual prazo, por ato fundamentado submetido à revisão (Lei 8.429/1992, art. 23, § 2º). O investigado tem de ter a oportunidade de se manifestar por escrito e de juntar documentos (art. 22, parágrafo único). O acordo de não persecução civil cabe a qualquer tempo: as tratativas correm em processo derivado, e a investigação pode seguir quanto ao que elas não alcançam.',
            acoes: [
                A.fazer('Expedir requisições, notificações e diligências'),
                A.audiencia('Designar oitiva', 'oitiva'),
                A.comunicar('Notificar para a oitiva', { especie: 'notificacao', dias: 0, texto: 'Compareça para prestar declarações em {audiencia}.' }),
                A.comunicar('Abrir prazo para a manifestação do investigado', { especie: 'notificacao', polos: ['requerido'], dias: 15, contagem: corridos, texto: 'Você pode se manifestar por escrito e juntar documentos sobre os fatos em apuração, no prazo indicado. Envie por aqui, em "Peticionar".' }, { obrigatoria: true, ajuda: 'Garantia do art. 22, parágrafo único, da Lei 8.429/1992. O prazo é ajustável.' }),
                A.documento('Juntar termos, laudos e documentos', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.escolha('Próximo passo', ['Aguardar resposta a requisição', 'Pedir a indisponibilidade de bens', 'Abrir ou acompanhar tratativas de acordo', 'Prorrogar o prazo', 'Declinar atribuição', 'Concluir a investigação'], { obrigatoria: true }),
            ],
            saidas: {
                'Aguardando resposta a requisição': quando('Próximo passo', 'Aguardar resposta a requisição'),
                'Indisponibilidade de bens': quando('Próximo passo', 'Pedir a indisponibilidade de bens'),
                'Tratativas de acordo': quando('Próximo passo', 'Abrir ou acompanhar tratativas de acordo'),
                'Prorrogação': quando('Próximo passo', 'Prorrogar o prazo'),
                'Declínio de atribuição': quando('Próximo passo', 'Declinar atribuição'),
                'Conclusão': quando('Próximo passo', 'Concluir a investigação'),
            },
        },
        {
            nome: 'Aguardando resposta a requisição', unidade: 'Secretaria', espera: true, avanco: 'auto', nome_publico: 'Aguardando informações',
            orientacao: 'Requisite ao investigado, ao ente lesado ou ao órgão requisitado (cadastre-o como parte). O prazo não pode ser inferior a 10 dias úteis (Lei 7.347/1985, art. 8º, § 1º). Com a resposta ou o fim do prazo, volta à instrução.',
            acoes: [
                A.comunicar('Requisitar informações e documentos', { especie: 'notificacao', polos: ['requerido', 'interessado', 'terceiro'], dias: 10, texto: 'Encaminhe, no prazo indicado, as informações e os documentos requisitados a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta', 'Requisitar informações e documentos', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Indisponibilidade de bens', unidade: 'Gabinete', vai: ['Instrução'],
            orientacao: 'O pedido de indisponibilidade é judicial e pode ser feito antes da ação, para garantir o ressarcimento e a devolução do acréscimo patrimonial (Lei 8.429/1992, art. 16). Registre o número e o resultado; a investigação segue.',
            acoes: [
                A.documento('Juntar o pedido de indisponibilidade', 'Petição', { forma: 'juntar' }),
                A.texto('Número do processo judicial', { obrigatoria: true, destino: 'autos' }),
                A.escolha('Decisão do juízo', ['Deferida', 'Deferida em parte', 'Indeferida', 'Ainda sem decisão'], { destino: 'autos' }),
            ],
        },
        {
            nome: 'Tratativas de acordo', unidade: 'Gabinete', nome_publico: 'Tratativas de acordo em andamento', vai: ['Instrução', 'Acordo homologado'],
            orientacao: `As tratativas do acordo de não persecução civil não correm nestes autos: abrem-se em procedimento próprio e confidencial (${PROV}, art. 11, §§ 1º e 2º). Use ${DERIVADO}, com o tipo do modelo de tratativas; ele fica vinculado a este inquérito. Enquanto se negocia, a investigação pode seguir. Acordo que esgota o objeto: os autos deste inquérito sobem ao Conselho Superior junto com os da negociação (art. 14). Acordo parcial: extraia peças e siga aqui quanto ao resto.`,
            acoes: [
                A.fazer('Abrir o processo derivado de tratativas', { obrigatoria: true, ajuda: `Use ${DERIVADO}, com o tipo do modelo "Acordo de não persecução civil no MPRS: tratativas e celebração".` }),
                A.texto('Número do processo de tratativas', { destino: 'informacao', folha_dados: true }),
                A.escolha('Resultado das tratativas', ['Acordo homologado que esgota o objeto', 'Acordo parcial: a investigação segue', 'Sem acordo: a investigação segue', 'Ainda em negociação: seguir investigando'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Acordo homologado': quando('Resultado das tratativas', 'Acordo homologado que esgota o objeto'),
                'Instrução': quando('Resultado das tratativas', 'Acordo parcial: a investigação segue', 'Sem acordo: a investigação segue', 'Ainda em negociação: seguir investigando'),
            },
        },
        {
            nome: 'Acordo homologado', unidade: 'Secretaria', vai: ['Arquivamento'],
            orientacao: `Com o acordo aprovado pelo Conselho Superior e homologado pelo juízo, o inquérito se encerra quanto ao que o acordo alcança. O cumprimento é acompanhado em outro processo derivado, salvo se der para conferir nos autos judiciais (${PROV}, art. 19).`,
            acoes: [
                A.texto('Número do processo judicial da homologação', { obrigatoria: true, destino: 'autos' }),
                A.data('Data da homologação', { obrigatoria: true, destino: 'informacao' }),
                A.fazer('Abrir o processo derivado de acompanhamento do acordo', { ajuda: `Use ${DERIVADO}, com o tipo do modelo "Acordo de não persecução civil no MPRS: acompanhamento do cumprimento".` }),
                A.texto('Número do processo de acompanhamento', { destino: 'informacao', folha_dados: true }),
            ],
        },
        {
            nome: 'Prorrogação', unidade: 'Gabinete', vai: ['Instrução'],
            orientacao: 'A prorrogação é uma só, por até 365 dias, em ato fundamentado submetido à revisão do Conselho Superior (Lei 8.429/1992, art. 23, § 2º). Depois dela, a ação é proposta em 30 dias ou o inquérito é arquivado (§ 3º).',
            acoes: [
                A.simNao('O prazo já foi prorrogado antes?', { obrigatoria: true, destino: 'autos', ajuda: 'Se sim, não cabe nova prorrogação: conclua a investigação.' }),
                A.documento('Despacho de prorrogação fundamentada', 'Despacho', { forma: 'redigir', se: quando('O prazo já foi prorrogado antes?', 'nao') }),
                A.fazer('Submeter a prorrogação à revisão do Conselho Superior', { obrigatoria: true, se: quando('O prazo já foi prorrogado antes?', 'nao') }),
            ],
        },
        {
            nome: 'Declínio de atribuição', unidade: 'Gabinete', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Revisão pelo Conselho Superior'],
            orientacao: 'Se a atribuição for de outro Ministério Público, submeta a decisão de declínio ao Conselho Superior em 3 dias.',
            acoes: [
                A.documento('Decisão de declínio de atribuição', 'Despacho', { forma: 'redigir' }),
                A.fazer('Submeter o declínio ao Conselho Superior', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Conclusão', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Ajuizamento da ação de improbidade', 'Ajustamento de conduta', 'Cientificação e remessa ao Conselho Superior'],
            ao_entrar: { pendencia: 'Concluir o inquérito de improbidade: ajuizar a ação em 30 dias, promover o arquivamento ou ajustar a conduta.' },
            orientacao: `Encerrado o prazo do inquérito, a ação é proposta em 30 dias, se não for caso de arquivamento (Lei 8.429/1992, art. 23, § 3º). Se o membro afastar a improbidade ou constatar a prescrição das sanções, ainda cabe ajustamento de conduta para recompor o patrimônio ou corrigir irregularidades (${PROV}, art. 23). O acordo de não persecução civil continua possível depois da ação.`,
            acoes: [
                A.escolha('Conclusão', ['Ajuizar a ação de improbidade', 'Celebrar ajustamento de conduta', 'Promover o arquivamento'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Promoção de arquivamento', 'Promoção de arquivamento', { forma: 'redigir', se: quando('Conclusão', 'Promover o arquivamento') }),
            ],
            saidas: {
                'Ajuizamento da ação de improbidade': quando('Conclusão', 'Ajuizar a ação de improbidade'),
                'Ajustamento de conduta': quando('Conclusão', 'Celebrar ajustamento de conduta'),
                'Cientificação e remessa ao Conselho Superior': quando('Conclusão', 'Promover o arquivamento'),
            },
        },
        {
            nome: 'Ajuizamento da ação de improbidade', unidade: 'Gabinete', vai: ['Arquivamento'],
            orientacao: 'Junte a petição inicial e registre o número da ação. O inquérito se encerra com o ajuizamento. Se depois houver acordo, as tratativas e o acompanhamento correm em processos derivados deste.',
            acoes: [
                A.documento('Juntar a petição inicial', 'Petição inicial', { forma: 'juntar' }),
                A.texto('Número da ação ajuizada', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Ajustamento de conduta', unidade: 'Gabinete', vai: ['Cientificação e remessa ao Conselho Superior', 'Conclusão'],
            orientacao: `Só quando a improbidade foi afastada ou as sanções prescreveram, por decisão motivada (${PROV}, art. 23). O compromisso corre no rito próprio, em processo derivado deste. Firmado, promova o arquivamento do inquérito.`,
            acoes: [
                A.documento('Decisão que afasta a improbidade ou reconhece a prescrição', 'Despacho', { forma: 'redigir' }),
                A.fazer('Abrir o processo derivado de ajustamento de conduta', { ajuda: `Use ${DERIVADO}, com o tipo do modelo "Compromisso de ajustamento de conduta (TAC)".` }),
                A.simNao('Ajustamento firmado?', { obrigatoria: true, destino: 'autos' }),
                A.documento('Promoção de arquivamento', 'Promoção de arquivamento', { forma: 'redigir', se: quando('Ajustamento firmado?', 'sim') }),
            ],
            saidas: { 'Cientificação e remessa ao Conselho Superior': quando('Ajustamento firmado?', 'sim'), 'Conclusão': quando('Ajustamento firmado?', 'nao') },
        },
        {
            nome: 'Cientificação e remessa ao Conselho Superior', unidade: 'Secretaria', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Revisão pelo Conselho Superior'],
            orientacao: 'Cientifique os interessados; não localizados, publique. Remeta os autos ao Conselho Superior em 3 dias da cientificação comprovada (Provimento 71/2017-PGJ, art. 22, § 1º).',
            acoes: [
                A.comunicar('Dar ciência aos interessados', { especie: 'ciencia', polos: ['requerente', 'requerido', 'interessado'], dias: 0, texto: 'Os autos serão remetidos ao Conselho Superior. Até a sessão, você pode apresentar razões escritas ou documentos.' }, { obrigatoria: true }),
                A.fazer('Publicar a cientificação de quem não foi localizado'),
                A.fazer('Remeter os autos ao Conselho Superior', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Revisão pelo Conselho Superior', unidade: 'Conselho Superior', vai: ['Arquivamento', 'Instrução', 'Designação de outro membro'], nome_publico: 'Revisão pelo colegiado',
            ao_entrar: { pendencia: 'Pautar e deliberar sobre a promoção, o indeferimento ou o declínio.' },
            orientacao: 'O colegiado homologa, converte em diligência ou rejeita e manda prosseguir, com a designação de outro membro.',
            acoes: [
                A.audiencia('Pautar a sessão de revisão', 'sessao'),
                A.comunicar('Comunicar a pauta aos interessados', { especie: 'comunicacao', dias: 0, texto: 'O caso será apreciado na sessão de {audiencia}.' }),
                A.julgamento('Deliberação', ['Homologa', 'Converte em diligência', 'Rejeita e designa outro membro'], {}, { obrigatoria: true }),
                A.documento('Juntar a decisão do colegiado', 'Decisão', { forma: 'juntar' }),
            ],
            saidas: { 'Arquivamento': quando('Deliberação', 'Homologa'), 'Instrução': quando('Deliberação', 'Converte em diligência'), 'Designação de outro membro': quando('Deliberação', 'Rejeita e designa outro membro') },
        },
        {
            nome: 'Designação de outro membro', unidade: 'Secretaria', vai: ['Instauração', 'Instrução'],
            orientacao: 'Registre o membro designado. Rejeitado o indeferimento, ele instaura o inquérito; rejeitado o arquivamento, prossegue na instrução.',
            acoes: [
                A.texto('Membro designado', { obrigatoria: true, destino: 'autos' }),
                A.simNao('O inquérito civil já foi instaurado?', { obrigatoria: true }),
            ],
            saidas: { 'Instrução': quando('O inquérito civil já foi instaurado?', 'sim'), 'Instauração': quando('O inquérito civil já foi instaurado?', 'nao') },
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Homologado o declínio, remeta antes os autos ao Ministério Público com atribuição. Os processos derivados de tratativas e de acompanhamento do acordo seguem a própria vida.' },
    ]);
}

export const modelos = [inqueritoCivilImprobidade, anpcTratativas, anpcAcompanhamento, anpcCompleto];
