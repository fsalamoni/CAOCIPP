// ============================================================================
// JURIMETRIA — catálogo de constantes e padrões do módulo (flag: jurimetria_enabled)
// ----------------------------------------------------------------------------
// Este arquivo é a ÚNICA fonte da verdade no frontend para as listas oficiais,
// a tabela de pontuação e o formato de `organization.jurimetriaSettings`.
// O equivalente no backend é `functions-v2/src/shared/jurimetria.ts` — mantenha
// as chaves e os defaults em sincronia entre os dois arquivos.
//
// Nada aqui é aplicado automaticamente a nenhum órgão: o módulo só existe
// quando a flag global está ligada E o admin do órgão liga "Jurimetria" em
// Painel Administrativo → Páginas e Módulos.
// ============================================================================

// ----------------------------------------------------------------------------
// Listas oficiais (origem: planilha do CAOJúri — MP/RS)
// ----------------------------------------------------------------------------

/** Espécies de resultado canônicas (9). A ordem é usada na interface. */
export const JURIMETRIA_RESULTADOS = [
    'PROCEDÊNCIA',
    'PARCIAL PROCEDÊNCIA (QUALIFICADORA)',
    'PARCIAL PROCEDÊNCIA (OUTROS)',
    'PARCIAL PROCEDÊNCIA – MP',
    'IMPROCEDÊNCIA',
    'IMPROCEDÊNCIA-MP',
    'DESCLASSIFICAÇÃO',
    'DESCLASSIFICAÇÃO-MP',
    'DISSOLUÇÃO',
];

/**
 * Variações de grafia aceitas na importação, mapeadas para a espécie canônica.
 * A comparação é feita sobre o texto normalizado (sem acento, minúsculo).
 */
export const JURIMETRIA_RESULTADO_ALIASES = {
    'PARCIAL PROCEDÊNCIA': 'PARCIAL PROCEDÊNCIA (QUALIFICADORA)',
    'PARCIAL PROCEDENCIA': 'PARCIAL PROCEDÊNCIA (QUALIFICADORA)',
    'PARCIAL (QUALIFICADORA)': 'PARCIAL PROCEDÊNCIA (QUALIFICADORA)',
    'PARCIAL (OUTROS)': 'PARCIAL PROCEDÊNCIA (OUTROS)',
    'PARCIAL-MP': 'PARCIAL PROCEDÊNCIA – MP',
    'PARCIAL PROCEDENCIA - MP': 'PARCIAL PROCEDÊNCIA – MP',
    'PARCIAL PROCEDÊNCIA - MP': 'PARCIAL PROCEDÊNCIA – MP',
    'DISSOLUCAO': 'DISSOLUÇÃO',
    'DISSOLVIDO': 'DISSOLUÇÃO',
    'DESCLASSIFICACAO': 'DESCLASSIFICAÇÃO',
    'DESCLASSIFICACAO-MP': 'DESCLASSIFICAÇÃO-MP',
    'IMPROCEDENCIA': 'IMPROCEDÊNCIA',
    'IMPROCEDENCIA-MP': 'IMPROCEDÊNCIA-MP',
    'PROCEDENCIA': 'PROCEDÊNCIA',
};

/** Matérias/tipos de júri (sigla + descrição). */
export const JURIMETRIA_TIPOS = [
    { sigla: 'CM', descricao: 'CONTRA MENOR' },
    { sigla: 'CP', descricao: 'CONTRA POLICIAIS' },
    { sigla: 'D', descricao: 'DOMÉSTICO (GERAL)' },
    { sigla: 'F', descricao: 'FEMINICÍDIO' },
    { sigla: 'FC', descricao: 'FATOS DO COTIDIANO' },
    { sigla: 'PP', descricao: 'PRATICADO POR POLICIAL' },
    { sigla: 'T', descricao: 'TRÁFICO' },
];

/** Meses por extenso (índice 0 = Janeiro). */
export const JURIMETRIA_MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** Comarcas do Rio Grande do Sul, no formato "Nome (código)". */
export const JURIMETRIA_COMARCAS = [
    "Agudo (0154)",
    "Alegrete (0002)",
    "Alvorada (0003)",
    "Antônio Prado (0079)",
    "Arroio do Meio (0080)",
    "Arroio do Tigre (0143)",
    "Arroio Grande (0081)",
    "Arvorezinha (0082)",
    "Augusto Pestana (0149)",
    "Bagé (0004)",
    "Barra do Ribeiro (0140)",
    "Bento Gonçalves (0005)",
    "Bom Jesus (0083)",
    "Butiá (0084)",
    "Caçapava do Sul (0040)",
    "Cacequi (0085)",
    "Cachoeira do Sul (0006)",
    "Cachoeirinha (0086)",
    "Camaquã (0007)",
    "Campina das Missões (0150)",
    "Campo Bom (0087)",
    "Campo Novo (0088)",
    "Candelária (0089)",
    "Canela (0041)",
    "Canguçu (0042)",
    "Canoas (0008)",
    "Capão da Canoa (0141)",
    "Carazinho (0009)",
    "Carlos Barbosa (0144)",
    "Casca (0090)",
    "Catuípe (0091)",
    "Caxias do Sul (0010)",
    "Cerro Largo (0043)",
    "Charqueadas (0156)",
    "Constantina (0092)",
    "Coronel Bicaco (0093)",
    "Crissiumal (0094)",
    "Cruz Alta (0011)",
    "Dois Irmãos (0145)",
    "Dom Pedrito (0012)",
    "Eldorado do Sul (0165)",
    "Encantado (0044)",
    "Encruzilhada do Sul (0045)",
    "Erechim (0013)",
    "Espumoso (0046)",
    "Estância Velha (0095)",
    "Esteio (0014)",
    "Estrela (0047)",
    "Farroupilha (0048)",
    "Faxinal do Soturno (0096)",
    "Feliz (0146)",
    "Flores da Cunha (0097)",
    "Frederico Westphalen (0049)",
    "Garibaldi (0051)",
    "Gaurama (0098)",
    "General Câmara (0099)",
    "Getúlio Vargas (0050)",
    "Giruá (0100)",
    "Gramado (0101)",
    "Gravataí (0015)",
    "Guaíba (0052)",
    "Guaporé (0053)",
    "Guarani das Missões (0102)",
    "Herval (0103)",
    "Horizontina (0104)",
    "Ibirubá (0105)",
    "Igrejinha (0142)",
    "Ijuí (0016)",
    "Iraí (0106)",
    "Itaqui (0054)",
    "Ivoti (0166)",
    "Jaguarão (0055)",
    "Jaguari (0107)",
    "Júlio de Castilhos (0056)",
    "Lagoa Vermelha (0057)",
    "Lajeado (0017)",
    "Lavras do Sul (0108)",
    "Marau (0109)",
    "Marcelino Ramos (0110)",
    "Montenegro (0018)",
    "Mostardas (0111)",
    "Não-Me-Toque (0112)",
    "Nonoai (0113)",
    "Nova Petrópolis (0114)",
    "Nova Prata (0058)",
    "Novo Hamburgo (0019)",
    "Osório (0059)",
    "Palmares do Sul (0151)",
    "Palmeira das Missões (0020)",
    "Panambi (0060)",
    "Parobé (0157)",
    "Passo Fundo (0021)",
    "Pedro Osório (0115)",
    "Pelotas (0022)",
    "Pinheiro Machado (0117)",
    "Piratini (0118)",
    "Planalto (0116)",
    "Portão (0155)",
    "Porto Alegre (0001)",
    "Porto Xavier (0119)",
    "Quaraí (0061)",
    "Restinga Seca (0147)",
    "Rio Grande (0023)",
    "Rio Pardo (0024)",
    "Rodeio Bonito (0158)",
    "Ronda Alta (0148)",
    "Rosário do Sul (0062)",
    "Salto do Jacuí (0161)",
    "Sananduva (0120)",
    "Santa Bárbara do Sul (0121)",
    "Santa Cruz do Sul (0026)",
    "Santa Maria (0027)",
    "Santa Rosa (0028)",
    "Santa Vitória do Palmar (0063)",
    "Santana do Livramento (0025)",
    "Santiago (0064)",
    "Santo Ângelo (0029)",
    "Santo Antônio da Patrulha (0065)",
    "Santo Antônio das Missões (0122)",
    "Santo Augusto (0123)",
    "Santo Cristo (0124)",
    "São Borja (0030)",
    "São Francisco de Assis (0125)",
    "São Francisco de Paula (0066)",
    "São Gabriel (0031)",
    "São Jerônimo (0032)",
    "São José do Norte (0126)",
    "São José do Ouro (0127)",
    "São Leopoldo (0033)",
    "São Lourenço do Sul (0067)",
    "São Luiz Gonzaga (0034)",
    "São Marcos (0128)",
    "São Pedro do Sul (0129)",
    "São Sebastião do Caí (0068)",
    "São Sepé (0130)",
    "São Valentim (0152)",
    "São Vicente do Sul (0131)",
    "Sapiranga (0132)",
    "Sapucaia do Sul (0035)",
    "Sarandi (0069)",
    "Seberi (0133)",
    "Sobradinho (0134)",
    "Soledade (0036)",
    "Tapejara (0135)",
    "Tapera (0136)",
    "Tapes (0137)",
    "Taquara (0070)",
    "Taquari (0071)",
    "Tenente Portela (0138)",
    "Terra de Areia (0163)",
    "Teutônia (0159)",
    "Torres (0072)",
    "Tramandaí (0073)",
    "Três Coroas (0164)",
    "Três de Maio (0074)",
    "Três Passos (0075)",
    "Tribunal de Justiça (0700)",
    "Triunfo (0139)",
    "Tucunduva (0153)",
    "Tupanciretã (0076)",
    "Turmas Recursais (0710)",
    "Uruguaiana (0037)",
    "Vacaria (0038)",
    "Venâncio Aires (0077)",
    "Vera Cruz (0160)",
    "Veranópolis (0078)",
    "Viamão (0039)",
];

// ----------------------------------------------------------------------------
// Pontuação de aproveitamento
// ----------------------------------------------------------------------------
// Peso (0 a 1) de cada espécie de resultado. O aproveitamento de um grupo é a
// média ponderada: soma(peso[resultado]) / total de júris efetivos do grupo.
// Editável pelo administrador do órgão em Painel Administrativo → Jurimetria.

export const JURIMETRIA_PONTUACAO_PADRAO = {
    'PROCEDÊNCIA': 1.0,
    'PARCIAL PROCEDÊNCIA (QUALIFICADORA)': 0.75,
    'PARCIAL PROCEDÊNCIA (OUTROS)': 0.5,
    'PARCIAL PROCEDÊNCIA – MP': 1.0,
    'IMPROCEDÊNCIA': 0.0,
    'IMPROCEDÊNCIA-MP': 1.0,
    'DESCLASSIFICAÇÃO': 0.25,
    'DESCLASSIFICAÇÃO-MP': 1.0,
    'DISSOLUÇÃO': 0.0,
};

/**
 * Cor de fundo da etiqueta de cada espécie de resultado.
 *
 * Numa tabela de centenas de júris, a espécie é o que o olho procura primeiro.
 * A cor resolve isso antes da leitura: verde para procedência, azuis para as
 * parciais (do mais forte ao mais fraco), vermelhos para as improcedências,
 * laranjas para as desclassificações e cinza para a dissolução — que não é
 * desfecho de mérito e por isso não disputa atenção com as demais.
 *
 * São tons claros de propósito: a etiqueta se destaca sem transformar a tabela
 * num mosaico. O texto e a borda saem daqui por cálculo (ver `resultadoTheme`),
 * então o administrador pode trocar qualquer cor sem quebrar o contraste.
 */
export const JURIMETRIA_RESULTADO_CORES_PADRAO = {
    'PROCEDÊNCIA': '#93FFC4',
    'PARCIAL PROCEDÊNCIA (QUALIFICADORA)': '#41BFF1',
    'PARCIAL PROCEDÊNCIA (OUTROS)': '#A9DBF1',
    'PARCIAL PROCEDÊNCIA – MP': '#DFF4FD',
    'IMPROCEDÊNCIA': '#FFA3A3',
    'IMPROCEDÊNCIA-MP': '#FFDDDD',
    'DESCLASSIFICAÇÃO': '#F7C7AC',
    'DESCLASSIFICAÇÃO-MP': '#FAE2D6',
    'DISSOLUÇÃO': '#E2E8F0',
};

/**
 * Janela de expediente forense padrão do órgão.
 *
 * Serve para separar a sessão que coube no expediente da que o extrapolou —
 * informação de gestão (escala, diárias, sobreaviso), não de mérito. Cada
 * órgão ajusta no painel administrativo.
 */
export const JURIMETRIA_EXPEDIENTE_PADRAO = {
    inicio: '12:00',
    fim: '19:00',
    // 0 = domingo … 6 = sábado. Fora destes dias, a sessão é "dia sem expediente".
    dias: [1, 2, 3, 4, 5],
    // Feriados nacionais (inclusive os móveis, derivados da Páscoa) entram
    // automaticamente; o órgão acrescenta os locais na lista abaixo.
    feriadosNacionais: true,
    // Datas extras sem expediente, em ISO (`YYYY-MM-DD`) — feriados municipais,
    // pontos facultativos, recesso.
    feriados: [],
};

/** Situações possíveis de uma sessão em relação ao expediente. */
export const JURIMETRIA_EXPEDIENTE_SITUACOES = [
    {
        value: 'dentro',
        label: 'Dentro do expediente',
        description: 'Começou e terminou dentro da janela de expediente.',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
        chart: '#10b981',
    },
    {
        value: 'prolongou',
        label: 'Prolongou após o expediente',
        description: 'Terminou depois do fim da janela de expediente.',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
        chart: '#f59e0b',
    },
    {
        value: 'antecipou',
        label: 'Iniciou antes do expediente',
        description: 'Começou antes do início da janela de expediente.',
        badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
        chart: '#0ea5e9',
    },
    {
        value: 'sem_expediente',
        label: 'Dia sem expediente',
        description: 'Ocorreu em fim de semana, feriado ou outro dia sem expediente.',
        badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
        chart: '#8b5cf6',
    },
    {
        value: 'sem_horario',
        label: 'Horário não informado',
        description: 'Falta o horário de início ou de conclusão para classificar.',
        badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        chart: '#94a3b8',
    },
];

/** Metadados de uma situação de expediente. */
export function expedienteMeta(value) {
    return JURIMETRIA_EXPEDIENTE_SITUACOES.find((s) => s.value === value)
        || JURIMETRIA_EXPEDIENTE_SITUACOES[JURIMETRIA_EXPEDIENTE_SITUACOES.length - 1];
}

/**
 * Faixas de duração usadas como dimensão de análise. Uma sessão de júri
 * raramente passa de um dia; as faixas acompanham a rotina do plenário.
 */
export const JURIMETRIA_FAIXAS_DURACAO = [
    { value: 'ate_2h', label: 'Até 2h', max: 120 },
    { value: '2_4h', label: 'De 2h a 4h', max: 240 },
    { value: '4_6h', label: 'De 4h a 6h', max: 360 },
    { value: '6_8h', label: 'De 6h a 8h', max: 480 },
    { value: 'mais_8h', label: 'Mais de 8h', max: Infinity },
];

/** Cor de uma espécie sem cor definida (mesmo cinza neutro da interface). */
export const JURIMETRIA_RESULTADO_COR_NEUTRA = '#e2e8f0';

/**
 * Espécies tratadas como "dissolução": a sessão foi desfeita sem julgamento,
 * então não entram no cálculo de espécies, matérias nem aproveitamento —
 * aparecem apenas nos totais, em destaque próprio.
 */
export const JURIMETRIA_DISSOLUCAO_RESULTADOS = ['DISSOLUÇÃO'];

/** Faixas de cor do aproveitamento (da maior para a menor). */
export const JURIMETRIA_APROVEITAMENTO_FAIXAS = [
    { min: 0.75, label: 'Alto', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
    { min: 0.5, label: 'Médio-alto', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
    { min: 0.25, label: 'Médio', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
    { min: 0, label: 'Baixo', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
];

// ----------------------------------------------------------------------------
// Realização da sessão
// ----------------------------------------------------------------------------
// Responde "a sessão aconteceu?", que é diferente de "qual foi o resultado?".
// Um júri redesignado ou cancelado não tem julgamento de mérito, então fica
// fora das análises por padrão — é o equivalente, no plano da sessão, do que a
// dissolução é no plano do resultado.
//
// Registros antigos não têm o campo. Ausente é lido como "realizado", que era
// o comportamento até aqui — nenhum dado já gravado muda de significado.

export const JURIMETRIA_REALIZACAO_PADRAO = 'realizado';

export const JURIMETRIA_REALIZACOES = [
    {
        value: 'realizado',
        label: 'Realizado',
        description: 'A sessão ocorreu e produziu um resultado.',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
        dot: 'bg-emerald-500',
        chart: '#10b981',
    },
    {
        value: 'redesignado',
        label: 'Redesignado',
        description: 'A sessão não ocorreu na data prevista e foi remarcada para uma nova data.',
        badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
        dot: 'bg-amber-500',
        chart: '#f59e0b',
    },
    {
        value: 'cancelado',
        label: 'Cancelado',
        description: 'A sessão foi cancelada e não tem nova data marcada.',
        badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
        dot: 'bg-rose-500',
        chart: '#f43f5e',
    },
];

export const JURIMETRIA_REALIZACAO_VALUES = JURIMETRIA_REALIZACOES.map((r) => r.value);

/** Metadados de uma realização (aceita o valor ausente dos registros antigos). */
export function realizacaoMeta(value) {
    const alvo = value || JURIMETRIA_REALIZACAO_PADRAO;
    return JURIMETRIA_REALIZACOES.find((r) => r.value === alvo) || JURIMETRIA_REALIZACOES[0];
}

/** Realizações que exigem justificativa e movem a data para o histórico. */
export const JURIMETRIA_REALIZACOES_COM_JUSTIFICATIVA = ['redesignado', 'cancelado'];

// ----------------------------------------------------------------------------
// Campos fixos do registro de Júri
// ----------------------------------------------------------------------------
// São as colunas nativas do módulo. O administrador do órgão pode:
//   - renomear o rótulo exibido (`labelOverrides`);
//   - ocultar colunas não obrigatórias (`hiddenFields`);
//   - acrescentar colunas próprias (`customFields`).
// As chaves NUNCA mudam — é o que garante que os dados já gravados continuem
// legíveis depois de qualquer reconfiguração.

export const JURIMETRIA_CORE_FIELDS = [
    { key: 'numero_processo', label: 'Número do processo (CNJ)', type: 'text', required: true, locked: true },
    { key: 'data_juri', label: 'Data do júri', type: 'date', required: true, locked: true },
    { key: 'realizacao', label: 'Realização', type: 'list', list: 'realizacoes', required: false, locked: true },
    { key: 'comarca', label: 'Comarca', type: 'list', list: 'comarcas', required: false },
    { key: 'tipo', label: 'Matéria / Tipo de júri', type: 'list', list: 'tipos', required: false },
    { key: 'resultado', label: 'Espécie de resultado', type: 'list', list: 'resultados', required: false },
    { key: 'promotor', label: 'Promotor(a)', type: 'text', required: false },
    // `horario` sempre significou o horário em que a sessão TERMINOU — é o que
    // as planilhas do CAOJúri registravam. O rótulo agora diz isso, e o horário
    // de início entra como campo próprio, sem tocar em nada já gravado.
    { key: 'horario_inicio', label: 'Horário de início', type: 'text', required: false },
    { key: 'horario', label: 'Horário de conclusão', type: 'text', required: false },
    { key: 'vara', label: 'Vara / Órgão julgador', type: 'text', required: false },
    { key: 'observacoes', label: 'Observações', type: 'textarea', required: false },
];

/** Chaves dos campos fixos que o admin não pode ocultar nem renomear. */
export const JURIMETRIA_LOCKED_FIELD_KEYS = JURIMETRIA_CORE_FIELDS
    .filter((f) => f.locked)
    .map((f) => f.key);

/** Tipos aceitos em colunas personalizadas criadas pelo admin do órgão. */
export const JURIMETRIA_CUSTOM_FIELD_TYPES = [
    { type: 'text', label: 'Texto curto' },
    { type: 'textarea', label: 'Texto longo' },
    { type: 'number', label: 'Número' },
    { type: 'date', label: 'Data' },
    { type: 'boolean', label: 'Sim/Não' },
    { type: 'select', label: 'Lista de opções' },
];

// ----------------------------------------------------------------------------
// Política de importação
// ----------------------------------------------------------------------------
// A importação é sempre IDEMPOTENTE: reimportar a mesma planilha não duplica
// registros. A política define o que fazer quando o mesmo processo chega com
// dados divergentes dos já gravados.

export const JURIMETRIA_IMPORT_POLICIES = [
    {
        value: 'preserve',
        label: 'Preservar o banco (recomendado)',
        description: 'Registros divergentes são listados como conflito e os dados já gravados permanecem intactos. Campos vazios no banco são completados com o que a planilha traz.',
    },
    {
        value: 'update',
        label: 'Atualizar com a planilha',
        description: 'Registros divergentes são sobrescritos pelos dados da planilha, com registro no histórico. Campos vazios no banco também são completados.',
    },
];

/**
 * Eixos pelos quais os relatórios de duração e de expediente podem ser
 * reagrupados. É a mesma base lida de ângulos diferentes — por comarca conta
 * uma história, por promotor conta outra.
 */
export const JURIMETRIA_AGRUPADORES_DURACAO = [
    { key: 'comarca', label: 'Comarca' },
    { key: 'promotor', label: 'Promotor(a)' },
    { key: 'resultado', label: 'Espécie de resultado' },
    { key: 'tipo', label: 'Matéria / Tipo' },
    { key: 'mes', label: 'Mês' },
    { key: 'ano', label: 'Ano' },
    { key: 'vara', label: 'Vara / Órgão julgador' },
    { key: 'responsavel', label: 'Responsável no órgão' },
];

/** Dimensões disponíveis nos relatórios dinâmicos (linhas e colunas). */
export const JURIMETRIA_PIVOT_DIMENSIONS = [
    { key: 'comarca', label: 'Comarca' },
    { key: 'promotor', label: 'Promotor(a)' },
    { key: 'tipo', label: 'Matéria / Tipo' },
    { key: 'resultado', label: 'Espécie de resultado' },
    { key: 'realizacao', label: 'Realização (realizado/redesignado/cancelado)' },
    { key: 'mes', label: 'Mês' },
    { key: 'ano', label: 'Ano' },
    { key: 'vara', label: 'Vara / Órgão julgador' },
    { key: 'responsavel', label: 'Responsável (membro do órgão)' },
    { key: 'expediente', label: 'Expediente (dentro / prolongou / antes / sem expediente)' },
    { key: 'faixa_duracao', label: 'Faixa de duração da sessão' },
    { key: 'hora_inicio', label: 'Hora de início da sessão' },
    { key: 'faixa_horario', label: 'Turno (manhã / tarde / noite)' },
];

/** Medidas disponíveis nos relatórios dinâmicos. */
export const JURIMETRIA_PIVOT_VALUES = [
    { key: 'quantidade', label: 'Quantidade de júris' },
    { key: 'aproveitamento', label: 'Aproveitamento (%)' },
    { key: 'pontos', label: 'Soma de pontos' },
    { key: 'dissolucoes', label: 'Dissoluções' },
    { key: 'duracao_media', label: 'Duração média da sessão' },
    { key: 'duracao_total', label: 'Tempo total de sessão' },
];

/** Modos de exibição do valor na tabela dinâmica. */
export const JURIMETRIA_PIVOT_SHOW_AS = [
    { key: 'valor', label: 'Valor absoluto' },
    { key: 'linha', label: '% da linha' },
    { key: 'coluna', label: '% da coluna' },
    { key: 'total', label: '% do total geral' },
];

// ----------------------------------------------------------------------------
// Opções de análise
// ----------------------------------------------------------------------------
// Diferente dos FILTROS (que recortam quais júris entram), estas opções dizem
// COMO contar os júris do recorte. Valem para o Painel, os Relatórios e os
// Relatórios dinâmicos — nunca para a tabela de Júris, que é a base de dados e
// mostra tudo o que está gravado.

export const JURIMETRIA_DEFAULT_ANALYSIS = {
    // Em regra, a análise olha só as sessões que aconteceram: redesignadas e
    // canceladas não produziram julgamento. Desligar inclui todas.
    somenteRealizados: true,
    // Remove dos agrupamentos os grupos "(não informado)" — útil quando a base
    // ainda tem lacunas e elas poluem rankings e gráficos.
    excluirNaoInformados: false,
};

/** Seções do relatório descritivo. */
export const JURIMETRIA_DESCRITIVO_SECOES = [
    { key: 'quantitativo', label: 'Quantitativo geral' },
    { key: 'meses', label: 'Júris por mês' },
    { key: 'especies', label: 'Espécies de resultado' },
    { key: 'materias', label: 'Matérias / Tipos' },
    { key: 'promotores', label: 'Promotores relacionados' },
    { key: 'aproveitamento', label: 'Aproveitamento ponderado' },
    { key: 'horarios', label: 'Faixas de horário' },
    { key: 'duracao', label: 'Duração das sessões' },
    { key: 'expediente', label: 'Expediente (dentro / fora)' },
    { key: 'dissolucoes', label: 'Dissoluções' },
];

/** Estilos de redação do relatório descritivo. */
export const JURIMETRIA_DESCRITIVO_ESTILOS = [
    {
        key: 'formal',
        label: 'Formal e objetivo',
        description: 'Texto corrido em registro de expediente, frases completas, '
            + 'com uma tabela por seção onde ela substitui o parágrafo. Para citar num expediente.',
    },
    {
        key: 'executivo',
        label: 'Executivo (resumido)',
        description: 'Abre com a síntese numérica e entrega tabelas por todos os ângulos, '
            + 'partindo das comarcas. Pouco texto, muito quadro. Para quem tem trinta segundos.',
    },
    {
        key: 'analitico',
        label: 'Analítico (detalhado)',
        description: 'Cruza as dimensões entre si (comarca × espécie, matéria × espécie, '
            + 'promotor × matéria, comarca × matéria × espécie…) e comenta concentração, '
            + 'dispersão e casos extremos. Para investigar.',
    },
];

// ----------------------------------------------------------------------------
// Configuração do órgão
// ----------------------------------------------------------------------------

/**
 * Configuração padrão do módulo em um órgão que nunca foi configurado.
 * Espelha `JURIMETRIA_DEFAULT_SETTINGS` em functions-v2/src/shared/jurimetria.ts.
 */
export const JURIMETRIA_DEFAULT_SETTINGS = {
    comarcas: JURIMETRIA_COMARCAS,
    tipos: JURIMETRIA_TIPOS,
    resultados: JURIMETRIA_RESULTADOS,
    pontuacao: JURIMETRIA_PONTUACAO_PADRAO,
    dissolucaoResultados: JURIMETRIA_DISSOLUCAO_RESULTADOS,
    customFields: [],
    labelOverrides: {},
    hiddenFields: [],
    importPolicy: 'preserve',
    fuzzyThreshold: 0.7,
    requireResponsible: false,
    resultadoCores: JURIMETRIA_RESULTADO_CORES_PADRAO,
    expediente: JURIMETRIA_EXPEDIENTE_PADRAO,
};


// ============================================================================
// Cores das espécies — derivação de contraste
// ----------------------------------------------------------------------------
// O administrador escolhe UMA cor por espécie. Texto, borda e a variante de
// tema escuro saem dela por cálculo, para que nenhuma escolha produza uma
// etiqueta ilegível — inclusive as cores que ele inventar depois.
// ============================================================================

/** `#rgb` ou `#rrggbb` -> `{r,g,b}`; `null` quando não é uma cor válida. */
export function parseHexColor(value) {
    const raw = String(value || '').trim().replace(/^#/, '');
    const hex = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
    return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
    };
}

/** Normaliza para `#rrggbb` minúsculo, ou `null` se inválida. */
export function normalizeHexColor(value) {
    const rgb = parseHexColor(value);
    if (!rgb) return null;
    const hex = (n) => n.toString(16).padStart(2, '0');
    return `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`;
}

/** Luminância relativa (WCAG 2.1), de 0 (preto) a 1 (branco). */
export function relativeLuminance(value) {
    const rgb = parseHexColor(value);
    if (!rgb) return 1;
    const canal = (n) => {
        const c = n / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * canal(rgb.r) + 0.7152 * canal(rgb.g) + 0.0722 * canal(rgb.b);
}

/** Mistura duas cores; `peso` = quanto da segunda entra (0 a 1). */
function mixHex(base, alvo, peso) {
    const a = parseHexColor(base);
    const b = parseHexColor(alvo);
    if (!a || !b) return base;
    const canal = (x, y) => Math.round(x + (y - x) * peso);
    const hex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `#${hex(canal(a.r, b.r))}${hex(canal(a.g, b.g))}${hex(canal(a.b, b.b))}`;
}

const TINTA_ESCURA = '#0f172a'; // slate-900
const TINTA_CLARA = '#ffffff';

/**
 * Conjunto de cores de uma etiqueta de espécie, nos dois temas.
 *
 * Tema claro: fundo na cor escolhida, texto escuro ou claro conforme a
 * luminância, borda um pouco mais escura que o fundo para o chip não "sangrar"
 * na linha da tabela.
 *
 * Tema escuro: o mesmo tom pastel aceso no fundo escuro viraria um borrão —
 * então o fundo é a cor rebaixada contra o slate-950 e o texto é a própria
 * cor clareada, que é como o resto da plataforma trata badges coloridos.
 */
export function resultadoTheme(cor) {
    const base = normalizeHexColor(cor) || JURIMETRIA_RESULTADO_COR_NEUTRA;
    const lum = relativeLuminance(base);
    return {
        base,
        bg: base,
        text: lum > 0.42 ? TINTA_ESCURA : TINTA_CLARA,
        border: mixHex(base, TINTA_ESCURA, 0.18),
        darkBg: mixHex(base, '#020617', 0.82),
        darkText: lum > 0.42 ? mixHex(base, TINTA_CLARA, 0.12) : mixHex(base, TINTA_CLARA, 0.45),
        darkBorder: mixHex(base, '#020617', 0.6),
    };
}

/** Cor configurada para uma espécie (com o padrão como rede de segurança). */
export function corDoResultado(resultado, settings) {
    if (!resultado) return JURIMETRIA_RESULTADO_COR_NEUTRA;
    const mapa = settings?.resultadoCores || JURIMETRIA_RESULTADO_CORES_PADRAO;
    return normalizeHexColor(mapa[resultado])
        || normalizeHexColor(JURIMETRIA_RESULTADO_CORES_PADRAO[resultado])
        || JURIMETRIA_RESULTADO_COR_NEUTRA;
}

/** Atalho: tema completo da etiqueta de uma espécie. */
export function temaDoResultado(resultado, settings) {
    return resultadoTheme(corDoResultado(resultado, settings));
}

/**
 * Resolve a configuração efetiva do módulo para um órgão, aplicando os
 * defaults onde o administrador nunca mexeu. Nunca devolve `undefined` em
 * nenhum campo — o resto do módulo pode confiar na forma do objeto.
 * @param {object|null|undefined} organization
 */
export function resolveJurimetriaSettings(organization) {
    const cfg = organization?.jurimetriaSettings;
    if (!cfg || typeof cfg !== 'object') return { ...JURIMETRIA_DEFAULT_SETTINGS };

    const listOrDefault = (value, fallback) =>
        Array.isArray(value) && value.length > 0 ? value : fallback;

    return {
        comarcas: listOrDefault(cfg.comarcas, JURIMETRIA_COMARCAS),
        tipos: listOrDefault(cfg.tipos, JURIMETRIA_TIPOS),
        resultados: listOrDefault(cfg.resultados, JURIMETRIA_RESULTADOS),
        pontuacao: { ...JURIMETRIA_PONTUACAO_PADRAO, ...(cfg.pontuacao || {}) },
        dissolucaoResultados: listOrDefault(cfg.dissolucaoResultados, JURIMETRIA_DISSOLUCAO_RESULTADOS),
        customFields: Array.isArray(cfg.customFields) ? cfg.customFields : [],
        labelOverrides: (cfg.labelOverrides && typeof cfg.labelOverrides === 'object') ? cfg.labelOverrides : {},
        hiddenFields: Array.isArray(cfg.hiddenFields) ? cfg.hiddenFields : [],
        importPolicy: cfg.importPolicy === 'update' ? 'update' : 'preserve',
        fuzzyThreshold: Number.isFinite(Number(cfg.fuzzyThreshold))
            ? Math.min(1, Math.max(0.4, Number(cfg.fuzzyThreshold)))
            : 0.7,
        requireResponsible: cfg.requireResponsible === true,
        // Cores: o padrão entra por baixo, então uma espécie criada pelo órgão
        // sem cor definida não fica sem etiqueta.
        resultadoCores: {
            ...JURIMETRIA_RESULTADO_CORES_PADRAO,
            ...((cfg.resultadoCores && typeof cfg.resultadoCores === 'object') ? cfg.resultadoCores : {}),
        },
        expediente: resolveExpediente(cfg.expediente),
    };
}

/** Janela de expediente efetiva, com os defaults onde o admin não mexeu. */
export function resolveExpediente(cfg) {
    const base = JURIMETRIA_EXPEDIENTE_PADRAO;
    if (!cfg || typeof cfg !== 'object') return { ...base };
    const hora = (valor, fallback) => (
        /^([01]\d|2[0-3]):[0-5]\d$/.test(String(valor || '')) ? String(valor) : fallback
    );
    const dias = Array.isArray(cfg.dias)
        ? [...new Set(cfg.dias.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
        : base.dias;
    return {
        inicio: hora(cfg.inicio, base.inicio),
        fim: hora(cfg.fim, base.fim),
        dias: dias.length > 0 ? dias : base.dias,
        feriadosNacionais: cfg.feriadosNacionais !== false,
        feriados: Array.isArray(cfg.feriados)
            ? [...new Set(cfg.feriados
                .map((d) => String(d || '').trim())
                .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort()
            : [],
    };
}

/**
 * Lista de campos (fixos + personalizados) efetivamente em uso no órgão, já
 * com os rótulos personalizados aplicados e os campos ocultos removidos.
 * @param {object} settings Resultado de `resolveJurimetriaSettings`.
 */
export function getJurimetriaFields(settings) {
    const hidden = new Set(settings?.hiddenFields || []);
    const overrides = settings?.labelOverrides || {};

    const core = JURIMETRIA_CORE_FIELDS
        .filter((f) => f.locked || !hidden.has(f.key))
        .map((f) => ({ ...f, label: overrides[f.key] || f.label, custom: false }));

    const custom = (settings?.customFields || [])
        .filter((f) => f && f.key && !hidden.has(f.key))
        .map((f) => ({
            key: f.key,
            label: f.label || f.key,
            type: f.type || 'text',
            options: Array.isArray(f.options) ? f.options : [],
            required: f.required === true,
            custom: true,
        }));

    return [...core, ...custom];
}

/**
 * Lê o valor de um campo do registro, seja ele fixo (raiz do documento) ou
 * personalizado (dentro de `values`).
 */
export function getJuriFieldValue(juri, key) {
    if (!juri || !key) return '';
    if (Object.prototype.hasOwnProperty.call(juri, key)) return juri[key];
    return juri?.values?.[key] ?? '';
}
