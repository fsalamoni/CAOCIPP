// Modelos da área correcional. Ver a forma de escrever em ./dsl.js e o exemplo em ./geral.js.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';
const PENAS_ORDINARIO = ['Advertência', 'Suspensão', 'Demissão', 'Cassação de aposentadoria ou disponibilidade', 'Destituição de cargo em comissão ou função'];
const PENAS_SUMARIO = ['Demissão', 'Cassação de aposentadoria ou disponibilidade', 'Destituição de cargo em comissão ou função'];

/** 2. Sindicância investigativa e investigação preliminar sumária (Lei 8.112/1990; PN CGU 27/2022). */
export function sindicanciaInvestigativa() {
    return montar({
        id: 'sindicancia-investigativa', nome: 'Sindicância investigativa e investigação preliminar sumária', area: 'correcional', porte: 'curto',
        descricao: 'Procedimento preparatório, sem acusado e sem punição, para descobrir se houve irregularidade e quem a praticou. Começa pelo juízo de admissibilidade da notícia, que pode arquivar, propor TAC, abrir a investigação ou ir direto ao processo acusatório. Na investigação, o sindicante ou a comissão examina documentos, requisita informações e ouve pessoas, com acesso restrito. Não há contraditório: o investigado pode ser ouvido, mas a defesa só nasce no processo acusatório que vier depois. Termina por arquivamento, TAC ou instauração do processo acusatório.',
        quando: 'Notícia de irregularidade funcional sem indícios suficientes de autoria e materialidade para abrir já um PAD ou sindicância acusatória.',
        base: 'Lei 8.112/1990, arts. 143 a 145; Portaria Normativa CGU 27/2022, arts. 36 a 52 (exemplo de boa prática fora do Executivo federal).',
        tipo: { polos: ['requerido', 'interessado'], nomes_polos: { requerido: 'Investigado', interessado: 'Noticiante' } },
    }, [
        {
            nome: 'Recebimento da notícia', unidade: 'Corregedoria', avanco: 'auto', ao_entrar: { sigilo: 'restrito' },
            orientacao: 'Registre a denúncia, representação ou relato. Recebida direto pela correição, encaminhe à ouvidoria e preserve a identidade do denunciante (PN 27, art. 36). Relato verbal se reduz a termo.',
            acoes: [
                A.formulario('Registrar a notícia do fato', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', opcoes: ['Denúncia identificada', 'Denúncia anônima', 'Representação', 'De ofício'], obrigatorio: true },
                    { id: 'data', rotulo: 'Data do conhecimento do fato', tipo: 'data', obrigatorio: true },
                    { id: 'fato', rotulo: 'Fato noticiado', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'envolvidos', rotulo: 'Servidores possivelmente envolvidos', tipo: 'texto' },
                    { id: 'sigilo_denunciante', rotulo: 'Preservar a identidade do denunciante?', tipo: 'sim_nao' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a denúncia, representação ou termo de declaração', 'Denúncia', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Juízo de admissibilidade', unidade: 'Corregedoria', vai: ['Instauração', 'Instauração do processo seguinte', 'Arquivamento'],
            orientacao: 'Decida de forma fundamentada (PN 27, art. 37). Se a notícia não descreve infração em tese, arquive (Lei 8.112, art. 144, parágrafo único). Já havendo indícios de autoria e materialidade, vá direto ao processo acusatório (art. 39). Denúncia anônima também passa por aqui (art. 38).',
            acoes: [
                A.escolha('Encaminhamento', ['Arquivar', 'Propor TAC', 'Instaurar investigação', 'Instaurar processo acusatório'], { obrigatoria: true }),
                A.documento('Juntar o despacho de admissibilidade', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: {
                'Instauração': quando('Encaminhamento', 'Instaurar investigação'),
                'Instauração do processo seguinte': quando('Encaminhamento', 'Propor TAC', 'Instaurar processo acusatório'),
                'Arquivamento': quando('Encaminhamento', 'Arquivar'),
            },
        },
        {
            nome: 'Instauração', unidade: 'Corregedoria', avanco: 'auto',
            orientacao: 'Instaure por despacho, sem publicação (PN 27, arts. 41, § 2º, e 47, § 1º). A IPS corre na própria unidade de correição; a SINVE, com um servidor ou comissão de dois ou mais, sem exigência de estabilidade (art. 47).',
            acoes: [
                A.escolha('Forma da apuração', ['Investigação preliminar sumária (IPS)', 'Sindicância investigativa (SINVE)', 'Sindicância patrimonial (SINPA)'], { obrigatoria: true, destino: 'informacao' }),
                A.texto('Responsável ou membros designados', { obrigatoria: true }),
                A.documento('Juntar o despacho de instauração e designação', 'Despacho', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Coleta de informações', unidade: 'Comissão processante', prazo_dias: 60, prazo_auto: true, prazo_contagem: corridos,
            vai: ['Aguardando informação externa', 'Relatório conclusivo'],
            orientacao: 'Examine documentos, requisite informações, ouça pessoas e faça diligências (PN 27, art. 42). Prazo: SINVE 60 dias, prorrogáveis (art. 48); IPS até 180 (art. 43); SINPA 30, prorrogáveis (art. 52). Ajuste o prazo conforme a forma. Oitivas reduzidas a termo, sem prazo de defesa.',
            acoes: [
                A.documento('Juntar documentos e respostas a requisições', '', { forma: 'juntar', nivel: 'recomendado' }),
                A.audiencia('Designar oitiva, se houver', 'oitiva'),
                A.comunicar('Intimar para a oitiva', { especie: 'intimacao', dias: 0, texto: 'Compareça para ser ouvido em {audiencia}. A oitiva tem caráter reservado.' }),
                A.documento('Juntar os termos de oitiva', 'Termo', { forma: 'qualquer', nivel: 'opcional' }),
                A.simNao('Falta informação ou diligência de outro órgão?', { obrigatoria: true, ajuda: 'Se sim, o processo aguarda a resposta e volta para esta fase. O prazo pode ser suspenso enquanto isso (PN 27, arts. 43, 48 e 52).' }),
            ],
            saidas: {
                'Aguardando informação externa': quando('Falta informação ou diligência de outro órgão?', 'sim'),
                'Relatório conclusivo': quando('Falta informação ou diligência de outro órgão?', 'nao'),
            },
        },
        {
            nome: 'Aguardando informação externa', unidade: 'Comissão processante', espera: true, avanco: 'auto',
            orientacao: 'Aguarde a resposta do órgão ou o resultado da diligência. Juntada a resposta, o processo volta à coleta de informações.',
            acoes: [A.documento('Juntar a resposta recebida', '', { forma: 'juntar' })],
        },
        {
            nome: 'Relatório conclusivo', unidade: 'Comissão processante', avanco: 'auto',
            orientacao: 'Conclua, dentro do prazo da apuração, por arquivamento, instauração de processo acusatório ou TAC (PN 27, art. 44), e remeta à autoridade instauradora.',
            acoes: [
                A.escolha('Conclusão', ['Arquivamento', 'Instauração de processo acusatório', 'Celebração de TAC'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o relatório final ou nota técnica', 'Relatório', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Decisão', unidade: 'Gabinete', vai: ['Instauração do processo seguinte', 'Arquivamento'], ao_entrar: { pendencia: 'Decidir sobre o relatório conclusivo da apuração' },
            orientacao: 'A autoridade instauradora decide sobre o relatório: arquiva ou manda instaurar o processo acusatório (PAD, sindicância acusatória ou rito sumário) ou o TAC.',
            acoes: [
                A.escolha('Decisão da autoridade', ['Arquivar', 'Instaurar processo acusatório', 'Celebrar TAC'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
            ],
            saidas: {
                'Instauração do processo seguinte': quando('Decisão da autoridade', 'Instaurar processo acusatório', 'Celebrar TAC'),
                'Arquivamento': quando('Decisão da autoridade', 'Arquivar'),
            },
        },
        {
            nome: 'Instauração do processo seguinte', unidade: 'Corregedoria', vai: ['Arquivamento'],
            orientacao: 'Abra o processo próprio (PAD, sindicância acusatória, rito sumário ou TAC) com cópia desta apuração e vincule os dois. Esta apuração se encerra a seguir.',
            acoes: [
                A.fazer('Abrir o processo próprio e vincular a este', { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a portaria ou o despacho do processo seguinte', 'Portaria', { forma: 'qualquer', nivel: 'recomendado' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Corregedoria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. A sindicância investigativa não interrompe a prescrição.' },
    ]);
}

/** 3-A. PAD, rito ordinário (Lei 8.112/1990, arts. 142 a 182). */
export function padOrdinario() {
    return montar({
        id: 'pad-ordinario', nome: 'Processo administrativo disciplinar, rito ordinário', area: 'correcional', porte: 'longo',
        descricao: 'Apura a responsabilidade de servidor por infração ligada ao cargo e pode terminar em qualquer sanção disciplinar, inclusive demissão. Uma comissão de três servidores estáveis instala os trabalhos, notifica o acusado e instrui com depoimentos, diligências e perícias, encerrando com o interrogatório. O contraditório está no acompanhamento de todos os atos desde a notificação prévia e na defesa escrita depois da indiciação, com defensor dativo em caso de revelia. A comissão faz o relatório conclusivo e outra autoridade julga em 20 dias, cabendo pedido de reconsideração ou recurso em 30 dias.',
        quando: 'Infração disciplinar de servidor cuja pena possível seja suspensão acima de 30 dias, demissão, cassação de aposentadoria ou destituição; ou quando a sindicância apontar autoria e materialidade.',
        base: 'Lei 8.112/1990, arts. 104 a 109, 142 a 182 e 238; Portaria Normativa CGU 27/2022, arts. 66, 76 a 78-A e 97 a 101.',
        tipo: { polos: ['requerido', 'terceiro'], nomes_polos: { requerido: 'Acusado', terceiro: 'Testemunha' } },
    }, [
        {
            nome: 'Instauração', unidade: 'Gabinete', ao_entrar: { sigilo: 'restrito' },
            orientacao: 'Publique a portaria que constitui a comissão de três servidores estáveis e indica o presidente, de cargo efetivo de nível igual ou superior, ou escolaridade igual ou superior, à do acusado (art. 149). A publicação interrompe a prescrição (art. 142, § 3º) e abre os 60 dias do processo, prorrogáveis por igual prazo (art. 152).',
            acoes: [
                A.formulario('Dados da instauração', [
                    { id: 'acusado', rotulo: 'Servidor acusado', tipo: 'texto', obrigatorio: true },
                    { id: 'matricula', rotulo: 'Matrícula e cargo', tipo: 'texto', obrigatorio: true },
                    { id: 'fatos', rotulo: 'Fatos a apurar', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'presidente', rotulo: 'Presidente da comissão', tipo: 'texto', obrigatorio: true },
                    { id: 'membros', rotulo: 'Demais membros', tipo: 'texto', obrigatorio: true },
                    { id: 'conhecimento', rotulo: 'Data do conhecimento do fato (prescrição)', tipo: 'data', obrigatorio: true },
                    { id: 'publicacao', rotulo: 'Data de publicação da portaria', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a portaria de instauração', 'Portaria', { forma: 'redigir' }),
                A.fazer('Publicar a portaria', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Instalação e notificação prévia', unidade: 'Comissão processante', vai: ['Afastamento preventivo', 'Instrução'],
            orientacao: 'Lavre a ata de instalação, designe o secretário (art. 149, § 1º) e confira impedimentos (art. 149, § 2º). Notifique o acusado da instauração e do direito de acompanhar todos os atos (art. 156; PN 27, art. 77), por edital se em local incerto. Comunique a gestão de pessoas (art. 172).',
            acoes: [
                A.documento('Juntar a ata de instalação', 'Ata', { forma: 'redigir' }),
                A.texto('Secretário designado', { obrigatoria: true }),
                A.simNao('Algum membro está impedido ou suspeito?', { obrigatoria: true, ajuda: 'Se sim, peça a substituição à autoridade instauradora antes de seguir (art. 149, § 2º).' }),
                A.comunicar('Notificar o acusado da instauração', { especie: 'notificacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Fica notificado da instauração do processo disciplinar e do direito de acompanhar todos os atos, pessoalmente ou por procurador, arrolar testemunhas e produzir provas. Querendo propor TAC, tem 10 dias.' }, { obrigatoria: true }),
                A.fazer('Comunicar a gestão de pessoas para bloquear exoneração a pedido e aposentadoria voluntária', { obrigatoria: true, ajuda: 'Art. 172 da Lei 8.112: o servidor só pode ser exonerado a pedido ou aposentado depois de concluído o processo e cumprida a penalidade.' }),
                A.simNao('Afastar preventivamente o acusado?', { obrigatoria: true, ajuda: 'Quando o acusado puder influir na apuração. Decide a autoridade instauradora (art. 147).' }),
            ],
            saidas: { 'Afastamento preventivo': quando('Afastar preventivamente o acusado?', 'sim'), 'Instrução': quando('Afastar preventivamente o acusado?', 'nao') },
        },
        {
            nome: 'Afastamento preventivo', unidade: 'Gabinete', vai: ['Instrução'],
            orientacao: 'Afastamento de até 60 dias, prorrogável por igual prazo, sem prejuízo da remuneração (art. 147). Findo o prazo, cessam os efeitos, ainda que o processo não tenha terminado.',
            acoes: [
                A.documento('Juntar a portaria de afastamento', 'Portaria', { forma: 'redigir' }),
                A.data('Data-limite do afastamento', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Instrução', unidade: 'Comissão processante', nome_publico: 'Instrução do processo',
            vai: ['Interrogatório', 'Aguardando perícia ou informação externa', 'Análise de proposta de TAC'],
            orientacao: 'Tome depoimentos, faça acareações, diligências e perícias (art. 155). O acusado pode arrolar e reinquirir testemunhas e formular quesitos (art. 156); o presidente nega pedidos impertinentes ou protelatórios (§ 1º). Intime o acusado para cada ato com 3 dias úteis de antecedência (Lei 9.784, art. 41). Testemunha servidora: comunique a chefia (art. 157).',
            acoes: [
                A.audiencia('Designar depoimento de testemunha', 'oitiva'),
                A.comunicar('Intimar a testemunha', { especie: 'intimacao', polos: ['terceiro'], dias: 0, texto: 'Compareça para depor como testemunha em {audiencia}. O depoimento tem caráter reservado.' }),
                A.comunicar('Intimar o acusado para acompanhar o ato', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado a acompanhar, pessoalmente ou por procurador, o ato designado para {audiencia}.' }),
                A.documento('Juntar os termos de depoimento', 'Termo', { forma: 'qualquer', nivel: 'recomendado' }),
                A.documento('Juntar as atas de deliberação', 'Ata', { forma: 'redigir', nivel: 'recomendado' }),
                A.documento('Juntar laudos e relatórios de diligência', '', { forma: 'juntar', nivel: 'opcional' }),
                A.simNao('Há dúvida sobre a sanidade mental do acusado?', { ajuda: 'Se sim, proponha exame por junta médica oficial, em auto apartado (art. 160).' }),
                A.simNao('Prorrogar o prazo ou reconduzir a comissão?', { ajuda: 'O prazo é de 60 dias, prorrogável por igual prazo (art. 152). Passado isso, a autoridade reconduz por nova portaria.' }),
                A.documento('Juntar a portaria de prorrogação ou recondução', 'Portaria', { forma: 'juntar', se: quando('Prorrogar o prazo ou reconduzir a comissão?', 'sim') }),
                A.escolha('Próximo passo', ['Interrogar o acusado', 'Aguardar perícia ou informação externa', 'Sugerir TAC'], { obrigatoria: true, ajuda: 'O interrogatório vem depois de ouvidas as testemunhas (art. 159). Conduta reenquadrada como de menor potencial ofensivo permite sugerir TAC (PN 27, art. 66, § 2º).' }),
            ],
            saidas: {
                'Interrogatório': quando('Próximo passo', 'Interrogar o acusado'),
                'Aguardando perícia ou informação externa': quando('Próximo passo', 'Aguardar perícia ou informação externa'),
                'Análise de proposta de TAC': quando('Próximo passo', 'Sugerir TAC'),
            },
        },
        {
            nome: 'Aguardando perícia ou informação externa', unidade: 'Comissão processante', espera: true, avanco: 'auto',
            orientacao: 'Aguarde o laudo, a junta médica ou a resposta do órgão. Juntado o resultado, o processo volta à instrução.',
            acoes: [A.documento('Juntar o laudo ou a resposta', '', { forma: 'juntar' })],
        },
        {
            nome: 'Análise de proposta de TAC', unidade: 'Gabinete', vai: ['Arquivamento', 'Instrução'],
            orientacao: 'Depois de instaurado o processo, só a autoridade instauradora celebra o TAC (PN 27, art. 65). Confira os requisitos (arts. 62 e 63). Celebrado, siga pelo rito de TAC disciplinar e encerre este; indeferido, a instrução continua (art. 66, § 3º).',
            acoes: [
                A.simNao('Requisitos presentes e TAC celebrado?', { obrigatoria: true, ajuda: 'Infração punível com advertência ou suspensão de até 30 dias, sem penalidade vigente, sem TAC nos últimos 2 anos e dano ressarcido ou com compromisso de ressarcir.' }),
                A.documento('Juntar o termo de ajustamento de conduta', 'Termo', { forma: 'juntar', se: quando('Requisitos presentes e TAC celebrado?', 'sim') }),
                A.documento('Juntar a decisão de indeferimento', 'Decisão', { forma: 'redigir', se: quando('Requisitos presentes e TAC celebrado?', 'nao') }),
            ],
            saidas: { 'Arquivamento': quando('Requisitos presentes e TAC celebrado?', 'sim'), 'Instrução': quando('Requisitos presentes e TAC celebrado?', 'nao') },
        },
        {
            nome: 'Interrogatório', unidade: 'Comissão processante', vai: ['Indiciação e citação', 'Relatório final'],
            orientacao: 'Interrogue o acusado depois de ouvidas as testemunhas (art. 159). Havendo mais de um, cada um é ouvido separadamente; o procurador assiste e pode reinquirir por intermédio do presidente (art. 159, §§ 1º e 2º). Em seguida, decida se há tipificação: com ela, indicie (art. 161); sem ela, vá ao relatório pela absolvição.',
            acoes: [
                A.audiencia('Designar o interrogatório', 'oitiva'),
                A.comunicar('Intimar o acusado para o interrogatório', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Compareça, com seu procurador, se houver, para ser interrogado em {audiencia}.' }, { obrigatoria: true }),
                A.documento('Juntar o termo de interrogatório', 'Termo', { forma: 'qualquer' }),
                A.simNao('A infração ficou tipificada?', { obrigatoria: true }),
            ],
            saidas: { 'Indiciação e citação': quando('A infração ficou tipificada?', 'sim'), 'Relatório final': quando('A infração ficou tipificada?', 'nao') },
        },
        {
            nome: 'Indiciação e citação', unidade: 'Comissão processante', nome_publico: 'Defesa escrita', vai: ['Relatório final', 'Revelia e defensor dativo'],
            orientacao: 'Lavre o termo de indiciação com os fatos e as provas (art. 161) e cite o acusado por mandado, com vista dos autos. Defesa em 10 dias; 20 dias comuns se houver dois ou mais indiciados; 15 dias da última publicação se citado por edital (art. 163). Prazo prorrogável pelo dobro para diligências indispensáveis. Recusa do ciente: termo com duas testemunhas (art. 161, § 4º).',
            acoes: [
                A.documento('Juntar o termo de indiciação', 'Termo', { forma: 'redigir' }),
                A.comunicar('Citar o indiciado para a defesa escrita', { especie: 'citacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Fica citado para apresentar defesa escrita em 10 dias, com vista dos autos na repartição, nos termos do termo de indiciação anexo.' }, { obrigatoria: true, ajuda: 'Ajuste para 20 dias com dois ou mais indiciados, ou 15 dias se a citação for por edital (arts. 161, § 1º, e 163).' }),
                A.esperar('Aguardar a defesa escrita', 'Citar o indiciado para a defesa escrita', { obrigatoria: true }),
            ],
            saidas: {
                'Relatório final': quando('Aguardar a defesa escrita', 'Apresentada', 'Parcial'),
                'Revelia e defensor dativo': quando('Aguardar a defesa escrita', 'Sem manifestação'),
            },
        },
        {
            nome: 'Revelia e defensor dativo', unidade: 'Comissão processante', prazo_dias: 10, prazo_auto: true, prazo_contagem: corridos, vai: ['Relatório final'],
            orientacao: 'Declare a revelia por termo. A autoridade instauradora designa defensor dativo, servidor de cargo ou escolaridade igual ou superior à do indiciado, e o prazo de defesa é devolvido (art. 164, §§ 1º e 2º). A revelia não gera confissão.',
            acoes: [
                A.documento('Juntar o termo de revelia', 'Termo', { forma: 'redigir' }),
                A.documento('Juntar a portaria de designação do defensor dativo', 'Portaria', { forma: 'juntar' }),
                A.documento('Juntar a defesa do defensor dativo', 'Defesa', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Relatório final', unidade: 'Comissão processante', vai: ['Parecer jurídico', 'Julgamento'],
            orientacao: 'Relatório minucioso, sempre conclusivo pela inocência ou pela responsabilidade, com o dispositivo violado e as agravantes e atenuantes (art. 165). Sem consenso, decide a maioria, com voto divergente em apartado (PN 27, art. 78-A). Remeta os autos à autoridade instauradora (art. 166).',
            acoes: [
                A.escolha('Conclusão da comissão', ['Inocência', 'Responsabilidade'], { obrigatoria: true, destino: 'autos' }),
                A.textoLongo('Dispositivos violados, agravantes e atenuantes', { obrigatoria: true, se: quando('Conclusão da comissão', 'Responsabilidade') }),
                A.documento('Juntar o relatório final', 'Relatório', { forma: 'redigir' }),
                A.simNao('Houve voto divergente?', { obrigatoria: true }),
                A.documento('Juntar o voto divergente', 'Voto', { forma: 'redigir', se: quando('Houve voto divergente?', 'sim') }),
                A.documento('Juntar a ata de encerramento', 'Ata', { forma: 'redigir' }),
                A.simNao('Submeter a parecer jurídico antes do julgamento?', { obrigatoria: true, ajuda: 'A Lei 8.112 não exige; é prática consolidada.' }),
            ],
            saidas: { 'Parecer jurídico': quando('Submeter a parecer jurídico antes do julgamento?', 'sim'), 'Julgamento': quando('Submeter a parecer jurídico antes do julgamento?', 'nao') },
        },
        {
            nome: 'Parecer jurídico', unidade: 'Assessoria jurídica', avanco: 'auto',
            orientacao: 'Examine a regularidade do processo e a adequação da pena proposta. A Lei 8.112 não fixa prazo para o parecer.',
            acoes: [A.documento('Juntar o parecer', 'Parecer', { forma: 'redigir' })],
        },
        {
            nome: 'Julgamento', unidade: 'Gabinete', prazo_dias: 20, prazo_auto: true, prazo_contagem: corridos,
            vai: ['Pedido de reconsideração e recurso', 'Execução e registro', 'Instalação e notificação prévia', 'Arquivamento'],
            ao_entrar: { pendencia: 'Julgar o processo disciplinar em 20 dias do recebimento (art. 167)' },
            orientacao: 'Julgue em 20 dias (art. 167); fora do prazo não há nulidade (art. 169, § 1º). Acate o relatório, salvo se contrário às provas, motivando a divergência (art. 168). Pena acima da alçada: remeta à autoridade competente (art. 167, § 1º). Vício insanável: declare a nulidade e constitua nova comissão (art. 169).',
            acoes: [
                A.simNao('A pena proposta está na alçada desta autoridade?', { obrigatoria: true, ajuda: 'Se não, remeta à autoridade competente, que julga em igual prazo (art. 167, §§ 1º a 3º).' }),
                A.fazer('Remeter à autoridade competente', { se: quando('A pena proposta está na alçada desta autoridade?', 'nao') }),
                A.escolha('Resultado do julgamento', ['Absolvição', ...PENAS_ORDINARIO, 'Nulidade e nova comissão'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.simNao('O julgamento acata o relatório da comissão?', { obrigatoria: true }),
                A.textoLongo('Motivação para divergir do relatório', { obrigatoria: true, se: quando('O julgamento acata o relatório da comissão?', 'nao') }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
                A.documento('Juntar e publicar a portaria de penalidade', 'Portaria', { forma: 'redigir', se: quando('Resultado do julgamento', ...PENAS_ORDINARIO) }),
                A.comunicar('Intimar da absolvição', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado do julgamento que o absolveu e determinou o arquivamento.' }, { obrigatoria: true, se: quando('Resultado do julgamento', 'Absolvição') }),
                A.comunicar('Intimar da penalidade', { especie: 'intimacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Fica intimado do julgamento e da penalidade aplicada. Cabe pedido de reconsideração ou recurso em 30 dias (Lei 8.112, art. 108).' }, { obrigatoria: true, se: quando('Resultado do julgamento', ...PENAS_ORDINARIO) }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar da penalidade', { obrigatoria: true, se: quando('Resultado do julgamento', ...PENAS_ORDINARIO) }),
            ],
            saidas: {
                'Pedido de reconsideração e recurso': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'),
                'Execução e registro': quando('Aguardar o prazo de recurso', 'Sem manifestação'),
                'Instalação e notificação prévia': quando('Resultado do julgamento', 'Nulidade e nova comissão'),
                'Arquivamento': quando('Resultado do julgamento', 'Absolvição'),
            },
        },
        {
            nome: 'Pedido de reconsideração e recurso', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, nome_publico: 'Recurso', vai: ['Execução e registro'],
            orientacao: 'O pedido de reconsideração vai a quem decidiu; o recurso, à autoridade superior (arts. 106 e 107). Despacho em 5 dias e decisão em 30 (art. 106, parágrafo único). Efeito suspensivo a juízo da autoridade (art. 109). Indeferida a reconsideração, ainda cabe recurso.',
            acoes: [
                A.escolha('Espécie', ['Pedido de reconsideração', 'Recurso hierárquico'], { obrigatoria: true }),
                A.simNao('Conceder efeito suspensivo?', { obrigatoria: true }),
                A.escolha('Resultado', ['Provido', 'Provido em parte', 'Não provido', 'Não conhecido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado da decisão sobre o pedido de reconsideração ou recurso.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Execução e registro', unidade: 'Secretaria', vai: ['Arquivamento'],
            orientacao: 'Encaminhe à gestão de pessoas para registrar a penalidade nos assentamentos e cumprir a portaria. Havendo indícios que exijam remessa a outros órgãos, envie cópia dos autos (art. 171).',
            acoes: [
                A.fazer('Registrar a penalidade nos assentamentos funcionais', { obrigatoria: true, destino: 'autos' }),
                A.simNao('Há indícios que exijam remessa a outros órgãos?', { obrigatoria: true, ajuda: 'Art. 171 da Lei 8.112: remessa de cópia dos autos ao Ministério Público.' }),
                A.documento('Juntar o ofício de remessa', 'Ofício', { forma: 'redigir', se: quando('Há indícios que exijam remessa a outros órgãos?', 'sim') }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Cabe revisão a qualquer tempo por fato novo, sem agravar a pena (arts. 174 a 182).' },
    ]);
}

/** 3-B. PAD, rito sumário (Lei 8.112/1990, arts. 133 e 140). */
export function padSumario() {
    return montar({
        id: 'pad-sumario', nome: 'Processo administrativo disciplinar, rito sumário', area: 'correcional', porte: 'medio',
        descricao: 'Rito abreviado para três infrações de prova documental: acumulação ilegal de cargos, abandono de cargo e inassiduidade habitual. Na acumulação, o servidor é primeiro notificado para optar por um dos cargos em 10 dias. A comissão de dois servidores estáveis indicia em até 3 dias da portaria, que já aponta autoria e materialidade, e cita o acusado para defesa escrita em 5 dias, com defensor dativo na revelia. Segue o relatório conclusivo e o julgamento em 5 dias, que pode resultar em demissão, com recurso como no rito ordinário.',
        quando: 'Acumulação ilegal de cargos, abandono de cargo (mais de 30 dias de ausência intencional) ou inassiduidade habitual (60 faltas interpoladas em 12 meses). Na dúvida sobre a infração, use o rito ordinário.',
        base: 'Lei 8.112/1990, arts. 104 a 109, 133, 140, 163, 164 e 238; Portaria Normativa CGU 27/2022, arts. 79 e 80.',
        tipo: { polos: ['requerido'], nomes_polos: { requerido: 'Acusado' } },
    }, [
        {
            nome: 'Enquadramento', unidade: 'Corregedoria', vai: ['Notificação para opção', 'Instauração', 'Arquivamento'],
            orientacao: 'Confirme que a infração é uma das três do rito sumário e que a prova é documental. Na dúvida sobre a natureza da infração, siga pelo rito ordinário (PN 27, art. 79, § 2º). Na acumulação, notifique antes para a opção (art. 133, caput).',
            acoes: [
                A.escolha('Infração', ['Acumulação ilegal de cargos', 'Abandono de cargo', 'Inassiduidade habitual', 'Natureza duvidosa: rito ordinário'], { obrigatoria: true, destino: 'informacao' }),
                A.documento('Juntar o despacho de remessa ao rito ordinário', 'Despacho', { forma: 'redigir', se: quando('Infração', 'Natureza duvidosa: rito ordinário') }),
            ],
            saidas: {
                'Notificação para opção': quando('Infração', 'Acumulação ilegal de cargos'),
                'Instauração': quando('Infração', 'Abandono de cargo', 'Inassiduidade habitual'),
                'Arquivamento': quando('Infração', 'Natureza duvidosa: rito ordinário'),
            },
        },
        {
            nome: 'Notificação para opção', unidade: 'Corregedoria', nome_publico: 'Opção por um dos cargos', vai: ['Arquivamento', 'Instauração'],
            orientacao: 'Notifique o servidor, por intermédio da chefia imediata, para optar por um dos cargos em 10 dias improrrogáveis (art. 133, caput). Feita a opção, a acumulação se regulariza; na omissão, instaure o rito sumário.',
            acoes: [
                A.comunicar('Notificar para a opção', { especie: 'notificacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Fica notificado para, em 10 dias improrrogáveis, optar por um dos cargos, empregos ou funções que acumula, sob pena de processo disciplinar pelo rito sumário.' }, { obrigatoria: true }),
                A.esperar('Aguardar a opção', 'Notificar para a opção', { obrigatoria: true }),
                A.simNao('O servidor fez a opção?', { obrigatoria: true }),
            ],
            saidas: { 'Arquivamento': quando('O servidor fez a opção?', 'sim'), 'Instauração': quando('O servidor fez a opção?', 'nao') },
        },
        {
            nome: 'Instauração', unidade: 'Gabinete', ao_entrar: { sigilo: 'restrito' },
            orientacao: 'Publique a portaria com a comissão de dois servidores estáveis e a indicação da autoria (nome e matrícula) e da materialidade (art. 133, I e § 1º; art. 140, I). O processo dura até 30 dias da publicação, prorrogáveis por até 15 (art. 133, § 7º).',
            acoes: [
                A.formulario('Autoria e materialidade', [
                    { id: 'acusado', rotulo: 'Nome do servidor', tipo: 'texto', obrigatorio: true },
                    { id: 'matricula', rotulo: 'Matrícula', tipo: 'texto', obrigatorio: true },
                    { id: 'materialidade', rotulo: 'Materialidade (cargos acumulados, período de ausência ou dias de falta)', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'membros', rotulo: 'Membros da comissão', tipo: 'texto', obrigatorio: true },
                    { id: 'publicacao', rotulo: 'Data de publicação da portaria', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a portaria de instauração', 'Portaria', { forma: 'redigir' }),
                A.fazer('Publicar a portaria', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Indiciação', unidade: 'Comissão processante', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, avanco: 'auto',
            orientacao: 'Em até 3 dias da publicação da portaria, lavre o termo de indiciação com a transcrição da autoria e da materialidade (art. 133, § 2º).',
            acoes: [A.documento('Juntar o termo de indiciação', 'Termo', { forma: 'redigir' })],
        },
        {
            nome: 'Citação e defesa', unidade: 'Comissão processante', nome_publico: 'Defesa escrita', vai: ['Relatório conclusivo', 'Revelia e defensor dativo'],
            orientacao: 'Cite o indiciado pessoalmente ou por intermédio da chefia imediata, com 5 dias para defesa escrita e vista dos autos (art. 133, § 2º). Em lugar incerto, cite por edital (art. 163).',
            acoes: [
                A.comunicar('Citar para a defesa escrita', { especie: 'citacao', polos: ['requerido'], dias: 5, contagem: corridos, texto: 'Fica citado para apresentar defesa escrita em 5 dias, com vista dos autos, nos termos do termo de indiciação anexo.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa', 'Citar para a defesa escrita', { obrigatoria: true }),
            ],
            saidas: {
                'Relatório conclusivo': quando('Aguardar a defesa', 'Apresentada', 'Parcial'),
                'Revelia e defensor dativo': quando('Aguardar a defesa', 'Sem manifestação'),
            },
        },
        {
            nome: 'Revelia e defensor dativo', unidade: 'Comissão processante', prazo_dias: 5, prazo_auto: true, prazo_contagem: corridos, vai: ['Relatório conclusivo'],
            orientacao: 'Declare a revelia por termo; a autoridade instauradora designa defensor dativo e o prazo de defesa é devolvido (arts. 133, § 8º, e 164).',
            acoes: [
                A.documento('Juntar o termo de revelia', 'Termo', { forma: 'redigir' }),
                A.documento('Juntar a portaria de designação do defensor dativo', 'Portaria', { forma: 'juntar' }),
                A.documento('Juntar a defesa do defensor dativo', 'Defesa', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Relatório conclusivo', unidade: 'Comissão processante', avanco: 'auto',
            orientacao: 'Relatório conclusivo sobre a inocência ou a responsabilidade, resumindo as peças e indicando o dispositivo legal (art. 133, § 3º; art. 140, II). Na acumulação, a opção feita até o último dia da defesa presume boa-fé e vira pedido de exoneração do outro cargo (art. 133, § 5º). Remeta à autoridade instauradora.',
            acoes: [
                A.escolha('Conclusão da comissão', ['Inocência', 'Responsabilidade', 'Opção de boa-fé (acumulação)'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o relatório', 'Relatório', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Julgamento', unidade: 'Gabinete', prazo_dias: 5, prazo_auto: true, prazo_contagem: corridos,
            vai: ['Pedido de reconsideração e recurso', 'Execução e registro', 'Arquivamento'],
            ao_entrar: { pendencia: 'Julgar o processo disciplinar sumário em 5 dias do recebimento (art. 133, § 4º)' },
            orientacao: 'Julgue em 5 dias do recebimento (art. 133, § 4º). Provada a má-fé na acumulação, aplica-se demissão, destituição ou cassação (art. 133, § 6º). Na opção de boa-fé, converta em exoneração do outro cargo (art. 133, § 5º).',
            acoes: [
                A.escolha('Resultado do julgamento', ['Absolvição', 'Exoneração do outro cargo (boa-fé)', ...PENAS_SUMARIO], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
                A.documento('Juntar e publicar a portaria de penalidade', 'Portaria', { forma: 'redigir', se: quando('Resultado do julgamento', ...PENAS_SUMARIO) }),
                A.comunicar('Intimar do julgamento sem penalidade', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado do julgamento, que não aplicou penalidade.' }, { obrigatoria: true, se: quando('Resultado do julgamento', 'Absolvição', 'Exoneração do outro cargo (boa-fé)') }),
                A.comunicar('Intimar da penalidade', { especie: 'intimacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Fica intimado do julgamento e da penalidade aplicada. Cabe pedido de reconsideração ou recurso em 30 dias (Lei 8.112, art. 108).' }, { obrigatoria: true, se: quando('Resultado do julgamento', ...PENAS_SUMARIO) }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar da penalidade', { obrigatoria: true, se: quando('Resultado do julgamento', ...PENAS_SUMARIO) }),
            ],
            saidas: {
                'Pedido de reconsideração e recurso': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'),
                'Execução e registro': quando('Aguardar o prazo de recurso', 'Sem manifestação'),
                'Arquivamento': quando('Resultado do julgamento', 'Absolvição', 'Exoneração do outro cargo (boa-fé)'),
            },
        },
        {
            nome: 'Pedido de reconsideração e recurso', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, nome_publico: 'Recurso', vai: ['Execução e registro'],
            orientacao: 'Como no rito ordinário: reconsideração a quem decidiu, recurso à autoridade superior (arts. 106 e 107). Despacho em 5 dias e decisão em 30 (art. 106, parágrafo único). Efeito suspensivo a juízo da autoridade (art. 109).',
            acoes: [
                A.escolha('Espécie', ['Pedido de reconsideração', 'Recurso hierárquico'], { obrigatoria: true }),
                A.simNao('Conceder efeito suspensivo?', { obrigatoria: true }),
                A.escolha('Resultado', ['Provido', 'Provido em parte', 'Não provido', 'Não conhecido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado da decisão sobre o pedido de reconsideração ou recurso.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Execução e registro', unidade: 'Secretaria', vai: ['Arquivamento'],
            orientacao: 'Encaminhe à gestão de pessoas para cumprir a portaria e registrar a penalidade nos assentamentos. Havendo indícios que exijam remessa a outros órgãos, envie cópia dos autos (art. 171).',
            acoes: [
                A.fazer('Registrar a penalidade nos assentamentos funcionais', { obrigatoria: true, destino: 'autos' }),
                A.simNao('Há indícios que exijam remessa a outros órgãos?', { obrigatoria: true }),
                A.documento('Juntar o ofício de remessa', 'Ofício', { forma: 'redigir', se: quando('Há indícios que exijam remessa a outros órgãos?', 'sim') }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

/** 17. Termo de ajustamento de conduta disciplinar (PN CGU 27/2022, arts. 61 a 69). */
export function tacDisciplinar() {
    return montar({
        id: 'tac-disciplinar', nome: 'Termo de ajustamento de conduta disciplinar', area: 'correcional', porte: 'curto',
        descricao: 'Substitui o processo disciplinar por um compromisso escrito quando a infração é de menor potencial ofensivo, punível com advertência ou suspensão de até 30 dias. A proposta nasce de ofício, da comissão ou do próprio servidor; confere-se se ele não tem sanção vigente nem TAC nos últimos 2 anos e se o dano foi ressarcido. Não há acusação nem julgamento: o servidor aceita ou não as obrigações redigidas no termo. Celebrado e publicado o extrato, a chefia acompanha o cumprimento por até 2 anos; cumprido, arquiva-se; descumprido, apura-se a falta.',
        quando: 'Infração disciplinar leve, punível com advertência ou suspensão de até 30 dias, de servidor que preenche os requisitos e aceita ajustar a conduta.',
        base: 'Portaria Normativa CGU 27/2022, arts. 61 a 69 (exemplo para outros órgãos); Lei 8.112/1990, art. 116, III.',
        tipo: { polos: ['requerido'], nomes_polos: { requerido: 'Servidor compromissário' } },
    }, [
        {
            nome: 'Proposta', unidade: 'Corregedoria', avanco: 'auto',
            orientacao: 'A proposta pode vir de ofício, da comissão ou do servidor (art. 66). Com processo já instaurado, o servidor tem 10 dias da notificação como acusado (art. 66, § 1º) e só a autoridade instauradora celebra (art. 65).',
            acoes: [
                A.escolha('Origem da proposta', ['De ofício', 'Sugerida pela comissão', 'Apresentada pelo servidor'], { obrigatoria: true, destino: 'informacao' }),
                A.simNao('Já há processo disciplinar instaurado?', { obrigatoria: true }),
                A.texto('Número do processo disciplinar', { obrigatoria: true, se: quando('Já há processo disciplinar instaurado?', 'sim') }),
                A.documento('Juntar a proposta', 'Requerimento', { forma: 'juntar', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Verificação dos requisitos', unidade: 'Corregedoria', vai: ['Negociação e redação', 'Arquivamento'],
            orientacao: 'Confira os requisitos dos arts. 62 e 63. Ausente algum, indefira de forma fundamentada e o processo disciplinar segue (art. 66, § 3º).',
            acoes: [
                A.formulario('Conferir os requisitos', [
                    { id: 'menor_potencial', rotulo: 'Infração punível com advertência ou suspensão de até 30 dias?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'sem_penalidade', rotulo: 'Sem penalidade vigente nos assentamentos?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'sem_tac', rotulo: 'Sem TAC celebrado nos últimos 2 anos?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'dano', rotulo: 'Dano ressarcido ou com compromisso de ressarcir?', tipo: 'sim_nao', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao' }),
                A.simNao('Requisitos presentes?', { obrigatoria: true }),
                A.documento('Juntar a decisão de indeferimento', 'Decisão', { forma: 'redigir', se: quando('Requisitos presentes?', 'nao') }),
                A.comunicar('Comunicar o indeferimento', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'A proposta de termo de ajustamento de conduta foi indeferida por falta de requisito, conforme decisão anexa.' }, { obrigatoria: true, se: quando('Requisitos presentes?', 'nao') }),
            ],
            saidas: { 'Negociação e redação': quando('Requisitos presentes?', 'sim'), 'Arquivamento': quando('Requisitos presentes?', 'nao') },
        },
        {
            nome: 'Negociação e redação', unidade: 'Corregedoria', vai: ['Celebração', 'Arquivamento'],
            orientacao: 'Redija o termo com qualificação do servidor, fundamentos, obrigações proporcionais, prazo e modo de cumprimento e forma de fiscalização (art. 67). O prazo de cumprimento é de no máximo 2 anos (art. 68, § 2º).',
            acoes: [
                A.formulario('Conteúdo do termo', [
                    { id: 'obrigacoes', rotulo: 'Obrigações assumidas', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'prazo_meses', rotulo: 'Prazo de cumprimento (meses, até 24)', tipo: 'numero', obrigatorio: true },
                    { id: 'fiscalizacao', rotulo: 'Forma de fiscalização', tipo: 'texto', obrigatorio: true },
                    { id: 'ressarcimento', rotulo: 'Há ressarcimento de dano?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor a ressarcir', tipo: 'numero' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Redigir a minuta do termo', 'Termo', { forma: 'redigir' }),
                A.simNao('O servidor aceitou as obrigações?', { obrigatoria: true, ajuda: 'Se não aceitar, o termo não se celebra e o caso segue pelo processo disciplinar.' }),
            ],
            saidas: { 'Celebração': quando('O servidor aceitou as obrigações?', 'sim'), 'Arquivamento': quando('O servidor aceitou as obrigações?', 'nao') },
        },
        {
            nome: 'Celebração', unidade: 'Gabinete', avanco: 'auto',
            orientacao: 'Celebra o titular da unidade de correição; depois de instaurado o processo, só a autoridade instauradora (art. 65).',
            acoes: [A.documento('Juntar o termo assinado', 'Termo', { forma: 'juntar' })],
        },
        {
            nome: 'Publicação e comunicação', unidade: 'Secretaria', avanco: 'auto',
            orientacao: 'Publique o extrato em boletim interno ou diário oficial, com número do processo, nome do servidor e descrição genérica do fato, e envie cópia do termo à chefia imediata (art. 69).',
            acoes: [
                A.documento('Juntar o extrato publicado', 'Extrato', { forma: 'juntar' }),
                A.fazer('Enviar cópia do termo à chefia imediata', { obrigatoria: true }),
                A.comunicar('Dar ciência ao servidor', { especie: 'ciencia', polos: ['requerido'], dias: 0, texto: 'Dê ciência da celebração do termo de ajustamento de conduta e das obrigações nele previstas.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Acompanhamento', unidade: 'Corregedoria', nome_publico: 'Cumprimento do termo', vai: ['Arquivamento', 'Apuração do descumprimento'],
            orientacao: 'A chefia imediata ou a correição fiscaliza o cumprimento no prazo do termo, no máximo 2 anos (art. 68, § 2º). Ao fim, certifique o resultado.',
            acoes: [
                A.data('Data-limite do cumprimento', { obrigatoria: true }),
                A.documento('Juntar os relatos da chefia imediata', '', { forma: 'juntar', nivel: 'recomendado' }),
                A.simNao('O servidor cumpriu as obrigações?', { obrigatoria: true }),
                A.documento('Juntar a certidão de cumprimento', 'Certidão', { forma: 'redigir', se: quando('O servidor cumpriu as obrigações?', 'sim') }),
            ],
            saidas: { 'Arquivamento': quando('O servidor cumpriu as obrigações?', 'sim'), 'Apuração do descumprimento': quando('O servidor cumpriu as obrigações?', 'nao') },
        },
        {
            nome: 'Apuração do descumprimento', unidade: 'Corregedoria', vai: ['Arquivamento'],
            orientacao: 'O descumprimento configura falta ao dever do art. 116, III, da Lei 8.112 (art. 68, § 3º). Instaure ou retome o processo disciplinar e vincule-o a este.',
            acoes: [
                A.documento('Juntar o despacho sobre o descumprimento', 'Despacho', { forma: 'redigir' }),
                A.fazer('Instaurar ou retomar o processo disciplinar', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

export const modelos = [sindicanciaInvestigativa, padOrdinario, padSumario, tacDisciplinar];
