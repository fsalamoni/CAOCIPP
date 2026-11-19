// Gestão do patrimônio do órgão (bens móveis e imóveis de uso, não patrimônio
// histórico): entrada, tombamento, carga, uso, inventário, movimentação,
// manutenção, reavaliação, cessão, apuração de extravio ou dano, classificação
// de inservível, reaproveitamento, alienação e baixa. Ver ./dsl.js e as fontes
// em docs/MODELOS_DE_RITO.md.
import { A, montar, quando } from './dsl.js';

const EVENTOS = ['Inventário', 'Movimentação ou transferência', 'Manutenção', 'Reavaliação ou ajuste de valor', 'Cessão ou empréstimo', 'Extravio, dano ou furto', 'Bem sem uso ou com defeito'];

/** 50. Gestão de bens patrimoniais, do tombamento à baixa (Lei 4.320/1964; NBC TSP 07; Lei 14.133/2021, art. 76). */
export function gestaoPatrimonio() {
    return montar({
        id: 'gestao-patrimonio', nome: 'Gestão de bens patrimoniais: do tombamento à baixa', area: 'gestao', porte: 'longo', referencia: 'Lei 4.320',
        descricao: 'Acompanha a vida de um bem do órgão (ou de um lote de bens iguais) do ingresso à baixa. Na entrada, o bem é conferido com a nota ou o termo e classificado como permanente ou de consumo; o permanente é tombado (número de patrimônio e plaqueta), registrado no sistema patrimonial e na contabilidade, com vida útil e valor residual, e entregue a um responsável por termo de responsabilidade. Em uso, o processo fica na fase "Bem em uso" e dela saem os eventos: inventário anual, transferência ou troca de responsável, manutenção, reavaliação e depreciação, cessão ou empréstimo, extravio, dano ou furto, e bem sem uso ou com defeito. O extravio ou dano é apurado (termo circunstanciado para pequeno valor sem dolo, com ressarcimento, ou processo disciplinar derivado). O bem inservível é classificado por comissão como ocioso, recuperável, antieconômico ou irrecuperável e segue para reaproveitamento, alienação (leilão, doação de interesse social, permuta) ou descarte ambientalmente adequado. Tudo termina na baixa patrimonial e contábil.',
        quando: 'No Ministério Público do RS, prefira o modelo "Bens móveis no MPRS", pelo Provimento 55/2022-PGJ. Só para dar destino ao que não serve mais, há modelos por esfera: "Bens móveis inservíveis na administração federal" e "Bens móveis inservíveis no Estado do RS". Bens permanentes de uso do órgão: mobiliário, equipamentos, veículos, informática, imóveis, softwares e outros intangíveis. Não é para patrimônio histórico ou cultural tombado. Abra um processo por bem ou por lote do mesmo ingresso. Gere um painel com "Integração com o painel" para ter o quadro e a planilha dos bens.',
        base: 'Lei 4.320/1964, arts. 15, § 2º, 94 a 96 e 106; Lei 14.133/2021, arts. 76 e 140; NBC TSP 07 (Ativo imobilizado) e NBC TSP 09 (Redução ao valor recuperável); MCASP, Parte II; Portaria STN 448/2002 (permanente e consumo); Lei 12.305/2010 (resíduos); na União, Decreto 12.785/2025 (circularidade e desfazimento de bens móveis, que substituiu o Decreto 9.373/2018) e IN CGU 4/2009 (termo circunstanciado administrativo).',
    }, [
        {
            nome: 'Entrada e conferência', unidade: 'Almoxarifado', vai: ['Tombamento e registro', 'Arquivamento'],
            orientacao: 'Confira o bem com a nota fiscal, o termo de doação ou de transferência e o contrato (recebimento provisório e definitivo, Lei 14.133, art. 140). Classifique: é permanente o que, em uso normal, dura mais de 2 anos e não perde a identidade; é consumo o que é frágil, perecível, se incorpora a outro bem ou se transforma no uso (Portaria STN 448/2002). Material de consumo fica no controle do almoxarifado e não é tombado.',
            acoes: [
                A.escolha('Forma de ingresso', ['Compra', 'Doação recebida', 'Cessão ou comodato recebido', 'Transferência de outro órgão', 'Produção própria', 'Regularização de bem sem registro'], { obrigatoria: true }),
                A.formulario('Registrar os dados do bem', [
                    { id: 'descricao', rotulo: 'Descrição do bem', tipo: 'texto_longo', obrigatorio: true },
                    { id: 'categoria', rotulo: 'Categoria', tipo: 'lista', opcoes: ['Mobiliário', 'Equipamento', 'Informática', 'Veículo', 'Imóvel', 'Intangível (software, licença, marca)', 'Outro'], obrigatorio: true },
                    { id: 'quantidade', rotulo: 'Quantidade', tipo: 'numero', obrigatorio: true },
                    { id: 'valor', rotulo: 'Valor de aquisição ou avaliado (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'documento', rotulo: 'Nota fiscal ou documento de origem', tipo: 'texto', obrigatorio: true },
                    { id: 'fornecedor', rotulo: 'Fornecedor, doador ou cedente', tipo: 'texto' },
                    { id: 'data_entrada', rotulo: 'Data da entrada', tipo: 'data', obrigatorio: true },
                    { id: 'garantia_fabricante', rotulo: 'Garantia do fabricante até', tipo: 'data' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a nota fiscal ou o termo de ingresso', 'Nota fiscal', { forma: 'juntar' }),
                A.fazer('Conferir quantidade, especificação e estado com o documento', { obrigatoria: true }),
                A.escolha('Natureza', ['Bem permanente', 'Material de consumo'], { obrigatoria: true }),
            ],
            saidas: { 'Tombamento e registro': quando('Natureza', 'Bem permanente'), Arquivamento: quando('Natureza', 'Material de consumo') },
        },
        {
            nome: 'Tombamento e registro', unidade: 'Patrimônio', vai: ['Carga ao responsável'],
            orientacao: 'Tombar é dar ao bem um número de patrimônio único e registrá-lo: os bens têm registro analítico com as características e os responsáveis pela guarda (Lei 4.320, art. 94), e a contabilidade registra o ativo imobilizado pelo custo, com vida útil e valor residual para a depreciação (NBC TSP 07; MCASP). Afixe a plaqueta ou etiqueta (código de barras ou QR); se não couber, anote onde está marcado. Imóvel: registre também a matrícula e o cadastro de imóveis do ente.',
            acoes: [
                A.formulario('Registrar o tombamento', [
                    { id: 'tombamento', rotulo: 'Número de tombamento (patrimônio)', tipo: 'texto', obrigatorio: true },
                    { id: 'conta', rotulo: 'Conta contábil', tipo: 'texto', obrigatorio: true },
                    { id: 'vida_util', rotulo: 'Vida útil (anos)', tipo: 'numero', obrigatorio: true },
                    { id: 'valor_residual', rotulo: 'Valor residual (R$)', tipo: 'numero' },
                    { id: 'matricula', rotulo: 'Matrícula do imóvel (se for imóvel)', tipo: 'texto' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.fazer('Afixar a plaqueta ou a etiqueta de patrimônio', { obrigatoria: true }),
                A.fazer('Registrar no sistema patrimonial e na contabilidade', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Carga ao responsável', unidade: 'Patrimônio', vai: ['Bem em uso'],
            orientacao: 'A carga entrega a guarda do bem a um agente, que assina o termo de responsabilidade e responde pela conservação e pela comunicação de qualquer dano, extravio ou mudança de local. Sem termo assinado, o bem não sai do patrimônio.',
            acoes: [
                A.formulario('Registrar a carga', [
                    { id: 'unidade_uso', rotulo: 'Unidade e local de uso', tipo: 'texto', obrigatorio: true },
                    { id: 'responsavel', rotulo: 'Responsável pela guarda', tipo: 'texto', obrigatorio: true },
                    { id: 'data_carga', rotulo: 'Data da carga', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o termo de responsabilidade assinado', 'Termo de responsabilidade', { forma: 'qualquer' }),
            ],
        },
        {
            nome: 'Bem em uso', unidade: 'Patrimônio',
            vai: ['Inventário', 'Movimentação ou transferência', 'Manutenção', 'Reavaliação e depreciação', 'Cessão ou empréstimo', 'Apuração de extravio ou dano', 'Classificação de inservível'],
            orientacao: 'O processo fica aqui enquanto o bem está em uso normal. A depreciação mensal corre na contabilidade. Quando algo acontecer com o bem, diga o quê: o processo vai para o evento e volta para cá ao fim dele.',
            acoes: [
                A.orientar('A depreciação é lançada todo mês pela contabilidade; aqui só se registram os eventos do bem.'),
                A.escolha('O que aconteceu com o bem', EVENTOS, { obrigatoria: true }),
            ],
            saidas: {
                Inventário: quando('O que aconteceu com o bem', 'Inventário'),
                'Movimentação ou transferência': quando('O que aconteceu com o bem', 'Movimentação ou transferência'),
                Manutenção: quando('O que aconteceu com o bem', 'Manutenção'),
                'Reavaliação e depreciação': quando('O que aconteceu com o bem', 'Reavaliação ou ajuste de valor'),
                'Cessão ou empréstimo': quando('O que aconteceu com o bem', 'Cessão ou empréstimo'),
                'Apuração de extravio ou dano': quando('O que aconteceu com o bem', 'Extravio, dano ou furto'),
                'Classificação de inservível': quando('O que aconteceu com o bem', 'Bem sem uso ou com defeito'),
            },
        },
        {
            nome: 'Inventário', unidade: 'Comissão de inventário', vai: ['Bem em uso', 'Movimentação ou transferência', 'Manutenção', 'Apuração de extravio ou dano'],
            orientacao: 'O levantamento geral dos bens é feito pelo menos uma vez por ano, para o balanço (Lei 4.320, art. 96), por comissão designada que não seja a responsável pela guarda. A comissão confere fisicamente o bem, a plaqueta, o local e o responsável, e o resultado é conciliado com a contabilidade.',
            acoes: [
                A.texto('Exercício ou campanha de inventário', { obrigatoria: true }),
                A.escolha('Situação encontrada', ['Localizado e conforme', 'Localizado em outro local ou com outro responsável', 'Localizado com dano ou defeito', 'Não localizado'], { obrigatoria: true }),
                A.documento('Juntar o registro da conferência', 'Relatório', { forma: 'qualquer' }),
            ],
            saidas: {
                'Bem em uso': quando('Situação encontrada', 'Localizado e conforme'),
                'Movimentação ou transferência': quando('Situação encontrada', 'Localizado em outro local ou com outro responsável'),
                Manutenção: quando('Situação encontrada', 'Localizado com dano ou defeito'),
                'Apuração de extravio ou dano': quando('Situação encontrada', 'Não localizado'),
            },
        },
        {
            nome: 'Movimentação ou transferência', unidade: 'Patrimônio', vai: ['Bem em uso', 'Baixa patrimonial'],
            orientacao: 'Toda mudança de local ou de responsável passa pelo patrimônio: o responsável anterior devolve a carga e o novo assina outro termo. Transferência para outro órgão é saída definitiva e leva à baixa, com termo de transferência.',
            acoes: [
                A.escolha('Tipo de movimentação', ['Transferência entre unidades', 'Troca de responsável', 'Saída temporária (manutenção externa, evento)', 'Transferência para outro órgão'], { obrigatoria: true }),
                A.formulario('Registrar o destino', [
                    { id: 'unidade_uso', rotulo: 'Nova unidade e local', tipo: 'texto', obrigatorio: true },
                    { id: 'responsavel', rotulo: 'Novo responsável', tipo: 'texto', obrigatorio: true },
                    { id: 'data_mov', rotulo: 'Data da movimentação', tipo: 'data', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o novo termo de responsabilidade ou o termo de transferência', 'Termo de responsabilidade', { forma: 'qualquer' }),
            ],
            saidas: { 'Baixa patrimonial': quando('Tipo de movimentação', 'Transferência para outro órgão') },
            padrao: 'Bem em uso',
        },
        {
            nome: 'Manutenção', unidade: 'Manutenção', vai: ['Bem em uso', 'Classificação de inservível'],
            orientacao: 'Use a garantia do fabricante enquanto valer. Registre a ordem de serviço e o custo. Se o conserto custar mais da metade do valor de mercado, o bem tende a ser antieconômico e vai à classificação de inservível.',
            acoes: [
                A.simNao('Está na garantia do fabricante?', { obrigatoria: true }),
                A.documento('Juntar a ordem de serviço ou o laudo técnico', 'Laudo', { forma: 'qualquer' }),
                A.numero('Custo do conserto (R$)'),
                A.simNao('O bem voltou a funcionar?', { obrigatoria: true }),
            ],
            saidas: { 'Bem em uso': quando('O bem voltou a funcionar?', 'sim'), 'Classificação de inservível': quando('O bem voltou a funcionar?', 'nao') },
        },
        {
            nome: 'Reavaliação e depreciação', unidade: 'Contabilidade', vai: ['Bem em uso'],
            orientacao: 'O valor contábil precisa refletir a realidade: depreciação pela vida útil, reavaliação quando o valor justo difere muito do contábil (em geral imóveis) e redução ao valor recuperável quando há perda (NBC TSP 07 e 09; MCASP). Revise vida útil e valor residual ao menos no fim do exercício. A reavaliação se apoia em laudo de comissão ou de avaliador.',
            acoes: [
                A.escolha('Ajuste', ['Reavaliação', 'Redução ao valor recuperável', 'Revisão de vida útil ou valor residual'], { obrigatoria: true }),
                A.documento('Juntar o laudo de avaliação', 'Laudo', { forma: 'qualquer' }),
                A.formulario('Registrar o novo valor', [
                    { id: 'valor_anterior', rotulo: 'Valor contábil anterior (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'valor_novo', rotulo: 'Valor contábil novo (R$)', tipo: 'numero', obrigatorio: true },
                    { id: 'vida_util', rotulo: 'Vida útil remanescente (anos)', tipo: 'numero' },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.fazer('Lançar o ajuste na contabilidade', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Cessão ou empréstimo', unidade: 'Gabinete', vai: ['Bem em uso', 'Apuração de extravio ou dano'],
            saidas: { 'Bem em uso': quando('O bem foi devolvido em bom estado?', 'sim'), 'Apuração de extravio ou dano': quando('O bem foi devolvido em bom estado?', 'nao') },
            orientacao: 'A cessão de uso ou o empréstimo a outro órgão ou entidade se faz por termo, com prazo, finalidade, responsável no cessionário e o dever de devolver no mesmo estado. O bem continua no patrimônio do órgão e no seu inventário.',
            acoes: [
                A.texto('Cessionário', { obrigatoria: true }),
                A.data('Devolução prevista', { obrigatoria: true }),
                A.documento('Juntar o termo de cessão ou de empréstimo', 'Termo de cessão', { forma: 'redigir' }),
                A.simNao('O bem foi devolvido em bom estado?', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Apuração de extravio ou dano', unidade: 'Patrimônio', vai: ['Bem em uso', 'Baixa patrimonial'],
            orientacao: 'O responsável comunica o fato logo; em furto ou roubo, junte o boletim de ocorrência. Dano ou extravio de pequeno valor, sem indício de dolo, pode ser resolvido por termo circunstanciado administrativo, com o ressarcimento ou a reposição do bem pelo responsável (na União, IN CGU 4/2009); fora disso, a apuração vai a processo disciplinar derivado ("Novo processo derivado deste"). Bem localizado volta ao uso; perda confirmada leva à baixa.',
            acoes: [
                A.escolha('O que houve', ['Extravio', 'Dano', 'Furto ou roubo'], { obrigatoria: true }),
                A.documento('Juntar a comunicação do responsável', 'Comunicação', { forma: 'qualquer' }),
                A.documento('Juntar o boletim de ocorrência', 'Boletim de ocorrência', { forma: 'juntar', se: quando('O que houve', 'Furto ou roubo') }),
                A.simNao('Pequeno valor e sem indício de dolo?', { obrigatoria: true }),
                A.documento('Juntar o termo circunstanciado administrativo', 'Termo circunstanciado', { forma: 'redigir', se: quando('Pequeno valor e sem indício de dolo?', 'sim') }),
                A.texto('Número do processo disciplinar derivado', { se: quando('Pequeno valor e sem indício de dolo?', 'nao') }),
                A.escolha('Resultado da apuração', ['Bem localizado', 'Ressarcido ou reposto pelo responsável', 'Remetido a processo disciplinar', 'Sem responsável identificado'], { obrigatoria: true }),
            ],
            saidas: { 'Bem em uso': quando('Resultado da apuração', 'Bem localizado') },
            padrao: 'Baixa patrimonial',
        },
        {
            nome: 'Classificação de inservível', unidade: 'Comissão de desfazimento', vai: ['Reaproveitamento', 'Alienação ou descarte'],
            orientacao: 'Comissão de pelo menos 3 membros classifica e avalia o bem. Ocioso: em condições de uso, mas sem aproveitamento. Recuperável: o conserto custa até 50% do valor de mercado. Antieconômico: manutenção onerosa ou rendimento precário. Irrecuperável: não pode mais ser usado para o que era (na União, Decreto 12.785/2025, que substituiu o Decreto 9.373/2018; estados e municípios seguem o regulamento próprio). Ociosos e recuperáveis vão primeiro ao reaproveitamento.',
            acoes: [
                A.escolha('Classificação', ['Ocioso', 'Recuperável', 'Antieconômico', 'Irrecuperável'], { obrigatoria: true }),
                A.numero('Valor de mercado avaliado (R$)', { obrigatoria: true }),
                A.documento('Juntar o laudo da comissão', 'Laudo', { forma: 'redigir' }),
            ],
            saidas: { Reaproveitamento: quando('Classificação', 'Ocioso', 'Recuperável'), 'Alienação ou descarte': quando('Classificação', 'Antieconômico', 'Irrecuperável') },
        },
        {
            nome: 'Reaproveitamento', unidade: 'Patrimônio', vai: ['Bem em uso', 'Manutenção', 'Alienação ou descarte', 'Baixa patrimonial'],
            orientacao: 'Ofereça o bem a outras unidades do órgão e, se ninguém precisar, a outros órgãos e entidades públicas. Transferência interna mantém o bem no patrimônio, com nova carga; externa leva à baixa. Recuperável que vale a pena consertar volta à manutenção. Sem interessado, o bem vai à alienação.',
            acoes: [
                A.escolha('Destino', ['Outra unidade do órgão', 'Conserto', 'Outro órgão ou entidade pública', 'Sem interessado'], { obrigatoria: true }),
                A.documento('Juntar o termo de transferência', 'Termo de transferência', { forma: 'redigir', se: quando('Destino', 'Outra unidade do órgão', 'Outro órgão ou entidade pública') }),
            ],
            saidas: {
                'Bem em uso': quando('Destino', 'Outra unidade do órgão'),
                Manutenção: quando('Destino', 'Conserto'),
                'Baixa patrimonial': quando('Destino', 'Outro órgão ou entidade pública'),
                'Alienação ou descarte': quando('Destino', 'Sem interessado'),
            },
        },
        {
            nome: 'Alienação ou descarte', unidade: 'Gabinete', vai: ['Baixa patrimonial'],
            orientacao: 'A alienação de bem público depende de interesse público justificado e de avaliação prévia; para móveis, a regra é o leilão, dispensado na doação para fins e uso de interesse social, na permuta entre órgãos e nos demais casos do art. 76, II, da Lei 14.133. O irrecuperável sem valor vai à inutilização ou ao descarte ambientalmente adequado, com logística reversa quando houver (Lei 12.305/2010). Imóvel exige também autorização legislativa (art. 76, I).',
            acoes: [
                A.escolha('Forma', ['Leilão', 'Doação para fim de interesse social', 'Permuta', 'Inutilização ou descarte ambientalmente adequado'], { obrigatoria: true }),
                A.documento('Juntar a justificativa do interesse público e a avaliação', 'Justificativa', { forma: 'redigir' }),
                A.documento('Juntar o edital e a ata do leilão', 'Ata', { forma: 'juntar', se: quando('Forma', 'Leilão') }),
                A.documento('Juntar o termo de doação ou de permuta', 'Termo de doação', { forma: 'redigir', se: quando('Forma', 'Doação para fim de interesse social', 'Permuta') }),
                A.documento('Juntar o termo de inutilização ou o comprovante de destinação', 'Termo', { forma: 'qualquer', se: quando('Forma', 'Inutilização ou descarte ambientalmente adequado') }),
                A.numero('Valor obtido (R$)', { se: quando('Forma', 'Leilão') }),
            ],
        },
        {
            nome: 'Baixa patrimonial', unidade: 'Patrimônio', avanco: 'auto', vai: ['Arquivamento'],
            orientacao: 'A baixa tira o bem do sistema patrimonial e da contabilidade, encerra a carga do responsável e guarda o motivo e o documento que a justifica. O número de tombamento não se reaproveita.',
            acoes: [
                A.escolha('Motivo da baixa', ['Alienação', 'Transferência para outro órgão', 'Extravio, dano ou furto', 'Inutilização ou descarte'], { obrigatoria: true }),
                A.data('Data da baixa', { obrigatoria: true }),
                A.documento('Juntar o termo de baixa', 'Termo de baixa', { forma: 'redigir' }),
                A.fazer('Baixar no sistema patrimonial e na contabilidade', { obrigatoria: true }),
            ],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar. Material de consumo segue no controle do almoxarifado.' },
    ]);
}

export const modelos = [gestaoPatrimonio];
