// Modelos de ritos da União (AGU e CGU). Ver a forma de escrever em ./dsl.js e o exemplo em ./geral.js.
// Pesquisa e fontes: /mnt/project-files/modelos-rito/pesquisa-agu-cgu.md
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';

/** 1. Mediação e conciliação na CCAF (Lei 13.140/2015, arts. 32 a 40; Portaria Normativa AGU 178/2025). */
export function conciliacaoCcaf() {
    return montar({
        id: 'conciliacao-ccaf', nome: 'Mediação e conciliação na câmara da advocacia pública (CCAF)', area: 'advocacia_publica', porte: 'medio', referencia: 'AGU',
        descricao: 'Resolve por consenso conflito entre órgãos e entidades federais, ou entre eles e Estados, Municípios ou particulares legitimados, na Câmara de Mediação e de Conciliação da Administração Pública Federal. Começa com requerimento de quem tem legitimidade; a câmara confere o cabimento, distribui a um mediador e, depois de reuniões preliminares, faz o juízo de admissibilidade, que suspende a prescrição desde o pedido. Na negociação mediada, os interessados trocam propostas em reuniões; o mediador não decide. Havendo acordo, cada interessado se manifesta sobre legalidade e vantajosidade, as autoridades da alçada autorizam, o mediador emite parecer de conformidade aprovado pelo diretor, e o termo assinado é homologado pelo Advogado-Geral da União, valendo como título executivo. Sem acordo sobre controvérsia jurídica entre órgãos federais, o caso vai ao Consultor-Geral da União para que o Advogado-Geral a dirima. Não há recurso contra o arquivamento.',
        quando: 'Conflito em que pelo menos um lado é órgão ou entidade federal e há espaço para solução negociada, judicializado ou não. Câmaras estaduais ou municipais de advocacia pública podem usar o mesmo desenho, trocando as autoridades e as alçadas pelas da lei local.',
        base: 'Lei 13.140/2015, arts. 32, 34, 36 e 40 (art. 34 e art. 36, § 4º: conferir na norma vigente); Lei 9.469/1997, art. 1º, §§ 1º, 3º e 4º; Decreto 10.201/2020, art. 2º, § 1º; Portaria Normativa AGU 178/2025, arts. 20 e 48 (demais artigos e prazos: conferir na norma vigente); decreto de estrutura da AGU (Decreto 11.328/2023: conferir o artigo que manda à Consultoria-Geral as controvérsias não resolvidas); Enunciados da CCAF de 2026, n. 3 a 8.',
        tipo: { polos: ['requerente', 'requerido', 'interessado'], nomes_polos: { requerente: 'Requerente', requerido: 'Órgão ou ente requerido', interessado: 'Outro interessado' } },
    }, [
        {
            nome: 'Requerimento', unidade: 'Câmara de mediação', avanco: 'auto', ao_entrar: { sigilo: 'restrito' }, nome_publico: 'Pedido de mediação recebido',
            orientacao: 'Receba o requerimento de instauração de mediação, feito em modelo próprio e protocolado no sistema da AGU. Confira se quem pede é legitimado (Portaria Normativa AGU 178/2025, art. 20): só assim o pedido conta para a suspensão da prescrição. As tratativas são confidenciais (Lei 13.140, art. 30).',
            acoes: [
                A.formulario('Registrar os dados do requerimento', [
                    { id: 'requerente', rotulo: 'Requerente', tipo: 'texto', obrigatorio: true },
                    { id: 'legitimidade', rotulo: 'Legitimidade', tipo: 'lista', obrigatorio: true, opcoes: ['Órgão ou entidade federal', 'Estado, DF, Município ou suas entidades', 'Casa legislativa, tribunal, MP ou Defensoria', 'Associação, sindicato ou confederação (conflito acima de R$ 50 milhões)', 'Particular em conflito coletivo'] },
                    { id: 'interessados', rotulo: 'Demais interessados', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'objeto', rotulo: 'Objeto do conflito', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor envolvido (R$)', tipo: 'numero', obrigatorio: false },
                    { id: 'judicial', rotulo: 'Processos judiciais relacionados', tipo: 'texto', obrigatorio: false },
                    { id: 'data_pedido', rotulo: 'Data da formalização do pedido', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true, ajuda: 'A data da formalização do pedido é o marco da suspensão da prescrição se a mediação for admitida (Lei 13.140, art. 34, § 1º).' }),
                A.documento('Juntar o requerimento e os documentos', 'Requerimento', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Análise preliminar e distribuição', unidade: 'Câmara de mediação', vai: ['Juízo de admissibilidade', 'Saneamento do pedido', 'Inadmissão'],
            orientacao: 'Faça a análise preliminar de cabimento e decida se o caso fica na câmara central ou vai a uma câmara local (concentração ou desconcentração). Cabível, distribua a um mediador. Pedido incompleto deve ser saneado antes de seguir (Enunciado 3 da CCAF).',
            acoes: [
                A.escolha('Análise preliminar', ['Cabível', 'Pedido incompleto', 'Incabível'], { obrigatoria: true }),
                A.texto('Mediador designado', { destino: 'informacao', se: quando('Análise preliminar', 'Cabível') }),
                A.documento('Juntar o despacho de análise preliminar', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: {
                'Juízo de admissibilidade': quando('Análise preliminar', 'Cabível'),
                'Saneamento do pedido': quando('Análise preliminar', 'Pedido incompleto'),
                'Inadmissão': quando('Análise preliminar', 'Incabível'),
            },
        },
        {
            nome: 'Saneamento do pedido', unidade: 'Câmara de mediação', vai: ['Análise preliminar e distribuição', 'Encerramento sem acordo'],
            orientacao: 'Peça ao requerente o que falta: qualificação, objeto, documentos ou a manifestação de quem tem legitimidade. Sem resposta, encerre. O prazo é o fixado pela câmara: conferir na Portaria Normativa AGU 178/2025.',
            acoes: [
                A.comunicar('Intimar o requerente para completar o pedido', { especie: 'intimacao', polos: ['requerente'], dias: 15, contagem: corridos, texto: 'O pedido de mediação está incompleto. Complete-o no prazo indicado, com as informações e os documentos listados.' }, { obrigatoria: true }),
                A.esperar('Aguardar a complementação', 'Intimar o requerente para completar o pedido', { obrigatoria: true }),
            ],
            saidas: {
                'Análise preliminar e distribuição': quando('Aguardar a complementação', 'Apresentada', 'Parcial'),
                'Encerramento sem acordo': quando('Aguardar a complementação', 'Sem manifestação'),
            },
        },
        {
            nome: 'Juízo de admissibilidade', unidade: 'Câmara de mediação', vai: ['Negociação mediada', 'Inadmissão'], nome_publico: 'Admissibilidade',
            orientacao: 'O mediador faz reuniões preliminares com os interessados para conhecer o conflito e confirmar a disposição de negociar; ninguém é obrigado a participar. Se a matéria estiver em ação de improbidade ou tiver decisão do TCU, a conciliação depende de anuência do juiz ou do ministro relator (Lei 13.140, art. 36, § 4º, conferir). Admitida a mediação, a prescrição fica suspensa desde a formalização do pedido (art. 34, § 1º).',
            acoes: [
                A.audiencia('Designar a reunião preliminar', 'reuniao'),
                A.comunicar('Convidar os interessados para a reunião preliminar', { especie: 'comunicacao', dias: 0, texto: 'Foi apresentado pedido de mediação. Participe da reunião preliminar em {audiencia}, presencial ou por videoconferência.' }, { obrigatoria: true }),
                A.documento('Juntar a ata da reunião preliminar', 'Ata', { forma: 'redigir', nivel: 'recomendado' }),
                A.simNao('A matéria está em ação de improbidade ou tem decisão do TCU?', { obrigatoria: true }),
                A.fazer('Pedir a anuência do juízo ou do ministro relator', { se: quando('A matéria está em ação de improbidade ou tem decisão do TCU?', 'sim') }),
                A.escolha('Admissibilidade', ['Admitida', 'Inadmitida'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o despacho de admissibilidade', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: { 'Negociação mediada': quando('Admissibilidade', 'Admitida'), 'Inadmissão': quando('Admissibilidade', 'Inadmitida') },
        },
        {
            nome: 'Negociação mediada', unidade: 'Câmara de mediação', prazo_dias: 60,
            vai: ['Aguardando estudos dos interessados', 'Conformidade e autorizações', 'Encaminhamento ao Consultor-Geral', 'Encerramento sem acordo'],
            orientacao: 'Conduza reuniões preparatórias e de mediação, analise com os interessados os interesses e os riscos e registre propostas e contrapropostas. O mediador facilita, não decide (Enunciado 1). Falta de engajamento reiterada é desistência tácita e permite encerrar (Enunciado 5). Divergência puramente jurídica entre órgãos federais não se uniformiza aqui: vai ao Consultor-Geral (Enunciado 6). A carta de serviços estima 1 a 2 meses.',
            acoes: [
                A.audiencia('Designar a reunião de mediação', 'reuniao'),
                A.comunicar('Intimar os interessados para a reunião', { especie: 'intimacao', dias: 0, texto: 'Participe da reunião de mediação em {audiencia}, com representante que tenha poderes para negociar.' }, { obrigatoria: true }),
                A.documento('Juntar as atas das reuniões', 'Ata', { forma: 'redigir' }),
                A.documento('Juntar propostas e contrapropostas', 'Proposta', { forma: 'juntar', nivel: 'recomendado' }),
                A.escolha('Resultado da mediação', ['Acordo construído', 'Aguardar estudos ou informações', 'Sem acordo em controvérsia jurídica entre órgãos federais', 'Sem acordo ou desistência'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a minuta do termo de conciliação', 'Minuta', { forma: 'redigir', se: quando('Resultado da mediação', 'Acordo construído') }),
            ],
            saidas: {
                'Aguardando estudos dos interessados': quando('Resultado da mediação', 'Aguardar estudos ou informações'),
                'Conformidade e autorizações': quando('Resultado da mediação', 'Acordo construído'),
                'Encaminhamento ao Consultor-Geral': quando('Resultado da mediação', 'Sem acordo em controvérsia jurídica entre órgãos federais'),
                'Encerramento sem acordo': quando('Resultado da mediação', 'Sem acordo ou desistência'),
            },
        },
        {
            nome: 'Aguardando estudos dos interessados', unidade: 'Câmara de mediação', espera: true, avanco: 'auto',
            orientacao: 'Os interessados levantam cálculos, estudos técnicos ou informações de outros órgãos. Juntado o material, a negociação continua.',
            acoes: [A.documento('Juntar os estudos e informações recebidos', '', { forma: 'juntar' })],
        },
        {
            nome: 'Conformidade e autorizações', unidade: 'Câmara de mediação', vai: ['Assinatura e homologação', 'Negociação mediada'],
            orientacao: 'Cada interessado se manifesta sobre a legalidade e a vantajosidade do acordo; o parecer do mediador não substitui essas manifestações (Enunciado 4). Colha as autorizações prévias e expressas: a partir de R$ 50 milhões, do Advogado-Geral da União e do Ministro de Estado da área (Lei 9.469, art. 1º, § 4º; Decreto 10.201, art. 2º, § 1º). O mediador emite o parecer de conformidade jurídica (Portaria 178, art. 48), que o diretor da câmara aprova.',
            acoes: [
                A.documento('Juntar as manifestações de legalidade e vantajosidade', 'Manifestação', { forma: 'juntar' }),
                A.simNao('O acordo envolve R$ 50 milhões ou mais?', { obrigatoria: true }),
                A.documento('Juntar a autorização do Advogado-Geral e do Ministro de Estado', 'Autorização', { forma: 'juntar', se: quando('O acordo envolve R$ 50 milhões ou mais?', 'sim') }),
                A.documento('Juntar as autorizações e anuências das demais autoridades', 'Autorização', { forma: 'juntar', nivel: 'recomendado' }),
                A.documento('Parecer de conformidade jurídica do mediador', 'Parecer', { forma: 'redigir' }),
                A.escolha('Decisão do diretor da câmara', ['Parecer aprovado', 'Devolvido para ajustes'], { obrigatoria: true }),
            ],
            saidas: { 'Assinatura e homologação': quando('Decisão do diretor da câmara', 'Parecer aprovado'), 'Negociação mediada': quando('Decisão do diretor da câmara', 'Devolvido para ajustes') },
        },
        {
            nome: 'Assinatura e homologação', unidade: 'Gabinete do Advogado-Geral', vai: ['Acordo homologado'], nome_publico: 'Termo de conciliação',
            orientacao: 'Os representantes com poderes assinam o termo de conciliação, e o Advogado-Geral da União o homologa, diretamente ou por delegação. O termo é título executivo extrajudicial (Lei 13.140, art. 32, § 3º). Havendo processo judicial, os interessados levam o termo aos autos para extinção. Quem participou só responde por dolo ou fraude (art. 40).',
            acoes: [
                A.documento('Juntar o termo de conciliação assinado', 'Termo', { forma: 'juntar' }),
                A.documento('Juntar o ato de homologação', 'Despacho', { forma: 'juntar' }),
                A.comunicar('Dar ciência da homologação aos interessados', { especie: 'ciencia', dias: 0, texto: 'O termo de conciliação foi homologado. Segue cópia para cumprimento e, se houver processo judicial, para comunicação ao juízo.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Encaminhamento ao Consultor-Geral', unidade: 'Consultoria-Geral', vai: ['Controvérsia dirimida'], ao_entrar: { pendencia: 'Controvérsia jurídica entre órgãos federais sem acordo: propor ao Advogado-Geral a solução (Lei 13.140, art. 36, § 1º).' },
            orientacao: 'No parecer de encerramento, o mediador sugere o encaminhamento da controvérsia para solução vinculante (Enunciado 6). O Consultor-Geral da União examina e submete ao Advogado-Geral, que a dirime com base na legislação aplicável (Lei 13.140, art. 36, § 1º; LC 73/1993, art. 4º, X e XI). A decisão vincula os órgãos envolvidos.',
            acoes: [
                A.documento('Juntar o parecer de encerramento do mediador', 'Parecer', { forma: 'redigir' }),
                A.documento('Juntar a manifestação da Consultoria-Geral', 'Parecer', { forma: 'redigir' }),
                A.documento('Juntar a decisão do Advogado-Geral da União', 'Decisão', { forma: 'juntar' }),
                A.comunicar('Dar ciência da decisão aos interessados', { especie: 'ciencia', dias: 0, texto: 'A controvérsia jurídica foi dirimida pelo Advogado-Geral da União. Segue a decisão, de observância obrigatória pelos órgãos envolvidos.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Inadmissão', unidade: 'Câmara de mediação', vai: ['Encerramento sem acordo'],
            orientacao: 'Registre os motivos da inadmissão (falta de legitimidade, matéria fora da competência da câmara, recusa de algum interessado em participar) e comunique o requerente. Não cabe recurso nem reconsideração (Enunciado 8).',
            acoes: [
                A.documento('Juntar a decisão de inadmissão', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Comunicar a inadmissão ao requerente', { especie: 'ciencia', polos: ['requerente'], dias: 0, texto: 'O pedido de mediação não foi admitido, pelos motivos da decisão anexa.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Encerramento sem acordo', unidade: 'Câmara de mediação', vai: ['Arquivamento'],
            orientacao: 'Lavre o termo de encerramento, que só declara a vontade dos interessados; não é decisão da câmara e não admite recurso (Enunciado 8). Encerrada a mediação, a prescrição volta a correr (Lei 13.140, art. 34: conferir).',
            acoes: [
                A.documento('Juntar o termo de encerramento', 'Termo', { forma: 'redigir' }),
                A.comunicar('Dar ciência do encerramento aos interessados', { especie: 'ciencia', dias: 0, texto: 'O procedimento de mediação foi encerrado sem acordo.' }, { obrigatoria: true }),
            ],
        },
        { nome: 'Acordo homologado', unidade: 'Câmara de mediação', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. O cumprimento cabe aos interessados; o termo é título executivo extrajudicial.' },
        { nome: 'Controvérsia dirimida', unidade: 'Câmara de mediação', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. A decisão do Advogado-Geral vincula os órgãos e entidades envolvidos.' },
        { nome: 'Arquivamento', unidade: 'Câmara de mediação', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

/** 2. Acordo ou transação para prevenir ou encerrar litígio (Lei 9.469/1997; Decreto 10.201/2020; Portaria Normativa PGU 21/2024). */
export function acordoTransacaoUniao() {
    return montar({
        id: 'acordo-transacao-uniao', nome: 'Acordo para prevenir ou encerrar litígio com a União', area: 'advocacia_publica', porte: 'medio', referencia: 'AGU',
        descricao: 'Negocia acordo ou transação para evitar uma ação ou encerrar um processo judicial em que a União ou ente federal é parte. Começa com proposta do interessado ou iniciativa da própria advocacia pública, sob termo de confidencialidade e com o processo suspenso. A unidade da causa examina, nessa ordem, a probabilidade de êxito, a viabilidade jurídica e a economicidade; se não houver viabilidade, arquiva e avisa o interessado ou o juízo. Viável, negocia com o interessado, que responde às contrapropostas. Fechada a proposta, a autoridade da alçada autoriza: o procurador-geral até R$ 10 milhões, o Advogado-Geral acima disso e, a partir de R$ 50 milhões, também o Ministro de Estado. Assinado o termo, o juízo o homologa quando necessário, e a unidade acompanha o pagamento, que pode ser em até 60 parcelas; o descumprimento leva à execução do saldo.',
        quando: 'Proposta de acordo em ação judicial ou pedido de solução extrajudicial contra a União ou autarquia federal. Para empresa pública federal, as alçadas são outras (Decreto 10.201, arts. 2º, § 4º, e 4º); para Estados e Municípios, use a lei local de acordos.',
        base: 'Lei 9.469/1997, arts. 1º, caput e §§ 1º, 4º e 5º, 1º-C e 2º, §§ 2º a 4º; Decreto 10.201/2020, arts. 2º, 3º e 5º; Portaria Normativa PGU/AGU 21/2024, arts. 3º, 5º, 7º a 17 e 23; Portaria AGU 173/2020 (conferir na norma vigente); CPC, arts. 313, II, 487, III, b, e 725, VIII. Para autarquias e fundações, normas da PGF: conferir na norma vigente.',
        tipo: { polos: ['requerente'], nomes_polos: { requerente: 'Interessado no acordo' } },
    }, [
        {
            nome: 'Proposta', unidade: 'Procuradoria', avanco: 'auto', ao_entrar: { sigilo: 'restrito' }, nome_publico: 'Proposta de acordo recebida',
            orientacao: 'Registre a proposta formalizada do interessado ou a iniciativa da unidade, inclusive com base em plano de negociação. As tratativas são sigilosas e se firmam com termo de confidencialidade; havendo processo, peça a suspensão (Portaria PGU 21/2024, arts. 12 e 13; CPC, art. 313, II). A formalização do acordo não reconhece o direito nem abandona a tese da União em outros casos (art. 1º, § 2º).',
            acoes: [
                A.formulario('Registrar os dados da proposta', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['Proposta do interessado', 'Iniciativa da advocacia pública', 'Plano de negociação'] },
                    { id: 'modalidade', rotulo: 'Modalidade', tipo: 'lista', obrigatorio: true, opcoes: ['Negociação preventiva', 'Acordo judicial'] },
                    { id: 'processo', rotulo: 'Processo judicial', tipo: 'texto', obrigatorio: false },
                    { id: 'objeto', rotulo: 'Objeto e pedido', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor estimado do desembolso (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'fazer', rotulo: 'Há obrigação de fazer?', tipo: 'sim_nao', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true, ajuda: 'O valor que define a alçada é o desembolso efetivo, com correção, juros, honorários e custas (Portaria PGU 21/2024, art. 11).' }),
                A.documento('Juntar a proposta e os documentos que a fundamentam', 'Proposta', { forma: 'juntar' }),
                A.documento('Termo de confidencialidade', 'Termo', { forma: 'redigir', nivel: 'recomendado' }),
                A.simNao('Há processo judicial em curso?', { obrigatoria: true }),
                A.fazer('Pedir a suspensão do processo judicial', { se: quando('Há processo judicial em curso?', 'sim') }),
            ],
        },
        {
            nome: 'Probabilidade de êxito e cálculos', unidade: 'Procuradoria', avanco: 'auto', vai: ['Viabilidade jurídica e economicidade'],
            orientacao: 'Analise as teses das duas partes ainda não preclusas e classifique a chance de êxito da União (Portaria PGU 21/2024, arts. 6º e 7º). Verifique prescrição: crédito prescrito não se cobra nem se negocia (Lei 9.469, art. 1º-C). Peça o parecer de cálculos. Abaixo de 60 salários mínimos, ou com plano de negociação, a manifestação escrita é dispensada, salvo em ação coletiva (art. 5º, § 2º).',
            acoes: [
                A.escolha('Probabilidade de êxito da União', ['Alta', 'Baixa', 'Indefinida', 'Oscilante'], { obrigatoria: true, destino: 'informacao' }),
                A.documento('Juntar o parecer de cálculos', 'Cálculo', { forma: 'juntar' }),
                A.simNao('A manifestação escrita é dispensada?', { obrigatoria: true, ajuda: 'Dispensa para acordo abaixo de 60 salários mínimos ou baseado em plano de negociação, exceto em ação coletiva (art. 5º, § 2º).' }),
                A.documento('Nota sobre a probabilidade de êxito', 'Nota', { forma: 'redigir', se: quando('A manifestação escrita é dispensada?', 'nao') }),
            ],
        },
        {
            nome: 'Viabilidade jurídica e economicidade', unidade: 'Procuradoria', vai: ['Negociação', 'Recusa e arquivamento'],
            orientacao: 'Verifique se há óbice legal ao acordo (art. 8º) e se ele é econômico: redução do valor, condições melhores de pagamento, custo do processo maior que o do acordo ou interesse social justificado (art. 9º). Obrigação de fazer exige manifestação do órgão responsável sobre a viabilidade técnica e operacional (art. 8º, § 3º).',
            acoes: [
                A.fazer('Pedir subsídios técnicos ao órgão interessado', { ajuda: 'O órgão da área informa fatos, valores e a possibilidade de cumprir a obrigação.' }),
                A.documento('Juntar a manifestação do órgão interessado', 'Manifestação', { forma: 'juntar', nivel: 'recomendado' }),
                A.escolha('Viabilidade jurídica', ['Viável', 'Viável em parte', 'Inviável'], { obrigatoria: true, destino: 'informacao' }),
                A.simNao('O acordo é econômico para a Administração?', { obrigatoria: true }),
                A.escolha('Conclusão da análise', ['Negociar', 'Recusar'], { obrigatoria: true }),
                A.documento('Nota de viabilidade e economicidade', 'Nota', { forma: 'redigir' }),
            ],
            saidas: { 'Negociação': quando('Conclusão da análise', 'Negociar'), 'Recusa e arquivamento': quando('Conclusão da análise', 'Recusar') },
        },
        {
            nome: 'Negociação', unidade: 'Procuradoria', vai: ['Autorização por alçada', 'Recusa e arquivamento'],
            orientacao: 'Negocie em reunião ou por escrito, com oralidade e boa-fé (Portaria PGU 21/2024, art. 1º, § 1º). O acordo pode ser parcial e pode vir com negócio jurídico processual (arts. 3º e 4º). Parcelamento: até 60 parcelas mensais com Selic (Lei 9.469, art. 2º, §§ 2º e 3º). O prazo de resposta é o que a unidade fixar.',
            acoes: [
                A.audiencia('Designar reunião de negociação', 'reuniao'),
                A.comunicar('Intimar o interessado para a reunião', { especie: 'intimacao', polos: ['requerente'], dias: 0, texto: 'Participe da reunião de negociação em {audiencia}.' }),
                A.comunicar('Enviar a contraproposta ao interessado', { especie: 'notificacao', polos: ['requerente'], dias: 15, contagem: corridos, texto: 'Segue a contraproposta de acordo. Manifeste aceite, recusa ou nova proposta no prazo indicado.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta do interessado', 'Enviar a contraproposta ao interessado', { obrigatoria: true }),
                A.escolha('Resultado da negociação', ['Proposta aceita', 'Sem acordo'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Autorização por alçada': quando('Resultado da negociação', 'Proposta aceita'), 'Recusa e arquivamento': quando('Resultado da negociação', 'Sem acordo') },
        },
        {
            nome: 'Autorização por alçada', unidade: 'Gabinete', vai: ['Termo de acordo e homologação', 'Recusa e arquivamento'], ao_entrar: { pendencia: 'Autorizar ou não o acordo dentro da alçada (Lei 9.469/1997, arts. 1º e 2º; Decreto 10.201/2020).' },
            orientacao: 'Até R$ 10 milhões, autoriza o Procurador-Geral da União, o Procurador-Geral Federal ou o do Banco Central, diretamente ou por delegação (Decreto 10.201, art. 3º); na PGU, as alçadas internas estão no art. 10 da Portaria PGU 21/2024. Acima de R$ 10 milhões, o Advogado-Geral da União (art. 2º). A partir de R$ 50 milhões, também o Ministro de Estado da área, sob pena de nulidade (Lei 9.469, art. 1º, § 4º).',
            acoes: [
                A.numero('Valor do desembolso efetivo (R$)', { obrigatoria: true, destino: 'informacao' }),
                A.escolha('Alçada', ['Até R$ 10 milhões', 'Acima de R$ 10 milhões e abaixo de R$ 50 milhões', 'R$ 50 milhões ou mais'], { obrigatoria: true, destino: 'informacao' }),
                A.fazer('Colher a autorização do Ministro de Estado', { se: quando('Alçada', 'R$ 50 milhões ou mais') }),
                A.simNao('O acordo foi autorizado?', { obrigatoria: true }),
                A.documento('Juntar a autorização ou a recusa motivada', 'Despacho', { forma: 'juntar' }),
            ],
            saidas: { 'Termo de acordo e homologação': quando('O acordo foi autorizado?', 'sim'), 'Recusa e arquivamento': quando('O acordo foi autorizado?', 'nao') },
        },
        {
            nome: 'Termo de acordo e homologação', unidade: 'Procuradoria', vai: ['Cumprimento'], nome_publico: 'Termo de acordo',
            orientacao: 'Redija o termo com qualificação, objeto, fundamento, valor, forma de cumprimento, renúncia ao direito da mesma causa, desistência de recursos, autorização de reposição ao erário e divisão de honorários e custas (Portaria PGU 21/2024, art. 15; Lei 9.469, art. 1º, § 5º). Assinam o advogado público e o interessado ou seu procurador com poderes (art. 16). Homologação: CPC, art. 725, VIII, na preventiva, ou art. 487, III, b, no judicial (art. 17).',
            acoes: [
                A.documento('Termo de acordo', 'Termo', { forma: 'redigir' }),
                A.comunicar('Intimar o interessado para assinar o termo', { especie: 'intimacao', polos: ['requerente'], dias: 0, texto: 'O acordo foi autorizado. Assine o termo anexo, por si ou por procurador com poderes para transigir.' }, { obrigatoria: true }),
                A.documento('Juntar o termo assinado', 'Termo', { forma: 'juntar' }),
                A.simNao('Precisa de homologação judicial?', { obrigatoria: true }),
                A.fazer('Peticionar a homologação', { se: quando('Precisa de homologação judicial?', 'sim') }),
                A.documento('Juntar a sentença homologatória', 'Sentença', { forma: 'juntar', se: quando('Precisa de homologação judicial?', 'sim') }),
            ],
        },
        {
            nome: 'Cumprimento', unidade: 'Procuradoria', vai: ['Aguardando pagamento', 'Execução do saldo', 'Acordo cumprido'],
            orientacao: 'Controle as obrigações assumidas e junte os comprovantes (Portaria PGU 21/2024, art. 23). Pagamento pela União segue a via própria (requisição de pequeno valor ou precatório) quando houver título judicial. Inadimplida parcela devida ao ente, após 30 dias, executa-se o saldo (Lei 9.469, art. 2º, § 4º).',
            acoes: [
                A.documento('Juntar os comprovantes de cumprimento', 'Comprovante', { forma: 'juntar', nivel: 'recomendado' }),
                A.escolha('Situação do acordo', ['Em pagamento', 'Cumprido', 'Descumprido'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Aguardando pagamento': quando('Situação do acordo', 'Em pagamento'),
                'Acordo cumprido': quando('Situação do acordo', 'Cumprido'),
                'Execução do saldo': quando('Situação do acordo', 'Descumprido'),
            },
        },
        {
            nome: 'Aguardando pagamento', unidade: 'Procuradoria', espera: true, avanco: 'auto',
            orientacao: 'Aguarde o vencimento das parcelas ou o pagamento da requisição. Juntado o comprovante, volte ao controle do cumprimento.',
            acoes: [A.documento('Juntar o comprovante de pagamento', 'Comprovante', { forma: 'juntar' })],
        },
        {
            nome: 'Execução do saldo', unidade: 'Procuradoria', vai: ['Arquivamento'],
            orientacao: 'Promova a execução do termo ou prossiga na execução pelo saldo, com os acréscimos (Lei 9.469, art. 2º, § 4º). O termo homologado é título executivo judicial; o não homologado, extrajudicial.',
            acoes: [
                A.comunicar('Notificar o interessado do descumprimento', { especie: 'notificacao', polos: ['requerente'], dias: 0, texto: 'Consta descumprimento do acordo. O saldo será executado com os acréscimos legais.' }),
                A.documento('Juntar a petição de execução', 'Petição', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Recusa e arquivamento', unidade: 'Procuradoria', vai: ['Arquivamento'],
            orientacao: 'Registre a recusa motivada. Havendo processo, informe o juízo para retomada do curso; na negociação preventiva, avise o interessado (Portaria PGU 21/2024, art. 8º, § 5º). A recusa não tem recurso administrativo.',
            acoes: [
                A.documento('Juntar o despacho de recusa', 'Despacho', { forma: 'redigir' }),
                A.comunicar('Dar ciência ao interessado', { especie: 'ciencia', polos: ['requerente'], dias: 0, texto: 'A proposta de acordo não foi aceita. O caso segue pelas vias ordinárias.' }, { obrigatoria: true }),
                A.simNao('Há processo judicial suspenso?', { obrigatoria: true }),
                A.fazer('Informar o juízo para retomada do processo', { se: quando('Há processo judicial suspenso?', 'sim') }),
            ],
        },
        { nome: 'Acordo cumprido', unidade: 'Procuradoria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, com o acordo cumprido.' },
        { nome: 'Arquivamento', unidade: 'Procuradoria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

/** 3. Cobrança administrativa e inscrição em dívida ativa de crédito não tributário (Lei 6.830/1980, art. 2º; Lei 10.522/2002). */
export function cobrancaDividaAtivaNaoTributaria() {
    return montar({
        id: 'cobranca-divida-ativa-nao-tributaria', nome: 'Cobrança administrativa e inscrição em dívida ativa (crédito não tributário)', area: 'advocacia_publica', porte: 'medio', referencia: 'AGU',
        descricao: 'Cobra crédito não tributário já constituído, como multa administrativa, ressarcimento ao erário ou reposição, e o leva à dívida ativa se não for pago. A unidade de origem notifica o devedor para pagar, parcelar ou impugnar, com aviso de inclusão no Cadin 75 dias depois. A impugnação é decidida pela unidade, com recurso à autoridade superior. Não pago, o processo vai à procuradoria, que faz o controle de legalidade (liquidez, certeza e prescrição), devolve para correção ou inscreve e emite a certidão de dívida ativa. Seguem a cobrança extrajudicial, com Cadin e protesto, e, se ainda não houver pagamento, a execução fiscal. Termina com a quitação, o cancelamento do crédito ou o envio à execução.',
        quando: 'Crédito não tributário de autarquia, fundação ou órgão, com decisão definitiva no processo que o gerou. Ajuste o prazo de pagamento e as medidas de cobrança à norma do seu ente; a PGFN e as procuradorias estaduais e municipais têm regras próprias.',
        base: 'Lei 4.320/1964, art. 39, § 2º; Lei 6.830/1980, art. 2º, §§ 3º, 5º, 6º e 8º; Lei 9.784/1999, arts. 26 a 28, 56 a 59 e 66; Lei 10.522/2002, arts. 2º, § 2º, e 37-B; Lei 9.492/1997, art. 1º, parágrafo único; Lei 10.480/2002, art. 10 (conferir parágrafos); Lei 9.469/1997, art. 1º-C; Lei 9.873/1999, art. 1º-A; Portaria Normativa PGF 51/2023 (dispensa de inscrição e cobrança extrajudicial: conferir na norma vigente). O prazo de 30 dias da notificação é padrão do modelo: conferir na norma do órgão.',
        tipo: { polos: ['requerido'], nomes_polos: { requerido: 'Devedor' } },
    }, [
        {
            nome: 'Constituição do crédito', unidade: 'Unidade de origem', avanco: 'auto', nome_publico: 'Débito apurado',
            orientacao: 'Confirme que o crédito está definitivamente constituído: decisão final no processo de origem, sem recurso pendente. A data da constituição definitiva abre o prazo de 5 anos para cobrar (Lei 9.873, art. 1º-A). Junte a memória de cálculo com correção e juros.',
            acoes: [
                A.formulario('Registrar os dados do crédito', [
                    { id: 'devedor', rotulo: 'Devedor (nome e CPF ou CNPJ)', tipo: 'texto', obrigatorio: true },
                    { id: 'natureza', rotulo: 'Natureza do crédito', tipo: 'lista', obrigatorio: true, opcoes: ['Multa administrativa', 'Ressarcimento ao erário', 'Reposição ou restituição', 'Indenização', 'Outra'] },
                    { id: 'origem', rotulo: 'Processo de origem', tipo: 'texto', obrigatorio: true },
                    { id: 'fundamento', rotulo: 'Fundamento legal', tipo: 'texto', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor original (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'constituicao', rotulo: 'Data da constituição definitiva', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a decisão definitiva do processo de origem', 'Decisão', { forma: 'juntar' }),
                A.documento('Memória de cálculo atualizada', 'Cálculo', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Notificação de cobrança', unidade: 'Unidade de origem', vai: ['Impugnação', 'Parcelamento', 'Crédito quitado', 'Remessa para inscrição'],
            orientacao: 'Notifique o devedor com o valor, o fundamento e as opções: pagar, parcelar (até 60 parcelas, Lei 10.522, art. 37-B) ou impugnar. Avise que a inclusão no Cadin ocorre 75 dias após a comunicação (Lei 10.522, art. 2º, § 2º) e que o débito não pago será inscrito em dívida ativa e poderá ser protestado. Notificação frustrada: edital.',
            acoes: [
                A.comunicar('Notificar o devedor para pagar ou impugnar', { especie: 'notificacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Fica notificado do débito descrito no demonstrativo anexo. No prazo indicado, pague, peça parcelamento ou apresente impugnação. Sem pagamento, o débito será incluído no Cadin 75 dias após esta notificação, inscrito em dívida ativa e poderá ser protestado e executado.' }, { obrigatoria: true }),
                A.simNao('A notificação pessoal foi frustrada?'),
                A.fazer('Publicar o edital de notificação', { se: quando('A notificação pessoal foi frustrada?', 'sim') }),
                A.esperar('Aguardar a resposta do devedor', 'Notificar o devedor para pagar ou impugnar', { obrigatoria: true }),
                A.escolha('Resposta do devedor', ['Pagou', 'Pediu parcelamento', 'Impugnou', 'Não pagou'], { obrigatoria: true, destino: 'autos' }),
                A.fazer('Incluir o devedor no Cadin', { se: quando('Resposta do devedor', 'Não pagou'), ajuda: 'Só depois de 75 dias da notificação (Lei 10.522, art. 2º, § 2º).' }),
            ],
            saidas: {
                'Crédito quitado': quando('Resposta do devedor', 'Pagou'),
                'Parcelamento': quando('Resposta do devedor', 'Pediu parcelamento'),
                'Impugnação': quando('Resposta do devedor', 'Impugnou'),
                'Remessa para inscrição': quando('Resposta do devedor', 'Não pagou'),
            },
        },
        {
            nome: 'Impugnação', unidade: 'Unidade de origem', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Cancelamento', 'Intimação da decisão e recurso'],
            orientacao: 'A impugnação discute o valor, a pessoa do devedor, o pagamento ou a prescrição; não reabre o mérito já decidido no processo de origem. Decida em 30 dias (Lei 9.784, art. 49). Procedente em parte, refaça o cálculo.',
            acoes: [
                A.documento('Juntar a impugnação', 'Impugnação', { forma: 'juntar' }),
                A.escolha('Decisão da impugnação', ['Procedente', 'Procedente em parte', 'Improcedente'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão fundamentada', 'Decisão', { forma: 'redigir' }),
                A.documento('Memória de cálculo revista', 'Cálculo', { forma: 'redigir', se: quando('Decisão da impugnação', 'Procedente em parte') }),
            ],
            saidas: { 'Cancelamento': quando('Decisão da impugnação', 'Procedente'), 'Intimação da decisão e recurso': quando('Decisão da impugnação', 'Procedente em parte', 'Improcedente') },
        },
        {
            nome: 'Intimação da decisão e recurso', unidade: 'Unidade de origem', avanco: 'auto', vai: ['Recurso', 'Remessa para inscrição'],
            orientacao: 'Intime o devedor da decisão. O recurso cabe em 10 dias (Lei 9.784, art. 59), dirigido a quem decidiu, que pode reconsiderar em 5 dias antes de remeter à autoridade superior (art. 56, § 1º).',
            acoes: [
                A.comunicar('Intimar o devedor da decisão da impugnação', { especie: 'intimacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Fica intimado da decisão sobre a impugnação. Pague o valor devido ou recorra em 10 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar o devedor da decisão da impugnação', { obrigatoria: true }),
            ],
            saidas: { 'Recurso': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Remessa para inscrição': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Cancelamento', 'Remessa para inscrição'],
            orientacao: 'Não reconsiderada a decisão em 5 dias, a autoridade superior julga o recurso em 30 dias, prorrogáveis por igual período (Lei 9.784, arts. 56 e 59, § 1º).',
            acoes: [
                A.documento('Juntar o recurso', 'Recurso', { forma: 'juntar' }),
                A.escolha('Resultado do recurso', ['Provido', 'Provido em parte', 'Desprovido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do recurso', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar o devedor da decisão do recurso', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado da decisão do recurso. Não havendo pagamento, o débito será inscrito em dívida ativa.' }, { obrigatoria: true }),
            ],
            saidas: { 'Cancelamento': quando('Resultado do recurso', 'Provido'), 'Remessa para inscrição': quando('Resultado do recurso', 'Provido em parte', 'Desprovido') },
        },
        {
            nome: 'Parcelamento', unidade: 'Unidade de origem', vai: ['Crédito quitado', 'Remessa para inscrição', 'Execução fiscal'],
            orientacao: 'Parcele em até 60 prestações mensais, com os acréscimos legais (Lei 10.522, art. 37-B, conferir condições e parcela mínima). Rescindido antes da inscrição, siga para inscrição; rescindido depois, siga para execução.',
            acoes: [
                A.formulario('Registrar o parcelamento', [
                    { id: 'parcelas', rotulo: 'Número de parcelas (até 60)', tipo: 'numero', obrigatorio: true },
                    { id: 'valor_parcela', rotulo: 'Valor da parcela (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'primeira', rotulo: 'Vencimento da primeira parcela', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao' }),
                A.documento('Juntar o termo de parcelamento', 'Termo', { forma: 'juntar' }),
                A.escolha('Situação do parcelamento', ['Quitado', 'Rescindido antes da inscrição', 'Rescindido depois da inscrição'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Crédito quitado': quando('Situação do parcelamento', 'Quitado'),
                'Remessa para inscrição': quando('Situação do parcelamento', 'Rescindido antes da inscrição'),
                'Execução fiscal': quando('Situação do parcelamento', 'Rescindido depois da inscrição'),
            },
        },
        {
            nome: 'Remessa para inscrição', unidade: 'Unidade de origem', avanco: 'auto', vai: ['Controle de legalidade'],
            orientacao: 'Envie à procuradoria o processo de origem, a prova da notificação, a decisão definitiva e o demonstrativo atualizado do débito.',
            acoes: [
                A.documento('Juntar a certidão de não pagamento e o demonstrativo atualizado', 'Certidão', { forma: 'redigir' }),
                A.fazer('Encaminhar à procuradoria', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Controle de legalidade', unidade: 'Procuradoria', vai: ['Inscrição e certidão', 'Devolução para correção', 'Cancelamento'],
            orientacao: 'A inscrição é ato de controle de legalidade: confira liquidez, certeza, notificação válida, contraditório no processo de origem e prescrição (Lei 6.830, art. 2º, § 3º; Lei 10.480, art. 10). Crédito prescrito não se inscreve (Lei 9.469, art. 1º-C). Veja as hipóteses de dispensa de inscrição por valor (Portaria Normativa PGF 51/2023, conferir).',
            acoes: [
                A.escolha('Resultado do controle', ['Apto à inscrição', 'Devolver para correção', 'Prescrito ou dispensado'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o despacho do procurador', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: {
                'Inscrição e certidão': quando('Resultado do controle', 'Apto à inscrição'),
                'Devolução para correção': quando('Resultado do controle', 'Devolver para correção'),
                'Cancelamento': quando('Resultado do controle', 'Prescrito ou dispensado'),
            },
        },
        {
            nome: 'Devolução para correção', unidade: 'Unidade de origem', avanco: 'auto', vai: ['Controle de legalidade'],
            orientacao: 'Corrija o que a procuradoria apontou (cálculo, notificação, identificação do devedor ou documento faltante) e devolva.',
            acoes: [A.documento('Juntar a correção', '', { forma: 'qualquer' })],
        },
        {
            nome: 'Inscrição e certidão', unidade: 'Procuradoria', avanco: 'auto', vai: ['Cobrança extrajudicial'], nome_publico: 'Inscrição em dívida ativa',
            orientacao: 'Lavre o termo de inscrição com devedor, valor, juros e multa, origem e fundamento, data e número da inscrição e do processo (Lei 6.830, art. 2º, § 5º), e emita a certidão de dívida ativa, que reproduz o termo (§ 6º). A inscrição suspende a prescrição por 180 dias ou até a distribuição da execução (§ 3º).',
            acoes: [
                A.formulario('Registrar a inscrição', [
                    { id: 'numero', rotulo: 'Número da inscrição', tipo: 'texto', obrigatorio: true },
                    { id: 'data', rotulo: 'Data da inscrição', tipo: 'data', obrigatorio: true },
                    { id: 'consolidado', rotulo: 'Valor consolidado (R$)', tipo: 'numero', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao' }),
                A.documento('Termo de inscrição', 'Termo', { forma: 'redigir' }),
                A.documento('Certidão de dívida ativa', 'Certidão', { forma: 'redigir' }),
                A.comunicar('Notificar o devedor da inscrição', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'O débito foi inscrito em dívida ativa. Pague ou parcele para evitar protesto e execução fiscal.' }),
            ],
        },
        {
            nome: 'Cobrança extrajudicial', unidade: 'Procuradoria', vai: ['Crédito quitado', 'Parcelamento', 'Execução fiscal'],
            orientacao: 'Use as medidas extrajudiciais: Cadin, cadastros de proteção ao crédito e protesto da certidão de dívida ativa (Lei 9.492, art. 1º, parágrafo único; Portaria Normativa PGF 51/2023, conferir). Sem pagamento, siga para a execução, salvo dispensa de ajuizamento por valor.',
            acoes: [
                A.simNao('Protestar a certidão de dívida ativa?', { obrigatoria: true }),
                A.fazer('Enviar a certidão a protesto', { se: quando('Protestar a certidão de dívida ativa?', 'sim') }),
                A.escolha('Resultado da cobrança extrajudicial', ['Pago', 'Parcelado', 'Não pago'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Crédito quitado': quando('Resultado da cobrança extrajudicial', 'Pago'),
                'Parcelamento': quando('Resultado da cobrança extrajudicial', 'Parcelado'),
                'Execução fiscal': quando('Resultado da cobrança extrajudicial', 'Não pago'),
            },
        },
        {
            nome: 'Execução fiscal', unidade: 'Procuradoria', vai: ['Encerramento'],
            orientacao: 'Ajuíze a execução fiscal com a certidão (Lei 6.830), ou registre a dispensa de ajuizamento quando o valor estiver abaixo do mínimo fixado pela procuradoria. O acompanhamento da ação segue no processo judicial.',
            acoes: [
                A.simNao('O ajuizamento está dispensado pelo valor?', { obrigatoria: true }),
                A.documento('Juntar a petição inicial da execução', 'Petição', { forma: 'juntar', se: quando('O ajuizamento está dispensado pelo valor?', 'nao') }),
                A.documento('Juntar o despacho de dispensa', 'Despacho', { forma: 'redigir', se: quando('O ajuizamento está dispensado pelo valor?', 'sim') }),
            ],
        },
        {
            nome: 'Cancelamento', unidade: 'Unidade de origem', vai: ['Encerramento'],
            orientacao: 'Cancele o crédito ou a inscrição, retire o devedor do Cadin e de cadastros de proteção ao crédito e comunique a decisão.',
            acoes: [
                A.documento('Juntar o ato de cancelamento', 'Despacho', { forma: 'redigir' }),
                A.fazer('Retirar o devedor do Cadin e dos cadastros de crédito'),
                A.comunicar('Dar ciência do cancelamento ao devedor', { especie: 'ciencia', polos: ['requerido'], dias: 0, texto: 'O débito foi cancelado.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Crédito quitado', unidade: 'Unidade de origem', vai: ['Encerramento'],
            orientacao: 'Confira o pagamento integral, dê baixa na inscrição, se houver, retire o devedor do Cadin e cancele o protesto.',
            acoes: [
                A.documento('Juntar o comprovante de pagamento', 'Comprovante', { forma: 'juntar' }),
                A.fazer('Dar baixa no Cadin, na inscrição e no protesto', { obrigatoria: true }),
            ],
        },
        { nome: 'Encerramento', unidade: 'Unidade de origem', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

/** 4. Acordo de leniência (Lei 12.846/2013, arts. 16 e 17; Decreto 11.129/2022, arts. 32 a 55; Portaria Normativa Interministerial CGU/AGU 1/2025). */
export function acordoLeniencia() {
    return montar({
        id: 'acordo-leniencia', nome: 'Acordo de leniência (Lei Anticorrupção)', area: 'sancionador', porte: 'longo', referencia: 'CGU',
        descricao: 'Negocia com a pessoa jurídica que admite ato lesivo contra a Administração um acordo administrativo em que ela colabora com a apuração, repara o dano e perde a vantagem indevida em troca de isenção ou redução das sanções da Lei 12.846 e da Lei 14.133. Pode começar por um pedido de declaração de tempestividade, que garante a prioridade, ou direto pela proposta escrita, que é sigilosa. Admitida a proposta, CGU, AGU e a empresa assinam memorando de entendimentos, que interrompe a prescrição, e uma comissão das duas instituições negocia em até 180 dias, prorrogáveis, colhendo provas e calculando dano, vantagem e multa. A empresa pode desistir e a Administração pode rejeitar, sem reconhecimento do ilícito e sem uso dos documentos entregues. Assinado pelo Ministro da CGU e pelo Advogado-Geral da União, o acordo é publicado e acompanhado, inclusive o programa de integridade; termina com a declaração de cumprimento ou com a rescisão, que tira os benefícios, impede novo acordo por 3 anos e vai ao CNEP.',
        quando: 'Pessoa jurídica que quer colaborar e admitir responsabilidade por ato lesivo do art. 5º da Lei 12.846, antes do relatório final do processo de responsabilização. Estados e Municípios aplicam o rito com a sua controladoria e a sua procuradoria, conforme o regulamento local.',
        base: 'Lei 12.846/2013, arts. 16 e 17; Decreto 11.129/2022, arts. 32 a 55 (em especial 37 a 43, 45, 48 a 53 e 55); Portaria Normativa Interministerial CGU/AGU 1/2025, art. 6º (declaração de tempestividade), arts. 24 e 31 (vantagem e capacidade de pagamento) e demais regras de procedimento e prazos internos: conferir na norma vigente; LC 73/1993 e Lei 13.140/2015 (participação da AGU, Decreto 11.129, art. 35).',
        tipo: { polos: ['requerente'], nomes_polos: { requerente: 'Pessoa jurídica proponente' } },
    }, [
        {
            nome: 'Manifestação de interesse', unidade: 'Diretoria de acordos de leniência', ao_entrar: { sigilo: 'restrito' }, vai: ['Declaração de tempestividade', 'Proposta de acordo'], nome_publico: 'Manifestação recebida',
            orientacao: 'Tudo é sigiloso e de acesso restrito na CGU; a identidade da empresa não se divulga até a celebração (Decreto 11.129, arts. 38, § 3º, e 48, § 1º). A empresa pode primeiro pedir a declaração de tempestividade da autodenúncia, para garantir prioridade enquanto faz investigação interna (Portaria Interministerial CGU/AGU 1/2025, art. 6º), ou apresentar já a proposta.',
            acoes: [
                A.formulario('Registrar a proponente e os fatos', [
                    { id: 'pj', rotulo: 'Pessoa jurídica (razão social e CNPJ)', tipo: 'texto', obrigatorio: true },
                    { id: 'grupo', rotulo: 'Empresas do mesmo grupo que aderem', tipo: 'texto', obrigatorio: false },
                    { id: 'representantes', rotulo: 'Representantes e procuradores', tipo: 'texto', obrigatorio: true },
                    { id: 'entes', rotulo: 'Entes públicos lesados', tipo: 'texto', obrigatorio: true },
                    { id: 'resumo', rotulo: 'Resumo dos atos lesivos', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'par', rotulo: 'Há processo de responsabilização em curso?', tipo: 'sim_nao', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.escolha('Forma de entrada', ['Pedido de declaração de tempestividade', 'Proposta de acordo'], { obrigatoria: true }),
                A.documento('Juntar o pedido ou a proposta', 'Requerimento', { forma: 'juntar' }),
            ],
            saidas: { 'Declaração de tempestividade': quando('Forma de entrada', 'Pedido de declaração de tempestividade'), 'Proposta de acordo': quando('Forma de entrada', 'Proposta de acordo') },
        },
        {
            nome: 'Declaração de tempestividade', unidade: 'Diretoria de acordos de leniência', vai: ['Proposta de acordo', 'Encerramento sem acordo'],
            orientacao: 'Confira se o pedido traz a qualificação, os autores conhecidos, o resumo da infração, o ente lesado e as diligências pretendidas, e emita a declaração, que não antecipa o mérito. Se a proposta não vier, as informações dadas só para obter a declaração não podem ser usadas para sancionar (Portaria Interministerial CGU/AGU 1/2025, art. 6º). O prazo para apresentar a proposta é o da portaria: conferir.',
            acoes: [
                A.documento('Declaração de tempestividade da autodenúncia', 'Declaração', { forma: 'redigir' }),
                A.comunicar('Notificar a proponente da declaração', { especie: 'notificacao', polos: ['requerente'], dias: 30, contagem: corridos, texto: 'Foi emitida a declaração de tempestividade. Apresente a proposta escrita de acordo de leniência no prazo indicado.' }, { obrigatoria: true }),
                A.esperar('Aguardar a proposta', 'Notificar a proponente da declaração', { obrigatoria: true }),
            ],
            saidas: { 'Proposta de acordo': quando('Aguardar a proposta', 'Apresentada', 'Parcial'), 'Encerramento sem acordo': quando('Aguardar a proposta', 'Sem manifestação') },
        },
        {
            nome: 'Proposta de acordo', unidade: 'Diretoria de acordos de leniência', avanco: 'auto', vai: ['Juízo de admissibilidade'],
            orientacao: 'A proposta é escrita, apresentada por representante estatutário ou procurador com poderes específicos, e contém a declaração de que a empresa foi orientada sobre direitos e deveres e de que deixar de atender às solicitações importa desistência (Decreto 11.129, art. 38). Cabe até a conclusão do relatório final do processo de responsabilização (§ 2º). Abra processo específico para a negociação (§ 5º).',
            acoes: [
                A.documento('Juntar a proposta escrita com a declaração de orientação', 'Proposta', { forma: 'juntar' }),
                A.documento('Juntar os atos constitutivos e a procuração', 'Procuração', { forma: 'juntar' }),
                A.simNao('Há processo de responsabilização em curso contra a proponente?', { obrigatoria: true }),
                A.fazer('Confirmar que o relatório final ainda não foi concluído', { se: quando('Há processo de responsabilização em curso contra a proponente?', 'sim') }),
            ],
        },
        {
            nome: 'Juízo de admissibilidade', unidade: 'Diretoria de acordos de leniência', vai: ['Memorando de entendimentos', 'Encerramento sem acordo'],
            orientacao: 'Verifique se há elementos mínimos para negociar (Decreto 11.129, art. 39): se a empresa é a primeira a se apresentar quando isso importa, se cessou o envolvimento, se admite a responsabilidade objetiva e se pode trazer provas e identificar outros envolvidos (art. 37; Lei 12.846, art. 16, § 1º).',
            acoes: [
                A.escolha('Admissibilidade da proposta', ['Admitida', 'Inadmitida'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Nota técnica de admissibilidade', 'Nota', { forma: 'redigir' }),
            ],
            saidas: { 'Memorando de entendimentos': quando('Admissibilidade da proposta', 'Admitida'), 'Encerramento sem acordo': quando('Admissibilidade da proposta', 'Inadmitida') },
        },
        {
            nome: 'Memorando de entendimentos', unidade: 'Diretoria de acordos de leniência', avanco: 'auto', vai: ['Negociação'],
            orientacao: 'Assine com a empresa o memorando que fixa os parâmetros da negociação (Decreto 11.129, art. 39, § 1º) e designe a comissão de negociação, com servidores da CGU e membros da AGU. A assinatura interrompe a prescrição e a suspende pela negociação, até 360 dias (art. 39, § 3º). O processo de responsabilização pode ser suspenso, sem parar medidas investigativas e cautelares (art. 40). A negociação pode ser coordenada com o Ministério Público Federal.',
            acoes: [
                A.documento('Juntar o memorando de entendimentos assinado', 'Memorando', { forma: 'juntar' }),
                A.data('Data da assinatura do memorando', { obrigatoria: true, destino: 'informacao', ajuda: 'Interrompe a prescrição e abre os 180 dias de negociação (Decreto 11.129, arts. 39, § 3º, e 42).' }),
                A.formulario('Registrar a comissão de negociação', [
                    { id: 'cgu', rotulo: 'Membros da CGU', tipo: 'texto', obrigatorio: true },
                    { id: 'agu', rotulo: 'Membros da AGU', tipo: 'texto', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao' }),
                A.simNao('Suspender o processo de responsabilização em curso?'),
                A.fazer('Comunicar a suspensão à comissão processante', { se: quando('Suspender o processo de responsabilização em curso?', 'sim') }),
                A.simNao('A negociação será coordenada com o MPF?'),
                A.fazer('Oficiar ao Ministério Público Federal', { se: quando('A negociação será coordenada com o MPF?', 'sim') }),
            ],
        },
        {
            nome: 'Negociação', unidade: 'Comissão de negociação', prazo_dias: 180, prazo_auto: true, prazo_contagem: corridos, vai: ['Aprovação e assinatura', 'Encerramento sem acordo'],
            orientacao: 'A comissão colhe relatos e provas, confere os fatos, avalia o programa de integridade e calcula o dano incontroverso, a vantagem indevida e a multa com a redução cabível (Decreto 11.129, arts. 37 e 47; Portaria Interministerial 1/2025, arts. 24 e 31). Prazo de 180 dias do memorando, prorrogável (art. 42). Não atender às solicitações importa desistência (art. 38). Pode-se avocar processos sobre os mesmos fatos (art. 41).',
            acoes: [
                A.audiencia('Designar reunião de negociação', 'reuniao'),
                A.comunicar('Intimar a proponente para a reunião', { especie: 'intimacao', polos: ['requerente'], dias: 0, texto: 'Compareça à reunião de negociação em {audiencia}, com representantes com poderes.' }),
                A.comunicar('Solicitar informações e documentos à proponente', { especie: 'notificacao', polos: ['requerente'], dias: 15, contagem: corridos, texto: 'Apresente as informações e os documentos listados no prazo indicado. O não atendimento importa desistência da proposta.' }),
                A.esperar('Aguardar as informações solicitadas', 'Solicitar informações e documentos à proponente'),
                A.documento('Juntar os anexos de relatos e provas', 'Anexo', { forma: 'juntar' }),
                A.documento('Avaliação do programa de integridade', 'Relatório', { forma: 'redigir', nivel: 'recomendado' }),
                A.documento('Memória de cálculo de dano, vantagem e multa', 'Cálculo', { forma: 'redigir' }),
                A.documento('Juntar o ato de prorrogação, se houver', 'Despacho', { forma: 'qualquer', nivel: 'opcional', ajuda: 'O prazo de 180 dias pode ser prorrogado quando as circunstâncias exigirem (Decreto 11.129, art. 42, parágrafo único).' }),
                A.escolha('Resultado da negociação', ['Minuta acordada', 'Desistência da proponente', 'Rejeição pela Administração'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Relatório final da comissão', 'Relatório', { forma: 'redigir' }),
            ],
            saidas: {
                'Aprovação e assinatura': quando('Resultado da negociação', 'Minuta acordada'),
                'Encerramento sem acordo': quando('Resultado da negociação', 'Desistência da proponente', 'Rejeição pela Administração'),
            },
        },
        {
            nome: 'Aprovação e assinatura', unidade: 'Gabinete', vai: ['Publicação e efeitos', 'Negociação', 'Encerramento sem acordo'], ao_entrar: { pendencia: 'Aprovar e assinar o acordo de leniência com o Advogado-Geral da União, devolver para ajustes ou rejeitar.' },
            orientacao: 'A minuta traz as cláusulas obrigatórias: compromissos do art. 37, perda dos benefícios no descumprimento, natureza de título executivo extrajudicial, programa de integridade e monitoramento, pagamentos e compensação (Decreto 11.129, art. 45). Assinam o Ministro da CGU e o Advogado-Geral da União (art. 35) e a empresa. A celebração interrompe a prescrição, que fica suspensa até o cumprimento ou a rescisão (art. 49).',
            acoes: [
                A.documento('Minuta final do acordo', 'Minuta', { forma: 'redigir' }),
                A.documento('Manifestação jurídica sobre a minuta', 'Parecer', { forma: 'juntar', nivel: 'recomendado' }),
                A.escolha('Decisão das autoridades', ['Aprovado e assinado', 'Devolvido à comissão', 'Rejeitado'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o acordo assinado', 'Termo', { forma: 'juntar', se: quando('Decisão das autoridades', 'Aprovado e assinado') }),
            ],
            saidas: {
                'Publicação e efeitos': quando('Decisão das autoridades', 'Aprovado e assinado'),
                'Negociação': quando('Decisão das autoridades', 'Devolvido à comissão'),
                'Encerramento sem acordo': quando('Decisão das autoridades', 'Rejeitado'),
            },
        },
        {
            nome: 'Publicação e efeitos', unidade: 'Diretoria de acordos de leniência', avanco: 'auto', vai: ['Acompanhamento do cumprimento'], ao_entrar: { sigilo: 'normal' }, nome_publico: 'Acordo celebrado',
            orientacao: 'Publique o acordo no sítio da CGU, respeitados os sigilos legais e as informações comercialmente sensíveis (Decreto 11.129, arts. 48 e 55). Comunique os órgãos e os processos atingidos pelos efeitos pactuados (art. 50). Provas podem ser compartilhadas com outras autoridades mediante compromisso de não usá-las contra a própria empresa pelos mesmos fatos (art. 48, § 2º).',
            acoes: [
                A.fazer('Publicar o acordo no sítio da CGU', { obrigatoria: true }),
                A.fazer('Comunicar os órgãos e processos atingidos pelos efeitos do acordo', { obrigatoria: true }),
                A.comunicar('Dar ciência da publicação à empresa', { especie: 'ciencia', polos: ['requerente'], dias: 0, texto: 'O acordo de leniência foi publicado. Cumpra as obrigações nos prazos pactuados.' }),
            ],
        },
        {
            nome: 'Acompanhamento do cumprimento', unidade: 'Diretoria de acordos de leniência', vai: ['Aguardando prazos do acordo', 'Declaração de cumprimento', 'Apuração de descumprimento'],
            orientacao: 'Acompanhe pagamentos, colaboração e programa de integridade, por relatórios, entrevistas, testes e visitas técnicas (Decreto 11.129, art. 51). Pedido de alteração de obrigação só se defere em caráter excepcional, com os requisitos do art. 54.',
            acoes: [
                A.documento('Juntar relatórios e comprovantes da empresa', 'Relatório', { forma: 'juntar', nivel: 'recomendado' }),
                A.simNao('Há pedido de alteração de obrigações?'),
                A.documento('Juntar a decisão sobre a alteração', 'Decisão', { forma: 'redigir', se: quando('Há pedido de alteração de obrigações?', 'sim'), ajuda: 'Exige manutenção dos resultados, maior vantagem para a Administração, imprevisão, boa-fé e garantias hígidas (art. 54).' }),
                A.escolha('Situação do acordo', ['Em cumprimento', 'Cumprido', 'Indício de descumprimento'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Aguardando prazos do acordo': quando('Situação do acordo', 'Em cumprimento'),
                'Declaração de cumprimento': quando('Situação do acordo', 'Cumprido'),
                'Apuração de descumprimento': quando('Situação do acordo', 'Indício de descumprimento'),
            },
        },
        {
            nome: 'Aguardando prazos do acordo', unidade: 'Diretoria de acordos de leniência', espera: true, avanco: 'auto', prazo_dias: 180, prazo_auto: true, prazo_contagem: corridos,
            orientacao: 'Aguarde o próximo vencimento ou relatório periódico. Ajuste o prazo de revisão ao cronograma do acordo.',
            acoes: [A.documento('Juntar o relatório ou comprovante do período', 'Relatório', { forma: 'juntar' })],
        },
        {
            nome: 'Apuração de descumprimento', unidade: 'Comissão de negociação', vai: ['Acompanhamento do cumprimento', 'Rescisão e registro'],
            orientacao: 'Ouça a empresa sobre o indício de descumprimento antes de decidir. Só o descumprimento injustificado leva à rescisão (Decreto 11.129, art. 53). O prazo de manifestação é o da portaria ou do acordo: conferir.',
            acoes: [
                A.comunicar('Notificar a empresa para se manifestar', { especie: 'notificacao', polos: ['requerente'], dias: 15, contagem: corridos, texto: 'Foi identificado possível descumprimento do acordo de leniência, descrito no anexo. Manifeste-se no prazo indicado.' }, { obrigatoria: true }),
                A.esperar('Aguardar a manifestação', 'Notificar a empresa para se manifestar', { obrigatoria: true }),
                A.documento('Nota técnica sobre o descumprimento', 'Nota', { forma: 'redigir' }),
                A.escolha('Decisão sobre o descumprimento', ['Descumprimento afastado', 'Rescisão do acordo'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.comunicar('Intimar a empresa da decisão', { especie: 'intimacao', polos: ['requerente'], dias: 0, texto: 'Fica intimada da decisão sobre o cumprimento do acordo de leniência.' }, { obrigatoria: true }),
            ],
            saidas: { 'Acompanhamento do cumprimento': quando('Decisão sobre o descumprimento', 'Descumprimento afastado'), 'Rescisão e registro': quando('Decisão sobre o descumprimento', 'Rescisão do acordo') },
        },
        {
            nome: 'Rescisão e registro', unidade: 'Diretoria de acordos de leniência', vai: ['Acordo rescindido'],
            orientacao: 'Com a rescisão definitiva, a empresa perde os benefícios, fica impedida de novo acordo por 3 anos, vencem as parcelas e se executam os valores integrais, descontado o pago; o descumprimento vai ao CNEP por 3 anos (Decreto 11.129, art. 53; Lei 12.846, art. 16, § 8º). Retome o processo de responsabilização suspenso.',
            acoes: [
                A.fazer('Registrar o descumprimento no CNEP', { obrigatoria: true }),
                A.fazer('Encaminhar à AGU para execução dos valores', { obrigatoria: true }),
                A.fazer('Comunicar a retomada dos processos suspensos', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Declaração de cumprimento', unidade: 'Gabinete', vai: ['Acordo cumprido'],
            orientacao: 'Cumprido o acordo, a autoridade declara o cumprimento das obrigações, as isenções pactuadas e o pagamento da multa (Decreto 11.129, art. 52).',
            acoes: [
                A.documento('Declaração de cumprimento', 'Declaração', { forma: 'redigir' }),
                A.comunicar('Dar ciência à empresa', { especie: 'ciencia', polos: ['requerente'], dias: 0, texto: 'Foi declarado o cumprimento do acordo de leniência.' }, { obrigatoria: true }),
                A.fazer('Publicar a declaração no sítio da CGU'),
            ],
        },
        {
            nome: 'Encerramento sem acordo', unidade: 'Diretoria de acordos de leniência', vai: ['Arquivamento sem acordo'],
            orientacao: 'Desistência ou rejeição não importa reconhecimento do ato lesivo e não se divulga; os documentos entregues na negociação não podem ser usados pela Administração, salvo prova obtida por outro meio (Decreto 11.129, art. 43; Lei 12.846, art. 16, § 7º). Avalie se cabe termo de compromisso (Portaria Interministerial 1/2025, conferir).',
            acoes: [
                A.documento('Termo de encerramento da negociação', 'Termo', { forma: 'redigir' }),
                A.fazer('Devolver ou descartar os documentos entregues pela empresa', { obrigatoria: true }),
                A.comunicar('Dar ciência à proponente', { especie: 'ciencia', polos: ['requerente'], dias: 0, texto: 'A negociação do acordo de leniência foi encerrada sem acordo.' }, { obrigatoria: true }),
            ],
        },
        { nome: 'Acordo cumprido', unidade: 'Diretoria de acordos de leniência', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, com o acordo cumprido.' },
        { nome: 'Acordo rescindido', unidade: 'Diretoria de acordos de leniência', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. A execução dos valores segue com a AGU.' },
        { nome: 'Arquivamento sem acordo', unidade: 'Diretoria de acordos de leniência', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, em sigilo.' },
    ]);
}

/** 5. Sindicância patrimonial (Decreto 10.571/2020, arts. 11 a 14; Portaria Normativa CGU 27/2022, arts. 50 a 56). */
export function sindicanciaPatrimonial() {
    return montar({
        id: 'sindicancia-patrimonial', nome: 'Sindicância patrimonial', area: 'correcional', porte: 'medio', referencia: 'CGU',
        descricao: 'Investiga, sem acusado e sem punição, indício de enriquecimento ilícito de servidor ou empregado público, em especial evolução patrimonial incompatível com a renda declarada. Começa com a análise patrimonial da CGU, uma denúncia ou um achado de auditoria; o titular da correição decide entre abrir a sindicância, ir direto ao processo disciplinar ou arquivar. Uma comissão de dois ou mais servidores levanta bens e movimentações em cartórios, Detran, juntas comerciais e nas declarações, pode convidar o sindicado a explicar a origem dos recursos e monta o demonstrativo de evolução patrimonial, em 30 dias prorrogáveis. Tudo corre em sigilo; não há contraditório, que fica para o processo disciplinar. O relatório recomenda arquivamento ou processo disciplinar, a autoridade decide e, confirmados os indícios, comunica MPF, TCU, CGU, Receita, Coaf e AGU.',
        quando: 'Indício de patrimônio ou gasto incompatível com a renda de agente público. Difere do modelo de sindicância investigativa por ter comissão própria, requisições patrimoniais e comunicações obrigatórias. Fora do Executivo federal, ajuste ao regulamento local.',
        base: 'Decreto 10.571/2020, arts. 7º, 11, 12, I, 13 e 14; Portaria Normativa CGU 27/2022, arts. 38, 39 e 50 a 56 (art. 56, parágrafo único, incluído pela PN CGU 123/2024); Lei 8.429/1992, arts. 9º, VII, e 13; Lei 8.112/1990, art. 132, IV; LC 105/2001 (sigilo bancário: conferir o caminho adotado pelo órgão).',
        tipo: { polos: ['requerido'], nomes_polos: { requerido: 'Sindicado' } },
    }, [
        {
            nome: 'Notícia e admissibilidade', unidade: 'Corregedoria', ao_entrar: { sigilo: 'restrito' }, vai: ['Instauração', 'Instauração do processo disciplinar', 'Arquivamento'], nome_publico: 'Notícia recebida',
            orientacao: 'A análise patrimonial da CGU, depois de ouvido o agente sobre inconsistências, pode indicar sindicância patrimonial ou processo disciplinar (Decreto 10.571, arts. 11 a 13). Com indícios fortes de autoria e materialidade, vá direto ao processo disciplinar (PN 27, art. 39); sem indícios mínimos, arquive motivadamente (art. 38, § 2º).',
            acoes: [
                A.formulario('Registrar a notícia', [
                    { id: 'agente', rotulo: 'Agente público (nome, cargo e matrícula)', tipo: 'texto', obrigatorio: true },
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['Análise de evolução patrimonial da CGU', 'Denúncia ou representação', 'Auditoria ou comunicação de outro órgão', 'De ofício'] },
                    { id: 'periodo', rotulo: 'Período a examinar', tipo: 'texto', obrigatorio: true },
                    { id: 'indicios', rotulo: 'Indícios de incompatibilidade', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'conhecimento', rotulo: 'Data do conhecimento do fato', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a análise patrimonial, a denúncia ou o relatório de origem', '', { forma: 'juntar' }),
                A.escolha('Encaminhamento', ['Instaurar sindicância patrimonial', 'Instaurar processo disciplinar', 'Arquivar'], { obrigatoria: true }),
                A.documento('Despacho de admissibilidade', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: {
                'Instauração': quando('Encaminhamento', 'Instaurar sindicância patrimonial'),
                'Instauração do processo disciplinar': quando('Encaminhamento', 'Instaurar processo disciplinar'),
                'Arquivamento': quando('Encaminhamento', 'Arquivar'),
            },
        },
        {
            nome: 'Instauração', unidade: 'Corregedoria', avanco: 'auto', vai: ['Apuração patrimonial'],
            orientacao: 'O titular da correição designa comissão de pelo menos dois servidores efetivos ou empregados públicos, sem exigência de estabilidade, e indica o presidente; pode designar suplente (PN 27, art. 51). Preserve o sigilo no ato de designação (conferir a forma de publicação adotada pelo órgão).',
            acoes: [
                A.formulario('Registrar a comissão', [
                    { id: 'presidente', rotulo: 'Presidente', tipo: 'texto', obrigatorio: true },
                    { id: 'membros', rotulo: 'Demais membros', tipo: 'texto', obrigatorio: true },
                    { id: 'instauracao', rotulo: 'Data da instauração', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao' }),
                A.documento('Ato de instauração e designação', 'Portaria', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Apuração patrimonial', unidade: 'Comissão processante', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Aguardando informações externas', 'Relatório conclusivo'],
            orientacao: 'Requisite dados sobre o patrimônio do sindicado e de pessoas ligadas ao fato a cartórios, Detran, juntas comerciais e outros detentores (PN 27, art. 53), e acesse as declarações de bens (Decreto 10.571, art. 7º). Documentos fiscais ou bancários entregues pelo sindicado implicam renúncia ao sigilo para a apuração (art. 54). Prazo de 30 dias, prorrogável por iguais períodos (art. 52; Decreto 10.571, art. 14).',
            acoes: [
                A.fazer('Requisitar informações patrimoniais a cartórios, Detran e juntas comerciais', { obrigatoria: true }),
                A.fazer('Obter as declarações de bens do período', { obrigatoria: true }),
                A.simNao('É preciso afastar sigilo bancário ou fiscal?', { ajuda: 'Sem entrega voluntária, o afastamento do sigilo bancário depende de autorização judicial, pedida pela advocacia pública (LC 105/2001; conferir).' }),
                A.fazer('Pedir à advocacia pública o afastamento judicial do sigilo', { se: quando('É preciso afastar sigilo bancário ou fiscal?', 'sim') }),
                A.comunicar('Convidar o sindicado a prestar esclarecimentos', { especie: 'notificacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Fica convidado a prestar, por escrito e com documentos, esclarecimentos sobre a origem dos recursos indicados no anexo. A participação é facultativa e o procedimento é sigiloso.' }),
                A.esperar('Aguardar os esclarecimentos', 'Convidar o sindicado a prestar esclarecimentos'),
                A.audiencia('Designar oitiva, se houver', 'oitiva'),
                A.documento('Juntar respostas, documentos e termos de oitiva', '', { forma: 'juntar', nivel: 'recomendado' }),
                A.documento('Demonstrativo de evolução patrimonial', 'Relatório', { forma: 'redigir' }),
                A.documento('Juntar o ato de prorrogação, se houver', 'Despacho', { forma: 'qualquer', nivel: 'opcional' }),
                A.simNao('Falta resposta de órgão externo?', { obrigatoria: true, ajuda: 'Se sim, o prazo fica suspenso enquanto se aguarda a informação (PN 27, art. 52, parágrafo único).' }),
            ],
            saidas: { 'Aguardando informações externas': quando('Falta resposta de órgão externo?', 'sim'), 'Relatório conclusivo': quando('Falta resposta de órgão externo?', 'nao') },
        },
        {
            nome: 'Aguardando informações externas', unidade: 'Comissão processante', espera: true, avanco: 'auto',
            orientacao: 'Aguarde a resposta do cartório, do órgão ou a decisão judicial sobre o sigilo. Juntada a resposta, a apuração continua.',
            acoes: [A.documento('Juntar a resposta recebida', '', { forma: 'juntar' })],
        },
        {
            nome: 'Relatório conclusivo', unidade: 'Comissão processante', avanco: 'auto', vai: ['Decisão'],
            orientacao: 'O relatório conclui se há ou não indícios de enriquecimento ilícito e recomenda arquivamento ou processo disciplinar (Decreto 10.571, art. 14, § 3º; PN 27, art. 55).',
            acoes: [
                A.escolha('Conclusão da comissão', ['Há indícios de enriquecimento ilícito', 'Não há indícios'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Relatório conclusivo', 'Relatório', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Decisão', unidade: 'Corregedoria', vai: ['Instauração do processo disciplinar', 'Arquivamento'], ao_entrar: { pendencia: 'Decidir sobre o relatório da sindicância patrimonial.' },
            orientacao: 'A autoridade instauradora decide sobre a recomendação da comissão. Confirmados os indícios, instaura o processo disciplinar e faz as comunicações do art. 56 da PN 27.',
            acoes: [
                A.escolha('Decisão da autoridade', ['Instaurar processo disciplinar', 'Arquivar'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Decisão', 'Decisão', { forma: 'redigir' }),
            ],
            saidas: { 'Instauração do processo disciplinar': quando('Decisão da autoridade', 'Instaurar processo disciplinar'), 'Arquivamento': quando('Decisão da autoridade', 'Arquivar') },
        },
        {
            nome: 'Instauração do processo disciplinar', unidade: 'Corregedoria', vai: ['Encerramento'],
            orientacao: 'Abra o processo disciplinar com cópia desta apuração. Confirmados os indícios na sindicância, comunique de imediato MPF, TCU, Receita Federal, Coaf e AGU; para a CGU, a comunicação se faz pelo registro no sistema correcional (PN 27, art. 56 e parágrafo único).',
            acoes: [
                A.fazer('Abrir o processo disciplinar e vincular a este', { obrigatoria: true, destino: 'autos' }),
                A.simNao('Os indícios foram confirmados nesta sindicância?', { obrigatoria: true }),
                A.fazer('Comunicar MPF, TCU, Receita Federal, Coaf e AGU', { se: quando('Os indícios foram confirmados nesta sindicância?', 'sim') }),
                A.fazer('Registrar no sistema correcional da CGU', { obrigatoria: true }),
                A.documento('Juntar a portaria do processo disciplinar', 'Portaria', { forma: 'qualquer', nivel: 'recomendado' }),
            ],
        },
        { nome: 'Encerramento', unidade: 'Corregedoria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. A apuração segue no processo disciplinar.' },
        { nome: 'Arquivamento', unidade: 'Corregedoria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, em sigilo.' },
    ]);
}

/** 6. Juízo de admissibilidade correcional (Portaria Normativa CGU 27/2022, arts. 35 a 39). */
export function juizoAdmissibilidadeCorrecional() {
    return montar({
        id: 'juizo-admissibilidade-correcional', nome: 'Juízo de admissibilidade correcional', area: 'correcional', porte: 'curto', referencia: 'CGU',
        descricao: 'Triagem de denúncia, representação ou relato de irregularidade que chega à corregedoria, com processo próprio. A unidade registra a notícia, preserva o denunciante e manda à ouvidoria o que veio de cidadão; faz consultas rápidas a sistemas e assentamentos, confere competência e prescrição e pode aguardar informação de outro órgão. O titular decide, por despacho fundamentado, entre arquivar, propor termo de ajustamento de conduta, abrir procedimento investigativo, instaurar logo o processo acusatório ou remeter à autoridade competente. Não há contraditório nem recurso; termina com o arquivamento ou com a abertura do procedimento seguinte.',
        quando: 'Toda notícia de infração disciplinar ou de ato lesivo de pessoa jurídica, inclusive anônima. Use quando a triagem tem número próprio; se a investigação vai correr no mesmo processo, prefira o modelo de sindicância investigativa.',
        base: 'Portaria Normativa CGU 27/2022, arts. 35 a 39 (art. 36, § 2º, incluído pela PN CGU 123/2024), 40, 46, 50, 57, 62, 73, 75, 79, 82, 86, 90 e 94; Decreto 10.153/2019 (proteção ao denunciante); Lei 8.112/1990, art. 144, parágrafo único.',
        tipo: { polos: ['requerido', 'interessado'], nomes_polos: { requerido: 'Noticiado', interessado: 'Denunciante ou representante' } },
    }, [
        {
            nome: 'Recebimento', unidade: 'Corregedoria', avanco: 'auto', ao_entrar: { sigilo: 'restrito' }, nome_publico: 'Notícia recebida',
            orientacao: 'Registre a notícia. Denúncia de cidadão recebida direto pela corregedoria vai à ouvidoria, sem publicidade e preservando o denunciante (PN 27, art. 36; Decreto 10.153/2019). Representação funcional e comunicação feita no exercício da função seguem direto aqui (art. 36, § 2º). Denúncia anônima também é examinada (art. 38).',
            acoes: [
                A.formulario('Registrar a notícia', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['Denúncia de cidadão pela ouvidoria', 'Representação funcional', 'Comunicação de outro órgão', 'De ofício'] },
                    { id: 'conhecimento', rotulo: 'Data do conhecimento do fato', tipo: 'data', obrigatorio: true },
                    { id: 'fato', rotulo: 'Fato noticiado', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'noticiados', rotulo: 'Agentes ou pessoas jurídicas noticiados', tipo: 'texto', obrigatorio: false },
                    { id: 'vinculo', rotulo: 'Vínculo do noticiado', tipo: 'lista', obrigatorio: true, opcoes: ['Servidor estatutário', 'Empregado público', 'Servidor temporário', 'Pessoa jurídica', 'Não identificado'] },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a denúncia, representação ou termo', 'Denúncia', { forma: 'juntar' }),
                A.simNao('A denúncia de cidadão chegou direto à corregedoria?', { obrigatoria: true }),
                A.fazer('Encaminhar à ouvidoria, preservando o denunciante', { se: quando('A denúncia de cidadão chegou direto à corregedoria?', 'sim') }),
            ],
        },
        {
            nome: 'Análise prévia', unidade: 'Corregedoria', vai: ['Aguardando informação', 'Despacho de admissibilidade'],
            orientacao: 'Consulte sistemas, assentamentos funcionais e processos anteriores e peça informações simples à unidade envolvida. Confira se a apuração é desta unidade (PN 27, art. 37, parágrafo único) e se já houve prescrição (art. 38, § 3º). Infração de menor potencial ofensivo leva à proposta de TAC (arts. 38, § 4º, e 62).',
            acoes: [
                A.fazer('Consultar sistemas, assentamentos e processos anteriores', { obrigatoria: true }),
                A.documento('Juntar as informações colhidas', '', { forma: 'juntar', nivel: 'recomendado' }),
                A.simNao('A apuração é da competência desta unidade?', { obrigatoria: true }),
                A.simNao('A pretensão já está prescrita?', { obrigatoria: true }),
                A.simNao('A infração é punível só com advertência ou suspensão de até 30 dias?', { ajuda: 'Se sim, e sem impedimento, proponha TAC (PN 27, arts. 38, § 4º, e 62).' }),
                A.simNao('Falta informação de outro órgão?', { obrigatoria: true }),
            ],
            saidas: { 'Aguardando informação': quando('Falta informação de outro órgão?', 'sim'), 'Despacho de admissibilidade': quando('Falta informação de outro órgão?', 'nao') },
        },
        {
            nome: 'Aguardando informação', unidade: 'Corregedoria', espera: true, avanco: 'auto',
            orientacao: 'Aguarde a resposta. Se a lacuna exigir diligências e oitivas, prefira abrir procedimento investigativo em vez de alongar a triagem (PN 27, art. 37, III).',
            acoes: [A.documento('Juntar a resposta recebida', '', { forma: 'juntar' })],
        },
        {
            nome: 'Despacho de admissibilidade', unidade: 'Corregedoria', vai: ['Arquivamento', 'Abertura do procedimento seguinte', 'Remessa à autoridade competente'],
            orientacao: 'O titular da unidade de correição decide de forma fundamentada (PN 27, art. 37). Com indícios de autoria e materialidade, instaure o processo acusatório sem investigação prévia (art. 39); faltando informação que exija diligências, procedimento investigativo; sem indícios mínimos ou com prescrição, arquivamento (art. 38, §§ 2º e 3º).',
            acoes: [
                A.escolha('Encaminhamento', ['Arquivar', 'Propor TAC', 'Instaurar procedimento investigativo', 'Instaurar processo acusatório', 'Remeter à autoridade competente'], { obrigatoria: true, destino: 'autos' }),
                A.escolha('Procedimento investigativo', ['Investigação preliminar sumária', 'Sindicância investigativa', 'Sindicância patrimonial', 'Investigação preliminar de pessoa jurídica'], { obrigatoria: true, destino: 'informacao', se: quando('Encaminhamento', 'Instaurar procedimento investigativo') }),
                A.escolha('Processo acusatório', ['Sindicância acusatória', 'PAD ordinário', 'PAD sumário', 'Sindicância de servidor temporário', 'Processo de empregado público', 'Processo de responsabilização de pessoa jurídica'], { obrigatoria: true, destino: 'informacao', se: quando('Encaminhamento', 'Instaurar processo acusatório') }),
                A.documento('Despacho fundamentado de admissibilidade', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: {
                'Arquivamento': quando('Encaminhamento', 'Arquivar'),
                'Abertura do procedimento seguinte': quando('Encaminhamento', 'Propor TAC', 'Instaurar procedimento investigativo', 'Instaurar processo acusatório'),
                'Remessa à autoridade competente': quando('Encaminhamento', 'Remeter à autoridade competente'),
            },
        },
        {
            nome: 'Abertura do procedimento seguinte', unidade: 'Corregedoria', vai: ['Encaminhado'],
            orientacao: 'Abra o procedimento escolhido com cópia desta triagem e vincule os dois. TAC, investigação preliminar sumária e sindicância investigativa se abrem por despacho, sem publicação (PN 27, arts. 41, § 2º, e 47, § 1º); os processos acusatórios, por portaria publicada.',
            acoes: [
                A.fazer('Abrir o procedimento e vincular a este', { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o ato de instauração', 'Portaria', { forma: 'qualquer', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Remessa à autoridade competente', unidade: 'Corregedoria', vai: ['Encaminhado'],
            orientacao: 'Encaminhe à autoridade competente para apurar, preservando o sigilo e a identidade do denunciante (PN 27, art. 37, parágrafo único).',
            acoes: [A.documento('Ofício de encaminhamento', 'Ofício', { forma: 'redigir' })],
        },
        { nome: 'Encaminhado', unidade: 'Corregedoria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. A apuração segue no procedimento aberto ou na autoridade competente.' },
        { nome: 'Arquivamento', unidade: 'Corregedoria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Fato novo pode justificar nova análise.' },
    ]);
}

/** 7. Processo disciplinar de empregado público (Portaria Normativa CGU 27/2022, arts. 86 a 93; Lei 9.962/2000; Lei 9.784/1999). */
export function processoDisciplinarEmpregadoPublico() {
    return montar({
        id: 'processo-disciplinar-empregado-publico', nome: 'Processo disciplinar de empregado público', area: 'correcional', porte: 'medio', referencia: 'CGU',
        descricao: 'Apura falta disciplinar de empregado público regido pela CLT, seja da administração direta, autárquica e fundacional (Lei 9.962/2000), seja de empresa pública ou sociedade de economia mista. Instaurado por ato publicado, uma comissão de pelo menos dois servidores ou empregados notifica o acusado, que pode acompanhar a instrução, ouve testemunhas e o interroga, em 30 dias prorrogáveis. Havendo indícios, indicia e abre prazo de defesa escrita; sem defesa, nomeia defensor dativo. A comissão relata e a autoridade julga, podendo aplicar advertência, suspensão de até 30 dias ou rescisão do contrato por justa causa, ou outra medida do regulamento interno da estatal. O empregado é intimado e pode recorrer em 10 dias. Termina com o registro e a execução da medida, ou com o arquivamento.',
        quando: 'Falta disciplinar de empregado celetista de órgão, autarquia, fundação ou estatal. Na estatal, siga o regulamento interno quando existir; para estatutário, use os modelos de PAD.',
        base: 'Portaria Normativa CGU 27/2022, arts. 77, 78 e 86 a 93; Lei 9.962/2000, art. 3º (conferir o texto vigente); CLT, arts. 474 e 482; Lei 8.112/1990, arts. 156, 161 e 164 (no que couber); Lei 9.784/1999, arts. 26 a 28, 44, 49, 56 a 59 e 66.',
        tipo: { polos: ['requerido'], nomes_polos: { requerido: 'Empregado acusado' } },
    }, [
        {
            nome: 'Instauração', unidade: 'Corregedoria', avanco: 'auto', ao_entrar: { sigilo: 'restrito' },
            orientacao: 'O titular da correição instaura por ato publicado e designa comissão de pelo menos dois servidores efetivos ou empregados públicos, sem exigência de estabilidade (PN 27, art. 87, § 1º). Na estatal, siga o rito do regulamento interno; na falta dele, a Lei 9.784 (art. 90). Não há perdão tácito (art. 88).',
            acoes: [
                A.formulario('Registrar a instauração', [
                    { id: 'empregado', rotulo: 'Empregado (nome, emprego e matrícula)', tipo: 'texto', obrigatorio: true },
                    { id: 'regime', rotulo: 'Regime', tipo: 'lista', obrigatorio: true, opcoes: ['Lei 9.962/2000 (órgão, autarquia ou fundação)', 'Empresa pública ou sociedade de economia mista'] },
                    { id: 'fatos', rotulo: 'Fatos a apurar', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'comissao', rotulo: 'Membros da comissão e presidente', tipo: 'texto', obrigatorio: true },
                    { id: 'conhecimento', rotulo: 'Data do conhecimento do fato', tipo: 'data', obrigatorio: true },
                    { id: 'publicacao', rotulo: 'Data de publicação do ato', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Ato de instauração', 'Portaria', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Notificação e instrução', unidade: 'Comissão processante', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Indiciação e defesa', 'Relatório final'],
            orientacao: 'Notifique o acusado da instauração e do direito de acompanhar os atos, pessoalmente ou por procurador (PN 27, art. 77). Recusa de recebimento se certifica com duas testemunhas (art. 78). Ouça testemunhas e, por fim, interrogue o acusado. Prazo de 30 dias, com prorrogações sucessivas (art. 87, § 2º).',
            acoes: [
                A.comunicar('Notificar o acusado da instauração', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Foi instaurado processo disciplinar sobre os fatos do ato anexo. Você pode acompanhar todos os atos, pessoalmente ou por procurador, arrolar e inquirir testemunhas e requerer provas.' }, { obrigatoria: true }),
                A.audiencia('Designar oitiva ou interrogatório', 'oitiva'),
                A.comunicar('Intimar para a oitiva', { especie: 'intimacao', dias: 0, texto: 'Compareça em {audiencia} para a oitiva no processo disciplinar.' }),
                A.documento('Juntar os termos de depoimento e de interrogatório', 'Termo', { forma: 'qualquer' }),
                A.documento('Juntar documentos e diligências', '', { forma: 'juntar', nivel: 'opcional' }),
                A.documento('Juntar o ato de prorrogação, se houver', 'Portaria', { forma: 'qualquer', nivel: 'opcional' }),
                A.escolha('Resultado da instrução', ['Indiciar', 'Propor arquivamento'], { obrigatoria: true }),
            ],
            saidas: { 'Indiciação e defesa': quando('Resultado da instrução', 'Indiciar'), 'Relatório final': quando('Resultado da instrução', 'Propor arquivamento') },
        },
        {
            nome: 'Indiciação e defesa', unidade: 'Comissão processante', avanco: 'auto', vai: ['Relatório final', 'Defensor dativo'], nome_publico: 'Defesa escrita',
            orientacao: 'Lavre a indiciação com os fatos e as provas e intime o acusado para defesa escrita em 10 dias, com vista dos autos (Lei 8.112, art. 161, § 1º, no que couber; Lei 9.784, art. 44). Sem defesa, nomeie defensor dativo (Lei 8.112, art. 164, § 2º, no que couber).',
            acoes: [
                A.documento('Termo de indiciação', 'Termo', { forma: 'redigir' }),
                A.comunicar('Intimar o acusado para defesa escrita', { especie: 'citacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Fica intimado da indiciação anexa. Apresente defesa escrita em 10 dias, com vista dos autos na comissão.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa', 'Intimar o acusado para defesa escrita', { obrigatoria: true }),
            ],
            saidas: { 'Relatório final': quando('Aguardar a defesa', 'Apresentada', 'Parcial'), 'Defensor dativo': quando('Aguardar a defesa', 'Sem manifestação') },
        },
        {
            nome: 'Defensor dativo', unidade: 'Comissão processante', vai: ['Relatório final'],
            orientacao: 'Declare a revelia e designe defensor dativo, que tem novo prazo para a defesa.',
            acoes: [
                A.texto('Defensor dativo designado', { obrigatoria: true, destino: 'informacao' }),
                A.documento('Juntar a defesa do dativo', 'Defesa', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Relatório final', unidade: 'Comissão processante', avanco: 'auto', vai: ['Julgamento'],
            orientacao: 'O relatório resume as provas e a defesa e conclui pela inocência ou pela responsabilidade, indicando o dispositivo violado e a medida cabível. Rescisão por justa causa só nas hipóteses do art. 482 da CLT e do art. 3º da Lei 9.962; suspensão acima de 30 dias não é admitida (CLT, art. 474).',
            acoes: [
                A.escolha('Conclusão da comissão', ['Arquivamento', 'Advertência', 'Suspensão de até 30 dias', 'Rescisão por justa causa', 'Outra medida do regulamento interno'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Relatório final', 'Relatório', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Julgamento', unidade: 'Gabinete', vai: ['Recurso', 'Execução e registro'], ao_entrar: { pendencia: 'Julgar o processo disciplinar do empregado.' },
            orientacao: 'A autoridade competente julga em 30 dias (Lei 9.784, art. 49), acolhendo o relatório ou divergindo de forma motivada. Intime o empregado; cabe recurso em 10 dias (art. 59) ou o previsto no regulamento interno.',
            acoes: [
                A.documento('Juntar a manifestação jurídica', 'Parecer', { forma: 'juntar', nivel: 'recomendado' }),
                A.escolha('Decisão', ['Arquivamento', 'Advertência', 'Suspensão de até 30 dias', 'Rescisão por justa causa', 'Outra medida do regulamento interno'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Decisão de julgamento', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar o empregado da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Fica intimado da decisão anexa. Cabe recurso em 10 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar o empregado da decisão', { obrigatoria: true }),
            ],
            saidas: { 'Recurso': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Execução e registro': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Execução e registro'],
            orientacao: 'Quem decidiu pode reconsiderar em 5 dias; se não, remete à autoridade superior, que decide em 30 dias (Lei 9.784, arts. 56, § 1º, e 59, § 1º). No recurso por insuficiência de desempenho, o efeito é suspensivo (Lei 9.962, art. 3º, IV, conferir).',
            acoes: [
                A.documento('Juntar o recurso', 'Recurso', { forma: 'juntar' }),
                A.escolha('Resultado do recurso', ['Provido', 'Provido em parte', 'Desprovido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Decisão do recurso', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar o empregado da decisão do recurso', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado da decisão do recurso.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Execução e registro', unidade: 'Recursos humanos', vai: ['Arquivamento'],
            orientacao: 'Aplique a medida e anote nos assentamentos; na rescisão por justa causa, faça a baixa do contrato e as verbas devidas. Registre o resultado no sistema correcional da CGU.',
            acoes: [
                A.simNao('Há medida disciplinar a aplicar?', { obrigatoria: true }),
                A.fazer('Aplicar a medida e anotar nos assentamentos', { obrigatoria: true, destino: 'autos', se: quando('Há medida disciplinar a aplicar?', 'sim') }),
                A.fazer('Registrar no sistema correcional', { obrigatoria: true }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Corregedoria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

export const modelos = [
    conciliacaoCcaf, acordoTransacaoUniao, cobrancaDividaAtivaNaoTributaria,
    acordoLeniencia, sindicanciaPatrimonial, juizoAdmissibilidadeCorrecional, processoDisciplinarEmpregadoPublico,
];
