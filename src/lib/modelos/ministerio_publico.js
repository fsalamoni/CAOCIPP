// Modelos da área ministerio_publico: procedimentos extrajudiciais não penais
// (Res. CNMP 174/2017 e 23/2007). Ver a forma de escrever em ./dsl.js e o exemplo em ./geral.js.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';

/** 13-A. Notícia de Fato (Res. CNMP 174/2017, arts. 1º a 7º). */
export function noticiaDeFato() {
    return montar({
        id: 'noticia-de-fato', nome: 'Notícia de Fato', area: 'ministerio_publico', porte: 'curto',
        descricao: 'Registro e triagem de qualquer demanda que chega à atividade-fim do Ministério Público: atendimento, documento, requerimento ou representação. O membro aprecia em 30 dias, prorrogáveis uma vez por até 90, colhendo só informações preliminares, sem expedir requisições; o noticiante pode ser chamado a complementar. A decisão arquiva, declina a atribuição a outro órgão ou instaura o procedimento próprio. Arquivada, o noticiante é cientificado e tem 10 dias para recorrer; sem reconsideração, o recurso sobe ao Conselho Superior.',
        quando: 'Porta de entrada de toda demanda extrajudicial cível que ainda não justifica procedimento próprio: representações, atendimentos ao público, ofícios e documentos recebidos.',
        base: 'Res. CNMP 174/2017, arts. 1º a 7º (registro e distribuição, art. 2º; prazo, art. 3º; arquivamento e recurso, arts. 4º e 5º; instauração, art. 7º).',
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Noticiante', interessado: 'Interessado' } },
    }, [
        {
            nome: 'Registro e distribuição', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Recebimento da notícia',
            orientacao: 'Registre a demanda no sistema e distribua de forma livre e aleatória; havendo procedimento em curso sobre o mesmo fato, distribua por prevenção (art. 2º). Notícia verbal é reduzida a termo.',
            acoes: [
                A.formulario('Registrar a notícia de fato', [
                    { id: 'forma', rotulo: 'Forma de entrada', tipo: 'lista', obrigatorio: true, opcoes: ['Atendimento', 'Documento', 'Requerimento', 'Representação', 'De ofício'] },
                    { id: 'fato', rotulo: 'Resumo do fato noticiado', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'tema', rotulo: 'Área de atuação', tipo: 'lista', obrigatorio: true, opcoes: ['Meio ambiente', 'Consumidor', 'Patrimônio público', 'Saúde', 'Educação', 'Urbanismo', 'Infância e juventude', 'Outra'] },
                    { id: 'email', rotulo: 'Correio eletrônico do noticiante', tipo: 'texto', obrigatorio: false },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a notícia e os documentos recebidos', 'Notícia de fato', { forma: 'juntar' }),
                A.simNao('Há procedimento em curso sobre o mesmo fato?', { obrigatoria: true, ajuda: 'Se sim, distribua por prevenção ao membro que conduz o procedimento (art. 2º).' }),
            ],
        },
        {
            nome: 'Apreciação', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Complementação pelo noticiante', 'Decisão'],
            orientacao: 'Aprecie em 30 dias do recebimento, prorrogáveis uma vez, fundamentadamente, por até 90 dias (art. 3º). Colha só as informações preliminares imprescindíveis; é vedado expedir requisições (art. 3º, parágrafo único). Vencido o prazo sem solução, instaure o procedimento próprio (art. 7º).',
            acoes: [
                A.orientar('Não expeça requisições nesta fase', 'Na notícia de fato só cabem informações preliminares imprescindíveis (art. 3º, parágrafo único).'),
                A.fazer('Colher as informações preliminares imprescindíveis'),
                A.simNao('Prorrogar o prazo por até 90 dias?', { obrigatoria: true, ajuda: 'Uma única prorrogação, por decisão fundamentada (art. 3º).' }),
                A.documento('Despacho de prorrogação', 'Despacho', { forma: 'redigir', se: quando('Prorrogar o prazo por até 90 dias?', 'sim') }),
                A.simNao('O noticiante precisa complementar a notícia?', { obrigatoria: true }),
            ],
            saidas: { 'Complementação pelo noticiante': quando('O noticiante precisa complementar a notícia?', 'sim'), 'Decisão': quando('O noticiante precisa complementar a notícia?', 'nao') },
        },
        {
            nome: 'Complementação pelo noticiante', unidade: 'Secretaria', espera: true, avanco: 'auto', nome_publico: 'Complementação da notícia',
            orientacao: 'Notifique o noticiante, de preferência por correio eletrônico, dizendo o que falta. Respondida ou vencido o prazo, o processo volta à apreciação. Sem complementação e sem elementos mínimos, a notícia é arquivada (art. 4º, III).',
            acoes: [
                A.comunicar('Notificar o noticiante para complementar', { especie: 'notificacao', polos: ['requerente'], dias: 10, contagem: corridos, texto: 'Complemente a notícia de fato com as informações indicadas a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a complementação', 'Notificar o noticiante para complementar', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Decisão', unidade: 'Gabinete', vai: ['Cientificação do arquivamento', 'Instauração de procedimento', 'Remessa por declínio'],
            orientacao: 'Arquive se o fato já foi investigado, judicializado ou solucionado, se a lesão é manifestamente insignificante ou se faltam elementos mínimos (art. 4º, I a III). Se o fato pede apuração ou acompanhamento, instaure o procedimento próprio (art. 7º). Se a atribuição é de outro órgão, decline (art. 2º, §§ 2º e 3º).',
            acoes: [
                A.escolha('Encaminhamento', ['Arquivar', 'Instaurar procedimento', 'Declinar atribuição'], { obrigatoria: true, destino: 'autos' }),
                A.escolha('Fundamento do arquivamento', ['Fato já investigado, judicializado ou solucionado', 'Lesão manifestamente insignificante', 'Sem elementos mínimos e sem complementação'], { obrigatoria: true, se: quando('Encaminhamento', 'Arquivar') }),
                A.documento('Promoção de arquivamento', 'Promoção de arquivamento', { forma: 'redigir', se: quando('Encaminhamento', 'Arquivar') }),
                A.escolha('Procedimento a instaurar', ['Procedimento administrativo', 'Procedimento preparatório', 'Inquérito civil'], { obrigatoria: true, se: quando('Encaminhamento', 'Instaurar procedimento') }),
                A.documento('Despacho de declínio de atribuição', 'Despacho', { forma: 'redigir', se: quando('Encaminhamento', 'Declinar atribuição') }),
            ],
            saidas: { 'Cientificação do arquivamento': quando('Encaminhamento', 'Arquivar'), 'Instauração de procedimento': quando('Encaminhamento', 'Instaurar procedimento'), 'Remessa por declínio': quando('Encaminhamento', 'Declinar atribuição') },
        },
        {
            nome: 'Cientificação do arquivamento', unidade: 'Secretaria', avanco: 'auto', vai: ['Recurso do arquivamento', 'Arquivamento'], padrao: 'Arquivamento',
            orientacao: 'Dê ciência ao noticiante, preferencialmente por correio eletrônico; a ciência é facultativa se a notícia veio por dever de ofício (art. 4º, §§ 1º e 2º). O recurso cabe em 10 dias e é protocolado neste órgão. Sem recurso, arquiva-se aqui mesmo (art. 5º).',
            acoes: [
                A.simNao('A notícia chegou por dever de ofício?', { obrigatoria: true, ajuda: 'Se sim, a cientificação do noticiante é facultativa (art. 4º, § 2º).' }),
                A.comunicar('Dar ciência do arquivamento ao noticiante', { especie: 'ciencia', polos: ['requerente'], dias: 10, contagem: corridos, texto: 'A notícia de fato foi arquivada. Cabe recurso em 10 dias, protocolado neste órgão.' }, { obrigatoria: true, se: quando('A notícia chegou por dever de ofício?', 'nao') }),
                A.esperar('Aguardar o prazo de recurso', 'Dar ciência do arquivamento ao noticiante', { obrigatoria: true, se: quando('A notícia chegou por dever de ofício?', 'nao') }),
            ],
            saidas: { 'Recurso do arquivamento': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial') },
        },
        {
            nome: 'Recurso do arquivamento', unidade: 'Gabinete', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Instauração de procedimento', 'Revisão pelo Conselho Superior'],
            ao_entrar: { pendencia: 'Recurso contra o arquivamento: reconsiderar ou remeter ao Conselho Superior em 3 dias.' },
            orientacao: 'O membro pode reconsiderar. Se mantiver o arquivamento, remeta o recurso em 3 dias ao Conselho Superior ou à Câmara de Coordenação e Revisão (art. 4º, § 3º).',
            acoes: [
                A.simNao('Reconsidera o arquivamento?', { obrigatoria: true, destino: 'autos' }),
                A.documento('Despacho de manutenção e remessa', 'Despacho', { forma: 'redigir', se: quando('Reconsidera o arquivamento?', 'nao') }),
            ],
            saidas: { 'Instauração de procedimento': quando('Reconsidera o arquivamento?', 'sim'), 'Revisão pelo Conselho Superior': quando('Reconsidera o arquivamento?', 'nao') },
        },
        {
            nome: 'Revisão pelo Conselho Superior', unidade: 'Conselho Superior', vai: ['Arquivamento', 'Instauração de procedimento'], nome_publico: 'Julgamento do recurso',
            orientacao: 'O Conselho Superior ou a Câmara de Coordenação e Revisão julga o recurso. Mantido o arquivamento, os autos voltam para arquivo; provido, instaura-se o procedimento próprio.',
            acoes: [
                A.escolha('Deliberação', ['Mantém o arquivamento', 'Dá provimento ao recurso'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do colegiado', 'Decisão', { forma: 'juntar' }),
                A.comunicar('Comunicar a decisão ao noticiante', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Fica comunicado da decisão sobre o recurso contra o arquivamento.' }),
            ],
            saidas: { 'Arquivamento': quando('Deliberação', 'Mantém o arquivamento'), 'Instauração de procedimento': quando('Deliberação', 'Dá provimento ao recurso') },
        },
        {
            nome: 'Instauração de procedimento', unidade: 'Gabinete', vai: ['Arquivamento'],
            orientacao: 'Instaure o procedimento próprio (procedimento administrativo, preparatório ou inquérito civil) em processo com o rito correspondente, vinculado a esta notícia (art. 7º). Feito isso, esta notícia se encerra.',
            acoes: [
                A.documento('Portaria de instauração', 'Portaria', { forma: 'redigir' }),
                A.texto('Número do procedimento instaurado', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Remessa por declínio', unidade: 'Secretaria', vai: ['Arquivamento'],
            orientacao: 'Remeta a notícia ao órgão com atribuição e comunique o noticiante (art. 2º, §§ 2º e 3º).',
            acoes: [
                A.fazer('Remeter ao órgão com atribuição', { obrigatoria: true, destino: 'autos' }),
                A.comunicar('Comunicar a remessa ao noticiante', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'A notícia de fato foi remetida ao órgão com atribuição para o caso.' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, no próprio órgão, com registro no sistema (art. 5º).' },
    ]);
}

/** 13-B. Procedimento Administrativo (Res. CNMP 174/2017, arts. 8º a 13). */
export function procedimentoAdministrativoMp() {
    return montar({
        id: 'procedimento-administrativo-mp', nome: 'Procedimento Administrativo do Ministério Público', area: 'ministerio_publico', porte: 'medio',
        descricao: 'Acompanha de forma continuada o cumprimento de termo de ajustamento de conduta, políticas públicas e instituições, apura fato ligado a direito individual indisponível ou embasa outra atividade que não cabe em inquérito civil. Não investiga pessoa determinada por ilícito específico. Instaurado por portaria sucinta, corre por um ano, prorrogável sucessivamente por decisão fundamentada, com ofícios, requisições e reuniões com o acompanhado. Cumprido o objeto, arquiva-se no próprio órgão com comunicação ao Conselho Superior; no caso de direito individual indisponível, o noticiante é cientificado e pode recorrer em 10 dias.',
        quando: 'Para acompanhar TAC, fiscalizar política pública ou instituição, tratar de direito individual indisponível ou embasar atividade sem caráter investigativo.',
        base: 'Res. CNMP 174/2017, arts. 8º (cabimento), 9º (portaria), 10 (fato novo), 11 (prazo e prorrogação), 12 e 13 (arquivamento e recurso).',
        tipo: { polos: ['requerente', 'requerido', 'interessado'], nomes_polos: { requerente: 'Noticiante', requerido: 'Acompanhado', interessado: 'Interessado' } },
    }, [
        {
            nome: 'Instauração', unidade: 'Gabinete',
            orientacao: 'Instaure por portaria sucinta, com a delimitação do objeto (art. 9º). O procedimento não serve para investigar pessoa determinada por ilícito específico (art. 8º, parágrafo único).',
            acoes: [
                A.escolha('Finalidade', ['Acompanhar termo de ajustamento de conduta', 'Acompanhar política pública ou instituição', 'Apurar direito individual indisponível', 'Embasar outra atividade não sujeita a inquérito civil'], { obrigatoria: true, destino: 'autos', ajuda: 'Incisos I a IV do art. 8º.' }),
                A.formulario('Dados da instauração', [
                    { id: 'objeto', rotulo: 'Objeto delimitado', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'acompanhado', rotulo: 'Órgão, entidade ou pessoa acompanhada', tipo: 'texto', obrigatorio: true },
                    { id: 'origem', rotulo: 'Número da notícia de fato ou procedimento de origem', tipo: 'texto', obrigatorio: false },
                    { id: 'tac', rotulo: 'Número do termo de ajustamento acompanhado', tipo: 'texto', obrigatorio: false },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Portaria de instauração', 'Portaria', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Registro e comunicação', unidade: 'Secretaria', avanco: 'auto',
            orientacao: 'Registre e autue a portaria no sistema e comunique a instauração ao acompanhado.',
            acoes: [
                A.fazer('Registrar e autuar a portaria', { obrigatoria: true }),
                A.comunicar('Comunicar a instauração ao acompanhado', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'Foi instaurado procedimento administrativo para o acompanhamento descrito na portaria anexa.' }),
            ],
        },
        {
            nome: 'Acompanhamento e diligências', unidade: 'Gabinete', prazo_dias: 365, prazo_auto: true, prazo_contagem: corridos, vai: ['Aguardando resposta', 'Avaliação do objeto'],
            orientacao: 'Acompanhe por ofícios, requisições, reuniões e inspeções. O prazo é de 1 ano, prorrogável sucessivamente por igual período com decisão fundamentada (art. 11). Surgindo fato que exija investigação cível ou outra apuração, instaure o procedimento próprio ou remeta a quem tenha atribuição (art. 10).',
            acoes: [
                A.fazer('Expedir ofícios e pedidos de informação'),
                A.audiencia('Designar reunião ou inspeção, se houver', 'reuniao'),
                A.comunicar('Notificar o acompanhado da reunião', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Compareça à reunião de acompanhamento em {audiencia}.' }),
                A.simNao('Surgiu fato que exige investigação própria?', { obrigatoria: true, ajuda: 'Se sim, instaure o procedimento próprio ou remeta a quem tenha atribuição (art. 10).' }),
                A.documento('Despacho de instauração ou remessa', 'Despacho', { forma: 'redigir', se: quando('Surgiu fato que exige investigação própria?', 'sim') }),
                A.simNao('Aguardar resposta de requisição ou ofício?', { obrigatoria: true }),
            ],
            saidas: { 'Aguardando resposta': quando('Aguardar resposta de requisição ou ofício?', 'sim'), 'Avaliação do objeto': quando('Aguardar resposta de requisição ou ofício?', 'nao') },
        },
        {
            nome: 'Aguardando resposta', unidade: 'Secretaria', espera: true, avanco: 'auto', nome_publico: 'Aguardando informações',
            orientacao: 'Expeça a requisição ou o ofício ao acompanhado e aguarde. Com a resposta ou o fim do prazo, o processo volta ao acompanhamento.',
            acoes: [
                A.comunicar('Requisitar informações ao acompanhado', { especie: 'notificacao', polos: ['requerido'], dias: 10, texto: 'Encaminhe, no prazo indicado, as informações e os documentos requisitados a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta', 'Requisitar informações ao acompanhado', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Avaliação do objeto', unidade: 'Gabinete', vai: ['Prorrogação', 'Comunicação ao Conselho Superior', 'Cientificação do arquivamento'],
            orientacao: 'Cumprido ou exaurido o objeto, promova o arquivamento. Nos casos dos incisos I, II e IV do art. 8º, arquiva-se no próprio órgão, com comunicação ao Conselho Superior, sem remessa para homologação (art. 12). No inciso III, o noticiante é cientificado e pode recorrer (art. 13).',
            acoes: [
                A.escolha('Situação do objeto', ['Objeto cumprido ou exaurido', 'Prosseguir o acompanhamento'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Promoção de arquivamento', 'Promoção de arquivamento', { forma: 'redigir', se: quando('Situação do objeto', 'Objeto cumprido ou exaurido') }),
                A.simNao('O objeto é direito individual indisponível (art. 8º, III)?', { obrigatoria: true, se: quando('Situação do objeto', 'Objeto cumprido ou exaurido') }),
            ],
            saidas: {
                'Prorrogação': quando('Situação do objeto', 'Prosseguir o acompanhamento'),
                'Comunicação ao Conselho Superior': quando('O objeto é direito individual indisponível (art. 8º, III)?', 'nao'),
                'Cientificação do arquivamento': quando('O objeto é direito individual indisponível (art. 8º, III)?', 'sim'),
            },
        },
        {
            nome: 'Prorrogação', unidade: 'Gabinete', vai: ['Acompanhamento e diligências'],
            orientacao: 'Prorrogue por mais 1 ano com decisão fundamentada (art. 11); o acompanhamento recomeça com novo prazo.',
            acoes: [A.documento('Despacho de prorrogação fundamentada', 'Despacho', { forma: 'redigir' })],
        },
        {
            nome: 'Comunicação ao Conselho Superior', unidade: 'Secretaria', vai: ['Arquivamento'],
            orientacao: 'Comunique o arquivamento ao Conselho Superior ou à Câmara de Coordenação e Revisão; não há remessa para homologação (art. 12).',
            acoes: [
                A.fazer('Comunicar o arquivamento ao Conselho Superior', { obrigatoria: true, destino: 'autos' }),
                A.comunicar('Comunicar o arquivamento ao acompanhado', { especie: 'comunicacao', polos: ['requerido'], dias: 0, texto: 'O procedimento administrativo foi arquivado.' }),
            ],
        },
        {
            nome: 'Cientificação do arquivamento', unidade: 'Secretaria', avanco: 'auto', vai: ['Recurso do arquivamento', 'Arquivamento'],
            orientacao: 'Dê ciência ao noticiante, que pode recorrer em 10 dias (art. 13). Sem recurso, arquiva-se.',
            acoes: [
                A.comunicar('Dar ciência do arquivamento ao noticiante', { especie: 'ciencia', polos: ['requerente'], dias: 10, contagem: corridos, texto: 'O procedimento administrativo foi arquivado. Cabe recurso em 10 dias, protocolado neste órgão.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Dar ciência do arquivamento ao noticiante', { obrigatoria: true }),
            ],
            saidas: { 'Recurso do arquivamento': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Arquivamento': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso do arquivamento', unidade: 'Gabinete', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Acompanhamento e diligências', 'Revisão pelo Conselho Superior'],
            ao_entrar: { pendencia: 'Recurso contra o arquivamento: reconsiderar ou remeter ao Conselho Superior em 3 dias.' },
            orientacao: 'O membro pode reconsiderar e retomar o acompanhamento. Mantido o arquivamento, remeta o recurso em 3 dias ao Conselho Superior ou à Câmara (art. 13).',
            acoes: [
                A.simNao('Reconsidera o arquivamento?', { obrigatoria: true, destino: 'autos' }),
                A.documento('Despacho de manutenção e remessa', 'Despacho', { forma: 'redigir', se: quando('Reconsidera o arquivamento?', 'nao') }),
            ],
            saidas: { 'Acompanhamento e diligências': quando('Reconsidera o arquivamento?', 'sim'), 'Revisão pelo Conselho Superior': quando('Reconsidera o arquivamento?', 'nao') },
        },
        {
            nome: 'Revisão pelo Conselho Superior', unidade: 'Conselho Superior', vai: ['Arquivamento', 'Acompanhamento e diligências'], nome_publico: 'Julgamento do recurso',
            orientacao: 'O colegiado julga o recurso: mantido o arquivamento, arquiva-se; provido, o acompanhamento é retomado.',
            acoes: [
                A.escolha('Deliberação', ['Mantém o arquivamento', 'Dá provimento ao recurso'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do colegiado', 'Decisão', { forma: 'juntar' }),
            ],
            saidas: { 'Arquivamento': quando('Deliberação', 'Mantém o arquivamento'), 'Acompanhamento e diligências': quando('Deliberação', 'Dá provimento ao recurso') },
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar, no próprio órgão, com registro no sistema.' },
    ]);
}

/** 13-C. Procedimento Preparatório (Res. CNMP 23/2007, art. 2º, §§ 4º a 7º, e art. 10). */
export function procedimentoPreparatorio() {
    return montar({
        id: 'procedimento-preparatorio', nome: 'Procedimento Preparatório', area: 'ministerio_publico', porte: 'medio',
        descricao: 'Antecede o inquérito civil quando ainda falta identificar o investigado ou delimitar o objeto. Corre por 90 dias, prorrogáveis uma única vez por igual prazo, com requisições, notificações e oitivas. Ao final, converte-se em inquérito civil, dá base à ação civil pública ou é arquivado. O arquivamento passa pelo mesmo controle do inquérito: o representante e o investigado são cientificados, os autos sobem ao Conselho Superior em 3 dias e lá podem apresentar razões até a sessão.',
        quando: 'Quando a notícia indica possível lesão a direito difuso, coletivo ou individual homogêneo, mas faltam elementos para identificar o investigado ou delimitar o objeto do inquérito civil.',
        base: 'Res. CNMP 23/2007, art. 2º, §§ 4º a 7º (cabimento, numeração e prazo), art. 10 (arquivamento e revisão) e art. 12 (desarquivamento); Lei 7.347/1985, art. 8º, § 1º (requisições).',
        tipo: { polos: ['requerente', 'requerido', 'interessado', 'terceiro'], nomes_polos: { requerente: 'Representante', requerido: 'Investigado', interessado: 'Interessado', terceiro: 'Órgão requisitado' } },
    }, [
        {
            nome: 'Instauração', unidade: 'Gabinete',
            orientacao: 'Instaure por portaria quando faltar identificar o investigado ou delimitar o objeto (art. 2º, § 4º). A numeração é sequencial à do inquérito civil e se mantém se houver conversão (art. 2º, § 5º).',
            acoes: [
                A.formulario('Dados da instauração', [
                    { id: 'fato', rotulo: 'Fato a apurar', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'falta', rotulo: 'O que falta esclarecer', tipo: 'lista', obrigatorio: true, opcoes: ['Identificar o investigado', 'Delimitar o objeto', 'Ambos'] },
                    { id: 'tema', rotulo: 'Área de atuação', tipo: 'lista', obrigatorio: true, opcoes: ['Meio ambiente', 'Consumidor', 'Patrimônio público', 'Saúde', 'Educação', 'Urbanismo', 'Outra'] },
                    { id: 'origem', rotulo: 'Número da notícia de fato de origem', tipo: 'texto', obrigatorio: false },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Portaria de instauração', 'Portaria', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Registro e publicação', unidade: 'Secretaria', avanco: 'auto',
            orientacao: 'Registre com numeração sequencial à do inquérito civil (art. 2º, § 5º) e remeta a portaria para publicação.',
            acoes: [
                A.fazer('Registrar com numeração sequencial', { obrigatoria: true }),
                A.fazer('Remeter a portaria para publicação', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Diligências', unidade: 'Gabinete', prazo_dias: 90, prazo_auto: true, prazo_contagem: corridos, vai: ['Aguardando resposta a requisição', 'Prorrogação', 'Conclusão'],
            orientacao: 'Prazo de 90 dias, prorrogável por igual prazo uma única vez, por motivo justificável (art. 2º, § 6º). Requisite informações, notifique e tome declarações por termo. Vencido o prazo, conclua (art. 2º, § 7º).',
            acoes: [
                A.fazer('Expedir requisições e notificações'),
                A.audiencia('Designar oitiva, se houver', 'oitiva'),
                A.comunicar('Notificar para a oitiva', { especie: 'notificacao', dias: 0, texto: 'Compareça para prestar declarações em {audiencia}.' }),
                A.documento('Juntar termos de declaração e documentos', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.escolha('Próximo passo', ['Aguardar resposta a requisição', 'Prorrogar por mais 90 dias', 'Concluir'], { obrigatoria: true }),
            ],
            saidas: { 'Aguardando resposta a requisição': quando('Próximo passo', 'Aguardar resposta a requisição'), 'Prorrogação': quando('Próximo passo', 'Prorrogar por mais 90 dias'), 'Conclusão': quando('Próximo passo', 'Concluir') },
        },
        {
            nome: 'Aguardando resposta a requisição', unidade: 'Secretaria', espera: true, avanco: 'auto', nome_publico: 'Aguardando informações',
            orientacao: 'Requisite ao investigado ou ao órgão requisitado (cadastre-o como parte). O prazo não pode ser inferior a 10 dias úteis (Lei 7.347/1985, art. 8º, § 1º). Com a resposta ou o fim do prazo, volta às diligências.',
            acoes: [
                A.comunicar('Requisitar informações e documentos', { especie: 'notificacao', polos: ['requerido', 'terceiro'], dias: 10, texto: 'Encaminhe, no prazo indicado, as informações e os documentos requisitados a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta', 'Requisitar informações e documentos', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Prorrogação', unidade: 'Gabinete', vai: ['Diligências'],
            orientacao: 'Só cabe uma prorrogação, por igual prazo e por motivo justificável (art. 2º, § 6º). Já prorrogado, conclua.',
            acoes: [A.documento('Despacho de prorrogação fundamentada', 'Despacho', { forma: 'redigir' })],
        },
        {
            nome: 'Conclusão', unidade: 'Gabinete', vai: ['Conversão em inquérito civil', 'Ajuizamento de ação civil pública', 'Cientificação e remessa ao Conselho Superior'],
            ao_entrar: { pendencia: 'Concluir o procedimento preparatório: converter, ajuizar ou promover o arquivamento.' },
            orientacao: 'Vencido o prazo, converta em inquérito civil, ajuíze a ação civil pública ou promova fundamentadamente o arquivamento (art. 2º, § 7º).',
            acoes: [
                A.escolha('Conclusão', ['Converter em inquérito civil', 'Ajuizar ação civil pública', 'Promover o arquivamento'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Portaria de conversão', 'Portaria', { forma: 'redigir', se: quando('Conclusão', 'Converter em inquérito civil') }),
                A.documento('Promoção de arquivamento', 'Promoção de arquivamento', { forma: 'redigir', se: quando('Conclusão', 'Promover o arquivamento') }),
            ],
            saidas: { 'Conversão em inquérito civil': quando('Conclusão', 'Converter em inquérito civil'), 'Ajuizamento de ação civil pública': quando('Conclusão', 'Ajuizar ação civil pública'), 'Cientificação e remessa ao Conselho Superior': quando('Conclusão', 'Promover o arquivamento') },
        },
        {
            nome: 'Conversão em inquérito civil', unidade: 'Secretaria', vai: ['Arquivamento'],
            orientacao: 'A conversão mantém a numeração (art. 2º, § 5º). Abra o inquérito civil no rito próprio, vinculado a este processo, e encerre aqui o preparatório.',
            acoes: [
                A.fazer('Registrar a conversão no sistema', { obrigatoria: true, destino: 'autos' }),
                A.texto('Número do inquérito civil', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Ajuizamento de ação civil pública', unidade: 'Gabinete', vai: ['Arquivamento'],
            orientacao: 'Junte a petição inicial e registre o número da ação. O procedimento se encerra com o ajuizamento.',
            acoes: [
                A.documento('Juntar a petição inicial', 'Petição inicial', { forma: 'juntar' }),
                A.texto('Número da ação ajuizada', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Cientificação e remessa ao Conselho Superior', unidade: 'Secretaria', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Revisão pelo Conselho Superior'],
            orientacao: 'Cientifique pessoalmente o representante e o investigado; não localizados, publique. Remeta os autos ao Conselho Superior em 3 dias, contados da comprovação da cientificação ou da publicação (art. 10, § 1º).',
            acoes: [
                A.comunicar('Dar ciência da promoção de arquivamento', { especie: 'ciencia', polos: ['requerente', 'requerido'], dias: 0, texto: 'Foi promovido o arquivamento deste procedimento. Até a sessão do Conselho Superior, você pode apresentar razões escritas ou documentos.' }, { obrigatoria: true }),
                A.fazer('Publicar a cientificação de quem não foi localizado'),
                A.fazer('Remeter os autos ao Conselho Superior', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Revisão pelo Conselho Superior', unidade: 'Conselho Superior', vai: ['Arquivamento', 'Diligências', 'Designação de outro membro'], nome_publico: 'Revisão do arquivamento',
            ao_entrar: { pendencia: 'Pautar e deliberar sobre a promoção de arquivamento.' },
            orientacao: 'Até a sessão, colegitimados e interessados podem apresentar razões ou documentos (art. 10, § 3º). O colegiado homologa, converte em diligência ou rejeita e designa outro membro para prosseguir (art. 10, § 4º).',
            acoes: [
                A.audiencia('Pautar a sessão de revisão', 'sessao'),
                A.comunicar('Comunicar a pauta aos interessados', { especie: 'comunicacao', dias: 0, texto: 'A promoção de arquivamento será apreciada na sessão de {audiencia}.' }),
                A.escolha('Deliberação', ['Homologa o arquivamento', 'Converte em diligência', 'Rejeita e designa outro membro'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do colegiado', 'Decisão', { forma: 'juntar' }),
            ],
            saidas: { 'Arquivamento': quando('Deliberação', 'Homologa o arquivamento'), 'Diligências': quando('Deliberação', 'Converte em diligência'), 'Designação de outro membro': quando('Deliberação', 'Rejeita e designa outro membro') },
        },
        {
            nome: 'Designação de outro membro', unidade: 'Secretaria', vai: ['Conclusão'],
            orientacao: 'Registre o membro designado pelo colegiado. Ele dá seguimento, convertendo em inquérito civil ou ajuizando a ação (art. 10, § 4º).',
            acoes: [A.texto('Membro designado', { obrigatoria: true, destino: 'autos' })],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Prova nova ou fato novo relevante permite desarquivar em até 6 meses; depois, instaura-se novo procedimento (art. 12).' },
    ]);
}

/** 13-D. Inquérito Civil (Res. CNMP 23/2007; Lei 7.347/1985). */
export function inqueritoCivil() {
    return montar({
        id: 'inquerito-civil', nome: 'Inquérito Civil', area: 'ministerio_publico', porte: 'longo',
        descricao: 'Investigação presidida por membro do Ministério Público para apurar lesão a direitos difusos, coletivos ou individuais homogêneos, como meio ambiente, consumidor e patrimônio público, e preparar ação civil pública, ajustamento de conduta ou recomendação. A representação pode ser indeferida em 30 dias, com recurso; instaurado por portaria, corre por um ano, prorrogável quantas vezes for preciso, com requisições, oitivas e audiências. É inquisitivo, mas o investigado e o representante podem ser ouvidos e juntar documentos a qualquer tempo. Termina com ação civil pública ou com promoção de arquivamento, que sobe ao Conselho Superior em 3 dias para homologação.',
        quando: 'Quando há elementos de lesão a direito difuso, coletivo ou individual homogêneo, com investigado e objeto identificáveis, a apurar antes de ação civil pública ou solução negociada.',
        base: 'Res. CNMP 23/2007, arts. 2º (representação), 4º (portaria), 5º (indeferimento e recurso), 6º (instrução), 7º (publicidade), 9º e 9º-A (prazo e declínio), 10 e 11 (arquivamento e revisão), 12 (desarquivamento) e 14 (ajustamento); Lei 7.347/1985, arts. 5º, § 6º, 8º e 9º.',
        tipo: { polos: ['requerente', 'requerido', 'interessado', 'terceiro'], nomes_polos: { requerente: 'Representante', requerido: 'Investigado', interessado: 'Interessado', terceiro: 'Órgão requisitado' } },
    }, [
        {
            nome: 'Representação ou atuação de ofício', unidade: 'Secretaria', avanco: 'auto', nome_publico: 'Recebimento',
            orientacao: 'A representação deve trazer informações sobre o fato e o provável autor; se verbal, reduza a termo (art. 2º, II e § 2º). Na atuação de ofício, registre o fato que a motivou.',
            acoes: [
                A.formulario('Registrar a origem', [
                    { id: 'origem', rotulo: 'Origem', tipo: 'lista', obrigatorio: true, opcoes: ['Representação escrita', 'Representação verbal reduzida a termo', 'De ofício', 'Notícia de fato convertida', 'Procedimento preparatório convertido'] },
                    { id: 'fato', rotulo: 'Fato noticiado', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'autor', rotulo: 'Provável autor', tipo: 'texto', obrigatorio: false },
                    { id: 'tema', rotulo: 'Área de atuação', tipo: 'lista', obrigatorio: true, opcoes: ['Meio ambiente', 'Consumidor', 'Patrimônio público', 'Saúde', 'Educação', 'Urbanismo', 'Outra'] },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a representação ou o termo', 'Representação', { forma: 'juntar', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Admissibilidade', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Instauração', 'Indeferimento da representação', 'Declínio de atribuição'],
            orientacao: 'Decida em 30 dias (art. 5º). Indefira se o fato já foi apurado, é objeto de ação ou não configura lesão a interesse tutelado. Faltando elementos para identificar o investigado ou delimitar o objeto, use o rito do procedimento preparatório. Atribuição de outro Ministério Público: decline (art. 9º-A).',
            acoes: [
                A.escolha('Juízo sobre a representação', ['Instaurar inquérito civil', 'Indeferir a representação', 'Declinar atribuição'], { obrigatoria: true, destino: 'autos' }),
            ],
            saidas: { 'Instauração': quando('Juízo sobre a representação', 'Instaurar inquérito civil'), 'Indeferimento da representação': quando('Juízo sobre a representação', 'Indeferir a representação'), 'Declínio de atribuição': quando('Juízo sobre a representação', 'Declinar atribuição') },
        },
        {
            nome: 'Indeferimento da representação', unidade: 'Gabinete', vai: ['Recurso do indeferimento', 'Arquivamento'],
            orientacao: 'Indefira por decisão fundamentada, com ciência pessoal ao representante e ao representado. Cabe recurso em 10 dias (art. 5º, § 1º).',
            acoes: [
                A.documento('Decisão de indeferimento', 'Despacho', { forma: 'redigir' }),
                A.comunicar('Dar ciência do indeferimento', { especie: 'ciencia', polos: ['requerente', 'requerido'], dias: 10, contagem: corridos, texto: 'A representação foi indeferida. Cabe recurso em 10 dias, protocolado neste órgão.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Dar ciência do indeferimento', { obrigatoria: true }),
            ],
            saidas: { 'Recurso do indeferimento': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Arquivamento': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso do indeferimento', unidade: 'Gabinete', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Instauração', 'Cientificação e remessa ao Conselho Superior'],
            ao_entrar: { pendencia: 'Recurso contra o indeferimento: reconsiderar ou remeter ao Conselho Superior em 3 dias.' },
            orientacao: 'O membro pode reconsiderar e instaurar. Se mantiver, remeta em 3 dias ao Conselho Superior, notificando os interessados para contrarrazões (art. 5º, §§ 2º e 3º).',
            acoes: [
                A.simNao('Reconsidera o indeferimento?', { obrigatoria: true, destino: 'autos' }),
                A.documento('Despacho de manutenção e remessa', 'Despacho', { forma: 'redigir', se: quando('Reconsidera o indeferimento?', 'nao') }),
            ],
            saidas: { 'Instauração': quando('Reconsidera o indeferimento?', 'sim'), 'Cientificação e remessa ao Conselho Superior': quando('Reconsidera o indeferimento?', 'nao') },
        },
        {
            nome: 'Instauração', unidade: 'Gabinete',
            orientacao: 'Portaria numerada, com fundamento legal, descrição do fato, qualificação possível do investigado e do representante, data, local, diligências iniciais, designação de secretário e remessa de cópia para publicação (art. 4º). A publicidade é a regra; o sigilo é motivado (art. 7º).',
            acoes: [
                A.formulario('Dados da portaria', [
                    { id: 'fundamento', rotulo: 'Fundamento legal', tipo: 'texto', obrigatorio: true },
                    { id: 'fato', rotulo: 'Descrição do fato', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'investigado', rotulo: 'Investigado, se identificado', tipo: 'texto', obrigatorio: false },
                    { id: 'diligencias', rotulo: 'Diligências iniciais', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'secretario', rotulo: 'Secretário designado', tipo: 'texto', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Portaria de instauração', 'Portaria', { forma: 'redigir' }),
                A.simNao('Há sigilo legal ou risco à investigação?', { obrigatoria: true, ajuda: 'Se sim, decrete o sigilo por decisão motivada (art. 7º).' }),
                A.documento('Decisão de sigilo', 'Despacho', { forma: 'redigir', se: quando('Há sigilo legal ou risco à investigação?', 'sim') }),
            ],
        },
        {
            nome: 'Registro e publicação', unidade: 'Secretaria', avanco: 'auto',
            orientacao: 'Registre a portaria no sistema e remeta o extrato para publicação (art. 4º, VI, e art. 7º, § 2º).',
            acoes: [
                A.fazer('Registrar a portaria no sistema', { obrigatoria: true }),
                A.fazer('Remeter a portaria para publicação', { obrigatoria: true }),
                A.comunicar('Comunicar a instauração ao representante', { especie: 'comunicacao', polos: ['requerente'], dias: 0, texto: 'Foi instaurado inquérito civil a partir da sua representação.' }),
            ],
        },
        {
            nome: 'Instrução', unidade: 'Gabinete', prazo_dias: 365, prazo_auto: true, prazo_contagem: corridos,
            vai: ['Aguardando resposta a requisição', 'Recomendação', 'Ajustamento de conduta', 'Prorrogação', 'Declínio de atribuição', 'Conclusão'],
            orientacao: 'Cabem todas as provas permitidas; diligências por termo ou auto circunstanciado e declarações por termo, assinado pelos presentes; diligências podem ser deprecadas (art. 6º). Qualquer pessoa pode juntar documentos. Sem audiências de 20 de dezembro a 20 de janeiro, salvo urgência (art. 9º, § 4º). Prazo de 1 ano, prorrogável (art. 9º).',
            acoes: [
                A.fazer('Expedir requisições, notificações e diligências'),
                A.audiencia('Designar oitiva ou audiência', 'oitiva'),
                A.comunicar('Notificar para a oitiva', { especie: 'notificacao', dias: 0, texto: 'Compareça para prestar declarações em {audiencia}.' }),
                A.documento('Juntar termos, autos de diligência e documentos', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.simNao('Surgiu objeto diverso do da portaria?', { obrigatoria: true, ajuda: 'Se sim, adite a portaria ou extraia peças para novo inquérito (art. 4º, parágrafo único).' }),
                A.documento('Aditamento da portaria', 'Portaria', { forma: 'redigir', se: quando('Surgiu objeto diverso do da portaria?', 'sim') }),
                A.escolha('Próximo passo', ['Aguardar resposta a requisição', 'Expedir recomendação', 'Propor ajustamento de conduta', 'Prorrogar o prazo', 'Declinar atribuição', 'Concluir a investigação'], { obrigatoria: true }),
            ],
            saidas: {
                'Aguardando resposta a requisição': quando('Próximo passo', 'Aguardar resposta a requisição'),
                'Recomendação': quando('Próximo passo', 'Expedir recomendação'),
                'Ajustamento de conduta': quando('Próximo passo', 'Propor ajustamento de conduta'),
                'Prorrogação': quando('Próximo passo', 'Prorrogar o prazo'),
                'Declínio de atribuição': quando('Próximo passo', 'Declinar atribuição'),
                'Conclusão': quando('Próximo passo', 'Concluir a investigação'),
            },
        },
        {
            nome: 'Aguardando resposta a requisição', unidade: 'Secretaria', espera: true, avanco: 'auto', nome_publico: 'Aguardando informações',
            orientacao: 'Requisite ao investigado ou ao órgão requisitado (cadastre-o como parte). O prazo não pode ser inferior a 10 dias úteis (Lei 7.347/1985, art. 8º, § 1º). Com a resposta ou o fim do prazo, volta à instrução.',
            acoes: [
                A.comunicar('Requisitar informações e documentos', { especie: 'notificacao', polos: ['requerido', 'terceiro'], dias: 10, texto: 'Encaminhe, no prazo indicado, as informações e os documentos requisitados a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta', 'Requisitar informações e documentos', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Recomendação', unidade: 'Gabinete', vai: ['Instrução'],
            orientacao: 'Expeça a recomendação ao investigado, com as medidas e o prazo para informar o acatamento. Com a resposta ou o fim do prazo, volte à instrução.',
            acoes: [
                A.documento('Recomendação', 'Recomendação', { forma: 'redigir' }),
                A.comunicar('Notificar o investigado da recomendação', { especie: 'notificacao', polos: ['requerido'], dias: 30, texto: 'Fica notificado da recomendação anexa. Informe, no prazo indicado, as providências adotadas.' }, { obrigatoria: true }),
                A.esperar('Aguardar a resposta à recomendação', 'Notificar o investigado da recomendação', { obrigatoria: true }),
                A.simNao('Recomendação acatada?', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Ajustamento de conduta', unidade: 'Gabinete', vai: ['Instrução', 'Cientificação e remessa ao Conselho Superior'],
            orientacao: 'Negocie com o investigado o compromisso de ajustamento de conduta, com eficácia de título executivo extrajudicial (art. 14; Lei 7.347/1985, art. 5º, § 6º). Firmado, promova o arquivamento; o cumprimento passa a ser acompanhado em procedimento administrativo.',
            acoes: [
                A.audiencia('Designar reunião de negociação', 'reuniao'),
                A.comunicar('Notificar o investigado para a reunião', { especie: 'notificacao', polos: ['requerido'], dias: 0, texto: 'Compareça à reunião para tratar de ajustamento de conduta em {audiencia}.' }),
                A.simNao('Ajustamento firmado?', { obrigatoria: true, destino: 'autos' }),
                A.documento('Termo de ajustamento de conduta', 'Termo de ajustamento de conduta', { forma: 'qualquer', se: quando('Ajustamento firmado?', 'sim') }),
                A.documento('Promoção de arquivamento', 'Promoção de arquivamento', { forma: 'redigir', se: quando('Ajustamento firmado?', 'sim') }),
            ],
            saidas: { 'Cientificação e remessa ao Conselho Superior': quando('Ajustamento firmado?', 'sim'), 'Instrução': quando('Ajustamento firmado?', 'nao') },
        },
        {
            nome: 'Prorrogação', unidade: 'Gabinete', vai: ['Instrução'],
            orientacao: 'Prorrogue por mais 1 ano, quantas vezes for preciso, por decisão fundamentada, dando ciência ao Conselho Superior (art. 9º).',
            acoes: [
                A.documento('Despacho de prorrogação fundamentada', 'Despacho', { forma: 'redigir' }),
                A.fazer('Dar ciência da prorrogação ao Conselho Superior', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Declínio de atribuição', unidade: 'Gabinete', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Revisão pelo Conselho Superior'],
            orientacao: 'Se a atribuição for de outro Ministério Público, submeta a decisão de declínio ao Conselho Superior em 3 dias (art. 9º-A).',
            acoes: [
                A.documento('Decisão de declínio de atribuição', 'Despacho', { forma: 'redigir' }),
                A.fazer('Submeter o declínio ao Conselho Superior', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Conclusão', unidade: 'Gabinete', vai: ['Ajuizamento de ação civil pública', 'Cientificação e remessa ao Conselho Superior'],
            ao_entrar: { pendencia: 'Concluir o inquérito civil: ajuizar a ação civil pública ou promover o arquivamento.' },
            orientacao: 'Esgotadas as diligências, ajuíze a ação civil pública ou promova fundamentadamente o arquivamento (art. 10).',
            acoes: [
                A.escolha('Conclusão', ['Ajuizar ação civil pública', 'Promover o arquivamento'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Promoção de arquivamento', 'Promoção de arquivamento', { forma: 'redigir', se: quando('Conclusão', 'Promover o arquivamento') }),
            ],
            saidas: { 'Ajuizamento de ação civil pública': quando('Conclusão', 'Ajuizar ação civil pública'), 'Cientificação e remessa ao Conselho Superior': quando('Conclusão', 'Promover o arquivamento') },
        },
        {
            nome: 'Ajuizamento de ação civil pública', unidade: 'Gabinete', vai: ['Arquivamento'],
            orientacao: 'Junte a petição inicial e registre o número da ação. O inquérito se encerra com o ajuizamento.',
            acoes: [
                A.documento('Juntar a petição inicial', 'Petição inicial', { forma: 'juntar' }),
                A.texto('Número da ação ajuizada', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Cientificação e remessa ao Conselho Superior', unidade: 'Secretaria', prazo_dias: 3, prazo_auto: true, prazo_contagem: corridos, vai: ['Revisão pelo Conselho Superior'],
            orientacao: 'Cientifique pessoalmente os interessados; não localizados, publique. Remeta os autos ao Conselho Superior em 3 dias, contados da comprovação da cientificação ou da publicação (art. 10, § 1º). No recurso contra indeferimento, notifique para contrarrazões (art. 5º).',
            acoes: [
                A.comunicar('Dar ciência aos interessados', { especie: 'ciencia', polos: ['requerente', 'requerido', 'interessado'], dias: 0, texto: 'Os autos serão remetidos ao Conselho Superior. Até a sessão, você pode apresentar razões escritas ou documentos.' }, { obrigatoria: true }),
                A.fazer('Publicar a cientificação de quem não foi localizado'),
                A.fazer('Remeter os autos ao Conselho Superior', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Revisão pelo Conselho Superior', unidade: 'Conselho Superior', vai: ['Arquivamento', 'Instrução', 'Designação de outro membro'], nome_publico: 'Revisão pelo colegiado',
            ao_entrar: { pendencia: 'Pautar e deliberar sobre a promoção, o declínio ou o recurso.' },
            orientacao: 'Até a sessão, colegitimados podem apresentar razões ou documentos (art. 10, § 3º). O colegiado homologa, converte em diligência ou delibera pelo prosseguimento, designando outro membro (art. 10, § 4º, e art. 11).',
            acoes: [
                A.audiencia('Pautar a sessão de revisão', 'sessao'),
                A.comunicar('Comunicar a pauta aos interessados', { especie: 'comunicacao', dias: 0, texto: 'O caso será apreciado na sessão de {audiencia}.' }),
                A.escolha('Deliberação', ['Homologa', 'Converte em diligência', 'Rejeita e designa outro membro'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do colegiado', 'Decisão', { forma: 'juntar' }),
            ],
            saidas: { 'Arquivamento': quando('Deliberação', 'Homologa'), 'Instrução': quando('Deliberação', 'Converte em diligência'), 'Designação de outro membro': quando('Deliberação', 'Rejeita e designa outro membro') },
        },
        {
            nome: 'Designação de outro membro', unidade: 'Secretaria', vai: ['Instauração', 'Instrução'],
            orientacao: 'Registre o membro designado pelo colegiado (art. 10, § 4º). Rejeitado o indeferimento, ele instaura o inquérito; rejeitado o arquivamento, prossegue na instrução.',
            acoes: [
                A.texto('Membro designado', { obrigatoria: true, destino: 'autos' }),
                A.simNao('O inquérito civil já foi instaurado?', { obrigatoria: true }),
            ],
            saidas: { 'Instrução': quando('O inquérito civil já foi instaurado?', 'sim'), 'Instauração': quando('O inquérito civil já foi instaurado?', 'nao') },
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Homologado o declínio, remeta antes os autos ao Ministério Público com atribuição. Prova nova ou fato novo relevante permite desarquivar em até 6 meses; depois, instaura-se novo inquérito (art. 12).' },
    ]);
}

export const modelos = [noticiaDeFato, procedimentoAdministrativoMp, procedimentoPreparatorio, inqueritoCivil];
