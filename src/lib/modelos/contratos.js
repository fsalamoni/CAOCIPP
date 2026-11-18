// Modelos da área contratos (execução). Ver a forma de escrever em ./dsl.js e o exemplo em ./geral.js.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';

/** 10. Gestão e fiscalização de contrato de serviço continuado (Lei 14.133/2021). */
export function gestaoContrato() {
    return montar({
        id: 'gestao-contrato', nome: 'Gestão e fiscalização de contrato de serviço continuado', area: 'contratacoes', porte: 'longo', referencia: 'Lei 14.133',
        descricao: 'Acompanha a execução de um contrato de serviço que se repete mês a mês (limpeza, vigilância, manutenção, suporte de TI), da designação do gestor e dos fiscais até o termo de recebimento definitivo e o encerramento. O processo é cíclico: a cada período os fiscais medem e recebem provisoriamente, o gestor atesta e o setor financeiro paga, e o ciclo volta para a medição seguinte. Repactuação, reajuste, prorrogação, alteração e reequilíbrio são tratados como eventos que saem do ciclo e voltam a ele; o descumprimento que persiste é remetido a processo próprio de apuração. A contratada é notificada para corrigir falhas, pode contestar glosas, é ouvida antes de qualquer alteração e tem defesa e recurso antes da extinção unilateral.',
        quando: 'Contratos de serviço contínuo, com ou sem dedicação exclusiva de mão de obra, durante toda a vigência. Abra um processo por contrato. No Ministério Público do RS, prefira "Gestão de contrato no MPRS".',
        base: 'Lei 14.133/2021, arts. 92, §§ 4º e 6º, 94, 106, 107, 117, 123 a 125, 135, 136, 137 a 141 e 165; Decreto 11.246/2022, arts. 8º e 21 a 25; IN SEGES 5/2017, arts. 39 a 50 e 54 a 57; IN SEGES 77/2022, arts. 7º e 8º.',
        tipo: { polos: ['requerente', 'requerido'], nomes_polos: { requerente: 'Contratante', requerido: 'Contratada' } },
    }, [
        {
            nome: 'Designação de gestor e fiscais', unidade: 'Gabinete', vai: ['Reunião inicial'],
            orientacao: 'Designe gestor, fiscal técnico, fiscal administrativo e, se for o caso, fiscal setorial, com substitutos. Dê ciência prévia e formal aos indicados e considere a compatibilidade com o cargo, a complexidade do objeto e a quantidade de contratos por agente (Decreto 11.246/2022, art. 8º; IN 5/2017, arts. 41 e 42).',
            acoes: [
                A.formulario('Registrar os dados do contrato', [
                    { id: 'numero', rotulo: 'Número do contrato', tipo: 'texto', obrigatorio: true },
                    { id: 'objeto', rotulo: 'Objeto', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'inicio', rotulo: 'Início da vigência', tipo: 'data', obrigatorio: true },
                    { id: 'fim', rotulo: 'Fim da vigência', tipo: 'data', obrigatorio: true },
                    { id: 'valor_mensal', rotulo: 'Valor mensal estimado (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'mao_obra', rotulo: 'Dedicação exclusiva de mão de obra?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'garantia', rotulo: 'Há garantia contratual?', tipo: 'sim_nao' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.fazer('Dar ciência prévia e formal aos indicados', { obrigatoria: true }),
                A.documento('Juntar a portaria de designação, com substitutos', 'Portaria', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Reunião inicial', unidade: 'Gestão do contrato', vai: ['Medição do período'],
            orientacao: 'Antes do início dos serviços, a contratada indica formalmente o preposto (IN 5/2017, art. 44). Faça a reunião inicial com gestor, fiscais e preposto, apresente o plano de fiscalização e registre tudo em ata (art. 45). Comunicações por escrito; mensagem eletrônica é admitida (art. 44, § 2º).',
            acoes: [
                A.documento('Juntar a indicação formal do preposto', 'Ofício', { forma: 'juntar' }),
                A.audiencia('Designar a reunião inicial', 'reuniao', { obrigatoria: true }),
                A.comunicar('Convocar a contratada para a reunião inicial', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Compareça, com o preposto, à reunião inicial do contrato em {audiencia}.' }, { obrigatoria: true }),
                A.documento('Juntar o plano de fiscalização', 'Plano de fiscalização', { forma: 'qualquer', nivel: 'recomendado' }),
                A.documento('Juntar a ata da reunião inicial', 'Ata', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Medição do período', unidade: 'Fiscalização do contrato', nome_publico: 'Fiscalização do período',
            vai: ['Ateste do período', 'Notificação para correção', 'Evento contratual', 'Extinção unilateral'],
            condicoes: { 'Evento contratual': 'Pedido de repactuação, reajuste, prorrogação, alteração ou reequilíbrio que não pode esperar o pagamento.', 'Extinção unilateral': 'Falta grave que justifica extinguir o contrato desde já.' },
            orientacao: 'Anote as ocorrências em registro próprio e determine a regularização (Lei 14.133, art. 117, § 1º). Nos contratos com dedicação exclusiva de mão de obra, confira as obrigações trabalhistas, previdenciárias e fiscais (IN 5/2017, art. 40, III). Emita o relatório circunstanciado e o termo de recebimento provisório (art. 50, I; Decreto 11.246, art. 25). O que passar da sua competência, leve ao gestor (art. 117, § 2º).',
            acoes: [
                A.formulario('Registrar a medição do período', [
                    { id: 'periodo', rotulo: 'Período de referência (mês/ano)', tipo: 'texto', obrigatorio: true },
                    { id: 'valor_previsto', rotulo: 'Valor previsto no período (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'valor_medido', rotulo: 'Valor medido (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'glosa', rotulo: 'Glosa proposta (R$)', tipo: 'numero' },
                    { id: 'motivo_glosa', rotulo: 'Motivo da glosa', tipo: 'texto_longo' },
                    { id: 'ocorrencias', rotulo: 'Ocorrências registradas no período', tipo: 'numero' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.fazer('Anotar as ocorrências no registro próprio', { obrigatoria: true }),
                A.simNao('Contrato com dedicação exclusiva de mão de obra?', { obrigatoria: true }),
                A.documento('Juntar a conferência das obrigações trabalhistas, previdenciárias e fiscais', 'Relatório', { forma: 'juntar', se: quando('Contrato com dedicação exclusiva de mão de obra?', 'sim') }),
                A.escolha('Execução do período', ['Conforme', 'Conforme com glosa', 'Não conforme'], { obrigatoria: true, ajuda: 'Conforme: ateste integral. Com glosa: desconto proporcional. Não conforme: falha que impede o recebimento e exige correção.' }),
                A.documento('Juntar o relatório circunstanciado de fiscalização', 'Relatório', { forma: 'redigir' }),
                A.documento('Juntar o termo de recebimento provisório', 'Termo de recebimento', { forma: 'redigir', se: quando('Execução do período', 'Conforme', 'Conforme com glosa') }),
                A.simNao('Há situação além da competência do fiscal?', { ajuda: 'Se sim, leve ao gestor e, se preciso, à autoridade, para as medidas cabíveis (Lei 14.133, art. 117, § 2º).' }),
            ],
            saidas: { 'Ateste do período': quando('Execução do período', 'Conforme', 'Conforme com glosa'), 'Notificação para correção': quando('Execução do período', 'Não conforme') },
        },
        {
            nome: 'Notificação para correção', unidade: 'Fiscalização do contrato', avanco: 'auto', nome_publico: 'Correção da execução',
            vai: ['Medição do período', 'Remessa para apuração de infração'], ao_entrar: { pendencia: 'Contratada notificada para corrigir a execução do contrato.' },
            orientacao: 'Notifique a contratada por escrito, indicando as cláusulas descumpridas e o prazo para regularizar (Decreto 11.246, art. 22, III; IN 5/2017, art. 50, II). Corrigida a falha, volta para nova medição; se persistir, o caso vai a processo próprio de apuração e sanção.',
            acoes: [
                A.comunicar('Notificar a contratada para corrigir', { especie: 'notificacao', polos: ['requerido'], dias: 5, texto: 'Fica notificada a corrigir as falhas na execução do contrato, descritas a seguir, ou a se manifestar no prazo indicado.' }, { obrigatoria: true, ajuda: 'O prazo de correção não é fixado em lei: ajuste ao contrato ou à gravidade da falha.' }),
                A.esperar('Aguardar a correção ou a manifestação', 'Notificar a contratada para corrigir', { obrigatoria: true }),
                A.simNao('A contratada corrigiu a falha?', { obrigatoria: true }),
            ],
            saidas: { 'Medição do período': quando('A contratada corrigiu a falha?', 'sim'), 'Remessa para apuração de infração': quando('A contratada corrigiu a falha?', 'nao') },
        },
        {
            nome: 'Remessa para apuração de infração', unidade: 'Gestão do contrato', avanco: 'auto', vai: ['Ateste do período'],
            orientacao: 'A sanção não se aplica neste processo: abra processo próprio de apuração de infração contratual, com defesa da contratada, e anote o número aqui. Depois, o período segue para ateste com as glosas cabíveis.',
            acoes: [
                A.documento('Juntar o relatório do descumprimento', 'Relatório', { forma: 'redigir' }),
                A.fazer('Abrir o processo próprio de apuração e sanção', { obrigatoria: true }),
                A.texto('Número do processo de apuração', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Ateste do período', unidade: 'Gestão do contrato', vai: ['Pagamento do período', 'Notificação para correção'],
            orientacao: 'Analise os relatórios dos fiscais. Havendo irregularidade que impeça a liquidação, indique as cláusulas e peça a correção por escrito. Estando em ordem, emita o termo de recebimento definitivo do período e autorize a nota fiscal no valor dimensionado, já com as glosas (IN 5/2017, art. 50, II). A contratada pode contestar a glosa; decida em até 1 mês (Lei 14.133, art. 123).',
            acoes: [
                A.fazer('Analisar os relatórios dos fiscais', { obrigatoria: true }),
                A.escolha('Resultado do ateste', ['Ateste integral', 'Ateste com glosa', 'Não atestar'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o termo de recebimento definitivo do período', 'Termo de recebimento', { forma: 'redigir', se: quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa') }),
                A.comunicar('Notificar a contratada do valor a faturar e das glosas', { especie: 'notificacao', polos: ['requerido'], dias: 5, texto: 'Emita a nota fiscal no valor indicado, já descontadas as glosas. Querendo, conteste a glosa no prazo.' }, { se: quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa'), ajuda: 'Prazo para emitir a nota ou contestar: ajuste ao contrato.' }),
                A.esperar('Aguardar a nota fiscal ou a contestação', 'Notificar a contratada do valor a faturar e das glosas', { se: quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa') }),
                A.simNao('A contratada contestou a glosa?', { se: quando('Aguardar a nota fiscal ou a contestação', 'Apresentada', 'Parcial') }),
                A.textoLongo('Decisão fundamentada sobre a contestação', { se: quando('A contratada contestou a glosa?', 'sim') }),
            ],
            saidas: { 'Pagamento do período': quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa'), 'Notificação para correção': quando('Resultado do ateste', 'Não atestar') },
        },
        {
            nome: 'Pagamento do período', unidade: 'Setor financeiro', prazo_dias: 20, prazo_auto: true,
            vai: ['Medição do período', 'Evento contratual', 'Recebimento definitivo e encerramento', 'Extinção unilateral'],
            orientacao: 'Liquide em até 10 dias úteis do recebimento da nota fiscal e pague em até 10 dias úteis da liquidação, pela metade nas despesas de pequeno valor (IN 77/2022, art. 7º). Apure origem, valor exato e credor (Lei 4.320, art. 63) e confira a manutenção das condições de habilitação; a perda da regularidade fiscal leva à notificação, mas não autoriza, por si só, reter o pagamento (IN 77/2022, art. 8º). Respeite a ordem cronológica (Lei 14.133, art. 141). Ao fim, diga por onde o contrato segue.',
            acoes: [
                A.documento('Juntar a nota fiscal', 'Nota fiscal', { forma: 'juntar' }),
                A.fazer('Liquidar a despesa: origem, valor exato e credor', { obrigatoria: true }),
                A.simNao('Habilitação e regularidade fiscal mantidas?', { obrigatoria: true }),
                A.comunicar('Notificar a contratada para regularizar a situação fiscal', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Regularize sua situação fiscal, condição de habilitação a ser mantida durante todo o contrato.' }, { se: quando('Habilitação e regularidade fiscal mantidas?', 'nao') }),
                A.documento('Juntar o comprovante de pagamento', 'Comprovante de pagamento', { forma: 'juntar' }),
                A.escolha('Como o contrato segue', ['Próximo período', 'Evento contratual', 'Fim da vigência ou extinção consensual', 'Extinção unilateral'], { obrigatoria: true }),
            ],
            saidas: {
                'Medição do período': quando('Como o contrato segue', 'Próximo período'),
                'Evento contratual': quando('Como o contrato segue', 'Evento contratual'),
                'Recebimento definitivo e encerramento': quando('Como o contrato segue', 'Fim da vigência ou extinção consensual'),
                'Extinção unilateral': quando('Como o contrato segue', 'Extinção unilateral'),
            },
        },
        {
            nome: 'Evento contratual', unidade: 'Gestão do contrato', avanco: 'auto',
            vai: ['Repactuação ou reajuste', 'Prorrogação de vigência', 'Alteração ou reequilíbrio'],
            orientacao: 'Indique o evento a tratar. Repactuação e reajuste se formalizam por apostila; prorrogação, alteração e reequilíbrio, por termo aditivo com parecer jurídico. Na prorrogação, abra o evento com antecedência suficiente antes do fim da vigência (a lei não fixa; cada órgão define).',
            acoes: [
                A.escolha('Evento', ['Repactuação', 'Reajuste por índice', 'Prorrogação de vigência', 'Alteração do contrato', 'Reequilíbrio econômico-financeiro'], { obrigatoria: true }),
                A.documento('Juntar o pedido ou a justificativa do evento', '', { forma: 'qualquer', nivel: 'recomendado' }),
            ],
            saidas: {
                'Repactuação ou reajuste': quando('Evento', 'Repactuação', 'Reajuste por índice'),
                'Prorrogação de vigência': quando('Evento', 'Prorrogação de vigência'),
                'Alteração ou reequilíbrio': quando('Evento', 'Alteração do contrato', 'Reequilíbrio econômico-financeiro'),
            },
        },
        {
            nome: 'Repactuação ou reajuste', unidade: 'Setor de contratos', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Medição do período'],
            orientacao: 'Exige interregno mínimo de 1 ano, contado da proposta ou, na mão de obra, do acordo ou convenção coletiva (Lei 14.133, arts. 92, § 4º, e 135, § 3º; IN 5/2017, arts. 54 e 55). Na repactuação, a contratada apresenta planilha de custos e o instrumento coletivo (IN 5/2017, art. 57). Responda preferencialmente em 1 mês da entrega da documentação (art. 92, § 6º). Formalize por apostila (art. 136, I), salvo se coincidir com prorrogação (IN 5/2017, art. 57, § 4º).',
            acoes: [
                A.escolha('Espécie', ['Repactuação', 'Reajuste por índice'], { obrigatoria: true }),
                A.simNao('Cumprido o interregno mínimo de 1 ano?', { obrigatoria: true, ajuda: 'Se não, indefira e comunique a contratada.' }),
                A.documento('Juntar o pedido com a planilha de custos e o instrumento coletivo', 'Requerimento', { forma: 'juntar', se: quando('Espécie', 'Repactuação') }),
                A.formulario('Registrar o cálculo', [
                    { id: 'data_base', rotulo: 'Data-base do interregno', tipo: 'data', obrigatorio: true },
                    { id: 'indice', rotulo: 'Índice ou instrumento coletivo', tipo: 'texto', obrigatorio: true },
                    { id: 'percentual', rotulo: 'Variação (%)', tipo: 'numero' },
                    { id: 'valor_anterior', rotulo: 'Valor mensal anterior (R$)', tipo: 'numero' },
                    { id: 'valor_novo', rotulo: 'Valor mensal novo (R$)', tipo: 'numero' },
                ], { se: quando('Cumprido o interregno mínimo de 1 ano?', 'sim') }),
                A.simNao('Há disponibilidade orçamentária?', { se: quando('Cumprido o interregno mínimo de 1 ano?', 'sim') }),
                A.escolha('Decisão', ['Deferido', 'Deferido em parte', 'Indeferido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a apostila', 'Apostila', { forma: 'redigir', se: quando('Decisão', 'Deferido', 'Deferido em parte') }),
                A.comunicar('Comunicar a decisão à contratada', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Comunicamos a decisão sobre o pedido de repactuação ou reajuste, a seguir.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Prorrogação de vigência', unidade: 'Gestão do contrato', vai: ['Parecer jurídico', 'Medição do período'],
            orientacao: 'Só se prorroga com previsão no edital e ateste da autoridade de que condições e preços continuam vantajosos, até 10 anos no total (Lei 14.133, arts. 106 e 107). Junte a manifestação do gestor e a pesquisa de vantajosidade e consulte a contratada. Não prorrogado, o contrato segue até o fim da vigência; se ainda houver necessidade, abra nova contratação.',
            acoes: [
                A.simNao('Há previsão de prorrogação no edital e no contrato?', { obrigatoria: true }),
                A.documento('Juntar a manifestação do gestor e a pesquisa de vantajosidade', 'Relatório', { forma: 'qualquer' }),
                A.comunicar('Consultar a contratada sobre a prorrogação', { especie: 'comunicacao', polos: ['requerido'], dias: 10, texto: 'Manifeste, no prazo, se concorda com a prorrogação do contrato nas condições indicadas.' }, { obrigatoria: true }),
                A.esperar('Aguardar a anuência da contratada', 'Consultar a contratada sobre a prorrogação', { obrigatoria: true }),
                A.simNao('Prorrogação vantajosa e com anuência da contratada?', { obrigatoria: true, ajuda: 'Sem previsão no edital, sem vantajosidade ou sem anuência: não prorrogue.' }),
            ],
            saidas: { 'Parecer jurídico': quando('Prorrogação vantajosa e com anuência da contratada?', 'sim'), 'Medição do período': quando('Prorrogação vantajosa e com anuência da contratada?', 'nao') },
        },
        {
            nome: 'Alteração ou reequilíbrio', unidade: 'Gestão do contrato', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Parecer jurídico'],
            orientacao: 'Justifique a alteração (Lei 14.133, art. 124). Nas unilaterais, a contratada é obrigada a aceitar acréscimos ou supressões de até 25% do valor inicial atualizado, ou acréscimos de até 50% em reforma de edifício ou equipamento (art. 125). No reequilíbrio, a parte apresenta pedido fundamentado e a decisão sai em 1 mês após a instrução, prorrogável por igual período (art. 123, parágrafo único). Ouça a contratada antes do parecer jurídico.',
            acoes: [
                A.escolha('Espécie', ['Alteração qualitativa', 'Alteração quantitativa', 'Reequilíbrio econômico-financeiro'], { obrigatoria: true }),
                A.documento('Juntar a justificativa técnica', 'Justificativa', { forma: 'redigir' }),
                A.simNao('Acréscimo ou supressão dentro dos limites do art. 125?', { obrigatoria: true, se: quando('Espécie', 'Alteração quantitativa') }),
                A.documento('Juntar o pedido fundamentado de reequilíbrio', 'Requerimento', { forma: 'juntar', se: quando('Espécie', 'Reequilíbrio econômico-financeiro') }),
                A.comunicar('Ouvir a contratada sobre a alteração', { especie: 'notificacao', polos: ['requerido'], dias: 10, texto: 'Manifeste-se, no prazo, sobre a alteração ou o reequilíbrio do contrato descrito a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a manifestação da contratada', 'Ouvir a contratada sobre a alteração', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Parecer jurídico', unidade: 'Assessoria jurídica', avanco: 'auto', vai: ['Termo aditivo'],
            orientacao: 'Examine a minuta do termo aditivo e a instrução: previsão contratual, limites legais, vantajosidade e regularidade (Lei 14.133, art. 53, § 4º).',
            acoes: [A.documento('Juntar o parecer jurídico', 'Parecer', { forma: 'redigir' })],
        },
        {
            nome: 'Termo aditivo', unidade: 'Setor de contratos', prazo_dias: 20, prazo_auto: true, avanco: 'auto', vai: ['Medição do período'],
            orientacao: 'Confirme a disponibilidade orçamentária e a regularidade fiscal da contratada, colha a assinatura e publique no PNCP em até 20 dias úteis, ou 10 dias úteis na contratação direta (Lei 14.133, art. 94). Depois o contrato volta ao ciclo de medição.',
            acoes: [
                A.simNao('Disponibilidade orçamentária confirmada?', { obrigatoria: true }),
                A.fazer('Conferir a regularidade fiscal da contratada', { obrigatoria: true }),
                A.documento('Juntar o termo aditivo assinado', 'Termo aditivo', { forma: 'qualquer' }),
                A.comunicar('Convocar a contratada para assinar o termo aditivo', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Assine o termo aditivo disponibilizado.' }),
                A.fazer('Publicar o termo aditivo no PNCP', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Extinção unilateral', unidade: 'Gabinete', vai: ['Recebimento definitivo e encerramento', 'Medição do período'], nome_publico: 'Extinção do contrato',
            orientacao: 'A extinção unilateral exige motivação formal, contraditório e ampla defesa (Lei 14.133, art. 137). Ouça a contratada, decida motivadamente e intime: cabe recurso em 3 dias úteis (art. 165, I, "e"). Lembre que a contratada tem direito à extinção se a Administração atrasar pagamentos por mais de 2 meses (art. 137, § 2º, IV).',
            acoes: [
                A.documento('Juntar o relatório motivado do gestor', 'Relatório', { forma: 'redigir' }),
                A.comunicar('Intimar a contratada para defesa', { especie: 'intimacao', polos: ['requerido'], dias: 5, texto: 'Apresente defesa sobre a extinção unilateral do contrato, pelos motivos expostos no relatório anexo.' }, { obrigatoria: true, ajuda: 'A lei não fixa o prazo da defesa: ajuste ao contrato ou ao regulamento do órgão.' }),
                A.esperar('Aguardar a defesa', 'Intimar a contratada para defesa', { obrigatoria: true }),
                A.documento('Juntar a decisão motivada', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 3, texto: 'Fica intimada da decisão sobre a extinção do contrato. Cabe recurso em 3 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar da decisão', { obrigatoria: true }),
                A.documento('Juntar a decisão do recurso', 'Decisão', { forma: 'redigir', se: quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial') }),
                A.escolha('Resultado final', ['Contrato extinto', 'Contrato mantido'], { obrigatoria: true, destino: 'autos', partes: true }),
            ],
            saidas: { 'Recebimento definitivo e encerramento': quando('Resultado final', 'Contrato extinto'), 'Medição do período': quando('Resultado final', 'Contrato mantido') },
        },
        {
            nome: 'Recebimento definitivo e encerramento', unidade: 'Gestão do contrato', vai: ['Arquivamento'], nome_publico: 'Encerramento do contrato',
            orientacao: 'Por término da vigência ou extinção (Lei 14.133, arts. 137 a 139). Emita o relatório final, o termo de recebimento definitivo e o termo de encerramento ou de extinção. Libere a garantia só depois de quitadas glosas, multas e, nos contratos com mão de obra, as verbas trabalhistas.',
            acoes: [
                A.documento('Juntar o relatório final do gestor', 'Relatório', { forma: 'redigir' }),
                A.documento('Juntar o termo de recebimento definitivo', 'Termo de recebimento', { forma: 'redigir' }),
                A.simNao('Há garantia a liberar?', { obrigatoria: true }),
                A.documento('Juntar a liberação da garantia', 'Despacho', { forma: 'qualquer', se: quando('Há garantia a liberar?', 'sim') }),
                A.documento('Juntar o termo de encerramento ou de extinção', 'Termo de encerramento', { forma: 'redigir' }),
                A.comunicar('Comunicar o encerramento à contratada', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Comunicamos o encerramento do contrato e o recebimento definitivo do objeto.' }, { obrigatoria: true }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

/** 11. Recebimento provisório e definitivo, liquidação e pagamento (Lei 14.133/2021 e Lei 4.320/1964). */
export function recebimentoPagamento() {
    return montar({
        id: 'recebimento-pagamento', nome: 'Recebimento de bens ou serviços, liquidação e pagamento', area: 'contratacoes', porte: 'curto', referencia: 'Lei 14.133',
        descricao: 'Confere se o que foi entregue corresponde ao contratado e paga. São duas conferências com responsáveis diferentes: o recebimento provisório, pelo fiscal, e o definitivo, pelo gestor ou por comissão; depois vêm a liquidação, que verifica o direito do credor, e o pagamento em ordem cronológica. Se o objeto não estiver conforme, o fornecedor é notificado para corrigir ou substituir no prazo; ensaio ou laudo externo põe o processo em espera. Termina com o comprovante de pagamento, ou com a remessa a processo próprio quando falta empenho ou o fornecedor não corrige.',
        quando: 'Cada entrega de compra e cada parcela de serviço ou obra a receber e pagar. Para o ciclo mensal de contrato contínuo, use a gestão de contrato.',
        base: 'Lei 14.133/2021, arts. 140 e 141; Decreto 11.246/2022, art. 25; Lei 4.320/1964, arts. 58, 60 e 62 a 64; IN SEGES 77/2022, arts. 6º a 8º.',
        tipo: { polos: ['requerente', 'requerido'], nomes_polos: { requerente: 'Contratante', requerido: 'Fornecedor' } },
    }, [
        {
            nome: 'Entrega e cobrança', unidade: 'Fiscalização do contrato', vai: ['Recebimento provisório', 'Remessa a processo próprio'],
            orientacao: 'Registre a entrega e junte a nota fiscal ou o instrumento de cobrança. Confira se há empenho prévio: não se realiza despesa sem empenho (Lei 4.320, art. 60); sem ele, o caso vai a reconhecimento de dívida, em processo próprio.',
            acoes: [
                A.formulario('Registrar a entrega e a cobrança', [
                    { id: 'contrato', rotulo: 'Contrato ou ordem de fornecimento', tipo: 'texto', obrigatorio: true },
                    { id: 'empenho', rotulo: 'Nota de empenho', tipo: 'texto' },
                    { id: 'objeto', rotulo: 'Natureza do objeto', tipo: 'lista', opcoes: ['Compra', 'Serviço', 'Obra'], obrigatorio: true },
                    { id: 'data_entrega', rotulo: 'Data da entrega', tipo: 'data', obrigatorio: true },
                    { id: 'nota_fiscal', rotulo: 'Número da nota fiscal', tipo: 'texto', obrigatorio: true },
                    { id: 'data_nota', rotulo: 'Data de recebimento da nota fiscal', tipo: 'data', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor cobrado (R$)', tipo: 'numero', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a nota fiscal ou o instrumento de cobrança', 'Nota fiscal', { forma: 'juntar' }),
                A.documento('Juntar o termo de entrega', 'Termo de entrega', { forma: 'juntar', nivel: 'recomendado' }),
                A.simNao('Há empenho prévio?', { obrigatoria: true }),
            ],
            saidas: { 'Recebimento provisório': quando('Há empenho prévio?', 'sim'), 'Remessa a processo próprio': quando('Há empenho prévio?', 'nao') },
        },
        {
            nome: 'Recebimento provisório', unidade: 'Fiscalização do contrato',
            vai: ['Recebimento definitivo', 'Correção pelo fornecedor', 'Aguardando ensaio ou laudo'],
            condicoes: { 'Aguardando ensaio ou laudo': 'A conformidade depende de ensaio, teste ou laudo de terceiro.' },
            orientacao: 'Compras: receba de forma sumária e verifique depois a conformidade (Lei 14.133, art. 140, II, "a"). Obras e serviços: termo detalhado, verificado o cumprimento das exigências técnicas (art. 140, I, "a"). Confira quantidade, especificação, ensaios e testes no prazo do contrato (art. 140, § 3º). Pode receber a parte conforme e rejeitar o resto (art. 140, § 1º).',
            acoes: [
                A.audiencia('Designar vistoria, se necessária', 'inspecao'),
                A.comunicar('Avisar o fornecedor da vistoria', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Acompanhe, se quiser, a vistoria do objeto em {audiencia}.' }),
                A.escolha('Conformidade do objeto', ['Conforme', 'Conforme em parte', 'Não conforme', 'Depende de ensaio ou laudo'], { obrigatoria: true }),
                A.documento('Juntar o termo de recebimento provisório', 'Termo de recebimento', { forma: 'redigir', se: quando('Conformidade do objeto', 'Conforme', 'Conforme em parte') }),
                A.textoLongo('Descrever a desconformidade', { se: quando('Conformidade do objeto', 'Conforme em parte', 'Não conforme') }),
            ],
            saidas: { 'Recebimento definitivo': quando('Conformidade do objeto', 'Conforme', 'Conforme em parte'), 'Correção pelo fornecedor': quando('Conformidade do objeto', 'Não conforme') },
        },
        {
            nome: 'Aguardando ensaio ou laudo', unidade: 'Fiscalização do contrato', espera: true, avanco: 'auto',
            orientacao: 'Espera o resultado do laboratório ou do terceiro. Juntado o laudo, o processo volta ao recebimento provisório para concluir a conformidade.',
            acoes: [A.documento('Juntar o laudo ou o resultado do ensaio', 'Laudo', { forma: 'juntar' })],
        },
        {
            nome: 'Correção pelo fornecedor', unidade: 'Fiscalização do contrato', avanco: 'auto', nome_publico: 'Correção do objeto',
            vai: ['Recebimento provisório', 'Remessa a processo próprio'], ao_entrar: { pendencia: 'Fornecedor notificado para corrigir ou substituir o objeto.' },
            orientacao: 'Notifique o fornecedor da rejeição, com o prazo do contrato para corrigir, substituir ou contestar. Corrigido, volta para nova verificação; se não, o caso vai à apuração de infração, em processo próprio.',
            acoes: [
                A.comunicar('Notificar o fornecedor para corrigir ou substituir', { especie: 'notificacao', polos: ['requerido'], dias: 5, texto: 'O objeto foi rejeitado pelos motivos indicados. Corrija ou substitua no prazo, ou apresente suas razões.' }, { obrigatoria: true, ajuda: 'Use o prazo previsto no contrato ou no termo de referência.' }),
                A.esperar('Aguardar a correção', 'Notificar o fornecedor para corrigir ou substituir', { obrigatoria: true }),
                A.simNao('O fornecedor corrigiu ou substituiu?', { obrigatoria: true }),
            ],
            saidas: { 'Recebimento provisório': quando('O fornecedor corrigiu ou substituiu?', 'sim'), 'Remessa a processo próprio': quando('O fornecedor corrigiu ou substituiu?', 'nao') },
        },
        {
            nome: 'Recebimento definitivo', unidade: 'Gestão do contrato', avanco: 'auto', vai: ['Liquidação'],
            orientacao: 'O gestor ou a comissão designada emite termo detalhado que comprove o atendimento das exigências contratuais (Lei 14.133, art. 140, I, "b", e II, "b"), no prazo do contrato. O recebimento não exclui a responsabilidade civil pela solidez e segurança da obra ou do serviço (art. 140, § 2º).',
            acoes: [
                A.simNao('Recebimento parcial?', { obrigatoria: true, ajuda: 'Recebe só a parte conforme; a rejeitada não se paga (art. 140, § 1º).' }),
                A.numero('Valor recebido (R$)', { obrigatoria: true, se: quando('Recebimento parcial?', 'sim') }),
                A.documento('Juntar o termo de recebimento definitivo', 'Termo de recebimento', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Liquidação', unidade: 'Setor financeiro', prazo_dias: 10, prazo_auto: true, avanco: 'auto', vai: ['Pagamento'],
            orientacao: 'Liquide em até 10 dias úteis do recebimento da nota fiscal, metade para despesas até o limite do art. 75, II, prorrogável por igual período para diligências (IN 77/2022, art. 7º, I e §§ 2º e 3º). Apure origem e objeto, valor exato e credor (Lei 4.320, art. 63) e verifique a manutenção das condições de habilitação (IN 77/2022, art. 8º). O tempo que o fornecedor leva para sanar a nota não conta no prazo (art. 7º, § 4º).',
            acoes: [
                A.formulario('Registrar a liquidação', [
                    { id: 'credor', rotulo: 'Credor', tipo: 'texto', obrigatorio: true },
                    { id: 'valor_liquido', rotulo: 'Valor liquidado (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'retencoes', rotulo: 'Retenções (R$)', tipo: 'numero' },
                    { id: 'pequeno_valor', rotulo: 'Despesa até o limite do art. 75, II?', tipo: 'sim_nao', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.simNao('A nota fiscal precisa ser corrigida?', { obrigatoria: true }),
                A.comunicar('Notificar o fornecedor para corrigir a nota', { especie: 'notificacao', polos: ['requerido'], dias: 5, texto: 'Corrija a nota fiscal pelos motivos indicados. O prazo de liquidação fica suspenso até a correção.' }, { se: quando('A nota fiscal precisa ser corrigida?', 'sim') }),
                A.esperar('Aguardar a nota corrigida', 'Notificar o fornecedor para corrigir a nota', { se: quando('A nota fiscal precisa ser corrigida?', 'sim') }),
                A.simNao('Habilitação e regularidade fiscal mantidas?', { obrigatoria: true, ajuda: 'Se não, notifique para regularizar; a perda não autoriza, por si só, reter o pagamento (IN 77/2022, art. 8º, §§ 1º e 2º).' }),
                A.comunicar('Notificar o fornecedor para regularizar', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Regularize sua situação fiscal, condição de habilitação a ser mantida durante a execução.' }, { se: quando('Habilitação e regularidade fiscal mantidas?', 'nao') }),
                A.documento('Juntar o registro da liquidação', 'Liquidação', { forma: 'qualquer' }),
            ],
        },
        {
            nome: 'Pagamento', unidade: 'Setor financeiro', prazo_dias: 10, prazo_auto: true, vai: ['Arquivamento'],
            orientacao: 'O ordenador de despesa emite a ordem de pagamento (Lei 4.320, arts. 62 e 64). Pague em até 10 dias úteis da liquidação, metade para pequenas despesas (IN 77/2022, art. 7º, II e § 2º), na ordem cronológica por fonte de recursos e categoria de contrato. Alterar a ordem só nas hipóteses do art. 141, § 1º, com justificativa prévia e comunicação ao controle interno e ao tribunal de contas.',
            acoes: [
                A.simNao('O pagamento segue a ordem cronológica?', { obrigatoria: true }),
                A.documento('Juntar a justificativa prévia da alteração da ordem', 'Justificativa', { forma: 'redigir', se: quando('O pagamento segue a ordem cronológica?', 'nao') }),
                A.fazer('Comunicar a alteração ao controle interno e ao tribunal de contas', { obrigatoria: true, se: quando('O pagamento segue a ordem cronológica?', 'nao') }),
                A.documento('Juntar a ordem de pagamento', 'Ordem de pagamento', { forma: 'qualquer' }),
                A.documento('Juntar o comprovante de pagamento', 'Comprovante de pagamento', { forma: 'juntar' }),
                A.comunicar('Comunicar o pagamento ao fornecedor', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Comunicamos o pagamento da nota fiscal indicada.' }),
            ],
        },
        {
            nome: 'Remessa a processo próprio', unidade: 'Gestão do contrato', vai: ['Arquivamento'],
            orientacao: 'Sem empenho prévio, o caso vai a reconhecimento de dívida. Objeto rejeitado e não corrigido vai à apuração de infração e sanção. Abra o processo próprio e anote o número; a parte recebida e conforme, se houver, segue em processo de pagamento à parte.',
            acoes: [
                A.escolha('Motivo da remessa', ['Falta de empenho prévio', 'Objeto rejeitado sem correção'], { obrigatoria: true }),
                A.documento('Juntar o despacho de remessa', 'Despacho', { forma: 'redigir' }),
                A.texto('Número do processo próprio', { obrigatoria: true }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

/** 19. Parceria com organização da sociedade civil (Lei 13.019/2014). */
export function parceriaOsc() {
    return montar({
        id: 'parceria-osc', nome: 'Parceria com organização da sociedade civil', area: 'contratacoes', porte: 'longo', referencia: 'Lei 13.019',
        descricao: 'Seleciona uma organização da sociedade civil, em regra por chamamento público, celebra termo de colaboração ou de fomento, acompanha a execução e julga a prestação de contas. Corre do edital ao julgamento das propostas pela comissão de seleção, com resultado e recursos, segue para o plano de trabalho, os pareceres e a celebração, que só produz efeitos com a publicação do extrato. Na execução, a organização recebe visitas e notificações, o relatório de monitoramento é homologado pela comissão e a vigência pode ser alterada a pedido. A organização presta contas, pode sanear irregularidades em 45 dias e tem defesa prévia antes de sanção; contas irregulares levam à sanção e à tomada de contas especial.',
        quando: 'Repasses a entidades sem fins lucrativos para execução de atividade ou projeto de interesse público. Para contratar empresa, use o rito de contratação por licitação.',
        base: 'Lei 13.019/2014, arts. 23 a 38, 52, 55, 58, 59 e 69 a 73; Decreto 8.726/2016 (Executivo federal).',
        tipo: { polos: ['interessado'], nomes_polos: { interessado: 'Organização parceira' } },
    }, [
        {
            nome: 'Planejamento e edital', unidade: 'Gestão da parceria', vai: ['Publicação do edital', 'Plano de trabalho e requisitos'],
            orientacao: 'Defina objeto, metas, valor de referência e critérios de seleção. Em regra a seleção é por chamamento público; a dispensa e a inexigibilidade se justificam nas hipóteses dos arts. 30 e 31 (arts. 23 a 32).',
            acoes: [
                A.formulario('Registrar os dados da parceria', [
                    { id: 'objeto', rotulo: 'Objeto', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'instrumento', rotulo: 'Instrumento', tipo: 'lista', opcoes: ['Termo de colaboração', 'Termo de fomento', 'Acordo de cooperação'], obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor de referência (R$)', tipo: 'numero' },
                    { id: 'vigencia', rotulo: 'Vigência prevista (meses)', tipo: 'numero', obrigatorio: true },
                    { id: 'programa', rotulo: 'Programa ou política pública', tipo: 'texto' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.escolha('Forma de seleção', ['Chamamento público', 'Dispensa de chamamento', 'Inexigibilidade de chamamento'], { obrigatoria: true }),
                A.documento('Juntar o edital de chamamento', 'Edital', { forma: 'redigir', se: quando('Forma de seleção', 'Chamamento público') }),
                A.documento('Juntar a justificativa da dispensa ou inexigibilidade', 'Justificativa', { forma: 'redigir', se: quando('Forma de seleção', 'Dispensa de chamamento', 'Inexigibilidade de chamamento') }),
            ],
            saidas: { 'Publicação do edital': quando('Forma de seleção', 'Chamamento público'), 'Plano de trabalho e requisitos': quando('Forma de seleção', 'Dispensa de chamamento', 'Inexigibilidade de chamamento') },
        },
        {
            nome: 'Publicação do edital', unidade: 'Secretaria', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Julgamento das propostas'], nome_publico: 'Chamamento público aberto',
            orientacao: 'Publique o edital no sítio oficial com antecedência mínima de 30 dias da data-limite das propostas (art. 26). Só passe ao julgamento depois de encerrado o prazo.',
            acoes: [
                A.fazer('Publicar o edital no sítio oficial', { obrigatoria: true }),
                A.data('Data da publicação', { obrigatoria: true }),
                A.data('Data-limite para as propostas', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Julgamento das propostas', unidade: 'Comissão de seleção', vai: ['Resultado e recursos', 'Arquivamento'],
            orientacao: 'A comissão de seleção julga as propostas; é critério obrigatório a adequação aos objetivos do programa e ao valor de referência (art. 27). Membro com impedimento em relação a proponente é substituído antes do julgamento.',
            acoes: [
                A.simNao('Algum membro da comissão está impedido?', { obrigatoria: true, ajuda: 'Se sim, substitua-o antes de julgar.' }),
                A.formulario('Registrar o julgamento', [
                    { id: 'recebidas', rotulo: 'Propostas recebidas', tipo: 'numero', obrigatorio: true },
                    { id: 'selecionada', rotulo: 'Organização mais bem classificada', tipo: 'texto' },
                    { id: 'nota', rotulo: 'Pontuação obtida', tipo: 'numero' },
                ], { obrigatoria: true }),
                A.documento('Juntar a ata de julgamento', 'Ata', { forma: 'redigir' }),
                A.escolha('Resultado do julgamento', ['Proposta selecionada', 'Nenhuma proposta adequada'], { obrigatoria: true }),
            ],
            saidas: { 'Resultado e recursos': quando('Resultado do julgamento', 'Proposta selecionada'), 'Arquivamento': quando('Resultado do julgamento', 'Nenhuma proposta adequada') },
        },
        {
            nome: 'Resultado e recursos', unidade: 'Gabinete', vai: ['Plano de trabalho e requisitos'],
            orientacao: 'Publique o resultado preliminar e abra prazo de recurso às proponentes, na forma do edital ou do regulamento. Decididos os recursos, a autoridade homologa o resultado.',
            acoes: [
                A.documento('Juntar o resultado preliminar', 'Resultado', { forma: 'redigir' }),
                A.comunicar('Intimar as proponentes do resultado preliminar', { especie: 'intimacao', dias: 5, texto: 'Publicado o resultado preliminar do chamamento público. Querendo, recorra no prazo.' }, { obrigatoria: true, ajuda: 'O prazo de recurso é o do edital ou do regulamento: ajuste aqui.' }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar as proponentes do resultado preliminar', { obrigatoria: true }),
                A.documento('Juntar a decisão dos recursos', 'Decisão', { forma: 'redigir', se: quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial') }),
                A.documento('Juntar a homologação do resultado', 'Homologação', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Plano de trabalho e requisitos', unidade: 'Gestão da parceria', avanco: 'auto', vai: ['Parecer técnico', 'Julgamento das propostas', 'Arquivamento'],
            condicoes: { 'Julgamento das propostas': 'Selecionada não atende aos requisitos: convide a seguinte na classificação.', 'Arquivamento': 'Não há outra organização a convocar.' },
            orientacao: 'Convoque a organização para apresentar o plano de trabalho e os documentos que comprovam os requisitos dos arts. 33 e 34. Se a selecionada não os atender, a seguinte na classificação pode ser convidada.',
            acoes: [
                A.comunicar('Convocar a organização para o plano de trabalho', { especie: 'notificacao', polos: ['interessado'], dias: 15, texto: 'Apresente o plano de trabalho e os documentos que comprovam os requisitos para celebrar a parceria.' }, { obrigatoria: true, ajuda: 'Prazo usual do regulamento federal; ajuste ao edital ou ao regulamento local.' }),
                A.esperar('Aguardar o plano e os documentos', 'Convocar a organização para o plano de trabalho', { obrigatoria: true }),
                A.documento('Juntar o plano de trabalho', 'Plano de trabalho', { forma: 'juntar', se: quando('Aguardar o plano e os documentos', 'Apresentada', 'Parcial') }),
                A.simNao('Requisitos dos arts. 33 e 34 atendidos?', { obrigatoria: true }),
            ],
            saidas: { 'Parecer técnico': quando('Requisitos dos arts. 33 e 34 atendidos?', 'sim') },
        },
        {
            nome: 'Parecer técnico', unidade: 'Gestão da parceria', avanco: 'auto', vai: ['Parecer jurídico'],
            orientacao: 'Emita parecer técnico sobre o mérito da proposta, a viabilidade da execução, o cronograma e os meios de monitoramento, e designe o gestor da parceria (art. 35).',
            acoes: [
                A.documento('Juntar o parecer técnico', 'Parecer', { forma: 'redigir' }),
                A.texto('Gestor da parceria designado', { obrigatoria: true }),
                A.simNao('Há disponibilidade orçamentária?', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Parecer jurídico', unidade: 'Assessoria jurídica', avanco: 'auto', vai: ['Celebração e extrato'],
            orientacao: 'Examine a regularidade da seleção e a minuta do termo (art. 35). Parecer com ressalvas: a autoridade sana ou justifica antes de celebrar.',
            acoes: [
                A.escolha('Conclusão do parecer', ['Favorável', 'Favorável com ressalvas', 'Desfavorável'], { obrigatoria: true }),
                A.documento('Juntar o parecer jurídico', 'Parecer', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Celebração e extrato', unidade: 'Gabinete', vai: ['Execução e monitoramento'], nome_publico: 'Celebração da parceria',
            orientacao: 'Assine o termo de colaboração ou de fomento e publique o extrato no meio oficial: o instrumento só produz efeitos depois da publicação (art. 38).',
            acoes: [
                A.textoLongo('Justificar as ressalvas do parecer, se houver'),
                A.documento('Juntar o termo assinado', 'Termo de colaboração ou de fomento', { forma: 'qualquer' }),
                A.comunicar('Convocar a organização para assinar o termo', { especie: 'comunicacao', polos: ['interessado'], dias: 0, texto: 'Assine o termo de parceria disponibilizado.' }, { obrigatoria: true }),
                A.fazer('Publicar o extrato no meio oficial', { obrigatoria: true }),
                A.data('Data da publicação do extrato', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Execução e monitoramento', unidade: 'Gestão da parceria',
            vai: ['Homologação do relatório', 'Alteração da parceria', 'Prestação de contas'],
            orientacao: 'O gestor acompanha a execução, faz visitas técnicas e emite relatório técnico de monitoramento e avaliação, que a comissão de monitoramento e avaliação homologa (arts. 58 e 59). Irregularidade na execução: notifique a organização para sanar. Ao fim de cada etapa, diga por onde segue.',
            acoes: [
                A.audiencia('Designar visita técnica in loco', 'inspecao'),
                A.comunicar('Avisar a organização da visita', { especie: 'comunicacao', polos: ['interessado'], dias: 0, texto: 'Haverá visita técnica de monitoramento em {audiencia}.' }),
                A.simNao('Há irregularidade na execução?', { obrigatoria: true }),
                A.comunicar('Notificar a organização para sanar', { especie: 'notificacao', polos: ['interessado'], dias: 15, texto: 'Sane as irregularidades na execução da parceria, descritas a seguir, ou apresente justificativa.' }, { se: quando('Há irregularidade na execução?', 'sim'), ajuda: 'Prazo não fixado na lei: ajuste ao termo ou ao regulamento.' }),
                A.esperar('Aguardar a regularização', 'Notificar a organização para sanar', { se: quando('Há irregularidade na execução?', 'sim') }),
                A.documento('Juntar o relatório técnico de monitoramento e avaliação', 'Relatório', { forma: 'redigir' }),
                A.escolha('Próximo passo', ['Homologar o relatório do período', 'Alterar a parceria', 'Fim da vigência'], { obrigatoria: true }),
            ],
            saidas: {
                'Homologação do relatório': quando('Próximo passo', 'Homologar o relatório do período'),
                'Alteração da parceria': quando('Próximo passo', 'Alterar a parceria'),
                'Prestação de contas': quando('Próximo passo', 'Fim da vigência'),
            },
        },
        {
            nome: 'Homologação do relatório', unidade: 'Comissão de monitoramento e avaliação', avanco: 'auto', vai: ['Execução e monitoramento'],
            orientacao: 'A comissão de monitoramento e avaliação homologa o relatório técnico, independentemente da prestação de contas (art. 59). Depois, a execução segue.',
            acoes: [
                A.simNao('Relatório homologado?', { obrigatoria: true }),
                A.textoLongo('Recomendações da comissão', { se: quando('Relatório homologado?', 'nao') }),
                A.documento('Juntar a ata de homologação', 'Ata', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Alteração da parceria', unidade: 'Gestão da parceria', vai: ['Execução e monitoramento'],
            orientacao: 'A prorrogação a pedido exige solicitação da organização com no mínimo 30 dias de antecedência do término da vigência (art. 55). Formalize por termo aditivo ou apostila, conforme o caso.',
            acoes: [
                A.escolha('Espécie', ['Prorrogação de vigência', 'Alteração do plano de trabalho'], { obrigatoria: true }),
                A.documento('Juntar o pedido da organização', 'Requerimento', { forma: 'juntar' }),
                A.simNao('Pedido feito com 30 dias de antecedência do término?', { obrigatoria: true, se: quando('Espécie', 'Prorrogação de vigência') }),
                A.escolha('Decisão', ['Deferido', 'Indeferido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o termo aditivo ou a apostila', 'Termo aditivo', { forma: 'redigir', se: quando('Decisão', 'Deferido') }),
                A.comunicar('Comunicar a decisão à organização', { especie: 'comunicacao', polos: ['interessado'], dias: 0, texto: 'Comunicamos a decisão sobre o pedido de alteração da parceria.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Prestação de contas', unidade: 'Gestão da parceria', avanco: 'auto', vai: ['Análise das contas', 'Decisão sobre as contas'], ao_entrar: { pendencia: 'Organização deve prestar contas da parceria.' },
            orientacao: 'A organização presta contas em até 90 dias do término da vigência, ou ao fim de cada exercício se a parceria durar mais de um ano (art. 69). Saldos são devolvidos em 30 dias improrrogáveis, sob pena de tomada de contas especial (art. 52). A omissão segue direto para decisão.',
            acoes: [
                A.comunicar('Notificar a organização para prestar contas', { especie: 'notificacao', polos: ['interessado'], dias: 90, contagem: corridos, texto: 'Apresente a prestação de contas da parceria no prazo, devolvendo os saldos em 30 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar a prestação de contas', 'Notificar a organização para prestar contas', { obrigatoria: true }),
                A.simNao('Há saldo a devolver?', { obrigatoria: true }),
                A.fazer('Conferir a devolução do saldo em 30 dias', { obrigatoria: true, se: quando('Há saldo a devolver?', 'sim') }),
            ],
            saidas: { 'Análise das contas': quando('Aguardar a prestação de contas', 'Apresentada', 'Parcial'), 'Decisão sobre as contas': quando('Aguardar a prestação de contas', 'Sem manifestação') },
        },
        {
            nome: 'Análise das contas', unidade: 'Gestão da parceria', prazo_dias: 150, prazo_auto: true, prazo_contagem: corridos, vai: ['Decisão sobre as contas', 'Saneamento das contas'],
            orientacao: 'Analise as contas em até 150 dias do recebimento, prorrogáveis por igual período com justificativa (art. 71). Irregularidade sanável vai a saneamento; as demais seguem para decisão.',
            acoes: [
                A.escolha('Resultado da análise', ['Sem irregularidade', 'Irregularidade sanável', 'Irregularidade insanável'], { obrigatoria: true }),
                A.documento('Juntar o parecer técnico conclusivo', 'Parecer', { forma: 'redigir', se: quando('Resultado da análise', 'Sem irregularidade', 'Irregularidade insanável') }),
            ],
            saidas: { 'Saneamento das contas': quando('Resultado da análise', 'Irregularidade sanável'), 'Decisão sobre as contas': quando('Resultado da análise', 'Sem irregularidade', 'Irregularidade insanável') },
        },
        {
            nome: 'Saneamento das contas', unidade: 'Gestão da parceria', avanco: 'auto', vai: ['Análise das contas'], nome_publico: 'Saneamento da prestação de contas',
            orientacao: 'Notifique a organização para sanar a irregularidade ou cumprir a obrigação em até 45 dias, prorrogáveis por igual período, dentro do prazo de análise (art. 70, § 1º). Com a resposta ou o fim do prazo, volta à análise.',
            acoes: [
                A.comunicar('Notificar a organização para sanar as contas', { especie: 'notificacao', polos: ['interessado'], dias: 45, contagem: corridos, texto: 'Sane as irregularidades da prestação de contas apontadas a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar o saneamento', 'Notificar a organização para sanar as contas', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Decisão sobre as contas', unidade: 'Gabinete', vai: ['Sanção e tomada de contas especial', 'Arquivamento'],
            orientacao: 'Julgue as contas regulares, regulares com ressalva (falha formal sem dano) ou irregulares (art. 72) e intime a organização. Irregulares: segue para sanção e, havendo dano, tomada de contas especial.',
            acoes: [
                A.escolha('Julgamento das contas', ['Regulares', 'Regulares com ressalva', 'Irregulares'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar a organização da decisão', { especie: 'intimacao', polos: ['interessado'], dias: 0, texto: 'Fica intimada do julgamento da prestação de contas da parceria.' }, { obrigatoria: true }),
            ],
            saidas: { 'Sanção e tomada de contas especial': quando('Julgamento das contas', 'Irregulares'), 'Arquivamento': quando('Julgamento das contas', 'Regulares', 'Regulares com ressalva') },
        },
        {
            nome: 'Sanção e tomada de contas especial', unidade: 'Gabinete', vai: ['Arquivamento'],
            orientacao: 'Assegure defesa prévia. Nas sanções mais graves, a defesa é de 10 dias da abertura de vista e a competência é de ministro ou secretário; a reabilitação cabe após 2 anos (art. 73, § 1º). Havendo dano, instaure tomada de contas especial em processo próprio.',
            acoes: [
                A.comunicar('Intimar para defesa prévia', { especie: 'intimacao', polos: ['interessado'], dias: 10, contagem: corridos, texto: 'Apresente defesa prévia sobre a aplicação de sanção pela execução irregular da parceria.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa', 'Intimar para defesa prévia', { obrigatoria: true }),
                A.escolha('Sanção aplicada', ['Advertência', 'Suspensão temporária', 'Declaração de inidoneidade', 'Nenhuma'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão sobre a sanção', 'Decisão', { forma: 'redigir' }),
                A.simNao('Há dano a ressarcir?', { obrigatoria: true }),
                A.texto('Número do processo de tomada de contas especial', { obrigatoria: true, se: quando('Há dano a ressarcir?', 'sim') }),
                A.comunicar('Intimar da decisão sobre a sanção', { especie: 'intimacao', polos: ['interessado'], dias: 0, texto: 'Fica intimada da decisão sobre a sanção.' }, { obrigatoria: true }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

export const modelos = [gestaoContrato, recebimentoPagamento, parceriaOsc];
