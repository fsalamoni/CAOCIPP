// Modelos de atendimento, controle e gestão interna. Ver a forma de escrever em ./dsl.js e o exemplo em ./geral.js.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';

/** 12-A. Manifestação de ouvidoria (Lei 13.460/2017; Decreto 9.492/2018). */
export function manifestacaoOuvidoria() {
    return montar({
        id: 'ouvidoria', nome: 'Manifestação de ouvidoria', area: 'atendimento', porte: 'curto', referencia: 'Lei 13.460',
        descricao: 'Trata reclamação, denúncia, elogio, sugestão e solicitação de providências sobre serviço público. A ouvidoria recebe sem recusar e sem exigir motivo, classifica, pede complementação uma vez se faltar informação e aciona a área responsável, que responde em 20 dias. A denúncia não é apurada pela ouvidoria: segue ao órgão apuratório, e a identidade do manifestante fica protegida. Termina com a resposta conclusiva em até 30 dias corridos, prorrogáveis uma vez; a lei não prevê recurso.',
        quando: 'Qualquer manifestação do usuário sobre serviço público que não seja pedido de acesso a informação (este tem rito próprio, pela Lei 12.527).',
        base: 'Lei 13.460/2017, arts. 9º a 16; Decreto 9.492/2018, arts. 3º e 12 a 23.',
        tipo: { polos: ['requerente'], nomes_polos: { requerente: 'Manifestante' } },
    }, [
        {
            nome: 'Recebimento e registro', unidade: 'Ouvidoria', avanco: 'auto', ao_entrar: { sigilo: 'restrito' },
            orientacao: 'Receba sempre (Lei 13.460, art. 11) e não exija motivo (art. 10, § 2º) nem identificação que inviabilize a manifestação (§ 1º). Manifestação verbal é reduzida a termo (§ 4º). A identidade do manifestante é informação pessoal protegida (§ 7º). Envie o comprovante de recebimento (art. 12, parágrafo único, II).',
            acoes: [
                A.formulario('Registrar a manifestação', [
                    { id: 'tipo', rotulo: 'Tipo de manifestação', tipo: 'lista', obrigatorio: true, opcoes: ['Reclamação', 'Denúncia', 'Elogio', 'Sugestão', 'Solicitação de providências'] },
                    { id: 'meio', rotulo: 'Meio de entrada', tipo: 'lista', obrigatorio: true, opcoes: ['Internet', 'Presencial', 'Telefone', 'Correspondência'] },
                    { id: 'identificado', rotulo: 'Manifestante identificado?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'servico', rotulo: 'Serviço ou unidade a que se refere', tipo: 'texto', obrigatorio: false },
                    { id: 'relato', rotulo: 'Relato da manifestação', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a manifestação ou o termo de redução', 'Termo', { forma: 'qualquer' }),
                A.comunicar('Enviar o comprovante de recebimento', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Sua manifestação foi recebida e registrada. Guarde o número do protocolo para acompanhar.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Análise prévia e classificação', unidade: 'Ouvidoria', vai: ['Pedido de complementação', 'Encaminhamento à área responsável', 'Encaminhamento ao órgão apuratório', 'Resposta conclusiva', 'Arquivamento'],
            orientacao: 'Confirme o tipo (Decreto 9.492, art. 3º). Elogio vai ao agente e à chefia (art. 19); reclamação e solicitação, à autoridade do serviço (art. 20); sugestão, a quem diz se pode adotá-la (art. 21). Denúncia com elementos mínimos segue ao órgão apuratório (art. 22). Matéria de outra ouvidoria: remeta e avise o manifestante.',
            acoes: [
                A.escolha('Próximo passo', ['Encaminhar à área responsável', 'Encaminhar ao órgão apuratório', 'Pedir complementação ao manifestante', 'Responder sem encaminhar', 'Remeter a outra ouvidoria'], { obrigatoria: true, ajuda: 'Responder sem encaminhar: quando a ouvidoria já tem a resposta ou a denúncia não traz elementos mínimos (a resposta informa o arquivamento).' }),
                A.texto('Ouvidoria de destino', { obrigatoria: true, se: quando('Próximo passo', 'Remeter a outra ouvidoria') }),
                A.comunicar('Avisar o manifestante da remessa', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Sua manifestação trata de matéria de outro órgão e foi remetida à ouvidoria competente, indicada a seguir.' }, { obrigatoria: true, se: quando('Próximo passo', 'Remeter a outra ouvidoria') }),
            ],
            saidas: {
                'Encaminhamento à área responsável': quando('Próximo passo', 'Encaminhar à área responsável'),
                'Encaminhamento ao órgão apuratório': quando('Próximo passo', 'Encaminhar ao órgão apuratório'),
                'Pedido de complementação': quando('Próximo passo', 'Pedir complementação ao manifestante'),
                'Resposta conclusiva': quando('Próximo passo', 'Responder sem encaminhar'),
                'Arquivamento': quando('Próximo passo', 'Remeter a outra ouvidoria'),
            },
        },
        {
            nome: 'Pedido de complementação', unidade: 'Ouvidoria', espera: true, avanco: 'auto', nome_publico: 'Complementação da manifestação',
            orientacao: 'Peça só o indispensável, uma única vez, salvo fato novo (Decreto 9.492, art. 18, § 3º). O manifestante tem 30 dias corridos (§ 2º) e o prazo de resposta fica suspenso até ele responder (§ 4º). Respondido ou vencido o prazo, volta à análise.',
            acoes: [
                A.comunicar('Pedir a complementação', { especie: 'notificacao', polos: ['requerente'], dias: 30, contagem: corridos, texto: 'Para analisarmos sua manifestação, complemente as informações indicadas a seguir em até 30 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar a complementação', 'Pedir a complementação', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Encaminhamento à área responsável', unidade: 'Área técnica', prazo_dias: 20, prazo_auto: true, prazo_contagem: corridos, avanco: 'auto', vai: ['Resposta conclusiva'],
            orientacao: 'A área responde à ouvidoria em 20 dias corridos, prorrogáveis uma vez por igual período (Lei 13.460, art. 16, parágrafo único). Na sugestão, diga se pode ser adotada e como (Decreto 9.492, art. 21).',
            acoes: [
                A.documento('Juntar a resposta da área', 'Informação', { forma: 'qualquer' }),
                A.escolha('Providência adotada', ['Resolvida', 'Em andamento', 'Não cabe providência'], { obrigatoria: true }),
                A.simNao('Precisou prorrogar o prazo da área?', { ajuda: 'Uma única vez, por mais 20 dias, com justificativa.' }),
            ],
        },
        {
            nome: 'Encaminhamento ao órgão apuratório', unidade: 'Ouvidoria', avanco: 'auto', vai: ['Resposta conclusiva'],
            orientacao: 'A ouvidoria não apura a denúncia: encaminha ao órgão com competência apuratória (Decreto 9.492, art. 22) e preserva a identidade do manifestante (Lei 13.460, art. 10, § 7º).',
            acoes: [
                A.documento('Juntar o ofício de encaminhamento', 'Ofício', { forma: 'redigir' }),
                A.texto('Órgão apuratório de destino', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Resposta conclusiva', unidade: 'Ouvidoria', avanco: 'auto', vai: ['Arquivamento'],
            orientacao: 'Responda em até 30 dias corridos do recebimento, prorrogáveis uma vez por igual período com justificativa (Lei 13.460, art. 16; Decreto 9.492, art. 18), descontado o tempo da complementação. Linguagem clara, objetiva e simples (art. 17). Na denúncia, informe o encaminhamento ou o arquivamento (art. 22). Os dados alimentam o relatório anual (Lei 13.460, art. 14, II).',
            acoes: [
                A.simNao('A resposta contém dado pessoal?', { obrigatoria: true }),
                A.fazer('Certificar a identidade do manifestante', { obrigatoria: true, se: quando('A resposta contém dado pessoal?', 'sim'), ajuda: 'Lei 13.460, art. 15.' }),
                A.simNao('O prazo de resposta foi prorrogado?', { obrigatoria: true }),
                A.textoLongo('Justificativa da prorrogação', { obrigatoria: true, se: quando('O prazo de resposta foi prorrogado?', 'sim') }),
                A.documento('Redigir a resposta conclusiva', 'Resposta', { forma: 'redigir' }),
                A.comunicar('Notificar o manifestante da resposta', { especie: 'notificacao', polos: ['requerente'], dias: 0, texto: 'Segue a resposta conclusiva à sua manifestação.' }, { obrigatoria: true }),
                A.fazer('Enviar a pesquisa de satisfação', { ajuda: 'Avaliação do atendimento (Lei 13.460, art. 23).' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Ouvidoria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Os dados seguem para o relatório anual de gestão.' },
    ]);
}

/** 12-B. Pedido de acesso à informação (Lei 12.527/2011; Decreto 7.724/2012). */
export function acessoInformacao() {
    const recurso = 'Cabe recurso em 10 dias corridos, contados da ciência, à instância indicada nesta decisão.';
    return montar({
        id: 'acesso-informacao', nome: 'Pedido de acesso à informação', area: 'atendimento', porte: 'curto', referencia: 'LAI',
        descricao: 'Atende pedido de qualquer pessoa por documento ou dado público, sem exigir motivo. O serviço de informação ao cidadão entrega na hora o que está disponível ou busca na área detentora, e responde em até 20 dias corridos, prorrogáveis por 10 com justificativa. Negado o acesso no todo ou em parte, o requerente recorre em 10 dias à autoridade superior, depois à autoridade máxima, ao órgão de controle e à Comissão Mista de Reavaliação de Informações; cada instância decide em 5 dias. Termina com a entrega da informação ou com a negativa mantida.',
        quando: 'Pedido de informação, documento ou dado em poder do órgão, e não de providência (esta vai para a ouvidoria).',
        base: 'Lei 12.527/2011, arts. 10 a 17; Decreto 7.724/2012, arts. 15, 16 e 21 a 24.',
        tipo: { polos: ['requerente'], nomes_polos: { requerente: 'Requerente' } },
    }, [
        {
            nome: 'Registro do pedido', unidade: 'Serviço de informação ao cidadão', avanco: 'auto',
            orientacao: 'Basta identificar o requerente e especificar a informação; é vedado exigir os motivos do pedido (Lei 12.527, art. 10, caput e § 3º).',
            acoes: [
                A.formulario('Registrar o pedido', [
                    { id: 'requerente', rotulo: 'Identificação do requerente', tipo: 'texto', obrigatorio: true },
                    { id: 'contato', rotulo: 'Endereço para resposta', tipo: 'texto', obrigatorio: true },
                    { id: 'informacao', rotulo: 'Informação pedida', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'forma', rotulo: 'Forma de acesso preferida', tipo: 'lista', obrigatorio: false, opcoes: ['Meio eletrônico', 'Cópia física', 'Consulta presencial'] },
                    { id: 'data', rotulo: 'Data do pedido', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.comunicar('Enviar o número de protocolo', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Seu pedido de acesso à informação foi registrado. O prazo de resposta é de até 20 dias corridos.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Triagem', unidade: 'Serviço de informação ao cidadão', vai: ['Busca na área detentora', 'Resposta', 'Arquivamento'],
            orientacao: 'Informação disponível: acesso imediato (art. 11, caput). Não sendo do órgão, indique quem a detém ou remeta o pedido, avisando o requerente (art. 11, § 1º, III).',
            acoes: [
                A.escolha('Situação da informação', ['Disponível: responder já', 'Buscar na área detentora', 'Não é do órgão'], { obrigatoria: true }),
                A.texto('Órgão que detém a informação', { obrigatoria: true, se: quando('Situação da informação', 'Não é do órgão') }),
                A.comunicar('Avisar o requerente de quem detém a informação', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'A informação pedida não é deste órgão. Indicamos a seguir quem a detém (e, se for o caso, remetemos o pedido).' }, { obrigatoria: true, se: quando('Situação da informação', 'Não é do órgão') }),
            ],
            saidas: {
                'Resposta': quando('Situação da informação', 'Disponível: responder já'),
                'Busca na área detentora': quando('Situação da informação', 'Buscar na área detentora'),
                'Arquivamento': quando('Situação da informação', 'Não é do órgão'),
            },
        },
        {
            nome: 'Busca na área detentora', unidade: 'Área técnica', prazo_dias: 20, prazo_auto: true, prazo_contagem: corridos, avanco: 'auto', vai: ['Resposta'],
            orientacao: 'O prazo de 20 dias corridos conta do pedido (art. 11, § 1º): devolva a tempo de o serviço de informação responder. Prorrogação de 10 dias só com justificativa expressa comunicada ao requerente antes do fim do prazo (art. 11, § 2º; Decreto 7.724, art. 16). Sem resposta em 30 dias, o requerente pode reclamar à autoridade de monitoramento (Decreto 7.724, art. 22).',
            acoes: [
                A.documento('Juntar a informação ou a manifestação da área', 'Informação', { forma: 'qualquer' }),
                A.escolha('Há sigilo ou dado pessoal?', ['Não', 'Em parte', 'No todo'], { obrigatoria: true, ajuda: 'Em parte: entregue o resto, ocultando a parte protegida (Lei 12.527, art. 7º, § 2º).' }),
                A.simNao('É preciso prorrogar por 10 dias?', { obrigatoria: true }),
                A.comunicar('Comunicar a prorrogação ao requerente', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'O prazo de resposta foi prorrogado por 10 dias, pela justificativa a seguir.' }, { obrigatoria: true, se: quando('É preciso prorrogar por 10 dias?', 'sim') }),
            ],
        },
        {
            nome: 'Resposta', unidade: 'Serviço de informação ao cidadão', vai: ['Recurso em primeira instância', 'Arquivamento'], padrao: 'Arquivamento',
            orientacao: 'Entregue a informação, ou diga data, local e modo de consulta, ou dê as razões da negativa com o recurso cabível, o prazo e a autoridade que o julga (art. 11, § 4º). O requerente tem direito ao inteiro teor da negativa (art. 14). Negado no todo ou em parte, abre-se o prazo de recurso de 10 dias corridos (art. 15).',
            acoes: [
                A.escolha('Resultado', ['Acesso concedido', 'Acesso parcial', 'Acesso negado'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Redigir a resposta', 'Resposta', { forma: 'redigir' }),
                A.comunicar('Entregar a informação ao requerente', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Segue a informação pedida (ou a data, o local e o modo de consulta).' }, { obrigatoria: true, se: quando('Resultado', 'Acesso concedido') }),
                A.comunicar('Notificar a negativa com prazo de recurso', { especie: 'notificacao', polos: ['requerente'], dias: 10, contagem: corridos, texto: `Seu pedido foi negado no todo ou em parte, pelas razões a seguir. ${recurso}` }, { obrigatoria: true, se: quando('Resultado', 'Acesso parcial', 'Acesso negado') }),
                A.esperar('Aguardar o prazo de recurso', 'Notificar a negativa com prazo de recurso', { obrigatoria: true, se: quando('Resultado', 'Acesso parcial', 'Acesso negado') }),
            ],
            saidas: { 'Recurso em primeira instância': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial') },
        },
        {
            nome: 'Recurso em primeira instância', unidade: 'Gabinete', prazo_dias: 5, prazo_auto: true, prazo_contagem: corridos, vai: ['Recurso em segunda instância', 'Cumprimento'], padrao: 'Cumprimento',
            orientacao: 'A autoridade hierarquicamente superior a quem negou decide em 5 dias corridos (Lei 12.527, art. 15, parágrafo único; Decreto 7.724, art. 21). Desprovido, cabe recurso à autoridade máxima em 10 dias.',
            acoes: [
                A.escolha('Decisão do recurso', ['Provido', 'Provido em parte', 'Desprovido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do recurso', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Comunicar o provimento', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Seu recurso foi provido. A informação será entregue.' }, { obrigatoria: true, se: quando('Decisão do recurso', 'Provido') }),
                A.comunicar('Notificar a decisão com prazo de recurso', { especie: 'notificacao', polos: ['requerente'], dias: 10, contagem: corridos, texto: `Seu recurso foi desprovido no todo ou em parte. ${recurso}` }, { obrigatoria: true, se: quando('Decisão do recurso', 'Provido em parte', 'Desprovido') }),
                A.esperar('Aguardar o prazo de recurso', 'Notificar a decisão com prazo de recurso', { obrigatoria: true, se: quando('Decisão do recurso', 'Provido em parte', 'Desprovido') }),
            ],
            saidas: { 'Recurso em segunda instância': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial') },
        },
        {
            nome: 'Recurso em segunda instância', unidade: 'Autoridade máxima', prazo_dias: 5, prazo_auto: true, prazo_contagem: corridos, vai: ['Recurso ao órgão de controle', 'Cumprimento'], padrao: 'Cumprimento',
            orientacao: 'A autoridade máxima do órgão decide em 5 dias corridos (Decreto 7.724, art. 21, parágrafo único). Desprovido, cabe recurso ao órgão de controle em 10 dias.',
            acoes: [
                A.escolha('Decisão do recurso', ['Provido', 'Provido em parte', 'Desprovido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do recurso', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Comunicar o provimento', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Seu recurso foi provido. A informação será entregue.' }, { obrigatoria: true, se: quando('Decisão do recurso', 'Provido') }),
                A.comunicar('Notificar a decisão com prazo de recurso', { especie: 'notificacao', polos: ['requerente'], dias: 10, contagem: corridos, texto: `Seu recurso foi desprovido no todo ou em parte. ${recurso}` }, { obrigatoria: true, se: quando('Decisão do recurso', 'Provido em parte', 'Desprovido') }),
                A.esperar('Aguardar o prazo de recurso', 'Notificar a decisão com prazo de recurso', { obrigatoria: true, se: quando('Decisão do recurso', 'Provido em parte', 'Desprovido') }),
            ],
            saidas: { 'Recurso ao órgão de controle': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial') },
        },
        {
            nome: 'Recurso ao órgão de controle', unidade: 'Controle interno', prazo_dias: 5, prazo_auto: true, prazo_contagem: corridos, vai: ['Recurso à Comissão Mista de Reavaliação de Informações', 'Cumprimento'], padrao: 'Cumprimento',
            orientacao: 'No Executivo federal, o recurso vai à CGU, que decide em 5 dias corridos (Lei 12.527, art. 16; Decreto 7.724, art. 23); estados e municípios definem a instância em norma própria. Provido, o órgão de controle fixa prazo para a entrega (art. 23, § 2º). Desprovido, cabe recurso à Comissão Mista em 10 dias.',
            acoes: [
                A.fazer('Remeter o recurso ao órgão de controle', { obrigatoria: true }),
                A.escolha('Decisão do órgão de controle', ['Provido', 'Provido em parte', 'Desprovido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do órgão de controle', 'Decisão', { forma: 'juntar' }),
                A.numero('Prazo fixado para a entrega (dias)', { obrigatoria: true, se: quando('Decisão do órgão de controle', 'Provido', 'Provido em parte') }),
                A.comunicar('Comunicar o provimento', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Seu recurso foi provido pelo órgão de controle. A informação será entregue no prazo fixado.' }, { obrigatoria: true, se: quando('Decisão do órgão de controle', 'Provido') }),
                A.comunicar('Notificar a decisão com prazo de recurso', { especie: 'notificacao', polos: ['requerente'], dias: 10, contagem: corridos, texto: 'Seu recurso foi desprovido no todo ou em parte. Cabe recurso à Comissão Mista de Reavaliação de Informações em 10 dias corridos.' }, { obrigatoria: true, se: quando('Decisão do órgão de controle', 'Provido em parte', 'Desprovido') }),
                A.esperar('Aguardar o prazo de recurso', 'Notificar a decisão com prazo de recurso', { obrigatoria: true, se: quando('Decisão do órgão de controle', 'Provido em parte', 'Desprovido') }),
            ],
            saidas: { 'Recurso à Comissão Mista de Reavaliação de Informações': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial') },
        },
        {
            nome: 'Recurso à Comissão Mista de Reavaliação de Informações', unidade: 'Serviço de informação ao cidadão', vai: ['Cumprimento'], nome_publico: 'Recurso à Comissão Mista',
            orientacao: 'Última instância no Executivo federal (Decreto 7.724, art. 24). O serviço de informação remete o recurso e acompanha a decisão, que não tem novo recurso administrativo.',
            acoes: [
                A.fazer('Remeter o recurso à Comissão Mista', { obrigatoria: true }),
                A.escolha('Decisão da Comissão Mista', ['Provido', 'Provido em parte', 'Desprovido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão da Comissão Mista', 'Decisão', { forma: 'juntar' }),
                A.comunicar('Comunicar a decisão final', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Segue a decisão da Comissão Mista de Reavaliação de Informações sobre o seu recurso.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Cumprimento', unidade: 'Serviço de informação ao cidadão', vai: ['Arquivamento'],
            orientacao: 'Recurso provido: entregue a informação no prazo fixado. Negativa mantida: só certifique o encerramento.',
            acoes: [
                A.simNao('Há informação a entregar por decisão de recurso?', { obrigatoria: true }),
                A.comunicar('Entregar a informação ao requerente', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Em cumprimento à decisão do recurso, segue a informação pedida.' }, { obrigatoria: true, se: quando('Há informação a entregar por decisão de recurso?', 'sim') }),
                A.fazer('Certificar o encerramento', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Serviço de informação ao cidadão', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

/** 14. Tomada de contas especial, fase interna (Lei 8.443/1992, art. 8º; IN TCU 98/2024). */
export function tomadaContasEspecial() {
    return montar({
        id: 'tomada-contas-especial', nome: 'Tomada de contas especial (fase interna)', area: 'controle', porte: 'longo', referencia: 'TCU',
        descricao: 'Apura quem causou dano ao erário, quanto é o dano, e busca o ressarcimento. Antes de instaurar, o órgão esgota as medidas administrativas: notifica os responsáveis para prestar contas, justificar ou recolher, e tenta a solução consensual quando cabível. Instaurada, a comissão quantifica o débito, individualiza as condutas e ouve o responsável, que pode se defender ou recolher; o relatório passa pelo controle interno e pela autoridade supervisora. Termina com a remessa ao tribunal de contas em até 180 dias da instauração, que julga na fase externa, ou com o arquivamento quando o débito é recolhido, o dano afastado ou a tomada de contas dispensada.',
        quando: 'Omissão no dever de prestar contas, falta de comprovação da aplicação de recursos repassados, desfalque ou desvio de bens ou valores, ou ato ilegal, ilegítimo ou antieconômico que cause dano ao erário.',
        base: 'Lei 8.443/1992, art. 8º; IN TCU 98/2024, arts. 2º a 25 (em especial arts. 3º a 7º, 14, 15, 17 a 25).',
        tipo: { polos: ['requerido'], nomes_polos: { requerido: 'Responsável' } },
    }, [
        {
            nome: 'Conhecimento do fato', unidade: 'Área técnica', avanco: 'auto',
            orientacao: 'A área gestora do recurso ou do convênio registra o fato, o instrumento, o valor envolvido e quem são os supostos responsáveis, com os documentos que sustentam a suspeita de dano.',
            acoes: [
                A.formulario('Registrar o fato', [
                    { id: 'hipotese', rotulo: 'Hipótese', tipo: 'lista', obrigatorio: true, opcoes: ['Omissão no dever de prestar contas', 'Falta de comprovação da aplicação de recursos', 'Desfalque ou desvio de bens ou valores', 'Ato ilegal, ilegítimo ou antieconômico com dano'] },
                    { id: 'instrumento', rotulo: 'Instrumento ou origem do recurso', tipo: 'texto', obrigatorio: true },
                    { id: 'ciencia', rotulo: 'Data da ciência do fato', tipo: 'data', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor estimado do dano (R$)', tipo: 'numero', obrigatorio: false },
                    { id: 'responsaveis', rotulo: 'Supostos responsáveis', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar os documentos do fato', '', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Medidas administrativas prévias', unidade: 'Gabinete', vai: ['Solução consensual', 'Verificação dos pressupostos e das dispensas', 'Arquivamento'],
            orientacao: 'Adote de imediato as medidas para obter o ressarcimento (IN TCU 98/2024, art. 3º): notifique os responsáveis, com comprovante de ciência, para prestar contas, justificar ou recolher; analise a resposta e registre tudo (art. 25, III). A IN não fixa o prazo da notificação: ajuste ao do órgão. Omissão na troca de mandato: notifique antecessor e sucessor (art. 17). Irregularidade grave sem dano: represente ao tribunal, sem tomada de contas (art. 3º, parágrafo único).',
            acoes: [
                A.simNao('Houve troca de mandato no período da omissão?', { ajuda: 'Se sim, notifique o antecessor e o sucessor (IN TCU 98/2024, art. 17).' }),
                A.comunicar('Notificar os responsáveis', { especie: 'notificacao', polos: ['requerido'], dias: 15, texto: 'Fica notificado a prestar contas, apresentar justificativas ou recolher o débito indicado a seguir, sob pena de instauração de tomada de contas especial.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta dos responsáveis', 'Notificar os responsáveis', { obrigatoria: true }),
                A.documento('Juntar o parecer técnico sobre as justificativas', 'Parecer', { forma: 'qualquer', se: quando('Aguardar a resposta dos responsáveis', 'Apresentada', 'Parcial') }),
                A.escolha('Resultado das medidas administrativas', ['Débito recolhido ou dano afastado', 'Cabe solução consensual', 'Irregularidade grave sem dano', 'Dano persiste'], { obrigatoria: true }),
                A.documento('Juntar a representação ao tribunal de contas', 'Representação', { forma: 'redigir', se: quando('Resultado das medidas administrativas', 'Irregularidade grave sem dano') }),
            ],
            saidas: {
                'Arquivamento': quando('Resultado das medidas administrativas', 'Débito recolhido ou dano afastado', 'Irregularidade grave sem dano'),
                'Solução consensual': quando('Resultado das medidas administrativas', 'Cabe solução consensual'),
                'Verificação dos pressupostos e das dispensas': quando('Resultado das medidas administrativas', 'Dano persiste'),
            },
        },
        {
            nome: 'Solução consensual', unidade: 'Gabinete', prazo_dias: 120, prazo_auto: true, prazo_contagem: corridos, vai: ['Arquivamento', 'Verificação dos pressupostos e das dispensas'],
            orientacao: 'Cabe quando o dano vem de inexecução parcial ou de objeto executado sem funcionalidade, havendo boa-fé, e deve ser celebrada em até 120 dias corridos (IN TCU 98/2024, art. 24). Frustrada ou vencido o prazo, segue para a instauração (art. 24, § 3º).',
            acoes: [
                A.simNao('Há boa-fé e o dano vem de inexecução parcial ou objeto sem funcionalidade?', { obrigatoria: true }),
                A.documento('Juntar o termo de solução consensual', 'Termo', { forma: 'qualquer', se: quando('Há boa-fé e o dano vem de inexecução parcial ou objeto sem funcionalidade?', 'sim') }),
                A.escolha('Resultado da solução consensual', ['Celebrada e cumprida', 'Frustrada ou prazo vencido'], { obrigatoria: true }),
            ],
            saidas: {
                'Arquivamento': quando('Resultado da solução consensual', 'Celebrada e cumprida'),
                'Verificação dos pressupostos e das dispensas': quando('Resultado da solução consensual', 'Frustrada ou prazo vencido'),
            },
        },
        {
            nome: 'Verificação dos pressupostos e das dispensas', unidade: 'Gabinete', vai: ['Instauração', 'Arquivamento'],
            orientacao: 'Confirme a existência de dano ou omissão (IN TCU 98/2024, art. 5º). Dispensa-se a instauração se o débito atualizado for inferior a R$ 120.000,00, salvo se a soma dos débitos do mesmo responsável alcançar o limite, ou se passaram mais de 10 anos entre o dano e a primeira notificação (arts. 6º e 7º, III). Processo parado há mais de 5 anos não se arquiva por conta própria: cadastre no Banco de Arquivamentos por Prescrição (arts. 7º, parágrafo único, 9º e 10).',
            acoes: [
                A.numero('Valor atualizado do débito (R$)', { obrigatoria: true, destino: 'informacao' }),
                A.simNao('Débito abaixo de R$ 120.000,00, sem somar outros do mesmo responsável que alcancem o limite?', { obrigatoria: true }),
                A.simNao('Mais de 10 anos entre o dano e a primeira notificação?', { obrigatoria: true }),
                A.escolha('Conclusão', ['Instaurar', 'Dispensar ou arquivar'], { obrigatoria: true }),
                A.documento('Juntar o despacho de dispensa ou arquivamento', 'Despacho', { forma: 'redigir', se: quando('Conclusão', 'Dispensar ou arquivar') }),
            ],
            saidas: { 'Instauração': quando('Conclusão', 'Instaurar'), 'Arquivamento': quando('Conclusão', 'Dispensar ou arquivar') },
        },
        {
            nome: 'Instauração', unidade: 'Gabinete', avanco: 'auto',
            orientacao: 'Prazo máximo para instaurar (IN TCU 98/2024, art. 4º, § 1º): 120 dias corridos do vencimento da prestação de contas, na omissão; 360 dias da apresentação das contas que não comprovam a boa aplicação; 360 dias da ciência do fato, nos demais casos. Suspende durante parcelamento (§ 2º). O ato indica os supostos responsáveis, a situação que originou o dano, as provas e o nexo entre conduta e dano (art. 5º, parágrafo único). Descumprir os prazos é falta grave da autoridade (art. 20).',
            acoes: [
                A.documento('Redigir o ato de instauração', 'Portaria', { forma: 'redigir' }),
                A.data('Data da instauração', { obrigatoria: true, destino: 'informacao', ajuda: 'Daqui contam os 180 dias para a remessa ao tribunal (IN TCU 98/2024, art. 19).' }),
                A.fazer('Designar o tomador de contas ou a comissão', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Apuração e quantificação', unidade: 'Comissão de tomada de contas', vai: ['Relatório do tomador de contas', 'Arquivamento'], ao_entrar: { sigilo: 'restrito' },
            orientacao: 'Quantifique o débito por verificação ou por estimativa segura (IN TCU 98/2024, art. 14), com atualização e juros (art. 15), e individualize a conduta de cada responsável. Junte o demonstrativo e as fichas de qualificação (art. 18, § 2º). Cite o responsável sobre o débito apurado: ele pode se defender ou recolher; o recolhimento do principal atualizado dispensa os juros (art. 22). A citação formal no tribunal ocorre na fase externa.',
            acoes: [
                A.escolha('Forma de quantificação', ['Verificação', 'Estimativa segura'], { obrigatoria: true }),
                A.documento('Juntar o demonstrativo de débito', 'Demonstrativo', { forma: 'qualquer' }),
                A.documento('Juntar as fichas de qualificação dos responsáveis', 'Ficha', { forma: 'qualquer' }),
                A.fazer('Individualizar as condutas e o nexo com o dano', { obrigatoria: true }),
                A.comunicar('Citar o responsável', { especie: 'citacao', polos: ['requerido'], dias: 15, texto: 'Fica citado a apresentar defesa sobre o débito apurado, demonstrado a seguir, ou a recolhê-lo atualizado.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa ou o recolhimento', 'Citar o responsável', { obrigatoria: true }),
                A.simNao('O responsável recolheu o débito ou comprovou que não houve dano?', { obrigatoria: true, ajuda: 'Sim: arquiva antes da remessa (IN TCU 98/2024, art. 7º, I e II).' }),
            ],
            saidas: {
                'Arquivamento': quando('O responsável recolheu o débito ou comprovou que não houve dano?', 'sim'),
                'Relatório do tomador de contas': quando('O responsável recolheu o débito ou comprovou que não houve dano?', 'nao'),
            },
        },
        {
            nome: 'Relatório do tomador de contas', unidade: 'Comissão de tomada de contas', avanco: 'auto', vai: ['Registro de devedores'],
            orientacao: 'O relatório traz (IN TCU 98/2024, art. 18, I): o processo de origem, os responsáveis e suas condutas, o débito de cada um, o relato dos fatos, as medidas administrativas adotadas, as ações judiciais relacionadas e o parecer conclusivo. As notificações e as justificativas analisadas são peças obrigatórias (art. 18, § 1º).',
            acoes: [
                A.formulario('Resumo do relatório', [
                    { id: 'debito', rotulo: 'Débito total atualizado (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'responsaveis', rotulo: 'Número de responsáveis', tipo: 'numero', obrigatorio: true },
                    { id: 'judicial', rotulo: 'Há ação judicial relacionada?', tipo: 'sim_nao', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Redigir o relatório do tomador de contas', 'Relatório', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Registro de devedores', unidade: 'Secretaria', avanco: 'auto', vai: ['Controle interno'],
            orientacao: 'Inscreva os responsáveis nos cadastros de devedores e registre nos sistemas contábeis, dando ciência ao responsável (IN TCU 98/2024, art. 25, I e II).',
            acoes: [
                A.fazer('Inscrever no cadastro de devedores', { obrigatoria: true }),
                A.fazer('Registrar nos sistemas contábeis', { obrigatoria: true }),
                A.comunicar('Dar ciência do registro ao responsável', { especie: 'ciencia', polos: ['requerido'], dias: 0, texto: 'Fica ciente da inscrição do débito no cadastro de devedores e nos registros contábeis.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Controle interno', unidade: 'Controle interno', vai: ['Pronunciamento da autoridade supervisora', 'Relatório do tomador de contas'],
            orientacao: 'O controle interno emite relatório e certificado de auditoria, sobre a adequação das medidas administrativas e o cumprimento das normas, e o dirigente dá parecer conclusivo (IN TCU 98/2024, art. 18, II e III). Faltando peça ou análise, devolva ao tomador de contas.',
            acoes: [
                A.escolha('Conclusão do controle interno', ['Em ordem: certificar', 'Devolver para sanear'], { obrigatoria: true }),
                A.documento('Juntar o relatório de auditoria', 'Relatório', { forma: 'redigir', se: quando('Conclusão do controle interno', 'Em ordem: certificar') }),
                A.documento('Juntar o certificado de auditoria', 'Certificado', { forma: 'redigir', se: quando('Conclusão do controle interno', 'Em ordem: certificar') }),
                A.documento('Juntar o parecer do dirigente do controle interno', 'Parecer', { forma: 'redigir', se: quando('Conclusão do controle interno', 'Em ordem: certificar') }),
                A.textoLongo('O que falta sanear', { obrigatoria: true, se: quando('Conclusão do controle interno', 'Devolver para sanear') }),
            ],
            saidas: {
                'Pronunciamento da autoridade supervisora': quando('Conclusão do controle interno', 'Em ordem: certificar'),
                'Relatório do tomador de contas': quando('Conclusão do controle interno', 'Devolver para sanear'),
            },
        },
        {
            nome: 'Pronunciamento da autoridade supervisora', unidade: 'Autoridade máxima', avanco: 'auto', vai: ['Remessa ao tribunal de contas'],
            orientacao: 'O ministro de Estado, ou autoridade equivalente, atesta ter tomado conhecimento do relatório e do parecer do controle interno (IN TCU 98/2024, art. 18, IV).',
            acoes: [A.documento('Juntar o pronunciamento', 'Pronunciamento', { forma: 'redigir' })],
        },
        {
            nome: 'Remessa ao tribunal de contas', unidade: 'Secretaria', vai: ['Saneamento da remessa', 'Arquivamento'], ao_entrar: { pendencia: 'Remeter ao tribunal de contas em até 180 dias da instauração (IN TCU 98/2024, art. 19).' },
            orientacao: 'Remeta em meio eletrônico em até 180 dias da instauração (IN TCU 98/2024, arts. 19 e 23). Devolvido por falha de composição, há 60 dias para sanear (art. 21, § 2º).',
            acoes: [
                A.fazer('Remeter em meio eletrônico', { obrigatoria: true }),
                A.data('Data da remessa', { obrigatoria: true, destino: 'informacao' }),
                A.escolha('Situação da remessa', ['Aceita pelo tribunal', 'Devolvida por falha de composição'], { obrigatoria: true }),
            ],
            saidas: {
                'Arquivamento': quando('Situação da remessa', 'Aceita pelo tribunal'),
                'Saneamento da remessa': quando('Situação da remessa', 'Devolvida por falha de composição'),
            },
        },
        {
            nome: 'Saneamento da remessa', unidade: 'Comissão de tomada de contas', espera: true, avanco: 'auto', prazo_dias: 60, prazo_auto: true, prazo_contagem: corridos,
            orientacao: 'Corrija a falha apontada pelo tribunal em até 60 dias (IN TCU 98/2024, art. 21, § 2º). Saneado, o processo volta para nova remessa.',
            acoes: [A.documento('Juntar as peças que faltavam', '', { forma: 'qualquer' })],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar: fase interna encerrada pela remessa ao tribunal ou pelo arquivamento do art. 7º da IN TCU 98/2024.' },
    ]);
}

/** 15-A. Consulta ou parecer interno (Lei 9.784/1999, arts. 42 e 50; Lei 14.133/2021, art. 53). */
export function consultaInterna() {
    return montar({
        id: 'consulta-interna', nome: 'Consulta ou parecer interno', area: 'gestao', porte: 'curto', referencia: 'Lei 9.784',
        descricao: 'Uma unidade pede a outra, em geral a assessoria jurídica ou uma área técnica, opinião formal sobre uma dúvida. A chefia do órgão consultivo confere se a consulta está instruída, devolve para diligência se faltar algo, aplica parecer referencial quando houver, e distribui ao parecerista, que tem 15 dias quando o parecer é obrigatório. Aprovado o parecer, a autoridade decide e, se divergir, motiva. Não há partes externas nem recurso: termina com a devolução do parecer aprovado ao consulente.',
        quando: 'Quando a decisão de outro processo depende de parecer, ou para fixar entendimento sobre uma dúvida jurídica ou técnica.',
        base: 'Lei 9.784/1999, arts. 24, 42 e 50, VII; Lei 14.133/2021, art. 53 (consulta sobre contratação).',
        tipo: { polos: ['requerente'], nomes_polos: { requerente: 'Unidade consulente' } },
    }, [
        {
            nome: 'Formulação da consulta', unidade: 'Área técnica', avanco: 'auto',
            orientacao: 'Formule a dúvida de modo objetivo, com os fatos, os documentos e o processo principal, se houver. Diga se o parecer é facultativo, obrigatório ou obrigatório e vinculante: isso muda o que acontece se ele atrasar (Lei 9.784, art. 42).',
            acoes: [
                A.formulario('Dados da consulta', [
                    { id: 'duvida', rotulo: 'Dúvida objetiva', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'processo', rotulo: 'Processo principal', tipo: 'texto', obrigatorio: false },
                    { id: 'natureza', rotulo: 'Natureza do parecer', tipo: 'lista', obrigatorio: true, opcoes: ['Facultativo', 'Obrigatório', 'Obrigatório e vinculante'] },
                    { id: 'contratacao', rotulo: 'É sobre contratação pública?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'limite', rotulo: 'Data de que o consulente precisa', tipo: 'data', obrigatorio: false },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o despacho de consulta e os documentos', 'Despacho', { forma: 'qualquer' }),
            ],
        },
        {
            nome: 'Triagem e distribuição', unidade: 'Assessoria jurídica', vai: ['Diligência ao consulente', 'Elaboração do parecer', 'Devolução ao consulente', 'Arquivamento'],
            orientacao: 'Confira se a consulta está instruída e se é da competência do órgão. Havendo parecer referencial ou minuta padronizada aprovada pela autoridade jurídica, dispensa-se a análise individual (Lei 14.133, art. 53, § 5º).',
            acoes: [
                A.escolha('Encaminhamento', ['Distribuir ao parecerista', 'Diligência ao consulente', 'Aplicar parecer referencial', 'Devolver: fora da competência'], { obrigatoria: true }),
                A.texto('Parecerista designado', { obrigatoria: true, se: quando('Encaminhamento', 'Distribuir ao parecerista') }),
                A.documento('Juntar o parecer referencial aplicável', 'Parecer', { forma: 'juntar', se: quando('Encaminhamento', 'Aplicar parecer referencial') }),
                A.documento('Despacho de devolução', 'Despacho', { forma: 'redigir', se: quando('Encaminhamento', 'Devolver: fora da competência') }),
            ],
            saidas: {
                'Elaboração do parecer': quando('Encaminhamento', 'Distribuir ao parecerista'),
                'Diligência ao consulente': quando('Encaminhamento', 'Diligência ao consulente'),
                'Devolução ao consulente': quando('Encaminhamento', 'Aplicar parecer referencial'),
                'Arquivamento': quando('Encaminhamento', 'Devolver: fora da competência'),
            },
        },
        {
            nome: 'Diligência ao consulente', unidade: 'Área técnica', espera: true, avanco: 'auto',
            orientacao: 'O consulente complementa a consulta com o que foi pedido. Juntada a complementação, o processo volta à triagem.',
            acoes: [A.documento('Juntar a complementação', '', { forma: 'qualquer' })],
        },
        {
            nome: 'Elaboração do parecer', unidade: 'Assessoria jurídica', prazo_dias: 15, prazo_auto: true, prazo_contagem: corridos, avanco: 'auto', vai: ['Aprovação'],
            orientacao: 'Parecer obrigatório: 15 dias, salvo norma especial ou necessidade comprovada de mais prazo (Lei 9.784, art. 42). Se obrigatório e vinculante atrasar, o processo principal espera (§ 1º); se não vinculante, pode seguir sem ele (§ 2º). O parecer tem relatório, fundamentação e conclusão.',
            acoes: [A.documento('Redigir o parecer', 'Parecer', { forma: 'redigir' })],
        },
        {
            nome: 'Aprovação', unidade: 'Assessoria jurídica', vai: ['Devolução ao consulente', 'Elaboração do parecer'],
            orientacao: 'A chefia do órgão consultivo aprova o parecer no todo ou em parte, ou devolve ao parecerista para revisão.',
            acoes: [
                A.escolha('Aprovação do parecer', ['Aprovado', 'Aprovado em parte', 'Devolver ao parecerista'], { obrigatoria: true }),
                A.documento('Juntar o despacho de aprovação', 'Despacho', { forma: 'redigir', se: quando('Aprovação do parecer', 'Aprovado', 'Aprovado em parte') }),
            ],
            saidas: {
                'Devolução ao consulente': quando('Aprovação do parecer', 'Aprovado', 'Aprovado em parte'),
                'Elaboração do parecer': quando('Aprovação do parecer', 'Devolver ao parecerista'),
            },
        },
        {
            nome: 'Devolução ao consulente', unidade: 'Gabinete', avanco: 'auto', vai: ['Arquivamento'],
            orientacao: 'A autoridade decide no processo principal. Se divergir do parecer, motive expressamente (Lei 9.784, art. 50, VII).',
            acoes: [
                A.escolha('A decisão acompanha o parecer?', ['Acompanha', 'Diverge'], { obrigatoria: true }),
                A.textoLongo('Motivação da divergência', { obrigatoria: true, se: quando('A decisão acompanha o parecer?', 'Diverge') }),
                A.documento('Juntar a decisão ou o despacho', 'Decisão', { forma: 'qualquer', nivel: 'recomendado' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. O parecer aprovado fica disponível para consulta futura.' },
    ]);
}

/** 15-B. Concessão de benefício ou licença a servidor (Lei 8.112/1990). */
export function beneficioServidor() {
    const prazo = 'Cabe pedido de reconsideração à mesma autoridade ou recurso à autoridade superior em 30 dias corridos, da publicação ou da ciência.';
    return montar({
        id: 'beneficio-servidor', nome: 'Concessão de benefício ou licença a servidor', area: 'gestao', porte: 'curto', referencia: 'Lei 8.112',
        descricao: 'Decide pedido do servidor sobre direito funcional: licença, afastamento, adicional, auxílio ou averbação de tempo. O requerimento passa pela chefia imediata, que opina sobre a conveniência quando o benefício depende de interesse da Administração, e pela gestão de pessoas, que confere os requisitos e, nas licenças por saúde, aciona a perícia oficial. A autoridade decide em até 30 dias, a decisão é publicada e lançada nos assentamentos. O servidor pode pedir reconsideração ou recorrer em 30 dias; sem isso, o processo é arquivado.',
        quando: 'Qualquer requerimento individual de direito funcional em que só o servidor é interessado.',
        base: 'Lei 8.112/1990, arts. 81, 82, 87, 91, 104 a 110, 202 a 204 e 238. Para outros regimes, o estatuto próprio.',
        tipo: { polos: ['requerente'], nomes_polos: { requerente: 'Servidor requerente' } },
    }, [
        {
            nome: 'Requerimento', unidade: 'Secretaria', avanco: 'auto',
            orientacao: 'O requerimento é dirigido à autoridade competente e encaminhado pela chefia imediata (Lei 8.112, art. 105). Licença da mesma espécie concedida até 60 dias depois do fim de outra conta como prorrogação (art. 82).',
            acoes: [
                A.formulario('Dados do requerimento', [
                    { id: 'especie', rotulo: 'Benefício ou licença', tipo: 'lista', obrigatorio: true, opcoes: ['Licença para tratamento de saúde', 'Licença por motivo de doença em pessoa da família', 'Licença para capacitação', 'Licença para tratar de interesses particulares', 'Afastamento', 'Adicional ou gratificação', 'Auxílio', 'Averbação de tempo', 'Outro'] },
                    { id: 'periodo', rotulo: 'Período pedido', tipo: 'texto', obrigatorio: false },
                    { id: 'inicio', rotulo: 'Início pretendido', tipo: 'data', obrigatorio: false },
                    { id: 'prorrogacao', rotulo: 'É prorrogação?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'fundamentos', rotulo: 'Fundamentos do pedido', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o requerimento e os comprovantes', 'Requerimento', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Manifestação da chefia imediata', unidade: 'Chefia imediata', avanco: 'auto',
            orientacao: 'A chefia encaminha o pedido. Quando o benefício depende de interesse da Administração, como a licença para capacitação (art. 87) e a licença para tratar de interesses particulares (art. 91), opine sobre a conveniência e o impacto no serviço.',
            acoes: [
                A.simNao('O benefício depende de interesse da Administração?', { obrigatoria: true }),
                A.escolha('Manifestação da chefia', ['Favorável', 'Desfavorável'], { obrigatoria: true, se: quando('O benefício depende de interesse da Administração?', 'sim') }),
                A.textoLongo('Impacto no serviço', { obrigatoria: true, se: quando('O benefício depende de interesse da Administração?', 'sim') }),
            ],
        },
        {
            nome: 'Instrução pela gestão de pessoas', unidade: 'Gestão de pessoas', vai: ['Perícia oficial', 'Decisão'],
            orientacao: 'Confira os requisitos legais, o tempo de serviço e os registros funcionais. Licença por saúde, própria ou de pessoa da família, exige perícia oficial (arts. 81, § 1º, e 203); a de até 15 dias no ano pode dispensá-la, conforme regulamento (art. 204).',
            acoes: [
                A.documento('Juntar a informação técnica', 'Informação', { forma: 'redigir' }),
                A.documento('Juntar o mapa de tempo de serviço', 'Mapa de tempo de serviço', { forma: 'qualquer', nivel: 'opcional' }),
                A.simNao('Requisitos legais preenchidos?', { obrigatoria: true, destino: 'informacao' }),
                A.simNao('Falta o laudo da perícia oficial?', { obrigatoria: true, ajuda: 'Sim só quando a licença exige perícia e o laudo ainda não está nos autos.' }),
            ],
            saidas: {
                'Perícia oficial': quando('Falta o laudo da perícia oficial?', 'sim'),
                'Decisão': quando('Falta o laudo da perícia oficial?', 'nao'),
            },
        },
        {
            nome: 'Perícia oficial', unidade: 'Gestão de pessoas', espera: true, avanco: 'auto', ao_entrar: { sigilo: 'restrito' },
            orientacao: 'Convoque o servidor para a perícia oficial e junte o laudo (arts. 203 e 204). O laudo é dado de saúde: o processo fica restrito. Juntado, volta à instrução.',
            acoes: [
                A.comunicar('Convocar o servidor para a perícia', { especie: 'intimacao', polos: ['requerente'], dias: 0, texto: 'Compareça à perícia oficial na data, hora e local indicados a seguir.' }, { obrigatoria: true }),
                A.documento('Juntar o laudo pericial', 'Laudo', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Decisão', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, avanco: 'auto', vai: ['Publicação e registro'],
            orientacao: 'Despache em 5 dias e decida em até 30 dias (Lei 8.112, art. 106, parágrafo único), por despacho ou portaria. Indeferimento é motivado; nos benefícios que dependem de interesse da Administração, sem manifestação favorável da chefia não se concede.',
            acoes: [
                A.escolha('Resultado', ['Deferido', 'Deferido em parte', 'Indeferido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.textoLongo('Motivação do indeferimento', { obrigatoria: true, se: quando('Resultado', 'Deferido em parte', 'Indeferido') }),
                A.documento('Juntar o despacho ou a portaria', 'Decisão', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Publicação e registro', unidade: 'Gestão de pessoas', vai: ['Reconsideração ou recurso', 'Arquivamento'],
            orientacao: 'Publique a portaria em boletim interno ou diário oficial, lance nos assentamentos e na folha e dê ciência ao servidor. O prazo de 30 dias corridos para reconsideração ou recurso conta da publicação ou da ciência (arts. 108 e 238).',
            acoes: [
                A.fazer('Publicar o ato', { obrigatoria: true }),
                A.fazer('Lançar nos assentamentos funcionais e na folha', { ajuda: 'Só quando o pedido foi deferido, no todo ou em parte.' }),
                A.comunicar('Dar ciência da decisão ao servidor', { especie: 'intimacao', polos: ['requerente'], dias: 30, contagem: corridos, texto: `Fica ciente da decisão sobre o seu requerimento. ${prazo}` }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de reconsideração ou recurso', 'Dar ciência da decisão ao servidor', { obrigatoria: true }),
            ],
            saidas: {
                'Reconsideração ou recurso': quando('Aguardar o prazo de reconsideração ou recurso', 'Apresentada', 'Parcial'),
                'Arquivamento': quando('Aguardar o prazo de reconsideração ou recurso', 'Sem manifestação'),
            },
        },
        {
            nome: 'Reconsideração ou recurso', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, avanco: 'auto', vai: ['Publicação e registro'],
            orientacao: 'Reconsideração vai à autoridade que decidiu, uma só vez (Lei 8.112, art. 106); recurso, à autoridade imediatamente superior (art. 107), a quem se remete o processo. Efeito suspensivo a juízo da autoridade (art. 109). Decidido, o resultado é publicado e o servidor tem novo prazo para a instância seguinte.',
            acoes: [
                A.escolha('Espécie', ['Pedido de reconsideração', 'Recurso hierárquico'], { obrigatoria: true }),
                A.simNao('Conceder efeito suspensivo?', { obrigatoria: true }),
                A.escolha('Resultado', ['Provido', 'Provido em parte', 'Desprovido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Gestão de pessoas', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

export const modelos = [manifestacaoOuvidoria, acessoInformacao, tomadaContasEspecial, consultaInterna, beneficioServidor];
