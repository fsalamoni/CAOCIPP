// Modelos da área etica. Ver a forma de escrever em ./dsl.js e o exemplo em ./geral.js.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';

/** 1. Processo ético-profissional de conselho profissional (exemplo: CPEP do CFM, Res. CFM 2.306/2022). */
export function processoEticoProfissional() {
    return montar({
        id: 'etico-profissional', nome: 'Processo ético-profissional (conselho profissional)', area: 'etica', porte: 'longo', referencia: 'CFM',
        descricao: 'Apura infração ao código de ética da profissão por profissional inscrito no conselho. Corre em duas etapas: a sindicância, só investigativa, que termina em arquivamento, conciliação, ajustamento de conduta ou instauração do processo; e o processo ético-profissional, com citação, defesa prévia, instrução com audiência, alegações finais e julgamento em colegiado. O contraditório está na defesa prévia, na audiência, nas alegações finais sucessivas, na sustentação oral e no recurso com efeito suspensivo. Termina com a execução da sanção e o registro, ou com o arquivamento; tudo tramita em sigilo.',
        quando: 'Denúncia ou notícia de infração ética contra profissional inscrito em conselho de fiscalização profissional. Ajuste prazos e sanções ao código processual do seu conselho.',
        base: 'Exemplo: Resolução CFM 2.306/2022 (Código de Processo Ético-Profissional), alterada pela Res. CFM 2.424/2025, arts. 1º, 13 a 23, 29 a 51, 60 a 65, 81, 83 a 92, 100, 101, 104, 109, 116 a 120 e 131; Lei 3.268/1957, art. 22 (sanções).',
        tipo: { polos: ['requerente', 'requerido'], nomes_polos: { requerente: 'Denunciante', requerido: 'Denunciado' } },
    }, [
        {
            nome: 'Denúncia', unidade: 'Secretaria', avanco: 'auto', ao_entrar: { sigilo: 'restrito' }, nome_publico: 'Denúncia recebida',
            orientacao: 'Receba a denúncia escrita ou reduza a termo a verbal, com identificação do denunciante, relato dos fatos e provas (art. 14). O processo é sigiloso (art. 1º). Se o denunciante desistir depois, o processo segue de ofício (art. 37).',
            acoes: [
                A.formulario('Registrar os dados da denúncia', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['Denúncia', 'De ofício'] },
                    { id: 'denunciado', rotulo: 'Profissional denunciado', tipo: 'texto', obrigatorio: true },
                    { id: 'inscricao', rotulo: 'Número de inscrição no conselho', tipo: 'texto', obrigatorio: true },
                    { id: 'data_fato', rotulo: 'Data do fato', tipo: 'data', obrigatorio: false },
                    { id: 'data_conhecimento', rotulo: 'Data em que o conselho soube do fato', tipo: 'data', obrigatorio: true },
                    { id: 'relato', rotulo: 'Relato dos fatos', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true, ajuda: 'A data em que o conselho soube do fato marca o início da prescrição de 5 anos (art. 116).' }),
                A.documento('Juntar a denúncia ou o termo e as provas', 'Denúncia', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Sindicância', unidade: 'Comissão de ética', prazo_dias: 90, prazo_auto: true, prazo_contagem: corridos, vai: ['Julgamento da sindicância'],
            orientacao: 'Instaure por portaria e designe o conselheiro sindicante (art. 15, § 1º). Cabe manifestação preliminar escrita do denunciado e requisição de prontuário ou documentos; não cabem atos complexos, como oitiva de testemunha ou parecer de câmara técnica (art. 15, §§ 2º e 3º). Prazo de 90 dias, prorrogável uma vez por igual período com autorização da Corregedoria (art. 16, § 2º).',
            acoes: [
                A.documento('Juntar a portaria de instauração da sindicância', 'Portaria', { forma: 'redigir' }),
                A.comunicar('Notificar o denunciado para manifestação preliminar', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Foi instaurada sindicância sobre os fatos a seguir. Querendo, apresente manifestação preliminar escrita.' }),
                A.documento('Juntar documentos e prontuários requisitados', '', { forma: 'juntar', nivel: 'opcional' }),
                A.documento('Juntar o relatório conclusivo', 'Relatório', { forma: 'redigir', ajuda: 'Identifique as partes, resuma os fatos, relacione-os ao código de ética e conclua (art. 16).' }),
            ],
        },
        {
            nome: 'Julgamento da sindicância', unidade: 'Câmara de julgamento', vai: ['Prazo de recurso do arquivamento', 'Conciliação ou ajustamento de conduta', 'Instauração do processo'],
            orientacao: 'A câmara julga o relatório e decide entre arquivamento, conciliação, ajustamento de conduta ou instauração do processo ético-profissional, com ou sem proposta de interdição cautelar (art. 19). A sessão pode ser por videoconferência. Conciliação e ajustamento não cabem em caso de lesão corporal grave, violação à dignidade sexual ou óbito do paciente (arts. 22 e 23).',
            acoes: [
                A.audiencia('Pautar a sessão da câmara', 'sessao'),
                A.simNao('O caso envolve lesão corporal grave, violação à dignidade sexual ou óbito?', { obrigatoria: true, ajuda: 'Se sim, conciliação e ajustamento de conduta não são admitidos (arts. 22 e 23).' }),
                A.escolha('Resultado da sindicância', ['Arquivamento', 'Conciliação', 'Ajustamento de conduta', 'Instauração do processo'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a decisão da câmara', 'Acórdão', { forma: 'redigir' }),
                A.documento('Juntar a ata da sessão', 'Ata', { forma: 'redigir', nivel: 'recomendado' }),
            ],
            saidas: {
                'Prazo de recurso do arquivamento': quando('Resultado da sindicância', 'Arquivamento'),
                'Conciliação ou ajustamento de conduta': quando('Resultado da sindicância', 'Conciliação', 'Ajustamento de conduta'),
                'Instauração do processo': quando('Resultado da sindicância', 'Instauração do processo'),
            },
        },
        {
            nome: 'Prazo de recurso do arquivamento', unidade: 'Secretaria', avanco: 'auto', vai: ['Recurso do arquivamento', 'Arquivamento'], nome_publico: 'Arquivamento da sindicância',
            orientacao: 'Intime o denunciante do arquivamento. Ele tem 15 dias, contados da juntada do comprovante de ciência, para recorrer (art. 21).',
            acoes: [
                A.comunicar('Intimar o denunciante do arquivamento', { especie: 'intimacao', polos: ['requerente'], dias: 15, contagem: corridos, texto: 'A sindicância foi arquivada. Cabe recurso em 15 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar o denunciante do arquivamento', { obrigatoria: true }),
            ],
            saidas: { 'Recurso do arquivamento': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Arquivamento': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso do arquivamento', unidade: 'Plenário', vai: ['Instauração do processo', 'Arquivamento'],
            orientacao: 'O denunciado apresenta contrarrazões em 15 dias e o recurso sobe à instância superior (no CFM, ao conselho federal) (art. 21).',
            acoes: [
                A.comunicar('Intimar o denunciado para contrarrazões', { especie: 'intimacao', polos: ['requerido'], dias: 15, contagem: corridos, texto: 'O denunciante recorreu do arquivamento. Apresente contrarrazões em 15 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar as contrarrazões', 'Intimar o denunciado para contrarrazões', { obrigatoria: true }),
                A.escolha('Resultado do recurso', ['Provido', 'Desprovido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do recurso', 'Acórdão', { forma: 'redigir' }),
                A.comunicar('Intimar as partes da decisão do recurso', { especie: 'intimacao', dias: 0, texto: 'Fica intimado da decisão do recurso contra o arquivamento.' }, { obrigatoria: true }),
            ],
            saidas: { 'Instauração do processo': quando('Resultado do recurso', 'Provido'), 'Arquivamento': quando('Resultado do recurso', 'Desprovido') },
        },
        {
            nome: 'Conciliação ou ajustamento de conduta', unidade: 'Comissão de ética', vai: ['Arquivamento', 'Instauração do processo'], nome_publico: 'Tentativa de acordo',
            orientacao: 'Designe a audiência de conciliação ou a assinatura do termo de ajustamento de conduta (arts. 22 e 23). Firmado o ajuste, acompanhe o cumprimento antes de arquivar; sem acordo ou com descumprimento, instaure o processo.',
            acoes: [
                A.audiencia('Designar a audiência de conciliação', 'conciliacao'),
                A.comunicar('Intimar as partes para a audiência', { especie: 'intimacao', dias: 0, texto: 'Compareça à audiência de conciliação em {audiencia}.' }, { obrigatoria: true }),
                A.simNao('Acordo firmado e cumprido?', { obrigatoria: true }),
                A.documento('Juntar o termo de conciliação ou de ajustamento', 'Termo', { forma: 'redigir', se: quando('Acordo firmado e cumprido?', 'sim') }),
            ],
            saidas: { 'Arquivamento': quando('Acordo firmado e cumprido?', 'sim'), 'Instauração do processo': quando('Acordo firmado e cumprido?', 'nao') },
        },
        {
            nome: 'Instauração do processo', unidade: 'Corregedoria', vai: ['Interdição cautelar', 'Citação e defesa prévia'], nome_publico: 'Processo ético-profissional instaurado',
            orientacao: 'Instaure o processo ético-profissional por portaria e designe o conselheiro instrutor, que não pode ser o sindicante nem quem deu voto divergente (art. 36).',
            acoes: [
                A.documento('Juntar a portaria de instauração', 'Portaria', { forma: 'redigir' }),
                A.formulario('Registrar a designação do instrutor', [
                    { id: 'instrutor', rotulo: 'Conselheiro instrutor', tipo: 'texto', obrigatorio: true },
                    { id: 'data_instauracao', rotulo: 'Data da instauração', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', ajuda: 'O instrutor não pode ser o sindicante nem o autor de voto divergente (art. 36).' }),
                A.simNao('Há proposta de interdição cautelar?', { obrigatoria: true, ajuda: 'Quando há risco à população, a câmara pode propor a interdição cautelar, que o plenário decide (arts. 29 a 35).' }),
            ],
            saidas: { 'Interdição cautelar': quando('Há proposta de interdição cautelar?', 'sim'), 'Citação e defesa prévia': quando('Há proposta de interdição cautelar?', 'nao') },
        },
        {
            nome: 'Interdição cautelar', unidade: 'Plenário', vai: ['Citação e defesa prévia'], ao_entrar: { pendencia: 'Deliberar sobre a proposta de interdição cautelar do profissional (Res. CFM 2.306/2022, arts. 29 a 35).' },
            orientacao: 'O plenário delibera com o quórum próprio (no CFM, de 11 a 21 conselheiros). Cabe recurso em 5 dias, e a interdição é referendada pelo conselho federal. Com interdição, o processo deve ser julgado em 6 meses, prorrogáveis uma vez (arts. 29 a 35).',
            acoes: [
                A.audiencia('Pautar a sessão do plenário', 'sessao'),
                A.comunicar('Intimar o denunciado da sessão', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'A proposta de interdição cautelar será julgada na sessão de {audiencia}.' }, { obrigatoria: true }),
                A.escolha('Interdição cautelar', ['Decretada', 'Não decretada'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do plenário', 'Acórdão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão sobre a interdição', { especie: 'intimacao', dias: 5, contagem: corridos, texto: 'Fica intimado da decisão sobre a interdição cautelar. Cabe recurso em 5 dias.' }, { obrigatoria: true }),
                A.fazer('Remeter ao conselho federal para referendo', { se: quando('Interdição cautelar', 'Decretada') }),
            ],
        },
        {
            nome: 'Citação e defesa prévia', unidade: 'Comissão de ética', vai: ['Instrução e audiência', 'Revelia e defensor dativo'], nome_publico: 'Defesa prévia',
            orientacao: 'Cite o denunciado por aplicativo de mensagem, e-mail, correio com comprovação, servidor do conselho ou edital (arts. 41 e 42), com cópia do relatório da sindicância e aviso de revelia (art. 40). A defesa prévia vem em 30 dias, com preliminares, documentos, provas e até 3 testemunhas (art. 43). O denunciante tem igual prazo para indicar provas e até 3 testemunhas (art. 44). A suspeição se argui em 15 dias do conhecimento do fato (art. 109).',
            acoes: [
                A.comunicar('Citar o denunciado', { especie: 'citacao', polos: ['requerido'], dias: 30, contagem: corridos, texto: 'Fica citado para apresentar defesa prévia em 30 dias, com documentos, provas e até 3 testemunhas. Segue cópia do relatório da sindicância. Sem defesa, será declarada a revelia.' }, { obrigatoria: true }),
                A.comunicar('Intimar o denunciante para indicar provas', { especie: 'intimacao', polos: ['requerente'], dias: 30, contagem: corridos, texto: 'Foi instaurado processo ético-profissional. Indique as provas e até 3 testemunhas em 30 dias.' }),
                A.esperar('Aguardar a defesa prévia', 'Citar o denunciado', { obrigatoria: true }),
                A.esperar('Aguardar as provas do denunciante', 'Intimar o denunciante para indicar provas'),
            ],
            saidas: { 'Instrução e audiência': quando('Aguardar a defesa prévia', 'Apresentada', 'Parcial'), 'Revelia e defensor dativo': quando('Aguardar a defesa prévia', 'Sem manifestação') },
        },
        {
            nome: 'Revelia e defensor dativo', unidade: 'Comissão de ética', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Instrução e audiência'],
            orientacao: 'Sem defesa e sem defensor constituído, declare a revelia e nomeie defensor dativo advogado, que tem novo prazo de 30 dias e atua até o recurso à instância superior (arts. 48 a 51).',
            acoes: [
                A.documento('Juntar a decisão que declara a revelia', 'Decisão', { forma: 'redigir' }),
                A.formulario('Registrar o defensor dativo', [
                    { id: 'dativo', rotulo: 'Nome do defensor dativo', tipo: 'texto', obrigatorio: true },
                    { id: 'oab', rotulo: 'Inscrição na OAB', tipo: 'texto', obrigatorio: true },
                    { id: 'data_nomeacao', rotulo: 'Data da nomeação', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao' }),
                A.fazer('Intimar o defensor dativo do prazo de 30 dias', { obrigatoria: true }),
                A.documento('Juntar a defesa prévia do dativo', 'Defesa', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Instrução e audiência', unidade: 'Comissão de ética', vai: ['Alegações finais', 'Suspensão por doença incapacitante'],
            orientacao: 'As partes trazem suas testemunhas, independentemente de intimação (art. 60). Ordem das oitivas: denunciante, testemunhas do denunciante, do instrutor e do denunciado e, por último, o denunciado (art. 63). Contradita antes do depoimento (art. 64); as partes perguntam diretamente (art. 65); áudio só entra nos autos com transcrição (art. 81). Havendo suspeita de doença incapacitante, envie à fase de suspensão (art. 20).',
            acoes: [
                A.audiencia('Designar a audiência de instrução', 'instrucao'),
                A.comunicar('Intimar as partes para a audiência', { especie: 'intimacao', dias: 0, texto: 'Compareça à audiência de instrução em {audiencia}, trazendo suas testemunhas.' }, { obrigatoria: true }),
                A.orientar('Ordem das oitivas', 'Denunciante, testemunhas do denunciante, do instrutor e do denunciado e, por último, o denunciado (art. 63).'),
                A.documento('Juntar a ata e os termos de depoimento', 'Ata', { forma: 'qualquer' }),
                A.documento('Juntar parecer de câmara técnica ou perícia, se houver', 'Parecer', { forma: 'juntar', nivel: 'opcional' }),
            ],
        },
        {
            nome: 'Alegações finais', unidade: 'Comissão de ética', avanco: 'auto', vai: ['Parecer jurídico'],
            orientacao: 'Alegações finais em 15 dias sucessivos: primeiro o denunciante, depois o denunciado (art. 83).',
            acoes: [
                A.comunicar('Intimar o denunciante para alegações finais', { especie: 'intimacao', polos: ['requerente'], dias: 15, contagem: corridos, texto: 'Encerrada a instrução, apresente alegações finais em 15 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar as alegações do denunciante', 'Intimar o denunciante para alegações finais', { obrigatoria: true }),
                A.comunicar('Intimar o denunciado para alegações finais', { especie: 'intimacao', polos: ['requerido'], dias: 15, contagem: corridos, texto: 'Encerrado o prazo do denunciante, apresente alegações finais em 15 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar as alegações do denunciado', 'Intimar o denunciado para alegações finais', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Parecer jurídico', unidade: 'Assessoria jurídica', avanco: 'auto', vai: ['Designação de relator e pauta'],
            orientacao: 'A assessoria jurídica opina sobre as preliminares e a regularidade do processo (art. 84).',
            acoes: [A.documento('Juntar o parecer jurídico', 'Parecer', { forma: 'redigir' })],
        },
        {
            nome: 'Designação de relator e pauta', unidade: 'Corregedoria', vai: ['Sessão de julgamento'],
            orientacao: 'Com o termo de encerramento da instrução, designe o relator e inclua em pauta (arts. 86 e 87). Intime as partes da data do julgamento com antecedência mínima de 5 dias (art. 88).',
            acoes: [
                A.documento('Juntar o termo de encerramento da instrução', 'Termo', { forma: 'juntar' }),
                A.texto('Conselheiro relator', { obrigatoria: true, destino: 'informacao' }),
                A.audiencia('Pautar a sessão de julgamento', 'sessao'),
                A.comunicar('Intimar as partes da sessão de julgamento', { especie: 'intimacao', dias: 0, texto: 'O processo será julgado na sessão de {audiencia}. Cada parte pode fazer sustentação oral por 10 minutos.' }, { obrigatoria: true, ajuda: 'A intimação precisa sair com pelo menos 5 dias de antecedência da sessão (art. 88).' }),
            ],
        },
        {
            nome: 'Sessão de julgamento', unidade: 'Câmara de julgamento', vai: ['Recurso', 'Execução e registro'], nome_publico: 'Julgamento',
            orientacao: 'Sustentação oral de 10 minutos para cada parte (art. 89, § 2º). O relator apresenta voto escrito com preliminares, mérito e sanção (art. 91). Pedido de vista devolve o processo em até 30 dias (art. 92). Intimadas as partes, o recurso cabe em 30 dias.',
            acoes: [
                A.simNao('Houve pedido de vista?', { ajuda: 'O conselheiro devolve o processo em até 30 dias, e o julgamento continua na sessão seguinte (art. 92).' }),
                A.julgamento('Resultado do julgamento', ['Absolvição', 'Condenação'], {}, { obrigatoria: true }),
                A.escolha('Sanção aplicada', ['Advertência confidencial', 'Censura confidencial', 'Censura pública', 'Suspensão do exercício', 'Cassação do exercício'], { obrigatoria: true, destino: 'autos', se: quando('Resultado do julgamento', 'Condenação'), ajuda: 'Sanções da Lei 3.268/1957, art. 22. Ajuste à lei do seu conselho.' }),
                A.documento('Juntar o relatório e os votos', 'Relatório', { forma: 'redigir' }),
                A.documento('Juntar o acórdão', 'Acórdão', { forma: 'redigir' }),
                A.documento('Juntar a ata da sessão', 'Ata', { forma: 'redigir' }),
                A.comunicar('Intimar as partes do acórdão', { especie: 'intimacao', dias: 30, contagem: corridos, texto: 'Fica intimado do acórdão. Cabe recurso em 30 dias, com efeito suspensivo.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar as partes do acórdão', { obrigatoria: true }),
            ],
            saidas: { 'Recurso': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Execução e registro': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso', unidade: 'Plenário', vai: ['Execução e registro'],
            orientacao: 'Recurso em 30 dias da juntada do comprovante de intimação, com contrarrazões em 30 dias e efeitos devolutivo e suspensivo (arts. 100 e 101). No CFM, julga o pleno regional, a câmara ou o pleno federal, conforme a sanção. Havendo nova instância, repita esta fase.',
            acoes: [
                A.comunicar('Intimar a parte contrária para contrarrazões', { especie: 'intimacao', dias: 30, contagem: corridos, texto: 'Foi interposto recurso contra o acórdão. Apresente contrarrazões em 30 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar as contrarrazões', 'Intimar a parte contrária para contrarrazões', { obrigatoria: true }),
                A.escolha('Resultado do recurso', ['Provido', 'Provido em parte', 'Desprovido', 'Não conhecido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar o acórdão do recurso', 'Acórdão', { forma: 'redigir' }),
                A.comunicar('Intimar as partes do acórdão do recurso', { especie: 'intimacao', dias: 0, texto: 'Fica intimado do acórdão do recurso.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Execução e registro', unidade: 'Secretaria', prazo_dias: 90, prazo_auto: true, prazo_contagem: corridos, vai: ['Arquivamento'],
            orientacao: 'Transitada em julgado a decisão, execute a sanção em até 90 dias (art. 104) e anote no registro do profissional. Prescrição executória: 5 anos (art. 120).',
            acoes: [
                A.simNao('Há sanção a executar?', { obrigatoria: true }),
                A.fazer('Executar a sanção e anotar no registro do profissional', { obrigatoria: true, destino: 'autos', se: quando('Há sanção a executar?', 'sim') }),
                A.comunicar('Dar ciência ao profissional da execução', { especie: 'ciencia', polos: ['requerido'], dias: 0, texto: 'Fica ciente da execução da sanção aplicada.' }, { se: quando('Há sanção a executar?', 'sim') }),
                A.fazer('Certificar o trânsito em julgado', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Suspensão por doença incapacitante', unidade: 'Comissão de ética', espera: true, avanco: 'auto', prazo_dias: 90, prazo_auto: true, prazo_contagem: corridos,
            orientacao: 'Com suspeita de doença incapacitante, o processo fica suspenso por até 90 dias, prorrogáveis uma vez, enquanto corre o procedimento próprio (art. 20). Concluído, o processo volta à instrução.',
            acoes: [
                A.documento('Juntar a decisão de suspensão', 'Decisão', { forma: 'redigir' }),
                A.documento('Juntar o laudo do procedimento de saúde', 'Laudo', { forma: 'juntar' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Prescrição da pretensão punitiva: 5 anos do conhecimento do fato; intercorrente: 3 anos de paralisação (arts. 116 e 118).' },
    ]);
}

/** 2. Processo disciplinar de entidade de classe (exemplo: OAB, Lei 8.906/1994 e Código de Ética e Disciplina). */
export function processoDisciplinarEntidadeClasse() {
    return montar({
        id: 'disciplinar-entidade-classe', nome: 'Processo disciplinar (entidade de classe)', area: 'etica', porte: 'longo', referencia: 'OAB',
        descricao: 'Apura infração disciplinar de inscrito na entidade de classe, de ofício ou por representação identificada. Um relator emite parecer de admissibilidade, o presidente instaura ou arquiva, e a instrução segue com defesa prévia, audiência, parecer preliminar e razões finais. O contraditório está na defesa prévia com rol de testemunhas, na audiência, nas razões finais, na sustentação oral e no recurso com efeito suspensivo. Julga um tribunal de ética colegiado, com relator diferente do da instrução; termina com o registro da sanção ou o arquivamento, e tudo corre em sigilo até o fim.',
        quando: 'Representação ou notícia de infração disciplinar contra inscrito em entidade de classe com tribunal de ética próprio, como a OAB. Ajuste prazos e sanções ao estatuto da sua entidade.',
        base: 'Exemplo: Lei 8.906/1994 (Estatuto da Advocacia), arts. 35, 43, 68 a 77; Resolução CFOAB 02/2015 (Código de Ética e Disciplina), arts. 55 a 62 e 69.',
        tipo: { polos: ['requerente', 'requerido'], nomes_polos: { requerente: 'Representante', requerido: 'Representado' } },
    }, [
        {
            nome: 'Representação', unidade: 'Secretaria', avanco: 'auto', ao_entrar: { sigilo: 'restrito' }, nome_publico: 'Representação recebida',
            orientacao: 'Receba a representação escrita ou reduza a termo a verbal, com identificação, narração dos fatos, documentos e rol de até 5 testemunhas (CED, arts. 56 e 57). Não se admite representação anônima (CED, art. 55, § 2º). O processo é sigiloso até o fim (Lei 8.906, art. 72, § 2º).',
            acoes: [
                A.formulario('Registrar os dados da representação', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['Representação', 'De ofício'] },
                    { id: 'representado', rotulo: 'Representado', tipo: 'texto', obrigatorio: true },
                    { id: 'inscricao', rotulo: 'Número de inscrição', tipo: 'texto', obrigatorio: true },
                    { id: 'data_constatacao', rotulo: 'Data da constatação oficial do fato', tipo: 'data', obrigatorio: true },
                    { id: 'fatos', rotulo: 'Narração dos fatos', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'testemunhas', rotulo: 'Rol de testemunhas (até 5)', tipo: 'texto_longo', obrigatorio: false },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true, ajuda: 'A data da constatação oficial do fato inicia a prescrição de 5 anos (Lei 8.906, art. 43).' }),
                A.documento('Juntar a representação ou o termo e os documentos', 'Representação', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Designação de relator e certidões', unidade: 'Secretaria', avanco: 'auto', vai: ['Parecer de admissibilidade'],
            orientacao: 'Sorteie o relator e junte a ficha cadastral do representado e a certidão de punições e de representações em andamento (CED, art. 58, § 2º).',
            acoes: [
                A.texto('Relator sorteado', { obrigatoria: true, destino: 'informacao' }),
                A.documento('Juntar a ficha cadastral e a certidão de punições e representações', 'Certidão', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Parecer de admissibilidade', unidade: 'Comissão de ética', prazo_dias: 30, prazo_auto: true, avanco: 'auto', vai: ['Despacho de instauração'],
            orientacao: 'O relator emite parecer de admissibilidade em 30 dias, sob pena de redistribuição (CED, art. 58, § 3º).',
            acoes: [
                A.escolha('Proposta do relator', ['Instaurar', 'Arquivar liminarmente'], { obrigatoria: true }),
                A.documento('Juntar o parecer de admissibilidade', 'Parecer', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Despacho de instauração', unidade: 'Gabinete', vai: ['Notificação e defesa prévia', 'Recurso', 'Arquivamento'],
            orientacao: 'O presidente do conselho seccional, da subseção ou do tribunal de ética instaura o processo ou arquiva liminarmente a representação (CED, art. 58, § 4º). Arquivada, intime o representante, que pode recorrer em 15 dias (Lei 8.906, arts. 69 e 76).',
            acoes: [
                A.escolha('Decisão do presidente', ['Instaurar', 'Arquivar liminarmente'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o despacho', 'Despacho', { forma: 'redigir' }),
                A.comunicar('Intimar o representante do arquivamento', { especie: 'intimacao', polos: ['requerente'], dias: 15, texto: 'A representação foi arquivada liminarmente. Cabe recurso em 15 dias.' }, { obrigatoria: true, se: quando('Decisão do presidente', 'Arquivar liminarmente') }),
                A.esperar('Aguardar o prazo de recurso do arquivamento', 'Intimar o representante do arquivamento', { obrigatoria: true, se: quando('Decisão do presidente', 'Arquivar liminarmente') }),
            ],
            saidas: {
                'Notificação e defesa prévia': quando('Decisão do presidente', 'Instaurar'),
                'Recurso': quando('Aguardar o prazo de recurso do arquivamento', 'Apresentada', 'Parcial'),
                'Arquivamento': quando('Aguardar o prazo de recurso do arquivamento', 'Sem manifestação'),
            },
        },
        {
            nome: 'Notificação e defesa prévia', unidade: 'Comissão de ética', vai: ['Defensor dativo', 'Indeferimento liminar', 'Saneamento e audiência de instrução'], nome_publico: 'Defesa prévia',
            orientacao: 'Notifique o representado no endereço do cadastro para defesa prévia em 15 dias, com documentos e rol de até 5 testemunhas (CED, art. 59; Lei 8.906, art. 69). O relator pode prorrogar por motivo relevante (Lei 8.906, art. 73, § 3º). Após a defesa, o relator pode propor o indeferimento liminar (art. 73, § 2º).',
            acoes: [
                A.comunicar('Notificar o representado para defesa prévia', { especie: 'notificacao', polos: ['requerido'], dias: 15, texto: 'Foi instaurado processo disciplinar. Apresente defesa prévia em 15 dias, com documentos e rol de até 5 testemunhas.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa prévia', 'Notificar o representado para defesa prévia', { obrigatoria: true }),
                A.simNao('O relator propõe o indeferimento liminar?', { obrigatoria: true, se: quando('Aguardar a defesa prévia', 'Apresentada', 'Parcial') }),
            ],
            saidas: {
                'Defensor dativo': quando('Aguardar a defesa prévia', 'Sem manifestação'),
                'Indeferimento liminar': quando('O relator propõe o indeferimento liminar?', 'sim'),
                'Saneamento e audiência de instrução': quando('O relator propõe o indeferimento liminar?', 'nao'),
            },
        },
        {
            nome: 'Defensor dativo', unidade: 'Comissão de ética', prazo_dias: 15, prazo_auto: true, vai: ['Saneamento e audiência de instrução'],
            orientacao: 'Representado não encontrado ou revel: nomeie defensor dativo, que apresenta a defesa prévia em 15 dias (CED, art. 59, § 2º; Lei 8.906, art. 73, § 4º).',
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
            nome: 'Indeferimento liminar', unidade: 'Gabinete', vai: ['Saneamento e audiência de instrução', 'Recurso', 'Arquivamento'], ao_entrar: { pendencia: 'O relator propôs o indeferimento liminar da representação: decidir (Lei 8.906/1994, art. 73, § 2º).' },
            orientacao: 'Proposto o indeferimento liminar pelo relator, decide o presidente do conselho seccional (Lei 8.906, art. 73, § 2º). Indeferida, intime as partes, com 15 dias para recurso.',
            acoes: [
                A.escolha('Decisão sobre o indeferimento', ['Indefere liminarmente', 'Prossegue'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar as partes do indeferimento', { especie: 'intimacao', dias: 15, texto: 'A representação foi indeferida liminarmente. Cabe recurso em 15 dias.' }, { obrigatoria: true, se: quando('Decisão sobre o indeferimento', 'Indefere liminarmente') }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar as partes do indeferimento', { obrigatoria: true, se: quando('Decisão sobre o indeferimento', 'Indefere liminarmente') }),
            ],
            saidas: {
                'Saneamento e audiência de instrução': quando('Decisão sobre o indeferimento', 'Prossegue'),
                'Recurso': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'),
                'Arquivamento': quando('Aguardar o prazo de recurso', 'Sem manifestação'),
            },
        },
        {
            nome: 'Saneamento e audiência de instrução', unidade: 'Comissão de ética', vai: ['Parecer preliminar', 'Suspensão preventiva'],
            orientacao: 'Profira o despacho saneador e designe a audiência para ouvir o representante, o representado e as testemunhas. Cada parte traz as suas, salvo pedido justificado de notificação (CED, art. 59, §§ 3º e 4º). Se o caso tiver repercussão prejudicial à dignidade da profissão, envie à fase de suspensão preventiva.',
            acoes: [
                A.documento('Juntar o despacho saneador', 'Despacho', { forma: 'redigir' }),
                A.audiencia('Designar a audiência de instrução', 'instrucao'),
                A.comunicar('Intimar as partes para a audiência', { especie: 'intimacao', dias: 0, texto: 'Compareça à audiência de instrução em {audiencia}, trazendo suas testemunhas.' }, { obrigatoria: true }),
                A.simNao('Alguma parte pediu, com justificativa, a notificação de testemunha?', { obrigatoria: true }),
                A.fazer('Notificar as testemunhas indicadas', { se: quando('Alguma parte pediu, com justificativa, a notificação de testemunha?', 'sim') }),
                A.documento('Juntar a ata e os termos de depoimento', 'Ata', { forma: 'qualquer' }),
            ],
        },
        {
            nome: 'Parecer preliminar', unidade: 'Comissão de ética', avanco: 'auto', vai: ['Razões finais'],
            orientacao: 'Encerrada a instrução, o relator emite parecer preliminar com o enquadramento legal dos fatos (CED, art. 59, § 7º).',
            acoes: [A.documento('Juntar o parecer preliminar', 'Parecer', { forma: 'redigir', ajuda: 'Indique o enquadramento legal dos fatos (CED, art. 59, § 7º).' })],
        },
        {
            nome: 'Razões finais', unidade: 'Comissão de ética', avanco: 'auto', vai: ['Distribuição e pauta'],
            orientacao: 'Prazo comum de 15 dias para as razões finais (CED, art. 59, § 8º).',
            acoes: [
                A.comunicar('Intimar as partes para razões finais', { especie: 'intimacao', dias: 15, texto: 'Apresente razões finais em 15 dias, prazo comum às partes.' }, { obrigatoria: true }),
                A.esperar('Aguardar as razões finais', 'Intimar as partes para razões finais', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Distribuição e pauta', unidade: 'Câmara de julgamento', vai: ['Sessão de julgamento'],
            orientacao: 'Distribua a novo relator no tribunal de ética, diferente do relator da instrução, e paute. As partes são notificadas com 15 dias de antecedência da sessão (CED, art. 60).',
            acoes: [
                A.texto('Relator do julgamento', { obrigatoria: true, destino: 'informacao', ajuda: 'Não pode ser o relator da instrução (CED, art. 60).' }),
                A.audiencia('Pautar a sessão de julgamento', 'sessao'),
                A.comunicar('Notificar as partes da sessão de julgamento', { especie: 'notificacao', dias: 0, texto: 'O processo será julgado na sessão de {audiencia}. Cada parte pode fazer sustentação oral por 15 minutos.' }, { obrigatoria: true, ajuda: 'A notificação sai com 15 dias de antecedência da sessão (CED, art. 60).' }),
            ],
        },
        {
            nome: 'Sessão de julgamento', unidade: 'Câmara de julgamento', vai: ['Recurso', 'Execução e registro'], nome_publico: 'Julgamento',
            orientacao: 'Sustentação oral de 15 minutos, primeiro o representante e depois o representado (CED, art. 60, § 4º). O acórdão traz ementa, quórum, enquadramento, sanção, agravantes e atenuantes (CED, arts. 61 e 62). Cabe recurso em 15 dias, com efeito suspensivo (Lei 8.906, arts. 69, 76 e 77).',
            acoes: [
                A.julgamento('Resultado do julgamento', ['Improcedente', 'Procedente'], { desempate: 'favoravel', favoravel: 'Improcedente' }, { obrigatoria: true }),
                A.escolha('Sanção aplicada', ['Censura', 'Suspensão', 'Exclusão', 'Multa'], { obrigatoria: true, destino: 'autos', se: quando('Resultado do julgamento', 'Procedente'), ajuda: 'Sanções da Lei 8.906/1994, art. 35. Ajuste ao estatuto da sua entidade.' }),
                A.simNao('Decisão unânime?', { obrigatoria: true, ajuda: 'Na OAB, o recurso ao Conselho Federal só cabe de decisão não unânime ou contrária à lei ou a precedente (art. 75).' }),
                A.documento('Juntar o acórdão', 'Acórdão', { forma: 'redigir' }),
                A.documento('Juntar a ata da sessão', 'Ata', { forma: 'redigir' }),
                A.comunicar('Intimar as partes do acórdão', { especie: 'intimacao', dias: 15, texto: 'Fica intimado do acórdão. Cabe recurso em 15 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar as partes do acórdão', { obrigatoria: true }),
            ],
            saidas: { 'Recurso': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Execução e registro': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso', unidade: 'Plenário', vai: ['Notificação e defesa prévia', 'Execução e registro'],
            orientacao: 'Recurso em 15 dias ao conselho seccional (Lei 8.906, art. 76) e, de decisão não unânime ou contrária à lei ou a precedente, ao conselho federal (art. 75), com efeito suspensivo como regra (art. 77). Provido o recurso contra arquivamento ou indeferimento liminar, o processo segue para a defesa prévia. Havendo nova instância, repita esta fase.',
            acoes: [
                A.comunicar('Intimar a parte contrária para contrarrazões', { especie: 'intimacao', dias: 15, texto: 'Foi interposto recurso. Apresente contrarrazões em 15 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar as contrarrazões', 'Intimar a parte contrária para contrarrazões', { obrigatoria: true }),
                A.escolha('Resultado do recurso', ['Provido', 'Provido em parte', 'Desprovido', 'Não conhecido', 'Provido para instaurar ou prosseguir'], { obrigatoria: true, destino: 'autos', partes: true, ajuda: 'Use a última opção quando o recurso for contra arquivamento ou indeferimento liminar e for provido.' }),
                A.documento('Juntar o acórdão do recurso', 'Acórdão', { forma: 'redigir' }),
                A.comunicar('Intimar as partes do acórdão do recurso', { especie: 'intimacao', dias: 0, texto: 'Fica intimado do acórdão do recurso.' }, { obrigatoria: true }),
            ],
            saidas: {
                'Notificação e defesa prévia': quando('Resultado do recurso', 'Provido para instaurar ou prosseguir'),
                'Execução e registro': quando('Resultado do recurso', 'Provido', 'Provido em parte', 'Desprovido', 'Não conhecido'),
            },
        },
        {
            nome: 'Execução e registro', unidade: 'Secretaria', vai: ['Arquivamento'],
            orientacao: 'Transitada em julgado, anote a sanção no cadastro e comunique ao conselho da inscrição principal (Lei 8.906, art. 70, § 2º). Cabem revisão por erro de julgamento ou prova falsa (art. 73, § 5º) e reabilitação (CED, art. 69).',
            acoes: [
                A.simNao('Há sanção a executar?', { obrigatoria: true }),
                A.fazer('Anotar a sanção no cadastro do inscrito', { obrigatoria: true, destino: 'autos', se: quando('Há sanção a executar?', 'sim') }),
                A.fazer('Comunicar ao conselho da inscrição principal', { se: quando('Há sanção a executar?', 'sim') }),
                A.comunicar('Dar ciência ao representado da execução', { especie: 'ciencia', polos: ['requerido'], dias: 0, texto: 'Fica ciente da execução da sanção aplicada.' }, { se: quando('Há sanção a executar?', 'sim') }),
                A.fazer('Certificar o trânsito em julgado', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Suspensão preventiva', unidade: 'Câmara de julgamento', espera: true, avanco: 'auto',
            orientacao: 'Havendo repercussão prejudicial à dignidade da profissão, o tribunal de ética pode suspender preventivamente o representado em sessão especial, depois de ouvi-lo. Nesse caso, o processo deve terminar em 90 dias (Lei 8.906, art. 70, § 3º). Decidido, o processo volta à instrução.',
            acoes: [
                A.audiencia('Designar a sessão especial', 'sessao'),
                A.comunicar('Notificar o representado para a sessão especial', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Compareça à sessão especial em {audiencia}, para ser ouvido sobre a suspensão preventiva.' }, { obrigatoria: true }),
                A.escolha('Suspensão preventiva', ['Decretada', 'Não decretada'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão', 'Acórdão', { forma: 'redigir' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Prescrição: 5 anos da constatação oficial do fato; intercorrente de 3 anos (Lei 8.906, art. 43).' },
    ]);
}

/** 3. Apuração ética por comissão de ética pública (Decreto 6.029/2007). */
export function apuracaoComissaoEticaPublica() {
    return montar({
        id: 'comissao-etica-publica', nome: 'Apuração ética por comissão de ética pública', area: 'etica', porte: 'medio', referencia: 'Comissão de Ética Pública',
        descricao: 'Apura desvio ético de agente público que não chega a ser infração disciplinar, ou que corre em paralelo a ela. A comissão de ética admite a denúncia fundamentada ou instaura de ofício, notifica o investigado e instrui com documentos, diligências e parecer de especialista. O contraditório está na manifestação escrita em 10 dias e na nova manifestação quando surgem provas novas. Termina com decisão conclusiva e fundamentada do colegiado, que pode aplicar censura ética, recomendar e comunicar a autoridade para apuração disciplinar; o procedimento é reservado até a conclusão.',
        quando: 'Denúncia ou notícia de conduta de agente público contrária ao código de ética, no Executivo federal ou em órgão que adote rito semelhante.',
        base: 'Decreto 6.029/2007, arts. 12 e 13. Rito detalhado na Resolução CEP 10/2008, que deve ser conferida.',
        tipo: { polos: ['requerente', 'requerido'], nomes_polos: { requerente: 'Denunciante', requerido: 'Investigado' } },
    }, [
        {
            nome: 'Denúncia ou instauração de ofício', unidade: 'Secretaria', avanco: 'auto', ao_entrar: { sigilo: 'restrito' }, nome_publico: 'Denúncia recebida',
            orientacao: 'Registre a denúncia fundamentada ou a instauração de ofício (art. 12). O procedimento recebe a chancela de reservado até a conclusão (art. 13).',
            acoes: [
                A.formulario('Registrar os dados da apuração', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['Denúncia', 'De ofício'] },
                    { id: 'investigado', rotulo: 'Agente público investigado', tipo: 'texto', obrigatorio: true },
                    { id: 'cargo', rotulo: 'Cargo ou função', tipo: 'texto', obrigatorio: true },
                    { id: 'fatos', rotulo: 'Fatos e fundamentos', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a denúncia e os documentos', 'Denúncia', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Juízo de admissibilidade', unidade: 'Comissão de ética', vai: ['Notificação do investigado', 'Arquivamento'],
            orientacao: 'A comissão verifica se a denúncia é fundamentada e se os fatos podem configurar desvio ético. Se também puderem ser infração disciplinar, comunique à corregedoria ou à autoridade competente, sem prejuízo da apuração ética.',
            acoes: [
                A.escolha('Admissibilidade', ['Admitir', 'Arquivar'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a decisão de admissibilidade', 'Decisão', { forma: 'redigir' }),
                A.simNao('Os fatos podem configurar também infração disciplinar?', { obrigatoria: true }),
                A.fazer('Comunicar à corregedoria ou à autoridade competente', { obrigatoria: true, se: quando('Os fatos podem configurar também infração disciplinar?', 'sim') }),
                A.comunicar('Dar ciência ao denunciante do arquivamento', { especie: 'ciencia', polos: ['requerente'], dias: 0, texto: 'A denúncia foi arquivada no juízo de admissibilidade.' }, { se: quando('Admissibilidade', 'Arquivar') }),
            ],
            saidas: { 'Notificação do investigado': quando('Admissibilidade', 'Admitir'), 'Arquivamento': quando('Admissibilidade', 'Arquivar') },
        },
        {
            nome: 'Notificação do investigado', unidade: 'Comissão de ética', avanco: 'auto', vai: ['Instrução'], nome_publico: 'Manifestação do investigado',
            orientacao: 'Notifique o investigado para se manifestar por escrito em 10 dias (art. 12, caput).',
            acoes: [
                A.comunicar('Notificar o investigado', { especie: 'notificacao', polos: ['requerido'], dias: 10, texto: 'Foi instaurado procedimento de apuração ética. Manifeste-se por escrito em 10 dias, podendo juntar documentos.' }, { obrigatoria: true }),
                A.esperar('Aguardar a manifestação', 'Notificar o investigado', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Instrução', unidade: 'Comissão de ética', vai: ['Nova manifestação', 'Deliberação'],
            orientacao: 'O investigado pode produzir prova documental. A comissão pode requisitar documentos, fazer diligências e pedir parecer de especialista (art. 12, §§ 1º e 2º). Se juntar prova nova depois da manifestação, abra nova vista ao investigado (art. 12, § 3º).',
            acoes: [
                A.documento('Juntar documentos requisitados e provas', '', { forma: 'juntar', nivel: 'recomendado' }),
                A.audiencia('Designar diligência ou oitiva, se houver', 'oitiva'),
                A.comunicar('Intimar para a diligência', { especie: 'intimacao', dias: 0, texto: 'Compareça à diligência em {audiencia}.' }),
                A.documento('Juntar parecer de especialista, se pedido', 'Parecer', { forma: 'juntar', nivel: 'opcional' }),
                A.simNao('Foram juntadas provas novas depois da manifestação?', { obrigatoria: true }),
            ],
            saidas: { 'Nova manifestação': quando('Foram juntadas provas novas depois da manifestação?', 'sim'), 'Deliberação': quando('Foram juntadas provas novas depois da manifestação?', 'nao') },
        },
        {
            nome: 'Nova manifestação', unidade: 'Comissão de ética', avanco: 'auto', vai: ['Deliberação'],
            orientacao: 'Juntadas provas novas, o investigado tem 10 dias para se manifestar sobre elas (art. 12, § 3º).',
            acoes: [
                A.comunicar('Notificar o investigado das provas novas', { especie: 'notificacao', polos: ['requerido'], dias: 10, texto: 'Foram juntadas provas novas. Manifeste-se sobre elas em 10 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar a nova manifestação', 'Notificar o investigado das provas novas', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Deliberação', unidade: 'Comissão de ética', vai: ['Providências', 'Arquivamento'], nome_publico: 'Decisão da comissão',
            orientacao: 'O colegiado delibera em reunião e profere decisão conclusiva e fundamentada (art. 12, § 4º). A censura ética é a sanção típica; cabem também recomendações. O acordo de conduta pessoal e profissional, para falta de menor gravidade, está na Resolução CEP 10/2008 (confira).',
            acoes: [
                A.audiencia('Pautar a reunião deliberativa', 'reuniao'),
                A.escolha('Conclusão', ['Sem falta ética', 'Censura ética', 'Recomendação', 'Acordo de conduta'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão conclusiva e fundamentada', 'Decisão', { forma: 'redigir' }),
                A.documento('Juntar a ata da reunião', 'Ata', { forma: 'redigir', nivel: 'recomendado' }),
                A.comunicar('Intimar as partes da decisão', { especie: 'intimacao', dias: 0, texto: 'Fica intimado da decisão da comissão de ética.' }, { obrigatoria: true }),
            ],
            saidas: { 'Providências': quando('Conclusão', 'Censura ética', 'Recomendação', 'Acordo de conduta'), 'Arquivamento': quando('Conclusão', 'Sem falta ética') },
        },
        {
            nome: 'Providências', unidade: 'Comissão de ética', vai: ['Arquivamento'], ao_entrar: { sigilo: 'normal' },
            orientacao: 'Adote os encaminhamentos do art. 12, § 5º, entre eles comunicar à autoridade para apuração disciplinar, quando couber. Concluído o procedimento, os autos deixam de ser reservados, mas os documentos sob sigilo legal são retirados e guardados à parte (art. 13).',
            acoes: [
                A.fazer('Encaminhar a decisão à autoridade a que o agente se vincula', { obrigatoria: true, destino: 'autos' }),
                A.simNao('Cabe apuração disciplinar?', { obrigatoria: true }),
                A.fazer('Comunicar à corregedoria para apuração disciplinar', { obrigatoria: true, se: quando('Cabe apuração disciplinar?', 'sim') }),
                A.fazer('Acompanhar o cumprimento do acordo de conduta, se houver'),
                A.fazer('Retirar e guardar à parte os documentos sob sigilo legal', { obrigatoria: true, ajuda: 'Concluído o procedimento, os autos deixam de ser reservados (art. 13).' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

export const modelos = [processoEticoProfissional, processoDisciplinarEntidadeClasse, apuracaoComissaoEticaPublica];
