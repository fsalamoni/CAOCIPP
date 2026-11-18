// Modelos da área sancionador (administrativo). Ver a forma de escrever em ./dsl.js e o exemplo em ./geral.js.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';
const ARQUIVO = { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' };

/** 5. Processo administrativo de responsabilização de pessoa jurídica (Lei 12.846/2013; Decreto 11.129/2022). */
export function parPessoaJuridica() {
    return montar({
        id: 'par-pessoa-juridica', nome: 'Responsabilização de pessoa jurídica (PAR)', area: 'sancionador', porte: 'longo', referencia: 'CGU',
        descricao: 'Apura a responsabilidade objetiva de pessoa jurídica por ato lesivo à Administração, como fraude a licitação, oferta de vantagem indevida a agente público ou obstrução de fiscalização. Começa pelo juízo de admissibilidade, que pode abrir investigação preliminar sigilosa, e segue com portaria, comissão de dois ou mais servidores estáveis, nota de indiciação e instrução. O contraditório está na defesa escrita em 30 dias, na manifestação sobre prova nova em 10 dias e sobre o relatório final em 10 dias. Termina com julgamento precedido de manifestação jurídica obrigatória, pedido de reconsideração com efeito suspensivo e cumprimento das sanções, com registro no CNEP.',
        quando: 'Indício de ato lesivo do art. 5º da Lei 12.846 praticado por empresa. Se o mesmo fato também for infração da Lei 14.133, as duas apurações correm juntas por este rito.',
        base: 'Lei 12.846/2013, arts. 5º, 6º, 8º a 15 e 25; Decreto 11.129/2022, arts. 3º a 16; Portaria Normativa CGU 27/2022, arts. 59, 60 e 96; Lei 14.133/2021, art. 159.',
        tipo: { polos: ['requerido'], nomes_polos: { requerido: 'Pessoa jurídica processada' } },
    }, [
        {
            nome: 'Juízo de admissibilidade', unidade: 'Corregedoria', vai: ['Instauração', 'Investigação preliminar', 'Arquivamento'],
            orientacao: 'Examine a notícia do ato lesivo e decida, por despacho fundamentado, entre investigação preliminar, recomendação de instauração do PAR ou arquivamento (Decreto 11.129, art. 3º). Anote a data da ciência do fato: a prescrição é de 5 anos e só a instauração a interrompe (Lei 12.846, art. 25).',
            acoes: [
                A.formulario('Registrar a notícia do ato lesivo', [
                    { id: 'pj', rotulo: 'Pessoa jurídica (razão social e CNPJ)', tipo: 'texto', obrigatorio: true },
                    { id: 'fato', rotulo: 'Fato e ato lesivo do art. 5º em tese', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'ciencia', rotulo: 'Data da ciência do fato', tipo: 'data', obrigatorio: true },
                    { id: 'licitacao', rotulo: 'Também é infração da Lei 14.133?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'leniencia', rotulo: 'Há proposta de acordo de leniência?', tipo: 'sim_nao' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a notícia e os elementos de prova', '', { forma: 'juntar' }),
                A.escolha('Encaminhamento', ['Recomendar o PAR', 'Investigação preliminar', 'Arquivar'], { obrigatoria: true, ajuda: 'Indícios suficientes: PAR. Indícios parciais: investigação preliminar. Sem indícios: arquivamento.' }),
                A.documento('Despacho fundamentado de admissibilidade', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: { 'Instauração': quando('Encaminhamento', 'Recomendar o PAR'), 'Investigação preliminar': quando('Encaminhamento', 'Investigação preliminar'), 'Arquivamento': quando('Encaminhamento', 'Arquivar') },
        },
        {
            nome: 'Investigação preliminar', unidade: 'Corregedoria', prazo_dias: 60, prazo_auto: true, prazo_contagem: corridos, ao_entrar: { sigilo: 'restrito' }, vai: ['Instauração', 'Arquivamento'],
            orientacao: 'Procedimento sigiloso e não punitivo (Decreto 11.129, art. 3º, § 1º), conduzido pela corregedoria ou por comissão de dois ou mais servidores efetivos. Prazo de 60 dias, prorrogável (PN CGU 27, art. 59), dentro do limite de 180 dias do decreto (art. 3º, § 4º). Termina com relatório conclusivo sobre autoria e materialidade (art. 3º, § 5º).',
            acoes: [
                A.documento('Juntar diligências, informações e provas compartilhadas', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.documento('Relatório conclusivo da investigação', 'Relatório', { forma: 'redigir' }),
                A.escolha('Conclusão da investigação', ['Recomendar o PAR', 'Arquivar'], { obrigatoria: true }),
            ],
            saidas: { 'Instauração': quando('Conclusão da investigação', 'Recomendar o PAR'), 'Arquivamento': quando('Conclusão da investigação', 'Arquivar') },
        },
        {
            nome: 'Instauração', unidade: 'Gabinete',
            orientacao: 'A autoridade máxima do órgão ou entidade instaura o PAR por portaria, que designa comissão de dois ou mais servidores estáveis (Lei 12.846, arts. 8º e 10; Decreto 11.129, arts. 4º e 5º). A competência pode ser delegada, vedada a subdelegação. A instauração interrompe a prescrição (Lei 12.846, art. 25, parágrafo único) e abre os 180 dias da comissão, prorrogáveis. Revise o nível de acesso: mantenha sigilo só se necessário à apuração (Decreto 11.129, art. 5º, § 3º).',
            acoes: [
                A.documento('Portaria de instauração e designação da comissão', 'Portaria', { forma: 'redigir' }),
                A.data('Data da publicação da portaria', { obrigatoria: true, destino: 'informacao', ajuda: 'Marca a interrupção da prescrição e o início dos 180 dias da comissão.' }),
            ],
        },
        {
            nome: 'Indiciação e defesa', unidade: 'Comissão processante', avanco: 'auto', nome_publico: 'Defesa escrita',
            orientacao: 'Lavre a nota de indiciação com descrição clara do ato lesivo, apontamento das provas e enquadramento legal (Decreto 11.129, art. 6º, § 2º) e intime a pessoa jurídica para defesa escrita em 30 dias (Lei 12.846, art. 11). Se a intimação falhar, publique edital na imprensa oficial e no sítio do órgão; o prazo conta da última publicação (art. 6º, § 3º). Sem defesa, os prazos seguintes correm sem nova intimação, e a empresa pode intervir a qualquer tempo, sem repetir atos (art. 6º, § 4º).',
            acoes: [
                A.documento('Nota de indiciação', 'Nota de indiciação', { forma: 'redigir' }),
                A.comunicar('Intimar para a defesa escrita', { especie: 'intimacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Fica intimada da nota de indiciação. Apresente defesa escrita em 30 dias, especificando as provas que pretende produzir. Pode informar atenuantes da multa e apresentar documentos do seu programa de integridade.' }, { obrigatoria: true }),
                A.simNao('A intimação pessoal foi frustrada?', { ajuda: 'Se sim, publique edital na imprensa oficial e no sítio do órgão (art. 6º, § 3º).' }),
                A.fazer('Publicar o edital de intimação', { se: quando('A intimação pessoal foi frustrada?', 'sim') }),
                A.esperar('Aguardar a defesa escrita', 'Intimar para a defesa escrita', { obrigatoria: true }),
                A.fazer('Certificar a falta de defesa', { se: quando('Aguardar a defesa escrita', 'Sem manifestação'), ajuda: 'Os prazos seguintes correm sem nova intimação (art. 7º, § 2º).' }),
            ],
        },
        {
            nome: 'Instrução', unidade: 'Comissão processante', vai: ['Relatório final', 'Manifestação sobre prova nova', 'Indiciação e defesa'],
            orientacao: 'Decida sobre as provas pedidas, indeferindo por despacho fundamentado as ilícitas, impertinentes, desnecessárias, protelatórias ou intempestivas (Decreto 11.129, art. 8º). Valem todos os meios de prova, inclusive oitivas, perícias e compartilhamento de informações (art. 10); intime com 3 dias úteis de antecedência (Lei 9.784, art. 41). Avalie o programa de integridade para a dosimetria (art. 8º, § 2º). Prova nova depois da indiciação: manifestação em 10 dias; se mudar a acusação, nova indiciação com novo prazo de 30 dias (art. 8º, § 1º).',
            acoes: [
                A.escolha('Provas requeridas pela defesa', ['Deferidas', 'Deferidas em parte', 'Indeferidas', 'Não houve pedido'], { obrigatoria: true }),
                A.documento('Despacho fundamentado sobre as provas', 'Despacho', { forma: 'redigir', se: quando('Provas requeridas pela defesa', 'Deferidas em parte', 'Indeferidas') }),
                A.simNao('Haverá oitiva, perícia ou outra diligência?', { obrigatoria: true }),
                A.audiencia('Designar a oitiva ou diligência', 'oitiva', { se: quando('Haverá oitiva, perícia ou outra diligência?', 'sim') }),
                A.comunicar('Intimar para a oitiva', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimada a acompanhar a oitiva ou diligência marcada para {audiencia}.' }, { se: quando('Haverá oitiva, perícia ou outra diligência?', 'sim') }),
                A.documento('Juntar as provas produzidas', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.documento('Avaliação do programa de integridade', 'Nota técnica', { forma: 'redigir', nivel: 'recomendado' }),
                A.escolha('Prova nova após a indiciação?', ['Não houve', 'Houve, sem mudar a acusação', 'Houve e muda a acusação'], { obrigatoria: true }),
            ],
            saidas: {
                'Relatório final': quando('Prova nova após a indiciação?', 'Não houve'),
                'Manifestação sobre prova nova': quando('Prova nova após a indiciação?', 'Houve, sem mudar a acusação'),
                'Indiciação e defesa': quando('Prova nova após a indiciação?', 'Houve e muda a acusação'),
            },
        },
        {
            nome: 'Manifestação sobre prova nova', unidade: 'Comissão processante', espera: true, avanco: 'auto', nome_publico: 'Manifestação sobre novas provas',
            orientacao: 'Intime a pessoa jurídica para se manifestar em 10 dias sobre a prova juntada depois da indiciação (Decreto 11.129, art. 8º, § 1º). Com a resposta ou o fim do prazo, o processo volta à instrução.',
            acoes: [
                A.documento('Indicar as provas novas', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.comunicar('Intimar para manifestação sobre prova nova', { especie: 'intimacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Foram juntadas provas novas depois da indiciação. Manifeste-se em 10 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar a manifestação', 'Intimar para manifestação sobre prova nova', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Relatório final', unidade: 'Comissão processante',
            orientacao: 'O relatório conclui pela responsabilização, com as sanções e a dosimetria, ou pelo arquivamento; indica, se for o caso, a reparação do dano, a remessa à advocacia pública e a outros órgãos e as condições de reabilitação (Decreto 11.129, art. 11). Entregue dentro dos 180 dias, prorrogáveis a pedido justificado do presidente (art. 5º, § 4º). A ata de encerramento desconstitui a comissão (art. 12).',
            acoes: [
                A.escolha('Conclusão da comissão', ['Responsabilização', 'Arquivamento'], { obrigatoria: true, destino: 'autos' }),
                A.formulario('Proposta de sanção e dosimetria', [
                    { id: 'multa', rotulo: 'Multa proposta (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'faturamento', rotulo: 'Faturamento bruto usado como base (R$)', tipo: 'numero' },
                    { id: 'publicacao', rotulo: 'Publicação extraordinária da decisão?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'dano', rotulo: 'Houve dano a reparar?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'remessa', rotulo: 'Remessa a outros órgãos', tipo: 'texto_longo' },
                    { id: 'reabilitacao', rotulo: 'Condições de reabilitação', tipo: 'texto_longo' },
                ], { se: quando('Conclusão da comissão', 'Responsabilização'), destino: 'informacao', folha_dados: true }),
                A.documento('Relatório final da comissão', 'Relatório', { forma: 'redigir' }),
                A.documento('Ata de encerramento dos trabalhos', 'Ata', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Manifestação sobre o relatório', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Manifestação sobre o relatório final',
            orientacao: 'Por determinação da autoridade instauradora, intime a pessoa jurídica do relatório final para se manifestar em 10 dias (Decreto 11.129, art. 12).',
            acoes: [
                A.comunicar('Intimar do relatório final', { especie: 'intimacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Fica intimada do relatório final da comissão. Manifeste-se em 10 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar a manifestação sobre o relatório', 'Intimar do relatório final', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Análise de regularidade', unidade: 'Corregedoria', vai: ['Manifestação jurídica', 'Instrução'],
            orientacao: 'A corregedoria analisa a regularidade e o mérito do processo (Decreto 11.129, art. 12, parágrafo único). Vício sanável volta à comissão, que pode ser reconduzida.',
            acoes: [
                A.escolha('Regularidade do processo', ['Regular', 'Vício a sanar pela comissão'], { obrigatoria: true }),
                A.documento('Nota de análise de regularidade e mérito', 'Nota técnica', { forma: 'redigir' }),
            ],
            saidas: { 'Manifestação jurídica': quando('Regularidade do processo', 'Regular'), 'Instrução': quando('Regularidade do processo', 'Vício a sanar pela comissão') },
        },
        {
            nome: 'Manifestação jurídica', unidade: 'Assessoria jurídica', avanco: 'auto',
            orientacao: 'Manifestação do órgão de assistência jurídica, obrigatória antes do julgamento (Decreto 11.129, art. 13).',
            acoes: [A.documento('Juntar a manifestação jurídica', 'Parecer', { forma: 'redigir' })],
        },
        {
            nome: 'Julgamento', unidade: 'Gabinete', ao_entrar: { pendencia: 'Julgar o PAR: relatório final, manifestação da pessoa jurídica e manifestação jurídica estão nos autos.' }, vai: ['Reconsideração', 'Cumprimento'],
            orientacao: 'A autoridade julga e, se divergir do relatório, fundamenta nas provas dos autos (Decreto 11.129, art. 13, parágrafo único). Publique a decisão no Diário Oficial e no sítio do órgão (art. 14). Cabe pedido de reconsideração em 10 dias, com efeito suspensivo (art. 15). Não há recurso hierárquico.',
            acoes: [
                A.escolha('Decisão', ['Aplica sanções', 'Arquiva'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.simNao('A decisão diverge do relatório da comissão?', { obrigatoria: true, ajuda: 'Se sim, fundamente nas provas dos autos (art. 13, parágrafo único).' }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
                A.fazer('Publicar a decisão no Diário Oficial e no sítio do órgão', { obrigatoria: true }),
                A.comunicar('Intimar da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Fica intimada da decisão. Cabe pedido de reconsideração em 10 dias, com efeito suspensivo.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de reconsideração', 'Intimar da decisão', { obrigatoria: true }),
            ],
            saidas: { 'Reconsideração': quando('Aguardar o prazo de reconsideração', 'Apresentada', 'Parcial'), 'Cumprimento': quando('Aguardar o prazo de reconsideração', 'Sem manifestação') },
        },
        {
            nome: 'Reconsideração', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos,
            orientacao: 'A autoridade decide o pedido de reconsideração em 30 dias (Decreto 11.129, art. 15). O pedido tem efeito suspensivo; o prazo de cumprimento conta da nova decisão (art. 15, § 3º).',
            acoes: [
                A.escolha('Pedido de reconsideração', ['Provido', 'Provido em parte', 'Não provido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão sobre a reconsideração', 'Decisão', { forma: 'redigir' }),
                A.fazer('Publicar a nova decisão', { obrigatoria: true }),
                A.comunicar('Intimar da decisão sobre a reconsideração', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimada da decisão sobre o pedido de reconsideração.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Cumprimento', unidade: 'Secretaria',
            orientacao: 'A pessoa jurídica tem 30 dias para cumprir as sanções, contados do fim do prazo de reconsideração ou da nova decisão (Decreto 11.129, art. 15, §§ 1º e 3º). Registre a sanção no CNEP e no CEIS, dê conhecimento ao Ministério Público (Lei 12.846, art. 15) e encaminhe a reparação do dano, se houver, a processo próprio (art. 13).',
            acoes: [
                A.escolha('Resultado final', ['Sanções aplicadas', 'Sem sanção'], { obrigatoria: true }),
                A.comunicar('Notificar para cumprir as sanções', { especie: 'notificacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Cumpra as sanções aplicadas em 30 dias, inclusive o pagamento da multa e a publicação extraordinária, se determinada.' }, { se: quando('Resultado final', 'Sanções aplicadas') }),
                A.esperar('Aguardar o cumprimento', 'Notificar para cumprir as sanções', { se: quando('Resultado final', 'Sanções aplicadas') }),
                A.fazer('Registrar a sanção no CNEP e no CEIS', { se: quando('Resultado final', 'Sanções aplicadas') }),
                A.fazer('Encaminhar a multa não paga à advocacia pública para cobrança', { se: quando('Aguardar o cumprimento', 'Sem manifestação', 'Parcial') }),
                A.fazer('Dar conhecimento ao Ministério Público da conclusão do processo', { obrigatoria: true }),
                A.fazer('Abrir processo específico de reparação do dano, se houver', {}),
            ],
        },
        ARQUIVO,
    ]);
}

/** 6. Apuração de infração e sanção a licitante ou contratada (Lei 14.133/2021, arts. 155 a 163 e 166 a 168). */
export function sancaoFornecedor() {
    return montar({
        id: 'sancao-fornecedor', nome: 'Infração contratual e sanção a fornecedor', area: 'sancionador', porte: 'medio', referencia: 'Lei 14.133',
        descricao: 'Apura infração de licitante ou contratada, como inexecução, atraso injustificado, não manter a proposta ou apresentar documento falso, e aplica advertência, multa, impedimento de licitar e contratar ou declaração de inidoneidade. O juízo de admissibilidade define a sanção cabível em tese, e com ela o rito: o simples, conduzido pelo setor de contratos, para advertência e multa; ou o com comissão de dois ou mais servidores estáveis, obrigatório para impedimento e inidoneidade. O contraditório está na defesa em 15 dias úteis, nas alegações finais em 15 dias úteis quando há prova nova e no recurso ou pedido de reconsideração, ambos com efeito suspensivo. Termina com a execução da sanção, a cobrança da multa e o registro no CEIS e no CNEP.',
        quando: 'Ocorrência registrada pelo fiscal ou gestor do contrato, ou pelo agente de contratação na licitação, que possa configurar infração do art. 155 da Lei 14.133. No Ministério Público do RS, prefira "Descumprimento contratual no MPRS", com as autoridades e os prazos do Provimento 104/2023-PGJ.',
        base: 'Lei 14.133/2021, arts. 117, § 1º, 155 a 163, 166 a 168 e 183.',
        tipo: { polos: ['requerido'], nomes_polos: { requerido: 'Contratada ou licitante' } },
    }, [
        {
            nome: 'Comunicação da ocorrência', unidade: 'Fiscalização',
            orientacao: 'O fiscal ou gestor do contrato, ou o agente de contratação, relata a ocorrência com as cláusulas descumpridas, as provas e o cálculo preliminar da multa, com base nos registros do histórico do contrato (art. 117, § 1º).',
            acoes: [
                A.formulario('Dados da ocorrência', [
                    { id: 'fornecedor', rotulo: 'Fornecedor (razão social e CNPJ)', tipo: 'texto', obrigatorio: true },
                    { id: 'contrato', rotulo: 'Contrato ou licitação', tipo: 'texto', obrigatorio: true },
                    { id: 'clausulas', rotulo: 'Cláusulas ou obrigações descumpridas', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'ciencia', rotulo: 'Data da ciência da infração', tipo: 'data', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor do contrato (R$)', tipo: 'numero' },
                    { id: 'multa', rotulo: 'Multa estimada (R$)', tipo: 'numero' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Relatório de ocorrência', 'Relatório', { forma: 'qualquer' }),
                A.documento('Juntar os registros do histórico do contrato', '', { forma: 'juntar', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Juízo de admissibilidade', unidade: 'Setor de contratos', vai: ['Defesa no rito simples', 'Instauração da comissão', 'Arquivamento'],
            orientacao: 'Enquadre o fato nos incisos do art. 155 e defina a sanção cabível em tese (art. 156): advertência ou multa seguem o rito simples (art. 157); impedimento ou inidoneidade exigem comissão (art. 158). Se o fato também for ato lesivo da Lei 12.846, a apuração segue o rito do PAR, nos mesmos autos (art. 159). A prescrição é de 5 anos da ciência da infração (art. 158, § 4º).',
            acoes: [
                A.texto('Inciso do art. 155 em que o fato se enquadra', { obrigatoria: true, destino: 'informacao' }),
                A.escolha('Sanção cabível em tese', ['Advertência ou multa', 'Impedimento ou inidoneidade', 'Ato lesivo da Lei 12.846', 'Arquivar'], { obrigatoria: true }),
                A.fazer('Remeter os autos para apuração conjunta no rito do PAR', { se: quando('Sanção cabível em tese', 'Ato lesivo da Lei 12.846') }),
                A.documento('Despacho de admissibilidade', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: {
                'Defesa no rito simples': quando('Sanção cabível em tese', 'Advertência ou multa'),
                'Instauração da comissão': quando('Sanção cabível em tese', 'Impedimento ou inidoneidade'),
                'Arquivamento': quando('Sanção cabível em tese', 'Ato lesivo da Lei 12.846', 'Arquivar'),
            },
        },
        {
            nome: 'Defesa no rito simples', unidade: 'Setor de contratos', avanco: 'auto', vai: ['Análise jurídica'], nome_publico: 'Defesa prévia',
            orientacao: 'Intime a contratada com a descrição dos fatos, o enquadramento e a sanção possível, para defesa em 15 dias úteis (art. 157). O prazo começa no primeiro dia útil seguinte à disponibilização eletrônica ou à juntada do aviso de recebimento (art. 183). Sem defesa, o processo segue e a decisão é motivada mesmo assim.',
            acoes: [
                A.comunicar('Intimar para a defesa', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Fica intimada dos fatos, do enquadramento e da sanção possível, descritos a seguir. Apresente defesa em 15 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa', 'Intimar para a defesa', { obrigatoria: true }),
                A.fazer('Certificar a falta de defesa', { se: quando('Aguardar a defesa', 'Sem manifestação') }),
            ],
        },
        {
            nome: 'Instauração da comissão', unidade: 'Gabinete',
            orientacao: 'A autoridade instaura o processo de responsabilização por portaria, com comissão de dois ou mais servidores estáveis ou empregados do quadro permanente (art. 158, caput e § 1º). A instauração interrompe a prescrição (art. 158, § 4º, I).',
            acoes: [
                A.documento('Portaria de instauração e designação da comissão', 'Portaria', { forma: 'redigir' }),
                A.data('Data da instauração', { obrigatoria: true, destino: 'informacao', ajuda: 'Marca a interrupção da prescrição (art. 158, § 4º, I).' }),
            ],
        },
        {
            nome: 'Defesa perante a comissão', unidade: 'Comissão processante', avanco: 'auto', nome_publico: 'Defesa escrita',
            orientacao: 'A comissão intima a contratada para defesa em 15 dias úteis, com especificação das provas que pretende produzir (art. 158).',
            acoes: [
                A.comunicar('Intimar para a defesa escrita', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Fica intimada dos fatos, do enquadramento e da sanção possível. Apresente defesa em 15 dias úteis, especificando as provas que pretende produzir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa escrita', 'Intimar para a defesa escrita', { obrigatoria: true }),
                A.fazer('Certificar a falta de defesa', { se: quando('Aguardar a defesa escrita', 'Sem manifestação') }),
            ],
        },
        {
            nome: 'Instrução', unidade: 'Comissão processante', vai: ['Alegações finais', 'Relatório da comissão'],
            orientacao: 'Indefira por decisão fundamentada as provas ilícitas, impertinentes, desnecessárias, protelatórias ou intempestivas (art. 158, § 3º). A lei não prevê audiência; se houver oitiva, intime com 3 dias úteis de antecedência (Lei 9.784, art. 41). Havendo prova nova deferida ou juntada pela comissão, abra alegações finais (art. 158, § 2º).',
            acoes: [
                A.escolha('Provas requeridas pela defesa', ['Deferidas', 'Deferidas em parte', 'Indeferidas', 'Não houve pedido'], { obrigatoria: true }),
                A.documento('Decisão fundamentada sobre as provas', 'Despacho', { forma: 'redigir', se: quando('Provas requeridas pela defesa', 'Deferidas em parte', 'Indeferidas') }),
                A.simNao('Haverá oitiva?', { obrigatoria: true }),
                A.audiencia('Designar a oitiva', 'oitiva', { se: quando('Haverá oitiva?', 'sim') }),
                A.comunicar('Intimar para a oitiva', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimada a acompanhar a oitiva marcada para {audiencia}.' }, { se: quando('Haverá oitiva?', 'sim') }),
                A.documento('Juntar as provas produzidas', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.simNao('Houve prova nova deferida ou juntada pela comissão?', { obrigatoria: true }),
            ],
            saidas: { 'Alegações finais': quando('Houve prova nova deferida ou juntada pela comissão?', 'sim'), 'Relatório da comissão': quando('Houve prova nova deferida ou juntada pela comissão?', 'nao') },
        },
        {
            nome: 'Alegações finais', unidade: 'Comissão processante', avanco: 'auto',
            orientacao: 'Intime a contratada para alegações finais em 15 dias úteis, contados da intimação (art. 158, § 2º).',
            acoes: [
                A.comunicar('Intimar para alegações finais', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Encerrada a instrução com prova nova, apresente alegações finais em 15 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar as alegações finais', 'Intimar para alegações finais', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Relatório da comissão', unidade: 'Comissão processante',
            orientacao: 'A comissão relata os fatos, as provas, a defesa e propõe a sanção ou o arquivamento, com os critérios do art. 156, § 1º.',
            acoes: [
                A.escolha('Proposta da comissão', ['Impedimento de licitar e contratar', 'Declaração de inidoneidade', 'Advertência ou multa', 'Arquivamento'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Relatório da comissão', 'Relatório', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Análise jurídica', unidade: 'Assessoria jurídica', avanco: 'auto',
            orientacao: 'Obrigatória antes da declaração de inidoneidade (art. 156, § 6º) e da desconsideração da personalidade jurídica (art. 160); usual nos demais casos.',
            acoes: [A.documento('Juntar o parecer jurídico', 'Parecer', { forma: 'redigir' })],
        },
        {
            nome: 'Decisão', unidade: 'Gabinete', ao_entrar: { pendencia: 'Decidir a sanção ao fornecedor: defesa, relatório e parecer jurídico estão nos autos.' }, vai: ['Recurso ou reconsideração', 'Execução e registro'],
            orientacao: 'Considere a natureza e a gravidade da infração, as peculiaridades do caso, agravantes e atenuantes, os danos e o programa de integridade (art. 156, § 1º). Multa de 0,5% a 30% do valor do contrato (§ 3º); impedimento por até 3 anos, no ente que aplicou (§ 4º); inidoneidade de 3 a 6 anos, em todos os entes, decidida pela autoridade máxima (§§ 5º e 6º). Intime abrindo 15 dias úteis para recurso ou reconsideração.',
            acoes: [
                A.escolha('Sanção aplicada', ['Advertência', 'Multa', 'Impedimento de licitar e contratar', 'Declaração de inidoneidade', 'Nenhuma, arquivar'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.formulario('Dosimetria', [
                    { id: 'gravidade', rotulo: 'Natureza, gravidade e peculiaridades', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'circunstancias', rotulo: 'Agravantes e atenuantes', tipo: 'texto_longo' },
                    { id: 'dano', rotulo: 'Dano à Administração (R$)', tipo: 'numero' },
                    { id: 'integridade', rotulo: 'Programa de integridade considerado?', tipo: 'sim_nao' },
                    { id: 'multa', rotulo: 'Percentual da multa sobre o contrato', tipo: 'numero' },
                    { id: 'anos', rotulo: 'Duração do impedimento ou inidoneidade (anos)', tipo: 'numero' },
                ], { se: quando('Sanção aplicada', 'Advertência', 'Multa', 'Impedimento de licitar e contratar', 'Declaração de inidoneidade'), destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a decisão motivada', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Fica intimada da decisão. Cabe recurso em 15 dias úteis contra advertência, multa ou impedimento, e pedido de reconsideração em 15 dias úteis contra a inidoneidade, ambos com efeito suspensivo.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar da decisão', { obrigatoria: true }),
            ],
            saidas: { 'Recurso ou reconsideração': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Execução e registro': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso ou reconsideração', unidade: 'Gabinete', prazo_dias: 20, prazo_auto: true, vai: ['Instância recursal', 'Execução e registro'], padrao: 'Execução e registro',
            orientacao: 'Contra advertência, multa e impedimento cabe recurso: a autoridade que decidiu pode reconsiderar em 5 dias úteis; se não, encaminha à autoridade superior, que decide em 20 dias úteis (art. 166). Contra a inidoneidade cabe só pedido de reconsideração, decidido em 20 dias úteis (art. 167). Ambos têm efeito suspensivo (art. 168).',
            acoes: [
                A.escolha('Espécie', ['Recurso', 'Pedido de reconsideração da inidoneidade'], { obrigatoria: true }),
                A.escolha('Reconsiderar a decisão?', ['Reconsidera', 'Mantém e encaminha à autoridade superior'], { obrigatoria: true, se: quando('Espécie', 'Recurso') }),
                A.escolha('Pedido de reconsideração', ['Provido', 'Provido em parte', 'Não provido'], { obrigatoria: true, destino: 'autos', partes: true, se: quando('Espécie', 'Pedido de reconsideração da inidoneidade') }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão sobre o pedido', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimada da decisão sobre o seu pedido.' }, { se: quando('Reconsiderar a decisão?', 'Reconsidera') }),
                A.comunicar('Intimar da decisão sobre a reconsideração', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimada da decisão sobre o pedido de reconsideração.' }, { se: quando('Espécie', 'Pedido de reconsideração da inidoneidade') }),
            ],
            saidas: { 'Instância recursal': quando('Reconsiderar a decisão?', 'Mantém e encaminha à autoridade superior') },
        },
        {
            nome: 'Instância recursal', unidade: 'Instância recursal', prazo_dias: 20, prazo_auto: true,
            orientacao: 'A autoridade superior decide o recurso em 20 dias úteis do recebimento (art. 166, parágrafo único).',
            acoes: [
                A.escolha('Julgamento do recurso', ['Provido', 'Provido em parte', 'Não provido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do recurso', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão do recurso', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimada da decisão do recurso.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Execução e registro', unidade: 'Setor de contratos', prazo_dias: 15, prazo_auto: true,
            orientacao: 'Informe a sanção ao CEIS e ao CNEP em até 15 dias úteis da aplicação (art. 161). A multa se cobra por desconto dos pagamentos devidos, pela garantia ou judicialmente (art. 156, § 8º). A reabilitação é pedida depois, em processo próprio, com reparação integral, multa paga e o prazo do art. 163.',
            acoes: [
                A.simNao('Há sanção definitiva a executar?', { obrigatoria: true }),
                A.fazer('Informar a sanção ao CEIS e ao CNEP', { se: quando('Há sanção definitiva a executar?', 'sim') }),
                A.escolha('Cobrança da multa', ['Não há multa', 'Desconto dos pagamentos', 'Execução da garantia', 'Cobrança judicial'], { se: quando('Há sanção definitiva a executar?', 'sim') }),
                A.fazer('Anotar a sanção no histórico do contrato e do fornecedor', { se: quando('Há sanção definitiva a executar?', 'sim') }),
            ],
        },
        ARQUIVO,
    ]);
}

/** 16. Fiscalização com auto de infração e defesa (Decreto 6.514/2008; Decreto 2.181/1997; Lei 6.437/1977). */
export function autoDeInfracao() {
    return montar({
        id: 'auto-de-infracao', nome: 'Fiscalização com auto de infração e defesa', area: 'sancionador', porte: 'medio', referencia: 'Poder de polícia',
        descricao: 'Modelo para qualquer órgão de fiscalização: um agente constata a infração, lavra o auto, o autuado se defende, uma autoridade distinta do autuante julga e cabe recurso. Serve de base para vigilância sanitária, defesa do consumidor, meio ambiente, posturas municipais e agências reguladoras, trocando só os prazos; vem configurado com os do Decreto 6.514/2008 (ambiental), e a orientação de cada fase traz os do consumidor e do sanitário. O contraditório está na defesa, nas alegações finais, na manifestação prévia antes de agravar a multa e no recurso, com reconsideração antes de subir. Termina por arquivamento, auto insubsistente, solução consensual (pagamento com desconto, parcelamento ou conversão) ou sanção definitiva com cobrança e inscrição em dívida ativa.',
        quando: 'Constatação de infração administrativa em ação fiscal, reclamação ou denúncia, quando a norma do setor prevê auto de infração com defesa e recurso.',
        base: 'Decreto 6.514/2008, arts. 21, 96, 99, 113 a 130; Decreto 2.181/1997 (redação do Decreto 10.887/2021), arts. 33 a 55; Lei 6.437/1977, arts. 12 a 37; Lei 9.873/1999, arts. 1º e 2º; Lei 9.784/1999, art. 66, § 2º.',
        tipo: { polos: ['requerido', 'terceiro'], nomes_polos: { requerido: 'Autuado', terceiro: 'Reclamante' } },
    }, [
        {
            nome: 'Ação fiscal', unidade: 'Fiscalização', vai: ['Lavratura do auto de infração', 'Averiguação preliminar', 'Arquivamento'],
            orientacao: 'Registre a origem (fiscalização de rotina, reclamação ou denúncia) e o que foi constatado. Indícios suficientes: lavre o auto. Indícios insuficientes: averiguação preliminar (Decreto 2.181, art. 33-A). Em caso de baixa lesão, a autoridade pode deixar de instaurar, por ato motivado (art. 33, §§ 4º e 5º).',
            acoes: [
                A.formulario('Dados da ação fiscal', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', opcoes: ['Fiscalização de rotina', 'Reclamação ou denúncia', 'Operação'], obrigatorio: true },
                    { id: 'fiscalizado', rotulo: 'Fiscalizado (nome e CPF ou CNPJ)', tipo: 'texto', obrigatorio: true },
                    { id: 'local', rotulo: 'Local', tipo: 'texto', obrigatorio: true },
                    { id: 'data', rotulo: 'Data da constatação', tipo: 'data', obrigatorio: true },
                    { id: 'fato', rotulo: 'O que foi constatado', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Ordem de fiscalização, relatório de vistoria ou termo de reclamação', 'Relatório', { forma: 'qualquer' }),
                A.escolha('Indícios de infração', ['Suficientes, lavrar o auto', 'Insuficientes, averiguar', 'Não há infração'], { obrigatoria: true }),
            ],
            saidas: {
                'Lavratura do auto de infração': quando('Indícios de infração', 'Suficientes, lavrar o auto'),
                'Averiguação preliminar': quando('Indícios de infração', 'Insuficientes, averiguar'),
                'Arquivamento': quando('Indícios de infração', 'Não há infração'),
            },
        },
        {
            nome: 'Averiguação preliminar', unidade: 'Fiscalização', vai: ['Lavratura do auto de infração', 'Arquivamento'],
            orientacao: 'Apuração de natureza inquisitorial, para reunir indícios antes de autuar (Decreto 2.181, art. 33-A). No rito do consumidor, o arquivamento pode ser avocado pelo superior em 20 dias (art. 33-B).',
            acoes: [
                A.documento('Juntar as diligências da averiguação', '', { forma: 'qualquer' }),
                A.escolha('Resultado da averiguação', ['Lavrar o auto de infração', 'Arquivar'], { obrigatoria: true }),
            ],
            saidas: { 'Lavratura do auto de infração': quando('Resultado da averiguação', 'Lavrar o auto de infração'), 'Arquivamento': quando('Resultado da averiguação', 'Arquivar') },
        },
        {
            nome: 'Lavratura do auto de infração', unidade: 'Fiscalização',
            orientacao: 'O auto traz a qualificação do autuado, local, data e hora, descrição do fato, dispositivo infringido, penalidade aplicável e prazo de defesa (Lei 6.437, art. 13; Decreto 2.181, art. 35). Havendo risco imediato, lavre o termo da medida cautelar (apreensão, interdição, embargo). Se o autuado se recusar a assinar, o agente certifica, na presença de duas testemunhas (Decreto 6.514, art. 96, § 1º; Lei 6.437, art. 17, § 1º).',
            acoes: [
                A.documento('Auto de infração', 'Auto de infração', { forma: 'qualquer' }),
                A.formulario('Dados do auto', [
                    { id: 'numero', rotulo: 'Número do auto', tipo: 'texto', obrigatorio: true },
                    { id: 'dispositivo', rotulo: 'Dispositivo infringido', tipo: 'texto', obrigatorio: true },
                    { id: 'penalidade', rotulo: 'Penalidade aplicável', tipo: 'texto', obrigatorio: true },
                    { id: 'multa', rotulo: 'Valor da multa indicada (R$)', tipo: 'numero' },
                    { id: 'cautelar', rotulo: 'Medida cautelar', tipo: 'lista', opcoes: ['Nenhuma', 'Apreensão', 'Interdição', 'Embargo', 'Suspensão de atividade'], obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.simNao('Houve medida cautelar?', { obrigatoria: true }),
                A.documento('Termo de apreensão, interdição ou embargo', 'Termo', { forma: 'qualquer', se: quando('Houve medida cautelar?', 'sim') }),
                A.simNao('O autuado se recusou a assinar o auto?', { obrigatoria: true }),
                A.fazer('Certificar a recusa com duas testemunhas', { se: quando('O autuado se recusou a assinar o auto?', 'sim') }),
            ],
        },
        {
            nome: 'Ciência e defesa', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Defesa do auto de infração', vai: ['Instrução', 'Solução consensual', 'Julgamento'],
            orientacao: 'Dê ciência do auto ao autuado (pessoal, postal, eletrônica ou por edital), o que abre o prazo de defesa: 20 dias no ambiental (Decreto 6.514, art. 113) e no consumidor (Decreto 2.181, art. 42), 15 dias no sanitário (Lei 6.437, art. 22). No ambiental, o autuado pode, em vez de se defender, aderir a pagamento com desconto, parcelamento ou conversão da multa (art. 96, § 5º, II). Sem defesa, o processo segue para julgamento. O comparecimento espontâneo supre a falta de notificação.',
            acoes: [
                A.comunicar('Notificar o autuado', { especie: 'notificacao', polos: ['requerido'], dias: 20, contagem: corridos, texto: 'Fica notificado do auto de infração. Apresente defesa em 20 dias, com fatos, fundamentos e as provas que pretende produzir, ou manifeste adesão a pagamento com desconto, parcelamento ou conversão da multa.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa', 'Notificar o autuado', { obrigatoria: true }),
                A.escolha('Resposta do autuado', ['Defesa', 'Adesão a solução consensual', 'Sem manifestação'], { obrigatoria: true }),
            ],
            saidas: {
                'Instrução': quando('Resposta do autuado', 'Defesa'),
                'Solução consensual': quando('Resposta do autuado', 'Adesão a solução consensual'),
                'Julgamento': quando('Resposta do autuado', 'Sem manifestação'),
            },
        },
        {
            nome: 'Solução consensual', unidade: 'Secretaria', vai: ['Arquivamento', 'Julgamento'],
            orientacao: 'Formalize o pagamento com desconto, o parcelamento ou a conversão da multa em serviços (Decreto 6.514, art. 96, § 5º, II) e acompanhe o cumprimento. Cumprida, o processo se encerra; descumprida, retoma para julgamento.',
            acoes: [
                A.documento('Termo de adesão ou de compromisso', 'Termo', { forma: 'qualquer' }),
                A.escolha('Cumprimento da solução consensual', ['Cumprida', 'Descumprida'], { obrigatoria: true }),
            ],
            saidas: { 'Arquivamento': quando('Cumprimento da solução consensual', 'Cumprida'), 'Julgamento': quando('Cumprimento da solução consensual', 'Descumprida') },
        },
        {
            nome: 'Instrução', unidade: 'Secretaria',
            orientacao: 'Ouça o agente autuante sobre a defesa: 10 dias no sanitário (Lei 6.437, art. 22, § 1º), a pedido da autoridade no ambiental (Decreto 6.514, art. 119). Indefira por decisão fundamentada as provas ilícitas, impertinentes, desnecessárias ou protelatórias (art. 120; Decreto 2.181, art. 45, § 1º). Oitivas preferencialmente por videoconferência; no consumidor, até três testemunhas, levadas pelo autuado. Vício sanável do auto se convalida por despacho saneador; insanável leva à nulidade no julgamento (Decreto 6.514, art. 99).',
            acoes: [
                A.documento('Manifestação do agente autuante sobre a defesa', 'Manifestação', { forma: 'qualquer', nivel: 'recomendado' }),
                A.escolha('Provas requeridas pelo autuado', ['Deferidas', 'Deferidas em parte', 'Indeferidas', 'Não houve pedido'], { obrigatoria: true }),
                A.documento('Decisão fundamentada sobre as provas', 'Despacho', { forma: 'redigir', se: quando('Provas requeridas pelo autuado', 'Deferidas em parte', 'Indeferidas') }),
                A.simNao('Haverá oitiva, perícia ou análise laboratorial?', { obrigatoria: true }),
                A.audiencia('Designar a oitiva ou a perícia', 'oitiva', { se: quando('Haverá oitiva, perícia ou análise laboratorial?', 'sim') }),
                A.comunicar('Intimar para a oitiva ou a perícia', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Compareça, com suas testemunhas se houver, em {audiencia}.' }, { se: quando('Haverá oitiva, perícia ou análise laboratorial?', 'sim') }),
                A.documento('Juntar laudos, informações e termos de oitiva', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.simNao('O auto tem vício sanável?', { obrigatoria: true }),
                A.documento('Despacho saneador', 'Despacho', { forma: 'redigir', se: quando('O auto tem vício sanável?', 'sim') }),
            ],
        },
        {
            nome: 'Alegações finais', unidade: 'Secretaria', avanco: 'auto', vai: ['Parecer', 'Julgamento'],
            orientacao: 'No ambiental, notifique para alegações finais em 10 dias e publique a pauta de julgamento na sede e na internet (Decreto 6.514, art. 122). Nos ritos do consumidor e do sanitário não há esta fase: dispense a notificação e siga.',
            acoes: [
                A.comunicar('Notificar para alegações finais', { especie: 'notificacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Encerrada a instrução, apresente alegações finais em 10 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar as alegações finais', 'Notificar para alegações finais', { obrigatoria: true }),
                A.simNao('Enviar para parecer antes do julgamento?', { obrigatoria: true }),
            ],
            saidas: { 'Parecer': quando('Enviar para parecer antes do julgamento?', 'sim'), 'Julgamento': quando('Enviar para parecer antes do julgamento?', 'nao') },
        },
        {
            nome: 'Parecer', unidade: 'Assessoria jurídica', avanco: 'auto',
            orientacao: 'Parecer jurídico ou técnico antes do julgamento, conforme a norma do órgão.',
            acoes: [A.documento('Juntar o parecer', 'Parecer', { forma: 'redigir' })],
        },
        {
            nome: 'Julgamento', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, ao_entrar: { pendencia: 'Julgar o auto de infração, oferecida ou não a defesa.' }, vai: ['Recurso', 'Cobrança e execução'],
            orientacao: 'Julga autoridade distinta do autuante, oferecida ou não a defesa, em 30 dias no ambiental; o atraso não anula (Decreto 6.514, art. 124). A autoridade pode manter, reduzir ou aumentar a multa; se for agravar, notifica antes para manifestação em 10 dias (art. 123, parágrafo único). A medida cautelar deve ser apreciada na decisão (art. 124, § 1º). Intime abrindo o prazo de recurso: 20 dias no ambiental (art. 127), 10 no consumidor (Decreto 2.181, art. 49), 15 no sanitário (Lei 6.437, art. 30). No consumidor, auto julgado insubsistente tem recurso de ofício (art. 52).',
            acoes: [
                A.escolha('Decisão', ['Auto procedente', 'Procedente com redução da multa', 'Procedente com agravamento', 'Auto insubsistente ou nulo'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.comunicar('Notificar antes de agravar', { especie: 'notificacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'A autoridade julgadora pode agravar a penalidade. Manifeste-se em 10 dias.' }, { se: quando('Decisão', 'Procedente com agravamento') }),
                A.esperar('Aguardar a manifestação sobre o agravamento', 'Notificar antes de agravar', { se: quando('Decisão', 'Procedente com agravamento') }),
                A.simNao('Há medida cautelar a apreciar?', { obrigatoria: true, ajuda: 'Se sim, mantenha, modifique ou revogue a medida na decisão, sob pena de ineficácia (Decreto 6.514, art. 124, § 1º).' }),
                A.documento('Juntar a decisão motivada', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 20, contagem: corridos, texto: 'Fica intimado da decisão. Cabe recurso em 20 dias. Mantida a multa, o pagamento em 5 dias tem desconto de 30%.' }, { obrigatoria: true }),
                A.comunicar('Dar ciência ao reclamante', { especie: 'ciencia', polos: ['terceiro'], dias: 0, texto: 'Comunicamos a decisão do processo originado da sua reclamação.' }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar da decisão', { obrigatoria: true }),
            ],
            saidas: { 'Recurso': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Cobrança e execução': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso', unidade: 'Gabinete', prazo_dias: 5, prazo_auto: true, prazo_contagem: corridos, vai: ['Julgamento do recurso', 'Cobrança e execução'], padrao: 'Cobrança e execução',
            orientacao: 'O recurso se dirige à autoridade que decidiu, que pode reconsiderar em 5 dias (Decreto 6.514, art. 127, § 1º); se não, sobe à instância superior. Tem efeito suspensivo só quanto à multa; nos demais casos, a critério da autoridade, se houver risco de prejuízo de difícil reparação (art. 128).',
            acoes: [
                A.escolha('Admissibilidade do recurso', ['Conhecido', 'Não conhecido'], { obrigatoria: true }),
                A.escolha('Reconsiderar?', ['Reconsidera', 'Mantém e remete à instância superior'], { obrigatoria: true, se: quando('Admissibilidade do recurso', 'Conhecido') }),
                A.simNao('Conceder efeito suspensivo além da multa?', { se: quando('Reconsiderar?', 'Mantém e remete à instância superior') }),
                A.documento('Juntar a decisão de admissibilidade ou de reconsideração', 'Decisão', { forma: 'redigir' }),
            ],
            saidas: { 'Julgamento do recurso': quando('Reconsiderar?', 'Mantém e remete à instância superior') },
        },
        {
            nome: 'Julgamento do recurso', unidade: 'Instância recursal',
            orientacao: 'Instância superior, singular ou colegiada. No sanitário, mantida a condenação, cabe novo recurso à autoridade superior em 20 dias (Lei 6.437, art. 30).',
            acoes: [
                A.escolha('Resultado do recurso', ['Provido', 'Provido em parte', 'Não provido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do recurso', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão do recurso', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado da decisão do recurso.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Cobrança e execução', unidade: 'Secretaria',
            orientacao: 'Notifique para pagar: 5 dias com desconto de 30% no ambiental (Decreto 6.514, art. 126), 10 dias após a decisão definitiva no consumidor (Decreto 2.181, art. 53), 30 dias no sanitário (Lei 6.437, art. 33). Não paga, encaminhe para inscrição em dívida ativa. Cumpra as obrigações de fazer e registre a sanção para fins de reincidência. Prescrição de 5 anos, e intercorrente se o processo ficar parado mais de 3 anos (Lei 9.873, arts. 1º e 2º).',
            acoes: [
                A.simNao('Há multa ou obrigação a cumprir?', { obrigatoria: true }),
                A.comunicar('Notificar para pagar a multa', { especie: 'notificacao', polos: ['requerido'], dias: 5, contagem: corridos, texto: 'A penalidade é definitiva. Pague a multa no prazo indicado.' }, { se: quando('Há multa ou obrigação a cumprir?', 'sim') }),
                A.esperar('Aguardar o pagamento', 'Notificar para pagar a multa', { se: quando('Há multa ou obrigação a cumprir?', 'sim') }),
                A.fazer('Encaminhar para inscrição em dívida ativa', { se: quando('Aguardar o pagamento', 'Sem manifestação', 'Parcial') }),
                A.fazer('Registrar a sanção para fins de reincidência', { se: quando('Há multa ou obrigação a cumprir?', 'sim') }),
            ],
        },
        ARQUIVO,
    ]);
}

/** 18. Processo administrativo fiscal: lançamento com impugnação (Decreto 70.235/1972). */
export function processoFiscal() {
    return montar({
        id: 'processo-fiscal', nome: 'Processo administrativo fiscal (lançamento e impugnação)', area: 'sancionador', porte: 'longo', referencia: 'Decreto 70.235',
        descricao: 'Discute a exigência de tributo e multa lançados pelo fisco. Começa pelo termo de início da fiscalização, que exclui a espontaneidade, e segue com o auto de infração ou notificação de lançamento, que já intima o sujeito passivo a pagar ou impugnar em 30 dias. A impugnação abre a fase litigiosa, com diligências e perícias, julgamento em primeira instância e recurso voluntário em 30 dias, com efeito suspensivo, a um colegiado de segunda instância; há recurso de ofício quando a Fazenda perde acima da alçada. Sem pagamento nem impugnação, declara-se a revelia e abre-se a cobrança amigável; o processo termina com a decisão definitiva e o pagamento, o parcelamento ou a inscrição em dívida ativa.',
        quando: 'Lançamento de ofício de tributo ou multa com contencioso administrativo em duas instâncias. Estados e municípios ajustam os prazos e órgãos à sua lei.',
        base: 'Decreto 70.235/1972, arts. 5º, 7º, 10, 14 a 16, 21, 23, 25, 33, 34 e 42 (texto original; órgãos julgadores atuais não conferidos).',
        tipo: { polos: ['requerido'], nomes_polos: { requerido: 'Sujeito passivo' } },
    }, [
        {
            nome: 'Início do procedimento fiscal', unidade: 'Fiscalização', vai: ['Lançamento', 'Arquivamento'],
            orientacao: 'O procedimento começa pelo primeiro ato de ofício escrito, com ciência do sujeito passivo, ou pela apreensão de mercadorias, documentos ou livros (art. 7º). O início exclui a espontaneidade (art. 7º, § 1º). Os prazos são contínuos, excluído o dia do início e incluído o do vencimento, e só começam ou vencem em dia de expediente (art. 5º).',
            acoes: [
                A.formulario('Dados da fiscalização', [
                    { id: 'sujeito', rotulo: 'Sujeito passivo (nome e CPF ou CNPJ)', tipo: 'texto', obrigatorio: true },
                    { id: 'tributo', rotulo: 'Tributo fiscalizado', tipo: 'texto', obrigatorio: true },
                    { id: 'periodo', rotulo: 'Período de apuração', tipo: 'texto', obrigatorio: true },
                    { id: 'inicio', rotulo: 'Data da ciência do início', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Termo de início de fiscalização', 'Termo', { forma: 'qualquer' }),
                A.comunicar('Dar ciência do início da fiscalização', { especie: 'ciencia', polos: ['requerido'], dias: 0, texto: 'Fica cientificado do início do procedimento fiscal.' }, { obrigatoria: true }),
                A.documento('Juntar intimações, respostas e documentos da fiscalização', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.escolha('Resultado da fiscalização', ['Lançar o crédito', 'Encerrar sem lançamento'], { obrigatoria: true }),
            ],
            saidas: { 'Lançamento': quando('Resultado da fiscalização', 'Lançar o crédito'), 'Arquivamento': quando('Resultado da fiscalização', 'Encerrar sem lançamento') },
        },
        {
            nome: 'Lançamento', unidade: 'Fiscalização',
            orientacao: 'O auto de infração ou a notificação de lançamento traz a qualificação, local, data e hora, descrição do fato, disposição infringida e penalidade, a exigência e a intimação para cumprir ou impugnar em 30 dias, e a assinatura do autuante (art. 10).',
            acoes: [
                A.documento('Auto de infração ou notificação de lançamento', 'Auto de infração', { forma: 'qualquer' }),
                A.formulario('Crédito lançado', [
                    { id: 'dispositivo', rotulo: 'Disposição legal infringida', tipo: 'texto', obrigatorio: true },
                    { id: 'principal', rotulo: 'Tributo (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'multa', rotulo: 'Multa (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'juros', rotulo: 'Juros (R$)', tipo: 'numero' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
            ],
        },
        {
            nome: 'Intimação para pagar ou impugnar', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Pagamento ou impugnação', vai: ['Preparo da impugnação', 'Revelia e cobrança amigável', 'Cobrança e encerramento'],
            orientacao: 'Intime o sujeito passivo pessoalmente, por via postal ou por outro meio previsto (art. 23), para pagar ou impugnar em 30 dias (art. 15). A impugnação instaura a fase litigiosa (art. 14) e deve indicar a autoridade julgadora, a qualificação, os motivos de fato e de direito e as diligências pretendidas (art. 16). O sujeito passivo tem vista do processo no prazo.',
            acoes: [
                A.comunicar('Intimar para pagar ou impugnar', { especie: 'intimacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Fica intimado do lançamento. Pague ou apresente impugnação em 30 dias, com os motivos de fato e de direito e as diligências ou perícias que pretende.' }, { obrigatoria: true }),
                A.esperar('Aguardar o pagamento ou a impugnação', 'Intimar para pagar ou impugnar', { obrigatoria: true }),
                A.escolha('Conduta do sujeito passivo', ['Impugnou', 'Pagou ou parcelou', 'Não pagou nem impugnou'], { obrigatoria: true }),
            ],
            saidas: {
                'Preparo da impugnação': quando('Conduta do sujeito passivo', 'Impugnou'),
                'Cobrança e encerramento': quando('Conduta do sujeito passivo', 'Pagou ou parcelou'),
                'Revelia e cobrança amigável': quando('Conduta do sujeito passivo', 'Não pagou nem impugnou'),
            },
        },
        {
            nome: 'Revelia e cobrança amigável', unidade: 'Secretaria', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, avanco: 'auto', vai: ['Cobrança e encerramento'], nome_publico: 'Cobrança amigável',
            orientacao: 'Sem pagamento nem impugnação no prazo, declare a revelia; o processo fica 30 dias em cobrança amigável (art. 21).',
            acoes: [
                A.documento('Termo de revelia', 'Termo', { forma: 'redigir' }),
                A.comunicar('Notificar para a cobrança amigável', { especie: 'notificacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Não houve pagamento nem impugnação. Pague o crédito em 30 dias, antes do encaminhamento para cobrança.' }, { obrigatoria: true }),
                A.esperar('Aguardar o pagamento amigável', 'Notificar para a cobrança amigável', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Preparo da impugnação', unidade: 'Secretaria',
            orientacao: 'O órgão preparador junta a impugnação e as provas, confere a tempestividade e dá vista dos autos, se pedida. Impugnação fora do prazo não instaura a fase litigiosa; registre e encaminhe ao julgador, que decide sobre ela.',
            acoes: [
                A.documento('Juntar a impugnação e os documentos', 'Impugnação', { forma: 'juntar' }),
                A.simNao('A impugnação é tempestiva?', { obrigatoria: true }),
                A.fazer('Conceder vista dos autos, se pedida'),
            ],
        },
        {
            nome: 'Diligências e perícias', unidade: 'Fiscalização', espera: true, avanco: 'auto', nome_publico: 'Diligência ou perícia',
            orientacao: 'Cumpra a diligência ou perícia determinada pelo julgador e junte o resultado. Com a juntada, o processo volta à instância que a pediu.',
            acoes: [
                A.documento('Juntar o termo de diligência ou o laudo pericial', 'Laudo', { forma: 'qualquer' }),
            ],
        },
        {
            nome: 'Julgamento em primeira instância', unidade: 'Junta de julgamento', ao_entrar: { pendencia: 'Julgar a impugnação do lançamento.' }, vai: ['Diligências e perícias', 'Intimação da decisão de primeira instância'],
            orientacao: 'Julga a autoridade ou colegiado fazendário de primeira instância (art. 25, I). Diligência ou perícia necessária vai à fiscalização e volta. A decisão que exonera o sujeito passivo acima do valor de alçada tem recurso de ofício (art. 34).',
            acoes: [
                A.simNao('Há diligência ou perícia a fazer antes de julgar?', { obrigatoria: true }),
                A.escolha('Decisão de primeira instância', ['Procedente', 'Procedente em parte', 'Improcedente'], { obrigatoria: true, destino: 'autos', partes: true, se: quando('Há diligência ou perícia a fazer antes de julgar?', 'nao') }),
                A.simNao('Cabe recurso de ofício?', { obrigatoria: true, se: quando('Decisão de primeira instância', 'Procedente em parte', 'Improcedente'), ajuda: 'Sim quando a decisão exonera o sujeito passivo de valor acima da alçada (art. 34).' }),
                A.documento('Juntar a decisão de primeira instância', 'Decisão', { forma: 'redigir', se: quando('Há diligência ou perícia a fazer antes de julgar?', 'nao') }),
            ],
            saidas: { 'Diligências e perícias': quando('Há diligência ou perícia a fazer antes de julgar?', 'sim'), 'Intimação da decisão de primeira instância': quando('Há diligência ou perícia a fazer antes de julgar?', 'nao') },
        },
        {
            nome: 'Intimação da decisão de primeira instância', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Recurso voluntário', vai: ['Julgamento em segunda instância', 'Cobrança e encerramento'],
            orientacao: 'Intime da decisão; cabe recurso voluntário em 30 dias da ciência, com efeito suspensivo (art. 33). Sobe à segunda instância se houver recurso voluntário ou recurso de ofício (art. 34); se não, a decisão é definitiva (art. 42).',
            acoes: [
                A.comunicar('Intimar da decisão de primeira instância', { especie: 'intimacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Fica intimado da decisão de primeira instância. Cabe recurso voluntário em 30 dias, com efeito suspensivo.' }, { obrigatoria: true }),
                A.esperar('Aguardar o recurso voluntário', 'Intimar da decisão de primeira instância', { obrigatoria: true }),
                A.escolha('Encaminhamento', ['Subir à segunda instância', 'Decisão definitiva'], { obrigatoria: true, ajuda: 'Sobe se houve recurso voluntário ou se cabe recurso de ofício (art. 34).' }),
            ],
            saidas: { 'Julgamento em segunda instância': quando('Encaminhamento', 'Subir à segunda instância'), 'Cobrança e encerramento': quando('Encaminhamento', 'Decisão definitiva') },
        },
        {
            nome: 'Julgamento em segunda instância', unidade: 'Instância recursal', ao_entrar: { pendencia: 'Distribuir e pautar o recurso para julgamento colegiado.' }, vai: ['Diligências e perícias', 'Cobrança e encerramento'],
            orientacao: 'Julgamento por colegiado de segunda instância (art. 25, II): distribua a um relator, inclua em pauta e intime o sujeito passivo da sessão. O colegiado pode converter o julgamento em diligência. Recurso especial a instância superior depende da norma vigente (não conferido).',
            acoes: [
                A.fazer('Distribuir a um relator', { obrigatoria: true }),
                A.simNao('Converter o julgamento em diligência?', { obrigatoria: true }),
                A.audiencia('Incluir em pauta de sessão de julgamento', 'sessao', { se: quando('Converter o julgamento em diligência?', 'nao') }),
                A.comunicar('Intimar da sessão de julgamento', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'O recurso será julgado na sessão de {audiencia}.' }, { se: quando('Converter o julgamento em diligência?', 'nao') }),
                A.escolha('Resultado do recurso', ['Provido', 'Provido em parte', 'Não provido'], { obrigatoria: true, destino: 'autos', partes: true, se: quando('Converter o julgamento em diligência?', 'nao') }),
                A.documento('Juntar o acórdão', 'Acórdão', { forma: 'redigir', se: quando('Converter o julgamento em diligência?', 'nao') }),
                A.comunicar('Intimar do acórdão', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado do acórdão de segunda instância.' }, { se: quando('Converter o julgamento em diligência?', 'nao') }),
            ],
            saidas: { 'Diligências e perícias': quando('Converter o julgamento em diligência?', 'sim'), 'Cobrança e encerramento': quando('Converter o julgamento em diligência?', 'nao') },
        },
        {
            nome: 'Cobrança e encerramento', unidade: 'Secretaria',
            orientacao: 'Com a decisão definitiva (art. 42), extinga o crédito pago, acompanhe o parcelamento ou cancele o que foi exonerado. Crédito devido e não pago vai para inscrição em dívida ativa. O prazo da intimação para pagar segue a norma do ente (não conferido).',
            acoes: [
                A.escolha('Situação do crédito', ['Extinto pelo pagamento', 'Parcelado', 'Exonerado por decisão definitiva', 'Devido e não pago'], { obrigatoria: true, destino: 'autos' }),
                A.comunicar('Intimar para pagar o crédito definitivo', { especie: 'intimacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'A exigência é definitiva na esfera administrativa. Pague o crédito no prazo, sob pena de inscrição em dívida ativa.' }, { se: quando('Situação do crédito', 'Devido e não pago') }),
                A.esperar('Aguardar o pagamento', 'Intimar para pagar o crédito definitivo', { se: quando('Situação do crédito', 'Devido e não pago') }),
                A.fazer('Encaminhar para inscrição em dívida ativa', { se: quando('Aguardar o pagamento', 'Sem manifestação', 'Parcial') }),
                A.fazer('Registrar o parcelamento e acompanhar as parcelas', { se: quando('Situação do crédito', 'Parcelado') }),
            ],
        },
        ARQUIVO,
    ]);
}

/** 21. Multa de trânsito: autuação, defesa prévia e dois recursos (Lei 9.503/1997, arts. 280 a 290). */
export function multaTransito() {
    return montar({
        id: 'multa-transito', nome: 'Multa de trânsito (defesa prévia e recursos)', area: 'sancionador', porte: 'medio', referencia: 'CTB',
        descricao: 'Sancionador de alto volume e baixo valor, com prazo decadencial para o próprio órgão: se a notificação da autuação não for expedida em 30 dias, o auto é arquivado. Depois da análise de consistência do auto, o proprietário é notificado e pode apresentar defesa prévia e indicar o condutor. O contraditório tem três momentos: a defesa prévia, o recurso à junta (JARI), com efeito suspensivo, e o recurso à segunda instância, cada um com prazo não inferior a 30 dias. Termina com o cancelamento do auto ou com a sanção definitiva, o registro no prontuário e a cobrança da multa.',
        quando: 'Auto de infração de trânsito lavrado por agente ou equipamento. Útil também como base para órgãos que emitem muitos autos padronizados.',
        base: 'Lei 9.503/1997 (Código de Trânsito Brasileiro), arts. 280 a 290. Resoluções do Contran sobre o procedimento não conferidas.',
        tipo: { polos: ['requerido', 'interessado'], nomes_polos: { requerido: 'Proprietário do veículo', interessado: 'Condutor' } },
    }, [
        {
            nome: 'Auto de infração', unidade: 'Fiscalização',
            orientacao: 'O auto traz a tipificação, local, data e hora, identificação do veículo, do condutor quando possível, e do agente ou do equipamento (art. 280).',
            acoes: [
                A.formulario('Dados da autuação', [
                    { id: 'placa', rotulo: 'Placa do veículo', tipo: 'texto', obrigatorio: true },
                    { id: 'enquadramento', rotulo: 'Tipificação da infração', tipo: 'texto', obrigatorio: true },
                    { id: 'local', rotulo: 'Local', tipo: 'texto', obrigatorio: true },
                    { id: 'data', rotulo: 'Data da infração', tipo: 'data', obrigatorio: true },
                    { id: 'condutor', rotulo: 'Condutor identificado no ato?', tipo: 'sim_nao', obrigatorio: true },
                    { id: 'origem', rotulo: 'Constatação', tipo: 'lista', opcoes: ['Agente', 'Equipamento'], obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Auto de infração', 'Auto de infração', { forma: 'qualquer' }),
            ],
        },
        {
            nome: 'Análise de consistência', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Notificação da autuação', 'Arquivamento'],
            orientacao: 'A autoridade de trânsito julga a consistência do auto (art. 281). Auto inconsistente ou irregular é arquivado (art. 281, parágrafo único, I). O prazo desta fase lembra os 30 dias, contados da infração, para expedir a notificação (inciso II).',
            acoes: [
                A.escolha('Auto consistente e regular?', ['Consistente', 'Inconsistente ou irregular'], { obrigatoria: true }),
                A.documento('Despacho de arquivamento', 'Despacho', { forma: 'redigir', se: quando('Auto consistente e regular?', 'Inconsistente ou irregular') }),
            ],
            saidas: { 'Notificação da autuação': quando('Auto consistente e regular?', 'Consistente'), 'Arquivamento': quando('Auto consistente e regular?', 'Inconsistente ou irregular') },
        },
        {
            nome: 'Notificação da autuação', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Defesa prévia', vai: ['Julgamento da defesa prévia', 'Arquivamento'],
            orientacao: 'Expeça a notificação da autuação em até 30 dias da infração, sob pena de arquivamento (art. 281, parágrafo único, II). A defesa prévia tem prazo não inferior a 30 dias da expedição (art. 281-A). O proprietário pode indicar o condutor. Quem reconhece a infração e renuncia à defesa pelo sistema eletrônico paga 60% do valor (art. 284, § 1º).',
            acoes: [
                A.simNao('Ainda está dentro dos 30 dias para expedir a notificação?', { obrigatoria: true, ajuda: 'Se não, o auto é arquivado (art. 281, parágrafo único, II).' }),
                A.comunicar('Notificar a autuação', { especie: 'notificacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Fica notificado da autuação. Apresente defesa prévia em 30 dias e, se não era o condutor, indique quem conduzia.' }, { se: quando('Ainda está dentro dos 30 dias para expedir a notificação?', 'sim') }),
                A.esperar('Aguardar a defesa prévia', 'Notificar a autuação', { se: quando('Ainda está dentro dos 30 dias para expedir a notificação?', 'sim') }),
            ],
            saidas: { 'Julgamento da defesa prévia': quando('Ainda está dentro dos 30 dias para expedir a notificação?', 'sim'), 'Arquivamento': quando('Ainda está dentro dos 30 dias para expedir a notificação?', 'nao') },
        },
        {
            nome: 'Julgamento da defesa prévia', unidade: 'Gabinete', vai: ['Notificação da penalidade', 'Arquivamento'],
            orientacao: 'A autoridade julga a defesa prévia e, rejeitada ou não apresentada, aplica a penalidade (art. 282).',
            acoes: [
                A.escolha('Defesa prévia', ['Acolhida, arquivar o auto', 'Rejeitada ou não apresentada, aplicar a penalidade'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
            ],
            saidas: { 'Notificação da penalidade': quando('Defesa prévia', 'Rejeitada ou não apresentada, aplicar a penalidade'), 'Arquivamento': quando('Defesa prévia', 'Acolhida, arquivar o auto') },
        },
        {
            nome: 'Notificação da penalidade', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Recurso à junta', vai: ['Recurso à junta', 'Encerramento e cobrança'],
            orientacao: 'Notifique a penalidade por via postal ou eletrônica; a notificação devolvida por endereço desatualizado é válida (art. 282, § 1º). Informe o prazo de recurso, não inferior a 30 dias (art. 282, § 4º). O pagamento até o vencimento é por 80% do valor (art. 284).',
            acoes: [
                A.comunicar('Notificar a penalidade', { especie: 'notificacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Fica notificado da penalidade. Cabe recurso à Junta Administrativa de Recursos de Infrações em 30 dias, com efeito suspensivo. O pagamento até o vencimento é feito por 80% do valor.' }, { obrigatoria: true }),
                A.esperar('Aguardar o recurso à junta', 'Notificar a penalidade', { obrigatoria: true }),
            ],
            saidas: { 'Recurso à junta': quando('Aguardar o recurso à junta', 'Apresentada', 'Parcial'), 'Encerramento e cobrança': quando('Aguardar o recurso à junta', 'Sem manifestação') },
        },
        {
            nome: 'Recurso à junta', unidade: 'Junta de julgamento', prazo_dias: 730, prazo_auto: true, prazo_contagem: corridos, vai: ['Recurso à segunda instância', 'Encerramento e cobrança'],
            orientacao: 'O recurso é interposto perante a autoridade que impôs a penalidade, que o remete à junta em 10 dias; tem efeito suspensivo e é julgado em até 24 meses (art. 285, caput, §§ 2º e 6º). Recurso intempestivo ou de parte ilegítima não suspende (art. 285, § 1º). Não se exige pagamento prévio (art. 286). Da decisão da junta cabe recurso em 30 dias (art. 288).',
            acoes: [
                A.fazer('Remeter o recurso à junta em até 10 dias', { obrigatoria: true }),
                A.simNao('Recurso tempestivo e de parte legítima?', { obrigatoria: true, ajuda: 'Se não, o recurso não tem efeito suspensivo (art. 285, § 1º).' }),
                A.julgamento('Julgamento da junta', ['Provido, cancelar o auto', 'Provido em parte', 'Não provido'], {}, { obrigatoria: true }),
                A.documento('Juntar a decisão da junta', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Notificar a decisão da junta', { especie: 'notificacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Fica notificado da decisão da junta. Cabe recurso à segunda instância em 30 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar o recurso à segunda instância', 'Notificar a decisão da junta', { obrigatoria: true }),
            ],
            saidas: { 'Recurso à segunda instância': quando('Aguardar o recurso à segunda instância', 'Apresentada', 'Parcial'), 'Encerramento e cobrança': quando('Aguardar o recurso à segunda instância', 'Sem manifestação') },
        },
        {
            nome: 'Recurso à segunda instância', unidade: 'Instância recursal', prazo_dias: 730, prazo_auto: true, prazo_contagem: corridos,
            orientacao: 'Julgamento em até 24 meses (art. 289). A decisão encerra a instância administrativa.',
            acoes: [
                A.escolha('Julgamento em segunda instância', ['Provido, cancelar o auto', 'Provido em parte', 'Não provido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão de segunda instância', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Notificar a decisão final', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Fica notificado da decisão de segunda instância, que encerra a instância administrativa.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Encerramento e cobrança', unidade: 'Secretaria',
            orientacao: 'Com a penalidade definitiva, registre no prontuário e cobre a multa não paga; com o auto cancelado, baixe os registros.',
            acoes: [
                A.escolha('Resultado final', ['Penalidade mantida', 'Auto cancelado'], { obrigatoria: true, destino: 'autos' }),
                A.fazer('Registrar a penalidade e a pontuação no prontuário', { se: quando('Resultado final', 'Penalidade mantida') }),
                A.simNao('A multa foi paga?', { se: quando('Resultado final', 'Penalidade mantida') }),
                A.fazer('Encaminhar a multa para cobrança', { se: quando('A multa foi paga?', 'nao') }),
                A.fazer('Baixar os registros do auto cancelado', { se: quando('Resultado final', 'Auto cancelado') }),
            ],
        },
        ARQUIVO,
    ]);
}

export const modelos = [parPessoaJuridica, sancaoFornecedor, autoDeInfracao, processoFiscal, multaTransito];
