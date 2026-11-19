/**
 * Parcerias, convênios e instrumentos congêneres: a formalização (da ideia à
 * publicação, com o que muda em cada instrumento) e o acompanhamento da
 * execução (fiscalização, alteração, renovação, contas e encerramento), em
 * três âmbitos: Ministério Público do RS, Estado do RS e União.
 *
 * Os dois modelos do MPRS já vêm encaixados no Painel de Parcerias: cada fase
 * põe a parceria na coluna certa (`situacao_registro`) e as ações levam os
 * dados que a coluna exige (`ao_registro`). Em Parcerias o quadro confere os
 * dados ao ENTRAR na coluna, por isso o dado é pedido na fase anterior.
 *
 * Pesquisa e o que ficou a conferir: docs/MODELOS_DE_RITO.md.
 */
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';
const PARTICIPES = { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Órgão público', interessado: 'Partícipe' } };
const coluna = (ao_entrar) => ({ modulo: 'parcerias', ao_entrar });
const aoPainel = (campo) => ({ ao_registro: { modulo: 'parcerias', campo } });
const PROBLEMA = () => A.textoLongo('Problema ou necessidade que a parceria resolve', { obrigatoria: true, folha_dados: true, ajuda: 'Descreva a situação de hoje, quem é afetado e por que o órgão não resolve sozinho.' });
const SOLUCAO = () => A.textoLongo('Solução proposta e resultados esperados', { obrigatoria: true, folha_dados: true, ajuda: 'O que cada partícipe fará, o que se espera entregar e como o resultado será medido.' });
const ARQUIVADA = (texto) => ({ nome: 'Arquivamento da proposta', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, nome_publico: 'Proposta arquivada', orientacao: texto });

/* ------------------------------------------------------------------ MPRS */

const P59 = 'Provimento 59/2011-PGJ';
const SUBINST = 'Subprocuradoria-Geral para Assuntos Institucionais';
const INSTRUMENTOS_MPRS = ['Convênio (com repasse de recursos)', 'Termo de cooperação (sem repasse)', 'Termo de fomento ou de colaboração (organização da sociedade civil)', 'Acordo de cooperação (organização da sociedade civil, sem repasse)', 'Protocolo de intenções'];
const BASE_MPRS = `${P59}, arts. 1º a 7º (com os Provimentos 76/2024 e 16/2025); Instrução Normativa CAGE 4/2024 (convênios e termos de cooperação, aplicável ao Ministério Público); Lei 14.133/2021, art. 184; Lei 13.019/2014 (parcerias com organizações da sociedade civil); Lei 8.625/1993, art. 10, I, e Lei estadual 7.669/1982, art. 25.`;

/** 1. Formalização no MPRS. */
export function parceriaFormalizacaoMprs() {
    return montar({
        id: 'parceria-formalizacao-mprs', nome: 'Convênio, termo de cooperação ou parceria no MPRS: da proposta à publicação', area: 'parcerias', porte: 'longo', referencia: 'MPRS',
        descricao: 'O caminho que o Provimento 59/2011-PGJ manda seguir para o Ministério Público do RS firmar convênio, termo de cooperação, termo de fomento ou de colaboração, acordo de cooperação ou protocolo de intenções. Começa na proposta, com o contato com os partícipes, a descrição do problema e da solução, o estudo técnico, o plano de trabalho, a minuta, a justificativa e a anuência. A instrução é revisada e a minuta aprovada pela Subprocuradoria-Geral para Assuntos Institucionais. Se houver recursos financeiros ou orçamentários, passa pela Direção-Geral: exame de planejamento e orçamento, parecer jurídico e aprovação da Seccional da CAGE, com a habilitação do convenente e a designação do fiscal. Depois vêm a aprovação do Procurador-Geral, a assinatura (com delegação a membro, se houver), a súmula no Diário Eletrônico, a divulgação e o registro. Com organização da sociedade civil, há a etapa de chamamento público ou a justificativa da sua dispensa. Cada fase move a parceria no Painel de Parcerias e leva os dados que a ficha pede.',
        quando: 'Toda proposta de convênio ou parceria do MPRS, e também os termos aditivos. Abra o processo a partir da parceria já criada no Painel de Parcerias (ou ligue os dois) para o quadro andar junto. No termo aditivo, não ligue o processo à ficha: o painel conduz o aditivo na própria ficha da parceria, e os dados do formulário final trocariam os do termo original. Depois de publicado, o acompanhamento segue no rito "Acompanhamento de convênio ou parceria no MPRS". Outro Ministério Público pode usar trocando as unidades e a norma interna.',
        base: BASE_MPRS,
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Ministério Público', interessado: 'Partícipe' } },
    }, [
        {
            nome: 'Proposta e contato com os partícipes', unidade: 'Unidade proponente', vai: ['Estudo técnico, plano de trabalho e minuta'], nome_publico: 'Proposta em elaboração',
            orientacao: `Quem propõe (Centro de Apoio, Promotoria, unidade administrativa ou o partícipe externo) registra a ideia, conversa com os partícipes e descreve o problema e a solução. Escolha o instrumento: convênio quando há repasse de recursos a ente de outra esfera, consórcio, serviço social autônomo ou entidade beneficente de saúde; termo de cooperação quando não há repasse (IN CAGE 4/2024, art. 2º, II e XXIX); termo de fomento ou de colaboração e acordo de cooperação quando o partícipe é organização da sociedade civil (Lei 13.019/2014); protocolo de intenções quando só se declara a vontade de cooperar, sem obrigações exigíveis. O PGEA, o assunto e as partes vão para a ficha da parceria no painel.`,
            acoes: [
                A.formulario('Registrar os dados da proposta', [
                    { id: 'pgea', rotulo: 'PGEA', tipo: 'texto', obrigatorio: true },
                    { id: 'assunto', rotulo: 'Assunto', tipo: 'texto', obrigatorio: true },
                    { id: 'partes', rotulo: 'Partícipes (nome e CNPJ)', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'proponente', rotulo: 'Quem propõe (órgão ou unidade)', tipo: 'texto', obrigatorio: true },
                    { id: 'iniciativa', rotulo: 'Iniciativa', tipo: 'lista', opcoes: ['Do Ministério Público', 'De outro partícipe'] },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true, ao_registro: { modulo: 'parcerias', campos: { pgea: 'pgea', assunto: 'subject', partes: 'parties' } } }),
                PROBLEMA(),
                SOLUCAO(),
                A.escolha('Instrumento', INSTRUMENTOS_MPRS, { obrigatoria: true, folha_dados: true, ajuda: 'Na dúvida entre convênio e termo de cooperação, pergunte: há repasse de dinheiro? Se há, é convênio.' }),
                A.simNao('Envolve recursos financeiros ou orçamentários do MPRS?', { obrigatoria: true, folha_dados: true, ajuda: 'Se sim, a proposta passa pela Direção-Geral e pela Seccional da CAGE (art. 2º).' }),
                A.fazer('Registrar os contatos e as reuniões com os partícipes', { recomendada: true }),
                A.audiencia('Reunião de alinhamento com os partícipes', 'reuniao'),
                A.comunicar('Consultar os partícipes sobre a proposta', { especie: 'comunicacao', polos: ['interessado'], dias: 15, texto: 'O Ministério Público propõe a celebração de parceria. Manifeste o interesse e indique quem responde pelas tratativas.' }, { ajuda: 'Use quando o partícipe tem acesso ao portal; se não tem, registre o contato na ação anterior.' }),
            ],
        },
        {
            nome: 'Estudo técnico, plano de trabalho e minuta', unidade: 'Unidade proponente', vai: ['Chamamento público', 'Revisão da instrução'], situacao_registro: { modulo: 'parcerias', ao_entrar: 'Pendente', ao_assumir: 'Em análise' }, nome_publico: 'Instrução da proposta',
            orientacao: `A proposta sobe à ${SUBINST} com a minuta do termo e, se for o caso, o plano de trabalho, a justificativa e a anuência expressa dos demais partícipes, se possível (${P59}, art. 1º). O estudo técnico mostra as alternativas, os riscos, os custos e a capacidade de cada partícipe. O plano de trabalho é obrigatório no convênio e nas parcerias com repasse; no termo de cooperação basta o plano simplificado (IN CAGE 4/2024, arts. 5º e 43). Com organização da sociedade civil e repasse, a regra é o chamamento público; a dispensa e a inexigibilidade se justificam nos arts. 30 e 31 da Lei 13.019, e o acordo de cooperação sem cessão de bem público dispensa o chamamento. Informe a pasta na rede: o painel a exige na revisão.`,
            acoes: [
                A.documento('Juntar o estudo técnico', 'Estudo técnico', { nivel: 'recomendado', ajuda: 'Alternativas avaliadas, riscos, custos e a capacidade técnica e operacional de cada partícipe.' }),
                A.simNao('O instrumento exige plano de trabalho?', { obrigatoria: true, ajuda: 'Sim sempre que houver repasse ou metas a cumprir; no termo de cooperação, plano simplificado.' }),
                A.documento('Juntar o plano de trabalho', 'Plano de trabalho', { se: quando('O instrumento exige plano de trabalho?', 'sim'), ajuda: 'Objeto, metas e etapas, cronograma, responsáveis, indicadores e, com repasse, o cronograma de desembolso.' }),
                A.documento('Redigir a minuta do termo', 'Minuta', { forma: 'redigir' }),
                A.documento('Redigir a justificativa do ajuste', 'Justificativa', { forma: 'redigir' }),
                A.simNao('Os demais partícipes anuíram expressamente?', { obrigatoria: true, ajuda: 'A anuência acompanha a proposta, se possível (art. 1º, III). Sem ela, registre o motivo.' }),
                A.documento('Juntar a anuência dos partícipes', 'Anuência', { forma: 'juntar', nivel: 'recomendado', se: quando('Os demais partícipes anuíram expressamente?', 'sim') }),
                A.fazer('Conferir a representação legal e o CNPJ de cada partícipe', { obrigatoria: true }),
                A.escolha('Seleção do partícipe', ['Não se aplica (ente público ou instrumento sem seleção)', 'Chamamento público', 'Dispensa ou inexigibilidade de chamamento'], { obrigatoria: true, ajuda: 'Só há seleção com organização da sociedade civil. A dispensa e a inexigibilidade pedem justificativa publicada.' }),
                A.texto('Pasta na rede', { obrigatoria: true, ...aoPainel('network_folder'), ajuda: 'Onde ficam a minuta e os anexos. O painel exige este dado para a revisão.' }),
            ],
            saidas: { 'Chamamento público': quando('Seleção do partícipe', 'Chamamento público') }, padrao: 'Revisão da instrução',
        },
        {
            nome: 'Chamamento público', unidade: 'Comissão de seleção', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Revisão da instrução', 'Arquivamento da proposta'], nome_publico: 'Chamamento público aberto',
            orientacao: 'Só para parceria com organização da sociedade civil. O edital fica publicado por pelo menos 30 dias no sítio oficial (Lei 13.019, art. 26). A comissão de seleção julga as propostas pela adequação aos objetivos e ao valor de referência (art. 27); membro com vínculo com proponente é substituído. Publicado o resultado, abre-se o prazo de recurso do edital; decididos os recursos, a autoridade homologa. Só depois se conferem os documentos da selecionada (arts. 33 e 34).',
            acoes: [
                A.documento('Juntar o edital de chamamento', 'Edital', { forma: 'redigir' }),
                A.data('Data da publicação do edital', { obrigatoria: true }),
                A.documento('Juntar a ata de julgamento das propostas', 'Ata', { forma: 'redigir' }),
                A.fazer('Publicar o resultado e decidir os recursos', { obrigatoria: true }),
                A.escolha('Resultado do chamamento', ['Organização selecionada e habilitada', 'Sem proposta adequada'], { obrigatoria: true }),
            ],
            saidas: { 'Revisão da instrução': quando('Resultado do chamamento', 'Organização selecionada e habilitada'), 'Arquivamento da proposta': quando('Resultado do chamamento', 'Sem proposta adequada') },
        },
        {
            nome: 'Revisão da instrução', unidade: SUBINST, vai: ['Aprovação da minuta', 'Estudo técnico, plano de trabalho e minuta'], situacao_registro: coluna('Em revisão'), nome_publico: 'Proposta em revisão',
            orientacao: `A assessoria da ${SUBINST} confere se a proposta veio com minuta, plano de trabalho (quando for o caso), justificativa e anuência (${P59}, art. 1º) e revisa o texto. A Subprocuradoria pode ouvir os órgãos de administração, de execução e auxiliares que tenham atribuição ou interesse na matéria (art. 1º, § 2º). Faltando peça, a proposta volta a quem propôs.`,
            acoes: [
                A.fazer('Conferir a minuta, o plano de trabalho, a justificativa e a anuência', { obrigatoria: true }),
                A.simNao('É preciso ouvir outro órgão do Ministério Público?', { obrigatoria: true, ajuda: 'Órgãos de administração, de execução ou auxiliares com atribuição ou interesse na matéria (art. 1º, § 2º).' }),
                A.documento('Juntar a manifestação do órgão ouvido', 'Manifestação', { forma: 'juntar', nivel: 'recomendado', se: quando('É preciso ouvir outro órgão do Ministério Público?', 'sim') }),
                A.documento('Juntar a minuta revisada', 'Minuta', { nivel: 'recomendado' }),
                A.simNao('A instrução está completa?', { obrigatoria: true }),
            ],
            saidas: { 'Aprovação da minuta': quando('A instrução está completa?', 'sim'), 'Estudo técnico, plano de trabalho e minuta': quando('A instrução está completa?', 'nao') },
        },
        {
            nome: 'Aprovação da minuta', unidade: SUBINST, vai: ['Direção-Geral e CAGE', 'Aprovação do Procurador-Geral', 'Estudo técnico, plano de trabalho e minuta', 'Arquivamento da proposta'], situacao_registro: coluna('Revisadas'), nome_publico: 'Minuta em aprovação',
            orientacao: `O Subprocurador-Geral para Assuntos Institucionais decide sobre a minuta. Aprovada e sem recursos, o expediente vai ao Procurador-Geral (${P59}, art. 3º). Com recursos financeiros ou orçamentários, passa antes pela Direção-Geral (art. 2º): nesse caso informe para quem o expediente é remetido, porque o painel o põe em "Aguarda Terceiros".`,
            acoes: [
                A.escolha('Decisão da Subprocuradoria', ['Aprovada, com recursos: vai à Direção-Geral', 'Aprovada, sem recursos: vai ao Procurador-Geral', 'Devolvida para ajustes', 'Rejeitada'], { obrigatoria: true, quem: 'gestor' }),
                A.documento('Juntar o despacho da Subprocuradoria', 'Despacho', { forma: 'redigir', nivel: 'recomendado' }),
                A.texto('Remetido para', { obrigatoria: true, ...aoPainel('third_party'), se: quando('Decisão da Subprocuradoria', 'Aprovada, com recursos: vai à Direção-Geral', 'Aprovada, sem recursos: vai ao Procurador-Geral'), ajuda: 'Ex.: Direção-Geral e Seccional da CAGE, ou Gabinete do Procurador-Geral. Vai para a ficha da parceria.' }),
            ],
            saidas: {
                'Direção-Geral e CAGE': quando('Decisão da Subprocuradoria', 'Aprovada, com recursos: vai à Direção-Geral'),
                'Aprovação do Procurador-Geral': quando('Decisão da Subprocuradoria', 'Aprovada, sem recursos: vai ao Procurador-Geral'),
                'Estudo técnico, plano de trabalho e minuta': quando('Decisão da Subprocuradoria', 'Devolvida para ajustes'),
                'Arquivamento da proposta': quando('Decisão da Subprocuradoria', 'Rejeitada'),
            },
        },
        {
            nome: 'Direção-Geral e CAGE', unidade: 'Direção-Geral', vai: ['Aprovação do Procurador-Geral', 'Estudo técnico, plano de trabalho e minuta', 'Arquivamento da proposta'], situacao_registro: coluna('Aguarda Terceiros'), nome_publico: 'Análise orçamentária e jurídica',
            orientacao: `Só quando há recursos. A Assessoria de Planejamento e Orçamento examina a conformidade da despesa, a disponibilidade orçamentária e a forma de operacionalizar. A Assessoria Jurídica da Direção-Geral emite parecer que, acolhido pelo Diretor-Geral e pelo Subprocurador-Geral para Assuntos Administrativos, leva os autos à Seccional da CAGE junto ao Ministério Público, para aprovação (${P59}, art. 2º). A IN CAGE 4/2024 pede a habilitação prévia do convenente (art. 4º; município: certidão de regularidade no CHE), a comprovação de que não há pendência no CADIN/RS, a dotação com empenho (arts. 4º, § 7º, e 9º), o fiscal e o suplente designados por portaria antes da celebração (art. 30) e veda convênio com entidade dirigida por agente político ou parente até o segundo grau (art. 17). Repasse acima de R$ 500 mil sai em pelo menos três parcelas (art. 15).`,
            acoes: [
                A.fazer('Exame da Assessoria de Planejamento e Orçamento', { obrigatoria: true, ajuda: 'Conformidade da despesa, disponibilidade orçamentária e forma de operacionalização (art. 2º, I).' }),
                A.fazer('Conferir a habilitação do convenente e o CADIN/RS', { obrigatoria: true, ajuda: 'Documentos do art. 4º da IN CAGE 4/2024; certidão vencida é renovada antes do empenho.' }),
                A.documento('Juntar o parecer da Assessoria Jurídica', 'Parecer', { forma: 'redigir' }),
                A.simNao('Parecer acolhido pelo Diretor-Geral e pelo Subprocurador Administrativo?', { obrigatoria: true }),
                A.texto('Fiscal e suplente indicados', { obrigatoria: true, ajuda: 'A portaria de designação é publicada antes da celebração (IN CAGE 4/2024, art. 30).' }),
                A.escolha('Manifestação da Seccional da CAGE', ['Aprovada', 'Aprovada com ajustes', 'Não aprovada'], { obrigatoria: true }),
                A.documento('Juntar a manifestação da CAGE', 'Manifestação', { forma: 'juntar', nivel: 'recomendado' }),
            ],
            saidas: {
                'Aprovação do Procurador-Geral': quando('Manifestação da Seccional da CAGE', 'Aprovada'),
                'Estudo técnico, plano de trabalho e minuta': quando('Manifestação da Seccional da CAGE', 'Aprovada com ajustes'),
                'Arquivamento da proposta': quando('Manifestação da Seccional da CAGE', 'Não aprovada'),
            },
        },
        {
            nome: 'Aprovação do Procurador-Geral', unidade: 'Gabinete do Procurador-Geral', vai: ['Assinatura', 'Estudo técnico, plano de trabalho e minuta', 'Arquivamento da proposta'], nome_publico: 'Aprovação final',
            orientacao: `O Procurador-Geral de Justiça dá a aprovação final (${P59}, arts. 3º e 4º). Ele pode delegar a membro, por portaria específica, o poder de assinar em nome da Instituição (art. 7º). No painel, a parceria continua em "Aguarda Terceiros" até a publicação.`,
            acoes: [
                A.escolha('Decisão do Procurador-Geral', ['Aprovado', 'Devolvido para ajustes', 'Não aprovado'], { obrigatoria: true, quem: 'gestor' }),
                A.simNao('A assinatura será delegada a membro?', { obrigatoria: true, se: quando('Decisão do Procurador-Geral', 'Aprovado') }),
                A.documento('Juntar a portaria de delegação', 'Portaria', { forma: 'juntar', se: quando('A assinatura será delegada a membro?', 'sim') }),
                A.texto('Quem assina por último', { obrigatoria: true, ...aoPainel('third_party'), se: quando('Decisão do Procurador-Geral', 'Aprovado'), ajuda: 'O partícipe que recebe o termo para assinar. Atualiza o "Remetido para" da ficha.' }),
            ],
            saidas: { 'Assinatura': quando('Decisão do Procurador-Geral', 'Aprovado'), 'Estudo técnico, plano de trabalho e minuta': quando('Decisão do Procurador-Geral', 'Devolvido para ajustes'), 'Arquivamento da proposta': quando('Decisão do Procurador-Geral', 'Não aprovado') },
        },
        {
            nome: 'Assinatura', unidade: 'Chefia de Gabinete', vai: ['Publicação e registro', 'Arquivamento da proposta'], situacao_registro: coluna('Aguarda Terceiros'), nome_publico: 'Assinatura do termo',
            orientacao: `A Chefia de Gabinete faz a formatação final, agenda a assinatura e, com a Assessoria de Relações Públicas, organiza a solenidade, se houver (${P59}, art. 4º). Com recursos, o termo só vai à assinatura depois do parecer jurídico e do registro do empenho (IN CAGE 4/2024, art. 10).`,
            acoes: [
                A.fazer('Fazer a formatação final do termo', { obrigatoria: true }),
                A.audiencia('Solenidade de assinatura', 'reuniao'),
                A.comunicar('Enviar o termo para a assinatura dos partícipes', { especie: 'comunicacao', polos: ['interessado'], dias: 10, texto: 'Segue o termo aprovado para assinatura. Devolva-o assinado no prazo indicado.' }, { ajuda: 'Use quando o partícipe assina à distância; em solenidade, marque só a ação seguinte.' }),
                A.simNao('Todos os partícipes assinaram?', { obrigatoria: true }),
                A.documento('Juntar o termo assinado', 'Termo', { forma: 'juntar', se: quando('Todos os partícipes assinaram?', 'sim') }),
            ],
            saidas: { 'Publicação e registro': quando('Todos os partícipes assinaram?', 'sim'), 'Arquivamento da proposta': quando('Todos os partícipes assinaram?', 'nao') },
        },
        {
            nome: 'Publicação e registro', unidade: SUBINST, vai: ['Parceria formalizada'], nome_publico: 'Publicação',
            orientacao: `Assinado, o expediente volta à ${SUBINST} para: publicar a súmula no Diário Eletrônico do Ministério Público; pôr o inteiro teor e a súmula nas páginas da internet e da intranet; manter o banco de dados e controlar a vigência; e divulgar o ajuste a membros e servidores (${P59}, art. 5º). O banco de dados é o Painel de Parcerias: o formulário abaixo preenche a ficha, e a parceria passa à coluna "Parcerias" na fase seguinte. O aviso de renovação é a data em que o painel avisa do fim da vigência: 60 dias antes, como manda o art. 6º. Em termo aditivo, conclua o aditivo na ficha da parceria, pelo painel, e use o formulário só para guardar os dados no processo. Com recursos, a súmula é condição de eficácia e o instrumento é cadastrado no sistema FPE; o termo de cooperação também é cadastrado, com plano de trabalho simplificado (IN CAGE 4/2024, arts. 9º, III, e 43).`,
            acoes: [
                A.fazer('Publicar a súmula no Diário Eletrônico do Ministério Público', { obrigatoria: true }),
                A.formulario('Registrar o instrumento na ficha da parceria', [
                    { id: 'tipo', rotulo: 'Tipo de parceria (como cadastrado no painel)', tipo: 'texto', obrigatorio: true },
                    { id: 'numero', rotulo: 'Número do instrumento', tipo: 'texto' },
                    { id: 'objeto', rotulo: 'Objeto', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'assinatura', rotulo: 'Data da assinatura', tipo: 'data', obrigatorio: true },
                    { id: 'retorno', rotulo: 'Data em que o termo voltou assinado', tipo: 'data', obrigatorio: true },
                    { id: 'demp', rotulo: 'Publicação no DEMP (edição e data)', tipo: 'texto', obrigatorio: true },
                    { id: 'vigencia', rotulo: 'Vigência (ex.: 60 meses)', tipo: 'texto', obrigatorio: true },
                    { id: 'fim', rotulo: 'Termo final', tipo: 'data', obrigatorio: true },
                    { id: 'aviso', rotulo: 'Aviso de renovação (60 dias antes do fim)', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true, ao_registro: { modulo: 'parcerias', campos: { tipo: 'partnership_type', numero: 'partnership_number', objeto: 'object', assinatura: 'signature_date', retorno: 'third_party_return_date', demp: 'demp', vigencia: 'validity_period', fim: 'end_date', aviso: 'renewal_notice_date' } } }),
                A.fazer('Publicar o inteiro teor e a súmula na internet e na intranet', { obrigatoria: true }),
                A.fazer('Divulgar o ajuste a membros e servidores', { obrigatoria: true }),
                A.fazer('Cadastrar o instrumento no sistema FPE', { recomendada: true, ajuda: 'Convênio e termo de cooperação (IN CAGE 4/2024, arts. 8º e 43). Confira com a Seccional da CAGE.' }),
                A.derivado('Abrir o acompanhamento da execução', 'Acompanhamento de convênio ou parceria no MPRS', { recomendada: true, ajuda: 'O processo de acompanhamento nasce ligado a este e segue até o fim da vigência.' }),
            ],
        },
        {
            nome: 'Parceria formalizada', unidade: SUBINST, final: true, ao_entrar: { arquivar: true }, situacao_registro: coluna('Parcerias'), nome_publico: 'Parceria vigente',
            orientacao: 'A parceria está publicada e, no painel, na coluna "Parcerias", com a vigência e o aviso de renovação controlados. O expediente é arquivado ou remetido ao órgão designado para acompanhar a execução (art. 5º, III): o acompanhamento corre no processo derivado.',
        },
        ARQUIVADA('A proposta não seguiu: rejeitada, sem proposta adequada no chamamento, não aprovada pela CAGE ou pelo Procurador-Geral, ou não assinada. Registre o motivo. No Painel de Parcerias, a ficha continua na coluna em que estava: exclua-a ou extinga-a por lá, conforme o caso.'),
    ]);
}

const SEGUE = ['Registrar o acompanhamento do período', 'Relatório anual', 'Alteração ou termo aditivo', 'Renovação da vigência', 'Irregularidade ou descumprimento', 'Prestação de contas', 'Denúncia, rescisão ou extinção', 'Objeto concluído ou fim da vigência'];

/**
 * Acompanhamento da execução, comum aos três âmbitos: o que muda (unidades,
 * normas, prazos e textos) vem em `p`. As fases são as mesmas para o usuário
 * reconhecer o rito em qualquer esfera.
 */
function acompanhamento(meta, p) {
    return montar({ area: 'parcerias', porte: 'longo', tipo: PARTICIPES, ...meta }, [
        {
            nome: 'Início do acompanhamento', unidade: p.gestor, vai: ['Execução e fiscalização'], nome_publico: 'Início da execução',
            orientacao: p.inicio,
            acoes: [
                A.formulario('Registrar os dados do instrumento', [
                    { id: 'processo', rotulo: p.rotuloProcesso, tipo: 'texto', obrigatorio: true },
                    { id: 'instrumento', rotulo: 'Instrumento', tipo: 'lista', opcoes: p.instrumentos, obrigatorio: true },
                    { id: 'numero', rotulo: 'Número do instrumento', tipo: 'texto' },
                    { id: 'participes', rotulo: 'Partícipes', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'objeto', rotulo: 'Objeto', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'recursos', rotulo: 'Há repasse de recursos?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor total (R$)', tipo: 'numero' },
                    { id: 'assinatura', rotulo: 'Data da assinatura', tipo: 'data', obrigatorio: true },
                    { id: 'fim', rotulo: 'Fim da vigência', tipo: 'data' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.texto(p.rotuloFiscal, { obrigatoria: true, ajuda: p.ajudaFiscal }),
                A.fazer('Conferir a publicação e os cadastros do instrumento', { obrigatoria: true, ajuda: p.ajudaPublicacao }),
                A.cronograma('Registrar as metas, as entregas e as parcelas do plano de trabalho', { recomendada: true, ajuda: 'Cada item vira um prazo com alerta. Com repasse, informe o valor de cada parcela.' }),
                A.comunicar('Avisar os partícipes de quem acompanha a execução', { especie: 'comunicacao', polos: ['interessado'], dias: 0, texto: 'Informamos os responsáveis pelo acompanhamento da parceria e o canal para envio de relatórios e documentos.' }),
            ],
        },
        {
            nome: 'Execução e fiscalização', unidade: p.gestor,
            vai: ['Acompanhamento do período', 'Relatório anual', 'Alteração ou termo aditivo', 'Renovação da vigência', 'Irregularidade ou descumprimento', 'Prestação de contas', 'Denúncia, rescisão ou extinção', 'Encerramento'],
            nome_publico: 'Em execução',
            orientacao: 'O processo fica nesta fase enquanto a parceria é executada. Os prazos do cronograma (metas, entregas e parcelas) alertam sozinhos. Quando algo acontecer, escolha o que vem agora: cada evento tem a sua fase e volta para cá quando termina.',
            acoes: [
                A.orientar('Acompanhe os prazos do cronograma e registre cada período', 'Os alertas do cronograma avisam o que vence. O registro de cada período se faz na fase "Acompanhamento do período".'),
                A.escolha('O que vem agora', SEGUE, { obrigatoria: true, ajuda: 'Escolha o evento; cada um tem a sua fase e volta para cá quando termina.' }),
            ],
            saidas: {
                'Acompanhamento do período': quando('O que vem agora', 'Registrar o acompanhamento do período'),
                'Relatório anual': quando('O que vem agora', 'Relatório anual'),
                'Alteração ou termo aditivo': quando('O que vem agora', 'Alteração ou termo aditivo'),
                'Renovação da vigência': quando('O que vem agora', 'Renovação da vigência'),
                'Irregularidade ou descumprimento': quando('O que vem agora', 'Irregularidade ou descumprimento'),
                'Prestação de contas': quando('O que vem agora', 'Prestação de contas'),
                'Denúncia, rescisão ou extinção': quando('O que vem agora', 'Denúncia, rescisão ou extinção'),
                'Encerramento': quando('O que vem agora', 'Objeto concluído ou fim da vigência'),
            },
        },
        {
            nome: 'Acompanhamento do período', unidade: p.gestor, vai: ['Execução e fiscalização'], nome_publico: 'Em execução', orientacao: p.execucao,
            acoes: [
                A.textoLongo('Registro do acompanhamento do período', { obrigatoria: true, ajuda: 'O que foi feito, o que atrasou e as providências. Compare com as metas do plano de trabalho.' }),
                A.documento('Juntar relatório, ata ou comprovante do período', 'Relatório', { nivel: 'opcional' }),
                A.fazer(p.acaoPeriodica, { recomendada: true, ajuda: p.ajudaPeriodica }),
                A.audiencia('Reunião de acompanhamento com os partícipes', 'reuniao'),
            ],
        },
        {
            nome: 'Relatório anual', unidade: p.gestor, vai: ['Execução e fiscalização'], nome_publico: 'Avaliação anual', orientacao: p.relatorio,
            acoes: [
                A.documento('Redigir o relatório de avaliação', 'Relatório', { forma: 'redigir' }),
                A.escolha('Avaliação do período', ['Metas cumpridas', 'Metas cumpridas em parte', 'Metas não cumpridas'], { obrigatoria: true }),
                A.textoLongo('Providências recomendadas', { se: quando('Avaliação do período', 'Metas cumpridas em parte', 'Metas não cumpridas'), obrigatoria: true }),
                A.fazer(p.acaoRelatorio, { recomendada: true }),
            ],
        },
        {
            nome: 'Alteração ou termo aditivo', unidade: p.gestor, vai: ['Execução e fiscalização'], nome_publico: 'Alteração do instrumento', orientacao: p.alteracao,
            acoes: [
                A.escolha('Tipo de alteração', ['Ajuste por apostila (sem mudar cláusula nem valor)', 'Termo aditivo de valor ou de metas', 'Termo aditivo de prazo'], { obrigatoria: true }),
                A.documento('Juntar o pedido e a justificativa da alteração', 'Justificativa', {}),
                A.simNao('O objeto continua o mesmo?', { obrigatoria: true, ajuda: 'Mudar o objeto não se faz por aditivo: exige novo instrumento.' }),
                A.documento('Juntar a apostila', 'Apostila', { forma: 'redigir', se: quando('Tipo de alteração', 'Ajuste por apostila (sem mudar cláusula nem valor)') }),
                A.derivado('Abrir a formalização do termo aditivo', p.tipoFormalizacao, { se: quando('Tipo de alteração', 'Termo aditivo de valor ou de metas', 'Termo aditivo de prazo'), ajuda: 'O aditivo segue o mesmo caminho do termo original, em processo próprio ligado a este.' }),
            ],
        },
        {
            nome: 'Renovação da vigência', unidade: p.gestor, vai: ['Execução e fiscalização', 'Encerramento'], nome_publico: 'Consulta sobre a renovação', orientacao: p.renovacao,
            acoes: [
                A.comunicar('Consultar os partícipes sobre a renovação', { especie: 'comunicacao', polos: ['interessado'], dias: 15, texto: 'A vigência da parceria se aproxima do fim. Informe se há interesse em renovar e, havendo, envie a anuência expressa.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta dos partícipes', 'Consultar os partícipes sobre a renovação', { obrigatoria: true }),
                A.documento('Juntar a anuência dos partícipes', 'Anuência', { forma: 'juntar', nivel: 'recomendado', se: quando('Aguardar a resposta dos partícipes', 'Apresentada', 'Parcial') }),
                A.documento('Redigir a manifestação sobre o interesse em renovar', 'Manifestação', { forma: 'redigir' }),
                A.simNao('A parceria será renovada?', { obrigatoria: true, ajuda: p.ajudaRenovar }),
                A.derivado('Abrir a formalização do termo aditivo de prazo', p.tipoFormalizacao, { se: quando('A parceria será renovada?', 'sim') }),
            ],
            saidas: { 'Execução e fiscalização': quando('A parceria será renovada?', 'sim'), 'Encerramento': quando('A parceria será renovada?', 'nao') },
        },
        {
            nome: 'Irregularidade ou descumprimento', unidade: p.gestor, vai: ['Execução e fiscalização', 'Denúncia, rescisão ou extinção'], nome_publico: 'Apuração de irregularidade', orientacao: p.irregularidade,
            acoes: [
                A.textoLongo('Descrever a irregularidade ou o atraso', { obrigatoria: true }),
                A.comunicar('Notificar o partícipe para sanar ou esclarecer', { especie: 'notificacao', polos: ['interessado'], dias: p.diasSanear, contagem: corridos, texto: 'Foi constatada irregularidade na execução da parceria. Regularize ou apresente esclarecimentos no prazo indicado.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta do partícipe', 'Notificar o partícipe para sanar ou esclarecer', { obrigatoria: true }),
                A.documento('Juntar a análise da resposta', 'Análise', { forma: 'redigir' }),
                A.simNao('A irregularidade foi sanada ou justificada?', { obrigatoria: true, ajuda: p.ajudaSanada }),
            ],
            saidas: { 'Execução e fiscalização': quando('A irregularidade foi sanada ou justificada?', 'sim'), 'Denúncia, rescisão ou extinção': quando('A irregularidade foi sanada ou justificada?', 'nao') },
        },
        {
            nome: 'Denúncia, rescisão ou extinção', unidade: p.autoridade, vai: ['Prestação de contas', 'Encerramento'], nome_publico: 'Extinção antecipada', orientacao: p.extincao,
            acoes: [
                A.escolha('Motivo', ['Desistência de um partícipe (denúncia)', 'Descumprimento do pactuado (rescisão)', 'Consenso dos partícipes', 'Caso fortuito ou força maior'], { obrigatoria: true }),
                A.documento('Redigir o ato que encerra o instrumento', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Comunicar os partícipes do encerramento', { especie: 'notificacao', polos: ['interessado'], dias: 30, contagem: corridos, texto: 'Comunicamos o encerramento antecipado da parceria. Havendo recursos repassados, devolva o saldo e preste contas nos prazos do instrumento.' }, { obrigatoria: true, ajuda: p.ajudaExtincao }),
                A.fazer('Publicar o encerramento', { obrigatoria: true }),
                A.simNao('Houve repasse de recursos?', { obrigatoria: true }),
            ],
            saidas: { 'Prestação de contas': quando('Houve repasse de recursos?', 'sim'), 'Encerramento': quando('Houve repasse de recursos?', 'nao') },
        },
        {
            nome: 'Prestação de contas', unidade: p.contas, prazo_dias: p.diasContas, prazo_auto: true, prazo_contagem: corridos, vai: ['Execução e fiscalização', 'Encerramento'], nome_publico: 'Contas em análise', orientacao: p.prestacao,
            acoes: [
                A.comunicar('Notificar o partícipe para prestar contas', { especie: 'notificacao', polos: ['interessado'], dias: p.diasContas, contagem: corridos, texto: 'Apresente a prestação de contas dos recursos recebidos e devolva o saldo não aplicado, no prazo indicado.' }, { obrigatoria: true }),
                A.esperar('Aguardar a prestação de contas', 'Notificar o partícipe para prestar contas', { obrigatoria: true }),
                A.documento('Juntar a prestação de contas', 'Prestação de contas', { forma: 'juntar', se: quando('Aguardar a prestação de contas', 'Apresentada', 'Parcial') }),
                A.documento('Juntar o parecer técnico sobre o cumprimento do objeto', 'Parecer', { forma: 'redigir' }),
                A.documento('Juntar o parecer financeiro', 'Parecer', { forma: 'redigir', nivel: 'recomendado' }),
                A.simNao('Foi preciso diligência para completar as contas?', { obrigatoria: true, ajuda: p.ajudaDiligencia }),
                A.escolha('Resultado da análise', ['Aprovadas', 'Aprovadas com ressalvas', 'Rejeitadas'], { obrigatoria: true, quem: 'gestor', ajuda: p.ajudaAnalise }),
                A.derivado('Abrir a tomada de contas especial', 'Tomada de contas especial (fase interna)', { se: quando('Resultado da análise', 'Rejeitadas'), ajuda: 'Depois de esgotadas as medidas para reaver o valor. Corre em processo próprio, ligado a este.' }),
                A.simNao('O instrumento continua vigente?', { obrigatoria: true, ajuda: 'Sim nas contas parciais ou anuais; não nas contas finais.' }),
            ],
            saidas: { 'Execução e fiscalização': quando('O instrumento continua vigente?', 'sim'), 'Encerramento': quando('O instrumento continua vigente?', 'nao') },
        },
        {
            nome: 'Encerramento', unidade: p.gestor, final: true, ao_entrar: { arquivar: true }, nome_publico: 'Parceria encerrada', orientacao: p.encerramento,
            acoes: [
                A.documento('Redigir o relatório final', 'Relatório', { forma: 'redigir', nivel: 'recomendado' }),
                A.fazer('Registrar o destino dos bens e a devolução de saldos', { recomendada: true }),
                A.fazer(p.acaoFinal, { recomendada: true }),
            ],
        },
    ]);
}

/** 2. Acompanhamento no MPRS. */
export function parceriaAcompanhamentoMprs() {
    return acompanhamento({
        id: 'parceria-acompanhamento-mprs', nome: 'Acompanhamento de convênio ou parceria no MPRS: execução, fiscalização e renovação', referencia: 'MPRS',
        descricao: 'Acompanha o convênio, o termo de cooperação ou a parceria do Ministério Público do RS da publicação ao fim da vigência. O órgão designado registra o plano de trabalho como cronograma, com alerta em cada meta ou parcela, e a cada período anota a execução. Dali o processo vai para o evento que acontecer: relatório anual do fiscal, alteração por apostila ou termo aditivo, consulta sobre a renovação 60 dias antes do fim, irregularidade com notificação do partícipe, prestação de contas quando há repasse e denúncia ou rescisão. A renovação e o aditivo abrem a formalização em processo derivado, no mesmo caminho do Provimento 59/2011-PGJ. O partícipe é comunicado pelo portal e responde por lá.',
        quando: 'Abra um processo por instrumento, logo depois da publicação da súmula, de preferência a partir da ação "Abrir o acompanhamento da execução" da formalização. Use ao lado do Painel de Parcerias: o painel mostra a vigência, o aviso de renovação e os aditivos; este processo guarda os atos e os documentos da execução.',
        base: `${P59}, arts. 5º, III, e 6º; Instrução Normativa CAGE 4/2024, arts. 21 a 23, 25, 27, 28 a 42, 48 e 51; Lei 14.133/2021, art. 184; Lei 13.019/2014, arts. 58 a 72 (parcerias com organizações da sociedade civil).`,
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Ministério Público', interessado: 'Partícipe' } },
    }, {
        gestor: 'Órgão de acompanhamento', autoridade: SUBINST, contas: 'Direção-Geral', rotuloProcesso: 'PGEA', tipoFormalizacao: 'Convênio, termo de cooperação ou parceria no MPRS',
        instrumentos: ['Convênio', 'Termo de cooperação', 'Termo de fomento', 'Termo de colaboração', 'Acordo de cooperação', 'Protocolo de intenções'],
        rotuloFiscal: 'Fiscal ou gestor da parceria e suplente', ajudaFiscal: 'Com repasse, fiscal e suplente são designados por portaria publicada (IN CAGE 4/2024, art. 30).',
        ajudaPublicacao: 'Súmula no DEMP, inteiro teor na internet e na intranet e ficha no Painel de Parcerias (art. 5º).',
        inicio: `Publicada a súmula, a ${SUBINST} remete o expediente ao órgão designado para acompanhar a execução (${P59}, art. 5º, III). Registre os dados do instrumento, quem fiscaliza e o plano de trabalho como cronograma: cada meta, entrega ou parcela vira um prazo com alerta. No Painel de Parcerias, a parceria já está na coluna "Parcerias", com a vigência e o aviso de renovação.`,
        execucao: 'A cada período, anote o que foi executado e compare com o plano de trabalho. No convênio, o convenente registra a execução todo mês, até o dia 15, e o fiscal confere, atesta e condiciona a liberação de cada parcela (IN CAGE 4/2024, arts. 16, 25, II, v, e 30). Sem execução financeira em 180 dias da primeira parcela, o convênio é extinto (art. 27). Em obra com repasse de R$ 1 milhão ou mais, o fiscal visita o local ao final (art. 35). Depois escolha o que vem agora.',
        acaoPeriodica: 'Conferir os registros mensais e os requisitos da próxima parcela', ajudaPeriodica: 'Só no convênio com repasse: registro mensal até o dia 15 e requisitos do art. 16 da IN CAGE 4/2024.',
        relatorio: 'O fiscal avalia o termo de cooperação todo ano, em relatório juntado ao processo (IN CAGE 4/2024, art. 48). Nas parcerias com organização da sociedade civil, o relatório técnico de monitoramento e avaliação é homologado pela comissão de monitoramento (Lei 13.019, art. 59). Use esta fase também para a avaliação anual de qualquer instrumento.',
        acaoRelatorio: 'Submeter o relatório à comissão de monitoramento, se houver',
        alteracao: `A alteração é pedida com justificativa pelo menos 60 dias antes do fim da vigência e não pode mudar o objeto (IN CAGE 4/2024, art. 21). Remanejamento sem mudar o valor global, ajuste de metas sem redução e troca de dotação se fazem por apostila (art. 22). O termo aditivo segue o caminho da proposta original (${P59}, art. 1º): abra a formalização em processo derivado, sem ligá-lo à ficha. No Painel de Parcerias, crie o aditivo na ficha da parceria e mova-o por lá: o rito não conduz aditivos.`,
        renovacao: `Avisado com 60 dias de antecedência do fim da vigência, o interessado em continuar encaminha a manifestação, com a anuência expressa dos demais partícipes, à ${SUBINST}, que, constatando o interesse institucional, elabora o termo aditivo (${P59}, art. 6º). O Painel de Parcerias cria o aditivo de prorrogação sozinho na data do aviso de renovação.`,
        ajudaRenovar: 'A Subprocuradoria Institucional confirma o interesse institucional e elabora o aditivo (art. 6º).',
        irregularidade: 'No atraso ou na inexecução, o fiscal dá ciência ao ordenador, que notifica o partícipe e determina a regularização (IN CAGE 4/2024, art. 31, parágrafo único). Havendo repasse, a liberação é suspensa e o partícipe tem até 30 dias para sanar ou esclarecer, prorrogáveis até o total de 90 (art. 32). Sem regularização, apura-se o dano e cobra-se o ressarcimento; persistindo, cabe tomada de contas especial.',
        diasSanear: 30, ajudaSanada: 'Não sanada: apure o dano e cobre o ressarcimento antes de extinguir (IN CAGE 4/2024, art. 32, §§ 3º e 4º).',
        extincao: 'Qualquer partícipe pode se retirar a qualquer tempo, devolvendo em até 30 dias os recursos não usados e os rendimentos (IN CAGE 4/2024, art. 42, § 3º). A administração extingue antes do prazo por não execução, desvio de finalidade, demora injustificada, falta de contas, falta da contrapartida ou descumprimento com prejuízo (art. 42), com devolução corrigida pela SELIC. Os motivos ficam formalizados no processo (§ 6º) e as obrigações do período continuam valendo (§ 4º). No painel, extinga a parceria na própria ficha.',
        ajudaExtincao: 'Saldo e rendimentos voltam em até 30 dias (IN CAGE 4/2024, art. 42, § 3º).',
        diasContas: 60,
        prestacao: 'Só quando há repasse. O convenente insere os comprovantes em até 30 dias de cada pagamento e presta contas em até 60 dias do fim do prazo do objeto ou da extinção (IN CAGE 4/2024, arts. 37 e 38). O fiscal atesta a execução física, a unidade financeira emite o parecer financeiro e a unidade técnica, o parecer sobre os objetivos; a autoridade decide em até 6 meses pela aprovação, aprovação com ressalvas ou rejeição (arts. 40 e 41). A diligência dá até 30 dias, prorrogáveis uma vez (art. 41, § 5º). Rejeitadas as contas com dano, instaura-se tomada de contas especial (art. 51). Com organização da sociedade civil, valem os prazos da Lei 13.019 (arts. 69 a 72).',
        ajudaDiligencia: 'A diligência fixa prazo de até 30 dias, prorrogável uma vez (IN CAGE 4/2024, art. 41, § 5º).', ajudaAnalise: 'A autoridade decide em até 6 meses do recebimento das contas (IN CAGE 4/2024, art. 40, § 2º).',
        encerramento: 'Concluído o objeto ou vencida a vigência sem renovação, registre o resultado, o destino dos bens e a devolução de saldos. No Painel de Parcerias, extinga a parceria na ficha (a extinção pede a confirmação de quem a faz e vale para todos os aditivos).',
        acaoFinal: 'Extinguir a parceria no Painel de Parcerias',
    });
}

/* ---------------------------------------------------------- Estado do RS */

const IN4 = 'IN CAGE 4/2024';
const D53175 = 'Decreto 53.175/2016';
const INSTRUMENTOS_RS = ['Convênio (repasse a município, consórcio ou entidade admitida)', 'Termo de cooperação (sem repasse)', 'Termo de colaboração ou de fomento (organização da sociedade civil)', 'Acordo de cooperação (organização da sociedade civil, sem repasse)', 'Convênio em que o Estado recebe recursos da União'];
const OSC_RS = ['Termo de colaboração ou de fomento (organização da sociedade civil)', 'Acordo de cooperação (organização da sociedade civil, sem repasse)'];

/** 3. Formalização no Estado do RS. */
export function parceriaFormalizacaoRs() {
    return montar({
        id: 'parceria-formalizacao-rs', nome: 'Convênio, termo de cooperação ou parceria no Estado do RS: da demanda à publicação', area: 'parcerias', porte: 'longo', referencia: 'Estado do RS',
        descricao: 'Formaliza os ajustes dos órgãos e entidades do Estado do Rio Grande do Sul. O convênio e o termo de cooperação seguem a Instrução Normativa CAGE 4/2024: habilitação do proponente, plano de trabalho no Portal de Convênios e Parcerias, análise de viabilidade, registro no sistema FPE com a lista de verificação, CADIN/RS, dotação e empenho, parecer jurídico, fiscal designado por portaria, delegação de competência, assinatura e súmula no Diário Oficial, que é condição de eficácia. A parceria com organização da sociedade civil segue o Decreto 53.175/2016: chamamento público com edital por 30 dias ou justificativa de dispensa, sujeita a impugnação em 5 dias, plano de trabalho, parecer técnico e jurídico, gestor e comissão de monitoramento. O rito começa na demanda, com o problema, a solução e o estudo técnico, e pergunta o instrumento para mostrar só o que vale para ele.',
        quando: 'Secretarias, autarquias e fundações do Estado do RS, e também os demais Poderes e órgãos autônomos estaduais quando seguem a norma da CAGE. Para o Ministério Público do RS, use o rito próprio, que soma o Provimento 59/2011-PGJ. Município pode adaptar, trocando a norma estadual pela sua.',
        base: `Instrução Normativa CAGE 4/2024, arts. 1º a 24 e 43 a 47 (em vigor desde 1º/1/2025; revogou a IN CAGE 6/2016); ${D53175}, arts. 13 a 34 e 42 a 44 (parcerias com organizações da sociedade civil; confira as alterações dos Decretos 53.534/2017 e 54.973/2019); Decretos 53.196/2016 (FPE) e 56.939/2023 (monitoramento de convênios); Lei 14.133/2021, art. 184; Lei 13.019/2014.`,
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Órgão estadual', interessado: 'Partícipe' } },
    }, [
        {
            nome: 'Demanda e enquadramento', unidade: 'Unidade demandante', vai: ['Seleção da organização', 'Habilitação e plano de trabalho'], nome_publico: 'Proposta em elaboração',
            orientacao: `Registre a demanda, converse com os partícipes e descreva o problema e a solução. Escolha o instrumento: convênio só para transferir recursos a ente de outra esfera, consórcio público, serviço social autônomo ou entidade beneficente de saúde (${IN4}, art. 2º, II), e é obrigatório nas transferências voluntárias (art. 52); termo de cooperação quando não há repasse (art. 2º, XXIX); com organização da sociedade civil, termo de colaboração (plano de iniciativa do Estado), termo de fomento (plano proposto pela organização) ou acordo de cooperação, sem repasse (${D53175}, arts. 13 a 15). É vedado convênio com pessoa física, com empresa e com entidade dirigida por agente político ou parente até o segundo grau (${IN4}, art. 17).`,
            acoes: [
                A.formulario('Registrar os dados da demanda', [
                    { id: 'processo', rotulo: 'Processo administrativo (PROA)', tipo: 'texto', obrigatorio: true },
                    { id: 'participes', rotulo: 'Partícipes (nome e CNPJ)', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'objeto', rotulo: 'Objeto', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'programa', rotulo: 'Programa de governo ou política pública', tipo: 'texto' },
                    { id: 'valor', rotulo: 'Valor do repasse estadual (R$)', tipo: 'numero' },
                    { id: 'contrapartida', rotulo: 'Contrapartida (R$)', tipo: 'numero' },
                    { id: 'vigencia', rotulo: 'Vigência prevista (meses)', tipo: 'numero', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                PROBLEMA(),
                SOLUCAO(),
                A.documento('Juntar o estudo técnico', 'Estudo técnico', { nivel: 'recomendado', ajuda: 'Alternativas avaliadas, riscos, custos e a capacidade de quem vai executar.' }),
                A.escolha('Instrumento', INSTRUMENTOS_RS, { obrigatoria: true, folha_dados: true }),
                A.fazer('Conferir as vedações de celebração', { obrigatoria: true, ajuda: `${IN4}, art. 17; com organização da sociedade civil, ${D53175}, arts. 42 e 43.` }),
                A.fazer('Registrar os contatos e as reuniões com os partícipes', { recomendada: true }),
                A.audiencia('Reunião de alinhamento com os partícipes', 'reuniao'),
            ],
            saidas: { 'Seleção da organização': quando('Instrumento', ...OSC_RS) }, padrao: 'Habilitação e plano de trabalho',
        },
        {
            nome: 'Seleção da organização', unidade: 'Comissão de seleção', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Habilitação e plano de trabalho', 'Arquivamento da proposta'], nome_publico: 'Seleção da organização parceira',
            orientacao: `Só para organização da sociedade civil. A regra é o chamamento público, com edital divulgado no sítio oficial por pelo menos 30 dias (${D53175}, arts. 21 a 24). Só depois de ordenadas as propostas se conferem os documentos da selecionada; se ela não atender, convida-se a seguinte (art. 26). A dispensa e a inexigibilidade (arts. 27 e 28) pedem justificativa publicada no mesmo dia, que pode ser impugnada em 5 dias e é analisada em outros 5 (art. 29). O acordo de cooperação sem cessão de bem público não exige chamamento (Lei 13.019, art. 29).`,
            acoes: [
                A.escolha('Forma de seleção', ['Chamamento público', 'Dispensa de chamamento', 'Inexigibilidade de chamamento', 'Sem chamamento (acordo de cooperação ou emenda parlamentar)'], { obrigatoria: true }),
                A.documento('Juntar o edital de chamamento', 'Edital', { forma: 'redigir', se: quando('Forma de seleção', 'Chamamento público') }),
                A.data('Data da publicação do edital', { obrigatoria: true, se: quando('Forma de seleção', 'Chamamento público') }),
                A.documento('Juntar a ata de julgamento e a homologação', 'Ata', { forma: 'redigir', se: quando('Forma de seleção', 'Chamamento público') }),
                A.documento('Juntar a justificativa publicada', 'Justificativa', { forma: 'redigir', se: quando('Forma de seleção', 'Dispensa de chamamento', 'Inexigibilidade de chamamento'), ajuda: 'Publicada no sítio oficial no mesmo dia; cabe impugnação em 5 dias (art. 29).' }),
                A.escolha('Resultado da seleção', ['Organização definida', 'Sem organização apta'], { obrigatoria: true }),
            ],
            saidas: { 'Habilitação e plano de trabalho': quando('Resultado da seleção', 'Organização definida'), 'Arquivamento da proposta': quando('Resultado da seleção', 'Sem organização apta') },
        },
        {
            nome: 'Habilitação e plano de trabalho', unidade: 'Unidade demandante', vai: ['Instrução, registro e pareceres', 'Arquivamento da proposta'], nome_publico: 'Habilitação do proponente',
            orientacao: `No convênio, o proponente é habilitado antes (${IN4}, art. 4º): município apresenta a certidão de regularidade no CHE; os demais, as certidões federais, trabalhista e do FGTS e os atos constitutivos. Habilitado, preenche o plano de trabalho no Portal de Convênios e Parcerias, com objeto, etapas e metas, cronograma físico e de desembolso, projeto básico ou termo de referência, justificativa, público-alvo, capacidade técnica, contrapartida e indicadores (art. 5º). O órgão analisa a viabilidade técnica, orçamentária e financeira e manda sanar o que faltar; sem resposta no prazo, entende-se que o proponente desistiu (art. 6º). No termo de cooperação bastam a representação legal, o CNPJ e o plano de trabalho simplificado (art. 44). A organização da sociedade civil comprova os requisitos dos arts. 30 e 31 do ${D53175} e apresenta o plano do art. 18.`,
            acoes: [
                A.fazer('Conferir a habilitação do proponente', { obrigatoria: true, ajuda: 'Convênio: art. 4º da IN CAGE 4/2024. Termo de cooperação: só representação legal e CNPJ (art. 44).' }),
                A.documento('Juntar o plano de trabalho', 'Plano de trabalho', { forma: 'juntar' }),
                A.documento('Juntar o projeto básico ou o termo de referência', 'Termo de referência', { forma: 'juntar', nivel: 'recomendado', ajuda: 'Obra pede projeto básico com responsável técnico; compra ou serviço, termo de referência (art. 7º).' }),
                A.comunicar('Notificar o proponente para sanar o plano de trabalho', { especie: 'notificacao', polos: ['interessado'], dias: 15, texto: 'Foram constatadas pendências no plano de trabalho. Corrija-as no prazo indicado; sem resposta, a proposta será considerada desistida.' }, { ajuda: 'Só se houver pendência. O prazo é o que o órgão fixar e pode ser prorrogado a pedido (art. 6º, § 1º).' }),
                A.documento('Juntar a análise de viabilidade do plano de trabalho', 'Parecer', { forma: 'redigir' }),
                A.simNao('Plano de trabalho aprovado?', { obrigatoria: true }),
            ],
            saidas: { 'Instrução, registro e pareceres': quando('Plano de trabalho aprovado?', 'sim'), 'Arquivamento da proposta': quando('Plano de trabalho aprovado?', 'nao') },
        },
        {
            nome: 'Instrução, registro e pareceres', unidade: 'Unidade de convênios', vai: ['Assinatura', 'Habilitação e plano de trabalho', 'Arquivamento da proposta'], nome_publico: 'Análise técnica e jurídica',
            orientacao: `Aprovado o plano, o órgão registra o ajuste no módulo Convênios e Parcerias do sistema FPE; o processo anda junto com o registro, e cada unidade preenche a sua parte da lista de verificação do SINCAGE (${IN4}, art. 8º). Juntam-se a consulta ao CADIN/RS, o cadastro no FPE e a dotação liberada (art. 9º, I). Use a minuta padronizada da CAGE e da Procuradoria-Geral do Estado, justificando o que mudar (art. 54). O fiscal e o suplente são designados por portaria antes da celebração (art. 30). Repasse acima de R$ 500 mil sai em pelo menos três parcelas iguais, com 90 dias entre elas (art. 15); a vigência vai até 60 meses (art. 20, IV) e o termo de cooperação dura no mínimo 5 anos, salvo justificativa (art. 46). Convênio com a União passa antes pelo Departamento de Captação de Recursos (art. 8º, § 5º). Com organização da sociedade civil, o parecer técnico trata do mérito, da reciprocidade, da viabilidade, do cronograma e da fiscalização, e designam-se o gestor e a comissão de monitoramento (${D53175}, art. 32). A CAGE escolhe por risco o que analisa antes (${IN4}, art. 62).`,
            acoes: [
                A.fazer('Registrar o ajuste no sistema FPE', { obrigatoria: true }),
                A.fazer('Preencher a lista de verificação do SINCAGE', { obrigatoria: true }),
                A.fazer('Juntar a consulta ao CADIN/RS e a comprovação da dotação', { recomendada: true, ajuda: 'Só com repasse. Sem dotação evidenciada por empenho não há convênio (art. 4º, § 7º).' }),
                A.documento('Juntar a minuta do termo', 'Minuta', { forma: 'redigir' }),
                A.documento('Juntar o parecer técnico', 'Parecer', { forma: 'redigir', nivel: 'recomendado' }),
                A.texto('Fiscal ou gestor e suplente designados', { obrigatoria: true, ajuda: 'Portaria publicada antes da celebração (IN CAGE 4/2024, art. 30).' }),
                A.documento('Juntar a manifestação do órgão de assessoramento jurídico', 'Parecer jurídico', { forma: 'juntar' }),
                A.escolha('Conclusão da instrução', ['Apta para assinatura', 'Devolver para ajustes', 'Inviável'], { obrigatoria: true }),
            ],
            saidas: { 'Assinatura': quando('Conclusão da instrução', 'Apta para assinatura'), 'Habilitação e plano de trabalho': quando('Conclusão da instrução', 'Devolver para ajustes'), 'Arquivamento da proposta': quando('Conclusão da instrução', 'Inviável') },
        },
        {
            nome: 'Assinatura', unidade: 'Gabinete', vai: ['Publicação e eficácia', 'Arquivamento da proposta'], nome_publico: 'Assinatura do termo',
            orientacao: `O termo só vai à assinatura depois da manifestação jurídica e, havendo despesa, do registro do empenho no FPE (${IN4}, arts. 10 e 47). Quando não é o Governador quem assina, junta-se a delegação de competência publicada (art. 9º, III, b; Constituição do Estado, art. 82, § 1º), dispensada no termo de cooperação só entre órgãos da administração direta (art. 43, parágrafo único). Todos os partícipes assinam (art. 20, parágrafo único).`,
            acoes: [
                A.simNao('É preciso delegação de competência?', { obrigatoria: true }),
                A.documento('Juntar a delegação de competência publicada', 'Delegação', { forma: 'juntar', se: quando('É preciso delegação de competência?', 'sim') }),
                A.comunicar('Enviar o termo para a assinatura dos partícipes', { especie: 'comunicacao', polos: ['interessado'], dias: 10, texto: 'Segue o termo aprovado para assinatura. Devolva-o assinado no prazo indicado.' }),
                A.simNao('Todos os partícipes assinaram?', { obrigatoria: true }),
                A.documento('Juntar o termo assinado', 'Termo', { forma: 'juntar', se: quando('Todos os partícipes assinaram?', 'sim') }),
            ],
            saidas: { 'Publicação e eficácia': quando('Todos os partícipes assinaram?', 'sim'), 'Arquivamento da proposta': quando('Todos os partícipes assinaram?', 'nao') },
        },
        {
            nome: 'Publicação e eficácia', unidade: 'Unidade de convênios', vai: ['Instrumento celebrado'], nome_publico: 'Publicação',
            orientacao: `A súmula no Diário Oficial do Estado é condição de eficácia do convênio e sai pelo módulo do FPE, com número, partícipes, objeto, valor, vigência e classificação da despesa (${IN4}, arts. 9º, III, d, e 13). O órgão dá ciência do convênio à Assembleia Legislativa (art. 9º, III, e) e pede a conta bancária específica no Banrisul antes da liquidação (art. 8º, § 6º). A primeira parcela só sai depois da súmula (art. 15, § 2º). Nas parcerias com organização da sociedade civil, o termo só produz efeitos com o extrato publicado (${D53175}, art. 34).`,
            acoes: [
                A.fazer('Publicar a súmula ou o extrato no Diário Oficial do Estado', { obrigatoria: true }),
                A.data('Data da publicação', { obrigatoria: true, folha_dados: true }),
                A.fazer('Dar ciência do convênio à Assembleia Legislativa', { recomendada: true, ajuda: 'Só no convênio (IN CAGE 4/2024, art. 9º, III, e).' }),
                A.fazer('Pedir a abertura da conta bancária específica', { recomendada: true, ajuda: 'Só com repasse: Banrisul, pelo módulo do FPE (art. 8º, §§ 6º e 7º).' }),
                A.derivado('Abrir o acompanhamento da execução', 'Acompanhamento de convênio ou parceria no Estado do RS', { recomendada: true }),
            ],
        },
        { nome: 'Instrumento celebrado', unidade: 'Unidade de convênios', final: true, ao_entrar: { arquivar: true }, nome_publico: 'Instrumento vigente', orientacao: 'O instrumento está assinado e publicado. A execução, a fiscalização e as contas correm no processo de acompanhamento.' },
        ARQUIVADA('A proposta não seguiu: sem organização apta, plano de trabalho não aprovado, instrução inviável ou termo não assinado. Registre o motivo e, se houve registro no FPE, cancele-o.'),
    ]);
}

/** 4. Acompanhamento no Estado do RS. */
export function parceriaAcompanhamentoRs() {
    return acompanhamento({
        id: 'parceria-acompanhamento-rs', nome: 'Acompanhamento de convênio ou parceria no Estado do RS: execução, fiscalização e contas', referencia: 'Estado do RS',
        descricao: 'Acompanha o convênio, o termo de cooperação ou a parceria com organização da sociedade civil do Estado do RS depois da súmula. O fiscal registra o plano de trabalho como cronograma e, a cada período, confere os registros mensais do convenente no Sistema de Monitoramento, atesta a execução e libera a parcela seguinte. Os eventos têm fase própria: relatório anual, alteração por apostila ou aditivo pedida 60 dias antes do fim, irregularidade com suspensão do repasse e 30 dias para sanar, extinção antecipada com devolução corrigida e prestação de contas em 60 dias, analisada em até 6 meses, com parecer técnico e financeiro. Contas rejeitadas com dano abrem a tomada de contas especial em processo derivado.',
        quando: 'Um processo por instrumento, aberto logo depois da publicação da súmula. Serve aos órgãos e entidades do Estado do RS. Para parceria com organização da sociedade civil, troque os prazos de contas pelos do Decreto 53.175/2016, indicados na orientação de cada fase.',
        base: `Instrução Normativa CAGE 4/2024, arts. 14 a 16, 21 a 23, 25, 27 a 42, 48 e 51; ${D53175}, arts. 48 a 82 (confira as alterações dos Decretos 53.534/2017 e 54.973/2019); Decreto 56.939/2023 (Sistema de Monitoramento de Convênios).`,
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Órgão estadual', interessado: 'Partícipe' } },
    }, {
        gestor: 'Fiscal do instrumento', autoridade: 'Gabinete', contas: 'Unidade de prestação de contas', rotuloProcesso: 'Processo administrativo (PROA) e número no FPE', tipoFormalizacao: 'Convênio, termo de cooperação ou parceria no Estado do RS',
        instrumentos: ['Convênio', 'Termo de cooperação', 'Termo de colaboração', 'Termo de fomento', 'Acordo de cooperação', 'Convênio com a União (Estado recebe)'],
        rotuloFiscal: 'Fiscal e suplente (portaria)', ajudaFiscal: 'Troca de fiscal é registrada por apostila no FPE em até 10 dias (IN CAGE 4/2024, art. 30, § 2º).',
        ajudaPublicacao: 'Súmula no DOE, registro no FPE e, com repasse, conta específica no Banrisul.',
        inicio: `O fiscal, designado por portaria antes da celebração, registra a ciência da designação e passa a monitorar o instrumento (${IN4}, art. 30). Registre o plano de trabalho como cronograma. No convênio, ao receber a primeira parcela ou a parcela única, o convenente avisa em 30 dias o conselho local e a Câmara Municipal, com cópia do plano de trabalho (art. 36), deposita a contrapartida em até 30 dias (art. 14, § 1º) e publica o edital de licitação em 90 dias (art. 25, II, u).`,
        execucao: `O convenente registra a execução todo mês, até o dia 15, no Sistema de Monitoramento de Convênios, com dados, documentos e fotografias (${IN4}, art. 25, II, v). O fiscal confere os registros, atesta a execução e se manifesta antes de cada parcela: a segunda depende da declaração de início da execução física e, em obra, a última depende de 70% executados (arts. 15 e 16). Sem execução financeira em 180 dias da primeira parcela, o convênio é extinto (art. 27). Em obra com repasse de R$ 1 milhão ou mais, o fiscal visita o local ao final (art. 35). Na parceria com organização da sociedade civil, as parcelas seguem o cronograma de desembolso e ficam retidas enquanto houver impropriedade (${D53175}, arts. 48 e 49).`,
        acaoPeriodica: 'Conferir os registros mensais e manifestar-se sobre a próxima parcela', ajudaPeriodica: 'Requisitos de cada parcela: art. 16 da IN CAGE 4/2024.',
        relatorio: `O fiscal avalia o termo de cooperação todo ano, em relatório juntado ao processo (${IN4}, art. 48). Na parceria com organização da sociedade civil, o gestor emite o relatório técnico de monitoramento e avaliação, que a comissão de monitoramento homologa e a organização recebe para esclarecimentos (${D53175}, arts. 60 a 64).`,
        acaoRelatorio: 'Submeter o relatório à comissão de monitoramento e avaliação',
        alteracao: `A proposta de alteração chega com justificativa pelo menos 60 dias antes do fim da vigência e não muda o objeto (${IN4}, art. 21). Vão por apostila o remanejamento sem mudar o valor global, o ajuste de metas sem redução e a troca de dotação (art. 22). A prorrogação é de ofício quando o repasse atrasa, registrada no FPE sem aditivo, ou por termo aditivo, com manifestação do fiscal e as informações do art. 23. Na parceria com organização da sociedade civil, o pedido de prazo chega 30 dias antes; valores mudam por aditivo e metas, por apostila (${D53175}, arts. 54 e 55).`,
        renovacao: `Antes do fim da vigência, consulte os partícipes. A prorrogação por acordo exige termo aditivo em processo, com manifestação do fiscal, os motivos do atraso, o que já foi executado e os comprovantes do art. 23, II, da ${IN4}; o cronograma de execução é prorrogado pelo mesmo período (§ 4º). A vigência total do convênio não passa de 60 meses (art. 20, IV).`,
        ajudaRenovar: 'A prorrogação por acordo se faz por termo aditivo (IN CAGE 4/2024, art. 23, II).',
        irregularidade: `No atraso ou na inexecução, o fiscal dá ciência ao ordenador, que notifica o convenente (${IN4}, art. 31, parágrafo único). O concedente comunica a irregularidade, suspende a liberação e fixa até 30 dias para sanar ou esclarecer, prorrogáveis até o total de 90 (art. 32). Sem regularização, apura o dano e cobra o ressarcimento; não atendido, cabe tomada de contas especial (§§ 3º e 4º). Com organização da sociedade civil, cabem advertência, suspensão temporária e declaração de inidoneidade, com defesa em 10 dias e recurso em 10 dias (${D53175}, arts. 81 e 82).`,
        diasSanear: 30, ajudaSanada: 'Não sanada: apure o dano e cobre o ressarcimento (IN CAGE 4/2024, art. 32, §§ 3º e 4º).',
        extincao: `A administração extingue o convênio antes do prazo por não execução, desvio de finalidade, demora injustificada, falta de contas, falta da contrapartida ou descumprimento com prejuízo (${IN4}, art. 42), com devolução corrigida pela SELIC (§ 1º). Qualquer partícipe pode se retirar a qualquer tempo, devolvendo em até 30 dias o que não usou (§ 3º). Caso fortuito ou força maior também extinguem, com devolução dos saldos (§ 5º). Os motivos ficam no processo (§ 6º). A parceria com organização da sociedade civil pode ser rescindida a qualquer tempo, com 60 dias de publicidade da intenção (${D53175}, art. 20).`,
        ajudaExtincao: 'Na retirada, saldo e rendimentos voltam em até 30 dias (IN CAGE 4/2024, art. 42, § 3º).',
        diasContas: 60,
        prestacao: `O convenente insere os comprovantes no Sistema de Prestação de Contas em até 30 dias de cada pagamento e presta contas em até 60 dias do fim do prazo do objeto ou da extinção (${IN4}, arts. 37 a 39). O fiscal atesta a execução física, a unidade financeira emite o parecer financeiro e a unidade técnica, o parecer ou laudo de vistoria; a autoridade decide em até 6 meses (arts. 40 e 41), e a diligência dá até 30 dias, prorrogáveis uma vez. Contas rejeitadas com dano levam à tomada de contas especial (art. 51) e ao CADIN/RS. A organização da sociedade civil presta contas em até 90 dias do fim da vigência ou de cada exercício; a análise leva até 120 dias, o saneamento até 45 dias e cabe reconsideração em 10 dias (${D53175}, arts. 76, 78 e 79).`,
        ajudaDiligencia: 'Diligência: até 30 dias, prorrogável uma vez (IN CAGE 4/2024, art. 41, § 5º).', ajudaAnalise: 'Decisão em até 6 meses do recebimento (IN CAGE 4/2024, art. 40, § 2º).',
        encerramento: 'Concluído o objeto e decididas as contas, registre o resultado, o destino dos bens, os valores devolvidos (que o órgão divulga no seu sítio) e encerre o registro no FPE. Os documentos ficam à disposição do controle interno e externo por 5 anos.',
        acaoFinal: 'Encerrar o registro no sistema FPE',
    });
}

/* ------------------------------------------------------------------ União */

const D11531 = 'Decreto 11.531/2023';
const P3506 = 'Portaria SEGES/MGI 3.506/2025';
const D10426 = 'Decreto 10.426/2020';
const INSTRUMENTOS_UNIAO = ['Convênio ou contrato de repasse (com transferência de recursos)', 'Acordo de cooperação técnica (sem recursos)', 'Acordo de adesão (condições já fixadas pelo órgão federal)', 'Termo de execução descentralizada (entre órgãos federais)', 'Acordo de cooperação com organização da sociedade civil (sem recursos)'];

/** 5. Formalização na União. */
export function parceriaFormalizacaoFederal() {
    return montar({
        id: 'parceria-formalizacao-federal', nome: 'Convênio, acordo de cooperação técnica ou descentralização na União: da demanda à publicação', area: 'parcerias', porte: 'longo', referencia: 'Governo federal',
        descricao: 'Formaliza os instrumentos de cooperação dos órgãos e entidades federais. O convênio e o contrato de repasse seguem o Decreto 11.531/2023: programa e proposta no Transferegov.br, plano de trabalho, análise técnica, contrapartida, empenho, parecer jurídico e os documentos que podem ficar em condição suspensiva. O acordo de cooperação técnica e o acordo de adesão, sem recursos, seguem a Portaria SEGES/MGI 3.506/2025: plano de trabalho, representação, CNPJ, análise técnica e jurídica (dispensável com minuta padrão) e extrato no Diário Oficial em 20 dias. O termo de execução descentralizada, entre órgãos federais, segue o Decreto 10.426/2020: plano de trabalho, declarações de capacidade técnica e de compatibilidade de custos e extrato em 20 dias. O rito começa na demanda, com o problema, a solução e o estudo técnico, e pergunta o instrumento para mostrar só o que vale para ele.',
        quando: 'Órgãos e entidades federais, e também quem celebra com eles e quer instruir o seu lado. Para termo de colaboração ou de fomento com organização da sociedade civil, use o rito "Parceria com organização da sociedade civil", que traz o chamamento e a prestação de contas da Lei 13.019.',
        base: `${D11531}, arts. 1º a 17 e 24 a 26 (com os Decretos 11.845/2023, 12.025/2024 e 12.470/2025); ${P3506}, arts. 1º a 27 (revogou a Portaria 1.605/2024); ${D10426}, arts. 2º a 17 (com o Decreto 12.841/2026); Lei 14.133/2021, arts. 184 e 184-A; Lei 13.019/2014 e Decreto 8.726/2016. Regras complementares dos convênios: Portaria Conjunta MGI/MF/CGU 33/2023 (confira o texto vigente).`,
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Órgão federal', interessado: 'Partícipe' } },
    }, [
        {
            nome: 'Demanda e enquadramento', unidade: 'Unidade demandante', vai: ['Proposta e plano de trabalho', 'Arquivamento da proposta'], nome_publico: 'Proposta em elaboração',
            orientacao: `Registre a demanda, converse com os partícipes e descreva o problema e a solução. Escolha o instrumento. Convênio e contrato de repasse transferem recursos da União a Estado, Município, consórcio público, serviço social autônomo ou entidade sem fins lucrativos nos casos admitidos, com repasse mínimo de R$ 400 mil em obras e R$ 200 mil nos demais objetos (${D11531}, arts. 2º, 5º e 10). O acordo de cooperação técnica é gratuito, sem repasse nem doação de bens, com objeto ajustado de comum acordo; o acordo de adesão tem as condições fixadas antes pelo órgão federal (arts. 24 e 25). Entre órgãos federais com descentralização de crédito, o instrumento é o termo de execução descentralizada (${D10426}, art. 2º, I). Com organização da sociedade civil e sem recursos, é o acordo de cooperação da Lei 13.019 (${P3506}, art. 4º, § 2º).`,
            acoes: [
                A.formulario('Registrar os dados da demanda', [
                    { id: 'processo', rotulo: 'Processo (SEI)', tipo: 'texto', obrigatorio: true },
                    { id: 'participes', rotulo: 'Partícipes (nome e CNPJ)', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'objeto', rotulo: 'Objeto', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'programa', rotulo: 'Programa ou política pública', tipo: 'texto' },
                    { id: 'valor', rotulo: 'Valor do repasse ou do crédito (R$)', tipo: 'numero' },
                    { id: 'vigencia', rotulo: 'Vigência prevista (meses)', tipo: 'numero', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                PROBLEMA(),
                SOLUCAO(),
                A.documento('Juntar o estudo técnico', 'Estudo técnico', { nivel: 'recomendado', ajuda: 'Alternativas avaliadas, riscos, custos e a capacidade de quem vai executar.' }),
                A.escolha('Instrumento', INSTRUMENTOS_UNIAO, { obrigatoria: true, folha_dados: true }),
                A.simNao('Há vedação à celebração?', { obrigatoria: true, ajuda: 'Convênio: art. 5º do Decreto 11.531 (valor mínimo, fim de mandato, entidade com pendência ou dirigente agente político).' }),
                A.fazer('Registrar os contatos e as reuniões com os partícipes', { recomendada: true }),
                A.audiencia('Reunião de alinhamento com os partícipes', 'reuniao'),
            ],
            saidas: { 'Proposta e plano de trabalho': quando('Há vedação à celebração?', 'nao'), 'Arquivamento da proposta': quando('Há vedação à celebração?', 'sim') },
        },
        {
            nome: 'Proposta e plano de trabalho', unidade: 'Unidade demandante', vai: ['Análise técnica e jurídica'], nome_publico: 'Plano de trabalho',
            orientacao: `No convênio, o programa é cadastrado no Transferegov.br e o proponente envia a proposta (objeto, justificativa, estimativa de recursos e prazo) e o plano de trabalho, com justificativa, descrição completa do objeto, metas e etapas, compatibilidade de custos, cronograma físico-financeiro e plano de aplicação (${D11531}, arts. 6º e 7º). No acordo de cooperação técnica, o plano traz ao menos objeto, justificativa e cronograma físico com responsáveis e prazos, e pode ser assinado antes ou junto com o acordo (${P3506}, art. 7º). No termo de execução descentralizada, o plano traz objeto, justificativa, cronograma físico, cronograma de desembolso e plano de aplicação, com custos indiretos de até 20% do valor (${D10426}, art. 8º). No acordo de adesão, a iniciativa é de quem adere, e as condições já estão dadas (${P3506}, arts. 12 e 13).`,
            acoes: [
                A.fazer('Cadastrar o programa e receber a proposta no Transferegov.br', { recomendada: true, ajuda: 'Só no convênio e no contrato de repasse (Decreto 11.531, arts. 6º e 7º).' }),
                A.documento('Juntar o plano de trabalho', 'Plano de trabalho', { ajuda: 'O conteúdo mínimo muda com o instrumento: veja a orientação da fase.' }),
                A.documento('Juntar o termo de referência, o anteprojeto ou o projeto básico', 'Termo de referência', { forma: 'juntar', nivel: 'opcional', ajuda: 'Convênio: pode ficar em condição suspensiva, antes da primeira parcela (art. 13, § 1º).' }),
                A.documento('Juntar as declarações de capacidade técnica e de compatibilidade de custos', 'Declaração', { forma: 'juntar', nivel: 'opcional', ajuda: 'Só no termo de execução descentralizada (Decreto 10.426, arts. 7º e 11).' }),
                A.fazer('Conferir a representação legal e o CNPJ dos partícipes', { obrigatoria: true }),
                A.documento('Redigir a minuta do instrumento', 'Minuta', { forma: 'redigir', ajuda: 'Use a minuta padronizada da AGU quando houver: ela permite dispensar a análise jurídica no acordo e no TED.' }),
            ],
        },
        {
            nome: 'Análise técnica e jurídica', unidade: 'Unidade de convênios', vai: ['Celebração', 'Proposta e plano de trabalho', 'Arquivamento da proposta'], nome_publico: 'Proposta em análise',
            orientacao: `No convênio, o concedente ou a mandatária analisa a viabilidade e a adequação ao programa e, com entidade privada, a capacidade técnica; são condições a aprovação do plano de trabalho, a comprovação da contrapartida, o empenho e o parecer jurídico favorável (${D11531}, arts. 7º, 9º e 12). No acordo de cooperação técnica, os setores técnico e jurídico de cada partícipe se manifestam de forma conclusiva; a análise jurídica pode ser dispensada com a minuta padronizada (${P3506}, art. 6º). No termo de execução descentralizada, exigem-se motivação, plano aprovado, classificação orçamentária e as duas declarações; a análise jurídica também é dispensável com o modelo padrão (${D10426}, arts. 11 e 12).`,
            acoes: [
                A.documento('Juntar a análise técnica do plano de trabalho', 'Parecer', { forma: 'redigir' }),
                A.simNao('O instrumento usa a minuta padronizada sem mudanças?', { obrigatoria: true, ajuda: 'Com a minuta padrão, o acordo e o TED podem dispensar a análise jurídica. O convênio sempre a exige.' }),
                A.documento('Juntar o parecer jurídico', 'Parecer jurídico', { forma: 'juntar', nivel: 'recomendado' }),
                A.fazer('Comprovar a contrapartida e o empenho', { recomendada: true, ajuda: 'Só no convênio (Decreto 11.531, arts. 8º, 9º e 12).' }),
                A.escolha('Conclusão da análise', ['Apta para celebração', 'Devolver para ajustes', 'Inviável'], { obrigatoria: true }),
            ],
            saidas: { 'Celebração': quando('Conclusão da análise', 'Apta para celebração'), 'Proposta e plano de trabalho': quando('Conclusão da análise', 'Devolver para ajustes'), 'Arquivamento da proposta': quando('Conclusão da análise', 'Inviável') },
        },
        {
            nome: 'Celebração', unidade: 'Gabinete', vai: ['Publicação e providências iniciais', 'Arquivamento da proposta'], nome_publico: 'Assinatura do instrumento',
            orientacao: `O convênio é assinado pelo concedente e pelo convenente; o contrato de repasse, pela mandatária e pelo convenente (${D11531}, art. 11). O acordo de cooperação técnica é assinado eletronicamente pelos partícipes, comprovada a legitimidade de quem assina, e o acordo de adesão só por quem adere (${P3506}, arts. 9º e 17). O termo de execução descentralizada é assinado pelo Ministro ou pelo dirigente máximo da entidade (${D10426}, art. 13).`,
            acoes: [
                A.comunicar('Enviar o instrumento para a assinatura dos partícipes', { especie: 'comunicacao', polos: ['interessado'], dias: 10, texto: 'Segue o instrumento aprovado para assinatura eletrônica. Assine no prazo indicado.' }),
                A.simNao('Todos os partícipes assinaram?', { obrigatoria: true }),
                A.documento('Juntar o instrumento assinado', 'Termo', { forma: 'juntar', se: quando('Todos os partícipes assinaram?', 'sim') }),
                A.data('Data da assinatura', { obrigatoria: true, folha_dados: true, se: quando('Todos os partícipes assinaram?', 'sim') }),
            ],
            saidas: { 'Publicação e providências iniciais': quando('Todos os partícipes assinaram?', 'sim'), 'Arquivamento da proposta': quando('Todos os partícipes assinaram?', 'nao') },
        },
        {
            nome: 'Publicação e providências iniciais', unidade: 'Unidade de convênios', prazo_dias: 20, prazo_auto: true, prazo_contagem: corridos, vai: ['Instrumento celebrado'], nome_publico: 'Publicação',
            orientacao: `A eficácia do acordo de cooperação técnica depende do extrato no Diário Oficial da União em até 20 dias da assinatura, com o inteiro teor nos sítios dos partícipes no mesmo prazo (${P3506}, art. 10); os responsáveis pelo acompanhamento, titular e suplente, são indicados em até 30 dias (art. 11). No termo de execução descentralizada, o extrato sai em 20 dias, com a íntegra e o plano de trabalho nos sítios das duas unidades (${D10426}, art. 14), e os gestores titulares e suplentes são designados em 20 dias (art. 17). No convênio, os atos são registrados no Transferegov.br; os documentos em condição suspensiva chegam antes da primeira parcela, e o convênio é extinto se a condição não for cumprida no prazo (${D11531}, arts. 13 e 19, III).`,
            acoes: [
                A.fazer('Publicar o extrato no Diário Oficial da União', { obrigatoria: true }),
                A.fazer('Divulgar o inteiro teor nos sítios oficiais', { obrigatoria: true }),
                A.texto('Responsáveis pelo acompanhamento (titular e suplente)', { obrigatoria: true, ajuda: 'Acordo: até 30 dias da assinatura. TED: até 20 dias da celebração.' }),
                A.simNao('Ficou documento em condição suspensiva?', { obrigatoria: true, ajuda: 'Só no convênio. Registre o prazo no acompanhamento: sem cumprir, o convênio é extinto.' }),
                A.derivado('Abrir o acompanhamento da execução', 'Acompanhamento de convênio, acordo ou descentralização na União', { recomendada: true }),
            ],
        },
        { nome: 'Instrumento celebrado', unidade: 'Unidade de convênios', final: true, ao_entrar: { arquivar: true }, nome_publico: 'Instrumento vigente', orientacao: 'O instrumento está assinado e publicado. A execução, o acompanhamento e as contas correm no processo de acompanhamento.' },
        ARQUIVADA('A proposta não seguiu: há vedação, a análise concluiu pela inviabilidade ou o instrumento não foi assinado. Registre o motivo.'),
    ]);
}

/** 6. Acompanhamento na União. */
export function parceriaAcompanhamentoFederal() {
    return acompanhamento({
        id: 'parceria-acompanhamento-federal', nome: 'Acompanhamento de convênio, acordo ou descentralização na União: execução, fiscalização e contas', referencia: 'Governo federal',
        descricao: 'Acompanha o convênio, o contrato de repasse, o acordo de cooperação técnica ou o termo de execução descentralizada depois da publicação. O responsável registra o plano de trabalho como cronograma e, a cada período, anota a execução. Os eventos têm fase própria: relatório anual ou parcial, alteração por apostila ou aditivo, renovação, irregularidade com prazo para justificar, denúncia ou rescisão e prestação de contas. No convênio, os saldos voltam em 30 dias, as contas chegam em 60 e a análise leva 60 ou 180 dias; no termo de execução descentralizada, o relatório de cumprimento do objeto chega em 120 dias e é analisado em 180. Contas rejeitadas com dano abrem a tomada de contas especial em processo derivado.',
        quando: 'Um processo por instrumento, aberto logo depois da publicação. Serve aos órgãos e entidades federais e a quem executa instrumento firmado com eles e quer controlar o seu lado. O registro oficial continua no Transferegov.br: aqui ficam os atos internos, os prazos e os documentos.',
        base: `${D11531}, arts. 13 a 23; ${P3506}, arts. 7º, 8º, 11 e 18; ${D10426}, arts. 6º, 7º, 10 e 15 a 24; Lei 14.133/2021, art. 184. Regras complementares dos convênios: Portaria Conjunta MGI/MF/CGU 33/2023 (confira o texto vigente).`,
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Órgão federal', interessado: 'Partícipe' } },
    }, {
        gestor: 'Gestor do instrumento', autoridade: 'Gabinete', contas: 'Unidade de prestação de contas', rotuloProcesso: 'Processo (SEI) e número no Transferegov.br', tipoFormalizacao: 'Convênio, acordo de cooperação técnica ou descentralização na União',
        instrumentos: ['Convênio', 'Contrato de repasse', 'Acordo de cooperação técnica', 'Acordo de adesão', 'Termo de execução descentralizada', 'Acordo de cooperação com organização da sociedade civil'],
        rotuloFiscal: 'Responsável pelo acompanhamento e suplente', ajudaFiscal: 'Acordo: indicados em até 30 dias da assinatura. TED: gestores designados em até 20 dias.',
        ajudaPublicacao: 'Extrato no DOU, inteiro teor nos sítios oficiais e registro no Transferegov.br.',
        inicio: `Os partícipes indicam quem acompanha a execução, titular e suplente (${P3506}, art. 11; ${D10426}, art. 17). Registre o plano de trabalho como cronograma. No convênio, o empenho segue o cronograma de cada exercício, as transferências passam por conta específica em instituição financeira oficial e os atos são registrados no Transferegov.br (${D11531}, arts. 8º, 17 e 18). Se ficou documento em condição suspensiva, ponha o prazo no cronograma: nenhuma parcela sai antes, e o convênio é extinto se a condição não for cumprida (arts. 13, § 5º, e 19, III).`,
        execucao: `Convenentes, concedentes e a mandatária registram no Transferegov.br a execução física, o acompanhamento e a fiscalização (${D11531}, art. 18). No termo de execução descentralizada, a unidade descentralizadora pode pedir relatório parcial a qualquer tempo, e a descentralizada executa os créditos e zela pela aplicação regular (${D10426}, arts. 6º, 7º e 18). No acordo de cooperação técnica não há repasse: cada partícipe arca com as suas despesas, e o acompanhamento confere as ações e os prazos do plano de trabalho (${P3506}, art. 8º).`,
        acaoPeriodica: 'Conferir os registros no Transferegov.br e a liberação da próxima parcela', ajudaPeriodica: 'Só no convênio, no contrato de repasse e no TED.',
        relatorio: `Use esta fase para a avaliação anual do instrumento e para o relatório parcial que a unidade descentralizadora pedir no termo de execução descentralizada (${D10426}, art. 18). Compare as metas do plano de trabalho com o que foi entregue e recomende as providências.`,
        acaoRelatorio: 'Enviar o relatório ao outro partícipe',
        alteracao: `No convênio, a alteração é proposta por qualquer das partes pelo menos 60 dias antes do fim da vigência, admitido prazo menor com motivo e em benefício do objeto (${D11531}, art. 15). No acordo de cooperação técnica, o ajuste do plano que não muda cláusula vai por apostila; o resto, por termo aditivo, sem descaracterizar o objeto (${P3506}, arts. 7º, § 2º, e 8º, § 3º). No termo de execução descentralizada, a proposta é formal e justificada, o objeto não muda e a alteração do plano sem mudar valor nem vigência vai por apostila (${D10426}, art. 15).`,
        renovacao: `Antes do fim da vigência, consulte os partícipes. O termo de execução descentralizada não passa de 60 meses com as prorrogações, salvo até 12 meses a mais nos casos do art. 10, § 1º, e é prorrogado de ofício quando a liberação atrasa (${D10426}, art. 10). No convênio, o pedido chega 60 dias antes (${D11531}, art. 15). O acordo de cooperação técnica é prorrogado por termo aditivo (${P3506}, art. 8º, § 2º, VIII).`,
        ajudaRenovar: 'A prorrogação se faz por termo aditivo, assinado antes do fim da vigência.',
        irregularidade: `No termo de execução descentralizada, havendo indício de irregularidade, a descentralizadora suspende as descentralizações e fixa 30 dias para as justificativas, prorrogáveis uma vez (${D10426}, art. 19). No convênio, a impropriedade apontada na análise dá 45 dias para saneamento (${D11531}, art. 21, § 3º). No acordo de cooperação técnica, o descumprimento autoriza a rescisão com aviso de 30 dias (${P3506}, art. 18, IV).`,
        diasSanear: 30, ajudaSanada: 'Não sanada: avalie a rescisão e, havendo dano, a tomada de contas especial.',
        extincao: `O convênio pode ser denunciado a qualquer tempo por desistência, rescindido por inadimplemento, por informação falsa ou por fato que leve à tomada de contas especial, e é extinto se a condição suspensiva não for cumprida; o convenente devolve os saldos em 30 dias e presta contas em 60, contados da publicação do ato (${D11531}, art. 19). O acordo de cooperação técnica se encerra por consenso, por denúncia ou por rescisão justificada, sempre com aviso de 30 dias (${P3506}, art. 18). O termo de execução descentralizada pode ser denunciado a qualquer tempo, e os recursos não executados voltam em 30 dias (${D10426}, arts. 20 a 22).`,
        ajudaExtincao: 'Convênio e TED: saldo em 30 dias. Acordo de cooperação técnica: aviso de 30 dias.',
        diasContas: 60,
        prestacao: `No convênio, a prestação de contas começa com a primeira parcela; os saldos voltam em 30 dias e as contas finais chegam em 60 dias do fim da vigência ou da conclusão do objeto. Sem contas, o concedente notifica e dá até 45 dias (${D11531}, art. 20). A análise leva 60 dias no procedimento informatizado ou 180 na convencional, prorrogáveis uma vez, com 45 dias para sanear (art. 21). A tomada de contas especial vem depois de esgotadas as medidas administrativas (art. 22). No termo de execução descentralizada, o relatório de cumprimento do objeto chega em 120 dias e é analisado em 180; sem ele, a descentralizadora dá 30 dias e pede a tomada de contas (${D10426}, arts. 23 e 24): ajuste o prazo desta fase para 120 dias. No acordo de cooperação técnica não há contas financeiras.`,
        ajudaDiligencia: 'Convênio: até 45 dias para sanear impropriedades (Decreto 11.531, art. 21, § 3º).', ajudaAnalise: 'Convênio: 60 dias (informatizada) ou 180 (convencional). TED: 180 dias do relatório.',
        encerramento: 'Concluído o objeto e decididas as contas, registre o resultado, o destino dos bens remanescentes (em regra do convenente, salvo disposição contrária) e encerre o registro no Transferegov.br.',
        acaoFinal: 'Encerrar o registro no Transferegov.br',
    });
}

export const modelos = [parceriaFormalizacaoMprs, parceriaAcompanhamentoMprs, parceriaFormalizacaoRs, parceriaAcompanhamentoRs, parceriaFormalizacaoFederal, parceriaAcompanhamentoFederal];
