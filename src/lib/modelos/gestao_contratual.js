// Gestão contratual completa (Lei 14.133/2021): da assinatura à extinção, num
// rito só, com aditivos, apostilas, prorrogação, reequilíbrio, subcontratação,
// fiscalização, recebimento, pagamento, avaliação da contratada e remessa a
// processos derivados (apuração de infração, controvérsia). Nada aqui é penal:
// a sanção é administrativa e corre em processo derivado próprio. Ver a forma
// de escrever em ./dsl.js e as fontes em docs/MODELOS_DE_RITO.md.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';
const SEGUE = ['Próximo período', 'Termo aditivo', 'Apostila', 'Prorrogação da vigência', 'Reequilíbrio econômico-financeiro', 'Subcontratação ou mudança na contratada', 'Controvérsia com a contratada', 'Extinção antecipada', 'Objeto concluído ou fim da vigência'];

/** 49. Gestão contratual completa, da assinatura à extinção (Lei 14.133/2021). */
export function gestaoContratualCompleta() {
    return montar({
        id: 'gestao-contratual-completa', nome: 'Gestão contratual completa: da assinatura à extinção', area: 'contratacoes', porte: 'longo', referencia: 'Lei 14.133',
        descricao: 'Um processo por contrato administrativo, do começo ao fim: convocação e assinatura, garantia, publicação no PNCP (condição de eficácia), designação de gestor e fiscais, início da execução, fiscalização a cada período, recebimento, liquidação e pagamento em ordem cronológica. De cada pagamento o contrato segue para o período seguinte ou para um evento: termo aditivo (alteração unilateral ou por acordo, dentro dos limites de 25% e 50%), apostila (reajuste, repactuação, encargos de atraso, mudança de razão social, empenho), prorrogação da vigência, reequilíbrio econômico-financeiro, subcontratação ou mudança societária da contratada, solução consensual de controvérsia e extinção antecipada. Falha não corrigida é remetida a processo derivado de apuração de infração, com defesa e recurso próprios; o contrato continua sendo acompanhado aqui. No fim, recebimento definitivo, avaliação de desempenho da contratada para o cadastro de fornecedores, liberação da garantia e encerramento. A contratada é chamada a assinar, corrigir, faturar, anuir, se manifestar antes de qualquer alteração e se defender antes da extinção.',
        quando: 'No Ministério Público do RS, prefira o modelo "Gestão de contrato no MPRS", que já traz as unidades e os prazos dos provimentos. Qualquer contrato administrativo (serviço contínuo ou por escopo, fornecimento, obra ou serviço de engenharia), de licitação ou de contratação direta. Abra um processo por contrato, logo após a homologação ou a ratificação. Gere um painel com "Integração com o painel" para acompanhar todos os contratos num quadro. Os regulamentos citados (Decreto 11.246/2022 e instruções da SEGES) são do Executivo federal: nos outros entes servem de referência. O Executivo do RS não tem regulamento próprio de gestor e fiscal: use este modelo, com a consulta ao CFIL/RS e ao CADIN/RS antes de assinar e de pagar.',
        base: 'Lei 14.133/2021, arts. 53, § 4º, 88, §§ 3º e 4º, 89 a 103, 104, 105 a 114, 115 a 123, 124 a 136, 137 a 139, 140 a 146, 151 a 154, 155 a 163 e 165 a 168; Decreto 11.246/2022 (gestão e fiscalização); IN SEGES 5/2017 (serviços); IN SEGES 77/2022 (pagamento); Lei 4.320/1964, arts. 58 a 65. Decreto e instruções são do Executivo federal. No RS: Lei estadual 11.389/1999, art. 12, e Decreto 42.250/2003, art. 14 (consulta ao CFIL/RS).',
        tipo: { polos: ['requerente', 'requerido'], nomes_polos: { requerente: 'Contratante', requerido: 'Contratada' } },
    }, [
        {
            nome: 'Formalização e assinatura', unidade: 'Setor de contratos', nome_publico: 'Assinatura do contrato',
            vai: ['Garantia contratual', 'Recusa em assinar'],
            orientacao: 'O contrato é escrito e tem as cláusulas necessárias do art. 92 (objeto, regime de execução, preço e reajuste, prazos, garantias, matriz de riscos quando houver, obrigações e sanções). Antes de assinar, confira a habilitação e consulte os cadastros de sanções (CEIS e CNEP). Convoque a contratada no prazo e nas condições do edital; o prazo pode ser prorrogado uma vez, a pedido justificado (art. 90, § 1º). Assinatura eletrônica é admitida (art. 91, § 3º). Nas compras com entrega imediata e nas dispensas por valor, o instrumento pode ser substituído por nota de empenho, carta-contrato ou ordem de serviço (art. 95).',
            acoes: [
                A.formulario('Registrar os dados do contrato', [
                    { id: 'numero', rotulo: 'Número do contrato', tipo: 'texto', obrigatorio: true },
                    { id: 'contratada', rotulo: 'Contratada (nome e CNPJ ou CPF)', tipo: 'texto', obrigatorio: true },
                    { id: 'objeto', rotulo: 'Objeto', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'origem', rotulo: 'Origem da contratação', tipo: 'lista', opcoes: ['Licitação', 'Dispensa', 'Inexigibilidade', 'Adesão a ata de registro de preços'], obrigatorio: true },
                    { id: 'natureza', rotulo: 'Natureza do objeto', tipo: 'lista', opcoes: ['Serviço contínuo', 'Serviço por escopo', 'Fornecimento contínuo', 'Fornecimento com entrega única ou parcelada', 'Obra ou serviço de engenharia'], obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor global (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'inicio', rotulo: 'Início da vigência', tipo: 'data', obrigatorio: true },
                    { id: 'fim', rotulo: 'Fim da vigência', tipo: 'data', obrigatorio: true },
                    { id: 'mao_obra', rotulo: 'Dedicação exclusiva de mão de obra?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'garantia', rotulo: 'O edital exige garantia?', tipo: 'sim_nao', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.fazer('Conferir a habilitação e consultar o CEIS e o CNEP', { obrigatoria: true }),
                A.documento('Juntar a minuta do contrato conforme o edital', 'Minuta de contrato', { forma: 'qualquer' }),
                A.comunicar('Convocar a contratada para assinar', { especie: 'comunicacao', polos: ['requerido'], dias: 5, texto: 'Fica convocada a assinar o contrato no prazo indicado, nas condições do edital e da proposta. O prazo pode ser prorrogado uma vez, a pedido justificado.' }, { obrigatoria: true, ajuda: 'Use o prazo do edital; 5 dias úteis é só uma sugestão.' }),
                A.esperar('Aguardar a assinatura', 'Convocar a contratada para assinar', { obrigatoria: true }),
                A.simNao('A contratada assinou no prazo?', { obrigatoria: true }),
                A.documento('Juntar o contrato assinado', 'Contrato', { forma: 'juntar', se: quando('A contratada assinou no prazo?', 'sim') }),
            ],
            saidas: { 'Garantia contratual': quando('A contratada assinou no prazo?', 'sim'), 'Recusa em assinar': quando('A contratada assinou no prazo?', 'nao') },
        },
        {
            nome: 'Recusa em assinar', unidade: 'Gabinete', vai: ['Formalização e assinatura', 'Arquivamento'],
            orientacao: 'A recusa injustificada caracteriza o descumprimento total da obrigação assumida e sujeita a contratada às sanções da lei, apuradas em processo próprio (arts. 90, § 5º, e 155, VI). A Administração pode convocar os licitantes remanescentes, na ordem de classificação, nas condições da proposta vencedora, ou revogar a licitação (art. 90, §§ 2º e 4º).',
            acoes: [
                A.documento('Juntar a certidão da recusa ou do decurso do prazo', 'Certidão', { forma: 'redigir' }),
                A.escolha('Providência', ['Convocar o próximo classificado', 'Revogar a licitação ou encerrar a contratação'], { obrigatoria: true, destino: 'autos' }),
                A.derivado('Abrir processo derivado de apuração de infração', 'Infração contratual e sanção a fornecedor', { obrigatoria: true, ajuda: 'O botão da ação abre o novo processo já ligado a este; criado, a ação se cumpre sozinha.' }),
                A.texto('Número do processo de apuração', { obrigatoria: true }),
            ],
            saidas: { 'Formalização e assinatura': quando('Providência', 'Convocar o próximo classificado'), Arquivamento: quando('Providência', 'Revogar a licitação ou encerrar a contratação') },
        },
        {
            nome: 'Garantia contratual', unidade: 'Setor de contratos', vai: ['Publicação no PNCP'],
            orientacao: 'Se o edital exigir, a contratada escolhe a modalidade: caução em dinheiro ou títulos da dívida pública, seguro-garantia, fiança bancária ou título de capitalização (art. 96, § 1º). Até 5% do valor inicial, ou até 10% com justificativa pela complexidade e pelos riscos (art. 98). Em obra e serviço de engenharia de grande vulto, até 30%, com cláusula de retomada no seguro-garantia (art. 99). Confira a validade, que deve cobrir a vigência e ser renovada a cada prorrogação ou aditivo.',
            acoes: [
                A.escolha('Modalidade da garantia', ['Caução em dinheiro ou títulos da dívida pública', 'Seguro-garantia', 'Fiança bancária', 'Título de capitalização', 'Não exigida'], { obrigatoria: true }),
                A.numero('Percentual sobre o valor inicial (%)', { se: quando('Modalidade da garantia', 'Caução em dinheiro ou títulos da dívida pública', 'Seguro-garantia', 'Fiança bancária', 'Título de capitalização') }),
                A.data('Validade da garantia', { se: quando('Modalidade da garantia', 'Seguro-garantia', 'Fiança bancária', 'Título de capitalização') }),
                A.documento('Juntar o comprovante da garantia', 'Comprovante', { forma: 'juntar', se: quando('Modalidade da garantia', 'Caução em dinheiro ou títulos da dívida pública', 'Seguro-garantia', 'Fiança bancária', 'Título de capitalização') }),
            ],
        },
        {
            nome: 'Publicação no PNCP', unidade: 'Setor de contratos', prazo_dias: 20, prazo_auto: true, avanco: 'auto', vai: ['Designação de gestão e fiscalização'],
            orientacao: 'A divulgação no Portal Nacional de Contratações Públicas é condição de eficácia do contrato e dos aditivos: até 20 dias úteis da assinatura, na licitação, e até 10 dias úteis, na contratação direta (art. 94). Na urgência, o contrato tem eficácia desde a assinatura, mas a divulgação segue os mesmos prazos (art. 94, § 1º). Publique também no sítio oficial do órgão.',
            acoes: [
                A.data('Data da divulgação no PNCP', { obrigatoria: true }),
                A.texto('Número de controle no PNCP', { obrigatoria: true }),
                A.documento('Juntar o comprovante da divulgação', 'Comprovante', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Designação de gestão e fiscalização', unidade: 'Gabinete', vai: ['Início da execução'],
            orientacao: 'Designe o gestor e os fiscais (técnico, administrativo e, se houver, setorial), com substitutos, considerando a formação, a complexidade do objeto e a carga de contratos de cada um, e dê ciência prévia a eles (Lei 14.133, arts. 7º e 117; Decreto 11.246/2022, arts. 8º a 10). O fiscal pode ser auxiliado por terceiro contratado, que não o substitui (art. 117, § 4º).',
            acoes: [
                A.formulario('Registrar a equipe do contrato', [
                    { id: 'gestor', rotulo: 'Gestor do contrato', tipo: 'texto', obrigatorio: true },
                    { id: 'fiscal_tecnico', rotulo: 'Fiscal técnico', tipo: 'texto', obrigatorio: true },
                    { id: 'fiscal_adm', rotulo: 'Fiscal administrativo', tipo: 'texto' },
                    { id: 'fiscal_setorial', rotulo: 'Fiscal setorial', tipo: 'texto' },
                    { id: 'substitutos', rotulo: 'Substitutos', tipo: 'texto_longo' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.fazer('Dar ciência prévia e formal aos designados', { obrigatoria: true }),
                A.documento('Juntar a portaria de designação', 'Portaria', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Início da execução', unidade: 'Gestão do contrato', vai: ['Execução e fiscalização'],
            orientacao: 'A contratada indica o preposto, aceito pela Administração, para representá-la na execução (art. 118). Faça a reunião inicial com gestor, fiscais e preposto, apresente o plano de fiscalização, confira a matriz de riscos e emita a ordem de serviço ou de fornecimento. Ninguém pode retardar a ordem de serviço por falta de tramitação interna quando o contrato já está em vigor (art. 115, § 1º).',
            acoes: [
                A.documento('Juntar a indicação do preposto', 'Ofício', { forma: 'juntar' }),
                A.audiencia('Designar a reunião inicial', 'reuniao', { obrigatoria: true }),
                A.comunicar('Convocar a contratada para a reunião inicial', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Compareça, com o preposto, à reunião inicial do contrato em {audiencia}.' }, { obrigatoria: true }),
                A.documento('Juntar a ata da reunião e o plano de fiscalização', 'Ata', { forma: 'redigir' }),
                A.documento('Juntar a ordem de serviço ou de fornecimento', 'Ordem de serviço', { forma: 'redigir' }),
                A.data('Data de início da execução', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Execução e fiscalização', unidade: 'Fiscalização do contrato', nome_publico: 'Fiscalização do período',
            vai: ['Ateste e recebimento', 'Notificação para correção', 'Extinção antecipada'],
            condicoes: { 'Extinção antecipada': 'Falta grave que justifica extinguir o contrato desde já.' },
            orientacao: 'A cada período (ou etapa, no contrato por escopo), anote as ocorrências no registro próprio e determine a regularização das falhas (art. 117, § 1º). Com dedicação exclusiva de mão de obra, confira as obrigações trabalhistas, previdenciárias e o FGTS: a falha nessa fiscalização pode levar à responsabilidade da Administração (art. 121, §§ 2º e 3º). Emita o relatório e o termo de recebimento provisório (art. 140, I, "a", e II, "a"). O que passar da sua competência, leve ao gestor a tempo (art. 117, § 2º).',
            acoes: [
                A.formulario('Registrar a medição do período', [
                    { id: 'periodo', rotulo: 'Período ou etapa de referência', tipo: 'texto', obrigatorio: true },
                    { id: 'valor_previsto', rotulo: 'Valor previsto (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'valor_medido', rotulo: 'Valor medido (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'glosa', rotulo: 'Glosa proposta (R$)', tipo: 'numero' },
                    { id: 'motivo_glosa', rotulo: 'Motivo da glosa', tipo: 'texto_longo' },
                    { id: 'ocorrencias', rotulo: 'Ocorrências no período', tipo: 'numero' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.fazer('Anotar as ocorrências no registro próprio', { obrigatoria: true }),
                A.simNao('Contrato com dedicação exclusiva de mão de obra?', { obrigatoria: true }),
                A.documento('Juntar a conferência das obrigações trabalhistas, previdenciárias e do FGTS', 'Relatório', { forma: 'juntar', se: quando('Contrato com dedicação exclusiva de mão de obra?', 'sim') }),
                A.escolha('Execução do período', ['Conforme', 'Conforme com glosa', 'Não conforme'], { obrigatoria: true, ajuda: 'Conforme: recebimento integral. Com glosa: desconto proporcional ao que faltou. Não conforme: falha que impede o recebimento e exige correção.' }),
                A.documento('Juntar o relatório de fiscalização', 'Relatório', { forma: 'redigir' }),
                A.documento('Juntar o termo de recebimento provisório', 'Termo de recebimento', { forma: 'redigir', se: quando('Execução do período', 'Conforme', 'Conforme com glosa') }),
            ],
            saidas: { 'Ateste e recebimento': quando('Execução do período', 'Conforme', 'Conforme com glosa'), 'Notificação para correção': quando('Execução do período', 'Não conforme') },
        },
        {
            nome: 'Notificação para correção', unidade: 'Fiscalização do contrato', avanco: 'auto', nome_publico: 'Correção da execução',
            vai: ['Execução e fiscalização', 'Remessa a processo de apuração'], ao_entrar: { pendencia: 'Contratada notificada para corrigir a execução do contrato.' },
            orientacao: 'Notifique por escrito, com as cláusulas descumpridas e o prazo para corrigir. A contratada é obrigada a reparar, corrigir, remover ou substituir, à sua custa, o que tiver vício ou defeito (art. 119). Corrigida a falha, o período volta à fiscalização; se persistir, o caso vai a processo derivado de apuração.',
            acoes: [
                A.comunicar('Notificar a contratada para corrigir', { especie: 'notificacao', polos: ['requerido'], dias: 5, texto: 'Fica notificada a corrigir as falhas na execução do contrato, descritas a seguir, ou a se manifestar no prazo indicado.' }, { obrigatoria: true, ajuda: 'A lei não fixa o prazo de correção: ajuste ao contrato ou à gravidade da falha.' }),
                A.esperar('Aguardar a correção ou a manifestação', 'Notificar a contratada para corrigir', { obrigatoria: true }),
                A.simNao('A contratada corrigiu a falha?', { obrigatoria: true }),
            ],
            saidas: { 'Execução e fiscalização': quando('A contratada corrigiu a falha?', 'sim'), 'Remessa a processo de apuração': quando('A contratada corrigiu a falha?', 'nao') },
        },
        {
            nome: 'Remessa a processo de apuração', unidade: 'Gestão do contrato', avanco: 'auto', vai: ['Ateste e recebimento'],
            orientacao: 'A sanção não se aplica neste processo. Abra o processo derivado ("Novo processo derivado deste", tipo com o modelo "Infração contratual e sanção a fornecedor"): advertência, multa de 0,5% a 30% do valor do contrato, impedimento de licitar e contratar por até 3 anos ou declaração de inidoneidade de 3 a 6 anos (art. 156), com defesa de 15 dias úteis (arts. 157 e 158) e recurso (arts. 166 e 167). Multa de mora pode ser descontada da garantia ou dos pagamentos, depois de assegurada a defesa (art. 162). Aqui, o período segue para o ateste com as glosas cabíveis.',
            acoes: [
                A.documento('Juntar o relatório do descumprimento', 'Relatório', { forma: 'redigir' }),
                A.escolha('Infração apontada (art. 155)', ['Inexecução parcial', 'Inexecução parcial com grave dano', 'Inexecução total', 'Atraso injustificado', 'Documento ou declaração falsa', 'Fraude ou ato lesivo', 'Outra'], { obrigatoria: true }),
                A.derivado('Abrir o processo derivado de apuração', 'Infração contratual e sanção a fornecedor', { obrigatoria: true, ajuda: 'O botão da ação abre o novo processo já ligado a este; criado, a ação se cumpre sozinha.' }),
                A.texto('Número do processo de apuração', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Ateste e recebimento', unidade: 'Gestão do contrato', vai: ['Liquidação e pagamento', 'Notificação para correção'],
            orientacao: 'Analise os relatórios dos fiscais e emita o termo de recebimento definitivo do período, que comprova o atendimento das exigências (art. 140, I, "b"). Autorize a nota fiscal no valor medido, já com as glosas. Havendo controvérsia sobre parte do valor, a parcela incontroversa é liberada no prazo (art. 143). A contratada pode contestar a glosa; decida em até 1 mês, prorrogável uma vez por igual período (art. 123).',
            acoes: [
                A.fazer('Analisar os relatórios dos fiscais', { obrigatoria: true }),
                A.escolha('Resultado do ateste', ['Ateste integral', 'Ateste com glosa', 'Não atestar'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o termo de recebimento definitivo do período', 'Termo de recebimento', { forma: 'redigir', se: quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa') }),
                A.comunicar('Notificar a contratada do valor a faturar e das glosas', { especie: 'notificacao', polos: ['requerido'], dias: 5, texto: 'Emita a nota fiscal no valor indicado, já descontadas as glosas. Querendo, conteste a glosa no prazo.' }, { se: quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa') }),
                A.esperar('Aguardar a nota fiscal ou a contestação', 'Notificar a contratada do valor a faturar e das glosas', { se: quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa') }),
                A.simNao('A contratada contestou a glosa?', { se: quando('Aguardar a nota fiscal ou a contestação', 'Apresentada', 'Parcial') }),
                A.textoLongo('Decisão fundamentada sobre a contestação', { se: quando('A contratada contestou a glosa?', 'sim') }),
            ],
            saidas: { 'Liquidação e pagamento': quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa'), 'Notificação para correção': quando('Resultado do ateste', 'Não atestar') },
        },
        {
            nome: 'Liquidação e pagamento', unidade: 'Setor financeiro', prazo_dias: 20, prazo_auto: true,
            vai: ['Execução e fiscalização', 'Termo aditivo: instrução', 'Apostila', 'Prorrogação da vigência', 'Reequilíbrio econômico-financeiro', 'Subcontratação ou mudança na contratada', 'Solução de controvérsia', 'Extinção antecipada', 'Recebimento definitivo do objeto'],
            orientacao: 'Liquide apurando origem, valor exato e credor (Lei 4.320, art. 63) e pague na ordem cronológica de exigibilidade, por fonte de recurso; alterar a ordem exige justificativa publicada (Lei 14.133, art. 141). Na União, liquidação em até 10 dias úteis da nota e pagamento em até 10 dias úteis da liquidação (IN SEGES 77/2022). A perda da regularidade fiscal leva à notificação, mas não autoriza reter o pagamento pelo que foi executado. É vedado pagamento antecipado, salvo as exceções do art. 145. Ao fim, diga por onde o contrato segue: é aqui que nascem os eventos do contrato.',
            acoes: [
                A.documento('Juntar a nota fiscal', 'Nota fiscal', { forma: 'juntar' }),
                A.fazer('Liquidar a despesa: origem, valor exato e credor', { obrigatoria: true }),
                A.simNao('Habilitação e regularidade fiscal mantidas?', { obrigatoria: true }),
                A.comunicar('Notificar a contratada para regularizar a situação fiscal', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Regularize sua situação fiscal, condição de habilitação a ser mantida durante todo o contrato.' }, { se: quando('Habilitação e regularidade fiscal mantidas?', 'nao') }),
                A.fazer('Conferir a posição na ordem cronológica de pagamentos', { obrigatoria: true }),
                A.formulario('Registrar o pagamento', [
                    { id: 'valor_pago', rotulo: 'Valor pago (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'retencoes', rotulo: 'Retenções (R$)', tipo: 'numero' },
                    { id: 'data_pagamento', rotulo: 'Data do pagamento', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o comprovante de pagamento', 'Comprovante de pagamento', { forma: 'juntar' }),
                A.escolha('Como o contrato segue', SEGUE, { obrigatoria: true, ajuda: 'Próximo período: volta à fiscalização. Os demais abrem o evento e, ao fim dele, o contrato volta à fiscalização.' }),
            ],
            saidas: {
                'Execução e fiscalização': quando('Como o contrato segue', 'Próximo período'),
                'Termo aditivo: instrução': quando('Como o contrato segue', 'Termo aditivo'),
                Apostila: quando('Como o contrato segue', 'Apostila'),
                'Prorrogação da vigência': quando('Como o contrato segue', 'Prorrogação da vigência'),
                'Reequilíbrio econômico-financeiro': quando('Como o contrato segue', 'Reequilíbrio econômico-financeiro'),
                'Subcontratação ou mudança na contratada': quando('Como o contrato segue', 'Subcontratação ou mudança na contratada'),
                'Solução de controvérsia': quando('Como o contrato segue', 'Controvérsia com a contratada'),
                'Extinção antecipada': quando('Como o contrato segue', 'Extinção antecipada'),
                'Recebimento definitivo do objeto': quando('Como o contrato segue', 'Objeto concluído ou fim da vigência'),
            },
        },
        {
            nome: 'Termo aditivo: instrução', unidade: 'Gestão do contrato', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Parecer jurídico'],
            orientacao: 'Justifique a alteração (art. 124). Unilateral: qualitativa, para melhor adequação técnica, ou quantitativa, nos limites do art. 125 (acréscimos ou supressões de até 25% do valor inicial atualizado; até 50% de acréscimo em reforma de edifício ou equipamento). Por acordo: substituição da garantia, mudança do regime de execução, da forma de pagamento ou supressão acima de 25% (art. 124, II, e art. 125). A alteração não pode transfigurar o objeto (art. 126). Se mudar os encargos da contratada, o equilíbrio se restabelece no mesmo termo (art. 130). Ouça a contratada antes do parecer.',
            acoes: [
                A.escolha('Espécie de alteração', ['Unilateral qualitativa', 'Unilateral quantitativa', 'Por acordo: substituição da garantia', 'Por acordo: regime de execução', 'Por acordo: forma de pagamento', 'Por acordo: supressão acima de 25%'], { obrigatoria: true }),
                A.documento('Juntar a justificativa técnica e o orçamento', 'Justificativa', { forma: 'redigir' }),
                A.formulario('Registrar o impacto da alteração', [
                    { id: 'valor_inicial', rotulo: 'Valor inicial atualizado (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'acrescimo', rotulo: 'Acréscimo (R$)', tipo: 'numero' },
                    { id: 'supressao', rotulo: 'Supressão (R$)', tipo: 'numero' },
                    { id: 'percentual', rotulo: 'Variação acumulada (%)', tipo: 'numero', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.simNao('Dentro dos limites do art. 125?', { obrigatoria: true, ajuda: 'Fora dos limites, só por acordo e apenas para supressão.' }),
                A.simNao('Há disponibilidade orçamentária?', { obrigatoria: true }),
                A.comunicar('Ouvir a contratada sobre a alteração', { especie: 'notificacao', polos: ['requerido'], dias: 10, texto: 'Manifeste-se, no prazo, sobre a alteração do contrato descrita a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a manifestação da contratada', 'Ouvir a contratada sobre a alteração', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Apostila', unidade: 'Setor de contratos', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Execução e fiscalização'],
            orientacao: 'Dispensa termo aditivo e se registra por simples apostila (art. 136): variação do valor por reajuste ou repactuação previstos no contrato; atualização, compensação ou encargo financeiro por atraso de pagamento; mudança de razão ou denominação social; empenho de dotação orçamentária suplementar. O reajuste e a repactuação exigem interregno mínimo de 1 ano, contado do orçamento estimado ou, na mão de obra, do acordo ou convenção coletiva (arts. 25, § 7º, 92, § 3º, e 135); responda preferencialmente em 1 mês (art. 92, § 6º).',
            acoes: [
                A.escolha('Hipótese do art. 136', ['Reajuste por índice', 'Repactuação', 'Atualização, compensação ou encargo por atraso', 'Mudança de razão ou denominação social', 'Empenho de dotação orçamentária'], { obrigatoria: true }),
                A.simNao('Cumprido o interregno mínimo de 1 ano?', { obrigatoria: true, se: quando('Hipótese do art. 136', 'Reajuste por índice', 'Repactuação') }),
                A.documento('Juntar o pedido com a planilha de custos e o instrumento coletivo', 'Requerimento', { forma: 'juntar', se: quando('Hipótese do art. 136', 'Repactuação') }),
                A.formulario('Registrar o cálculo', [
                    { id: 'data_base', rotulo: 'Data-base', tipo: 'data' },
                    { id: 'indice', rotulo: 'Índice ou instrumento', tipo: 'texto' },
                    { id: 'percentual', rotulo: 'Variação (%)', tipo: 'numero' },
                    { id: 'valor_novo', rotulo: 'Valor novo (R$)', tipo: 'numero' },
                ], { se: quando('Hipótese do art. 136', 'Reajuste por índice', 'Repactuação', 'Atualização, compensação ou encargo por atraso'), destino: 'informacao', folha_dados: true }),
                A.escolha('Decisão', ['Deferido', 'Deferido em parte', 'Indeferido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a apostila', 'Apostila', { forma: 'redigir', se: quando('Decisão', 'Deferido', 'Deferido em parte') }),
                A.comunicar('Comunicar a apostila à contratada', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Comunicamos o registro por apostila no contrato, a seguir.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Prorrogação da vigência', unidade: 'Gestão do contrato', vai: ['Parecer jurídico', 'Execução e fiscalização'],
            orientacao: 'Serviço e fornecimento contínuos: vigência de até 5 anos, prorrogável até 10 anos no total, se previsto no edital e se a autoridade atestar que as condições e os preços continuam vantajosos (arts. 106 e 107). Contrato por escopo: o prazo se prorroga automaticamente quando o objeto não é concluído no período, e a culpa da contratada leva a apuração (art. 111). Abra o pedido com antecedência e renove a garantia. Sem prorrogação, o contrato vai até o fim da vigência.',
            acoes: [
                A.escolha('Hipótese', ['Serviço ou fornecimento contínuo (arts. 106 e 107)', 'Contrato por escopo (art. 111)', 'Outra prevista em lei (arts. 108 a 110)'], { obrigatoria: true }),
                A.simNao('Há previsão de prorrogação no edital e no contrato?', { obrigatoria: true, se: quando('Hipótese', 'Serviço ou fornecimento contínuo (arts. 106 e 107)', 'Outra prevista em lei (arts. 108 a 110)') }),
                A.documento('Juntar a pesquisa de vantajosidade e o ateste da autoridade', 'Relatório', { forma: 'qualquer', se: quando('Hipótese', 'Serviço ou fornecimento contínuo (arts. 106 e 107)') }),
                A.comunicar('Consultar a contratada sobre a prorrogação', { especie: 'comunicacao', polos: ['requerido'], dias: 10, texto: 'Manifeste, no prazo, se concorda com a prorrogação do contrato nas condições indicadas.' }, { obrigatoria: true }),
                A.esperar('Aguardar a anuência da contratada', 'Consultar a contratada sobre a prorrogação', { obrigatoria: true }),
                A.data('Novo fim da vigência', { obrigatoria: true }),
                A.simNao('Prorrogação vantajosa e com anuência da contratada?', { obrigatoria: true }),
            ],
            saidas: { 'Parecer jurídico': quando('Prorrogação vantajosa e com anuência da contratada?', 'sim'), 'Execução e fiscalização': quando('Prorrogação vantajosa e com anuência da contratada?', 'nao') },
        },
        {
            nome: 'Reequilíbrio econômico-financeiro', unidade: 'Gestão do contrato', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Parecer jurídico', 'Execução e fiscalização'],
            orientacao: 'Cabe por acordo para restabelecer o equilíbrio diante de fato imprevisível, ou previsível de consequências incalculáveis, força maior, caso fortuito ou fato do príncipe, respeitada a matriz de riscos (arts. 103 e 124, II, "d"); também na criação ou alteração de tributo depois da proposta (art. 134). A parte apresenta pedido fundamentado; a decisão sai em até 1 mês da instrução, prorrogável uma vez (art. 123). O pedido deve ser feito durante a vigência, mesmo que a decisão venha depois (art. 131).',
            acoes: [
                A.documento('Juntar o pedido fundamentado e as provas', 'Requerimento', { forma: 'juntar' }),
                A.simNao('O risco estava alocado à contratada na matriz de riscos?', { obrigatoria: true, ajuda: 'Se sim, o pedido não procede.' }),
                A.documento('Juntar a análise técnica e de custos', 'Nota técnica', { forma: 'redigir' }),
                A.numero('Variação proposta (R$)'),
                A.escolha('Decisão', ['Deferido', 'Deferido em parte', 'Indeferido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.comunicar('Comunicar a decisão à contratada', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Comunicamos a decisão sobre o pedido de reequilíbrio econômico-financeiro, a seguir.' }, { obrigatoria: true }),
            ],
            saidas: { 'Parecer jurídico': quando('Decisão', 'Deferido', 'Deferido em parte'), 'Execução e fiscalização': quando('Decisão', 'Indeferido') },
        },
        {
            nome: 'Subcontratação ou mudança na contratada', unidade: 'Gestão do contrato', vai: ['Parecer jurídico', 'Execução e fiscalização', 'Extinção antecipada'],
            orientacao: 'A subcontratação de partes da obra, do serviço ou do fornecimento só vale até o limite autorizado pela Administração, com a contratada respondendo pelo todo e comprovando a capacidade técnica do subcontratado; é vedada a de parente ou de pessoa ligada a quem participa da contratação (art. 122). Fusão, cisão, incorporação ou alteração social só mantêm o contrato se não prejudicarem a execução e se forem mantidas as condições de habilitação (art. 137, VI). Mudança só de razão social é apostila.',
            acoes: [
                A.escolha('Situação', ['Pedido de subcontratação', 'Fusão, cisão ou incorporação', 'Alteração social ou modificação da finalidade'], { obrigatoria: true }),
                A.documento('Juntar o pedido e os documentos', 'Requerimento', { forma: 'juntar' }),
                A.simNao('Mantidas a habilitação e a capacidade técnica, sem prejuízo à execução?', { obrigatoria: true }),
                A.escolha('Decisão', ['Autorizar', 'Não autorizar', 'Extinguir o contrato'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.comunicar('Comunicar a decisão à contratada', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Comunicamos a decisão sobre o pedido a seguir.' }, { obrigatoria: true }),
            ],
            saidas: { 'Parecer jurídico': quando('Decisão', 'Autorizar'), 'Execução e fiscalização': quando('Decisão', 'Não autorizar'), 'Extinção antecipada': quando('Decisão', 'Extinguir o contrato') },
        },
        {
            nome: 'Solução de controvérsia', unidade: 'Gabinete', vai: ['Execução e fiscalização', 'Termo aditivo: instrução', 'Extinção antecipada'],
            orientacao: 'Divergência sobre direitos patrimoniais disponíveis (reequilíbrio, inadimplemento, cálculo de indenização) pode ir à conciliação, à mediação, ao comitê de resolução de disputas ou à arbitragem, sempre de direito e pública (arts. 151 a 154). A escolha dos árbitros e dos membros do comitê segue critérios isonômicos, técnicos e transparentes. O acordo que muda o contrato vira termo aditivo.',
            acoes: [
                A.escolha('Meio escolhido', ['Conciliação', 'Mediação', 'Comitê de resolução de disputas', 'Arbitragem'], { obrigatoria: true }),
                A.documento('Juntar a delimitação da controvérsia', 'Nota técnica', { forma: 'redigir' }),
                A.audiencia('Designar a sessão de conciliação ou mediação', 'conciliacao', { se: quando('Meio escolhido', 'Conciliação', 'Mediação') }),
                A.comunicar('Convidar a contratada', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Fica convidada para a sessão de solução consensual em {audiencia}.' }, { se: quando('Meio escolhido', 'Conciliação', 'Mediação') }),
                A.documento('Juntar o termo de acordo, o parecer do comitê ou a sentença arbitral', 'Termo', { forma: 'juntar' }),
                A.escolha('Resultado', ['Acordo sem mudar o contrato', 'Acordo que muda o contrato', 'Sem acordo: extinguir', 'Sem acordo: manter'], { obrigatoria: true, destino: 'autos', partes: true }),
            ],
            saidas: {
                'Execução e fiscalização': quando('Resultado', 'Acordo sem mudar o contrato', 'Sem acordo: manter'),
                'Termo aditivo: instrução': quando('Resultado', 'Acordo que muda o contrato'),
                'Extinção antecipada': quando('Resultado', 'Sem acordo: extinguir'),
            },
        },
        {
            nome: 'Parecer jurídico', unidade: 'Assessoria jurídica', avanco: 'auto', vai: ['Termo aditivo: assinatura e publicação'],
            orientacao: 'Examine a minuta do termo aditivo e a instrução: previsão contratual, limites legais, vantajosidade, disponibilidade orçamentária e regularidade (art. 53, § 4º).',
            acoes: [A.documento('Juntar o parecer jurídico', 'Parecer', { forma: 'redigir' })],
        },
        {
            nome: 'Termo aditivo: assinatura e publicação', unidade: 'Setor de contratos', prazo_dias: 20, prazo_auto: true, avanco: 'auto', vai: ['Execução e fiscalização'],
            orientacao: 'O termo aditivo é condição para executar a prestação alterada; só em necessidade justificada a execução se antecipa, com formalização em até 1 mês (art. 132). Confira a regularidade fiscal, colha as assinaturas, ajuste a garantia e divulgue no PNCP nos prazos do art. 94.',
            acoes: [
                A.fazer('Conferir a regularidade fiscal da contratada', { obrigatoria: true }),
                A.comunicar('Convocar a contratada para assinar o termo aditivo', { especie: 'comunicacao', polos: ['requerido'], dias: 5, texto: 'Assine o termo aditivo disponibilizado e, se for o caso, complemente a garantia.' }, { obrigatoria: true }),
                A.documento('Juntar o termo aditivo assinado', 'Termo aditivo', { forma: 'juntar' }),
                A.fazer('Ajustar ou renovar a garantia, se for o caso'),
                A.data('Data da divulgação do aditivo no PNCP', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Extinção antecipada', unidade: 'Gabinete', vai: ['Recebimento definitivo do objeto', 'Execução e fiscalização'], nome_publico: 'Extinção do contrato',
            orientacao: 'Os motivos estão no art. 137 (inexecução, atraso, falência, razões de interesse público, caso fortuito e outros) e a contratada tem direito à extinção, por exemplo, se a Administração atrasar pagamentos por mais de 2 meses (art. 137, § 2º). A extinção é unilateral, consensual ou por decisão arbitral ou judicial (art. 138). A unilateral exige motivação, contraditório e ampla defesa; dela cabe recurso em 3 dias úteis (art. 165, I, "e"). Pode haver assunção do objeto, ocupação de bens, execução da garantia e retenção de créditos (art. 139). A infração que motivou a extinção é apurada em processo derivado.',
            acoes: [
                A.escolha('Forma de extinção', ['Unilateral pela Administração', 'Consensual', 'Pedida pela contratada', 'Decisão arbitral ou judicial'], { obrigatoria: true }),
                A.documento('Juntar o relatório motivado do gestor', 'Relatório', { forma: 'redigir' }),
                A.comunicar('Intimar a contratada para defesa', { especie: 'intimacao', polos: ['requerido'], dias: 5, texto: 'Apresente defesa sobre a extinção do contrato, pelos motivos expostos no relatório anexo.' }, { se: quando('Forma de extinção', 'Unilateral pela Administração'), ajuda: 'A lei não fixa o prazo da defesa: ajuste ao contrato ou ao regulamento do órgão.' }),
                A.esperar('Aguardar a defesa', 'Intimar a contratada para defesa', { se: quando('Forma de extinção', 'Unilateral pela Administração') }),
                A.documento('Juntar a decisão motivada ou o termo de acordo', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 3, texto: 'Fica intimada da decisão sobre a extinção do contrato. Cabe recurso em 3 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar da decisão', { obrigatoria: true }),
                A.documento('Juntar a decisão do recurso', 'Decisão', { forma: 'redigir', se: quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial') }),
                A.escolha('Medidas do art. 139', ['Nenhuma', 'Assunção do objeto e ocupação de bens', 'Execução da garantia', 'Retenção de créditos', 'Mais de uma'], { se: quando('Forma de extinção', 'Unilateral pela Administração') }),
                A.escolha('Resultado final', ['Contrato extinto', 'Contrato mantido'], { obrigatoria: true, destino: 'autos', partes: true }),
            ],
            saidas: { 'Recebimento definitivo do objeto': quando('Resultado final', 'Contrato extinto'), 'Execução e fiscalização': quando('Resultado final', 'Contrato mantido') },
        },
        {
            nome: 'Recebimento definitivo do objeto', unidade: 'Gestão do contrato', vai: ['Avaliação de desempenho da contratada'],
            orientacao: 'Por conclusão, fim da vigência ou extinção. Emita o termo de recebimento definitivo do objeto, ou do que foi executado até a extinção, com o balanço financeiro (art. 140). O recebimento não exclui a responsabilidade civil pela solidez e segurança da obra nem a ético-profissional; em obra, a contratada responde pelos vícios por no mínimo 5 anos (art. 140, §§ 2º e 6º).',
            acoes: [
                A.documento('Juntar o relatório final do gestor', 'Relatório', { forma: 'redigir' }),
                A.documento('Juntar o termo de recebimento definitivo do objeto', 'Termo de recebimento', { forma: 'redigir' }),
                A.numero('Valor total executado (R$)', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Avaliação de desempenho da contratada', unidade: 'Gestão do contrato', vai: ['Encerramento e liberação da garantia'],
            orientacao: 'A atuação da contratada no cumprimento das obrigações é avaliada e registrada no cadastro de fornecedores, com indicadores objetivos, e serve de atestado de desempenho em contratações futuras (art. 88, §§ 3º e 4º). Dê ciência da avaliação à contratada, que pode pedir revisão.',
            acoes: [
                A.escolha('Conceito final', ['Ótimo', 'Bom', 'Regular', 'Ruim'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o relatório de avaliação de desempenho', 'Relatório', { forma: 'redigir' }),
                A.fazer('Registrar a avaliação no cadastro de fornecedores', { obrigatoria: true }),
                A.comunicar('Dar ciência da avaliação à contratada', { especie: 'comunicacao', polos: ['requerido'], dias: 5, texto: 'Comunicamos a avaliação de desempenho na execução do contrato, a seguir. Querendo, peça revisão no prazo.' }, { obrigatoria: true }),
                A.esperar('Aguardar o pedido de revisão', 'Dar ciência da avaliação à contratada', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Encerramento e liberação da garantia', unidade: 'Gestão do contrato', vai: ['Arquivamento'], nome_publico: 'Encerramento do contrato',
            orientacao: 'A garantia é liberada ou restituída depois da fiel execução, atualizada se em dinheiro, e só depois de quitadas glosas, multas e, com mão de obra, as verbas trabalhistas (art. 100). Faça o termo de encerramento e comunique a contratada.',
            acoes: [
                A.simNao('Há garantia a liberar?', { obrigatoria: true }),
                A.simNao('Quitadas glosas, multas e verbas trabalhistas?', { obrigatoria: true, se: quando('Há garantia a liberar?', 'sim') }),
                A.documento('Juntar a liberação da garantia', 'Despacho', { forma: 'qualquer', se: quando('Há garantia a liberar?', 'sim') }),
                A.documento('Juntar o termo de encerramento', 'Termo de encerramento', { forma: 'redigir' }),
                A.comunicar('Comunicar o encerramento à contratada', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Comunicamos o encerramento do contrato e o recebimento definitivo do objeto.' }, { obrigatoria: true }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

export const modelos = [gestaoContratualCompleta];
