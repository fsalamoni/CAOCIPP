// Modelos da área contratacoes. Ver a forma de escrever em ./dsl.js e o exemplo em ./geral.js.
// Lei 14.133/2021: os prazos são em dias úteis (art. 183), que é a contagem padrão do motor.
import { A, montar, quando } from './dsl.js';

/** Campos do documento de formalização de demanda (Decreto 10.947/2022, art. 8º). */
const camposDfd = [
    { id: 'objeto', rotulo: 'Descrição sucinta do objeto', tipo: 'texto_longo', obrigatorio: true },
    { id: 'justificativa', rotulo: 'Justificativa da necessidade', tipo: 'texto_longo', obrigatorio: true },
    { id: 'quantidade', rotulo: 'Quantidade', tipo: 'numero', obrigatorio: true },
    { id: 'valor', rotulo: 'Estimativa preliminar de valor (R$)', tipo: 'numero', obrigatorio: true },
    { id: 'data', rotulo: 'Data pretendida para a contratação', tipo: 'data', obrigatorio: true },
    { id: 'prioridade', rotulo: 'Grau de prioridade', tipo: 'lista', obrigatorio: true, opcoes: ['Alta', 'Média', 'Baixa'] },
];

const camposDotacao = [
    { id: 'dotacao', rotulo: 'Dotação orçamentária', tipo: 'texto', obrigatorio: true },
    { id: 'valor', rotulo: 'Valor reservado (R$)', tipo: 'numero', obrigatorio: true },
    { id: 'reserva', rotulo: 'Número da reserva ou pré-empenho', tipo: 'texto', obrigatorio: false },
];

const camposPncp = [
    { id: 'pncp', rotulo: 'Número de controle no PNCP', tipo: 'texto', obrigatorio: true },
    { id: 'assinatura', rotulo: 'Data da assinatura', tipo: 'data', obrigatorio: true },
    { id: 'publicacao', rotulo: 'Data da divulgação no PNCP', tipo: 'data', obrigatorio: true },
    { id: 'valor', rotulo: 'Valor do contrato (R$)', tipo: 'numero', obrigatorio: true },
    { id: 'vigencia', rotulo: 'Fim da vigência', tipo: 'data', obrigatorio: true },
];

/** 7. Contratação pública completa por licitação (Lei 14.133/2021). */
export function licitacao() {
    return montar({
        id: 'licitacao', nome: 'Contratação pública por licitação', area: 'contratacoes', porte: 'longo', referencia: 'Lei 14.133',
        descricao: 'Caminho inteiro de uma compra ou contratação pública por pregão ou concorrência, da formalização da demanda até o contrato publicado no PNCP. A fase preparatória reúne DFD, estudo técnico preliminar com mapa de riscos, termo de referência, pesquisa de preços, reserva orçamentária, minutas e parecer jurídico, e termina com a autorização da autoridade. A fase externa publica o edital, responde esclarecimentos e impugnações, realiza a sessão pública, julga, habilita e abre a fase recursal, em que os licitantes recorrem e contrarrazoam com prazos de 3 dias úteis. Termina com adjudicação, homologação, assinatura e publicação do contrato, ou com licitação deserta ou fracassada, revogação ou anulação.',
        quando: 'Aquisições de bens, serviços e obras que exigem licitação na modalidade pregão ou concorrência. Para dispensa ou inexigibilidade, use o modelo de contratação direta.',
        base: 'Lei 14.133/2021, arts. 6º, XXIII, 8º, 17, 18, 21, 23, 25, 53 a 55, 59, 61 a 64, 71, 90, 94 a 96, 164, 165 e 168; Decreto 10.947/2022, arts. 8º a 11; IN SEGES 58/2022; IN SEGES 65/2021, arts. 5º e 6º; IN SEGES 73/2022, arts. 23, 24, 29 e 40.',
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Área requisitante', interessado: 'Licitante' } },
    }, [
        {
            nome: 'Formalização da demanda', unidade: 'Área requisitante', avanco: 'auto', nome_publico: 'Demanda',
            orientacao: 'Registre a necessidade no documento de formalização de demanda, com justificativa, objeto, quantidade, estimativa preliminar de valor, data pretendida e prioridade (Decreto 10.947/2022, art. 8º). Para entrar no plano de contratações anual, a demanda deve ser enviada até 1º de abril do ano de elaboração do plano (art. 10).',
            acoes: [
                A.formulario('Preencher os dados da demanda', camposDfd, { obrigatoria: true, destino: 'autos', folha_dados: true }),
                A.documento('Juntar o documento de formalização de demanda', 'DFD', { forma: 'qualquer' }),
            ],
        },
        {
            nome: 'Verificação no plano anual', unidade: 'Setor de compras', avanco: 'auto',
            orientacao: 'Confira se a demanda está no plano de contratações anual (Lei 14.133, art. 18, caput; Decreto 10.947/2022, art. 11). Se não estiver, registre a justificativa para a inclusão ou para a contratação fora do plano.',
            acoes: [
                A.simNao('A demanda consta do plano de contratações anual?', { obrigatoria: true }),
                A.textoLongo('Justificar a contratação fora do plano', { obrigatoria: true, se: quando('A demanda consta do plano de contratações anual?', 'nao') }),
            ],
        },
        {
            nome: 'Designação da equipe de planejamento', unidade: 'Gabinete', avanco: 'auto',
            orientacao: 'A autoridade competente designa a equipe de planejamento da contratação, com representantes da área requisitante e da área técnica.',
            acoes: [A.documento('Juntar a portaria ou o despacho de designação', 'Portaria', { forma: 'redigir' })],
        },
        {
            nome: 'Estudo técnico preliminar', unidade: 'Área requisitante', vai: ['Termo de referência', 'Arquivamento'],
            orientacao: 'O ETP descreve a necessidade, os requisitos, o levantamento de mercado e a solução escolhida, a estimativa de quantidades e de valor e a conclusão sobre a viabilidade (Lei 14.133, art. 18, § 1º; IN SEGES 58/2022, arts. 6º e 9º). Pode ser dispensado nas hipóteses do art. 14 da IN 58/2022. Junte também o mapa de riscos. Se o estudo apontar dispensa ou inexigibilidade, encerre aqui e abra o rito de contratação direta.',
            acoes: [
                A.escolha('Estudo técnico preliminar', ['Elaborado', 'Dispensado (IN 58/2022, art. 14)'], { obrigatoria: true }),
                A.documento('Juntar o estudo técnico preliminar', 'Estudo técnico preliminar', { forma: 'redigir', se: quando('Estudo técnico preliminar', 'Elaborado') }),
                A.textoLongo('Justificar a dispensa do ETP', { obrigatoria: true, se: quando('Estudo técnico preliminar', 'Dispensado (IN 58/2022, art. 14)') }),
                A.documento('Juntar o mapa de riscos', 'Mapa de riscos', { forma: 'redigir' }),
                A.escolha('Conclusão', ['Viável por licitação', 'Caso de contratação direta', 'Inviável, não contratar'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Despacho de encerramento', 'Despacho', { forma: 'redigir', se: quando('Conclusão', 'Caso de contratação direta', 'Inviável, não contratar'), ajuda: 'Na contratação direta, indique que a demanda segue pelo rito próprio (Lei 14.133, art. 72).' }),
            ],
            saidas: { 'Termo de referência': quando('Conclusão', 'Viável por licitação'), 'Arquivamento': quando('Conclusão', 'Caso de contratação direta', 'Inviável, não contratar') },
        },
        {
            nome: 'Termo de referência', unidade: 'Área requisitante', avanco: 'auto',
            orientacao: 'Elabore o termo de referência (ou o projeto básico, em obras e serviços de engenharia) com o conteúdo mínimo do art. 6º, XXIII: definição do objeto, fundamentação com referência ao ETP, descrição da solução, requisitos, modelo de execução e de gestão, critérios de medição e pagamento, forma de seleção do fornecedor e estimativa do valor (art. 18, II).',
            acoes: [A.documento('Juntar o termo de referência', 'Termo de referência', { forma: 'redigir' })],
        },
        {
            nome: 'Pesquisa de preços', unidade: 'Setor de compras', vai: ['Disponibilidade orçamentária', 'Cotações com fornecedores'],
            orientacao: 'Use os parâmetros do art. 5º da IN SEGES 65/2021: sistemas oficiais, contratações similares do último ano, mídia especializada e fornecedores. O preço estimado sai da média, da mediana ou do menor valor sobre três ou mais preços (art. 6º). Se precisar pedir cotações, mande o processo para a espera de cotações; ele volta para cá quando elas chegarem.',
            acoes: [
                A.orientar('Consultar as fontes do art. 5º da IN 65/2021', 'Prefira painel de preços e contratações similares; cotação direta com fornecedor complementa as demais fontes.'),
                A.documento('Juntar o mapa comparativo de preços', 'Mapa comparativo de preços', { forma: 'qualquer' }),
                A.escolha('Método de cálculo', ['Média', 'Mediana', 'Menor valor'], { obrigatoria: true }),
                A.numero('Valor estimado da contratação (R$)', { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a nota técnica da pesquisa', 'Nota técnica', { forma: 'redigir', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Disponibilidade orçamentária', unidade: 'Setor financeiro', avanco: 'auto',
            orientacao: 'Indique a dotação que vai suportar a despesa e declare a adequação orçamentária. Em registro de preços, a indicação de dotação só é exigida na contratação.',
            acoes: [
                A.formulario('Registrar a dotação e a reserva', camposDotacao, { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a declaração de adequação orçamentária', 'Declaração', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Minuta de edital e de contrato', unidade: 'Setor de compras', avanco: 'auto',
            orientacao: 'Elabore as minutas do edital e do contrato (art. 18, V e VI; art. 25). Defina modalidade, critério de julgamento e modo de disputa. Se for o caso, faça antes audiência pública (convocada com 8 dias úteis de antecedência) ou consulta pública sobre a licitação (art. 21).',
            acoes: [
                A.formulario('Definir a licitação', [
                    { id: 'modalidade', rotulo: 'Modalidade', tipo: 'lista', obrigatorio: true, opcoes: ['Pregão', 'Concorrência'] },
                    { id: 'criterio', rotulo: 'Critério de julgamento', tipo: 'lista', obrigatorio: true, opcoes: ['Menor preço', 'Maior desconto', 'Técnica e preço', 'Melhor técnica ou conteúdo artístico', 'Maior retorno econômico'] },
                    { id: 'disputa', rotulo: 'Modo de disputa', tipo: 'lista', obrigatorio: true, opcoes: ['Aberto', 'Aberto e fechado', 'Fechado'] },
                    { id: 'objeto', rotulo: 'Natureza do objeto', tipo: 'lista', obrigatorio: true, opcoes: ['Bens', 'Serviços comuns', 'Serviços especiais', 'Obras e serviços de engenharia comuns', 'Obras e serviços de engenharia especiais'] },
                    { id: 'srp', rotulo: 'Registro de preços', tipo: 'sim_nao', obrigatorio: true },
                ], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a minuta do edital', 'Edital', { forma: 'redigir' }),
                A.documento('Juntar a minuta do contrato', 'Contrato', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Parecer jurídico', unidade: 'Assessoria jurídica', prazo_dias: 15, avanco: 'auto',
            orientacao: 'Controle prévio de legalidade, obrigatório ao fim da fase preparatória (art. 53). Pode ser dispensado nas hipóteses fixadas pela autoridade jurídica máxima, como baixo valor ou minuta padronizada (art. 53, § 5º). A Lei 14.133 não fixa prazo; os 15 dias são referência da Lei 9.784, art. 42.',
            acoes: [
                A.escolha('Manifestação jurídica', ['Parecer emitido', 'Dispensado (art. 53, § 5º)'], { obrigatoria: true }),
                A.documento('Juntar o parecer jurídico', 'Parecer', { forma: 'redigir', se: quando('Manifestação jurídica', 'Parecer emitido') }),
                A.escolha('Conclusão do parecer', ['Favorável', 'Favorável com ressalvas', 'Desfavorável'], { obrigatoria: true, destino: 'autos', se: quando('Manifestação jurídica', 'Parecer emitido') }),
                A.texto('Ato que dispensa o parecer', { obrigatoria: true, se: quando('Manifestação jurídica', 'Dispensado (art. 53, § 5º)') }),
            ],
        },
        {
            nome: 'Ajustes e autorização', unidade: 'Gabinete', vai: ['Publicação do edital', 'Minuta de edital e de contrato', 'Arquivamento'],
            ao_entrar: { pendencia: 'Autorizar a abertura da licitação ou devolver para ajustes' },
            orientacao: 'A autoridade competente aprecia o parecer: atende às recomendações ou justifica por que não as segue, e autoriza a abertura da licitação. Ajustes nas minutas voltam ao setor de compras.',
            acoes: [
                A.escolha('Decisão sobre a abertura', ['Autorizar a abertura', 'Devolver para ajustes', 'Não autorizar'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o despacho de autorização ou de ajustes', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: { 'Publicação do edital': quando('Decisão sobre a abertura', 'Autorizar a abertura'), 'Minuta de edital e de contrato': quando('Decisão sobre a abertura', 'Devolver para ajustes'), 'Arquivamento': quando('Decisão sobre a abertura', 'Não autorizar') },
        },
        {
            nome: 'Publicação do edital', unidade: 'Agente de contratação', avanco: 'auto',
            orientacao: 'Divulgue o inteiro teor do edital e dos anexos no PNCP (art. 54) e o extrato no diário oficial e em jornal, quando exigido. Prazos mínimos até a abertura, em dias úteis da divulgação (art. 55): bens, 8 (menor preço ou maior desconto) ou 15 (demais critérios); serviços e obras comuns, 10; serviços e obras especiais, 25; contratação semi-integrada, 35; integrada, 60; técnica e preço ou melhor técnica, 35.',
            acoes: [
                A.documento('Juntar o edital definitivo', 'Edital', { forma: 'qualquer' }),
                A.formulario('Registrar a divulgação', [
                    { id: 'pncp', rotulo: 'Número de controle no PNCP', tipo: 'texto', obrigatorio: true },
                    { id: 'divulgacao', rotulo: 'Data da divulgação', tipo: 'data', obrigatorio: true },
                    { id: 'abertura', rotulo: 'Data da sessão pública', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Esclarecimentos e impugnações', unidade: 'Agente de contratação', vai: ['Sessão pública', 'Publicação do edital'], padrao: 'Sessão pública',
            orientacao: 'Qualquer pessoa pode pedir esclarecimento ou impugnar o edital até 3 dias úteis antes da abertura; a resposta sai em até 3 dias úteis, no máximo até o último dia útil anterior à abertura, e é divulgada no sítio oficial (art. 164). Se a resposta mudar o edital de modo que afete as propostas, republique e reabra o prazo (art. 55, § 1º).',
            acoes: [
                A.simNao('Houve pedido de esclarecimento ou impugnação?', { obrigatoria: true }),
                A.documento('Juntar os pedidos e as respostas', 'Resposta', { forma: 'qualquer', se: quando('Houve pedido de esclarecimento ou impugnação?', 'sim') }),
                A.comunicar('Comunicar a resposta ao interessado', { especie: 'comunicacao', polos: ['interessado'], dias: 0, texto: 'Segue a resposta ao seu pedido de esclarecimento ou impugnação, também divulgada no sítio oficial.' }, { se: quando('Houve pedido de esclarecimento ou impugnação?', 'sim') }),
                A.escolha('Efeito da resposta no edital', ['Sem alteração', 'Alteração que não afeta as propostas', 'Alteração que afeta as propostas'], { obrigatoria: true, se: quando('Houve pedido de esclarecimento ou impugnação?', 'sim') }),
            ],
            saidas: { 'Publicação do edital': quando('Efeito da resposta no edital', 'Alteração que afeta as propostas') },
        },
        {
            nome: 'Sessão pública', unidade: 'Agente de contratação', vai: ['Julgamento e negociação', 'Licitação deserta ou fracassada'],
            orientacao: 'A sessão ocorre na data do edital. No modo aberto, a etapa de lances dura 10 minutos, com prorrogações automáticas de 2 minutos; no aberto e fechado, 15 minutos, fechamento aleatório em até 10 minutos e lance final fechado em 5 minutos (IN 73/2022, arts. 23 e 24). A ata sai do sistema; sessão presencial é gravada em áudio e vídeo e a gravação vai aos autos (art. 17, §§ 2º e 5º). Sem propostas, a licitação é deserta.',
            acoes: [
                A.audiencia('Designar a sessão pública', 'sessao', { obrigatoria: true }),
                A.comunicar('Comunicar a sessão aos licitantes', { especie: 'comunicacao', polos: ['interessado'], dias: 0, texto: 'A sessão pública da licitação será realizada em {audiencia}.' }),
                A.simNao('Houve propostas?', { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a ata da sessão', 'Ata', { forma: 'juntar' }),
                A.documento('Juntar a gravação da sessão presencial', 'Gravação', { forma: 'juntar', nivel: 'opcional' }),
            ],
            saidas: { 'Julgamento e negociação': quando('Houve propostas?', 'sim'), 'Licitação deserta ou fracassada': quando('Houve propostas?', 'nao') },
        },
        {
            nome: 'Julgamento e negociação', unidade: 'Agente de contratação', vai: ['Habilitação', 'Licitação deserta ou fracassada'],
            orientacao: 'Verifique a conformidade da proposta mais bem classificada, o que pode se limitar a ela (art. 59, § 1º), e negocie condições melhores com o primeiro colocado (art. 61). A proposta ajustada é enviada em no mínimo 2 horas (IN 73/2022, art. 29, § 2º). Desclassificada a proposta, convoque o próximo colocado nesta mesma fase. Se todas forem desclassificadas, a licitação é fracassada.',
            acoes: [
                A.comunicar('Convocar o licitante para enviar a proposta ajustada', { especie: 'comunicacao', polos: ['interessado'], dias: 0, texto: 'Envie a proposta ajustada ao lance final no prazo fixado pelo agente de contratação, não inferior a 2 horas.' }),
                A.documento('Juntar a proposta ajustada', 'Proposta', { forma: 'juntar' }),
                A.escolha('Resultado do julgamento', ['Proposta aceita', 'Todas as propostas desclassificadas'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Habilitação': quando('Resultado do julgamento', 'Proposta aceita'), 'Licitação deserta ou fracassada': quando('Resultado do julgamento', 'Todas as propostas desclassificadas') },
        },
        {
            nome: 'Habilitação', unidade: 'Agente de contratação', vai: ['Recursos', 'Diligência de habilitação', 'Julgamento e negociação', 'Licitação deserta ou fracassada'],
            orientacao: 'Confira a habilitação jurídica, técnica, fiscal, social e trabalhista e econômico-financeira (art. 62). Para complementar ou atualizar documentos, faça diligência ao licitante (art. 64). Inabilitado o primeiro, volte ao julgamento para a proposta do próximo colocado.',
            acoes: [
                A.documento('Juntar os documentos de habilitação', 'Documentos de habilitação', { forma: 'juntar' }),
                A.escolha('Resultado da habilitação', ['Habilitado', 'Diligência ao licitante', 'Inabilitado, chamar o próximo', 'Todos inabilitados'], { obrigatoria: true, destino: 'autos' }),
                A.comunicar('Comunicar o resultado aos licitantes', { especie: 'comunicacao', polos: ['interessado'], dias: 0, texto: 'Fica comunicado o resultado do julgamento e da habilitação. A intenção de recorrer deve ser manifestada de imediato, na sessão.' }, { se: quando('Resultado da habilitação', 'Habilitado') }),
            ],
            saidas: {
                'Recursos': quando('Resultado da habilitação', 'Habilitado'),
                'Diligência de habilitação': quando('Resultado da habilitação', 'Diligência ao licitante'),
                'Julgamento e negociação': quando('Resultado da habilitação', 'Inabilitado, chamar o próximo'),
                'Licitação deserta ou fracassada': quando('Resultado da habilitação', 'Todos inabilitados'),
            },
        },
        {
            nome: 'Recursos', unidade: 'Agente de contratação', vai: ['Adjudicação e homologação', 'Decisão do recurso', 'Julgamento e negociação', 'Habilitação'], padrao: 'Adjudicação e homologação',
            orientacao: 'A intenção de recorrer é manifestada de imediato, em prazo não inferior a 10 minutos na sessão, sob pena de preclusão (art. 165, § 1º; IN 73/2022, art. 40). Razões em 3 dias úteis; contrarrazões em 3 dias úteis do fim do prazo do recorrente; vista dos elementos indispensáveis (art. 165, § 5º). O recurso tem efeito suspensivo (art. 168). O agente pode reconsiderar em 3 dias úteis; se mantiver, encaminha à autoridade superior. Sem recurso, segue para adjudicação.',
            acoes: [
                A.simNao('Houve intenção de recorrer?', { obrigatoria: true, destino: 'autos' }),
                A.comunicar('Intimar o recorrente para as razões', { especie: 'intimacao', polos: ['interessado'], dias: 3, texto: 'Apresente as razões do recurso em 3 dias úteis (Lei 14.133, art. 165).' }, { obrigatoria: true, se: quando('Houve intenção de recorrer?', 'sim') }),
                A.esperar('Aguardar as razões', 'Intimar o recorrente para as razões', { obrigatoria: true, se: quando('Houve intenção de recorrer?', 'sim') }),
                A.comunicar('Intimar os demais licitantes para contrarrazões', { especie: 'intimacao', polos: ['interessado'], dias: 3, texto: 'Interposto recurso, apresente contrarrazões em 3 dias úteis (Lei 14.133, art. 165, § 1º).' }, { obrigatoria: true, se: quando('Houve intenção de recorrer?', 'sim') }),
                A.esperar('Aguardar as contrarrazões', 'Intimar os demais licitantes para contrarrazões', { obrigatoria: true, se: quando('Houve intenção de recorrer?', 'sim') }),
                A.escolha('Juízo de reconsideração', ['Reconsidera e refaz o julgamento', 'Reconsidera e refaz a habilitação', 'Mantém e encaminha à autoridade'], { obrigatoria: true, destino: 'autos', se: quando('Houve intenção de recorrer?', 'sim') }),
                A.documento('Juntar a decisão de reconsideração ou de encaminhamento', 'Decisão', { forma: 'redigir', se: quando('Houve intenção de recorrer?', 'sim') }),
            ],
            saidas: {
                'Decisão do recurso': quando('Juízo de reconsideração', 'Mantém e encaminha à autoridade'),
                'Julgamento e negociação': quando('Juízo de reconsideração', 'Reconsidera e refaz o julgamento'),
                'Habilitação': quando('Juízo de reconsideração', 'Reconsidera e refaz a habilitação'),
            },
        },
        {
            nome: 'Decisão do recurso', unidade: 'Gabinete', prazo_dias: 10, prazo_auto: true, vai: ['Adjudicação e homologação', 'Julgamento e negociação', 'Habilitação'],
            ao_entrar: { pendencia: 'Decidir o recurso administrativo da licitação' },
            orientacao: 'A autoridade superior decide em 10 dias úteis do recebimento dos autos (art. 165, § 2º). O provimento invalida só os atos que não podem ser aproveitados (art. 165, § 3º) e o processo volta à fase do ato invalidado.',
            acoes: [
                A.escolha('Decisão', ['Não provido', 'Provido, refazer o julgamento', 'Provido, refazer a habilitação'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do recurso', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar os licitantes da decisão', { especie: 'intimacao', polos: ['interessado'], dias: 0, texto: 'Fica intimado da decisão do recurso.' }, { obrigatoria: true }),
            ],
            saidas: {
                'Adjudicação e homologação': quando('Decisão', 'Não provido'),
                'Julgamento e negociação': quando('Decisão', 'Provido, refazer o julgamento'),
                'Habilitação': quando('Decisão', 'Provido, refazer a habilitação'),
            },
        },
        {
            nome: 'Adjudicação e homologação', unidade: 'Gabinete', vai: ['Convocação para assinatura', 'Julgamento e negociação', 'Revogação ou anulação'],
            ao_entrar: { pendencia: 'Adjudicar e homologar a licitação, devolver para saneamento, revogar ou anular' },
            orientacao: 'Encerrados julgamento, habilitação e recursos, a autoridade superior pode devolver para sanear irregularidades, revogar por conveniência e oportunidade diante de fato superveniente, anular por ilegalidade insanável ou adjudicar e homologar (art. 71). Homologada, os documentos da fase preparatória que não integraram o edital também vão ao PNCP (art. 54, § 3º).',
            acoes: [
                A.escolha('Decisão da autoridade (art. 71)', ['Adjudicar e homologar', 'Devolver para saneamento', 'Revogar ou anular'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o termo de adjudicação e homologação', 'Homologação', { forma: 'redigir', se: quando('Decisão da autoridade (art. 71)', 'Adjudicar e homologar') }),
                A.documento('Juntar o despacho de saneamento', 'Despacho', { forma: 'redigir', se: quando('Decisão da autoridade (art. 71)', 'Devolver para saneamento') }),
                A.comunicar('Comunicar o resultado aos licitantes', { especie: 'comunicacao', polos: ['interessado'], dias: 0, texto: 'A licitação foi adjudicada e homologada.' }, { se: quando('Decisão da autoridade (art. 71)', 'Adjudicar e homologar') }),
            ],
            saidas: {
                'Convocação para assinatura': quando('Decisão da autoridade (art. 71)', 'Adjudicar e homologar'),
                'Julgamento e negociação': quando('Decisão da autoridade (art. 71)', 'Devolver para saneamento'),
                'Revogação ou anulação': quando('Decisão da autoridade (art. 71)', 'Revogar ou anular'),
            },
        },
        {
            nome: 'Convocação para assinatura', unidade: 'Setor de contratos', vai: ['Publicação do contrato no PNCP', 'Convocação de remanescentes'],
            orientacao: 'Convoque o adjudicatário para assinar o termo de contrato ou aceitar o instrumento equivalente no prazo do edital, prorrogável uma vez por igual período a pedido justificado (art. 90, § 1º). Exija a garantia, se prevista (art. 96). Se ele não assinar, convoque os remanescentes (art. 90, § 2º).',
            acoes: [
                A.documento('Preparar o termo de contrato', 'Contrato', { forma: 'redigir' }),
                A.comunicar('Convocar o adjudicatário para assinar', { especie: 'notificacao', polos: ['interessado'], dias: 5, texto: 'Fica convocado para assinar o contrato e apresentar a garantia, se exigida, no prazo do edital.' }, { obrigatoria: true, ajuda: 'Ajuste o prazo ao que o edital fixar.' }),
                A.esperar('Aguardar a assinatura', 'Convocar o adjudicatário para assinar', { obrigatoria: true }),
                A.documento('Juntar a garantia contratual', 'Garantia', { forma: 'juntar', nivel: 'opcional' }),
                A.simNao('O adjudicatário assinou?', { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Publicação do contrato no PNCP': quando('O adjudicatário assinou?', 'sim'), 'Convocação de remanescentes': quando('O adjudicatário assinou?', 'nao') },
        },
        {
            nome: 'Publicação do contrato no PNCP', unidade: 'Setor de contratos', prazo_dias: 20, prazo_auto: true, avanco: 'auto',
            orientacao: 'Divulgue o contrato no PNCP em até 20 dias úteis da assinatura. A divulgação é condição de eficácia do contrato e dos aditamentos (art. 94, I).',
            acoes: [A.formulario('Registrar a publicação do contrato', camposPncp, { obrigatoria: true, destino: 'autos', folha_dados: true })],
        },
        {
            nome: 'Designação de gestor e fiscais', unidade: 'Gabinete', avanco: 'auto',
            orientacao: 'Designe o gestor e os fiscais do contrato (art. 117). A execução segue em processo próprio, pelo modelo de gestão e fiscalização de contrato.',
            acoes: [A.documento('Juntar a portaria de designação', 'Portaria', { forma: 'redigir' })],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar: contrato publicado, ou licitação encerrada sem contratação.' },
        {
            nome: 'Cotações com fornecedores', unidade: 'Setor de compras', espera: true, avanco: 'auto',
            orientacao: 'Espera pelas cotações pedidas a fornecedores (IN 65/2021, art. 5º, IV): pedido formal, com prazo de resposta. Registrado o retorno, o processo volta sozinho para a pesquisa de preços.',
            acoes: [
                A.formulario('Registrar o pedido de cotação', [
                    { id: 'data', rotulo: 'Data do pedido', tipo: 'data', obrigatorio: true },
                    { id: 'fornecedores', rotulo: 'Fornecedores consultados', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao' }),
                A.documento('Juntar as cotações recebidas', 'Proposta', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Diligência de habilitação', unidade: 'Agente de contratação', espera: true, avanco: 'auto', nome_publico: 'Complementação de documentos',
            orientacao: 'Diligência para o licitante complementar ou atualizar documento de habilitação, sem incluir documento que deveria constar originalmente (art. 64). Com a resposta ou o fim do prazo, o processo volta à habilitação.',
            acoes: [
                A.comunicar('Notificar o licitante para complementar', { especie: 'notificacao', polos: ['interessado'], dias: 3, texto: 'Complemente ou atualize os documentos de habilitação indicados a seguir.' }, { obrigatoria: true, ajuda: 'A lei não fixa o prazo: use o do edital.' }),
                A.esperar('Aguardar a complementação', 'Notificar o licitante para complementar', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Licitação deserta ou fracassada', unidade: 'Setor de compras', vai: ['Minuta de edital e de contrato', 'Arquivamento'],
            orientacao: 'Deserta: nenhuma proposta. Fracassada: todas desclassificadas ou inabilitadas, ou nenhum remanescente aceitou contratar. Repita a licitação, revendo o edital, ou avalie a contratação direta do art. 75, III, se mantidas as condições do edital e a licitação tiver ocorrido há menos de um ano.',
            acoes: [
                A.escolha('Encaminhamento', ['Repetir a licitação', 'Contratação direta (art. 75, III)', 'Encerrar sem contratar'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o despacho de encaminhamento', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: { 'Minuta de edital e de contrato': quando('Encaminhamento', 'Repetir a licitação'), 'Arquivamento': quando('Encaminhamento', 'Contratação direta (art. 75, III)', 'Encerrar sem contratar') },
        },
        {
            nome: 'Revogação ou anulação', unidade: 'Gabinete', vai: ['Arquivamento', 'Adjudicação e homologação'],
            orientacao: 'Antes de revogar ou anular, ouça os interessados (art. 71, § 3º). A revogação exige fato superveniente devidamente comprovado (art. 71, § 2º). Da decisão cabe recurso em 3 dias úteis (art. 165, I, d), decidido nesta fase pela autoridade superior.',
            acoes: [
                A.comunicar('Notificar os licitantes para manifestação prévia', { especie: 'notificacao', polos: ['interessado'], dias: 3, texto: 'A Administração avalia revogar ou anular a licitação. Manifeste-se, se quiser.' }, { obrigatoria: true, ajuda: 'A lei não fixa o prazo da manifestação prévia: 3 dias úteis é sugestão.' }),
                A.esperar('Aguardar as manifestações', 'Notificar os licitantes para manifestação prévia', { obrigatoria: true }),
                A.escolha('Decisão', ['Revogar', 'Anular', 'Manter a licitação'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão motivada', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar os licitantes da decisão', { especie: 'intimacao', polos: ['interessado'], dias: 3, texto: 'Fica intimado da decisão. Cabe recurso em 3 dias úteis (Lei 14.133, art. 165, I, d).' }, { obrigatoria: true, se: quando('Decisão', 'Revogar', 'Anular') }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar os licitantes da decisão', { obrigatoria: true, se: quando('Decisão', 'Revogar', 'Anular') }),
                A.escolha('Situação final', ['Licitação encerrada', 'Licitação retomada'], { obrigatoria: true, destino: 'autos', ajuda: 'Retomada quando a decisão foi manter a licitação ou o recurso foi provido.' }),
            ],
            saidas: { 'Arquivamento': quando('Situação final', 'Licitação encerrada'), 'Adjudicação e homologação': quando('Situação final', 'Licitação retomada') },
        },
        {
            nome: 'Convocação de remanescentes', unidade: 'Setor de contratos', vai: ['Publicação do contrato no PNCP', 'Licitação deserta ou fracassada'],
            orientacao: 'Convoque os licitantes remanescentes, na ordem de classificação, para contratar nas condições do vencedor (art. 90, § 2º). Se nenhum aceitar, a Administração pode negociar ou adjudicar nas condições da proposta de cada um, observado o valor estimado (art. 90, § 4º). Abra a apuração de responsabilidade do adjudicatário que recusou (art. 90, § 5º), em processo próprio de sanção.',
            acoes: [
                A.fazer('Abrir a apuração de responsabilidade do adjudicatário', { obrigatoria: true, destino: 'autos' }),
                A.comunicar('Convocar o remanescente', { especie: 'notificacao', polos: ['interessado'], dias: 5, texto: 'Fica convocado para contratar nas condições propostas pelo licitante vencedor (Lei 14.133, art. 90, § 2º).' }, { obrigatoria: true, ajuda: 'Ajuste o prazo ao que o edital fixar.' }),
                A.esperar('Aguardar a resposta do remanescente', 'Convocar o remanescente', { obrigatoria: true }),
                A.simNao('Algum remanescente assinou?', { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o contrato assinado', 'Contrato', { forma: 'juntar', se: quando('Algum remanescente assinou?', 'sim') }),
            ],
            saidas: { 'Publicação do contrato no PNCP': quando('Algum remanescente assinou?', 'sim'), 'Licitação deserta ou fracassada': quando('Algum remanescente assinou?', 'nao') },
        },
    ]);
}

/** 8. Contratação direta: dispensa e inexigibilidade (Lei 14.133/2021, arts. 72 a 75). */
export function contratacaoDireta() {
    return montar({
        id: 'contratacao-direta', nome: 'Contratação direta: dispensa e inexigibilidade', area: 'contratacoes', porte: 'medio', referencia: 'Lei 14.133',
        descricao: 'Contratação sem licitação, quando a lei dispensa (valor baixo, emergência, licitação deserta e as demais hipóteses do art. 75) ou quando a competição é inviável (fornecedor exclusivo, notória especialização, credenciamento e as demais do art. 74). O processo é mais curto, mas a instrução do art. 72 é rigorosa: demanda, enquadramento, estimativa de despesa, razão da escolha do fornecedor, justificativa de preço, habilitação, recursos orçamentários e parecer jurídico. Na dispensa por valor, o aviso de dispensa eletrônica abre disputa entre fornecedores. O fornecedor é chamado para complementar documentos e para assinar, e o processo termina com o contrato ou instrumento equivalente publicado no PNCP, ou com arquivamento.',
        quando: 'Compras e serviços enquadrados no art. 74 (inexigibilidade) ou no art. 75 (dispensa) da Lei 14.133. Se o caso exige licitação, use o modelo de contratação por licitação.',
        base: 'Lei 14.133/2021, arts. 23, 53, §§ 4º e 5º, 71, 72 a 75, 94, II e § 1º, 95 e 165; IN SEGES 67/2021, arts. 6º e 11.',
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Área requisitante', interessado: 'Fornecedor' } },
    }, [
        {
            nome: 'Formalização da demanda', unidade: 'Área requisitante', avanco: 'auto', nome_publico: 'Demanda',
            orientacao: 'Registre a demanda e, se for o caso, junte estudo técnico preliminar, análise de riscos e termo de referência ou projeto (art. 72, I).',
            acoes: [
                A.formulario('Preencher os dados da demanda', camposDfd, { obrigatoria: true, destino: 'autos', folha_dados: true }),
                A.documento('Juntar o documento de formalização de demanda', 'DFD', { forma: 'qualquer' }),
                A.documento('Juntar o estudo técnico preliminar', 'Estudo técnico preliminar', { forma: 'qualquer', nivel: 'opcional' }),
                A.documento('Juntar o termo de referência ou projeto', 'Termo de referência', { forma: 'qualquer', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Enquadramento legal', unidade: 'Setor de compras', avanco: 'auto',
            orientacao: 'Indique a hipótese legal: o inciso do art. 74 (inexigibilidade) ou do art. 75 (dispensa). Na dispensa por valor, os limites da lei original são R$ 100.000,00 para obras, serviços de engenharia e manutenção de veículos e R$ 50.000,00 para outros serviços e compras (art. 75, I e II), atualizados por decreto anual. Em emergência ou calamidade (art. 75, VIII), o contrato vale da assinatura, mas deve ser publicado no prazo, sob pena de nulidade (art. 94, § 1º).',
            acoes: [
                A.escolha('Hipótese', ['Dispensa por valor (art. 75, I ou II)', 'Outra dispensa (art. 75)', 'Inexigibilidade (art. 74)'], { obrigatoria: true, destino: 'autos' }),
                A.texto('Dispositivo legal (inciso e alínea)', { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a nota de enquadramento', 'Nota técnica', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Estimativa da despesa', unidade: 'Setor de compras', vai: ['Aviso de dispensa eletrônica', 'Escolha do fornecedor e preço'],
            orientacao: 'Estime a despesa na forma do art. 23 (art. 72, II), com os mesmos parâmetros da pesquisa de preços da licitação. Na dispensa por valor, o aviso em sítio oficial é preferencial (art. 75, § 3º); sem aviso, siga direto para a escolha do fornecedor.',
            acoes: [
                A.documento('Juntar o mapa comparativo de preços', 'Mapa comparativo de preços', { forma: 'qualquer' }),
                A.numero('Valor estimado da contratação (R$)', { obrigatoria: true, destino: 'autos' }),
                A.simNao('Haverá aviso de dispensa eletrônica?', { obrigatoria: true, ajuda: 'Preferencial na dispensa por valor (art. 75, § 3º). Nas demais hipóteses, marque não.' }),
            ],
            saidas: { 'Aviso de dispensa eletrônica': quando('Haverá aviso de dispensa eletrônica?', 'sim'), 'Escolha do fornecedor e preço': quando('Haverá aviso de dispensa eletrônica?', 'nao') },
        },
        {
            nome: 'Aviso de dispensa eletrônica', unidade: 'Agente de contratação', prazo_dias: 3, vai: ['Escolha do fornecedor e preço', 'Estimativa da despesa', 'Arquivamento'],
            orientacao: 'Divulgue o aviso em sítio oficial por no mínimo 3 dias úteis para receber propostas (art. 75, § 3º). No sistema federal, o prazo até a abertura não é inferior a 3 dias úteis e a fase de lances dura de 6 a 10 horas (IN 67/2021, arts. 6º, parágrafo único, e 11). Quem participa tem os recursos do art. 165. Sem propostas válidas, repita o aviso ou contrate diretamente com justificativa.',
            acoes: [
                A.formulario('Registrar o aviso', [
                    { id: 'numero', rotulo: 'Número do aviso', tipo: 'texto', obrigatorio: true },
                    { id: 'divulgacao', rotulo: 'Data da divulgação', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o aviso de dispensa', 'Aviso', { forma: 'juntar' }),
                A.disputa('Disputa de preços', 'dispensa', { obrigatoria: true, ajuda: 'Abre a disputa nos autos: itens, abertura, sala de lances, julgamento, habilitação e ata. O resultado (homologada, deserta ou fracassada) cumpre esta ação.' }),
                A.escolha('Sem proposta aceita, o que fazer?', ['Repetir o aviso', 'Contratar diretamente', 'Encerrar sem contratar'], { obrigatoria: true, destino: 'autos', se: quando('Disputa de preços', 'Deserta', 'Fracassada') }),
            ],
            padrao: 'Escolha do fornecedor e preço',
            saidas: {
                'Escolha do fornecedor e preço': quando('Disputa de preços', 'Homologada'),
                'Estimativa da despesa': quando('Sem proposta aceita, o que fazer?', 'Repetir o aviso'),
                'Arquivamento': quando('Sem proposta aceita, o que fazer?', 'Encerrar sem contratar'),
            },
        },
        {
            nome: 'Escolha do fornecedor e preço', unidade: 'Setor de compras', avanco: 'auto',
            orientacao: 'Registre a razão da escolha do contratado e a justificativa do preço (art. 72, VI e VII). Na inexigibilidade, junte a prova da inviabilidade de competição: atestado de exclusividade, comprovação da notória especialização ou o edital de credenciamento (art. 74, §§ 1º a 3º).',
            acoes: [
                A.formulario('Identificar o fornecedor', [
                    { id: 'nome', rotulo: 'Nome ou razão social', tipo: 'texto', obrigatorio: true },
                    { id: 'documento', rotulo: 'CPF ou CNPJ', tipo: 'texto', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor proposto (R$)', tipo: 'numero', obrigatorio: true },
                ], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a razão da escolha do fornecedor', 'Justificativa', { forma: 'redigir' }),
                A.documento('Juntar a justificativa de preço', 'Justificativa', { forma: 'redigir' }),
                A.simNao('É inexigibilidade?', { obrigatoria: true }),
                A.documento('Juntar a prova da inviabilidade de competição', 'Atestado', { forma: 'juntar', se: quando('É inexigibilidade?', 'sim') }),
            ],
        },
        {
            nome: 'Habilitação do fornecedor', unidade: 'Setor de compras', vai: ['Disponibilidade orçamentária', 'Complementação pelo fornecedor', 'Escolha do fornecedor e preço'],
            orientacao: 'Confira se o fornecedor preenche os requisitos de habilitação e qualificação mínima necessários (art. 72, V). Faltando documento, peça a complementação; o processo volta para cá com a resposta.',
            acoes: [
                A.documento('Juntar os documentos de habilitação', 'Documentos de habilitação', { forma: 'juntar' }),
                A.escolha('Resultado da habilitação', ['Habilitado', 'Complementar documentos', 'Não habilitado, escolher outro'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Disponibilidade orçamentária': quando('Resultado da habilitação', 'Habilitado'),
                'Complementação pelo fornecedor': quando('Resultado da habilitação', 'Complementar documentos'),
                'Escolha do fornecedor e preço': quando('Resultado da habilitação', 'Não habilitado, escolher outro'),
            },
        },
        {
            nome: 'Disponibilidade orçamentária', unidade: 'Setor financeiro', avanco: 'auto',
            orientacao: 'Demonstre a compatibilidade da previsão de recursos orçamentários com o compromisso a ser assumido (art. 72, IV).',
            acoes: [
                A.formulario('Registrar a dotação e a reserva', camposDotacao, { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a declaração de adequação orçamentária', 'Declaração', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Parecer jurídico', unidade: 'Assessoria jurídica', prazo_dias: 15, avanco: 'auto',
            orientacao: 'O controle prévio de legalidade alcança as contratações diretas (art. 53, § 4º; art. 72, III) e pode ser dispensado nas hipóteses fixadas pela autoridade jurídica máxima (art. 53, § 5º). Junte também pareceres técnicos, se houver. A Lei 14.133 não fixa prazo; os 15 dias são referência da Lei 9.784, art. 42.',
            acoes: [
                A.escolha('Manifestação jurídica', ['Parecer emitido', 'Dispensado (art. 53, § 5º)'], { obrigatoria: true }),
                A.documento('Juntar o parecer jurídico', 'Parecer', { forma: 'redigir', se: quando('Manifestação jurídica', 'Parecer emitido') }),
                A.escolha('Conclusão do parecer', ['Favorável', 'Favorável com ressalvas', 'Desfavorável'], { obrigatoria: true, destino: 'autos', se: quando('Manifestação jurídica', 'Parecer emitido') }),
                A.texto('Ato que dispensa o parecer', { obrigatoria: true, se: quando('Manifestação jurídica', 'Dispensado (art. 53, § 5º)') }),
                A.documento('Juntar pareceres técnicos', 'Parecer', { forma: 'juntar', nivel: 'opcional' }),
            ],
        },
        {
            nome: 'Autorização', unidade: 'Gabinete', vai: ['Contrato ou instrumento equivalente', 'Enquadramento legal', 'Arquivamento'],
            ao_entrar: { pendencia: 'Autorizar ou ratificar a contratação direta' },
            orientacao: 'A autoridade competente autoriza a contratação direta (art. 72, VIII), atendendo às recomendações do parecer ou justificando por que não as segue. Revogação ou anulação exige manifestação prévia dos interessados (art. 71, §§ 3º e 4º).',
            acoes: [
                A.escolha('Decisão', ['Autorizar', 'Devolver para ajustes', 'Não autorizar'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o ato de autorização ou o despacho', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: { 'Contrato ou instrumento equivalente': quando('Decisão', 'Autorizar'), 'Enquadramento legal': quando('Decisão', 'Devolver para ajustes'), 'Arquivamento': quando('Decisão', 'Não autorizar') },
        },
        {
            nome: 'Contrato ou instrumento equivalente', unidade: 'Setor de contratos', vai: ['Publicação no PNCP', 'Escolha do fornecedor e preço'],
            orientacao: 'Divulgue o ato de autorização ou o extrato do contrato em sítio eletrônico oficial (art. 72, parágrafo único). Na dispensa por valor e nas compras com entrega imediata e integral, sem obrigações futuras, a nota de empenho, a carta-contrato ou a ordem de serviço podem substituir o termo de contrato (art. 95). Se o fornecedor não assinar, volte à escolha do fornecedor.',
            acoes: [
                A.fazer('Divulgar o ato ou o extrato no sítio oficial', { obrigatoria: true, destino: 'autos' }),
                A.escolha('Instrumento', ['Termo de contrato', 'Nota de empenho', 'Carta-contrato ou ordem de serviço'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Preparar o termo de contrato', 'Contrato', { forma: 'redigir', se: quando('Instrumento', 'Termo de contrato') }),
                A.comunicar('Convocar o fornecedor para assinar ou aceitar', { especie: 'notificacao', polos: ['interessado'], dias: 5, texto: 'Fica convocado para assinar o contrato ou aceitar o instrumento equivalente.' }, { obrigatoria: true, ajuda: 'A lei não fixa o prazo: 5 dias úteis é sugestão.' }),
                A.esperar('Aguardar a assinatura', 'Convocar o fornecedor para assinar ou aceitar', { obrigatoria: true }),
                A.simNao('O fornecedor assinou ou aceitou?', { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Publicação no PNCP': quando('O fornecedor assinou ou aceitou?', 'sim'), 'Escolha do fornecedor e preço': quando('O fornecedor assinou ou aceitou?', 'nao') },
        },
        {
            nome: 'Publicação no PNCP', unidade: 'Setor de contratos', prazo_dias: 10, prazo_auto: true, avanco: 'auto',
            orientacao: 'Divulgue o contrato no PNCP em até 10 dias úteis da assinatura (art. 94, II). A divulgação é condição de eficácia; na emergência, a falta de publicação no prazo gera nulidade (art. 94, § 1º).',
            acoes: [A.formulario('Registrar a publicação do contrato', camposPncp, { obrigatoria: true, destino: 'autos', folha_dados: true })],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar: contrato publicado, ou contratação não autorizada.' },
        {
            nome: 'Complementação pelo fornecedor', unidade: 'Setor de compras', espera: true, avanco: 'auto', nome_publico: 'Complementação de documentos',
            orientacao: 'Espera pelos documentos de habilitação pedidos ao fornecedor. Com a resposta ou o fim do prazo, o processo volta à habilitação.',
            acoes: [
                A.comunicar('Notificar o fornecedor para complementar', { especie: 'notificacao', polos: ['interessado'], dias: 3, texto: 'Apresente os documentos de habilitação indicados a seguir.' }, { obrigatoria: true, ajuda: 'A lei não fixa o prazo: 3 dias úteis é sugestão.' }),
                A.esperar('Aguardar os documentos', 'Notificar o fornecedor para complementar', { obrigatoria: true }),
            ],
        },
    ]);
}

/** 9. Compra ou contratação privada, da requisição ao pagamento (política interna de compras). */
export function compraPrivada() {
    return montar({
        id: 'compra-privada', nome: 'Compra ou contratação privada', area: 'contratacoes', porte: 'medio', referencia: 'Setor privado',
        descricao: 'Fluxo de aquisição de bens e serviços em empresa ou entidade privada, da requisição ao pagamento. Não há lei que imponha rito: fases, alçadas, número de cotações e prazos são da política interna e devem ser revistos pela organização. Corre com requisição, aprovação do gestor, cotações, mapa comparativo e negociação, homologação de fornecedor novo, aprovação por alçada de valor e análise jurídica quando há contrato. O fornecedor se manifesta no cadastro, no aceite do pedido e nas não conformidades do recebimento. Termina com a conferência tripla (pedido, recebimento e nota fiscal), o pagamento e a avaliação do fornecedor.',
        quando: 'Compras e contratações de organizações privadas que querem segregação de funções e registro das aprovações. Entidades do Sistema S e organizações sociais devem ajustar ao seu regulamento de compras.',
        base: 'Política interna de compras da organização; Código Civil, arts. 421 a 425 (liberdade contratual). Modelo construído por prática de mercado; prazos sugeridos, sem fonte normativa.',
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Requisitante', interessado: 'Fornecedor' } },
    }, [
        {
            nome: 'Requisição de compra', unidade: 'Área requisitante', avanco: 'auto', nome_publico: 'Requisição',
            orientacao: 'Descreva o que precisa, quanto, para quando e por quê, e indique o centro de custo. Quem pede não aprova: a aprovação é do gestor da área.',
            acoes: [
                A.formulario('Preencher a requisição', [
                    { id: 'especificacao', rotulo: 'Especificação do bem ou serviço', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'quantidade', rotulo: 'Quantidade', tipo: 'numero', obrigatorio: true },
                    { id: 'centro', rotulo: 'Centro de custo', tipo: 'texto', obrigatorio: true },
                    { id: 'justificativa', rotulo: 'Justificativa', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'data', rotulo: 'Data de necessidade', tipo: 'data', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor estimado (R$)', tipo: 'numero', obrigatorio: false },
                ], { obrigatoria: true, destino: 'autos', folha_dados: true }),
            ],
        },
        {
            nome: 'Aprovação do gestor', unidade: 'Área requisitante', prazo_dias: 2, vai: ['Cotação', 'Requisição de compra', 'Arquivamento'],
            orientacao: 'O gestor da área, e não quem pediu, confirma a necessidade e a existência de orçamento no centro de custo. Prazo sugerido: 2 dias úteis.',
            acoes: [
                A.escolha('Decisão do gestor', ['Aprovada', 'Devolvida para ajuste', 'Reprovada'], { obrigatoria: true, destino: 'autos' }),
                A.textoLongo('Motivo da devolução ou da reprovação', { obrigatoria: true, se: quando('Decisão do gestor', 'Devolvida para ajuste', 'Reprovada') }),
            ],
            saidas: { 'Cotação': quando('Decisão do gestor', 'Aprovada'), 'Requisição de compra': quando('Decisão do gestor', 'Devolvida para ajuste'), 'Arquivamento': quando('Decisão do gestor', 'Reprovada') },
        },
        {
            nome: 'Cotação', unidade: 'Setor de compras', prazo_dias: 5, avanco: 'auto',
            orientacao: 'Acima do valor de corte da política, colha ao menos três propostas; abaixo dele, a compra pode ser direta. Fornecedor único só com justificativa escrita. Prazo sugerido: 5 dias úteis.',
            acoes: [
                A.simNao('O valor passa do corte de cotação?', { obrigatoria: true }),
                A.simNao('Há fornecedor único?', { obrigatoria: true, se: quando('O valor passa do corte de cotação?', 'sim') }),
                A.textoLongo('Justificar o fornecedor único', { obrigatoria: true, se: quando('Há fornecedor único?', 'sim') }),
                A.documento('Juntar o pedido de cotação', 'Pedido de cotação', { forma: 'qualquer', nivel: 'recomendado' }),
                A.disputa('Cotação eletrônica entre convidados', 'cotacao', { se: quando('O valor passa do corte de cotação?', 'sim'), ajuda: 'Opcional: convide os fornecedores para enviar proposta pelo sistema, com ou sem lances, e o julgamento e a ata ficam nos autos. Sem ela, junte as propostas recebidas por outro meio.' }),
                A.documento('Juntar as propostas recebidas', 'Proposta', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Mapa comparativo e negociação', unidade: 'Setor de compras', vai: ['Aprovação por alçada', 'Homologação do fornecedor'],
            orientacao: 'Compare preço, prazo, condição de pagamento, qualidade e histórico de cada fornecedor e registre a negociação. Fornecedor novo passa pela homologação antes da aprovação.',
            acoes: [
                A.documento('Juntar o mapa comparativo', 'Mapa comparativo de preços', { forma: 'qualquer' }),
                A.formulario('Registrar o fornecedor escolhido e a negociação', [
                    { id: 'fornecedor', rotulo: 'Fornecedor escolhido', tipo: 'texto', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor negociado (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'prazo', rotulo: 'Prazo de entrega', tipo: 'texto', obrigatorio: true },
                    { id: 'pagamento', rotulo: 'Condição de pagamento', tipo: 'texto', obrigatorio: true },
                    { id: 'negociacao', rotulo: 'Registro da negociação', tipo: 'texto_longo', obrigatorio: false },
                ], { obrigatoria: true, destino: 'autos' }),
                A.simNao('O fornecedor já é homologado?', { obrigatoria: true }),
            ],
            saidas: { 'Aprovação por alçada': quando('O fornecedor já é homologado?', 'sim'), 'Homologação do fornecedor': quando('O fornecedor já é homologado?', 'nao') },
        },
        {
            nome: 'Homologação do fornecedor', unidade: 'Setor de compras', vai: ['Aprovação por alçada', 'Mapa comparativo e negociação'],
            orientacao: 'Peça ao fornecedor novo os documentos de cadastro e confira regularidade fiscal, integridade e crédito. Não homologado, volte ao mapa para escolher outro.',
            acoes: [
                A.comunicar('Pedir os documentos de cadastro', { especie: 'notificacao', polos: ['interessado'], dias: 5, texto: 'Para o cadastro de fornecedor, envie os documentos indicados a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar os documentos', 'Pedir os documentos de cadastro', { obrigatoria: true }),
                A.formulario('Conferir o cadastro', [
                    { id: 'fiscal', rotulo: 'Regularidade fiscal', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'integridade', rotulo: 'Análise de integridade sem restrição', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'credito', rotulo: 'Análise de crédito sem restrição', tipo: 'sim_nao', obrigatorio: true },
                ], { obrigatoria: true, destino: 'autos' }),
                A.escolha('Resultado da homologação', ['Homologado', 'Não homologado'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Aprovação por alçada': quando('Resultado da homologação', 'Homologado'), 'Mapa comparativo e negociação': quando('Resultado da homologação', 'Não homologado') },
        },
        {
            nome: 'Aprovação por alçada', unidade: 'Gabinete', vai: ['Análise jurídica', 'Pedido ou contrato', 'Mapa comparativo e negociação', 'Arquivamento'],
            ao_entrar: { pendencia: 'Aprovar a compra na alçada de valor' },
            orientacao: 'Aprova quem tem alçada para o valor, nas faixas da política interna (comprador, gerente, diretor ou comitê). Se a compra exige contrato, segue para a análise jurídica; se não, para o pedido de compra.',
            acoes: [
                A.escolha('Alçada', ['Comprador', 'Gerente', 'Diretor', 'Comitê'], { obrigatoria: true, destino: 'autos' }),
                A.escolha('Decisão', ['Aprovada', 'Devolvida para renegociar', 'Reprovada'], { obrigatoria: true, destino: 'autos' }),
                A.simNao('A compra exige contrato?', { obrigatoria: true, se: quando('Decisão', 'Aprovada') }),
            ],
            saidas: {
                'Análise jurídica': quando('A compra exige contrato?', 'sim'),
                'Pedido ou contrato': quando('A compra exige contrato?', 'nao'),
                'Mapa comparativo e negociação': quando('Decisão', 'Devolvida para renegociar'),
                'Arquivamento': quando('Decisão', 'Reprovada'),
            },
        },
        {
            nome: 'Análise jurídica', unidade: 'Assessoria jurídica', avanco: 'auto',
            orientacao: 'Revise a minuta: objeto, preço e reajuste, garantias, penalidades, confidencialidade e proteção de dados.',
            acoes: [
                A.documento('Juntar a minuta revisada ou o parecer', 'Parecer', { forma: 'qualquer' }),
                A.escolha('Conclusão', ['Minuta aprovada', 'Aprovada com ajustes'], { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Pedido ou contrato', unidade: 'Setor de compras', vai: ['Recebimento', 'Mapa comparativo e negociação'],
            orientacao: 'Emita o pedido de compra ou colha as assinaturas do contrato e envie ao fornecedor para aceite. Sem aceite, volte ao mapa para escolher outro fornecedor.',
            acoes: [
                A.escolha('Instrumento', ['Pedido de compra', 'Contrato'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o pedido de compra', 'Pedido de compra', { forma: 'qualquer', se: quando('Instrumento', 'Pedido de compra') }),
                A.documento('Juntar o contrato assinado', 'Contrato', { forma: 'qualquer', se: quando('Instrumento', 'Contrato') }),
                A.comunicar('Enviar ao fornecedor para aceite', { especie: 'notificacao', polos: ['interessado'], dias: 3, texto: 'Segue o pedido de compra ou o contrato para aceite.' }, { obrigatoria: true }),
                A.esperar('Aguardar o aceite', 'Enviar ao fornecedor para aceite', { obrigatoria: true }),
                A.simNao('O fornecedor aceitou?', { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Recebimento': quando('O fornecedor aceitou?', 'sim'), 'Mapa comparativo e negociação': quando('O fornecedor aceitou?', 'nao') },
        },
        {
            nome: 'Recebimento', unidade: 'Área requisitante', vai: ['Conferência e pagamento', 'Correção pelo fornecedor'],
            orientacao: 'Quem comprou não recebe: confira o que chegou contra o pedido e a nota fiscal. Não conforme, dê ao fornecedor prazo para substituir ou corrigir antes de devolver ou emitir nota de débito; o processo volta para cá com a resposta.',
            acoes: [
                A.documento('Juntar a nota fiscal', 'Nota fiscal', { forma: 'juntar' }),
                A.escolha('Recebimento', ['Conforme', 'Não conforme'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o termo de recebimento', 'Termo de recebimento', { forma: 'qualquer', se: quando('Recebimento', 'Conforme') }),
                A.documento('Juntar o laudo de inspeção', 'Laudo', { forma: 'juntar', nivel: 'opcional' }),
            ],
            saidas: { 'Conferência e pagamento': quando('Recebimento', 'Conforme'), 'Correção pelo fornecedor': quando('Recebimento', 'Não conforme') },
        },
        {
            nome: 'Conferência e pagamento', unidade: 'Setor financeiro', vai: ['Avaliação do fornecedor', 'Pedido ou contrato'],
            orientacao: 'Quem recebeu não paga: o financeiro cruza pedido, recebimento e nota fiscal (conferência tripla). Divergência bloqueia o pagamento e devolve ao comprador.',
            acoes: [
                A.simNao('Pedido, recebimento e nota fiscal conferem?', { obrigatoria: true, destino: 'autos' }),
                A.textoLongo('Descrever a divergência', { obrigatoria: true, se: quando('Pedido, recebimento e nota fiscal conferem?', 'nao') }),
                A.data('Data do pagamento', { obrigatoria: true, destino: 'autos', se: quando('Pedido, recebimento e nota fiscal conferem?', 'sim') }),
                A.documento('Juntar o comprovante de pagamento', 'Comprovante', { forma: 'juntar', se: quando('Pedido, recebimento e nota fiscal conferem?', 'sim') }),
            ],
            saidas: { 'Avaliação do fornecedor': quando('Pedido, recebimento e nota fiscal conferem?', 'sim'), 'Pedido ou contrato': quando('Pedido, recebimento e nota fiscal conferem?', 'nao') },
        },
        {
            nome: 'Avaliação do fornecedor', unidade: 'Setor de compras', avanco: 'auto',
            orientacao: 'Avalie o fornecedor (prazo, qualidade, atendimento) para o histórico das próximas cotações.',
            acoes: [
                A.escolha('Avaliação', ['Ótimo', 'Bom', 'Regular', 'Ruim'], { obrigatoria: true, destino: 'autos' }),
                A.textoLongo('Observações', { destino: 'autos' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Guarde os documentos fiscais pelo prazo usual de 5 anos.' },
        {
            nome: 'Correção pelo fornecedor', unidade: 'Área requisitante', espera: true, avanco: 'auto', nome_publico: 'Não conformidade no recebimento',
            orientacao: 'Espera pela substituição ou correção do que foi entregue fora do pedido. Com a resposta ou o fim do prazo, o processo volta ao recebimento.',
            acoes: [
                A.comunicar('Notificar a não conformidade', { especie: 'notificacao', polos: ['interessado'], dias: 5, texto: 'O material ou serviço entregue não confere com o pedido, como descrito a seguir. Substitua, corrija ou manifeste-se no prazo.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta do fornecedor', 'Notificar a não conformidade', { obrigatoria: true }),
            ],
        },
    ]);
}

export const modelos = [licitacao, contratacaoDireta, compraPrivada];
