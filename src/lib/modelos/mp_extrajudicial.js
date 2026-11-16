// Modelos da área ministerio_publico (extrajudicial não penal) e um da área correcional:
// compromisso de ajustamento de conduta, recomendação, audiência pública, revisão pelo
// Conselho Superior e expedientes próprios do MPRS. Pesquisa e fontes:
// /mnt/project-files/modelos-rito/pesquisa-mprs.md. Forma de escrever: ./dsl.js.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';

/** 1. Compromisso de ajustamento de conduta (Res. CNMP 179/2017; Lei 7.347/1985, art. 5º, § 6º). */
export function compromissoAjustamentoConduta() {
    return montar({
        id: 'compromisso-ajustamento-conduta', nome: 'Compromisso de ajustamento de conduta (TAC)', area: 'ministerio_publico', porte: 'longo', referencia: 'CNMP',
        descricao: 'Acompanha num só processo a vida inteira do compromisso de ajustamento de conduta tomado pelo Ministério Público: a negociação com o responsável pela lesão, em reuniões e, se for o caso, audiência pública; a celebração do termo, com obrigações certas, líquidas e exigíveis, prazos e multa; a promoção de arquivamento do procedimento de origem e a ciência ao Conselho Superior em até 3 dias; a publicação do extrato em 15 dias; e a fiscalização do cumprimento. Descumprido o termo, o compromissário é instado a justificar e o membro executa em até 60 dias, repactua ou segue acompanhando. Cumprido, o acompanhamento é arquivado com ciência ao compromissário, que pode recorrer em 10 dias ao Conselho Superior. Difere do procedimento administrativo genérico por trazer as fases e cláusulas próprias do ajuste.',
        quando: 'Quando, num inquérito civil, procedimento preparatório ou procedimento administrativo, o investigado aceita adequar a conduta. Ajuste os prazos de comunicação ao Conselho Superior e de recurso conforme o regulamento do seu Ministério Público (no MPRS, Provimento 71/2017-PGJ, arts. 34 a 45).',
        base: 'Lei 7.347/1985, art. 5º, § 6º; Res. CNMP 179/2017, arts. 1º a 4º (cabimento, forma e multa), 5º (destinação), 6º (ciência ao órgão superior em até 3 dias), 7º (extrato em 15 dias), 8º (Portal, redação da Res. CNMP 326/2026), 9º e 10 (fiscalização) e 11 (execução em 60 dias); Res. CNMP 174/2017, art. 8º, I; no MPRS, Provimento 71/2017-PGJ, arts. 34 a 45 e 70 (prazos em dias corridos).',
        tipo: { polos: ['requerido', 'interessado'], nomes_polos: { requerido: 'Compromissário', interessado: 'Interessado' } },
    }, [
        {
            nome: 'Proposta de ajustamento', unidade: 'Gabinete', nome_publico: 'Proposta de acordo',
            orientacao: 'Registre o procedimento de origem e o compromissário. O membro não pode renunciar ao direito; negocia só o modo, o tempo e o lugar do cumprimento e a compensação do que não puder ser recuperado (Res. CNMP 179/2017, art. 1º, § 1º). Decida se cabe reunião ou audiência pública com os titulares do direito (art. 1º, § 4º).',
            acoes: [
                A.formulario('Dados da proposta', [
                    { id: 'origem', rotulo: 'Número do procedimento de origem', tipo: 'texto', obrigatorio: true },
                    { id: 'tipo_origem', rotulo: 'Procedimento de origem', tipo: 'lista', obrigatorio: true, opcoes: ['Inquérito civil', 'Procedimento preparatório', 'Procedimento administrativo', 'Ação judicial'] },
                    { id: 'compromissario', rotulo: 'Compromissário', tipo: 'texto', obrigatorio: true },
                    { id: 'objeto', rotulo: 'Conduta a ajustar e dano a reparar', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'tema', rotulo: 'Área de atuação', tipo: 'lista', obrigatorio: true, opcoes: ['Meio ambiente', 'Consumidor', 'Patrimônio público', 'Saúde', 'Educação', 'Urbanismo', 'Outra'] },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.simNao('Fazer audiência pública antes de negociar?', { obrigatoria: true, ajuda: 'Se sim, abra o rito de audiência pública vinculado a este processo (Res. CNMP 179/2017, art. 1º, § 4º).' }),
                A.fazer('Abrir o rito de audiência pública', { se: quando('Fazer audiência pública antes de negociar?', 'sim') }),
            ],
            vai: ['Negociação'],
        },
        {
            nome: 'Negociação', unidade: 'Gabinete', vai: ['Celebração do termo', 'Encerramento sem acordo'], nome_publico: 'Negociação do acordo',
            orientacao: 'Negocie em reunião; o compromissário pode estar acompanhado ou representado por advogado, com procuração juntada; pessoa jurídica assina por quem tem poder de representação, e grupo econômico pela controladora (art. 3º, §§ 1º a 4º). Monte a minuta com obrigações certas, líquidas e exigíveis, prazo de cumprimento e multa (arts. 3º e 4º).',
            acoes: [
                A.audiencia('Designar reunião de negociação', 'reuniao'),
                A.comunicar('Notificar o compromissário para a reunião', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Compareça à reunião para tratar de compromisso de ajustamento de conduta em {audiencia}. Pode vir acompanhado de advogado, com procuração.' }, { obrigatoria: true }),
                A.documento('Juntar a procuração ou o ato de representação', 'Procuração', { forma: 'juntar', nivel: 'recomendado' }),
                A.documento('Minuta do termo', 'Minuta', { forma: 'redigir', nivel: 'recomendado' }),
                A.escolha('Resultado da negociação', ['Acordo alcançado', 'Sem acordo'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Celebração do termo': quando('Resultado da negociação', 'Acordo alcançado'), 'Encerramento sem acordo': quando('Resultado da negociação', 'Sem acordo') },
        },
        {
            nome: 'Celebração do termo', unidade: 'Gabinete', vai: ['Arquivamento do procedimento de origem'], nome_publico: 'Assinatura do compromisso',
            orientacao: 'O termo qualifica o compromissário, traz obrigações com modo e prazo, multa diária ou por evento com termo inicial, destinação dos valores ao fundo do art. 13 da Lei 7.347/1985 ou destino equivalente, cláusula de execução e aviso de que não exclui a responsabilidade administrativa nem a de outra esfera (Res. CNMP 179/2017, arts. 3º a 5º; no MPRS, Provimento 71/2017-PGJ, arts. 35 a 42). Tem eficácia de título executivo desde a celebração (art. 1º).',
            acoes: [
                A.orientar('Confira as cláusulas obrigatórias', 'Obrigações certas e com prazo, multa com termo inicial, destinação dos valores, cláusula de execução e aviso sobre outras responsabilidades.'),
                A.documento('Termo de compromisso de ajustamento de conduta', 'Termo de ajustamento de conduta', { forma: 'redigir' }),
                A.data('Data da celebração', { obrigatoria: true, destino: 'informacao' }),
                A.data('Prazo final das obrigações', { destino: 'informacao' }),
                A.simNao('O termo abrange todos os fatos e investigados?', { obrigatoria: true, ajuda: 'Se não, extraia cópias e instaure procedimento para o restante (Provimento 71/2017-PGJ, art. 34, § 5º).' }),
                A.fazer('Extrair cópias para prosseguir quanto ao restante', { se: quando('O termo abrange todos os fatos e investigados?', 'nao') }),
                A.comunicar('Entregar cópia do termo ao compromissário', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Segue cópia do compromisso de ajustamento de conduta assinado. As obrigações valem desde a data da celebração.' }),
            ],
        },
        {
            nome: 'Arquivamento do procedimento de origem', unidade: 'Secretaria', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Homologação pelo Conselho Superior'],
            orientacao: 'Promova o arquivamento do procedimento de origem, cientifique os interessados que não participaram do ajuste e dê ciência do inteiro teor do termo ao Conselho Superior em até 3 dias (Res. CNMP 179/2017, art. 6º, § 2º; no MPRS, remessa para homologação em 3 dias da cientificação, Provimento 71/2017-PGJ, art. 43).',
            acoes: [
                A.documento('Promoção de arquivamento do procedimento de origem', 'Promoção de arquivamento', { forma: 'redigir' }),
                A.comunicar('Dar ciência aos interessados não participantes', { especie: 'ciencia', polos: ['interessado'], dias: 0, texto: 'Foi celebrado compromisso de ajustamento de conduta e promovido o arquivamento do procedimento. Até a sessão do Conselho Superior, você pode apresentar razões escritas ou documentos.' }),
                A.fazer('Remeter ao Conselho Superior com o inteiro teor do termo', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Homologação pelo Conselho Superior', unidade: 'Conselho Superior', vai: ['Publicidade do termo', 'Negociação'], nome_publico: 'Homologação',
            ao_entrar: { pendencia: 'Deliberar sobre o arquivamento com compromisso de ajustamento.' },
            orientacao: 'O colegiado aprecia o arquivamento e o termo. Homologado, o termo é publicado e o cumprimento passa a ser acompanhado. Recusada a homologação, o termo é revisto em nova negociação, sem prejuízo de o colegiado determinar o prosseguimento do procedimento de origem.',
            acoes: [
                A.julgamento('Deliberação', ['Homologa', 'Não homologa'], {}, { obrigatoria: true }),
                A.documento('Juntar a decisão do colegiado', 'Decisão', { forma: 'juntar' }),
            ],
            saidas: { 'Publicidade do termo': quando('Deliberação', 'Homologa'), 'Negociação': quando('Deliberação', 'Não homologa') },
        },
        {
            nome: 'Publicidade do termo', unidade: 'Secretaria', prazo_dias: 15, prazo_auto: true, prazo_contagem: corridos, avanco: 'auto', vai: ['Acompanhamento do cumprimento'],
            orientacao: 'Publique o extrato em 15 dias, com procedimento, órgão, área, partes, objeto e o endereço do inteiro teor (Res. CNMP 179/2017, art. 7º). Garanta a transmissão ao Portal de Direitos Difusos e Coletivos pelo sistema (art. 8º, redação da Res. CNMP 326/2026).',
            acoes: [
                A.fazer('Publicar o extrato do termo', { obrigatoria: true }),
                A.fazer('Conferir a transmissão ao Portal de Direitos Difusos e Coletivos', { obrigatoria: true }),
                A.fazer('Instaurar o procedimento administrativo de acompanhamento', { ajuda: 'A fiscalização pode correr nestes autos ou em procedimento administrativo próprio (Res. CNMP 179/2017, art. 10).' }),
            ],
        },
        {
            nome: 'Acompanhamento do cumprimento', unidade: 'Gabinete', prazo_dias: 365, prazo_auto: true, prazo_contagem: corridos, vai: ['Pedido de informações ao compromissário', 'Descumprimento', 'Arquivamento do acompanhamento'],
            orientacao: 'Fiscalize o cumprimento, com apoio técnico quando preciso, e cobre os relatórios periódicos previstos no termo (Res. CNMP 179/2017, art. 9º). Obrigação só de não fazer: aguarde 3 meses antes de arquivar; obrigação de fazer sem prazo: aguarde a estabilidade do cumprimento (Provimento 71/2017-PGJ, arts. 43, § 4º, e 45). Prazo de 1 ano, prorrogável (Res. CNMP 174/2017, art. 11).',
            acoes: [
                A.fazer('Verificar os relatórios e as vistorias de cumprimento'),
                A.audiencia('Designar vistoria, se houver', 'inspecao'),
                A.documento('Juntar laudos, relatórios e comprovantes', '', { forma: 'juntar', nivel: 'recomendado' }),
                A.escolha('Situação do cumprimento', ['Pedir informações ao compromissário', 'Descumprimento constatado', 'Todas as obrigações cumpridas'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Pedido de informações ao compromissário': quando('Situação do cumprimento', 'Pedir informações ao compromissário'),
                'Descumprimento': quando('Situação do cumprimento', 'Descumprimento constatado'),
                'Arquivamento do acompanhamento': quando('Situação do cumprimento', 'Todas as obrigações cumpridas'),
            },
        },
        {
            nome: 'Pedido de informações ao compromissário', unidade: 'Secretaria', espera: true, avanco: 'auto', nome_publico: 'Aguardando informações',
            orientacao: 'Peça ao compromissário a comprovação do cumprimento. Com a resposta ou o fim do prazo, o processo volta ao acompanhamento.',
            acoes: [
                A.comunicar('Pedir a comprovação do cumprimento', { especie: 'notificacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Comprove, no prazo indicado, o cumprimento das obrigações do compromisso de ajustamento de conduta indicadas a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a comprovação', 'Pedir a comprovação do cumprimento', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Descumprimento', unidade: 'Gabinete', vai: ['Execução judicial', 'Repactuação', 'Acompanhamento do cumprimento'],
            orientacao: 'Inste o compromissário a justificar. Execute o título em até 60 dias, ou de imediato se urgente; o prazo pode ser excedido se ele justificar ou reafirmar o cumprimento, e então cabe executar, repactuar ou seguir acompanhando, sem prejuízo da multa (Res. CNMP 179/2017, art. 11).',
            acoes: [
                A.comunicar('Instar o compromissário a justificar', { especie: 'notificacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Foi constatado o descumprimento das obrigações indicadas a seguir. Justifique ou comprove o cumprimento no prazo indicado.' }, { obrigatoria: true }),
                A.esperar('Aguardar a justificativa', 'Instar o compromissário a justificar', { obrigatoria: true }),
                A.escolha('Providência', ['Executar o termo', 'Repactuar', 'Seguir acompanhando'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Execução judicial': quando('Providência', 'Executar o termo'), 'Repactuação': quando('Providência', 'Repactuar'), 'Acompanhamento do cumprimento': quando('Providência', 'Seguir acompanhando') },
        },
        {
            nome: 'Repactuação', unidade: 'Gabinete', vai: ['Acompanhamento do cumprimento'],
            orientacao: 'Altere as cláusulas por termo aditivo e envie cópia ao Conselho Superior (no MPRS, Provimento 71/2017-PGJ, art. 43, § 10). O acompanhamento recomeça com os novos prazos.',
            acoes: [
                A.documento('Termo aditivo', 'Termo aditivo', { forma: 'redigir' }),
                A.fazer('Enviar cópia do aditivo ao Conselho Superior', { obrigatoria: true }),
                A.comunicar('Entregar cópia do aditivo ao compromissário', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Segue cópia do termo aditivo ao compromisso de ajustamento de conduta.' }),
            ],
        },
        {
            nome: 'Execução judicial', unidade: 'Gabinete', vai: ['Encerramento com execução'],
            orientacao: 'Ajuíze a execução do título extrajudicial quanto às cláusulas em mora (Res. CNMP 179/2017, art. 11). Se a execução não abranger todas as obrigações, siga acompanhando as demais em procedimento próprio (Provimento 71/2017-PGJ, art. 44, § 2º).',
            acoes: [
                A.documento('Juntar a petição de execução', 'Petição inicial', { forma: 'juntar' }),
                A.texto('Número do processo de execução', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Arquivamento do acompanhamento', unidade: 'Secretaria', avanco: 'auto', vai: ['Recurso do arquivamento', 'Arquivamento'], padrao: 'Arquivamento',
            orientacao: 'Cumprido o termo, promova fundamentadamente o arquivamento e cientifique o compromissário e, a seu critério, os interessados, que podem recorrer em 10 dias. Sem recurso, arquive no órgão e comunique o Conselho Superior (Provimento 71/2017-PGJ, art. 43, §§ 5º a 7º).',
            acoes: [
                A.documento('Promoção de arquivamento do acompanhamento', 'Promoção de arquivamento', { forma: 'redigir' }),
                A.comunicar('Dar ciência do arquivamento', { especie: 'ciencia', polos: ['requerido', 'interessado'], dias: 10, contagem: corridos, texto: 'O acompanhamento do compromisso de ajustamento de conduta foi arquivado porque as obrigações foram cumpridas. Cabe recurso em 10 dias, protocolado neste órgão.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Dar ciência do arquivamento', { obrigatoria: true }),
            ],
            saidas: { 'Recurso do arquivamento': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial') },
        },
        {
            nome: 'Recurso do arquivamento', unidade: 'Conselho Superior', vai: ['Arquivamento', 'Acompanhamento do cumprimento'], nome_publico: 'Julgamento do recurso',
            orientacao: 'O recurso é remetido ao Conselho Superior em 3 dias com os autos (Provimento 71/2017-PGJ, art. 43, § 6º). O colegiado mantém o arquivamento ou nega a homologação e indica as medidas para comprovar o cumprimento (art. 43, § 9º).',
            acoes: [
                A.fazer('Remeter o recurso e os autos em 3 dias', { obrigatoria: true }),
                A.julgamento('Deliberação', ['Mantém o arquivamento', 'Determina novas medidas de comprovação'], {}, { obrigatoria: true }),
                A.documento('Juntar a decisão do colegiado', 'Decisão', { forma: 'juntar' }),
            ],
            saidas: { 'Arquivamento': quando('Deliberação', 'Mantém o arquivamento'), 'Acompanhamento do cumprimento': quando('Deliberação', 'Determina novas medidas de comprovação') },
        },
        { nome: 'Encerramento sem acordo', unidade: 'Gabinete', final: true, orientacao: 'Sem acordo, o procedimento de origem prossegue com ação civil pública, recomendação ou arquivamento, no rito próprio. Registre lá o resultado da tentativa.' },
        { nome: 'Encerramento com execução', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Proposta a execução, o acompanhamento se encerra; não é preciso remeter os autos ao Conselho Superior depois da execução (Provimento 71/2017-PGJ, art. 44, § 2º).' },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, no próprio órgão, com comunicação ao Conselho Superior e informação sobre eventual recurso (Provimento 71/2017-PGJ, art. 43, § 7º).' },
    ]);
}

/** 2. Recomendação (Res. CNMP 164/2017). */
export function recomendacaoMp() {
    return montar({
        id: 'recomendacao-mp', nome: 'Recomendação do Ministério Público', area: 'ministerio_publico', porte: 'curto', referencia: 'CNMP',
        descricao: 'Ato formal e fundamentado pelo qual o membro expõe ao destinatário as razões de fato e de direito e recomenda que faça ou deixe de fazer algo, sem caráter coercitivo. Antes de recomendar à autoridade pública, requisitam-se informações, salvo impossibilidade motivada; em urgência, expede-se e instaura-se o procedimento depois. A recomendação indica as providências, o prazo razoável e, se quiser, as medidas cabíveis em caso de desatendimento. O destinatário responde por escrito; a resposta de não atendimento é apreciada de forma fundamentada. Acatada, acompanha-se o cumprimento; desatendida ou sem resposta, o membro adota as medidas cabíveis, como ação, ajustamento de conduta ou instauração de procedimento.',
        quando: 'Dentro de inquérito civil, procedimento preparatório ou procedimento administrativo, quando persuadir o destinatário pode evitar a ação judicial. Ajuste o prazo de resposta ao caso.',
        base: 'Res. CNMP 164/2017, arts. 1º (natureza), 3º (cabimento, informações prévias e urgência), 4º (destinatário e encaminhamento pelo Procurador-Geral em 10 dias), 5º e 6º (relação com a ação judicial), 7º e 8º (fundamentação e prazo), 9º (divulgação), 10 (resposta) e 11 (medidas); no MPRS, Provimento 71/2017-PGJ, arts. 48, parágrafo único, e 56 a 64.',
        tipo: { polos: ['requerido', 'interessado'], nomes_polos: { requerido: 'Destinatário', interessado: 'Interessado' } },
    }, [
        {
            nome: 'Preparação', unidade: 'Gabinete', vai: ['Informações prévias', 'Expedição e prazo de resposta'],
            orientacao: 'Indique o procedimento em que a recomendação será expedida (art. 3º). Dirija-a a quem tem poder para adotar as medidas (art. 4º, § 1º). Não recomende o mesmo pedido de ação judicial já proposta contra as mesmas partes, salvo motivo excepcional (art. 5º). À autoridade pública, requisite antes as informações sobre o caso, salvo impossibilidade motivada (art. 3º, § 1º).',
            acoes: [
                A.formulario('Dados da recomendação', [
                    { id: 'procedimento', rotulo: 'Número do procedimento de origem', tipo: 'texto', obrigatorio: false },
                    { id: 'destinatario', rotulo: 'Destinatário', tipo: 'texto', obrigatorio: true },
                    { id: 'natureza', rotulo: 'Destinatário é', tipo: 'lista', obrigatorio: true, opcoes: ['Autoridade ou órgão público', 'Pessoa jurídica de direito privado', 'Pessoa física'] },
                    { id: 'objeto', rotulo: 'Medidas a recomendar', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.simNao('Caso urgente, sem procedimento instaurado?', { obrigatoria: true, ajuda: 'Na urgência, expeça de ofício e instaure o procedimento logo depois (art. 3º, § 2º).' }),
                A.simNao('Requisitar informações prévias ao destinatário?', { obrigatoria: true, ajuda: 'Obrigatório antes de recomendar à autoridade pública, salvo impossibilidade motivada (art. 3º, § 1º).' }),
                A.documento('Despacho que motiva a dispensa das informações', 'Despacho', { forma: 'redigir', se: quando('Requisitar informações prévias ao destinatário?', 'nao') }),
            ],
            saidas: { 'Informações prévias': quando('Requisitar informações prévias ao destinatário?', 'sim'), 'Expedição e prazo de resposta': quando('Requisitar informações prévias ao destinatário?', 'nao') },
        },
        {
            nome: 'Informações prévias', unidade: 'Secretaria', avanco: 'auto', vai: ['Expedição e prazo de resposta'], nome_publico: 'Aguardando informações',
            orientacao: 'Requisite ao destinatário as informações sobre a situação jurídica e o caso concreto (art. 3º, § 1º). Com a resposta ou o fim do prazo, siga para a expedição.',
            acoes: [
                A.comunicar('Requisitar informações ao destinatário', { especie: 'notificacao', polos: ['requerido'], dias: 10, texto: 'Encaminhe, no prazo indicado, as informações sobre a situação descrita a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar as informações', 'Requisitar informações ao destinatário', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Expedição e prazo de resposta', unidade: 'Gabinete', vai: ['Apreciação da resposta', 'Providências'], nome_publico: 'Recomendação expedida',
            orientacao: 'Fundamente com os argumentos de fato e de direito (art. 7º), indique as providências de forma clara e um prazo razoável (art. 8º) e, se quiser, as medidas cabíveis em caso de desatendimento, que só podem ser adotadas depois do prazo, salvo fato novo urgente (art. 11, §§ 1º e 2º). Para autoridades cuja correspondência passa pelo Procurador-Geral, ele encaminha em 10 dias (art. 4º, § 2º).',
            acoes: [
                A.documento('Recomendação', 'Recomendação', { forma: 'redigir' }),
                A.simNao('O destinatário exige encaminhamento pelo Procurador-Geral?', { obrigatoria: true }),
                A.fazer('Enviar ao Procurador-Geral para encaminhamento em 10 dias', { se: quando('O destinatário exige encaminhamento pelo Procurador-Geral?', 'sim') }),
                A.simNao('Requisitar a divulgação da recomendação?', { ajuda: 'Inclusive afixação em local de fácil acesso ao público, se necessária à efetividade (art. 9º).' }),
                A.comunicar('Notificar o destinatário da recomendação', { especie: 'notificacao', polos: ['requerido'], dias: 30, texto: 'Fica notificado da recomendação anexa. Informe por escrito, no prazo indicado, se a atende e quais providências adotou, de modo fundamentado.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta', 'Notificar o destinatário da recomendação', { obrigatoria: true }),
            ],
            saidas: { 'Apreciação da resposta': quando('Aguardar a resposta', 'Apresentada', 'Parcial'), 'Providências': quando('Aguardar a resposta', 'Sem manifestação') },
        },
        {
            nome: 'Apreciação da resposta', unidade: 'Gabinete', vai: ['Acompanhamento do atendimento', 'Providências'],
            orientacao: 'Aprecie a resposta de forma fundamentada, sobretudo a de não atendimento, ainda que não requisitada; a adoção das medidas indicadas pressupõe essa apreciação (art. 10, parágrafo único, e art. 11, § 3º).',
            acoes: [
                A.escolha('A recomendação foi', ['Atendida', 'Atendida em parte', 'Não atendida'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Despacho de apreciação da resposta', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: { 'Acompanhamento do atendimento': quando('A recomendação foi', 'Atendida'), 'Providências': quando('A recomendação foi', 'Atendida em parte', 'Não atendida') },
        },
        {
            nome: 'Acompanhamento do atendimento', unidade: 'Gabinete', vai: ['Recomendação atendida', 'Providências'],
            orientacao: 'O atendimento é apurado nos autos em que a recomendação foi expedida (art. 8º, parágrafo único); no MPRS, pode-se instaurar procedimento administrativo próprio (Provimento 71/2017-PGJ, art. 48, parágrafo único).',
            acoes: [
                A.fazer('Verificar a implementação das medidas'),
                A.simNao('As medidas foram implementadas?', { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Recomendação atendida': quando('As medidas foram implementadas?', 'sim'), 'Providências': quando('As medidas foram implementadas?', 'nao') },
        },
        {
            nome: 'Providências', unidade: 'Gabinete', vai: ['Encerramento com providências'],
            orientacao: 'Desatendida, sem resposta ou com resposta inconsistente, adote as medidas cabíveis para obter o resultado pretendido (art. 11). Registre a medida e siga no rito próprio.',
            acoes: [
                A.escolha('Medida adotada', ['Ajuizar ação civil pública', 'Propor ajustamento de conduta', 'Instaurar ou prosseguir procedimento', 'Promover o arquivamento'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Despacho com a medida adotada', 'Despacho', { forma: 'redigir' }),
                A.comunicar('Comunicar a medida ao destinatário', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Fica comunicado da medida adotada após o prazo da recomendação.' }),
            ],
        },
        { nome: 'Recomendação atendida', unidade: 'Secretaria', final: true, orientacao: 'Registre o atendimento nos autos de origem; a recomendação produziu o efeito pretendido.' },
        { nome: 'Encerramento com providências', unidade: 'Secretaria', final: true, orientacao: 'A medida segue no rito próprio (ação, ajustamento de conduta ou procedimento), vinculado a este processo.' },
    ]);
}

/** 3. Audiência pública (Res. CNMP 82/2012, com as Res. 159/2017 e 207/2020). */
export function audienciaPublicaMp() {
    return montar({
        id: 'audiencia-publica-mp', nome: 'Audiência pública do Ministério Público', area: 'ministerio_publico', porte: 'curto', referencia: 'CNMP',
        descricao: 'Reunião organizada e aberta a qualquer cidadão e a representantes do poder público, da sociedade civil e da comunidade, para colher elementos sobre situação que lese ou possa lesar direitos difusos, coletivos ou individuais homogêneos, ou para prestar contas da atuação. É autuada e começa por edital com data, hora, local, objetivo, cadastro de expositores e forma de participação, publicado no sítio e afixado na sede com 3 dias úteis de antecedência, salvo urgência motivada; outros membros com atribuição são avisados no mesmo prazo. Realizada a audiência, lavra-se ata circunstanciada em 30 dias, publicada por extrato, e o membro produz relatório com as providências, como arquivamento, ajustamento de conduta, recomendação, instauração de procedimento ou ação civil pública. As manifestações são consultivas e não vinculam.',
        quando: 'Para ouvir a sociedade num inquérito civil, procedimento ou negociação de ajustamento, identificar demandas sociais, elaborar planos de ação ou prestar contas.',
        base: 'Res. CNMP 82/2012, arts. 1º (finalidade, autuação), 2º (edital), 3º (publicidade com 3 dias úteis, redação da Res. 207/2020), 4º (ata em 30 dias e extrato), 5º (aviso a outros membros), 6º (relatório) e 7º (caráter consultivo); Res. CNMP 179/2017, art. 1º, § 4º.',
        tipo: { polos: ['interessado'], nomes_polos: { interessado: 'Participante inscrito' } },
    }, [
        {
            nome: 'Proposta e autuação', unidade: 'Gabinete',
            orientacao: 'Autue e registre a audiência no sistema (art. 1º, § 4º). Defina o objetivo, o procedimento a que se vincula e a forma de participação. O custeio por entidade pública exige termo de cooperação e prestação de contas (art. 1º, § 2º).',
            acoes: [
                A.formulario('Dados da audiência', [
                    { id: 'objetivo', rotulo: 'Objetivo da audiência', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'finalidade', rotulo: 'Finalidade', tipo: 'lista', obrigatorio: true, opcoes: ['Instruir procedimento', 'Identificar demanda social', 'Plano de ação ou projeto institucional', 'Prestação de contas'] },
                    { id: 'procedimento', rotulo: 'Número do procedimento vinculado', tipo: 'texto', obrigatorio: false },
                    { id: 'local', rotulo: 'Local ou meio virtual', tipo: 'texto', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Despacho que designa a audiência', 'Despacho', { forma: 'redigir' }),
            ],
            vai: ['Convocação'],
        },
        {
            nome: 'Convocação', unidade: 'Secretaria', vai: ['Realização'], nome_publico: 'Convocação da audiência',
            orientacao: 'O edital traz data, hora, local, objetivo, forma de cadastro dos expositores e de participação (art. 2º). Publique no sítio e afixe na sede com pelo menos 3 dias úteis de antecedência, salvo urgência motivada; Diário Oficial e redes sociais são facultativos (art. 3º). Avise com igual antecedência os outros membros com atribuição, podendo a audiência ser conjunta (art. 5º).',
            acoes: [
                A.audiencia('Designar a audiência pública', 'audiencia'),
                A.documento('Edital de convocação', 'Edital', { forma: 'redigir' }),
                A.fazer('Publicar o edital no sítio e afixar na sede', { obrigatoria: true }),
                A.fazer('Avisar os outros membros com atribuição'),
                A.comunicar('Convidar entidades e interessados', { especie: 'comunicacao', polos: ['interessado'], dias: 0, texto: 'Você está convidado para a audiência pública em {audiencia}. O edital com o objetivo e a forma de participação segue anexo.' }),
                A.fazer('Cadastrar os expositores inscritos'),
            ],
        },
        {
            nome: 'Realização', unidade: 'Gabinete', vai: ['Ata'],
            orientacao: 'Conduza a reunião conforme o edital, com lista de presença. Gravada em imagem e áudio, a ata pode ser sintética (art. 4º, § 3º). As manifestações são consultivas e não vinculam (art. 7º).',
            acoes: [
                A.fazer('Realizar a audiência e colher a lista de presença', { obrigatoria: true }),
                A.simNao('A audiência foi gravada em imagem e áudio?', { obrigatoria: true }),
                A.documento('Juntar a gravação', 'Gravação', { forma: 'juntar', se: quando('A audiência foi gravada em imagem e áudio?', 'sim') }),
                A.documento('Juntar documentos e contribuições recebidos', '', { forma: 'juntar', nivel: 'opcional' }),
            ],
        },
        {
            nome: 'Ata', unidade: 'Secretaria', prazo_dias: 30, prazo_auto: true, vai: ['Relatório e providências'],
            orientacao: 'Lavre a ata circunstanciada em 30 dias da realização, com o encaminhamento que será dado ao tema (art. 4º; prazo em dias: conferir na norma vigente a forma de contagem). Publique o extrato da ata no sítio (art. 4º, § 2º).',
            acoes: [
                A.documento('Ata da audiência pública', 'Ata', { forma: 'redigir' }),
                A.fazer('Publicar o extrato da ata no sítio', { obrigatoria: true }),
                A.comunicar('Enviar o extrato da ata aos inscritos', { especie: 'comunicacao', polos: ['interessado'], dias: 0, texto: 'Segue o extrato da ata da audiência pública de que você participou.' }),
            ],
        },
        {
            nome: 'Relatório e providências', unidade: 'Gabinete', vai: ['Encerramento'],
            orientacao: 'Ao fim dos trabalhos, produza relatório com as providências; sem providência imediata, a ata o substitui (art. 6º, redação da Res. CNMP 207/2020). Providências possíveis: arquivamento, ajustamento de conduta, recomendação, instauração de procedimento, ação civil pública, divulgação de conclusões, prestação de contas ou plano de ação.',
            acoes: [
                A.simNao('Há providências imediatas a adotar?', { obrigatoria: true }),
                A.documento('Relatório da audiência pública', 'Relatório', { forma: 'redigir', se: quando('Há providências imediatas a adotar?', 'sim') }),
                A.escolha('Providência principal', ['Arquivamento', 'Ajustamento de conduta', 'Recomendação', 'Instauração de procedimento', 'Ação civil pública', 'Divulgação de conclusões', 'Prestação de contas ou plano de ação'], { obrigatoria: true, destino: 'autos', se: quando('Há providências imediatas a adotar?', 'sim') }),
            ],
        },
        { nome: 'Encerramento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Junte cópia da ata e do relatório ao procedimento vinculado e encerre. As providências seguem no rito próprio.' },
    ]);
}

/** 4. Revisão de arquivamento pelo Conselho Superior do MPRS (Lei 7.347/1985, art. 9º; RI do CSMP-RS, art. 38). */
export function revisaoArquivamentoCsmp() {
    return montar({
        id: 'revisao-arquivamento-csmp', nome: 'Revisão de arquivamento pelo Conselho Superior (MPRS)', area: 'ministerio_publico', porte: 'medio', referencia: 'MPRS',
        descricao: 'Rito do próprio Conselho Superior do Ministério Público do Rio Grande do Sul para os expedientes que lhe chegam das Promotorias: promoção de arquivamento de inquérito civil ou procedimento preparatório, inclusive após ajustamento de conduta, declínio de atribuição e recurso contra arquivamento de notícia de fato ou procedimento administrativo. A Secretaria dos Órgãos Colegiados confere e devolve o que estiver irregular; o relator instrui, pode baixar os autos em diligência, requisitar informações e, havendo recurso de interessado, ouve o órgão que arquivou em 5 dias. Publica-se aviso no Diário Eletrônico, as associações legitimadas apresentam razões até 3 dias antes da sessão e a pauta sai com 48 horas. O colegiado, em sessão pública, homologa, converte em diligência ou rejeita; rejeitado o arquivamento, o Procurador-Geral designa outro membro para propor ajustamento ou ação. Não cabe recurso. Difere das fases de revisão dos outros ritos por ser o processo do colegiado.',
        quando: 'Na Secretaria dos Órgãos Colegiados e nos gabinetes dos conselheiros, para cada expediente remetido ao Conselho Superior. Outros Ministérios Públicos devem ajustar prazos e unidades ao seu regimento.',
        base: 'Lei 7.347/1985, art. 9º, §§ 1º a 4º; Res. CNMP 23/2007, art. 10; Provimento 71/2017-PGJ (MPRS), arts. 5º, §§ 4º e 6º, 10, § 3º, 22, 24 a 30, 33, 43, 55, 67 e 70; Regimento Interno do CSMP-RS, arts. 4º (homologação), 12, § 4º (pauta com 48 horas), 16 (relator e sessão), 38 (aviso, diligências, homologação e designação) e 40 (sem recurso).',
        tipo: { polos: ['requerente', 'requerido', 'interessado'], nomes_polos: { requerente: 'Representante ou recorrente', requerido: 'Investigado', interessado: 'Interessado' } },
    }, [
        {
            nome: 'Recebimento e conferência', unidade: 'Secretaria dos Órgãos Colegiados', vai: ['Distribuição ao relator', 'Devolução ao órgão de execução'], nome_publico: 'Recebimento no Conselho Superior',
            orientacao: 'Confira se a remessa veio em 3 dias da cientificação comprovada dos interessados (Provimento 71/2017-PGJ, art. 22, § 1º) e se está conforme o provimento; o que não estiver é devolvido por despacho no sistema (art. 25). Autos não remetidos no prazo podem ser requisitados, com comunicação à Corregedoria-Geral (art. 28).',
            acoes: [
                A.formulario('Dados do expediente', [
                    { id: 'tipo', rotulo: 'Tipo de expediente', tipo: 'lista', obrigatorio: true, opcoes: ['Arquivamento de inquérito civil', 'Arquivamento de procedimento preparatório', 'Arquivamento após ajustamento de conduta', 'Declínio de atribuição', 'Recurso contra arquivamento de notícia de fato', 'Recurso contra arquivamento de procedimento administrativo', 'Arquivamento de notícia de fato em patrimônio público'] },
                    { id: 'numero', rotulo: 'Número do procedimento', tipo: 'texto', obrigatorio: true },
                    { id: 'orgao', rotulo: 'Órgão de execução', tipo: 'texto', obrigatorio: true },
                    { id: 'data_ciencia', rotulo: 'Data da última cientificação dos interessados', tipo: 'data', obrigatorio: false },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.simNao('O expediente está em ordem?', { obrigatoria: true }),
                A.documento('Despacho de devolução', 'Despacho', { forma: 'redigir', se: quando('O expediente está em ordem?', 'nao') }),
            ],
            saidas: { 'Distribuição ao relator': quando('O expediente está em ordem?', 'sim'), 'Devolução ao órgão de execução': quando('O expediente está em ordem?', 'nao') },
        },
        {
            nome: 'Distribuição ao relator', unidade: 'Secretaria dos Órgãos Colegiados', avanco: 'auto', vai: ['Instrução pelo relator'],
            orientacao: 'Distribua o expediente a um conselheiro relator, conforme o regimento (Regimento Interno do CSMP-RS, art. 38).',
            acoes: [A.texto('Conselheiro relator', { obrigatoria: true, destino: 'autos' })],
        },
        {
            nome: 'Instrução pelo relator', unidade: 'Gabinete do relator', vai: ['Diligências no órgão de execução', 'Esclarecimentos do órgão de execução', 'Aviso e pauta'],
            orientacao: 'O relator resolve incidentes e determina diligências (RI, art. 16, § 1º). Pode baixar os autos ao membro que arquivou para atos imprescindíveis, especificando-os, e requisitar certidões, informações ou perícias com prazo não inferior a 10 dias úteis (RI, art. 38, § 2º). Havendo recurso ou razões de interessado, ouça o órgão que arquivou (Provimento 71/2017-PGJ, art. 29, § 2º).',
            acoes: [
                A.simNao('Há recurso ou razões de interessado?', { obrigatoria: true, ajuda: 'Qualquer interessado pode recorrer em 10 dias da cientificação da promoção de arquivamento (Provimento 71/2017-PGJ, art. 29, § 1º).' }),
                A.fazer('Requisitar certidões, informações ou perícias, se preciso', { ajuda: 'Prazo não inferior a 10 dias úteis (RI, art. 38, § 2º, b).' }),
                A.escolha('Próximo passo', ['Baixar em diligência', 'Ouvir o órgão de execução sobre o recurso', 'Pautar para julgamento'], { obrigatoria: true }),
            ],
            saidas: {
                'Diligências no órgão de execução': quando('Próximo passo', 'Baixar em diligência'),
                'Esclarecimentos do órgão de execução': quando('Próximo passo', 'Ouvir o órgão de execução sobre o recurso'),
                'Aviso e pauta': quando('Próximo passo', 'Pautar para julgamento'),
            },
        },
        {
            nome: 'Diligências no órgão de execução', unidade: 'Promotoria de Justiça', vai: ['Instrução pelo relator'],
            orientacao: 'O membro que promoveu o arquivamento realiza os atos especificados pelo relator ou pelo colegiado e devolve os autos (Provimento 71/2017-PGJ, art. 29, II). Sobrevindo fato novo, ele pode pedir o retorno dos autos ou instaurar outro procedimento (art. 24, parágrafo único).',
            acoes: [
                A.fazer('Remeter os autos com os atos a realizar', { obrigatoria: true }),
                A.documento('Juntar o resultado das diligências', '', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Esclarecimentos do órgão de execução', unidade: 'Promotoria de Justiça', prazo_dias: 5, prazo_auto: true, prazo_contagem: corridos, vai: ['Instrução pelo relator', 'Retorno para prosseguimento'],
            orientacao: 'Dê ciência das razões e documentos ao órgão que promoveu o arquivamento, que em 5 dias pode esclarecer ou pedir o retorno dos autos para prosseguir a investigação (Provimento 71/2017-PGJ, art. 29, § 2º; prazos corridos, art. 70).',
            acoes: [
                A.fazer('Dar ciência das razões ao órgão de execução', { obrigatoria: true }),
                A.escolha('Manifestação do órgão', ['Prestou esclarecimentos', 'Pediu o retorno para prosseguir', 'Sem manifestação'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Retorno para prosseguimento': quando('Manifestação do órgão', 'Pediu o retorno para prosseguir'), 'Instrução pelo relator': quando('Manifestação do órgão', 'Prestou esclarecimentos', 'Sem manifestação') },
        },
        {
            nome: 'Aviso e pauta', unidade: 'Secretaria dos Órgãos Colegiados', vai: ['Sessão de julgamento'], nome_publico: 'Pauta da sessão',
            orientacao: 'Publique aviso no Diário Eletrônico com a data da sessão, os números dos procedimentos por tipo de pauta e o órgão de execução; as associações legitimadas podem apresentar razões ou documentos até 3 dias da sessão (RI, art. 38, § 1º; Lei 7.347/1985, art. 9º, § 2º). Divulgue a pauta com 48 horas de antecedência (RI, art. 12, § 4º).',
            acoes: [
                A.audiencia('Designar a sessão de julgamento', 'sessao'),
                A.fazer('Publicar o aviso no Diário Eletrônico', { obrigatoria: true }),
                A.fazer('Divulgar a pauta com 48 horas de antecedência', { obrigatoria: true }),
                A.comunicar('Comunicar a pauta às partes', { especie: 'comunicacao', dias: 0, texto: 'O procedimento será apreciado pelo Conselho Superior na sessão de {audiencia}. Associações legitimadas podem apresentar razões escritas ou documentos até 3 dias antes.' }),
                A.documento('Juntar razões e documentos recebidos', '', { forma: 'juntar', nivel: 'opcional' }),
            ],
        },
        {
            nome: 'Sessão de julgamento', unidade: 'Conselho Superior', vai: ['Publicação e baixa', 'Diligências no órgão de execução', 'Designação de outro membro'], padrao: 'Publicação e baixa', nome_publico: 'Julgamento',
            ao_entrar: { pendencia: 'Relatar, discutir e votar o expediente em sessão.' },
            orientacao: 'A sessão é pública, salvo sigilo decretado (Provimento 71/2017-PGJ, art. 29, § 3º). Feito o relatório, há esclarecimentos e discussão, votam o relator e os demais conselheiros; pedido de vista adia para a sessão seguinte (RI, art. 16, §§ 4º a 7º). O colegiado homologa, converte em diligência ou rejeita (art. 29, II e III). Não cabe recurso nem reconsideração (RI, art. 40). Com o colegiado cadastrado, a secretaria inclui o expediente na pauta da aba Sessões: relator, votos, vista, proclamação, acórdão e ata correm lá, e o resultado proclamado cumpre esta ação.',
            acoes: [
                A.julgamento('Resultado', ['Homologa', 'Converte em diligência', 'Rejeita e prossegue com outro membro'], {}, { obrigatoria: true }),
                A.documento('Juntar a decisão e o extrato da ata', 'Decisão', { forma: 'juntar' }),
                A.textoLongo('Recomendações ao órgão de execução, se houver', { ajuda: 'O colegiado pode emitir recomendações ao órgão de execução (RI, art. 4º).' }),
            ],
            saidas: {
                'Diligências no órgão de execução': quando('Resultado', 'Converte em diligência'),
                'Designação de outro membro': quando('Resultado', 'Rejeita e prossegue com outro membro'),
            },
        },
        {
            nome: 'Publicação e baixa', unidade: 'Secretaria dos Órgãos Colegiados', vai: ['Arquivamento homologado'],
            orientacao: 'Aprovada a ata, publique a ementa no Diário Eletrônico e cientifique eletronicamente o órgão de execução; os autos vão à Unidade de Gestão Documental (Provimento 71/2017-PGJ, arts. 30 e 33; RI, art. 38, § 4º). Homologado declínio de atribuição, o próprio Conselho remete os autos ao Ministério Público destinatário (art. 67).',
            acoes: [
                A.fazer('Publicar a ementa no Diário Eletrônico', { obrigatoria: true }),
                A.fazer('Cientificar o órgão de execução', { obrigatoria: true }),
                A.simNao('Foi homologado declínio de atribuição?', { obrigatoria: true }),
                A.fazer('Remeter os autos ao Ministério Público destinatário', { se: quando('Foi homologado declínio de atribuição?', 'sim') }),
                A.comunicar('Comunicar a decisão às partes', { especie: 'comunicacao', dias: 0, texto: 'O Conselho Superior homologou a decisão do órgão de execução neste procedimento.' }),
            ],
        },
        {
            nome: 'Designação de outro membro', unidade: 'Secretaria dos Órgãos Colegiados', vai: ['Prosseguimento por outro membro'],
            orientacao: 'Rejeitado o arquivamento, informe de imediato o Procurador-Geral de Justiça para designar outro membro, que proporá ajustamento de conduta, expedirá recomendação ou ajuizará a ação (RI, art. 38, § 6º; Provimento 71/2017-PGJ, art. 29, III; Lei 7.347/1985, art. 9º, § 4º).',
            acoes: [
                A.fazer('Informar o Procurador-Geral de Justiça', { obrigatoria: true }),
                A.texto('Membro designado', { obrigatoria: true, destino: 'autos' }),
                A.comunicar('Comunicar a decisão às partes', { especie: 'comunicacao', dias: 0, texto: 'O Conselho Superior rejeitou o arquivamento e o procedimento prosseguirá com outro membro do Ministério Público.' }),
            ],
        },
        { nome: 'Devolução ao órgão de execução', unidade: 'Secretaria dos Órgãos Colegiados', final: true, orientacao: 'Expediente devolvido por despacho no sistema para regularização (Provimento 71/2017-PGJ, art. 25). Reenviado, abre-se nova revisão.' },
        { nome: 'Retorno para prosseguimento', unidade: 'Secretaria dos Órgãos Colegiados', final: true, orientacao: 'Os autos voltam ao órgão de execução para prosseguir a investigação; nova promoção de arquivamento exigirá nova remessa (Provimento 71/2017-PGJ, art. 29, § 2º).' },
        { nome: 'Arquivamento homologado', unidade: 'Secretaria dos Órgãos Colegiados', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Novas provas ou fato novo relevante permitem desarquivar em até 6 meses; depois, instaura-se novo procedimento (Provimento 71/2017-PGJ, art. 31).' },
        { nome: 'Prosseguimento por outro membro', unidade: 'Secretaria dos Órgãos Colegiados', final: true, orientacao: 'Os autos seguem ao membro designado, que dá continuidade no rito de origem.' },
    ]);
}

/** 5-A. Destinação de bens e valores em tutela coletiva (MPRS, Provimento 69/2025-PGJ). */
export function destinacaoBensValoresMprs() {
    return montar({
        id: 'destinacao-bens-valores-mprs', nome: 'Destinação de bens e valores de tutela coletiva (MPRS)', area: 'ministerio_publico', porte: 'medio', referencia: 'MPRS',
        descricao: 'Destina os valores de compromisso de ajustamento, acordo de não persecução civil ou condenação em ação coletiva quando o membro não os envia ao Fundo para Reconstituição de Bens Lesados nem a outro fundo legal. O membro seleciona, por decisão fundamentada, entidade cadastrada, sem vedações, com pertinência temática e preferência pela comunidade atingida, alternando entre os cadastrados. Formaliza o termo de recebimento e, se a execução for continuada, o plano de trabalho; o membro nunca toca os valores. A entidade presta contas, em forma simplificada até 30 salários mínimos; com pendências, é chamada a sanar; reprovadas as contas ou sem prestação, o termo é rescindido, com devolução e exclusão do cadastro. Aprovadas as contas ou rescindido o termo, o procedimento vai ao Conselho Superior para homologação.',
        quando: 'Em procedimento com valores a destinar a projeto ou entidade no MPRS. Outros Ministérios Públicos devem seguir a Res. Conjunta CNJ/CNMP 10/2024 e o seu regulamento.',
        base: 'Res. Conjunta CNJ/CNMP 10/2024; Provimento 69/2025-PGJ (MPRS), arts. 1º, parágrafo único, 2º, § 2º (Defesa Civil), 4º e 7º (vedações), 6º (membro sem acesso aos valores), 8º a 10 (seleção, termo e plano de trabalho), 11 e 12 (prestação de contas), 14 (rescisão) e 15 (homologação), com alterações do Provimento 31/2026-PGJ; Provimento 71/2017-PGJ, art. 41; Res. CNMP 179/2017, art. 5º; Lei 7.347/1985, art. 13.',
        tipo: { polos: ['requerido', 'interessado'], nomes_polos: { requerido: 'Devedor ou compromissário', interessado: 'Entidade destinatária' } },
    }, [
        {
            nome: 'Origem e opção de destinação', unidade: 'Gabinete', vai: ['Seleção do destinatário', 'Destinação a fundo'],
            orientacao: 'Registre a origem e o valor. A destinação preferencial é o Fundo para Reconstituição de Bens Lesados ou outro fundo legal (Provimento 71/2017-PGJ, art. 41). Fora deles, siga obrigatoriamente o Provimento 69/2025-PGJ (art. 1º, parágrafo único). Medidas de recomposição do bem lesado preferem às indenizatórias (art. 8º).',
            acoes: [
                A.formulario('Dados dos recursos', [
                    { id: 'procedimento', rotulo: 'Número do procedimento de origem', tipo: 'texto', obrigatorio: true },
                    { id: 'instrumento', rotulo: 'Instrumento', tipo: 'lista', obrigatorio: true, opcoes: ['Compromisso de ajustamento de conduta', 'Acordo de não persecução civil', 'Decisão em ação coletiva', 'Outro acordo coletivo'] },
                    { id: 'valor', rotulo: 'Valor a destinar (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'bem', rotulo: 'Bem jurídico lesado e comunidade atingida', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.escolha('Destinação', ['Fundo para Reconstituição de Bens Lesados ou outro fundo legal', 'Entidade ou projeto pelo Provimento 69/2025-PGJ'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Destinação a fundo': quando('Destinação', 'Fundo para Reconstituição de Bens Lesados ou outro fundo legal'), 'Seleção do destinatário': quando('Destinação', 'Entidade ou projeto pelo Provimento 69/2025-PGJ') },
        },
        {
            nome: 'Seleção do destinatário', unidade: 'Gabinete', vai: ['Formalização'],
            orientacao: 'Escolha entidade cadastrada que preencha os requisitos, sem as vedações dos arts. 4º e 7º, alternando entre os cadastrados quando possível (art. 10). O valor é proporcional ao dano, beneficia de preferência os locais atingidos e guarda pertinência temática com o bem lesado, conforme a divisão dos Centros de Apoio (art. 9º). Terceiros interessados podem indicar destinatários (art. 8º, § 2º).',
            acoes: [
                A.fazer('Consultar o cadastro de entidades da região', { obrigatoria: true }),
                A.simNao('A entidade está cadastrada e sem vedações?', { obrigatoria: true, ajuda: 'A Defesa Civil recebe sem cadastro para auxílio às vítimas dos eventos climáticos de 2024 com calamidade reconhecida (art. 2º, § 2º).' }),
                A.texto('Entidade selecionada', { obrigatoria: true, destino: 'informacao' }),
                A.documento('Decisão fundamentada de destinação', 'Despacho', { forma: 'redigir', ajuda: 'Justifique o valor, o destinatário e a pertinência temática (arts. 9º, § 2º, e 10, § 1º).' }),
            ],
        },
        {
            nome: 'Formalização', unidade: 'Gabinete', vai: ['Execução e prestação de contas'], nome_publico: 'Termo de recebimento',
            orientacao: 'Formalize o termo de recebimento de bens e valores, conforme o Anexo III (art. 10, § 2º). Projeto de execução continuada exige também plano de trabalho (art. 10, § 3º). Os valores vão a conta única da entidade; é vedado ao membro ter acesso aos valores ou fazer pagamentos (arts. 6º e 11, II).',
            acoes: [
                A.documento('Termo de recebimento de bens e valores', 'Termo', { forma: 'redigir' }),
                A.simNao('O projeto tem execução continuada?', { obrigatoria: true }),
                A.documento('Plano de trabalho', 'Plano de trabalho', { forma: 'redigir', se: quando('O projeto tem execução continuada?', 'sim') }),
                A.simNao('A destinação total vai até 30 salários mínimos?', { obrigatoria: true, ajuda: 'Se sim, a prestação de contas é simplificada (art. 11, §§ 1º e 2º).' }),
                A.comunicar('Notificar a entidade para assinar o termo', { especie: 'notificacao', polos: ['interessado'], dias: 0, texto: 'A entidade foi selecionada para receber bens ou valores destinados à reparação de dano coletivo. Assine o termo anexo e informe a conta única para o depósito.' }, { obrigatoria: true }),
                A.fazer('Comunicar ao devedor a conta para o depósito', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Execução e prestação de contas', unidade: 'Secretaria', vai: ['Análise das contas', 'Rescisão do termo'], nome_publico: 'Prestação de contas',
            orientacao: 'A entidade presta contas com planilha, extrato da conta única, cotações, notas fiscais com o número do procedimento, comprovantes de entrega e relatório de resultados (art. 11). Contas simplificadas até 30 salários mínimos (art. 11, §§ 1º a 3º). São vedados saques em espécie, antecipações e reembolsos, salvo autorização (art. 12). O prazo segue o termo ou o plano de trabalho.',
            acoes: [
                A.comunicar('Intimar a entidade a prestar contas', { especie: 'intimacao', polos: ['interessado'], dias: 30, contagem: corridos, texto: 'Apresente a prestação de contas dos valores recebidos, com os documentos exigidos no termo de recebimento, no prazo indicado.' }, { obrigatoria: true, ajuda: 'Ajuste o prazo ao termo ou ao plano de trabalho.' }),
                A.esperar('Aguardar a prestação de contas', 'Intimar a entidade a prestar contas', { obrigatoria: true }),
            ],
            saidas: { 'Análise das contas': quando('Aguardar a prestação de contas', 'Apresentada', 'Parcial'), 'Rescisão do termo': quando('Aguardar a prestação de contas', 'Sem manifestação') },
        },
        {
            nome: 'Análise das contas', unidade: 'Gabinete', vai: ['Execução e prestação de contas', 'Rescisão do termo', 'Homologação pelo Conselho Superior'],
            orientacao: 'Confira a documentação; documento ilegível é tido como inexistente (art. 11, § 6º). Podem ser feitas diligências e exigidos outros documentos (art. 11, § 13). Saldo não usado volta de preferência ao Fundo para Reconstituição de Bens Lesados (art. 11, § 15).',
            acoes: [
                A.audiencia('Designar vistoria do projeto, se houver', 'inspecao'),
                A.escolha('Resultado da análise', ['Contas aprovadas e objeto exaurido', 'Etapa aprovada, projeto continua', 'Pendências a sanar', 'Contas reprovadas'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Parecer sobre as contas', 'Parecer', { forma: 'redigir' }),
            ],
            saidas: {
                'Homologação pelo Conselho Superior': quando('Resultado da análise', 'Contas aprovadas e objeto exaurido'),
                'Execução e prestação de contas': quando('Resultado da análise', 'Etapa aprovada, projeto continua', 'Pendências a sanar'),
                'Rescisão do termo': quando('Resultado da análise', 'Contas reprovadas'),
            },
        },
        {
            nome: 'Rescisão do termo', unidade: 'Gabinete', vai: ['Homologação pelo Conselho Superior'],
            orientacao: 'Sem contas, contas incompletas ou reprovadas: rescinda o termo e exija a devolução do não utilizado ou mal aplicado; a entidade fica impedida de nova destinação, é excluída do cadastro e a informação vai ao Portal da Transparência (arts. 5º, § 6º, e 14). Avalie a responsabilização cabível.',
            acoes: [
                A.documento('Decisão de rescisão', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar a entidade da rescisão e da devolução', { especie: 'intimacao', polos: ['interessado'], dias: 0, texto: 'O termo de recebimento foi rescindido. Devolva os bens e valores não utilizados ou aplicados fora da finalidade, conforme a decisão anexa.' }, { obrigatoria: true }),
                A.fazer('Excluir a entidade do cadastro e informar o Portal da Transparência', { obrigatoria: true }),
                A.simNao('Os valores foram devolvidos?', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Homologação pelo Conselho Superior', unidade: 'Conselho Superior', vai: ['Encerramento', 'Análise das contas'], nome_publico: 'Homologação',
            orientacao: 'Aprovadas as contas ou rescindido o termo com a devolução, o procedimento é submetido ao Conselho Superior para homologação (art. 15).',
            acoes: [
                A.fazer('Remeter o procedimento ao Conselho Superior', { obrigatoria: true }),
                A.julgamento('Deliberação', ['Homologa', 'Determina diligências'], {}, { obrigatoria: true }),
                A.documento('Juntar a decisão do colegiado', 'Decisão', { forma: 'juntar' }),
            ],
            saidas: { 'Encerramento': quando('Deliberação', 'Homologa'), 'Análise das contas': quando('Deliberação', 'Determina diligências') },
        },
        { nome: 'Destinação a fundo', unidade: 'Secretaria', final: true, orientacao: 'Os valores seguem ao Fundo para Reconstituição de Bens Lesados ou ao fundo legal indicado no título; registre o depósito no procedimento de origem.' },
        { nome: 'Encerramento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, após a homologação do Conselho Superior.' },
    ]);
}

/** 5-B. Cadastramento de entidade para destinação de recursos (MPRS, Provimento 69/2025-PGJ, arts. 2º a 5º). */
export function cadastroEntidadeMprs() {
    return montar({
        id: 'cadastro-entidade-mprs', nome: 'Cadastramento de entidade para destinação de recursos (MPRS)', area: 'ministerio_publico', porte: 'curto', referencia: 'MPRS',
        descricao: 'Pedido de órgão público, fundo ou entidade privada sem fins lucrativos para entrar no cadastro do MPRS que habilita a receber bens e valores de reparação de danos coletivos. O pedido chega pelo formulário do sítio à Promotoria da sede da entidade, com estatuto, ata da diretoria, CNPJ, certidões, projeto e dados bancários. A Promotoria confere os requisitos, como constituição há pelo menos três anos, e as vedações, chama a entidade a completar documentos, ouve o Centro de Apoio da matéria e decide. O cadastro vale três anos para entidade privada, deve ser atualizado em 30 dias a cada alteração e não dá direito à destinação; quem não presta contas é excluído.',
        quando: 'Ao receber pedido de cadastramento, em fluxo contínuo ou em resposta ao edital bienal de chamamento.',
        base: 'Provimento 69/2025-PGJ (MPRS), arts. 2º (entidades), 3º (edital a cada 2 anos e fluxo contínuo), 4º (vedações), 5º (formulário, documentos, decisão da Promotoria ouvido o Centro de Apoio, atualização em 30 dias, exclusão e validade de 3 anos), com alterações do Provimento 31/2026-PGJ; Res. Conjunta CNJ/CNMP 10/2024, art. 12. Prazo para completar documentos e cabimento de recurso: conferir na norma vigente e no edital.',
        tipo: { polos: ['requerente'], nomes_polos: { requerente: 'Entidade requerente' } },
    }, [
        {
            nome: 'Pedido de cadastramento', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Pedido recebido',
            orientacao: 'Registre o formulário assinado pelo representante legal com os documentos do art. 5º, § 1º. Órgãos e entes públicos apresentam só o projeto e os dados bancários (art. 5º, § 4º).',
            acoes: [
                A.formulario('Dados da entidade', [
                    { id: 'natureza', rotulo: 'Natureza', tipo: 'lista', obrigatorio: true, opcoes: ['Órgão ou entidade pública', 'Pessoa jurídica privada sem fins lucrativos', 'Fundo público temático ou territorial'] },
                    { id: 'nome', rotulo: 'Nome da entidade', tipo: 'texto', obrigatorio: true },
                    { id: 'cnpj', rotulo: 'CNPJ', tipo: 'texto', obrigatorio: true },
                    { id: 'constituicao', rotulo: 'Data de constituição', tipo: 'data', obrigatorio: false },
                    { id: 'area', rotulo: 'Área temática de atuação', tipo: 'texto', obrigatorio: false },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o formulário e os documentos', 'Requerimento', { forma: 'juntar' }),
            ],
            vai: ['Análise dos requisitos'],
        },
        {
            nome: 'Análise dos requisitos', unidade: 'Promotoria de Justiça', vai: ['Complementação de documentos', 'Oitiva do Centro de Apoio'],
            orientacao: 'Confira os documentos (estatuto registrado, atestado de fundação, ata da diretoria, CNPJ, certidões, projeto e dados bancários) e se a entidade privada existe há pelo menos 3 anos e não tem fins lucrativos (arts. 2º, § 1º, e 5º, § 1º). Verifique as vedações do art. 4º, como sindicatos, cooperativas, planos de saúde e entidades dirigidas por parentes de membros ou servidores.',
            acoes: [
                A.simNao('Incide alguma vedação do art. 4º?', { obrigatoria: true }),
                A.simNao('Faltam documentos?', { obrigatoria: true }),
            ],
            saidas: { 'Complementação de documentos': quando('Faltam documentos?', 'sim'), 'Oitiva do Centro de Apoio': quando('Faltam documentos?', 'nao') },
        },
        {
            nome: 'Complementação de documentos', unidade: 'Secretaria', espera: true, avanco: 'auto', nome_publico: 'Complementação do pedido',
            orientacao: 'Notifique a entidade dizendo o que falta. Respondida ou vencido o prazo, o pedido volta à análise (prazo: conferir no edital de chamamento).',
            acoes: [
                A.comunicar('Notificar a entidade para completar', { especie: 'notificacao', polos: ['requerente'], dias: 5, texto: 'Complete o pedido de cadastramento com os documentos indicados a seguir, no prazo indicado.' }, { obrigatoria: true }),
                A.esperar('Aguardar a complementação', 'Notificar a entidade para completar', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Oitiva do Centro de Apoio', unidade: 'Centro de Apoio Operacional', vai: ['Decisão'],
            orientacao: 'Ouça o Centro de Apoio vinculado à matéria preponderante entre as finalidades da entidade (art. 5º, caput).',
            acoes: [A.documento('Juntar a manifestação do Centro de Apoio', 'Parecer', { forma: 'juntar' })],
        },
        {
            nome: 'Decisão', unidade: 'Promotoria de Justiça', vai: ['Cadastro deferido', 'Cadastro indeferido'],
            orientacao: 'Decida pela inscrição ou pelo indeferimento, fundamentadamente (art. 5º, caput). A inclusão no cadastro não gera direito à destinação (Provimento 31/2026-PGJ, conferir na norma vigente).',
            acoes: [
                A.escolha('Decisão', ['Deferir o cadastro', 'Indeferir o cadastro'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Decisão sobre o cadastramento', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Comunicar a decisão à entidade', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Fica comunicada da decisão sobre o pedido de cadastramento, anexa. Alterações nos dados da entidade devem ser informadas em 30 dias.' }, { obrigatoria: true }),
            ],
            saidas: { 'Cadastro deferido': quando('Decisão', 'Deferir o cadastro'), 'Cadastro indeferido': quando('Decisão', 'Indeferir o cadastro') },
        },
        { nome: 'Cadastro deferido', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Inclua no cadastro eletrônico por região e Promotoria (art. 5º, § 5º). Validade de 3 anos para entidade privada (art. 5º, § 7º); alterações em 30 dias, sob pena de cancelamento (art. 5º, § 3º).' },
        { nome: 'Cadastro indeferido', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. A entidade pode fazer novo pedido quando sanar o motivo do indeferimento.' },
    ]);
}

/** 5-C. Triagem de representação em defesa do patrimônio público (MPRS, Provimento 04/2012-PGJ). */
export function triagemPatrimonioPublicoMprs() {
    return montar({
        id: 'triagem-patrimonio-publico-mprs', nome: 'Triagem de representação sobre patrimônio público (MPRS)', area: 'ministerio_publico', porte: 'curto', referencia: 'MPRS',
        descricao: 'Filtro próprio do MPRS para representações sobre improbidade e dano ao erário, antes de instaurar inquérito civil ou procedimento preparatório. O membro pode, por decisão fundamentada, não instaurar e encaminhar a representação à procuradoria do ente lesado quando não há indícios de improbidade ou a pretensão está prescrita, ou quando o ente já apura a conduta; requisitar sindicância ao ente e aguardar até um ano; enviar ao Tribunal de Contas ou ao ente o caso de prejuízo até R$ 2.000; indeferir com recomendação entre R$ 2.000 e R$ 8.500; ou arquivar abaixo de R$ 34.000 sem ofensa relevante a princípios. Essas saídas não valem quando o agente administra o ente ou o controle interno está comprometido. O representante é cientificado e pode recorrer em 10 dias; a decisão sobe sempre ao Conselho Superior em 3 dias. Difere da notícia de fato comum pelos limites de valor e pela remessa obrigatória.',
        quando: 'Nas Promotorias com atribuição em patrimônio público no MPRS, ao receber representação sobre improbidade ou dano ao erário. Confira os valores atualizados do provimento.',
        base: 'Provimento 04/2012-PGJ (MPRS), arts. 3º (encaminhamento ao ente e sindicância por até 1 ano; vedações do § 2º), 4º e 4º-A (limites de R$ 2.000, R$ 8.500 e R$ 34.000, redação do Provimento 85/2023-PGJ), 5º (prioridade), 6º e 7º (registro e remessa ao Conselho Superior); Provimento 71/2017-PGJ, art. 5º, §§ 1º, 4º e 6º, e art. 70; Lei 8.429/1992. O art. 1º do Provimento 04/2012-PGJ (investigação na esfera criminal) não é modelado.',
        tipo: { polos: ['requerente', 'requerido', 'interessado'], nomes_polos: { requerente: 'Representante', requerido: 'Representado', interessado: 'Ente público lesado' } },
    }, [
        {
            nome: 'Registro da representação', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Representação recebida',
            orientacao: 'Registre a representação ou o atendimento no sistema (Provimento 04/2012-PGJ, art. 6º) e informe o número ao representante.',
            acoes: [
                A.formulario('Dados da representação', [
                    { id: 'fato', rotulo: 'Fato noticiado', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'ente', rotulo: 'Ente público lesado', tipo: 'texto', obrigatorio: true },
                    { id: 'agente', rotulo: 'Agente público envolvido', tipo: 'texto', obrigatorio: false },
                    { id: 'prejuizo', rotulo: 'Prejuízo estimado, atualizado (R$)', tipo: 'numero', obrigatorio: false },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a representação e os documentos', 'Representação', { forma: 'juntar' }),
            ],
            vai: ['Análise de relevância'],
        },
        {
            nome: 'Análise de relevância', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Aguardando apuração do ente', 'Decisão de não instaurar', 'Instauração de procedimento'],
            orientacao: 'Pondere a probabilidade de êxito e o uso eficiente dos recursos, priorizando os casos de maior relevância social (art. 5º). As saídas do art. 3º não cabem se o agente administra o ente ou pode influir nele, ou se o controle interno está comprometido (art. 3º, § 2º). Prazo de 30 dias, como na notícia de fato (Provimento 71/2017-PGJ, art. 4º).',
            acoes: [
                A.simNao('O agente administra o ente ou o controle interno está comprometido?', { obrigatoria: true, ajuda: 'Se sim, não use encaminhamento ao ente nem requisição de sindicância (art. 3º, § 2º).' }),
                A.escolha('Enquadramento', [
                    'Sem indícios de improbidade ou prescrita, com possível dano',
                    'Conduta já apurada pelo ente lesado',
                    'Requisitar sindicância ao ente',
                    'Prejuízo até R$ 2.000',
                    'Prejuízo de R$ 2.000 a R$ 8.500',
                    'Prejuízo inferior a R$ 34.000, sem ofensa relevante',
                    'Instaurar inquérito civil ou procedimento preparatório',
                ], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: {
                'Aguardando apuração do ente': quando('Enquadramento', 'Requisitar sindicância ao ente'),
                'Instauração de procedimento': quando('Enquadramento', 'Instaurar inquérito civil ou procedimento preparatório'),
                'Decisão de não instaurar': quando('Enquadramento', 'Sem indícios de improbidade ou prescrita, com possível dano', 'Conduta já apurada pelo ente lesado', 'Prejuízo até R$ 2.000', 'Prejuízo de R$ 2.000 a R$ 8.500', 'Prejuízo inferior a R$ 34.000, sem ofensa relevante'),
            },
        },
        {
            nome: 'Aguardando apuração do ente', unidade: 'Secretaria', espera: true, avanco: 'auto', nome_publico: 'Apuração pelo ente público',
            orientacao: 'Sem instaurar procedimento, requisite ao ente a sindicância e as providências cabíveis e aguarde o desfecho por até 1 ano, improrrogável (art. 3º, § 3º). Com a resposta ou o fim do prazo, volte à análise.',
            acoes: [
                A.comunicar('Requisitar sindicância ao ente lesado', { especie: 'notificacao', polos: ['interessado'], dias: 365, contagem: corridos, texto: 'Instaure sindicância e adote as providências cabíveis sobre os fatos indicados a seguir, informando o resultado a este órgão.' }, { obrigatoria: true }),
                A.esperar('Aguardar o resultado da apuração', 'Requisitar sindicância ao ente lesado', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Decisão de não instaurar', unidade: 'Gabinete', vai: ['Cientificação e remessa ao Conselho Superior'],
            orientacao: 'Fundamente com relato sucinto do fato e registre como instauração indeferida (art. 7º). Encaminhe a representação à procuradoria do ente (art. 3º), ao Tribunal de Contas ou ao ente (arts. 4º e 4º-A, parágrafo único). Entre R$ 2.000 e R$ 8.500, e no arquivamento abaixo de R$ 34.000, expeça a recomendação cabível (art. 4º, § 1º, e 4º-A).',
            acoes: [
                A.documento('Decisão de não instauração', 'Despacho', { forma: 'redigir' }),
                A.escolha('Encaminhamento da representação', ['Procuradoria do ente lesado', 'Tribunal de Contas do Estado', 'Ente público lesado'], { obrigatoria: true, destino: 'autos' }),
                A.comunicar('Encaminhar a representação ao destinatário', { especie: 'comunicacao', polos: ['interessado'], dias: 0, texto: 'Encaminha-se a representação anexa para apuração e saneamento das irregularidades, no âmbito da sua competência.' }),
                A.simNao('Expedir recomendação à autoridade?', { obrigatoria: true }),
                A.documento('Recomendação', 'Recomendação', { forma: 'redigir', se: quando('Expedir recomendação à autoridade?', 'sim') }),
            ],
        },
        {
            nome: 'Cientificação e remessa ao Conselho Superior', unidade: 'Secretaria', vai: ['Deliberação do Conselho Superior'],
            orientacao: 'Cientifique o representante, que pode recorrer em 10 dias. Com ou sem recurso, remeta a decisão ao Conselho Superior em 3 dias do fim do prazo recursal (Provimento 71/2017-PGJ, art. 5º, §§ 1º e 6º; Provimento 04/2012-PGJ, art. 7º).',
            acoes: [
                A.comunicar('Dar ciência ao representante', { especie: 'ciencia', polos: ['requerente'], dias: 10, contagem: corridos, texto: 'Foi decidido não instaurar inquérito civil sobre a sua representação, pelos fundamentos da decisão anexa. Cabe recurso em 10 dias, protocolado neste órgão.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Dar ciência ao representante', { obrigatoria: true }),
                A.fazer('Remeter ao Conselho Superior em 3 dias', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Deliberação do Conselho Superior', unidade: 'Conselho Superior', vai: ['Arquivamento', 'Instauração de procedimento'], nome_publico: 'Revisão pelo Conselho Superior',
            orientacao: 'O colegiado examina a decisão e o recurso, se houver. Homologada, arquiva-se; rejeitada, instaura-se o procedimento próprio.',
            acoes: [
                A.julgamento('Deliberação', ['Homologa', 'Rejeita e determina a instauração'], {}, { obrigatoria: true }),
                A.documento('Juntar a decisão do colegiado', 'Decisão', { forma: 'juntar' }),
            ],
            saidas: { 'Arquivamento': quando('Deliberação', 'Homologa'), 'Instauração de procedimento': quando('Deliberação', 'Rejeita e determina a instauração') },
        },
        {
            nome: 'Instauração de procedimento', unidade: 'Gabinete', vai: ['Arquivamento'],
            orientacao: 'Instaure o inquérito civil ou o procedimento preparatório no rito próprio, vinculado a esta triagem, e encerre aqui.',
            acoes: [
                A.documento('Portaria de instauração', 'Portaria', { forma: 'redigir' }),
                A.texto('Número do procedimento instaurado', { obrigatoria: true }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, com registro no sistema.' },
    ]);
}

/** 6. Correição e inspeção da Corregedoria-Geral do MPRS (Provimento 2/2024-CGMP). */
export function correicaoCorregedoriaMp() {
    return montar({
        id: 'correicao-corregedoria-mp', nome: 'Correição e inspeção em Promotoria de Justiça (MPRS)', area: 'correcional', porte: 'medio', referencia: 'MPRS',
        descricao: 'Verificação pela Corregedoria-Geral do Ministério Público do funcionamento dos cargos de Promotor de Justiça. A correição ordinária é periódica, a cada três anos, com calendário anual feito até outubro e publicado com 30 dias de antecedência; a extraordinária e a inspeção, esta quando há indícios de irregularidade, são determinadas pelo Conselho Nacional, pelo Conselho Superior, pelo Órgão Especial, pelo Procurador-Geral ou pelo Corregedor-Geral. O correicionado é avisado com 5 dias. O Corregedor-Geral ou o Promotor-Corregedor examina os sistemas e pode visitar a Promotoria, ouvir juízes, advogados, partes e a comunidade e fazer audiência pública. Lavra-se o Relatório Avaliativo de Correição, com boas práticas, irregularidades, avaliação e proposições; o Promotor é cientificado, o relatório vai ao Conselho Superior e a avaliação entra na ficha funcional. As proposições são acompanhadas; indício de falta funcional segue ao procedimento disciplinar próprio.',
        quando: 'Para as correições ordinárias do calendário e para correições extraordinárias e inspeções determinadas. Outros Ministérios Públicos ajustam periodicidade e prazos à norma da sua Corregedoria.',
        base: 'Provimento 2/2024-CGMP (MPRS), arts. 2º (conceitos), 3º (periodicidade de 3 anos, quem determina, calendário com 30 dias, aviso com 5 dias, contatos externos, audiência pública e correição remota), 4º (calendário até outubro, com ciência à Corregedoria Nacional), 6º (diretrizes de avaliação), 7º (relatório, ciência, Conselho Superior e ficha funcional), 8º e 9º (inspeção e Ordem de Serviço), com alteração do Provimento 19/2026-CGMP; Lei Estadual 7.669/1982. Prazo de manifestação do correicionado: conferir na Ordem de Serviço vigente.',
        tipo: { polos: ['requerido'], nomes_polos: { requerido: 'Membro correicionado' } },
    }, [
        {
            nome: 'Determinação e designação', unidade: 'Corregedoria-Geral', ao_entrar: { sigilo: 'restrito' },
            orientacao: 'Registre a espécie e quem a determinou (art. 3º, § 2º). A ordinária consta do calendário anual, feito até outubro com ao menos um terço dos cargos (art. 4º). Designe o Promotor-Corregedor; a inspeção é distribuída a ele (art. 9º). A ordinária pode ser feita só pelos sistemas se não houver necessidade de visita e a anterior foi presencial (art. 3º, § 8º).',
            acoes: [
                A.formulario('Dados da correição', [
                    { id: 'especie', rotulo: 'Espécie', tipo: 'lista', obrigatorio: true, opcoes: ['Correição ordinária', 'Correição extraordinária', 'Inspeção'] },
                    { id: 'origem', rotulo: 'Determinada por', tipo: 'lista', obrigatorio: true, opcoes: ['Calendário anual', 'Conselho Nacional do Ministério Público', 'Conselho Superior', 'Órgão Especial', 'Procurador-Geral de Justiça', 'Corregedor-Geral'] },
                    { id: 'cargo', rotulo: 'Cargo e Promotoria de Justiça', tipo: 'texto', obrigatorio: true },
                    { id: 'responsavel', rotulo: 'Corregedor ou Promotor-Corregedor responsável', tipo: 'texto', obrigatorio: true },
                    { id: 'forma', rotulo: 'Forma', tipo: 'lista', obrigatorio: true, opcoes: ['Presencial', 'Pelos sistemas eletrônicos'] },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Portaria ou despacho de instauração', 'Portaria', { forma: 'redigir' }),
            ],
            vai: ['Publicação e aviso'],
        },
        {
            nome: 'Publicação e aviso', unidade: 'Corregedoria-Geral', vai: ['Exame e visita'], nome_publico: 'Aviso de correição',
            orientacao: 'Na ordinária, o calendário com os cargos sai no Diário Eletrônico com pelo menos 30 dias de antecedência (art. 3º, § 4º), e o Promotor é avisado com pelo menos 5 dias do início (art. 3º, § 5º). Para extraordinária e inspeção, aplique o que couber (art. 8º).',
            acoes: [
                A.fazer('Publicar o calendário no Diário Eletrônico, se ordinária'),
                A.audiencia('Designar o início da correição', 'inspecao'),
                A.comunicar('Avisar o membro correicionado', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Fica avisado de que a correição no seu cargo começa em {audiencia}.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Exame e visita', unidade: 'Corregedoria-Geral', vai: ['Relatório avaliativo'],
            orientacao: 'Verifique a regularidade, eficiência, pontualidade e resolutividade, com foco no resultado e não só no controle formal (arts. 3º e 5º), pelos aspectos do art. 6º: prazos, produção, atuação judicial e extrajudicial, atendimento ao público. Quando conveniente, ouça juízes, autoridades, advogados, partes e a comunidade (art. 3º, § 6º), inclusive em audiência pública (§ 7º).',
            acoes: [
                A.fazer('Examinar os dados dos sistemas e os procedimentos', { obrigatoria: true }),
                A.fazer('Ouvir juízes, advogados, partes e a comunidade, se conveniente'),
                A.simNao('Realizar audiência pública?', { ajuda: 'Para ouvir notícias, sugestões ou reclamações da comunidade sobre a Promotoria (art. 3º, § 7º).' }),
                A.audiencia('Designar a audiência pública', 'audiencia', { se: quando('Realizar audiência pública?', 'sim') }),
                A.documento('Juntar termos de visita e anotações', '', { forma: 'juntar', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Relatório avaliativo', unidade: 'Corregedoria-Geral', vai: ['Ciência e providências'],
            orientacao: 'Lavre o Relatório Avaliativo de Correição com informações gerais, atuação judicial e extrajudicial, fiscalização, boas práticas, avaliação funcional e, se for o caso, orientações, recomendações e proposições com verificação virtual ou acompanhamento (art. 7º, I a IX).',
            acoes: [
                A.documento('Relatório Avaliativo de Correição', 'Relatório', { forma: 'redigir' }),
                A.simNao('Há proposições a acompanhar?', { obrigatoria: true, destino: 'autos' }),
                A.simNao('Há indício de falta funcional?', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Ciência e providências', unidade: 'Corregedoria-Geral', vai: ['Acompanhamento das proposições', 'Encerramento'], padrao: 'Encerramento',
            orientacao: 'Cientifique o Promotor do relatório (art. 7º, § 1º). O Corregedor-Geral adota as providências da sua atribuição e propõe as demais ao Conselho Superior, a quem o relatório é levado (art. 7º, §§ 2º e 3º). A avaliação e as orientações vão à ficha funcional (art. 7º, § 4º). Indício de falta funcional segue ao procedimento disciplinar próprio.',
            acoes: [
                A.comunicar('Dar ciência do relatório ao membro', { especie: 'ciencia', polos: ['requerido'], dias: 0, texto: 'Segue o Relatório Avaliativo de Correição do seu cargo.' }, { obrigatoria: true }),
                A.fazer('Levar o relatório ao Conselho Superior', { obrigatoria: true }),
                A.fazer('Registrar a avaliação e as orientações na ficha funcional', { obrigatoria: true }),
                A.fazer('Instaurar o procedimento disciplinar próprio, se houver indício de falta'),
                A.simNao('Acompanhar o cumprimento das proposições?', { obrigatoria: true }),
            ],
            saidas: { 'Acompanhamento das proposições': quando('Acompanhar o cumprimento das proposições?', 'sim'), 'Encerramento': quando('Acompanhar o cumprimento das proposições?', 'nao') },
        },
        {
            nome: 'Acompanhamento das proposições', unidade: 'Corregedoria-Geral', vai: ['Encerramento', 'Ciência e providências'],
            orientacao: 'Verifique, pelos sistemas, o atendimento das proposições e acompanhe as atividades indicadas no relatório (art. 7º, VIII e IX). Não atendidas, volte às providências.',
            acoes: [
                A.fazer('Verificar virtualmente o atendimento das proposições', { obrigatoria: true }),
                A.simNao('As proposições foram atendidas?', { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Encerramento': quando('As proposições foram atendidas?', 'sim'), 'Ciência e providências': quando('As proposições foram atendidas?', 'nao') },
        },
        { nome: 'Encerramento', unidade: 'Corregedoria-Geral', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, com registro correicional do cargo.' },
    ]);
}

export const modelos = [
    compromissoAjustamentoConduta, recomendacaoMp, audienciaPublicaMp, revisaoArquivamentoCsmp,
    destinacaoBensValoresMprs, cadastroEntidadeMprs, triagemPatrimonioPublicoMprs, correicaoCorregedoriaMp,
];
