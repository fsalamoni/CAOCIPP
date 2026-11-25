// Fiscalização de emendas parlamentares ao orçamento pelo Ministério Público do
// RS (ADPF 854 do STF): o procedimento administrativo de diagnóstico por
// município e o inquérito civil que nasce dele, da instauração ao arquivamento
// ou à ação. Seguem a Informação Técnico-Jurídica do CAOCIPP de 15/01/2026, a
// complementação de 13/10/2026 e o checklist de diagnóstico do MPRS. O rito é cível:
// o que tiver outra repercussão é comunicado a quem tem atribuição.
// Pesquisa e fontes: /mnt/project-files/modelos-rito/pesquisa-emendas-parlamentares.md.
// Forma de escrever: ./dsl.js.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';
const sn = (id, rotulo) => ({ id, rotulo, tipo: 'sim_nao', obrigatorio: false });
const BOTAO = 'O botão da ação abre o novo processo já ligado a este; criado, a ação se cumpre sozinha.';
const DIAGNOSTICO = 'Emendas parlamentares: diagnóstico por município (MPRS)';
const INQUERITO = 'Inquérito civil de emendas parlamentares (MPRS)';
const BASES = 'Transferegov.br (consulta por favorecido e painel Visão OSC), Portal da Transparência federal (Emendas), Portal da Transparência do RS (Emendas Parlamentares Estaduais), plataforma Inteligência CNMP e os portais da Prefeitura e da Câmara';

/** O que se requisita, em texto pronto para a comunicação (o membro ajusta antes de enviar). */
const PEDIDO_PREFEITURA = 'Informe, no prazo indicado: 1) se o orçamento municipal tem emendas de vereadores e qual a norma local; 2) a relação das emendas federais, estaduais e municipais recebidas ou executadas de 2020 até hoje, com autor, valor, objeto, modalidade e beneficiário; 3) os extratos das contas bancárias específicas; 4) os planos de trabalho e os relatórios de gestão; 5) o endereço da seção de emendas no Portal da Transparência; 6) o fluxo interno de recebimento, análise técnica, execução e prestação de contas.';
const PEDIDO_CAMARA = 'Informe, no prazo indicado: 1) se a Lei Orgânica, a lei local ou o Regimento Interno preveem emendas de vereadores ao orçamento, com cópia dos dispositivos; 2) a relação das emendas apresentadas e aprovadas de 2020 até hoje, com vereador proponente, valor, objeto, beneficiário e justificativa; 3) como é feita a análise técnica de cada emenda; 4) como a Câmara divulga as emendas e acompanha a execução pelo Executivo.';

/** Checklist do MPRS, "Quanto à Câmara Municipal" (itens 1 a 7), mais a autoria e o limite, das decisões de 2026. Sim = está conforme. */
const CAMPOS_CAMARA = [
    sn('norma', 'Há lei local e regimento que disciplinam as emendas?'),
    sn('procedimento', 'A norma traz prazos, limites por vereador, áreas e vedações?'),
    sn('observancia', 'A lei e o regimento são observados na apresentação e na votação?'),
    sn('analise', 'Cada emenda tem análise técnica (PPA, LDO e limites fiscais)?'),
    sn('publico', 'A apresentação e a votação são públicas, com participação popular?'),
    sn('plano', 'Cada emenda tem plano de trabalho e justificativa de interesse público?'),
    sn('portal', 'O portal da Câmara divulga vereador, valor, finalidade e beneficiário?'),
    sn('acompanha', 'A Câmara acompanha a execução das emendas pelo Executivo?'),
    sn('autoria', 'Só vereador em exercício indica, sem cessão ou terceirização?'),
    sn('limite', 'O limite sobre a receita e os tipos de emenda seguem o modelo federal?'),
];

/** Checklist do MPRS, "Quanto à Prefeitura Municipal": gestão e execução (itens 1 a 6, 9, 10 e 13). */
const CAMPOS_GESTAO = [
    sn('fluxo', 'Há fluxo formal para receber, registrar, controlar e executar?'),
    sn('viabilidade', 'Há análise técnica prévia de viabilidade e de compatibilidade?'),
    sn('impedimentos', 'São apontados os impedimentos técnicos (LC 210/2024, art. 10)?'),
    sn('restricoes', 'São conferidas as vedações (pessoal e dívida) e os 70% em capital?'),
    sn('sus', 'As emendas de saúde passam antes pelas instâncias do SUS?'),
    sn('plano', 'O plano de trabalho é conferido (cronograma, preços e etapas)?'),
    sn('comunica', 'O recebimento é comunicado à Câmara e ao Tribunal de Contas?'),
    sn('contabil', 'Há registro contábil próprio, com a codificação exigida?'),
    sn('capacitacao', 'Os servidores foram capacitados ou há data marcada?'),
];

/** Checklist do MPRS, itens 7, 8, 11 e 12, mais as exigências de 2026 (relatório de gestão, saúde e codificação de 2027). */
const CAMPOS_RASTRO = [
    sn('conta', 'Há conta bancária específica para cada emenda?'),
    sn('passagem', 'Estão vedados a conta de passagem e o saque em espécie?'),
    sn('portal', 'O portal mostra autor, objeto, beneficiário, valores, conta e plano?'),
    sn('tempo_real', 'Alterações e cancelamentos são divulgados em tempo real?'),
    sn('ponta', 'Dá para seguir o recurso do autor ao beneficiário final e à entrega?'),
    sn('aberto', 'O portal tem filtros, série histórica e dados em formato aberto?'),
    sn('relatorio', 'O relatório de gestão está no Transferegov.br (até 30/06)?'),
    sn('saude', 'Na saúde, há conta por indicação e declaração no InvestSUS?'),
    sn('codificacao', 'O ente se prepara para a codificação contábil de 2027?'),
];

/** Checklist do MPRS, itens 14 a 17, mais o parentesco (decisão de 15/01/2026) e a habilitação da Lei 13.019/2014. */
const CAMPOS_ENTIDADES = [
    sn('criterios', 'A escolha da entidade tem critério objetivo ou justificativa?'),
    sn('habilitacao', 'A entidade cumpre os requisitos da Lei 13.019/2014 (arts. 33 e 34)?'),
    sn('parentesco', 'Está afastado o vínculo de parentesco com parlamentar ou assessor?'),
    sn('site', 'A entidade divulga no seu site o que recebeu e como aplicou?'),
    sn('conta', 'A entidade abriu conta específica para o recurso da emenda?'),
    sn('ponta', 'Há rastreio de todas as despesas da entidade, até o fornecedor?'),
];

/** Sinais de alerta das auditorias (TCU, CGU e DENASUS) e das decisões de 2026. Sim = o sinal apareceu. */
const CAMPOS_RISCO = [
    sn('pessoal', 'Há emenda usada para pagar pessoal ou serviço da dívida?'),
    sn('generico', 'Há objeto genérico ou plano de trabalho sem metas mensuráveis?'),
    sn('fracionada', 'Há emenda fracionada em vários objetos ou municípios?'),
    sn('inacabada', 'Há obra parada, serviço interrompido ou equipamento sem uso?'),
    sn('preco', 'Há indício de sobrepreço, direcionamento ou fornecedor recorrente?'),
    sn('eventos', 'Há pendência em emenda para eventos (multa diária do STF)?'),
    sn('eleitoral', 'Houve empenho, pagamento ou uso da emenda em período eleitoral?'),
    sn('espontanea', 'Há saque em espécie ou transferência para outra conta do ente?'),
];

const FORM = { destino: 'informacao', folha_dados: true };
const LEGENDA = 'Sim quer dizer que está conforme. Deixe em branco o que não se aplica; o que ficar em Não entra nas desconformidades.';

/** As ações de conformidade, iguais no diagnóstico e no inquérito. */
const matrizCamara = (extra = {}) => A.formulario('Checklist da Câmara Municipal', CAMPOS_CAMARA, { ...FORM, ajuda: LEGENDA, ...extra });
const matrizGestao = () => A.formulario('Checklist da Prefeitura: gestão e execução', CAMPOS_GESTAO, { ...FORM, ajuda: LEGENDA });
const matrizRastro = () => A.formulario('Checklist da Prefeitura: transparência e rastreabilidade', CAMPOS_RASTRO, { ...FORM, ajuda: LEGENDA });
const matrizEntidades = (extra = {}) => A.formulario('Checklist das entidades beneficiadas', CAMPOS_ENTIDADES, { ...FORM, ajuda: LEGENDA, ...extra });
const matrizRisco = () => A.formulario('Sinais de alerta', CAMPOS_RISCO, { ...FORM, ajuda: 'Aqui é o contrário: Sim quer dizer que o sinal apareceu e pede apuração.' });

/** 1. Procedimento administrativo de diagnóstico por município (etapas 01 e 02 do checklist do MPRS). */
export function emendasDiagnostico() {
    return montar({
        id: 'emendas-diagnostico-mprs', nome: DIAGNOSTICO, area: 'ministerio_publico', porte: 'longo', referencia: 'MPRS',
        descricao: 'O primeiro passo da fiscalização das emendas parlamentares ao orçamento (também chamadas de emendas impositivas, emendas individuais, de bancada ou emendas Pix), como o STF determinou aos Ministérios Públicos na ADPF 854. É um procedimento administrativo por município: requisita informações à Prefeitura e à Câmara, cruza a resposta com as bases públicas e responde às três perguntas do panorama (há emendas municipais? o município recebeu emendas estaduais ou federais? há previsão de receber?). Havendo emendas, o checklist do MPRS é preenchido na tela, item por item, para a Câmara, para a Prefeitura e para as entidades beneficiadas, com os sinais de alerta das auditorias. No fim, o caso é arquivado, segue com recomendação e cronograma de adequação, ou abre o inquérito civil, já ligado a este processo. Pode ser reaberto a cada exercício para atualizar o panorama.',
        quando: 'Para conhecer a situação das emendas num município da comarca, antes de qualquer investigação: é o rito preliminar do inquérito civil de emendas. Use um processo por município. Se já há notícia de irregularidade determinada, vá direto ao inquérito civil de emendas; se a notícia é de desvio ou enriquecimento de pessoa certa, use o inquérito civil de improbidade administrativa (MPRS).',
        base: 'STF, ADPF 854 (decisão de 23/10/2025, item 18, e decisões de 2026) e ADIs 7688, 7695 e 7697; Constituição Federal, arts. 37, 163-A, 166 e 166-A; Lei Complementar 210/2024; Lei 12.527/2011; Lei Complementar 101/2000, arts. 48 e 48-A; Lei 13.019/2014, arts. 29, 33 e 34; Constituição do RS, art. 152; Recomendação CNMP 120/2025 (plataforma Inteligência CNMP); Resolução CNMP 174/2017, arts. 8º a 13 (procedimento administrativo); Informação Técnico-Jurídica do CAOCIPP de 15/01/2026, complementação de 13/10/2026 e Checklist de Diagnóstico do MPRS.',
        tipo: { polos: ['requerente', 'requerido', 'interessado', 'terceiro'], nomes_polos: { requerente: 'Noticiante', requerido: 'Prefeitura Municipal', interessado: 'Câmara Municipal', terceiro: 'Entidade ou órgão requisitado' } },
    }, [
        {
            nome: 'Instauração do procedimento', unidade: 'Gabinete', nome_publico: 'Instauração', vai: ['Registro e cadastro das partes'],
            orientacao: 'Instaure um procedimento administrativo para cada município da comarca, por portaria sucinta, com o objeto delimitado (Resolução CNMP 174/2017, art. 9º). O objeto alcança as emendas municipais (de vereadores), as estaduais e as federais que o município recebe: a transparência e a rastreabilidade do que entra no caixa do município são sempre da Promotoria local. O procedimento não investiga pessoa certa por ilícito determinado: se isso aparecer, abre-se a investigação própria, na fase "Abertura de investigação". Se a Promotoria já tem procedimento instaurado em 2026, atualize-o em vez de abrir outro.',
            acoes: [
                A.formulario('Dados do procedimento', [
                    { id: 'municipio', rotulo: 'Município', tipo: 'texto', obrigatorio: true },
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['De ofício, pela orientação do Centro de Apoio', 'Notícia de fato', 'Representação', 'Comunicação do Tribunal de Contas', 'Atualização de procedimento anterior'] },
                    { id: 'numero_origem', rotulo: 'Número da notícia de fato ou do procedimento anterior', tipo: 'texto', obrigatorio: false },
                    { id: 'exercicios', rotulo: 'Exercícios abrangidos (sugestão: 2020 a 2026)', tipo: 'texto', obrigatorio: true },
                    { id: 'objeto', rotulo: 'Objeto delimitado', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, ...FORM }),
                A.documento('Portaria de instauração', 'Portaria', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Registro e cadastro das partes', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Registro', vai: ['Aguardando a Prefeitura e a Câmara'],
            orientacao: 'Registre a portaria no sistema. Cadastre a Prefeitura e a Câmara como partes, cada uma no seu polo: é o que permite requisitar, receber a resposta pelo portal e contar o prazo sozinho. A entidade beneficiada e outros órgãos entram depois, se for preciso ouvi-los.',
            acoes: [
                A.fazer('Registrar e autuar a portaria', { obrigatoria: true }),
                A.fazer('Cadastrar a Prefeitura e a Câmara como partes', { obrigatoria: true, ajuda: 'Na aba Andamento, em Partes. Convide o procurador do Município e o da Câmara para o portal.' }),
            ],
        },
        {
            nome: 'Aguardando a Prefeitura e a Câmara', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Aguardando informações', vai: ['Consulta às bases públicas'],
            orientacao: 'As duas requisições saem daqui, com o texto já sugerido: ajuste o período e o que mais interessar antes de enviar. O prazo não pode ser inferior a 10 dias úteis (Lei 7.347/1985, art. 8º, § 1º); o modelo sugere 20. Com as respostas ou o fim do prazo, o processo segue sozinho. Resposta genérica ("há plano de trabalho", "há transparência") não substitui o documento: peça de novo, de forma individualizada, na fase de acompanhamento.',
            acoes: [
                A.comunicar('Requisitar informações à Prefeitura', { especie: 'notificacao', polos: ['requerido'], dias: 20, texto: PEDIDO_PREFEITURA }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta da Prefeitura', 'Requisitar informações à Prefeitura', { obrigatoria: true }),
                A.comunicar('Requisitar informações à Câmara', { especie: 'notificacao', polos: ['interessado'], dias: 20, texto: PEDIDO_CAMARA }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta da Câmara', 'Requisitar informações à Câmara', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Consulta às bases públicas', unidade: 'Secretaria', vai: ['Panorama das emendas'],
            orientacao: `Não dependa só da resposta: confira o que o município recebeu nas bases públicas, que são ${BASES}. A Recomendação CNMP 120/2025 orienta o uso da plataforma Inteligência CNMP para as emendas Pix. Certifique nos autos o que foi visto, com data e endereço, e aponte as diferenças entre a resposta e as bases: divergência de valores, de parlamentar ou de objeto é, por si, um achado.`,
            acoes: [
                A.fazer('Consultar o Transferegov.br (por favorecido e Visão OSC)', { ajuda: 'Mostra as emendas federais recebidas pelo município e pelas entidades, com plano de trabalho e relatório de gestão.' }),
                A.fazer('Consultar os Portais da Transparência federal e do RS', { ajuda: 'No federal, em Emendas; no do Estado, em Emendas Parlamentares Estaduais, filtrando pelo município.' }),
                A.fazer('Consultar a plataforma Inteligência CNMP', { ajuda: 'Reúne os dados das transferências especiais (emendas Pix) da União, por município e por parlamentar.' }),
                A.fazer('Conferir o portal da Prefeitura e o da Câmara', { ajuda: 'Há seção própria de emendas? Tem data de atualização, filtros e download em formato aberto?' }),
                A.documento('Juntar a certidão das consultas', 'Certidão', { forma: 'qualquer', nivel: 'recomendado' }),
                A.textoLongo('Diferenças entre as respostas e as bases públicas', { destino: 'informacao' }),
            ],
        },
        {
            nome: 'Panorama das emendas', unidade: 'Gabinete', vai: ['Conformidade da Câmara Municipal', 'Orientação preventiva'],
            orientacao: 'É a Etapa 01 do checklist do MPRS. Se as três respostas forem negativas, não há o que investigar: cabe, se o membro quiser, um ofício orientando a Prefeitura e a Câmara sobre o que fazer se um dia adotarem ou receberem emendas, e o procedimento é arquivado. Se alguma for positiva, passa-se à conformidade (Etapa 02). No Rio Grande do Sul, as emendas estaduais não são impositivas e as municipais dependem de previsão na Lei Orgânica; nos dois casos, valem por simetria as regras do modelo federal.',
            acoes: [
                A.simNao('Há emendas parlamentares no orçamento municipal?', { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.simNao('O município recebeu recursos de emendas estaduais ou federais?', { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.simNao('Há previsão de aporte de emendas estaduais ou federais?', { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.numero('Valor total das emendas no período (R$)', { destino: 'informacao', folha_dados: true }),
                A.escolha('Resultado do panorama', ['As três respostas são negativas: orientar e arquivar', 'Há emendas: analisar a conformidade'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Orientação preventiva': quando('Resultado do panorama', 'As três respostas são negativas: orientar e arquivar'),
                'Conformidade da Câmara Municipal': quando('Resultado do panorama', 'Há emendas: analisar a conformidade'),
            },
        },
        {
            nome: 'Orientação preventiva', unidade: 'Gabinete', vai: ['Promoção de arquivamento'],
            orientacao: 'Facultativa. O ofício resume o que a Prefeitura e a Câmara têm de observar se vierem a adotar ou a receber emendas: norma local, análise técnica, plano de trabalho, conta específica, portal com os dados completos e comprovação ao Tribunal de Contas antes de executar. Serve também para deixar certa a ciência dos gestores.',
            acoes: [
                A.documento('Ofício de orientação', 'Ofício', { forma: 'redigir', nivel: 'opcional' }),
                A.comunicar('Enviar a orientação à Prefeitura e à Câmara', { especie: 'comunicacao', polos: ['requerido', 'interessado'], dias: 0, texto: 'Segue orientação sobre as regras de transparência e rastreabilidade que valem para as emendas parlamentares, caso o município venha a adotá-las ou a recebê-las.' }),
            ],
        },
        {
            nome: 'Conformidade da Câmara Municipal', unidade: 'Gabinete', nome_publico: 'Análise do processo legislativo', vai: ['Conformidade da Prefeitura'],
            orientacao: 'Primeira frente da Etapa 02: o processo legislativo orçamentário. Só se aplica se o município tem emendas de vereadores. Sem base normativa, a Câmara deve editar a lei local e ajustar o regimento. Pontos que mais aparecem: emenda sem justificativa ou sem ligação com o PPA e a LDO; falta de análise técnica; votação sem publicidade. Dois pontos novos: só vereador em exercício indica emenda, sendo nula a cessão a terceiro, a ex-parlamentar ou a dirigente de partido (STF, 14/07 e 23/08/2026); e o limite sobre a receita corrente líquida deve seguir o modelo federal, por simetria. Sobre o limite há ação do MPRS com liminar em Pelotas (1,55% e sem emendas de bancada): é tese em discussão, a avaliar caso a caso.',
            acoes: [
                A.simNao('O município tem emendas de vereadores ao orçamento?', { obrigatoria: true, destino: 'informacao' }),
                matrizCamara({ se: quando('O município tem emendas de vereadores ao orçamento?', 'sim') }),
                A.texto('Percentual da receita reservado às emendas e dispositivo da Lei Orgânica', { destino: 'informacao', folha_dados: true, se: quando('O município tem emendas de vereadores ao orçamento?', 'sim') }),
                A.textoLongo('Desconformidades da Câmara e o que deve ser corrigido', { destino: 'informacao' }),
            ],
        },
        {
            nome: 'Conformidade da Prefeitura', unidade: 'Gabinete', nome_publico: 'Análise da execução', vai: ['Entidades e sinais de alerta'],
            orientacao: 'Segunda frente da Etapa 02: a execução, com a transparência e a rastreabilidade. Vale para emendas de qualquer origem. Transparência é divulgar por iniciativa própria, em portal de acesso livre, com dados claros e atualizados. Rastreabilidade é conseguir seguir o dinheiro da indicação do parlamentar até o beneficiário final e a entrega: uma emenda, um identificador, uma conta específica, pagamento direto ao credor, sem conta de passagem nem saque em espécie. Nas emendas Pix: plano de trabalho com objeto preciso e metas, relatório de gestão no Transferegov.br até 30/06 do ano seguinte e pelo menos 70% em despesas de capital. O atestado dos portais cabe primeiro ao Tribunal de Contas: não é preciso pedir análise técnica de cada portal.',
            acoes: [
                matrizGestao(),
                matrizRastro(),
                A.simNao('O Tribunal de Contas atestou a transparência e a rastreabilidade do ente?', { destino: 'informacao', ajuda: 'Sem essa demonstração ao Tribunal de Contas, a execução das emendas de 2026 não pode começar (STF, ADPF 854, 23/10/2025).' }),
                A.textoLongo('Desconformidades da Prefeitura e o que deve ser corrigido', { destino: 'informacao' }),
            ],
        },
        {
            nome: 'Entidades e sinais de alerta', unidade: 'Gabinete', nome_publico: 'Análise dos repasses', vai: ['Conclusão do diagnóstico'],
            orientacao: 'Terceira frente: o repasse a entidades privadas sem fins lucrativos e os sinais que as auditorias mais encontram. A Lei 13.019/2014 dispensa o chamamento público para emenda parlamentar (art. 29), mas não dispensa a justificativa da escolha, a habilitação da entidade (arts. 33 e 34) nem a prestação de contas. O STF vedou o repasse a entidade integrada por cônjuge, companheiro ou parente até o terceiro grau do parlamentar ou de seus assessores (15/01/2026). Prioridades de fiscalização: custeio da saúde, repasse a entidades e custeio de pessoal. Além de rastrear, confira a entrega: obra concluída, serviço funcionando, equipamento em uso, preço compatível.',
            acoes: [
                A.simNao('Há repasse de emenda a entidade privada sem fins lucrativos?', { obrigatoria: true, destino: 'informacao' }),
                matrizEntidades({ se: quando('Há repasse de emenda a entidade privada sem fins lucrativos?', 'sim') }),
                matrizRisco(),
                A.fazer('Informar o Conselho Municipal de Saúde e os conselhos da área', { ajuda: 'O controle social ajuda a acompanhar a execução; nas emendas de saúde, o conselho deve ser acionado.' }),
                A.textoLongo('Achados sobre entidades e sinais de alerta', { destino: 'informacao' }),
            ],
        },
        {
            nome: 'Conclusão do diagnóstico', unidade: 'Gabinete', vai: ['Promoção de arquivamento', 'Recomendação', 'Abertura de investigação'],
            ao_entrar: { pendencia: 'Concluir o diagnóstico das emendas: arquivar, recomendar a adequação ou abrir a investigação.' },
            orientacao: 'É a Etapa 03 do checklist. Tudo conforme: arquive. Falhas que os Poderes podem corrigir: recomende, dê prazo e acompanhe o cronograma; é o momento em que o Ministério Público atua como articulador, e a suspensão das emendas enquanto durar a desconformidade costuma apressar a adequação. Desconformidade que pede investigação, resistência ou indício de desvio: abra o inquérito civil. A recomendação também serve para deixar certa a ciência dos gestores sobre as decisões do STF, o que afasta depois a alegação de desconhecimento.',
            acoes: [
                A.textoLongo('Síntese do diagnóstico', { obrigatoria: true, destino: 'autos' }),
                A.escolha('Encaminhamento', ['Tudo conforme: arquivar', 'Falhas sanáveis: recomendar e acompanhar', 'Abrir investigação'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Promoção de arquivamento': quando('Encaminhamento', 'Tudo conforme: arquivar'),
                'Recomendação': quando('Encaminhamento', 'Falhas sanáveis: recomendar e acompanhar'),
                'Abertura de investigação': quando('Encaminhamento', 'Abrir investigação'),
            },
        },
        {
            nome: 'Recomendação', unidade: 'Gabinete', vai: ['Acompanhamento das providências', 'Abertura de investigação'],
            orientacao: 'Uma recomendação para o Prefeito e outra para o Presidente da Câmara, cada uma com o que lhe cabe e com prazo. Ao Executivo: seção própria no portal, dados completos por emenda, formato aberto, fluxo interno, plano de trabalho, conta específica, servidor responsável e documentação individualizada. À Câmara: norma, análise técnica, publicidade, identificação do proponente e não encaminhar emenda sem objeto, valor e justificativa. Diga que, enquanto durar a desconformidade, a execução das emendas deve ficar suspensa. Mande cópia ao Tribunal de Contas e ao Centro de Apoio. O prazo de resposta do modelo é de 30 dias; ajuste ao caso.',
            acoes: [
                A.documento('Recomendação ao Prefeito', 'Recomendação', { forma: 'redigir' }),
                A.documento('Recomendação ao Presidente da Câmara', 'Recomendação', { forma: 'redigir', nivel: 'opcional' }),
                A.comunicar('Notificar a Prefeitura e a Câmara da recomendação', { especie: 'notificacao', polos: ['requerido', 'interessado'], dias: 30, contagem: corridos, texto: 'Fica notificado da recomendação anexa. Informe, no prazo indicado, se a acata e apresente o plano de ação, com cronograma e responsáveis. Enquanto durar a desconformidade, a execução das emendas parlamentares deve permanecer suspensa.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta à recomendação', 'Notificar a Prefeitura e a Câmara da recomendação', { obrigatoria: true }),
                A.fazer('Enviar cópia ao Tribunal de Contas do Estado e ao Centro de Apoio'),
                A.escolha('Resposta à recomendação', ['Acatada, com plano de ação', 'Acatada em parte', 'Não acatada ou sem resposta'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Acompanhamento das providências': quando('Resposta à recomendação', 'Acatada, com plano de ação', 'Acatada em parte'),
                'Abertura de investigação': quando('Resposta à recomendação', 'Não acatada ou sem resposta'),
            },
        },
        {
            nome: 'Acompanhamento das providências', unidade: 'Gabinete', prazo_dias: 365, prazo_auto: true, prazo_contagem: corridos, nome_publico: 'Adequação em acompanhamento',
            vai: ['Promoção de arquivamento', 'Prorrogação', 'Abertura de investigação', 'Aguardando a Prefeitura e a Câmara'],
            orientacao: 'Registre o plano de ação como cronograma: cada medida vira um prazo com alerta, e a Prefeitura e a Câmara comprovam pelo portal. Confira de tempos em tempos o portal e as bases públicas. O procedimento corre por 1 ano, prorrogável (Resolução CNMP 174/2017, art. 11). Use "Atualizar o panorama" para requisitar de novo, a cada exercício ou quando o STF trouxer exigência nova: a ADPF 854 segue em cumprimento, sem data para acabar. Comarcas de Caxias do Sul, Gramado e Torres: acompanhe as pendências das emendas para eventos e quem arca com a multa diária.',
            acoes: [
                A.cronograma('Registrar o cronograma de adequação', { ajuda: 'Uma linha por medida do plano de ação, com a data combinada. Cada uma vira um prazo do processo.' }),
                A.quitacao('Aguardar o cumprimento do cronograma'),
                A.audiencia('Designar reunião com a Prefeitura e a Câmara', 'reuniao'),
                A.fazer('Conferir de novo o portal e as bases públicas'),
                A.documento('Juntar comprovantes e capturas de tela', '', { forma: 'qualquer', nivel: 'opcional' }),
                A.escolha('Situação', ['Regularizado', 'Em adequação: prorrogar', 'Atualizar o panorama (nova requisição)', 'Persistem as desconformidades'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Promoção de arquivamento': quando('Situação', 'Regularizado'),
                'Prorrogação': quando('Situação', 'Em adequação: prorrogar'),
                'Aguardando a Prefeitura e a Câmara': quando('Situação', 'Atualizar o panorama (nova requisição)'),
                'Abertura de investigação': quando('Situação', 'Persistem as desconformidades'),
            },
        },
        {
            nome: 'Prorrogação', unidade: 'Gabinete', vai: ['Acompanhamento das providências'],
            orientacao: 'Prorrogue por mais 1 ano, por decisão fundamentada (Resolução CNMP 174/2017, art. 11). O acompanhamento recomeça com prazo novo.',
            acoes: [A.documento('Despacho de prorrogação fundamentada', 'Despacho', { forma: 'redigir' })],
        },
        {
            nome: 'Abertura de investigação', unidade: 'Gabinete', nome_publico: 'Encaminhamento para investigação', vai: ['Acompanhamento das providências', 'Promoção de arquivamento'],
            orientacao: 'O procedimento administrativo não investiga: surgindo fato que exija apuração, instaura-se o procedimento próprio (Resolução CNMP 174/2017, art. 10). Desconformidade do processo legislativo, da transparência ou da rastreabilidade: inquérito civil de emendas. Desvio, dano, favorecimento ou enriquecimento de pessoa certa: inquérito civil de improbidade administrativa. Recurso da União ainda não incorporado ao patrimônio do município: a atribuição é do Ministério Público Federal, e as peças seguem para lá. Ato praticado na Assembleia Legislativa: Promotoria de Justiça do Patrimônio Público. Os processos nascem daqui, já ligados a este.',
            acoes: [
                A.escolha('O que será aberto', ['Inquérito civil de emendas parlamentares', 'Inquérito civil de improbidade administrativa', 'Os dois inquéritos', 'Remessa ao Ministério Público Federal', 'Remessa a outra Promotoria de Justiça'], { obrigatoria: true, destino: 'autos' }),
                A.derivado('Abrir o inquérito civil de emendas', INQUERITO, { se: quando('O que será aberto', 'Inquérito civil de emendas parlamentares', 'Os dois inquéritos'), ajuda: BOTAO }),
                A.derivado('Abrir o inquérito civil de improbidade', 'Inquérito civil de improbidade administrativa (MPRS)', { se: quando('O que será aberto', 'Inquérito civil de improbidade administrativa', 'Os dois inquéritos'), ajuda: BOTAO }),
                A.documento('Despacho de instauração ou de remessa', 'Despacho', { forma: 'redigir' }),
                A.texto('Número do procedimento aberto ou do ofício de remessa', { destino: 'informacao', folha_dados: true }),
                A.simNao('O acompanhamento do município continua neste procedimento?', { obrigatoria: true, destino: 'autos', ajuda: 'Sim, se ainda há cronograma ou outras emendas a acompanhar; não, se o inquérito absorve todo o objeto.' }),
            ],
            saidas: {
                'Acompanhamento das providências': quando('O acompanhamento do município continua neste procedimento?', 'sim'),
                'Promoção de arquivamento': quando('O acompanhamento do município continua neste procedimento?', 'nao'),
            },
        },
        {
            nome: 'Promoção de arquivamento', unidade: 'Gabinete', vai: ['Comunicações finais'],
            orientacao: 'Cumprido ou exaurido o objeto, promova o arquivamento por decisão fundamentada. O procedimento administrativo de acompanhamento é arquivado no próprio órgão, com comunicação ao Conselho Superior, sem remessa para homologação (Resolução CNMP 174/2017, art. 12). Diga na promoção o que foi verificado, o que foi corrigido e para onde foi o que ficou em investigação.',
            acoes: [
                A.documento('Promoção de arquivamento', 'Promoção de arquivamento', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Comunicações finais', unidade: 'Secretaria', vai: ['Arquivamento'],
            orientacao: 'Comunique o arquivamento ao Conselho Superior e dê ciência à Prefeitura e à Câmara. Informe o Centro de Apoio Operacional Cível e do Patrimônio Público sobre as providências adotadas: é com esses dados que a Procuradoria-Geral de Justiça responde ao STF na ADPF 854.',
            acoes: [
                A.fazer('Comunicar o arquivamento ao Conselho Superior', { obrigatoria: true, destino: 'autos' }),
                A.fazer('Informar as providências ao Centro de Apoio (CAOCIPP)', { obrigatoria: true, destino: 'autos', ajuda: 'Pelo formulário de fiscalização de emendas parlamentares que o Centro de Apoio divulgou, ou por ofício.' }),
                A.comunicar('Dar ciência do arquivamento à Prefeitura e à Câmara', { especie: 'comunicacao', polos: ['requerido', 'interessado'], dias: 0, texto: 'O procedimento administrativo de acompanhamento das emendas parlamentares foi arquivado. Novas emendas ou novas exigências podem motivar outro acompanhamento.' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, no próprio órgão. Os inquéritos abertos a partir daqui seguem a própria vida. Para um novo exercício, abra outro procedimento ou reabra este.' },
    ]);
}

/** 2. Inquérito civil de emendas parlamentares (etapas 03 e 04 do checklist do MPRS; Provimento 71/2017-PGJ). */
export function emendasInqueritoCivil() {
    return montar({
        id: 'emendas-inquerito-civil-mprs', nome: INQUERITO, area: 'ministerio_publico', porte: 'longo', referencia: 'MPRS',
        descricao: 'A investigação do Ministério Público sobre emendas parlamentares ao orçamento (emendas impositivas, individuais, de bancada, de comissão ou emendas Pix), venham do Município, do Estado ou da União. Começa antes da portaria, com o registro da origem e o juízo de atribuição, que nessa matéria muda conforme a origem do recurso e o lugar do ato. Instaurado, corre por um ano, prorrogável, com requisições, consulta às bases públicas, vistoria do objeto e uma matriz de conformidade preenchida na tela (processo legislativo, execução, transparência, rastreabilidade, entidades beneficiadas e sinais de alerta). Do meio saem a recomendação com prazo, o compromisso de ajustamento de conduta com cronograma, a apuração de responsabilidade em inquérito de improbidade ligado a este e a comunicação ao Tribunal de Contas e a outros órgãos. Termina com a regularização e o arquivamento, que sobe ao Conselho Superior, ou com a ação civil pública, para suspender as emendas e impor as obrigações de normatizar, dar transparência e permitir o rastreio.',
        quando: 'Quando o diagnóstico ou uma representação mostram desconformidade das emendas com as regras de transparência, rastreabilidade, processo legislativo ou eficiência, e os Poderes não corrigiram por conta própria. O rito preliminar é o diagnóstico por município; sem elementos mínimos, comece por ele ou pela notícia de fato. Para desvio, dano ou enriquecimento de pessoa certa, o caminho é o inquérito civil de improbidade administrativa (MPRS), que pode nascer deste.',
        base: 'STF, ADPF 854 (decisões de 23/10/2025, 15/01, 19/05, 14/07, 07/08 e 23/08/2026) e ADIs 7688, 7695 e 7697; Constituição Federal, arts. 37, 129, III, 163-A, 166 e 166-A; Lei Complementar 210/2024; Lei 7.347/1985, arts. 5º, § 6º, 8º e 9º; Lei 12.527/2011; Lei Complementar 101/2000, arts. 48 e 48-A; Lei 13.019/2014; Lei 8.429/1992 e Lei 12.846/2013 (responsabilização, em processo próprio); Lei 9.504/1997, art. 73; Constituição do RS, art. 152; Instrução Normativa TCU 93/2024; Recomendação CNMP 120/2025; Resolução CNMP 23/2007 e Provimento 71/2017-PGJ (inquérito civil e arquivamento); Informação Técnico-Jurídica do CAOCIPP de 15/01/2026, complementação de 13/10/2026 e Checklist de Diagnóstico do MPRS.',
        tipo: { polos: ['requerente', 'requerido', 'interessado', 'terceiro'], nomes_polos: { requerente: 'Representante', requerido: 'Poder Executivo investigado', interessado: 'Poder Legislativo', terceiro: 'Entidade beneficiada ou órgão requisitado' } },
    }, [
        {
            nome: 'Origem da investigação', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Recebimento', vai: ['Atribuição e admissibilidade'],
            orientacao: 'Registre de onde veio o caso e o que se quer apurar. O caminho normal é o procedimento administrativo de diagnóstico, que já traz o checklist preenchido: se for esse o caso, o processo nasce ligado a ele e as peças são juntadas aqui. A origem das emendas e a frente de apuração orientam a atribuição e as diligências.',
            acoes: [
                A.formulario('Registrar a origem', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['Procedimento administrativo de diagnóstico', 'Notícia de fato', 'Representação', 'De ofício', 'Tribunal de Contas', 'Comunicação do STF, do CNMP ou do Centro de Apoio', 'Outro órgão'] },
                    { id: 'numero_origem', rotulo: 'Número do procedimento de origem', tipo: 'texto', obrigatorio: false },
                    { id: 'ente', rotulo: 'Município ou órgão estadual', tipo: 'texto', obrigatorio: true },
                    { id: 'emendas', rotulo: 'Origem das emendas', tipo: 'lista', obrigatorio: true, opcoes: ['Municipais (vereadores)', 'Estaduais (deputados estaduais)', 'Federais (deputados federais e senadores)', 'Mais de uma origem'] },
                    { id: 'frente', rotulo: 'Frente de apuração', tipo: 'lista', obrigatorio: true, opcoes: ['Processo legislativo orçamentário', 'Transparência e rastreabilidade', 'Execução e eficiência do gasto', 'Repasse a entidade privada sem fins lucrativos', 'Mais de uma frente'] },
                    { id: 'exercicios', rotulo: 'Exercícios abrangidos', tipo: 'texto', obrigatorio: true },
                    { id: 'fato', rotulo: 'Fato noticiado ou desconformidade apontada', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor das emendas envolvidas (R$)', tipo: 'numero', obrigatorio: false },
                ], { obrigatoria: true, ...FORM }),
                A.documento('Juntar a representação ou as peças do diagnóstico', 'Representação', { forma: 'juntar', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Atribuição e admissibilidade', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Instauração', 'Diagnóstico prévio', 'Indeferimento da representação', 'Declínio de atribuição'],
            orientacao: 'Decida em 30 dias. Atribuição, conforme a Informação do Centro de Apoio: emendas municipais e a execução de qualquer emenda no município são do Promotor de Justiça da comarca; ato praticado na Assembleia Legislativa é da Promotoria de Justiça do Patrimônio Público (não há foro por prerrogativa em ação de improbidade, STF, Tema 309); malversação de recurso federal ainda não incorporado ao patrimônio do Estado ou do município é do Ministério Público Federal. A transparência e a rastreabilidade do que o município recebe são sempre da Promotoria local, seja qual for a origem. Fato com repercussão em outra esfera é comunicado a quem tem atribuição, na fase "Comunicação a outros órgãos". Sem elementos mínimos, abra antes o diagnóstico.',
            acoes: [
                A.escolha('De quem é a atribuição', ['Desta Promotoria de Justiça', 'Promotoria de Justiça do Patrimônio Público', 'Ministério Público Federal', 'Outro órgão do Ministério Público'], { obrigatoria: true, destino: 'autos' }),
                A.simNao('O fato já é objeto de outro procedimento ou de ação judicial?', { obrigatoria: true, ajuda: 'Se sim, evite duplicidade: junte as peças ao que já existe ou indefira.' }),
                A.escolha('Juízo sobre o caso', ['Instaurar inquérito civil', 'Faltam elementos: abrir o diagnóstico', 'Indeferir a representação', 'Declinar atribuição'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Instauração': quando('Juízo sobre o caso', 'Instaurar inquérito civil'),
                'Diagnóstico prévio': quando('Juízo sobre o caso', 'Faltam elementos: abrir o diagnóstico'),
                'Indeferimento da representação': quando('Juízo sobre o caso', 'Indeferir a representação'),
                'Declínio de atribuição': quando('Juízo sobre o caso', 'Declinar atribuição'),
            },
        },
        {
            nome: 'Diagnóstico prévio', unidade: 'Gabinete', nome_publico: 'Levantamento preliminar', vai: ['Instauração', 'Indeferimento da representação'],
            orientacao: 'O diagnóstico corre em procedimento administrativo próprio, por município: requisições à Prefeitura e à Câmara, consulta às bases públicas e o checklist do MPRS. Ele nasce daqui, já ligado a este processo, e este aguarda o resultado. Para fato simples, serve também a notícia de fato ou o procedimento preparatório, de 90 dias.',
            acoes: [
                A.derivado('Abrir o procedimento de diagnóstico', DIAGNOSTICO, { ajuda: BOTAO }),
                A.texto('Número do procedimento de diagnóstico', { destino: 'informacao', folha_dados: true }),
                A.escolha('Resultado do diagnóstico', ['Há desconformidade ou indício: instaurar', 'Nada a apurar: indeferir'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Instauração': quando('Resultado do diagnóstico', 'Há desconformidade ou indício: instaurar'),
                'Indeferimento da representação': quando('Resultado do diagnóstico', 'Nada a apurar: indeferir'),
            },
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
            orientacao: 'Portaria com o fundamento legal, o fato, os investigados e as diligências iniciais (Resolução CNMP 23/2007, art. 4º). Delimite bem o objeto: quais emendas, de que exercícios, e qual a frente (norma e processo legislativo, transparência, rastreabilidade, execução, entidades). O que for conduta de pessoa certa com indício de desvio vai para inquérito de improbidade próprio, na fase "Apuração de responsabilidade", para não misturar a correção da estrutura com a responsabilização. A publicidade é a regra; o sigilo é motivado.',
            acoes: [
                A.formulario('Dados da portaria', [
                    { id: 'fundamento', rotulo: 'Fundamento legal', tipo: 'texto', obrigatorio: true },
                    { id: 'objeto', rotulo: 'Objeto delimitado (emendas, exercícios e frente)', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'investigados', rotulo: 'Investigados (Prefeitura, Câmara, órgão estadual, entidade)', tipo: 'texto', obrigatorio: true },
                    { id: 'diligencias', rotulo: 'Diligências iniciais', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'secretario', rotulo: 'Secretário designado', tipo: 'texto', obrigatorio: false },
                ], { obrigatoria: true, ...FORM }),
                A.documento('Portaria de instauração', 'Portaria', { forma: 'redigir' }),
                A.simNao('Há sigilo legal ou risco à investigação?', { obrigatoria: true, ajuda: 'Se sim, decrete o sigilo por decisão motivada. A publicidade é a regra.' }),
                A.documento('Decisão de sigilo', 'Despacho', { forma: 'redigir', se: quando('Há sigilo legal ou risco à investigação?', 'sim') }),
            ],
        },
        {
            nome: 'Registro e publicação', unidade: 'Secretaria', avanco: 'auto', vai: ['Instrução'],
            orientacao: 'Registre a portaria no sistema e remeta o extrato para publicação. Cadastre como partes o Executivo e o Legislativo investigados, cada um no seu polo, e a entidade beneficiada ou o órgão a requisitar: é o que permite requisitar, notificar e receber a resposta pelo portal. Informe a instauração ao Centro de Apoio.',
            acoes: [
                A.fazer('Registrar a portaria no sistema', { obrigatoria: true }),
                A.fazer('Remeter a portaria para publicação', { obrigatoria: true }),
                A.fazer('Cadastrar os investigados e os requisitados como partes', { obrigatoria: true, ajuda: 'Na aba Andamento, em Partes. Convide os procuradores para o portal.' }),
                A.comunicar('Comunicar a instauração ao representante', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Foi instaurado inquérito civil a partir da sua representação.' }),
                A.fazer('Informar a instauração ao Centro de Apoio (CAOCIPP)', { ajuda: 'O Centro de Apoio reúne as providências das Promotorias para a resposta da Procuradoria-Geral ao STF.' }),
            ],
        },
        {
            nome: 'Instrução', unidade: 'Gabinete', prazo_dias: 365, prazo_auto: true, prazo_contagem: corridos,
            vai: ['Aguardando resposta a requisição', 'Matriz de conformidade', 'Recomendação', 'Ajustamento de conduta', 'Apuração de responsabilidade', 'Comunicação a outros órgãos', 'Prorrogação', 'Declínio de atribuição', 'Conclusão'],
            orientacao: `É a fase central: daqui saem e para cá voltam todas as providências, e o membro escolhe a próxima em "Próximo passo". O que requisitar: a relação das emendas de 2020 até hoje (autor, valor, objeto e modalidade), os extratos das contas específicas, os planos de trabalho, os relatórios de gestão, os contratos, as notas e os termos de recebimento. Onde conferir: ${BASES}. Além dos papéis, vá ver o objeto: se a obra existe, se o equipamento funciona, se o preço é compatível. Análise do Gabinete de Assessoramento Técnico só quando indispensável, porque o atestado dos portais cabe primeiro ao Tribunal de Contas. Prazo de 1 ano, prorrogável.`,
            acoes: [
                A.fazer('Expedir requisições, notificações e ofícios'),
                A.fazer('Consultar as bases públicas e certificar o que foi visto', { ajuda: 'Transferegov.br, Portais da Transparência federal e do RS, Inteligência CNMP e portais do ente.' }),
                A.fazer('Pedir dados e relatórios ao Tribunal de Contas do Estado', { ajuda: 'O Tribunal atesta a transparência e a rastreabilidade e pode ter auditoria ou tomada de contas sobre as mesmas emendas.' }),
                A.audiencia('Designar oitiva, reunião ou vistoria', 'oitiva'),
                A.comunicar('Notificar para a oitiva ou reunião', { especie: 'notificacao', dias: 0, texto: 'Compareça para prestar declarações ou participar da reunião em {audiencia}.' }),
                A.fazer('Vistoriar o objeto da emenda (obra, serviço ou equipamento)', { ajuda: 'O STF exige eficiência: não basta rastrear o dinheiro se a obra ficou parada ou o equipamento, sem uso.' }),
                A.documento('Juntar termos, relatórios, extratos e documentos', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.simNao('Surgiu objeto diverso do da portaria?', { obrigatoria: true, ajuda: 'Se sim, adite a portaria ou extraia peças para outro procedimento.' }),
                A.documento('Aditamento da portaria', 'Portaria', { forma: 'redigir', se: quando('Surgiu objeto diverso do da portaria?', 'sim') }),
                A.escolha('Próximo passo', ['Aguardar resposta a requisição', 'Preencher a matriz de conformidade', 'Expedir recomendação', 'Propor ajustamento de conduta', 'Apurar responsabilidade por desvio ou dano', 'Comunicar outros órgãos', 'Prorrogar o prazo', 'Declinar atribuição', 'Concluir a investigação'], { obrigatoria: true }),
            ],
            saidas: {
                'Aguardando resposta a requisição': quando('Próximo passo', 'Aguardar resposta a requisição'),
                'Matriz de conformidade': quando('Próximo passo', 'Preencher a matriz de conformidade'),
                'Recomendação': quando('Próximo passo', 'Expedir recomendação'),
                'Ajustamento de conduta': quando('Próximo passo', 'Propor ajustamento de conduta'),
                'Apuração de responsabilidade': quando('Próximo passo', 'Apurar responsabilidade por desvio ou dano'),
                'Comunicação a outros órgãos': quando('Próximo passo', 'Comunicar outros órgãos'),
                'Prorrogação': quando('Próximo passo', 'Prorrogar o prazo'),
                'Declínio de atribuição': quando('Próximo passo', 'Declinar atribuição'),
                'Conclusão': quando('Próximo passo', 'Concluir a investigação'),
            },
        },
        {
            nome: 'Aguardando resposta a requisição', unidade: 'Secretaria', espera: true, avanco: 'auto', nome_publico: 'Aguardando informações',
            orientacao: 'Requisite ao Executivo, ao Legislativo, à entidade beneficiada ou ao órgão requisitado (cadastrados como partes). O prazo não pode ser inferior a 10 dias úteis (Lei 7.347/1985, art. 8º, § 1º). Peça de forma individualizada, emenda por emenda: resposta genérica não comprova. Com a resposta ou o fim do prazo, volta à instrução.',
            acoes: [
                A.comunicar('Requisitar informações e documentos', { especie: 'notificacao', polos: ['requerido', 'interessado', 'terceiro'], dias: 10, texto: 'Encaminhe, no prazo indicado, de forma individualizada por emenda, as informações e os documentos requisitados a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta', 'Requisitar informações e documentos', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Matriz de conformidade', unidade: 'Gabinete', nome_publico: 'Análise de conformidade', vai: ['Instrução'],
            orientacao: 'É o checklist do MPRS (Etapa 02) na tela, com o que as decisões de 2026 acrescentaram. Preencha só os quadros da frente em apuração; se o caso veio do diagnóstico, copie de lá e atualize. Em cada quadro, Sim quer dizer conforme; no quadro dos sinais de alerta é o contrário. O resultado fica na folha de dados do processo e serve de base para a recomendação, para as cláusulas do compromisso e para os pedidos da ação. Os cinco critérios mínimos do STF para executar qualquer emenda (ADI 7697): plano de trabalho prévio, compatibilidade com a LDO e o PPA, eficiência na entrega, transparência com rastreabilidade e respeito às metas fiscais.',
            acoes: [
                matrizCamara(),
                matrizGestao(),
                matrizRastro(),
                matrizEntidades(),
                matrizRisco(),
                A.textoLongo('Desconformidades apuradas e medida de correção de cada uma', { obrigatoria: true, destino: 'autos' }),
                A.escolha('Gravidade do que foi apurado', ['Sem desconformidade', 'Falhas formais, de correção simples', 'Falhas de norma, transparência ou rastreabilidade', 'Indício de desvio, dano ou favorecimento'], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
            ],
        },
        {
            nome: 'Recomendação', unidade: 'Gabinete', vai: ['Regularização em acompanhamento', 'Instrução'],
            orientacao: 'Recomende a cada Poder o que lhe cabe, com prazo. Ao Executivo: seção própria de emendas no portal, com os dados completos de cada uma e em formato aberto; fluxo interno; plano de trabalho antes da execução; conta específica; servidor responsável pelas informações. Ao Legislativo: norma local e regimento, análise técnica, publicidade, identificação do proponente e não encaminhar emenda sem objeto, valor e justificativa. Registre que, enquanto durar a desconformidade, a execução das emendas deve ficar suspensa (ADPF 854), e que a recomendação deixa certa a ciência dos gestores. Mande cópia ao Tribunal de Contas. O prazo de 30 dias é ajustável.',
            acoes: [
                A.documento('Recomendação ao Poder Executivo', 'Recomendação', { forma: 'redigir' }),
                A.documento('Recomendação ao Poder Legislativo', 'Recomendação', { forma: 'redigir', nivel: 'opcional' }),
                A.comunicar('Notificar os destinatários da recomendação', { especie: 'notificacao', polos: ['requerido', 'interessado'], dias: 30, contagem: corridos, texto: 'Fica notificado da recomendação anexa. Informe, no prazo indicado, se a acata e apresente o plano de ação, com cronograma e responsáveis. Enquanto durar a desconformidade, a execução das emendas parlamentares deve permanecer suspensa.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta à recomendação', 'Notificar os destinatários da recomendação', { obrigatoria: true }),
                A.fazer('Enviar cópia ao Tribunal de Contas do Estado e ao Centro de Apoio'),
                A.escolha('Resposta à recomendação', ['Acatada, com plano de ação', 'Acatada em parte', 'Não acatada ou sem resposta'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Regularização em acompanhamento': quando('Resposta à recomendação', 'Acatada, com plano de ação', 'Acatada em parte'),
                'Instrução': quando('Resposta à recomendação', 'Não acatada ou sem resposta'),
            },
        },
        {
            nome: 'Ajustamento de conduta', unidade: 'Gabinete', nome_publico: 'Negociação de compromisso', vai: ['Cientificação e remessa ao Conselho Superior', 'Regularização em acompanhamento', 'Instrução'],
            orientacao: 'Sempre que possível, celebre compromisso de ajustamento de conduta com o Executivo e o Legislativo (Etapa 03 do checklist): obrigações de editar a norma, adequar o portal, abrir contas específicas, adotar o plano de trabalho e o fluxo interno, com prazos e multa. Registre as obrigações como cronograma, para que cada uma vire um prazo com alerta. Compromisso que abrange todo o objeto: promova o arquivamento e remeta ao Conselho Superior (Etapa 04); o cumprimento passa a ser acompanhado em procedimento administrativo, que nasce daqui. Compromisso parcial: o inquérito segue quanto ao resto. Para a negociação completa, com minuta e reuniões, há o rito próprio do compromisso de ajustamento.',
            acoes: [
                A.audiencia('Designar reunião de negociação', 'reuniao'),
                A.comunicar('Notificar para a reunião', { especie: 'notificacao', polos: ['requerido', 'interessado'], dias: 0, texto: 'Compareça à reunião para tratar de compromisso de ajustamento de conduta sobre as emendas parlamentares em {audiencia}.' }),
                A.simNao('Ajustamento firmado?', { obrigatoria: true, destino: 'autos' }),
                A.documento('Termo de ajustamento de conduta', 'Termo de ajustamento de conduta', { forma: 'qualquer', se: quando('Ajustamento firmado?', 'sim') }),
                A.cronograma('Registrar as obrigações do compromisso', { se: quando('Ajustamento firmado?', 'sim'), ajuda: 'Uma linha por obrigação, com a data de vencimento. Cada uma vira um prazo do processo.' }),
                A.simNao('O compromisso abrange todo o objeto do inquérito?', { obrigatoria: true, destino: 'autos', se: quando('Ajustamento firmado?', 'sim') }),
                A.documento('Promoção de arquivamento', 'Promoção de arquivamento', { forma: 'redigir', se: quando('O compromisso abrange todo o objeto do inquérito?', 'sim') }),
                A.derivado('Abrir o acompanhamento do compromisso', 'Procedimento Administrativo do Ministério Público', { se: quando('O compromisso abrange todo o objeto do inquérito?', 'sim'), ajuda: BOTAO }),
            ],
            saidas: {
                'Cientificação e remessa ao Conselho Superior': quando('O compromisso abrange todo o objeto do inquérito?', 'sim'),
                'Regularização em acompanhamento': quando('O compromisso abrange todo o objeto do inquérito?', 'nao'),
                'Instrução': quando('Ajustamento firmado?', 'nao'),
            },
        },
        {
            nome: 'Regularização em acompanhamento', unidade: 'Gabinete', nome_publico: 'Prazo para regularização', vai: ['Conclusão', 'Instrução'],
            orientacao: 'Os Poderes estão corrigindo: registre o plano de ação como cronograma e confira cada entrega no portal e nas bases públicas. Na impossibilidade de solução negociada, avalie o que já foi feito e se cabe novo prazo, sobretudo quando há boa-fé dos gestores (Etapa 04 do checklist). Enquanto a desconformidade durar, confira se a execução das emendas está de fato suspensa. Recusa ou desídia levam à conclusão, para a ação.',
            acoes: [
                A.cronograma('Registrar o cronograma de adequação', { ajuda: 'Uma linha por medida, com a data combinada. A Prefeitura e a Câmara comprovam pelo portal.' }),
                A.quitacao('Aguardar o cumprimento do cronograma'),
                A.fazer('Conferir cada entrega no portal e nas bases públicas'),
                A.simNao('A execução das emendas está suspensa enquanto dura a desconformidade?', { destino: 'informacao' }),
                A.documento('Juntar comprovantes e capturas de tela', '', { forma: 'qualquer', nivel: 'opcional' }),
                A.escolha('Resultado da regularização', ['Regularizado', 'Boa-fé e avanço: novo prazo', 'Recusa ou desídia'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Conclusão': quando('Resultado da regularização', 'Regularizado', 'Recusa ou desídia'),
                'Instrução': quando('Resultado da regularização', 'Boa-fé e avanço: novo prazo'),
            },
        },
        {
            nome: 'Apuração de responsabilidade', unidade: 'Gabinete', nome_publico: 'Apuração em processo próprio', vai: ['Instrução'],
            orientacao: 'Este inquérito cuida da estrutura: norma, transparência, rastreabilidade e eficiência. Indício de desvio, sobrepreço, direcionamento, entidade de fachada, repasse a entidade ligada a parente de parlamentar, uso da emenda para pagar pessoal ou cessão da indicação a terceiro pede apuração de responsabilidade, em inquérito civil de improbidade administrativa, que nasce daqui e segue os prazos da Lei 8.429/1992. A falta de transparência pode, conforme o caso, configurar ato de improbidade (art. 11, IV). Pessoa jurídica beneficiada responde também pela Lei 12.846/2013. Onde o ente pagou multa diária por omissão do gestor, apure quem deu causa. Os dois processos correm juntos, cada um com o seu objeto.',
            acoes: [
                A.textoLongo('Indícios apurados e pessoas envolvidas', { obrigatoria: true, destino: 'informacao' }),
                A.numero('Valor estimado do dano ou da vantagem (R$)', { destino: 'informacao', folha_dados: true }),
                A.derivado('Abrir o inquérito civil de improbidade', 'Inquérito civil de improbidade administrativa (MPRS)', { obrigatoria: true, ajuda: BOTAO }),
                A.texto('Número do inquérito de improbidade', { destino: 'informacao', folha_dados: true }),
                A.simNao('Há pessoa jurídica beneficiada a responsabilizar (Lei 12.846/2013)?', { destino: 'informacao' }),
            ],
        },
        {
            nome: 'Comunicação a outros órgãos', unidade: 'Secretaria', vai: ['Instrução'],
            orientacao: 'Compartilhe o que foi apurado com quem tem atribuição ou pode ajudar. Tribunal de Contas do Estado: atesta a transparência e a rastreabilidade e instaura tomada de contas. Ministério Público Federal e Controladoria-Geral da União: indício de desvio de recurso federal. Promotoria Eleitoral: empenho, pagamento ou uso da emenda em período vedado (Lei 9.504/1997, art. 73). Procuradoria-Geral de Justiça: fato de atribuição originária e lei local que pareça inconstitucional, para exame de ação direta. Conselho Municipal de Saúde: emendas da saúde. Marque só o que se aplica e junte os ofícios.',
            acoes: [
                A.fazer('Comunicar o Tribunal de Contas do Estado'),
                A.fazer('Comunicar o Ministério Público Federal e a Controladoria-Geral da União', { ajuda: 'Quando há indício de desvio de recurso federal ainda não incorporado ao patrimônio do ente.' }),
                A.fazer('Comunicar a Promotoria Eleitoral', { ajuda: 'Emenda empenhada, paga ou divulgada em período vedado, ou indício de uso eleitoral da destinação.' }),
                A.fazer('Representar à Procuradoria-Geral de Justiça', { ajuda: 'Fato de atribuição originária do Procurador-Geral ou lei local a examinar em ação direta de inconstitucionalidade.' }),
                A.fazer('Acionar o Conselho Municipal de Saúde e os conselhos da área'),
                A.documento('Juntar os ofícios expedidos', 'Ofício', { forma: 'qualquer', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Prorrogação', unidade: 'Gabinete', vai: ['Instrução'],
            orientacao: 'Prorrogue por mais 1 ano, quantas vezes for preciso, por decisão fundamentada, com ciência ao Conselho Superior (Resolução CNMP 23/2007, art. 9º). Diga o que falta e por quê.',
            acoes: [
                A.documento('Despacho de prorrogação fundamentada', 'Despacho', { forma: 'redigir' }),
                A.fazer('Dar ciência da prorrogação ao Conselho Superior', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Declínio de atribuição', unidade: 'Gabinete', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Revisão pelo Conselho Superior'],
            orientacao: 'Se a atribuição for de outro Ministério Público, como o Federal nos casos de recurso da União ainda não incorporado, submeta a decisão de declínio ao Conselho Superior em 3 dias. Se for de outra Promotoria de Justiça do MPRS, remeta diretamente. O que for da Promotoria local (transparência e rastreabilidade no município) continua aqui.',
            acoes: [
                A.documento('Decisão de declínio de atribuição', 'Despacho', { forma: 'redigir' }),
                A.fazer('Submeter o declínio ao Conselho Superior', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Conclusão', unidade: 'Gabinete', vai: ['Ajuizamento da ação', 'Cientificação e remessa ao Conselho Superior'],
            ao_entrar: { pendencia: 'Concluir o inquérito de emendas: ajuizar a ação ou promover o arquivamento.' },
            orientacao: 'É a Etapa 04 do checklist. Regularizada a situação, ou sem irregularidade, promova o arquivamento. Havendo recusa em adotar providências ou desídia, ajuíze ação civil pública para suspender de imediato a execução das emendas e impor as obrigações de fazer e de não fazer que corrijam o que foi apurado. Na promoção de arquivamento, diga o que foi verificado, o que foi corrigido e o que seguiu em outro procedimento.',
            acoes: [
                A.escolha('Conclusão', ['Ajuizar a ação', 'Promover o arquivamento'], { obrigatoria: true, destino: 'autos' }),
                A.escolha('Motivo do arquivamento', ['Regularização comprovada', 'Inexistência de irregularidade', 'Objeto já tratado em outro procedimento ou ação'], { destino: 'autos', se: quando('Conclusão', 'Promover o arquivamento') }),
                A.documento('Promoção de arquivamento', 'Promoção de arquivamento', { forma: 'redigir', se: quando('Conclusão', 'Promover o arquivamento') }),
            ],
            saidas: { 'Ajuizamento da ação': quando('Conclusão', 'Ajuizar a ação'), 'Cientificação e remessa ao Conselho Superior': quando('Conclusão', 'Promover o arquivamento') },
        },
        {
            nome: 'Ajuizamento da ação', unidade: 'Gabinete', nome_publico: 'Ação judicial proposta', vai: ['Arquivamento'],
            orientacao: 'A ação típica é a civil pública de obrigação de fazer e de não fazer, com tutela de urgência: suspender a apresentação e a execução das emendas até a adequação; editar a norma local; adequar o portal, com dados abertos; abrir contas específicas e vedar conta de passagem; apresentar diagnóstico e cronograma; multa diária. Exemplos recentes: Tocantinópolis/TO (tutela deferida em 23/02/2026, com prazos de 30 e 60 dias e multa) e Pelotas/RS (liminar sobre o limite das emendas). A ação de improbidade é proposta no inquérito próprio. Compromisso descumprido é executado. Lei local inconstitucional: representação à Procuradoria-Geral de Justiça. O inquérito se encerra com o ajuizamento; a ação e o cumprimento da decisão podem ser acompanhados em procedimento administrativo, que nasce daqui.',
            acoes: [
                A.escolha('Ação proposta', ['Ação civil pública de obrigação de fazer e não fazer', 'Ação civil pública com pedido de suspensão das emendas', 'Execução de compromisso de ajustamento', 'Outra ação'], { obrigatoria: true, destino: 'autos' }),
                A.formulario('Pedidos da ação', [
                    sn('urgencia', 'Tutela de urgência'),
                    sn('suspensao', 'Suspensão da apresentação e da execução das emendas'),
                    sn('norma', 'Edição ou adequação da norma local e do regimento'),
                    sn('portal', 'Adequação do portal, com dados completos e abertos'),
                    sn('conta', 'Contas específicas e vedação de conta de passagem'),
                    sn('plano', 'Plano de trabalho e análise técnica antes da execução'),
                    sn('limite', 'Adequação do limite e dos tipos de emenda ao modelo federal'),
                    sn('multa', 'Multa diária pelo descumprimento'),
                ], { ...FORM }),
                A.documento('Juntar a petição inicial', 'Petição inicial', { forma: 'juntar' }),
                A.texto('Número da ação ajuizada', { obrigatoria: true, destino: 'autos' }),
                A.escolha('Decisão sobre a tutela de urgência', ['Deferida', 'Deferida em parte', 'Indeferida', 'Ainda sem decisão', 'Não foi pedida'], { destino: 'autos' }),
                A.derivado('Abrir o acompanhamento da ação e da decisão', 'Procedimento Administrativo do Ministério Público', { ajuda: BOTAO }),
                A.fazer('Informar o ajuizamento ao Centro de Apoio (CAOCIPP)', { ajuda: 'O Centro de Apoio reúne as providências das Promotorias para a resposta da Procuradoria-Geral ao STF.' }),
            ],
        },
        {
            nome: 'Cientificação e remessa ao Conselho Superior', unidade: 'Secretaria', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Revisão pelo Conselho Superior'],
            orientacao: 'Cientifique os interessados; não localizados, publique. Remeta os autos ao Conselho Superior em 3 dias da cientificação comprovada (Provimento 71/2017-PGJ, art. 22, § 1º). Informe o resultado ao Centro de Apoio.',
            acoes: [
                A.comunicar('Dar ciência aos interessados', { especie: 'ciencia', polos: ['requerente', 'requerido', 'interessado'], dias: 0, texto: 'Os autos serão remetidos ao Conselho Superior. Até a sessão, você pode apresentar razões escritas ou documentos.' }, { obrigatoria: true }),
                A.fazer('Publicar a cientificação de quem não foi localizado'),
                A.fazer('Informar o resultado ao Centro de Apoio (CAOCIPP)'),
                A.fazer('Remeter os autos ao Conselho Superior', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Revisão pelo Conselho Superior', unidade: 'Conselho Superior', vai: ['Arquivamento', 'Instrução', 'Designação de outro membro'], nome_publico: 'Revisão pelo colegiado',
            ao_entrar: { pendencia: 'Pautar e deliberar sobre a promoção, o indeferimento ou o declínio.' },
            orientacao: 'O colegiado homologa, converte em diligência ou rejeita e manda prosseguir, com a designação de outro membro. Para o trâmite completo dentro do Conselho, há o rito "Revisão de arquivamento pelo Conselho Superior (MPRS)".',
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
            orientacao: 'Registre o membro designado. Rejeitado o indeferimento, ele instaura o inquérito; rejeitado o arquivamento, prossegue na instrução ou ajuíza a ação.',
            acoes: [
                A.texto('Membro designado', { obrigatoria: true, destino: 'autos' }),
                A.simNao('O inquérito civil já foi instaurado?', { obrigatoria: true }),
            ],
            saidas: { 'Instrução': quando('O inquérito civil já foi instaurado?', 'sim'), 'Instauração': quando('O inquérito civil já foi instaurado?', 'nao') },
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Homologado o declínio, remeta antes os autos ao Ministério Público com atribuição. O inquérito de improbidade, o acompanhamento do compromisso e o da ação seguem a própria vida. Fato novo ou novo exercício: abra outro diagnóstico ou outro inquérito.' },
    ]);
}

export const modelos = [emendasDiagnostico, emendasInqueritoCivil];
