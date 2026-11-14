// Modelos da área administrativa geral. Ver a forma de escrever em ./dsl.js.
import { A, montar, quando } from './dsl.js';

const corridos = 'corridos';

/** 1. Processo administrativo geral com interessado (Lei 9.784/1999). */
export function processoAdministrativoGeral() {
    return montar({
        id: 'pa-geral', nome: 'Processo administrativo com interessado', area: 'geral', porte: 'medio',
        descricao: 'Rito-base para qualquer pedido que exige decisão motivada da Administração: autorização, registro, reconhecimento de direito, certidão com análise. Recebe o requerimento sem recusar (pede o que falta), instrui com provas e diligências, ouve o interessado nas alegações finais, decide em até 30 dias e abre recurso, com reconsideração antes de subir. Serve de rito subsidiário quando não há lei específica.',
        quando: 'Pedidos de particulares ou servidores sem rito próprio em lei; processos de ofício que afetem alguém.',
        base: 'Lei 9.784/1999, arts. 6º, 9º, 18 a 21, 24, 26 a 28, 38, 41, 42, 44, 48 a 50, 56 a 67.',
        tipo: { polos: ['requerente', 'interessado'], nomes_polos: { requerente: 'Requerente', interessado: 'Interessado' } },
    }, [
        {
            nome: 'Protocolo', unidade: 'Secretaria', avanco: 'auto',
            orientacao: 'Receba o requerimento mesmo incompleto (art. 6º, parágrafo único): confira os dados mínimos e oriente o interessado a suprir o que faltar.',
            acoes: [
                A.formulario('Conferir os dados mínimos do requerimento', [
                    { id: 'autoridade', rotulo: 'Autoridade a quem se dirige', tipo: 'texto', obrigatorio: true },
                    { id: 'endereco', rotulo: 'Endereço para comunicações', tipo: 'texto', obrigatorio: true },
                    { id: 'pedido', rotulo: 'Pedido, fatos e fundamentos', tipo: 'texto_longo', obrigatorio: true },
                ], { obrigatoria: true, destino: 'informacao', folha_dados: true }),
                A.documento('Juntar o requerimento e os documentos', 'Requerimento', { forma: 'juntar' }),
            ],
        },
        {
            nome: 'Admissibilidade e saneamento', unidade: 'Unidade instrutora', prazo_dias: 5, prazo_auto: true, prazo_contagem: corridos, vai: ['Instrução', 'Exigência ao interessado', 'Arquivamento'],
            orientacao: 'Verifique competência, legitimidade (art. 9º) e impedimento ou suspeição de quem vai atuar (arts. 18 a 20). Faltando documento, faça a exigência; não atendida, o pedido é arquivado (art. 40).',
            acoes: [
                A.escolha('Requerimento em ordem?', ['Em ordem', 'Precisa complementar', 'Não conhecer'], { obrigatoria: true }),
                A.simNao('Há impedimento ou suspeição de quem atua?', { obrigatoria: true, ajuda: 'Se sim, redistribua antes de seguir (arts. 18 a 21).' }),
                A.documento('Despacho de não conhecimento', 'Despacho', { forma: 'redigir', se: quando('Requerimento em ordem?', 'Não conhecer') }),
            ],
            saidas: { 'Instrução': quando('Requerimento em ordem?', 'Em ordem'), 'Exigência ao interessado': quando('Requerimento em ordem?', 'Precisa complementar'), 'Arquivamento': quando('Requerimento em ordem?', 'Não conhecer') },
        },
        {
            nome: 'Exigência ao interessado', unidade: 'Unidade instrutora', avanco: 'auto', vai: ['Admissibilidade e saneamento'], nome_publico: 'Complementação do pedido',
            orientacao: 'Intime o interessado a complementar, dizendo o que falta. Respondida ou vencido o prazo, o processo volta à admissibilidade.',
            acoes: [
                A.comunicar('Intimar para complementar', { especie: 'intimacao', dias: 5, contagem: corridos, texto: 'Complemente o requerimento com o que falta, indicado a seguir.' }, { obrigatoria: true }),
                A.esperar('Aguardar a complementação', 'Intimar para complementar', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Instrução', unidade: 'Unidade instrutora', vai: ['Parecer jurídico', 'Alegações finais'],
            orientacao: 'Junte provas, ouça outros órgãos e faça diligências. Prova só se recusa por decisão fundamentada, se ilícita, impertinente, desnecessária ou protelatória (art. 38, § 2º). Diligência com presença do interessado: intime com 3 dias úteis de antecedência (art. 41).',
            acoes: [
                A.documento('Juntar provas, informações e laudos', '', { forma: 'qualquer', nivel: 'recomendado' }),
                A.audiencia('Designar diligência ou oitiva, se houver', 'oitiva'),
                A.comunicar('Intimar para a diligência', { especie: 'intimacao', dias: 0, texto: 'Compareça à diligência em {audiencia}.' }),
                A.simNao('Parecer jurídico é obrigatório neste caso?', { obrigatoria: true }),
            ],
            saidas: { 'Parecer jurídico': quando('Parecer jurídico é obrigatório neste caso?', 'sim'), 'Alegações finais': quando('Parecer jurídico é obrigatório neste caso?', 'nao') },
        },
        {
            nome: 'Parecer jurídico', unidade: 'Assessoria jurídica', prazo_dias: 15, prazo_auto: true, prazo_contagem: corridos, avanco: 'auto',
            orientacao: 'Parecer em 15 dias (art. 42). Obrigatório e vinculante, o processo espera; obrigatório e não vinculante, pode seguir sem ele.',
            acoes: [A.documento('Juntar o parecer', 'Parecer', { forma: 'redigir' })],
        },
        {
            nome: 'Alegações finais', unidade: 'Unidade instrutora', avanco: 'auto',
            orientacao: 'Encerrada a instrução, o interessado tem 10 dias para alegar (art. 44). Com a manifestação ou o fim do prazo, segue para decisão.',
            acoes: [
                A.comunicar('Intimar para alegações finais', { especie: 'intimacao', dias: 10, contagem: corridos, texto: 'Encerrada a instrução, apresente suas alegações finais.' }, { obrigatoria: true }),
                A.esperar('Aguardar as alegações', 'Intimar para alegações finais', { obrigatoria: true }),
            ],
        },
        {
            nome: 'Decisão', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Recurso', 'Cumprimento'],
            orientacao: 'Decida em até 30 dias, prorrogáveis por igual período com motivação (art. 49). A decisão é motivada (art. 50) e o interessado é intimado, com 10 dias para recorrer.',
            acoes: [
                A.escolha('Resultado', ['Deferido', 'Deferido em parte', 'Indeferido'], { obrigatoria: true, destino: 'autos', partes: true }),
                A.documento('Juntar a decisão motivada', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão', { especie: 'intimacao', dias: 10, contagem: corridos, texto: 'Fica intimado da decisão. Cabe recurso em 10 dias.' }, { obrigatoria: true }),
                A.esperar('Aguardar o prazo de recurso', 'Intimar da decisão', { obrigatoria: true }),
            ],
            saidas: { 'Recurso': quando('Aguardar o prazo de recurso', 'Apresentada', 'Parcial'), 'Cumprimento': quando('Aguardar o prazo de recurso', 'Sem manifestação') },
        },
        {
            nome: 'Recurso', unidade: 'Gabinete', prazo_dias: 30, prazo_auto: true, prazo_contagem: corridos, vai: ['Cumprimento'],
            orientacao: 'Juízo de admissibilidade (art. 63). Quem decidiu pode reconsiderar em 5 dias; se não, remete à autoridade superior, que decide em 30 dias (art. 59). No máximo três instâncias (art. 57); sem efeito suspensivo, salvo concessão (art. 61). Se o recurso puder agravar a situação do recorrente, intime-o antes (art. 64).',
            acoes: [
                A.escolha('Admissibilidade do recurso', ['Conhecido', 'Não conhecido'], { obrigatoria: true }),
                A.escolha('Reconsiderar?', ['Reconsidera', 'Mantém e remete'], { obrigatoria: true, se: quando('Admissibilidade do recurso', 'Conhecido') }),
                A.comunicar('Intimar os demais interessados para alegações', { especie: 'intimacao', polos: ['interessado'], dias: 5, texto: 'Interposto recurso, apresente alegações em 5 dias úteis.' }, { se: quando('Reconsiderar?', 'Mantém e remete') }),
                A.documento('Juntar a decisão do recurso', 'Decisão', { forma: 'redigir' }),
                A.comunicar('Intimar da decisão final', { especie: 'intimacao', dias: 0, texto: 'Fica intimado da decisão do recurso.' }, { obrigatoria: true }),
            ],
        },
        {
            nome: 'Cumprimento', unidade: 'Secretaria', vai: ['Arquivamento'],
            orientacao: 'Cumpra o que foi decidido e certifique.',
            acoes: [A.fazer('Cumprir a decisão', { obrigatoria: true, destino: 'autos' })],
        },
        { nome: 'Arquivamento', unidade: 'Secretaria', final: true, ao_entrar: { arquivar: true }, orientacao: 'Arquivado ao entrar.' },
    ]);
}

export const modelos = [processoAdministrativoGeral];
