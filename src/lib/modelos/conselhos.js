// Modelos de conselhos profissionais (área etica, salvo indicação). Ver a forma de escrever em ./dsl.js.
// Pesquisa e fontes: /mnt/project-files/modelos-rito/pesquisa-conselhos.md.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';

/** 1. Processo disciplinar no Tribunal de Ética e Disciplina da OAB/RS (Lei 8.906/1994, CED e RI-TED/RS). */
export function processoDisciplinarTedOabRs() {
    return montar({
        id: 'ted-oab-rs', nome: 'Processo disciplinar no TED da OAB/RS', area: 'etica', porte: 'longo', referencia: 'OAB/RS',
        descricao: 'Rito do Tribunal de Ética e Disciplina da OAB/RS para apurar infração disciplinar de advogado ou estagiário. A representação identificada, ou a instauração de ofício, recebe relator por sorteio eletrônico para a admissibilidade; o Presidente do TED instaura, arquiva liminarmente, encaminha à conciliação entre advogados ou propõe termo de ajustamento de conduta. Instaurado, um instrutor designado pelo Presidente notifica para defesa prévia, instrui com audiência, dá parecer preliminar e abre razões finais sucessivas; um relator sorteado, diferente do instrutor, leva o processo a uma das Turmas Julgadoras, em sessão reservada com pauta publicada 15 dias antes e sustentação oral de 15 minutos. O contraditório está na defesa prévia, na audiência, nas razões finais, na sustentação, nos embargos e nos recursos: das decisões do Presidente do TED e dos instrutores cabe recurso à Turma; das Turmas, ao Conselho Seccional; deste, ao Conselho Federal quando a decisão não for unânime ou contrariar a lei ou precedente. A suspensão preventiva corre em sessão especial de Turma sorteada. Termina com a aplicação da sanção pelo Presidente do TED e o registro, ou com o arquivamento; tudo em sigilo. Difere do modelo genérico disciplinar-entidade-classe por seguir a estrutura gaúcha: instrutores, Turmas Julgadoras, recurso interno às Turmas, conciliação entre advogados, TAC, embargos ao redator e as regras de sessão do regimento do TED.',
        quando: 'Representação ou notícia de infração disciplinar de inscrito na OAB/RS, quando o fato ocorreu na base territorial da Seccional. Confira o texto consolidado do Regimento Interno do TED e do Regimento Interno da OAB/RS antes de implantar, principalmente qual câmara do Conselho Seccional julga o recurso.',
        base: 'Lei 8.906/1994, arts. 35, 40, 43, 68 a 77; Regulamento Geral, arts. 137-D a 144-A (art. 139: prazos em dias úteis, Res. CFOAB 09/2016; art. 137-D alterado pela Res. CFOAB 01/2026, conferir na norma vigente); Código de Ética e Disciplina (Res. CFOAB 02/2015), arts. 55 a 63, 66 e 67; Provimento CFOAB 200/2020 (TAC); Regimento Interno do TED da OAB/RS (DOU de 10/09/2018), arts. 2º, 7º, 10 a 12, 26, 33, 37, 38, 42 a 44, 47 e 55 a 59, com alteração homologada pela Ementa 073/2025/SCA (texto consolidado: conferir na norma vigente).',
        tipo: { polos: ['requerente', 'requerido'], nomes_polos: { requerente: 'Representante', requerido: 'Representado' } },
    }, [
        {
            nome: 'Representação', unidade: 'Secretaria do TED', avanco: 'auto', ao_entrar: { sigilo: 'restrito' }, nome_publico: 'Representação recebida',
            orientacao: 'Receba a representação dirigida ao Presidente do Conselho Seccional, da Subseção ou do TED, escrita ou reduzida a termo, com qualificação do representante, narração dos fatos, documentos e até 5 testemunhas (CED, arts. 56 e 57). Representação anônima não é fonte idônea (CED, art. 55, § 2º). Representação de advogado contra advogado recebida na Subseção vem ao TED (RI-TED/RS, art. 55, parágrafo único). O processo é sigiloso até o fim (Lei 8.906, art. 72, § 2º).',
            acoes: [
                A.formulario('Registrar os dados da representação', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['Representação', 'De ofício', 'Comunicação de autoridade'] },
                    { id: 'representado', rotulo: 'Representado', tipo: 'texto', obrigatorio: true },
                    { id: 'inscricao', rotulo: 'Número de inscrição na OAB/RS', tipo: 'texto', obrigatorio: true },
                    { id: 'adv_contra_adv', rotulo: 'Representante também é advogado?', tipo: 'lista', obrigatorio: true, opcoes: ['Sim', 'Não'] },
                    { id: 'data_constatacao', rotulo: 'Data da constatação oficial do fato', tipo: 'data', obrigatorio: true },
                    { id: 'fatos', rotulo: 'Narração dos fatos', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'testemunhas', rotulo: 'Rol de testemunhas (até 5)', tipo: 'texto_longo', obrigatorio: false },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true, ajuda: 'A constatação oficial do fato inicia a prescrição de 5 anos (Lei 8.906, art. 43).' }),
                A.documento('Juntar a representação ou o termo e os documentos', 'Representação', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Distribuição e certidões', unidade: 'Secretaria do TED', avanco: 'auto', vai: ['Parecer de admissibilidade'],
            orientacao: 'O Presidente do TED designa, por sorteio eletrônico, o relator da admissibilidade, que pode também atuar na instrução (RI-TED/RS, art. 56). Antes de remeter, junte a ficha cadastral do representado e as certidões de punições anteriores e de representações em andamento (CED, art. 58, § 2º).',
            acoes: [
                A.texto('Relator sorteado', { obrigatoria: true, destino: 'informacao' }),
                A.documento('Juntar a ficha cadastral e as certidões de punições e de representações', 'Certidão', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Parecer de admissibilidade', unidade: 'Relator', prazo_dias: 30, prazo_auto: true, avanco: 'auto', vai: ['Despacho do Presidente do TED'],
            orientacao: 'O relator examina os critérios de admissibilidade e emite parecer em 30 dias, propondo a instauração ou o arquivamento liminar, sob pena de redistribuição (CED, art. 58, § 3º). Se a infração for punível com censura e sem repercussão negativa à advocacia, pode sugerir termo de ajustamento de conduta (CED, art. 58-A). Entre advogados, pode sugerir conciliação (RI-TED/RS, art. 55).',
            acoes: [
                A.escolha('Proposta do relator', ['Instaurar', 'Arquivar liminarmente', 'Conciliação entre advogados', 'Termo de ajustamento de conduta'], { obrigatoria: true }),
                A.documento('Juntar o parecer de admissibilidade', 'Parecer', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Despacho do Presidente do TED', unidade: 'Presidência do TED', vai: ['Notificação e defesa prévia', 'Prazo de recurso do arquivamento', 'Conciliação entre advogados', 'Termo de ajustamento de conduta'],
            orientacao: 'O Presidente do TED instaura o processo ou arquiva liminarmente a representação, antes da defesa prévia, nos termos do parecer ou por fundamentos próprios (CED, art. 58, § 4º; RI-TED/RS, art. 7º, X e XI). Instaurando, designa o advogado instrutor (RI-TED/RS, art. 7º, XV). Da decisão do Presidente cabe recurso à Turma Julgadora (RI-TED/RS, art. 43).',
            acoes: [
                A.escolha('Decisão do Presidente do TED', ['Instaurar', 'Arquivar liminarmente', 'Encaminhar à conciliação', 'Propor termo de ajustamento de conduta'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o despacho', 'Despacho', { forma: 'redigir' }),
                A.texto('Instrutor designado', { obrigatoria: true, destino: 'informacao', se: quando('Decisão do Presidente do TED', 'Instaurar'), ajuda: 'Advogado com mais de 3 anos de inscrição, designado pelo Presidente do TED (RI-TED/RS, arts. 2º e 7º, XV).' }),
            ],
            saidas: {
                'Notificação e defesa prévia': quando('Decisão do Presidente do TED', 'Instaurar'),
                'Prazo de recurso do arquivamento': quando('Decisão do Presidente do TED', 'Arquivar liminarmente'),
                'Conciliação entre advogados': quando('Decisão do Presidente do TED', 'Encaminhar à conciliação'),
                'Termo de ajustamento de conduta': quando('Decisão do Presidente do TED', 'Propor termo de ajustamento de conduta'),
            },
        },
        {
            nome: 'Prazo de recurso do arquivamento', unidade: 'Secretaria do TED', avanco: 'auto', vai: ['Recurso à Turma Julgadora', 'Arquivamento'], nome_publico: 'Arquivamento liminar',
            orientacao: 'Intime o representante do arquivamento liminar. O recurso cabe em 15 dias úteis, contados do primeiro dia útil seguinte ao recebimento (Lei 8.906, art. 69; Regulamento Geral, art. 139), e é julgado por uma Turma Julgadora (RI-TED/RS, art. 43).',
            acoes: [
                A.comunicar('Intimar o representante do arquivamento', { especie: 'intimacao', polos: ['requerente'], dias: 15, texto: 'A representação foi arquivada liminarmente pelo Presidente do Tribunal de Ética e Disciplina. Cabe recurso em 15 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar o representante do arquivamento', { obrigatoria: true }),
            ],
            saidas: { 'Recurso à Turma Julgadora': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Arquivamento': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso à Turma Julgadora', unidade: 'Turma Julgadora', vai: ['Notificação e defesa prévia', 'Arquivamento', 'Recurso ao Conselho Seccional'],
            condicoes: { 'Recurso ao Conselho Seccional': 'Se a parte recorrer da decisão da Turma ao Conselho Seccional (Lei 8.906, art. 76; RI-TED/RS, art. 42).' },
            orientacao: 'Recurso contra decisão do Presidente do TED vai a uma Turma Julgadora (RI-TED/RS, art. 43). A sessão exige ao menos 3 titulares, e o presidente da Turma só vota para desempatar (art. 12). Provido, o processo é instaurado e segue para a defesa prévia. Da decisão da Turma ainda cabe recurso ao Conselho Seccional.',
            acoes: [
                A.comunicar('Intimar o representado para contrarrazões', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Foi interposto recurso contra o arquivamento de representação em que você figura. Apresente contrarrazões em 15 dias úteis, se quiser.' }),
                A.esperar('Aguardar as contrarrazões', 'Intimar o representado para contrarrazões'),
                A.audiencia('Pautar a sessão da Turma', 'sessao'),
                A.escolha('Resultado do recurso', ['Provido', 'Desprovido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o acórdão da Turma', 'Acórdão', { forma: 'redigir' }),
                A.comunicar('Intimar as partes do acórdão', { especie: 'intimacao', dias: 0, texto: 'Fica intimado do acórdão da Turma Julgadora sobre o recurso contra o arquivamento.' }, { obrigatoria: true }),
            ],
            saidas: { 'Notificação e defesa prévia': quando('Resultado do recurso', 'Provido'), 'Arquivamento': quando('Resultado do recurso', 'Desprovido') },
        },
        {
            nome: 'Conciliação entre advogados', unidade: 'Relator', vai: ['Arquivamento', 'Notificação e defesa prévia'], nome_publico: 'Tentativa de conciliação',
            orientacao: 'Representação de advogado contra advogado sobre ética profissional pode ser arquivada por conciliação (RI-TED/RS, art. 55). O relator sorteado conduz a audiência (art. 56). Sem acordo, o processo volta ao andamento regular, com a instauração e a defesa prévia (art. 57).',
            acoes: [
                A.audiencia('Designar a audiência de conciliação', 'conciliacao'),
                A.comunicar('Intimar as partes para a audiência', { especie: 'intimacao', dias: 0, texto: 'Compareça à audiência de conciliação em {audiencia}.' }, { obrigatoria: true }),
                A.simNao('Houve acordo?', { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o termo de conciliação', 'Termo', { forma: 'redigir', se: quando('Houve acordo?', 'sim') }),
                A.documento('Juntar a ata da audiência', 'Ata', { forma: 'redigir', nivel: 'recomendado' }),
            ],
            saidas: { 'Arquivamento': quando('Houve acordo?', 'sim'), 'Notificação e defesa prévia': quando('Houve acordo?', 'nao') },
        },
        {
            nome: 'Termo de ajustamento de conduta', unidade: 'Presidência do TED', vai: ['Cumprimento do termo', 'Notificação e defesa prévia'], nome_publico: 'Proposta de ajustamento de conduta',
            orientacao: 'Cabe TAC na infração punível com censura que não gerou repercussão negativa à advocacia, para quem não tem condenação transitada em julgado (CED, art. 58-A; Provimento 200/2020). O inscrito tem 15 dias para aderir, e o silêncio vale como recusa. Registre o termo no cadastro nacional de TACs (Res. CFOAB 01/2021). Confira as condições no provimento vigente.',
            acoes: [
                A.comunicar('Notificar o representado da proposta de TAC', { especie: 'notificacao', polos: ['requerido'], dias: 15, texto: 'Você pode aderir a termo de ajustamento de conduta, nas condições anexas. Manifeste interesse em 15 dias; sem resposta, presume-se a recusa.' }, { obrigatoria: true }),
                A.esperar('Aguardar a manifestação', 'Notificar o representado da proposta de TAC', { obrigatoria: true }),
                A.escolha('Resultado da proposta', ['Termo firmado', 'Recusado ou sem resposta'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o termo de ajustamento de conduta', 'Termo', { forma: 'redigir', se: quando('Resultado da proposta', 'Termo firmado') }),
                A.fazer('Registrar o termo no cadastro nacional de TACs', { se: quando('Resultado da proposta', 'Termo firmado') }),
            ],
            saidas: { 'Cumprimento do termo': quando('Resultado da proposta', 'Termo firmado'), 'Notificação e defesa prévia': quando('Resultado da proposta', 'Recusado ou sem resposta') },
        },
        {
            nome: 'Cumprimento do termo', unidade: 'Presidência do TED', vai: ['Arquivamento', 'Notificação e defesa prévia'],
            orientacao: 'O processo fica suspenso durante o período do termo, de 3 anos segundo o Provimento 200/2020 (conferir). Cumprido, arquive sem exame de mérito; descumprido, o processo é instaurado e segue para a defesa prévia.',
            acoes: [
                A.data('Fim do período do termo', { obrigatoria: true, destino: 'informacao' }),
                A.simNao('O termo foi cumprido?', { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a decisão sobre o cumprimento', 'Decisão', { forma: 'redigir' }),
            ],
            saidas: { 'Arquivamento': quando('O termo foi cumprido?', 'sim'), 'Notificação e defesa prévia': quando('O termo foi cumprido?', 'nao') },
        },
        {
            nome: 'Notificação e defesa prévia', unidade: 'Instrutor', vai: ['Defensor dativo', 'Indeferimento liminar', 'Instrução'], nome_publico: 'Defesa prévia',
            orientacao: 'Notifique o representado por correspondência com aviso de recebimento ao endereço do cadastro; frustrada, por edital sem menção à matéria disciplinar (Regulamento Geral, art. 137-D). Defesa prévia em 15 dias úteis, com documentos e até 5 testemunhas (CED, art. 59; Lei 8.906, art. 69). O instrutor pode prorrogar por motivo relevante (Lei 8.906, art. 73, § 3º). Depois da defesa, pode opinar pelo indeferimento liminar (RI-TED/RS, art. 26, III).',
            acoes: [
                A.comunicar('Notificar o representado para defesa prévia', { especie: 'notificacao', polos: ['requerido'], dias: 15, texto: 'Foi instaurado processo disciplinar. Apresente defesa prévia em 15 dias úteis, com documentos e rol de até 5 testemunhas.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa prévia', 'Notificar o representado para defesa prévia', { obrigatoria: true }),
                A.simNao('O instrutor opina pelo indeferimento liminar?', { obrigatoria: true, se: quando('Aguardar a defesa prévia', 'Apresentada', 'Parcial') }),
                A.documento('Juntar o parecer pelo indeferimento liminar', 'Parecer', { forma: 'redigir', se: quando('O instrutor opina pelo indeferimento liminar?', 'sim') }),
            ],
            saidas: {
                'Defensor dativo': quando('Aguardar a defesa prévia', 'Sem manifestação'),
                'Indeferimento liminar': quando('O instrutor opina pelo indeferimento liminar?', 'sim'),
                'Instrução': quando('O instrutor opina pelo indeferimento liminar?', 'nao'),
            },
        },
        {
            nome: 'Defensor dativo', unidade: 'Presidência do TED', prazo_dias: 15, prazo_auto: true, vai: ['Instrução'],
            orientacao: 'Representado não encontrado ou revel: o Presidente do TED designa defensor dativo (CED, art. 59, § 2º; RI-TED/RS, art. 7º, XVI), que apresenta a defesa prévia em 15 dias úteis.',
            acoes: [
                A.formulario('Registrar o defensor dativo', [
                    { id: 'dativo', rotulo: 'Nome do defensor dativo', tipo: 'texto', obrigatorio: true },
                    { id: 'inscricao_dativo', rotulo: 'Inscrição do defensor', tipo: 'texto', obrigatorio: true },
                    { id: 'motivo', rotulo: 'Motivo da nomeação', tipo: 'lista', obrigatorio: true, opcoes: ['Não encontrado', 'Revelia'] },
                ], { obrigatoria: true, destino: 'informacao' }),
                A.fazer('Intimar o defensor dativo do prazo de defesa', { obrigatoria: true }),
                A.documento('Juntar a defesa prévia do dativo', 'Defesa', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Indeferimento liminar', unidade: 'Presidência do Conselho Seccional', vai: ['Instrução', 'Recurso ao Conselho Seccional', 'Arquivamento'],
            ao_entrar: { pendencia: 'O instrutor opinou pelo indeferimento liminar da representação: decidir (Lei 8.906/1994, art. 73, § 2º).' },
            orientacao: 'Opinando o instrutor pelo indeferimento liminar depois da defesa prévia, decide o Presidente do Conselho Seccional (Lei 8.906, art. 73, § 2º). Indeferida, intime as partes; o recurso ao Conselho Seccional cabe em 15 dias úteis (art. 76).',
            acoes: [
                A.escolha('Decisão sobre o indeferimento', ['Indefere liminarmente', 'Prossegue'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar as partes do indeferimento', { especie: 'intimacao', dias: 15, texto: 'A representação foi indeferida liminarmente pelo Presidente do Conselho Seccional. Cabe recurso em 15 dias úteis.' }, { obrigatoria: true, se: quando('Decisão sobre o indeferimento', 'Indefere liminarmente') }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar as partes do indeferimento', { obrigatoria: true, se: quando('Decisão sobre o indeferimento', 'Indefere liminarmente') }),
            ],
            saidas: {
                'Instrução': quando('Decisão sobre o indeferimento', 'Prossegue'),
                'Recurso ao Conselho Seccional': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'),
                'Arquivamento': quando('Aguardar o prazo de recurso', 'Sem manifestação'),
            },
        },
        {
            nome: 'Instrução', unidade: 'Instrutor', vai: ['Parecer preliminar', 'Suspensão preventiva'],
            orientacao: 'O instrutor profere despacho saneador e designa audiência para ouvir representante, representado e testemunhas, que as partes levam salvo pedido justificado de notificação (CED, art. 59, §§ 3º e 4º). Decide sobre provas e prazos, ordena diligências e pode pedir atos às Subseções (RI-TED/RS, arts. 7º, XVII, e 26). Recurso contra decisão da instrução vai à Turma, em apartado (art. 43, parágrafo único). Com repercussão prejudicial à dignidade da advocacia, envie à suspensão preventiva.',
            acoes: [
                A.documento('Juntar o despacho saneador', 'Despacho', { forma: 'redigir' }),
                A.audiencia('Designar a audiência de instrução', 'instrucao'),
                A.comunicar('Intimar as partes para a audiência', { especie: 'intimacao', dias: 0, texto: 'Compareça à audiência de instrução em {audiencia}, trazendo suas testemunhas.' }, { obrigatoria: true }),
                A.simNao('Alguma parte pediu, com justificativa, a notificação de testemunha?', { obrigatoria: true }),
                A.fazer('Notificar as testemunhas indicadas', { se: quando('Alguma parte pediu, com justificativa, a notificação de testemunha?', 'sim') }),
                A.fazer('Requisitar à Subseção a prática de ato processual', { ajuda: 'Para atos fora da sede do TED (RI-TED/RS, art. 7º, XVII).' }),
                A.simNao('Houve recurso contra decisão da instrução?', { ajuda: 'Corre em apartado perante a Turma, e o processo principal segue (RI-TED/RS, art. 43, parágrafo único).' }),
                A.documento('Juntar a ata e os termos de depoimento', 'Ata', { forma: 'qualquer' }),
            ],
        },
        {
            nome: 'Parecer preliminar', unidade: 'Instrutor', avanco: 'auto', vai: ['Razões finais'],
            orientacao: 'Concluída a instrução, o instrutor emite parecer preliminar fundamentado, com o enquadramento legal dos fatos (CED, art. 59, § 7º; Lei 8.906, art. 73). Se passar de 30 dias, o processo pode ser redistribuído (RI-TED/RS, art. 33, V).',
            acoes: [A.documento('Juntar o parecer preliminar', 'Parecer', { forma: 'redigir', ajuda: 'Indique o enquadramento legal dos fatos imputados (CED, art. 59, § 7º).' })],
        },
        {
            nome: 'Razões finais', unidade: 'Secretaria do TED', avanco: 'auto', vai: ['Distribuição à Turma e pauta'],
            orientacao: 'Prazo sucessivo de 15 dias úteis, primeiro ao representante e depois ao representado (CED, art. 59, § 8º).',
            acoes: [
                A.comunicar('Intimar o representante para razões finais', { especie: 'intimacao', polos: ['requerente'], dias: 15, texto: 'Encerrada a instrução, apresente razões finais em 15 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar as razões do representante', 'Intimar o representante para razões finais', { obrigatoria: true }),
                A.comunicar('Intimar o representado para razões finais', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Encerrado o prazo do representante, apresente razões finais em 15 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar as razões do representado', 'Intimar o representado para razões finais', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Distribuição à Turma e pauta', unidade: 'Presidência do TED', vai: ['Sessão de julgamento'],
            orientacao: 'O Presidente do TED sorteia o relator do voto, que não pode ser o instrutor (CED, art. 60, § 1º), e a Turma Julgadora. Inclua na primeira sessão após a distribuição (art. 60, § 2º). Publique a pauta no site e no quadro de avisos com 15 dias de antecedência (RI-TED/RS, art. 37, § 4º) e notifique as partes com a mesma antecedência (CED, art. 60, § 3º).',
            acoes: [
                A.formulario('Registrar a distribuição', [
                    { id: 'turma', rotulo: 'Turma Julgadora', tipo: 'texto', obrigatorio: true },
                    { id: 'relator', rotulo: 'Relator do voto', tipo: 'texto', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', ajuda: 'O relator do voto não pode ser o instrutor (CED, art. 60, § 1º).' }),
                A.audiencia('Pautar a sessão de julgamento', 'sessao'),
                A.fazer('Publicar a pauta no site e no quadro de avisos', { obrigatoria: true, ajuda: 'Com 15 dias de antecedência e o nome do representado substituído pelas iniciais (RI-TED/RS, art. 37, § 4º; Regulamento Geral, art. 137-D, § 4º).' }),
                A.comunicar('Notificar as partes da sessão de julgamento', { especie: 'notificacao', dias: 0, texto: 'O processo será julgado na sessão de {audiencia}. A sessão é reservada às partes e procuradores, e cabe sustentação oral de 15 minutos, que pode ser pedida antes ou no início da sessão.' }, { obrigatoria: true, ajuda: 'A notificação sai com 15 dias de antecedência (CED, art. 60, § 3º).' }),
            ],
        },
        {
            nome: 'Sessão de julgamento', unidade: 'Turma Julgadora', vai: ['Embargos de declaração', 'Recurso ao Conselho Seccional', 'Execução e registro'], nome_publico: 'Julgamento',
            orientacao: 'Sessão reservada, com ao menos 3 titulares (RI-TED/RS, arts. 12 e 37, § 5º). Ordem: relatório, esclarecimentos, voto, sustentação oral de 15 minutos (primeiro o representante), debate de até 3 minutos por julgador, nova sustentação de 5 minutos se houver voto divergente, votação nominal por antiguidade e proclamação com a ementa (art. 38; CED, art. 60, § 4º). Vista: volta na sessão ordinária seguinte. O acórdão segue os arts. 61 e 62 do CED.',
            acoes: [
                A.simNao('Houve pedido de vista ou designação de revisor?', { ajuda: 'O processo volta na sessão ordinária seguinte (RI-TED/RS, art. 38, §§ 2º e 3º).' }),
                A.julgamento('Resultado do julgamento', ['Improcedente', 'Procedente'], {}, { obrigatoria: true }),
                A.escolha('Sanção aplicada', ['Censura', 'Censura convertida em advertência sem registro', 'Suspensão', 'Exclusão', 'Multa cumulada'], { obrigatoria: true, destino: 'autos', se: quando('Resultado do julgamento', 'Procedente'), ajuda: 'Lei 8.906/1994, arts. 35 a 40. A conversão da censura em advertência deve ser justificada no acórdão (CED, art. 61).' }),
                A.simNao('Decisão unânime?', { obrigatoria: true, ajuda: 'Recurso ao Conselho Federal só de decisão não unânime ou contrária à lei, ao CED ou a precedente (Lei 8.906, art. 75).' }),
                A.documento('Juntar o acórdão com ementa', 'Acórdão', { forma: 'redigir', ajuda: 'Com enquadramento, sanção, quórum, voto condutor, agravantes e atenuantes; o voto divergente vencido também vai aos autos (CED, arts. 61 e 62).' }),
                A.documento('Juntar a ata da sessão', 'Ata', { forma: 'redigir' }),
                A.comunicar('Intimar as partes do acórdão', { especie: 'intimacao', dias: 15, texto: 'Fica intimado do acórdão da Turma Julgadora. Cabem embargos de declaração e recurso ao Conselho Seccional em 15 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar as partes do acórdão', { obrigatoria: true }),
                A.escolha('Manifestação apresentada', ['Embargos de declaração', 'Recurso ao Conselho Seccional'], { obrigatoria: true, se: quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial') }),
            ],
            saidas: {
                'Embargos de declaração': quando('Manifestação apresentada', 'Embargos de declaração'),
                'Recurso ao Conselho Seccional': quando('Manifestação apresentada', 'Recurso ao Conselho Seccional'),
                'Execução e registro': quando('Aguardar o prazo de recurso', 'Sem manifestação'),
            },
        },
        {
            nome: 'Embargos de declaração', unidade: 'Turma Julgadora', vai: ['Recurso ao Conselho Seccional', 'Execução e registro'],
            orientacao: 'Os embargos vão ao redator do acórdão, que pode negar seguimento se forem protelatórios, intempestivos ou sem pressupostos (RI-TED/RS, art. 44; Regulamento Geral, art. 138, § 3º). Admitidos, são julgados em mesa na sessão seguinte, sem pauta; dessa decisão não cabe recurso (art. 138, §§ 4º e 5º). Depois, reabre-se o prazo de recurso ao Conselho Seccional (conferir no regimento).',
            acoes: [
                A.escolha('Juízo do redator', ['Admitidos', 'Seguimento negado'], { obrigatoria: true }),
                A.escolha('Resultado dos embargos', ['Acolhidos', 'Rejeitados'], { obrigatoria: true, destino: 'autos', partes: true, se: quando('Juízo do redator', 'Admitidos') }),
                A.documento('Juntar a decisão dos embargos', 'Acórdão', { forma: 'redigir' }),
                A.comunicar('Intimar as partes da decisão dos embargos', { especie: 'intimacao', dias: 15, texto: 'Fica intimado da decisão dos embargos de declaração. Cabe recurso ao Conselho Seccional em 15 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar as partes da decisão dos embargos', { obrigatoria: true }),
            ],
            saidas: { 'Recurso ao Conselho Seccional': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Execução e registro': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso ao Conselho Seccional', unidade: 'Câmara do Conselho Seccional', vai: ['Notificação e defesa prévia', 'Recurso ao Conselho Federal', 'Execução e registro'],
            orientacao: 'O recurso é interposto perante o órgão que decidiu e dirigido ao Conselho Seccional, com efeito suspensivo (Lei 8.906, arts. 76 e 77; RI-TED/RS, art. 42; Regulamento Geral, arts. 138 e 144). A admissibilidade é do relator do órgão julgador (Regulamento Geral, arts. 138, § 1º, e 140). Na OAB/RS, julgam as Câmaras Julgadoras do Conselho Seccional; confira a competência no Regimento Interno da Seccional.',
            acoes: [
                A.comunicar('Intimar a parte contrária para contrarrazões', { especie: 'intimacao', dias: 15, texto: 'Foi interposto recurso ao Conselho Seccional. Apresente contrarrazões em 15 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar as contrarrazões', 'Intimar a parte contrária para contrarrazões', { obrigatoria: true }),
                A.audiencia('Pautar a sessão da câmara', 'sessao'),
                A.escolha('Resultado do recurso', ['Provido', 'Provido em parte', 'Desprovido', 'Não conhecido', 'Provido para instaurar ou prosseguir'], { obrigatoria: true, destino: 'autos', partes: true, ajuda: 'Use a última opção quando o recurso for contra arquivamento ou indeferimento liminar e for provido.' }),
                A.simNao('Decisão unânime?', { obrigatoria: true }),
                A.documento('Juntar o acórdão do recurso', 'Acórdão', { forma: 'redigir' }),
                A.comunicar('Intimar as partes do acórdão do recurso', { especie: 'intimacao', dias: 15, texto: 'Fica intimado do acórdão do Conselho Seccional. Nas hipóteses do art. 75 da Lei 8.906/1994, cabe recurso ao Conselho Federal em 15 dias úteis.' }, { obrigatoria: true, se: quando('Resultado do recurso', 'Provido', 'Provido em parte', 'Desprovido', 'Não conhecido') }),
                A.esperar('Aguardar o prazo de recurso ao Conselho Federal', 'Intimar as partes do acórdão do recurso', { obrigatoria: true, se: quando('Resultado do recurso', 'Provido', 'Provido em parte', 'Desprovido', 'Não conhecido') }),
            ],
            saidas: {
                'Notificação e defesa prévia': quando('Resultado do recurso', 'Provido para instaurar ou prosseguir'),
                'Recurso ao Conselho Federal': quando('Aguardar o prazo de recurso ao Conselho Federal', 'Apresentada', 'Parcial'),
                'Execução e registro': quando('Aguardar o prazo de recurso ao Conselho Federal', 'Sem manifestação'),
            },
        },
        {
            nome: 'Recurso ao Conselho Federal', unidade: 'Conselho Federal', vai: ['Execução e registro'],
            orientacao: 'Cabe recurso ao Conselho Federal da decisão definitiva do Conselho Seccional não unânime ou, se unânime, contrária à lei, a decisão do Conselho Federal ou de outro Seccional, ao Regulamento Geral, ao CED ou aos provimentos; o Presidente do Seccional também pode recorrer (Lei 8.906, art. 75). Em matéria disciplinar, julga a Segunda Câmara do CFOAB. O relator do recurso no Seccional fica impedido (Regulamento Geral, art. 141).',
            acoes: [
                A.comunicar('Intimar a parte contrária para contrarrazões', { especie: 'intimacao', dias: 15, texto: 'Foi interposto recurso ao Conselho Federal. Apresente contrarrazões em 15 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar as contrarrazões', 'Intimar a parte contrária para contrarrazões', { obrigatoria: true }),
                A.escolha('Resultado do recurso', ['Provido', 'Provido em parte', 'Desprovido', 'Não conhecido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o acórdão do Conselho Federal', 'Acórdão', { forma: 'juntar' }),
                A.comunicar('Intimar as partes do acórdão do Conselho Federal', { especie: 'intimacao', dias: 0, texto: 'Fica intimado do acórdão do Conselho Federal da OAB.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Execução e registro', unidade: 'Presidência do TED', vai: ['Arquivamento'],
            orientacao: 'Transitada em julgado, o Presidente do TED aplica a sanção, manda recolher a identidade profissional de suspenso ou excluído e decide os pedidos de levantamento; da decisão dele cabe recurso à Turma (RI-TED/RS, arts. 7º, XII e XIII, e 47; Lei 8.906, art. 74). Comunique ao Conselho da inscrição principal (Lei 8.906, art. 70, § 2º). Revisão e reabilitação têm modelos próprios.',
            acoes: [
                A.simNao('Há sanção a executar?', { obrigatoria: true }),
                A.fazer('Anotar a sanção nos assentamentos do inscrito', { obrigatoria: true, destino: 'autos', se: quando('Há sanção a executar?', 'sim') }),
                A.fazer('Determinar o recolhimento da identidade profissional', { se: quando('Há sanção a executar?', 'sim'), ajuda: 'Na suspensão e na exclusão (RI-TED/RS, art. 7º, XIII; Lei 8.906, art. 74).' }),
                A.fazer('Comunicar ao Conselho da inscrição principal', { se: quando('Há sanção a executar?', 'sim') }),
                A.comunicar('Dar ciência ao representado da execução', { especie: 'ciencia', polos: ['requerido'], dias: 0, texto: 'Fica ciente da execução da sanção disciplinar aplicada.' }, { se: quando('Há sanção a executar?', 'sim') }),
                A.data('Data de término da suspensão', { se: quando('Há sanção a executar?', 'sim'), ajuda: 'Encerrado o prazo, o Presidente do TED determina o levantamento imediato (RI-TED/RS, art. 47, § 1º).' }),
                A.fazer('Certificar o trânsito em julgado', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Suspensão preventiva', unidade: 'Turma Julgadora', espera: true, avanco: 'auto', prazo_dias: 90, prazo_auto: true, prazo_contagem: corridos,
            orientacao: 'Com repercussão prejudicial à dignidade da advocacia, o TED do Conselho da inscrição principal pode suspender preventivamente o representado. O Presidente distribui com urgência a uma Turma, que ouve o representado em sessão especial, com defesa, prova e sustentação (Lei 8.906, art. 70, § 3º; CED, art. 63; RI-TED/RS, arts. 58 e 59). O recurso não suspende a medida e sobe por cópia (Lei 8.906, art. 77; Regulamento Geral, art. 144-A). Decretada, o processo termina em 90 dias.',
            acoes: [
                A.audiencia('Designar a sessão especial da Turma', 'sessao'),
                A.comunicar('Notificar o representado para a sessão especial', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Compareça à sessão especial em {audiencia}, com defensor se quiser, para ser ouvido e apresentar defesa e provas.' }, { obrigatoria: true }),
                A.escolha('Suspensão preventiva', ['Decretada', 'Não decretada'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o acórdão da sessão especial', 'Acórdão', { forma: 'redigir' }),
                A.comunicar('Intimar o representado da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado da decisão sobre a suspensão preventiva. O recurso não tem efeito suspensivo.' }, { obrigatoria: true }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria do TED', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Prescrição: 5 anos da constatação oficial do fato; 3 anos de paralisação pendente de despacho ou julgamento; interrupção pela instauração ou notificação válida e pela decisão condenatória recorrível (Lei 8.906, art. 43).' },
    ]);
}

/** 2. Revisão de processo disciplinar na OAB (Lei 8.906/1994, art. 73, § 5º; CED, art. 68). */
export function revisaoDisciplinarOab() {
    return montar({
        id: 'revisao-disciplinar-oab', nome: 'Revisão de processo disciplinar (OAB)', area: 'etica', porte: 'curto', referencia: 'OAB',
        descricao: 'Pedido do advogado punido para rever a condenação disciplinar já definitiva, por erro de julgamento ou por condenação baseada em prova falsa. O pedido é autuado em apenso ao processo e vai ao órgão que proferiu a condenação final, onde o relator examina a admissibilidade; se não conhecer, cabe recurso ao colegiado. Admitido, segue o rito do processo disciplinar no que couber, e o representante só é chamado se a revisão puder prejudicar o interesse que motivou a representação. O pedido não suspende a sanção, salvo tutela cautelar do relator. Termina com o julgamento que mantém, reduz ou desconstitui a condenação, anotado nos assentamentos.',
        quando: 'Condenação disciplinar da OAB transitada em julgado que o punido aponta como erro de julgamento ou baseada em prova falsa. Na OAB/RS, julga a Turma do TED que proferiu a condenação final; ajuste a unidade à sua seccional.',
        base: 'Lei 8.906/1994, art. 73, § 5º, e arts. 75 a 77; Código de Ética e Disciplina (Res. CFOAB 02/2015), art. 68; Regimento Interno do TED da OAB/RS, arts. 49 e 50; Regulamento Geral, art. 139 (prazos em dias úteis).',
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Requerente (advogado punido)', interessado: 'Representante original' } },
    }, [
        {
            nome: 'Pedido de revisão', unidade: 'Secretaria do TED', avanco: 'auto', ao_entrar: { sigilo: 'restrito' }, nome_publico: 'Pedido de revisão recebido',
            orientacao: 'Só o advogado punido pode pedir (CED, art. 68, § 1º), com fundamento em erro de julgamento ou em condenação baseada em prova falsa (Lei 8.906, art. 73, § 5º). Autue em separado e apense ao processo disciplinar (CED, art. 68, § 5º). Na OAB/RS, se a pena foi suspensão ou exclusão, o pedido só é processado com a entrega da carteira e do cartão de identidade (RI-TED/RS, art. 50, § 2º).',
            acoes: [
                A.formulario('Registrar o pedido', [
                    { id: 'processo', rotulo: 'Processo disciplinar revisando', tipo: 'texto', obrigatorio: true },
                    { id: 'orgao', rotulo: 'Órgão da condenação final', tipo: 'texto', obrigatorio: true },
                    { id: 'sancao', rotulo: 'Sanção aplicada', tipo: 'lista', obrigatorio: true, opcoes: ['Censura', 'Suspensão', 'Exclusão', 'Multa'] },
                    { id: 'fundamento', rotulo: 'Fundamento', tipo: 'lista', obrigatorio: true, opcoes: ['Erro de julgamento', 'Condenação baseada em prova falsa'] },
                    { id: 'razoes', rotulo: 'Razões do pedido', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o pedido de revisão e as provas', 'Requerimento', { forma: 'juntar' }),
                A.fazer('Apensar ao processo disciplinar', { obrigatoria: true }),
                A.documento('Juntar o termo de entrega da carteira e do cartão', 'Termo', { forma: 'juntar', nivel: 'opcional', ajuda: 'Exigido na OAB/RS quando a pena foi suspensão ou exclusão (RI-TED/RS, art. 50, § 2º).' }),
            ],
        },
        {
            nome: 'Admissibilidade', unidade: 'Relator',
            orientacao: 'O relator examina a admissibilidade (RI-TED/RS, art. 50). Pode conceder tutela cautelar para suspender a execução, ante a relevância dos fundamentos e o risco de dano irreparável (CED, art. 68, § 6º). Não conhecido o pedido, cabe recurso ao colegiado em 15 dias úteis (RI-TED/RS, art. 50, § 1º).',
            acoes: [
                A.escolha('Juízo de admissibilidade', ['Admitido', 'Não conhecido'], { obrigatoria: true, destino: 'autos' }),
                A.simNao('Concede tutela cautelar para suspender a execução?', { se: quando('Juízo de admissibilidade', 'Admitido') }),
                A.documento('Juntar a decisão do relator', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar o requerente do não conhecimento', { especie: 'intimacao', polos: ['requerente'], dias: 15, texto: 'O pedido de revisão não foi conhecido. Cabe recurso ao colegiado em 15 dias úteis.' }, { obrigatoria: true, se: quando('Juízo de admissibilidade', 'Não conhecido') }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar o requerente do não conhecimento', { obrigatoria: true, se: quando('Juízo de admissibilidade', 'Não conhecido') }),
            ],
            vai: ['Instrução e julgamento', 'Recurso da inadmissão', 'Arquivamento'],
            saidas: {
                'Instrução e julgamento': quando('Juízo de admissibilidade', 'Admitido'),
                'Recurso da inadmissão': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'),
                'Arquivamento': quando('Aguardar o prazo de recurso', 'Sem manifestação'),
            },
        },
        {
            nome: 'Recurso da inadmissão', unidade: 'Turma Julgadora', vai: ['Instrução e julgamento', 'Arquivamento'],
            orientacao: 'O colegiado do órgão competente decide se o pedido de revisão deve ser conhecido (RI-TED/RS, art. 50, § 1º).',
            acoes: [
                A.escolha('Resultado do recurso', ['Provido', 'Desprovido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do colegiado', 'Acórdão', { forma: 'redigir' }),
                A.comunicar('Intimar o requerente da decisão', { especie: 'intimacao', polos: ['requerente'], dias: 0, texto: 'Fica intimado da decisão sobre o recurso contra o não conhecimento do pedido de revisão.' }, { obrigatoria: true }),
            ],
            saidas: { 'Instrução e julgamento': quando('Resultado do recurso', 'Provido'), 'Arquivamento': quando('Resultado do recurso', 'Desprovido') },
        },
        {
            nome: 'Instrução e julgamento', unidade: 'Turma Julgadora', vai: ['Registro da decisão'], nome_publico: 'Julgamento da revisão',
            orientacao: 'Segue o rito do processo disciplinar no que couber (CED, art. 68, § 4º). Notifique o representante original só se a revisão puder causar dano ao interesse que motivou a representação (art. 68, § 7º). Julga o órgão da condenação final; no Conselho Federal, a Segunda Câmara em sessão plenária (art. 68, §§ 2º e 3º). Da decisão cabem os recursos do Estatuto (arts. 75 e 76).',
            acoes: [
                A.simNao('A revisão pode prejudicar o interesse do representante?', { obrigatoria: true }),
                A.comunicar('Notificar o representante original', { especie: 'notificacao', polos: ['interessado'], dias: 15, texto: 'Foi pedida a revisão do processo disciplinar em que você foi representante. Manifeste-se em 15 dias úteis, se quiser.' }, { se: quando('A revisão pode prejudicar o interesse do representante?', 'sim') }),
                A.esperar('Aguardar a manifestação do representante', 'Notificar o representante original', { se: quando('A revisão pode prejudicar o interesse do representante?', 'sim') }),
                A.documento('Juntar as provas produzidas', '', { forma: 'juntar', nivel: 'opcional' }),
                A.audiencia('Pautar a sessão de julgamento', 'sessao'),
                A.comunicar('Notificar o requerente da sessão', { especie: 'notificacao', polos: ['requerente'], dias: 0, texto: 'O pedido de revisão será julgado na sessão de {audiencia}, com direito a sustentação oral.' }, { obrigatoria: true }),
                A.escolha('Resultado da revisão', ['Procedente: condenação desconstituída', 'Procedente em parte: sanção reduzida', 'Improcedente'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o acórdão da revisão', 'Acórdão', { forma: 'redigir' }),
                A.comunicar('Intimar as partes do acórdão', { especie: 'intimacao', dias: 0, texto: 'Fica intimado do acórdão no pedido de revisão. Cabem os recursos previstos na Lei 8.906/1994.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Registro da decisão', unidade: 'Secretaria do TED', vai: ['Arquivamento'],
            orientacao: 'Transitada em julgado a revisão, anote o resultado nos assentamentos e comunique ao Conselho da inscrição principal. Procedente, levante a sanção ou ajuste o registro.',
            acoes: [
                A.fazer('Anotar o resultado nos assentamentos do inscrito', { obrigatoria: true, destino: 'autos' }),
                A.fazer('Comunicar ao Conselho da inscrição principal'),
                A.fazer('Certificar o trânsito em julgado', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria do TED', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, em apenso ao processo disciplinar.' },
    ]);
}

/** 3. Reabilitação de inscrito punido na OAB (Lei 8.906/1994, art. 41; CED, art. 69). */
export function reabilitacaoOab() {
    return montar({
        id: 'reabilitacao-oab', nome: 'Reabilitação de inscrito punido (OAB)', area: 'etica', porte: 'curto', referencia: 'OAB',
        descricao: 'Pedido de quem sofreu sanção disciplinar na OAB para ser reabilitado, depois de um ano do cumprimento da sanção, com provas efetivas de bom comportamento na advocacia e na vida social. O pedido é autuado em apenso ao processo disciplinar e corre no Conselho Seccional que aplicou a sanção; a Secretaria certifica o cumprimento da pena e um relator instrui. Julga o órgão competente do Conselho Seccional; indeferido, cabe recurso em 15 dias úteis, com efeito suspensivo. Termina com a anotação da reabilitação nos assentamentos ou com o arquivamento.',
        quando: 'Inscrito que cumpriu sanção disciplinar há mais de um ano e quer a reabilitação. Ajuste o órgão julgador ao regimento da sua seccional.',
        base: 'Lei 8.906/1994, arts. 41 e 75 a 77; Código de Ética e Disciplina (Res. CFOAB 02/2015), art. 69; Regulamento Geral, art. 139. Órgão julgador no Conselho Seccional: conferir na norma vigente da seccional.',
        tipo: { polos: ['requerente'], nomes_polos: { requerente: 'Requerente' } },
    }, [
        {
            nome: 'Pedido de reabilitação', unidade: 'Secretaria do Conselho Seccional', avanco: 'auto', ao_entrar: { sigilo: 'restrito' }, nome_publico: 'Pedido recebido',
            orientacao: 'O pedido cabe um ano depois do cumprimento da sanção, com provas efetivas de bom comportamento (Lei 8.906, art. 41). Se a sanção resultou da prática de crime, depende também da reabilitação criminal (art. 41, parágrafo único). Competente é o Conselho Seccional que aplicou a sanção, ou o Conselho Federal na competência originária (CED, art. 69, § 1º). Autue em separado e apense (art. 69, § 3º).',
            acoes: [
                A.formulario('Registrar o pedido', [
                    { id: 'processo', rotulo: 'Processo disciplinar de origem', tipo: 'texto', obrigatorio: true },
                    { id: 'sancao', rotulo: 'Sanção cumprida', tipo: 'lista', obrigatorio: true, opcoes: ['Censura', 'Suspensão', 'Exclusão', 'Multa'] },
                    { id: 'fim_cumprimento', rotulo: 'Data do fim do cumprimento', tipo: 'data', obrigatorio: true },
                    { id: 'reab_judicial', rotulo: 'A sanção decorreu de fato que exige reabilitação judicial?', tipo: 'lista', obrigatorio: true, opcoes: ['Sim', 'Não'] },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true, ajuda: 'O pedido só cabe depois de um ano do fim do cumprimento (Lei 8.906, art. 41).' }),
                A.documento('Juntar o pedido e as provas de bom comportamento', 'Requerimento', { forma: 'juntar' }),
                A.documento('Juntar a certidão de reabilitação judicial', 'Certidão', { forma: 'juntar', nivel: 'opcional', ajuda: 'Exigida quando a sanção resultou de fato que também gerou condenação judicial (Lei 8.906, art. 41, parágrafo único).' }),
            ],
        },
        {
            nome: 'Certidão e instrução', unidade: 'Relator', avanco: 'auto', vai: ['Julgamento'],
            orientacao: 'A Secretaria certifica nos autos o efetivo cumprimento da sanção (CED, art. 69, § 4º). O relator confere o prazo de um ano e as provas de bom comportamento no exercício da advocacia e na vida social, ordena diligências se preciso e emite parecer, seguindo o rito do processo disciplinar no que couber (art. 69, § 2º).',
            acoes: [
                A.documento('Juntar a certidão de cumprimento da sanção', 'Certidão', { forma: 'redigir' }),
                A.texto('Relator designado', { obrigatoria: true, destino: 'informacao' }),
                A.documento('Juntar diligências e informações', '', { forma: 'juntar', nivel: 'opcional' }),
                A.documento('Juntar o parecer do relator', 'Parecer', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Julgamento', unidade: 'Conselho Seccional', vai: ['Registro da reabilitação', 'Prazo de recurso do indeferimento'],
            orientacao: 'O órgão competente do Conselho Seccional julga o pedido em sessão, com sustentação oral do requerente. Deferida, anote; indeferida, intime para recurso.',
            acoes: [
                A.audiencia('Pautar a sessão de julgamento', 'sessao'),
                A.comunicar('Notificar o requerente da sessão', { especie: 'notificacao', polos: ['requerente'], dias: 0, texto: 'O pedido de reabilitação será julgado na sessão de {audiencia}.' }, { obrigatoria: true }),
                A.escolha('Resultado do pedido', ['Deferido', 'Indeferido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão', 'Acórdão', { forma: 'redigir' }),
            ],
            saidas: { 'Registro da reabilitação': quando('Resultado do pedido', 'Deferido'), 'Prazo de recurso do indeferimento': quando('Resultado do pedido', 'Indeferido') },
        },
        {
            nome: 'Prazo de recurso do indeferimento', unidade: 'Secretaria do Conselho Seccional', avanco: 'auto', vai: ['Recurso', 'Arquivamento'],
            orientacao: 'Intime o requerente. O recurso cabe em 15 dias úteis (Lei 8.906, art. 69; Regulamento Geral, art. 139), ao Conselho Federal nas hipóteses do art. 75 ou, se a decisão for de órgão interno, ao órgão superior do Seccional (art. 76).',
            acoes: [
                A.comunicar('Intimar o requerente do indeferimento', { especie: 'intimacao', polos: ['requerente'], dias: 15, texto: 'O pedido de reabilitação foi indeferido. Cabe recurso em 15 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar o requerente do indeferimento', { obrigatoria: true }),
            ],
            saidas: { 'Recurso': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Arquivamento': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso', unidade: 'Conselho Federal', vai: ['Registro da reabilitação', 'Arquivamento'],
            orientacao: 'O recurso tem efeito suspensivo (Lei 8.906, art. 77) e é dirigido ao órgão superior, embora interposto perante o que decidiu (Regulamento Geral, art. 138).',
            acoes: [
                A.escolha('Resultado do recurso', ['Provido', 'Desprovido', 'Não conhecido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o acórdão do recurso', 'Acórdão', { forma: 'juntar' }),
                A.comunicar('Intimar o requerente do acórdão', { especie: 'intimacao', polos: ['requerente'], dias: 0, texto: 'Fica intimado do acórdão do recurso no pedido de reabilitação.' }, { obrigatoria: true }),
            ],
            saidas: { 'Registro da reabilitação': quando('Resultado do recurso', 'Provido'), 'Arquivamento': quando('Resultado do recurso', 'Desprovido', 'Não conhecido') },
        },
        {
            nome: 'Registro da reabilitação', unidade: 'Secretaria do Conselho Seccional', vai: ['Arquivamento'],
            orientacao: 'Anote a reabilitação nos assentamentos do inscrito e dê ciência ao requerente.',
            acoes: [
                A.fazer('Anotar a reabilitação nos assentamentos', { obrigatoria: true, destino: 'autos' }),
                A.comunicar('Dar ciência ao requerente', { especie: 'ciencia', polos: ['requerente'], dias: 0, texto: 'A reabilitação foi deferida e anotada nos seus assentamentos.' }, { obrigatoria: true }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria do Conselho Seccional', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, em apenso ao processo disciplinar.' },
    ]);
}

/** 4. Processo ético-disciplinar do CAU (Lei 12.378/2010; Res. CAU/BR 143/2017, alterada pela Res. 224/2022). */
export function processoEticoDisciplinarCau() {
    return montar({
        id: 'etico-disciplinar-cau', nome: 'Processo ético-disciplinar do CAU', area: 'etica', porte: 'longo', referencia: 'CAU/BR',
        descricao: 'Apura infração ao Código de Ética e Disciplina por arquiteto e urbanista ou sociedade registrada no CAU. Começa por denúncia identificada, denúncia anônima ou de ofício; a fiscalização confere registro e RRT, e um relator da Comissão de Ética e Disciplina do CAU/UF dá parecer de admissibilidade, que a comissão decide; da inadmissão cabe recurso ao Plenário do CAU/UF. A conciliação pode ser tentada antes da admissão ou na instrução, e o termo de ajustamento de conduta cabe nos processos de ofício de interesse coletivo. Admitida a denúncia, o denunciado tem 30 dias para defesa, há saneamento, provas, audiência de instrução una, alegações finais em 10 dias, relatório e voto do relator e julgamento pela comissão, com sustentação oral de 10 minutos e nomes ocultos. Cabe recurso em 30 dias ao Plenário do CAU/UF e, depois, ao Plenário do CAU/BR, ambos com efeito suspensivo. Termina com a execução da sanção (advertência reservada ou pública, suspensão, cancelamento do registro ou multa) ou com o arquivamento.',
        quando: 'Denúncia ou notícia de infração ética de profissional ou sociedade registrada no CAU. Quando a comissão de ética reúne metade dos conselheiros do Plenário, quem julga em primeira instância é o Plenário: ajuste as unidades.',
        base: 'Lei 12.378/2010, arts. 17 a 23; Res. CAU/BR 52/2013 (Código de Ética e Disciplina); Res. CAU/BR 143/2017, com a redação da Res. 224/2022 (vigência ajustada pelas Res. 232/2023 e 239/2023, conferir na norma vigente), arts. 5º, 9º a 13-B, 18 a 47, 49-A a 62, 68 a 88, 91, 91-A, 92, 93, 98 a 100 e 114 a 119.',
        tipo: { polos: ['requerente', 'requerido'], nomes_polos: { requerente: 'Denunciante', requerido: 'Denunciado' } },
    }, [
        {
            nome: 'Denúncia', unidade: 'Secretaria da CED', avanco: 'auto', ao_entrar: { sigilo: 'restrito' }, nome_publico: 'Denúncia recebida',
            orientacao: 'A denúncia é escrita e identificada, com qualificação do denunciante e do denunciado, fatos com datas, provas, até 5 testemunhas, RRT relacionados e, se quiser, pedido de sigilo (Res. 143, arts. 9º e 11). De ofício, a partir de fiscalização, comunicação de autoridade ou denúncia anônima (art. 9º, § 2º; arts. 13-A e 13-B). O nome do denunciado fica em sigilo até sua manifestação (art. 21, § 1º).',
            acoes: [
                A.formulario('Registrar os dados da denúncia', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['Denúncia identificada', 'Denúncia anônima', 'De ofício por fiscalização', 'Comunicação de autoridade'] },
                    { id: 'denunciado', rotulo: 'Profissional ou sociedade denunciada', tipo: 'texto', obrigatorio: true },
                    { id: 'registro', rotulo: 'Número de registro no CAU', tipo: 'texto', obrigatorio: true },
                    { id: 'data_fato', rotulo: 'Data do fato', tipo: 'data', obrigatorio: true },
                    { id: 'rrt', rotulo: 'RRT relacionados', tipo: 'texto', obrigatorio: false },
                    { id: 'fatos', rotulo: 'Relato dos fatos', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'sigilo', rotulo: 'Pedido de sigilo', tipo: 'lista', obrigatorio: true, opcoes: ['Sim', 'Não'] },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true, ajuda: 'A prescrição é de 5 anos da data do fato (Lei 12.378, art. 23).' }),
                A.documento('Juntar a denúncia e as provas', 'Denúncia', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Providências da fiscalização', unidade: 'Fiscalização', prazo_dias: 10, prazo_auto: true, avanco: 'auto', vai: ['Admissibilidade'],
            orientacao: 'Em até 10 dias úteis, a fiscalização confere a situação do registro do denunciado e os RRT ligados ao fato (Res. 143, art. 18, § 2º). Na denúncia anônima, faz as diligências iniciais no mesmo prazo (art. 13-A). Se houver também infração à lei, como exercício ilegal, abra a ação de fiscalização própria (art. 18, § 3º).',
            acoes: [
                A.documento('Juntar o relatório da situação do registro e dos RRT', 'Relatório', { forma: 'redigir' }),
                A.simNao('Há também infração à legislação a fiscalizar?', { obrigatoria: true }),
                A.fazer('Abrir a ação de fiscalização', { se: quando('Há também infração à legislação a fiscalizar?', 'sim') }),
                A.texto('Conselheiro relator designado', { obrigatoria: true, destino: 'informacao', ajuda: 'Designado pela coordenação da CED por distribuição, até a reunião seguinte ao recebimento (Res. 143, art. 19).' }),
            ],
        },
        {
            nome: 'Admissibilidade', unidade: 'Comissão de ética e disciplina', vai: ['Notificação e defesa', 'Prazo de recurso da inadmissão', 'Conciliação ou TAC'],
            orientacao: 'O relator apresenta parecer na reunião seguinte à distribuição, examinando os requisitos do art. 11, a competência, a legitimidade, a tipicidade e a prescrição; a CED decide logo após a leitura (Res. 143, arts. 20 e 21). Denúncia com defeito: o denunciante tem 10 dias para emendar (art. 20, § 2º). Conduta conciliável pode ir à conciliação antes da decisão (art. 91).',
            acoes: [
                A.simNao('A denúncia precisa ser emendada?', { obrigatoria: true }),
                A.comunicar('Intimar o denunciante para emendar a denúncia', { especie: 'intimacao', polos: ['requerente'], dias: 10, contagem: corridos, texto: 'A denúncia precisa ser complementada. Envie as informações indicadas em 10 dias, sob pena de não admissão.' }, { obrigatoria: true, se: quando('A denúncia precisa ser emendada?', 'sim') }),
                A.esperar('Aguardar a emenda', 'Intimar o denunciante para emendar a denúncia', { obrigatoria: true, se: quando('A denúncia precisa ser emendada?', 'sim') }),
                A.documento('Juntar o parecer de admissibilidade', 'Parecer', { forma: 'redigir' }),
                A.audiencia('Pautar a reunião da CED', 'reuniao'),
                A.escolha('Decisão da CED', ['Admitir', 'Não admitir', 'Encaminhar à conciliação ou TAC'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a deliberação da CED', 'Deliberação', { forma: 'redigir' }),
            ],
            saidas: {
                'Notificação e defesa': quando('Decisão da CED', 'Admitir'),
                'Prazo de recurso da inadmissão': quando('Decisão da CED', 'Não admitir'),
                'Conciliação ou TAC': quando('Decisão da CED', 'Encaminhar à conciliação ou TAC'),
            },
        },
        {
            nome: 'Prazo de recurso da inadmissão', unidade: 'Secretaria da CED', avanco: 'auto', vai: ['Recurso da inadmissão', 'Arquivamento'], nome_publico: 'Denúncia não admitida',
            orientacao: 'Intime o denunciante. O recurso ao Plenário do CAU/UF cabe em 10 dias, protocolado na CED (Res. 143, art. 22).',
            acoes: [
                A.comunicar('Intimar o denunciante da inadmissão', { especie: 'intimacao', polos: ['requerente'], dias: 10, contagem: corridos, texto: 'A denúncia não foi admitida pela Comissão de Ética e Disciplina. Cabe recurso ao Plenário do CAU/UF em 10 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar o denunciante da inadmissão', { obrigatoria: true }),
            ],
            saidas: { 'Recurso da inadmissão': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Arquivamento': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso da inadmissão', unidade: 'Plenário do CAU/UF', vai: ['Notificação e defesa', 'Arquivamento'],
            orientacao: 'A CED pode reconsiderar; mantida a decisão, o Plenário do CAU/UF julga (Res. 143, art. 22, § 2º). Da decisão do Plenário cabe recurso ao CAU/BR em 10 dias (art. 22, § 3º); havendo, repita esta fase com a unidade do CAU/BR.',
            acoes: [
                A.escolha('Resultado', ['Reconsiderada pela CED', 'Provido pelo Plenário', 'Desprovido'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a decisão', 'Deliberação', { forma: 'redigir' }),
                A.comunicar('Intimar o denunciante da decisão', { especie: 'intimacao', polos: ['requerente'], dias: 0, texto: 'Fica intimado da decisão sobre o recurso contra a não admissão da denúncia.' }, { obrigatoria: true }),
            ],
            saidas: { 'Notificação e defesa': quando('Resultado', 'Reconsiderada pela CED', 'Provido pelo Plenário'), 'Arquivamento': quando('Resultado', 'Desprovido') },
        },
        {
            nome: 'Conciliação ou TAC', unidade: 'Comissão de ética e disciplina', vai: ['Cumprimento do acordo', 'Notificação e defesa', 'Audiência de instrução'],
            condicoes: { 'Audiência de instrução': 'Se a conciliação foi tentada durante a instrução e não houve acordo, o processo volta à instrução.' },
            orientacao: 'O relator propõe audiência de conciliação para conduta conciliável, antes da admissão ou na instrução; não se concilia dano à integridade física, a terceiros, ao interesse público, ao patrimônio público ou ao meio ambiente. A CED homologa com renúncia expressa ao recurso, e a prescrição fica suspensa (Res. 143, art. 91). No processo de ofício de interesse coletivo cabe TAC, público e registrado no SICCAU, um a cada 5 anos (art. 91-A).',
            acoes: [
                A.escolha('Instrumento', ['Conciliação', 'Termo de ajustamento de conduta'], { obrigatoria: true }),
                A.simNao('A conduta envolve dano à integridade física, a terceiros, ao interesse público, ao patrimônio ou ao meio ambiente?', { obrigatoria: true, ajuda: 'Se sim, a conciliação não é admitida (Res. 143, art. 91).' }),
                A.audiencia('Designar a audiência de conciliação', 'conciliacao'),
                A.comunicar('Intimar as partes para a audiência', { especie: 'intimacao', dias: 0, texto: 'Compareça à audiência de conciliação em {audiencia}.' }, { obrigatoria: true }),
                A.escolha('Resultado', ['Acordo homologado', 'Sem acordo'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o termo de acordo ou TAC homologado', 'Termo', { forma: 'redigir', se: quando('Resultado', 'Acordo homologado'), ajuda: 'Com obrigações, prazo, forma de comprovação, consequências do descumprimento e renúncia ao recurso (Res. 143, arts. 91 e 91-A).' }),
            ],
            saidas: { 'Cumprimento do acordo': quando('Resultado', 'Acordo homologado'), 'Notificação e defesa': quando('Resultado', 'Sem acordo') },
        },
        {
            nome: 'Cumprimento do acordo', unidade: 'Comissão de ética e disciplina', vai: ['Arquivamento', 'Notificação e defesa', 'Audiência de instrução'],
            condicoes: { 'Audiência de instrução': 'Se o acordo descumprido foi firmado durante a instrução, o processo retoma desse ponto.' },
            orientacao: 'Acompanhe o cumprimento. Cumprido, arquive. Descumprido, qualquer parte pode pedir o desarquivamento, e o processo retoma do ponto anterior à conciliação ou ao TAC (Res. 143, arts. 91 e 91-A).',
            acoes: [
                A.data('Prazo final do acordo', { obrigatoria: true, destino: 'informacao' }),
                A.simNao('O acordo foi cumprido?', { obrigatoria: true, destino: 'autos' }),
                A.fazer('Registrar o TAC no SICCAU', { ajuda: 'Só para TAC, que tem caráter público (Res. 143, art. 91-A).' }),
            ],
            saidas: { 'Arquivamento': quando('O acordo foi cumprido?', 'sim'), 'Notificação e defesa': quando('O acordo foi cumprido?', 'nao') },
        },
        {
            nome: 'Notificação e defesa', unidade: 'Comissão de ética e disciplina', avanco: 'auto', vai: ['Saneamento e provas'], nome_publico: 'Defesa',
            orientacao: 'Notifique as partes. O denunciado recebe a forma de instauração, os fatos, os dispositivos violados, as sanções possíveis e o prazo de 30 dias para defesa com provas e até 5 testemunhas, além da opção de sigilo (Res. 143, art. 23). Meios: AR, SICCAU, e-mail, aplicativo ou edital por 15 dias (art. 99). A intimação para defesa interrompe a prescrição (Lei 12.378, art. 23). Sem defesa, o relator declara a revelia, que não presume os fatos (arts. 32 e 33).',
            acoes: [
                A.comunicar('Notificar o denunciado para defesa', { especie: 'notificacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Foi admitida denúncia ético-disciplinar contra você, nos termos anexos. Apresente defesa em 30 dias, com provas e até 5 testemunhas. Você pode pedir sigilo e ser representado por advogado.' }, { obrigatoria: true }),
                A.comunicar('Dar ciência ao denunciante da admissão', { especie: 'ciencia', polos: ['requerente'], dias: 0, texto: 'A denúncia foi admitida e o processo ético-disciplinar seguirá.' }),
                A.esperar('Aguardar a defesa', 'Notificar o denunciado para defesa', { obrigatoria: true }),
                A.documento('Juntar a declaração de revelia', 'Despacho', { forma: 'redigir', se: quando('Aguardar a defesa', 'Sem manifestação'), ajuda: 'A revelia não presume os fatos nem agrava a sanção; o denunciado pode entrar no processo a qualquer tempo (Res. 143, arts. 32 a 35).' }),
            ],
        },
        {
            nome: 'Saneamento e provas', unidade: 'Relator', prazo_dias: 180, prazo_auto: true, prazo_contagem: corridos, vai: ['Audiência de instrução', 'Conciliação ou TAC'],
            orientacao: 'A instrução tem 180 dias da admissão, prorrogáveis por 60 com aprovação da CED (Res. 143, art. 24). O relator fixa os pontos controvertidos e as provas; fato novo na defesa abre réplica de 15 dias ao denunciante (art. 31). Só se recusa prova ilícita, impertinente, desnecessária ou protelatória (arts. 25 e 26). Perícia é paga antes por quem a pede (art. 30, § 1º).',
            acoes: [
                A.documento('Juntar o despacho de saneamento', 'Despacho', { forma: 'redigir' }),
                A.simNao('A defesa trouxe fato novo?', { obrigatoria: true }),
                A.comunicar('Intimar o denunciante para réplica', { especie: 'intimacao', polos: ['requerente'], dias: 15, contagem: corridos, texto: 'A defesa trouxe fatos novos. Manifeste-se em 15 dias, se quiser.' }, { se: quando('A defesa trouxe fato novo?', 'sim') }),
                A.esperar('Aguardar a réplica', 'Intimar o denunciante para réplica', { se: quando('A defesa trouxe fato novo?', 'sim') }),
                A.documento('Juntar documentos, diligências, pareceres técnicos e perícias', '', { forma: 'juntar', nivel: 'recomendado', ajuda: 'Pareceres técnicos e perícias trazem os RRT respectivos (Res. 143, art. 30, § 2º).' }),
                A.simNao('Instrução prorrogada por 60 dias?', { ajuda: 'Depende de aprovação da CED (Res. 143, art. 24, parágrafo único).' }),
            ],
        },
        {
            nome: 'Audiência de instrução', unidade: 'Relator', vai: ['Alegações finais', 'Conciliação ou TAC'],
            orientacao: 'Notifique as partes com 15 dias de antecedência; o rol de testemunhas vem até 10 dias antes, e as testemunhas são notificadas com 3 dias úteis (Res. 143, art. 36). A audiência é una e contínua; suspensão de no máximo 15 dias (art. 37). Ordem: denunciante, testemunhas do denunciante, do denunciado e o denunciado; cabe acareação; depoimento a distância ou por questionário escrito (arts. 36 a 46).',
            acoes: [
                A.audiencia('Designar a audiência de instrução', 'instrucao'),
                A.comunicar('Intimar as partes para a audiência', { especie: 'intimacao', dias: 0, texto: 'Compareça à audiência de instrução em {audiencia}. Apresente o rol de testemunhas até 10 dias antes.' }, { obrigatoria: true, ajuda: 'Com pelo menos 15 dias de antecedência (Res. 143, art. 36).' }),
                A.fazer('Notificar as testemunhas', { ajuda: 'Com pelo menos 3 dias úteis de antecedência (Res. 143, art. 36, § 5º).' }),
                A.orientar('Ordem das oitivas', 'Denunciante, testemunhas do denunciante, testemunhas do denunciado e, por último, o denunciado (Res. 143, arts. 38 a 46).'),
                A.documento('Juntar o termo de audiência e os depoimentos', 'Termo', { forma: 'qualquer' }),
            ],
        },
        {
            nome: 'Alegações finais', unidade: 'Secretaria da CED', avanco: 'auto', vai: ['Relatório e voto'],
            orientacao: 'Encerrada a instrução, as partes têm 10 dias para alegações finais (Res. 143, art. 47).',
            acoes: [
                A.comunicar('Intimar as partes para alegações finais', { especie: 'intimacao', dias: 10, contagem: corridos, texto: 'Encerrada a instrução, apresente alegações finais em 10 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar as alegações finais', 'Intimar as partes para alegações finais', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Relatório e voto', unidade: 'Relator', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, avanco: 'auto', vai: ['Julgamento pela CED'],
            orientacao: 'Em 30 dias depois das alegações finais, o relator elabora relatório (partes, denúncia, defesa, ocorrências) e voto fundamentado, propondo arquivamento ou sanção com a dosimetria dos arts. 68 a 76. O relatório fica à disposição dos conselheiros pelo menos 7 dias antes do julgamento (Res. 143, art. 49-A).',
            acoes: [A.documento('Juntar o relatório e o voto fundamentado', 'Relatório', { forma: 'redigir', ajuda: 'Gradue cada norma violada como leve, média ou grave e aplique agravantes e atenuantes do Anexo (Res. 143, arts. 69 a 72-A).' })],
        },
        {
            nome: 'Julgamento pela CED', unidade: 'Comissão de ética e disciplina', prazo_dias: 60, prazo_auto: true, prazo_contagem: corridos, vai: ['Recurso ao Plenário do CAU/UF', 'Execução da sanção', 'Arquivamento'], nome_publico: 'Julgamento',
            orientacao: 'Julgue em até 60 dias do recebimento do relatório, sem contar a vista (Res. 143, art. 49-D). Rito: impedimentos e suspeições, leitura do relatório, sustentação de até 10 minutos do denunciante e depois do denunciado, debate e votação por maioria simples; nomes ocultos e sessão sem transmissão (art. 49-C). Voto vencido: novo relator na reunião seguinte. Recurso em 30 dias, com efeito suspensivo (arts. 49-E e 50).',
            acoes: [
                A.audiencia('Pautar a reunião de julgamento', 'sessao'),
                A.comunicar('Intimar as partes da reunião de julgamento', { especie: 'intimacao', dias: 0, texto: 'O processo será julgado na reunião de {audiencia}. Cada parte pode fazer sustentação oral por até 10 minutos.' }, { obrigatoria: true }),
                A.simNao('Houve pedido de vista?', { ajuda: 'A votação passa para a reunião seguinte (Res. 143, art. 49-C).' }),
                A.julgamento('Resultado do julgamento', ['Arquivamento', 'Sanção'], {}, { obrigatoria: true }),
                A.escolha('Sanção aplicada', ['Advertência reservada', 'Advertência pública', 'Suspensão de 30 dias a 1 ano', 'Cancelamento do registro'], { obrigatoria: true, destino: 'autos', se: quando('Resultado do julgamento', 'Sanção'), ajuda: 'Res. 143, art. 62; Lei 12.378, art. 19. A multa de 1 a 10 anuidades pode ser cumulada.' }),
                A.simNao('Multa cumulada?', { se: quando('Resultado do julgamento', 'Sanção') }),
                A.documento('Juntar a deliberação e o voto vencedor', 'Deliberação', { forma: 'redigir' }),
                A.comunicar('Intimar as partes da decisão', { especie: 'intimacao', dias: 30, contagem: corridos, texto: 'Fica intimado da decisão da Comissão de Ética e Disciplina. Cabe recurso ao Plenário do CAU/UF em 30 dias, com efeito suspensivo.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar as partes da decisão', { obrigatoria: true }),
                A.escolha('Situação sem recurso', ['Há sanção a executar', 'Arquivar'], { obrigatoria: true, se: quando('Aguardar o prazo de recurso', 'Sem manifestação') }),
            ],
            saidas: {
                'Recurso ao Plenário do CAU/UF': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'),
                'Execução da sanção': quando('Situação sem recurso', 'Há sanção a executar'),
                'Arquivamento': quando('Situação sem recurso', 'Arquivar'),
            },
        },
        {
            nome: 'Recurso ao Plenário do CAU/UF', unidade: 'Plenário do CAU/UF', vai: ['Recurso ao Plenário do CAU/BR', 'Execução da sanção', 'Arquivamento'],
            orientacao: 'Recurso em 30 dias, com efeito suspensivo; contrarrazões em 30 dias; admissibilidade por tempestividade e legitimidade (Res. 143, art. 50). O presidente designa relator, que apresenta relatório até a segunda reunião plenária seguinte; o julgamento é na mesma sessão, salvo vista (arts. 51 a 53). Nomes ocultos (art. 52, § 1º).',
            acoes: [
                A.comunicar('Intimar a parte contrária para contrarrazões', { especie: 'intimacao', dias: 30, contagem: corridos, texto: 'Foi interposto recurso ao Plenário do CAU/UF. Apresente contrarrazões em 30 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar as contrarrazões', 'Intimar a parte contrária para contrarrazões', { obrigatoria: true }),
                A.texto('Conselheiro relator do recurso', { obrigatoria: true, destino: 'informacao' }),
                A.audiencia('Pautar a sessão plenária', 'sessao'),
                A.escolha('Resultado do recurso', ['Mantida a sanção', 'Sanção alterada', 'Reformada para arquivar', 'Reformada para aplicar sanção', 'Não conhecido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a deliberação plenária', 'Deliberação', { forma: 'redigir' }),
                A.comunicar('Intimar as partes da deliberação', { especie: 'intimacao', dias: 30, contagem: corridos, texto: 'Fica intimado da deliberação do Plenário do CAU/UF. Cabe recurso ao Plenário do CAU/BR em 30 dias, com efeito suspensivo.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso ao CAU/BR', 'Intimar as partes da deliberação', { obrigatoria: true }),
                A.escolha('Situação sem recurso', ['Há sanção a executar', 'Arquivar'], { obrigatoria: true, se: quando('Aguardar o prazo de recurso ao CAU/BR', 'Sem manifestação') }),
            ],
            saidas: {
                'Recurso ao Plenário do CAU/BR': quando('Aguardar o prazo de recurso ao CAU/BR', 'Apresentada', 'Parcial'),
                'Execução da sanção': quando('Situação sem recurso', 'Há sanção a executar'),
                'Arquivamento': quando('Situação sem recurso', 'Arquivar'),
            },
        },
        {
            nome: 'Recurso ao Plenário do CAU/BR', unidade: 'Plenário do CAU/BR', vai: ['Execução da sanção', 'Arquivamento'],
            orientacao: 'Recurso em 30 dias, com efeito suspensivo e contrarrazões em 30 (Res. 143, art. 55; Lei 12.378, art. 22). A CED-CAU/BR designa relator, que relata até a segunda reunião seguinte; o Plenário do CAU/BR julga com sustentação de até 10 minutos, em até 60 dias (arts. 56 a 60). Certificado o trânsito, os autos voltam ao CAU/UF para execução (art. 61).',
            acoes: [
                A.comunicar('Intimar a parte contrária para contrarrazões', { especie: 'intimacao', dias: 30, contagem: corridos, texto: 'Foi interposto recurso ao Plenário do CAU/BR. Apresente contrarrazões em 30 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar as contrarrazões', 'Intimar a parte contrária para contrarrazões', { obrigatoria: true }),
                A.audiencia('Pautar a sessão do Plenário do CAU/BR', 'sessao'),
                A.escolha('Resultado do recurso', ['Há sanção a executar', 'Arquivamento'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a deliberação do CAU/BR', 'Deliberação', { forma: 'juntar' }),
                A.comunicar('Intimar as partes da deliberação final', { especie: 'intimacao', dias: 0, texto: 'Fica intimado da deliberação do Plenário do CAU/BR, última instância administrativa.' }, { obrigatoria: true }),
                A.fazer('Certificar o trânsito em julgado e devolver ao CAU/UF', { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Execução da sanção': quando('Resultado do recurso', 'Há sanção a executar'), 'Arquivamento': quando('Resultado do recurso', 'Arquivamento') },
        },
        {
            nome: 'Execução da sanção', unidade: 'Secretaria da CED', vai: ['Arquivamento'],
            orientacao: 'O CAU/UF executa depois de intimado o profissional (Res. 143, art. 77). Advertência reservada: ofício pelo SICCAU, sem publicação. Pública: publicação por 30 dias. Suspensão: interrupção do registro e bloqueio no SICCAU. Cancelamento: devolução da carteira em 10 dias e publicação. Multa: boleto no SICCAU em 30 dias, com parcelamento (arts. 78 a 88). Cabe revisão por fato novo, sem efeito suspensivo (arts. 92 e 93).',
            acoes: [
                A.escolha('Sanção a executar', ['Advertência reservada', 'Advertência pública', 'Suspensão', 'Cancelamento do registro', 'Somente multa'], { obrigatoria: true, destino: 'autos' }),
                A.comunicar('Intimar o profissional da execução', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado do início da execução da sanção ético-disciplinar, conforme ofício anexo.' }, { obrigatoria: true }),
                A.fazer('Publicar a sanção', { se: quando('Sanção a executar', 'Advertência pública', 'Suspensão', 'Cancelamento do registro'), ajuda: 'Advertência pública por 30 dias; suspensão pelo período; cancelamento por 1 ano no quadro e sem prazo no site (Res. 143, arts. 80 a 86).' }),
                A.fazer('Bloquear o registro no SICCAU', { se: quando('Sanção a executar', 'Suspensão', 'Cancelamento do registro') }),
                A.simNao('Há multa a cobrar?', { obrigatoria: true }),
                A.fazer('Acompanhar a emissão do boleto e o pagamento da multa', { se: quando('Há multa a cobrar?', 'sim'), ajuda: 'O profissional emite o boleto no SICCAU em 30 dias da ciência do trânsito; depois disso há correção pelo INPC (Res. 143, art. 88).' }),
                A.orientar('Reabilitação', 'Automática ao fim de cada sanção; depois do cancelamento, só a pedido após 3 anos do início do cumprimento, julgado pelo Plenário do CAU/UF (Res. 143, arts. 117 a 119).'),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria da CED', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Prescrição: 5 anos da data do fato, interrompida pela intimação para defesa; processo parado por mais de 3 anos é extinto (Lei 12.378, art. 23; Res. 143, arts. 114 e 115).' },
    ]);
}

/** 5. Fiscalização do exercício profissional no CAU com auto de infração (Res. CAU/BR 198/2020). */
export function fiscalizacaoCau() {
    return montar({
        id: 'fiscalizacao-cau', nome: 'Fiscalização do exercício profissional no CAU', area: 'sancionador', porte: 'medio', referencia: 'CAU/BR',
        descricao: 'Rito administrativo do CAU/UF para coibir o exercício ilegal ou irregular da arquitetura e urbanismo, por pessoa física ou jurídica, registrada ou não. A ação de fiscalização começa de ofício ou por denúncia, inclusive anônima; o agente apura e registra em relatório. Constatada a infração, emite notificação preventiva com 10 dias para regularizar, e a regularização no prazo afasta a multa; sem regularização, ou com reincidência na mesma capitulação em um ano, lavra auto de infração com 10 dias para regularizar e pagar ou apresentar defesa. O contraditório está nas alegações à notificação, na defesa ao auto e nos recursos. Julga a Comissão de Exercício Profissional do CAU/UF, com relatório e voto, inclusive à revelia; cabe recurso em 30 dias ao Plenário do CAU/UF e, depois, ao Plenário do CAU/BR, com efeito suspensivo. Termina com arquivamento ou com a multa definitiva e sua cobrança administrativa. Difere do modelo genérico auto-de-infracao pela notificação preventiva obrigatória, pelos prazos de 10 e 30 dias corridos e pelas duas instâncias recursais nos plenários do CAU.',
        quando: 'Indício de exercício ilegal ou irregular da profissão, falta de RRT, de responsável técnico ou de placa, ou obstrução da fiscalização. Questão ética de profissional registrado vai ao processo ético-disciplinar.',
        base: 'Lei 12.378/2010, arts. 24, 34, 35 e 50; Res. CAU/BR 198/2020 (revogou a Res. 22/2012; vigência pelo art. 96, alterado pela Res. 208/2021, conferir na norma vigente), arts. 15, 22 a 46, 49, 50 e 52 a 62, 71 a 74, 76 e 77. Inscrição em dívida ativa: conferir na norma vigente.',
        tipo: { polos: ['requerido', 'interessado'], nomes_polos: { requerido: 'Autuado', interessado: 'Denunciante' } },
    }, [
        {
            nome: 'Origem da ação', unidade: 'Fiscalização', avanco: 'auto', nome_publico: 'Ação de fiscalização aberta',
            orientacao: 'A ação de fiscalização é instaurada de ofício ou por denúncia, admitida a anônima (Res. 198, art. 22). Tem natureza educativa, preventiva, corretiva e punitiva; a punitiva só vem depois da corretiva sem regularização (art. 15).',
            acoes: [
                A.formulario('Registrar a ação de fiscalização', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['De ofício', 'Denúncia identificada', 'Denúncia anônima'] },
                    { id: 'fiscalizado', rotulo: 'Fiscalizado (nome e CPF ou CNPJ)', tipo: 'texto', obrigatorio: true },
                    { id: 'local', rotulo: 'Local da atividade ou obra', tipo: 'texto', obrigatorio: true },
                    { id: 'atividade', rotulo: 'Atividade fiscalizada', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a denúncia, se houver', 'Denúncia', { forma: 'juntar', nivel: 'opcional' }),
            ],
        },
        {
            nome: 'Apuração e relatório', unidade: 'Fiscalização', vai: ['Notificação preventiva', 'Auto de infração', 'Arquivamento'],
            orientacao: 'O agente apura e registra o relatório de fiscalização com datas, identificação do fiscalizado, atividade, RRT, responsável técnico e descrição das infrações (Res. 198, arts. 23 a 25). Pode requisitar informações em até 10 dias (art. 26). Sem infração, encerre e informe o denunciante identificado (art. 27). Já notificado pela mesma capitulação em um ano: auto direto (art. 34). Questão ética vai à CED (art. 77).',
            acoes: [
                A.simNao('É preciso requisitar informações ao fiscalizado?', { obrigatoria: true }),
                A.comunicar('Requisitar informações', { especie: 'notificacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Na ação de fiscalização do exercício profissional, envie as informações e documentos indicados em até 10 dias. A recusa pode configurar infração.' }, { se: quando('É preciso requisitar informações ao fiscalizado?', 'sim') }),
                A.esperar('Aguardar as informações', 'Requisitar informações', { se: quando('É preciso requisitar informações ao fiscalizado?', 'sim') }),
                A.documento('Juntar o relatório de fiscalização', 'Relatório', { forma: 'redigir' }),
                A.documento('Juntar fotos, contratos, projetos e situação do RRT', '', { forma: 'juntar', nivel: 'recomendado' }),
                A.escolha('Constatação', ['Sem infração', 'Infração constatada', 'Infração já notificada na mesma capitulação há menos de um ano'], { obrigatoria: true, destino: 'autos' }),
                A.comunicar('Informar o denunciante do encerramento', { especie: 'ciencia', polos: ['interessado'], dias: 0, texto: 'A ação de fiscalização foi encerrada porque não se constatou infração.' }, { se: quando('Constatação', 'Sem infração') }),
                A.fazer('Encaminhar à Comissão de Ética e Disciplina', { ajuda: 'Quando o fato também é infração ética de profissional registrado, ou há três notificações na mesma capitulação em um ano (Res. 198, art. 77).' }),
            ],
            saidas: {
                'Arquivamento': quando('Constatação', 'Sem infração'),
                'Notificação preventiva': quando('Constatação', 'Infração constatada'),
                'Auto de infração': quando('Constatação', 'Infração já notificada na mesma capitulação há menos de um ano'),
            },
        },
        {
            nome: 'Notificação preventiva', unidade: 'Fiscalização', vai: ['Arquivamento', 'Auto de infração'], nome_publico: 'Notificação para regularizar',
            orientacao: 'A notificação traz identificação, data, agente, atividade, fundamento legal, infração, penalidade e multa se não regularizar, providências e prazo de 10 dias (Res. 198, arts. 28 e 29). O prazo pode ser prorrogado por justo motivo, a pedido no SICCAU (art. 31). Regularizado no prazo, não há pena (art. 35); alegações que mostrem não haver infração levam ao arquivamento (art. 30).',
            acoes: [
                A.comunicar('Notificar o fiscalizado para regularizar', { especie: 'notificacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Foi constatada irregularidade no exercício profissional da arquitetura e urbanismo, descrita nesta notificação. Regularize em 10 dias ou apresente alegações; sem isso, será lavrado auto de infração com multa.' }, { obrigatoria: true }),
                A.esperar('Aguardar a regularização ou as alegações', 'Notificar o fiscalizado para regularizar', { obrigatoria: true }),
                A.simNao('Houve pedido de prorrogação deferido?', { ajuda: 'Por justo motivo (Res. 198, art. 31). Registre a nova data e aguarde antes de decidir.' }),
                A.escolha('Situação ao fim do prazo', ['Regularizado', 'Alegações acolhidas', 'Não regularizado'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Arquivamento': quando('Situação ao fim do prazo', 'Regularizado', 'Alegações acolhidas'), 'Auto de infração': quando('Situação ao fim do prazo', 'Não regularizado') },
        },
        {
            nome: 'Auto de infração', unidade: 'Fiscalização', vai: ['Julgamento pela CEP', 'Arquivamento'],
            orientacao: 'Antes de lavrar, confira se houve regularização (Res. 198, art. 36, parágrafo único). O auto traz o autuado, a data, o fundamento, a irregularidade, a multa, as providências e o prazo de 10 dias para regularizar e pagar ou apresentar defesa escrita fundamentada (art. 36). A multa sai das Tabelas I a V (arts. 40 a 43); sem RRT, 300% da taxa (Lei 12.378, art. 50). Regularizar depois do auto não afasta a multa (art. 38).',
            acoes: [
                A.formulario('Registrar o auto de infração', [
                    { id: 'numero', rotulo: 'Número do auto', tipo: 'texto', obrigatorio: true },
                    { id: 'capitulacao', rotulo: 'Capitulação (Res. 198, art. 39)', tipo: 'texto', obrigatorio: true },
                    { id: 'pontuacao', rotulo: 'Pontuação nas Tabelas I a IV', tipo: 'numero', obrigatorio: false },
                    { id: 'multa', rotulo: 'Valor da multa', tipo: 'numero', obrigatorio: true },
                    { id: 'data_auto', rotulo: 'Data da lavratura', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true, ajuda: 'Soma das tabelas convertida em anuidades pela Tabela V; resultado zero ou negativo dá multa mínima de 1 anuidade (Res. 198, arts. 40 a 43).' }),
                A.documento('Juntar o auto de infração', 'Auto de infração', { forma: 'redigir' }),
                A.comunicar('Notificar o autuado do auto de infração', { especie: 'notificacao', polos: ['requerido'], dias: 10, contagem: corridos, texto: 'Foi lavrado o auto de infração anexo. Em 10 dias, regularize a situação e pague a multa ou apresente defesa escrita à Comissão de Exercício Profissional do CAU/UF.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa ou o pagamento', 'Notificar o autuado do auto de infração', { obrigatoria: true }),
                A.escolha('Resposta do autuado', ['Regularizou e pagou', 'Apresentou defesa', 'Sem resposta'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Arquivamento': quando('Resposta do autuado', 'Regularizou e pagou'), 'Julgamento pela CEP': quando('Resposta do autuado', 'Apresentou defesa', 'Sem resposta') },
        },
        {
            nome: 'Julgamento pela CEP', unidade: 'Comissão de exercício profissional', vai: ['Recurso ao Plenário do CAU/UF', 'Trânsito em julgado e cobrança', 'Arquivamento'], nome_publico: 'Julgamento em primeira instância',
            orientacao: 'A CEP-CAU/UF julga com base no relatório e voto do conselheiro relator, membro da comissão, que pode manter o auto e a multa, redefinir a multa ou arquivar; cabe vista com novo relatório e voto (Res. 198, arts. 49 e 52). Sem defesa, julga à revelia (art. 54). Da decisão cabe recurso ao Plenário do CAU/UF em 30 dias, com efeito suspensivo (art. 53, § 1º).',
            acoes: [
                A.texto('Conselheiro relator', { obrigatoria: true, destino: 'informacao' }),
                A.audiencia('Pautar a reunião da CEP', 'reuniao'),
                A.documento('Juntar o relatório e o voto do relator', 'Relatório', { forma: 'redigir' }),
                A.escolha('Decisão da CEP', ['Manter o auto e a multa', 'Redefinir a multa', 'Arquivar'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a deliberação da CEP', 'Deliberação', { forma: 'redigir' }),
                A.comunicar('Intimar o autuado da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Fica intimado da decisão da Comissão de Exercício Profissional que manteve a infração. Cabe recurso ao Plenário do CAU/UF em 30 dias, com efeito suspensivo.' }, { obrigatoria: true, se: quando('Decisão da CEP', 'Manter o auto e a multa', 'Redefinir a multa') }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar o autuado da decisão', { obrigatoria: true, se: quando('Decisão da CEP', 'Manter o auto e a multa', 'Redefinir a multa') }),
                A.comunicar('Dar ciência do arquivamento', { especie: 'ciencia', polos: ['requerido'], dias: 0, texto: 'O auto de infração foi arquivado pela Comissão de Exercício Profissional.' }, { se: quando('Decisão da CEP', 'Arquivar') }),
            ],
            saidas: {
                'Recurso ao Plenário do CAU/UF': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'),
                'Trânsito em julgado e cobrança': quando('Aguardar o prazo de recurso', 'Sem manifestação'),
                'Arquivamento': quando('Decisão da CEP', 'Arquivar'),
            },
        },
        {
            nome: 'Recurso ao Plenário do CAU/UF', unidade: 'Plenário do CAU/UF', vai: ['Recurso ao Plenário do CAU/BR', 'Trânsito em julgado e cobrança', 'Arquivamento'],
            orientacao: 'Confira a tempestividade e a legitimidade (Res. 198, art. 50). O Plenário julga com relatório e voto de relator (art. 55). Da deliberação cabe recurso ao Plenário do CAU/BR em 30 dias, com efeito suspensivo (art. 56, § 1º).',
            acoes: [
                A.simNao('O recurso é tempestivo e de parte legítima?', { obrigatoria: true }),
                A.audiencia('Pautar a sessão plenária', 'sessao'),
                A.escolha('Resultado do recurso', ['Provido para arquivar', 'Provido em parte', 'Desprovido', 'Não conhecido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a deliberação plenária', 'Deliberação', { forma: 'redigir' }),
                A.comunicar('Intimar o autuado da deliberação', { especie: 'intimacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Fica intimado da deliberação do Plenário do CAU/UF. Cabe recurso ao Plenário do CAU/BR em 30 dias, com efeito suspensivo.' }, { obrigatoria: true, se: quando('Resultado do recurso', 'Provido em parte', 'Desprovido', 'Não conhecido') }),
                A.esperar('Aguardar o prazo de recurso ao CAU/BR', 'Intimar o autuado da deliberação', { obrigatoria: true, se: quando('Resultado do recurso', 'Provido em parte', 'Desprovido', 'Não conhecido') }),
                A.comunicar('Dar ciência do arquivamento', { especie: 'ciencia', polos: ['requerido'], dias: 0, texto: 'O Plenário do CAU/UF deu provimento ao recurso e arquivou o auto de infração.' }, { se: quando('Resultado do recurso', 'Provido para arquivar') }),
            ],
            saidas: {
                'Recurso ao Plenário do CAU/BR': quando('Aguardar o prazo de recurso ao CAU/BR', 'Apresentada', 'Parcial'),
                'Trânsito em julgado e cobrança': quando('Aguardar o prazo de recurso ao CAU/BR', 'Sem manifestação'),
                'Arquivamento': quando('Resultado do recurso', 'Provido para arquivar'),
            },
        },
        {
            nome: 'Recurso ao Plenário do CAU/BR', unidade: 'Plenário do CAU/BR', vai: ['Trânsito em julgado e cobrança', 'Arquivamento'],
            orientacao: 'O recurso passa pela CEP-CAU/BR, que rejeita o que não for admissível, e é julgado pelo Plenário do CAU/BR (Res. 198, art. 57). Depois, os autos voltam ao CAU/UF para execução (art. 58).',
            acoes: [
                A.escolha('Resultado do recurso', ['Provido para arquivar', 'Provido em parte', 'Desprovido', 'Não conhecido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a deliberação do CAU/BR', 'Deliberação', { forma: 'juntar' }),
                A.comunicar('Intimar o autuado da deliberação final', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado da deliberação do Plenário do CAU/BR no recurso contra o auto de infração.' }, { obrigatoria: true }),
            ],
            saidas: { 'Arquivamento': quando('Resultado do recurso', 'Provido para arquivar'), 'Trânsito em julgado e cobrança': quando('Resultado do recurso', 'Provido em parte', 'Desprovido', 'Não conhecido') },
        },
        {
            nome: 'Trânsito em julgado e cobrança', unidade: 'Fiscalização', vai: ['Arquivamento'],
            orientacao: 'Transita em julgado no fim do prazo sem recurso ou com a deliberação do Plenário do CAU/BR (Res. 198, art. 59). O CAU/UF que lavrou o auto executa: comunica o trânsito, a obrigação de pagar e, se cabível, a regularização (arts. 60 e 61). Informe o pagamento e o parcelamento (art. 46); multa vencida vai à cobrança administrativa (art. 62). Registre para fins de reincidência, que conta 5 anos (art. 76).',
            acoes: [
                A.comunicar('Comunicar o trânsito em julgado e a obrigação de pagar', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'A decisão no auto de infração transitou em julgado. Pague a multa, à vista ou parcelada, e regularize a situação, conforme as instruções anexas.' }, { obrigatoria: true }),
                A.simNao('A multa foi paga ou parcelada?', { obrigatoria: true }),
                A.fazer('Encaminhar à cobrança administrativa', { se: quando('A multa foi paga ou parcelada?', 'nao'), ajuda: 'Res. 198, art. 62. A inscrição em dívida ativa e a execução seguem a norma de cobrança do CAU (conferir).' }),
                A.fazer('Registrar a decisão para fins de reincidência', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Fiscalização', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Prescrição da ação punitiva: 5 anos da prática do ato ou do fim da infração permanente; processo parado por mais de 3 anos é extinto (Res. 198, arts. 73 e 74).' },
    ]);
}

export const modelos = [processoDisciplinarTedOabRs, revisaoDisciplinarOab, reabilitacaoOab, processoEticoDisciplinarCau, fiscalizacaoCau];
