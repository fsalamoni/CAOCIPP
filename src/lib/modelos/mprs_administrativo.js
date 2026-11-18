// Administração do MPRS: gestão de contratos, apuração de descumprimento
// contratual e bens móveis, pelas normas internas (Provimentos 104/2023,
// 05/2023, 55/2022 e 02/2009 da PGJ) sobre a Lei 14.133/2021. As unidades, as
// autoridades e os prazos são os dos provimentos; onde eles se calam, vale a
// lei, e a orientação da fase diz qual. Nada aqui é de natureza criminal: as
// sanções são administrativas. Pesquisa e fontes em docs/MODELOS_DE_RITO.md.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';
const CERTIDOES = 'FGTS, Receita Federal, Receita Estadual do RS e da sede, Receita Municipal, débitos trabalhistas (CNDT), CADIN/RS, CFIL/RS e CEIS';
const SEGUE = ['Próximo período', 'Alteração do contrato', 'Prorrogação da vigência', 'Reajuste por apostila', 'Verificação anual da habilitação', 'Extinção do contrato', 'Objeto concluído ou fim da vigência'];

/** 53. Gestão de contrato no MPRS, do empenho ao encerramento (Provimentos 104/2023 e 05/2023-PGJ). */
export function gestaoContratualMprs() {
    return montar({
        id: 'gestao-contratual-mprs', nome: 'Gestão de contrato no MPRS: do empenho ao encerramento', area: 'contratacoes', porte: 'longo', referencia: 'MPRS',
        descricao: 'O contrato do Ministério Público do RS como os provimentos internos mandam: a Assessoria de Planejamento e Orçamento empenha; a Unidade de Contratos formaliza, colhe a assinatura eletrônica, publica a designação do gestor e dos fiscais e o extrato no Diário Eletrônico, cadastra no Licitacon do TCE e confere o PNCP; o gestor notifica o início e o fiscal técnico emite a ordem de serviço ou de fornecimento. A cada período o fiscal registra a execução e o recebimento provisório, o gestor atesta e manda ao Setor Financeiro com a lista de checagem e as certidões. Do pagamento o contrato segue para o período seguinte ou para um evento: alteração (com aval do coordenador, análise orçamentária, parecer e minuta da Unidade de Assessoramento Jurídico e aprovação do Diretor-Geral), prorrogação pedida 45 dias antes do fim, reajuste por apostila (IPCA ou INCC-DI), verificação anual da habilitação e extinção. O descumprimento vira processo derivado, instaurado pelo fiscal. No fim, recebimento definitivo, relatório final com boas práticas e liberação da garantia. A contratada é chamada a assinar, corrigir, regularizar certidões, anuir e se defender.',
        quando: 'Contratos do MPRS regidos pela Lei 14.133/2021 (e, no que couber, os antigos da Lei 8.666). Abra um processo por contrato, logo depois da homologação ou da ratificação. Outro órgão estadual pode usar trocando as unidades e conferindo o próprio regulamento. Ligue o painel e a planilha para ver todos os contratos, as vigências e os pagamentos num quadro.',
        base: 'Provimento 104/2023-PGJ, arts. 13, 15, 17, 18 e 52 a 100 (com os Provimentos 6/2024, 34/2025, 41/2025 e 73/2025); Provimento 05/2023-PGJ, arts. 4º, 8º, 12 e 18 a 26; Provimento 03/2023-PGJ (governança das contratações); Lei 14.133/2021, arts. 89 a 147; Resolução CNMP 264/2023. O Provimento 104 não fixa percentual de garantia, prazos de recebimento e de pagamento em dias nem trata de subcontratação e repactuação: nesses pontos valem o contrato e a lei.',
        tipo: { polos: ['requerente', 'requerido'], nomes_polos: { requerente: 'Ministério Público', requerido: 'Contratada' } },
    }, [
        {
            nome: 'Empenho', unidade: 'Assessoria de Planejamento e Orçamento', vai: ['Formalização e assinatura', 'Início da execução'],
            orientacao: 'A Assessoria de Planejamento e Orçamento atesta os créditos orçamentários (Lei 14.133, arts. 105 e 106, II) e providencia o empenho junto à Seccional da Contadoria e Auditoria-Geral do Estado (Prov. 104, art. 52). A nota de empenho pode substituir o termo de contrato nos valores de dispensa e nas contratações imediatas e integrais, de até 30 dias, sem obrigações futuras; nunca em serviço ou fornecimento continuado (art. 15). Nesse caso revalide aqui CADIN/RS, CFIL/RS e CEIS (irregularidade impede o ato) e o fiscal faz as vezes de gestor (art. 99).',
            acoes: [
                A.formulario('Registrar os dados da contratação', [
                    { id: 'numero', rotulo: 'Número do contrato ou da nota de empenho', tipo: 'texto', obrigatorio: true },
                    { id: 'pgea', rotulo: 'Procedimento no SIM (PGEA)', tipo: 'texto', obrigatorio: true },
                    { id: 'contratada', rotulo: 'Contratada (nome e CNPJ ou CPF)', tipo: 'texto', obrigatorio: true },
                    { id: 'objeto', rotulo: 'Objeto', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'origem', rotulo: 'Origem da contratação', tipo: 'lista', opcoes: ['Pregão', 'Concorrência', 'Dispensa', 'Inexigibilidade', 'Adesão a ata de registro de preços'], obrigatorio: true },
                    { id: 'categoria', rotulo: 'Categoria do contrato', tipo: 'lista', opcoes: ['Serviço contínuo', 'Serviço contínuo com dedicação exclusiva de mão de obra', 'Serviço por escopo', 'Fornecimento contínuo', 'Fornecimento com entrega única ou parcelada', 'Obra, reforma ou manutenção predial'], obrigatorio: true },
                    { id: 'setor', rotulo: 'Setor solicitante', tipo: 'texto', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor global (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'inicio', rotulo: 'Início da vigência', tipo: 'data' },
                    { id: 'fim', rotulo: 'Fim da vigência', tipo: 'data' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.fazer('Atestar os créditos orçamentários', { obrigatoria: true }),
                A.documento('Juntar a nota de empenho', 'Nota de empenho', { forma: 'juntar' }),
                A.escolha('Instrumento', ['Termo de contrato', 'Nota de empenho no lugar do contrato'], { obrigatoria: true, ajuda: 'Nota de empenho: só nas hipóteses do art. 15 do Provimento 104/2023.' }),
                A.fazer('Revalidar CADIN/RS, CFIL/RS e CEIS', { obrigatoria: true, se: quando('Instrumento', 'Nota de empenho no lugar do contrato') }),
            ],
            saidas: { 'Formalização e assinatura': quando('Instrumento', 'Termo de contrato'), 'Início da execução': quando('Instrumento', 'Nota de empenho no lugar do contrato') },
        },
        {
            nome: 'Formalização e assinatura', unidade: 'Unidade de Contratos', nome_publico: 'Assinatura do contrato',
            vai: ['Publicação e cadastros', 'Não assinatura'],
            orientacao: 'A Unidade de Contratos preenche o termo e colhe a assinatura (Prov. 104, art. 53). Antes, confere a validade da regularidade fiscal e trabalhista e revalida CADIN/RS, CFIL/RS e CEIS; irregularidade impede a assinatura. Se o termo de referência exigir garantia, ela é conferida antes da assinatura (art. 53, § 1º); o provimento não fixa percentual: valem o edital e os arts. 96 a 102 da Lei 14.133. A assinatura é eletrônica, com certificado ICP-Brasil ou pela plataforma GOV.BR; outro meio só em caso excepcional justificado (art. 54, na redação do Prov. 73/2025). Em contrato com 25 ou mais trabalhadores em dedicação exclusiva, confira a cláusula de vagas para mulheres em situação de violência doméstica (art. 13, § 3º; Resolução CNMP 264/2023).',
            acoes: [
                A.fazer('Conferir a regularidade fiscal e trabalhista e revalidar CADIN/RS, CFIL/RS e CEIS', { obrigatoria: true }),
                A.simNao('O termo de referência exige garantia?', { obrigatoria: true }),
                A.escolha('Modalidade da garantia', ['Caução em dinheiro ou títulos da dívida pública', 'Seguro-garantia', 'Fiança bancária', 'Título de capitalização'], { obrigatoria: true, se: quando('O termo de referência exige garantia?', 'sim') }),
                A.data('Validade da garantia', { se: quando('O termo de referência exige garantia?', 'sim') }),
                A.documento('Juntar o comprovante da garantia', 'Comprovante', { forma: 'juntar', se: quando('O termo de referência exige garantia?', 'sim') }),
                A.comunicar('Convocar a contratada para assinar', { especie: 'comunicacao', polos: ['requerido'], dias: 5, texto: 'Fica convocada a assinar eletronicamente o contrato, com certificado ICP-Brasil ou pela plataforma GOV.BR, no prazo indicado.' }, { obrigatoria: true, ajuda: 'Use o prazo do edital; 5 dias úteis é só uma sugestão.' }),
                A.esperar('Aguardar a assinatura', 'Convocar a contratada para assinar', { obrigatoria: true }),
                A.simNao('A contratada assinou no prazo?', { obrigatoria: true }),
                A.documento('Juntar o contrato assinado', 'Contrato', { forma: 'juntar', se: quando('A contratada assinou no prazo?', 'sim') }),
            ],
            saidas: { 'Publicação e cadastros': quando('A contratada assinou no prazo?', 'sim'), 'Não assinatura': quando('A contratada assinou no prazo?', 'nao') },
        },
        {
            nome: 'Não assinatura', unidade: 'Unidade de Contratos', vai: ['Formalização e assinatura', 'Arquivamento'],
            orientacao: 'Sem a assinatura, a Assessoria de Planejamento e Orçamento estorna o empenho e a Unidade de Assessoramento Jurídico providencia a invalidação dos atos. Podem ser convocados os remanescentes, na ordem de classificação, ou negociadas as condições (Prov. 104, art. 55, § 1º). A recusa implica descumprimento total e perda da garantia, apurados em processo derivado pela Seção XI do provimento (art. 55, § 2º).',
            acoes: [
                A.documento('Juntar a certidão da recusa ou do decurso do prazo', 'Certidão', { forma: 'redigir' }),
                A.fazer('Pedir o estorno do empenho à Assessoria de Planejamento e Orçamento', { obrigatoria: true }),
                A.fazer('Abrir o processo derivado de descumprimento contratual ("Novo processo derivado deste")', { obrigatoria: true, ajuda: 'Use o tipo de processo com o modelo "Descumprimento contratual no MPRS".' }),
                A.escolha('Providência', ['Convocar o próximo classificado', 'Encerrar a contratação'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Formalização e assinatura': quando('Providência', 'Convocar o próximo classificado'), Arquivamento: quando('Providência', 'Encerrar a contratação') },
        },
        {
            nome: 'Publicação e cadastros', unidade: 'Unidade de Contratos', prazo_dias: 20, prazo_auto: true, avanco: 'auto', vai: ['Início da execução'],
            orientacao: 'A publicação no Diário Eletrônico do Ministério Público e no PNCP é condição de eficácia, e a vigência só começa depois dela (Prov. 104, art. 56). A Unidade de Contratos elabora e publica a portaria de designação do gestor, dos fiscais e dos substitutos, indicados pelo setor solicitante ainda no planejamento (art. 53, II; Prov. 05/2023, arts. 4º e 12), cadastra a contratação no sistema interno e no Licitacon do TCE-RS e confere a disponibilização no PNCP (art. 53, IV a VII). Na lei, o PNCP tem prazo de 20 dias úteis da assinatura, ou 10 na contratação direta (art. 94). Fiscal e gestor não se acumulam, salvo exceção justificada (Prov. 05/2023, art. 8º).',
            acoes: [
                A.formulario('Registrar a equipe do contrato', [
                    { id: 'gestor', rotulo: 'Gestor do contrato', tipo: 'texto', obrigatorio: true },
                    { id: 'fiscal_tecnico', rotulo: 'Fiscal técnico', tipo: 'texto', obrigatorio: true },
                    { id: 'fiscal_setorial', rotulo: 'Fiscal setorial (Promotoria ou setor)', tipo: 'texto' },
                    { id: 'substitutos', rotulo: 'Substitutos', tipo: 'texto_longo' },
                    { id: 'portaria', rotulo: 'Portaria de designação', tipo: 'texto', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.data('Publicação do extrato no Diário Eletrônico do MP', { obrigatoria: true }),
                A.data('Cadastro no Licitacon do TCE-RS', { obrigatoria: true }),
                A.data('Disponibilização no PNCP', { obrigatoria: true }),
                A.documento('Juntar os comprovantes de publicação', 'Comprovante', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Início da execução', unidade: 'Gestão do contrato', vai: ['Execução e fiscalização'],
            orientacao: 'Concluída a formalização, o procedimento vai ao gestor (Prov. 104, art. 57), que notifica a contratada do início da execução (art. 59). Convoque, se for o caso, a reunião inicial com os fiscais e o preposto para apresentar o plano de fiscalização e as sanções aplicáveis (Prov. 05/2023, art. 21, II). O fiscal técnico emite a ordem de serviço ou de fornecimento (art. 22, IX). Atualize o mapa de riscos (art. 21, XX). Com dedicação exclusiva de mão de obra, a Unidade de Fiscalização Administrativa de Serviços Continuados participa desde já (art. 23).',
            acoes: [
                A.comunicar('Notificar a contratada do início da execução', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Fica notificada do início da execução do contrato e a indicar o preposto.' }, { obrigatoria: true }),
                A.audiencia('Designar a reunião inicial', 'reuniao'),
                A.documento('Juntar a ata da reunião e o plano de fiscalização', 'Ata', { forma: 'redigir', nivel: 'recomendado' }),
                A.documento('Juntar a ordem de serviço ou de fornecimento', 'Ordem de serviço', { forma: 'redigir' }),
                A.data('Data de início da execução', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Execução e fiscalização', unidade: 'Fiscalização do contrato', nome_publico: 'Fiscalização do período',
            vai: ['Recebimento e ateste', 'Notificação para correção', 'Extinção do contrato'],
            condicoes: { 'Extinção do contrato': 'Falta grave que justifica extinguir o contrato desde já.' },
            orientacao: 'O fiscal técnico registra as ocorrências, avalia a qualidade pelos critérios do contrato e emite o termo de recebimento provisório (Prov. 05/2023, art. 22). O fiscal setorial informa o que viu na Promotoria ou no setor onde o serviço é prestado (art. 24). Com dedicação exclusiva de mão de obra, a Unidade de Fiscalização Administrativa de Serviços Continuados confere salários, encargos e FGTS e entrega relatório mensal ao gestor (art. 23). Cada documento da execução entra no procedimento em até 5 dias da ocorrência (Prov. 104, art. 63), e os dados de cada etapa são cadastrados para o PNCP e o Portal da Transparência (art. 64). O que passar da sua competência, leve ao gestor.',
            acoes: [
                A.formulario('Registrar a medição do período', [
                    { id: 'periodo', rotulo: 'Período ou etapa de referência', tipo: 'texto', obrigatorio: true },
                    { id: 'valor_previsto', rotulo: 'Valor previsto (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'valor_medido', rotulo: 'Valor medido (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'glosa', rotulo: 'Glosa proposta (R$)', tipo: 'numero' },
                    { id: 'ocorrencias', rotulo: 'Ocorrências no período', tipo: 'numero' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.simNao('Contrato com dedicação exclusiva de mão de obra?', { obrigatoria: true }),
                A.documento('Juntar o relatório mensal da fiscalização administrativa (salários, encargos e FGTS)', 'Relatório', { forma: 'juntar', se: quando('Contrato com dedicação exclusiva de mão de obra?', 'sim') }),
                A.escolha('Execução do período', ['Conforme', 'Conforme com glosa', 'Não conforme'], { obrigatoria: true, ajuda: 'Conforme: recebimento integral. Com glosa: desconto proporcional ao que faltou. Não conforme: falha que impede o recebimento e exige correção.' }),
                A.documento('Juntar o registro de ocorrências e o relatório do fiscal', 'Relatório', { forma: 'redigir' }),
                A.documento('Juntar o termo de recebimento provisório', 'Termo de recebimento', { forma: 'redigir', se: quando('Execução do período', 'Conforme', 'Conforme com glosa') }),
            ],
            saidas: { 'Recebimento e ateste': quando('Execução do período', 'Conforme', 'Conforme com glosa'), 'Notificação para correção': quando('Execução do período', 'Não conforme') },
        },
        {
            nome: 'Notificação para correção', unidade: 'Fiscalização do contrato', avanco: 'auto', nome_publico: 'Correção da execução',
            vai: ['Execução e fiscalização', 'Descumprimento contratual'], ao_entrar: { pendencia: 'Contratada notificada para corrigir a execução do contrato.' },
            orientacao: 'O fiscal técnico notifica a contratada, com prazo para corrigir (Prov. 05/2023, art. 22, IV). O provimento não fixa o prazo: use o do contrato ou o que a gravidade pedir. Corrigida a falha, o período volta à fiscalização; se persistir, instaura-se o procedimento de descumprimento.',
            acoes: [
                A.comunicar('Notificar a contratada para corrigir', { especie: 'notificacao', polos: ['requerido'], dias: 5, texto: 'Fica notificada a corrigir as falhas na execução do contrato, descritas a seguir, com as cláusulas descumpridas, ou a se manifestar no prazo indicado.' }, { obrigatoria: true }),
                A.esperar('Aguardar a correção ou a manifestação', 'Notificar a contratada para corrigir', { obrigatoria: true }),
                A.simNao('A contratada corrigiu a falha?', { obrigatoria: true }),
            ],
            saidas: { 'Execução e fiscalização': quando('A contratada corrigiu a falha?', 'sim'), 'Descumprimento contratual': quando('A contratada corrigiu a falha?', 'nao') },
        },
        {
            nome: 'Descumprimento contratual', unidade: 'Fiscalização do contrato', avanco: 'auto', vai: ['Recebimento e ateste', 'Extinção do contrato'], padrao: 'Recebimento e ateste',
            orientacao: 'A sanção não se aplica neste processo. O fiscal instaura no SIM o procedimento "Descumprimento Contratual" (ou "Descumprimento Contratual e Rescisão") com a gravidade da infração, as peculiaridades do caso, agravantes e atenuantes, os danos, a cláusula descumprida e o inciso do art. 155 da Lei 14.133 (Prov. 104, art. 89). Havendo garantia, verifique a necessidade de acionar o garantidor. Antes do julgamento, o gestor pode reter provisoriamente créditos no valor da multa em tese, devolvidos se a sanção não vier ou vier menor (art. 97). Aqui o período segue para o ateste com as glosas cabíveis, ou para a extinção.',
            acoes: [
                A.escolha('Infração apontada (art. 155 da Lei 14.133)', ['Inexecução parcial', 'Inexecução parcial com grave dano', 'Inexecução total', 'Atraso injustificado', 'Documento ou declaração falsa', 'Fraude ou ato lesivo', 'Outra'], { obrigatoria: true }),
                A.fazer('Abrir o processo derivado de descumprimento contratual ("Novo processo derivado deste")', { obrigatoria: true, ajuda: 'Use o tipo de processo com o modelo "Descumprimento contratual no MPRS".' }),
                A.texto('Número do procedimento de descumprimento', { obrigatoria: true }),
                A.simNao('Reter créditos provisoriamente (art. 97)?', { obrigatoria: true }),
                A.numero('Valor retido (R$)', { se: quando('Reter créditos provisoriamente (art. 97)?', 'sim') }),
                A.simNao('O caso pede também a extinção do contrato?', { obrigatoria: true }),
            ],
            saidas: { 'Extinção do contrato': quando('O caso pede também a extinção do contrato?', 'sim'), 'Recebimento e ateste': quando('O caso pede também a extinção do contrato?', 'nao') },
        },
        {
            nome: 'Recebimento e ateste', unidade: 'Gestão do contrato', vai: ['Pagamento', 'Notificação para correção'],
            orientacao: 'O gestor analisa os relatórios da fiscalização e a nota fiscal; havendo irregularidade, indica as cláusulas e pede a correção por escrito (Prov. 05/2023, art. 21, VIII). Emite o termo circunstanciado de recebimento definitivo (art. 21, VI; Lei 14.133, art. 140). O fiscal técnico atesta a nota fiscal (art. 22, XI); com dedicação exclusiva de mão de obra, a fiscalização administrativa faz essa conferência (art. 21, parágrafo único). Pedidos e reclamações da contratada são decididos em até 1 mês, prorrogável por igual período (Prov. 104, art. 68).',
            acoes: [
                A.escolha('Resultado do ateste', ['Ateste integral', 'Ateste com glosa', 'Não atestar'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o termo circunstanciado de recebimento definitivo', 'Termo de recebimento', { forma: 'redigir', se: quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa') }),
                A.comunicar('Notificar a contratada do valor a faturar e das glosas', { especie: 'notificacao', polos: ['requerido'], dias: 5, texto: 'Emita a nota fiscal no valor indicado, já descontadas as glosas. Querendo, conteste a glosa no prazo.' }, { se: quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa') }),
                A.esperar('Aguardar a nota fiscal ou a contestação', 'Notificar a contratada do valor a faturar e das glosas', { se: quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa') }),
                A.documento('Juntar a nota fiscal atestada', 'Nota fiscal', { forma: 'juntar', se: quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa') }),
                A.fazer('Cadastrar a nota fiscal no FPE e vincular a parcela no SIM', { obrigatoria: true, se: quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa') }),
            ],
            saidas: { Pagamento: quando('Resultado do ateste', 'Ateste integral', 'Ateste com glosa'), 'Notificação para correção': quando('Resultado do ateste', 'Não atestar') },
        },
        {
            nome: 'Pagamento', unidade: 'Assessoria de Planejamento e Orçamento', nome_publico: 'Liquidação e pagamento',
            vai: ['Execução e fiscalização', 'Alteração do contrato: instrução', 'Prorrogação da vigência', 'Reajuste por apostila', 'Verificação anual da habilitação', 'Extinção do contrato', 'Recebimento definitivo e relatório final'],
            orientacao: 'O gestor encaminha ao Setor Financeiro da Assessoria de Planejamento e Orçamento, em tempo hábil, com os documentos do termo de referência ou do contrato e a lista de checagem da Intranet (Prov. 104, art. 70). Com dedicação exclusiva de mão de obra, vão junto a prova das obrigações trabalhistas vencidas e do FGTS e as certidões. O Setor Financeiro confere o CADIN/RS no momento do pagamento; irregularidade documental não impede pagar o que foi executado, salvo na cessão de mão de obra, e volta ao gestor para notificar a contratada (art. 71). O provimento não fixa prazo em dias: valem o contrato e a ordem cronológica da Lei 14.133 (art. 141). Parcela proporcional usa o mês comercial de 30 dias (art. 72). O gestor acompanha o saldo do empenho e pede complementação (Prov. 05/2023, art. 21, VII). Ao fim, diga por onde o contrato segue.',
            acoes: [
                A.fazer('Conferir a lista de checagem e o CADIN/RS', { obrigatoria: true }),
                A.simNao('Documentação regular?', { obrigatoria: true }),
                A.comunicar('Notificar a contratada para regularizar em 15 dias', { especie: 'notificacao', polos: ['requerido'], dias: 15, contagem: corridos, texto: 'Regularize, em 15 dias, a pendência documental descrita a seguir. O prazo pode ser prorrogado com justificativa. Sem a regularização, será instaurado procedimento de descumprimento e, se for o caso, de rescisão.' }, { se: quando('Documentação regular?', 'nao'), ajuda: 'Prov. 104/2023, art. 66. Corre em paralelo ao pagamento.' }),
                A.formulario('Registrar o pagamento', [
                    { id: 'valor_pago', rotulo: 'Valor pago (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'retencoes', rotulo: 'Retenções (R$)', tipo: 'numero' },
                    { id: 'data_pagamento', rotulo: 'Data do pagamento', tipo: 'data', obrigatorio: true },
                    { id: 'saldo_empenho', rotulo: 'Saldo do empenho (R$)', tipo: 'numero' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o comprovante de pagamento', 'Comprovante de pagamento', { forma: 'juntar' }),
                A.escolha('Como o contrato segue', SEGUE, { obrigatoria: true, ajuda: 'Próximo período: volta à fiscalização. Os demais abrem o evento e, ao fim dele, o contrato volta à fiscalização.' }),
            ],
            saidas: {
                'Execução e fiscalização': quando('Como o contrato segue', 'Próximo período'),
                'Alteração do contrato: instrução': quando('Como o contrato segue', 'Alteração do contrato'),
                'Prorrogação da vigência': quando('Como o contrato segue', 'Prorrogação da vigência'),
                'Reajuste por apostila': quando('Como o contrato segue', 'Reajuste por apostila'),
                'Verificação anual da habilitação': quando('Como o contrato segue', 'Verificação anual da habilitação'),
                'Extinção do contrato': quando('Como o contrato segue', 'Extinção do contrato'),
                'Recebimento definitivo e relatório final': quando('Como o contrato segue', 'Objeto concluído ou fim da vigência'),
            },
        },
        {
            nome: 'Verificação anual da habilitação', unidade: 'Gestão do contrato', vai: ['Execução e fiscalização', 'Descumprimento contratual'],
            orientacao: `Ao menos uma vez por ano, confira a habilitação técnica, fiscal, social e trabalhista e os cadastros CADIN/RS, CFIL/RS e CEIS (Prov. 104, art. 65). Certidões: ${CERTIDOES}. Achada irregularidade, notifique a contratada para regularizar em 15 dias, prorrogáveis com justificativa; sem a regularização, instaure o procedimento de descumprimento e, se for o caso, a rescisão (art. 66). Em sociedade anônima não se consulta o CPF dos sócios.`,
            acoes: [
                A.fazer('Conferir as certidões e os cadastros CADIN/RS, CFIL/RS e CEIS', { obrigatoria: true }),
                A.simNao('Habilitação mantida?', { obrigatoria: true }),
                A.comunicar('Notificar a contratada para regularizar em 15 dias', { especie: 'notificacao', polos: ['requerido'], dias: 15, contagem: corridos, texto: 'Regularize, em 15 dias, a condição de habilitação descrita a seguir. O prazo pode ser prorrogado com justificativa.' }, { se: quando('Habilitação mantida?', 'nao') }),
                A.esperar('Aguardar a regularização', 'Notificar a contratada para regularizar em 15 dias', { se: quando('Habilitação mantida?', 'nao') }),
                A.simNao('Situação regular ao fim da verificação?', { obrigatoria: true }),
            ],
            saidas: { 'Execução e fiscalização': quando('Situação regular ao fim da verificação?', 'sim'), 'Descumprimento contratual': quando('Situação regular ao fim da verificação?', 'nao') },
        },
        {
            nome: 'Alteração do contrato: instrução', unidade: 'Gestão do contrato', vai: ['Análise orçamentária'],
            orientacao: `Pedidos de alteração (reequilíbrio, alteração qualitativa ou quantitativa e outros) são encaminhados pelo gestor, com o aval do coordenador da área e as informações do fiscal, pelo SIM, à Assessoria de Planejamento e Orçamento (Prov. 104, art. 73). O fiscal técnico faz a pesquisa de preços (Prov. 05/2023, art. 22, XII). Junte a lista de checagem e as certidões: ${CERTIDOES} (art. 75). Irregularidade impede o aditivo, salvo se o fiscal atestar que o serviço é imprescindível, e só pelo tempo de uma nova contratação (art. 76). Limites: acréscimos e supressões de até 25% do valor inicial atualizado, ou 50% de acréscimo em reforma (Lei 14.133, art. 125); o objeto não pode ser transfigurado (art. 126). Subcontratação e mudança societária não têm regra no provimento: valem o contrato e os arts. 122 e 137, VI, da lei. Ouça a contratada.`,
            acoes: [
                A.escolha('Espécie de alteração', ['Quantitativa (acréscimo ou supressão)', 'Qualitativa', 'Reequilíbrio econômico-financeiro', 'Regime de execução, forma de pagamento ou garantia', 'Subcontratação ou mudança societária', 'Outra'], { obrigatoria: true }),
                A.documento('Juntar a justificativa do gestor com as informações do fiscal', 'Justificativa', { forma: 'redigir' }),
                A.fazer('Colher o aval do coordenador da área', { obrigatoria: true }),
                A.formulario('Registrar o impacto da alteração', [
                    { id: 'valor_inicial', rotulo: 'Valor inicial atualizado (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'acrescimo', rotulo: 'Acréscimo (R$)', tipo: 'numero' },
                    { id: 'supressao', rotulo: 'Supressão (R$)', tipo: 'numero' },
                    { id: 'percentual', rotulo: 'Variação acumulada (%)', tipo: 'numero', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a pesquisa de preços', 'Pesquisa de preços', { forma: 'juntar', nivel: 'recomendado' }),
                A.documento('Juntar a lista de checagem e as certidões', 'Certidão', { forma: 'juntar' }),
                A.comunicar('Ouvir a contratada sobre a alteração', { especie: 'notificacao', polos: ['requerido'], dias: 10, texto: 'Manifeste-se, no prazo, sobre a alteração do contrato descrita a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a manifestação da contratada', 'Ouvir a contratada sobre a alteração', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Prorrogação da vigência', unidade: 'Gestão do contrato', vai: ['Análise orçamentária', 'Execução e fiscalização'],
            orientacao: `O gestor controla a vigência e informa no SIM a necessidade de prorrogar ou de contratar de novo (Prov. 05/2023, art. 21, IX e X). O pedido chega ao setor competente pelo menos 45 dias antes do fim da vigência, com os documentos revisados e o atestado expresso de vantajosidade, feito depois de ouvida a fiscalização, com base no histórico do contrato e em pesquisa de mercado (art. 21, XI). Com aumento de despesa ou itens novos, a pesquisa de preços é obrigatória (Prov. 104, art. 74). Certidões: ${CERTIDOES} (art. 75). Na prorrogação de serviço ou fornecimento contínuo, dispensam-se novo estudo técnico preliminar e novo mapa de riscos (arts. 9º e 12). A duração segue o contrato e os arts. 105 a 114 da Lei 14.133: contínuos até 5 anos, prorrogáveis até 10. Renove a garantia.`,
            acoes: [
                A.data('Fim da vigência atual', { obrigatoria: true }),
                A.data('Novo fim da vigência', { obrigatoria: true }),
                A.simNao('Pedido feito com 45 dias ou mais de antecedência?', { obrigatoria: true, ajuda: 'Se não, justifique o atraso no pedido.' }),
                A.comunicar('Consultar a contratada sobre a prorrogação', { especie: 'comunicacao', polos: ['requerido'], dias: 10, texto: 'Manifeste, no prazo, se tem interesse na prorrogação do contrato nas condições indicadas.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta da contratada', 'Consultar a contratada sobre a prorrogação', { obrigatoria: true }),
                A.documento('Juntar o atestado de vantajosidade, com a manifestação da fiscalização', 'Atestado', { forma: 'redigir' }),
                A.documento('Juntar a pesquisa de preços', 'Pesquisa de preços', { forma: 'juntar', nivel: 'recomendado' }),
                A.documento('Juntar a lista de checagem e as certidões', 'Certidão', { forma: 'juntar' }),
                A.simNao('Prorrogação vantajosa e com interesse da contratada?', { obrigatoria: true, ajuda: 'Se não, o contrato vai até o fim da vigência: avise o setor para a nova contratação.' }),
            ],
            saidas: { 'Análise orçamentária': quando('Prorrogação vantajosa e com interesse da contratada?', 'sim'), 'Execução e fiscalização': quando('Prorrogação vantajosa e com interesse da contratada?', 'nao') },
        },
        {
            nome: 'Reajuste por apostila', unidade: 'Gestão do contrato', vai: ['Execução e fiscalização'],
            orientacao: 'O reajuste anual vem previsto no edital ou no contrato, contado da data do orçamento estimado: IPCA nos contratos em geral e INCC-DI em obras, reformas e manutenção predial, salvo índice específico (Prov. 104, arts. 17 e 18). O gestor encaminha pelo SIM à Assessoria de Planejamento e Orçamento, com a base de cálculo informada e conferida pelo fiscal e a lista de checagem (art. 82). Apto o pedido, a Unidade de Contratos formaliza a apostila e cadastra no SIM e no Licitacon do TCE-RS (art. 83). O cálculo usa o mês comercial de 30 dias (art. 84). Também se fazem por apostila as demais situações do art. 136 da Lei 14.133; na dúvida jurídica, consulte a Unidade de Assessoramento Jurídico (art. 81). O provimento não trata de repactuação: valem o contrato e o art. 135 da lei.',
            acoes: [
                A.escolha('Hipótese', ['Reajuste por índice', 'Repactuação', 'Encargo por atraso de pagamento', 'Mudança de razão ou denominação social', 'Empenho de dotação suplementar'], { obrigatoria: true }),
                A.simNao('Cumprido o intervalo de 1 ano da data-base?', { obrigatoria: true, se: quando('Hipótese', 'Reajuste por índice', 'Repactuação') }),
                A.formulario('Registrar o cálculo', [
                    { id: 'data_base', rotulo: 'Data-base', tipo: 'data' },
                    { id: 'indice', rotulo: 'Índice', tipo: 'lista', opcoes: ['IPCA', 'INCC-DI', 'Outro previsto no contrato'] },
                    { id: 'percentual', rotulo: 'Variação (%)', tipo: 'numero' },
                    { id: 'valor_novo', rotulo: 'Valor novo (R$)', tipo: 'numero' },
                ], { se: quando('Hipótese', 'Reajuste por índice', 'Repactuação', 'Encargo por atraso de pagamento'), destino: 'informacao', folha_dados: true }),
                A.fazer('Encaminhar à Assessoria de Planejamento e Orçamento, com a lista de checagem', { obrigatoria: true }),
                A.escolha('Decisão', ['Deferido', 'Deferido em parte', 'Indeferido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a apostila formalizada pela Unidade de Contratos', 'Apostila', { forma: 'juntar', se: quando('Decisão', 'Deferido', 'Deferido em parte') }),
                A.fazer('Conferir o cadastro no SIM e no Licitacon do TCE-RS', { obrigatoria: true, se: quando('Decisão', 'Deferido', 'Deferido em parte') }),
                A.comunicar('Comunicar a decisão à contratada', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Comunicamos a decisão sobre o reajuste do contrato, a seguir.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Análise orçamentária', unidade: 'Assessoria de Planejamento e Orçamento', avanco: 'auto', vai: ['Parecer e minuta do termo aditivo'],
            orientacao: 'A Assessoria de Planejamento e Orçamento analisa o pedido e a previsão de recursos (Prov. 104, arts. 73 e 77).',
            acoes: [
                A.simNao('Há previsão de recursos?', { obrigatoria: true }),
                A.documento('Juntar a informação orçamentária', 'Informação', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Parecer e minuta do termo aditivo', unidade: 'Unidade de Assessoramento Jurídico', avanco: 'auto', vai: ['Aprovação do Diretor-Geral'],
            orientacao: 'A Unidade de Assessoramento Jurídico analisa o pedido e formula a minuta do termo aditivo (Prov. 104, art. 77): previsão contratual, limites legais, vantajosidade, recursos e regularidade (Lei 14.133, art. 53, § 4º).',
            acoes: [
                A.documento('Juntar o parecer jurídico', 'Parecer', { forma: 'redigir' }),
                A.documento('Juntar a minuta do termo aditivo', 'Minuta de termo aditivo', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Aprovação do Diretor-Geral', unidade: 'Direção-Geral', vai: ['Termo aditivo: empenho e formalização', 'Execução e fiscalização'],
            orientacao: 'A alteração e a prorrogação são aprovadas pelo Diretor-Geral antes da remessa para ciência e empenho (Prov. 104, art. 77).',
            acoes: [
                A.escolha('Decisão do Diretor-Geral', ['Aprovado', 'Não aprovado'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o despacho', 'Despacho', { forma: 'redigir' }),
                A.comunicar('Comunicar a decisão à contratada', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Comunicamos a decisão sobre a alteração ou a prorrogação do contrato, a seguir.' }, { obrigatoria: true }),
            ],
            saidas: { 'Termo aditivo: empenho e formalização': quando('Decisão do Diretor-Geral', 'Aprovado'), 'Execução e fiscalização': quando('Decisão do Diretor-Geral', 'Não aprovado') },
        },
        {
            nome: 'Termo aditivo: empenho e formalização', unidade: 'Unidade de Contratos', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, avanco: 'auto', vai: ['Execução e fiscalização'],
            orientacao: 'O Setor Financeiro providencia o empenho, se for o caso (Prov. 104, art. 78), e a Unidade de Contratos formaliza o termo aditivo com os mesmos passos do contrato: certidões, assinatura eletrônica, extrato no Diário Eletrônico, Licitacon e PNCP (art. 79). O termo aditivo é condição para a contratada executar a mudança, salvo prorrogação automática ou antecipação justificada dos efeitos, formalizada em no máximo 1 mês (art. 80).',
            acoes: [
                A.documento('Juntar a nota de empenho, se houver despesa nova', 'Nota de empenho', { forma: 'juntar', nivel: 'opcional' }),
                A.comunicar('Convocar a contratada para assinar o termo aditivo', { especie: 'comunicacao', polos: ['requerido'], dias: 5, texto: 'Assine eletronicamente o termo aditivo e, se for o caso, complemente ou renove a garantia.' }, { obrigatoria: true }),
                A.documento('Juntar o termo aditivo assinado', 'Termo aditivo', { forma: 'juntar' }),
                A.data('Publicação do extrato no Diário Eletrônico do MP', { obrigatoria: true }),
                A.data('Cadastro no Licitacon e disponibilização no PNCP', { obrigatoria: true }),
                A.data('Novo fim da vigência, se houve prorrogação'),
            ],
        },
        {
            nome: 'Extinção do contrato', unidade: 'Gestão do contrato', vai: ['Recebimento definitivo e relatório final', 'Execução e fiscalização'], nome_publico: 'Rescisão do contrato',
            orientacao: 'A extinção é unilateral, consensual, arbitral ou judicial (Prov. 104, art. 85; Lei 14.133, arts. 137 a 139). Na consensual, o gestor instaura no SIM o procedimento "Rescisão contratual", remetido à Unidade de Assessoramento Jurídico da Direção-Geral para análise, parecer e minuta do termo de rescisão (art. 86). A unilateral exige motivação, defesa prévia e pode gerar sanções, apuradas no processo derivado (art. 87); da decisão cabe recurso em 3 dias úteis (Lei 14.133, art. 165, I, "e"). A Unidade de Contratos formaliza o termo (art. 88). Com mão de obra exclusiva, a fiscalização administrativa confere as verbas rescisórias ou a realocação dos empregados (Prov. 05/2023, art. 23, VIII).',
            acoes: [
                A.escolha('Forma de extinção', ['Unilateral pelo Ministério Público', 'Consensual', 'Pedida pela contratada', 'Decisão arbitral ou judicial'], { obrigatoria: true }),
                A.documento('Juntar o relatório motivado do gestor', 'Relatório', { forma: 'redigir' }),
                A.comunicar('Intimar a contratada para defesa', { especie: 'intimacao', polos: ['requerido'], dias: 5, texto: 'Apresente defesa sobre a extinção do contrato, pelos motivos expostos no relatório anexo.' }, { se: quando('Forma de extinção', 'Unilateral pelo Ministério Público'), ajuda: 'Nem a lei nem o provimento fixam o prazo desta defesa: ajuste ao contrato.' }),
                A.esperar('Aguardar a defesa', 'Intimar a contratada para defesa', { se: quando('Forma de extinção', 'Unilateral pelo Ministério Público') }),
                A.documento('Juntar o parecer da Unidade de Assessoramento Jurídico e a minuta do termo de rescisão', 'Parecer', { forma: 'juntar' }),
                A.escolha('Resultado', ['Contrato extinto', 'Contrato mantido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.comunicar('Intimar da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 3, texto: 'Fica intimada da decisão sobre a extinção do contrato. Da extinção unilateral cabe recurso em 3 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar da decisão', { obrigatoria: true }),
                A.documento('Juntar o termo de rescisão formalizado pela Unidade de Contratos', 'Termo de rescisão', { forma: 'juntar', se: quando('Resultado', 'Contrato extinto') }),
            ],
            saidas: { 'Recebimento definitivo e relatório final': quando('Resultado', 'Contrato extinto'), 'Execução e fiscalização': quando('Resultado', 'Contrato mantido') },
        },
        {
            nome: 'Recebimento definitivo e relatório final', unidade: 'Gestão do contrato', vai: ['Encerramento e liberação da garantia'],
            orientacao: 'Por conclusão, fim da vigência ou extinção, o gestor emite o termo circunstanciado de recebimento definitivo do objeto e o relatório final, com as boas práticas e as lições para as próximas contratações (Prov. 05/2023, art. 21, VI e XIX; Lei 14.133, arts. 140 e 174, § 3º, VI, "d"). A contratada pode pedir atestado de capacidade técnica à Procuradoria-Geral de Justiça (Prov. 104, art. 69). O provimento não criou avaliação formal de desempenho: registre o conceito para servir às próximas contratações (Lei 14.133, art. 88, §§ 3º e 4º). Em obra, a contratada responde pelos vícios por no mínimo 5 anos.',
            acoes: [
                A.documento('Juntar o termo circunstanciado de recebimento definitivo do objeto', 'Termo de recebimento', { forma: 'redigir' }),
                A.numero('Valor total executado (R$)', { obrigatoria: true }),
                A.escolha('Conceito da execução', ['Ótimo', 'Bom', 'Regular', 'Ruim'], { obrigatoria: true }),
                A.documento('Juntar o relatório final do gestor, com as boas práticas', 'Relatório', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Encerramento e liberação da garantia', unidade: 'Unidade de Contratos', vai: ['Arquivamento'], nome_publico: 'Encerramento do contrato',
            orientacao: 'A garantia só é liberada depois da fiel execução e de quitadas glosas, multas e, com mão de obra exclusiva, as verbas trabalhistas (Lei 14.133, art. 100). Confira se há procedimento de descumprimento em aberto ou multa sobrestada (Prov. 104, art. 96): em caso positivo, a garantia aguarda. Comunique o encerramento e atualize o Licitacon e o PNCP.',
            acoes: [
                A.simNao('Há procedimento de descumprimento em aberto?', { obrigatoria: true }),
                A.simNao('Há garantia a liberar?', { obrigatoria: true }),
                A.documento('Juntar a liberação da garantia', 'Despacho', { forma: 'qualquer', se: quando('Há garantia a liberar?', 'sim') }),
                A.fazer('Atualizar o Licitacon e o PNCP com o encerramento', { obrigatoria: true }),
                A.comunicar('Comunicar o encerramento à contratada', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Comunicamos o encerramento do contrato e o recebimento definitivo do objeto.' }, { obrigatoria: true }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Unidade de Contratos', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

const SANCOES_LEVES = ['Advertência', 'Multa', 'Advertência e multa'];
const SANCOES_GRAVES = ['Impedimento de licitar e contratar', 'Declaração de inidoneidade'];

/** 54. Descumprimento contratual no MPRS: apuração e sanção administrativa (Provimento 104/2023-PGJ, arts. 89 a 98). */
export function descumprimentoContratualMprs() {
    return montar({
        id: 'descumprimento-contratual-mprs', nome: 'Descumprimento contratual no MPRS: apuração e sanção', area: 'sancionador', porte: 'longo', referencia: 'MPRS',
        descricao: 'O procedimento "Descumprimento Contratual" do Ministério Público do RS: o fiscal instaura com a gravidade, os danos, a cláusula descumprida e o inciso do art. 155 da Lei 14.133; o gestor analisa e abre 15 dias úteis de defesa, quando o caso é de advertência ou multa, ou remete à Direção-Geral para a comissão processante de dois ou mais servidores estáveis, quando o caso é de impedimento ou de inidoneidade. Depois vêm a manifestação do gestor ou o relatório da comissão, a manifestação da Unidade de Assessoramento Jurídico e a decisão do Diretor-Geral (advertência, multa e impedimento) ou do Subprocurador-Geral de Justiça para Assuntos Administrativos (inidoneidade). Da intimação correm 15 dias úteis para recurso ou pedido de reconsideração. A decisão final sai no Diário Eletrônico, a sanção é registrada no CFIL/RS e no CEIS e a multa é cobrada, com inscrição no CADIN/RS se não for paga. Multa de até R$ 250,00 fica sobrestada.',
        quando: 'Inexecução total ou parcial de contrato, de nota de empenho ou de ata de registro de preços do MPRS, e recusa em assinar. Abra como processo derivado do contrato ("Novo processo derivado deste"). A sanção é administrativa. Ligue o painel e a planilha para acompanhar defesas, prazos e multas a cobrar.',
        base: 'Provimento 104/2023-PGJ, arts. 55, § 2º, 66 e 89 a 98; Provimento 05/2023-PGJ, arts. 21, XVI, 22, XVI, e 23, VII; Provimento 75/2016-PGJ (atos da Lei 12.846/2013); Lei 14.133/2021, arts. 155 a 163 e 165 a 168; Lei estadual 11.389/1999 e Decreto 42.250/2003 (CFIL/RS: conferir na norma vigente). O provimento não fala em efeito suspensivo nem em alegações finais: valem os arts. 158, § 2º, e 168 da lei.',
        tipo: { polos: ['requerente', 'requerido'], nomes_polos: { requerente: 'Ministério Público', requerido: 'Contratada' } },
    }, [
        {
            nome: 'Instauração pelo fiscal', unidade: 'Fiscalização do contrato', vai: ['Análise do gestor'],
            orientacao: 'O fiscal instaura o procedimento no SIM com o título "Descumprimento Contratual" ou "Descumprimento Contratual e Rescisão" e registra: gravidade da infração, peculiaridades do caso, agravantes e atenuantes, danos e prejuízos, cláusula descumprida e inciso do art. 155 da Lei 14.133 (Prov. 104, art. 89). Havendo garantia, verifique a necessidade de acionar o garantidor (art. 89, parágrafo único). Se o ato também for lesivo pela Lei 12.846/2013, a apuração corre nestes mesmos autos, pelo rito e pela autoridade do Provimento 75/2016-PGJ (art. 98).',
            acoes: [
                A.formulario('Registrar a ocorrência', [
                    { id: 'contrato', rotulo: 'Contrato, nota de empenho ou ata', tipo: 'texto', obrigatorio: true },
                    { id: 'pgea', rotulo: 'Procedimento no SIM (PGEA)', tipo: 'texto', obrigatorio: true },
                    { id: 'contratada', rotulo: 'Contratada (nome e CNPJ ou CPF)', tipo: 'texto', obrigatorio: true },
                    { id: 'infracao', rotulo: 'Infração (art. 155 da Lei 14.133)', tipo: 'lista', opcoes: ['I: inexecução parcial', 'II: inexecução parcial com grave dano', 'III: inexecução total', 'IV: deixar de entregar documentação', 'V: não manter a proposta', 'VI: não assinar o contrato', 'VII: atraso injustificado', 'VIII: documento ou declaração falsa', 'IX a XII: fraude ou ato lesivo'], obrigatorio: true },
                    { id: 'clausula', rotulo: 'Cláusula descumprida', tipo: 'texto', obrigatorio: true },
                    { id: 'gravidade', rotulo: 'Gravidade', tipo: 'lista', opcoes: ['Leve', 'Média', 'Grave'], obrigatorio: true },
                    { id: 'danos', rotulo: 'Danos e prejuízos', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'agravantes', rotulo: 'Agravantes e atenuantes', tipo: 'texto_longo' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o relatório do fiscal, com as provas', 'Relatório', { forma: 'redigir' }),
                A.simNao('Há garantia a acionar?', { obrigatoria: true }),
                A.simNao('O ato também é lesivo pela Lei 12.846/2013?', { obrigatoria: true, ajuda: 'Se sim, siga também o Provimento 75/2016-PGJ.' }),
            ],
        },
        {
            nome: 'Análise do gestor', unidade: 'Gestão do contrato', vai: ['Defesa prévia', 'Comissão processante', 'Multa sobrestada', 'Arquivamento'],
            orientacao: 'O gestor analisa e escolhe o caminho (Prov. 104, art. 90): 15 dias úteis de defesa, nos casos de advertência e multa, ou remessa à Direção-Geral para o processo de responsabilização, nos casos de impedimento ou de inidoneidade. Considere em conjunto o art. 156, §§ 2º a 5º e 7º, da Lei 14.133: natureza e gravidade, peculiaridades, agravantes e atenuantes, danos e programa de integridade. A multa vai de 0,5% a 30% do valor do contrato, como o edital fixar. Multa calculada em até R$ 250,00 não é processada: fica sobrestada durante o contrato e reabre com nova irregularidade, salvo se vier junto com outra sanção ou com dano comprovado (art. 96). O gestor pode reter créditos provisoriamente (art. 97).',
            acoes: [
                A.escolha('Sanção em tese', [...SANCOES_LEVES, ...SANCOES_GRAVES, 'Nenhuma: fato não confirmado'], { obrigatoria: true }),
                A.numero('Multa calculada (R$)', { se: quando('Sanção em tese', 'Multa', 'Advertência e multa') }),
                A.simNao('Multa de até R$ 250,00, sem outra sanção nem dano comprovado?', { obrigatoria: true, se: quando('Sanção em tese', 'Multa') }),
                A.simNao('Reter créditos provisoriamente (art. 97)?', { se: quando('Sanção em tese', 'Multa', 'Advertência e multa') }),
                A.documento('Juntar a análise do gestor', 'Despacho', { forma: 'redigir' }),
                A.escolha('Caminho', ['Abrir prazo de defesa', 'Remeter à Direção-Geral para comissão processante', 'Sobrestar a multa', 'Arquivar'], { obrigatoria: true, ajuda: 'Impedimento e inidoneidade: sempre comissão. Sobrestar: só multa de até R$ 250,00.' }),
            ],
            saidas: {
                'Defesa prévia': quando('Caminho', 'Abrir prazo de defesa'),
                'Comissão processante': quando('Caminho', 'Remeter à Direção-Geral para comissão processante'),
                'Multa sobrestada': quando('Caminho', 'Sobrestar a multa'),
                Arquivamento: quando('Caminho', 'Arquivar'),
            },
        },
        {
            nome: 'Multa sobrestada', unidade: 'Unidade de Assessoramento Jurídico', vai: ['Análise do gestor', 'Arquivamento'], nome_publico: 'Procedimento sobrestado',
            orientacao: 'O procedimento foi aberto e a multa calculada, mas ele fica sobrestado enquanto o contrato é executado. A Unidade de Assessoramento Jurídico faz o sobrestamento e comunica a empresa (Prov. 104, art. 96, § 2º). Nova irregularidade reabre o procedimento; fim do contrato sem novidade, arquiva.',
            acoes: [
                A.comunicar('Comunicar o sobrestamento à contratada', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Comunicamos que a multa calculada, de valor igual ou inferior a R$ 250,00, não será processada agora: o procedimento fica sobrestado durante a execução do contrato e será reaberto em caso de nova irregularidade.' }, { obrigatoria: true }),
                A.escolha('O que aconteceu', ['Nova irregularidade: reabrir', 'Contrato encerrado sem nova irregularidade'], { obrigatoria: true }),
            ],
            saidas: { 'Análise do gestor': quando('O que aconteceu', 'Nova irregularidade: reabrir'), Arquivamento: quando('O que aconteceu', 'Contrato encerrado sem nova irregularidade') },
        },
        {
            nome: 'Defesa prévia', unidade: 'Gestão do contrato', prazo_dias: 15, prazo_auto: true, avanco: 'auto', vai: ['Manifestação do gestor'],
            orientacao: 'A contratada tem 15 dias úteis para a defesa (Prov. 104, art. 90, I; Lei 14.133, art. 157). A intimação descreve o fato, a cláusula, a sanção em tese e o valor da multa, e dá acesso aos autos. Com ou sem resposta, o procedimento segue (art. 91).',
            acoes: [
                A.comunicar('Intimar a contratada para a defesa', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Fica intimada a apresentar defesa, em 15 dias úteis, sobre o descumprimento contratual descrito no relatório anexo, que pode levar à sanção indicada. Os autos estão à sua disposição.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa', 'Intimar a contratada para a defesa', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Manifestação do gestor', unidade: 'Gestão do contrato', avanco: 'auto', vai: ['Manifestação jurídica'],
            orientacao: 'Passados os 15 dias úteis, com ou sem resposta, o gestor se manifesta sobre a sanção, analisando os argumentos da empresa, e encaminha à Unidade de Assessoramento Jurídico (Prov. 104, art. 91).',
            acoes: [
                A.escolha('Proposta do gestor', [...SANCOES_LEVES, 'Não aplicar sanção'], { obrigatoria: true }),
                A.numero('Multa proposta (R$)', { se: quando('Proposta do gestor', 'Multa', 'Advertência e multa') }),
                A.documento('Juntar a manifestação do gestor', 'Manifestação', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Comissão processante', unidade: 'Comissão processante', prazo_dias: 15, prazo_auto: true, vai: ['Manifestação jurídica'],
            orientacao: 'O Diretor-Geral instaura o processo de responsabilização e designa comissão de dois ou mais servidores estáveis, de preferência com 3 anos ou mais de serviço (Prov. 104, art. 90, II). Quem é agente de contratação, pregoeiro ou membro de comissão de contratação não integra a comissão processante do mesmo caso (Prov. 05/2023, art. 8º, III). O rito é o do art. 158 da Lei 14.133: intimação para defesa escrita e especificação de provas em 15 dias úteis; produzidas provas novas, alegações finais em 15 dias úteis; provas ilícitas, impertinentes ou protelatórias são indeferidas com motivação. A apuração interrompe a prescrição, que é de 5 anos da ciência da infração (art. 158, § 4º). A desconsideração da personalidade jurídica exige contraditório próprio (art. 160).',
            acoes: [
                A.documento('Juntar a portaria de instauração e de designação da comissão', 'Portaria', { forma: 'juntar' }),
                A.comunicar('Intimar a contratada para defesa e especificação de provas', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Fica intimada a apresentar defesa escrita e a especificar as provas que pretende produzir, em 15 dias úteis, no processo de responsabilização que pode levar ao impedimento de licitar e contratar ou à declaração de inidoneidade.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa', 'Intimar a contratada para defesa e especificação de provas', { obrigatoria: true }),
                A.simNao('Foram produzidas provas novas?', { obrigatoria: true }),
                A.audiencia('Designar a audiência de instrução', 'instrucao', { se: quando('Foram produzidas provas novas?', 'sim') }),
                A.comunicar('Intimar para alegações finais', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Fica intimada a apresentar alegações finais em 15 dias úteis.' }, { se: quando('Foram produzidas provas novas?', 'sim') }),
                A.esperar('Aguardar as alegações finais', 'Intimar para alegações finais', { se: quando('Foram produzidas provas novas?', 'sim') }),
                A.escolha('Conclusão da comissão', [...SANCOES_GRAVES, 'Multa', 'Não aplicar sanção'], { obrigatoria: true }),
                A.documento('Juntar o relatório final da comissão', 'Relatório', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Manifestação jurídica', unidade: 'Unidade de Assessoramento Jurídico', avanco: 'auto', vai: ['Decisão'],
            orientacao: 'A Unidade de Assessoramento Jurídico se manifesta sobre os fatos e os fundamentos e sugere, ou não, a sanção à autoridade competente (Prov. 104, arts. 91 a 93). A declaração de inidoneidade pede análise jurídica prévia (Lei 14.133, art. 156, § 6º).',
            acoes: [A.documento('Juntar a manifestação jurídica', 'Parecer', { forma: 'redigir' })],
        },
        {
            nome: 'Decisão', unidade: 'Direção-Geral', vai: ['Intimação e recurso', 'Arquivamento'],
            orientacao: 'Decide o Diretor-Geral, nos casos de advertência, multa e impedimento de licitar e contratar; decide o Subprocurador-Geral de Justiça para Assuntos Administrativos, na declaração de inidoneidade (Prov. 104, art. 94). O impedimento vale no âmbito do Estado do RS por até 3 anos; a inidoneidade, em toda a Administração, de 3 a 6 anos (Lei 14.133, art. 156, §§ 4º e 5º). A multa pode ser somada às demais sanções e descontada da garantia ou dos pagamentos.',
            acoes: [
                A.escolha('Autoridade que decide', ['Diretor-Geral', 'Subprocurador-Geral de Justiça para Assuntos Administrativos'], { obrigatoria: true }),
                A.escolha('Sanção aplicada', ['Nenhuma', ...SANCOES_LEVES, ...SANCOES_GRAVES, 'Multa e impedimento', 'Multa e inidoneidade'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.numero('Valor da multa (R$)', { se: quando('Sanção aplicada', 'Multa', 'Advertência e multa', 'Multa e impedimento', 'Multa e inidoneidade') }),
                A.texto('Prazo do impedimento ou da inidoneidade', { se: quando('Sanção aplicada', ...SANCOES_GRAVES, 'Multa e impedimento', 'Multa e inidoneidade') }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
            ],
            saidas: { Arquivamento: quando('Sanção aplicada', 'Nenhuma') },
            padrao: 'Intimação e recurso',
        },
        {
            nome: 'Intimação e recurso', unidade: 'Unidade de Assessoramento Jurídico', prazo_dias: 15, prazo_auto: true, vai: ['Reconsideração e decisão final', 'Publicação e registros'],
            orientacao: 'A decisão volta à Unidade de Assessoramento Jurídico, que intima a contratada e abre 15 dias úteis, contados da intimação, para o recurso (decisão do Diretor-Geral) ou para o pedido de reconsideração (decisão do Subprocurador-Geral) (Prov. 104, art. 94, § 1º). O recurso e o pedido de reconsideração suspendem os efeitos da decisão até o julgamento final (Lei 14.133, art. 168).',
            acoes: [
                A.comunicar('Intimar a contratada da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Fica intimada da decisão anexa. Cabe recurso ou pedido de reconsideração em 15 dias úteis, contados desta intimação.' }, { obrigatoria: true }),
                A.esperar('Aguardar o recurso ou o pedido de reconsideração', 'Intimar a contratada da decisão', { obrigatoria: true }),
            ],
            saidas: { 'Reconsideração e decisão final': quando('Aguardar o recurso ou o pedido de reconsideração', 'Apresentada', 'Parcial'), 'Publicação e registros': quando('Aguardar o recurso ou o pedido de reconsideração', 'Sem manifestação') },
        },
        {
            nome: 'Reconsideração e decisão final', unidade: 'Subprocuradoria-Geral de Justiça para Assuntos Administrativos', prazo_dias: 20, prazo_auto: true, vai: ['Publicação e registros', 'Arquivamento'], nome_publico: 'Julgamento do recurso',
            orientacao: 'O recurso recebe parecer opinativo da Unidade de Assessoramento Jurídico e vai ao Diretor-Geral, que pode reconsiderar; se não reconsiderar, encaminha ao Subprocurador-Geral de Justiça para Assuntos Administrativos, que dá a decisão final (Prov. 104, art. 94, § 2º). O pedido de reconsideração contra a inidoneidade é decidido pelo próprio Subprocurador-Geral (§ 3º). Na lei, a autoridade tem 5 dias úteis para reconsiderar e a superior, 20 dias úteis para decidir (arts. 166 e 167).',
            acoes: [
                A.documento('Juntar o parecer da Unidade de Assessoramento Jurídico', 'Parecer', { forma: 'redigir' }),
                A.simNao('O Diretor-Geral reconsiderou?', { ajuda: 'Só no recurso contra decisão do Diretor-Geral.' }),
                A.escolha('Decisão final', ['Sanção mantida', 'Sanção reduzida', 'Sanção afastada'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão final', 'Decisão', { forma: 'redigir' }),
            ],
            saidas: { Arquivamento: quando('Decisão final', 'Sanção afastada') },
            padrao: 'Publicação e registros',
        },
        {
            nome: 'Publicação e registros', unidade: 'Unidade de Contratos', prazo_dias: 15, prazo_auto: true, vai: ['Cobrança da multa', 'Arquivamento'],
            orientacao: 'A Unidade de Assessoramento Jurídico publica a decisão final no Diário Eletrônico do Ministério Público e notifica a contratada. A Unidade de Contratos cadastra a sanção, conforme o caso, no CFIL/RS, no CEIS e nos cadastros internos, e acompanha os prazos (Prov. 104, arts. 94, § 4º, e 95). O prazo da lei para informar os cadastros é de 15 dias úteis da aplicação (art. 161). Havendo garantia, notifique o garantidor para pagar a indenização. A retenção provisória é devolvida se a sanção não veio ou veio menor (art. 97).',
            acoes: [
                A.data('Publicação no Diário Eletrônico do MP', { obrigatoria: true }),
                A.fazer('Cadastrar a sanção no CFIL/RS, no CEIS e nos cadastros internos', { obrigatoria: true }),
                A.fazer('Notificar o garantidor, se houver garantia'),
                A.fazer('Devolver a retenção provisória que sobrou, se houver'),
                A.simNao('Há multa ou dano a cobrar?', { obrigatoria: true }),
            ],
            saidas: { 'Cobrança da multa': quando('Há multa ou dano a cobrar?', 'sim'), Arquivamento: quando('Há multa ou dano a cobrar?', 'nao') },
        },
        {
            nome: 'Cobrança da multa', unidade: 'Unidade de Contratos', vai: ['Arquivamento'],
            orientacao: 'A Unidade de Contratos acompanha o pagamento da multa e do valor dos danos. Sem pagamento no prazo, envia o procedimento à Assessoria de Planejamento e Orçamento, para inscrição no CADIN/RS, e à Unidade de Assessoramento Jurídico, para a cobrança judicial, se for o caso (Prov. 104, art. 95, parágrafo único). A multa pode ser descontada dos pagamentos devidos e da garantia (Lei 14.133, art. 156, § 8º).',
            acoes: [
                A.comunicar('Notificar a contratada para pagar', { especie: 'notificacao', polos: ['requerido'], dias: 15, texto: 'Fica notificada a pagar a multa aplicada, no valor e na forma indicados. Sem o pagamento, o débito será inscrito no CADIN/RS e cobrado.' }, { obrigatoria: true, ajuda: 'Use o prazo do contrato; 15 dias úteis é só uma sugestão.' }),
                A.esperar('Aguardar o pagamento', 'Notificar a contratada para pagar', { obrigatoria: true }),
                A.escolha('Situação da multa', ['Paga', 'Descontada de pagamento ou da garantia', 'Não paga: CADIN/RS e cobrança judicial'], { obrigatoria: true }),
                A.documento('Juntar o comprovante ou a remessa para cobrança', 'Comprovante', { forma: 'juntar' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Unidade de Contratos', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. A reabilitação pode ser pedida depois de reparado o dano, paga a multa e passado o prazo mínimo (Lei 14.133, art. 163).' },
    ]);
}

const EVENTOS = ['Inventário anual', 'Troca do titular da unidade', 'Movimentação para outra unidade', 'Perda, furto ou dano', 'Devolução para triagem', 'Cessão de uso a terceiro'];

/** 55. Bem móvel no MPRS, do tombamento à baixa (Provimento 55/2022-PGJ). */
export function gestaoPatrimonioMprs() {
    return montar({
        id: 'gestao-patrimonio-mprs', nome: 'Bens móveis no MPRS: do tombamento à baixa', area: 'gestao', porte: 'longo', referencia: 'MPRS',
        descricao: 'A vida do bem móvel permanente do Ministério Público do RS, pelo Provimento 55/2022-PGJ: classificação e cadastro na Unidade de Patrimônio e Almoxarifado, tombamento antes de sair, carga por Termo de Responsabilidade ao titular da unidade (no interior, o Diretor da Promotoria) ou carga pessoal no bem de uso exclusivo. Com o bem em uso, cada evento tem o seu caminho: o inventário anual, com as datas de 31 de julho, 31 de agosto, 30 de setembro e 31 de outubro; a conferência de 30 dias do novo titular; a movimentação entre unidades; a perda, o furto ou o dano, com Termo Circunstanciado Administrativo, decisão do Subprocurador-Geral de Justiça para Assuntos Administrativos e reposição ou indenização pela tabela do provimento; a devolução para triagem (ocioso-excedente, recuperável, obsoleto, fora do padrão ou irrecuperável); a cessão de uso. O inservível passa pela Comissão Permanente de Avaliação de Patrimônio e, com autorização do Diretor-Geral, é doado, leiloado, permutado, descartado ou incinerado, com baixa ao fim.',
        quando: 'Bens móveis permanentes do MPRS. Abra um processo por bem ou por lote (uma aquisição, uma unidade, um conjunto para baixa). Bem de consumo fica no controle do almoxarifado. Não trata de imóveis nem de patrimônio histórico e cultural. Ligue o painel e a planilha para ter a relação dos bens, com tombo, unidade e situação.',
        base: 'Provimento 55/2022-PGJ (bens móveis), arts. 1º a 35; Provimento 02/2009, arts. 2º a 7º e 16 (alienação e desfazimento; o capítulo da venda foi revogado pelo Provimento 05/2023-PGJ); Lei 14.133/2021, arts. 6º, XL, 31 e 76, II (alienação de bens móveis e leilão); Lei 4.320/1964, arts. 94 a 96; Lei 12.305/2010 (resíduos); Decreto estadual 58.685/2026 (Programa Sustentare, de adesão facultativa pelos outros Poderes e órgãos); Decreto estadual 57.408/2023 (bens inservíveis do Executivo: só referência, conferir na norma vigente).',
    }, [
        {
            nome: 'Entrada e classificação', unidade: 'Unidade de Patrimônio e Almoxarifado', vai: ['Tombamento e cadastro', 'Arquivamento'],
            orientacao: 'O bem é permanente quando não perde a identidade física nem a funcionalidade com o uso e dura mais de dois anos. É de consumo quando perde a identidade ou dura até dois anos, quando o valor unitário é de até 25% do limite das Despesas Pequenas de Pronto Pagamento do Estado, ou quando o risco de perda ou o custo do controle é alto (Prov. 55/2022, art. 1º). Bem recebido em doação ou posto à disposição do MP é comunicado de imediato à Unidade; sem a comunicação, não há manutenção nem substituição (art. 32). As unidades não formam estoque de bem de consumo (art. 2º).',
            acoes: [
                A.formulario('Registrar a entrada', [
                    { id: 'descricao', rotulo: 'Descrição do bem ou do lote', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', opcoes: ['Compra', 'Doação recebida', 'Cessão ou bem à disposição do MP', 'Produção própria', 'Reposição por perda ou dano'], obrigatorio: true },
                    { id: 'documento', rotulo: 'Nota fiscal, contrato ou termo', tipo: 'texto', obrigatorio: true },
                    { id: 'quantidade', rotulo: 'Quantidade', tipo: 'numero', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor de aquisição (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'data', rotulo: 'Data de aquisição', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a nota fiscal ou o termo de doação', 'Nota fiscal', { forma: 'juntar' }),
                A.fazer('Conferir o bem com o documento de origem', { obrigatoria: true }),
                A.escolha('Classificação', ['Permanente', 'Consumo'], { obrigatoria: true, ajuda: 'Consumo: fica no controle do almoxarifado e este processo se encerra.' }),
            ],
            saidas: { 'Tombamento e cadastro': quando('Classificação', 'Permanente'), Arquivamento: quando('Classificação', 'Consumo') },
        },
        {
            nome: 'Tombamento e cadastro', unidade: 'Unidade de Patrimônio e Almoxarifado', avanco: 'auto', vai: ['Carga e Termo de Responsabilidade'],
            orientacao: 'Todo bem permanente adquirido é cadastrado na Unidade de Patrimônio e Almoxarifado, e é vedada a saída sem o tombamento (Prov. 55/2022, art. 3º). Afixe a plaqueta com o número do tombo e registre o bem no Sistema de Controle Patrimonial. Quem achar bem sem plaqueta ou com a numeração ilegível comunica à Unidade (art. 4º, V).',
            acoes: [
                A.texto('Número de tombamento (ou faixa, no lote)', { obrigatoria: true }),
                A.escolha('Grupo do bem', ['Mobiliário', 'Informática e comunicação', 'Veículo', 'Equipamento', 'Colete balístico e segurança', 'Outro'], { obrigatoria: true }),
                A.fazer('Afixar a plaqueta e cadastrar no Sistema de Controle Patrimonial', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Carga e Termo de Responsabilidade', unidade: 'Unidade de Patrimônio e Almoxarifado', vai: ['Bem em uso'],
            orientacao: 'A carga é atribuída por Termo de Responsabilidade, confirmado no Sistema de Controle Patrimonial; se o sistema não puder ser usado, pelo formulário MP-234 (Prov. 55/2022, art. 5º). Responde pela regularidade, guarda e conservação o titular da unidade; no interior, a unidade é a Promotoria da comarca e o responsável é o Diretor da Promotoria; o substituto responde durante a substituição (art. 6º). Bem de uso exclusivo de membro ou servidor tem carga pessoal e termo próprio, e acompanha o detentor quando ele muda de lotação (arts. 9º e 13). Colete balístico é sempre carga pessoal (art. 34). Todos os que usam o bem zelam por ele e comunicam dano ou irregularidade de imediato (art. 4º).',
            acoes: [
                A.formulario('Registrar a carga', [
                    { id: 'unidade', rotulo: 'Unidade ou Promotoria', tipo: 'texto', obrigatorio: true },
                    { id: 'responsavel', rotulo: 'Responsável (titular ou detentor)', tipo: 'texto', obrigatorio: true },
                    { id: 'tipo_carga', rotulo: 'Tipo de carga', tipo: 'lista', opcoes: ['Da unidade', 'Pessoal (uso exclusivo)', 'Pessoal (uso alternado na unidade)'], obrigatorio: true },
                    { id: 'localizacao', rotulo: 'Localização', tipo: 'texto' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o Termo de Responsabilidade confirmado', 'Termo de Responsabilidade', { forma: 'juntar' }),
                A.data('Data da confirmação da carga', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Bem em uso', unidade: 'Unidade detentora da carga',
            vai: ['Inventário anual', 'Conferência do novo titular', 'Movimentação', 'Perda, furto ou dano: termo circunstanciado', 'Triagem', 'Cessão de uso'],
            orientacao: 'O bem fica aqui enquanto está em uso. Quando algo acontecer, escolha o evento: o processo percorre o caminho dele e volta. Movimentação dentro da mesma unidade só muda o campo "localização" no sistema, sem evento (Prov. 55/2022, art. 12, § 3º). Bem sem utilização volta à Unidade de Patrimônio e Almoxarifado para triagem (art. 17).',
            acoes: [
                A.escolha('O que aconteceu', EVENTOS, { obrigatoria: true }),
            ],
            saidas: {
                'Inventário anual': quando('O que aconteceu', 'Inventário anual'),
                'Conferência do novo titular': quando('O que aconteceu', 'Troca do titular da unidade'),
                Movimentação: quando('O que aconteceu', 'Movimentação para outra unidade'),
                'Perda, furto ou dano: termo circunstanciado': quando('O que aconteceu', 'Perda, furto ou dano'),
                Triagem: quando('O que aconteceu', 'Devolução para triagem'),
                'Cessão de uso': quando('O que aconteceu', 'Cessão de uso a terceiro'),
            },
        },
        {
            nome: 'Inventário anual', unidade: 'Unidade detentora da carga', vai: ['Bem em uso', 'Inconsistência do inventário'],
            orientacao: 'O inventário é o levantamento anual e obrigatório dos bens permanentes, para conferir quantidade e localização. Nas Promotorias, quem faz é o Secretário-Geral da Diretoria das Promotorias; nas demais unidades, o titular ou servidor designado, sem que a responsabilidade mude de mãos (Prov. 55/2022, art. 14). É feito só pelo Sistema de Controle Patrimonial e tem de estar lançado até 31 de julho; o atraso pode levar à apuração de responsabilidade funcional (art. 15). A Unidade de Patrimônio e Almoxarifado consolida os inventários para a tomada de contas do Procurador-Geral de Justiça e não faz verificação no local, salvo por ordem da Subprocuradoria-Geral de Justiça para Assuntos Administrativos (art. 16).',
            acoes: [
                A.numero('Ano do inventário', { obrigatoria: true }),
                A.data('Data do lançamento no sistema', { obrigatoria: true, ajuda: 'Até 31 de julho.' }),
                A.escolha('Resultado', ['Bem localizado e conforme', 'Bem não localizado', 'Bem em outro local ou com outro responsável', 'Bem danificado ou sem plaqueta'], { obrigatoria: true }),
            ],
            saidas: { 'Bem em uso': quando('Resultado', 'Bem localizado e conforme') },
            padrao: 'Inconsistência do inventário',
        },
        {
            nome: 'Inconsistência do inventário', unidade: 'Unidade de Patrimônio e Almoxarifado', vai: ['Bem em uso', 'Decisão do Subprocurador-Geral'],
            orientacao: 'Até 31 de agosto, a Unidade comunica a inconsistência ao Diretor da Promotoria, ou ao titular da unidade, para preencher o Termo Circunstanciado Administrativo do Anexo Único. Até 30 de setembro, o termo volta à Unidade. Até 31 de outubro, persistindo a inconsistência, a Unidade faz relatório ao Subprocurador-Geral de Justiça para Assuntos Administrativos, que decide pela baixa ou por processo administrativo (Prov. 55/2022, art. 15, § 1º).',
            acoes: [
                A.data('Comunicação da inconsistência ao responsável', { obrigatoria: true, ajuda: 'Até 31 de agosto.' }),
                A.documento('Juntar o Termo Circunstanciado Administrativo', 'Termo circunstanciado', { forma: 'juntar' }),
                A.data('Devolução do termo à Unidade', { ajuda: 'Até 30 de setembro.' }),
                A.simNao('A inconsistência foi resolvida?', { obrigatoria: true }),
                A.documento('Juntar o relatório ao Subprocurador-Geral', 'Relatório', { forma: 'redigir', se: quando('A inconsistência foi resolvida?', 'nao') }),
            ],
            saidas: { 'Bem em uso': quando('A inconsistência foi resolvida?', 'sim'), 'Decisão do Subprocurador-Geral': quando('A inconsistência foi resolvida?', 'nao') },
        },
        {
            nome: 'Conferência do novo titular', unidade: 'Unidade detentora da carga', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Bem em uso', 'Perda, furto ou dano: termo circunstanciado'],
            orientacao: 'O novo titular confirma a carga e tem até 30 dias para conferir os bens e mandar à Unidade de Patrimônio e Almoxarifado, pelo sistema, a lista das divergências. Sem manifestação no prazo, presume-se que recebeu todos os bens (Prov. 55/2022, art. 8º, § 1º). Havendo divergência, faz-se apuração interna e, se ela persistir, Termo Circunstanciado Administrativo (§ 2º).',
            acoes: [
                A.texto('Novo titular', { obrigatoria: true }),
                A.data('Data da assunção', { obrigatoria: true }),
                A.escolha('Resultado da conferência', ['Carga confirmada', 'Sem manifestação em 30 dias: carga presumida', 'Divergência que persiste'], { obrigatoria: true }),
                A.documento('Juntar o Termo de Responsabilidade do novo titular', 'Termo de Responsabilidade', { forma: 'juntar', se: quando('Resultado da conferência', 'Carga confirmada') }),
            ],
            saidas: { 'Perda, furto ou dano: termo circunstanciado': quando('Resultado da conferência', 'Divergência que persiste') },
            padrao: 'Bem em uso',
        },
        {
            nome: 'Movimentação', unidade: 'Unidade detentora da carga', avanco: 'auto', vai: ['Bem em uso'],
            orientacao: 'Movimentação é a transferência física do bem permanente entre unidades. Registra-se no sistema, por termo emitido na unidade de origem e finalizado na de destino (Prov. 55/2022, art. 12, § 1º). Sem o sistema, usa-se o formulário MP-234, da Intranet, com os tombos, as assinaturas e a identificação de quem assina, e cópia digitalizada à Unidade de Patrimônio e Almoxarifado, que lança no sistema (§§ 2º e 4º). Mudança de lotação de quem tem carga pessoal é comunicada à Unidade, que emite novo termo (art. 13).',
            acoes: [
                A.formulario('Registrar a movimentação', [
                    { id: 'origem', rotulo: 'Unidade de origem', tipo: 'texto', obrigatorio: true },
                    { id: 'destino', rotulo: 'Unidade de destino', tipo: 'texto', obrigatorio: true },
                    { id: 'responsavel', rotulo: 'Novo responsável', tipo: 'texto', obrigatorio: true },
                    { id: 'data', rotulo: 'Data', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o termo finalizado no destino (ou o MP-234)', 'Termo de Responsabilidade', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Perda, furto ou dano: termo circunstanciado', unidade: 'Unidade detentora da carga', vai: ['Instrução do termo circunstanciado'], nome_publico: 'Comunicação de perda, furto ou dano',
            orientacao: 'Constatada a perda, o furto ou o dano, o responsável preenche o Termo Circunstanciado Administrativo do Anexo Único, com as justificativas, e manda à Unidade de Patrimônio e Almoxarifado (Prov. 55/2022, art. 23). Na perda e no furto, junte cópia do Boletim de Ocorrência (§ 1º). Em veículo, o Aviso de Sinistro vai à Unidade de Transportes (§ 2º). A comunicação à chefia e à Unidade é imediata (art. 4º, IV).',
            acoes: [
                A.escolha('Ocorrência', ['Perda', 'Furto', 'Dano', 'Sinistro de veículo'], { obrigatoria: true }),
                A.data('Data em que foi constatada', { obrigatoria: true }),
                A.documento('Juntar o Termo Circunstanciado Administrativo, com as justificativas', 'Termo circunstanciado', { forma: 'juntar' }),
                A.documento('Juntar o Boletim de Ocorrência', 'Boletim de ocorrência', { forma: 'juntar', se: quando('Ocorrência', 'Perda', 'Furto') }),
                A.documento('Juntar o Aviso de Sinistro', 'Aviso de sinistro', { forma: 'juntar', se: quando('Ocorrência', 'Sinistro de veículo') }),
            ],
        },
        {
            nome: 'Instrução do termo circunstanciado', unidade: 'Unidade de Patrimônio e Almoxarifado', avanco: 'auto', vai: ['Decisão do Subprocurador-Geral'],
            orientacao: 'A Unidade de Patrimônio e Almoxarifado (ou a Unidade de Transportes, no sinistro de veículo) instrui com a identificação completa do bem, o estado de conservação e a estimativa do custo de reposição, na perda e no furto, ou do conserto, no dano (Prov. 55/2022, art. 24). Concluída a instrução, o expediente vai ao Subprocurador-Geral de Justiça para Assuntos Administrativos (art. 25).',
            acoes: [
                A.formulario('Registrar a instrução', [
                    { id: 'tombo', rotulo: 'Tombo e identificação completa', tipo: 'texto', obrigatorio: true },
                    { id: 'estado', rotulo: 'Estado de conservação', tipo: 'lista', opcoes: ['Novo', 'Bom', 'Regular', 'Ruim'], obrigatorio: true },
                    { id: 'meses', rotulo: 'Meses desde a aquisição', tipo: 'numero', obrigatorio: true },
                    { id: 'custo', rotulo: 'Custo de reposição ou de conserto (R$)', tipo: 'numero', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a informação da Unidade', 'Informação', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Decisão do Subprocurador-Geral', unidade: 'Subprocuradoria-Geral de Justiça para Assuntos Administrativos', vai: ['Reposição ou indenização', 'Baixa patrimonial', 'Bem em uso'],
            orientacao: 'O Subprocurador-Geral de Justiça para Assuntos Administrativos decide (Prov. 55/2022, arts. 15, § 1º, IV, e 25). Com indício de culpa ou dolo, insta o responsável a substituir o bem ou a indenizar (art. 26). Sem culpa, autoriza a baixa por perda, furto ou dano e encaminha à Direção-Geral (art. 19, § 1º). No dano que se conserta, o bem volta ao uso. A inconsistência de inventário pode ainda virar processo administrativo, que corre fora deste rito.',
            acoes: [
                A.simNao('Há indício de culpa ou dolo do responsável?', { obrigatoria: true }),
                A.escolha('Decisão', ['Substituir ou indenizar', 'Baixa sem responsabilização', 'Conserto pelo MP e retorno ao uso', 'Abrir processo administrativo e manter o bem em carga'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
            ],
            saidas: { 'Reposição ou indenização': quando('Decisão', 'Substituir ou indenizar'), 'Baixa patrimonial': quando('Decisão', 'Baixa sem responsabilização') },
            padrao: 'Bem em uso',
        },
        {
            nome: 'Reposição ou indenização', unidade: 'Direção-Geral', vai: ['Baixa patrimonial', 'Bem em uso', 'Decisão do Subprocurador-Geral'],
            orientacao: 'Substituição: bem de mesma característica e valor, ou superior, com nota fiscal, aceito pela unidade especializada (Prov. 55/2022, art. 26, §§ 1º e 2º). Indenização: percentual sobre o valor de bem equivalente em ata de registro de preços válida no MP, ou o valor médio de mercado, conforme o tempo desde a aquisição: até 12 meses, 100%; de 12 a 24, 80%; de 24 a 36, 70%; de 36 a 48, 50%; de 48 a 60, 30%; acima de 60, 20%; bem totalmente depreciado, 10% (§§ 3º e 4º). No dano, a indenização é o valor do conserto (§ 5º). Depois da ciência e da anuência do interessado, a Direção-Geral cumpre (art. 27). Cabe pedido de reconsideração, com argumentos novos (art. 28). Na recusa, o caso do membro vai à Corregedoria-Geral do Ministério Público e o do servidor, à Unidade Disciplinar (art. 29).',
            acoes: [
                A.escolha('Forma', ['Substituição por bem equivalente', 'Indenização em dinheiro', 'Pagamento do conserto'], { obrigatoria: true }),
                A.numero('Percentual da tabela (%)', { se: quando('Forma', 'Indenização em dinheiro') }),
                A.numero('Valor devido (R$)', { se: quando('Forma', 'Indenização em dinheiro', 'Pagamento do conserto') }),
                A.escolha('Resposta do responsável', ['Anuiu e cumpriu', 'Pediu reconsideração com argumentos novos', 'Recusou'], { obrigatoria: true }),
                A.documento('Juntar a nota fiscal do bem substituto ou o comprovante de pagamento', 'Comprovante', { forma: 'juntar', se: quando('Resposta do responsável', 'Anuiu e cumpriu') }),
                A.escolha('Remessa na recusa', ['Corregedoria-Geral do Ministério Público (membro)', 'Unidade Disciplinar (servidor)'], { obrigatoria: true, se: quando('Resposta do responsável', 'Recusou') }),
                A.simNao('O bem original deve ser baixado?', { obrigatoria: true, ajuda: 'Sim na perda, no furto e na substituição. Não no dano consertado.' }),
            ],
            saidas: { 'Decisão do Subprocurador-Geral': quando('Resposta do responsável', 'Pediu reconsideração com argumentos novos'), 'Baixa patrimonial': quando('O bem original deve ser baixado?', 'sim') },
            padrao: 'Bem em uso',
        },
        {
            nome: 'Triagem', unidade: 'Unidade de Patrimônio e Almoxarifado', vai: ['Carga e Termo de Responsabilidade', 'Avaliação para baixa'],
            orientacao: 'O bem sem utilização volta à Unidade para triagem, vistoria e classificação pela área especializada, com relatório: data de entrada, número do patrimônio, origem, descrição e estado de conservação (Prov. 55/2022, art. 17, § 1º). Servível: ocioso-excedente (em perfeitas condições, mas não aproveitado) ou recuperável (recuperar ou atualizar custa menos de 50% de um bem novo). Inservível: obsoleto, fora do padrão ou irrecuperável (custo de 50% ou mais) (§ 2º). O servível fica disponível para redistribuição; parado por mais de 2 anos, pode ser considerado inservível (art. 18). O inservível pode ir à baixa.',
            acoes: [
                A.data('Entrada na Unidade', { obrigatoria: true }),
                A.escolha('Estado de conservação', ['Novo', 'Bom', 'Regular', 'Ruim', 'Sem condições de uso'], { obrigatoria: true }),
                A.escolha('Classificação', ['Servível: ocioso-excedente', 'Servível: recuperável', 'Inservível: obsoleto', 'Inservível: fora do padrão', 'Inservível: irrecuperável', 'Servível parado há mais de 2 anos'], { obrigatoria: true }),
                A.documento('Juntar o relatório de triagem', 'Relatório', { forma: 'redigir' }),
                A.escolha('Encaminhamento', ['Redistribuir a outra unidade', 'Destinar à baixa'], { obrigatoria: true, ajuda: 'Servível vai à redistribuição: registre a nova carga. Inservível vai à avaliação para baixa.' }),
            ],
            saidas: { 'Carga e Termo de Responsabilidade': quando('Encaminhamento', 'Redistribuir a outra unidade'), 'Avaliação para baixa': quando('Encaminhamento', 'Destinar à baixa') },
        },
        {
            nome: 'Cessão de uso', unidade: 'Subprocuradoria-Geral de Justiça para Assuntos Administrativos', vai: ['Bem em uso', 'Perda, furto ou dano: termo circunstanciado'],
            orientacao: 'A cessão temporária a órgão público ou a entidade privada sem fins lucrativos é excepcional, para uso de interesse social, e depende de autorização do Subprocurador-Geral de Justiça para Assuntos Administrativos (Prov. 55/2022, art. 33). A Unidade de Patrimônio e Almoxarifado elabora o termo de cessão de uso, com a descrição, o estado e o número do patrimônio, publicado no Diário Eletrônico do Ministério Público (§ 1º). O bem continua no patrimônio do MP e é conferido na devolução.',
            acoes: [
                A.texto('Cessionário', { obrigatoria: true }),
                A.escolha('Decisão do Subprocurador-Geral', ['Autorizada', 'Não autorizada'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o termo de cessão de uso', 'Termo de cessão', { forma: 'redigir', se: quando('Decisão do Subprocurador-Geral', 'Autorizada') }),
                A.data('Publicação no Diário Eletrônico do MP', { se: quando('Decisão do Subprocurador-Geral', 'Autorizada') }),
                A.data('Devolução prevista', { se: quando('Decisão do Subprocurador-Geral', 'Autorizada') }),
                A.escolha('Devolução', ['Não houve cessão', 'Devolvido em ordem', 'Devolvido com dano ou não devolvido'], { obrigatoria: true }),
            ],
            saidas: { 'Perda, furto ou dano: termo circunstanciado': quando('Devolução', 'Devolvido com dano ou não devolvido') },
            padrao: 'Bem em uso',
        },
        {
            nome: 'Avaliação para baixa', unidade: 'Comissão Permanente de Avaliação de Patrimônio', vai: ['Autorização da baixa'],
            orientacao: 'O bem é vistoriado pela Unidade ou pela área especializada, que faz o relatório de avaliação (estado, vida útil, valor de mercado e valor contábil) e o classifica (Prov. 55/2022, art. 20). A Comissão Permanente de Avaliação de Patrimônio, formada pelos coordenadores da Divisão Administrativa, da Unidade de Patrimônio e Almoxarifado e da área especializada, avalia, requer a baixa e recomenda a destinação (arts. 30 e 31). Na alienação, o Provimento 02/2009 pede avaliação prévia por servidor com conhecimento técnico, análise de oportunidade e conveniência socioeconômica e decisão da autoridade (art. 3º); passados mais de 60 dias, o valor é atualizado (art. 4º). Bem com valor econômico ou de uso pode ser doado, leiloado ou permutado; sem valor, vai a entidade sem fins lucrativos, descarte ou incineração.',
            acoes: [
                A.formulario('Registrar a avaliação', [
                    { id: 'estado', rotulo: 'Estado de conservação', tipo: 'texto', obrigatorio: true },
                    { id: 'vida_util', rotulo: 'Vida útil restante', tipo: 'texto' },
                    { id: 'valor_mercado', rotulo: 'Valor de mercado (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'valor_contabil', rotulo: 'Valor contábil (R$)', tipo: 'numero', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.simNao('O bem tem valor econômico ou de uso?', { obrigatoria: true }),
                A.escolha('Destinação recomendada', ['Doação', 'Leilão', 'Permuta', 'Entidade sem fins lucrativos', 'Descarte ambientalmente adequado', 'Incineração'], { obrigatoria: true }),
                A.documento('Juntar o relatório de avaliação e a recomendação da Comissão', 'Relatório', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Autorização da baixa', unidade: 'Direção-Geral', vai: ['Destinação', 'Triagem'],
            orientacao: 'A baixa por doação, leilão, permuta, descarte ou incineração é autorizada pelo Diretor-Geral e encaminhada à Unidade de Patrimônio e Almoxarifado (Prov. 55/2022, art. 19, § 2º). A baixa por perda, furto ou dano é do Subprocurador-Geral (§ 1º) e corre pelo outro caminho.',
            acoes: [
                A.escolha('Decisão do Diretor-Geral', ['Autorizada', 'Não autorizada'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a autorização', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: { Destinação: quando('Decisão do Diretor-Geral', 'Autorizada'), Triagem: quando('Decisão do Diretor-Geral', 'Não autorizada') },
        },
        {
            nome: 'Destinação', unidade: 'Unidade de Patrimônio e Almoxarifado', vai: ['Baixa patrimonial'],
            orientacao: 'Antes de sair, os símbolos oficiais que o bem ostenta são inutilizados (Prov. 55/2022, art. 21). Doação: só para fins e uso de interesse social, com avaliação de oportunidade e conveniência, sem licitação (Prov. 02/2009, art. 5º; Lei 14.133, art. 76, II, "a"); lavra-se o Termo de Doação, com a destinação do bem, e publica-se o resumo na imprensa oficial (art. 6º). Leilão: pela Lei 14.133 (arts. 6º, XL, 31 e 76, II), por leiloeiro oficial ou servidor designado, porque o capítulo da venda do Provimento 02/2009 foi revogado. Permuta: com prova do interesse público e da igualdade de valores (art. 7º). Sem valor: entidade sem fins lucrativos, incineração ou descarte ambientalmente adequado, acompanhados pela Comissão (Prov. 55/2022, art. 22), depois de retiradas as partes aproveitáveis (Prov. 02/2009, art. 16). Eletroeletrônico: avalie a adesão ao Programa Sustentare do Estado (Decreto 58.685/2026), aberto aos outros Poderes e órgãos, e a logística reversa (Lei 12.305/2010).',
            acoes: [
                A.escolha('Forma de destinação', ['Doação', 'Leilão', 'Permuta', 'Entidade sem fins lucrativos', 'Descarte ambientalmente adequado', 'Incineração'], { obrigatoria: true, destino: 'autos' }),
                A.texto('Destinatário, arrematante ou local do descarte', { obrigatoria: true }),
                A.fazer('Inutilizar os símbolos oficiais do bem', { obrigatoria: true }),
                A.documento('Juntar o Termo de Doação e a publicação do resumo', 'Termo de doação', { forma: 'juntar', se: quando('Forma de destinação', 'Doação', 'Entidade sem fins lucrativos') }),
                A.documento('Juntar o edital e a ata do leilão', 'Ata', { forma: 'juntar', se: quando('Forma de destinação', 'Leilão') }),
                A.numero('Valor arrecadado (R$)', { se: quando('Forma de destinação', 'Leilão') }),
                A.documento('Juntar o termo de permuta, com a pesquisa de preços', 'Termo', { forma: 'juntar', se: quando('Forma de destinação', 'Permuta') }),
                A.documento('Juntar o comprovante da destinação ambientalmente adequada', 'Comprovante', { forma: 'juntar', se: quando('Forma de destinação', 'Descarte ambientalmente adequado', 'Incineração') }),
                A.data('Data da entrega ou da destinação', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Baixa patrimonial', unidade: 'Unidade de Patrimônio e Almoxarifado', avanco: 'auto', vai: ['Arquivamento'],
            orientacao: 'Com a autorização e o termo assinado, a Unidade de Patrimônio e Almoxarifado dá a baixa no Sistema de Controle Patrimonial e a baixa da responsabilidade de quem tinha a carga (Prov. 55/2022, art. 19; Prov. 02/2009, art. 6º, parágrafo único). A baixa entra na consolidação anual para a tomada de contas (art. 14, § 2º).',
            acoes: [
                A.escolha('Motivo da baixa', ['Perda', 'Furto', 'Dano', 'Doação', 'Leilão', 'Permuta', 'Descarte', 'Incineração'], { obrigatoria: true, destino: 'autos' }),
                A.data('Data da baixa no sistema', { obrigatoria: true }),
                A.fazer('Dar baixa da responsabilidade do detentor da carga', { obrigatoria: true }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Unidade de Patrimônio e Almoxarifado', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

export const modelos = [gestaoContratualMprs, descumprimentoContratualMprs, gestaoPatrimonioMprs];
