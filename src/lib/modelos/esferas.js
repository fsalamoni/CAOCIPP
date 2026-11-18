// Versões por esfera de governo dos ritos de sanção a fornecedor e de bens
// móveis inservíveis: Executivo do Estado do RS (Lei 11.389/1999 e CFIL/RS;
// Decretos 57.408/2023 e 58.685/2026) e administração federal (Decreto
// 12.785/2025). Gestão de contrato não tem versão própria: o RS não tem
// regulamento de gestor e fiscal, e os modelos gerais já seguem as normas
// federais. Ver ./dsl.js e docs/MODELOS_DE_RITO.md.
import { A, montar, quando } from './dsl.js';

const SITUACOES_CFIL = [
    'Especificação técnica não cumprida',
    'Atraso imotivado na execução ou na entrega',
    'Paralisação sem justa causa e sem aviso prévio',
    'Entrega de mercadoria falsificada, deteriorada ou inadequada',
    'Alteração de substância, qualidade ou quantidade',
    'Serviço de baixa qualidade',
    'Ato ilícito para frustrar a licitação',
    'Outra infração do art. 155 da Lei 14.133',
];

/** 56. Sanção a fornecedor no Executivo do RS (Lei 14.133/2021; Lei estadual 11.389/1999; Decreto 42.250/2003; IN CAGE 2/2003). */
export function sancaoFornecedorRs() {
    return montar({
        id: 'sancao-fornecedor-rs', nome: 'Sanção a fornecedor no Estado do RS: apuração e registro no CFIL/RS', area: 'sancionador', porte: 'longo', referencia: 'Estado do RS',
        descricao: 'Apura o descumprimento de contrato ou o ato ilícito em licitação nos órgãos, autarquias e fundações do Executivo do Rio Grande do Sul. Começa pelo parecer técnico de quem atesta a execução, enviado ao ordenador de despesa, como manda a lei do CFIL/RS. Daí em diante segue o procedimento da Lei 14.133: defesa em 15 dias úteis no rito simples, para advertência e multa, ou comissão de dois ou mais servidores estáveis, para impedimento e inidoneidade; análise jurídica; decisão do ordenador de despesa ou, na inidoneidade, do Secretário de Estado; recurso ou reconsideração com efeito suspensivo. No fim, a decisão sai no Diário Oficial do Estado, a sanção é cadastrada no CFIL/RS, pelo sistema FPE, a multa é cobrada e o registro é acompanhado até o saneamento e a baixa.',
        quando: 'Órgãos, autarquias e fundações do Executivo do RS, quando o fiscal ou o gestor aponta descumprimento de contrato ou a comissão de licitação registra ato ilícito de licitante. No Ministério Público do RS, use "Descumprimento contratual no MPRS". Fora do RS, use "Infração contratual e sanção a fornecedor".',
        base: 'Lei 14.133/2021, arts. 117, § 1º, 137, 155 a 163, 166 a 168 e 183; Lei estadual 11.389/1999 (com a Lei 14.657/2014), arts. 2º a 4º, 7º, 9º e 12; Decreto estadual 42.250/2003 (com os Decretos 45.680/2008 e 54.434/2018), arts. 2º, 3º, 7º a 11, 14 e 16; Instrução Normativa CAGE 2/2003, arts. 3º, 13 e 16; manual do módulo CFIL/RS do FPE, versão 2025.1; Decreto federal 11.129/2022, arts. 58 a 63 (CEIS); Lei estadual 15.612/2021 (processo administrativo, subsidiária). O Estado não editou regulamento próprio do processo de sanção da Lei 14.133: os prazos de defesa de 5 dias úteis e as suspensões de 3 a 6 meses da lei e do decreto do CFIL são do tempo da Lei 8.666 e cedem aos 15 dias úteis e às sanções dos arts. 156 a 158 da lei federal.',
        tipo: { polos: ['requerido'], nomes_polos: { requerido: 'Fornecedor' } },
    }, [
        {
            nome: 'Parecer técnico da fiscalização', unidade: 'Fiscalização do contrato', prazo_dias: 3,
            orientacao: 'Quem atesta o serviço, a obra ou a entrega emite parecer técnico fundamentado e o envia ao ordenador de despesa (Lei estadual 11.389/1999, art. 4º; Decreto 42.250/2003, art. 3º). A IN CAGE 2/2003 dá 3 dias, contados da constatação, e lista os quesitos mínimos no Anexo I (art. 3º). Na licitação, o ato ilícito é descrito em ata por membro da comissão ou pelo servidor encarregado (Decreto, art. 4º). Junte os registros de ocorrência do contrato (Lei 14.133, art. 117, § 1º).',
            acoes: [
                A.formulario('Dados da ocorrência', [
                    { id: 'fornecedor', rotulo: 'Fornecedor (razão social e CNPJ ou CPF)', tipo: 'texto', obrigatorio: true },
                    { id: 'contrato', rotulo: 'Contrato no FPE, empenho ou licitação', tipo: 'texto', obrigatorio: true },
                    { id: 'constatacao', rotulo: 'Data da constatação', tipo: 'data', obrigatorio: true },
                    { id: 'descricao', rotulo: 'O que foi descumprido', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'prejuizo', rotulo: 'Prejuízo estimado (R$)', tipo: 'numero' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.escolha('Situação apontada', SITUACOES_CFIL, { obrigatoria: true, ajuda: 'As seis primeiras são as do art. 2º do Decreto 42.250/2003.' }),
                A.documento('Juntar o parecer técnico ou a ata', 'Parecer', { forma: 'qualquer' }),
                A.documento('Juntar os registros de ocorrência do contrato', '', { forma: 'juntar', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Admissibilidade', unidade: 'Ordenador de despesa', vai: ['Defesa no rito simples', 'Instauração da comissão', 'Arquivamento'],
            orientacao: 'O ordenador de despesa, ciente do parecer, enquadra o fato nos incisos do art. 155 da Lei 14.133 e aponta a sanção cabível em tese (art. 156). Advertência e multa seguem o rito simples (art. 157). Impedimento e inidoneidade exigem comissão de dois ou mais servidores estáveis (art. 158). O decreto do CFIL manda notificar o fornecedor de imediato (art. 7º). A prescrição é de 5 anos da ciência da infração (art. 158, § 4º). Ato que também seja lesivo pela Lei 12.846 é apurado em conjunto, no rito dessa lei (art. 159).',
            acoes: [
                A.texto('Inciso do art. 155 em que o fato se enquadra', { obrigatoria: true, destino: 'informacao' }),
                A.escolha('Sanção cabível em tese', ['Advertência ou multa', 'Impedimento ou inidoneidade', 'Arquivar'], { obrigatoria: true }),
                A.documento('Juntar o despacho de admissibilidade', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: {
                'Defesa no rito simples': quando('Sanção cabível em tese', 'Advertência ou multa'),
                'Instauração da comissão': quando('Sanção cabível em tese', 'Impedimento ou inidoneidade'),
                Arquivamento: quando('Sanção cabível em tese', 'Arquivar'),
            },
        },
        {
            nome: 'Defesa no rito simples', unidade: 'Setor de contratos', avanco: 'auto', vai: ['Análise jurídica'], nome_publico: 'Defesa prévia',
            orientacao: 'Notifique o fornecedor com os fatos, o enquadramento e a sanção possível, para defesa em 15 dias úteis (Lei 14.133, art. 157). O decreto do CFIL fala em 5 dias úteis (art. 7º), prazo menor que o da lei federal: use os 15. O prazo começa no primeiro dia útil seguinte à ciência (art. 183). A defesa é recebida por protocolo e juntada.',
            acoes: [
                A.comunicar('Notificar para a defesa', { especie: 'notificacao', polos: ['requerido'], dias: 15, texto: 'Fica notificado dos fatos, do enquadramento e da sanção possível, descritos a seguir. Apresente defesa em 15 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa', 'Notificar para a defesa', { obrigatoria: true }),
                A.fazer('Certificar a falta de defesa', { se: quando('Aguardar a defesa', 'Sem manifestação') }),
            ],
        },
        {
            nome: 'Instauração da comissão', unidade: 'Ordenador de despesa',
            orientacao: 'O processo de responsabilização é instaurado por ato da autoridade, com comissão de dois ou mais servidores estáveis ou empregados do quadro permanente (Lei 14.133, art. 158, caput e § 1º). A instauração interrompe a prescrição (§ 4º, I).',
            acoes: [
                A.documento('Juntar o ato de instauração e de designação da comissão', 'Portaria', { forma: 'redigir' }),
                A.data('Data da instauração', { obrigatoria: true, destino: 'informacao' }),
            ],
        },
        {
            nome: 'Defesa perante a comissão', unidade: 'Comissão processante', avanco: 'auto', nome_publico: 'Defesa escrita',
            orientacao: 'A comissão intima o fornecedor para defesa escrita em 15 dias úteis, com a indicação das provas que pretende produzir (Lei 14.133, art. 158).',
            acoes: [
                A.comunicar('Intimar para a defesa escrita', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Fica intimado dos fatos, do enquadramento e da sanção possível. Apresente defesa em 15 dias úteis e indique as provas que pretende produzir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a defesa escrita', 'Intimar para a defesa escrita', { obrigatoria: true }),
                A.fazer('Certificar a falta de defesa', { se: quando('Aguardar a defesa escrita', 'Sem manifestação') }),
            ],
        },
        {
            nome: 'Instrução', unidade: 'Comissão processante', vai: ['Alegações finais', 'Relatório da comissão'],
            orientacao: 'A comissão indefere, com fundamento, a prova ilícita, impertinente, desnecessária, protelatória ou intempestiva (Lei 14.133, art. 158, § 3º). Havendo prova nova deferida ou juntada pela comissão, abrem-se alegações finais (§ 2º).',
            acoes: [
                A.escolha('Provas requeridas pela defesa', ['Deferidas', 'Deferidas em parte', 'Indeferidas', 'Não houve pedido'], { obrigatoria: true }),
                A.documento('Juntar a decisão sobre as provas', 'Despacho', { forma: 'redigir', se: quando('Provas requeridas pela defesa', 'Deferidas em parte', 'Indeferidas') }),
                A.documento('Juntar as provas produzidas', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.simNao('Houve prova nova deferida ou juntada pela comissão?', { obrigatoria: true }),
            ],
            saidas: { 'Alegações finais': quando('Houve prova nova deferida ou juntada pela comissão?', 'sim'), 'Relatório da comissão': quando('Houve prova nova deferida ou juntada pela comissão?', 'nao') },
        },
        {
            nome: 'Alegações finais', unidade: 'Comissão processante', avanco: 'auto',
            orientacao: 'O fornecedor é intimado para alegações finais em 15 dias úteis (Lei 14.133, art. 158, § 2º).',
            acoes: [
                A.comunicar('Intimar para alegações finais', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Encerrada a instrução com prova nova, apresente alegações finais em 15 dias úteis.' }, { obrigatoria: true }),
                A.esperar('Aguardar as alegações finais', 'Intimar para alegações finais', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Relatório da comissão', unidade: 'Comissão processante',
            orientacao: 'A comissão relata os fatos, as provas e a defesa e propõe a sanção ou o arquivamento, pelos critérios do art. 156, § 1º, da Lei 14.133.',
            acoes: [
                A.escolha('Proposta da comissão', ['Impedimento de licitar e contratar', 'Declaração de inidoneidade', 'Advertência ou multa', 'Arquivamento'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o relatório da comissão', 'Relatório', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Análise jurídica', unidade: 'Assessoria jurídica', avanco: 'auto',
            orientacao: 'A análise jurídica é obrigatória antes da declaração de inidoneidade (Lei 14.133, art. 156, § 6º) e da desconsideração da personalidade jurídica (art. 160). Nos outros casos é recomendada. No Executivo do RS, a consultoria jurídica é da Procuradoria-Geral do Estado.',
            acoes: [A.documento('Juntar o parecer jurídico', 'Parecer', { forma: 'redigir' })],
        },
        {
            nome: 'Decisão', unidade: 'Ordenador de despesa', ao_entrar: { pendencia: 'Decidir a sanção ao fornecedor: defesa, relatório e parecer jurídico estão nos autos.' }, vai: ['Recurso ou reconsideração', 'Publicação e CFIL/RS'],
            orientacao: 'Advertência, multa e impedimento são do ordenador de despesa; a declaração de inidoneidade é do Secretário de Estado (Decreto 42.250/2003, art. 10; Lei 14.133, art. 156, § 6º, I). Pese a natureza e a gravidade, as peculiaridades, agravantes e atenuantes, os danos e o programa de integridade (art. 156, § 1º). Multa de 0,5% a 30% do contrato (§ 3º). Impedimento por até 3 anos, com efeito em todo o Estado do RS (§ 4º). Inidoneidade de 3 a 6 anos, em todos os entes (§ 5º). Os prazos fixos de 3, 4 e 6 meses da lei do CFIL eram para a suspensão da Lei 8.666.',
            acoes: [
                A.escolha('Sanção aplicada', ['Advertência', 'Multa', 'Impedimento de licitar e contratar', 'Declaração de inidoneidade', 'Nenhuma, arquivar'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.escolha('Autoridade que decidiu', ['Ordenador de despesa', 'Secretário de Estado ou dirigente máximo'], { obrigatoria: true, ajuda: 'A inidoneidade é só do Secretário de Estado ou, em autarquia e fundação, da autoridade máxima.' }),
                A.formulario('Dosimetria', [
                    { id: 'gravidade', rotulo: 'Natureza, gravidade e peculiaridades', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'circunstancias', rotulo: 'Agravantes e atenuantes', tipo: 'texto_longo' },
                    { id: 'dano', rotulo: 'Dano ao Estado (R$)', tipo: 'numero' },
                    { id: 'multa', rotulo: 'Multa (R$)', tipo: 'numero' },
                    { id: 'meses', rotulo: 'Duração do impedimento ou da inidoneidade (meses)', tipo: 'numero' },
                ], { se: quando('Sanção aplicada', 'Advertência', 'Multa', 'Impedimento de licitar e contratar', 'Declaração de inidoneidade'), destino: 'informacao', folha_dados: true, ajuda: 'O CFIL/RS só aceita o prazo em meses inteiros.' }),
                A.documento('Juntar a decisão motivada', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão', { especie: 'intimacao', polos: ['requerido'], dias: 15, texto: 'Fica intimado da decisão. Cabe recurso em 15 dias úteis contra advertência, multa ou impedimento, e pedido de reconsideração em 15 dias úteis contra a inidoneidade, ambos com efeito suspensivo.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar da decisão', { obrigatoria: true }),
            ],
            saidas: {
                'Recurso ou reconsideração': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'),
                'Publicação e CFIL/RS': quando('Aguardar o prazo de recurso', 'Sem manifestação'),
            },
        },
        {
            nome: 'Recurso ou reconsideração', unidade: 'Ordenador de despesa', prazo_dias: 20, prazo_auto: true, vai: ['Autoridade superior', 'Publicação e CFIL/RS', 'Arquivamento'], padrao: 'Publicação e CFIL/RS',
            orientacao: 'Contra advertência, multa e impedimento cabe recurso: quem decidiu pode reconsiderar em 5 dias úteis; se mantiver, envia à autoridade superior, que decide em 20 dias úteis (Lei 14.133, art. 166). Contra a inidoneidade cabe só pedido de reconsideração, decidido em 20 dias úteis (art. 167). Os dois têm efeito suspensivo (art. 168): nada vai ao CFIL/RS antes da decisão final.',
            acoes: [
                A.escolha('Espécie', ['Recurso', 'Pedido de reconsideração da inidoneidade'], { obrigatoria: true }),
                A.escolha('Resultado', ['Sanção mantida: sobe à autoridade superior', 'Sanção mantida na reconsideração', 'Sanção reduzida', 'Sanção afastada'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão sobre o pedido', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado da decisão sobre o seu pedido.' }, { se: quando('Resultado', 'Sanção mantida na reconsideração', 'Sanção reduzida', 'Sanção afastada') }),
            ],
            saidas: { 'Autoridade superior': quando('Resultado', 'Sanção mantida: sobe à autoridade superior'), Arquivamento: quando('Resultado', 'Sanção afastada') },
        },
        {
            nome: 'Autoridade superior', unidade: 'Autoridade superior', prazo_dias: 20, prazo_auto: true, vai: ['Publicação e CFIL/RS', 'Arquivamento'], padrao: 'Publicação e CFIL/RS',
            orientacao: 'A autoridade superior decide o recurso em 20 dias úteis do recebimento (Lei 14.133, art. 166, parágrafo único).',
            acoes: [
                A.escolha('Julgamento do recurso', ['Provido', 'Provido em parte', 'Não provido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão do recurso', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão do recurso', { especie: 'intimacao', polos: ['requerido'], dias: 0, texto: 'Fica intimado da decisão do recurso.' }, { obrigatoria: true }),
            ],
            saidas: { Arquivamento: quando('Julgamento do recurso', 'Provido') },
        },
        {
            nome: 'Publicação e CFIL/RS', unidade: 'Setor de contratos', prazo_dias: 15, prazo_auto: true, vai: ['Cobrança da multa', 'Saneamento e baixa do registro', 'Arquivamento'],
            orientacao: 'O ato de impedimento ou de inidoneidade é publicado no Diário Oficial do Estado, como condição de eficácia (Decreto 42.250/2003, art. 10). Depois da publicação, o ordenador de despesa ou o operador indicado à CAGE cadastra a sanção no módulo CFIL/RS do sistema FPE (art. 9º, § 1º; IN CAGE 2/2003, art. 16): fundamento (inciso do art. 155 da Lei 14.133), processo, contrato ou empenho, descrição, data e página da publicação e, de preferência, a decisão em PDF. A lei federal dá 15 dias úteis da aplicação para informar os cadastros (art. 161). A CAGE leva os dados do CFIL/RS ao CEIS todo mês. Advertência e multa não entram no CFIL/RS. Deixar de cadastrar é falta funcional (Decreto, art. 16). Avalie a extinção do contrato (Lei 14.133, art. 137; o decreto, no art. 8º, § 1º, fala em rescisão imediata na suspensão).',
            acoes: [
                A.escolha('Sanção definitiva', ['Nenhuma: arquivar', 'Advertência', 'Multa', 'Impedimento, com ou sem multa', 'Inidoneidade, com ou sem multa'], { obrigatoria: true }),
                A.data('Publicação no Diário Oficial do Estado', { obrigatoria: true, se: quando('Sanção definitiva', 'Impedimento, com ou sem multa', 'Inidoneidade, com ou sem multa'), destino: 'informacao' }),
                A.fazer('Cadastrar a sanção no CFIL/RS, pelo sistema FPE', { obrigatoria: true, se: quando('Sanção definitiva', 'Impedimento, com ou sem multa', 'Inidoneidade, com ou sem multa') }),
                A.documento('Juntar o comprovante do cadastro no CFIL/RS', 'Comprovante', { forma: 'juntar', se: quando('Sanção definitiva', 'Impedimento, com ou sem multa', 'Inidoneidade, com ou sem multa') }),
                A.data('Fim do prazo da sanção', { se: quando('Sanção definitiva', 'Impedimento, com ou sem multa', 'Inidoneidade, com ou sem multa'), destino: 'informacao' }),
                A.fazer('Anotar a sanção no histórico do contrato'),
                A.simNao('Há multa ou dano a cobrar?', { obrigatoria: true }),
            ],
            saidas: {
                'Cobrança da multa': quando('Há multa ou dano a cobrar?', 'sim'),
                'Saneamento e baixa do registro': quando('Sanção definitiva', 'Impedimento, com ou sem multa', 'Inidoneidade, com ou sem multa'),
            },
            padrao: 'Arquivamento',
        },
        {
            nome: 'Cobrança da multa', unidade: 'Setor de contratos', vai: ['Saneamento e baixa do registro', 'Arquivamento'], padrao: 'Arquivamento',
            orientacao: 'A multa pode ser descontada dos pagamentos devidos e da garantia (Lei 14.133, art. 156, § 8º). Sem pagamento, o débito vai à inscrição no CADIN/RS e à Procuradoria-Geral do Estado, para a dívida ativa e a cobrança. A quitação da multa faz parte do saneamento que permite a baixa no CFIL/RS (Decreto 42.250/2003, art. 11, § 1º).',
            acoes: [
                A.comunicar('Notificar o fornecedor para pagar', { especie: 'notificacao', polos: ['requerido'], dias: 15, texto: 'Fica notificado a pagar a multa aplicada, no valor e na forma indicados. Sem o pagamento, o débito será inscrito no CADIN/RS e cobrado.' }, { obrigatoria: true, ajuda: 'Use o prazo do contrato; 15 dias úteis é só uma sugestão.' }),
                A.esperar('Aguardar o pagamento', 'Notificar o fornecedor para pagar', { obrigatoria: true }),
                A.escolha('Situação da multa', ['Paga', 'Descontada de pagamento ou da garantia', 'Não paga: CADIN/RS e dívida ativa'], { obrigatoria: true }),
                A.documento('Juntar o comprovante ou a remessa para cobrança', 'Comprovante', { forma: 'juntar' }),
                A.simNao('Há registro no CFIL/RS a acompanhar?', { obrigatoria: true }),
            ],
            saidas: { 'Saneamento e baixa do registro': quando('Há registro no CFIL/RS a acompanhar?', 'sim') },
        },
        {
            nome: 'Saneamento e baixa do registro', unidade: 'Setor de contratos', vai: ['Arquivamento'],
            orientacao: 'O saneamento integral é a correção da irregularidade, o ressarcimento dos prejuízos e a quitação da multa (Decreto 42.250/2003, art. 11, § 1º): marque "Sanear" no CFIL/RS, com a justificativa. O saneamento não inativa o registro. Registro com fundamento no art. 155 da Lei 14.133 tem baixa automática ao fim do prazo, saneado ou não; antes disso, só por inclusão indevida ou decisão judicial (manual do CFIL/RS, itens 5.2.2, 8 e 9). Fundamento antigo sem baixa automática pede baixa manual: não deixe o fornecedor impedido além do prazo. A reabilitação da Lei 14.133 exige reparação do dano, multa paga e prazo mínimo de 1 ano no impedimento e 3 anos na inidoneidade (art. 163).',
            acoes: [
                A.escolha('Saneamento', ['Saneado: irregularidade corrigida, prejuízo ressarcido e multa paga', 'Não saneado'], { obrigatoria: true }),
                A.fazer('Registrar o saneamento no CFIL/RS', { se: quando('Saneamento', 'Saneado: irregularidade corrigida, prejuízo ressarcido e multa paga') }),
                A.escolha('Baixa do registro', ['Automática ao fim do prazo', 'Manual: término do prazo', 'Inclusão indevida', 'Decisão judicial', 'Reabilitação'], { obrigatoria: true }),
                A.data('Data da baixa', { obrigatoria: true, destino: 'informacao' }),
                A.fazer('Conferir que o registro saiu do CFIL/RS e do CEIS', { obrigatoria: true }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Setor de contratos', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

const CLASSES_RS = ['Obsoleto', 'Ocioso ou em desuso', 'Antieconômico', 'Irrecuperável'];

/** 57. Bens móveis inservíveis no Executivo do RS (Decretos 57.408/2023, 58.685/2026 e 57.916/2024). */
export function bensInserviveisRs() {
    return montar({
        id: 'bens-inserviveis-rs', nome: 'Bens móveis inservíveis no Estado do RS: avaliação, destinação e baixa', area: 'gestao', porte: 'medio', referencia: 'Estado do RS',
        descricao: 'O caminho do bem móvel que não serve mais ao órgão, nos órgãos, autarquias e fundações do Executivo do Rio Grande do Sul. Primeiro o bem é oferecido a outro órgão estadual, por transferência patrimonial, que dispensa parecer da comissão e baixa. Sem interessado, a Comissão Especial de Avaliação de Inservíveis faz o relatório e classifica o bem (obsoleto, ocioso, antieconômico ou irrecuperável) e o ordenador de despesa decide a baixa e o destino: Programa Sustentare, para o eletroeletrônico; leilão pela Central de Licitações; doação; ou eliminação, com ata. A baixa no sistema de patrimônio do Estado sai junto com a alienação ou a doação.',
        quando: 'Órgãos, autarquias e fundações do Executivo do RS, para mobiliário, equipamentos e eletroeletrônicos sem uso. Não vale para veículos. Abra um processo por lote. No Ministério Público do RS, use "Bens móveis no MPRS"; na administração federal, "Bens móveis inservíveis na administração federal".',
        base: 'Decreto estadual 57.408/2023, arts. 1º a 7º, com o § 3º do art. 3º incluído pelo Decreto 58.684/2026; Decreto estadual 58.685/2026 (Programa Sustentare), arts. 1º, 2º, 6º e 8º; Decreto estadual 57.916/2024 (leilão de bens móveis inservíveis: texto não lido, conferir antes de usar); Lei 14.133/2021, arts. 6º, XL, 31 e 76, II; Lei 12.305/2010 (resíduos); Lei 4.320/1964, arts. 94 a 96.',
    }, [
        {
            nome: 'Levantamento dos bens', unidade: 'Setor de patrimônio', vai: ['Oferta a outros órgãos', 'Arquivamento'],
            orientacao: 'Relacione os bens sem uso, com o número de patrimônio, o estado e o valor registrado no sistema de Administração do Patrimônio do Estado (APE). O Decreto 57.408/2023 não vale para veículos (art. 1º): eles seguem regra própria e saem deste processo.',
            acoes: [
                A.formulario('Relação dos bens', [
                    { id: 'descricao', rotulo: 'Descrição do lote', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'quantidade', rotulo: 'Quantidade de itens', tipo: 'numero', obrigatorio: true },
                    { id: 'patrimonio', rotulo: 'Números de patrimônio', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor registrado no APE (R$)', tipo: 'numero' },
                    { id: 'local', rotulo: 'Onde os bens estão', tipo: 'texto', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.escolha('Tipo de bem', ['Mobiliário, equipamento ou outro', 'Eletroeletrônico', 'Veículo'], { obrigatoria: true, ajuda: 'Eletroeletrônico: funciona com fonte elétrica, energia alternativa ou bateria, com os componentes e acessórios.' }),
                A.documento('Juntar a relação com fotos ou laudo', 'Relatório', { forma: 'qualquer', nivel: 'recomendado' }),
            ],
            saidas: { Arquivamento: quando('Tipo de bem', 'Veículo') },
            padrao: 'Oferta a outros órgãos',
        },
        {
            nome: 'Oferta a outros órgãos', unidade: 'Setor de patrimônio', vai: ['Transferência patrimonial', 'Avaliação pela comissão'],
            orientacao: 'O inservível vai, de preferência, por transferência patrimonial, a outro órgão ou entidade da administração estadual direta. Nesse caso não é preciso ouvir a comissão nem dar baixa (Decreto 57.408/2023, art. 4º). O eletroeletrônico também pode ser transferido direto, com aviso à PROCERGS (art. 3º, § 3º; Decreto 58.685/2026, art. 8º, § 2º).',
            acoes: [
                A.fazer('Divulgar a relação aos demais órgãos do Estado', { obrigatoria: true }),
                A.simNao('Algum órgão estadual quer receber os bens?', { obrigatoria: true }),
                A.texto('Órgão interessado', { se: quando('Algum órgão estadual quer receber os bens?', 'sim') }),
            ],
            saidas: { 'Transferência patrimonial': quando('Algum órgão estadual quer receber os bens?', 'sim'), 'Avaliação pela comissão': quando('Algum órgão estadual quer receber os bens?', 'nao') },
        },
        {
            nome: 'Transferência patrimonial', unidade: 'Ordenador de despesa', vai: ['Arquivamento'],
            orientacao: 'A transferência ocorre depois da deliberação do ordenador de despesa, com os registros no APE e a assinatura do termo, pelas diretrizes da Secretaria de Planejamento, Governança e Gestão (Decreto 57.408/2023, art. 4º). Não há baixa: o bem segue no patrimônio do Estado, com o mesmo número.',
            acoes: [
                A.escolha('Deliberação do ordenador de despesa', ['Autorizada', 'Não autorizada'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o termo de transferência assinado', 'Termo', { forma: 'juntar', se: quando('Deliberação do ordenador de despesa', 'Autorizada') }),
                A.fazer('Registrar a transferência no APE', { obrigatoria: true, se: quando('Deliberação do ordenador de despesa', 'Autorizada') }),
                A.fazer('Avisar a PROCERGS, se for eletroeletrônico', { se: quando('Deliberação do ordenador de despesa', 'Autorizada') }),
            ],
        },
        {
            nome: 'Avaliação pela comissão', unidade: 'Comissão Especial de Avaliação de Inservíveis',
            orientacao: 'A comissão, de três membros ou mais, avalia a situação e a utilidade dos bens e faz o relatório, com a justificativa e a classificação (Decreto 57.408/2023, arts. 2º e 3º, I). Sem comissão, o ordenador de despesa pratica esses atos (art. 2º, parágrafo único). Obsoleto: funciona, mas não atende às exigências técnicas. Ocioso ou em desuso: funciona, mas o órgão não aproveita. Antieconômico: manutenção onerosa demais ou rendimento precário. Irrecuperável: perdeu as características ou não compensa recuperar (art. 1º, § 2º). Para o leilão, faça a avaliação prévia; na doação a autarquia ou fundação estadual, vale o valor de aquisição menos a depreciação do APE (art. 6º, § 3º).',
            acoes: [
                A.escolha('Classificação', CLASSES_RS, { obrigatoria: true, destino: 'informacao' }),
                A.numero('Valor de avaliação (R$)', { obrigatoria: true, destino: 'informacao' }),
                A.escolha('Destinação proposta', ['Programa Sustentare', 'Alienação por leilão', 'Doação', 'Eliminação'], { obrigatoria: true, ajuda: 'Eletroeletrônico vai pelo Sustentare. Doação: interesse social, custo de vender maior que o valor, risco de perecer ou bem tóxico.' }),
                A.documento('Juntar o relatório da comissão', 'Relatório', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Deliberação do ordenador', unidade: 'Ordenador de despesa', vai: ['Programa Sustentare', 'Alienação por leilão', 'Doação', 'Eliminação', 'Avaliação pela comissão'],
            orientacao: 'O ordenador de despesa delibera pela baixa e pela destinação (Decreto 57.408/2023, art. 3º, II). Eletroeletrônico vai pelo Programa Sustentare, que escolhe a melhor trilha (§ 3º). O que o Estado não reaproveita é alienado por licitação (art. 5º). A doação cabe com fins e uso de interesse social comprovados, quando o custo de vender supera o valor provável, com risco de perecimento ou em bem tóxico, corrosivo, contaminado ou poluente (art. 6º). Sem quem receba, avalia-se a eliminação (art. 7º).',
            acoes: [
                A.escolha('Destinação decidida', ['Programa Sustentare', 'Alienação por leilão', 'Doação', 'Eliminação', 'Devolver à comissão'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a deliberação', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: {
                'Programa Sustentare': quando('Destinação decidida', 'Programa Sustentare'),
                'Alienação por leilão': quando('Destinação decidida', 'Alienação por leilão'),
                Doação: quando('Destinação decidida', 'Doação'),
                Eliminação: quando('Destinação decidida', 'Eliminação'),
                'Avaliação pela comissão': quando('Destinação decidida', 'Devolver à comissão'),
            },
        },
        {
            nome: 'Programa Sustentare', unidade: 'Setor de patrimônio', vai: ['Baixa no patrimônio'],
            orientacao: 'A Unidade Administrativa Responsável do órgão disponibiliza os bens à PROCERGS pelo sistema do programa, com tipo, quantidade e localização; guarda-os em depósito próprio até a destinação; e entrega quando o destino é definido, combinando a logística (Decreto 58.685/2026, art. 6º). As trilhas são doação, recondicionamento e descaracterização com reciclagem (art. 8º). O decreto não fixa prazos nem fala da remoção de dados: apague os dados dos equipamentos antes de entregar, por cautela e pela Lei 13.709/2018.',
            acoes: [
                A.fazer('Remover os dados dos equipamentos', { obrigatoria: true }),
                A.data('Disponibilização à PROCERGS no sistema', { obrigatoria: true, destino: 'informacao' }),
                A.escolha('Trilha definida pelo programa', ['Doação', 'Recondicionamento', 'Descaracterização e reciclagem'], { obrigatoria: true, destino: 'autos' }),
                A.texto('Quem recebeu os bens', { obrigatoria: true }),
                A.documento('Juntar o comprovante de entrega', 'Comprovante', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Alienação por leilão', unidade: 'Setor de patrimônio', vai: ['Baixa no patrimônio', 'Doação'],
            orientacao: 'O órgão envia o processo eletrônico à Subsecretaria da Administração Central de Licitações, com a relação dos bens a leiloar e a avaliação prévia (Decreto 57.408/2023, art. 5º, parágrafo único). O leilão segue os arts. 6º, XL, 31 e 76, II, da Lei 14.133 e o Decreto estadual 57.916/2024, cujo texto não foi lido para este modelo: confira nele o edital, os prazos e o pagamento.',
            acoes: [
                A.data('Remessa à Central de Licitações', { obrigatoria: true }),
                A.escolha('Resultado do leilão', ['Arrematado', 'Deserto ou fracassado'], { obrigatoria: true, destino: 'autos' }),
                A.numero('Valor arrecadado (R$)', { se: quando('Resultado do leilão', 'Arrematado'), destino: 'informacao' }),
                A.documento('Juntar a ata do leilão', 'Ata', { forma: 'juntar' }),
            ],
            saidas: { 'Baixa no patrimônio': quando('Resultado do leilão', 'Arrematado'), Doação: quando('Resultado do leilão', 'Deserto ou fracassado') },
        },
        {
            nome: 'Doação', unidade: 'Ordenador de despesa', vai: ['Baixa no patrimônio', 'Eliminação'],
            orientacao: 'A doação é autorizada pelo ordenador de despesa, em processo eletrônico (Decreto 57.408/2023, art. 6º, § 1º). Os destinatários preferenciais são as autarquias e fundações estaduais, caso em que a avaliação da comissão é dispensada (§ 2º). Para entidade de fora, comprove os fins e o uso de interesse social (art. 6º, I; Lei 14.133, art. 76, II, "a"). Sem interessado em receber, avalie a eliminação (art. 7º).',
            acoes: [
                A.escolha('Motivo da doação', ['Fins e uso de interesse social', 'Custo de vender maior que o valor provável', 'Risco de perecimento iminente', 'Bem tóxico, corrosivo, contaminado ou poluente'], { obrigatoria: true }),
                A.escolha('Resultado', ['Doado a autarquia ou fundação estadual', 'Doado a outra entidade', 'Não houve interessado'], { obrigatoria: true, destino: 'autos' }),
                A.texto('Donatário', { se: quando('Resultado', 'Doado a autarquia ou fundação estadual', 'Doado a outra entidade') }),
                A.documento('Juntar a autorização e o termo de doação', 'Termo de doação', { forma: 'juntar', se: quando('Resultado', 'Doado a autarquia ou fundação estadual', 'Doado a outra entidade') }),
            ],
            saidas: { Eliminação: quando('Resultado', 'Não houve interessado') },
            padrao: 'Baixa no patrimônio',
        },
        {
            nome: 'Eliminação', unidade: 'Comissão Especial de Avaliação de Inservíveis', vai: ['Baixa no patrimônio'],
            orientacao: 'Escolha o método ambientalmente adequado: reciclagem, maceração, incineração, trituração ou recolhimento pela limpeza urbana. Relacione os bens na presença dos membros da comissão e lavre a ata, que o ordenador de despesa homologa; os documentos vão ao processo de baixa (Decreto 57.408/2023, art. 7º).',
            acoes: [
                A.escolha('Método de eliminação', ['Reciclagem', 'Maceração', 'Incineração', 'Trituração', 'Recolhimento pela limpeza urbana'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a relação dos bens eliminados e a ata', 'Ata', { forma: 'redigir' }),
                A.escolha('Homologação do ordenador de despesa', ['Homologada', 'Devolvida para ajuste'], { obrigatoria: true }),
                A.data('Data da eliminação', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Baixa no patrimônio', unidade: 'Setor de patrimônio', avanco: 'auto', vai: ['Arquivamento'],
            orientacao: 'A baixa no APE, na alienação e na doação, é feita junto com o ato de destinação (Decreto 57.408/2023, art. 3º, § 2º). Baixe também a responsabilidade de quem tinha a guarda e leve o fato ao inventário anual (Lei 4.320/1964, arts. 94 a 96).',
            acoes: [
                A.fazer('Dar a baixa no APE', { obrigatoria: true }),
                A.data('Data da baixa', { obrigatoria: true, destino: 'informacao' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Setor de patrimônio', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Veículo não segue este rito.' },
    ]);
}

const CLASSES_FED = ['Ocioso', 'Recuperável', 'Antieconômico', 'Irrecuperável'];
const DESTINOS_FED = ['Transferência interna', 'Transferência externa ou cessão', 'Computadores para Inclusão', 'Doação', 'Permuta', 'Leilão', 'Resíduo ou rejeito'];

/** 58. Bens móveis inservíveis na administração federal (Decreto 12.785/2025). */
export function bensInserviveisFederal() {
    return montar({
        id: 'bens-inserviveis-federal', nome: 'Bens móveis inservíveis na administração federal: circularidade e desfazimento', area: 'gestao', porte: 'medio', referencia: 'Governo federal',
        descricao: 'O caminho do bem móvel que não serve mais ao órgão, na administração federal direta, nas autarquias e nas fundações, pelo decreto de circularidade de 2025. A comissão de avaliação enquadra o bem como ocioso, recuperável, antieconômico ou irrecuperável. A autoridade escolhe o destino, na ordem que o decreto sugere: transferência dentro do órgão, transferência ou cessão a outro órgão, doação para uso de interesse social, permuta, leilão do que ninguém quis e, por último, tratamento como resíduo. Informática e eletroeletrônicos passam antes pelo Programa Computadores para Inclusão. Cessão, transferência, doação e permuta são divulgadas no sistema do governo federal.',
        quando: 'Órgãos, autarquias e fundações federais, para bens móveis sem uso. Não vale para os Comandos da Marinha, do Exército e da Aeronáutica nem para bens com legislação própria. Abra um processo por lote. No Executivo do RS, use "Bens móveis inservíveis no Estado do RS"; no Ministério Público do RS, "Bens móveis no MPRS".',
        base: 'Decreto 12.785/2025 (que revogou os Decretos 9.373/2018 e 10.340/2020), arts. 2º a 21; Lei 14.133/2021, arts. 6º, XL, 7º, 31 e 76, II; Lei 14.479/2022 (Política Nacional de Desfazimento e Recondicionamento de Equipamentos Eletroeletrônicos); Lei 12.305/2010, art. 38 (resíduos); Código Civil, art. 533 (permuta); Lei 4.320/1964, arts. 94 a 96. O decreto não trata da baixa nem fixa prazo de divulgação: valem as normas complementares da Secretaria de Gestão e Inovação (art. 22) e o sistema patrimonial do órgão.',
    }, [
        {
            nome: 'Levantamento dos bens', unidade: 'Setor de patrimônio',
            orientacao: 'Relacione os bens sem uso, com o número de patrimônio, o estado e o valor contábil. O decreto não se aplica aos Comandos militares nem a bens com legislação ou regulamentação específica (Decreto 12.785/2025, art. 2º).',
            acoes: [
                A.formulario('Relação dos bens', [
                    { id: 'descricao', rotulo: 'Descrição do lote', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'quantidade', rotulo: 'Quantidade de itens', tipo: 'numero', obrigatorio: true },
                    { id: 'patrimonio', rotulo: 'Números de patrimônio', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor contábil (R$)', tipo: 'numero' },
                    { id: 'local', rotulo: 'Onde os bens estão', tipo: 'texto', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.simNao('É equipamento de informática ou eletroeletrônico?', { obrigatoria: true }),
                A.documento('Juntar a relação com fotos ou laudo', 'Relatório', { forma: 'qualquer', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Classificação pela comissão', unidade: 'Comissão de avaliação de bens',
            orientacao: 'A comissão, permanente ou especial, de três membros ou mais, enquadra o bem (Decreto 12.785/2025, arts. 3º, § 2º, e 19). Ocioso: em condições de uso, mas não aproveitado. Recuperável: sem condições de uso, e recuperar custa até 50% do valor de mercado ou o custo-benefício justifica. Antieconômico: em uso, mas custa mais do que vale ou rende, por depreciação, ineficiência energética ou obsolescência. Irrecuperável: não serve ao fim, e recuperar custa mais de 50% do valor de mercado ou não se justifica (art. 3º). Bem de valor histórico, artístico ou cultural pode fugir a esses critérios (§ 3º).',
            acoes: [
                A.escolha('Classificação', CLASSES_FED, { obrigatoria: true, destino: 'informacao' }),
                A.formulario('Valores da avaliação', [
                    { id: 'mercado', rotulo: 'Valor de mercado (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'recuperacao', rotulo: 'Custo de recuperação (R$)', tipo: 'numero' },
                    { id: 'analise', rotulo: 'Análise de custo-benefício', tipo: 'texto_longo' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o relatório da comissão', 'Relatório', { forma: 'redigir' }),
            ],
        },
        {
            nome: 'Escolha da destinação', unidade: 'Autoridade competente', vai: ['Transferência ou cessão', 'Computadores para Inclusão', 'Doação', 'Permuta', 'Leilão', 'Destinação como resíduo'],
            orientacao: 'A transferência interna tem preferência (Decreto 12.785/2025, art. 7º, parágrafo único). Cessão, transferência e permuta são para ociosos e recuperáveis (arts. 4º, 6º e 15). Informática e eletroeletrônicos devem ser doados pelo Programa Computadores para Inclusão (art. 12). A doação exige fins e uso de interesse social e avaliação de oportunidade e conveniência diante das outras formas (art. 10). O leilão é para o que não foi cedido nem transferido por falta de interessado (art. 9º). Antieconômico e irrecuperável sem alienação viável são tratados como resíduo (art. 17).',
            acoes: [
                A.escolha('Destinação decidida', DESTINOS_FED, { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar a decisão motivada', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: {
                'Transferência ou cessão': quando('Destinação decidida', 'Transferência interna', 'Transferência externa ou cessão'),
                'Computadores para Inclusão': quando('Destinação decidida', 'Computadores para Inclusão'),
                Doação: quando('Destinação decidida', 'Doação'),
                Permuta: quando('Destinação decidida', 'Permuta'),
                Leilão: quando('Destinação decidida', 'Leilão'),
                'Destinação como resíduo': quando('Destinação decidida', 'Resíduo ou rejeito'),
            },
        },
        {
            nome: 'Transferência ou cessão', unidade: 'Setor de patrimônio', vai: ['Baixa e registro', 'Escolha da destinação'],
            orientacao: 'A transferência é definitiva e passa a posse e a propriedade; pode ser interna, no mesmo órgão, ou externa, entre órgãos da União (Decreto 12.785/2025, arts. 6º e 7º). A cessão é precária e por prazo certo, só de posse e guarda, entre órgãos federais ou com Estados, Distrito Federal, Municípios e estatais prestadoras de serviço público; por exceção autorizada, a organizações da sociedade civil, cooperativas de catadores, fundações e empreendimentos de economia solidária (arts. 4º e 5º). Divulgue os bens no sistema da Secretaria de Gestão e Inovação (art. 20). A logística é de quem recebe, salvo decisão fundamentada (art. 21).',
            acoes: [
                A.data('Divulgação no sistema do governo federal', { obrigatoria: true }),
                A.escolha('Resultado', ['Transferido dentro do órgão', 'Transferido a outro órgão da União', 'Cedido por prazo determinado', 'Não houve interessado'], { obrigatoria: true, destino: 'autos' }),
                A.texto('Quem recebeu', { se: quando('Resultado', 'Transferido dentro do órgão', 'Transferido a outro órgão da União', 'Cedido por prazo determinado') }),
                A.data('Fim do prazo da cessão', { se: quando('Resultado', 'Cedido por prazo determinado') }),
                A.documento('Juntar o termo de transferência ou de cessão', 'Termo', { forma: 'juntar', se: quando('Resultado', 'Transferido dentro do órgão', 'Transferido a outro órgão da União', 'Cedido por prazo determinado') }),
            ],
            saidas: { 'Escolha da destinação': quando('Resultado', 'Não houve interessado') },
            padrao: 'Baixa e registro',
        },
        {
            nome: 'Computadores para Inclusão', unidade: 'Setor de patrimônio', prazo_dias: 30, prazo_auto: true, prazo_contagem: 'corridos', vai: ['Baixa e registro', 'Escolha da destinação'],
            orientacao: 'Microcomputadores, monitores, impressoras, outros equipamentos de informática, eletroeletrônicos, peças e componentes devem ser doados às entidades indicadas pelo órgão gestor do Programa Computadores para Inclusão (Decreto 12.785/2025, art. 12, § 1º; Lei 14.479/2022). Se o gestor não se manifestar em trinta dias, os bens podem seguir para a doação comum ou para outra forma de alienação (§ 2º). Apague os dados antes de entregar (Lei 13.709/2018).',
            acoes: [
                A.data('Consulta ao gestor do programa', { obrigatoria: true }),
                A.fazer('Remover os dados dos equipamentos', { obrigatoria: true }),
                A.escolha('Resposta do gestor do programa', ['Indicou a entidade', 'Não se manifestou em 30 dias'], { obrigatoria: true }),
                A.texto('Entidade indicada', { se: quando('Resposta do gestor do programa', 'Indicou a entidade') }),
                A.documento('Juntar o termo de doação', 'Termo de doação', { forma: 'juntar', se: quando('Resposta do gestor do programa', 'Indicou a entidade') }),
            ],
            saidas: { 'Escolha da destinação': quando('Resposta do gestor do programa', 'Não se manifestou em 30 dias') },
            padrao: 'Baixa e registro',
        },
        {
            nome: 'Doação', unidade: 'Autoridade competente', vai: ['Baixa e registro', 'Escolha da destinação'],
            orientacao: 'A doação dispensa licitação e só cabe para fins e uso de interesse social, depois de avaliada a oportunidade e a conveniência socioeconômica diante das outras formas (Decreto 12.785/2025, art. 10; Lei 14.133, art. 76, II, "a"). Podem receber: Estados, Distrito Federal, Municípios e suas autarquias e fundações; organizações da sociedade civil, organizações sociais e OSCIP; cooperativas de catadores cadastradas no Sinir; fundações; e empreendimentos de economia solidária (art. 11). Pese os interessados, o potencial de atendimento, a logística e a preferência às cooperativas de catadores no bem antieconômico ou irrecuperável (art. 13). Divulgue no sistema (art. 20).',
            acoes: [
                A.data('Divulgação no sistema do governo federal', { obrigatoria: true }),
                A.escolha('Donatário', ['Estado, Distrito Federal ou Município', 'Organização da sociedade civil, OS ou OSCIP', 'Cooperativa de catadores', 'Fundação', 'Empreendimento de economia solidária', 'Não houve interessado'], { obrigatoria: true, destino: 'autos' }),
                A.texto('Nome do donatário', { se: quando('Donatário', 'Estado, Distrito Federal ou Município', 'Organização da sociedade civil, OS ou OSCIP', 'Cooperativa de catadores', 'Fundação', 'Empreendimento de economia solidária') }),
                A.documento('Juntar a avaliação de oportunidade e conveniência', 'Parecer', { forma: 'redigir' }),
                A.documento('Juntar o termo de doação', 'Termo de doação', { forma: 'juntar', se: quando('Donatário', 'Estado, Distrito Federal ou Município', 'Organização da sociedade civil, OS ou OSCIP', 'Cooperativa de catadores', 'Fundação', 'Empreendimento de economia solidária') }),
            ],
            saidas: { 'Escolha da destinação': quando('Donatário', 'Não houve interessado') },
            padrao: 'Baixa e registro',
        },
        {
            nome: 'Permuta', unidade: 'Autoridade competente', vai: ['Baixa e registro'],
            orientacao: 'A permuta de ociosos ou recuperáveis dispensa licitação (Decreto 12.785/2025, art. 15; Lei 14.133, art. 76, II, "b"; Código Civil, art. 533) e só se faz com órgãos e entidades públicos e com estatais prestadoras de serviço público (art. 16). Bem em uso regular só entra se a vantagem for demonstrada (art. 15, parágrafo único). Divulgue no sistema (art. 20).',
            acoes: [
                A.data('Divulgação no sistema do governo federal', { obrigatoria: true }),
                A.texto('Com quem foi feita a permuta', { obrigatoria: true }),
                A.documento('Juntar o termo de permuta, com os valores dos bens', 'Termo', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Leilão', unidade: 'Setor de licitações', vai: ['Baixa e registro', 'Escolha da destinação'],
            orientacao: 'O inservível que não foi cedido nem transferido, por falta de interessado, pode ser vendido em leilão (Decreto 12.785/2025, art. 9º), pela Lei 14.133: avaliação prévia, edital e leiloeiro oficial ou servidor designado (arts. 6º, XL, 31 e 76, II).',
            acoes: [
                A.numero('Valor mínimo de arrematação (R$)', { obrigatoria: true, destino: 'informacao' }),
                A.escolha('Resultado do leilão', ['Arrematado', 'Deserto ou fracassado'], { obrigatoria: true, destino: 'autos' }),
                A.numero('Valor arrecadado (R$)', { se: quando('Resultado do leilão', 'Arrematado'), destino: 'informacao' }),
                A.documento('Juntar o edital e a ata do leilão', 'Ata', { forma: 'juntar' }),
            ],
            saidas: { 'Escolha da destinação': quando('Resultado do leilão', 'Deserto ou fracassado') },
            padrao: 'Baixa e registro',
        },
        {
            nome: 'Destinação como resíduo', unidade: 'Setor de patrimônio', vai: ['Baixa e registro'],
            orientacao: 'O antieconômico ou irrecuperável cuja alienação se mostrou impossível ou inviável é equiparado a resíduo sólido ou a rejeito (Decreto 12.785/2025, art. 17). A destinação e a disposição final seguem o plano de gerenciamento de resíduos sólidos do órgão; resíduo perigoso só vai a pessoa jurídica inscrita no Cadastro Nacional de Operadores de Resíduos Perigosos (art. 18; Lei 12.305/2010, art. 38).',
            acoes: [
                A.textoLongo('Por que a alienação é impossível ou inviável', { obrigatoria: true, destino: 'autos' }),
                A.simNao('Há resíduo perigoso?', { obrigatoria: true }),
                A.texto('Operador de resíduos e número no cadastro nacional', { obrigatoria: true, se: quando('Há resíduo perigoso?', 'sim') }),
                A.documento('Juntar o comprovante da destinação ambientalmente adequada', 'Comprovante', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Baixa e registro', unidade: 'Setor de patrimônio', avanco: 'auto', vai: ['Arquivamento'],
            orientacao: 'O decreto não trata da baixa: registre a saída no sistema patrimonial do órgão e na contabilidade, baixe a responsabilidade de quem tinha a guarda e leve o fato ao inventário anual (Lei 4.320/1964, arts. 94 a 96). Na cessão, o bem continua no patrimônio: anote o cessionário e o prazo, sem baixa.',
            acoes: [
                A.escolha('Registro feito', ['Baixa definitiva', 'Cessão anotada, sem baixa', 'Transferência interna: troca de responsável'], { obrigatoria: true }),
                A.data('Data do registro', { obrigatoria: true, destino: 'informacao' }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Setor de patrimônio', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

export const modelos = [sancaoFornecedorRs, bensInserviveisRs, bensInserviveisFederal];
