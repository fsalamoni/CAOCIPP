// Modelos de rito julgados em sessão de colegiado (S15). Ver a forma de escrever em ./dsl.js.
// A ação Julgar em colegiado (A.julgamento) liga a fase à aba Sessões: o processo
// entra na pauta, o relator vota, os pares votam ou pedem vista, a secretaria
// proclama e o resultado proclamado cumpre a ação e escolhe a saída da fase.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';

/** 1. Recurso administrativo julgado por colegiado (Lei 9.784/1999, arts. 56 a 65). */
export function recursoAoColegiado() {
    return montar({
        id: 'recurso-colegiado', nome: 'Recurso administrativo julgado por colegiado', area: 'geral', porte: 'medio', referencia: 'Lei 9.784',
        descricao: 'Para o órgão em que o recurso contra decisão administrativa é julgado por um colegiado: junta ou conselho de recursos, conselho superior, câmara recursal. A autoridade que decidiu pode reconsiderar em 5 dias; mantida a decisão, o recurso sobe, é distribuído a um relator e os demais interessados apresentam alegações em 5 dias úteis. Se o provimento puder agravar a situação do recorrente, ele é ouvido antes. O colegiado julga em sessão, com relator, votos, vista e acórdão, e pode não conhecer, negar ou dar provimento, total ou parcial, ou anular a decisão.',
        quando: 'Recursos contra decisões administrativas quando o regimento atribui o julgamento a um colegiado. Ajuste prazos, sustentação oral e quórum ao regimento.',
        base: 'Lei 9.784/1999, arts. 56 (reconsideração em 5 dias), 57 (até três instâncias), 58 (legitimados), 59 (10 dias para recorrer e 30 para decidir), 60, 61 (efeito suspensivo), 62 (alegações em 5 dias úteis), 63 (não conhecimento) e 64 (confirmar, modificar, anular ou revogar; gravame só com oitiva prévia).',
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Recorrente', interessado: 'Interessado' } },
    }, [
        {
            nome: 'Interposição', unidade: 'Unidade recorrida', avanco: 'auto', nome_publico: 'Recurso recebido',
            orientacao: 'O recurso é dirigido à autoridade que decidiu, por requerimento com os fundamentos do pedido de reexame (arts. 56, § 1º, e 60). O prazo é de 10 dias da ciência ou divulgação da decisão (art. 59). Recebido mesmo fora do prazo: quem decide o conhecimento é o colegiado (art. 63).',
            acoes: [
                A.formulario('Dados do recurso', [
                    { id: 'decisao', rotulo: 'Decisão recorrida', tipo: 'texto', obrigatorio: true },
                    { id: 'ciencia', rotulo: 'Data da ciência da decisão', tipo: 'data', obrigatorio: true },
                    { id: 'interposicao', rotulo: 'Data da interposição', tipo: 'data', obrigatorio: true },
                    { id: 'suspensivo', rotulo: 'Pediu efeito suspensivo?', tipo: 'sim_nao', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o recurso e os documentos', 'Recurso', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Juízo de reconsideração', unidade: 'Autoridade recorrida', prazo_dias: 5, prazo_auto: true, prazo_contagem: corridos, vai: ['Distribuição ao relator', 'Decisão reconsiderada'],
            orientacao: 'Quem decidiu pode reconsiderar em 5 dias; se não reconsiderar, encaminha ao colegiado (art. 56, § 1º). Havendo justo receio de prejuízo de difícil reparação, pode dar efeito suspensivo, de ofício ou a pedido (art. 61, parágrafo único).',
            acoes: [
                A.escolha('Reconsiderar a decisão?', ['Reconsidera', 'Mantém e encaminha ao colegiado'], { obrigatoria: true, destino: 'autos' }),
                A.escolha('Efeito suspensivo', ['Concedido', 'Negado', 'Não pedido'], { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o despacho fundamentado', 'Despacho', { forma: 'redigir' }),
            ],
            saidas: { 'Decisão reconsiderada': quando('Reconsiderar a decisão?', 'Reconsidera'), 'Distribuição ao relator': quando('Reconsiderar a decisão?', 'Mantém e encaminha ao colegiado') },
        },
        {
            nome: 'Distribuição ao relator', unidade: 'Secretaria do colegiado', avanco: 'auto', vai: ['Alegações dos interessados'],
            orientacao: 'Registre o relator sorteado ou designado conforme o regimento. Na pauta da sessão, a secretaria confirma o relator entre quem vota no dia. O colegiado tem 30 dias do recebimento dos autos para decidir, prorrogáveis por igual período com justificativa (art. 59, §§ 1º e 2º).',
            acoes: [A.texto('Relator designado', { obrigatoria: true, destino: 'autos' })],
        },
        {
            nome: 'Alegações dos interessados', unidade: 'Secretaria do colegiado', avanco: 'auto', vai: ['Relatório e voto'], nome_publico: 'Alegações sobre o recurso',
            orientacao: 'Interposto o recurso, intime os demais interessados para alegações em 5 dias úteis (art. 62). Sem outros interessados, registre e siga.',
            acoes: [
                A.comunicar('Intimar os demais interessados', { especie: 'intimacao', polos: ['interessado'], dias: 5, texto: 'Foi interposto recurso contra a decisão. Apresente suas alegações em 5 dias úteis.' }),
                A.esperar('Aguardar as alegações', 'Intimar os demais interessados'),
            ],
        },
        {
            nome: 'Relatório e voto', unidade: 'Gabinete do relator', vai: ['Ciência de possível agravamento', 'Julgamento em sessão'],
            orientacao: 'O relator examina o recurso e prepara relatório e voto. Se o provimento puder agravar a situação do recorrente, ele deve ser cientificado para alegar antes da decisão (art. 64, parágrafo único). Sem isso, o processo fica pronto para a pauta.',
            acoes: [
                A.simNao('O julgamento pode agravar a situação do recorrente?', { obrigatoria: true }),
                A.documento('Juntar o relatório, se o regimento o publica antes da sessão', 'Relatório', { forma: 'redigir', nivel: 'opcional' }),
            ],
            saidas: { 'Ciência de possível agravamento': quando('O julgamento pode agravar a situação do recorrente?', 'sim'), 'Julgamento em sessão': quando('O julgamento pode agravar a situação do recorrente?', 'nao') },
        },
        {
            nome: 'Ciência de possível agravamento', unidade: 'Secretaria do colegiado', avanco: 'auto', vai: ['Julgamento em sessão'],
            orientacao: 'Cientifique o recorrente de que o julgamento pode agravar sua situação, para que formule alegações antes da decisão (art. 64, parágrafo único). O prazo é o do regimento; sem regra, use 10 dias.',
            acoes: [
                A.comunicar('Cientificar o recorrente', { especie: 'intimacao', polos: ['requerente'], dias: 10, contagem: corridos, texto: 'O julgamento do seu recurso pode resultar em agravamento da sua situação. Apresente alegações antes da decisão.' }, { obrigatoria: true }),
                A.esperar('Aguardar as alegações do recorrente', 'Cientificar o recorrente', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Julgamento em sessão', unidade: 'Secretaria do colegiado', vai: ['Cumprimento', 'Retorno à origem'], padrao: 'Cumprimento', nome_publico: 'Julgamento',
            ao_entrar: { pendencia: 'Incluir o recurso na pauta da sessão do colegiado.' },
            orientacao: 'Inclua o processo na pauta da aba Sessões: as partes são avisadas e podem pedir sustentação oral. Na sessão, o relator vota, os pares acompanham, divergem ou pedem vista, e a secretaria proclama. O colegiado pode não conhecer (intempestivo, órgão incompetente, ilegítimo ou esfera exaurida, art. 63), negar ou dar provimento, total ou parcial, ou anular a decisão (art. 64). O redator junta o acórdão, e a ata da sessão registra o resultado.',
            acoes: [
                A.julgamento('Resultado do julgamento', ['Não conhece', 'Nega provimento', 'Dá provimento em parte', 'Dá provimento', 'Anula a decisão'], {}, { obrigatoria: true }),
                A.documento('Juntar o acórdão', 'Acórdão', { forma: 'juntar', nivel: 'recomendado' }),
                A.comunicar('Intimar as partes do acórdão', { especie: 'intimacao', dias: 0, texto: 'Fica intimado do acórdão que julgou o recurso.' }, { obrigatoria: true }),
            ],
            saidas: { 'Retorno à origem': quando('Resultado do julgamento', 'Anula a decisão') },
        },
        {
            nome: 'Cumprimento', unidade: 'Unidade recorrida', vai: ['Arquivamento'],
            orientacao: 'Cumpra o acórdão e certifique. Se cabe nova instância (art. 57), o recurso segue o mesmo caminho.',
            acoes: [A.fazer('Cumprir o acórdão', { obrigatoria: true, destino: 'autos' })],
        },
        {
            nome: 'Decisão reconsiderada', unidade: 'Unidade recorrida', vai: ['Arquivamento'],
            orientacao: 'A autoridade reconsiderou: cumpra a nova decisão e intime os interessados.',
            acoes: [A.comunicar('Intimar da reconsideração', { especie: 'intimacao', dias: 0, texto: 'A decisão recorrida foi reconsiderada pela autoridade que a proferiu.' }, { obrigatoria: true })],
        },
        { nome: 'Retorno à origem', unidade: 'Unidade recorrida', final: true, orientacao: 'Anulada a decisão, os autos voltam à origem para nova decisão, que pode ser objeto de novo recurso.' },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

/** 2. Proposta de resolução ou outro ato normativo deliberada pelo conselho. */
export function deliberacaoNormativa() {
    return montar({
        id: 'deliberacao-normativa', nome: 'Proposta de ato normativo ao conselho', area: 'gestao', porte: 'curto', referencia: 'Regimento do colegiado',
        descricao: 'Para conselhos e colegiados que editam resoluções, enunciados, instruções e regimentos. A proposta chega à secretaria com minuta e justificativa, recebe parecer da comissão temática, pode passar por consulta pública quando a matéria é de interesse geral, e o relator leva voto e emendas à sessão. O colegiado aprova, aprova com emendas ou rejeita; aprovada, a secretaria consolida a redação final e publica.',
        quando: 'Atos normativos de conselho superior, conselho de classe, conselho de política pública ou comissão. Ajuste quórum e prazos ao regimento.',
        base: 'Lei 9.784/1999, arts. 31 e 32 (consulta e audiência pública), 50, § 1º (motivação) e o regimento do colegiado (quórum, emendas e publicação).',
        tipo: { polos: ['requerente'], nomes_polos: { requerente: 'Proponente' } },
    }, [
        {
            nome: 'Proposta', unidade: 'Secretaria do colegiado', avanco: 'auto', nome_publico: 'Proposta recebida',
            orientacao: 'Registre a proposta com a minuta e a justificativa. Confira se o proponente tem iniciativa pelo regimento.',
            acoes: [
                A.formulario('Dados da proposta', [
                    { id: 'tipo', rotulo: 'Tipo de ato', tipo: 'lista', obrigatorio: true, opcoes: ['Resolução', 'Enunciado', 'Instrução normativa', 'Recomendação', 'Regimento interno ou alteração'] },
                    { id: 'proponente', rotulo: 'Proponente', tipo: 'texto', obrigatorio: true },
                    { id: 'ementa', rotulo: 'Ementa', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar a minuta e a justificativa', 'Minuta', { forma: 'qualquer' }),
            ],
        },
        {
            nome: 'Parecer da comissão', unidade: 'Comissão temática', prazo_dias: 15, prazo_auto: true, prazo_contagem: corridos, vai: ['Consulta pública', 'Relatoria'],
            orientacao: 'A comissão examina a pertinência, a competência do colegiado e a técnica do texto, e propõe emendas. Matéria de interesse geral pode passar por consulta pública antes da decisão (art. 31).',
            acoes: [
                A.documento('Juntar o parecer da comissão', 'Parecer', { forma: 'redigir' }),
                A.simNao('Abrir consulta pública?', { obrigatoria: true }),
            ],
            saidas: { 'Consulta pública': quando('Abrir consulta pública?', 'sim'), 'Relatoria': quando('Abrir consulta pública?', 'nao') },
        },
        {
            nome: 'Consulta pública', unidade: 'Secretaria do colegiado', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Relatoria'],
            orientacao: 'Divulgue a minuta com prazo para contribuições escritas (art. 31, § 1º). Quem participa não vira interessado, mas tem direito a resposta fundamentada, que pode ser comum às alegações iguais (art. 31, § 2º).',
            acoes: [
                A.fazer('Publicar o aviso da consulta com a minuta', { obrigatoria: true }),
                A.documento('Juntar as contribuições recebidas', '', { forma: 'juntar', nivel: 'recomendado' }),
                A.textoLongo('Síntese das contribuições e respostas', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        {
            nome: 'Relatoria', unidade: 'Gabinete do relator', vai: ['Deliberação em sessão'],
            orientacao: 'O relator consolida parecer, contribuições e emendas e prepara o voto, com o texto que propõe aprovar.',
            acoes: [
                A.texto('Relator', { obrigatoria: true, destino: 'autos' }),
                A.documento('Juntar o texto proposto com as emendas', 'Minuta', { forma: 'redigir', nivel: 'recomendado' }),
            ],
        },
        {
            nome: 'Deliberação em sessão', unidade: 'Secretaria do colegiado', vai: ['Publicação', 'Arquivamento'], nome_publico: 'Deliberação do conselho',
            ao_entrar: { pendencia: 'Incluir a proposta na pauta da sessão do colegiado.' },
            orientacao: 'Inclua a proposta na pauta da aba Sessões. O relator vota, os conselheiros acompanham, divergem com fundamentos ou pedem vista, e a secretaria proclama. Quórum de aprovação e emendas seguem o regimento.',
            acoes: [
                A.julgamento('Deliberação', ['Aprovada', 'Aprovada com emendas', 'Rejeitada'], {}, { obrigatoria: true }),
            ],
            saidas: { 'Publicação': quando('Deliberação', 'Aprovada', 'Aprovada com emendas'), 'Arquivamento': quando('Deliberação', 'Rejeitada') },
        },
        {
            nome: 'Publicação', unidade: 'Secretaria do colegiado', vai: ['Ato publicado'],
            orientacao: 'Consolide a redação final com as emendas aprovadas, colha a assinatura do presidente e publique no diário oficial ou no meio que o regimento prevê.',
            acoes: [
                A.documento('Juntar o ato com a redação final', 'Resolução', { forma: 'redigir' }),
                A.data('Data da publicação', { obrigatoria: true, destino: 'autos' }),
                A.texto('Número do ato', { obrigatoria: true, destino: 'autos' }),
            ],
        },
        { nome: 'Ato publicado', unidade: 'Secretaria do colegiado', final: true, ao_entrar: { arquivar: true }, orientacao: 'Ato publicado e processo arquivado ao entrar. Alteração posterior abre nova proposta.' },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Proposta rejeitada, arquivada ao entrar.' },
    ]);
}

export const modelos = [recursoAoColegiado, deliberacaoNormativa];
